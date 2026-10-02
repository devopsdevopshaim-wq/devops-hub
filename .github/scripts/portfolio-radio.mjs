// Builds radio.json: internet radio stations for the site's music player, by style.
// Candidates come from the Radio Browser directory (radio-browser.info, a free,
// community-run list of ~50,000 stations) and from SomaFM. Every candidate is
// actually played for a moment here; only stations that answer over HTTPS with
// real audio are kept, so the player gets streams that work today.
// Usage: node .github/scripts/portfolio-radio.mjs <out.json>
import fs from 'node:fs';

const OUT = process.argv[2] || 'portfolio/radio.json';
const KEEP = 6;          // working stations per style
const TRY = 18;          // candidates checked per style
const UA = 'hasadna-portfolio-radio/1.0 (github.com/devopsdevopshaim-wq/devops-hub)';

const soma = (id, name) => ({ name: 'SomaFM · ' + name, url: `https://ice2.somafm.com/${id}-128-mp3`, home: 'https://somafm.com/' + id + '/', codec: 'MP3', bitrate: 128, country: 'US' });

// style shown on the button, Radio Browser tags (best first), extra stations
// talk, news and religious stations are never music styles
const NOT_MUSIC = /news|talk|prayer|quran|koran|relig|torah|bible|church|sport|podcast|חדשות|תורה|דת|ספורט/;

const STYLES = [
  ['psytrance', 'פסיטראנס', ['psytrance', 'psychedelic trance', 'goa trance', 'goa', 'psy trance'], []],
  ['trance', 'טראנס', ['uplifting trance', 'vocal trance', 'trance'], [], null, /anime|80s|90s|bass/],
  ['progressive', 'פרוגרסיב', ['progressive house', 'progressive trance', 'progressive'], [soma('thetrip', 'The Trip')]],
  ['dream', 'דרים', ['dream trance', 'dream house', 'dreamhouse', 'dream', 'dreampop', 'dream pop', 'chillwave', 'shoegaze', 'ethereal'], [soma('lush', 'Lush')]],
  ['ambient', 'אמביינט', ['ambient', 'space ambient', 'dark ambient'], [soma('dronezone', 'Drone Zone'), soma('deepspaceone', 'Deep Space One'), soma('spacestation', 'Space Station')]],
  ['chillout', 'צ׳ילאאוט', ['chillout', 'chill out', 'downtempo', 'chill'], [soma('groovesalad', 'Groove Salad'), soma('fluid', 'Fluid')]],
  ['lounge', 'לאונג׳', ['lounge', 'chill lounge', 'bar'], [soma('illstreet', 'Illinois Street Lounge'), soma('secretagent', 'Secret Agent')]],
  ['deephouse', 'דיפ האוס', ['deep house', 'deephouse'], []],
  ['house', 'האוס', ['house', 'electro house', 'tech house'], []],
  ['techno', 'טכנו', ['techno', 'minimal techno', 'melodic techno'], []],
  ['dnb', 'דראם אנד בייס', ['drum and bass', 'drum & bass', 'dnb', 'jungle'], []],
  ['lofi', 'לו־פיי', ['lofi', 'lo-fi', 'lofi hip hop', 'chillhop'], []],
  ['jazz', 'ג׳אז', ['jazz', 'smooth jazz', 'nu jazz'], [soma('sonicuniverse', 'Sonic Universe')]],
  ['classical', 'קלאסית', ['classical music', 'baroque', 'symphony', 'opera', 'classical'], [], null, /telugu|tamil|hindi|bollywood|indian|turk|arab|pop|hits|carnatic/],
  ['piano', 'פסנתר', ['piano', 'solo piano', 'relaxing piano'], []],
  ['mizrahi', 'מזרחית', ['mizrahi', 'mizrahit', 'מזרחית', 'oriental'], [], /mizra|מזרח|mediterr|ים תיכונ|oriental|greek|יוונית/],
  ['israeli', 'ישראלי', ['israeli music', 'hebrew', 'israel'], [], /./],
  ['reggae', 'רגאיי', ['reggae', 'roots reggae', 'dub'], []],
  ['rock', 'רוק', ['rock', 'classic rock', 'alternative rock'], []],
  ['80s', 'שנות ה־80', ['80s', '80er', 'eighties'], [soma('u80s', 'Underground 80s')]],
  ['meditation', 'מדיטציה', ['meditation', 'relaxation', 'spa', 'new age'], []]
];

const SERVERS = ['de1.api.radio-browser.info', 'de2.api.radio-browser.info', 'fi1.api.radio-browser.info', 'nl1.api.radio-browser.info', 'at1.api.radio-browser.info'];
let server = null;

