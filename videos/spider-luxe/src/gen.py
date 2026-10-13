# SPIDER "The Atelier" — frame generator for both cuts (English and Hebrew), 1920x1080.
# usage: python3 gen.py <project_dir> <en|he>
import sys, os, math, random

PROJ, LANG = sys.argv[1], sys.argv[2]
HE = LANG == 'he'
W, H = 1920, 1080
HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = open(os.path.join(HERE, 'fonts.css')).read()

# scene starts and lengths (seconds); the index overlaps each scene 0.8s into the next for the crossfade
STARTS = [0, 6, 12.5, 20, 29, 38, 47, 55, 63]
TOTAL = 73
IDS = ['01-line', '02-name', '03-count', '04-intelligence', '05-engineering', '06-living', '07-heritage', '08-wall', '09-signature']
XF = 0.8
def dur(i): return round((STARTS[i + 1] if i + 1 < len(STARTS) else TOTAL) - STARTS[i] + (XF if i + 1 < len(STARTS) else 0), 2)

def T(en, he): return he if HE else en
DIR = 'rtl' if HE else 'ltr'
ALIGN = 'right' if HE else 'left'
SIDE = 'right' if HE else 'left'      # text column side
OPP = 'left' if HE else 'right'       # gallery side

GOLD, GOLD_HI, IVORY, MUTED, ONYX = '#d6b46e', '#f2deac', '#f3ede2', '#8f887b', '#09080a'

BASE_CSS = f'''
#root{{position:absolute;inset:0;width:100%;height:100%;overflow:hidden;color:{IVORY};font-family:'Assistant',sans-serif}}
.§-bg{{position:absolute;inset:0;background:radial-gradient(90% 80% at 50% 38%,#1a1610 0%,#0e0c0a 45%,{ONYX} 100%)}}
.§-dust{{position:absolute;border-radius:50%;background:{GOLD_HI}}}
.§-grain{{position:absolute;left:-256px;top:-256px;width:{W+512}px;height:{H+512}px;background:url(assets/grain.png);opacity:.06;mix-blend-mode:overlay}}
.§-vig{{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 46%,rgba(0,0,0,0) 50%,rgba(0,0,0,.72) 100%)}}
.§-ov{{position:absolute;left:0;top:0;width:{W}px;height:{H}px;overflow:visible}}
.§-tx{{position:absolute;direction:{DIR};text-align:{ALIGN}}}
.§-eye{{display:block;font-family:{"'Assistant',sans-serif;font-weight:600;font-size:28px;letter-spacing:.18em" if HE else "'Michroma',sans-serif;font-size:19px;letter-spacing:.42em"};color:{GOLD};text-transform:uppercase;margin-bottom:30px}}
.§-h1{{font-family:'Bellefair',serif;font-weight:400;font-size:{104 if HE else 96}px;line-height:1.08;letter-spacing:{'0' if HE else '-.005em'}}}
.§-h2{{font-family:'Bellefair',serif;font-weight:400;font-size:{80 if HE else 74}px;line-height:1.1}}
.§-lede{{font-family:'Assistant',sans-serif;font-weight:400;font-size:{36 if HE else 32}px;color:{MUTED};margin-top:30px;line-height:1.45;letter-spacing:{'0' if HE else '.01em'}}}
.§-gold{{color:{GOLD_HI}}}
.§-m{{display:inline-block;overflow:hidden;vertical-align:top;padding:0 .04em .14em}}
.§-w{{display:inline-block;white-space:pre}}
.§-rule{{display:block;width:120px;height:1px;background:{GOLD};margin-top:36px;transform-origin:{'100%' if HE else '0%'} 50%}}
.§-panel{{position:absolute;overflow:visible}}
.§-glass{{position:absolute;inset:0;border-radius:10px;overflow:hidden;border:1px solid rgba(214,180,110,.55);box-shadow:0 40px 90px rgba(0,0,0,.75),0 0 0 1px rgba(0,0,0,.6);background:#111;-webkit-box-reflect:below 14px linear-gradient(transparent 72%,rgba(255,255,255,.13))}}
.§-glass img{{display:block;width:100%;height:100%;object-fit:cover;object-position:top}}
.§-sheen{{position:absolute;top:-20%;left:0;width:34%;height:140%;background:linear-gradient(100deg,rgba(255,240,210,0),rgba(255,240,210,.22),rgba(255,240,210,0));pointer-events:none}}
.§-cap{{position:absolute;top:calc(100% + 22px);{SIDE}:0;direction:{DIR};font-family:{"'Assistant',sans-serif;font-weight:500;font-size:24px;letter-spacing:.04em" if HE else "'Michroma',sans-serif;font-size:13px;letter-spacing:.3em;text-transform:uppercase"};color:{MUTED};white-space:nowrap}}
.§-hair{{stroke:{GOLD};stroke-width:1.2;fill:none}}
'''

