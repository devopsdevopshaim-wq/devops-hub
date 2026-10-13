# Build one cut of SPIDER v3 as a HyperFrames project: frames (gen.py) + overlay (letterbox, flashes) + index.html + audio.
# usage: python3 build.py <en|he>      en -> videos/spider-luxe, he -> videos/spider-luxe-he
import sys, os, json, shutil, subprocess

LANG = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
MAIN = os.path.dirname(HERE)
PROJ = MAIN if LANG == 'en' else os.path.join(os.path.dirname(MAIN), 'spider-luxe-he')
NAME = os.path.basename(PROJ)
W, H = 1920, 1080
SC = [('01-open', 0.0, 7.2), ('02-montage', 7.2, 7.2), ('03-slam', 14.4, 4.8), ('04-wall', 19.2, 7.2),
      ('05-ch-intelligence', 26.4, 9.6), ('06-ch-engineering', 36.0, 9.6), ('07-ch-life', 45.6, 9.6),
      ('08-ch-heritage', 55.2, 9.6), ('09-gallery', 64.8, 19.2), ('10-finale', 84.0, 9.6)]
TOTAL = 93.6
BIG = [7.2, 14.4, 19.2, 26.4, 84.0]
MID = [36.0, 45.6, 55.2, 64.8]
SMALL = ([round(7.2 + 0.6 * k, 2) for k in range(1, 12)] + [round(c + 2.4 * k, 2) for c in (26.4, 36.0, 45.6, 55.2) for k in (1, 2, 3)]
         + [round(64.8 + 0.6 * k, 2) for k in range(1, 32)])
LB = 0    # full-screen picture: no letterbox

if PROJ != MAIN:
    os.makedirs(PROJ, exist_ok=True)
    for f in ('hyperframes.json', 'CLAUDE.md', 'AGENTS.md', '.gitignore'):
        shutil.copy(os.path.join(MAIN, f), os.path.join(PROJ, f))
    json.dump({'id': NAME, 'name': NAME}, open(os.path.join(PROJ, 'meta.json'), 'w'), indent=2)
    pj = open(os.path.join(MAIN, 'package.json')).read().replace('"spider-luxe"', f'"{NAME}"')
    open(os.path.join(PROJ, 'package.json'), 'w').write(pj)
    for d in ('shots', 'sites', 'fonts', 'vendor'):
        shutil.rmtree(os.path.join(PROJ, 'assets', d), ignore_errors=True)
        shutil.copytree(os.path.join(MAIN, 'assets', d), os.path.join(PROJ, 'assets', d))
    shutil.copy(os.path.join(MAIN, 'assets', 'grain.png'), os.path.join(PROJ, 'assets', 'grain.png'))
    shutil.rmtree(os.path.join(PROJ, 'assets', 'audio'), ignore_errors=True)
    os.makedirs(os.path.join(PROJ, 'assets', 'audio'), exist_ok=True)
    shutil.copy(os.path.join(MAIN, 'assets', 'audio', 'score-he.m4a'), os.path.join(PROJ, 'assets', 'audio', 'score-he.m4a'))

shutil.rmtree(os.path.join(PROJ, 'compositions', 'frames'), ignore_errors=True)
subprocess.run([sys.executable, os.path.join(HERE, 'gen.py'), PROJ, LANG], check=True)

# ---- overlay: light flashes on the cuts ----
fl = ''
for i, t in enumerate(BIG + MID + SMALL):
    peak = .85 if t in BIG else .5 if t in MID else .12
    dd = .5 if t in BIG else .35 if t in MID else .18
    fl += (f"tl.fromTo('#flash', {{ opacity: {peak} }}, {{ opacity: 0, duration: {dd}, ease: 'power2.out', immediateRender: false }}, {t});\n")
overlay = f'''<template>
<style>
#root{{position:absolute;inset:0;width:100%;height:100%;overflow:hidden}}
.lb{{position:absolute;left:0;right:0;height:{LB}px;background:#000}}
#flash{{position:absolute;inset:0;background:radial-gradient(70% 70% at 50% 50%,rgba(255,244,220,1),rgba(242,222,172,.6));opacity:0;mix-blend-mode:screen}}
</style>
<div id="root" data-composition-id="overlay" data-width="{W}" data-height="{H}" data-duration="{TOTAL}">
<div class="clip" id="ov" data-start="0" data-duration="{TOTAL}" data-track-index="0" data-layout-allow-overflow data-layout-allow-occlusion>
<div id="flash"></div>
</div>
</div>
<script src="assets/vendor/gsap.min.js"></script>
<script>
(function(){{
const tl = gsap.timeline({{ paused: true }});
{fl}tl.to({{}}, {{ duration: {TOTAL} }}, 0);
window.__timelines["overlay"] = tl;
}})();
</script>
</template>
'''
open(os.path.join(PROJ, 'compositions', 'overlay.html'), 'w', encoding='utf-8').write(overlay)

hosts = ''
for i, (fid, st, d) in enumerate(SC):
    hosts += (f'      <div id="el-{fid}" class="scene" data-composition-id="{fid}" data-composition-src="compositions/frames/{fid}.html" '
              f'data-start="{st}" data-duration="{d}" data-track-index="{i % 2}"></div>\n')
hosts += (f'      <div id="el-overlay" class="scene" data-composition-id="overlay" data-composition-src="compositions/overlay.html" '
          f'data-start="0" data-duration="{TOTAL}" data-track-index="3"></div>\n')
audio = 'assets/audio/mix-en.m4a' if LANG == 'en' else 'assets/audio/score-he.m4a'
index = f'''<!DOCTYPE html>
<html lang="{LANG}">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width={W}, height={H}">
    <script src="assets/vendor/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ width: {W}px; height: {H}px; overflow: hidden; background: #000; }}
      #root {{ position: relative; width: {W}px; height: {H}px; overflow: hidden; background: #070608; }}
      .scene {{ position: absolute; inset: 0; width: 100%; height: 100%; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{TOTAL}" data-width="{W}" data-height="{H}">
{hosts}      <audio id="el-audio" src="{audio}" data-start="0" data-duration="{TOTAL}" data-track-index="10" data-volume="1"></audio>
    </div>
    <script>
      (function () {{
        window.__timelines = window.__timelines || {{}};
        const tl = gsap.timeline({{ paused: true }});
        tl.to({{}}, {{ duration: {TOTAL} }}, 0);
        window.__timelines["main"] = tl;
      }})();
    </script>
  </body>
</html>
'''
open(os.path.join(PROJ, 'index.html'), 'w', encoding='utf-8').write(index)
print('built', NAME)
