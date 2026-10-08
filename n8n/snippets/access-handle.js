// Sign-in and access control for the portfolio. (Built into "Auth · Handle" by build-access-workflow.py.)
//
//  Everyone (the admin and every client) signs in with email + password.
//  Passwords: an INITIAL password arrives by email (the person asks for it on the sign-in page, or the admin sends one); signing
//             in with it forces choosing one's own. Only salted hashes are kept, so nobody, the admin included, can read a password
//             someone chose; the admin can reset it, set a new initial one, or test a password.
//  The admin  signs in from anywhere (no device or address limit; an hourly guess budget protects unknown devices).
//  A client   must come from a device the admin approved. The first device is accepted and the admin is told; every other new
//             device waits for the admin. A device is a random id kept in its browser; its IP address is recorded with it.
//             Clients with "IP lock" must also come from an approved address.
//  The secret ADMIN_PASSWORD (optional) sets the admin password whenever it is changed: a way back in that needs no email.
__SEC__

const ADMIN_EMAIL = '__ADMIN_EMAIL__';
const RENEW = '__RENEW__';
// Filled in by the deploy from the SPIDER secret; never written in the repository.
const set = (v) => !!v && !/^__/.test(v);
const ADMIN_PW = '__ADMIN_PASSWORD_HASH__';   // "p1$iterations$salt$hash" made from ADMIN_PASSWORD; only the hash is here
const LOGIN_URL = 'https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/client.html';
const ADMIN_TOTP = '__ADMIN_TOTP_SECRET__';   // authenticator-app key of the admin; empty = no second step
// Invoices through Morning (חשבונית ירוקה): MORNING_CLIENT_ID / MORNING_CLIENT_SECRET in the secret.
//   docType 320 = חשבונית מס/קבלה (עוסק מורשה), 400 = קבלה (עוסק פטור)
const INVOICE = { clientId: '__MORNING_CLIENT_ID__', clientSecret: '__MORNING_CLIENT_SECRET__', docType: 320, sandbox: false };
// Shared by the sign-in and the leads & prices workflows (derived at install time, never in the repository).
// The sign-in hands the signed-in admin a proof that lasts 30 minutes; the other workflow checks the signature.
const SHARED = '__SHARED_KEY__';
const bizProof = () => { if (!set(SHARED)) return ''; const e = Date.now() + 30 * 60000; return e + '.' + hmacSha256Hex(SHARED, 'biz|' + e); };
const CLIENT_SESSION_DAYS = 7;   // capped by the end of the subscription
const ADMIN_SESSION_DAYS = 0.5;  // the admin signs in again every 12 hours
const MAX_CLIENTS = 500;
const SIGNUP_DAYS = 30;   // how long a self-registered client has access, until the admin extends or closes it
const USAGE_DAYS = 120;   // how long the daily usage counters are kept
const DEFAULT_MAX_DEVICES = 3;
const MIN_PASSWORD = 8;
const TEMP_ADMIN_MIN = 60, TEMP_CLIENT_DAYS = 14;   // how long an emailed initial password works

const sd = $getWorkflowStaticData('global');
sd.clients = sd.clients || {};
sd.admin = sd.admin || {};
sd.sessions = sd.sessions || {};
sd.lock = sd.lock || {};
sd.fails = sd.fails || {};
sd.log = sd.log || [];
const now = Date.now();
const DAY = 86400000, HOUR = 3600000;
const IPK = ipKey();

const out = (body, code, mail) => [{ json: { code: code || 200, body, mail: mail || null } }];
const line = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, n);
const email = (e) => String(e || '').replace(/[\u0000-\u001f\u007f\s]+/g, '').toLowerCase().slice(0, 120);
const phone = (p) => { let d = String(p || '').replace(/\D/g, ''); if (d.startsWith('972')) d = '0' + d.slice(3); return d.slice(0, 15); };
// an initial password: 12 characters without look-alikes (about 68 bits)
const PW_CHARS = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rndPassword = () => { const h = rnd(12); let o = ''; for (let i = 0; i < 12; i++) o += PW_CHARS[parseInt(h.substr(i * 2, 2), 16) % PW_CHARS.length]; return o.slice(0, 4) + '-' + o.slice(4, 8) + '-' + o.slice(8); };
const mailTo = (to, subject, text) => ({ to, subject, text, soft: true });   // soft: a failed send never blocks the answer
const log = (what, who) => { sd.log.unshift({ at: new Date(now).toISOString(), what, who, ip: IPK.slice(0, 6) }); if (sd.log.length > 300) sd.log.length = 300; };
const when = () => new Date(now).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
const alert = (subject, text) => ({ to: ADMIN_EMAIL, subject: 'SPIDER · ' + subject, text: text + `\n\nזמן: ${when()}\nכתובת: ${IP}\n`, alert: true });
// 84.229.12.7 -> 84.229.x.x : enough to recognise a network, not enough to expose a person
const maskIp = (ip) => /^\d+\.\d+\.\d+\.\d+$/.test(ip) ? ip.split('.').slice(0, 2).join('.') + '.x.x' : /:/.test(ip) ? ip.split(':').slice(0, 3).join(':') + '::' : 'לא ידוע';
const UA = line(HDR['user-agent'], 110);

// tidy up: expired sessions and codes, locks, counters, and anything left by the older (plain) format
for (const [t, s] of Object.entries(sd.sessions)) if (t.length !== 64 || s.exp < now) delete sd.sessions[t];
delete sd.otp;   // the emailed sign-in code was retired
for (const [e, t] of Object.entries(sd.lock)) if (t < now) delete sd.lock[e];
for (const [e, a] of Object.entries(sd.fails)) if (!a.some((t) => now - t < HOUR)) delete sd.fails[e];
sweep();

if (!ORIGIN_OK) return out({ ok: false, error: 'forbidden' }, 403);
const b = $json.body || {};
if (JSON.stringify(b).length > (b.action === 'plan-set' ? 45000 : 30000)) return out({ ok: false, error: 'too-big' }, 413);
if (!hit('all', IPK, 240, 10 * 60000)) return out({ ok: false, error: 'rate-limited' }, 429);