def dust(n, seed):
    r = random.Random(seed); o = ''
    for i in range(n):
        x, y, s = r.uniform(0, W), r.uniform(0, H), r.uniform(1.0, 3.4)
        o += (f'<i class="§-dust" data-dy="{r.uniform(-60,-160):.0f}" data-dx="{r.uniform(-40,40):.0f}" '
              f'style="left:{x:.0f}px;top:{y:.0f}px;width:{s:.1f}px;height:{s:.1f}px;opacity:{r.uniform(.15,.6):.2f}"></i>')
    return o

def words(t, cls=''):
    ws = t.split()
    return ''.join(f'<span class="§-m"><span class="§-w {cls}">{w}</span></span>{" " if i < len(ws) - 1 else ""}' for i, w in enumerate(ws))

def panel(pid, img, label, x, y, w, h, z=0):
    return (f'<div class="§-panel" id="§-{pid}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;z-index:{z}">'
            f'<div class="§-glass"><img src="assets/shots/{img}.jpg" alt=""><div class="§-sheen" id="§-{pid}-sh"></div></div>'
            f'<span class="§-cap">{label}</span></div>')

def mx(x, w=0):
    """English layouts are authored right-to-left (text right); mirror x so text sits left in English."""
    return x if HE else W - x - w

PL = 'pathLength="1" style="stroke-dasharray:1;stroke-dashoffset:1"'

COMMON_JS = r'''
const tl = gsap.timeline({ paused: true });
const Q = s => document.querySelector(s);
const QA = s => Array.from(document.querySelectorAll(s));
const HE = __HE__, D = __D__;
const rise = (sel, at, opt) => tl.fromTo(sel, { yPercent: 115, opacity: 0 }, Object.assign({ yPercent: 0, opacity: 1, duration: 1.3, ease: 'expo.out', stagger: 0.09 }, opt || {}), at);
const fadeUp = (sel, at, opt) => tl.fromTo(sel, { y: 18, opacity: 0, filter: 'blur(8px)' }, Object.assign({ y: 0, opacity: 1, filter: 'blur(0px)', duration: 1.4, ease: 'power3.out' }, opt || {}), at);
const rule = (sel, at) => tl.fromTo(sel, { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: 'expo.inOut' }, at);
const draw = (sel, at, d, ease) => tl.fromTo(sel, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: d || 1.6, ease: ease || 'power2.inOut' }, at);
const panelIn = (id, at, opt) => {
  const o = opt || {}; const side = o.side || (HE ? -1 : 1);
  tl.fromTo('#§-' + id, { opacity: 0, x: 80 * side, rotationY: -22 * side, z: -260, transformPerspective: 1800, filter: 'blur(14px) brightness(.4)' },
    { opacity: 1, x: 0, rotationY: o.ry || 0, z: 0, filter: 'blur(0px) brightness(1)', duration: o.d || 1.8, ease: 'expo.out' }, at);
  tl.fromTo('#§-' + id + '-sh', { xPercent: -140 }, { xPercent: 360, duration: 1.8, ease: 'power2.inOut' }, at + (o.sh || 0.9));
};
// ambient: rising gold dust, grain, slow camera push
QA('.§-dust').forEach(p => tl.fromTo(p, { x: 0, y: 0 }, { x: +p.dataset.dx, y: +p.dataset.dy, duration: D, ease: 'none' }, 0));
tl.fromTo('#§-grain', { x: 0, y: 0 }, { x: -192, y: 128, duration: D, ease: 'steps(' + Math.round(D * 12) + ')' }, 0);
tl.fromTo('#§-push', { scale: 1.0 }, { scale: __PUSH__, duration: D, ease: 'none', transformOrigin: '50% 48%' }, 0);
'''

