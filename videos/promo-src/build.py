#!/usr/bin/env python3
"""Builds the three Frame Studio promo films (site, studio, Windows program) as HyperFrames projects, each in 16:9 and 9:16.

  python3 videos/promo-src/build.py            -> videos/promo-{site,studio,app}{,-v}/

Every scene is a sub-composition generated from the FILMS spec below; the pictures are the product's own screens and
outputs (frame-studio/show, media/real, the local-AI end-to-end run, screenshots taken from the live pages).
"""
import json, os, shutil, html

ROOT = os.path.dirname(os.path.abspath(__file__))
VID = os.path.dirname(ROOT)
REPO = os.path.dirname(VID)
FS = os.path.join(REPO, 'frame-studio')
CAP = os.path.join(ROOT, 'cap')          # screenshots (cap.cjs / cap2.cjs)
FONTS = os.path.join(VID, 'frame-explainer', 'assets', 'fonts')
SFX = '/root/.claude/skills/media-use/audio/assets/sfx'

GOLD = '#D6B77E'
INK = '#1b1714'
CREAM = '#F5EEE2'
DARK = '#14110F'

# ---------------------------------------------------------------- the films
# kind, seconds, fields. Scenes overlap by OV seconds; each new scene enters over the last one.
OV = 0.45
FILMS = {
    'site': {
        'title': 'פריים מגנטים',
        'music': 'site',
        'scenes': [
            ('photo', 4.4, dict(img='real/wedding-3.webp', lines=['כל האורחים מצלמים', 'מי לוקח את הרגע הביתה?'], accent=1, pos='bottom')),
            ('magnet', 5.0, dict(photo='real/wedding-3.webp', magnet='show/mp.webp', lines=['כל אורח יוצא', 'עם מגנט ביד'], accent=1)),
            ('number', 4.2, dict(n=60, lines=['שניות', 'מהצילום ועד ההדפסה ביד'])),
            ('fan', 8.2, dict(items=[('show/m0.webp', 'חתונה'), ('show/m1.webp', 'בר מצווה'), ('show/m4.webp', 'ברית'), ('show/m5.webp', 'חינה'),
                                     ('show/m2.webp', 'אירוסין'), ('show/m6.webp', 'אירוע חברה')], lines=['מסגרת אישית', 'לכל אירוע'], accent=0)),
            ('screen', 6.4, dict(img='cap/design.webp', focus=(0.53, 0.07, 0.26, 0.78), lines=['מעצבים בעצמכם', 'שמות, תאריך וצבעים'], accent=0, ground=CREAM)),
            ('styles', 6.4, dict(items=[('show/p-original.webp', 'המקור'), ('show/p-oil.webp', 'ציור שמן'), ('show/p-noir.webp', 'נואר'), ('show/p-anime.webp', 'אנימה'),
                                        ('show/p-sketch.webp', 'סקיצה'), ('show/p-candy.webp', 'סוכריות פופ'), ('show/p-oldphoto.webp', 'תמונה ישנה'), ('show/p-rain.webp', 'ציור גשם')],
                                 lines=['תמונה אחת', 'עשרות עיצובים'], accent=1)),
            ('screen', 6.2, dict(img='cap/site-packages.webp', focus=(0.06, 0.36, 0.88, 0.5), lines=['שלוש חבילות', 'החל מ־₪1,490'], accent=1, ground=DARK)),
            ('end', 6.8, dict(name='פריים מגנטים', sub='מגנטים לאירועים · מודפסים במקום, ביום שלכם', cta='בדיקת תאריך פנוי', foot='054-4979771')),
        ],
    },
    'studio': {
        'title': 'פריים־סטודיו',
        'music': 'studio',
        'scenes': [
            ('ai', 5.6, dict(orig='e2e/original.jpg', outs=[('e2e/3d.png', 'אנימציה תלת־ממד')], lines=['תמונה רגילה מהאירוע', 'עיצוב AI אמיתי'], accent=1)),
            ('screen', 5.2, dict(img='cap/one-ai.webp', focus=(0.0, 0.0, 1.0, 1.0), lines=['פריים־סטודיו'], sub='עריכה, מסגרות, AI והדפסה במקום אחד', accent=0, ground=DARK, title=True)),
            ('screen', 6.0, dict(img='cap/one-frames.webp', focus=(0.22, 0.07, 0.3, 0.68), lines=['מגנט עם שמות ותאריך', 'מוכן להדפסה'], accent=0, ground=DARK)),
            ('screen', 5.8, dict(img='cap/studio-photos.webp', focus=(0.0, 0.17, 0.74, 0.55), lines=['כל התמונות', 'בבת אחת'], accent=1, ground=DARK)),
            ('ai', 7.6, dict(orig='e2e/original.jpg', outs=[('e2e/anime.png', 'אנימה'), ('e2e/oil.png', 'ציור שמן'), ('show/p-noir.webp', 'נואר')],
                             lines=['36 סגנונות · 22 ויראליים', '54 שילובים מוכנים'], accent=0)),
            ('screen', 6.2, dict(img='cap/studio-live.webp', focus=(0.74, 0.0, 0.26, 0.42), lines=['אירוע חי', 'האורחים מעלים מהטלפון'], accent=0, ground=DARK)),
            ('screen', 5.6, dict(img='cap/one-output.webp', focus=(0.74, 0.06, 0.26, 0.6), lines=['שמירה והדפסה', 'בלחיצה אחת'], accent=1, ground=DARK)),
            ('end', 6.8, dict(name='פריים־סטודיו', sub='הסטודיו של צלמי האירועים · בדפדפן ובמחשב', cta='לנסות עכשיו', foot='פריים מגנטים · 054-4979771')),
        ],
    },
    'app': {
        'title': 'פריים־סטודיו לווינדוס',
        'music': 'app',
        'scenes': [
            ('type', 4.6, dict(lines=['האינטרנט באולם נפל', 'האירוע לא מחכה'], accent=1, icon='nowifi')),
            ('screen', 5.4, dict(img='cap/studio-photos.webp', focus=(0.0, 0.0, 1.0, 1.0), lines=['פריים־סטודיו לווינדוס'], sub='תוכנה מלאה על המחשב שלך', accent=0, ground=DARK, title=True)),
            ('ai', 10.4, dict(orig='e2e/original.jpg', outs=[('e2e/3d.png', 'אנימציה תלת־ממד'), ('e2e/anime.png', 'אנימה'), ('e2e/oil.png', 'ציור שמן')],
                              lines=['AI שרץ על המחשב', 'גם בלי אינטרנט'], accent=1, badge='📴 נוצר על המחשב, בלי אינטרנט')),
            ('screen', 6.0, dict(img='cap/one-ai.webp', focus=(0.25, 0.08, 0.24, 0.66), lines=['עריכה מלאה', 'בלי חיבור לרשת'], accent=1, ground=DARK)),
            ('screen', 6.0, dict(img='cap/one-output.webp', focus=(0.74, 0.06, 0.26, 0.6), lines=['תיקיית אירוע במחשב', 'RAW, הדפסה וזיפ בסוף הערב'], accent=0, ground=DARK)),
            ('number', 4.4, dict(n=5.3, unit='GB', lines=['מנוע AI מקומי', 'מותקן לבד אחרי ההתקנה'], dec=1)),
            ('end', 7.0, dict(name='פריים־סטודיו', sub='לווינדוס 10 / 11 · עובד גם בלי אינטרנט', cta='הורדה ל־Windows', foot='frame-studio · download')),
        ],
    },
}

