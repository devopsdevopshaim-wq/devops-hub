// API ציבורי: אורחי אירוע (QR), חנות, הזמנות, מעקב משלוח, סליקה ו-AI
const express = require('express');
const fs = require('fs');
const db = require('../db');
const config = require('../config');
const payments = require('../payments');
const { assignOrder } = require('../routing');
const { addEvent, STATUS_NAME, STATUSES } = require('../shipping');
const { upload, rateLimit, token, str, num, safeEqual } = require('../util');

const router = express.Router();

// ---------- עזר ----------
function eventEnded(ev) {
  return !ev.active || (ev.endsAt && Date.now() > new Date(ev.endsAt).getTime());
}

function publicEvent(ev) {
  return {
    code: ev.code, name: ev.name, type: ev.type, date: ev.date, endsAt: ev.endsAt,
    welcomeText: ev.welcomeText, photosPerGuest: ev.photosPerGuest, printOptions: ev.printOptions,
    allowAnimations: ev.allowAnimations !== false, ended: eventEnded(ev),
  };
}

function guestAuth(req, res, next) {
  const ev = db.all('events').find((e) => e.code === req.params.code);
  if (!ev) return res.status(404).json({ error: 'אירוע לא נמצא' });
  const guestId = req.get('x-guest-id') || req.body?.guestId;
  const guestToken = req.get('x-guest-token') || req.body?.guestToken;
  const guest = db.get('guests', guestId);
  if (!guest || guest.eventId !== ev.id || !safeEqual(guest.token, guestToken)) {
    return res.status(401).json({ error: 'אורח לא מזוהה - יש לסרוק את ה-QR מחדש' });
  }
  req.event = ev;
  req.guest = guest;
  next();
}

function guestPhotos(guest) {
  return db.find('photos', (p) => p.guestId === guest.id).map((p) => ({
    id: p.id, url: p.url, kind: p.kind, printOptionId: p.printOptionId, printStatus: p.printStatus, createdAt: p.createdAt,
  }));
}

function remaining(ev, guest) {
  const printed = db.find('photos', (p) => p.guestId === guest.id && p.kind === 'print').length;
  let left = Math.max(0, ev.photosPerGuest - printed);
  if (ev.totalPhotoLimit) {
    const total = db.find('photos', (p) => p.eventId === ev.id && p.kind === 'print').length;
    left = Math.min(left, Math.max(0, ev.totalPhotoLimit - total));
  }
  return left;
}

function removeFile(file) {
  if (file) fs.unlink(file.path, () => {});
}

// ---------- הגדרות כלליות ----------
router.get('/config', (req, res) => {
  const s = db.settings();
  res.json({
    businessName: s.businessName, shippingPrice: s.shippingPrice, freeShippingFrom: s.freeShippingFrom,
    paymentProvider: payments.activeProviderId(), aiRemoveBg: Boolean(config.ai.removeBgKey),
    statuses: STATUSES,
  });
});

router.get('/cities', (req, res) => {
  res.json(db.all('cities').map((c) => ({ name: c.name, region: c.region })).sort((a, b) => a.name.localeCompare(b.name, 'he')));
});

// ---------- אירוע / QR ----------
router.get('/event/:code', (req, res) => {
  const ev = db.all('events').find((e) => e.code === req.params.code);
  if (!ev) return res.status(404).json({ error: 'אירוע לא נמצא' });
  res.json(publicEvent(ev));
});

router.post('/event/:code/guest', rateLimit({ windowMs: 60_000, max: 20 }), (req, res) => {
  const ev = db.all('events').find((e) => e.code === req.params.code);
  if (!ev) return res.status(404).json({ error: 'אירוע לא נמצא' });
  const name = str(req.body.name, 80);
  if (!name) return res.status(400).json({ error: 'נא להזין שם' });
  const guest = db.insert('guests', {
    id: db.id('g_'), eventId: ev.id, name, phone: str(req.body.phone, 20), token: token(),
    marketingConsent: Boolean(req.body.marketingConsent),
  });
  res.json({ guestId: guest.id, guestToken: guest.token, event: publicEvent(ev), remaining: remaining(ev, guest) });
});

router.get('/event/:code/me', guestAuth, (req, res) => {
  res.json({
    event: publicEvent(req.event), guest: { name: req.guest.name },
    remaining: remaining(req.event, req.guest), photos: guestPhotos(req.guest),
  });
});

