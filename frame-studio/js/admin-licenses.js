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

  var METHODS = ['ביט', 'פייבוקס', 'העברה בנקאית', 'מזומן', 'אשראי', 'צ׳ק', 'אחר'];
  function methodSel(id) { return '<select id="' + id + '">' + METHODS.map(function (x) { return '<option>' + x + '</option>'; }).join('') + '</select>'; }
  var nis = function (v) { return '₪' + Number(v || 0).toLocaleString('he-IL'); };
  /* how many times the installer was downloaded: GitHub counts every release asset (public, no key) */
  function downloads() {
    return fetch('https://api.github.com/repos/devopsdevopshaim-wq/devops-hub/releases?per_page=100', { headers: { Accept: 'application/vnd.github+json' } }).then(function (r) { return r.ok ? r.json() : []; }).then(function (rels) {
      var n = 0, week = 0, latest = '';
      (rels || []).filter(function (r) { return /^desktop-/.test(r.tag_name); }).forEach(function (r) {
        if (r.tag_name === 'desktop-latest') latest = (r.name || '').replace(/^.*latest:\s*/, '').replace(/\)$/, '');
        (r.assets || []).forEach(function (a) { if (/\.exe$/i.test(a.name)) n += a.download_count || 0; });
      });
      return { n: n, latest: latest };
    }).catch(function () { return null; });
  }

  FS.adminLicenses = function (m, c) {
    c.head(m, '🔑 רישיונות סטודיו', 'מי משתמש בפריים־סטודיו: קוד הפעלה אישי לכל מייל, נעול למחשב אחד. רק אתה רואה את הקודים.');
    m.insertAdjacentHTML('beforeend',
      '<section class="adm-card" id="lic-stats"></section>' +
      '<section class="adm-card"><h3>➕ רישיון חדש</h3><div class="adm-grid lic-new">' +
      '<label class="adm-f"><span>שם</span><div class="adm-in"><input id="ln-name" maxlength="60"></div></label>' +
      '<label class="adm-f"><span>מייל</span><div class="adm-in"><input id="ln-email" type="email" dir="ltr"></div></label>' +
      '<label class="adm-f"><span>טלפון (לשליחה בוואטסאפ)</span><div class="adm-in"><input id="ln-phone" type="tel" dir="ltr"></div></label>' +
      '<label class="adm-f"><span>הערה (לא חובה)</span><div class="adm-in"><input id="ln-note" maxlength="200" placeholder="למשל: צלם, עובד במגנטים, לקוח"></div></label>' +
      '<label class="adm-f"><span>מחיר הרישיון (₪)</span><div class="adm-in"><input id="ln-price" inputmode="decimal" dir="ltr"></div></label></div>' +
      '<div class="adm-row"><label class="adm-chk"><input type="checkbox" id="ln-paid"> כבר שולם</label><span class="ln-pay" hidden><input id="ln-amount" inputmode="decimal" dir="ltr" placeholder="סכום" style="width:90px"> ' + methodSel('ln-method') + ' <input id="ln-ref" placeholder="אסמכתא / קבלה" style="width:140px"></span></div>' +
      '<div class="adm-row"><label class="adm-chk"><input type="checkbox" id="ln-send" checked> לשלוח את הקוד גם למייל</label><button class="btn gold" id="ln-go">🔑 הנפקת קוד</button></div>' +
      '<p class="hint">💡 התוכנה נפתחת רק אחרי שרשמת תשלום. אפשר להנפיק קוד עכשיו ולרשום את התשלום כשמתקבל.</p>' +
      '<p class="hint">הקוד נוצר אקראית בשרת ונשמר רק אצלך. בהפעלה הראשונה הוא ננעל למחשב של אותו אדם, ומחשב נוסף עם אותו קוד נחסם (ואתה מקבל התראה).</p></section>' +
      '<section class="adm-card"><h3>💰 מחיר ותנאים</h3><div class="adm-row"><label class="adm-f" style="max-width:240px"><span>מחיר ברירת מחדל לרישיון (₪)</span><div class="adm-in"><input id="ls-price" inputmode="decimal" dir="ltr"></div></label><button class="btn line small" id="ls-save">שמירה</button>' +
      '<a class="btn line small" href="agreement.html" target="_blank" rel="noopener">📄 הסכם הרכישה (v1)</a></div><p class="hint">המחיר מופיע בדף ההורדה. כל רוכש מאשר את הסכם הרכישה בהפעלה, והאישור נרשם אצלך עם התאריך.</p></section>' +
      '<section class="adm-card"><div class="adm-row"><h3 style="margin:0">רשימת הרישיונות</h3><input id="lic-q" placeholder="חיפוש שם / מייל / טלפון" style="margin-inline-start:auto"></div><div id="lic-list"><p class="hint">טוען…</p></div></section>');
    var ALL = [], q = '';
    var SET = { price: 990 }, DLS = null;
    function stats() {
      var wk = Date.now() - 7 * 864e5;
      var n = ALL.length, paid = ALL.filter(function (l) { return l.paid; }).length, bound = ALL.filter(function (l) { return l.bound; }).length, on = ALL.filter(function (l) { return Date.parse(l.lastSeen || 0) > wk; }).length;
      var rev = 0, mon = 0, ym = new Date().toISOString().slice(0, 7);
      ALL.forEach(function (l) { (l.payments || []).forEach(function (p) { rev += p.amount || 0; if (String(p.date || '').slice(0, 7) === ym) mon += p.amount || 0; }); });
      var open = ALL.filter(function (l) { return !l.paid && l.active; }).reduce(function (t, l) { return t + (l.price || 0); }, 0);
      $('#lic-stats').innerHTML = '<div class="vis-stats">' +
        '<div><b>' + (DLS ? DLS.n : '…') + '</b><span>הורדות של התוכנה' + (DLS && DLS.latest ? ' (גרסה ' + esc(DLS.latest) + ')' : '') + '</span></div>' +
        '<div><b>' + n + '</b><span>רישיונות שהונפקו</span></div><div><b>' + paid + '</b><span>שולמו</span></div><div><b>' + bound + '</b><span>מותקנים במחשב</span></div><div><b>' + on + '</b><span>השתמשו השבוע</span></div>' +
        '<div><b>' + nis(rev) + '</b><span>הכנסות מהתוכנה</span></div><div><b>' + nis(mon) + '</b><span>החודש</span></div><div><b>' + nis(open) + '</b><span>ממתין לתשלום</span></div></div>' +
        '<div class="adm-row"><a class="btn line small" href="download.html" target="_blank" rel="noopener">⬇ דף ההורדה</a><button class="btn line small" id="lic-dl-copy">📋 העתקת קישור ההורדה</button></div>';
      $('#lic-dl-copy').addEventListener('click', function () { copy(DL); });
    }
    function row(L) {
      var st = !L.active ? '<span class="lic-st off">⛔ מבוטל</span>' : L.bound ? '<span class="lic-st on">✔ מותקן</span>' : '<span class="lic-st wait">⏳ ממתין להפעלה</span>';
      return '<tr data-e="' + esc(L.email) + '"><td><b>' + esc(L.name) + '</b><small dir="ltr">' + esc(L.email) + '</small><small>' + esc(L.phone) + '</small>' + (L.note ? '<small class="lic-note">' + esc(L.note) + '</small>' : '') + '</td>' +
        '<td><code class="lic-code">' + esc(L.code) + '</code></td>' +
        '<td>' + (L.paid ? '<span class="lic-st on">✔ שולם</span><small>' + nis((L.payments || []).reduce(function (t, p) { return t + (p.amount || 0); }, 0)) + ((L.payments || [])[0] ? ' · ' + esc(L.payments[L.payments.length - 1].method || '') : '') + '</small>' : '<span class="lic-st wait">⏳ לא שולם</span><small>מחיר ' + nis(L.price) + '</small>') +
          (L.agreement ? '<small>📄 הסכם ' + esc(L.agreement.ver) + ' אושר ' + when(L.agreement.at) + '</small>' : '') + '</td>' +
        '<td>' + st + (L.session ? '<small><span class="dot on"></span>מחובר</small>' : '') + '</td>' +
        '<td>' + (L.bound ? '<small>' + (L.desktop ? '💻 תוכנה' : '🌐 דפדפן') + (L.platform ? ' · ' + esc(L.platform) : '') + '</small><small>מאז ' + when(L.boundAt) + '</small>' : '—') + '</td>' +
        '<td>' + when(L.lastSeen) + (L.lastIp ? '<small dir="ltr">' + esc(L.lastIp) + '</small>' : '') + '</td>' +
        '<td class="act lic-act">' +
          '<button data-a="pay" title="רישום תשלום">💰</button><button data-a="copy" title="העתקת הקוד וההוראות">📋</button>' +
          (L.phone ? '<a target="_blank" rel="noopener" href="' + esc(wa(L.phone, codeText(L))) + '" title="שליחה בוואטסאפ">💬</a>' : '') +
          '<button data-a="mail" title="שליחה למייל">✉️</button>' +
          (L.bound ? '<button data-a="release" title="שחרור המחשב (מעבר למחשב חדש)">🔓</button>' : '') +
          '<button data-a="rotate" title="קוד חדש (הישן מפסיק לעבוד)">♻️</button>' +
          '<button data-a="toggle" title="' + (L.active ? 'ביטול הרישיון' : 'הפעלה מחדש') + '">' + (L.active ? '⛔' : '✅') + '</button>' +
          '<button data-a="history" title="היסטוריה">🕘</button><button data-a="delete" title="מחיקה">🗑</button></td></tr>' +
        '<tr class="lic-pay" data-p="' + esc(L.email) + '" hidden><td colspan="7"><div class="adm-row"><b>💰 רישום תשלום:</b><input class="lp-amount" inputmode="decimal" dir="ltr" placeholder="סכום" value="' + (L.paid ? '' : (L.price || '')) + '" style="width:90px"><input class="lp-date" type="date" value="' + new Date().toISOString().slice(0, 10) + '">' + '<select class="lp-method">' + METHODS.map(function (x) { return '<option>' + x + '</option>'; }).join('') + '</select><input class="lp-ref" placeholder="אסמכתא / קבלה" style="width:140px"><button class="btn gold small lp-go">שמירה</button></div>' + ((L.payments || []).length ? '<ul class="lic-pays">' + L.payments.map(function (p) { return '<li>' + esc(p.date) + ' · ' + nis(p.amount) + ' · ' + esc(p.method || '') + (p.ref ? ' · ' + esc(p.ref) : '') + ' <button class="link lp-undo" data-at="' + esc(p.at) + '">מחיקה</button></li>'; }).join('') + '</ul>' : '') + '</td></tr>' +
        '<tr class="lic-hist" data-h="' + esc(L.email) + '" hidden><td colspan="7"><ul>' + (L.history || []).map(function (h) { return '<li>' + when(h.at) + ' · ' + esc(h.what) + (h.ip ? ' · <span dir="ltr">' + esc(h.ip) + '</span>' : '') + (h.ua ? ' · <small>' + esc(h.ua) + '</small>' : '') + '</li>'; }).join('') + '</ul></td></tr>';
    }
    function draw() {
      stats();
      var l = ALL.filter(function (L) { return !q || (L.name + ' ' + L.email + ' ' + L.phone + ' ' + L.note).toLowerCase().indexOf(q.toLowerCase()) > -1; });
      $('#lic-list').innerHTML = l.length ? '<div class="vis-scroll"><table class="adm-tbl lic-tbl"><thead><tr><th>מי</th><th>קוד</th><th>תשלום</th><th>מצב</th><th>מחשב</th><th>שימוש אחרון</th><th></th></tr></thead><tbody>' + l.map(row).join('') + '</tbody></table></div>'
        : '<p class="hint">' + (q ? 'לא נמצא.' : 'עוד אין רישיונות. מנפיקים את הראשון למעלה.') + '</p>';
      $$('#lic-list tr[data-e]').forEach(function (tr) {
        var L = ALL.filter(function (x) { return x.email === tr.dataset.e; })[0];
        $$('[data-a]', tr).forEach(function (b) { b.addEventListener('click', function () { act(b.dataset.a, L); }); });
      });
      $$('#lic-list tr[data-p]').forEach(function (tr) {
        var email = tr.dataset.p;
        $('.lp-go', tr).addEventListener('click', function () {
          var amt = $('.lp-amount', tr).value.trim(); if (!(Number(amt) > 0)) return FS.toast('סכום התשלום.');
          LIC.admin('lic-pay', { email: email, amount: amt, date: $('.lp-date', tr).value, method: $('.lp-method', tr).value, ref: $('.lp-ref', tr).value.trim() }).then(function (r) { done(r, '💰 התשלום נרשם. התוכנה פתוחה להפעלה.'); });
        });
        $$('.lp-undo', tr).forEach(function (b) { b.addEventListener('click', function () { if (!confirm('למחוק את התשלום הזה? אם לא נשאר תשלום, התוכנה תיחסם אצל הלקוח.')) return; LIC.admin('lic-pay', { email: email, undo: '1', at: b.dataset.at }).then(function (r) { done(r, 'התשלום נמחק.'); }); }); });
      });
    }
    function done(r, okMsg) { if (!r.ok) { FS.toast(ACC.msg(r), 6000); return; } ALL = r.licenses || ALL; draw(); if (okMsg) FS.toast(okMsg, 5000); }
    function act(a, L) {
      if (a === 'pay') { var pr = $('#lic-list tr[data-p="' + L.email.replace(/"/g, '') + '"]'); if (pr) pr.hidden = !pr.hidden; return; }
      if (a === 'copy') return copy(codeText(L));
      if (a === 'history') { var h = $('#lic-list tr[data-h="' + L.email.replace(/"/g, '') + '"]'); if (h) h.hidden = !h.hidden; return; }
      if (a === 'mail') return LIC.admin('lic-mail', { email: L.email }).then(function (r) { done(r, '✉️ נשלח למייל ' + L.email + ' (אם שירות המיילים מחובר).'); });
      if (a === 'release') { if (!confirm('לשחרר את המחשב של ' + L.name + '? הקוד יופעל מחדש במחשב הבא שבו יוזן, והמחשב הנוכחי ינותק.')) return; return LIC.admin('lic-release', { email: L.email }).then(function (r) { done(r, '🔓 המחשב שוחרר.'); }); }
      if (a === 'rotate') { if (!confirm('להנפיק ל־' + L.name + ' קוד חדש? הקוד הישן יפסיק לעבוד מיד, והתוכנה תנותק עד שיוזן הקוד החדש.')) return; return LIC.admin('lic-rotate', { email: L.email, send: confirm('לשלוח את הקוד החדש גם למייל?') ? '1' : '' }).then(function (r) { done(r, '♻️ קוד חדש: ' + (r.license ? r.license.code : '')); }); }
      if (a === 'toggle') { if (L.active && !confirm('לבטל את הרישיון של ' + L.name + '? הסטודיו ייסגר אצלו מיד (או בחיבור הבא לאינטרנט).')) return; return LIC.admin('lic-set', { email: L.email, active: L.active ? '' : '1' }).then(function (r) { done(r, L.active ? '⛔ הרישיון בוטל.' : '✅ הרישיון פעיל.'); }); }
      if (a === 'delete') { if (!confirm('למחוק לגמרי את הרישיון של ' + L.name + '? אי אפשר לבטל.')) return; return LIC.admin('lic-delete', { email: L.email }).then(function (r) { done(r, '🗑 נמחק.'); }); }
    }
    $('#ln-go').addEventListener('click', function () {
      var b = this, d = { name: $('#ln-name').value.trim(), email: $('#ln-email').value.trim(), phone: $('#ln-phone').value.trim(), note: $('#ln-note').value.trim(), send: $('#ln-send').checked ? '1' : '', price: $('#ln-price').value.trim() };
      if ($('#ln-paid').checked) { d.paidNow = '1'; d.amount = $('#ln-amount').value.trim() || d.price; d.method = $('#ln-method').value; d.ref = $('#ln-ref').value.trim(); }
      if (d.name.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return FS.toast('שם ומייל תקינים.');
      b.disabled = true;
      LIC.admin('lic-create', d).then(function (r) {
        b.disabled = false; if (!r.ok) return FS.toast(ACC.msg(r), 6000);
        ALL = r.licenses; draw(); ['#ln-name', '#ln-email', '#ln-phone', '#ln-note', '#ln-amount', '#ln-ref'].forEach(function (s) { $(s).value = ''; }); $('#ln-paid').checked = false; $('.ln-pay').hidden = true; $('#ln-price').value = SET.price;
        var L = r.license;
        var box = $('#lic-made'); if (!box) { $('.lic-new').closest('.adm-card').insertAdjacentHTML('beforeend', '<div id="lic-made" class="lic-made"></div>'); box = $('#lic-made'); }
        box.innerHTML = '<p>✔ הקוד האישי של <b>' + esc(L.name) + '</b>:</p><p class="lic-big"><code>' + esc(L.code) + '</code></p><p class="hint">' + (d.send ? 'נשלח למייל ' + esc(L.email) + ' (אם שירות המיילים מחובר). ' : '') + 'אפשר גם להעתיק או לשלוח בוואטסאפ:</p>' +
          '<div class="adm-row"><button class="btn gold" id="lc-copy">📋 העתקת הקוד וההוראות</button>' + (L.phone ? '<a class="btn line" target="_blank" rel="noopener" href="' + esc(wa(L.phone, codeText(L))) + '">💬 וואטסאפ</a>' : '') + '</div>';
        var cb = document.getElementById('lc-copy'); if (cb) cb.addEventListener('click', function () { copy(codeText(L)); });
      });
    });
    $('#lic-q').addEventListener('input', function () { q = this.value.trim(); draw(); });
    function load() { LIC.admin('lic-list').then(function (r) { if (!r.ok) { $('#lic-list').innerHTML = '<p class="hint">' + esc(ACC.msg(r)) + '</p>'; return; } ALL = r.licenses; if (r.settings) { SET = r.settings; $('#ls-price').value = SET.price; if (!$('#ln-price').value) $('#ln-price').value = SET.price; } draw(); }); }
    $('#ln-paid').addEventListener('change', function () { $('.ln-pay').hidden = !this.checked; if (this.checked && !$('#ln-amount').value) $('#ln-amount').value = $('#ln-price').value; });
    $('#ls-save').addEventListener('click', function () { LIC.admin('lic-settings', { price: $('#ls-price').value.trim() }).then(function (r) { if (!r.ok) return FS.toast(ACC.msg(r)); SET = r.settings; $('#ln-price').value = SET.price; FS.toast('✔ המחיר נשמר ומופיע בדף ההורדה.'); }); });
    downloads().then(function (d) { DLS = d || { n: '—' }; if (ALL) stats(); });
    c.onRefresh(load);
    load();
  };
})();
