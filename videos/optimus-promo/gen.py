#!/usr/bin/env python3
"""Builds the Optimus promo in 4 variants: out/<ig|li>-<he|en>/ (ig = 1080x1920 Reels, li = 1080x1080 LinkedIn feed).
One set of scenes, the words per language, the layout per format. See SPEC.md.  python3 gen.py"""
import json, os, re, shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
FPS = 30
SCENES = [('s1', 3.2), ('s2', 3.0), ('s3', 3.2), ('s4', 4.2), ('s5', 5.0), ('s6', 4.0), ('s7', 3.4), ('s8', 3.0), ('s9', 4.0)]

T = {
  'he': dict(dir='rtl', lang='he',
    s1a='ערב חתונה. *21:40*', s1b='והתמונות לא מפסיקות להגיע',
    n1='תמונה חדשה מהרחבה', n1s='שולחן 12 · עכשיו', n2='עוד 3 תמונות', n2s='רחבת הריקודים · עכשיו', n3='אורחת מבקשת מגנט', n3s='עמדת הצילום · עכשיו',
    s2a='{N} אורחים', s2b='כל אחד מחכה למגנט *שלו*',
    s3tag='הסטודיו לצלמי אירועים ולמגנטים',
    s4a='כל התמונות. *תיקון אחד.*', s4b='לפני ואחרי, באותו מסך',
    s5a='מסגרת מתוך *ההזמנה* שלהם', s5b='16 עיצובים. *ה־AI* מעצב,', s5c='אתם בוחרים ועורכים',
    s6a='AI על *האורחים* האמיתיים', s6b='אותם פנים. עולם אחר.', before='לפני', after='אחרי',
    s7a='מודפס וממוסגר.', s7b='*במקום.*',
    s8a='ונשאר *על המקרר*', s8b='הרבה אחרי שהאירוע נגמר',
    s9sub='אופטימוס · הסטודיו לאירועים', cta='נסו עכשיו · פריים מגנטים', phone='054‑4979771'),
  'en': dict(dir='ltr', lang='en',
    s1a='Wedding night. *9:40 PM*', s1b='and the photos keep coming',
    n1='New photo from the dance floor', n1s='Table 12 · now', n2='3 more photos', n2s='Dance floor · now', n3='A guest wants a magnet', n3s='Photo booth · now',
    s2a='{N} guests', s2b='each one waiting for *their* magnet',
    s3tag='The studio for event photo magnets',
    s4a='Every photo. *One fix.*', s4b='before and after, side by side',
    s5a='A frame from *their own* invitation', s5b='16 designs. *AI* draws them,', s5c='you pick and edit',
    s6a='AI on your *real* guests', s6b='Same faces. Another world.', before='Before', after='After',
    s7a='Printed and framed.', s7b='*Right there.*',
    s8a='And it stays *on the fridge*', s8b='long after the party ends',
    s9sub='Optimus · the event studio', cta='Try it now · Frame Magnets', phone='+972 54‑497‑9771'),
}

FONTS = ''.join(
  "@font-face{font-family:'%s';font-weight:%s;font-display:block;src:url('assets/fonts/%s-%s-%s.woff2') format('woff2');unicode-range:%s}" %
  (fam, w, file, w, sub, 'U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F' if sub == 'hebrew' else 'U+0000-00FF, U+0131, U+0152-0153, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212')
  for fam, file, ws in [('Frank Ruhl Libre', 'FrankRuhlLibre', ['500', '700', '900']), ('Heebo', 'Heebo', ['400', '500', '700', '800'])]
  for w in ws for sub in ['hebrew', 'latin'])

BASE_CSS = FONTS + """
#root{position:absolute;inset:0;overflow:hidden;background:#14110F;font-family:Heebo,sans-serif;color:#F4EEE2;direction:{{DIR}}}
#root *{box-sizing:border-box}
.ttl{position:absolute;left:70px;right:70px;text-align:center;font-family:'Frank Ruhl Libre',serif;font-weight:700;line-height:1.14;color:#F4EEE2}
.ttl .ln{display:block}
.ttl .ln span{display:inline-block;padding:0 .06em}
.ttl em{font-style:normal;color:#E3C48A}
.V .ttl{top:230px;font-size:92px}
.S .ttl{top:56px;font-size:64px}
.V .ttl .ln.s{font-size:58px;font-weight:500;margin-top:16px;color:#E9E1D2}
.S .ttl .ln.s{font-size:40px;font-weight:500;margin-top:8px;color:#E9E1D2}
.shadow{box-shadow:0 26px 54px rgba(0,0,0,.5)}
"""

def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def rich(s): return re.sub(r'\*(.+?)\*', r'<em>\1</em>', esc(s))

def title(id_, main, sub=None, extra=''):
  h = '<div class="ttl" id="%s"%s><div class="ln"><span>%s</span></div>' % (id_, extra, rich(main))
  if sub: h += '<div class="ln s"><span>%s</span></div>' % rich(sub)
  return h + '</div>'

