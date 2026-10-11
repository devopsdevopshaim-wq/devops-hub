# SPIDER "הרשת" v2 — one generator for four cuts: {he,en} x {wide 1920x1080, tall 1080x1350}.
# usage: python3 gen.py <project_dir> <wide|tall> <he|en>
import sys, os, re, math, random, json

PROJ, FMT, LANG = sys.argv[1], sys.argv[2], sys.argv[3]
W, H = (1920, 1080) if FMT == 'wide' else (1080, 1350)
TALL = FMT == 'tall'
RTL = LANG == 'he'
EN = not RTL
FONTS = open(os.path.join(os.path.dirname(__file__), 'fonts.css')).read()
DUR = [8, 9, 9, 11, 12, 10, 10, 12, 11, 8, 9, 9]
IDS = ['01-thread', '02-thesis', '03-count', '04-ai', '05-engineering', '06-everyday', '07-creative', '08-web',
       '09-pipeline', '10-live', '11-cta', '12-brand']
SAFE = int(H * 0.83)  # captions keep-out

def T(he, en): return he if RTL else en
def mx(x, w=0): return x if (RTL or TALL) else W - x - w     # mirror x for English wide

ALIGN = 'right' if RTL else 'left'
DIR = 'rtl' if RTL else 'ltr'
SC = 0.86 if TALL else 1.0   # type scale

BASE_CSS = f'''
#root{{position:absolute;inset:0;width:100%;height:100%;overflow:hidden;color:#f1eefc;font-family:'Assistant',sans-serif}}
.§-bg{{position:absolute;inset:0;background:radial-gradient(120% 95% at 68% -5%,#2a2366 0%,#17143a 40%,#0f0d24 78%)}}
.§-skyimg{{position:absolute;left:-4%;top:-4%;width:108%;height:108%;object-fit:cover;opacity:.42}}
.§-st{{position:absolute;border-radius:50%;background:#fff}}
.§-grain{{position:absolute;left:-256px;top:-256px;width:{W+512}px;height:{H+512}px;background:url(assets/grain.png);opacity:.07;mix-blend-mode:overlay}}
.§-vig{{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,rgba(0,0,0,0) 55%,rgba(5,4,16,.55) 100%)}}
.§-ov{{position:absolute;left:0;top:0;width:{W}px;height:{H}px;overflow:visible}}
.§-tx{{position:absolute;direction:{DIR};text-align:{ALIGN}}}
.§-eye{{font-family:'JetBrains Mono',monospace;font-weight:500;font-size:{int(24*SC)}px;letter-spacing:.22em;color:#e0b25a;text-transform:uppercase;margin-bottom:{int(22*SC)}px;direction:ltr;display:block}}
.§-eyehe{{font-family:'Assistant',sans-serif;font-weight:600;font-size:{int(30*SC)}px;letter-spacing:.06em;color:#e0b25a;margin-bottom:{int(18*SC)}px;display:block}}
.§-h1{{font-family:'Bellefair',serif;font-weight:400;font-size:{int(118*SC)}px;line-height:1.08}}
.§-h2{{font-family:'Bellefair',serif;font-weight:400;font-size:{int(76*SC)}px;line-height:1.12}}
.§-h3{{font-family:'Bellefair',serif;font-weight:400;font-size:{int(40*SC)}px;line-height:1.1}}
.§-lede{{font-family:'Assistant',sans-serif;font-weight:400;font-size:{int(38*SC)}px;color:#a9a4cc;margin-top:{int(22*SC)}px;line-height:1.35}}
.§-acc{{color:#e0b25a}}.§-mint{{color:#62dcb8}}
.§-m{{display:inline-block;overflow:hidden;vertical-align:top;padding:0 .04em .12em}}
.§-w{{display:inline-block;white-space:pre}}
.§-ul{{display:block;height:3px;background:linear-gradient(90deg,rgba(224,178,90,0),#e0b25a 30%,#f3d596);margin-top:{int(14*SC)}px;transform-origin:{'100%' if RTL else '0%'} 50%}}
.§-shot{{position:absolute;border-radius:16px;overflow:hidden;border:1px solid rgba(241,238,252,.22);box-shadow:0 26px 70px rgba(0,0,0,.55);background:#17143a}}
.§-shot img{{display:block;width:100%;height:100%;object-fit:cover;object-position:top}}
.§-shine{{position:absolute;top:-10%;left:0;width:38%;height:120%;background:linear-gradient(100deg,rgba(255,255,255,0),rgba(255,255,255,.28),rgba(255,255,255,0));pointer-events:none}}
.§-shot.§-focal{{border:2px solid #e0b25a;box-shadow:0 0 0 8px rgba(224,178,90,.12),0 30px 90px rgba(0,0,0,.65)}}
.§-chip{{position:absolute;{'right' if RTL else 'left'}:14px;bottom:14px;direction:{DIR};font-family:'Assistant',sans-serif;font-weight:600;font-size:{int(24*SC)}px;color:#f1eefc;background:rgba(15,13,36,.86);padding:6px 14px;border-radius:10px;white-space:nowrap}}
.§-focal .§-chip{{color:#f3d596;font-size:{int(30*SC)}px}}
.§-silk{{stroke:#e0b25a;stroke-width:3;fill:none;stroke-linecap:round}}
.§-mote{{fill:#f6dc9a}}
'''

def stars(n, seed, P, maxs=4.5):
    r = random.Random(seed); o = ''
    for i in range(n):
        x, y, s = r.uniform(0, W), r.uniform(0, H * .86), r.uniform(1.2, maxs)
        tw = ' §-tw' if i % 9 == 0 else ''
        o += f'<i class="{P}-st{tw}" style="left:{x:.0f}px;top:{y:.0f}px;width:{s:.1f}px;height:{s:.1f}px;opacity:{r.uniform(.25,.85):.2f}"></i>'
    return o

def words(t, cls=''):
    ws = t.split()
    return ''.join(f'<span class="§-m"><span class="§-w {cls}">{w}</span></span>{" " if i < len(ws)-1 else ""}' for i, w in enumerate(ws))

def shot(fid, img, label, x, y, w, h, focal=False, extra=''):
    return (f'<div id="§-{fid}" class="§-shot{" §-focal" if focal else ""}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px{extra}">'
            f'<img src="assets/{img}" alt=""><div class="§-shine" id="§-{fid}-sh"></div><span class="§-chip">{label}</span></div>')

PL = 'pathLength="1" style="stroke-dasharray:1;stroke-dashoffset:1"'

