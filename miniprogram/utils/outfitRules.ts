// 穿搭规则引擎：温度区间 / 天气 / 性别 / 年龄 / 风格 → 穿搭方案
// 设计原则：确定性、可解释、有兜底。不联网也能给出方案。

export interface WeatherInfo {
  city: string
  temp: number      // 实时温度（℃）
  feelsLike: number // 体感温度（℃）
  text: string      // 天气现象文字，如「晴」「多云」「小雨」
  windLevel: number // 风力等级
  icon: string      // 天气图标（emoji）
  season: string    // 季节描述
  tempMax?: number  // 今日白天最高温（来自预报，可能为空）
  tempMin?: number  // 今日夜间最低温（来自预报，可能为空）
}

export interface OutfitResult {
  top: string
  inner: string     // 内搭，为空字符串时前端隐藏该行
  bottom: string
  shoes: string
  reason: string
  tips: string[]
  styleLabel: string // 本次使用的风格名（用于展示与生图提示词）
}

/** 用户画像（来自「我的」本地缓存），允许字段为空 */
export interface UserProfile {
  gender: string // '男' | '女' | ''
  age: string    // 字符串，可为空
  style: string  // 风格 key，见 STYLE_OPTIONS；可为空（默认简约基础）
}

// ---------------- 风格选项 ----------------

export interface StyleOption {
  key: string
  label: string
}

export const STYLE_OPTIONS: StyleOption[] = [
  { key: 'simple', label: '简约基础' },
  { key: 'casual', label: '休闲运动' },
  { key: 'sweet', label: '温柔甜美' },
  { key: 'business', label: '商务通勤' },
  { key: 'vintage', label: '文艺复古' },
]

const DEFAULT_STYLE_KEY = 'simple'

/** 风格 → 一句「为什么这样穿」的补充说明（不评判、给兜底） */
const STYLE_NOTES: Record<string, string> = {
  simple: '基础款最不容易出错，先把「干净利落」穿出来就已经很棒了。',
  casual: '休闲运动风舒服自在，活动起来也方便，是日常最稳妥的选择。',
  sweet: '柔和的颜色和材质让人看着舒服，温柔感比复杂款式更重要。',
  business: '干净、挺括是关键，颜色别超过三种，通勤场合就很得体。',
  vintage: '复古靠的是质感和小细节，选一两件点睛单品就够了，不用全身都复古。',
}

// ---------------- 温度带 ----------------

interface BandDef {
  key: string
  min: number
  max: number
  label: string
  reason: string
}

const BANDS: BandDef[] = [
  {
    key: 'hot', min: 28, max: 99, label: '炎热',
    reason: '天热以透气为主，短袖加轻薄下装最安全，不容易闷热。',
  },
  {
    key: 'warm', min: 18, max: 27, label: '温暖',
    reason: '早晚有温差，单件长袖最稳妥，冷热都能应付。',
  },
  {
    key: 'cool', min: 10, max: 17, label: '凉爽',
    reason: '偏凉需要稍厚上衣，长裤能避免受凉。',
  },
  {
    key: 'cold', min: 0, max: 9, label: '寒冷',
    reason: '冷天需要叠穿，外套防风、内搭保暖，最不容易出错。',
  },
  {
    key: 'freezing', min: -99, max: -1, label: '严寒',
    reason: '严寒要优先保暖，羽绒服是最稳妥的选择，别为了好看硬扛。',
  },
]

// ---------------- 风格 × 温度带 × 性别 搭配表 ----------------
// base 为「通用 / 男」方案，female 为女性差异化覆盖（合并到 base 上）。

interface Items {
  top: string
  bottom: string
  shoes: string
}

interface StyleRow {
  base: Items
  female?: Partial<Items>
}

type StyleMatrix = Record<string, Record<string, StyleRow>>

