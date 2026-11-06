// API מנהל: אירועים ו-QR, מוצרים, קולקציות עונתיות, ספקים, שליחים, ערים, הזמנות ומשלוחים, הגדרות וסליקה
const express = require('express');
const QRCode = require('qrcode');
const db = require('../db');
const config = require('../config');
const auth = require('../auth');
const payments = require('../payments');
const { PRINT_TYPES } = require('../seed');
const { assignOrder, OPEN_STATUSES } = require('../routing');
const { addEvent, stuckInfo, STATUS_NAME } = require('../shipping');
const { rateLimit, token, str, num, arr } = require('../util');

const router = express.Router();

// ---------- התחברות ----------
router.post('/login', rateLimit({ windowMs: 15 * 60_000, max: 10 }), (req, res) => {
  if (!auth.checkPassword(req.body?.password)) return res.status(401).json({ error: 'סיסמה שגויה' });
  res.cookie(auth.COOKIE, auth.createToken(), {
    httpOnly: true, sameSite: 'strict', secure: config.publicUrl.startsWith('https'), maxAge: auth.MAX_AGE_MS,
  });
  res.json({ ok: true });
});
router.post('/logout', (req, res) => { res.clearCookie(auth.COOKIE); res.json({ ok: true }); });
router.use(auth.requireAdmin);
router.get('/me', (req, res) => res.json({ ok: true }));

// ---------- לוח בקרה ----------
router.get('/dashboard', (req, res) => {
  const orders = db.all('orders');
  const open = orders.filter((o) => OPEN_STATUSES.includes(o.status));
  res.json({
    events: db.all('events').length,
    guests: db.all('guests').length,
    photosPending: db.find('photos', (p) => p.kind === 'print' && p.printStatus === 'pending').length,
    ordersOpen: open.length,
    ordersStuck: open.filter((o) => stuckInfo(o).stuck).length,
    needsAssignment: open.filter((o) => o.needsManualAssignment).length,
    revenue: orders.filter((o) => !['pending_payment', 'payment_failed', 'cancelled'].includes(o.status)).reduce((s, o) => s + o.total, 0),
  });
});

// ---------- אירועים ----------
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

router.get('/print-types', (req, res) => res.json(PRINT_TYPES));

router.get('/events', (req, res) => {
  res.json(db.all('events').map((e) => ({
    ...e,
    guests: db.find('guests', (g) => g.eventId === e.id).length,
    photos: db.find('photos', (p) => p.eventId === e.id && p.kind === 'print').length,
    link: `${config.publicUrl}/e/${e.code}`,
  })).reverse());
});

router.post('/events', (req, res) => {
  const f = eventFields(req.body || {});
  if (!f.name) return res.status(400).json({ error: 'נא להזין שם אירוע' });
  if (!f.printOptions.length) return res.status(400).json({ error: 'יש לבחור לפחות אפשרות הדפסה אחת (עד 3)' });
  res.json(db.insert('events', { id: db.id('e_'), code: token(4), ...f }));
});

router.put('/events/:id', (req, res) => {
  const f = eventFields(req.body || {});
  if (!f.printOptions.length) return res.status(400).json({ error: 'יש לבחור לפחות אפשרות הדפסה אחת (עד 3)' });
  const ev = db.update('events', req.params.id, f);
  ev ? res.json(ev) : res.status(404).json({ error: 'לא נמצא' });
});

router.delete('/events/:id', (req, res) => res.json({ ok: db.remove('events', req.params.id) }));

router.get('/events/:id/qr.:fmt(png|svg)', async (req, res) => {
  const ev = db.get('events', req.params.id);
  if (!ev) return res.status(404).end();
  const url = `${config.publicUrl}/e/${ev.code}`;
  if (req.params.fmt === 'svg') {
    res.type('image/svg+xml').send(await QRCode.toString(url, { type: 'svg', margin: 2 }));
  } else {
    res.type('png').send(await QRCode.toBuffer(url, { width: 800, margin: 2 }));
  }
});

router.get('/events/:id/photos', (req, res) => {
  const ev = db.get('events', req.params.id);
  if (!ev) return res.status(404).json({ error: 'לא נמצא' });
  const guests = Object.fromEntries(db.find('guests', (g) => g.eventId === ev.id).map((g) => [g.id, g]));
  res.json(db.find('photos', (p) => p.eventId === ev.id).map((p) => ({
    ...p, guestName: guests[p.guestId]?.name, guestPhone: guests[p.guestId]?.phone,
    printOption: ev.printOptions.find((o) => o.id === p.printOptionId)?.label || '',
  })).reverse());
});

router.patch('/photos/:id', (req, res) => {
  const allowed = ['pending', 'printing', 'printed', 'delivered', 'rejected'];
  if (!allowed.includes(req.body.printStatus)) return res.status(400).json({ error: 'סטטוס לא תקין' });
  const p = db.update('photos', req.params.id, { printStatus: req.body.printStatus });
  p ? res.json(p) : res.status(404).json({ error: 'לא נמצא' });
});

router.get('/guests', (req, res) => {
  const events = Object.fromEntries(db.all('events').map((e) => [e.id, e.name]));
  res.json(db.all('guests').map(({ token: _t, ...g }) => ({ ...g, eventName: events[g.eventId] })).reverse());
});

// ---------- CRUD גנרי ----------
function crud(col, fields, prefix) {
  router.get(`/${col}`, (req, res) => res.json(db.all(col)));
  router.post(`/${col}`, (req, res) => {
    const f = fields(req.body || {});
    if (!f.name) return res.status(400).json({ error: 'נא להזין שם' });
    res.json(db.insert(col, { id: db.id(prefix), ...f }));
  });
  router.put(`/${col}/:id`, (req, res) => {
    const rec = db.update(col, req.params.id, fields(req.body || {}));
    rec ? res.json(rec) : res.status(404).json({ error: 'לא נמצא' });
  });
  router.delete(`/${col}/:id`, (req, res) => res.json({ ok: db.remove(col, req.params.id) }));
}