def frame(idx, css, body, js, push=1.03, seed=1, ndust=46):
    fid = IDS[idx]; d = dur(idx)
    bg = (f'<div id="§-bgclip" class="clip §-bg" data-start="0" data-duration="{d}" data-track-index="0">'
          f'<div id="§-dustl">{dust(ndust, seed)}</div></div>')
    fx = (f'<div id="§-fx" class="clip" data-start="0" data-duration="{d}" data-track-index="2" data-layout-allow-overflow>'
          f'<div class="§-vig"></div><div class="§-grain" id="§-grain"></div></div>')
    js_all = COMMON_JS.replace('__HE__', 'true' if HE else 'false').replace('__D__', str(d)).replace('__PUSH__', str(push)) + js
    html = f'''<template>
<style>
{FONTS}
{BASE_CSS}
{css}
</style>
<div id="root" data-composition-id="{fid}" data-width="{W}" data-height="{H}" data-duration="{d}">
{bg}
<div class="clip" data-start="0" data-duration="{d}" data-track-index="1" id="§-stage" data-layout-allow-overflow><div id="§-push" style="position:absolute;inset:0">
{body}
</div></div>
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

def textblock(x, y, w, eye, title, lede, h='h1'):
    pos = f'top:{y}px;{SIDE}:{x}px;width:{w}px'
    return (f'<div class="§-tx" id="§-tb" style="{pos}">'
            + (f'<span class="§-eye" id="§-eye">{eye}</span>' if eye else '')
            + f'<div class="§-{h}" id="§-title">{words(title)}</div>'
            + f'<span class="§-rule" id="§-rule"></span>'
            + (f'<div class="§-lede" id="§-lede">{lede}</div>' if lede else '') + '</div>')

TEXT_IN = '''tl.fromTo('#§-eye', { opacity: 0, x: HE ? -30 : 30 }, { opacity: 1, x: 0, duration: 1.8, ease: 'power3.out' }, __A__);
rise('#§-title .§-w', __B__);
rule('#§-rule', __C__);
fadeUp('#§-lede', __L__);
'''
def text_in(a, b, c, l): return TEXT_IN.replace('__A__', str(a)).replace('__B__', str(b)).replace('__C__', str(c)).replace('__L__', str(l))

def web_svg(cx, cy, r, sid='web'):
    """the SPIDER monogram: six spokes and three woven rings, drawn in gold hairline"""
    spokes = ''.join(f'<line class="§-hair §-sp" x1="{cx}" y1="{cy}" x2="{cx + r*math.cos(math.pi/6 + k*math.pi/3):.1f}" y2="{cy + r*math.sin(math.pi/6 + k*math.pi/3):.1f}" {PL}/>' for k in range(6))
    rings = ''
    for j, f in enumerate((0.36, 0.66, 0.96)):
        pts = ' '.join(f'{cx + r*f*math.cos(math.pi/6 + k*math.pi/3):.1f},{cy + r*f*math.sin(math.pi/6 + k*math.pi/3):.1f}' for k in range(7))
        rings += f'<polyline class="§-hair §-rg" points="{pts}" {PL}/>'
    node = f'<circle id="§-core" cx="{cx}" cy="{cy}" r="5" fill="{GOLD_HI}"/>'
    return f'<g id="§-{sid}">{spokes}{rings}{node}</g>'

# ======================= scenes =======================
def s01():
    line = T('Every masterpiece begins with a single line.', 'כל יצירת מופת מתחילה בקו אחד.')
    css = f'''#§-line{{position:absolute;left:0;top:{H/2+70}px;width:{W}px;height:1px;background:linear-gradient(90deg,rgba(214,180,110,0),{GOLD} 30%,{GOLD_HI} 50%,{GOLD} 70%,rgba(214,180,110,0));transform-origin:50% 50%}}
