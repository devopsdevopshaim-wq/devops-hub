// פריים מגנטים: the live event. Guests scan a QR code on the table, take a photo on their phone (with a name, a greeting
// and a short voice message if they like) and it reaches the studio's print queue. Several stations share one queue: each
// photo is handed to one station only. A big screen in the hall and the couple's gallery read the same photos with a
// separate viewing key. The owner of an event is the signed-in studio (the business owner or a licensed studio).
//   public  POST /frame-live {action:'guest-info'|'guest-up', e, k}      k = the guests' key (in the QR code)
//           POST /frame-live {action:'feed', e, v}                        v = the viewing key (big screen, couple's gallery)
//           GET  /frame-live-img?e=&p=&v=[&a=1]                           one photo (or its voice message)
//   signed  POST /frame-live {action, token}                              the event's owner: events, queue, marks, reports
//           POST /frame-live {action:'magic'|'capsule-put', e, c}           c = a printed magnet's own code (its QR): that magnet only
//           POST /frame-live {action:'capsules'|'find', e, v}              the time capsule (after its date) and "find me" by face
//           GET  /frame-live-img?e=&c=&k=img|mask|audio                    a printed magnet, its person mask, its greeting
// Photos are deleted 60 days after the event; magnets with a code (the living magnets) stay MAGIC_DAYS, the time capsule
// until a while after it opens; the event's numbers stay for the reports.
import { FrameStore, hasCard, today } from './frame.mjs';

const ID = /^[a-z0-9]{6,24}$/, KEY = /^[a-f0-9]{24}$/, PID = /^[a-z0-9]{6,24}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^@\s]{1,80}@[^@\s]{1,80}\.[^@\s]{1,20}$/;
const MAX_IMG = 1700000, MAX_AUDIO = 700000, MAX_PHOTOS = 1500, MAX_EVENTS = 400, KEEP_DAYS = 60;
const CODE = /^[a-z0-9]{10,16}$/, MAX_MASK = 600000, MAX_CAPSULES = 3000, MAGIC_DAYS = 400, CAPSULE_KEEP_DAYS = 120, MAX_FACES = 12, DESC = /^[A-Za-z0-9+/]{40,400}={0,2}$/;
const addYear = (iso) => { const [y, m, d] = String(iso).split('-').map(Number); return String(y + 1) + '-' + String(m).padStart(2, '0') + '-' + String(m === 2 && d === 29 ? 28 : d).padStart(2, '0'); };
export const capsuleOpens = (ev) => addYear(ev.date || today());
const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, n || 200);
const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
const rid = (n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map((x) => x.toString(16).padStart(2, '0')).join(''); };
const sid = () => { const a = new Uint8Array(10); crypto.getRandomValues(a); return [...a].map((x) => 'abcdefghijkmnpqrstuvwxyz23456789'[x % 32]).join(''); };
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;
const addDays = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const out = (body, code) => ({ code: code || 200, body });

// what the owner sees of an event (with the keys) and what the public sees (without)
function ownerView(ev) {
  return { id: ev.id, title: ev.title, date: ev.date, dealId: ev.dealId || '', couple: ev.couple || {}, open: ev.open !== false, copies: ev.copies || 1,
    cost: ev.cost || 0, price: ev.price || 0, album: ev.album !== false, design: ev.design || null, k: ev.k, v: ev.v, n: ev.n || {}, stations: ev.stations || {}, created: ev.created,
    reviewAt: ev.reviewAt || null, purged: !!ev.purged };
}
const isOwner = (who, ev) => who && ev && (ev.owner === who.email);
async function getEv(storage, e) { return ID.test(String(e || '')) ? storage.get('lv:' + e) : null; }
const metaOf = (m) => ({ id: m.id, at: m.at, name: m.name || '', text: m.text || '', audio: !!m.audio, src: m.src, st: m.st, station: m.station || '', copies: m.copies || 1 });

