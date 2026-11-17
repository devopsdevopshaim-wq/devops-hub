// Builds index.html from scenes.mjs: an intro, one scene per screenshot (camera moves to each caption's region, the region
// lit), an outro, a progress bar and the music bed. node build.mjs
import fs from 'node:fs';
import { SCENES } from './scenes.mjs';

const VW = 1180, VH = 663.75, FX = 70, FY = 196;
const INTRO = 10, LINE = 5.3, HEAD = 2.4, TAIL = 1.2, XF = 0.7, OUTRO = 12;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r2 = (v) => Math.round(v * 1000) / 1000;

function cam(r) {
  const [x, y, w, h] = r, cx = (x + w / 2) / 100 * VW, cy = (y + h / 2) / 100 * VH;
  let z = Math.min(VW / (w / 100 * VW * 1.3), VH / (h / 100 * VH * 1.3));
  z = Math.max(1, Math.min(1.9, z));
  const tx = Math.min(0, Math.max(VW - VW * z, VW / 2 - cx * z)), ty = Math.min(0, Math.max(VH - VH * z, VH / 2 - cy * z));
  return { x: r2(tx), y: r2(ty), scale: r2(z) };
}

let t = INTRO - XF, html = '', js = '';
const times = [];
SCENES.forEach((s, k) => {
  const D = HEAD + s.lines.length * LINE + TAIL, T = r2(t);
  times.push([T, D]);
  html += `
    <section class="clip scene" id="s${k}" data-start="${T}" data-duration="${r2(D)}" data-track-index="${1 + (k % 2)}">
      <div class="frame"><div class="vp"><div class="cam" id="cam${k}"><img src="assets/shots/${s.shot}.png" alt="">
        ${s.lines.map((l, i) => `<div class="hl" id="hl${k}_${i}" style="left:${l.r[0]}%;top:${l.r[1]}%;width:${l.r[2]}%;height:${l.r[3]}%"></div>`).join('')}
      </div></div></div>
      <div class="side">
        <div class="chip">${esc(s.chip).replace(/(\d+(?:\.\d+)?)×(\d+(?:\.\d+)?)/g, '<bdi dir="ltr">$1×$2</bdi>')}</div>
        <h2>${esc(s.title).replace(/(\d+(?:\.\d+)?)×(\d+(?:\.\d+)?)/g, '<bdi dir="ltr">$1×$2</bdi>')}</h2>
        <ol class="lines">${s.lines.map((l, i) => `<li id="ln${k}_${i}"><span class="n">${i + 1}</span><span class="t">${esc(l.t).replace(/&quot;([^&]+?)&quot;/g, '<span class="k">$1</span>').replace(/(\d+(?:\.\d+)?)×(\d+(?:\.\d+)?)/g, '<bdi dir="ltr">$1×$2</bdi>')}</span></li>`).join('')}</ol>
      </div>
    </section>`;
  /* in: the frame rises, the side slides; each line: the camera, the light, the text */
  js += `
  tl.fromTo('#s${k}', { opacity: 0 }, { opacity: 1, duration: ${XF}, ease: 'power1.out' }, ${T});
  tl.fromTo('#s${k} .frame', { y: 26, scale: 0.985 }, { y: 0, scale: 1, duration: 1.0, ease: 'power3.out' }, ${T});
  tl.fromTo('#s${k} .chip', { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: 0.6, ease: 'power3.out' }, ${r2(T + 0.25)});
  tl.fromTo('#s${k} h2', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, ${r2(T + 0.4)});
  tl.set('#s${k} li', { opacity: 0 }, ${T});
  tl.set('#s${k} .hl', { opacity: 0 }, ${T});
  tl.set('#cam${k}', { x: 0, y: 0, scale: 1 }, ${T});`;
  s.lines.forEach((l, i) => {
    const at = r2(T + HEAD + i * LINE - 0.6), c = cam(l.r);
    if (i > 0) js += `
  tl.to('#ln${k}_${i - 1}', { opacity: 0.42, duration: 0.4 }, ${at});
  tl.to('#hl${k}_${i - 1}', { opacity: 0, duration: 0.4 }, ${at});`;
    js += `
  tl.to('#cam${k}', { x: ${c.x}, y: ${c.y}, scale: ${c.scale}, duration: 1.3, ease: 'power2.inOut' }, ${at});
  tl.fromTo('#ln${k}_${i}', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out' }, ${r2(at + 0.25)});
  tl.fromTo('#hl${k}_${i}', { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power1.out' }, ${r2(at + 0.9)});`;
  });
  const end = r2(T + D - TAIL);
  js += `
  tl.to('#hl${k}_${s.lines.length - 1}', { opacity: 0, duration: 0.5 }, ${end});
  tl.to('#cam${k}', { x: 0, y: 0, scale: 1, duration: 1.0, ease: 'power2.inOut' }, ${end});`;
  t = T + D - XF;
});
const OT = r2(t), TOTAL = r2(OT + OUTRO);

