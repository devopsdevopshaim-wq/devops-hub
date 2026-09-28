#!/usr/bin/env python3
"""
Generate the n8n workflow JSON for a travel site built from the template.

The workflow has three webhook entry points:
  GET  /webhook/<prefix>        → serves the site. index.html is pulled live from GitHub,
                                   so the site in n8n is always in sync with the repo.
  POST /webhook/<prefix>-deal   → receives deals from the site's deal page and emails the agent
                                   (optional: Google Sheets log).
  POST /webhook/<prefix>-chat   → AI agent (Claude) that answers from api/knowledge.json.

Usage:
  python3 build-workflow.py --owner OWNER --repo REPO [--branch main] [--site-dir vacation-hub] \
      --brand "מסע" --email agent@example.com [--prefix masa] [--out workflow.json]
"""
import argparse, json, uuid

ap = argparse.ArgumentParser()
ap.add_argument('--owner', required=True)
ap.add_argument('--repo', required=True)
ap.add_argument('--branch', default='main')
ap.add_argument('--site-dir', default='vacation-hub')
ap.add_argument('--brand', default='מסע')
ap.add_argument('--email', required=True)
ap.add_argument('--prefix', default='masa')
ap.add_argument('--model', default='claude-sonnet-5')
ap.add_argument('--out', default='n8n/masa-vacation-agent.json')
a = ap.parse_args()

RAW = f'https://raw.githubusercontent.com/{a.owner}/{a.repo}/{a.branch}/{a.site_dir}/'
PAGES = f'https://{a.owner.lower()}.github.io/{a.repo}/'
P = a.prefix
nid = lambda: str(uuid.uuid4())
CORS = {'entries': [{'name': 'Access-Control-Allow-Origin', 'value': '*'}]}

nodes, conns = [], {}


def node(name, type_, ver, params, pos, **extra):
    n = {'parameters': params, 'id': nid(), 'name': name, 'type': type_, 'typeVersion': ver, 'position': pos}
    n.update(extra)
    nodes.append(n)
    return name


def link(src, dst, kind='main'):
    conns.setdefault(src, {}).setdefault(kind, [[]])[0].append({'node': dst, 'type': kind, 'index': 0})


def sticky(text, pos, w, h, color):
    node(f'Note {len(nodes)}', 'n8n-nodes-base.stickyNote', 1, {'content': text, 'width': w, 'height': h, 'color': color}, pos)


def webhook(name, method, path, pos):
    return node(name, 'n8n-nodes-base.webhook', 2,
                {'httpMethod': method, 'path': path, 'responseMode': 'responseNode', 'options': {}},
                pos, webhookId=nid())


# ───────────────────────── 1. Website ─────────────────────────
sticky(f'## 1 · האתר\nמגיש את האתר בכתובת `/webhook/{P}`.\nה-HTML נמשך בכל בקשה מ-GitHub (`{a.branch}`), כך שכל שינוי בריפו מופיע כאן מיד (עד ~5 דק׳ מטמון של GitHub).\nקבצי CSS/JS נטענים מ-GitHub Pages.',
       [-40, -420], 1060, 360, 5)
s1 = webhook('Site · Webhook', 'GET', P, [0, -260])
s2 = node('Site · Get index.html from GitHub', 'n8n-nodes-base.httpRequest', 4.2,
          {'url': RAW + 'index.html', 'options': {'response': {'response': {'responseFormat': 'text'}}}}, [240, -260])
s3 = node('Site · Point assets to Pages + connect n8n', 'n8n-nodes-base.code', 2, {'jsCode': f"""// Relative asset paths → GitHub Pages; tell the site where its n8n webhooks live.
const SITE = {json.dumps(PAGES)};
const hook = $('Site · Webhook').first().json;
const h = hook.headers || {{}};
let base = '';
if (hook.webhookUrl) base = hook.webhookUrl.replace(/\\/{P}\\/?$/, '');
if (!base && h.host) base = (String(h['x-forwarded-proto'] || 'https').split(',')[0]) + '://' + (h['x-forwarded-host'] || h.host) + '/webhook';
let html = String($input.first().json.data || '');
html = html.replace(/(href|src)="(css|js|vendor|api)\\//g, `$1="${{SITE}}$2/`);
const inject = `<script>window.APP_N8N = ${{JSON.stringify({{ base }})}};</script>`;
html = html.replace(/<head>/i, '<head>\\n' + inject);
return [{{ json: {{ html }} }}];"""}, [480, -260])
s4 = node('Site · Respond HTML', 'n8n-nodes-base.respondToWebhook', 1.1,
          {'respondWith': 'text', 'responseBody': '={{ $json.html }}',
           'options': {'responseHeaders': {'entries': [{'name': 'Content-Type', 'value': 'text/html; charset=utf-8'}, {'name': 'Cache-Control', 'value': 'no-cache'}]}}},
          [720, -260])
link(s1, s2); link(s2, s3); link(s3, s4)

