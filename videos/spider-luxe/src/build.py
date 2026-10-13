# Build one cut of SPIDER "The Atelier" as a HyperFrames project: frames (gen.py) + index.html + audio.
# usage: python3 build.py <en|he>      en -> videos/spider-luxe, he -> videos/spider-luxe-he
import sys, os, json, shutil, subprocess

LANG = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
MAIN = os.path.dirname(HERE)
PROJ = MAIN if LANG == 'en' else os.path.join(os.path.dirname(MAIN), 'spider-luxe-he')
NAME = os.path.basename(PROJ)
W, H = 1920, 1080
STARTS = [0, 6, 12.5, 20, 29, 38, 47, 55, 63]; TOTAL = 73; XF = 0.8
IDS = ['01-line', '02-name', '03-count', '04-intelligence', '05-engineering', '06-living', '07-heritage', '08-wall', '09-signature']
# how each scene enters: a slow dissolve, or a dissolve through soft blur and scale (the "lens" cut)
TRANS = [None, 'dissolve', 'lens', 'lens', 'dissolve', 'dissolve', 'dissolve', 'lens', 'dissolve']

if PROJ != MAIN:
    os.makedirs(PROJ, exist_ok=True)
    for f in ('hyperframes.json', 'CLAUDE.md', 'AGENTS.md', '.gitignore'):
        shutil.copy(os.path.join(MAIN, f), os.path.join(PROJ, f))
    json.dump({'id': NAME, 'name': NAME}, open(os.path.join(PROJ, 'meta.json'), 'w'), indent=2)
    pj = open(os.path.join(MAIN, 'package.json')).read().replace('"spider-luxe"', f'"{NAME}"')
    open(os.path.join(PROJ, 'package.json'), 'w').write(pj)
    for d in ('shots', 'fonts', 'vendor'):
        shutil.rmtree(os.path.join(PROJ, 'assets', d), ignore_errors=True)
        shutil.copytree(os.path.join(MAIN, 'assets', d), os.path.join(PROJ, 'assets', d))
    shutil.copy(os.path.join(MAIN, 'assets', 'grain.png'), os.path.join(PROJ, 'assets', 'grain.png'))
    os.makedirs(os.path.join(PROJ, 'assets', 'audio'), exist_ok=True)
    shutil.copy(os.path.join(MAIN, 'assets', 'audio', 'score-he.m4a'), os.path.join(PROJ, 'assets', 'audio', 'score-he.m4a'))

subprocess.run([sys.executable, os.path.join(HERE, 'gen.py'), PROJ, LANG], check=True)

hosts = ''; tjs = ''
for i, fid in enumerate(IDS):
    end = STARTS[i + 1] + XF if i + 1 < len(IDS) else TOTAL
    hosts += (f'      <div id="el-{fid}" class="scene" data-composition-id="{fid}" data-composition-src="compositions/frames/{fid}.html" '
              f'data-start="{STARTS[i]}" data-duration="{round(end - STARTS[i], 2)}" data-track-index="{i % 2}"></div>\n')
for i in range(1, len(IDS)):
    a, b, t = f'#el-{IDS[i-1]}', f'#el-{IDS[i]}', STARTS[i]
    if TRANS[i] == 'dissolve':
        tjs += (f'        tl.to("{a}", {{ opacity: 0, duration: {XF}, ease: "sine.inOut" }}, {t});\n'
                f'        tl.fromTo("{b}", {{ opacity: 0 }}, {{ opacity: 1, duration: {XF}, ease: "sine.inOut" }}, {t});\n')
    else:
        tjs += (f'        tl.to("{a}", {{ opacity: 0, scale: 1.08, filter: "blur(12px)", duration: {XF}, ease: "power2.in" }}, {t});\n'
                f'        tl.fromTo("{b}", {{ opacity: 0, scale: 0.94, filter: "blur(12px)" }}, {{ opacity: 1, scale: 1, filter: "blur(0px)", duration: {XF + 0.4}, ease: "power3.out" }}, {t});\n')
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
      #root {{ position: relative; width: {W}px; height: {H}px; overflow: hidden; background: #09080A; }}
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
{tjs}        tl.to({{}}, {{ duration: {TOTAL} }}, 0);
        window.__timelines["main"] = tl;
      }})();
    </script>
  </body>
</html>
'''
open(os.path.join(PROJ, 'index.html'), 'w', encoding='utf-8').write(index)
print('built', NAME)
