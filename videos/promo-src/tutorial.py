#!/usr/bin/env python3
"""Builds the narrated tutorial film of the Windows program, in Hebrew and in English, as HyperFrames projects.

  python3 videos/promo-src/tutorial.py          -> videos/promo-app-tutorial-{he,en}/

The narration is app-tutorial/script.json, spoken by .github/workflows/frame-tts.yml into app-tutorial/voice/<lang>/
(one m4a per scene, with report.json). Each scene lasts as long as its narration; on screen are the program's own
screens (app-tutorial/cap, taken by capture/cap-tutorial.cjs), the step, a few points, and the words being said.
Buying is only through Haim: the end card has his name and number and nothing else (no price, no download link).
"""
import json, os, re, shutil, subprocess
import build as B
from build import esc, GOLD, INK, CREAM, DARK

ROOT = B.ROOT
TUT = os.path.join(ROOT, 'app-tutorial')
W, H = 1920, 1080
OV = 0.45
LEAD, TAIL = 0.55, 0.75   # silence before the voice in each scene, and after it

# per scene: what is on screen. shots: (screenshot, centre x, centre y, zoom) in turn; 'wipe' shows the AI result over
# the original; steps: the install cards. Points are short, one per line, in both languages.
SCENES = {
    'intro': dict(kind='title', img='tab-photos', he=('פריים־סטודיו לווינדוס', 'מגנטים ותמונות מהאירוע · AI · הדפסה · גם בלי אינטרנט'),
                  en=('Frame Studio for Windows', 'Event magnets and prints · AI designs · on-site printing · works offline')),
    'install': dict(kind='steps', step=1, he=('התקנה', ['מפעילים את קובץ ההתקנה', 'אזהרת Windows: ״מידע נוסף״ ← ״הפעל בכל זאת״', 'התוכנה נפתחת לבד']),
                    en=('Install', ['Run the setup file', 'Windows warning: More info → Run anyway', 'The program opens by itself'])),
    'activate': dict(step=2, shots=[('gate', 0.5, 0.5, 1.0), ('gate', 0.5, 0.42, 1.9)],
                     he=('הפעלה', ['קוד הפעלה אישי ממני', 'מזינים פעם אחת בלבד', 'עובד גם בלי אינטרנט']),
                     en=('Activate', ['Your personal code, from me', 'Entered only once', 'Works offline too'])),
    'engine': dict(step=3, shots=[('float-dl', 0.5, 0.5, 1.0), ('float-dl', 0.5, 0.82, 2.2), ('float-ok', 0.5, 0.82, 2.2)],
                   he=('מנוע ה־AI מותקן לבד', ['ברקע, אפשר להמשיך לעבוד', 'כרטיס התקדמות ושורת המשימות', 'בסוף: ״ההתקנה הסתיימה״']),
                   en=('The AI engine installs itself', ['In the background, keep working', 'Progress card and taskbar', 'Then: installation finished'])),
    'photos': dict(step=4, shots=[('tab-photos', 0.5, 0.5, 1.0), ('tab-photos', 0.8, 0.25, 2.0)],
                   he=('תמונות', ['בוחרים או גוררים לחלון', 'JPG · PNG · HEIC · RAW', 'הרבה תמונות ביחד']),
                   en=('Photos', ['Choose, or drag into the window', 'JPG · PNG · HEIC · RAW', 'Many at once'])),
    'frames': dict(step=5, shots=[('tab-frames', 0.5, 0.5, 1.0), ('tab-frames', 0.36, 0.45, 1.7), ('tab-frames', 0.7, 0.72, 1.7)],
                   he=('מסגרות', ['בוחרים עיצוב', 'שמות ותאריך', 'מסגרות לכל סוג אירוע']),
                   en=('Frames', ['Pick a design', 'Names and date', 'Frames for every event'])),
    'adjust': dict(step=6, shots=[('tab-adjust', 0.5, 0.5, 1.0), ('tab-adjust', 0.64, 0.4, 1.6)],
                   he=('עריכה', ['אור וצבע', 'יישור וזום', 'הפנים במרכז, אוטומטית']),
                   en=('Edit', ['Light and colour', 'Straighten and zoom', 'Faces centred, automatically'])),
    'ai': dict(step=7, shots=[('tab-styles', 0.5, 0.5, 1.0), ('tab-styles', 0.64, 0.45, 1.6), ('vars', 0.5, 0.5, 1.45)],
               he=('עריכות AI', ['62 סגנונות · 22 ויראליים', '54 שילובים מוכנים', 'בוחרים מנוע, או 3 גרסאות']),
               en=('AI designs', ['62 styles · 22 viral looks', '54 ready combinations', 'Pick an engine, or 3 versions'])),
    'offline': dict(step=8, shots=[('local-panel', 0.5, 0.5, 1.0), ('local-panel', 0.5, 0.45, 1.7)], wipe=True,
                    he=('AI בלי אינטרנט', ['רץ על המחשב עצמו', 'עם כרטיס מסך: מהיר', 'בלי כרטיס מסך: איטי יותר, עובד']),
                    en=('AI without internet', ['Runs on the computer itself', 'With a graphics card: fast', 'Without one: slower, but works'])),
    'curate': dict(step=9, shots=[('tab-curate', 0.5, 0.5, 1.0), ('tab-curate', 0.75, 0.3, 1.7), ('tab-collage', 0.75, 0.45, 1.7)],
                   he=('בחירה וקולאז׳', ['מסמנת עיניים עצומות וטשטוש', 'קולאז׳ מכמה תמונות', 'לב · עיגול · פולארויד']),
                   en=('Select and Collage', ['Flags closed eyes and blur', 'One board from many photos', 'Heart · circle · polaroids'])),
    'live': dict(step=10, shots=[('tab-live', 0.5, 0.5, 1.0), ('tab-live', 0.64, 0.35, 1.6)],
                 he=('אירוע חי', ['האורחים סורקים QR ומעלים', 'מסך גדול באולם', 'כמה עמדות, תור אחד']),
                 en=('Live event', ['Guests scan a QR and upload', 'A big screen in the hall', 'Several stations, one queue'])),
    'output': dict(step=11, shots=[('tab-output', 0.5, 0.5, 1.0), ('tab-output', 0.64, 0.45, 1.6)],
                   he=('שמירה והדפסה', ['הדפסה, JPG, PNG או PDF', 'תיקיית אירוע במחשב', 'ZIP אחד בסוף הערב']),
                   en=('Save and print', ['Print, JPG, PNG or PDF', 'An event folder on the computer', 'One ZIP at the end of the night'])),
    'buy': dict(kind='end', he=('פריים־סטודיו', 'כל מה שצריך לאירוע, במקום אחד', 'לרכישה ולקוד הפעלה: חיים', 'טלפון / וואטסאפ'),
                en=('Frame Studio', 'Everything your event needs, in one place', 'To buy and get your code: Haim', 'Phone / WhatsApp')),
}
PHONE = '054-4979771'
STEP = {'he': 'שלב', 'en': 'Step'}


