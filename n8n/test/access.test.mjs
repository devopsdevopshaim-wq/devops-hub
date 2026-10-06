import { run, check, workflow, nodeCode, crypto } from './harness.mjs';

const wf = workflow('hasadna-access.json');
const BASE_CODE = nodeCode(wf, 'Auth · Handle');
const SITE = 'https://devopsdevopshaim-wq.github.io';
const TOTP = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';   // RFC 6238 test key
const ADMIN = { email: 'devopsdevopshaim@gmail.com', password: 'Admin-Pass-12345!' };

let T = 1_800_000_000_000;
Date.now = () => T;

const hashFor = (pw, iter) => { const salt = crypto.randomBytes(16).toString('hex'); return `p1$${iter}$${salt}$` + crypto.pbkdf2Sync(pw, Buffer.from(salt, 'hex'), iter, 32, 'sha256').toString('hex'); };
const dev = () => crypto.randomBytes(16).toString('hex');

// A little world: one function to call the workflow, remembering its static data.
function world({ password = true, totp = false, noCrypto = false } = {}) {
  let code = BASE_CODE.replace('__SHARED_KEY__', 'shared-test-key');
  if (password) code = code.replace('__ADMIN_PASSWORD_HASH__', hashFor(ADMIN.password, noCrypto ? 20000 : 210000));
  if (totp) code = code.replace('__ADMIN_TOTP_SECRET__', TOTP);
  const sd = {};
  const call = async (body, { origin = SITE, ip = '10.0.0.1', ua = 'Mozilla/5.0 (Test)' } = {}) => {
    const json = { body, headers: { 'x-forwarded-for': 'spoofed, ' + ip, 'user-agent': ua, ...(origin === null ? {} : { origin }) } };
    return (await run(code, { json, sd, noCrypto }))[0].json;
  };
  return { sd, call, code };
}
const totpNow = async (noCrypto) => (await run(BASE_CODE.slice(0, BASE_CODE.indexOf('const ADMIN_EMAIL')) + `\nconst sd={},now=1;return [{json:{c: totpAt('${TOTP}', ${Math.floor(T / 30000)})}}]`, { json: {}, noCrypto }))[0].json.c;

