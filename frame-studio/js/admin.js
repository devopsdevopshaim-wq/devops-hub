/* The owner's admin: one place for the whole business. Sign-in is the owner's email and password on the sites' secure server
   (the initial password arrives by email; an authenticator code when it is set up), and everything lives on that server, not
   in this browser: the site's content (details, texts, packages, FAQ, reviews, busy dates, event types, customer frames),
   deals and payments, expenses, monthly and yearly reports to print, the payment and bank details, and every customer's
   saved designs. Only a draft of the site's content is kept here until it is published. AI writes alternatives for any text. */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$, ACC = FS.account;
  var DRAFT = 'fs-admin-draft';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  FS.busy = FS.busy || function (msg) { var b = $('#busy'); if (msg) { $('#busy-msg').textContent = msg; b.hidden = false; } else b.hidden = true; };
  var base = null, draft = null, dirty = {}, sec = 'home', TEXTS = [], FRAMES = [], DEALS = [], EXPENSES = [], SETTINGS = {}, CUSTOMERS = [], REQUESTS = [], ACCOUNTS = [], VISITORS = [], WAREADY = null, STUDIOS = [], CALKEY = '', SENT = [], SUPS = [], BACKUPAT = 0, DOCS = [], NSTATE = {}, onRefresh = null;

  /* ---------- sign-in (the sites' server: email + password, PBKDF2, lock-outs, device checks, authenticator) ---------- */
  /* two ways in: customers (name + phone or email, no password) see the customer screen; the owner signs in as admin */
  function whoTab(t) {
    $$('[data-who]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.who === t)); });
    $('#login-client').hidden = t !== 'client'; $('#login-admin').hidden = t !== 'admin';
  }
  $$('[data-who]').forEach(function (b) { b.addEventListener('click', function () { whoTab(b.dataset.who); }); });
  function showLogin(note, tab) {
    document.body.classList.remove('adm-client-mode');
    $('#login').hidden = false; $('#app').hidden = true; $('.dz-nav').hidden = true;
    whoTab(tab || (note || /[?&]admin\b/.test(location.search) ? 'admin' : 'client'));
    ACC.form($('#acc-box'), { adminOnly: true, note: note, done: start, noFocus: true });
    ACC.enterForm($('#enter-box'), { done: clientMode, noFocus: true });
  }
  function clientMode(v) {
    document.body.classList.add('adm-client-mode');
    $('#login').hidden = true; $('#app').hidden = true; $('.dz-nav').hidden = false;
    $('#who').textContent = 'שלום ' + ((v && v.name) || (ACC.session() || {}).name || '');
    var sm = document.querySelector('.dz-brand small'); if (sm) sm.textContent = 'אזור לקוחות';
    if (FS.showClientView) FS.showClientView();
  }
  function signIn() {
    if (!ACC.isAdmin()) { var v = ACC.visitor(); return v ? clientMode(v) : showLogin(); }
    FS.busy('מתחבר…');
    ACC.me().then(function (r) { FS.busy(); if (r.ok && r.role === 'admin' && !r.mustChange) start(); else showLogin(r.ok ? '' : ACC.msg(r), 'admin'); });
  }
  function start() {
    FS.busy('טוען את נתוני העסק…');
    Promise.all([ACC.call('all'), FS.siteData(), fetch('index.html', { cache: 'no-cache' }).then(function (r) { return r.text(); }).catch(function () { return ''; })]).then(function (r) {
      FS.busy();
      var all = r[0];
      if (!all || !all.ok) { if (all && (all.error === 'signed-out' || all.error === 'admin-only')) return showLogin(ACC.msg(all)); FS.toast(ACC.msg(all), 6000); return; }
      var fromFile = r[1] || {}; delete fromFile.__frames; delete fromFile.__live; delete fromFile.__taken;
      base = all.site || fromFile; FRAMES = all.frames || []; DEALS = all.deals || []; EXPENSES = all.expenses || []; SETTINGS = all.settings || {}; CUSTOMERS = all.customers || [];
      REQUESTS = all.requests || []; WAREADY = 'waReady' in all ? !!all.waReady : WAREADY; STUDIOS = all.studios || []; ACCOUNTS = all.accounts || []; VISITORS = all.visitors || []; CALKEY = all.calKey || ''; SENT = all.sentReports || []; SUPS = all.suppliers || []; BACKUPAT = all.backupAt || 0; DOCS = all.docs || []; NSTATE = all.notifyState || {};
      readTexts(r[2]);
      var saved = null; try { saved = JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch (e) { /* ignore */ }
      draft = clone(base); dirty = {};
      /* what was saved here and not yet published comes back by itself */
      if (saved && saved.dirty) Object.keys(saved.dirty).forEach(function (k) { if (saved.draft && k in saved.draft) { draft[k] = saved.draft[k]; dirty[k] = 1; } });
      savedAt = saved && saved.at || 0;
      /* the packages are one draft shared with the studio (💰 חבילות): both save it in frame-studio-packages, so the latest save wins */
      var pk = studioPackages();
      if (pk && JSON.stringify(pk) !== JSON.stringify(draft.packages || [])) {
        if (JSON.stringify(pk) === JSON.stringify(base.packages || [])) { draft.packages = pk; delete dirty.packages; } else { draft.packages = pk; dirty.packages = 1; }
      }
      if (!all.site) { Object.keys(draft).forEach(function (k) { dirty[k] = 1; }); }   // first time: what the site shows today becomes the server's copy at the first publish
      if (Object.keys(dirty).length && all.site) setTimeout(function () { FS.toast('💾 השינויים השמורים שלא פורסמו נטענו (' + Object.keys(dirty).map(label).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ') + ')', 6000); }, 400);
      $('#login').hidden = true; $('#app').hidden = false; $('.dz-nav').hidden = false; $$('[data-biz]').forEach(function (e) { if (draft[e.dataset.biz]) e.textContent = draft[e.dataset.biz]; });
      $('#who').textContent = (ACC.session() || {}).email || '';
      var h = location.hash.slice(1); if (VIEWS[h]) sec = h;
      nav(); show(sec); state(); badge(); poll();
    });
  }
  /* new booking requests show up by themselves while the admin is open */
  var pollT = null;
  function refresh() {
    return ACC.call('all').then(function (a) {
      if (!a || !a.ok) return;
      var before = REQUESTS.filter(function (r) { return r.status === 'pending'; }).map(function (r) { return r.id; });
      DEALS = a.deals || DEALS; EXPENSES = a.expenses || EXPENSES; SETTINGS = a.settings || SETTINGS; CUSTOMERS = a.customers || CUSTOMERS; REQUESTS = a.requests || REQUESTS; ACCOUNTS = a.accounts || ACCOUNTS; if ('waReady' in a) WAREADY = !!a.waReady; STUDIOS = a.studios || STUDIOS; VISITORS = a.visitors || VISITORS; CALKEY = a.calKey || CALKEY; SENT = a.sentReports || SENT; SUPS = a.suppliers || SUPS; BACKUPAT = a.backupAt || BACKUPAT; DOCS = a.docs || DOCS; NSTATE = a.notifyState || NSTATE;
      var fresh = REQUESTS.filter(function (r) { return r.status === 'pending' && before.indexOf(r.id) < 0; });
      if (fresh.length) FS.toast('📥 בקשת הזמנה חדשה: ' + fresh.map(function (r) { return r.name + ' · ' + r.date; }).join(', '), 7000);
      badge(); if (onRefresh) onRefresh();
    });
  }
  function poll() { clearInterval(pollT); pollT = setInterval(function () { if (!document.hidden && ACC.isAdmin()) refresh(); }, 90000); }
  function badge() {
    var n = REQUESTS.filter(function (r) { return r.status === 'pending'; }).length, b = $('#side [data-s=requests] i');
    if (b) b.setAttribute('data-n', n || ''); APP.badge(n); document.title = (n ? '(' + n + ') ' : '') + 'ניהול · ' + (draft && draft.name || 'פריים מגנטים');
  }
  window.addEventListener('hashchange', function () { var h = location.hash.slice(1); if (VIEWS[h] && h !== sec && draft) show(h); });
  $('#logout-top').addEventListener('click', function () { ACC.logout(); ACC.setVisitor(null); location.reload(); });

  /* ---------- draft ---------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var LABELS = { name: 'פרטי העסק', texts: 'טקסטים', packages: 'חבילות', extras: 'תוספות', packagesNote: 'הערת חבילות', faq: 'שאלות', reviews: 'המלצות', googleReviews: 'קישור לגוגל', busy: 'תאריכים תפוסים', events: 'סוגי אירועים', hideFrames: 'מסגרות ללקוחות' };
  function label(k) { return LABELS[k] || 'פרטי העסק'; }
  /* every change is saved in this browser at once, and the studio's packages editor sees the same packages */
  var PKEY = 'frame-studio-packages', savedAt = 0;
  function studioPackages() { try { var l = JSON.parse(localStorage.getItem(PKEY) || 'null'); return Array.isArray(l) && l.length ? l : null; } catch (e) { return null; } }
  function persist() {
    savedAt = Date.now();
    try {
      localStorage.setItem(DRAFT, JSON.stringify({ draft: draft, dirty: dirty, at: savedAt }));
      if (dirty.packages) localStorage.setItem(PKEY, JSON.stringify(draft.packages || []));
    } catch (e) { FS.toast('השמירה בדפדפן לא הצליחה (אולי מצב גלישה פרטית)'); }
  }
  function touch(k) { dirty[k] = 1; persist(); state(); pushPreview(); if (/^(packages|extras|packagesNote)$/.test(k)) livePrices(); }
  /* 💰 prices are live: the packages (and their extras and note) are published by themselves 1.5 s after the last change,
     on top of what is already on the site, so other unpublished edits stay a draft */
  var priceT = 0;
  function livePrices() {
    clearTimeout(priceT);
    priceT = setTimeout(function () {
      var s = clone(base), K = ['packages', 'extras', 'packagesNote']; K.forEach(function (k) { if (k in draft) s[k] = clone(draft[k]); });
      ACC.call('site-save', { site: s }).then(function (r) {
        if (!r || !r.ok) { if (r && r.error === 'signed-out') return; return FS.toast('המחיר לא עודכן באתר: ' + ACC.msg(r) + '. נשמר כטיוטה.', 5000); }
        K.forEach(function (k) { if (k in draft) base[k] = clone(draft[k]); delete dirty[k]; });
        try { if (draft.packages) localStorage.setItem(PKEY, JSON.stringify(draft.packages)); } catch (e) { /* ignore */ }
        persist(); state(); FS.toast('🌐 המחירים החדשים כבר באתר', 2500);
      });
    }, 1500);
  }
  function state() {
    var n = Object.keys(dirty).length; $('#publish').disabled = !n;
    $('#state').textContent = n ? '💾 טיוטה נשמרה ' + (savedAt ? new Date(savedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '') + ' · ' + n + ' שינויים עוד לא באתר' : '✔ הכול שמור ומפורסם';
    $('#state').className = 'adm-state' + (n ? ' warn' : ''); APP.dirty(n);
  }
  $('#save').addEventListener('click', function () { persist(); state(); FS.toast(Object.keys(dirty).length ? '💾 נשמר. כדי שיופיע באתר לוחצים "פרסום באתר".' : '💾 הכול כבר שמור ומפורסם'); });
  $('#publish').addEventListener('click', function () {
    var keys = Object.keys(dirty); if (!keys.length) return;
    FS.busy('מפרסם…');
    ACC.call('site-save', { site: draft }).then(function (r) {
      FS.busy();
      if (!r.ok) { if (r.error === 'signed-out') return showLogin(ACC.msg(r)); return FS.toast('הפרסום לא הצליח: ' + ACC.msg(r) + '. השינויים שמורים כטיוטה.', 6000); }
      base = clone(draft); dirty = {}; savedAt = Date.now();
      try { localStorage.removeItem(DRAFT); if (draft.packages) localStorage.setItem(PKEY, JSON.stringify(draft.packages)); } catch (e) { /* ignore */ } state();
      FS.toast('🌐 פורסם. האתר מתעדכן מיד.', 5000);
    });
  });

  /* ---------- preview: the real site, with the draft ---------- */
  var pvReady = false;
  $('#preview-btn').addEventListener('click', function () {
    var pv = $('#pv'); pv.hidden = !pv.hidden; document.body.classList.toggle('pv-on', !pv.hidden);
    if (!pv.hidden && !pvReady) { var f = $('#pv-frame'); f.addEventListener('load', function () { pvReady = true; setTimeout(pushPreview, 400); setTimeout(pushPreview, 1800); }); f.src = 'index.html?preview'; }
  });
  $('#pv-x').addEventListener('click', function () { $('#pv').hidden = true; document.body.classList.remove('pv-on'); });
  function pushPreview() { var f = $('#pv-frame'); if (pvReady && f.contentWindow && !$('#pv').hidden) f.contentWindow.postMessage({ type: 'fs-preview', biz: draft }, location.origin); }

  /* ---------- AI writing ---------- */
  function aiAlt(what, current, max, cb) {
    var prompt = 'You write Hebrew website copy for "' + (draft.name || '') + '", an event photo-magnet business (photos printed as magnets at weddings, bar mitzvahs and events, with custom frames). ' +
      'Write 3 alternative versions in natural, warm, professional Hebrew for: ' + what + '. Current text: "' + String(current || '').replace(/"/g, "'") + '". Max ' + (max || 80) + ' characters each. No emojis unless the current has them. Answer ONLY with a JSON array of 3 strings.';
    return FS.askServer({ action: 'ai', tag: 'admin', prompt: prompt }).then(function (r) {
      if (!r || !r.ok || !r.text) throw new Error((r && r.error) || 'ai-failed');
      var t = r.text, a = JSON.parse(t.slice(t.indexOf('['), t.lastIndexOf(']') + 1));
      cb(a.filter(function (x) { return typeof x === 'string' && x.trim(); }).map(function (x) { return x.trim().slice(0, (max || 80) + 20); }).slice(0, 3));
    }).catch(function (e) { FS.toast(FS.aiError(e && e.message), 5000); });
  }
  function aiButton(input, what, max) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'adm-ai'; b.title = 'הצעות ניסוח מה־AI'; b.textContent = '✨';
    b.addEventListener('click', function () {
      b.disabled = true; b.textContent = '…';
      aiAlt(what, input.value, max, function (list) {
        var box = input.parentNode.querySelector('.adm-alts') || input.parentNode.appendChild(Object.assign(document.createElement('div'), { className: 'adm-alts' }));
        box.innerHTML = list.map(function (t) { return '<button type="button">' + esc(t) + '</button>'; }).join('');
        $$('button', box).forEach(function (x) { x.addEventListener('click', function () { input.value = x.textContent; input.dispatchEvent(new Event('input')); box.remove(); }); });
      }).then(function () { b.disabled = false; b.textContent = '✨'; });
    });
    return b;
  }

  /* ---------- the sections ---------- */
  var SECTIONS = [
    ['home', '🏠', 'סקירה'], ['-', '', 'העסק'], ['requests', '📥', 'בקשות הזמנה'], ['calendar', '🗓️', 'יומן'], ['deals', '📑', 'עסקאות ותשלומים'], ['framer', '🎨', 'עיצוב מסגרת'], ['reports', '📊', 'דוחות חודשי ושנתי'], ['tax', '🧮', 'רואה חשבון ומיסים'], ['expenses', '💸', 'הוצאות ורכישות'], ['suppliers', '🏪', 'ספקים'], ['docs', '📁', 'מסמכים'], ['notify', '🔔', 'התראות וסיכום שבועי'], ['customers', '👥', 'לקוחות'], ['licenses', '🔑', 'רישיונות סטודיו'], ['payset', '🏦', 'תשלום ובנק'],
    ['-', '', 'האתר'], ['biz', '🏷️', 'פרטי העסק'], ['texts', '✍️', 'טקסטים באתר'], ['packages', '💰', 'חבילות ומחירים'], ['faq', '❓', 'שאלות נפוצות'],
    ['reviews', '⭐', 'המלצות'], ['busy', '📅', 'תאריכים תפוסים'], ['frames', '🖼️', 'מסגרות ללקוחות'], ['events', '🎉', 'סוגי אירועים'],
    ['-', '', 'קישורים'], ['@./', '🌐', 'האתר ללקוחות'], ['@design.html', '🎨', 'עורך המסגרות ללקוחות'], ['@studio.html', '🖼️', 'הסטודיו'], ['@download.html', '⬇', 'דף ההורדה'], ['@app.html', '📲', 'אפליקציה לטלפון'], ['-', '', ''], ['backup', '💾', 'גיבוי וייצוא לאקסל'], ['account', '🔐', 'אבטחה וחשבון']
  ];
  function nav() {
    $('#side').innerHTML = SECTIONS.map(function (s) {
      if (s[0] === '-') return s[2] ? '<small class="adm-side-h">' + s[2] + '</small>' : '<hr>';
      if (s[0].charAt(0) === '@') return '<a class="adm-side-a" href="' + s[0].slice(1) + '" target="_blank" rel="noopener"><i>' + s[1] + '</i><span>' + s[2] + ' ↗</span></a>';
      return '<button data-s="' + s[0] + '"' + (s[0] === sec ? ' class="on"' : '') + '><i>' + s[1] + '</i><span>' + s[2] + '</span></button>';
    }).join('');
    $$('#side button').forEach(function (b) { b.addEventListener('click', function () { show(b.dataset.s); }); });
  }
  function show(s) { sec = s; onRefresh = null; if (location.hash.slice(1) !== s) history.replaceState(null, '', s === 'home' ? location.pathname + location.search : '#' + s); $$('#side button').forEach(function (b) { b.classList.toggle('on', b.dataset.s === s); }); var m = $('#main'); m.innerHTML = ''; VIEWS[s](m); m.scrollTop = 0; window.scrollTo(0, 0); APP.shown(s); }
  function head(m, title, sub) { m.insertAdjacentHTML('beforeend', '<header class="adm-h"><h1>' + title + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</header>'); }
  function input(label, val, onIn, opt) {
    opt = opt || {};
    var w = document.createElement('label'); w.className = 'adm-f' + (opt.wide ? ' wide' : '');
    w.innerHTML = '<span>' + esc(label) + '</span>';
    var row = document.createElement('div'); row.className = 'adm-in';
    var el = document.createElement(opt.area ? 'textarea' : 'input'); if (!opt.area) el.type = opt.type || 'text'; if (opt.area) el.rows = opt.rows || 3;
    el.value = val == null ? '' : val; if (opt.ph) el.placeholder = opt.ph; if (opt.ltr) el.dir = 'ltr';
    el.addEventListener('input', function () { onIn(el.value); });
    row.appendChild(el); if (opt.ai) row.appendChild(aiButton(el, opt.ai, opt.max)); w.appendChild(row); return w;
  }

  /* the promo films (videos/promo-src/build.py): [file, title, line, download name] */
  var PROMOS = [['site', 'פריים מגנטים', 'מגנט אישי לכל אורח · 45 שניות', 'frame-magnets'], ['studio', 'אופטימוס', 'עריכה, מסגרות ו־AI · 45 שניות', 'frame-studio'], ['app', 'התוכנה לווינדוס', 'AI גם בלי אינטרנט · 41 שניות', 'frame-studio-windows']];
  var VIEWS = {};
  /* 🖥️ what the studio is doing (js/studio-sync.js on each of the owner's computers): event, photos, prints, ink and paper */
  function studiosCard() {
    if (!STUDIOS.length) return '<section class="adm-card st-sync"><h3>🖥️ מה קורה בתוכנה</h3><p class="hint">עוד לא התקבל עדכון מהתוכנה. פותחים את אופטימוס במחשב, נכנסים כמנהל (🔐), ומכאן רואים את האירוע, התמונות וההדפסות בזמן אמת.</p></section>';
    var ago = function (t) { var mn = Math.round((Date.now() - t) / 60000); return mn < 2 ? 'עכשיו' : mn < 60 ? 'לפני ' + mn + ' דק׳' : mn < 1440 ? 'לפני ' + Math.round(mn / 60) + ' שע׳' : new Date(t).toLocaleDateString('he-IL'); };
    var KIND = { desktop: '💻 התוכנה במחשב', phone: '📱 בטלפון', browser: '🌐 בדפדפן' }, today = new Date().toISOString().slice(0, 10);
    return '<section class="adm-card st-sync"><h3>🖥️ מה קורה בתוכנה</h3>' + STUDIOS.map(function (x) {
      var live = Date.now() - x.at < 20 * 60000, ev = x.event || {}, p = x.print || {}, pr = x.printer || {};
      var next = (x.events || []).filter(function (e) { return e.date && e.date >= today; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }).slice(0, 3);
      return '<div class="st-dev"><div class="st-h"><b>' + (KIND[x.kind] || KIND.browser) + '</b><span class="st-dot' + (live ? ' on' : '') + '"></span><small>' + (live ? 'פתוחה · ' : '') + 'עדכון ' + ago(x.at) + (x.ver ? ' · ' + esc(x.ver) : '') + '</small></div>' +
        '<div class="vis-stats">' +
        '<div><b>' + esc(ev.names || '—') + '</b><span>האירוע הפתוח' + (ev.date ? ' · ' + new Date(ev.date + 'T12:00').toLocaleDateString('he-IL') : '') + '</span></div>' +
        '<div><b>' + (x.photos || 0) + '</b><span>תמונות בעבודה</span></div>' +
        '<div><b>' + (p.todayItems || 0) + '</b><span>הודפסו היום (' + (p.todaySheets || 0) + ' דפים)</span></div>' +
        '<div><b>' + (p.items || 0) + '</b><span>באירוע הזה (' + (p.sheets || 0) + ' דפים)</span></div>' +
        (pr.ink != null ? '<div class="' + (pr.ink < 15 ? 'warn' : '') + '"><b>' + pr.ink + '%</b><span>דיו (הערכה)</span></div>' : '') +
        (pr.paper != null ? '<div class="' + (pr.paper < 40 ? 'warn' : '') + '"><b>' + pr.paper + '</b><span>נייר שנשאר</span></div>' : '') +
        '</div>' + (pr.name ? '<p class="hint">🖨️ ' + esc(pr.name) + (p.lastAt ? ' · הדפסה אחרונה ' + ago(p.lastAt) : '') + '</p>' : '') +
        (next.length ? '<p class="hint">🗓️ אירועים שמורים בתוכנה: ' + next.map(function (e) { return esc(e.names || 'אירוע') + ' (' + new Date(e.date + 'T12:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }) + ')'; }).join(' · ') + '</p>' : '') + '</div>';
    }).join('') + '</section>';
  }
  VIEWS.home = function (m) {
    onRefresh = function () { var el = m.querySelector('.st-sync'); if (el) el.outerHTML = studiosCard(); };
    head(m, 'שלום ' + esc(String(draft.owner || '').split(' ')[0] || '') + (APP.on ? '' : ' 👋'), APP.on ? '' : 'העסק והאתר במקום אחד, שמור בשרת המאובטח.');
    if (APP.on) APP.home(m);
    var B = FS.adminBiz, now = new Date(), ym = now.toISOString().slice(0, 7), mon = B.month(DEALS, EXPENSES, SETTINGS, ym);
    var pend = REQUESTS.filter(function (r) { return r.status === 'pending'; });
    var stats = [['📥', pend.length, 'בקשות ממתינות'], ['💵', B.money(mon.income), 'הכנסות החודש'], ['💸', B.money(mon.expTotal), 'הוצאות החודש'], ['📑', DEALS.filter(function (d) { return d.date >= now.toISOString().slice(0, 10); }).length, 'אירועים קרובים'], ['⏳', B.money(B.openBalance(DEALS, SETTINGS)), 'יתרות פתוחות'], ['👥', ACCOUNTS.length, 'לקוחות רשומים']];
    m.insertAdjacentHTML('beforeend', '<div class="adm-stats">' + stats.map(function (s) { return '<div><i>' + APP.statIcon(s[0]) + '</i><b>' + s[1] + '</b><small>' + s[2] + '</small></div>'; }).join('') + '</div>' +
      studiosCard() +
      (Date.now() - BACKUPAT > 7 * 864e5 ? '<section class="adm-card rq-home"><div class="adm-card-h"><h3>💾 ' + (BACKUPAT ? 'הגיבוי האחרון: ' + new Date(BACKUPAT).toLocaleDateString('he-IL') + '. הגיע הזמן לגיבוי השבועי' : 'עוד לא הורדת גיבוי למחשב') + '</h3><button class="btn gold small" id="go-bk">לגיבוי ←</button></div><p class="hint">קובץ אקסל עם כל הנתונים בלשוניות, וצילומי הקבלות, נשמרים במחשב שלך.</p></section>' : '') +
      (pend.length ? '<section class="adm-card rq-home"><div class="adm-card-h"><h3>📥 ' + pend.length + ' בקשות הזמנה מחכות לאישור שלך</h3><button class="btn gold small" id="go-rq">לבקשות ←</button></div><ul class="adm-hist">' + pend.slice(0, 5).map(function (r) { var st = B.dayState(ctx, r.date, r.id); return '<li><b>' + esc(r.ref) + ' · ' + esc(r.name) + ' · ' + esc(B.longDate(r.date)) + '</b><small>' + esc(r.typeName || '') + ' · ' + (st.free ? '✔ פנוי ביומן' : '⚠️ תפוס') + '</small></li>'; }).join('') + '</ul></section>' : '') +
      '<h2>הפלטפורמות</h2><div class="adm-links">' +
      '<a href="./" target="_blank" rel="noopener"><i>🌐</i><b>האתר</b><small>מה שהלקוחות רואים</small></a>' +
      '<a href="design.html" target="_blank" rel="noopener"><i>🎨</i><b>עורך המסגרות ללקוחות</b><small>הלקוחות מעצבים לבד, עם AI ומההזמנה</small></a>' +
      '<a href="design.html?owner" target="_blank" rel="noopener"><i>🧩</i><b>העורך, במצב בעל העסק</b><small>מסגרת מהזמנה ישר ל"המסגרות שלי" בסטודיו</small></a>' +
      '<a href="studio.html" target="_blank" rel="noopener"><i>🖼️</i><b>הסטודיו</b><small>עריכה, הדפסה, עסקאות</small></a></div>' +
      '<h2>🎬 סרטוני תדמית</h2><p class="hint">להעלאה לאתר, ליוטיוב ולפייסבוק (רוחבי) ולסטטוס, רילס וטיקטוק (אנכי). הסרטונים גם בדף הבית של האתר.</p><div class="adm-promo">' +
      PROMOS.map(function (v) {
        var abs = new URL('media/promo/' + v[0] + '.mp4', location.href).href;
        return '<figure><video src="media/promo/' + v[0] + '.mp4" poster="media/promo/' + v[0] + '.jpg" controls playsinline preload="none"></video><figcaption><b>' + v[1] + '</b><small>' + v[2] + '</small>' +
          '<span class="adm-promo-a"><a class="btn small" href="media/promo/' + v[0] + '.mp4" download="' + v[3] + '.mp4">⬇️ רוחבי 16:9</a><a class="btn small" href="media/promo/' + v[0] + '-v.mp4" download="' + v[3] + '-vertical.mp4">⬇️ אנכי 9:16</a>' +
          '<a class="btn small" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(v[1] + ' ' + abs) + '">💬 וואטסאפ</a></span></figcaption></figure>';
      }).join('') + '</div>' +
      '<h2>האירועים הקרובים</h2><div id="next"></div>');
    B.upcoming($('#next'), DEALS, SETTINGS);
    var g = $('#go-rq'); if (g) g.addEventListener('click', function () { show('requests'); });
    var gb = $('#go-bk'); if (gb) gb.addEventListener('click', function () { show('backup'); });
  };
  VIEWS.biz = function (m) {
    head(m, '🏷️ פרטי העסק', 'מופיעים באתר, בצ׳אט, במסמכים ובשורת העסק שעל המגנטים.');
    var g = document.createElement('div'); g.className = 'adm-grid'; m.appendChild(g);
    [['name', 'שם העסק'], ['owner', 'שם בעל העסק'], ['phone', 'טלפון', 'tel'], ['whatsapp', 'וואטסאפ', 'tel'], ['email', 'אימייל', 'email'], ['instagram', 'אינסטגרם (קישור)', 'url'], ['facebook', 'פייסבוק (קישור)', 'url'], ['website', 'אתר', 'url'], ['areas', 'אזורי שירות'], ['hours', 'שעות פעילות']].forEach(function (f) {
      g.appendChild(input(f[1], draft[f[0]], function (v) { draft[f[0]] = v; touch(f[0]); }, { type: f[2], ltr: f[2] && f[2] !== 'text' }));
    });
    m.appendChild(input('סלוגן (מופיע בתחתית האתר)', draft.tagline, function (v) { draft.tagline = v; touch('tagline'); }, { wide: true, ai: 'a short slogan for the business', max: 50 }));
  };
  function readTexts(html) {
    TEXTS = [];
    try { var doc = new DOMParser().parseFromString(html, 'text/html'); $$('[data-t]', doc).forEach(function (e) { TEXTS.push({ key: e.dataset.t, def: e.textContent.trim(), long: e.tagName === 'P' && e.textContent.length > 60 }); }); } catch (e) { /* ignore */ }
  }
  var TEXT_NAMES = { hero: 'פתיח (ראש העמוד)', how: 'איך זה עובד', events: 'אירועים', gallery: 'עיצובים', designer: 'עיצוב מגנט', packages: 'חבילות', tech: 'טכנולוגיה', reviews: 'המלצות', faq: 'שאלות', contact: 'יצירת קשר' };
  var PART = { eyebrow: 'כותרת קטנה', title: 'כותרת', title1: 'כותרת, שורה 1', title2: 'כותרת, שורה 2', lead: 'פסקה' };
  VIEWS.texts = function (m) {
    head(m, '✍️ טקסטים באתר', 'כל הכותרות והפסקאות הראשיות באתר. שדה ריק = הטקסט המקורי. ✨ מציע ניסוחים חלופיים.');
    draft.texts = draft.texts || {};
    var groups = {}; TEXTS.forEach(function (t) { var g = t.key.split('.')[0]; (groups[g] = groups[g] || []).push(t); });
    Object.keys(groups).forEach(function (g) {
      var box = document.createElement('section'); box.className = 'adm-card'; box.innerHTML = '<h3>' + esc(TEXT_NAMES[g] || g) + '</h3>'; m.appendChild(box);
      groups[g].forEach(function (t) {
        var f = input(PART[t.key.split('.')[1]] || t.key, draft.texts[t.key] || '', function (v) { if (v.trim()) draft.texts[t.key] = v; else delete draft.texts[t.key]; touch('texts'); }, { ph: t.def, area: t.long, rows: 3, wide: true, ai: (TEXT_NAMES[g] || g) + ' ' + (PART[t.key.split('.')[1]] || ''), max: t.long ? 220 : 60 });
        var ai = f.querySelector('.adm-ai'); if (ai) ai.addEventListener('click', function () { var el = f.querySelector('input,textarea'); if (!el.value) el.value = t.def; }, true);
        box.appendChild(f);
      });
    });
    if (!TEXTS.length) m.insertAdjacentHTML('beforeend', '<p class="hint">לא הצלחתי לקרוא את טקסטי האתר.</p>');
  };
  VIEWS.packages = function (m) {
    head(m, '💰 חבילות ומחירים', 'מה שמופיע באתר תחת "חבילות", בצ׳אט ובמסמכי העסקה.');
    draft.packages = draft.packages || [];
    var list = document.createElement('div'); list.className = 'adm-list'; m.appendChild(list);
    function draw() {
      list.innerHTML = '';
      draft.packages.forEach(function (p, i) {
        var c = document.createElement('section'); c.className = 'adm-card' + (p.featured ? ' star' : '') + (p.hidden ? ' off' : '');
        c.innerHTML = '<div class="adm-card-h"><h3>' + esc(p.name || 'חבילה') + '</h3><div class="adm-tools"><button data-a="up" title="למעלה">▲</button><button data-a="down" title="למטה">▼</button><button data-a="dup" title="שכפול">⧉</button><button data-a="del" title="מחיקה">🗑</button></div></div>';
        var g = document.createElement('div'); g.className = 'adm-grid'; c.appendChild(g);
        g.appendChild(input('שם', p.name, function (v) { p.name = v; $('h3', c).textContent = v; touch('packages'); }));
        g.appendChild(input('מחיר', p.price, function (v) { p.price = v; touch('packages'); }, { ph: '₪1,490' }));
        g.appendChild(input('משך', p.hours, function (v) { p.hours = v; touch('packages'); }, { ph: '3 שעות' }));
        g.appendChild(input('כמות מגנטים', p.magnets, function (v) { p.magnets = v; touch('packages'); }, { ph: 'עד 150 מגנטים' }));
        c.appendChild(input('מה כלול (שורה לכל פריט)', (p.features || []).join('\n'), function (v) { p.features = v.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); touch('packages'); }, { area: true, rows: 4, wide: true, ai: 'the list of what the package "' + (p.name || '') + '" includes, one item per line (answer each version as one string with \\n between items)', max: 300 }));
        c.appendChild(input('הערה קטנה', p.note, function (v) { p.note = v; touch('packages'); }, { wide: true }));
        var ev = document.createElement('div'); ev.className = 'adm-chips'; ev.innerHTML = '<span>מתאימה ל:</span>' + FS.EVENTS.map(function (e) { return '<button type="button" data-e="' + e.id + '" class="' + ((p.for || []).indexOf(e.id) > -1 ? 'on' : '') + '">' + e.icon + ' ' + e.name + '</button>'; }).join(''); c.appendChild(ev);
        $$('[data-e]', ev).forEach(function (b) { b.addEventListener('click', function () { p.for = p.for || []; var k = p.for.indexOf(b.dataset.e); if (k > -1) p.for.splice(k, 1); else p.for.push(b.dataset.e); b.classList.toggle('on'); touch('packages'); }); });
        c.insertAdjacentHTML('beforeend', '<div class="adm-flags"><label><input type="checkbox" data-k="featured"' + (p.featured ? ' checked' : '') + '> ⭐ החבילה המומלצת</label><label><input type="checkbox" data-k="hidden"' + (p.hidden ? ' checked' : '') + '> להסתיר מהאתר</label></div>');
        $$('[data-k]', c).forEach(function (x) { x.addEventListener('change', function () { p[x.dataset.k] = x.checked; if (x.dataset.k === 'featured' && x.checked) draft.packages.forEach(function (q) { if (q !== p) q.featured = false; }); touch('packages'); draw(); }); });
        $$('[data-a]', c).forEach(function (b) { b.addEventListener('click', function () {
          var a = b.dataset.a, L = draft.packages;
          if (a === 'up' && i > 0) L.splice(i - 1, 0, L.splice(i, 1)[0]); else if (a === 'down' && i < L.length - 1) L.splice(i + 1, 0, L.splice(i, 1)[0]);
          else if (a === 'dup') { var cp = clone(p); cp.id = 'p' + FS.uid(); cp.name += ' (עותק)'; cp.featured = false; L.splice(i + 1, 0, cp); }
          else if (a === 'del') { if (!confirm('למחוק את "' + (p.name || '') + '"?')) return; L.splice(i, 1); }
          touch('packages'); draw();
        }); });
        list.appendChild(c);
      });
      var add = document.createElement('button'); add.className = 'adm-add'; add.innerHTML = '<b>＋</b> חבילה חדשה'; add.addEventListener('click', function () { draft.packages.push({ id: 'p' + FS.uid(), name: 'חבילה חדשה', price: '', hours: '', magnets: '', features: [] }); touch('packages'); draw(); }); list.appendChild(add);
    }
    draw();
    var c = document.createElement('section'); c.className = 'adm-card'; c.innerHTML = '<h3>מתחת לחבילות</h3>'; m.appendChild(c);
    c.appendChild(input('תוספות (שורה לכל תוספת, "שם · מחיר")', (draft.extras || []).join('\n'), function (v) { draft.extras = v.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); touch('extras'); }, { area: true, rows: 4, wide: true, ph: 'שעה נוספת · ₪350' }));
    c.appendChild(input('הערה', draft.packagesNote, function (v) { draft.packagesNote = v; touch('packagesNote'); }, { area: true, rows: 2, wide: true, ai: 'a short note under the price list', max: 160 }));
  };
  VIEWS.faq = function (m) {
    head(m, '❓ שאלות נפוצות', 'מופיעות באתר, ועליהן גם הצ׳אט עונה.');
    draft.faq = draft.faq || [];
    var list = document.createElement('div'); list.className = 'adm-list'; m.appendChild(list);
    function draw() {
      list.innerHTML = '';
      draft.faq.forEach(function (q, i) {
        var c = document.createElement('section'); c.className = 'adm-card';
        c.innerHTML = '<div class="adm-card-h"><h3>שאלה ' + (i + 1) + '</h3><div class="adm-tools"><button data-a="up">▲</button><button data-a="down">▼</button><button data-a="del">🗑</button></div></div>';
        c.appendChild(input('שאלה', q[0], function (v) { q[0] = v; touch('faq'); }, { wide: true }));
        c.appendChild(input('תשובה', q[1], function (v) { q[1] = v; touch('faq'); }, { wide: true, area: true, rows: 3, ai: 'the answer to the FAQ question "' + q[0] + '"', max: 260 }));
        $$('[data-a]', c).forEach(function (b) { b.addEventListener('click', function () { var a = b.dataset.a, L = draft.faq; if (a === 'up' && i > 0) L.splice(i - 1, 0, L.splice(i, 1)[0]); else if (a === 'down' && i < L.length - 1) L.splice(i + 1, 0, L.splice(i, 1)[0]); else if (a === 'del') { if (!confirm('למחוק את השאלה?')) return; L.splice(i, 1); } touch('faq'); draw(); }); });
        list.appendChild(c);
      });
      var row = document.createElement('div'); row.className = 'adm-row';
      row.innerHTML = '<button class="adm-add"><b>＋</b> שאלה</button><button class="btn line" id="faq-ai">✨ ה־AI יציע שאלות שחסרות</button>'; list.appendChild(row);
      $('.adm-add', row).addEventListener('click', function () { draft.faq.push(['', '']); touch('faq'); draw(); });
      $('#faq-ai', row).addEventListener('click', function () {
        var btn = this; btn.disabled = true; btn.textContent = '✨ חושב…';
        var facts = { name: draft.name, areas: draft.areas, packages: (draft.packages || []).map(function (p) { return [p.name, p.price, p.hours, p.magnets]; }), faq: draft.faq.map(function (q) { return q[0]; }) };
        FS.askServer({ action: 'ai', tag: 'admin', prompt: 'An event photo-magnet business (prints guests\' photos as framed magnets at the event). Facts: ' + JSON.stringify(facts) + '. Suggest 4 more FAQ entries customers typically ask that are NOT already listed, in natural Hebrew, with short honest answers based only on the facts or general practice (no invented prices). Answer ONLY with JSON [["question","answer"],...].' })
          .then(function (r) { if (!r || !r.ok) throw new Error(r && r.error); var t = r.text, a = JSON.parse(t.slice(t.indexOf('['), t.lastIndexOf(']') + 1));
            var box = document.createElement('div'); box.className = 'adm-sugg'; box.innerHTML = '<h3>הצעות (לחיצה מוסיפה)</h3>' + a.filter(function (x) { return Array.isArray(x) && x[0]; }).map(function (x, k) { return '<button data-k="' + k + '"><b>' + esc(x[0]) + '</b><span>' + esc(x[1] || '') + '</span></button>'; }).join('');
            list.appendChild(box); $$('[data-k]', box).forEach(function (b) { b.addEventListener('click', function () { var x = a[Number(b.dataset.k)]; draft.faq.push([String(x[0]).slice(0, 120), String(x[1] || '').slice(0, 400)]); touch('faq'); b.remove(); draw(); }); });
          }).catch(function (e) { FS.toast(FS.aiError(e && e.message)); }).then(function () { btn.disabled = false; btn.textContent = '✨ ה־AI יציע שאלות שחסרות'; });
      });
    }
    draw();
  };
  VIEWS.reviews = function (m) {
    head(m, '⭐ המלצות', 'המלצות אמיתיות בלבד, ברשות הלקוחות. החלק "לקוחות מספרים" באתר מופיע כשיש לפחות אחת.');
    draft.reviews = draft.reviews || [];
    m.appendChild(input('קישור לכתיבת ביקורת בגוגל', draft.googleReviews, function (v) { draft.googleReviews = /^https:\/\//.test(v.trim()) || !v.trim() ? v.trim() : draft.googleReviews; touch('googleReviews'); }, { wide: true, ltr: true, ph: 'https://g.page/r/…/review' }));
    var list = document.createElement('div'); list.className = 'adm-list'; m.appendChild(list);
    function draw() {
      list.innerHTML = '';
      draft.reviews.forEach(function (r, i) {
        var c = document.createElement('section'); c.className = 'adm-card';
        c.innerHTML = '<div class="adm-card-h"><h3>' + '★★★★★'.slice(0, r.stars || 5) + '</h3><div class="adm-tools"><button data-a="del">🗑</button></div></div>';
        var g = document.createElement('div'); g.className = 'adm-grid'; c.appendChild(g);
        g.appendChild(input('שם', r.name, function (v) { r.name = v; touch('reviews'); }));
        var s = document.createElement('label'); s.className = 'adm-f'; s.innerHTML = '<span>אירוע</span><div class="adm-in"><select>' + FS.EVENTS.map(function (e) { return '<option value="' + e.id + '"' + (r.type === e.id ? ' selected' : '') + '>' + e.icon + ' ' + e.name + '</option>'; }).join('') + '</select></div>'; g.appendChild(s);
        $('select', s).addEventListener('change', function () { r.type = this.value; touch('reviews'); });
        var st = document.createElement('label'); st.className = 'adm-f'; st.innerHTML = '<span>כוכבים</span><div class="adm-in"><select>' + [5, 4, 3].map(function (n) { return '<option' + ((r.stars || 5) === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></div>'; g.appendChild(st);
        $('select', st).addEventListener('change', function () { r.stars = Number(this.value); touch('reviews'); $('h3', c).textContent = '★★★★★'.slice(0, r.stars); });
        c.appendChild(input('מה הלקוח כתב', r.text, function (v) { r.text = v; touch('reviews'); }, { wide: true, area: true, rows: 3 }));
        $('[data-a=del]', c).addEventListener('click', function () { if (!confirm('למחוק?')) return; draft.reviews.splice(i, 1); touch('reviews'); draw(); });
        list.appendChild(c);
      });
      var add = document.createElement('button'); add.className = 'adm-add'; add.innerHTML = '<b>＋</b> המלצה'; add.addEventListener('click', function () { draft.reviews.push({ name: '', type: 'wedding', stars: 5, text: '' }); touch('reviews'); draw(); }); list.appendChild(add);
    }
    draw();
  };
  VIEWS.busy = function (m) {
    head(m, '📅 תאריכים תפוסים', 'מופיעים באתר ובצ׳אט כ"תפוס", בלי שמות. אפשר גם לעדכן מהסטודיו (עסקאות ← "עדכון תאריכים תפוסים").');
    draft.busy = (draft.busy || []).slice().sort();
    var c = document.createElement('section'); c.className = 'adm-card'; m.appendChild(c);
    function draw() {
      var today = new Date().toISOString().slice(0, 10);
      c.innerHTML = '<div class="adm-row"><input type="date" id="b-new" min="' + today + '"><button class="btn gold" id="b-add">＋ הוספה</button><button class="btn line" id="b-clean">ניקוי תאריכים שעברו</button></div><div class="adm-dates">' +
        (draft.busy.length ? draft.busy.map(function (d) { return '<span class="' + (d < today ? 'past' : '') + '">' + new Date(d + 'T12:00:00').toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) + '<button data-d="' + d + '" aria-label="הסרה">✕</button></span>'; }).join('') : '<p class="hint">אין תאריכים תפוסים.</p>') + '</div>';
      $('#b-add', c).addEventListener('click', function () { var v = $('#b-new', c).value; if (!v || draft.busy.indexOf(v) > -1) return; draft.busy.push(v); draft.busy.sort(); touch('busy'); draw(); });
      $('#b-clean', c).addEventListener('click', function () { draft.busy = draft.busy.filter(function (d) { return d >= today; }); touch('busy'); draw(); });
      $$('[data-d]', c).forEach(function (b) { b.addEventListener('click', function () { draft.busy = draft.busy.filter(function (d) { return d !== b.dataset.d; }); touch('busy'); draw(); }); });
    }
    draw();
  };
  VIEWS.events = function (m) {
    head(m, '🎉 סוגי אירועים', 'מופיעים ברשימה בטופס יצירת הקשר. שורה לכל סוג.');
    m.appendChild(input('סוגי אירועים', (draft.events || []).join('\n'), function (v) { draft.events = v.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); touch('events'); }, { area: true, rows: 9, wide: true }));
  };
  VIEWS.frames = function (m) {
    head(m, '🖼️ מסגרות ללקוחות', 'מה הלקוחות יכולים לבחור בעורך המסגרות (design.html): המסגרות המובנות, והמסגרות שלך בקובץ PNG עם חלון שקוף.');
    draft.hideFrames = draft.hideFrames || [];
    var c = document.createElement('section'); c.className = 'adm-card'; c.innerHTML = '<h3>מסגרות מובנות</h3><p class="hint">לוחצים כדי להסתיר או להחזיר מסגרת. הסתרה מתפרסמת עם "פרסום באתר".</p><div class="adm-frames" id="gen"></div>'; m.appendChild(c);
    FS.GEN_FRAMES.forEach(function (f) {
      var b = document.createElement('button'); b.className = 'adm-fr' + (draft.hideFrames.indexOf(f.id) > -1 ? ' off' : ''); b.innerHTML = '<span class="th"></span><small>' + esc(f.name) + '</small>';
      b.addEventListener('click', function () { var k = draft.hideFrames.indexOf(f.id); if (k > -1) draft.hideFrames.splice(k, 1); else draft.hideFrames.push(f.id); b.classList.toggle('off'); touch('hideFrames'); });
      $('#gen', c).appendChild(b);
      FS.magnetCanvas({ type: 'wedding', names: '', frame: f.id }, 120).then(function (cv) { $('.th', b).appendChild(cv); }).catch(function () {});
    });
    var u = document.createElement('section'); u.className = 'adm-card'; m.appendChild(u);
    function drawMine() {
      u.innerHTML = '<h3>המסגרות שלך (PNG)</h3><p class="hint">PNG עם אזור שקוף לתמונה. נשמרות בשרת ומופיעות ללקוחות מיד עם ההעלאה.</p><div class="adm-frames" id="mine"></div>' +
        '<div class="adm-up"><label class="btn gold">⬆️ העלאת מסגרת PNG<input type="file" id="f-up" accept="image/png" hidden></label><input id="f-name" placeholder="שם המסגרת"></div>';
      FRAMES.forEach(function (f) {
        var b = document.createElement('div'); b.className = 'adm-fr' + (f.hidden ? ' off' : '');
        b.innerHTML = '<span class="th"><img alt=""></span><small>' + esc(f.name) + '</small><div class="adm-tools"><button data-a="hide">' + (f.hidden ? '👁 להציג' : '🙈 להסתיר') + '</button><button data-a="del">🗑</button></div>';
        if (!f.hidden) FS.frameFileUrl(f.id).then(function (url) { $('img', b).src = url + '&v=' + (f.v || 1); });
        $$('[data-a]', b).forEach(function (x) { x.addEventListener('click', function () {
          if (x.dataset.a === 'hide') frameCall('frame-update', { id: f.id, hidden: !f.hidden });
          else if (confirm('למחוק את "' + f.name + '"?')) frameCall('frame-del', { id: f.id });
        }); });
        $('#mine', u).appendChild(b);
      });
      if (!FRAMES.length) $('#mine', u).innerHTML = '<p class="hint">עוד לא העלית מסגרות משלך.</p>';
      $('#f-up', u).addEventListener('change', function () {
        var file = this.files[0]; if (!file) return; var name = $('#f-name', u).value.trim() || file.name.replace(/\.png$/i, '');
        FS.fileToDataURL(file).then(function (url) { return FS.loadImg(url).then(function (im) {
          var hole = FS.detectHole(im); if (!hole && !confirm('לא מצאתי חלון שקוף במסגרת, אז התמונה לא תיראה דרכה. להעלות בכל זאת?')) return;
          var k = Math.min(1, 2400 / Math.max(im.naturalWidth, im.naturalHeight)), cv = FS.canvas(im.naturalWidth * k, im.naturalHeight * k); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
          return frameCall('frame-add', { name: name.slice(0, 40), data: cv.toDataURL('image/png') });
        }); });
      });
    }
    function frameCall(action, data) {
      FS.busy('שומר בשרת…');
      return ACC.call(action, data).then(function (r) { FS.busy(); if (!r.ok) return FS.toast('לא נשמר: ' + ACC.msg(r), 5000); FRAMES = r.frames || FRAMES; FS.toast('✔ נשמר. מופיע ללקוחות מיד.'); drawMine(); });
    }
    drawMine();
  };
  VIEWS.account = function (m) {
    var me = ACC.session() || {};
    head(m, '🔐 אבטחה וחשבון', 'הכניסה היא עם המייל והסיסמה שלך בשרת המאובטח של האתרים. הסיסמה נשמרת שם רק כגיבוב (PBKDF2), ולא בדפדפן.');
    m.insertAdjacentHTML('beforeend', '<section class="adm-card"><h3>החשבון</h3><p>מחובר כ־<b dir="ltr">' + esc(me.email || '') + '</b> (מנהל). הכניסה פגה אחרי 12 שעות.</p>' +
      '<div class="adm-grid"><label class="adm-f"><span>הסיסמה הנוכחית</span><div class="adm-in"><input type="password" id="pw-cur" autocomplete="current-password"></div></label><label class="adm-f"><span>סיסמה חדשה (לפחות 8 תווים)</span><div class="adm-in"><input type="password" id="pw-new" autocomplete="new-password"></div></label><label class="adm-f"><span>שוב</span><div class="adm-in"><input type="password" id="pw-new2" autocomplete="new-password"></div></label></div>' +
      '<div class="adm-row"><button class="btn gold" id="pw-go">🔑 החלפת סיסמה</button><button class="btn danger" id="logout">יציאה</button></div><p class="hint">החלפת סיסמה מנתקת את כל שאר המכשירים.</p></section>' +
      '<section class="adm-card"><h3>מה שומר על המערכת</h3><ul class="adm-sec">' +
      '<li>✅ סיסמאות נשמרות רק כגיבוב חזק (PBKDF2, 210,000 סבבים), אף פעם לא כטקסט.</li><li>✅ אחרי 8 ניסיונות שגויים הכניסה ננעלת לשעה, ומגיע אליך מייל התראה.</li>' +
      '<li>✅ כל פעולה נבדקת בשרת מול הכניסה שלך. לקוח לא יכול לראות עסקאות, דוחות או פרטי בנק, וגם לא עיצובים של לקוח אחר.</li><li>✅ רק האתר שלך יכול לפנות לשרת. בקשה מאתר אחר נחסמת.</li>' +
      '<li>✅ מספרי כרטיסי אשראי לא נשמרים בכלל, והשרת דוחה אותם. תשלום באשראי עובר רק דרך קישור הסליקה.</li><li>✅ הנתונים בשרת של Cloudflare, מוצפנים באחסון, ולא נמחקים כשמנקים את הדפדפן.</li>' +
      '<li>⭐ מומלץ: אימות דו־שלבי עם אפליקציה (Google Authenticator). ההגדרה בעמוד <a href="../portfolio/admin-2fa.html" target="_blank" rel="noopener">הגדרת אימות דו־שלבי</a>.</li>' +
      '<li>⭐ מומלץ: סיסמה ייחודית לאתר הזה, שלא משמשת באתרים אחרים.</li></ul></section>');
    $('#pw-go').addEventListener('click', function () {
      var a = $('#pw-new').value, b2 = $('#pw-new2').value; if (a.length < 8) return FS.toast('סיסמה של לפחות 8 תווים'); if (a !== b2) return FS.toast('שתי הסיסמאות לא זהות');
      ACC.change(a, $('#pw-cur').value).then(function (r) { FS.toast(r.ok ? '✔ הסיסמה הוחלפה. שאר המכשירים נותקו.' : ACC.msg(r), 5000); if (r.ok) $$('#main input[type=password]').forEach(function (i) { i.value = ''; }); });
    });
    $('#logout').addEventListener('click', function () { ACC.logout(); location.reload(); });
  };
  /* the business sections live in js/admin-biz.js; they get the data and a way to save */
  var ctx = {
    deals: function () { return DEALS; }, setDeals: function (l) { DEALS = l; }, expenses: function () { return EXPENSES; }, setExpenses: function (l) { EXPENSES = l; },
    settings: function () { return SETTINGS; }, setSettings: function (s2) { SETTINGS = s2; }, customers: function () { return CUSTOMERS; }, site: function () { return draft; },
    head: head, input: input, esc: esc, reload: function () { show(sec); }, touchBusy: function (list) { draft.busy = list; touch('busy'); },
    requests: function () { return REQUESTS; }, setRequests: function (l) { REQUESTS = l; }, accounts: function () { return ACCOUNTS; }, visitors: function () { return VISITORS; }, waReady: function () { return WAREADY; }, studios: function () { return STUDIOS; }, calKey: function () { return CALKEY; }, setCalKey: function (k) { CALKEY = k; }, sent: function () { return SENT; }, setSent: function (l) { SENT = l; }, suppliers: function () { return SUPS; }, setSuppliers: function (l) { SUPS = l; }, backupAt: function () { return BACKUPAT; }, setBackupAt: function (t) { BACKUPAT = t; }, docs: function () { return DOCS; }, setDocs: function (l) { DOCS = l; }, notifyState: function () { return NSTATE; },
    refresh: refresh, onRefresh: function (fn) { onRefresh = fn; }, badge: function () { badge(); }, go: function (s2) { show(s2); }
  };
  VIEWS.licenses = function (m) { FS.adminLicenses(m, ctx); };
  VIEWS.framer = function (m) { FS.frameAuto(m, ctx); };
  VIEWS.tax = function (m) { FS.adminTax(m, ctx); };
  ['expenses', 'suppliers', 'backup'].forEach(function (k) { VIEWS[k] = function (m) { FS.adminBuy[k](m, ctx); }; });
  ['docs', 'notify'].forEach(function (k) { VIEWS[k] = function (m) { FS.adminNotify[k](m, ctx); }; });
  /* on the phone: one button to photograph a receipt or a document, from any screen */
  (function () {
    var fab = document.createElement('div'); fab.id = 'adm-cam'; fab.innerHTML = '<button class="adm-cam-b" aria-label="צילום קבלה או מסמך">📷</button><div class="adm-cam-m" hidden><button data-cam="expenses">🧾 קבלה / הוצאה</button><button data-cam="docs">📁 מסמך</button></div>';
    document.body.appendChild(fab); setInterval(function () { fab.hidden = !ACC.isAdmin(); }, 1500); fab.hidden = !ACC.isAdmin();
    fab.addEventListener('click', function (e) {
      if (e.target.closest('.adm-cam-b')) { var mm = fab.querySelector('.adm-cam-m'); mm.hidden = !mm.hidden; return; }
      var b = e.target.closest('[data-cam]'); if (!b || !ACC.isAdmin()) return;
      fab.querySelector('.adm-cam-m').hidden = true; show(b.dataset.cam);
      var inp = document.getElementById(b.dataset.cam === 'docs' ? 'dc-photo' : 'ex-photo'); if (inp) inp.click();   /* the camera opens in the same tap */
    });
  })();
  ['requests', 'calendar', 'deals', 'reports', 'customers', 'payset'].forEach(function (k) { VIEWS[k] = function (m) { FS.adminBiz.view(k, m, ctx); }; });

  /* ---------- the phone app (≤ 820 px): a thin top bar, tabs at the bottom, a home that says what matters now ----------
     The same admin underneath: every screen, every action. Only how it is reached and how it looks changes. */
  var APP = { on: false, ic: function () { return ''; }, shown: function () {}, badge: function () {}, dirty: function () {}, home: function () {} };
  (function () {
    var mq = window.matchMedia ? matchMedia('(max-width: 820px)') : { matches: false };
    /* one set of line icons (24×24, the current colour), instead of mixed emoji */
    var P = {
      home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
      inbox: '<path d="M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z"/><path d="M3 13h5l1 3h6l1-3h5"/>',
      users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .7 3.2 2.5 3.5 5.2"/>',
      deal: '<path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
      grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',
      cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
      calx: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M9.5 13.5l5 5M14.5 13.5l-5 5"/>',
      coin: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.6-1-1.7-1.5-3-1.5-1.7 0-3 .9-3 2s1.3 1.8 3 2 3 .9 3 2-1.3 2-3 2c-1.3 0-2.4-.5-3-1.5M12 6.5v11"/>',
      receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
      hourglass: '<path d="M7 3h10M7 21h10M8 3c0 5 8 6 8 9s-8 4-8 9M16 3c0 5-8 6-8 9s8 4 8 9"/>',
      bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
      user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4.3-7 8-7s7 2.5 8 7"/>',
      printer: '<path d="M7 9V3h10v6M7 17H4v-7a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v7h-3"/><path d="M7 14h10v7H7z"/>',
      cam: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
      photo: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
      drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
      sheet: '<path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6"/>',
      spark: '<path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
      chat: '<path d="M4 20l1.4-4.2A8 8 0 1 1 8.6 19z"/>',
      check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
      chart: '<path d="M4 20V11M10 20V5M16 20v-8M3 20h18"/>',
      calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>',
      truck: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
      folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
      key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
      bank: '<path d="M3 10l9-6 9 6M5 10v8M9.7 10v8M14.3 10v8M19 10v8M3 20h18"/>',
      tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
      pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
      box: '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
      help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7M12 17h.01"/>',
      star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
      party: '<path d="M4 20l5-14 9 9z"/><path d="M14 4l1 2M19 6l-2 1M20 11l-2-.5"/>',
      save: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
      lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
      globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
      eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
      phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
      out: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h10"/>',
      x: '<path d="M6 6l12 12M18 6L6 18"/>',
      arrow: '<path d="M15 6l-6 6 6 6"/>',
      brush: '<path d="M14 4l6 6-8.5 8.5a3 3 0 0 1-2.1.9H6v-3.4a3 3 0 0 1 .9-2.1z"/><path d="M12 6l6 6M4 21c1.5 0 2-1 2-2"/>'
    };
    var SEC_IC = { framer: 'brush', home: 'home', requests: 'inbox', calendar: 'cal', deals: 'deal', reports: 'chart', tax: 'calc', expenses: 'receipt', suppliers: 'truck', docs: 'folder', notify: 'bell', customers: 'users', licenses: 'key', payset: 'bank',
      biz: 'tag', texts: 'pen', packages: 'box', faq: 'help', reviews: 'star', busy: 'calx', frames: 'photo', events: 'party', backup: 'save', account: 'lock',
      '@./': 'globe', '@design.html': 'pen', '@studio.html': 'spark', '@download.html': 'save', '@app.html': 'phone' };
    function ic(k) { return '<svg class="ai" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (P[k] || P.deal) + '</svg>'; }
    APP.ic = ic;
    var TABS = [['home', 'home', 'בית'], ['requests', 'inbox', 'בקשות'], ['customers', 'users', 'לקוחות'], ['deals', 'deal', 'עסקאות'], ['more', 'grid', 'עוד']];
    function buzz() { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) { /* no vibration here */ } }
    function wa(phone, text) { return 'https://wa.me/' + String(phone || '').replace(/\D/g, '').replace(/^0/, '972') + '?text=' + encodeURIComponent(text || ''); }

    /* the bottom tabs */
    function tabs() {
      if ($('#adm-tabs')) return;
      var t = document.createElement('nav'); t.id = 'adm-tabs'; t.setAttribute('aria-label', 'ניווט ראשי');
      t.innerHTML = TABS.map(function (x) { return '<button type="button" data-tab="' + x[0] + '">' + ic(x[1]) + '<span>' + x[2] + '</span><b class="tb-n" hidden></b></button>'; }).join('');
      t.addEventListener('click', function (e) {
        var b = e.target.closest('[data-tab]'); if (!b) return; buzz();
        if (b.dataset.tab === 'more') return more(); closeMore();
        if (b.dataset.tab === sec) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
        show(b.dataset.tab);
      });
      document.body.appendChild(t);
      /* unsaved site changes: one pill above the tabs, instead of the desktop's save / publish bar */
      var d = document.createElement('div'); d.id = 'adm-dirty'; d.hidden = true; d.innerHTML = '<span></span><button type="button" class="btn gold small">' + ic('globe') + ' פרסום באתר</button>';
      d.querySelector('button').addEventListener('click', function () { var p = $('#publish'); if (p && !p.disabled) p.click(); });
      document.body.appendChild(d);
    }
    function mark(s) {
      var k = TABS.some(function (x) { return x[0] === s; }) ? s : 'more';
      $$('#adm-tabs [data-tab]').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === k); if (b.dataset.tab === k) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    }
    /* "עוד": every other screen as tiles, and the site actions */
    function more() {
      var o = $('#adm-more'); if (o) { closeMore(); return; }
      o = document.createElement('div'); o.id = 'adm-more'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'כל המסכים');
      var html = '<div class="am-in"><div class="am-h"><b>כל המסכים</b><button type="button" class="am-x" aria-label="סגירה">' + ic('x') + '</button></div>', open = false;
      SECTIONS.forEach(function (s) {
        if (s[0] === '-') { if (!s[2]) return; html += (open ? '</div>' : '') + '<small class="am-g">' + s[2] + '</small><div class="am-tiles">'; open = true; return; }
        if (s[0] === 'home') return;
        var icon = ic(SEC_IC[s[0]] || 'deal');
        html += s[0].charAt(0) === '@' ? '<a class="am-t" href="' + s[0].slice(1) + '" target="_blank" rel="noopener">' + icon + '<span>' + s[2] + '</span></a>'
          : '<button type="button" class="am-t' + (s[0] === sec ? ' on' : '') + '" data-s="' + s[0] + '">' + icon + '<span>' + s[2] + '</span></button>';
      });
      html += (open ? '</div>' : '') + '<small class="am-g">האתר</small><div class="am-acts">' +
        '<button type="button" data-act="client">' + ic('eye') + 'מסך לקוח</button><button type="button" data-act="preview">' + ic('eye') + 'תצוגה מקדימה</button>' +
        '<button type="button" data-act="save">' + ic('save') + 'שמירת טיוטה</button><button type="button" data-act="publish">' + ic('globe') + 'פרסום באתר</button>' +
        '<button type="button" data-act="logout" class="am-out">' + ic('out') + 'יציאה</button></div></div>';
      o.innerHTML = html;
      o.addEventListener('click', function (e) {
        if (e.target === o || e.target.closest('.am-x')) return closeMore();
        var b = e.target.closest('[data-s]'); if (b) { buzz(); closeMore(); show(b.dataset.s); return; }
        var a = e.target.closest('[data-act]'); if (!a) return; buzz(); closeMore();
        var id = { preview: '#preview-btn', save: '#save', publish: '#publish', logout: '#logout-top' }[a.dataset.act];
        if (a.dataset.act === 'client') { var v = $('.adm-views [data-v=client]'); if (v) v.click(); return; }
        var el = id && $(id); if (el && !el.disabled) el.click(); else if (a.dataset.act === 'publish') FS.toast('✔ אין שינויים שמחכים לפרסום');
      });
      document.body.appendChild(o); requestAnimationFrame(function () { o.classList.add('open'); });
      mark('more');
    }
    function closeMore() { var o = $('#adm-more'); if (!o) return; o.remove(); mark(sec); }
    /* the thin top bar: the name, a bell (what waits) and the account */
    function topbar() {
      if ($('#adm-topx')) return;
      var x = document.createElement('div'); x.id = 'adm-topx';
      x.innerHTML = '<button type="button" class="tx-b tx-cam" aria-label="צילום קבלה או מסמך">' + ic('cam') + '</button><button type="button" data-go="requests" class="tx-b" aria-label="מה מחכה לך">' + ic('bell') + '<b class="tb-n" hidden></b></button><button type="button" data-go="account" class="tx-b tx-me" aria-label="החשבון"></button>';
      x.addEventListener('click', function (e) { if (e.target.closest('.tx-cam')) { buzz(); var cb = $('#adm-cam .adm-cam-b'); if (cb) cb.click(); return; } var b = e.target.closest('[data-go]'); if (b) { buzz(); closeMore(); show(b.dataset.go); } });
      $('.dz-top').appendChild(x);
    }
    function me() { var b = $('#adm-topx .tx-me'); if (!b) return; var n = String((draft && draft.owner) || (ACC.session() || {}).email || '').trim(); b.textContent = n ? n.charAt(0).toUpperCase() : '•'; }
    /* numbers that count up when a screen opens */
    function countUp(root) {
      if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      $$('.adm-stats b, .ah-n', root).forEach(function (el) {
        var t = el.textContent, m = /^(\D*)([\d,]+(?:\.\d+)?)(\D*)$/.exec(t); if (!m) return;
        var to = Number(m[2].replace(/,/g, '')); if (!(to > 0) || to > 1e8) return;
        var t0 = performance.now(), dur = 700;
        (function step(now) { var k = Math.min(1, (now - t0) / dur), v = Math.round(to * (1 - Math.pow(1 - k, 3))); el.textContent = m[1] + v.toLocaleString('he-IL') + m[3]; if (k < 1) requestAnimationFrame(step); else el.textContent = t; })(t0);
      });
    }
    /* pull down at the top to refresh */
    function pull() {
      var y0 = null, dy = 0, ind = document.createElement('div'); ind.id = 'adm-pull'; ind.innerHTML = ic('arrow'); document.body.appendChild(ind);
      window.addEventListener('touchstart', function (e) { y0 = APP.on && window.scrollY <= 0 && !$('#adm-more') ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
      window.addEventListener('touchmove', function (e) { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); ind.style.transform = 'translate(-50%,' + Math.min(dy, 110) / 1.6 + 'px) rotate(' + (dy > 80 ? -90 : 90) + 'deg)'; ind.style.opacity = Math.min(1, dy / 80); }, { passive: true });
      window.addEventListener('touchend', function () {
        if (y0 == null) return; var go = dy > 80; y0 = null; ind.style.transform = ''; ind.style.opacity = 0;
        if (!go) return; buzz(); ind.classList.add('spin'); ind.style.opacity = 1;
        Promise.resolve(refresh()).then(function () { ind.classList.remove('spin'); ind.style.opacity = 0; show(sec); FS.toast('✔ עודכן'); }, function () { ind.classList.remove('spin'); ind.style.opacity = 0; });
      });
    }
    /* the opening screen, once a session */
    function splash() {
      var seen = false; try { seen = sessionStorage.getItem('adm-splash'); sessionStorage.setItem('adm-splash', '1'); } catch (e) { /* private mode */ }
      if (seen) return;
      var s = document.createElement('div'); s.id = 'adm-splash'; s.innerHTML = '<div><i>' + ic('spark') + '</i><b>' + esc($('.dz-brand b') ? $('.dz-brand b').textContent : 'פריים מגנטים') + '</b><small>ניהול העסק</small></div>';
      document.body.appendChild(s); setTimeout(function () { s.classList.add('out'); setTimeout(function () { s.remove(); }, 500); }, 900);
    }

    /* home: today, then what waits for you */
    var LIC_CACHE = null, LIC_AT = 0;
    APP.home = function (m) {
      var today = new Date().toISOString().slice(0, 10), B = FS.adminBiz;
      var days = function (iso) { return Math.round((Date.parse(iso + 'T12:00:00') - Date.parse(today + 'T12:00:00')) / 864e5); };
      var when = function (iso) { var n = days(iso); return n === 0 ? 'היום' : n === 1 ? 'מחר' : n < 7 ? 'בעוד ' + n + ' ימים' : new Date(iso + 'T12:00').toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' }); };
      var holds = function (d) { return d && /^\d{4}-\d{2}-\d{2}$/.test(d.date || '') && !d.cancelled && (d.closed || (d.payments || []).length > 0); };
      var up = DEALS.filter(function (d) { return holds(d) && d.date >= today; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      var st = STUDIOS[0], live = st && Date.now() - st.at < 20 * 60000;
      var h = new Date().getHours(), hi = h < 5 ? 'לילה טוב' : h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : h < 21 ? 'ערב טוב' : 'לילה טוב';
      var html = '<div class="ah-date">' + hi + ' · ' + new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }) + '</div>';
      /* the hero: the studio working now, else the next event */
      if (live) {
        var ev = st.event || {}, p = st.print || {}, pr = st.printer || {};
        html += '<section class="ah-hero live"><div class="ah-k"><span class="ah-dot"></span>עכשיו בתוכנה</div><h2>' + esc(ev.names || 'עבודה פתוחה') + '</h2>' +
          '<div class="ah-chips"><span>' + ic('photo') + '<b class="ah-n">' + (st.photos || 0) + '</b> תמונות</span><span>' + ic('printer') + '<b class="ah-n">' + (p.todayItems || 0) + '</b> הודפסו היום</span>' +
          (pr.ink != null ? '<span class="' + (pr.ink < 15 ? 'warn' : '') + '">' + ic('drop') + '<b>' + pr.ink + '%</b> דיו</span>' : '') + (pr.paper != null ? '<span class="' + (pr.paper < 40 ? 'warn' : '') + '">' + ic('sheet') + '<b>' + pr.paper + '</b> נייר</span>' : '') + '</div></section>';
      } else if (up.length) {
        var d = up[0], cl = d.client || {}, t = B.totals(d, SETTINGS);
        html += '<section class="ah-hero"><div class="ah-k">' + ic('cal') + 'האירוע הבא · ' + when(d.date) + '</div><h2>' + esc(cl.name || d.title || 'אירוע') + '</h2>' +
          '<div class="ah-chips">' + (d.venue ? '<span>' + esc(d.venue) + '</span>' : '') + '<span>' + (t.balance > 0.5 ? ic('hourglass') + 'לגבות ' + B.money(t.balance) : ic('check') + 'שולם') + '</span>' + (up.length > 1 ? '<span>+' + (up.length - 1) + ' אירועים אחריו</span>' : '') + '</div>' +
          '<div class="ah-acts">' + (cl.phone ? '<a class="ah-b" target="_blank" rel="noopener" href="' + esc(wa(cl.phone, 'שלום ' + (cl.name || '') + ',')) + '">' + ic('chat') + 'וואטסאפ</a>' : '') + '<button type="button" class="ah-b" data-frame="' + esc(d.id) + '">' + ic('brush') + 'מסגרת</button><button type="button" class="ah-b" data-go="deals">' + ic('deal') + 'לעסקה</button></div></section>';
      } else {
        html += '<section class="ah-hero calm"><div class="ah-k">' + ic('cal') + 'האירועים הקרובים</div><h2>אין אירועים סגורים כרגע</h2><div class="ah-acts"><button type="button" class="ah-b" data-go="requests">' + ic('inbox') + 'לבקשות</button><a class="ah-b" href="studio.html" target="_blank" rel="noopener">' + ic('spark') + 'לסטודיו</a></div></section>';
      }
      /* what waits for you */
      var rows = [];
      REQUESTS.filter(function (r) { return r.status === 'pending'; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }).slice(0, 4).forEach(function (r) {
        rows.push('<li><i class="hot">' + ic('inbox') + '</i><div><b>' + esc(r.name) + ' · ' + esc(r.typeName || 'אירוע') + '</b><small>בקשת הזמנה ל' + when(r.date) + ' · מחכה לאישור</small></div><button type="button" class="ah-go" data-go="requests">לטיפול</button></li>');
      });
      up.filter(function (d) { return days(d.date) <= 7 && B.totals(d, SETTINGS).balance > 0.5; }).slice(0, 3).forEach(function (d) {
        var cl = d.client || {};
        rows.push('<li><i>' + ic('coin') + '</i><div><b>לגבות ' + B.money(B.totals(d, SETTINGS).balance) + '</b><small>' + esc(cl.name || 'עסקה') + ' · האירוע ' + when(d.date) + '</small></div>' + (cl.phone ? '<a class="ah-go" target="_blank" rel="noopener" href="' + esc(wa(cl.phone, 'שלום ' + (cl.name || '') + ', לגבי התשלום לאירוע ' + when(d.date) + ':')) + '">וואטסאפ</a>' : '<button type="button" class="ah-go" data-go="deals">לעסקה</button>') + '</li>');
      });
      if (Date.now() - BACKUPAT > 7 * 864e5) rows.push('<li><i>' + ic('save') + '</i><div><b>גיבוי שבועי למחשב</b><small>' + (BACKUPAT ? 'האחרון לפני ' + Math.floor((Date.now() - BACKUPAT) / 864e5) + ' ימים' : 'עוד לא בוצע') + '</small></div><button type="button" class="ah-go" data-go="backup">לגיבוי</button></li>');
      html += '<section class="ah-wait"><h3>מחכה לך</h3><ul id="ah-list">' + rows.join('') + '<li class="ah-lic" hidden></li></ul>' + (rows.length ? '' : '<p class="ah-ok">' + ic('check') + 'הכול מטופל. אין שום דבר שמחכה לך.</p>') + '</section>';
      m.insertAdjacentHTML('beforeend', '<div class="ah">' + html + '</div>');
      $$('.ah [data-go]', m).forEach(function (b) { b.addEventListener('click', function () { buzz(); show(b.dataset.go); }); });
      $$('.ah [data-frame]', m).forEach(function (b) { b.addEventListener('click', function () { buzz(); FS.frameAutoPick = b.dataset.frame; show('framer'); }); });
      /* Optimus: sign-ups this week and upgrade requests (from the licenses server, kept 5 minutes) */
      function lic(r) {
        var li = $('.ah-lic', m); if (!li || !r || !r.ok) return;
        var wk = Date.now() - 7 * 864e5, n = (r.leads || []).filter(function (x) { return Date.parse(x.firstAt || 0) > wk; }).length, q = (r.licenses || []).filter(function (L) { return L.planReq; }).length;
        if (!n && !q) return;
        li.hidden = false; li.innerHTML = '<i class="hot">' + ic('spark') + '</i><div><b>' + (q ? q + ' בקשות שדרוג לאופטימוס' : n + ' נרשמו לאופטימוס השבוע') + '</b><small>' + (q && n ? n + ' נרשמו השבוע · ' : '') + 'וואטסאפ ושיחה מהרשימה</small></div><button type="button" class="ah-go">' + (q ? 'לרישיונות' : 'ללקוחות') + '</button>';
        li.querySelector('button').addEventListener('click', function () { buzz(); show(q ? 'licenses' : 'customers'); });
        var ok = $('.ah-ok', m); if (ok) ok.remove();
      }
      if (LIC_CACHE && Date.now() - LIC_AT < 5 * 60000) lic(LIC_CACHE);
      else if (FS.license && FS.license.admin) FS.license.admin('lic-list').then(function (r) { if (r && r.ok) { LIC_CACHE = r; LIC_AT = Date.now(); } lic(r); }, function () {});
    };
    /* the stats icons on home */
    var STAT_IC = { '📥': 'inbox', '💵': 'coin', '💸': 'receipt', '📑': 'deal', '⏳': 'hourglass', '👥': 'users' };
    APP.statIcon = function (e) { return APP.on && STAT_IC[e] ? ic(STAT_IC[e]) : e; };

    APP.shown = function (s) {
      if (!APP.on) return; mark(s);
      /* the screen's title: the same line icon as its tile, instead of the emoji */
      var h1 = $('#main .adm-h h1');
      if (h1 && SEC_IC[s] && s !== 'home' && !h1.querySelector('.ai')) { var t = h1.textContent.replace(/^[^\u0590-\u05FFA-Za-z0-9]+/, ''); h1.innerHTML = ic(SEC_IC[s]) + '<span>' + esc(t) + '</span>'; }
      var m = $('#main'); m.classList.remove('adm-enter'); void m.offsetWidth; m.classList.add('adm-enter'); countUp(m); me();
    };
    APP.badge = function (n) {
      $$('#adm-tabs [data-tab=requests] .tb-n, #adm-topx .tb-n').forEach(function (b) { b.hidden = !n; b.textContent = n > 9 ? '9+' : n; });
    };
    APP.dirty = function (n) { var d = $('#adm-dirty'); if (!d) return; d.hidden = !APP.on || !n; d.querySelector('span').textContent = n + ' שינויים באתר עוד לא פורסמו'; };
    function apply() {
      var was = APP.on; APP.on = !!mq.matches; document.body.classList.toggle('adm-app', APP.on);
      if (APP.on) { tabs(); topbar(); me(); } else closeMore();
      if (was !== APP.on && draft) show(sec);
    }
    apply();
    if (APP.on) splash();
    pull();
    if (mq.addEventListener) mq.addEventListener('change', apply); else if (mq.addListener) mq.addListener(apply);
  })();

  signIn();
})();
