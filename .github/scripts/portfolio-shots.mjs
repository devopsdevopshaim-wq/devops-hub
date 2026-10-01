// Takes a desktop and a phone screenshot of every project in
// portfolio/projects.json and writes them to portfolio/shots/.
// Usage: node portfolio-shots.mjs [project-id ...]   (no ids = all)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'portfolio');
const data = JSON.parse(fs.readFileSync(path.join(root, 'projects.json'), 'utf8'));
const outDir = path.join(root, 'shots');
fs.mkdirSync(outDir, { recursive: true });
const indexFile = path.join(outDir, 'index.json');
const index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : {};
const only = process.argv.slice(2).filter(Boolean);

function urlOf(p) {
  if (p.noshot || p.hidden || p.pending) return null;
  if (p.url) return p.url;
  if (p.localhost || p.private || !p.repo) return null;
  return `https://${data.owner}.github.io/${p.repo}/` + (p.start ? encodeURIComponent(p.start) : '');
}

async function shoot(browser, url, file, viewport, mobile) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, locale: 'he-IL' });
  const page = await ctx.newPage();
  try {
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    } catch {
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    }
    await page.waitForTimeout(3000);
    // Free hosts (Render) show a wake-up page while the app starts, and some
    // sites put a bot check first. Give them time, then load again.
    for (let i = 0; i < 3; i++) {
      const text = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 2000) : '');
      if (!/waking up|spinning up|service is starting|just a moment|checking your browser|verify you are human/i.test(text)) break;
      await page.waitForTimeout(30000);
      await page.reload({ waitUntil: 'load', timeout: 90000 }).catch(() => {});
      await page.waitForTimeout(4000);
    }
    await page.screenshot({ path: file, type: 'jpeg', quality: 72 });
  } finally {
    await ctx.close();
  }
}

const browser = await chromium.launch();
let ok = 0, failed = [];
for (const p of data.projects) {
  if (only.length && !only.includes(p.id)) continue;
  const url = urlOf(p);
  if (!url) continue;
  try {
    await shoot(browser, url, path.join(outDir, `${p.id}.jpg`), { width: 1280, height: 800 }, false);
    await shoot(browser, url, path.join(outDir, `${p.id}-m.jpg`), { width: 390, height: 844 }, true);
    index[p.id] = { url, at: new Date().toISOString() };
    ok++;
    console.log('ok  ', p.id, url);
  } catch (e) {
    failed.push(p.id);
    console.log('fail', p.id, url, String(e.message || e).split('\n')[0]);
  }
}
await browser.close();
fs.writeFileSync(indexFile, JSON.stringify(index, null, 2) + '\n');
console.log(`\n${ok} captured, ${failed.length} failed${failed.length ? ': ' + failed.join(', ') : ''}`);
