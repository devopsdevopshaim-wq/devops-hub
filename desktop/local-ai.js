// Local AI engine (מנוע AI מקומי): runs the studio's image edits on this computer with stable-diffusion.cpp
// and FLUX.2 klein 4B, so AI edits work without internet.
//
// Plain Node (no Electron imports), so it can be required and tested without Electron. main.js creates one engine
// with createEngine({ root, fetch }) and wires it to IPC.
//
// Files under <root> (main.js: <userData>/local-ai/):
//   manifest.json       what is installed (engine build, model files, sizes, sha256)
//   engine/             the extracted stable-diffusion.cpp release (sd-cli / sd-cli.exe and its DLLs)
//   models/             diffusion model GGUF, text encoder GGUF, VAE safetensors
//   downloads/          *.part files while downloading (resumable with HTTP Range)
'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { spawn, execFile } = require('node:child_process');

const MODEL_ID = 'flux-2-klein-4b';
const MANIFEST_VERSION = 1;
const RUN_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_PROMPT = 2000;
const MAX_IMAGE_B64 = 16 * 1024 * 1024;   // ~12 MB of JPEG/PNG; the studio sends ~0.3 MB
const STEPS = 4;
const CFG = '1.0';
const SAMPLER = 'euler';

const DEFAULTS = {
  hfBase: 'https://huggingface.co',
  ghApi: 'https://api.github.com',
  ghRepo: 'leejet/stable-diffusion.cpp',
};

