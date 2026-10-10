/* The luxury layer, part 2: the hero, and a gentle reveal as the page scrolls. Needs css/premium.css and img/hero.svg. */
(function () {
  'use strict';
  var HUBS = {
    'finance-hub': { kicker: 'Private Wealth Compass', title: 'מצפן פיננסי', sub: 'ממלאים כמה מספרים ומקבלים תמונת מצב ברורה, תוכנית התנהלות מסודרת ומבט על השוק. מידע וחינוך, בלי ייעוץ מכור.', pills: ['תוכנית אישית', 'מדדים מדויקים', 'נתוני שוק', 'הנתונים נשארים אצלך'], cta: ['להתחיל עכשיו', '.fin-wrap .fin-cols, .fin-panel'] },
    'marketing-hub': { kicker: 'Campaign Atelier', title: 'פרסום ושיווק', sub: 'מבריף קצר לקמפיין שלם: כותרות, טקסטים לכל פלטפורמה, קריאות לפעולה, האשטגים ובריף חזותי, מוכן להעתקה.', pills: ['פייסבוק ואינסטגרם', 'וואטסאפ ומייל', 'מודעות גוגל', 'פלייר להדפסה'], cta: ['לבנות קמפיין', '#mk-form'] },
    'aia-studio': { kicker: 'AIA · Production Studio', title: 'עיצוב AIA', sub: 'מרעיון לחבילת הפקה: קונספט, פרומפטים לתמונה, סטוריבורד שוט אחר שוט ופרומפטים לכלי וידאו.', pills: ['קונספט', 'סטוריבורד', 'פרומפטים לוידאו', 'תמונות ייחוס'], cta: ['להתחיל בריף', '.aia-brief'] },
    'wellness-hub': { kicker: 'Wellness Compass', title: 'מצפן בריאות', sub: 'מה שכל ההנחיות המקצועיות מסכימות עליו, מותאם לנתונים שלך: תזונה, פעילות, עיכול ושינה. בלי אבחנות ובלי הבטחות.', pills: ['סינון דגלים אדומים', 'תוכנית ל־4 שבועות', 'כושר יומי', 'פרטיות'], cta: ['לבדיקה אישית', '#intake, .hc-step'] },
    'torah-hub': { kicker: 'Sacred Library', title: 'ספריית קודש', sub: 'תנ״ך, סידור וחגים, רש״י ורמב״ם ואור החיים, ותלמוד בבלי, לצד הלכות חגים ואוצר קבצים לכל מועד.', pills: ['תנ״ך', 'סידור', 'רמב״ם', 'תלמוד בבלי'], cta: ['לפתוח את הספרייה', '.tr-tabbar, .shell'] }
  };
  var PAGES = {
    'fitness.html': { kicker: 'Daily Training', title: 'כושר יומי', sub: 'תרגול קצר כל יום, בעיקר במשקל הגוף וציוד קל: אימון היום, מחזור שבועי וספריית תרגילים עם הסברים.', pills: ['אימון של היום', 'מחזור שבועי', 'ספריית תרגילים'], cta: ['לאימון של היום', '.ft-today, .ft-section'] },
    'holidays.html': { kicker: 'Moadim', title: 'הלכות חגים', sub: 'מנהגים, הלכות, ברכות ופירושים לכל חג, עם תאריכים וזמני כניסה ויציאה לפי המיקום.', pills: ['תאריכים מדויקים', 'זמני כניסה ויציאה', 'ברכות והלכות'], cta: ['לבחור חג', '.hol-grid'] },
    'library.html': { kicker: 'Treasury', title: 'אוצר לחג', sub: 'הגדות, ברכות וקבצים לכל מועד: מופיעים אוטומטית לפי התאריך, עם ספירה לאחור.', pills: ['הגדה', 'מגילה', 'תהילים', 'ברכות'], cta: ['לצפות באוצר', '.lib-wrap'] }
  };
  var hub = document.body.getAttribute('data-hub') || '';
  var file = (location.pathname.split('/').pop() || 'index.html');
  var c = Object.assign({}, HUBS[hub] || {}, PAGES[file] || {});
  if (!c.title) return;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (x) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x]; }); }
  var hero = document.createElement('section');
  hero.className = 'lux-hero';
  hero.setAttribute('aria-label', c.title);
  hero.innerHTML =
    '<div class="lux-text">' +
      '<span class="lux-kicker">' + esc(c.kicker) + '</span>' +
      '<h1>' + esc(c.title) + '</h1>' +
      '<p class="lux-sub">' + esc(c.sub) + '</p>' +
      '<div class="lux-pills">' + (c.pills || []).map(function (p) { return '<span>' + esc(p) + '</span>'; }).join('') + '</div>' +
      (c.cta ? '<a class="lux-cta" href="#lux-start">' + esc(c.cta[0]) + ' <span aria-hidden="true">←</span></a>' : '') +
    '</div>' +
    '<div class="lux-art"><img src="img/hero.svg" alt="" decoding="async"></div>';
  var bar = document.querySelector('.standalone-bar');
  (bar && bar.parentNode ? bar.parentNode : document.body).insertBefore(hero, bar ? bar.nextSibling : document.body.firstChild);

  var cta = hero.querySelector('.lux-cta');
  if (cta) cta.addEventListener('click', function (e) {
    e.preventDefault();
    var t = document.querySelector(c.cta[1]);
    if (t) t.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  });

  // a gentle reveal as sections come into view
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: .08 });
    document.querySelectorAll('.fin-panel, .fin-disclaimer, .hc-step, .hc-hero, .aia-brief, .aia-note, .mk-form, .ft-section, .hol-toolbar, .lib-note, .tr-tabbar').forEach(function (n) { n.classList.add('lux-reveal'); io.observe(n); });
  }
})();
