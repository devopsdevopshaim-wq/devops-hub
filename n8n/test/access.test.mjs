import { run, check, workflow, nodeCode, crypto } from './harness.mjs';

const wf = workflow('hasadna-access.json');
const BASE_CODE = nodeCode(wf, 'Auth · Handle');
const SITE = 'https://devopsdevopshaim-wq.github.io';
const TOTP = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';   // RFC 6238 test key
const ADMIN_EMAIL = 'devopsdevopshaim@gmail.com';
const MINE = 'Haim1978';                            // the admin's own choice: 8 characters must be accepted

let T = 1_800_000_000_000;
Date.now = () => T;

const hashFor = (pw, iter) => { const salt = crypto.randomBytes(16).toString('hex'); return `p1$${iter}$${salt}$` + crypto.pbkdf2Sync(pw, Buffer.from(salt, 'hex'), iter, 32, 'sha256').toString('hex'); };
const dev = () => crypto.randomBytes(16).toString('hex');
const tempFrom = (r) => ((r.mail && r.mail.text.match(/(?:הסיסמה הראשונית שלך|סיסמה ראשונית): (\S+)/)) || [])[1];

// A little world: one function to call the workflow, remembering its static data.
function world({ seed = '', seedHash = '', totp = false, noCrypto = false, sd = {} } = {}) {
  let code = BASE_CODE.replace('__SHARED_KEY__', 'shared-test-key');
  if (seed || seedHash) code = code.replace('__ADMIN_PASSWORD_HASH__', seedHash || hashFor(seed, noCrypto ? 20000 : 210000));
  if (totp) code = code.replace('__ADMIN_TOTP_SECRET__', TOTP);
  const call = async (body, { origin = SITE, ip = '10.0.0.1', ua = 'Mozilla/5.0 (Test)' } = {}) => {
    const json = { body, headers: { 'x-forwarded-for': 'spoofed, ' + ip, 'user-agent': ua, ...(origin === null ? {} : { origin }) } };
    return (await run(code, { json, sd, noCrypto }))[0].json;
  };
  return { sd, call, code };
}
const totpNow = async (noCrypto) => (await run(BASE_CODE.slice(0, BASE_CODE.indexOf('const ADMIN_EMAIL')) + `\nconst sd={},now=1;return [{json:{c: totpAt('${TOTP}', ${Math.floor(T / 30000)})}}]`, { json: {}, noCrypto }))[0].json.c;

// the admin gets in by email: an initial password arrives, signing in with it forces choosing one
async function adminIn(call, t, { password = MINE, device = dev(), ip = '15.1.1.1', totp = '' } = {}) {
  let r = await call({ action: 'forgot', email: ADMIN_EMAIL }, { ip });
  const temp = tempFrom(r);
  r = await call({ action: 'login', email: ADMIN_EMAIL, password: temp, device, totp }, { ip });
  if (r.body.error === 'totp-needed') r = await call({ action: 'login', email: ADMIN_EMAIL, password: temp, device, totp: await totpNow(false) }, { ip });
  const ch = await call({ action: 'change-password', token: r.body.token, password }, { ip });
  return { token: r.body.token, device, first: r, ch, temp };
}