def scene(sid, dur, css, body, js):
  return """<template>
<style>@@BASE@@
@@CSS@@</style>
<div id="root" data-composition-id="@@SID@@" data-width="{{W}}" data-height="{{H}}">
@@BODY@@
</div>
<script>
(function(){
var tl = gsap.timeline({ paused: true });
var IN = '{{WIPE_IN}}', OUT = '{{WIPE_OUT}}', SQ = {{SQ}};
function wipe(sel, at, d){ tl.fromTo(sel, { clipPath: IN }, { clipPath: 'inset(0% 0% 0% 0%)', duration: d || 0.45, ease: 'power3.out', stagger: 0.1 }, at); }
function unwipe(sel, at){ tl.to(sel, { clipPath: OUT, duration: 0.3, ease: 'power2.in', stagger: 0.05 }, at); }
@@JS@@
tl.set({}, {}, @@DUR@@);
window.__timelines["@@SID@@"] = tl;
})();
</script>
</template>
""".replace('@@BASE@@', BASE_CSS).replace('@@CSS@@', css).replace('@@BODY@@', body).replace('@@JS@@', js).replace('@@DUR@@', str(dur)).replace('@@SID@@', sid)

PILE = [  # x, y (centre, share of the frame), rotation, photo
  (.22, .30, -9, 'wedding-1'), (.74, .27, 7, 'engagement-1'), (.50, .40, -3, 'barmitzvah-1'), (.18, .55, 6, 'birthday-1'),
  (.80, .52, -6, 'brit-2'), (.48, .62, 4, 'henna-3'), (.26, .78, -5, 'company-3'), (.72, .76, 8, 'holiday-2'),
  (.52, .86, -7, 'birthday-2'), (.14, .92, 5, 'engagement-2'), (.86, .93, -4, 'barmitzvah-2'), (.38, .50, 10, 'wedding-3'),
  (.62, .18, -8, 'birthday-3'), (.30, .16, 5, 'wedding-2')]

def pile_html(prefix):
  return ''.join('<div class="pp" id="%s%d" style="--x:%s;--y:%s;--r:%sdeg"><img src="assets/photos/%s.jpg"></div>' % (prefix, i, x, y, r, f) for i, (x, y, r, f) in enumerate(PILE))

PILE_CSS = """
.pp{position:absolute;left:calc(var(--x)*100%);top:calc(var(--y)*100%);background:#fff;padding:10px 10px 34px;border-radius:4px;box-shadow:0 18px 40px rgba(0,0,0,.55)}
.V .pp{width:330px;margin:-220px 0 0 -165px} .S .pp{width:220px;margin:-150px 0 0 -110px;padding:7px 7px 24px}
.pp img{display:block;width:100%;aspect-ratio:3/4;object-fit:cover}
"""

