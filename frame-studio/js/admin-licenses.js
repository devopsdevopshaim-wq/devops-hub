/* The owner's studio licences: who has פריים־סטודיו, their personal code, which computer it is bound to, when it was last used.
   A code is issued per email and sent by email or WhatsApp; it works on one computer. The owner can free the computer (the
   person moved to a new one), issue a new code (the old one stops at once), cancel or restore, and delete. Every change goes to
   the sign-in server with the admin's session; nothing is decided in this page. */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$, LIC = FS.license, ACC = FS.account;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var DL = 'https://devopsdevopshaim-wq.github.io/devops-hub/frame-studio/download.html';
  var when = function (x) { return x ? new Date(x).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'; };
  function wa(phone, text) { var d = String(phone || '').replace(/\D/g, '').replace(/^0/, '972'); return 'https://wa.me/' + d + '?text=' + encodeURIComponent(text); }
  function codeText(L) { return 'שלום ' + (L.name || '') + ',\nקוד ההפעלה האישי שלך לפריים־סטודיו:\n' + L.code + '\n\nהורדה והתקנה: ' + DL + '\nבהפעלה מזינים את המייל ' + L.email + ' ואת הקוד.\nהקוד אישי ועובד במחשב אחד בלבד.'; }
  function copy(t) { return navigator.clipboard ? navigator.clipboard.writeText(t).then(function () { FS.toast('📋 הועתק'); }, function () { window.prompt('מעתיקים:', t); }) : window.prompt('מעתיקים:', t); }

  FS.adminLicenses = function (m, c) {
    c.head(m, '🔑 רישיונות סטודיו', 'מי משתמש בפריים־סטודיו: קוד הפעלה אישי לכל מייל, נעול למחשב אחד. רק אתה רואה את הקודים.');
    m.insertAdjacentHTML('beforeend',
      '<section class="adm-card" id="lic-stats"></section>' +
      '<section class="adm-card"><h3>➕ רישיון חדש</h3><div class="adm-grid lic-new">' +
      '<label class="adm-f"><span>שם</span><div class="adm-in"><input id="ln-name" maxlength="60"></div></label>' +
      '<label class="adm-f"><span>מייל</span><div class="adm-in"><input id="ln-email" type="email" dir="ltr"></div></label>' +
      '<label class="adm-f"><span>טלפון (לשליחה בוואטסאפ)</span><div class="adm-in"><input id="ln-phone" type="tel" dir="ltr"></div></label>' +
      '<label class="adm-f"><span>הערה (לא חובה)</span><div class="adm-in"><input id="ln-note" maxlength="200" placeholder="למשל: צלם, עובד במגנטים, לקוח"></div></label></div>' +
      '<div class="adm-row"><label class="adm-chk"><input type="checkbox" id="ln-send" checked> לשלוח את הקוד גם למייל</label><button class="btn gold" id="ln-go">🔑 הנפקת קוד</button></div>' +
      '<p class="hint">הקוד נוצר אקראית בשרת ונשמר רק אצלך. בהפעלה הראשונה הוא ננעל למחשב של אותו אדם, ומחשב נוסף עם אותו קוד נחסם (ואתה מקבל התראה).</p></section>' +
      '<section class="adm-card"><div class="adm-row"><h3 style="margin:0">רשימת הרישיונות</h3><input id="lic-q" placeholder="חיפוש שם / מייל / טלפון" style="margin-inline-start:auto"></div><div id="lic-list"><p class="hint">טוען…</p></div></section>');
    var ALL = [], q = '';
    function stats() {
      var wk = Date.now() - 7 * 864e5;
      var n = ALL.length, act = ALL.filter(function (l) { return l.active; }).length, bound = ALL.filter(function (l) { return l.bound; }).length, on = ALL.filter(function (l) { return Date.parse(l.lastSeen || 0) > wk; }).length, desk = ALL.filter(function (l) { return l.desktop; }).length;
      $('#lic-stats').innerHTML = '<div class="vis-stats"><div><b>' + n + '</b><span>רישיונות</span></div><div><b>' + act + '</b><span>פעילים</span></div><div><b>' + bound + '</b><span>מותקנים במחשב</span></div><div><b>' + desk + '</b><span>בתוכנה המותקנת</span></div><div><b>' + on + '</b><span>השתמשו השבוע</span></div></div>' +
        '<div class="adm-row"><a class="btn line small" href="download.html" target="_blank" rel="noopener">⬇ דף ההורדה</a><button class="btn line small" id="lic-dl-copy">📋 העתקת קישור ההורדה</button></div>';
      $('#lic-dl-copy').addEventListener('click', function () { copy(DL); });
    }
    function row(L) {
      var st = !L.active ? '<span class="lic-st off">⛔ מבוטל</span>' : L.bound ? '<span class="lic-st on">✔ מותקן</span>' : '<span class="lic-st wait">⏳ ממתין להפעלה</span>';
      return '<tr data-e="' + esc(L.email) + '"><td><b>' + esc(L.name) + '</b><small dir="ltr">' + esc(L.email) + '</small><small>' + esc(L.phone) + '</small>' + (L.note ? '<small class="lic-note">' + esc(L.note) + '</small>' : '') + '</td>' +
        '<td><code class="lic-code">' + esc(L.code) + '</code></td><td>' + st + (L.session ? '<small><span class="dot on"></span>מחובר</small>' : '') + '</td>' +
        '<td>' + (L.bound ? '<small>' + (L.desktop ? '💻 תוכנה' : '🌐 דפדפן') + (L.platform ? ' · ' + esc(L.platform) : '') + '</small><small>מאז ' + when(L.boundAt) + '</small>' : '—') + '</td>' +
        '<td>' + when(L.lastSeen) + (L.lastIp ? '<small dir="ltr">' + esc(L.lastIp) + '</small>' : '') + '</td>' +
        '<td class="act lic-act">' +
          '<button data-a="copy" title="העתקת הקוד וההוראות">📋</button>' +
          (L.phone ? '<a target="_blank" rel="noopener" href="' + esc(wa(L.phone, codeText(L))) + '" title="שליחה בוואטסאפ">💬</a>' : '') +
          '<button data-a="mail" title="שליחה למייל">✉️</button>' +
          (L.bound ? '<button data-a="release" title="שחרור המחשב (מעבר למחשב חדש)">🔓</button>' : '') +
          '<button data-a="rotate" title="קוד חדש (הישן מפסיק לעבוד)">♻️</button>' +
          '<button data-a="toggle" title="' + (L.active ? 'ביטול הרישיון' : 'הפעלה מחדש') + '">' + (L.active ? '⛔' : '✅') + '</button>' +
          '<button data-a="history" title="היסטוריה">🕘</button><button data-a="delete" title="מחיקה">🗑</button></td></tr>' +
        '<tr class="lic-hist" data-h="' + esc(L.email) + '" hidden><td colspan="6"><ul>' + (L.history || []).map(function (h) { return '<li>' + when(h.at) + ' · ' + esc(h.what) + (h.ip ? ' · <span dir="ltr">' + esc(h.ip) + '</span>' : '') + (h.ua ? ' · <small>' + esc(h.ua) + '</small>' : '') + '</li>'; }).join('') + '</ul></td></tr>';
    }
    function draw() {
      stats();
      var l = ALL.filter(function (L) { return !q || (L.name + ' ' + L.email + ' ' + L.phone + ' ' + L.note).toLowerCase().indexOf(q.toLowerCase()) > -1; });
      $('#lic-list').innerHTML = l.length ? '<div class="vis-scroll"><table class="adm-tbl lic-tbl"><thead><tr><th>מי</th><th>קוד</th><th>מצב</th><th>מחשב</th><th>שימוש אחרון</th><th></th></tr></thead><tbody>' + l.map(row).join('') + '</tbody></table></div>'
        : '<p class="hint">' + (q ? 'לא נמצא.' : 'עוד אין רישיונות. מנפיקים את הראשון למעלה.') + '</p>';
      $$('#lic-list tr[data-e]').forEach(function (tr) {
        var L = ALL.filter(function (x) { return x.email === tr.dataset.e; })[0];
        $$('[data-a]', tr).forEach(function (b) { b.addEventListener('click', function () { act(b.dataset.a, L); }); });
      });
    }
    function done(r, okMsg) { if (!r.ok) { FS.toast(ACC.msg(r), 6000); return; } ALL = r.licenses || ALL; draw(); if (okMsg) FS.toast(okMsg, 5000); }
    function act(a, L) {
      if (a === 'copy') return copy(codeText(L));
      if (a === 'history') { var h = $('#lic-list tr[data-h="' + L.email.replace(/"/g, '') + '"]'); if (h) h.hidden = !h.hidden; return; }
      if (a === 'mail') return LIC.admin('lic-mail', { email: L.email }).then(function (r) { done(r, '✉️ נשלח למייל ' + L.email + ' (אם שירות המיילים מחובר).'); });
      if (a === 'release') { if (!confirm('לשחרר את המחשב של ' + L.name + '? הקוד יופעל מחדש במחשב הבא שבו יוזן, והמחשב הנוכחי ינותק.')) return; return LIC.admin('lic-release', { email: L.email }).then(function (r) { done(r, '🔓 המחשב שוחרר.'); }); }
      if (a === 'rotate') { if (!confirm('להנפיק ל־' + L.name + ' קוד חדש? הקוד הישן יפסיק לעבוד מיד, והתוכנה תנותק עד שיוזן הקוד החדש.')) return; return LIC.admin('lic-rotate', { email: L.email, send: confirm('לשלוח את הקוד החדש גם למייל?') ? '1' : '' }).then(function (r) { done(r, '♻️ קוד חדש: ' + (r.license ? r.license.code : '')); }); }
      if (a === 'toggle') { if (L.active && !confirm('לבטל את הרישיון של ' + L.name + '? הסטודיו ייסגר אצלו מיד (או בחיבור הבא לאינטרנט).')) return; return LIC.admin('lic-set', { email: L.email, active: L.active ? '' : '1' }).then(function (r) { done(r, L.active ? '⛔ הרישיון בוטל.' : '✅ הרישיון פעיל.'); }); }
      if (a === 'delete') { if (!confirm('למחוק לגמרי את הרישיון של ' + L.name + '? אי אפשר לבטל.')) return; return LIC.admin('lic-delete', { email: L.email }).then(function (r) { done(r, '🗑 נמחק.'); }); }
    }
    $('#ln-go').addEventListener('click', function () {
      var b = this, d = { name: $('#ln-name').value.trim(), email: $('#ln-email').value.trim(), phone: $('#ln-phone').value.trim(), note: $('#ln-note').value.trim(), send: $('#ln-send').checked ? '1' : '' };
      if (d.name.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return FS.toast('שם ומייל תקינים.');
      b.disabled = true;
      LIC.admin('lic-create', d).then(function (r) {
        b.disabled = false; if (!r.ok) return FS.toast(ACC.msg(r), 6000);
        ALL = r.licenses; draw(); ['#ln-name', '#ln-email', '#ln-phone', '#ln-note'].forEach(function (s) { $(s).value = ''; });
        var L = r.license;
        var box = $('#lic-made'); if (!box) { $('.lic-new').closest('.adm-card').insertAdjacentHTML('beforeend', '<div id="lic-made" class="lic-made"></div>'); box = $('#lic-made'); }
        box.innerHTML = '<p>✔ הקוד האישי של <b>' + esc(L.name) + '</b>:</p><p class="lic-big"><code>' + esc(L.code) + '</code></p><p class="hint">' + (d.send ? 'נשלח למייל ' + esc(L.email) + ' (אם שירות המיילים מחובר). ' : '') + 'אפשר גם להעתיק או לשלוח בוואטסאפ:</p>' +
          '<div class="adm-row"><button class="btn gold" id="lc-copy">📋 העתקת הקוד וההוראות</button>' + (L.phone ? '<a class="btn line" target="_blank" rel="noopener" href="' + esc(wa(L.phone, codeText(L))) + '">💬 וואטסאפ</a>' : '') + '</div>';
        var cb = document.getElementById('lc-copy'); if (cb) cb.addEventListener('click', function () { copy(codeText(L)); });
      });
    });
    $('#lic-q').addEventListener('input', function () { q = this.value.trim(); draw(); });
    function load() { LIC.admin('lic-list').then(function (r) { if (!r.ok) { $('#lic-list').innerHTML = '<p class="hint">' + esc(ACC.msg(r)) + '</p>'; return; } ALL = r.licenses; draw(); }); }
    c.onRefresh(load);
    load();
  };
})();
