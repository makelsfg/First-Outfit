// 我的衣柜服务（云开发：云数据库 wardrobe_items + 云存储照片）
import { CLOUD_ENV } from './config'

export interface LabelOption {
  key: string
  label: string
}

/** 类目（与穿搭建议的项对应，方便「轻打通」） */
export const WARDROBE_CATEGORIES: LabelOption[] = [
  { key: 'top', label: '上装' },
  { key: 'coat', label: '外套' },
  { key: 'bottom', label: '下装' },
  { key: 'shoes', label: '鞋子' },
  { key: 'accessory', label: '配饰' },
]

/** 季节 */
export const SEASON_OPTIONS: LabelOption[] = [
  { key: 'spring', label: '春季' },
  { key: 'summer', label: '夏季' },
  { key: 'autumn', label: '秋季' },
  { key: 'winter', label: '冬季' },
  { key: 'all', label: '四季' },
]

/** 颜色 */
export const COLOR_OPTIONS: LabelOption[] = [
  { key: 'black', label: '黑色' },
  { key: 'white', label: '白色' },
  { key: 'gray', label: '灰色' },
  { key: 'red', label: '红色' },
  { key: 'blue', label: '蓝色' },
  { key: 'green', label: '绿色' },
  { key: 'yellow', label: '黄色' },
  { key: 'pink', label: '粉色' },
  { key: 'purple', label: '紫色' },
  { key: 'brown', label: '棕色' },
  { key: 'beige', label: '米色' },
  { key: 'orange', label: '橙色' },
  { key: 'other', label: '其他' },
]

/** 材质 */
export const MATERIAL_OPTIONS: LabelOption[] = [
  { key: 'cotton', label: '棉' },
  { key: 'linen', label: '麻' },
  { key: 'silk', label: '丝' },
  { key: 'wool', label: '羊毛' },
  { key: 'polyester', label: '化纤' },
  { key: 'denim', label: '牛仔' },
  { key: 'leather', label: '皮革' },
  { key: 'knit', label: '针织' },
  { key: 'blend', label: '混纺' },
  { key: 'chiffon', label: '雪纺' },
  { key: 'lace', label: '蕾丝' },
  { key: 'other', label: '其他' },
]

/** 标签（与场合对应，参与推荐匹配） */
export const TAG_OPTIONS: LabelOption[] = [
  { key: 'daily', label: '日常' },
  { key: 'casual', label: '休闲' },
  { key: 'formal', label: '正式' },
  { key: 'sport', label: '运动' },
  { key: 'date', label: '约会' },
  { key: 'party', label: '聚会' },
  { key: 'home', label: '居家' },
  { key: 'outdoor', label: '户外' },
]

export interface WardrobeItem {
  _id?: string
  category: string
  imageFileID: string
  name: string
  seasons: string[]
  colors: string[]
  materials: string[]
  tags: string[]
  note: string
  createTime: number
}

const COLLECTION = 'wardrobe_items'

function collection() {
  return wx.cloud.database({ env: CLOUD_ENV }).collection(COLLECTION)
}

/** 天气里的季节文案 → 季节 key */
export function seasonKeyOf(seasonText: string): string {
  if (seasonText === '春天') return 'spring'
  if (seasonText === '夏天') return 'summer'
  if (seasonText === '秋天') return 'autumn'
  if (seasonText === '冬天') return 'winter'
  return ''
}

/** 拉取全部衣物（按时间倒序，最多 200 件） */
export async function listWardrobe(): Promise<WardrobeItem[]> {
  const res = await collection().orderBy('createTime', 'desc').limit(200).get()
  return res.data as WardrobeItem[]
}

/** 按类目统计件数 */
export function countByCategory(items: WardrobeItem[]): Record<string, number> {
  const counts: Record<string, number> = {}
  items.forEach((i) => {
    counts[i.category] = (counts[i.category] || 0) + 1
  })
  return counts
}

/** 估计一件衣柜衣服的厚薄（1~5）：按 类目 + 季节 + 材质 推断 */
export function warmthOfItem(i: WardrobeItem): number {
  let w = 3
  if (i.category === 'coat') {
    w += 1.5
  } else if (i.category === 'accessory') {
    w -= 1
  }
  const seasons = i.seasons || []
  if (seasons.indexOf('winter') >= 0) {
    w += 1.5
  } else if (seasons.indexOf('summer') >= 0) {
    w -= 1.5
  }
  const mats = i.materials || []
  if (mats.indexOf('wool') >= 0) {
    w += 1
  } else if (mats.indexOf('knit') >= 0) {
    w += 0.5
  } else if (mats.indexOf('linen') >= 0 || mats.indexOf('chiffon') >= 0 || mats.indexOf('lace') >= 0) {
    w -= 0.5
  }
  return Math.min(5, Math.max(1, w))
}

