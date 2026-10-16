// פריים מגנטים (frame-studio): the business's data on the Worker, in its own Durable Object ("frame"), so nothing lives only in
// one browser and nothing is lost. Who is asking is decided by the Worker from the sign-in session (main object) before a call
// reaches here: { role: 'admin' | 'client', email } or null. Nothing a page sends can change that.
//   public  GET  /frame-site            the site's published content and the owner's frames (no private fields)
//           GET  /frame-file?id=...     one of the owner's PNG frames
//   signed  POST /frame-biz {action}    a customer's own saved designs; the owner: content, deals, payments, expenses,
//                                       settings (bank details), frames and every customer's designs
// Card numbers are never stored: card payments go through the payment provider's link.

const CHUNK = 100000;                  // a stored value may be up to 128 KiB; long values are split
const MAX_DESIGN = 1800000, MAX_DESIGNS = 40, MAX_FRAME = 4200000, MAX_DEAL = 300000;
const ID = /^[\w-]{1,48}$/;
const EMAIL = /^[^@\s]{1,80}@[^@\s]{1,80}\.[^@\s]{1,20}$/;
// what the public site may see of the content the owner saved
const PUBLIC = ['name', 'owner', 'phone', 'whatsapp', 'email', 'instagram', 'facebook', 'website', 'tagline', 'areas', 'hours', 'credit',
  'packages', 'extras', 'packagesNote', 'faq', 'events', 'reviews', 'googleReviews', 'busy', 'texts', 'hideFrames'];

const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, n || 200);
const json = (o) => JSON.stringify(o);
function luhn(d) { let s = 0; for (let i = 0; i < d.length; i++) { let n = +d[d.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } s += n; } return s % 10 === 0; }
export function hasCard(text) { return (String(text).match(/\d(?:[ -]?\d){12,18}/g) || []).some((m) => { const d = m.replace(/\D/g, ''); return d.length >= 13 && d.length <= 19 && /^[2-6]/.test(d) && luhn(d); }); }

export class FrameStore {
  constructor(storage) { this.s = storage; }
  async getBig(key) {
    const m = await this.s.get(key); if (!m) return null;
    if (typeof m === 'string') return m;
    const parts = await this.s.get(Array.from({ length: m.n }, (_, i) => key + '#' + i));
    let out = ''; for (let i = 0; i < m.n; i++) { const p = parts.get(key + '#' + i); if (p == null) return null; out += p; }
    return out;
  }
  async putBig(key, str) {
    await this.delBig(key);
    if (str.length <= CHUNK) return this.s.put(key, str);
    const n = Math.ceil(str.length / CHUNK), batch = {};
    for (let i = 0; i < n; i++) batch[key + '#' + i] = str.slice(i * CHUNK, (i + 1) * CHUNK);
    await this.s.put(batch); await this.s.put(key, { n, len: str.length });
  }
  async delBig(key) {
    const m = await this.s.get(key);
    if (m && typeof m === 'object' && m.n) await this.s.delete(Array.from({ length: m.n }, (_, i) => key + '#' + i));
    await this.s.delete(key);
  }
  async list(prefix) { const m = await this.s.list({ prefix }); return [...m.entries()].filter(([k]) => !k.includes('#')); }
}

