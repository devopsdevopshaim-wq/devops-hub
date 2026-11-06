// מחירים ומבצעים. כל מחיר בחנות ובהזמנה מחושב כאן, בשרת - הדפדפן לא קובע מחיר.
// מבצע (promotions):
//   kind:  'percent' (אחוז הנחה) | 'amount' (₪ הנחה ליחידה) | 'price' (מחיר מבצע קבוע ליחידה)
//   scope: 'all' (כל החנות) | 'category' (categories[]) | 'products' (productIds[]) | 'collection' (collectionIds[])
//   startDate / endDate (YYYY-MM-DD, ריק = בלי הגבלה), active
//   code: קוד קופון (ריק = מבצע פתוח לכולם), minSubtotal: מינימום הזמנה (לפני הנחות), badge: תווית על המוצר
// כשכמה מבצעים פתוחים מתאימים למוצר - נבחר המחיר הנמוך ביותר (לא מצטברים ביניהם).
// קופון (מבצע עם קוד) חל בנוסף, על מחיר המבצע: קודם המבצע הפתוח, ואז הקופון.
import db from './db.js';

const today = () => new Date().toISOString().slice(0, 10);
const round = (n) => Math.round(n * 100) / 100;
export const normCode = (c) => String(c || '').trim().toUpperCase().replace(/[^A-Z0-9א-ת_-]/g, '').slice(0, 30);

export function livePromotions() {
  const t = today();
  return db.all('promotions').filter((p) => p.active !== false && (!p.startDate || p.startDate <= t) && (!p.endDate || p.endDate >= t));
}

function covers(promo, product) {
  switch (promo.scope) {
    case 'category': return (promo.categories || []).includes(product.category);
    case 'products': return (promo.productIds || []).includes(product.id);
    case 'collection': return (promo.collectionIds || []).some((id) => (product.collectionIds || []).includes(id));
    default: return true;
  }
}

function apply(promo, price) {
  const v = Number(promo.value) || 0;
  if (promo.kind === 'percent') return round(price * (1 - Math.min(100, Math.max(0, v)) / 100));
  if (promo.kind === 'amount') return round(Math.max(0, price - v));
  if (promo.kind === 'price') return round(Math.max(0, Math.min(price, v)));
  return price;
}

const info = (p) => ({ id: p.id, name: p.name, badge: p.badge || '', code: p.code || '' });

function bestOf(list, product, base, subtotal) {
  let best = { price: base, promo: null };
  for (const p of list) {
    if (!covers(p, product)) continue;
    if (p.minSubtotal && (subtotal === null || subtotal < p.minSubtotal)) continue;
    const price = apply(p, base);
    if (price < best.price) best = { price, promo: info(p) };
  }
  return best;
}

// המחיר של מוצר: { price, original, promo, coupon }. opts.code = קופון שהוזן, opts.subtotal = סכום הסל לפני הנחות
export function priceFor(product, { code = '', subtotal = null, promos = livePromotions() } = {}) {
  const original = Number(product.price) || 0;
  const auto = bestOf(promos.filter((p) => !p.code), product, original, subtotal);
  const c = normCode(code);
  const withCode = c ? bestOf(promos.filter((p) => p.code === c), product, auto.price, subtotal) : { price: auto.price, promo: null };
  return { price: withCode.price, original, promo: auto.promo, coupon: withCode.promo };
}

// תמחור סל: lines = [{ product, qty }] -> שורות + סכומים
export function quote(lines, { code = '', settings = db.settings() } = {}) {
  const promos = livePromotions();
  const subtotalBefore = round(lines.reduce((s, l) => s + (Number(l.product.price) || 0) * l.qty, 0));
  const priced = lines.map((l) => {
    const p = priceFor(l.product, { code, subtotal: subtotalBefore, promos });
    return { ...l, price: p.price, originalPrice: p.original, promo: p.promo, coupon: p.coupon };
  });
  const subtotal = round(priced.reduce((s, l) => s + l.price * l.qty, 0));
  const discount = round(subtotalBefore - subtotal);
  const shipping = subtotal >= settings.freeShippingFrom ? 0 : settings.shippingPrice;
  const c = normCode(code);
  const codeValid = !c || promos.some((p) => p.code === c);
  const codeUsed = Boolean(c) && priced.some((l) => l.coupon);
  return { lines: priced, subtotalBefore, discount, subtotal, shipping, total: round(subtotal + shipping), code: c, codeValid, codeUsed };
}

// מבצעים פתוחים (בלי קוד) להצגה בחנות
export function publicPromotions() {
  return livePromotions().filter((p) => !p.code).map((p) => ({
    id: p.id, name: p.name, badge: p.badge || '', kind: p.kind, value: p.value, scope: p.scope, minSubtotal: p.minSubtotal || 0, endDate: p.endDate || '',
  }));
}
