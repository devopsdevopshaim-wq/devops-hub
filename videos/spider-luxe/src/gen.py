# SPIDER v3 — full-screen, beat-cut brand film showing every project. One generator for both cuts (English and Hebrew), 1920x1080.
# usage: python3 gen.py <project_dir> <en|he>
# Tempo: 100 BPM, beat 0.6s, bar 2.4s. Every scene starts on a bar line.
import sys, os, math, random, glob
from PIL import Image

PROJ, LANG = sys.argv[1], sys.argv[2]
HE = LANG == 'he'
W, H = 1920, 1080
HERE = os.path.dirname(os.path.abspath(__file__))
MAIN = os.path.dirname(HERE)
FONTS = open(os.path.join(HERE, 'fonts.css')).read()
BEAT, BAR = 0.6, 2.4
SC = [  # id, start, length (s)
    ('01-open', 0.0, 7.2), ('02-montage', 7.2, 7.2), ('03-slam', 14.4, 4.8), ('04-wall', 19.2, 7.2),
    ('05-ch-intelligence', 26.4, 9.6), ('06-ch-engineering', 36.0, 9.6), ('07-ch-life', 45.6, 9.6),
    ('08-ch-heritage', 55.2, 9.6), ('09-gallery', 64.8, 19.2), ('10-finale', 84.0, 9.6)]
TOTAL = 93.6
PROJECTS = 51

def T(en, he): return he if HE else en
DIR = 'rtl' if HE else 'ltr'
ALIGN = 'right' if HE else 'left'
SIDE = 'right' if HE else 'left'
GOLD, GOLD_HI, IVORY, MUTED, ONYX = '#d6b46e', '#f2deac', '#f3ede2', '#9a9284', '#070608'

def site_h(name):
    w, h = Image.open(f'{MAIN}/assets/sites/{name}.jpg').size
    return h / w   # height per unit width

SHOTS = sorted(os.path.basename(p)[:-4] for p in glob.glob(f'{MAIN}/assets/shots/*.jpg'))

BASE_CSS = f'''
#root{{position:absolute;inset:0;width:100%;height:100%;overflow:hidden;color:{IVORY};font-family:'Assistant',sans-serif}}
.§-bg{{position:absolute;inset:0;background:radial-gradient(85% 75% at 50% 42%,#1b160f 0%,#0d0b09 48%,{ONYX} 100%)}}
.§-dust{{position:absolute;border-radius:50%;background:{GOLD_HI}}}
.§-grain{{position:absolute;left:-256px;top:-256px;width:{W+512}px;height:{H+512}px;background:url(assets/grain.png);opacity:.07;mix-blend-mode:overlay}}
.§-vig{{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 48%,rgba(0,0,0,0) 48%,rgba(0,0,0,.78) 100%)}}
.§-ov{{position:absolute;left:0;top:0;width:{W}px;height:{H}px;overflow:visible}}
.§-m{{display:inline-block;overflow:hidden;vertical-align:top;padding:0 .05em .16em}}
.§-w{{display:inline-block;white-space:pre}}
.§-hair{{stroke:{GOLD};stroke-width:1.4;fill:none}}
.§-beam{{position:absolute;width:300px;height:2600px;left:50%;top:50%;margin:-1300px 0 0 -150px;background:linear-gradient(90deg,rgba(255,226,160,0),rgba(255,226,160,.13) 50%,rgba(255,226,160,0));mix-blend-mode:screen;transform-origin:50% 50%}}
.§-win{{position:absolute;border-radius:14px;overflow:hidden;background:#0c0b0d;border:1px solid rgba(214,180,110,.45);box-shadow:0 60px 120px rgba(0,0,0,.8),0 0 0 1px rgba(0,0,0,.7)}}
.§-bar{{position:absolute;left:0;right:0;top:0;height:44px;background:linear-gradient(#1a1816,#121012);border-bottom:1px solid rgba(214,180,110,.25);direction:ltr}}
.§-dots{{position:absolute;left:18px;top:16px;width:60px;height:12px}}
.§-dots i{{display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:8px;background:#3a352e}}
.§-url{{position:absolute;left:50%;top:9px;transform:translateX(-50%);height:26px;line-height:26px;padding:0 22px;border-radius:13px;background:#0a090b;border:1px solid rgba(214,180,110,.22);font-family:'JetBrains Mono',monospace;font-size:14px;color:#b9b0a0;white-space:nowrap}}
.§-url b{{color:{GOLD_HI};font-weight:500}}
.§-vp{{position:absolute;left:0;right:0;top:44px;bottom:0;overflow:hidden;background:#0c0b0d}}
.§-vp img{{position:absolute;left:0;top:0;width:100%;display:block}}
.§-sheen{{position:absolute;top:-30%;left:0;width:30%;height:160%;background:linear-gradient(100deg,rgba(255,240,210,0),rgba(255,240,210,.16),rgba(255,240,210,0));pointer-events:none}}
'''

def dust(n, seed):
    r = random.Random(seed); o = ''
    for i in range(n):
        x, y, s = r.uniform(0, W), r.uniform(0, H), r.uniform(1.0, 3.6)
        o += (f'<i class="§-dust" data-dy="{r.uniform(-80,-220):.0f}" data-dx="{r.uniform(-50,50):.0f}" '
              f'style="left:{x:.0f}px;top:{y:.0f}px;width:{s:.1f}px;height:{s:.1f}px;opacity:{r.uniform(.12,.55):.2f}"></i>')
    return o