COMMON_JS = r'''
const tl = gsap.timeline({ paused: true });
const Q = s => document.querySelector(s);
const QA = s => Array.from(document.querySelectorAll(s));
const RTL = __RTL__;
const rise = (sel, at, opt) => tl.fromTo(sel, { yPercent: 110, opacity: 0 }, Object.assign({ yPercent: 0, opacity: 1, duration: 0.9, ease: 'power4.out', stagger: 0.12 }, opt || {}), at);
const fadeUp = (sel, at, opt) => tl.fromTo(sel, { y: 24, opacity: 0, filter: 'blur(6px)' }, Object.assign({ y: 0, opacity: 1, filter: 'blur(0px)', duration: 1.0, ease: 'power3.out' }, opt || {}), at);
const ul = (sel, at) => tl.fromTo(sel, { scaleX: 0 }, { scaleX: 1, duration: 1.1, ease: 'expo.out' }, at);
const card = (id, at, opt) => {
  const side = (opt && opt.side) || (RTL ? 1 : -1);
  tl.fromTo('#§-' + id, { opacity: 0, scale: 0.9, y: 50, rotationY: 28 * side, transformPerspective: 1400, filter: 'blur(10px)' },
    Object.assign({ opacity: 1, scale: 1, y: 0, rotationY: 0, filter: 'blur(0px)', duration: 1.2, ease: 'power3.out' }, opt || {}), at);
  tl.fromTo('#§-' + id + '-sh', { xPercent: -120 }, { xPercent: 320, duration: 1.1, ease: 'power2.inOut' }, at + 0.55);
};
const draw = (sel, at, d, ease) => tl.fromTo(sel, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: d || 1.6, ease: ease || 'power2.inOut' }, at);
const motes = (sel, x1, y1, x2, y2, at, d, n) => QA(sel).forEach((m, i) => tl.fromTo(m, { attr: { cx: x1, cy: y1 }, opacity: 0 },
  { attr: { cx: x2, cy: y2 }, opacity: 1, duration: d, ease: 'sine.inOut' }, at + i * (d / (n || 3))));
// ambient: parallax stars, twinkle, grain, slow push
tl.fromTo('#§-stars', { x: 0 }, { x: RTL ? -40 : 40, duration: __D__, ease: 'none' }, 0);
tl.fromTo('#§-stars2', { x: 0 }, { x: RTL ? -90 : 90, duration: __D__, ease: 'none' }, 0);
QA('.§-tw').forEach((s, i) => tl.fromTo(s, { opacity: 0.25 }, { opacity: 1, duration: 0.9, yoyo: true, repeat: Math.max(0, Math.floor(__D__ / 1.8) - 1), ease: 'sine.inOut' }, (i % 5) * 0.37));
tl.fromTo('#§-grain', { x: 0, y: 0 }, { x: -192, y: 128, duration: __D__, ease: 'steps(' + Math.round(__D__ * 12) + ')' }, 0);
tl.fromTo('#§-sky', { scale: 1.0 }, { scale: 1.06, duration: __D__, ease: 'none' }, 0);
tl.fromTo('#§-push', { scale: 1.0 }, { scale: __PUSH__, duration: __D__, ease: 'none', transformOrigin: '50% 45%' }, 0);
'''

def frame(idx, css, body, js, push=1.035, seed=1, nstars=60, sky=True, extra_root=''):
    fid = IDS[idx]; dur = DUR[idx]
    bg = (f'<div id="§-bgclip" class="clip §-bg" data-start="0" data-duration="{dur}" data-track-index="0">'
          + ('<img class="§-skyimg" id="§-sky" src="assets/sky.webp" alt="">' if sky else '<i id="§-sky"></i>')
          + f'<div id="§-stars">{stars(nstars, seed, "§")}</div><div id="§-stars2">{stars(18, seed + 50, "§", 6)}</div></div>')
    fx = (f'<div id="§-fx" class="clip" data-start="0" data-duration="{dur}" data-track-index="2" data-layout-allow-overflow>'
          f'<div class="§-vig"></div><div class="§-grain" id="§-grain"></div></div>')
    js_all = (COMMON_JS.replace('__RTL__', 'true' if RTL else 'false').replace('__D__', str(dur)).replace('__PUSH__', str(push))) + js
    html = f'''<template>
<style>
{FONTS}
{BASE_CSS}
{css}
</style>
<div id="root" data-composition-id="{fid}" data-width="{W}" data-height="{H}" data-duration="{dur}">
{bg}
<div class="clip" data-start="0" data-duration="{dur}" data-track-index="1" id="§-stage" data-layout-allow-overflow><div id="§-push" style="position:absolute;inset:0">
{body}
</div></div>
{extra_root}
{fx}
</div>
<script src="assets/vendor/gsap.min.js"></script>
<script>
(function(){{
{js_all}
window.__timelines["{fid}"] = tl;
}})();
</script>
</template>
'''
    html = html.replace('§', 'f' + fid)
    os.makedirs(f'{PROJ}/compositions/frames', exist_ok=True)
    open(f'{PROJ}/compositions/frames/{fid}.html', 'w', encoding='utf-8').write(html)

def txpos(top, side=150, width=None):
    """absolute text block position: right-anchored for Hebrew, left-anchored for English."""
    wcss = f'width:{width}px;' if width else ''
    return f'top:{top}px;{"right" if RTL else "left"}:{side}px;{wcss}'

def eyebrow(he, en):
    return f'<span class="§-eyehe" id="§-eye">{he}</span>' if RTL else f'<span class="§-eye" id="§-eye">{en}</span>'

# ======================= frames =======================
def f01():
    c = dict(l1=2.3, l2a=4.6, l2b=5.4, pulse=6.0) if RTL else dict(l1=1.6, l2a=2.4, l2b=3.0, pulse=3.6)
    tx = mx(1190) if not TALL else 760
    ty = 470 if not TALL else 560
    txt = (f'<div class="§-h1" id="§-l1">{words(T("כל מערכת","Every system"))}</div>'
           f'<div class="§-h1" id="§-l2">{words(T("מתחילה","begins with"),"§-a")} <span class="§-acc">{words(T("בחוט אחד.","a single thread."),"§-b")}</span></div>'
           f'<span class="§-ul" id="§-ul" style="width:{360 if not TALL else 300}px;{"margin-right:0;margin-left:auto" if RTL else ""}"></span>')
    pos = txpos(590 if not TALL else 700, 180 if not TALL else 90)
    body = f'''<svg class="§-ov" viewBox="0 0 {W} {H}"><line id="§-silk" x1="{tx}" y1="-10" x2="{tx}" y2="{ty}" class="§-silk" {PL}/>
<circle class="§-mote" cx="{tx}" cy="0" r="3"/><circle class="§-mote" cx="{tx}" cy="0" r="2.4"/><circle class="§-mote" cx="{tx}" cy="0" r="2"/>
<circle id="§-halo" cx="{tx}" cy="{ty+8}" r="16" fill="none" stroke="#f3d596" stroke-width="2"/><circle id="§-drop" cx="{tx}" cy="{ty+8}" r="9" fill="#f3d596"/></svg>
<div class="§-tx" style="{pos}">{txt}</div>'''
    js = f'''draw('#§-silk', 0.1, 1.9, 'power3.inOut');
tl.fromTo('#§-drop', {{ opacity: 0, y: -{ty} }}, {{ opacity: 1, y: 0, duration: 1.9, ease: 'power3.inOut' }}, 0.1);
tl.to('#§-drop', {{ scale: 1.35, duration: 0.22, yoyo: true, repeat: 1, ease: 'power2.out', transformOrigin: '50% 50%' }}, 2.0);
tl.fromTo('#§-halo', {{ scale: 0.6, opacity: 0.9, transformOrigin: '50% 50%' }}, {{ scale: 3.4, opacity: 0, duration: 1.6, ease: 'power2.out' }}, 2.0);
motes('.§-mote', {tx}, -10, {tx}, {ty}, 2.6, 2.4, 3);
rise('#§-l1 .§-w', {c['l1']}, {{ stagger: 0.18 }});
rise('#§-l2 .§-a', {c['l2a']});
rise('#§-l2 .§-b', {c['l2b']}, {{ stagger: 0.16 }});
ul('#§-ul', {c['l2b']+0.5});
tl.to('#§-drop', {{ scale: 1.6, duration: 0.3, yoyo: true, repeat: 1, ease: 'power2.out', transformOrigin: '50% 50%' }}, {c['pulse']});'''
    frame(0, '', body, js, push=1.05, seed=1)

