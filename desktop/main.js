// Frame Studio desktop shell.
// The window loads https://devopsdevopshaim-wq.github.io/devops-hub/frame-studio/studio.html, and an https
// protocol handler serves everything under /devops-hub/ on that host from the bundled copy in ./app/devops-hub.
// So the pages run offline, but keep the real site's origin (the server checks Origin on sign-in and business
// routes). Every other https request (fonts, the API server, CDNs) goes to the network unchanged.
'use strict';

const { app, BrowserWindow, Menu, protocol, net, session, shell, ipcMain, dialog } = require('electron');
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

// The built-in AI (face finding, cut-outs, the quality check) draws through WebGL. On a computer whose graphics driver
// Chromium does not accept, WebGL is simply missing and every one of those tools fails; this lets it fall back to
// software WebGL (slower, but it works). With an accepted driver nothing changes.
app.commandLine.appendSwitch('enable-unsafe-swiftshader');

// ---------- single instance ----------
let quitting = false;
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // Opening the program again while it runs brings the window back; if the old run has no window left
  // (it was closing), open a new one there instead of leaving the person with nothing.
  app.on('second-instance', () => {
    if (quitting) { app.relaunch(); app.exit(0); return; }
    const w = BrowserWindow.getAllWindows().find((x) => !x.isDestroyed());
    if (w) { if (w.isMinimized()) w.restore(); w.show(); w.focus(); }
    else if (app.isReady()) createWindow();
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

// ---------- local AI engine (stable-diffusion.cpp + FLUX.2 klein 4B on this computer) ----------
// The engine logic lives in local-ai.js (plain Node, testable without Electron); here it is only wired to IPC.
let localAI = null;
function getLocalAI() {
  if (!localAI) {
    const { createEngine } = require('./local-ai');
    localAI = createEngine({
      root: path.join(app.getPath('userData'), 'local-ai'),
      // net.fetch uses the system proxy settings; skip our own https handler (it only serves the bundled site)
      fetch: (url, init) => net.fetch(url, Object.assign({}, init, { bypassCustomProtocolHandlers: true })),
      log: (m) => console.log(m),
    });
    gpuInfo().then((g) => localAI.setGpuHint(g.best)).catch(() => {});
  }
  return localAI;
}

function runOut(cmd, args, ms) {
  // like run(), but keeps stdout when the command exits non-zero (reg.exe /s does on access-denied subkeys)
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, timeout: ms || 8000, maxBuffer: 4 << 20 }, (_err, stdout) => resolve(String(stdout || '')));
  });
}

let gpuInfoPromise = null;
function gpuInfo() {
  if (gpuInfoPromise) return gpuInfoPromise;
  gpuInfoPromise = (async () => {
    const la = require('./local-ai');
    const list = [];
    try {
      const info = await app.getGPUInfo('complete');
      for (const d of (info && info.gpuDevice) || []) {
        const name = d.deviceString || d.driverDescription || '';
        if (name && !/microsoft basic|swiftshader/i.test(name)) list.push({ name, vramMB: 0, active: !!d.active, vendorId: d.vendorId });
      }
      const gl = info && info.auxAttributes && info.auxAttributes.glRenderer;
      if (!list.length && gl) list.push({ name: String(gl).replace(/^ANGLE \(|\)$/g, ''), vramMB: 0 });
    } catch { /* no GPU info */ }
    if (process.platform === 'win32') {
      const reg = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'reg.exe');
      const out = await runOut(fs.existsSync(reg) ? reg : 'reg', ['query', 'HKLM\\SYSTEM\\ControlSet001\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}', '/s']);
      for (const g of la.parseRegGpus(out)) {
        if (/microsoft basic|remote display|virtual/i.test(g.name)) continue;
        const same = list.find((x) => x.name && (x.name === g.name || g.name.includes(x.name) || x.name.includes(g.name)));
        if (same) same.vramMB = Math.max(same.vramMB, g.vramMB); else list.push({ name: g.name, vramMB: g.vramMB });
      }
    }
    if (process.platform !== 'darwin') {
      const smi = process.platform === 'win32'
        ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'nvidia-smi.exe')
        : '/usr/bin/nvidia-smi';
      if (fs.existsSync(smi)) {
        for (const g of la.parseNvidiaSmi(await runOut(smi, ['--query-gpu=name,memory.total', '--format=csv,noheader,nounits']))) {
          const same = list.find((x) => x.name === g.name || x.name.includes(g.name) || g.name.includes(x.name));
          if (same) same.vramMB = g.vramMB; else list.push(g);
        }
      }
    }
    const best = list.slice().sort((a, b) => b.vramMB - a.vramMB)[0] || null;
    const ramMB = Math.round(require('node:os').totalmem() / 1048576);
    return { gpus: list, best, ramMB, speed: la.speedFor(best, 'vulkan') };
  })();
  return gpuInfoPromise;
}

