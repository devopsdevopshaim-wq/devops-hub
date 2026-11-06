// השרת של אפליקציית רגעים: כל הנתיבים במקום אחד, עם Request/Response סטנדרטיים של הדפדפן,
// כך שאותו קוד רץ ב-Cloudflare (worker.mjs) ובהרצה מקומית (server.js).
import crypto from 'node:crypto';
import db from './db.js';
import config from './config.js';
import * as auth from './auth.js';
import * as payments from './payments/index.js';
import { PRINT_TYPES } from './seed.js';
import { assignOrder, OPEN_STATUSES } from './routing.js';
import { addEvent, stuckInfo, STATUS_NAME, STATUSES } from './shipping.js';

// ---------- עזר ----------
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Guest-Id, X-Guest-Token',
  'Access-Control-Max-Age': '86400',
};
const SEC = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' };

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS, ...SEC } });
const err = (status, message, extra = {}) => json({ error: message, ...extra }, status);
const html = (body, status = 200) => new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', ...SEC, 'X-Frame-Options': 'DENY' } });
const redirect = (url) => new Response(null, { status: 302, headers: { Location: url } });

const token = (n = 16) => crypto.randomBytes(n).toString('hex');
const str = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const num = (v, def = 0) => (v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : def);
const arr = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map((x) => str(x, 100)).filter(Boolean);
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a || '')); const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// מגביל קצב פשוט (בענן כל הבקשות עוברות במופע אחד, ולכן זה עובד)
const hits = new Map();
function limited(key, windowMs, max) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}

const MAX_FILE = 1.9 * 1024 * 1024; // התמונה מוקטנת בטלפון לפני השליחה
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_TYPES = ['video/webm', 'video/mp4'];
const IMG_RE = /^\/img\/[a-f0-9]{24}$/;

async function saveFile(file, allowed) {
  if (!file || typeof file === 'string') throw Object.assign(new Error('לא התקבל קובץ'), { status: 400 });
  const type = String(file.type || '').split(';')[0];
  if (!allowed.includes(type)) throw Object.assign(new Error('סוג קובץ לא נתמך'), { status: 400 });
  if (file.size > MAX_FILE) throw Object.assign(new Error('הקובץ גדול מדי'), { status: 413 });
  const key = token(12);
  await db.putBlob(key, new Uint8Array(await file.arrayBuffer()), type);
  return { url: `/img/${key}`, type };
}

async function body(req) {
  const type = req.headers.get('content-type') || '';
  if (type.includes('application/json')) return req.json().catch(() => ({}));
  if (type.includes('multipart/form-data') || type.includes('application/x-www-form-urlencoded')) {
    const fd = await req.formData();
    const out = {};
    for (const [k, v] of fd.entries()) out[k] = v;
    return out;
  }
  return {};
}

// ---------- אירוע / אורחים ----------
const eventEnded = (ev) => !ev.active || (ev.endsAt && Date.now() > new Date(ev.endsAt).getTime());
const eventLink = (ev) => `${config.pagesUrl}/event.html?c=${ev.code}`;

function publicEvent(ev) {
  return {
    code: ev.code, name: ev.name, type: ev.type, date: ev.date, endsAt: ev.endsAt,
    welcomeText: ev.welcomeText, photosPerGuest: ev.photosPerGuest, printOptions: ev.printOptions,
    allowAnimations: ev.allowAnimations !== false, ended: eventEnded(ev),
  };
}

function guestFrom(c, b = {}) {
  const ev = db.all('events').find((e) => e.code === c.params.code);
  if (!ev) throw Object.assign(new Error('אירוע לא נמצא'), { status: 404 });
  const guest = db.get('guests', c.req.headers.get('x-guest-id') || b.guestId);
  if (!guest || guest.eventId !== ev.id || !safeEqual(guest.token, c.req.headers.get('x-guest-token') || b.guestToken)) {
    throw Object.assign(new Error('אורח לא מזוהה - יש לסרוק את ה-QR מחדש'), { status: 401 });
  }
  return { ev, guest };
}

