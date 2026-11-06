// נתוני התחלה: ערים לפי אזור, קטגוריות, מוצרים לדוגמה, קולקציות עונתיות, ספקים ושליחים לדוגמה.
import db from './db.js';

const CITIES = {
  'דרום': ['באר שבע', 'אשדוד', 'אשקלון', 'אילת', 'דימונה', 'נתיבות', 'אופקים', 'שדרות', 'קריית גת', 'ערד', 'רהט', 'ירוחם', 'מצפה רמון', 'עומר', 'להבים', 'מיתר'],
  'מרכז': ['תל אביב-יפו', 'רמת גן', 'גבעתיים', 'בני ברק', 'חולון', 'בת ים', 'ראשון לציון', 'רחובות', 'נס ציונה', 'פתח תקווה', 'ראש העין', 'הרצליה', 'רעננה', 'כפר סבא', 'הוד השרון', 'נתניה', 'רמלה', 'לוד', 'מודיעין-מכבים-רעות', 'יבנה', 'אור יהודה', 'יהוד-מונוסון', 'קריית אונו', 'אלעד'],
  'ירושלים והסביבה': ['ירושלים', 'בית שמש', 'מבשרת ציון', 'מעלה אדומים', 'ביתר עילית', 'מודיעין עילית', 'גבעת זאב'],
  'צפון': ['חיפה', 'קריית אתא', 'קריית ביאליק', 'קריית מוצקין', 'קריית ים', 'נשר', 'טירת כרמל', 'עכו', 'נהריה', 'כרמיאל', 'צפת', 'טבריה', 'עפולה', 'נצרת', 'נוף הגליל', 'קריית שמונה', 'מגדל העמק', 'יקנעם עילית', 'בית שאן', 'שפרעם', 'חדרה', 'זכרון יעקב', 'אור עקיבא', 'פרדס חנה-כרכור'],
  'יהודה ושומרון': ['אריאל', 'קרני שומרון', 'עמנואל', 'אפרת', 'קריית ארבע'],
};

const CATEGORIES = [
  { id: 'magnets', name: 'מגנטים', icon: '🧲', printable: true },
  { id: 'blocks', name: 'בלוקים מעץ', icon: '🟫', printable: true },
  { id: 'frames', name: 'מסגרות קרטון', icon: '🖼️', printable: true },
  { id: 'designed-photos', name: 'תמונות בעיצוב מיוחד', icon: '🎨', printable: true },
  { id: 'packages', name: 'חבילות לאירועים', icon: '🎁' },
  { id: 'gifts', name: 'מתנות', icon: '💝' },
  { id: 'sweets', name: 'מתוקים ומארזים', icon: '🍬' },
  { id: 'flowers', name: 'פרחים', icon: '💐' },
  { id: 'decor', name: 'עיצוב ודקורציה', icon: '🎈' },
];

// סוגי הדפסה זמינים לאירוע (מנהל בוחר עד 3 לכל אירוע)
export const PRINT_TYPES = [
  { type: 'magnet', name: 'מגנט', category: 'magnets', sizes: ['5x7.5', '6x9', '10x15'] },
  { type: 'block', name: 'בלוק עץ', category: 'blocks', sizes: ['10x10', '10x15', '15x15', '15x20'] },
  { type: 'frame', name: 'מסגרת קרטון', category: 'frames', sizes: ['10x15', '13x18', '15x20', '20x30'] },
];

const p = (id, name, category, price, icon, description, extra = {}) =>
  ({ id, name, category, price, icon, description, active: true, collectionIds: [], ...extra });

