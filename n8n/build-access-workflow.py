#!/usr/bin/env python3
"""Builds n8n/hasadna-access.json: who may enter the portfolio, and which sites they see.

One webhook, POST /webhook/hasadna-auth, with an "action":
  request  {email, phone}         sends a one-time 6-digit code (email for now; WhatsApp later)
  verify   {email, phone, code}   returns a session token
  me       {token}                who is signed in, and which sites they may see
  logout   {token}
  admin only (token of the admin):
  clients · client-save · client-delete · client-extend · log

Everything is kept in the workflow's memory (static data). The only connection to
make is Gmail on the "Send · Email" node, which sends the codes.

    python3 n8n/build-access-workflow.py
"""
import json
import uuid
from pathlib import Path

NS = 'hasadna-access/'
ADMIN_EMAIL = 'devopsdevopshaim@gmail.com'
ADMIN_PHONE = '0544979771'
RENEW = 'https://wa.me/972544979771'


def uid(name):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, NS + name))


def node(name, type_, version, params, pos, **extra):
    n = {'parameters': params, 'id': uid(name), 'name': name, 'type': type_, 'typeVersion': version, 'position': pos}
    n.update(extra)
    return n


HANDLE = r"""// Sign-in and access control for the portfolio.
const ADMIN_EMAIL = '__ADMIN_EMAIL__';
const ADMIN_PHONE = '__ADMIN_PHONE__';
const RENEW = '__RENEW__';
// Invoices through Morning (חשבונית ירוקה). Fill these once (Morning: הגדרות ← כלי מפתחים ← API):
//   docType 320 = חשבונית מס/קבלה (עוסק מורשה), 400 = קבלה (עוסק פטור)
const INVOICE = { clientId: '', clientSecret: '', docType: 320, sandbox: false };
const CLIENT_SESSION_DAYS = 7;   // capped by the end of the subscription
const ADMIN_SESSION_DAYS = 30;

const sd = $getWorkflowStaticData('global');
sd.clients = sd.clients || {};
sd.otp = sd.otp || {};
sd.sessions = sd.sessions || {};
sd.log = sd.log || [];
const b = $json.body || {};
const now = Date.now();
const DAY = 86400000;

const out = (body, code, mail) => [{ json: { code: code || 200, body, mail: mail || null } }];
const email = (e) => String(e || '').trim().toLowerCase().slice(0, 120);
const phone = (p) => { let d = String(p || '').replace(/\D/g, ''); if (d.startsWith('972')) d = '0' + d.slice(3); return d.slice(0, 15); };
const line = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, n);
function rnd(n) {
  try { return require('crypto').randomBytes(n).toString('hex'); } catch (e) {}
  try { const a = new Uint8Array(n); globalThis.crypto.getRandomValues(a); return Array.from(a, (x) => x.toString(16).padStart(2, '0')).join(''); } catch (e) {}
  let s = ''; for (let i = 0; i < n * 2; i++) s += Math.floor(Math.random() * 16).toString(16); return s;
}
const code6 = () => String(parseInt(rnd(4), 16) % 1000000).padStart(6, '0');
const log = (what, who) => { sd.log.unshift({ at: new Date(now).toISOString(), what, who }); if (sd.log.length > 300) sd.log.length = 300; };

// tidy up
for (const [t, s] of Object.entries(sd.sessions)) if (s.exp < now) delete sd.sessions[t];
for (const [e, o] of Object.entries(sd.otp)) if ((o.exp || 0) < now - 3600000 && !(o.sent || []).some((t) => now - t < 3600000)) delete sd.otp[e];

const isAdmin = (e, p) => e === ADMIN_EMAIL && p === phone(ADMIN_PHONE);
const active = (c) => !!c && c.active !== false && (!c.expiresAt || Date.parse(c.expiresAt) > now);
const session = () => { const s = sd.sessions[String(b.token || '')]; return s && s.exp > now ? s : null; };
const admin = () => { const s = session(); return s && s.role === 'admin' ? s : null; };
const view = (c) => ({ ...c, activeNow: active(c), daysLeft: c.expiresAt ? Math.ceil((Date.parse(c.expiresAt) - now) / DAY) : null });

switch (b.action) {
  case 'request': {
    const e = email(b.email), p = phone(b.phone);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) || p.length < 9) return out({ ok: false, error: 'bad-input' }, 400);
    const o = sd.otp[e] || {};
    const sent = (o.sent || []).filter((t) => now - t < 3600000);
    if (sent.length >= 5) return out({ ok: false, error: 'too-many' }, 429);
    const ok = { ok: true, sent: true };
    const c = sd.clients[e];
    const known = isAdmin(e, p) || (c && phone(c.phone) === p);
    // unknown details get the same answer, so nobody can probe who is a client
    if (!known) { log('ניסיון כניסה לא מוכר', e); return out(ok); }
    sent.push(now);
    if (!isAdmin(e, p) && !active(c)) {
      sd.otp[e] = { sent };
      log('ניסיון כניסה, מנוי לא פעיל', e);
      return out(ok, 200, { to: e, subject: 'SPIDER: הגישה שלך לא פעילה',
        text: `שלום ${c.name || ''},\n\nהגישה שלך ל־SPIDER ${c.active === false ? 'מושהית' : 'הסתיימה' + (c.expiresAt ? ' ב־' + new Date(c.expiresAt).toLocaleDateString('he-IL') : '')}.\nלחידוש המנוי: ${RENEW}\n` });
    }
    const code = code6();
    sd.otp[e] = { code, phone: p, exp: now + 10 * 60000, tries: 0, sent };
    return out(ok, 200, { to: e, subject: `הקוד שלך ל־SPIDER: ${code}`,
      text: `הקוד שלך: ${code}\n\nהוא תקף ל־10 דקות.\nאם לא ביקשת להיכנס, אפשר להתעלם מהמייל הזה.\n\nSPIDER · חיים קריספין · 054-4979771\n` });
  }

  case 'verify': {
    const e = email(b.email), p = phone(b.phone), o = sd.otp[e];
    if (!o || !o.code || o.exp < now) return out({ ok: false, error: 'expired' }, 400);
    if (o.phone !== p) return out({ ok: false, error: 'wrong' }, 400);
    o.tries = (o.tries || 0) + 1;
    if (o.tries > 5) { delete o.code; return out({ ok: false, error: 'too-many' }, 429); }
    if (String(b.code || '').replace(/\D/g, '') !== o.code) return out({ ok: false, error: 'wrong', left: 5 - o.tries }, 400);
    delete o.code;
    const role = isAdmin(e, p) ? 'admin' : 'client';
    const c = sd.clients[e];
    if (role === 'client' && !active(c)) return out({ ok: false, error: 'inactive' }, 403);
    let exp = now + (role === 'admin' ? ADMIN_SESSION_DAYS : CLIENT_SESSION_DAYS) * DAY;
    if (role === 'client' && c.expiresAt) exp = Math.min(exp, Date.parse(c.expiresAt));
    const token = rnd(24);
    sd.sessions[token] = { email: e, role, exp, at: now };
    if (c) c.lastLogin = new Date(now).toISOString();
    log(role === 'admin' ? 'כניסת מנהל' : 'כניסת לקוח', e);
    return out({ ok: true, token, role, name: role === 'admin' ? 'מנהל' : (c.name || ''), exp: new Date(exp).toISOString() });
  }

  case 'me': {
    const s = session();
    if (!s) return out({ ok: false, error: 'signed-out' }, 401);
    if (s.role === 'admin') return out({ ok: true, role: 'admin', name: 'מנהל', email: s.email, sites: 'all' });
    const c = sd.clients[s.email];
    if (!active(c)) { delete sd.sessions[String(b.token)]; return out({ ok: false, error: 'inactive' }, 403); }
    return out({ ok: true, role: 'client', name: c.name || '', email: s.email, sites: c.sites || [], expiresAt: c.expiresAt || null, plan: c.plan || '' });
  }

  case 'logout':
    delete sd.sessions[String(b.token || '')];
    return out({ ok: true });

  // ------------------------------------------------------------- admin only
  case 'clients':
    if (!admin()) return out({ ok: false, error: 'admin-only' }, 403);
    return out({ ok: true, clients: Object.values(sd.clients).map(view) });

  case 'client-save': {
    if (!admin()) return out({ ok: false, error: 'admin-only' }, 403);
    let p = {}; try { p = JSON.parse(b.payload || '{}'); } catch (x) {}
    const e = email(p.email);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) || phone(p.phone).length < 9) return out({ ok: false, error: 'bad-input' }, 400);
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
    if (amount <= 0) return out({ ok: false, error: 'bad-amount' }, 400);
    const METHOD = { cash: 1, check: 2, card: 3, transfer: 4, paypal: 5, bit: 10, other: 11 };
    const method = METHOD[p.method] ? p.method : 'other';
    const days = Math.max(0, Math.min(3660, Math.round(Number(p.days) || 0)));
    const desc = line(p.description, 120) || 'מנוי גישה ל־SPIDER';
    const pay = { id: rnd(6), at: new Date(now).toISOString(), amount, method, plan: line(p.plan, 10), days, description: desc, invoice: null };
    c.payments = c.payments || [];
    c.payments.unshift(pay);
    if (days) {
      const from = Math.max(now, c.expiresAt ? Date.parse(c.expiresAt) : now);
      c.expiresAt = new Date(from + days * DAY).toISOString();
      if (p.plan) c.plan = line(p.plan, 10);
      c.active = true;
    }
    log(`תשלום ${amount} ₪${days ? ' · +' + days + ' ימים' : ''}`, e);
    const body = { ok: true, client: view(c), payment: pay };
    if (!p.invoice) return out(body);
    if (!INVOICE.clientId || !INVOICE.clientSecret) { pay.invoice = { error: 'not-configured' }; return out({ ...body, invoice: pay.invoice }); }
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
    return out({ ok: true, log: sd.log.slice(0, 100) });
}
return out({ ok: false, error: 'unknown-action' }, 400);
""".replace('__ADMIN_EMAIL__', ADMIN_EMAIL).replace('__ADMIN_PHONE__', ADMIN_PHONE).replace('__RENEW__', RENEW)