// one photo or its voice message, for the big screen and the gallery (viewing key) or the owner's station
// kind: '' (the photo), 'audio', 'mask', 'hero' (the couple's photo for the mosaic), 'cap' (a capsule's voice, once it opened);
// or by a magnet's own code c instead of the viewing key: k = img | mask | audio of that magnet only
export async function liveFile(storage, e, p, v, kind, c, k) {
  if (kind === true) kind = 'audio';
  const ev = await getEv(storage, e); if (!ev) return null;
  const st = new FrameStore(storage), bytes = (b64) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  if (c) {
    if (!CODE.test(String(c))) return null;
    const id = await storage.get('lcode:' + e + ':' + c), m = id && await storage.get('lp:' + e + ':' + id); if (!m || m.st === 'hidden') return null;
    const key = k === 'mask' ? 'lm:' : k === 'audio' ? 'la:' : 'li:', b64 = await st.getBig(key + e + ':' + id); if (!b64) return null;
    return { u: bytes(b64), mime: k === 'audio' ? (m.amime || 'audio/webm') : k === 'mask' ? (m.mmime || 'image/jpeg') : 'image/jpeg' };
  }
  if (!KEY.test(String(v || '')) || v !== ev.v) return null;
  if (kind === 'hero') { const b64 = await st.getBig('lh:' + e); return b64 ? { u: bytes(b64), mime: 'image/jpeg' } : null; }
  if (!PID.test(String(p || ''))) return null;
  if (kind === 'cap') {
    if (today() < capsuleOpens(ev)) return null;
    const m = await storage.get('lc:' + e + ':' + p), b64 = m && m.audio && await st.getBig('lca:' + e + ':' + p);
    return b64 ? { u: bytes(b64), mime: m.amime || 'audio/webm' } : null;
  }
  const m = await storage.get('lp:' + e + ':' + p);
  if (!m || m.st === 'hidden') return null;
  const b64 = await st.getBig((kind === 'audio' ? 'la:' : kind === 'mask' ? 'lm:' : 'li:') + e + ':' + p);
  if (!b64) return null;
  return { u: bytes(b64), mime: kind === 'audio' ? (m.amime || 'audio/webm') : kind === 'mask' ? (m.mmime || 'image/jpeg') : 'image/jpeg' };
}
// "find me": a face as a short signature (pose-normalised landmarks, int8, base64); the closest faces at the event
function descOf(b64) { try { const bin = atob(b64), a = new Int8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = (bin.charCodeAt(i) << 24) >> 24; return a; } catch (e) { return null; } }
function dist(a, b) { if (!a || !b || a.length !== b.length) return Infinity; let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; } return Math.sqrt(s / a.length); }

async function photos(storage, e) {
  const list = [];
  for (const [k, m] of await storage.list({ prefix: 'lp:' + e + ':' })) if (!k.includes('#') && m && m.id) list.push(m);
  return list.sort((a, b) => a.at - b.at);
}
async function savePhoto(storage, ev, m, img, audio) {
  const st = new FrameStore(storage);
  await st.putBig('li:' + ev.id + ':' + m.id, img);
  if (audio) await st.putBig('la:' + ev.id + ':' + m.id, audio);
  await storage.put('lp:' + ev.id + ':' + m.id, m);
}
// all: everything (the event is deleted); otherwise the 60-day purge, which keeps the living magnets (they have a code)
async function dropPhotos(storage, e, all) {
  const st = new FrameStore(storage);
  for (const [k, m] of await storage.list({ prefix: 'lp:' + e + ':' })) {
    if (k.includes('#')) continue;
    if (!all && m && m.code) continue;
    const p = k.slice(('lp:' + e + ':').length);
    await st.delBig('li:' + e + ':' + p); await st.delBig('la:' + e + ':' + p); await st.delBig('lm:' + e + ':' + p); await storage.delete(k);
    if (m && m.code) await storage.delete('lcode:' + e + ':' + m.code);
  }
  await st.delBig('lf:' + e);
  if (all) { await st.delBig('lh:' + e); await dropCapsules(storage, e); }
}
async function dropCapsules(storage, e) {
  const st = new FrameStore(storage);
  for (const [k] of await storage.list({ prefix: 'lc:' + e + ':' })) { if (k.includes('#')) continue; await st.delBig('lca:' + k.slice(3)); await storage.delete(k); }
}
function checkImg(b64, max) { const s = String(b64 || '').replace(/^data:[^,]*,/, ''); return s && s.length <= max && B64.test(s.slice(0, 4000)) && B64.test(s.slice(-4000)) ? s : null; }

