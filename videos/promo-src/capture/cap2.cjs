const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const O = '/tmp/claude-0/sp/cap/';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.5, locale: 'he-IL' });
  await ctx.addInitScript(() => { try { localStorage.setItem('frame-session', JSON.stringify({ token: 'x'.repeat(48), role: 'admin', email: 'a@b.c', at: Date.now() })); } catch (e) {} });
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8099/frame-studio/studio.html'); await p.waitForTimeout(3000);
  await p.evaluate(() => { document.body.classList.remove('gated'); ['gate', 'intro'].forEach(i => { const g = document.getElementById(i); if (g) g.remove(); }); });
  await p.setInputFiles('#file-photos', ['/home/user/devops-hub/frame-studio/media/real/wedding-3.webp']);
  await p.waitForFunction(() => FS.state.photos.length >= 1); await p.waitForTimeout(2000);
  const r = await p.evaluate(async () => {
    const p = FS.cur(); const ev = FS.SHOWCASE[2];
    FS.buildMagnet && FS.buildMagnet(p, ev); FS.emit('doc'); FS.refreshStrip && FS.refreshStrip();
    return { grid: FS.gridMode && FS.gridMode(), tabs: [...document.querySelectorAll('[data-tab]')].map(t => t.dataset.tab).join(',') };
  });
  console.log(JSON.stringify(r));
  await p.waitForTimeout(2500);
  for (const t of ['frames', 'ai', 'output']) { await p.locator('[data-tab="' + t + '"]').first().click().catch(() => {}); await p.waitForTimeout(1800); await p.screenshot({ path: O + 'one-' + t + '.png' }); }
  await b.close();
})();