#§-flare{{position:absolute;left:-300px;top:{H/2+70-60}px;width:600px;height:120px;background:radial-gradient(closest-side,rgba(255,236,190,.85),rgba(255,236,190,.18) 40%,rgba(255,236,190,0));mix-blend-mode:screen}}
#§-streak{{position:absolute;left:0;top:{H/2+70-2}px;width:{W}px;height:4px;background:linear-gradient(90deg,rgba(255,236,190,0),rgba(255,236,190,.6),rgba(255,236,190,0));filter:blur(2px);opacity:0}}
#§-q{{position:absolute;left:0;right:0;top:{H/2-90}px;text-align:center;direction:{DIR};font-family:'Bellefair',serif;font-size:{78 if HE else 70}px;line-height:1.1;color:{IVORY}}}'''
    body = f'<div id="§-line"></div><div id="§-streak"></div><div id="§-flare"></div><div id="§-q">{words(line)}</div>'
    js = f'''tl.fromTo('#§-line', {{ scaleX: 0 }}, {{ scaleX: 1, duration: 2.6, ease: 'expo.inOut' }}, 0.2);
tl.fromTo('#§-flare', {{ x: HE ? 1920 + 300 : 0, opacity: 0 }}, {{ x: HE ? -300 : 1920 + 300, opacity: 1, duration: 3.0, ease: 'power2.inOut' }}, 0.3);
tl.to('#§-flare', {{ opacity: 0, duration: 0.6 }}, 3.3);
tl.fromTo('#§-streak', {{ opacity: 0 }}, {{ opacity: 1, duration: 0.5, yoyo: true, repeat: 1, ease: 'sine.inOut' }}, 1.2);
rise('#§-q .§-w', 1.5, {{ stagger: 0.11, duration: 1.6 }});
tl.to('#§-q', {{ opacity: 0, filter: 'blur(10px)', duration: 0.9, ease: 'power2.in' }}, 5.4);
tl.to('#§-line', {{ scaleX: 0.02, duration: 1.0, ease: 'expo.inOut' }}, 5.5);'''
    frame(0, css, body, js, push=1.045, seed=3, ndust=30)

def s02():
    cx, cy, r = W/2, 330, 120
    css = f'''#§-word{{position:absolute;left:0;right:0;top:520px;text-align:center;font-family:'Michroma',sans-serif;font-size:112px;color:{IVORY};letter-spacing:.38em;padding-left:.38em;direction:ltr}}
#§-sub{{position:absolute;left:0;right:0;top:700px;text-align:center;direction:{DIR};font-family:'Bellefair',serif;font-size:{50 if HE else 46}px;color:{GOLD_HI}}}
#§-r1,#§-r2{{position:absolute;top:735px;width:160px;height:1px;background:{GOLD}}}
#§-glow{{position:absolute;left:{cx-380}px;top:{cy-380}px;width:760px;height:760px;background:radial-gradient(closest-side,rgba(214,180,110,.16),rgba(214,180,110,0))}}
#§-shine{{position:absolute;left:0;top:470px;width:520px;height:230px;background:radial-gradient(closest-side,rgba(255,236,190,.16),rgba(255,236,190,0));mix-blend-mode:screen}}'''
    chars = ''.join(f'<span class="§-ch" style="display:inline-block">{c}</span>' for c in 'SPIDER')
    sub = T('The digital atelier of Haim Krispin', 'הסדנה הדיגיטלית של חיים קריספין')
    body = (f'<div id="§-glow"></div><svg class="§-ov" viewBox="0 0 {W} {H}">{web_svg(cx, cy, r)}</svg>'
            f'<div id="§-word">{chars}</div><div id="§-shine"></div><div id="§-sub">{sub}</div>')
    js = f'''tl.fromTo('#§-glow', {{ opacity: 0, scale: 0.7 }}, {{ opacity: 1, scale: 1, duration: 2.6, ease: 'power2.out' }}, 0.0);
draw(QA('.§-sp'), 0.1, 1.2, 'power3.out');
QA('.§-rg').forEach((g, i) => draw(g, 0.6 + i * 0.25, 1.4, 'power2.inOut'));
tl.fromTo('#§-core', {{ scale: 0, transformOrigin: '50% 50%' }}, {{ scale: 1, duration: 0.8, ease: 'back.out(3)' }}, 0.2);
tl.to('#§-web', {{ rotation: 12, svgOrigin: '{cx} {cy}', duration: {dur(1)}, ease: 'none' }}, 0);
QA('.§-ch').forEach((c, i) => tl.fromTo(c, {{ opacity: 0, filter: 'blur(14px)', y: 26, x: (i - 2.5) * 46 }}, {{ opacity: 1, filter: 'blur(0px)', y: 0, x: 0, duration: 3.0, ease: 'expo.out' }}, 0.9 + Math.abs(i - 2.5) * 0.12));
tl.fromTo('#§-shine', {{ x: -300 }}, {{ x: {W+100}, duration: 1.8, ease: 'power2.inOut' }}, 2.6);
fadeUp('#§-sub', 2.4);'''
    frame(1, css, body, js, push=1.035, seed=5)

