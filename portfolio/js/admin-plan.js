/* Business plan for the admin: text sections, a pricing/revenue model, a 12-month forecast with break-even, a marketing funnel,
   a risk list and a 90-day checklist. Saved in this browser at once and in the admin's private n8n store (plan-get / plan-set). */
(function () {
  'use strict';
  var A = window.HasadnaAuth;
  if (!A) return;
  var LS = 'spider-plan';
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return Math.round(n).toLocaleString('he-IL'); };
  var money = function (n) { return '₪' + fmt(n); };
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }

  var TEXT = [
    ['sum', 'תקציר מנהלים', 'מה העסק ולמי', 'SPIDER הוא עסק קטן ויעיל לבניית אוטומציות, סוכני AI, אתרים ומערכות ניהול לעסקים קטנים ובינוניים בישראל. אני בונה ומתחזק בעצמי, בעברית, עם הוכחות חיות (פורטפוליו של עשרות פרויקטים עובדים), ומוכר פתרון סופי במחיר ברור.\n\nהיעד לשנה הראשונה: בסיס של לקוחות תחזוקה חודשיים שמכסה את ההוצאות הקבועות, ופרויקטים חד־פעמיים שמביאים את הרווח.'],
    ['problem', 'הבעיה וההזדמנות', 'מה הכאב של הלקוח', 'בעלי עסקים קטנים מבזבזים שעות על משימות חוזרות (לידים, תזכורות, דוחות, הזמנות) ומשתמשים באקסלים מפוזרים. פתרונות מדף יקרים או באנגלית, ויועצים גדולים לא משתלמים לעסק קטן.\n\nההזדמנות: כלי AI ואוטומציה (n8n, מודלים בעברית) מורידים את עלות הבנייה, כך שאפשר למכור פתרון מותאם במחיר של תבנית.'],
    ['offer', 'הצעת הערך', 'למה אצלי ולא אצל אחר', '1. מהירות: פיילוט עובד בימים, לא בחודשים.\n2. עברית וליווי אישי: מדבר ישירות עם מי שבנה.\n3. הוכחה: אתרים ומערכות חיים שאפשר לפתוח ולראות.\n4. מחיר שקוף: מחיר פתיחה מפורסם ו"שיחת אפיון" בחינם.\n5. בעלות: הלקוח מקבל את הקוד והגישות, בלי נעילה.'],
    ['market', 'שוק יעד ולקוחות', 'מי הלקוח האידיאלי', 'סגמנטים עיקריים:\n• עסקי שירות קטנים (קליניקות, מאמנים, קבלנים, מוסכים) שצריכים לידים, תזכורות ותיאום תורים.\n• חנויות ועסקי מסחר קטנים שצריכים מלאי, הזמנות ודוחות.\n• משרדים קטנים (הנהלת חשבונות, ביטוח, נדל"ן) שצריכים אוטומציית מסמכים ו־CRM.\n\nלקוח אידיאלי: 1–20 עובדים, כבר משתמש בוואטסאפ ובאקסל, מוכן לשלם 1,500–6,000 ₪ לפתרון שחוסך לו שעות בשבוע.'],
    ['comp', 'תחרות', 'מי עוד בשוק ואיך מתבדלים', 'פרילנסרים באתרי ביניים (מחיר נמוך, איכות משתנה), סוכנויות דיגיטל (יקרות, איטיות), כלי No-code מדף (דורשים למידה), ויועצי אוטומציה (לרוב ללקוחות גדולים).\n\nהבידול: שילוב של אוטומציה + AI + אתר + תחזוקה אצל איש אחד, עם הוכחות חיות ומחיר שקוף.'],
    ['ops', 'תפעול וכלים', 'איך עובדים בפועל', 'תהליך: שיחת אפיון ← הצעת מחיר כתובה ← בנייה בשלבים עם אישור ← העלאה לאוויר ← הדרכה ← מעבר לתחזוקה חודשית.\n\nכלים: n8n Cloud (אוטומציות), GitHub Pages (אתרים), מודלי AI חינמיים/בתשלום לפי צורך, אתר SPIDER לניהול לידים, לקוחות וסטטיסטיקות.\n\nכל פרויקט מקבל סקיל לתיעוד ושימוש חוזר, כדי שכל פרויקט הבא יהיה מהיר יותר.'],
    ['risk', 'סיכונים ומענה', 'מה יכול להשתבש', '• תלות בלקוח או ערוץ אחד ← לפזר בין שירותים וערוצי שיווק.\n• עומס כשאדם אחד עושה הכול ← מגבילים מספר פרויקטים פעילים, שימוש חוזר בתבניות וסקילים.\n• שינוי תנאי כלים ו־API (עלויות, מכסות) ← להעדיף קוד פתוח, גיבויים, ולהעביר עלות ללקוח בתחזוקה.\n• גבייה ← מקדמה 40–50% לפני התחלה, שאר התשלום במסירה.\n• אבטחה ופרטיות ← סודות מחוץ לקוד, הרשאות מינימליות, הסכם סודיות ללקוחות.'],
    ['kpi', 'מדדי הצלחה', 'איך יודעים שמתקדמים', '• לידים חדשים בחודש (מטרה: 20)\n• שיעור סגירה מליד להצעה ומהצעה לעסקה\n• הכנסה חודשית חוזרת (תחזוקה) לעומת חד־פעמית\n• זמן ממוצע למסירה, ושביעות רצון (המלצות באתר)\n• ביקורים ופתיחות באתר (ראה מסך "שימוש באתר")'],
    ['funding', 'מימון והון', 'כמה צריך כדי להתחיל', 'העסק מתחיל בהשקעה נמוכה: עלויות כלים חודשיות, דומיין, ותקציב שיווק קטן. אין צורך בגיוס. מומלץ קרן חירום של 3 חודשי הוצאות לפני הגדלת תקציב שיווק.']
  ];
  var DEF = {
    t: {},
    svc: [
      { id: 'automation', title: 'אוטומציה עסקית ב־n8n', price: 1500, units: 1 },
      { id: 'ai-agent', title: 'סוכן AI לעסק', price: 2500, units: 0.5 },
      { id: 'website', title: 'אתר או דף נחיתה', price: 2500, units: 1 },
      { id: 'system', title: 'מערכת ניהול ייעודית', price: 6000, units: 0.25 },
      { id: 'devops', title: 'העלאה לענן ו־DevOps', price: 900, units: 1 }
    ],
    a: { care: 290, attach: 40, churn: 3, growth: 8, fixed: 700, ads: 600, varPct: 5, tax: 20, salary: 6000, ramp: 4 },
    ch: [
      { n: 'וואטסאפ והמלצות', budget: 0, leads: 6, conv: 25 },
      { n: 'פייסבוק/אינסטגרם', budget: 400, leads: 8, conv: 8 },
      { n: 'גוגל וקידום אתר (SEO)', budget: 200, leads: 4, conv: 12 },
      { n: 'קבוצות עסקים ולינקדאין', budget: 0, leads: 5, conv: 10 }
    ],
    todo: {}
  };
  var TODO = [
    'להגדיר חבילות ומחירים סופיים (3 חבילות: התחלה / צמיחה / מלא) ולהעלות לדף השירותים',
    'לאסוף 3 המלצות כתובות מלקוחות קיימים ולהציג באתר',
    'לבנות הודעת מכירה קצרה (וואטסאפ) ותבנית הצעת מחיר',
    'להפעיל מעקב לידים בלוח הניהול ולבדוק מדי שבוע את מסך "שימוש באתר"',
    'להריץ קמפיין קטן (עד 600 ₪) ולמדוד עלות ליד',
    'להציע תחזוקה חודשית לכל לקוח קיים',
    'להכין 2 תיקי עבודה מפורטים (לפני/אחרי, שעות שנחסכו)',
    'לסגור 3 עסקאות ראשונות ולתעד זמן עבודה אמיתי להתאמת מחיר',
    'לבדוק רווחיות לפי שירות ולהחליט במה להתמקד ברבעון הבא'
  ];

  var S = clone(DEF), saveT = 0, stamp = '';
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function merge(d) { var o = clone(DEF); if (d && typeof d === 'object') { ['t', 'a', 'todo'].forEach(function (k) { if (d[k]) o[k] = Object.assign(o[k], d[k]); }); if (d.svc) o.svc = d.svc; if (d.ch) o.ch = d.ch; } return o; }
  function loadLocal() { try { var j = JSON.parse(localStorage.getItem(LS) || 'null'); if (j) return j; } catch (e) {} return null; }
  function status(t) { $('p-status').textContent = t; }
  function save() {
    var blob = JSON.stringify(S);
    try { localStorage.setItem(LS, blob); } catch (e) {}
    status('נשמר בדפדפן…');
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      A.api('plan-set', { blob: blob }).then(function (r) { status(r && r.ok ? 'נשמר גם בכספת הפרטית שלך ב־n8n · ' + new Date().toLocaleTimeString('he-IL') : 'נשמר רק בדפדפן הזה (' + ((r && r.error) === 'not-ready' ? 'n8n עוד לא מעודכן' : 'אין חיבור') + ')'); }, function () { status('נשמר רק בדפדפן הזה'); });
    }, 1200);
  }

  // ------------------------------------------------------------ model
  function forecast() {
    var a = S.a, rows = [], care = 0, cum = 0, be = 0, g = 1 + a.growth / 100;
    for (var m = 1; m <= 12; m++) {
      var f = Math.pow(g, m - 1) * Math.min(1, m / Math.max(1, a.ramp)), deals = 0, proj = 0;
      S.svc.forEach(function (s) { deals += s.units * f; proj += s.price * s.units * f; });
      care = care * (1 - a.churn / 100) + deals * a.attach / 100;
      var rec = care * a.care, rev = proj + rec;
      var cost = a.fixed + a.ads + rev * a.varPct / 100 + a.salary;
      var pre = rev - cost, tax = pre > 0 ? pre * a.tax / 100 : 0, net = pre - tax;
      cum += net; if (!be && cum > 0) be = m;
      rows.push({ m: m, deals: deals, proj: proj, care: care, rec: rec, rev: rev, cost: cost, net: net, cum: cum });
    }
    return { rows: rows, be: be };
  }

  // ------------------------------------------------------------ view
  var PANES = [['sum', 'תקציר'], ['market', 'שוק ותחרות'], ['rev', 'שירותים והכנסות'], ['fc', 'תחזית 12 חודשים'], ['mk', 'שיווק ומכירות'], ['op', 'תפעול וסיכונים'], ['kp', 'מדדים ומימון'], ['rm', 'מפת דרכים 90 יום']];
  var cur = 'sum';
  function card(h, sub, kids) { return el('div', { class: 'p-card' }, [el('h3', { text: h }), el('p', { class: 'muted', text: sub || '' })].concat(kids)); }
  function text(k) {
    var d = TEXT.filter(function (x) { return x[0] === k; })[0];
    var ta = el('textarea', { 'aria-label': d[1] }); ta.value = S.t[k] != null ? S.t[k] : d[3];
    ta.addEventListener('input', function () { S.t[k] = ta.value; save(); });
    return card(d[1], d[2], [ta]);
  }
  function num(obj, key, label, step) {
    var i = el('input', { type: 'number', step: step || '1', value: obj[key], inputmode: 'decimal' });
    i.addEventListener('input', function () { obj[key] = parseFloat(i.value) || 0; save(); refresh(); });
    return el('label', {}, [label, i]);
  }
  function rev() {
    var tb = el('tbody'), tot = 0, units = 0;
    S.svc.forEach(function (s) {
      var pi = el('input', { type: 'number', value: s.price }), ui = el('input', { type: 'number', step: '0.5', value: s.units });
      var cell = el('td', { class: 'num', text: money(s.price * s.units) });
      pi.addEventListener('input', function () { s.price = parseFloat(pi.value) || 0; cell.textContent = money(s.price * s.units); save(); refresh(); });
      ui.addEventListener('input', function () { s.units = parseFloat(ui.value) || 0; cell.textContent = money(s.price * s.units); save(); refresh(); });
      tot += s.price * s.units; units += s.units;
      tb.appendChild(el('tr', {}, [el('td', { text: s.title }), el('td', {}, [pi]), el('td', {}, [ui]), cell]));
    });
    var care = S.a.care * units * S.a.attach / 100;
    var tbl = el('div', { class: 'p-scroll' }, [el('table', { class: 'p-tbl' }, [el('thead', {}, [el('tr', {}, [el('th', { text: 'שירות' }), el('th', { text: 'מחיר (₪)' }), el('th', { text: 'עסקאות בחודש' }), el('th', { text: 'הכנסה חודשית' })])]), tb,
      el('tfoot', {}, [el('tr', {}, [el('td', { text: 'סה״כ פרויקטים בחודש 1' }), el('td'), el('td', { text: String(Math.round(units * 10) / 10) }), el('td', { class: 'num', text: money(tot) })])])])]);
    var g = el('div', { class: 'p-grid' }, [num(S.a, 'care', 'מחיר תחזוקה חודשית (₪)'), num(S.a, 'attach', 'אחוז לקוחות שעוברים לתחזוקה'), num(S.a, 'churn', 'נטישת תחזוקה בחודש (%)', '0.5')]);
    return [card('שירותים ומחירים', 'המחירים נשלפים מדף השירותים; אפשר לשנות ולראות מיד את ההשפעה על התחזית. "עסקאות בחודש" = כמה עסקאות חדשות בממוצע.', [tbl]),
      card('תחזוקה חודשית (הכנסה חוזרת)', 'המפתח לעסק יציב: כל פרויקט שנמסר מוצע לו ליווי חודשי.', [g,
        el('p', { class: 'muted', text: 'בחודש 1: בערך ' + money(care) + ' הכנסה חוזרת חדשה מכל מחזור פרויקטים.' })])];
  }
  var fcBox;
  function fcView() {
    var a = S.a, g = el('div', { class: 'p-grid' }, [num(a, 'growth', 'גידול חודשי בעסקאות (%)', '0.5'), num(a, 'fixed', 'הוצאות קבועות בחודש (כלים, n8n, דומיין, ₪)'), num(a, 'ads', 'תקציב פרסום בחודש (₪)'), num(a, 'varPct', 'עלויות משתנות (% מהכנסה: עמלות, קבלני משנה)', '0.5'), num(a, 'salary', 'משיכת שכר חודשית (₪)'), num(a, 'tax', 'מס על הרווח (%)'), num(a, 'ramp', 'חודשים עד קצב מלא (התחלה הדרגתית)')]);
    fcBox = el('div');
    return [card('הנחות', 'שנה הנחות ותראה מיד את הטבלה והגרף. ברירת המחדל שמרנית.', [g]), card('תחזית', 'רווח אחרי שכר ומס, מצטבר, ונקודת איזון (חודש שבו הרווח המצטבר חיובי).', [fcBox])];
  }
  function drawFc() {
    if (!fcBox) return;
    var F = forecast(), max = Math.max.apply(null, F.rows.map(function (r) { return Math.max(r.rev, r.cost); }).concat([1]));
    var tb = el('tbody');
    F.rows.forEach(function (r) {
      tb.appendChild(el('tr', {}, [el('td', { text: 'חודש ' + r.m }), el('td', { class: 'num', text: money(r.proj) }), el('td', { class: 'num', text: money(r.rec) }), el('td', { class: 'num', text: money(r.rev) }), el('td', { class: 'num', text: money(r.cost) }), el('td', { class: 'num' + (r.net < 0 ? ' neg' : ''), text: money(r.net) }), el('td', { class: 'num' + (r.cum < 0 ? ' neg' : ''), text: money(r.cum) })]));
    });
    var T = F.rows.reduce(function (t, r) { t.rev += r.rev; t.net += r.net; t.cost += r.cost; return t; }, { rev: 0, net: 0, cost: 0 });
    var chart = el('div', { class: 'u-days', role: 'img', 'aria-label': 'הכנסות מול הוצאות' });
    F.rows.forEach(function (r) {
      var col = el('div', { class: 'col', tabindex: '0', title: 'חודש ' + r.m + ' · הכנסות ' + money(r.rev) + ' · הוצאות ' + money(r.cost) });
      col.appendChild(el('b', { class: 'pv', style: 'bottom:' + Math.round(r.cost / max * 100) + '%' }));
      col.appendChild(el('i', { style: 'height:' + Math.round(r.rev / max * 100) + '%' }));
      chart.appendChild(col);
    });
    var kp = el('dl', { class: 'kpis' });
    [['הכנסה שנתית', money(T.rev)], ['רווח נקי שנתי', money(T.net)], ['נקודת איזון', F.be ? 'חודש ' + F.be : 'לא בשנה הראשונה'], ['הכנסה חוזרת בחודש 12', money(F.rows[11].rec)], ['לקוחות תחזוקה בחודש 12', fmt(F.rows[11].care)]].forEach(function (k) {
      kp.appendChild(el('div', {}, [el('dt', { text: k[0] }), el('dd', { text: k[1] })]));
    });
    fcBox.innerHTML = '';
    fcBox.appendChild(kp);
    fcBox.appendChild(chart);
    fcBox.appendChild(el('p', { class: 'muted', text: 'העמודות הן הכנסות; הקו המקווקו הוא ההוצאות (כולל שכר).' }));
    fcBox.appendChild(el('div', { class: 'p-scroll' }, [el('table', { class: 'p-tbl' }, [el('thead', {}, [el('tr', {}, ['חודש', 'פרויקטים', 'תחזוקה', 'סה״כ הכנסות', 'הוצאות', 'רווח נקי', 'מצטבר'].map(function (h) { return el('th', { text: h }); }))]), tb])]));
  }
  var mkBox;
  function mk() {
    var tb = el('tbody');
    S.ch.forEach(function (c, i) {
      var cells = [el('td', {}, [inp(c, 'n', 'text')])];
      ['budget', 'leads', 'conv'].forEach(function (k) { cells.push(el('td', {}, [inp(c, k, 'number')])); });
      cells.push(el('td', { class: 'num', 'data-r': i }));
      var del = el('button', { type: 'button', class: 'g-btn ghost', text: '✕', 'aria-label': 'מחיקת ערוץ' });
      del.addEventListener('click', function () { S.ch.splice(i, 1); save(); show(); });
      cells.push(el('td', {}, [del]));
      tb.appendChild(el('tr', {}, cells));
    });
    var add = el('button', { type: 'button', class: 'g-btn ghost', text: '+ ערוץ' });
    add.addEventListener('click', function () { S.ch.push({ n: 'ערוץ חדש', budget: 0, leads: 0, conv: 10 }); save(); show(); });
    mkBox = el('p', { class: 'muted' });
    var t = el('div', { class: 'p-scroll' }, [el('table', { class: 'p-tbl' }, [el('thead', {}, [el('tr', {}, ['ערוץ', 'תקציב חודשי (₪)', 'לידים בחודש', 'סגירה (%)', 'עלות ללקוח (₪)', ''].map(function (h) { return el('th', { text: h }); }))]), tb])]);
    return [card('משפך שיווק', 'מכמה ערוצים מגיעים לידים, כמה נסגרים, וכמה עולה לקוח חדש בכל ערוץ.', [t, add, mkBox]),
      card('תסריט מכירה קצר', 'שיחת אפיון ← הצעה ← סגירה', [textareaFor('script', 'שיחת אפיון של 15 דקות: מה הכאב, כמה שעות הוא עולה בשבוע, מה מצב הכלים הקיימים. ביום המחרת הצעה כתובה עם מחיר ולוח זמנים. מעקב בוואטסאפ אחרי 48 שעות. מקדמה 40% והתחלה.')])];
  }
  function inp(o, k, type) {
    var i = el('input', { type: type, value: o[k] });
    i.addEventListener('input', function () { o[k] = type === 'number' ? parseFloat(i.value) || 0 : i.value; save(); refresh(); });
    return i;
  }
  function textareaFor(k, def) {
    var ta = el('textarea'); ta.value = S.t[k] != null ? S.t[k] : def;
    ta.addEventListener('input', function () { S.t[k] = ta.value; save(); });
    return ta;
  }
  function drawMk() {
    var rows = document.querySelectorAll('[data-r]'), leads = 0, won = 0, spend = 0;
    S.ch.forEach(function (c, i) {
      var w = c.leads * c.conv / 100; leads += c.leads; won += w; spend += c.budget;
      if (rows[i]) rows[i].textContent = w > 0 ? money(c.budget / w) : '—';
    });
    if (mkBox) mkBox.textContent = 'בסך הכול: ' + fmt(leads) + ' לידים בחודש, כ־' + (Math.round(won * 10) / 10) + ' לקוחות, תקציב ' + money(spend) + (won ? ', עלות ממוצעת ללקוח ' + money(spend / won) : '') + '.';
  }
  function rm() {
    var ul = el('ul', { class: 'p-todo' }), done = 0;
    TODO.forEach(function (t, i) {
      var cb = el('input', { type: 'checkbox' }); cb.checked = !!S.todo[i]; if (cb.checked) done++;
      cb.addEventListener('change', function () { S.todo[i] = cb.checked; save(); var n = Object.keys(S.todo).filter(function (k) { return S.todo[k]; }).length; prog.textContent = n + ' מתוך ' + TODO.length + ' הושלמו'; });
      ul.appendChild(el('li', {}, [el('label', {}, [cb, el('span', { text: t })])]));
    });
    var prog = el('p', { class: 'muted', text: done + ' מתוך ' + TODO.length + ' הושלמו' });
    return [card('90 הימים הקרובים', 'סמן מה בוצע. השאר רשימה קצרה: כל משימה צריכה לקדם לקוח, הכנסה או הוכחה.', [prog, ul])];
  }

  function refresh() { drawFc(); drawMk(); }
  function show() {
    var b = $('p-body'); b.innerHTML = '';
    var map = {
      sum: function () { return [text('sum'), text('problem'), text('offer')]; },
      market: function () { return [text('market'), text('comp')]; },
      rev: rev, fc: fcView, mk: mk,
      op: function () { return [text('ops'), text('risk')]; },
      kp: function () { return [text('kpi'), text('funding')]; },
      rm: rm
    };
    map[cur]().forEach(function (c) { b.appendChild(c); });
    Array.prototype.forEach.call($('p-tabs').children, function (x) { x.setAttribute('aria-selected', String(x.getAttribute('data-t') === cur)); });
    refresh();
  }

  function markdown() {
    var o = ['# תכנית עסקית · SPIDER', '', 'עודכן: ' + new Date().toLocaleDateString('he-IL'), ''];
    TEXT.forEach(function (d) { o.push('## ' + d[1], '', S.t[d[0]] != null ? S.t[d[0]] : d[3], ''); });
    o.push('## שירותים והכנסות', '', '| שירות | מחיר | עסקאות בחודש |', '|---|---|---|');
    S.svc.forEach(function (s) { o.push('| ' + s.title + ' | ' + s.price + ' ₪ | ' + s.units + ' |'); });
    var F = forecast();
    o.push('', '## תחזית 12 חודשים', '', '| חודש | הכנסות | הוצאות | רווח נקי | מצטבר |', '|---|---|---|---|---|');
    F.rows.forEach(function (r) { o.push('| ' + r.m + ' | ' + fmt(r.rev) + ' | ' + fmt(r.cost) + ' | ' + fmt(r.net) + ' | ' + fmt(r.cum) + ' |'); });
    o.push('', F.be ? 'נקודת איזון: חודש ' + F.be : 'אין נקודת איזון בשנה הראשונה בהנחות הנוכחיות', '', '## משפך שיווק', '');
    S.ch.forEach(function (c) { o.push('- ' + c.n + ': תקציב ' + c.budget + ' ₪, ' + c.leads + ' לידים, סגירה ' + c.conv + '%'); });
    o.push('', '## מפת דרכים 90 יום', '');
    TODO.forEach(function (t, i) { o.push('- [' + (S.todo[i] ? 'x' : ' ') + '] ' + t); });
    return o.join('\n');
  }
  function download() {
    var a = el('a', { href: URL.createObjectURL(new Blob([markdown()], { type: 'text/markdown;charset=utf-8' })), download: 'spider-business-plan.md' });
    document.body.appendChild(a); a.click(); a.remove();
  }

  A.ready.then(function (s) {
    if (s.role !== 'admin') return;
    var tabs = $('p-tabs');
    PANES.forEach(function (p) {
      var b = el('button', { type: 'button', role: 'tab', 'data-t': p[0], text: p[1] });
      b.addEventListener('click', function () { cur = p[0]; show(); });
      tabs.appendChild(b);
    });
    S = merge(loadLocal());
    show(); status('טוען מהכספת…');
    A.api('plan-get').then(function (r) {
      if (r && r.ok && r.blob) { try { var d = JSON.parse(r.blob); S = merge(d); try { localStorage.setItem(LS, r.blob); } catch (e) {} show(); status('נטען מהכספת הפרטית · ' + (r.at ? new Date(r.at).toLocaleString('he-IL') : '')); return; } catch (e) {} }
      status(r && r.ok ? 'תכנית חדשה: כל שינוי נשמר אוטומטית' : 'עובד מהדפדפן בלבד (n8n עוד לא מעודכן)');
    }, function () { status('עובד מהדפדפן בלבד'); });
    $('p-md').addEventListener('click', download);
    $('p-print').addEventListener('click', function () { window.print(); });
    $('p-reset').addEventListener('click', function () { if (confirm('לחזור לטקסטים ולהנחות המקוריים? השינויים שלך יימחקו.')) { S = clone(DEF); save(); show(); } });
  });
})();
