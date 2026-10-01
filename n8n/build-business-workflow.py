#!/usr/bin/env python3
"""Builds n8n/hasadna-business.json: leads and the price list for the services page.

Three webhooks, everything kept in the workflow's own memory (static data), so
there is nothing to connect before it works:
  POST /webhook/hasadna-lead    the services page sends every lead (and WhatsApp clicks) here
  GET  /webhook/hasadna-prices  the services page reads the prices and offers set by the admin
  POST /webhook/hasadna-admin   the admin screen: list leads, change status, edit prices.
                                Needs the admin password, chosen once from the admin screen.
Optional: an email for every new lead (connect Gmail, then enable the node).

    python3 n8n/build-business-workflow.py
"""
import json
import uuid
from pathlib import Path

NS = 'hasadna-business/'
EMAIL = 'devopsdevopshaim@gmail.com'


def uid(name):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, NS + name))


def node(name, type_, version, params, pos, **extra):
    n = {'parameters': params, 'id': uid(name), 'name': name, 'type': type_, 'typeVersion': version, 'position': pos}
    n.update(extra)
    return n


def note(name, text, pos, w=440, h=240, color=4):
    return node(name, 'n8n-nodes-base.stickyNote', 1, {'content': text, 'height': h, 'width': w, 'color': color}, pos)


def webhook(name, method, path, pos):
    return node(name, 'n8n-nodes-base.webhook', 2,
                {'httpMethod': method, 'path': path, 'responseMode': 'responseNode', 'options': {}},
                pos, webhookId=uid(path))


def respond(name, pos):
    return node(name, 'n8n-nodes-base.respondToWebhook', 1.1,
                {'respondWith': 'json', 'responseBody': '={{ JSON.stringify($json.body) }}',
                 'options': {'responseCode': '={{ $json.code || 200 }}',
                             'responseHeaders': {'entries': [
                                 {'name': 'Access-Control-Allow-Origin', 'value': '*'},
                                 {'name': 'Cache-Control', 'value': 'no-store'}]}}},
                pos)


SAVE_LEAD = r"""// Saves a lead from the services page (or counts a WhatsApp click).
const sd = $getWorkflowStaticData('global');
sd.leads = sd.leads || [];
sd.clicks = sd.clicks || {};
const b = $json.body || {};
const line = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, n);
const text = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ').trim().slice(0, n);

if (b.kind === 'click') {
  const k = line(b.source, 40) || 'other';
  sd.clicks[k] = (sd.clicks[k] || 0) + 1;
  return [{ json: { code: 200, body: { ok: true }, notify: false } }];
}
// a hidden field people never fill; bots do
if (line(b.website, 50)) return [{ json: { code: 200, body: { ok: true }, notify: false } }];

const lead = {
  id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
  at: new Date().toISOString(),
  name: line(b.name, 60),
  phone: line(b.phone, 20),
  biz: line(b.biz, 80),
  service: line(b.service, 80),
  msg: text(b.msg, 800),
  code: line(b.code, 20),
  page: line(b.page, 200),
  status: 'new',
  note: ''
};
if (!lead.name && !lead.phone) return [{ json: { code: 400, body: { ok: false, error: 'empty' }, notify: false } }];
sd.leads.unshift(lead);
if (sd.leads.length > 2000) sd.leads.length = 2000;
return [{ json: { code: 200, body: { ok: true, id: lead.id }, notify: true, lead } }];
"""

PRICES = r"""// Public: the prices and offers the admin set (empty = the page uses services.json).
const sd = $getWorkflowStaticData('global');
return [{ json: { code: 200, body: { ok: true, prices: sd.prices || null } } }];
"""