// the optional ADMIN_PASSWORD secret: when its value changes, it becomes the admin password (and signs the admin out everywhere)
if (set(ADMIN_PW) && sd.admin.seedHash !== ADMIN_PW) {
  sd.admin = { ...sd.admin, pw: ADMIN_PW, seedHash: ADMIN_PW, pwAt: new Date(now).toISOString(), pwBy: 'secret', tmp: null };
  for (const [t, s] of Object.entries(sd.sessions)) if (s.role === 'admin') delete sd.sessions[t];
}
const acct = (e) => (e === ADMIN_EMAIL ? sd.admin : sd.clients[e]);
const tempOk = (a) => !!(a && a.tmp && a.tmp.exp > now);
const pwState = (a) => (tempOk(a) ? (a.pw ? 'reset' : 'initial') : a && a.pw ? (a.pwBy === 'client' ? 'chosen' : 'admin-set') : 'none');
const active = (c) => !!c && c.active !== false && (!c.expiresAt || Date.parse(c.expiresAt) > now);
const tokenHash = () => { const t = String(b.token || ''); return /^[a-f0-9]{48}$/.test(t) ? sha256hex(t) : ''; };
const session = () => { const h = tokenHash(); const s = h && sd.sessions[h]; return s && s.exp > now ? s : null; };
const admin = () => { const s = session(); return s && s.role === 'admin' && !s.mc ? s : null; };   // a session that still has to choose a password is not an admin yet
const nSessions = (e) => Object.values(sd.sessions).filter((s) => s.email === e).length;
const view = (c) => { const { pw, tmp, ...rest } = c; return { ...rest, hasPassword: !!pw || tempOk(c), pwState: pwState(c), tmpExp: tempOk(c) ? new Date(c.tmp.exp).toISOString() : null, sessions: nSessions(c.email), failed: (sd.fails[c.email] || []).filter((t) => now - t < HOUR).length, activeNow: active(c), daysLeft: c.expiresAt ? Math.ceil((Date.parse(c.expiresAt) - now) / DAY) : null }; };
const adminView = () => ({ email: ADMIN_EMAIL, pwState: pwState(sd.admin), pwAt: sd.admin.pwAt || null, lastLogin: sd.admin.lastLogin || null, devices: (sd.adminDevices || []).length, sessions: nSessions(ADMIN_EMAIL), tmpExp: tempOk(sd.admin) ? new Date(sd.admin.tmp.exp).toISOString() : null });
// an initial password (replaces the old one when `revoke`): returns it in clear once, keeps only its hash
const giveTemp = (a, plain, ms, by, revoke) => { a.tmp = { h: pwHash(plain), exp: now + ms, at: now }; a.pwBy = a.pwBy || by; if (revoke) { a.pw = null; a.pwBy = by; } a.pwAt = new Date(now).toISOString(); };
const closeSessions = (e, except) => { for (const [t, s] of Object.entries(sd.sessions)) if (s.email === e && t !== except) delete sd.sessions[t]; };
const newSession = (e, role, exp, extra) => { const token = rnd(24); sd.sessions[sha256hex(token)] = { email: e, role, exp, at: now, ...(extra || {}) }; return token; };

// ---- devices. A device is a random id kept in the browser (only its hash is stored here) plus the addresses it came from.
//   ok      the device is approved, and (for clients with IP lock) so is the address
//   pending waits for the admin
function checkDevice(c, devHash, register) {
  c.devices = c.devices || [];
  const iso = new Date(now).toISOString();
  let d = c.devices.find((x) => x.id === devHash);
  let news = '';
  if (!d) {
    if (register !== true) return { status: 'pending', news };   // only a login may add a device; a page load may not
    const first = c.devices.length === 0;   // the first device is trusted: the admin gave the password to its owner
    d = { id: devHash, ua: UA, first: iso, last: iso, approved: first, how: first ? 'first' : '', ips: [] };
    c.devices.push(d);
    if (c.devices.length > 20) { const i = c.devices.findIndex((x) => !x.approved); c.devices.splice(i >= 0 ? i : 0, 1); }
    news = first ? 'first-device' : 'new-device';
  }
  let r = d.ips.find((x) => x.k === IPK);
  if (!r && register) {
    // an address the device was not seen at before: free for ordinary clients (the admin is told), approved by hand with IP lock
    r = { k: IPK, ip: maskIp(IP), first: iso, last: iso, approved: !c.ipLock || (news === 'first-device') };
    d.ips.push(r);
    if (d.ips.length > 20) d.ips.shift();
    if (!news && d.approved) news = r.approved ? 'new-ip' : 'blocked-ip';
  }
  if (register) { d.last = iso; d.ua = UA || d.ua; if (r) r.last = iso; }
  const ok = d.approved && (!c.ipLock || (r && r.approved));
  return { status: ok ? 'ok' : 'pending', news, d };
}
// The emailed temporary password reaches only the owner's mailbox, so signing in with it approves this device (and address)
// with no step by the admin. If the client is over their device limit, the device unused the longest makes room (its sessions end).
function approveByMail(c, d) {
  const others = c.devices.filter((x) => x.approved && x !== d);
  let evicted = null;
  if (!d.approved && others.length >= (c.maxDevices || DEFAULT_MAX_DEVICES)) {
    others.sort((x, y) => Date.parse(x.last) - Date.parse(y.last));
    evicted = others[0];
    c.devices = c.devices.filter((x) => x !== evicted);
    for (const [t, s] of Object.entries(sd.sessions)) if (s.email === c.email && s.dev === evicted.id) delete sd.sessions[t];
  }
  if (!d.approved) { d.approved = true; d.how = 'email'; }
  const r = d.ips.find((x) => x.k === IPK);
  if (r) r.approved = true;
  return evicted;
}
function deviceMail(c, news) {
  const who = `${c.name || c.email} (${c.email})`;
  const where = `מכשיר: ${UA || 'לא ידוע'}`;   // the address itself is added below
  const manage = '\n\nלאישור או לחסימה: מסך הניהול ← לקוחות ← עריכה ← מכשירים.';
  if (news === 'first-device') return alert('לקוח נכנס בפעם הראשונה', `${who} נכנס בפעם הראשונה מהמכשיר הזה, והוא נרשם כמכשיר המאושר שלו.\n${where}`);
  if (news === 'new-device') return alert('מכשיר חדש מחכה לאישור', `${who} ניסה להיכנס ממכשיר חדש. הוא לא ייכנס עד שתאשר.\n${where}${manage}`);
  if (news === 'blocked-ip') return alert('כתובת חדשה מחכה לאישור', `${who} ניסה להיכנס מכתובת חדשה, ויש לו נעילת כתובת. הוא לא ייכנס עד שתאשר.\n${where}${manage}`);
  if (news === 'new-ip' && hit('ip-alert', c.email, 1, 6 * HOUR)) return alert('כתובת חדשה ללקוח', `${who} נכנס ממכשיר מוכר אבל מכתובת חדשה.\n${where}`);
  return null;
}

