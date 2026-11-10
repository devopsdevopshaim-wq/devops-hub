#!/usr/bin/env python3
"""Builds the tutorial film "אופטימוס · מדריך": every part of the program, tab by tab, with a real example on screen.

  python3 videos/promo-src/guide.py          -> videos/promo-optimus-guide/   (then: npx hyperframes render)

Sources: optimus-guide/script.json (the narration, Hebrew), optimus-guide/voice/he/<id>.m4a (spoken by the workflow
frame-tts.yml with the free Microsoft voice Hila), optimus-guide/cap/*.webp (the program's screens, capture/cap-guide.cjs),
and examples from the promo captures (cap/) and e2e/. Each scene lasts as long as its narration. The layout, the camera
moves over the screen and the captions come from tutorial.py; this adds a chip naming the part of the program, example
cards that rise over the screen, and the tips card.
"""
import json, os, shutil, subprocess
import build as B
import tutorial as T
from build import esc, GOLD, INK, DARK

ROOT = B.ROOT
G = os.path.join(ROOT, 'optimus-guide')
W, H = T.W, T.H
LEAD, TAIL, OV = T.LEAD, T.TAIL, T.OV
Q, S = 'עבודה מהירה', 'סטודיו עיצוב'

# per scene: chip (the part of the program), head and points, shots (screen, centre x, centre y, zoom) and examples
# (image under assets/, label). 'g-' screens are this film's own captures.
SCENES = {
    'intro': dict(kind='title', img='g-quick-main', he=('אופטימוס · המדריך', 'כל לשונית, עם הסבר ודוגמה')),
    'start': dict(chip='מסך הפתיחה', he=('מתחילים', ['אירוע חדש', 'פתיחת תמונות', 'המשך פרויקט או העיצובים שלי']),
                  shots=[('g-start', .5, .5, 1), ('g-start', .72, .5, 1.7)]),
    'main': dict(chip=Q + ' · ראשי', he=('ראשי', ['תמונות או תיקייה שלמה', 'כל תמונה בכיוון שלה', 'גודל הדפסה ועותקים']),
                 shots=[('g-quick-main', .5, .5, 1), ('g-quick-main', .6, .4, 1.6), ('g-quick-main', .72, .12, 2.2)]),
    'frames': dict(chip=Q + ' · מסגרות', he=('מסגרות', ['מסגרת לאורך', 'מסגרת לרוחב', 'כל אחת על הכיוון שלה']),
                   shots=[('one-frames', .5, .5, 1), ('g-tab-frames', .5, .5, 1)]),
    'edit': dict(chip=Q + ' · ערוך תמונה', he=('ערוך תמונה', ['אחת גדולה או כמה ביחד', 'בהירות, ניגודיות, צבע', 'לחיצה ארוכה: המקור']),
                 shots=[('g-quick-edit', .5, .5, 1), ('g-quick-edit', .9, .45, 2.0)]),
    'design': dict(chip=Q + ' · עורך מלא', he=('עורך מלא', ['טקסט, אימוג׳י ולוגו', 'חיתוך וסיבוב', 'גוררים כל דבר למקום']),
                   shots=[('g-quick-design', .5, .5, 1), ('g-quick-design', .83, .4, 1.9)]),
    'ai': dict(chip=Q + ' · AI', he=('AI ואפקטים', ['גיבורי על וסגנונות', 'אפקטים מצחיקים', 'או במילים שלכם']),
               shots=[('g-quick-ai', .5, .5, 1), ('g-quick-ai', .72, .4, 1.5)],
               ex=[('cap/fun-bighead.jpg', 'ראש גדול'), ('cap/fun-crown.jpg', 'כתר'), ('e2e/anime.png', 'אנימה')]),
    'print': dict(chip=Q + ' · הדפסה', he=('הדפסה', ['מדפסת, נייר, מגנטים בדף', 'רואים את הדף לפני', 'מדפסת שמחברים נבחרת לבד']),
                  shots=[('g-quick-print', .5, .5, 1), ('g-quick-print', .86, .4, 1.9)]),
    'hub': dict(chip=Q + ' · מרכז האירוע', he=('מרכז האירוע', ['מחברים את תיקיית המצלמה', 'מסגרת והדפסה לבד', 'לוח חי של האירוע']),
                shots=[('g-quick-hub', .5, .5, 1), ('hub-auto', .5, .5, 1), ('hub-live', .5, .5, 1)]),
    'studio': dict(chip=S + ' · תמונות', he=('סטודיו העיצוב', ['לשוניות בצד', 'גודל דף ופריסה', 'כל תמונה בגדול']),
                   shots=[('g-tab-photos', .5, .5, 1), ('g-tab-photos', .9, .35, 1.9)]),
    'adjust': dict(chip=S + ' · עריכה', he=('עריכה', ['חשיפה, צבע, חדות', 'יישור והיסטוגרמה', 'לחיצה אחת: על כל התמונות']),
                   shots=[('g-tab-adjust', .5, .5, 1), ('g-tab-adjust', .9, .4, 2.0)]),
    'filters': dict(chip=S + ' · פילטרים', he=('פילטרים', ['מראה מוכן בלחיצה', 'שחור־לבן עד וינטג׳', 'מכוונים עוצמה']),
                    shots=[('g-tab-filters', .5, .5, 1), ('g-tab-filters', .9, .45, 2.0)]),
    'sframes': dict(chip=S + ' · מסגרות', he=('מסגרות בסטודיו', ['שמות ותאריך', 'מסגרות לכל אירוע', 'PNG משלכם']),
                    shots=[('g-tab-frames', .5, .5, 1), ('g-tab-frames', .88, .4, 2.0)]),
    'styles': dict(chip=S + ' · עריכות AI', he=('עריכות AI', ['אנימה, ציור שמן, קומיקס', 'עשרות סגנונות', 'כמה גרסאות לבחירה']),
                   shots=[('g-tab-styles', .5, .5, 1), ('g-tab-styles', .88, .4, 1.9)],
                   ex=[('e2e/original.jpg', 'המקור'), ('e2e/anime.png', 'אנימה'), ('e2e/oil.png', 'ציור שמן')]),
    'tools': dict(chip=S + ' · AI', he=('כלים חכמים', ['הסרת רקע', 'טשטוש רקע ותאורת אולם', 'חידוד והגדלה פי 2']),
                  shots=[('g-tab-ai', .5, .5, 1), ('g-tab-ai', .88, .4, 1.9)],
                  ex=[('cap/ai-orig.jpg', 'המקור'), ('cap/ai-bokeh.jpg', 'טשטוש רקע'), ('cap/ai-hall.jpg', 'תאורת אולם')]),
    'live': dict(chip=S + ' · אירוע חי', he=('אירוע חי', ['האורחים סורקים QR', 'מעלים מהטלפון', 'קיר תמונות באולם']),
                 shots=[('g-tab-live', .5, .5, 1), ('pro-wall', .5, .5, 1)], ex=[('cap/pro-guest.webp', 'בטלפון של האורח')]),
    'collage': dict(chip=S + ' · קולאז׳', he=('קולאז׳', ['לוח מכמה תמונות', 'לב, עיגול, פולארויד', 'מדפיסים כרגיל']),
                    shots=[('g-tab-collage', .5, .5, 1), ('g-tab-collage', .88, .3, 1.9)],
                    ex=[('cap/collage-1.jpg', 'קולאז׳'), ('cap/collage-2.jpg', 'קולאז׳')]),
    'curate': dict(chip=S + ' · בחירה ומצגת', he=('בחירה ומצגת', ['עיניים עצומות וטשטוש', 'בוחרים את הטובות', 'מצגת לסיום הערב']),
                   shots=[('g-tab-curate', .5, .5, 1), ('g-tab-curate', .88, .35, 1.9)]),
    'customers': dict(chip=S + ' · תמונות לקוחות', he=('תמונות לקוחות', ['מה שלקוחות שלחו', 'עם השם והמוצר', 'לעריכה בלחיצה']),
                      shots=[('g-tab-customers', .5, .5, 1), ('g-tab-customers', .88, .3, 1.9)]),
    'output': dict(chip=S + ' · שמירה והדפסה', he=('שמירה והדפסה', ['הדפסה, קבצים, PDF', 'תיקיית אירוע', 'ZIP אחד בסוף הערב']),
                   shots=[('g-tab-output', .5, .5, 1), ('g-tab-output', .88, .4, 1.9)]),
    'tips': dict(kind='tips', he=('שלושה טיפים', [('🖱️', 'עכבר על כפתור: הסבר קצר'), ('⌨️', 'Ctrl+K: חיפוש כל הפעולות'), ('❓', 'סימן שאלה למעלה: המדריך')])),
    'end': dict(kind='end', he=('אופטימוס', 'מגנטים ותמונות לאירועים, במקום אחד', 'שאלות? חיים כאן בשבילכם', 'טלפון / וואטסאפ')),
}


