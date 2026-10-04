import { run, check, workflow, nodeCode } from './harness.mjs';

const wf = workflow('hasadna-access.json');
const BASE_CODE = nodeCode(wf, 'Auth · Handle');
const SITE = 'https://devopsdevopshaim-wq.github.io';
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';   // RFC 6238 test key

let T = 1_800_000_000_000;
Date.now = () => T;

import { crypto as _crypto } from './harness.mjs';
const require_h = (code, e) => _crypto.createHash('sha256').update(code + ':' + e).digest('hex');

async function scenario(tag, { totp = false, noCrypto = false } = {}) {
  const code = (totp ? BASE_CODE.replace('__ADMIN_TOTP_SECRET__', SECRET) : BASE_CODE).replace('__SHARED_KEY__', 'shared-test-key');
  const sd = {};
  let n = 0;
  const call = async (body, { origin = SITE, ip = '1.1.1.' + (++n % 250) } = {}) => {
    const json = { body, headers: { 'x-forwarded-for': 'spoofed, ' + ip, ...(origin === null ? {} : { origin }) } };
    return (await run(code, { json, sd, noCrypto }))[0].json;
  };
  const codeFrom = (r) => (r.mail && /הקוד שלך: (\d{6})/.exec(r.mail.text) || [])[1];
  const ADMIN = { email: 'devopsdevopshaim@gmail.com', phone: '054-4979771' };
  const T0 = tag + ' ';

  // origin
  let r = await call({ action: 'me', token: 'x' }, { origin: 'https://evil.example' });
  check(T0 + 'foreign origin refused', r.code === 403 && r.body.error === 'forbidden');
  r = await call({ action: 'me', token: 'x' }, { origin: null });
  check(T0 + 'no origin (not a browser) reaches the token check', r.code === 401);
  r = await call({ action: 'x', pad: 'a'.repeat(31000) });
  check(T0 + 'huge body refused', r.code === 413);

  // unknown people learn nothing
  r = await call({ action: 'request', email: 'nobody@example.com', phone: '0501234567' });
  check(T0 + 'unknown request looks like success, sends nothing', r.code === 200 && r.body.ok && !r.mail);

  // admin sign-in
  T += 40000;
  r = await call({ action: 'request', ...ADMIN });
  const c1 = codeFrom(r);
  check(T0 + 'admin gets a 6-digit code', /^\d{6}$/.test(c1 || ''));
  check(T0 + 'the code is stored hashed', !JSON.stringify(sd).includes(c1) && sd.otp[ADMIN.email].h.length === 64);
  r = await call({ action: 'request', ...ADMIN });
  check(T0 + 'a second request within 30 s waits', r.code === 429 && r.body.error === 'wait');
  T += 31000;
  r = await call({ action: 'request', ...ADMIN });
  check(T0 + 'a stranger asking again cannot cancel the owner\'s code', r.body.ok && !r.mail && sd.otp[ADMIN.email].h === require_h(c1, ADMIN.email));

  r = await call({ action: 'verify', ...ADMIN, code: c1 === '000000' ? '111111' : '000000' });
  check(T0 + 'wrong code counted', r.code === 400 && r.body.left === 4, r.body);

  let login;
  if (!totp) {
    login = await call({ action: 'verify', ...ADMIN, code: c1 });
    check(T0 + 'right code signs the admin in', login.body.ok && login.body.role === 'admin' && /^[a-f0-9]{48}$/.test(login.body.token));
    check(T0 + 'admin sign-in sends an alert email', login.mail && login.mail.alert && login.mail.to === ADMIN.email);
  } else {
    r = await call({ action: 'verify', ...ADMIN, code: c1 });
    check(T0 + 'admin without the authenticator code is asked for it', r.code === 401 && r.body.error === 'totp-needed');
    check(T0 + 'no session was created yet', Object.keys(sd.sessions).length === 0);
    r = await call({ action: 'verify', ...ADMIN, code: c1, totp: '000000' });
    check(T0 + 'a wrong authenticator code is refused', r.code === 400 && r.body.error === 'wrong-totp', r.body);
    const { run: _r } = await import('./harness.mjs');
    const step = Math.floor(T / 30000);
    const good = (await run(`${BASE_CODE.slice(0, BASE_CODE.indexOf('const ADMIN_EMAIL'))}\nconst sd={},now=1;return [{json:{c: totpAt('${SECRET}', ${step})}}]`, { json: {}, noCrypto }))[0].json.c;
    login = await call({ action: 'verify', ...ADMIN, code: c1, totp: good });
    check(T0 + 'code + authenticator code signs the admin in', login.body.ok && login.body.role === 'admin', login.body);
    // the same authenticator code cannot be used twice
    T += 40000;
    r = await call({ action: 'request', ...ADMIN });
    const c2 = codeFrom(r);
    r = await call({ action: 'verify', ...ADMIN, code: c2, totp: good });
    check(T0 + 'an authenticator code cannot be replayed', r.code === 400 && r.body.error === 'wrong-totp', r.body);
  }
  const token = login.body.token;
  const loginAt = T;
  check(T0 + 'only the hash of the token is stored', !JSON.stringify(sd).includes(token) && Object.keys(sd.sessions).every((k) => k.length === 64));
  const exp = Date.parse(login.body.exp) - (totp ? loginAt - 40000 : loginAt);
  check(T0 + 'admin session is 12 hours', Math.abs(exp - 12 * 3600000) < 1000, exp);

  r = await call({ action: 'me', token });
  check(T0 + 'me works with the token', r.body.ok && r.body.role === 'admin');
  check(T0 + 'the admin gets a 30-minute signed proof', /^\d{13}\.[a-f0-9]{64}$/.test(r.body.biz || '') && Math.abs(Number(r.body.biz.split('.')[0]) - Date.now() - 30 * 60000) < 2000);
  check(T0 + 'the proof is signed with the shared key', r.body.biz.split('.')[1] === _crypto.createHmac('sha256', 'shared-test-key').update('biz|' + r.body.biz.split('.')[0]).digest('hex'));
  r = await call({ action: 'me', token: token.slice(0, 47) + (token.endsWith('a') ? 'b' : 'a') });
  check(T0 + 'a changed token fails', r.code === 401);
  r = await call({ action: 'me', token: '__proto__' });
  check(T0 + 'a prototype key is not a token', r.code === 401);
  r = await call({ action: 'clients' });
  check(T0 + 'admin actions need the token', r.code === 403);
  r = await call({ action: 'clients', token });
  check(T0 + 'admin sees clients', r.body.ok && Array.isArray(r.body.clients));

  // a client
  r = await call({ action: 'client-save', token, payload: JSON.stringify({ email: 'Dana@Example.com', phone: '052-1112222', name: 'דנה\nX', sites: ['a', 'b'], plan: 'month', expiresAt: new Date(T + 5 * 86400000).toISOString() }) });
  check(T0 + 'admin adds a client (email cleaned, name one line)', r.body.ok && r.body.client.email === 'dana@example.com' && !/\n/.test(r.body.client.name));
  const CL = { email: 'dana@example.com', phone: '0521112222' };
  r = await call({ action: 'request', ...CL });
  const cc = codeFrom(r);
  check(T0 + 'client gets a code', /^\d{6}$/.test(cc || ''));
  r = await call({ action: 'verify', ...CL, code: cc });
  check(T0 + 'client signs in with the right phone', r.body.ok && r.body.role === 'client' && !r.mail);
  const ct = r.body.token;
  r = await call({ action: 'me', token: ct });
  check(T0 + 'client sees only their sites', r.body.ok && r.body.sites.length === 2);
  r = await call({ action: 'clients', token: ct });
  check(T0 + 'a client cannot use admin actions', r.code === 403);
  r = await call({ action: 'me', token: ct });
  check(T0 + 'a client gets no admin proof', !r.body.biz);
  r = await call({ action: 'client-extend', token: ct, email: 'dana@example.com', days: 999 });
  check(T0 + 'a client cannot extend their own subscription', r.code === 403);
  T += 40000;
  r = await call({ action: 'request', email: 'dana@example.com', phone: '0509999999' });
  check(T0 + 'right email, wrong phone: no code', r.body.ok && !r.mail);
  r = await call({ action: 'payment', token, payload: JSON.stringify({ email: 'dana@example.com', amount: 1e9, days: 30 }) });
  check(T0 + 'absurd payment refused', r.code === 400);

  // brute force: 10 wrong codes in an hour lock the address and warn the admin
  T += 3600000 + 1000;
  const sd2 = sd; let locked = null, i = 0;
  for (; i < 14 && !locked; i++) {
    T += 31000;
    const rq = await call({ action: 'request', ...CL });
    for (let k = 0; k < 5; k++) {
      const v = await call({ action: 'verify', ...CL, code: '00000' + k });
      if (v.mail && v.mail.alert) { locked = v; break; }
      if (v.body.error === 'too-many') break;
    }
  }
  check(T0 + 'repeated wrong codes lock the address and warn the admin', !!locked && /נחסמה/.test(locked.mail.subject), i);
  T += 31000;
  r = await call({ action: 'request', ...CL });
  check(T0 + 'while locked, no new code is sent', r.body.ok && !r.mail);
  T += 3700000;
  r = await call({ action: 'request', ...CL });
  check(T0 + 'the lock ends after an hour', !!codeFrom(r));

  // rate limits per address
  let blocked = 0;
  for (let k = 0; k < 12; k++) { T += 100; const x = await call({ action: 'request', email: 'a@b.co', phone: '0501111111' }, { ip: '9.9.9.9' }); if (x.code === 429) blocked++; }
  check(T0 + 'one address is rate limited', blocked >= 8, blocked);
  check(T0 + 'the limiter memory stays small', Object.keys(sd.rl).length < 100);

  // logout
  r = await call({ action: 'logout', token });
  r = await call({ action: 'me', token });
  check(T0 + 'logout ends the session', r.code === 401);
}

await scenario('[email code]');
await scenario('[email code, pure JS crypto]', { noCrypto: true });
await scenario('[+ authenticator]', { totp: true });
await scenario('[+ authenticator, pure JS crypto]', { totp: true, noCrypto: true });

// without any secure random source the sign-in fails closed
{
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
  let threw = false;
  try { await run(BASE_CODE, { json: { body: { action: 'request', email: 'devopsdevopshaim@gmail.com', phone: '0544979771' }, headers: {} }, sd: {}, noCrypto: true }); } catch (e) { threw = /secure random/.test(e.message); }
  if (saved) Object.defineProperty(globalThis, 'crypto', saved);
  check('fails closed without a secure random source', threw);
}
