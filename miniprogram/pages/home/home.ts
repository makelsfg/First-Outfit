// 首页：今日推荐（温度 × 场合 × 性别 × 偏好） + 时段切换 + 衣柜入口与轻打通 + 城市选择
import { getWeather, getFallbackWeather, requestLocation } from '../../utils/weather'
import type { Coords } from '../../utils/weather'
import {
  recommendOutfits,
  targetWarmth,
  SCENE_OPTIONS,
  allowsFeminine,
  isFeminineItem,
} from '../../utils/outfitRules'
import type { WeatherInfo, OutfitResult, RecommendPrefs } from '../../utils/outfitRules'
import {
  getProfile,
  getCity,
  saveCity,
  clearCity,
  isProfileEmpty,
  isProfileGuideDismissed,
  dismissProfileGuide,
} from '../../utils/storage'
import type { Profile } from '../../utils/storage'
import { avatarOf, applyTheme } from '../../utils/preferences'
import { PROVINCES } from '../../utils/cities'
import type { City, Province } from '../../utils/cities'
import { listWardrobe, pickWardrobe, seasonKeyOf } from '../../utils/wardrobe'
import type { WardrobeItem } from '../../utils/wardrobe'
import { safeNavigateTo, safeSwitchTab } from '../../utils/nav'

type SheetLevel = 'province' | 'city'
type SlotKey = 'now' | 'today' | 'tomorrow'

interface SlotOption {
  key: SlotKey
  label: string
}

const SLOT_OPTIONS: SlotOption[] = [
  { key: 'now', label: '现在' },
  { key: 'today', label: '今天' },
  { key: 'tomorrow', label: '明早' },
]

const EMPTY_PROFILE: Profile = {
  nickname: '',
  gender: '',
  ageBand: '',
  scene: 'daily',
  cold: 'normal',
  travel: 'walk',
  rain: 'auto',
  theme: 'orange',
}

const AUTO_REFRESH_MS = 10 * 60 * 1000
let refreshTimer: ReturnType<typeof setInterval> | null = null

function pad2(n: number): string {
  return n < 10 ? '0' + n : '' + n
}

function medianRange(max?: number | null, min?: number | null): number | null {
  if (max == null || min == null) {
    return null
  }
  return Math.round((max + min) / 2)
}

/** 轻打通：衣柜里「厚薄合适 + 场合匹配」的就直接替换（并标注来源）；不合适则给一句劝退提示 */
function withWardrobe(
  outfit: OutfitResult,
  wardrobe: WardrobeItem[],
  sceneKey: string,
  seasonKey: string,
  target: number,
  gender: string
): OutfitResult {
  // 性别硬边界：非「女」用户，衣柜里的裙装/打底袜等不会被替换进方案
  const usable = allowsFeminine(gender)
    ? wardrobe
    : wardrobe.filter((item) => !isFeminineItem(item.name || ''))
  if (usable.length === 0) {
    return outfit
  }
  const notes: string[] = []
  const pick = (category: string, fallback: string): string => {
    const r = pickWardrobe(usable, category, sceneKey, seasonKey, target)
    if (r.name) {
      return `${r.name}（你衣柜里的）`
    }
    if (r.rejectedName) {
      notes.push(`你衣柜里的「${r.rejectedName}」今天厚薄不太合适，先别穿它。`)
    }
    return fallback
  }
  // 雨雪天的鞋是安全建议，不替换
  const shoesAdapted = /防水|防滑/.test(outfit.shoes)
  const next: OutfitResult = {
    ...outfit,
    top: pick('top', outfit.top),
    coat: outfit.coat ? pick('coat', outfit.coat) : '',
    bottom: pick('bottom', outfit.bottom),
    shoes: shoesAdapted ? outfit.shoes : pick('shoes', outfit.shoes),
  }
  if (notes.length > 0) {
    next.reasonPoints = next.reasonPoints.concat(notes.slice(0, 1))
  }
  return next
}