def build_scenes():
  S = {}
  # 1 · hook: the phone at 21:40, notifications keep coming
  S['s1'] = scene('s1', 3.2, """
#s1-phone{position:absolute;left:50%;background:#0B0B0D;border-radius:72px;padding:26px;box-shadow:0 40px 90px rgba(0,0,0,.6),inset 0 0 0 3px #2A2B30}
.V #s1-phone{top:640px;width:600px;height:1180px;margin-left:-300px} .S #s1-phone{top:300px;width:400px;height:790px;margin-left:-200px;border-radius:52px;padding:18px}
#s1-scr{position:relative;width:100%;height:100%;border-radius:50px;overflow:hidden;background:#000}
.S #s1-scr{border-radius:36px}
#s1-scr img.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
#s1-bar{position:absolute;top:0;left:0;right:0;height:140px;background:linear-gradient(rgba(0,0,0,.55),rgba(0,0,0,0));display:flex;justify-content:center;padding-top:30px;font:800 64px Heebo;color:#fff;direction:ltr}
.S #s1-bar{height:100px;font-size:44px;padding-top:20px}
.nt{position:absolute;left:22px;right:22px;display:flex;gap:18px;align-items:center;padding:18px 22px;border-radius:30px;background:#F4EEE2;color:#1B1A17;box-shadow:0 16px 36px rgba(0,0,0,.45)}
.V .nt{top:170px} .S .nt{top:118px;left:14px;right:14px;padding:12px 14px;gap:12px;border-radius:22px}
.nt img{width:92px;height:92px;border-radius:18px;object-fit:cover;flex:none}
.S .nt img{width:62px;height:62px;border-radius:12px}
.nt b{display:block;font:700 36px/1.2 Heebo} .nt i{display:block;font:500 30px/1.3 Heebo;font-style:normal;color:#5E584E}
.S .nt b{font-size:28px} .S .nt i{font-size:22px}
""", title('s1-t', T_('s1a'), T_('s1b')) + """
<div id="s1-phone"><div id="s1-scr"><img class="bg" src="assets/photos/wedding-2.jpg"><div id="s1-bar">21:40</div>
<div class="nt" id="s1-n3"><img src="assets/photos/henna-3.jpg"><div><b>{{n3}}</b><i>{{n3s}}</i></div></div>
<div class="nt" id="s1-n2"><img src="assets/photos/engagement-1.jpg"><div><b>{{n2}}</b><i>{{n2s}}</i></div></div>
<div class="nt" id="s1-n1"><img src="assets/photos/wedding-3.jpg"><div><b>{{n1}}</b><i>{{n1s}}</i></div></div>
</div></div>""", """
wipe('#s1-t .ln.s span', 0.3);
var step = SQ ? 96 : 140;
tl.fromTo('#s1-n1', { y: -260, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out' }, 0.6);
tl.fromTo('#s1-n2', { y: -260, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out' }, 1.15);
tl.to('#s1-n1', { y: step, duration: 0.45, ease: 'power3.out' }, 1.15);
tl.fromTo('#s1-n3', { y: -260, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out' }, 1.7);
tl.to('#s1-n2', { y: step, duration: 0.45, ease: 'power3.out' }, 1.7);
tl.to('#s1-n1', { y: step * 2, duration: 0.45, ease: 'power3.out' }, 1.7);
tl.fromTo('#s1-phone', { scale: 1 }, { scale: 1.05, duration: 3.2, ease: 'none' }, 0);
""")
  # 2 · tension: the photos burst out of the phone into a pile, 1 -> 100
  S['s2'] = scene('s2', 3.0, PILE_CSS + """
#s2-ph{position:absolute;left:50%;background:#0B0B0D;border-radius:72px;box-shadow:inset 0 0 0 3px #2A2B30}
.V #s2-ph{top:640px;width:600px;height:1180px;margin-left:-300px} .S #s2-ph{top:300px;width:400px;height:790px;margin-left:-200px;border-radius:52px}
#s2-t{z-index:5} .V #s2-t{top:200px}
#s2-t .ln:first-child span{font-size:1.5em;line-height:1}
#s2-plate{position:absolute;inset:0;z-index:4;background:linear-gradient(#14110F 0,rgba(20,17,15,.92) 30%,rgba(20,17,15,0) 46%)}
.S #s2-plate{background:linear-gradient(#14110F 0,rgba(20,17,15,.92) 26%,rgba(20,17,15,0) 40%)}
""", '<div id="s2-ph"></div>' + pile_html('s2-p') + '<div id="s2-plate"></div>' +
      title('s2-t', T_('s2a').replace('{N}', '<em id="s2-num">1</em>'), T_('s2b')), """
tl.fromTo('#s2-ph', { opacity: 1, scale: 1.05 }, { opacity: 0, scale: 0.9, duration: 0.4, ease: 'power2.in' }, 0.25);
var cy = SQ ? 0.64 : 0.64;
document.querySelectorAll('#root .pp').forEach(function (el, i) {
  var x = parseFloat(el.style.getPropertyValue('--x')), y = parseFloat(el.style.getPropertyValue('--y')), r = parseFloat(el.style.getPropertyValue('--r'));
  var W = SQ ? 1080 : 1080, H = SQ ? 1080 : 1920;
  tl.fromTo(el, { x: (0.5 - x) * W, y: (cy - y) * H, rotation: 0, scale: 0.35, opacity: 0 }, { x: 0, y: 0, rotation: r, scale: 1, opacity: 1, duration: 0.6, ease: 'power3.out' }, 0.12 + i * 0.07);
});
var o = { n: 1 }, num = document.getElementById('s2-num');
tl.to(o, { n: 100, duration: 1.9, ease: 'power2.in', onUpdate: function () { num.textContent = Math.round(o.n); } }, 0.2);
wipe('#s2-t .ln.s span', 1.2);
""")
  # 3 · reveal: the shutter closes over the pile and opens on the aperture
  sh = ''.join('<g transform="rotate(%d)"><path class="sh" fill="url(#s3g)" stroke="url(#s3e)" stroke-width=".5" d="M-8 0 L240 -112 L240 112Z"/></g>' % a for a in range(0, 360, 45))
  S['s3'] = scene('s3', 3.2, PILE_CSS + """
#s3-sh{position:absolute;inset:0;width:100%;height:100%;z-index:6}
#s3-logo{position:absolute;left:50%;z-index:2}
.V #s3-logo{top:520px;width:500px;height:500px;margin-left:-250px} .S #s3-logo{top:170px;width:400px;height:400px;margin-left:-200px}
#s3-word{position:absolute;left:0;right:0;text-align:center;font:900 132px/1 'Frank Ruhl Libre',serif;color:#E3C48A;z-index:2}
.V #s3-word{top:1100px} .S #s3-word{top:610px;font-size:104px}
#s3-tag{position:absolute;left:60px;right:60px;text-align:center;font:500 44px/1.3 Heebo;color:#E9E1D2;z-index:2}
.V #s3-tag{top:1270px} .S #s3-tag{top:760px;font-size:36px}
#s3-pile{position:absolute;inset:0;z-index:1}
""", '<div id="s3-pile">' + pile_html('s3-p') + '</div><img id="s3-logo" src="assets/optimus.svg"><div id="s3-word">' + ('אופטימוס' if '{{LANG}}' else '') + '</div><div id="s3-tag">{{s3tag}}</div>' +
      '<svg id="s3-sh" viewBox="-100 -100 200 200" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="s3g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#202127"/><stop offset=".6" stop-color="#141519"/><stop offset="1" stop-color="#0A0B0D"/></linearGradient><linearGradient id="s3e" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFF1C9"/><stop offset=".5" stop-color="#D9B677"/><stop offset="1" stop-color="#7E5E2C" stop-opacity="0"/></linearGradient></defs><g id="s3-shg">' + sh + '</g></svg>', """
tl.fromTo('#root .sh', { x: 250 }, { x: 0, duration: 0.6, ease: 'power2.in' }, 0.1);
tl.fromTo('#s3-shg', { rotation: 30, svgOrigin: '0 0' }, { rotation: 0, svgOrigin: '0 0', duration: 0.6, ease: 'power2.in' }, 0.1);
tl.set('#s3-pile', { opacity: 0 }, 0.75);
tl.to('#root .sh', { x: 250, duration: 0.9, ease: 'power3.out' }, 1.0);
tl.to('#s3-shg', { rotation: -38, svgOrigin: '0 0', duration: 0.9, ease: 'power3.out' }, 1.0);
tl.fromTo('#s3-logo', { rotation: -100, scale: 0.6 }, { rotation: 0, scale: 1, duration: 1.0, ease: 'expo.out' }, 1.0);
wipe('#s3-word', 1.55, 0.6); wipe('#s3-tag', 1.95, 0.5);
""")
  # 4 · proof 1: the real edit screen, a click on ✨ and every "after" brightens
  S['s4'] = scene('s4', 4.2, """
#s4-scr{position:absolute;left:50%;border-radius:22px;overflow:hidden;box-shadow:0 30px 70px rgba(0,0,0,.6),0 0 0 2px #2A2B30}
.V #s4-scr{top:520px;width:940px;height:1319px;margin-left:-470px} .S #s4-scr{top:240px;width:560px;height:786px;margin-left:-280px}
#s4-scr img{position:absolute;inset:0;width:100%;height:100%}
#s4-btn{position:absolute;z-index:3;border-radius:22px;box-shadow:0 20px 40px rgba(0,0,0,.55)}
.V #s4-btn{left:600px;top:1130px;width:340px} .S #s4-btn{left:720px;top:600px;width:280px}
#s4-cur{position:absolute;left:0;top:0;z-index:4;width:84px} .S #s4-cur{width:64px}
""", title('s4-t', T_('s4a'), T_('s4b')) + """
<div id="s4-scr"><img src="assets/cap/edit-col-plain.png"><img id="s4-after" src="assets/cap/edit-col.png"></div>
<img id="s4-btn" src="assets/cap/btn-auto.png">
<svg id="s4-cur" viewBox="0 0 40 52"><path d="M3 2 L3 42 L13 33 L20 49 L27 46 L20 30 L34 30 Z" fill="#fff" stroke="#14110F" stroke-width="2.5" stroke-linejoin="round"/></svg>""", """
wipe('#s4-t .ln span', 0.15);
tl.fromTo('#s4-scr', { scale: 1 }, { scale: 1.05, duration: 4.2, ease: 'none' }, 0);
tl.fromTo('#s4-btn', { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.6)' }, 0.8);
var bx = SQ ? 945 : 885, by = SQ ? 640 : 1175;
tl.fromTo('#s4-cur', { x: 1200, y: SQ ? 1100 : 1900 }, { x: bx, y: by, duration: 0.8, ease: 'power3.out' }, 1.1);
tl.to('#s4-btn', { scale: 0.9, duration: 0.08, yoyo: true, repeat: 1 }, 2.0);
tl.to('#s4-cur', { scale: 0.85, duration: 0.08, yoyo: true, repeat: 1 }, 2.0);
tl.fromTo('#s4-after', { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.8, ease: 'power2.inOut' }, 2.1);
tl.to('#s4-cur', { x: 1300, y: SQ ? 1150 : 2000, duration: 0.6, ease: 'power2.in' }, 3.2);
""")
  # 5 · proof 2: the invitation -> the 16 real AI frames -> the Art Deco one in the real editor
  cells = ''.join('<img class="g" id="s5-g%d" src="assets/frames/f%02d.jpg">' % (i, i + 1) for i in range(16))
  S['s5'] = scene('s5', 5.0, """
#s5-inv{position:absolute;left:50%;z-index:3;border-radius:6px}
.V #s5-inv{top:560px;width:600px;margin-left:-300px} .S #s5-inv{top:250px;width:400px;margin-left:-200px}
#s5-grid{position:absolute;display:grid;grid-template-columns:repeat(4,1fr);direction:ltr}
.V #s5-grid{left:70px;right:70px;top:520px;gap:16px} .S #s5-grid{left:60px;right:60px;top:380px;gap:10px;grid-template-columns:repeat(8,1fr)}
.g{width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:6px;box-shadow:0 10px 24px rgba(0,0,0,.5)}
#s5-big{position:absolute;left:50%;z-index:4;border-radius:8px}
.V #s5-big{top:520px;width:900px;margin-left:-450px} .S #s5-big{top:230px;width:540px;margin-left:-270px}
#s5-ed{position:absolute;left:50%;z-index:5;border-radius:18px;overflow:hidden;box-shadow:0 30px 70px rgba(0,0,0,.6)}
.V #s5-ed{top:520px;width:900px;margin-left:-450px} .S #s5-ed{top:230px;width:540px;margin-left:-270px}
#s5-ed img{display:block;width:100%}
#s5-t2{opacity:1}
""", title('s5-t1', T_('s5a')) + title('s5-t2', T_('s5b'), T_('s5c')) +
      '<img id="s5-inv" class="shadow" src="assets/frames/invitation.jpg"><div id="s5-grid">' + cells + '</div><img id="s5-big" class="shadow" src="assets/frames/f04.jpg"><div id="s5-ed"><img src="assets/cap/fm-edit-crop.png"></div>', """
wipe('#s5-t1 .ln span', 0.1);
tl.fromTo('#s5-inv', { rotation: -10, scale: 1.12, opacity: 0 }, { rotation: -3, scale: 1, opacity: 1, duration: 0.6, ease: 'power3.out' }, 0.15);
tl.to('#s5-inv', { scale: 0.25, x: SQ ? 300 : 330, y: SQ ? -170 : -330, opacity: 0, duration: 0.6, ease: 'power2.inOut' }, 1.5);
tl.set('#s5-t2 .ln span', { clipPath: IN }, 0);
unwipe('#s5-t1 .ln span', 2.1);
wipe('#s5-t2 .ln span', 2.35);
tl.fromTo('#root .g', { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(1.5)', stagger: 0.05 }, 1.7);
tl.fromTo('#s5-big', { opacity: 0, scale: SQ ? 0.2 : 0.25, x: SQ ? -61 : 376, y: SQ ? -172 : -504 }, { opacity: 1, scale: 1, x: 0, y: 0, duration: 0.7, ease: 'expo.inOut' }, 3.3);
tl.to('#root .g', { opacity: 0.18, duration: 0.5 }, 3.3);
tl.fromTo('#s5-ed', { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power1.inOut' }, 4.15);
""")
  # 6 · proof 3: the real couple -> a gold wipe -> the real AI red-carpet result
  S['s6'] = scene('s6', 4.0, """
#s6-card{position:absolute;left:50%;overflow:hidden;border-radius:18px;box-shadow:0 30px 70px rgba(0,0,0,.6)}
.V #s6-card{top:540px;width:820px;height:1200px;margin-left:-410px} .S #s6-card{top:250px;width:540px;height:790px;margin-left:-270px}
#s6-card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
#s6-line{position:absolute;top:0;bottom:0;width:8px;margin-left:-4px;background:linear-gradient(#F3DDA6,#D9B677,#B8904F);left:0;direction:ltr}
.pill{position:absolute;top:28px;padding:10px 26px;border-radius:14px;font:800 36px Heebo}
.S .pill{font-size:26px;padding:8px 18px;top:18px}
#s6-b{background:rgba(12,12,14,.8);color:#fff;inset-inline-start:28px} #s6-a{background:#E3C48A;color:#1A140B;inset-inline-start:28px}
""", title('s6-t', T_('s6a'), T_('s6b')) + """
<div id="s6-card"><img src="assets/ai/before.jpg"><img id="s6-after" src="assets/ai/after.jpg"><div id="s6-line"></div><div class="pill" id="s6-b">{{before}}</div><div class="pill" id="s6-a">{{after}}</div></div>""", """
var rtl = '{{DIR}}' === 'rtl';
wipe('#s6-t .ln:first-child span', 0.1);
tl.set('#s6-t .ln.s span', { clipPath: IN }, 0);
wipe('#s6-t .ln.s span', 2.3);
tl.fromTo('#s6-after', { clipPath: rtl ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.0, ease: 'power2.inOut' }, 1.1);
var cw = SQ ? 540 : 820;
tl.fromTo('#s6-line', { x: rtl ? cw : 0 }, { x: rtl ? 0 : cw, duration: 1.0, ease: 'power2.inOut' }, 1.1);
tl.set('#s6-line', { opacity: 0 }, 2.15);
tl.fromTo('#s6-a', { opacity: 0 }, { opacity: 1, duration: 0.25 }, 2.0);
tl.to('#s6-b', { opacity: 0, duration: 0.2 }, 1.9);
tl.fromTo('#s6-card', { scale: 1 }, { scale: 1.04, duration: 4.0, ease: 'none' }, 0);
""")
  # 7 · output: the print slides out of the printer, two more follow
  S['s7'] = scene('s7', 3.4, """
#s7-pr{position:absolute;left:50%;z-index:5;border-radius:40px;background:linear-gradient(#2C2D33,#17181C);box-shadow:0 30px 60px rgba(0,0,0,.6),inset 0 2px 0 rgba(255,255,255,.08)}
.V #s7-pr{top:470px;width:900px;height:210px;margin-left:-450px} .S #s7-pr{top:200px;width:700px;height:150px;margin-left:-350px;border-radius:30px}
#s7-slot{position:absolute;left:8%;right:8%;bottom:34px;height:16px;border-radius:8px;background:#050506;box-shadow:inset 0 3px 6px rgba(0,0,0,.9)}
.S #s7-slot{bottom:24px;height:12px}
#s7-led{position:absolute;top:40px;inset-inline-end:60px;width:18px;height:18px;border-radius:50%;background:#E3C48A}
.S #s7-led{top:28px;width:14px;height:14px}
#s7-out{position:absolute;left:0;right:0;bottom:0;overflow:hidden;z-index:4}
.V #s7-out{top:650px} .S #s7-out{top:330px}
.pr{position:absolute;left:50%;top:0;background:#fff;padding:14px;box-shadow:0 24px 48px rgba(0,0,0,.45)}
.pr img{display:block;width:100%}
.V .pr{width:600px;margin-left:-300px} .S .pr{width:380px;margin-left:-190px;padding:10px}
#s7-t{z-index:6} .V #s7-t{top:150px;font-size:84px} .S #s7-t{top:40px;font-size:56px}
.S #s7-t .ln.s{display:none}
""", title('s7-t', T_('s7a') + ' ' + T_('s7b')) + """
<div id="s7-out"><div class="pr" id="s7-p3"><img src="assets/frames/f13.jpg"></div><div class="pr" id="s7-p2"><img src="assets/frames/f12.jpg"></div><div class="pr" id="s7-p1"><img src="assets/frames/deco-full.jpg"></div></div>
<div id="s7-pr"><i id="s7-led"></i><i id="s7-slot"></i></div>""", """
wipe('#s7-t .ln span', 0.1);
var H = SQ ? 600 : 960;
tl.fromTo('#s7-p1', { y: -H }, { y: 0, duration: 1.0, ease: 'power2.out' }, 0.3);
tl.fromTo('#s7-p2', { y: -H, x: 0, rotation: 0 }, { y: 0, duration: 0.7, ease: 'power2.out' }, 1.5);
tl.to('#s7-p2', { x: SQ ? -230 : -250, y: SQ ? 30 : 60, rotation: -8, duration: 0.5, ease: 'power3.out' }, 2.2);
tl.fromTo('#s7-p3', { y: -H, x: 0, rotation: 0 }, { y: 0, duration: 0.7, ease: 'power2.out' }, 1.9);
tl.to('#s7-p3', { x: SQ ? 230 : 250, y: SQ ? 40 : 80, rotation: 7, duration: 0.5, ease: 'power3.out' }, 2.62);
tl.fromTo('#s7-led', { opacity: 1 }, { opacity: 0.3, duration: 0.15, yoyo: true, repeat: 7 }, 0.3);
""")
  # 8 · payoff: the magnet snaps onto the fridge
  S['s8'] = scene('s8', 3.0, """
#s8-door{position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 2px,rgba(0,0,0,.03) 2px 5px),linear-gradient(100deg,#E4E5E0,#CFD1CB 45%,#BCBEB8)}
#s8-handle{position:absolute;width:52px;border-radius:26px;background:linear-gradient(90deg,#8E9089,#F2F3EF 45%,#9A9C95);box-shadow:10px 0 24px rgba(0,0,0,.25)}
.V #s8-handle{inset-inline-start:46px;top:560px;height:1000px} .S #s8-handle{inset-inline-start:30px;top:300px;height:640px;width:40px}
.mg{position:absolute;background:#fff;padding:14px;box-shadow:0 14px 26px rgba(0,0,0,.28)}
.mg img{display:block;width:100%}
.V #s8-m{left:50%;top:520px;width:600px;margin-left:-300px} .S #s8-m{left:50%;top:250px;width:420px;margin-left:-210px;padding:10px}
.V #s8-o1{left:120px;top:1290px;width:280px} .V #s8-o2{right:110px;top:1330px;width:300px}
.S #s8-o1{left:110px;top:640px;width:200px} .S #s8-o2{right:90px;top:600px;width:220px}
#s8-t{color:#1B1A17} #s8-t em{color:#8A6428} #s8-t .ln.s{color:#3B3832}
""", '<div id="s8-door"></div><div id="s8-handle"></div>' + title('s8-t', T_('s8a'), T_('s8b')) +
      '<div class="mg" id="s8-o1" style="transform:rotate(-6deg)"><img src="assets/frames/f05.jpg"></div><div class="mg" id="s8-o2" style="transform:rotate(5deg)"><img src="assets/frames/f12.jpg"></div><div class="mg" id="s8-m"><img src="assets/frames/deco-full.jpg"></div>', """
wipe('#s8-t .ln:first-child span', 0.05);
tl.set('#s8-t .ln.s span', { clipPath: IN }, 0);
wipe('#s8-t .ln.s span', 1.2);
tl.fromTo('#s8-m', { scale: 1.18, rotation: -7, opacity: 0 }, { scale: 1, rotation: -2, opacity: 1, duration: 0.5, ease: 'back.out(2.2)' }, 0.3);
""")
  # 9 · end card: the aperture turns open, OPTIMUS wipes in, the CTA lands and holds
  S['s9'] = scene('s9', 4.0, """
#s9-logo{position:absolute;left:50%}
.V #s9-logo{top:420px;width:420px;height:420px;margin-left:-210px} .S #s9-logo{top:120px;width:300px;height:300px;margin-left:-150px}
#s9-word{position:absolute;left:0;right:0;text-align:center;direction:ltr;font:900 118px/1 'Frank Ruhl Libre',serif;letter-spacing:.18em;color:#E3C48A;padding-left:.18em}
.V #s9-word{top:900px} .S #s9-word{top:460px;font-size:92px}
#s9-sub{position:absolute;left:60px;right:60px;text-align:center;font:500 44px/1.3 Heebo;color:#E9E1D2}
.V #s9-sub{top:1050px} .S #s9-sub{top:580px;font-size:34px}
#s9-cta{position:absolute;left:50%;transform:translateX(-50%);white-space:nowrap;padding:26px 54px;border-radius:20px;background:linear-gradient(135deg,#F3DDA6,#D9B677 45%,#B8904F);color:#1A140B;font:800 46px Heebo}
.V #s9-cta{top:1160px} .S #s9-cta{top:670px;font-size:36px;padding:20px 42px}
#s9-ph{position:absolute;left:0;right:0;text-align:center;direction:ltr;font:700 50px Heebo;color:#F4EEE2;letter-spacing:.04em}
.V #s9-ph{top:1310px} .S #s9-ph{top:800px;font-size:40px}
""", """<img id="s9-logo" src="assets/optimus.svg"><div id="s9-word">OPTIMUS</div><div id="s9-sub">{{s9sub}}</div><div id="s9-cta-w"><div id="s9-cta">{{cta}}</div></div><div id="s9-ph">{{phone}}</div>""", """
tl.fromTo('#s9-logo', { rotation: -120, scale: 0.5, opacity: 0 }, { rotation: 0, scale: 1, opacity: 1, duration: 1.0, ease: 'expo.out' }, 0.1);
tl.fromTo('#s9-word', { clipPath: 'inset(0% 50% 0% 50%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.6, ease: 'power3.out' }, 0.75);
wipe('#s9-sub', 1.15, 0.5);
tl.fromTo('#s9-cta-w', { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(1.8)', transformOrigin: '50% 50%' }, 1.45);
wipe('#s9-ph', 1.75, 0.45);
""")
  return S

