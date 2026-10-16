// 首页：今日穿衣推荐 + 每日穿搭打卡
import { getWeather, getFallbackWeather } from '../../utils/weather'
import { recommendOutfit } from '../../utils/outfitRules'
import type { WeatherInfo, OutfitResult } from '../../utils/outfitRules'
import { hasCheckedToday, addCheckin, formatDate } from '../../utils/checkin'
import { getRandomEncouragement } from '../../utils/encouragement'

type Phase = 'idle' | 'toast' | 'encourage'

Page({
  data: {
    weather: null as WeatherInfo | null,
    outfit: null as OutfitResult | null,
    loading: true,
    dateText: '',
    checkedToday: false,
    phase: 'idle' as Phase,
    toastFading: false,
    encouragementText: '',
  },

  onLoad() {
    this.loadRecommendation()
  },

  onShow() {
    // 每次页面显示都重新检查打卡状态（删除今日记录后能恢复可打卡）
    const today = formatDate(new Date())
    this.setData({ checkedToday: hasCheckedToday(today) })
  },

  async loadRecommendation() {
    let weather: WeatherInfo
    try {
      weather = await getWeather()
    } catch (e) {
      weather = getFallbackWeather()
    }
    const outfit = recommendOutfit(weather)
    const now = new Date()
    const dateText = `${now.getMonth() + 1}月${now.getDate()}日 · ${weather.season}`
    this.setData({
      weather,
      outfit,
      dateText,
      loading: false,
    })
  },

  onCheckin() {
    if (this.data.checkedToday) {
      return
    }
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        this.saveImageAndCheckin(tempFilePath)
      },
    })
  },

  saveImageAndCheckin(tempFilePath: string) {
    const weather = this.data.weather
    const outfit = this.data.outfit
    if (!weather || !outfit) {
      wx.showToast({ title: '数据未就绪，请稍后重试', icon: 'none' })
      return
    }
    wx.saveFile({
      tempFilePath,
      success: (saveRes) => {
        const imagePath = saveRes.savedFilePath
        const today = formatDate(new Date())
        addCheckin({
          date: today,
          imagePath,
          weather,
          outfit,
          createTime: Date.now(),
        })
        this.setData({
          checkedToday: true,
          phase: 'toast',
          toastFading: false,
        })
        // 弹窗1 展示 1.5 秒后开始淡出（transition 0.4s）
        setTimeout(() => {
          this.setData({ toastFading: true })
        }, 1500)
        // 淡出结束后进入弹窗2
        setTimeout(() => {
          this.setData({
            phase: 'encourage',
            encouragementText: getRandomEncouragement(),
          })
        }, 1900)
      },
      fail: () => {
        wx.showToast({ title: '保存照片失败，请重试', icon: 'none' })
      },
    })
  },

  onConfirmEncourage() {
    this.setData({ phase: 'idle' })
  },
})
