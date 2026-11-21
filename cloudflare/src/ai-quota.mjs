// AI designs (restyle / image on the hubs route) are paid for by the owner's Cloudflare account, so each studio licence
// gets its own allowance and the owner none at all. Counted on the server, by the sign-in session; only a design that
// came back counts. Pure functions here; the main object (where the sessions and licences are) keeps the counts.
import * as nodeCrypto from 'node:crypto';

const sha256 = (s) => nodeCrypto.createHash('sha256').update(s).digest('hex');
const DAY = 86400000;
// the same rules as planOf in n8n/snippets/access-handle.js (trial: 2 events or 30 days, never past 90 days)
const TRIAL = { events: 2, days: 30, maxDays: 90 };

// how many designs each plan gets, and over what period. 'day' / 'month' reset by the Israeli calendar; 'trial' and
// 'pass' are one allowance for the whole trial or pass.
export const AI_PLANS = {
  free: { max: 15, per: 'day' },
  trial: { max: 150, per: 'trial' },
  pass: { max: 300, per: 'pass' },
  pro: { max: 1500, per: 'month' },
};
// signed-out callers (other sites, old pages) share one pool, so they can't use up the owner's account either
export const AI_ANON_DAY = 300;

export function tierOf(L, now) {
  if (!L || L.active === false) return 'free';
  if (L.paid && (!L.paidUntil || Date.parse(L.paidUntil) > now)) return 'pro';
  if (L.giftUntil && Date.parse(L.giftUntil) > now) return 'pro';   // the owner's gift (lic-gift): the full program
  if (L.passUntil && Date.parse(L.passUntil) > now) return 'pass';
  if (L.trial) {
    const st = Date.parse(L.trial.start) || now, ev = (L.trial.events || []).length;
    if (now < st + TRIAL.maxDays * DAY && (ev < TRIAL.events || now < st + TRIAL.days * DAY)) return 'trial';
  }
  return 'free';
}

const ilDay = (t) => new Date(t + 2 * 3600000).toISOString().slice(0, 10);   // close enough to Israel for a daily reset
function periodOf(tier, L, now) {
  const p = AI_PLANS[tier].per;
  if (p === 'day') return 'd' + ilDay(now);
  if (p === 'month') return 'm' + ilDay(now).slice(0, 7);
  if (p === 'pass') return 'p' + String(L && L.passUntil || '');
  return 't' + String(L && L.trial && L.trial.start || '');
}

// who is asking, and how many designs are left. { owner: true } = no limit. key = where the count is kept.
export function aiGate(sd, token, now) {
  const t = String(token || '');
  const s = /^[a-f0-9]{48}$/.test(t) ? (sd.sessions || {})[sha256(t)] : null;
  if (!s || s.exp <= now || s.mc) return { key: 'anon', tier: 'anon', period: 'd' + ilDay(now), max: AI_ANON_DAY, used: used(sd, 'anon', 'd' + ilDay(now)) };
  if (s.role === 'admin') return { owner: true };
  const email = String(s.lic || s.email || '').toLowerCase(), L = (sd.licenses || {})[email];
  if (L && L.owner) return { owner: true };
  const tier = s.role === 'studio' ? tierOf(L, now) : 'free', plan = AI_PLANS[tier];
  // the owner sets a licence's own number a month in the admin's licences (licence field aiMax); 0 stops its AI
  const own = !!(L && Number.isFinite(L.aiMax)), per = own ? 'month' : plan.per, period = own ? 'm' + ilDay(now).slice(0, 7) : periodOf(tier, L, now);
  return { key: 'u:' + email, tier, period, per, max: own ? L.aiMax : plan.max, used: used(sd, 'u:' + email, period) };
}

function used(sd, key, period) { const u = (sd.aiUse || {})[key]; return u && u.p === period ? u.n : 0; }

// one design came back: count it (the use map stays small: an entry is kept 70 days after its last use)
export function aiCount(sd, g, now) {
  if (!g || g.owner || !g.key) return sd;
  const m = sd.aiUse = sd.aiUse || {};
  const old = m[g.key] || {}, u = old.p === g.period ? old : { p: g.period, n: 0 };
  // and the history the owner's admin shows: designs by month (13 months) and in all
  const ym = ilDay(now).slice(0, 7), mo = Object.assign({}, old.m || {}); mo[ym] = (mo[ym] || 0) + 1;
  for (const k of Object.keys(mo).sort().slice(0, -13)) delete mo[k];
  m[g.key] = { p: g.period, n: u.n + 1, at: now, m: mo, t: (old.t || 0) + 1 };
  for (const k of Object.keys(m)) if (!(m[k].at > now - 400 * DAY)) delete m[k];
  return sd;
}

// what the studio shows: left of how many, and when it starts again
export function aiLeft(g) {
  if (!g || g.owner) return { unlimited: true };
  return { tier: g.tier, max: g.max, used: g.used, left: Math.max(0, g.max - g.used), per: g.per || 'day' };
}
