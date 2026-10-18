// 天气服务：通过云函数获取真实天气（API Key 保存在云函数，前端不可见）
import { CLOUD_ENV, DEFAULT_CITY } from './config'
import type { WeatherInfo } from './outfitRules'

function getLocation(): Promise<{ longitude: number; latitude: number } | null> {
  return new Promise((resolve) => {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => resolve({ longitude: res.longitude, latitude: res.latitude }),
      fail: () => resolve(null),
    })
  })
}

/** 获取真实天气：先定位，再由云函数反查城市并查询天气 */
export async function getWeather(): Promise<WeatherInfo> {
  const loc = await getLocation()
  const data: { longitude?: number; latitude?: number } = {}
  if (loc) {
    data.longitude = loc.longitude
    data.latitude = loc.latitude
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

/** 兜底天气（定位与天气接口都失败时使用） */
export function getFallbackWeather(): WeatherInfo {
  const now = new Date()
  const month = now.getMonth() + 1
  let season = '冬天'
  if (month >= 3 && month <= 5) season = '春天'
  else if (month >= 6 && month <= 8) season = '夏天'
  else if (month >= 9 && month <= 11) season = '秋天'
  return {
    city: DEFAULT_CITY,
    temp: 20,
    feelsLike: 20,
    text: '多云',
    windLevel: 2,
    icon: '⛅',
    season,
  }
}
