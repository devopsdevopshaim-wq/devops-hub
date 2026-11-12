// השרת של אפליקציית פריים אירועים: כל הנתיבים במקום אחד, עם Request/Response סטנדרטיים של הדפדפן,
// כך שאותו קוד רץ ב-Cloudflare (worker.mjs) ובהרצה מקומית (server.js).
import crypto from 'node:crypto';
import db from './db.js';
import config from './config.js';
import * as auth from './auth.js';
import * as payments from './payments/index.js';
import { PRINT_TYPES, EVENT_TYPES } from './seed.js';
import { assignOrder, OPEN_STATUSES } from './routing.js';
import { addEvent, stuckInfo, STATUS_NAME, STATUSES } from './shipping.js';
import { priceFor, quote, publicPromotions, normCode, livePromotions } from './pricing.js';
import * as loyalty from './loyalty.js';

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
  if (!config.rateLimit) return false;
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

// ---------- עורך התמונות ומידות ההדפסה (המנהל שולט בהכול) ----------
export const EDITOR_TOOLS = ['crop', 'adjust', 'filters', 'ai', 'text', 'stickers', 'frames', 'anim'];
export const AI_EFFECTS = ['enhance', 'cartoon', 'sketch', 'popart', 'oil', 'removebg'];
function editorSettings() {
  const e = db.settings().editor || {};
  return {
    store: e.store !== false, // עריכה גם בחנות (לא רק באירוע)
    tools: Object.fromEntries(EDITOR_TOOLS.map((k) => [k, !e.tools || e.tools[k] !== false])),
    ai: Object.fromEntries(AI_EFFECTS.map((k) => [k, !e.ai || e.ai[k] !== false])),
  };
}
// "6 X 9" / "6×9" -> "6x9"
const normSize = (v) => { const m = String(v || '').replace(/[×X*]/g, 'x').replace(/\s+/g, '').match(/^(\d{1,3}(?:\.\d{1,2})?)x(\d{1,3}(?:\.\d{1,2})?)$/); return m ? `${m[1]}x${m[2]}` : ''; };
function printTypes() {
  const custom = db.settings().printSizes || {};
  return PRINT_TYPES.map((t) => ({ ...t, sizes: Array.isArray(custom[t.type]) && custom[t.type].length ? custom[t.type] : t.sizes }));
}

// ---------- אירוע / אורחים ----------
const eventEnded = (ev) => !ev.active || (ev.endsAt && Date.now() > new Date(ev.endsAt).getTime());
const eventLink = (ev) => `${config.pagesUrl}/event.html?c=${ev.code}`;

function publicEvent(ev) {
  return {
    code: ev.code, name: ev.name, type: ev.type, date: ev.date, endsAt: ev.endsAt,
    welcomeText: ev.welcomeText, photosPerGuest: ev.photosPerGuest, printOptions: ev.printOptions,
    allowAnimations: ev.allowAnimations !== false, ended: eventEnded(ev), editor: editorSettings(),
    framePortrait: ev.framePortrait || '', frameLandscape: ev.frameLandscape || '',
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
    items: o.items.map((i) => ({ name: i.name, qty: i.qty, price: i.price, originalPrice: i.originalPrice || i.price, promo: i.promo || '', photoUrl: i.photoUrl })),
    subtotal: o.subtotal, discount: o.discount || 0, coupon: o.coupon || '', shipping: o.shipping, total: o.total, city: o.customer.city,
    loyaltyEarned: o.loyaltyEarned || 0, reward: o.reward ? { name: o.reward.name, points: o.reward.points } : null, clubToken: o.clubTokenNew || '',
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
    loyalty.settle(order);
    if (order.loyaltyEarned) addEvent(order, null, `נצברו ${order.loyaltyEarned} נקודות מועדון`, 'loyalty', { internal: true });
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
    const t = printTypes().find((x) => x.type === o.type);
    if (!t) continue;
    const size = normSize(o.size) || t.sizes[0]; // כל מידה שהמנהל קבע, לא רק מהרשימה
    const frame = IMG_RE.test(String(o.frame || '')) ? o.frame : ''; // מסגרת PNG של האירוע לאפשרות הזו
    out.push({ id: o.id || db.id('po_'), type: t.type, size, label: str(o.label, 60) || `${t.name} ${size}`, frame });
  }
  return out;
}

