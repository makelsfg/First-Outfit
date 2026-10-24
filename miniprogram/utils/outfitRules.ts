// 穿搭规则引擎：温度区间 / 天气 / 性别 / 年龄段 / 场合 / 偏好 → 穿搭方案
// 设计原则：确定性、可解释、有兜底。不联网也能给出方案。
// 组织方式：温度带 × 场合 × 性别；每个「温度带 × 场合」给出 3 套（供「换一套」循环）。

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
  tomorrowMax?: number // 明日白天最高温（可能为空）
  tomorrowMin?: number // 明日夜间最低温（可能为空）
}

export interface OutfitResult {
  top: string             // 上装
  coat: string            // 外套（空字符串表示不穿外套）
  inner: string           // 内搭（空字符串时前端隐藏该行）
  bottom: string          // 下装
  shoes: string           // 鞋子
  summary: string         // 一句话结论（首页顶部展示）
  sceneTag: string        // 场合标签
  reasonPoints: string[]  // 「推荐理由」要点列表
  tips: string[]          // 特殊天气提醒
  sceneLabel: string      // 本次使用的场合名
  variantLabel: string    // 这一套的定位：推荐 / 更保暖 / 更轻便 / 换个样式
}

/** 推荐偏好（来自本地设置），允许字段为空 */
export interface RecommendPrefs {
  gender?: string       // '男' | '女' | '不透露' | ''
  ageBand?: string      // 年龄段 key（'u18' 视为未成年）
  scene?: string        // 场合 key，默认「日常」
  tempOverride?: number // 时段温度（今天 / 明早传区间中位数）
  slotLabel?: string    // 时段名（如「今天」「明早」），用于理由文案
  cold?: string         // 怕冷程度：cold / normal / hot
  travel?: string       // 出行方式：car / walk / bike
  rain?: string         // 防雨防滑：auto / safe / light
}

// ---------------- 场合选项 ----------------

export interface SceneOption {
  key: string
  label: string
}

export const SCENE_OPTIONS: SceneOption[] = [
  { key: 'daily', label: '日常' },
  { key: 'date', label: '约会' },
  { key: 'sport', label: '运动' },
  { key: 'party', label: '聚会' },
  { key: 'formal', label: '正式' },
]

const DEFAULT_SCENE_KEY = 'daily'
/** 每个「温度带 × 场合」提供几套方案 */
const VARIANT_COUNT = 3

/** 场合 → 一句「为什么这样穿」的补充说明（不评判、给兜底） */
const SCENE_NOTES: Record<string, string> = {
  daily: '日常以舒服、不出错为主，基础款最稳妥。',
  date: '约会稍微用点心就行，颜色柔和、干净整洁就很加分。',
  sport: '运动优先透气、排汗和好活动，别穿太紧或太厚重的衣服。',
  party: '聚会可以亮一点，选一件有存在感的单品就够，不用全身都抢眼。',
  formal: '正式场合干净、挺括是关键，颜色别超过三种，尽量别穿运动鞋。',
}

// ---------------- 温度带 ----------------

interface BandDef {
  key: string
  min: number
  max: number
  label: string
  feel: string
  reason: string
  summaryTemplate: string
}

const BANDS: BandDef[] = [
  {
    key: 'hot', min: 28, max: 99, label: '炎热', feel: '偏热',
    reason: '天热以透气为主，短袖加轻薄下装最安全，不容易闷热。',
    summaryTemplate: '天气炎热，{scene}穿轻薄透气的短袖最舒服',
  },
  {
    key: 'warm', min: 18, max: 27, label: '温暖', feel: '温和',
    reason: '早晚有温差，单件长袖最稳妥，冷热都能应付。',
    summaryTemplate: '温度舒适，{scene}一件长袖就够，早晚可备薄外套',
  },
  {
    key: 'cool', min: 10, max: 17, label: '凉爽', feel: '微凉',
    reason: '偏凉需要稍厚上衣，长裤能避免受凉。',
    summaryTemplate: '温度适中，{scene}建议搭配薄外套/开衫（易穿脱）',
  },
  {
    key: 'cold', min: 0, max: 9, label: '寒冷', feel: '偏冷',
    reason: '冷天需要叠穿，外套防风、内搭保暖，最不容易出错。',
    summaryTemplate: '天气偏冷，{scene}记得叠穿：外层防风、内搭保暖',
  },
  {
    key: 'freezing', min: -99, max: -1, label: '严寒', feel: '严寒',
    reason: '严寒要优先保暖，羽绒服是最稳妥的选择，别为了好看硬扛。',
    summaryTemplate: '天气严寒，{scene}优先保暖，羽绒服最稳妥',
  },
]

