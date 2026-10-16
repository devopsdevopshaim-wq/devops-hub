/* The business sections of the admin (admin.html): deals and payments, monthly and yearly reports (print and Excel/CSV),
   expenses, customers and their saved designs, and the payment and bank details. Everything is read from and saved to the
   sites' secure server through FS.account.call; nothing here is kept in the browser. Deals are edited in full (documents,
   signatures, receipts) in the studio, which saves them to the same server. */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$, ACC = FS.account;
  var MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  var METHODS = { bit: 'ביט', paybox: 'פייבוקס', card: 'אשראי', transfer: 'העברה בנקאית', cash: 'מזומן', check: 'צ׳ק', paypal: 'PayPal', other: 'אחר' };
  var CATS = ['חומרים (נייר מגנטי, דיו)', 'ציוד', 'נסיעות ודלק', 'פרסום ושיווק', 'תוכנה ומנויים', 'שכירות', 'עובדים', 'אחר'];
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[^\d.\-]/g, '')); return isFinite(n) ? n : 0; }
  function money(n) { return '₪' + (Math.round(num(n) * 100) / 100).toLocaleString('he-IL', { maximumFractionDigits: 2 }); }
  function pay(st) { return Object.assign({ vat: 18, bizType: 'פטור' }, (st && st.pay) || {}); }
  function totals(d, st) {
    var extras = (d.extras || []).reduce(function (s, x) { return s + num(x.amount); }, 0), sub = num(d.price) + extras - num(d.discount), r = num(pay(st).vat) / 100, vat = 0, total = sub;
    if (d.vatMode === 'plus') { vat = sub * r; total = sub + vat; } else if (d.vatMode === 'incl') vat = sub - sub / (1 + r);
    var paid = (d.payments || []).reduce(function (s, x) { return s + num(x.amount); }, 0);
    return { total: total, vat: vat, paid: paid, balance: Math.max(0, Math.round((total - paid) * 100) / 100) };
  }
  function evName(id) { var e = (FS.EVENTS || []).filter(function (x) { return x.id === id; })[0]; return e ? e.icon + ' ' + e.name : (id || ''); }
  function heDate(iso) { return iso ? new Date(iso + 'T12:00:00').toLocaleDateString('he-IL') : '—'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return FS.uid ? FS.uid() : Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* ---------- the numbers of a month ---------- */
  function month(deals, exps, st, ym) {
    var p = pay(st), rate = num(p.vat), vatIn = p.bizType === 'מורשה' || p.bizType === 'חברה';
    var rows = [];
    deals.forEach(function (d) { (d.payments || []).forEach(function (x) { if (String(x.date || '').slice(0, 7) === ym) rows.push({ date: x.date, no: x.no, deal: d.no, client: (d.client || {}).name || '', method: x.method, amount: num(x.amount), ref: x.ref || '', dealId: d.id }); }); });
    rows.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var income = rows.reduce(function (s, r) { return s + r.amount; }, 0), byMethod = {};
    rows.forEach(function (r) { byMethod[r.method] = (byMethod[r.method] || 0) + r.amount; });
    var ex = exps.filter(function (e) { return String(e.date || '').slice(0, 7) === ym; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var expTotal = ex.reduce(function (s, e) { return s + num(e.amount); }, 0), expVat = vatIn ? ex.filter(function (e) { return e.vat; }).reduce(function (s, e) { return s + num(e.amount) * rate / (100 + rate); }, 0) : 0;
    var outVat = vatIn ? income * rate / (100 + rate) : 0;
    var events = deals.filter(function (d) { return String(d.date || '').slice(0, 7) === ym; });
    var closed = deals.filter(function (d) { return d.closedAt && new Date(d.closedAt).toISOString().slice(0, 7) === ym; });
    return { ym: ym, rows: rows, income: income, byMethod: byMethod, ex: ex, expTotal: expTotal, outVat: outVat, expVat: expVat, vatDue: outVat - expVat, profit: income - expTotal, events: events, closed: closed, vatIn: vatIn, rate: rate };
  }
  function openBalance(deals, st) { return deals.reduce(function (s, d) { return s + (d.closed ? totals(d, st).balance : 0); }, 0); }
  function upcoming(box, deals, st) {
    var today = new Date().toISOString().slice(0, 10), l = deals.filter(function (d) { return d.date >= today; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }).slice(0, 6);
    box.innerHTML = l.length ? '<ul class="adm-hist">' + l.map(function (d) { var t = totals(d, st); return '<li><b>' + esc(heDate(d.date)) + ' · ' + esc((d.client || {}).name || '') + ' · ' + evName(d.type) + '</b><small>' + (t.balance > 0 ? 'יתרה ' + money(t.balance) : 'שולם ✔') + '</small></li>'; }).join('') + '</ul>' : '<p class="hint">אין אירועים קרובים. עסקאות נפתחות בסטודיו (📑 עסקאות) או כאן ב"עסקאות ותשלומים".</p>';
  }

  /* ---------- printing ---------- */
  function printHtml(title, html, biz) {
    var a = $('#print-area');
    a.innerHTML = '<div class="rp"><header><div><b>' + esc(biz.name || '') + '</b><span>' + esc([biz.owner, biz.phone, biz.email].filter(Boolean).join(' · ')) + '</span></div><div><h1>' + esc(title) + '</h1><span>הופק ' + new Date().toLocaleString('he-IL') + '</span></div></header>' + html + '</div>';
    document.body.classList.add('printing-report');
    setTimeout(function () { window.print(); }, 80);
  }
  window.addEventListener('afterprint', function () { document.body.classList.remove('printing-report'); });
  function csv(name, rows) {
    var text = '﻿' + rows.map(function (r) { return r.map(function (c) { c = String(c == null ? '' : c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(','); }).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }

  var V = {};
  /* ---------- deals and payments ---------- */
  V.deals = function (m, c) {
    c.head(m, '📑 עסקאות ותשלומים', 'כל העסקאות שמורות בשרת. עריכה מלאה (מסמך סגירה, חתימות, אישורי תשלום) נעשית בסטודיו, והכול נשמר לכאן.');
    var st = c.settings(), filter = 'upcoming', q = '';
    m.insertAdjacentHTML('beforeend', '<div class="adm-row"><a class="btn gold" href="studio.html?deals" target="_blank" rel="noopener">📑 פתיחת העסקאות בסטודיו</a><button class="btn line" id="dl-quick">＋ עסקה מהירה</button><button class="btn line" id="dl-import">📥 ייבוא עסקאות מהדפדפן הזה</button><button class="btn line" id="dl-busy">📅 עדכון תאריכים תפוסים באתר</button></div>' +
      '<div class="adm-row"><div class="seg" id="dl-f"><button data-f="upcoming" class="on">קרובות</button><button data-f="open">יתרה פתוחה</button><button data-f="past">עברו</button><button data-f="all">הכול</button></div><input id="dl-q" placeholder="חיפוש לפי שם…"></div><div id="dl-list"></div>');
    function draw() {
      var today = new Date().toISOString().slice(0, 10);
      var l = c.deals().filter(function (d) {
        var t = totals(d, st);
        if (q && String((d.client || {}).name || '').indexOf(q) < 0 && String(d.no || '').indexOf(q) < 0) return false;
        return filter === 'all' || (filter === 'upcoming' && d.date >= today) || (filter === 'past' && d.date && d.date < today) || (filter === 'open' && d.closed && t.balance > 0);
      }).sort(function (a, b) { return (a.date || '9') < (b.date || '9') ? (filter === 'past' ? 1 : -1) : (filter === 'past' ? -1 : 1); });
      var box = $('#dl-list');
      box.innerHTML = l.length ? '<table class="adm-tbl"><thead><tr><th>תאריך</th><th>לקוח</th><th>אירוע</th><th>סה״כ</th><th>שולם</th><th>יתרה</th><th></th></tr></thead><tbody>' + l.map(function (d) {
        var t = totals(d, st);
        return '<tr data-id="' + esc(d.id) + '"><td>' + esc(heDate(d.date)) + '</td><td><b>' + esc((d.client || {}).name || '—') + '</b><small>' + esc((d.client || {}).phone || '') + (d.no ? ' · עסקה ' + esc(d.no) : '') + '</small></td><td>' + evName(d.type) + '<small>' + esc(d.venue || '') + '</small></td><td>' + money(t.total) + '</td><td>' + money(t.paid) + '</td><td class="' + (t.balance > 0 ? 'bal' : 'ok') + '">' + (t.balance > 0 ? money(t.balance) : '✔') + '</td>' +
          '<td class="act"><button data-a="pay" title="רישום תשלום">💳</button><a href="studio.html?deal=' + encodeURIComponent(d.id) + '" target="_blank" rel="noopener" title="עריכה בסטודיו">✏️</a><button data-a="del" title="מחיקה">🗑</button></td></tr>';
      }).join('') + '</tbody></table>' : '<p class="hint">אין עסקאות כאן.</p>';
      $$('tr[data-id]', box).forEach(function (tr) {
        var d = c.deals().filter(function (x) { return x.id === tr.dataset.id; })[0];
        $('[data-a=pay]', tr).addEventListener('click', function () { payForm(d); });
        $('[data-a=del]', tr).addEventListener('click', function () { if (!confirm('למחוק את העסקה של ' + ((d.client || {}).name || '') + '? אי אפשר לבטל.')) return; ACC.call('deal-del', { id: d.id }).then(function (r) { if (!r.ok) return FS.toast(ACC.msg(r)); c.setDeals(c.deals().filter(function (x) { return x !== d; })); draw(); FS.toast('נמחקה'); }); });
      });
    }
    function payForm(d) {
      var t = totals(d, st), a = prompt('סכום התשלום מ' + ((d.client || {}).name || '') + ' (יתרה ' + money(t.balance) + '):', t.balance || ''); if (!a || !(num(a) > 0)) return;
      var meth = prompt('אמצעי: ביט / פייבוקס / אשראי / העברה / מזומן / צ׳ק', 'ביט') || 'אחר';
      var code = Object.keys(METHODS).filter(function (k) { return METHODS[k].indexOf(meth.trim().slice(0, 3)) === 0; })[0] || 'other';
      var maxNo = c.deals().reduce(function (mx, x) { return Math.max(mx, (x.payments || []).reduce(function (m2, p) { return Math.max(m2, num(p.no)); }, 0)); }, 0);
      d.payments = d.payments || []; d.payments.push({ id: uid(), no: maxNo + 1, amount: num(a), method: code, date: new Date().toISOString().slice(0, 10), ref: '' });
      if (!d.closed) { d.closed = true; d.closedAt = Date.now(); }
      d.updatedAt = Date.now();
      ACC.call('deal-save', { deal: d }).then(function (r) { FS.toast(r.ok ? '✔ נרשם תשלום מס׳ ' + (maxNo + 1) + '. אישור תשלום להדפסה: בסטודיו.' : ACC.msg(r), 5000); draw(); });
    }
    $$('#dl-f button').forEach(function (b) { b.addEventListener('click', function () { filter = b.dataset.f; $$('#dl-f button').forEach(function (x) { x.classList.toggle('on', x === b); }); draw(); }); });
    $('#dl-q').addEventListener('input', function () { q = this.value.trim(); draw(); });
    $('#dl-quick').addEventListener('click', function () {
      var name = prompt('שם הלקוח:'); if (!name) return; var date = prompt('תאריך האירוע (YYYY-MM-DD):', '') || ''; var price = prompt('מחיר (₪):', '') || '';
      var d = { id: 'd' + uid(), no: null, createdAt: Date.now(), updatedAt: Date.now(), client: { name: name.slice(0, 60), phone: '', email: '', idNo: '', address: '' }, type: 'wedding', date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '', time: '', venue: '', guests: '', pkg: '', price: price, discount: '', extras: [], vatMode: 'none', deposit: '', balanceDue: '', terms: '', notes: 'נפתח מהניהול', payments: [], sign: {}, closed: false };
      ACC.call('deal-save', { deal: d }).then(function (r) { if (!r.ok) return FS.toast(ACC.msg(r)); c.setDeals(c.deals().concat([d])); filter = 'all'; draw(); FS.toast('נפתחה. את שאר הפרטים ממלאים בסטודיו (✏️).', 5000); });
    });
    $('#dl-import').addEventListener('click', function () {
      if (!FS.store) return FS.toast('לא נמצאו עסקאות בדפדפן הזה');
      FS.store.all('deals').then(function (l) {
        if (!l || !l.length) return FS.toast('לא נמצאו עסקאות בדפדפן הזה');
        FS.busy('מעלה ' + l.length + ' עסקאות…');
        return ACC.call('deals-import', { deals: l }).then(function (r) { FS.busy(); if (!r.ok) return FS.toast(ACC.msg(r)); FS.toast('✔ הועלו ' + r.saved + ' עסקאות' + (r.skipped ? ' (' + r.skipped + ' כבר היו מעודכנות)' : ''), 6000); return ACC.call('all').then(function (a) { if (a.ok) { c.setDeals(a.deals); draw(); } }); });
      }).catch(function () { FS.busy(); FS.toast('לא הצלחתי לקרוא את העסקאות מהדפדפן'); });
    });
    $('#dl-busy').addEventListener('click', function () {
      var today = new Date().toISOString().slice(0, 10), set = {};
      c.deals().forEach(function (d) { if (d.closed && d.date && d.date >= today) set[d.date] = 1; });
      var list = Object.keys(set).sort(); c.touchBusy(list); FS.toast('📅 ' + list.length + ' תאריכים תפוסים. לוחצים "פרסום באתר" כדי שיופיעו.', 6000);
    });
    draw();
  };

  /* ---------- reports ---------- */
  V.reports = function (m, c) {
    c.head(m, '📊 דוחות', 'הכנסות לפי תאריך התשלום, הוצאות, מע״מ ורווח: לחודש או לשנה, להדפסה או לאקסל.');
    var now = new Date(), mode = 'month', ym = now.toISOString().slice(0, 7), year = now.getFullYear();
    var years = {}; years[year] = 1; c.deals().forEach(function (d) { (d.payments || []).forEach(function (p) { if (p.date) years[p.date.slice(0, 4)] = 1; }); }); c.expenses().forEach(function (e) { if (e.date) years[e.date.slice(0, 4)] = 1; });
    m.insertAdjacentHTML('beforeend', '<div class="adm-row"><div class="seg" id="rp-mode"><button data-m="month" class="on">חודשי</button><button data-m="year">שנתי</button></div><input type="month" id="rp-month" value="' + ym + '"><select id="rp-year" hidden>' + Object.keys(years).sort().reverse().map(function (y) { return '<option>' + y + '</option>'; }).join('') + '</select>' +
      '<button class="btn gold" id="rp-print">🖨 הדפסה</button><button class="btn line" id="rp-csv">⬇️ אקסל (CSV)</button></div><div id="rp-out"></div>' +
      '<p class="hint">הדוח עוזר לעקוב ולהעביר לרואה החשבון. הוא לא מחליף את הדיווח הרשמי ואת הקבלות מתוכנה מוכרת.</p>');
    var biz = c.site(), st = c.settings();
    function monthHtml(r, full) {
      var title = MONTHS[Number(r.ym.slice(5, 7)) - 1] + ' ' + r.ym.slice(0, 4);
      return '<h2>' + title + '</h2><div class="adm-stats">' + [['💵', money(r.income), 'הכנסות'], ['💸', money(r.expTotal), 'הוצאות'], ['📈', money(r.profit), 'רווח'], ['🎉', r.events.length, 'אירועים']].concat(r.vatIn ? [['🧾', money(r.vatDue), 'מע״מ לתשלום (משוער)']] : []).map(function (s) { return '<div><i>' + s[0] + '</i><b>' + s[1] + '</b><small>' + s[2] + '</small></div>'; }).join('') + '</div>' +
        '<h3>הכנסות</h3>' + (r.rows.length ? '<table class="adm-tbl"><thead><tr><th>תאריך</th><th>אישור</th><th>עסקה</th><th>לקוח</th><th>אמצעי</th><th>סכום</th></tr></thead><tbody>' + r.rows.map(function (x) { return '<tr><td>' + heDate(x.date) + '</td><td>' + esc(x.no || '') + '</td><td>' + esc(x.deal || '') + '</td><td>' + esc(x.client) + '</td><td>' + esc(METHODS[x.method] || x.method) + '</td><td>' + money(x.amount) + '</td></tr>'; }).join('') + '<tr class="tot"><td colspan="5">סה״כ הכנסות</td><td>' + money(r.income) + '</td></tr></tbody></table>' : '<p class="hint">אין תשלומים בחודש הזה.</p>') +
        (Object.keys(r.byMethod).length ? '<p class="adm-by">' + Object.keys(r.byMethod).map(function (k) { return esc(METHODS[k] || k) + ': <b>' + money(r.byMethod[k]) + '</b>'; }).join(' · ') + '</p>' : '') +
        '<h3>הוצאות</h3>' + (r.ex.length ? '<table class="adm-tbl"><thead><tr><th>תאריך</th><th>תיאור</th><th>קטגוריה</th><th>ספק</th><th>אסמכתא</th><th>סכום</th></tr></thead><tbody>' + r.ex.map(function (e) { return '<tr><td>' + heDate(e.date) + '</td><td>' + esc(e.desc) + '</td><td>' + esc(e.cat) + '</td><td>' + esc(e.supplier) + '</td><td>' + esc(e.ref) + '</td><td>' + money(e.amount) + '</td></tr>'; }).join('') + '<tr class="tot"><td colspan="5">סה״כ הוצאות</td><td>' + money(r.expTotal) + '</td></tr></tbody></table>' : '<p class="hint">אין הוצאות בחודש הזה.</p>') +
        (r.vatIn ? '<p class="adm-by">מע״מ עסקאות: <b>' + money(r.outVat) + '</b> · מע״מ תשומות: <b>' + money(r.expVat) + '</b> · לתשלום (משוער): <b>' + money(r.vatDue) + '</b></p>' : '') +
        (full && r.events.length ? '<h3>אירועים בחודש</h3><table class="adm-tbl"><tbody>' + r.events.map(function (d) { var t = totals(d, st); return '<tr><td>' + heDate(d.date) + '</td><td>' + esc((d.client || {}).name || '') + '</td><td>' + evName(d.type) + '</td><td>' + money(t.total) + '</td><td>' + (t.balance > 0 ? 'יתרה ' + money(t.balance) : '✔ שולם') + '</td></tr>'; }).join('') + '</tbody></table>' : '');
    }
    function yearData(y) { var out = []; for (var i = 1; i <= 12; i++) out.push(month(c.deals(), c.expenses(), st, y + '-' + ('0' + i).slice(-2))); return out; }
    function yearHtml(y) {
      var ms = yearData(y), inc = 0, exp = 0, ev = 0, vat = 0, by = {};
      ms.forEach(function (r) { inc += r.income; exp += r.expTotal; ev += r.events.length; vat += r.vatDue; Object.keys(r.byMethod).forEach(function (k) { by[k] = (by[k] || 0) + r.byMethod[k]; }); });
      return '<h2>שנת ' + y + '</h2><div class="adm-stats">' + [['💵', money(inc), 'הכנסות'], ['💸', money(exp), 'הוצאות'], ['📈', money(inc - exp), 'רווח'], ['🎉', ev, 'אירועים']].map(function (s) { return '<div><i>' + s[0] + '</i><b>' + s[1] + '</b><small>' + s[2] + '</small></div>'; }).join('') + '</div>' +
        '<table class="adm-tbl"><thead><tr><th>חודש</th><th>אירועים</th><th>הכנסות</th><th>הוצאות</th><th>רווח</th>' + (ms[0].vatIn ? '<th>מע״מ (משוער)</th>' : '') + '</tr></thead><tbody>' + ms.map(function (r, i) { return '<tr><td>' + MONTHS[i] + '</td><td>' + r.events.length + '</td><td>' + money(r.income) + '</td><td>' + money(r.expTotal) + '</td><td>' + money(r.profit) + '</td>' + (r.vatIn ? '<td>' + money(r.vatDue) + '</td>' : '') + '</tr>'; }).join('') +
        '<tr class="tot"><td>סה״כ</td><td>' + ev + '</td><td>' + money(inc) + '</td><td>' + money(exp) + '</td><td>' + money(inc - exp) + '</td>' + (ms[0].vatIn ? '<td>' + money(vat) + '</td>' : '') + '</tr></tbody></table>' +
        (Object.keys(by).length ? '<p class="adm-by">לפי אמצעי תשלום: ' + Object.keys(by).map(function (k) { return esc(METHODS[k] || k) + ' <b>' + money(by[k]) + '</b>'; }).join(' · ') + '</p>' : '');
    }
    function draw() { $('#rp-out').innerHTML = mode === 'month' ? monthHtml(month(c.deals(), c.expenses(), st, ym), true) : yearHtml($('#rp-year').value); }
    $$('#rp-mode button').forEach(function (b) { b.addEventListener('click', function () { mode = b.dataset.m; $$('#rp-mode button').forEach(function (x) { x.classList.toggle('on', x === b); }); $('#rp-month').hidden = mode !== 'month'; $('#rp-year').hidden = mode !== 'year'; draw(); }); });
    $('#rp-month').addEventListener('change', function () { if (this.value) { ym = this.value; draw(); } });
    $('#rp-year').addEventListener('change', draw);
    $('#rp-print').addEventListener('click', function () { var y = $('#rp-year').value; printHtml(mode === 'month' ? 'דוח חודשי' : 'דוח שנתי', mode === 'month' ? monthHtml(month(c.deals(), c.expenses(), st, ym), true) : yearHtml(y), biz); });
    $('#rp-csv').addEventListener('click', function () {
      if (mode === 'month') {
        var r = month(c.deals(), c.expenses(), st, ym), rows = [['סוג', 'תאריך', 'מס׳ אישור/אסמכתא', 'עסקה', 'לקוח/ספק', 'אמצעי/קטגוריה', 'תיאור', 'סכום']];
        r.rows.forEach(function (x) { rows.push(['הכנסה', x.date, x.no, x.deal || '', x.client, METHODS[x.method] || x.method, '', x.amount]); });
        r.ex.forEach(function (e) { rows.push(['הוצאה', e.date, e.ref, '', e.supplier, e.cat, e.desc, -num(e.amount)]); });
        rows.push([]); rows.push(['סה״כ הכנסות', '', '', '', '', '', '', r.income]); rows.push(['סה״כ הוצאות', '', '', '', '', '', '', r.expTotal]); rows.push(['רווח', '', '', '', '', '', '', r.profit]);
        csv('דוח-' + ym + '.csv', rows);
      } else {
        var y = $('#rp-year').value, ms = yearData(y), rows2 = [['חודש', 'אירועים', 'הכנסות', 'הוצאות', 'רווח', 'מע״מ משוער']];
        ms.forEach(function (r2, i) { rows2.push([MONTHS[i], r2.events.length, r2.income, r2.expTotal, r2.profit, r2.vatIn ? Math.round(r2.vatDue) : '']); });
        csv('דוח-שנתי-' + y + '.csv', rows2);
      }
    });
    draw();
  };

  /* ---------- expenses ---------- */
  V.expenses = function (m, c) {
    c.head(m, '💸 הוצאות', 'כל הוצאה של העסק, כדי שהדוחות יראו רווח אמיתי. נשמר בשרת.');
    var today = new Date().toISOString().slice(0, 10), ym = today.slice(0, 7);
    m.insertAdjacentHTML('beforeend', '<section class="adm-card"><h3>הוצאה חדשה</h3><div class="adm-grid">' +
      '<label class="adm-f"><span>תאריך</span><div class="adm-in"><input type="date" id="ex-date" value="' + today + '"></div></label><label class="adm-f"><span>תיאור</span><div class="adm-in"><input id="ex-desc" placeholder="נייר מגנטי 500 יח׳"></div></label>' +
      '<label class="adm-f"><span>קטגוריה</span><div class="adm-in"><select id="ex-cat">' + CATS.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('') + '</select></div></label><label class="adm-f"><span>ספק</span><div class="adm-in"><input id="ex-sup"></div></label>' +
      '<label class="adm-f"><span>סכום ₪</span><div class="adm-in"><input type="number" id="ex-amt" step="0.01"></div></label><label class="adm-f"><span>מס׳ חשבונית/קבלה</span><div class="adm-in"><input id="ex-ref"></div></label></div>' +
      '<div class="adm-row"><label class="adm-chk"><input type="checkbox" id="ex-vat" checked> הסכום כולל מע״מ (חשבונית מס)</label><button class="btn gold" id="ex-add">＋ הוספה</button></div></section>' +
      '<div class="adm-row"><input type="month" id="ex-month" value="' + ym + '"><span id="ex-sum" class="adm-by"></span></div><div id="ex-list"></div>');
    function draw() {
      var l = c.expenses().filter(function (e) { return String(e.date).slice(0, 7) === ym; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
      $('#ex-sum').innerHTML = 'סה״כ ב' + MONTHS[Number(ym.slice(5, 7)) - 1] + ': <b>' + money(l.reduce(function (s, e) { return s + num(e.amount); }, 0)) + '</b>';
      $('#ex-list').innerHTML = l.length ? '<table class="adm-tbl"><thead><tr><th>תאריך</th><th>תיאור</th><th>קטגוריה</th><th>ספק</th><th>סכום</th><th></th></tr></thead><tbody>' + l.map(function (e) { return '<tr data-id="' + esc(e.id) + '"><td>' + heDate(e.date) + '</td><td>' + esc(e.desc) + (e.ref ? '<small>' + esc(e.ref) + '</small>' : '') + '</td><td>' + esc(e.cat) + '</td><td>' + esc(e.supplier) + '</td><td>' + money(e.amount) + (e.vat ? '<small>כולל מע״מ</small>' : '') + '</td><td class="act"><button data-a="del">🗑</button></td></tr>'; }).join('') + '</tbody></table>' : '<p class="hint">אין הוצאות בחודש הזה.</p>';
      $$('#ex-list tr[data-id]').forEach(function (tr) { $('[data-a=del]', tr).addEventListener('click', function () { if (!confirm('למחוק את ההוצאה?')) return; ACC.call('expense-del', { id: tr.dataset.id }).then(function (r) { if (!r.ok) return FS.toast(ACC.msg(r)); c.setExpenses(c.expenses().filter(function (x) { return x.id !== tr.dataset.id; })); draw(); }); }); });
    }
    $('#ex-month').addEventListener('change', function () { if (this.value) { ym = this.value; draw(); } });
    $('#ex-add').addEventListener('click', function () {
      var e = { id: 'e' + uid(), date: $('#ex-date').value, desc: $('#ex-desc').value.trim(), cat: $('#ex-cat').value, supplier: $('#ex-sup').value.trim(), amount: num($('#ex-amt').value), ref: $('#ex-ref').value.trim(), vat: $('#ex-vat').checked };
      if (!e.desc || !(e.amount > 0)) return FS.toast('תיאור וסכום');
      ACC.call('expense-save', { expense: e }).then(function (r) { if (!r.ok) return FS.toast(ACC.msg(r)); c.setExpenses(c.expenses().concat([r.expense])); ym = r.expense.date.slice(0, 7); $('#ex-month').value = ym; $('#ex-desc').value = ''; $('#ex-amt').value = ''; $('#ex-ref').value = ''; draw(); FS.toast('✔ נשמר'); });
    });
    draw();
  };

  /* ---------- customers ---------- */
  V.customers = function (m, c) {
    c.head(m, '👥 לקוחות ועיצובים', 'לקוחות שפתחו חשבון בעורך המסגרות ושמרו עיצובים. העיצובים שמורים בשרת ולא נמחקים.');
    var l = c.customers().slice().sort(function (a, b) { return b.last - a.last; });
    m.insertAdjacentHTML('beforeend', l.length ? '<table class="adm-tbl"><thead><tr><th>לקוח</th><th>עיצובים</th><th>עדכון אחרון</th><th></th></tr></thead><tbody>' + l.map(function (x) { return '<tr data-e="' + esc(x.email) + '"><td dir="ltr">' + esc(x.email) + '</td><td>' + x.designs + '</td><td>' + (x.last ? new Date(x.last).toLocaleString('he-IL') : '') + '</td><td class="act"><button data-a="open">👁 עיצובים</button><a href="mailto:' + esc(x.email) + '">✉️</a></td></tr>'; }).join('') + '</tbody></table><div id="cu-designs"></div>' : '<p class="hint">עוד אין לקוחות עם עיצובים שמורים. הלקוחות פותחים חשבון בעורך (design.html ← "👤 החשבון שלי").</p>');
    $$('tr[data-e]', m).forEach(function (tr) {
      $('[data-a=open]', tr).addEventListener('click', function () {
        ACC.call('designs-of', { email: tr.dataset.e }).then(function (r) {
          if (!r.ok) return FS.toast(ACC.msg(r));
          $('#cu-designs').innerHTML = '<h3>העיצובים של ' + esc(tr.dataset.e) + '</h3><div class="dz-mine">' + r.designs.map(function (d) { return '<figure><img src="' + esc(d.thumb || '') + '" alt=""><figcaption><b>' + esc(d.name || 'עיצוב') + '</b><small>' + new Date(d.at).toLocaleDateString('he-IL') + '</small></figcaption><div><a class="btn small" target="_blank" rel="noopener" href="design.html?owner&open=' + encodeURIComponent(tr.dataset.e + ':' + d.id) + '">פתיחה בעורך</a></div></figure>'; }).join('') + '</div>';
        });
      });
    });
  };

  /* ---------- payment and bank details ---------- */
  V.payset = function (m, c) {
    c.head(m, '🏦 תשלום ובנק', 'אפשרויות התשלום שהלקוחות רואים במסמך הסגירה ובדף התשלום, ופרטי העסק למסמכים. נשמר בשרת המאובטח.');
    var p = pay(c.settings());
    function f(k, label, ph, ltr) { return '<label class="adm-f"><span>' + esc(label) + '</span><div class="adm-in"><input data-k="' + k + '" value="' + esc(p[k] == null ? '' : p[k]) + '" placeholder="' + esc(ph || '') + '"' + (ltr ? ' dir="ltr"' : '') + '></div></label>'; }
    m.insertAdjacentHTML('beforeend', '<section class="adm-card"><h3>💳 אפשרויות תשלום</h3><div class="adm-grid">' + f('bit', 'ביט: טלפון', '05X-XXXXXXX', 1) + f('paybox', 'פייבוקס: קישור', 'https://…', 1) + f('card', 'אשראי: קישור לדף סליקה', 'https://…', 1) + f('paypal', 'PayPal: קישור', 'https://paypal.me/…', 1) + '</div>' +
      '<div class="adm-row"><label class="adm-chk"><input type="checkbox" data-k="cash"' + (p.cash !== false ? ' checked' : '') + '> מזומן</label><label class="adm-chk"><input type="checkbox" data-k="check"' + (p.check !== false ? ' checked' : '') + '> צ׳ק</label></div>' +
      '<p class="note-warn">🔒 מספרי כרטיסי אשראי לא נשמרים כאן בשום מקרה, והשרת דוחה אותם. לקבלת תשלום באשראי שמים קישור לדף סליקה (Morning, PayPlus, Meshulam וכדומה).</p></section>' +
      '<section class="adm-card"><h3>🏦 העברה בנקאית</h3><div class="adm-grid">' + f('holder', 'שם בעל החשבון') + f('bankName', 'בנק', 'לאומי') + f('bankNo', 'מספר בנק', '10', 1) + f('branch', 'סניף', '', 1) + f('account', 'מספר חשבון', '', 1) + f('iban', 'IBAN (לא חובה)', 'IL…', 1) + '</div></section>' +
      '<section class="adm-card"><h3>🧾 פרטים למסמכים</h3><div class="adm-grid"><label class="adm-f"><span>סוג העסק</span><div class="adm-in"><select data-k="bizType">' + ['פטור', 'מורשה', 'חברה'].map(function (t) { return '<option value="' + t + '"' + (p.bizType === t ? ' selected' : '') + '>' + (t === 'פטור' ? 'עוסק פטור' : t === 'מורשה' ? 'עוסק מורשה' : 'חברה בע״מ') + '</option>'; }).join('') + '</select></div></label>' +
      f('bizId', 'מספר עוסק / ח.פ', '', 1) + f('address', 'כתובת העסק') + f('vat', 'מע״מ %', '18', 1) + f('docLabel', 'כותרת אישור תשלום', 'אישור תשלום') + f('invoiceUrl', 'קישור לתוכנת הקבלות', 'https://…', 1) + '</div>' +
      '<label class="adm-f wide"><span>תנאי ברירת מחדל לעסקה</span><div class="adm-in"><textarea data-k="terms" rows="5">' + esc(p.terms || '') + '</textarea></div></label></section>' +
      '<div class="adm-row"><button class="btn gold" id="ps-save">💾 שמירה בשרת</button><span class="hint">הסטודיו קורא מכאן את הפרטים למסמכים ולדף התשלום.</span></div>');
    $('#ps-save').addEventListener('click', function () {
      var out = Object.assign({}, p);
      $$('[data-k]', m).forEach(function (el) { out[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value.trim(); });
      var bad = ['paybox', 'card', 'paypal', 'invoiceUrl'].filter(function (k) { return out[k] && !/^https:\/\/\S+$/i.test(out[k]); });
      if (bad.length) return FS.toast('קישורים צריכים להתחיל ב־https://');
      var s = Object.assign({}, c.settings(), { pay: out });
      ACC.call('settings-save', { settings: s }).then(function (r) { if (!r.ok) return FS.toast(ACC.msg(r), 6000); c.setSettings(s); FS.toast('✔ נשמר בשרת'); });
    });
  };

  FS.adminBiz = { view: function (k, m, c) { V[k](m, c); }, month: month, money: money, totals: totals, openBalance: openBalance, upcoming: upcoming };
})();