def words(t):
    ws = t.split()
    return ''.join(f'<span class="§-m"><span class="§-w">{w}</span></span>{" " if i < len(ws) - 1 else ""}' for i, w in enumerate(ws))

def url_of(site):
    return {'services': 'portfolio/services.html'}.get(site, site + '/')

def browser(bid, sites, x, y, w, h, extra_style=''):
    """a browser window; several sites stack in the viewport so a scene can swap pages inside one window"""
    imgs = ''.join(f'<img id="§-{bid}-i{k}" src="assets/sites/{s}.jpg" alt="" style="opacity:{1 if k == 0 else 0}">' for k, s in enumerate(sites))
    urls = ''.join(f'<span class="§-url" id="§-{bid}-u{k}" style="opacity:{1 if k == 0 else 0}">devopsdevopshaim-wq.github.io/devops-hub/<b>{url_of(s)}</b></span>' for k, s in enumerate(sites))
    return (f'<div class="§-win" id="§-{bid}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;{extra_style}">'
            f'<div class="§-bar"><span class="§-dots"><i></i><i></i><i></i></span>{urls}</div>'
            f'<div class="§-vp">{imgs}</div><div class="§-sheen" id="§-{bid}-sh"></div></div>')

def scroll_js(bid, k, site, w, h, t0, d, frac=0.85, ease='power2.inOut'):
    """scroll site k of window bid from the top through `frac` of its scrollable height"""
    img_h = site_h(site) * w; travel = max(0.0, img_h - (h - 44)) * frac
    travel = min(travel, 2600)
    return f"tl.fromTo('#§-{bid}-i{k}', {{ y: 0 }}, {{ y: -{travel:.0f}, duration: {d}, ease: '{ease}' }}, {t0});\n"

PL = 'pathLength="1" style="stroke-dasharray:1;stroke-dashoffset:1"'

COMMON_JS = r'''
const tl = gsap.timeline({ paused: true });
const Q = s => document.querySelector(s);
const QA = s => Array.from(document.querySelectorAll(s));
const HE = __HE__, D = __D__;
const rise = (sel, at, opt) => tl.fromTo(sel, { yPercent: 118, opacity: 0 }, Object.assign({ yPercent: 0, opacity: 1, duration: 0.9, ease: 'expo.out', stagger: 0.06 }, opt || {}), at);
const sink = (sel, at, opt) => tl.to(sel, Object.assign({ yPercent: -118, opacity: 0, duration: 0.45, ease: 'power3.in', stagger: 0.03 }, opt || {}), at);
const fadeUp = (sel, at, opt) => tl.fromTo(sel, { y: 16, opacity: 0, filter: 'blur(8px)' }, Object.assign({ y: 0, opacity: 1, filter: 'blur(0px)', duration: 1.0, ease: 'power3.out' }, opt || {}), at);
const draw = (sel, at, d, ease) => tl.fromTo(sel, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: d || 1.4, ease: ease || 'power2.inOut' }, at);
const sheen = (id, at) => tl.fromTo('#§-' + id + '-sh', { xPercent: -160 }, { xPercent: 420, duration: 1.3, ease: 'power2.inOut' }, at);
const swap = (bid, from, to, at) => {
  tl.to('#§-' + bid + '-i' + from, { opacity: 0, x: HE ? 120 : -120, filter: 'blur(10px)', duration: 0.35, ease: 'power3.in' }, at);
  tl.fromTo('#§-' + bid + '-i' + to, { opacity: 0, x: HE ? -120 : 120, filter: 'blur(10px)' }, { opacity: 1, x: 0, filter: 'blur(0px)', duration: 0.5, ease: 'power3.out' }, at + 0.25);
  tl.to('#§-' + bid + '-u' + from, { opacity: 0, duration: 0.25 }, at);
  tl.to('#§-' + bid + '-u' + to, { opacity: 1, duration: 0.3 }, at + 0.3);
};
const shake = (sel, at, amp) => { const a = amp || 10; [[a, -a * .6], [-a * .8, a * .5], [a * .5, a * .4], [-a * .3, -a * .2], [0, 0]].forEach((p, i) => tl.to(sel, { x: p[0], y: p[1], duration: 0.05, ease: 'none' }, at + i * 0.05)); };
QA('.§-dust').forEach(p => tl.fromTo(p, { x: 0, y: 0 }, { x: +p.dataset.dx, y: +p.dataset.dy, duration: D, ease: 'none' }, 0));
tl.fromTo('#§-grain', { x: 0, y: 0 }, { x: -192, y: 128, duration: D, ease: 'steps(' + Math.round(D * 12) + ')' }, 0);
'''