// העלאת תמונה להדפסה (נספרת במכסה) או אנימציה דיגיטלית (לא נספרת)
router.post('/event/:code/photos', rateLimit({ windowMs: 60_000, max: 30 }), upload.single('file'), guestAuth, (req, res) => {
  const ev = req.event;
  const kind = req.body.kind === 'animation' ? 'animation' : 'print';
  if (!req.file) return res.status(400).json({ error: 'לא התקבל קובץ' });
  if (eventEnded(ev)) { removeFile(req.file); return res.status(403).json({ error: 'האירוע הסתיים - ניתן להזמין מהחנות' }); }
  if (kind === 'print') {
    if (!req.file.mimetype.startsWith('image/')) { removeFile(req.file); return res.status(400).json({ error: 'יש להעלות תמונה' }); }
    if (remaining(ev, req.guest) <= 0) { removeFile(req.file); return res.status(403).json({ error: 'נוצלה מכסת התמונות שלך' }); }
    if (!ev.printOptions.find((o) => o.id === req.body.printOptionId)) {
      removeFile(req.file); return res.status(400).json({ error: 'יש לבחור אפשרות הדפסה' });
    }
  } else if (ev.allowAnimations === false) {
    removeFile(req.file); return res.status(403).json({ error: 'אנימציות אינן זמינות באירוע זה' });
  }
  const photo = db.insert('photos', {
    id: db.id('p_'), eventId: ev.id, guestId: req.guest.id, kind,
    url: '/uploads/' + req.file.filename, printOptionId: kind === 'print' ? req.body.printOptionId : null,
    printStatus: kind === 'print' ? 'pending' : null, editsApplied: str(req.body.edits, 300),
  });
  res.json({ photo: { id: photo.id, url: photo.url, kind }, remaining: remaining(ev, req.guest) });
});

// ---------- חנות ----------
function activeCollections() {
  const today = new Date().toISOString().slice(0, 10);
  return db.all('collections').filter((c) => c.active &&
    (!c.startDate || c.startDate <= today) && (!c.endDate || c.endDate >= today));
}

router.get('/store', (req, res) => {
  const cols = activeCollections();
  const activeIds = new Set(cols.map((c) => c.id));
  const products = db.all('products').filter((p) => p.active &&
    (!(p.collectionIds || []).length || p.collectionIds.some((id) => activeIds.has(id))));
  const usedCats = new Set(products.map((p) => p.category));
  res.json({
    categories: db.all('categories').filter((c) => usedCats.has(c.id)),
    collections: cols.filter((c) => products.some((p) => (p.collectionIds || []).includes(c.id))),
    products,
  });
});

// העלאת תמונה ע"י לקוח החנות (למוצר עם תמונה)
router.post('/uploads', rateLimit({ windowMs: 60_000, max: 20 }), upload.single('file'), (req, res) => {
  if (!req.file || !req.file.mimetype.startsWith('image/')) { removeFile(req.file); return res.status(400).json({ error: 'יש להעלות תמונה' }); }
  res.json({ url: '/uploads/' + req.file.filename });
});

