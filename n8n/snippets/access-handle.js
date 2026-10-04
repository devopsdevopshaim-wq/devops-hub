// Sign-in and access control for the portfolio. (Built into "Auth · Handle" by build-access-workflow.py.)
__SEC__

const ADMIN_EMAIL = '__ADMIN_EMAIL__';
const ADMIN_PHONE = '__ADMIN_PHONE__';
const RENEW = '__RENEW__';
// Filled in by the deploy from the SPIDER secret; never written in the repository.
const set = (v) => !!v && !/^__/.test(v);
const ADMIN_TOTP = '__ADMIN_TOTP_SECRET__';   // authenticator-app key of the admin; empty = email code only
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
const alert = (subject, text) => ({ to: ADMIN_EMAIL, subject: 'SPIDER · ' + subject, text: text + `\n\nזמן: ${new Date(now).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}\nכתובת: ${IP}\n`, alert: true });

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
const view = (c) => ({ ...c, activeNow: active(c), daysLeft: c.expiresAt ? Math.ceil((Date.parse(c.expiresAt) - now) / DAY) : null });

switch (b.action) {
  case 'request': {
    const e = email(b.email), p = phone(b.phone);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) || p.length < 9) return out({ ok: false, error: 'bad-input' }, 400);
    // the same limits for everyone, known or not, so they reveal nothing
    if (!hit('req-ip', IPK, 8, HOUR) || !hit('req-all', 'all', 40, HOUR) || !hit('req-mail', e, 5, HOUR)) return out({ ok: false, error: 'rate-limited' }, 429);
    if (!hit('req-wait', e, 1, 30000)) return out({ ok: false, error: 'wait' }, 429);
    const ok = { ok: true, sent: true };
    const c = sd.clients[e];
    const known = isAdmin(e, p) || (c && phone(c.phone) === p);
    // unknown details get the same answer, so nobody can probe who is a client
    if (!known) {
      log('ניסיון כניסה לא מוכר', e);
      // many strangers in an hour: tell the admin, once an hour
      if (!hit('unknown', 'all', 9, HOUR) && hit('unknown-alert', 'all', 1, HOUR)) return out(ok, 200, alert('ניסיונות כניסה חשודים', 'היו 10 ניסיונות כניסה עם פרטים לא מוכרים בשעה האחרונה.'));
      return out(ok);
    }
    if (sd.lock[e] > now) return out(ok);   // locked after too many wrong codes: no new code until it ends
    // a code that was sent in the last 2 minutes stays: someone else's request must not cancel the code the owner is waiting for
    const pend = sd.otp[e];
    if (pend && pend.h && pend.exp - 8 * 60000 > now) return out(ok);
    if (!isAdmin(e, p) && !active(c)) {
      log('ניסיון כניסה, מנוי לא פעיל', e);
      return out(ok, 200, { to: e, subject: 'SPIDER: הגישה שלך לא פעילה',
        text: `שלום ${line(c.name, 60)},\n\nהגישה שלך ל־SPIDER ${c.active === false ? 'מושהית' : 'הסתיימה' + (c.expiresAt ? ' ב־' + new Date(c.expiresAt).toLocaleDateString('he-IL') : '')}.\nלחידוש המנוי: ${RENEW}\n` });
    }
    const code = code6();
    sd.otp[e] = { h: sha256hex(code + ':' + e), phone: p, exp: now + 10 * 60000, tries: 0 };
    return out(ok, 200, { to: e, subject: `הקוד שלך ל־SPIDER: ${code}`,
      text: `הקוד שלך: ${code}\n\nהוא תקף ל־10 דקות.\nאם לא ביקשת להיכנס, אפשר להתעלם מהמייל הזה.\n\nSPIDER · חיים קריספין · 054-4979771\n` });
  }

  case 'verify': {
    const e = email(b.email), p = phone(b.phone);
    if (!hit('ver-ip', IPK, 30, HOUR)) return out({ ok: false, error: 'rate-limited' }, 429);
    if (sd.lock[e] > now) return out({ ok: false, error: 'too-many' }, 429);
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
    const role = isAdmin(e, p) ? 'admin' : 'client';
    const c = sd.clients[e];
    if (role === 'client' && !active(c)) { delete o.h; return out({ ok: false, error: 'inactive' }, 403); }
    // the admin also needs the authenticator-app code, once the key is set (SPIDER secret: ADMIN_TOTP_SECRET)
    if (role === 'admin' && set(ADMIN_TOTP)) {
      const t = String(b.totp || '').replace(/\D/g, '');
      if (t.length !== 6) return out({ ok: false, error: 'totp-needed' }, 401);   // the emailed code stays valid
      const step = totpStep(ADMIN_TOTP, t, now);
      if (!step || step <= (sd.totpLast || 0)) return bad('wrong-totp');
      sd.totpLast = step;
    }
    delete o.h;
    let exp = now + (role === 'admin' ? ADMIN_SESSION_DAYS : CLIENT_SESSION_DAYS) * DAY;
    if (role === 'client' && c.expiresAt) exp = Math.min(exp, Date.parse(c.expiresAt));
    const token = rnd(24);
    sd.sessions[sha256hex(token)] = { email: e, role, exp, at: now };   // only the hash is kept
    if (c) c.lastLogin = new Date(now).toISOString();
    log(role === 'admin' ? 'כניסת מנהל' : 'כניסת לקוח', e);
    return out({ ok: true, token, role, name: role === 'admin' ? 'מנהל' : line(c.name, 60), exp: new Date(exp).toISOString() }, 200,
      role === 'admin' ? alert('כניסת מנהל', 'נכנסת למערכת SPIDER כמנהל. אם זה לא אתה, חסום עכשיו את הגישה (שנה את ADMIN_EMAIL ב־n8n).') : null);
  }

  case 'me': {
    const s = session();
    if (!s) return out({ ok: false, error: 'signed-out' }, 401);
    if (s.role === 'admin') return out({ ok: true, role: 'admin', name: 'מנהל', email: s.email, sites: 'all', biz: bizProof() });
    const c = sd.clients[s.email];
    if (!active(c)) { delete sd.sessions[tokenHash()]; return out({ ok: false, error: 'inactive' }, 403); }
    return out({ ok: true, role: 'client', name: c.name || '', email: s.email, sites: c.sites || [], expiresAt: c.expiresAt || null, plan: c.plan || '' });
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
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) || phone(p.phone).length < 9) return out({ ok: false, error: 'bad-input' }, 400);
    if (!sd.clients[e] && Object.keys(sd.clients).length >= MAX_CLIENTS) return out({ ok: false, error: 'too-many-clients' }, 400);
    if (p.oldEmail && email(p.oldEmail) !== e) delete sd.clients[email(p.oldEmail)];
    const prev = sd.clients[e] || { createdAt: new Date(now).toISOString() };
    sd.clients[e] = {
      ...prev,
      email: e, phone: phone(p.phone), name: line(p.name, 60), note: line(p.note, 200),
      sites: (Array.isArray(p.sites) ? p.sites : []).map((x) => line(x, 64)).filter(Boolean).slice(0, 200),
      plan: ['day', 'week', 'month', 'year', 'custom', 'free'].includes(p.plan) ? p.plan : 'custom',
      expiresAt: p.expiresAt && !isNaN(Date.parse(p.expiresAt)) ? new Date(p.expiresAt).toISOString() : null,
      active: p.active !== false
    };
    // a change in access applies at once: close the client's open sessions if they lost it
    if (!active(sd.clients[e])) for (const [t, s] of Object.entries(sd.sessions)) if (s.email === e) delete sd.sessions[t];
    log('עדכון לקוח', e);
    return out({ ok: true, client: view(sd.clients[e]) });
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
    return out({ ok: true, log: sd.log.slice(0, 100), twoFactor: set(ADMIN_TOTP) });
}
return out({ ok: false, error: 'unknown-action' }, 400);