AUDIO = [  # id, file, start, duration, volume, media start
  ('a-music', 'music/site.m4a', 0, 33.0, 0.8, 0),
  ('a-p1', 'sfx/pop.mp3', 0.6, 0.7, 0.6, 0), ('a-p2', 'sfx/pop.mp3', 1.15, 0.7, 0.6, 0), ('a-p3', 'sfx/pop.mp3', 1.7, 0.7, 0.6, 0),
  ('a-w1', 'sfx/whoosh.mp3', 3.25, 0.57, 0.7, 0), ('a-riser', 'sfx/riser.mp3', 4.4, 2.2, 0.3, 1.2),
  ('a-w2', 'sfx/whoosh-short.mp3', 6.3, 0.57, 0.8, 0), ('a-b1', 'sfx/impact-bass-1.mp3', 7.2, 2.1, 0.8, 0),
  ('a-c1', 'sfx/click-soft.mp3', 11.4, 0.36, 1.0, 0), ('a-w3', 'sfx/whoosh-short.mp3', 15.1, 0.57, 0.6, 0), ('a-p4', 'sfx/pop.mp3', 16.9, 0.7, 0.5, 0),
  ('a-w4', 'sfx/whoosh.mp3', 19.7, 0.57, 0.6, 0), ('a-w5', 'sfx/whoosh-short.mp3', 22.9, 0.57, 0.6, 0), ('a-w6', 'sfx/whoosh-short.mp3', 24.1, 0.57, 0.5, 0),
  ('a-w7', 'sfx/whoosh-short.mp3', 24.5, 0.57, 0.5, 0), ('a-p5', 'sfx/pop.mp3', 26.55, 0.7, 0.8, 0), ('a-b2', 'sfx/impact-bass-1.mp3', 29.1, 2.1, 0.7, 0),
]