// ======================================================================= passwords (the new way in)
async function main(tag, { noCrypto = false, totp = false, full = true } = {}) {
  const { sd, call } = world({ totp, noCrypto });
  const t = tag + ' ';
  let r;

  r = await call({ action: 'info' }, { origin: 'https://evil.example' });
  check(t + 'foreign origin refused', r.code === 403 && r.body.error === 'forbidden');
  r = await call({ action: 'info' });
  check(t + 'info says passwords are on', r.body.ok && r.body.password === true);
  r = await call({ action: 'health' }, { origin: null, ip: '5.6.7.8' });
  check(t + 'health reports the crypto kind and the caller address', r.body.crypto === (noCrypto ? 'js' : 'node') && r.body.ip === '5.6.7.8', r.body);
  r = await call({ action: 'x', pad: 'a'.repeat(31000) });
  check(t + 'huge body refused', r.code === 413);

  // ---- the admin: email + password, from anywhere
  r = await call({ action: 'login', email: ADMIN.email, password: 'wrong-password' });
  check(t + 'admin: wrong password refused', r.code === 401 && r.body.error === 'bad-login' && r.body.left === 7, r.body);
  const unknown = await call({ action: 'login', email: 'nobody@example.com', password: 'wrong-password' });
  check(t + 'an unknown address gets the same answer as a wrong password', unknown.code === 401 && unknown.body.error === 'bad-login' && !unknown.mail);

  let login;
  if (totp) {
    r = await call({ action: 'login', email: ADMIN.email, password: ADMIN.password });
    check(t + 'admin: right password, still asked for the authenticator code', r.code === 401 && r.body.error === 'totp-needed' && Object.keys(sd.sessions).length === 0);
    r = await call({ action: 'login', email: ADMIN.email, password: ADMIN.password, totp: '000000' });
    check(t + 'admin: wrong authenticator code refused', r.code === 401);
    const good = await totpNow(noCrypto);
    login = await call({ action: 'login', email: ADMIN.email, password: ADMIN.password, totp: good }, { ip: '99.1.2.3' });
    check(t + 'admin: password + authenticator code signs in', login.body.ok && login.body.role === 'admin');
    r = await call({ action: 'login', email: ADMIN.email, password: ADMIN.password, totp: good }, { ip: '99.1.2.4' });
    check(t + 'admin: an authenticator code cannot be reused', r.code === 401);
  } else {
    login = await call({ action: 'login', email: ADMIN.email, password: ADMIN.password }, { ip: '99.1.2.3', ua: 'Chrome on a hotel PC' });
    check(t + 'admin: email + password signs in, from an address nobody knew', login.body.ok && login.body.role === 'admin' && /^[a-f0-9]{48}$/.test(login.body.token));
    check(t + 'admin: every sign-in sends an alert with the address', login.mail && login.mail.alert && /99\.1\.2\.3/.test(login.mail.text));
  }
  const token = login.body.token, loginAt = T;
  check(t + 'only the hash of the token is stored', !JSON.stringify(sd).includes(token) && Object.keys(sd.sessions).every((k) => k.length === 64));
  check(t + 'the admin password is not stored anywhere in the data', !JSON.stringify(sd).includes(ADMIN.password));
  check(t + 'admin session is 12 hours', Math.abs(sd.sessions[Object.keys(sd.sessions)[0]].exp - loginAt - 12 * 3600000) < 1000);
  r = await call({ action: 'me', token });
  check(t + 'admin: me works and carries the 30-minute proof', r.body.ok && r.body.role === 'admin' && /^\d{13}\.[a-f0-9]{64}$/.test(r.body.biz));
  check(t + 'the proof is signed with the shared key', r.body.biz.split('.')[1] === crypto.createHmac('sha256', 'shared-test-key').update('biz|' + r.body.biz.split('.')[0]).digest('hex'));
  r = await call({ action: 'clients', token: '__proto__' });
  check(t + 'a prototype key is not a token', r.code === 403);
  r = await call({ action: 'clients' });
  check(t + 'admin actions need the token', r.code === 403);

  // the older way in is shut once a password exists
  r = await call({ action: 'request', email: ADMIN.email, phone: '0544979771' });
  check(t + 'the emailed-code door is closed, and answers like any stranger', r.body.ok && !r.mail);
  r = await call({ action: 'verify', email: ADMIN.email, phone: '0544979771', code: '123456' });
  check(t + 'verify is closed too', r.code === 400);
  if (!full) return;

  // ---- an attacker cannot lock the real admin out
  T += 3700000;   // earlier wrong tries have aged out of the hourly guess budget
  for (let i = 0; i < 8; i++) { T += 1000; r = await call({ action: 'login', email: ADMIN.email, password: 'guess' + i }, { ip: '66.6.6.6' }); }
  check(t + 'eight wrong passwords lock that address and warn the admin', r.code === 429 && r.body.error === 'too-many' && r.mail && r.mail.alert, r.body);
  r = await call({ action: 'login', email: ADMIN.email, password: ADMIN.password }, { ip: '66.6.6.6' });
  check(t + 'the locked address is refused even with the right password', r.code === 429);
  r = await call({ action: 'login', email: ADMIN.email, password: ADMIN.password }, { ip: '77.7.7.7' });
  check(t + 'the real admin still gets in from anywhere else', r.body.ok === true || (totp && r.body.error === 'totp-needed'));
  T += 3700000;
  r = await call({ action: 'login', email: ADMIN.email, password: ADMIN.password }, { ip: '66.6.6.6' });
  check(t + 'the lock ends after an hour', r.body.ok === true || (totp && r.body.error === 'totp-needed'));
  // guessing from devices that never signed in as admin: 10 tries an hour in total, from any number of addresses
  if (!totp) {
    const home = dev();
    r = await call({ action: 'login', email: ADMIN.email, password: ADMIN.password, device: home }, { ip: '15.1.1.1' });
    check(t + 'the admin signs in from a device of their own (it is remembered as trusted)', r.body.ok === true);
    T += 3700000;
    let r2; for (let i = 0; i < 10; i++) { T += 500; r2 = await call({ action: 'login', email: ADMIN.email, password: 'guess-' + i, device: dev() }, { ip: '120.0.0.' + i }); }
    check(t + 'ten wrong guesses from ten addresses lock out unknown devices and warn the admin', r2.code === 429 && r2.mail && /ניחושי סיסמה/.test(r2.mail.subject), r2.body);
    r2 = await call({ action: 'login', email: ADMIN.email, password: ADMIN.password, device: dev() }, { ip: '130.0.0.1' });
    check(t + '... even the right password from an unknown device waits', r2.code === 429);
    r2 = await call({ action: 'login', email: ADMIN.email, password: ADMIN.password, device: home }, { ip: '140.0.0.1' });
    check(t + '... while the admin\'s own device still gets in, from any address', r2.body.ok === true);
    T += 3700000;
    r2 = await call({ action: 'login', email: ADMIN.email, password: ADMIN.password, device: dev() }, { ip: '150.0.0.1' });
    check(t + 'an hour later an unknown device can sign in again', r2.body.ok === true);
  }
  let lim = 0; for (let i = 0; i < 24; i++) { T += 100; const x = await call({ action: 'login', email: 'a' + i + '@b.co', password: 'x' }, { ip: '55.5.5.5' }); if (x.body.error === 'rate-limited' || x.body.error === 'too-many') lim++; }
  check(t + 'one address is limited to 20 sign-in tries an hour', lim >= 4, lim);

  if (totp) return;
  // ---- clients
  const A = dev(), B = dev(), C = dev(), D = dev();
  const save = (o) => call({ action: 'client-save', token, payload: JSON.stringify({ email: 'Dana@Example.com', name: 'דנה\nX', plan: 'month', sites: ['a', 'b'], expiresAt: new Date(T + 5 * 86400000).toISOString(), ...o }) });
  r = await save({ password: 'short' });
  check(t + 'a weak client password is refused', r.code === 400 && r.body.error === 'weak-password');
  r = await save({ password: 'Client-Pass-77!' });
  check(t + 'admin adds a client with a password; the hash is never sent back', r.body.ok && r.body.client.hasPassword === true && !r.body.client.pw && r.body.client.email === 'dana@example.com' && !/\n/.test(r.body.client.name));
  check(t + 'the client password is stored hashed', /^p1\$\d+\$/.test(sd.clients['dana@example.com'].pw) && !JSON.stringify(sd).includes('Client-Pass-77!'));
  const CL = { email: 'dana@example.com', password: 'Client-Pass-77!' };

  r = await call({ action: 'login', email: CL.email, password: 'nope' }, { ip: '20.1.1.1' });
  check(t + 'client: wrong password refused, like an unknown address', r.code === 401 && r.body.error === 'bad-login' && JSON.stringify(r.body) === JSON.stringify({ ...unknown.body, left: r.body.left }));
  r = await call({ action: 'login', ...CL }, { ip: '20.1.1.1' });
  check(t + 'client: no device id, no entry', r.code === 400 && r.body.error === 'bad-device');
  r = await call({ action: 'login', ...CL, device: A }, { ip: '20.1.1.1', ua: 'iPhone Safari' });
  check(t + 'client: the first device is accepted, and the admin is told', r.body.ok && r.body.role === 'client' && r.mail && /בפעם הראשונה/.test(r.mail.subject) && /20\.1\.1\.1/.test(r.mail.text), r.mail);
  const ct = r.body.token;
  check(t + 'the device id is stored only as a hash', !JSON.stringify(sd).includes(A));
  r = await call({ action: 'me', token: ct }, { ip: '20.1.1.1' });
  check(t + 'client: sees only their sites, and gets no admin proof', r.body.ok && r.body.sites.length === 2 && !r.body.biz);
  r = await call({ action: 'clients', token: ct });
  check(t + 'client: no admin actions', r.code === 403);
  r = await call({ action: 'device-approve', token: ct, email: CL.email, id: 'x' });
  check(t + 'client: cannot approve a device', r.code === 403);

  // a second device waits for the admin
  T += 1000;
  r = await call({ action: 'login', ...CL, device: B }, { ip: '30.2.2.2', ua: 'Windows Chrome' });
  check(t + 'a new device is not let in, and the admin is told with its address', r.code === 403 && r.body.error === 'pending' && r.mail && /מכשיר חדש/.test(r.mail.subject) && /30\.2\.2\.2/.test(r.mail.text), r.body);
  r = await call({ action: 'login', ...CL, device: B }, { ip: '30.2.2.2' });
  check(t + 'trying again does not spam the admin', r.code === 403 && !r.mail);
  r = await call({ action: 'clients', token });
  const cl = r.body.clients[0];
  check(t + 'admin sees both devices, one waiting, with a masked address', cl.devices.length === 2 && cl.devices.filter((d) => !d.approved).length === 1 && cl.devices.every((d) => d.ips.every((i) => /^\d+\.\d+\.x\.x$/.test(i.ip))));
  const pendingId = cl.devices.find((d) => !d.approved).id;
  r = await call({ action: 'me', token: ct }, { ip: '20.1.1.1' });
  check(t + 'the approved device keeps working meanwhile', r.body.ok);
  r = await call({ action: 'device-approve', token, email: CL.email, id: pendingId });
  check(t + 'admin approves the new device', r.body.ok && r.body.client.devices.every((d) => d.approved));
  r = await call({ action: 'login', ...CL, device: B }, { ip: '30.2.2.2' });
  check(t + 'now it gets in', r.body.ok === true);
  const bt = r.body.token;

  // the same device from another network: allowed, and noticed
  T += 1000;
  r = await call({ action: 'login', ...CL, device: A }, { ip: '40.3.3.3' });
  check(t + 'a known device on a new address gets in, and the admin is told once', r.body.ok && r.mail && /כתובת חדשה/.test(r.mail.subject), r.mail);
  r = await call({ action: 'login', ...CL, device: A }, { ip: '41.3.3.3' });
  check(t + '... but not told again within hours', r.body.ok && !r.mail);

  // device limit
  r = await call({ action: 'login', ...CL, device: C }, { ip: '50.4.4.4' });
  r = await call({ action: 'clients', token });
  const cid = r.body.clients[0].devices.find((d) => !d.approved).id;
  r = await call({ action: 'device-approve', token, email: CL.email, id: cid });
  check(t + 'a third device can be approved (limit is 3)', r.body.ok);
  await call({ action: 'login', ...CL, device: D }, { ip: '51.4.4.4' });
  r = await call({ action: 'clients', token });
  const did = r.body.clients[0].devices.find((d) => !d.approved).id;
  r = await call({ action: 'device-approve', token, email: CL.email, id: did });
  check(t + 'a fourth is refused until the limit is raised', r.code === 400 && r.body.error === 'too-many-devices');
  r = await call({ action: 'device-remove', token, email: CL.email, id: did });
  check(t + 'admin can remove a device', r.body.ok && r.body.client.devices.length === 3);

  // removing a device ends its sessions
  r = await call({ action: 'clients', token });
  const bid = r.body.clients[0].devices.find((d) => d.ips.some((i) => /^30\.2/.test(i.ip))).id;
  r = await call({ action: 'device-remove', token, email: CL.email, id: bid });
  r = await call({ action: 'me', token: bt }, { ip: '30.2.2.2' });
  check(t + 'a removed device is signed out at once', r.code === 401);
  r = await call({ action: 'login', ...CL, device: B }, { ip: '30.2.2.2' });
  check(t + 'and comes back as a new device waiting for approval', r.code === 403 && r.body.error === 'pending');

  // IP lock
  r = await save({ password: '', ipLock: true });
  check(t + 'admin turns on the IP lock', r.body.ok && r.body.client.ipLock === true);
  T += 1000;
  r = await call({ action: 'login', ...CL, device: A }, { ip: '40.3.3.3' });
  check(t + 'IP lock: an address this device used before is fine', r.body.ok === true, r.body);
  const lt = r.body.token;
  r = await call({ action: 'login', ...CL, device: A }, { ip: '88.8.8.8' });
  check(t + 'IP lock: a new address waits for the admin, who is told', r.code === 403 && r.body.error === 'pending' && r.mail && /כתובת חדשה/.test(r.mail.subject), r.body);
  r = await call({ action: 'me', token: lt }, { ip: '88.8.8.8' });
  check(t + 'IP lock: an open session is refused from the new address', r.code === 403 && r.body.error === 'ip-blocked');
  r = await call({ action: 'me', token: lt }, { ip: '40.3.3.3' });
  check(t + 'IP lock: ... and works again from the old one', r.body.ok === true);
  r = await call({ action: 'clients', token });
  const dA = r.body.clients[0].devices.find((d) => d.ips.some((i) => !i.approved));
  r = await call({ action: 'device-approve', token, email: CL.email, id: dA.id, ip: dA.ips.find((i) => !i.approved).k });
  r = await call({ action: 'login', ...CL, device: A }, { ip: '88.8.8.8' });
  check(t + 'IP lock: once approved, the address works', r.body.ok === true);

  // a new password closes the old sessions
  r = await save({ password: 'Another-Pass-99!' });
  r = await call({ action: 'me', token: lt }, { ip: '40.3.3.3' });
  check(t + 'a new password signs the client out everywhere', r.code === 401);
  r = await call({ action: 'login', ...CL, device: A }, { ip: '40.3.3.3' });
  check(t + 'the old password no longer works', r.code === 401);
  r = await call({ action: 'login', email: CL.email, password: 'Another-Pass-99!', device: A }, { ip: '40.3.3.3' });
  check(t + 'the new one does', r.body.ok === true);

  // subscription
  r = await save({ active: false });
  r = await call({ action: 'login', email: CL.email, password: 'Another-Pass-99!', device: A }, { ip: '40.3.3.3' });
  check(t + 'a paused client with the right password is told it is inactive', r.code === 403 && r.body.error === 'inactive');
  r = await save({ active: true, expiresAt: new Date(T - 1000).toISOString() });
  r = await call({ action: 'login', email: CL.email, password: 'Another-Pass-99!', device: A }, { ip: '40.3.3.3' });
  check(t + 'an ended subscription is refused', r.code === 403 && r.body.error === 'inactive');
  r = await call({ action: 'payment', token, payload: JSON.stringify({ email: CL.email, amount: 1e9, days: 30 }) });
  check(t + 'absurd payment refused', r.code === 400);
  r = await call({ action: 'logout', token });
  r = await call({ action: 'me', token });
  check(t + 'logout ends the admin session', r.code === 401);
  check(t + 'the limiter memory stays small', Object.keys(sd.rl).length < 200);
}

