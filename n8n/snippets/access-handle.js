// Sign-in and access control for the portfolio. (Built into "Auth · Handle" by build-access-workflow.py.)
//
//  The admin   signs in from anywhere with email + password (and the authenticator code, if one is set up).
//  A client    signs in with email + the password the admin gave them, from a device the admin approved.
//              The first device is accepted and the admin is told; every other new device waits for the admin.
//              A device is told apart by a random id kept in its browser; its IP address is recorded with it.
//              Clients with "IP lock" must also come from an approved address.
//  Until ADMIN_PASSWORD is set in the SPIDER secret, the admin keeps the older way in (email, phone, emailed code).
__SEC__

const ADMIN_EMAIL = '__ADMIN_EMAIL__';
const ADMIN_PHONE = '__ADMIN_PHONE__';
const RENEW = '__RENEW__';
// Filled in by the deploy from the SPIDER secret; never written in the repository.
const set = (v) => !!v && !/^__/.test(v);
const ADMIN_PW = '__ADMIN_PASSWORD_HASH__';   // "p1$iterations$salt$hash" made from ADMIN_PASSWORD; only the hash is here
const PASSWORDS = set(ADMIN_PW);
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
const DEFAULT_MAX_DEVICES = 3;

const sd = $getWorkflowStaticData('global');
sd.clients = sd.clients || {};
sd.otp = sd.otp || {};
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
const code6 = () => String(parseInt(rnd(4), 16) % 1000000).padStart(6, '0');
const log = (what, who) => { sd.log.unshift({ at: new Date(now).toISOString(), what, who, ip: IPK.slice(0, 6) }); if (sd.log.length > 300) sd.log.length = 300; };
const when = () => new Date(now).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
const alert = (subject, text) => ({ to: ADMIN_EMAIL, subject: 'SPIDER · ' + subject, text: text + `\n\nזמן: ${when()}\nכתובת: ${IP}\n`, alert: true });
// 84.229.12.7 -> 84.229.x.x : enough to recognise a network, not enough to expose a person
const maskIp = (ip) => /^\d+\.\d+\.\d+\.\d+$/.test(ip) ? ip.split('.').slice(0, 2).join('.') + '.x.x' : /:/.test(ip) ? ip.split(':').slice(0, 3).join(':') + '::' : 'לא ידוע';
const UA = line(HDR['user-agent'], 110);

// tidy up: expired sessions and codes, locks, counters, and anything left by the older (plain) format
for (const [t, s] of Object.entries(sd.sessions)) if (t.length !== 64 || s.exp < now) delete sd.sessions[t];
for (const [e, o] of Object.entries(sd.otp)) if (o.code || (o.exp || 0) < now - HOUR) delete sd.otp[e];
for (const [e, t] of Object.entries(sd.lock)) if (t < now) delete sd.lock[e];
for (const [e, a] of Object.entries(sd.fails)) if (!a.some((t) => now - t < HOUR)) delete sd.fails[e];
sweep();

if (!ORIGIN_OK) return out({ ok: false, error: 'forbidden' }, 403);
const b = $json.body || {};
if (JSON.stringify(b).length > 30000) return out({ ok: false, error: 'too-big' }, 413);
if (!hit('all', IPK, 240, 10 * 60000)) return out({ ok: false, error: 'rate-limited' }, 429);

