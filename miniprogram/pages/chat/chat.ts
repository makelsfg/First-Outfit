// 对话页：悬浮客服点进来的聊天界面，可以问穿搭知识（走 askLLM 云函数，流式输出）
import { askDressStream } from '../../utils/llm'
import { getWeather, getFallbackWeather } from '../../utils/weather'
import {
  getProfile,
  getCity,
  getChatHistory,
  saveChatHistory,
  clearChatHistory,
} from '../../utils/storage'
import { AGE_BANDS, applyTheme } from '../../utils/preferences'
import type { WeatherInfo } from '../../utils/outfitRules'

interface ChatMessage {
  role: 'user' | 'ai'
  text: string
  /** 该条消息仍在生成中（显示光标） */
  streaming?: boolean
  /** 这条回答属于一轮问答，可以收起 */
  canFold?: boolean
  /** 已收起（只显示一行摘要） */
  folded?: boolean
  /** 被上一轮收起时隐藏（问句跟着回答一起折起来） */
  hidden?: boolean
  /** 收起后摘要里显示的原始提问 */
  quote?: string
}

const QUICK_QUESTIONS = ['这个季节穿什么', '面试怎么穿得体', '腿粗怎么选裤子']

const GREETING =
  '你好，我是你的穿搭小助手。有什么想问的都可以问我，比如「这个季节穿什么」「面试怎么穿」。'

/** 文本刷新合并间隔：流式推送 400ms 一次，这里再做 100ms 合并，避免高频 setData */
const FLUSH_MS = 100
/** 自动追底的最小间隔，防止每来一段就滚动导致抖动 */
const SCROLL_MS = 300
/** 降级成整段返回时的打字机节奏（每帧字数 / 帧间隔） */
const TYPE_STEP = 2
const TYPE_MS = 18

// 页面级瞬态状态。放在模块作用域而不是 data，避免为了定时器触发 setData。
let pendingText = ''
let flushTimer: ReturnType<typeof setTimeout> | null = null
let typeTimer: ReturnType<typeof setTimeout> | null = null
let lastFlushAt = 0
let lastScrollAt = 0
let scrollTick = 0
let pageAlive = true
/** 本轮是否真的收到过流式增量（决定要不要降级成打字机） */
let gotDelta = false

function clearFlushTimer() {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
}

function clearTypeTimer() {
  if (typeTimer) {
    clearTimeout(typeTimer)
    typeTimer = null
  }
}

function ageLabel(key: string): string {
  const found = AGE_BANDS.find((b) => b.key === key)
  return found ? found.label : ''
}

/** 把消息写进本地缓存（去掉流式标记；空白的占位回答不存） */
function persist(messages: ChatMessage[]) {
  const last = messages.length - 1
  const list = messages
    .filter((m, i) => !(i === last && m.role === 'ai' && !m.text))
    .map((m) => ({
      role: m.role,
      text: m.text,
      canFold: m.canFold,
      folded: m.folded,
      hidden: m.hidden,
      quote: m.quote,
    }))
  saveChatHistory(list)
}

/** 从本地缓存还原消息（流式状态一律清空，首条不能是孤立回答） */
function restoreMessages(): ChatMessage[] {
  const history = getChatHistory()
  if (!history.length) {
    return [{ role: 'ai', text: GREETING }]
  }
  return history.map((m, i) => ({
    role: m.role,
    text: m.text,
    canFold: !!m.canFold && i > 0,
    folded: !!m.folded,
    hidden: !!m.hidden,
    quote: m.quote,
  }))
}