const MODES = [['✂️', 'עריכת מגנטים'], ['🤖', 'עיצובי AI'], ['📸', 'עמדת צילום'], ['📱', 'QR לאפליקציה'], ['🎞️', 'סטריפים'], ['⚙️', 'הגדרות']];
const tiles = MODES.map((m, i) => `<div class="tile" id="TI${i}"><span>${m[0]}</span><b>${m[1]}</b></div>`).join('');
const tiles2 = MODES.map((m, i) => `<div class="tile" id="TO${i}"><span>${m[0]}</span><b>${m[1]}</b></div>`).join('');

const page = `<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <link rel="stylesheet" href="assets/fonts.css" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      :root { --ground: #0f0e10; --panel: #19171b; --ink: #f4efe7; --dim: #b9b1a5; --gold: #d9b878; --gold2: #f0d9a6; --line: rgba(217,184,120,.35);
        --font-body: 'Heebo', sans-serif; --font-display: 'Frank Ruhl Libre', 'Heebo', serif; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1920px; height: 1080px; overflow: hidden; background: var(--ground); }
      #root { position: relative; width: 1920px; height: 1080px; overflow: hidden; font-family: var(--font-body); color: var(--ink); direction: rtl;
        background: radial-gradient(1200px 700px at 85% -10%, rgba(217,184,120,.16), transparent 60%), radial-gradient(900px 600px at 0% 110%, rgba(140,90,160,.14), transparent 60%), var(--ground); }
      .clip { position: absolute; inset: 0; }
      .brand { position: absolute; top: 46px; left: 70px; right: auto; bottom: auto; inset: 46px auto auto 70px; font: 700 30px var(--font-display); color: var(--gold); letter-spacing: .02em; z-index: 5; }
      .brand small { font: 400 28px var(--font-body); color: var(--dim); margin-inline-start: 10px; }
      .bar { position: absolute; left: 0; right: 0; bottom: 0; height: 6px; background: rgba(255,255,255,.06); z-index: 5; }
      .bar i { position: absolute; top: 0; bottom: 0; right: 0; width: 100%; background: linear-gradient(270deg, var(--gold2), var(--gold)); transform-origin: 100% 50%; transform: scaleX(0); }
      .scene .frame { position: absolute; left: ${FX}px; top: ${FY}px; width: ${VW}px; height: ${VH}px; border-radius: 22px; padding: 0; background: #000;
        box-shadow: 0 0 0 1px var(--line), 0 40px 90px -30px rgba(0,0,0,.9), 0 0 120px -40px rgba(217,184,120,.35); overflow: hidden; }
      .scene .vp { position: absolute; inset: 0; overflow: hidden; border-radius: 22px; }
      .scene .cam { position: absolute; left: 0; top: 0; width: ${VW}px; height: ${VH}px; transform-origin: 0 0; }
      .scene .cam img { display: block; width: 100%; height: 100%; }
      .scene .hl { position: absolute; border: 3px solid var(--gold2); border-radius: 12px; box-shadow: 0 0 0 4000px rgba(8,7,9,.42), 0 0 26px rgba(240,217,166,.75); }
      .scene .side { position: absolute; right: 70px; top: ${FY}px; width: 560px; height: ${VH}px; display: flex; flex-direction: column; gap: 22px; }
      .chip { align-self: flex-start; padding: 8px 18px; border-radius: 999px; border: 1px solid var(--line); background: rgba(217,184,120,.1); color: var(--gold2); font: 600 24px var(--font-body); }
      .scene h2 { font: 700 54px/1.15 var(--font-display); color: var(--ink); }
      .lines { list-style: none; display: flex; flex-direction: column; gap: 18px; margin-top: 6px; }
      .lines li { display: flex; gap: 16px; align-items: flex-start; font: 500 33px/1.38 var(--font-body); color: var(--ink); }
      .lines .n { flex: none; width: 44px; height: 44px; margin-top: 3px; border-radius: 50%; display: grid; place-items: center; background: linear-gradient(180deg, var(--gold2), var(--gold)); color: #1a140b; font: 800 22px var(--font-body); }
      .lines .t { flex: 1; }
      .k { unicode-bidi: isolate; display: inline-block; padding: 0 12px; margin: 0 2px; border-radius: 10px; background: rgba(217,184,120,.16); border: 1px solid var(--line); color: var(--gold2); font-weight: 600; line-height: 1.3; }
      #intro, #outro { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 26px; }
      .big { font: 700 170px/1 var(--font-display); background: linear-gradient(180deg, #fff3d6, var(--gold) 70%, #9c7a3c); -webkit-background-clip: text; background-clip: text; color: transparent; }
      .sub { font: 400 40px var(--font-body); color: var(--dim); max-width: 1400px; }
      .tiles { display: flex; gap: 22px; margin-top: 26px; direction: rtl; }
      .tile { width: 230px; height: 180px; border-radius: 24px; border: 1px solid var(--line); background: linear-gradient(180deg, #221f25, #161418);
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; box-shadow: 0 24px 50px -24px rgba(0,0,0,.9); }
      .tile span { font-size: 64px; line-height: 1; }
      .tile b { font: 700 28px var(--font-body); color: var(--ink); }
      .end1 { font: 700 96px var(--font-display); color: var(--ink); }
      .end2 { font: 400 36px var(--font-body); color: var(--gold2); }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${TOTAL}" data-width="1920" data-height="1080">
      <section class="clip" id="intro" data-start="0" data-duration="${INTRO}" data-track-index="1">
        <div class="big" id="I1">אופטימוס</div>
        <div class="sub" id="I2">המדריך המלא לסטודיו: מגנטים, עיצובי AI, עמדת צילום, סטריפים ועוד</div>
        <div class="tiles">${tiles}</div>
      </section>
      ${html}
      <section class="clip" id="outro" data-start="${OT}" data-duration="${OUTRO}" data-track-index="1">
        <div class="end1" id="O1">מוכנים לאירוע ✨</div>
        <div class="tiles">${tiles2}</div>
        <div class="end2" id="O2">אופטימוס · פריים מגנטים · שאלות? לחצן העזרה בסטודיו</div>
      </section>
      <div class="clip brand" id="brand" data-start="${INTRO - XF}" data-duration="${r2(OT - INTRO + XF + 0.5)}" data-track-index="4">אופטימוס<small>· מדריך</small></div>
      <div class="clip bar" id="bar" data-start="0" data-duration="${TOTAL}" data-track-index="5" style="inset:auto 0 0 0"><i id="barfill"></i></div>
      <audio id="bgm" class="clip" src="assets/audio/bgm.mp3" data-start="0" data-duration="${TOTAL}" data-track-index="9" data-volume="0.85" data-fade-out="4"></audio>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      tl.fromTo('#barfill', { scaleX: 0 }, { scaleX: 1, duration: ${TOTAL}, ease: 'none' }, 0);
      tl.fromTo('#I1', { opacity: 1, y: 30, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 1.4, ease: 'power3.out' }, 0.4);
      tl.fromTo('#I2', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1.0, ease: 'power2.out' }, 1.4);
      tl.fromTo('#intro .tile', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.7, ease: 'back.out(1.6)', stagger: 0.18 }, 2.4);
      tl.to('#intro', { opacity: 0, duration: ${XF} }, ${INTRO - XF});
      tl.fromTo('#brand', { opacity: 0 }, { opacity: 1, duration: 0.8 }, ${INTRO});
      ${js}
      tl.fromTo('#outro', { opacity: 0 }, { opacity: 1, duration: ${XF} }, ${OT});
      tl.fromTo('#O1', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1.0, ease: 'power3.out' }, ${r2(OT + 0.4)});
      tl.fromTo('#outro .tile', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6, ease: 'back.out(1.6)', stagger: 0.14 }, ${r2(OT + 1.2)});
      tl.fromTo('#O2', { opacity: 0 }, { opacity: 1, duration: 1.0 }, ${r2(OT + 2.6)});
      tl.to('#outro', { opacity: 0, duration: 1.2 }, ${r2(TOTAL - 1.2)});
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
`;
fs.writeFileSync('index.html', page);
console.log('total', TOTAL, 'scenes', times.length);
