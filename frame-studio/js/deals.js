/* Deals: a file per client (event, package, price, VAT, deposit, terms, signatures), a payments log with the balance,
   numbered documents (order and deal-closure confirmation, payment confirmation) printed or saved as PDF, the owner's
   payment options, a personal payment page for the client (pay.html, the deal is in the link), WhatsApp and calendar. */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$;
  var esc = FS.esc;

  /* ---------- money, numbers, settings ---------- */
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[^\d.\-]/g, '')); return isFinite(n) ? n : 0; }
  function money(n) { return '₪' + (Math.round(num(n) * 100) / 100).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function heDate(iso) { if (!iso) return '—'; var d = new Date(iso + 'T12:00:00'); return isNaN(d) ? iso : d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  function nextNo(kind, start) { var k = 'fs-no-' + kind, n = 0; try { n = Number(localStorage.getItem(k) || 0); } catch (e) { /* ignore */ } n = Math.max(n + 1, start); try { localStorage.setItem(k, n); } catch (e) { /* ignore */ } return n; }
  var METHODS = [['bit', 'ביט'], ['paybox', 'פייבוקס'], ['card', 'כרטיס אשראי'], ['transfer', 'העברה בנקאית'], ['cash', 'מזומן'], ['check', 'צ׳ק'], ['paypal', 'PayPal'], ['other', 'אחר']];
  function methodName(id) { var m = METHODS.filter(function (x) { return x[0] === id; })[0]; return m ? m[1] : id; }
  function pay() { return Object.assign({ bit: '', paybox: '', card: '', paypal: '', bankName: '', bankNo: '', branch: '', account: '', holder: '', cash: true, check: true, vat: 18, bizType: 'פטור', bizId: '', address: '', docLabel: 'אישור תשלום', terms: '' }, FS.BIZ.pay || {}); }
  var TERMS = ['הזמנת התאריך נכנסת לתוקף עם תשלום המקדמה.', 'יתרת התשלום תשולם עד יום האירוע.', 'ביטול עד 30 יום לפני האירוע: המקדמה מוחזרת בניכוי 10%. ביטול מאוחר יותר: המקדמה אינה מוחזרת.', 'שינוי מועד בתיאום ובכפוף לזמינות.', 'הלקוח/ה מאשר/ת שימוש בתמונות לדוגמה באתר ובמדיה, אלא אם ביקש/ה אחרת בכתב.'].join('\n');

  function totals(d) {
    var extras = (d.extras || []).reduce(function (s, x) { return s + num(x.amount); }, 0), sub = num(d.price) + extras - num(d.discount), rate = num(pay().vat) / 100, vat = 0, total = sub;
    if (d.vatMode === 'plus') { vat = sub * rate; total = sub + vat; } else if (d.vatMode === 'incl') { vat = sub - sub / (1 + rate); }
    var paid = (d.payments || []).reduce(function (s, x) { return s + num(x.amount); }, 0);
    return { extras: extras, sub: sub, vat: vat, total: total, paid: paid, balance: Math.max(0, Math.round((total - paid) * 100) / 100), deposit: num(d.deposit) };
  }
  function status(d) { var t = totals(d); if (t.total > 0 && t.balance <= 0) return ['paid', 'שולם במלואו']; if (t.paid > 0) return ['deposit', 'שולמה מקדמה']; if (d.closed) return ['closed', 'נסגר · ממתין לתשלום']; return ['quote', 'הצעה']; }

  /* ---------- storage ---------- */
  function all() { return FS.store.all('deals').then(function (l) { return (l || []).sort(function (a, b) { return (a.date || '9999') < (b.date || '9999') ? -1 : 1; }); }).catch(function () { return []; }); }
  function put(d) { d.updatedAt = Date.now(); return FS.store.put('deals', JSON.parse(JSON.stringify(d))); }
  function blank() {
    var ev = FS.prefs.event || {};
    return { id: 'd' + FS.uid(), no: null, createdAt: Date.now(), client: { name: '', phone: '', email: '', idNo: '', address: '' }, type: ev.type || 'wedding', date: '', time: '', venue: '', guests: '',
      pkg: '', price: '', discount: '', extras: [], vatMode: pay().bizType === 'מורשה' ? 'incl' : 'none', deposit: '', balanceDue: '', terms: pay().terms || TERMS, notes: '', payments: [], sign: {}, closed: false };
  }

  /* ---------- the manager ---------- */
  /* more tabs (reviews, WhatsApp replies) come from js/grow.js through FS.dealTabs */
  FS.dealTabs = FS.dealTabs || {};
  function open(id, preset) {
    var extra = Object.keys(FS.dealTabs).map(function (k) { return '<button data-v="' + k + '">' + FS.dealTabs[k].label + '</button>'; }).join('');
    var body = FS.dialog('📑 עסקאות ותשלומים', '<div class="dl-tabs"><button data-v="list" class="on">כל העסקאות</button><button data-v="new">＋ עסקה חדשה</button>' + extra + '<button data-v="settings">⚙️ אפשרויות תשלום ופרטי מסמכים</button></div><div id="dl-view"></div>', true);
    $$('.dl-tabs button', body).forEach(function (b) { b.addEventListener('click', function () { tab(b.dataset.v); }); });
    function tab(v, d) {
      $$('.dl-tabs button', body).forEach(function (b) { b.classList.toggle('on', b.dataset.v === (v === 'edit' ? 'list' : v)); });
      if (v === 'list') list(); else if (v === 'settings') settings(); else if (FS.dealTabs[v]) FS.dealTabs[v].draw($('#dl-view', body), { edit: function (x) { tab('edit', x); }, newDeal: function (pre) { tab('new', Object.assign(blank(), pre || {})); } }); else edit(d || blank());
    }
    function list() {
      all().then(function (ds) {
        var open = 0, upcoming = 0, now = today(); ds.forEach(function (d) { open += totals(d).balance; if (d.date >= now) upcoming++; });
        var v = $('#dl-view', body);
        v.innerHTML = (ds.length ? '<div class="dl-bar"><span class="hint">תאריכים של עסקאות סגורות יכולים להופיע באתר כ"תפוס", בלי שמות.</span><button class="btn small" id="dl-busy">📢 עדכון תאריכים תפוסים באתר</button></div>' : '') + '<div class="dl-sum"><div><b>' + ds.length + '</b><small>עסקאות</small></div><div><b>' + upcoming + '</b><small>אירועים קרובים</small></div><div><b>' + money(open) + '</b><small>יתרה פתוחה</small></div></div>' +
          (ds.length ? '<div class="dl-list">' + ds.map(function (d) { var t = totals(d), st = status(d), ev = FS.event(d.type);
            return '<button class="dl-row" data-id="' + d.id + '"><span class="dl-date"><b>' + (d.date ? new Date(d.date + 'T12:00:00').getDate() : '?') + '</b><small>' + (d.date ? new Date(d.date + 'T12:00:00').toLocaleDateString('he-IL', { month: 'short', year: '2-digit' }) : 'ללא תאריך') + '</small></span>' +
              '<span class="dl-who"><b>' + esc(d.client.name || 'לקוח/ה חדש/ה') + '</b><small>' + ev.icon + ' ' + esc(ev.name) + (d.venue ? ' · ' + esc(d.venue) : '') + (d.no ? ' · עסקה ' + d.no : '') + '</small></span>' +
              '<span class="dl-money"><b>' + money(t.total) + '</b><small>' + (t.balance > 0 ? 'יתרה ' + money(t.balance) : 'שולם') + '</small></span><span class="st st-' + st[0] + '">' + st[1] + '</span></button>'; }).join('') + '</div>'
            : '<div class="dl-empty"><b>עוד אין עסקאות</b><p>כשלקוח סוגר תאריך, פותחים כאן עסקה, ומשם יוצאים מסמך הסגירה, בקשת התשלום והאישורים.</p><button class="btn primary" id="dl-first">＋ עסקה ראשונה</button></div>');
        $$('.dl-row', v).forEach(function (r) { r.addEventListener('click', function () { var d = ds.filter(function (x) { return x.id === r.dataset.id; })[0]; tab('edit', d); }); });
        var f = $('#dl-first', v); if (f) f.addEventListener('click', function () { tab('new'); });
        var bz = $('#dl-busy', v); if (bz) bz.addEventListener('click', function () { publishBusy(ds); });
      });
    }

    /* ---------- one deal ---------- */
    function edit(d) {
      var pk = (FS.getPackages ? FS.getPackages() : []).filter(function (p) { return !p.hidden; });
      var v = $('#dl-view', body);
      function field(path, label, type, ph, attrs) { var val = get(path); return '<label><span>' + label + '</span><input data-p="' + path + '" type="' + (type || 'text') + '" value="' + esc(val == null ? '' : val) + '" placeholder="' + esc(ph || '') + '"' + (attrs || '') + '></label>'; }
      function get(path) { return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, d); }
      function set(path, val) { var ks = path.split('.'), o = d; for (var i = 0; i < ks.length - 1; i++) o = o[ks[i]]; o[ks[ks.length - 1]] = val; }
      v.innerHTML = '<div class="dl-ed">' +
        '<div class="dl-col"><section><h3>👤 הלקוח</h3><div class="dl-grid">' + field('client.name', 'שם מלא *', 'text', 'נועה לוי') + field('client.phone', 'טלפון', 'tel', '05X-XXXXXXX', ' dir="ltr"') + field('client.email', 'אימייל', 'email', '', ' dir="ltr"') + field('client.idNo', 'ת.ז / ח.פ (לא חובה)', 'text') + field('client.address', 'כתובת (לא חובה)', 'text') + '</div></section>' +
        '<section><h3>🎉 האירוע</h3><div class="dl-grid"><label><span>סוג</span><select data-p="type">' + FS.EVENTS.map(function (e) { return '<option value="' + e.id + '"' + (d.type === e.id ? ' selected' : '') + '>' + e.icon + ' ' + e.name + '</option>'; }).join('') + '</select></label>' +
          field('date', 'תאריך *', 'date') + field('time', 'שעה', 'time') + field('venue', 'מקום / אולם', 'text', 'אולמי הגן, ראשון לציון') + field('guests', 'אורחים', 'number') + '</div></section>' +
        '<section><h3>💰 מחיר</h3><div class="dl-grid"><label><span>חבילה</span><select id="dl-pkg"><option value="">בחירת חבילה…</option>' + pk.map(function (p) { return '<option value="' + esc(p.name) + '"' + (d.pkg === p.name ? ' selected' : '') + '>' + esc(p.name) + (p.price ? ' · ' + esc(p.price) : '') + '</option>'; }).join('') + '<option value="__custom"' + (d.pkg && !pk.some(function (p) { return p.name === d.pkg; }) ? ' selected' : '') + '>אחר / מותאם</option></select></label>' +
          field('price', 'מחיר החבילה ₪', 'number') + field('discount', 'הנחה ₪', 'number') +
          '<label><span>מע״מ</span><select data-p="vatMode"><option value="none"' + (d.vatMode === 'none' ? ' selected' : '') + '>ללא מע״מ (עוסק פטור)</option><option value="incl"' + (d.vatMode === 'incl' ? ' selected' : '') + '>המחיר כולל מע״מ</option><option value="plus"' + (d.vatMode === 'plus' ? ' selected' : '') + '>בתוספת מע״מ</option></select></label>' +
          field('deposit', 'מקדמה לסגירת התאריך ₪', 'number') + field('balanceDue', 'יתרה עד תאריך', 'date') + '</div>' +
          '<div class="dl-extras" id="dl-extras"></div><button class="btn small" id="dl-add-extra">＋ תוספת</button><div class="dl-tot" id="dl-tot"></div></section>' +
        '<section><h3>📜 תנאים והערות</h3><label><span>תנאי ההזמנה (יופיעו במסמך)</span><textarea data-p="terms" rows="5">' + esc(d.terms) + '</textarea></label><label><span>הערות פנימיות (לא מודפסות)</span><textarea data-p="notes" rows="2">' + esc(d.notes) + '</textarea></label></section></div>' +
        '<div class="dl-col"><section class="dl-status"><div><span class="st st-' + status(d)[0] + '" id="dl-st">' + status(d)[1] + '</span>' + (d.no ? '<small>עסקה מס׳ ' + d.no + '</small>' : '') + '</div>' +
          '<button class="btn primary wide" id="dl-close">' + (d.closed ? '✔ העסקה סגורה' : '🤝 סגירת עסקה') + '</button>' +
          '<div class="row2"><button class="btn" id="dl-doc">📄 מסמך סגירת עסקה</button><button class="btn" id="dl-send">💬 שליחה ללקוח</button><button class="btn" id="dl-link">🔗 דף תשלום ללקוח</button><button class="btn" id="dl-ics">📅 ליומן</button><button class="btn" id="dl-review">⭐ בקשת המלצה</button></div></section>' +
        '<section><h3>💳 תשלומים</h3><div id="dl-pays"></div><div class="dl-pay-new"><input id="np-amount" type="number" placeholder="סכום ₪"><select id="np-method">' + METHODS.map(function (m) { return '<option value="' + m[0] + '">' + m[1] + '</option>'; }).join('') + '</select><input id="np-date" type="date" value="' + today() + '"><input id="np-ref" placeholder="אסמכתא (לא חובה)"><button class="btn primary" id="np-add">＋ רישום תשלום</button></div></section>' +
        '<section><h3>✍️ חתימות</h3><div class="dl-signs"><div><canvas class="sig" data-s="client" width="360" height="130"></canvas><div class="sig-cap"><span>חתימת הלקוח/ה</span><button class="link" data-clear="client">ניקוי</button></div></div><div><canvas class="sig" data-s="me" width="360" height="130"></canvas><div class="sig-cap"><span>החתימה שלי</span><button class="link" data-clear="me">ניקוי</button></div></div></div><p class="hint">חותמים עם האצבע או העכבר, למשל בפגישה עם הלקוח. החתימות נכנסות למסמך.</p></section>' +
        '<div class="row2"><button class="btn" id="dl-back">← לכל העסקאות</button><button class="btn danger" id="dl-del">🗑 מחיקת העסקה</button></div></div></div>';
      var saveT = null;
      function save(now) { clearTimeout(saveT); saveT = setTimeout(function () { put(d); }, now ? 0 : 400); }
      function tot() {
        var t = totals(d), r = num(pay().vat);
        $('#dl-tot', v).innerHTML = '<div><span>חבילה</span><b>' + money(d.price) + '</b></div>' + (t.extras ? '<div><span>תוספות</span><b>' + money(t.extras) + '</b></div>' : '') + (num(d.discount) ? '<div><span>הנחה</span><b>−' + money(d.discount) + '</b></div>' : '') +
          (d.vatMode === 'plus' ? '<div><span>מע״מ ' + r + '%</span><b>' + money(t.vat) + '</b></div>' : d.vatMode === 'incl' ? '<div class="sm"><span>מתוכו מע״מ ' + r + '%</span><b>' + money(t.vat) + '</b></div>' : '') +
          '<div class="big"><span>סה״כ לתשלום</span><b>' + money(t.total) + '</b></div><div><span>שולם</span><b>' + money(t.paid) + '</b></div><div class="bal"><span>יתרה</span><b>' + money(t.balance) + '</b></div>';
        var st = status(d); $('#dl-st', v).className = 'st st-' + st[0]; $('#dl-st', v).textContent = st[1];
      }
      function extras() {
        $('#dl-extras', v).innerHTML = (d.extras || []).map(function (x, i) { return '<div class="dl-x"><input data-x="' + i + '" data-xk="desc" value="' + esc(x.desc) + '" placeholder="שעה נוספת"><input data-x="' + i + '" data-xk="amount" type="number" value="' + esc(x.amount) + '" placeholder="₪"><button class="link" data-xd="' + i + '">✕</button></div>'; }).join('');
        $$('[data-x]', v).forEach(function (el) { el.addEventListener('input', function () { d.extras[el.dataset.x][el.dataset.xk] = el.value; tot(); save(); }); });
        $$('[data-xd]', v).forEach(function (el) { el.addEventListener('click', function () { d.extras.splice(Number(el.dataset.xd), 1); extras(); tot(); save(); }); });
      }
      function pays() {
        var t = totals(d);
        $('#dl-pays', v).innerHTML = (d.payments || []).length ? '<div class="dl-plist">' + d.payments.map(function (p, i) {
          return '<div class="dl-p"><span><b>' + money(p.amount) + '</b><small>' + methodName(p.method) + ' · ' + new Date(p.date + 'T12:00:00').toLocaleDateString('he-IL') + (p.ref ? ' · ' + esc(p.ref) : '') + ' · מס׳ ' + p.no + '</small></span><button class="btn small" data-rc="' + i + '">📄 אישור</button><button class="btn small" data-rs="' + i + '">💬</button>' + (pay().invoiceUrl ? '<button class="btn small" data-ri="' + i + '" title="הפקת קבלה בתוכנת הקבלות שלך">🧾</button>' : '') + '<button class="link" data-rd="' + i + '">✕</button></div>';
        }).join('') + '</div>' : '<p class="hint">עוד לא נרשמו תשלומים.' + (t.total ? ' מקדמה מומלצת: ' + money(d.deposit || Math.round(t.total * 0.3)) + '.' : '') + '</p>';
        $('#np-amount', v).placeholder = t.balance ? 'סכום ₪ (יתרה ' + money(t.balance) + ')' : 'סכום ₪';
        $$('[data-rc]', v).forEach(function (b) { b.addEventListener('click', function () { printDoc(receiptDoc(d, d.payments[Number(b.dataset.rc)])); }); });
        $$('[data-rs]', v).forEach(function (b) { b.addEventListener('click', function () { var p = d.payments[Number(b.dataset.rs)], t2 = totals(d); wa(d, 'שלום ' + first(d) + ', קיבלתי את התשלום, תודה! 🙏\n' + pay().docLabel + ' מס׳ ' + p.no + ': ' + money(p.amount) + ' (' + methodName(p.method) + ')\n' + (t2.balance > 0 ? 'יתרה לתשלום: ' + money(t2.balance) : 'העסקה שולמה במלואה ✔') + '\n' + FS.BIZ.name); }); });
        $$('[data-ri]', v).forEach(function (b) { b.addEventListener('click', function () { var p = d.payments[Number(b.dataset.ri)], t = [d.client.name, d.client.idNo, d.client.phone, d.client.email, money(p.amount) + ' · ' + methodName(p.method) + (p.ref ? ' · ' + p.ref : ''), FS.event(d.type).name + ' · ' + heDate(d.date) + (d.no ? ' · עסקה ' + d.no : '')].filter(Boolean).join('\n');
          (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { FS.toast('📋 פרטי התשלום הועתקו. מדביקים אותם בתוכנת הקבלות.', 5000); }, function () {}); window.open(pay().invoiceUrl, '_blank', 'noopener'); }); });
        $$('[data-rd]', v).forEach(function (b) { b.addEventListener('click', function () { if (!confirm('למחוק את רישום התשלום?')) return; d.payments.splice(Number(b.dataset.rd), 1); pays(); tot(); save(true); }); });
      }
      $$('[data-p]', v).forEach(function (el) { el.addEventListener('input', function () { set(el.dataset.p, el.value); if (el.dataset.p === 'price' && !num(d.deposit)) $('[data-p=deposit]', v).placeholder = money(Math.round(totals(d).total * 0.3)); tot(); save(); }); el.addEventListener('change', function () { set(el.dataset.p, el.value); tot(); save(); }); });
      $('#dl-pkg', v).addEventListener('change', function () {
        var p = pk.filter(function (x) { return x.name === this.value; }, this)[0];
        d.pkg = this.value === '__custom' ? 'מותאם' : this.value;
        if (p) { d.price = num(p.price) || d.price; $('[data-p=price]', v).value = d.price; if (!num(d.deposit)) { d.deposit = Math.round(totals(d).total * 0.3); $('[data-p=deposit]', v).value = d.deposit; } }
        tot(); save();
      });
      $('#dl-add-extra', v).addEventListener('click', function () { d.extras.push({ desc: '', amount: '' }); extras(); });
      $('#np-add', v).addEventListener('click', function () {
        var a = num($('#np-amount', v).value); if (!(a > 0)) { FS.toast('כותבים סכום'); return; }
        var p = { id: FS.uid(), no: nextNo('pay', 1), amount: a, method: $('#np-method', v).value, date: $('#np-date', v).value || today(), ref: $('#np-ref', v).value.trim() };
        d.payments.push(p); if (!d.closed) { d.closed = true; d.closedAt = Date.now(); if (!d.no) d.no = nextNo('deal', 1001); }
        $('#np-amount', v).value = ''; $('#np-ref', v).value = ''; pays(); tot(); save(true);
        FS.toast('✔ נרשם תשלום מס׳ ' + p.no + '. "📄 אישור" מפיק את אישור התשלום.');
      });
      $('#dl-close', v).addEventListener('click', function () {
        if (!d.client.name || !d.date) { FS.toast('כדי לסגור עסקה צריך לפחות שם לקוח ותאריך'); return; }
        if (!d.closed) { d.closed = true; d.closedAt = Date.now(); if (!d.no) d.no = nextNo('deal', 1001); save(true); this.textContent = '✔ העסקה סגורה'; tot(); FS.toast('🤝 עסקה מס׳ ' + d.no + ' נסגרה. עכשיו: מסמך סגירה ובקשת מקדמה.'); }
        printDoc(dealDoc(d));
      });
      $('#dl-doc', v).addEventListener('click', function () { if (!d.no) { d.no = nextNo('deal', 1001); save(true); } printDoc(dealDoc(d)); });
      $('#dl-send', v).addEventListener('click', function () { wa(d, summary(d) + '\n\nלתשלום ולכל הפרטים:\n' + payLink(d)); });
      $('#dl-link', v).addEventListener('click', function () { var u = payLink(d); (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(function () { FS.toast('🔗 הקישור הועתק. אפשר להדביק ללקוח בכל מקום.'); }, function () { prompt('הקישור לדף התשלום:', u); }); window.open(u, '_blank', 'noopener'); });
      $('#dl-ics', v).addEventListener('click', function () { ics(d); });
      $('#dl-review', v).addEventListener('click', function () { var g = FS.BIZ.googleReviews || (FS.BIZ_SITE && FS.BIZ_SITE.googleReviews) || '';
        wa(d, 'היי ' + first(d) + ' 😊 תודה שבחרתם ב' + FS.BIZ.name + '! מקווים שנהניתם מהמגנטים 🧲\nנשמח מאוד לכמה מילים על החוויה' + (g ? ', כאן בגוגל זה עוזר לנו המון:\n' + g : '. אפשר פשוט לענות להודעה הזו 🙏')); });
      $('#dl-back', v).addEventListener('click', function () { put(d).then(function () { tab('list'); }); });
      $('#dl-del', v).addEventListener('click', function () { if (!confirm('למחוק את העסקה של ' + (d.client.name || 'הלקוח') + '? אי אפשר לבטל.')) return; FS.store.del('deals', d.id).then(function () { tab('list'); }); });
      /* signatures */
      $$('canvas.sig', v).forEach(function (c) {
        var x = c.getContext('2d'), k = c.dataset.s, down = false, last = null;
        x.lineWidth = 2.4; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#1d1633';
        if (d.sign[k]) FS.loadImg(d.sign[k]).then(function (im) { x.drawImage(im, 0, 0, c.width, c.height); });
        function pt(e) { var r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * c.width, y: (e.clientY - r.top) / r.height * c.height }; }
        c.addEventListener('pointerdown', function (e) { down = true; last = pt(e); c.setPointerCapture(e.pointerId); });
        c.addEventListener('pointermove', function (e) { if (!down) return; var p = pt(e); x.beginPath(); x.moveTo(last.x, last.y); x.lineTo(p.x, p.y); x.stroke(); last = p; });
        c.addEventListener('pointerup', function () { down = false; d.sign[k] = c.toDataURL('image/png'); save(true); });
      });
      $$('[data-clear]', v).forEach(function (b) { b.addEventListener('click', function () { var c = $('canvas[data-s=' + b.dataset.clear + ']', v); c.getContext('2d').clearRect(0, 0, c.width, c.height); delete d.sign[b.dataset.clear]; save(true); }); });
      extras(); pays(); tot(); put(d);
    }

    /* ---------- settings: payment options and document details ---------- */
    function settings() {
      var p = pay(), v = $('#dl-view', body);
      function f(k, label, ph, type) { return '<label><span>' + label + '</span><input data-k="' + k + '" type="' + (type || 'text') + '" value="' + esc(p[k] || '') + '" placeholder="' + esc(ph || '') + '"' + (type === 'tel' || /url|link/i.test(ph || '') ? ' dir="ltr"' : '') + '></label>'; }
      v.innerHTML = '<div class="dl-ed"><div class="dl-col"><section><h3>💳 אפשרויות התשלום שהלקוח רואה</h3><p class="hint">מה שממלאים כאן מופיע במסמך הסגירה ובדף התשלום של הלקוח. מה שנשאר ריק לא יוצג.</p><div class="dl-grid">' +
        f('bit', 'ביט: מספר הטלפון', '05X-XXXXXXX', 'tel') + f('paybox', 'פייבוקס: קישור לתשלום', 'https://payboxapp.page.link/…') + f('card', 'אשראי: קישור לתשלום מהסליקה שלך', 'https://… (Morning / PayPlus / Meshulam …)') + f('paypal', 'PayPal: קישור', 'https://paypal.me/…') + '</div>' +
        '<h3>🏦 העברה בנקאית</h3><div class="dl-grid">' + f('holder', 'שם בעל החשבון', '') + f('bankName', 'בנק', 'לאומי') + f('bankNo', 'מספר בנק', '10') + f('branch', 'סניף', '') + f('account', 'מספר חשבון', '') + '</div>' +
        '<div class="inline"><label class="check"><input type="checkbox" data-k="cash"' + (p.cash ? ' checked' : '') + '> מזומן</label><label class="check"><input type="checkbox" data-k="check"' + (p.check ? ' checked' : '') + '> צ׳ק</label></div></section></div>' +
        '<div class="dl-col"><section><h3>🧾 פרטים למסמכים</h3><div class="dl-grid"><label><span>סוג העסק</span><select data-k="bizType"><option' + (p.bizType === 'פטור' ? ' selected' : '') + ' value="פטור">עוסק פטור</option><option' + (p.bizType === 'מורשה' ? ' selected' : '') + ' value="מורשה">עוסק מורשה</option><option' + (p.bizType === 'חברה' ? ' selected' : '') + ' value="חברה">חברה בע״מ</option></select></label>' +
        f('bizId', 'מספר עוסק / ח.פ', '') + f('address', 'כתובת העסק', '') + f('vat', 'שיעור מע״מ %', '18', 'number') + f('docLabel', 'כותרת אישור תשלום', 'אישור תשלום') + f('invoiceUrl', 'קישור לתוכנת הקבלות שלך (לא חובה)', 'https://… (Morning / iCount / EZcount)') + '</div>' +
        '<label><span>תנאי ברירת המחדל לעסקה חדשה</span><textarea data-k="terms" rows="6">' + esc(p.terms || TERMS) + '</textarea></label>' +
        '<p class="note-warn">⚠️ "אישור תשלום" הוא אישור שהכסף התקבל. הוא לא חשבונית מס ולא קבלה לצורכי מס. קבלות וחשבוניות רשמיות מפיקים בתוכנה מוכרת לרשות המסים (למשל Morning, iCount, EZcount או רווחית). אפשר לחבר אחת מהן בהמשך.</p></section>' +
        '<div class="row2"><span></span><button class="btn primary" id="st-save">💾 שמירה</button></div></div></div>';
      $('#st-save', v).addEventListener('click', function () {
        var bad = ['paybox', 'card', 'paypal', 'invoiceUrl'].filter(function (k) { var u = $('[data-k=' + k + ']', v).value.trim(); return u && !/^(https:\/\/|www\.)\S+$/i.test(u); });
        if (bad.length) { FS.toast('קישור תשלום צריך להתחיל ב־https://'); $('[data-k=' + bad[0] + ']', v).focus(); return; }
        $$('[data-k]', v).forEach(function (el) { p[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value.trim(); });
        FS.BIZ.pay = p; FS.saveBiz(); FS.toast('✔ אפשרויות התשלום נשמרו');
      });
    }
    if (preset) tab('new', Object.assign(blank(), preset)); else if (id === 'new') tab('new'); else if (FS.dealTabs[id]) tab(id); else tab('list');
  }
  FS.openDeals = open;

  /* closed deals' dates go to business.json as busy (no names), for the site's "is my date free?" */
  function publishBusy(ds) {
    var now = today(), busy = {};
    ds.forEach(function (d) { if (d.closed && d.date && d.date >= now) busy[d.date] = 1; });
    var list = Object.keys(busy).sort();
    FS.publishSite(function (base) { base.busy = list; }, 'frame-studio: busy dates', '📢 ' + (list.length ? list.length + ' תאריכים תפוסים' : 'אין תאריכים תפוסים') + '. האתר יתעדכן תוך כשתי דקות.');
  }

  /* ---------- texts, links, calendar ---------- */
  function first(d) { return String(d.client.name || '').split(' ')[0] || ''; }
  function summary(d) {
    var t = totals(d), ev = FS.event(d.type);
    return 'שלום ' + first(d) + ' 😊\nמצורף סיכום ההזמנה מ' + FS.BIZ.name + ':\n' + ev.icon + ' ' + ev.name + ' · ' + heDate(d.date) + (d.time ? ' · ' + d.time : '') + (d.venue ? '\n📍 ' + d.venue : '') +
      (d.pkg ? '\n📦 חבילת ' + d.pkg : '') + '\n💰 סה״כ: ' + money(t.total) + (t.paid ? '\n✔ שולם: ' + money(t.paid) : '') + (t.balance ? '\n⏳ ' + (t.paid ? 'יתרה' : 'מקדמה לסגירת התאריך') + ': ' + money(t.paid ? t.balance : (t.deposit || t.balance)) : '');
  }
  function wa(d, text) { var n = String(d.client.phone || '').replace(/\D/g, ''); if (n.charAt(0) === '0') n = '972' + n.slice(1); window.open('https://wa.me/' + n + '?text=' + encodeURIComponent(text), '_blank', 'noopener'); }
  function b64url(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function payLink(d) {
    var t = totals(d), p = pay(), B = FS.BIZ, ev = FS.event(d.type);
    var data = { v: 1, no: d.no, n: d.client.name, e: ev.name, i: ev.icon, d: d.date, tm: d.time, vn: d.venue, pk: d.pkg, t: t.total, p: t.paid, due: t.paid ? t.balance : (t.deposit || t.balance), dep: !t.paid,
      b: { name: B.name, owner: B.owner, phone: B.phone, wa: B.whatsapp || B.phone, email: B.email }, pay: { bit: p.bit, paybox: p.paybox, card: p.card, paypal: p.paypal, holder: p.holder, bank: p.bankName, bankNo: p.bankNo, branch: p.branch, account: p.account, cash: p.cash, check: p.check } };
    return location.href.replace(/[^/]*([?#].*)?$/, '') + 'pay.html#' + b64url(JSON.stringify(data));
  }
  FS.dealPayLink = payLink;
  function ics(d) {
    if (!d.date) { FS.toast('אין תאריך לעסקה'); return; }
    var ev = FS.event(d.type), ds = d.date.replace(/-/g, ''), st = d.time ? ds + 'T' + d.time.replace(':', '') + '00' : ds, en = d.time ? ds + 'T' + String((Number(d.time.slice(0, 2)) + 5) % 24).padStart(2, '0') + d.time.slice(3, 5) + '00' : ds;
    var txt = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//frame-studio//he', 'BEGIN:VEVENT', 'UID:' + d.id + '@frame-studio', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
      (d.time ? 'DTSTART:' + st : 'DTSTART;VALUE=DATE:' + st), (d.time ? 'DTEND:' + en : 'DTEND;VALUE=DATE:' + en), 'SUMMARY:🧲 ' + ev.name + ' · ' + (d.client.name || ''), 'LOCATION:' + (d.venue || ''), 'DESCRIPTION:' + summary(d).replace(/\n/g, '\\n'), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    FS.download(new Blob([txt], { type: 'text/calendar' }), 'event-' + d.date + '.ics');
  }

  /* ---------- documents ---------- */
  function head(title, no, date) {
    var B = FS.BIZ, p = pay();
    return '<header class="doc-head"><div class="doc-biz"><b>' + esc(B.name) + '</b><span>' + [B.owner, p.bizType === 'חברה' ? 'ח.פ ' + p.bizId : p.bizId ? 'עוסק ' + p.bizType + ' ' + p.bizId : ''].filter(Boolean).map(esc).join(' · ') + '</span><span>' + [B.phone, B.email].filter(Boolean).map(esc).join(' · ') + '</span>' + (p.address ? '<span>' + esc(p.address) + '</span>' : '') + '</div>' +
      '<div class="doc-title"><h1>' + title + '</h1><span>מס׳ ' + (no || '—') + '</span><span>' + new Date(date || Date.now()).toLocaleDateString('he-IL') + '</span></div></header>';
  }
  function payOptions() {
    var p = pay(), o = [];
    if (p.bit) o.push('<li><b>ביט</b> למספר ' + esc(p.bit) + '</li>');
    if (p.paybox) o.push('<li><b>פייבוקס</b> בקישור: ' + esc(p.paybox) + '</li>');
    if (p.card) o.push('<li><b>כרטיס אשראי</b> בקישור: ' + esc(p.card) + '</li>');
    if (p.account) o.push('<li><b>העברה בנקאית</b>: ' + esc([p.bankName, p.bankNo ? 'בנק ' + p.bankNo : '', p.branch ? 'סניף ' + p.branch : '', 'חשבון ' + p.account, p.holder ? 'ע״ש ' + p.holder : ''].filter(Boolean).join(', ')) + '</li>');
    if (p.paypal) o.push('<li><b>PayPal</b>: ' + esc(p.paypal) + '</li>');
    if (p.cash || p.check) o.push('<li>' + [p.cash ? 'מזומן' : '', p.check ? 'צ׳ק' : ''].filter(Boolean).join(' או ') + ' במעמד האירוע או קודם</li>');
    return o.length ? '<ul class="doc-pay">' + o.join('') + '</ul>' : '<p>אמצעי התשלום יימסרו בנפרד.</p>';
  }
  function sigs(d) { return '<div class="doc-sigs"><div>' + (d.sign.client ? '<img src="' + d.sign.client + '" alt="">' : '<i></i>') + '<span>חתימת הלקוח/ה · ' + esc(d.client.name || '') + '</span></div><div>' + (d.sign.me ? '<img src="' + d.sign.me + '" alt="">' : '<i></i>') + '<span>' + esc(FS.BIZ.owner || FS.BIZ.name) + ' · ' + esc(FS.BIZ.name) + '</span></div></div>'; }
  function dealDoc(d) {
    var t = totals(d), ev = FS.event(d.type), r = num(pay().vat), rows = '';
    rows += '<tr><td>חבילת ' + esc(d.pkg || 'מגנטים לאירוע') + '</td><td>' + money(d.price) + '</td></tr>';
    (d.extras || []).forEach(function (x) { if (x.desc || num(x.amount)) rows += '<tr><td>' + esc(x.desc) + '</td><td>' + money(x.amount) + '</td></tr>'; });
    if (num(d.discount)) rows += '<tr><td>הנחה</td><td>−' + money(d.discount) + '</td></tr>';
    if (d.vatMode === 'plus') rows += '<tr><td>מע״מ ' + r + '%</td><td>' + money(t.vat) + '</td></tr>';
    var pk = (FS.getPackages ? FS.getPackages() : []).filter(function (p) { return p.name === d.pkg; })[0];
    return head('אישור הזמנה וסגירת עסקה', d.no, d.closedAt) +
      '<section class="doc-two"><div><h2>הלקוח/ה</h2><p><b>' + esc(d.client.name) + '</b>' + (d.client.idNo ? '<br>ת.ז / ח.פ ' + esc(d.client.idNo) : '') + (d.client.phone ? '<br>' + esc(d.client.phone) : '') + (d.client.email ? '<br>' + esc(d.client.email) : '') + (d.client.address ? '<br>' + esc(d.client.address) : '') + '</p></div>' +
      '<div><h2>האירוע</h2><p><b>' + ev.icon + ' ' + esc(ev.name) + '</b><br>' + heDate(d.date) + (d.time ? ' · ' + esc(d.time) : '') + (d.venue ? '<br>' + esc(d.venue) : '') + (d.guests ? '<br>כ־' + esc(d.guests) + ' אורחים' : '') + '</p></div></section>' +
      (pk && pk.features && pk.features.length ? '<section><h2>מה כלול</h2><ul class="doc-inc">' + pk.features.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + (pk.hours ? '<li>' + esc(pk.hours) + '</li>' : '') + (pk.magnets ? '<li>' + esc(pk.magnets) + '</li>' : '') + '</ul></section>' : '') +
      '<section><h2>התמורה</h2><table class="doc-tbl">' + rows + '<tr class="tot"><td>סה״כ לתשלום' + (d.vatMode === 'incl' ? ' (כולל מע״מ ' + r + '%)' : d.vatMode === 'none' ? '' : '') + '</td><td>' + money(t.total) + '</td></tr></table>' +
      '<div class="doc-sched"><div><span>מקדמה לסגירת התאריך</span><b>' + money(t.deposit || 0) + '</b></div><div><span>יתרה' + (d.balanceDue ? ' עד ' + new Date(d.balanceDue + 'T12:00:00').toLocaleDateString('he-IL') : ' עד יום האירוע') + '</span><b>' + money(Math.max(0, t.total - (t.deposit || 0))) + '</b></div>' + (t.paid ? '<div><span>שולם עד היום</span><b>' + money(t.paid) + '</b></div><div class="bal"><span>נותר לתשלום</span><b>' + money(t.balance) + '</b></div>' : '') + '</div></section>' +
      '<section><h2>אפשרויות תשלום</h2>' + payOptions() + '</section>' +
      (d.terms ? '<section><h2>תנאים</h2><ol class="doc-terms">' + d.terms.split('\n').filter(function (x) { return x.trim(); }).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol></section>' : '') +
      '<p class="doc-agree">בחתימתם מאשרים הצדדים את פרטי ההזמנה, התמורה והתנאים שלמעלה.</p>' + sigs(d) + '<footer class="doc-foot">' + esc(FS.BIZ.name) + ' · ' + esc(FS.BIZ.phone || '') + ' · תודה שבחרתם בנו 🧲</footer>';
  }
  function receiptDoc(d, p) {
    var t = totals(d), ev = FS.event(d.type), label = pay().docLabel || 'אישור תשלום';
    var before = (d.payments || []).slice(0, d.payments.indexOf(p) + 1).reduce(function (s, x) { return s + num(x.amount); }, 0);
    return head(esc(label), p.no, p.date + 'T12:00:00') +
      '<section class="doc-rc"><p>התקבל מאת <b>' + esc(d.client.name) + '</b>' + (d.client.idNo ? ' (' + esc(d.client.idNo) + ')' : '') + '</p><div class="doc-amount">' + money(p.amount) + '</div>' +
      '<table class="doc-tbl"><tr><td>אמצעי תשלום</td><td>' + methodName(p.method) + '</td></tr>' + (p.ref ? '<tr><td>אסמכתא</td><td>' + esc(p.ref) + '</td></tr>' : '') + '<tr><td>תאריך התשלום</td><td>' + new Date(p.date + 'T12:00:00').toLocaleDateString('he-IL') + '</td></tr>' +
      '<tr><td>עבור</td><td>' + ev.name + ' · ' + heDate(d.date) + (d.no ? ' · עסקה מס׳ ' + d.no : '') + '</td></tr><tr><td>סה״כ העסקה</td><td>' + money(t.total) + '</td></tr><tr><td>שולם עד כה</td><td>' + money(before) + '</td></tr><tr class="tot"><td>יתרה לתשלום</td><td>' + money(Math.max(0, t.total - before)) + '</td></tr></table></section>' +
      '<div class="doc-sigs one"><div>' + (d.sign.me ? '<img src="' + d.sign.me + '" alt="">' : '<i></i>') + '<span>' + esc(FS.BIZ.owner || FS.BIZ.name) + ' · ' + esc(FS.BIZ.name) + '</span></div></div>' +
      '<p class="doc-small">מסמך זה מאשר את קבלת התשלום ואינו מהווה חשבונית מס או קבלה לצורכי מס.</p><footer class="doc-foot">' + esc(FS.BIZ.name) + ' · ' + esc(FS.BIZ.phone || '') + '</footer>';
  }
  function printDoc(html) {
    var root = $('#print-root'); root.innerHTML = '<div class="doc" dir="rtl">' + html + '</div>';
    var st = $('#page-size') || document.head.appendChild(Object.assign(document.createElement('style'), { id: 'page-size' }));
    st.textContent = '@page { size: A4; margin: 14mm 14mm; }';
    document.body.classList.add('printing', 'printing-doc');
    var imgs = $$('img', root).map(function (im) { return im.decode ? im.decode().catch(function () {}) : null; });
    Promise.all(imgs).then(function () { setTimeout(function () { window.print(); }, 60); });
    FS.toast('בחלון ההדפסה אפשר לבחור "שמירה כ־PDF" ולשלוח ללקוח', 5000);
  }
  window.addEventListener('afterprint', function () { document.body.classList.remove('printing-doc'); });
  FS.printDoc = printDoc; FS.dealDoc = dealDoc; FS.receiptDoc = receiptDoc; FS.dealTotals = totals;
  FS.deals = { all: all, put: put, totals: totals, status: status, money: money, heDate: heDate, pay: pay, wa: wa, first: first };

  var btn = $('#deals-btn'); if (btn) btn.addEventListener('click', function () { open(); });
})();
