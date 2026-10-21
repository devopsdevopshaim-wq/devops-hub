// Frame Studio desktop shell.
// The window loads https://devopsdevopshaim-wq.github.io/devops-hub/frame-studio/studio.html, and an https
// protocol handler serves everything under /devops-hub/ on that host from the bundled copy in ./app/devops-hub.
// So the pages run offline, but keep the real site's origin (the server checks Origin on sign-in and business
// routes). Every other https request (fonts, the API server, CDNs) goes to the network unchanged.
'use strict';

const { app, BrowserWindow, Menu, protocol, net, session, shell, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');

const HOST = 'devopsdevopshaim-wq.github.io';
const ORIGIN = 'https://' + HOST;
const PREFIX = '/devops-hub/';
const APP_URL = ORIGIN + PREFIX + 'frame-studio/';
const START_URL = APP_URL + 'studio.html';
const API_HOST = 'spider-auth.devopsdevopshaim.workers.dev';
const BUNDLE = path.join(__dirname, 'app', 'devops-hub');
const MACHINE_SALT = 'frame-studio-machine-v1';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.wasm': 'application/wasm', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.pdf': 'application/pdf', '.zip': 'application/zip',
};

// ---------- single instance ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w) { if (w.isMinimized()) w.restore(); w.show(); w.focus(); }
  });
}

// ---------- serving the bundled site ----------
function bundledFile(pathname) {
  // pathname is under PREFIX; map it into BUNDLE without allowing ../ escapes.
  let rel;
  try { rel = decodeURIComponent(pathname.slice(PREFIX.length)); } catch { return null; }
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(BUNDLE, rel));
  if (file !== BUNDLE && !file.startsWith(BUNDLE + path.sep)) return null;
  return file;
}

function passThrough(request) {
  return net.fetch(request, { bypassCustomProtocolHandlers: true });
}

async function handleHttps(request) {
  const url = new URL(request.url);

  if (url.hostname === HOST && url.pathname.startsWith(PREFIX)) {
    // The service worker is disabled in the desktop app so updates come only with a new installer.
    // register() then rejects, and the pages already catch that.
    if (/\/sw\.js$/.test(url.pathname)) return new Response('', { status: 404, headers: { 'Content-Type': 'text/plain' } });

    if (request.method === 'GET' || request.method === 'HEAD') {
      const file = bundledFile(url.pathname);
      if (file) {
        try {
          const st = await fs.promises.stat(file);
          if (st.isDirectory()) {
            // Same as GitHub Pages: /dir -> /dir/
            return new Response(null, { status: 301, headers: { Location: url.origin + url.pathname + '/' + url.search } });
          }
          const body = request.method === 'HEAD' ? null : await fs.promises.readFile(file);
          return new Response(body, {
            status: 200,
            headers: {
              'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
              'Content-Length': String(st.size),
              'Cache-Control': 'no-cache',
            },
          });
        } catch {
          // Not in the bundle (e.g. the marketing videos, or another site of the hub): use the network.
        }
      }
    }
    return passThrough(request);
  }

  // Calls from the studio to its API server. Requests that reach this handler carry no Origin header
  // (checked with Electron 44), but the server only accepts the site's Origin on sign-in and business routes,
  // so add the one a browser would send from the site.
  if (url.hostname === API_HOST && !request.headers.get('origin')) {
    const headers = new Headers(request.headers);
    headers.set('Origin', ORIGIN);
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    return net.fetch(request.url, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      duplex: hasBody ? 'half' : undefined,
      bypassCustomProtocolHandlers: true,
    });
  }

  return passThrough(request);
}

// ---------- machine id (hashed, never the raw value) ----------
function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, timeout: 5000 }, (err, stdout) => resolve(err ? '' : String(stdout || '')));
  });
}

async function rawMachineId() {
  if (process.platform === 'win32') {
    const reg = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'reg.exe');
    const out = await run(fs.existsSync(reg) ? reg : 'reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid', '/reg:64']);
    const m = /MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]{16,})/.exec(out);
    if (m) return m[1];
  } else if (process.platform === 'darwin') {
    const out = await run('/usr/sbin/ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice']);
    const m = /"IOPlatformUUID"\s*=\s*"([^"]+)"/.exec(out);
    if (m) return m[1];
  } else {
    for (const f of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
      try { const v = fs.readFileSync(f, 'utf8').trim(); if (v) return v; } catch { /* try next */ }
    }
  }
  // Fallback: a random id kept in the user's profile.
  const store = path.join(app.getPath('userData'), 'machine.json');
  try {
    const j = JSON.parse(fs.readFileSync(store, 'utf8'));
    if (j && typeof j.id === 'string' && j.id) return j.id;
  } catch { /* create below */ }
  const id = crypto.randomUUID();
  try { fs.mkdirSync(path.dirname(store), { recursive: true }); fs.writeFileSync(store, JSON.stringify({ id })); } catch { /* still return it */ }
  return id;
}

let machineIdPromise = null;
function machineId() {
  if (!machineIdPromise) {
    machineIdPromise = rawMachineId().then((raw) =>
      crypto.createHash('sha256').update(MACHINE_SALT + ':' + String(raw).trim().toLowerCase()).digest('hex'));
  }
  return machineIdPromise;
}

// ---------- navigation guards ----------
function isAppUrl(u) { return typeof u === 'string' && u.startsWith(APP_URL); }

function openOutside(u) {
  try {
    const p = new URL(u).protocol;
    if (p === 'https:' || p === 'http:' || p === 'mailto:' || p === 'tel:') shell.openExternal(u);
  } catch { /* ignore malformed */ }
}

function windowOptions() {
  return {
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'פריים־סטודיו',
    backgroundColor: '#1d1633',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
      spellcheck: false,
      additionalArguments: ['--fs-desktop-version=' + app.getVersion()],
    },
  };
}

app.on('web-contents-created', (_e, contents) => {
  contents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) { event.preventDefault(); openOutside(url); }
  });
  contents.on('will-redirect', (event, url) => {
    if (!isAppUrl(url) && contents.getType() === 'window') { event.preventDefault(); openOutside(url); }
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (isAppUrl(url) || url === 'about:blank' || url.startsWith('blob:' + ORIGIN + '/')) {
      return { action: 'allow', overrideBrowserWindowOptions: { ...windowOptions(), show: true } };
    }
    openOutside(url);
    return { action: 'deny' };
  });
  contents.on('page-title-updated', (event) => {
    // Keep the program's own name in the title bar.
    if (contents.getType() === 'window') {
      event.preventDefault();
      const w = BrowserWindow.fromWebContents(contents);
      if (w) w.setTitle('פריים־סטודיו');
    }
  });
});

// ---------- startup ----------
function createWindow() {
  const win = new BrowserWindow(windowOptions());
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.loadURL(START_URL);
  return win;
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  protocol.handle('https', handleHttps);

  // Files the studio saves (PNG, PDF, ZIP): no save path is set, so Electron shows the normal "Save as" dialog.
  session.defaultSession.on('will-download', (_event, item) => {
    item.setSaveDialogOptions({ title: 'שמירת קובץ', defaultPath: path.join(app.getPath('downloads'), item.getFilename()) });
  });

  ipcMain.handle('machine-id', (event) => {
    const frameUrl = event.senderFrame ? event.senderFrame.url : '';
    if (!isAppUrl(frameUrl)) throw new Error('not allowed');
    return machineId();
  });

  createWindow();

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { app.quit(); });
