#!/usr/bin/env node
// Writes one HyperFrames project per chapter of Shir HaShirim (chapters/chapter-N/index.html, with its own copy of assets/)
// from the text of the torah-hub site. Each verse is its own clip. Render one with:
//   npx hyperframes render chapters/chapter-1 -o renders/shir-hashirim-1.mp4
// Voice: put audio/chapter-N.wav (or .mp3) and audio/chapter-N.timing.json ([[start, end] per verse, in seconds])
// and run again: the verses follow the reading. Without them, each verse gets a reading-pace estimate.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const text = JSON.parse(fs.readFileSync(path.join(here, '..', '..', 'torah-hub', 'library', 'shir-hashirim.json'), 'utf8'));
const chapters = text.chapters.filter((c) => c.verses);
const HEB = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח'];
const NUM = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב', 'יג', 'יד', 'טו', 'טז', 'יז'];
const W = 1080, H = 1920;
const INTRO = 4.5, OUTRO = 4;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const r2 = (x) => Math.round(x * 100) / 100;

// a calm reading pace: about two thirds of a second a word, plus a breath
const estimate = (he) => Math.max(5.5, he.split(/[\s־]+/).length * 0.68 + 2);
const fontSize = (he) => { const n = he.length; return n < 60 ? 76 : n < 110 ? 66 : n < 170 ? 58 : n < 230 ? 52 : 48; };