def frame(idx, css, body, js, seed=1, ndust=40):
    fid, _, d = SC[idx]
    bg = (f'<div id="§-bgclip" class="clip §-bg" data-start="0" data-duration="{d}" data-track-index="0">'
          f'<div id="§-dustl">{dust(ndust, seed)}</div></div>')
    fx = (f'<div id="§-fx" class="clip" data-start="0" data-duration="{d}" data-track-index="2" data-layout-allow-overflow>'
          f'<div class="§-vig"></div><div class="§-grain" id="§-grain"></div></div>')
    js_all = COMMON_JS.replace('__HE__', 'true' if HE else 'false').replace('__D__', str(d)) + js
    html = f'''<template>
<style>
{FONTS}
{BASE_CSS}
{css}
</style>
<div id="root" data-composition-id="{fid}" data-width="{W}" data-height="{H}" data-duration="{d}">
{bg}
<div class="clip" data-start="0" data-duration="{d}" data-track-index="1" id="§-stage" data-layout-allow-overflow data-layout-allow-occlusion>
{body}
</div>
{fx}
</div>
<script src="assets/vendor/gsap.min.js"></script>
<script>
(function(){{
{js_all}
tl.to({{}}, {{ duration: {d} }}, 0);
window.__timelines["{fid}"] = tl;
}})();
</script>
</template>
'''
    html = html.replace('§', 'f' + fid[:2])
    os.makedirs(f'{PROJ}/compositions/frames', exist_ok=True)
    open(f'{PROJ}/compositions/frames/{fid}.html', 'w', encoding='utf-8').write(html)

def web_svg(cx, cy, r, sid='web'):
    spokes = ''.join(f'<line class="§-hair §-sp" x1="{cx}" y1="{cy}" x2="{cx + r*math.cos(math.pi/6 + k*math.pi/3):.1f}" y2="{cy + r*math.sin(math.pi/6 + k*math.pi/3):.1f}" {PL}/>' for k in range(6))
    rings = ''
    for f in (0.36, 0.66, 0.96):
        pts = ' '.join(f'{cx + r*f*math.cos(math.pi/6 + k*math.pi/3):.1f},{cy + r*f*math.sin(math.pi/6 + k*math.pi/3):.1f}' for k in range(7))
        rings += f'<polyline class="§-hair §-rg" points="{pts}" {PL}/>'
    return f'<g id="§-{sid}">{spokes}{rings}<circle id="§-core" cx="{cx}" cy="{cy}" r="5" fill="{GOLD_HI}"/></g>'

def beams(n=3, seed=1):
    r = random.Random(seed)
    return ''.join(f'<div class="§-beam" id="§-beam{k}" style="transform:rotate({r.uniform(-40,40):.0f}deg)"></div>' for k in range(n))

def beams_js(n, d, seed=1):
    r = random.Random(seed + 100)
    return ''.join(f"tl.fromTo('#§-beam{k}', {{ opacity: 0, rotation: {r.uniform(-50,-10):.0f} }}, {{ opacity: 1, rotation: {r.uniform(10,50):.0f}, duration: {d}, ease: 'sine.inOut' }}, 0);\n" for k in range(n))

# ======================= scenes =======================
def s01_open():
    cx, cy = W / 2, H / 2 - 40
    css = f'''.§-big{{position:absolute;left:0;right:0;text-align:center;direction:{DIR};font-family:'Bellefair',serif;color:{IVORY};line-height:1}}
#§-l1{{top:{cy-70}px;font-size:{124 if HE else 118}px}}
#§-l2{{top:{cy-70}px;font-size:{124 if HE else 118}px;color:{GOLD_HI}}}
#§-flare{{position:absolute;left:0;top:{cy+120}px;width:{W}px;height:2px;background:linear-gradient(90deg,rgba(255,230,180,0),rgba(255,230,180,.9) 50%,rgba(255,230,180,0))}}
#§-glow{{position:absolute;left:{cx-500}px;top:{cy-500}px;width:1000px;height:1000px;background:radial-gradient(closest-side,rgba(214,180,110,.14),rgba(214,180,110,0))}}'''
    body = (f'<div id="§-glow"></div>{beams(3, 1)}<svg class="§-ov" viewBox="0 0 {W} {H}" style="opacity:.35">{web_svg(cx, cy, 380)}</svg>'
            f'<div id="§-flare"></div>'
            f'<div class="§-big" id="§-l1">{words(T("Fifty-one systems.", "חמישים ואחת מערכות."))}</div>'
            f'<div class="§-big" id="§-l2">{words(T("One mind.", "מוח אחד."))}</div>')
    js = beams_js(3, 7.2, 1) + f'''tl.fromTo('#§-glow', {{ opacity: 0, scale: .6 }}, {{ opacity: 1, scale: 1, duration: 4, ease: 'power2.out' }}, 0);
draw(QA('.§-sp'), 0.2, 2.4, 'power3.out'); QA('.§-rg').forEach((g, i) => draw(g, 0.8 + i * 0.4, 2.2));
tl.to('#§-web', {{ rotation: 18, svgOrigin: '{cx} {cy}', duration: 7.2, ease: 'none' }}, 0);
tl.fromTo('#§-flare', {{ scaleX: 0, opacity: 0 }}, {{ scaleX: 1, opacity: 1, duration: 1.2, ease: 'expo.out' }}, 1.2);
tl.to('#§-flare', {{ opacity: 0, duration: 1.0 }}, 2.6);
rise('#§-l1 .§-w', 1.2, {{ duration: 1.1 }});
sink('#§-l1 .§-w', 4.2);
rise('#§-l2 .§-w', 4.8, {{ duration: 1.0 }});
tl.to('#§-l2', {{ scale: 1.06, duration: 2.4, ease: 'none' }}, 4.8);'''
    frame(0, css, body, js, seed=3, ndust=50)

