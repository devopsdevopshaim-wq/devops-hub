#!/usr/bin/env python3
"""Paints the portfolio's background images (no stock photos, all in the site's palette).

  img/sky.webp         night sky: aurora in violet and brass, a few thousand stars
  img/ridge-far.webp   distant mountain ridge (transparent), for the parallax
  img/ridge-near.webp  near ridge with a soft rim light (transparent)
  img/topo.webp        faint topographic lines, used behind some sections

    pip install pillow numpy && python3 .github/scripts/portfolio-backgrounds.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

OUT = Path(__file__).resolve().parents[2] / 'portfolio' / 'img'
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(37)

NIGHT = np.array([15, 13, 36], float)
DEEP = np.array([30, 26, 74], float)
VIOLET = np.array([139, 123, 255], float)
BRASS = np.array([224, 178, 90], float)
MINT = np.array([98, 220, 184], float)


def value_noise(h, w, scale, octaves=5, seed=0):
    """Fractal value noise in [0, 1]."""
    r = np.random.default_rng(seed)
    out = np.zeros((h, w))
    amp, total = 1.0, 0.0
    for o in range(octaves):
        gh, gw = int(h / scale) + 2, int(w / scale) + 2
        grid = r.random((gh, gw))
        ys = np.linspace(0, gh - 1.001, h)
        xs = np.linspace(0, gw - 1.001, w)
        y0, x0 = ys.astype(int), xs.astype(int)
        fy, fx = ys - y0, xs - x0
        fy = fy * fy * (3 - 2 * fy)
        fx = fx * fx * (3 - 2 * fx)
        a = grid[y0][:, x0]
        b = grid[y0][:, x0 + 1]
        c = grid[y0 + 1][:, x0]
        d = grid[y0 + 1][:, x0 + 1]
        top = a + (b - a) * fx[None, :]
        bot = c + (d - c) * fx[None, :]
        out += (top + (bot - top) * fy[:, None]) * amp
        total += amp
        amp *= 0.5
        scale /= 2
    return out / total


def save(arr, name, quality=82):
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    img.save(OUT / name, 'WEBP', quality=quality, method=6)
    print('wrote', name, (OUT / name).stat().st_size // 1024, 'KB')


# ---------------------------------------------------------------- sky
W, H = 2400, 1350
yy, xx = np.mgrid[0:H, 0:W]
u, v = xx / W, yy / H
sky = NIGHT + (DEEP - NIGHT) * np.clip(1 - v * 1.2, 0, 1)[..., None] * 0.9

# aurora: two ribbons that wave across the upper sky
n = value_noise(H, W, 420, 4, seed=3)
for cy, amp, col, strength, width in [(0.30, 0.10, VIOLET, 0.55, 0.07), (0.42, 0.07, BRASS, 0.32, 0.05), (0.36, 0.09, MINT, 0.16, 0.04)]:
    centre = cy + amp * np.sin(u * 5.2 + n * 3.0) + (n - 0.5) * 0.08
    d = np.abs(v - centre)
    band = np.exp(-(d / width) ** 2)
    # vertical curtains inside the ribbon
    rays = 0.55 + 0.45 * value_noise(H, W, 60, 2, seed=int(cy * 100))
    rays = rays ** 1.6
    fade = np.clip(1.25 - np.abs(u - 0.55) * 1.4, 0, 1)
    sky += col[None, None, :] * (band * rays * fade * strength)[..., None]

# a warm glow low on the horizon, under the ridges
glow = np.exp(-(((u - 0.62) / 0.35) ** 2 + ((v - 0.92) / 0.18) ** 2))
sky += BRASS[None, None, :] * (glow * 0.22)[..., None]

# stars: many faint, a few bright with a soft halo
stars = np.zeros((H, W))
cnt = 4200
sx, sy = rng.integers(0, W, cnt), (rng.random(cnt) ** 1.35 * H * 0.86).astype(int)
stars[sy, sx] = rng.random(cnt) ** 3 * 255
big = Image.fromarray(stars.astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.6))
stars = np.maximum(stars, np.array(big, float) * 3.2)
sky += stars[..., None] * np.array([0.92, 0.9, 1.0])[None, None, :]

# film grain so the gradients never band
sky += (rng.random((H, W, 1)) - 0.5) * 7
save(sky, 'sky.webp', 80)


# ---------------------------------------------------------------- ridges
def ridge(name, height, base, jag, color, rim=None, seed=1):
    w, h = 2400, height
    x = np.linspace(0, 1, w)
    line = base
    line = line + 0.18 * np.sin(x * 3.1 + seed) + 0.09 * np.sin(x * 7.3 + seed * 2)
    line = line + jag * (value_noise(1, w, 260, 5, seed=seed)[0] - 0.5)
    top = (np.clip(line, 0.05, 0.95) * h).astype(int)
    yy = np.arange(h)[:, None]
    mask = (yy >= top[None, :]).astype(float)
    m = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
    alpha = np.array(m, float)
    depth = np.clip((yy - top[None, :]) / (h * 0.6), 0, 1)
    rgb = np.ones((h, w, 3)) * color[None, None, :]
    rgb = rgb * (1 - 0.35 * depth[..., None])
    if rim is not None:
        edge = np.exp(-((yy - top[None, :]) / 3.0) ** 2) * (yy >= top[None, :] - 2)
        lit = np.clip(1 - np.abs(x - 0.62) * 1.6, 0, 1)[None, :]
        rgb += rim[None, None, :] * (edge * lit * 0.9)[..., None]
    rgba = np.dstack([np.clip(rgb, 0, 255), alpha]).astype(np.uint8)
    Image.fromarray(rgba, 'RGBA').save(OUT / name, 'WEBP', quality=86, method=6)
    print('wrote', name, (OUT / name).stat().st_size // 1024, 'KB')


ridge('ridge-far.webp', 520, 0.46, 0.28, np.array([34, 29, 82], float), seed=2)
ridge('ridge-near.webp', 460, 0.58, 0.36, np.array([16, 14, 40], float), rim=BRASS * 0.7, seed=5)


# ---------------------------------------------------------------- topography
TW, TH = 1600, 1000
f = value_noise(TH, TW, 380, 4, seed=11)
levels = 26
frac = (f * levels) % 1.0
line = np.exp(-((np.minimum(frac, 1 - frac)) / 0.035) ** 2)
major = ((np.floor(f * levels) % 5) == 0)
alpha = line * np.where(major, 0.55, 0.28)
rgba = np.zeros((TH, TW, 4))
rgba[..., :3] = BRASS
rgba[..., 3] = alpha * 120
Image.fromarray(rgba.astype(np.uint8), 'RGBA').save(OUT / 'topo.webp', 'WEBP', quality=60, method=6)
print('wrote topo.webp', (OUT / 'topo.webp').stat().st_size // 1024, 'KB')
