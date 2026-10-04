// Installs SPIDER's n8n workflows in n8n Cloud through the n8n public API, with
// their credentials, activates them, checks that they answer, and points the
// portfolio at them.
//
//   n8n/hasadna-multi-agent.json  Maya and the agent team, monitor, control center (Claude)
//   n8n/hasadna-business.json     leads and the price list (keeps its stored leads on update)
//   n8n/hasadna-access.json       sign-in codes, clients, payments (Gmail SMTP)
//   n8n/hasadna-voice.json        Maya's female voice for browsers without one (Azure Speech or ElevenLabs)
//   n8n/hasadna-parkomat.json     Parkomat's robotic-parking agents: questionnaires from פארק־פלאן (Claude + lead email)
//
// Secrets: N8N_URL, N8N_API_KEY (or both inside HAIM_WEB_KEY),
//          ANTHROPIC_API_KEY (only until a Claude credential exists in n8n),
//          GMAIL_APP_PASSWORD (+ optional GMAIL_USER) for the sign-in emails,
//          AZURE_SPEECH_KEY + AZURE_SPEECH_REGION (or ELEVENLABS_API_KEY) for Maya's voice.
import fs from 'node:fs';

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
  for (const [k, v] of Object.entries(fill)) if (/^[\w-]+$/.test(v)) raw = raw.split(k).join(v);
  const wf = JSON.parse(raw);
  for (const n of wf.nodes) for (const [type, match] of Object.entries(creds)) if (match.types.includes(n.type) && match.cred) n.credentials = { [type]: match.cred };
  const existing = findByName([wf.name, ...names]);
  const body = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: { executionOrder: 'v1' } };
  let id;
  if (existing) {
    const full = await api('GET', `/workflows/${existing.id}`);
    // keep credentials the user attached by hand to nodes we do not fill ourselves
    for (const n of body.nodes) {
      if (n.credentials) continue;
      const old = (full.nodes || []).find((o) => o.name === n.name && o.type === n.type && o.credentials);
      if (old) n.credentials = old.credentials;
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
    { creds: { anthropicApi: { types: ['@n8n/n8n-nodes-langchain.lmChatAnthropic'], cred: claude } } });
} catch (e) { note(`- ⚠️ הסוכנים: ${e.message.slice(0, 200)}`); }
try {
  results.business = await install('n8n/hasadna-business.json', ['הסדנה · לידים ומחירון'], {});
} catch (e) { note(`- ⚠️ לידים ומחירון: ${e.message.slice(0, 200)}`); }
try {
  results.access = await install('n8n/hasadna-access.json', ['הסדנה · כניסה והרשאות'],
    { creds: { smtp: { types: ['n8n-nodes-base.emailSend'], cred: smtp } } });
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
// a real sign-in code to the admin's own inbox proves the email path end to end
if (smtp) {
  try {
    const r = await fetch(`${BASE}/webhook/hasadna-auth`, form({ action: 'request', email: GMAIL_USER, phone: '0544979771' }));
    const j = await r.json().catch(() => ({}));
    checks['test-email'] = r.status;
    note(`- מייל בדיקה עם קוד כניסה אל ${GMAIL_USER}: ${r.ok && j.ok ? '✅ נשלח' : '❌ ' + r.status + ' ' + (j.error || '')}`);
  } catch (e) { note('- ❌ מייל בדיקה: ' + e.message); }
}
// Maya's voice: a real sentence, as the site asks for it
try {
  const r = await fetch(`${BASE}/webhook/hasadna-voice`, { method: 'POST', headers: { Origin: 'https://devopsdevopshaim-wq.github.io' }, body: new URLSearchParams({ text: 'שלום, אני מאיה.' }) });
  const j = await r.json().catch(() => ({}));
  checks['hasadna-voice'] = r.status;
  note(`- הקול של מאיה: ${j.ok ? '✅ מדברת (' + Math.round(j.audio.length * 0.75 / 1024) + 'KB)' : hasVoice ? '❌ ' + r.status + ' ' + (j.error || '') + ' ' + (j.detail || '') : '⚠️ אין עדיין מפתח קול (AZURE_SPEECH_KEY + AZURE_SPEECH_REGION או ELEVENLABS_API_KEY בסוד SPIDER)'}`);
} catch (e) { note('- ❌ הקול של מאיה: ' + e.message); }
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
fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY || '/dev/null', `### SPIDER ב־n8n\n${summary.join('\n')}\n\n${ok ? '✅ מערכת הכניסה מוכנה. אפשר להפעיל את הנעילה (portfolio/access.json).' : ''}\n`);
