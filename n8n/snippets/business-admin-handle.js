// Paste into the "Admin · Handle" node of "הסדנה · לידים ומחירון" (replaces its code).
// The admin screen's API. Every call carries the admin password.
const sd = $getWorkflowStaticData('global');
// Optional: write a fixed password here; it then replaces the one chosen from the admin screen.
const ADMIN_KEY = '';

const b = $json.body || {};
const key = String(b.key || '');
const stored = ADMIN_KEY || sd.adminKey || '';
const out = (body, code) => [{ json: { code: code || 200, body } }];
const line = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, n);

if (b.action === 'setup') {
  if (stored) return out({ ok: false, error: 'already-set' }, 403);
  if (key.length < 8) return out({ ok: false, error: 'short' }, 400);
  sd.adminKey = key;
  return out({ ok: true, setup: true });
}
if (!stored) return out({ ok: false, error: 'no-key' }, 403);
if (key !== stored) return out({ ok: false, error: 'bad-key' }, 403);

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

  case 'password': {
    if (ADMIN_KEY) return out({ ok: false, error: 'fixed-in-n8n' }, 400);
    const nk = String(p.newKey || '');
    if (nk.length < 8) return out({ ok: false, error: 'short' }, 400);
    sd.adminKey = nk;
    return out({ ok: true });
  }
}
return out({ ok: false, error: 'unknown-action' }, 400);