async function main(tag, { noCrypto = false, totp = false, full = true } = {}) {
  const w = world({ noCrypto, totp });
  const { sd, call } = w;
  const t = tag + ' ';
  let r;

  r = await call({ action: 'info' }, { origin: 'https://evil.example' });
  check(t + 'foreign origin refused', r.code === 403 && r.body.error === 'forbidden');
  r = await call({ action: 'health' }, { origin: null, ip: '5.6.7.8' });
  check(t + 'health reports the crypto kind and the caller address', r.body.crypto === (noCrypto ? 'js' : 'node') && r.body.ip === '5.6.7.8', r.body);
  r = await call({ action: 'x', pad: 'a'.repeat(31000) });
  check(t + 'huge body refused', r.code === 413);

  // ---- the admin has no password yet: it arrives by email
  r = await call({ action: 'login', email: ADMIN_EMAIL, password: MINE, device: dev() });
  check(t + 'before any password exists, nothing opens', r.code === 401 && r.body.error === 'bad-login');
  r = await call({ action: 'forgot', email: 'nobody@example.com' });
  const strangerBody = JSON.stringify(r.body);
  check(t + 'an unknown address gets the usual answer and no email', r.body.ok && !r.mail);
  r = await call({ action: 'forgot', email: ADMIN_EMAIL.toUpperCase() });
  check(t + 'the admin address (typed in capitals) gets an initial password by email', r.mail && r.mail.to === ADMIN_EMAIL && /^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/.test(tempFrom(r) || '') && JSON.stringify(r.body) === strangerBody, r.mail);
  const temp = tempFrom(r);
  check(t + 'the initial password is kept only as a hash', !JSON.stringify(sd).includes(temp) && /^p1\$/.test(sd.admin.tmp.h));
  r = await call({ action: 'forgot', email: ADMIN_EMAIL }, { ip: '10.0.0.1' });
  r = await call({ action: 'forgot', email: ADMIN_EMAIL }, { ip: '10.0.0.1' });
  r = await call({ action: 'forgot', email: ADMIN_EMAIL }, { ip: '10.0.0.1' });
  check(t + 'asking again and again is limited', r.code === 429);

  T += 3700000;   // the hourly limits have reset (and the first initial password has expired); ask again
  r = await call({ action: 'login', email: ADMIN_EMAIL, password: temp, device: dev() }, { ip: '9.9.9.9' });
  check(t + 'an initial password for the admin expires after an hour', r.code === 401);
  r = await call({ action: 'forgot', email: ADMIN_EMAIL }, { ip: '11.1.1.1' });
  const temp2 = tempFrom(r);
  const adminDevice = dev();
  let login;
  if (totp) {
    r = await call({ action: 'login', email: ADMIN_EMAIL, password: temp2, device: adminDevice });
    check(t + 'with the authenticator on, the initial password alone does not open', r.code === 401 && r.body.error === 'totp-needed');
    login = await call({ action: 'login', email: ADMIN_EMAIL, password: temp2, device: adminDevice, totp: await totpNow(noCrypto) });
  } else login = await call({ action: 'login', email: ADMIN_EMAIL, password: temp2, device: adminDevice }, { ip: '99.1.2.3' });
  check(t + 'signing in with the initial password works, and asks to choose a password', login.body.ok && login.body.mustChange === true && login.body.role === 'admin', login.body);
  const token = login.body.token;
  r = await call({ action: 'me', token });
  check(t + 'until then nothing else opens (me says: choose a password)', r.body.mustChange === true && !r.body.biz && !r.body.sites);
  r = await call({ action: 'clients', token });
  check(t + '... not even the admin screens', r.code === 403);
  r = await call({ action: 'change-password', token, password: 'short' });
  check(t + 'a password under 8 characters is refused', r.code === 400 && r.body.error === 'weak-password');
  r = await call({ action: 'change-password', token, password: MINE });
  check(t + 'the admin chooses "Haim1978" and it is accepted', r.body.ok === true && r.mail && /הוחלפה/.test(r.mail.subject));
  check(t + 'only a hash of it is stored', !JSON.stringify(sd).includes(MINE) && /^p1\$/.test(sd.admin.pw) && sd.admin.tmp === null);
  r = await call({ action: 'me', token });
  check(t + 'the same session now has the admin proof', r.body.ok && r.body.role === 'admin' && /^\d{13}\.[a-f0-9]{64}$/.test(r.body.biz) && !r.body.mustChange);
  r = await call({ action: 'clients', token });
  check(t + 'and the admin screens', r.body.ok && r.body.admin.pwState === 'chosen');

  r = await call({ action: 'login', email: ADMIN_EMAIL, password: temp2, device: dev() }, { ip: '77.7.7.7' });
  check(t + 'the initial password is spent once a password is chosen', r.code === 401);
  if (totp) T += 31000;   // an authenticator code works once
  const again = await call({ action: 'login', email: ADMIN_EMAIL.toUpperCase(), password: MINE, device: dev(), totp: totp ? await totpNow(noCrypto) : '' }, { ip: '88.8.8.8' });
  check(t + 'signing in with the chosen password, typed in capitals, from anywhere', again.body.ok === true && !again.body.mustChange, again.body);
  check(t + 'every sign-in sends the admin an alert', again.mail && again.mail.alert);
  const lastAdmin = Object.values(sd.sessions).filter((x) => x.role === 'admin' && !x.mc).sort((x, y) => y.at - x.at)[0];
  check(t + 'the admin session is 12 hours', Math.abs(lastAdmin.exp - lastAdmin.at - 12 * 3600000) < 1000);
  if (!full) return;

  // ---- a stranger asking for an initial password cannot lock the admin out
  T += 3700000;
  r = await call({ action: 'forgot', email: ADMIN_EMAIL }, { ip: '66.6.6.6' });
  r = await call({ action: 'login', email: ADMIN_EMAIL, password: MINE, device: adminDevice, totp: totp ? await totpNow(noCrypto) : '' }, { ip: '14.4.4.4' });
  check(t + 'the chosen password keeps working after someone asked for an initial one', r.body.ok === true && !r.body.mustChange, r.body);
  T += 3700000;   // an initial password for the admin lasts an hour
  const lateTemp = (await call({ action: 'forgot', email: ADMIN_EMAIL }, { ip: '67.7.7.7' }));
  const lt = tempFrom(lateTemp);
  T += 61 * 60000;
  r = await call({ action: 'login', email: ADMIN_EMAIL, password: lt, device: dev() }, { ip: '68.8.8.8' });
  check(t + 'an initial password for the admin expires after an hour', r.code === 401);

  // ---- the guess budget: unknown devices get 10 wrong tries an hour in total, the admin's own device is never held back
  T += 3700000;
  const wrong = (i) => call({ action: 'login', email: ADMIN_EMAIL, password: 'guess-' + i, device: dev() }, { ip: '120.0.0.' + i });
  let r2; for (let i = 0; i < 10; i++) { T += 500; r2 = await wrong(i); }
  check(t + 'ten wrong guesses from ten addresses lock out unknown devices and warn the admin', r2.code === 429 && r2.mail && /ניחושי סיסמה/.test(r2.mail.subject), r2.body);
  if (!totp) {
    r2 = await call({ action: 'login', email: ADMIN_EMAIL, password: MINE, device: dev() }, { ip: '130.0.0.1' });
    check(t + '... even the right password from an unknown device waits', r2.code === 429);
    r2 = await call({ action: 'login', email: ADMIN_EMAIL, password: MINE, device: adminDevice }, { ip: '140.0.0.1' });
    check(t + '... while the admin\'s own device still gets in, from any address', r2.body.ok === true);
  }
  T += 3700000;
  if (totp) return;

  // ---- the admin screen: all users, passwords tested and reset, never read
  const ad = await call({ action: 'login', email: ADMIN_EMAIL, password: MINE, device: adminDevice }, { ip: '15.1.1.1' });
  const atok = ad.body.token;
  const save = (o) => call({ action: 'client-save', token: atok, payload: JSON.stringify({ email: 'Dana@Example.com', name: 'דנה', plan: 'month', sites: ['a', 'b'], expiresAt: new Date(T + 5 * 86400000).toISOString(), ...o }) });
  r = await save({ password: 'short' });
  check(t + 'an initial password under 8 characters is refused', r.code === 400 && r.body.error === 'weak-password');
  r = await save({});
  check(t + 'a client can be added with no password yet', r.body.ok && r.body.client.pwState === 'none');
  r = await save({ password: 'Initial-77' });
  check(t + 'the admin sets an initial password: the client is emailed, the hash is never sent back', r.body.ok && r.body.client.pwState === 'initial' && r.mail && r.mail.to === 'dana@example.com' && /Initial-77/.test(r.mail.text) && !JSON.stringify(r.body).includes('p1$'), r.mail);
  check(t + 'it is stored hashed', !JSON.stringify(sd).includes('Initial-77'));

  const A = dev(), B = dev(), C = dev(), D = dev(), CL = { email: 'dana@example.com' };
  r = await call({ action: 'login', ...CL, password: 'nope', device: A }, { ip: '20.1.1.1' });
  check(t + 'client: a wrong password is refused like an unknown address', r.code === 401 && r.body.error === 'bad-login');
  r = await call({ action: 'login', ...CL, password: 'Initial-77' }, { ip: '20.1.1.1' });
  check(t + 'client: no device id, no entry', r.code === 400 && r.body.error === 'bad-device');
  r = await call({ action: 'login', ...CL, password: 'Initial-77', device: A }, { ip: '20.1.1.1', ua: 'iPhone Safari' });
  check(t + 'client: the initial password works once, the first device is accepted and the admin is told', r.body.ok && r.body.mustChange === true && r.mail && /בפעם הראשונה/.test(r.mail.subject) && /20\.1\.1\.1/.test(r.mail.text), r.body);
  let ct = r.body.token;
  r = await call({ action: 'me', token: ct }, { ip: '20.1.1.1' });
  check(t + 'client: must choose a password first, and sees no sites yet', r.body.mustChange === true && !r.body.sites);
  r = await call({ action: 'change-password', token: ct, password: 'Dana-Own-Pass1' }, { ip: '20.1.1.1' });
  check(t + 'client: chooses their own password', r.body.ok === true);
  r = await call({ action: 'login', ...CL, password: 'Initial-77', device: dev() }, { ip: '21.1.1.1' });
  check(t + 'client: the initial password is spent', r.code === 401);
  r = await call({ action: 'login', ...CL, password: 'Dana-Own-Pass1', device: A }, { ip: '20.1.1.1' });
  check(t + 'client: signs in with their own password', r.body.ok && !r.body.mustChange);
  ct = r.body.token;
  r = await call({ action: 'me', token: ct }, { ip: '20.1.1.1' });
  check(t + 'client: sees only their sites, and gets no admin proof', r.body.ok && r.body.sites.length === 2 && !r.body.biz);
  r = await call({ action: 'clients', token: ct });
  check(t + 'client: no admin actions', r.code === 403);
  r = await call({ action: 'change-password', token: ct, current: 'wrong-wrong', password: 'Another-Pass1' }, { ip: '20.1.1.1' });
  check(t + 'client: changing later needs the current password', r.code === 403);
  r = await call({ action: 'change-password', token: ct, current: 'Dana-Own-Pass1', password: 'Dana-Own-Pass2' }, { ip: '20.1.1.1' });
  check(t + 'client: ... and works with it', r.body.ok === true);

  // what the admin can and cannot see
  r = await call({ action: 'clients', token: atok });
  const cl = r.body.clients[0];
  check(t + 'admin sees every user: the clients and their own row', r.body.clients.length === 1 && r.body.admin.email === ADMIN_EMAIL && cl.pwState === 'chosen' && cl.sessions >= 1 && cl.lastLogin);
  check(t + 'a password the client chose is not shown, and cannot be recovered from what is sent', !JSON.stringify(r.body).includes('Dana-Own-Pass') && !('pw' in cl) && !('tmp' in cl));
  r = await call({ action: 'client-check-password', token: atok, email: CL.email, password: 'Dana-Own-Pass2' });
  check(t + 'admin can test a password: right', r.body.ok && r.body.match === true && r.body.kind === 'chosen');
  r = await call({ action: 'client-check-password', token: atok, email: CL.email, password: 'Dana-Own-Pass3' });
  check(t + 'admin can test a password: wrong', r.body.ok && r.body.match === false);
  r = await call({ action: 'client-check-password', token: ct, email: CL.email, password: 'x' });
  check(t + 'a client cannot test passwords', r.code === 403);

  // the client asks for an initial password themselves: the current one keeps working
  r = await call({ action: 'forgot', email: CL.email }, { ip: '22.2.2.2' });
  const ctemp = tempFrom(r);
  check(t + 'a client can ask for an initial password by email', r.mail && r.mail.to === CL.email && !!ctemp);
  r = await call({ action: 'login', ...CL, password: 'Dana-Own-Pass2', device: A }, { ip: '20.1.1.1' });
  check(t + '... and the password they chose still works meanwhile', r.body.ok && !r.body.mustChange);

  // the admin resets: new initial password by email, shown once, the old one stops, open sessions end
  r = await call({ action: 'client-reset', token: atok, email: CL.email });
  const reset = r.body.password;
  check(t + 'admin resets a client: a new initial password, emailed and shown once', r.body.ok && /^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/.test(reset) && r.mail && r.mail.to === CL.email && r.mail.text.includes(reset), r.body);
  r = await call({ action: 'me', token: ct }, { ip: '20.1.1.1' });
  check(t + '... the client\'s open sessions end', r.code === 401);
  r = await call({ action: 'login', ...CL, password: 'Dana-Own-Pass2', device: A }, { ip: '20.1.1.1' });
  check(t + '... and the old password stops working', r.code === 401);
  r = await call({ action: 'login', ...CL, password: reset, device: A }, { ip: '20.1.1.1' });
  check(t + '... the new initial one asks for a password of their own', r.body.ok && r.body.mustChange === true);
  r = await call({ action: 'change-password', token: r.body.token, password: 'Client-Pass-77!' }, { ip: '20.1.1.1' });
  const cl2 = { ...CL, password: 'Client-Pass-77!' };

  // ---- devices
  T += 1000;
  r = await call({ action: 'login', ...cl2, device: B }, { ip: '30.2.2.2', ua: 'Windows Chrome' });
  check(t + 'a new device is not let in, and the admin is told with its address', r.code === 403 && r.body.error === 'pending' && r.mail && /מכשיר חדש/.test(r.mail.subject) && /30\.2\.2\.2/.test(r.mail.text), r.body);
  r = await call({ action: 'login', ...cl2, device: B }, { ip: '30.2.2.2' });
  check(t + 'trying again does not spam the admin', r.code === 403 && !r.mail);
  r = await call({ action: 'clients', token: atok });
  const dvs = r.body.clients[0].devices;
  check(t + 'admin sees the devices, one waiting, with a masked address', dvs.length === 2 && dvs.filter((d) => !d.approved).length === 1 && dvs.every((d) => d.ips.every((i) => /^\d+\.\d+\.x\.x$/.test(i.ip))));
  r = await call({ action: 'device-approve', token: atok, email: CL.email, id: dvs.find((d) => !d.approved).id });
  r = await call({ action: 'login', ...cl2, device: B }, { ip: '30.2.2.2' });
  check(t + 'approved, it gets in', r.body.ok === true);
  const bt = r.body.token;
  T += 1000;
  r = await call({ action: 'login', ...cl2, device: A }, { ip: '40.3.3.3' });
  check(t + 'a known device on a new address gets in, and the admin is told once', r.body.ok && r.mail && /כתובת חדשה/.test(r.mail.subject), r.mail);
  r = await call({ action: 'login', ...cl2, device: A }, { ip: '41.3.3.3' });
  check(t + '... but not told again within hours', r.body.ok && !r.mail);
  await call({ action: 'login', ...cl2, device: C }, { ip: '50.4.4.4' });
  r = await call({ action: 'clients', token: atok });
  r = await call({ action: 'device-approve', token: atok, email: CL.email, id: r.body.clients[0].devices.find((d) => !d.approved).id });
  check(t + 'a third device can be approved (limit is 3)', r.body.ok);
  await call({ action: 'login', ...cl2, device: D }, { ip: '51.4.4.4' });
  r = await call({ action: 'clients', token: atok });
  const did = r.body.clients[0].devices.find((d) => !d.approved).id;
  r = await call({ action: 'device-approve', token: atok, email: CL.email, id: did });
  check(t + 'a fourth is refused until the limit is raised', r.code === 400 && r.body.error === 'too-many-devices');
  r = await call({ action: 'device-remove', token: atok, email: CL.email, id: did });
  check(t + 'admin can remove a device', r.body.ok && r.body.client.devices.length === 3);
  r = await call({ action: 'clients', token: atok });
  const bid = r.body.clients[0].devices.find((d) => d.ips.some((i) => /^30\.2/.test(i.ip))).id;
  await call({ action: 'device-remove', token: atok, email: CL.email, id: bid });
  r = await call({ action: 'me', token: bt }, { ip: '30.2.2.2' });
  check(t + 'a removed device is signed out at once', r.code === 401);

  // IP lock
  r = await save({ ipLock: true });
  check(t + 'admin turns on the IP lock', r.body.ok && r.body.client.ipLock === true);
  T += 1000;
  r = await call({ action: 'login', ...cl2, device: A }, { ip: '40.3.3.3' });
  check(t + 'IP lock: an address this device used before is fine', r.body.ok === true, r.body);
  const lt2 = r.body.token;
  r = await call({ action: 'login', ...cl2, device: A }, { ip: '88.9.8.8' });
  check(t + 'IP lock: a new address waits for the admin, who is told', r.code === 403 && r.body.error === 'pending' && r.mail && /כתובת חדשה/.test(r.mail.subject), r.body);
  r = await call({ action: 'me', token: lt2 }, { ip: '88.9.8.8' });
  check(t + 'IP lock: an open session is refused from the new address', r.code === 403 && r.body.error === 'ip-blocked');
  r = await call({ action: 'me', token: lt2 }, { ip: '40.3.3.3' });
  check(t + 'IP lock: ... and works again from the old one', r.body.ok === true);

  // subscription
  r = await save({ active: false });
  r = await call({ action: 'login', ...cl2, device: A }, { ip: '40.3.3.3' });
  check(t + 'a paused client with the right password is told it is inactive', r.code === 403 && r.body.error === 'inactive');
  r = await save({ active: true, expiresAt: new Date(T - 1000).toISOString() });
  r = await call({ action: 'login', ...cl2, device: A }, { ip: '40.3.3.3' });
  check(t + 'an ended subscription is refused', r.code === 403 && r.body.error === 'inactive');
  r = await call({ action: 'payment', token: atok, payload: JSON.stringify({ email: CL.email, amount: 1e9, days: 30 }) });
  check(t + 'absurd payment refused', r.code === 400);

  // brute force on a client
  r = await save({ active: true, expiresAt: new Date(T + 5 * 86400000).toISOString() });
  let last; for (let i = 0; i < 8; i++) { T += 1000; last = await call({ action: 'login', ...CL, password: 'guess' + i, device: A }, { ip: '66.1.1.1' }); }
  check(t + 'eight wrong passwords lock that address and warn the admin', last.code === 429 && last.mail && last.mail.alert, last.body);
  r = await call({ action: 'login', ...cl2, device: A }, { ip: '40.3.3.3' });
  check(t + '... the real client still gets in from their own address', r.body.ok === true, r.body);
  r = await call({ action: 'logout', token: atok });
  r = await call({ action: 'me', token: atok });
  check(t + 'logout ends the admin session', r.code === 401);
  check(t + 'the limiter memory stays small', Object.keys(sd.rl).length < 300);
}

