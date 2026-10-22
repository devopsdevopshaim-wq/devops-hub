const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const O = '/tmp/claude-0/sp/cap/';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.5, locale: 'he-IL' });
  await ctx.addInitScript(() => { try { localStorage.setItem('frame-session', JSON.stringify({ token: 'x'.repeat(48), role: 'admin', email: 'a@b.c', at: Date.now() })); localStorage.setItem('fs-intro-seen', '1'); } catch (e) {} });
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  const B = 'http://localhost:8099/frame-studio/';
  // business site
  await p.goto(B + 'index.html'); await p.waitForTimeout(3500);
  await p.screenshot({ path: O + 'site-hero.png' });
  for (const id of ['work', 'gallery', 'designer', 'packages', 'how']) {
    const el = p.locator('#' + id); if (!(await el.count())) continue;
    await el.scrollIntoViewIfNeeded(); await p.evaluate(i => document.getElementById(i).scrollIntoView({ block: 'start' }), id); await p.waitForTimeout(1500);
    await p.screenshot({ path: O + 'site-' + id + '.png' });
  }
  await p.goto(B + 'design.html'); await p.waitForTimeout(4000); await p.screenshot({ path: O + 'design.png' });
  await p.goto(B + 'download.html'); await p.waitForTimeout(2500); await p.screenshot({ path: O + 'download.png' });
  // studio
  await p.goto(B + 'studio.html'); await p.waitForTimeout(3000);
  await p.evaluate(() => { document.body.classList.remove('gated'); ['gate', 'intro'].forEach(i => { const g = document.getElementById(i); if (g) g.remove(); }); });
  await p.setInputFiles('#file-photos', ['/home/user/devops-hub/frame-studio/media/real/wedding-3.webp', '/home/user/devops-hub/frame-studio/media/real/barmitzvah-1.webp', '/home/user/devops-hub/frame-studio/media/real/birthday-2.webp', '/home/user/devops-hub/frame-studio/media/real/engagement-1.webp']);
  await p.waitForFunction(() => FS.state.photos.length >= 4); await p.waitForTimeout(2500);
  for (const t of ['photos', 'frames', 'adjust', 'text', 'styles', 'ai', 'live', 'output']) {
    const tab = p.locator('[data-tab="' + t + '"]').first(); if (!(await tab.count())) { console.log('no tab', t); continue; }
    await tab.click().catch(() => {}); await p.waitForTimeout(1800);
    if (t === 'frames') { const f = p.locator('[data-pane=frames] .tile, [data-pane=frames] button.fr, [data-pane=frames] .frame').nth(2); if (await f.count()) { await f.click().catch(() => {}); await p.waitForTimeout(2000); } }
    await p.screenshot({ path: O + 'studio-' + t + '.png' });
  }
  await b.close();
})();
