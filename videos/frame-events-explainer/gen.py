#!/usr/bin/env python3
"""Builds the Frame Events explainer: index.html (root, music, sound) + one scene file per shot in compositions/.
Edit the SCENES table (copy, screens, taps, timing) and run: python3 gen.py"""
import json, os

W, H, FPS = 1080, 1920, 30
os.chdir(os.path.dirname(os.path.abspath(__file__)))
os.makedirs('compositions', exist_ok=True)

FONTS = ''.join(
    f"@font-face{{font-family:'{fam}';font-weight:{w};src:url('assets/fonts/{file}-{w}-hebrew.woff2') format('woff2');unicode-range:U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F;}}"
    f"@font-face{{font-family:'{fam}';font-weight:{w};src:url('assets/fonts/{file}-{w}-latin.woff2') format('woff2');unicode-range:U+0000-00FF,U+2000-206F,U+20AC;}}"
    for fam, file, weights in [('Frank', 'FrankRuhlLibre', [700, 900]), ('Heebo', 'Heebo', [400, 500, 700, 800])] for w in weights)

BASE_CSS = FONTS + """
#root{position:absolute;inset:0;overflow:hidden;direction:rtl;
  background:radial-gradient(1500px 1000px at 85% -12%,#FFF1D6 0%,rgba(255,241,214,0) 60%),#FBF7F0;}
.ttl{position:absolute;top:226px;right:96px;left:96px;text-align:right;}
.ln{display:block;font:900 86px/1.1 'Frank',serif;color:#2B1B30;letter-spacing:-.5px;}
.ln em{font-style:normal;color:#A47622;}
.sub{display:block;margin-top:20px;font:500 44px/1.38 'Heebo',sans-serif;color:#6B584D;}
.phone{position:absolute;left:220px;top:640px;width:640px;height:1064px;border-radius:76px;background:#1B1218;padding:18px;
  box-shadow:0 50px 90px -30px rgba(80,56,30,.55),inset 0 0 0 2px #3A2A30;}
.scr{position:relative;width:604px;height:1028px;border-radius:60px;overflow:hidden;background:#FBF7F0;}
.scr img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;object-position:top;}
.tap{position:absolute;width:130px;height:130px;margin:-65px 0 0 -65px;border-radius:50%;border:7px solid #D9AE52;background:rgba(217,174,82,.22);}
"""

def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;')

def title(sid, lines, sub=None):
    out = ''.join(f'<span class="ln" id="{sid}-l{i}">{l}</span>' for i, l in enumerate(lines))
    if sub:
        out += f'<span class="sub" id="{sid}-sub">{sub}</span>'
    return f'<div class="ttl">{out}</div>'

def reveal_js(sid, lines, sub, at=0.15):
    """Titles wipe in from the right (RTL), one line after the other; the subline follows."""
    js = ''
    for i in range(len(lines)):
        js += f'tl.fromTo("#{sid}-l{i}",{{clipPath:"inset(0 0 0 100%)"}},{{clipPath:"inset(0 0 0 0%)",duration:.45,ease:"power3.out"}},{at + i * .12});\n'
    if sub:
        js += f'tl.fromTo("#{sid}-sub",{{opacity:0,y:14}},{{opacity:1,y:0,duration:.4,ease:"power2.out"}},{at + len(lines) * .12 + .15});\n'
    return js

def phone(sid, shots):
    imgs = ''.join(f'<img id="{sid}-s{i}" src="assets/shots/{s}.jpg" alt="">' for i, s in enumerate(shots))
    return f'<div class="phone" id="{sid}-ph"><div class="scr" id="{sid}-scr">{imgs}</div></div>'

def phone_in(sid, n, at=0.0):
    js = f'tl.fromTo("#{sid}-ph",{{y:90,rotation:3,opacity:0}},{{y:0,rotation:0,opacity:1,duration:.55,ease:"power3.out"}},{at});\n'
    js += f'tl.fromTo("#{sid}-ph",{{scale:1}},{{scale:1.04,duration:5,ease:"none"}},{at});\n'
    for i in range(1, n):
        js += f'tl.set("#{sid}-s{i}",{{opacity:0}},0);\n'
    return js

def swap(sid, a, b, at):
    return (f'tl.to("#{sid}-s{a}",{{y:-40,opacity:0,duration:.35,ease:"power2.in"}},{at});\n'
            f'tl.fromTo("#{sid}-s{b}",{{y:60,opacity:0}},{{y:0,opacity:1,duration:.35,ease:"power2.out"}},{at + .05});\n')

