// Installs SPIDER's n8n workflows in n8n Cloud through the n8n public API, with
// their credentials, activates them, checks that they answer, and points the
// portfolio at them.
//
//   n8n/hasadna-multi-agent.json  Maya and the agent team, monitor, control center (Claude)
//   n8n/hasadna-business.json     leads and the price list (keeps its stored leads on update)
//   n8n/hasadna-access.json       sign-in codes, clients, payments (Gmail SMTP)
//   n8n/hasadna-voice.json        Maya's female voice for browsers without one (Azure Speech or ElevenLabs)
//   n8n/hasadna-parkomat.json     Parkomat's robotic-parking agents: questionnaires from פארק־פלאן (Claude + lead email)
//   n8n/hasadna-comic.json        the comic studio's drawing server (Gemini and/or OpenAI image models)
//
// Secrets: N8N_URL, N8N_API_KEY (or both inside HAIM_WEB_KEY),
//          ANTHROPIC_API_KEY (only until a Claude credential exists in n8n),
//          GMAIL_APP_PASSWORD (+ optional GMAIL_USER) for the sign-in emails,
//          AZURE_SPEECH_KEY + AZURE_SPEECH_REGION (or ELEVENLABS_API_KEY) for Maya's voice,
//          GEMINI_API_KEY and/or OPENAI_API_KEY for the comic studio's drawings.
import fs from 'node:fs';
import crypto from 'node:crypto';

