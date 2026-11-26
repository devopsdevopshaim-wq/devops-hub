// v222: the hall's TV run from the studio: settings, commands, the owners' photos on the server, pairing by a code
import { frameLive, liveFile } from '../src/live.mjs';
let bad = 0;
const check = (n, ok, x) => { if (!ok) { bad++; console.error('FAIL', n, x === undefined ? '' : JSON.stringify(x).slice(0, 300)); } else console.log('ok  ', n); };
function storage() {
  const m = new Map(), copy = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  return {
    m,
    async get(k) { if (Array.isArray(k)) return new Map(k.filter((x) => m.has(x)).map((x) => [x, copy(m.get(x))])); return copy(m.get(k)); },
    async put(k, v) { if (typeof k === 'object') { for (const [a, b] of Object.entries(k)) m.set(a, copy(b)); return; } m.set(k, copy(v)); },
    async delete(k) { (Array.isArray(k) ? k : [k]).forEach((x) => m.delete(x)); },
    async list({ prefix }) { return new Map([...m.entries()].filter(([k]) => k.startsWith(prefix)).sort().map(([k, v]) => [k, copy(v)])); }
  };
}
const S = storage(), OWNER = { role: 'studio', email: 'studio@example.com' }, OTHER = { role: 'studio', email: 'other@example.com' };
const call = (who, b) => frameLive(S, who, b, { name: 'עסק' }), JPG = Buffer.from('jpeg-bytes-' + 'x'.repeat(3000)).toString('base64');
let r = await call(OWNER, { action: 'ev-save', event: { title: 'בר מצווה', date: '2030-01-01' } });
const ev = r.body.event;
r = await call(null, { action: 'tv', e: ev.id, v: ev.v, seq: -1, name: 'טלוויזיה באולם' });
check('the TV reads the screen state', r.body.ok && r.body.seq === 0 && Array.isArray(r.body.owners));
r = await call(null, { action: 'tv', e: ev.id, v: 'f'.repeat(24) });
check('a wrong viewing key reads nothing', r.code === 404);
r = await call(OWNER, { action: 'screen', e: ev.id, op: 'state' });
check('the studio sees the TV is on', r.body.tvAt > 0 && r.body.tv === 'טלוויזיה באולם', r.body);
r = await call(OWNER, { action: 'screen', e: ev.id, op: 'set', set: { mode: 'host', sec: 99, dir: 'left', strip: 30, text: 'מזל טוב איתי', evil: 1 } });
check('settings are cleaned and kept', r.body.set.sec === 30 && r.body.set.dir === 'left' && r.body.set.text === 'מזל טוב איתי' && !('evil' in r.body.set) && r.body.seq === 1, r.body.set);
r = await call(null, { action: 'tv', e: ev.id, v: ev.v, seq: 1 });
check('nothing new: a short answer', r.body.same === true);
r = await call(OWNER, { action: 'screen', e: ev.id, op: 'cmd', cmd: 'say', text: 'כולם לרחבה!', sec: 20 });
check('a message for the screen', r.body.cmd.c === 'say' && r.body.cmd.text === 'כולם לרחבה!' && r.body.cmd.n === 1);
r = await call(OWNER, { action: 'screen', e: ev.id, op: 'cmd', cmd: 'pause' });
check('pause is kept in the settings too', r.body.set.paused === true && r.body.cmd.n === 2);
r = await call(OWNER, { action: 'screen', e: ev.id, op: 'cmd', cmd: 'rm -rf' });
check('an unknown command is refused', r.code === 400);
r = await call(OTHER, { action: 'screen', e: ev.id, op: 'set', set: { sec: 5 } });
check('another studio cannot run this TV', r.code === 404 || r.code === 403, r);
r = await call(OWNER, { action: 'screen', e: ev.id, op: 'owner-put', img: JPG });
const oid = r.body.owners[0];
check('an owners\' photo goes up', r.body.owners.length === 1);
let f = await liveFile(S, ev.id, oid, ev.v, 'owner');
check('the TV can load it with the viewing key', f && f.mime === 'image/jpeg' && f.u.length > 100);
f = await liveFile(S, ev.id, oid, ev.k, 'owner');
check('the guests\' key cannot', !f);
r = await call(null, { action: 'tv', e: ev.id, v: ev.v, seq: 0 });
check('the TV gets the list of the owners\' photos', r.body.owners[0] === oid && r.body.set.mode === 'host');
r = await call(OWNER, { action: 'screen', e: ev.id, op: 'owner-del', id: '*' });
check('all the owners\' photos removed', r.body.owners.length === 0 && !(await liveFile(S, ev.id, oid, ev.v, 'owner')));
// pairing
r = await call(null, { action: 'tv-pair-new' });
const { code, secret } = r.body;
check('the TV gets a 6-digit code', /^\d{6}$/.test(code) && /^[a-f0-9]{32}$/.test(secret));
r = await call(null, { action: 'tv-pair-get', code, secret });
check('until the studio types it, the TV waits', r.body.wait === true);
r = await call(null, { action: 'tv-pair-get', code, secret: 'a'.repeat(32) });
check('the code alone (without the TV\'s secret) reveals nothing', r.code === 404);
r = await call(OWNER, { action: 'screen', e: ev.id, op: 'pair', code: '000000' === code ? '111111' : '000000' });
check('a wrong code is refused', r.code === 404 && r.body.error === 'tv-code');
r = await call(OWNER, { action: 'screen', e: ev.id, op: 'pair', code: code.slice(0, 3) + ' ' + code.slice(3) });
check('the studio pairs the TV', r.body.ok);
r = await call(null, { action: 'tv-pair-get', code, secret });
check('the TV gets the event and its viewing key', r.body.e === ev.id && r.body.v === ev.v);
r = await call(null, { action: 'tv-pair-get', code, secret });
check('a code works once', r.code === 404);
r = await call(OWNER, { action: 'screen', e: ev.id, op: 'owner-put', img: JPG });
await call(OWNER, { action: 'ev-del', e: ev.id });
check('deleting the event deletes the owners\' photos', ![...S.m.keys()].some((k) => k.startsWith('lo:')), [...S.m.keys()]);
if (bad) { console.error(bad + ' failed'); process.exit(1); }
console.log('all passed');
