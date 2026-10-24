# -*- coding: utf-8 -*-
"""把三张形象图处理成首页可用的透明 PNG。

流程：读取原始 JPEG -> 从画布四边泛洪抠掉棋盘格背景 -> 去掉水印等孤立小块
     -> alpha 收缩 + 羽化、边缘反混合（去白边）-> 按人物边界裁紧
     -> 贴到 230:290 比例的透明画布上（等高、水平居中、底部留一点边距）。

用法：
    python tools/prepare-avatars.py            # 生成三张图 + 预览图
    python tools/prepare-avatars.py --no-preview

输出：
    miniprogram/images/avatar-girl.png
    miniprogram/images/avatar-boy.png
    miniprogram/images/avatar-bear.png
    运行效果截图/avatar-preview.png（仅校验用，可删除）
"""

from __future__ import annotations

import os
import sys
from PIL import Image, ImageDraw, ImageFilter

# ---------------------------------------------------------------- 配置

# 源图目录。路径长度约 240 字符，加文件名会超过 Windows MAX_PATH(260)，
# 直接 open/os.stat 会报 WinError 3，必须加 \\?\ 前缀。
SRC_DIR = (
    r"\\?\C:\Users\admin\AppData\Local\CodeBuddyExtension\Data"
    r"\11bc7e8f-6c31-496f-aac6-8a5bab682676\CodeBuddyIDE"
    r"\11bc7e8f-6c31-496f-aac6-8a5bab682676\history"
    r"\192152e4a6e7e82a362b6cd4258a3982\7dc3badfaf0643d086c184f32bd89266"
    r"\assets"
)

# (源文件名, 输出文件名, 预览标签, 预览底色)
SOURCES = [
    ("d36907b2147ce6c3680d2d10153d0731.a3c0d0c0e9.jpg", "avatar-girl.png", "GIRL", "#FFF1F7"),
    ("01bb76c146cff0e94c501fde85191981.320c05bb1e.jpg", "avatar-boy.png", "BOY", "#F0F6FF"),
    ("0a774d255c44ae0a1e378ce6f97ee523.b2fc21a0b3.jpg", "avatar-bear.png", "BEAR", "#FFF9F5"),
]

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "miniprogram", "images")
PREVIEW_PATH = os.path.join(ROOT, "运行效果截图", "avatar-preview.png")

# 输出画布：与首页 230x290rpx 同比例
CANVAS_W = 640
CANVAS_H = int(round(CANVAS_W * 290 / 230))  # 807
CONTENT_H_RATIO = 0.90   # 人物高度占画布高度
CONTENT_W_RATIO = 0.97   # 人物宽度上限（个子矮胖的角色按宽约束）
BOTTOM_MARGIN_RATIO = 0.03

# 背景判定：近中性色且偏亮。棋盘格的 255/247、237~243 都落在此区间。
NEUTRAL_TOL = 14
BRIGHT_MIN = 222

# 孤立小块剔除：面积小于最大连通块 5% 的前景块（水印文字、JPEG 噪点）丢弃
KEEP_AREA_RATIO = 0.05
ALPHA_CROP_THRESHOLD = 8

# 输出编码：卡通图色块平涂，量化成 256 色调色板（保留 alpha）体积可降到 1/6
QUANTIZE_COLORS = 256


# ---------------------------------------------------------------- 抠图

def candidate_mask(px, w, h):
    """近中性且偏亮的像素 = 背景候选。"""
    cand = bytearray(w * h)
    for i in range(w * h):
        r, g, b = px[i]
        if min(r, g, b) >= BRIGHT_MIN and max(r, g, b) - min(r, g, b) <= NEUTRAL_TOL:
            cand[i] = 1
    return cand


def flood_background(cand, w, h):
    """从四边泛洪，只把与画布边缘连通的候选像素判为背景。"""
    bg = bytearray(w * h)
    stack = []

    def push(i):
        if cand[i] and not bg[i]:
            bg[i] = 1
            stack.append(i)

    for x in range(w):
        push(x)
        push((h - 1) * w + x)
    for y in range(h):
        push(y * w)
        push(y * w + w - 1)

    while stack:
        i = stack.pop()
        x = i % w
        if x > 0:
            push(i - 1)
        if x < w - 1:
            push(i + 1)
        if i >= w:
            push(i - w)
        if i < (h - 1) * w:
            push(i + w)

    return bg


