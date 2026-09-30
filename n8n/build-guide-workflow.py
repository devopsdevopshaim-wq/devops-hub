#!/usr/bin/env python3
"""Builds n8n/hasadna-guide-agent.json: the n8n Cloud workflow behind Guy,
the talking guide of the portfolio (devops-hub/portfolio).

Flow: Webhook -> load knowledge.json -> pick the relevant projects -> AI Agent
(Claude + conversation memory) -> shape the answer -> respond to the site.

    python3 n8n/build-guide-workflow.py [--owner devopsdevopshaim-wq] [--repo devops-hub]
"""
import argparse
import json
import uuid
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument('--owner', default='devopsdevopshaim-wq')
ap.add_argument('--repo', default='devops-hub')
ap.add_argument('--model', default='claude-opus-5-5')
ap.add_argument('--path', default='hasadna-guide', help='webhook path')
args = ap.parse_args()

SITE = f'https://{args.owner}.github.io/{args.repo}/portfolio/'

BUILD_CONTEXT = r"""// Picks the projects the question is about and builds Guy's instructions.
const K = $('Guide · Load knowledge').first().json;
const raw = $('Guide · Webhook').first().json.body;
let req; try { req = typeof raw === 'string' ? JSON.parse(raw) : (raw || {}); } catch (e) { req = {}; }
const question = String(req.question || '').slice(0, 1500).trim() || 'שלום';
const page = String(req.page || '');
const sessionId = String(req.sessionId || 'anon').replace(/[^\w-]/g, '').slice(0, 64) || 'anon';

const norm = s => String(s || '').toLowerCase().replace(/[׳"'״`]/g, '');
// Hebrew glues ה/ו/ב/ל/מ/ש/כ to the front of words ("המחסן" → "מחסן").
const STOP = new Set(['מערכת', 'מערכות', 'פרויקט', 'פרויקטים', 'האתר', 'אתר', 'אתרים', 'תסביר', 'ספר', 'איך', 'מה', 'ההבדל', 'הבדל', 'עובד', 'עובדת', 'שלוש', 'שלושת', 'הזה', 'הזאת']);
const words = [];
for (const w of norm(question).split(/[^\p{L}\p{N}]+/u)) {
  if (w.length < 3 || STOP.has(w)) continue;
  words.push(w);
  if (w.length >= 4 && 'הובלמשכ'.includes(w[0]) && !STOP.has(w.slice(1))) words.push(w.slice(1));
}
const text = p => norm([p.field, p.desc, (p.tech || []).join(' '), (p.features || []).join(' '),
  p.code ? p.code.automation.join(' ') + ' ' + p.code.libraries.join(' ') + ' ' + p.code.screens.join(' ') : ''].join(' '));
const ranked = K.projects
  .map(p => {
    const t = norm(p.title + ' ' + p.id), h = text(p);
    let s = 0;
    for (const w of words) s += t.includes(w) ? 3 : h.includes(w) ? 1 : 0;
    if (p.id === page) s += 10;
    return { p, s };
  })
  .filter(x => x.s > 0).sort((a, b) => b.s - a.s);

// Automation questions pull in the projects with the most automation.
const automationQ = /אוטומצ|automat|n8n|ci\/?cd|docker|pipeline|webhook|actions|פריס|deploy|שרת|מתעדכן|תהליך|תזמון|סקריפט|ענן/i.test(question);
let focus = ranked.slice(0, 4).map(x => x.p);
if (automationQ) {
  const auto = K.projects.filter(p => p.code && p.code.automation.length >= 2 && !focus.includes(p))
    .sort((a, b) => b.code.automation.length - a.code.automation.length);
  focus = focus.concat(auto.slice(0, Math.max(0, 6 - focus.length)));
}

const index = K.projects.map(p => `${p.id} · ${p.title} · ${p.field} · ${p.desc || ''}`).join('\n');
const details = focus.map(p => JSON.stringify(p)).join('\n');

const systemPrompt = `אתה גיא, המדריך של "הסדנה" — אתר שמציג את כל הפרויקטים של מפתח אחד (DevOps, AI ו־Web).
התשובות שלך מוקראות בקול באתר, אז כתוב עברית מדוברת, חמה וברורה, בלי Markdown, בלי רשימות ובלי אימוג'י.

איך לענות:
- שאלה פשוטה (מה זה, איפה, כמה): 1–3 משפטים.
- שאלה מעמיקה (איך זה עובד, למה, מה ההבדל, אוטומציה, ארכיטקטורה, פריסה): 4–8 משפטים עם פרטים קונקרטיים מהידע — קבצים, ספריות, מסכים, פעולות, אוטומציות, ואיך החלקים מתחברים. אם הפרט נלקח מניתוח הקוד, אפשר לומר "לפי הקוד".
- כשמשווים פרויקטים או גרסאות, הסבר מה שונה ביניהם בפועל.
- בשאלות על אוטומציה: הסבר את התהליך צעד אחר צעד (מה מפעיל אותו, מה קורה, מה יוצא), והצע איך אפשר להרחיב אותו (למשל n8n, GitHub Actions, Docker, תזמון, Webhook).
- אל תמציא. אם משהו לא מופיע בידע, אמור שאין לך את המידע והצע לפתוח את הפרויקט או את הקוד שלו.
- שאלה שלא קשורה לפרויקטים: ענה במשפט שאתה כאן כדי להראות את הפרויקטים, והצע פרויקט מתאים.

בסוף התשובה, בשורות נפרדות:
PROJECT: <id>   ← רק אם התשובה עוסקת בעיקר בפרויקט אחד
NEXT: <שאלת המשך מעמיקה אחת בעברית שהמבקר יכול לשאול>   ← תמיד, עד שתיים

איך האתר עצמו עובד (אוטומציה):
${K.pipeline.map(s => '- ' + s).join('\n')}

כל הפרויקטים (id · שם · תחום · תיאור):
${index}

פרטים מלאים על הפרויקטים הרלוונטיים לשאלה (כולל ניתוח קוד):
${details || '(אין פרויקט ספציפי — ענה מהרשימה הכללית)'}
${page ? '\nהמבקר נמצא עכשיו בעמוד של הפרויקט: ' + page : ''}`;

return [{ json: { question, sessionId, systemPrompt } }];
"""

