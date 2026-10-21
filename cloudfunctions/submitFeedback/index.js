// 云函数 submitFeedback：保存用户反馈到 feedback 集合
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const content = String(event.content || '').trim()
  if (!content) {
    throw new Error('反馈内容不能为空')
  }
  if (content.length > 500) {
    throw new Error('反馈内容过长')
  }

  const wxContext = cloud.getWXContext()
  // 转成北京时间便于查看
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const createTimeStr = now.toISOString().replace('T', ' ').slice(0, 19)

  const res = await db.collection('feedback').add({
    data: {
      content,
      openid: wxContext.OPENID || '',
      createTime: Date.now(),
      createTimeStr,
    },
  })

  return { ok: true, id: res._id }
}
