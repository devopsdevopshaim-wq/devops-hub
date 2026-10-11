# Build one SPIDER v2 cut as a HyperFrames project: frames (gen.py) + index.html + captions + audio.
# usage: python3 build.py <he|en> <wide|tall>
import sys, os, json, shutil, subprocess, re

LANG, FMT = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__))
MAIN = os.path.dirname(HERE)                      # videos/spider-promo
VIDEOS = os.path.dirname(MAIN)
NAME = {('he', 'wide'): 'spider-promo', ('en', 'wide'): 'spider-promo-en',
        ('he', 'tall'): 'spider-promo-ig', ('en', 'tall'): 'spider-promo-ig-en'}[(LANG, FMT)]
PROJ = os.path.join(VIDEOS, NAME)
W, H = (1920, 1080) if FMT == 'wide' else (1080, 1350)
EN = LANG == 'en'
IDS = ['01-thread', '02-thesis', '03-count', '04-ai', '05-engineering', '06-everyday', '07-creative', '08-web',
       '09-pipeline', '10-live', '11-cta', '12-brand']
STARTS = [0, 8, 17, 26, 37, 49, 59, 69, 81, 92, 100, 109]; TOTAL = 118
TRANS = ['cut', 'crossfade', 'zoom', 'crossfade', 'push', 'crossfade', 'crossfade', 'zoom', 'push', 'crossfade', 'zoom', 'crossfade']

if PROJ != MAIN:
    os.makedirs(PROJ, exist_ok=True)
    for f in ('hyperframes.json', 'package.json', 'CLAUDE.md', 'AGENTS.md', 'frame.md', '.gitignore'):
        shutil.copy(os.path.join(MAIN, f), os.path.join(PROJ, f))
    meta = json.load(open(os.path.join(MAIN, 'meta.json'))); meta['name'] = NAME; meta['id'] = NAME
    json.dump(meta, open(os.path.join(PROJ, 'meta.json'), 'w'), indent=2)
    if os.path.lexists(os.path.join(PROJ, 'assets')):
        shutil.rmtree(os.path.join(PROJ, 'assets'))
    shutil.copytree(os.path.join(MAIN, 'assets'), os.path.join(PROJ, 'assets'),
                    ignore=shutil.ignore_patterns('spider-score.m4a'))
    with open(os.path.join(PROJ, 'package.json')) as fp: pj = fp.read()
    open(os.path.join(PROJ, 'package.json'), 'w').write(pj.replace('"spider-promo"', f'"{NAME}"'))

subprocess.run([sys.executable, os.path.join(HERE, 'gen.py'), PROJ, FMT, LANG], check=True)

# ---- captions (English only): chunk each VO line into short groups, timed by character share ----
caps_host = ''
if EN:
    vo = json.load(open(os.path.join(HERE, 'vo_en.json')))
    groups = []
    for m in vo:
        parts = [p.strip() for p in re.split(r'(?<=[,.?])\s+', m['text']) if p.strip()]
        chunks = []
        for p in parts:
            ws = p.split()
            while len(ws) > 6:
                chunks.append(' '.join(ws[:5])); ws = ws[5:]
            chunks.append(' '.join(ws))
        tot = sum(len(c) for c in chunks); t = m['start']; span = m['end'] - m['start']
        for c in chunks:
            d = span * len(c) / tot; groups.append((round(t, 3), round(t + d, 3), c)); t += d
    fs = 40 if FMT == 'wide' else 44
    cy = int(H * 0.885)
    divs = ''.join(f'<div class="cap" id="cap-{i}" data-layout-allow-overlap><span>{c}</span></div>' for i, (a, b, c) in enumerate(groups))
    tw = ''.join(f"tl.fromTo('#cap-{i}', {{ opacity: 0, y: 10 }}, {{ opacity: 1, y: 0, duration: 0.18, ease: 'power2.out' }}, {a});"
                 f"tl.to('#cap-{i}', {{ opacity: 0, duration: 0.15, ease: 'power2.in' }}, {max(a + 0.3, (groups[i+1][0] - 0.02) if i + 1 < len(groups) and groups[i+1][0] - b < 0.25 else b + 0.12):.3f});\n"
                 for i, (a, b, c) in enumerate(groups))
    fonts = open(os.path.join(HERE, 'fonts.css')).read()
    cap_html = f'''<template>
<style>
{fonts}
#root{{position:absolute;inset:0;width:100%;height:100%;overflow:hidden}}
.cap{{position:absolute;left:0;right:0;top:{cy - fs}px;text-align:center;opacity:0}}
.cap span{{display:inline-block;font-family:'Assistant',sans-serif;font-weight:600;font-size:{fs}px;line-height:1.25;color:#f1eefc;background:rgba(15,13,36,.78);border:1px solid rgba(224,178,90,.35);padding:10px 26px;border-radius:14px}}
</style>
<div id="root" data-composition-id="captions" data-width="{W}" data-height="{H}" data-duration="{TOTAL}">
<div class="clip" id="cap-layer" data-start="0" data-duration="{TOTAL}" data-track-index="0">{divs}</div>
</div>
<script src="assets/vendor/gsap.min.js"></script>
<script>
(function(){{
const tl = gsap.timeline({{ paused: true }});
{tw}tl.to({{}}, {{ duration: {TOTAL} }}, 0);
window.__timelines["captions"] = tl;
}})();
</script>
</template>
'''
    os.makedirs(os.path.join(PROJ, 'compositions'), exist_ok=True)
    open(os.path.join(PROJ, 'compositions', 'captions.html'), 'w', encoding='utf-8').write(cap_html)
    caps_host = (f'      <div id="el-captions" class="scene" data-composition-id="captions" data-composition-src="compositions/captions.html" '
                 f'data-start="0" data-duration="{TOTAL}" data-track-index="2" data-track-kind="captions"></div>\n')