def T_(k): return '{{%s}}' % k

def index_html(W, H):
  t, hosts = 0.0, []
  for i, (sid, d) in enumerate(SCENES):
    hosts.append('<div id="%s" data-composition-id="%s" data-composition-src="compositions/%s.html" data-start="%.2f" data-duration="%.2f" data-track-index="1" data-track-kind="graphics" data-width="%d" data-height="%d" style="z-index:%d"></div>' % (sid, sid, sid, t, d, W, H, i + 1))
    t += d
  aud = ''.join('<audio id="%s" class="clip" src="assets/%s" data-start="%.2f" data-duration="%.2f" data-volume="%s" data-media-start="%s" data-track-index="%d"%s></audio>\n' %
                (a, f, s, d, v, m, 10 + i, ' data-fade-in="0.4" data-fade-out="1.2"' if a == 'a-music' else '') for i, (a, f, s, d, v, m) in enumerate(AUDIO))
  return """<!doctype html>
<html lang="{{LANG}}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=%d, height=%d"><script src="assets/vendor/gsap.min.js"></script>
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:%dpx;height:%dpx;overflow:hidden;background:#14110F}#root{position:relative;width:%dpx;height:%dpx;overflow:hidden;background:#14110F}</style></head>
<body><div id="root" data-composition-id="main" data-start="0" data-duration="%.2f" data-width="%d" data-height="%d" data-fps="%d">
%s
%s</div>
<script>window.__timelines = window.__timelines || {}; window.__timelines["main"] = gsap.timeline({ paused: true });</script>
</body></html>
""" % (W, H, W, H, W, H, t, W, H, FPS, '\n'.join(hosts), aud)

