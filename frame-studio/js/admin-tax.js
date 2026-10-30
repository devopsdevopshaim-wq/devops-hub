/* The accountant and the tax authorities: everything the owner hands over, prepared from what the site already knows (the
   magnet deals and their payments, the אופטימוס licence payments with their receipt numbers, the expenses).
   - a monthly package for the accountant (income by source, expenses by category, VAT and income-tax advances, open balances,
     missing documents): to print, to Excel (CSV) and by email straight to the accountant, with the CSV attached;
   - VAT and advances per reporting period, with what was already paid;
   - the year: a profit-and-loss summary for the annual report, the exempt dealer's turnover declaration, an income declaration;
   - the deadlines ahead, closing each month, the reports already sent, and the habits of a well-kept business.
   Everything is a draft for the accountant: the official reports are filed by him, or by the owner on the tax authority's site.
   Settings live in the business settings (settings.tax), on the server. */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$, ACC = FS.account;
  FS.adminTax = function (m, c) {
    var B = FS.adminBiz, esc = c.esc, num = B.num, money = B.money, MONTHS = B.MONTHS, METHODS = B.METHODS, heDate = B.heDate;
    var now = new Date(), lastYm = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 15)).toISOString().slice(0, 7);
    var T = Object.assign({ vatFreq: 2, advFreq: 2, advPct: '', niMonthly: '', ceiling: 120000, close: {}, paid: [] }, c.settings().tax || {});
    var tab = 'month', ym = lastYm, year = String(lastYm.slice(0, 4)), LICPAYS = [];
    function P() { return B.pay(c.settings()); }
    /* a calendar date as YYYY-MM-DD without the time zone moving it (month may run past 12 or below 1) */
    function isoOf(y, mo0, d) { var t = new Date(Date.UTC(y, mo0, d, 12)); return t.toISOString().slice(0, 10); }
    function vatIn() { var t = P().bizType; return t === 'מורשה' || t === 'חברה'; }
    function biz() { var s = c.site() || {}, p = P(); return { name: s.name || 'פריים מגנטים', owner: s.owner || '', phone: s.phone || '', email: s.email || '', kind: p.bizType === 'חברה' ? 'חברה בע״מ' : 'עוסק ' + (p.bizType || 'פטור'), id: p.bizId || '', address: p.address || '' }; }
    function ymName(x) { return MONTHS[Number(x.slice(5, 7)) - 1] + ' ' + x.slice(0, 4); }
    function save(msg) {
      var s = Object.assign({}, c.settings(), { tax: T });
      return ACC.call('settings-save', { settings: s }).then(function (r) { if (!r.ok) { FS.toast(ACC.msg(r), 6000); return false; } c.setSettings(s); if (msg) FS.toast(msg); return true; });
    }

    /* ---------- the numbers: magnet payments + אופטימוס licence payments, expenses ---------- */
    function monthData(x) {
      var r = B.month(c.deals(), c.expenses(), c.settings(), x), rate = r.rate;
      r.rows.forEach(function (row) { row.src = 'מגנטים'; });
      LICPAYS.filter(function (p) { return String(p.date || '').slice(0, 7) === x; }).forEach(function (p) { r.rows.push(p); });
      r.rows.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      r.income = r.rows.reduce(function (s, x2) { return s + num(x2.amount); }, 0);
      r.bySrc = {}; r.byMethod = {};
      r.rows.forEach(function (x2) { r.bySrc[x2.src] = (r.bySrc[x2.src] || 0) + num(x2.amount); var mk = METHODS[x2.method] || x2.method || 'אחר'; r.byMethod[mk] = (r.byMethod[mk] || 0) + num(x2.amount); });
      r.byCat = {}; r.ex.forEach(function (e) { r.byCat[e.cat || 'אחר'] = (r.byCat[e.cat || 'אחר'] || 0) + num(e.amount); });
      r.outVat = r.vatIn ? r.income * rate / (100 + rate) : 0; r.vatDue = r.outVat - r.expVat;
      r.net = r.income - r.outVat;                                   /* the turnover without VAT: what advances are counted on */
      r.expNet = r.expTotal - r.expVat;
      r.profit = r.net - r.expNet;
      r.adv = num(T.advPct) > 0 ? r.net * num(T.advPct) / 100 : 0;
      r.missing = r.ex.filter(function (e) { return !e.ref; });
      r.paid = (T.paid || []).filter(function (p) { return String(p.date || '').slice(0, 7) === x; });
      return r;
    }
    function rangeData(yms) {
      var out = { months: yms.map(monthData), income: 0, outVat: 0, expTotal: 0, expVat: 0, net: 0, expNet: 0, profit: 0, adv: 0, bySrc: {}, byCat: {}, byMethod: {}, events: 0 };
      out.months.forEach(function (r) {
        ['income', 'outVat', 'expTotal', 'expVat', 'net', 'expNet', 'profit', 'adv'].forEach(function (k) { out[k] += r[k]; });
        out.events += r.events.length;
        ['bySrc', 'byCat', 'byMethod'].forEach(function (k) { Object.keys(r[k]).forEach(function (x) { out[k][x] = (out[k][x] || 0) + r[k][x]; }); });
      });
      out.vatDue = out.outVat - out.expVat; return out;
    }
    function yearMonths(y) { var l = []; for (var i = 1; i <= 12; i++) l.push(y + '-' + ('0' + i).slice(-2)); return l; }
    /* a reporting period (1 or 2 months) that holds the month x */
    function periodOf(x, freq) { var y = x.slice(0, 4), mo = Number(x.slice(5, 7)); if (Number(freq) !== 2) return [x]; var f = mo % 2 ? mo : mo - 1; return [y + '-' + ('0' + f).slice(-2), y + '-' + ('0' + (f + 1)).slice(-2)]; }
    function periodName(l) { return l.length === 1 ? ymName(l[0]) : MONTHS[Number(l[0].slice(5, 7)) - 1] + '–' + MONTHS[Number(l[1].slice(5, 7)) - 1] + ' ' + l[0].slice(0, 4); }
    function openBalances() {
      var today = new Date().toISOString().slice(0, 10);
      return c.deals().filter(function (d) { return d.closed && !d.cancelled && d.date && d.date <= today; }).map(function (d) { return { d: d, t: B.totals(d, c.settings()) }; }).filter(function (x) { return x.t.balance > 0.5; });
    }
    function stats(l) { return '<div class="adm-stats">' + l.map(function (s) { return '<div><i>' + s[0] + '</i><b>' + s[1] + '</b><small>' + s[2] + '</small></div>'; }).join('') + '</div>'; }
    function kv(obj) { var ks = Object.keys(obj).filter(function (k) { return Math.abs(obj[k]) > 0.004; }); return ks.length ? '<table class="adm-tbl"><tbody>' + ks.sort(function (a, b) { return obj[b] - obj[a]; }).map(function (k) { return '<tr><td>' + esc(k) + '</td><td>' + money(obj[k]) + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="hint">—</p>'; }
    function bizLine() { var b = biz(); return '<p class="tx-biz"><b>' + esc(b.name) + '</b> · ' + esc(b.kind) + (b.id ? ' · מס׳ ' + esc(b.id) : '') + (b.owner ? ' · ' + esc(b.owner) : '') + (b.address ? ' · ' + esc(b.address) : '') + '</p>'; }
    var NOTE = '<p class="tx-note">הוכן ממערכת הניהול של העסק, לשימוש רואה החשבון. הסכומים כפי שנרשמו; מע״מ ומקדמות הם חישוב משוער. הדיווח הרשמי נעשה על ידי רואה החשבון או באתר רשות המסים.</p>';

    /* ---------- the monthly package ---------- */
    function monthHtml(x) {
      var r = monthData(x), ob = openBalances();
      return bizLine() + '<h2>דוח חודשי לרואה החשבון · ' + ymName(x) + '</h2>' +
        stats([['💵', money(r.income), 'הכנסות (תקבולים)'], ['💸', money(r.expTotal), 'הוצאות'], ['📈', money(r.profit), r.vatIn ? 'רווח (לפני מס, בלי מע״מ)' : 'רווח (לפני מס)'], ['🧾', r.rows.length, 'קבלות / תקבולים']]
          .concat(r.vatIn ? [['🏛️', money(r.vatDue), 'מע״מ (משוער)']] : []).concat(r.adv ? [['📤', money(r.adv), 'מקדמת מס הכנסה (משוער)']] : [])) +
        '<h3>הכנסות לפי תאריך התשלום</h3>' + (r.rows.length ? '<table class="adm-tbl"><thead><tr><th>תאריך</th><th>מס׳ קבלה / אישור</th><th>מקור</th><th>לקוח</th><th>אמצעי</th><th>אסמכתא</th><th>סכום</th></tr></thead><tbody>' +
          r.rows.map(function (x2) { return '<tr><td>' + heDate(x2.date) + '</td><td>' + esc(x2.no || '') + '</td><td>' + esc(x2.src) + '</td><td>' + esc(x2.client) + '</td><td>' + esc(METHODS[x2.method] || x2.method || '') + '</td><td>' + esc(x2.ref || '') + '</td><td>' + money(x2.amount) + '</td></tr>'; }).join('') +
          '<tr class="tot"><td colspan="6">סה״כ הכנסות</td><td>' + money(r.income) + '</td></tr></tbody></table>' : '<p class="hint">אין תקבולים בחודש הזה.</p>') +
        '<div class="tx-two"><div><h3>לפי מקור</h3>' + kv(r.bySrc) + '</div><div><h3>לפי אמצעי תשלום</h3>' + kv(r.byMethod) + '</div></div>' +
        '<h3>הוצאות</h3>' + (r.ex.length ? '<table class="adm-tbl"><thead><tr><th>תאריך</th><th>תיאור</th><th>קטגוריה</th><th>ספק</th><th>חשבונית / קבלה</th><th>מע״מ</th><th>סכום</th></tr></thead><tbody>' +
          r.ex.map(function (e) { return '<tr><td>' + heDate(e.date) + '</td><td>' + esc(e.desc) + '</td><td>' + esc(e.cat) + '</td><td>' + esc(e.supplier) + '</td><td>' + (e.ref ? esc(e.ref) : '<b class="tx-warn">חסר</b>') + '</td><td>' + (e.vat ? 'כולל' : '—') + '</td><td>' + money(e.amount) + '</td></tr>'; }).join('') +
          '<tr class="tot"><td colspan="6">סה״כ הוצאות</td><td>' + money(r.expTotal) + '</td></tr></tbody></table>' : '<p class="hint">לא נרשמו הוצאות בחודש הזה.</p>') +
        '<h3>הוצאות לפי סוג</h3>' + kv(r.byCat) +
        (r.vatIn ? '<h3>מע״מ (' + r.rate + '%)</h3><table class="adm-tbl"><tbody><tr><td>מע״מ עסקאות (מתוך ההכנסות)</td><td>' + money(r.outVat) + '</td></tr><tr><td>מע״מ תשומות (הוצאות עם חשבונית מס)</td><td>' + money(r.expVat) + '</td></tr><tr class="tot"><td>לתשלום (משוער)</td><td>' + money(r.vatDue) + '</td></tr></tbody></table>' : '') +
        (r.adv ? '<p class="adm-by">מקדמת מס הכנסה: ' + num(T.advPct) + '% × מחזור ' + money(r.net) + ' = <b>' + money(r.adv) + '</b></p>' : '') +
        (r.paid.length ? '<h3>תשלומים לרשויות שנרשמו החודש</h3><table class="adm-tbl"><tbody>' + r.paid.map(function (p) { return '<tr><td>' + heDate(p.date) + '</td><td>' + esc(p.kind) + '</td><td>' + esc(p.period || '') + '</td><td>' + esc(p.ref || '') + '</td><td>' + money(p.amount) + '</td></tr>'; }).join('') + '</tbody></table>' : '') +
        (r.missing.length ? '<h3>⚠️ הוצאות בלי מספר חשבונית / קבלה (' + r.missing.length + ')</h3><p class="hint">בלי מסמך, רואה החשבון לא יכול להכיר בהוצאה. מצרפים את המסמכים.</p>' : '') +
        (ob.length ? '<h3>יתרות פתוחות של לקוחות (אירועים שעברו)</h3><table class="adm-tbl"><tbody>' + ob.map(function (o) { return '<tr><td>' + heDate(o.d.date) + '</td><td>' + esc((o.d.client || {}).name || '') + '</td><td>' + esc(o.d.no || '') + '</td><td>' + money(o.t.balance) + '</td></tr>'; }).join('') + '</tbody></table>' : '') + NOTE;
    }
    function monthCsv(x) {
      var r = monthData(x), rows = [['סוג', 'תאריך', 'מס׳ קבלה/אסמכתא', 'מקור', 'לקוח/ספק', 'אמצעי/קטגוריה', 'תיאור', 'מע״מ', 'סכום']];
      r.rows.forEach(function (x2) { rows.push(['הכנסה', x2.date, x2.no || '', x2.src, x2.client, METHODS[x2.method] || x2.method || '', x2.ref || '', '', num(x2.amount)]); });
      r.ex.forEach(function (e) { rows.push(['הוצאה', e.date, e.ref || 'חסר', '', e.supplier, e.cat, e.desc, e.vat ? 'כולל' : '', -num(e.amount)]); });
      rows.push([]); rows.push(['סה״כ הכנסות', '', '', '', '', '', '', '', round(r.income)]); rows.push(['סה״כ הוצאות', '', '', '', '', '', '', '', round(r.expTotal)]);
      if (r.vatIn) { rows.push(['מע״מ עסקאות', '', '', '', '', '', '', '', round(r.outVat)]); rows.push(['מע״מ תשומות', '', '', '', '', '', '', '', round(r.expVat)]); rows.push(['מע״מ לתשלום (משוער)', '', '', '', '', '', '', '', round(r.vatDue)]); }
      rows.push(['רווח', '', '', '', '', '', '', '', round(r.profit)]); if (r.adv) rows.push(['מקדמת מס הכנסה (משוער)', '', '', '', '', '', '', '', round(r.adv)]);
      return rows;
    }
    function round(v) { return Math.round(v * 100) / 100; }
    function csvText(rows) { return '﻿' + rows.map(function (r) { return r.map(function (x) { x = String(x == null ? '' : x); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }).join(','); }).join('\r\n'); }

    /* ---------- VAT and advances per reporting period ---------- */
    function vatHtml(y) {
      var seen = {}, pers = [];
      yearMonths(y).forEach(function (x) { var p = periodOf(x, T.vatFreq); if (!seen[p[0]]) { seen[p[0]] = 1; pers.push(p); } });
      var due = function (p) { var last = p[p.length - 1]; return isoOf(Number(last.slice(0, 4)), Number(last.slice(5, 7)), 15); };
      var paidFor = function (kind, name) { return (T.paid || []).filter(function (x) { return x.kind === kind && x.period === name; }).reduce(function (s, x) { return s + num(x.amount); }, 0); };
      return bizLine() + '<h2>מע״מ ומקדמות · ' + y + '</h2>' +
        '<p class="hint">' + (vatIn() ? 'דיווח מע״מ ' + (Number(T.vatFreq) === 2 ? 'דו־חודשי' : 'חודשי') + ' (' + P().vat + '%).' : 'עוסק פטור: אין דיווח מע״מ תקופתי, רק הצהרה שנתית על המחזור (בלשונית "שנתי").') + ' ' + (num(T.advPct) ? 'מקדמות מס הכנסה: ' + num(T.advPct) + '% מהמחזור.' : 'אחוז המקדמות לא הוגדר (לשונית "מועדים והגדרות").') + '</p>' +
        '<table class="adm-tbl"><thead><tr><th>תקופה</th><th>מחזור (בלי מע״מ)</th>' + (vatIn() ? '<th>מע״מ עסקאות</th><th>מע״מ תשומות</th><th>מע״מ לתשלום</th><th>שולם</th>' : '') + '<th>מקדמה</th><th>שולם</th><th>מועד</th></tr></thead><tbody>' +
        pers.map(function (p) {
          var r = rangeData(p), name = periodName(p), vp = paidFor('מע״מ', name), ap = paidFor('מקדמת מס הכנסה', name), d = due(p), late = d < new Date().toISOString().slice(0, 10);
          return '<tr><td>' + esc(name) + '</td><td>' + money(r.net) + '</td>' + (vatIn() ? '<td>' + money(r.outVat) + '</td><td>' + money(r.expVat) + '</td><td><b>' + money(r.vatDue) + '</b></td><td>' + (vp ? '✔ ' + money(vp) : late && r.vatDue > 0 ? '<b class="tx-warn">לא נרשם</b>' : '—') + '</td>' : '') +
            '<td>' + (r.adv ? '<b>' + money(r.adv) + '</b>' : '—') + '</td><td>' + (ap ? '✔ ' + money(ap) : late && r.adv > 0 ? '<b class="tx-warn">לא נרשם</b>' : '—') + '</td><td>' + heDate(d) + '</td></tr>';
        }).join('') + '</tbody></table>' + NOTE;
    }

    /* ---------- the year ---------- */
    function yearHtml(y) {
      var R = rangeData(yearMonths(y)), b = biz(), paid = (T.paid || []).filter(function (p) { return String(p.date || '').slice(0, 4) === String(y); }), byKind = {};
      paid.forEach(function (p) { byKind[p.kind] = (byKind[p.kind] || 0) + num(p.amount); });
      var ceil = num(T.ceiling) || 120000, exempt = !vatIn();
      return bizLine() + '<h2>ריכוז שנתי לדוח למס הכנסה · ' + y + '</h2>' +
        stats([['💵', money(R.income), 'הכנסות (תקבולים)'], ['💸', money(R.expTotal), 'הוצאות'], ['📈', money(R.profit), 'רווח לפני מס'], ['🎉', R.events, 'אירועים']]) +
        '<h3>דוח רווח והפסד (תמצית)</h3><table class="adm-tbl"><tbody>' +
        '<tr><td>מחזור הכנסות' + (vatIn() ? ' (בלי מע״מ)' : '') + '</td><td>' + money(R.net) + '</td></tr>' +
        Object.keys(R.bySrc).map(function (k) { return '<tr><td>&nbsp;&nbsp;מתוכן: ' + esc(k) + '</td><td>' + money(R.bySrc[k]) + '</td></tr>'; }).join('') +
        Object.keys(R.byCat).sort(function (a2, b2) { return R.byCat[b2] - R.byCat[a2]; }).map(function (k) { return '<tr><td>הוצאות: ' + esc(k) + '</td><td>(' + money(R.byCat[k]) + ')</td></tr>'; }).join('') +
        '<tr class="tot"><td>רווח לפני מס</td><td>' + money(R.profit) + '</td></tr></tbody></table>' +
        '<h3>לפי חודשים</h3><table class="adm-tbl"><thead><tr><th>חודש</th><th>הכנסות</th><th>הוצאות</th><th>רווח</th>' + (vatIn() ? '<th>מע״מ</th>' : '') + '</tr></thead><tbody>' +
        R.months.map(function (r, i) { return '<tr><td>' + MONTHS[i] + '</td><td>' + money(r.income) + '</td><td>' + money(r.expTotal) + '</td><td>' + money(r.profit) + '</td>' + (vatIn() ? '<td>' + money(r.vatDue) + '</td>' : '') + '</tr>'; }).join('') +
        '<tr class="tot"><td>סה״כ</td><td>' + money(R.income) + '</td><td>' + money(R.expTotal) + '</td><td>' + money(R.profit) + '</td>' + (vatIn() ? '<td>' + money(R.vatDue) + '</td>' : '') + '</tr></tbody></table>' +
        '<h3>תשלומים לרשויות בשנה</h3>' + kv(byKind) +
        (exempt ? '<p class="adm-by">עוסק פטור: מחזור השנה ' + money(R.income) + ' מתוך תקרה של ' + money(ceil) + ' (' + Math.round(R.income / ceil * 100) + '%).' + (R.income > ceil ? ' <b class="tx-warn">עבר את התקרה: לדבר עם רואה החשבון על מעבר לעוסק מורשה.</b>' : R.income > ceil * 0.85 ? ' <b class="tx-warn">קרוב לתקרה.</b>' : '') + '</p>' : '') +
        '<p class="hint">' + esc(b.owner || b.name) + ' · ' + esc(b.kind) + (b.id ? ' ' + esc(b.id) : '') + '</p>' + NOTE;
    }
    function sign(b) { return '<div class="tx-sign"><div>תאריך: ____________</div><div>שם: ' + esc(b.owner || '') + '</div><div>חתימה: ____________</div></div>'; }
    /* the exempt dealer's yearly turnover declaration (VAT), as a filled draft */
    function exemptHtml(y) {
      var R = rangeData(yearMonths(y)), b = biz();
      return '<h2>הצהרה על מחזור עסקאות של עוסק פטור · שנת ' + y + '</h2><p class="tx-note">טיוטה מלאה לפי הרישומים. ההצהרה הרשמית מוגשת לרשות המסים (מע״מ) עד 31 בינואר של השנה הבאה, באתר רשות המסים או במשרד מע״מ, או על ידי רואה החשבון.</p>' +
        '<table class="adm-tbl"><tbody><tr><td>שם העוסק</td><td>' + esc(b.owner || b.name) + '</td></tr><tr><td>שם העסק</td><td>' + esc(b.name) + '</td></tr><tr><td>מספר עוסק / ת.ז.</td><td>' + esc(b.id || '__________') + '</td></tr><tr><td>כתובת</td><td>' + esc(b.address || '__________') + '</td></tr>' +
        '<tr><td>תקופה</td><td>1.1.' + y + ' – 31.12.' + y + '</td></tr><tr class="tot"><td>מחזור העסקאות בשנה</td><td>' + money(R.income) + '</td></tr></tbody></table>' +
        '<p>אני הח״מ מצהיר כי מחזור העסקאות שלי בשנת ' + y + ' היה ' + money(R.income) + ', כמפורט ברישומי העסק.</p>' + sign(b);
    }
    /* a general declaration of income for the year (for a bank, National Insurance, an authority that asks) */
    function incomeHtml(y) {
      var R = rangeData(yearMonths(y)), b = biz();
      return '<h2>הצהרה על הכנסות מעסק · שנת ' + y + '</h2><p class="tx-note">טיוטה לפי רישומי העסק. לשימוש מול בנק, ביטוח לאומי או גוף שמבקש; תצהיר בפני עורך דין או אישור רואה חשבון נעשים אצלם.</p>' +
        '<p>אני הח״מ, ' + esc(b.owner || '__________') + ', ת.ז. / מס׳ עוסק ' + esc(b.id || '__________') + ', בעל העסק "' + esc(b.name) + '" (' + esc(b.kind) + '), מצהיר כי בשנת ' + y + ':</p>' +
        '<table class="adm-tbl"><tbody><tr><td>הכנסות העסק (תקבולים)</td><td>' + money(R.income) + '</td></tr><tr><td>הוצאות העסק</td><td>' + money(R.expTotal) + '</td></tr><tr class="tot"><td>הכנסה (רווח) לפני מס</td><td>' + money(R.profit) + '</td></tr><tr><td>ממוצע חודשי (רווח)</td><td>' + money(R.profit / 12) + '</td></tr></tbody></table>' +
        '<p>הנתונים לפי רישומי העסק, לפני ביקורת רואה חשבון ולפני מס.</p>' + sign(b);
    }

    /* ---------- deadlines ahead ---------- */
    function deadlines() {
      var out = [], t = new Date(), today = t.toISOString().slice(0, 10), y = t.getFullYear(), mo = t.getMonth();
      for (var i = 0; i < 3; i++) {
        var iso = isoOf(y, mo + i, 15), prev = isoOf(y, mo + i - 1, 15).slice(0, 7), last2 = periodOf(prev, 2)[1] === prev;
        if (isoOf(y, mo + i, 6) >= today) out.push([isoOf(y, mo + i, 6), '📦 סגירת החודש ושליחה לרואה החשבון', ymName(prev)]);
        if (iso < today) continue;
        if (vatIn() && (Number(T.vatFreq) !== 2 || last2)) out.push([iso, '🏛️ דיווח ותשלום מע״מ', periodName(periodOf(prev, T.vatFreq))]);
        if (num(T.advPct) && (Number(T.advFreq) !== 2 || last2)) out.push([iso, '📤 מקדמת מס הכנסה', periodName(periodOf(prev, T.advFreq))]);
        if (num(T.niMonthly)) out.push([iso, '🛡️ מקדמת ביטוח לאומי', money(T.niMonthly) + ' (בדרך כלל בהוראת קבע)']);
      }
      var jan = (mo === 0 ? y : y + 1) + '-01-31';
      if (!vatIn()) out.push([jan, '📝 הצהרת עוסק פטור על מחזור השנה', 'שנת ' + (Number(jan.slice(0, 4)) - 1)]);
      out.push([(mo < 5 ? y : y + 1) + '-05-31', '📑 דוח שנתי למס הכנסה (המועד המדויק ואורכות: לפי רואה החשבון)', 'שנת ' + ((mo < 5 ? y : y + 1) - 1)]);
      return out.sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
    }
    var CLOSE = [['income', 'כל התקבולים נרשמו (עסקאות ואופטימוס) והונפקה קבלה לכל תשלום'], ['exp', 'כל ההוצאות נרשמו, עם מספר חשבונית / קבלה'], ['docs', 'המסמכים (חשבוניות, קבלות) נשמרו בתיקייה של החודש'], ['bank', 'דף הבנק נבדק מול ההכנסות וההוצאות'], ['sent', 'הדוח נשלח לרואה החשבון']];

    /* ---------- the screen ---------- */
    c.head(m, '🧮 רואה חשבון ומיסים', 'הדוחות לרואה החשבון, מע״מ ומקדמות, הריכוז השנתי למס הכנסה וההצהרות, המועדים וסגירת החודש. הכל להדפסה, לאקסל ולשליחה במייל.');
    m.insertAdjacentHTML('beforeend', '<div class="seg tx-tabs" id="tx-tabs"><button data-t="month" class="on">📦 חודשי לרו״ח</button><button data-t="vat">🏛️ מע״מ ומקדמות</button><button data-t="year">📑 שנתי ומס הכנסה</button><button data-t="manage">📅 מועדים והגדרות</button></div><div id="tx-body"></div>');
    var years = {}; years[now.getFullYear()] = 1; years[now.getFullYear() - 1] = 1;
    c.deals().forEach(function (d) { (d.payments || []).forEach(function (p) { if (p.date) years[p.date.slice(0, 4)] = 1; }); }); c.expenses().forEach(function (e) { if (e.date) years[e.date.slice(0, 4)] = 1; });
    function yearSel() { return '<select id="tx-year">' + Object.keys(years).sort().reverse().map(function (y) { return '<option' + (String(y) === String(year) ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select>'; }
    function actions(extra) { return '<div class="adm-row tx-act"><button class="btn gold" data-x="print">🖨 הדפסה</button><button class="btn gold" data-x="mail">✉️ שליחה לרואה החשבון</button><button class="btn line" data-x="csv">⬇️ אקסל (CSV)</button>' + (extra || '') + '</div>'; }
    function cpaWarn() { return T.cpaEmail ? '' : '<p class="note-warn">✉️ כדי לשלוח במייל, ממלאים את המייל של רואה החשבון בלשונית "📅 מועדים והגדרות".</p>'; }

    function draw() {
      var box = $('#tx-body'), h = '';
      if (tab === 'month') {
        var r = monthData(ym), cl = (T.close || {})[ym] || {};
        h = '<div class="adm-row"><input type="month" id="tx-month" value="' + ym + '"><span class="hint">ברירת המחדל: החודש שעבר, שאותו סוגרים ושולחים.</span></div>' + cpaWarn() + actions() +
          '<section class="adm-card tx-close"><h3>✅ סגירת ' + ymName(ym) + '</h3><ul>' + CLOSE.map(function (k) { return '<li><label class="adm-chk"><input type="checkbox" data-close="' + k[0] + '"' + (cl[k[0]] ? ' checked' : '') + '> ' + k[1] + (cl[k[0]] && k[0] === 'sent' ? ' <small>(' + new Date(cl[k[0]]).toLocaleDateString('he-IL') + ')</small>' : '') + '</label></li>'; }).join('') + '</ul>' +
          (r.missing.length ? '<p class="note-warn">⚠️ ' + r.missing.length + ' הוצאות בלי מספר חשבונית / קבלה. משלימים ב"💸 הוצאות" (מוחקים ורושמים שוב עם המספר).</p>' : '') + '</section>' +
          '<div class="tx-paper" id="tx-paper">' + monthHtml(ym) + '</div>';
      } else if (tab === 'vat') {
        h = '<div class="adm-row">' + yearSel() + '<button class="btn line small" id="tx-addpay">＋ רישום תשלום לרשויות</button></div>' + cpaWarn() + actions() + '<div class="tx-paper" id="tx-paper">' + vatHtml(year) + '</div>' + paysHtml();
      } else if (tab === 'year') {
        h = '<div class="adm-row">' + yearSel() + '<div class="seg" id="tx-doc"><button data-d="pl" class="on">ריכוז לדוח השנתי</button>' + (!vatIn() ? '<button data-d="exempt">הצהרת עוסק פטור</button>' : '') + '<button data-d="income">הצהרה על הכנסות</button></div></div>' + cpaWarn() + actions() +
          '<div class="tx-paper" id="tx-paper">' + docHtml() + '</div>';
      } else {
        h = manageHtml();
      }
      box.innerHTML = h; wire();
    }
    var doc = 'pl';
    function docHtml() { return doc === 'exempt' ? exemptHtml(year) : doc === 'income' ? incomeHtml(year) : yearHtml(year); }
    function docTitle() {
      if (tab === 'month') return 'דוח חודשי לרואה החשבון · ' + ymName(ym);
      if (tab === 'vat') return 'מע״מ ומקדמות · ' + year;
      return (doc === 'exempt' ? 'הצהרת עוסק פטור על מחזור עסקאות' : doc === 'income' ? 'הצהרה על הכנסות מעסק' : 'ריכוז שנתי לדוח למס הכנסה') + ' · ' + year;
    }
    function docCsv() {
      if (tab === 'month') return monthCsv(ym);
      var R = rangeData(yearMonths(year)), rows = [['חודש', 'הכנסות', 'מע״מ עסקאות', 'הוצאות', 'מע״מ תשומות', 'רווח', 'מקדמה (משוער)']];
      R.months.forEach(function (r, i) { rows.push([MONTHS[i], round(r.income), round(r.outVat), round(r.expTotal), round(r.expVat), round(r.profit), round(r.adv)]); });
      rows.push(['סה״כ', round(R.income), round(R.outVat), round(R.expTotal), round(R.expVat), round(R.profit), round(R.adv)]);
      rows.push([]); rows.push(['הוצאות לפי סוג']); Object.keys(R.byCat).forEach(function (k) { rows.push([k, round(R.byCat[k])]); });
      rows.push([]); rows.push(['הכנסות לפי מקור']); Object.keys(R.bySrc).forEach(function (k) { rows.push([k, round(R.bySrc[k])]); });
      return rows;
    }
    function csvName() { return (tab === 'month' ? 'דוח-חודשי-' + ym : tab === 'vat' ? 'מעמ-ומקדמות-' + year : 'שנתי-' + year) + '.csv'; }
    /* an email keeps its look without the page's stylesheet: a small style block of its own */
    var MAILCSS = 'body{margin:0;padding:18px;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif;color:#1d1633}.w{max-width:760px;margin:0 auto;background:#fff;border-radius:12px;padding:20px;direction:rtl;text-align:right;font-size:14px;line-height:1.6}' +
      'h2{font-size:18px;margin:6px 0 10px}h3{font-size:15px;margin:16px 0 6px;color:#8a6d36}table{border-collapse:collapse;width:100%;margin:4px 0}td,th{border:1px solid #e4dccd;padding:5px 7px;text-align:right;font-size:13px}th{background:#f4efe6}' +
      'tr.tot td{font-weight:bold;background:#faf6ee}.adm-stats div{display:inline-block;border:1px solid #e4dccd;border-radius:8px;padding:6px 10px;margin:3px;text-align:center;min-width:110px}.adm-stats i{display:none}.adm-stats b{display:block;font-size:16px}.adm-stats small{color:#6b6280}' +
      '.tx-note,.hint{color:#6b6280;font-size:12px}.tx-warn{color:#b3261e}.tx-sign div{display:inline-block;margin:24px 18px 0 0}.tx-biz{color:#5d5470}.adm-by{background:#faf6ee;padding:6px 10px;border-radius:8px}';
    function wire() {
      var box = $('#tx-body');
      $$('[data-x]', box).forEach(function (b) { b.addEventListener('click', function () {
        var x = b.dataset.x;
        if (x === 'print') return B.printHtml(docTitle(), $('#tx-paper').innerHTML, c.site() || {});
        if (x === 'csv') return B.csv(csvName(), docCsv());
        if (x === 'mail') return mail();
      }); });
      var mi = $('#tx-month', box); if (mi) mi.addEventListener('change', function () { if (this.value) { ym = this.value; draw(); } });
      var ys = $('#tx-year', box); if (ys) ys.addEventListener('change', function () { year = this.value; draw(); });
      $$('#tx-doc button', box).forEach(function (b) { b.classList.toggle('on', b.dataset.d === doc); b.addEventListener('click', function () { doc = b.dataset.d; draw(); }); });
      $$('[data-close]', box).forEach(function (cb) { cb.addEventListener('change', function () { T.close = T.close || {}; var cl = T.close[ym] = T.close[ym] || {}; if (cb.checked) cl[cb.dataset.close] = new Date().toISOString(); else delete cl[cb.dataset.close]; save(); }); });
      var ap = $('#tx-addpay', box); if (ap) ap.addEventListener('click', addPay);
      $$('[data-delpay]', box).forEach(function (b) { b.addEventListener('click', function () { if (!confirm('למחוק את רישום התשלום?')) return; T.paid = (T.paid || []).filter(function (p) { return p.id !== b.dataset.delpay; }); save('נמחק').then(draw); }); });
      var sv = $('#tx-save', box); if (sv) sv.addEventListener('click', function () {
        ['cpaName', 'cpaEmail', 'cpaPhone', 'advPct', 'niMonthly', 'ceiling'].forEach(function (k) { T[k] = $('#tx-' + k).value.trim(); });
        T.vatFreq = Number($('#tx-vatFreq').value); T.advFreq = Number($('#tx-advFreq').value);
        if (T.cpaEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(T.cpaEmail)) return FS.toast('מייל רואה החשבון לא תקין');
        save('✔ נשמר').then(draw);
      });
    }
    function mail() {
      if (!T.cpaEmail) { tab = 'manage'; draw(); FS.toast('קודם ממלאים את המייל של רואה החשבון ושומרים.', 6000); var f = $('#tx-cpaEmail'); if (f) f.focus(); return; }
      var title = docTitle(), b = biz(), to = T.cpaEmail;
      if (!confirm('לשלוח את "' + title + '" ל־' + (T.cpaName ? T.cpaName + ' ' : '') + to + '? (קובץ אקסל מצורף)')) return;
      var html = '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><style>' + MAILCSS + '</style></head><body><div class="w"><p>שלום' + (T.cpaName ? ' ' + esc(T.cpaName) : '') + ',</p><p>מצורף ' + esc(title) + ' של ' + esc(b.name) + '. קובץ האקסל מצורף למייל.</p>' + $('#tx-paper').innerHTML + '<p>בתודה,<br>' + esc(b.owner || b.name) + (b.phone ? ' · ' + esc(b.phone) : '') + '</p></div></body></html>';
      var text = 'שלום' + (T.cpaName ? ' ' + T.cpaName : '') + ',\n\nמצורף ' + title + ' של ' + b.name + ' (הדוח בגוף המייל, וקובץ אקסל מצורף).\n\nבתודה,\n' + (b.owner || b.name);
      FS.busy && FS.busy('שולח…');
      ACC.call('report-mail', { to: to, subject: title + ' · ' + b.name, text: text, html: html, files: [{ name: csvName(), content: csvText(docCsv()) }], kind: tab, period: tab === 'month' ? ym : year, fromName: b.name }).then(function (r) {
        FS.busy && FS.busy();
        if (!r.ok) return FS.toast(ACC.msg(r), 6000);
        if (r.sentReports) c.setSent(r.sentReports);
        if (r.mailed === false) return FS.toast('📵 המייל לא יצא כרגע (' + (r.why || '') + '). אפשר להדפיס או להוריד אקסל ולשלוח ידנית.', 8000);
        FS.toast('✔ נשלח ל־' + to, 5000);
        if (tab === 'month') { T.close = T.close || {}; (T.close[ym] = T.close[ym] || {}).sent = new Date().toISOString(); save().then(draw); }
      }, function () { FS.busy && FS.busy(); FS.toast('אין חיבור לשרת'); });
    }
    function paysHtml() {
      var l = (T.paid || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 60);
      return '<section class="adm-card"><h3>💳 תשלומים לרשויות שנרשמו</h3><p class="hint">מע״מ, מקדמות מס הכנסה, ביטוח לאומי: רושמים כל תשלום, והוא מופיע בדוחות ובסיכום השנתי.</p>' + (l.length ? '<table class="adm-tbl"><thead><tr><th>תאריך</th><th>סוג</th><th>תקופה</th><th>אסמכתא</th><th>סכום</th><th></th></tr></thead><tbody>' +
        l.map(function (p) { return '<tr><td>' + heDate(p.date) + '</td><td>' + esc(p.kind) + '</td><td>' + esc(p.period || '') + '</td><td>' + esc(p.ref || '') + '</td><td>' + money(p.amount) + '</td><td><button class="link" data-delpay="' + esc(p.id) + '">מחיקה</button></td></tr>'; }).join('') + '</tbody></table>' : '<p class="hint">עוד לא נרשמו תשלומים.</p>') + '</section>';
    }
    function addPay() {
      var kinds = (vatIn() ? ['מע״מ'] : []).concat(['מקדמת מס הכנסה', 'ביטוח לאומי', 'מס הכנסה (שומה שנתית)', 'אחר']);
      var cur = periodName(periodOf(lastYm, kinds[0] === 'מע״מ' ? T.vatFreq : T.advFreq));
      var dlg = FS.dialog('💳 רישום תשלום לרשויות', '<div class="adm-grid"><label class="adm-f"><span>סוג</span><div class="adm-in"><select id="tp-kind">' + kinds.map(function (k) { return '<option>' + k + '</option>'; }).join('') + '</select></div></label>' +
        '<label class="adm-f"><span>תקופה</span><div class="adm-in"><input id="tp-period" value="' + esc(cur) + '"></div></label><label class="adm-f"><span>תאריך תשלום</span><div class="adm-in"><input type="date" id="tp-date" value="' + new Date().toISOString().slice(0, 10) + '"></div></label>' +
        '<label class="adm-f"><span>סכום ₪</span><div class="adm-in"><input type="number" step="0.01" id="tp-amount"></div></label><label class="adm-f"><span>אסמכתא</span><div class="adm-in"><input id="tp-ref"></div></label></div><div class="adm-row"><button class="btn gold" id="tp-go">שמירה</button></div>', true);
      dlg.querySelector('#tp-go').addEventListener('click', function () {
        var p = { id: 'tp' + Date.now().toString(36), kind: dlg.querySelector('#tp-kind').value, period: dlg.querySelector('#tp-period').value.trim().slice(0, 40), date: dlg.querySelector('#tp-date').value, amount: num(dlg.querySelector('#tp-amount').value), ref: dlg.querySelector('#tp-ref').value.trim().slice(0, 40) };
        if (!(p.amount > 0) || !p.date) return FS.toast('תאריך וסכום');
        T.paid = (T.paid || []).concat([p]).slice(-400);
        save('✔ נרשם').then(function (ok) { if (ok) { FS.closeDialog(); draw(); } });
      });
    }
    function manageHtml() {
      var dl = deadlines(), sent = (c.sent() || []).slice(0, 15), months = [];
      for (var i = 0; i < 6; i++) months.push(isoOf(now.getFullYear(), now.getMonth() - 1 - i, 15).slice(0, 7));
      function f(k, label, ph, type) { return '<label class="adm-f"><span>' + label + '</span><div class="adm-in"><input id="tx-' + k + '" value="' + esc(T[k] == null ? '' : T[k]) + '" placeholder="' + esc(ph || '') + '"' + (type ? ' type="' + type + '" dir="ltr"' : '') + '></div></label>'; }
      return '<section class="adm-card"><h3>📅 המועדים הקרובים</h3><ul class="adm-hist">' + dl.map(function (x) { var days = Math.round((Date.parse(x[0]) - Date.now()) / 864e5); return '<li><b>' + heDate(x[0]) + ' · ' + x[1] + '</b><small>' + esc(x[2]) + (days <= 7 ? ' · <b class="tx-warn">בעוד ' + Math.max(0, days) + ' ימים</b>' : ' · בעוד ' + days + ' ימים') + '</small></li>'; }).join('') + '</ul>' +
        '<p class="hint">המועדים לפי ההגדרות למטה. ' + (vatIn() ? 'דיווח מע״מ ומקדמות: עד ה־15 בחודש שאחרי התקופה (בדיווח ותשלום מקוון לפעמים מאוחר יותר). ' : '') + 'הדוח השנתי: רואה החשבון יודע את המועד המדויק והארכות.</p></section>' +
        '<section class="adm-card"><h3>✅ סגירת חודשים</h3><table class="adm-tbl"><thead><tr><th>חודש</th>' + CLOSE.map(function (k) { return '<th title="' + esc(k[1]) + '">' + { income: 'תקבולים', exp: 'הוצאות', docs: 'מסמכים', bank: 'בנק', sent: 'נשלח לרו״ח' }[k[0]] + '</th>'; }).join('') + '<th></th></tr></thead><tbody>' +
        months.map(function (x) { var cl = (T.close || {})[x] || {}; return '<tr><td>' + ymName(x) + '</td>' + CLOSE.map(function (k) { return '<td>' + (cl[k[0]] ? '✔' : '—') + '</td>'; }).join('') + '<td><button class="link" data-goym="' + x + '">לפתוח</button></td></tr>'; }).join('') + '</tbody></table></section>' +
        '<section class="adm-card"><h3>👔 רואה החשבון</h3><div class="adm-grid">' + f('cpaName', 'שם', 'רו״ח ישראל ישראלי') + f('cpaEmail', 'מייל', 'cpa@example.com', 'email') + f('cpaPhone', 'טלפון', '05X-XXXXXXX', 'tel') + '</div>' +
        '<h3>🏛️ מיסים</h3><p class="hint">סוג העסק (' + esc(biz().kind) + '), מספר העוסק ואחוז המע״מ: ב"🏦 תשלום ובנק".</p><div class="adm-grid">' +
        '<label class="adm-f"><span>דיווח מע״מ</span><div class="adm-in"><select id="tx-vatFreq"><option value="2"' + (Number(T.vatFreq) === 2 ? ' selected' : '') + '>דו־חודשי</option><option value="1"' + (Number(T.vatFreq) === 1 ? ' selected' : '') + '>חודשי</option></select></div></label>' +
        '<label class="adm-f"><span>מקדמות מס הכנסה</span><div class="adm-in"><select id="tx-advFreq"><option value="2"' + (Number(T.advFreq) === 2 ? ' selected' : '') + '>דו־חודשי</option><option value="1"' + (Number(T.advFreq) === 1 ? ' selected' : '') + '>חודשי</option></select></div></label>' +
        f('advPct', 'אחוז מקדמות (מפנקס המקדמות)', 'למשל 2.5', 'number') + f('niMonthly', 'מקדמת ביטוח לאומי חודשית ₪', '', 'number') + f('ceiling', 'תקרת עוסק פטור לשנה ₪ (לבדוק כל שנה)', '120000', 'number') + '</div>' +
        '<div class="adm-row"><button class="btn gold" id="tx-save">💾 שמירה</button></div></section>' +
        '<section class="adm-card"><h3>✉️ דוחות שנשלחו</h3>' + (sent.length ? '<ul class="adm-hist">' + sent.map(function (x) { return '<li><b>' + esc(x.subject) + '</b><small>' + new Date(x.at).toLocaleString('he-IL') + ' · ' + esc(x.to) + '</small></li>'; }).join('') + '</ul>' : '<p class="hint">עוד לא נשלחו דוחות מכאן.</p>') + '</section>' +
        '<section class="adm-card"><h3>📚 ניהול נכון של העסק</h3><ul class="tx-tips">' +
        '<li><b>קבלה על כל תשלום.</b> תשלום מגנטים נרשם ב"📑 עסקאות" (מספר אישור), ותשלום אופטימוס ב"🔑 רישיונות" (קבלה ממוספרת שנשלחת ללקוח, והעתק אליך).</li>' +
        '<li><b>כל הוצאה מיד.</b> רושמים ב"💸 הוצאות" עם מספר החשבונית ושומרים את המסמך (צילום בטלפון לתיקייה של החודש).</li>' +
        '<li><b>חשבון בנק נפרד לעסק</b>, ובדיקה חודשית של דף הבנק מול הרישומים.</li>' +
        '<li><b>פעם בחודש</b> (עד ה־5): סוגרים את החודש שעבר כאן ושולחים לרואה החשבון בלחיצה.</li>' +
        '<li><b>שמירת מסמכים 7 שנים</b> לפחות (קבלות, חשבוניות, דפי בנק, הסכמים).</li>' +
        '<li><b>עוסק פטור:</b> עוקבים אחרי התקרה השנתית (בלשונית "שנתי"), ומגישים הצהרת מחזור עד 31 בינואר.</li>' +
        '<li><b>מקדמות וביטוח לאומי</b> בהוראת קבע, ורושמים כל תשלום ב"🏛️ מע״מ ומקדמות".</li></ul>' +
        '<p class="hint">הכלים כאן עוזרים לרכז ולהעביר. ההחלטות המקצועיות (הכרה בהוצאות, מקדמות, דוחות רשמיים) הן של רואה החשבון.</p></section>';
    }
    $$('#tx-tabs button').forEach(function (b) { b.addEventListener('click', function () { tab = b.dataset.t; $$('#tx-tabs button').forEach(function (x) { x.classList.toggle('on', x === b); }); draw(); }); });
    document.getElementById('tx-body').addEventListener('click', function (e) { var g = e.target.closest('[data-goym]'); if (!g) return; ym = g.dataset.goym; tab = 'month'; $$('#tx-tabs button').forEach(function (x) { x.classList.toggle('on', x.dataset.t === 'month'); }); draw(); });
    draw();
    /* the אופטימוס licence payments, with their receipt numbers (the licences server, admin only) */
    if (FS.license && FS.license.admin) FS.license.admin('lic-list').then(function (r) {
      if (!r || !r.ok) return;
      LICPAYS = [];
      (r.licenses || []).forEach(function (L) { (L.payments || []).forEach(function (p) { LICPAYS.push({ date: p.date || String(p.at || '').slice(0, 10), no: p.receipt ? 'קבלה ' + p.receipt : '', src: 'אופטימוס', client: L.name || L.email, method: p.method || '', amount: num(p.amount), ref: p.ref || '' }); }); });
      if (LICPAYS.length && document.getElementById('tx-body')) draw();
    }, function () {});
  };
})();