const guestPhotos = (guest) => db.find('photos', (p) => p.guestId === guest.id).map((p) => ({
  id: p.id, url: p.url, kind: p.kind, printOptionId: p.printOptionId, printStatus: p.printStatus, createdAt: p.createdAt,
}));

function remaining(ev, guest) {
  const printed = db.find('photos', (p) => p.guestId === guest.id && p.kind === 'print').length;
  let left = Math.max(0, ev.photosPerGuest - printed);
  if (ev.totalPhotoLimit) {
    const total = db.find('photos', (p) => p.eventId === ev.id && p.kind === 'print').length;
    left = Math.min(left, Math.max(0, ev.totalPhotoLimit - total));
  }
  return left;
}

// ---------- חנות ----------
function activeCollections() {
  const today = new Date().toISOString().slice(0, 10);
  return db.all('collections').filter((c) => c.active && (!c.startDate || c.startDate <= today) && (!c.endDate || c.endDate >= today));
}

function publicOrder(o) {
  return {
    id: o.id, number: o.number, status: o.status, statusName: STATUS_NAME[o.status], createdAt: o.createdAt,
    items: o.items.map((i) => ({ name: i.name, qty: i.qty, price: i.price, photoUrl: i.photoUrl })),
    subtotal: o.subtotal, shipping: o.shipping, total: o.total, city: o.customer.city,
    timeline: o.timeline.filter((t) => !t.internal).map((t) => ({ status: t.status, statusName: STATUS_NAME[t.status] || '', note: t.publicNote ? t.note : '', at: t.at })),
  };
}

export function applyPaymentResult({ paymentId, approved, providerRef, raw }) {
  const pay = db.get('payments', paymentId);
  if (!pay) return null;
  const order = db.get('orders', pay.orderId);
  if (pay.status === 'approved') return { pay, order }; // אידמפוטנטי
  db.update('payments', pay.id, { status: approved ? 'approved' : 'declined', providerRef: providerRef || pay.providerRef, raw });
  if (approved) {
    addEvent(order, 'paid', `התשלום אושר (${pay.provider})`);
    const notes = assignOrder(order);
    addEvent(order, null, notes.join(' | '), 'routing', { internal: true });
  } else {
    addEvent(order, 'payment_failed', 'התשלום נדחה');
  }
  return { pay, order };
}

// ---------- ניהול ----------
function sanitizePrintOptions(list) {
  const out = [];
  for (const o of (Array.isArray(list) ? list : []).slice(0, 3)) { // לכל היותר 3 אפשרויות הדפסה
    const t = PRINT_TYPES.find((x) => x.type === o.type);
    if (!t) continue;
    const size = t.sizes.includes(o.size) ? o.size : t.sizes[0];
    out.push({ id: o.id || db.id('po_'), type: t.type, size, label: str(o.label, 60) || `${t.name} ${size}` });
  }
  return out;
}

function eventFields(b) {
  return {
    name: str(b.name, 120), type: str(b.type, 40), date: str(b.date, 20), endsAt: str(b.endsAt, 30),
    photosPerGuest: Math.max(0, Math.min(100, Math.floor(num(b.photosPerGuest, 3)))),
    totalPhotoLimit: Math.max(0, Math.floor(num(b.totalPhotoLimit, 0))),
    printOptions: sanitizePrintOptions(b.printOptions), welcomeText: str(b.welcomeText, 400),
    allowAnimations: b.allowAnimations !== false, active: b.active !== false,
    clientName: str(b.clientName, 80), clientPhone: str(b.clientPhone, 20), notes: str(b.notes, 1000),
  };
}