// b: the request; who: the signed-in studio or null; site: the business's public name and review link (for the guests' page)
export async function frameLive(storage, who, b, site) {
  const a = String(b.action || '');
  const biz = { name: clean(site && site.name, 60), google: clean(site && site.googleReviews && (site.googleReviews.url || site.googleReviews), 300) };

  /* ---------- the studio's main QR: one printed code for every event; it leads to the event its owner points it at ---------- */
  if (a === 'main-info') {
    const m = String(b.m || ''); if (!/^[a-f0-9]{20}$/.test(m)) return out({ ok: false, error: 'not-found' }, 404);
    const r = await storage.get('lmain:' + m), ev = r && r.e ? await getEv(storage, r.e) : null;
    if (!ev || ev.purged || ev.owner !== r.owner) return out({ ok: false, error: 'no-event' }, 404);
    return out({ ok: true, e: ev.id, k: ev.k, title: ev.title });
  }

  /* ---------- guests (the QR code's key) ---------- */
  if (a === 'guest-info' || a === 'guest-up') {
    const ev = await getEv(storage, b.e);
    if (!ev || ev.purged || !KEY.test(String(b.k || '')) || b.k !== ev.k) return out({ ok: false, error: 'not-found' }, 404);
    if (a === 'guest-info') return out({ ok: true, title: ev.title, date: ev.date, open: ev.open !== false, biz: { name: ev.bizName || biz.name } });
    if (ev.open === false) return out({ ok: false, error: 'closed' }, 403);
    if ((ev.n && ev.n.in || 0) >= MAX_PHOTOS) return out({ ok: false, error: 'full' }, 413);
    const img = checkImg(b.img, MAX_IMG); if (!img) return out({ ok: false, error: 'bad-image' }, 400);
    const audio = b.audio ? checkImg(b.audio, MAX_AUDIO) : null; if (b.audio && !audio) return out({ ok: false, error: 'bad-audio' }, 400);
    const name = clean(b.name, 40).trim(), text = clean(b.text, 300).trim();
    if (hasCard(name + ' ' + text)) return out({ ok: false, error: 'card-number' }, 400);
    const m = { id: sid(), at: Date.now(), name, text, audio: !!audio, amime: /^audio\/(webm|ogg|mp4|mpeg|aac)(;.*)?$/.test(String(b.amime || '')) ? String(b.amime).split(';')[0] : 'audio/webm', src: 'guest', st: 'new' };
    await savePhoto(storage, ev, m, img, audio);
    ev.n = ev.n || {}; ev.n.in = (ev.n.in || 0) + 1; if (text || audio) ev.n.wishes = (ev.n.wishes || 0) + 1;
    await storage.put('lv:' + ev.id, ev);
    return out({ ok: true, id: m.id });
  }

  /* ---------- a printed magnet's own QR (its code): the living magnet, and the time capsule ---------- */
  if (a === 'magic' || a === 'capsule-put') {
    const ev = await getEv(storage, b.e);
    if (!ev || !CODE.test(String(b.c || ''))) return out({ ok: false, error: 'not-found' }, 404);
    const id = await storage.get('lcode:' + ev.id + ':' + b.c), m = id && await storage.get('lp:' + ev.id + ':' + id);
    const opens = capsuleOpens(ev), info = { title: ev.title, date: ev.date, biz: { name: ev.bizName || biz.name, google: ev.google || biz.google }, capsuleOpens: opens, couple: (ev.couple && ev.couple.name) || '' };
    if (a === 'magic') {
      if (!m || m.st === 'hidden') return out(Object.assign({ ok: true, pending: true }, info));   // printed, still on its way up
      return out(Object.assign({ ok: true, magnet: { name: m.gname || m.name || '', text: m.text || '', audio: !!m.audio, mask: !!m.mask } }, info));
    }
    if (!m) return out({ ok: false, error: 'not-found' }, 404);
    if (today() >= opens) return out({ ok: false, error: 'capsule-closed' }, 403);
    if ((ev.n && ev.n.capsules || 0) >= MAX_CAPSULES) return out({ ok: false, error: 'full' }, 413);
    const name = clean(b.name, 40).trim(), text = clean(b.text, 600).trim(), audio = b.audio ? checkImg(b.audio, MAX_AUDIO) : null;
    if (!text && !audio) return out({ ok: false, error: 'empty' }, 400);
    if (b.audio && !audio) return out({ ok: false, error: 'bad-audio' }, 400);
    if (hasCard(name + ' ' + text)) return out({ ok: false, error: 'card-number' }, 400);
    const cap = { id: sid(), at: Date.now(), name, text, audio: !!audio, amime: /^audio\/(webm|ogg|mp4|mpeg|aac)(;.*)?$/.test(String(b.amime || '')) ? String(b.amime).split(';')[0] : 'audio/webm' };
    if (audio) await new FrameStore(storage).putBig('lca:' + ev.id + ':' + cap.id, audio);
    await storage.put('lc:' + ev.id + ':' + cap.id, cap);
    ev.n = ev.n || {}; ev.n.capsules = (ev.n.capsules || 0) + 1; await storage.put('lv:' + ev.id, ev);
    return out({ ok: true, opens });
  }

  /* ---------- the big screen and the couple's gallery (viewing key) ---------- */
  if (a === 'feed') {
    const ev = await getEv(storage, b.e);
    if (!ev || !KEY.test(String(b.v || '')) || b.v !== ev.v) return out({ ok: false, error: 'not-found' }, 404);
    const since = num(b.since, 0, 1e15, 0);
    const list = ev.purged ? [] : (await photos(storage, ev.id)).filter((m) => m.st !== 'hidden' && (m.src === 'guest' || ev.album !== false) && m.at > since);
    return out({ ok: true, title: ev.title, date: ev.date, k: ev.open !== false ? ev.k : '', purged: !!ev.purged, biz: { name: ev.bizName || biz.name, google: ev.google || biz.google }, hero: !!ev.hero, faces: !!(ev.n && ev.n.faces),
      photos: list.map((m) => ({ id: m.id, at: m.at, name: m.name || '', text: m.text || '', audio: !!m.audio, src: m.src })) });
  }

  // the time capsule: sealed until a year after the event (the count only); then every message, for the couple
  if (a === 'capsules') {
    const ev = await getEv(storage, b.e);
    if (!ev || !KEY.test(String(b.v || '')) || b.v !== ev.v) return out({ ok: false, error: 'not-found' }, 404);
    const opens = capsuleOpens(ev), n = (ev.n && ev.n.capsules) || 0;
    if (today() < opens) return out({ ok: true, locked: true, opens, count: n, title: ev.title });
    const list = [];
    for (const [k, c] of await storage.list({ prefix: 'lc:' + ev.id + ':' })) if (!k.includes('#') && c && c.id) list.push({ id: c.id, at: c.at, name: c.name, text: c.text, audio: !!c.audio });
    return out({ ok: true, locked: false, opens, count: list.length, title: ev.title, capsules: list.sort((x, y) => x.at - y.at) });
  }
  // "find me": the guest's face against every face found at the event; the closest photos
  if (a === 'find') {
    const ev = await getEv(storage, b.e);
    if (!ev || !KEY.test(String(b.v || '')) || b.v !== ev.v) return out({ ok: false, error: 'not-found' }, 404);
    const q = DESC.test(String(b.d || '')) ? descOf(b.d) : null; if (!q) return out({ ok: false, error: 'bad-face' }, 400);
    const F = JSON.parse((await new FrameStore(storage).getBig('lf:' + ev.id)) || '{}'), hits = [];
    for (const [pid, faces] of Object.entries(F)) { let best = Infinity; for (const f of faces) best = Math.min(best, dist(q, descOf(f))); if (best < Infinity) hits.push({ id: pid, d: Math.round(best * 10) / 10 }); }
    hits.sort((x, y) => x.d - y.d);
    const cut = hits.length ? Math.max(hits[0].d * 1.35, hits[0].d + 4) : 0;
    const visible = [];
    for (const h of hits.slice(0, 80)) { if (h.d > cut && visible.length >= 6) break; const m = await storage.get('lp:' + ev.id + ':' + h.id); if (m && m.st !== 'hidden' && (m.src === 'guest' || ev.album !== false)) visible.push(Object.assign(h, { name: m.name || '', src: m.src })); if (visible.length >= 40) break; }
    return out({ ok: true, photos: visible, searched: Object.values(F).filter((x) => x.length).length });
  }

  /* ---------- the event's owner ---------- */
  if (!who || (who.role !== 'admin' && who.role !== 'studio')) return out({ ok: false, error: 'signed-out' }, 401);
  const idx = (await storage.get('lvidx')) || {};
  const mine = () => Object.keys(idx).filter((id) => idx[id] === who.email);

  if (a === 'ev-list') {
    const list = [];
    for (const id of mine()) { const ev = await storage.get('lv:' + id); if (ev) list.push(ownerView(ev)); }
    return out({ ok: true, events: list.sort((x, y) => (y.date || '').localeCompare(x.date || '') || y.created - x.created) });
  }
  if (a === 'ev-save') {
    const e = b.event || {}, isNew = !e.id;
    let ev = isNew ? null : await getEv(storage, e.id);
    if (!isNew && !isOwner(who, ev)) return out({ ok: false, error: 'not-found' }, 404);
    if (isNew) {
      if (mine().length >= MAX_EVENTS || Object.keys(idx).length >= MAX_EVENTS * 20) return out({ ok: false, error: 'too-many' }, 413);
      ev = { id: sid(), owner: who.email, k: rid(12), v: rid(12), created: Date.now(), n: {}, stations: {} };
    }
    const c = e.couple || {}, couple = { name: clean(c.name, 60).trim(), phone: clean(c.phone, 24).replace(/[^\d+]/g, ''), email: clean(c.email, 120).trim().toLowerCase() };
    if (couple.email && !EMAIL.test(couple.email)) return out({ ok: false, error: 'bad-email' }, 400);
    const title = clean(e.title, 80).trim(); if (!title) return out({ ok: false, error: 'no-title' }, 400);
    if (hasCard(JSON.stringify(e))) return out({ ok: false, error: 'card-number' }, 400);
    Object.assign(ev, { title, date: DAY.test(e.date || '') ? e.date : today(), dealId: clean(e.dealId, 48), couple, open: e.open !== false, album: e.album !== false,
      design: e.design && EMAIL.test(String(e.design.email || '')) && /^[\w-]{1,48}$/.test(String(e.design.id || '')) ? { email: String(e.design.email).toLowerCase(), id: String(e.design.id), name: clean(e.design.name, 60) } : null,
      copies: num(e.copies, 1, 4, 1), cost: num(e.cost, 0, 1000, 0), price: num(e.price, 0, 1e6, 0), bizName: clean(e.bizName || (site && site.name), 60), google: clean(e.google, 300) });
    await storage.put('lv:' + ev.id, ev);
    if (isNew) { idx[ev.id] = who.email; await storage.put('lvidx', idx); }
    return out({ ok: true, event: ownerView(ev) });
  }

  /* the main QR: its key (made once per studio) and the event it leads to; main-set points it at one of the owner's events */
  if (a === 'main-get' || a === 'main-set') {
    let m = await storage.get('lmainOf:' + who.email);
    if (!m) { m = rid(10); await storage.put('lmainOf:' + who.email, m); await storage.put('lmain:' + m, { owner: who.email, e: '' }); }
    const cur = (await storage.get('lmain:' + m)) || { owner: who.email, e: '' };
    if (a === 'main-set') {
      const target = b.e ? await getEv(storage, b.e) : null;
      if (b.e && !isOwner(who, target)) return out({ ok: false, error: 'not-found' }, 404);
      cur.e = target ? target.id : ''; cur.owner = who.email; await storage.put('lmain:' + m, cur);
    }
    return out({ ok: true, m, e: cur.e || '' });
  }

  const ev = await getEv(storage, b.e);
  if (!isOwner(who, ev)) return out({ ok: false, error: 'not-found' }, 404);
  const station = clean(b.station, 30).trim() || 'עמדה';

  if (a === 'ev-del') {
    await dropPhotos(storage, ev.id, true); await storage.delete('lv:' + ev.id); delete idx[ev.id]; await storage.put('lvidx', idx);
    return out({ ok: true });
  }
  if (a === 'ev-get') {
    const list = await photos(storage, ev.id), F = JSON.parse((await new FrameStore(storage).getBig('lf:' + ev.id)) || '{}');
    return out({ ok: true, event: ownerView(ev), photos: list.map(metaOf), faced: Object.keys(F) });
  }
  // the shared queue: hand this station up to `max` photos nobody has taken yet (one request at a time, so never twice)
  if (a === 'claim') {
    ev.stations = ev.stations || {}; ev.stations[station] = Object.assign(ev.stations[station] || { printed: 0 }, { seen: Date.now() });
    const max = num(b.max, 0, 6, 3), got = [], st = new FrameStore(storage), stale = Date.now() - 10 * 60000;
    if (max) {
      for (const m of await photos(storage, ev.id)) {
        if (got.length >= max) break;
        // a photo a station took and never marked (it closed, or lost the internet) goes back to the queue after 10 minutes
        if (!(m.src === 'guest' && (m.st === 'new' || (m.st === 'claimed' && m.claimed < stale)))) continue;
        m.st = 'claimed'; m.station = station; m.claimed = Date.now(); await storage.put('lp:' + ev.id + ':' + m.id, m);
        got.push(Object.assign(metaOf(m), { img: await st.getBig('li:' + ev.id + ':' + m.id) }));
      }
    }
    await storage.put('lv:' + ev.id, ev);
    const all = await photos(storage, ev.id), waiting = all.filter((m) => m.src === 'guest' && m.st === 'new').length;
    return out({ ok: true, photos: got, waiting, n: ev.n || {}, stations: ev.stations, open: ev.open !== false });
  }
  if (a === 'mark') {
    const ids = (Array.isArray(b.ids) ? b.ids : []).slice(0, 200).filter((x) => PID.test(String(x)));
    const to = ['printed', 'hidden', 'new'].includes(b.st) ? b.st : null; if (!to) return out({ ok: false, error: 'bad-state' }, 400);
    let n = 0;
    for (const id of ids) {
      const m = await storage.get('lp:' + ev.id + ':' + id); if (!m) continue;
      if (to === 'printed' && m.st !== 'printed') { ev.n = ev.n || {}; ev.n.printedGuest = (ev.n.printedGuest || 0) + 1; }
      m.st = to; if (to === 'new') { delete m.station; delete m.claimed; }
      await storage.put('lp:' + ev.id + ':' + id, m); n++;
    }
    await storage.put('lv:' + ev.id, ev);
    return out({ ok: true, n });
  }
  // a magnet printed at the studio goes into the couple's album too
  if (a === 'studio-up') {
    if ((ev.n && ev.n.album || 0) >= MAX_PHOTOS * 2) return out({ ok: false, error: 'full' }, 413);
    const img = checkImg(b.img, MAX_IMG); if (!img) return out({ ok: false, error: 'bad-image' }, 400);
    const m = { id: sid(), at: Date.now(), name: clean(b.name, 40), text: '', audio: false, src: 'studio', st: 'printed', station };
    // a living magnet: its QR code, the person mask (to bring it to life on the guest's phone), and the guest's own greeting copied over
    const code = CODE.test(String(b.code || '')) ? String(b.code) : '';
    if (code && await storage.get('lcode:' + ev.id + ':' + code)) return out({ ok: false, error: 'code-used' }, 409);
    const mask = b.mask ? checkImg(b.mask, MAX_MASK) : null; if (b.mask && !mask) return out({ ok: false, error: 'bad-mask' }, 400);
    const st = new FrameStore(storage);
    if (code) m.code = code;
    if (mask) { m.mask = true; m.mmime = /^data:image\/png/.test(String(b.mask)) ? 'image/png' : 'image/jpeg'; await st.putBig('lm:' + ev.id + ':' + m.id, mask); }
    const g = PID.test(String(b.from || '')) ? await storage.get('lp:' + ev.id + ':' + b.from) : null;
    if (g) {
      m.from = g.id; m.gname = g.name || ''; m.text = g.text || '';
      if (g.audio) { const au = await st.getBig('la:' + ev.id + ':' + g.id); if (au) { m.audio = true; m.amime = g.amime; await st.putBig('la:' + ev.id + ':' + m.id, au); } }
    }
    await savePhoto(storage, ev, m, img, null);
    if (code) await storage.put('lcode:' + ev.id + ':' + code, m.id);
    ev.n = ev.n || {}; ev.n.album = (ev.n.album || 0) + 1; if (code) ev.n.magic = (ev.n.magic || 0) + 1; await storage.put('lv:' + ev.id, ev);
    return out({ ok: true, id: m.id });
  }
  // the couple's photo, for the live mosaic on the big screen
  if (a === 'ev-hero') {
    const img = b.img ? checkImg(b.img, MAX_IMG) : null; if (b.img && !img) return out({ ok: false, error: 'bad-image' }, 400);
    const st = new FrameStore(storage); if (img) await st.putBig('lh:' + ev.id, img); else await st.delBig('lh:' + ev.id);
    ev.hero = !!img; await storage.put('lv:' + ev.id, ev); return out({ ok: true, hero: ev.hero });
  }
  // faces found by the studio in the event's photos (for "find me"): { p: [desc, …] }, merged
  if (a === 'faces') {
    const st = new FrameStore(storage), F = JSON.parse((await st.getBig('lf:' + ev.id)) || '{}');
    for (const it of (Array.isArray(b.items) ? b.items : []).slice(0, 60)) {
      if (!PID.test(String(it && it.p || ''))) continue;
      const fs = (Array.isArray(it.f) ? it.f : []).filter((x) => DESC.test(String(x))).slice(0, MAX_FACES);
      if (fs.length) F[it.p] = fs; else F[it.p] = [];
    }
    if (Object.keys(F).length > MAX_PHOTOS * 3) return out({ ok: false, error: 'full' }, 413);
    await st.putBig('lf:' + ev.id, JSON.stringify(F));
    ev.n = ev.n || {}; ev.n.faces = Object.keys(F).filter((k) => F[k].length).length; await storage.put('lv:' + ev.id, ev);
    return out({ ok: true, n: ev.n.faces, done: Object.keys(F) });
  }
  // sheets / magnets printed at a station, for the event's report
  if (a === 'stat') {
    const prints = num(b.prints, 0, 500, 0);
    ev.n = ev.n || {}; ev.n.prints = (ev.n.prints || 0) + prints;
    ev.stations = ev.stations || {}; ev.stations[station] = Object.assign(ev.stations[station] || { printed: 0 }, { seen: Date.now() }); ev.stations[station].printed += prints;
    await storage.put('lv:' + ev.id, ev);
    return out({ ok: true, n: ev.n });
  }
  if (a === 'review-sent') { ev.reviewAt = Date.now(); await storage.put('lv:' + ev.id, ev); return out({ ok: true }); }
  return out({ ok: false, error: 'bad-action' }, 400);
}

