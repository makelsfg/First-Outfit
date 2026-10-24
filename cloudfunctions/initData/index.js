// 云函数 initData：初始化云数据库集合与鼓励语文案库（幂等）
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const ENCOURAGEMENTS = [
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

// llm_stream：客服助手流式输出的中转集合（客户端建文档、云函数写增量、用完即删）
const COLLECTIONS = [
  'checkin_records',
  'encouragement_library',
  'feedback',
  'wardrobe_items',
  'llm_stream',
]

exports.main = async () => {
  const result = { collections: [], seeded: false }

  // 1. 创建集合（已存在会报错，忽略即可）
  for (const name of COLLECTIONS) {
    try {
      await db.createCollection(name)
      result.collections.push(`${name}:created`)
    } catch (e) {
      result.collections.push(`${name}:exists`)
    }
  }

  // 2. 文案库为空时才写入，避免重复
  try {
    const countRes = await db.collection('encouragement_library').count()
    if (countRes.total === 0) {
      for (const content of ENCOURAGEMENTS) {
        await db.collection('encouragement_library').add({ data: { content } })
      }
      result.seeded = true
    }
  } catch (e) {
    result.seeded = false
    result.error = e.message
  }

  console.log('[initData]', JSON.stringify(result))
  return result
}