// Where each file comes from. Every repo is listed through the Hugging Face API at install time and the file is
// picked by pattern, so a renamed quant or a moved VAE does not break the installer.
const SOURCES = {
  diffusion: {
    label: 'מודל התמונה FLUX.2 klein 4B',
    candidates: [{ repo: 'leejet/FLUX.2-klein-4B-GGUF' }],
    // lower index = preferred; Q4 is the size/quality sweet spot for 6-8 GB cards
    prefer: ['Q4_K_M', 'Q4_K_S', 'Q4_K', 'Q4_0', 'Q4_1', 'Q5_K_S', 'Q5_K_M', 'Q5_K', 'Q5_0', 'Q5_1', 'Q6_K', 'Q8_0'],
    match: (p) => /\.gguf$/i.test(p) && !/base/i.test(path.basename(p)) && !/mmproj/i.test(p),
    minSize: 1.0e9, maxSize: 6e9,
  },
  llm: {
    label: 'מקודד הטקסט Qwen3 4B',
    candidates: [{ repo: 'unsloth/Qwen3-4B-GGUF' }, { repo: 'Qwen/Qwen3-4B-GGUF' }],
    prefer: ['Q4_K_M', 'Q4_K_S', 'Q4_K', 'Q4_0', 'Q5_K_M', 'Q5_K_S', 'Q5_0', 'Q6_K', 'Q8_0'],
    match: (p) => /\.gguf$/i.test(p) && !/mmproj|imatrix/i.test(p) && !/(^|[-_/])UD[-_]/i.test(p) && /qwen3[-_]?4b/i.test(path.basename(p)) && !/instruct-2507|thinking-2507/i.test(p),
    minSize: 1.5e9, maxSize: 5e9,
  },
  vae: {
    label: 'מפענח התמונה (VAE) של FLUX.2',
    // black-forest-labs repos are gated (need a token), the Comfy-Org mirrors are open. First that lists and answers wins.
    candidates: [
      { repo: 'leejet/FLUX.2-klein-4B-GGUF' },
      { repo: 'Comfy-Org/flux2-klein-4B', dir: 'split_files/vae' },
      { repo: 'Comfy-Org/flux2-klein', dir: 'split_files/vae' },
      { repo: 'Comfy-Org/flux2-dev', dir: 'split_files/vae' },
      { repo: 'black-forest-labs/FLUX.2-klein-4B' },
      { repo: 'black-forest-labs/FLUX.2-dev' },
    ],
    prefer: ['flux2-vae', 'flux2_ae', 'flux2-ae', 'ae.safetensors', 'vae'],
    match: (p) => /\.safetensors$/i.test(p) && (/(^|\/)vae\//i.test(p) || /(^|[-_/])(ae|vae)\.safetensors$/i.test(p) || /flux2[-_]?(vae|ae)/i.test(path.basename(p))) && !/small[-_]?decoder|taef|tae[-_]/i.test(p),
    minSize: 50e6, maxSize: 1.2e9,
  },
};

// stable-diffusion.cpp release zips (names from .github/workflows/build.yml):
//   sd-master-<sha>-bin-win-vulkan-x64.zip, -bin-win-cpu-x64.zip (older: -bin-win-avx2-x64.zip), -bin-win-cuda12-x64.zip
//   sd-master-<sha>-bin-Linux-Ubuntu-24.04-x86_64[-vulkan].zip, sd-master-<sha>-bin-Darwin-macOS-15-arm64.zip
const ASSET_PATTERNS = {
  win32: {
    vulkan: [/-bin-win-vulkan-x64\.zip$/i],
    cpu: [/-bin-win-cpu-x64\.zip$/i, /-bin-win-avx2-x64\.zip$/i, /-bin-win-avx-x64\.zip$/i, /-bin-win-noavx-x64\.zip$/i],
  },
  linux: {
    vulkan: [/-bin-linux-[^/]*x86_64-vulkan\.zip$/i],
    cpu: [/-bin-linux-[^/]*x86_64\.zip$/i],
  },
  darwin: {
    // Metal is built in; one build for both
    vulkan: [/-bin-darwin-[^/]*arm64\.zip$/i],
    cpu: [/-bin-darwin-[^/]*arm64\.zip$/i],
  },
};

// ---------------------------------------------------------------- discovery (pure, tested with fixtures)

function quantRank(file, prefer) {
  const base = path.basename(file).toUpperCase();
  for (let i = 0; i < prefer.length; i++) {
    const q = prefer[i].toUpperCase();
    // match the quant as a whole token: "-Q4_K_M." but not "Q4_K" inside "Q4_K_M"
    const re = new RegExp('(^|[-_.])' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[-_.])');
    if (re.test(base)) return i;
  }
  return prefer.length;
}

function fileSize(entry) {
  if (!entry) return 0;
  if (entry.lfs && Number(entry.lfs.size) > 0) return Number(entry.lfs.size);
  return Number(entry.size) || 0;
}

function fileSha256(entry) {
  const oid = entry && entry.lfs && (entry.lfs.oid || entry.lfs.sha256);
  return typeof oid === 'string' && /^[0-9a-f]{64}$/i.test(oid) ? oid.toLowerCase() : '';
}

// tree: array from /api/models/<repo>/tree/main?recursive=true ({type, path, size, oid, lfs?}),
// or a model info object with siblings [{rfilename, size?, lfs?}].
function normalizeTree(json) {
  const out = [];
  const list = Array.isArray(json) ? json : json && Array.isArray(json.siblings) ? json.siblings : [];
  for (const e of list) {
    if (!e) continue;
    const p = typeof e.path === 'string' ? e.path : typeof e.rfilename === 'string' ? e.rfilename : '';
    if (!p || (e.type && e.type !== 'file')) continue;
    out.push({ path: p, size: fileSize(e), sha256: fileSha256(e) });
  }
  return out;
}

function pickFile(kind, tree, dir, anySize) {
  const src = SOURCES[kind];
  let files = normalizeTree(tree).filter((f) => src.match(f.path));
  if (dir) files = files.filter((f) => f.path.startsWith(dir.replace(/\/+$/, '') + '/'));
  if (!anySize) files = files.filter((f) => !f.size || (f.size >= src.minSize && f.size <= src.maxSize));
  if (!files.length) return null;
  files.sort((a, b) => (quantRank(a.path, src.prefer) - quantRank(b.path, src.prefer)) || (a.path.length - b.path.length) || (a.size - b.size));
  return files[0];
}

function pickReleaseAsset(release, platform, variant) {
  const assets = release && Array.isArray(release.assets) ? release.assets : [];
  const pats = (ASSET_PATTERNS[platform] || {})[variant] || [];
  for (const re of pats) {
    const a = assets.find((x) => x && typeof x.name === 'string' && re.test(x.name) && typeof x.browser_download_url === 'string');
    if (a) {
      const dg = typeof a.digest === 'string' && /^sha256:[0-9a-f]{64}$/i.test(a.digest) ? a.digest.slice(7).toLowerCase() : '';
      return { name: a.name, url: a.browser_download_url, size: Number(a.size) || 0, sha256: dg, tag: String(release.tag_name || '') };
    }
  }
  return null;
}

// ---------------------------------------------------------------- progress parsing
// sd.cpp prints "\r|=====>    | 2/4 - 3.21s/it\033[K" while sampling (also it/s), and the same bar with
// '#' and MB/s or GB/s while loading weights (pretty_bytes_progress). Phases are weighted into one percent.

const PROGRESS_RE = /(\d+)\/(\d+)\s*-\s*([\d.]+)\s*(s\/it|it\/s|MB\/s|GB\/s)/g;

function createProgressParser(steps) {
  const st = { phase: 'start', pct: 1, sampledOnce: false };
  return function feed(text) {
    let m; let changed = false;
    PROGRESS_RE.lastIndex = 0;
    while ((m = PROGRESS_RE.exec(String(text)))) {
      const a = Number(m[1]), b = Number(m[2]), unit = m[4];
      if (!(b > 0) || a > b) continue;
      let pct;
      if (unit === 'MB/s' || unit === 'GB/s') {        // loading the weights
        if (st.sampledOnce) continue;
        st.phase = 'load'; pct = 2 + 23 * (a / b);
      } else if (b === steps && st.phase !== 'decode') { // sampling
        st.phase = 'sample'; st.sampledOnce = true; pct = 30 + 60 * (a / b);
      } else if (st.sampledOnce) {                     // VAE decode in tiles
        st.phase = 'decode'; pct = 90 + 9 * (a / b);
      } else continue;
      pct = Math.min(99, Math.max(st.pct, Math.round(pct)));
      if (pct !== st.pct) { st.pct = pct; changed = true; }
    }
    return changed ? { pct: st.pct, phase: st.phase } : null;
  };
}

// ---------------------------------------------------------------- input validation and arguments

const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

function validateRunInput(o) {
  if (!o || typeof o !== 'object') return { error: 'bad-input', detail: 'no input' };
  const mode = o.mode;
  if (mode !== 'restyle' && mode !== 'image') return { error: 'bad-input', detail: 'mode' };
  let prompt = typeof o.prompt === 'string' ? o.prompt : '';
  // control characters out, no leading dashes (the value goes after -p; keep it from ever looking like a flag)
  prompt = prompt.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').trim().replace(/^-+\s*/, '');
  if (!prompt || prompt.length > MAX_PROMPT) return { error: 'bad-input', detail: 'prompt length' };
  const w = Number(o.w), h = Number(o.h);
  for (const v of [w, h]) {
    if (!Number.isInteger(v) || v < 256 || v > 1536 || v % 16 !== 0) return { error: 'bad-input', detail: 'size' };
  }
  let seed = o.seed == null ? crypto.randomInt(0, 2147483647) : Number(o.seed);
  if (!Number.isInteger(seed) || seed < 0 || seed > 2147483647) return { error: 'bad-input', detail: 'seed' };
  let image = null, ext = '';
  if (mode === 'restyle') {
    const b64 = typeof o.imageB64 === 'string' ? o.imageB64.replace(/^data:image\/[a-z]+;base64,/, '') : '';
    if (!b64 || b64.length > MAX_IMAGE_B64 || !B64_RE.test(b64)) return { error: 'bad-input', detail: 'image' };
    image = Buffer.from(b64, 'base64');
    if (image.length > 3 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff) ext = '.jpg';
    else if (image.length > 8 && image.readUInt32BE(0) === 0x89504e47) ext = '.png';
    else return { error: 'bad-input', detail: 'image type' };
  }
  return { mode, prompt, w, h, seed, image, ext };
}

// Exact sd-cli arguments. Paths come only from the manifest / temp dir, never from the page.
function buildArgs(files, input, opt) {
  const args = [
    '--diffusion-model', files.diffusion,
    '--vae', files.vae,
    '--llm', files.llm,
    '-p', input.prompt,
    '--cfg-scale', CFG,
    '--sampling-method', SAMPLER,
    '--steps', String(STEPS),
    '-W', String(input.w),
    '-H', String(input.h),
    '--seed', String(input.seed),
    '-o', opt.out,
  ];
  if (input.mode === 'restyle') args.push('-r', opt.ref);
  if (opt.offload) args.push('--offload-to-cpu');
  if (opt.vaeTiling) args.push('--vae-tiling');
  return args;
}

// ---------------------------------------------------------------- GPU (VRAM) detection helpers

// `reg query HKLM\SYSTEM\ControlSet001\Control\Class\{4d36e968-...} /s` output -> [{name, vramMB}]
function parseRegGpus(text) {
  const out = [];
  let cur = null;
  for (const line of String(text || '').split(/\r?\n/)) {
    if (/^HKEY_/i.test(line)) {
      const m = /\\(\d{4})$/.exec(line.trim());
      cur = m ? { key: m[1], name: '', vramMB: 0 } : null;
      if (cur) out.push(cur);
      continue;
    }
    if (!cur) continue;
    let m = /^\s+DriverDesc\s+REG_SZ\s+(.+)$/i.exec(line);
    if (m) { cur.name = m[1].trim(); continue; }
    m = /^\s+HardwareInformation\.qwMemorySize\s+REG_QWORD\s+0x([0-9a-f]+)/i.exec(line);
    if (m) { cur.vramMB = Math.round(Number(BigInt('0x' + m[1]) / 1048576n)); continue; }
    m = /^\s+HardwareInformation\.MemorySize\s+REG_(?:DWORD|BINARY)\s+(?:0x)?([0-9a-f]+)/i.exec(line);
    if (m && !cur.vramMB) {
      const v = /REG_DWORD/i.test(line) ? parseInt(m[1], 16) : 0;
      if (v > 0) cur.vramMB = Math.round(v / 1048576);
    }
  }
  return out.filter((g) => g.name).map((g) => ({ name: g.name, vramMB: g.vramMB }));
}

// `nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits`
function parseNvidiaSmi(text) {
  return String(text || '').split(/\r?\n/).map((l) => l.split(',').map((s) => s.trim())).filter((p) => p.length >= 2 && p[0] && /^\d+$/.test(p[1]))
    .map((p) => ({ name: p[0], vramMB: Number(p[1]) }));
}

function speedFor(gpu, variant) {
  if (variant === 'cpu') return 'slow';
  return gpu && gpu.vramMB >= 6 * 1024 ? 'fast' : 'slow';
}

// ---------------------------------------------------------------- zip extraction (no dependency)

let CRC_TABLE = null;
function crc32(buf) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf) >>> 0;
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC_TABLE[n] = c >>> 0; }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function readZip64Extra(extra, need) {
  // need: which fields are 0xffffffff, in order usize, csize, offset
  let i = 0;
  while (i + 4 <= extra.length) {
    const id = extra.readUInt16LE(i), len = extra.readUInt16LE(i + 2);
    if (id === 0x0001) {
      const r = {}; let j = i + 4;
      for (const k of need) { if (j + 8 > i + 4 + len) break; r[k] = Number(extra.readBigUInt64LE(j)); j += 8; }
      return r;
    }
    i += 4 + len;
  }
  return {};
}

