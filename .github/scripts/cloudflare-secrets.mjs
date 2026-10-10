// Finds the Cloudflare token and account id however they were stored: CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID, or both pasted into one
// secret (CLOUDFLARE, or inside SPIDER), as "NAME=value" lines or just the two values. Writes them to GITHUB_ENV (masked).
import fs from 'node:fs';
const combined = [process.env.CLOUDFLARE, process.env.SPIDER].filter(Boolean).join('\n');
const first = (re) => (combined.match(re) || [])[1] || '';
const tok = (process.env.CLOUDFLARE_API_TOKEN || first(/CLOUDFLARE_API_TOKEN\W*([A-Za-z0-9_-]{30,80})/) ||
  (combined.match(/[A-Za-z0-9_-]{35,80}/g) || []).find((w) => !/^[a-f0-9]{32}$/.test(w) && !/^CLOUDFLARE/i.test(w)) || '').trim();
const acc = (process.env.CLOUDFLARE_ACCOUNT_ID || first(/CLOUDFLARE_ACCOUNT_ID\W*([a-f0-9]{32})/) || first(/\b([a-f0-9]{32})\b/) || '').trim();
let out = '';
for (const [k, v] of [['CLOUDFLARE_API_TOKEN', tok], ['CLOUDFLARE_ACCOUNT_ID', acc]]) if (v) { console.log(`::add-mask::${v}`); out += `${k}=${v}\n`; }
if (process.env.GITHUB_ENV) fs.appendFileSync(process.env.GITHUB_ENV, out);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `go=${tok ? 'true' : 'false'}\n`);
console.log(tok ? `token found (${tok.length} chars)${acc ? ', account id found' : ', no account id (wrangler will look it up)'}` : 'no Cloudflare token found');