async function rb(path) {
  const order = server ? [server, ...SERVERS.filter((s) => s !== server)] : SERVERS;
  for (const s of order) {
    try {
      const r = await fetch(`https://${s}${path}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      server = s;
      return await r.json();
    } catch (e) { console.log(`  ${s}: ${e.message}`); }
  }
  return [];
}

function shape(s) {
  // the listed address is the stable one; the "resolved" one can carry a token that expires
  const url = /^https:\/\//.test(s.url) && !/\.(pls|m3u8?|asx)(\?|$)/i.test(s.url) ? s.url : s.url_resolved;
  if (!/^https:\/\//.test(url || '') || /[?&](zt|zs|token|exp)=/.test(url)) return null;
  if (s.codec && !/^(MP3|AAC|AAC\+|OGG|OPUS)$/i.test(s.codec)) return null; // HLS and others play poorly in <audio>
  return { name: s.name.trim().replace(/\s+/g, ' ').slice(0, 60), url, home: s.homepage || '', codec: s.codec || '', bitrate: s.bitrate || 0, country: s.countrycode || '', tags: (s.tags || '').toLowerCase() };
}

async function candidates(tags) {
  const seen = new Set();
  const out = [];
  for (const tag of tags) {
    // exact tags only: a loose match turns "trance" into every dance chart station
    const q = new URLSearchParams({ tag, tagExact: 'true', hidebroken: 'true', is_https: 'true', order: 'clickcount', reverse: 'true', limit: '40' });
    for (const s of await rb('/json/stations/search?' + q)) {
      const st = shape(s);
      if (!st || seen.has(st.url)) continue;
      seen.add(st.url);
      out.push(st);
    }
    if (out.length >= TRY * 2) break;
  }
  return out;
}

// Israeli stations, picked by what their tags say
let israeli = null;
async function israel(re) {
  if (!israeli) {
    const q = new URLSearchParams({ countrycode: 'IL', hidebroken: 'true', is_https: 'true', order: 'clickcount', reverse: 'true', limit: '300' });
    israeli = (await rb('/json/stations/search?' + q)).map(shape).filter(Boolean);
    console.log(`  Israel: ${israeli.length} HTTPS stations in the directory`);
  }
  return israeli.filter((s) => re.test(s.tags + ' ' + s.name.toLowerCase()));
}

// Plays the stream for a moment: it must answer 200 with audio and send real bytes.
async function works(st) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(st.url, { headers: { 'User-Agent': UA, 'Icy-MetaData': '0' }, signal: ctrl.signal, redirect: 'follow' });
    if (!r.ok || !r.body) return false;
    const type = (r.headers.get('content-type') || '').toLowerCase();
    if (!/audio|ogg|octet-stream|aacp|mpeg/.test(type) || /mpegurl|x-scpls|text\/html/.test(type)) return false;
    if (!/^https:/.test(r.url)) return false; // redirected to plain http: the browser would block it
    const reader = r.body.getReader();
    let got = 0;
    while (got < 24000) {
      const { value, done } = await reader.read();
      if (done) break;
      got += value.length;
    }
    reader.cancel().catch(() => {});
    return got >= 24000;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
    ctrl.abort();
  }
}

async function pick(list) {
  const ok = [];
  for (let i = 0; i < list.length && ok.length < KEEP && i < TRY; i += 6) {
    const batch = list.slice(i, i + 6);
    const res = await Promise.all(batch.map(works));
    batch.forEach((s, k) => { if (res[k] && ok.length < KEEP) ok.push(s); });
  }
  return ok;
}

let old = { genres: [] };
try { old = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch {}
const used = new Set(); // a station shows up under one style only
const genres = [];
for (const [id, style, tags, extra, ilRe, not] of STYLES) {
  let list = [...extra];
  if (ilRe) list = list.concat(await israel(ilRe));
  list = list.concat(await candidates(tags));
  list = list.filter((s) => !NOT_MUSIC.test((s.tags || '') + ' ' + s.name.toLowerCase()) && !(not && not.test((s.tags || '') + ' ' + s.name.toLowerCase())));
  const fresh = list.filter((s) => !used.has(s.url));
  let ok = await pick(fresh.length >= 3 ? fresh : list);
  ok.forEach((s) => used.add(s.url));
  const prev = (old.genres || []).find((g) => g.id === id);
  const stations = ok.length ? ok : (prev ? prev.stations : []);
  console.log(`${style} (${id}): ${ok.length} working of ${Math.min(list.length, TRY)} checked${ok.length ? '' : prev ? " — kept yesterday's" : ''}: ${ok.map((s) => s.name).join(' | ')}`);
  if (stations.length) genres.push({ id, style, stations: stations.map(({ tags, ...s }) => s) });
}
if (!genres.length) { console.log('::warning::no working stations at all; keeping the old file'); process.exit(0); }
fs.writeFileSync(OUT, JSON.stringify({ updatedAt: new Date().toISOString(), source: 'radio-browser.info + SomaFM', genres }, null, 1) + '\n');
console.log('wrote', OUT, genres.length, 'styles,', genres.reduce((s, g) => s + g.stations.length, 0), 'stations');