def f02():
    c = dict(eye=1.2, a=2.0, b=3.0, lede=4.6) if RTL else dict(eye=1.2, a=3.0, b=3.6, lede=4.6)
    nx = mx(1190) if not TALL else 760; ny = 440 if not TALL else 520
    pos = txpos(600 if not TALL else 720, 180 if not TALL else 90, 1100 if not TALL else 900)
    body = f'''<svg class="§-ov" viewBox="0 0 {W} {H}"><line x1="{nx}" y1="-10" x2="{nx}" y2="{ny-32}" class="§-silk"/>
<circle id="§-halo" cx="{nx}" cy="{ny}" r="34" fill="none" stroke="#f3d596" stroke-width="2"/><circle id="§-halo2" cx="{nx}" cy="{ny}" r="34" fill="none" stroke="#e0b25a" stroke-width="1.5"/>
<circle id="§-node" cx="{nx}" cy="{ny}" r="30" fill="#f3d596"/></svg>
<div class="§-tx" style="{pos}">{eyebrow("חיים קריספין","Haim Krispin")}
<div class="§-h1" id="§-l1">{words(T("ואני בונה","And I build"),"§-a")} <span class="§-acc">{words(T("את כולן.","all of them."),"§-b")}</span></div>
<div class="§-lede" id="§-l2">{T("כל מה שבניתי, במקום אחד.","Everything I've made, in one place.")}</div></div>'''
    js = f'''tl.fromTo('#§-node', {{ scale: 0.3, transformOrigin: '50% 50%' }}, {{ scale: 1, duration: 1.4, ease: 'back.out(1.6)' }}, 0.0);
tl.fromTo('#§-halo', {{ scale: 0.8, opacity: 0.9, transformOrigin: '50% 50%' }}, {{ scale: 4.2, opacity: 0, duration: 2.2, ease: 'power2.out' }}, 0.4);
tl.fromTo('#§-halo2', {{ scale: 0.8, opacity: 0.7, transformOrigin: '50% 50%' }}, {{ scale: 6, opacity: 0, duration: 3.0, ease: 'power2.out' }}, 1.2);
fadeUp('#§-eye', {c['eye']}, {{ duration: 0.8 }});
rise('#§-l1 .§-a', {c['a']}, {{ stagger: 0.16 }});
rise('#§-l1 .§-b', {c['b']}, {{ stagger: 0.16 }});
fadeUp('#§-l2', {c['lede']});
tl.to('#§-node', {{ opacity: 0.82, duration: 1.2, ease: 'sine.inOut', yoyo: true, repeat: 1 }}, 6.4);'''
    frame(1, '', body, js, push=1.04, seed=2)

def f03():
    c = dict(cnt=0.4, cd=5.4, lab=6.0, sub=7.3) if RTL else dict(cnt=0.4, cd=1.9, lab=1.5, sub=3.6)
    r = random.Random(48)
    if TALL: box = (70, 560, 1010, 1080)
    else: box = (mx(90, 1060), 90, mx(90, 1060) + 1060, 860)
    pts = [(r.uniform(box[0], box[2]), r.uniform(box[1], box[3])) for i in range(48)]
    dots = ''.join(f'<circle class="§-dot{" §-hot" if i % 7 == 0 else ""}" cx="{x:.0f}" cy="{y:.0f}" r="{9 if i % 7 == 0 else 6}"/>' for i, (x, y) in enumerate(pts))
    links = ''
    for i in range(1, 48):
        j = min(range(i), key=lambda k: (pts[k][0]-pts[i][0])**2 + (pts[k][1]-pts[i][1])**2)
        links += f'<line class="§-ln" x1="{pts[j][0]:.0f}" y1="{pts[j][1]:.0f}" x2="{pts[i][0]:.0f}" y2="{pts[i][1]:.0f}" {PL}/>'
    pos = txpos(80 if not TALL else 110, 150 if not TALL else 90)
    css = f'''.§-dot{{fill:#a9a4cc}}.§-hot{{fill:#f3d596}}.§-ln{{stroke:rgba(224,178,90,.45);stroke-width:1.6;fill:none}}
.§-num{{font-family:'JetBrains Mono',monospace;font-weight:500;font-size:{int(330*SC)}px;line-height:.9;color:#e0b25a;letter-spacing:-.04em;direction:ltr;text-align:{ALIGN}}}
.§-topo{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.12}}
#§-ring{{fill:none;stroke:rgba(224,178,90,.35);stroke-width:2}}'''
    body = f'''<img class="§-topo" id="§-topo" src="assets/topo.webp" alt="">
<svg class="§-ov" viewBox="0 0 {W} {H}">{links}{dots}</svg>
<div class="§-tx" style="{pos}"><div class="§-num" id="§-num">0</div><div class="§-h2" id="§-l1">{T("פרויקטים","projects")}</div><div class="§-lede" id="§-l2">{T("כל נקודה היא פרויקט אמיתי.","Every dot is a real project.")}</div></div>'''
    js = f'''const dots = QA('.§-dot'); const lns = QA('.§-ln');
dots.forEach((d, i) => tl.fromTo(d, {{ scale: 0, svgOrigin: d.getAttribute('cx') + ' ' + d.getAttribute('cy') }}, {{ scale: 1, duration: 0.5, ease: 'back.out(2.4)' }}, 0.2 + i * 0.11));
lns.forEach((l, i) => tl.fromTo(l, {{ strokeDashoffset: 1 }}, {{ strokeDashoffset: 0, duration: 0.5, ease: 'power2.out' }}, 0.35 + (i + 1) * 0.11));
const n = {{ v: 0 }}; const el = Q('#§-num');
tl.fromTo(n, {{ v: 0 }}, {{ v: 48, duration: {c['cd']}, ease: 'power2.out', onUpdate: () => {{ el.textContent = Math.round(n.v); }} }}, {c['cnt']});
tl.fromTo('#§-num', {{ opacity: 0, y: 30, scale: 0.92 }}, {{ opacity: 1, y: 0, scale: 1, duration: 0.8, ease: 'power3.out' }}, 0.3);
tl.to('#§-num', {{ scale: 1.06, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out', transformOrigin: '{'100%' if RTL else '0%'} 50%' }}, {c['cnt']+c['cd']-0.1});
fadeUp('#§-l1', {c['lab']});
fadeUp('#§-l2', {c['sub']});
tl.fromTo('#§-topo', {{ scale: 1.1, opacity: 0 }}, {{ scale: 1, opacity: 0.12, duration: 6, ease: 'power2.out' }}, 0);
tl.fromTo(QA('.§-hot'), {{ opacity: 0.6 }}, {{ opacity: 1, duration: 0.8, stagger: 0.1, ease: 'sine.out' }}, 7.0);'''
    frame(2, css, body, js, push=1.03, seed=3, nstars=40, sky=False)

