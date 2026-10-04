// The admin screen's API for leads and prices. (Built into "Admin · Handle" by build-business-workflow.py.)
// Who may call it: only the admin who signed in on the main sign-in (hasadna-auth). There is no separate
// password any more; every call carries the session token and is checked against that workflow.
__SEC__

const AUTH_URL = '__N8N_URL__/webhook/hasadna-auth';
const sd = $getWorkflowStaticData('global');
const now = Date.now();
delete sd.adminKey;   // the old shared password is gone for good

const out = (body, code) => [{ json: { code: code || 200, body } }];
const line = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, n);
sweep();

if (!ORIGIN_OK) return out({ ok: false, error: 'forbidden' }, 403);
const b = $json.body || {};
if (JSON.stringify(b).length > 60000) return out({ ok: false, error: 'too-big' }, 413);
if (!hit('adm-ip', ipKey(), 120, 10 * 60000)) return out({ ok: false, error: 'rate-limited' }, 429);

const token = String(b.token || '');
if (!/^[a-f0-9]{48}$/.test(token)) return out({ ok: false, error: 'admin-only' }, 403);
sd.okTok = sd.okTok || {};
for (const [k, t] of Object.entries(sd.okTok)) if (t < now) delete sd.okTok[k];
const th = sha256hex(token);
if (!(sd.okTok[th] > now)) {
  // ask the sign-in workflow who this is (answers are remembered for one minute)
  let r;
  try {
    r = await this.helpers.httpRequest({ method: 'POST', url: AUTH_URL, headers: { Origin: SITE_ORIGIN, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'action=me&token=' + token, json: true, returnFullResponse: true, ignoreHttpStatusErrors: true, timeout: 15000 });
  } catch (e) { return out({ ok: false, error: 'auth-unreachable' }, 502); }
  const j = r && r.body;
  if (r.statusCode === 200 && j && j.ok) {
    if (j.role !== 'admin') return out({ ok: false, error: 'admin-only' }, 403);   // a client is not the admin
    sd.okTok[th] = now + 60000;
  } else if (r.statusCode === 401 || r.statusCode === 403) return out({ ok: false, error: 'admin-only' }, 403);
  else return out({ ok: false, error: 'auth-error', detail: r.statusCode }, 502);
}

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

}
return out({ ok: false, error: 'unknown-action' }, 400);
