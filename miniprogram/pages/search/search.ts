// 搜索页：大模型问答 + 历史记录
import { askDress, getDefaultSearch } from '../../utils/llm'
import { getWeather, getFallbackWeather } from '../../utils/weather'
import type { WeatherInfo } from '../../utils/outfitRules'
import {
  getSearchHistory,
  addSearchHistory,
  clearSearchHistory,
} from '../../utils/storage'
import type { SearchHistoryItem } from '../../utils/storage'

function formatTime(date: Date): string {
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
  return `${date.getMonth() + 1}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

Page({
  data: {
    query: '',
    answer: '',
    loading: false,
    hasSearched: false,
    history: [] as SearchHistoryItem[],
    expandedIndex: -1,
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
    this.setData({ loading: true, answer: '' })
    try {
      // 先获取当前城市与天气，作为上下文传给大模型，避免它瞎猜季节和城市
      let weather: WeatherInfo
      try {
        weather = await getWeather()
      } catch {
        weather = getFallbackWeather()
      }
      const answer = await askDress(query, weather)
      this.finishSearch(query, answer)
    } catch (e) {
      console.error('[search] 大模型调用失败：', e)
      const err = e as { errMsg?: string; message?: string }
      const detail = (err && (err.errMsg || err.message)) || ''
      this.finishSearch(
        query,
        '抱歉，暂时没能回答你，请检查网络后重试。' + (detail ? `（${detail}）` : '')
      )
    }
  },

  finishSearch(query: string, answer: string) {
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
