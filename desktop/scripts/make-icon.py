"""Render frame-studio/icon.svg (simple shapes) to build/icon.png (512) and build/icon.ico with Pillow.
The SVG has no renderer dependency-free in Python, so its few shapes are redrawn here; run again if icon.svg changes.
Usage: python3 desktop/scripts/make-icon.py"""
import os
from PIL import Image, ImageDraw

S = 4  # supersampling factor over the 512 viewBox
W = 512 * S
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, '..', 'build')
os.makedirs(out, exist_ok=True)

img = Image.new('RGBA', (W, W), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle([0, 0, W - 1, W - 1], radius=112 * S, fill='#1d1633')

def circle(cx, cy, r, **kw):
    d.ellipse([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S], **kw)

# ring: r=170, stroke 44 -> outer 192, inner 148
circle(256, 256, 192, fill='#ffffff')
circle(256, 256, 148, fill='#1d1633')
circle(256, 256, 88, fill='#c9a45c')
circle(256, 256, 38, fill='#1d1633')
circle(226, 222, 16, fill='#cfe0ff')
# round-capped line from (400,112) to (446,66), width 36
d.line([(400 * S, 112 * S), (446 * S, 66 * S)], fill='#e3c98e', width=36 * S)
circle(400, 112, 18, fill='#e3c98e')
circle(446, 66, 18, fill='#e3c98e')

big = img.resize((512, 512), Image.LANCZOS)
big.save(os.path.join(out, 'icon.png'))
big.save(os.path.join(out, 'icon.ico'), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print('wrote', os.path.join(out, 'icon.png'), 'and icon.ico')
