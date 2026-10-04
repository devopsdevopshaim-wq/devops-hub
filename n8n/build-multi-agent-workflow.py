#!/usr/bin/env python3
"""Builds n8n/hasadna-multi-agent.json: the portfolio's multi-agent system for n8n Cloud.

Three parts in one workflow:
  A. Agents   — a coordinator agent with six specialist agents as tools. Questions
                arrive from Guy on the site (webhook) or from n8n's own chat page.
  B. Monitor  — every 15 minutes checks every site, remembers the result, and keeps
                sleeping Render apps awake. Optional email when a site goes down.
  C. Control  — GET /webhook/hasadna-status shows a live page of all sites and the
                agent team (?format=json for the portfolio).

    python3 n8n/build-multi-agent-workflow.py [--owner ...] [--repo ...] [--model ...]
"""
import argparse
import json
import uuid
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument('--owner', default='devopsdevopshaim-wq')
ap.add_argument('--repo', default='devops-hub')
ap.add_argument('--model', default='claude-opus-5-5')
args = ap.parse_args()

SITE = f'https://{args.owner}.github.io/{args.repo}/portfolio/'
KNOWLEDGE = SITE + 'knowledge.json'
NS = 'hasadna-multi-agent/'
CHAT_ID = str(uuid.uuid5(uuid.NAMESPACE_URL, NS + 'chat'))


def uid(name):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, NS + name))


def node(name, type_, version, params, pos, **extra):
    n = {'parameters': params, 'id': uid(name), 'name': name, 'type': type_, 'typeVersion': version, 'position': pos}
    n.update(extra)
    return n


def note(name, text, pos, w=420, h=260, color=4):
    return node(name, 'n8n-nodes-base.stickyNote', 1, {'content': text, 'height': h, 'width': w, 'color': color}, pos)


def claude(name, pos, max_tokens):
    return node(name, '@n8n/n8n-nodes-langchain.lmChatAnthropic', 1.3,
                {'model': {'__rl': True, 'mode': 'id', 'value': args.model},
                 'options': {'maxTokensToSample': max_tokens}}, pos)


# ---------------------------------------------------------------- the team
# key, name, fields it owns, what it is for (tool description)
TEAM = [
    ('devops', 'סוכן DevOps ואירוח', ['devops'],
     'מומחה לאוטומציה, שרתים, Docker, Nginx, פריסה, CI/CD, GitHub Actions, n8n ואיך האתר עצמו מתעדכן לבד. '
     'השתמש בו לכל שאלה על אוטומציה, תשתית, אירוח או פריסה — גם כשהיא על פרויקט מתחום אחר.'),
    ('ai', 'סוכן AI', ['ai'],
     'מומחה לפרויקטי הבינה המלאכותית: JARVIS, מצפן בריאות, פענוח אסטרולוגי, DiraFinder, עוזר משרד חכם ועוד.'),
    ('data', 'סוכן נתונים ומחסן', ['data'],
     'מומחה למערכות ניהול: שלוש מערכות המחסן, ניהול קבצים, Excel, ברקודים, מלאי והזמנות. יודע להשוות בין הגרסאות.'),
    ('tools', 'סוכן כלים, לוטו ולימוד', ['tools', 'lotto', 'study'],
     'מומחה לכלים היומיומיים (מתכונים, תרגום, לוח שנה, חגים), למערכות הלוטו ולפרויקטי הלימוד (הקורס, הזוהר).'),
    ('web', 'סוכן אתרים ואפליקציות', ['web', 'other'],
     'מומחה לאתרים ולאפליקציות: מסע, סטודיו ספרים, מתאר, Vercel, Render, Rork ו־Gamma.'),
    ('monitor', 'סוכן ניטור', [],
     'יודע אילו אתרים עובדים עכשיו, אילו נעולים או ישנים, מתי נבדקו לאחרונה ומה קוד התשובה שלהם. '
     'השתמש בו לכל שאלה על זמינות, תקלות או "האם האתר עובד".'),
]