def ltr(lang):
    return lang == 'en'


def captions(text, secs):
    """The narration in short pieces, each shown for its share of the voice (by length)."""
    parts = [p.strip() for p in re.split(r'(?<=[.:?!])\s+|(?<=,)\s+(?=\S{2,})', text) if p.strip()]
    # join pieces that are too short to stand alone
    out = []
    for p in parts:
        if out and (len(out[-1]) < 28 or len(p) < 14) and len(out[-1]) + len(p) < 70:
            out[-1] += ' ' + p
        else:
            out.append(p)
    total = sum(len(p) for p in out)
    t, res = 0.0, []
    for p in out:
        d = secs * len(p) / total
        res.append((t, d, p))
        t += d
    return res


class Sc(B.Scene):
    def __init__(self, sid, dur, lang):
        super().__init__(sid, W, H, dur, DARK)
        self.lang = lang

    def html(self):
        h = super().html()
        d = 'ltr' if ltr(self.lang) else 'rtl'
        return h.replace('#root .ttl{position:absolute;direction:rtl', f'#root .ttl{{position:absolute;direction:{d}') \
                .replace('#root .sub{position:absolute;direction:rtl', f'#root .sub{{position:absolute;direction:{d}') \
                .replace('#root .chip{position:absolute;direction:rtl', f'#root .chip{{position:absolute;direction:{d}')


def side(lang):
    """Hebrew reads from the right: the text column is on the right and the screen on the left; English the other way."""
    return ('right', 'left') if not ltr(lang) else ('left', 'right')