def f04():
    c = dict(t=0.2, c1=1.8, c2=4.4, c3=6.8) if RTL else dict(t=0.8, c1=4.4, c2=5.4, c3=6.9)
    if TALL:
        path = f'M1120 300 L760 600 L300 960 L-40 1180'
        cards = [('c3', 'aia-studio.jpg', T('עיצוב AIA', 'AIA Studio'), 562, 880, 368, 230, False),
                 ('c2', 'smart-office-assistant.jpg', T('עוזר משרד חכם', 'Smart Office Assistant'), 150, 880, 368, 230, False),
                 ('c1', 'jarvis-web.jpg', T('JARVIS — עוזר רב־סוכנים', 'JARVIS — multi-agent assistant'), 124, 330, 832, 520, True)]
        n1, n2 = (760, 600), (300, 960); pos = txpos(110, 90)
    else:
        path = f'M{mx(1960)} 120 L{mx(1220)} 460 L{mx(560)} 760 L{mx(-40)} 1000'
        cards = [('c3', 'aia-studio.jpg', T('עיצוב AIA', 'AIA Studio'), mx(1270, 500), 500, 500, 312, False),
                 ('c2', 'smart-office-assistant.jpg', T('עוזר משרד חכם', 'Smart Office Assistant'), mx(1010, 470), 230, 470, 294, False),
                 ('c1', 'jarvis-web.jpg', T('JARVIS — עוזר רב־סוכנים', 'JARVIS — multi-agent assistant'), mx(90, 880), 170, 880, 550, True)]
        n1, n2 = (mx(1220), 460), (mx(560), 760); pos = txpos(70, 110)
    css = f'#§-world{{position:absolute;left:0;top:0;width:{W}px;height:{H}px;transform-origin:0 0}}'
    body = f'''<div id="§-world" data-layout-allow-overflow>
<svg class="§-ov" viewBox="0 0 {W} {H}"><path id="§-silk" d="{path}" class="§-silk" {PL}/><circle id="§-n1" cx="{n1[0]}" cy="{n1[1]}" r="11" fill="#f3d596"/><circle id="§-n2" cx="{n2[0]}" cy="{n2[1]}" r="11" fill="#f3d596"/></svg>
{''.join(shot(*a) for a in cards)}
</div>
<div class="§-tx" style="{pos}"><div class="§-h2" id="§-l1">{words(T("סוכני AI","AI agents"))}</div><div class="§-lede" id="§-l2">{words(T("שעובדים בשבילך","that work for you"))}</div></div>'''
    js = f'''draw('#§-silk', 0.0, 2.2, 'power2.out');
rise('#§-l1 .§-w', {c['t']}, {{ stagger: 0.16 }}); rise('#§-l2 .§-w', {c['t']+0.5}, {{ stagger: 0.1 }});
tl.fromTo('#§-world', {{ x: {-160 if RTL else 160}, y: 90, scale: 1.12 }}, {{ x: 0, y: 0, scale: 1, duration: {c['c3']+1.5}, ease: 'power2.inOut' }}, 0.2);
tl.fromTo(['#§-n1', '#§-n2'], {{ scale: 0, transformOrigin: '50% 50%' }}, {{ scale: 1, duration: 0.6, ease: 'back.out(2)', stagger: 1.2 }}, 1.0);
card('c1', {c['c1']}, {{ duration: 1.4 }});
tl.fromTo('#§-c1 img', {{ scale: 1.1 }}, {{ scale: 1, duration: 5.0, ease: 'power2.out' }}, {c['c1']});
card('c2', {c['c2']});
card('c3', {c['c3']});'''
    frame(3, css, body, js, push=1.02, seed=4)

def f05():
    c = dict(a=8.9, b=9.6) if RTL else dict(a=1.0, b=3.4)
    if TALL:
        y0 = 560; st = [('e1', 'netplan.jpg', T('נט־פלאן', 'NetPlan'), 750, y0+60, 300, 188, False),
                        ('e2', 'robotic-parking.jpg', T('פארק־פלאן — חניון רובוטי', 'ParkPlan — robotic parking'), 10, y0-40, 680, 425, True),
                        ('e3', 'electro-fix.jpg', T('מעגל סגור', 'Closed Circuit'), -350, y0+60, 300, 188, False),
                        ('e4', 'assembly-studio.jpg', T('מכלול', 'Assembly Studio'), -710, y0+60, 300, 188, False)]
        line_y = y0 + 20; pos = txpos(110, 90, 900); org = '540px 640px'
        moves = [(0.0, -360, 1.0), (2.4, 190, 1.0), (5.4, 740, 1.0), (7.0, 1100, 1.0), (8.4, 203, 0.55)]
    else:
        st = [('e1', 'netplan.jpg', T('נט־פלאן', 'NetPlan'), mx(1500, 360), 300, 360, 226, False),
              ('e2', 'robotic-parking.jpg', T('פארק־פלאן — חניון רובוטי', 'ParkPlan — robotic parking'), mx(930, 540), 230, 540, 338, True),
              ('e3', 'electro-fix.jpg', T('מעגל סגור', 'Closed Circuit'), mx(560, 340), 300, 340, 212, False),
              ('e4', 'assembly-studio.jpg', T('מכלול', 'Assembly Studio'), mx(190, 340), 300, 340, 212, False)]
        line_y = 260; pos = txpos(700, 150, 1620); org = '960px 420px'
        s = 1 if RTL else -1
        moves = [(0.0, -380 * s, 1.55), (2.4, 40 * s, 1.55), (5.4, 520 * s, 1.55), (7.0, 900 * s, 1.55), (8.4, 0, 1.0)]
    css = f'#§-world{{position:absolute;left:0;top:0;width:{W}px;height:{H}px;transform-origin:{org}}}'
    mv = moves
    js_moves = f"tl.fromTo('#§-world', {{ x: {mv[0][1] - (220 if not TALL else 0) * (1 if RTL else -1)}, scale: {mv[0][2]} }}, {{ x: {mv[0][1]}, scale: {mv[0][2]}, duration: 2.4, ease: 'power2.inOut' }}, 0.0);\n"
    for (t0, x, s_), dd in zip(mv[1:], [3.0, 1.6, 1.4, 2.2]):
        js_moves += f"tl.to('#§-world', {{ x: {x}, scale: {s_}, duration: {dd}, ease: '{'expo.out' if dd == 2.2 else 'power3.inOut'}' }}, {t0});\n"
    body = f'''<div id="§-world" data-layout-allow-overflow>
<svg class="§-ov" viewBox="0 0 {W} {H}"><line id="§-silk" x1="{-1200}" y1="{line_y}" x2="{W+1200}" y2="{line_y}" class="§-silk" {PL}/></svg>
{''.join(shot(*a) for a in st)}
</div>
<div class="§-tx" style="{pos}"><div class="§-h2" id="§-l1">{words(T("הנדסה אמיתית:","Real engineering:"),"§-a")} <span class="§-acc">{words(T("מחניון רובוטי ועד לוח חשמל.","from robotic parking to the electrical panel."),"§-b")}</span></div></div>'''
    js = f'''draw('#§-silk', 0.0, 2.0, 'power2.out');
{js_moves}card('e1', 0.5); card('e2', 2.9, {{ duration: 1.3 }}); card('e3', 5.6); card('e4', 7.1);
rise('#§-l1 .§-a', {c['a']}, {{ stagger: 0.14 }}); rise('#§-l1 .§-b', {c['b']}, {{ stagger: 0.1 }});'''
    frame(4, css, body, js, push=1.0, seed=5)