/** 各温度带对应的「目标厚薄」（1~5），用于判断衣柜里的衣服是否适合今天 */
const BAND_TARGET_WARMTH: Record<string, number> = {
  hot: 1.5, warm: 2.5, cool: 3, cold: 4, freezing: 5,
}

export function bandTargetWarmth(bandKey: string): number {
  return BAND_TARGET_WARMTH[bandKey] || 3
}

// ---------------- 温度带 × 场合 搭配表 ----------------

interface SceneRow {
  tops: string[]
  coats?: string[]
  bottoms: string[]
  shoes: string[]
  female?: {
    tops?: string[]
    coats?: string[]
    bottoms?: string[]
    shoes?: string[]
  }
}

type OutfitMatrix = Record<string, Record<string, SceneRow>>

const OUTFITS: OutfitMatrix = {
  hot: {
    daily: {
      tops: ['简约短袖T恤', '纯色短袖衬衫'],
      bottoms: ['直筒休闲长裤', '休闲短裤'],
      shoes: ['小白鞋', '帆布鞋'],
      female: { bottoms: ['高腰A字短裙', '高腰短裤（怕晒选薄长裤）'] },
    },
    date: {
      tops: ['浅色短袖衬衫', '纯色短袖衬衫'],
      bottoms: ['休闲长裤', '直筒休闲裤'],
      shoes: ['小白鞋', '帆布鞋'],
      female: {
        tops: ['泡泡袖或系带浅色上衣'],
        bottoms: ['碎花及膝半身裙'],
        shoes: ['小白鞋', '玛丽珍鞋'],
      },
    },
    sport: {
      tops: ['速干运动T恤', '宽松运动T恤'],
      bottoms: ['运动短裤', '速干运动长裤'],
      shoes: ['跑步鞋'],
      female: { bottoms: ['运动短裤', '速干运动长裤'] },
    },
    party: {
      tops: ['短袖衬衫', '亮色短袖T恤'],
      bottoms: ['休闲长裤', '直筒休闲裤'],
      shoes: ['小白鞋', '帆布鞋'],
      female: { bottoms: ['半身裙', '休闲长裤'] },
    },
    formal: {
      tops: ['短袖衬衫', '短袖Polo衫'],
      bottoms: ['薄款西裤'],
      shoes: ['乐福鞋', '皮质小白鞋'],
      female: { tops: ['短袖衬衫'], bottoms: ['西装短裙', '薄款西裤'] },
    },
  },
  warm: {
    daily: {
      tops: ['长袖T恤', '薄卫衣'],
      bottoms: ['直筒休闲长裤', '休闲长裤'],
      shoes: ['运动鞋', '帆布鞋'],
      female: { bottoms: ['高腰直筒裤', '中长半身裙'] },
    },
    date: {
      tops: ['薄针织开衫内搭T恤', '浅色长袖衬衫'],
      bottoms: ['直筒长裤', '休闲西裤'],
      shoes: ['小白鞋', '乐福鞋'],
      female: { tops: ['薄针织开衫'], bottoms: ['中长半身裙'] },
    },
    sport: {
      tops: ['薄卫衣（连帽）', '长袖运动衫'],
      bottoms: ['束脚运动裤', '运动长裤'],
      shoes: ['运动鞋'],
    },
    party: {
      tops: ['长袖衬衫', '薄针织衫'],
      bottoms: ['休闲长裤', '直筒休闲裤'],
      shoes: ['小白鞋', '帆布鞋'],
      female: { bottoms: ['半身裙'] },
    },
    formal: {
      tops: ['长袖衬衫（可挽袖）', '薄针织衫'],
      bottoms: ['休闲西裤'],
      shoes: ['乐福鞋', '皮鞋'],
    },
  },
  cool: {
    daily: {
      tops: ['薄针织衫', '长袖衬衫'],
      coats: ['薄外套/开衫（易穿脱）', '薄风衣'],
      bottoms: ['直筒休闲长裤', '牛仔裤'],
      shoes: ['运动鞋', '小白鞋'],
      female: { bottoms: ['直筒长裤', '中长半身裙'] },
    },
    date: {
      tops: ['薄毛衣', '薄针织衫'],
      coats: ['薄风衣', '薄开衫'],
      bottoms: ['休闲长裤', '直筒长裤'],
      shoes: ['小白鞋', '乐福鞋'],
      female: {
        coats: ['温柔色长款开衫', '薄风衣'],
        bottoms: ['中长半身裙配打底袜', '长裤'],
        shoes: ['平底鞋'],
      },
    },
    sport: {
      tops: ['薄卫衣', '运动长袖'],
      coats: ['薄夹克或运动外套'],
      bottoms: ['运动长裤'],
      shoes: ['运动鞋'],
    },
    party: {
      tops: ['长袖衬衫', '薄针织衫'],
      coats: ['薄西装外套', '短夹克'],
      bottoms: ['休闲长裤', '直筒休闲裤'],
      shoes: ['小白鞋', '短靴'],
      female: { bottoms: ['半身裙'] },
    },
    formal: {
      tops: ['长袖衬衫', '薄针织衫'],
      coats: ['薄西装外套'],
      bottoms: ['西装长裤'],
      shoes: ['乐福鞋', '皮鞋'],
    },
  },
  cold: {
    daily: {
      tops: ['毛衣', '加绒卫衣'],
      coats: ['外套（防风保暖）', '呢子大衣'],
      bottoms: ['加绒长裤'],
      shoes: ['运动鞋', '短靴'],
    },
    date: {
      tops: ['毛衣', '针织衫'],
      coats: ['呢子大衣', '棉服'],
      bottoms: ['加绒长裤', '加绒休闲裤'],
      shoes: ['短靴'],
      female: {
        tops: ['软糯针织衫'],
        coats: ['软绒短外套'],
        bottoms: ['加绒打底裤配半身裙'],
      },
    },
    sport: {
      tops: ['抓绒卫衣'],
      coats: ['冲锋外套'],
      bottoms: ['加绒运动裤'],
      shoes: ['运动鞋', '保暖靴'],
    },
    party: {
      tops: ['毛衣', '针织衫'],
      coats: ['呢子大衣', '短款棉服'],
      bottoms: ['加绒长裤'],
      shoes: ['短靴'],
    },
    formal: {
      tops: ['衬衫 + 针织衫'],
      coats: ['西装或呢大衣'],
      bottoms: ['加绒西裤'],
      shoes: ['皮鞋', '短靴'],
    },
  },
  freezing: {
    daily: {
      tops: ['毛衣', '加绒针织衫'],
      coats: ['羽绒服', '厚棉服'],
      bottoms: ['加绒长裤'],
      shoes: ['保暖靴', '雪地靴'],
    },
    date: {
      tops: ['毛衣'],
      coats: ['长款羽绒服', '毛领棉服'],
      bottoms: ['加绒长裤'],
      shoes: ['雪地靴'],
      female: { bottoms: ['加绒打底裤配加绒裙', '加绒长裤'] },
    },
    sport: {
      tops: ['抓绒卫衣'],
      coats: ['加厚羽绒服'],
      bottoms: ['加绒运动裤'],
      shoes: ['雪地靴', '保暖运动鞋'],
    },
    party: {
      tops: ['毛衣', '加绒针织衫'],
      coats: ['羽绒服', '长款大衣'],
      bottoms: ['加绒长裤'],
      shoes: ['保暖靴'],
    },
    formal: {
      tops: ['衬衫 + 毛衣'],
      coats: ['羊毛大衣（内加羽绒）', '长款羽绒服'],
      bottoms: ['加绒西裤'],
      shoes: ['保暖皮靴'],
    },
  },
}