# ---------------------------------------------------------------- code nodes
NORMALIZE = r"""// Questions come from Guy on the site (webhook, JSON as text) or from n8n's chat page.
const j = $json;
let q = {}, source = 'chat';
if (j.chatInput !== undefined) {
  q = { question: j.chatInput, sessionId: j.sessionId, page: '' };
} else {
  source = 'site';
  const raw = j.body;
  try { q = typeof raw === 'string' ? JSON.parse(raw) : (raw || {}); } catch (e) { q = {}; }
}
return [{ json: {
  source,
  question: String(q.question || '').slice(0, 1500).trim() || 'שלום',
  sessionId: String(q.sessionId || 'anon').replace(/[^\w-]/g, '').slice(0, 64) || 'anon',
  page: String(q.page || '').slice(0, 80)
} }];
"""

TEAM_JS = json.dumps([{'key': k, 'name': n, 'fields': f} for k, n, f, _ in TEAM], ensure_ascii=False)

CONTEXT = r"""// Splits the knowledge between the specialists and writes the coordinator's brief.
const K = $('Agents · Load knowledge').first().json;
const req = $('Agents · Normalize').first().json;
const TEAM = __TEAM__;
const status = ($getWorkflowStaticData('global').status) || null;

const slim = p => ({ id: p.id, title: p.title, desc: p.desc, features: p.features, tech: p.tech, story: p.story, address: p.address,
  code: p.code ? { files: p.code.files, versions: p.code.versions, screens: p.code.screens, actions: p.code.actions,
    libraries: p.code.libraries, externalApis: p.code.externalApis, automation: p.code.automation, fileList: p.code.fileList, readme: p.code.readme } : undefined });
const byField = {};
for (const [key, label] of Object.entries(K.categories)) byField[key] = label;
const groups = {};
for (const t of TEAM) {
  const own = K.projects.filter(p => t.fields.includes(Object.keys(byField).find(k => byField[k] === p.field)));
  groups[t.key] = JSON.stringify(own.map(slim));
}
// The DevOps agent also sees every project that has real automation in its code.
groups.devops = JSON.stringify(K.projects.filter(p => p.field === byField.devops || (p.code && p.code.automation.some(a => /Docker|Nginx|שרת צד|Webhook של n8n|GitHub Actions|סקריפט התקנה/.test(a)))).map(slim));
groups.pipeline = K.pipeline.map(s => '- ' + s).join('\n');

let statusText = 'עדיין לא נבדקו האתרים (הבדיקה רצה כל 15 דקות כשה־workflow פעיל).';
if (status) {
  const rows = status.results.map(r => `${r.title} · ${r.label}${r.code ? ' · HTTP ' + r.code : ''} · ${r.url}`);
  statusText = `נבדק לאחרונה: ${status.checkedAt}. עובדים ${status.counts.ok} מתוך ${status.results.length}.\n` + rows.join('\n');
}
groups.status = statusText;

const index = K.projects.map(p => `${p.id} · ${p.title} · ${p.field}`).join('\n');
const team = TEAM.map(t => `- ${t.name}`).join('\n');
const system = `את מאיה, העוזרת האישית של חיים קריספין, ומתאמת צוות הסוכנים של SPIDER: האתר שמציג את כל הפרויקטים של חיים (DevOps, AI, אוטומציה ומערכות ניהול).
מדברים עלייך בלשון נקבה, ואת כותבת בגוף ראשון נקבה ("אני מכירה", "בדקתי").
איך את מדברת: כמו עוזרת אישית אמיתית, חמה ובטוחה בעצמה, שמכירה את העבודה של חיים לעומק.
- משפטים קצרים וטבעיים, בעברית מדוברת. מתחילים במה שחשוב, בלי הקדמות ובלי "שאלה מצוינת".
- מגיבים קודם לאדם ואחר כך לשאלה: אם מישהו מתלבט, לחוץ או מתלהב, מראים שהבנת במשפט קצר.
- אם המשתמש אמר איך קוראים לו, פונים אליו בשמו מדי פעם, לא בכל משפט.
- מסיימים לרוב בשאלה קצרה אחת שמקדמת את השיחה (למשל מה העסק עושה, או אם לתאם שיחה עם חיים).
- התשובות מוקראות בקול באתר: בלי Markdown, בלי רשימות, בלי אימוג'י ובלי קישורים ארוכים.
- את עוזרת דיגיטלית. אם שואלים אם את בן אדם, אומרים בפשטות שאת העוזרת הדיגיטלית של חיים, ושחיים עצמו זמין בוואטסאפ.
כשמישהו מתעניין בשירות לעסק שלו, מחירים או פגישה: הציעי שיחת אפיון חינם עם חיים, בוואטסאפ או בטלפון 054-4979771, ואת דף השירותים באתר.

הצוות שלך (כלים שאת מפעילה):
${team}

איך לעבוד:
1. החליטי אילו מומחים רלוונטיים לשאלה ושאלי אותם — אחד או יותר. בשאלות על אוטומציה, שרתים או פריסה תמיד כלול את סוכן ה־DevOps. בשאלות "האם עובד / זמין" — את סוכן הניטור.
2. העבירי לכל מומחה שאלה ממוקדת ומלאה בעברית (הוא לא רואה את השיחה).
3. חברי את התשובות לתשובה אחת: שאלה פשוטה — 1–3 משפטים; שאלה מעמיקה — 4–8 משפטים עם פרטים קונקרטיים.
4. אל תמציאי. אם המומחים לא יודעים, אמרי זאת והציעי לפתוח את הפרויקט או לדבר עם חיים.
5. שאלה שלא קשורה לפרויקטים או לשירותים: משפט אחד שאת כאן בשביל הפרויקטים והשירותים של חיים, והצעה מתאימה.

בסוף, בשורות נפרדות:
PROJECT: <id>   ← רק אם התשובה עוסקת בעיקר בפרויקט אחד
NEXT: <שאלת המשך מעמיקה אחת>   ← תמיד, עד שתיים

כל הפרויקטים (id · שם · תחום):
${index}
${req.page ? '\nהמבקר נמצא עכשיו בעמוד של: ' + req.page : ''}`;

return [{ json: { ...req, system, groups } }];
""".replace('__TEAM__', TEAM_JS)