SHAPE_ANSWER = r"""// Splits the agent's text into the answer, the project to highlight and follow-up questions.
const out = String($json.output || '').trim();
const next = [];
let project = null;
let answer = out
  .replace(/^\s*NEXT:\s*(.+)$/gim, (m, q) => { next.push(q.trim()); return ''; })
  .replace(/^\s*PROJECT:\s*([\w-]+)\s*$/gim, (m, id) => { project = id; return ''; })
  .replace(/[*#_`]+/g, '')
  .trim();
if (!answer) answer = 'לא הצלחתי לענות כרגע. אפשר לנסות שוב בעוד רגע, או לשאול על פרויקט מסוים.';
return [{ json: { answer, project, next: next.slice(0, 2), question: $('Guide · Build context').first().json.question, at: new Date().toISOString() } }];
"""


def node(name, type_, version, params, pos, **extra):
    n = {'parameters': params, 'id': str(uuid.uuid5(uuid.NAMESPACE_URL, 'hasadna-guide/' + name)),
         'name': name, 'type': type_, 'typeVersion': version, 'position': pos}
    n.update(extra)
    return n


def note(name, text, pos, w=460, h=300, color=4):
    return node(name, 'n8n-nodes-base.stickyNote', 1,
                {'content': text, 'height': h, 'width': w, 'color': color}, pos)