function orderView(o) {
  const suppliers = Object.fromEntries(db.all('suppliers').map((s) => [s.id, s]));
  const courier = o.courierId ? db.get('couriers', o.courierId) : null;
  return {
    ...o, statusName: STATUS_NAME[o.status], ...stuckInfo(o),
    courier: courier ? { id: courier.id, name: courier.name, phone: courier.phone } : null,
    items: o.items.map((i) => ({ ...i, supplier: suppliers[i.supplierId] ? { id: i.supplierId, name: suppliers[i.supplierId].name, phone: suppliers[i.supplierId].phone } : null })),
    trackUrl: `${config.pagesUrl}/track.html?id=${o.id}&t=${o.trackToken}`,
  };
}

const CRUD = {
  products: ['pr_', (b) => ({
    name: str(b.name, 120), category: str(b.category, 40), price: Math.max(0, num(b.price)), icon: str(b.icon, 10),
    description: str(b.description, 600), image: /^https:\/\//.test(str(b.image, 300)) ? str(b.image, 300) : '', collectionIds: arr(b.collectionIds),
    needsPhoto: Boolean(b.needsPhoto), active: b.active !== false,
  })],
  collections: ['col_', (b) => ({
    name: str(b.name, 80), icon: str(b.icon, 10), kind: str(b.kind, 20) || 'special',
    startDate: str(b.startDate, 10), endDate: str(b.endDate, 10), active: b.active !== false,
  })],
  suppliers: ['s_', (b) => ({
    name: str(b.name, 120), contact: str(b.contact, 80), phone: str(b.phone, 20), email: str(b.email, 120),
    categories: arr(b.categories), cities: arr(b.cities), regions: arr(b.regions), notes: str(b.notes, 1000), active: b.active !== false,
  })],
  couriers: ['k_', (b) => ({
    name: str(b.name, 120), phone: str(b.phone, 20), vehicle: str(b.vehicle, 40),
    cities: arr(b.cities), regions: arr(b.regions), notes: str(b.notes, 1000), active: b.active !== false,
  })],
  cities: ['c_', (b) => ({ name: str(b.name, 60), region: str(b.region, 40) })],
};

// ---------- טבלת נתיבים ----------
// [שיטה, נתיב (":x" = פרמטר), פעולה, אפשרויות]
const routes = [];
const on = (method, path, fn, opt = {}) => {
  const keys = [];
  const re = new RegExp('^' + path.replace(/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, fn, opt });
};

// כללי
on('GET', '/api/config', () => {
  const s = db.settings();
  return json({
    businessName: s.businessName, shippingPrice: s.shippingPrice, freeShippingFrom: s.freeShippingFrom,
    paymentProvider: payments.activeProviderId(), aiRemoveBg: Boolean(config.ai.removeBgKey), statuses: STATUSES,
  });
});
on('GET', '/api/cities', () => json(db.all('cities').map((c) => ({ name: c.name, region: c.region })).sort((a, b) => a.name.localeCompare(b.name, 'he'))));

// תמונות וסרטונים
on('GET', '/img/:key', async (c) => {
  const key = c.params.key;
  if (!/^[a-f0-9]{24}$/.test(key)) return err(404, 'לא נמצא');
  const blob = await db.getBlob(key);
  if (!blob) return err(404, 'לא נמצא');
  return new Response(blob.bytes, { headers: { 'Content-Type': blob.type, 'Cache-Control': 'public, max-age=31536000, immutable', ...CORS, ...SEC } });
});

// אירוע / QR
on('GET', '/api/event/:code', (c) => {
  const ev = db.all('events').find((e) => e.code === c.params.code);
  return ev ? json(publicEvent(ev)) : err(404, 'אירוע לא נמצא');
});

