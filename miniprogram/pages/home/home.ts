// 首页：个性化穿衣推荐（天气 + 性别/年龄/风格） + AI 模特试穿图（点击生成） + 每日穿搭打卡
import { getWeather, getFallbackWeather, requestLocation } from '../../utils/weather'
import type { Coords } from '../../utils/weather'
import { recommendOutfit } from '../../utils/outfitRules'
import type { WeatherInfo, OutfitResult } from '../../utils/outfitRules'
import {
  getProfile,
  getCity,
  saveCity,
  clearCity,
  isProfileEmpty,
  isProfileGuideDismissed,
  dismissProfileGuide,
  requestProfileEdit,
} from '../../utils/storage'
import type { Profile } from '../../utils/storage'
import { PROVINCES } from '../../utils/cities'
import type { City, Province } from '../../utils/cities'
import { getOutfitImage } from '../../utils/outfitImage'
import { hasCheckedToday, addCheckin, formatDate } from '../../utils/checkin'
import { getRandomEncouragement } from '../../utils/encouragement'
import { CLOUD_ENV } from '../../utils/config'

type Phase = 'idle' | 'toast' | 'encourage'
type TryonStatus = 'idle' | 'loading' | 'ready' | 'failed'
type SheetLevel = 'province' | 'city'

const EMPTY_PROFILE: Profile = { nickname: '', age: '', gender: '', style: '' }