def f06():
    c = dict(t=0.3, cards=[1.8, 3.1, 4.4, 5.7], hi=[2.3, 3.6, 4.9, 6.2]) if RTL else dict(t=0.8, cards=[1.4, 1.9, 2.4, 2.9], hi=[3.4, 3.9, 4.5, 5.1])
    names = [('v1', 'vacation-hub.jpg', T('מסע — חופשות', 'Masa — vacations')), ('v2', 'finance-hub.jpg', T('מצפן פיננסי', 'Finance Compass')),
             ('v3', 'wellness-hub.jpg', T('מצפן בריאות', 'Health Compass')), ('v4', 'marketing-hub.jpg', T('פרסום ושיווק', 'Marketing Hub'))]
    if TALL:
        g = [(550, 470), (60, 470), (550, 800), (60, 800)]; cw, ch = 470, 294
        path = 'M40 400 Q540 560 1040 400'; pos = txpos(110, 90, 900)
    else:
        g = [(mx(640, 520), 170), (mx(90, 520), 170), (mx(640, 520), 525), (mx(90, 520), 525)]; cw, ch = 520, 325
        path = f'M{mx(40)} 120 Q{mx(640)} 330 {mx(1220)} 110'; pos = txpos(240, 120, 560)
    cards = ''.join(shot(a, b, lbl, x, y, cw, ch, i == 3) for i, ((a, b, lbl), (x, y)) in enumerate(zip(names, g)))
    items = [T('חופשה', 'Travel'), T('כסף', 'Money'), T('בריאות', 'Health'), T('שיווק', 'Marketing')]
    lst = ' · '.join(f'<span class="§-li" id="§-i{i+1}">{w}</span>' for i, w in enumerate(items))
    body = f'''<svg class="§-ov" viewBox="0 0 {W} {H}"><path id="§-silk" d="{path}" class="§-silk" {PL}/></svg>
{cards}
<div class="§-tx" style="{pos}"><div class="§-h2" id="§-l1">{words(T("כלים","Tools"),"§-a")} <span class="§-acc">{words(T("לחיים עצמם","for life itself"),"§-b")}</span></div>
<div class="§-lede" style="font-size:{int(42*SC)}px">{lst}</div></div>'''
    js = f'''draw('#§-silk', 0.0, 1.8, 'power2.out');
rise('#§-l1 .§-a', {c['t']}); rise('#§-l1 .§-b', {c['t']+0.4}, {{ stagger: 0.14 }});
{''.join(f"tl.fromTo('#§-{n[0]}', {{ opacity: 0, y: -170, rotation: {(-4, 3, -3, 4)[i]}, scale: 0.94, filter: 'blur(8px)' }}, {{ opacity: 1, y: 0, rotation: 0, scale: 1, filter: 'blur(0px)', duration: 1.15, ease: 'back.out(1.3)' }}, {c['cards'][i]}); tl.fromTo('#§-{n[0]}-sh', {{ xPercent: -120 }}, {{ xPercent: 320, duration: 1.0, ease: 'power2.inOut' }}, {c['cards'][i]+0.6});" for i, n in enumerate(names))}
{''.join(f"tl.fromTo('#§-i{i+1}', {{ color: '#a9a4cc' }}, {{ color: '#e0b25a', duration: 0.4, ease: 'power2.out' }}, {c['hi'][i]});" for i in range(4))}'''
    frame(5, '.§-li{display:inline-block;color:#a9a4cc}', body, js, push=1.03, seed=6)

def f07():
    c = dict(t=0.3, sw=[2.0, 4.0, 6.0], li=1.2) if RTL else dict(t=0.8, sw=[4.6, 5.6, 7.4], li=1.4)
    scr = [('book-studio.jpg', T('סטודיו ספרים', 'Book Studio')), ('comic-studio.jpg', T('פאנל — קומיקס', 'Panel — comics')),
           ('torah-hub.jpg', T('ספריית קודש', 'Sacred Library')), ('hebrew-calendar.jpg', T('לוח שנה עברי', 'Hebrew Calendar'))]
    win = ''.join(f'<div class="§-scr" id="§-s{i}" data-layout-allow-overlap><img src="assets/{a}" alt=""><span class="§-chip" id="§-ch{i}" data-layout-allow-overlap>{b}</span></div>' for i, (a, b) in enumerate(scr))
    items = ''.join(f'<li id="§-li{i}">{b}</li>' for i, b in enumerate([T('ספרים', 'Books'), T('קומיקס', 'Comics'), T('ספריית קודש', 'Sacred texts'), T('לוח שנה עברי', 'Hebrew calendar')]))
    if TALL:
        wp = 'left:70px;top:560px;width:940px;height:550px'; pos = txpos(110, 90, 900); lstcss = 'display:flex;flex-wrap:wrap;gap:6px 34px'
    else:
        wp = f'left:{mx(150, 1020)}px;top:150px;width:1020px;height:640px'; pos = txpos(170, 120, 560); lstcss = ''
    css = f'''#§-win{{position:absolute;{wp};border-radius:18px;overflow:hidden;border:2px solid #e0b25a;box-shadow:0 0 0 8px rgba(224,178,90,.12),0 40px 110px rgba(0,0,0,.7);background:#17143a}}
#§-persp{{position:absolute;inset:0;perspective:1600px}}
.§-scr{{position:absolute;inset:0}}.§-scr img{{width:100%;height:100%;object-fit:cover;object-position:top;display:block}}
.§-list{{list-style:none;margin-top:{int(30*SC)}px;font-family:'Assistant',sans-serif;font-size:{int(44*SC)}px;color:#a9a4cc;{lstcss}}}.§-list li{{padding:{int(12*SC)}px 0;border-bottom:1px solid rgba(241,238,252,.12)}}'''
    body = f'''<div id="§-persp"><div id="§-win">{win}</div></div>
<div class="§-tx" style="{pos}"><div class="§-h2" id="§-l1">{words(T("סטודיו ליצירה","Studios for creation"),"§-a")} <span class="§-acc">{words(T("ומורשת","& heritage"),"§-b")}</span></div><ul class="§-list">{items}</ul></div>'''
    ry = -1 if (EN and not TALL) else 1
    js = f'''tl.fromTo('#§-win', {{ opacity: 0, rotationY: {18*ry}, rotationX: 6, z: -260, x: {-80*ry} }}, {{ opacity: 1, rotationY: {7*ry}, rotationX: 2, z: 0, x: 0, duration: 2.0, ease: 'power3.out' }}, 0.0);
tl.to('#§-win', {{ rotationY: {2*ry}, rotationX: 0.5, duration: 8.0, ease: 'none' }}, 2.0);
rise('#§-l1 .§-a', {c['t']}, {{ stagger: 0.16 }}); rise('#§-l1 .§-b', {c['t']+0.6});
fadeUp(QA('.§-list li'), {c['li']}, {{ stagger: 0.12, duration: 0.7 }});
tl.fromTo('#§-li0', {{ color: '#a9a4cc' }}, {{ color: '#f3d596', duration: 0.4 }}, {c['li']+0.8});
[1, 2, 3].forEach((i, k) => {{
  const at = [{','.join(map(str, c['sw']))}][k];
  tl.fromTo('#§-s' + i, {{ clipPath: 'inset(0% 0% 0% 100%)' }}, {{ clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'power3.inOut' }}, at);
  tl.fromTo('#§-s' + i + ' img', {{ scale: 1.08 }}, {{ scale: 1, duration: 1.6, ease: 'power2.out' }}, at);
  tl.to('#§-li' + (i - 1), {{ color: '#a9a4cc', duration: 0.4 }}, at);
  tl.to('#§-ch' + (i - 1), {{ opacity: 0, duration: 0.5 }}, at + 0.3);
  tl.fromTo('#§-li' + i, {{ color: '#a9a4cc' }}, {{ color: '#f3d596', duration: 0.4 }}, at + 0.3);
}});'''
    frame(6, css, body, js, push=1.02, seed=7)