const isAdmin = (e, p) => e === ADMIN_EMAIL && p === phone(ADMIN_PHONE);
const active = (c) => !!c && c.active !== false && (!c.expiresAt || Date.parse(c.expiresAt) > now);
const tokenHash = () => { const t = String(b.token || ''); return /^[a-f0-9]{48}$/.test(t) ? sha256hex(t) : ''; };
const session = () => { const h = tokenHash(); const s = h && sd.sessions[h]; return s && s.exp > now ? s : null; };
const admin = () => { const s = session(); return s && s.role === 'admin' ? s : null; };
const view = (c) => { const { pw, ...rest } = c; return { ...rest, hasPassword: !!pw, activeNow: active(c), daysLeft: c.expiresAt ? Math.ceil((Date.parse(c.expiresAt) - now) / DAY) : null }; };
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
    d = { id: devHash, ua: UA, first: iso, last: iso, approved: first, ips: [] };
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
    return out({ ok: true, password: PASSWORDS });

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
    const stored = adm ? (PASSWORDS ? ADMIN_PW : '') : (c && c.pw) || '';
    const good = stored ? pwCheck(pw, stored) : pwDummy(pw);
    const fail = (why) => {
      const f1 = (sd.fails[lk] = (sd.fails[lk] || []).filter((t) => now - t < HOUR).concat(now));
      const f2 = (sd.fails[e] = (sd.fails[e] || []).filter((t) => now - t < HOUR).concat(now));
      let mail = null, code = 401, error = 'bad-login';
      if (f1.length >= 8) { sd.lock[lk] = now + HOUR; error = 'too-many'; code = 429; if (adm || c) mail = alert('נחסמה כניסה אחרי ניסיונות כושלים', `8 סיסמאות שגויות עבור ${e} מהכתובת הזו. הכניסה משם נחסמה לשעה.`); }
      else if (f2.length >= 60) { sd.lock[e] = now + 10 * 60000; error = 'too-many'; code = 429; }   // many addresses at once: a short pause for everyone
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
      const token = newSession(e, 'admin', now + ADMIN_SESSION_DAYS * DAY);
      log('כניסת מנהל', e);
      return out({ ok: true, token, role: 'admin', name: 'מנהל' }, 200, alert('כניסת מנהל', 'נכנסת למערכת SPIDER כמנהל. אם זה לא אתה, החלף מיד את ADMIN_PASSWORD בסוד SPIDER והרץ את ההתקנה.'));
    }

    // a client: right password, now the subscription and the device
    if (!active(c)) { log('כניסה, מנוי לא פעיל', e); return out({ ok: false, error: 'inactive' }, 403); }
    if (!/^[a-f0-9]{32}$/.test(dev)) return out({ ok: false, error: 'bad-device' }, 400);
    const dh = sha256hex('dev:' + dev);
    const r = checkDevice(c, dh, true);
    const mail = r.news ? deviceMail(c, r.news) : null;
    if (r.news) log(r.news === 'first-device' ? 'מכשיר ראשון' : r.news === 'new-device' ? 'מכשיר חדש ממתין' : r.news === 'blocked-ip' ? 'כתובת חדשה ממתינה' : 'כתובת חדשה', e);
    if (r.status !== 'ok') return out({ ok: false, error: 'pending', renew: RENEW }, 403, mail);
    sd.fails[lk] = [];
    let exp = now + CLIENT_SESSION_DAYS * DAY;
    if (c.expiresAt) exp = Math.min(exp, Date.parse(c.expiresAt));
    const token = newSession(e, 'client', exp, { dev: dh });
    c.lastLogin = new Date(now).toISOString();
    log('כניסת לקוח', e);
    return out({ ok: true, token, role: 'client', name: line(c.name, 60), exp: new Date(exp).toISOString() }, 200, mail);
  }

  // ---------------------------------------------------------------- the older way in, for the admin only, until a password exists
  case 'request': {
    const e = email(b.email), p = phone(b.phone);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) || p.length < 9) return out({ ok: false, error: 'bad-input' }, 400);
    if (!hit('req-ip', IPK, 8, HOUR) || !hit('req-mail', e, 5, HOUR)) return out({ ok: false, error: 'rate-limited' }, 429);
    if (!hit('req-wait', e, 1, 30000)) return out({ ok: false, error: 'wait' }, 429);
    const ok = { ok: true, sent: true };
    if (PASSWORDS || !isAdmin(e, p)) {   // once a password exists this door is shut; everyone else just gets the same answer
      log('ניסיון כניסה לא מוכר', e);
      if (!hit('unknown', 'all', 9, HOUR) && hit('unknown-alert', 'all', 1, HOUR)) return out(ok, 200, alert('ניסיונות כניסה חשודים', 'היו 10 ניסיונות כניסה עם פרטים לא מוכרים בשעה האחרונה.'));
      return out(ok);
    }
    if (sd.lock[e] > now) return out(ok);
    // a code that was sent in the last 2 minutes stays: someone else's request must not cancel the code the owner is waiting for
    const pend = sd.otp[e];
    if (pend && pend.h && pend.exp - 8 * 60000 > now) return out(ok);
    const code = code6();
    sd.otp[e] = { h: sha256hex(code + ':' + e), phone: p, exp: now + 10 * 60000, tries: 0 };
    return out(ok, 200, { to: e, subject: `הקוד שלך ל־SPIDER: ${code}`,
      text: `הקוד שלך: ${code}\n\nהוא תקף ל־10 דקות.\nאם לא ביקשת להיכנס, אפשר להתעלם מהמייל הזה.\n\nSPIDER · חיים קריספין · 054-4979771\n` });
  }

  case 'verify': {
    const e = email(b.email), p = phone(b.phone);
    if (!hit('ver-ip', IPK, 30, HOUR)) return out({ ok: false, error: 'rate-limited' }, 429);
    if (PASSWORDS || sd.lock[e] > now) return out({ ok: false, error: PASSWORDS ? 'expired' : 'too-many' }, PASSWORDS ? 400 : 429);
    const o = sd.otp[e];
    if (!o || !o.h || o.exp < now) return out({ ok: false, error: 'expired' }, 400);
    // every wrong guess counts: 5 per code, 10 per hour per address, then a one-hour lock and a warning to the admin
    const bad = (error) => {
      o.tries = (o.tries || 0) + 1;
      const fails = (sd.fails[e] = (sd.fails[e] || []).filter((t) => now - t < HOUR).concat(now));
      let mail = null;
      if (fails.length >= 10) { sd.lock[e] = now + HOUR; delete o.h; mail = alert('נחסמה כניסה אחרי ניסיונות כושלים', `10 קודים שגויים עבור ${e}. הכניסה לכתובת הזו נחסמה לשעה.`); log('חסימה זמנית אחרי ניסיונות כושלים', e); }
      if (o.tries >= 5) delete o.h;
      return out({ ok: false, error: o.h ? error : 'too-many', left: o.h ? 5 - o.tries : 0 }, o.h ? 400 : 429, mail);
    };
    const codeOk = same(sha256hex(String(b.code || '').replace(/\D/g, '') + ':' + e), o.h);
    const phoneOk = same(o.phone, p);
    if (!codeOk || !phoneOk) return bad('wrong');
    if (!isAdmin(e, p)) return bad('wrong');
    if (set(ADMIN_TOTP)) {
      const t = String(b.totp || '').replace(/\D/g, '');
      if (t.length !== 6) return out({ ok: false, error: 'totp-needed' }, 401);   // the emailed code stays valid
      const step = totpStep(ADMIN_TOTP, t, now);
      if (!step || step <= (sd.totpLast || 0)) return bad('wrong-totp');
      sd.totpLast = step;
    }
    delete o.h;
    const token = newSession(e, 'admin', now + ADMIN_SESSION_DAYS * DAY);
    log('כניסת מנהל', e);
    return out({ ok: true, token, role: 'admin', name: 'מנהל', exp: new Date(now + ADMIN_SESSION_DAYS * DAY).toISOString() }, 200,
      alert('כניסת מנהל', 'נכנסת למערכת SPIDER כמנהל. אם זה לא אתה, קבע סיסמה (ADMIN_PASSWORD בסוד SPIDER) והרץ את ההתקנה.'));
  }

  // ---------------------------------------------------------------- signed in
  case 'me': {
    const s = session();
    if (!s) return out({ ok: false, error: 'signed-out' }, 401);
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
  case 'clients':
    if (!admin()) return out({ ok: false, error: 'admin-only' }, 403);
    return out({ ok: true, clients: Object.values(sd.clients).map(view) });

  case 'client-save': {
    if (!admin()) return out({ ok: false, error: 'admin-only' }, 403);
    let p = {}; try { p = JSON.parse(b.payload || '{}'); } catch (x) {}
    const e = email(p.email);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return out({ ok: false, error: 'bad-input' }, 400);
    if (!sd.clients[e] && Object.keys(sd.clients).length >= MAX_CLIENTS) return out({ ok: false, error: 'too-many-clients' }, 400);
    const newPw = String(p.password == null ? '' : p.password);
    if (newPw && (newPw.length < 10 || newPw.length > 100)) return out({ ok: false, error: 'weak-password' }, 400);
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
    if (newPw) { sd.clients[e].pw = pwHash(newPw); sd.clients[e].pwAt = new Date(now).toISOString(); }
    // a change in access applies at once: close the client's open sessions if they lost it, or got a new password
    if (!active(sd.clients[e]) || newPw) for (const [t, s] of Object.entries(sd.sessions)) if (s.email === e) delete sd.sessions[t];
    log(newPw ? 'עדכון לקוח וסיסמה' : 'עדכון לקוח', e);
    return out({ ok: true, client: view(sd.clients[e]) });
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
      d.approved = true;
      if (b.ip) { const r = d.ips.find((x) => x.k === String(b.ip)); if (r) r.approved = true; }
      else d.ips.forEach((r) => { r.approved = true; });
      log('מכשיר אושר', c.email);
    }
    return out({ ok: true, client: view(c) });
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
    return out({ ok: true, log: sd.log.slice(0, 100), twoFactor: set(ADMIN_TOTP), password: PASSWORDS });
}
return out({ ok: false, error: 'unknown-action' }, 400);