SHAPE = r"""// Splits the coordinator's text into answer, project to highlight and follow-ups.
const req = $('Agents · Normalize').first().json;
const out = String($json.output || '').trim();
const next = [];
let project = null;
let answer = out
  .replace(/^\s*NEXT:\s*(.+)$/gim, (m, q) => { next.push(q.trim()); return ''; })
  .replace(/^\s*PROJECT:\s*([\w-]+)\s*$/gim, (m, id) => { project = id; return ''; })
  .replace(/[*#_`]+/g, '')
  .trim();
if (!answer) answer = 'לא הצלחתי לענות כרגע. אפשר לנסות שוב בעוד רגע, או לשאול על פרויקט מסוים.';
const chatText = answer + (next.length ? '\n\nאפשר לשאול גם: ' + next.join(' · ') : '');
return [{ json: { answer, project, next: next.slice(0, 2), source: req.source, output: chatText, question: req.question, at: new Date().toISOString() } }];
"""

TARGETS = r"""// One item per project that has a public address.
const K = $input.first().json;
return K.projects
  .filter(p => p.address && /^https:/.test(p.address))
  .map(p => ({ json: { id: p.id, title: p.title, field: p.field, url: p.address } }));
"""

SUMMARIZE = r"""// Classifies every check, keeps the result in the workflow's memory, and lists what broke.
const targets = $('Monitor · Targets').all().map(i => i.json);
const checks = $input.all().map(i => i.json);
const sd = $getWorkflowStaticData('global');
const before = {};
for (const r of ((sd.status && sd.status.results) || [])) before[r.id] = r.state;

const LABEL = { ok: 'עובד', waking: 'מתעורר', locked: 'נעול', down: 'לא זמין' };
const results = targets.map((t, i) => {
  const c = checks[i] || {};
  const code = Number(c.statusCode || 0);
  const body = String(c.body || c.data || '').slice(0, 20000);
  let state = 'down';
  if (c.error || !code) state = 'down';
  else if (/waking up|spinning up|service is starting|application loading/i.test(body)) state = 'waking';
  else if (code === 401 || code === 403 || /log in to vercel|vercel authentication|sso-protection/i.test(body)) state = 'locked';
  else if (code >= 200 && code < 400) state = 'ok';
  const titleTag = (body.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
  return { id: t.id, title: t.title, field: t.field, url: t.url, code: code || null, state, label: LABEL[state],
           pageTitle: titleTag ? titleTag.replace(/\s+/g, ' ').trim().slice(0, 80) : null,
           error: c.error ? String(c.error.message || c.error).slice(0, 120) : null };
});
const counts = { ok: 0, waking: 0, locked: 0, down: 0 };
for (const r of results) counts[r.state]++;
const newlyDown = results.filter(r => r.state === 'down' && before[r.id] && before[r.id] !== 'down');
const checkedAt = new Date().toISOString();
sd.status = { checkedAt, counts, results };
return [{ json: { checkedAt, counts, newlyDown, total: results.length } }];
"""