SIZES = {'': (1920, 1080), '-v': (1080, 1920)}


def esc(s):
    return html.escape(s, quote=True)


def font_css():
    out = []
    for fam, file_fam, weights in (('Frank Ruhl Libre', 'FrankRuhlLibre', (500, 700, 900)), ('Heebo', 'Heebo', (400, 500, 700, 800))):
        for w in weights:
            for sub, rng in (('hebrew', 'U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F'), ('latin', 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD')):
                out.append("@font-face{font-family:'%s';font-weight:%d;font-display:block;src:url('assets/fonts/%s-%d-%s.woff2') format('woff2');unicode-range:%s}" % (fam, w, file_fam, w, sub, rng))
    return '\n'.join(out)


FONT_CSS = font_css()


class Scene:
    """One sub-composition: html markup + a list of GSAP lines; t is local seconds."""

    def __init__(self, sid, W, H, dur, ground):
        self.sid, self.W, self.H, self.dur, self.ground = sid, W, H, dur, ground
        self.v = H > W
        self.body = []
        self.js = []

    def add(self, s):
        self.body.append(s)

    def tw(self, s):
        self.js.append(s)

    def html(self):
        css = f"""
{FONT_CSS}
#root{{position:absolute;inset:0;overflow:hidden;background:{self.ground};font-family:'Heebo',sans-serif;color:{INK}}}
#root .stage{{position:absolute;inset:0;overflow:hidden}}
#root .full{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 24%}}
#root .ttl{{position:absolute;direction:rtl;font-family:'Frank Ruhl Libre',serif;font-weight:900;line-height:1.08;letter-spacing:-0.01em;white-space:nowrap}}
#root .ttl .w{{display:inline-block;margin-left:0.24em}}
#root .gold{{color:{GOLD}}}
#root .sub{{position:absolute;direction:rtl;font-family:'Heebo',sans-serif;font-weight:500;white-space:nowrap}}
#root .chip{{position:absolute;direction:rtl;font-family:'Heebo',sans-serif;font-weight:700;border-radius:999px;padding:0.35em 1em;white-space:nowrap}}
"""
        return f"""<template>
  <style>{css}</style>
  <div id="root" data-composition-id="{self.sid}" data-width="{self.W}" data-height="{self.H}" data-layout-allow-overflow>
    <div class="stage" id="{self.sid}-stage">
{chr(10).join(self.body)}
    </div>
  </div>
  <script>
    const tl = gsap.timeline({{ paused: true }});
{chr(10).join('    ' + j for j in self.js)}
    tl.set({{}}, {{}}, {self.dur:.3f});
    window.__timelines["{self.sid}"] = tl;
  </script>
</template>
"""


def words(text):
    return ''.join(f'<span class="w">{esc(w)}</span>' for w in text.split(' '))


def title(sc, lines, accent, x, y, size, color, align='right', stagger=0.07, t0=0.25, ids='t', shadow=False):
    """Lines of title, one word after another blurring in (no slide); right-aligned at x (from the right edge) or centred."""
    out = []
    # fit the longest line into the room it has (Frank Ruhl 900 Hebrew runs about 0.55 em a character)
    room = sc.W * 0.88 if align != 'right' else sc.W * (0.86 if sc.v else 0.42)
    longest = max(len(l) for l in lines)
    size = min(size, int(room / (longest * 0.55)))
    for i, ln in enumerate(lines):
        col = GOLD if (accent is not None and i == accent) else color
        tid = f'{sc.sid}-{ids}{i}'
        pos = f'right:{x}px' if align == 'right' else 'left:0;right:0;text-align:center'
        sh = ';text-shadow:0 4px 30px rgba(0,0,0,.55),0 2px 6px rgba(0,0,0,.5)' if shadow else ''
        out.append(f'<div class="ttl" id="{tid}" style="{pos};top:{y + i * size * 1.12:.0f}px;font-size:{size}px;color:{col}{sh}">{words(ln)}</div>')
        sc.tw(f'tl.fromTo("#{tid} .w", {{opacity:0, filter:"blur(10px)"}}, {{opacity:1, filter:"blur(0px)", duration:0.32, ease:"power3.out", stagger:{stagger}}}, {t0 + i * 0.32:.2f});')
    return '\n'.join(out)


def enter(sc, how):
    """How the scene arrives over the previous one (the overlap window)."""
    st = f'#{sc.sid}-stage'
    if how == 'iris':
        sc.tw(f'tl.fromTo("{st}", {{clipPath:"circle(0% at 50% 50%)"}}, {{clipPath:"circle(75% at 50% 50%)", duration:0.5, ease:"power3.inOut"}}, 0);')
    elif how == 'whip':
        d = -1 if sc.v else 1
        sc.tw(f'tl.fromTo("{st}", {{xPercent:{d * 100}, filter:"blur(18px)"}}, {{xPercent:0, filter:"blur(0px)", duration:0.42, ease:"expo.out"}}, 0);')
    elif how == 'rise':
        sc.tw(f'tl.fromTo("{st}", {{yPercent:100}}, {{yPercent:0, duration:0.5, ease:"expo.out"}}, 0);')
    elif how == 'wipe':
        sc.tw(f'tl.fromTo("{st}", {{clipPath:"inset(0 0 0 100%)"}}, {{clipPath:"inset(0 0 0 0%)", duration:0.48, ease:"power3.inOut"}}, 0);')
    elif how == 'zoom':
        sc.tw(f'tl.fromTo("{st}", {{scale:1.25, opacity:0, filter:"blur(14px)"}}, {{scale:1, opacity:1, filter:"blur(0px)", duration:0.5, ease:"expo.out"}}, 0);')


# ---------------------------------------------------------------- scene builders
def s_photo(sc, f):
    W, H, v = sc.W, sc.H, sc.v
    sc.add(f'<div id="{sc.sid}-cam" style="position:absolute;inset:0"><img class="full" src="assets/{f["img"]}" alt=""></div>')
    sc.add(f'<div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(10,8,6,.82) 0%,rgba(10,8,6,.35) 38%,rgba(10,8,6,0) 60%)"></div>')
    size = 118 if v else 104
    y = H - (2.6 * size) - (360 if v else 120)
    sc.add(title(sc, f['lines'], f.get('accent'), 90 if not v else 0, y, size, '#fff', align='right' if not v else 'center', t0=0.35, shadow=True))
    sc.tw(f'tl.fromTo("#{sc.sid}-cam", {{scale:1.14}}, {{scale:1, duration:1.6, ease:"expo.out"}}, 0);')


def s_magnet(sc, f):
    W, H, v = sc.W, sc.H, sc.v
    mh = H * (0.62 if v else 0.82)
    mw = mh * 2 / 3
    cx = W / 2 if v else W * 0.33
    cy = H * (0.36 if v else 0.5)
    sc.add(f'<div style="position:absolute;inset:0;background:radial-gradient(120% 90% at 30% 40%,#2a231c 0%,{DARK} 70%)"></div>')
    # the photo, full frame, shrinks into the magnet's place; the printed magnet lands over it
    sc.add(f'<img id="{sc.sid}-ph" class="full" src="assets/{f["photo"]}" alt="">')
    sc.add(f'<img id="{sc.sid}-mg" src="assets/{f["magnet"]}" alt="" style="position:absolute;left:{cx - mw / 2:.0f}px;top:{cy - mh / 2:.0f}px;width:{mw:.0f}px;height:{mh:.0f}px;border-radius:10px;box-shadow:0 40px 80px rgba(0,0,0,.55),0 8px 18px rgba(0,0,0,.4)">')
    sx = mw * 0.84 / W
    sc.tw(f'tl.fromTo("#{sc.sid}-ph", {{scale:1, x:0, y:0, borderRadius:0}}, {{scale:{sx:.3f}, x:{cx - W / 2:.0f}, y:{cy - H / 2 - mh * 0.05:.0f}, duration:0.9, ease:"power3.inOut"}}, 0.35);')
    sc.tw(f'tl.fromTo("#{sc.sid}-mg", {{opacity:0, scale:1.06, rotation:0}}, {{opacity:1, scale:1, rotation:-2.5, duration:0.55, ease:"expo.out"}}, 1.15);')
    sc.tw(f'tl.to("#{sc.sid}-ph", {{opacity:0, duration:0.25}}, 1.3);')
    size = 104 if v else 108
    if v:
        sc.add(title(sc, f['lines'], f.get('accent'), 0, H * 0.72, size, '#fff', align='center', t0=1.5))
    else:
        sc.add(title(sc, f['lines'], f.get('accent'), 150, H * 0.36, size, '#fff', t0=1.5))


def s_number(sc, f):
    W, H, v = sc.W, sc.H, sc.v
    sc.add(f'<div style="position:absolute;inset:0;background:{CREAM}"></div>')
    big = 520 if v else 560
    unit = f.get('unit', '')
    sc.add(f'<div id="{sc.sid}-n" style="position:absolute;left:0;right:0;top:{H * (0.2 if v else 0.06):.0f}px;text-align:center;direction:ltr;font-family:\'Frank Ruhl Libre\',serif;font-weight:900;font-size:{big}px;line-height:1;color:{INK};letter-spacing:-0.04em">0<span style="font-size:0.32em;color:{GOLD};margin-left:0.1em">{esc(unit)}</span></div>')
    dec = f.get('dec', 0)
    sc.tw(f'(function(){{const o={{v:0}}, el=document.querySelector("#{sc.sid}-n"); const u=el.querySelector("span").outerHTML; tl.to(o, {{v:{f["n"]}, duration:1.1, ease:"power2.out", onUpdate:function(){{el.innerHTML=o.v.toFixed({dec})+u;}}}}, 0.3);}})();')
    sc.tw(f'tl.fromTo("#{sc.sid}-n", {{scale:0.9, opacity:0}}, {{scale:1, opacity:1, duration:0.5, ease:"expo.out"}}, 0.2);')
    size = 96 if v else 92
    y = H * (0.56 if v else 0.66)
    sc.add(title(sc, f['lines'], 0, 0, y, size, INK, align='center', t0=0.9))


def s_fan(sc, f):
    W, H, v = sc.W, sc.H, sc.v
    sc.add(f'<div style="position:absolute;inset:0;background:{CREAM}"></div>')
    items = f['items']
    n = len(items)
    if v:
        cols, rows = 3, 2
        cw = W * 0.28
        ch = cw * 1.5
        gx, gy = W * 0.04, 20
        top = 600
    else:
        cols, rows = n, 1
        ch = H * 0.4
        cw = ch * 2 / 3
        gx, gy = 30, 0
        top = H * 0.4
    total_w = cols * cw + (cols - 1) * gx
    for i, (img, lab) in enumerate(items):
        c, r = (i % cols, i // cols)
        x = W - (W - total_w) / 2 - (c + 1) * cw - c * gx  # right to left
        y = top + r * (ch + gy + 52)
        rot = [-4, 3, -2, 4, -3, 2][i % 6]
        iid = f'{sc.sid}-m{i}'
        sc.add(f'<div id="{iid}" style="position:absolute;left:{x:.0f}px;top:{y:.0f}px;width:{cw:.0f}px">'
               f'<img src="assets/{img}" alt="" style="width:100%;height:{ch:.0f}px;object-fit:cover;border-radius:8px;box-shadow:0 22px 40px rgba(60,40,20,.28),0 4px 10px rgba(60,40,20,.2)">'
               f'<div style="direction:rtl;text-align:center;margin-top:14px;font-family:Heebo;font-weight:700;font-size:{40 if v else 30}px;color:{INK}">{esc(lab)}</div></div>')
        t = 0.9 + i * 0.32
        sc.tw(f'tl.fromTo("#{iid}", {{y:-{H * 0.6:.0f}, rotation:{rot * 3}, opacity:0}}, {{y:0, rotation:{rot}, opacity:1, duration:0.62, ease:"back.out(1.3)"}}, {t:.2f});')
    size = 110 if v else 104
    sc.add(title(sc, f['lines'], f.get('accent'), 0 if v else 110, (230 if v else H * 0.08), size, INK, align='center' if v else 'right', t0=0.3))


def s_screen(sc, f):
    """A real screen at full size, then the camera pushes into the part that proves the line."""
    W, H, v = sc.W, sc.H, sc.v
    ground = f.get('ground', DARK)
    light = ground == CREAM
    sc.add(f'<div style="position:absolute;inset:0;background:{ground}"></div>')
    # the screenshot is 2400x1350 (16:9)
    fx, fy, fw, fh = f['focus']
    if v:
        # vertical: the screen fills the band 380..1500; the camera starts on the focus region at width
        box_t, box_h = 560, 1260
        img_w = box_h * 16 / 9
        s0 = 1.0
        k = min(W * 0.96 / (fw * img_w), box_h / (fh * box_h * 1.0))
        k = max(1.0, min(k, 3.2))
        cx = (fx + fw / 2) * img_w
        cy = (fy + fh / 2) * box_h
        sc.add(f'<div style="position:absolute;left:0;top:{box_t}px;width:{W}px;height:{box_h}px;overflow:hidden">'
               f'<img id="{sc.sid}-img" src="assets/{f["img"]}" alt="" style="position:absolute;left:0;top:0;width:{img_w:.0f}px;height:{box_h}px;transform-origin:0 0"></div>')
        # start: whole screen width-fitted? keep it simple: start slightly wide on the focus, then push
        x0 = W / 2 - cx * 1.0
        y0 = box_h / 2 - cy * 1.0
        x1 = W / 2 - cx * k
        y1 = box_h / 2 - cy * k
        sc.tw(f'tl.fromTo("#{sc.sid}-img", {{x:{x0:.0f}, y:{y0:.0f}, scale:1}}, {{x:{x1:.0f}, y:{y1:.0f}, scale:{k:.3f}, duration:0.9, ease:"power2.inOut"}}, 0.9);')
        size = 104 if not f.get('title') else 128
        tcol = INK if light else '#fff'
        sc.add(title(sc, f['lines'], f.get('accent'), 0, 190, size, tcol, align='center', t0=0.25))
        if f.get('sub'):
            sc.add(f'<div class="sub" id="{sc.sid}-sub" style="left:0;right:0;text-align:center;top:{190 + size * 1.25:.0f}px;font-size:46px;color:{GOLD}">{esc(f["sub"])}</div>')
            sc.tw(f'tl.fromTo("#{sc.sid}-sub", {{opacity:0, filter:"blur(8px)"}}, {{opacity:1, filter:"blur(0px)", duration:0.35}}, 0.7);')
        return
    # landscape: the screen sits in the left 64%, the line on the right
    if f.get('title'):
        # a title shot: the screen fills the frame behind, darkened, the name over it
        sc.add(f'<div id="{sc.sid}-cam" style="position:absolute;inset:0"><img class="full" src="assets/{f["img"]}" alt=""></div>')
        sc.add(f'<div style="position:absolute;inset:0;background:rgba(14,11,9,.82)"></div>')
        sc.tw(f'tl.fromTo("#{sc.sid}-cam", {{scale:1.18}}, {{scale:1.0, duration:1.4, ease:"expo.out"}}, 0);')
        sc.add(title(sc, f['lines'], 0, 0, H * 0.36, 150, '#fff', align='center', t0=0.35, shadow=True))
        if f.get('sub'):
            sc.add(f'<div class="sub" id="{sc.sid}-sub" style="left:0;right:0;text-align:center;top:{H * 0.36 + 190:.0f}px;font-size:52px;color:#f3e7d3">{esc(f["sub"])}</div>')
            sc.tw(f'tl.fromTo("#{sc.sid}-sub", {{opacity:0, filter:"blur(8px)"}}, {{opacity:1, filter:"blur(0px)", duration:0.35}}, 0.85);')
        return
    bw = W * 0.56
    bh = bw * 9 / 16
    bx, by = 70, (H - bh) / 2
    sc.add(f'<div id="{sc.sid}-box" style="position:absolute;left:{bx:.0f}px;top:{by:.0f}px;width:{bw:.0f}px;height:{bh:.0f}px;overflow:hidden;border-radius:18px;box-shadow:0 40px 90px rgba(0,0,0,.45);background:#000">'
           f'<img id="{sc.sid}-img" src="assets/{f["img"]}" alt="" style="position:absolute;left:0;top:0;width:{bw:.0f}px;height:{bh:.0f}px;transform-origin:0 0"></div>')
    k = min(1 / fw, 1 / fh)
    k = max(1.0, min(k, 3.0))
    cx, cy = (fx + fw / 2) * bw, (fy + fh / 2) * bh
    x1 = min(0, max(bw - bw * k, bw / 2 - cx * k))
    y1 = min(0, max(bh - bh * k, bh / 2 - cy * k))
    sc.tw(f'tl.fromTo("#{sc.sid}-box", {{x:-60, opacity:0}}, {{x:0, opacity:1, duration:0.55, ease:"expo.out"}}, 0.05);')
    if k > 1.01:
        sc.tw(f'tl.fromTo("#{sc.sid}-img", {{x:0, y:0, scale:1}}, {{x:{x1:.0f}, y:{y1:.0f}, scale:{k:.3f}, duration:0.9, ease:"power2.inOut"}}, 1.4);')
    tcol = INK if light else '#fff'
    size = 80
    sc.add(title(sc, f['lines'], f.get('accent'), 70, H * 0.4, size, tcol, t0=0.45))


def s_styles(sc, f):
    """One portrait on one stage; its style changes on the beat, the name rolls with it."""
    W, H, v = sc.W, sc.H, sc.v
    sc.add(f'<div style="position:absolute;inset:0;background:{DARK}"></div>')
    side = W * 0.82 if v else H * 0.78
    x = (W - side) / 2 if v else 120
    y = 560 if v else (H - side) / 2
    items = f['items']
    sc.add(f'<div style="position:absolute;left:{x:.0f}px;top:{y:.0f}px;width:{side:.0f}px;height:{side:.0f}px;border-radius:16px;overflow:hidden;box-shadow:0 40px 90px rgba(0,0,0,.5)">'
           + ''.join(f'<img id="{sc.sid}-s{i}" class="full" src="assets/{img}" alt="" style="opacity:{1 if i == 0 else 0}">' for i, (img, _) in enumerate(items)) + '</div>')
    lab_y = y + side + 30
    lab_x = 'left:0;right:0;text-align:center' if v else f'left:{x:.0f}px;width:{side:.0f}px;text-align:center'
    for i, (_, lab) in enumerate(items):
        sc.add(f'<div class="chip" id="{sc.sid}-l{i}" style="{lab_x};top:{lab_y:.0f}px;font-size:{48 if v else 38}px;color:{GOLD};opacity:{1 if i == 0 else 0}">{esc(lab)}</div>')
    step = (sc.dur - 1.6) / (len(items) - 1)
    for i in range(1, len(items)):
        t = 1.0 + (i - 1) * step
        sc.tw(f'tl.fromTo("#{sc.sid}-s{i}", {{opacity:0}}, {{opacity:1, duration:0.12}}, {t:.2f});')
        sc.tw(f'tl.to("#{sc.sid}-l{i - 1}", {{opacity:0, y:-20, duration:0.12}}, {t:.2f});')
        sc.tw(f'tl.fromTo("#{sc.sid}-l{i}", {{opacity:0, y:20}}, {{opacity:1, y:0, duration:0.16, ease:"power3.out"}}, {t + 0.04:.2f});')
    size = 120 if v else 110
    if v:
        sc.add(title(sc, f['lines'], f.get('accent'), 0, 200, size, '#fff', align='center', t0=0.3))
    else:
        sc.add(title(sc, f['lines'], f.get('accent'), 130, H * 0.36, size, '#fff', t0=0.3))


def s_ai(sc, f):
    """The original, then the AI result wipes across it (one or several in turn)."""
    W, H, v = sc.W, sc.H, sc.v
    sc.add(f'<div style="position:absolute;inset:0;background:{DARK}"></div>')
    ph = H * (0.62 if v else 0.78)
    pw = ph * 2 / 3
    x = (W - pw) / 2 if v else 110
    y = 520 if v else (H - ph) / 2
    outs = f['outs']
    imgs = f'<img id="{sc.sid}-o" class="full" src="assets/{f["orig"]}" alt="">' + ''.join(
        f'<img id="{sc.sid}-a{i}" class="full" src="assets/{img}" alt="" style="clip-path:inset(0 0 0 100%)">' for i, (img, _) in enumerate(outs))
    sc.add(f'<div style="position:absolute;left:{x:.0f}px;top:{y:.0f}px;width:{pw:.0f}px;height:{ph:.0f}px;border-radius:16px;overflow:hidden;box-shadow:0 40px 90px rgba(0,0,0,.5)">{imgs}'
           + ''.join(f'<div id="{sc.sid}-bar{i}" style="position:absolute;top:0;bottom:0;width:6px;left:0;opacity:0;background:{GOLD};box-shadow:0 0 0 1px rgba(0,0,0,.2)"></div>' for i in range(len(outs))) + '</div>')
    chip_y = y + ph + 26
    chip_x = 'left:0;right:0;text-align:center' if v else f'left:{x:.0f}px;width:{pw:.0f}px;text-align:center'
    sc.add(f'<div class="chip" id="{sc.sid}-c" style="{chip_x};top:{chip_y:.0f}px;font-size:{46 if v else 36}px;color:#f3e7d3">המקור</div>')
    for i, (_, lab) in enumerate(outs):
        sc.add(f'<div class="chip" id="{sc.sid}-c{i}" style="{chip_x};top:{chip_y:.0f}px;font-size:{46 if v else 36}px;color:{GOLD};opacity:0">{esc(lab)}</div>')
    first = 1.5
    step = (sc.dur - first - 1.2) / max(1, len(outs))
    prev = f'#{sc.sid}-c'
    for i in range(len(outs)):
        t = first + i * step
        sc.tw(f'tl.fromTo("#{sc.sid}-a{i}", {{clipPath:"inset(0 0 0 100%)"}}, {{clipPath:"inset(0 0 0 0%)", duration:0.85, ease:"power2.inOut"}}, {t:.2f});')
        sc.tw(f'tl.fromTo("#{sc.sid}-bar{i}", {{x:{pw:.0f}, opacity:1}}, {{x:0, opacity:1, duration:0.85, ease:"power2.inOut", immediateRender:false}}, {t:.2f});')
        sc.tw(f'tl.to("#{sc.sid}-bar{i}", {{opacity:0, duration:0.1}}, {t + 0.85:.2f});')
        sc.tw(f'tl.to("{prev}", {{opacity:0, duration:0.15}}, {t + 0.3:.2f});')
        sc.tw(f'tl.fromTo("#{sc.sid}-c{i}", {{opacity:0, filter:"blur(6px)"}}, {{opacity:1, filter:"blur(0px)", duration:0.25}}, {t + 0.45:.2f});')
        prev = f'#{sc.sid}-c{i}'
    size = 104 if v else 96
    if v:
        sc.add(title(sc, f['lines'], f.get('accent'), 0, 200, size, '#fff', align='center', t0=0.3))
    else:
        sc.add(title(sc, f['lines'], f.get('accent'), 120, H * 0.34, size, '#fff', t0=0.3))
    if f.get('badge'):
        by = (200 + size * 2.4) if v else H * 0.34 + size * 2.5
        bpos = 'left:0;right:0;text-align:center' if v else 'right:120px'
        sc.add(f'<div class="chip" id="{sc.sid}-badge" style="{bpos};top:{by:.0f}px;font-size:{40 if v else 34}px;background:{GOLD};color:{INK}"><span>{esc(f["badge"])}</span></div>')
        sc.tw(f'tl.fromTo("#{sc.sid}-badge", {{opacity:0, scale:0.85}}, {{opacity:1, scale:1, duration:0.4, ease:"back.out(1.6)"}}, {first + 0.9:.2f});')


def s_type(sc, f):
    W, H, v = sc.W, sc.H, sc.v
    sc.add(f'<div style="position:absolute;inset:0;background:{CREAM}"></div>')
    # a wifi mark with a strike, drawn as the one icon of the film
    s = 300 if v else 260
    cx, cy = W / 2, H * (0.3 if v else 0.28)
    sc.add(f'<svg id="{sc.sid}-ic" width="{s}" height="{s}" viewBox="0 0 100 100" style="position:absolute;left:{cx - s / 2:.0f}px;top:{cy - s / 2:.0f}px">'
           f'<g fill="none" stroke="{INK}" stroke-width="7" stroke-linecap="round"><path d="M12 40 Q50 8 88 40"/><path d="M25 54 Q50 32 75 54"/><path d="M38 68 Q50 58 62 68"/></g>'
           f'<circle cx="50" cy="80" r="6" fill="{INK}"/><line id="{sc.sid}-x" x1="16" y1="14" x2="84" y2="90" stroke="#b3261e" stroke-width="8" stroke-linecap="round" stroke-dasharray="104" stroke-dashoffset="104"/></svg>')
    sc.tw(f'tl.fromTo("#{sc.sid}-ic", {{opacity:0, scale:0.8}}, {{opacity:1, scale:1, duration:0.4, ease:"expo.out"}}, 0.1);')
    sc.tw(f'tl.to("#{sc.sid}-x", {{attr:{{"stroke-dashoffset":0}}, duration:0.35, ease:"power3.in"}}, 0.7);')
    size = 130 if v else 120
    sc.add(title(sc, f['lines'], f.get('accent'), 0, cy + s * 0.75, size, INK, align='center', t0=1.1, stagger=0.09))


def s_end(sc, f):
    W, H, v = sc.W, sc.H, sc.v
    sc.add(f'<div id="{sc.sid}-flood" style="position:absolute;inset:0;background:{DARK}"></div>')
    ms = 260 if v else 220
    cy = H * (0.33 if v else 0.27)
    sc.add(f'<img id="{sc.sid}-mark" src="assets/icon.svg" alt="" style="position:absolute;left:{W / 2 - ms / 2:.0f}px;top:{cy - ms / 2:.0f}px;width:{ms}px;height:{ms}px">')
    sc.tw(f'tl.fromTo("#{sc.sid}-mark", {{scale:0.2, rotation:-25, opacity:0}}, {{scale:1, rotation:0, opacity:1, duration:0.8, ease:"back.out(1.5)"}}, 0.3);')
    ns = 170 if v else 150
    name = f['name']
    letters = ''.join(f'<span class="w" style="margin:0">{esc(ch) if ch != " " else "&nbsp;"}</span>' for ch in name)
    sc.add(f'<div class="ttl" id="{sc.sid}-name" style="left:0;right:0;text-align:center;top:{cy + ms * 0.62:.0f}px;font-size:{ns}px;color:#fff">{letters}</div>')
    sc.tw(f'tl.fromTo("#{sc.sid}-name .w", {{opacity:0.0, filter:"blur(6px)"}}, {{opacity:1, filter:"blur(0px)", duration:0.25, stagger:0.045}}, 0.85);')
    sy = cy + ms * 0.62 + ns * 1.2
    sc.add(f'<div class="sub" id="{sc.sid}-sub" style="left:0;right:0;text-align:center;top:{sy:.0f}px;font-size:{44 if v else 44}px;color:#e9dcc6">{esc(f["sub"])}</div>')
    sc.tw(f'tl.fromTo("#{sc.sid}-sub", {{opacity:0, filter:"blur(8px)"}}, {{opacity:1, filter:"blur(0px)", duration:0.35}}, 1.6);')
    cy2 = sy + (110 if v else 100)
    fs_ = 56 if v else 50
    sc.add(f'<div class="chip" id="{sc.sid}-cta" style="left:50%;top:{cy2:.0f}px;font-size:{fs_}px;background:linear-gradient(180deg,#e7cd96,{GOLD});color:{INK};box-shadow:0 18px 40px rgba(214,183,126,.28);transform:translateX(-50%)">{esc(f["cta"])}</div>')
    sc.tw(f'tl.fromTo("#{sc.sid}-cta", {{opacity:0, y:30}}, {{opacity:1, y:0, duration:0.5, ease:"expo.out"}}, 2.0);')
    sc.add(f'<div class="sub" id="{sc.sid}-foot" style="left:0;right:0;text-align:center;top:{cy2 + fs_ * 2.2:.0f}px;font-size:{40 if v else 36}px;color:{GOLD};direction:ltr">{esc(f["foot"])}</div>')
    sc.tw(f'tl.fromTo("#{sc.sid}-foot", {{opacity:0}}, {{opacity:1, duration:0.4}}, 2.4);')
    sc.add(f'<div class="sub" style="left:0;right:0;text-align:center;bottom:{90 if v else 34}px;font-size:{22 if v else 18}px;color:rgba(233,220,198,.55);direction:ltr">Music: Kevin MacLeod (incompetech.com) · CC BY 4.0</div>')


BUILD = dict(photo=s_photo, magnet=s_magnet, number=s_number, fan=s_fan, screen=s_screen, styles=s_styles, ai=s_ai, type=s_type, end=s_end)
ENTER = ['iris', 'whip', 'wipe', 'zoom', 'rise']
GROUND = dict(photo=DARK, magnet=DARK, number=CREAM, fan=CREAM, screen=DARK, styles=DARK, ai=DARK, type=CREAM, end=DARK)


def copy_assets(dst):
    a = os.path.join(dst, 'assets')
    for sub in ('fonts', 'real', 'show', 'cap', 'e2e', 'vendor', 'sfx', 'music'):
        os.makedirs(os.path.join(a, sub), exist_ok=True)
    for f in os.listdir(FONTS):
        if f.endswith('.woff2'):
            shutil.copy2(os.path.join(FONTS, f), os.path.join(a, 'fonts', f))
    shutil.copy2(os.path.join(FS, 'vendor', 'gsap', 'gsap.min.js'), os.path.join(a, 'vendor', 'gsap.min.js'))
    shutil.copy2(os.path.join(FS, 'icon.svg'), os.path.join(a, 'icon.svg'))
    for sub, src in (('real', os.path.join(FS, 'media', 'real')), ('show', os.path.join(FS, 'show')), ('cap', CAP), ('e2e', os.path.join(ROOT, 'e2e'))):
        if os.path.isdir(src):
            for f in os.listdir(src):
                shutil.copy2(os.path.join(src, f), os.path.join(a, sub, f))
    for f in ('whoosh.mp3', 'whoosh-short.mp3', 'whoosh-cinematic.mp3', 'pop.mp3', 'riser.mp3', 'impact-bass-1.mp3', 'click-soft.mp3'):
        shutil.copy2(os.path.join(SFX, f), os.path.join(a, 'sfx', f))
    mdir = os.path.join(ROOT, 'music')
    if os.path.isdir(mdir):
        for f in os.listdir(mdir):
            if f.endswith('.m4a'):
                shutil.copy2(os.path.join(mdir, f), os.path.join(a, 'music', f))


def build(name, spec, suffix):
    W, H = SIZES[suffix]
    dst = os.path.join(VID, f'promo-{name}{suffix}')
    os.makedirs(os.path.join(dst, 'compositions'), exist_ok=True)
    copy_assets(dst)
    hosts, audio = [], []
    t = 0.0
    whooshes = ['whoosh-short.mp3', 'whoosh.mp3', 'whoosh-cinematic.mp3']
    for i, (kind, dur, f) in enumerate(spec['scenes']):
        sid = f's{i + 1}-{kind}'
        sc = Scene(sid, W, H, dur, GROUND[kind])
        if i > 0:
            enter(sc, ENTER[(i - 1) % len(ENTER)])
        BUILD[kind](sc, f)
        with open(os.path.join(dst, 'compositions', sid + '.html'), 'w', encoding='utf-8') as fh:
            fh.write(sc.html())
        hosts.append(f'      <div id="{sid}" data-composition-id="{sid}" data-composition-src="compositions/{sid}.html" data-start="{t:.2f}" data-duration="{dur:.2f}" data-track-index="{1 + i % 2}" data-track-kind="graphics" data-width="{W}" data-height="{H}" style="z-index:{i + 1}"></div>')
        if i > 0:
            audio.append(f'      <audio id="sfx-w{i}" class="clip" src="assets/sfx/{whooshes[i % 3]}" data-start="{max(0, t - 0.05):.2f}" data-duration="1.2" data-track-index="11" data-volume="0.55"></audio>')
        if kind == 'fan':
            for j in range(len(f['items'])):
                audio.append(f'      <audio id="sfx-p{i}-{j}" class="clip" src="assets/sfx/pop.mp3" data-start="{t + 0.9 + j * 0.32 + 0.35:.2f}" data-duration="0.3" data-track-index="{12 + 2 * (j % 2)}" data-volume="0.45"></audio>')
        if kind == 'end':
            audio.append(f'      <audio id="sfx-rise" class="clip" src="assets/sfx/riser.mp3" data-start="{max(0, t - 1.6):.2f}" data-duration="1.9" data-track-index="13" data-volume="0.4"></audio>')
            audio.append(f'      <audio id="sfx-hit" class="clip" src="assets/sfx/impact-bass-1.mp3" data-start="{t + 0.45:.2f}" data-duration="1.6" data-track-index="13" data-volume="0.55"></audio>')
        t += dur - OV
    total = round(t + OV, 2)
    music = spec.get('music')
    mfile = os.path.join(ROOT, 'music', f'{music}.m4a')
    if music and os.path.exists(mfile):
        audio.insert(0, f'      <audio id="bgm" class="clip" src="assets/music/{music}.m4a" data-start="0" data-duration="{total:.2f}" data-track-index="10" data-volume="0.8" data-fade-in="0.6" data-fade-out="2.2"></audio>')
    index = f"""<!doctype html>
<html lang="he">
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
    with open(os.path.join(dst, 'package.json'), 'w') as fh:
        json.dump({"name": f"promo-{name}{suffix}", "private": True, "type": "module",
                   "scripts": {"check": "npx --yes hyperframes@0.8.185 check", "render": "npx --yes hyperframes@0.8.185 render"}}, fh, indent=2)
    print(f'promo-{name}{suffix}: {W}x{H}, {total}s, {len(spec["scenes"])} scenes')
    return dst


if __name__ == '__main__':
    import sys
    only = sys.argv[1:] or list(FILMS)
    for n in only:
        for suf in SIZES:
            build(n, FILMS[n], suf)