# ---- index.html ----
hosts = ''; tjs = ''
for i, fid in enumerate(IDS):
    start = STARTS[i]; end = STARTS[i + 1] if i + 1 < len(IDS) else TOTAL
    nxt = TRANS[i + 1] if i + 1 < len(IDS) else None
    over = {'crossfade': 0.5, 'zoom': 0.4, 'push': 0.5, None: 0}[nxt]
    hosts += (f'      <div id="el-{fid}" class="scene" data-composition-id="{fid}" data-composition-src="compositions/frames/{fid}.html" '
              f'data-start="{start}" data-duration="{round(end - start + over, 2)}" data-track-index="{i % 2}"></div>\n')
for i in range(1, len(IDS)):
    a, b, t, kind = f'#el-{IDS[i-1]}', f'#el-{IDS[i]}', STARTS[i], TRANS[i]
    if kind == 'crossfade':
        tjs += f'tl.to("{a}", {{ opacity: 0, duration: 0.5, ease: "power2.inOut" }}, {t});\ntl.fromTo("{b}", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.5, ease: "power2.inOut" }}, {t});\n'
    elif kind == 'zoom':
        tjs += (f'tl.to("{a}", {{ scale: 2.5, opacity: 0, filter: "blur(8px)", duration: 0.4, ease: "power3.in" }}, {t});\n'
                f'tl.fromTo("{b}", {{ scale: 0.5, opacity: 0, filter: "blur(8px)" }}, {{ scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.4, ease: "power3.out" }}, {t});\n')
    elif kind == 'push':
        d = -W if LANG == 'he' else W
        tjs += (f'tl.to("{a}", {{ x: {d}, duration: 0.5, ease: "power3.inOut" }}, {t});\n'
                f'tl.fromTo("{b}", {{ x: {-d}, opacity: 1 }}, {{ x: 0, opacity: 1, duration: 0.5, ease: "power3.inOut" }}, {t});\n')
audio = 'assets/bgm/score-v2-en-mix.m4a' if EN else 'assets/bgm/score-v2-he.m4a'
index = f'''<!DOCTYPE html>
<html lang="{LANG}">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width={W}, height={H}">
    <script src="assets/vendor/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ width: {W}px; height: {H}px; overflow: hidden; background: #000; }}
      #root {{ position: relative; width: {W}px; height: {H}px; overflow: hidden; background: #0F0D24; }}
      .scene {{ position: absolute; inset: 0; width: 100%; height: 100%; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{TOTAL}" data-width="{W}" data-height="{H}">
{hosts}{caps_host}      <audio id="el-bgm" src="{audio}" data-start="0" data-duration="{TOTAL}" data-track-index="11" data-volume="1"></audio>
    </div>
    <script>
      (function () {{
        const tl = gsap.timeline({{ paused: true }});
{tjs}        tl.to({{}}, {{ duration: {TOTAL} }}, 0);
        window.__timelines["main"] = tl;
      }})();
    </script>
  </body>
</html>
'''
open(os.path.join(PROJ, 'index.html'), 'w', encoding='utf-8').write(index)
print('built', NAME, f'{W}x{H}', 'captions' if EN else 'no captions')
