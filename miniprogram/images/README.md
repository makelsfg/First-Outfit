# 形象图（已就位）

首页「人像」位置按设置里的性别显示对应形象，文件已放在本目录：

| 性别设置 | 文件 | 尺寸 | 体积 |
|---|---|---|---|
| 女 | `avatar-girl.png` | 640×807 透明 PNG | 约 32KB |
| 男 | `avatar-boy.png` | 640×807 透明 PNG | 约 45KB |
| 不透露 | `avatar-bear.png` | 640×807 透明 PNG | 约 36KB |

路径映射在 `miniprogram/utils/preferences.ts` 的 `avatarOf(gender)`，首页在 `onShow` 时按 `profile.gender` 取图，**不需要改代码**。

## 换图怎么换

用同名 PNG 覆盖即可（保持透明背景）：

- 尺寸建议 640×807（与首页 230×290rpx 同比例，`aspectFit` 显示，不会被拉伸）。
- 底边留一点空白、人物上下撑满 90% 高度，三张图观感一致。
- 单张控制在 100KB 以内（256 色调色板编码），三张合计 < 200KB。

## 重新生成

`tools/prepare-avatars.py` 是把原始 JPG 处理成本目录 PNG 的脚本（抠棋盘格背景 → 去水印 → 裁紧 → 统一画布 → 量化压缩）：

```bash
python tools/prepare-avatars.py
```

脚本会同时输出校验用预览图 `运行效果截图/avatar-preview.png`（三张图分别贴在粉/蓝/橙三种主题底色上），确认无残留背景后再提交。

注意：脚本里 `SRC_DIR` 指向原始 JPG 的绝对路径（该路径超过 Windows 260 字符，需 `\\?\` 前缀），换图时改这个常量即可；只想手动换图就不用跑脚本。
