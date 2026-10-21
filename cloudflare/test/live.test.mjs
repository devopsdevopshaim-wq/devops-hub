// The live event (src/live.mjs) on an in-memory copy of Durable Object storage: guests need the QR key, the viewing key only
// reads, stations never get the same photo twice, owners only see their own events, and old photos are deleted.
import { frameLive, liveFile, liveCron } from '../src/live.mjs';

let bad = 0;
const check = (n, ok, x) => { if (!ok) { bad++; console.error('FAIL', n, x === undefined ? '' : JSON.stringify(x).slice(0, 300)); } else console.log('ok  ', n); };
function storage() {
  const m = new Map(), copy = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  return {
    m,
    async get(k) { if (Array.isArray(k)) return new Map(k.filter((x) => m.has(x)).map((x) => [x, copy(m.get(x))])); return copy(m.get(k)); },
    async put(k, v) { if (typeof k === 'object') { for (const [a, b] of Object.entries(k)) { if (JSON.stringify(b).length > 131072) throw new Error('value too big'); m.set(a, copy(b)); } return; } if (JSON.stringify(v).length > 131072) throw new Error('value too big'); m.set(k, copy(v)); },
    async delete(k) { (Array.isArray(k) ? k : [k]).forEach((x) => m.delete(x)); },
    async list({ prefix }) { return new Map([...m.entries()].filter(([k]) => k.startsWith(prefix)).sort().map(([k, v]) => [k, copy(v)])); }
  };
}
const S = storage(), SITE = { name: 'פריים מגנטים', googleReviews: { url: 'https://g.page/r/x/review' } };
const OWNER = { role: 'admin', email: 'devopsdevopshaim@gmail.com' }, LIC = { role: 'studio', email: 'pro@example.com' }, CLIENT = { role: 'client', email: 'dana@example.com' };
const call = (who, b) => frameLive(S, who, b, SITE);
const JPG = Buffer.from('jpeg-bytes-' + 'x'.repeat(300000)).toString('base64');

let r = await call(null, { action: 'ev-list' });
check('no session: no events', r.code === 401);
r = await call(CLIENT, { action: 'ev-list' });
check('a site customer cannot run events', r.code === 401);
r = await call(OWNER, { action: 'ev-save', event: { title: 'החתונה של נועה ודניאל', date: '2026-10-21', couple: { name: 'נועה', phone: '050-1234567', email: 'noa@example.com' }, copies: 2, cost: 1.2, price: 2500 } });
check('the owner creates an event, with keys', r.body.ok && /^[a-f0-9]{24}$/.test(r.body.event.k) && /^[a-f0-9]{24}$/.test(r.body.event.v) && r.body.event.copies === 2, r.body);
const ev = r.body.event;
r = await call(LIC, { action: 'ev-get', e: ev.id });
check('another studio cannot see it', r.code === 404);
r = await call(LIC, { action: 'ev-save', event: { title: 'בר מצווה' } });
check('a licensed studio has its own events', r.body.ok);
r = await call(LIC, { action: 'ev-list' });
check('... and lists only its own', r.body.events.length === 1 && r.body.events[0].title === 'בר מצווה');

r = await call(null, { action: 'guest-info', e: ev.id, k: ev.v });
check('the viewing key does not open the guests\' upload', r.code === 404);
r = await call(null, { action: 'guest-info', e: ev.id, k: ev.k });
check('guests see the title and the business, not the keys', r.body.ok && r.body.title === ev.title && r.body.biz.name === 'פריים מגנטים' && !JSON.stringify(r.body).includes(ev.v));
r = await call(null, { action: 'guest-up', e: ev.id, k: ev.k, img: 'not base64 !!' });
check('a broken image is refused', r.code === 400);
r = await call(null, { action: 'guest-up', e: ev.id, k: ev.k, img: JPG, name: 'סבתא רחל', text: 'מזל טוב 4111 1111 1111 1111', audio: '' });
check('a card number in a greeting is refused', r.body.error === 'card-number');
const ids = [];
for (let i = 0; i < 5; i++) { r = await call(null, { action: 'guest-up', e: ev.id, k: ev.k, img: JPG, name: 'אורח ' + i, text: i === 0 ? 'מזל טוב!' : '', audio: i === 0 ? Buffer.from('voice').toString('base64') : '', amime: 'audio/webm;codecs=opus' }); ids.push(r.body.id); }
check('guests upload photos (big ones are split)', ids.every(Boolean));

