// 个人每日风采库：瀑布流照片墙 + 管理批量删除
import { listCheckins, removeCheckins } from '../../utils/checkin'
import type { CheckinRecord } from '../../utils/checkin'

interface GalleryItem extends CheckinRecord {
  selected: boolean
}

Page({
  data: {
    leftList: [] as GalleryItem[],
    rightList: [] as GalleryItem[],
    empty: true,
    managing: false,
    selected: [] as string[],
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    this.applySelection(listCheckins(), [])
  },

  applySelection(records: CheckinRecord[], selected: string[]) {
    const items: GalleryItem[] = records.map((r) => ({
      date: r.date,
      imagePath: r.imagePath,
      weather: r.weather,
      outfit: r.outfit,
      createTime: r.createTime,
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
    this.setData({
      leftList,
      rightList,
      empty: records.length === 0,
    })
  },

  onToggleManage() {
    const managing = !this.data.managing
    this.setData({ managing, selected: [] })
    this.applySelection(listCheckins(), [])
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
    this.applySelection(listCheckins(), selected)
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

  deleteSelected() {
    const selected = this.data.selected
    // 尽力删除本地照片文件（失败不影响记录删除）
    const fsm = wx.getFileSystemManager()
    listCheckins().forEach((r) => {
      if (selected.indexOf(r.date) >= 0 && r.imagePath) {
        try {
          fsm.unlink({ filePath: r.imagePath, fail: () => {} })
        } catch (e) {
          // 忽略文件删除失败
        }
      }
    })
    removeCheckins(selected)
    this.setData({ managing: false, selected: [] })
    this.refresh()
    wx.showToast({ title: '已删除', icon: 'success' })
  },
})