const PRODUCTS = [
  p('mag-6x9', 'מגנט תמונה 6x9', 'magnets', 15, '🧲', 'מגנט איכותי עם התמונה שלכם', { needsPhoto: true }),
  p('mag-set-10', 'סט 10 מגנטים', 'magnets', 120, '🧲', '10 מגנטים 6x9 - מושלם למשפחה', { needsPhoto: true }),
  p('block-15x15', 'בלוק עץ 15x15', 'blocks', 79, '🟫', 'הדפסה על בלוק עץ עבה, עומד על השולחן', { needsPhoto: true }),
  p('block-15x20', 'בלוק עץ 15x20', 'blocks', 99, '🟫', 'בלוק עץ בגודל גדול', { needsPhoto: true }),
  p('frame-13x18', 'מסגרת קרטון 13x18', 'frames', 25, '🖼️', 'מסגרת קרטון מעוצבת עם לוגו האירוע', { needsPhoto: true }),
  p('frame-20x30', 'מסגרת קרטון 20x30', 'frames', 45, '🖼️', 'מסגרת קרטון גדולה', { needsPhoto: true }),
  p('photo-art', 'תמונה בעיצוב אמנותי (AI)', 'designed-photos', 149, '🎨', 'הפיכת התמונה ליצירת אמנות בסגנון לבחירתכם, מודפסת על קנבס', { needsPhoto: true }),
  p('photo-collage', 'קולאז׳ תמונות מהאירוע', 'designed-photos', 129, '🎨', 'עד 12 תמונות בקולאז׳ מעוצב 30x40', { needsPhoto: true }),
  p('pkg-henna', 'חבילת חינה', 'packages', 1490, '🌿', 'מגש חינה מעוצב, תלבושות, כיבוד מסורתי ומגנטים לאורחים'),
  p('pkg-wedding', 'חבילת חתונה', 'packages', 2990, '💍', 'עמדת צילום + 300 מגנטים + ספר זכרונות'),
  p('pkg-mikveh', 'חבילת מקווה', 'packages', 690, '🕊️', 'סלסלה מעוצבת, סוכריות, פרחים ומזכרות'),
  p('pkg-barmitzvah', 'חבילת בר/בת מצווה', 'packages', 1990, '✡️', 'עמדת מגנטים, אלבום ומזכרות לאורחים'),
  p('pkg-brit', 'חבילת ברית/בריתה', 'packages', 890, '👶', 'מארז מזכרות, מגנטים ועיצוב שולחן'),
  p('pkg-birthday', 'חבילת יום הולדת', 'packages', 790, '🎂', 'עיצוב, בלונים ומזכרות'),
  p('gift-album', 'אלבום תמונות מעוצב', 'gifts', 249, '📔', 'אלבום כריכה קשה 30 עמודים', { needsPhoto: true }),
  p('gift-mug', 'ספל עם תמונה', 'gifts', 59, '☕', 'ספל קרמיקה עם תמונה והקדשה', { needsPhoto: true }),
  p('gift-pillow', 'כרית עם תמונה', 'gifts', 89, '🛋️', 'כרית רכה 40x40 עם הדפסה', { needsPhoto: true }),
  p('sweet-box', 'מארז שוקולדים ממותג', 'sweets', 119, '🍫', 'מארז שוקולדים עם מדבקה אישית'),
  p('flowers-bouquet', 'זר פרחים לאירוע', 'flowers', 199, '💐', 'זר עונתי מעוצב'),
  p('decor-balloons', 'קשת בלונים', 'decor', 450, '🎈', 'קשת בלונים בצבעי האירוע'),
  // מוצרים עונתיים
  p('rosh-hashana-box', 'מארז ראש השנה', 'sweets', 179, '🍯', 'דבש, רימונים ומגנט ברכה אישי', { collectionIds: ['col-rosh-hashana'] }),
  p('hanukkah-box', 'מארז חנוכה', 'sweets', 99, '🕎', 'סופגניות, סביבונים ומגנט אישי', { collectionIds: ['col-hanukkah'] }),
  p('pesach-box', 'מארז פסח', 'gifts', 199, '🍷', 'יין, מצות מעוצבות ומגנט משפחתי', { collectionIds: ['col-pesach'] }),
  p('conf-kit', 'ערכת כנס ממותגת', 'gifts', 39, '🎤', 'שקית, מחברת, עט ומגנט עם לוגו - מחיר ליחידה', { collectionIds: ['col-conferences'] }),
];

