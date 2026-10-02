// מכלול — שרת קטן שמגיש את האתר ומחבר אותו ל-Claude.
// מפתח ה-API נשמר רק בשרת (משתנה סביבה) ולעולם לא נשלח לדפדפן.
//
//   ANTHROPIC_API_KEY=sk-ant-... node server.mjs
//
// משתנים אופציונליים: PORT (ברירת מחדל 8788), ASM_MODEL (ברירת מחדל claude-opus-5-5),
// ACCESS_CODE — קוד גישה שהאתר יבקש לפני שימוש ב-AI (מומלץ כשהשרת פתוח לאינטרנט).
// GITHUB_TOKEN + GITHUB_REPO (owner/repo) — כל תכנית חדשה יכולה לפתוח גם Issue ב-GitHub.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const require = createRequire(import.meta.url);
const AsmPrompts = require('./js/prompts.js');

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8788;
const MODEL = process.env.ASM_MODEL || 'claude-opus-5-5';
const ACCESS_CODE = process.env.ACCESS_CODE || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO = process.env.GITHUB_REPO || '';
const MAX_BODY = 40 * 1024 * 1024;
const HAS_KEY = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const client = HAS_KEY ? new Anthropic() : null;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json'
};

function sendJson(res, status, obj) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('הבקשה גדולה מדי')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function hebrewError(err) {
  if (err instanceof Anthropic.AuthenticationError) return 'מפתח ה-API בשרת אינו תקין.';
  if (err instanceof Anthropic.RateLimitError) return 'יותר מדי בקשות כרגע. נסו שוב בעוד דקה.';
  if (err instanceof Anthropic.BadRequestError) return 'הבקשה נדחתה: ' + err.message;
  if (err instanceof Anthropic.APIError) return 'שגיאת שירות (' + err.status + '): ' + err.message;
  return err && err.message ? err.message : 'שגיאה לא ידועה';
}

function codeOk(req, res) {
  if (ACCESS_CODE && req.headers['x-access-code'] !== ACCESS_CODE) {
    sendJson(res, 401, { error: 'קוד הגישה שגוי.', needCode: true });
    return false;
  }
  return true;
}

async function runPlan(req, res) {
  if (!client) return sendJson(res, 503, { error: 'לא הוגדר מפתח API בשרת (ANTHROPIC_API_KEY).' });
  if (!codeOk(req, res)) return;
  let body;
  try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { error: 'בקשה לא תקינה' }); }

  const spec = AsmPrompts.build(body.project || {});
  const content = [];
  // שרטוטים, תמונות תצוגה ומבט על המודל — עד 14 תמונות
  const images = Array.isArray(body.images) ? body.images : body.image ? [{ title: 'מבט תלת-ממדי על המודל', src: body.image }] : [];
  for (const im of images.slice(0, 14)) {
    const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(String(im && im.src || ''));
    if (!m) continue;
    content.push({ type: 'text', text: 'תמונה: ' + String(im.title || '').slice(0, 200) });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/' + m[1], data: m[2] } });
  }
  content.push({ type: 'text', text: spec.cached, cache_control: { type: 'ephemeral' } });
  content.push({ type: 'text', text: spec.instruction });

  res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' });
  const write = (obj) => res.write(JSON.stringify(obj) + '\n');

  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: spec.maxTokens,
    // אם המודל מסרב לבקשה, השרת של Anthropic מעביר אותה אוטומטית למודל חלופי.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: spec.effort, format: { type: 'json_schema', schema: spec.schema } },
    system: spec.system,
    messages: [{ role: 'user', content }]
  });

  req.on('close', () => { if (!res.writableEnded) stream.abort(); });
  stream.on('text', (t) => write({ t }));

  try {
    const msg = await stream.finalMessage();
    write({ done: true, stop: msg.stop_reason, usage: msg.usage, model: msg.model });
  } catch (err) {
    if (!res.destroyed) write({ error: hebrewError(err) });
  }
  res.end();
}

/* פתיחת Issue ב-GitHub לכל תכנית חדשה (אם הוגדרו GITHUB_TOKEN ו-GITHUB_REPO) */
async function runTask(req, res) {
  if (!GITHUB_TOKEN || !GITHUB_REPO) return sendJson(res, 404, { error: 'לא הוגדר חיבור ל-GitHub בשרת' });
  if (!codeOk(req, res)) return;
  let body;
  try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { error: 'בקשה לא תקינה' }); }
  const r = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
    method: 'POST',
    headers: { authorization: `Bearer ${GITHUB_TOKEN}`, accept: 'application/vnd.github+json', 'content-type': 'application/json', 'user-agent': 'assembly-studio' },
    body: JSON.stringify({ title: String(body.title || 'משימת הרכבה').slice(0, 250), body: String(body.body || '').slice(0, 60000), labels: ['assembly'] })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return sendJson(res, 502, { error: 'GitHub החזיר שגיאה: ' + (j.message || r.status) });
  sendJson(res, 200, { url: j.html_url, number: j.number });
}

async function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT + path.sep) || rel.includes('node_modules') || rel.endsWith('.mjs')) {
    res.writeHead(404); return res.end('Not found');
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}

http.createServer(async (req, res) => {
  try {
    if (req.url === '/api/status') {
      return sendJson(res, 200, { ai: Boolean(client), model: MODEL, needCode: Boolean(ACCESS_CODE), github: Boolean(GITHUB_TOKEN && GITHUB_REPO) });
    }
    if (req.url === '/api/plan' && req.method === 'POST') return await runPlan(req, res);
    if (req.url === '/api/task' && req.method === 'POST') return await runTask(req, res);
    if (req.method === 'GET' || req.method === 'HEAD') return await serveStatic(req, res);
    res.writeHead(405); res.end();
  } catch (err) {
    if (!res.headersSent) sendJson(res, 500, { error: hebrewError(err) });
    else res.end();
  }
}).listen(PORT, () => {
  console.log(`מכלול פועל: http://localhost:${PORT}`);
  console.log(HAS_KEY ? `מחובר ל-Claude (${MODEL})` : 'אין מפתח API — תכניות עם Claude ייווצרו במצב העתק-הדבק.');
});
