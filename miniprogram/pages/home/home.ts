// 首页：今日穿衣推荐 + 每日穿搭打卡（云开发版）
import { getWeather, getFallbackWeather } from '../../utils/weather'
import { recommendOutfit } from '../../utils/outfitRules'
import type { WeatherInfo, OutfitResult } from '../../utils/outfitRules'
import { hasCheckedToday, addCheckin, formatDate } from '../../utils/checkin'
import { getRandomEncouragement } from '../../utils/encouragement'
import { CLOUD_ENV } from '../../utils/config'

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

  async onShow() {
    // 每次页面显示都重新检查打卡状态（删除今日记录后能恢复可打卡）
    const today = formatDate(new Date())
    try {
      const checked = await hasCheckedToday(today)
      this.setData({ checkedToday: checked })
    } catch {
      this.setData({ checkedToday: false })
    }
  },

  async loadRecommendation() {
    let weather: WeatherInfo
    try {
      weather = await getWeather()
    } catch {
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

  async saveImageAndCheckin(tempFilePath: string) {
    const weather = this.data.weather
    const outfit = this.data.outfit
    if (!weather || !outfit) {
      wx.showToast({ title: '数据未就绪，请稍后重试', icon: 'none' })
      return
    }
    const today = formatDate(new Date())
    wx.showLoading({ title: '上传中…', mask: true })
    try {
      // 1. 上传照片到云存储
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `checkin/${today}_${Date.now()}.jpg`,
        filePath: tempFilePath,
        config: { env: CLOUD_ENV },
      })
      // 2. 写入打卡记录到云数据库
      await addCheckin({
        date: today,
        imageFileID: uploadRes.fileID,
        weather,
        outfit,
        createTime: Date.now(),
      })
      // 3. 预取鼓励语
      const encouragement = await getRandomEncouragement()
      wx.hideLoading()
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
          encouragementText: encouragement,
        })
      }, 1900)
    } catch (e) {
      console.error('[checkin] 打卡失败：', e)
      wx.hideLoading()
      wx.showToast({ title: '打卡失败，请重试', icon: 'none' })
    }
  },

  onConfirmEncourage() {
    this.setData({ phase: 'idle' })
  },
})
