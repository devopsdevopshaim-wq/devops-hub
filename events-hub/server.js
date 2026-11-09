// הרצה מקומית במחשב (פיתוח ובדיקות): אותו שרת שרץ ב-Cloudflare, עם אחסון בקובץ, והאתר מתיקיית public/.
// בענן האתר מתפרסם ב-GitHub Pages והשרת ב-Cloudflare - הקובץ הזה לא בשימוש שם.
//   npm start            -> http://localhost:3000  (ניהול: /admin/)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { configure } from './src/config.js';
import db from './src/db.js';
import { fileStore } from './src/store-file.js';
import { seedIfEmpty } from './src/seed.js';
import { handle } from './src/app.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.url': 'text/plain',
};

function loadDotEnv() {
  const p = path.join(ROOT, '.env');
  const out = {};
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2];
    }
  }
  return out;
}

function serveStatic(pathname, res) {
  let rel = decodeURIComponent(pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) { res.writeHead(301, { Location: pathname + '/' }); return res.end(); }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('לא נמצא');
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
  fs.createReadStream(file).pipe(res);
}

export async function start({ port = 3000, dataDir = path.join(ROOT, 'data'), env = {} } = {}) {
  const vars = { ...loadDotEnv(), ...process.env, ...env };
  if (!vars.ADMIN_PASSWORD) {
    vars.ADMIN_PASSWORD = 'admin123';
    console.warn('[אזהרה] ADMIN_PASSWORD לא הוגדר - בהרצה מקומית הסיסמה היא admin123');
  }
  await db.init(fileStore(vars.DATA_DIR || dataDir));
  seedIfEmpty();

  const server = http.createServer(async (req, res) => {
    const base = `http://${req.headers.host}`;
    const url = new URL(req.url, base);
    try {
      const request = new Request(url, {
        method: req.method,
        headers: Object.fromEntries(Object.entries(req.headers).filter(([, v]) => typeof v === 'string')),
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Readable.toWeb(req),
        duplex: 'half',
      });
      const out = await handle(request, base);
      if (!out) return serveStatic(url.pathname, res);
      res.writeHead(out.status, Object.fromEntries(out.headers));
      res.end(Buffer.from(await out.arrayBuffer()));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(e.message);
    }
  });
  await new Promise((r) => server.listen(port, r));
  // בהרצה מקומית האתר והשרת באותה כתובת
  configure({ ...vars, PAGES_URL: vars.PAGES_URL || `http://localhost:${server.address().port}` });
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  start({ port }).then(() => console.log(`פריים אירועים פועל: http://localhost:${port}  |  ניהול: http://localhost:${port}/admin/`));
}
