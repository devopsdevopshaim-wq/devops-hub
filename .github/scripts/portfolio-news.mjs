// Builds news.json: today's headlines from Israeli news sites, read from their
// public RSS feeds. Runs in GitHub Actions (browsers cannot read these feeds
// directly). Only titles, links and times are kept; the story stays on its site.
// Usage: node .github/scripts/portfolio-news.mjs <out.json>
import fs from 'node:fs';

const OUT = process.argv[2] || 'portfolio/news.json';
const FEEDS = {
  main: [
    ['ynet', 'https://www.ynet.co.il/Integration/StoryRss2.xml'],
    ['וואלה', 'https://rss.walla.co.il/feed/1?type=main'],
    ['מעריב', 'https://www.maariv.co.il/Rss/RssChadashot'],
    ['Google News', 'https://news.google.com/rss?hl=he&gl=IL&ceid=IL:he']
  ],
  tech: [
    ['גיקטיים', 'https://www.geektime.co.il/feed/'],
    ['ynet מחשבים', 'https://www.ynet.co.il/Integration/StoryRss544.xml'],
    ['Google News טכנולוגיה', 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=he&gl=IL&ceid=IL:he']
  ]
};
const PER_FEED = 12;
const KEEP = 30;
const MAX_AGE = 3 * 24 * 3600 * 1000;

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decode(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(\w+);/g, (m, n) => ENT[n] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}
const tag = (xml, name) => (xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i')) || [])[1] || '';

async function read(source, url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (portfolio news reader)', Accept: 'application/rss+xml, application/xml, text/xml' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    const head = buf.subarray(0, 200).toString('latin1');
    const enc = (head.match(/encoding=["']([\w-]+)["']/i) || [])[1] || 'utf-8';
    let xml;
    try { xml = new TextDecoder(enc.toLowerCase()).decode(buf); } catch { xml = buf.toString('utf8'); }
    const items = xml.split(/<item[\s>]/i).slice(1).map((chunk) => {
      let title = decode(tag(chunk, 'title'));
      let src = source;
      // Google News puts the outlet after the last " - "
      if (/news\.google/.test(url)) {
        const m = title.match(/^(.*) - ([^-]+)$/);
        if (m) { title = m[1].trim(); src = m[2].trim(); }
      }
      const link = decode(tag(chunk, 'link')) || decode((chunk.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i) || [])[1]);
      const when = Date.parse(decode(tag(chunk, 'pubDate')) || decode(tag(chunk, 'dc:date')));
      return { title, link, source: src, at: Number.isFinite(when) ? new Date(when).toISOString() : null };
    }).filter((x) => x.title && /^https?:\/\//.test(x.link)).slice(0, PER_FEED);
    console.log(`${source}: ${items.length}`);
    return items;
  } catch (e) {
    console.log(`::warning::${source} (${url}): ${e.message}`);
    return [];
  } finally {
    clearTimeout(t);
  }
}

function merge(lists) {
  const seen = new Set();
  const now = Date.now();
  return lists.flat()
    .filter((x) => !x.at || now - Date.parse(x.at) < MAX_AGE)
    .sort((a, b) => (b.at ? Date.parse(b.at) : 0) - (a.at ? Date.parse(a.at) : 0))
    .filter((x) => {
      const k = x.title.replace(/[^\p{L}\p{N}]+/gu, '').slice(0, 40);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, KEEP);
}

let old = { feeds: {} };
try { old = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch {}
const feeds = {};
for (const [k, list] of Object.entries(FEEDS)) {
  const items = merge(await Promise.all(list.map(([s, u]) => read(s, u))));
  // a feed that failed this time keeps its last good headlines
  feeds[k] = items.length ? items : (old.feeds && old.feeds[k]) || [];
}
const total = Object.values(feeds).reduce((s, l) => s + l.length, 0);
if (!total) { console.log('::warning::no headlines at all; keeping the old file'); process.exit(0); }
fs.writeFileSync(OUT, JSON.stringify({ updatedAt: new Date().toISOString(), feeds }, null, 1) + '\n');
console.log('wrote', OUT, Object.fromEntries(Object.entries(feeds).map(([k, l]) => [k, l.length])));
