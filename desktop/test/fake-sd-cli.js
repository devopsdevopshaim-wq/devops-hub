#!/usr/bin/env node
// Stand-in for stable-diffusion.cpp's sd-cli in tests: checks the arguments, prints progress the way sd.cpp does
// (pretty_bytes_progress while loading, pretty_progress while sampling) and writes a small PNG to -o.
// Env: FAKE_SD_LOG (append a JSON line per call), FAKE_SD_SLOW (ms to sleep), FAKE_SD_OOM_UNLESS_OFFLOAD=1, FAKE_SD_NO_GPU=1
'use strict';
const fs = require('fs');
const args = process.argv.slice(2);
const log = process.env.FAKE_SD_LOG;
const t0 = Date.now();
if (args[0] === '--list-devices') {
  if (process.env.FAKE_SD_NO_GPU) process.stdout.write('CPU\tAMD Ryzen 5 (fake)\n');
  else process.stdout.write('Vulkan0\tFake GPU 8GB\nCPU\tFake CPU\n');
  process.exit(0);
}
const get = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const need = ['--diffusion-model', '--vae', '--llm', '-p', '--cfg-scale', '--sampling-method', '--steps', '-W', '-H', '--seed', '-o'];
for (const f of need) if (get(f) === undefined) { console.error('[ERROR] missing ' + f); process.exit(2); }
for (const f of ['--diffusion-model', '--vae', '--llm']) if (!fs.existsSync(get(f))) { console.error('[ERROR] no file ' + get(f)); process.exit(3); }
const ref = get('-r');
if (ref && !fs.existsSync(ref)) { console.error('[ERROR] no ref image'); process.exit(4); }
const offload = args.includes('--offload-to-cpu');
if (process.env.FAKE_SD_OOM_UNLESS_OFFLOAD && !offload) {
  console.error('[ERROR] ggml_vulkan: Device memory allocation of size 2147483648 failed.\n[ERROR] ggml_vulkan: vk::Device::allocateMemory: ErrorOutOfDeviceMemory');
  if (log) fs.appendFileSync(log, JSON.stringify({ args, start: t0, end: Date.now(), oom: true }) + '\n');
  process.exit(1);
}
const steps = Number(get('--steps'));
const out = process.stdout;
const bar = (i, n, ch) => '|' + ch.repeat(Math.round(i / n * 50)) + (i < n ? '>' : '') + ' '.repeat(Math.max(0, 50 - Math.round(i / n * 50) - (i < n ? 1 : 0))) + '|';
(async () => {
  const slow = Number(process.env.FAKE_SD_SLOW || 0);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  out.write('[INFO ] stable-diffusion.cpp:331 - loading diffusion model from \'' + get('--diffusion-model') + '\'\n');
  for (let i = 1; i <= 3; i++) { out.write('\r' + bar(i, 3, '#') + ' ' + i + '/3 - ' + (850.5 * i).toFixed(2) + 'MB/s\x1b[K' + (i === 3 ? '\n' : '')); await sleep(slow / 10); }
  for (let i = 1; i <= steps; i++) { await sleep(slow / steps); out.write('\r' + bar(i, steps, '=') + ' ' + i + '/' + steps + ' - ' + '3.21s/it\x1b[K' + (i === steps ? '\n' : '')); }
  out.write('[INFO ] stable-diffusion.cpp:2716 - generating 1 latent images completed, taking 12.84s\n');
  // 1x1 PNG
  fs.writeFileSync(get('-o'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
  out.write('[INFO ] main.cpp:880 - save result image 0 to \'' + get('-o') + '\' (success)\n');
  if (log) fs.appendFileSync(log, JSON.stringify({ args, start: t0, end: Date.now() }) + '\n');
})();
