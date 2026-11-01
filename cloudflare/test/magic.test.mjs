// The living magnet, the time capsule, the couple's photo for the mosaic and "find me" (src/live.mjs): each magnet's own
// code opens that magnet only, capsules stay sealed until a year after the event, faces are matched without photos leaking.
import { frameLive, liveFile, liveCron, capsuleOpens } from '../src/live.mjs';
import { today } from '../src/frame.mjs';

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
const S = storage(), SITE = { name: 'פריים מגנטים' };
const OWNER = { role: 'admin', email: 'devopsdevopshaim@gmail.com' }, OTHER = { role: 'studio', email: 'pro@example.com' };
const call = (who, b) => frameLive(S, who, b, SITE);
const JPG = Buffer.from('jpeg-bytes-' + 'x'.repeat(20000)).toString('base64'), MASK = 'data:image/jpeg;base64,' + Buffer.from('mask-' + 'y'.repeat(5000)).toString('base64');
const AUD = Buffer.from('voice-' + 'z'.repeat(3000)).toString('base64');
const desc = (seed) => Buffer.from(Int8Array.from({ length: 150 }, (_, i) => Math.round(Math.sin(i * 0.7 + seed) * 60))).toString('base64');
const near = (seed) => Buffer.from(Int8Array.from({ length: 150 }, (_, i) => Math.round(Math.sin(i * 0.7 + seed) * 60) + (i % 3) - 1)).toString('base64');

let r = await call(OWNER, { action: 'ev-save', event: { title: 'החתונה של נועה ודניאל', date: today(), couple: { name: 'נועה', email: 'noa@example.com' } } });
const ev = r.body.event;
r = await call(null, { action: 'guest-up', e: ev.id, k: ev.k, img: JPG, name: 'סבתא רחל', text: 'מזל טוב ילדים!', audio: AUD, amime: 'audio/webm' });
const g = r.body.id;

// the living magnet
r = await call(null, { action: 'magic', e: ev.id, c: 'abcde12345' });
check('a magnet scanned before it is uploaded: "on its way"', r.body.ok && r.body.pending && r.body.title === ev.title);
r = await call(OWNER, { action: 'studio-up', e: ev.id, img: JPG, name: 'מגנט 1', code: 'abcde12345', mask: MASK, from: g });
check('the printed magnet goes up with its code, mask and guest', r.body.ok);
const mid = r.body.id;
r = await call(OWNER, { action: 'studio-up', e: ev.id, img: JPG, code: 'abcde12345' });
check('a code is used once', r.code === 409);
r = await call(null, { action: 'magic', e: ev.id, c: 'abcde12345' });
check('scanning it: the guest\'s name, greeting and voice, and the mask', r.body.ok && !r.body.pending && r.body.magnet.name === 'סבתא רחל' && r.body.magnet.text === 'מזל טוב ילדים!' && r.body.magnet.audio && r.body.magnet.mask, r.body);
check('... without any key of the event', !JSON.stringify(r.body).includes(ev.v) && !JSON.stringify(r.body).includes(ev.k));
let f = await liveFile(S, ev.id, '', '', '', 'abcde12345', 'mask');
check('the magnet\'s mask and voice by its code', f && f.u.length > 4000 && (await liveFile(S, ev.id, '', '', '', 'abcde12345', 'audio')).u.length > 2000 && (await liveFile(S, ev.id, '', '', '', 'abcde12345', 'img')).u.length > 15000);
check('a wrong code opens nothing', !(await liveFile(S, ev.id, '', '', '', 'zzzzz99999', 'img')) && (await call(null, { action: 'capsule-put', e: ev.id, c: 'zzzzz99999', text: 'x' })).code === 404);

