# Builds the two HyperFrames projects (Hebrew and English captions over the same screen recordings) of the SPIDER site demo film.
# usage: python3 tools/gen.py   ->  build/he and build/en (each a complete project: npx hyperframes render)
import json, os, re, shutil, subprocess, random
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src'); BUILD = os.path.join(ROOT, 'build')
V2 = os.path.join(ROOT, '..', 'spider-promo', 'v2'); IG = os.path.join(ROOT, '..', 'spider-promo-ig')
W, H = 1080, 1350
COUNTS = json.load(open(os.path.join(ROOT, 'data', 'counts.json')))
NP, ND = COUNTS['projects'], COUNTS['domains']
ONES = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen']
TENS = {2:'twenty',3:'thirty',4:'forty',5:'fifty',6:'sixty',7:'seventy',8:'eighty',9:'ninety'}
def words_en(n): return ONES[n] if n < 20 else TENS[n // 10] + ('' if n % 10 == 0 else '-' + ONES[n % 10])
HE_ND = {7:'שבעה', 8:'שמונה', 9:'תשעה', 10:'עשרה'}.get(ND, str(ND))
SX, SY, SW = 35, 432, 1010            # the screen inside the window frame (4:3 recording scaled to 1010 wide)
SH = round(SW * 0.75)                 # 758
K = SW / 1280                         # page px -> film px

def dur(path):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]).decode().strip())

def marks(name):
    return {m['n']: m['t'] for m in json.load(open(os.path.join(SRC, 'clips', name + '.marks.json')))}