# ---------- data: every project, its name in both languages and its address ----------
import json as _json
_PJ = {p['id']: p for p in _json.load(open(os.path.join(MAIN, '..', '..', 'portfolio', 'projects.json')))['projects']}
EN_NAMES = {
 'vacation-hub': 'Masa · Vacation planner', 'book-studio': 'Book Studio', 'comic-studio': 'Panel · Comic Studio',
 'electro-fix': 'Closed Circuit · Electrical faults', 'netplan': 'NetPlan · Network design', 'automation': 'DrivePlan · VFD & automation',
 'robotic-parking': 'ParkPlan · Robotic parking', 'assembly-studio': 'Assembly Studio', 'cabinet-wiring': 'CabinetPlan · Panel wiring',
 'interior': 'Mitar · Interior design', 'devops-hubnew': 'DevOps Hub', 'hapinkas-hayomi': 'The Daily Notebook',
 'smart-office-assistant': 'Smart Office Assistant', 'rork-app': 'Rork App', 'devops-course-he': 'My Academy · DevOps & AI',
 'health-compass': 'Health Compass', 'astrology-decoder': 'Astrology Decoder', 'jarvis-web': 'JARVIS · Multi-agent assistant',
 'housing-system': 'DiraFinder · Apartment search', 'project-2026-01-03-new': 'PRO Network Host', 'project-2026-01-03-new2': 'ProDev Host',
 'files-management': 'HTML File Hosting', 'manage-files': 'Archivum Pro', 'project-2026-01-19': 'Video Downloader',
 'data-management': 'ProDev Host Extended', 'warehouse-management': 'Smart WMS · Warehouse', 'warehouse-management-v2': 'Stock & Spare Parts',
 'warehouse-management-v1': 'Mantis WMS', 'recipe-calculator': 'The Recipe Book', 'translate-dub': 'VocalizePro · Translate & dub',
 'hebrew-calendar': 'Hebrew Calendar 5786', 'israel-holidays': 'Israel Holidays Browser', 'lotto': 'Lotto Predictor',
 'lotto-new': 'Lotto · Smart system', 'lotto-series': 'Lotto Series Forecast', 'lotto-series-pro': 'Lotto Pro · Probabilities',
 'zohar': 'Parasha Calendar', 'zohar-v1': 'Zohar & Kabbalah', 'graphology': 'Graphology Lab', 'parkomat': 'Parkomat',
 'finance-hub': 'Finance Compass', 'bills-hub': 'Home Bills', 'marketing-hub': 'Campaign Builder', 'aia-studio': 'AIA Design Studio',
 'wellness-hub': 'Health & Fitness Compass', 'torah-hub': 'Sacred Library', 'dreams-hub': 'Pesher · Dream interpretation',
 'ayin-hara': 'Evil Eye & Dreams', 'services': 'SPIDER · Services'}
def pname(pid):
    if HE:
        return _PJ[pid]['title'] if pid in _PJ else 'SPIDER · שירותים ומחירים'
    return EN_NAMES.get(pid, pid)
def paddr(pid):
    if pid == 'services': return 'devopsdevopshaim-wq.github.io/devops-hub/portfolio/services.html'
    p = _PJ.get(pid, {}); u = p.get('url') or ''
    if u: return u.replace('https://', '').split('#')[0].split('?')[0].rstrip('/')
    return 'github.com/devopsdevopshaim-wq/' + (p.get('repo') or pid)

FULL_CSS = f'''
.§-full{{position:absolute;inset:0;overflow:hidden;background:#0c0b0d}}
.§-full img{{position:absolute;left:0;top:0;width:{W}px;display:block;transform-origin:50% 0%}}
.§-shade{{position:absolute;left:0;right:0;bottom:0;height:330px;background:linear-gradient(rgba(7,6,8,0),rgba(7,6,8,.88) 70%)}}
.§-lab{{position:absolute;bottom:64px;{SIDE}:90px;direction:{DIR};text-align:{ALIGN}}}
.§-lab .§-ln{{display:block;width:70px;height:2px;background:{GOLD};margin-bottom:18px;{'margin-left:auto' if HE else ''}}}
.§-lab .§-nm{{font-family:'Bellefair',serif;font-size:{58 if HE else 54}px;line-height:1.05;color:{IVORY};text-shadow:0 4px 30px rgba(0,0,0,.7)}}
.§-lab .§-ad{{margin-top:12px;direction:ltr;font-family:'JetBrains Mono',monospace;font-size:20px;color:{GOLD_HI};opacity:.85}}
.§-tag{{position:absolute;top:56px;{SIDE}:90px;direction:{DIR};font-family:{"'Assistant',sans-serif;font-weight:600;font-size:26px;letter-spacing:.1em" if HE else "'Michroma',sans-serif;font-size:15px;letter-spacing:.38em"};color:{GOLD};text-transform:uppercase;text-shadow:0 2px 20px rgba(0,0,0,.9)}}
.§-topshade{{position:absolute;left:0;right:0;top:0;height:200px;background:linear-gradient(rgba(7,6,8,.75),rgba(7,6,8,0))}}
'''

def full_html(fid, kind, src):
    path = f'assets/sites/{src}.jpg' if kind == 'site' else f'assets/shots/{src}.jpg'
    return f'<div class="§-full" id="§-{fid}" style="opacity:0"><img id="§-{fid}-i" src="{path}" alt=""></div>'

