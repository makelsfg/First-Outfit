// 本地缓存封装：昵称 / 年龄 / 性别

export interface Profile {
  nickname: string
  age: string
  gender: string
}

const PROFILE_KEY = 'profile'

export function getProfile(): Profile {
  const cached = wx.getStorageSync<Profile>(PROFILE_KEY)
  if (cached && typeof cached === 'object') {
    return {
      nickname: cached.nickname || '',
      age: cached.age || '',
      gender: cached.gender || '',
    }
  }
  return { nickname: '', age: '', gender: '' }
}

export function saveProfile(profile: Profile): void {
  wx.setStorageSync(PROFILE_KEY, profile)
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
