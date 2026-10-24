// 路由封装：防止重复跳转 / 页面栈超限 / 无上一页时返回，
// 避免「routeDone with a webviewId is not found」这类路由层报错。
const LOCK_MS = 800
const PAGE_STACK_LIMIT = 10

let lockUntil = 0
let lockKey = ''

function isLocked(key: string): boolean {
  return Date.now() < lockUntil && lockKey === key
}

function lock(key: string): void {
  lockUntil = Date.now() + LOCK_MS
  lockKey = key
}

function unlock(): void {
  lockUntil = 0
  lockKey = ''
}

function stackSize(): number {
  const pages = getCurrentPages()
  return pages ? pages.length : 1
}

/** 打开新页面：连点只生效一次；页面栈已满时改用 redirectTo */
export function safeNavigateTo(url: string): void {
  const key = `to:${url}`
  if (isLocked(key)) {
    return
  }
  lock(key)

  const options: WechatMiniprogram.NavigateToOption = {
    url,
    fail: (err) => {
      console.warn('[nav] navigateTo 失败', err)
      unlock()
    },
  }

  if (stackSize() >= PAGE_STACK_LIMIT) {
    wx.redirectTo({
      url,
      fail: (err) => {
        console.warn('[nav] redirectTo 失败', err)
        unlock()
      },
    })
    return
  }
  wx.navigateTo(options)
}

/** 切换 tab：连点只生效一次 */
export function safeSwitchTab(url: string): void {
  const key = `tab:${url}`
  if (isLocked(key)) {
    return
  }
  lock(key)
  wx.switchTab({
    url,
    fail: (err) => {
      console.warn('[nav] switchTab 失败', err)
      unlock()
    },
  })
}

/** 返回上一页：栈里没有上一页时退到指定 tab，避免空返回触发路由错误 */
export function safeBack(fallbackTab = '/pages/home/home'): void {
  if (stackSize() > 1) {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({ url: fallbackTab })
      },
    })
    return
  }
  wx.switchTab({ url: fallbackTab })
}