def full_js(fid, kind, src, t0, d, frac=0.75, fade=0.0):
    """show one full-screen page from t0 for d seconds: a scroll for captured sites, a slow push for screenshots"""
    js = f"tl.set('#§-{fid}', {{ opacity: 1 }}, {t0}); tl.set('#§-{fid}', {{ opacity: 0 }}, {round(t0 + d, 3)});\n"
    if kind == 'site':
        hh = site_h(src) * W; travel = min(max(0.0, hh - H) * frac, 2400)
        js += f"tl.fromTo('#§-{fid}-i', {{ y: 0, scale: 1.06 }}, {{ y: -{travel:.0f}, scale: 1.0, duration: {d}, ease: 'power2.inOut' }}, {t0});\n"
    else:   # a 1280x800 screenshot shown 1920 wide: push in and drift down its upper part
        js += f"tl.fromTo('#§-{fid}-i', {{ y: 0, scale: 1.0 }}, {{ y: -110, scale: 1.08, duration: {d}, ease: 'sine.inOut' }}, {t0});\n"
    return js

def label_html(lid, pid):
    return (f'<div class="§-lab" id="§-{lid}" style="opacity:0"><span class="§-ln"></span>'
            f'<div class="§-nm">{pname(pid)}</div><div class="§-ad">{paddr(pid)}</div></div>')

def label_js(lid, t0, d, quick=False):
    a = min(.25 if quick else .5, max(.1, d - .4))
    return (f"tl.set('#§-{lid}', {{ opacity: 0 }}, {t0}); tl.fromTo('#§-{lid}', {{ opacity: 0, y: 18 }}, {{ opacity: 1, y: 0, duration: {a}, ease: 'expo.out' }}, {round(t0 + (0.05 if quick else 0.25), 3)});\n"
            f"tl.set('#§-{lid}', {{ opacity: 0 }}, {round(t0 + d, 3)});\n")

MONTAGE = ['robotic-parking', 'vacation-hub', 'finance-hub', 'aia-studio', 'dreams-hub', 'wellness-hub',
           'cabinet-wiring', 'marketing-hub', 'torah-hub', 'services', 'netplan', 'ayin-hara']

def s02_montage():
    body = ''; js = ''
    for k, s in enumerate(MONTAGE):
        t0 = round(k * BEAT, 2)
        body += full_html(f'm{k}', 'site', s)
        js += full_js(f'm{k}', 'site', s, t0, BEAT, 0.3)
        js += f"tl.fromTo('#§-m{k}', {{ scale: 1.12 }}, {{ scale: 1.0, duration: {BEAT}, ease: 'power3.out' }}, {t0});\n"
    css = FULL_CSS + f'''#§-dim{{position:absolute;inset:0;background:radial-gradient(60% 60% at 50% 50%,rgba(7,6,8,.78),rgba(7,6,8,.45))}}
.§-kw{{position:absolute;left:0;right:0;top:{H/2-95}px;text-align:center;direction:{DIR};font-family:'Bellefair',serif;font-size:{190 if HE else 180}px;line-height:1;color:{IVORY};text-shadow:0 10px 60px rgba(0,0,0,.9)}}'''
    kws = [T('Designed.', 'מעוצב.'), T('Engineered.', 'מהונדס.'), T('Live.', 'באוויר.')]
    body += '<div id="§-dim"></div>' + ''.join(f'<div class="§-kw" id="§-k{i}">{words(t)}</div>' for i, t in enumerate(kws))
    for i in range(3):
        a = i * BAR
        js += f"rise('#§-k{i} .§-w', {a + 0.05}, {{ duration: 0.6 }}); tl.fromTo('#§-k{i}', {{ scale: 1.08 }}, {{ scale: 1, duration: {BAR - 0.45}, ease: 'power2.out' }}, {a});\n"
        if i < 2: js += f"tl.to('#§-k{i}', {{ opacity: 0, duration: 0.2 }}, {a + BAR - 0.2});\n"
    js += "tl.to('#§-k2', { opacity: 0, scale: 1.3, filter: 'blur(10px)', duration: 0.4, ease: 'power2.in' }, 6.8);\n"
    frame(1, css, body, js, seed=5, ndust=0)

