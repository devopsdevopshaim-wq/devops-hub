// The phone's AI jobs made by the studio's computer (relay.mjs), with an in-memory storage like a Durable Object's.
import { relayCall } from '../src/relay.mjs';
let fails = 0; const check = (n, ok, x) => { console.log((ok ? 'ok   ' : 'FAIL ') + n + (ok ? '' : ' ' + JSON.stringify(x))); if (!ok) fails++; };
const mem = new Map();
const storage = {
  get: async (k) => Array.isArray(k) ? new Map(k.map((x) => [x, mem.get(x)])) : mem.get(k),
  put: async (k, v) => { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) mem.set(a, b); else mem.set(k, v); },
  delete: async (k) => { for (const x of [].concat(k)) mem.delete(x); },
  list: async ({ prefix }) => new Map([...mem].filter(([k]) => k.startsWith(prefix)))
};
const owner = { role: 'admin', email: 'Owner@x.com' }, other = { role: 'admin', email: 'b@x.com' }, client = { role: 'client', email: 'c@x.com' };
let t = 1_000_000;
const call = (who, b, dt) => { t += dt || 1000; return relayCall(storage, who, b, t); };
check('a customer cannot use it', (await call(client, { action: 'relay-state' })).code === 403);
check('no computer yet: offline', (await call(owner, { action: 'relay-state' })).body.online === false);
check('the computer says it is here', (await call(owner, { action: 'relay-beat', name: 'עמדה 1' })).body.ok);
let s = await call(owner, { action: 'relay-state' }); check('the phone sees the computer online, by name', s.body.online && s.body.name === 'עמדה 1', s);
check('another account does not see it', (await call(other, { action: 'relay-state' })).body.online === false);
const big = 'A'.repeat(350000);   // a photo bigger than one stored value (split and joined again)
check('a job that is not a picture is refused', (await call(owner, { action: 'relay-put', body: { action: 'ai', prompt: 'x' } })).code === 400);
const put = await call(owner, { action: 'relay-put', body: { action: 'restyle', prompt: 'dragon', image: big, w: 1024, h: 683 } });
check('the phone leaves a job', put.body.ok && /^[a-z0-9]{8,24}$/.test(put.body.id), put.body);
check('another account cannot take it', (await call(other, { action: 'relay-take' })).body.job === null);
let g = await call(owner, { action: 'relay-get', id: put.body.id }); check('waiting', g.body.state === 'wait', g.body);
const take = await call(owner, { action: 'relay-take', name: 'עמדה 1' });
check('the computer takes it whole (the big photo joined again)', take.body.job && take.body.job.id === put.body.id && take.body.job.body.image.length === 350000 && take.body.job.body.prompt === 'dragon', { id: take.body.job && take.body.job.id });
check('nothing more to take', (await call(owner, { action: 'relay-take' })).body.job === null);
g = await call(owner, { action: 'relay-get', id: put.body.id }); check('running', g.body.state === 'run');
check('the computer answers', (await call(owner, { action: 'relay-done', id: put.body.id, result: { ok: true, image: 'B'.repeat(250000), mime: 'image/png', model: 'flux-2-klein-4b' } })).body.ok);
g = await call(owner, { action: 'relay-get', id: put.body.id });
check('the phone gets the picture, from the studio computer', g.body.state === 'done' && g.body.result.ok && g.body.result.image.length === 250000 && g.body.result.source === 'המחשב בעמדה', { state: g.body.state });
check('and the job is gone', (await call(owner, { action: 'relay-get', id: put.body.id })).code === 404);
check('nothing is left in storage', ![...mem.keys()].some((k) => k.startsWith('rly:in:') || k.startsWith('rly:out:')), [...mem.keys()]);
// a failure, a job taken and never answered, the computer gone quiet, the old jobs cleared
const p2 = await call(owner, { action: 'relay-put', body: { action: 'restyle', prompt: 'x', image: 'QQ' } });
await call(owner, { action: 'relay-take' }); await call(owner, { action: 'relay-done', id: p2.body.id, result: { ok: false, error: 'local-failed', detail: 'GPU' } });
g = await call(owner, { action: 'relay-get', id: p2.body.id }); check('a failure comes back as a failure', g.body.state === 'fail' && g.body.result.error === 'local-failed');
const p3 = await call(owner, { action: 'relay-put', body: { action: 'image', prompt: 'y' } });
await call(owner, { action: 'relay-take' });
check('taken and not answered: offered again after 6 minutes', (await call(owner, { action: 'relay-take' }, 7 * 60000)).body.job.id === p3.body.id);
check('the computer quiet for a while: offline', (await call(owner, { action: 'relay-state' }, 30000)).body.online === false);
await call(owner, { action: 'relay-state' }, 16 * 60000);
check('jobs older than 15 minutes are cleared', ((mem.get('rly:q:owner@x.com')) || []).length === 0);
for (let i = 0; i < 24; i++) await call(owner, { action: 'relay-put', body: { action: 'image', prompt: 'z' + i } }, 10);
check('at most 24 waiting', (await call(owner, { action: 'relay-put', body: { action: 'image', prompt: 'more' } })).code === 429);
if (fails) process.exit(1);
