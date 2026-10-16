// פריים מגנטים (frame-studio): the business's data on the Worker, in its own Durable Object ("frame"), so nothing lives only in
// one browser and nothing is lost. Who is asking is decided by the Worker from the sign-in session (main object) before a call
// reaches here: { role: 'admin' | 'client', email } or null. Nothing a page sends can change that.
//   public  GET  /frame-site            the site's published content and the owner's frames (no private fields)
//           GET  /frame-file?id=...     one of the owner's PNG frames
//   signed  POST /frame-biz {action}    a customer's own saved designs; the owner: content, deals, payments, expenses,
//                                       settings (bank details), frames and every customer's designs
//   public  POST /frame-book            a booking request from the site (date, event, contact); the server checks the
//                                       calendar, keeps it as "pending" and tells the owner; only the owner approves
//   secret  GET  /frame-cal?k=...       the owner's events as an iCalendar feed (Google Calendar "from URL")
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

const DAY = /^\d{4}-\d{2}-\d{2}$/;
// today in Israel, as YYYY-MM-DD
export const today = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(t ? new Date(t) : new Date());
const addDays = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const TERMS = ['הזמנת התאריך נכנסת לתוקף עם תשלום המקדמה.', 'יתרת התשלום תשולם עד יום האירוע.', 'ביטול עד 30 יום לפני האירוע: המקדמה מוחזרת בניכוי 10%. ביטול מאוחר יותר: המקדמה אינה מוחזרת.', 'שינוי מועד בתיאום ובכפוף לזמינות.', 'הלקוח/ה מאשר/ת שימוש בתמונות לדוגמה באתר ובמדיה, אלא אם ביקש/ה אחרת בכתב.'].join('\n');
const MAX_REQUESTS = 3000;
// a deal holds its date when it was closed or something was paid (a quote does not)
const holds = (d) => d && DAY.test(d.date || '') && !d.cancelled && (d.closed || (Array.isArray(d.payments) && d.payments.length > 0));
const dealTitle = (d) => [d.typeName || d.type || 'אירוע', (d.client && d.client.name) || ''].filter(Boolean).join(' · ');

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

/* ---------- the calendar: which dates are held ---------- */
// "cal" keeps { dealId: {d, t, v, ph, no} } for the deals that hold a date, so the public site and a booking request never have to
// read every deal. It is rebuilt from the deals when missing.
async function calIndex(storage, st) {
  let cal = await storage.get('cal');
  if (cal) return cal;
  cal = {};
  for (const [k, v] of await st.list('deal:')) { try { const d = JSON.parse(typeof v === 'string' ? v : await st.getBig(k)); if (holds(d)) cal[d.id] = calRow(d); } catch (e) { /* skip */ } }
  await storage.put('cal', cal);
  return cal;
}
const calRow = (d) => ({ d: d.date, t: clean(dealTitle(d), 80), v: clean(d.venue, 80), ph: clean(d.client && d.client.phone, 20), no: d.no || null, tm: clean(d.time, 10) });
async function calSet(storage, st, d, gone) {
  const cal = await calIndex(storage, st);
  if (!gone && holds(d)) cal[d.id] = calRow(d); else delete cal[d.id];
  await storage.put('cal', cal);
}
// the state of one date: deals on it, the owner's own busy dates, pending requests, and whether another event still fits
async function dateState(storage, st, date, skipRq) {
  const cal = await calIndex(storage, st), settings = (await storage.get('settings')) || {};
  const site = JSON.parse((await st.getBig('site')) || 'null') || {};
  const perDay = Math.max(1, Math.min(10, Number(settings.perDay) || 1));
  const deals = Object.entries(cal).filter(([, r]) => r.d === date).map(([id, r]) => ({ id, title: r.t, no: r.no }));
  const busy = Array.isArray(site.busy) && site.busy.includes(date);
  const pending = [];
  for (const [, r] of await st.list('rq:')) if (r && r.date === date && r.status === 'pending' && r.id !== skipRq) pending.push({ id: r.id, ref: r.ref, name: r.name });
  return { date, free: !busy && deals.length < perDay, busy, deals, pending, perDay };
}
// the public list of dates that are full (dates only, never who or what)
async function takenDates(storage, st) {
  const cal = await calIndex(storage, st), settings = (await storage.get('settings')) || {}, from = today();
  const perDay = Math.max(1, Math.min(10, Number(settings.perDay) || 1)), n = {};
  for (const r of Object.values(cal)) if (r.d >= from) n[r.d] = (n[r.d] || 0) + 1;
  return Object.keys(n).filter((d) => n[d] >= perDay).sort();
}

