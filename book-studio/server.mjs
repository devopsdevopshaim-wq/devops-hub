// ספר — שרת קטן שמגיש את האתר ומחבר אותו ל-Claude.
// מפתח ה-API נשמר רק בשרת (משתנה סביבה) ולעולם לא נשלח לדפדפן.
//
//   ANTHROPIC_API_KEY=sk-ant-... node server.mjs
//
// משתנים אופציונליים: PORT (ברירת מחדל 8787), BOOK_MODEL (ברירת מחדל claude-opus-5-5),
// ACCESS_CODE — קוד גישה שהאתר יבקש לפני שימוש ב-AI (מומלץ כשהשרת פתוח לאינטרנט).
// OPENAI_API_KEY — אופציונלי: ציורים באיכות הגבוהה ביותר דרך שירות התמונות של OpenAI
// (IMAGE_MODEL, ברירת מחדל gpt-image-1). בלעדיו האתר משתמש בשירות ציור חינמי.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const require = createRequire(import.meta.url);
const BookPrompts = require('./js/prompts.js');

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8787;
const MODEL = process.env.BOOK_MODEL || 'claude-opus-5-5';
const ACCESS_CODE = process.env.ACCESS_CODE || '';
const MAX_BODY = 40 * 1024 * 1024;
const HAS_KEY = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

const client = HAS_KEY ? new Anthropic() : null;
const IMAGE_KEY = process.env.OPENAI_API_KEY || '';
const IMAGE_MODEL = process.env.IMAGE_MODEL || 'gpt-image-1';
const IMAGE_SIZES = { landscape: '1536x1024', portrait: '1024x1536', square: '1024x1024' };

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

async function runTask(req, res) {
  if (!client) return sendJson(res, 503, { error: 'לא הוגדר מפתח API בשרת (ANTHROPIC_API_KEY).' });
  if (ACCESS_CODE && req.headers['x-access-code'] !== ACCESS_CODE) {
    return sendJson(res, 401, { error: 'קוד הגישה שגוי.', needCode: true });
  }

  let body;
  try { body = JSON.parse(await readBody(req)); } catch (e) { return sendJson(res, 400, { error: 'בקשה לא תקינה' }); }

  let spec;
  try { spec = BookPrompts.build(body.task, body.project || {}, body.extra || {}); } catch (e) { return sendJson(res, 400, { error: e.message }); }

  const outputConfig = { effort: spec.effort };
  if (spec.schema) outputConfig.format = { type: 'json_schema', schema: spec.schema };

  res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' });
  const write = (obj) => res.write(JSON.stringify(obj) + '\n');

  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: spec.maxTokens,
    // אם המודל מסרב לבקשה, השרת של Anthropic מעביר אותה אוטומטית למודל חלופי.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: outputConfig,
    system: spec.system,
    messages: [{
      role: 'user',
      content: [
        // חומר הגלם והמבנה זהים בין הפרקים — נשמרים במטמון כדי לחסוך בעלות.
        { type: 'text', text: spec.cached, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: spec.instruction }
      ]
    }]
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

async function runImage(req, res) {
  if (!IMAGE_KEY) return sendJson(res, 404, { error: 'אין שירות ציור בשרת' });
  if (ACCESS_CODE && req.headers['x-access-code'] !== ACCESS_CODE) {
    return sendJson(res, 401, { error: 'קוד הגישה שגוי.', needCode: true });
  }
  let body;
  try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { error: 'בקשה לא תקינה' }); }
  const prompt = String(body.prompt || '').slice(0, 4000);
  if (!prompt) return sendJson(res, 400, { error: 'חסר תיאור לציור' });
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { authorization: `Bearer ${IMAGE_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: IMAGE_MODEL, prompt, size: IMAGE_SIZES[body.shape] || IMAGE_SIZES.landscape, quality: 'high', n: 1 })
  });
  const j = await r.json().catch(() => ({}));
  const b64 = j && j.data && j.data[0] && j.data[0].b64_json;
  if (!r.ok || !b64) return sendJson(res, 502, { error: 'שירות הציור החזיר שגיאה: ' + ((j.error && j.error.message) || r.status) });
  sendJson(res, 200, { src: 'data:image/png;base64,' + b64 });
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
      return sendJson(res, 200, { ai: Boolean(client), model: MODEL, needCode: Boolean(ACCESS_CODE), image: IMAGE_KEY ? 'server' : 'free' });
    }
    if (req.url === '/api/run' && req.method === 'POST') return await runTask(req, res);
    if (req.url === '/api/image' && req.method === 'POST') return await runImage(req, res);
    if (req.method === 'GET' || req.method === 'HEAD') return await serveStatic(req, res);
    res.writeHead(405); res.end();
  } catch (err) {
    if (!res.headersSent) sendJson(res, 500, { error: hebrewError(err) });
    else res.end();
  }
}).listen(PORT, () => {
  console.log(`ספר פועל: http://localhost:${PORT}`);
  console.log(HAS_KEY ? `מחובר ל-Claude (${MODEL})` : 'אין מפתח API — האתר יעבוד במצב העתק-הדבק.');
});
