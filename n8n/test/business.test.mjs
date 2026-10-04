import { run, check, workflow, nodeCode } from './harness.mjs';

const wf = workflow('hasadna-business.json');
const SITE = 'https://devopsdevopshaim-wq.github.io';
const LEAD = nodeCode(wf, 'Lead · Save');
const PRICES = nodeCode(wf, 'Prices · Read');
const ADMIN = nodeCode(wf, 'Admin · Handle').replace('__N8N_URL__', 'https://example.app.n8n.cloud');
let T = 1_800_000_000_000; Date.now = () => T;
const TOKEN = 'a'.repeat(48);

const sd = {};
const hdr = (ip, origin = SITE) => ({ 'x-forwarded-for': 'fake, ' + ip, ...(origin === null ? {} : { origin }) });
const lead = async (body, ip = '5.5.5.5', origin) => (await run(LEAD, { json: { body, headers: hdr(ip, origin) }, sd }))[0].json;

// ---- leads
let r = await lead({ name: 'דנה', phone: '0501234567', service: 'אתר' }, '5.5.5.1', 'https://evil.example');
check('lead from a foreign origin refused', r.code === 403);
r = await lead({ name: 'דנה\nBcc: x@y.z', phone: '0501234567', service: 'אתר' });
check('lead saved, newline removed', r.code === 200 && r.body.ok && !/\n/.test(r.lead.name));
r = await lead({ name: 'x', msg: 'y'.repeat(7000) });
check('huge lead refused', r.code === 413);
let blocked = 0; for (let i = 0; i < 8; i++) { const x = await lead({ name: 'n' + i, phone: '0501234567' }, '5.5.5.9'); if (x.code === 429) blocked++; }
check('one address cannot flood the leads', blocked >= 3, blocked);
for (let i = 0; i < 40; i++) await lead({ kind: 'click', source: 'src-' + i }, '6.6.6.' + i);
check('the click sources stay bounded', Object.keys(sd.clicks).length <= 31, Object.keys(sd.clicks).length);
r = await lead({ name: 'bot', phone: '1', website: 'http://spam' }, '7.7.7.7');
check('honeypot is answered but nothing is saved', r.code === 200 && !sd.leads.some((l) => l.name === 'bot'));

// ---- prices
r = (await run(PRICES, { json: { headers: hdr('8.8.8.8', 'https://evil.example') }, sd }))[0].json;
check('prices: foreign origin refused', r.code === 403);
r = (await run(PRICES, { json: { headers: hdr('8.8.8.8') }, sd }))[0].json;
check('prices: the site can read them', r.code === 200 && r.body.ok);

// ---- admin: only through the main sign-in
sd.adminKey = 'old-plain-password';
let calls = 0, answer = { statusCode: 401, body: { ok: false, error: 'signed-out' } };
const helpers = { httpRequest: async (o) => { calls++; if (o.url !== 'https://example.app.n8n.cloud/webhook/hasadna-auth' || o.body !== 'action=me&token=' + TOKEN) throw new Error('bad call'); return answer; } };
const admin = async (body, ip = '9.9.9.9', origin) => (await run(ADMIN, { json: { body, headers: hdr(ip, origin) }, sd, helpers }))[0].json;

r = await admin({ action: 'list' });
check('admin: no token, no entry', r.code === 403 && calls === 0);
r = await admin({ action: 'setup', key: 'newpassword1' });
check('admin: the old "setup" door is gone', r.code === 403 && !sd.adminKey);
r = await admin({ action: 'list', token: TOKEN }, '9.9.9.9', 'https://evil.example');
check('admin: foreign origin refused', r.code === 403 && calls === 0);
r = await admin({ action: 'list', token: TOKEN });
check('admin: a token the sign-in does not know is refused', r.code === 403 && r.body.error === 'admin-only' && calls === 1);
answer = { statusCode: 200, body: { ok: true, role: 'client', name: 'x' } };
T += 61000;
r = await admin({ action: 'list', token: TOKEN });
check('admin: a client session is not an admin', r.code === 403);
answer = { statusCode: 200, body: { ok: true, role: 'admin' } };
T += 61000;
r = await admin({ action: 'list', token: TOKEN });
check('admin: the admin session is accepted', r.code === 200 && r.body.ok && Array.isArray(r.body.leads));
const c0 = calls;
r = await admin({ action: 'list', token: TOKEN });
check('admin: the answer is remembered for a minute', r.body.ok && calls === c0);
check('admin: only the hash of the token is stored', !JSON.stringify(sd).includes(TOKEN));
T += 61000; answer = { statusCode: 401, body: { ok: false, error: 'signed-out' } };
r = await admin({ action: 'list', token: TOKEN });
check('admin: after a minute it asks again, and a signed-out admin is refused', r.code === 403);
T += 61000; answer = { statusCode: 500, body: {} };
r = await admin({ action: 'list', token: TOKEN });
check('admin: if the sign-in is broken, it fails closed', r.code === 502 && r.body.error === 'auth-error');
helpers.httpRequest = async () => { throw new Error('ECONNREFUSED'); };
r = await admin({ action: 'list', token: TOKEN });
check('admin: if the sign-in is unreachable, it fails closed', r.code === 502 && r.body.error === 'auth-unreachable');

helpers.httpRequest = async () => ({ statusCode: 200, body: { ok: true, role: 'admin' } });
T += 61000;
r = await admin({ action: 'prices', token: TOKEN, payload: JSON.stringify({ services: { web: { title: 'אתר', from: 1500 } }, plans: { month: 99 }, offers: [] }) });
check('admin: prices can be saved', r.body.ok && sd.prices.plans.month === 99);
r = await admin({ action: 'password', token: TOKEN, payload: JSON.stringify({ newKey: 'abcdefgh1' }) });
check('admin: there is no password action', r.body.error === 'unknown-action');
r = await admin({ action: 'lead-delete', token: TOKEN, payload: JSON.stringify({ id: sd.leads[0].id }) });
check('admin: leads can be deleted', r.body.ok);
let lim = 0; for (let i = 0; i < 130; i++) { const x = await admin({ action: 'list', token: TOKEN }, '4.4.4.4'); if (x.code === 429) lim++; }
check('admin: calls are rate limited', lim > 0, lim);
