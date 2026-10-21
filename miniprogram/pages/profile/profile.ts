// 个人信息页：查看/编辑两种模式 + 风采库入口 + 反馈
import { getProfile, saveProfile, consumeProfileEditRequest } from '../../utils/storage'
import type { Profile } from '../../utils/storage'
import { countCheckinDays } from '../../utils/checkin'
import { STYLE_OPTIONS } from '../../utils/outfitRules'
import { CLOUD_ENV } from '../../utils/config'

const GENDERS = ['男', '女']

function styleLabelOf(key: string): string {
  const found = STYLE_OPTIONS.find((s) => s.key === key)
  return found ? found.label : ''
}

Page({
  data: {
    nickname: '',
    age: '',
    gender: '',
    style: '',
    styleLabel: '',
    genders: GENDERS,
    styles: STYLE_OPTIONS,
    isEditing: false,
    checkinDays: 0,
    feedback: '',
  },

  onLoad() {
    const profile = getProfile()
    this.setData({
      nickname: profile.nickname,
      age: profile.age,
      gender: profile.gender,
      style: profile.style,
      styleLabel: styleLabelOf(profile.style),
    })
  },

  async onShow() {
    // 从首页「去填写」跳过来时，自动进入编辑态
    if (consumeProfileEditRequest()) {
      this.setData({ isEditing: true })
    }
    try {
      const days = await countCheckinDays()
      this.setData({ checkinDays: days })
    } catch (e) {
      this.setData({ checkinDays: 0 })
    }
  },

  onGoGallery() {
    wx.navigateTo({ url: '/pages/gallery/gallery' })
  },

  onHeaderBtnTap() {
    if (this.data.isEditing) {
      this.onSave()
    } else {
      this.setData({ isEditing: true })
    }
  },

  onNicknameInput(e: WechatMiniprogram.Input) {
    this.setData({ nickname: e.detail.value })
  },

  onAgeInput(e: WechatMiniprogram.Input) {
    this.setData({ age: e.detail.value })
  },

  onGenderTap(e: WechatMiniprogram.TouchEvent) {
    const value = e.currentTarget.dataset.value as string
    // 点一下选中，再点一下取消
    this.setData({ gender: this.data.gender === value ? '' : value })
  },

  onStyleTap(e: WechatMiniprogram.TouchEvent) {
    const value = e.currentTarget.dataset.value as string
    // 点一下选中，再点一下取消
    this.setData({ style: this.data.style === value ? '' : value })
  },

  onSave() {
    const profile: Profile = {
      nickname: this.data.nickname.trim(),
      age: this.data.age.trim(),
      gender: this.data.gender,
      style: this.data.style,
    }
    saveProfile(profile)
    this.setData({ isEditing: false, styleLabel: styleLabelOf(profile.style) })
    wx.showToast({ title: '已保存', icon: 'success', duration: 2000 })
  },

  onFeedbackInput(e: WechatMiniprogram.Input) {
    this.setData({ feedback: e.detail.value })
  },

  onSubmitFeedback() {
    const feedback = this.data.feedback.trim()
    if (!feedback) {
      wx.showToast({ title: '先写点想法吧', icon: 'none' })
      return
    }
    wx.showLoading({ title: '提交中…', mask: true })
    wx.cloud
      .callFunction({
        name: 'submitFeedback',
        data: { content: feedback },
        config: { env: CLOUD_ENV },
      })
      .then(() => {
        wx.hideLoading()
        this.setData({ feedback: '' })
        wx.showToast({ title: '谢谢你的反馈', icon: 'success' })
      })
      .catch((e) => {
        console.error('[feedback] 提交失败：', e)
        wx.hideLoading()
        wx.showToast({ title: '提交失败，请重试', icon: 'none' })
      })
  },
})