// ======================================================================= before a password exists: the older way in, admin only
async function legacy(tag) {
  const { sd, call } = world({ password: false });
  const t = tag + ' ';
  const codeFrom = (r) => (r.mail && /הקוד שלך: (\d{6})/.exec(r.mail.text) || [])[1];
  const A = { email: ADMIN.email, phone: '054-4979771' };
  let r = await call({ action: 'info' });
  check(t + 'info says passwords are off', r.body.password === false);
  r = await call({ action: 'login', email: ADMIN.email, password: 'anything' });
  check(t + 'a password does not open anything yet', r.code === 401);
  r = await call({ action: 'request', ...A });
  const c1 = codeFrom(r);
  check(t + 'the admin gets a code', /^\d{6}$/.test(c1 || '') && sd.otp[ADMIN.email].h.length === 64 && !JSON.stringify(sd).includes(c1));
  T += 31000;
  r = await call({ action: 'request', ...A });
  check(t + 'a second request cannot cancel the code', r.body.ok && !r.mail);
  r = await call({ action: 'verify', ...A, code: c1 === '000000' ? '111111' : '000000' });
  check(t + 'a wrong code is counted', r.code === 400 && r.body.left === 4);
  r = await call({ action: 'verify', ...A, code: c1 });
  check(t + 'the right code signs the admin in, with an alert', r.body.ok && r.body.role === 'admin' && r.mail && r.mail.alert);
  r = await call({ action: 'request', email: 'dana@example.com', phone: '0521112222' });
  check(t + 'nobody else can use the emailed code', r.body.ok && !r.mail);
}

await main('[password]');
await main('[password + authenticator]', { totp: true });
await legacy('[before a password]');
await main('[password, pure JS]', { noCrypto: true, full: false });

// without any secure random source the sign-in fails closed
{
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
  let threw = false;
  try { await run(BASE_CODE.replace('__ADMIN_PASSWORD_HASH__', hashFor('x', 1000)), { json: { body: { action: 'login', email: ADMIN.email, password: 'x' }, headers: {} }, sd: {}, noCrypto: true }); } catch (e) { threw = true; }
  if (saved) Object.defineProperty(globalThis, 'crypto', saved);
  check('fails closed without a secure random source', threw);
}
