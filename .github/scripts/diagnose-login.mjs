// Diagnoses the sign-in against the LIVE site, from a GitHub runner (which can reach both servers): the Worker directly, then a real
// browser that opens the clients' page, types the admin password and submits, logging every request and its result.
import crypto from 'node:crypto';
import fs from 'node:fs';
const SITE = 'https://devopsdevopshaim-wq.github.io', PAGE = SITE + '/devops-hub/portfolio/client.html';
const EMAIL = 'devopsdevopshaim@gmail.com', PW = (process.env.ADMIN_PASSWORD || '').replace(/[\r\n]+$/, '');
if (/[\r\n]$/.test(process.env.ADMIN_PASSWORD || '')) console.log('NOTE: the ADMIN_PASSWORD secret ends with a line break (the deploy now strips it)');
if (PW) console.log(`::add-mask::${PW}`);
const lines = [];
const say = (s) => { lines.push(s); console.log(s); };
const redact = (s) => String(s).replace(/"token":"[a-f0-9]{48}"/g, '"token":"…"').slice(0, 300);

const cfg = await fetch(SITE + '/devops-hub/portfolio/api.json', { cache: 'no-store' }).then((r) => r.text()).catch((e) => 'ERR ' + e.message);
say('api.json on the live site: ' + cfg.replace(/\s+/g, ' '));
let base = '';
try { base = JSON.parse(cfg).base || ''; } catch (e) { /* none */ }
if (base) {
  const post = async (b, origin = SITE) => {
    const r = await fetch(base + '/hasadna-auth', { method: 'POST', headers: { Origin: origin }, body: new URLSearchParams(b) });
    return `${r.status} acao=${r.headers.get('access-control-allow-origin')} ${redact(await r.text())}`;
  };
  say('worker info:           ' + await post({ action: 'info' }).catch((e) => 'ERR ' + e.message));
  say('worker wrong password: ' + await post({ action: 'login', email: EMAIL, password: 'not-the-password-123', device: crypto.randomBytes(16).toString('hex') }).catch((e) => 'ERR ' + e.message));
  if (PW) {
    const dev = crypto.randomBytes(16).toString('hex');
    const t0 = Date.now();
    const r = await post({ action: 'login', email: EMAIL, password: PW, device: dev }).catch((e) => 'ERR ' + e.message);
    say(`worker real password:  ${r} (${Date.now() - t0} ms)`);
    const tok = (r.match(/"token":"([a-f0-9]{48})"/) || [])[1];
    if (tok) await post({ action: 'logout', token: tok });
  } else say('no ADMIN_PASSWORD secret in this run');
}

try {
  const { chromium } = await import('playwright');
  const b = await chromium.launch();
  const pg = await b.newPage();
  pg.on('console', (m) => { if (m.type() === 'error') say('  console error: ' + m.text().slice(0, 200)); });
  pg.on('requestfailed', (q) => { if (/workers\.dev|n8n\.cloud|api\.json/.test(q.url())) say(`  FAILED ${q.method()} ${q.url().slice(0, 90)}: ${q.failure() && q.failure().errorText}`); });
  pg.on('request', (q) => {
    if (q.method() === 'POST' && /workers\.dev/.test(q.url())) {
      const f = new URLSearchParams(q.postData() || '');
      if (f.get('action') === 'login') {
        const sent = f.get('password') || '';
        say(`  password same as the secret: ${sent === PW}; secret has: ${[/\n/.test(PW) && 'newline', /\r/.test(PW) && 'CR', /[^\x20-\x7e]/.test(PW) && 'non-ASCII', /^\s|\s$/.test(PW) && 'edge-space', /\s/.test(PW) && 'inner-space'].filter(Boolean).join(',') || 'plain printable ASCII'}; sent has: ${[/\n/.test(sent) && 'newline', /[^\x20-\x7e]/.test(sent) && 'non-ASCII'].filter(Boolean).join(',') || 'plain'}`);
      }
      say(`  sent action=${f.get('action')} email=${f.get('email') || ''} password.length=${(f.get('password') || '').length} (expected ${PW.length}) device.length=${(f.get('device') || '').length} totp=${JSON.stringify(f.get('totp'))}`);
    }
  });
  pg.on('response', (r) => { if (/workers\.dev|n8n\.cloud|api\.json/.test(r.url())) say(`  ${r.status()} ${r.request().method()} ${r.url().slice(0, 90)}`); });
  await pg.goto(PAGE, { waitUntil: 'load' });
  await pg.waitForTimeout(2500);
  say('browser: opened the clients page');
  await pg.fill('#gate input[name=email]', EMAIL);
  await pg.fill('#gate input[type=password]', PW || 'x');
  await pg.click('#gate button[type=submit]');
  await pg.waitForTimeout(7000);
  const locked = await pg.evaluate(() => document.documentElement.classList.contains('locked'));
  const msg = await pg.evaluate(() => { const g = document.getElementById('gate'); return g ? g.innerText.replace(/\s+/g, ' ').slice(0, 400) : ''; });
  say(`browser: ${locked ? 'STILL LOCKED' : 'signed in'}; gate text: ${msg}`);
  await b.close();
} catch (e) { say('browser step failed: ' + String(e.message).slice(0, 200)); }
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '## Sign-in diagnosis\n```\n' + lines.join('\n') + '\n```\n');
