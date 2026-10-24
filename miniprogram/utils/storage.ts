// 本地缓存封装：用户偏好 / 搜索历史 / 手动选择的城市
import type { City } from './cities'

export interface Profile {
  nickname: string  // 昵称
  gender: string    // '男' | '女' | '不透露' | ''
  ageBand: string   // 'u18' | '18-24' | '25-34' | '35-44' | '45+' | ''
  scene: string     // 默认场合 key（见 outfitRules 的 SCENE_OPTIONS）
  cold: string      // 怕冷程度：cold / normal / hot
  travel: string    // 出行方式：car / walk / bike
  rain: string      // 防雨防滑：auto / safe / light
  theme: string     // 主题色：blue / pink / orange
}

const PROFILE_KEY = 'profile'

export const DEFAULT_PROFILE: Profile = {
  nickname: '',
  gender: '',
  ageBand: '',
  scene: 'daily',
  cold: 'normal',
  travel: 'walk',
  rain: 'auto',
  theme: 'orange',
}

export function getProfile(): Profile {
  const cached = wx.getStorageSync<Profile>(PROFILE_KEY)
  if (cached && typeof cached === 'object') {
    return { ...DEFAULT_PROFILE, ...cached }
  }
  return { ...DEFAULT_PROFILE }
}

export function saveProfile(profile: Profile): void {
  wx.setStorageSync(PROFILE_KEY, profile)
}

/** 个性化所需的关键项（性别）是否为空 */
export function isProfileEmpty(profile: Profile): boolean {
  return !profile.gender
}

// ---------- 资料引导弹窗 / 跳转编辑请求 ----------

const GUIDE_KEY = 'profileGuideDismissed'
const EDIT_KEY = 'profileEditRequested'

export function isProfileGuideDismissed(): boolean {
  return !!wx.getStorageSync(GUIDE_KEY)
}

export function dismissProfileGuide(): void {
  wx.setStorageSync(GUIDE_KEY, true)
}

/** 从首页跳到设置页时，让它直接落在偏好区 */
export function requestProfileEdit(): void {
  wx.setStorageSync(EDIT_KEY, true)
}

/** 取出并清空「请求进入编辑」标记 */
export function consumeProfileEditRequest(): boolean {
  const v = !!wx.getStorageSync(EDIT_KEY)
  if (v) {
    wx.removeStorageSync(EDIT_KEY)
  }
  return v
}

// ---------- 搜索历史 ----------

export interface SearchHistoryItem {
  question: string
  answer: string
  time: string
}

const HISTORY_KEY = 'searchHistory'
const MAX_HISTORY = 20

export function getSearchHistory(): SearchHistoryItem[] {
  const cached = wx.getStorageSync<SearchHistoryItem[]>(HISTORY_KEY)
  return Array.isArray(cached) ? cached : []
}

export function addSearchHistory(item: SearchHistoryItem): SearchHistoryItem[] {
  const list = getSearchHistory()
  list.unshift(item)
  const trimmed = list.slice(0, MAX_HISTORY)
  wx.setStorageSync(HISTORY_KEY, trimmed)
  return trimmed
}

export function clearSearchHistory(): void {
  wx.removeStorageSync(HISTORY_KEY)
}

// ---------- 客服对话记录 ----------

export interface ChatRecord {
  role: 'user' | 'ai'
  text: string
  canFold?: boolean
  folded?: boolean
  hidden?: boolean
  quote?: string
}

const CHAT_KEY = 'chatHistory'
/** 最多保留 120 条消息（约 60 轮），超出从头丢弃，避免本地缓存无限增长 */
const MAX_CHAT = 120

export function getChatHistory(): ChatRecord[] {
  const cached = wx.getStorageSync<ChatRecord[]>(CHAT_KEY)
  return Array.isArray(cached) ? cached : []
}

/** 保存对话记录（只留正文与折叠状态，不带流式标记） */
export function saveChatHistory(list: ChatRecord[]): void {
  if (!list || list.length === 0) {
    wx.removeStorageSync(CHAT_KEY)
    return
  }
  wx.setStorageSync(CHAT_KEY, list.slice(-MAX_CHAT))
}

export function clearChatHistory(): void {
  wx.removeStorageSync(CHAT_KEY)
}

// ---------- 手动选择的城市 ----------

const CITY_KEY = 'city'

export function getCity(): City | null {
  const cached = wx.getStorageSync<City>(CITY_KEY)
  if (cached && typeof cached === 'object' && cached.adcode) {
    return { name: cached.name || '', adcode: cached.adcode }
  }
  return null
}

export function saveCity(city: City): void {
  wx.setStorageSync(CITY_KEY, city)
}

export function clearCity(): void {
  wx.removeStorageSync(CITY_KEY)
}