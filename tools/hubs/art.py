#!/usr/bin/env python3
"""Draws the illustrations and the background images of the five sites (no stock photos, no network).

For every site it writes, into <site>/img/:
  hero.svg   the large illustration of the site's world (compass for finance, megaphone for marketing, film strip for the
             studio, botanical leaves and a heartbeat for wellness, a menorah in an arch for the torah library)
  bg.webp    a soft, photographic background of colored light (bokeh, gradient, grain) in the site's palette
  mark.svg   a small emblem used as the site's icon

Everything is generated from code with a fixed seed, so running it again gives the same pictures.

    pip install pillow numpy
    python3 tools/hubs/art.py
"""
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]

PALETTE = {
    # name: (deep, mid, accent, light)
    'finance-hub': ('#050a14', '#0d1b33', '#d9b45a', '#f6ecd0'),
    'marketing-hub': ('#14060f', '#2b0f24', '#f0a98c', '#ffe4d6'),
    'aia-studio': ('#070509', '#16101f', '#e8a34c', '#5fd0d6'),
    'wellness-hub': ('#04110f', '#0b2a24', '#d8c08a', '#9fe3cf'),
    'torah-hub': ('#0b0813', '#24101c', '#d4a84b', '#f4e6c3'),
}


def defs(a, light):
    return f'''<defs>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{light}"/><stop offset=".5" stop-color="{a}"/><stop offset="1" stop-color="#7a5a1a"/></linearGradient>
  <linearGradient id="goldv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{light}"/><stop offset="1" stop-color="{a}" stop-opacity=".25"/></linearGradient>
  <radialGradient id="halo" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="{a}" stop-opacity=".55"/><stop offset="1" stop-color="{a}" stop-opacity="0"/></radialGradient>
  <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="soft"><feGaussianBlur stdDeviation="14"/></filter>
</defs>'''


def bokeh(rnd, a, light, n=26, w=640, h=520):
    out = []
    for _ in range(n):
        x, y, r = rnd.uniform(0, w), rnd.uniform(0, h), rnd.uniform(4, 26)
        c = rnd.choice([a, light])
        out.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.0f}" fill="{c}" opacity="{rnd.uniform(.05, .22):.2f}"/>')
    return ''.join(out)


def sparkle(x, y, s, fill='url(#gold)', op=1):
    return (f'<path d="M{x} {y - s} Q{x + s * .12} {y - s * .12} {x + s} {y} Q{x + s * .12} {y + s * .12} {x} {y + s} '
            f'Q{x - s * .12} {y + s * .12} {x - s} {y} Q{x - s * .12} {y - s * .12} {x} {y - s}Z" fill="{fill}" opacity="{op}"/>')


# ----------------------------------------------------------------------------- finance: a compass over a rising chart
def finance(deep, mid, a, light):
    rnd = random.Random(11)
    cx, cy = 320, 270
    ticks = ''.join(
        f'<line x1="{cx + 196 * math.cos(math.radians(i * 5)):.1f}" y1="{cy + 196 * math.sin(math.radians(i * 5)):.1f}" '
        f'x2="{cx + (210 if i % 6 == 0 else 203) * math.cos(math.radians(i * 5)):.1f}" y2="{cy + (210 if i % 6 == 0 else 203) * math.sin(math.radians(i * 5)):.1f}" '
        f'stroke="{a}" stroke-width="{2 if i % 6 == 0 else 1}" opacity="{.9 if i % 6 == 0 else .45}"/>' for i in range(72))
    star = []
    for k, (len_, wid) in enumerate([(165, 20)] * 4 + [(105, 14)] * 4):
        ang = k * 90 if k < 4 else (k - 4) * 90 + 45
        r = math.radians(ang - 90)
        px, py = cx + len_ * math.cos(r), cy + len_ * math.sin(r)
        l = (cx + wid * math.cos(r - math.pi / 2), cy + wid * math.sin(r - math.pi / 2))
        rr = (cx + wid * math.cos(r + math.pi / 2), cy + wid * math.sin(r + math.pi / 2))
        star.append(f'<polygon points="{px:.1f},{py:.1f} {l[0]:.1f},{l[1]:.1f} {cx},{cy} {rr[0]:.1f},{rr[1]:.1f}" fill="url(#gold)" opacity="{.95 if k < 4 else .55}"/>')
    pts = [(60, 430), (130, 400), (190, 415), (250, 350), (310, 372), (370, 300), (440, 318), (510, 235), (580, 170)]
    line = ' '.join(f'{x},{y}' for x, y in pts)
    area = line + ' 580,500 60,500'
    candles = ''.join(
        f'<rect x="{x - 6}" y="{y - 34 + (i % 3) * 8}" width="12" height="{46 - (i % 2) * 10}" rx="2" fill="{a}" opacity=".35"/>'
        f'<line x1="{x}" y1="{y - 50}" x2="{x}" y2="{y + 24}" stroke="{a}" stroke-width="1.5" opacity=".35"/>'
        for i, (x, y) in enumerate(pts[1:8]))
    coins = ''.join(
        f'<ellipse cx="{540}" cy="{470 - i * 13}" rx="46" ry="12" fill="url(#gold)" stroke="#7a5a1a" stroke-width="1"/>'
        f'<path d="M494 {470 - i * 13} v10 a46 12 0 0 0 92 0 v-10" fill="#9a7424" opacity=".8"/>' for i in range(6))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 520" fill="none">{defs(a, light)}