def s03():
    n = 48; cy, R = 520, 300
    cx = W - 640 if not HE else 640
    dots = ''.join(f'<circle class="§-dot" cx="{cx + R*math.cos(-math.pi/2 + k*2*math.pi/n):.1f}" cy="{cy + R*math.sin(-math.pi/2 + k*2*math.pi/n):.1f}" r="4.2"/>' for k in range(n))
    css = f'''#§-num{{position:absolute;left:{cx-300}px;top:{cy-205}px;width:600px;text-align:center;font-family:'Bellefair',serif;font-size:330px;line-height:1;color:{GOLD_HI};font-variant-numeric:lining-nums}}
.§-dot{{fill:{GOLD}}}
#§-ring{{stroke:rgba(214,180,110,.35);stroke-width:1;fill:none}}'''
    title = T('Bespoke systems.', 'מערכות בהתאמה אישית.')
    lede = T('Each one real. Each one live.', 'כל אחת אמיתית. כל אחת באוויר.')
    body = (f'<svg class="§-ov" viewBox="0 0 {W} {H}"><circle id="§-ring" cx="{cx}" cy="{cy}" r="{R}" {PL}/>{dots}</svg>'
            f'<div id="§-num">0</div>' + textblock(170, 390, 760, T('Forty-eight', 'ארבעים ושמונה'), title, lede, 'h2'))
    js = f'''draw('#§-ring', 0.2, 2.2, 'power2.inOut');
tl.fromTo(QA('.§-dot'), {{ opacity: 0, scale: 0, transformOrigin: '50% 50%' }}, {{ opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(3)', stagger: 0.045 }}, 0.5);
const cnt = {{ v: 0 }};
tl.to(cnt, {{ v: 48, duration: 2.6, ease: 'power3.out', onUpdate: () => {{ Q('#§-num').textContent = Math.round(cnt.v); }} }}, 0.5);
tl.fromTo('#§-num', {{ opacity: 0, scale: 0.94, filter: 'blur(10px)' }}, {{ opacity: 1, scale: 1, filter: 'blur(0px)', duration: 1.4, ease: 'power3.out' }}, 0.4);
tl.to(QA('.§-dot'), {{ fill: '#f2deac', duration: 0.3, stagger: 0.02, yoyo: true, repeat: 1 }}, 3.4);
{text_in(1.0, 1.4, 2.0, 3.4)}'''
    frame(2, css, body, js, push=1.03, seed=7)

def gallery(idx, eye, title, lede, shots, layout, seed, extra_css='', extra_body='', extra_js=''):
    """text column on SIDE, glass panels on the other side"""
    body = extra_body + textblock(150, 330, 590, eye, title, lede)
    js = text_in(0.4, 0.8, 1.6, 3.6)
    for k, ((img, label), (x, y, w, h, at, ry, z)) in enumerate(zip(shots, layout)):
        body += panel(f'p{k}', img, label, mx(x, w), y, w, h, z)
        ryv = ry if HE else -ry
        js += f"panelIn('p{k}', {at}, {{ ry: {ryv} }});\n"
        js += f"tl.to('#§-p{k}', {{ y: '-=' + {14 + 6*k}, duration: {dur(idx)} - {at}, ease: 'none' }}, {at + 1.8});\n"
    frame(idx, extra_css, body, js + extra_js, push=1.04, seed=seed)