def s04_wall():
    """pull back from one tile to a full-screen wall of every project, counting to 51"""
    cols, rows = 8, 7; tw, th = W // cols, 1050 // rows
    tiles_src = [('shots', s) for s in SHOTS if s not in ('gamma-deck',)] + [('sites', 'services'), ('sites', 'ayin-hara'), ('sites', 'cabinet-wiring'), ('sites', 'dreams-hub')]
    r = random.Random(12); r.shuffle(tiles_src)
    while len(tiles_src) < cols * rows: tiles_src.append(tiles_src[len(tiles_src) % 40])
    tiles = ''
    for k in range(cols * rows):
        c, rr = k % cols, k // cols; kind, s = tiles_src[k]
        tiles += (f'<div class="§-tile" style="left:{c*tw}px;top:{15 + rr*th}px;width:{tw}px;height:{th}px">'
                  f'<img src="assets/{kind}/{s}.jpg" alt=""></div>')
    css = f'''#§-wall{{position:absolute;left:0;top:0;width:{W}px;height:{H}px;transform-origin:50% 50%}}
.§-tile{{position:absolute;overflow:hidden;border:1px solid rgba(7,6,8,1);box-shadow:inset 0 0 0 1px rgba(214,180,110,.35)}}
.§-tile img{{width:100%;height:100%;object-fit:cover;object-position:top;display:block}}
#§-plate{{position:absolute;left:{W/2-520}px;top:{H/2-300}px;width:1040px;height:600px;background:radial-gradient(closest-side,rgba(7,6,8,.96) 55%,rgba(7,6,8,0))}}
#§-num{{position:absolute;left:0;right:0;top:300px;text-align:center;font-family:'Bellefair',serif;font-size:330px;line-height:1;color:{GOLD_HI};text-shadow:0 0 90px rgba(214,180,110,.4)}}
#§-cap{{position:absolute;left:0;right:0;top:650px;text-align:center;direction:{DIR};font-family:'Bellefair',serif;font-size:{60 if HE else 56}px;color:{IVORY}}}'''
    body = (f'<div id="§-wall">{tiles}</div><div id="§-plate"></div><div id="§-num">0</div>'
            f'<div id="§-cap">{words(T("Live systems. Built from scratch.", "מערכות חיות. נבנו מאפס."))}</div>')
    js = f'''tl.fromTo('#§-wall', {{ scale: 7.5 }}, {{ scale: 1.0, duration: 4.2, ease: 'expo.inOut' }}, 0);
tl.to('#§-wall', {{ scale: 1.06, duration: 3.0, ease: 'none' }}, 4.2);
const tl_tiles = QA('.§-tile'); tl_tiles.forEach((t, i) => tl.fromTo(t, {{ opacity: 0.15 }}, {{ opacity: 1, duration: 0.25, ease: 'power2.out' }}, 0.6 + ((i * 37) % 56) * 0.055));
tl.fromTo('#§-plate', {{ opacity: 0 }}, {{ opacity: 1, duration: 0.8 }}, 2.6);
const cnt = {{ v: 0 }};
tl.to(cnt, {{ v: {PROJECTS}, duration: 3.4, ease: 'power3.out', onUpdate: () => {{ Q('#§-num').textContent = Math.round(cnt.v); }} }}, 0.6);
tl.fromTo('#§-num', {{ opacity: 0, scale: 0.85 }}, {{ opacity: 1, scale: 1, duration: 1.0, ease: 'expo.out' }}, 2.6);
tl.to('#§-num', {{ scale: 1.08, duration: 0.25, yoyo: true, repeat: 1, ease: 'power2.out' }}, 4.0);
rise('#§-cap .§-w', 4.2);
tl.to(['#§-num', '#§-cap', '#§-plate'], {{ opacity: 0, duration: 0.4, ease: 'power2.in' }}, 6.8);'''
    frame(3, css, body, js, seed=11, ndust=0)

CHAPTERS = [
 ('01', T('Intelligence & studios', 'בינה וסטודיו'), T('Intelligence that creates.', 'בינה שיוצרת.'),
  [('site', 'aia-studio'), ('site', 'comic-studio'), ('site', 'book-studio'), ('site', 'marketing-hub')]),
 ('02', T('Engineering', 'הנדסה'), T('Down to the last wire.', 'עד החוט האחרון.'),
  [('site', 'robotic-parking'), ('site', 'cabinet-wiring'), ('site', 'automation'), ('site', 'electro-fix')]),
 ('03', T('Life', 'חיים'), T('Tools that run a life.', 'כלים שמנהלים חיים.'),
  [('site', 'vacation-hub'), ('site', 'wellness-hub'), ('site', 'finance-hub'), ('site', 'bills-hub')]),
 ('04', T('Heritage', 'מורשת'), T('A library for the soul.', 'ספרייה לנשמה.'),
  [('site', 'torah-hub'), ('site', 'dreams-hub'), ('site', 'ayin-hara'), ('shot', 'hebrew-calendar')]),
]

def chapter(idx, ci, seed):
    num, eye, title, pages = CHAPTERS[ci]
    d = SC[idx][2]; seg = d / len(pages)
    body = ''; js = ''
    for k, (kind, src) in enumerate(pages):
        t0 = round(k * seg, 3)
        body += full_html(f'p{k}', kind, src)
        js += full_js(f'p{k}', kind, src, t0, seg, 0.45)
    body += '<div class="§-topshade"></div><div class="§-shade"></div>'
    for k, (kind, src) in enumerate(pages):
        body += label_html(f'l{k}', src)
        js += label_js(f'l{k}', round(k * seg + (1.5 if k == 0 else 0), 3), round(seg - (1.5 if k == 0 else 0), 3))
    css = FULL_CSS + f'''#§-card{{position:absolute;inset:0;background:linear-gradient({'270deg' if HE else '90deg'},rgba(7,6,8,.94) 30%,rgba(7,6,8,.35) 75%,rgba(7,6,8,.1))}}
#§-tb{{position:absolute;top:330px;{SIDE}:120px;width:900px;direction:{DIR};text-align:{ALIGN}}}
#§-num{{font-family:'Bellefair',serif;font-size:190px;line-height:.9;color:transparent;-webkit-text-stroke:1.6px {GOLD}}}
#§-eye{{display:block;margin-top:24px;font-family:{"'Assistant',sans-serif;font-weight:600;font-size:30px;letter-spacing:.14em" if HE else "'Michroma',sans-serif;font-size:19px;letter-spacing:.42em"};color:{GOLD};text-transform:uppercase}}
#§-title{{margin-top:20px;font-family:'Bellefair',serif;font-size:{100 if HE else 94}px;line-height:1.04;color:{IVORY}}}'''
    body += (f'<div class="§-tag" id="§-tagc">{num} · {eye}</div>'
             f'<div id="§-card"></div><div id="§-tb"><div id="§-num">{num}</div><span id="§-eye">{eye}</span><div id="§-title">{words(title)}</div></div>')
    sgn = -1 if HE else 1
    js += f'''tl.fromTo('#§-num', {{ opacity: 0, x: {-60*sgn} }}, {{ opacity: 1, x: 0, duration: 0.9, ease: 'expo.out' }}, 0.0);
tl.fromTo('#§-eye', {{ opacity: 0 }}, {{ opacity: 1, duration: 0.6 }}, 0.2);
rise('#§-title .§-w', 0.25);
tl.to('#§-tb', {{ opacity: 0, x: {-60*sgn}, filter: 'blur(8px)', duration: 0.45, ease: 'power3.in' }}, 1.75);
tl.fromTo('#§-card', {{ opacity: 1 }}, {{ opacity: 0, duration: 0.6, ease: 'power2.inOut' }}, 1.8);
tl.fromTo('#§-tagc', {{ opacity: 0 }}, {{ opacity: 1, duration: 0.6 }}, 2.0);
'''
    frame(idx, css, body, js, seed=seed, ndust=0)

