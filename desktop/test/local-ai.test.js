// Tests of the local AI engine (desktop/local-ai.js) without Electron, Hugging Face or GitHub:
// pure discovery functions against fixtures shaped like the real APIs, the zip extractor, and a full
// install + run against a local mock server and a fake sd-cli (test/fake-sd-cli.js). Linux/macOS only (the fake is a
// Node script with a shebang). Run: node --test test/  (or npm run test:local-ai)
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const L = require('../local-ai');

const FIX = path.join(__dirname, 'fixtures');
const fx = (n) => JSON.parse(fs.readFileSync(path.join(FIX, n), 'utf8'));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'local-ai-test-'));
process.on('exit', () => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* ignore */ } });

// ---------------------------------------------------------------- pure functions

test('picks the diffusion GGUF by quant preference', () => {
  const f = L.pickFile('diffusion', fx('hf-tree-flux2-klein-gguf.json'));
  assert.equal(f.path, 'flux-2-klein-4b-Q4_K.gguf');
  assert.equal(f.size, 2502000000);
  assert.match(f.sha256, /^[0-9a-f]{64}$/);
});

test('picks Qwen3-4B Q4_K_M, not the UD build', () => {
  const f = L.pickFile('llm', fx('hf-tree-qwen3-4b-gguf.json'));
  assert.equal(f.path, 'Qwen3-4B-Q4_K_M.gguf');
});

test('finds the VAE in a Comfy-Org split_files tree, not the text encoder', () => {
  const f = L.pickFile('vae', fx('hf-tree-comfy-flux2-klein-4b.json'), 'split_files/vae');
  assert.equal(f.path, 'split_files/vae/flux2-vae.safetensors');
  assert.equal(f.size, 336213556);
  assert.equal(L.pickFile('vae', fx('hf-tree-flux2-klein-gguf.json')), null);
  assert.equal(L.pickFile('diffusion', fx('hf-tree-comfy-flux2-klein-4b.json')), null);
});

test('reads the model-info "siblings" shape too', () => {
  const f = L.pickFile('vae', fx('hf-model-siblings.json'));
  assert.equal(f.path, 'split_files/vae/flux2-vae.safetensors');
  assert.equal(f.sha256, '');   // not a sha256 -> no hash check, size check only
});

test('size limits reject wrong files', () => {
  const tree = [{ type: 'file', path: 'flux-2-klein-4b-Q4_0.gguf', size: 1000 }];
  assert.equal(L.pickFile('diffusion', tree), null);
  assert.equal(L.pickFile('diffusion', tree, '', true).path, 'flux-2-klein-4b-Q4_0.gguf');
});

test('release assets: vulkan and cpu per platform, old naming', () => {
  const rel = fx('gh-release-latest.json');
  assert.equal(L.pickReleaseAsset(rel, 'win32', 'vulkan').name, 'sd-master-abc1234-bin-win-vulkan-x64.zip');
  assert.equal(L.pickReleaseAsset(rel, 'win32', 'vulkan').sha256, '4'.repeat(64));
  assert.equal(L.pickReleaseAsset(rel, 'win32', 'cpu').name, 'sd-master-abc1234-bin-win-cpu-x64.zip');
  assert.equal(L.pickReleaseAsset(rel, 'linux', 'vulkan').name, 'sd-master-abc1234-bin-Linux-Ubuntu-24.04-x86_64-vulkan.zip');
  assert.equal(L.pickReleaseAsset(rel, 'linux', 'cpu').name, 'sd-master-abc1234-bin-Linux-Ubuntu-24.04-x86_64.zip');
  assert.equal(L.pickReleaseAsset(rel, 'darwin', 'vulkan').name, 'sd-master-abc1234-bin-Darwin-macOS-15.6-arm64.zip');
  const old = fx('gh-release-old.json');
  assert.equal(L.pickReleaseAsset(old, 'win32', 'cpu').name, 'sd-master-1c32fa0-bin-win-avx2-x64.zip');
  assert.equal(L.pickReleaseAsset({ assets: [] }, 'win32', 'vulkan'), null);
});

