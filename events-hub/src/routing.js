// שיוך אוטומטי של ספק ושליח להזמנה לפי עיר הלקוח וקטגוריית המוצר.
import db from './db.js';

export const OPEN_STATUSES = ['paid', 'sent_to_supplier', 'in_production', 'ready', 'picked_up', 'out_for_delivery', 'issue'];

export function cityRegion(cityName) {
  const c = db.all('cities').find((x) => x.name === cityName);
  return c ? c.region : null;
}

function openLoad(field, entityId) {
  return db.all('orders').filter((o) => OPEN_STATUSES.includes(o.status) &&
    (field === 'courierId' ? o.courierId === entityId : (o.items || []).some((i) => i.supplierId === entityId))).length;
}

function pickLeastLoaded(list, field) {
  return list
    .map((x) => ({ x, load: openLoad(field, x.id) }))
    .sort((a, b) => a.load - b.load)[0]?.x || null;
}

export function findSupplier(category, city) {
  const region = cityRegion(city);
  const active = db.all('suppliers').filter((s) => s.active && (s.categories || []).includes(category));
  const exact = active.filter((s) => (s.cities || []).includes(city));
  if (exact.length) return { supplier: pickLeastLoaded(exact, 'supplierId'), match: 'city' };
  const reg = active.filter((s) => region && ((s.regions || []).includes(region) ||
    (s.cities || []).some((c) => cityRegion(c) === region)));
  if (reg.length) return { supplier: pickLeastLoaded(reg, 'supplierId'), match: 'region' };
  return { supplier: null, match: 'none' };
}

export function findCourier(city) {
  const region = cityRegion(city);
  const active = db.all('couriers').filter((k) => k.active);
  const exact = active.filter((k) => (k.cities || []).includes(city));
  if (exact.length) return { courier: pickLeastLoaded(exact, 'courierId'), match: 'city' };
  const reg = active.filter((k) => region && (k.regions || []).includes(region));
  if (reg.length) return { courier: pickLeastLoaded(reg, 'courierId'), match: 'region' };
  return { courier: null, match: 'none' };
}

const MATCH_HE = { city: 'באותה עיר', region: 'באותו אזור', none: 'לא נמצא - נדרש שיוך ידני' };

// משייך ספק לכל פריט ושליח להזמנה, ומחזיר הערות שיוך לציר הזמן
export function assignOrder(order) {
  const notes = [];
  for (const item of order.items) {
    const product = db.get('products', item.productId);
    const category = product ? product.category : item.category;
    const { supplier, match } = findSupplier(category, order.customer.city);
    item.supplierId = supplier ? supplier.id : null;
    notes.push(`ספק ל"${item.name}": ${supplier ? supplier.name : '—'} (${MATCH_HE[match]})`);
  }
  const { courier, match } = findCourier(order.customer.city);
  order.courierId = courier ? courier.id : null;
  notes.push(`שליח: ${courier ? courier.name : '—'} (${MATCH_HE[match]})`);
  order.needsManualAssignment = !order.courierId || order.items.some((i) => !i.supplierId);
  return notes;
}