const STYLE_MATRIX: StyleMatrix = {
  simple: {
    hot: {
      base: { top: '简约短袖T恤', bottom: '直筒休闲长裤', shoes: '简约小白鞋' },
      female: { bottom: '高腰A字短裙或短裤（怕晒选薄长裤）' },
    },
    warm: {
      base: { top: '长袖T恤或薄卫衣', bottom: '直筒休闲长裤', shoes: '运动鞋或帆布鞋' },
      female: { bottom: '高腰直筒裤或中长半身裙' },
    },
    cool: {
      base: { top: '卫衣（推荐）或薄针织衫', bottom: '休闲长裤', shoes: '运动鞋' },
      female: { bottom: '直筒长裤（怕冷可配中长裙加打底袜）' },
    },
    cold: {
      base: { top: '毛衣 + 外套', bottom: '加绒长裤', shoes: '运动鞋或靴子' },
    },
    freezing: {
      base: { top: '羽绒服 + 毛衣', bottom: '加绒长裤', shoes: '保暖靴' },
    },
  },
  casual: {
    hot: {
      base: { top: '速干运动T恤', bottom: '运动短裤或束脚运动裤', shoes: '跑步鞋' },
      female: { bottom: '运动短裤或速干运动裤' },
    },
    warm: {
      base: { top: '薄卫衣（连帽更休闲）', bottom: '束脚运动裤', shoes: '运动鞋' },
    },
    cool: {
      base: { top: '加绒卫衣或运动外套', bottom: '运动长裤', shoes: '运动鞋' },
    },
    cold: {
      base: { top: '抓绒卫衣 + 冲锋外套', bottom: '加绒运动裤', shoes: '运动鞋或保暖靴' },
    },
    freezing: {
      base: { top: '加厚羽绒服（内搭抓绒卫衣）', bottom: '加绒运动裤', shoes: '雪地靴或保暖运动鞋' },
    },
  },
  sweet: {
    hot: {
      base: { top: '浅色短袖衬衫', bottom: '浅色休闲长裤', shoes: '帆布鞋' },
      female: { top: '泡泡袖或系带浅色上衣', bottom: '碎花及膝半身裙', shoes: '玛丽珍鞋或小白鞋' },
    },
    warm: {
      base: { top: '薄针织开衫内搭T恤', bottom: '休闲长裤', shoes: '帆布鞋' },
      female: { top: '薄针织开衫', bottom: '百褶中长半身裙', shoes: '小白鞋' },
    },
    cool: {
      base: { top: '柔软毛衣或针织衫', bottom: '长裤', shoes: '平底鞋或运动鞋' },
      female: { bottom: '中长半身裙配打底袜' },
    },
    cold: {
      base: { top: '毛衣 + 呢子大衣', bottom: '加绒长裤', shoes: '短靴' },
      female: { bottom: '加绒打底裤配半身裙，或直接加绒长裤' },
    },
    freezing: {
      base: { top: '长款羽绒服 + 毛衣', bottom: '加绒长裤', shoes: '雪地靴' },
      female: { bottom: '加绒打底裤配加绒裙' },
    },
  },
  business: {
    hot: {
      base: { top: '短袖Polo衫', bottom: '薄款西裤', shoes: '乐福鞋' },
      female: { top: '短袖衬衫', bottom: '西装短裙或薄款西裤', shoes: '低跟乐福鞋' },
    },
    warm: {
      base: { top: '长袖衬衫（可挽袖）', bottom: '休闲西裤', shoes: '乐福鞋' },
    },
    cool: {
      base: { top: '针织衫或薄西装外套', bottom: '西装长裤', shoes: '皮鞋' },
    },
    cold: {
      base: { top: '衬衫 + 西装或呢大衣', bottom: '加绒西裤', shoes: '皮鞋或短靴' },
    },
    freezing: {
      base: { top: '长款羽绒服（内搭衬衫毛衣）', bottom: '加绒西裤', shoes: '保暖皮靴' },
    },
  },
  vintage: {
    hot: {
      base: { top: '复古翻领短袖衬衫', bottom: '直筒亚麻长裤', shoes: '复古板鞋或皮质凉鞋' },
      female: { bottom: '高腰半身裙' },
    },
    warm: {
      base: { top: '格纹衬衫', bottom: '直筒休闲长裤', shoes: '复古帆布鞋' },
    },
    cool: {
      base: { top: '针织开衫或灯芯绒衬衫', bottom: '灯芯绒长裤', shoes: '复古皮鞋' },
    },
    cold: {
      base: { top: '复古毛衣 + 毛呢外套', bottom: '加绒直筒裤', shoes: '复古短靴' },
    },
    freezing: {
      base: { top: '格纹羽绒服或复古大衣 + 毛衣', bottom: '加绒直筒裤', shoes: '复古雪地靴' },
    },
  },
}