FRESH = r"""// Serve the remembered status unless it is old or ?run=1 asks for a new check.
const q = $json.query || {};
const s = $getWorkflowStaticData('global').status;
const age = s ? (Date.now() - Date.parse(s.checkedAt)) / 60000 : Infinity;
return [{ json: { fresh: age < 20 && q.run !== '1' } }];
"""

DASHBOARD = r"""// Renders the control center (HTML) or its data (?format=json).
const hook = $('Status · Webhook').first().json;
const q = hook.query || {};
const s = $getWorkflowStaticData('global').status || { checkedAt: null, counts: { ok: 0, waking: 0, locked: 0, down: 0 }, results: [] };
if (q.format === 'json') {
  return [{ json: { contentType: 'application/json; charset=utf-8', body: JSON.stringify(s) } }];
}
const host = (hook.headers && (hook.headers['x-forwarded-host'] || hook.headers.host)) || '';
const chatUrl = host ? `https://${host}/webhook/__CHAT_ID__/chat` : '';
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const SHOTS = '__SHOTS__';
const TEAM = __TEAM_NAMES__;
const when = s.checkedAt ? new Date(s.checkedAt).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }) : 'עדיין לא נבדק';
const ORDER = { down: 0, locked: 1, waking: 2, ok: 3 };
const cards = s.results.slice().sort((a, b) => ORDER[a.state] - ORDER[b.state]).map(r => `
  <a class="card ${r.state}" href="${esc(r.url)}" target="_blank" rel="noopener">
    <div class="shot" style="background-image:url('${SHOTS}${esc(r.id)}.jpg')"><span class="dot"></span><span class="st">${esc(r.label)}</span></div>
    <div class="meta"><b>${esc(r.title)}</b><small>${esc(r.field)}</small>
    <code>${esc(r.url.replace(/^https:\/\//, ''))}</code>
    <small class="http">${r.code ? 'HTTP ' + r.code : esc(r.error || 'אין תשובה')}</small></div>
  </a>`).join('');
const team = TEAM.map((t, i) => `<li style="--i:${i}"><span></span>${esc(t)}</li>`).join('');
const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="300"><title>מרכז הבקרה · SPIDER</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&family=Bellefair&family=JetBrains+Mono:wght@400&display=swap">
<style>
:root{--bg:#0f0d24;--deep:#17143a;--line:rgba(241,238,252,.12);--txt:#f1eefc;--mist:#a9a4cc;--gold:#e0b25a;--ok:#62dcb8;--wake:#e0b25a;--lock:#b39ae6;--down:#ff7a85}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(900px 500px at 85% -10%,rgba(139,123,255,.25),transparent 60%),var(--bg);color:var(--txt);font:16px/1.5 Assistant,system-ui,sans-serif}
.wrap{max-width:1200px;margin:0 auto;padding:28px 18px 60px}h1{font:400 clamp(34px,5vw,56px)/1.05 Bellefair,serif;margin:0}.sub{color:var(--mist);margin:6px 0 22px}
.stats{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:22px}.stat{padding:12px 18px;border-radius:14px;background:var(--deep);border:1px solid var(--line);min-width:120px}
.stat b{display:block;font:400 34px/1 Bellefair,serif}.stat small{color:var(--mist)}.stat.ok b{color:var(--ok)}.stat.waking b{color:var(--wake)}.stat.locked b{color:var(--lock)}.stat.down b{color:var(--down)}
.row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:26px}.btn{display:inline-block;padding:10px 18px;border-radius:999px;background:var(--gold);color:#1b1405;font-weight:700;text-decoration:none}
.btn.ghost{background:transparent;color:var(--txt);border:1px solid var(--line)}
.team{list-style:none;margin:0 0 30px;padding:18px;border-radius:18px;background:var(--deep);border:1px solid var(--line);display:flex;flex-wrap:wrap;gap:10px}
.team li{display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;background:rgba(241,238,252,.05);border:1px solid var(--line)}
.team li span{width:9px;height:9px;border-radius:50%;background:var(--ok);animation:p 2s infinite;animation-delay:calc(var(--i)*.25s)}
.team::before{content:'צוות הסוכנים — פעיל';width:100%;font-weight:700;color:var(--gold)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}
.card{display:flex;flex-direction:column;border-radius:16px;overflow:hidden;background:var(--deep);border:1px solid var(--line);color:inherit;text-decoration:none;transition:transform .25s}
.card:hover{transform:translateY(-4px)}.shot{position:relative;height:130px;background:#120f2e center top/cover no-repeat}
.st{position:absolute;top:10px;inset-inline-start:30px;padding:2px 10px;border-radius:999px;background:rgba(15,13,36,.8);font-size:13px;font-weight:600}
.dot{position:absolute;top:15px;inset-inline-start:12px;width:10px;height:10px;border-radius:50%;background:currentColor}
.ok .dot,.ok .st{color:var(--ok)}.waking .dot,.waking .st{color:var(--wake)}.locked .dot,.locked .st{color:var(--lock)}.down .dot,.down .st{color:var(--down)}
.ok .dot{animation:p 2s infinite}.down{border-color:rgba(255,122,133,.5)}
.meta{display:flex;flex-direction:column;gap:2px;padding:12px 14px}.meta small{color:var(--mist)}.meta code{font:12px 'JetBrains Mono',monospace;color:var(--mist);direction:ltr;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.http{font-family:'JetBrains Mono',monospace}
@keyframes p{0%{box-shadow:0 0 0 0 currentColor}70%,100%{box-shadow:0 0 0 8px transparent}}
</style></head><body><div class="wrap">
<h1>מרכז הבקרה של SPIDER</h1>
<p class="sub">כל האתרים נבדקים אוטומטית ב־n8n כל 15 דקות · בדיקה אחרונה: ${esc(when)}</p>
<div class="stats"><div class="stat ok"><b>${s.counts.ok}</b><small>עובדים</small></div><div class="stat waking"><b>${s.counts.waking}</b><small>מתעוררים</small></div>
<div class="stat locked"><b>${s.counts.locked}</b><small>נעולים</small></div><div class="stat down"><b>${s.counts.down}</b><small>לא זמינים</small></div></div>
<div class="row">${chatUrl ? `<a class="btn" href="${chatUrl}" target="_blank" rel="noopener">שיחה עם צוות הסוכנים</a>` : ''}
<a class="btn ghost" href="?run=1">בדיקה עכשיו</a><a class="btn ghost" href="__SITE__" target="_blank" rel="noopener">לאתר SPIDER</a></div>
<ul class="team">${team}</ul>
<div class="grid">${cards || '<p>הבדיקה הראשונה עוד לא רצה. לחצו "בדיקה עכשיו".</p>'}</div>
</div></body></html>`;
return [{ json: { contentType: 'text/html; charset=utf-8', body: html } }];
""".replace('__CHAT_ID__', CHAT_ID).replace('__SHOTS__', SITE + 'shots/').replace('__SITE__', SITE) \
   .replace('__TEAM_NAMES__', json.dumps(['מאיה · המתאמת'] + [n for _, n, _, _ in TEAM], ensure_ascii=False))

