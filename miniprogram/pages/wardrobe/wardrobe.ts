// 我的衣柜：搜索 + 类目筛选 + 添加 + 删除
import {
  listWardrobe,
  removeWardrobeItem,
  countByCategory,
  toTempUrls,
  WARDROBE_CATEGORIES,
  SEASON_OPTIONS,
  COLOR_OPTIONS,
  MATERIAL_OPTIONS,
  TAG_OPTIONS,
} from '../../utils/wardrobe'
import type { WardrobeItem, LabelOption } from '../../utils/wardrobe'
import { getProfile } from '../../utils/storage'
import { applyTheme } from '../../utils/preferences'
import { safeNavigateTo } from '../../utils/nav'

interface WardrobeView {
  _id?: string
  category: string
  categoryLabel: string
  name: string
  imageFileID: string
  imageUrl: string
  tagLabels: string[]
  showTagHint: boolean
  searchText: string
}

function labelsOf(keys: string[], options: LabelOption[]): string[] {
  if (!keys) {
    return []
  }
  return keys
    .map((k) => {
      const found = options.find((o) => o.key === k)
      return found ? found.label : ''
    })
    .filter(Boolean)
}

Page({
  data: {
    theme: 'orange',
    categories: WARDROBE_CATEGORIES,
    filter: 'all',
    keyword: '',
    total: 0,
    counts: {} as Record<string, number>,
    items: [] as WardrobeView[],
    shown: [] as WardrobeView[],
  },

  onShow() {
    const p = getProfile()
    this.setData({ theme: p.theme })
    applyTheme(p.theme)
    this.refresh()
  },

  onPullDownRefresh() {
    this.refresh().then(() => wx.stopPullDownRefresh())
  },

  async refresh() {
    let items: WardrobeItem[] = []
    try {
      items = await listWardrobe()
    } catch (e) {
      console.error('[wardrobe] 读取失败：', e)
    }
    const urlMap = await toTempUrls(items.map((i) => i.imageFileID))
    const views: WardrobeView[] = items.map((i) => {
      const catLabel = labelsOf([i.category], WARDROBE_CATEGORIES)[0] || '衣服'
      const tagLabels = labelsOf(i.tags || [], TAG_OPTIONS)
      const colorLabels = labelsOf(i.colors || [], COLOR_OPTIONS)
      const materialLabels = labelsOf(i.materials || [], MATERIAL_OPTIONS)
      const seasonLabels = labelsOf(i.seasons || [], SEASON_OPTIONS)
      return {
        _id: i._id,
        category: i.category,
        categoryLabel: catLabel,
        name: i.name,
        imageFileID: i.imageFileID,
        imageUrl: urlMap[i.imageFileID] || '',
        tagLabels,
        showTagHint: (i.tags || []).length === 0,
        searchText: [i.name, catLabel, ...colorLabels, ...materialLabels, ...tagLabels, ...seasonLabels].join(' '),
      }
    })
    this.setData({ total: items.length, counts: countByCategory(items) })
    this.applyFilter(views)
  },

  applyFilter(viewsArg: WardrobeView[]) {
    const filter = this.data.filter
    const keyword = this.data.keyword.trim()
    const shown = viewsArg.filter((v) => {
      if (filter !== 'all' && v.category !== filter) {
        return false
      }
      if (keyword && v.searchText.indexOf(keyword) < 0) {
        return false
      }
      return true
    })
    this.setData({ items: viewsArg, shown })
  },

  onFilter(e: WechatMiniprogram.TouchEvent) {
    this.setData({ filter: String(e.currentTarget.dataset.key) })
    this.applyFilter(this.data.items)
  },

  onSearchInput(e: WechatMiniprogram.Input) {
    this.setData({ keyword: e.detail.value })
    this.applyFilter(this.data.items)
  },

  onAdd() {
    safeNavigateTo('/pages/wardrobe/edit')
  },

  onEdit(e: WechatMiniprogram.TouchEvent) {
    const id = String(e.currentTarget.dataset.id || '')
    if (!id) {
      return
    }
    safeNavigateTo(`/pages/wardrobe/edit?id=${id}`)
  },

  onDelete(e: WechatMiniprogram.TouchEvent) {
    const id = String(e.currentTarget.dataset.id || '')
    const fileID = String(e.currentTarget.dataset.file || '')
    wx.showModal({
      title: '删除这件衣服',
      content: '删除后不可恢复',
      confirmText: '删除',
      confirmColor: '#EF4444',
      success: (res) => {
        if (!res.confirm) {
          return
        }
        wx.showLoading({ title: '删除中…', mask: true })
        removeWardrobeItem(id, fileID)
          .then(() => {
            wx.hideLoading()
            wx.showToast({ title: '已删除', icon: 'success' })
            return this.refresh()
          })
          .catch(() => {
            wx.hideLoading()
            wx.showToast({ title: '删除失败，请重试', icon: 'none' })
          })
      },
    })
  },
})