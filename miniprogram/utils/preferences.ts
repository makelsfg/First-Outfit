// 偏好选项与「偏好 → 规则」映射
export interface PrefOption {
  key: string
  label: string
}

/** 年龄段 */
export const AGE_BANDS: PrefOption[] = [
  { key: 'u18', label: '18岁以下' },
  { key: '18-24', label: '18-24' },
  { key: '25-34', label: '25-34' },
  { key: '35-44', label: '35-44' },
  { key: '45+', label: '45岁以上' },
]

/** 性别（不透露 → 小熊形象） */
export const GENDER_OPTIONS: PrefOption[] = [
  { key: '男', label: '男' },
  { key: '女', label: '女' },
  { key: '不透露', label: '不透露' },
]

/** 怕冷程度 */
export const COLD_OPTIONS: PrefOption[] = [
  { key: 'cold', label: '怕冷' },
  { key: 'normal', label: '正常' },
  { key: 'hot', label: '怕热' },
]

/** 出行方式 */
export const TRAVEL_OPTIONS: PrefOption[] = [
  { key: 'car', label: '驾车' },
  { key: 'walk', label: '步行' },
  { key: 'bike', label: '骑行' },
]

/** 防雨防滑 */
export const RAIN_OPTIONS: PrefOption[] = [
  { key: 'auto', label: '自动' },
  { key: 'safe', label: '保守' },
  { key: 'light', label: '轻量' },
]

/** 主题色 */
export const THEME_OPTIONS: PrefOption[] = [
  { key: 'blue', label: '浅蓝' },
  { key: 'pink', label: '粉色' },
  { key: 'orange', label: '暖橙' },
]

/** 性别 → 默认主题色 */
export function themeOfGender(gender: string): string {
  if (gender === '女') return 'pink'
  if (gender === '男') return 'blue'
  return 'orange'
}

/**
 * 性别 → 首页形象图（640×807 透明 PNG，由 tools/prepare-avatars.py 生成）。
 * 换图时用同名文件覆盖 miniprogram/images/ 下的图片即可，无需改这里。
 */
const AVATAR_BY_GENDER: Record<string, string> = {
  女: '/images/avatar-girl.png',
  男: '/images/avatar-boy.png',
  不透露: '/images/avatar-bear.png',
}

/** 性别 → 形象图路径 */
export function avatarOf(gender: string): string {
  return AVATAR_BY_GENDER[gender] || AVATAR_BY_GENDER['不透露']
}

/** 年龄段是否未成年（18 岁以下），更需要注意保暖 */
export function isYoungBand(key: string): boolean {
  return key === 'u18'
}

/** 怕冷程度 → 温度锚点偏移（℃） */
export function coldOffset(key: string): number {
  if (key === 'cold') return -2
  if (key === 'hot') return 2
  return 0
}

/** 主题背景色（用于导航栏 / 页面底色） */
export function themeBg(theme: string): string {
  if (theme === 'blue') return '#F0F6FF'
  if (theme === 'pink') return '#FFF1F7'
  return '#FFF9F5'
}

/** 主题主色 */
export function themeBrand(theme: string): string {
  if (theme === 'blue') return '#3B82F6'
  if (theme === 'pink') return '#EC4899'
  return '#F59E0B'
}

/** 应用主题到导航栏、窗口背景与 tabBar */
export function applyTheme(theme: string): void {
  const bg = themeBg(theme)
  wx.setNavigationBarColor({
    frontColor: '#000000',
    backgroundColor: bg,
  })
  wx.setBackgroundColor({
    backgroundColor: bg,
    backgroundColorTop: bg,
    backgroundColorBottom: bg,
  })
  try {
    wx.setTabBarStyle({
      color: '#9CA3AF',
      selectedColor: themeBrand(theme),
      backgroundColor: '#FFFFFF',
      borderStyle: 'white',
    })
  } catch (e) {
    // 非 tabBar 页面忽略
  }
}