def keep_main_parts(fg, w, h):
    """只保留主体的连通块，丢掉水印文字、孤立噪点。"""
    seen = bytearray(w * h)
    comps = []
    for start in range(w * h):
        if not fg[start] or seen[start]:
            continue
        seen[start] = 1
        stack = [start]
        pixels = []
        while stack:
            i = stack.pop()
            pixels.append(i)
            x = i % w
            if x > 0 and fg[i - 1] and not seen[i - 1]:
                seen[i - 1] = 1
                stack.append(i - 1)
            if x < w - 1 and fg[i + 1] and not seen[i + 1]:
                seen[i + 1] = 1
                stack.append(i + 1)
            if i >= w and fg[i - w] and not seen[i - w]:
                seen[i - w] = 1
                stack.append(i - w)
            if i < (h - 1) * w and fg[i + w] and not seen[i + w]:
                seen[i + w] = 1
                stack.append(i + w)
        comps.append(pixels)

    if not comps:
        return bytearray(w * h), 0

    comps.sort(key=len, reverse=True)
    limit = len(comps[0]) * KEEP_AREA_RATIO
    keep = bytearray(w * h)
    kept = 0
    for pixels in comps:
        if len(pixels) < limit:
            continue
        kept += 1
        for i in pixels:
            keep[i] = 1
    return keep, kept


def median_bg_color(px, bg):
    rs, gs, bs = [], [], []
    for i in range(0, len(bg), 53):
        if bg[i]:
            r, g, b = px[i]
            rs.append(r)
            gs.append(g)
            bs.append(b)
    if not rs:
        return (255, 255, 255)
    rs.sort()
    gs.sort()
    bs.sort()
    m = len(rs) // 2
    return (rs[m], gs[m], bs[m])


def build_rgba(img, px, keep, bg, w, h):
    alpha_img = Image.new("L", (w, h))
    alpha_img.putdata([255 if keep[i] else 0 for i in range(w * h)])
    # 收缩 1px 去掉背景残留，再羽化出抗锯齿边缘
    alpha_img = alpha_img.filter(ImageFilter.MinFilter(3))
    alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(0.8))
    alpha = list(alpha_img.getdata())

    # 边缘反混合：把半透明像素里混进去的背景色减掉，避免浅色卡片上出现白边
    br, bgc, bb = median_bg_color(px, bg)
    out = []
    for i in range(w * h):
        a = alpha[i]
        r, g, b = px[i]
        if 0 < a < 255:
            af = a / 255.0
            inv = 1.0 - af
            r = int(min(255, max(0, (r - inv * br) / af)))
            g = int(min(255, max(0, (g - inv * bgc) / af)))
            b = int(min(255, max(0, (b - inv * bb) / af)))
        out.append((r, g, b, a))

    rgba = Image.new("RGBA", (w, h))
    rgba.putdata(out)
    return rgba


def trim(rgba):
    """按 alpha 包围盒裁紧。"""
    bbox = rgba.getchannel("A").point(lambda v: 255 if v > ALPHA_CROP_THRESHOLD else 0).getbbox()
    if not bbox:
        raise ValueError("empty alpha after background removal")
    return rgba.crop(bbox)


def fit_to_canvas(rgba):
    """等比缩放后贴到统一画布：等高、水平居中、底部留少量边距。"""
    cw, ch = rgba.size
    max_h = int(CANVAS_H * CONTENT_H_RATIO)
    max_w = int(CANVAS_W * CONTENT_W_RATIO)
    scale = min(max_h / ch, max_w / cw)
    nw, nh = max(1, int(round(cw * scale))), max(1, int(round(ch * scale)))
    resized = rgba.resize((nw, nh), Image.LANCZOS)

    canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    x = (CANVAS_W - nw) // 2
    y = CANVAS_H - nh - int(CANVAS_H * BOTTOM_MARGIN_RATIO)
    canvas.alpha_composite(resized, (max(0, x), max(0, y)))
    return canvas