// Only the studio's own pages may use these, and only with plain values; paths and arguments are built in local-ai.js.
function fromApp(event) {
  const frameUrl = event.senderFrame ? event.senderFrame.url : '';
  if (!isAppUrl(frameUrl)) throw new Error('not allowed');
}
function jobId(v) { return typeof v === 'string' && /^[a-z0-9]{6,40}$/i.test(v) ? v : ''; }
function sendTo(event, channel, id, data) {
  try { if (!event.sender.isDestroyed()) event.sender.send(channel, { id, data }); } catch { /* window closed */ }
}

function registerLocalAI() {
  ipcMain.handle('local-ai:status', (event) => { fromApp(event); return getLocalAI().status(); });
  ipcMain.handle('local-ai:gpu', async (event) => { fromApp(event); const g = await gpuInfo(); return { gpus: g.gpus.slice(0, 6), best: g.best, ramMB: g.ramMB, speed: g.speed }; });
  ipcMain.handle('local-ai:install', (event, o) => {
    fromApp(event);
    const id = jobId(o && o.id);
    const variant = o && (o.variant === 'cpu' || o.variant === 'vulkan') ? o.variant : undefined;
    return getLocalAI().install((p) => sendTo(event, 'local-ai:install-progress', id, p), { variant });
  });
  ipcMain.handle('local-ai:cancel-install', (event) => { fromApp(event); return getLocalAI().cancelInstall(); });
  ipcMain.handle('local-ai:remove', (event) => { fromApp(event); return getLocalAI().remove(); });
  ipcMain.handle('local-ai:run', (event, o) => {
    fromApp(event);
    const id = jobId(o && o.id);
    const input = o && typeof o === 'object' ? { mode: o.mode, prompt: o.prompt, imageB64: o.imageB64, w: o.w, h: o.h, seed: o.seed } : null;
    return getLocalAI().run(input, (p) => sendTo(event, 'local-ai:run-progress', id, p));
  });
  ipcMain.handle('local-ai:cancel', (event) => { fromApp(event); return getLocalAI().cancel(); });
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
  // The studio asks "leave without saving?" before closing (beforeunload). A browser shows that question itself;
  // Electron silently cancels the close, so the X did nothing. Ask here, and close when the answer is yes.
  contents.on('will-prevent-unload', (event) => {
    const w = BrowserWindow.fromWebContents(contents);
    const choice = dialog.showMessageBoxSync(w || undefined, {
      type: 'question',
      buttons: ['יציאה', 'ביטול'],
      defaultId: 0,
      cancelId: 1,
      title: 'פריים־סטודיו',
      message: 'לסגור את התוכנה?',
      detail: 'יש תמונות שעוד לא נשמרו. שמירה: כפתור "💾 שמירה" או "שמירת פרויקט".',
      noLink: true,
    });
    if (choice === 0) event.preventDefault();
  });
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

  registerLocalAI();

  // the studio's own ✕ button: the same as the window's X (the "not saved" question above still applies)
  ipcMain.on('app:close', (event) => {
    const frameUrl = event.senderFrame ? event.senderFrame.url : '';
    if (!isAppUrl(frameUrl)) return;
    const w = BrowserWindow.fromWebContents(event.sender);
    if (w) w.close();
  });

  createWindow();

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { app.quit(); });
// a running picture or download must not outlive the program, and nothing may keep it alive in the background:
// a run that stays behind holds the single-instance lock, and the program would not open again until a restart
// (will-quit comes after every window agreed to close; before-quit would also fire when the person then says "ביטול")
app.on('will-quit', () => {
  quitting = true;
  if (localAI) { try { localAI.shutdown(); } catch { /* closing anyway */ } }
  setTimeout(() => app.exit(0), 4000).unref();
});