// ---------------- 年龄 ----------------

/** 年龄字符串 → 年龄段文案（用于生图提示词，让模特年龄更贴近用户） */
export function ageBandText(age: string): string {
  const n = parseInt(age, 10)
  if (!n || Number.isNaN(n)) return '年轻人'
  if (n <= 17) return '青少年'
  if (n <= 25) return '青年大学生'
  if (n <= 35) return '年轻上班族'
  return '成熟稳重的成年人'
}

/** 年龄偏小（未成年），更需要注意保暖 */
function isYoung(age: string): boolean {
  const n = parseInt(age, 10)
  return !!n && !Number.isNaN(n) && n <= 17
}

// ---------------- 天气派生量 ----------------

/** 当天温差（最高 - 最低），无预报数据时返回 null */
function tempRange(weather: WeatherInfo): number | null {
  if (weather.tempMax == null || weather.tempMin == null) {
    return null
  }
  return Math.max(0, Math.round(weather.tempMax - weather.tempMin))
}

/** 是否属于「晒、热」的天气（用于防晒 / 透气建议） */
function isHotDay(weather: WeatherInfo): boolean {
  const high = weather.tempMax != null ? weather.tempMax : weather.temp
  return high >= 30
}

function isRainy(text: string): boolean {
  return /雨|雷/.test(text)
}

function isSnowy(text: string): boolean {
  return /雪/.test(text)
}

// ---------------- 规则计算 ----------------

/** 温度锚点：以体感为主，向白天最高温适度靠拢（避免清晨/傍晚按低温过度穿衣），青少年再略偏暖 */
function anchorTemp(weather: WeatherInfo, age: string): number {
  let anchor = weather.feelsLike
  const high = weather.tempMax
  if (high != null && high > anchor) {
    // 白天会转暖：锚点取当前体感与白天最高温的中点，兼顾早晚
    anchor = Math.round((anchor + high) / 2)
  }
  if (isYoung(age)) {
    anchor -= 2
  }
  return anchor
}

/** 天气情景适配：大风时补上防风外层 */
function adaptTop(weather: WeatherInfo, top: string, bandKey: string): string {
  const coldish = bandKey === 'cool' || bandKey === 'cold' || bandKey === 'freezing'
  if (weather.windLevel >= 6 && coldish && !/外套|羽绒|大衣|冲锋/.test(top)) {
    return top + ' + 防风外套'
  }
  return top
}

/** 天气情景适配：雨雪时真正换鞋 */
function adaptShoes(weather: WeatherInfo, shoes: string): string {
  if (isSnowy(weather.text)) {
    return '防滑保暖靴（别穿小白鞋、布鞋）'
  }
  if (isRainy(weather.text)) {
    return '防水鞋或深色运动鞋（避免布鞋、小白鞋）'
  }
  return shoes
}