function build(ch) {
  const n = ch.n, base = `chapter-${n}`;
  const audio = ['wav', 'mp3', 'm4a'].map((x) => `audio/${base}.${x}`).find((f) => fs.existsSync(path.join(here, f)));
  const timingFile = path.join(here, 'audio', `${base}.timing.json`);
  const timing = audio && fs.existsSync(timingFile) ? JSON.parse(fs.readFileSync(timingFile, 'utf8')) : null;
  if (timing && timing.length !== ch.verses.length) throw new Error(`${timingFile}: ${timing.length} entries, chapter has ${ch.verses.length} verses`);

  // each verse runs from its start until the next one starts (the last one holds a little after the reading)
  let t = INTRO;
  const slots = ch.verses.map((v, i) => {
    if (timing) {
      const start = INTRO + timing[i][0], end = i + 1 < timing.length ? INTRO + timing[i + 1][0] : INTRO + timing[i][1] + 1.2;
      return { v, start: r2(start), dur: r2(end - start) };
    }
    const d = estimate(v.he); const s = { v, start: r2(t), dur: r2(d) }; t += d; return s;
  });
  const last = slots[slots.length - 1];
  const outroStart = r2(last.start + last.dur);
  const total = r2(outroStart + OUTRO);
  const title = `פֶּרֶק ${HEB[n - 1]}׳`;

  const verses = slots.map((s, i) => `
      <section id="v${i + 1}" class="clip verse" data-start="${s.start}" data-duration="${s.dur}" data-track-index="2">
        <div class="verse-in" id="v${i + 1}-in">
          <div class="vnum">${NUM[s.v.n]}</div>
          <p class="vtext" style="font-size:${fontSize(s.v.he)}px">${esc(s.v.he)}</p>
          <div class="vref">שיר השירים ${HEB[n - 1]}, ${NUM[s.v.n]}</div>
        </div>
      </section>`).join('');

  const tweens = slots.map((s, i) => {
    const out = r2(s.start + s.dur - 0.6);
    return `      tl.fromTo("#v${i + 1}-in", { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 0.9, ease: "power2.out" }, ${r2(s.start + 0.05)});
      tl.to("#v${i + 1}-in", { opacity: 0, y: -24, duration: 0.55, ease: "power2.in" }, ${out});
      tl.${i ? 'to' : 'fromTo'}("#bar", ${i ? '' : '{ scaleX: 0 }, '}{ scaleX: ${r2((i + 1) / slots.length)}, duration: 0.8, ease: "power1.inOut" }, ${r2(s.start)});`;
  }).join('\n');

  const breathe = Math.max(0, Math.floor(total / 6) - 1);
  return `<!doctype html>
<html lang="he">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <title>שיר השירים · ${title}</title>
    <script src="assets/vendor/gsap.min.js"></script>
    <style>
      @font-face { font-family: "Noto Serif Hebrew"; font-weight: 500; src: url("assets/fonts/noto-serif-hebrew-hebrew-500-normal.woff2") format("woff2"); }
      @font-face { font-family: "Noto Serif Hebrew"; font-weight: 700; src: url("assets/fonts/noto-serif-hebrew-hebrew-700-normal.woff2") format("woff2"); }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: #050a14; }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; color: #f4efe4; font-family: "Noto Serif Hebrew", serif; direction: rtl; }
      .bg { position: absolute; inset: 0; background:
        radial-gradient(120% 60% at 50% 108%, rgba(217,180,90,.30), rgba(217,180,90,0) 60%),
        radial-gradient(90% 50% at 50% -10%, rgba(64,92,150,.28), rgba(64,92,150,0) 70%),
        linear-gradient(180deg, #071022 0%, #050a14 55%, #0b0a10 100%); }
      .glow { position: absolute; left: 50%; bottom: -260px; width: 1300px; height: 900px; margin-left: -650px; border-radius: 50%;
        background: radial-gradient(closest-side, rgba(240,190,90,.34), rgba(240,190,90,0)); }
      .frame { position: absolute; inset: 44px; border: 2px solid rgba(217,180,90,.55); border-radius: 28px; }
      .frame::after { content: ""; position: absolute; inset: 12px; border: 1px solid rgba(217,180,90,.22); border-radius: 20px; }
      .candles { position: absolute; left: 0; right: 0; bottom: 120px; height: 150px; display: flex; justify-content: center; gap: 120px; }
      .candle { position: relative; width: 26px; height: 120px; margin-top: 30px; border-radius: 5px; background: linear-gradient(90deg, #e9dfc8, #fbf6ea 45%, #d3c6a8); }
      .flame { position: absolute; left: 50%; top: -44px; width: 22px; height: 40px; margin-left: -11px; border-radius: 50% 50% 50% 50% / 62% 62% 38% 38%;
        background: radial-gradient(60% 70% at 50% 70%, #fff6d6, #ffc95c 55%, rgba(255,140,40,0) 100%); transform-origin: 50% 100%; }
      .flame-halo { position: absolute; left: 50%; top: -110px; width: 170px; height: 170px; margin-left: -85px; border-radius: 50%;
        background: radial-gradient(closest-side, rgba(255,200,100,.35), rgba(255,200,100,0)); }
      .head { position: absolute; top: 110px; left: 0; right: 0; text-align: center; }
      .head .book { color: #d9b45a; font-weight: 700; font-size: 44px; letter-spacing: .06em; }
      .head .chap { color: #b4ad9d; font-weight: 500; font-size: 34px; margin-top: 10px; }
      .rule { width: 260px; height: 2px; margin: 26px auto 0; background: linear-gradient(90deg, rgba(217,180,90,0), #d9b45a, rgba(217,180,90,0)); }
      .barwrap { position: absolute; top: 330px; left: 50%; width: 520px; margin-left: -260px; height: 4px; border-radius: 2px; background: rgba(217,180,90,.18); overflow: hidden; }
      #bar { display: block; width: 100%; height: 100%; background: #d9b45a; transform-origin: 100% 50%; }
      .verse { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 380px 120px 330px; }
      .verse-in { width: 100%; max-width: 860px; text-align: center; }
      .vnum { display: inline-flex; align-items: center; justify-content: center; width: 84px; height: 84px; border-radius: 50%;
        border: 2px solid #d9b45a; color: #d9b45a; font-weight: 700; font-size: 38px; margin-bottom: 44px; }
      .vtext { line-height: 1.9; font-weight: 500; color: #f7f1e3; text-wrap: balance; }
      .vref { margin-top: 40px; color: #8f8878; font-size: 28px; }
      .card { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 0 120px 200px; }
      .card-in { width: 100%; }
      .card h1 { font-size: 132px; font-weight: 700; color: #d9b45a; line-height: 1.5; }
      .card h2 { font-size: 72px; font-weight: 500; color: #f4efe4; margin-top: 12px; }
      .card .sub { font-size: 34px; color: #b4ad9d; margin-top: 40px; }
      .card .line { width: 420px; height: 2px; margin: 36px auto 0; background: linear-gradient(90deg, rgba(217,180,90,0), #d9b45a, rgba(217,180,90,0)); transform-origin: 50% 50%; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="${W}" data-height="${H}">
      <div class="bg"></div>
      <div class="glow" id="glow"></div>
      <div class="frame"></div>
      <div class="candles">
        <div class="candle"><div class="flame-halo" id="halo1" data-layout-allow-overflow></div><div class="flame" id="flame1"></div></div>
        <div class="candle"><div class="flame-halo" id="halo2" data-layout-allow-overflow></div><div class="flame" id="flame2"></div></div>
      </div>
${audio ? `      <audio id="voice" src="${audio}" data-start="${INTRO}" data-duration="${r2(total - INTRO)}" data-track-index="5" data-volume="1"></audio>\n` : ''}
      <section id="intro" class="clip card" data-start="0" data-duration="${INTRO}" data-track-index="1">
        <div class="card-in" id="intro-in">
          <h1>שִׁיר הַשִּׁירִים</h1>
          <div class="line" id="intro-line"></div>
          <h2>${title}</h2>
          <div class="sub">קְרִיאָה לְעֶרֶב שַׁבָּת</div>
        </div>
      </section>

      <section id="chrome" class="clip" data-start="${INTRO}" data-duration="${r2(outroStart - INTRO)}" data-track-index="1" style="position:absolute;inset:0">
        <div id="chrome-in" style="position:absolute;inset:0">
          <div class="head"><div class="book">שִׁיר הַשִּׁירִים</div><div class="chap">${title}</div><div class="rule"></div></div>
          <div class="barwrap"><span id="bar"></span></div>
        </div>
      </section>
${verses}

      <section id="outro" class="clip card" data-start="${outroStart}" data-duration="${OUTRO}" data-track-index="1">
        <div class="card-in" id="outro-in">
          <h2>סוֹף ${title}</h2>
          <div class="line"></div>
          <div class="sub">${n < 8 ? `הַבָּא: פֶּרֶק ${HEB[n]}׳` : 'שַׁבָּת שָׁלוֹם'}</div>
        </div>
      </section>
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      // light: the candles breathe for the whole chapter
      tl.fromTo("#glow", { opacity: 0.75 }, { opacity: 1, duration: 3, ease: "sine.inOut", yoyo: true, repeat: ${breathe * 2 + 1} }, 0);
      tl.fromTo(["#flame1", "#flame2"], { scaleY: 0.92, scaleX: 1 }, { scaleY: 1.08, scaleX: 0.94, duration: 0.7, ease: "sine.inOut", yoyo: true, repeat: ${Math.max(1, Math.floor(total / 0.7) - 1)}, stagger: 0.23 }, 0);
      tl.fromTo(["#halo1", "#halo2"], { opacity: 0.7 }, { opacity: 1, duration: 1.1, ease: "sine.inOut", yoyo: true, repeat: ${Math.max(1, Math.floor(total / 1.1) - 1)}, stagger: 0.4 }, 0);
      // opening card
      tl.fromTo("#intro-in", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1.2, ease: "power2.out" }, 0.2);
      tl.fromTo("#intro-line", { scaleX: 0 }, { scaleX: 1, duration: 1.1, ease: "power2.inOut" }, 0.7);
      tl.to("#intro-in", { opacity: 0, y: -30, duration: 0.6, ease: "power2.in" }, ${r2(INTRO - 0.7)});
      tl.fromTo("#chrome-in", { opacity: 0 }, { opacity: 1, duration: 0.8, ease: "power1.out" }, ${INTRO});
${tweens}
      tl.to("#chrome-in", { opacity: 0, duration: 0.6, ease: "power1.in" }, ${r2(outroStart - 0.6)});
      tl.fromTo("#outro-in", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1, ease: "power2.out" }, ${r2(outroStart + 0.1)});
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
}

const only = process.argv[2] ? [Number(process.argv[2])] : chapters.map((c) => c.n);
for (const ch of chapters.filter((c) => only.includes(c.n))) {
  const dir = path.join(here, 'chapters', `chapter-${ch.n}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.cpSync(path.join(here, 'assets'), path.join(dir, 'assets'), { recursive: true });
  const audio = fs.existsSync(path.join(here, 'audio')) ? fs.readdirSync(path.join(here, 'audio')).filter((f) => f.startsWith(`chapter-${ch.n}.`)) : [];
  for (const f of audio) { fs.mkdirSync(path.join(dir, 'audio'), { recursive: true }); fs.copyFileSync(path.join(here, 'audio', f), path.join(dir, 'audio', f)); }
  fs.copyFileSync(path.join(here, 'hyperframes.json'), path.join(dir, 'hyperframes.json'));
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ id: `shir-hashirim-${ch.n}`, name: `shir-hashirim-${ch.n}` }, null, 2) + '\n');
  const html = build(ch);
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  console.log(`chapters/chapter-${ch.n}`, html.match(/data-composition-id="main" data-start="0" data-duration="([\d.]+)"/)[1] + 's');
}