def chip(sc, text, t0=0.3):
    tside, _ = T.side('he')
    sc.add(f'<div class="chip" id="{sc.sid}-step" style="{tside}:80px;top:150px;font-size:28px;background:rgba(214,183,126,.16);color:{GOLD};border:1px solid rgba(214,183,126,.45)">{esc(text)}</div>')
    sc.tw(f'tl.fromTo("#{sc.sid}-step", {{opacity:0, y:-14}}, {{opacity:1, y:0, duration:0.4, ease:"expo.out"}}, {t0:.2f});')


def examples(sc, ex, voice_t, secs):
    """Real results as cards rising over the lower part of the screen, one after another."""
    n = len(ex); ch = 420
    for i, (src, label) in enumerate(ex):
        r = 0.33 if 'guest' in src else 0.667   # width / height
        cw = int(ch * r)
        gap = 26; total = sum(int(ch * (0.33 if 'guest' in s else 0.667)) for s, _ in ex) + gap * (n - 1)
        x0 = 70 + (1120 - total) / 2 + sum(int(ch * (0.33 if 'guest' in s else 0.667)) + gap for s, _ in ex[:i])
        rot = (-4, 2, -1, 3)[i % 4]
        cid = f'{sc.sid}-x{i}'
        sc.add(f'<div id="{cid}" style="position:absolute;left:{x0:.0f}px;top:{360:.0f}px;width:{cw}px;height:{ch}px;border-radius:14px;overflow:hidden;background:#000;'
               f'box-shadow:0 30px 70px rgba(0,0,0,.65),0 0 0 4px #fff;transform:rotate({rot}deg);opacity:0">'
               f'<img class="full" src="assets/{src}" alt="" style="object-fit:cover">'
               f'<div class="chip" style="left:50%;bottom:12px;transform:translateX(-50%);font-size:24px;background:{GOLD};color:{INK};white-space:nowrap">{esc(label)}</div></div>')
        t = voice_t + secs * 0.38 + i * 0.75
        sc.tw(f'tl.fromTo("#{cid}", {{opacity:0, y:80, scale:0.85}}, {{opacity:1, y:0, scale:1, duration:0.6, ease:"back.out(1.5)"}}, {t:.2f});')