// ======================================================================= the optional ADMIN_PASSWORD secret
async function seeded(tag) {
  const t = tag + ' ';
  const sd = {};
  // the deploy makes the hash the same every time for the same secret, so a repeated install is recognised as unchanged
  const H1 = hashFor('Secret-Pass-1234', 210000), H2 = hashFor('A-New-Secret-9876', 210000);
  let w = world({ seedHash: H1, sd });
  let r = await w.call({ action: 'login', email: ADMIN_EMAIL, password: 'Secret-Pass-1234', device: dev() }, { ip: '1.1.1.1' });
  check(t + 'the secret sets the admin password', r.body.ok === true && !r.body.mustChange, r.body);
  const first = await adminIn(w.call, t, { password: MINE, ip: '2.2.2.2' });
  check(t + 'the admin then chooses their own in the app', first.ch.body.ok === true);
  w = world({ seedHash: H1, sd });   // the same install again (nothing changed)
  r = await w.call({ action: 'login', email: ADMIN_EMAIL, password: MINE, device: dev() }, { ip: '3.3.3.3' });
  check(t + 'running the install again does not undo the chosen password', r.body.ok === true, r.body);
  const tok = r.body.token;
  w = world({ seedHash: H2, sd });   // the secret was changed: a way back in with no email
  r = await w.call({ action: 'me', token: tok }, { ip: '3.3.3.3' });
  check(t + 'changing the secret signs the admin out everywhere', r.code === 401);
  r = await w.call({ action: 'login', email: ADMIN_EMAIL, password: 'A-New-Secret-9876', device: dev() }, { ip: '4.4.4.4' });
  check(t + '... and the new secret works as the password', r.body.ok === true);
  r = await w.call({ action: 'login', email: ADMIN_EMAIL, password: MINE, device: dev() }, { ip: '5.5.5.5' });
  check(t + '... replacing the chosen one', r.code === 401);
}

await main('[password]');
await main('[password + authenticator]', { totp: true });
await seeded('[secret]');
await main('[pure JS]', { noCrypto: true, full: false });

// without any secure random source the sign-in fails closed
{
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
  let threw = false;
  try { await run(BASE_CODE, { json: { body: { action: 'forgot', email: ADMIN_EMAIL }, headers: {} }, sd: {}, noCrypto: true }); } catch (e) { threw = true; }
  if (saved) Object.defineProperty(globalThis, 'crypto', saved);
  check('fails closed without a secure random source', threw);
}
