/* The owner's alerts and documents.
   - 🔔 Alerts and the weekly summary: every morning what is coming (events today, tomorrow and in a week, booking requests
     waiting for him, open quotes whose date is close, balances to collect, documents about to expire, a late backup);
     Saturday night after Shabbat, last week and the week ahead; the events that hold a date in his Google Calendar with
     reminders on the phone. Sent by the server through Maton (Gmail, Telegram, Google Calendar he connected at maton.ai),
     or by the server's own mail when Maton is not set. The Maton key lives only on the server (the MATON_API_KEY secret).
   - 📁 Documents: a photo of anything worth keeping (a contract, a policy, a permit, a letter), with an expiry date when it
     has one; taken with the phone's camera, kept on the server, in the full backup. */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$, ACC = FS.account;
  var DOC_CATS = ['חוזה / הסכם', 'ביטוח', 'רשות המסים / מע״מ', 'ביטוח לאומי', 'בנק', 'רישיון / אישור', 'אחריות / ציוד', 'אחר'];
  function shrink(file) {
    return new Promise(function (ok, no) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var r = Math.min(1, 2000 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
        cv.width = Math.round(img.width * r); cv.height = Math.round(img.height * r);
        var g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
        var q = 0.8, d = cv.toDataURL('image/jpeg', q); while (d.length > 2300000 && q > 0.3) { q -= 0.15; d = cv.toDataURL('image/jpeg', q); }
        ok(d);
      };
      img.onerror = function () { URL.revokeObjectURL(url); no(new Error('not-image')); };
      img.src = url;
    });
  }

  /* ---------- documents ---------- */
  function docs(m, c) {
    var esc = c.esc, heDate = FS.adminBiz.heDate, editing = null, photo = null, cat = '', q = '';
    c.head(m, '📁 מסמכים', 'מצלמים מהטלפון כל מסמך ששווה לשמור: חוזה, פוליסה, אישור, מכתב. עם תאריך תפוגה מקבלים תזכורת לפני שהוא נגמר. קבלות על הוצאות נרשמות ב"💸 הוצאות ורכישות".');
    m.insertAdjacentHTML('beforeend', '<section class="adm-card" id="dc-form"><h3 id="dc-h">＋ מסמך חדש</h3>' +
      '<div class="adm-row"><label class="btn gold dc-cam">📷 צילום / בחירת קובץ<input type="file" id="dc-photo" accept="image/*" capture="environment" hidden></label><span id="dc-ph" class="hint"></span></div><div class="adm-grid">' +
      '<label class="adm-f"><span>שם המסמך</span><div class="adm-in"><input id="dc-title" placeholder="למשל: פוליסת ביטוח ציוד 2026"></div></label>' +
      '<label class="adm-f"><span>סוג</span><div class="adm-in"><select id="dc-cat">' + DOC_CATS.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('') + '</select></div></label>' +
      '<label class="adm-f"><span>תאריך המסמך</span><div class="adm-in"><input type="date" id="dc-date" value="' + new Date().toISOString().slice(0, 10) + '"></div></label>' +
      '<label class="adm-f"><span>בתוקף עד (לא חובה)</span><div class="adm-in"><input type="date" id="dc-exp"></div></label>' +
      '<label class="adm-f wide"><span>הערה</span><div class="adm-in"><input id="dc-note"></div></label></div>' +
      '<div class="adm-row"><button class="btn gold" id="dc-save">＋ שמירה</button><button class="btn line" id="dc-cancel" hidden>ביטול עריכה</button></div></section>' +
      '<div class="adm-row bu-filter"><select id="dc-fcat"><option value="">כל הסוגים</option>' + DOC_CATS.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('') + '</select><input id="dc-q" placeholder="חיפוש"></div><div id="dc-list" class="dc-grid"></div>');
    function list() { return (c.docs() || []).filter(function (d) { return (!cat || d.cat === cat) && (!q || (d.title + ' ' + d.note + ' ' + d.cat).toLowerCase().indexOf(q.toLowerCase()) > -1); }).sort(function (a, b) { return a.date < b.date ? 1 : -1; }); }
    function draw() {
      var today = new Date().toISOString().slice(0, 10), soon = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), l = list();
      $('#dc-list').innerHTML = l.length ? l.map(function (d) {
        var st = d.expiry ? (d.expiry < today ? '<b class="tx-warn">פג ' + heDate(d.expiry) + '</b>' : d.expiry <= soon ? '<b class="tx-warn">בתוקף עד ' + heDate(d.expiry) + '</b>' : 'בתוקף עד ' + heDate(d.expiry)) : '';
        return '<section class="adm-card" data-id="' + esc(d.id) + '"><div class="adm-card-h"><h3>📄 ' + esc(d.title) + '</h3><span class="bu-acts"><button data-a="view" title="הצגה">👁</button><button data-a="edit" title="עריכה">✏️</button><button data-a="del" title="מחיקה">🗑</button></span></div>' +
          '<p class="hint">' + esc(d.cat || '') + ' · ' + heDate(d.date) + (st ? ' · ' + st : '') + '</p>' + (d.note ? '<p>' + esc(d.note) + '</p>' : '') + '</section>';
      }).join('') : '<p class="hint">עוד אין מסמכים. בטלפון: כפתור 📷 בפינה צולם מכל מסך.</p>';
      $$('#dc-list [data-id]').forEach(function (card) {
        var d = (c.docs() || []).filter(function (x) { return x.id === card.dataset.id; })[0];
        $('[data-a=view]', card).addEventListener('click', function () {
          var b = FS.dialog('📄 ' + d.title, '<p class="hint">טוען…</p>', true);
          ACC.call('doc-get', { id: d.id }).then(function (r) { b.innerHTML = r.ok ? '<img src="' + r.data + '" alt="" style="max-width:100%;max-height:72vh;display:block;margin:0 auto;border-radius:8px"><div class="adm-row"><a class="btn line small" download="document-' + esc(d.id) + '.jpg" href="' + r.data + '">⬇️ הורדה</a></div>' : '<p class="hint">' + esc(ACC.msg(r)) + '</p>'; });
        });
        $('[data-a=edit]', card).addEventListener('click', function () { editing = d; photo = null; $('#dc-title').value = d.title; $('#dc-cat').value = d.cat || DOC_CATS[DOC_CATS.length - 1]; $('#dc-date').value = d.date; $('#dc-exp').value = d.expiry || ''; $('#dc-note').value = d.note || ''; $('#dc-h').textContent = '✏️ ' + d.title; $('#dc-save').textContent = '💾 שמירה'; $('#dc-cancel').hidden = false; $('#dc-ph').textContent = 'צילום חדש יחליף את הקיים'; $('#dc-form').scrollIntoView({ behavior: 'smooth' }); });
        $('[data-a=del]', card).addEventListener('click', function () { if (!confirm('למחוק את המסמך "' + d.title + '"?')) return; ACC.call('doc-del', { id: d.id }).then(function (r) { if (!r.ok) return FS.toast(ACC.msg(r)); c.setDocs(c.docs().filter(function (x) { return x.id !== d.id; })); draw(); }); });
      });
    }
    function reset() { editing = null; photo = null; ['#dc-title', '#dc-exp', '#dc-note'].forEach(function (s) { $(s).value = ''; }); $('#dc-photo').value = ''; $('#dc-ph').textContent = ''; $('#dc-h').textContent = '＋ מסמך חדש'; $('#dc-save').textContent = '＋ שמירה'; $('#dc-cancel').hidden = true; }
    $('#dc-photo').addEventListener('change', function () {
      var f = this.files && this.files[0]; if (!f) return; $('#dc-ph').textContent = 'מכין…';
      shrink(f).then(function (d) { photo = d; $('#dc-ph').innerHTML = '<img src="' + d + '" alt="" style="height:54px;border-radius:6px;vertical-align:middle"> ✔ מוכן'; if (!$('#dc-title').value) $('#dc-title').focus(); }, function () { $('#dc-ph').textContent = 'הקובץ הזה לא תמונה (PDF: מצלמים את המסך או את הדף).'; });
    });
    $('#dc-cancel').addEventListener('click', reset);
    $('#dc-save').addEventListener('click', function () {
      if (!editing && !photo) return FS.toast('קודם מצלמים את המסמך');
      var d = { id: editing ? editing.id : 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), title: $('#dc-title').value.trim() || $('#dc-cat').value, cat: $('#dc-cat').value, date: $('#dc-date').value, expiry: $('#dc-exp').value, note: $('#dc-note').value.trim() };
      var b = this; b.disabled = true;
      ACC.call('doc-save', photo ? { doc: d, data: photo } : { doc: d }).then(function (r) { b.disabled = false; if (!r.ok) return FS.toast(ACC.msg(r)); c.setDocs((c.docs() || []).filter(function (x) { return x.id !== r.doc.id; }).concat([r.doc])); reset(); draw(); FS.toast('✔ המסמך נשמר'); }, function () { b.disabled = false; FS.toast('אין חיבור לשרת'); });
    });
    $('#dc-fcat').addEventListener('change', function () { cat = this.value; draw(); });
    $('#dc-q').addEventListener('input', function () { q = this.value.trim(); draw(); });
    draw(); c.onRefresh(draw);
  }

  /* ---------- alerts and the weekly summary ---------- */
  function notify(m, c) {
    var esc = c.esc, N = Object.assign({ daily: true, weekly: true, calendar: true, gmail: true, telegram: true, email: '', chatId: '', chatName: '' }, c.settings().notify || {});
    c.head(m, '🔔 התראות וסיכום שבועי', 'כל בוקר: מה מחכה לך. במוצאי שבת: סיכום השבוע שעבר ומה צפוי בשבוע הבא. והאירועים ביומן גוגל עם תזכורת בטלפון.');
    m.insertAdjacentHTML('beforeend', '<section class="adm-card"><h3>🔗 החיבור ל־Maton</h3><div id="nt-st"><p class="hint">בודק…</p></div>' +
      '<details class="nt-how"><summary>איך מחברים (פעם אחת)</summary><ol>' +
      '<li>ב־GitHub של האתר: Settings ← Secrets and variables ← Actions ← New repository secret. השם: <b dir="ltr">MATON_API_KEY</b>, הערך: המפתח מ־Maton. אחר כך Actions ← "Deploy sign-in server to Cloudflare" ← Run workflow.</li>' +
      '<li>ב־<a href="https://maton.ai" target="_blank" rel="noopener">maton.ai</a> ← Connections: מחברים <b>Gmail</b> (המייל שלך), <b>Google Calendar</b>, ואם רוצים הודעות לטלפון: <b>Telegram</b> (בוט שיוצרים אצל ‎@BotFather בחינם, והטוקן שלו מוזן ב־Maton).</li>' +
      '<li>בטלגרם שולחים לבוט שלך <b dir="ltr">/start</b>, ואז כאן "🔎 מציאת הצ׳אט שלי".</li></ol><p class="hint">המפתח נשמר רק בשרת ולא מופיע באתר, בקוד או בדפדפן. WhatsApp Business דרך Maton כרוך בתשלום ל־Meta, ולכן לא מופעל.</p></details></section>' +
      '<section class="adm-card"><h3>⚙️ מה מקבלים</h3><div class="nt-sw">' +
      [['daily', '☀️ התראת בוקר (רק כשיש משהו): אירועים קרובים, בקשות שמחכות לך, הצעות שהתאריך שלהן מתקרב, יתרות לגבייה, מסמכים שפג תוקפם'], ['weekly', '📊 סיכום שבועי במוצאי שבת (אחרי 20:00)'], ['calendar', '🗓️ האירועים הסגורים ביומן גוגל, עם תזכורת יום ו־3 שעות לפני'], ['gmail', '✉️ במייל (דרך ה־Gmail שלך ב־Maton)'], ['telegram', '📱 בטלגרם (הודעה לטלפון)']]
        .map(function (x) { return '<label class="adm-chk"><input type="checkbox" data-n="' + x[0] + '"' + (N[x[0]] !== false ? ' checked' : '') + '> ' + x[1] + '</label>'; }).join('') + '</div>' +
      '<div class="adm-grid"><label class="adm-f"><span>המייל שמקבל את ההתראות</span><div class="adm-in"><input id="nt-email" type="email" dir="ltr" placeholder="devopsdevopshaim@gmail.com" value="' + esc(N.email || '') + '"></div></label>' +
      '<div class="adm-f"><span>טלגרם</span><div class="adm-row"><span id="nt-chat" class="hint">' + (N.chatId ? '✔ מחובר' + (N.chatName ? ' (' + esc(N.chatName) + ')' : '') : 'עוד לא') + '</span><button class="btn line small" id="nt-find">🔎 מציאת הצ׳אט שלי</button></div></div></div>' +
      '<div class="adm-row"><button class="btn gold" id="nt-save">💾 שמירה</button></div></section>' +
      '<section class="adm-card"><h3>▶️ עכשיו</h3><div class="adm-row nt-act"><button class="btn line" data-pv="daily">👁 תצוגת התראת הבוקר</button><button class="btn line" data-pv="weekly">👁 תצוגת הסיכום השבועי</button>' +
      '<button class="btn gold" data-send="daily">📤 לשלוח את התראת הבוקר</button><button class="btn gold" data-send="weekly">📤 לשלוח את הסיכום השבועי</button><button class="btn line" data-send="calendar">🗓️ סנכרון היומן עכשיו</button></div><pre id="nt-pv" class="nt-pv" hidden></pre></section>');
    function when(t) { return t ? new Date(t).toLocaleString('he-IL') : '—'; }
    function status() {
      ACC.call('notify-status').then(function (r) {
        if (!r.ok) { $('#nt-st').innerHTML = '<p class="hint">' + esc(ACC.msg(r)) + '</p>'; return; }
        var a = r.apps || {}, S = r.state || {}, row = function (k, label) { var x = a[k]; return '<li>' + (x ? (x.ok ? '✅ ' : '⚠️ ') : '➖ ') + label + (x && x.ok && x.who ? ' <small dir="ltr">(' + esc(x.who) + ')</small>' : '') + (x && !x.ok ? ' <small class="hint">לא מחובר ב־Maton (' + esc(String(x.error || '').slice(0, 60)) + ')</small>' : '') + '</li>'; };
        $('#nt-st').innerHTML = (r.maton ? '<p class="adm-by">✅ מפתח Maton מוגדר בשרת.</p><ul class="nt-apps">' + row('gmail', 'Gmail') + row('calendar', 'Google Calendar') + row('telegram', 'Telegram') + '</ul>' : '<p class="note-warn">⚠️ עוד אין מפתח Maton בשרת. בינתיים ההתראות והסיכום יוצאים במייל של השרת, בלי טלגרם ובלי יומן. ההוראות למטה.</p>') +
          '<p class="hint">התראת בוקר אחרונה: ' + when((S.last_daily || {}).at) + ((S.last_daily || {}).via ? ' (' + esc(S.last_daily.via.join(', ')) + ')' : '') + ' · סיכום שבועי אחרון: ' + when((S.last_weekly || {}).at) + ' · יומן: ' + (S.cal ? S.cal.n + ' אירועים, עודכן ' + when(S.calAt) : '—') + '</p>';
      });
    }
    function save() {
      $$('[data-n]').forEach(function (cb) { N[cb.dataset.n] = cb.checked; }); N.email = $('#nt-email').value.trim();
      if (N.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(N.email)) { FS.toast('המייל לא תקין'); return Promise.resolve(false); }
      var s = Object.assign({}, c.settings(), { notify: N });
      return ACC.call('settings-save', { settings: s }).then(function (r) { if (!r.ok) { FS.toast(ACC.msg(r)); return false; } c.setSettings(s); return true; });
    }
    $('#nt-save').addEventListener('click', function () { save().then(function (ok) { if (ok) FS.toast('✔ נשמר'); }); });
    $('#nt-find').addEventListener('click', function () {
      var b = this; b.disabled = true;
      ACC.call('notify-tg-find').then(function (r) {
        b.disabled = false;
        if (!r.ok) return FS.toast(r.error === 'no-chat' ? 'לא מצאתי הודעה לבוט. שולחים לבוט בטלגרם /start ומנסים שוב.' : r.error === 'no-maton-key' ? 'קודם מגדירים את מפתח Maton בשרת.' : 'טלגרם לא מחובר ב־Maton (' + (r.error || '') + ')', 7000);
        N.chatId = r.chatId; N.chatName = r.name || ''; $('#nt-chat').textContent = '✔ מחובר' + (N.chatName ? ' (' + N.chatName + ')' : '');
        save().then(function (ok) { if (ok) FS.toast('✔ טלגרם מחובר. "לשלוח את התראת הבוקר" כדי לבדוק.', 6000); });
      });
    });
    $$('[data-pv]').forEach(function (b) { b.addEventListener('click', function () {
      ACC.call('notify-preview', { kind: b.dataset.pv }).then(function (r) {
        var pv = $('#nt-pv'); pv.hidden = false;
        pv.textContent = !r.ok ? ACC.msg(r) : (r.messages || []).length ? r.messages.map(function (x) { return x.subject + '\n\n' + x.text; }).join('\n\n———\n\n') : 'אין כרגע משהו להתריע עליו.';
      });
    }); });
    $$('[data-send]').forEach(function (b) { b.addEventListener('click', function () {
      b.disabled = true;
      save().then(function () { return ACC.call('notify-send', { kind: b.dataset.send }); }).then(function (r) {
        b.disabled = false;
        if (!r || !r.ok) return FS.toast(ACC.msg(r || {}), 6000);
        if (b.dataset.send === 'calendar') { var cl = r.calendar; FS.toast(cl ? '🗓️ היומן עודכן: ' + cl.created + ' נוספו, ' + cl.updated + ' עודכנו, ' + cl.removed + ' הוסרו' + (cl.errors && cl.errors.length ? ' · ⚠️ ' + cl.errors[0] : '') : 'סנכרון יומן דורש מפתח Maton וחיבור Google Calendar.', 8000); }
        else { var s = (r.sent || {})[b.dataset.send]; FS.toast(s && s.sent ? '✔ נשלח (' + s.via.join(', ') + ')' + (Object.keys(s.errors || {}).length ? ' · ⚠️ ' + Object.keys(s.errors).join(', ') + ' לא עבר' : '') : '⚠️ לא נשלח: ' + JSON.stringify((s || {}).errors || {}).slice(0, 120), 8000); }
        status();
      }, function () { b.disabled = false; });
    }); });
    status();
  }
  FS.adminNotify = { docs: docs, notify: notify };
})();
