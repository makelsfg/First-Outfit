// 个人每日风采库：瀑布流照片墙 + 管理批量删除（云开发版）
import { listCheckins, removeCheckins } from '../../utils/checkin'
import type { CheckinRecord } from '../../utils/checkin'
import type { WeatherInfo, OutfitResult } from '../../utils/outfitRules'
import { CLOUD_ENV } from '../../utils/config'
import { getProfile } from '../../utils/storage'
import { applyTheme } from '../../utils/preferences'

interface GalleryItem {
  _id?: string
  date: string
  imageFileID: string
  imageUrl: string
  weather: WeatherInfo
  outfit: OutfitResult
  createTime: number
  selected: boolean
}

Page({
  data: {
    leftList: [] as GalleryItem[],
    rightList: [] as GalleryItem[],
    records: [] as GalleryItem[],
    empty: true,
    managing: false,
    selected: [] as string[],
    theme: 'orange',
  },

  async onShow() {
    const p = getProfile()
    this.setData({ theme: p.theme })
    applyTheme(p.theme)
    await this.refresh()
  },

  async refresh() {
    try {
      const records: CheckinRecord[] = await listCheckins()
      // 云存储 fileID 批量换取临时可访问链接
      const fileIDs = records.map((r) => r.imageFileID).filter(Boolean)
      const urlMap: Record<string, string> = {}
      if (fileIDs.length > 0) {
        try {
          const res = await wx.cloud.getTempFileURL({
            fileList: fileIDs,
            config: { env: CLOUD_ENV },
          })
          res.fileList.forEach((f) => {
            if (f.tempFileURL) {
              urlMap[f.fileID] = f.tempFileURL
            }
          })
        } catch (e) {
          // 获取临时链接失败时图片留空
        }
      }
      const items: GalleryItem[] = records.map((r) => ({
        _id: r._id,
        date: r.date,
        imageFileID: r.imageFileID,
        imageUrl: urlMap[r.imageFileID] || '',
        weather: r.weather,
        outfit: r.outfit,
        createTime: r.createTime,
        selected: false,
      }))
      this.setData({ records: items, empty: items.length === 0 })
      this.buildColumns()
    } catch (e) {
      this.setData({ records: [], empty: true })
      this.buildColumns()
    }
  },

  /** 根据 records + selected 重新生成左右两列 */
  buildColumns() {
    const selected = this.data.selected
    const items = this.data.records.map((r) => ({
      ...r,
      selected: selected.indexOf(r.date) >= 0,
    }))
    const leftList: GalleryItem[] = []
    const rightList: GalleryItem[] = []
    items.forEach((item, i) => {
      if (i % 2 === 0) {
        leftList.push(item)
      } else {
        rightList.push(item)
      }
    })
    this.setData({ leftList, rightList })
  },

  onToggleManage() {
    this.setData({ managing: !this.data.managing, selected: [] })
    this.buildColumns()
  },

  onSelectItem(e: WechatMiniprogram.TouchEvent) {
    if (!this.data.managing) {
      return
    }
    const date = e.currentTarget.dataset.date as string
    const selected = this.data.selected.slice()
    const idx = selected.indexOf(date)
    if (idx >= 0) {
      selected.splice(idx, 1)
    } else {
      selected.push(date)
    }
    this.setData({ selected })
    this.buildColumns()
  },

  onConfirmDelete() {
    const selected = this.data.selected
    if (selected.length === 0) {
      wx.showToast({ title: '请先选择要删除的照片', icon: 'none' })
      return
    }
    wx.showModal({
      title: '确认删除',
      content: `确定删除这些照片（${selected.length}张）？照片不可复原`,
      confirmText: '删除',
      confirmColor: '#EF4444',
      success: (res) => {
        if (res.confirm) {
          this.deleteSelected()
        }
      },
    })
  },

  async deleteSelected() {
    const selected = this.data.selected
    const toDelete = this.data.records.filter((r) => selected.indexOf(r.date) >= 0)
    const ids = toDelete.map((r) => r._id).filter(Boolean) as string[]
    const fileIDs = toDelete.map((r) => r.imageFileID).filter(Boolean)
    wx.showLoading({ title: '删除中…', mask: true })
    try {
      await removeCheckins(ids, fileIDs)
      wx.hideLoading()
      this.setData({ managing: false, selected: [] })
      await this.refresh()
      wx.showToast({ title: '已删除', icon: 'success' })
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '删除失败，请重试', icon: 'none' })
    }
  },
})