// the time capsule
r = await call(null, { action: 'capsule-put', e: ev.id, c: 'abcde12345', name: 'דוד משה', text: 'שתהיה לכם שנה ראשונה מאושרת', audio: AUD });
check('a guest leaves a message in the time capsule, opening a year after the event', r.body.ok && r.body.opens === capsuleOpens(ev), r.body);
r = await call(null, { action: 'capsule-put', e: ev.id, c: 'abcde12345' });
check('an empty message is refused', r.code === 400);
r = await call(null, { action: 'capsules', e: ev.id, v: ev.v });
check('sealed: the couple sees only how many are waiting', r.body.locked && r.body.count === 1 && !r.body.capsules);
check('... and its voice cannot be played early', !(await liveFile(S, ev.id, 'x', ev.v, 'cap')));
r = await call(OWNER, { action: 'ev-save', event: { title: 'שנה שעברה', date: '2024-03-10', couple: { name: 'רון', email: 'ron@example.com' } } });
const old = r.body.event;
await call(OWNER, { action: 'studio-up', e: old.id, img: JPG, code: 'oldmagnet01' });
const oldEv = S.m.get('lv:' + old.id); oldEv.date = '2024-03-10'; S.m.set('lv:' + old.id, oldEv);
check('a capsule after it opened takes no more messages', (await call(null, { action: 'capsule-put', e: old.id, c: 'oldmagnet01', text: 'מאוחר' })).code === 403);
const evNow = S.m.get('lv:' + ev.id); evNow.date = '2024-10-01'; S.m.set('lv:' + ev.id, evNow);   // a year (and a bit) later
r = await call(null, { action: 'capsules', e: ev.id, v: ev.v });
check('a year later the capsule opens: names, texts, voices', !r.body.locked && r.body.capsules.length === 1 && r.body.capsules[0].name === 'דוד משה' && r.body.capsules[0].audio, r.body);
check('... and the voice plays', (await liveFile(S, ev.id, r.body.capsules[0].id, ev.v, 'cap')).u.length > 2000);
evNow.date = today(); S.m.set('lv:' + ev.id, evNow);

// the couple's photo for the mosaic
r = await call(OTHER, { action: 'ev-hero', e: ev.id, img: JPG });
check('only the event\'s owner sets the mosaic photo', r.code === 404);
r = await call(OWNER, { action: 'ev-hero', e: ev.id, img: JPG });
check('the owner sets the couple\'s photo for the mosaic', r.body.ok && r.body.hero);
r = await call(null, { action: 'feed', e: ev.id, v: ev.v });
check('the big screen knows there is one', r.body.hero === true && (await liveFile(S, ev.id, '', ev.v, 'hero')).u.length > 15000);

// "find me"
r = await call(OWNER, { action: 'faces', e: ev.id, items: [{ p: g, f: [desc(1), desc(2)] }, { p: mid, f: [desc(5)] }, { p: 'nosuchphoto1', f: ['@@'] }] });
check('the studio stores the faces it found', r.body.ok && r.body.n === 2, r.body);
r = await call(null, { action: 'find', e: ev.id, v: 'f'.repeat(24), d: near(5) });
check('find me needs the viewing key', r.code === 404);
r = await call(null, { action: 'find', e: ev.id, v: ev.v, d: near(5) });
check('find me: the photo with my face comes first', r.body.ok && r.body.photos[0].id === mid && r.body.searched === 2, r.body);
r = await call(null, { action: 'find', e: ev.id, v: ev.v, d: 'short' });
check('a bad face signature is refused', r.code === 400);

// the purge after 60 days keeps the living magnets; MAGIC_DAYS later they go too; the capsule mail on its day
const e2 = S.m.get('lv:' + ev.id); e2.date = '2025-08-01'; S.m.set('lv:' + ev.id, e2);
let mails = await liveCron(S, Date.parse('2025-10-15T10:00:00Z'));
check('the 60-day purge deletes guests\' photos but keeps the living magnet', !S.m.has('lp:' + ev.id + ':' + g) && S.m.has('lp:' + ev.id + ':' + mid) && (await call(null, { action: 'magic', e: ev.id, c: 'abcde12345' })).body.magnet);
mails = await liveCron(S, Date.parse('2026-08-02T10:00:00Z'));
check('a year later the couple gets the capsule email, once', mails.some((m) => m.kind === 'capsule' && m.to === 'noa@example.com' && m.count === 1) && !(await liveCron(S, Date.parse('2026-08-03T10:00:00Z'))).some((m) => m.kind === 'capsule'));
await liveCron(S, Date.parse('2026-09-20T10:00:00Z'));
check('after MAGIC_DAYS the living magnets go', !S.m.has('lp:' + ev.id + ':' + mid) && !S.m.has('lcode:' + ev.id + ':abcde12345'));
await call(OWNER, { action: 'ev-del', e: ev.id });
check('deleting the event leaves nothing of it', ![...S.m.keys()].some((k) => k.includes(':' + ev.id + ':') || k.endsWith(':' + ev.id)));

if (bad) { console.error(bad + ' failed'); process.exit(1); }
console.log('magic: all passed');