INVOICE_SAVE = r"""// Keeps the invoice number and link on the payment, and emails it to the client.
const h = $('Auth · Handle').first().json, job = h.invoice;
const sd = $getWorkflowStaticData('global');
const c = sd.clients[job.email];
const pay = c && (c.payments || []).find((x) => x.id === job.paymentId);
const r = $json;
let inv;
if (r && (r.number || r.id) && !r.error) inv = { number: r.number, id: r.id, url: (r.url && (r.url.he || r.url.origin)) || '' };
else inv = { error: (r && r.error && (r.error.message || r.error.description || JSON.stringify(r.error).slice(0, 200))) || (r && (r.errorMessage || r.message)) || 'invoice-failed' };
if (pay) pay.invoice = inv;
const body = { ...h.body, invoice: inv };
const mail = inv.url ? { to: job.email, subject: `המסמך שלך מ־SPIDER: מספר ${inv.number}`,
  text: `שלום ${c && c.name ? c.name : ''},\n\nתודה על התשלום.\nהמסמך שלך (מספר ${inv.number}): ${inv.url}\n\nחיים קריספין · SPIDER\n054-4979771\n` } : null;
return [{ json: { code: 200, body, mail } }];
"""

AFTER_MAIL = r"""// The answer to the browser, once the email was (or was not) sent.
const h = $('Send an email?').first().json;
if ($json.error) return [{ json: { code: 502, body: { ok: false, error: 'mail-failed' } } }];
return [{ json: { code: h.code, body: h.body } }];
"""

