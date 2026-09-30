// Guy's brain: answers visitors' questions about the portfolio projects.
// POST /ask  { question: string, history?: [{ role: "user"|"assistant", text }] }
//   -> { answer: string, project: string|null }
// Needs ANTHROPIC_API_KEY. The project list is read from the live site, so it
// is always current. Only the site's own origin may call it.
import http from 'node:http';
import Anthropic from '@anthropic-ai/sdk';

const PORT = process.env.PORT || 3000;
const SITE = process.env.SITE_URL || 'https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/';
const ALLOWED = (process.env.ALLOWED_ORIGINS || 'https://devopsdevopshaim-wq.github.io').split(',').map((s) => s.trim());
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';

const client = new Anthropic();

let projects = null, loadedAt = 0;
async function projectList() {
  if (projects && Date.now() - loadedAt < 10 * 60 * 1000) return projects;
  const r = await fetch(new URL('projects.json', SITE));
  if (!r.ok) throw new Error('projects.json ' + r.status);
  const d = await r.json();
  projects = d.projects.map((p) => ({
    id: p.id, title: p.title, field: d.categories[p.category], desc: p.desc,
    features: p.features, tech: p.tech, story: p.story,
    status: p.localhost ? 'רץ רק במחשב האישי' : p.private ? 'מאגר פרטי' : 'באוויר'
  }));
  loadedAt = Date.now();
  return projects;
}

function systemPrompt(list) {
  return `You are גיא (Guy), the friendly guide of "הסדנה", a Hebrew portfolio site that shows one maker's projects.
Answer in natural, warm, spoken Hebrew: your answer is read aloud by the browser, so keep it to 1–3 short sentences, no lists, no markdown, no emoji.
Talk only about these projects and how to use the site. If asked something unrelated, say briefly that you are here to show the projects and suggest one that fits.
Never invent features that are not in the data. If you don't know, say so.
If your answer is mainly about one project, end with a final line exactly like: PROJECT: <id>   (use the id from the data; omit the line otherwise).
Site tips you may mention: every card has "פתיחה" to open the project, a project page with screenshots, and a "המלצות" tab for recommendations.

Projects (JSON):
${JSON.stringify(list)}`;
}

// A tiny per-IP limit so a public endpoint can't run up the bill.
const hits = new Map();
function limited(ip) {
  const now = Date.now(), win = 60 * 60 * 1000;
  const h = (hits.get(ip) || []).filter((t) => now - t < win);
  h.push(now); hits.set(ip, h);
  return h.length > 40;
}

function send(res, code, body, origin) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin || ALLOWED[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin'
  });
  res.end(JSON.stringify(body));
}

async function ask(question, history) {
  const list = await projectList();
  const messages = [];
  for (const m of history.slice(-8)) {
    if ((m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string' && m.text.trim()) {
      const last = messages[messages.length - 1];
      if (last && last.role === m.role) last.content += '\n' + m.text.slice(0, 600);
      else messages.push({ role: m.role, content: m.text.slice(0, 600) });
    }
  }
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (messages.length && messages[messages.length - 1].role === 'user') messages.pop();
  messages.push({ role: 'user', content: question.slice(0, 600) });

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 2000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system: [{ type: 'text', text: systemPrompt(list), cache_control: { type: 'ephemeral' } }],
    messages
  });

  if (response.stop_reason === 'refusal') return { answer: 'על זה אני לא יכול לענות. אשמח לספר לך על אחד הפרויקטים.', project: null };
  let text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  let project = null;
  const m = text.match(/\n?PROJECT:\s*([\w-]+)\s*$/);
  if (m) {
    text = text.slice(0, m.index).trim();
    if (list.some((p) => p.id === m[1])) project = m[1];
  }
  return { answer: text, project };
}

http.createServer(async (req, res) => {
  const origin = ALLOWED.includes(req.headers.origin) ? req.headers.origin : null;
  if (req.method === 'OPTIONS') return send(res, 204, {}, origin);
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true }, origin);
  if (req.method !== 'POST' || req.url !== '/ask') return send(res, 404, { error: 'not found' }, origin);
  if (!origin) return send(res, 403, { error: 'origin not allowed' });
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();
  if (limited(ip)) return send(res, 429, { error: 'too many questions, try again later' }, origin);

  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 20000) return send(res, 413, { error: 'too large' }, origin); }
  let body;
  try { body = JSON.parse(raw); } catch { return send(res, 400, { error: 'bad json' }, origin); }
  const question = String(body.question || '').trim();
  if (!question) return send(res, 400, { error: 'question required' }, origin);

  try {
    send(res, 200, await ask(question, Array.isArray(body.history) ? body.history : []), origin);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return send(res, 429, { error: 'busy' }, origin);
    if (e instanceof Anthropic.APIError) { console.error('Claude API', e.status, e.message); return send(res, 502, { error: 'upstream' }, origin); }
    console.error(e);
    send(res, 500, { error: 'server' }, origin);
  }
}).listen(PORT, () => console.log('guide server on', PORT, 'model', MODEL));