def f08():
    c = dict(a=9.0, b=9.8, shade=8.6) if RTL else dict(a=4.2, b=4.9, shade=3.8)
    cx, cy = W // 2, (450 if not TALL else 560)
    rx, ry = (125, 74) if not TALL else (78, 78)
    spokes = ''.join(f'<line class="§-sp" x1="{cx}" y1="{cy}" x2="{cx+1500*math.cos(a*math.pi/8):.0f}" y2="{cy+1100*math.sin(a*math.pi/8):.0f}" {PL}/>' for a in range(16))
    rings = ''.join(f'<ellipse class="§-rg" cx="{cx}" cy="{cy}" rx="{k*rx}" ry="{k*ry}" {PL}/>' for k in range(1, 8))
    tiles8 = [('devops-hubnew.jpg', 'DevOps Hub', 0, 2), ('warehouse-management.jpg', T('WMS חכם', 'Smart WMS'), 2, 3), ('translate-dub.jpg', 'VocalizePro', 5, 2),
              ('hapinkas-hayomi.jpg', T('הפנקס היומי', 'Daily Notebook'), 7, 3), ('automation.jpg', T('אוטומציה', 'Automation'), 10, 2),
              ('data-management.jpg', T('ניהול נתונים', 'Data Management'), 12, 3), ('gamma-deck.jpg', T('מצגת Gamma', 'Gamma Deck'), 14, 2),
              ('recipe-calculator.jpg', T('ספר המתכונים', 'Recipe Book'), 4, 4)]
    t8 = ''
    tw, th = (240, 150) if not TALL else (210, 132)
    for i, (img, lab, a, k) in enumerate(tiles8):
        ang = a * math.pi / 8; x = cx + k * rx * math.cos(ang); y = cy + k * ry * math.sin(ang)
        t8 += f'<div id="§-t{i}" class="§-shot" style="left:{x-tw/2:.0f}px;top:{y-th/2:.0f}px;width:{tw}px;height:{th}px"><img src="assets/{img}" alt=""><span class="§-chip" style="font-size:16px;padding:3px 8px">{lab}</span></div>'
    r = random.Random(80)
    knots = ''.join(f'<circle class="§-kn" cx="{cx+k*rx*math.cos(a*math.pi/8):.0f}" cy="{cy+k*ry*math.sin(a*math.pi/8):.0f}" r="5"/>' for a in range(16) for k in range(1, 8) if r.random() < .42)
    ox, oy = cx + 2 * rx, cy
    ty = 805 if not TALL else 1010
    css = f'''#§-world{{position:absolute;left:0;top:0;width:{W}px;height:{H}px;transform-origin:{ox}px {oy}px}}
.§-sp,.§-rg{{stroke:rgba(224,178,90,.55);stroke-width:2;fill:none}}.§-kn{{fill:#f3d596}}'''
    body = f'''<div id="§-world" data-layout-allow-overflow><svg class="§-ov" viewBox="0 0 {W} {H}">{spokes}{rings}{knots}</svg>{t8}</div>
<div id="§-shade" style="position:absolute;left:{W/2-600:.0f}px;top:{ty-65}px;width:1200px;height:200px;background:radial-gradient(closest-side,rgba(15,13,36,.92),rgba(15,13,36,0))"></div>
<div class="§-tx" style="top:{ty}px;left:40px;right:40px;text-align:center"><div class="§-h2" id="§-l1">{words(T("וכל חוט","And every thread"),"§-a")} <span class="§-acc">{words(T("מחובר לכל השאר.","connects to the rest."),"§-b")}</span></div></div>'''
    js = f'''tl.fromTo('#§-world', {{ scale: 6.2, x: {cx-ox}, y: {cy-oy}, rotation: -4 }}, {{ scale: 1, x: 0, y: 0, rotation: 0, duration: 8.6, ease: 'expo.inOut' }}, 0.4);
draw(QA('.§-sp'), 0.6, 4.5, 'power2.out');
tl.fromTo(QA('.§-rg'), {{ strokeDashoffset: 1 }}, {{ strokeDashoffset: 0, duration: 2.2, ease: 'power2.out', stagger: 0.45 }}, 1.6);
tl.fromTo(QA('.§-kn'), {{ opacity: 0 }}, {{ opacity: 1, duration: 0.4, stagger: 0.035 }}, 3.0);
tl.fromTo([1,2,3,4,5,6,7].map(i => '#§-t' + i), {{ opacity: 0, scale: 0.8 }}, {{ opacity: 1, scale: 1, duration: 0.9, ease: 'back.out(1.6)', stagger: 0.5 }}, 3.4);
tl.to('#§-world', {{ rotation: 1.2, duration: 3.0, ease: 'sine.inOut' }}, 9.0);
tl.fromTo('#§-shade', {{ opacity: 0 }}, {{ opacity: 1, duration: 1.0, ease: 'power2.out' }}, {c['shade']});
rise('#§-l1 .§-a', {c['a']}, {{ stagger: 0.2 }}); rise('#§-l1 .§-b', {c['b']}, {{ stagger: 0.16 }});'''
    frame(7, css, body, js, push=1.0, seed=8)

def f09():
    c = dict(t=0.1, ig=[2.0, 3.7, 5.4, 7.1], live=8.4) if RTL else dict(t=0.6, ig=[4.6, 5.3, 6.3, 7.2], live=7.6)
    st9 = [('1', T('תיקייה במחשב', 'Local folder'), T('נבנה ונבדק מקומית', 'built & tested locally')),
           ('2', T('מאגר ב־GitHub', 'GitHub repo'), T('לכל פרויקט מאגר משלו', 'one repo per project')),
           ('3', 'GitHub Pages', T('כתובת קבועה משלו', 'its own permanent URL')),
           ('4', T('באוויר', 'Live'), T('הסטטוס מתעדכן לבד', 'status updates itself'))]
    if TALL:
        xs = [540] * 4; ys = [420, 580, 740, 900]; vertical = True
    else:
        xs = [1530, 1110, 690, 270] if RTL else [390, 810, 1230, 1650]; ys = [475] * 4; vertical = False
    if vertical:
        stn = ''.join(f'<div class="§-row" id="§-st{i}" style="top:{y-55}px"><div class="§-num" id="§-nm{i}">{a}</div><div><div class="§-h3">{b}</div><div class="§-sub">{s}</div></div></div>' for i, ((a, b, s), y) in enumerate(zip(st9, ys)))
        line = f'<line id="§-silk" x1="{140 if RTL else 940}" y1="{ys[0]}" x2="{140 if RTL else 940}" y2="{ys[-1]}" class="§-silk" {PL}/>'
        line = f'<line id="§-silk" x1="{940 if RTL else 140}" y1="{ys[0]-80}" x2="{940 if RTL else 140}" y2="{ys[-1]}" class="§-silk" {PL}/>'
        bead_attr = 'cy'; bx = 940 if RTL else 140; start = ys[0] - 80; pts = ys
        stcss = f'''.§-row{{position:absolute;{'right' if RTL else 'left'}:80px;width:920px;display:flex;align-items:center;gap:40px;direction:{DIR};text-align:{ALIGN}}}'''
        pos = txpos(110, 90, 900)
    else:
        stn = ''.join(f'<div class="§-stn" id="§-st{i}" style="left:{x-170}px;top:420px"><div class="§-num" id="§-nm{i}">{a}</div><div class="§-h3">{b}</div><div class="§-sub">{s}</div></div>' for i, ((a, b, s), x) in enumerate(zip(st9, xs)))
        line = f'<line id="§-silk" x1="{1820 if RTL else 100}" y1="475" x2="{100 if RTL else 1820}" y2="475" class="§-silk" {PL}/>'
        bead_attr = 'cx'; start = 1820 if RTL else 100; pts = xs
        stcss = f'.§-stn{{position:absolute;width:340px;text-align:center;direction:{DIR}}}'
        pos = txpos(130, 150)
    by = 475 if not vertical else start
    bxx = start if not vertical else bx
    css = f'''{stcss}
.§-num{{flex:none;width:110px;height:110px;{'margin:0 auto 26px;' if not vertical else ''}border-radius:50%;border:3px solid #e0b25a;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-weight:500;font-size:46px;color:#f1eefc;background:#0f0d24}}
.§-sub{{font-family:'Assistant',sans-serif;font-size:{int(28*SC) if not vertical else 30}px;color:#a9a4cc;margin-top:10px}}
#§-bead{{filter:drop-shadow(0 0 14px #f3d596)}}'''
    body = f'''<svg class="§-ov" viewBox="0 0 {W} {H}">{line}<circle id="§-bead" cx="{bxx}" cy="{by}" r="12" fill="#f3d596"/></svg>
{stn}
<div class="§-tx" style="{pos}"><div class="§-h2" id="§-l1">{words(T("מהמחשב לאוויר,","From your computer to live,"),"§-a")} <span class="§-acc">{words(T("בארבעה צעדים","in four steps"),"§-b")}</span></div></div>'''
    moves = f"tl.fromTo('#§-bead', {{ attr: {{ {bead_attr}: {start} }}, opacity: 0 }}, {{ attr: {{ {bead_attr}: {pts[0]} }}, opacity: 1, duration: 0.6, ease: 'power2.out' }}, {c['ig'][0]-0.6});\n"
    for i in range(1, 4):
        moves += f"tl.to('#§-bead', {{ attr: {{ {bead_attr}: {pts[i]} }}, duration: {min(1.4, c['ig'][i]-c['ig'][i-1]-0.05):.2f}, ease: 'power3.inOut' }}, {c['ig'][i-1]+0.05:.2f});\n"
    ign = ''.join(f"tl.fromTo('#§-st{i}', {{ opacity: 0.25 }}, {{ opacity: 1, duration: 0.6, ease: 'power2.out' }}, {c['ig'][i]}); tl.fromTo('#§-nm{i}', {{ scale: 0.8 }}, {{ scale: 1, duration: 0.7, ease: 'back.out(2.4)' }}, {c['ig'][i]});\n" for i in range(4))
    js = f'''rise('#§-l1 .§-a', {c['t']}, {{ stagger: 0.14 }}); rise('#§-l1 .§-b', {c['t']+0.6}, {{ stagger: 0.14 }});
draw('#§-silk', 0.2, 1.6, 'power2.out');
{moves}{ign}tl.to('#§-nm3', {{ borderColor: '#62dcb8', color: '#62dcb8', boxShadow: '0 0 40px rgba(98,220,184,.55)', duration: 0.8, ease: 'power2.out' }}, {c['live']});
tl.to('#§-bead', {{ attr: {{ fill: '#62dcb8' }}, duration: 0.8 }}, {c['live']});'''
    frame(8, css, body, js, push=1.03, seed=9)