export interface WardrobePick {
  name: string          // 可用的那件（空串表示没有）
  rejectedName: string  // 因厚薄不合适被劝退的那件（空串表示没有）
}

/**
 * 轻打通匹配：先按「厚薄是否适合今天」过滤，再按场合/季节打分。
 * - 厚薄差 > 1.2 视为不合适（不推荐，改给劝退提示）
 * - 场合/季节得分 < 1 也不推荐（信息不足，避免"没录信息反而被选中"）
 */
export function pickWardrobe(
  items: WardrobeItem[],
  category: string,
  sceneKey: string,
  seasonKey: string,
  target: number
): WardrobePick {
  const pool = items.filter((i) => i.category === category && i.name)
  if (pool.length === 0) {
    return { name: '', rejectedName: '' }
  }
  const tempOk = (i: WardrobeItem): boolean => Math.abs(warmthOfItem(i) - target) <= 1.2
  const score = (i: WardrobeItem): number => {
    const tags = i.tags || []
    const seasons = i.seasons || []
    let s = 0
    if (tags.length > 0 && tags.indexOf(sceneKey) >= 0) {
      s += 2
    }
    if (seasons.length > 0) {
      s += seasons.indexOf('all') >= 0 || seasons.indexOf(seasonKey) >= 0 ? 1 : -1
    } else {
      s += 0.3
    }
    if (tags.length === 0 && seasons.length === 0) {
      s -= 1
    }
    return s
  }

  const suitable = pool.filter(tempOk)
  let best: WardrobeItem | null = null
  let bestScore = 0
  for (const i of suitable) {
    const s = score(i)
    if (best === null || s > bestScore) {
      best = i
      bestScore = s
    }
  }
  if (best !== null && bestScore >= 1) {
    return { name: best.name, rejectedName: '' }
  }

  // 没有合适的：找出"有信息但厚薄不对"的那件，用于劝退提示
  const rejected = pool.filter(
    (i) => !tempOk(i) && ((i.tags || []).length > 0 || (i.seasons || []).length > 0)
  )[0]
  return { name: '', rejectedName: rejected ? rejected.name : '' }
}

/** fileID → 临时可访问链接 */
export async function toTempUrls(fileIDs: string[]): Promise<Record<string, string>> {
  const map: Record<string, string> = {}
  const valid = fileIDs.filter(Boolean)
  if (valid.length === 0) {
    return map
  }
  try {
    const res = await wx.cloud.getTempFileURL({ fileList: valid, config: { env: CLOUD_ENV } })
    res.fileList.forEach((f) => {
      if (f.tempFileURL) {
        map[f.fileID] = f.tempFileURL
      }
    })
  } catch (e) {
    // 获取失败时留空
  }
  return map
}

/** 上传衣物照片到云存储 */
export async function uploadPhoto(tempFilePath: string): Promise<string> {
  const res = await wx.cloud.uploadFile({
    cloudPath: `wardrobe/${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`,
    filePath: tempFilePath,
    config: { env: CLOUD_ENV },
  })
  return res.fileID
}

/** 新增一件衣物 */
export async function addWardrobeItem(item: Omit<WardrobeItem, '_id'>): Promise<void> {
  await collection().add({ data: item })
}

/** 读取单件衣物（用于编辑） */
export async function getWardrobeItem(id: string): Promise<WardrobeItem | null> {
  const res = await collection().doc(id).get()
  return (res.data as WardrobeItem) || null
}

/** 更新一件衣物 */
export async function updateWardrobeItem(id: string, data: Partial<WardrobeItem>): Promise<void> {
  await collection().doc(id).update({ data })
}

/** 删除云存储里的照片（换图时清理旧图） */
export async function deletePhoto(fileID: string): Promise<void> {
  if (!fileID) {
    return
  }
  try {
    await wx.cloud.deleteFile({ fileList: [fileID], config: { env: CLOUD_ENV } })
  } catch (e) {
    // 忽略
  }
}

/** 删除一件衣物（记录 + 云存储文件） */
export async function removeWardrobeItem(id: string, fileID: string): Promise<void> {
  if (id) {
    await collection().doc(id).remove()
  }
  await deletePhoto(fileID)
}