Page({
  data: {
    messages: [] as ChatMessage[],
    input: '',
    loading: false,
    quick: QUICK_QUESTIONS,
    scrollInto: '',
    theme: 'orange',
  },

  onLoad() {
    pageAlive = true
    pendingText = ''
    lastFlushAt = 0
    lastScrollAt = 0
    const p = getProfile()
    this.setData(
      {
        theme: p.theme,
        messages: restoreMessages(),
      },
      // 有历史记录时直接落到最新一条，而不是停在最上面
      () => this.scrollToBottom(true)
    )
    applyTheme(p.theme)
  },

  onShow() {
    applyTheme(this.data.theme)
  },

  onHide() {
    // 切后台 / 跳走时也存一次，避免进程被回收后丢记录
    persist(this.data.messages)
  },

  onUnload() {
    persist(this.data.messages)
    pageAlive = false
    clearFlushTimer()
    clearTypeTimer()
  },

  onInput(e: WechatMiniprogram.Input) {
    this.setData({ input: e.detail.value })
  },

  onQuickAsk(e: WechatMiniprogram.TouchEvent) {
    const q = String(e.currentTarget.dataset.q)
    this.setData({ input: q })
    this.send()
  },

  onSend() {
    this.send()
  },

  /** 清空对话：内存与本地缓存一起清掉，回到只剩问候语的状态 */
  onClearChat() {
    if (this.data.loading) {
      wx.showToast({ title: '等这条回答说完再清空', icon: 'none' })
      return
    }
    wx.showModal({
      title: '清空对话',
      content: '清空后不可恢复，确定吗？',
      confirmText: '清空',
      confirmColor: '#EF4444',
      success: (res) => {
        if (!res.confirm) {
          return
        }
        clearChatHistory()
        clearFlushTimer()
        clearTypeTimer()
        pendingText = ''
        gotDelta = false
        this.setData({ messages: [{ role: 'ai', text: GREETING }], loading: false })
        wx.showToast({ title: '已清空', icon: 'success' })
      },
    })
  },

  /** 滚动到底部：交替锚点使同样的目标值也能重复触发 */
  scrollToBottom(force?: boolean) {
    if (!pageAlive) return
    const now = Date.now()
    if (!force && now - lastScrollAt < SCROLL_MS) return
    lastScrollAt = now
    scrollTick += 1
    this.setData({ scrollInto: scrollTick % 2 === 0 ? 'chat-bottom' : 'chat-bottom-alt' })
  },

  /** 把 pendingText 刷到最后一条 AI 消息上（final=true 表示收尾，去掉光标） */
  flushStream(final: boolean) {
    const idx = this.data.messages.length - 1
    if (!pageAlive || idx < 0) return
    lastFlushAt = Date.now()
    this.setData({
      [`messages[${idx}].text`]: pendingText,
      [`messages[${idx}].streaming`]: !final,
    } as any)
    if (!final) {
      this.scrollToBottom()
      return
    }
    // 一轮结束才落盘，避免把半截回答或空占位写进历史
    persist(this.data.messages)
  },

  /** 收到增量：合并后刷新 */
  queueStream(text: string) {
    pendingText = text
    const now = Date.now()
    if (now - lastFlushAt >= FLUSH_MS) {
      this.flushStream(false)
      return
    }
    if (!flushTimer) {
      flushTimer = setTimeout(() => {
        flushTimer = null
        this.flushStream(false)
      }, FLUSH_MS)
    }
  },

  /** 收起 / 展开一轮问答：问句与回答一起折叠成一行摘要 */
  onToggleFold(e: WechatMiniprogram.TouchEvent) {
    const idx = Number(e.currentTarget.dataset.index)
    const msg = this.data.messages[idx]
    if (!msg || msg.role !== 'ai' || msg.streaming) {
      return
    }
    const folded = !msg.folded
    if (folded) {
      // 收起时丢掉还没刷完的增量，避免定时器晚一步把光标又画回来
      clearFlushTimer()
    }
    const prev = this.data.messages[idx - 1]
    const hasPrev = !!prev && prev.role === 'user'
    const patch: Record<string, any> = {
      [`messages[${idx}].folded`]: folded,
      [`messages[${idx}].streaming`]: false,
    }
    if (hasPrev) {
      patch[`messages[${idx - 1}].hidden`] = folded
      if (folded) {
        patch[`messages[${idx}].quote`] = prev.text
      }
    }
    this.setData(patch, () => {
      // 折叠后高度变化很大，重新定位到这一行，避免视图跳到别处
      this.setData({ scrollInto: `msg-${idx}` })
      persist(this.data.messages)
    })
  },

  /** 没收到任何流式增量时（链路降级），把整段回答逐字敲出来 */
  typewriter(full: string, onDone: () => void) {
    let cursor = 0
    const step = () => {
      if (!pageAlive) {
        onDone()
        return
      }
      cursor = Math.min(full.length, cursor + TYPE_STEP)
      pendingText = full.slice(0, cursor)
      const idx = this.data.messages.length - 1
      this.setData({
        [`messages[${idx}].text`]: pendingText,
        [`messages[${idx}].streaming`]: cursor < full.length,
      } as any)
      this.scrollToBottom()
      if (cursor < full.length) {
        typeTimer = setTimeout(step, TYPE_MS)
      } else {
        typeTimer = null
        onDone()
      }
    }
    step()
  },

  async send() {
    const query = this.data.input.trim()
    if (!query || this.data.loading) {
      return
    }

    clearFlushTimer()
    clearTypeTimer()
    pendingText = ''
    gotDelta = false

    // 先把用户消息和一条空的 AI 气泡放上去，用户立刻有反馈
    const messages = this.data.messages.concat([
      { role: 'user', text: query },
      { role: 'ai', text: '', streaming: true, canFold: true },
    ] as ChatMessage[])
    this.setData({ messages, input: '', loading: true }, () => this.scrollToBottom(true))

    try {
      // 带上天气与用户画像，让回答更贴合
      let weather: WeatherInfo
      try {
        weather = await getWeather({ city: getCity() })
      } catch {
        weather = getFallbackWeather()
      }
      const p = getProfile()
      const answer = await askDressStream(
        query,
        weather,
        { gender: p.gender, age: ageLabel(p.ageBand) },
        {
          onDelta: (text) => {
            gotDelta = true
            this.queueStream(text)
          },
        }
      )

      // 以完整答案收尾（流式可能只推到最后一次落库之前）
      clearFlushTimer()
      pendingText = answer
      if (!pageAlive) {
        return
      }
      if (!answer) {
        throw new Error('大模型返回为空')
      }
      if (!gotDelta) {
        // 流式没生效（集合/权限/基础库问题）→ 降级：整段结果逐字显示
        this.typewriter(answer, () => {
          if (pageAlive) this.setData({ loading: false })
          persist(this.data.messages)
        })
      } else {
        this.flushStream(true)
        this.setData({ loading: false })
      }
      this.scrollToBottom(true)
    } catch (e) {
      console.error('[chat] 问答失败：', e)
      clearFlushTimer()
      clearTypeTimer()
      if (!pageAlive) {
        return
      }
      const partial = pendingText
      pendingText = partial
        ? `${partial}\n\n（回答中断了，可以再问一次试试）`
        : '抱歉，暂时没能回答你，请稍后重试。'
      this.flushStream(true)
      this.setData({ loading: false })
      this.scrollToBottom(true)
    }
  },
})