def f10():
    c = dict(t=3.0, sub=5.0) if RTL else dict(t=1.0, sub=3.4)
    names = [T('מסע — ניהול חופשות', 'Masa — vacation planner'), T('פארק־פלאן — חניון רובוטי', 'ParkPlan — robotic parking'), T('מצפן פיננסי', 'Finance Compass'),
             T('נט־פלאן — רשתות תקשורת', 'NetPlan — network design'), T('ספריית קודש', 'Sacred Library'), T('תשלומים חודשיים', 'Monthly Bills')]
    rows = ''.join(f'<div class="§-row" id="§-r{i}"><i class="§-led" id="§-led{i}"></i><span class="§-nm">{n}</span><span class="§-live">LIVE</span></div>' for i, n in enumerate(names))
    if TALL: rp = 'left:80px;top:520px;width:920px'; pos = txpos(130, 90, 900)
    else: rp = f'left:{mx(150, 760)}px;top:180px;width:760px'; pos = txpos(330, 150, 760)
    css = f'''.§-rows{{position:absolute;{rp};direction:{DIR}}}
.§-row{{display:flex;align-items:center;gap:26px;font-family:'Assistant',sans-serif;font-size:{int(38*SC) if not TALL else 38}px;padding:20px 26px;border-bottom:1px solid rgba(241,238,252,.12)}}
.§-nm{{flex:1}}.§-live{{font-family:'JetBrains Mono',monospace;font-size:22px;color:#62dcb8;letter-spacing:.12em}}
.§-led{{width:20px;height:20px;border-radius:50%;background:#62dcb8;box-shadow:0 0 18px #62dcb8}}'''
    body = f'''<div class="§-rows">{rows}</div>
<div class="§-tx" style="{pos}"><div class="§-h1" id="§-l1">{T('באוויר <span class="§-mint">עכשיו.</span>','Live <span class="§-mint">now.</span>')}</div><div class="§-lede" id="§-l2">{T("העמוד בודק את GitHub ומעדכן סטטוס לבד.","The page checks GitHub and updates its status on its own.")}</div></div>'''
    js = f'''QA('.§-row').forEach((r, i) => {{ const at = 0.2 + i * 0.42;
  tl.fromTo(r, {{ opacity: 0, x: {40 if RTL else -40} }}, {{ opacity: 1, x: 0, duration: 0.7, ease: 'power3.out' }}, at);
  tl.fromTo('#§-led' + i, {{ opacity: 0.15, scale: 0.6 }}, {{ opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(3)' }}, at + 0.35);
  tl.to('#§-led' + i, {{ opacity: 0.55, duration: 0.6, yoyo: true, repeat: 3, ease: 'sine.inOut' }}, at + 1.2 + (i % 3) * 0.2); }});
tl.fromTo('#§-l1', {{ opacity: 0, y: 50 }}, {{ opacity: 1, y: 0, duration: 1.2, ease: 'power3.out' }}, {c['t']});
fadeUp('#§-l2', {c['sub']});'''
    frame(9, css, body, js, push=1.03, seed=10)

def f11():
    c = dict(a=2.0, b=3.1, lede=4.6) if RTL else dict(a=1.8, b=2.6, lede=4.6)
    if TALL: wx, wy, sx, pos = 540, 830, 540, txpos(140, 90, 900)
    else: wx, wy, sx, pos = mx(430), 470, mx(1000), txpos(470, 170, 820)
    sy = 380 if not TALL else 560
    web = ''.join(f'<line class="§-sp" x1="{wx}" y1="{wy}" x2="{wx+300*math.cos(a*math.pi/8):.0f}" y2="{wy+300*math.sin(a*math.pi/8):.0f}"/>' for a in range(16)) + ''.join(f'<circle class="§-sp" cx="{wx}" cy="{wy}" r="{k*58}"/>' for k in range(1, 6))
    silk = '' if TALL else f'<line id="§-silk" x1="{sx}" y1="-10" x2="{sx}" y2="{sy}" class="§-silk" {PL}/><circle id="§-drop" cx="{sx}" cy="{sy+8}" r="11" fill="#f3d596"/>'
    if TALL: silk = f'<line id="§-silk" x1="{sx}" y1="470" x2="{sx}" y2="528" class="§-silk" {PL}/><circle id="§-drop" cx="{sx}" cy="536" r="11" fill="#f3d596"/>'
    body = f'''<svg class="§-ov" viewBox="0 0 {W} {H}"><g id="§-web">{web}</g>{silk}</svg>
<div class="§-tx" style="{pos}"><div class="§-h1" id="§-l1">{words(T("רוצים כזה","Want one like this"),"§-a")} <span class="§-acc">{words(T("לעסק?","for your business?"),"§-b")}</span></div><div class="§-lede" id="§-l2" style="font-size:{int(44*SC)}px">{T("בואו נטווה את החוט הבא.","Let's spin your next thread.")}</div></div>'''
    js = f'''tl.fromTo('#§-web', {{ opacity: 0, scale: 0.92, svgOrigin: '{wx} {wy}' }}, {{ opacity: 1, scale: 1, duration: 1.4, ease: 'power3.out' }}, 0.0);
tl.to('#§-web', {{ rotation: 8, svgOrigin: '{wx} {wy}', duration: 9, ease: 'none' }}, 0.0);
draw('#§-silk', 0.4, 1.6, 'power3.inOut');
tl.fromTo('#§-drop', {{ opacity: 0, y: -{60 if TALL else sy+10} }}, {{ opacity: 1, y: 0, duration: 1.6, ease: 'power3.inOut' }}, 0.4);
rise('#§-l1 .§-a', {c['a']}, {{ stagger: 0.16 }}); rise('#§-l1 .§-b', {c['b']}, {{ stagger: 0.14 }});
fadeUp('#§-l2', {c['lede']});
tl.to('#§-drop', {{ scale: 1.6, duration: 0.4, yoyo: true, repeat: 1, ease: 'power2.out', transformOrigin: '50% 50%' }}, 5.4);'''
    frame(10, '.§-sp{stroke:rgba(224,178,90,.6);stroke-width:2;fill:none}', body, js, push=1.04, seed=11)