switch (b.action) {
  // ---------------------------------------------------------------- public
  case 'info':
    return out({ ok: true, password: true, signup: !sd.signupClosed });

  // Usage statistics (first party). A page sends a small "view" or "open" note; only counters are kept, per day, for USAGE_DAYS days.
  // A visitor is a random id from the browser, kept as a short hash; no address, no cookie, nothing that names a person. The admin's own
  // visits are not counted, and a client's visits are counted under the client's email so the admin can see who uses what.
  case 'track': {
    if (!hit('track', IPK, 90, 10 * 60000)) return out({ ok: true });
    const s0 = session();
    if (s0 && s0.role === 'admin') return out({ ok: true });
    const ev = b.ev === 'open' ? 'open' : 'view';
    const key = (v) => line(v, 70).replace(/[?#].*$/, '').replace(/^https?:\/\/[^/]+/, '').replace(/[.$]/g, '_');
    const page = key(b.page) || '/', app = key(b.app);
    if (ev === 'open' && !app) return out({ ok: true });
    const day = new Date(now + 3 * HOUR).toISOString().slice(0, 10);
    sd.usage = sd.usage || {};
    for (const d of Object.keys(sd.usage)) if (now - Date.parse(d) > USAGE_DAYS * DAY) delete sd.usage[d];
    const u = sd.usage[day] = sd.usage[day] || { v: 0, o: 0, vis: {}, uv: 0, nv: 0, p: {}, a: {}, br: {}, os: {}, dv: {}, ref: {}, h: new Array(24).fill(0), c: {} };
    const add = (m, k, cap) => { if (!k) return; if (m[k] == null && Object.keys(m).length >= (cap || 60)) k = 'אחר'; m[k] = (m[k] || 0) + 1; };
    const vid = /^[a-zA-Z0-9]{8,40}$/.test(String(b.vid || '')) ? sha256hex('vis|' + b.vid).slice(0, 10) : '';
    const who = s0 && s0.email ? s0.email : '';
    if (ev === 'open') {
      u.o++; add(u.a, app);
      if (who) { u.c[who] = u.c[who] || { v: 0, a: {} }; add(u.c[who].a, app, 25); }
    } else {
      u.v++; add(u.p, page);
      const ua = String(HDR['user-agent'] || '');
      add(u.br, /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\/|CriOS/.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'אחר', 12);
      add(u.os, /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'אחר', 12);
      add(u.dv, /Mobi|Android|iPhone/.test(ua) ? 'נייד' : /iPad|Tablet/.test(ua) ? 'טאבלט' : 'מחשב', 4);
      const rh = line(b.ref, 120).replace(/^https?:\/\//, '').split('/')[0].replace(/[.$]/g, '_');
      if (rh && !/github\.io$/.test(rh)) add(u.ref, rh, 30);
      u.h[Math.floor(((now + 3 * HOUR) % DAY) / HOUR)]++;
      if (who) { u.c[who] = u.c[who] || { v: 0, a: {} }; u.c[who].v++; }
    }
    if (vid && !u.vis[vid] && Object.keys(u.vis).length < 800) {
      u.vis[vid] = 1; u.uv++;
      // new or returning: the first day a visitor id was seen (hashes only, the oldest forgotten past 4000)
      sd.usageSeen = sd.usageSeen || {};
      if (!sd.usageSeen[vid]) { sd.usageSeen[vid] = day; u.nv++; const ks = Object.keys(sd.usageSeen); if (ks.length > 4000) for (const k of ks.slice(0, ks.length - 4000)) delete sd.usageSeen[k]; }
    }
    return out({ ok: true });
  }

  // Anyone may open an account: the first (initial) password arrives by email, no step by the admin; the admin sees it in the list (and is told at the first
  // sign-in) and controls what the client sees afterwards (sites, days, suspension). New accounts see every open site (never the hidden ones)
  // for SIGNUP_DAYS days. Someone who already has an account just gets an initial password, as with "forgot".
  case 'signup': {
    const e = email(b.email), nm = line(b.name, 60);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) || nm.length < 2) return out({ ok: false, error: 'bad-input' }, 400);
    if (sd.signupClosed) return out({ ok: false, error: 'signup-closed' }, 403);
    if (e === ADMIN_EMAIL) return out({ ok: false, error: 'bad-input' }, 400);
    if (!hit('su-ip', IPK, 3, HOUR) || !hit('su-all', 'all', 60, DAY) || !hit('su-mail', e, 3, HOUR)) return out({ ok: false, error: 'rate-limited' }, 429);
    const reply = { ok: true, sent: true };
    const temp = rndPassword();
    if (sd.clients[e]) {
      const a = sd.clients[e], keep = a.pwAt;
      giveTemp(a, temp, TEMP_CLIENT_DAYS * DAY, 'reset', false); a.pwAt = keep;
      log('הרשמה של כתובת שכבר רשומה: סיסמה ראשונית נשלחה', e);
    } else {
      if (Object.keys(sd.clients).length >= MAX_CLIENTS) return out({ ok: false, error: 'too-many-clients' }, 400);
      sd.clients[e] = { email: e, name: nm, phone: phone(b.phone), note: 'נרשם בעצמו', sites: ['*'], plan: 'free', createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + SIGNUP_DAYS * DAY).toISOString(), active: true, ipLock: false, maxDevices: DEFAULT_MAX_DEVICES, selfSignup: true };
      giveTemp(sd.clients[e], temp, TEMP_CLIENT_DAYS * DAY, 'admin', true);
      log('לקוח חדש נרשם בעצמו', e);
    }
    return out(reply, 200, mailTo(e, 'SPIDER · ברוכים הבאים, הסיסמה הראשונית שלך',
      `שלום ${nm},\n\nתודה שנרשמת ל־SPIDER.\nכניסה: ${LOGIN_URL}\nמייל: ${e}\nסיסמה ראשונית: ${temp}\n\nבכניסה הראשונה תבחר סיסמה משלך. הסיסמה הראשונית תקפה ל־${TEMP_CLIENT_DAYS} ימים.\n\nSPIDER · חיים קריספין · 054-4979771\n`));
  }

  case 'health':
    // what the install checks: which kind of cryptography this n8n has, and which address it sees for the caller
    return out({ ok: true, crypto: PW_FAST ? 'node' : 'js', ip: IP });

  case 'login': {
    const e = email(b.email), pw = String(b.password == null ? '' : b.password).slice(0, 200);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) || !pw) return out({ ok: false, error: 'bad-input' }, 400);
    const dev = String(b.device || '');
    if (!hit('login-ip', IPK, 20, HOUR)) return out({ ok: false, error: 'rate-limited' }, 429);
    const lk = e + '|' + IPK;                       // one address cannot lock the real owner out from another
    if (sd.lock[lk] > now || sd.lock[e] > now) return out({ ok: false, error: 'too-many' }, 429);
    const adm = e === ADMIN_EMAIL;
    const c = sd.clients[e];
    const acc = adm ? sd.admin : c;
    // The admin's own devices (ones that already signed in as admin) are never held back. Guessing from any other device gets
    // 10 tries an hour in total, however many addresses it comes from, so a short, memorable password is not easy to brute-force.
    sd.adminDevices = sd.adminDevices || [];
    const trusted = adm && /^[a-f0-9]{32}$/.test(dev) && sd.adminDevices.includes(sha256hex('dev:' + dev));
    if (adm && !trusted && sd.lock['admin-guess'] > now) return out({ ok: false, error: 'too-many' }, 429);
    // two checks every time (the chosen password and an emailed initial one), real or dummy, so the time reveals nothing
    const okMain = acc && acc.pw ? pwCheck(pw, acc.pw) : pwDummy(pw);
    const okTemp = tempOk(acc) ? pwCheck(pw, acc.tmp.h) : pwDummy(pw);
    const good = okMain || okTemp, viaTemp = !okMain && okTemp;
    const fail = (why) => {
      const f1 = (sd.fails[lk] = (sd.fails[lk] || []).filter((t) => now - t < HOUR).concat(now));
      const f2 = (sd.fails[e] = (sd.fails[e] || []).filter((t) => now - t < HOUR).concat(now));
      let mail = null, code = 401, error = 'bad-login';
      if (f1.length >= 8) { sd.lock[lk] = now + HOUR; error = 'too-many'; code = 429; if (adm || c) mail = alert('נחסמה כניסה אחרי ניסיונות כושלים', `8 סיסמאות שגויות עבור ${e} מהכתובת הזו. הכניסה משם נחסמה לשעה.`); }
      else if (f2.length >= 60) { sd.lock[e] = now + 10 * 60000; error = 'too-many'; code = 429; }   // many addresses at once: a short pause for everyone
      if (adm && !trusted) {
        const f3 = (sd.fails['admin-guess'] = (sd.fails['admin-guess'] || []).filter((t) => now - t < HOUR).concat(now));
        if (f3.length >= 10) { sd.lock['admin-guess'] = now + HOUR; error = 'too-many'; code = 429; mail = alert('ניחושי סיסמה למנהל', '10 סיסמאות שגויות בשעה האחרונה ממכשירים לא מוכרים. כניסה ממכשירים לא מוכרים נחסמה לשעה. המכשירים שנכנסת מהם בעבר ממשיכים לעבוד.'); }
      }
      log('כניסה נכשלה' + (why ? ' · ' + why : ''), e);
      return out({ ok: false, error, left: Math.max(0, 8 - f1.length) }, code, mail);
    };
    if (!good) return fail('');

    if (adm) {
      if (set(ADMIN_TOTP)) {
        const t = String(b.totp || '').replace(/\D/g, '');
        if (t.length !== 6) return out({ ok: false, error: 'totp-needed' }, 401);   // the password was right; the session waits for the app code
        const step = totpStep(ADMIN_TOTP, t, now);
        if (!step || step <= (sd.totpLast || 0)) return fail('קוד אפליקציה');
        sd.totpLast = step;
      }
      sd.fails[lk] = [];
      if (/^[a-f0-9]{32}$/.test(dev) && !trusted) { sd.adminDevices.unshift(sha256hex('dev:' + dev)); sd.adminDevices.length = Math.min(sd.adminDevices.length, 10); }
      if (!viaTemp) sd.admin.tmp = null;
      sd.admin.lastLogin = new Date(now).toISOString();
      const token = newSession(e, 'admin', now + ADMIN_SESSION_DAYS * DAY, viaTemp ? { mc: true } : {});
      log('כניסת מנהל' + (viaTemp ? ' עם סיסמה ראשונית' : ''), e);
      return out({ ok: true, token, role: 'admin', name: 'מנהל', mustChange: viaTemp }, 200, alert('כניסת מנהל', 'נכנסת למערכת SPIDER כמנהל. אם זה לא אתה, בקש סיסמה ראשונית חדשה בעמוד הכניסה ובחר סיסמה חדשה, או החלף את ADMIN_PASSWORD בסוד SPIDER והרץ את ההתקנה.'));
    }

    // a client: right password, now the subscription and the device
    if (!active(c)) { log('כניסה, מנוי לא פעיל', e); return out({ ok: false, error: 'inactive' }, 403); }
    if (!/^[a-f0-9]{32}$/.test(dev)) return out({ ok: false, error: 'bad-device' }, 400);
    const dh = sha256hex('dev:' + dev);
    let r = checkDevice(c, dh, true);
    let mail = r.news ? deviceMail(c, r.news) : null;
    let verified = null;
    if (r.status !== 'ok' && viaTemp) {
      // a new device (or address) reached with the emailed temporary password: the owner proved their mailbox, nobody else needs to approve
      verified = { evicted: approveByMail(c, r.d) };
      r = { status: 'ok', news: '', d: r.d };
      mail = alert('מכשיר חדש אושר על ידי הלקוח', `${c.name || c.email} (${c.email}) אישר מכשיר חדש בעצמו, עם סיסמה זמנית שנשלחה למייל שלו.\nמכשיר: ${UA || 'לא ידוע'}${verified.evicted ? '\n(המכשיר שלא היה בשימוש הכי הרבה זמן הוסר, כי הגיעו למקסימום ' + (c.maxDevices || DEFAULT_MAX_DEVICES) + ' מכשירים)' : ''}`);
      log('מכשיר אושר במייל' + (verified.evicted ? ' (מכשיר ישן הוסר)' : ''), e);
    } else if (r.news) log(r.news === 'first-device' ? 'מכשיר ראשון' : r.news === 'new-device' ? 'מכשיר חדש, נשלח אימות למייל' : r.news === 'blocked-ip' ? 'כתובת חדשה, נשלח אימות למייל' : 'כתובת חדשה', e);
    if (r.status !== 'ok') {
      // the right password from somewhere new: a temporary password goes straight to the client's email (the admin is only updated in the system)
      // one that was sent in the last 10 minutes is still good: trying again must not replace the password the owner is about to type
      const already = tempOk(c) && c.tmp.at && now - c.tmp.at < 10 * 60000 && c.pwBy !== undefined;
      let sent = already;
      if (!already && hit('devmail', e, 3, HOUR)) {
        const temp = rndPassword();
        giveTemp(c, temp, DAY, 'verify', false);
        sent = true;
        mail = mailTo(e, 'SPIDER · אישור מכשיר חדש', `שלום ${c.name || ''},\n\nמישהו (כנראה אתה) נכנס ל־SPIDER ממכשיר חדש.\nכדי לאשר אותו, היכנס שוב מהמכשיר הזה והקלד כסיסמה את הסיסמה הזמנית: ${temp}\nאחרי הכניסה תבחר סיסמה חדשה משלך. הסיסמה הזמנית תקפה ליום אחד.\n\nאם זה לא אתה, אפשר להתעלם: בלי הסיסמה הזמנית אף אחד לא ייכנס, והסיסמה הקיימת שלך ממשיכה לעבוד.\n\nכניסה: ${LOGIN_URL}\n\nSPIDER · חיים קריספין · 054-4979771\n`);
      } else mail = null;
      return out({ ok: false, error: 'verify-device', sent }, 403, mail);
    }
    sd.fails[lk] = [];
    if (!viaTemp) c.tmp = null;
    let exp = now + CLIENT_SESSION_DAYS * DAY;
    if (c.expiresAt) exp = Math.min(exp, Date.parse(c.expiresAt));
    const token = newSession(e, 'client', exp, { dev: dh, ...(viaTemp ? { mc: true } : {}) });
    c.lastLogin = new Date(now).toISOString();
    log('כניסת לקוח' + (viaTemp ? ' עם סיסמה ראשונית' : ''), e);
    return out({ ok: true, token, role: 'client', name: line(c.name, 60), mustChange: viaTemp, exp: new Date(exp).toISOString() }, 200, mail);
  }

  // An initial password to the registered email (the admin's, or a client's). The answer is the same for any address.
  // It is a second way in, valid for a while; the current password keeps working, so a stranger asking cannot lock anyone out.
  case 'forgot': {
    const e = email(b.email);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return out({ ok: false, error: 'bad-input' }, 400);
    if (!hit('fg-ip', IPK, 5, HOUR) || !hit('fg-all', 'all', 30, HOUR) || !hit('fg-mail', e, 3, HOUR)) return out({ ok: false, error: 'rate-limited' }, 429);
    const ok = { ok: true, sent: true };
    const adm = e === ADMIN_EMAIL, a = acct(e);
    if (!a) { pwDummy('x'); log('בקשת סיסמה לכתובת לא מוכרת', e); return out(ok); }
    const temp = rndPassword();
    const keep = a.pwAt;
    giveTemp(a, temp, adm ? TEMP_ADMIN_MIN * 60000 : TEMP_CLIENT_DAYS * DAY, 'reset', false);
    a.pwAt = keep;   // the date of the chosen password does not change
    log('סיסמה ראשונית נשלחה למייל', e);
    return out(ok, 200, mailTo(e, 'SPIDER · הסיסמה הראשונית שלך',
      `שלום${a.name ? ' ' + a.name : ''},\n\nהסיסמה הראשונית שלך: ${temp}\n\nהיא תקפה ${adm ? 'לשעה' : 'ל־' + TEMP_CLIENT_DAYS + ' ימים'}. נכנסים בעמוד ${LOGIN_URL} עם המייל הזה, ובכניסה הראשונה בוחרים סיסמה משלך.\nאם לא ביקשת, אפשר להתעלם מהמייל: הסיסמה הקיימת שלך ממשיכה לעבוד.\n\nSPIDER · חיים קריספין · 054-4979771\n`));
  }

  // choose one's own password: after an initial one (no need for the old), or from the account with the current password
  case 'change-password': {
    const s = session();
    if (!s) return out({ ok: false, error: 'signed-out' }, 401);
    if (!hit('chg-ip', IPK, 10, HOUR)) return out({ ok: false, error: 'rate-limited' }, 429);
    const np = String(b.password == null ? '' : b.password);
    if (np.length < MIN_PASSWORD || np.length > 100) return out({ ok: false, error: 'weak-password' }, 400);
    const a = acct(s.email);
    if (!a) return out({ ok: false, error: 'signed-out' }, 401);
    if (!s.mc) {
      if (!hit('chg-try', s.email, 10, HOUR)) return out({ ok: false, error: 'too-many' }, 429);
      if (!a.pw || !pwCheck(String(b.current || '').slice(0, 200), a.pw)) { log('החלפת סיסמה נכשלה', s.email); return out({ ok: false, error: 'bad-login' }, 403); }
    }
    a.pw = pwHash(np); a.tmp = null; a.pwBy = 'client'; a.pwAt = new Date(now).toISOString();
    const cur = tokenHash();
    closeSessions(s.email, cur);                      // every other open session ends; this one stays
    sd.sessions[cur].mc = false;
    log('הסיסמה הוחלפה', s.email);
    return out({ ok: true }, 200, s.role === 'admin' ? alert('סיסמת המנהל הוחלפה', 'סיסמת המנהל של SPIDER הוחלפה. אם זה לא אתה, בקש סיסמה ראשונית חדשה בעמוד הכניסה.') : null);
  }

  // ---------------------------------------------------------------- signed in
  case 'me': {
    const s = session();
    if (!s) return out({ ok: false, error: 'signed-out' }, 401);
    // signed in with an initial password: nothing else opens until a password of their own is chosen
    if (s.mc) return out({ ok: true, mustChange: true, role: s.role, name: s.role === 'admin' ? 'מנהל' : (sd.clients[s.email] || {}).name || '', email: s.email });
    if (s.role === 'admin') return out({ ok: true, role: 'admin', name: 'מנהל', email: s.email, sites: 'all', biz: bizProof() });
    const c = sd.clients[s.email];
    if (!active(c)) { delete sd.sessions[tokenHash()]; return out({ ok: false, error: 'inactive' }, 403); }
    // the device may have been removed, and a client with IP lock must still be at an approved address
    const r = checkDevice(c, s.dev, 'ip');
    if (r.status !== 'ok') {
      // the session stays: it works again on an approved address, and a removed device lost its sessions already
      return out({ ok: false, error: r.d && r.d.approved ? 'ip-blocked' : 'device-revoked', renew: RENEW }, 403, r.news ? deviceMail(c, r.news) : null);
    }
    return out({ ok: true, role: 'client', name: c.name || '', email: s.email, sites: c.sites || [], expiresAt: c.expiresAt || null, plan: c.plan || '' }, 200, r.news ? deviceMail(c, r.news) : null);
  }

  case 'logout': {
    const h = tokenHash();
    if (h) delete sd.sessions[h];
    return out({ ok: true });
  }

  // ------------------------------------------------------------- admin only
  case 'stats-get': {
    if (!admin()) return out({ ok: false, error: 'admin-only' }, 403);
    const days = Math.min(USAGE_DAYS, Math.max(1, parseInt(b.days, 10) || 30));   // the page asks for twice the range to compare with the period before
    const range = Math.min(days, Math.max(1, parseInt(b.range, 10) || days));   // the breakdowns below cover the last `range` days
    const list = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now + 3 * HOUR - i * DAY).toISOString().slice(0, 10);
      const u = (sd.usage || {})[d];
      const top = (m) => Object.entries(m || {}).sort((a, c) => c[1] - a[1]).slice(0, 15);
      list.push({ d, v: u ? u.v : 0, o: u ? u.o : 0, uv: u ? u.uv : 0, nv: u ? u.nv || 0 : 0, h: u ? u.h : null, p: u ? top(u.p) : [], a: u ? top(u.a) : [], dv: u ? top(u.dv) : [] });
    }
    const cur = list.slice(-range);
    const sum = (k) => { const m = {}; for (const d of cur) { const u = (sd.usage || {})[d.d]; if (u) for (const [x, n] of Object.entries(u[k] || {})) m[x] = (m[x] || 0) + n; } return Object.entries(m).sort((a, c) => c[1] - a[1]).slice(0, 25); };
    const hours = new Array(24).fill(0), clients = {};
    for (const d of cur) {
      const u = (sd.usage || {})[d.d]; if (!u) continue;
      u.h.forEach((n, i) => { hours[i] += n; });
      for (const [e, c] of Object.entries(u.c || {})) {
        const t = clients[e] = clients[e] || { v: 0, a: {} };
        t.v += c.v; for (const [x, n] of Object.entries(c.a || {})) t.a[x] = (t.a[x] || 0) + n;
      }
    }
    return out({ ok: true, days: list, pages: sum('p'), apps: sum('a'), browsers: sum('br'), os: sum('os'), devices: sum('dv'), refs: sum('ref'), hours,
      clients: Object.entries(clients).map(([e, c]) => ({ email: e, name: (sd.clients[e] || {}).name || '', views: c.v, apps: Object.entries(c.a).sort((a, x) => x[1] - a[1]).slice(0, 6) })).sort((a, c) => c.views - a.views).slice(0, 60),
      note: 'ניצול האתר בלבד: בלי כתובות IP ובלי הכניסות שלך כמנהל' });
  }

  case 'clients':
    if (!admin()) return out({ ok: false, error: 'admin-only' }, 403);
    return out({ ok: true, clients: Object.values(sd.clients).map(view), admin: adminView(), signup: !sd.signupClosed });

  // the admin's AI keys and addresses, kept so they survive another browser or a cleared one. Only the signed-in admin can read or
  // write it; the content is whatever the admin screen sends (up to 20 KB) and is never logged or mailed.
  case 'ai-vault-get':
    if (!admin()) return out({ ok: false, error: 'admin-only' }, 403);
    return out({ ok: true, blob: sd.aiVault ? sd.aiVault.blob : '', at: sd.aiVault ? sd.aiVault.at : null });
  case 'ai-vault-set': {
    if (!admin()) return out({ ok: false, error: 'admin-only' }, 403);
    const blob = String(b.blob == null ? '' : b.blob);
    if (blob.length > 20000) return out({ ok: false, error: 'too-big' }, 413);
    sd.aiVault = blob ? { blob, at: new Date(now).toISOString() } : null;
    log(blob ? 'מפתחות AI נשמרו בכספת' : 'כספת מפתחות AI נוקתה', ADMIN_EMAIL);
    return out({ ok: true, at: sd.aiVault ? sd.aiVault.at : null });
  }

  // The business plan the admin writes on plan.html: one document (up to 40 KB), readable and writable by the admin only.
  case 'plan-get':
    if (!admin()) return out({ ok: false, error: 'admin-only' }, 403);
    return out({ ok: true, blob: sd.plan ? sd.plan.blob : '', at: sd.plan ? sd.plan.at : null });
  case 'plan-set': {
    if (!admin()) return out({ ok: false, error: 'admin-only' }, 403);
    const blob = String(b.blob == null ? '' : b.blob);
    if (blob.length > 40000) return out({ ok: false, error: 'too-big' }, 413);
    sd.plan = blob ? { blob, at: new Date(now).toISOString() } : null;
    return out({ ok: true, at: sd.plan ? sd.plan.at : null });
  }

  case 'signup-set':
    if (!admin()) return out({ ok: false, error: 'admin-only' }, 403);
    sd.signupClosed = b.open === 'false' || b.open === false;
    log(sd.signupClosed ? 'הרשמה עצמית נסגרה' : 'הרשמה עצמית נפתחה', ADMIN_EMAIL);
    return out({ ok: true, signup: !sd.signupClosed });

  case 'client-save': {
    if (!admin()) return out({ ok: false, error: 'admin-only' }, 403);
    let p = {}; try { p = JSON.parse(b.payload || '{}'); } catch (x) {}
    const e = email(p.email);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return out({ ok: false, error: 'bad-input' }, 400);
    if (!sd.clients[e] && Object.keys(sd.clients).length >= MAX_CLIENTS) return out({ ok: false, error: 'too-many-clients' }, 400);
    const newPw = String(p.password == null ? '' : p.password);
    if (newPw && (newPw.length < MIN_PASSWORD || newPw.length > 100)) return out({ ok: false, error: 'weak-password' }, 400);
    const isNew = !sd.clients[e] && !(p.oldEmail && sd.clients[email(p.oldEmail)]);
    const old = p.oldEmail && email(p.oldEmail) !== e ? sd.clients[email(p.oldEmail)] : null;
    if (old) delete sd.clients[email(p.oldEmail)];
    const prev = sd.clients[e] || old || { createdAt: new Date(now).toISOString() };
    sd.clients[e] = {
      ...prev,
      email: e, phone: phone(p.phone), name: line(p.name, 60), note: line(p.note, 200),
      sites: (Array.isArray(p.sites) ? p.sites : []).map((x) => line(x, 64)).filter(Boolean).slice(0, 200),
      plan: ['day', 'week', 'month', 'year', 'custom', 'free'].includes(p.plan) ? p.plan : 'custom',
      expiresAt: p.expiresAt && !isNaN(Date.parse(p.expiresAt)) ? new Date(p.expiresAt).toISOString() : null,
      active: p.active !== false,
      ipLock: p.ipLock === true,
      maxDevices: Math.max(1, Math.min(10, Math.round(Number(p.maxDevices) || prev.maxDevices || DEFAULT_MAX_DEVICES)))
    };
    // a password typed by the admin is an initial one: the old password stops working, the client must choose their own
    if (newPw) giveTemp(sd.clients[e], newPw, TEMP_CLIENT_DAYS * DAY, 'admin', true);
    // a change in access applies at once: close the client's open sessions if they lost it, or got a new password
    if (!active(sd.clients[e]) || newPw) closeSessions(e);
    log(newPw ? 'עדכון לקוח וסיסמה ראשונית' : isNew ? 'לקוח חדש, סיסמה ראשונית נשלחה למייל' : 'עדכון לקוח', e);
    // a new client gets an initial password by email straight away, made here: it never passes through the admin
    const plain = newPw || (isNew && p.sendPassword !== false ? rndPassword() : '');
    if (plain && !newPw) giveTemp(sd.clients[e], plain, TEMP_CLIENT_DAYS * DAY, 'admin', true);
    const sent = plain && p.notify !== false ? mailTo(e, 'SPIDER · הסיסמה הראשונית שלך',
      `שלום ${line(p.name, 60)},\n\nנפתחה לך גישה ל־SPIDER.\nכניסה: ${LOGIN_URL}\nמייל: ${e}\nסיסמה ראשונית: ${plain}\n\nבכניסה הראשונה תבחר סיסמה משלך. הסיסמה הראשונית תקפה ל־${TEMP_CLIENT_DAYS} ימים.\n\nSPIDER · חיים קריספין · 054-4979771\n`) : null;
    return out({ ok: true, client: view(sd.clients[e]) }, 200, sent);
  }

  // approve or remove a device (or, with "ip", one address of it)
  case 'device-approve':
  case 'device-remove': {
    if (!admin()) return out({ ok: false, error: 'admin-only' }, 403);
    const c = sd.clients[email(b.email)];
    const d = c && (c.devices || []).find((x) => x.id === String(b.id || ''));
    if (!d) return out({ ok: false, error: 'not-found' }, 404);
    if (b.action === 'device-remove') {
      c.devices = c.devices.filter((x) => x !== d);
      for (const [t, s] of Object.entries(sd.sessions)) if (s.email === c.email && s.dev === d.id) delete sd.sessions[t];
      log('מכשיר הוסר', c.email);
    } else {
      if (!d.approved && c.devices.filter((x) => x.approved).length >= (c.maxDevices || DEFAULT_MAX_DEVICES)) return out({ ok: false, error: 'too-many-devices' }, 400);
      d.approved = true; d.how = 'admin';
      if (b.ip) { const r = d.ips.find((x) => x.k === String(b.ip)); if (r) r.approved = true; }
      else d.ips.forEach((r) => { r.approved = true; });
      log('מכשיר אושר', c.email);
    }
    return out({ ok: true, client: view(c) });
  }

  // a new initial password, made here and sent straight to the client's email (the admin is updated in the system, and never sees it)
  case 'client-reset': {
    if (!admin()) return out({ ok: false, error: 'admin-only' }, 403);
    const e = email(b.email), c = sd.clients[e];
    if (!c) return out({ ok: false, error: 'not-found' }, 404);
    const temp = rndPassword();
    giveTemp(c, temp, TEMP_CLIENT_DAYS * DAY, 'admin', true);
    closeSessions(e);
    log('סיסמה ראשונית חדשה', e);
    return out({ ok: true, client: view(c) }, 200, mailTo(e, 'SPIDER · הסיסמה הראשונית שלך',
      `שלום ${c.name || ''},\n\nנפתחה לך גישה ל־SPIDER.\nכניסה: ${LOGIN_URL}\nמייל: ${e}\nסיסמה ראשונית: ${temp}\n\nבכניסה הראשונה תבחר סיסמה משלך. הסיסמה הראשונית תקפה ל־${TEMP_CLIENT_DAYS} ימים.\n\nSPIDER · חיים קריספין · 054-4979771\n`));
  }

  // does this password open that account? (a password a client chose is never shown, but it can be tested)
  case 'client-check-password': {
    if (!admin()) return out({ ok: false, error: 'admin-only' }, 403);
    if (!hit('chk', IPK, 30, HOUR)) return out({ ok: false, error: 'rate-limited' }, 429);
    const e = email(b.email), a = acct(e), pw = String(b.password == null ? '' : b.password).slice(0, 200);
    if (!a || !pw) return out({ ok: false, error: 'not-found' }, 404);
    const main = a.pw ? pwCheck(pw, a.pw) : pwDummy(pw), temp = tempOk(a) ? pwCheck(pw, a.tmp.h) : pwDummy(pw);
    log('בדיקת סיסמה', e);
    return out({ ok: true, match: main || temp, kind: main ? 'chosen' : temp ? 'initial' : null });
  }

  case 'client-extend': {
    if (!admin()) return out({ ok: false, error: 'admin-only' }, 403);
    const e = email(b.email), c = sd.clients[e], days = Math.max(1, Math.min(3660, Number(b.days) || 0));
    if (!c) return out({ ok: false, error: 'not-found' }, 404);
    const from = Math.max(now, c.expiresAt ? Date.parse(c.expiresAt) : now);
    c.expiresAt = new Date(from + days * DAY).toISOString();
    c.active = true;
    log(`הארכה ב־${days} ימים`, e);
    return out({ ok: true, client: view(c) });
  }

  case 'client-delete': {
    if (!admin()) return out({ ok: false, error: 'admin-only' }, 403);
    const e = email(b.email);
    delete sd.clients[e];
    for (const [t, s] of Object.entries(sd.sessions)) if (s.email === e) delete sd.sessions[t];
    log('מחיקת לקוח', e);
    return out({ ok: true });
  }

  case 'payment': {
    if (!admin()) return out({ ok: false, error: 'admin-only' }, 403);
    let p = {}; try { p = JSON.parse(b.payload || '{}'); } catch (x) {}
    const e = email(p.email), c = sd.clients[e];
    if (!c) return out({ ok: false, error: 'not-found' }, 404);
    const amount = Math.round((Number(p.amount) || 0) * 100) / 100;
    if (amount <= 0 || amount > 100000) return out({ ok: false, error: 'bad-amount' }, 400);
    const METHOD = { cash: 1, check: 2, card: 3, transfer: 4, paypal: 5, bit: 10, other: 11 };
    const method = METHOD[p.method] ? p.method : 'other';
    const days = Math.max(0, Math.min(3660, Math.round(Number(p.days) || 0)));
    const desc = line(p.description, 120) || 'מנוי גישה ל־SPIDER';
    const pay = { id: rnd(6), at: new Date(now).toISOString(), amount, method, plan: line(p.plan, 10), days, description: desc, invoice: null };
    c.payments = c.payments || [];
    c.payments.unshift(pay);
    if (c.payments.length > 200) c.payments.length = 200;
    if (days) {
      const from = Math.max(now, c.expiresAt ? Date.parse(c.expiresAt) : now);
      c.expiresAt = new Date(from + days * DAY).toISOString();
      if (p.plan) c.plan = line(p.plan, 10);
      c.active = true;
    }
    log(`תשלום ${amount} ₪${days ? ' · +' + days + ' ימים' : ''}`, e);
    const body = { ok: true, client: view(c), payment: pay };
    if (!p.invoice) return out(body);
    if (!set(INVOICE.clientId) || !set(INVOICE.clientSecret)) { pay.invoice = { error: 'not-configured' }; return out({ ...body, invoice: pay.invoice }); }
    const doc = {
      description: desc, type: INVOICE.docType, lang: 'he', currency: 'ILS', vatType: 0,
      client: { name: c.name || e, emails: [e], phone: c.phone, add: true },
      payment: [{ date: new Date(now).toISOString().slice(0, 10), type: METHOD[method], price: amount, currency: 'ILS' }]
    };
    if (INVOICE.docType !== 400) doc.income = [{ description: desc, quantity: 1, price: amount, currency: 'ILS', vatType: 1 }];
    return [{ json: { code: 200, body, mail: null, invoice: {
      paymentId: pay.id, email: e,
      tokenUrl: INVOICE.sandbox ? 'https://api.sandbox.morning.dev/idp/v1/oauth/token' : 'https://api.morning.co/idp/v1/oauth/token',
      apiUrl: (INVOICE.sandbox ? 'https://sandbox.d.greeninvoice.co.il' : 'https://api.greeninvoice.co.il') + '/api/v1/documents',
      auth: { grant_type: 'client_credentials', client_id: INVOICE.clientId, client_secret: INVOICE.clientSecret },
      doc
    } } }];
  }

  case 'log':
    if (!admin()) return out({ ok: false, error: 'admin-only' }, 403);
    return out({ ok: true, log: sd.log.slice(0, 100), twoFactor: set(ADMIN_TOTP), password: true });
}
return out({ ok: false, error: 'unknown-action' }, 400);