# ---------------------------------------------------------------- nodes
X0, Y_AG, Y_MON, Y_ST = 0, 0, 1000, 1500
nodes = [
    note('Note · Agents',
         '## A · צוות הסוכנים\nשאלה מגיעה ממאיה באתר (Webhook) או מדף הצ׳אט של n8n (Chat Trigger). '
         'המתאם בוחר מומחים, שואל אותם, ומחבר תשובה אחת. כל מומחה מכיר לעומק את הפרויקטים שלו מתוך '
         '`knowledge.json` (נבנה אוטומטית מהקוד בכל פרסום).',
         [X0 - 460, Y_AG - 260], w=420, h=240, color=5),
    node('Guy · Site webhook', 'n8n-nodes-base.webhook', 2,
         {'httpMethod': 'POST', 'path': 'hasadna-guide', 'responseMode': 'responseNode', 'options': {}},
         [X0, Y_AG - 80], webhookId=uid('guide-webhook')),
    node('Team chat', '@n8n/n8n-nodes-langchain.chatTrigger', 1.1,
         {'public': True, 'mode': 'hostedChat',
          'options': {'title': 'SPIDER · צוות הסוכנים', 'subtitle': 'שאלו על כל פרויקט, אוטומציה או זמינות',
                      'initialMessages': 'היי, אני מאיה, העוזרת האישית של חיים קריספין. איך אפשר לעזור?',
                      'inputPlaceholder': 'למשל: איך האתר מתעדכן לבד?'}},
         [X0, Y_AG + 100], webhookId=CHAT_ID),
    node('Agents · Normalize', 'n8n-nodes-base.code', 2, {'jsCode': NORMALIZE}, [X0 + 220, Y_AG]),
    node('Agents · Load knowledge', 'n8n-nodes-base.httpRequest', 4.2,
         {'url': KNOWLEDGE, 'options': {'timeout': 15000}}, [X0 + 440, Y_AG]),
    node('Agents · Context', 'n8n-nodes-base.code', 2, {'jsCode': CONTEXT}, [X0 + 660, Y_AG]),
    node('מאיה · המתאמת', '@n8n/n8n-nodes-langchain.agent', 2.2,
         {'promptType': 'define', 'text': '={{ $json.question }}',
          'options': {'systemMessage': '={{ $json.system }}', 'maxIterations': 8}},
         [X0 + 900, Y_AG], onError='continueRegularOutput'),
    claude('Claude · המתאם', [X0 + 760, Y_AG + 240], 1500),
    node('Memory · שיחה', '@n8n/n8n-nodes-langchain.memoryBufferWindow', 1.3,
         {'sessionIdType': 'customKey', 'sessionKey': "={{ $('Agents · Normalize').first().json.sessionId }}",
          'contextWindowLength': 8}, [X0 + 900, Y_AG + 240]),
    node('Agents · Shape answer', 'n8n-nodes-base.code', 2, {'jsCode': SHAPE}, [X0 + 1240, Y_AG]),
    node('From the site?', 'n8n-nodes-base.if', 2.2,
         {'conditions': {'options': {'caseSensitive': True, 'typeValidation': 'loose', 'version': 2},
                         'conditions': [{'id': uid('if-site'), 'leftValue': '={{ $json.source }}', 'rightValue': 'site',
                                         'operator': {'type': 'string', 'operation': 'equals'}}],
                         'combinator': 'and'}, 'options': {}},
         [X0 + 1460, Y_AG]),
    node('Guy · Respond', 'n8n-nodes-base.respondToWebhook', 1.1,
         {'respondWith': 'json',
          'responseBody': '={{ { answer: $json.answer, project: $json.project, next: $json.next } }}',
          'options': {'responseHeaders': {'entries': [{'name': 'Access-Control-Allow-Origin', 'value': '*'}]}}},
         [X0 + 1680, Y_AG - 80]),
]

