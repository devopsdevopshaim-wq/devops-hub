// סטטוסים של הזמנה/משלוח, ציר זמן וזיהוי משלוחים תקועים.
const db = require('./db');

const STATUSES = [
  { id: 'pending_payment', name: 'ממתין לתשלום' },
  { id: 'paid', name: 'שולם - התקבלה הזמנה' },
  { id: 'sent_to_supplier', name: 'נשלח לספק' },
  { id: 'in_production', name: 'בהכנה אצל הספק' },
  { id: 'ready', name: 'מוכן לאיסוף' },
  { id: 'picked_up', name: 'נאסף ע"י שליח' },
  { id: 'out_for_delivery', name: 'בדרך ללקוח' },
  { id: 'delivered', name: 'נמסר ללקוח' },
  { id: 'issue', name: 'בעיה / עיכוב' },
  { id: 'cancelled', name: 'בוטל' },
  { id: 'payment_failed', name: 'תשלום נכשל' },
];
const STATUS_NAME = Object.fromEntries(STATUSES.map((s) => [s.id, s.name]));

function addEvent(order, status, note, by = 'system') {
  order.timeline = order.timeline || [];
  order.timeline.push({ status, note: note || '', by, at: new Date().toISOString() });
  if (status) {
    order.status = status;
    order.statusChangedAt = new Date().toISOString();
  }
  db.touch();
}

// מחזיר מידע על עיכוב: כמה שעות בסטטוס הנוכחי והאם עבר את ה-SLA
function stuckInfo(order) {
  const sla = (db.settings().slaHours || {})[order.status];
  const since = new Date(order.statusChangedAt || order.createdAt).getTime();
  const hours = (Date.now() - since) / 36e5;
  const stuck = order.status === 'issue' || (sla !== undefined && hours > sla);
  return { stuck, hoursInStatus: Math.round(hours * 10) / 10, slaHours: sla ?? null };
}

module.exports = { STATUSES, STATUS_NAME, addEvent, stuckInfo };