// all of them can also arrive in one secret (SPIDER or HAIM_WEB_KEY), in any layout: picked out by their shape
const combined = [process.env.SPIDER, process.env.HAIM_WEB_KEY].filter(Boolean).join('\n');
const pick = (re) => (combined.match(re) || [])[0] || '';
const BASE = (process.env.N8N_URL || pick(/https:\/\/[a-z0-9-]+\.app\.n8n\.cloud/i)).trim().replace(/\/+$/, '');
const KEY = (process.env.N8N_API_KEY || pick(/eyJ[\w-]+\.[\w-]+\.[\w-]+/)).trim();
const CLAUDE = (process.env.ANTHROPIC_API_KEY || pick(/sk-ant-[\w-]+/)).trim();
const GMAIL_USER = (process.env.GMAIL_USER || 'devopsdevopshaim@gmail.com').trim();
const GMAIL_PASS = (process.env.GMAIL_APP_PASSWORD || (combined.match(/GMAIL_APP_PASSWORD\W*([a-z]{4}\s?[a-z]{4}\s?[a-z]{4}\s?[a-z]{4})\b/i) || [])[1] || '').replace(/\s+/g, '');
const label = (name, re) => (process.env[name] || (combined.match(new RegExp(name + '\\W*(' + re + ')')) || [])[1] || '').trim();
const VOICE = {
  __AZURE_SPEECH_KEY__: label('AZURE_SPEECH_KEY', '[A-Za-z0-9]{32,100}'),
  __AZURE_SPEECH_REGION__: label('AZURE_SPEECH_REGION', '[a-z0-9]{4,30}'),
  __ELEVENLABS_API_KEY__: label('ELEVENLABS_API_KEY', '(?:sk_)?[A-Za-z0-9]{32,80}') || pick(/\bsk_[a-f0-9]{40,}\b/)
};
const TOTP = (process.env.ADMIN_TOTP_SECRET || ((combined.match(/ADMIN_TOTP_SECRET\W*((?:[A-Za-z2-7]{4}\s?){4,16})/) || [])[1] || '')).replace(/\s+/g, '').toUpperCase();
// the admin's password: any characters, to the end of its line. Only its salted PBKDF2 hash goes to n8n.
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || (combined.match(/^[ \t]*ADMIN_PASSWORD[ \t]*[=:][ \t]*(.+?)[ \t]*$/m) || [])[1] || '').replace(/^(["'])(.*)\1$/, '$2');
// the comic studio's image models. An OpenAI key is any sk- key that is not Anthropic's sk-ant-
const COMIC = {
  __GEMINI_API_KEY__: label('GEMINI_API_KEY', 'AIza[\\w-]{30,45}') || pick(/\bAIza[\w-]{35}\b/),
  __OPENAI_API_KEY__: label('OPENAI_API_KEY', 'sk-[\\w-]{20,200}') || pick(/\bsk-(?!ant-)(?:proj-|svcacct-)?[\w-]{30,200}\b/)
};
const MORNING_ID = label('MORNING_CLIENT_ID', '[\\w-]{8,100}');
const MORNING_SECRET = label('MORNING_CLIENT_SECRET', '[\\w-]{8,120}');
// the key the sign-in and the leads & prices workflows share (the admin's short-lived proof is signed with it).
// Derived from the n8n API key, so it is never stored in the repository and stays the same between installs.
const SHARED = KEY ? crypto.createHmac('sha256', KEY).update('spider-shared-v1').digest('hex') : '';
// nothing secret may ever show in the Actions log (the repository is public)
for (const v of [KEY, SHARED, ADMIN_PASSWORD, CLAUDE, GMAIL_PASS, TOTP, MORNING_ID, MORNING_SECRET, ...Object.values(VOICE), ...Object.values(COMIC)]) if (v && v.length >= 6) console.log(`::add-mask::${v}`);
const out = (k, v) => fs.appendFileSync(process.env.GITHUB_OUTPUT || '/dev/null', `${k}=${v}\n`);
const summary = [];
const note = (line) => { summary.push(line); console.log(line); };

if (!BASE || !KEY) {
  console.log('::warning::The N8N_URL / N8N_API_KEY secrets are not set, so nothing was installed. See n8n/README.md.');
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY || '/dev/null', '### ⚠️ חסרים הסודות N8N_URL ו־N8N_API_KEY\nבלעדיהם GitHub לא יכול להתחבר ל־n8n.\n');
  out('deployed', 'false');
  process.exit(0);
}
if (!/^https:\/\//.test(BASE) && !/^http:\/\/localhost/.test(BASE)) throw new Error('N8N_URL must start with https://');

async function api(method, path, body) {
  const r = await fetch(`${BASE}/api/v1${path}`, {
    method,
    headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

const all = [];
let cursor = '';
do {
  const page = await api('GET', `/workflows?limit=100${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
  all.push(...(page.data || []));
  cursor = page.nextCursor || '';
} while (cursor);
const findByName = (names) => all.find((w) => names.includes(w.name));

// a credential already attached to any node of an existing workflow
function credFrom(workflows, type) {
  for (const w of workflows) for (const n of (w && w.nodes) || []) if (n.credentials && n.credentials[type]) return n.credentials[type];
  return null;
}

async function install(file, names, { creds = {}, fill = {} } = {}) {
  let raw = fs.readFileSync(file, 'utf8');
  // keys go straight from the secret into n8n, never into the repository
  for (const [k, v] of Object.entries(fill)) {
    if (!v) continue;
    if (/^[\w\-.:\/$]+$/.test(v)) raw = raw.split(k).join(v);
    else note(`- ⚠️ הערך של ${k.replace(/_/g, ' ').trim()} מכיל תווים לא נתמכים ולא הוכנס. השתמשו באותיות, ספרות, מקף וקו תחתון בלבד.`);
  }
  const wf = JSON.parse(raw);
  for (const n of wf.nodes) for (const [type, match] of Object.entries(creds)) if (match.types.includes(n.type) && match.cred) n.credentials = { [type]: match.cred };
  // n8n Cloud will not publish an enabled node without its account: with no Gmail connection yet,
  // email nodes go in disabled (and come back on at the next deploy that has one)
  for (const n of wf.nodes) if (n.type === 'n8n-nodes-base.emailSend' && !n.credentials) n.disabled = true;
  const existing = findByName([wf.name, ...names]);
  const body = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings || { executionOrder: 'v1' } };
  let id;
  if (existing) {
    const full = await api('GET', `/workflows/${existing.id}`);
    // keep credentials the user attached by hand to nodes we do not fill ourselves
    for (const n of body.nodes) {
      if (n.credentials) continue;
      const old = (full.nodes || []).find((o) => o.name === n.name && o.type === n.type && o.credentials);
      if (old) n.credentials = old.credentials;
    }
    // nodes shipped disabled until an account is attached (Drive, Slack): keep the folder / channel
    // the user picked in n8n, and switch them on once they have an account
    for (const n of body.nodes) {
      if (!n.disabled) continue;
      const old = (full.nodes || []).find((o) => o.name === n.name && o.type === n.type);
      if (old && old.credentials && n.type !== 'n8n-nodes-base.emailSend') n.parameters = { ...n.parameters, ...old.parameters };
      // no account on the node yet: use one the user already created in n8n (Drive, Slack)
      if (!n.credentials && ACCOUNT[n.type]) {
        const { cred, type, auth } = ACCOUNT[n.type];
        n.credentials = { [type]: cred };
        if (auth) n.parameters.authentication = auth;
      }
      if (n.credentials) delete n.disabled;
      note(`  · ${n.name}: ${n.disabled ? 'כבוי, עוד אין חשבון מחובר' : 'מחובר ופעיל'}`);
    }
    // the update leaves the workflow's stored data (leads, prices, clients) as it is
    id = existing.id;
    try { await api('PUT', `/workflows/${id}`, body); note(`- ${wf.name}: עודכן`); }
    finally { try { await api('POST', `/workflows/${id}/activate`); } catch {} }
    return id;
  } else {
    id = (await api('POST', '/workflows', body)).id;
    note(`- ${wf.name}: הותקן`);
  }
  await api('POST', `/workflows/${id}/activate`);
  return id;
}

// ---- credentials
const existingFull = [];
for (const w of all) { try { existingFull.push(await api('GET', `/workflows/${w.id}`)); } catch {} }
// accounts created in n8n by hand (OAuth cannot be set up through the API): from the credential
// list when the API offers it, otherwise from any workflow node that already uses one
let credList = [];
try { credList = (await api('GET', '/credentials?limit=250')).data || []; } catch {}
const account = (types) => {
  for (const t of types) {
    const c = credList.find((x) => x.type === t) || null;
    if (c) return { cred: { id: c.id, name: c.name }, type: t };
    const used = credFrom(existingFull, t);
    if (used) return { cred: used, type: t };
  }
  return null;
};
const ACCOUNT = {};
const drive = account(['googleDriveOAuth2Api', 'googleApi']);
if (drive) ACCOUNT['n8n-nodes-base.googleDrive'] = { ...drive, auth: drive.type === 'googleApi' ? 'serviceAccount' : 'oAuth2' };
const slack = account(['slackOAuth2Api', 'slackApi']);
if (slack) ACCOUNT['n8n-nodes-base.slack'] = { ...slack, auth: slack.type === 'slackOAuth2Api' ? 'oAuth2' : 'accessToken' };
note(`- חשבונות שנמצאו ב־n8n: Google Drive ${drive ? '✅ ' + drive.cred.name : '❌'} · Slack ${slack ? '✅ ' + slack.cred.name : '❌'}`);
let claude = credFrom(existingFull, 'anthropicApi');
if (!claude && CLAUDE) {
  const made = await api('POST', '/credentials', { name: 'Claude · SPIDER', type: 'anthropicApi', data: { apiKey: CLAUDE } });
  claude = { id: made.id, name: made.name };
  note('- נוצר חיבור Claude');
}
// use our own Gmail connection, not some other SMTP credential found in another workflow
let smtp = null;
for (const w of existingFull) for (const n of (w && w.nodes) || []) if (n.credentials && n.credentials.smtp && n.credentials.smtp.name === 'SPIDER · Gmail') smtp = n.credentials.smtp;
if (!smtp && !GMAIL_PASS) smtp = credFrom(existingFull, 'smtp');
if (GMAIL_PASS && !smtp) {
  // to change the password later: delete "SPIDER · Gmail" in n8n and run this again
  const made = await api('POST', '/credentials', { name: 'SPIDER · Gmail', type: 'smtp',
    data: { user: GMAIL_USER, password: GMAIL_PASS, host: 'smtp.gmail.com', port: 465, secure: true, disableStartTls: false } });
  smtp = { id: made.id, name: made.name };
  note('- נוצר חיבור Gmail לשליחת קודים');
}

// ---- workflows
const results = {};
try {
  results.agents = await install('n8n/hasadna-multi-agent.json', ['הסדנה · מערכת מולטי־אייג׳נט ומרכז בקרה', 'SPIDER · מערכת מולטי־אייג׳נט ומרכז בקרה'],
    { creds: { anthropicApi: { types: ['@n8n/n8n-nodes-langchain.lmChatAnthropic'], cred: claude },
               smtp: { types: ['n8n-nodes-base.emailSend'], cred: smtp } } });
} catch (e) { note(`- ⚠️ הסוכנים: ${e.message.slice(0, 200)}`); }
try {
  results.business = await install('n8n/hasadna-business.json', ['הסדנה · לידים ומחירון'],
    { creds: { smtp: { types: ['n8n-nodes-base.emailSend'], cred: smtp } }, fill: { __SHARED_KEY__: SHARED } });
} catch (e) { note(`- ⚠️ לידים ומחירון: ${e.message.slice(0, 200)}`); }
const accessFill = { __SHARED_KEY__: SHARED, __ADMIN_TOTP_SECRET__: TOTP, __MORNING_CLIENT_ID__: MORNING_ID, __MORNING_CLIENT_SECRET__: MORNING_SECRET };
const installAccess = (extra) => install('n8n/hasadna-access.json', ['הסדנה · כניסה והרשאות'],
  { creds: { smtp: { types: ['n8n-nodes-base.emailSend'], cred: smtp } }, fill: { ...accessFill, ...(extra || {}) } });
const post = async (path, fields, origin, extraHeaders) => {
  try {
    const r = await fetch(`${BASE}/webhook/${path}`, { method: 'POST', headers: { ...(origin ? { Origin: origin } : {}), ...(extraHeaders || {}) }, body: new URLSearchParams(fields) });
    const text = await r.text();
    let json = {}; try { json = JSON.parse(text); } catch {}
    return { status: r.status, json, text: text.slice(0, 300) };
  } catch (e) { return { status: 0, json: {}, text: String(e.message || e) }; }
};
let passwordOn = false;
try {
  results.access = await installAccess();
  // the admin's password: hashed here with the strength this n8n can compute, then installed as a hash only
  if (ADMIN_PASSWORD) {
    if (ADMIN_PASSWORD.length < 8) note('- ⚠️ ADMIN_PASSWORD קצרה מ־8 תווים ולכן לא הופעלה. בחרו סיסמה ארוכה יותר.');
    else {
      if (ADMIN_PASSWORD.length < 12) note('- ⚠️ ADMIN_PASSWORD קצרה מ־12 תווים. היא הופעלה, אבל סיסמה קצרה קל לנחש. מומלץ להוסיף אימות באפליקציה (portfolio/admin-2fa.html).');
      const hh = await post('hasadna-auth', { action: 'health' });
      const iter = hh.json.crypto === 'js' ? 20000 : 210000;
      // the same secret always gives the same hash (the salt comes from this n8n's address), so the workflow can tell
      // "the secret was changed" (reset the admin password to it) from "nothing changed" (keep the password chosen in the app)
      const salt = crypto.createHash('sha256').update('spider-admin-seed:' + BASE).digest('hex').slice(0, 32);
      const hash = `p1$${iter}$${salt}$` + crypto.pbkdf2Sync(ADMIN_PASSWORD, Buffer.from(salt, 'hex'), iter, 32, 'sha256').toString('hex');
      await installAccess({ __ADMIN_PASSWORD_HASH__: hash });
      passwordOn = true;
      note(`- ✅ הסוד ADMIN_PASSWORD הוגדר כסיסמת המנהל כשהוא משתנה (${iter} סבבי PBKDF2). סיסמה שהמנהל בחר באפליקציה נשארת כל עוד הסוד לא שונה.`);
    }
  } else note('- ℹ️ אין סוד ADMIN_PASSWORD. זה בסדר: בעמוד הכניסה לוחצים "קבלת סיסמה ראשונית למייל", נכנסים איתה ובוחרים סיסמה. הסוד נותן רק דרך חזרה בלי מייל.');
} catch (e) { note(`- ⚠️ כניסה והרשאות: ${e.message.slice(0, 200)}`); }
try {
  results.parkomat = await install('n8n/hasadna-parkomat.json', [],
    { creds: { anthropicApi: { types: ['@n8n/n8n-nodes-langchain.lmChatAnthropic'], cred: claude },
               smtp: { types: ['n8n-nodes-base.emailSend'], cred: smtp } } });
} catch (e) { note(`- ⚠️ Parkomat: ${e.message.slice(0, 200)}`); }
try {
  results.voice = await install('n8n/hasadna-voice.json', [], { fill: VOICE });
} catch (e) { note(`- ⚠️ הקול של מאיה: ${e.message.slice(0, 200)}`); }
const hasVoice = !!(VOICE.__AZURE_SPEECH_KEY__ || VOICE.__ELEVENLABS_API_KEY__);
try {
  results.comic = await install('n8n/hasadna-comic.json', [], { fill: COMIC });
} catch (e) { note(`- ⚠️ סטודיו קומיקס: ${e.message.slice(0, 200)}`); }

// ---- do they answer?
async function probe(path, init) {
  try { const r = await fetch(`${BASE}/webhook/${path}`, init); return r.status; } catch { return 0; }
}
const form = (o) => ({ method: 'POST', body: new URLSearchParams(o) });
const checks = {
  'hasadna-status': await probe('hasadna-status?format=json'),
  'hasadna-prices': await probe('hasadna-prices'),
  'hasadna-auth': await probe('hasadna-auth', form({ action: 'me', token: 'probe' })), // 401 = alive and refusing
  'parking-agents': await probe('parking-agents', form({ department: 'probe' })) // 400 = alive, no file sent
};
// the comic server: which image models it has (a status call draws nothing and costs nothing)
{
  let j = {}, st = 0;
  try {
    const r = await fetch(`${BASE}/webhook/comic-draw`, { method: 'POST', headers: { Origin: 'https://devopsdevopshaim-wq.github.io', 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ mode: 'status' }) });
    st = r.status; j = await r.json().catch(() => ({}));
  } catch {}
  checks['comic-draw'] = st;
  note(`- סטודיו קומיקס: ${st === 200 ? `✅ עונה · Gemini ${j.gemini ? '✅' : '❌ (חסר GEMINI_API_KEY)'} · OpenAI ${j.openai ? '✅' : '❌ (חסר OPENAI_API_KEY)'}` : '❌ ' + st}`);
}
// the sign-in answers, and (if the secret's password is still the admin's) it opens
{
  const inf = await post('hasadna-auth', { action: 'info' });
  checks['test-email'] = inf.json.ok ? 200 : inf.status;
  note(`- מערכת הכניסה עם מייל וסיסמה: ${inf.json.ok ? '✅ פעילה' : '❌ ' + inf.status}`);
  if (passwordOn) {
    const lg = await post('hasadna-auth', { action: 'login', email: GMAIL_USER, password: ADMIN_PASSWORD });
    if (lg.json.ok === true || lg.json.error === 'totp-needed') note(`- כניסת מנהל עם הסיסמה שבסוד: ✅ ${lg.json.error === 'totp-needed' ? 'נכונה, והמערכת מבקשת את קוד האפליקציה' : 'עובדת'} (נשלח אליך מייל "כניסת מנהל")`);
    else if (lg.json.error === 'bad-login') note('- ℹ️ הסיסמה שבסוד כבר לא הסיסמה של המנהל: הוא בחר סיסמה משלו באפליקציה. זה תקין.');
    else note(`- ❌ כניסת מנהל: ${lg.status} ${lg.json.error || lg.text}`);
    if (lg.json.token) await post('hasadna-auth', { action: 'logout', token: lg.json.token });
  }
}
// Maya's voice: a real sentence, as the site asks for it
try {
  const r = await fetch(`${BASE}/webhook/hasadna-voice`, { method: 'POST', headers: { Origin: 'https://devopsdevopshaim-wq.github.io' }, body: new URLSearchParams({ text: 'שלום, אני מאיה.' }) });
  const j = await r.json().catch(() => ({}));
  checks['hasadna-voice'] = r.status;
  note(`- הקול של מאיה: ${j.ok ? '✅ מדברת (' + Math.round(j.audio.length * 0.75 / 1024) + 'KB)' : hasVoice ? '❌ ' + r.status + ' ' + (j.error || '') + ' ' + (j.detail || '') : '⚠️ אין עדיין מפתח קול (AZURE_SPEECH_KEY + AZURE_SPEECH_REGION או ELEVENLABS_API_KEY בסוד SPIDER)'}`);
} catch (e) { note('- ❌ הקול של מאיה: ' + e.message); }
// ---- security: prove the doors are locked (from outside, the way an attacker would knock)
const EVIL = 'https://evil.example';
const SITE_ORIGIN = 'https://devopsdevopshaim-wq.github.io';
const chatId = (JSON.parse(fs.readFileSync('n8n/hasadna-multi-agent.json', 'utf8')).nodes.find((n) => n.name === 'Team chat') || {}).webhookId;
const sec = [];
const expect = (name, ok, got) => { sec.push(ok); note(`- ${ok ? '✅' : '❌'} ${name}${ok ? '' : ' (קיבלנו: ' + got + ')'}`); };
note('\n**בדיקות אבטחה**');
let r1 = await post('hasadna-auth', { action: 'me', token: 'x' }, EVIL);
expect('כניסה: בקשה מאתר זר נחסמת', r1.status === 403, r1.status);
r1 = await post('hasadna-auth', { action: 'login', email: GMAIL_USER, password: 'definitely-not-the-password' }, SITE_ORIGIN);
expect('כניסה: סיסמה שגויה למנהל נדחית', r1.status === 401 && r1.json.error === 'bad-login', `${r1.status} ${r1.text}`);
const unk = await post('hasadna-auth', { action: 'login', email: 'nobody-' + Date.now() + '@example.com', password: 'definitely-not-the-password' }, SITE_ORIGIN);
expect('כניסה: כתובת לא מוכרת מקבלת בדיוק את אותה תשובה', unk.status === 401 && unk.json.error === 'bad-login', `${unk.status} ${unk.text}`);
r1 = await post('hasadna-auth', { action: 'login', email: 'nobody@example.com', password: 'x', device: 'a'.repeat(32) }, EVIL);
expect('כניסה: ניסיון סיסמה מאתר זר נחסם', r1.status === 403, r1.status);
r1 = await post('hasadna-auth', { action: 'request', email: GMAIL_USER, phone: '0544979771' }, SITE_ORIGIN);
expect('כניסה: הכניסה הישנה עם קוד במייל הוסרה', r1.status === 400 && r1.json.error === 'unknown-action', `${r1.status} ${r1.text}`);
r1 = await post('hasadna-auth', { action: 'forgot', email: 'nobody-' + Date.now() + '@example.com' }, SITE_ORIGIN);
expect('כניסה: בקשת סיסמה ראשונית לכתובת לא רשומה נראית כמו כל בקשה, ולא נשלח מייל', r1.status === 200 && r1.json.ok === true && r1.json.sent === true, `${r1.status} ${r1.text}`);
r1 = await post('hasadna-auth', { action: 'change-password', token: 'a'.repeat(48), password: 'Whatever-123' }, SITE_ORIGIN);
expect('כניסה: אי אפשר להחליף סיסמה בלי להיות מחובר', r1.status === 401, r1.status);
// which address does n8n see for a caller? Rate limits and device records depend on it, and a header the caller writes must not win.
{
  const a1 = await post('hasadna-auth', { action: 'health' });
  const a2 = await post('hasadna-auth', { action: 'health' }, null, { 'X-Forwarded-For': '9.9.9.9' });
  expect('כתובת ה־IP של הפונה נראית ל־n8n', !!a1.json.ip && a1.json.ip !== 'unknown', a1.text);
  expect('אי אפשר לזייף כתובת IP בכותרת X-Forwarded-For', !!a2.json.ip && a2.json.ip !== '9.9.9.9', a2.text);
}
r1 = await post('hasadna-auth', { action: 'clients' });
expect('כניסה: רשימת הלקוחות סגורה בלי מנהל', r1.status === 403, r1.status);
r1 = await post('hasadna-admin', { action: 'setup', key: 'attacker-password' }, SITE_ORIGIN);
expect('לידים ומחירון: אי אפשר לקבוע סיסמה מבחוץ', r1.status === 403, r1.status);
r1 = await post('hasadna-admin', { action: 'list', token: '1' + '0'.repeat(12) + '.' + 'a'.repeat(64) }, SITE_ORIGIN);
expect('לידים ומחירון: הוכחת מנהל מזויפת נדחית', r1.status === 403 && r1.json.error === 'admin-only', `${r1.status} ${r1.text}`);
{
  // the real thing: a proof signed the way the sign-in signs it must open the door (the answer itself is not printed)
  const e = Date.now() + 5 * 60000;
  const proof = e + '.' + crypto.createHmac('sha256', SHARED).update('biz|' + e).digest('hex');
  r1 = await post('hasadna-admin', { action: 'list', token: proof, payload: '{}' }, SITE_ORIGIN);
  expect('לידים ומחירון: הוכחה תקפה מהכניסה פותחת את המסך', r1.status === 200 && r1.json.ok === true, `${r1.status} ${r1.text.slice(0, 120)}`);
  const old = Date.now() - 1000;
  r1 = await post('hasadna-admin', { action: 'list', token: old + '.' + crypto.createHmac('sha256', SHARED).update('biz|' + old).digest('hex') }, SITE_ORIGIN);
  expect('לידים ומחירון: הוכחה שפגה נדחית', r1.status === 403, r1.status);
}
r1 = await post('hasadna-lead', { name: 'x', phone: '0500000000' }, EVIL);
expect('לידים: טופס מאתר זר נחסם', r1.status === 403, r1.status);
try {
  const g = await fetch(`${BASE}/webhook/hasadna-guide`, { method: 'POST', headers: { Origin: EVIL, 'Content-Type': 'application/json' }, body: JSON.stringify({ question: 'בדיקה', sessionId: 'probe' }) });
  const gj = await g.json().catch(() => ({}));
  expect('מאיה: שאלה מאתר זר לא מגיעה ל־Claude', /אי אפשר לפנות/.test(gj.answer || ''), g.status);
} catch (e) { expect('מאיה: שאלה מאתר זר לא מגיעה ל־Claude', false, e.message); }
r1 = await post('hasadna-voice', { text: 'בדיקה' });
expect('קול: בקשה בלי Origin נחסמת', r1.status === 403, r1.status);
if (chatId) {
  let cs = 0; try { cs = (await fetch(`${BASE}/webhook/${chatId}/chat`)).status; } catch {}
  expect('צ׳אט n8n הציבורי כבוי', cs === 404 || cs === 403, cs);
}
const totpOn = !!TOTP;
note(`- ${totpOn ? '✅' : '⚠️'} אימות דו־שלבי למנהל (אפליקציה): ${totpOn ? 'פעיל' : 'לא הוגדר. הכניסה כמנהל מוגנת רק בסיסמה. הגדרה: portfolio/admin-2fa.html'}`);
const secure = sec.every(Boolean);
if (!secure) console.log('::warning::חלק מבדיקות האבטחה נכשלו, ראו את הסיכום.');

for (const [k, v] of Object.entries(checks)) note(`- /webhook/${k}: ${v === 200 || (k === 'hasadna-auth' && v === 401) || (k === 'parking-agents' && v === 400) || (k === 'hasadna-voice' && v === 503) ? '✅ עונה' : '❌ ' + v}`);
if (!smtp) note('- ⚠️ אין חיבור לשליחת מיילים: הוסיפו את הסוד GMAIL_APP_PASSWORD והריצו שוב. עד אז קודי הכניסה לא יישלחו.');
if (!claude) note('- ⚠️ אין חיבור Claude: הוסיפו את הסוד ANTHROPIC_API_KEY והריצו שוב.');

// ---- point the portfolio at the live endpoints
const pj = 'portfolio/projects.json';
const data = JSON.parse(fs.readFileSync(pj, 'utf8'));
const guideApi = `${BASE}/webhook/hasadna-guide`, statusUrl = `${BASE}/webhook/hasadna-status`;
const changed = data.guideApi !== guideApi || data.statusUrl !== statusUrl;
if (changed) { data.guideApi = guideApi; data.statusUrl = statusUrl; fs.writeFileSync(pj, JSON.stringify(data, null, 1) + '\n'); }

const ok = checks['hasadna-auth'] === 401 && checks['test-email'] === 200;
out('deployed', 'true');
out('changed', String(changed));
out('access_ready', String(ok));
out('secure', String(secure));
fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY || '/dev/null', `### SPIDER ב־n8n\n${summary.join('\n')}\n\n${ok ? '✅ מערכת הכניסה מוכנה. אפשר להפעיל את הנעילה (portfolio/access.json).' : ''}\n`);
