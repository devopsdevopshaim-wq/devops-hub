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

# n8n keeps every execution's input and output. Codes, tokens, leads and audio must not stay there.
QUIET = {'executionOrder': 'v1', 'saveDataSuccessExecution': 'none', 'saveDataErrorExecution': 'none', 'saveManualExecutions': False, 'executionTimeout': 60}
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


SNIP = Path(__file__).with_name('snippets')
SEC = (SNIP / 'security.js').read_text(encoding='utf-8')
SITE_ORIGIN = 'https://devopsdevopshaim-wq.github.io'
HANDLE = (SNIP / 'access-handle.js').read_text(encoding='utf-8') \
    .replace('__SEC__', SEC).replace('__ADMIN_EMAIL__', ADMIN_EMAIL).replace('__RENEW__', RENEW)

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
if ($json.error) {
  // a security alert or an initial password that could not be sent must never block the answer itself
  if (h.mail && (h.mail.alert || h.mail.soft)) return [{ json: { code: h.code, body: h.body } }];
  return [{ json: { code: 502, body: { ok: false, error: 'mail-failed' } } }];
}
return [{ json: { code: h.code, body: h.body } }];
"""

X = 0
nodes = [
    node('Note · Access', 'n8n-nodes-base.stickyNote', 1, {'content':
        '## כניסה והרשאות\n`POST /webhook/hasadna-auth` — האתר שולח לכאן בקשות כניסה. '
        'הקוד החד־פעמי נשלח במייל מצומת **Send · Email** (SMTP של Gmail, סיסמת אפליקציה; ההתקנה מ־GitHub מחברת אותו לבד).\n\n'
        'המנהל מוגדר בראש הצומת **Auth · Handle** (ADMIN_EMAIL, ADMIN_PHONE). '
        'כניסה: מנהל = מייל + סיסמה (ADMIN_PASSWORD בסוד SPIDER, נשמר כ־hash) מכל מקום. לקוח = מייל + הסיסמה שהמנהל נתן לו, ממכשיר שאושר. '
        'מכשיר ראשון מאושר לבד, כל מכשיר חדש מחכה למנהל; כתובת IP נרשמת ליד כל מכשיר, ואפשר לנעול לקוח לכתובות מאושרות. '
        'אבטחה: רק האתר עצמו (Origin), הגבלת קצב, נעילה אחרי ניסיונות כושלים, טוקנים נשמרים כ־hash, מנהל נכנס ל־12 שעות בלבד, '
        'ואם הוגדר ADMIN_TOTP_SECRET המנהל צריך גם קוד מאפליקציית אימות. מפתחות Morning נכנסים מההתקנה (MORNING_CLIENT_ID/SECRET). '
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
                          {'name': 'Access-Control-Allow-Origin', 'value': SITE_ORIGIN},
                          {'name': 'Vary', 'value': 'Origin'},
                          {'name': 'X-Content-Type-Options', 'value': 'nosniff'},
                          {'name': 'Referrer-Policy', 'value': 'no-referrer'},
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
      'active': False, 'settings': QUIET, 'pinData': {},
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