nodes = [
    note('Note · What this is',
         '## גיא · סוכן הפרויקטים של הסדנה\n'
         'האתר שולח לכאן כל שאלה שמבקר שואל את גיא. הסוכן טוען את קובץ הידע '
         '(`knowledge.json`, נבנה אוטומטית מהקוד של כל הפרויקטים), בוחר את הפרויקטים '
         'הרלוונטיים, ועונה עם Claude — כולל שאלות מעמיקות על אוטומציה.\n\n'
         '**הפעלה:** 1. פתחו את Claude (Anthropic) ← Credential ← API key. '
         '2. Active למעלה. 3. העתיקו את ה־Production URL של ה־Webhook לשדה `guideApi` בקובץ '
         '`portfolio/projects.json`.',
         [-320, -60], w=520, h=320, color=5),
    node('Guide · Webhook', 'n8n-nodes-base.webhook', 2,
         {'httpMethod': 'POST', 'path': args.path, 'responseMode': 'responseNode', 'options': {}},
         [240, 300], webhookId=str(uuid.uuid5(uuid.NAMESPACE_URL, 'hasadna-guide/webhook'))),
    node('Guide · Load knowledge', 'n8n-nodes-base.httpRequest', 4.2,
         {'url': SITE + 'knowledge.json', 'options': {'timeout': 15000}},
         [460, 300]),
    node('Guide · Build context', 'n8n-nodes-base.code', 2,
         {'jsCode': BUILD_CONTEXT}, [680, 300]),
    node('AI Agent', '@n8n/n8n-nodes-langchain.agent', 1.7,
         {'promptType': 'define', 'text': '={{ $json.question }}',
          'options': {'systemMessage': '={{ $json.systemPrompt }}', 'maxIterations': 4}},
         [900, 300], onError='continueRegularOutput'),
    node('Claude (Anthropic)', '@n8n/n8n-nodes-langchain.lmChatAnthropic', 1.3,
         {'model': {'__rl': True, 'mode': 'id', 'value': args.model},
          'options': {'maxTokensToSample': 1500}},
         [820, 520]),
    node('Conversation memory', '@n8n/n8n-nodes-langchain.memoryBufferWindow', 1.3,
         {'sessionIdType': 'customKey',
          'sessionKey': "={{ $('Guide · Build context').first().json.sessionId }}",
          'contextWindowLength': 8},
         [1000, 520]),
    node('Guide · Shape answer', 'n8n-nodes-base.code', 2,
         {'jsCode': SHAPE_ANSWER}, [1180, 300]),
    node('Guide · Respond', 'n8n-nodes-base.respondToWebhook', 1.1,
         {'respondWith': 'json',
          'responseBody': '={{ { answer: $json.answer, project: $json.project, next: $json.next } }}',
          'options': {'responseHeaders': {'entries': [{'name': 'Access-Control-Allow-Origin', 'value': '*'}]}}},
         [1400, 220]),
    node('Guide · Log question (Google Sheets, optional)', 'n8n-nodes-base.googleSheets', 4.5,
         {'operation': 'append',
          'documentId': {'__rl': True, 'mode': 'url', 'value': ''},
          'sheetName': {'__rl': True, 'mode': 'name', 'value': 'Questions'},
          'columns': {'mappingMode': 'defineBelow', 'value': {
              'time': '={{ $json.at }}', 'question': '={{ $json.question }}',
              'answer': '={{ $json.answer }}', 'project': '={{ $json.project }}'},
              'schema': [{'id': c, 'displayName': c, 'type': 'string', 'display': True, 'canBeUsedToMatch': True}
                         for c in ('time', 'question', 'answer', 'project')]},
          'options': {}},
         [1400, 420], disabled=True),
    note('Note · Log',
         '### אופציונלי: יומן שאלות\nמחברים Google Sheets, מדביקים קישור לגיליון עם לשונית `Questions` '
         '(עמודות time, question, answer, project), ומפעילים את הצומת (מקש D). '
         'כך רואים אילו שאלות מבקרים שואלים ואיפה כדאי להעמיק.',
         [1320, 560], w=340, h=200, color=7),
]

connections = {
    'Guide · Webhook': {'main': [[{'node': 'Guide · Load knowledge', 'type': 'main', 'index': 0}]]},
    'Guide · Load knowledge': {'main': [[{'node': 'Guide · Build context', 'type': 'main', 'index': 0}]]},
    'Guide · Build context': {'main': [[{'node': 'AI Agent', 'type': 'main', 'index': 0}]]},
    'AI Agent': {'main': [[{'node': 'Guide · Shape answer', 'type': 'main', 'index': 0}]]},
    'Guide · Shape answer': {'main': [[
        {'node': 'Guide · Respond', 'type': 'main', 'index': 0},
        {'node': 'Guide · Log question (Google Sheets, optional)', 'type': 'main', 'index': 0}]]},
    'Claude (Anthropic)': {'ai_languageModel': [[{'node': 'AI Agent', 'type': 'ai_languageModel', 'index': 0}]]},
    'Conversation memory': {'ai_memory': [[{'node': 'AI Agent', 'type': 'ai_memory', 'index': 0}]]},
}

wf = {'name': 'הסדנה · גיא — סוכן הפרויקטים', 'nodes': nodes, 'connections': connections,
      'active': False, 'settings': {'executionOrder': 'v1'}, 'pinData': {},
      'meta': {'templateCredsSetupCompleted': False}, 'tags': []}

out = Path(__file__).with_name('hasadna-guide-agent.json')
out.write_text(json.dumps(wf, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('wrote', out, len(nodes), 'nodes')