/* ---------- public ---------- */
export async function frameSite(storage) {
  const st = new FrameStore(storage);
  const site = JSON.parse((await st.getBig('site')) || 'null');
  const frames = ((await storage.get('frames')) || []).filter((f) => !f.hidden).map((f) => ({ id: f.id, name: f.name, for: f.for || [], v: f.v || 1 }));
  const pub = {}; if (site) for (const k of PUBLIC) if (k in site) pub[k] = site[k];
  return { ok: true, site: site ? pub : null, frames, at: (await storage.get('siteAt')) || null };
}
export async function frameFile(storage, id) {
  if (!ID.test(String(id || ''))) return null;
  const f = ((await storage.get('frames')) || []).find((x) => x.id === id && !x.hidden);
  if (!f) return null;
  const b64 = await new FrameStore(storage).getBig('ff:' + id);
  if (!b64) return null;
  const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

/* ---------- signed in ---------- */
// who: { role, email } from the session, or null. Answers { code, body }.
export async function frameBiz(storage, who, b) {
  const st = new FrameStore(storage), out = (body, code) => ({ code: code || 200, body });
  if (!who || !who.email) return out({ ok: false, error: 'signed-out' }, 401);
  const admin = who.role === 'admin', me = String(who.email).toLowerCase();
  const a = String(b.action || '');

  // ---- a person's own designs (customers and the owner alike)
  if (a === 'me') return out({ ok: true, role: who.role, email: me });
  if (a === 'designs') return out({ ok: true, designs: (await storage.get('di:' + me)) || [] });
  if (a === 'design-get') {
    if (!ID.test(String(b.id || ''))) return out({ ok: false, error: 'bad-input' }, 400);
    const d = await st.getBig('d:' + me + ':' + b.id);
    return d ? out({ ok: true, design: JSON.parse(d) }) : out({ ok: false, error: 'not-found' }, 404);
  }
  if (a === 'design-save') {
    const d = b.design; if (!d || typeof d !== 'object' || !ID.test(String(d.id || ''))) return out({ ok: false, error: 'bad-input' }, 400);
    const s = json(d); if (s.length > MAX_DESIGN) return out({ ok: false, error: 'too-big' }, 413);
    const idx = (await storage.get('di:' + me)) || [];
    const thumb = typeof d.thumb === 'string' && /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(d.thumb) && d.thumb.length < 60000 ? d.thumb : '';
    const row = { id: d.id, name: clean(d.name, 60), type: clean(d.type, 20), at: Date.now(), thumb };
    const i = idx.findIndex((x) => x.id === d.id);
    if (i < 0 && idx.length >= MAX_DESIGNS) return out({ ok: false, error: 'too-many' }, 400);
    if (i < 0) idx.unshift(row); else idx[i] = row;
    await st.putBig('d:' + me + ':' + d.id, s); await storage.put('di:' + me, idx);
    return out({ ok: true, at: row.at });
  }
  if (a === 'design-del') {
    if (!ID.test(String(b.id || ''))) return out({ ok: false, error: 'bad-input' }, 400);
    await st.delBig('d:' + me + ':' + b.id);
    await storage.put('di:' + me, ((await storage.get('di:' + me)) || []).filter((x) => x.id !== b.id));
    return out({ ok: true });
  }

  // ---- everything below is the owner's
  if (!admin) return out({ ok: false, error: 'admin-only' }, 403);

  if (a === 'all') {
    const site = JSON.parse((await st.getBig('site')) || 'null');
    const deals = [];
    for (const [k, v] of await st.list('deal:')) { const s = typeof v === 'string' ? v : await st.getBig(k); try { if (s) deals.push(JSON.parse(s)); } catch (e) { /* skip a broken one */ } }
    const expenses = []; for (const [, v] of await st.list('exp:')) expenses.push(v);
    const customers = []; for (const [k, v] of await st.list('di:')) customers.push({ email: k.slice(3), designs: (v || []).length, last: (v || []).reduce((m, x) => Math.max(m, x.at || 0), 0) });
    return out({ ok: true, site, siteAt: (await storage.get('siteAt')) || null, settings: (await storage.get('settings')) || {}, deals: deals.filter((x) => x && x.id),
      expenses, frames: (await storage.get('frames')) || [], customers });
  }
  if (a === 'site-save') {
    const s = b.site; if (!s || typeof s !== 'object' || Array.isArray(s)) return out({ ok: false, error: 'bad-input' }, 400);
    const keep = {}; for (const k of PUBLIC) if (k in s) keep[k] = s[k];
    const txt = json(keep); if (txt.length > 400000) return out({ ok: false, error: 'too-big' }, 413);
    await st.putBig('site', txt); await storage.put('siteAt', new Date().toISOString());
    return out({ ok: true });
  }
  if (a === 'settings-save') {
    const s = b.settings; if (!s || typeof s !== 'object') return out({ ok: false, error: 'bad-input' }, 400);
    if (json(s).length > 60000) return out({ ok: false, error: 'too-big' }, 413);
    // card numbers are refused: they never belong here (a 13-19 digit number that passes the card checksum)
    if (hasCard(json(s).replace(/https?:[^"\s]+/g, ''))) return out({ ok: false, error: 'card-number' }, 400);   // nested fields too
    await storage.put('settings', s);
    return out({ ok: true });
  }
  if (a === 'deal-save' || a === 'deals-import') {
    const list = a === 'deals-import' ? (Array.isArray(b.deals) ? b.deals : []) : [b.deal];
    if (!list.length || list.length > 500) return out({ ok: false, error: 'bad-input' }, 400);
    let saved = 0, skipped = 0;
    for (const d of list) {
      if (!d || typeof d !== 'object' || !ID.test(String(d.id || ''))) { skipped++; continue; }
      const s = json(d); if (s.length > MAX_DEAL) { skipped++; continue; }
      if (a === 'deals-import') { const cur = await st.getBig('deal:' + d.id); if (cur && (JSON.parse(cur).updatedAt || 0) >= (d.updatedAt || 0)) { skipped++; continue; } }
      await st.putBig('deal:' + d.id, s); saved++;
    }
    return out({ ok: true, saved, skipped });
  }
  if (a === 'deal-del' || a === 'expense-del') {
    if (!ID.test(String(b.id || ''))) return out({ ok: false, error: 'bad-input' }, 400);
    if (a === 'deal-del') await st.delBig('deal:' + b.id); else await storage.delete('exp:' + b.id);
    return out({ ok: true });
  }
  if (a === 'expense-save') {
    const e = b.expense; if (!e || !ID.test(String(e.id || ''))) return out({ ok: false, error: 'bad-input' }, 400);
    const row = { id: e.id, date: /^\d{4}-\d{2}-\d{2}$/.test(e.date || '') ? e.date : new Date().toISOString().slice(0, 10), desc: clean(e.desc, 120), cat: clean(e.cat, 40),
      amount: Math.round(Number(e.amount) * 100) / 100 || 0, vat: !!e.vat, supplier: clean(e.supplier, 80), ref: clean(e.ref, 40), at: Date.now() };
    await storage.put('exp:' + row.id, row);
    return out({ ok: true, expense: row });
  }
  if (a === 'frame-add') {
    const data = String(b.data || '').replace(/^data:image\/png;base64,/, '');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data) || data.length > MAX_FRAME || !data.startsWith('iVBORw0KGgo')) return out({ ok: false, error: 'bad-image' }, 400);
    const frames = (await storage.get('frames')) || []; if (frames.length >= 60) return out({ ok: false, error: 'too-many' }, 400);
    const id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await st.putBig('ff:' + id, data);
    frames.push({ id, name: clean(b.name, 40) || 'מסגרת', for: (Array.isArray(b.for) ? b.for : []).map((x) => clean(x, 20)).slice(0, 12), hidden: false, v: 1, at: new Date().toISOString() });
    await storage.put('frames', frames);
    return out({ ok: true, id, frames });
  }
  if (a === 'frame-update' || a === 'frame-del') {
    const frames = (await storage.get('frames')) || [], f = frames.find((x) => x.id === b.id);
    if (!f) return out({ ok: false, error: 'not-found' }, 404);
    if (a === 'frame-del') { await st.delBig('ff:' + f.id); frames.splice(frames.indexOf(f), 1); }
    else { if ('name' in b) f.name = clean(b.name, 40) || f.name; if ('hidden' in b) f.hidden = !!b.hidden; if (Array.isArray(b.for)) f.for = b.for.map((x) => clean(x, 20)).slice(0, 12); }
    await storage.put('frames', frames);
    return out({ ok: true, frames });
  }
  if (a === 'designs-of') {
    const e = String(b.email || '').toLowerCase(); if (!EMAIL.test(e)) return out({ ok: false, error: 'bad-input' }, 400);
    return out({ ok: true, designs: (await storage.get('di:' + e)) || [] });
  }
  if (a === 'design-of') {
    const e = String(b.email || '').toLowerCase(); if (!EMAIL.test(e) || !ID.test(String(b.id || ''))) return out({ ok: false, error: 'bad-input' }, 400);
    const d = await st.getBig('d:' + e + ':' + b.id);
    return d ? out({ ok: true, design: JSON.parse(d) }) : out({ ok: false, error: 'not-found' }, 404);
  }
  return out({ ok: false, error: 'unknown-action' }, 400);
}