def s04():
    shots = [('jarvis-web', 'JARVIS'), ('aia-studio', T('AIA Studio', 'עיצוב AIA')), ('smart-office-assistant', T('Office Assistant', 'עוזר משרד חכם'))]
    # authored for Hebrew (text right, panels left); mirrored for English
    layout = [(90, 150, 700, 438, 1.0, 14, 1), (500, 470, 620, 388, 2.0, 10, 2), (180, 640, 420, 262, 3.0, 16, 3)]
    gallery(3, T('I · Intelligence', 'I · בינה'), T('Intelligence, tailored.', 'בינה מלאכותית, בהתאמה אישית.'),
            T('Agents, assistants and studios that think with you.', 'סוכנים, עוזרים וסטודיו שחושבים איתך.'), shots, layout, 11)

def s05():
    shots = [('robotic-parking', T('Robotic Parking', 'חניון רובוטי')), ('assembly-studio', T('Assembly Studio', 'סטודיו הרכבה')),
             ('automation', T('Drive Plan', 'דרייב־פלאן')), ('electro-fix', T('Electro Fix', 'מעגל סגור'))]
    layout = [(100, 130, 560, 350, 0.9, 12, 1), (700, 160, 460, 288, 1.6, 12, 2), (100, 560, 460, 288, 2.3, 12, 3), (600, 590, 560, 350, 3.0, 12, 4)]
    grid = ''.join(f'<line class="§-bp" x1="{x}" y1="0" x2="{x}" y2="{H}" {PL}/>' for x in range(0, W + 1, 120))
    grid += ''.join(f'<line class="§-bp" x1="0" y1="{y}" x2="{W}" y2="{y}" {PL}/>' for y in range(60, H, 120))
    css = '.§-bp{stroke:rgba(214,180,110,.07);stroke-width:1}'
    js = "QA('.§-bp').forEach((l, i) => draw(l, 0.05 * (i % 12), 2.2, 'power2.out'));\n"
    gallery(4, T('II · Engineering', 'II · הנדסה'), T('Engineering, with precision.', 'הנדסה, בדיוק מוחלט.'),
            T('From robotic parking to the electrical panel.', 'מחניון רובוטי ועד לוח החשמל.'), shots, layout, 13,
            css, f'<svg class="§-ov" viewBox="0 0 {W} {H}">{grid}</svg>', js)

def s06():
    shots = [('vacation-hub', T('Masa · Travel', 'מסע · חופשות')), ('finance-hub', T('Finance Compass', 'מצפן פיננסי')),
             ('wellness-hub', T('Health Compass', 'מצפן בריאות')), ('marketing-hub', T('Campaign Builder', 'פרסום ושיווק'))]
    # a slow horizontal procession of four panels
    layout = [(60, 200, 520, 325, 0.8, 0, 1), (640, 200, 520, 325, 1.4, 0, 2), (60, 600, 520, 325, 2.0, 0, 3), (640, 600, 520, 325, 2.6, 0, 4)]
    gallery(5, T('III · Living', 'III · חיים'), T('Refined tools for everyday life.', 'כלים מעודנים לחיי היומיום.'),
            T('Travel, finance, health and growth.', 'חופשות, כספים, בריאות וצמיחה.'), shots, layout, 17)

def s07():
    shots = [('torah-hub', T('Sacred Library', 'ספריית קודש')), ('book-studio', T('Book Studio', 'סטודיו ספרים')),
             ('comic-studio', T('Panel · Comics', 'פאנל · קומיקס')), ('hebrew-calendar', T('Hebrew Calendar', 'לוח שנה עברי'))]
    # a fan: the focal panel centred, three behind it
    layout = [(330, 300, 760, 475, 1.6, 0, 4), (80, 170, 520, 325, 0.6, 16, 1), (620, 140, 520, 325, 0.9, -10, 2), (120, 650, 440, 275, 1.2, 14, 3)]
    gallery(6, T('IV · Heritage', 'IV · מורשת'), T('Creation and heritage.', 'יצירה ומורשת.'),
            T('Books, comics and a library of sacred texts.', 'ספרים, קומיקס וספריית קודש.'), shots, layout, 19)

