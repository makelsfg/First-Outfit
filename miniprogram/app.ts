// app.ts
import { CLOUD_ENV } from './utils/config'

App<IAppOption>({
  globalData: {},
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }
    wx.cloud.init({
      env: CLOUD_ENV,
      traceUser: true,
    })
    // 静默初始化云数据库集合与鼓励语文案库（幂等，失败不影响使用）
    wx.cloud.callFunction({ name: 'initData', config: { env: CLOUD_ENV } }).catch(() => {})
  },
})
