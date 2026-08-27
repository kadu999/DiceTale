# -*- coding: utf-8 -*-
"""生成焦痕贴图（BurningRoom 用）：
R = 焦深（焦斑/裂纹/烧穿洞/烟熏），G = 焦褐边缘，B 未用。
输出: client/Assets/DiceTale/Resources/BurningRoom_Char.png
用法: python gen_char_texture.py
"""
import numpy as np
import cv2

SIZE = 512
OUT = r"D:\work\DiceTale\client\Assets\DiceTale\Resources\BurningRoom_Char.png"


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def vnoise(shape, scale, seed):
    gx = max(2, shape[0] // scale)
    gy = max(2, shape[1] // scale)
    small = np.random.default_rng(seed).random((gx, gy), dtype=np.float32)
    return cv2.resize(small, (shape[1], shape[0]), interpolation=cv2.INTER_CUBIC)


def fbm(shape, base_scale, octaves, seed):
    acc = np.zeros(shape, np.float32)
    amp = 1.0
    scale = base_scale
    s = seed
    norm = 0.0
    for _ in range(octaves):
        acc += amp * vnoise(shape, scale, s)
        norm += amp
        amp *= 0.5
        scale = max(2, scale // 2)
        s += 17
    return acc / norm


char = np.zeros((SIZE, SIZE), np.float32)  # R: 焦深
edge = np.zeros((SIZE, SIZE), np.float32)  # G: 焦褐边缘
cr = np.random.default_rng(2024)

# ============================================================
# 平滑灰色高度图（山峰/湖泊）：驱动地面分层燃烧
#   高值（山峰）→ 烧焦黑；山坡 → 火焰/灰色；低值（湖）→ 透明（原始地板）
# ============================================================
h = fbm((SIZE, SIZE), 40, 5, 7)
h = cv2.GaussianBlur(h, (0, 0), 8)  # 强模糊 → 平滑起伏
lo, hi = np.percentile(h, 2), np.percentile(h, 98)
h = np.clip((h - lo) / (hi - lo), 0.0, 1.0)  # 对比度拉伸，峰谷分明
h = np.power(h, 1.2)  # 微调分布

img = np.stack([h, h, h], axis=-1)  # 灰色高度图（R=G=B=高度）
img = (img * 255.0).astype(np.uint8)
cv2.imwrite(OUT, img)
print("saved heightmap:", OUT, img.shape)
