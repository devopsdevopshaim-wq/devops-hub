// Builds youtube.json: YouTube channels for the site's music player, by style. No API key and no account:
// a channel page gives its id, the channel's public feed (youtube.com/feeds/videos.xml) proves it is alive and
// lists its latest videos, and the player plays the channel's "uploads" playlist in the official embedded player.
// A candidate that cannot be resolved is simply left out, so the list can be long and the result stays clean.
// Usage: node .github/scripts/portfolio-youtube.mjs <out.json>      (node .github/scripts/portfolio-youtube.mjs --selftest)
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || 'portfolio/youtube.json';
const KEEP = 5;                       // channels kept per group
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const COOKIE = 'CONSENT=YES+cb; SOCS=CAI';

// [group shown in the player, [@handles to try, best first]]
const GROUPS = [
  ['לו־פיי וצ׳יל', ['LofiGirl', 'Chillhop', 'ChillNation', 'TheBootlegBoy', 'MrSuicideSheep', 'MajesticCasual', 'CafedelMar', 'SelectedBase']],
  ['אמביינט ומדיטציה', ['MeditativeMind', 'YellowBrickCinema', 'SoothingRelaxation', 'MeditationRelaxMusic', 'RelaxationFilm', 'AmbientMusic']],
  ['ג׳אז ולאונג׳', ['bluenoterecords', 'Montreux', 'CafeMusicBGMchannel', 'JazzRelaxing', 'ECMRecords', 'VerveRecords']],
  ['קלאסית ופסנתר', ['DeutscheGrammophon', 'BerlinPhil', 'HALIDONMUSIC', 'yiruma', 'LangLang', 'DecoMusic', 'Classicalfm']],
  ['טראנס ופסיטראנס', ['anjunabeats', 'aboveandbeyond', 'arminvanbuuren', 'IbogaRecords', 'DacruRecords', 'SuntripRecords', 'ArmadaMusic']],
  ['האוס, טכנו ואלקטרוני', ['Cercle', 'boilerroom', 'Mixmag', 'DefectedRecords', 'SpinninRecords', 'Tomorrowland', 'Monstercat', 'NoCopyrightSounds', 'Proximity']],
  ['הופעות ומוזיקה חיה', ['NPRMusic', 'KEXP', 'COLORSxSTUDIOS', 'AudioTree', 'sofarsounds', 'Glastonbury']],
  ['רוק וקלאסיקות', ['queenofficial', 'pinkfloyd', 'ledzeppelin', 'RhinoRecords', 'thebeatles', 'fleetwoodmac', 'ACDCVEVO']],
  ['רגאיי', ['bobmarley', 'damianjrgongmarley', 'ReggaeVibes', 'Chronixx']],
  ['ישראלי ומזרחי', ['galgalatz', 'kan88', 'EyalGolan', 'OmerAdamOfficial', 'StaticandBenEl', 'NoaKirel', 'idanraichel', 'SaritHadad', 'AvivGefen', 'ShlomoArtzi', 'ZoharArgov', 'ShirazTal']],
  ['ניגונים, חסידות ותפילות', ['IshayRibo', 'AvrahamFried', 'Shwekey', 'BennyFriedman', 'MBDmusic', 'YonatanRazel', 'EitanKatz', 'ShlomoCarlebach', 'SimchaLeiner', 'Lipabentov']],
  ['מוזיקת עולם', ['putumayo', 'cafedeanatolia', 'WorldMusicNetwork', 'Hamsa']]
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) {
  const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9', cookie: COOKIE }, signal: AbortSignal.timeout(20000), redirect: 'follow' });
  if (!r.ok) throw new Error(String(r.status));
  return r.text();
}
// the channel id is in the page of @handle (canonical link, or the "channelId" field)
export function channelIdOf(html) {
  const m = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/) || html.match(/"(?:externalId|channelId)":"(UC[\w-]{22})"/) || html.match(/youtube\.com\/channel\/(UC[\w-]{22})/);
  return m ? m[1] : null;
}
export function parseFeed(xml) {
  const title = (xml.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const entries = [...xml.matchAll(/<entry>[\s\S]*?<yt:videoId>([\w-]{11})<\/yt:videoId>[\s\S]*?<title>([^<]*)<\/title>[\s\S]*?<published>([^<]*)<\/published>/g)]
    .map((m) => ({ id: m[1], title: decode(m[2]), published: m[3] }));
  return { name: decode(title), entries };
}
function decode(s) { return String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim(); }

async function resolve(handle) {
  let html;
  try { html = await get('https://www.youtube.com/@' + encodeURIComponent(handle)); } catch (e) { throw new Error('page ' + e.message); }
  const id = channelIdOf(html);
  if (!id) throw new Error('no channel id');
  // the public feed lists the latest videos; when YouTube does not serve it to this machine the channel is still kept (its id is enough to play it)
  let feed = { name: '', entries: [] };
  try { feed = parseFeed(await get('https://www.youtube.com/feeds/videos.xml?channel_id=' + id)); } catch (e) { feed.error = 'feed ' + e.message; }
  const name = feed.name || decode((html.match(/<meta property="og:title" content="([^"]*)"/) || [])[1] || handle);
  return { id, name, handle, latest: feed.entries.slice(0, 3).map((e) => e.title), updated: feed.entries[0] ? feed.entries[0].published : null, note: feed.error || '' };
}

if (process.argv[2] === '--selftest') {
  const html = '<link rel="canonical" href="https://www.youtube.com/channel/UCSJ4gkVC6NrvII8umztf0Ow"><title>x</title>';
  const xml = '<feed><title>Lofi &amp; Chill</title>' + [1, 2, 3].map((i) => `<entry><id>x</id><yt:videoId>abcdefghij${i}</yt:videoId><title>Song ${i}</title><published>2026-01-0${i}T00:00:00+00:00</published></entry>`).join('') + '</feed>';
  const f = parseFeed(xml);
  if (channelIdOf(html) !== 'UCSJ4gkVC6NrvII8umztf0Ow' || f.name !== 'Lofi & Chill' || f.entries.length !== 3 || f.entries[0].id !== 'abcdefghij1') { console.error('selftest failed', channelIdOf(html), f); process.exit(1); }
  console.log('selftest ok'); process.exit(0);
}

const styles = [];
let tried = 0, dead = 0;
for (const [group, handles] of GROUPS) {
  let kept = 0;
  for (const h of handles) {
    if (kept >= KEEP) break;
    tried++;
    try {
      const c = await resolve(h);
      styles.push({ group, style: c.name, title: c.latest[0] || c.name, url: 'https://www.youtube.com/playlist?list=UU' + c.id.slice(2), channel: c.id, handle: '@' + h, latest: c.latest, updated: c.updated });
      kept++; console.log('ok   ', group, '·', c.name, c.note ? '(' + c.note + ')' : '');
    } catch (e) { dead++; console.log('skip ', group, '·', '@' + h, '(' + e.message + ')'); }
    await sleep(400);
  }
}
console.log(`${styles.length} channels kept, ${dead} of ${tried} candidates skipped`);
if (styles.length < 8) { console.error('too few channels resolved; keeping the old file'); process.exit(0); }
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ updatedAt: new Date().toISOString(), styles }, null, 1) + '\n');