function eventFields(b) {
  return {
    name: str(b.name, 120), type: str(b.type, 40), date: str(b.date, 20), endsAt: str(b.endsAt, 30),
    photosPerGuest: Math.max(0, Math.min(100, Math.floor(num(b.photosPerGuest, 3)))),
    totalPhotoLimit: Math.max(0, Math.floor(num(b.totalPhotoLimit, 0))),
    printOptions: sanitizePrintOptions(b.printOptions), welcomeText: str(b.welcomeText, 400),
    // מסגרת האירוע: PNG לתמונה לאורך ו-PNG לתמונה לרוחב. התמונה של האורח נכנסת לזו שמתאימה לכיוון שלה
    framePortrait: IMG_RE.test(String(b.framePortrait || '')) ? b.framePortrait : '',
    frameLandscape: IMG_RE.test(String(b.frameLandscape || '')) ? b.frameLandscape : '',
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

// תמונות מוצר: תמונות שהועלו לשרת (/img/...) או קישורי https, עד 12, הראשונה היא הראשית
function productImages(b) {
  const list = Array.isArray(b.images) ? b.images : (b.image ? [b.image] : []);
  return list.map((u) => str(u, 300)).filter((u) => IMG_RE.test(u) || /^https:\/\/[^\s"'<>]+$/.test(u)).slice(0, 12);
}

const PROMO_KINDS = ['percent', 'amount', 'price'];
const PROMO_SCOPES = ['all', 'category', 'products', 'collection'];

// גדלים/אפשרויות למוצר: [{ name, price }], עד 8
function productVariants(b) {
  const list = Array.isArray(b.variants) ? b.variants : [];
  return list.map((v) => ({ name: str(v && v.name, 40), price: Math.max(0, num(v && v.price)) })).filter((v) => v.name).slice(0, 8);
}
const EVENT_IDS = EVENT_TYPES.map((e) => e.id);
// סוגי האירועים עם התמונה שהמנהל בחר (או תמונת ברירת המחדל)
function eventTypes() {
  const imgs = db.settings().eventImages || {};
  // תמונה שנמצאת באתר עצמו (img/...) מקבלת את כתובת האתר המלאה, כדי שתעבוד גם מאפליקציית הניהול
  const full = (u) => (/^img\//.test(u) ? `${config.pagesUrl}/${u}` : u);
  return EVENT_TYPES.map((e) => ({ ...e, image: imgs[e.id] || full(e.image), custom: Boolean(imgs[e.id]) }));
}
const LINK_TYPES = ['none', 'category', 'event', 'product', 'url'];

const CRUD = {
  rewards: ['rw_', (b) => ({
    name: str(b.name, 80), description: str(b.description, 200), kind: b.kind === 'gift' ? 'gift' : 'discount',
    amount: Math.max(0, num(b.amount)), productId: b.kind === 'gift' ? str(b.productId, 40) : '',
    points: Math.max(1, Math.floor(num(b.points, 1))), active: b.active !== false,
  })],
  banners: ['bn_', (b) => ({
    name: str(b.name, 80), subtitle: str(b.subtitle, 160), cta: str(b.cta, 40),
    image: (IMG_RE.test(str(b.image, 300)) || /^https:\/\/[^\s"'<>]+$/.test(str(b.image, 300))) ? str(b.image, 300) : '',
    linkType: LINK_TYPES.includes(b.linkType) ? b.linkType : 'none',
    linkValue: b.linkType === 'url' && !/^https:\/\//.test(str(b.linkValue, 300)) ? '' : str(b.linkValue, 300),
    startDate: str(b.startDate, 10), endDate: str(b.endDate, 10), order: Math.floor(num(b.order, 0)), active: b.active !== false,
  })],
  promotions: ['pm_', (b) => ({
    name: str(b.name, 80), badge: str(b.badge, 30),
    kind: PROMO_KINDS.includes(b.kind) ? b.kind : 'percent', value: Math.max(0, num(b.value)),
    scope: PROMO_SCOPES.includes(b.scope) ? b.scope : 'all',
    categories: arr(b.categories), productIds: arr(b.productIds), collectionIds: arr(b.collectionIds),
    startDate: str(b.startDate, 10), endDate: str(b.endDate, 10),
    code: normCode(b.code), minSubtotal: Math.max(0, num(b.minSubtotal)), active: b.active !== false,
  })],
  products: ['pr_', (b) => ({
    name: str(b.name, 120), category: str(b.category, 40), price: Math.max(0, num(b.price)), icon: str(b.icon, 10),
    description: str(b.description, 1500), images: productImages(b), collectionIds: arr(b.collectionIds),
    needsPhoto: Boolean(b.needsPhoto), active: b.active !== false,
    variants: productVariants(b), eventTypes: arr(b.eventTypes).filter((e) => EVENT_IDS.includes(e)), upsell: Boolean(b.upsell),
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
    paymentProvider: payments.activeProviderId(), aiRemoveBg: Boolean(config.ai.removeBgKey), statuses: STATUSES, editor: editorSettings(),
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
  const promos = livePromotions();
  const sold = soldCounts();
  const today = new Date().toISOString().slice(0, 10);
  return json({
    categories: db.all('categories').filter((x) => usedCats.has(x.id)),
    collections: cols.filter((x) => products.some((p) => (p.collectionIds || []).includes(x.id))),
    events: eventTypes(),
    banners: db.all('banners').filter((x) => x.active !== false && x.image && (!x.startDate || x.startDate <= today) && (!x.endDate || x.endDate >= today))
      .sort((a, b) => (a.order || 0) - (b.order || 0)),
    // מחיר המבצע מחושב כאן (מבצעים בלי קוד ובלי מינימום הזמנה), גם לכל גודל
    products: products.map((p) => {
      const pr = priceFor(p, { promos });
      const variants = (p.variants || []).map((v) => {
        const vp = priceFor({ ...p, price: v.price }, { promos });
        return { name: v.name, price: v.price, salePrice: vp.promo ? vp.price : null };
      });
      return { ...p, images: productImages(p), salePrice: pr.promo ? pr.price : null, promo: pr.promo, variants, eventTypes: p.eventTypes || [], sold: sold[p.id] || 0 };
    }),
    promotions: publicPromotions(),
    club: { ...clubInfo(), rewards: loyalty.publicRewards() },
  });
});

on('POST', '/api/uploads', async (c) => {
  if (limited(`u:${c.ip}`, 60_000, 20)) return err(429, 'יותר מדי בקשות, נסו שוב בעוד דקה');
  const b = await body(c.req);
  return json({ url: (await saveFile(b.file, IMAGE_TYPES)).url });
});

// כמה יחידות נמכרו מכל מוצר (הזמנות ששולמו)
const PAID = ['paid', 'sent_to_supplier', 'in_production', 'ready', 'picked_up', 'out_for_delivery', 'delivered', 'issue'];
function soldCounts() {
  const out = {};
  for (const o of db.all('orders')) if (PAID.includes(o.status)) for (const i of o.items) out[i.productId] = (out[i.productId] || 0) + i.qty;
  return out;
}

function cartLines(items) {
  const lines = [];
  for (const it of (Array.isArray(items) ? items : []).slice(0, 50)) {
    let product = db.get('products', it.productId);
    if (!product || !product.active) throw Object.assign(new Error('מוצר לא זמין'), { status: 400 });
    const photoUrl = str(it.photoUrl, 200);
    if (photoUrl && !IMG_RE.test(photoUrl)) throw Object.assign(new Error('תמונה לא תקינה'), { status: 400 });
    // גודל: המחיר של הגודל שנבחר (מהשרת). למוצר עם גדלים חייבים לבחור גודל
    const vs = product.variants || [];
    let variant = '';
    if (vs.length) {
      const v = vs.find((x) => x.name === str(it.variant, 40));
      if (!v) throw Object.assign(new Error(`בחרו גודל ל"${product.name}"`), { status: 400 });
      variant = v.name;
      product = { ...product, price: v.price };
    }
    lines.push({ product, variant, qty: Math.min(99, Math.max(1, Math.floor(num(it.qty, 1)))), photoUrl, note: str(it.note, 200) });
  }
  return lines;
}

const clubInfo = () => { const s = loyalty.settings(); return { enabled: s.enabled, earnPercent: s.earnPercent, minPoints: s.minPoints }; };

// מימוש הטבת נקודות על הסל: הנחה בשקלים או מתנה. משנה את q במקום ומחזיר את ההטבה שחלה
function applyReward(q, reward) {
  if (!reward) return null;
  if (reward.kind === 'discount') {
    const amount = Math.min(reward.amount, q.subtotal);
    q.subtotal = Math.round((q.subtotal - amount) * 100) / 100;
    q.discount = Math.round((q.discount + amount) * 100) / 100;
    q.total = Math.round((q.subtotal + q.shipping) * 100) / 100;
    return { id: reward.id, name: reward.name, kind: 'discount', amount, points: reward.points };
  }
  const gift = db.get('products', reward.productId);
  return { id: reward.id, name: reward.name, kind: 'gift', amount: 0, points: reward.points, productId: gift ? gift.id : '', productName: gift ? gift.name : reward.name };
}

// תמחור הסל לפני תשלום (הנחות, קופון, משלוח, נקודות)
on('POST', '/api/cart/quote', async (c) => {
  if (limited(`q:${c.ip}`, 60_000, 60)) return err(429, 'יותר מדי בקשות, נסו שוב בעוד דקה');
  const b = await body(c.req);
  const q = quote(cartLines(b.items), { code: b.code });
  const acc = loyalty.byToken(str(b.clubToken, 40));
  const chk = loyalty.checkReward(acc, str(b.rewardId, 40));
  const reward = chk.error ? null : applyReward(q, chk.reward);
  const club = { ...clubInfo(), member: Boolean(acc), points: acc ? acc.points : 0, canRedeem: Boolean(acc) && acc.points >= clubInfo().minPoints,
    earn: clubInfo().enabled ? loyalty.pointsFor(q.subtotal) : 0, reward, rewardError: chk.error || '' };
  return json({ ...q, club, lines: q.lines.map((l) => ({ productId: l.product.id, variant: l.variant, qty: l.qty, price: l.price, originalPrice: l.originalPrice, promo: l.promo, coupon: l.coupon })) });
});

// מועדון: היתרה וההיסטוריה של הלקוח
on('GET', '/api/club/me', (c) => {
  if (limited(`club:${c.ip}`, 60_000, 60)) return err(429, 'יותר מדי בקשות, נסו שוב בעוד דקה');
  const acc = loyalty.byToken(str(c.query.get('t'), 40));
  if (!acc) return err(404, 'חשבון מועדון לא נמצא');
  return json({ ...loyalty.publicAccount(acc), rewards: loyalty.publicRewards() });
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
  // המחיר נלקח תמיד מהשרת (כולל מבצעים, קופון ונקודות) - לא סומכים על מחיר מהדפדפן
  const q = quote(cartLines(b.items), { code: b.code });
  if (!q.lines.length) return err(400, 'הסל ריק');
  if (q.code && !q.codeValid) return err(400, 'קוד הקופון לא תקף');
  // נקודות: מימוש רק עם מפתח המועדון של אותו מספר טלפון
  const phone = loyalty.normPhone(customer.phone);
  const acc = loyalty.byToken(str(b.clubToken, 40));
  let reward = null;
  if (b.rewardId) {
    if (!acc || acc.phone !== phone) return err(400, 'מימוש נקודות אפשרי רק עם מספר הטלפון של חשבון המועדון');
    const chk = loyalty.checkReward(acc, str(b.rewardId, 40));
    if (chk.error) return err(400, chk.error);
    reward = applyReward(q, chk.reward);
  }
  const items0 = q.lines.map((l) => ({
    productId: l.product.id, name: l.variant ? `${l.product.name} (${l.variant})` : l.product.name, variant: l.variant, category: l.product.category, price: l.price, originalPrice: l.originalPrice,
    promo: [l.promo && l.promo.name, l.coupon && `קופון ${l.coupon.code}`].filter(Boolean).join(' + '), qty: l.qty, photoUrl: l.photoUrl, note: l.note,
  }));
  const items = reward && reward.kind === 'gift' && reward.productId
    ? [...items0, { productId: reward.productId, name: `🎁 ${reward.productName} (מתנה מהנקודות)`, category: (db.get('products', reward.productId) || {}).category, price: 0, originalPrice: 0, promo: 'מתנת מועדון', qty: 1, photoUrl: '', note: '' }]
    : items0;
  // חשבון מועדון: נוצר בהזמנה הראשונה של הטלפון; המפתח חוזר רק למי שיצר אותו או למי שכבר מחזיק בו
  const club = clubInfo().enabled && phone ? loyalty.ensure(phone, customer.name) : { acc: null, created: false };
  const clubToken = club.acc && (club.created || (acc && acc.id === club.acc.id)) ? club.acc.token : '';
  const order = db.insert('orders', {
    id: db.id('o_'), number: 1000 + db.all('orders').length + 1, trackToken: token(8),
    loyaltyPhone: club.acc ? phone : '', reward, clubTokenNew: club.created ? club.acc.token : '',
    customer, items, subtotalBefore: q.subtotalBefore, discount: q.discount, coupon: q.codeUsed ? q.code : '',
    subtotal: q.subtotal, shipping: q.shipping, total: q.total, status: 'pending_payment', timeline: [], eventCode: str(b.eventCode, 40) || null,
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
    return json({ orderId: order.id, number: order.number, trackToken: order.trackToken, redirectUrl: result.redirectUrl, clubToken });
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

on('GET', '/api/admin/print-types', () => json(printTypes()), { admin: true });
on('GET', '/api/admin/event-types', () => json(eventTypes()), { admin: true });
// תמונה לסוג אירוע ("קנו לפי אירוע"). image ריק = חזרה לתמונת ברירת המחדל
on('PUT', '/api/admin/event-types/:id', async (c) => {
  if (!EVENT_IDS.includes(c.params.id)) return err(404, 'לא נמצא');
  const image = str((await body(c.req)).image, 300);
  if (image && !IMG_RE.test(image)) return err(400, 'תמונה לא תקינה');
  const imgs = { ...(db.settings().eventImages || {}) };
  if (image) imgs[c.params.id] = image; else delete imgs[c.params.id];
  db.setSettings({ eventImages: imgs });
  return json(eventTypes().find((e) => e.id === c.params.id));
}, { admin: true });

// סטטיסטיקה: מכירות ב-30 הימים האחרונים, נמכרים ביותר, ביצועי מבצעים
on('GET', '/api/admin/stats', () => {
  const paid = db.all('orders').filter((o) => PAID.includes(o.status));
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    const list = paid.filter((o) => String(o.createdAt).slice(0, 10) === d);
    days.push({ date: d, orders: list.length, revenue: list.reduce((s, o) => s + o.total, 0) });
  }
  const byProduct = {};
  for (const o of paid) for (const i of o.items) {
    const x = (byProduct[i.productId] = byProduct[i.productId] || { productId: i.productId, name: (db.get('products', i.productId) || i).name, qty: 0, revenue: 0 });
    x.qty += i.qty; x.revenue += i.price * i.qty;
  }
  const withDiscount = paid.filter((o) => o.discount > 0);
  const coupons = {};
  for (const o of withDiscount) if (o.coupon) coupons[o.coupon] = (coupons[o.coupon] || 0) + 1;
  const revenue = paid.reduce((s, o) => s + o.total, 0);
  return json({
    days, revenue, orders: paid.length, avgOrder: paid.length ? Math.round((revenue / paid.length) * 100) / 100 : 0,
    top: Object.values(byProduct).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    promo: { orders: withDiscount.length, discount: withDiscount.reduce((s, o) => s + o.discount, 0), revenue: withDiscount.reduce((s, o) => s + o.total, 0), coupons },
  });
}, { admin: true });

// העלאת תמונות מוצר מאפליקציית הניהול
on('POST', '/api/admin/uploads', async (c) => {
  const b = await body(c.req);
  return json({ url: (await saveFile(b.file, IMAGE_TYPES)).url });
}, { admin: true });

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

// ---------- תמונות הלקוחות (לתוכנת פריים־סטודיו ולמסך הניהול) ----------
// כל תמונה להדפסה: מאורחים באירוע וממוצרים בהזמנות ששולמו, עם שם, טלפון, איפה, מה ובאיזה גודל
const sizeIn = (t) => { const m = String(t || '').match(/(\d{1,3}(?:\.\d{1,2})?)\s*[x×X]\s*(\d{1,3}(?:\.\d{1,2})?)/); return m ? `${m[1]}x${m[2]}` : ''; };
function customerPhotos() {
  const events = Object.fromEntries(db.all('events').map((e) => [e.id, e]));
  const guests = Object.fromEntries(db.all('guests').map((g) => [g.id, g]));
  const out = [];
  for (const p of db.all('photos')) {
    if (p.kind !== 'print') continue;
    const ev = events[p.eventId] || {}; const g = guests[p.guestId] || {};
    const opt = (ev.printOptions || []).find((o) => o.id === p.printOptionId) || {};
    out.push({ id: `ph:${p.id}`, source: 'event', url: p.url, name: g.name || '', phone: g.phone || '', where: ev.name || '', whereId: ev.id || '',
      product: opt.label || '', type: opt.type || '', size: opt.size || '', qty: 1, status: p.printStatus || 'pending', edits: p.editsApplied || '', createdAt: p.createdAt });
  }
  for (const o of db.all('orders')) {
    if (!PAID.includes(o.status)) continue;
    o.items.forEach((i, idx) => {
      if (!i.photoUrl) return;
      out.push({ id: `oi:${o.id}:${idx}`, source: 'order', url: i.photoUrl, name: o.customer.name, phone: o.customer.phone, email: o.customer.email || '', city: o.customer.city,
        where: `הזמנה #${o.number}`, whereId: o.id, product: i.name, type: i.category || '', size: sizeIn(i.variant) || sizeIn(i.name), qty: i.qty,
        status: i.printStatus || 'pending', orderStatus: STATUS_NAME[o.status], createdAt: o.createdAt });
    });
  }
  return out.sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)));
}
const PRINT_STATUSES = ['pending', 'printing', 'printed', 'delivered', 'rejected'];
on('GET', '/api/admin/customer-photos', () => json(customerPhotos()), { admin: true });
on('PATCH', '/api/admin/customer-photos/:id', async (c) => {
  const b = await body(c.req);
  if (!PRINT_STATUSES.includes(b.status)) return err(400, 'סטטוס לא תקין');
  const [kind, id, idx] = decodeURIComponent(c.params.id).split(':');
  if (kind === 'ph') {
    const p = db.update('photos', id, { printStatus: b.status });
    return p ? json({ ok: true }) : err(404, 'לא נמצא');
  }
  const o = kind === 'oi' && db.get('orders', id);
  const item = o && o.items[Number(idx)];
  if (!item || !item.photoUrl) return err(404, 'לא נמצא');
  item.printStatus = b.status;
  db.update('orders', o.id, { items: o.items });
  return json({ ok: true });
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

// תמונה לקטגוריה (מחליפה את תמונת ברירת המחדל בחנות). image ריק = חזרה לברירת המחדל
on('PUT', '/api/admin/categories/:id', async (c) => {
  const b = await body(c.req);
  const image = str(b.image, 300);
  if (image && !IMG_RE.test(image)) return err(400, 'תמונה לא תקינה');
  const rec = db.update('categories', c.params.id, { image });
  return rec ? json(rec) : err(404, 'לא נמצא');
}, { admin: true });

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
  if (status === 'cancelled') loyalty.reverse(o);
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
    loyalty: {
      enabled: b.loyalty ? b.loyalty.enabled !== false : loyalty.settings().enabled,
      earnPercent: Math.min(100, Math.max(0, num(b.loyalty && b.loyalty.earnPercent, loyalty.settings().earnPercent))),
      minPoints: Math.max(0, Math.floor(num(b.loyalty && b.loyalty.minPoints, loyalty.settings().minPoints))),
    },
    editor: b.editor && typeof b.editor === 'object' ? {
      store: b.editor.store !== false,
      tools: Object.fromEntries(EDITOR_TOOLS.map((k) => [k, !(b.editor.tools && b.editor.tools[k] === false)])),
      ai: Object.fromEntries(AI_EFFECTS.map((k) => [k, !(b.editor.ai && b.editor.ai[k] === false)])),
    } : editorSettings(),
    printSizes: b.printSizes && typeof b.printSizes === 'object'
      ? Object.fromEntries(PRINT_TYPES.map((t) => [t.type, [...new Set((Array.isArray(b.printSizes[t.type]) ? b.printSizes[t.type] : []).map(normSize).filter(Boolean))].slice(0, 12)]))
      : (db.settings().printSizes || {}),
  }));
}, { admin: true });

// מועדון הנקודות: חברים, עדכון ידני, הגדרות
on('GET', '/api/admin/loyalty', () => json({
  settings: loyalty.settings(),
  members: db.all('loyalty').map((a) => ({ id: a.id, phone: a.phone, name: a.name, points: a.points, earned: a.earned, spent: a.spent,
    lastAt: (a.history && a.history[0] && a.history[0].at) || a.createdAt, clubLink: `${config.pagesUrl}/?club=${a.token}#orders` }))
    .sort((x, y) => y.points - x.points),
}), { admin: true });

on('POST', '/api/admin/loyalty/:id/adjust', async (c) => {
  const acc = db.get('loyalty', c.params.id);
  if (!acc) return err(404, 'לא נמצא');
  const b = await body(c.req);
  const pts = Math.trunc(num(b.points));
  if (!pts) return err(400, 'נא להזין מספר נקודות (אפשר גם שלילי)');
  loyalty.adjust(acc, pts, str(b.note, 120));
  return json({ ok: true, points: acc.points });
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