test('progress parser: load, sample, decode, never backwards', () => {
  const feed = L.createProgressParser(4);
  const seen = [];
  const push = (s) => { const p = feed(s); if (p) seen.push(p.pct); };
  push('[INFO ] loading\n\r|################                  | 1/3 - 850.50MB/s\x1b[K');
  push('\r|##################################| 3/3 - 2.10GB/s\x1b[K\n');
  push('\r|============>                     | 1/4 - 3.21s/it\x1b[K');
  push('\r|=========================>        | 3/4 - 1.50it/s\x1b[K');
  push('\r|==================================| 4/4 - 3.00s/it\x1b[K\n');
  push('\r|======>  | 1/6 - 0.50s/it\x1b[K\r|=====| 6/6 - 0.40s/it\x1b[K');
  push('\r|########| 2/3 - 900.00MB/s\x1b[K');   // loading lines after sampling are ignored
  assert.deepEqual(seen, [10, 25, 45, 75, 90, 92, 99]);
});

test('input validation', () => {
  const ok = { mode: 'image', prompt: 'a cat', w: 1024, h: 768 };
  assert.equal(L.validateRunInput(ok).error, undefined);
  assert.equal(L.validateRunInput({ ...ok, w: 1000 }).error, 'bad-input');
  assert.equal(L.validateRunInput({ ...ok, w: 240 }).error, 'bad-input');
  assert.equal(L.validateRunInput({ ...ok, h: 1552 }).error, 'bad-input');
  assert.equal(L.validateRunInput({ ...ok, mode: 'shell' }).error, 'bad-input');
  assert.equal(L.validateRunInput({ ...ok, prompt: 'x'.repeat(2001) }).error, 'bad-input');
  assert.equal(L.validateRunInput({ ...ok, prompt: '   ' }).error, 'bad-input');
  assert.equal(L.validateRunInput({ ...ok, seed: -5 }).error, 'bad-input');
  assert.equal(L.validateRunInput({ ...ok, prompt: '--output /etc/passwd' }).prompt, 'output /etc/passwd');
  assert.equal(L.validateRunInput({ ...ok, mode: 'restyle' }).error, 'bad-input');
  assert.equal(L.validateRunInput({ ...ok, mode: 'restyle', imageB64: Buffer.from('GIF89a....').toString('base64') }).error, 'bad-input');
  assert.equal(L.validateRunInput({ ...ok, mode: 'restyle', imageB64: 'not base64!!' }).error, 'bad-input');
  const r = L.validateRunInput({ ...ok, mode: 'restyle', imageB64: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString('base64') });
  assert.equal(r.ext, '.jpg');
});

test('exact sd-cli arguments', () => {
  const input = L.validateRunInput({ mode: 'restyle', prompt: 'make it a watercolor', w: 1024, h: 768, seed: 7, imageB64: Buffer.from([0xff, 0xd8, 0xff, 0]).toString('base64') });
  const a = L.buildArgs({ diffusion: 'D.gguf', llm: 'L.gguf', vae: 'V.safetensors' }, input, { out: 'o.png', ref: 'i.jpg', offload: true, vaeTiling: true });
  assert.deepEqual(a, ['--diffusion-model', 'D.gguf', '--vae', 'V.safetensors', '--llm', 'L.gguf', '-p', 'make it a watercolor',
    '--cfg-scale', '1.0', '--sampling-method', 'euler', '--steps', '4', '-W', '1024', '-H', '768', '--seed', '7', '-o', 'o.png',
    '-r', 'i.jpg', '--offload-to-cpu', '--vae-tiling']);
});

