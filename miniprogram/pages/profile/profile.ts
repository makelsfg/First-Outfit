// 个人信息页：查看/编辑两种模式 + 风采库入口 + 反馈
import { getProfile, saveProfile } from '../../utils/storage'
import type { Profile } from '../../utils/storage'
import { countCheckinDays } from '../../utils/checkin'

const GENDERS = ['男', '女']

Page({
  data: {
    nickname: '',
    age: '',
    gender: '',
    genders: GENDERS,
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
    })
  },

  onShow() {
    this.setData({ checkinDays: countCheckinDays() })
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

  onSave() {
    const profile: Profile = {
      nickname: this.data.nickname.trim(),
      age: this.data.age.trim(),
      gender: this.data.gender,
    }
    saveProfile(profile)
    this.setData({ isEditing: false })
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
    // 第一阶段：本地提示，第二阶段提交到云数据库
    this.setData({ feedback: '' })
    wx.showToast({ title: '谢谢你的反馈', icon: 'success' })
  },
})