ADMIN = r"""// The admin screen's API. Every call carries the admin password.
const sd = $getWorkflowStaticData('global');
// Optional: write a fixed password here; it then replaces the one chosen from the admin screen.
const ADMIN_KEY = '';

const b = $json.body || {};
const key = String(b.key || '');
const stored = ADMIN_KEY || sd.adminKey || '';
const out = (body, code) => [{ json: { code: code || 200, body } }];
const line = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, n);

if (b.action === 'setup') {
  if (stored) return out({ ok: false, error: 'already-set' }, 403);
  if (key.length < 8) return out({ ok: false, error: 'short' }, 400);
  sd.adminKey = key;
  return out({ ok: true, setup: true });
}
if (!stored) return out({ ok: false, error: 'no-key' }, 403);
if (key !== stored) return out({ ok: false, error: 'bad-key' }, 403);

let p = {};
try { p = JSON.parse(b.payload || '{}'); } catch (e) { return out({ ok: false, error: 'bad-payload' }, 400); }
sd.leads = sd.leads || [];
const STATUSES = ['new', 'working', 'quoted', 'won', 'lost'];

switch (b.action) {
  case 'list':
    return out({ ok: true, leads: sd.leads, clicks: sd.clicks || {}, prices: sd.prices || null });

  case 'lead': {
    const l = sd.leads.find((x) => x.id === p.id);
    if (!l) return out({ ok: false, error: 'not-found' }, 404);
    if (STATUSES.includes(p.status)) l.status = p.status;
    if (p.note !== undefined) l.note = String(p.note).slice(0, 500);
    l.updatedAt = new Date().toISOString();
    return out({ ok: true, lead: l });
  }

  case 'lead-delete':
    sd.leads = sd.leads.filter((x) => x.id !== p.id);
    return out({ ok: true });

  case 'prices': {
    if (p.reset) { delete sd.prices; return out({ ok: true, prices: null }); }
    const services = {};
    Object.keys(p.services || {}).slice(0, 40).forEach((id) => {
      const s = p.services[id] || {};
      const from = Math.max(0, Math.round(Number(s.from) || 0));
      services[line(id, 40)] = { title: line(s.title, 80), from, unit: line(s.unit, 30), hidden: !!s.hidden };
    });
    const offers = (Array.isArray(p.offers) ? p.offers : []).slice(0, 12).map((o) => ({
      tag: line(o.tag, 20), title: line(o.title, 100), text: line(o.text, 300),
      until: /^\d{4}-\d{2}-\d{2}$/.test(o.until || '') ? o.until : '',
      code: line(o.code, 20).toUpperCase(), active: o.active !== false
    })).filter((o) => o.title);
    sd.prices = { services, offers, note: line(p.note, 300), updatedAt: new Date().toISOString() };
    return out({ ok: true, prices: sd.prices });
  }

  case 'password': {
    if (ADMIN_KEY) return out({ ok: false, error: 'fixed-in-n8n' }, 400);
    const nk = String(p.newKey || '');
    if (nk.length < 8) return out({ ok: false, error: 'short' }, 400);
    sd.adminKey = nk;
    return out({ ok: true });
  }
}
return out({ ok: false, error: 'unknown-action' }, 400);
"""