// ---------------- 性别边界（硬约束） ----------------

/**
 * 明确只属于女装的词：裙子、打底袜/打底裤这类只有女装才有的单品，以及一眼女装的鞋和工艺。
 * 规则是硬边界——只要用户没有明确选「女」，就绝不出现这些单品（「不透露」按不穿裙装处理）。
 */
const FEMININE_PATTERN = /裙|打底袜|打底裤|玛丽珍|泡泡袖|碎花|吊带|高跟鞋|一字肩|露肩|蕾丝|雪纺/

/** 该性别是否允许使用女装单品（只有明确选「女」才允许） */
export function allowsFeminine(gender: string): boolean {
  return gender === '女'
}

/** 单品名是否属于女装 */
export function isFeminineItem(name: string): boolean {
  return FEMININE_PATTERN.test(name || '')
}

/** 兜底款：某一类单品被性别规则全部过滤掉时使用，保证永远能给出方案 */
const SAFE_FALLBACK = {
  tops: ['基础款上衣'],
  coats: ['外套'],
  bottoms: ['直筒休闲长裤'],
  shoes: ['运动鞋'],
}

/** 过滤掉与性别不符的单品；全部被过滤掉时退回兜底款（数据写错也不会漏出女装） */
function genderSafe(list: string[], gender: string, slot: keyof typeof SAFE_FALLBACK): string[] {
  if (!list || list.length === 0) {
    return SAFE_FALLBACK[slot]
  }
  if (allowsFeminine(gender)) {
    return list
  }
  const kept = list.filter((item) => !isFeminineItem(item))
  return kept.length ? kept : SAFE_FALLBACK[slot]
}