// ---------- הזמנות ----------
router.post('/orders', rateLimit({ windowMs: 60_000, max: 10 }), async (req, res) => {
  const b = req.body || {};
  const customer = {
    name: str(b.customer?.name, 80), phone: str(b.customer?.phone, 20), email: str(b.customer?.email, 120),
    city: str(b.customer?.city, 60), address: str(b.customer?.address, 200), notes: str(b.customer?.notes, 500),
  };
  if (!customer.name || !customer.phone || !customer.city || !customer.address) {
    return res.status(400).json({ error: 'נא למלא שם, טלפון, עיר וכתובת' });
  }
  if (!db.all('cities').some((c) => c.name === customer.city)) return res.status(400).json({ error: 'עיר לא מוכרת - בחרו מהרשימה' });
  const items = [];
  for (const it of (Array.isArray(b.items) ? b.items : []).slice(0, 50)) {
    const product = db.get('products', it.productId);
    if (!product || !product.active) return res.status(400).json({ error: 'מוצר לא זמין' });
    const qty = Math.min(99, Math.max(1, Math.floor(num(it.qty, 1))));
    const photoUrl = str(it.photoUrl, 200);
    if (photoUrl && !/^\/uploads\/[a-f0-9]{24}\.(jpg|png|webp|gif)$/.test(photoUrl)) return res.status(400).json({ error: 'תמונה לא תקינה' });
    // המחיר נלקח תמיד מהשרת - לא סומכים על מחיר מהדפדפן
    items.push({ productId: product.id, name: product.name, category: product.category, price: product.price, qty, photoUrl, note: str(it.note, 200) });
  }
  if (!items.length) return res.status(400).json({ error: 'הסל ריק' });
  const s = db.settings();
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const shipping = subtotal >= s.freeShippingFrom ? 0 : s.shippingPrice;
  const order = db.insert('orders', {
    id: db.id('o_'), number: 1000 + db.all('orders').length + 1, trackToken: token(8),
    customer, items, subtotal, shipping, total: subtotal + shipping, status: 'pending_payment', timeline: [],
    eventCode: str(b.eventCode, 40) || null,
  });
  addEvent(order, 'pending_payment', 'הזמנה נוצרה');

  const payment = db.insert('payments', {
    id: db.id('pay_'), orderId: order.id, amount: order.total, currency: 'ILS', provider: payments.activeProviderId(), status: 'created',
  });
  try {
    const base = config.publicUrl;
    const result = await payments.adapter().createPayment({
      payment, order,
      successUrl: `${base}/pay/return?paymentId=${payment.id}`,
      failUrl: `${base}/pay/return?paymentId=${payment.id}`,
      notifyUrl: `${base}/api/payments/callback`,
    });
    db.update('payments', payment.id, { providerRef: result.providerRef, status: 'redirected' });
    res.json({ orderId: order.id, number: order.number, trackToken: order.trackToken, redirectUrl: result.redirectUrl });
  } catch (e) {
    db.update('payments', payment.id, { status: 'error', error: e.message });
    res.status(503).json({ error: 'מערכת התשלום אינה זמינה כרגע', detail: e.message });
  }
});

function publicOrder(o) {
  return {
    id: o.id, number: o.number, status: o.status, statusName: STATUS_NAME[o.status], createdAt: o.createdAt,
    items: o.items.map((i) => ({ name: i.name, qty: i.qty, price: i.price, photoUrl: i.photoUrl })),
    subtotal: o.subtotal, shipping: o.shipping, total: o.total, city: o.customer.city,
    timeline: o.timeline.filter((t) => !t.internal).map((t) => ({ status: t.status, statusName: STATUS_NAME[t.status] || '', note: t.publicNote ? t.note : '', at: t.at })),
  };
}

router.get('/orders/:id', (req, res) => {
  const o = db.get('orders', req.params.id);
  if (!o || !safeEqual(o.trackToken, req.query.t)) return res.status(404).json({ error: 'הזמנה לא נמצאה' });
  res.json(publicOrder(o));
});

// ---------- סליקה ----------
function applyPaymentResult({ paymentId, approved, providerRef, raw }) {
  const pay = db.get('payments', paymentId);
  if (!pay) return null;
  const order = db.get('orders', pay.orderId);
  if (pay.status === 'approved') return { pay, order }; // אידמפוטנטי
  db.update('payments', pay.id, { status: approved ? 'approved' : 'declined', providerRef: providerRef || pay.providerRef, raw });
  if (approved) {
    addEvent(order, 'paid', `התשלום אושר (${pay.provider})`);
    order.timeline[order.timeline.length - 1].publicNote = false;
    const notes = assignOrder(order);
    addEvent(order, null, notes.join(' | '), 'routing');
    order.timeline[order.timeline.length - 1].internal = true;
  } else {
    addEvent(order, 'payment_failed', 'התשלום נדחה');
  }
  db.touch();
  return { pay, order };
}

// עדכון שרת-לשרת מחברת הסליקה (webhook)
router.post('/payments/callback', express.urlencoded({ extended: false }), (req, res) => {
  try {
    const parsed = payments.adapter().parseCallback(req);
    if (!applyPaymentResult(parsed)) return res.status(404).send('unknown payment');
    res.send('OK');
  } catch (e) {
    res.status(400).send(e.message);
  }
});

module.exports = { router, applyPaymentResult, publicOrder, eventEnded };