# specialists: agent tool + its own Claude
for i, (key, name, fields, desc) in enumerate(TEAM):
    x = X0 + 1060 + i * 230
    y = Y_AG + 420
    if key == 'monitor':
        knowledge = "' + $('Agents · Context').first().json.groups.status + '"
        role = 'אתה סוכן הניטור של SPIDER. זה מצב האתרים מהבדיקה האוטומטית האחרונה:\\n'
        extra = '\\nהסבר מה המצב אומר: "נעול" = דורש התחברות (למשל Vercel Deployment Protection), "מתעורר" = שרת חינמי שנרדם ומתעורר, "לא זמין" = אין תשובה או שגיאה.'
    elif key == 'devops':
        knowledge = "' + $('Agents · Context').first().json.groups.devops + '\\n\\nאיך האתר עצמו אוטומטי:\\n' + $('Agents · Context').first().json.groups.pipeline + '"
        role = f'אתה {name} של SPIDER. הידע שלך (JSON, כולל ניתוח קוד):\\n'
        extra = '\\nבשאלות על אוטומציה: הסבר מה מפעיל את התהליך, מה קורה צעד אחר צעד, מה יוצא, ואיך אפשר להרחיב (n8n, GitHub Actions, Docker, Webhook, תזמון).'
    else:
        knowledge = f"' + $('Agents · Context').first().json.groups.{key} + '"
        role = f'אתה {name} של SPIDER. הידע שלך על הפרויקטים (JSON, כולל ניתוח קוד):\\n'
        extra = '\\nכשמשווים גרסאות או פרויקטים, הסבר מה שונה בפועל (מסכים, יכולות, ספריות, אחסון).'
    system = ("={{ '" + role + knowledge +
              "\\n\\nענה בעברית, ענייני ומפורט, רק מהידע הזה. ציין שמות פרויקטים ו־id. אם אין לך מידע — אמור זאת." + extra + "' }}")
    nodes.append(node(name, '@n8n/n8n-nodes-langchain.agentTool', 2.2,
                      {'toolDescription': desc,
                       'text': "={{ $fromAI('Prompt__User_Message_', 'השאלה המלאה בעברית שהמומחה צריך לענות עליה', 'string') }}",
                       'options': {'systemMessage': system, 'maxIterations': 3}},
                      [x, y]))
    nodes.append(claude(f'Claude · {name}', [x, y + 220], 1200))

