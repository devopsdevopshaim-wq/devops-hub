/* The friendly front door. For a client or a visitor it adds a greeting, one big search, the things people come for (big cards in plain words),
   subjects, and help one tap away; it also gives everyone an accessibility panel. The admin keeps the working view (?view=client previews this one). */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'style') e.style.cssText = attrs[k]; else e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  var root = document.documentElement;

  // ---- accessibility: kept in this browser
  var KEY = 'spider-a11y', A11Y = (function () { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } })();
  function applyA11y() {
    root.classList.toggle('a11y-big', A11Y.size === 1); root.classList.toggle('a11y-bigger', A11Y.size === 2);
    root.classList.toggle('a11y-contrast', !!A11Y.contrast); root.classList.toggle('a11y-links', !!A11Y.links); root.classList.toggle('a11y-calm', !!A11Y.calm);
    try { localStorage.setItem(KEY, JSON.stringify(A11Y)); } catch (e) {}
  }
  function a11yPanel() {
    var fab = el('button', { type: 'button', class: 'a11y-fab', 'aria-label': 'נגישות', 'aria-expanded': 'false', title: 'נגישות', text: '♿' });
    var panel = el('div', { class: 'a11y-panel', role: 'dialog', 'aria-label': 'הגדרות נגישות', hidden: '' });
    panel.appendChild(el('h3', { text: 'נגישות והתאמה' }));
    var rowSize = el('div', { class: 'row' });
    [['A', 0, 'טקסט רגיל'], ['A+', 1, 'טקסט גדול'], ['A++', 2, 'טקסט גדול מאוד']].forEach(function (s) {
      var b = el('button', { type: 'button', 'aria-label': s[2], text: s[0], 'aria-pressed': String((A11Y.size || 0) === s[1]) });
      b.addEventListener('click', function () { A11Y.size = s[1]; applyA11y(); Array.prototype.forEach.call(rowSize.children, function (x, i) { x.setAttribute('aria-pressed', String(i === s[1])); }); });
      rowSize.appendChild(b);
    });
    panel.appendChild(rowSize);
    [['contrast', 'ניגודיות גבוהה'], ['links', 'קו תחתון לקישורים'], ['calm', 'בלי אנימציות']].forEach(function (o) {
      var b = el('button', { type: 'button', text: o[1], 'aria-pressed': String(!!A11Y[o[0]]) });
      b.addEventListener('click', function () { A11Y[o[0]] = !A11Y[o[0]]; b.setAttribute('aria-pressed', String(!!A11Y[o[0]])); applyA11y(); });
      panel.appendChild(b);
    });
    var reset = el('button', { type: 'button', text: 'איפוס' });
    reset.addEventListener('click', function () { A11Y = {}; applyA11y(); panel.querySelectorAll('button[aria-pressed]').forEach(function (x, i) { x.setAttribute('aria-pressed', String(i === 0)); }); });
    panel.appendChild(reset);
    fab.addEventListener('click', function () { var open = panel.hidden; panel.hidden = !open; fab.setAttribute('aria-expanded', String(open)); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { panel.hidden = true; fab.setAttribute('aria-expanded', 'false'); fab.focus(); } });
    document.body.appendChild(fab); document.body.appendChild(panel);
  }
  applyA11y();
  a11yPanel();

  // ---- the front door
  var QUICK = [
    { id: 'bills-hub', t: 'תשלומים לבית', d: 'ארנונה, חשמל, מים וכל החשבונות במקום אחד', i: '🏠', c: '#5fd39a' },
    { id: 'finance-hub', t: 'הכסף שלי', d: 'לבדוק מצב, לקבל תוכנית ולהבין את השוק', i: '🧭', c: '#e0b25a' },
    { id: 'wellness-hub', t: 'בריאות וכושר', d: 'תוכנית אישית ואימון קצר כל יום', i: '💪', c: '#62dcb8' },
    { id: 'torah-hub', t: 'ספריית קודש', d: 'תנ״ך, הלכות חגים וסידור', i: '📖', c: '#f0c27a' },
    { id: 'hebrew-calendar', t: 'לוח שנה עברי', d: 'תאריכים, חגים וזמנים', i: '📅', c: '#8b7bff' },
    { id: 'vacation-hub', t: 'תכנון חופשה', d: 'לבחור יעד ולתכנן טיול', i: '🌴', c: '#6cb6ff' },
    { id: 'marketing-hub', t: 'שיווק לעסק', d: 'פוסטים, מודעות וקמפיין מוכנים', i: '📣', c: '#ff8fa3' },
    { id: 'comic-studio', t: 'קומיקס מהתמונות שלי', d: 'הופכים צילומים לעמוד קומיקס', i: '🎨', c: '#c9a7ff' }
  ];
  var SUBJECTS = { home: ['🏠', 'הבית והכסף'], tools: ['🧰', 'כלים שימושיים'], study: ['📚', 'לימוד ותוכן'], web: ['🌐', 'אתרים ואפליקציות'], ai: ['✨', 'עוזרים חכמים'], data: ['🗂', 'ארגון וניהול'], other: ['🎞', 'מצגות ויצירה'] };

  function greeting() { var h = new Date().getHours(); return h < 5 ? 'לילה טוב' : h < 12 ? 'בוקר טוב' : h < 18 ? 'צהריים טובים' : 'ערב טוב'; }
  var preview = /[?&]view=client\b/.test(location.search);

  Promise.all([fetch('projects.json').then(function (r) { return r.json(); }), window.HasadnaAuth ? window.HasadnaAuth.ready : Promise.resolve({ role: 'visitor' })]).then(function (res) {
    var data = res[0], who = res[1] || {};
    if (who.role === 'admin' && !who.open && !preview) return;   // the admin keeps the working view
    var hide = {}; (data.clientHide || []).forEach(function (id) { hide[id] = true; });
    var mine = {}; (who.sites || []).forEach(function (id) { mine[id] = true; });
    var list = data.projects.filter(function (p) { return !hide[p.id] && !p.hidden && !p.pending && (who.role !== 'client' || mine['*'] || mine[p.id]); });
    var byId = {}; list.forEach(function (p) { byId[p.id] = p; });
    var quick = QUICK.filter(function (q) { return byId[q.id]; }).slice(0, 8);
    if (quick.length < 4) list.filter(function (p) { return p.featured && !quick.some(function (q) { return q.id === p.id; }); }).slice(0, 8 - quick.length).forEach(function (p) { quick.push({ id: p.id, t: p.title.replace(/\s[—-].*$/, ''), d: (p.desc || '').slice(0, 70), i: p.icon || '✦', c: '#8b7bff' }); });

    root.classList.add('friendly');
    var name = who.name ? who.name.split(/\s+/)[0] : '';
    var sec = el('section', { class: 'wl', id: 'welcome', 'aria-label': 'ברוכים הבאים' });
    var wrap = el('div', { class: 'wrap' });
    var hero = el('div', { class: 'wl-hero' }, [
      el('p', { class: 'wl-hello', text: greeting() + (name ? ', ' + name : '') + ' 👋' }),
      el('h1', {}, ['מה תרצו ', el('em', { text: 'לעשות היום' }), '?']),
      el('p', { class: 'wl-lead', text: 'כל הכלים במקום אחד, בלי להתעמק בטכנולוגיה. בחרו משהו מהרשימה, או כתבו מה אתם מחפשים.' })
    ]);
    var form = el('form', { class: 'wl-search', role: 'search' });
    var input = el('input', { type: 'search', id: 'wl-q', placeholder: 'למשל: תשלומים, כושר, חופשה, חגים…', 'aria-label': 'מה אתם מחפשים', autocomplete: 'off' });
    form.appendChild(input); form.appendChild(el('button', { type: 'submit', class: 'wl-btn', text: 'חיפוש' }));
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = $('#q'); if (q) { q.value = input.value; q.dispatchEvent(new Event('input', { bubbles: true })); }
      var all = $('#all'); if (all) all.scrollIntoView({ behavior: 'smooth' });
    });
    hero.appendChild(form);
    wrap.appendChild(hero);

    var s1 = el('div', { class: 'wl-sec' }, [el('h2', { text: 'מה מחפשים בדרך כלל' }), el('p', { text: 'לחיצה אחת ואתם בפנים.' })]);
    var cards = el('div', { class: 'wl-cards' });
    quick.forEach(function (q) {
      var p = byId[q.id];
      var a = el('a', { class: 'wl-card', href: p ? p.url : '#', target: '_blank', rel: 'noopener', style: '--c:' + q.c }, [
        el('span', { class: 'wl-ico', 'aria-hidden': 'true', text: q.i }),
        el('span', {}, [el('b', { text: q.t }), el('span', { class: 't', text: q.d })])
      ]);
      a.addEventListener('click', function () { if (window.SpiderTrack) window.SpiderTrack.open(q.id); });
      cards.appendChild(a);
    });
    s1.appendChild(cards); wrap.appendChild(s1);

    var counts = {}; list.forEach(function (p) { counts[p.category] = (counts[p.category] || 0) + 1; });
    var keys = Object.keys(SUBJECTS).filter(function (k) { return counts[k]; });
    if (keys.length > 1) {
      var s2 = el('div', { class: 'wl-sec' }, [el('h2', { text: 'או לפי נושא' })]);
      var chips = el('div', { class: 'wl-chips' });
      keys.forEach(function (k) {
        var b = el('button', { type: 'button', class: 'wl-chip' }, [SUBJECTS[k][0] + ' ' + SUBJECTS[k][1] + ' ', el('small', { text: '(' + counts[k] + ')' })]);
        b.addEventListener('click', function () {
          var sel = $('#f-cat'); if (sel) { sel.value = k; sel.dispatchEvent(new Event('change', { bubbles: true })); }
          var all = $('#all'); if (all) all.scrollIntoView({ behavior: 'smooth' });
        });
        chips.appendChild(b);
      });
      s2.appendChild(chips); wrap.appendChild(s2);
    }

    var help = el('div', { class: 'wl-sec wl-help' }, [
      el('div', {}, [el('h2', { text: 'צריכים עזרה?' }), el('p', { text: 'אפשר לשאול אותנו כל דבר, גם אם זה נראה קטן. עונים בעברית ובשפה פשוטה.' })]),
      el('div', { class: 'row' }, [
        el('a', { class: 'wl-btn', href: 'https://wa.me/972544979771?text=' + encodeURIComponent('שלום, אשמח לעזרה באתר SPIDER'), target: '_blank', rel: 'noopener', text: 'וואטסאפ' }),
        el('a', { class: 'wl-btn ghost', href: 'tel:0544979771', text: '054-497-9771' })
      ])
    ]);
    wrap.appendChild(help);
    sec.appendChild(wrap);
    var main = $('main#top') || document.body;
    main.insertBefore(sec, main.firstChild);

    // plain words on the rest of the page
    [['#featured', 'מומלצים'], ['#fields', 'נושאים'], ['#all', 'הכול']].forEach(function (x) { var a = $('.nav .links a[href="' + x[0] + '"]'); if (a) a.textContent = x[1]; });
    var fe = $('#featured .eyebrow'); if (fe) fe.textContent = 'מומלצים';
    var fh = $('#featured h2'); if (fh) fh.textContent = 'כדאי להתחיל מכאן';
    var al = $('#all-eyebrow'); if (al) al.textContent = 'הכול';
  });
})();