def text_col(sc, lang, step, head, points, t0=0.35):
    tside, _ = side(lang)
    x = 80
    if step:
        sc.add(f'<div class="chip" id="{sc.sid}-step" style="{tside}:{x}px;top:150px;font-size:30px;background:rgba(214,183,126,.16);color:{GOLD};border:1px solid rgba(214,183,126,.45)">{STEP[lang]} {step}</div>')
        sc.tw(f'tl.fromTo("#{sc.sid}-step", {{opacity:0, y:-14}}, {{opacity:1, y:0, duration:0.4, ease:"expo.out"}}, {t0:.2f});')
    size = min(84, int(560 / (max(len(head), 6) * (0.5 if ltr(lang) else 0.55))))
    sc.add(f'<div class="ttl" id="{sc.sid}-h" style="{tside}:{x}px;top:220px;font-size:{size}px;color:#fff;white-space:normal;width:600px;text-align:{tside}">{B.words(head)}</div>')
    sc.tw(f'tl.fromTo("#{sc.sid}-h .w", {{opacity:0, filter:"blur(10px)"}}, {{opacity:1, filter:"blur(0px)", duration:0.32, ease:"power3.out", stagger:0.07}}, {t0 + 0.15:.2f});')
    y = 220 + size * (1.3 if len(head) * size * 0.55 < 600 else 2.4) + 40
    for i, p in enumerate(points):
        pid = f'{sc.sid}-p{i}'
        sc.add(f'<div class="sub" id="{pid}" style="{tside}:{x}px;top:{y + i * 92:.0f}px;width:600px;white-space:normal;text-align:{tside};font-size:38px;font-weight:500;color:#efe5d4;line-height:1.25">'
               f'<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:{GOLD};margin-{"right" if ltr(lang) else "left"}:18px;vertical-align:middle"></span>{esc(p)}</div>')
    return y


def points_in(sc, n, voice_t, secs):
    """The points arrive spread over the narration."""
    for i in range(n):
        t = voice_t + 0.2 + i * max(0.9, (secs - 1.0) / n)
        sc.tw(f'tl.fromTo("#{sc.sid}-p{i}", {{opacity:0, x:{-24 if True else 24}}}, {{opacity:1, x:0, duration:0.4, ease:"expo.out"}}, {t:.2f});')


def cap_bar(sc, lang, text, voice_t, secs):
    """The words being said, at the bottom, one piece at a time."""
    for i, (t, d, p) in enumerate(captions(text, secs)):
        cid = f'{sc.sid}-cc{i}'
        sc.add(f'<div class="sub" id="{cid}" style="left:50%;bottom:44px;transform:translateX(-50%);max-width:1700px;white-space:normal;text-align:center;font-size:36px;font-weight:500;'
               f'color:#fff;background:rgba(10,8,6,.78);padding:12px 30px;border-radius:14px;opacity:0;line-height:1.3">{esc(p)}</div>')
        sc.tw(f'tl.fromTo("#{cid}", {{opacity:0}}, {{opacity:1, duration:0.15}}, {voice_t + t:.2f});')
        sc.tw(f'tl.to("#{cid}", {{opacity:0, duration:0.15}}, {voice_t + t + d - 0.05:.2f});')


