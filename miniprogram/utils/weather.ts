// 天气服务：通过云函数获取真实天气（API Key 保存在云函数，前端不可见）
import { CLOUD_ENV, DEFAULT_CITY } from './config'
import type { WeatherInfo } from './outfitRules'
import type { City } from './cities'

export interface Coords {
  longitude: number
  latitude: number
}

export interface WeatherQuery {
  city?: City | null
  coords?: Coords | null
}

/** 请求一次定位；用户未授权或失败时返回 null（不抛出） */
export function requestLocation(): Promise<Coords | null> {
  return new Promise((resolve) => {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => resolve({ longitude: res.longitude, latitude: res.latitude }),
      fail: () => resolve(null),
    })
  })
}

/**
 * 获取真实天气
 * - 传了 city：直接用城市 adcode 查（跳过定位）
 * - 传了 coords：用经纬度让云函数反查城市
 * - 都不传：云函数使用默认城市
 */
export async function getWeather(query: WeatherQuery = {}): Promise<WeatherInfo> {
  const data: { longitude?: number; latitude?: number; adcode?: string } = {}
  if (query.city && query.city.adcode) {
    data.adcode = query.city.adcode
  } else if (query.coords) {
    data.longitude = query.coords.longitude
    data.latitude = query.coords.latitude
  }
  const res = await wx.cloud.callFunction({
    name: 'getWeather',
    data,
    config: { env: CLOUD_ENV },
  })
  const weather = res.result as WeatherInfo | undefined
  if (!weather) {
    throw new Error('天气获取失败')
  }
  return weather
}

/** 兜底天气（定位与天气接口都失败时使用）：按季节给合理默认值 */
export function getFallbackWeather(cityName?: string): WeatherInfo {
  const now = new Date()
  const month = now.getMonth() + 1
  let season = '冬天'
  if (month >= 3 && month <= 5) season = '春天'
  else if (month >= 6 && month <= 8) season = '夏天'
  else if (month >= 9 && month <= 11) season = '秋天'

  const defaults: Record<string, { temp: number; max: number; min: number }> = {
    春天: { temp: 18, max: 22, min: 11 },
    夏天: { temp: 29, max: 33, min: 26 },
    秋天: { temp: 19, max: 24, min: 12 },
    冬天: { temp: 5, max: 8, min: 0 },
  }
  const d = defaults[season] || defaults['秋天']

  return {
    city: cityName || DEFAULT_CITY,
    temp: d.temp,
    feelsLike: d.temp,
    text: '多云',
    windLevel: 2,
    icon: '⛅',
    season,
    tempMax: d.max,
    tempMin: d.min,
    tomorrowMax: d.max,
    tomorrowMin: d.min,
  }
}