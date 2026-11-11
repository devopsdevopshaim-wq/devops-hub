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
  const r = (await handle(ctx))[0].json; last = r; return r.body || r;
}
let last = null;
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

// ---- the customer moves the licence to a new computer by himself
shift = 6 * 60000;
r = await chk(b.token, M.B, { takeover: '1' }); check('computer 2 works (setup for the move)', r.ok, r);
let mv = await call({ action: 'lic-move-code', email: 'pro@x.com', code: CODE, machine: M.C });
const sent = last.mail || {}, mailed = (/(\d{6})/.exec(sent.subject || '') || [])[1];
check('a move code goes to the licence email', mv.ok && sent.to === 'pro@x.com' && !!mailed, { mv, sent });
mv = await call({ action: 'lic-move', email: 'pro@x.com', code: CODE, machine: M.C, mailCode: '000000' === mailed ? '111111' : '000000' });
check('a wrong mail code is refused', !mv.ok && mv.error === 'bad-code', mv);
mv = await call({ action: 'lic-move', email: 'pro@x.com', code: CODE, machine: M.C, mailCode: mailed });
check('the right code moves the licence', mv.ok && mv.moved, mv);
check('the owner hears of it', last.mail && /העביר/.test(last.mail.subject || ''), last.mail);
check('the computer not working now gave its place (computer 1), computer 2 stays', sd.licenses['pro@x.com'].machine !== undefined && mv.slot === 1, mv);
let cc = await act('pro@x.com', CODE, M.C); check('the new computer signs in as usual', cc.ok, cc);
r = await chk(a.token, M.A); check('the old computer is out', !r.ok && (r.error === 'license-moved' || r.error === 'signed-out'), r);
mv = await call({ action: 'lic-move-code', email: 'pro@x.com', code: CODE, machine: M.A });
check('a second move within 30 days is refused', !mv.ok && mv.error === 'move-limit', mv);
mv = await call({ action: 'lic-move-code', email: 'pro@x.com', code: 'FS-XXXX-XXXX-XXXX-XXXX', machine: M.D });
check('a wrong licence code gets no move code', !mv.ok && mv.error === 'bad-license', mv);

// ---- updates: only a licence bought for good pays for one; a subscriber (month / year) and a trial get it included
const ADM = 'f'.repeat(48);
sd.sessions[nodeCrypto.createHash('sha256').update(ADM).digest('hex')] = { role: 'admin', email: 'devopsdevopshaim@gmail.com', exp: Date.now() + 86400000 };
sd.appUpd = { price: 49, versions: [{ ver: '1.0.12', notes: 'חדש', price: 49, at: new Date().toISOString() }] };
sd.licSettings = Object.assign(sd.licSettings || {}, { bankInfo: { holder: 'חיים', bank: '12', branch: '345', account: '678901' } });
sd.licenses['sub@x.com'] = { email: 'sub@x.com', name: 'Sub', code: 'FS-SSSS-SSSS-SSSS-SSSS', active: true, paid: true, paidUntil: new Date(Date.now() + 20 * 86400000).toISOString(), appVer: '1.0.9', createdAt: new Date().toISOString(), history: [] };
let sa = await act('sub@x.com', 'FS-SSSS-SSSS-SSSS-SSSS', M.D, { version: '1.0.9' });
check('a subscriber sees the update as included, ready to install', sa.ok && sa.upd.who === 'sub' && sa.upd.incl && sa.upd.allowed && !!sa.upd.latest.url, sa.upd);
r = await call({ action: 'lic-check', token: sa.token, machine: M.D, version: '1.0.12' });
check('... and the new version runs without a lock', r.ok && !r.upd.locked && sd.licenses['sub@x.com'].appVer === '1.0.12', r.upd);
r = await call({ action: 'lic-check', token: cc.token, machine: M.C, version: '1.0.9', takeover: '1' });
check('the full licence (bought for good) sees the update with its price, not yet open', r.ok && r.upd.who === 'full' && !r.upd.allowed && r.upd.latest.price === 49, r.upd);
r = await call({ action: 'lic-check', token: cc.token, machine: M.C, version: '1.0.12', takeover: '1' });
check('... and the unpaid version is locked', r.ok && r.upd.locked, r.upd);
r = await call({ action: 'upd-request', token: cc.token, ver: '1.0.12', version: '1.0.9', agree: '1' });
check('approving the update and the payment gives the payment details', r.ok && r.pay && r.pay.amount === 49 && r.pay.account === '678901' && /^UPD-/.test(r.pay.ref), r);
check('... mailed to the licence holder, the owner told', last.mail && last.mail.to === 'pro@x.com' && /פרטי תשלום/.test(last.mail.subject) && last.mail2 && /אישור עדכון ותשלום/.test(last.mail2.subject), { m: last.mail && last.mail.subject, m2: last.mail2 && last.mail2.subject });
r = await call({ action: 'upd-request', token: cc.token, ver: '1.0.12', version: '1.0.9', paid: '1', method: 'ביט', ref: '7788' });
check('"שילמתי" tells the owner how and the reference', r.ok && /שולם/.test(last.mail.subject) && /7788/.test(last.mail.text) && sd.licenses['pro@x.com'].updReq.paid.ref === '7788', last.mail);
r = await call({ action: 'upd-grant', token: ADM, email: 'pro@x.com', ver: '1.0.12', amount: '49', method: 'ביט' });
check('the owner approves: a receipt to the customer and a copy to the owner', r.ok && r.receipt && last.mail.to === 'pro@x.com' && /קבלה/.test(last.mail.subject) && /עדכון לגרסה 1.0.12/.test(last.mail.text) && /7788/.test(last.mail.text) && last.mail2 && /העתק/.test(last.mail2.subject), { r, m: last.mail });
r = await call({ action: 'lic-check', token: cc.token, machine: M.C, version: '1.0.12', takeover: '1' });
check('... and the update opens for him', r.ok && !r.upd.locked && !sd.licenses['pro@x.com'].updReq, r.upd);
check('an update payment does not count as buying a licence', sd.licenses['pro@x.com'].payments.filter((p) => p.kind === 'update').length === 1);
Date.now = realNow;
console.log(bad ? bad + ' failed' : 'all passed');
process.exit(bad ? 1 : 0);
