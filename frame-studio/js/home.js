/* 🏠 The home screen (v185): six big buttons, one per kind of work, so the studio opens light and each job shows only its own
   tools. The photos and the marks are the studio's own (FS.state): moving between the buttons never loses a photo or a mark.
     magnets  ✂️ עריכת מגנטים     the fast workspace (mate.js) without the AI tab
     ai       🤖 עיצובי AI         the fast workspace on its AI tab
     booth    📸 עמדת צילום        the guests' booth (booth.js): a photo, one of 20 local styles, copies, print
     qr       📱 QR לאפליקציה      the guests' app code, big on the screen, to copy or print
     strips   🎞️ סטריפים 7.5×20    2 or 3 photos in a column (strips.js), two strips on a 15×20 sheet
     settings ⚙️ הגדרות            printer, driver, page size, instant print, summaries, business details
   "🏠 ראשי" (fixed, top) or the Home key comes back. The last choice is kept ('fs-home-mode'); body[data-mode] lets the CSS
   hide what a mode does not use. */
(function () {
  'use strict';
  var FS = window.FS;
  if (!FS || !FS.mate) return;
  function ls(k, v) { try { if (v !== undefined) localStorage.setItem(k, v); return localStorage.getItem(k); } catch (e) { return null; } }
  var esc = FS.esc || function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var MODES = [
    ['magnets', '✂️', 'עריכת מגנטים', 'גודל, חיתוך, מסגרת, עותקים והדפסה מהירה'],
    ['ai', '🤖', 'עיצובי AI', 'עיצוב התמונות המסומנות בסגנונות AI'],
    ['booth', '📸', 'עמדת צילום', 'האורח מצטלם, בוחר סגנון מתוך 20 וכמה עותקים'],
    ['qr', '📱', 'QR לאפליקציה', 'הקוד של האורחים: על המסך, להעתקה או להדפסה'],
    ['strips', '🎞️', 'סטריפים 7.5×20', '2 או 3 תמונות בעמודה, שני סטריפים בדף 15×20'],
    ['settings', '⚙️', 'הגדרות', 'מדפסת, דרייבר, גודל דף, סיכומים ועוד']
  ];
  var el = document.createElement('div'); el.id = 'fs-home'; el.setAttribute('dir', 'rtl'); el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'מסך הבית');
  el.innerHTML = '<div class="hm-in"><header class="hm-head"><h1>מה עושים עכשיו?</h1><p class="hm-sub" id="hm-sub"></p></header>' +
    '<div class="hm-grid">' + MODES.map(function (m, i) {
      return '<button type="button" class="hm-tile" data-mode="' + m[0] + '"><span class="hm-ic">' + m[1] + '</span><b>' + m[2] + '</b><small>' + m[3] + '</small><kbd>' + (i + 1) + '</kbd></button>';
    }).join('') + '</div><p class="hm-foot">המקשים 1–6 בוחרים · <kbd>Home</kbd> חוזר לכאן · התמונות והסימונים נשמרים בין המצבים</p></div>';
  document.body.appendChild(el);
  var btn = document.createElement('button'); btn.type = 'button'; btn.id = 'fs-home-btn'; btn.title = 'מסך הבית (Home)'; btn.innerHTML = '🏠 <span>ראשי</span> <em id="hm-mode-name"></em>';
  document.body.appendChild(btn);

  var mode = ls('fs-home-mode') || '';
  function nameOf(m) { var r = MODES.filter(function (x) { return x[0] === m; })[0]; return r ? r[1] + ' ' + r[2] : ''; }
  function sub() {
    var n = FS.state.photos.length, k = FS.marked().length;
    document.getElementById('hm-sub').textContent = n ? n + ' תמונות בעבודה' + (k ? ' · ' + k + ' מסומנות' : '') + ' · הן נשארות בכל מצב' : 'בוחרים מצב עבודה. אפשר לעבור ביניהם בכל רגע.';
  }
  function show() { sub(); el.hidden = false; document.body.classList.add('hm-on'); var t = el.querySelector('[data-mode="' + mode + '"]') || el.querySelector('.hm-tile'); t.focus(); }
  function hide() { el.hidden = true; document.body.classList.remove('hm-on'); }
  function setMode(m) {
    mode = m; ls('fs-home-mode', m); document.body.dataset.mode = m;
    document.getElementById('hm-mode-name').textContent = nameOf(m); if (typeof lit === 'function') lit();
  }
  function go(m) {
    hide();
    if (m === 'magnets' || m === 'ai') { setMode(m); if (FS.booth && FS.booth.isOn()) FS.booth.close(); FS.mate.show(m === 'ai' ? 'ai' : 'main'); return; }
    if (m === 'booth') { setMode(m); if (FS.booth) FS.booth.open(); return; }
    if (m === 'strips') { setMode(m); if (!FS.mate.isOn()) FS.mate.open('main'); if (FS.strips) FS.strips.open(); return; }
    if (m === 'qr') { qr(); return; }
    if (m === 'settings') { settings(); return; }
  }
  el.addEventListener('click', function (e) { var t = e.target.closest('[data-mode]'); if (t) go(t.dataset.mode); });
  btn.addEventListener('click', show);
  /* v187: the modes bar, always at the top (over the workspace and the studio): 🏠 and the six, the current one lit, so the
     owner moves between them in one click and always sees how to get back */
  var bar = document.createElement('nav'); bar.id = 'fs-modebar'; bar.setAttribute('dir', 'rtl'); bar.setAttribute('aria-label', 'מצבי עבודה');
  bar.innerHTML = '<button type="button" data-go="home" class="mb-home">🏠 ראשי</button>' + MODES.map(function (m) { return '<button type="button" data-go="' + m[0] + '">' + m[1] + ' <span>' + m[2] + '</span></button>'; }).join('');
  document.body.appendChild(bar); document.body.classList.add('has-modebar');
  bar.addEventListener('click', function (e) { var b = e.target.closest('[data-go]'); if (!b) return; if (b.dataset.go === 'home') show(); else go(b.dataset.go); });
  function lit() { Array.prototype.forEach.call(bar.querySelectorAll('[data-go]'), function (b) { b.classList.toggle('on', b.dataset.go === mode); }); }
  document.addEventListener('keydown', function (e) {
    if (document.body.classList.contains('gated') || (document.getElementById('intro') && !document.getElementById('intro').hidden && document.body.classList.contains('intro-on'))) return;
    var tag = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.target.isContentEditable) return;
    if (e.key === 'Home' && !(FS.booth && FS.booth.isOn())) { e.preventDefault(); show(); return; }
    if (!el.hidden && /^[1-6]$/.test(e.key)) { e.preventDefault(); go(MODES[+e.key - 1][0]); }
    else if (!el.hidden && e.key === 'Escape' && mode) { hide(); }
  });
  FS.home = { show: show, hide: hide, go: go, mode: function () { return mode; } };
  if (mode && mode !== 'booth') setMode(mode); else if (mode === 'booth') setMode('magnets');
  /* the studio opens on the home screen */
  show();

  /* ---------- 📱 the guests' app QR ---------- */
  function qr() {
    var L = FS.liveLinks ? FS.liveLinks() : {};
    var body = FS.dialog('📱 QR לאפליקציה של האורחים', '<div class="hm-qr"><div class="hm-qr-c" id="hm-qr-c"><p class="hint">מכין את הקוד…</p></div>' +
      '<div class="hm-qr-side"><p id="hm-qr-what" class="hint"></p><div class="hm-qr-btns">' +
      '<button class="btn primary" id="hm-qr-full">🖥️ על כל המסך (לסריקה)</button><button class="btn" id="hm-qr-print">🖨️ שלט להדפסה</button><button class="btn" id="hm-qr-copy">🔗 העתקת הקישור</button><button class="btn" id="hm-qr-live">🎉 לאירוע החי (הגדרות)</button>' +
      '</div><p class="hint">האורחים סורקים, מתקינים את "התמונות שלי" ומעלים תמונות וברכות לאירוע.</p></div></div>', true);
    var url = '';
    function draw(u, what) {
      url = u; var box = body.querySelector('#hm-qr-c');
      if (!u) { box.innerHTML = '<p class="hint">עוד אין אירוע חי. פותחים אירוע בלשונית 🎉 אירוע חי, ומשם הקוד מוכן.</p>'; body.querySelector('#hm-qr-what').textContent = ''; return; }
      box.innerHTML = ''; var c = FS.qrCanvas ? FS.qrCanvas(u, 520) : null; if (c) { c.className = 'hm-qr-img'; box.appendChild(c); }
      body.querySelector('#hm-qr-what').innerHTML = esc(what);
    }
    var first = L.main || L.guest;
    draw(first, L.main ? '🔁 הקוד הראשי של הסטודיו' + (L.event ? ' · מוביל עכשיו אל "' + L.event + '"' : '') : L.guest ? '🎉 האורחים של "' + L.event + '"' : '');
    if (!L.main && FS.liveMainGet) FS.liveMainGet().then(function (u) { if (u) draw(u, '🔁 הקוד הראשי של הסטודיו'); });
    body.querySelector('#hm-qr-copy').addEventListener('click', function () { if (!url) return; (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { FS.toast('🔗 הקישור הועתק'); }, function () { window.prompt('העתקה:', url); }); });
    body.querySelector('#hm-qr-full').addEventListener('click', function () { if (url) full(url); });
    body.querySelector('#hm-qr-print').addEventListener('click', function () { if (url) sign(url); });
    body.querySelector('#hm-qr-live').addEventListener('click', function () { FS.closeDialog(); if (FS.mate.isOn()) FS.mate.close(); var t = document.querySelector('[data-tab="live"]'); if (t) t.click(); });
  }
  function full(u) {
    var o = document.createElement('div'); o.className = 'hm-qrfull'; o.setAttribute('dir', 'rtl');
    var name = (FS.business && FS.business.name) || ''; o.innerHTML = '<h2>📸 סורקים ומקבלים את התמונות</h2><div class="hm-qrbig"></div><p>' + esc(name) + '</p><small>לחיצה בכל מקום סוגרת</small>';
    var c = FS.qrCanvas(u, 900); o.querySelector('.hm-qrbig').appendChild(c); o.addEventListener('click', function () { o.remove(); });
    document.body.appendChild(o);
  }
  function sign(u) {
    var w = window.open('', '_blank'); if (!w) return FS.toast('הדפדפן חסם חלון. מאשרים חלונות קופצים ומנסים שוב.');
    var src = FS.qrCanvas(u, 800).toDataURL('image/png');
    w.document.write('<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>QR לאורחים</title><style>@page{size:A5;margin:12mm}body{font-family:Assistant,Arial,sans-serif;text-align:center;color:#222}h1{font-size:30px;margin:6mm 0}img{width:105mm;height:105mm}p{font-size:18px}</style></head><body><h1>📸 סורקים ומקבלים את התמונות</h1><img src="' + src + '"><p>מתקינים את "התמונות שלי", מעלים תמונות ומשאירים ברכה</p></body></html>');
    w.document.close(); setTimeout(function () { w.focus(); w.print(); }, 400);
  }

  /* ---------- ⚙️ settings in one place ---------- */
  function settings() {
    var items = [
      ['printer', '🖨️', 'מדפסת ודרייבר', 'בחירת המדפסת, הנייר בדרייבר'],
      ['quick', '⚡', 'הדפסה מיידית', 'נייר, גודל מגנט ופריסה להדפסה בלחיצה'],
      ['doctor', '🩺', 'בדיקת מדפסת', 'למה לא מדפיס, דף ריק, גודל לא נכון'],
      ['size', '📐', 'גודל דף ומגנט', 'גודל התמונות החדשות וההתאמה'],
      ['summary', '📊', 'סיכומי הדפסות', 'כמה הודפס, באיזה אירוע'],
      ['biz', '🏷️', 'פרטי העסק', 'שם, טלפון ולוגו על המגנטים'],
      ['ai', '🤖', 'מנוע AI ועבודה בלי אינטרנט', 'מנוע מקומי, המחשב בעמדה'],
      ['studio', '🎨', 'הסטודיו המלא', 'כל הכלים, כמו קודם']
    ];
    var body = FS.dialog('⚙️ הגדרות', '<div class="hm-set">' + items.map(function (t) { return '<button type="button" class="hm-st" data-st="' + t[0] + '"><span>' + t[1] + '</span><b>' + t[2] + '</b><small>' + t[3] + '</small></button>'; }).join('') + '</div>');
    body.addEventListener('click', function (e) {
      var b = e.target.closest('[data-st]'); if (!b) return; var k = b.dataset.st; FS.closeDialog();
      var bar = function (name) { FS.mate.show('main'); var t = document.querySelector('#mt .mt-sub [data-bar="' + name + '"]'); if (t) t.click(); };
      if (k === 'printer') { if (FS.printerSetup) FS.printerSetup(); else FS.mate.print(); }
      else if (k === 'quick') FS.mate.qpSetup();
      else if (k === 'doctor') { if (FS.printDoctor && FS.printDoctor.show) FS.printDoctor.show(); else FS.toast('הבדיקה זמינה בתוכנה במחשב'); }
      else if (k === 'size') { setMode('magnets'); bar('size'); }
      else if (k === 'summary') { if (FS.printSummary) FS.printSummary(); }
      else if (k === 'biz') { setMode('magnets'); bar('biz'); }
      else if (k === 'ai') { setMode('ai'); FS.mate.show('ai'); }
      else if (k === 'studio') { if (FS.mate.isOn()) FS.mate.close(); }
    });
  }
})();