def s05(): chapter(4, 0, 13)
def s06(): chapter(5, 1, 17)
def s07(): chapter(6, 2, 19)
def s08(): chapter(7, 3, 23)

GALLERY = ['jarvis-web', 'devops-hubnew', 'smart-office-assistant', 'interior', 'netplan', 'assembly-studio', 'rork-app',
           'hapinkas-hayomi', 'devops-course-he', 'health-compass', 'astrology-decoder', 'housing-system', 'translate-dub',
           'warehouse-management', 'warehouse-management-v2', 'warehouse-management-v1', 'parkomat', 'project-2026-01-03-new',
           'project-2026-01-03-new2', 'data-management', 'files-management', 'manage-files', 'project-2026-01-19',
           'recipe-calculator', 'israel-holidays', 'zohar', 'zohar-v1', 'graphology', 'lotto-new', 'lotto-series-pro',
           'lotto-series', 'lotto']

def s09_gallery():
    """every remaining project, full screen, one per beat, with its name and address"""
    d = SC[8][2]; seg = BEAT
    body = ''; js = ''
    for k, pid in enumerate(GALLERY):
        t0 = round(k * seg, 3)
        kind = 'site' if pid in ('netplan', 'assembly-studio') else 'shot'
        body += full_html(f'g{k}', kind, pid)
        js += full_js(f'g{k}', kind, pid, t0, seg, 0.3)
        js += f"tl.fromTo('#§-g{k}', {{ scale: 1.1 }}, {{ scale: 1.0, duration: {seg}, ease: 'power3.out' }}, {t0});\n"
    body += '<div class="§-topshade"></div><div class="§-shade"></div>'
    for k, pid in enumerate(GALLERY):
        body += label_html(f'l{k}', pid)
        js += label_js(f'l{k}', round(k * seg, 3), seg, quick=True)
    css = FULL_CSS + f'''#§-cnt{{position:absolute;top:44px;{'left' if HE else 'right'}:90px;font-family:'Bellefair',serif;font-size:64px;color:{GOLD_HI};direction:ltr;text-shadow:0 2px 24px rgba(0,0,0,.9)}}
#§-cnt small{{font-size:30px;color:{MUTED}}}'''
    body += f'<div class="§-tag">{T("And so much more", "ועוד הרבה")}</div>'
    frame(8, css, body, js, seed=29, ndust=0)

def s03_slam():
    cx, cy = W / 2, 330
    css = f'''#§-word{{position:absolute;left:0;right:0;top:470px;text-align:center;direction:ltr;font-family:'Michroma',sans-serif;font-size:150px;color:{IVORY};letter-spacing:.32em;padding-left:.32em}}
#§-sub{{position:absolute;left:0;right:0;top:700px;text-align:center;direction:{DIR};font-family:'Bellefair',serif;font-size:{54 if HE else 50}px;color:{GOLD_HI}}}
#§-ring{{position:absolute;left:{W/2-300}px;top:{H/2-300}px;width:600px;height:600px;border-radius:50%;border:2px solid rgba(242,222,172,.8)}}
#§-burst{{position:absolute;left:{W/2-700}px;top:{H/2-500}px;width:1400px;height:1000px;background:radial-gradient(closest-side,rgba(255,236,190,.55),rgba(255,236,190,0));mix-blend-mode:screen}}'''
    chars = ''.join(f'<span class="§-ch" style="display:inline-block">{c}</span>' for c in 'SPIDER')
    body = (f'{beams(2, 4)}<div id="§-burst"></div><div id="§-ring"></div><div id="§-cam" style="position:absolute;inset:0">'
            f'<svg class="§-ov" viewBox="0 0 {W} {H}">{web_svg(cx, cy - 20, 110)}</svg><div id="§-word">{chars}</div>'
            f'<div id="§-sub">{T("The digital atelier of Haim Krispin", "הסדנה הדיגיטלית של חיים קריספין")}</div></div>')
    js = beams_js(2, 4.8, 4) + f'''QA('.§-ch').forEach((c, i) => tl.fromTo(c, {{ opacity: 0, scale: 2.4, filter: 'blur(18px)' }}, {{ opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.5, ease: 'expo.out' }}, 0.0 + i * 0.05));
tl.fromTo('#§-burst', {{ opacity: 0, scale: .4 }}, {{ opacity: 1, scale: 1.2, duration: 0.35, ease: 'expo.out' }}, 0.0);
tl.to('#§-burst', {{ opacity: 0.25, duration: 2.0, ease: 'power2.out' }}, 0.35);
tl.fromTo('#§-ring', {{ scale: 0.2, opacity: 1 }}, {{ scale: 3.2, opacity: 0, duration: 1.4, ease: 'expo.out' }}, 0.05);
draw(QA('.§-sp'), 0.3, 0.9, 'power3.out'); QA('.§-rg').forEach((g, i) => draw(g, 0.5 + i * 0.15, 1.0));
tl.to('#§-web', {{ rotation: 14, svgOrigin: '{cx} {cy-20}', duration: 4.8, ease: 'none' }}, 0);
fadeUp('#§-sub', 1.4);
shake('#§-cam', 0.0, 14);
tl.fromTo('#§-cam', {{ scale: 1.0 }}, {{ scale: 1.05, duration: 4.0, ease: 'none' }}, 0.3);
tl.to('#§-cam', {{ scale: 3.5, opacity: 0, filter: 'blur(12px)', duration: 0.5, ease: 'power3.in' }}, 4.3);'''
    frame(2, css, body, js, seed=7, ndust=30)

