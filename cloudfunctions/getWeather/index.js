// 云函数 getWeather：代理高德定位与天气查询
// API Key 通过云函数「环境变量」注入，代码中不保存密钥
const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const AMAP_KEY = process.env.AMAP_KEY || ''
const DEFAULT_ADCODE = '110000'
const DEFAULT_CITY = '北京'

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            reject(new Error('天气数据解析失败'))
          }
        })
      })
      .on('error', reject)
  })
}

function mapIcon(weather) {
  if (/晴/.test(weather)) return '☀️'
  if (/雨/.test(weather)) return '🌧️'
  if (/雪/.test(weather)) return '❄️'
  if (/雷/.test(weather)) return '⛈️'
  if (/雾|霾/.test(weather)) return '🌫️'
  if (/云|阴/.test(weather)) return '⛅'
  return '🌤️'
}

function getSeason(month) {
  if (month >= 3 && month <= 5) return '春天'
  if (month >= 6 && month <= 8) return '夏天'
  if (month >= 9 && month <= 11) return '秋天'
  return '冬天'
}

exports.main = async (event) => {
  if (!AMAP_KEY) {
    throw new Error('未配置环境变量 AMAP_KEY，请在云函数配置中添加')
  }

  let adcode = DEFAULT_ADCODE
  let city = DEFAULT_CITY

  // 有经纬度时先做逆地理编码，拿到城市与 adcode
  if (event.longitude && event.latitude) {
    try {
      const regeo = await httpGet(
        `https://restapi.amap.com/v3/geocode/regeo?key=${AMAP_KEY}&location=${event.longitude},${event.latitude}&extensions=base`
      )
      const component = regeo.regeocode && regeo.regeocode.addressComponent
      if (component) {
        adcode = String(component.adcode || adcode)
        let cityName = component.city
        if (!cityName || Array.isArray(cityName)) {
          cityName = component.province || city
        }
        city = String(cityName)
      }
    } catch (e) {
      // 逆地理编码失败，使用默认城市
    }
  }

  const weatherRes = await httpGet(
    `https://restapi.amap.com/v3/weather/weatherInfo?key=${AMAP_KEY}&city=${adcode}&extensions=base`
  )
  const live = weatherRes.lives && weatherRes.lives[0]
  if (!live) {
    throw new Error('天气数据为空')
  }

  const temp = Number(live.temperature) || 0
  const windLevel = parseInt(String(live.windpower || '').replace(/[^0-9]/g, ''), 10) || 0
  // 云函数运行在 UTC 时区，先转成北京时间再判断季节
  const month = new Date(Date.now() + 8 * 60 * 60 * 1000).getUTCMonth() + 1

  return {
    city: live.city || city,
    temp,
    feelsLike: windLevel >= 5 ? temp - 3 : temp,
    text: live.weather || '多云',
    windLevel,
    icon: mapIcon(live.weather || ''),
    season: getSeason(month),
  }
}
