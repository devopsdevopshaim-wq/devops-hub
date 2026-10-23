// Screenshots of the desktop program for the tutorial film (videos/promo-src/app-tutorial). The page runs as it does inside
// the program: window.FSDesktop is a stand-in whose local AI engine reports a download in progress, so the floating card shows.
//   node videos/promo-src/capture/cap-tutorial.cjs   (with python3 -m http.server 8099 at the repo root)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const O = '/tmp/claude-0/sp/tut/';
const R = '/home/user/devops-hub/';
const B = 'http://localhost:8099/frame-studio/';
const desk = (installing) => {
  let done = 1.9e9;
  window.FSDesktop = Object.freeze({
    isDesktop: true, version: '1.0.20', platform: 'win32',
    machineId: () => Promise.resolve('a'.repeat(64)),
    progress: () => {}, notify: () => {},
    localAI: {
      status: () => { done += 4.2e7; return Promise.resolve(installing ? { state: 'installing', ready: false, progress: { done, total: 5.3e9 }, engine: { variant: 'vulkan' } } : { state: 'ready', ready: true, engine: { variant: 'vulkan' } }); },
      gpuInfo: () => Promise.resolve({ gpus: [{ name: 'NVIDIA GeForce RTX 3060', vram: 12e9 }], best: { name: 'NVIDIA GeForce RTX 3060' } }),
      install: () => new Promise(() => {}), cancelInstall: () => Promise.resolve(), remove: () => Promise.resolve({}),
      run: () => new Promise(() => {}), cancel: () => Promise.resolve(),
    },
  });
};
(async () => {
  const b = await chromium.launch();
  const mk = async (session, installing) => {
    const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.5, locale: 'he-IL' });
    await ctx.addInitScript(desk, installing);
    await ctx.addInitScript((s) => { try { localStorage.setItem('fs-intro-seen', '1'); localStorage.setItem('fs-ai-local-auto', 'off'); if (s) localStorage.setItem('frame-session', JSON.stringify({ token: 'x'.repeat(48), role: 'admin', email: 'a@b.c', at: Date.now() })); } catch (e) {} }, session);
    const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('ERR', e.message));
    return p;
  };
  // 1. the activation screen
  let p = await mk(false, false);
  await p.goto(B + 'studio.html'); await p.waitForTimeout(3000);
  const em = p.locator('#gate input[type=email]').first(); if (await em.count()) await em.fill('studio@example.co.il');
  await p.screenshot({ path: O + 'gate.png' });
  await p.context().close();

  // 2. the studio, with the engine downloading
  p = await mk(true, true);
  await p.goto(B + 'studio.html'); await p.waitForTimeout(3000);
  await p.evaluate(() => { document.body.classList.remove('gated'); ['gate', 'intro'].forEach((i) => { const g = document.getElementById(i); if (g) g.remove(); }); });
  const photos = ['wedding-3', 'barmitzvah-1', 'birthday-2', 'engagement-1', 'wedding-1', 'henna-3'].map((n) => R + 'frame-studio/media/real/' + n + '.webp').filter((f) => require('fs').existsSync(f));
  await p.setInputFiles('#file-photos', photos);
  await p.waitForFunction((n) => FS.state.photos.length >= n, photos.length); await p.waitForTimeout(6000);
  await p.screenshot({ path: O + 'float-dl.png' });
  await p.evaluate(() => { const f = document.getElementById('la-float'); if (f) f.remove(); });
  for (const t of ['photos', 'curate', 'collage', 'adjust', 'frames', 'styles', 'ai', 'live', 'output']) {
    if (t === 'adjust') { await p.locator('[data-tab="photos"]').first().click().catch(() => {}); await p.evaluate(() => FS.showGrid()); await p.waitForTimeout(800); await p.locator('#gv-tiles .gt-ed').first().click({ force: true }).catch((e) => console.log('edit', e.message.slice(0, 200))); await p.waitForTimeout(2500); }
    const tab = p.locator('[data-tab="' + t + '"]').first(); if (!(await tab.count())) { console.log('no tab', t); continue; }
    await tab.click().catch(() => {}); await p.waitForTimeout(2200);
    if (t === 'frames') { const f = p.locator('[data-pane=frames] .tile, [data-pane=frames] button.fr, [data-pane=frames] .frame').nth(2); if (await f.count()) { await f.click().catch(() => {}); await p.waitForTimeout(2200); } }
    if (t === 'collage') { const a = p.locator('#cl-all'); if (await a.count()) { await a.click().catch(() => {}); await p.waitForTimeout(4000); } }
    if (t === 'curate') await p.waitForTimeout(5000);
    await p.evaluate(() => { const f = document.getElementById('la-float'); if (f) f.remove(); });
    await p.screenshot({ path: O + 'tab-' + t + '.png' });
  }
  // 3. the card when the install is done (the program's own markup, as js/local-ai.js shows it)
  await p.locator('[data-tab="photos"]').first().click().catch(() => {}); await p.waitForTimeout(1500);
  await p.evaluate(() => { const f = document.createElement('button'); f.id = 'la-float'; f.className = 'la-float ok'; f.innerHTML = '<b>✅ ההתקנה הסתיימה: מנוע ה־AI המקומי מוכן</b><span>כל עיצובי ה־AI עובדים עכשיו גם בלי אינטרנט · תמונת הבדיקה לקחה 9 שניות</span>'; document.body.appendChild(f); });
  await p.waitForTimeout(800); await p.screenshot({ path: O + 'float-ok.png' });
  await p.evaluate(() => document.getElementById('la-float').remove());
  // 4. three versions: the real FLUX results of the local-AI test run
  const img = (f) => 'data:image/png;base64,' + require('fs').readFileSync(R + 'videos/promo-src/e2e/' + f).toString('base64');
  await p.locator('[data-tab="styles"]').first().click().catch(() => {}); await p.waitForTimeout(1200);
  await p.evaluate((ims) => {
    const body = FS.dialog('🎯 תלת־ממד · בוחרים גרסה', '<p class="hint">כל גרסה נוצרה במנוע AI אחר. לוחצים על היפה ביותר והיא נכנסת לתמונה.</p><div class="ai-vars" id="ai-vars"></div>', true);
    ims.forEach(([src, name]) => { const x = document.createElement('button'); x.className = 'ai-var'; x.type = 'button'; x.innerHTML = '<img alt="" src="' + src + '"><b>' + name + '</b>'; body.querySelector('#ai-vars').appendChild(x); });
  }, [[img('3d.png'), FS_NAME('gemini')], [img('anime.png'), FS_NAME('local')], [img('oil.png'), FS_NAME('flux')]].map((x) => x)).catch((e) => console.log('vars', e.message));
  await p.waitForTimeout(2500); await p.screenshot({ path: O + 'vars.png' });
  // 5. the local AI panel (engine ready, with a graphics card)
  await p.context().close();
  p = await mk(true, false);
  await p.goto(B + 'studio.html'); await p.waitForTimeout(3000);
  await p.evaluate(() => { document.body.classList.remove('gated'); ['gate', 'intro'].forEach((i) => { const g = document.getElementById(i); if (g) g.remove(); }); });
  await p.setInputFiles('#file-photos', photos.slice(0, 3)); await p.waitForTimeout(3000);
  await p.evaluate(() => FS.localAI.open()); await p.waitForTimeout(2500);
  await p.screenshot({ path: O + 'local-panel.png' });
  await b.close();
})();
function FS_NAME(k) { return { gemini: 'Gemini', local: 'מקומי (בלי אינטרנט)', flux: 'FLUX' }[k]; }
