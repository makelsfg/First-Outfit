// 设置页：个人资料 + 偏好（怕冷/出行/防雨防滑/默认场合/主题色） + 鼓励语
import { getProfile, saveProfile } from '../../utils/storage'
import type { Profile } from '../../utils/storage'
import {
  AGE_BANDS,
  GENDER_OPTIONS,
  COLD_OPTIONS,
  TRAVEL_OPTIONS,
  RAIN_OPTIONS,
  THEME_OPTIONS,
  applyTheme,
  themeOfGender,
} from '../../utils/preferences'
import { SCENE_OPTIONS } from '../../utils/outfitRules'

Page({
  data: {
    nickname: '',
    gender: '',
    ageBand: '',
    scene: 'daily',
    cold: 'normal',
    travel: 'walk',
    rain: 'auto',
    theme: 'orange',
    genders: GENDER_OPTIONS,
    ageBands: AGE_BANDS,
    scenes: SCENE_OPTIONS,
    colds: COLD_OPTIONS,
    travels: TRAVEL_OPTIONS,
    rains: RAIN_OPTIONS,
    themes: THEME_OPTIONS,
  },

  onLoad() {
    const p = getProfile()
    this.setData({
      nickname: p.nickname,
      gender: p.gender,
      ageBand: p.ageBand,
      scene: p.scene,
      cold: p.cold,
      travel: p.travel,
      rain: p.rain,
      theme: p.theme,
    })
  },

  onShow() {
    applyTheme(this.data.theme)
  },

  onNicknameInput(e: WechatMiniprogram.Input) {
    this.setData({ nickname: e.detail.value })
  },

  onGenderTap(e: WechatMiniprogram.TouchEvent) {
    const value = String(e.currentTarget.dataset.value)
    const theme = themeOfGender(value)
    this.setData({ gender: value, theme })
    applyTheme(theme)
  },

  onAgeBandTap(e: WechatMiniprogram.TouchEvent) {
    this.setData({ ageBand: String(e.currentTarget.dataset.value) })
  },

  onSceneTap(e: WechatMiniprogram.TouchEvent) {
    this.setData({ scene: String(e.currentTarget.dataset.value) })
  },

  onColdTap(e: WechatMiniprogram.TouchEvent) {
    this.setData({ cold: String(e.currentTarget.dataset.value) })
  },

  onTravelTap(e: WechatMiniprogram.TouchEvent) {
    this.setData({ travel: String(e.currentTarget.dataset.value) })
  },

  onRainTap(e: WechatMiniprogram.TouchEvent) {
    this.setData({ rain: String(e.currentTarget.dataset.value) })
  },

  onThemeTap(e: WechatMiniprogram.TouchEvent) {
    const theme = String(e.currentTarget.dataset.value)
    this.setData({ theme })
    applyTheme(theme)
  },

  onSave() {
    const profile: Profile = {
      nickname: this.data.nickname.trim(),
      gender: this.data.gender,
      ageBand: this.data.ageBand,
      scene: this.data.scene,
      cold: this.data.cold,
      travel: this.data.travel,
      rain: this.data.rain,
      theme: this.data.theme,
    }
    saveProfile(profile)
    wx.showToast({ title: '已保存', icon: 'success', duration: 1500 })
  },
})