// every few hours (the Worker's cron): photos of events older than 60 days are deleted (the numbers stay), and the day after an
// event the couple gets an email with their gallery and the review link. Answers the emails to send.
export async function liveCron(storage, now) {
  const idx = (await storage.get('lvidx')) || {}, t = today(now), mails = [];
  for (const id of Object.keys(idx)) {
    const ev = await storage.get('lv:' + id); if (!ev) continue;
    if (!ev.purged && ev.date && addDays(ev.date, KEEP_DAYS) < t) { await dropPhotos(storage, id); ev.purged = true; await storage.put('lv:' + id, ev); continue; }
    if (ev.date && !ev.magicGone && addDays(ev.date, MAGIC_DAYS) < t) { await dropPhotos(storage, id, false); for (const [k, m] of await storage.list({ prefix: 'lp:' + id + ':' })) if (!k.includes('#') && m && m.code) { const st = new FrameStore(storage), p = m.id; await st.delBig('li:' + id + ':' + p); await st.delBig('la:' + id + ':' + p); await st.delBig('lm:' + id + ':' + p); await storage.delete(k); await storage.delete('lcode:' + id + ':' + m.code); } ev.magicGone = true; await storage.put('lv:' + id, ev); }
    // the time capsule opens a year after the event: the couple gets an email that day (once); the messages go some months later
    const opens = ev.date ? capsuleOpens(ev) : null;
    if (opens && opens <= t && !ev.capsuleMailed && (ev.n && ev.n.capsules) && ev.couple && ev.couple.email && addDays(opens, 30) >= t) {
      mails.push({ kind: 'capsule', id, owner: ev.owner, to: ev.couple.email, name: ev.couple.name || '', title: ev.title, e: id, v: ev.v, biz: ev.bizName || '', count: ev.n.capsules });
      ev.capsuleMailed = Date.now(); await storage.put('lv:' + id, ev);
    }
    if (opens && addDays(opens, CAPSULE_KEEP_DAYS) < t && ev.n && ev.n.capsules && !ev.capsulesGone) { await dropCapsules(storage, id); ev.capsulesGone = true; await storage.put('lv:' + id, ev); }
    if (!ev.reviewAt && !ev.reviewMailed && ev.couple && ev.couple.email && ev.date && addDays(ev.date, 1) <= t && addDays(ev.date, 4) >= t) {
      mails.push({ id, owner: ev.owner, to: ev.couple.email, name: ev.couple.name || '', title: ev.title, e: id, v: ev.v, biz: ev.bizName || '', google: ev.google || '' });
      ev.reviewMailed = Date.now(); await storage.put('lv:' + id, ev);
    }
  }
  return mails;
}
