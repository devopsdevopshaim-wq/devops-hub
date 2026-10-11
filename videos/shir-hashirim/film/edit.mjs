#!/usr/bin/env node
// Edits the film: one 16:9 HyperFrames project per chapter (film/chapters/chapter-N) from the Veo clips in film/clips/chapter-N.
// The clips are slowed a little to fit each verse, cross-dissolve, and drift in slowly; the verse sits as a subtitle at the bottom.
// The clips' own ambient sound plays under the reading (audio/chapter-N.wav + timing, when there is one).
//   node film/edit.mjs [N]      then   npx hyperframes render film/chapters/chapter-N -o renders/film-N.mp4
import fs from 'node:fs';
import path from 'node:path';
import { chapters, timeline, clipPath, project, INTRO, CLIP } from './common.mjs';

const W = 1920, H = 1080, FADE = 0.8;
const HEB = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח'];
const NUM = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב', 'יג', 'יד', 'טו', 'טז', 'יז'];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const r2 = (x) => Math.round(x * 100) / 100;
const fontSize = (he) => { const n = he.length; return n < 80 ? 54 : n < 150 ? 48 : n < 220 ? 42 : 38; };

function build(ch, dir) {
  const { slots, audio, outroStart, total } = timeline(ch);
  const n = ch.n, title = `פֶּרֶק ${HEB[n - 1]}׳`;
  const ambient = audio ? 0.22 : 0.5;

  // the shots: each verse's slot split among its takes; every shot after the first starts FADE early to dissolve
  const shots = [];
  for (const s of slots) {
    const part = s.dur / s.takes;
    for (let k = 0; k < s.takes; k++) {
      const start = s.start + k * part;
      shots.push({ file: path.basename(clipPath(n, s.i, k)), start, end: start + part });
    }
  }
  shots.forEach((sh, j) => {
    sh.start = r2(j ? sh.start - FADE : sh.start - 1.2);   // the first one fades up from black under the title
    sh.end = r2(j + 1 < shots.length ? sh.end : outroStart + 1.5);
    sh.dur = r2(sh.end - sh.start);
    sh.rate = r2(Math.min(1, (CLIP - 0.15) / sh.dur));
  });

  const videos = shots.map((sh, j) => `
      <div class="shot" id="s${j}"><div class="inner" id="s${j}-in" data-layout-allow-overflow>
        <video id="s${j}-v" src="clips/${sh.file}" data-start="${sh.start}" data-duration="${sh.dur}" data-playback-rate="${sh.rate}" data-track-index="${j % 2}"
          data-volume="${ambient}" data-automation='{"version":1,"lanes":[{"target":"volume","points":[{"t":0,"v":0},{"t":${FADE},"v":1},{"t":${r2(sh.dur - FADE)},"v":1},{"t":${sh.dur},"v":0}]}]}'
          playsinline data-has-audio="true"></video>
      </div></div>`).join('');

  const verses = slots.map((s) => `
      <section id="t${s.i}" class="clip sub" data-start="${s.start}" data-duration="${s.dur}" data-track-index="4">
        <div class="sub-in" id="t${s.i}-in">
          <span class="num">${NUM[s.v.n]}</span>
          <p class="line" style="font-size:${fontSize(s.v.he)}px">${esc(s.v.he)}</p>
        </div>
      </section>`).join('');

  const tw = [];
  shots.forEach((sh, j) => {
    // dissolve in, then a slow push the whole length of the shot (alternating direction so the cut feels alive)
    tw.push(`tl.fromTo("#s${j}", { opacity: 0 }, { opacity: 1, duration: ${j ? FADE : 2}, ease: "none" }, ${sh.start});`);
    tw.push(`tl.fromTo("#s${j}-in", { scale: 1.02, xPercent: ${j % 2 ? 0.8 : -0.8} }, { scale: 1.09, xPercent: ${j % 2 ? -0.8 : 0.8}, duration: ${sh.dur}, ease: "none" }, ${sh.start});`);
  });
  for (const s of slots) {
    tw.push(`tl.fromTo("#t${s.i}-in", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.9, ease: "power2.out" }, ${r2(s.start + 0.3)});`);
    tw.push(`tl.to("#t${s.i}-in", { opacity: 0, duration: 0.5, ease: "power1.in" }, ${r2(s.start + s.dur - 0.55)});`);
  }

  return `<!doctype html>
<html lang="he">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <title>שיר השירים · ${title} · סרט</title>
    <script src="assets/vendor/gsap.min.js"></script>
    <style>
      @font-face { font-family: "Noto Serif Hebrew"; font-weight: 500; src: url("assets/fonts/noto-serif-hebrew-hebrew-500-normal.woff2") format("woff2"); }
      @font-face { font-family: "Noto Serif Hebrew"; font-weight: 700; src: url("assets/fonts/noto-serif-hebrew-hebrew-700-normal.woff2") format("woff2"); }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: #000; }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; background: #000; color: #f6f0e2; font-family: "Noto Serif Hebrew", serif; direction: rtl; }
      .shot { position: absolute; inset: 0; overflow: hidden; }
      .inner { position: absolute; inset: 0; }
      .inner video { width: 100%; height: 100%; object-fit: cover; display: block; }
      .grade { position: absolute; inset: 0; pointer-events: none;
        background: radial-gradient(130% 100% at 50% 40%, rgba(0,0,0,0) 55%, rgba(0,0,0,.55) 100%),
                    linear-gradient(180deg, rgba(0,0,0,0) 52%, rgba(0,0,0,.72) 100%); }
      .sub { position: absolute; inset: 0; display: flex; align-items: flex-end; justify-content: center; padding: 0 200px 92px; }
      .sub-in { width: 100%; max-width: 1480px; text-align: center; }
      .num { display: inline-block; color: #e8c66e; font-weight: 700; font-size: 36px; margin-bottom: 8px; text-shadow: 0 2px 14px rgba(0,0,0,.9), 0 0 3px rgba(0,0,0,.9); }
      .line { line-height: 1.75; font-weight: 500; color: #fbf6ea; text-wrap: balance; text-shadow: 0 2px 18px rgba(0,0,0,.85), 0 0 4px rgba(0,0,0,.7); }
      .card { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; }
      .card-in { width: 100%; }
      .card h1 { font-size: 120px; font-weight: 700; color: #d9b45a; line-height: 1.4; text-shadow: 0 4px 30px rgba(0,0,0,.8); }
      .card h2 { font-size: 60px; font-weight: 500; color: #f4efe4; margin-top: 6px; text-shadow: 0 3px 24px rgba(0,0,0,.8); }
      .card .rule { width: 380px; height: 2px; margin: 26px auto 0; background: linear-gradient(90deg, rgba(217,180,90,0), #d9b45a, rgba(217,180,90,0)); }
      .black { position: absolute; inset: 0; background: #000; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="${W}" data-height="${H}">
${videos}
      <div class="grade"></div>
${audio ? `      <audio id="voice" src="${audio}" data-start="${INTRO}" data-duration="${r2(total - INTRO)}" data-track-index="6" data-volume="1"></audio>\n` : ''}
      <section id="intro" class="clip card" data-start="0" data-duration="${INTRO}" data-track-index="3">
        <div class="card-in" id="intro-in"><h1>שִׁיר הַשִּׁירִים</h1><div class="rule" id="intro-rule"></div><h2>${title}</h2></div>
      </section>
${verses}
      <section id="outro" class="clip card" data-start="${outroStart}" data-duration="${r2(total - outroStart)}" data-track-index="3">
        <div class="black" id="outro-black"></div>
        <div class="card-in" id="outro-in"><h2>סוֹף ${title}</h2><div class="rule"></div></div>
      </section>
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      tl.fromTo("#intro-in", { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 1.4, ease: "power2.out" }, 0.3);
      tl.fromTo("#intro-rule", { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: "power2.inOut" }, 0.9);
      tl.to("#intro-in", { opacity: 0, duration: 0.8, ease: "power1.in" }, ${r2(INTRO - 0.9)});
      ${tw.join('\n      ')}
      tl.fromTo("#outro-black", { opacity: 0 }, { opacity: 1, duration: 1.5, ease: "power1.inOut" }, ${outroStart});
      tl.fromTo("#outro-in", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1.2, ease: "power2.out" }, ${r2(outroStart + 1.2)});
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
}

const only = process.argv[2] ? [Number(process.argv[2])] : chapters.map((c) => c.n);
for (const ch of chapters.filter((c) => only.includes(c.n))) {
  const { slots } = timeline(ch);
  const missing = slots.flatMap((s) => [...Array(s.takes).keys()].map((k) => clipPath(ch.n, s.i, k))).filter((f) => !fs.existsSync(f));
  if (missing.length) { console.log(`chapter ${ch.n}: ${missing.length} clips missing (node film/generate.mjs --chapter ${ch.n}), skipped`); continue; }
  const dir = path.join(project, 'film', 'chapters', `chapter-${ch.n}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'clips'), { recursive: true });
  fs.cpSync(path.join(project, 'assets'), path.join(dir, 'assets'), { recursive: true });
  for (const f of fs.readdirSync(path.dirname(clipPath(ch.n, 0, 0)))) {
    const from = path.join(path.dirname(clipPath(ch.n, 0, 0)), f), to = path.join(dir, 'clips', f);
    try { fs.linkSync(from, to); } catch { fs.copyFileSync(from, to); }
  }
  const audio = fs.existsSync(path.join(project, 'audio')) ? fs.readdirSync(path.join(project, 'audio')).filter((f) => f.startsWith(`chapter-${ch.n}.`)) : [];
  for (const f of audio) { fs.mkdirSync(path.join(dir, 'audio'), { recursive: true }); fs.copyFileSync(path.join(project, 'audio', f), path.join(dir, 'audio', f)); }
  fs.copyFileSync(path.join(project, 'hyperframes.json'), path.join(dir, 'hyperframes.json'));
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ id: `shir-hashirim-film-${ch.n}`, name: `shir-hashirim-film-${ch.n}` }, null, 2) + '\n');
  const html = build(ch, dir);
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  console.log(`film/chapters/chapter-${ch.n}`, html.match(/data-composition-id="main" data-start="0" data-duration="([\d.]+)"/)[1] + 's');
}