<g>{bokeh(rnd, a, light)}</g>
<circle cx="{cx}" cy="{cy}" r="250" fill="url(#halo)"/>
<polyline points="{area}" fill="url(#goldv)" opacity=".16"/>
{candles}
<polyline points="{line}" stroke="url(#gold)" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" filter="url(#glow)"/>
{''.join(f'<circle cx="{x}" cy="{y}" r="5" fill="{light}"/>' for x, y in pts[1::2])}
<circle cx="{cx}" cy="{cy}" r="212" stroke="url(#gold)" stroke-width="2.5"/>
<circle cx="{cx}" cy="{cy}" r="186" stroke="{a}" stroke-width="1" opacity=".5"/>
<circle cx="{cx}" cy="{cy}" r="120" stroke="{a}" stroke-width="1" stroke-dasharray="3 7" opacity=".6"/>
{ticks}
{''.join(star)}
<circle cx="{cx}" cy="{cy}" r="16" fill="{deep}" stroke="url(#gold)" stroke-width="3"/>
<circle cx="{cx}" cy="{cy}" r="5" fill="{light}"/>
{coins}
{sparkle(120, 120, 18)}{sparkle(520, 80, 12, op=.8)}{sparkle(580, 330, 9, op=.7)}
</svg>'''


# ----------------------------------------------------------------------------- marketing: a megaphone and what it sets off
def marketing(deep, mid, a, light):
    rnd = random.Random(23)
    waves = ''.join(
        f'<path d="M{300 + i * 46} {250 - 70 - i * 26} Q{356 + i * 62} 250 {300 + i * 46} {250 + 70 + i * 26}" stroke="url(#gold)" stroke-width="{4 - i * .6:.1f}" stroke-linecap="round" opacity="{.95 - i * .2:.2f}"/>'
        for i in range(4))
    conf = ''.join(
        f'<rect x="{rnd.uniform(40, 600):.0f}" y="{rnd.uniform(30, 480):.0f}" width="{rnd.uniform(5, 11):.0f}" height="{rnd.uniform(5, 11):.0f}" rx="2" fill="{rnd.choice([a, light, "#ff6f9c", "#7be0d2"])}" opacity="{rnd.uniform(.35, .85):.2f}" transform="rotate({rnd.uniform(0, 90):.0f} 300 250)"/>'
        for _ in range(46))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 520" fill="none">{defs(a, light)}
<g>{bokeh(rnd, a, light, 22)}</g>
<circle cx="260" cy="260" r="230" fill="url(#halo)"/>
{conf}
<g transform="rotate(-12 200 260)">
  <path d="M96 205 h92 l128 -92 v294 l-128 -92 h-92 a22 22 0 0 1 -22 -22 v-58 a22 22 0 0 1 22 -22Z" fill="url(#gold)" filter="url(#glow)"/>
  <path d="M188 205 l128 -92 v40 l-128 92Z" fill="{light}" opacity=".35"/>
  <rect x="316" y="104" width="22" height="312" rx="11" fill="url(#gold)"/>
  <path d="M120 322 l24 92 a14 14 0 0 0 14 10 h20 a14 14 0 0 0 14 -18 l-22 -82Z" fill="#7a5a1a"/>
  <ellipse cx="118" cy="264" rx="10" ry="30" fill="{deep}" opacity=".35"/>
</g>
{waves}
<g transform="translate(470 120)"><path d="M0 0h110a18 18 0 0 1 18 18v52a18 18 0 0 1 -18 18h-62l-26 24v-24h-22a18 18 0 0 1 -18 -18v-52a18 18 0 0 1 18 -18Z" fill="{mid}" stroke="url(#gold)" stroke-width="2"/>
  <path d="M64 62 c-22 -16 -30 -28 -14 -38 c8 -5 14 0 14 6 c0 -6 8 -11 16 -6 c14 10 6 22 -16 38Z" fill="#ff6f9c"/></g>
<g transform="translate(70 340)"><path d="M0 0h96a16 16 0 0 1 16 16v40a16 16 0 0 1 -16 16h-70l-22 20v-20h-4a16 16 0 0 1 -16 -16v-40a16 16 0 0 1 16 -16Z" fill="{mid}" stroke="url(#gold)" stroke-width="2"/>
  <rect x="14" y="22" width="68" height="6" rx="3" fill="{a}" opacity=".8"/><rect x="14" y="38" width="44" height="6" rx="3" fill="{light}" opacity=".5"/></g>
<g transform="translate(500 330)"><circle cx="40" cy="40" r="40" fill="{mid}" stroke="url(#gold)" stroke-width="2"/>
  <path d="M40 18 l7 15 16 2 -12 11 3 16 -14 -8 -14 8 3 -16 -12 -11 16 -2Z" fill="url(#gold)"/></g>
{sparkle(430, 70, 20)}{sparkle(120, 90, 13, op=.8)}{sparkle(580, 270, 10)}{sparkle(60, 200, 8, op=.7)}
</svg>'''


# ----------------------------------------------------------------------------- studio: a film strip, a clapperboard, a lens
def studio(deep, mid, a, light):
    rnd = random.Random(37)
    scenes = [
        (f'<rect width="120" height="86" fill="#1a1f3a"/><circle cx="84" cy="30" r="14" fill="{a}"/><path d="M0 86 L38 44 L62 66 L84 38 L120 86Z" fill="#0b0f22"/>'),
        (f'<rect width="120" height="86" fill="#2b1620"/><rect x="14" y="36" width="14" height="50" fill="#0e0710"/><rect x="34" y="22" width="18" height="64" fill="#0e0710"/><rect x="58" y="44" width="12" height="42" fill="#0e0710"/><rect x="76" y="30" width="22" height="56" fill="#0e0710"/><circle cx="96" cy="16" r="9" fill="{light}" opacity=".8"/>'),
        (f'<rect width="120" height="86" fill="#0e2a30"/><circle cx="60" cy="43" r="26" fill="none" stroke="{light}" stroke-width="3"/><circle cx="60" cy="43" r="12" fill="{light}" opacity=".7"/>'),
        (f'<rect width="120" height="86" fill="#2a1d0c"/><path d="M0 60 Q30 40 60 58 T120 50 V86 H0Z" fill="{a}" opacity=".75"/><circle cx="30" cy="24" r="10" fill="{light}" opacity=".9"/>'),
        (f'<rect width="120" height="86" fill="#14122b"/><path d="M10 76 L60 12 L110 76Z" fill="none" stroke="{a}" stroke-width="3"/><circle cx="60" cy="52" r="8" fill="{a}"/>')]
    frames = []
    for i, sc in enumerate(scenes):
        x = 40 + i * 136
        frames.append(f'<g transform="translate({x} 62)"><g clip-path="url(#fr)">{sc}</g><rect width="120" height="86" rx="4" fill="none" stroke="{a}" stroke-opacity=".5"/></g>')
    holes = ''.join(f'<rect x="{26 + i * 34}" y="{y}" width="16" height="10" rx="2" fill="{deep}"/>' for i in range(20) for y in (14, 164))
    beams = ''.join(f'<polygon points="60,120 {620},{60 + i * 120} {620},{120 + i * 120}" fill="url(#beam)" opacity=".5"/>' for i in range(3))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 520" fill="none">{defs(a, light)}
<defs><clipPath id="fr"><rect width="120" height="86" rx="4"/></clipPath>
<linearGradient id="beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{a}" stop-opacity=".5"/><stop offset="1" stop-color="{a}" stop-opacity="0"/></linearGradient></defs>
<g>{bokeh(rnd, a, light, 24)}</g>
<g opacity=".55">{beams}</g>
<g transform="translate(470 175)"><circle r="150" fill="none" stroke="{a}" stroke-opacity=".2" stroke-width="2"/><circle r="118" fill="none" stroke="{light}" stroke-opacity=".22" stroke-width="1.5"/>
  <circle r="86" fill="{deep}" stroke="url(#gold)" stroke-width="3"/><circle r="58" fill="{mid}" stroke="{a}" stroke-opacity=".6" stroke-width="2"/>
  <circle r="26" fill="{deep}"/><circle cx="-14" cy="-14" r="8" fill="{light}" opacity=".7"/>
  {''.join(f'<line x1="0" y1="0" x2="{86 * math.cos(math.radians(i * 60)):.0f}" y2="{86 * math.sin(math.radians(i * 60)):.0f}" stroke="{a}" stroke-opacity=".35"/>' for i in range(6))}</g>
<g transform="translate(44 232) rotate(-8 320 100) scale(.84)">
  <rect x="10" y="0" width="620" height="190" rx="10" fill="#0c0a12" stroke="url(#gold)" stroke-width="2"/>
  {''.join(frames)}{holes}
</g>
<g transform="translate(70 370) rotate(-10)">
  <rect width="170" height="104" rx="8" fill="#14111c" stroke="url(#gold)" stroke-width="2"/>
  <path d="M0 0h170v28H0Z" fill="#0c0a12" stroke="url(#gold)" stroke-width="2"/>
  {''.join(f'<path d="M{i * 34} 0 l22 0 l-14 28 l-22 0Z" fill="{a if i % 2 else light}" opacity=".9"/>' for i in range(6))}
  <rect x="14" y="44" width="86" height="6" rx="3" fill="{a}" opacity=".7"/><rect x="14" y="60" width="56" height="6" rx="3" fill="{light}" opacity=".4"/>
</g>
{sparkle(560, 60, 16)}{sparkle(250, 40, 10, op=.8)}{sparkle(600, 470, 12, op=.7)}
</svg>'''


# ----------------------------------------------------------------------------- wellness: leaves, a heartbeat, a sun
def wellness(deep, mid, a, light):
    rnd = random.Random(53)

    def leaf(x, y, ang, s, fill):
        return (f'<g transform="translate({x} {y}) rotate({ang}) scale({s})"><path d="M0 0 C30 -26 78 -26 108 0 C78 26 30 26 0 0Z" fill="{fill}"/>'
                f'<path d="M4 0 H100" stroke="{deep}" stroke-opacity=".35" stroke-width="2"/></g>')
    stem = []
    for side in (-1, 1):
        for i in range(6):
            y = 440 - i * 56
            ang = (-150 + i * 4) if side < 0 else (-30 - i * 4)
            stem.append(leaf(300 + side * 4, y, ang, 1.0 - i * .1, f'url(#lf{i % 2})'))
    stem.append(leaf(300, 112, -90, .9, 'url(#lf0)'))
    ecg = 'M40 330 H140 L170 330 L196 262 L228 398 L262 300 L284 330 H420'
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 520" fill="none">{defs(a, light)}
<defs><linearGradient id="lf0" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{light}"/><stop offset="1" stop-color="#2f8c76"/></linearGradient>
<linearGradient id="lf1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bfe9d9"/><stop offset="1" stop-color="#1d6b5a"/></linearGradient></defs>
<g>{bokeh(rnd, a, light, 24)}</g>
<circle cx="440" cy="190" r="150" fill="url(#halo)"/><circle cx="440" cy="190" r="92" fill="url(#gold)" opacity=".9" filter="url(#glow)"/>
<circle cx="440" cy="190" r="118" stroke="{a}" stroke-opacity=".45" stroke-width="1.5" stroke-dasharray="2 8"/>
<g opacity=".92">{''.join(stem)}</g>
<path d="M300 470 V96" stroke="#1d6b5a" stroke-width="5" stroke-linecap="round"/>
<g transform="translate(110 150)"><path d="M0 40 C0 -14 62 -14 62 40 C62 -14 124 -14 124 40 C124 90 62 130 62 148 C62 130 0 90 0 40Z" fill="none" stroke="url(#gold)" stroke-width="4" filter="url(#glow)"/></g>
<path d="{ecg}" stroke="{light}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" filter="url(#glow)"/>
<g fill="{light}" opacity=".85"><path d="M520 330 c-14 -26 -26 -40 -26 -54 a26 26 0 0 1 52 0 c0 14 -12 28 -26 54Z"/><path d="M588 400 c-9 -17 -16 -26 -16 -35 a16 16 0 0 1 32 0 c0 9 -7 18 -16 35Z" opacity=".7"/></g>
{sparkle(80, 90, 14)}{sparkle(560, 70, 11, op=.8)}{sparkle(40, 470, 9, op=.7)}
</svg>'''


# ----------------------------------------------------------------------------- torah: a menorah in an arch, an open book
def torah(deep, mid, a, light):
    rnd = random.Random(71)
    cx = 320
    # the seven branches: a central stem and three arms on each side, as arcs
    arms = ''
    for i in (1, 2, 3):
        d = 46 * i
        top = 250 - 14 * i
        arms += (f'<path d="M{cx} 372 C{cx - d - 40} 372 {cx - d - 40} 330 {cx - d} {top + 40} V{top + 40}" stroke="url(#gold)" stroke-width="8" stroke-linecap="round"/>'
                 f'<path d="M{cx} 372 C{cx + d + 40} 372 {cx + d + 40} 330 {cx + d} {top + 40}" stroke="url(#gold)" stroke-width="8" stroke-linecap="round"/>')
    flames = ''
    xs = [cx + k * 46 for k in (-3, -2, -1, 0, 1, 2, 3)]
    for k, x in zip((-3, -2, -1, 0, 1, 2, 3), xs):
        top = 190 if k == 0 else 250 - 14 * abs(k)
        flames += (f'<rect x="{x - 7}" y="{top + 8}" width="14" height="34" rx="3" fill="url(#gold)"/>'
                   f'<circle cx="{x}" cy="{top - 18}" r="26" fill="url(#halo)"/>'
                   f'<path d="M{x} {top - 30} c10 12 12 20 0 30 c-12 -10 -10 -18 0 -30Z" fill="{light}" filter="url(#glow)"/>')
    rays = ''.join(f'<line x1="{cx}" y1="250" x2="{cx + 330 * math.cos(math.radians(a_)):.0f}" y2="{250 + 330 * math.sin(math.radians(a_)):.0f}" stroke="{a}" stroke-opacity=".10" stroke-width="2"/>' for a_ in range(-170, 0, 10))
    star6 = lambda x, y, r, op: (f'<g transform="translate({x} {y})" opacity="{op}" stroke="{a}" stroke-width="1.5" fill="none">'
                                 f'<polygon points="0,{-r} {r * .87:.0f},{r * .5:.0f} {-r * .87:.0f},{r * .5:.0f}"/><polygon points="0,{r} {r * .87:.0f},{-r * .5:.0f} {-r * .87:.0f},{-r * .5:.0f}"/></g>')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 520" fill="none">{defs(a, light)}
<g>{bokeh(rnd, a, light, 20)}</g>
<g>{rays}</g>
<path d="M90 500 V210 C90 70 200 24 320 24 C440 24 550 70 550 210 V500" stroke="url(#gold)" stroke-width="3"/>
<path d="M118 500 V214 C118 94 210 52 320 52 C430 52 522 94 522 214 V500" stroke="{a}" stroke-opacity=".5" stroke-width="1.2"/>
<path d="M146 500 V218 C146 118 222 80 320 80 C418 80 494 118 494 218 V500" fill="url(#halo)" opacity=".5"/>
{star6(180, 120, 22, .5)}{star6(460, 120, 22, .5)}{star6(320, 56, 14, .7)}
{arms}<path d="M{cx} 190 V430" stroke="url(#gold)" stroke-width="10" stroke-linecap="round"/>
<path d="M{cx - 70} 450 H{cx + 70}" stroke="url(#gold)" stroke-width="10" stroke-linecap="round"/><path d="M{cx - 40} 430 H{cx + 40}" stroke="url(#gold)" stroke-width="8" stroke-linecap="round"/>
{flames}
<g transform="translate(320 452)">
  <path d="M-180 8 C-120 -22 -50 -14 0 12 C50 -14 120 -22 180 8 V40 C120 12 50 20 0 46 C-50 20 -120 12 -180 40Z" fill="{mid}" stroke="url(#gold)" stroke-width="2.5"/>
  <path d="M0 12 V46" stroke="{a}" stroke-width="2"/>
  {''.join(f'<path d="M{-160 + i * 8} {2 + i * 3} C{-110 + i * 8} {-14 + i * 3} {-60 + i * 8} -10 {-10} {14}" stroke="{a}" stroke-opacity=".35" stroke-width="1"/>' for i in range(4))}
</g>
{sparkle(70, 80, 12, op=.8)}{sparkle(580, 100, 10, op=.7)}{sparkle(40, 300, 8, op=.6)}
</svg>'''


MARKS = {
    'finance-hub': lambda a, l: f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="28" stroke="{a}" stroke-width="3"/><polygon points="32,10 38,32 32,54 26,32" fill="{a}"/><polygon points="10,32 32,26 54,32 32,38" fill="{l}" opacity=".8"/><circle cx="32" cy="32" r="4" fill="#050a14"/></svg>',
    'marketing-hub': lambda a, l: f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><path d="M10 26h14l22-14v40L24 38H10Z" fill="{a}"/><path d="M52 22c5 6 5 14 0 20" stroke="{l}" stroke-width="3" stroke-linecap="round"/></svg>',
    'aia-studio': lambda a, l: f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><rect x="8" y="14" width="48" height="36" rx="5" stroke="{a}" stroke-width="3"/><path d="M26 25l16 7-16 7Z" fill="{l}"/></svg>',
    'wellness-hub': lambda a, l: f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><path d="M32 54C14 40 8 30 8 22a12 12 0 0 1 24-3 12 12 0 0 1 24 3c0 8-6 18-24 32Z" stroke="{a}" stroke-width="3"/><path d="M12 32h12l5-10 7 18 5-8h11" stroke="{l}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    'torah-hub': lambda a, l: f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><path d="M32 52V22M32 52C20 52 14 44 14 30M32 52C44 52 50 44 50 30M32 52C26 52 24 46 24 38M32 52C38 52 40 46 40 38M18 56h28" stroke="{a}" stroke-width="3" stroke-linecap="round"/><g fill="{l}"><circle cx="32" cy="16" r="3"/><circle cx="14" cy="24" r="3"/><circle cx="50" cy="24" r="3"/><circle cx="24" cy="32" r="3"/><circle cx="40" cy="32" r="3"/></g></svg>',
}
ART = {'finance-hub': finance, 'marketing-hub': marketing, 'aia-studio': studio, 'wellness-hub': wellness, 'torah-hub': torah}


def hex_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def background(name, deep, mid, a, light):
    """soft colored light: a vertical gradient, big blurred discs, a vignette and fine grain"""
    rnd = np.random.default_rng(abs(hash(name)) % (2 ** 32) if False else sum(map(ord, name)))
    W, H = 1600, 900
    d, m, ac, li = (np.array(hex_rgb(c), float) for c in (deep, mid, a, light))
    y = np.linspace(0, 1, H)[:, None, None]
    img = d * (1 - y) + m * y
    img = np.broadcast_to(img, (H, W, 3)).copy()
    yy, xx = np.mgrid[0:H, 0:W]
    for _ in range(26):
        cx, cy, r = rnd.uniform(0, W), rnd.uniform(0, H), rnd.uniform(40, 190)
        col = ac if rnd.random() < .6 else li
        a_ = rnd.uniform(.05, .20)
        mask = np.clip(1 - (((xx - cx) ** 2 + (yy - cy) ** 2) ** .5) / r, 0, 1) ** .6
        img += (col - img) * (mask * a_)[..., None]
    im = Image.fromarray(np.clip(img, 0, 255).astype('uint8')).filter(ImageFilter.GaussianBlur(14))
    arr = np.asarray(im).astype(float)
    # vignette and grain
    v = 1 - .55 * (((xx - W / 2) / (W / 1.35)) ** 2 + ((yy - H / 2) / (H / 1.25)) ** 2)
    arr *= np.clip(v, .35, 1)[..., None]
    arr += rnd.normal(0, 3.2, arr.shape)
    return Image.fromarray(np.clip(arr, 0, 255).astype('uint8'))


def main():
    for name, (deep, mid, a, light) in PALETTE.items():
        out = ROOT / name / 'img'
        out.mkdir(parents=True, exist_ok=True)
        (out / 'hero.svg').write_text(ART[name](deep, mid, a, light), encoding='utf-8')
        (out / 'mark.svg').write_text(MARKS[name](a, light), encoding='utf-8')
        background(name, deep, mid, a, light).save(out / 'bg.webp', 'WEBP', quality=62, method=6)
        print(name, 'hero.svg', (out / 'hero.svg').stat().st_size // 1024, 'KB · bg.webp', (out / 'bg.webp').stat().st_size // 1024, 'KB')


if __name__ == '__main__':
    main()
