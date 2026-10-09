// Deploys the SPIDER sign-in server to Cloudflare Workers (cloudflare/), sets its secrets, checks that it answers, and writes
// portfolio/api.json so the site talks to it. Run from the repository root by .github/workflows/cloudflare-deploy.yml.
//
// GitHub secrets: CLOUDFLARE_API_TOKEN (template "Edit Cloudflare Workers") and CLOUDFLARE_ACCOUNT_ID.
// Read like the n8n deploy does (each one separately, or all inside the SPIDER secret): ADMIN_PASSWORD, ADMIN_TOTP_SECRET,
// MORNING_CLIENT_ID / MORNING_CLIENT_SECRET, N8N_API_KEY (only to derive the key shared with the leads workflow).
// For emails: BREVO_API_KEY (+ MAIL_FROM, a sender verified at Brevo, default the admin's Gmail) or RESEND_API_KEY.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const combined = [process.env.SPIDER, process.env.HAIM_WEB_KEY].filter(Boolean).join('\n');
const pick = (re) => (combined.match(re) || [])[0] || '';
const label = (name, re) => (process.env[name] || (combined.match(new RegExp(name + '\\W*(' + re + ')')) || [])[1] || '').trim();
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || (combined.match(/^[ \t]*ADMIN_PASSWORD[ \t]*[=:][ \t]*(.+?)[ \t]*$/m) || [])[1] || '').replace(/^(["'])(.*)\1$/, '$2');
const TOTP = (process.env.ADMIN_TOTP_SECRET || ((combined.match(/ADMIN_TOTP_SECRET\W*((?:[A-Za-z2-7]{4}\s?){4,16})/) || [])[1] || '')).replace(/\s+/g, '').toUpperCase();
const KEY = (process.env.N8N_API_KEY || pick(/eyJ[\w-]+\.[\w-]+\.[\w-]+/)).trim();
const SHARED = KEY ? crypto.createHmac('sha256', KEY).update('spider-shared-v1').digest('hex') : '';
const ITER = Number(process.env.PBKDF2_ITER) || 10000;
const secrets = {
  ADMIN_TOTP_SECRET: TOTP, SHARED_KEY: SHARED,
  MORNING_CLIENT_ID: label('MORNING_CLIENT_ID', '[\\w-]{8,100}'), MORNING_CLIENT_SECRET: label('MORNING_CLIENT_SECRET', '[\\w-]{8,120}'),
  BREVO_API_KEY: (process.env.BREVO_API_KEY || '').trim(), RESEND_API_KEY: (process.env.RESEND_API_KEY || '').trim(), MAIL_FROM: (process.env.MAIL_FROM || '').trim()
};
if (ADMIN_PASSWORD.length >= 8) {
  const salt = crypto.randomBytes(16).toString('hex');
  secrets.ADMIN_PASSWORD_HASH = `p1$${ITER}$${salt}$` + crypto.pbkdf2Sync(ADMIN_PASSWORD, Buffer.from(salt, 'hex'), ITER, 32, 'sha256').toString('hex');
}
for (const v of [ADMIN_PASSWORD, TOTP, SHARED, secrets.BREVO_API_KEY, secrets.RESEND_API_KEY, secrets.MORNING_CLIENT_SECRET]) if (v && v.length >= 6) console.log(`::add-mask::${v}`);

const notes = [];
const note = (s) => { notes.push(s); console.log(s); };
const run = (args, opts = {}) => spawnSync('npx', ['wrangler', ...args], { cwd: 'cloudflare', encoding: 'utf8', env: process.env, ...opts });

const d = run(['deploy', '--var', `PBKDF2_ITER:${ITER}`]);
process.stdout.write((d.stdout || '') + (d.stderr || ''));
if (d.status !== 0) { note('- ❌ Cloudflare: הפריסה נכשלה'); finish(1); }
const URL_ = ((d.stdout + d.stderr).match(/https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev/i) || [])[0] || '';
if (!URL_) { note('- ❌ Cloudflare: לא נמצאה כתובת ה־Worker בפלט'); finish(1); }
note(`- ✅ Cloudflare Worker פעיל: ${URL_}`);

// secrets only when there is something to set (an empty one is not stored); `wrangler secret bulk` replaces them in one call
const bulk = Object.fromEntries(Object.entries(secrets).filter(([, v]) => v));
if (Object.keys(bulk).length) {
  fs.writeFileSync('cloudflare/.secrets.json', JSON.stringify(bulk));
  const s = run(['secret', 'bulk', '.secrets.json']);
  fs.rmSync('cloudflare/.secrets.json', { force: true });
  if (s.status !== 0) { process.stdout.write((s.stdout || '') + (s.stderr || '')); note('- ❌ Cloudflare: הגדרת הסודות נכשלה'); finish(1); }
  note('- ✅ הסודות הוגדרו: ' + Object.keys(bulk).join(', '));
} else note('- ℹ️ אין סודות להגדיר');
if (!secrets.ADMIN_PASSWORD_HASH) note('- ⚠️ אין ADMIN_PASSWORD (לפחות 8 תווים): כניסת המנהל תהיה רק דרך סיסמה ראשונית במייל');
if (!secrets.BREVO_API_KEY && !secrets.RESEND_API_KEY) note('- ⚠️ אין BREVO_API_KEY או RESEND_API_KEY: מיילים (סיסמה ראשונית, התראות) לא יישלחו');

const ORIGIN = 'https://devopsdevopshaim-wq.github.io';
const post = async (b, origin = ORIGIN) => {
  const r = await fetch(URL_ + '/hasadna-auth', { method: 'POST', headers: { ...(origin ? { Origin: origin } : {}) }, body: new URLSearchParams(b) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
let ok = true;
await new Promise((r) => setTimeout(r, 4000));   // the new version spreads in a few seconds
let info = await post({ action: 'info' }).catch(() => ({ status: 0 }));
for (let i = 0; i < 5 && info.status !== 200; i++) { await new Promise((r) => setTimeout(r, 3000)); info = await post({ action: 'info' }).catch(() => ({ status: 0 })); }
if (info.status === 200) note('- ✅ השרת עונה'); else { note('- ❌ השרת לא עונה (' + info.status + ')'); ok = false; }
const evil = await post({ action: 'info' }, 'https://evil.example').catch(() => ({ status: 0 }));
note(evil.status === 403 ? '- ✅ בקשה מאתר זר נחסמת' : '- ❌ בקשה מאתר זר לא נחסמה (' + evil.status + ')'); if (evil.status !== 403) ok = false;
const bad = await post({ action: 'login', email: 'devopsdevopshaim@gmail.com', password: 'definitely-not-the-password', device: 'a'.repeat(32) }).catch(() => ({ status: 0 }));
note(bad.status === 401 ? '- ✅ סיסמה שגויה נדחית' : '- ❌ סיסמה שגויה לא נדחתה (' + bad.status + ')'); if (bad.status !== 401) ok = false;
if (secrets.ADMIN_PASSWORD_HASH && !secrets.ADMIN_TOTP_SECRET) {
  const lg = await post({ action: 'login', email: 'devopsdevopshaim@gmail.com', password: ADMIN_PASSWORD, device: crypto.randomBytes(16).toString('hex') }).catch(() => ({ status: 0, json: {} }));
  if (lg.json && lg.json.token) { note('- ✅ כניסת מנהל עובדת עם הסיסמה שהוגדרה'); await post({ action: 'logout', token: lg.json.token }); }
  else { note('- ❌ כניסת מנהל נכשלה: ' + lg.status + ' ' + JSON.stringify(lg.json)); ok = false; }
}
if (ok) {
  fs.writeFileSync('portfolio/api.json', JSON.stringify({ auth: URL_ + '/hasadna-auth', where: 'cloudflare' }, null, 1) + '\n');
  note('- ✅ portfolio/api.json עודכן: האתר ידבר עם Cloudflare');
}
finish(ok ? 0 : 1);

function finish(code) {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '## Cloudflare\n' + notes.join('\n') + '\n');
  process.exit(code);
}