test('GPU parsing (reg.exe, nvidia-smi) and speed', () => {
  const reg = [
    'HKEY_LOCAL_MACHINE\\SYSTEM\\ControlSet001\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\0000',
    '    DriverDesc    REG_SZ    NVIDIA GeForce RTX 3060',
    '    HardwareInformation.qwMemorySize    REG_QWORD    0x300000000',
    '',
    'HKEY_LOCAL_MACHINE\\SYSTEM\\ControlSet001\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\0000\\Settings',
    '    Foo    REG_SZ    bar',
    'HKEY_LOCAL_MACHINE\\SYSTEM\\ControlSet001\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\0001',
    '    DriverDesc    REG_SZ    Intel(R) UHD Graphics 630',
    '    HardwareInformation.MemorySize    REG_DWORD    0x40000000',
    'ERROR: Access is denied.',
  ].join('\r\n');
  assert.deepEqual(L.parseRegGpus(reg), [{ name: 'NVIDIA GeForce RTX 3060', vramMB: 12288 }, { name: 'Intel(R) UHD Graphics 630', vramMB: 1024 }]);
  assert.deepEqual(L.parseNvidiaSmi('NVIDIA GeForce RTX 4070, 12282\n'), [{ name: 'NVIDIA GeForce RTX 4070', vramMB: 12282 }]);
  assert.equal(L.speedFor({ vramMB: 8192 }, 'vulkan'), 'fast');
  assert.equal(L.speedFor({ vramMB: 4096 }, 'vulkan'), 'slow');
  assert.equal(L.speedFor(null, 'vulkan'), 'slow');
  assert.equal(L.speedFor({ vramMB: 24576 }, 'cpu'), 'slow');
});

// ---------------------------------------------------------------- zip extractor

test('zip: deflate (zip CLI), stored + zip64 (python), unsafe paths rejected', async () => {
  const src = path.join(TMP, 'zsrc'); fs.mkdirSync(path.join(src, 'bin'), { recursive: true });
  fs.writeFileSync(path.join(src, 'bin', 'a.txt'), 'hello '.repeat(1000));
  fs.copyFileSync(path.join(__dirname, 'fake-sd-cli.js'), path.join(src, 'bin', 'sd-cli')); fs.chmodSync(path.join(src, 'bin', 'sd-cli'), 0o755);
  const z1 = path.join(TMP, 'z1.zip');
  execFileSync('zip', ['-qr', z1, 'bin'], { cwd: src });
  const out1 = path.join(TMP, 'zout1');
  const w = await L.extractZip(z1, out1);
  assert.deepEqual(w.sort(), ['bin/a.txt', 'bin/sd-cli']);
  assert.equal(fs.readFileSync(path.join(out1, 'bin', 'a.txt'), 'utf8'), 'hello '.repeat(1000));
  assert.ok(fs.statSync(path.join(out1, 'bin', 'sd-cli')).mode & 0o100, 'keeps the executable bit');
  assert.equal(L.findBinary(out1, 'linux'), path.join(out1, 'bin', 'sd-cli'));

  const z2 = path.join(TMP, 'z2.zip');
  execFileSync('python3', ['-I', '-c', [
    'import zipfile,sys',
    'z=zipfile.ZipFile(sys.argv[1],"w",zipfile.ZIP_STORED,allowZip64=True)',
    'zi=zipfile.ZipInfo("sd-cli.exe");zi.compress_type=zipfile.ZIP_STORED',
    'f=z.open(zi,"w",force_zip64=True);f.write(b"MZ"+b"x"*5000);f.close()',
    'z.writestr("stable-diffusion.dll",b"dll"*100,compress_type=zipfile.ZIP_DEFLATED)',
    'z.close()'].join('\n'), z2]);
  const out2 = path.join(TMP, 'zout2');
  await L.extractZip(z2, out2);
  assert.equal(fs.statSync(path.join(out2, 'sd-cli.exe')).size, 5002);
  assert.equal(L.findBinary(out2, 'win32'), path.join(out2, 'sd-cli.exe'));

  const z3 = path.join(TMP, 'z3.zip');
  execFileSync('python3', ['-I', '-c', 'import zipfile,sys\nz=zipfile.ZipFile(sys.argv[1],"w")\nz.writestr("../evil.txt","x")\nz.close()', z3]);
  await assert.rejects(L.extractZip(z3, path.join(TMP, 'zout3')), /unsafe path/);
  assert.equal(fs.existsSync(path.join(TMP, 'evil.txt')), false);
});

// ---------------------------------------------------------------- full install + run against a mock server