on('POST', '/api/event/:code/guest', async (c) => {
  if (limited(`g:${c.ip}`, 60_000, 20)) return err(429, 'יותר מדי בקשות, נסו שוב בעוד דקה');
  const ev = db.all('events').find((e) => e.code === c.params.code);
  if (!ev) return err(404, 'אירוע לא נמצא');
  const b = await body(c.req);
  const name = str(b.name, 80);
  if (!name) return err(400, 'נא להזין שם');
  const guest = db.insert('guests', {
    id: db.id('g_'), eventId: ev.id, name, phone: str(b.phone, 20), token: token(), marketingConsent: Boolean(b.marketingConsent),
  });
  return json({ guestId: guest.id, guestToken: guest.token, event: publicEvent(ev), remaining: remaining(ev, guest) });
});

on('GET', '/api/event/:code/me', (c) => {
  const { ev, guest } = guestFrom(c);
  return json({ event: publicEvent(ev), guest: { name: guest.name }, remaining: remaining(ev, guest), photos: guestPhotos(guest) });
});

// העלאת תמונה להדפסה (נספרת במכסה) או אנימציה דיגיטלית (לא נספרת)
on('POST', '/api/event/:code/photos', async (c) => {
  if (limited(`p:${c.ip}`, 60_000, 30)) return err(429, 'יותר מדי בקשות, נסו שוב בעוד דקה');
  const b = await body(c.req);
  const { ev, guest } = guestFrom(c, b);
  const kind = b.kind === 'animation' ? 'animation' : 'print';
  if (eventEnded(ev)) return err(403, 'האירוע הסתיים - ניתן להזמין מהחנות');
  if (kind === 'print') {
    if (remaining(ev, guest) <= 0) return err(403, 'נוצלה מכסת התמונות שלך');
    if (!ev.printOptions.find((o) => o.id === b.printOptionId)) return err(400, 'יש לבחור אפשרות הדפסה');
  } else if (ev.allowAnimations === false) {
    return err(403, 'אנימציות אינן זמינות באירוע זה');
  }
  const file = await saveFile(b.file, kind === 'print' ? IMAGE_TYPES : VIDEO_TYPES);
  const photo = db.insert('photos', {
    id: db.id('p_'), eventId: ev.id, guestId: guest.id, kind, url: file.url,
    printOptionId: kind === 'print' ? b.printOptionId : null, printStatus: kind === 'print' ? 'pending' : null, editsApplied: str(b.edits, 300),
  });
  return json({ photo: { id: photo.id, url: photo.url, kind }, remaining: remaining(ev, guest) });
});

// חנות
on('GET', '/api/store', () => {
  const cols = activeCollections();
  const activeIds = new Set(cols.map((x) => x.id));
  const products = db.all('products').filter((p) => p.active && (!(p.collectionIds || []).length || p.collectionIds.some((id) => activeIds.has(id))));
  const usedCats = new Set(products.map((p) => p.category));
  return json({
    categories: db.all('categories').filter((x) => usedCats.has(x.id)),
    collections: cols.filter((x) => products.some((p) => (p.collectionIds || []).includes(x.id))),
    products,
  });
});

on('POST', '/api/uploads', async (c) => {
  if (limited(`u:${c.ip}`, 60_000, 20)) return err(429, 'יותר מדי בקשות, נסו שוב בעוד דקה');
  const b = await body(c.req);
  return json({ url: (await saveFile(b.file, IMAGE_TYPES)).url });
});

