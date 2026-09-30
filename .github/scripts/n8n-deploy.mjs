// Installs n8n/hasadna-multi-agent.json in n8n Cloud through the n8n public API,
// connects Claude, activates it, and points the portfolio at it.
// Env: N8N_URL (https://<name>.app.n8n.cloud), N8N_API_KEY, ANTHROPIC_API_KEY (first run only),
// or all three together in HAIM_WEB_KEY.
import fs from 'node:fs';

// The three values can also arrive together in one secret (HAIM_WEB_KEY), in any
// layout: they are picked out by their shape.
const combined = process.env.HAIM_WEB_KEY || '';
const pick = (re) => (combined.match(re) || [])[0] || '';
const BASE = (process.env.N8N_URL || pick(/https:\/\/[a-z0-9-]+\.app\.n8n\.cloud/i)).trim().replace(/\/+$/, '');
const KEY = (process.env.N8N_API_KEY || pick(/eyJ[\w-]+\.[\w-]+\.[\w-]+/)).trim();
const CLAUDE = (process.env.ANTHROPIC_API_KEY || pick(/sk-ant-[\w-]+/)).trim();
const FILE = 'n8n/hasadna-multi-agent.json';
const CRED_NAME = 'Claude · הסדנה';
const out = (k, v) => fs.appendFileSync(process.env.GITHUB_OUTPUT || '/dev/null', `${k}=${v}\n`);

if (!BASE || !KEY) {
  console.log('::notice::N8N_URL / N8N_API_KEY secrets are not set — nothing to deploy. See n8n/README.md.');
  out('deployed', 'false');
  process.exit(0);
}
if (!/^https:\/\//.test(BASE)) throw new Error('N8N_URL must start with https://');

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

const wf = JSON.parse(fs.readFileSync(FILE, 'utf8'));

// find an existing copy by name
let existing = null, cursor = '';
do {
  const page = await api('GET', `/workflows?limit=100${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
  existing = existing || (page.data || []).find((w) => w.name === wf.name);
  cursor = page.nextCursor || '';
} while (!existing && cursor);

// reuse the Claude credential already attached, or create one
let cred = null;
if (existing) {
  const full = await api('GET', `/workflows/${existing.id}`);
  for (const n of full.nodes || []) if (n.credentials && n.credentials.anthropicApi) { cred = n.credentials.anthropicApi; break; }
}
if (!cred) {
  if (!CLAUDE) throw new Error('No Claude credential yet: add the ANTHROPIC_API_KEY secret for the first deploy.');
  const made = await api('POST', '/credentials', { name: CRED_NAME, type: 'anthropicApi', data: { apiKey: CLAUDE } });
  cred = { id: made.id, name: made.name };
  console.log('created credential', cred.name);
}
for (const n of wf.nodes) if (n.type === '@n8n/n8n-nodes-langchain.lmChatAnthropic') n.credentials = { anthropicApi: cred };

const body = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: { executionOrder: 'v1' } };
let id;
if (existing) {
  await api('PUT', `/workflows/${existing.id}`, body);
  id = existing.id;
  console.log('updated workflow', id);
} else {
  id = (await api('POST', '/workflows', body)).id;
  console.log('created workflow', id);
}
try {
  await api('POST', `/workflows/${id}/activate`);
  console.log('activated');
} catch (e) {
  console.log('::warning::Could not activate: ' + e.message +
    '\nIf another workflow already uses /webhook/hasadna-guide (the older single-agent Guy), deactivate it in n8n and run this again.');
  throw e;
}

// point the portfolio at the live agents and control center
const pj = 'portfolio/projects.json';
const data = JSON.parse(fs.readFileSync(pj, 'utf8'));
const guideApi = `${BASE}/webhook/hasadna-guide`;
const statusUrl = `${BASE}/webhook/hasadna-status`;
const changed = data.guideApi !== guideApi || data.statusUrl !== statusUrl;
if (changed) {
  const next = {};
  for (const [k, v] of Object.entries(data)) {
    next[k] = v;
    if (k === 'owner') { next.guideApi = guideApi; next.statusUrl = statusUrl; }
  }
  next.guideApi = guideApi; next.statusUrl = statusUrl;
  fs.writeFileSync(pj, JSON.stringify(next, null, 1) + '\n');
}
out('deployed', 'true');
out('changed', String(changed));
out('workflow', `${BASE}/workflow/${id}`);
out('status', statusUrl);
console.log(`\nControl center: ${statusUrl}\nWorkflow: ${BASE}/workflow/${id}`);