# ───────────────────────── 2. Deals ─────────────────────────
sticky(f'## 2 · קבלת דילים\nדף "סגירת דיל" באתר שולח לכאן את הדיל (`/webhook/{P}-deal`).\n1. מפענח ובודק את הנתונים\n2. שולח מייל לסוכן — **חברו חשבון Gmail** בצומת המייל\n3. (אופציונלי) רושם שורה ב-Google Sheets — הפעילו את הצומת ובחרו גיליון\nאפשר להוסיף כאן: CRM, וואטסאפ עסקי, SMS, תזכורות.',
       [-40, 60], 1300, 380, 4)
d1 = webhook('Deal · Webhook', 'POST', f'{P}-deal', [0, 240])
d2 = node('Deal · Parse & format', 'n8n-nodes-base.code', 2, {'jsCode': """// Body arrives as text/plain JSON (avoids CORS preflight) or as an object.
const raw = $input.first().json.body;
let deal;
try { deal = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { deal = null; }
if (!deal || !deal.dealId) throw new Error('Invalid deal payload');
const ils = n => '₪' + Math.round(n || 0).toLocaleString('he-IL');
const c = deal.customer || {};
const rows = (deal.items || []).map(i => `<tr><td>${i.label}</td><td style="text-align:left">${ils(i.priceILS)}</td></tr>`).join('');
const html = `<div dir="rtl" style="font-family:Arial,sans-serif">
<h2>דיל חדש ${deal.dealId}</h2>
<p><b>${deal.destination?.name || ''}</b> (${deal.destination?.country || ''}) · ${deal.dates?.start} – ${deal.dates?.end} · ${deal.dates?.nights} לילות · ${deal.travelers} מטיילים</p>
<table cellpadding="6" style="border-collapse:collapse">${rows}<tr><td><b>סה״כ משוער</b></td><td style="text-align:left"><b>${ils(deal.totalILS)}</b></td></tr></table>
<p><b>לקוח:</b> ${c.name || '—'} · <a href="tel:${c.phone || ''}">${c.phone || '—'}</a></p>
${c.notes ? `<p><b>בקשות:</b> ${c.notes}</p>` : ''}
<p><a href="https://wa.me/${String(c.phone || '').replace(/\\D/g, '').replace(/^0/, '972')}">פתיחת וואטסאפ ללקוח</a></p>
</div>`;
return [{ json: {
  dealId: deal.dealId, createdAt: deal.createdAt || new Date().toISOString(),
  destination: deal.destination?.name || '', country: deal.destination?.country || '',
  start: deal.dates?.start || '', end: deal.dates?.end || '', nights: deal.dates?.nights || '',
  travelers: deal.travelers || '', totalILS: deal.totalILS || 0,
  customerName: c.name || '', customerPhone: c.phone || '', notes: c.notes || '',
  items: (deal.items || []).map(i => `${i.label}: ${ils(i.priceILS)}`).join(' | '),
  subject: `דיל חדש ${deal.dealId} · ${deal.destination?.name || ''} · ${c.name || ''}`,
  html
} }];"""}, [240, 240])
d3 = node('Deal · Email the agent (Gmail)', 'n8n-nodes-base.gmail', 2.1,
          {'sendTo': a.email, 'subject': '={{ $json.subject }}', 'message': '={{ $json.html }}', 'options': {'appendAttribution': False}},
          [480, 240], onError='continueRegularOutput')
d4 = node('Deal · Log to Google Sheets (optional)', 'n8n-nodes-base.googleSheets', 4.5,
          {'operation': 'append', 'documentId': {'__rl': True, 'mode': 'url', 'value': ''}, 'sheetName': {'__rl': True, 'mode': 'name', 'value': 'Deals'},
           'columns': {'mappingMode': 'autoMapInputData', 'value': {}, 'matchingColumns': [], 'schema': []}, 'options': {}},
          [720, 240], disabled=True, onError='continueRegularOutput')
d5 = node('Deal · Respond OK', 'n8n-nodes-base.respondToWebhook', 1.1,
          {'respondWith': 'json', 'responseBody': "={{ { ok: true, dealId: $('Deal · Parse & format').first().json.dealId } }}", 'options': {'responseHeaders': CORS}},
          [960, 240])
link(d1, d2); link(d2, d3); link(d3, d4); link(d4, d5)

# ───────────────────────── 3. AI agent ─────────────────────────
sticky(f'## 3 · הסוכן החכם (צ׳אט באתר)\nהצ׳אט באתר שולח לכאן הודעות (`/webhook/{P}-chat`).\nהידע נטען מ-`api/knowledge.json` באתר (נבנה אוטומטית מקבצי הנתונים).\n**חברו מפתח Anthropic** בצומת Claude.\nלהרחבה: חברו לסוכן כלים (Tools) — חיפוש טיסות, בדיקת זמינות מלון, יומן, CRM.',
       [-40, 520], 1300, 380, 6)