// הזמנות
on('POST', '/api/orders', async (c) => {
  if (limited(`o:${c.ip}`, 60_000, 10)) return err(429, 'יותר מדי בקשות, נסו שוב בעוד דקה');
  const b = await body(c.req);
  const customer = {
    name: str(b.customer?.name, 80), phone: str(b.customer?.phone, 20), email: str(b.customer?.email, 120),
    city: str(b.customer?.city, 60), address: str(b.customer?.address, 200), notes: str(b.customer?.notes, 500),
  };
  if (!customer.name || !customer.phone || !customer.city || !customer.address) return err(400, 'נא למלא שם, טלפון, עיר וכתובת');
  if (!db.all('cities').some((x) => x.name === customer.city)) return err(400, 'עיר לא מוכרת - בחרו מהרשימה');
  const items = [];
  for (const it of (Array.isArray(b.items) ? b.items : []).slice(0, 50)) {
    const product = db.get('products', it.productId);
    if (!product || !product.active) return err(400, 'מוצר לא זמין');
    const qty = Math.min(99, Math.max(1, Math.floor(num(it.qty, 1))));
    const photoUrl = str(it.photoUrl, 200);
    if (photoUrl && !IMG_RE.test(photoUrl)) return err(400, 'תמונה לא תקינה');
    // המחיר נלקח תמיד מהשרת - לא סומכים על מחיר מהדפדפן
    items.push({ productId: product.id, name: product.name, category: product.category, price: product.price, qty, photoUrl, note: str(it.note, 200) });
  }
  if (!items.length) return err(400, 'הסל ריק');
  const s = db.settings();
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const shipping = subtotal >= s.freeShippingFrom ? 0 : s.shippingPrice;
  const order = db.insert('orders', {
    id: db.id('o_'), number: 1000 + db.all('orders').length + 1, trackToken: token(8),
    customer, items, subtotal, shipping, total: subtotal + shipping, status: 'pending_payment', timeline: [], eventCode: str(b.eventCode, 40) || null,
  });
  addEvent(order, 'pending_payment', 'הזמנה נוצרה');
  const payment = db.insert('payments', { id: db.id('pay_'), orderId: order.id, amount: order.total, currency: 'ILS', provider: payments.activeProviderId(), status: 'created' });
  try {
    const result = await payments.adapter().createPayment({
      payment, order, apiBase: c.base,
      successUrl: `${c.base}/pay/return?paymentId=${payment.id}`,
      failUrl: `${c.base}/pay/return?paymentId=${payment.id}`,
      notifyUrl: `${c.base}/api/payments/callback`,
    });
    db.update('payments', payment.id, { providerRef: result.providerRef, status: 'redirected' });
    return json({ orderId: order.id, number: order.number, trackToken: order.trackToken, redirectUrl: result.redirectUrl });
  } catch (e) {
    db.update('payments', payment.id, { status: 'error', error: e.message });
    return err(503, 'מערכת התשלום אינה זמינה כרגע', { detail: e.message });
  }
});

on('GET', '/api/orders/:id', (c) => {
  const o = db.get('orders', c.params.id);
  if (!o || !safeEqual(o.trackToken, c.query.get('t'))) return err(404, 'הזמנה לא נמצאה');
  return json(publicOrder(o));
});

// סליקה: עדכון שרת-לשרת מחברת הסליקה (webhook)
on('POST', '/api/payments/callback', async (c) => {
  try {
    const parsed = payments.adapter().parseCallback({ ...Object.fromEntries(c.query), ...(await body(c.req)) });
    if (!applyPaymentResult(parsed)) return new Response('unknown payment', { status: 404 });
    return new Response('OK');
  } catch (e) {
    return new Response(e.message, { status: 400 });
  }
});

