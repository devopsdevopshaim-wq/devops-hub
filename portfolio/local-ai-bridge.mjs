// SPIDER · local AI bridge. Runs on YOUR computer, nowhere else.
//
// The admin screen (https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/ai.html) talks to the AI tools on your
// computer through this small program, so you do not have to change the settings of each tool (CORS):
//
//     Ollama      http://127.0.0.1:11434   ->  http://127.0.0.1:8765/ollama
//     Open WebUI  http://127.0.0.1:3000    ->  http://127.0.0.1:8765/openwebui
//     OpenClaw    http://127.0.0.1:18789   ->  http://127.0.0.1:8765/openclaw
//
// Start it:   node local-ai-bridge.mjs        (Node 18 or newer; no installation, no packages)
// Other addresses:  OLLAMA_URL=... OPENWEBUI_URL=... OPENCLAW_URL=... PORT=8765 node local-ai-bridge.mjs
//
// Safety: it listens on 127.0.0.1 only (not on your network), forwards only to the three addresses above, and answers
// only pages that come from the SPIDER site (or from localhost). Nothing is stored and nothing is sent anywhere else.
import http from 'node:http';

const PORT = Number(process.env.PORT || 8765);
const TARGETS = {
  ollama: process.env.OLLAMA_URL || 'http://127.0.0.1:11434',
  openwebui: process.env.OPENWEBUI_URL || 'http://127.0.0.1:3000',
  openclaw: process.env.OPENCLAW_URL || 'http://127.0.0.1:18789'
};
const ALLOWED = (process.env.ALLOW_ORIGIN || 'https://devopsdevopshaim-wq.github.io').split(',').map((s) => s.trim());
const okOrigin = (o) => !o || ALLOWED.includes(o) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);

const cors = (origin) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, X-Requested-With',
  'Access-Control-Allow-Private-Network': 'true',
  'Access-Control-Max-Age': '600',
  Vary: 'Origin'
});

async function alive(url) {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(1500) }); return r.status > 0; } catch { return false; }
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (!okOrigin(origin)) { res.writeHead(403, { 'Content-Type': 'text/plain' }); return res.end('origin not allowed'); }
  const h = cors(origin);
  if (req.method === 'OPTIONS') { res.writeHead(204, h); return res.end(); }
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/health') {
    const out = { ok: true, bridge: 'spider-local-ai-bridge', targets: {} };
    await Promise.all(Object.entries(TARGETS).map(async ([k, v]) => { out.targets[k] = await alive(v); }));
    res.writeHead(200, { ...h, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(out));
  }
  const m = /^\/(ollama|openwebui|openclaw)(\/.*)?$/.exec(u.pathname);
  if (!m) { res.writeHead(404, { ...h, 'Content-Type': 'text/plain' }); return res.end('unknown path'); }
  const target = TARGETS[m[1]].replace(/\/+$/, '') + (m[2] || '/') + u.search;
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const headers = {};
    for (const k of ['authorization', 'content-type', 'accept']) if (req.headers[k]) headers[k] = req.headers[k];
    const r = await fetch(target, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body, signal: AbortSignal.timeout(600000) });
    const out = { ...h, 'Content-Type': r.headers.get('content-type') || 'application/octet-stream' };
    res.writeHead(r.status, out);
    if (r.body) { for await (const c of r.body) res.write(c); }   // streams pass through as they arrive
    res.end();
  } catch (e) {
    res.writeHead(502, { ...h, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: `${m[1]} is not answering at ${TARGETS[m[1]]}` } }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`SPIDER local AI bridge: http://127.0.0.1:${PORT}`);
  for (const [k, v] of Object.entries(TARGETS)) console.log(`  /${k}  ->  ${v}`);
  console.log(`Allowed pages: ${ALLOWED.join(', ')} and localhost. Leave this window open. Ctrl+C stops it.`);
});