// Extracts every file of the zip into destDir. Rejects absolute paths and ../ escapes. Methods: stored, deflate.
async function extractZip(zipPath, destDir) {
  const buf = await fsp.readFile(zipPath);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('zip: no end of central directory');
  let count = buf.readUInt16LE(eocd + 10), cdOff = buf.readUInt32LE(eocd + 16);
  if (count === 0xffff || cdOff === 0xffffffff) {
    const loc = eocd - 20;
    if (loc >= 0 && buf.readUInt32LE(loc) === 0x07064b50) {
      const z64 = Number(buf.readBigUInt64LE(loc + 8));
      if (buf.readUInt32LE(z64) !== 0x06064b50) throw new Error('zip64: bad record');
      count = Number(buf.readBigUInt64LE(z64 + 32)); cdOff = Number(buf.readBigUInt64LE(z64 + 48));
    }
  }
  const root = path.resolve(destDir);
  await fsp.mkdir(root, { recursive: true });
  const written = [];
  let p = cdOff;
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('zip: bad central directory');
    const flags = buf.readUInt16LE(p + 8), method = buf.readUInt16LE(p + 10), crc = buf.readUInt32LE(p + 16);
    let csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const extAttr = buf.readUInt32LE(p + 38);
    let lho = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nameLen).toString(flags & 0x800 ? 'utf8' : 'latin1');
    const need = [];
    if (usize === 0xffffffff) need.push('usize');
    if (csize === 0xffffffff) need.push('csize');
    if (lho === 0xffffffff) need.push('lho');
    if (need.length) {
      const z = readZip64Extra(buf.slice(p + 46 + nameLen, p + 46 + nameLen + extraLen), need);
      if (z.usize != null) usize = z.usize; if (z.csize != null) csize = z.csize; if (z.lho != null) lho = z.lho;
    }
    p += 46 + nameLen + extraLen + commentLen;

    const rel = name.replace(/\\/g, '/');
    if (rel.endsWith('/')) continue;   // directory entry
    if (!rel || rel.startsWith('/') || /^[a-zA-Z]:/.test(rel) || rel.split('/').some((s) => s === '..')) throw new Error('zip: unsafe path ' + rel);
    const out = path.resolve(root, rel);
    if (!out.startsWith(root + path.sep)) throw new Error('zip: unsafe path ' + rel);
    if (flags & 1) throw new Error('zip: encrypted entry');

    if (buf.readUInt32LE(lho) !== 0x04034b50) throw new Error('zip: bad local header');
    const start = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
    const raw = buf.slice(start, start + csize);
    let data;
    if (method === 0) data = raw;
    else if (method === 8) data = zlib.inflateRawSync(raw);
    else throw new Error('zip: unsupported method ' + method + ' for ' + rel);
    if (data.length !== usize) throw new Error('zip: size mismatch for ' + rel);
    if (crc32(data) !== crc) throw new Error('zip: crc mismatch for ' + rel);
    await fsp.mkdir(path.dirname(out), { recursive: true });
    await fsp.writeFile(out, data);
    const mode = (extAttr >>> 16) & 0o777;
    if (process.platform !== 'win32' && mode & 0o111) await fsp.chmod(out, mode | 0o600).catch(() => {});
    written.push(rel);
  }
  return written;
}

