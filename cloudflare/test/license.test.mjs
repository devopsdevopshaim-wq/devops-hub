// A licence on two computers, one working at a time (n8n/snippets/access-handle.js: lic-activate, lic-check), run against the
// generated handler (node build.mjs first) with a state of its own and a clock that can move.
import * as nodeCrypto from 'node:crypto';
import handle from '../src/gen/handle.mjs';

let bad = 0;
const check = (n, ok, x) => { if (!ok) { bad++; console.error('FAIL', n, x === undefined ? '' : JSON.stringify(x)); } else console.log('ok  ', n); };
const sd = {};
const realNow = Date.now; let shift = 0; Date.now = () => realNow() + shift;
const requireShim = (m) => { if (m === 'crypto') return nodeCrypto; throw new Error('module not allowed: ' + m); };
let ip = 1;
async function call(body) {
  const ctx = { $json: { body, headers: { 'x-forwarded-for': '10.0.0.' + (ip++ % 200), 'user-agent': 'test' } }, $getWorkflowStaticData: () => sd, require: requireShim, $: () => ({ first: () => ({ json: {} }), all: () => [] }), ENV: {}, helpers: {} };
  const r = (await handle(ctx))[0].json; return r.body || r;
}
const M = { A: 'a'.repeat(32), B: 'b'.repeat(32), C: 'c'.repeat(32), D: 'd'.repeat(32), E: 'e'.repeat(32) };
const CODE = 'FS-ABCD-EFGH-JKMN-PQRS';
// first call makes the state; then the licences go in
await call({ action: 'health' });
sd.licenses = sd.licenses || {};
sd.licenses['pro@x.com'] = { email: 'pro@x.com', name: 'Pro', code: CODE, active: true, paid: true, createdAt: new Date().toISOString(), history: [] };
sd.licenses['trial@x.com'] = { email: 'trial@x.com', name: 'Trial', code: 'FS-TTTT-TTTT-TTTT-TTTT', active: true, trial: { start: new Date().toISOString(), events: [] }, createdAt: new Date().toISOString(), history: [] };
const act = (e, code, m, extra) => call(Object.assign({ action: 'lic-activate', email: e, code, machine: m, agree: 'v1', desktop: '1', platform: 'win32', version: '1.0.9' }, extra || {}));
const chk = (t, m, extra) => call(Object.assign({ action: 'lic-check', token: t, machine: m, version: '1.0.9' }, extra || {}));

let a = await act('pro@x.com', CODE, M.A); check('computer 1 activates', a.ok && a.token, a);
let b = await act('pro@x.com', CODE, M.B); check('computer 2 (the backup) activates too', b.ok && b.token, b);
check('the licence keeps two computers', !!sd.licenses['pro@x.com'].machine && !!sd.licenses['pro@x.com'].machine2);
let r = await chk(b.token, M.B); check('computer 2 is told computer 1 works now', !r.ok && r.error === 'license-elsewhere', r);
r = await chk(a.token, M.A); check('computer 1 keeps working', r.ok, r);
r = await chk(b.token, M.B, { takeover: '1' }); check('"להפעיל כאן" on computer 2 takes over', r.ok, r);
r = await chk(a.token, M.A); check('then computer 1 stops', !r.ok && r.error === 'license-elsewhere', r);
r = await chk(b.token, M.B); check('and computer 2 goes on', r.ok, r);
let c = await act('pro@x.com', CODE, M.C); check('a third computer is refused', !c.ok && c.error === 'license-in-use', c);
shift = 5 * 60000;
r = await chk(a.token, M.A); check('when computer 2 is closed (no check for 5 minutes) computer 1 works without asking', r.ok, r);
r = await chk(b.token, M.B); check('and computer 2 is then the one told', !r.ok && r.error === 'license-elsewhere', r);
let t1 = await act('trial@x.com', 'FS-TTTT-TTTT-TTTT-TTTT', M.D); check('a trial activates on one computer', t1.ok, t1);
let t2 = await act('trial@x.com', 'FS-TTTT-TTTT-TTTT-TTTT', M.E); check('a trial gets no second computer', !t2.ok && t2.error === 'license-in-use', t2);
r = await chk(a.token, M.B); check('a token cannot be used from the other computer', !r.ok && r.error === 'license-moved', r);
Date.now = realNow;
console.log(bad ? bad + ' failed' : 'all passed');
process.exit(bad ? 1 : 0);