def tap(sid, k, x, y, at):
    """A gold ring where the finger presses (x, y as fractions of the screen)."""
    return (f'<div class="tap" id="{sid}-t{k}" style="left:{x*100:.1f}%;top:{y*100:.1f}%"></div>',
            f'tl.fromTo("#{sid}-t{k}",{{scale:.3,opacity:1}},{{scale:1.5,opacity:0,duration:.55,ease:"power2.out"}},{at});\n')

def scene(sid, dur, body, js, extra_css=''):
    html = f'''<template>
  <style>{BASE_CSS}{extra_css}</style>
  <div id="root" data-composition-id="{sid}" data-width="{W}" data-height="{H}">
{body}
  </div>
  <script>
    const tl = gsap.timeline({{ paused: true }});
{js}    tl.to({{}}, {{ duration: 0 }}, {dur - .01});
    window.__timelines["{sid}"] = tl;
  </script>
</template>
'''
    open(f'compositions/{sid}.html', 'w').write(html)

# ---------------- the shots ----------------
SCENES = []  # (id, start, duration, [sfx (file, t)])

def add(sid, start, dur, sfx):
    SCENES.append((sid, start, dur, sfx))

# s1 hook: the finished magnet, already on screen at frame 0
L = ['התמונה מהאירוע,', '<em>מודפסת</em> עם המסגרת שלכם']
body = title('s1', L, 'צלמו בחתונה, קבלו מגנט. בדקה אחת.') + '''
<img id="s1-mag" src="assets/img/magnet.jpg" alt="" style="position:absolute;left:190px;top:700px;width:700px;height:1050px;border-radius:10px;box-shadow:0 60px 90px -40px rgba(80,56,30,.6)">'''
js = ('tl.set("#s1-l0,#s1-l1",{clipPath:"inset(0 0 0 0%)"},0);\n'
      'tl.fromTo("#s1-sub",{opacity:0},{opacity:1,duration:.4},.5);\n'
      'tl.fromTo("#s1-mag",{rotation:-4,scale:1},{rotation:-2,scale:1.05,duration:3.5,ease:"none"},0);\n'
      'tl.to("#s1-mag",{x:420,y:-260,rotation:12,scale:.4,opacity:0,duration:.4,ease:"power2.in"},3.55);\n'
      'tl.to(".ttl",{opacity:0,duration:.25},3.7);\n')
scene('s1', 4, body, js); add('s1', 0, 4, [('whoosh-short', 3.6)])

# s2 scan the QR on the table
L = ['1. סורקים את <em>ה-QR</em>']
t1 = tap('s2', 0, .5, .89, 3.55)
body = title('s2', L, 'שעל השולחן, ונכנסים עם השם והטלפון') + f'''
<img id="s2-sign" src="assets/img/sign-event.jpg" alt="" style="position:absolute;left:240px;top:640px;width:600px;height:800px;box-shadow:0 40px 70px -30px rgba(80,56,30,.5)">
<div id="s2-scan" style="position:absolute;left:300px;top:840px;width:480px;height:8px;border-radius:4px;background:#D9AE52;"></div>
{phone('s2', ['01-guest-register'])}'''.replace('</div></div>', t1[0] + '</div></div>', 1) if False else None
# the tap ring sits inside the screen
ph = phone('s2', ['01-guest-register']).replace('</div></div>', t1[0] + '</div></div>')
body = title('s2', L, 'שעל השולחן, ונכנסים עם השם והטלפון') + f'''
<img id="s2-sign" src="assets/img/sign-event.jpg" alt="" style="position:absolute;left:240px;top:640px;width:600px;height:800px;box-shadow:0 40px 70px -30px rgba(80,56,30,.5)">
<div id="s2-scan" style="position:absolute;left:300px;top:850px;width:480px;height:8px;border-radius:4px;background:#D9AE52;"></div>
{ph}'''
js = reveal_js('s2', L, True) + phone_in('s2', 1, 1.9) + (
    'tl.fromTo("#s2-sign",{rotation:-3,y:40,opacity:0},{rotation:-3,y:0,opacity:1,duration:.5,ease:"power3.out"},0);\n'
    'tl.fromTo("#s2-scan",{y:0,opacity:0},{y:560,opacity:1,duration:1.1,ease:"power1.inOut"},.6);\n'
    'tl.to("#s2-scan",{opacity:0,duration:.15},1.7);\n'
    'tl.to("#s2-sign",{x:-215,y:-60,rotation:-9,scale:.5,duration:.6,ease:"power2.inOut"},1.75);\n') + t1[1]