def screen_box(sc, lang, shots, voice_t, secs, wipe=False):
    """The program's screen in a box beside the text; the camera moves to each shot's centre in turn."""
    _, bside = side(lang)
    bw, bh = 1120, 630
    bx, by = 70, 150
    pos = f'{bside}:{bx}px;top:{by}px'
    imgs = ''.join(f'<img id="{sc.sid}-i{i}" src="assets/cap/{img}.webp" alt="" style="position:absolute;left:0;top:0;width:{bw}px;height:{bh}px;transform-origin:0 0;opacity:{1 if i == 0 else 0}">'
                   for i, (img, *_r) in enumerate(shots))
    sc.add(f'<div id="{sc.sid}-box" style="position:absolute;{pos};width:{bw}px;height:{bh}px;overflow:hidden;border-radius:18px;box-shadow:0 40px 90px rgba(0,0,0,.5),0 0 0 1px rgba(214,183,126,.25);background:#000">{imgs}</div>')
    sc.tw(f'tl.fromTo("#{sc.sid}-box", {{opacity:0, scale:0.96}}, {{opacity:1, scale:1, duration:0.55, ease:"expo.out"}}, 0.1);')
    span = secs + TAIL * 0.5
    n = len(shots)
    for i, (img, cx, cy, k) in enumerate(shots):
        t = voice_t + span * i / n - (0.4 if i else 0)
        x1 = min(0, max(bw - bw * k, bw / 2 - cx * bw * k))
        y1 = min(0, max(bh - bh * k, bh / 2 - cy * bh * k))
        if i:
            same = shots[i - 1][0] == img
            pk, (pcx, pcy) = shots[i - 1][3], shots[i - 1][1:3]
            px = min(0, max(bw - bw * pk, bw / 2 - pcx * bw * pk))
            py = min(0, max(bh - bh * pk, bh / 2 - pcy * bh * pk))
            if same:
                sc.tw(f'tl.set("#{sc.sid}-i{i}", {{x:{px:.0f}, y:{py:.0f}, scale:{pk:.3f}, opacity:1}}, {t:.2f});')
                sc.tw(f'tl.set("#{sc.sid}-i{i - 1}", {{opacity:0}}, {t + 0.01:.2f});')
                sc.tw(f'tl.to("#{sc.sid}-i{i}", {{x:{x1:.0f}, y:{y1:.0f}, scale:{k:.3f}, duration:1.0, ease:"power2.inOut"}}, {t + 0.02:.2f});')
            else:
                sc.tw(f'tl.set("#{sc.sid}-i{i}", {{x:{x1:.0f}, y:{y1:.0f}, scale:{k:.3f}}}, 0);')
                sc.tw(f'tl.fromTo("#{sc.sid}-i{i}", {{opacity:0}}, {{opacity:1, duration:0.45, ease:"power1.inOut"}}, {t:.2f});')
        elif k > 1.001:
            sc.tw(f'tl.set("#{sc.sid}-i0", {{x:{x1:.0f}, y:{y1:.0f}, scale:{k:.3f}}}, 0);')
    if wipe:
        # the real result of the local engine (FLUX.2 klein on the Windows test machine) over the original photo
        ph, pw = 560, 373
        wx = bx + bw - pw - 30 if bside == 'left' else None
        wpos = f'{bside}:{bx + bw - pw - 40}px;top:{by + 40}px'
        sc.add(f'<div id="{sc.sid}-wp" style="position:absolute;{wpos};width:{pw}px;height:{ph}px;border-radius:14px;overflow:hidden;box-shadow:0 30px 70px rgba(0,0,0,.6),0 0 0 3px {GOLD};opacity:0">'
               f'<img class="full" src="assets/e2e/original.jpg" alt=""><img id="{sc.sid}-wa" class="full" src="assets/e2e/3d.png" alt="" style="clip-path:inset(0 0 0 100%)">'
               f'<div class="chip" style="left:50%;bottom:14px;transform:translateX(-50%);font-size:24px;background:{GOLD};color:{INK}">{"📴 נוצר על המחשב, בלי אינטרנט" if not ltr(lang) else "📴 Made on the computer, offline"}</div></div>')
        tw = voice_t + secs * 0.45
        sc.tw(f'tl.fromTo("#{sc.sid}-wp", {{opacity:0, y:30}}, {{opacity:1, y:0, duration:0.5, ease:"expo.out"}}, {tw:.2f});')
        sc.tw(f'tl.fromTo("#{sc.sid}-wa", {{clipPath:"inset(0 0 0 100%)"}}, {{clipPath:"inset(0 0 0 0%)", duration:1.0, ease:"power2.inOut"}}, {tw + 0.8:.2f});')


