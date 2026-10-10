// Moves the clients from the n8n sign-in flow to the Cloudflare server.
//
// n8n keeps the clients in the workflow's static data, which its public API returns; reading it is an API call, not an execution, so it works
// even when the monthly execution quota is used up. The accounts (name, phone, sites, plan, expiry, payments) are imported into the Worker as
// the admin, each with a new initial password that only the admin can read afterwards (portfolio/migrate.html). Old password hashes are not
// copied: they use 210,000 PBKDF2 rounds, more than a free Worker can compute in one request. Nothing secret is printed.
import fs from 'node:fs';
import crypto from 'node:crypto';

const combined = [process.env.SPIDER, process.env.HAIM_WEB_KEY].filter(Boolean).join('\n');
const pick = (re) => (combined.match(re) || [])[0] || '';
const BASE = (process.env.N8N_URL || pick(/https:\/\/[a-z0-9-]+\.app\.n8n\.cloud/i)).trim().replace(/\/+$/, '');
const KEY = (process.env.N8N_API_KEY || pick(/eyJ[\w-]+\.[\w-]+\.[\w-]+/)).trim();
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || (combined.match(/^[ \t]*ADMIN_PASSWORD[ \t]*[=:][ \t]*(.+?)[ \t]*$/m) || [])[1] || '').replace(/[\r\n]+$/, '').replace(/^(["'])(.*)\1$/, '$2');
const DRY = process.env.DRY_RUN === 'true';
for (const v of [KEY, ADMIN_PASSWORD]) if (v && v.length >= 6) console.log(`::add-mask::${v}`);
const notes = [];
const say = (s) => { notes.push(s); console.log(s); };
const done = (code) => { if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '## Client migration\n' + notes.join('\n') + '\n'); process.exit(code); };

if (!BASE || !KEY) { say('- ❌ חסרים N8N_URL / N8N_API_KEY (או SPIDER עם שניהם)'); done(1); }
if (!ADMIN_PASSWORD) { say('- ❌ חסר ADMIN_PASSWORD'); done(1); }
const api = JSON.parse(fs.readFileSync('portfolio/api.json', 'utf8'));
const WORKER = api.auth;
const ORIGIN = 'https://devopsdevopshaim-wq.github.io';

// 1. the clients from n8n
const get = async (p) => { const r = await fetch(BASE + '/api/v1' + p, { headers: { 'X-N8N-API-KEY': KEY, accept: 'application/json' } }); if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); };
let flow;
try {
  const list = await get('/workflows?limit=250');
  const meta = (list.data || []).find((w) => /כניסה והרשאות/.test(w.name));
  if (!meta) { say('- ❌ לא נמצא ב־n8n התהליך "כניסה והרשאות"'); done(1); }
  flow = await get('/workflows/' + meta.id);
} catch (e) { say('- ❌ קריאה מ־n8n נכשלה: ' + e.message); done(1); }
let sd = flow.staticData;
if (typeof sd === 'string') { try { sd = JSON.parse(sd); } catch (e) { sd = null; } }
sd = sd && (sd.global || sd);
if (!sd || !sd.clients) { say('- ⚠️ ל־n8n אין נתוני לקוחות שמורים בתהליך (או שה־API לא מחזיר אותם). אם יש לקוחות, השתמש ב־migrate.html כשהמכסה תתאפס.'); done(1); }
const clients = Object.values(sd.clients).map((c) => ({ email: c.email, name: c.name, phone: c.phone, note: c.note, sites: c.sites, plan: c.plan, expiresAt: c.expiresAt, active: c.active, ipLock: c.ipLock, maxDevices: c.maxDevices, createdAt: c.createdAt, payments: c.payments }));
say(`- נמצאו ב־n8n ${clients.length} לקוחות` + (sd.signupClosed ? ' (ההרשמה העצמית סגורה שם)' : ''));
if (DRY) { say('- 🧪 הרצת ניסיון: לא נשלח כלום לשרת החדש'); done(0); }

// the leads and prices of the leads flow
let biz = null;
try {
  const list2 = await get('/workflows?limit=250');
  const m2 = (list2.data || []).find((w) => /לידים ומחירון/.test(w.name));
  if (m2) {
    const f2 = await get('/workflows/' + m2.id);
    let s2 = f2.staticData; if (typeof s2 === 'string') { try { s2 = JSON.parse(s2); } catch (e) { s2 = null; } }
    s2 = s2 && (s2.global || s2);
    if (s2) biz = { leads: s2.leads || [], clicks: s2.clicks || {}, prices: s2.prices || null };
  }
} catch (e) { say('- ⚠️ קריאת הלידים והמחירון מ־n8n נכשלה: ' + e.message); }
say(biz ? `- נמצאו ב־n8n ${biz.leads.length} לידים${biz.prices ? ' ומחירון מותאם' : ''}` : '- לא נמצאו נתוני לידים ב־n8n');

// 2. into the Worker, as the admin
const post = async (b) => { const r = await fetch(WORKER, { method: 'POST', headers: { Origin: ORIGIN }, body: new URLSearchParams(b) }); return { status: r.status, json: await r.json().catch(() => null) }; };
const lg = await post({ action: 'login', email: 'devopsdevopshaim@gmail.com', password: ADMIN_PASSWORD, device: crypto.randomBytes(16).toString('hex') });
if (!lg.json || !lg.json.token) { say('- ❌ כניסת מנהל לשרת Cloudflare נכשלה (' + lg.status + ' ' + JSON.stringify(lg.json) + ')'); done(1); }
const token = lg.json.token;
const imp = await post({ action: 'clients-import', token, temp: '1', payload: JSON.stringify(clients) });
if (!imp.json || !imp.json.ok) { say('- ❌ הייבוא נכשל (' + imp.status + ' ' + JSON.stringify(imp.json) + ')'); await post({ action: 'logout', token }); done(1); }
say(`- ✅ יובאו ${imp.json.added} לקוחות; דולגו ${imp.json.skipped} (כבר קיימים או לא תקינים); נוצרו ${imp.json.passwords} סיסמאות ראשוניות`);
if (sd.signupClosed) { await post({ action: 'signup-set', token, open: 'false' }); say('- ההרשמה העצמית נסגרה גם בשרת החדש (כמו בישן)'); }
if (sd.aiVault && sd.aiVault.blob) { const v = await post({ action: 'ai-vault-set', token, blob: sd.aiVault.blob }); say(v.json && v.json.ok ? '- ✅ כספת מפתחות ה־AI הועברה' : '- ⚠️ כספת ה־AI לא הועברה'); }
if (biz && (biz.leads.length || biz.prices || Object.keys(biz.clicks).length)) {
  // the leads screen takes the short-lived proof the sign-in hands the admin
  const me = await post({ action: 'me', token });
  const proof = me.json && me.json.biz;
  if (!proof) say('- ⚠️ אין הוכחת מנהל ללידים (חסר SHARED_KEY בשרת); הלידים לא הועברו');
  else {
    const base = WORKER.replace(/\/hasadna-auth$/, '');
    const r = await fetch(base + '/hasadna-admin', { method: 'POST', headers: { Origin: ORIGIN }, body: new URLSearchParams({ action: 'import', token: proof, payload: JSON.stringify(biz) }) });
    const j = await r.json().catch(() => null);
    say(j && j.ok ? `- ✅ הועברו ${j.leads} לידים${j.prices ? ' והמחירון' : ''}` : `- ❌ העברת הלידים נכשלה (${r.status} ${JSON.stringify(j)})`);
  }
}
await post({ action: 'logout', token });
say('- ➡️ הסיסמאות הראשוניות נמצאות בעמוד portfolio/migrate.html (כפתור "הצגת הרשימה"), עם כפתור שליחה בוואטסאפ לכל לקוח.');
done(0);