/* ---------- public ---------- */
export async function frameSite(storage) {
  const st = new FrameStore(storage);
  const site = JSON.parse((await st.getBig('site')) || 'null');
  const frames = ((await storage.get('frames')) || []).filter((f) => !f.hidden).map((f) => ({ id: f.id, name: f.name, for: f.for || [], v: f.v || 1 }));
  const pub = {}; if (site) for (const k of PUBLIC) if (k in site) pub[k] = site[k];
  return { ok: true, site: site ? pub : null, frames, taken: await takenDates(storage, st), at: (await storage.get('siteAt')) || null };
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

// a booking request from the site. who: the signed-in customer, or null (anyone may ask). Answers { code, body, notify }:
// notify is the saved request, for the owner's email / WhatsApp and the customer's email.
export async function frameBook(storage, who, b) {
  const st = new FrameStore(storage), out = (body, code, notify) => ({ code: code || 200, body, notify });
  if (b.website) return out({ ok: true, id: 'x', ref: '—', free: true });          // a bot filled the hidden field: pretend
  const r = {
    name: clean(b.name, 60).trim(), phone: clean(b.phone, 24).trim(), email: clean(b.email, 120).trim().toLowerCase(),
    date: String(b.date || ''), time: clean(b.time, 10), type: clean(b.type, 24), typeName: clean(b.typeName, 40), guests: clean(b.guests, 20),
    venue: clean(b.venue, 100), pkg: clean(b.pkg, 60), notes: clean(b.notes, 800), from: clean(b.from, 20) || 'site'
  };
  const today0 = today();
  if (r.name.length < 2 || (r.phone.match(/\d/g) || []).length < 9 || !/^[\d+\-\s().]+$/.test(r.phone)) return out({ ok: false, error: 'bad-contact' }, 400);
  if (r.email && !EMAIL.test(r.email)) return out({ ok: false, error: 'bad-email' }, 400);
  if (!DAY.test(r.date) || isNaN(Date.parse(r.date)) || r.date < today0 || r.date > addDays(today0, 1100)) return out({ ok: false, error: 'bad-date' }, 400);
  if (hasCard(json(r))) return out({ ok: false, error: 'card-number' }, 400);
  const all = await st.list('rq:');
  if (all.length >= MAX_REQUESTS) return out({ ok: false, error: 'full' }, 503);
  // the same phone asking for the same date again updates the open request instead of adding another
  const same = all.map(([, v]) => v).find((x) => x && x.status === 'pending' && x.date === r.date && x.phone.replace(/\D/g, '') === r.phone.replace(/\D/g, ''));
  const state = await dateState(storage, st, r.date, same && same.id);
  const no = same ? same.ref : 'R-' + (((await storage.get('rqNo')) || 100) + 1);
  if (!same) await storage.put('rqNo', Number(no.slice(2)));
  const row = Object.assign(same || { id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ref: no, at: Date.now() }, r, {
    by: who && who.email ? String(who.email).toLowerCase() : '', status: 'pending', freeAtAsk: state.free, updatedAt: Date.now() });
  if (!row.email && row.by) row.email = row.by;
  await storage.put('rq:' + row.id, row);
  return out({ ok: true, id: row.id, ref: row.ref, free: state.free, again: !!same }, 200, { request: row, state });
}

// the owner's calendar as iCalendar (approved events, and pending requests as tentative). k: the secret from the admin.
export async function frameCal(storage, k) {
  const key = await storage.get('calKey');
  if (!key || typeof k !== 'string' || k.length !== key.length) return null;
  let diff = 0; for (let i = 0; i < k.length; i++) diff |= k.charCodeAt(i) ^ key.charCodeAt(i);
  if (diff) return null;
  const st = new FrameStore(storage), cal = await calIndex(storage, st), from = addDays(today(), -60);
  const esc = (t) => String(t || '').replace(/[\\;,]/g, (c) => '\\' + c).replace(/\r?\n/g, '\\n');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const ev = (uid, date, title, desc, tentative) => ['BEGIN:VEVENT', 'UID:' + uid + '@frame-studio', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + date.replace(/-/g, ''),
    'DTEND;VALUE=DATE:' + addDays(date, 1).replace(/-/g, ''), 'SUMMARY:' + esc(title), desc ? 'DESCRIPTION:' + esc(desc) : '', tentative ? 'STATUS:TENTATIVE' : 'STATUS:CONFIRMED', 'END:VEVENT'].filter(Boolean).join('\r\n');
  const rows = [];
  for (const [id, r] of Object.entries(cal)) if (r.d >= from) rows.push(ev(id, r.d, '🧲 ' + r.t, [r.no ? 'עסקה ' + r.no : '', r.tm ? 'שעה ' + r.tm : '', r.v, r.ph].filter(Boolean).join('\n'), false));
  for (const [, q] of await st.list('rq:')) if (q && q.status === 'pending' && q.date >= today()) rows.push(ev(q.id, q.date, '❓ בקשה ' + q.ref + ': ' + (q.typeName || q.type || 'אירוע') + ' · ' + q.name, [q.phone, q.venue, q.guests ? 'אורחים: ' + q.guests : ''].filter(Boolean).join('\n'), true));
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//frame-studio//he', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:פריים מגנטים · אירועים', 'X-WR-TIMEZONE:Asia/Jerusalem'].concat(rows, ['END:VCALENDAR']).join('\r\n') + '\r\n';
}

/* ---------- signed in ---------- */
// who: { role, email } from the session, or null. Answers { code, body }.
export async function frameBiz(storage, who, b) {
  const st = new FrameStore(storage), out = (body, code, notify) => ({ code: code || 200, body, notify });
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

  if (a === 'my-requests') {
    const list = [];
    for (const [, r] of await st.list('rq:')) if (r && (r.by === me || r.email === me)) list.push({ id: r.id, ref: r.ref, date: r.date, typeName: r.typeName || r.type, status: r.status, at: r.at, answer: r.answer || '' });
    return out({ ok: true, requests: list.sort((x, y) => y.at - x.at) });
  }

  // ---- everything below is the owner's
  if (!admin) return out({ ok: false, error: 'admin-only' }, 403);

  if (a === 'all') {
    const site = JSON.parse((await st.getBig('site')) || 'null');
    const deals = [];
    for (const [k, v] of await st.list('deal:')) { const s = typeof v === 'string' ? v : await st.getBig(k); try { if (s) deals.push(JSON.parse(s)); } catch (e) { /* skip a broken one */ } }
    const expenses = []; for (const [, v] of await st.list('exp:')) expenses.push(v);
    const customers = []; for (const [k, v] of await st.list('di:')) customers.push({ email: k.slice(3), designs: (v || []).length, last: (v || []).reduce((m, x) => Math.max(m, x.at || 0), 0) });
    const requests = []; for (const [, v] of await st.list('rq:')) if (v) requests.push(v);
    return out({ ok: true, site, siteAt: (await storage.get('siteAt')) || null, settings: (await storage.get('settings')) || {}, deals: deals.filter((x) => x && x.id),
      expenses, frames: (await storage.get('frames')) || [], customers, requests: requests.sort((x, y) => y.at - x.at), calKey: (await storage.get('calKey')) || '' });
  }
  if (a === 'date-state') {
    if (!DAY.test(String(b.date || ''))) return out({ ok: false, error: 'bad-input' }, 400);
    return out({ ok: true, state: await dateState(storage, st, b.date, b.skip) });
  }
  if (a === 'request-decide') {
    const r = ID.test(String(b.id || '')) && (await storage.get('rq:' + b.id));
    if (!r) return out({ ok: false, error: 'not-found' }, 404);
    const decision = String(b.decision || '');
    if (!['approve', 'decline', 'pending'].includes(decision)) return out({ ok: false, error: 'bad-input' }, 400);
    const answer = clean(b.answer, 500);
    if (decision === 'approve') {
      if (r.status === 'approved' && r.dealId) return out({ ok: false, error: 'already' }, 409);
      const state = await dateState(storage, st, r.date, r.id);
      if (!state.free && !b.force) return out({ ok: false, error: 'date-taken', state }, 409);
      // the approved request becomes a closed deal with the next number, its price from the package on the site
      const settings = (await storage.get('settings')) || {}, pay = settings.pay || {}, site = JSON.parse((await st.getBig('site')) || 'null') || {};
      const pk = (site.packages || []).find((p) => p && p.name === r.pkg), price = Number(String(b.price != null && b.price !== '' ? b.price : (pk && pk.price) || '').replace(/[^\d.]/g, '')) || 0;
      let no = 1000; for (const [k, v] of await st.list('deal:')) { try { const d = JSON.parse(typeof v === 'string' ? v : await st.getBig(k)); no = Math.max(no, Number(d.no) || 0); } catch (e) { /* skip */ } }
      const now = Date.now(), deal = { id: 'd' + now.toString(36) + Math.random().toString(36).slice(2, 6), no: no + 1, createdAt: now, updatedAt: now,
        client: { name: r.name, phone: r.phone, email: r.email || '', idNo: '', address: '' }, type: r.type || 'wedding', typeName: r.typeName || '', date: r.date, time: r.time || '', venue: r.venue, guests: r.guests,
        pkg: r.pkg, price: price || '', discount: '', extras: [], vatMode: pay.bizType === 'מורשה' ? 'incl' : 'none', deposit: price ? Math.round(price * 0.3) : '', balanceDue: '',
        terms: pay.terms || TERMS, notes: ['בקשת הזמנה ' + r.ref + ' מהאתר', r.notes].filter(Boolean).join('\n'), payments: [], sign: {}, closed: true, closedAt: now, from: 'request', rq: r.id };
      await st.putBig('deal:' + deal.id, json(deal)); await calSet(storage, st, deal);
      Object.assign(r, { status: 'approved', dealId: deal.id, decidedAt: now, answer, updatedAt: now });
      await storage.put('rq:' + r.id, r);
      return out({ ok: true, request: r, deal }, 200, { request: r, decision });
    }
    Object.assign(r, { status: decision === 'decline' ? 'declined' : 'pending', decidedAt: Date.now(), answer, updatedAt: Date.now() });
    await storage.put('rq:' + r.id, r);
    return out({ ok: true, request: r }, 200, decision === 'decline' ? { request: r, decision } : undefined);
  }
  if (a === 'request-del') {
    if (!ID.test(String(b.id || ''))) return out({ ok: false, error: 'bad-input' }, 400);
    await storage.delete('rq:' + b.id);
    return out({ ok: true });
  }
  if (a === 'cal-key') {
    const k = [...crypto.getRandomValues(new Uint8Array(20))].map((x) => x.toString(16).padStart(2, '0')).join('');
    await storage.put('calKey', k);
    return out({ ok: true, calKey: k });
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
    if ('perDay' in s) s.perDay = Math.max(1, Math.min(10, Number(s.perDay) || 1));
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
      await st.putBig('deal:' + d.id, s); await calSet(storage, st, d); saved++;
    }
    return out({ ok: true, saved, skipped });
  }
  if (a === 'deal-del' || a === 'expense-del') {
    if (!ID.test(String(b.id || ''))) return out({ ok: false, error: 'bad-input' }, 400);
    if (a === 'deal-del') { await st.delBig('deal:' + b.id); await calSet(storage, st, { id: b.id }, true); } else await storage.delete('exp:' + b.id);
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
