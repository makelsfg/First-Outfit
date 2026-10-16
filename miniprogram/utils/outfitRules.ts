// 穿搭规则引擎：温度区间 / 天气 → 穿搭方案（确定性规则，不联网也能出结果）

export interface WeatherInfo {
  city: string
  temp: number      // 实时温度（℃）
  feelsLike: number // 体感温度（℃）
  text: string      // 天气现象文字，如「晴」「多云」「小雨」
  windLevel: number // 风力等级
  icon: string      // 天气图标（emoji）
  season: string    // 季节描述
}

export interface OutfitResult {
  top: string
  inner: string     // 内搭，为空字符串时前端隐藏该行
  bottom: string
  shoes: string
  reason: string
  tips: string[]
}

interface TempRule {
  minTemp: number
  maxTemp: number
  top: string
  bottom: string
  shoes: string
  reason: string
}

const TEMP_RULES: TempRule[] = [
  {
    minTemp: 28, maxTemp: 40,
    top: '短袖T恤', bottom: '薄款长裤或短裤', shoes: '透气运动鞋',
    reason: '天热以透气为主，短袖加轻薄下装最安全，不容易闷热。',
  },
  {
    minTemp: 18, maxTemp: 27,
    top: '长袖T恤或薄卫衣', bottom: '休闲长裤', shoes: '运动鞋或帆布鞋',
    reason: '早晚有温差，单件长袖最稳妥，冷热都能应付。',
  },
  {
    minTemp: 10, maxTemp: 17,
    top: '卫衣（推荐）或针织衫', bottom: '长裤', shoes: '运动鞋',
    reason: '偏凉需要稍厚上衣，长裤能避免受凉。',
  },
  {
    minTemp: 0, maxTemp: 9,
    top: '毛衣 + 外套', bottom: '加绒长裤', shoes: '运动鞋 / 靴子',
    reason: '冷天需要叠穿，外套防风、内搭保暖，最不容易出错。',
  },
  {
    minTemp: -30, maxTemp: -1,
    top: '羽绒服 + 毛衣', bottom: '加绒长裤', shoes: '保暖靴',
    reason: '严寒要优先保暖，羽绒服是最稳妥的选择。',
  },
]

function buildTips(weather: WeatherInfo): string[] {
  const tips: string[] = []
  if (/雨|雪|雷/.test(weather.text)) {
    tips.push('记得带伞，别让天气影响心情。')
  }
  if (weather.windLevel >= 5) {
    tips.push('风比较大，穿件挡风外套更稳妥。')
  }
  if (weather.feelsLike < weather.temp - 3) {
    tips.push('体感比实际温度更冷，可以多穿一件。')
  }
  return tips
}

/** 内搭：温度偏低时建议加秋衣，偏高时隐藏该行 */
function getInner(temp: number): string {
  return temp < 20 ? '怕冷加一件秋衣' : ''
}

export function recommendOutfit(weather: WeatherInfo): OutfitResult {
  const temp = weather.feelsLike
  const rule = TEMP_RULES.find((r) => temp >= r.minTemp && temp <= r.maxTemp)
  // 兜底：温度超出常规范围时，取最接近的规则
  const matched = rule || (temp > 40 ? TEMP_RULES[0] : TEMP_RULES[TEMP_RULES.length - 1])
  const inner = getInner(temp)
  const reason = inner
    ? matched.reason + '\n怕冷的话，里面加一件秋衣，比换更厚的外套更管用。'
    : matched.reason
  return {
    top: matched.top,
    inner,
    bottom: matched.bottom,
    shoes: matched.shoes,
    reason,
    tips: buildTips(weather),
  }
}
