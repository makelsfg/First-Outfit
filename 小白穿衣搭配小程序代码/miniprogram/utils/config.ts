// 全局常量配置

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

// ---------- 高德 API（开发阶段前端直连，上线前必须迁移到后端隐藏 key） ----------
export const AMAP_KEY = '246507c7dd16d8b42f6aa6ddc778a480'
export const AMAP_WEATHER_URL = 'https://restapi.amap.com/v3/weather/weatherInfo'
export const AMAP_REGEO_URL = 'https://restapi.amap.com/v3/geocode/regeo'

// ---------- 大模型 API（阿里云百炼 DashScope，OpenAI 兼容） ----------
export const DASHSCOPE_KEY = 'sk-ws-H.PPDPMPL.ysa8.MEUCIFSvr-dQxCQ83BMkrnzPxLiIH4nC633LP_R1mzsHP3DUAiEAgDOp3bUCBWZQ87FkdiLpwFPiPEx42CkxChH16TDeGYE'
export const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
export const LLM_MODEL = 'deepseek-v4.1-flash'
