// 🎁 The owner's gifts (free days of the full program) and offers (1+1, percent), for chosen customers or for all
// (n8n/snippets/access-handle.js: lic-gift, lic-offer, the 1+1 in lic-pay, offersFor in usage and in the licence view).
import { run, check, workflow, nodeCode, crypto } from './harness.mjs';

const BASE = nodeCode(workflow('hasadna-access.json'), 'Auth · Handle').replace('__SHARED_KEY__', 'shared-test-key');
const SITE = 'https://devopsdevopshaim-wq.github.io';
let T = 1_800_000_000_000; Date.now = () => T;
const D = 86400000;
const OWNER = (/const ADMIN_EMAIL = '([^']+)'/.exec(BASE) || [])[1];   // the owner's sign-in, as the server itself has it
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

const sd = {};
const ADM = crypto.randomBytes(24).toString('hex');
sd.sessions = { [sha(ADM)]: { email: OWNER, role: 'admin', exp: T + 400 * D, at: T } };
const call = async (body, ip = '10.0.0.1') => (await run(BASE, { json: { body, headers: { 'x-forwarded-for': ip, 'user-agent': 'Mozilla/5.0 (Test)', origin: SITE } }, sd }))[0].json;
const t = '[promos] ';

let r = await call({ action: 'lic-list', token: ADM });
check(t + 'the owner is signed in for the test', r.body.ok, r.body);
await call({ action: 'lic-create', token: ADM, email: 'g1@example.com', name: 'צלם אחד', phone: '0521111111' });
await call({ action: 'lic-create', token: ADM, email: 'g2@example.com', name: 'צלם שניים', phone: '0522222222' });
await call({ action: 'lic-create', token: ADM, email: 'life@example.com', name: 'צלם מלא', phone: '0523333333', paidNow: '1', amount: '1500', method: 'ביט' });

// gifts
r = await call({ action: 'lic-gift', token: ADM, days: '14', to: JSON.stringify(['g1@example.com']), note: 'מבצע פתיחה' });
const g1 = sd.licenses['g1@example.com'];
check(t + 'a 14-day gift to one customer: the full program until then', r.body.ok && r.body.given === 1 && Math.abs(Date.parse(g1.giftUntil) - T - 14 * D) < 1000 && !sd.licenses['g2@example.com'].giftUntil, r.body);
const v1 = r.body.licenses.find((x) => x.email === 'g1@example.com');
check(t + 'the licence view says pro, as a gift', v1.plan.tier === 'pro' && v1.plan.gift === true && !!v1.giftUntil, v1.plan);
r = await call({ action: 'lic-gift', token: ADM, days: '7', to: 'all' });
check(t + 'a week to all: added after the earlier gift; a lifetime licence untouched', r.body.ok && r.body.given === 2 && Math.abs(Date.parse(sd.licenses['g1@example.com'].giftUntil) - T - 21 * D) < 1000 && !sd.licenses['life@example.com'].giftUntil, r.body);
r = await call({ action: 'lic-gift', token: ADM, days: '0', to: 'all' });
check(t + 'a gift is 1-365 days', r.code === 400);
r = await call({ action: 'lic-gift', days: '7', to: 'all' });
check(t + 'only the owner gives gifts', !r.body.ok && (r.code === 401 || r.code === 403), r);
T += 22 * D;
r = await call({ action: 'lic-list', token: ADM });
check(t + 'after the gift: back to what the licence was', r.body.licenses.find((x) => x.email === 'g1@example.com').plan.tier !== 'pro');

// offers
r = await call({ action: 'lic-offer', token: ADM, kind: '1+1', plan: 'month', to: JSON.stringify(['g2@example.com']), until: '2030-01-01', title: 'חודש במתנה' });
const o11 = r.body.ok && r.body.settings.offers.find((o) => o.kind === '1+1');
check(t + 'a 1+1 offer on a month for one customer', !!o11 && o11.plan === 'month' && o11.to[0] === 'g2@example.com', r.body);
r = await call({ action: 'lic-offer', token: ADM, kind: 'percent', plan: 'year', pct: '20', to: 'all' });
check(t + 'a 20% offer on a year for all', r.body.ok && r.body.settings.offers.some((o) => o.kind === 'percent' && o.pct === 20 && o.to === 'all'));
r = await call({ action: 'lic-offer', token: ADM, kind: 'percent', plan: 'year', pct: '95', to: 'all' });
check(t + 'a discount is 1-90%', r.code === 400);
r = await call({ action: 'lic-offer', token: ADM, kind: '1+1', plan: 'full', to: 'all' });
check(t + '1+1 is for a month, a year or a pass', r.code === 400);
r = await call({ action: 'lic-list', token: ADM });
check(t + 'a customer sees the offers meant for them', r.body.licenses.find((x) => x.email === 'g2@example.com').offers.length === 2);
check(t + 'another customer only the one for all', r.body.licenses.find((x) => x.email === 'g1@example.com').offers.map((o) => o.kind).join() === 'percent');

// the owner records a month for g2: 1+1 opens two, once
r = await call({ action: 'lic-pay', token: ADM, email: 'g2@example.com', plan: 'month', amount: '89', method: 'ביט' });
const g2 = sd.licenses['g2@example.com'];
check(t + '1+1: one month paid, two open', r.body.ok && Math.abs(Date.parse(g2.paidUntil) - T - 60 * D) < 1000 && !!(g2.offersUsed || {})[o11.id], { paidUntil: g2.paidUntil });
check(t + 'the 1+1 shows in the history', g2.history.some((h) => /1\+1/.test(h.what)));
r = await call({ action: 'lic-pay', token: ADM, email: 'g2@example.com', plan: 'month', amount: '89', method: 'ביט' });
check(t + 'the next month is one month (the 1+1 was used)', Math.abs(Date.parse(sd.licenses['g2@example.com'].paidUntil) - T - 90 * D) < 1000);
r = await call({ action: 'lic-pay', token: ADM, email: 'g1@example.com', plan: 'month', amount: '89', method: 'ביט' });
check(t + 'a customer without the 1+1 gets one month', Math.abs(Date.parse(sd.licenses['g1@example.com'].paidUntil) - T - 30 * D) < 1000);

// stop and delete
r = await call({ action: 'lic-list', token: ADM });
const op = r.body.settings.offers.find((o) => o.kind === 'percent');
r = await call({ action: 'lic-offer', token: ADM, op: 'stop', id: op.id });
check(t + 'a stopped offer is no longer seen', r.body.ok && !r.body.licenses.find((x) => x.email === 'g1@example.com').offers.length);
r = await call({ action: 'lic-offer', token: ADM, op: 'delete', id: op.id });
check(t + 'and can be deleted', r.body.ok && !r.body.settings.offers.some((o) => o.id === op.id));