# one entry per recorded clip: target length in the film, a slow push toward a point of interest, and callouts at recorded moments
# callout: (mark, delay after the mark, hold, page x, page y, he, en, arrow side)
SCENES = [
 dict(id='overview', n=1, dur=10.0, push=(1.0, 1.12, 0.62, 0.12),
  he_eye='גילוי', en_eye='DISCOVER',
  he_t='הפרשה, הזמנים והפתגם היומי', en_t='The weekly portion, Shabbat times and a daily proverb',
  he_s='בהעברת עכבר אחת. בלי לחפש.', en_s='One hover away. No searching.',
  co=[('parsha', 0.7, 2.6, 640, 150, 'פרשת השבוע וזמני שבת', 'Weekly portion and Shabbat times'),
      ('clock', 0.7, 2.6, 470, 150, 'שעון, תאריך ופתגם יומי', 'Clock, date and a daily proverb')]),
 dict(id='domains', n=2, dur=10.5, push=(1.0, 1.1, 0.12, 0.35),
  he_eye='תחומים', en_eye='DOMAINS',
  he_t=f'{HE_ND} תחומים. {NP} פרויקטים.', en_t=f'{words_en(ND).capitalize()} domains. {NP} projects.',
  he_s='פותחים את הרשימה, בוחרים תחום, והכול מסתדר.', en_s='Open the list, pick a domain, and everything falls into place.',
  co=[('open', 0.6, 2.2, 150, 160, 'כל התחומים בלחיצה', 'Every domain, one click'),
      ('ai', 0.9, 2.0, 540, 190, 'סוכני AI', 'AI agents'),
      ('tools', 0.9, 2.0, 540, 190, 'כלים ומחשבונים', 'Tools and calculators')]),
 dict(id='plan', n=3, dur=12.0, push=(1.0, 1.1, 0.8, 0.3),
  he_eye='תורה ויום', en_eye='TORAH & DAY',
  he_t='סדר יום ופירושים מגדולי המפרשים', en_t='A day plan, and commentary from the great scholars',
  he_s='רש״י, רמב״ן, אבן עזרא, ספורנו ועוד. הנוסח האמיתי, ישר מהמקור.', en_s='Rashi, Ramban, Ibn Ezra, Sforno and more. The real text, straight from the source.',
  co=[('plan', 0.8, 2.6, 960, 300, 'השעה עכשיו מודגשת', 'The current hour is highlighted'),
      ('comm', 0.9, 2.2, 960, 130, 'פירושים בלחיצה', 'Commentary on demand'),
      ('snip', 1.3, 3.0, 960, 360, 'ניסוחים אמיתיים מספריא', 'Real wording from Sefaria')]),
 dict(id='maya', n=4, dur=13.0, push=(1.0, 1.08, 0.2, 0.6),
  he_eye='מאיה', en_eye='MAYA',
  he_t='מאיה, עוזרת AI שעונה כמו אדם', en_t='Maya, an AI assistant that answers like a person',
  he_s='שואלים בעברית חופשית, מקבלים תשובה, וקובעים שיחה עם חיים.', en_s='Ask in plain language, get an answer, and book a call with Haim.',
  co=[('open', 0.9, 2.4, 330, 150, 'העוזרת האישית של חיים', "Haim's personal assistant"),
      ('answer', 1.2, 3.4, 330, 390, 'תשובה מיידית, בכל שעה', 'An instant answer, any hour')]),
 dict(id='admin', n=5, dur=12.0, push=(1.0, 1.1, 0.12, 0.4),
  he_eye='ניהול', en_eye='ADMIN',
  he_t='המנהל מסדר. כולם רואים.', en_t='The admin arranges. Everyone sees.',
  he_s='לשוניות חדשות, העברת אתרים בין תחומים וסדר לפי הצורך.', en_s='New tabs, sites moved between domains, ordered your way.',
  co=[('edit', 0.8, 2.2, 150, 150, 'מצב עריכה, למנהל בלבד', 'Edit mode, admin only'),
      ('add', 0.8, 2.0, 150, 190, 'לשונית חדשה', 'A new tab'),
      ('move', 0.9, 2.4, 560, 560, 'העברה בין תחומים', 'Move between domains')]),
 dict(id='rail', n=6, dur=8.5, push=(1.0, 1.08, 0.85, 0.5),
  he_eye='תמיד בהישג יד', en_eye='ALWAYS AT HAND',
  he_t='מוזיקה, חדשות ונגישות', en_t='Music, news and accessibility',
  he_s='רדיו ישראלי ותפילות, כותרות טכנולוגיה חיות ופס חדשות בתחתית.', en_s='Israeli radio and prayers, live tech headlines and a ticker along the bottom.',
  co=[('music', 0.9, 2.2, 1000, 380, 'רדיו ומוזיקה', 'Radio and music'),
      ('ticker', 0.3, 4.2, 640, 880, 'חדשות חיות בתחתית', 'Live headlines along the bottom')]),
]
HOOK, OVER = 5.4, 0.45
CTA = 8.0