function buildTips(weather: WeatherInfo): string[] {
  const tips: string[] = []
  if (isRainy(weather.text) || isSnowy(weather.text)) {
    tips.push('记得带伞，别让天气影响心情。')
  }
  if (weather.windLevel >= 6) {
    tips.push('风比较大，外层尽量选防风的，体感会好很多。')
  } else if (weather.windLevel >= 5) {
    tips.push('风有点大，出门加件外套更稳妥。')
  }
  if (weather.feelsLike < weather.temp - 3) {
    tips.push('体感比实际温度更冷，可以多穿一件。')
  }
  const range = tempRange(weather)
  if (range != null && range >= 8) {
    tips.push(`今天早晚温差约 ${range}℃，带一件能随时加、脱的外套最保险。`)
  }
  if (isHotDay(weather)) {
    tips.push('日头晒，注意补水防晒，浅色、透气的衣服更凉快。')
  }
  return tips
}

/** 内搭：温度偏低时建议加秋衣，偏高时隐藏该行 */
function getInner(temp: number): string {
  return temp < 20 ? '怕冷加一件秋衣' : ''
}

function findBand(temp: number): BandDef {
  const band = BANDS.find((b) => temp >= b.min && temp <= b.max)
  // 兜底：温度超出常规范围时，取最接近的一端
  return band || (temp > 40 ? BANDS[0] : BANDS[BANDS.length - 1])
}

function resolveStyleKey(style: string): string {
  return STYLE_MATRIX[style] ? style : DEFAULT_STYLE_KEY
}

function styleLabelOf(key: string): string {
  const found = STYLE_OPTIONS.find((s) => s.key === key)
  return found ? found.label : STYLE_OPTIONS[0].label
}

/** 组装「为什么这样穿」：按当天实际情况逐条讲清 */
function buildReason(
  band: BandDef,
  styleKey: string,
  weather: WeatherInfo,
  age: string,
  inner: string
): string {
  const parts: string[] = [band.reason]

  const styleNote = STYLE_NOTES[styleKey]
  if (styleNote) {
    parts.push(styleNote)
  }

  const range = tempRange(weather)
  if (range != null && range >= 8) {
    parts.push(`今天最高和最低相差 ${range}℃，用「能脱的外层」应对早晚最灵活。`)
  }

  if (isSnowy(weather.text)) {
    parts.push('有雪，鞋子优先防滑保暖，别让脚先受凉。')
  } else if (isRainy(weather.text)) {
    parts.push('有雨，鞋子优先防水，浅色布鞋容易湿、也难打理。')
  }

  if (weather.windLevel >= 6) {
    parts.push('风大，外层挡风能明显提升体感温度。')
  }

  if (weather.feelsLike < weather.temp - 3) {
    parts.push('体感比实际温度更冷，说明风或湿气在拉低体感，可以多穿一件。')
  }

  if (isYoung(age)) {
    parts.push('你还在长身体的年纪，宁可多穿一件，也别冻着。')
  }

  if (inner) {
    parts.push('怕冷的话，里面加一件秋衣，比换更厚的外套更管用。')
  }

  return parts.join('\n')
}

/**
 * 生成个性化穿搭方案
 * @param weather 天气（含体感温度、当天最高/最低温）
 * @param profile 用户画像（性别/年龄/风格），可为空
 */
export function recommendOutfit(weather: WeatherInfo, profile?: UserProfile | null): OutfitResult {
  const gender = profile && profile.gender ? profile.gender : ''
  const age = profile && profile.age ? profile.age : ''
  const styleKey = resolveStyleKey((profile && profile.style) || '')
  const styleLabel = styleLabelOf(styleKey)

  const anchor = anchorTemp(weather, age)
  const band = findBand(anchor)

  const row = STYLE_MATRIX[styleKey][band.key]
  let items: Items = { ...row.base }
  if (gender === '女' && row.female) {
    items = { ...items, ...row.female }
  }

  // 天气情景适配：真正改变穿什么，而不只是给提示
  items.top = adaptTop(weather, items.top, band.key)
  items.shoes = adaptShoes(weather, items.shoes)

  const inner = getInner(anchor)

  return {
    top: items.top,
    inner,
    bottom: items.bottom,
    shoes: items.shoes,
    reason: buildReason(band, styleKey, weather, age, inner),
    tips: buildTips(weather),
    styleLabel,
  }
}