// מעגל סגור — שרת קטן שמגיש את האתר ומחבר אותו ל-Claude.
// מפתח ה-API נשמר רק בשרת (משתנה סביבה) ולעולם לא נשלח לדפדפן.
//
//   ANTHROPIC_API_KEY=sk-ant-... node server.mjs
//
// משתנים אופציונליים: PORT (ברירת מחדל 8790), FIX_MODEL (ברירת מחדל claude-opus-5-5),
// FIX_EFFORT (ברירת מחדל high), ACCESS_CODE — קוד גישה שהאתר יבקש לפני שימוש ב-AI
// (חובה כשהשרת פתוח לאינטרנט).

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const require = createRequire(import.meta.url);
const FixPrompts = require('./js/prompts.js');
const Netlist = require('./js/netlist.js');

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8790;
const MODEL = process.env.FIX_MODEL || 'claude-opus-5-5';
const EFFORT = process.env.FIX_EFFORT || 'high';
const ACCESS_CODE = process.env.ACCESS_CODE || '';
const MAX_BODY = 60 * 1024 * 1024;
const MAX_REVISIONS = 1;
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
      if (size > MAX_BODY) { reject(new Error('הבקשה גדולה מדי (יותר מ-60MB). הקטינו או הסירו קבצים.')); req.destroy(); return; }
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
  if (err instanceof Anthropic.APIConnectionError) return 'אין חיבור לשירות של Claude. בדקו את החיבור לאינטרנט בשרת.';
  if (err instanceof Anthropic.APIError) return 'שגיאת שירות (' + err.status + '): ' + err.message;
  return err && err.message ? err.message : 'שגיאה לא ידועה';
}

// קריאה אחת ל-Claude בסטרימינג. מחזירה את התשובה המפוענחת.
async function ask(messages, onProgress, signal, spec = { system: FixPrompts.SYSTEM, schema: FixPrompts.SCHEMA, parse: FixPrompts.parseResult }) {
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    // אם המודל מסרב לבקשה, השרת של Anthropic מעביר אותה אוטומטית למודל חלופי.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive', display: 'summarized' },
    output_config: { effort: EFFORT, format: { type: 'json_schema', schema: spec.schema } },
    // ההנחיות וההיסטוריה של התיק זהות בין סיבובים — נשמרות במטמון כדי לחסוך בעלות.
    cache_control: { type: 'ephemeral' },
    system: spec.system,
    messages
  }, { signal });

  let chars = 0;
  stream.on('thinking', (delta) => onProgress({ thinking: delta }));
  stream.on('text', (t) => { chars += t.length; onProgress({ chars }); });

  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') throw new Error('Claude סירב לבקשה הזו. נסחו אותה מחדש כבקשת אבחון טכנית.');
  if (msg.stop_reason === 'max_tokens') throw new Error('התשובה ארוכה מדי ונקטעה. צמצמו את היקף השאלה ונסו שוב.');
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { result: spec.parse(text), usage: msg.usage, model: msg.model };
}

// מריץ בקשה אחת ל-Claude, בודק את הסכימה שחזרה, ואם יש שגיאות מבקש תיקון.
async function runWithChecks(res, messages, spec) {
  res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' });
  const write = (obj) => { if (!res.writableEnded) res.write(JSON.stringify(obj) + '\n'); };
  const ctl = new AbortController();
  res.on('close', () => { if (!res.writableFinished) ctl.abort(); });

  try {
    write({ phase: 'analyze' });
    let out = await ask(messages, (p) => write(p), ctl.signal, spec);
    let checks = Netlist.check(out.result.schematic);
    let revisions = 0;

    // שלב האימות: אם הבודק האוטומטי מצא שגיאות בסכימה, Claude מקבל אותן ומתקן.
    while (checks.stats.errors > 0 && revisions < MAX_REVISIONS) {
      revisions++;
      write({ phase: 'revise', issues: checks.issues });
      const errors = checks.issues.filter((i) => i.level === 'error');
      const next = messages.concat(
        { role: 'assistant', content: [{ type: 'text', text: JSON.stringify(out.result) }] },
        { role: 'user', content: [{ type: 'text', text: FixPrompts.revisionRequest(errors) }] }
      );
      out = await ask(next, (p) => write(p), ctl.signal, spec);
      checks = Netlist.check(out.result.schematic);
    }

    write({ phase: 'done', result: out.result, checks, revisions, model: out.model, usage: out.usage });
  } catch (err) {
    if (!ctl.signal.aborted) write({ error: hebrewError(err) });
  }
  res.end();
}

function guard(req, res) {
  if (!client) { sendJson(res, 503, { error: 'לא הוגדר מפתח API בשרת (ANTHROPIC_API_KEY).' }); return false; }
  if (ACCESS_CODE && req.headers['x-access-code'] !== ACCESS_CODE) {
    sendJson(res, 401, { error: 'קוד הגישה שגוי.', needCode: true });
    return false;
  }
  return true;
}

async function diagnose(req, res) {
  if (!guard(req, res)) return;
  let messages;
  try {
    const body = JSON.parse(await readBody(req));
    messages = FixPrompts.buildMessages(body.turns);
  } catch (e) {
    return sendJson(res, 400, { error: e.message || 'בקשה לא תקינה' });
  }
  await runWithChecks(res, messages);
}

// תכנון כרטיס: mode=create (מעגל חדש מתיאור) או review (בדיקה ותיקון של המעגל בעורך)
async function design(req, res) {
  if (!guard(req, res)) return;
  let messages;
  try {
    const body = JSON.parse(await readBody(req));
    const mode = body.mode === 'review' ? 'review' : 'create';
    if (mode === 'create' && !String(body.request || '').trim()) throw new Error('תארו מה המעגל צריך לעשות');
    if (mode === 'review' && !(body.schematic && Array.isArray(body.schematic.components) && body.schematic.components.length)) throw new Error('אין מעגל לבדיקה');
    const issues = mode === 'review' ? Netlist.check({ ...body.schematic, needed: true }).issues : [];
    messages = FixPrompts.designMessages(mode, body.request, body.schematic, issues);
  } catch (e) {
    return sendJson(res, 400, { error: e.message || 'בקשה לא תקינה' });
  }
  await runWithChecks(res, messages, { system: FixPrompts.DESIGN_SYSTEM, schema: FixPrompts.DESIGN_SCHEMA, parse: FixPrompts.parseDesign });
}

async function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT + path.sep) || rel.includes('node_modules') || rel.endsWith('.mjs') || rel.includes('/test/')) {
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
      return sendJson(res, 200, { ai: Boolean(client), model: MODEL, needCode: Boolean(ACCESS_CODE) });
    }
    if (req.url === '/api/diagnose' && req.method === 'POST') return await diagnose(req, res);
    if (req.url === '/api/design' && req.method === 'POST') return await design(req, res);
    if (req.method === 'GET' || req.method === 'HEAD') return await serveStatic(req, res);
    res.writeHead(405); res.end();
  } catch (err) {
    if (!res.headersSent) sendJson(res, 500, { error: hebrewError(err) });
    else res.end();
  }
}).listen(PORT, () => {
  console.log(`מעגל סגור פועל: http://localhost:${PORT}`);
  console.log(HAS_KEY ? `מחובר ל-Claude (${MODEL}, effort ${EFFORT})` : 'אין מפתח API — האתר יעבוד במצב העתק-הדבק.');
});
