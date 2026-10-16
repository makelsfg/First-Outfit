// 鼓励语服务（本地版：内置10条随机文案）
// 将来接云开发：改为读 encouragement_library 集合随机抽取

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

export function getRandomEncouragement(): string {
  const index = Math.floor(Math.random() * ENCOURAGEMENTS.length)
  return ENCOURAGEMENTS[index]
}