def s_title(sc, lang, f, voice_t, secs):
    name, sub = f[lang]
    sc.add(f'<div id="{sc.sid}-cam" style="position:absolute;inset:0"><img class="full" src="assets/cap/{f["img"]}.webp" alt="" style="object-position:50% 50%"></div>')
    sc.add('<div style="position:absolute;inset:0;background:rgba(14,11,9,.84)"></div>')
    sc.tw(f'tl.fromTo("#{sc.sid}-cam", {{scale:1.15}}, {{scale:1.0, duration:{sc.dur:.2f}, ease:"power1.out"}}, 0);')
    ms = 190
    sc.add(f'<img id="{sc.sid}-mark" src="assets/icon.svg" alt="" style="position:absolute;left:{W / 2 - ms / 2:.0f}px;top:170px;width:{ms}px;height:{ms}px">')
    sc.tw(f'tl.fromTo("#{sc.sid}-mark", {{scale:0.3, rotation:-20, opacity:0}}, {{scale:1, rotation:0, opacity:1, duration:0.8, ease:"back.out(1.5)"}}, 0.2);')
    sc.add(f'<div class="ttl" id="{sc.sid}-n" style="left:0;right:0;text-align:center;top:400px;font-size:130px;color:#fff">{B.words(name)}</div>')
    sc.tw(f'tl.fromTo("#{sc.sid}-n .w", {{opacity:0, filter:"blur(10px)"}}, {{opacity:1, filter:"blur(0px)", duration:0.4, stagger:0.1}}, 0.6);')
    sc.add(f'<div class="sub" id="{sc.sid}-s" style="left:0;right:0;text-align:center;top:590px;font-size:44px;color:{GOLD}">{esc(sub)}</div>')
    sc.tw(f'tl.fromTo("#{sc.sid}-s", {{opacity:0, y:16}}, {{opacity:1, y:0, duration:0.5, ease:"expo.out"}}, 1.2);')


def s_steps(sc, lang, f, voice_t, secs):
    head, pts = f[lang]
    sc.add(f'<div style="position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 30%,#2a231c 0%,{DARK} 70%)"></div>')
    sc.add(f'<div class="chip" id="{sc.sid}-step" style="left:0;right:0;margin:auto;width:max-content;top:120px;font-size:30px;background:rgba(214,183,126,.16);color:{GOLD};border:1px solid rgba(214,183,126,.45)">{STEP[lang]} {f["step"]}</div>')
    sc.add(f'<div class="ttl" id="{sc.sid}-h" style="left:0;right:0;text-align:center;top:190px;font-size:96px;color:#fff">{B.words(head)}</div>')
    sc.tw(f'tl.fromTo("#{sc.sid}-step", {{opacity:0}}, {{opacity:1, duration:0.4}}, 0.3);')
    sc.tw(f'tl.fromTo("#{sc.sid}-h .w", {{opacity:0, filter:"blur(10px)"}}, {{opacity:1, filter:"blur(0px)", duration:0.32, stagger:0.07}}, 0.45);')
    cw, ch, gap = 520, 330, 50
    x0 = (W - 3 * cw - 2 * gap) / 2
    icons = ['💿', '🛡️', '✅']
    order = range(3) if ltr(lang) else range(2, -1, -1)
    for slot, i in enumerate(order):
        x = x0 + slot * (cw + gap)
        cid = f'{sc.sid}-c{i}'
        sc.add(f'<div id="{cid}" style="position:absolute;left:{x:.0f}px;top:380px;width:{cw}px;height:{ch}px;border-radius:22px;background:linear-gradient(180deg,#2b241d,#1d1915);'
               f'box-shadow:0 30px 70px rgba(0,0,0,.45),0 0 0 1px rgba(214,183,126,.3);direction:{"ltr" if ltr(lang) else "rtl"};text-align:center;font-family:Heebo">'
               f'<div style="margin:34px auto 0;width:92px;height:92px;border-radius:50%;background:{GOLD};color:{INK};font-family:\'Frank Ruhl Libre\',serif;font-weight:900;font-size:56px;line-height:92px">{i + 1}</div>'
               f'<div style="font-size:54px;margin-top:14px">{icons[i]}</div>'
               f'<div style="font-size:36px;font-weight:600;color:#f3e7d3;margin:12px 28px 0;line-height:1.3">{esc(pts[i])}</div></div>')
        t = voice_t + 0.2 + i * max(1.0, (secs - 1.5) / 3)
        sc.tw(f'tl.fromTo("#{cid}", {{opacity:0, y:40, scale:0.94}}, {{opacity:1, y:0, scale:1, duration:0.55, ease:"back.out(1.4)"}}, {t:.2f});')