Page({
  data: {
    loading: true,
    weather: null as WeatherInfo | null,
    outfits: [] as OutfitResult[],
    outfitIndex: 0,
    outfit: null as OutfitResult | null,
    wardrobe: [] as WardrobeItem[],
    warmthTarget: 3,
    dateText: '',
    metaText: '',
    updatedAt: '',
    avatar: '/images/avatar-bear.png',
    theme: 'orange',
    slots: SLOT_OPTIONS,
    slot: 'now' as SlotKey,
    scenes: SCENE_OPTIONS,
    scene: 'daily',
    profile: EMPTY_PROFILE,
    city: null as City | null,
    lastCoords: null as Coords | null,
    provinces: PROVINCES,
    citySheetVisible: false,
    sheetLevel: 'province' as SheetLevel,
    activeProvince: null as Province | null,
    showProfileGuide: false,
  },

  onLoad() {
    this.init()
  },

  async init() {
    const profile = getProfile()
    this.setData({
      profile,
      avatar: avatarOf(profile.gender),
      theme: profile.theme,
      scene: profile.scene,
    })
    applyTheme(profile.theme)

    const saved = getCity()
    if (saved) {
      await this.loadWeather(saved, null)
      this.maybeShowProfileGuide(profile)
      this.refreshWardrobe()
      return
    }

    const coords = await requestLocation()
    await this.loadWeather(null, coords)
    if (!coords) {
      this.promptNoLocation()
    } else {
      this.maybeShowProfileGuide(profile)
    }
    this.refreshWardrobe()
  },

  onShow() {
    const profile = getProfile()
    if (JSON.stringify(profile) !== JSON.stringify(this.data.profile)) {
      const sceneChanged = profile.scene !== this.data.profile.scene
      this.setData({
        profile,
        avatar: avatarOf(profile.gender),
        theme: profile.theme,
        scene: sceneChanged ? profile.scene : this.data.scene,
      })
      applyTheme(profile.theme)
      this.recompute()
    } else {
      applyTheme(this.data.theme)
    }
    this.refreshWardrobe()
    this.startAutoRefresh()
  },

  onHide() {
    this.stopAutoRefresh()
  },

  onUnload() {
    this.stopAutoRefresh()
  },

  startAutoRefresh() {
    this.stopAutoRefresh()
    refreshTimer = setInterval(() => {
      this.onRefresh()
    }, AUTO_REFRESH_MS)
  },

  stopAutoRefresh() {
    if (refreshTimer != null) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
  },

  async loadWeather(city: City | null, coords: Coords | null) {
    this.setData({ city, lastCoords: coords, loading: true })
    let weather: WeatherInfo
    try {
      weather = await getWeather({ city, coords })
    } catch (e) {
      console.error('[weather] 获取失败，已使用兜底数据：', e)
      weather = getFallbackWeather(city ? city.name : undefined)
    }
    this.setData({ weather })
    this.computeOutfit(this.data.profile, weather)
  },

  onRefresh() {
    this.loadWeather(this.data.city, this.data.lastCoords)
  },

  recompute() {
    const weather = this.data.weather
    if (weather) {
      this.computeOutfit(this.data.profile, weather)
    }
  },

  computeOutfit(profile: Profile, weather: WeatherInfo) {
    let tempOverride: number | undefined
    let slotLabel = ''
    if (this.data.slot === 'today') {
      const m = medianRange(weather.tempMax, weather.tempMin)
      if (m != null) {
        tempOverride = m
        slotLabel = '今天'
      }
    } else if (this.data.slot === 'tomorrow') {
      const m = medianRange(weather.tomorrowMax, weather.tomorrowMin)
      if (m != null) {
        tempOverride = m
        slotLabel = '明早'
      }
    }

    const prefs: RecommendPrefs = {
      gender: profile.gender,
      ageBand: profile.ageBand,
      scene: this.data.scene,
      tempOverride,
      slotLabel,
      cold: profile.cold,
      travel: profile.travel,
      rain: profile.rain,
    }
    const outfits = recommendOutfits(weather, prefs)
    const warmthTarget = targetWarmth(weather, prefs)

    const now = new Date()
    const dateText = `${now.getMonth() + 1}月${now.getDate()}日 · ${weather.season}`
    const updatedAt = `${pad2(now.getHours())}:${pad2(now.getMinutes())} 更新`
    const parts = [`体感 ${weather.feelsLike}°`, `风力${weather.windLevel}级`]
    if (weather.tempMax != null && weather.tempMin != null) {
      parts.push(`全天 ${weather.tempMin}-${weather.tempMax}°`)
    }

    this.setData({
      outfits,
      outfitIndex: 0,
      dateText,
      metaText: parts.join(' · '),
      updatedAt,
      warmthTarget,
      loading: false,
    })
    this.applyCurrent()
  },

  /** 把「当前这套」加上衣柜提示后展示 */
  applyCurrent() {
    const o = this.data.outfits[this.data.outfitIndex]
    if (!o) {
      return
    }
    const weather = this.data.weather
    const seasonKey = weather ? seasonKeyOf(weather.season) : ''
    this.setData({
      outfit: withWardrobe(
        o,
        this.data.wardrobe,
        this.data.scene,
        seasonKey,
        this.data.warmthTarget,
        this.data.profile.gender
      ),
    })
  },

  onNextOutfit() {
    const outfits = this.data.outfits
    if (outfits.length <= 1) {
      return
    }
    const index = (this.data.outfitIndex + 1) % outfits.length
    this.setData({ outfitIndex: index })
    this.applyCurrent()
  },

  onSelectSlot(e: WechatMiniprogram.TouchEvent) {
    const key = e.currentTarget.dataset.key as SlotKey
    if (key === this.data.slot) {
      return
    }
    this.setData({ slot: key })
    this.recompute()
  },

  onSelectScene(e: WechatMiniprogram.TouchEvent) {
    const key = String(e.currentTarget.dataset.key)
    if (key === this.data.scene) {
      return
    }
    this.setData({ scene: key })
    this.recompute()
  },

  // ---------------- 衣柜 ----------------

  async refreshWardrobe() {
    try {
      const wardrobe = await listWardrobe()
      this.setData({ wardrobe })
    } catch (e) {
      console.error('[wardrobe] 读取失败：', e)
      this.setData({ wardrobe: [] })
    }
    this.applyCurrent()
  },

  onOpenWardrobe() {
    safeSwitchTab('/pages/wardrobe/wardrobe')
  },

  onOpenSettings() {
    safeSwitchTab('/pages/settings/settings')
  },

  onAddClothing() {
    safeNavigateTo('/pages/wardrobe/edit')
  },

  // ---------------- 入口 ----------------

  onOpenChat() {
    safeNavigateTo('/pages/chat/chat')
  },

  promptNoLocation() {
    wx.showModal({
      title: '没有定位权限',
      content: '无法获取你的位置。你可以手动选择城市，照样能看到当地天气和穿搭。',
      confirmText: '手动选择',
      cancelText: '暂不',
      success: (res) => {
        if (res.confirm) {
          this.onOpenCitySheet()
        }
      },
    })
  },

  // ---------------- 资料引导 ----------------

  maybeShowProfileGuide(profile: Profile) {
    if (isProfileEmpty(profile) && !isProfileGuideDismissed()) {
      this.setData({ showProfileGuide: true })
    }
  },

  onGoProfile() {
    dismissProfileGuide()
    this.setData({ showProfileGuide: false })
    safeSwitchTab('/pages/settings/settings')
  },

  onSkipGuide() {
    dismissProfileGuide()
    this.setData({ showProfileGuide: false })
  },

  // ---------------- 城市选择 ----------------

  onOpenCitySheet() {
    this.setData({ citySheetVisible: true, sheetLevel: 'province', activeProvince: null })
  },

  onCloseCitySheet() {
    this.setData({ citySheetVisible: false })
  },

  onStopTap() {},

  onPickProvince(e: WechatMiniprogram.TouchEvent) {
    const index = Number(e.currentTarget.dataset.index)
    const province = PROVINCES[index]
    if (!province) {
      return
    }
    this.setData({ sheetLevel: 'city', activeProvince: province })
  },

  onBackToProvinces() {
    this.setData({ sheetLevel: 'province', activeProvince: null })
  },

  onSelectCity(e: WechatMiniprogram.TouchEvent) {
    const adcode = String(e.currentTarget.dataset.adcode)
    const name = String(e.currentTarget.dataset.name)
    const city: City = { name, adcode }
    saveCity(city)
    this.setData({ citySheetVisible: false })
    this.loadWeather(city, null)
  },

  async onUseAutoLocation() {
    clearCity()
    this.setData({ citySheetVisible: false })
    const coords = await requestLocation()
    await this.loadWeather(null, coords)
    if (!coords) {
      this.promptNoLocation()
    }
  },
})