def s08():
    imgs = ['finance-hub', 'jarvis-web', 'torah-hub', 'robotic-parking', 'marketing-hub', 'aia-studio', 'wellness-hub', 'vacation-hub',
            'devops-hubnew', 'comic-studio', 'automation', 'interior', 'book-studio', 'rork-app', 'zohar-v1', 'assembly-studio',
            'translate-dub', 'hapinkas-hayomi', 'electro-fix', 'netplan', 'smart-office-assistant', 'housing-system', 'bills-hub', 'health-compass']
    tw, th, gap, cols = 400, 250, 26, 6
    gw = cols * tw + (cols - 1) * gap
    tiles = ''
    for k, im in enumerate(imgs):
        c, r = k % cols, k // cols
        tiles += f'<div class="§-tile" style="left:{c*(tw+gap)}px;top:{r*(th+gap)}px"><img src="assets/shots/{im}.jpg" alt=""></div>'
    css = f'''#§-wall{{position:absolute;left:{(W-gw)/2:.0f}px;top:{(H-(4*th+3*gap))/2:.0f}px;width:{gw}px;height:{4*th+3*gap}px;transform-style:preserve-3d}}
.§-tile{{position:absolute;width:{tw}px;height:{th}px;border-radius:8px;overflow:hidden;border:1px solid rgba(214,180,110,.4);box-shadow:0 20px 50px rgba(0,0,0,.7)}}
.§-tile img{{width:100%;height:100%;object-fit:cover;object-position:top;display:block}}
#§-dim{{position:absolute;inset:0;background:radial-gradient(60% 55% at 50% 50%,rgba(9,8,10,.92),rgba(9,8,10,.55))}}
#§-c{{position:absolute;left:0;right:0;top:380px;text-align:center;direction:{DIR}}}
#§-c .§-h1{{font-size:{110 if HE else 104}px}}
#§-c .§-rule{{margin:36px auto 0;transform-origin:50% 50%}}'''
    title = T('One craftsman. Every detail.', 'יוצר אחד. כל פרט.')
    lede = T('From the first line, to live.', 'מהקו הראשון, ועד לאוויר.')
    body = (f'<div id="§-persp" style="position:absolute;inset:0;perspective:2200px"><div id="§-wall">{tiles}</div></div><div id="§-dim"></div>'
            f'<div id="§-c"><div class="§-h1" id="§-title">{words(title)}</div><span class="§-rule" id="§-rule"></span><div class="§-lede" id="§-lede">{lede}</div></div>')
    js = f'''tl.fromTo('#§-wall', {{ rotationX: 26, rotationZ: {7 if HE else -7}, scale: 1.5, z: 0 }}, {{ rotationX: 14, rotationZ: {3 if HE else -3}, scale: 1.05, duration: {dur(7)}, ease: 'power1.inOut' }}, 0);
const tiles = QA('.§-tile'); tiles.sort((a, b) => Math.hypot(a.offsetLeft - 1100, a.offsetTop - 500) - Math.hypot(b.offsetLeft - 1100, b.offsetTop - 500));
tl.fromTo(tiles, {{ opacity: 0, z: -400 }}, {{ opacity: 1, z: 0, duration: 1.2, ease: 'expo.out', stagger: 0.05 }}, 0.0);
tl.fromTo('#§-dim', {{ opacity: 0 }}, {{ opacity: 1, duration: 1.6, ease: 'power2.inOut' }}, 2.2);
rise('#§-title .§-w', 2.6);
rule('#§-rule', 3.3);
fadeUp('#§-lede', 3.8);'''
    frame(7, css, body, js, push=1.02, seed=23, ndust=24)

