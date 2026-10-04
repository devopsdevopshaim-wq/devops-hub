#!/usr/bin/env python3
"""Builds n8n/hasadna-parkomat.json: Parkomat's robotic-parking agents for n8n Cloud.

The cloud successor of the local Parkomat n8n (localhost:5679/webhook/parking-agents).
The robotic-parking site (פארק־פלאן) sends a questionnaire — developer, technical or a free
question — together with the current planner configuration and its own instant recommendation.
A coordinator agent consults three specialists and answers in Hebrew. When the questionnaire
carries contact details, the owner gets the lead by email.

    POST /webhook/parkomat-agents   JSON {kind, answers, config, local, question, contact, sessionId}
                                    -> {answer, kind}

    python3 n8n/build-parkomat-workflow.py [--model ...] [--email ...]
"""
import argparse
import json
import uuid
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument('--model', default='claude-opus-5-5')
ap.add_argument('--email', default='devopsdevopshaim@gmail.com')
args = ap.parse_args()
NS = 'hasadna-parkomat/'


def uid(name):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, NS + name))


def node(name, type_, version, params, pos, **extra):
    n = {'parameters': params, 'id': uid(name), 'name': name, 'type': type_, 'typeVersion': version, 'position': pos}
    n.update(extra)
    return n


def note(name, text, pos, w=440, h=260, color=4):
    return node(name, 'n8n-nodes-base.stickyNote', 1, {'content': text, 'height': h, 'width': w, 'color': color}, pos)


def claude(name, pos, max_tokens):
    return node(name, '@n8n/n8n-nodes-langchain.lmChatAnthropic', 1.3,
                {'model': {'__rl': True, 'mode': 'id', 'value': args.model},
                 'options': {'maxTokensToSample': max_tokens}}, pos)


DOMAIN = (
    'תחום: חניונים רובוטיים (אוטומטיים). מערכת טיפוסית: לובי כניסה עם בדיקות מידות, גובה וסריקת אנשים; מגש לכל רכב; '
    'מעלית אחת או שתיים; שאטל בכל קומה שנוסע בשביל ומעביר מגשים לתאים משני צדדיו; מסובבת בלובי כדי שהרכב ייצא קדימה. '
    'בקרה: Siemens S7-1500F, ET 200SP, דרייברי SINAMICS G120, PROFINET ו-PROFIsafe. בטיחות: EN 14010, EN ISO 13849-1, '
    'EN 60204-1, ולמעלית EN 81-20. חיישני גלישה לאורך השביל, חיישן ישיבת מגש בכל תא. '
    'הכלי "פארק־פלאן" (https://devopsdevopshaim-wq.github.io/devops-hub/robotic-parking/) מחשב מהתצורה: מנועים, ארונות, '
    'חיווט, IP, פרמטרים, תוכנת PLC, שרטוטים, הדמיה וזמני מחזור.')
RULES = (
    'כללים: עונים בעברית, ענייני ומדויק. לא ממציאים מחירים, ספקים, אישורים או נתונים שלא הופיעו; כשצריך מחיר אומרים '
    'שהוא נקבע אחרי אפיון ושאלה מה משפיע עליו. מבחינים בין הערכה לבין עובדה. כל תכנון הוא ראשוני ודורש אישור מהנדס '
    'חשמל ובודק בטיחות.')

COORD = (DOMAIN + '\\n' + RULES + '\\n'
         'אתה המתאם של סוכני Parkomat. מקבל שאלון מלקוח (יזם, מהנדס או שאלה חופשית), את התצורה הנוכחית מהמתכנן '
         'ואת ההמלצה המיידית שהאתר חישב. היוועץ במומחים הרלוונטיים (לפחות אחד), ואז כתוב תשובה אחת במבנה הזה, עם כותרות '
         'קצרות: ## בשורה התחתונה (2–3 משפטים) · ## התאמה למגרש ולצורך · ## התצורה המומלצת (קומות, תאים, מעליות, '
         'זמן שליפה, ולמה) · ## סיכונים ודברים לבדוק · ## שאלות שחסרות לנו · ## הצעדים הבאים. '
         'אם ההמלצה המיידית של האתר נראית לך שגויה, אמור למה ומה היית משנה.')

