// 天气服务：高德定位（逆地理编码）+ 高德实时天气
import {
  AMAP_KEY,
  AMAP_WEATHER_URL,
  AMAP_REGEO_URL,
  DEFAULT_CITY,
  DEFAULT_ADCODE,
} from './config'
import type { WeatherInfo } from './outfitRules'

function getSeason(month: number): string {
  if (month >= 3 && month <= 5) return '春天'
  if (month >= 6 && month <= 8) return '夏天'
  if (month >= 9 && month <= 11) return '秋天'
  return '冬天'
}

function mapIcon(weather: string): string {
  if (/晴/.test(weather)) return '☀️'
  if (/雨/.test(weather)) return '🌧️'
  if (/雪/.test(weather)) return '❄️'
  if (/雷/.test(weather)) return '⛈️'
  if (/雾|霾/.test(weather)) return '🌫️'
  if (/云|阴/.test(weather)) return '⛅'
  return '🌤️'
}

function parseWindLevel(windpower: string): number {
  const num = parseInt(windpower.replace(/[^0-9]/g, ''), 10)
  return isNaN(num) ? 0 : num
}

interface AmapLive {
  city?: string
  weather?: string
  temperature?: string
  windpower?: string
}

function getLocation(): Promise<{ longitude: number; latitude: number }> {
  return new Promise((resolve, reject) => {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        console.log('[weather] 定位成功:', res.longitude, res.latitude)
        resolve({ longitude: res.longitude, latitude: res.latitude })
      },
      fail: (err) => {
        console.warn('[weather] 定位失败:', err)
        reject(new Error('定位失败'))
      },
    })
  })
}

function reverseGeocode(longitude: number, latitude: number): Promise<{ adcode: string; city: string }> {
  return new Promise((resolve, reject) => {
    wx.request({
      url: AMAP_REGEO_URL,
      data: {
        key: AMAP_KEY,
        location: `${longitude},${latitude}`,
        extensions: 'base',
      },
      success: (res) => {
        console.log('[weather] 逆地理编码返回:', res.data)
        const data = res.data as {
          regeocode?: {
            addressComponent?: {
              adcode?: string
              city?: string | string[]
              province?: string
            }
          }
        }
        const component = data.regeocode && data.regeocode.addressComponent
        if (!component) {
          reject(new Error('逆地理编码失败'))
          return
        }
        let cityName = component.city
        if (!cityName || Array.isArray(cityName)) {
          cityName = component.province || DEFAULT_CITY
        }
        resolve({
          adcode: String(component.adcode || DEFAULT_ADCODE),
          city: String(cityName),
        })
      },
      fail: (err) => {
        console.warn('[weather] 逆地理编码请求失败:', err)
        reject(new Error('逆地理编码请求失败'))
      },
    })
  })
}

function queryWeather(adcode: string, city: string): Promise<WeatherInfo> {
  const now = new Date()
  const season = getSeason(now.getMonth() + 1)
  return new Promise((resolve, reject) => {
    wx.request({
      url: AMAP_WEATHER_URL,
      data: {
        key: AMAP_KEY,
        city: adcode,
        extensions: 'base',
      },
      success: (res) => {
        console.log('[weather] 天气接口返回:', res.data)
        const data = res.data as { lives?: AmapLive[] }
        const live = data.lives && data.lives[0]
        if (!live) {
          reject(new Error('天气数据为空'))
          return
        }
        const temp = Number(live.temperature) || 0
        const windLevel = parseWindLevel(live.windpower || '')
        resolve({
          city: live.city || city,
          temp,
          feelsLike: windLevel >= 5 ? temp - 3 : temp,
          text: live.weather || '多云',
          windLevel,
          icon: mapIcon(live.weather || ''),
          season,
        })
      },
      fail: (err) => {
        console.warn('[weather] 天气请求失败:', err)
        reject(new Error('天气请求失败'))
      },
    })
  })
}

/** 获取真实天气：先定位反查城市，失败回退默认城市 */
export async function getWeather(): Promise<WeatherInfo> {
  let adcode = DEFAULT_ADCODE
  let city = DEFAULT_CITY
  try {
    const loc = await getLocation()
    const geo = await reverseGeocode(loc.longitude, loc.latitude)
    adcode = geo.adcode
    city = geo.city
  } catch (e) {
    console.warn('[weather] 定位流程失败，回退默认城市:', DEFAULT_CITY)
  }
  try {
    const weather = await queryWeather(adcode, city)
    console.log('[weather] 最终天气:', weather)
    return weather
  } catch (e) {
    throw e
  }
}

/** 兜底天气（定位与天气接口都失败时使用） */
export function getFallbackWeather(): WeatherInfo {
  const now = new Date()
  return {
    city: DEFAULT_CITY,
    temp: 20,
    feelsLike: 20,
    text: '多云',
    windLevel: 2,
    icon: '⛅',
    season: getSeason(now.getMonth() + 1),
  }
}