c1 = webhook('Chat · Webhook', 'POST', f'{P}-chat', [0, 720])
c2 = node('Chat · Load knowledge', 'n8n-nodes-base.httpRequest', 4.2, {'url': PAGES + 'api/knowledge.json', 'options': {}}, [240, 720])
c3 = node('Chat · Build context', 'n8n-nodes-base.code', 2, {'jsCode': f"""// Picks only the destinations the question is about, to keep the prompt small.
const K = $input.first().json;
const raw = $('Chat · Webhook').first().json.body;
let req; try {{ req = typeof raw === 'string' ? JSON.parse(raw) : raw; }} catch (e) {{ req = {{}}; }}
const message = String(req.message || '').slice(0, 2000);
const ctx = req.context || {{}};
const low = message.toLowerCase();
const hits = K.destinations.filter(d =>
  [d.name, d.nameEn, d.country].some(n => n && low.includes(String(n).toLowerCase())) || d.id === ctx.destination);
const index = K.destinations.map(d => `${{d.id}} · ${{d.name}} (${{d.country}}) · ${{d.tagline}} · טיסה ${{d.flight.hoursFromTLV}} ש׳ · עונה: ${{d.bestMonths.join(', ')}}`).join('\\n');
const today = new Date().toISOString().slice(0, 10);
const systemPrompt = `את/ה הסוכן/ת הדיגיטלי/ת של "${{K.brand}}" — אתר לתכנון חופשות בארץ ובחו״ל. היום ${{today}}.
ענו בעברית, בקצרה ובחום, כמו סוכן נסיעות מקצועי.
כללים:
- עובדות (מלונות, טלפונים, כתובות, מסעדות, מחירים) רק מתוך הידע למטה. אם אין — אמרו שאין לכם את המידע והציעו לפנות לסוכן.
- מחירים הם הערכות; אמרו זאת. אל תמציאו מחירים, טלפונים או זמינות.
- כדי להפנות לעמוד באתר השתמשו בקישור בפורמט [טקסט](#dest-ID.TAB). לשוניות: overview, gallery, flights, hotels, car, food, money, contacts, transit, routes, map, videos. עמודים: [סגירת דיל](#deal), [כל האתרים](#sites), [זמני שדה תעופה](#airport), [מחשבון עלויות](#budget).
- לסגירת דיל: הפנו ל-[סגירת דיל](#deal) או לסוכן: ${{K.agency.phone || ''}} ${{K.agency.email || ''}}.
- ${{K.disclaimer}}
תוכנית המשתמש באתר: ${{JSON.stringify(ctx.plan || {{}})}} · עמוד נוכחי: ${{ctx.page || ''}}

יעדים באתר:
${{index}}

ידע מפורט על היעדים הרלוונטיים:
${{hits.length ? JSON.stringify(hits.slice(0, 3)) : 'לא זוהה יעד ספציפי בשאלה — השתמשו ברשימת היעדים ושאלו לאיזה יעד הכוונה אם צריך.'}}`;
return [{{ json: {{ sessionId: String(req.sessionId || 'anon').slice(0, 80), message, systemPrompt }} }}];"""}, [480, 720])
c4 = node('AI Agent', '@n8n/n8n-nodes-langchain.agent', 1.7,
          {'promptType': 'define', 'text': '={{ $json.message }}', 'options': {'systemMessage': '={{ $json.systemPrompt }}'}},
          [720, 720], onError='continueRegularOutput')
c5 = node('Claude (Anthropic)', '@n8n/n8n-nodes-langchain.lmChatAnthropic', 1.3,
          {'model': {'__rl': True, 'mode': 'id', 'value': a.model}, 'options': {'maxTokensToSample': 800, 'temperature': 0.4}},
          [640, 940])
c6 = node('Chat memory', '@n8n/n8n-nodes-langchain.memoryBufferWindow', 1.3,
          {'sessionIdType': 'customKey', 'sessionKey': "={{ $('Chat · Build context').first().json.sessionId }}", 'contextWindowLength': 10},
          [800, 940])
c7 = node('Chat · Respond', 'n8n-nodes-base.respondToWebhook', 1.1,
          {'respondWith': 'json', 'responseBody': "={{ { reply: $json.output || 'מצטערים, לא הצלחתי לענות כרגע. אפשר לנסות שוב או לפנות לסוכן.' } }}", 'options': {'responseHeaders': CORS}},
          [1040, 720])
link(c1, c2); link(c2, c3); link(c3, c4); link(c4, c7)
link(c5, c4, 'ai_languageModel'); link(c6, c4, 'ai_memory')

wf = {
    'name': f'{a.brand} · אתר חופשות + סוכן',
    'nodes': nodes,
    'connections': conns,
    'active': False,
    'settings': {'executionOrder': 'v1'},
    'pinData': {},
    'meta': {'templateCredsSetupCompleted': False},
    'tags': []
}
with open(a.out, 'w', encoding='utf-8') as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)
print(f'Wrote {a.out}: {len(nodes)} nodes')
