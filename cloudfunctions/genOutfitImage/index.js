// 云函数 genOutfitImage：调用通义万相（DashScope）文生图，生成男/女模特插画试穿图
// API Key 通过云函数「环境变量」DASHSCOPE_KEY 注入，代码中不保存密钥
const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const DASHSCOPE_KEY = process.env.DASHSCOPE_KEY || ''
// 通义万相 2.1 turbo（最便宜的文生图档位，出插画/人像够用）
// 想更清晰可把环境变量 IMAGE_MODEL 设为 wanx2.1-t2i-plus
const IMAGE_MODEL = process.env.IMAGE_MODEL || 'wanx2.1-t2i-turbo'
const SYNTHESIS_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis'
const TASK_URL = 'https://dashscope.aliyuncs.com/api/v1/tasks'

const MAX_POLL = 20        // 最多轮询 20 次
const POLL_INTERVAL = 3000 // 每次间隔 3s

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function request(url, options, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const payload = body ? JSON.stringify(body) : null
    const headers = { ...(options.headers || {}) }
    if (payload) {
      headers['Content-Type'] = 'application/json'
      headers['Content-Length'] = Buffer.byteLength(payload)
    }
    const req = https.request(
      {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers,
      },
      (res) => {
        const chunks = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => resolve({ status: res.statusCode, buffer: Buffer.concat(chunks) }))
      }
    )
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

async function requestJson(url, options, body) {
  const res = await request(url, options, body)
  let json = {}
  try {
    json = JSON.parse(res.buffer.toString('utf8'))
  } catch (e) {
    throw new Error(`返回解析失败(status=${res.status})`)
  }
  return { status: res.status, json }
}

/** 提交文生图任务 */
async function submitTask(prompt) {
  const { status, json } = await requestJson(
    SYNTHESIS_URL,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DASHSCOPE_KEY}`,
        'X-DashScope-Async': 'enable',
      },
    },
    {
      model: IMAGE_MODEL,
      input: { prompt },
      parameters: { size: '768*1024', n: 1, watermark: false },
    }
  )
  if (status !== 200 || !json.output || !json.output.task_id) {
    const msg = (json && json.message) || `提交失败(status=${status})`
    throw new Error(msg)
  }
  return json.output.task_id
}

/** 轮询任务直到出图，返回图片 URL */
async function waitForImage(taskId) {
  for (let i = 0; i < MAX_POLL; i++) {
    await sleep(POLL_INTERVAL)
    const { json } = await requestJson(`${TASK_URL}/${taskId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${DASHSCOPE_KEY}` },
    })
    const output = json.output || {}
    if (output.task_status === 'SUCCEEDED') {
      const results = output.results || []
      const url = results[0] && (results[0].url || results[0].bmp_url)
      if (!url) throw new Error('出图为空')
      return url
    }
    if (output.task_status === 'FAILED' || output.task_status === 'CANCELED') {
      throw new Error(output.message || '生图任务失败')
    }
  }
  throw new Error('生图超时，请稍后重试')
}

/** 下载远程图片为 Buffer */
async function download(url) {
  const res = await request(url, { method: 'GET' })
  if (res.status !== 200) {
    throw new Error(`图片下载失败(status=${res.status})`)
  }
  return res.buffer
}

exports.main = async (event) => {
  if (!DASHSCOPE_KEY) {
    throw new Error('未配置环境变量 DASHSCOPE_KEY，请在云函数配置中添加')
  }
  const prompt = String(event.prompt || '').trim()
  if (!prompt) {
    throw new Error('生图提示词不能为空')
  }

  const taskId = await submitTask(prompt)
  const imageUrl = await waitForImage(taskId)

  const buffer = await download(imageUrl)
  const fileName = `outfit/${Date.now()}_${Math.floor(Math.random() * 10000)}.png`
  const uploadRes = await cloud.uploadFile({
    cloudPath: fileName,
    fileContent: buffer,
  })

  return { fileID: uploadRes.fileID, taskId }
}