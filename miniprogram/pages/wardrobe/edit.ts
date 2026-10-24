// 衣物录入 / 编辑页：照片 + 名称 / 分类 / 季节 / 颜色 / 材质 / 标签 / 备注
import {
  WARDROBE_CATEGORIES,
  SEASON_OPTIONS,
  COLOR_OPTIONS,
  MATERIAL_OPTIONS,
  TAG_OPTIONS,
  uploadPhoto,
  deletePhoto,
  addWardrobeItem,
  getWardrobeItem,
  updateWardrobeItem,
  toTempUrls,
} from '../../utils/wardrobe'
import type { LabelOption } from '../../utils/wardrobe'
import { getProfile } from '../../utils/storage'
import { applyTheme } from '../../utils/preferences'
import { safeBack } from '../../utils/nav'

interface ChipOption {
  key: string
  label: string
  active: boolean
}

/** 保存成功后延时返回的定时器（用户提前返回时要清掉，否则会对已销毁的页面调 navigateBack） */
let backTimer: ReturnType<typeof setTimeout> | null = null

function clearBackTimer() {
  if (backTimer) {
    clearTimeout(backTimer)
    backTimer = null
  }
}

function toChips(options: LabelOption[]): ChipOption[] {
  return options.map((o) => ({ key: o.key, label: o.label, active: false }))
}

/** 按已选 key 设置选中态 */
function applyActive(options: LabelOption[], keys: string[]): ChipOption[] {
  return options.map((o) => ({ key: o.key, label: o.label, active: keys.indexOf(o.key) >= 0 }))
}

/** 切换某个选项的选中态（WXML 不支持方法调用，所以状态挂在选项上） */
function toggleChip(list: ChipOption[], key: string): ChipOption[] {
  return list.map((o) => (o.key === key ? { key: o.key, label: o.label, active: !o.active } : o))
}

function activeKeys(list: ChipOption[]): string[] {
  return list.filter((o) => o.active).map((o) => o.key)
}

function defaultName(category: string): string {
  const found = WARDROBE_CATEGORIES.find((c) => c.key === category)
  return `我的${found ? found.label : '衣服'}`
}

Page({
  data: {
    theme: 'orange',
    editId: '',
    photoPreview: '',   // 展示用的图片地址
    newPhotoPath: '',   // 新选的本地临时路径（未换图则为空）
    existingFileID: '', // 编辑时原有的云文件
    name: '',
    category: '',
    note: '',
    categories: WARDROBE_CATEGORIES,
    seasonOptions: toChips(SEASON_OPTIONS),
    colorOptions: toChips(COLOR_OPTIONS),
    materialOptions: toChips(MATERIAL_OPTIONS),
    tagOptions: toChips(TAG_OPTIONS),
  },

  onLoad(options: { id?: string }) {
    const p = getProfile()
    this.setData({ theme: p.theme })
    applyTheme(p.theme)

    const id = options && options.id ? options.id : ''
    if (id) {
      this.setData({ editId: id })
      wx.setNavigationBarTitle({ title: '编辑衣物' })
      this.loadItem(id)
    } else {
      wx.setNavigationBarTitle({ title: '录入衣物' })
    }
  },

  onUnload() {
    clearBackTimer()
  },

  async loadItem(id: string) {
    try {
      const item = await getWardrobeItem(id)
      if (!item) {
        return
      }
      const urlMap = await toTempUrls([item.imageFileID])
      this.setData({
        photoPreview: urlMap[item.imageFileID] || '',
        existingFileID: item.imageFileID || '',
        name: item.name || '',
        category: item.category || '',
        note: item.note || '',
        seasonOptions: applyActive(SEASON_OPTIONS, item.seasons || []),
        colorOptions: applyActive(COLOR_OPTIONS, item.colors || []),
        materialOptions: applyActive(MATERIAL_OPTIONS, item.materials || []),
        tagOptions: applyActive(TAG_OPTIONS, item.tags || []),
      })
    } catch (e) {
      console.error('[wardrobe] 读取衣物失败：', e)
      wx.showToast({ title: '读取失败，请重试', icon: 'none' })
    }
  },

  onChoosePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const path = res.tempFiles[0].tempFilePath
        this.setData({ newPhotoPath: path, photoPreview: path })
      },
    })
  },

  onNameInput(e: WechatMiniprogram.Input) {
    this.setData({ name: e.detail.value })
  },

  onNoteInput(e: WechatMiniprogram.Input) {
    this.setData({ note: e.detail.value })
  },

  onPickCategory(e: WechatMiniprogram.TouchEvent) {
    const value = String(e.currentTarget.dataset.value)
    this.setData({ category: this.data.category === value ? '' : value })
  },

  onToggleSeason(e: WechatMiniprogram.TouchEvent) {
    this.setData({ seasonOptions: toggleChip(this.data.seasonOptions, String(e.currentTarget.dataset.value)) })
  },

  onToggleColor(e: WechatMiniprogram.TouchEvent) {
    this.setData({ colorOptions: toggleChip(this.data.colorOptions, String(e.currentTarget.dataset.value)) })
  },

  onToggleMaterial(e: WechatMiniprogram.TouchEvent) {
    this.setData({ materialOptions: toggleChip(this.data.materialOptions, String(e.currentTarget.dataset.value)) })
  },

  onToggleTag(e: WechatMiniprogram.TouchEvent) {
    this.setData({ tagOptions: toggleChip(this.data.tagOptions, String(e.currentTarget.dataset.value)) })
  },

  async onSave() {
    const { category, editId, newPhotoPath, existingFileID } = this.data
    if (!category) {
      wx.showToast({ title: '选一下分类', icon: 'none' })
      return
    }
    if (!newPhotoPath && !existingFileID) {
      wx.showToast({ title: '先拍一张衣服照片吧', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中…', mask: true })
    try {
      // 换了图才重新上传，并删掉旧图
      let fileID = existingFileID
      if (newPhotoPath) {
        fileID = await uploadPhoto(newPhotoPath)
        if (existingFileID && existingFileID !== fileID) {
          await deletePhoto(existingFileID)
        }
      }

      const data = {
        category,
        imageFileID: fileID,
        name: this.data.name.trim() || defaultName(category),
        seasons: activeKeys(this.data.seasonOptions),
        colors: activeKeys(this.data.colorOptions),
        materials: activeKeys(this.data.materialOptions),
        tags: activeKeys(this.data.tagOptions),
        note: this.data.note.trim(),
      }

      if (editId) {
        await updateWardrobeItem(editId, data)
      } else {
        await addWardrobeItem({ ...data, createTime: Date.now() })
      }

      wx.hideLoading()
      wx.showToast({ title: editId ? '已保存' : '已加入衣柜', icon: 'success' })
      clearBackTimer()
      backTimer = setTimeout(() => {
        backTimer = null
        safeBack('/pages/wardrobe/wardrobe')
      }, 700)
    } catch (e) {
      console.error('[wardrobe] 保存失败：', e)
      wx.hideLoading()
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    }
  },
})