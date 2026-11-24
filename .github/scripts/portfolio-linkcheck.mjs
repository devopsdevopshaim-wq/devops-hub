// Checks every project of the portfolio from a GitHub runner: the address each card opens, and the answer of the live-status flow.
// Prints a table (and writes it to the job summary). Usage: node .github/scripts/portfolio-linkcheck.mjs
import fs from 'node:fs';

const d = JSON.parse(fs.readFileSync('portfolio/projects.json', 'utf8'));
const owner = d.owner || 'devopsdevopshaim-wq';
const UA = 'Mozilla/5.0 (compatible; portfolio-linkcheck)';
async function probe(url) {
  const t0 = Date.now();
  try {
    let r = await fetch(url, { method: 'GET', headers: { 'user-agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(25000) });
    const body = r.ok ? (await r.text()).slice(0, 4000) : '';
    const title = (body.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
    return { code: r.status, ms: Date.now() - t0, title: title.trim().slice(0, 50), final: r.url };
  } catch (e) { return { code: 'ERR ' + (e.cause?.code || e.name), ms: Date.now() - t0, title: '', final: '' }; }
}
let live = null;
try { const r = await fetch(d.statusUrl, { signal: AbortSignal.timeout(30000) }); live = await r.json(); } catch (e) { console.log('status flow:', e.message); }

const rows = [];
for (const p of d.projects) {
  let url = p.url || (p.localhost ? null : (p.private ? null : `https://${owner}.github.io/${p.repo}/${p.start ? encodeURIComponent(p.start) : ''}`));
  const state = live && (live.projects || live)[p.id];
  const res = url ? await probe(url) : { code: p.private ? 'private' : 'local', ms: 0, title: '', final: '' };
  rows.push({ id: p.id, title: p.title, url: url || '', ...res, live: state ? (state.state || JSON.stringify(state)) : '' });
}
const bad = rows.filter((r) => !(r.code === 200 || r.code === 'private' || r.code === 'local'));
const line = (r) => `${String(r.code).padEnd(10)} ${String(r.ms).padStart(5)}ms live=${String(r.live).padEnd(8)} ${r.id.padEnd(24)} ${r.url}  ${r.title}`;
console.log(rows.map(line).join('\n'));
console.log(`\n${rows.length} projects, ${bad.length} not answering 200:`);
console.log(bad.map(line).join('\n') || '(none)');
const lv = rows.filter((r) => r.live && r.live !== 'ok');
console.log(`\nlive-status flow says not ok for ${lv.length}:`);
console.log(lv.map(line).join('\n') || '(none)');
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '```\n' + rows.map(line).join('\n') + '\n```\n');
