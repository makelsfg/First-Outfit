// 大模型问答服务：通过云函数调用（API Key 保存在云函数，前端不可见）
import { CLOUD_ENV, DEFAULT_SEARCH } from './config'
import type { WeatherInfo } from './outfitRules'

/**
 * 提问穿搭问题
 * @param query 用户问题
 * @param weather 当前城市天气（用于让模型知道真实日期/地点/天气）
 */
export async function askDress(query: string, weather?: WeatherInfo | null): Promise<string> {
  const res = await wx.cloud.callFunction({
    name: 'askLLM',
    data: {
      query,
      weather: weather || null,
    },
    config: { env: CLOUD_ENV },
  })
  const result = res.result as { answer?: string } | undefined
  if (!result || !result.answer) {
    throw new Error('大模型返回为空')
  }
  return result.answer
}

export function getDefaultSearch(): string {
  return DEFAULT_SEARCH
}