function makeFile(name, size) {
  const b = crypto.randomBytes(size);
  return { name, data: b, size, sha256: crypto.createHash('sha256').update(b).digest('hex') };
}

function startMock(state) {
  const log = [];
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    log.push({ path: u.pathname, range: req.headers.range || '' });
    const json = (code, body, headers) => { res.writeHead(code, Object.assign({ 'Content-Type': 'application/json' }, headers || {})); res.end(JSON.stringify(body)); };
    if (u.pathname === '/gh/repos/leejet/stable-diffusion.cpp/releases/latest') {
      return json(200, { tag_name: 'master-999-test', assets: state.engines.map((e) => ({ name: e.name, size: e.size, digest: 'sha256:' + e.sha256, browser_download_url: state.base + '/dl/' + e.name })) });
    }
    let m = /^\/hf\/api\/models\/(.+?)\/tree\/main$/.exec(u.pathname);
    if (m) {
      const repo = m[1], files = state.repos[repo];
      if (!files) return json(404, { error: 'Repository not found' });
      if (files === 'gated') return json(401, { error: 'Access to model is restricted' });
      const entries = files.map((f) => ({ type: 'file', oid: 'x', size: f.size, lfs: { oid: f.lfsOid || f.sha256, size: f.size, pointerSize: 134 }, path: f.path }));
      // two pages, like the API does with a Link header
      if (u.searchParams.get('cursor') !== '2' && entries.length > 1) {
        return json(200, [{ type: 'directory', oid: 'd', size: 0, path: 'split_files' }].concat(entries.slice(0, 1)),
          { Link: '<' + state.base + '/hf/api/models/' + repo + '/tree/main?recursive=true&cursor=2>; rel="next"' });
      }
      return json(200, u.searchParams.get('cursor') === '2' ? entries.slice(1) : entries);
    }
    m = /^\/hf\/(.+?)\/resolve\/main\/(.+)$/.exec(u.pathname);
    let file = null;
    if (m) {
      const files = state.repos[m[1]];
      file = Array.isArray(files) ? files.find((f) => f.path === decodeURIComponent(m[2])) : null;
      if (file && file.refuse) { res.writeHead(403); return res.end('denied'); }
    } else if ((m = /^\/dl\/(.+)$/.exec(u.pathname))) {
      file = state.engines.find((e) => e.name === m[1]);
    }
    if (!file) { res.writeHead(404); return res.end('nope'); }
    let start = 0;
    const r = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
    if (r) start = Number(r[1]);
    const end = r && r[2] ? Number(r[2]) : file.size - 1;
    const body = file.data.subarray(start, end + 1);
    res.writeHead(r ? 206 : 200, Object.assign({ 'Content-Length': body.length, 'Content-Type': 'application/octet-stream' }, r ? { 'Content-Range': 'bytes ' + start + '-' + end + '/' + file.size } : {}));
    // stream slowly when asked, so an install can be cancelled half way
    const chunk = 64 * 1024;
    for (let i = 0; i < body.length; i += chunk) {
      if (!res.write(body.subarray(i, i + chunk))) await new Promise((ok) => res.once('drain', ok));
      if (state.slow) await new Promise((ok) => setTimeout(ok, state.slow));
      if (res.destroyed) return;
    }
    res.end();
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => { state.base = 'http://127.0.0.1:' + server.address().port; ok({ server, log }); }));
}