Page({
  data: {
    weather: null as WeatherInfo | null,
    outfit: null as OutfitResult | null,
    loading: true,
    dateText: '',
    tempRangeText: '',
    checkedToday: false,
    phase: 'idle' as Phase,
    toastFading: false,
    encouragementText: '',
    profile: EMPTY_PROFILE,
    // 城市
    city: null as City | null,
    provinces: PROVINCES,
    citySheetVisible: false,
    sheetLevel: 'province' as SheetLevel,
    activeProvince: null as Province | null,
    // 模特试穿：默认收起，点击按钮才生成
    tryonExpanded: false,
    tryonStatus: 'idle' as TryonStatus,
    imageUrl: '',
    // 未填资料时的引导弹窗
    showProfileGuide: false,
  },

  onLoad() {
    this.init()
  },

  async init() {
    const profile = getProfile()
    this.setData({ profile })

    // 已经手动选过城市：直接用，不再定位
    const saved = getCity()
    if (saved) {
      await this.loadWeather(saved, null)
      this.maybeShowProfileGuide(profile)
      return
    }

    // 首次进入：自动定位一次
    const coords = await requestLocation()
    await this.loadWeather(null, coords)
    if (!coords) {
      // 定位失败（多半是没给权限）：先弹定位引导，避免与资料引导同时弹
      this.promptNoLocation()
    } else {
      this.maybeShowProfileGuide(profile)
    }
  },

  /** 未填基本信息且没弹过 → 引导填写（带跳过） */
  maybeShowProfileGuide(profile: Profile) {
    if (isProfileEmpty(profile) && !isProfileGuideDismissed()) {
      this.setData({ showProfileGuide: true })
    }
  },

  onGoProfile() {
    dismissProfileGuide()
    requestProfileEdit()
    this.setData({ showProfileGuide: false })
    // 「我的」是 tabBar 页，必须用 switchTab
    wx.switchTab({ url: '/pages/profile/profile' })
  },

  onSkipGuide() {
    dismissProfileGuide()
    this.setData({ showProfileGuide: false })
  },

  async onShow() {
    // 每次页面显示都重新检查打卡状态（删除今日记录后能恢复可打卡）
    this.checkCheckin()
    // 画像变化时（例如刚在「我的」改了性别/风格）只需重算穿搭，无需重新取天气
    const profile = getProfile()
    if (JSON.stringify(profile) !== JSON.stringify(this.data.profile)) {
      this.setData({ profile })
      const weather = this.data.weather
      if (weather) {
        this.computeOutfit(profile, weather)
      }
    }
  },

  async checkCheckin() {
    const today = formatDate(new Date())
    try {
      const checked = await hasCheckedToday(today)
      this.setData({ checkedToday: checked })
    } catch {
      this.setData({ checkedToday: false })
    }
  },

  /** 取天气 → 算穿搭。city 优先，其次 coords，都没有则用默认城市 */
  async loadWeather(city: City | null, coords: Coords | null) {
    this.setData({ city, loading: true })
    let weather: WeatherInfo
    try {
      weather = await getWeather({ city, coords })
    } catch (e) {
      console.error('[weather] 获取失败，已使用兜底数据：', e)
      weather = getFallbackWeather(city ? city.name : undefined)
    }
    this.setData({ weather })
    this.computeOutfit(this.data.profile, weather)
  },

  computeOutfit(profile: Profile, weather: WeatherInfo) {
    const outfit = recommendOutfit(weather, profile)
    const now = new Date()
    const dateText = `${now.getMonth() + 1}月${now.getDate()}日 · ${weather.season}`
    const tempRangeText =
      weather.tempMax != null && weather.tempMin != null
        ? `最高 ${weather.tempMax}° / 最低 ${weather.tempMin}°`
        : ''
    // 推荐变化时重置试穿（旧的试穿图对应的是旧穿搭，不再复用）
    this.setData({
      outfit,
      dateText,
      tempRangeText,
      loading: false,
      tryonExpanded: false,
      tryonStatus: 'idle',
      imageUrl: '',
    })
  },

  promptNoLocation() {
    wx.showModal({
      title: '没有定位权限',
      content: '无法获取你的位置。你可以手动选择城市，照样能看到当地天气和穿搭。',
      confirmText: '手动选择',
      cancelText: '暂不',
      success: (res) => {
        if (res.confirm) {
          this.onOpenCitySheet()
        }
      },
    })
  },

  // ---------------- 城市选择（省份 → 城市） ----------------

  onOpenCitySheet() {
    this.setData({ citySheetVisible: true, sheetLevel: 'province', activeProvince: null })
  },

  onCloseCitySheet() {
    this.setData({ citySheetVisible: false })
  },

  // 阻止点透到遮罩，避免点卡片内容时误关闭
  onStopTap() {},

  onPickProvince(e: WechatMiniprogram.TouchEvent) {
    const index = Number(e.currentTarget.dataset.index)
    const province = PROVINCES[index]
    if (!province) {
      return
    }
    this.setData({ sheetLevel: 'city', activeProvince: province })
  },

  onBackToProvinces() {
    this.setData({ sheetLevel: 'province', activeProvince: null })
  },

  onSelectCity(e: WechatMiniprogram.TouchEvent) {
    const adcode = String(e.currentTarget.dataset.adcode)
    const name = String(e.currentTarget.dataset.name)
    const city: City = { name, adcode }
    saveCity(city)
    this.setData({ citySheetVisible: false })
    // 选完立即重新查天气
    this.loadWeather(city, null)
  },

  /** 切回自动定位 */
  async onUseAutoLocation() {
    clearCity()
    this.setData({ citySheetVisible: false })
    const coords = await requestLocation()
    await this.loadWeather(null, coords)
    if (!coords) {
      this.promptNoLocation()
    }
  },

  // ---------------- 模特试穿 ----------------

  /** 点按钮：收起 ↔ 展开；首次展开时触发生成 */
  onToggleTryon() {
    if (this.data.tryonExpanded) {
      this.setData({ tryonExpanded: false })
      return
    }
    if (this.data.imageUrl || this.data.tryonStatus === 'loading') {
      // 已生成过、或正在生成中，直接展开，不重复生成
      this.setData({ tryonExpanded: true })
      return
    }
    this.setData({ tryonExpanded: true })
    this.generateTryon(false)
  },

  /** 换一张：跳过缓存重新生成 */
  onRegenerate() {
    this.generateTryon(true)
  },

  /** 生成失败后重试 */
  onRetryTryon() {
    this.generateTryon(false)
  },

  async generateTryon(force: boolean) {
    const { profile, weather, outfit } = this.data
    if (!weather || !outfit) {
      wx.showToast({ title: '数据未就绪，请稍后重试', icon: 'none' })
      return
    }
    this.setData({ tryonStatus: 'loading', imageUrl: '' })
    try {
      const { url } = await getOutfitImage(profile, weather, outfit, force)
      this.setData({ tryonStatus: 'ready', imageUrl: url })
    } catch (e) {
      console.error('[outfitImage] 生成失败：', e)
      this.setData({ tryonStatus: 'failed' })
    }
  },

  // ---------------- 打卡 ----------------

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