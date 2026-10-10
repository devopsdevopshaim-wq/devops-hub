// The admin screen's API for leads and prices. (Built into "Admin · Handle" by build-business-workflow.py.)
// Who may call it: only the admin who signed in on the main sign-in (hasadna-auth). There is no separate
// password any more; every call carries a short-lived signed proof from that sign-in.
__SEC__

// Shared with the sign-in workflow (derived at install time, never in the repository).
const SHARED = '__SHARED_KEY__';
const set = (v) => !!v && !/^__/.test(v);
const sd = $getWorkflowStaticData('global');
const now = Date.now();
delete sd.adminKey;   // the old shared password is gone for good
delete sd.okTok;

const out = (body, code) => [{ json: { code: code || 200, body } }];
const line = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, n);
sweep();

if (!ORIGIN_OK) return out({ ok: false, error: 'forbidden' }, 403);
const b = $json.body || {};
if (JSON.stringify(b).length > (b.action === 'import' ? 1500000 : 60000)) return out({ ok: false, error: 'too-big' }, 413);
if (!hit('adm-ip', ipKey(), 120, 10 * 60000)) return out({ ok: false, error: 'rate-limited' }, 429);

// Only an admin who signed in on the main sign-in has a proof: "<expiry ms>.<HMAC>" signed with the shared key.
// It is checked by arithmetic alone, so nothing depends on the network, and it expires within 30 minutes.
const m = /^(\d{13})\.([a-f0-9]{64})$/.exec(String(b.token || ''));
if (!m || !set(SHARED)) return out({ ok: false, error: 'admin-only' }, 403);
const exp = Number(m[1]);
if (exp < now || exp > now + 31 * 60000 || !same(m[2], hmacSha256Hex(SHARED, 'biz|' + exp))) return out({ ok: false, error: 'admin-only' }, 403);

let p = {};
try { p = JSON.parse(b.payload || '{}'); } catch (e) { return out({ ok: false, error: 'bad-payload' }, 400); }
sd.leads = sd.leads || [];
const STATUSES = ['new', 'working', 'quoted', 'won', 'lost'];

switch (b.action) {
  case 'list':
    return out({ ok: true, leads: sd.leads, clicks: sd.clicks || {}, prices: sd.prices || null });

  case 'lead': {
    const l = sd.leads.find((x) => x.id === p.id);
    if (!l) return out({ ok: false, error: 'not-found' }, 404);
    if (STATUSES.includes(p.status)) l.status = p.status;
    if (p.note !== undefined) l.note = String(p.note).slice(0, 500);
    l.updatedAt = new Date().toISOString();
    return out({ ok: true, lead: l });
  }

  // Moving to another server: the leads, the click counts and the price list of the old one (a lead already here, by id, is kept as it is)
  case 'import': {
    const text = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ').trim().slice(0, n);
    const have = new Set(sd.leads.map((x) => x.id));
    let added = 0;
    for (const l of (Array.isArray(p.leads) ? p.leads : []).slice(0, 2000)) {
      if (!l || !/^[\w-]{4,40}$/.test(String(l.id || '')) || have.has(l.id)) continue;
      have.add(l.id);
      sd.leads.push({ id: l.id, at: Date.parse(l.at) ? new Date(l.at).toISOString() : new Date(now).toISOString(), name: line(l.name, 60), phone: line(l.phone, 20), biz: line(l.biz, 80), service: line(l.service, 80),
        msg: text(l.msg, 800), code: line(l.code, 20), page: line(l.page, 200), status: STATUSES.includes(l.status) ? l.status : 'new', note: text(l.note, 500) });
      added++;
    }
    sd.leads.sort((a, c) => String(c.at).localeCompare(String(a.at)));
    if (sd.leads.length > 2000) sd.leads.length = 2000;
    sd.clicks = sd.clicks || {};
    if (p.clicks && typeof p.clicks === 'object') for (const k of Object.keys(p.clicks).slice(0, 30)) { const n = Math.max(0, Math.round(Number(p.clicks[k]) || 0)); if (n && (k in sd.clicks || Object.keys(sd.clicks).length < 30)) sd.clicks[line(k, 40)] = (sd.clicks[line(k, 40)] || 0) + n; }
    let prices = false;
    if (p.prices && typeof p.prices === 'object' && !sd.prices) { sd.prices = JSON.parse(JSON.stringify(p.prices).slice(0, 40000)); prices = true; }
    return out({ ok: true, leads: added, prices });
  }

  case 'lead-delete':
    sd.leads = sd.leads.filter((x) => x.id !== p.id);
    return out({ ok: true });

  case 'prices': {
    if (p.reset) { delete sd.prices; return out({ ok: true, prices: null }); }
    const services = {};
    Object.keys(p.services || {}).slice(0, 40).forEach((id) => {
      const s = p.services[id] || {};
      const from = Math.max(0, Math.round(Number(s.from) || 0));
      services[line(id, 40)] = { title: line(s.title, 80), from, unit: line(s.unit, 30), hidden: !!s.hidden };
    });
    const offers = (Array.isArray(p.offers) ? p.offers : []).slice(0, 12).map((o) => ({
      tag: line(o.tag, 20), title: line(o.title, 100), text: line(o.text, 300),
      until: /^\d{4}-\d{2}-\d{2}$/.test(o.until || '') ? o.until : '',
      code: line(o.code, 20).toUpperCase(), active: o.active !== false
    })).filter((o) => o.title);
    // services added from the admin screen
    const extra = (Array.isArray(p.extra) ? p.extra : []).slice(0, 20).map((x, i) => ({
      id: /^x-[a-z0-9-]{1,40}$/.test(x.id || '') ? x.id : 'x-' + Date.now().toString(36) + i,
      title: line(x.title, 80), pitch: line(x.pitch, 300), unit: line(x.unit, 30),
      from: Math.max(0, Math.round(Number(x.from) || 0)), icon: line(x.icon, 4) || '✦', hidden: !!x.hidden
    })).filter((x) => x.title);
    // subscription prices for access to the sites (used by the payments screen too)
    const plans = {};
    ['day', 'week', 'month', 'year'].forEach((k) => { const v = Math.round(Number((p.plans || {})[k]) || 0); if (v > 0) plans[k] = v; });
    sd.prices = { services, extra, plans, offers, note: line(p.note, 300), updatedAt: new Date().toISOString() };
    return out({ ok: true, prices: sd.prices });
  }

}
return out({ ok: false, error: 'unknown-action' }, 400);