function engineZip(name) {
  const dir = fs.mkdtempSync(path.join(TMP, 'eng-'));
  fs.mkdirSync(path.join(dir, 'bin'));
  fs.copyFileSync(path.join(__dirname, 'fake-sd-cli.js'), path.join(dir, 'bin', 'sd-cli'));
  fs.chmodSync(path.join(dir, 'bin', 'sd-cli'), 0o755);
  fs.writeFileSync(path.join(dir, 'bin', 'libstable-diffusion.so'), 'fake');
  const z = path.join(dir, name);
  execFileSync('zip', ['-qr', z, 'bin'], { cwd: dir });
  const data = fs.readFileSync(z);
  return { name, data, size: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex') };
}

function mockState() {
  const diff = Object.assign(makeFile('d', 2 * 1024 * 1024), { path: 'flux-2-klein-4b-Q4_0.gguf' });
  const diff8 = Object.assign(makeFile('d8', 1000), { path: 'flux-2-klein-4b-Q8_0.gguf' });
  const llm = Object.assign(makeFile('l', 700 * 1024), { path: 'Qwen3-4B-Q4_K_M.gguf' });
  const vaeBad = Object.assign(makeFile('vb', 1000), { path: 'split_files/vae/flux2-vae.safetensors', refuse: true });
  const vae = Object.assign(makeFile('v', 300 * 1024), { path: 'split_files/vae/flux2-vae.safetensors' });
  return {
    engines: [engineZip('sd-master-test-bin-Linux-Ubuntu-24.04-x86_64-vulkan.zip'), engineZip('sd-master-test-bin-Linux-Ubuntu-24.04-x86_64.zip')],
    repos: {
      'leejet/FLUX.2-klein-4B-GGUF': [diff, diff8],
      'unsloth/Qwen3-4B-GGUF': [llm],
      'Comfy-Org/flux2-klein-4B': [vaeBad],   // listed but the download is refused -> next candidate
      // 'Comfy-Org/flux2-klein' missing -> 404 -> next
      'Comfy-Org/flux2-dev': [vae],
      'black-forest-labs/FLUX.2-klein-4B': 'gated',
      'black-forest-labs/FLUX.2-dev': 'gated',
    },
    files: { diff, llm, vae },
    slow: 0,
  };
}

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), crypto.randomBytes(2000)]).toString('base64');

