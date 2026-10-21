// 穿搭模特试穿图服务（AI 生成 + 按「日期+画像」缓存到云存储）
// 说明：AI 生图较慢（约十几秒）且按次计费，因此同一天同一画像只生成一次，之后复用缓存。
import { CLOUD_ENV } from './config'
import { ageBandText } from './outfitRules'
import type { WeatherInfo, OutfitResult, UserProfile } from './outfitRules'

export interface OutfitImageResult {
  url: string
  fileID: string
}

const COLLECTION = 'outfit_images'

function collection() {
  return wx.cloud.database({ env: CLOUD_ENV }).collection(COLLECTION)
}

function pad(n: number): string {
  return n < 10 ? '0' + n : '' + n
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 缓存键：日期 + 性别 + 年龄 + 风格，任一变化即重新生成 */
export function buildCacheKey(profile: UserProfile): string {
  return [todayStr(), profile.gender || 'x', profile.age || 'x', profile.style || 'x'].join('|')
}

/** 拼接生图提示词：插画风模特试穿当天这套穿搭（weather 预留，后续可用于生成更贴合天气的场景） */
export function buildPrompt(
  profile: UserProfile,
  _weather: WeatherInfo,
  outfit: OutfitResult
): string {
  const genderWord = profile.gender === '女' ? '女性' : profile.gender === '男' ? '男性' : '中性'
  const ageWord = ageBandText(profile.age)
  const styleWord = outfit.styleLabel
  return (
    `一张全身的${styleWord}风格时尚插画，一位${ageWord}${genderWord}模特正在试穿今天这套穿搭：` +
    `上身穿${outfit.top}，下身穿${outfit.bottom}，脚穿${outfit.shoes}。` +
    `简约扁平手绘插画风，柔和暖色调，浅米色纯色背景，全身完整可见，站姿自然放松，` +
    `画风温暖治愈，适合年轻人，画面干净，无文字，无logo，无多余背景元素。`
  )
}

/** fileID → 可直接用于 <image> 的临时链接 */
async function toTempUrl(fileID: string): Promise<string> {
  const res = await wx.cloud.getTempFileURL({
    fileList: [fileID],
    config: { env: CLOUD_ENV },
  })
  const first = res.fileList && res.fileList[0]
  return (first && first.tempFileURL) || ''
}

/** 读取当天缓存 */
async function readCache(key: string): Promise<string> {
  const res = await collection().where({ key }).limit(1).get()
  const list = res.data as Array<{ fileID?: string }>
  if (list.length > 0 && list[0].fileID) {
    return list[0].fileID
  }
  return ''
}

/**
 * 获取（或生成）今天的模特试穿图。
 * - force=false：命中缓存直接返回临时链接；
 * - force=true（换一张）：跳过缓存重新生成，并删掉该画像当天的旧图与旧记录，避免云存储堆积。
 * 生成失败会抛出异常，调用方需自行兜底。
 */
export async function getOutfitImage(
  profile: UserProfile,
  weather: WeatherInfo,
  outfit: OutfitResult,
  force = false
): Promise<OutfitImageResult> {
  const key = buildCacheKey(profile)

  if (!force) {
    const cached = await readCache(key)
    if (cached) {
      const url = await toTempUrl(cached)
      if (url) {
        return { url, fileID: cached }
      }
    }
  }

  const prompt = buildPrompt(profile, weather, outfit)
  const callRes = await wx.cloud.callFunction({
    name: 'genOutfitImage',
    data: { prompt },
    config: { env: CLOUD_ENV },
  })
  const result = callRes.result as { fileID?: string } | undefined
  if (!result || !result.fileID) {
    throw new Error('生图返回为空')
  }
  const fileID = result.fileID

  // 清掉该画像当天的旧记录与旧文件（换一张 / 兜底重试共用）
  try {
    const oldRes = await collection().where({ key }).get()
    const olds = oldRes.data as Array<{ _id?: string; fileID?: string }>
    for (const item of olds) {
      if (item._id) {
        await collection().doc(item._id).remove()
      }
      if (item.fileID && item.fileID !== fileID) {
        try {
          await wx.cloud.deleteFile({ fileList: [item.fileID], config: { env: CLOUD_ENV } })
        } catch (e) {
          // 忽略旧文件删除失败
        }
      }
    }
  } catch (e) {
    // 清理旧记录失败不影响展示
  }

  try {
    await collection().add({ data: { key, fileID, prompt, createTime: Date.now() } })
  } catch (e) {
    // 写缓存失败不影响展示
  }

  const url = await toTempUrl(fileID)
  return { url, fileID }
}