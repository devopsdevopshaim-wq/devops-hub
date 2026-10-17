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

  /* ---------- booking requests: the calendar is checked, the owner decides ---------- */
  function waLink(phone, text) { var n = String(phone || '').replace(/\D/g, '').replace(/^0/, '972'); return 'https://wa.me/' + n + '?text=' + encodeURIComponent(text || ''); }
  function longDate(iso) { var d = new Date(iso + 'T12:00:00'); return isNaN(d) ? (iso || '') : d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  function holds(d) { return d && d.date && !d.cancelled && (d.closed || (d.payments || []).length > 0); }
  /* the same rule as the server: deals that hold a date, the owner's busy dates, and how many events fit in a day */
  function dayState(c, iso, skipRq) {
    var perDay = Math.max(1, Math.min(10, num(c.settings().perDay) || 1));
    var deals = c.deals().filter(function (d) { return holds(d) && d.date === iso; });
    var busy = (c.site().busy || []).indexOf(iso) > -1;
    var pending = c.requests().filter(function (r) { return r.status === 'pending' && r.date === iso && r.id !== skipRq; });
    return { free: !busy && deals.length < perDay, busy: busy, deals: deals, pending: pending, perDay: perDay };
  }
  function calText(st) {
    if (st.free) return '<span class="cal-ok">✔ פנוי ביומן</span>' + (st.deals.length ? ' <small>(' + st.deals.length + ' מתוך ' + st.perDay + ' ביום)</small>' : '');
    return '<span class="cal-no">⚠️ תפוס: ' + (st.deals.length ? st.deals.map(function (d) { return esc((d.client || {}).name || 'עסקה') + (d.no ? ' (' + d.no + ')' : ''); }).join(', ') : 'סימנת את התאריך כתפוס') + '</span>';
  }
  function gcal(o) {
    var d = String(o.date || '').replace(/-/g, ''), n = new Date(new Date(o.date + 'T12:00:00Z').getTime() + 864e5).toISOString().slice(0, 10).replace(/-/g, '');
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent('🧲 ' + o.title) + '&dates=' + d + '/' + n + '&details=' + encodeURIComponent(o.details || '') + '&location=' + encodeURIComponent(o.venue || '');
  }
  var STATUS = { pending: ['wait', '⏳ ממתינה לאישור'], approved: ['ok', '✔ אושרה'], declined: ['no', '✖ נדחתה'] };
  V.requests = function (m, c) {
    c.head(m, '📥 בקשות הזמנה', 'לקוחות שבחרו תאריך ושלחו פרטים, מהאתר או מהצ׳אט. המערכת בודקת את היומן; ההזמנה נסגרת רק כשאתה מאשר.');
    var filter = 'pending', biz = c.site(), owner = String(biz.owner || '').split(' ')[0] || '';
    m.insertAdjacentHTML('beforeend', '<div class="adm-row"><div class="seg" id="rq-f"><button data-f="pending" class="on">ממתינות</button><button data-f="approved">אושרו</button><button data-f="declined">נדחו</button><button data-f="all">הכול</button></div><button class="btn line small" id="rq-refresh">🔄 רענון</button><a class="btn line small" href="./#contact" target="_blank" rel="noopener">🌐 טופס ההזמנה באתר</a></div><div id="rq-list" class="rq-list"></div>');
    function msgApprove(r) { return 'שלום ' + r.name + '! 🎉\nשמחים לאשר את ההזמנה שלכם (' + r.ref + ') ל' + longDate(r.date) + '.\nהתאריך שמור לכם. נשלח את פרטי העסקה והמקדמה.\n' + (biz.name || ''); }
    function msgDecline(r, why) { return 'שלום ' + r.name + ',\nתודה על הפנייה (' + r.ref + '). לצערנו לא נוכל לקבל אירוע ב' + longDate(r.date) + '.' + (why ? '\n' + why : '') + '\n' + (biz.name || ''); }
    function draw() {
      var l = c.requests().filter(function (r) { return filter === 'all' || r.status === filter; }).sort(function (a, b) { return filter === 'pending' ? (a.date < b.date ? -1 : 1) : b.at - a.at; });
      var box = $('#rq-list');
      box.innerHTML = l.length ? l.map(function (r) {
        var st = dayState(c, r.date, r.id), S = STATUS[r.status] || STATUS.pending, deal = r.dealId && c.deals().filter(function (d) { return d.id === r.dealId; })[0];
        var pk = (biz.packages || []).filter(function (p) { return p.name === r.pkg; })[0];
        return '<article class="rq rq-' + S[0] + '" data-id="' + esc(r.id) + '"><header><b>' + esc(r.ref) + '</b><span class="st st-' + S[0] + '">' + S[1] + '</span><small>התקבלה ' + new Date(r.at).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) + (r.from === 'chat' ? ' · מהצ׳אט' : '') + '</small></header>' +
          '<div class="rq-body"><div><h3>' + esc(r.name) + '</h3><p><a href="tel:' + esc(r.phone) + '">📞 ' + esc(r.phone) + '</a>' + (r.email ? ' · <a href="mailto:' + esc(r.email) + '" dir="ltr">' + esc(r.email) + '</a>' : '') + '</p></div>' +
          '<dl><dt>אירוע</dt><dd>' + esc(r.typeName || evName(r.type) || '—') + '</dd><dt>תאריך</dt><dd><b>' + esc(longDate(r.date)) + '</b>' + (r.time ? ' · ' + esc(r.time) : '') + '</dd>' + (r.guests ? '<dt>אורחים</dt><dd>' + esc(r.guests) + '</dd>' : '') + (r.venue ? '<dt>מקום</dt><dd>' + esc(r.venue) + '</dd>' : '') + (r.pkg ? '<dt>חבילה</dt><dd>' + esc(r.pkg) + (pk && pk.price ? ' · ' + esc(pk.price) : '') + '</dd>' : '') + (r.notes ? '<dt>הערות</dt><dd>' + esc(r.notes) + '</dd>' : '') + '</dl>' +
          '<p class="rq-cal">📅 ' + (r.status === 'approved' ? '<span class="cal-ok">שמור ביומן' + (deal && deal.no ? ' · עסקה ' + esc(deal.no) : '') + '</span>' : calText(st)) + (r.status === 'pending' && st.pending.length ? ' · <span class="cal-warn">עוד ' + st.pending.length + ' בקשות ממתינות לאותו תאריך</span>' : '') + '</p>' +
          (r.answer ? '<p class="rq-ans">ההודעה שלך: ' + esc(r.answer) + '</p>' : '') + '</div>' +
          (r.status === 'pending' ? '<div class="rq-decide"><label>מחיר לעסקה ₪<input type="number" min="0" data-k="price" value="' + esc(num(pk && pk.price) || '') + '"></label><label class="grow">הודעה ללקוח (לא חובה)<input data-k="answer" maxlength="400" placeholder="למשל: נשמח לראות אתכם!"></label></div>' : '') +
          '<div class="act-row">' + (r.status === 'pending' ? '<button class="btn gold" data-a="approve">✅ אישור וסגירת העסקה</button><button class="btn line" data-a="decline">✖ דחייה</button>' : '') +
          (r.status === 'approved' ? '<a class="btn gold small" target="_blank" rel="noopener" href="' + esc(waLink(r.phone, msgApprove(r))) + '">📲 עדכון הלקוח בוואטסאפ</a><a class="btn line small" target="_blank" rel="noopener" href="' + esc(gcal({ date: r.date, title: (r.typeName || evName(r.type)) + ' · ' + r.name, venue: r.venue, details: r.ref + '\n' + r.phone })) + '">📅 ליומן Google</a>' + (deal ? '<a class="btn line small" target="_blank" rel="noopener" href="studio.html?deal=' + encodeURIComponent(deal.id) + '">📑 העסקה בסטודיו</a>' : '') : '') +
          (r.status === 'declined' ? '<a class="btn line small" target="_blank" rel="noopener" href="' + esc(waLink(r.phone, msgDecline(r, r.answer))) + '">📲 עדכון הלקוח בוואטסאפ</a><button class="btn line small" data-a="reopen">↩ החזרה להמתנה</button>' : '') +
          '<a class="btn line small" target="_blank" rel="noopener" href="' + esc(waLink(r.phone, 'שלום ' + r.name + ', כאן ' + owner + ' מ' + (biz.name || '') + ' לגבי בקשת ההזמנה ' + r.ref + ' ל' + longDate(r.date) + '.')) + '">💬 וואטסאפ</a>' +
          (r.status !== 'pending' ? '<button class="btn line small" data-a="del" title="מחיקה">🗑</button>' : '') + '</div></article>';
      }).join('') : '<p class="hint">' + (filter === 'pending' ? 'אין בקשות שממתינות לך. 🎉 בקשה חדשה מגיעה למייל ומופיעה כאן.' : 'אין בקשות כאן.') + '</p>';
      $$('.rq', box).forEach(function (el) {
        var r = c.requests().filter(function (x) { return x.id === el.dataset.id; })[0];
        function val(k) { var i = $('[data-k=' + k + ']', el); return i ? i.value.trim() : ''; }
        function decide(decision, force) {
          FS.busy(decision === 'approve' ? 'סוגר את העסקה…' : 'שומר…');
          ACC.call('request-decide', { id: r.id, decision: decision, price: val('price'), answer: val('answer'), force: !!force }).then(function (x) {
            FS.busy();
            if (x.error === 'date-taken') { if (confirm('התאריך כבר תפוס ביומן (' + x.state.deals.map(function (d) { return d.title; }).join(', ') + '). לאשר בכל זאת?')) decide(decision, true); return; }
            if (!x.ok) return FS.toast(ACC.msg(x), 6000);
            c.setRequests(c.requests().map(function (q) { return q.id === r.id ? x.request : q; }));
            if (x.deal) c.setDeals(c.deals().concat([x.deal]));
            c.badge();
            FS.toast(decision === 'approve' ? '✔ אושרה. נפתחה עסקה מס׳ ' + x.deal.no + (x.mailed ? ' והלקוח קיבל מייל' : '') + '. אפשר לעדכן גם בוואטסאפ.' : decision === 'decline' ? 'הבקשה נדחתה' + (x.mailed ? ' והלקוח קיבל מייל' : '') : 'הוחזרה להמתנה', 6000);
            draw();
          });
        }
        el.querySelectorAll('[data-a]').forEach(function (b) {
          b.addEventListener('click', function () {
            var a = b.dataset.a;
            if (a === 'approve') decide('approve');
            if (a === 'decline' && confirm('לדחות את הבקשה של ' + r.name + '?')) decide('decline');
            if (a === 'reopen') decide('pending');
            if (a === 'del' && confirm('למחוק את הבקשה ' + r.ref + '?')) ACC.call('request-del', { id: r.id }).then(function (x) { if (!x.ok) return FS.toast(ACC.msg(x)); c.setRequests(c.requests().filter(function (q) { return q.id !== r.id; })); draw(); });
          });
        });
      });
    }
    $$('#rq-f button').forEach(function (b) { b.addEventListener('click', function () { filter = b.dataset.f; $$('#rq-f button').forEach(function (x) { x.classList.toggle('on', x === b); }); draw(); }); });
    $('#rq-refresh').addEventListener('click', function () { c.refresh().then(draw); });
    c.onRefresh(draw);
    draw();
  };

  /* ---------- the calendar: events, requests and busy dates by month; the Google Calendar link ---------- */
  V.calendar = function (m, c) {
    c.head(m, '🗓️ יומן', 'האירועים שנסגרו, בקשות שממתינות לך והתאריכים שסימנת כתפוסים. לפי היומן הזה האתר אומר ללקוחות אם התאריך פנוי.');
    var now = new Date(), ym = now.toISOString().slice(0, 7), DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
    m.insertAdjacentHTML('beforeend', '<div class="adm-row cal-nav"><button class="btn line small" id="cal-prev">→</button><h2 id="cal-t"></h2><button class="btn line small" id="cal-next">←</button><button class="btn line small" id="cal-today">היום</button>' +
      '<span class="cal-key"><i class="k-deal"></i>אירוע סגור <i class="k-rq"></i>בקשה ממתינה <i class="k-busy"></i>סימנת תפוס</span></div><div class="cal" id="cal"></div><div id="cal-day"></div>' +
      '<section class="adm-card"><h3>⚙️ זמינות</h3><div class="adm-row"><label class="adm-f"><span>כמה אירועים אני יכול לקבל באותו יום</span><div class="adm-in"><input type="number" min="1" max="10" id="cal-per" value="' + esc(num(c.settings().perDay) || 1) + '"></div></label><button class="btn gold small" id="cal-per-save">💾 שמירה</button></div>' +
      '<p class="hint">תאריך עם מספר האירועים הזה (עסקאות שנסגרו או ששולמה בהן מקדמה) מופיע באתר כתפוס. ימים שאתה לא עובד בהם: ב"📅 תאריכים תפוסים".</p></section>' +
      '<section class="adm-card"><h3>📆 היומן בטלפון (Google / Apple)</h3><p class="hint">קישור פרטי שהיומן שלך קורא ממנו את האירועים והבקשות, ומתעדכן לבד. ב־Google Calendar במחשב: ⚙️ הגדרות ← "הוספת יומן" ← "מכתובת URL" ← מדביקים. מי שיש לו את הקישור רואה את האירועים, אז לא משתפים אותו.</p><div class="adm-row" id="cal-link"></div></section>');
    function cellItems(iso) {
      var out = [];
      c.deals().forEach(function (d) { if (holds(d) && d.date === iso) out.push({ k: 'deal', t: (d.client || {}).name || 'אירוע', d: d }); });
      c.requests().forEach(function (r) { if (r.status === 'pending' && r.date === iso) out.push({ k: 'rq', t: r.name, r: r }); });
      if ((c.site().busy || []).indexOf(iso) > -1 && !out.some(function (x) { return x.k === 'deal'; })) out.push({ k: 'busy', t: 'תפוס' });
      return out;
    }
    function draw() {
      var y = +ym.slice(0, 4), mo = +ym.slice(5, 7) - 1, first = new Date(y, mo, 1), n = new Date(y, mo + 1, 0).getDate(), today = new Date().toISOString().slice(0, 10);
      $('#cal-t').textContent = MONTHS[mo] + ' ' + y;
      var h = DAYS.map(function (d) { return '<b class="cal-h">' + d + '</b>'; }).join('');
      for (var i = 0; i < first.getDay(); i++) h += '<span class="cal-c empty"></span>';
      for (var d = 1; d <= n; d++) {
        var iso = ym + '-' + ('0' + d).slice(-2), it = cellItems(iso), st = dayState(c, iso);
        h += '<button class="cal-c' + (iso === today ? ' today' : '') + (iso < today ? ' past' : '') + (!st.free ? ' full' : '') + '" data-d="' + iso + '"><span class="n">' + d + '</span>' + it.slice(0, 3).map(function (x) { return '<i class="k-' + x.k + '">' + esc(x.t) + '</i>'; }).join('') + (it.length > 3 ? '<i class="more">+' + (it.length - 3) + '</i>' : '') + '</button>';
      }
      $('#cal').innerHTML = h;
      $$('#cal [data-d]').forEach(function (b) { b.addEventListener('click', function () { day(b.dataset.d); }); });
    }
    function day(iso) {
      var it = cellItems(iso), st = dayState(c, iso);
      $('#cal-day').innerHTML = '<section class="adm-card"><h3>' + esc(longDate(iso)) + '</h3><p>' + calText(st) + '</p>' + (it.length ? '<ul class="adm-hist">' + it.map(function (x) {
        if (x.k === 'deal') return '<li><b>🧲 ' + esc(x.t) + ' · ' + evName(x.d.type) + '</b><small>' + esc([x.d.venue, (x.d.client || {}).phone, x.d.no ? 'עסקה ' + x.d.no : ''].filter(Boolean).join(' · ')) + ' · <a target="_blank" rel="noopener" href="studio.html?deal=' + encodeURIComponent(x.d.id) + '">פתיחה</a></small></li>';
        if (x.k === 'rq') return '<li><b>❓ ' + esc(x.r.ref) + ' · ' + esc(x.t) + '</b><small>' + esc(x.r.typeName || '') + ' · ' + esc(x.r.phone) + ' · <a href="#requests" data-go="requests">לאישור</a></small></li>';
        return '<li><b>⛔ סימנת את היום הזה כתפוס</b></li>';
      }).join('') + '</ul>' : '<p class="hint">אין כלום ביום הזה.</p>') + '</section>';
      $$('#cal-day [data-go]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); c.go('requests'); }); });
    }
    function link() {
      var box = $('#cal-link'), k = c.calKey();
      if (!k) { box.innerHTML = '<button class="btn gold small" id="cal-mk">🔗 יצירת קישור ליומן</button>'; $('#cal-mk').addEventListener('click', mk); return; }
      ACC.apiBase().then(function (u) {
        var url = u + '/frame-cal?k=' + k;
        box.innerHTML = '<input readonly dir="ltr" value="' + esc(url) + '" id="cal-url" class="grow"><button class="btn gold small" id="cal-copy">📋 העתקה</button><button class="btn line small" id="cal-mk">🔄 קישור חדש (הישן יפסיק)</button>';
        $('#cal-copy').addEventListener('click', function () { var i = $('#cal-url'); i.select(); (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { FS.toast('📋 הועתק'); }, function () { document.execCommand('copy'); FS.toast('📋 הועתק'); }); });
        $('#cal-mk').addEventListener('click', function () { if (confirm('ליצור קישור חדש? היומן שמחובר לקישור הישן יפסיק להתעדכן.')) mk(); });
      });
    }
    function mk() { ACC.call('cal-key').then(function (r) { if (!r.ok) return FS.toast(ACC.msg(r)); c.setCalKey(r.calKey); link(); }); }
    $('#cal-prev').addEventListener('click', function () { var d = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 2, 1); ym = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); draw(); });
    $('#cal-next').addEventListener('click', function () { var d = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 1); ym = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); draw(); });
    $('#cal-today').addEventListener('click', function () { ym = new Date().toISOString().slice(0, 7); draw(); });
    $('#cal-per-save').addEventListener('click', function () {
      var s = Object.assign({}, c.settings(), { perDay: Math.max(1, Math.min(10, num($('#cal-per').value) || 1)) });
      ACC.call('settings-save', { settings: s }).then(function (r) { if (!r.ok) return FS.toast(ACC.msg(r)); c.setSettings(s); draw(); FS.toast('✔ נשמר. האתר מתעדכן לפי זה.'); });
    });
    c.onRefresh(draw);
    draw(); link();
  };

  /* ---------- customers: everyone who opened an account, with their designs, requests and deals ---------- */
  V.customers = function (m, c) {
    c.head(m, '👥 לקוחות', 'כל מי שנרשם באתר (עורך המסגרות או בקשת הזמנה), ומי שהשאיר בקשה בלי חשבון. הכול שמור בשרת ולא נמחק.');
    var q = '';
    m.insertAdjacentHTML('beforeend', '<div class="adm-row"><a class="btn gold small" href="./" target="_blank" rel="noopener">🌐 האתר ללקוחות</a><a class="btn line small" href="design.html" target="_blank" rel="noopener">🎨 עורך המסגרות (הרשמה וכניסה ללקוחות)</a><input id="cu-q" placeholder="חיפוש לפי שם, מייל או טלפון…"></div><div id="cu-list"></div><div id="cu-one"></div>');
    function phoneKey(p) { return String(p || '').replace(/\D/g, '').replace(/^972/, '0'); }
    function people() {
      var map = {};
      function get(key, seed) { if (!map[key]) map[key] = Object.assign({ email: '', name: '', phone: '', designs: 0, requests: [], deals: [], account: null }, seed || {}); return map[key]; }
      (c.accounts() || []).forEach(function (a) { var p = get(a.email, { email: a.email, name: a.name, phone: a.phone }); p.account = a; });
      c.customers().forEach(function (x) { var p = get(x.email, { email: x.email }); p.designs = x.designs; p.last = x.last; });
      function byContact(email, phone, name) {
        if (email && map[email]) return map[email];
        var pk = phoneKey(phone); if (pk) for (var k in map) if (phoneKey(map[k].phone) === pk) return map[k];
        return get(email || ('tel:' + pk), { email: email || '', name: name || '', phone: phone || '' });
      }
      c.requests().forEach(function (r) { var p = byContact(r.email || r.by, r.phone, r.name); p.requests.push(r); if (!p.phone) p.phone = r.phone; if (!p.name) p.name = r.name; });
      c.deals().forEach(function (d) { var cl = d.client || {}; if (!cl.email && !cl.phone) return; var p = byContact(String(cl.email || '').toLowerCase(), cl.phone, cl.name); p.deals.push(d); if (!p.name) p.name = cl.name; });
      return Object.keys(map).map(function (k) { var p = map[k]; p.key = k; p.seen = Math.max(p.last || 0, Date.parse((p.account || {}).lastSeen || '') || 0, Date.parse((p.account || {}).lastLogin || '') || 0, p.requests.reduce(function (mx, r) { return Math.max(mx, r.at || 0); }, 0)); return p; })
        .sort(function (a, b) { return b.seen - a.seen; });
    }
    function draw() {
      var l = people().filter(function (p) { return !q || (p.name + ' ' + p.email + ' ' + p.phone + ' ' + phoneKey(p.phone)).toLowerCase().indexOf(q.toLowerCase()) > -1; });
      $('#cu-list').innerHTML = l.length ? '<table class="adm-tbl"><thead><tr><th>לקוח</th><th>חשבון</th><th>פעילות אחרונה</th><th>עיצובים</th><th>בקשות</th><th>עסקאות</th><th></th></tr></thead><tbody>' + l.map(function (p) {
        var a = p.account;
        return '<tr data-k="' + esc(p.key) + '"><td><b>' + esc(p.name || '—') + '</b><small dir="ltr">' + esc(p.email || '') + '</small><small>' + esc(p.phone || '') + '</small></td>' +
          '<td>' + (a ? (a.active ? (a.online ? '<span class="dot on"></span>מחובר' : '✔ פעיל') : '⛔ חסום') + '<small>נרשם ' + (a.createdAt ? new Date(a.createdAt).toLocaleDateString('he-IL') : '') + '</small>' : '<small>בלי חשבון</small>') + '</td>' +
          '<td>' + (p.seen ? new Date(p.seen).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—') + '</td><td>' + (p.designs || 0) + '</td><td>' + p.requests.length + (p.requests.some(function (r) { return r.status === 'pending'; }) ? ' ⏳' : '') + '</td><td>' + p.deals.length + '</td>' +
          '<td class="act"><button data-a="open" title="הכול על הלקוח">👁</button>' + (p.phone ? '<a target="_blank" rel="noopener" href="' + esc(waLink(p.phone, 'שלום ' + (p.name || '') + ',')) + '" title="וואטסאפ">💬</a>' : '') + (p.email ? '<a href="mailto:' + esc(p.email) + '" title="מייל">✉️</a>' : '') + '</td></tr>';
      }).join('') + '</tbody></table>' : '<p class="hint">' + (q ? 'לא נמצא.' : 'עוד אין לקוחות. לקוחות נרשמים בעורך המסגרות (design.html ← "👤 החשבון שלי") או שולחים בקשת הזמנה באתר.') + '</p>';
      $$('#cu-list tr[data-k]').forEach(function (tr) { $('[data-a=open]', tr).addEventListener('click', function () { one(people().filter(function (p) { return p.key === tr.dataset.k; })[0]); }); });
    }
    function one(p) {
      var a = p.account, box = $('#cu-one');
      box.innerHTML = '<section class="adm-card cu-one"><div class="adm-card-h"><h3>' + esc(p.name || p.email || p.phone) + '</h3><button class="btn line small" id="cu-x">✕</button></div>' +
        '<dl class="cu-dl"><dt>מייל</dt><dd dir="ltr">' + esc(p.email || '—') + '</dd><dt>טלפון</dt><dd>' + esc(p.phone || '—') + '</dd>' +
        (a ? '<dt>חשבון</dt><dd>' + (a.active ? '✔ פעיל' : '⛔ חסום') + (a.online ? ' · מחובר עכשיו' : '') + '</dd><dt>נרשם</dt><dd>' + (a.createdAt ? new Date(a.createdAt).toLocaleString('he-IL') : '—') + '</dd><dt>כניסה אחרונה</dt><dd>' + (a.lastLogin ? new Date(a.lastLogin).toLocaleString('he-IL') : '—') + '</dd>' : '<dt>חשבון</dt><dd>לא נרשם (השאיר בקשה)</dd>') + '</dl>' +
        '<div class="act-row">' + (p.phone ? '<a class="btn gold small" target="_blank" rel="noopener" href="' + esc(waLink(p.phone, 'שלום ' + (p.name || '') + ',')) + '">💬 וואטסאפ</a><a class="btn line small" href="tel:' + esc(p.phone) + '">📞 חיוג</a>' : '') + (p.email ? '<a class="btn line small" href="mailto:' + esc(p.email) + '">✉️ מייל</a>' : '') +
        (a && a.only ? '<button class="btn line small" id="cu-block">' + (a.active ? '⛔ חסימת החשבון' : '✔ הפעלת החשבון') + '</button>' : '') + '</div>' +
        '<h4>📥 בקשות הזמנה</h4>' + (p.requests.length ? '<ul class="adm-hist">' + p.requests.map(function (r) { return '<li><b>' + esc(r.ref) + ' · ' + esc(longDate(r.date)) + ' · ' + esc(r.typeName || '') + '</b><small>' + (STATUS[r.status] || STATUS.pending)[1] + '</small></li>'; }).join('') + '</ul>' : '<p class="hint">אין.</p>') +
        '<h4>📑 עסקאות</h4>' + (p.deals.length ? '<ul class="adm-hist">' + p.deals.map(function (d) { var t = totals(d, c.settings()); return '<li><b>' + esc(heDate(d.date)) + ' · ' + evName(d.type) + (d.no ? ' · עסקה ' + esc(d.no) : '') + '</b><small>' + money(t.total) + ' · ' + (t.balance > 0 ? 'יתרה ' + money(t.balance) : 'שולם ✔') + ' · <a target="_blank" rel="noopener" href="studio.html?deal=' + encodeURIComponent(d.id) + '">פתיחה</a></small></li>'; }).join('') + '</ul>' : '<p class="hint">אין.</p>') +
        '<h4>🎨 עיצובים</h4><div id="cu-designs">' + (p.email && p.designs ? '…' : '<p class="hint">אין עיצובים שמורים.</p>') + '</div></section>';
      $('#cu-x').addEventListener('click', function () { box.innerHTML = ''; });
      var bl = $('#cu-block'); if (bl) bl.addEventListener('click', function () {
        if (!confirm(a.active ? 'לחסום את ' + p.email + '? הלקוח ינותק ולא יוכל להיכנס עד שתפעיל שוב.' : 'להפעיל שוב את ' + p.email + '?')) return;
        ACC.call('account-set', { email: p.email, active: !a.active }).then(function (r) { if (!r.ok) return FS.toast(ACC.msg(r)); a.active = r.active; FS.toast(r.active ? '✔ החשבון פעיל' : '⛔ החשבון נחסם'); one(p); draw(); });
      });
      if (p.email && p.designs) ACC.call('designs-of', { email: p.email }).then(function (r) {
        if (!r.ok) return FS.toast(ACC.msg(r));
        $('#cu-designs').innerHTML = '<div class="dz-mine">' + r.designs.map(function (d) { return '<figure><img src="' + esc(d.thumb || '') + '" alt=""><figcaption><b>' + esc(d.name || 'עיצוב') + '</b><small>' + new Date(d.at).toLocaleDateString('he-IL') + '</small></figcaption><div><a class="btn small" target="_blank" rel="noopener" href="design.html?owner&open=' + encodeURIComponent(p.email + ':' + d.id) + '">פתיחה בעורך</a></div></figure>'; }).join('') + '</div>';
      });
      box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    $('#cu-q').addEventListener('input', function () { q = this.value.trim(); draw(); });
    c.onRefresh(draw);
    draw();
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

  FS.adminBiz = { view: function (k, m, c) { V[k](m, c); }, month: month, money: money, totals: totals, openBalance: openBalance, upcoming: upcoming, dayState: dayState, longDate: longDate };
})();