def s_end(sc, lang, f, voice_t, secs):
    name, sub, who, how = f[lang]
    sc.add(f'<div style="position:absolute;inset:0;background:radial-gradient(110% 80% at 50% 35%,#2d251d 0%,{DARK} 72%)"></div>')
    ms = 170
    sc.add(f'<img id="{sc.sid}-mark" src="assets/icon.svg" alt="" style="position:absolute;left:{W / 2 - ms / 2:.0f}px;top:90px;width:{ms}px;height:{ms}px">')
    sc.tw(f'tl.fromTo("#{sc.sid}-mark", {{scale:0.2, rotation:-25, opacity:0}}, {{scale:1, rotation:0, opacity:1, duration:0.8, ease:"back.out(1.5)"}}, 0.2);')
    sc.add(f'<div class="ttl" id="{sc.sid}-n" style="left:0;right:0;text-align:center;top:280px;font-size:120px;color:#fff">{B.words(name)}</div>')
    sc.tw(f'tl.fromTo("#{sc.sid}-n .w", {{opacity:0, filter:"blur(8px)"}}, {{opacity:1, filter:"blur(0px)", duration:0.35, stagger:0.08}}, 0.5);')
    sc.add(f'<div class="sub" id="{sc.sid}-s" style="left:0;right:0;text-align:center;top:440px;font-size:42px;color:#e9dcc6">{esc(sub)}</div>')
    sc.tw(f'tl.fromTo("#{sc.sid}-s", {{opacity:0}}, {{opacity:1, duration:0.4}}, 1.0);')
    t2 = voice_t + secs * 0.35
    sc.add(f'<div class="sub" id="{sc.sid}-w" style="left:0;right:0;text-align:center;top:560px;font-size:56px;font-weight:700;color:{GOLD}">{esc(who)}</div>')
    sc.tw(f'tl.fromTo("#{sc.sid}-w", {{opacity:0, y:20}}, {{opacity:1, y:0, duration:0.5, ease:"expo.out"}}, {t2:.2f});')
    sc.add(f'<div class="chip" id="{sc.sid}-ph" style="left:50%;top:660px;transform:translateX(-50%);direction:ltr;font-family:\'Frank Ruhl Libre\',serif;font-weight:900;font-size:110px;'
           f'background:linear-gradient(180deg,#ecd5a2,{GOLD});color:{INK};padding:.12em .7em;box-shadow:0 24px 60px rgba(214,183,126,.3)">{PHONE}</div>')
    sc.tw(f'tl.fromTo("#{sc.sid}-ph", {{opacity:0, scale:0.8}}, {{opacity:1, scale:1, duration:0.6, ease:"back.out(1.6)"}}, {t2 + 0.5:.2f});')
    sc.add(f'<div class="sub" id="{sc.sid}-how" style="left:0;right:0;text-align:center;top:860px;font-size:40px;color:#e9dcc6">📞 {esc(how)} 💬</div>')
    sc.tw(f'tl.fromTo("#{sc.sid}-how", {{opacity:0}}, {{opacity:1, duration:0.4}}, {t2 + 1.0:.2f});')
    sc.add('<div class="sub" style="left:0;right:0;text-align:center;bottom:26px;font-size:18px;color:rgba(233,220,198,.5);direction:ltr">Music: Kevin MacLeod (incompetech.com) · CC BY 4.0</div>')


def s_screen(sc, lang, f, voice_t, secs):
    head, pts = f[lang]
    sc.add(f'<div style="position:absolute;inset:0;background:radial-gradient(120% 100% at 50% 0%,#221c17 0%,{DARK} 70%)"></div>')
    screen_box(sc, lang, f['shots'], voice_t, secs, f.get('wipe'))
    text_col(sc, lang, f.get('step'), head, pts)
    points_in(sc, len(pts), voice_t, secs)


KIND = dict(title=s_title, steps=s_steps, end=s_end, screen=s_screen)


