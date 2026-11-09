/* 👥 Customer photos (rail tab "תמונות לקוחות"): every photo the customers of the Regaim app (events-hub) sent to print,
   in the studio. Guests' photos from the event QR and photos in paid shop orders, each with the customer's name and phone,
   the event or order, the product and its size.
   - signs in to the Regaim server with the admin password (the same as the site admin); the token is kept on this computer
   - "📥 לעריכה" brings a photo into the project at the customer's size (6x9 -> a 6×9 cm page), named after the customer
   - what is printed from the studio is marked "הודפס" on the server, so the customer sees it in the app
   - automatic mode: new photos come in by themselves every 20s, and can print at once */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$, S = FS.state, esc = FS.esc;
  var KS = 'fs-regaim', API_DEF = 'https://regaim-events.devopsdevopshaim.workers.dev';
  function load(d) { try { return JSON.parse(localStorage.getItem(KS)) || d; } catch (e) { return d; } }
  var cfg = Object.assign({ token: '', api: API_DEF, src: 'all', st: 'pending', auto: false, print: false, seen: [] }, load({}));
  function keep() { try { localStorage.setItem(KS, JSON.stringify(cfg)); } catch (e) { /* storage blocked */ } }
  var list = [], q = '', loading = false, timer = 0, lastErr = '';
  var ST = { pending: 'ממתינה', printing: 'בהדפסה', printed: 'הודפסה', delivered: 'נמסרה', rejected: 'נדחתה' };

  /* ---------- the Regaim server ---------- */
  function api(path, opt) {
    opt = opt || {};
    return fetch(cfg.api + path, { method: opt.method || 'GET', headers: Object.assign({ 'Content-Type': 'application/json' }, cfg.token ? { Authorization: 'Bearer ' + cfg.token } : {}), body: opt.body ? JSON.stringify(opt.body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) { var e = new Error(d.error || ('שגיאה ' + r.status)); e.status = r.status; throw e; } return d; }); },
        function () { var e = new Error('אין חיבור לשרת של פריים אירועים'); e.status = 0; throw e; });
  }
  function imgUrl(u) { return /^https?:/.test(u) ? u : cfg.api + u; }
  function setStatus(it, st) {
    return api('/api/admin/customer-photos/' + encodeURIComponent(it.id), { method: 'PATCH', body: { status: st } }).then(function () { it.status = st; }, function (e) { if (e.status === 401) signOut(); throw e; });
  }
  function signOut() { cfg.token = ''; keep(); stopAuto(); draw(); }

  /* ---------- the panel ---------- */
  /* one screen (box) that sits in the studio's side panel or in the quick workspace's own view, wherever it is opened */
  var pane = document.createElement('section'); pane.dataset.pane = 'customers'; pane.hidden = true;
  var panel = $('#panel'); panel.insertBefore(pane, $('[data-pane=output]', panel));
  var box = document.createElement('div'); box.className = 'cu-box'; pane.appendChild(box);
  var tab = document.createElement('button'); tab.setAttribute('role', 'tab'); tab.dataset.tab = 'customers';
  tab.innerHTML = '<span>👥</span>תמונות לקוחות<i class="cu-dot" hidden></i>';
  var rail = $('.tools'); rail.insertBefore(tab, $('[data-tab=output]', rail));
  tab.addEventListener('click', function () { FS.openTab('customers'); });
  var openTab = FS.openTab; FS.openTab = function (n) { var r = openTab(n); if (n === 'customers') { pane.appendChild(box); refresh(); } return r; };
  /* the quick workspace (⚡ עבודה מהירה): a tab of its own in the top bar, next to "מרכז האירוע" */
  var mroot = FS.mate && FS.mate.root, mview = null;
  if (mroot && $('.mt-tabs', mroot)) {
    $('.mt-tabs', mroot).insertAdjacentHTML('beforeend', '<button data-v="customers" class="mt-cutab" title="התמונות שהלקוחות שלחו מאפליקציית פריים אירועים, עם שם וטלפון">👥 תמונות לקוחות<i class="cu-dot" hidden></i></button>');
    $('.mt-cutab', mroot).addEventListener('click', function () { FS.mate.show('customers'); });
    mview = document.createElement('section'); mview.className = 'mt-view cu-mt'; mview.dataset.view = 'customers'; mview.hidden = true;
    mroot.appendChild(mview);
    FS.on('mate-view', function (v) { if (v === 'customers') { mview.appendChild(box); refresh(); } });
  }
  function inQuick() { return mview && box.parentNode === mview && FS.mate.isOn(); }

  function shown() {
    var s = q.trim().toLowerCase(), digits = s.replace(/\D/g, '');
    return list.filter(function (it) {
      if (cfg.src !== 'all' && it.source !== cfg.src) return false;
      if (cfg.st === 'pending' && !(it.status === 'pending' || it.status === 'printing')) return false;
      if (cfg.st === 'done' && !(it.status === 'printed' || it.status === 'delivered')) return false;
      if (!s) return true;
      return (it.name + ' ' + it.where + ' ' + it.product + ' ' + (it.city || '')).toLowerCase().indexOf(s) >= 0 || (digits.length > 2 && String(it.phone).replace(/\D/g, '').indexOf(digits) >= 0);
    });
  }
  function when(iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  function wa(it) { var p = String(it.phone || '').replace(/\D/g, '').replace(/^0/, '972'); return p ? 'https://wa.me/' + p + '?text=' + encodeURIComponent('שלום ' + it.name + ', ') : ''; }

  function draw() {
    if (!cfg.token) {
      box.innerHTML = '<h2>👥 תמונות לקוחות</h2><p class="hint">כל התמונות שלקוחות אפליקציית פריים אירועים שלחו להדפסה: מהאירוע (QR) ומהחנות. עם שם הלקוח, הטלפון, האירוע או ההזמנה, המוצר והגודל.</p>' +
        '<form class="card lv-card" id="cu-login"><h3>חיבור לפריים אירועים</h3><div class="field"><label>סיסמת הניהול (כמו באתר הניהול)</label><input type="password" id="cu-pw" autocomplete="current-password" required></div>' +
        '<button class="btn primary">🔐 התחברות</button><p class="hint" id="cu-msg">' + esc(lastErr) + '</p>' +
        '<details><summary class="hint">כתובת השרת</summary><input id="cu-api" dir="ltr" value="' + esc(cfg.api) + '"></details></form>';
      $('#cu-login', box).addEventListener('submit', function (e) {
        e.preventDefault();
        cfg.api = ($('#cu-api', box).value || API_DEF).trim().replace(/\/+$/, '');
        $('#cu-msg', box).textContent = 'מתחבר…';
        api('/api/admin/login', { method: 'POST', body: { password: $('#cu-pw', box).value } }).then(function (r) {
          cfg.token = r.token; lastErr = ''; keep(); FS.toast('✔ מחובר לפריים אירועים'); refresh();
        }, function (er) { $('#cu-msg', box).textContent = '⚠️ ' + er.message; });
      });
      return;
    }
    var items = shown(), waiting = list.filter(function (it) { return it.status === 'pending' || it.status === 'printing'; }).length;
    $$('.cu-dot').forEach(function (dot) { dot.hidden = !waiting; dot.textContent = waiting || ''; });
    box.innerHTML = '<h2>👥 תמונות לקוחות</h2>' +
      '<div class="cu-sum"><span>ממתינות <b>' + waiting + '</b></span><span>מאירועים <b>' + list.filter(function (it) { return it.source === 'event'; }).length + '</b></span><span>מהחנות <b>' + list.filter(function (it) { return it.source === 'order'; }).length + '</b></span><span>לקוחות <b>' + Object.keys(list.reduce(function (o, it) { o[it.phone || it.name] = 1; return o; }, {})).length + '</b></span></div>' +
      '<input id="cu-q" type="search" placeholder="🔎 שם, טלפון, אירוע או מוצר" value="' + esc(q) + '">' +
      '<div class="cu-seg" data-k="src">' + [['all', 'הכול'], ['event', '📸 מאירועים'], ['order', '🛍️ מהחנות']].map(function (x) { return '<button type="button" class="btn small' + (cfg.src === x[0] ? ' on' : '') + '" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div class="cu-seg" data-k="st">' + [['pending', 'ממתינות'], ['done', 'הודפסו'], ['all', 'הכול']].map(function (x) { return '<button type="button" class="btn small' + (cfg.st === x[0] ? ' on' : '') + '" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div class="row2"><button class="btn primary" id="cu-all"' + (items.length ? '' : ' disabled') + '>📥 כל המוצגות לעריכה (' + items.length + ')</button><button class="btn" id="cu-ref">🔄 רענון</button></div>' +
      '<label class="check"><input type="checkbox" id="cu-auto"' + (cfg.auto ? ' checked' : '') + '> קליטה אוטומטית: כל תמונה חדשה נכנסת לפרויקט לבד</label>' +
      '<label class="check"><input type="checkbox" id="cu-print"' + (cfg.print ? ' checked' : '') + (cfg.auto ? '' : ' disabled') + '> 🖨️ ולהדפיס אותה מיד (בגודל שהלקוח בחר)</label>' +
      '<div class="cu-list">' + (loading && !list.length ? '<p class="hint">טוען…</p>' : items.map(card).join('') || '<p class="hint">אין תמונות כאן.</p>') + '</div>' +
      '<p class="hint">' + (lastErr ? '⚠️ ' + esc(lastErr) + ' · ' : '') + 'מה שמודפס מהסטודיו מסומן "הודפסה" אצל הלקוח באפליקציה. <button class="btn small" id="cu-out">יציאה</button></p>';
    $('#cu-q', box).addEventListener('input', function () { q = this.value; var pos = this.selectionStart; draw(); var i = $('#cu-q', box); i.focus(); i.setSelectionRange(pos, pos); });
    $$('.cu-seg', box).forEach(function (g) { g.addEventListener('click', function (e) { var b = e.target.closest('[data-v]'); if (!b) return; cfg[g.dataset.k] = b.dataset.v; keep(); draw(); }); });
    $('#cu-ref', box).addEventListener('click', refresh);
    $('#cu-out', box).addEventListener('click', signOut);
    $('#cu-all', box).addEventListener('click', function () { bring(items); });
    $('#cu-auto', box).addEventListener('change', function () { cfg.auto = this.checked; if (cfg.auto) cfg.seen = list.map(function (it) { return it.id; }); keep(); cfg.auto ? startAuto() : stopAuto(); draw(); if (cfg.auto) FS.toast('🔴 קליטה אוטומטית: תמונות חדשות ייכנסו לבד', 4000); });
    $('#cu-print', box).addEventListener('change', function () { cfg.print = this.checked; keep(); });
    $('.cu-list', box).addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var it = list.filter(function (x) { return x.id === b.closest('[data-id]').dataset.id; })[0]; if (!it) return;
      if (b.dataset.act === 'edit') bring([it]);
      if (b.dataset.act === 'done') setStatus(it, it.status === 'printed' ? 'pending' : 'printed').then(draw, function (er) { FS.toast(er.message); });
    });
  }
  function card(it) {
    var w = wa(it);
    return '<div class="cu-item" data-id="' + esc(it.id) + '"><img src="' + esc(imgUrl(it.url)) + '" alt="" loading="lazy" crossorigin="anonymous">' +
      '<div class="cu-info"><b>' + esc(it.name || 'ללא שם') + '</b>' +
      (it.phone ? '<a dir="ltr" href="tel:' + esc(it.phone) + '">' + esc(it.phone) + '</a>' : '<span class="hint">אין טלפון</span>') +
      '<span>' + (it.source === 'event' ? '📸 ' : '🛍️ ') + esc(it.where) + (it.city ? ' · ' + esc(it.city) : '') + '</span>' +
      '<span>' + esc(it.product) + (it.size ? ' · <b>' + esc(it.size.replace('x', '×')) + ' ס״מ</b>' : '') + (it.qty > 1 ? ' · ×' + it.qty : '') + '</span>' +
      '<span class="hint">' + when(it.createdAt) + (it.edits ? ' · עריכות: ' + esc(it.edits) : '') + '</span>' +
      '<span class="cu-st cu-' + esc(it.status) + '">' + (ST[it.status] || esc(it.status)) + (it.orderStatus ? ' · ' + esc(it.orderStatus) : '') + '</span>' +
      '<span class="cu-acts"><button class="btn small primary" data-act="edit">📥 לעריכה</button><button class="btn small" data-act="done">' + (it.status === 'printed' ? '↩ לא הודפסה' : '✓ הודפסה') + '</button>' +
      (w ? '<a class="btn small" href="' + esc(w) + '" target="_blank" rel="noopener" title="וואטסאפ ללקוח">💬</a>' : '') + '</span></div></div>';
  }

  function refresh() {
    if (!cfg.token) { draw(); return Promise.resolve(); }
    loading = true;
    return api('/api/admin/customer-photos').then(function (d) {
      loading = false; lastErr = ''; list = d; draw();
      if (cfg.auto) pullNew();
    }, function (e) { loading = false; lastErr = e.message; if (e.status === 401) { lastErr = 'צריך להתחבר מחדש'; signOut(); } else draw(); });
  }

  /* ---------- into the studio ---------- */
  function sizeMm(it) { var m = String(it.size || '').match(/^([\d.]+)x([\d.]+)$/); return m ? [Number(m[1]) * 10, Number(m[2]) * 10] : null; }
  function bringOne(it) {
    return fetch(imgUrl(it.url)).then(function (r) { if (!r.ok) throw new Error('התמונה לא ירדה'); return r.blob(); }).then(function (b) {
      var name = [it.name || 'לקוח', it.phone, it.size ? it.size.replace('x', '×') : ''].filter(Boolean).join(' · ');
      return FS.addPhotoFile(new File([b], name + '.jpg', { type: b.type || 'image/jpeg' }));
    }).then(function (p) {
      var mm = sizeMm(it), img = FS.img(p.src);
      if (mm && img) { FS.applyFormat(p.doc, 'cm', img, mm[0], mm[1]); FS.matchOrient(p.doc, img); p.cache = {}; FS.snap(p); }
      p.regaim = { id: it.id, name: it.name, phone: it.phone, where: it.where, product: it.product, size: it.size };
      p.copies = it.qty || 1;
      if (it.status === 'pending') setStatus(it, 'printing').catch(function () {});
      return p;
    });
  }
  function bring(items) {
    if (!items.length) return Promise.resolve([]);
    var got = [], i = 0;
    FS.busy('מוריד תמונות לקוחות…');
    return items.reduce(function (ch, it) {
      return ch.then(function () { FS.busy('מוריד תמונות לקוחות… ' + (++i) + ' מתוך ' + items.length); return bringOne(it).then(function (p) { got.push(p); }, function (e) { FS.toast('⚠️ ' + it.name + ': ' + e.message, 4000); }); });
    }, Promise.resolve()).then(function () {
      FS.busy();
      if (got.length) { FS.buildStrip(); FS.select(S.photos.indexOf(got[got.length - 1])); if (inQuick()) FS.mate.show('main'); FS.toast('📥 ' + got.length + ' תמונות לקוחות בפרויקט, כל אחת בגודל שהלקוח בחר'); }
      draw();
      return got;
    });
  }

  /* what is printed from the studio is marked printed on the server */
  FS.on('print-job', function (plan) {
    var seen = {};
    (plan.pages || []).forEach(function (pg) { pg.forEach(function (x) { var p = x.p; if (p && p.regaim && !seen[p.regaim.id]) seen[p.regaim.id] = p.regaim; }); });
    Object.keys(seen).forEach(function (id) {
      var it = list.filter(function (x) { return x.id === id; })[0] || { id: id };
      setStatus(it, 'printed').catch(function () {});
    });
    if (Object.keys(seen).length) setTimeout(draw, 300);
  });

  /* ---------- automatic mode ---------- */
  function pullNew() {
    var fresh = list.filter(function (it) { return it.status === 'pending' && cfg.seen.indexOf(it.id) < 0; }).reverse();
    if (!fresh.length) return;
    fresh.forEach(function (it) { cfg.seen.push(it.id); }); cfg.seen = cfg.seen.slice(-2000); keep();
    bring(fresh).then(function (ps) {
      FS.toast('📸 ' + ps.length + ' תמונות חדשות מלקוחות: ' + fresh.map(function (it) { return it.name; }).join(', '), 5000);
      if (cfg.print && ps.length) FS.printNow({ list: ps, paper: $('#paper') ? $('#paper').value : 'A4', layout: 'fill', margin: 3, marks: true, copies: 1 });
    });
  }
  function startAuto() { stopAuto(); timer = setInterval(function () { if (!document.hidden) refresh(); }, 20000); }
  function stopAuto() { if (timer) clearInterval(timer); timer = 0; }
  if (cfg.token) { refresh(); if (cfg.auto) startAuto(); }
  FS.customers = { refresh: refresh, list: function () { return list; } };
})();