def s_screen(sc, lang, f, voice_t, secs):
    head, pts = f[lang]
    sc.add(f'<div style="position:absolute;inset:0;background:radial-gradient(120% 100% at 50% 0%,#221c17 0%,{DARK} 70%)"></div>')
    T.screen_box(sc, lang, f['shots'], voice_t, secs)
    chip(sc, f['chip'])
    T.text_col(sc, lang, None, head, pts)
    T.points_in(sc, len(pts), voice_t, secs)
    if f.get('ex'):
        examples(sc, f['ex'], voice_t, secs)


def s_tips(sc, lang, f, voice_t, secs):
    head, cards = f[lang]
    sc.add(f'<div style="position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 30%,#2a231c 0%,{DARK} 70%)"></div>')
    sc.add(f'<div class="ttl" id="{sc.sid}-h" style="left:0;right:0;text-align:center;top:150px;font-size:96px;color:#fff">{B.words(head)}</div>')
    sc.tw(f'tl.fromTo("#{sc.sid}-h .w", {{opacity:0, filter:"blur(10px)"}}, {{opacity:1, filter:"blur(0px)", duration:0.32, stagger:0.07}}, 0.4);')
    cw, chh, gap = 520, 360, 50
    x0 = (W - 3 * cw - 2 * gap) / 2
    for slot, i in enumerate(range(2, -1, -1)):
        x = x0 + slot * (cw + gap); ic, txt = cards[i]; cid = f'{sc.sid}-c{i}'
        sc.add(f'<div id="{cid}" style="position:absolute;left:{x:.0f}px;top:360px;width:{cw}px;height:{chh}px;border-radius:22px;background:linear-gradient(180deg,#2b241d,#1d1915);'
               f'box-shadow:0 30px 70px rgba(0,0,0,.45),0 0 0 1px rgba(214,183,126,.3);direction:rtl;text-align:center;font-family:Heebo">'
               f'<div style="font-size:96px;margin-top:40px">{ic}</div>'
               f'<div style="font-size:40px;font-weight:600;color:#f3e7d3;margin:20px 30px 0;line-height:1.3">{esc(txt)}</div></div>')
        t = voice_t + 0.3 + i * max(1.2, (secs - 1.5) / 3)
        sc.tw(f'tl.fromTo("#{cid}", {{opacity:0, y:40, scale:0.94}}, {{opacity:1, y:0, scale:1, duration:0.55, ease:"back.out(1.4)"}}, {t:.2f});')