// דף סליקת בדיקה - פעיל רק במצב mock
on('GET', '/pay/mock/:id', (c) => {
  if (payments.activeProviderId() !== 'mock') return err(404, 'לא נמצא');
  const pay = db.get('payments', c.params.id);
  if (!pay) return html('תשלום לא נמצא', 404);
  return html(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>סליקת בדיקה</title><link rel="stylesheet" href="${escHtml(config.pagesUrl)}/css/app.css"></head><body><main class="wrap narrow">
<div class="card"><div class="badge warn">מצב בדיקה - אין חיוב אמיתי</div><h1>תשלום מאובטח</h1>
<p>סכום לתשלום: <b>₪${escHtml(pay.amount)}</b></p>
<p class="muted">כאן יוצג דף התשלום של חברת הסליקה לאחר החיבור. פרטי האשראי מוזנים אצל חברת הסליקה בלבד ולא נשמרים אצלנו.</p>
<form method="post" action="${escHtml(c.base)}/pay/mock/${escHtml(pay.id)}"><button class="btn" name="result" value="approved">אישור תשלום (בדיקה)</button>
<button class="btn ghost" name="result" value="declined">דחיית תשלום (בדיקה)</button></form></div></main></body></html>`);
});

on('POST', '/pay/mock/:id', async (c) => {
  if (payments.activeProviderId() !== 'mock') return err(404, 'לא נמצא');
  const b = await body(c.req);
  if (!applyPaymentResult({ paymentId: c.params.id, approved: b.result === 'approved', raw: { mock: true } })) return html('תשלום לא נמצא', 404);
  return redirect(`${c.base}/pay/return?paymentId=${encodeURIComponent(c.params.id)}`);
});

// חזרה מדף התשלום -> דף מעקב ההזמנה באתר
on('GET', '/pay/return', (c) => {
  const pay = db.get('payments', String(c.query.get('paymentId') || ''));
  if (!pay) return redirect(`${config.pagesUrl}/`);
  const order = db.get('orders', pay.orderId);
  return redirect(`${config.pagesUrl}/track.html?id=${order.id}&t=${order.trackToken}&new=1`);
});

// AI: הסרת רקע (remove.bg)
on('POST', '/api/ai/remove-bg', async (c) => {
  if (limited(`ai:${c.ip}`, 60_000, 10)) return err(429, 'יותר מדי בקשות, נסו שוב בעוד דקה');
  if (!config.ai.removeBgKey) return err(501, 'הסרת רקע AI לא הוגדרה (סוד EVENTS_REMOVE_BG_API_KEY ב-GitHub)');
  const b = await body(c.req);
  if (!b.file || typeof b.file === 'string') return err(400, 'לא התקבל קובץ');
  if (b.file.size > MAX_FILE * 3) return err(413, 'הקובץ גדול מדי');
  const form = new FormData();
  form.append('image_file', b.file, 'image');
  form.append('size', 'auto');
  const r = await fetch('https://api.remove.bg/v1.0/removebg', { method: 'POST', headers: { 'X-Api-Key': config.ai.removeBgKey }, body: form });
  if (!r.ok) return err(502, 'שירות ה-AI נכשל', { detail: `remove.bg ${r.status}` });
  return new Response(await r.arrayBuffer(), { headers: { 'Content-Type': 'image/png', ...CORS } });
});

// ---------- ניהול (דורש כניסה) ----------
on('POST', '/api/admin/login', async (c) => {
  if (limited(`login:${c.ip}`, 15 * 60_000, 10)) return err(429, 'יותר מדי ניסיונות. נסו שוב בעוד רבע שעה');
  if (!config.adminPassword) return err(503, 'סיסמת המנהל עוד לא הוגדרה. ב-GitHub צריך את הסוד ADMIN_PASSWORD (או EVENTS_ADMIN_PASSWORD), ואז מריצים את הפריסה.');
  const b = await body(c.req);
  if (!auth.checkPassword(b.password)) return err(401, 'סיסמה שגויה');
  return json({ ok: true, token: auth.createToken() });
});
on('GET', '/api/admin/me', () => json({ ok: true }), { admin: true });

on('GET', '/api/admin/dashboard', () => {
  const orders = db.all('orders');
  const open = orders.filter((o) => OPEN_STATUSES.includes(o.status));
  return json({
    events: db.all('events').length,
    guests: db.all('guests').length,
    photosPending: db.find('photos', (p) => p.kind === 'print' && p.printStatus === 'pending').length,
    ordersOpen: open.length,
    ordersStuck: open.filter((o) => stuckInfo(o).stuck).length,
    needsAssignment: open.filter((o) => o.needsManualAssignment).length,
    revenue: orders.filter((o) => !['pending_payment', 'payment_failed', 'cancelled'].includes(o.status)).reduce((s, o) => s + o.total, 0),
  });
}, { admin: true });

on('GET', '/api/admin/print-types', () => json(PRINT_TYPES), { admin: true });

on('GET', '/api/admin/events', () => json(db.all('events').map((e) => ({
  ...e,
  guests: db.find('guests', (g) => g.eventId === e.id).length,
  photos: db.find('photos', (p) => p.eventId === e.id && p.kind === 'print').length,
  link: eventLink(e),
})).reverse()), { admin: true });

on('POST', '/api/admin/events', async (c) => {
  const f = eventFields(await body(c.req));
  if (!f.name) return err(400, 'נא להזין שם אירוע');
  if (!f.printOptions.length) return err(400, 'יש לבחור לפחות אפשרות הדפסה אחת (עד 3)');
  const ev = db.insert('events', { id: db.id('e_'), code: token(4), ...f });
  return json({ ...ev, link: eventLink(ev) });
}, { admin: true });

on('PUT', '/api/admin/events/:id', async (c) => {
  const f = eventFields(await body(c.req));
  if (!f.printOptions.length) return err(400, 'יש לבחור לפחות אפשרות הדפסה אחת (עד 3)');
  const ev = db.update('events', c.params.id, f);
  return ev ? json(ev) : err(404, 'לא נמצא');
}, { admin: true });

on('DELETE', '/api/admin/events/:id', (c) => json({ ok: db.remove('events', c.params.id) }), { admin: true });

on('GET', '/api/admin/events/:id/photos', (c) => {
  const ev = db.get('events', c.params.id);
  if (!ev) return err(404, 'לא נמצא');
  const guests = Object.fromEntries(db.find('guests', (g) => g.eventId === ev.id).map((g) => [g.id, g]));
  return json(db.find('photos', (p) => p.eventId === ev.id).map((p) => ({
    ...p, guestName: guests[p.guestId]?.name, guestPhone: guests[p.guestId]?.phone,
    printOption: ev.printOptions.find((o) => o.id === p.printOptionId)?.label || '',
  })).reverse());
}, { admin: true });

on('PATCH', '/api/admin/photos/:id', async (c) => {
  const b = await body(c.req);
  if (!['pending', 'printing', 'printed', 'delivered', 'rejected'].includes(b.printStatus)) return err(400, 'סטטוס לא תקין');
  const p = db.update('photos', c.params.id, { printStatus: b.printStatus });
  return p ? json(p) : err(404, 'לא נמצא');
}, { admin: true });

on('GET', '/api/admin/guests', () => {
  const events = Object.fromEntries(db.all('events').map((e) => [e.id, e.name]));
  return json(db.all('guests').map(({ token: _t, ...g }) => ({ ...g, eventName: events[g.eventId] })).reverse());
}, { admin: true });

for (const [col, [prefix, fields]] of Object.entries(CRUD)) {
  on('GET', `/api/admin/${col}`, () => json(db.all(col)), { admin: true });
  on('POST', `/api/admin/${col}`, async (c) => {
    const f = fields(await body(c.req));
    if (!f.name) return err(400, 'נא להזין שם');
    return json(db.insert(col, { id: db.id(prefix), ...f }));
  }, { admin: true });
  on('PUT', `/api/admin/${col}/:id`, async (c) => {
    const rec = db.update(col, c.params.id, fields(await body(c.req)));
    return rec ? json(rec) : err(404, 'לא נמצא');
  }, { admin: true });
  on('DELETE', `/api/admin/${col}/:id`, (c) => json({ ok: db.remove(col, c.params.id) }), { admin: true });
}
on('GET', '/api/admin/categories', () => json(db.all('categories')), { admin: true });

on('GET', '/api/admin/orders', (c) => {
  let list = db.all('orders').map(orderView);
  const f = c.query.get('filter');
  if (f === 'open') list = list.filter((o) => OPEN_STATUSES.includes(o.status));
  if (f === 'stuck') list = list.filter((o) => o.stuck && OPEN_STATUSES.includes(o.status));
  if (c.query.get('city')) list = list.filter((o) => o.customer.city === c.query.get('city'));
  return json(list.reverse());
}, { admin: true });

on('GET', '/api/admin/orders/:id', (c) => {
  const o = db.get('orders', c.params.id);
  return o ? json(orderView(o)) : err(404, 'לא נמצא');
}, { admin: true });

// עדכון סטטוס ו/או הוספת הערה (פנימית או גלויה ללקוח)
on('POST', '/api/admin/orders/:id/events', async (c) => {
  const o = db.get('orders', c.params.id);
  if (!o) return err(404, 'לא נמצא');
  const b = await body(c.req);
  const status = b.status && STATUS_NAME[b.status] ? b.status : null;
  const note = str(b.note, 1000);
  if (!status && !note) return err(400, 'נא לבחור סטטוס או לכתוב הערה');
  const publicNote = Boolean(b.publicNote);
  addEvent(o, status, note, 'admin', { publicNote, internal: !status && !publicNote });
  return json(orderView(o));
}, { admin: true });

on('POST', '/api/admin/orders/:id/assign', async (c) => {
  const o = db.get('orders', c.params.id);
  if (!o) return err(404, 'לא נמצא');
  const b = await body(c.req);
  if (b.auto) {
    addEvent(o, null, 'שיוך אוטומטי מחדש: ' + assignOrder(o).join(' | '), 'admin', { internal: true });
  } else {
    if (b.courierId !== undefined) o.courierId = b.courierId || null;
    for (const [idx, supplierId] of Object.entries(b.suppliers || {})) if (o.items[idx]) o.items[idx].supplierId = supplierId || null;
    o.needsManualAssignment = !o.courierId || o.items.some((i) => !i.supplierId);
    addEvent(o, null, 'שיוך ידני של ספק/שליח', 'admin', { internal: true });
  }
  return json(orderView(o));
}, { admin: true });

on('GET', '/api/admin/settings', () => json({ settings: db.settings(), payments: payments.providerInfo(), pagesUrl: config.pagesUrl }), { admin: true });

on('PUT', '/api/admin/settings', async (c) => {
  const b = await body(c.req);
  const sla = {};
  for (const [k, v] of Object.entries(b.slaHours || {})) if (STATUS_NAME[k]) sla[k] = Math.max(0, num(v));
  return json(db.setSettings({
    businessName: str(b.businessName, 120), shippingPrice: Math.max(0, num(b.shippingPrice)),
    freeShippingFrom: Math.max(0, num(b.freeShippingFrom)), paymentDashboardUrl: /^https:\/\//.test(str(b.paymentDashboardUrl, 300)) ? str(b.paymentDashboardUrl, 300) : '',
    slaHours: sla,
  }));
}, { admin: true });

on('GET', '/api/admin/payments', () => json(db.all('payments').slice().reverse().slice(0, 200)), { admin: true });

// ---------- הכניסה ----------
// handle(request, base) -> Response | null (null = נתיב לא של ה-API, למשל קובץ סטטי בהרצה מקומית)
export async function handle(req, base) {
  const url = new URL(req.url);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'local';
  let match = null;
  for (const r of routes) {
    if (r.method !== req.method) continue;
    const m = r.re.exec(url.pathname);
    if (m) { match = { r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) }; break; }
  }
  if (!match) return url.pathname.startsWith('/api/') || url.pathname.startsWith('/pay/') || url.pathname.startsWith('/img/') ? err(404, 'לא נמצא') : null;
  if (match.r.opt.admin && !auth.verifyToken(auth.bearer(req))) return err(401, 'נדרשת התחברות מנהל');
  try {
    return await match.r.fn({ req, url, query: url.searchParams, params: match.params, ip, base: base || url.origin });
  } catch (e) {
    return err(e.status || 500, e.status ? e.message : 'שגיאת שרת');
  }
}
