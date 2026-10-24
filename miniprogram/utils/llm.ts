// 大模型问答服务：通过云函数调用（API Key 保存在云函数，前端不可见）
import { CLOUD_ENV, DEFAULT_SEARCH } from './config'
import type { WeatherInfo } from './outfitRules'

/** 传给大模型的用户画像（性别 + 年龄段文案） */
export interface ChatProfile {
  gender: string
  age: string
}

/**
 * 流式增量的中转集合：客户端先 add 一条文档（自带 _openid，默认权限下可自读），
 * 云函数 askLLM 边生成边 update 该文档，客户端 watch 到变化后刷新气泡。
 * 名称需与 cloudfunctions/askLLM/index.js 的 STREAM_COLLECTION 一致。
 */
export const STREAM_COLLECTION = 'llm_stream'

/** 整段生成的客户端兜底超时：超过视为失败，避免用户一直等 */
const WAIT_TIMEOUT = 45000

/** 流式回调 */
export interface StreamHandlers {
  /** 收到增量文本（参数是累积全文，不是本次新增片段） */
  onDelta?: (text: string) => void
  /** 首段文字到达（用于关掉「正在思考」占位） */
  onFirstText?: () => void
}

function profileData(profile?: ChatProfile | null) {
  return profile ? { gender: profile.gender, age: profile.age } : null
}

/**
 * 提问穿搭问题（一次性返回）
 * @param query 用户问题
 * @param weather 当前城市天气（用于让模型知道真实日期/地点/天气）
 * @param profile 用户画像（性别/年龄段，用于让回答更个性化）
 */
export async function askDress(
  query: string,
  weather?: WeatherInfo | null,
  profile?: ChatProfile | null
): Promise<string> {
  const res = await wx.cloud.callFunction({
    name: 'askLLM',
    data: {
      query,
      weather: weather || null,
      profile: profileData(profile),
    },
    config: { env: CLOUD_ENV },
  })
  const result = res.result as { answer?: string } | undefined
  if (!result || !result.answer) {
    throw new Error('大模型返回为空')
  }
  return result.answer
}

/** 从 watch 快照里取出唯一那条文档（运行时 docs 是数组，类型声明写成对象，这里兼容两者） */
function pickDoc(snapshot: any): any {
  if (!snapshot) return null
  const docs = snapshot.docs
  if (Array.isArray(docs)) return docs[0] || null
  if (docs && typeof docs === 'object') {
    const keys = Object.keys(docs)
    return keys.length ? docs[keys[0]] : null
  }
  return null
}

function withTimeout<T>(task: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('回答超时，请重试')), ms)
    task.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}

/**
 * 提问穿搭问题（流式）：边生成边通过 onDelta 抛出累积文本。
 *
 * 链路：add 临时文档 → doc.watch() → callFunction(带 streamId) → 云函数节流写库 → watch 推送。
 * 任一环节不可用（集合不存在、watch 失败、云函数未升级）都不会抛错给调用方，
 * 而是退化成「等完整回答再返回」，由 reply 正常落定。
 *
 * @returns 完整回答（以云函数返回值为准，比流式拼接更可靠）
 */
export async function askDressStream(
  query: string,
  weather?: WeatherInfo | null,
  profile?: ChatProfile | null,
  handlers?: StreamHandlers
): Promise<string> {
  const db = wx.cloud.database({ env: CLOUD_ENV })
  let docId = ''
  let watcher: DB.RealtimeListener | null = null
  let streamed = ''
  let firstText = false
  let closed = false

  const closeWatcher = () => {
    if (!watcher) return
    const w = watcher
    watcher = null
    w.close().catch(() => {})
  }
  const dropDoc = () => {
    if (!docId) return
    db.collection(STREAM_COLLECTION)
      .doc(docId)
      .remove()
      .catch(() => {})
  }

  // 1) 建临时文档并监听（失败则 docId 为空，后续走非流式）
  try {
    const added = await db
      .collection(STREAM_COLLECTION)
      .add({ data: { status: 'pending', answer: '', createdAt: Date.now() } })
    docId = String(added._id)

    watcher = db
      .collection(STREAM_COLLECTION)
      .doc(docId)
      .watch({
        onChange: (snapshot: DB.ISnapshot) => {
          if (closed) return
          const doc = pickDoc(snapshot)
          const text = doc && typeof doc.answer === 'string' ? doc.answer : ''
          if (!text || text === streamed) return
          streamed = text
          if (!firstText) {
            firstText = true
            if (handlers && handlers.onFirstText) handlers.onFirstText()
          }
          if (handlers && handlers.onDelta) handlers.onDelta(text)
        },
        onError: (err) => {
          // 监听断开不影响答案：callFunction 仍会返回完整内容
          console.warn('[llm] watch error', (err && err.errMsg) || err)
          closeWatcher()
        },
      })
  } catch (e) {
    console.warn('[llm] stream doc unavailable, fallback to one-shot', e)
    docId = ''
  }

  // 2) 调用云函数：它会把增量写进上面的文档，并在结束时返回完整答案
  try {
    const res = await withTimeout(
      wx.cloud.callFunction({
        name: 'askLLM',
        data: {
          query,
          weather: weather || null,
          profile: profileData(profile),
          streamId: docId,
        },
        config: { env: CLOUD_ENV },
      }),
      WAIT_TIMEOUT
    )
    const result = res.result as { answer?: string } | undefined
    const answer = result && result.answer ? result.answer : ''
    if (!answer) {
      throw new Error('大模型返回为空')
    }
    // 以云函数返回值为准，补上流式过程中可能漏掉的尾巴
    if (answer !== streamed && handlers && handlers.onDelta) {
      if (!firstText) {
        firstText = true
        if (handlers.onFirstText) handlers.onFirstText()
      }
      streamed = answer
      handlers.onDelta(answer)
    }
    return answer
  } finally {
    // 无论成功失败都断开监听并删掉临时文档（失败时调用方保留已流出的部分）
    closed = true
    closeWatcher()
    dropDoc()
  }
}

export function getDefaultSearch(): string {
  return DEFAULT_SEARCH
}
