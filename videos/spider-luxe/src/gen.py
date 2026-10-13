# SPIDER v2 — cinematic, beat-cut brand film. One generator for both cuts (English and Hebrew), 1920x1080.
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
    ('01-open', 0.0, 7.2), ('02-montage', 7.2, 7.2), ('03-slam', 14.4, 4.8), ('04-tunnel', 19.2, 9.6),
    ('05-ch-intelligence', 28.8, 9.6), ('06-ch-engineering', 38.4, 9.6), ('07-ch-life', 48.0, 9.6),
    ('08-ch-heritage', 57.6, 9.6), ('09-recap', 67.2, 4.8), ('10-finale', 72.0, 9.6)]
TOTAL = 81.6
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

MONTAGE = ['robotic-parking', 'vacation-hub', 'finance-hub', 'aia-studio', 'dreams-hub', 'wellness-hub',
           'cabinet-wiring', 'marketing-hub', 'torah-hub', 'comic-studio', 'netplan', 'services']

def s02_montage():
    ww, wh = 1500, 900
    body = ''; js = ''
    r = random.Random(9)
    for k, s in enumerate(MONTAGE):
        t0 = round(k * BEAT, 2)
        body += browser(f'm{k}', [s], (W - ww) // 2, (H - wh) // 2 + 20, ww, wh, 'opacity:0')
        ry = (-1) ** k * r.uniform(8, 16); rx = r.uniform(-4, 4)
        js += f"tl.set('#§-m{k}', {{ opacity: 1 }}, {t0}); tl.set('#§-m{k}', {{ opacity: 0 }}, {round(t0 + BEAT, 2)});\n"
        js += (f"tl.fromTo('#§-m{k}', {{ scale: 1.1, rotationY: {ry:.1f}, rotationX: {rx:.1f}, transformPerspective: 1600 }}, "
               f"{{ scale: 0.98, rotationY: {ry*0.4:.1f}, rotationX: 0, duration: {BEAT}, ease: 'power3.out' }}, {t0});\n")
        js += scroll_js(f'm{k}', 0, s, ww, wh, t0, BEAT, 0.25 + 0.05 * (k % 4), 'power2.out')
    css = f'''#§-dim{{position:absolute;inset:0;background:rgba(7,6,8,.55)}}
.§-kw{{position:absolute;left:0;right:0;top:{H/2-90}px;text-align:center;direction:{DIR};font-family:'Bellefair',serif;font-size:{170 if HE else 160}px;line-height:1;color:{IVORY};text-shadow:0 10px 60px rgba(0,0,0,.8)}}'''
    kws = [T('Designed.', 'מעוצב.'), T('Engineered.', 'מהונדס.'), T('Live.', 'באוויר.')]
    body += '<div id="§-dim"></div>' + ''.join(f'<div class="§-kw" id="§-k{i}">{words(t)}</div>' for i, t in enumerate(kws))
    for i in range(3):
        a = i * BAR
        js += f"rise('#§-k{i} .§-w', {a + 0.05}, {{ duration: 0.6 }}); tl.fromTo('#§-k{i}', {{ scale: 1.08 }}, {{ scale: 1, duration: {BAR - 0.45}, ease: 'power2.out' }}, {a});\n"
        if i < 2: js += f"tl.to('#§-k{i}', {{ opacity: 0, duration: 0.2 }}, {a + BAR - 0.2});\n"
    js += "tl.to('#§-k2', { opacity: 0, scale: 1.3, filter: 'blur(10px)', duration: 0.4, ease: 'power2.in' }, 6.8);\n"
    frame(1, css, body, js, seed=5, ndust=10)

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

def s04_tunnel():
    """camera flies through a corridor lined with every project's screenshot; the count climbs to 51"""
    tw, th = 640, 400
    tiles = ''; r = random.Random(4); shots = SHOTS[:]; r.shuffle(shots)
    k = 0
    for depth in range(12):
        z = -depth * 820
        for side in (-1, 1):
            for row in (-1, 1):
                s = shots[k % len(shots)]
                x = side * 760; y = row * 230
                tr = f'translate3d({x - tw/2:.0f}px,{y - th/2:.0f}px,{z}px) rotateY({-side*72}deg)'
                tiles += f'<div class="§-tile" data-z="{z}" style="transform:{tr}"><img src="assets/shots/{s}.jpg" alt=""></div>'
                k += 1
    css = f'''#§-world{{position:absolute;left:50%;top:50%;width:0;height:0;transform-style:preserve-3d}}
#§-persp{{position:absolute;inset:0;perspective:900px;perspective-origin:50% 50%}}
.§-tile{{position:absolute;left:0;top:0;width:{tw}px;height:{th}px;border-radius:8px;overflow:hidden;border:1px solid rgba(214,180,110,.5);background:#111;backface-visibility:hidden}}
.§-tile img{{width:100%;height:100%;object-fit:cover;object-position:top;display:block}}
#§-fog{{position:absolute;inset:0;background:radial-gradient(36% 44% at 50% 55%,rgba(7,6,8,.97) 35%,rgba(7,6,8,.0) 100%)}}
#§-num{{position:absolute;left:0;right:0;top:330px;text-align:center;font-family:'Bellefair',serif;font-size:300px;line-height:1;color:{GOLD_HI};text-shadow:0 0 80px rgba(214,180,110,.35)}}
#§-cap{{position:absolute;left:0;right:0;top:660px;text-align:center;direction:{DIR};font-family:'Bellefair',serif;font-size:{58 if HE else 54}px;color:{IVORY}}}
#§-cap2{{position:absolute;left:0;right:0;top:745px;text-align:center;direction:{DIR};font-family:{"'Assistant',sans-serif;font-size:30px;letter-spacing:.06em" if HE else "'Michroma',sans-serif;font-size:18px;letter-spacing:.36em"};color:{GOLD}}}'''
    body = (f'<div id="§-persp"><div id="§-world">{tiles}</div></div><div id="§-fog"></div>'
            f'<div id="§-num">0</div><div id="§-cap">{words(T("Live systems. Built from scratch.", "מערכות חיות. נבנו מאפס."))}</div>'
            f'<div id="§-cap2">{T("AI · ENGINEERING · LIFE · HERITAGE", "בינה · הנדסה · חיים · מורשת")}</div>')
    js = f'''const cam = {{ z: -300 }};
const tiles = QA('.§-tile');
const place = () => {{ Q('#§-world').style.transform = 'translateZ(' + (-cam.z) + 'px)';
  tiles.forEach(t => {{ const dz = +t.dataset.z + cam.z; const a = dz > 300 ? 0 : Math.max(0, Math.min(1, 1 - (-dz - 1500) / 6000)); t.style.opacity = a.toFixed(3); }}); }};
tl.fromTo(cam, {{ z: -300 }}, {{ z: 8200, duration: 9.6, ease: 'power1.inOut', onUpdate: place }}, 0);
tl.call(place, null, 0);
const cnt = {{ v: 0 }};
tl.to(cnt, {{ v: {PROJECTS}, duration: 3.6, ease: 'power3.out', onUpdate: () => {{ Q('#§-num').textContent = Math.round(cnt.v); }} }}, 0.4);
tl.fromTo('#§-num', {{ opacity: 0, scale: 0.8, filter: 'blur(12px)' }}, {{ opacity: 1, scale: 1, filter: 'blur(0px)', duration: 1.2, ease: 'expo.out' }}, 0.3);
tl.to('#§-num', {{ scale: 1.08, duration: 0.25, yoyo: true, repeat: 1, ease: 'power2.out' }}, 4.0);
rise('#§-cap .§-w', 1.2);
fadeUp('#§-cap2', 5.0);
tl.to(['#§-num', '#§-cap', '#§-cap2'], {{ opacity: 0, y: -30, filter: 'blur(10px)', duration: 0.5, ease: 'power2.in' }}, 8.9);'''
    frame(3, css, body, js, seed=11, ndust=20)

def chapter(idx, num, eye, title, lede, main_sites, back, seed):
    """a slow 3D orbit around a live browser; the main window swaps site on the half-way bar"""
    d = SC[idx][2]
    mw, mh = 1180, 740
    mx_ = 640 if not HE else W - 640 - mw
    body = f'<div id="§-persp" style="position:absolute;inset:0;perspective:2000px"><div id="§-rig" style="position:absolute;inset:0;transform-style:preserve-3d">'
    bpos = [(mx_ + (380 if not HE else -380), 90, 760, 476, -700), (mx_ + (-120 if not HE else 540), 560, 700, 438, -900)]
    js = ''
    for k, (s, (x, y, w, h, z)) in enumerate(zip(back, bpos)):
        body += browser(f'b{k}', [s], x, y, w, h, f'transform:translateZ({z}px);opacity:.42')
        js += scroll_js(f'b{k}', 0, s, w, h, 0, d, 0.6, 'none')
    body += browser('mw', main_sites, mx_, 170, mw, mh)
    body += '</div></div>'
    css = f'''#§-tb{{position:absolute;top:300px;{SIDE}:120px;width:440px;direction:{DIR};text-align:{ALIGN}}}
#§-num{{font-family:'Bellefair',serif;font-size:150px;line-height:.9;color:transparent;-webkit-text-stroke:1.4px {GOLD}}}
#§-eye{{display:block;margin-top:26px;font-family:{"'Assistant',sans-serif;font-weight:600;font-size:28px;letter-spacing:.14em" if HE else "'Michroma',sans-serif;font-size:17px;letter-spacing:.4em"};color:{GOLD};text-transform:uppercase}}
#§-title{{margin-top:22px;font-family:'Bellefair',serif;font-size:{78 if HE else 72}px;line-height:1.06;color:{IVORY}}}
#§-rule{{display:block;width:110px;height:1px;background:{GOLD};margin-top:30px;transform-origin:{'100%' if HE else '0%'} 50%}}
#§-lede{{margin-top:26px;font-size:{32 if HE else 28}px;line-height:1.45;color:{MUTED}}}
#§-plate{{position:absolute;top:0;bottom:0;{SIDE}:0;width:760px;background:linear-gradient({'270deg' if HE else '90deg'},rgba(7,6,8,.92) 40%,rgba(7,6,8,0))}}'''
    body += (f'<div id="§-plate"></div><div id="§-tb"><div id="§-num">{num}</div><span id="§-eye">{eye}</span>'
             f'<div id="§-title">{words(title)}</div><span id="§-rule"></span><div id="§-lede">{lede}</div></div>')
    sgn = -1 if HE else 1
    js += f'''tl.fromTo('#§-rig', {{ rotationY: {-24*sgn}, rotationX: 6, z: -260, transformOrigin: '{'70%' if not HE else '30%'} 50%' }}, {{ rotationY: {-8*sgn}, rotationX: 2, z: 40, duration: {d}, ease: 'power1.inOut' }}, 0);
tl.fromTo('#§-mw', {{ opacity: 0, x: {200*sgn}, filter: 'blur(16px) brightness(.4)' }}, {{ opacity: 1, x: 0, filter: 'blur(0px) brightness(1)', duration: 1.1, ease: 'expo.out' }}, 0.0);
sheen('mw', 0.7); sheen('mw', {BAR*2 + 0.5});
tl.fromTo('#§-num', {{ opacity: 0, x: {-40*sgn} }}, {{ opacity: 1, x: 0, duration: 1.2, ease: 'expo.out' }}, 0.1);
tl.fromTo('#§-eye', {{ opacity: 0 }}, {{ opacity: 1, duration: 0.8 }}, 0.4);
rise('#§-title .§-w', 0.5);
tl.fromTo('#§-rule', {{ scaleX: 0 }}, {{ scaleX: 1, duration: 1.0, ease: 'expo.inOut' }}, 1.1);
fadeUp('#§-lede', {BAR*1.5});
'''
    js += scroll_js('mw', 0, main_sites[0], mw, mh, 0.3, BAR * 2 - 0.3, 0.9)
    js += f"swap('mw', 0, 1, {BAR*2 - 0.15});\n"
    js += scroll_js('mw', 1, main_sites[1], mw, mh, BAR * 2 + 0.2, d - BAR * 2 - 0.2, 0.9)
    frame(idx, css, body, js, seed=seed, ndust=26)

def s05(): chapter(4, '01', T('Intelligence & studios', 'בינה וסטודיו'), T('Intelligence that creates.', 'בינה שיוצרת.'),
                   T('Design, comics, books and campaigns.', 'עיצוב, קומיקס, ספרים וקמפיינים.'), ['aia-studio', 'comic-studio'], ['book-studio', 'marketing-hub'], 13)
def s06(): chapter(5, '02', T('Engineering', 'הנדסה'), T('Down to the last wire.', 'עד החוט האחרון.'),
                   T('Robotic parking, control cabinets, networks.', 'חניון רובוטי, ארונות פיקוד, רשתות.'), ['robotic-parking', 'cabinet-wiring'], ['netplan', 'electro-fix'], 17)
def s07(): chapter(6, '03', T('Life', 'חיים'), T('Tools that run a life.', 'כלים שמנהלים חיים.'),
                   T('Travel, health, money and home.', 'חופשות, בריאות, כסף ובית.'), ['vacation-hub', 'wellness-hub'], ['finance-hub', 'bills-hub'], 19)
def s08(): chapter(7, '04', T('Heritage', 'מורשת'), T('A library for the soul.', 'ספרייה לנשמה.'),
                   T('Sacred texts, holidays and the meaning of dreams.', 'כתבי קודש, חגים ופשר החלומות.'), ['torah-hub', 'dreams-hub'], ['services', 'automation'], 23)

def s09_recap():
    """sixteen eighth-note cuts of real screenshots, accelerating into the finale"""
    picks = ['finance-hub', 'robotic-parking', 'torah-hub', 'aia-studio', 'marketing-hub', 'vacation-hub', 'wellness-hub', 'comic-studio',
             'jarvis-web', 'dreams-hub', 'interior', 'devops-hubnew', 'book-studio', 'rork-app', 'cabinet-wiring', 'astrology-decoder']
    css = '''.§-cut{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;object-position:top;opacity:0}
#§-tint{position:absolute;inset:0;background:linear-gradient(rgba(7,6,8,.35),rgba(7,6,8,.15) 50%,rgba(7,6,8,.6))}'''
    body = ''; js = ''
    for i in range(16):
        t0 = round(i * 0.3, 2)
        body += f'<img class="§-cut" id="§-c{i}" src="assets/shots/{picks[i]}.jpg" alt="">'
        js += f"tl.set('#§-c{i}', {{ opacity: 1 }}, {t0}); tl.set('#§-c{i}', {{ opacity: 0 }}, {round(t0 + 0.3, 2)});\n"
        js += f"tl.fromTo('#§-c{i}', {{ scale: 1.18, x: {(-1)**i * 40} }}, {{ scale: 1.04, x: 0, duration: 0.3, ease: 'power2.out' }}, {t0});\n"
    body += '<div id="§-tint"></div>'
    frame(8, css, body, js, seed=29, ndust=0)

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

for f in (s01_open, s02_montage, s03_slam, s04_tunnel, s05, s06, s07, s08, s09_recap, s10_finale): f()
print('frames written:', LANG, '->', PROJ)