test('install (discover, download, verify, extract, probe) and run with the fake sd-cli', { skip: process.platform === 'win32' }, async (t) => {
  const state = mockState();
  const { server, log } = await startMock(state);
  t.after(() => server.close());
  const sdLog = path.join(TMP, 'sd-log.jsonl');
  process.env.FAKE_SD_LOG = sdLog;
  const root = path.join(TMP, 'root1');
  const eng = L.createEngine({ root, hfBase: state.base + '/hf', ghApi: state.base + '/gh', platform: 'linux', anySize: true });

  assert.equal(eng.status().state, 'none');
  const r0 = await eng.run({ mode: 'image', prompt: 'x', w: 512, h: 512 });
  assert.equal(r0.error, 'not-installed');

  // 1. start, then cancel half way through the big file
  state.slow = 15;
  const progress = [];
  const p1 = eng.install((p) => progress.push(p));
  await new Promise((ok) => {
    const iv = setInterval(() => {
      const st = eng.status();
      const d = st.progress && st.progress.files.find((f) => f.key === 'diffusion');
      if (d && d.done > 300 * 1024) { clearInterval(iv); ok(); }
    }, 20);
  });
  assert.equal(eng.status().state, 'installing');
  assert.equal(eng.cancelInstall(), true);
  const c1 = await p1;
  assert.equal(c1.ok, false); assert.equal(c1.error, 'cancelled');
  const part = path.join(root, 'downloads', 'flux-2-klein-4b-Q4_0.gguf.part');
  const partSize = fs.statSync(part).size;
  assert.ok(partSize > 0 && partSize < state.files.diff.size, 'partial file kept: ' + partSize);
  assert.equal(eng.status().state, 'partial');

  // 2. install again: resumes with Range, verifies sha256 and sizes
  state.slow = 0;
  const progress2 = [];
  const r = await eng.install((p) => progress2.push(p));
  assert.equal(r.ok, true, JSON.stringify(r));
  const rangeReq = log.find((x) => x.path.endsWith('/flux-2-klein-4b-Q4_0.gguf') && x.range === 'bytes=' + partSize + '-');
  assert.ok(rangeReq, 'resumed with Range from ' + partSize);
  const st = eng.status();
  assert.equal(st.state, 'ready');
  assert.equal(st.engine.variant, 'vulkan');
  assert.equal(st.files.vae.repo, 'Comfy-Org/flux2-dev', 'skipped the refused and the missing VAE repos');
  assert.equal(st.files.diffusion.path, 'flux-2-klein-4b-Q4_0.gguf');
  assert.equal(fs.readFileSync(path.join(root, 'models', 'flux-2-klein-4b-Q4_0.gguf')).equals(state.files.diff.data), true);
  assert.equal(fs.existsSync(path.join(root, 'downloads')), false);
  const last = progress2[progress2.length - 1];
  assert.equal(last.phase, 'done');
  assert.equal(last.done, last.total);
  assert.deepEqual(last.files.map((f) => f.key).sort(), ['diffusion', 'engine', 'llm', 'vae']);

  // 3. restyle: right args, PNG back, progress up to 99
  fs.rmSync(sdLog, { force: true });
  const pr = [];
  const out = await eng.run({ mode: 'restyle', prompt: 'turn into a watercolor painting', imageB64: JPEG, w: 1024, h: 768, seed: 123 }, (p) => pr.push(p.pct));
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(out.mime, 'image/png');
  assert.equal(Buffer.from(out.image, 'base64').readUInt32BE(0), 0x89504e47);
  assert.ok(out.ms >= 0);
  const call = JSON.parse(fs.readFileSync(sdLog, 'utf8').trim().split('\n')[0]);
  const a = call.args;
  const val = (f) => a[a.indexOf(f) + 1];
  assert.equal(val('--steps'), '4'); assert.equal(val('--cfg-scale'), '1.0'); assert.equal(val('--sampling-method'), 'euler');
  assert.equal(val('-W'), '1024'); assert.equal(val('-H'), '768'); assert.equal(val('--seed'), '123');
  assert.equal(val('-p'), 'turn into a watercolor painting');
  assert.ok(a.includes('-r'));
  assert.ok(a.includes('--offload-to-cpu'), 'unknown VRAM -> offload');
  assert.ok(a.includes('--vae-tiling'));
  assert.ok(val('--diffusion-model').startsWith(path.join(root, 'models')));
  assert.ok(!fs.existsSync(val('-r')), 'temp input removed');
  assert.ok(pr.length >= 4 && pr[pr.length - 1] >= 90, 'progress ' + pr.join(','));
  assert.deepEqual(pr.slice().sort((x, y) => x - y), pr, 'progress only goes up');

  // 4. image mode, big card: no offload
  eng.setGpuHint({ name: 'RTX 4080', vramMB: 16384 });
  fs.rmSync(sdLog, { force: true });
  const img = await eng.run({ mode: 'image', prompt: 'a gold frame', w: 512, h: 512 });
  assert.equal(img.ok, true);
  const a2 = JSON.parse(fs.readFileSync(sdLog, 'utf8').trim()).args;
  assert.ok(!a2.includes('-r') && !a2.includes('--offload-to-cpu') && !a2.includes('--vae-tiling'));

  // 5. out of video memory -> retried once with offload
  process.env.FAKE_SD_OOM_UNLESS_OFFLOAD = '1';
  fs.rmSync(sdLog, { force: true });
  const oom = await eng.run({ mode: 'image', prompt: 'a gold frame', w: 512, h: 512 });
  delete process.env.FAKE_SD_OOM_UNLESS_OFFLOAD;
  assert.equal(oom.ok, true, JSON.stringify(oom));
  const calls = fs.readFileSync(sdLog, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(calls.length, 2); assert.equal(calls[0].oom, true); assert.ok(calls[1].args.includes('--offload-to-cpu'));

  // 6. one at a time
  process.env.FAKE_SD_SLOW = '400';
  fs.rmSync(sdLog, { force: true });
  const [q1, q2] = await Promise.all([
    eng.run({ mode: 'image', prompt: 'one', w: 256, h: 256 }),
    eng.run({ mode: 'image', prompt: 'two', w: 256, h: 256 }),
  ]);
  assert.equal(q1.ok && q2.ok, true);
  const qc = fs.readFileSync(sdLog, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(qc.length, 2);
  assert.ok(qc[1].start >= qc[0].end, 'second run started after the first ended');

  // 7. cancel kills the running one and drops the queued one
  process.env.FAKE_SD_SLOW = '8000';
  const k1 = eng.run({ mode: 'image', prompt: 'slow', w: 256, h: 256 });
  const k2 = eng.run({ mode: 'image', prompt: 'queued', w: 256, h: 256 });
  await new Promise((ok) => setTimeout(ok, 400));
  assert.equal(eng.status().running, true);
  const t0 = Date.now();
  eng.cancel();
  const [kr1, kr2] = await Promise.all([k1, k2]);
  assert.equal(kr1.error, 'cancelled'); assert.equal(kr2.error, 'cancelled');
  assert.ok(Date.now() - t0 < 3000);

  // 8. timeout
  const eng2 = L.createEngine({ root, hfBase: state.base + '/hf', ghApi: state.base + '/gh', platform: 'linux', anySize: true, timeoutMs: 500 });
  const to = await eng2.run({ mode: 'image', prompt: 'slow', w: 256, h: 256 });
  assert.equal(to.error, 'timeout');
  delete process.env.FAKE_SD_SLOW;

  // 9. bad input never reaches the engine
  assert.equal((await eng.run({ mode: 'image', prompt: 'x', w: 4096, h: 512 })).error, 'bad-input');

  // 10. switch to the CPU build keeps the models
  const before = log.length;
  const cpu = await eng.install(() => {}, { variant: 'cpu' });
  assert.equal(cpu.ok, true, JSON.stringify(cpu));
  assert.equal(eng.status().engine.variant, 'cpu');
  assert.ok(!log.slice(before).some((x) => /resolve\/main/.test(x.path) && !x.range), 'no model downloaded again');

  // 11. remove
  const rm = await eng.remove();
  assert.equal(rm.state, 'none');
  assert.equal(fs.existsSync(root), false);
});

test('falls back to the CPU build when the Vulkan build sees no GPU', { skip: process.platform === 'win32' }, async (t) => {
  const state = mockState();
  const { server } = await startMock(state);
  t.after(() => server.close());
  process.env.FAKE_SD_NO_GPU = '1';
  t.after(() => { delete process.env.FAKE_SD_NO_GPU; });
  const eng = L.createEngine({ root: path.join(TMP, 'root2'), hfBase: state.base + '/hf', ghApi: state.base + '/gh', platform: 'linux', anySize: true });
  const r = await eng.install(() => {});
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(eng.status().engine.variant, 'cpu');
});

test('sha256 mismatch and missing files are reported', { skip: process.platform === 'win32' }, async (t) => {
  const state = mockState();
  state.files.llm.lfsOid = 'f'.repeat(64);
  const { server } = await startMock(state);
  t.after(() => server.close());
  const eng = L.createEngine({ root: path.join(TMP, 'root3'), hfBase: state.base + '/hf', ghApi: state.base + '/gh', platform: 'linux', anySize: true });
  const r = await eng.install(() => {});
  assert.equal(r.ok, false);
  assert.equal(r.error, 'install-failed');
  assert.match(r.detail, /sha256 mismatch for Qwen3-4B-Q4_K_M\.gguf/);
  assert.equal(eng.status().state, 'error');

  delete state.repos['Comfy-Org/flux2-dev'];
  const eng2 = L.createEngine({ root: path.join(TMP, 'root4'), hfBase: state.base + '/hf', ghApi: state.base + '/gh', platform: 'linux', anySize: true });
  const r2 = await eng2.install(() => {});
  assert.equal(r2.error, 'not-found');
  assert.match(r2.detail, /not-found:vae/);
  assert.match(r2.detail, /black-forest-labs\/FLUX\.2-dev \(http 401\)/);
});

test('offline install is reported as offline', async () => {
  const eng = L.createEngine({ root: path.join(TMP, 'root5'), hfBase: 'http://127.0.0.1:1', ghApi: 'http://127.0.0.1:1', platform: 'linux' });
  const r = await eng.install(() => {});
  assert.equal(r.ok, false);
  // every HF candidate failed with a network error -> not-found listing "(network)" for each
  assert.equal(r.error, 'offline', JSON.stringify(r));
});