def f12():
    ly = 150 if not TALL else 300
    logo = f'''<svg id="§-logo" viewBox="0 0 200 200" width="300" height="300" style="position:absolute;left:{W/2-150:.0f}px;top:{ly}px;overflow:visible">
<defs><linearGradient id="§-spg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6dc9a"/><stop offset=".55" stop-color="#e0b25a"/><stop offset="1" stop-color="#b9842f"/></linearGradient>
<linearGradient id="§-spv" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a99bff"/><stop offset="1" stop-color="#6c5ce7"/></linearGradient>
<linearGradient id="§-shine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<clipPath id="§-clip"><rect x="18" y="18" width="164" height="164" rx="40"/></clipPath></defs>
<rect id="§-box" x="18" y="18" width="164" height="164" rx="40" fill="#17143a" stroke="url(#§-spv)" stroke-width="5" pathLength="1" style="stroke-dasharray:1;stroke-dashoffset:1"/>
<path id="§-web" d="M62 70L136 64M62 70L138 128M138 128L58 154" stroke="#a99bff" stroke-width="2" opacity=".55" pathLength="1" style="stroke-dasharray:1;stroke-dashoffset:1"/>
<path id="§-s" d="M136 64c-6-14-20-22-38-22-22 0-36 12-36 28 0 34 76 22 76 58 0 18-16 30-40 30-20 0-34-9-40-24" fill="none" stroke="url(#§-spg)" stroke-width="13" stroke-linecap="round" pathLength="1" style="stroke-dasharray:1;stroke-dashoffset:1"/>
<g id="§-nodes"><circle cx="136" cy="64" r="7" fill="#0f0d24" stroke="url(#§-spg)" stroke-width="4"/><circle cx="62" cy="70" r="7" fill="#0f0d24" stroke="url(#§-spg)" stroke-width="4"/><circle cx="138" cy="128" r="7" fill="#0f0d24" stroke="url(#§-spg)" stroke-width="4"/><circle cx="58" cy="154" r="7" fill="#0f0d24" stroke="url(#§-spg)" stroke-width="4"/></g>
<g clip-path="url(#§-clip)"><rect id="§-sh" x="-120" y="0" width="80" height="200" fill="url(#§-shine)" transform="skewX(-18)"/></g>
</svg>'''
    cxl, cyl = W / 2, ly + 150
    conv = ''.join(f'<line class="§-cv" x1="{cxl+1500*math.cos(a*math.pi/6):.0f}" y1="{cyl+1200*math.sin(a*math.pi/6):.0f}" x2="{cxl:.0f}" y2="{cyl:.0f}" {PL}/>' for a in range(12))
    wt = ly + 350
    wsize = 110 if not TALL else 96
    css = f'''.§-cv{{stroke:rgba(224,178,90,.7);stroke-width:2;fill:none}}
.§-word{{position:absolute;left:0;right:0;top:{wt}px;text-align:center;font-family:'Michroma',sans-serif;font-size:{wsize}px;color:#f1eefc;letter-spacing:.32em;padding-left:.32em}}
.§-who{{position:absolute;left:0;right:0;top:{wt+180}px;text-align:center;direction:{DIR};font-family:'Assistant',sans-serif;font-weight:500;font-size:44px;color:#f1eefc}}
.§-url{{position:absolute;left:0;right:0;top:{wt+260}px;text-align:center;font-family:'JetBrains Mono',monospace;font-size:{30 if not TALL else 24}px;color:#a9a4cc}}
#§-fade{{position:absolute;inset:0;background:#0f0d24}}
#§-glow{{position:absolute;left:{cxl-400:.0f}px;top:{cyl-400:.0f}px;width:800px;height:800px;background:radial-gradient(closest-side,rgba(224,178,90,.18),rgba(224,178,90,0))}}'''
    chars = ''.join(f'<span class="§-ch" style="display:inline-block">{ch}</span>' for ch in 'SPIDER')
    body = f'''<div id="§-glow"></div><svg class="§-ov" viewBox="0 0 {W} {H}"><g id="§-conv">{conv}</g></svg>
{logo}
<div class="§-word" id="§-word">{chars}</div>
<div class="§-who" id="§-who">{T("חיים קריספין · 054-4979771","Haim Krispin · +972-54-497-9771")}</div>
<div class="§-url" id="§-url">devopsdevopshaim-wq.github.io/devops-hub/portfolio</div>
<div id="§-fade"></div>'''
    js = '''draw(QA('.§-cv'), 0.0, 1.4, 'power3.in');
tl.to(QA('.§-cv'), { opacity: 0, duration: 0.5 }, 1.3);
tl.fromTo('#§-glow', { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 2.4, ease: 'power2.out' }, 1.2);
tl.fromTo('#§-logo', { scale: 0.9, transformOrigin: '50% 50%' }, { scale: 1, duration: 2.4, ease: 'power3.out' }, 0.9);
tl.fromTo('#§-box', { strokeDashoffset: 1, fillOpacity: 0 }, { strokeDashoffset: 0, fillOpacity: 1, duration: 1.2, ease: 'power2.out' }, 1.0);
draw('#§-web', 1.4, 0.9, 'power2.out');
draw('#§-s', 1.6, 1.3, 'power3.inOut');
tl.fromTo(QA('#§-nodes circle'), { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.5, ease: 'back.out(2.5)', stagger: 0.12 }, 2.2);
QA('.§-ch').forEach((c, i) => tl.fromTo(c, { opacity: 0, x: (i - 2.5) * 70 }, { opacity: 1, x: 0, duration: 1.6, ease: 'expo.out' }, 2.6 + Math.abs(i - 2.5) * 0.05));
fadeUp('#§-who', 4.6);
fadeUp('#§-url', 5.3);
tl.fromTo('#§-sh', { x: -120 }, { x: 360, duration: 1.6, ease: 'power2.inOut' }, 6.4);
tl.fromTo('#§-fade', { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'power2.in' }, 8.2);'''
    frame(11, css, body, js, push=1.025, seed=12)



for f in (f01, f02, f03, f04, f05, f06, f07, f08, f09, f10, f11, f12): f()
print(f'frames written: {FMT} {LANG} -> {PROJ}')
