// Runs every security test. Used by the deploy workflow: if one fails, nothing is installed in n8n.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
let failed = 0, passed = 0;
for (const f of readdirSync(here).filter((x) => x.endsWith('.test.mjs')).sort()) {
  const r = spawnSync(process.execPath, [path.join(here, f)], { encoding: 'utf8' });
  const lines = (r.stdout + r.stderr).split('\n');
  const bad = lines.filter((l) => l.startsWith('FAIL'));
  const good = lines.filter((l) => l.startsWith('ok')).length;
  passed += good; failed += bad.length + (r.status && !bad.length ? 1 : 0);
  console.log(`${bad.length || r.status ? '❌' : '✅'} ${f}: ${good} passed${bad.length ? ', ' + bad.length + ' failed' : ''}`);
  bad.forEach((l) => console.log('   ' + l));
  if (r.status && !bad.length) console.log(lines.slice(-8).join('\n'));
}
console.log(`\n${passed} checks passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