nodes += [
    note('Note · Monitor',
         '## B · ניטור האתרים\nכל 15 דקות: טוען את רשימת האתרים, בודק את כולם במקביל, מסווג (עובד / מתעורר / נעול / לא זמין), '
         'ושומר בזיכרון של ה־workflow. הבדיקה גם מעירה אתרים חינמיים ב־Render כך שהם נשארים ערים.\n\n'
         'אופציונלי: מייל כשאתר נופל — מחברים Gmail ומפעילים את הצומת (מקש D).',
         [X0 - 460, Y_MON - 240], w=420, h=260, color=6),
    node('Every 15 minutes', 'n8n-nodes-base.scheduleTrigger', 1.2,
         {'rule': {'interval': [{'field': 'minutes', 'minutesInterval': 15}]}}, [X0, Y_MON]),
    node('Monitor · Load sites', 'n8n-nodes-base.httpRequest', 4.2,
         {'url': KNOWLEDGE, 'options': {'timeout': 15000}}, [X0 + 440, Y_MON]),
    node('Monitor · Targets', 'n8n-nodes-base.code', 2, {'jsCode': TARGETS}, [X0 + 660, Y_MON]),
    node('Monitor · Check sites', 'n8n-nodes-base.httpRequest', 4.2,
         {'url': '={{ $json.url }}',
          'options': {'timeout': 20000, 'allowUnauthorizedCerts': False,
                      'response': {'response': {'fullResponse': True, 'neverError': True, 'responseFormat': 'text'}}}},
         [X0 + 880, Y_MON], onError='continueRegularOutput', alwaysOutputData=True),
    node('Monitor · Summarize', 'n8n-nodes-base.code', 2, {'jsCode': SUMMARIZE}, [X0 + 1100, Y_MON]),
    node('Opened from the control center?', 'n8n-nodes-base.if', 2.2,
         {'conditions': {'options': {'caseSensitive': True, 'typeValidation': 'loose', 'version': 2},
                         'conditions': [{'id': uid('if-dash'), 'leftValue': "={{ $('Status · Webhook').isExecuted }}",
                                         'rightValue': True, 'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}],
                         'combinator': 'and'}, 'options': {}},
         [X0 + 1320, Y_MON]),
    node('Something went down?', 'n8n-nodes-base.if', 2.2,
         {'conditions': {'options': {'caseSensitive': True, 'typeValidation': 'loose', 'version': 2},
                         'conditions': [{'id': uid('if-down'), 'leftValue': '={{ $json.newlyDown.length }}', 'rightValue': 0,
                                         'operator': {'type': 'number', 'operation': 'gt'}}],
                         'combinator': 'and'}, 'options': {}},
         [X0 + 1540, Y_MON + 140]),
    node('Alert · Email (optional)', 'n8n-nodes-base.gmail', 2.1,
         {'sendTo': 'devopsdevopshaim@gmail.com',
          'subject': "={{ 'SPIDER: ' + $json.newlyDown.length + ' אתרים הפסיקו לעבוד' }}",
          'emailType': 'text',
          'message': "={{ $json.newlyDown.map(r => r.title + ' — ' + r.url + ' (' + (r.code ? 'HTTP ' + r.code : (r.error || 'אין תשובה')) + ')').join('\\n') }}",
          'options': {}},
         [X0 + 1760, Y_MON + 140], disabled=True),
    note('Note · Control',
         '## C · מרכז הבקרה\n`GET /webhook/hasadna-status` — דף חי עם כל האתרים והסטטוס שלהם, צוות הסוכנים וקישור לצ׳אט. '
         '`?run=1` מריץ בדיקה עכשיו, `?format=json` מחזיר נתונים (האתר משתמש בזה).',
         [X0 - 460, Y_ST - 200], w=420, h=200, color=3),
    node('Status · Webhook', 'n8n-nodes-base.webhook', 2,
         {'httpMethod': 'GET', 'path': 'hasadna-status', 'responseMode': 'responseNode', 'options': {}},
         [X0, Y_ST], webhookId=uid('status-webhook')),
    node('Status · Fresh?', 'n8n-nodes-base.code', 2, {'jsCode': FRESH}, [X0 + 220, Y_ST]),
    node('Use remembered status?', 'n8n-nodes-base.if', 2.2,
         {'conditions': {'options': {'caseSensitive': True, 'typeValidation': 'loose', 'version': 2},
                         'conditions': [{'id': uid('if-fresh'), 'leftValue': '={{ $json.fresh }}', 'rightValue': True,
                                         'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}],
                         'combinator': 'and'}, 'options': {}},
         [X0 + 440, Y_ST]),
    node('Status · Render page', 'n8n-nodes-base.code', 2, {'jsCode': DASHBOARD}, [X0 + 1540, Y_ST]),
    node('Status · Respond', 'n8n-nodes-base.respondToWebhook', 1.1,
         {'respondWith': 'text', 'responseBody': '={{ $json.body }}',
          'options': {'responseHeaders': {'entries': [
              {'name': 'Content-Type', 'value': '={{ $json.contentType }}'},
              {'name': 'Access-Control-Allow-Origin', 'value': '*'},
              {'name': 'Cache-Control', 'value': 'no-store'}]}}},
         [X0 + 1760, Y_ST]),
]


def link(a, b, out=0):
    return (a, b, out)


main = [
    ('Guy · Site webhook', 'Agents · Normalize', 0),
    ('Team chat', 'Agents · Normalize', 0),
    ('Agents · Normalize', 'Agents · Load knowledge', 0),
    ('Agents · Load knowledge', 'Agents · Context', 0),
    ('Agents · Context', 'מאיה · המתאמת', 0),
    ('מאיה · המתאמת', 'Agents · Shape answer', 0),
    ('Agents · Shape answer', 'From the site?', 0),
    ('From the site?', 'Guy · Respond', 0),
    ('Every 15 minutes', 'Monitor · Load sites', 0),
    ('Monitor · Load sites', 'Monitor · Targets', 0),
    ('Monitor · Targets', 'Monitor · Check sites', 0),
    ('Monitor · Check sites', 'Monitor · Summarize', 0),
    ('Monitor · Summarize', 'Opened from the control center?', 0),
    ('Opened from the control center?', 'Status · Render page', 0),
    ('Opened from the control center?', 'Something went down?', 1),
    ('Something went down?', 'Alert · Email (optional)', 0),
    ('Status · Webhook', 'Status · Fresh?', 0),
    ('Status · Fresh?', 'Use remembered status?', 0),
    ('Use remembered status?', 'Status · Render page', 0),
    ('Use remembered status?', 'Monitor · Load sites', 1),
    ('Status · Render page', 'Status · Respond', 0),
]
connections = {}
for a, b, out in main:
    outs = connections.setdefault(a, {}).setdefault('main', [])
    while len(outs) <= out:
        outs.append([])
    outs[out].append({'node': b, 'type': 'main', 'index': 0})


def ai(src, dst, kind):
    connections.setdefault(src, {}).setdefault(kind, [[]])[0].append({'node': dst, 'type': kind, 'index': 0})


ai('Claude · המתאם', 'מאיה · המתאמת', 'ai_languageModel')
ai('Memory · שיחה', 'מאיה · המתאמת', 'ai_memory')
for key, name, _, _ in TEAM:
    ai(name, 'מאיה · המתאמת', 'ai_tool')
    ai(f'Claude · {name}', name, 'ai_languageModel')

wf = {'name': 'הסדנה · מערכת מולטי־אייג׳נט ומרכז בקרה', 'nodes': nodes, 'connections': connections,
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

out = Path(__file__).with_name('hasadna-multi-agent.json')
out.write_text(json.dumps(wf, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('wrote', out, len(nodes), 'nodes,', len(TEAM), 'specialists, chat id', CHAT_ID)
