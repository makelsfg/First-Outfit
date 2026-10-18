// 全局常量配置
// 注意：天气与大模型的 API Key 已迁移到云函数（cloudfunctions/getWeather、askLLM），
// 前端不再保存任何密钥。

// ---------- 微信云开发 ----------
export const CLOUD_ENV = 'kaifa-d1gyijyx99ac64783'

/** 默认城市（定位失败时的兜底） */
export const DEFAULT_CITY = '北京'
export const DEFAULT_ADCODE = '110000'

/** 搜索页默认搜索词 */
export const DEFAULT_SEARCH = '这个季节穿啥衣服'

/** 主题色 */
export const THEME = {
  primary: '#F59E0B',
  secondary: '#FB923C',
  bg: '#FFF9F5',
}
