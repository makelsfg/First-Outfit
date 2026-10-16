// 大模型问答服务：阿里云百炼 DashScope（OpenAI 兼容接口）
import { DASHSCOPE_KEY, DASHSCOPE_URL, LLM_MODEL, DEFAULT_SEARCH } from './config'

const SYSTEM_PROMPT = '你是一位温和、耐心的穿衣搭配助手，正在帮助一位刚上大学、因为成长环境原因缺乏基础穿衣常识的年轻人。请始终做到：1) 不评判、不嘲笑，多用「很多人一开始都不懂，这很正常」这类话；2) 给出具体、可执行的建议；3) 解释「为什么」，而不只给结果；4) 语气温暖、鼓励。回答用中文，简洁易懂。'

export function askDress(query: string): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${DASHSCOPE_URL}/chat/completions`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DASHSCOPE_KEY}`,
      },
      data: {
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: query },
        ],
      },
      success: (res) => {
        const data = res.data as {
          choices?: Array<{ message?: { content?: string } }>
        }
        const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
        if (content) {
          resolve(content)
        } else {
          reject(new Error('大模型返回为空'))
        }
      },
      fail: () => {
        reject(new Error('大模型请求失败'))
      },
    })
  })
}

export function getDefaultSearch(): string {
  return DEFAULT_SEARCH
}