scene('s2', 5, body, js); add('s2', 4, 5, [('whoosh', 0.0), ('pop', 0.62), ('click-soft', 3.58)])

# s3 choose a photo -> it lands inside the event frame
L = ['2. בוחרים תמונה']
t1 = tap('s3', 0, .25, .5, 1.25)
ph = phone('s3', ['02-guest-options', '03-editor-frame']).replace('</div></div>', t1[0] + '</div></div>')
body = title('s3', L, 'והיא נכנסת <b style="color:#2B1B30">ישר למסגרת</b> של האירוע') + ph
js = reveal_js('s3', L, True) + phone_in('s3', 2, 0) + t1[1] + swap('s3', 0, 1, 1.75)
scene('s3', 5.5, body, js); add('s3', 9, 5.5, [('whoosh-short', 0.0), ('click-soft', 1.28)])

# s4 edit as you like
L = ['3. עורכים כמו שרוצים']
chips = [('✨ שיפור ו-AI', 340), ('🎨 פילטרים', 470), ('🔤 טקסט וברכה', 600)]
chip_html = ''.join(f'<div class="chip" id="s4-c{i}" style="top:{y + 640}px">{t}</div>' for i, (t, y) in enumerate(chips))
body = title('s4', L, 'פילטרים, אפקטים, טקסט ומדבקות') + phone('s4', ['04-editor-ai']) + chip_html
css = ".chip{position:absolute;right:40px;padding:18px 30px;border-radius:22px;background:#fff;font:700 40px 'Heebo';color:#2B1B30;box-shadow:0 18px 40px -18px rgba(80,56,30,.55),inset 0 0 0 2px #E8D3A6;}"
js = reveal_js('s4', L, True) + phone_in('s4', 1, 0) + ''.join(
    f'tl.fromTo("#s4-c{i}",{{x:60,opacity:0,scale:.9}},{{x:0,opacity:1,scale:1,duration:.4,ease:"back.out(1.6)"}},{1.3 + i * .45});\n' for i in range(3))
scene('s4', 5, body, js, css); add('s4', 14.5, 5, [('whoosh', 0.0), ('pop', 1.33), ('pop', 1.78), ('pop', 2.23)])

# s5 send to print
L = ['4. שולחים <em>להדפסה</em>']
body = title('s5', L, 'מגנט, בלוק עץ או מסגרת, בגודל שבחרתם') + phone('s5', ['05-confirm', '06-sent-gallery'])
js = reveal_js('s5', L, True) + phone_in('s5', 2, 0) + swap('s5', 0, 1, 2.2)
scene('s5', 5, body, js); add('s5', 19.5, 5, [('whoosh-short', 0.0), ('click-soft', 2.15), ('pop', 2.6)])

# s6 the computer: every photo with name, phone and order; the magnet comes out printed
L = ['ואצלך <em>במחשב</em>']
body = title('s6', L, 'כל תמונה עם שם, טלפון וסדר הגעה,<br>ישר לעריכה ולהדפסה') + '''
<div id="s6-pc" style="position:absolute;left:110px;top:640px;width:860px;height:860px;border-radius:30px;background:#1B1218;padding:18px;box-shadow:0 50px 90px -30px rgba(80,56,30,.55)">
  <div style="position:relative;width:824px;height:824px;border-radius:14px;overflow:hidden"><img id="s6-img" src="assets/shots/18-studio-crop.jpg" alt="" style="position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover"></div></div>
<div id="s6-stand" style="position:absolute;left:470px;top:1500px;width:140px;height:70px;background:#2B1F25;border-radius:0 0 18px 18px"></div>
<img id="s6-mag" src="assets/img/magnet.jpg" alt="" style="position:absolute;left:560px;top:1020px;width:400px;height:600px;border-radius:8px;box-shadow:0 50px 80px -30px rgba(80,56,30,.65)">
<div id="s6-ok" style="position:absolute;left:0;right:520px;top:1560px;text-align:center;font:800 52px 'Heebo';color:#2E7D4F">המגנט מוכן ✓</div>'''
js = reveal_js('s6', L, True) + (
    'tl.fromTo("#s6-pc,#s6-stand",{y:80,opacity:0},{y:0,opacity:1,duration:.55,ease:"power3.out"},0);\n'
    'tl.fromTo("#s6-img",{scale:1},{scale:1.06,transformOrigin:"100% 0%",duration:3.6,ease:"power1.inOut"},.3);\n'
    'tl.fromTo("#s6-mag",{y:-260,rotation:-14,opacity:0,scale:.7},{y:0,rotation:6,opacity:1,scale:1,duration:.7,ease:"back.out(1.3)"},4.0);\n'
    'tl.fromTo("#s6-ok",{opacity:0,y:20},{opacity:1,y:0,duration:.35,ease:"power2.out"},4.6);\n')