crud('products', (b) => ({
  name: str(b.name, 120), category: str(b.category, 40), price: Math.max(0, num(b.price)), icon: str(b.icon, 10),
  description: str(b.description, 600), image: str(b.image, 300), collectionIds: arr(b.collectionIds),
  needsPhoto: Boolean(b.needsPhoto), active: b.active !== false,
}), 'pr_');

crud('collections', (b) => ({
  name: str(b.name, 80), icon: str(b.icon, 10), kind: str(b.kind, 20) || 'special',
  startDate: str(b.startDate, 10), endDate: str(b.endDate, 10), active: b.active !== false,
}), 'col_');

crud('suppliers', (b) => ({
  name: str(b.name, 120), contact: str(b.contact, 80), phone: str(b.phone, 20), email: str(b.email, 120),
  categories: arr(b.categories), cities: arr(b.cities), regions: arr(b.regions), notes: str(b.notes, 1000), active: b.active !== false,
}), 's_');

crud('couriers', (b) => ({
  name: str(b.name, 120), phone: str(b.phone, 20), vehicle: str(b.vehicle, 40),
  cities: arr(b.cities), regions: arr(b.regions), notes: str(b.notes, 1000), active: b.active !== false,
}), 'k_');

crud('cities', (b) => ({ name: str(b.name, 60), region: str(b.region, 40) }), 'c_');

router.get('/categories', (req, res) => res.json(db.all('categories')));

// ---------- הזמנות ומשלוחים ----------
function orderView(o) {
  const suppliers = Object.fromEntries(db.all('suppliers').map((s) => [s.id, s]));
  const courier = o.courierId ? db.get('couriers', o.courierId) : null;
  return {
    ...o, statusName: STATUS_NAME[o.status], ...stuckInfo(o),
    courier: courier ? { id: courier.id, name: courier.name, phone: courier.phone } : null,
    items: o.items.map((i) => ({ ...i, supplier: suppliers[i.supplierId] ? { id: i.supplierId, name: suppliers[i.supplierId].name, phone: suppliers[i.supplierId].phone } : null })),
    trackUrl: `${config.publicUrl}/track.html?id=${o.id}&t=${o.trackToken}`,
  };
}

router.get('/orders', (req, res) => {
  let list = db.all('orders').map(orderView);
  if (req.query.filter === 'open') list = list.filter((o) => OPEN_STATUSES.includes(o.status));
  if (req.query.filter === 'stuck') list = list.filter((o) => o.stuck && OPEN_STATUSES.includes(o.status));
  if (req.query.city) list = list.filter((o) => o.customer.city === req.query.city);
  res.json(list.reverse());
});

router.get('/orders/:id', (req, res) => {
  const o = db.get('orders', req.params.id);
  o ? res.json(orderView(o)) : res.status(404).json({ error: 'לא נמצא' });
});

// עדכון סטטוס ו/או הוספת הערה (הערה פנימית או גלויה ללקוח)
router.post('/orders/:id/events', (req, res) => {
  const o = db.get('orders', req.params.id);
  if (!o) return res.status(404).json({ error: 'לא נמצא' });
  const status = req.body.status && STATUS_NAME[req.body.status] ? req.body.status : null;
  const note = str(req.body.note, 1000);
  if (!status && !note) return res.status(400).json({ error: 'נא לבחור סטטוס או לכתוב הערה' });
  addEvent(o, status, note, 'admin');
  const last = o.timeline[o.timeline.length - 1];
  last.publicNote = Boolean(req.body.publicNote);
  if (!status) last.internal = !last.publicNote;
  db.touch();
  res.json(orderView(o));
});

router.post('/orders/:id/assign', (req, res) => {
  const o = db.get('orders', req.params.id);
  if (!o) return res.status(404).json({ error: 'לא נמצא' });
  if (req.body.auto) {
    const notes = assignOrder(o);
    addEvent(o, null, 'שיוך אוטומטי מחדש: ' + notes.join(' | '), 'admin');
  } else {
    if (req.body.courierId !== undefined) o.courierId = req.body.courierId || null;
    for (const [idx, supplierId] of Object.entries(req.body.suppliers || {})) {
      if (o.items[idx]) o.items[idx].supplierId = supplierId || null;
    }
    o.needsManualAssignment = !o.courierId || o.items.some((i) => !i.supplierId);
    addEvent(o, null, 'שיוך ידני של ספק/שליח', 'admin');
  }
  o.timeline[o.timeline.length - 1].internal = true;
  db.touch();
  res.json(orderView(o));
});

// ---------- הגדרות וסליקה ----------
router.get('/settings', (req, res) => res.json({ settings: db.settings(), payments: payments.providerInfo(), publicUrl: config.publicUrl }));

router.put('/settings', (req, res) => {
  const b = req.body || {};
  const sla = {};
  for (const [k, v] of Object.entries(b.slaHours || {})) if (STATUS_NAME[k]) sla[k] = Math.max(0, num(v));
  res.json(db.setSettings({
    businessName: str(b.businessName, 120), shippingPrice: Math.max(0, num(b.shippingPrice)),
    freeShippingFrom: Math.max(0, num(b.freeShippingFrom)), paymentDashboardUrl: str(b.paymentDashboardUrl, 300),
    slaHours: sla,
  }));
});

router.get('/payments', (req, res) => res.json(db.all('payments').slice().reverse().slice(0, 200)));

module.exports = router;