X, Y_L, Y_P, Y_A = 0, 0, 420, 760
nodes = [
    note('Note · Leads',
         '## לידים\n`POST /webhook/hasadna-lead` — כל טופס בדף השירותים נשמר כאן (גם לחיצות על וואטסאפ נספרות). '
         'רואים ומנהלים את הלידים במסך הניהול של האתר ← "לידים ומחירון".\n\n'
         'אופציונלי: מייל על כל ליד — מחברים Gmail בצומת "Lead · Email" ומפעילים אותו (מקש D).',
         [X - 480, Y_L - 200], h=240, color=6),
    webhook('Lead · Webhook', 'POST', 'hasadna-lead', [X, Y_L]),
    node('Lead · Save', 'n8n-nodes-base.code', 2, {'jsCode': SAVE_LEAD}, [X + 240, Y_L]),
    respond('Lead · Respond', [X + 480, Y_L - 80]),
    node('New lead?', 'n8n-nodes-base.if', 2.2,
         {'conditions': {'options': {'caseSensitive': True, 'typeValidation': 'loose', 'version': 2},
                         'conditions': [{'id': uid('if-notify'), 'leftValue': '={{ $json.notify }}', 'rightValue': True,
                                         'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}],
                         'combinator': 'and'}, 'options': {}},
         [X + 480, Y_L + 100]),
    node('Lead · Email', 'n8n-nodes-base.gmail', 2.1,
         {'sendTo': EMAIL,
          'subject': "={{ 'ליד חדש: ' + $json.lead.name + ($json.lead.service ? ' · ' + $json.lead.service : '') }}",
          'emailType': 'text',
          'message': "={{ 'שם: ' + $json.lead.name + '\\nטלפון: ' + $json.lead.phone + '\\nעסק: ' + $json.lead.biz + '\\nשירות: ' + $json.lead.service + ($json.lead.code ? '\\nמבצע: ' + $json.lead.code : '') + '\\n\\n' + $json.lead.msg + '\\n\\nוואטסאפ: https://wa.me/' + String($json.lead.phone).replace(/\\D/g, '').replace(/^0/, '972') }}",
          'options': {}},
         [X + 720, Y_L + 100], disabled=True),

    note('Note · Prices',
         '## מחירון\n`GET /webhook/hasadna-prices` — דף השירותים קורא מכאן את המחירים והמבצעים שקבעת במסך הניהול. '
         'כל עוד לא שמרת כלום, הדף משתמש במחירים שבקובץ services.json.',
         [X - 480, Y_P - 170], h=200, color=5),
    webhook('Prices · Webhook', 'GET', 'hasadna-prices', [X, Y_P]),
    node('Prices · Read', 'n8n-nodes-base.code', 2, {'jsCode': PRICES}, [X + 240, Y_P]),
    respond('Prices · Respond', [X + 480, Y_P]),

    note('Note · Admin',
         '## ניהול\n`POST /webhook/hasadna-admin` — מסך הניהול של האתר משתמש בזה: רשימת לידים, שינוי סטטוס והערות, ושמירת מחירון. '
         'כל בקשה דורשת את סיסמת המנהל. את הסיסמה קובעים פעם אחת ממסך הניהול. שכחת? כותבים סיסמה חדשה ב־ADMIN_KEY בצומת "Admin · Handle".',
         [X - 480, Y_A - 190], h=230, color=3),
    webhook('Admin · Webhook', 'POST', 'hasadna-admin', [X, Y_A]),
    node('Admin · Handle', 'n8n-nodes-base.code', 2, {'jsCode': ADMIN}, [X + 240, Y_A]),
    respond('Admin · Respond', [X + 480, Y_A]),
]

main = [
    ('Lead · Webhook', 'Lead · Save', 0),
    ('Lead · Save', 'Lead · Respond', 0),
    ('Lead · Save', 'New lead?', 0),
    ('New lead?', 'Lead · Email', 0),
    ('Prices · Webhook', 'Prices · Read', 0),
    ('Prices · Read', 'Prices · Respond', 0),
    ('Admin · Webhook', 'Admin · Handle', 0),
    ('Admin · Handle', 'Admin · Respond', 0),
]
connections = {}
for a, b, out in main:
    outs = connections.setdefault(a, {}).setdefault('main', [])
    while len(outs) <= out:
        outs.append([])
    outs[out].append({'node': b, 'type': 'main', 'index': 0})

wf = {'name': 'הסדנה · לידים ומחירון', 'nodes': nodes, 'connections': connections,
      'active': False, 'settings': {'executionOrder': 'v1'}, 'pinData': {},
      'meta': {'templateCredsSetupCompleted': False}, 'tags': []}

names = [n['name'] for n in nodes]
assert len(names) == len(set(names)), 'duplicate node names'
for src, kinds in connections.items():
    assert src in names, src
    for lists in kinds.values():
        for lst in lists:
            for c in lst:
                assert c['node'] in names, c['node']

out = Path(__file__).with_name('hasadna-business.json')
out.write_text(json.dumps(wf, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('wrote', out, len(nodes), 'nodes')
