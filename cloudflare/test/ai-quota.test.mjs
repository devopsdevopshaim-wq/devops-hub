// The AI allowance per licence (src/ai-quota.mjs): the owner has none, each plan its own, only made designs count.
import assert from 'node:assert/strict';
import * as nodeCrypto from 'node:crypto';
import { aiGate, aiCount, aiLeft, tierOf, AI_PLANS, AI_ANON_DAY } from '../src/ai-quota.mjs';
const sha = (s) => nodeCrypto.createHash('sha256').update(s).digest('hex');
const now = Date.parse('2026-11-19T10:00:00Z'), DAY = 86400000;
const tok = (c) => c.repeat(48);
const sd = {
  sessions: {
    [sha(tok('a'))]: { email: 'owner@x', role: 'admin', exp: now + DAY },
    [sha(tok('b'))]: { email: 'pro@x', role: 'studio', lic: 'pro@x', exp: now + DAY },
    [sha(tok('c'))]: { email: 'trial@x', role: 'studio', lic: 'trial@x', exp: now + DAY },
    [sha(tok('d'))]: { email: 'free@x', role: 'studio', lic: 'free@x', exp: now + DAY },
    [sha(tok('e'))]: { email: 'old@x', role: 'studio', lic: 'pro@x', exp: now - 1 },
    [sha(tok('f'))]: { email: 'pass@x', role: 'studio', lic: 'pass@x', exp: now + DAY },
  },
  licenses: {
    'pro@x': { active: true, paid: true, paidUntil: new Date(now + 30 * DAY).toISOString() },
    'trial@x': { active: true, trial: { start: new Date(now - 3 * DAY).toISOString(), events: [] } },
    'free@x': { active: true, trial: { start: new Date(now - 100 * DAY).toISOString(), events: [] } },
    'pass@x': { active: true, passUntil: new Date(now + DAY).toISOString() },
  },
};
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
ok(aiGate(sd, tok('a'), now).owner, 'the owner has no limit');
ok(aiLeft(aiGate(sd, tok('a'), now)).unlimited, 'the owner: unlimited');
ok(aiGate(sd, tok('b'), now).tier === 'pro' && aiGate(sd, tok('b'), now).max === AI_PLANS.pro.max, 'paid → pro');
ok(aiGate(sd, tok('c'), now).tier === 'trial', 'trial');
ok(aiGate(sd, tok('d'), now).tier === 'free' && aiGate(sd, tok('d'), now).max === 15, 'trial ended → free, 15 a day');
ok(aiGate(sd, tok('f'), now).tier === 'pass', 'pass');
ok(aiGate(sd, tok('e'), now).key === 'anon' && aiGate(sd, '', now).max === AI_ANON_DAY, 'no session → the shared pool');
ok(aiGate(sd, 'x', now).key === 'anon', 'a bad token → the shared pool');
// counting: 15 free designs, then no more today; tomorrow again
for (let i = 0; i < 15; i++) aiCount(sd, aiGate(sd, tok('d'), now), now);
const g = aiGate(sd, tok('d'), now); ok(g.used === 15 && aiLeft(g).left === 0, 'the 15th design used the day');
ok(aiGate(sd, tok('d'), now + DAY).used === 0, 'a new day starts again');
// the owner is never counted
aiCount(sd, aiGate(sd, tok('a'), now), now); ok(!sd.aiUse['u:owner@x'], 'the owner is not counted');
// one licence's count does not touch another's
ok(aiGate(sd, tok('b'), now).used === 0, 'another licence is untouched');
// a licence the owner set to 0 has no AI; a bigger one gets more
sd.licenses['pro@x'].aiMax = 0; ok(aiGate(sd, tok('b'), now).max === 0, 'aiMax 0 stops it'); delete sd.licenses['pro@x'].aiMax;
sd.licenses['trial@x'].aiMax = 50; { const g2 = aiGate(sd, tok('c'), now); ok(g2.max === 50 && g2.per === 'month' && g2.period === 'm2026-11', "the owner's own number counts a month"); } delete sd.licenses['trial@x'].aiMax;
sd.licenses['pro@x'].owner = true; ok(aiGate(sd, tok('b'), now).owner, "the owner's own licence: unlimited"); delete sd.licenses['pro@x'].owner;
// a month resets the pro count
aiCount(sd, aiGate(sd, tok('b'), now), now); ok(aiGate(sd, tok('b'), now).used === 1 && aiGate(sd, tok('b'), now + 15 * DAY).used === 0, 'the month resets');
// old entries are dropped
aiCount(sd, aiGate(sd, tok('c'), now + 80 * DAY), now + 80 * DAY); ok(!sd.aiUse['u:free@x'], 'entries older than 70 days go');
ok(tierOf(null, now) === 'free' && tierOf({ active: false, paid: true }, now) === 'free', 'no or blocked licence → free');
console.log('ai-quota:', n, 'passed');
