// פריים מגנטים: the live event. Guests scan a QR code on the table, take a photo on their phone (with a name, a greeting
// and a short voice message if they like) and it reaches the studio's print queue. Several stations share one queue: each
// photo is handed to one station only. A big screen in the hall and the couple's gallery read the same photos with a
// separate viewing key. The owner of an event is the signed-in studio (the business owner or a licensed studio).
//   public  POST /frame-live {action:'guest-info'|'guest-up', e, k}      k = the guests' key (in the QR code)
//           POST /frame-live {action:'feed', e, v}                        v = the viewing key (big screen, couple's gallery)
//           GET  /frame-live-img?e=&p=&v=[&a=1]                           one photo (or its voice message)
//   signed  POST /frame-live {action, token}                              the event's owner: events, queue, marks, reports
// Photos are deleted 60 days after the event; the event's numbers stay for the reports.
import { FrameStore, hasCard, today } from './frame.mjs';

const ID = /^[a-z0-9]{6,24}$/, KEY = /^[a-f0-9]{24}$/, PID = /^[a-z0-9]{6,24}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^@\s]{1,80}@[^@\s]{1,80}\.[^@\s]{1,20}$/;
const MAX_IMG = 1700000, MAX_AUDIO = 700000, MAX_PHOTOS = 1500, MAX_EVENTS = 400, KEEP_DAYS = 60;
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
    cost: ev.cost || 0, price: ev.price || 0, album: ev.album !== false, k: ev.k, v: ev.v, n: ev.n || {}, stations: ev.stations || {}, created: ev.created,
    reviewAt: ev.reviewAt || null, purged: !!ev.purged };
}
const isOwner = (who, ev) => who && ev && (ev.owner === who.email);
async function getEv(storage, e) { return ID.test(String(e || '')) ? storage.get('lv:' + e) : null; }
const metaOf = (m) => ({ id: m.id, at: m.at, name: m.name || '', text: m.text || '', audio: !!m.audio, src: m.src, st: m.st, station: m.station || '', copies: m.copies || 1 });

// one photo or its voice message, for the big screen and the gallery (viewing key) or the owner's station
export async function liveFile(storage, e, p, v, audio) {
  const ev = await getEv(storage, e);
  if (!ev || !KEY.test(String(v || '')) || v !== ev.v || !PID.test(String(p || ''))) return null;
  const m = await storage.get('lp:' + e + ':' + p);
  if (!m || m.st === 'hidden') return null;
  const st = new FrameStore(storage), b64 = await st.getBig((audio ? 'la:' : 'li:') + e + ':' + p);
  if (!b64) return null;
  const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return { u, mime: audio ? (m.amime || 'audio/webm') : 'image/jpeg' };
}

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
async function dropPhotos(storage, e) {
  const st = new FrameStore(storage);
  for (const [k] of await storage.list({ prefix: 'lp:' + e + ':' })) {
    if (k.includes('#')) continue;
    const p = k.slice(('lp:' + e + ':').length);
    await st.delBig('li:' + e + ':' + p); await st.delBig('la:' + e + ':' + p); await storage.delete(k);
  }
}
function checkImg(b64, max) { const s = String(b64 || '').replace(/^data:[^,]*,/, ''); return s && s.length <= max && B64.test(s.slice(0, 4000)) && B64.test(s.slice(-4000)) ? s : null; }

// b: the request; who: the signed-in studio or null; site: the business's public name and review link (for the guests' page)
export async function frameLive(storage, who, b, site) {
  const a = String(b.action || '');
  const biz = { name: clean(site && site.name, 60), google: clean(site && site.googleReviews && (site.googleReviews.url || site.googleReviews), 300) };

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

  /* ---------- the big screen and the couple's gallery (viewing key) ---------- */
  if (a === 'feed') {
    const ev = await getEv(storage, b.e);
    if (!ev || !KEY.test(String(b.v || '')) || b.v !== ev.v) return out({ ok: false, error: 'not-found' }, 404);
    const since = num(b.since, 0, 1e15, 0);
    const list = ev.purged ? [] : (await photos(storage, ev.id)).filter((m) => m.st !== 'hidden' && (m.src === 'guest' || ev.album !== false) && m.at > since);
    return out({ ok: true, title: ev.title, date: ev.date, k: ev.open !== false ? ev.k : '', purged: !!ev.purged, biz: { name: ev.bizName || biz.name, google: ev.google || biz.google },
      photos: list.map((m) => ({ id: m.id, at: m.at, name: m.name || '', text: m.text || '', audio: !!m.audio, src: m.src })) });
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
      copies: num(e.copies, 1, 4, 1), cost: num(e.cost, 0, 1000, 0), price: num(e.price, 0, 1e6, 0), bizName: clean(e.bizName || (site && site.name), 60), google: clean(e.google, 300) });
    await storage.put('lv:' + ev.id, ev);
    if (isNew) { idx[ev.id] = who.email; await storage.put('lvidx', idx); }
    return out({ ok: true, event: ownerView(ev) });
  }

  const ev = await getEv(storage, b.e);
  if (!isOwner(who, ev)) return out({ ok: false, error: 'not-found' }, 404);
  const station = clean(b.station, 30).trim() || 'עמדה';

  if (a === 'ev-del') {
    await dropPhotos(storage, ev.id); await storage.delete('lv:' + ev.id); delete idx[ev.id]; await storage.put('lvidx', idx);
    return out({ ok: true });
  }
  if (a === 'ev-get') {
    const list = await photos(storage, ev.id);
    return out({ ok: true, event: ownerView(ev), photos: list.map(metaOf) });
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
    await savePhoto(storage, ev, m, img, null);
    ev.n = ev.n || {}; ev.n.album = (ev.n.album || 0) + 1; await storage.put('lv:' + ev.id, ev);
    return out({ ok: true, id: m.id });
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
    if (!ev.reviewAt && !ev.reviewMailed && ev.couple && ev.couple.email && ev.date && addDays(ev.date, 1) <= t && addDays(ev.date, 4) >= t) {
      mails.push({ id, owner: ev.owner, to: ev.couple.email, name: ev.couple.name || '', title: ev.title, e: id, v: ev.v, biz: ev.bizName || '', google: ev.google || '' });
      ev.reviewMailed = Date.now(); await storage.put('lv:' + id, ev);
    }
  }
  return mails;
}
