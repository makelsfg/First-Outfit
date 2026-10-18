// 打卡数据服务（云开发版：云数据库 checkin_records + 云存储图片）
import type { WeatherInfo, OutfitResult } from './outfitRules'
import { CLOUD_ENV } from './config'

export interface CheckinRecord {
  _id?: string
  date: string          // YYYY-MM-DD
  imageFileID: string   // 云存储 fileID
  weather: WeatherInfo
  outfit: OutfitResult
  createTime: number
}

const COLLECTION = 'checkin_records'

function collection() {
  return wx.cloud.database({ env: CLOUD_ENV }).collection(COLLECTION)
}

export function formatDate(date: Date): string {
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 当天是否已打卡 */
export async function hasCheckedToday(date: string): Promise<boolean> {
  const res = await collection().where({ date }).count()
  return res.total > 0
}

/** 新增一条打卡记录（同一天去重，只保留最新） */
export async function addCheckin(record: Omit<CheckinRecord, '_id'>): Promise<void> {
  const dbc = collection()
  const oldRes = await dbc.where({ date: record.date }).get()
  const olds = oldRes.data as CheckinRecord[]
  for (const item of olds) {
    if (item._id) {
      await dbc.doc(item._id).remove()
    }
    if (item.imageFileID) {
      try {
        await wx.cloud.deleteFile({ fileList: [item.imageFileID], config: { env: CLOUD_ENV } })
      } catch (e) {
        // 忽略旧文件删除失败
      }
    }
  }
  await dbc.add({ data: record })
}

/** 获取历史打卡列表（按时间倒序，最多 100 条） */
export async function listCheckins(): Promise<CheckinRecord[]> {
  const res = await collection().orderBy('createTime', 'desc').limit(100).get()
  return res.data as CheckinRecord[]
}

/** 累计打卡天数（不同日期各算一天） */
export async function countCheckinDays(): Promise<number> {
  const res = await collection().count()
  return res.total
}

/** 批量删除打卡记录与云存储文件 */
export async function removeCheckins(ids: string[], fileIDs: string[]): Promise<void> {
  const dbc = collection()
  for (const id of ids) {
    await dbc.doc(id).remove()
  }
  const validFiles = fileIDs.filter(Boolean)
  if (validFiles.length > 0) {
    try {
      await wx.cloud.deleteFile({ fileList: validFiles, config: { env: CLOUD_ENV } })
    } catch (e) {
      // 忽略文件删除失败
    }
  }
}
