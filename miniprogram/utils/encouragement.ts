// 鼓励语服务：优先从云数据库 encouragement_library 随机读取，失败用内置文案兜底
import { CLOUD_ENV } from './config'

const FALLBACKS = [
  '今日份的帅气已存档，继续保持！',
  '穿搭没你想得那么难，你已经迈出了一大步。',
  '认真穿衣的你，真的在闪闪发光。',
  '慢慢来，你正在一点点变好。',
  '今天也穿得很得体，给自己点个赞。',
  '会照顾自己的人，运气都不会太差。',
  '每一次记录，都是你在认真生活的证明。',
  '穿搭是给自己看的，舒服最重要。',
  '你已经比昨天的自己更懂穿搭了。',
  '不着急，好看的你会一点一点练出来的。',
]

export async function getRandomEncouragement(): Promise<string> {
  try {
    const res = await wx.cloud
      .database({ env: CLOUD_ENV })
      .collection('encouragement_library')
      .get()
    const list = res.data as Array<{ content?: string }>
    if (list.length > 0) {
      const index = Math.floor(Math.random() * list.length)
      const content = list[index].content
      if (content) {
        return content
      }
    }
  } catch (e) {
    // 读库失败，走内置兜底
  }
  const index = Math.floor(Math.random() * FALLBACKS.length)
  return FALLBACKS[index]
}