KIND = dict(title=T.s_title, end=T.s_end, screen=s_screen, tips=s_tips)


def build(lang='he'):
    script = json.load(open(os.path.join(G, 'script.json'), encoding='utf-8'))
    rep = json.load(open(os.path.join(G, 'voice', 'report.json'), encoding='utf-8'))
    secs = {s['id']: s['seconds'] for s in rep['langs'][lang]['scenes'] if s.get('seconds')}
    dst = os.path.join(B.VID, 'promo-optimus-guide')
    if os.path.isdir(os.path.join(dst, 'compositions')):
        shutil.rmtree(os.path.join(dst, 'compositions'))
    os.makedirs(os.path.join(dst, 'compositions'), exist_ok=True)
    B.copy_assets(dst)
    a = os.path.join(dst, 'assets')
    for f in os.listdir(os.path.join(G, 'cap')):
        shutil.copy2(os.path.join(G, 'cap', f), os.path.join(a, 'cap', 'g-' + f))
    os.makedirs(os.path.join(a, 'voice'), exist_ok=True)
    hosts, audio, t = [], [], 0.0
    for i, sc_ in enumerate(script['scenes']):
        sid_ = sc_['id']; f = SCENES[sid_]; v = secs[sid_]
        dur = LEAD + v + TAIL + (1.6 if f.get('kind') == 'end' else 0)
        sid = f's{i + 1}-{sid_}'
        sc = T.Sc(sid, dur, lang)
        if i > 0:
            B.enter(sc, ['wipe', 'zoom', 'iris'][i % 3] if f.get('kind') else 'zoom')
        KIND[f.get('kind', 'screen')](sc, lang, f, LEAD, v)
        if f.get('kind') != 'end':
            T.cap_bar(sc, lang, sc_[lang], LEAD, v)
        with open(os.path.join(dst, 'compositions', sid + '.html'), 'w', encoding='utf-8') as fh:
            fh.write(sc.html())
        hosts.append(f'      <div id="{sid}" data-composition-id="{sid}" data-composition-src="compositions/{sid}.html" data-start="{t:.2f}" data-duration="{dur:.2f}" data-track-index="{1 + i % 2}" data-track-kind="graphics" data-width="{W}" data-height="{H}"></div>')
        shutil.copy2(os.path.join(G, 'voice', lang, sid_ + '.m4a'), os.path.join(a, 'voice', sid_ + '.m4a'))
        audio.append(f'      <audio id="vo-{sid_}" class="clip" src="assets/voice/{sid_}.m4a" data-start="{t + LEAD:.2f}" data-duration="{v:.2f}" data-track-index="{20 + i % 2}" data-volume="1"></audio>')
        if i > 0:
            audio.append(f'      <audio id="sfx-w{i}" class="clip" src="assets/sfx/whoosh-short.mp3" data-start="{max(0, t - 0.05):.2f}" data-duration="1.0" data-track-index="11" data-volume="0.22"></audio>')
        t += dur - OV
    total = round(t + OV, 2)
    src = os.path.join(ROOT, 'music', 'src', 'Beauty_Flow.mp3')
    if os.path.exists(src):
        bed = os.path.join(a, 'music', 'bed.m4a')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-stream_loop', '-1', '-ss', '17', '-t', f'{total + 1:.2f}', '-i', src, '-af', f'loudnorm=I=-16:TP=-1.5,afade=t=in:d=1,afade=t=out:st={max(0, total - 3):.2f}:d=3', '-c:a', 'aac', '-b:a', '160k', bed], check=True)
        audio.insert(0, f'      <audio id="bgm" class="clip" src="assets/music/bed.m4a" data-start="0" data-duration="{total:.2f}" data-track-index="10" data-volume="0.11"></audio>')
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
    with open(os.path.join(dst, 'package.json'), 'w') as fh:
        json.dump({"name": "promo-optimus-guide", "private": True, "type": "module",
                   "scripts": {"check": "npx --yes hyperframes@0.8.185 check", "render": "npx --yes hyperframes@0.8.185 render"}}, fh, indent=2)
    print(f'promo-optimus-guide: {W}x{H}, {total}s, {len(script["scenes"])} scenes')
    return dst


if __name__ == '__main__':
    build()
