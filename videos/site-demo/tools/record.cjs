// Records the live portfolio UI (served from ../../portfolio on :8950, real data from data/real.json) as screen-recording clips.
// usage: SS=outdir node record.cjs [sceneName...]
const fs = require('fs'), path = require('path'), cp = require('child_process');
const { chromium } = require(cp.execSync('npm root -g').toString().trim() + '/playwright');
const ROOT = path.resolve(__dirname, '..');
const real = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/real.json'), 'utf8'));
const news = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/news.json'), 'utf8')); news.feeds.main = news.feeds.tech.slice(0, 12); // only the technology feed goes on film
const OUT = process.env.SS || path.join(ROOT, 'clips');
const J = (o) => ({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify(o) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const COMM = { 'Rashi on ': 1, 'Ramban on ': 1, 'Ibn Ezra on ': 1, 'Sforno on ': 1, 'Or HaChaim on ': 1, 'Kli Yakar on ': 1, 'Rashbam on ': 1, 'Chizkuni, ': 1, 'Rabbeinu Bahya, ': 1 };
function v3(url) {
  const ref = decodeURIComponent(url.split('/api/v3/texts/')[1].split('?')[0]);
  for (const k of Object.keys(real.comm)) {
    const want = k + (k.indexOf('Bahya') >= 0 ? real.verse.replace('Genesis', 'Bereshit') : real.verse);
    if (ref === want) return real.comm[k];
  }
  const t = real.talmud.find((x) => x.ref === ref); if (t) return t.text;
  return { versions: [] };
}

async function mocks(page) {
  await page.route('**/*', async (r) => {
    const u = r.request().url();
    if (/localhost:8950/.test(u)) {
      if (/\/js\/auth\.js/.test(u)) return r.fulfill({ contentType: 'text/javascript', body: "window.HasadnaAuth={ready:Promise.resolve({role:'admin',sites:'all',name:'חיים'}),token:function(){return 'T'},session:{role:'admin'},api:function(){return Promise.resolve({})},logout:function(){}};document.documentElement.classList.remove('locked');" });
      if (/\/js\/(orbit-fx|cursor|track|talking-face)\.js/.test(u)) return r.fulfill({ contentType: 'text/javascript', body: '' });
      if (/\/projects\.json/.test(u)) {   // every number in the film is the real one; the lotto tab and the private insurance analysis are only hidden from view (see HIDE below)
        const d = JSON.parse(fs.readFileSync(path.resolve(ROOT, '../../portfolio/projects.json'), 'utf8'));
        fs.writeFileSync(path.join(ROOT, 'data/counts.json'), JSON.stringify({ projects: d.projects.length, domains: Object.keys(d.categories).length }));
        return r.fulfill(J(d));
      }
      if (/\/api\.json/.test(u)) return r.fulfill(J({ base: 'https://w.example' }));
      if (/\/news\.json/.test(u)) return r.fulfill(J(news));
      if (/\/radio\.json/.test(u)) return r.fulfill(J({ genres: [{ id: 'trance', style: 'טראנס', stations: [{ name: 'x', url: 'https://x.example/s' }] }, { id: 'ambient', style: 'אמביינט', stations: [{ name: 'y', url: 'https://y.example/s' }] }, { id: 'il', style: 'תחנות רדיו ישראליות', stations: [{ name: 'z', url: 'https://z.example/s' }] }] }));
      return r.continue();
    }
    if (/w\.example\/hasadna-layout/.test(u)) return r.fulfill(J({ ok: true, layout: null }));
    if (/w\.example\/hasadna-guide/.test(u)) return r.fulfill(J({ answer: 'אפשר לבנות לעסק שלך אתר מקצועי, מערכת להצעות מחיר, עוזר משרד חכם שעונה ללקוחות בכל שעה, ואוטומציות שחוסכות שעות עבודה כל שבוע. רוצה שנקבע שיחה קצרה עם חיים?', project: 'smart-office-assistant', next: ['כמה זה עולה?', 'לקבוע שיחה'] }));
    if (/hebcal\.com\/shabbat/.test(u)) return r.fulfill(J(real.shabbat));
    if (/hebcal\.com\/zmanim/.test(u)) return r.fulfill(J(real.zmanim));
    if (/hebcal\.com\/hebcal/.test(u)) return r.fulfill(J(real.daf));
    if (/sefaria\.org\/api\/v3/.test(u)) return r.fulfill(J(v3(u)));
    if (/sefaria\.org\/api\/related/.test(u)) return r.fulfill(J({ links: real.talmud.map((t) => ({ category: 'Talmud', sourceRef: t.ref, sourceHeRef: t.he })) }));
    if (/^(data|blob):/.test(u)) return r.continue();
    return r.abort();
  });
  await page.addInitScript(() => {
    // a visible pointer for the film (the headless browser draws none), and a ripple on every click
    const st = document.createElement('style');
    st.textContent = '#reel{display:none!important}[data-cat="lotto"],.card.cat-lotto,#p-insurance-analysis{display:none!important}.scene,.future-bg{display:none!important}.cur-dot,.cur-ring{display:none!important}#__ptr{position:fixed;z-index:2147483647;left:0;top:0;width:26px;height:26px;margin:-4px 0 0 -4px;pointer-events:none;transition:transform .06s linear;filter:drop-shadow(0 3px 5px rgba(0,0,0,.6))}#__rip{position:fixed;z-index:2147483646;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;border:3px solid #f3d596;pointer-events:none;opacity:0}#__rip.go{animation:__r .55s ease-out}@keyframes __r{from{opacity:.95;transform:scale(.4)}to{opacity:0;transform:scale(3.4)}}';
    document.addEventListener('DOMContentLoaded', () => {
      document.head.appendChild(st);
      new MutationObserver(() => document.querySelectorAll('option').forEach((o) => { if (o.textContent.trim() === 'לוטו') o.remove(); })).observe(document.body, { childList: true, subtree: true });
      const p = document.createElement('div'); p.id = '__ptr'; p.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2l15 9-6.5 1.7L9.5 20z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>';
      const r = document.createElement('div'); r.id = '__rip'; document.body.append(p, r);
      addEventListener('mousemove', (e) => { p.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; }, true);
      addEventListener('mousedown', () => { r.classList.remove('go'); void r.offsetWidth; r.classList.add('go'); }, true);
    });
  });
}

let browser;
async function record(name, scene, opts = {}) {
  const dir = path.join(OUT, name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1, locale: 'he-IL', timezoneId: 'Asia/Jerusalem' });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date(opts.time || '2026-10-28T10:07:30+02:00') });
  await mocks(page);
  page.on('dialog', async (d) => { if (d.type() === 'prompt') await d.accept(opts.prompt || 'לקוחות VIP'); else await d.accept(); });
  await page.goto('http://localhost:8950/index.html?scene=aurora'); await page.waitForSelector('.tile'); await sleep(2200);
  if (!opts.maya) await page.addStyleTag({ content: '.guide .g-bubble{display:none!important}' });
  await page.waitForSelector('.cats-toggle', { state: 'visible' }); await page.waitForSelector('.guide .g-face', { state: 'visible', timeout: 60000 }); await page.waitForSelector('#comm-open'); await sleep(600);
  if (opts.before) await opts.before(page);
  MARKS = []; const cdp = await ctx.newCDPSession(page); const frames = [];
  cdp.on('Page.screencastFrame', async (f) => { frames.push({ t: f.metadata.timestamp, data: f.data }); try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch (e) {} });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1280, maxHeight: 960, everyNthFrame: 1 });
  await sleep(300);
  await scene(page);
  await sleep(500);
  await cdp.send('Page.stopScreencast');
  await ctx.close();
  // frames are only delivered when the picture changes: rebuild a constant 30 fps clip from their timestamps
  let list = '';
  frames.forEach((f, i) => { const fn = String(i).padStart(5, '0') + '.jpg'; fs.writeFileSync(path.join(dir, fn), Buffer.from(f.data, 'base64')); const d = i + 1 < frames.length ? frames[i + 1].t - f.t : 0.1; list += `file '${fn}'\nduration ${Math.max(0.001, d).toFixed(4)}\n`; });
  list += `file '${String(frames.length - 1).padStart(5, '0')}.jpg'\n`;
  fs.writeFileSync(path.join(dir, 'list.txt'), list);
  const t0 = frames.length ? frames[0].t : 0;
  fs.writeFileSync(path.join(OUT, name + '.marks.json'), JSON.stringify(MARKS.map((m) => ({ n: m.n, t: +(m.w - t0).toFixed(2) }))));
  const out = path.join(OUT, name + '.mp4');
  cp.execSync(`ffmpeg -y -loglevel error -f concat -safe 0 -i ${dir}/list.txt -vf "fps=30,scale=1280:960,format=yuv420p" -c:v libx264 -preset slow -crf 17 -movflags +faststart ${out}`);
  const dur = cp.execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 ${out}`).toString().trim();
  console.log(name, frames.length, 'frames', dur + 's');
  fs.rmSync(dir, { recursive: true, force: true });
}

const mv = async (page, sel, o = {}) => {
  const b = await page.locator(sel).first().boundingBox(); if (!b) throw new Error('no box ' + sel);
  await page.mouse.move(b.x + b.width * (o.fx ?? 0.5), b.y + b.height * (o.fy ?? 0.5), { steps: o.steps || 16 });
};
let MARKS = [];
const mark = (n) => MARKS.push({ n, w: Date.now() / 1000 });
const T0 = Date.now(); const lg = (m) => console.log(((Date.now() - T0) / 1000).toFixed(1) + 's', m);
const click = async (page, sel, o) => { lg('click ' + sel); await mv(page, sel, o); await sleep(180); await page.mouse.down(); await sleep(70); await page.mouse.up(); };

const SCENES = {
  async overview(page) {
    await page.mouse.move(640, 600, { steps: 2 }); await sleep(900);
    mark('parsha'); await mv(page, '.td-chipwrap[data-k="p"] .td-pill'); await sleep(2600);
    mark('clock'); await mv(page, '.td-chipwrap[data-k="c"] .td-pill', { steps: 22 }); await sleep(2800);
    await page.mouse.move(700, 640, { steps: 24 }); await sleep(1100);
  },
  async domains(page) {
    await sleep(500);
    mark('open'); await click(page, '.cats-toggle'); await sleep(1300);
    mark('ai'); await click(page, '.tile[data-cat="ai"]'); await sleep(1900);
    mark('tools'); await click(page, '.tile[data-cat="tools"]'); await sleep(1900);
    await page.mouse.wheel(0, 380); await sleep(1500);
    await click(page, '.tile[data-cat="all"]'); await sleep(900);
  },
  async plan(page) {
    await sleep(500);
    mark('plan'); await mv(page, '.td-rows > li.now', { fy: 0.5 }); await sleep(1700);
    await mv(page, '.td-rows > li:nth-child(4)'); await sleep(900);
    mark('comm'); await click(page, '#comm-open'); await sleep(1100);
    mark('snip'); await click(page, '.td-pick .td-more >> nth=0'); await sleep(2400);
    await page.mouse.move(1130, 560, { steps: 10 }); await page.mouse.wheel(0, 340); await sleep(1700);
    await page.mouse.wheel(0, 360); await sleep(1500);
  },
  async maya(page) {
    await sleep(400);
    mark('open'); await click(page, '.guide .g-face'); await sleep(1400);
    if (!(await page.locator('.g-panel.open').count())) { await click(page, '.guide .g-face'); await sleep(1400); }
    await click(page, '.g-panel.open .g-form input'); await sleep(300);
    mark('type'); await page.keyboard.type('מה אפשר לבנות לעסק שלי?', { delay: 70 }); await sleep(500);
    mark('answer'); await page.keyboard.press('Enter'); await sleep(11500);
  },
  async admin(page) {
    await sleep(400);
    await click(page, '.cats-toggle'); await sleep(900);
    mark('edit'); await click(page, '.cats-edit'); await sleep(1000);
    await click(page, '.tile[data-cat="ai"]'); await sleep(1400);
    await page.locator('.cats-add').scrollIntoViewIfNeeded(); await sleep(400); mark('add'); await click(page, '.cats-add'); await sleep(1300);
    mark('move'); await page.waitForFunction(() => { const sel = [...document.querySelectorAll('#grid .card .edit-strip select')].find((x) => x.offsetParent); const o = sel && [...sel.options].find((x) => x.textContent.trim() === 'לקוחות VIP'); if (!o) return false; sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true })); return true; }, null, { timeout: 20000, polling: 300 }); await sleep(1700);
    await page.locator('.cats').hover(); await page.mouse.wheel(0, 900); await sleep(900);
    mark('newtab'); await click(page, '.tile[data-cat^="c-"]'); await sleep(2200);
  },
  async rail(page) {
    await sleep(500);
    mark('music'); await click(page, '.rail-slot[data-k="music"] .rail-btn'); await sleep(2600);
    await click(page, '.rail-slot[data-k="music"] .rail-btn'); await sleep(900);
    mark('ticker'); await mv(page, '#news-ticker .tk-view'); await sleep(3200);
  }
};

(async () => {
  browser = await chromium.launch();
  const want = process.argv.slice(2);
  const OPTS = { maya: { maya: true }, admin: {}, rail: {}, domains: {}, plan: {}, overview: {} };
  for (const k of Object.keys(SCENES)) { if (want.length && !want.includes(k)) continue; await record(k, SCENES[k], OPTS[k]); }
  await browser.close();
})();