TEAM = [
    ('planning', 'סוכן תכנון וקיבולת',
     'מומחה למבנה החניון: מידות מגרש, מספר מקומות, קומות, תאים, מעליות, זמני שליפה ותפוקה בשעות שיא, רכבים גבוהים ו-SUV, '
     'חניון עילי או תת-קרקעי. השתמש בו לכל שאלה על קיבולת, תצורה וזמנים.',
     'חשב והסבר: כמה תאים נכנסים במגרש (פסיעת תא כ-2.7 מטר, עומק תא כ-5.7 מטר, שביל כ-3.2 מטר), כמה קומות צריך, '
     'כמה מעליות לפי תנועות בשעת שיא (מעלית אחת נותנת בערך 40–50 תנועות בשעה בתצורה בינונית), ואיך גובה הרכבים משפיע על גובה קומה.'),
    ('control', 'סוכן חשמל, בקרה ובטיחות',
     'מומחה לחשמל ובקרה: הזנה וצריכת הספק, ארונות פיקוד, דרייברים, PLC, רשת, חיישנים, בטיחות ותקנים, כיבוי אש ואוורור, טעינת רכב חשמלי.',
     'הסבר הספק מותקן משוער, חיבור חשמל נדרש, ארונות, תקנים רלוונטיים ובדיקות שיידרשו. ציין מה חייב אישור של מהנדס ובודק.'),
    ('business', 'סוכן יזמות ורישוי',
     'מומחה לצד העסקי: יתרונות ליזם, חיסכון בשטח לעומת חניון רמפות, לוחות זמנים, היתרים ורישוי, תחזוקה ושירות, מודל הפעלה.',
     'הסבר בצורה שיזם מבין: מה מרוויחים, מה הסיכונים, מה צריך להכין לוועדה ולמתכנן, ומה השלב הבא. בלי להמציא מחירים.'),
]

NORMALIZE = r"""
const raw = $json.body || $json || {};
let b = raw;
if (typeof raw === 'string') { try { b = JSON.parse(raw); } catch { b = { question: raw }; } }
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
const kinds = { developer: 'שאלון יזם', technical: 'שאלון טכני', question: 'שאלה חופשית' };
const kind = kinds[b.kind] ? b.kind : 'question';
const lines = (o) => Object.entries(o || {}).filter(([, v]) => v !== '' && v != null).slice(0, 40)
  .map(([k, v]) => `- ${clip(k, 60)}: ${clip(typeof v === 'object' ? JSON.stringify(v) : v, 300)}`).join('\n');
const contact = b.contact || {};
const hasContact = !!(contact.email || contact.phone);
const prompt = [
  `סוג: ${kinds[kind]}`,
  b.answers && Object.keys(b.answers).length ? `תשובות הלקוח:\n${lines(b.answers)}` : '',
  b.config ? `התצורה הנוכחית במתכנן:\n${lines(b.config)}` : '',
  b.local ? `ההמלצה המיידית שהאתר חישב:\n${lines(b.local)}` : '',
  b.question ? `שאלה:\n${clip(b.question, 2000)}` : ''
].filter(Boolean).join('\n\n').slice(0, 9000);
const mail = hasContact ? {
  to: '__ADMIN_EMAIL__',
  subject: `Parkomat · ${kinds[kind]} · ${clip(contact.name || contact.company || 'פנייה חדשה', 60)}`,
  text: `פנייה חדשה מאתר פארק־פלאן\n\nשם: ${clip(contact.name, 80)}\nחברה: ${clip(contact.company, 80)}\nטלפון: ${clip(contact.phone, 40)}\nמייל: ${clip(contact.email, 120)}\n\n${prompt}`
} : null;
return [{ json: { kind, prompt, mail, sessionId: clip(b.sessionId || 'parkomat-' + Date.now(), 80) } }];
""".replace('__ADMIN_EMAIL__', args.email)

SHAPE = r"""
const n = $('Parkomat · Normalize').first().json;
const out = ($json.output || $json.text || '').toString().trim();
return [{ json: { answer: out || 'הסוכנים לא החזירו תשובה כרגע. נסו שוב בעוד דקה.', kind: n.kind, mail: n.mail } }];
"""