const COLLECTIONS = [
  { id: 'col-rosh-hashana', name: 'ראש השנה', icon: '🍎', kind: 'holiday', startDate: '2027-08-15', endDate: '2027-10-05', active: true },
  { id: 'col-hanukkah', name: 'חנוכה', icon: '🕎', kind: 'holiday', startDate: '2026-11-20', endDate: '2026-12-15', active: true },
  { id: 'col-pesach', name: 'פסח', icon: '🍷', kind: 'holiday', startDate: '2027-03-01', endDate: '2027-04-25', active: true },
  { id: 'col-conferences', name: 'כנסים ואירועי חברה', icon: '🎤', kind: 'conference', startDate: '', endDate: '', active: true },
];

// ספקים ושליחים לדוגמה - יש להחליף בפרטים אמיתיים בממשק המנהל
const SUPPLIERS = [
  { name: 'דפוס הנגב (דוגמה)', categories: ['magnets', 'blocks', 'frames', 'designed-photos', 'gifts'], cities: ['באר שבע', 'עומר', 'להבים', 'דימונה'], regions: ['דרום'], phone: '050-0000001', email: '', contact: '' },
  { name: 'מתוקי הדרום (דוגמה)', categories: ['sweets', 'packages'], cities: ['באר שבע', 'אשדוד'], regions: ['דרום'], phone: '050-0000002', email: '', contact: '' },
  { name: 'סטודיו מרכז (דוגמה)', categories: ['magnets', 'blocks', 'frames', 'designed-photos', 'gifts', 'packages'], cities: ['תל אביב-יפו', 'רמת גן'], regions: ['מרכז'], phone: '050-0000003', email: '', contact: '' },
  { name: 'פרחי הצפון (דוגמה)', categories: ['flowers', 'decor'], cities: ['חיפה'], regions: ['צפון'], phone: '050-0000004', email: '', contact: '' },
];

const COURIERS = [
  { name: 'שליח באר שבע (דוגמה)', phone: '052-0000001', cities: ['באר שבע', 'עומר', 'להבים'], regions: [], vehicle: 'אופנוע' },
  { name: 'שליחויות הדרום (דוגמה)', phone: '052-0000002', cities: [], regions: ['דרום'], vehicle: 'רכב' },
  { name: 'שליח תל אביב (דוגמה)', phone: '052-0000003', cities: ['תל אביב-יפו', 'רמת גן', 'גבעתיים'], regions: [], vehicle: 'אופנוע' },
];

const DEFAULT_SETTINGS = {
  businessName: 'רגעים - מזכרות לאירועים',
  // זמני SLA בשעות - מעבר להם המשלוח מסומן "תקוע"
  slaHours: { paid: 4, sent_to_supplier: 24, in_production: 48, ready: 12, picked_up: 6, out_for_delivery: 8 },
  shippingPrice: 30,
  freeShippingFrom: 300,
  paymentDashboardUrl: '',
};

export function seedIfEmpty() {
  const s = db.state;
  if (!s.cities.length) {
    for (const [region, names] of Object.entries(CITIES)) {
      for (const name of names) db.insert('cities', { id: db.id('c_'), name, region });
    }
  }
  if (!s.categories.length) CATEGORIES.forEach((c) => db.insert('categories', c));
  if (!s.products.length) PRODUCTS.forEach((x) => db.insert('products', x));
  if (!s.collections.length) COLLECTIONS.forEach((x) => db.insert('collections', x));
  if (!s.suppliers.length) SUPPLIERS.forEach((x) => db.insert('suppliers', { id: db.id('s_'), active: true, notes: '', ...x }));
  if (!s.couriers.length) COURIERS.forEach((x) => db.insert('couriers', { id: db.id('k_'), active: true, notes: '', ...x }));
  const missing = Object.fromEntries(Object.entries(DEFAULT_SETTINGS).filter(([k]) => s.settings[k] === undefined));
  if (Object.keys(missing).length) db.setSettings(missing);
}