def s09():
    cx, cy, r = W/2, 300, 130
    css = f'''#§-word{{position:absolute;left:0;right:0;top:500px;text-align:center;font-family:'Michroma',sans-serif;font-size:104px;color:{IVORY};letter-spacing:.38em;padding-left:.38em;direction:ltr}}
#§-tag{{position:absolute;left:0;right:0;top:660px;text-align:center;direction:{DIR};font-family:'Bellefair',serif;font-size:{58 if HE else 54}px;color:{GOLD_HI}}}
#§-rl{{position:absolute;left:{W/2-60}px;top:770px;width:120px;height:1px;background:{GOLD}}}
#§-who{{position:absolute;left:0;right:0;top:810px;text-align:center;direction:{DIR};font-family:'Assistant',sans-serif;font-weight:500;font-size:34px;color:{IVORY};letter-spacing:.04em}}
#§-url{{position:absolute;left:0;right:0;top:868px;text-align:center;font-family:'Michroma',sans-serif;font-size:17px;letter-spacing:.2em;color:{MUTED};direction:ltr}}
#§-glow{{position:absolute;left:{cx-420}px;top:{cy-420}px;width:840px;height:840px;background:radial-gradient(closest-side,rgba(214,180,110,.2),rgba(214,180,110,0))}}
#§-line{{position:absolute;left:0;top:{cy}px;width:{W}px;height:1px;background:linear-gradient(90deg,rgba(214,180,110,0),{GOLD_HI} 50%,rgba(214,180,110,0))}}
#§-out{{position:absolute;inset:0;background:#000}}'''
    chars = ''.join(f'<span class="§-ch" style="display:inline-block">{c}</span>' for c in 'SPIDER')
    body = (f'<div id="§-glow"></div><div id="§-line"></div><svg class="§-ov" viewBox="0 0 {W} {H}">{web_svg(cx, cy, r)}</svg>'
            f'<div id="§-word">{chars}</div><div id="§-tag">{T("Your next system, crafted.", "המערכת הבאה שלכם, בעבודת יד.")}</div>'
            f'<div id="§-rl"></div><div id="§-who">{T("Haim Krispin · +972 54-497-9771", "חיים קריספין · 054-4979771")}</div>'
            f'<div id="§-url">DEVOPSDEVOPSHAIM-WQ.GITHUB.IO/DEVOPS-HUB/PORTFOLIO</div><div id="§-out"></div>')
    js = f'''tl.fromTo('#§-line', {{ scaleX: 0 }}, {{ scaleX: 1, duration: 1.4, ease: 'expo.inOut' }}, 0.1);
tl.to('#§-line', {{ scaleX: 0, opacity: 0, duration: 1.0, ease: 'expo.in' }}, 1.55);
draw(QA('.§-sp'), 1.5, 1.1, 'power3.out');
QA('.§-rg').forEach((g, i) => draw(g, 1.9 + i * 0.22, 1.3, 'power2.inOut'));
tl.fromTo('#§-core', {{ scale: 0, transformOrigin: '50% 50%' }}, {{ scale: 1, duration: 0.8, ease: 'back.out(3)' }}, 1.6);
tl.fromTo('#§-glow', {{ opacity: 0, scale: 0.6 }}, {{ opacity: 1, scale: 1, duration: 2.6, ease: 'power2.out' }}, 1.6);
tl.to('#§-web', {{ rotation: 10, svgOrigin: '{cx} {cy}', duration: {dur(8)}, ease: 'none' }}, 0);
QA('.§-ch').forEach((c, i) => tl.fromTo(c, {{ opacity: 0, filter: 'blur(14px)', y: 22 }}, {{ opacity: 1, filter: 'blur(0px)', y: 0, duration: 1.6, ease: 'expo.out' }}, 2.3 + Math.abs(i - 2.5) * 0.1));
fadeUp('#§-tag', 3.4);
tl.fromTo('#§-rl', {{ scaleX: 0 }}, {{ scaleX: 1, duration: 1.2, ease: 'expo.inOut' }}, 4.2);
fadeUp('#§-who', 4.6);
fadeUp('#§-url', 5.1);
tl.fromTo('#§-out', {{ opacity: 0 }}, {{ opacity: 1, duration: 1.2, ease: 'power2.in' }}, {dur(8) - 1.3});'''
    frame(8, css, body, js, push=1.03, seed=29)

for f in (s01, s02, s03, s04, s05, s06, s07, s08, s09): f()
print('frames written:', LANG, '->', PROJ)
