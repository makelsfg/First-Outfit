# DESIGN.md · 小白穿衣推荐项目汇报

## 画布与母版（1280×720）
| 区 | 位置 | 规则 |
|---|---|---|
| A 标题块 | y 0–120 | 主标题 34px bold，左对齐 x=70 |
| B 内容区 | y 120–660 | 正文/卡片/图示，左右 padding 70 |
| C 页脚条 | y 660–720 | 左：「First-Outfit · 小白穿衣推荐」13px 灰；右：页码 NN / 09 |

## 色彩池（4 hex）
| 角色 | hex | 面积 |
|---|---|---|
| 背景 | #FAF7F2（奶油米） | 主，≥60% |
| 主色 | #F97316（暖橙，取自小程序主题色） | ≤20%，标题块、焦点元素 |
| 深色 | #2B2B33（近黑，页面深色块/正文标题） | ≤15% |
| 文本辅色 | #6B6B75（灰） | 正文说明文字 |

- 半透明策略：卡片用白 #FFFFFF 底 + boxShadow '0 4px 20px rgba(43,43,51,0.08)'；浅橙底 rgba(249,115,22,0.08) 用于标签/强调底
- Hero 页强调色可至 15-20%；supporting 页强调色 ≤8%

## 字体
- 全篇：PingFang SC / Microsoft YaHei（sans-serif）
- 封面主标题 64px bold；页面主标题 34px bold；卡片小标题 24px bold；正文 20px，行高 1.55；锚点数字/大字 72–110px bold；页脚 13px

## 配图清单（已核对）
| 文件 | 来源 | 内容 | 用页 |
|---|---|---|---|
| assets/cover_wardrobe.png | ImageGen 扁平插画 | 男孩选衣柜衣服，左侧留白 | 01 封面 L1 |
| assets/ending_walk.png | ImageGen 扁平插画 | 阳光下自信出行的学生 | 09 结尾 L1 |
| assets/shot_home.png | 用户截图 | 首页天气卡+形象 | 03 |
| assets/shot_wardrobe.png | 用户截图 | 衣橱列表 | 03 |
| assets/shot_settings.png | 用户截图 | 设置页 | 03 |
| assets/shot_reason.png | 用户截图 | 穿搭建议+推荐理由 | 04 L2 |

架构图/流程图/SCAFF 卡片用 SVG 与色块，不生图。

## 页面映射表
| # | 文件 | 类型 | 角色 | 版式 | L1 | 字数 | 留白 | 色彩分配 | 约束 |
|---|---|---|---|---|---|---|---|---|---|
| 01 | 01.slide | cover | hero | 右图左文 | cover_wardrobe.png | 30 | 35% | 主色20+背景60 | 全幅右半图 |
| 02 | 02.slide | content | supporting | 引句+四卡 | — | 220 | 25% | 强调≤8% | 四痛点卡 2×2 |
| 03 | 03.slide | content | supporting | 三截图+说明 | 3×shot | 260 | 18% | 辅色20% | 截图手机比例 200×400 内 |
| 04 | 04.slide | content | supporting | 左规则流程SVG+右截图 | shot_reason.png | 240 | 22% | 主色12% | 流程图为主视觉 |
| 05 | 05.slide | content | supporting | 横向链路SVG+降级条 | — | 230 | 24% | 主色10% | 链路图为锚点 |
| 06 | 06.slide | hero | hero | 五色块卡 | — | 320 | 12% | 强调15%爆发 | SCAFF 五卡等高 |
| 07 | 07.slide | content | supporting | 三层架构SVG+数字锚点 | — | 200 | 22% | 主色10% | 架构图占B区50% |
| 08 | 08.slide | content | supporting | 左收获右展望两栏 | — | 240 | 20% | 辅色15% | 收入/展望区分 |
| 09 | 09.slide | ending | hero | 大金句+右图 | ending_walk.png | 25 | 40% | 主色15% | 金句 ≥56px |
