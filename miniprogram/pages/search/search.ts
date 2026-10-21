// 搜索页：大模型问答（结合天气与用户画像） + 历史记录
import { askDress, getDefaultSearch } from '../../utils/llm'
import { getWeather, getFallbackWeather } from '../../utils/weather'
import { STYLE_OPTIONS } from '../../utils/outfitRules'
import type { WeatherInfo, UserProfile } from '../../utils/outfitRules'
import {
  getProfile,
  getSearchHistory,
  addSearchHistory,
  clearSearchHistory,
  getCity,
} from '../../utils/storage'
import type { SearchHistoryItem } from '../../utils/storage'

function formatTime(date: Date): string {
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
  return `${date.getMonth() + 1}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function styleLabelOf(key: string): string {
  const found = STYLE_OPTIONS.find((s) => s.key === key)
  return found ? found.label : ''
}

Page({
  data: {
    query: '',
    answer: '',
    loading: false,
    hasSearched: false,
    history: [] as SearchHistoryItem[],
    expandedIndex: -1,
    contextHint: '',
  },

  onLoad() {
    this.setData({
      query: getDefaultSearch(),
      history: getSearchHistory(),
    })
  },

  onInput(e: WechatMiniprogram.Input) {
    this.setData({ query: e.detail.value })
  },

  async onSearch() {
    const query = this.data.query.trim()
    if (!query) {
      wx.showToast({ title: '先输入想问的问题吧', icon: 'none' })
      return
    }
    this.setData({ loading: true, answer: '', contextHint: '' })
    try {
      // 先获取当前城市与天气，作为上下文传给大模型，避免它瞎猜季节和城市
      let weather: WeatherInfo
      try {
        weather = await getWeather({ city: getCity() })
      } catch {
        weather = getFallbackWeather()
      }
      // 用户画像（性别/年龄/风格）一并传给大模型，让回答更个性化
      const profile = getProfile()
      const answer = await askDress(query, weather, profile)
      this.finishSearch(query, answer, weather, profile)
    } catch (e) {
      console.error('[search] 大模型调用失败：', e)
      const err = e as { errMsg?: string; message?: string }
      const detail = (err && (err.errMsg || err.message)) || ''
      this.finishSearch(
        query,
        '抱歉，暂时没能回答你，请检查网络后重试。' + (detail ? `（${detail}）` : ''),
        null,
        null
      )
    }
  },

  finishSearch(
    query: string,
    answer: string,
    weather: WeatherInfo | null,
    profile: UserProfile | null
  ) {
    const hintParts: string[] = []
    if (weather && weather.city) {
      hintParts.push(`${weather.city}实时天气`)
    }
    const styleLabel = profile ? styleLabelOf(profile.style) : ''
    if (styleLabel) {
      hintParts.push(`${styleLabel}偏好`)
    }
    const contextHint = hintParts.length > 0 ? `已结合 ${hintParts.join(' · ')}` : ''

    const history = addSearchHistory({
      question: query,
      answer,
      time: formatTime(new Date()),
    })
    this.setData({
      answer,
      loading: false,
      hasSearched: true,
      history,
      expandedIndex: -1,
      contextHint,
    })
  },

  onToggleHistory(e: WechatMiniprogram.TouchEvent) {
    const index = Number(e.currentTarget.dataset.index)
    this.setData({
      expandedIndex: this.data.expandedIndex === index ? -1 : index,
    })
  },

  onClearHistory() {
    clearSearchHistory()
    this.setData({ history: [], expandedIndex: -1 })
  },
})