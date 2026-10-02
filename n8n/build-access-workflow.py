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
      return out(ok, 200, { to: e, subject: 'הסדנה: הגישה שלך לא פעילה',
        text: `שלום ${c.name || ''},\n\nהגישה שלך להסדנה ${c.active === false ? 'מושהית' : 'הסתיימה' + (c.expiresAt ? ' ב־' + new Date(c.expiresAt).toLocaleDateString('he-IL') : '')}.\nלחידוש המנוי: ${RENEW}\n` });
    }
    const code = code6();
    sd.otp[e] = { code, phone: p, exp: now + 10 * 60000, tries: 0, sent };
    return out(ok, 200, { to: e, subject: `הקוד שלך להסדנה: ${code}`,
      text: `הקוד שלך: ${code}\n\nהוא תקף ל־10 דקות.\nאם לא ביקשת להיכנס, אפשר להתעלם מהמייל הזה.\n` });
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

  case 'log':
    if (!admin()) return out({ ok: false, error: 'admin-only' }, 403);
    return out({ ok: true, log: sd.log.slice(0, 100) });
}
return out({ ok: false, error: 'unknown-action' }, 400);
""".replace('__ADMIN_EMAIL__', ADMIN_EMAIL).replace('__ADMIN_PHONE__', ADMIN_PHONE).replace('__RENEW__', RENEW)

AFTER_MAIL = r"""// The answer to the browser, once the email was (or was not) sent.
const h = $('Auth · Handle').first().json;
if ($json.error) return [{ json: { code: 502, body: { ok: false, error: 'mail-failed' } } }];
return [{ json: { code: h.code, body: h.body } }];
"""

X = 0
nodes = [
    node('Note · Access', 'n8n-nodes-base.stickyNote', 1, {'content':
        '## כניסה והרשאות\n`POST /webhook/hasadna-auth` — האתר שולח לכאן בקשות כניסה. '
        'הקוד החד־פעמי נשלח במייל מצומת **Send · Email**: מחברים אליו את Gmail פעם אחת.\n\n'
        'המנהל מוגדר בראש הצומת **Auth · Handle** (ADMIN_EMAIL, ADMIN_PHONE). '
        'את הלקוחות, האתרים והמנויים מנהלים במסך הניהול של האתר.',
        'height': 230, 'width': 460, 'color': 3}, [X - 500, -200]),
    node('Auth · Webhook', 'n8n-nodes-base.webhook', 2,
         {'httpMethod': 'POST', 'path': 'hasadna-auth', 'responseMode': 'responseNode', 'options': {}},
         [X, 0], webhookId=uid('hasadna-auth')),
    node('Auth · Handle', 'n8n-nodes-base.code', 2, {'jsCode': HANDLE}, [X + 240, 0]),
    node('Send an email?', 'n8n-nodes-base.if', 2.2,
         {'conditions': {'options': {'caseSensitive': True, 'typeValidation': 'loose', 'version': 2},
                         'conditions': [{'id': uid('if-mail'), 'leftValue': '={{ !!$json.mail }}', 'rightValue': True,
                                         'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}],
                         'combinator': 'and'}, 'options': {}},
         [X + 480, 0]),
    node('Send · Email', 'n8n-nodes-base.gmail', 2.1,
         {'sendTo': '={{ $json.mail.to }}', 'subject': '={{ $json.mail.subject }}', 'emailType': 'text',
          'message': '={{ $json.mail.text }}', 'options': {'appendAttribution': False}},
         [X + 720, -100], onError='continueRegularOutput'),
    node('Auth · After mail', 'n8n-nodes-base.code', 2, {'jsCode': AFTER_MAIL}, [X + 960, -100]),
    node('Auth · Respond', 'n8n-nodes-base.respondToWebhook', 1.1,
         {'respondWith': 'json', 'responseBody': '={{ JSON.stringify($json.body) }}',
          'options': {'responseCode': '={{ $json.code || 200 }}',
                      'responseHeaders': {'entries': [
                          {'name': 'Access-Control-Allow-Origin', 'value': '*'},
                          {'name': 'Cache-Control', 'value': 'no-store'}]}}},
         [X + 1200, 0]),
]
main = [
    ('Auth · Webhook', 'Auth · Handle', 0),
    ('Auth · Handle', 'Send an email?', 0),
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

wf = {'name': 'הסדנה · כניסה והרשאות', 'nodes': nodes, 'connections': connections,
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
