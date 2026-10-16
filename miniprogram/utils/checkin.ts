// 打卡数据服务（本地存储版）
// 将来切换云开发：仅替换本文件内部实现（setStorageSync → 云数据库，saveFile → 云存储）

import type { WeatherInfo, OutfitResult } from './outfitRules'

export interface CheckinRecord {
  date: string          // YYYY-MM-DD
  imagePath: string     // wx.saveFile 返回的持久本地路径
  weather: WeatherInfo
  outfit: OutfitResult
  createTime: number
}

const KEY = 'checkinRecords'

export function formatDate(date: Date): string {
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function load(): CheckinRecord[] {
  const cached = wx.getStorageSync<CheckinRecord[]>(KEY)
  return Array.isArray(cached) ? cached : []
}

function save(list: CheckinRecord[]): void {
  wx.setStorageSync(KEY, list)
}

/** 当天是否已打卡 */
export function hasCheckedToday(date: string): boolean {
  return load().some((r) => r.date === date)
}

/** 新增一条打卡记录（同一天去重，只保留最新） */
export function addCheckin(record: CheckinRecord): void {
  const list = load()
  const filtered = list.filter((r) => r.date !== record.date)
  filtered.unshift(record)
  save(filtered)
}

/** 获取历史打卡列表（按时间倒序） */
export function listCheckins(): CheckinRecord[] {
  return load().sort((a, b) => b.createTime - a.createTime)
}

/** 累计打卡天数（不同日期各算一天） */
export function countCheckinDays(): number {
  const days = new Set(load().map((r) => r.date))
  return days.size
}

/** 批量删除指定日期的打卡记录 */
export function removeCheckins(dates: string[]): void {
  const list = load().filter((r) => dates.indexOf(r.date) < 0)
  save(list)
}
