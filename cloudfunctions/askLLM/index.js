// 云函数 askLLM：代理大模型问答
// API Key 通过云函数「环境变量」注入，代码中不保存密钥
const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const DASHSCOPE_KEY = process.env.DASHSCOPE_KEY || ''
const MODEL = process.env.LLM_MODEL || 'deepseek-v4.1-flash'

const SYSTEM_PROMPT =
  '你是一位温和、耐心的穿衣搭配助手，正在帮助一位刚上大学、因为成长环境原因缺乏基础穿衣常识的年轻人。请始终做到：' +
  '1) 不评判、不嘲笑，多用「很多人一开始都不懂，这很正常」这类话；' +
  '2) 给出具体、可执行的建议；' +
  '3) 解释「为什么」，而不只给结果；' +
  '4) 语气温暖、鼓励。' +
  '5) 我会告诉你今天的真实日期、用户所在城市和当地实时天气，作为参考信息，不要反问用户所在城市或天气。' +
  '6) 区分问题类型：如果用户问的是泛指季节的（如「这个季节穿什么」「秋天怎么穿」），请先讲这个季节的穿衣特点和通用搭配思路，再结合今天的天气给一套具体方案；如果用户问的是具体某天（如「今天穿什么」），就直接结合当天天气回答。' +
  '回答用中文，简洁易懂。'

function httpPost(url, body, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const payload = JSON.stringify(body)
    const req = https.request(
      {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...headers,
        },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            reject(new Error('大模型数据解析失败'))
          }
        })
      }
    )
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

/** 生成带真实日期与天气的上下文（作为参考信息，不强制只答今天） */
function buildContext(weather) {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const dateStr = `${now.getUTCFullYear()}年${now.getUTCMonth() + 1}月${now.getUTCDate()}日`
  let context = `今天是 ${dateStr}。`

  if (weather && weather.city) {
    context += `用户所在城市：${weather.city}；当地实时天气：${weather.text}；当前气温 ${weather.temp}℃，体感 ${weather.feelsLike}℃；季节：${weather.season}。`
  } else {
    context += '（未获取到用户位置与天气，请按当前日期判断季节作答）'
  }

  context += ' 以上信息供参考，请根据用户问题的类型选择回答重点。'
  return context
}

exports.main = async (event) => {
  if (!DASHSCOPE_KEY) {
    throw new Error('未配置环境变量 DASHSCOPE_KEY，请在云函数配置中添加')
  }

  const query = String(event.query || '').trim()
  if (!query) {
    throw new Error('问题不能为空')
  }

  const context = buildContext(event.weather)

  const res = await httpPost(
    'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    {
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `${context}\n\n用户问题：${query}` },
      ],
    },
    { Authorization: `Bearer ${DASHSCOPE_KEY}` }
  )

  const content =
    res.choices && res.choices[0] && res.choices[0].message && res.choices[0].message.content
  if (!content) {
    throw new Error('大模型返回为空')
  }
  return { answer: content }
}
