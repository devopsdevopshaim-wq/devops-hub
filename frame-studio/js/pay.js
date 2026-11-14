/* Client payment page. The deal summary and the owner's payment options travel in the link (#<base64url JSON>),
   written by the studio (deals.js, payLink). Nothing is sent anywhere; everything is escaped, and only https links open. */
(function () {
  'use strict';
  var app = document.getElementById('app');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { n = Number(n) || 0; return '₪' + (Math.round(n * 100) / 100).toLocaleString('he-IL', { maximumFractionDigits: 2 }); }
  function heDate(iso) { if (!iso) return ''; var d = new Date(iso + 'T12:00:00'); return isNaN(d) ? esc(iso) : d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  function safeUrl(u) { u = String(u || '').trim(); if (/^www\./i.test(u)) u = 'https://' + u; return /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : ''; }
  function phone(n) { n = String(n || '').replace(/\D/g, ''); return n.charAt(0) === '0' ? '972' + n.slice(1) : n; }
  function toast(t) { var el = document.getElementById('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('on'); }, 2400); }
  function decode() {
    try { var s = location.hash.slice(1).replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(decodeURIComponent(escape(atob(s)))); } catch (e) { return null; }
  }
  var D = decode();
  if (!D || !D.b) { app.innerHTML = '<div class="card load">הקישור לא שלם. כדאי לבקש מבעל העסק לשלוח אותו שוב.</div>'; return; }
  var B = D.b || {}, P = D.pay || {}, first = String(D.n || '').split(' ')[0];
  document.title = 'תשלום להזמנה · ' + (B.name || '');

  var opts = [];
  if (P.bit) opts.push('<div class="opt"><span class="ic">💙</span><span class="tx"><b>ביט</b><small dir="ltr">' + esc(P.bit) + '</small></span><button class="copy" data-copy="' + esc(P.bit) + '">העתקה</button></div>');
  var pb = safeUrl(P.paybox); if (pb) opts.push('<a class="opt" href="' + esc(pb) + '" target="_blank" rel="noopener"><span class="ic">💜</span><span class="tx"><b>פייבוקס</b><small>תשלום בקישור</small></span><span class="go">לתשלום ←</span></a>');
  var cd = safeUrl(P.card); if (cd) opts.push('<a class="opt" href="' + esc(cd) + '" target="_blank" rel="noopener"><span class="ic">💳</span><span class="tx"><b>כרטיס אשראי</b><small>דף תשלום מאובטח</small></span><span class="go">לתשלום ←</span></a>');
  var pp = safeUrl(P.paypal); if (pp) opts.push('<a class="opt" href="' + esc(pp) + '" target="_blank" rel="noopener"><span class="ic">🅿️</span><span class="tx"><b>PayPal</b><small>תשלום בקישור</small></span><span class="go">לתשלום ←</span></a>');
  if (P.account) {
    var rows = [['שם החשבון', P.holder], ['בנק', [P.bank, P.bankNo ? '(' + P.bankNo + ')' : ''].filter(Boolean).join(' ')], ['סניף', P.branch], ['חשבון', P.account]].filter(function (r) { return r[1]; });
    opts.push('<div class="opt"><span class="ic">🏦</span><div class="bank"><b>העברה בנקאית</b>' + rows.map(function (r) { return '<div><span>' + r[0] + '</span><b dir="auto">' + esc(r[1]) + '</b></div>'; }).join('') +
      '<div><span></span><button class="copy" data-copy="' + esc(rows.map(function (r) { return r[0] + ': ' + r[1]; }).join('\n')) + '">העתקת הפרטים</button></div></div></div>');
  }
  if (P.cash || P.check) opts.push('<div class="opt"><span class="ic">💵</span><span class="tx"><b>' + [P.cash ? 'מזומן' : '', P.check ? 'צ׳ק' : ''].filter(Boolean).join(' או ') + '</b><small>בתיאום, עד יום האירוע</small></span></div>');

  var due = Number(D.due) || 0, paidAll = Number(D.t) > 0 && due <= 0;
  var msg = 'היי ' + (B.owner ? String(B.owner).split(' ')[0] : '') + ', כאן ' + (D.n || '') + '. שילמתי ' + money(due) + ' עבור ' + (D.e || 'האירוע') + (D.d ? ' ב־' + new Date(D.d + 'T12:00:00').toLocaleDateString('he-IL') : '') + (D.no ? ' (עסקה ' + D.no + ')' : '') + '. אשמח לאישור 🙏';
  var wa = phone(B.wa || B.phone);

  app.innerHTML =
    '<section class="card hero"><p class="brand">' + esc(B.name) + '<small>' + esc(B.owner || '') + '</small></p>' +
      '<p class="hello">שלום ' + esc(first) + ' 😊 ' + (paidAll ? 'ההזמנה שולמה במלואה, תודה!' : 'שמחים שבחרתם בנו!') + '</p>' +
      (paidAll ? '<p class="paid-all">✔ אין יתרה לתשלום</p>' : '<div class="due"><span>' + (D.dep ? 'מקדמה לסגירת התאריך' : 'יתרה לתשלום') + '</span><b>' + money(due) + '</b></div>') + '</section>' +
    '<section class="card"><h2>פרטי ההזמנה</h2><dl class="sum">' +
      (D.e ? '<div><dt>אירוע</dt><dd>' + esc(D.i || '') + ' ' + esc(D.e) + '</dd></div>' : '') +
      (D.d ? '<div><dt>תאריך</dt><dd>' + heDate(D.d) + (D.tm ? ' · ' + esc(D.tm) : '') + '</dd></div>' : '') +
      (D.vn ? '<div><dt>מקום</dt><dd>' + esc(D.vn) + '</dd></div>' : '') +
      (D.pk ? '<div><dt>חבילה</dt><dd>' + esc(D.pk) + '</dd></div>' : '') +
      '<div><dt>סה״כ</dt><dd>' + money(D.t) + '</dd></div>' + (Number(D.p) ? '<div><dt>שולם</dt><dd>' + money(D.p) + '</dd></div>' : '') +
      (D.no ? '<div><dt>מס׳ עסקה</dt><dd>' + esc(D.no) + '</dd></div>' : '') + '</dl></section>' +
    (paidAll ? '' : '<section class="card"><h2>איך משלמים</h2><div class="opts">' + (opts.join('') || '<p>פרטי התשלום יישלחו אליכם בנפרד.</p>') + '</div></section>' +
      (wa ? '<a class="done" href="https://wa.me/' + wa + '?text=' + encodeURIComponent(msg) + '" target="_blank" rel="noopener">✅ שילמתי, עדכון בוואטסאפ</a>' : '')) +
    '<p class="foot">שאלות? ' + (B.phone ? '<a href="tel:' + esc(String(B.phone).replace(/[^\d+]/g, '')) + '">' + esc(B.phone) + '</a>' : '') + (B.email ? ' · <a href="mailto:' + esc(B.email) + '">' + esc(B.email) + '</a>' : '') + '<br>' + esc(B.name) + ' 🧲</p>';

  app.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy]'); if (!b) return;
    var t = b.getAttribute('data-copy');
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('✔ הועתק'); }, function () { prompt('להעתקה:', t); });
  });
})();
