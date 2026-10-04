#!/usr/bin/env python3
"""Builds n8n/hasadna-business.json: leads and the price list for the services page.

Three webhooks, everything kept in the workflow's own memory (static data), so
there is nothing to connect before it works:
  POST /webhook/hasadna-lead    the services page sends every lead (and WhatsApp clicks) here
  GET  /webhook/hasadna-prices  the services page reads the prices and offers set by the admin
  POST /webhook/hasadna-admin   the admin screen: list leads, change status, edit prices.
                                Needs the admin password, chosen once from the admin screen.
Every new lead is also emailed through the SPIDER · Gmail SMTP connection.

    python3 n8n/build-business-workflow.py
"""
import json
import uuid
from pathlib import Path

# n8n keeps every execution's input and output. Codes, tokens, leads and audio must not stay there.
QUIET = {'executionOrder': 'v1', 'saveDataSuccessExecution': 'none', 'saveDataErrorExecution': 'none', 'saveManualExecutions': False, 'executionTimeout': 60}
NS = 'hasadna-business/'
SITE_ORIGIN = 'https://devopsdevopshaim-wq.github.io'
SNIP = Path(__file__).with_name('snippets')
SEC = (SNIP / 'security.js').read_text(encoding='utf-8')
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
                                 {'name': 'Access-Control-Allow-Origin', 'value': SITE_ORIGIN},
                                 {'name': 'Vary', 'value': 'Origin'},
                                 {'name': 'X-Content-Type-Options', 'value': 'nosniff'},
                                 {'name': 'Referrer-Policy', 'value': 'no-referrer'},
                                 {'name': 'Cache-Control', 'value': 'no-store'}]}}},
                pos)


SAVE_LEAD = r"""// Saves a lead from the services page (or counts a WhatsApp click).
__SEC__

const sd = $getWorkflowStaticData('global');
const now = Date.now();
const HOUR = 3600000, DAY = 86400000;
sd.leads = sd.leads || [];
sd.clicks = sd.clicks || {};
sweep();
const b = $json.body || {};
const hold = (code, error) => [{ json: { code, body: { ok: false, error }, notify: false } }];
if (!ORIGIN_OK) return hold(403, 'forbidden');
if (JSON.stringify(b).length > 6000) return hold(413, 'too-big');
const line = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, n);
const text = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ').trim().slice(0, n);

if (b.kind === 'click') {
  if (!hit('click', ipKey(), 60, HOUR)) return hold(429, 'rate-limited');
  let k = line(b.source, 40) || 'other';
  if (!(k in sd.clicks) && Object.keys(sd.clicks).length >= 30) k = 'other';   // the list of sources cannot grow without end
  sd.clicks[k] = (sd.clicks[k] || 0) + 1;
  return [{ json: { code: 200, body: { ok: true }, notify: false } }];
}
// a few leads an hour per address and a daily cap, so the inbox and the email cannot be flooded
if (!hit('lead-ip', ipKey(), 5, HOUR) || !hit('lead-all', 'all', 150, DAY)) return hold(429, 'rate-limited');
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
__SEC__

const sd = $getWorkflowStaticData('global');
const now = Date.now();
if (!ORIGIN_OK) return [{ json: { code: 403, body: { ok: false, error: 'forbidden' } } }];
if (!hit('prices', ipKey(), 120, 600000)) return [{ json: { code: 429, body: { ok: false, error: 'rate-limited' } } }];
return [{ json: { code: 200, body: { ok: true, prices: sd.prices || null } } }];
"""

ADMIN = (SNIP / 'business-admin-handle.js').read_text(encoding='utf-8')

X, Y_L, Y_P, Y_A = 0, 0, 420, 760
nodes = [
    note('Note · Leads',
         '## לידים\n`POST /webhook/hasadna-lead` — כל טופס בדף השירותים נשמר כאן (גם לחיצות על וואטסאפ נספרות). '
         'רואים ומנהלים את הלידים במסך הניהול של האתר ← "לידים ומחירון".\n\n'
         'כל ליד חדש נשלח גם במייל (צומת "Lead · Email", חיבור SPIDER · Gmail).',
         [X - 480, Y_L - 200], h=240, color=6),
    webhook('Lead · Webhook', 'POST', 'hasadna-lead', [X, Y_L]),
    node('Lead · Save', 'n8n-nodes-base.code', 2, {'jsCode': SAVE_LEAD.replace('__SEC__', SEC)}, [X + 240, Y_L]),
    respond('Lead · Respond', [X + 480, Y_L - 80]),
    node('New lead?', 'n8n-nodes-base.if', 2.2,
         {'conditions': {'options': {'caseSensitive': True, 'typeValidation': 'loose', 'version': 2},
                         'conditions': [{'id': uid('if-notify'), 'leftValue': '={{ $json.notify }}', 'rightValue': True,
                                         'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}],
                         'combinator': 'and'}, 'options': {}},
         [X + 480, Y_L + 100]),
    node('Lead · Email', 'n8n-nodes-base.emailSend', 2.1,
         {'fromEmail': 'SPIDER · לידים <' + EMAIL + '>', 'toEmail': EMAIL,
          'subject': "={{ 'ליד חדש: ' + $json.lead.name + ($json.lead.service ? ' · ' + $json.lead.service : '') }}",
          'emailFormat': 'text',
          'text': "={{ 'שם: ' + $json.lead.name + '\\nטלפון: ' + $json.lead.phone + '\\nעסק: ' + $json.lead.biz + '\\nשירות: ' + $json.lead.service + ($json.lead.code ? '\\nמבצע: ' + $json.lead.code : '') + '\\n\\n' + $json.lead.msg + '\\n\\nוואטסאפ: https://wa.me/' + String($json.lead.phone).replace(/\\D/g, '').replace(/^0/, '972') }}",
          'options': {'appendAttribution': False}},
         [X + 720, Y_L + 100], onError='continueRegularOutput'),

    note('Note · Prices',
         '## מחירון\n`GET /webhook/hasadna-prices` — דף השירותים קורא מכאן את המחירים והמבצעים שקבעת במסך הניהול. '
         'כל עוד לא שמרת כלום, הדף משתמש במחירים שבקובץ services.json.',
         [X - 480, Y_P - 170], h=200, color=5),
    webhook('Prices · Webhook', 'GET', 'hasadna-prices', [X, Y_P]),
    node('Prices · Read', 'n8n-nodes-base.code', 2, {'jsCode': PRICES.replace('__SEC__', SEC)}, [X + 240, Y_P]),
    respond('Prices · Respond', [X + 480, Y_P]),

    note('Note · Admin',
         '## ניהול\n`POST /webhook/hasadna-admin` — מסך הניהול של האתר משתמש בזה: רשימת לידים, שינוי סטטוס והערות, ושמירת מחירון. '
         'אין יותר סיסמה נפרדת: כל בקשה נבדקת מול הכניסה הראשית (hasadna-auth), ורק מנהל שנכנס עם קוד (ואימות דו־שלבי, אם הופעל) מורשה.',
         [X - 480, Y_A - 190], h=230, color=3),
    webhook('Admin · Webhook', 'POST', 'hasadna-admin', [X, Y_A]),
    node('Admin · Handle', 'n8n-nodes-base.code', 2, {'jsCode': ADMIN.replace('__SEC__', SEC)}, [X + 240, Y_A]),
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

wf = {'name': 'SPIDER · לידים ומחירון', 'nodes': nodes, 'connections': connections,
      'active': False, 'settings': QUIET, 'pinData': {},
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