def build(lang):
    script = json.load(open(os.path.join(TUT, 'script.json'), encoding='utf-8'))
    rep = json.load(open(os.path.join(TUT, 'voice', 'report.json'), encoding='utf-8'))
    secs = {s['id']: s['seconds'] for s in rep['langs'][lang]['scenes'] if s.get('seconds')}
    dst = os.path.join(B.VID, f'promo-app-tutorial-{lang}')
    if os.path.isdir(os.path.join(dst, 'compositions')):
        shutil.rmtree(os.path.join(dst, 'compositions'))
    os.makedirs(os.path.join(dst, 'compositions'), exist_ok=True)
    B.copy_assets(dst)
    a = os.path.join(dst, 'assets')
    shutil.rmtree(os.path.join(a, 'cap'))
    shutil.copytree(os.path.join(TUT, 'cap'), os.path.join(a, 'cap'))
    os.makedirs(os.path.join(a, 'voice'), exist_ok=True)
    hosts, audio = [], []
    t = 0.0
    for i, sc_ in enumerate(script['scenes']):
        sid_ = sc_['id']
        f = SCENES[sid_]
        v = secs[sid_]
        dur = LEAD + v + TAIL + (1.6 if f.get('kind') == 'end' else 0)
        sid = f's{i + 1}-{sid_}'
        sc = Sc(sid, dur, lang)
        if i > 0:
            B.enter(sc, ['wipe', 'zoom', 'iris'][i % 3] if f.get('kind') else 'zoom')
        KIND[f.get('kind', 'screen')](sc, lang, f, LEAD, v)
        if f.get('kind') != 'end':
            cap_bar(sc, lang, sc_[lang], LEAD, v)
        with open(os.path.join(dst, 'compositions', sid + '.html'), 'w', encoding='utf-8') as fh:
            fh.write(sc.html())
        hosts.append(f'      <div id="{sid}" data-composition-id="{sid}" data-composition-src="compositions/{sid}.html" data-start="{t:.2f}" data-duration="{dur:.2f}" data-track-index="{1 + i % 2}" data-track-kind="graphics" data-width="{W}" data-height="{H}" style="z-index:{i + 1}"></div>')
        shutil.copy2(os.path.join(TUT, 'voice', lang, sid_ + '.m4a'), os.path.join(a, 'voice', sid_ + '.m4a'))
        audio.append(f'      <audio id="vo-{sid_}" class="clip" src="assets/voice/{sid_}.m4a" data-start="{t + LEAD:.2f}" data-duration="{v:.2f}" data-track-index="{20 + i % 2}" data-volume="1"></audio>')
        if i > 0:
            audio.append(f'      <audio id="sfx-w{i}" class="clip" src="assets/sfx/whoosh-short.mp3" data-start="{max(0, t - 0.05):.2f}" data-duration="1.0" data-track-index="11" data-volume="0.25"></audio>')
        t += dur - OV
    total = round(t + OV, 2)
    bed = os.path.join(a, 'music', 'bed.m4a')
    src = os.path.join(ROOT, 'music', 'src', 'Beauty_Flow.mp3')
    if os.path.exists(src):
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', '17', '-t', f'{total + 1:.2f}', '-i', src, '-af', f'loudnorm=I=-16:TP=-1.5,afade=t=in:d=1,afade=t=out:st={max(0, total - 3):.2f}:d=3', '-c:a', 'aac', '-b:a', '160k', bed], check=True)
        # the music under the voice: quiet while it speaks
        audio.insert(0, f'      <audio id="bgm" class="clip" src="assets/music/bed.m4a" data-start="0" data-duration="{total:.2f}" data-track-index="10" data-volume="0.13"></audio>')
    index = f"""<!doctype html>
<html lang="{lang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <script src="assets/vendor/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ width: {W}px; height: {H}px; overflow: hidden; background: {DARK}; }}
      #root {{ position: relative; width: {W}px; height: {H}px; overflow: hidden; background: {DARK}; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{total:.2f}" data-width="{W}" data-height="{H}">
{chr(10).join(hosts)}
{chr(10).join(audio)}
    </div>
    <script>
      window.__timelines = window.__timelines || {{}};
      window.__timelines["main"] = gsap.timeline({{ paused: true }});
    </script>
  </body>
</html>
"""
    with open(os.path.join(dst, 'index.html'), 'w', encoding='utf-8') as fh:
        fh.write(index)
    with open(os.path.join(dst, 'hyperframes.json'), 'w') as fh:
        json.dump({"$schema": "https://hyperframes.heygen.com/schema/hyperframes.json", "paths": {"blocks": "compositions", "assets": "assets"}}, fh, indent=2)
    print(f'promo-app-tutorial-{lang}: {W}x{H}, {total}s, {len(script["scenes"])} scenes')
    return dst


if __name__ == '__main__':
    import sys
    for lang in sys.argv[1:] or ['he', 'en']:
        build(lang)