X = 0
nodes = [
    node('Note · Access', 'n8n-nodes-base.stickyNote', 1, {'content':
        '## כניסה והרשאות\n`POST /webhook/hasadna-auth` — האתר שולח לכאן בקשות כניסה. '
        'הקוד החד־פעמי נשלח במייל מצומת **Send · Email** (SMTP של Gmail, סיסמת אפליקציה; ההתקנה מ־GitHub מחברת אותו לבד).\n\n'
        'המנהל מוגדר בראש הצומת **Auth · Handle** (ADMIN_EMAIL, ADMIN_PHONE). '
        'חשבוניות: ממלאים שם את INVOICE (פרטי ה־API של Morning / חשבונית ירוקה). '
        'את הלקוחות, האתרים והמנויים מנהלים במסך הניהול של האתר.',
        'height': 230, 'width': 460, 'color': 3}, [X - 500, -200]),
    node('Auth · Webhook', 'n8n-nodes-base.webhook', 2,
         {'httpMethod': 'POST', 'path': 'hasadna-auth', 'responseMode': 'responseNode', 'options': {}},
         [X, 0], webhookId=uid('hasadna-auth')),
    node('Auth · Handle', 'n8n-nodes-base.code', 2, {'jsCode': HANDLE}, [X + 240, 0]),
    node('Issue an invoice?', 'n8n-nodes-base.if', 2.2,
         {'conditions': {'options': {'caseSensitive': True, 'typeValidation': 'loose', 'version': 2},
                         'conditions': [{'id': uid('if-invoice'), 'leftValue': '={{ !!$json.invoice }}', 'rightValue': True,
                                         'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}],
                         'combinator': 'and'}, 'options': {}},
         [X + 420, 0]),
    node('Invoice · Token', 'n8n-nodes-base.httpRequest', 4.2,
         {'method': 'POST', 'url': '={{ $json.invoice.tokenUrl }}', 'sendBody': True, 'specifyBody': 'json',
          'jsonBody': '={{ JSON.stringify($json.invoice.auth) }}', 'options': {'timeout': 20000}},
         [X + 640, -320], onError='continueRegularOutput'),
    node('Invoice · Create', 'n8n-nodes-base.httpRequest', 4.2,
         {'method': 'POST', 'url': "={{ $('Auth · Handle').first().json.invoice.apiUrl }}",
          'sendHeaders': True, 'headerParameters': {'parameters': [{'name': 'Authorization', 'value': '=Bearer {{ $json.accessToken }}'}]},
          'sendBody': True, 'specifyBody': 'json',
          'jsonBody': "={{ JSON.stringify($('Auth · Handle').first().json.invoice.doc) }}", 'options': {'timeout': 30000}},
         [X + 860, -320], onError='continueRegularOutput'),
    node('Invoice · Save', 'n8n-nodes-base.code', 2, {'jsCode': INVOICE_SAVE}, [X + 1080, -320]),
    node('Send an email?', 'n8n-nodes-base.if', 2.2,
         {'conditions': {'options': {'caseSensitive': True, 'typeValidation': 'loose', 'version': 2},
                         'conditions': [{'id': uid('if-mail'), 'leftValue': '={{ !!$json.mail }}', 'rightValue': True,
                                         'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}],
                         'combinator': 'and'}, 'options': {}},
         [X + 660, 0]),
    # SMTP through Gmail with an app password: the deploy (.github/scripts/n8n-deploy.mjs)
    # creates the credential from the GMAIL_APP_PASSWORD secret, so nothing is clicked in n8n.
    node('Send · Email', 'n8n-nodes-base.emailSend', 2.1,
         {'fromEmail': 'SPIDER · חיים קריספין <' + ADMIN_EMAIL + '>', 'toEmail': '={{ $json.mail.to }}',
          'subject': '={{ $json.mail.subject }}', 'emailFormat': 'text', 'text': '={{ $json.mail.text }}',
          'options': {'appendAttribution': False}},
         [X + 900, -100], onError='continueRegularOutput'),
    node('Auth · After mail', 'n8n-nodes-base.code', 2, {'jsCode': AFTER_MAIL}, [X + 1120, -100]),
    node('Auth · Respond', 'n8n-nodes-base.respondToWebhook', 1.1,
         {'respondWith': 'json', 'responseBody': '={{ JSON.stringify($json.body) }}',
          'options': {'responseCode': '={{ $json.code || 200 }}',
                      'responseHeaders': {'entries': [
                          {'name': 'Access-Control-Allow-Origin', 'value': '*'},
                          {'name': 'Cache-Control', 'value': 'no-store'}]}}},
         [X + 1360, 0]),
]
main = [
    ('Auth · Webhook', 'Auth · Handle', 0),
    ('Auth · Handle', 'Issue an invoice?', 0),
    ('Issue an invoice?', 'Invoice · Token', 0),
    ('Issue an invoice?', 'Send an email?', 1),
    ('Invoice · Token', 'Invoice · Create', 0),
    ('Invoice · Create', 'Invoice · Save', 0),
    ('Invoice · Save', 'Send an email?', 0),
    ('Send an email?', 'Send · Email', 0),
    ('Send an email?', 'Auth · Respond', 1),
    ('Send · Email', 'Auth · After mail', 0),
    ('Auth · After mail', 'Auth · Respond', 0),
]
connections = {}
for a, b, o in main:
    outs = connections.setdefault(a, {}).setdefault('main', [])
    while len(outs) <= o:
        outs.append([])
    outs[o].append({'node': b, 'type': 'main', 'index': 0})

wf = {'name': 'SPIDER · כניסה והרשאות', 'nodes': nodes, 'connections': connections,
      'active': False, 'settings': {'executionOrder': 'v1'}, 'pinData': {},
      'meta': {'templateCredsSetupCompleted': False}, 'tags': []}
names = [n['name'] for n in nodes]
assert len(names) == len(set(names))
for src, kinds in connections.items():
    assert src in names
    for lists in kinds.values():
        for lst in lists:
            for c in lst:
                assert c['node'] in names, c['node']
out = Path(__file__).with_name('hasadna-access.json')
out.write_text(json.dumps(wf, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('wrote', out, len(nodes), 'nodes')