def process_one(src_path, name):
    with Image.open(src_path) as raw:
        img = raw.convert("RGB")
        w, h = img.size
        px = list(img.getdata())
        cand = candidate_mask(px, w, h)
        bg = flood_background(cand, w, h)
        # 与背景连通的像素已被判为背景，其余为前景（含被白色包围的衬衫）
        fg = bytearray(w * h)
        for i in range(w * h):
            fg[i] = 0 if bg[i] else 1
        keep, kept_comps = keep_main_parts(fg, w, h)
        if not any(keep):
            raise ValueError("%s: no foreground left, tune NEUTRAL_TOL/BRIGHT_MIN" % name)
        rgba = build_rgba(img, px, keep, bg, w, h)

    trimmed = trim(rgba)
    out = fit_to_canvas(trimmed)
    out_path = os.path.join(OUT_DIR, name)
    out.quantize(colors=QUANTIZE_COLORS, method=Image.FASTOCTREE).save(
        out_path, "PNG", optimize=True
    )

    total = out.size[0] * out.size[1]
    opaque = sum(1 for a in out.getchannel("A").getdata() if a > 200)
    size_kb = os.path.getsize(out_path) / 1024.0
    print(
        "[ok] %-16s src=%dx%d trimmed=%dx%d out=%dx%d fg=%.1f%% comps=%d %.1fKB"
        % (
            name,
            w,
            h,
            trimmed.size[0],
            trimmed.size[1],
            out.size[0],
            out.size[1],
            opaque * 100.0 / total,
            kept_comps,
            size_kb,
        )
    )
    return out, out_path


# ---------------------------------------------------------------- 预览

def build_preview(items, labels):
    panel_w, panel_h, gap, pad = 300, 380, 12, 16
    width = pad * 2 + panel_w * len(items) + gap * (len(items) - 1)
    height = pad * 2 + panel_h
    sheet = Image.new("RGBA", (width, height), (250, 250, 252, 255))
    draw = ImageDraw.Draw(sheet)
    for idx, (img, bg) in enumerate(items):
        x0 = pad + idx * (panel_w + gap)
        y0 = pad
        panel = Image.new("RGBA", (panel_w, panel_h), bg)
        inner_h = panel_h - 56
        scale = min(panel_w / img.size[0], inner_h / img.size[1])
        nw, nh = int(img.size[0] * scale), int(img.size[1] * scale)
        thumb = img.resize((nw, nh), Image.LANCZOS)
        panel.alpha_composite(thumb, ((panel_w - nw) // 2, panel_h - nh - 12))
        draw.rectangle([x0, y0, x0 + panel_w, y0 + panel_h], outline=(214, 214, 220, 255))
        sheet.paste(panel, (x0, y0))
        draw.text((x0 + 10, y0 + 10), labels[idx], fill=(60, 60, 70, 255))
    os.makedirs(os.path.dirname(PREVIEW_PATH), exist_ok=True)
    sheet.convert("RGB").save(PREVIEW_PATH, "PNG", optimize=True)
    print("[ok] preview -> %s" % PREVIEW_PATH)


# ---------------------------------------------------------------- 入口

def main(argv):
    if not os.path.isdir(SRC_DIR):
        print("[error] source dir not found: %s" % SRC_DIR)
        return 1
    os.makedirs(OUT_DIR, exist_ok=True)

    images = []
    for src_name, out_name, label, bg in SOURCES:
        src_path = os.path.join(SRC_DIR, src_name)
        if not os.path.exists(src_path):
            print("[error] missing source: %s" % src_name)
            return 1
        try:
            img, _ = process_one(src_path, out_name)
        except Exception as exc:  # noqa: BLE001 - 单张失败要给出可读原因
            print("[error] %s: %s" % (out_name, exc))
            return 1
        images.append((img, bg))

    if "--no-preview" not in argv:
        build_preview(images, [s[2] for s in SOURCES])

    print("[done] %d avatars written to %s" % (len(images), OUT_DIR))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