scene('s6', 6.5, body, js); add('s6', 24.5, 6.5, [('whoosh', 0.0), ('impact-bass-1', 4.45), ('pop', 4.62)])

# s7 after the event the app stays: the store
L = ['אחרי האירוע,', 'האפליקציה <em>נשארת</em> בטלפון']
body = title('s7', L, 'חנות, התמונות שלכם והטבות') + phone('s7', ['07-store-top', '08-store-events'])
css = '#s7-ph{top:760px}'
js = reveal_js('s7', L, True) + phone_in('s7', 2, 0) + swap('s7', 0, 1, 3.1)
scene('s7', 6, body, js, css); add('s7', 31, 6, [('whoosh-cinematic', 0.0), ('whoosh-short', 3.08)])

# s8 order more copies
L = ['מזמינים <em>עוד עותקים</em>']
t1 = tap('s8', 0, .5, .70, 2.3)
ph = phone('s8', ['10-product-sizes']).replace('</div></div>', t1[0] + '</div></div>')
body = title('s8', L, 'מגנטים, בלוקים, מתנות וחבילות') + ph
js = reveal_js('s8', L, True) + phone_in('s8', 1, 0) + t1[1]
scene('s8', 5, body, js); add('s8', 37, 5, [('whoosh-short', 0.0), ('click-soft', 2.33)])

# s9 the club
L = ['<em>10%</em> חוזרים בנקודות']
body = title('s9', L, 'על כל קנייה, ומממשים בהנחות ומתנות') + phone('s9', ['13-club'])
js = reveal_js('s9', L, True) + phone_in('s9', 1, 0) + 'tl.fromTo("#s9-l0 em",{scale:.6,display:"inline-block"},{scale:1,duration:.45,ease:"back.out(2)"},.3);\n'
scene('s9', 5, body, js); add('s9', 42, 5, [('whoosh', 0.0), ('pop', 0.33)])

# s10 the owner manages everything from the phone
L = ['ואתה <em>מנהל הכול</em> מהטלפון']
subs = ['פותחים אירוע ומקבלים QR', 'מעלים מסגרת לאורך ולרוחב', 'קוד QR לכל משימה, מוכן להדפסה']
t1 = tap('s10', 0, .5, .79, 1.8)
ph = phone('s10', ['15-admin-event-card', '16-admin-frame', '17-admin-qr']).replace('</div></div>', t1[0] + '</div></div>')
sub_html = ''.join(f'<span class="sub s10sub" id="s10-x{i}" style="position:absolute;right:96px;top:340px">{s}</span>' for i, s in enumerate(subs))
body = title('s10', L) + sub_html + ph
js = reveal_js('s10', L, False) + phone_in('s10', 3, 0) + t1[1] + swap('s10', 0, 1, 2.4) + swap('s10', 1, 2, 4.7)
js += 'tl.set(".s10sub",{opacity:0},0);\n'
for i, at in enumerate([0.55, 2.4, 4.7]):
    js += f'tl.fromTo("#s10-x{i}",{{opacity:0,y:14}},{{opacity:1,y:0,duration:.35,ease:"power2.out"}},{at});\n'
    if i < 2:
        js += f'tl.to("#s10-x{i}",{{opacity:0,duration:.2,ease:"power2.in"}},{[2.4, 4.7][i] - .2});\n'
scene('s10', 8, body, js); add('s10', 47, 8, [('whoosh-cinematic', 0.0), ('click-soft', 1.83), ('whoosh-short', 2.38), ('whoosh', 4.68), ('riser', 8.0)])

