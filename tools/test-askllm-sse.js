// 离线校验 askLLM 的 SSE 解析：不联网、不依赖 wx-server-sdk（用桩替换）。
// 运行：node tools/test-askllm-sse.js
const path = require('path')
const Module = require('module')

// 云函数顶部 require('wx-server-sdk') 会初始化云环境，测试时替换成空桩
const originalLoad = Module._load
/** 记录云函数对 llm_stream 的每次写入，供节流测试断言 */
const writes = []
/** 让下一次（或接下来 N 次）写入失败，模拟集合不存在等异常 */
let failWrites = 0

Module._load = function patchedLoad(request) {
  if (request === 'wx-server-sdk') {
    return {
      init() {},
      DYNAMIC_CURRENT_ENV: 'test',
      database: () => ({
        collection: () => ({
          doc: () => ({
            update: async ({ data }) => {
              if (failWrites > 0) {
                failWrites -= 1
                const err = new Error('collection not exists')
                err.errCode = -502005
                throw err
              }
              writes.push(data)
              return { stats: { updated: 1 } }
            },
          }),
        }),
      }),
    }
  }
  return originalLoad.apply(this, arguments)
}

const askLLM = require(path.join(__dirname, '..', 'cloudfunctions', 'askLLM', 'index.js'))
Module._load = originalLoad

const createSseParser = askLLM.__createSseParser
if (typeof createSseParser !== 'function') {
  console.error('[fail] __createSseParser 未导出')
  process.exit(1)
}

function sse(payload) {
  return 'data: ' + JSON.stringify(payload) + '\n\n'
}

function deltaEvent(text) {
  return sse({ choices: [{ delta: { content: text } }] })
}

let failed = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  console.log((ok ? '[ok] ' : '[fail] ') + name)
  if (!ok) {
    failed += 1
    console.log('  expected:', JSON.stringify(expected))
    console.log('  actual  :', JSON.stringify(actual))
  }
}

// 1) 正常流：多段、带 [DONE]、带注释行与空行
{
  const seen = []
  const push = createSseParser((text) => seen.push(text))
  push(': keep-alive\n\n')
  push(deltaEvent('穿衣'))
  push(deltaEvent('要分层'))
  push('data: [DONE]\n\n')
  check('累积结果', push(''), '穿衣要分层')
  check('增量回调', seen, ['穿衣', '穿衣要分层'])
}

// 2) 任意切分：一行被拆到多个 chunk，甚至切开 JSON
{
  const seen = []
  const push = createSseParser((text) => seen.push(text))
  const line = deltaEvent('今天风大') + deltaEvent('带件外套')
  push(line.slice(0, 7))
  push(line.slice(7, 23))
  push(line.slice(23, 41))
  push(line.slice(41))
  check('跨 chunk 拼接', push(''), '今天风大带件外套')
  check('跨 chunk 回调次数', seen.length, 2)
}

// 3) 脏数据与半截行不应该让解析崩掉
{
  let text = ''
  const push = createSseParser((t) => {
    text = t
  })
  push('data: {不是合法JSON}\n\n')
  push('data:\n\n')
  push('event: ping\n\n')
  push(deltaEvent('兜底还在'))
  check('忽略非法行后仍能累积', text, '兜底还在')
  check('未闭合的行不产出内容', push('data: {"choices":[{"delta":{"content":"半'), '兜底还在')
}

// 4) 空 choices / 空 delta（模型偶尔会发 usage 帧）
{
  let calls = 0
  const push = createSseParser(() => {
    calls += 1
  })
  push(sse({ choices: [] }))
  push(sse({ choices: [{ delta: {} }] }))
  push(sse({ choices: [{ delta: { content: '' } }] }))
  check('无内容帧不触发回调', calls, 0)
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// 5) 节流写库：首包立即写、400ms 内合并、收尾必落终态、写失败可重试
async function writerTests() {
  const createWriter = askLLM.__createWriter
  if (typeof createWriter !== 'function') {
    console.error('[fail] __createWriter 未导出')
    failed += 1
    return
  }

  writes.length = 0
  const w = createWriter('doc-a')
  w.set('', 'streaming', true)
  await delay(10)
  check('起始帧落库', writes.length, 1)
  w.set('今天', 'streaming')
  await delay(10)
  check('首段文字立即落库', writes.map((x) => x.answer), ['', '今天'])
  w.set('今天风', 'streaming')
  w.set('今天风大', 'streaming')
  await delay(40)
  check('短间隔增量被合并', writes.length, 2)
  await w.finish('今天风大带外套', 'done')
  const last = writes[writes.length - 1]
  check('收尾写入全文与终态', [last.answer, last.status], ['今天风大带外套', 'done'])

  writes.length = 0
  const w2 = createWriter('doc-b')
  w2.set('', 'streaming', true)
  await delay(10)
  w2.set('字'.repeat(90), 'streaming')
  await delay(10)
  check('新增 90 字立即落库', writes.length, 2)

  const originalError = console.error
  console.error = () => {}
  writes.length = 0
  failWrites = 1
  const w3 = createWriter('doc-c')
  w3.set('', 'streaming', true)
  await delay(10)
  check('写库失败时不落库', writes.length, 0)
  await w3.finish('最终答案', 'done')
  console.error = originalError
  check('收尾重试后终态落库', writes[writes.length - 1].answer, '最终答案')
}

writerTests().then(() => {
  if (failed > 0) {
    console.error('\n' + failed + ' 项失败')
    process.exit(1)
  }
  console.log('\n全部通过')
})
