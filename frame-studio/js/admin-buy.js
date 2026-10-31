/* Purchases, expenses, suppliers and the weekly backup.
   - Expenses and purchases: from which supplier, what was bought (magnet paper, a ribbon for a given printer, ink …), how many,
     at what unit price, the invoice number and a photo of the receipt (taken with the phone or the computer's camera, made
     small here and kept on the server). Summaries by category, by supplier and per item (the price list: what each thing cost,
     where, last time and on average).
   - Suppliers: who sells what, how to reach them, the terms, and what was bought from each.
   - Backup: one Excel file with tidy tabs (summary, income, expenses, by category, by supplier, items, suppliers, deals,
     licences, payments to the authorities), or a full ZIP (the Excel file, every receipt photo and all the data). The home
     screen reminds the owner when a week passed since the last one. */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$, ACC = FS.account;
  var UNITS = ['יח׳', 'גיליון', 'חבילה', 'גליל', 'ריבון', 'קרטון', 'ליטר', 'שעה', 'חודש'];
  var ITEMS = ['נייר מגנטי A4', 'נייר מגנטי 10×15', 'ריבון למדפסת', 'דיו / טונר', 'נייר צילום', 'למינציה', 'שקיות / מעטפות', 'מסגרות תצוגה'];
  var supFilter = '';                                       /* "רכישות" on a supplier opens the expenses of that supplier */
  function uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function printerish(s) { return /ריבון|דיו|טונר|מדפסת|ribbon|ink|toner/i.test(s || ''); }
  /* a photo or a scan, made small enough to keep: at most 1600 px, JPEG */
  function shrink(file) {
    return new Promise(function (ok, no) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var r = Math.min(1, 1600 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
        cv.width = Math.round(img.width * r); cv.height = Math.round(img.height * r);
        var g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        var q = 0.75, d = cv.toDataURL('image/jpeg', q); while (d.length > 2300000 && q > 0.3) { q -= 0.15; d = cv.toDataURL('image/jpeg', q); }
        ok(d);
      };
      img.onerror = function () { URL.revokeObjectURL(url); no(new Error('not-image')); };
      img.src = url;
    });
  }
  function showPhoto(id, title) {
    var b = FS.dialog('📷 ' + (title || 'קבלה'), '<p class="hint">טוען…</p>', true);
    ACC.call('receipt-get', { id: id }).then(function (r) {
      if (!r.ok) { b.innerHTML = '<p class="hint">' + FS.esc(ACC.msg(r)) + '</p>'; return; }
      b.innerHTML = '<img src="' + r.data + '" alt="קבלה" style="max-width:100%;max-height:70vh;display:block;margin:0 auto;border-radius:8px"><div class="adm-row"><a class="btn line small" download="קבלה-' + FS.esc(id) + '.jpg" href="' + r.data + '">⬇️ הורדה</a></div>';
    });
  }

  /* ---------- expenses and purchases ---------- */
  function expenses(m, c) {
    var B = FS.adminBiz, esc = c.esc, num = B.num, money = B.money, MONTHS = B.MONTHS, CATS = B.CATS, heDate = B.heDate;
    var today = new Date().toISOString().slice(0, 10), ym = today.slice(0, 7), cat = '', q = '', sup = supFilter, editing = null, photo = null; supFilter = '';
    c.head(m, '💸 הוצאות ורכישות', 'כל הוצאה ורכישה: מאיזה ספק, מה, כמה, באיזה מחיר, לאיזו מדפסת, עם מספר החשבונית וצילום הקבלה. נשמר בשרת.');
    function sups() { return (c.suppliers() || []).slice().sort(function (a, b) { return a.name < b.name ? -1 : 1; }); }
    function known(k) { var o = {}; c.expenses().forEach(function (e) { if (e[k]) o[e[k]] = 1; }); return Object.keys(o); }
    m.insertAdjacentHTML('beforeend', '<section class="adm-card" id="ex-form"><h3 id="ex-h">＋ רכישה / הוצאה חדשה</h3><div class="adm-grid">' +
      '<label class="adm-f"><span>תאריך</span><div class="adm-in"><input type="date" id="ex-date" value="' + today + '"></div></label>' +
      '<label class="adm-f"><span>ספק</span><div class="adm-in"><select id="ex-sup"></select></div></label>' +
      '<label class="adm-f"><span>קטגוריה</span><div class="adm-in"><select id="ex-cat">' + CATS.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('') + '</select></div></label>' +
      '<label class="adm-f"><span>פריט</span><div class="adm-in"><input id="ex-item" list="ex-items" placeholder="נייר מגנטי A4"></div></label>' +
      '<label class="adm-f"><span>כמות</span><div class="adm-in"><input type="number" id="ex-qty" step="0.01" min="0"></div></label>' +
      '<label class="adm-f"><span>יחידה</span><div class="adm-in"><select id="ex-unit">' + UNITS.map(function (u) { return '<option>' + u + '</option>'; }).join('') + '</select></div></label>' +
      '<label class="adm-f"><span>מחיר ליחידה ₪</span><div class="adm-in"><input type="number" id="ex-up" step="0.01" min="0"></div></label>' +
      '<label class="adm-f"><span>סה״כ ₪</span><div class="adm-in"><input type="number" id="ex-amt" step="0.01" min="0"></div></label>' +
      '<label class="adm-f" id="ex-prn-f" hidden><span>🖨️ לאיזו מדפסת</span><div class="adm-in"><input id="ex-prn" list="ex-prns" placeholder="למשל DNP DS620 / Mitsubishi CP-D80"></div></label>' +
      '<label class="adm-f"><span>מס׳ חשבונית / קבלה</span><div class="adm-in"><input id="ex-ref"></div></label>' +
      '<label class="adm-f"><span>תיאור / הערה</span><div class="adm-in"><input id="ex-desc" placeholder="לא חובה כשיש פריט"></div></label></div>' +
      '<datalist id="ex-items"></datalist><datalist id="ex-prns"></datalist>' +
      '<div class="adm-row"><label class="adm-chk"><input type="checkbox" id="ex-vat" checked> הסכום כולל מע״מ (חשבונית מס)</label>' +
      '<label class="btn line small bu-cam">📷 צילום הקבלה<input type="file" id="ex-photo" accept="image/*" capture="environment" hidden></label><span id="ex-ph" class="hint"></span></div>' +
      '<div class="adm-row"><button class="btn gold" id="ex-add">＋ שמירה</button><button class="btn line" id="ex-cancel" hidden>ביטול עריכה</button></div></section>' +
      '<div class="adm-row bu-filter"><input type="month" id="ex-month" value="' + ym + '"><select id="ex-fcat"><option value="">כל הקטגוריות</option>' + CATS.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('') + '</select>' +
      '<select id="ex-fsup"></select><input id="ex-q" placeholder="חיפוש פריט / ספק / מדפסת"><label class="adm-chk"><input type="checkbox" id="ex-all"> כל החודשים</label><span id="ex-sum" class="adm-by"></span></div>' +
      '<div id="ex-list"></div><div class="tx-two" id="ex-sums"></div><section class="adm-card"><h3>🏷️ מחירון: מה עלה כל פריט</h3><p class="hint">מכל הרכישות שנרשמו עם פריט וכמות: כמה נקנה, מחיר ממוצע ליחידה, המחיר והספק בפעם האחרונה, והספק הזול ביותר.</p><div id="ex-items-t"></div></section>');
    function fill() {
      $('#ex-sup').innerHTML = '<option value="">— בלי ספק מהרשימה —</option>' + sups().map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>'; }).join('') + '<option value="+">＋ ספק חדש…</option>';
      $('#ex-fsup').innerHTML = '<option value="">כל הספקים</option>' + sups().map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === sup ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('');
      $('#ex-items').innerHTML = ITEMS.concat(known('item')).filter(function (x, i, a) { return a.indexOf(x) === i; }).map(function (x) { return '<option value="' + esc(x) + '">'; }).join('');
      $('#ex-prns').innerHTML = known('printer').map(function (x) { return '<option value="' + esc(x) + '">'; }).join('');
    }
    function supName(e) { var s = (c.suppliers() || []).filter(function (x) { return x.id === e.supId; })[0]; return s ? s.name : e.supplier || ''; }
    function list() {
      return c.expenses().filter(function (e) {
        if (!$('#ex-all').checked && String(e.date).slice(0, 7) !== ym) return false;
        if (cat && e.cat !== cat) return false; if (sup && e.supId !== sup) return false;
        if (q) { var t = [e.desc, e.item, supName(e), e.printer, e.ref, e.note].join(' ').toLowerCase(); if (t.indexOf(q.toLowerCase()) < 0) return false; }
        return true;
      }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    }
    function sumTable(title, obj) { var ks = Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; }); return '<section class="adm-card"><h3>' + title + '</h3>' + (ks.length ? '<table class="adm-tbl"><tbody>' + ks.map(function (k) { return '<tr><td>' + esc(k) + '</td><td>' + money(obj[k]) + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="hint">—</p>') + '</section>'; }
    function draw() {
      var l = list(), tot = l.reduce(function (s, e) { return s + num(e.amount); }, 0), byCat = {}, bySup = {};
      l.forEach(function (e) { byCat[e.cat || 'אחר'] = (byCat[e.cat || 'אחר'] || 0) + num(e.amount); var sn = supName(e) || 'בלי ספק'; bySup[sn] = (bySup[sn] || 0) + num(e.amount); });
      $('#ex-sum').innerHTML = (l.length ? l.length + ' רשומות · ' : '') + 'סה״כ: <b>' + money(tot) + '</b>' + ($('#ex-all').checked ? '' : ' ב' + MONTHS[Number(ym.slice(5, 7)) - 1]);
      $('#ex-list').innerHTML = l.length ? '<div class="vis-scroll"><table class="adm-tbl"><thead><tr><th>תאריך</th><th>מה</th><th>ספק</th><th>כמות × מחיר</th><th>קטגוריה</th><th>סכום</th><th>קבלה</th><th></th></tr></thead><tbody>' + l.map(function (e) {
        return '<tr data-id="' + esc(e.id) + '"><td>' + heDate(e.date) + '</td><td><b>' + esc(e.item || e.desc) + '</b>' + (e.item && e.desc ? '<small>' + esc(e.desc) + '</small>' : '') + (e.printer ? '<small>🖨️ ' + esc(e.printer) + '</small>' : '') + '</td><td>' + esc(supName(e)) + '</td>' +
          '<td>' + (e.qty ? esc(e.qty) + ' ' + esc(e.unit || '') + (e.unitPrice ? ' × ' + money(e.unitPrice) : '') : '—') + '</td><td>' + esc(e.cat) + '</td><td>' + money(e.amount) + (e.vat ? '<small>כולל מע״מ</small>' : '') + '</td>' +
          '<td>' + (e.photo ? '<button class="link" data-a="ph" title="צילום הקבלה">📷</button>' : '') + (e.ref ? '<small>' + esc(e.ref) + '</small>' : (e.photo ? '' : '<small class="tx-warn">חסר מסמך</small>')) + '</td>' +
          '<td class="act"><button data-a="edit" title="עריכה / הוספת צילום">✏️</button><button data-a="del" title="מחיקה">🗑</button></td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="hint">אין רשומות להצגה.</p>';
      $('#ex-sums').innerHTML = sumTable('לפי קטגוריה', byCat) + sumTable('לפי ספק', bySup);
      $$('#ex-list tr[data-id]').forEach(function (tr) {
        var e = c.expenses().filter(function (x) { return x.id === tr.dataset.id; })[0]; if (!e) return;
        var ph = $('[data-a=ph]', tr); if (ph) ph.addEventListener('click', function () { showPhoto(e.id, (e.item || e.desc) + ' · ' + heDate(e.date)); });
        $('[data-a=edit]', tr).addEventListener('click', function () { edit(e); });
        $('[data-a=del]', tr).addEventListener('click', function () { if (!confirm('למחוק את ההוצאה' + (e.photo ? ' ואת צילום הקבלה' : '') + '?')) return; ACC.call('expense-del', { id: e.id }).then(function (r) { if (!r.ok) return FS.toast(ACC.msg(r)); c.setExpenses(c.expenses().filter(function (x) { return x.id !== e.id; })); draw(); }); });
      });
      items();
    }
    /* the price list per item, over every purchase */
    function items() {
      var by = {};
      c.expenses().filter(function (e) { return e.item && num(e.qty) > 0; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }).forEach(function (e) {
        var k = e.item + (e.printer ? ' · ' + e.printer : ''), x = by[k] = by[k] || { qty: 0, amt: 0, n: 0, unit: e.unit, best: null };
        var up = num(e.unitPrice) || num(e.amount) / num(e.qty);
        x.qty += num(e.qty); x.amt += num(e.amount); x.n++; x.last = { date: e.date, up: up, sup: supName(e) };
        if (!x.best || up < x.best.up) x.best = { up: up, sup: supName(e) };
      });
      var ks = Object.keys(by).sort();
      $('#ex-items-t').innerHTML = ks.length ? '<div class="vis-scroll"><table class="adm-tbl"><thead><tr><th>פריט</th><th>רכישות</th><th>כמות</th><th>ממוצע ליחידה</th><th>בפעם האחרונה</th><th>הזול ביותר</th></tr></thead><tbody>' + ks.map(function (k) {
        var x = by[k]; return '<tr><td><b>' + esc(k) + '</b></td><td>' + x.n + '</td><td>' + esc(Math.round(x.qty * 100) / 100) + ' ' + esc(x.unit || '') + '</td><td>' + money(x.amt / x.qty) + '</td><td>' + money(x.last.up) + '<small>' + heDate(x.last.date) + (x.last.sup ? ' · ' + esc(x.last.sup) : '') + '</small></td><td>' + money(x.best.up) + (x.best.sup ? '<small>' + esc(x.best.sup) + '</small>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="hint">כשרושמים רכישה עם פריט, כמות ומחיר ליחידה, המחירון נבנה כאן.</p>';
    }
    function calc(from) { var qv = num($('#ex-qty').value), up = num($('#ex-up').value), am = num($('#ex-amt').value); if (from !== 'amt' && qv > 0 && up > 0) $('#ex-amt').value = Math.round(qv * up * 100) / 100; else if (from === 'amt' && qv > 0 && am > 0 && !up) $('#ex-up').placeholder = (Math.round(am / qv * 100) / 100) + ''; }
    function prn() { $('#ex-prn-f').hidden = !(printerish($('#ex-item').value) || printerish($('#ex-cat').value) || $('#ex-prn').value); }
    function reset() { editing = null; photo = null; $('#ex-h').textContent = '＋ רכישה / הוצאה חדשה'; $('#ex-cancel').hidden = true; $('#ex-add').textContent = '＋ שמירה'; ['#ex-item', '#ex-qty', '#ex-up', '#ex-amt', '#ex-prn', '#ex-ref', '#ex-desc'].forEach(function (s) { $(s).value = ''; }); $('#ex-ph').textContent = ''; $('#ex-photo').value = ''; prn(); }
    function edit(e) {
      editing = e; photo = null; $('#ex-h').textContent = '✏️ עריכה: ' + (e.item || e.desc); $('#ex-cancel').hidden = false; $('#ex-add').textContent = '💾 שמירת השינויים';
      $('#ex-date').value = e.date; $('#ex-sup').value = e.supId || ''; $('#ex-cat').value = e.cat || CATS[CATS.length - 1]; $('#ex-item').value = e.item || ''; $('#ex-qty').value = e.qty || ''; $('#ex-unit').value = e.unit || UNITS[0];
      $('#ex-up').value = e.unitPrice || ''; $('#ex-amt').value = e.amount || ''; $('#ex-prn').value = e.printer || ''; $('#ex-ref').value = e.ref || ''; $('#ex-desc').value = e.desc || ''; $('#ex-vat').checked = !!e.vat;
      $('#ex-ph').textContent = e.photo ? '📷 יש צילום. צילום חדש יחליף אותו.' : ''; prn();
      $('#ex-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    $('#ex-qty').addEventListener('input', function () { calc('qty'); }); $('#ex-up').addEventListener('input', function () { calc('up'); }); $('#ex-amt').addEventListener('input', function () { calc('amt'); });
    $('#ex-item').addEventListener('input', function () { prn(); if (/מגנט/.test(this.value)) $('#ex-cat').value = CATS[0]; if (printerish(this.value)) $('#ex-cat').value = CATS[0]; });
    $('#ex-cat').addEventListener('change', prn);
    $('#ex-sup').addEventListener('change', function () {
      if (this.value !== '+') return; this.value = '';
      var n = window.prompt('שם הספק החדש (את שאר הפרטים ממלאים ב"🏪 ספקים"):'); if (!n || !n.trim()) return;
      var s = { id: uid('s'), name: n.trim() };
      ACC.call('supplier-save', { supplier: s }).then(function (r) { if (!r.ok) return FS.toast(ACC.msg(r)); c.setSuppliers((c.suppliers() || []).concat([r.supplier])); fill(); $('#ex-sup').value = r.supplier.id; });
    });
    $('#ex-photo').addEventListener('change', function () {
      var f = this.files && this.files[0]; if (!f) return; $('#ex-ph').textContent = 'מכין…';
      shrink(f).then(function (d) { photo = d; $('#ex-ph').innerHTML = '<img src="' + d + '" alt="" style="height:44px;border-radius:6px;vertical-align:middle"> ✔ מוכן (' + Math.round(d.length * 0.75 / 1024) + ' KB)'; }, function () { $('#ex-ph').textContent = 'הקובץ הזה לא תמונה.'; });
    });
    $('#ex-cancel').addEventListener('click', reset);
    $('#ex-add').addEventListener('click', function () {
      var sid = $('#ex-sup').value, s = (c.suppliers() || []).filter(function (x) { return x.id === sid; })[0];
      var e = { id: editing ? editing.id : 'e' + (FS.uid ? FS.uid() : uid('')), date: $('#ex-date').value, supId: sid, supplier: s ? s.name : (editing && !sid ? editing.supplier : ''), cat: $('#ex-cat').value,
        item: $('#ex-item').value.trim(), qty: num($('#ex-qty').value), unit: $('#ex-unit').value, unitPrice: num($('#ex-up').value), amount: num($('#ex-amt').value),
        printer: $('#ex-prn').value.trim(), ref: $('#ex-ref').value.trim(), desc: $('#ex-desc').value.trim(), vat: $('#ex-vat').checked };
      if (!e.desc) e.desc = e.item; if (!e.unitPrice && e.qty > 0 && e.amount > 0) e.unitPrice = Math.round(e.amount / e.qty * 100) / 100;
      if (!e.desc || !(e.amount > 0)) return FS.toast('פריט או תיאור, וסכום');
      var b = $('#ex-add'); b.disabled = true;
      ACC.call('expense-save', { expense: e }).then(function (r) {
        if (!r.ok) { b.disabled = false; return FS.toast(ACC.msg(r)); }
        var row = r.expense;
        return (photo ? ACC.call('receipt-put', { id: row.id, data: photo }).then(function (p) { if (p.ok) row = p.expense; else FS.toast('ההוצאה נשמרה, הצילום לא (' + ACC.msg(p) + ')', 6000); }) : Promise.resolve()).then(function () {
          b.disabled = false;
          c.setExpenses(c.expenses().filter(function (x) { return x.id !== row.id; }).concat([row]));
          ym = row.date.slice(0, 7); $('#ex-month').value = ym; reset(); fill(); draw(); FS.toast('✔ נשמר' + (row.photo ? ' עם צילום הקבלה' : ''));
        });
      }, function () { b.disabled = false; FS.toast('אין חיבור לשרת'); });
    });
    $('#ex-month').addEventListener('change', function () { if (this.value) { ym = this.value; draw(); } });
    $('#ex-fcat').addEventListener('change', function () { cat = this.value; draw(); });
    $('#ex-fsup').addEventListener('change', function () { sup = this.value; draw(); });
    $('#ex-q').addEventListener('input', function () { q = this.value.trim(); draw(); });
    $('#ex-all').addEventListener('change', draw);
    if (sup) $('#ex-all').checked = true;
    fill(); prn(); draw();
    c.onRefresh(function () { fill(); draw(); });
  }

  /* ---------- suppliers ---------- */
  function suppliers(m, c) {
    var esc = c.esc, B = FS.adminBiz, money = B.money, num = B.num, heDate = B.heDate, editing = null, y = String(new Date().getFullYear());
    c.head(m, '🏪 ספקים', 'כל הספקים: מה קונים מכל אחד, איך משיגים אותו, התנאים, וכמה קנית ממנו.');
    m.insertAdjacentHTML('beforeend', '<section class="adm-card" id="su-form"><h3 id="su-h">＋ ספק חדש</h3><div class="adm-grid">' +
      [['name', 'שם הספק *', 'מגנטים ישראל בע״מ'], ['contact', 'איש קשר', ''], ['phone', 'טלפון', '05X-XXXXXXX'], ['email', 'מייל', ''], ['site', 'אתר / חנות (https)', 'https://…'], ['items', 'מה קונים ממנו', 'נייר מגנטי, ריבונים ל־DNP'],
        ['cat', 'קטגוריה עיקרית', ''], ['terms', 'תנאים (תשלום, משלוח, מינימום)', 'שוטף+30, משלוח חינם מעל ₪500']].map(function (f) { return '<label class="adm-f"><span>' + f[1] + '</span><div class="adm-in"><input id="su-' + f[0] + '" placeholder="' + esc(f[2]) + '"' + (f[0] === 'cat' ? ' list="su-cats"' : '') + '></div></label>'; }).join('') +
      '<label class="adm-f wide"><span>הערות</span><div class="adm-in"><textarea id="su-notes" rows="2"></textarea></div></label></div><datalist id="su-cats">' + B.CATS.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>' +
      '<div class="adm-row"><button class="btn gold" id="su-save">＋ שמירה</button><button class="btn line" id="su-cancel" hidden>ביטול עריכה</button></div></section><div id="su-list" class="bu-sups"></div>');
    function stats(s) {
      var l = c.expenses().filter(function (e) { return e.supId === s.id || (!e.supId && e.supplier && e.supplier === s.name); }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
      return { n: l.length, all: l.reduce(function (t, e) { return t + num(e.amount); }, 0), year: l.filter(function (e) { return String(e.date).slice(0, 4) === y; }).reduce(function (t, e) { return t + num(e.amount); }, 0), last: l[0], items: l.map(function (e) { return e.item; }).filter(function (x, i, a) { return x && a.indexOf(x) === i; }).slice(0, 6) };
    }
    function draw() {
      var l = (c.suppliers() || []).slice().sort(function (a, b) { return a.name < b.name ? -1 : 1; });
      $('#su-list').innerHTML = l.length ? l.map(function (s) {
        var st = stats(s), wa = s.phone ? 'https://wa.me/' + String(s.phone).replace(/\D/g, '').replace(/^0/, '972') : '';
        return '<section class="adm-card" data-id="' + esc(s.id) + '"><div class="adm-card-h"><h3>' + esc(s.name) + (s.cat ? ' <small class="hint">' + esc(s.cat) + '</small>' : '') + '</h3><span class="bu-acts"><button data-a="buys" title="הרכישות מהספק">🧾</button><button data-a="edit" title="עריכה">✏️</button><button data-a="del" title="מחיקה">🗑</button></span></div>' +
          '<p>' + [s.contact ? '👤 ' + esc(s.contact) : '', s.phone ? '<a href="tel:' + esc(s.phone) + '">📞 ' + esc(s.phone) + '</a> · <a target="_blank" rel="noopener" href="' + esc(wa) + '">💬</a>' : '', s.email ? '<a href="mailto:' + esc(s.email) + '">✉️ ' + esc(s.email) + '</a>' : '', s.site ? '<a target="_blank" rel="noopener" href="' + esc(s.site) + '">🌐 אתר</a>' : ''].filter(Boolean).join(' · ') + '</p>' +
          (s.items ? '<p>📦 ' + esc(s.items) + '</p>' : '') + (s.terms ? '<p class="hint">📄 ' + esc(s.terms) + '</p>' : '') + (s.notes ? '<p class="hint">' + esc(s.notes) + '</p>' : '') +
          '<p class="adm-by">' + st.n + ' רכישות · השנה ' + money(st.year) + ' · סה״כ ' + money(st.all) + (st.last ? ' · אחרונה ' + heDate(st.last.date) + ' (' + esc(st.last.item || st.last.desc) + ', ' + money(st.last.amount) + ')' : '') + '</p>' +
          (st.items.length ? '<p class="hint">נקנה: ' + st.items.map(esc).join(' · ') + '</p>' : '') + '</section>';
      }).join('') : '<p class="hint">עוד אין ספקים. מוסיפים כאן, או ישר מטופס ההוצאה ("＋ ספק חדש…").</p>';
      $$('#su-list [data-id]').forEach(function (card) {
        var s = (c.suppliers() || []).filter(function (x) { return x.id === card.dataset.id; })[0];
        $('[data-a=buys]', card).addEventListener('click', function () { supFilter = s.id; c.go('expenses'); });
        $('[data-a=edit]', card).addEventListener('click', function () { editing = s; ['name', 'contact', 'phone', 'email', 'site', 'items', 'cat', 'terms', 'notes'].forEach(function (k) { $('#su-' + k).value = s[k] || ''; }); $('#su-h').textContent = '✏️ עריכה: ' + s.name; $('#su-save').textContent = '💾 שמירה'; $('#su-cancel').hidden = false; $('#su-form').scrollIntoView({ behavior: 'smooth' }); });
        $('[data-a=del]', card).addEventListener('click', function () { if (!confirm('למחוק את הספק ' + s.name + '? הרכישות ממנו נשארות.')) return; ACC.call('supplier-del', { id: s.id }).then(function (r) { if (!r.ok) return FS.toast(ACC.msg(r)); c.setSuppliers(c.suppliers().filter(function (x) { return x.id !== s.id; })); draw(); }); });
      });
    }
    function reset() { editing = null; ['name', 'contact', 'phone', 'email', 'site', 'items', 'cat', 'terms', 'notes'].forEach(function (k) { $('#su-' + k).value = ''; }); $('#su-h').textContent = '＋ ספק חדש'; $('#su-save').textContent = '＋ שמירה'; $('#su-cancel').hidden = true; }
    $('#su-cancel').addEventListener('click', reset);
    $('#su-save').addEventListener('click', function () {
      var s = { id: editing ? editing.id : uid('s') }; ['name', 'contact', 'phone', 'email', 'site', 'items', 'cat', 'terms', 'notes'].forEach(function (k) { s[k] = $('#su-' + k).value.trim(); });
      if (!s.name) return FS.toast('שם הספק'); if (s.site && !/^https:\/\//i.test(s.site)) return FS.toast('כתובת האתר מתחילה ב־https://');
      ACC.call('supplier-save', { supplier: s }).then(function (r) { if (!r.ok) return FS.toast(ACC.msg(r)); c.setSuppliers((c.suppliers() || []).filter(function (x) { return x.id !== s.id; }).concat([r.supplier])); reset(); draw(); FS.toast('✔ נשמר'); });
    });
    draw(); c.onRefresh(draw);
  }

  /* ---------- backup: Excel with tabs, or everything in a ZIP ---------- */
  function sheets(c, lic) {
    var B = FS.adminBiz, num = B.num, st = c.settings(), MET = B.METHODS, r2 = function (v) { return Math.round(num(v) * 100) / 100; };
    var sups = c.suppliers() || [], supName = function (e) { var s = sups.filter(function (x) { return x.id === e.supId; })[0]; return s ? s.name : e.supplier || ''; };
    var exps = c.expenses().slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }), deals = c.deals().slice().sort(function (a, b) { return (a.date || '') < (b.date || '') ? -1 : 1; });
    var inc = [];
    deals.forEach(function (d) { (d.payments || []).forEach(function (p) { inc.push([p.date || '', 'מגנטים', p.no || '', d.no || '', (d.client || {}).name || '', MET[p.method] || p.method || '', p.ref || '', r2(p.amount)]); }); });
    (lic || []).forEach(function (L) { (L.payments || []).forEach(function (p) { inc.push([p.date || String(p.at || '').slice(0, 10), 'אופטימוס', p.receipt ? 'קבלה ' + p.receipt : '', '', L.name || L.email, p.method || '', p.ref || '', r2(p.amount)]); }); });
    inc.sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
    /* the summary: per month, from the first month with anything to this one */
    var months = {}; inc.forEach(function (r) { if (r[0]) months[r[0].slice(0, 7)] = 1; }); exps.forEach(function (e) { if (e.date) months[e.date.slice(0, 7)] = 1; });
    var sum = [['חודש', 'הכנסות', 'הוצאות', 'רווח', 'מספר תקבולים', 'מספר הוצאות']];
    Object.keys(months).sort().forEach(function (k) { var i = inc.filter(function (r) { return r[0].slice(0, 7) === k; }), e = exps.filter(function (x) { return String(x.date).slice(0, 7) === k; }), a = i.reduce(function (s, r) { return s + r[7]; }, 0), b = e.reduce(function (s, x) { return s + num(x.amount); }, 0); sum.push([k, r2(a), r2(b), r2(a - b), i.length, e.length]); });
    var tI = inc.reduce(function (s, r) { return s + r[7]; }, 0), tE = exps.reduce(function (s, e) { return s + num(e.amount); }, 0);
    sum.push([]); sum.push(['סה״כ', r2(tI), r2(tE), r2(tI - tE), inc.length, exps.length]);
    var catY = {}, years = {}; exps.forEach(function (e) { var y = String(e.date).slice(0, 4), k = e.cat || 'אחר'; years[y] = 1; catY[k] = catY[k] || {}; catY[k][y] = (catY[k][y] || 0) + num(e.amount); });
    var ys = Object.keys(years).sort(), cat = [['קטגוריה'].concat(ys).concat(['סה״כ'])];
    Object.keys(catY).sort().forEach(function (k) { var row = [k], t = 0; ys.forEach(function (y) { var v = r2(catY[k][y] || 0); t += v; row.push(v); }); row.push(r2(t)); cat.push(row); });
    var supT = {}; exps.forEach(function (e) { var k = supName(e) || 'בלי ספק', x = supT[k] = supT[k] || { n: 0, amt: 0, last: '', items: {} }; x.n++; x.amt += num(e.amount); if (e.date > x.last) x.last = e.date; if (e.item) x.items[e.item] = 1; });
    var bySup = [['ספק', 'רכישות', 'סה״כ', 'רכישה אחרונה', 'פריטים']]; Object.keys(supT).sort().forEach(function (k) { var x = supT[k]; bySup.push([k, x.n, r2(x.amt), x.last, Object.keys(x.items).join(', ')]); });
    var it = {}; exps.filter(function (e) { return e.item && num(e.qty) > 0; }).forEach(function (e) { var k = e.item + (e.printer ? ' · ' + e.printer : ''), x = it[k] = it[k] || { q: 0, a: 0, n: 0, unit: e.unit, min: Infinity, minS: '', last: null }; var up = num(e.unitPrice) || num(e.amount) / num(e.qty); x.q += num(e.qty); x.a += num(e.amount); x.n++; if (up < x.min) { x.min = up; x.minS = supName(e); } if (!x.last || e.date >= x.last.date) x.last = { date: e.date, up: up, s: supName(e) }; });
    var items = [['פריט', 'יחידה', 'רכישות', 'כמות', 'סה״כ ₪', 'ממוצע ליחידה', 'מחיר אחרון', 'ספק אחרון', 'תאריך אחרון', 'הזול ביותר', 'ספק זול']];
    Object.keys(it).sort().forEach(function (k) { var x = it[k]; items.push([k, x.unit || '', x.n, r2(x.q), r2(x.a), r2(x.a / x.q), r2(x.last.up), x.last.s, x.last.date, r2(x.min), x.minS]); });
    var dealRows = [['מס׳', 'תאריך אירוע', 'לקוח', 'טלפון', 'מייל', 'אירוע', 'מקום', 'סה״כ', 'שולם', 'יתרה', 'מצב']];
    deals.forEach(function (d) { var t = B.totals(d, st), cl = d.client || {}; dealRows.push([d.no || '', d.date || '', cl.name || '', cl.phone || '', cl.email || '', d.typeName || d.type || '', d.venue || '', r2(t.total), r2(t.paid), r2(t.balance), d.cancelled ? 'בוטל' : d.closed ? 'סגור' : 'הצעה']); });
    var licRows = [['שם', 'מייל', 'טלפון', 'תוכנית', 'שולם', 'תשלומים ₪', 'נוצר', 'שימוש אחרון']];
    (lic || []).forEach(function (L) { licRows.push([L.name || '', L.email, L.phone || '', (L.plan && L.plan.tier) || '', L.paid ? 'כן' : 'לא', r2((L.payments || []).reduce(function (s, p) { return s + num(p.amount); }, 0)), String(L.createdAt || '').slice(0, 10), String(L.lastSeen || '').slice(0, 10)]); });
    var tax = ((st.tax || {}).paid || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }), taxRows = [['תאריך', 'סוג', 'תקופה', 'אסמכתא', 'סכום']];
    tax.forEach(function (p) { taxRows.push([p.date, p.kind, p.period || '', p.ref || '', r2(p.amount)]); });
    var reqRows = [['מס׳', 'נשלח', 'תאריך אירוע', 'שם', 'טלפון', 'מייל', 'אירוע', 'מצב']];
    (c.requests() || []).forEach(function (q) { reqRows.push([q.ref || '', q.at ? new Date(q.at).toISOString().slice(0, 10) : '', q.date || '', q.name || '', q.phone || '', q.email || '', q.typeName || q.type || '', { pending: 'ממתין', approved: 'אושר', declined: 'נדחה' }[q.status] || q.status || '']); });
    return [
      { name: 'סיכום חודשי', rows: sum, widths: [12, 14, 14, 14, 14, 14] },
      { name: 'הכנסות', rows: [['תאריך', 'מקור', 'מס׳ קבלה/אישור', 'עסקה', 'לקוח', 'אמצעי', 'אסמכתא', 'סכום']].concat(inc), widths: [12, 11, 15, 10, 22, 14, 16, 12] },
      { name: 'הוצאות ורכישות', rows: [['תאריך', 'ספק', 'קטגוריה', 'פריט', 'תיאור', 'כמות', 'יחידה', 'מחיר ליחידה', 'סה״כ', 'כולל מע״מ', 'מדפסת', 'חשבונית/קבלה', 'צילום']].concat(exps.map(function (e) { return [e.date, supName(e), e.cat || '', e.item || '', e.desc || '', e.qty ? r2(e.qty) : '', e.unit || '', e.unitPrice ? r2(e.unitPrice) : '', r2(e.amount), e.vat ? 'כן' : '', e.printer || '', e.ref || '', e.photo ? 'כן' : '']; })), widths: [12, 20, 22, 20, 24, 9, 9, 12, 12, 10, 18, 14, 8] },
      { name: 'לפי קטגוריה', rows: cat, widths: [30] },
      { name: 'לפי ספק', rows: bySup, widths: [24, 10, 14, 14, 40] },
      { name: 'מחירון פריטים', rows: items, widths: [30, 9, 9, 10, 12, 13, 12, 18, 12, 12, 18] },
      { name: 'ספקים', rows: [['שם', 'איש קשר', 'טלפון', 'מייל', 'אתר', 'מה קונים', 'קטגוריה', 'תנאים', 'הערות']].concat(sups.map(function (s) { return [s.name, s.contact || '', s.phone || '', s.email || '', s.site || '', s.items || '', s.cat || '', s.terms || '', s.notes || '']; })), widths: [22, 16, 14, 24, 24, 30, 20, 26, 30] },
      { name: 'עסקאות', rows: dealRows, widths: [9, 12, 20, 14, 24, 16, 18, 11, 11, 11, 9] },
      { name: 'רישיונות אופטימוס', rows: licRows, widths: [20, 26, 14, 10, 7, 12, 12, 12] },
      { name: 'תשלומים לרשויות', rows: taxRows, widths: [12, 20, 22, 16, 12] },
      { name: 'בקשות הזמנה', rows: reqRows, widths: [10, 12, 12, 18, 14, 24, 16, 10] }
    ];
  }
  function backup(m, c) {
    var esc = c.esc, stamp = new Date().toISOString().slice(0, 10);
    c.head(m, '💾 גיבוי וייצוא לאקסל', 'פעם בשבוע מורידים גיבוי למחשב: קובץ אקסל מסודר בלשוניות, או גיבוי מלא עם צילומי הקבלות. הנתונים עצמם שמורים גם בשרת המאובטח.');
    function status() { var t = c.backupAt(), d = t ? Math.floor((Date.now() - t) / 864e5) : null; return t ? (d >= 7 ? '<p class="note-warn">⚠️ הגיבוי האחרון לפני ' + d + ' ימים (' + new Date(t).toLocaleString('he-IL') + '). הגיע הזמן לגיבוי השבועי.</p>' : '<p class="adm-by">✔ הגיבוי האחרון: ' + new Date(t).toLocaleString('he-IL') + ' (לפני ' + (d ? d + ' ימים' : 'פחות מיום') + '). הבא: עד ' + new Date(t + 7 * 864e5).toLocaleDateString('he-IL') + '.</p>') : '<p class="note-warn">⚠️ עוד לא הורדת גיבוי למחשב.</p>'; }
    m.insertAdjacentHTML('beforeend', '<div id="bk-st">' + status() + '</div><section class="adm-card"><h3>📊 קובץ אקסל</h3><p class="hint">לשוניות: סיכום חודשי · הכנסות (מגנטים ואופטימוס) · הוצאות ורכישות · לפי קטגוריה · לפי ספק · מחירון פריטים · ספקים · עסקאות · רישיונות אופטימוס · תשלומים לרשויות · בקשות הזמנה. כל לשונית עם כותרת קבועה וסינון.</p>' +
      '<div class="adm-row"><button class="btn gold" id="bk-x">⬇️ הורדת קובץ אקסל</button></div></section>' +
      '<section class="adm-card"><h3>🗂️ גיבוי מלא (ZIP)</h3><p class="hint">בתוך הקובץ: קובץ האקסל, תיקיית "קבלות" עם כל צילומי הקבלות (שם הקובץ: תאריך, ספק, סכום), וקובץ נתונים מלא (JSON) שאפשר לשחזר ממנו הכל.</p>' +
      '<div class="adm-row"><button class="btn gold" id="bk-z">⬇️ הורדת גיבוי מלא</button><span class="hint" id="bk-p"></span></div></section>' +
      '<section class="adm-card"><h3>💡 איך שומרים נכון</h3><ul class="tx-tips"><li>שומרים את הקובץ בתיקייה קבועה, למשל "מסמכים ← פריים מגנטים ← גיבויים".</li><li>פעם בחודש מעתיקים את התיקייה גם לדיסק און קי או לענן (Google Drive / OneDrive).</li><li>שם הקובץ כולל את התאריך, כך שכל שבוע נשמר בנפרד.</li></ul></section>');
    function lic() { return FS.license && FS.license.admin ? FS.license.admin('lic-list').then(function (r) { return r && r.ok ? r.licenses || [] : []; }, function () { return []; }) : Promise.resolve([]); }
    function mark() { ACC.call('backup-mark').then(function (r) { if (r.ok) { c.setBackupAt(r.backupAt); $('#bk-st').innerHTML = status(); } }); }
    function safe(s) { return String(s || '').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40); }
    $('#bk-x').addEventListener('click', function () {
      var b = this; b.disabled = true;
      lic().then(function (L) { FS.saveBlob(FS.xlsx(sheets(c, L)), 'frame-magnets-' + stamp + '.xlsx'); b.disabled = false; mark(); FS.toast('✔ הקובץ ירד למחשב'); });
    });
    $('#bk-z').addEventListener('click', function () {
      var b = this, p = $('#bk-p'), withPh = c.expenses().filter(function (e) { return e.photo; }), files = [], i = 0; b.disabled = true;
      lic().then(function (L) {
        files.push({ name: 'פריים-מגנטים-' + stamp + '.xlsx', blob: FS.xlsx(sheets(c, L)) });
        files.push({ name: 'נתונים-מלאים-' + stamp + '.json', data: JSON.stringify({ at: new Date().toISOString(), site: c.site(), settings: c.settings(), deals: c.deals(), expenses: c.expenses(), suppliers: c.suppliers(), requests: c.requests(), licenses: L }, null, 1) });
        var sups = c.suppliers() || [];
        function next() {
          if (i >= withPh.length) return finish();
          var e = withPh[i++]; p.textContent = 'קבלות: ' + i + ' / ' + withPh.length;
          return ACC.call('receipt-get', { id: e.id }).then(function (r) {
            if (r.ok) { var s = sups.filter(function (x) { return x.id === e.supId; })[0], bin = atob(r.data.split(',')[1]), u = new Uint8Array(bin.length); for (var k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k);
              files.push({ name: 'קבלות/' + e.date + '_' + safe(s ? s.name : e.supplier || e.item || e.desc) + '_' + Math.round(e.amount) + '_' + e.id.slice(-5) + (/^data:image\/png/.test(r.data) ? '.png' : /^data:image\/webp/.test(r.data) ? '.webp' : '.jpg'), data: u }); }
            return next();
          }, next);
        }
        function finish() {
          Promise.all(files.map(function (f) { return f.blob ? f.blob.arrayBuffer().then(function (a) { return { name: f.name, data: new Uint8Array(a) }; }) : f; })).then(function (l) {
            FS.saveBlob(FS.zip(l), 'backup-frame-magnets-' + stamp + '.zip'); b.disabled = false; p.textContent = '✔ ' + withPh.length + ' צילומי קבלות'; mark(); FS.toast('✔ הגיבוי ירד למחשב');
          });
        }
        next();
      });
    });
  }
  FS.adminBuy = { expenses: expenses, suppliers: suppliers, backup: backup, sheets: sheets };
})();