def build(lang):
    he = lang == 'he'
    D = 'rtl' if he else 'ltr'
    out = os.path.join(BUILD, lang)
    shutil.rmtree(out, ignore_errors=True)
    for d in ('assets/fonts', 'assets/vendor', 'assets/bgm', 'assets/clips'): os.makedirs(os.path.join(out, d))
    for f in os.listdir(os.path.join(IG, 'assets', 'fonts')): shutil.copy(os.path.join(IG, 'assets', 'fonts', f), os.path.join(out, 'assets/fonts', f))
    for f in ('gsap.min.js',): shutil.copy(os.path.join(IG, 'assets/vendor', f), os.path.join(out, 'assets/vendor', f))
    for f in ('grain.png', 'sky.webp', 'spider.svg'): shutil.copy(os.path.join(IG, 'assets', f), os.path.join(out, 'assets', f))
    for f in os.listdir(os.path.join(SRC, 'clips')):
        if f.endswith('.mp4'): shutil.copy(os.path.join(SRC, 'clips', f), os.path.join(out, 'assets/clips', f))
    fonts = open(os.path.join(V2, 'fonts.css')).read()

    # timeline
    t = HOOK; plan = []
    for s in SCENES:
        s = dict(s); s['start'] = t; s['clip_d'] = dur(os.path.join(SRC, 'clips', s['id'] + '.mp4')); s['rate'] = s['clip_d'] / s['dur']
        s['marks'] = marks(s['id']); plan.append(s); t += s['dur']
    cta_start = t; total = round(cta_start + CTA, 2)
    SC_END = cta_start

    def tx(a, b): return a if he else b
    css = f'''
{fonts}
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:{W}px;height:{H}px;overflow:hidden;background:#0F0D24}}
#root{{position:relative;width:100%;height:100%;overflow:hidden;background:#0F0D24;color:#F1EEFC;font-family:'Assistant',sans-serif;direction:{D}}}
.bg{{position:absolute;inset:0;background:radial-gradient(120% 90% at 70% -10%,#2b2468 0%,#17143a 42%,#0b0a1f 80%)}}
.sky{{position:absolute;left:-5%;top:-5%;width:110%;height:110%;object-fit:cover;opacity:.34}}
.grain{{position:absolute;left:-200px;top:-200px;width:{W+400}px;height:{H+400}px;background:url(assets/grain.png);opacity:.07;mix-blend-mode:overlay}}
.vig{{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,rgba(0,0,0,0) 55%,rgba(4,3,14,.6) 100%)}}
.st{{position:absolute;border-radius:50%;background:#fff}}
.cap{{position:absolute;left:56px;right:56px;top:40px;height:352px;display:flex;flex-direction:column;justify-content:center}}
.eye{{display:flex;align-items:center;gap:14px;font-family:'JetBrains Mono',monospace;font-weight:500;font-size:24px;letter-spacing:.2em;color:#E0B25A;direction:ltr;justify-content:{'flex-end' if he else 'flex-start'};margin-bottom:22px}}
.eye b{{font-weight:500;color:#F1EEFC;opacity:.55}}
.eye i{{display:block;width:56px;height:2px;background:#E0B25A}}
.h1{{font-family:'Bellefair','Assistant',serif;font-weight:400;font-size:{92 if he else 84}px;line-height:1.04;text-wrap:balance;text-align:{'right' if he else 'left'}}}
.w{{display:inline-block;overflow:hidden;vertical-align:top;padding:0 .05em .14em}}
.w>span{{display:inline-block;white-space:pre}}
.sub{{position:absolute;left:70px;right:70px;top:1222px;font-size:33px;line-height:1.35;color:#A9A4CC;text-align:{'right' if he else 'left'}}}
.sub em{{font-style:normal;color:#F3D596}}
.win{{position:absolute;left:{SX}px;top:{SY-38}px;width:{SW}px;height:{SH+38}px;border-radius:22px;overflow:hidden;background:#0d0b22;border:1px solid rgba(241,238,252,.22);box-shadow:0 40px 90px rgba(0,0,0,.65),0 0 0 10px rgba(224,178,90,.07)}}
.bar{{position:absolute;left:0;top:0;width:100%;height:38px;background:linear-gradient(180deg,#221e52,#17143a);display:flex;align-items:center;gap:8px;padding:0 16px;direction:ltr;border-bottom:1px solid rgba(241,238,252,.12)}}
.bar i{{width:12px;height:12px;border-radius:50%;display:block}}
.url{{margin:0 auto;transform:translateX(-26px);font-family:'JetBrains Mono',monospace;font-size:15px;color:#A9A4CC;background:rgba(10,8,28,.7);padding:5px 18px;border-radius:999px;letter-spacing:.02em}}
.scr{{position:absolute;left:0;top:38px;width:{SW}px;height:{SH}px;overflow:hidden;background:#0d0b22}}
.zoom{{position:absolute;inset:0;width:{SW}px;height:{SH}px}}
.zoom video{{position:absolute;left:0;top:0;width:{SW}px;height:{SH}px;object-fit:cover;background:#0d0b22}}
.co{{position:absolute;display:flex;align-items:center;gap:10px;padding:10px 18px 10px 16px;border-radius:999px;background:rgba(15,13,36,.92);border:2px solid #E0B25A;color:#F3D596;font-weight:700;font-size:27px;white-space:nowrap;box-shadow:0 14px 34px rgba(0,0,0,.55);opacity:0;direction:{D}}}
.co:before{{content:"";width:12px;height:12px;border-radius:50%;background:#E0B25A;box-shadow:0 0 0 6px rgba(224,178,90,.25)}}
.prog{{position:absolute;left:60px;right:60px;top:1318px;height:5px;border-radius:5px;background:rgba(241,238,252,.12);direction:ltr}}
.prog>i{{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:5px;background:linear-gradient(90deg,#E0B25A,#F3D596)}}
.hook,.cta{{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}}
.num{{font-family:'Bellefair',serif;font-size:520px;line-height:.82;letter-spacing:-.04em;color:#F1EEFC;text-shadow:0 0 90px rgba(139,123,255,.55);direction:ltr}}
.num2{{font-family:'Bellefair','Assistant',serif;font-size:{92 if he else 88}px;line-height:1.05;margin-top:30px;color:#F1EEFC}}
.num2 em{{font-style:normal;color:#E0B25A}}
.hsub{{margin-top:34px;font-size:38px;color:#A9A4CC;letter-spacing:.02em}}
.logo{{width:150px;height:150px;margin-bottom:40px}}
.ctah{{font-family:'Bellefair','Assistant',serif;font-size:{108 if he else 100}px;line-height:1.02}}
.ctah em{{font-style:normal;color:#E0B25A}}
.pill{{margin-top:56px;font-family:'JetBrains Mono',monospace;font-size:31px;color:#1b1405;background:linear-gradient(135deg,#F3D596,#E0B25A);padding:22px 38px;border-radius:999px;font-weight:600;direction:ltr;box-shadow:0 20px 50px rgba(224,178,90,.35)}}
.who{{margin-top:44px;font-size:42px;font-weight:600}}
.role{{margin-top:12px;font-size:28px;color:#A9A4CC;letter-spacing:.14em;direction:ltr}}
.bio{{margin-top:52px;font-size:30px;color:#F3D596;border:2px solid rgba(224,178,90,.55);padding:12px 30px;border-radius:999px}}
'''
    rnd = random.Random(7); stars = ''
    for i in range(70):
        x, y, s = rnd.uniform(0, W), rnd.uniform(0, H), rnd.uniform(1.2, 4.4)
        stars += f'<i class="st" style="left:{x:.0f}px;top:{y:.0f}px;width:{s:.1f}px;height:{s:.1f}px;opacity:{rnd.uniform(.2,.8):.2f}"></i>'

    def words(text, cls=''):
        ws = text.split(' ')
        return ' '.join(f'<span class="w"><span class="{cls}">{w}</span></span>' for w in ws)

    body = f'<div class="bg"></div><img class="sky" id="sky" src="assets/sky.webp" alt=""><div id="stars">{stars}</div>\n'
    # hook
    body += (f'<div class="clip hook" id="hook" data-start="0" data-duration="{HOOK+0.2}" data-track-index="4">'
             f'<div class="num" id="num">0</div><div class="num2" id="n2">{words(tx("פרויקטים. אתר אחד.", "projects. One site."), "n2w")}</div>'
             f'<div class="hsub" id="hs">{tx("כל מה שחיים קריספין בנה, במקום אחד", "Everything Haim Krispin has built, in one place")}</div></div>\n')
    # window frame (persists through the scenes)
    body += (f'<div class="win" id="win"><div class="bar"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i>'
             f'<span class="url" data-layout-ignore>devopsdevopshaim-wq.github.io/devops-hub/portfolio</span></div><div class="scr"><div class="zoom" id="zoom">\n')
    for i, s in enumerate(plan):
        body += (f'<video class="clip" id="v-{s["id"]}" src="assets/clips/{s["id"]}.mp4" muted playsinline data-start="{s["start"]:.2f}" data-duration="{s["dur"]+OVER:.2f}" '
                 f'data-playback-rate="{s["rate"]:.4f}" data-track-index="{5+i}"></video>\n')
    for i, s in enumerate(plan):
        for j, c in enumerate(s['co']):
            m, delay, hold, px, py, h_, e_ = c
            label = tx(h_, e_); wpx = len(label) * (15.5 if he else 14.2) + 74
            cx = min(max(px * K, wpx / 2 + 12), SW - wpx / 2 - 12); cy = min(max(py * K, 36), SH - 36)
            body += f'<div class="co" id="co-{i}-{j}" style="left:{cx:.0f}px;top:{cy:.0f}px">{label}</div>\n'
    body += '</div></div></div>\n'
    # captions per scene
    for i, s in enumerate(plan):
        body += (f'<div class="clip cap" id="cap-{i}" data-start="{s["start"]:.2f}" data-duration="{s["dur"]:.2f}" data-track-index="2">'
                 f'<div class="eye"><i></i><span>{tx(s["he_eye"], s["en_eye"])}</span><b>{s["n"]:02d} / 06</b></div>'
                 f'<div class="h1" id="h1-{i}">{words(tx(s["he_t"], s["en_t"]), "hw" + str(i))}</div></div>\n')
        body += (f'<div class="clip sub" id="sub-{i}" data-start="{s["start"]:.2f}" data-duration="{s["dur"]:.2f}" data-track-index="3">{tx(s["he_s"], s["en_s"])}</div>\n')
    # closing card
    body += (f'<div class="clip cta" id="cta" data-start="{cta_start-0.2:.2f}" data-duration="{CTA+0.2}" data-track-index="4">'
             f'<img class="logo" id="logo" src="assets/spider.svg" alt="">'
             f'<div class="ctah" id="ctah">{words(tx("בואו לראות את", "Come see the"), "cw")}<br>{words(tx("האתר", "site"), "cw")}</div>'
             f'<div class="pill" id="pill">devopsdevopshaim-wq.github.io/devops-hub</div>'
             f'<div class="who" id="who">{tx("חיים קריספין", "Haim Krispin")}</div><div class="role" id="role">DEVOPS · AI · WEB</div>'
             f'<div class="bio" id="bio">{tx("הקישור בביו", "Link in bio")}</div></div>\n')
    body += '<div class="vig"></div><div class="grain" id="grain"></div><div class="prog"><i id="prog"></i></div>\n'

    # timeline script
    js = f'''
const tl = gsap.timeline({{ paused: true }});
const TOTAL = {total}, HOOK = {HOOK};
tl.fromTo('#stars', {{ x: 0 }}, {{ x: {-60 if he else 60}, duration: TOTAL, ease: 'none' }}, 0);
tl.fromTo('#sky', {{ scale: 1 }}, {{ scale: 1.08, duration: TOTAL, ease: 'none' }}, 0);
tl.fromTo('#grain', {{ x: 0, y: 0 }}, {{ x: -160, y: 110, duration: TOTAL, ease: 'steps(' + Math.round(TOTAL * 12) + ')' }}, 0);
tl.fromTo('#prog', {{ width: '0%' }}, {{ width: '100%', duration: TOTAL, ease: 'none' }}, 0);
// hook: the number counts up, then the line rises
const cnt = {{ v: 0 }};
tl.to(cnt, {{ v: {NP}, duration: 2.0, ease: 'power3.out', onUpdate: () => {{ document.getElementById('num').textContent = Math.round(cnt.v); }} }}, 0.25);
tl.fromTo('#num', {{ scale: 0.84, opacity: 0, filter: 'blur(18px)' }}, {{ scale: 1, opacity: 1, filter: 'blur(0px)', duration: 1.3, ease: 'power3.out' }}, 0.1);
tl.fromTo('.n2w', {{ yPercent: 115 }}, {{ yPercent: 0, duration: 0.9, ease: 'power4.out', stagger: 0.14 }}, 1.5);
tl.fromTo('#hs', {{ y: 24, opacity: 0 }}, {{ y: 0, opacity: 1, duration: 0.9, ease: 'power3.out' }}, 2.3);
tl.to('#hook', {{ opacity: 0, scale: 1.06, duration: 0.5, ease: 'power2.in' }}, {HOOK-0.5});
// window enters after the hook
tl.fromTo('#win', {{ opacity: 0, y: 90, scale: 0.94, rotationX: 14, transformPerspective: 1600 }}, {{ opacity: 1, y: 0, scale: 1, rotationX: 0, duration: 1.0, ease: 'power3.out' }}, {HOOK-0.45});
tl.set('#win', {{ opacity: 0 }}, 0);
'''
    # scenes
    for i, s in enumerate(plan):
        S, Dd = s['start'], s['dur']
        z0, z1, ox, oy = s['push']
        js += f'''
// scene {i+1}: {s['id']}
tl.fromTo('#zoom', {{ scale: {z0}, transformOrigin: '{ox*100:.0f}% {oy*100:.0f}%' }}, {{ scale: {z1}, duration: {Dd+OVER}, ease: 'sine.inOut' }}, {S:.2f});
tl.fromTo('#v-{s['id']}', {{ opacity: 0 }}, {{ opacity: 1, duration: {OVER}, ease: 'none' }}, {S:.2f});
tl.to('#v-{s['id']}', {{ opacity: 0, duration: {OVER}, ease: 'none' }}, {S+Dd:.2f});
tl.fromTo('.hw{i}', {{ yPercent: 115 }}, {{ yPercent: 0, duration: 0.85, ease: 'power4.out', stagger: 0.09 }}, {S+0.15:.2f});
tl.fromTo('#sub-{i}', {{ y: 22, opacity: 0, filter: 'blur(5px)' }}, {{ y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.9, ease: 'power3.out' }}, {S+0.7:.2f});
tl.to('#cap-{i}', {{ opacity: 0, y: -26, duration: 0.35, ease: 'power2.in' }}, {S+Dd-0.5:.2f});
tl.to('#sub-{i}', {{ opacity: 0, y: -16, duration: 0.35, ease: 'power2.in' }}, {S+Dd-0.5:.2f});
'''
        for j, c in enumerate(s['co']):
            m, delay, hold, px, py, h_, e_ = c
            at = S + (s['marks'][m] + delay) / s['rate']
            at = min(at, S + Dd - hold / s['rate'] - 0.2)
            js += f"tl.fromTo('#co-{i}-{j}', {{ opacity: 0, xPercent: -50, yPercent: -50, y: 14, scale: 0.9 }}, {{ opacity: 1, xPercent: -50, yPercent: -50, y: 0, scale: 1, duration: 0.45, ease: 'back.out(1.6)' }}, {at:.2f});\n"
            js += f"tl.to('#co-{i}-{j}', {{ opacity: 0, xPercent: -50, yPercent: -50, y: -8, duration: 0.35, ease: 'power2.in' }}, {at + hold / s['rate'] + 0.45:.2f});\n"
    js += f'''
// closing card
tl.to('#win', {{ opacity: 0, y: 60, scale: 0.94, duration: 0.6, ease: 'power2.in' }}, {SC_END-0.2:.2f});
tl.fromTo('#logo', {{ scale: 0.6, opacity: 0, rotation: -12 }}, {{ scale: 1, opacity: 1, rotation: 0, duration: 1.0, ease: 'back.out(1.5)' }}, {SC_END+0.3:.2f});
tl.fromTo('.cw', {{ yPercent: 115 }}, {{ yPercent: 0, duration: 0.9, ease: 'power4.out', stagger: 0.12 }}, {SC_END+0.55:.2f});
tl.fromTo('#pill', {{ y: 30, opacity: 0 }}, {{ y: 0, opacity: 1, duration: 0.9, ease: 'power3.out' }}, {SC_END+1.4:.2f});
tl.fromTo('#who', {{ y: 24, opacity: 0 }}, {{ y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }}, {SC_END+1.9:.2f});
tl.fromTo('#role', {{ opacity: 0 }}, {{ opacity: 1, duration: 0.8 }}, {SC_END+2.2:.2f});
tl.fromTo('#bio', {{ y: 20, opacity: 0, scale: 0.9 }}, {{ y: 0, opacity: 1, scale: 1, duration: 0.8, ease: 'back.out(1.6)' }}, {SC_END+2.8:.2f});
window.__timelines = window.__timelines || {{}};
window.__timelines['main'] = tl;
'''
    html = f'''<!doctype html>
<html lang="{'he' if he else 'en'}" dir="{D}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width={W}, height={H}">
<script src="assets/vendor/gsap.min.js"></script>
<style>{css}</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-width="{W}" data-height="{H}" data-duration="{total}">
{body}
<audio id="bgm" src="assets/bgm/score.m4a" data-start="0" data-duration="{total}" data-track-index="30" data-volume="{0.9 if he else 0.42}"></audio>
{'' if he else f'<audio id="vo" src="assets/bgm/vo.wav" data-start="0" data-duration="{total}" data-track-index="31" data-volume="1"></audio>'}
</div>
<script>
{js}
</script>
</body>
</html>
'''
    open(os.path.join(out, 'index.html'), 'w').write(html)
    # music: the film's own score, cut to length with a gentle ending
    subprocess.check_call(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(IG, 'assets/bgm/score-v2-he.m4a'), '-t', str(total), '-af', f'afade=t=in:d=1.2,afade=t=out:st={total-3.2}:d=3.2', '-c:a', 'aac', '-b:a', '192k', os.path.join(out, 'assets/bgm/score.m4a')])
    if not he:
        import sys; sys.path.insert(0, os.path.dirname(__file__)); import vo
        N, D = words_en(NP).capitalize(), words_en(ND)
        say = {'overview': 'One hover shows the weekly portion, the Shabbat times, and a proverb for the day.',
               'domains': f'{D.capitalize()} domains, {words_en(NP)} projects. Open the list, pick one, and everything falls into place.',
               'plan': 'A daily plan with the current hour highlighted, and commentary from Rashi, Ramban, Ibn Ezra and more, straight from the source.',
               'maya': 'Maya is an AI assistant. Ask in plain language, get an answer at any hour, and book a call with Haim.',
               'admin': 'The admin arranges the tabs and the sites, and everyone sees it instantly.',
               'rail': 'Music, live headlines and accessibility are always at hand.'}
        lines = [(1.3, HOOK - 1.6, f'{N} projects. One site.')]
        for sc in plan: lines.append((sc['start'] + 0.9, sc['dur'] - 1.5, say[sc['id']]))
        lines.append((cta_start + 0.8, CTA - 1.4, 'Come and see the site. The link is in the bio. Haim Krispin.'))
        vo.build(lines, total, os.path.join(out, 'assets/bgm/vo.wav'))
    json.dump({'name': f'site-demo-{lang}', 'private': True, 'type': 'module', 'scripts': {'check': 'npx --yes hyperframes check', 'render': 'npx --yes hyperframes render'}}, open(os.path.join(out, 'package.json'), 'w'))
    json.dump({'id': f'site-demo-{lang}', 'name': f'site-demo-{lang}'}, open(os.path.join(out, 'meta.json'), 'w'))
    shutil.copy(os.path.join(IG, 'hyperframes.json'), os.path.join(out, 'hyperframes.json'))
    print(lang, 'total', total, 'rates', [round(s['rate'], 2) for s in plan])

for l in ('he', 'en'): build(l)
