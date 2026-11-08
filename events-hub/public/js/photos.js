// תמונות אמיתיות לקטגוריות ולפתיח החנות.
// מקור: ספריית Unsplash (דרך חיפוש המדיה של Automo). רישיון Unsplash: שימוש חופשי, גם מסחרי, בלי צורך בקרדיט.
// כל תמונה אפשר להחליף בתמונה משלכם: אפליקציית הניהול ← מוצרים ← "תמונות קטגוריות".
/* exported PHOTOS */
const PHOTOS = (() => {
  const U = (id, w = 640, h = 480) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=70`;
  const byCategory = {
    magnets: 'photo-1684741940768-c40eca4ac4ab', // מקרר עם מגנטים ותמונות
    blocks: 'photo-1693165237076-7e41c1af596d', // תמונה על מעמד עץ
    frames: 'photo-1654567692470-c34ee25f9b5e', // מסגרת עם תמונת חתן וכלה
    'designed-photos': 'photo-1685643096239-9b517edf150f', // קיר תמונות מעוצב
    packages: 'photo-1674620213535-9b2a2553ef40', // קופסאות מתנה עם סרטי זהב
    gifts: 'photo-1513201099705-a9746e1e201f', // קופסת מתנה עם סרט ורוד
    sweets: 'photo-1769775264026-fbc4e974dea8', // מארז שוקולדים
    flowers: 'photo-1521520368710-3ab197656d60', // זר לבן-ורוד
    decor: 'photo-1560128411-79892dd93bf8', // סידור בלונים
  };
  let custom = {}; // תמונות שהמנהל העלה לקטגוריות (מהשרת)
  return {
    hero: U('photo-1640825573527-f41f4221a725', 1600, 1000), // מצלמת פולרואיד על ערימת תמונות מודפסות
    setCustom(categories) { custom = Object.fromEntries((categories || []).filter((c) => c.image).map((c) => [c.id, c.image])); },
    // כתובת התמונה לקטגוריה (תמונה של המנהל קודמת)
    url(cat, w = 640, h = 480) { return custom[cat] ? asset(custom[cat]) : U(byCategory[cat] || byCategory.packages, w, h); },
    img(cat, alt = '', w, h) { return `<img src="${esc(PHOTOS.url(cat, w, h))}" alt="${esc(alt)}" loading="lazy" decoding="async">`; },
    forPrint: (type) => ({ magnet: 'magnets', block: 'blocks', frame: 'frames' }[type] || 'magnets'),
  };
})();