def s10_finale():
    cx, cy = W / 2, 300
    css = f'''#§-word{{position:absolute;left:0;right:0;top:460px;text-align:center;direction:ltr;font-family:'Michroma',sans-serif;font-size:118px;color:{IVORY};letter-spacing:.36em;padding-left:.36em}}
#§-tag{{position:absolute;left:0;right:0;top:640px;text-align:center;direction:{DIR};font-family:'Bellefair',serif;font-size:{66 if HE else 60}px;color:{GOLD_HI}}}
#§-rl{{position:absolute;left:{W/2-70}px;top:752px;width:140px;height:1px;background:{GOLD}}}
#§-who{{position:absolute;left:0;right:0;top:790px;text-align:center;direction:{DIR};font-size:36px;font-weight:500;color:{IVORY};letter-spacing:.03em}}
#§-url{{position:absolute;left:0;right:0;top:852px;text-align:center;direction:ltr;font-family:'Michroma',sans-serif;font-size:17px;letter-spacing:.22em;color:{MUTED}}}
#§-glow{{position:absolute;left:{cx-520}px;top:{cy-520}px;width:1040px;height:1040px;background:radial-gradient(closest-side,rgba(214,180,110,.22),rgba(214,180,110,0))}}
#§-out{{position:absolute;inset:0;background:#000}}'''
    chars = ''.join(f'<span class="§-ch" style="display:inline-block">{c}</span>' for c in 'SPIDER')
    body = (f'<div id="§-glow"></div>{beams(3, 8)}<svg class="§-ov" viewBox="0 0 {W} {H}">{web_svg(cx, cy, 140)}</svg>'
            f'<div id="§-word">{chars}</div><div id="§-tag">{words(T("Your next system. Crafted.", "המערכת הבאה שלכם. בעבודת יד."))}</div>'
            f'<div id="§-rl"></div><div id="§-who">{T("Haim Krispin · +972 54-497-9771", "חיים קריספין · 054-4979771")}</div>'
            f'<div id="§-url">DEVOPSDEVOPSHAIM-WQ.GITHUB.IO/DEVOPS-HUB/PORTFOLIO</div><div id="§-out"></div>')
    js = beams_js(3, 9.6, 8) + f'''tl.fromTo('#§-glow', {{ opacity: 0, scale: .5 }}, {{ opacity: 1, scale: 1, duration: 2.4, ease: 'expo.out' }}, 0);
draw(QA('.§-sp'), 0.0, 1.0, 'expo.out'); QA('.§-rg').forEach((g, i) => draw(g, 0.2 + i * 0.18, 1.2));
tl.fromTo('#§-core', {{ scale: 0, transformOrigin: '50% 50%' }}, {{ scale: 1, duration: 0.6, ease: 'back.out(3)' }}, 0.1);
tl.to('#§-web', {{ rotation: 16, svgOrigin: '{cx} {cy}', duration: 9.6, ease: 'none' }}, 0);
QA('.§-ch').forEach((c, i) => tl.fromTo(c, {{ opacity: 0, x: (i - 2.5) * 60, filter: 'blur(14px)' }}, {{ opacity: 1, x: 0, filter: 'blur(0px)', duration: 2.2, ease: 'expo.out' }}, 0.6 + Math.abs(i - 2.5) * 0.08));
rise('#§-tag .§-w', 2.4, {{ duration: 1.2 }});
tl.fromTo('#§-rl', {{ scaleX: 0 }}, {{ scaleX: 1, duration: 1.0, ease: 'expo.inOut' }}, 3.4);
fadeUp('#§-who', 3.8); fadeUp('#§-url', 4.3);
tl.fromTo('#§-out', {{ opacity: 0 }}, {{ opacity: 1, duration: 1.4, ease: 'power2.in' }}, 8.2);'''
    frame(9, css, body, js, seed=37, ndust=40)

for f in (s01_open, s02_montage, s03_slam, s04_wall, s05, s06, s07, s08, s09_gallery, s10_finale): f()
print('frames written:', LANG, '->', PROJ)