// sd-cli (current releases) or sd (older releases), anywhere in the extracted tree
function findBinary(dir, platform) {
  const names = platform === 'win32' ? ['sd-cli.exe', 'sd.exe'] : ['sd-cli', 'sd'];
  const found = {};
  (function walk(d, depth) {
    if (depth > 4) return;
    let list = [];
    try { list = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of list) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full, depth + 1);
      else if (names.includes(e.name) && !found[e.name]) found[e.name] = full;
    }
  })(dir, 0);
  for (const n of names) if (found[n]) return found[n];
  return '';
}

// ---------------------------------------------------------------- the engine

function createEngine(options) {
  const opt = Object.assign({}, DEFAULTS, options || {});
  const root = path.resolve(opt.root);
  const platform = opt.platform || process.platform;
  const doFetch = opt.fetch || globalThis.fetch;
  const log = opt.log || (() => {});
  const P = {
    manifest: path.join(root, 'manifest.json'),
    engine: path.join(root, 'engine'),
    models: path.join(root, 'models'),
    downloads: path.join(root, 'downloads'),
  };

  let installing = null;     // { ctl, cancelled, progress }
  let lastError = '';
  let gpuHint = null;        // { name, vramMB }
  let current = null;        // running child { child, cancelled, timedOut }
  let queue = Promise.resolve();
  let queued = 0;
  let generation = 0;        // bumped by cancel(): queued runs from before the cancel do not start

  function readManifest() {
    try {
      const m = JSON.parse(fs.readFileSync(P.manifest, 'utf8'));
      if (m && m.version === MANIFEST_VERSION && m.engine && m.files) return m;
    } catch { /* none */ }
    return null;
  }

  function modelPath(key, m) { return path.join(P.models, path.basename(m.files[key].local)); }

  function checkInstalled(m) {
    if (!m) return { ok: false, why: 'not-installed' };
    const bin = path.join(P.engine, m.engine.bin || '');
    if (!m.engine.bin || !bin.startsWith(P.engine + path.sep) || !fs.existsSync(bin)) return { ok: false, why: 'engine-missing' };
    for (const k of ['diffusion', 'llm', 'vae']) {
      const f = m.files[k];
      if (!f) return { ok: false, why: k + '-missing' };
      try { const st = fs.statSync(modelPath(k, m)); if (f.size && st.size !== f.size) return { ok: false, why: k + '-size' }; } catch { return { ok: false, why: k + '-missing' }; }
    }
    return { ok: true, bin };
  }

  function status() {
    const m = readManifest();
    const chk = checkInstalled(m);
    let state = 'none';
    if (installing) state = 'installing';
    else if (chk.ok) state = 'ready';
    else if (lastError) state = 'error';
    else if (m || fs.existsSync(P.downloads)) state = 'partial';
    let bytes = 0;
    if (m) for (const k of ['diffusion', 'llm', 'vae']) bytes += (m.files[k] && m.files[k].size) || 0;
    return {
      state,
      ready: chk.ok && !installing,
      why: chk.ok ? '' : chk.why,
      error: lastError,
      progress: installing ? installing.progress : null,
      running: !!current,
      queued,
      engine: m ? { variant: m.engine.variant, tag: m.engine.tag, asset: m.engine.asset } : null,
      files: m ? Object.fromEntries(Object.entries(m.files).map(([k, f]) => [k, { repo: f.repo, path: f.path, size: f.size }])) : null,
      bytes,
      model: MODEL_ID,
      platform,
      supported: !!ASSET_PATTERNS[platform] && (platform !== 'win32' || process.arch === 'x64' || opt.anyArch === true),
    };
  }

  // ---------- HTTP
  async function getJson(url, signal) {
    const r = await doFetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'FrameStudio-Desktop' }, signal });
    if (!r.ok) { const e = new Error('http-' + r.status + ' ' + url); e.status = r.status; throw e; }
    const link = r.headers && r.headers.get ? r.headers.get('link') : '';
    const json = await r.json();
    return { json, next: nextLink(link) };
  }
  function nextLink(link) {
    const m = /<([^>]+)>;\s*rel="?next"?/i.exec(String(link || ''));
    return m ? m[1] : '';
  }
  async function hfTree(repo, signal) {
    let url = opt.hfBase + '/api/models/' + repo + '/tree/main?recursive=true&expand=false';
    let all = [];
    for (let page = 0; url && page < 20; page++) {
      const { json, next } = await getJson(url, signal);
      if (!Array.isArray(json)) break;
      all = all.concat(json);
      url = next;
    }
    if (!all.length) {
      // older API shape: model info with siblings (no sizes unless ?blobs=true)
      const { json } = await getJson(opt.hfBase + '/api/models/' + repo + '?blobs=true', signal);
      return json;
    }
    return all;
  }
  function hfUrl(repo, file) { return opt.hfBase + '/' + repo + '/resolve/main/' + file.split('/').map(encodeURIComponent).join('/'); }

  async function probeUrl(url, signal) {
    try {
      const r = await doFetch(url, { headers: { Range: 'bytes=0-0', 'User-Agent': 'FrameStudio-Desktop' }, signal });
      try { if (r.body && r.body.cancel) await r.body.cancel(); } catch { /* ignore */ }
      return r.status === 200 || r.status === 206;
    } catch (e) { if (signal && signal.aborted) throw e; return false; }
  }

  async function discoverModel(kind, signal) {
    const src = SOURCES[kind];
    const tried = [];
    let net = 0;
    for (const c of src.candidates) {
      let tree;
      try { tree = await hfTree(c.repo, signal); } catch (e) { if (signal.aborted) throw e; if (!e.status) net++; tried.push(c.repo + ' (' + (e.status ? 'http ' + e.status : 'network') + ')'); continue; }
      const f = pickFile(kind, tree, c.dir, opt.anySize === true);   // anySize: tests only
      if (!f) { tried.push(c.repo + ' (no matching file)'); continue; }
      const url = hfUrl(c.repo, f.path);
      if (!(await probeUrl(url, signal))) { tried.push(c.repo + '/' + f.path + ' (download refused)'); continue; }
      return { key: kind, label: src.label, repo: c.repo, path: f.path, url, size: f.size, sha256: f.sha256, local: path.basename(f.path) };
    }
    const e = new Error((net === src.candidates.length ? 'offline:' : 'not-found:') + kind + ': ' + tried.join('; '));
    e.code = net === src.candidates.length ? 'offline' : 'not-found'; e.kind = kind;
    throw e;
  }

  async function discoverEngine(variant, signal) {
    const { json } = await getJson(opt.ghApi + '/repos/' + opt.ghRepo + '/releases/latest', signal);
    const a = pickReleaseAsset(json, platform, variant);
    if (!a) {
      const e = new Error('not-found:engine-' + variant + ': no release asset for ' + platform + ' in ' + (json && json.tag_name));
      e.code = 'not-found'; e.kind = 'engine'; throw e;
    }
    return { key: 'engine', label: 'מנוע stable-diffusion.cpp (' + (variant === 'cpu' ? 'מעבד' : 'כרטיס מסך') + ')', url: a.url, size: a.size, sha256: a.sha256, local: a.name, tag: a.tag, variant };
  }

  // Resumable download into downloads/<name>.part, then verified (size, sha256 when known) and moved to dest.
  async function download(item, dest, signal, onBytes) {
    await fsp.mkdir(P.downloads, { recursive: true });
    const part = path.join(P.downloads, path.basename(dest) + '.part');
    let have = 0;
    try { have = (await fsp.stat(part)).size; } catch { have = 0; }
    if (item.size && have > item.size) { await fsp.rm(part, { force: true }); have = 0; }
    let hash = crypto.createHash('sha256');
    if (have > 0) {
      // the hash has to cover the bytes already on disk
      await new Promise((ok, bad) => { fs.createReadStream(part).on('data', (d) => hash.update(d)).on('end', ok).on('error', bad); });
    }
    onBytes(have);
    if (!item.size || have < item.size) {
      const headers = { 'User-Agent': 'FrameStudio-Desktop' };
      if (have > 0) headers.Range = 'bytes=' + have + '-';
      const r = await doFetch(item.url, { headers, signal, redirect: 'follow' });
      if (r.status === 200 && have > 0) {
        // the server ignored the Range: this answer is the whole file, start the part over
        have = 0; hash = crypto.createHash('sha256'); onBytes(0);
      }
      if (r.status !== 200 && r.status !== 206) {
        try { if (r.body && r.body.cancel) await r.body.cancel(); } catch { /* ignore */ }
        const e = new Error('http-' + r.status + ' ' + item.url); e.status = r.status; throw e;
      }
      if (r.status === 206) {
        const cr = r.headers.get('content-range') || '';
        const m = /bytes\s+(\d+)-/.exec(cr);
        if (m && Number(m[1]) !== have) throw new Error('bad content-range ' + cr);
      }
      const out = fs.createWriteStream(part, { flags: have > 0 ? 'a' : 'w' });
      const done = new Promise((ok, bad) => { out.on('finish', ok); out.on('error', bad); });
      try {
        const reader = r.body.getReader();
        for (;;) {
          const { done: end, value } = await reader.read();
          if (end) break;
          const chunk = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
          hash.update(chunk); have += chunk.length; onBytes(have);
          if (item.size && have > item.size) throw new Error('more data than expected for ' + item.local);
          if (!out.write(chunk)) await new Promise((ok) => out.once('drain', ok));
        }
      } finally { out.end(); await done.catch(() => {}); }
    }
    const st = await fsp.stat(part);
    if (item.size && st.size !== item.size) throw new Error('size mismatch for ' + item.local + ': ' + st.size + ' != ' + item.size);
    if (item.sha256) {
      const got = hash.digest('hex');
      if (got !== item.sha256) { await fsp.rm(part, { force: true }); throw new Error('sha256 mismatch for ' + item.local); }
    }
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.rm(dest, { force: true });
    await fsp.rename(part, dest);
    return st.size;
  }

  function runQuiet(bin, args, ms) {
    return new Promise((resolve) => {
      execFile(bin, args, { cwd: path.dirname(bin), windowsHide: true, timeout: ms || 20000, maxBuffer: 1 << 20 }, (err, stdout, stderr) => {
        resolve({ code: err ? (typeof err.code === 'number' ? err.code : -1) : 0, out: String(stdout || '') + String(stderr || '') });
      });
    });
  }

  // After installing the Vulkan build: does it see a GPU? `--list-devices` prints "name<TAB>description" per device.
  async function probeVulkan(bin) {
    const r = await runQuiet(bin, ['--list-devices'], 30000);
    if (/unknown argument|invalid argument|unrecognized/i.test(r.out)) return { ok: true, unknown: true, out: r.out };   // older build: can't tell
    if (r.code !== 0) return { ok: false, out: r.out };
    const lines = r.out.split(/\r?\n/);
    const ok = lines.some((l) => /^(vulkan|cuda|rocm|metal)\d*\t/i.test(l)) ||
      (/vulkan/i.test(r.out) && !/no vulkan devices|vulkan.*(not found|failed|error)/i.test(r.out));
    return { ok, out: r.out };
  }

  async function installEngine(variant, signal, report) {
    const item = await discoverEngine(variant, signal);
    report.add(item);
    const zip = path.join(P.downloads, path.basename(item.local));
    await download(item, zip, signal, (b) => report.bytes(item.key, b));
    report.phase('extract', item.key);
    const tmp = path.join(root, 'engine.new');
    await fsp.rm(tmp, { recursive: true, force: true });
    await extractZip(zip, tmp);
    const bin = findBinary(tmp, platform);
    if (!bin) throw new Error('engine: sd-cli not found in ' + item.local);
    if (platform !== 'win32') await fsp.chmod(bin, 0o755).catch(() => {});
    await fsp.rm(P.engine, { recursive: true, force: true });
    await fsp.rename(tmp, P.engine);
    await fsp.rm(zip, { force: true });
    return { variant, tag: item.tag, asset: item.local, bin: path.relative(tmp, bin) };
  }

  async function install(onProgress, o) {
    if (installing) throw Object.assign(new Error('already installing'), { code: 'busy' });
    if (current) throw Object.assign(new Error('a picture is being made'), { code: 'busy' });
    const want = o && o.variant === 'cpu' ? 'cpu' : (o && o.variant) === 'vulkan' ? 'vulkan' : '';
    const ctl = new AbortController();
    installing = { ctl, cancelled: false, progress: { phase: 'plan', files: [], done: 0, total: 0 } };
    lastError = '';
    const prog = installing.progress;
    let lastEmit = 0;
    const emit = (force) => {
      const now = Date.now();
      if (!force && now - lastEmit < 250) return;
      lastEmit = now;
      prog.done = prog.files.reduce((s, f) => s + f.done, 0);
      prog.total = prog.files.reduce((s, f) => s + (f.total || 0), 0);
      try { onProgress && onProgress(JSON.parse(JSON.stringify(prog))); } catch { /* renderer gone */ }
    };
    const report = {
      add(item) { if (!prog.files.find((f) => f.key === item.key)) prog.files.push({ key: item.key, label: item.label, total: item.size || 0, done: 0, name: item.local }); emit(true); },
      bytes(key, b) { const f = prog.files.find((x) => x.key === key); if (f) f.done = b; emit(false); },
      phase(p, key) { prog.phase = p; prog.current = key || ''; emit(true); },
    };
    const signal = ctl.signal;
    try {
      await fsp.mkdir(P.models, { recursive: true });
      const old = readManifest();
      // 1. plan: find every file first, so a missing file is reported before gigabytes are downloaded
      report.phase('plan');
      const found = {};
      for (const k of ['diffusion', 'llm', 'vae']) {
        const prev = old && old.files[k];
        if (prev && fs.existsSync(path.join(P.models, path.basename(prev.local))) && fs.statSync(path.join(P.models, path.basename(prev.local))).size === prev.size) {
          found[k] = Object.assign({ key: k, label: SOURCES[k].label, keep: true }, prev);
        } else found[k] = await discoverModel(k, signal);
      }
      const variant = want || (old && old.engine && old.engine.variant) || (platform === 'darwin' ? 'cpu' : 'vulkan');
      // the engine stays when it is there and no other build was asked for (e.g. only a model file went missing)
      const keepEngine = !!(!want && old && old.engine && old.engine.bin && fs.existsSync(path.join(P.engine, old.engine.bin)));
      for (const k of ['diffusion', 'llm', 'vae']) report.add(found[k]);
      for (const k of ['diffusion', 'llm', 'vae']) if (found[k].keep) report.bytes(k, found[k].size);

      // disk space: everything still to download + 1 GB slack
      const need = ['diffusion', 'llm', 'vae'].reduce((s, k) => s + (found[k].keep ? 0 : found[k].size || 0), 0) + 1e9 + (keepEngine ? 0 : 3e8);
      if (fsp.statfs) {
        try {
          const sf = await fsp.statfs(root);
          const free = Number(sf.bavail) * Number(sf.bsize);
          if (free && free < need) throw Object.assign(new Error('disk-full: need ' + Math.ceil(need / 1e9) + ' GB, free ' + (free / 1e9).toFixed(1) + ' GB'), { code: 'disk-full' });
        } catch (e) { if (e.code === 'disk-full') throw e; }
      }

      // 2. engine
      let engine = old && old.engine;
      if (!keepEngine) {
        report.phase('download', 'engine');
        engine = await installEngine(variant, signal, report);
        if (engine.variant === 'vulkan' && platform !== 'darwin') {
          report.phase('probe', 'engine');
          const pr = await probeVulkan(path.join(P.engine, engine.bin));
          if (!pr.ok && !want) {
            log('local-ai: vulkan probe failed, installing the CPU build: ' + pr.out.slice(-400));
            prog.files = prog.files.filter((f) => f.key !== 'engine');
            engine = await installEngine('cpu', signal, report);
            engine.fellBack = true;
          } else engine.gpuSeen = pr.ok && !pr.unknown;
        }
      }

      // 3. models
      const files = {};
      for (const k of ['diffusion', 'llm', 'vae']) {
        const f = found[k];
        if (!f.keep) {
          report.phase('download', k);
          await download(f, path.join(P.models, f.local), signal, (b) => report.bytes(k, b));
        }
        files[k] = { repo: f.repo, path: f.path, size: f.size || fs.statSync(path.join(P.models, f.local)).size, sha256: f.sha256 || '', local: f.local };
      }
      // models of an earlier install that are not used any more
      if (old) for (const k of Object.keys(old.files)) {
        if (files[k] && files[k].local !== old.files[k].local) await fsp.rm(path.join(P.models, path.basename(old.files[k].local)), { force: true });
      }
      const manifest = { version: MANIFEST_VERSION, model: MODEL_ID, engine, files, installedAt: new Date().toISOString() };
      await fsp.writeFile(P.manifest + '.tmp', JSON.stringify(manifest, null, 2));
      await fsp.rename(P.manifest + '.tmp', P.manifest);
      await fsp.rm(P.downloads, { recursive: true, force: true });
      report.phase('done');
      emit(true);
      return { ok: true, status: (installing = null, status()) };
    } catch (e) {
      const cancelled = installing && installing.cancelled;
      lastError = cancelled ? '' : String(e && e.message || e);
      log('local-ai install: ' + (cancelled ? 'cancelled' : lastError));
      installing = null;
      return { ok: false, error: cancelled ? 'cancelled' : e && e.code === 'not-found' ? 'not-found' : e && e.code === 'disk-full' ? 'disk-full' : e && e.code === 'offline' ? 'offline' : e && !e.status && /fetch failed|ENOTFOUND|EAI_AGAIN|ECONN|ETIMEDOUT|network|ERR_INTERNET|ERR_NAME/i.test(String(e.message) + ' ' + String(e.cause && e.cause.code)) ? 'offline' : 'install-failed', detail: lastError, status: status() };
    }
  }

  function cancelInstall() {
    if (!installing) return false;
    installing.cancelled = true;
    installing.ctl.abort();
    return true;
  }

  async function remove() {
    cancelInstall();
    cancel();
    for (let i = 0; i < 40 && (installing || current); i++) await new Promise((r) => setTimeout(r, 100));
    await fsp.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
    lastError = '';
    return status();
  }

  // ---------- running
  function setGpuHint(g) { gpuHint = g && typeof g === 'object' ? { name: String(g.name || ''), vramMB: Number(g.vramMB) || 0 } : null; }

  function runOnce(bin, m, input, onProgress, flags) {
    return new Promise((resolve) => {
      const t0 = Date.now();
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-local-ai-'));
      const out = path.join(dir, 'out.png');
      const ref = input.image ? path.join(dir, 'in' + input.ext) : '';
      if (ref) fs.writeFileSync(ref, input.image);
      const files = { diffusion: modelPath('diffusion', m), llm: modelPath('llm', m), vae: modelPath('vae', m) };
      const args = buildArgs(files, input, { out, ref, offload: flags.offload, vaeTiling: flags.vaeTiling });
      const feed = createProgressParser(STEPS);
      let tail = '';
      let child;
      try {
        child = spawn(bin, args, { cwd: path.dirname(bin), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], shell: false });
      } catch (e) {
        fs.rmSync(dir, { recursive: true, force: true });
        return resolve({ ok: false, error: 'local-failed', detail: String(e.message || e) });
      }
      const job = { child, cancelled: false, timedOut: false };
      current = job;
      const timer = setTimeout(() => { job.timedOut = true; try { child.kill(); } catch { /* gone */ } }, opt.timeoutMs || RUN_TIMEOUT_MS);
      const onData = (d) => {
        const s = d.toString('utf8');
        tail = (tail + s).slice(-6000);
        const p = feed(s);
        if (p) { try { onProgress && onProgress(p); } catch { /* ignore */ } }
      };
      child.stdout.on('data', onData);
      child.stderr.on('data', onData);
      let finished = false;
      const finish = (code, err) => {
        if (finished) return; finished = true;
        clearTimeout(timer);
        if (current === job) current = null;
        let res;
        if (job.cancelled) res = { ok: false, error: 'cancelled' };
        else if (job.timedOut) res = { ok: false, error: 'timeout' };
        else {
          let png = null;
          try { png = fs.readFileSync(out); } catch { png = null; }
          if (code === 0 && png && png.length > 8 && png.readUInt32BE(0) === 0x89504e47) {
            res = { ok: true, image: png.toString('base64'), mime: 'image/png', ms: Date.now() - t0, model: MODEL_ID, seed: input.seed };
          } else {
            const clean = tail.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').split(/[\r\n]+/).filter((l) => l.trim() && !/\d+\/\d+\s*-\s*[\d.]+/.test(l)).slice(-8).join('\n');
            res = { ok: false, error: 'local-failed', detail: (err ? String(err.message || err) + '\n' : '') + clean, code };
            if (/out of memory|ErrorOutOfDeviceMemory|VK_ERROR|alloc(ate)?.*fail|failed to allocate|cudaMalloc|ggml_vulkan/i.test(clean)) res.gpu = true;
          }
        }
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp dir */ }
        resolve(res);
      };
      child.on('error', (e) => finish(-1, e));
      child.on('close', (code) => finish(code));
    });
  }

  function run(o, onProgress) {
    const input = validateRunInput(o);
    if (input.error) return Promise.resolve({ ok: false, error: input.error, detail: input.detail });
    const gen = generation;
    queued++;
    const p = queue.then(async () => {
      queued--;
      if (gen !== generation) return { ok: false, error: 'cancelled' };
      if (installing) return { ok: false, error: 'busy', detail: 'installing' };
      const m = readManifest();
      const chk = checkInstalled(m);
      if (!chk.ok) return { ok: false, error: 'not-installed', detail: chk.why };
      const cpu = m.engine.variant === 'cpu';
      const vram = gpuHint ? gpuHint.vramMB : 0;
      // weights ~5 GB: keep them in RAM and move them in as needed unless the card clearly has room
      const flags = { offload: !cpu && !(vram >= 10 * 1024), vaeTiling: !cpu && !(vram >= 8 * 1024) };
      try { onProgress && onProgress({ pct: 1, phase: 'start' }); } catch { /* ignore */ }
      let r = await runOnce(chk.bin, m, input, onProgress, flags);
      if (!r.ok && r.gpu && !(flags.offload && flags.vaeTiling) && gen === generation) {
        // ran out of video memory: once more with everything that saves VRAM
        r = await runOnce(chk.bin, m, input, onProgress, { offload: true, vaeTiling: true });
      }
      if (!r.ok && r.error === 'local-failed' && m.engine.variant === 'vulkan') r.suggestCpu = true;
      return r;
    });
    queue = p.catch(() => {});
    return p;
  }

  function cancel() {
    generation++;
    if (current) {
      current.cancelled = true;
      try { current.child.kill(); } catch { /* gone */ }
      return true;
    }
    return false;
  }

  function shutdown() { cancelInstall(); cancel(); }

  return { status, install, cancelInstall, remove, run, cancel, shutdown, setGpuHint, paths: P, _discoverModel: discoverModel, _discoverEngine: discoverEngine };
}

module.exports = {
  createEngine,
  // exported for tests
  pickFile, pickReleaseAsset, normalizeTree, quantRank, createProgressParser, validateRunInput, buildArgs,
  extractZip, findBinary, parseRegGpus, parseNvidiaSmi, speedFor, crc32, SOURCES, ASSET_PATTERNS, MODEL_ID, STEPS,
};