# s11 end card
body = '''
<img id="s11-logo" src="assets/img/logo.svg" alt="פריים אירועים" style="position:absolute;left:90px;top:300px;width:900px;height:auto">
<div id="s11-qr" style="position:absolute;left:300px;top:780px;width:480px;height:480px;padding:22px;background:#fff;border-radius:28px;box-shadow:0 30px 60px -30px rgba(80,56,30,.55),inset 0 0 0 4px #D9AE52">
  <img src="assets/img/qr-app.png" alt="" style="width:100%;height:100%"></div>
<div id="s11-cta" style="position:absolute;left:0;right:0;top:1310px;text-align:center;font:900 72px 'Frank';color:#2B1B30">סורקים <span style="color:#A47622">ומתקינים</span></div>
<div id="s11-url" style="position:absolute;left:0;right:0;top:1420px;text-align:center;direction:ltr;font:500 34px 'Heebo';color:#7D6A5E">devopsdevopshaim-wq.github.io/devops-hub/events-hub</div>'''
js = ('tl.fromTo("#s11-logo",{y:30,opacity:0},{y:0,opacity:1,duration:.6,ease:"power3.out"},0);\n'
      'tl.fromTo("#s11-qr",{scale:.85,opacity:0},{scale:1,opacity:1,duration:.5,ease:"back.out(1.5)"},.45);\n'
      'tl.fromTo("#s11-cta",{clipPath:"inset(0 0 0 100%)"},{clipPath:"inset(0 0 0 0%)",duration:.45,ease:"power3.out"},.9);\n'
      'tl.fromTo("#s11-url",{opacity:0},{opacity:1,duration:.4},1.3);\n')
scene('s11', 5, body, js); add('s11', 55, 5, [('impact-bass-1', 0.0)])

# ---------------- the root ----------------
TOTAL = 60
hosts = ''.join(
    f'      <div id="{sid}" data-composition-id="{sid}" data-composition-src="compositions/{sid}.html" data-start="{st}" data-duration="{du}" '
    f'data-track-index="1" data-track-kind="graphics" data-width="{W}" data-height="{H}"></div>\n' for sid, st, du, _ in SCENES)
take = {}
audio = (f'      <audio id="bed1" class="clip" src="assets/music/bed.m4a" data-start="0" data-duration="48.35" data-track-index="10" data-volume="0.55" data-fade-in="0.4" data-fade-out="0.8"></audio>\n'
         f'      <audio id="bed2" class="clip" src="assets/music/bed.m4a" data-start="47.6" data-duration="12.4" data-media-start="6" data-track-index="11" data-volume="0.55" data-fade-in="0.8" data-fade-out="1.5"></audio>\n')
# each effect: (peak, tail end) measured with `hyperframes audio`; its peak lands one frame after the picture it belongs to
FX = {'whoosh': (.162, .367), 'whoosh-short': (.16, .4), 'whoosh-cinematic': (2.503, 4.344), 'pop': (.12, .262),
      'click-soft': (.073, .188), 'riser': (3.472, 4.296), 'impact-bass-1': (.073, 1.99)}
VOL = {'whoosh': .45, 'whoosh-short': .45, 'whoosh-cinematic': .4, 'pop': .5, 'click-soft': .6, 'riser': .35, 'impact-bass-1': .55}
n = 0
for sid, st, du, sfx in SCENES:
    for f, t in sfx:
        n += 1
        peak, tail = FX[f]
        mstart = round(max(0, peak - .45), 3)            # skip a long quiet lead-in
        start = round(max(0, st + t - (peak - mstart) + 1 / FPS), 3)
        dur = round(min(tail - mstart + .12, TOTAL - start), 3)
        ms = f' data-media-start="{mstart}"' if mstart else ''
        audio += f'      <audio id="fx{n}" class="clip" src="assets/sfx/{f}.mp3" data-start="{start}" data-duration="{dur}"{ms} data-track-index="{11 + n}" data-volume="{VOL[f]}"></audio>\n'

index = f'''<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <script src="assets/vendor/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: {W}px; height: {H}px; overflow: hidden; background: #FBF7F0; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{TOTAL}" data-width="{W}" data-height="{H}">
{hosts}{audio}    </div>
    <script>
      const tl = gsap.timeline({{ paused: true }});
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
'''
open('index.html', 'w').write(index)
print('scenes', len(SCENES), 'sfx', n)