def fill(s, words, fmt, W, H):
  rtl = words['dir'] == 'rtl'
  rep = dict(words)
  rep.update(FMT=fmt, W=str(W), H=str(H), SQ='true' if fmt == 'S' else 'false', DIR=words['dir'], LANG=words['lang'],
             WIPE_IN='inset(0% 0% 0% 100%)' if rtl else 'inset(0% 100% 0% 0%)', WIPE_OUT='inset(0% 100% 0% 0%)' if rtl else 'inset(0% 0% 0% 100%)')
  for k in ('s1a', 's1b', 's2a', 's2b', 's4a', 's4b', 's5a', 's5b', 's5c', 's6a', 's6b', 's7a', 's7b', 's8a', 's8b'):
    rep.pop(k, None)
  out = re.sub(r'\.(V|S) ([^{}]+)\{([^{}]*)\}', lambda m: (m.group(2) + '{' + m.group(3) + '}') if m.group(1) == fmt else '', s)
  for k, v in rep.items(): out = out.replace('{{%s}}' % k, esc(v) if k in ('n1', 'n1s', 'n2', 'n2s', 'n3', 'n3s', 's3tag', 'before', 'after', 's9sub', 'cta', 'phone') else v)
  return out

def main():
  scenes = build_scenes()
  for fmt_key, (fmt, W, H) in {'ig': ('V', 1080, 1920), 'li': ('S', 1080, 1080)}.items():
    for lang, words in T.items():
      d = os.path.join(ROOT, 'out', '%s-%s' % (fmt_key, lang))
      if os.path.isdir(d): shutil.rmtree(d)
      os.makedirs(os.path.join(d, 'compositions'))
      os.symlink(os.path.join(ROOT, 'assets'), os.path.join(d, 'assets')) if False else shutil.copytree(os.path.join(ROOT, 'assets'), os.path.join(d, 'assets'), copy_function=os.link)
      for f in ('hyperframes.json', 'package.json'): shutil.copy(os.path.join(ROOT, f), d)
      json.dump({'id': 'optimus-%s-%s' % (fmt_key, lang), 'name': 'Optimus promo %s %s' % (fmt_key, lang)}, open(os.path.join(d, 'meta.json'), 'w'))
      # the titles, written per language (rich text) before the rest of the words
      for sid, html in scenes.items():
        h = html
        for k in ('s1a', 's1b', 's2a', 's2b', 's4a', 's4b', 's5a', 's5b', 's5c', 's6a', 's6b', 's7a', 's7b', 's8a', 's8b'):
          h = h.replace(rich('{{%s}}' % k), rich(words[k])).replace('{{%s}}' % k, rich(words[k]))
        if sid == 's2':
          h = h.replace(rich(words['s2a']), rich(words['s2a']).replace('{N}', '<em id="s2-num">1</em>'))
        if sid == 's3':
          h = h.replace('>אופטימוס<', '>%s<' % ('אופטימוס' if lang == 'he' else 'Optimus'))
        open(os.path.join(d, 'compositions', sid + '.html'), 'w').write(fill(h, words, fmt, W, H))
      open(os.path.join(d, 'index.html'), 'w').write(fill(index_html(W, H), words, fmt, W, H))
      print('built', d)

if __name__ == '__main__':
  main()