X, Y = 0, 0
nodes = [
    note('Note · Parkomat',
         '## Parkomat · סוכני חניון רובוטי\nהגרסה בענן של ה-n8n המקומי של Parkomat (`parking-agents`).\n\n'
         'האתר פארק־פלאן שולח לכאן שאלון (יזם / טכני / שאלה חופשית) עם התצורה מהמתכנן וההמלצה המיידית שלו. '
         'המתאם שואל את המומחים ומחזיר תשובה אחת. שאלון עם פרטי קשר נשלח גם במייל כליד.',
         [X - 480, Y - 280], h=280, color=5),
    node('Parkomat · Webhook', 'n8n-nodes-base.webhook', 2,
         {'httpMethod': 'POST', 'path': 'parkomat-agents', 'responseMode': 'responseNode', 'options': {}},
         [X, Y], webhookId=uid('webhook')),
    node('Parkomat · Normalize', 'n8n-nodes-base.code', 2, {'jsCode': NORMALIZE}, [X + 220, Y]),
    node('Parkomat · מתאם', '@n8n/n8n-nodes-langchain.agent', 2.2,
         {'promptType': 'define', 'text': '={{ $json.prompt }}',
          'options': {'systemMessage': "={{ '" + COORD + "' }}", 'maxIterations': 6}},
         [X + 480, Y], onError='continueRegularOutput'),
    claude('Claude · מתאם', [X + 380, Y + 240], 2200),
    node('Memory · שיחה', '@n8n/n8n-nodes-langchain.memoryBufferWindow', 1.3,
         {'sessionIdType': 'customKey', 'sessionKey': "={{ $('Parkomat · Normalize').first().json.sessionId }}",
          'contextWindowLength': 6}, [X + 540, Y + 240]),
    node('Parkomat · Shape', 'n8n-nodes-base.code', 2, {'jsCode': SHAPE}, [X + 900, Y]),
    node('Parkomat · Respond', 'n8n-nodes-base.respondToWebhook', 1.1,
         {'respondWith': 'json', 'responseBody': '={{ { answer: $json.answer, kind: $json.kind } }}',
          'options': {'responseHeaders': {'entries': [
              {'name': 'Access-Control-Allow-Origin', 'value': '*'},
              {'name': 'Cache-Control', 'value': 'no-store'}]}}},
         [X + 1140, Y - 100]),
    node('Lead to email?', 'n8n-nodes-base.if', 2.2,
         {'conditions': {'options': {'caseSensitive': True, 'typeValidation': 'loose', 'version': 2},
                         'conditions': [{'id': uid('if-mail'), 'leftValue': '={{ !!$json.mail }}', 'rightValue': True,
                                         'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}],
                         'combinator': 'and'}, 'options': {}},
         [X + 1140, Y + 120]),
    node('Lead · Email', 'n8n-nodes-base.emailSend', 2.1,
         {'fromEmail': 'Parkomat · פארק־פלאן <' + args.email + '>', 'toEmail': '={{ $json.mail.to }}',
          'subject': '={{ $json.mail.subject }}', 'emailFormat': 'text',
          'text': "={{ $json.mail.text + '\\n\\n— תשובת הסוכנים —\\n' + $json.answer }}",
          'options': {'appendAttribution': False}},
         [X + 1380, Y + 100], onError='continueRegularOutput'),
]
for i, (key, name, desc, how) in enumerate(TEAM):
    x, y = X + 700 + i * 240, Y + 420
    system = "={{ '" + DOMAIN + '\\n' + RULES + '\\nאתה ' + name + ' של Parkomat. ' + how + "' }}"
    nodes.append(node(name, '@n8n/n8n-nodes-langchain.agentTool', 2.2,
                      {'toolDescription': desc,
                       'text': "={{ $fromAI('Prompt__User_Message_', 'השאלה המלאה בעברית, כולל הנתונים הרלוונטיים מהשאלון', 'string') }}",
                       'options': {'systemMessage': system, 'maxIterations': 3}}, [x, y]))
    nodes.append(claude(f'Claude · {name}', [x, y + 220], 1400))

main = [('Parkomat · Webhook', 'Parkomat · Normalize'), ('Parkomat · Normalize', 'Parkomat · מתאם'),
        ('Parkomat · מתאם', 'Parkomat · Shape'), ('Parkomat · Shape', 'Parkomat · Respond'),
        ('Parkomat · Shape', 'Lead to email?'), ('Lead to email?', 'Lead · Email')]
connections = {}
for a, b in main:
    connections.setdefault(a, {}).setdefault('main', [[]])[0].append({'node': b, 'type': 'main', 'index': 0})


def ai(src, dst, kind):
    connections.setdefault(src, {}).setdefault(kind, [[]])[0].append({'node': dst, 'type': kind, 'index': 0})


ai('Claude · מתאם', 'Parkomat · מתאם', 'ai_languageModel')
ai('Memory · שיחה', 'Parkomat · מתאם', 'ai_memory')
for _, name, _, _ in TEAM:
    ai(name, 'Parkomat · מתאם', 'ai_tool')
    ai(f'Claude · {name}', name, 'ai_languageModel')

wf = {'name': 'SPIDER · Parkomat – סוכני חניון רובוטי', 'nodes': nodes, 'connections': connections,
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
out = Path(__file__).with_name('hasadna-parkomat.json')
out.write_text(json.dumps(wf, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('wrote', out, len(nodes), 'nodes')
