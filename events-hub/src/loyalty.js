// מועדון נקודות ("מועדון רגעים").
// - על כל הזמנה ששולמה הלקוח צובר נקודות: earnPercent% מסכום המוצרים (בלי משלוח), נקודה = 1 ₪.
// - מעל minPoints אפשר לממש נקודות בהטבות שהמנהל מגדיר (rewards): הנחה בשקלים, או מתנה (מוצר בחינם).
// - החשבון מזוהה לפי מספר הטלפון. כדי שאף אחד לא יממש נקודות של מישהו אחר, בטלפון של הלקוח נשמר
//   "מפתח מועדון" (token) שמתקבל בהזמנה הראשונה, או בקישור שהמנהל שולח בוואטסאפ.
// - הנקודות נצברות ומנוכות רק כשהתשלום אושר, ומתבטלות אם ההזמנה בוטלה.
import crypto from 'node:crypto';
import db from './db.js';

export const DEFAULT_LOYALTY = { enabled: true, earnPercent: 10, minPoints: 100 };

export const settings = () => ({ ...DEFAULT_LOYALTY, ...(db.settings().loyalty || {}) });

// 050-123-4567 / +972501234567 -> 0501234567
export function normPhone(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('972')) d = '0' + d.slice(3);
  return /^0\d{8,9}$/.test(d) ? d : '';
}

const accountId = (phone) => `ph_${phone}`;
export const byPhone = (phone) => db.get('loyalty', accountId(normPhone(phone)));
export const byToken = (t) => (t && /^[a-f0-9]{32}$/.test(t) ? db.all('loyalty').find((a) => a.token && a.token.length === t.length && crypto.timingSafeEqual(Buffer.from(a.token), Buffer.from(t))) : null);

// החשבון של הטלפון (נוצר אם אין). created=true רק כשנוצר עכשיו
export function ensure(phone, name = '') {
  const p = normPhone(phone);
  if (!p) return { acc: null, created: false };
  const existing = db.get('loyalty', accountId(p));
  if (existing) return { acc: existing, created: false };
  const acc = db.insert('loyalty', { id: accountId(p), phone: p, name, token: crypto.randomBytes(16).toString('hex'), points: 0, earned: 0, spent: 0, history: [] });
  return { acc, created: true };
}

function move(acc, points, type, note, orderId = null) {
  acc.points = Math.max(0, acc.points + points);
  if (points > 0 && type === 'earn') acc.earned += points;
  if (points < 0 && type === 'spend') acc.spent += -points;
  acc.history = [{ at: new Date().toISOString(), points, type, note, orderId }, ...(acc.history || [])].slice(0, 100);
  db.save('loyalty', acc);
}

export const pointsFor = (amount) => Math.floor((Math.max(0, amount) * settings().earnPercent) / 100);

// הטבה שהלקוח בחר: בודקים יתרה ומינימום. מחזיר { reward, error }
export function checkReward(acc, rewardId) {
  if (!rewardId) return { reward: null };
  const s = settings();
  const reward = db.get('rewards', rewardId);
  if (!s.enabled || !reward || reward.active === false) return { error: 'ההטבה לא זמינה' };
  if (!acc) return { error: 'כדי לממש נקודות צריך להיות מחוברים למועדון' };
  if (acc.points < s.minPoints) return { error: `מימוש נקודות מתאפשר מ-${s.minPoints} נקודות` };
  if (acc.points < reward.points) return { error: 'אין מספיק נקודות להטבה הזו' };
  return { reward };
}

// בעת אישור התשלום: ניכוי נקודות ההטבה וצבירת נקודות על הקנייה
export function settle(order) {
  if (order.loyaltySettled || !order.loyaltyPhone) return;
  const { acc } = ensure(order.loyaltyPhone, order.customer && order.customer.name);
  if (!acc) return;
  if (order.reward && order.reward.points) move(acc, -order.reward.points, 'spend', `מימוש: ${order.reward.name}`, order.id);
  const earn = settings().enabled ? pointsFor(order.subtotal) : 0;
  if (earn) move(acc, earn, 'earn', `הזמנה #${order.number}`, order.id);
  order.loyaltyEarned = earn;
  order.loyaltySettled = true;
  db.save('orders', order);
}

// הזמנה בוטלה: מחזירים את מה שמומש ומורידים את מה שנצבר
export function reverse(order) {
  if (!order.loyaltySettled || order.loyaltyReversed) return;
  const acc = byPhone(order.loyaltyPhone);
  if (!acc) return;
  if (order.loyaltyEarned) move(acc, -order.loyaltyEarned, 'cancel', `ביטול הזמנה #${order.number}`, order.id);
  if (order.reward && order.reward.points) move(acc, order.reward.points, 'refund', `החזר על ביטול הזמנה #${order.number}`, order.id);
  order.loyaltyReversed = true;
  db.save('orders', order);
}

export function adjust(acc, points, note) { move(acc, Math.trunc(points), 'admin', note || 'עדכון ידני'); }

export const publicRewards = () => db.all('rewards').filter((r) => r.active !== false)
  .map((r) => ({ id: r.id, name: r.name, kind: r.kind, amount: r.amount, productId: r.productId, points: r.points, description: r.description || '' }))
  .sort((a, b) => a.points - b.points);

export function publicAccount(acc) {
  const s = settings();
  return {
    points: acc.points, earned: acc.earned, spent: acc.spent, name: acc.name, phone: `${acc.phone.slice(0, 3)}-***-${acc.phone.slice(-4)}`,
    minPoints: s.minPoints, earnPercent: s.earnPercent, canRedeem: s.enabled && acc.points >= s.minPoints,
    history: (acc.history || []).slice(0, 20).map(({ at, points, type, note }) => ({ at, points, type, note })),
  };
}