// two stations share the queue
const a = await call(OWNER, { action: 'claim', e: ev.id, station: 'עמדה 1', max: 3 });
const b = await call(OWNER, { action: 'claim', e: ev.id, station: 'עמדה 2', max: 3 });
const got = a.body.photos.map((p) => p.id).concat(b.body.photos.map((p) => p.id));
check('two stations get every photo exactly once', got.length === 5 && new Set(got).size === 5, got);
check('... with the image whole', a.body.photos[0].img === JPG && a.body.photos[0].text === 'מזל טוב!' && a.body.photos[0].audio === true);
check('... and both stations are known', Object.keys(b.body.stations).length === 2 && b.body.waiting === 0);
r = await call(OWNER, { action: 'claim', e: ev.id, station: 'עמדה 1', max: 3 });
check('nothing is handed out twice', r.body.photos.length === 0);
r = await call(OWNER, { action: 'mark', e: ev.id, ids: got.slice(0, 4), st: 'printed' });
r = await call(OWNER, { action: 'mark', e: ev.id, ids: [got[4]], st: 'hidden' });
r = await call(OWNER, { action: 'stat', e: ev.id, station: 'עמדה 1', prints: 8 });
check('printed magnets are counted', r.body.n.prints === 8 && r.body.n.printedGuest === 4, r.body);
r = await call(OWNER, { action: 'studio-up', e: ev.id, img: JPG, name: 'מגנט 12' });
check('a studio magnet goes into the album', r.body.ok);

// the big screen and the gallery
r = await call(null, { action: 'feed', e: ev.id, v: ev.k });
check('the guests\' key cannot read the gallery', r.code === 404);
r = await call(null, { action: 'feed', e: ev.id, v: ev.v });
check('the gallery: guests\' photos and studio magnets, not the hidden one', r.body.ok && r.body.photos.length === 5 && !r.body.photos.some((p) => p.id === got[4]) && r.body.biz.google.includes('g.page'), r.body);
check('... and the QR key for the big screen', r.body.k === ev.k);
const f = await liveFile(S, ev.id, ids[0], ev.v, false);
check('a photo is served with the viewing key', f && f.mime === 'image/jpeg' && Buffer.from(f.u).toString('base64') === JPG);
check('... and its voice message', (await liveFile(S, ev.id, ids[0], ev.v, true)).mime === 'audio/webm');
check('... not with the guests\' key', (await liveFile(S, ev.id, ids[0], ev.k, false)) === null);
check('... and not a hidden one', (await liveFile(S, ev.id, got[4], ev.v, false)) === null);

// closing uploads
await call(OWNER, { action: 'ev-save', event: Object.assign({}, ev, { open: false }) });
r = await call(null, { action: 'guest-up', e: ev.id, k: ev.k, img: JPG });
check('closed: guests cannot upload', r.body.error === 'closed');
r = await call(null, { action: 'feed', e: ev.id, v: ev.v });
check('closed: the big screen hides the QR', r.body.k === '');

// the day after: the couple's email; 60 days after: the photos go, the numbers stay
let mails = await liveCron(S, Date.parse('2026-10-22T09:00:00Z'));
check('the day after, the couple gets the gallery', mails.length === 1 && mails[0].to === 'noa@example.com' && mails[0].v === ev.v);
mails = await liveCron(S, Date.parse('2026-10-23T09:00:00Z'));
check('... only once', mails.length === 0);
await liveCron(S, Date.parse('2027-01-15T09:00:00Z'));
check('after 60 days the photos are deleted', ![...S.m.keys()].some((k) => k.startsWith('li:' + ev.id) || k.startsWith('lp:' + ev.id)));
r = await call(OWNER, { action: 'ev-list' });
check('... and the report numbers stay', r.body.events[0].n.prints === 8 && r.body.events[0].purged === true);
r = await call(OWNER, { action: 'ev-del', e: ev.id });
r = await call(OWNER, { action: 'ev-list' });
check('the owner deletes an event', r.body.events.length === 0);

if (bad) { console.error(bad + ' failed'); process.exit(1); }
console.log('live: all passed');
