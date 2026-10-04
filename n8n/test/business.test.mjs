import { run, check, workflow, nodeCode, crypto } from './harness.mjs';

const wf = workflow('hasadna-business.json');
const SITE = 'https://devopsdevopshaim-wq.github.io';
const SHARED = 'shared-test-key';
const LEAD = nodeCode(wf, 'Lead · Save');
const PRICES = nodeCode(wf, 'Prices · Read');
const ADMIN = nodeCode(wf, 'Admin · Handle').replace('__SHARED_KEY__', SHARED);
let T = 1_800_000_000_000; Date.now = () => T;

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

// ---- admin: only with the sign-in's signed proof
const proof = (exp = T + 30 * 60000, key = SHARED) => exp + '.' + crypto.createHmac('sha256', key).update('biz|' + exp).digest('hex');
const admin = async (body, ip = '9.9.9.9', origin, code = ADMIN) => (await run(code, { json: { body, headers: hdr(ip, origin) }, sd }))[0].json;
sd.adminKey = 'old-plain-password';

r = await admin({ action: 'list' });
check('admin: no proof, no entry', r.code === 403);
r = await admin({ action: 'setup', key: 'newpassword1' });
check('admin: the old "setup" door is gone', r.code === 403 && !sd.adminKey);
r = await admin({ action: 'list', token: proof() }, '9.9.9.9', 'https://evil.example');
check('admin: foreign origin refused', r.code === 403);
r = await admin({ action: 'list', token: proof(T + 60000, 'another-key') });
check('admin: a proof signed with another key is refused', r.code === 403);
r = await admin({ action: 'list', token: 'a'.repeat(48) });
check('admin: an ordinary session token is not a proof', r.code === 403);
r = await admin({ action: 'list', token: proof(T - 1000) });
check('admin: an expired proof is refused', r.code === 403);
r = await admin({ action: 'list', token: proof(T + 3 * 3600000) });
check('admin: a proof valid for hours is refused', r.code === 403);
r = await admin({ action: 'list', token: proof(T + 30 * 60000 + 1).replace(/.$/, (c) => (c === 'a' ? 'b' : 'a')) });
check('admin: a tampered signature is refused', r.code === 403);
r = await admin({ action: 'list', token: proof() }, '9.9.9.9', undefined, nodeCode(wf, 'Admin · Handle'));
check('admin: with no shared key installed, everything is refused', r.code === 403);
r = await admin({ action: 'list', token: proof() });
check('admin: a good proof opens the door', r.code === 200 && r.body.ok && Array.isArray(r.body.leads));

r = await admin({ action: 'prices', token: proof(), payload: JSON.stringify({ services: { web: { title: 'אתר', from: 1500 } }, plans: { month: 99 }, offers: [] }) });
check('admin: prices can be saved', r.body.ok && sd.prices.plans.month === 99);
r = await admin({ action: 'password', token: proof(), payload: JSON.stringify({ newKey: 'abcdefgh1' }) });
check('admin: there is no password action', r.body.error === 'unknown-action');
r = await admin({ action: 'lead-delete', token: proof(), payload: JSON.stringify({ id: sd.leads[0].id }) });
check('admin: leads can be deleted', r.body.ok);
let lim = 0; for (let i = 0; i < 130; i++) { const x = await admin({ action: 'list', token: proof() }, '4.4.4.4'); if (x.code === 429) lim++; }
check('admin: calls are rate limited', lim > 0, lim);
