// 本地缓存封装：昵称 / 年龄 / 性别 / 手动选择的城市

import type { City } from './cities'

export interface Profile {
  nickname: string
  age: string
  gender: string
  style: string // 风格 key，见 utils/outfitRules 的 STYLE_OPTIONS
}

const PROFILE_KEY = 'profile'

export function getProfile(): Profile {
  const cached = wx.getStorageSync<Profile>(PROFILE_KEY)
  if (cached && typeof cached === 'object') {
    return {
      nickname: cached.nickname || '',
      age: cached.age || '',
      gender: cached.gender || '',
      style: cached.style || '',
    }
  }
  return { nickname: '', age: '', gender: '', style: '' }
}

export function saveProfile(profile: Profile): void {
  wx.setStorageSync(PROFILE_KEY, profile)
}

/** 个性化所需的关键项（性别 / 风格）是否都为空 */
export function isProfileEmpty(profile: Profile): boolean {
  return !profile.gender && !profile.style
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

/** 从首页跳到「我的」页时，让它自动进入编辑态 */
export function requestProfileEdit(): void {
  wx.setStorageSync(EDIT_KEY, true)
}

/** 取出并清空「请求进入编辑态」标记 */
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