// ---------------- 偏好派生量 ----------------

/** 是否未成年（18 岁以下），更需要注意保暖 */
function isYoung(ageBand: string): boolean {
  return ageBand === 'u18'
}

/** 怕冷程度 → 温度锚点偏移（℃） */
function coldShift(cold: string): number {
  if (cold === 'cold') return -2
  if (cold === 'hot') return 2
  return 0
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

/** 是否需要提醒带伞（受「防雨防滑」偏好影响） */
function needUmbrella(text: string, rainPref: string): boolean {
  if (rainPref === 'light') {
    return /雨|雪/.test(text)
  }
  if (rainPref === 'safe') {
    return /雨|雪|雷|阴|云/.test(text)
  }
  // auto
  return /雨|雪|雷/.test(text)
}

// ---------------- 规则计算 ----------------

/**
 * 温度锚点
 * @param override 时段温度（「今天 / 明早」传入区间中位数；不传则用实时体感并向白天最高温适度靠拢）
 */
function anchorTemp(weather: WeatherInfo, prefs: RecommendPrefs, override?: number): number {
  let anchor: number
  if (override != null) {
    anchor = override
  } else {
    anchor = weather.feelsLike
    const high = weather.tempMax
    if (high != null && high > anchor) {
      anchor = Math.round((anchor + high) / 2)
    }
  }
  if (isYoung(prefs.ageBand || '')) {
    anchor -= 2
  }
  anchor += coldShift(prefs.cold || '')
  return anchor
}

/** 天气情景适配：大风时给外层补上防风（骑行时更敏感） */
function adaptCoat(weather: WeatherInfo, coat: string, bandKey: string, travel: string): string {
  const coldish = bandKey === 'cool' || bandKey === 'cold' || bandKey === 'freezing'
  const threshold = travel === 'bike' ? 5 : 6
  if (weather.windLevel >= threshold && coldish) {
    return coat ? `${coat}（选防风的）` : '防风外套'
  }
  return coat
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

function buildTips(weather: WeatherInfo, prefs: RecommendPrefs): string[] {
  const tips: string[] = []
  if (needUmbrella(weather.text, prefs.rain || 'auto')) {
    tips.push('记得带伞，别让天气影响心情。')
  }
  const windTipAt = prefs.travel === 'bike' ? 4 : 6
  if (weather.windLevel >= windTipAt) {
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
  return band || (temp > 40 ? BANDS[0] : BANDS[BANDS.length - 1])
}

function resolveSceneKey(scene: string): string {
  return OUTFITS[BANDS[0].key][scene] ? scene : DEFAULT_SCENE_KEY
}

function sceneLabelOf(key: string): string {
  const found = SCENE_OPTIONS.find((s) => s.key === key)
  return found ? found.label : SCENE_OPTIONS[0].label
}

/** 按索引取列表项（循环复用，保证每套都有值） */
function pick(list: string[], index: number): string {
  return list[index % list.length]
}

interface BuildCtx {
  band: BandDef
  sceneKey: string
  weather: WeatherInfo
  prefs: RecommendPrefs
  gender: string
  anchor: number
  temp: number
  slotLabel: string
}

/** 组装「推荐理由」要点：按当天实际情况逐条讲清 */
function buildReasonPoints(ctx: BuildCtx, inner: string, coat: string): string[] {
  const { band, weather, prefs, temp, slotLabel } = ctx
  const first = slotLabel
    ? `${slotLabel}约 ${temp}℃，${band.feel}`
    : `体感温度 ${weather.feelsLike}℃，${band.feel}`
  const points: string[] = [first, band.reason]

  const sceneNote = SCENE_NOTES[ctx.sceneKey]
  if (sceneNote) {
    points.push(sceneNote)
  }

  if (prefs.cold === 'cold') {
    points.push('你比较怕冷，温度上我调低了一点来给你留余量。')
  } else if (prefs.cold === 'hot') {
    points.push('你比较怕热，推荐会稍微轻便一点。')
  }

  if (coat) {
    points.push(`外层选「${coat}」，室内外切换时方便穿脱。`)
  }

  if (prefs.travel === 'bike' && weather.windLevel >= 4) {
    points.push('骑行时风感更强，外层一定要挡风。')
  }

  const range = tempRange(weather)
  if (range != null && range >= 8) {
    points.push(`今天最高和最低相差 ${range}℃，用「能脱的外层」应对早晚最灵活。`)
  }

  if (isSnowy(weather.text)) {
    points.push('有雪，鞋子优先防滑保暖，别让脚先受凉。')
  } else if (isRainy(weather.text)) {
    points.push('有雨，鞋子优先防水，浅色布鞋容易湿、也难打理。')
  }

  if (weather.windLevel >= 6) {
    points.push('风大，外层挡风能明显提升体感温度。')
  }

  if (weather.feelsLike < weather.temp - 3) {
    points.push('体感比实际温度更冷，说明风或湿气在拉低体感，可以多穿一件。')
  }

  if (isYoung(prefs.ageBand || '')) {
    points.push('你还在长身体的年纪，宁可多穿一件，也别冻着。')
  }

  if (inner) {
    points.push('怕冷的话，里面加一件秋衣，比换更厚的外套更管用。')
  }

  return points
}

/** 生成指定套号的一套方案 */
function buildOutfit(ctx: BuildCtx, variantIndex: number): OutfitResult {
  const { band, sceneKey, weather, prefs, gender } = ctx
  const row = OUTFITS[band.key][sceneKey]
  const female = gender === '女' ? row.female : undefined

  const tops = genderSafe((female && female.tops) || row.tops, gender, 'tops')
  const coats = (female && female.coats) || row.coats
  const bottoms = genderSafe((female && female.bottoms) || row.bottoms, gender, 'bottoms')
  const shoesList = genderSafe((female && female.shoes) || row.shoes, gender, 'shoes')

  const coat = adaptCoat(
    weather,
    coats ? pick(genderSafe(coats, gender, 'coats'), variantIndex) : '',
    band.key,
    prefs.travel || ''
  )
  const shoes = adaptShoes(weather, pick(shoesList, variantIndex))
  const inner = getInner(ctx.anchor)
  const sceneLabel = sceneLabelOf(sceneKey)

  return {
    top: pick(tops, variantIndex),
    coat,
    inner,
    bottom: pick(bottoms, variantIndex),
    shoes,
    summary: band.summaryTemplate.replace('{scene}', `${sceneLabel}场景`),
    sceneTag: sceneLabel,
    reasonPoints: buildReasonPoints(ctx, inner, coat),
    tips: buildTips(weather, prefs),
    sceneLabel,
    variantLabel: '',
  }
}

/** 粗略判断一件单品的厚薄（1~5），用于给「换一套」贴差异标签 */
function roughWarmth(text: string): number {
  if (/羽绒|棉服|厚棉/.test(text)) return 5
  if (/大衣|呢子|毛呢|加绒/.test(text)) return 4
  if (/毛衣|针织|卫衣|夹克|冲锋|风衣|开衫|西装外套/.test(text)) return 3
  if (/长袖|衬衫|薄外套|薄开衫|薄风衣/.test(text)) return 2
  if (/短袖|T恤|短裤|凉鞋|短裙/.test(text)) return 1
  return 2
}

/** 一整套的厚薄估计 */
function variantWarmth(o: OutfitResult): number {
  return roughWarmth(o.top) + (o.coat ? roughWarmth(o.coat) : 0) + roughWarmth(o.bottom) * 0.5
}

/** 给多套方案排序并贴标签：与今天「目标厚薄」最接近的一套排第一，标为「推荐」 */
function labelVariants(list: OutfitResult[], target: number): OutfitResult[] {
  if (list.length <= 1) {
    return list
  }
  const withW = list.map((o) => ({ o, w: variantWarmth(o) }))
  withW.sort((a, b) => Math.abs(a.w - target) - Math.abs(b.w - target))
  const base = withW[0].w
  return withW.map((item, i) => {
    if (i === 0) {
      return { ...item.o, variantLabel: '推荐' }
    }
    const diff = item.w - base
    const label = diff >= 0.8 ? '更保暖' : diff <= -0.8 ? '更轻便' : '换个样式'
    return { ...item.o, variantLabel: label }
  })
}

/**
 * 生成个性化穿搭方案：同一「温度带 × 场合」下的多套搭配（供「换一套」循环）
 */
export function recommendOutfits(weather: WeatherInfo, prefs?: RecommendPrefs | null): OutfitResult[] {
  const p: RecommendPrefs = prefs || {}
  const sceneKey = resolveSceneKey(p.scene || '')
  const tempOverride = p.tempOverride
  const temp = tempOverride != null ? tempOverride : weather.feelsLike
  const anchor = anchorTemp(weather, p, tempOverride)
  const band = findBand(anchor)

  const ctx: BuildCtx = {
    band,
    sceneKey,
    weather,
    prefs: p,
    gender: p.gender || '',
    anchor,
    temp,
    slotLabel: p.slotLabel || '',
  }

  const list: OutfitResult[] = []
  for (let i = 0; i < VARIANT_COUNT; i++) {
    list.push(buildOutfit(ctx, i))
  }
  return labelVariants(list, bandTargetWarmth(band.key))
}

/** 只取第一套（兼容旧调用 / 打卡记录） */
export function recommendOutfit(weather: WeatherInfo, prefs?: RecommendPrefs | null): OutfitResult {
  return recommendOutfits(weather, prefs)[0]
}

/** 今天需要的「目标厚薄」（1~5），用于判断衣柜里的衣服合不合适 */
export function targetWarmth(weather: WeatherInfo, prefs?: RecommendPrefs | null): number {
  const p: RecommendPrefs = prefs || {}
  const anchor = anchorTemp(weather, p, p.tempOverride)
  return bandTargetWarmth(findBand(anchor).key)
}