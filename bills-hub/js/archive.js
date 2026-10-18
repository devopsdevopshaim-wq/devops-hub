/* ארכיון מסמכים וניתוח צריכה: כל חשבון, קבלה או דף חשבון (בנק, אשראי) נשמר כאן עם הקובץ עצמו
   (IndexedDB בדפדפן) והפרטים שנקראו ממנו. מהם, מהתשלומים ומקריאות המונים נבנה סיכום לכל גוף:
   חשמל, מים, גז, ארנונה, בנקים ועוד — כמה שולם, ממוצע לחודש, מגמה, צריכה, מחיר ליחידה וחריגות.
   Uses window.Bills (bills.js) and window.BillsPayments (payments.js). */
(function () {
  'use strict';
  var B = window.Bills, P = window.BillsPayments;
  if (!B || !P) return;
  var $ = function (s) { return document.querySelector(s); };
  var esc = B.esc, num = B.num, money = B.money, has = B.has;
  var TYPES = P.TYPES, KINDS = P.KINDS;
  var KIND_NAME = {};
  KINDS.forEach(function (k) { KIND_NAME[k[0]] = k[1]; });
  // fixed lines of the month records, by name
  var FIXED_TYPE = { 'ארנונה': 'arnona', 'ועד בית': 'vaad', 'אינטרנט': 'internet', 'טלוויזיה': 'tv', 'טלפון': 'phone', 'ביטוח': 'insurance', 'שכירות': 'rent', 'משכנתא': 'rent' };
  var METER_TYPE = { 'חשמל': 'elec', 'מים': 'water', 'גז': 'gas' };

  function db() { return B.db(); }
  function uid() { return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function mIdx(m) { var p = String(m).split('-'); return +p[0] * 12 + (+p[1] - 1); }
  function mStr(i) { return Math.floor(i / 12) + '-' + pad(i % 12 + 1); }
  function validDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
  function parseDate(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fmtDate(s) { return validDate(s) ? parseDate(s).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' }) : ''; }
  function isoToday() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function type(t) { return TYPES[t] || TYPES.other; }
  function shortMonth(m) { var p = m.split('-'); return p[1] + '/' + p[0].slice(2); }
  function pct(a, b) { return b > 0 ? Math.round((a - b) / b * 100) : null; }
  function median(list) {
    if (!list.length) return 0;
    var s = list.slice().sort(function (a, b) { return a - b; }), h = s.length >> 1;
    return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
  }
  function docs() { return db().docs || (db().docs = []); }

  // ---------- the files: IndexedDB, one blob per document ----------
  var idb = null;
  function store(mode) {
    if (!idb) idb = new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error('no-idb'));
      var r = indexedDB.open('bills-hub-files', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('files'); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return idb.then(function (d) { return d.transaction('files', mode).objectStore('files'); });
  }
  function req(r) { return new Promise(function (res, rej) { r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  function putFile(id, blob) { return store('readwrite').then(function (s) { return req(s.put(blob, id)); }); }
  function getFile(id) { return store('readonly').then(function (s) { return req(s.get(id)); }).catch(function () { return null; }); }
  function delFile(id) { return store('readwrite').then(function (s) { return req(s.delete(id)); }).catch(function () {}); }

  // big photos are kept as a 2000px JPEG; PDFs and small files as they are
  function shrink(file) {
    if (!/^image\//.test(file.type) || file.size < 1.5 * 1024 * 1024) return Promise.resolve(file);
    return new Promise(function (res) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        var x = c.getContext('2d');
        x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
        x.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { res(b || file); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); res(file); };
      img.src = url;
    });
  }

  // ---------- documents ----------
  function newDoc(file, s, res) {
    s = s || {};
    var cons = has(s.consumption) ? num(s.consumption) : has(s.prev) && has(s.curr) ? B.r2(num(s.curr) - num(s.prev)) : '';
    return {
      id: uid(), kind: s.kind || 'bill', type: TYPES[s.type] ? s.type : 'other', provider: s.provider || '',
      propId: res && res.p ? res.p.id : (s.propId || ''), dueKey: res && res.key ? res.key : '',
      date: s.date || s.paidDate || s.due || '', due: s.due || '', from: s.from || '', to: s.to || '',
      amount: has(s.amount) ? num(s.amount) : '', fees: has(s.fees) ? num(s.fees) : '',
      consumption: cons, uom: s.uom || (TYPES[s.type] && TYPES[s.type].uom) || '',
      customerNo: s.customerNo || '', meterNo: s.meterNo || '', notes: '',
      fileName: file ? file.name : '', mime: file ? file.type : '', size: 0, hasFile: false,
      review: !!s.review, addedAt: new Date().toISOString()
    };
  }
  function keepFile(doc, file) {
    if (!file) return Promise.resolve(doc);
    return shrink(file).then(function (blob) {
      return putFile(doc.id, blob).then(function () {
        doc.hasFile = true; doc.size = blob.size; doc.mime = blob.type || doc.mime;
        B.persist();
        return doc;
      });
    }).catch(function () {
      B.toast('הפרטים נשמרו, אבל את הקובץ עצמו לא ניתן לשמור בדפדפן הזה (מצב פרטי?)');
      return doc;
    });
  }
  // from the scan dialog in payments.js
  function add(file, s, res) {
    var d = newDoc(file, s, res);
    docs().push(d);
    B.persist();
    return keepFile(d, file).then(function () { render(); return d; });
  }

  // ---------- "מסמכים" tab ----------
  var urls = [];
  function freeUrls() { urls.forEach(function (u) { URL.revokeObjectURL(u); }); urls = []; }
  function propName(id) {
    var p = db().properties.find(function (x) { return x.id === id; });
    return p ? P.propName(p) : '';
  }
  function docMonth(d) {
    var s = validDate(d.date) ? d.date : validDate(d.due) ? d.due : validDate(d.to) ? d.to : (d.addedAt || '').slice(0, 10);
    return s.slice(0, 7);
  }
  function fillSelect(sel, opts, keep) {
    var v = sel.value;
    sel.innerHTML = opts.map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>'; }).join('');
    sel.value = opts.some(function (o) { return o[0] === v; }) ? v : keep || opts[0][0];
  }
  function propOptions(all) {
    return (all ? [['*', 'כל הנכסים']] : []).concat(db().properties.map(function (p) { return [p.id, P.propName(p)]; }));
  }

  function renderDocs() {
    var list = docs();
    var usedTypes = {};
    list.forEach(function (d) { usedTypes[d.type] = 1; });
    fillSelect($('#doc-type'), [['*', 'כל הגופים']].concat(Object.keys(TYPES).filter(function (k) { return usedTypes[k]; }).map(function (k) { return [k, TYPES[k].icon + ' ' + TYPES[k].name]; })));
    fillSelect($('#doc-kind'), [['*', 'כל סוגי המסמכים']].concat(KINDS));
    var years = {};
    list.forEach(function (d) { years[docMonth(d).slice(0, 4)] = 1; });
    fillSelect($('#doc-year'), [['*', 'כל השנים']].concat(Object.keys(years).filter(Boolean).sort().reverse().map(function (y) { return [y, y]; })));
    fillSelect($('#doc-prop'), propOptions(true));
    $('#doc-prop').closest('.fld').hidden = db().properties.length < 2;

    var t = $('#doc-type').value, k = $('#doc-kind').value, y = $('#doc-year').value, pr = $('#doc-prop').value;
    var q = $('#doc-q').value.trim().toLowerCase();
    var shown = list.filter(function (d) {
      if (t !== '*' && d.type !== t) return false;
      if (k !== '*' && d.kind !== k) return false;
      if (y !== '*' && docMonth(d).slice(0, 4) !== y) return false;
      if (pr !== '*' && d.propId !== pr) return false;
      if (q && [d.provider, d.customerNo, d.meterNo, d.notes, d.fileName, type(d.type).name, propName(d.propId)].join(' ').toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) { return docMonth(a) + a.date < docMonth(b) + b.date ? 1 : -1; });

    var sum = shown.reduce(function (s, d) { return s + (has(d.amount) ? num(d.amount) : 0); }, 0);
    var review = list.filter(function (d) { return d.review; }).length;
    $('#doc-tiles').innerHTML = !list.length ? '' :
      tile('', 'מסמכים בארכיון', String(list.length), shown.length === list.length ? 'כולם מוצגים' : shown.length + ' מוצגים לפי הסינון') +
      tile('auto', 'סכום המסמכים המוצגים', money(sum), 'חשבונות, קבלות ודפי חשבון') +
      tile(review ? 'soon' : 'paid', 'להשלמת פרטים', String(review), review ? 'מסמכים שלא נקראו אוטומטית' : 'הכל מסודר');

    freeUrls();
    if (!list.length) {
      $('#doc-list').innerHTML = '<div class="card empty-state"><div class="empty-big">🗂️</div><h2>הארכיון ריק</h2>' +
        '<p>העלו חשבונות, קבלות ודפי חשבון מהבנק או מחברת האשראי (תמונה או PDF). האתר קורא מכל מסמך את הגוף, הסכום, התקופה והצריכה,' +
        ' שומר את הקובץ עצמו בדפדפן ובונה מהם את הניתוח.</p></div>';
      return;
    }
    if (!shown.length) { $('#doc-list').innerHTML = '<p class="empty">אין מסמכים שמתאימים לסינון.</p>'; return; }
    $('#doc-list').innerHTML = '<div class="doc-grid">' + shown.map(docCard).join('') + '</div>';
    shown.forEach(function (d) {
      if (!d.hasFile || !/^image\//.test(d.mime)) return;
      getFile(d.id).then(function (b) {
        var el = document.querySelector('.doc[data-id="' + d.id + '"] .doc-thumb');
        if (!b || !el) return;
        var u = URL.createObjectURL(b);
        urls.push(u);
        el.innerHTML = '<img src="' + u + '" alt="" loading="lazy" />';
      });
    });
  }
  function tile(cls, title, value, note) {
    return '<div class="tile ' + cls + '"><div class="tile-t">' + title + '</div><div class="tile-v">' + value + '</div><div class="tile-n">' + note + '</div></div>';
  }
  function docCard(d) {
    var T = type(d.type), when = d.from && d.to ? fmtDate(d.from) + '–' + fmtDate(d.to) : fmtDate(d.date || d.due);
    var meta = [esc(KIND_NAME[d.kind] || '')];
    if (propName(d.propId)) meta.push(esc(propName(d.propId)));
    if (when) meta.push(when);
    var facts = [];
    if (has(d.amount)) facts.push('<b>' + money(num(d.amount)) + '</b>');
    if (has(d.consumption)) facts.push(B.plain(num(d.consumption)) + ' ' + esc(d.uom || ''));
    if (has(d.fees) && num(d.fees)) facts.push('עמלות ' + money(num(d.fees)));
    return '<article class="doc' + (d.review ? ' review' : '') + '" data-id="' + esc(d.id) + '">' +
      '<button type="button" class="doc-thumb" data-view aria-label="הצג את המסמך">' + (d.hasFile ? (/pdf/.test(d.mime) ? '<span class="doc-pdf">PDF</span>' : '<span class="doc-ph">' + T.icon + '</span>') : '<span class="doc-ph">' + T.icon + '</span>') + '</button>' +
      '<div class="doc-body">' +
        '<div class="doc-title">' + T.icon + ' ' + esc(T.name) + (d.provider ? ' · ' + esc(d.provider) : '') + '</div>' +
        '<div class="doc-meta">' + meta.join(' · ') + '</div>' +
        '<div class="doc-facts">' + (facts.join(' · ') || '<span class="hint">אין סכום</span>') + (d.review ? ' <span class="tag-src warn-tag">להשלים פרטים</span>' : '') + '</div>' +
        '<div class="doc-btns">' +
          (d.hasFile ? '<button type="button" class="btn small" data-view>👁️ הצג</button><button type="button" class="btn small" data-dl>⬇️</button>' : '') +
          '<button type="button" class="btn small" data-edit>✏️ עריכה</button>' +
          '<button type="button" class="btn small danger" data-del aria-label="מחק">🗑️</button>' +
        '</div></div></article>';
  }
  function docById(el) { var c = el.closest('[data-id]'); return c && docs().find(function (d) { return d.id === c.dataset.id; }); }

  $('#doc-list').addEventListener('click', function (e) {
    var d = docById(e.target);
    if (!d) return;
    if (e.target.closest('[data-view]')) {
      if (!d.hasFile) { openEdit(d); return; }
      var w = window.open('', '_blank');
      getFile(d.id).then(function (b) {
        if (!b) { if (w) w.close(); B.toast('הקובץ לא נמצא בדפדפן הזה'); return; }
        var u = URL.createObjectURL(b);
        if (w) w.location.href = u; else B.download(new File([b], d.fileName || 'מסמך'));
        setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
      });
    } else if (e.target.closest('[data-dl]')) {
      getFile(d.id).then(function (b) { if (b) B.download(new File([b], fileName(d, b), { type: b.type })); });
    } else if (e.target.closest('[data-edit]')) {
      openEdit(d);
    } else if (e.target.closest('[data-del]')) {
      if (!confirm('למחוק את המסמך "' + type(d.type).name + (d.provider ? ' · ' + d.provider : '') + '"? (התשלום והקריאות שנשמרו ממנו נשארים)')) return;
      db().docs = docs().filter(function (x) { return x !== d; });
      delFile(d.id);
      B.persist();
      renderDocs();
    }
  });
  function fileName(d, b) {
    if (d.fileName) return d.fileName;
    var ext = /pdf/.test(b.type) ? '.pdf' : /png/.test(b.type) ? '.png' : '.jpg';
    return (type(d.type).name + '-' + (d.provider || '') + '-' + docMonth(d)).replace(/[\\\/:*?"<>|]/g, '') + ext;
  }
  ['#doc-type', '#doc-kind', '#doc-year', '#doc-prop'].forEach(function (s) { $(s).addEventListener('change', renderDocs); });
  var qT;
  $('#doc-q').addEventListener('input', function () { clearTimeout(qT); qT = setTimeout(renderDocs, 200); });
  $('#doc-scan').addEventListener('click', function () { P.openScan(); });

  // several files at once: each is read (when the reading service answers) and kept
  $('#doc-files').addEventListener('change', function (e) {
    var files = Array.prototype.slice.call(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    var auto = $('#doc-auto').checked, apply = $('#doc-apply').checked;
    var pid = $('#doc-prop').value;
    if (pid === '*' || !db().properties.some(function (p) { return p.id === pid; })) pid = db().properties.length ? db().properties[0].id : 'new';
    var st = $('#doc-status'), done = 0, read = 0, stopAi = !auto, why = '', old = 0;
    st.className = 'scan-status busy';
    function next(i) {
      if (i >= files.length) {
        st.className = 'scan-status ' + (read === files.length || !auto ? 'ok' : 'err');
        st.textContent = 'נשמרו ' + done + ' מסמכים' + (auto ? ', ' + read + ' מהם נקראו אוטומטית' : '') + '.' +
          (old ? ' ' + old + ' חשבונות ישנים (יותר מחודש אחרי מועד התשלום) נרשמו כשולמו.' : '') +
          (done > read && auto ? ' את השאר פתחו ב"עריכה" והשלימו סכום ותאריך.' + (why ? ' (' + why + ')' : '') : '');
        B.refreshUnits();
        render();
        if (window.BillsPayments) BillsPayments.render();
        return;
      }
      var f = files[i];
      st.textContent = 'מעבד ' + (i + 1) + ' מתוך ' + files.length + ': ' + f.name + '…';
      var work = stopAi ? Promise.reject(new Error('skip')) : P.readFile(f);
      work.then(function (s) {
        read++;
        var res = null;
        if (apply && (has(s.amount) || validDate(s.due) || (has(s.prev) && has(s.curr)))) {
          res = P.applyScanned(s, pid);
          pid = res.p.id;
          var due = db().dues[res.key];
          if (s.kind !== 'receipt' && due && !due.paidAt && validDate(s.due) && (Date.now() - parseDate(s.due)) / 86400000 > 30) {
            due.paidAt = s.due + 'T12:00:00.000Z';
            if (has(s.amount)) due.paidAmount = num(s.amount);
            old++;
          }
        }
        return add(f, s, res);
      }, function (err) {
        var code = err && err.message;
        if (code !== 'skip') {
          why = P.readError(code);
          if (['no-key', 'quota', 'offline', 'forbidden', 'rate-limited'].indexOf(code) >= 0) stopAi = true;
        }
        return add(f, { review: true, propId: pid === 'new' ? '' : pid });
      }).then(function () { done++; next(i + 1); });
    }
    next(0);
  });

  // ---------- editing a document ----------
  var editing = null;
  function openEdit(d) {
    editing = d;
    var f = function (k, lbl, v, typ, extra) {
      return '<label class="fld' + (extra || '') + '"><span>' + lbl + '</span><input data-e="' + k + '" value="' + esc(v) + '"' +
        (typ ? ' type="' + typ + '"' : '') + (typ === 'number' ? ' step="any" inputmode="decimal"' : '') + ' /></label>';
    };
    var opt = function (list, v) { return list.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === v ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); };
    var T = type(d.type);
    $('#doc-form').innerHTML =
      '<div class="svc-grid">' +
        '<label class="fld"><span>סוג מסמך</span><select data-e="kind">' + opt(KINDS, d.kind) + '</select></label>' +
        '<label class="fld"><span>גוף</span><select data-e="type">' + opt(Object.keys(TYPES).map(function (k) { return [k, TYPES[k].icon + ' ' + TYPES[k].name]; }), d.type) + '</select></label>' +
        '<label class="fld"><span>ספק / בנק / חברה</span><input data-e="provider" list="doc-prov" value="' + esc(d.provider) + '" />' +
          '<datalist id="doc-prov">' + (T.providers || []).map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist></label>' +
        '<label class="fld"><span>נכס</span><select data-e="propId"><option value="">—</option>' + opt(propOptions(false), d.propId) + '</select></label>' +
        f('date', d.kind === 'receipt' ? 'תאריך התשלום' : 'תאריך המסמך', d.date, 'date') +
        f('due', 'לתשלום עד', d.due, 'date') +
        f('from', 'תקופה מ-', d.from, 'date') + f('to', 'עד', d.to, 'date') +
        f('amount', d.kind === 'receipt' ? 'סכום ששולם (₪)' : d.kind === 'statement' ? 'סך החיובים (₪)' : 'סכום לתשלום (₪)', d.amount, 'number') +
        ((d.type === 'bank' || d.type === 'credit' || d.kind === 'statement') ? f('fees', 'עמלות וריביות (₪)', d.fees, 'number') : '') +
        (T.meter || has(d.consumption) ? f('consumption', 'צריכה בתקופה', d.consumption, 'number') + f('uom', 'יחידה', d.uom || T.uom || '') : '') +
        f('customerNo', 'מספר לקוח / חשבון', d.customerNo) +
        (T.meter ? f('meterNo', 'מספר מונה', d.meterNo) : '') +
        f('notes', 'הערות', d.notes, '', ' wide') +
      '</div>';
    var dlg = $('#doc-dlg');
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }
  $('#doc-form').addEventListener('change', function (e) {
    var k = e.target.dataset.e;
    if (!k || !editing) return;
    collect();
    if (k === 'type' || k === 'kind') openEdit(editing);
  });
  function collect() {
    document.querySelectorAll('#doc-form [data-e]').forEach(function (inp) {
      var k = inp.dataset.e, v = inp.value.trim();
      editing[k] = inp.type === 'number' ? (has(v) ? num(v) : '') : v;
    });
  }
  $('#doc-save').addEventListener('click', function () {
    if (!editing) return;
    collect();
    if (has(editing.amount) || validDate(editing.date) || validDate(editing.due)) editing.review = false;
    B.persist();
    var dlg = $('#doc-dlg');
    if (dlg.close) dlg.close(); else dlg.removeAttribute('open');
    editing = null;
    render();
    B.toast('המסמך עודכן');
  });

  // ---------- analysis ----------
  // Spending is counted by the month it was charged (due date, payment date, document date);
  // consumption bill by bill, per day of the period, so bills of one and two months compare.
  function propOfService(id) { var ps = P.findService(id); return ps ? ps.p.id : ''; }
  function propByUnit(unit) {
    var p = db().properties.find(function (x) { return (x.name || '').trim() === (unit || '').trim(); });
    return p ? p.id : 'unit:' + (unit || '');
  }
  function gather(prop) {
    var spend = [], use = [], fees = [], turnover = [], providers = {}, covered = {};
    function ok(pid) { return prop === '*' || pid === prop; }
    function addSpend(t, pid, month, amount, src, provider, from, to) {
      if (!ok(pid) || !/^\d{4}-\d{2}$/.test(month) || !isFinite(amount) || !amount) return;
      spend.push({ type: t, prop: pid, month: month, amount: amount, src: src, from: from || '', to: to || '' });
      covered[t + '|' + pid] = 1;
      if (provider) (providers[t] = providers[t] || {})[provider] = 1;
    }
    function addUse(t, pid, cons, uom, from, to, amount, end) {
      if (!ok(pid) || !(cons > 0)) return;
      var daysN = validDate(from) && validDate(to) ? Math.max(1, Math.round((parseDate(to) - parseDate(from)) / 86400000) + 1) : 0;
      use.push({ type: t, prop: pid, cons: cons, uom: uom, days: daysN, perMonth: daysN ? cons / daysN * 30.4 : null, amount: amount, end: end });
    }
    var linked = {}, billMonths = {};
    docs().forEach(function (d) {
      if (d.dueKey) linked[d.dueKey] = 1;
      if (d.kind !== 'receipt') billMonths[d.type + '|' + d.propId + '|' + docMonth(d)] = 1;
    });
    docs().forEach(function (d) {
      var m = docMonth(d);
      if (d.kind === 'receipt' && billMonths[d.type + '|' + d.propId + '|' + m]) return; // the bill is already counted
      // a statement's charges already hold the other bills: the bank or card costs only its fees
      if (d.kind === 'statement') {
        if (has(d.amount) && ok(d.propId)) turnover.push({ type: d.type, month: m, amount: num(d.amount) });
        if (has(d.fees) && num(d.fees)) addSpend(d.type, d.propId, m, num(d.fees), 'doc', d.provider);
        else if (ok(d.propId) && d.provider) (providers[d.type] = providers[d.type] || {})[d.provider] = 1;
      } else if (has(d.amount)) addSpend(d.type, d.propId, m, num(d.amount), 'doc', d.provider, d.from, d.to);
      if (has(d.fees) && num(d.fees) && ok(d.propId)) fees.push({ type: d.type, month: m, amount: num(d.fees) });
      if (has(d.consumption)) addUse(d.type, d.propId, num(d.consumption), d.uom || type(d.type).uom || '', d.from, d.to, has(d.amount) ? num(d.amount) : null, d.to || d.date || m + '-15');
    });
    var dues = db().dues;
    Object.keys(dues).forEach(function (k) {
      if (linked[k]) return;
      var x = dues[k], parts = k.split('|'), ps = P.findService(parts[0]);
      if (!ps) return;
      var amount = has(x.paidAmount) ? num(x.paidAmount) : x.source === 'bill' && has(x.amount) ? num(x.amount) : null;
      if (amount === null) return;
      var month = validDate(x.date) ? x.date.slice(0, 7) : parts[1];
      addSpend(ps.s.type, ps.p.id, month, amount, 'due', ps.s.provider);
    });
    // the month records count only for a body that has no bills or payments at all
    var fromRec = [];
    db().records.forEach(function (r) {
      var pid = propByUnit(r.unit);
      r.meters.forEach(function (mt) {
        var t = METER_TYPE[(mt.name || '').trim()];
        if (!t || !B.meterUsed(mt)) return;
        var c = B.calcMeter(mt, r.vatPct), last = new Date(+r.month.slice(0, 4), +r.month.slice(5, 7), 0).getDate();
        fromRec.push({ t: t, pid: pid, month: r.month, amount: c.amount });
        if (has(mt.curr) && has(mt.prev)) addUse(t, pid, c.cons, mt.uom || '', r.month + '-01', r.month + '-' + pad(last), c.amount || null, r.month + '-' + pad(last));
      });
      r.fixed.forEach(function (f) {
        var t = FIXED_TYPE[(f.name || '').trim()];
        if (t && num(f.amount)) fromRec.push({ t: t, pid: pid, month: r.month, amount: num(f.amount) });
      });
    });
    fromRec.forEach(function (x) { if (!covered[x.t + '|' + x.pid]) addSpend(x.t, x.pid, x.month, x.amount, 'rec'); });
    // the same period read twice (a doc and the month record) — keep one consumption point per type, property and end month
    var seenUse = {};
    use = use.sort(function (a, b) { return (b.days ? 1 : 0) - (a.days ? 1 : 0); }).filter(function (u) {
      var k = u.type + '|' + u.prop + '|' + String(u.end).slice(0, 7);
      if (seenUse[k]) return false;
      seenUse[k] = 1;
      return true;
    }).sort(function (a, b) { return a.end < b.end ? -1 : 1; });
    return { spend: spend, use: use, fees: fees, turnover: turnover, providers: providers };
  }

  function analyse(prop, range) {
    var g = gather(prop), now = mIdx(B.thisMonth());
    var first = now - (range - 1);
    var months = [];
    for (var i = first; i <= now; i++) months.push(mStr(i));
    var cats = {};
    g.turnover.forEach(function (s) { cats[s.type] = cats[s.type] || { type: s.type, byMonth: {}, all: [], total: 0 }; });
    g.spend.forEach(function (s) {
      var c = cats[s.type] = cats[s.type] || { type: s.type, byMonth: {}, all: [], total: 0 };
      c.all.push(s);
      c.byMonth[s.month] = (c.byMonth[s.month] || 0) + s.amount;
    });
    var out = Object.keys(cats).map(function (t) {
      var c = cats[t];
      var inRange = c.all.filter(function (s) { var k = mIdx(s.month); return k >= first && k <= now; });
      c.total = inRange.reduce(function (s, x) { return s + x.amount; }, 0);
      var firstData = c.all.length ? Math.min.apply(null, c.all.map(function (s) { return mIdx(s.month); })) : now;
      var span = now - Math.max(first, firstData) + 1;
      c.avg = span > 0 ? c.total / span : 0;
      function sumBetween(a, b) { var s = 0; for (var k = a; k <= b; k++) s += c.byMonth[mStr(k)] || 0; return s; }
      c.last6 = sumBetween(now - 5, now);
      c.prev6 = firstData <= now - 11 ? sumBetween(now - 11, now - 6) : null;
      c.yoy6 = firstData <= now - 17 ? sumBetween(now - 17, now - 12) : null;
      c.change = c.prev6 !== null ? pct(c.last6, c.prev6) : null;
      c.yoy = c.yoy6 !== null ? pct(c.last6, c.yoy6) : null;
      // the latest bill against the bills before it
      var bills = c.all.slice().sort(function (a, b) { return a.month < b.month ? -1 : 1; });
      c.lastBill = bills[bills.length - 1];
      var before = bills.slice(Math.max(0, bills.length - 7), -1).map(function (x) { return x.amount; });
      c.med = median(before);
      c.spike = before.length >= 3 && c.lastBill && c.lastBill.amount > c.med * 1.3 ? pct(c.lastBill.amount, c.med) : null;
      // consumption
      var u = g.use.filter(function (x) { return x.type === t && x.perMonth !== null; });
      if (u.length) {
        var lastU = u[u.length - 1], prevU = u.slice(Math.max(0, u.length - 7), -1);
        c.uom = lastU.uom;
        c.useLast = lastU.perMonth;
        c.useAvg = prevU.length ? prevU.reduce(function (s, x) { return s + x.perMonth; }, 0) / prevU.length : null;
        c.useChange = c.useAvg ? pct(c.useLast, c.useAvg) : null;
        var priced = u.filter(function (x) { return x.amount > 0 && x.cons > 0; });
        if (priced.length) {
          c.unitLast = priced[priced.length - 1].amount / priced[priced.length - 1].cons;
          var pp = priced.slice(0, -1);
          c.unitAvg = pp.length ? pp.reduce(function (s, x) { return s + x.amount / x.cons; }, 0) / pp.length : null;
        }
        c.usePoints = u.slice(-12);
      }
      c.turnover = g.turnover.filter(function (f) { var k = mIdx(f.month); return f.type === t && k >= first && k <= now; }).reduce(function (s, f) { return s + f.amount; }, 0);
      c.fees = g.fees.filter(function (f) { var k = mIdx(f.month); return f.type === t && k >= first && k <= now; }).reduce(function (s, f) { return s + f.amount; }, 0);
      c.providers = Object.keys(g.providers[t] || {});
      c.months = months.map(function (m) { return { m: m, v: c.byMonth[m] || 0 }; });
      c.status = c.spike !== null ? 'spike' : c.change !== null && c.change >= 15 ? 'up' : c.change !== null && c.change <= -15 ? 'down' : c.change === null ? 'new' : 'flat';
      return c;
    }).filter(function (c) { return c.total > 0 || c.usePoints || c.turnover > 0; }).sort(function (a, b) { return b.total - a.total; });
    var total = out.reduce(function (s, c) { return s + c.total; }, 0);
    var byMonth = months.map(function (m) { return { m: m, v: out.reduce(function (s, c) { return s + (c.byMonth[m] || 0); }, 0) }; });
    var withData = byMonth.filter(function (x) { return x.v > 0; });
    var firstAny = withData.length ? mIdx(withData[0].m) : now;
    return { cats: out, total: total, months: months, byMonth: byMonth, avg: total / Math.max(1, now - firstAny + 1), range: range };
  }

  var STATUS = {
    spike: ['⚠️', 'חריגה בחשבון האחרון', 'late'], up: ['↗', 'במגמת עלייה', 'soon'],
    down: ['↘', 'במגמת ירידה', 'paid'], flat: ['✓', 'יציב', 'paid'], new: ['•', 'עוד אין מספיק היסטוריה', '']
  };
  function signed(n) { return (n > 0 ? '+' : '') + n + '%'; }
  function insights(a) {
    var out = [];
    a.cats.forEach(function (c) {
      var T = type(c.type), n = T.icon + ' <b>' + esc(T.name) + '</b>';
      if (c.spike !== null) out.push([3, n + ': החשבון האחרון (' + money(c.lastBill.amount) + ') גבוה ב-' + c.spike + '% מהחשבון הרגיל (' + money(c.med) + '). שווה לבדוק אם יש טעות, חוב קודם או צריכה חריגה.']);
      if (c.useChange !== null && Math.abs(c.useChange) >= 15) out.push([2, n + ': הצריכה בחשבון האחרון היא כ-' + B.plain(Math.round(c.useLast)) + ' ' + esc(c.uom) + ' לחודש, ' + (c.useChange > 0 ? 'עלייה' : 'ירידה') + ' של ' + Math.abs(c.useChange) + '% לעומת הממוצע הקודם.' + (c.useChange > 0 && (c.type === 'water') ? ' עלייה חדה במים בלי סיבה ברורה יכולה להעיד על נזילה.' : '')]);
      if (c.unitLast && c.unitAvg && Math.abs(pct(c.unitLast, c.unitAvg)) >= 8) out.push([2, n + ': המחיר ליחידה ' + (c.unitLast > c.unitAvg ? 'עלה' : 'ירד') + ' ל-' + c.unitLast.toFixed(2) + ' ₪ ל' + esc(c.uom || 'יחידה') + ' (ממוצע קודם ' + c.unitAvg.toFixed(2) + ' ₪). ' + (c.unitLast > c.unitAvg ? 'ייתכן שינוי תעריף, מדרגת צריכה גבוהה יותר או חיוב קבוע חדש.' : '')]);
      if (c.change !== null && Math.abs(c.change) >= 15 && c.spike === null) out.push([1, n + ': ב-6 החודשים האחרונים שולמו ' + money(c.last6) + ', ' + signed(c.change) + ' לעומת 6 החודשים שלפניהם.' + ((c.type === 'elec' || c.type === 'gas') ? ' בחשמל ובגז חלק מהשינוי עונתי (מזגן, חימום).' : '')]);
      if (c.yoy !== null && Math.abs(c.yoy) >= 10) out.push([1, n + ': לעומת אותה תקופה אשתקד: ' + signed(c.yoy) + '.']);
      if ((c.type === 'bank' || c.type === 'credit') && c.fees > 0) out.push([2, n + ': שולמו ' + money(c.fees) + ' עמלות וריביות בתקופה. שווה לבדוק מסלול עמלות או להתמקח עם ' + (c.type === 'bank' ? 'הבנק' : 'חברת האשראי') + '.']);
    });
    if (a.cats.length > 1 && a.total > 0) {
      var top = a.cats[0];
      out.push([0, 'הגוף שעולה הכי הרבה: ' + type(top.type).icon + ' <b>' + esc(type(top.type).name) + '</b>, ' + Math.round(top.total / a.total * 100) + '% מכל התשלומים בתקופה.']);
    }
    return out.sort(function (x, y) { return y[0] - x[0]; }).map(function (x) { return x[1]; });
  }

  function bars(points, fmt, label) {
    var max = Math.max.apply(null, points.map(function (p) { return p.v; }).concat([1]));
    return '<div class="mini-chart" role="img" aria-label="' + esc(label) + '">' + points.map(function (p) {
      var t = p.label + ': ' + fmt(p.v);
      return '<div class="mc-col" tabindex="0" data-tip="' + esc(t) + '">' +
        '<div class="mc-bar' + (p.v ? '' : ' zero') + '" style="height:' + (p.v ? Math.max(3, p.v / max * 100) : 0) + '%"></div>' +
        '<span class="mc-lbl">' + esc(p.short) + '</span></div>';
    }).join('') + '</div>';
  }

  var lastAnalysis = null;
  function renderAnalysis() {
    fillSelect($('#an-prop'), propOptions(true));
    $('#an-prop').closest('.fld').hidden = db().properties.length < 2;
    var a = lastAnalysis = analyse($('#an-prop').value, +$('#an-range').value || 12);
    if (!a.cats.length) {
      $('#an-tiles').innerHTML = '';
      $('#an-body').innerHTML = '<div class="card empty-state"><div class="empty-big">📊</div><h2>עוד אין נתונים לניתוח</h2>' +
        '<p>העלו חשבונות וקבלות ללשונית "מסמכים", סמנו תשלומים כשולמו, או שמרו קריאות מונים — והניתוח ייבנה לבד: כמה עולה כל גוף, מגמות, צריכה וחריגות.</p>' +
        '<div class="actions center"><button type="button" class="btn primary" data-go-docs>🗂️ למסמכים</button></div></div>';
      return;
    }
    var rangeName = a.range === 12 ? '12 החודשים האחרונים' : a.range === 24 ? 'השנתיים האחרונות' : a.range + ' החודשים האחרונים';
    var spikes = a.cats.filter(function (c) { return c.status === 'spike'; }).length;
    var ups = a.cats.filter(function (c) { return c.status === 'up'; }).length;
    $('#an-tiles').innerHTML =
      tile('auto', 'סה"כ שולם · ' + rangeName, money(a.total), a.cats.length + ' גופים') +
      tile('', 'ממוצע לחודש', money(a.avg), 'כל הגופים יחד') +
      tile('soon', 'הגוף היקר ביותר', type(a.cats[0].type).icon + ' ' + esc(type(a.cats[0].type).name), money(a.cats[0].total)) +
      tile(spikes ? 'late' : ups ? 'soon' : 'paid', 'מצב', spikes ? spikes + ' חריגות' : ups ? ups + ' במגמת עלייה' : 'תקין', spikes ? 'בדקו את החשבונות המסומנים' : 'אין חשבון חריג');

    var ins = insights(a);
    var monthsChart = bars(a.byMonth.map(function (x) { return { v: x.v, label: B.monthName(x.m), short: shortMonth(x.m) }; }), money, 'סה"כ תשלומים לפי חודש');
    var share = '<div class="share">' + a.cats.map(function (c) {
      var T = type(c.type), p = a.total ? c.total / a.total * 100 : 0;
      return '<div class="share-row"><span class="share-name">' + T.icon + ' ' + esc(T.name) + '</span>' +
        '<span class="share-track"><span class="share-bar" style="width:' + Math.max(p ? 1.5 : 0, p) + '%"></span></span>' +
        '<span class="share-val">' + money(c.total) + ' <small>' + Math.round(p) + '%</small></span></div>';
    }).join('') + '</div>';

    var table = '<div class="table-wrap"><table class="hist an-table"><thead><tr><th>גוף</th><th>סה"כ בתקופה</th><th>ממוצע לחודש</th><th>6 חודשים אחרונים</th><th>שינוי</th><th>צריכה לחודש</th><th>₪ ליחידה</th><th>מצב</th></tr></thead><tbody>' +
      a.cats.map(function (c) {
        var T = type(c.type), S = STATUS[c.status];
        return '<tr><td>' + T.icon + ' ' + esc(T.name) + '</td><td class="num">' + money(c.total) + '</td><td class="num">' + money(c.avg) + '</td>' +
          '<td class="num">' + money(c.last6) + '</td><td class="num">' + (c.change === null ? '—' : signed(c.change)) + '</td>' +
          '<td class="num">' + (c.useLast ? B.plain(Math.round(c.useLast)) + ' ' + esc(c.uom) : '—') + '</td>' +
          '<td class="num">' + (c.unitLast ? c.unitLast.toFixed(2) : '—') + '</td><td>' + S[0] + ' ' + S[1] + '</td></tr>';
      }).join('') + '</tbody></table></div>';

    var cards = '<div class="an-grid">' + a.cats.map(function (c) {
      var T = type(c.type), S = STATUS[c.status];
      var stats = [
        ['סה"כ בתקופה', money(c.total)], ['ממוצע לחודש', money(c.avg)],
        ['שינוי (6 מול 6)', c.change === null ? '—' : signed(c.change)]
      ];
      if (c.yoy !== null) stats.push(['מול אשתקד', signed(c.yoy)]);
      if (c.useLast) stats.push(['צריכה לחודש', B.plain(Math.round(c.useLast)) + ' ' + esc(c.uom)]);
      if (c.unitLast) stats.push(['₪ ל' + esc(c.uom || 'יחידה'), c.unitLast.toFixed(2)]);
      if (c.fees) stats.push(['עמלות וריביות', money(c.fees)]);
      if (c.turnover) stats.push(['חיובים בדפי החשבון', money(c.turnover) + ' <small>לא נספר בסה"כ</small>']);
      if (c.lastBill) stats.push(['חשבון אחרון', money(c.lastBill.amount) + ' <small>' + shortMonth(c.lastBill.month) + '</small>']);
      var useChart = c.usePoints && c.usePoints.length > 1 ? '<div class="an-sub">צריכה לחודש לפי חשבון (' + esc(c.uom) + ')</div>' +
        bars(c.usePoints.map(function (u) { var m = String(u.end).slice(0, 7); return { v: B.r2(u.perMonth), label: B.monthName(m), short: shortMonth(m) }; }), function (v) { return B.plain(Math.round(v)) + ' ' + c.uom; }, 'צריכה של ' + T.name) : '';
      return '<article class="card an-card">' +
        '<div class="an-head"><span class="an-icon">' + T.icon + '</span><div><h3>' + esc(T.name) + '</h3>' +
          (c.providers.length ? '<div class="due-meta">' + c.providers.map(esc).join(' · ') + '</div>' : '') + '</div>' +
          '<span class="an-status ' + S[2] + '">' + S[0] + ' ' + S[1] + '</span></div>' +
        '<dl class="an-stats">' + stats.map(function (s) { return '<div><dt>' + s[0] + '</dt><dd>' + s[1] + '</dd></div>'; }).join('') + '</dl>' +
        '<div class="an-sub">תשלומים לפי חודש</div>' +
        bars(c.months.map(function (x) { return { v: B.r2(x.v), label: B.monthName(x.m), short: shortMonth(x.m) }; }), money, 'תשלומים ל' + T.name + ' לפי חודש') +
        useChart +
      '</article>';
    }).join('') + '</div>';

    $('#an-body').innerHTML =
      (ins.length ? '<div class="card insights"><h2 class="sec">מה כדאי לדעת</h2><ul>' + ins.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>' : '') +
      '<div class="card"><h2 class="sec">כל התשלומים לפי חודש</h2>' + monthsChart + '</div>' +
      '<div class="card"><h2 class="sec">חלוקה לפי גוף</h2>' + share + '</div>' +
      '<h2 class="sec">סטטוס לכל גוף</h2>' + cards +
      '<h2 class="sec">טבלת סיכום</h2>' + table +
      '<p class="hint">הסכומים נספרים לפי חודש החיוב (תאריך התשלום או המסמך). הצריכה מחושבת לכל חשבון לפי ימי התקופה, כך שחשבון חודשי ודו־חודשי ניתנים להשוואה. ' +
      'חשבונות שמחכים לתשלום ועדיין אין להם חשבון אמיתי (סכום משוער) לא נכללים. בבנק ובכרטיס אשראי נספרות רק העמלות והריביות, כי סך החיובים בדף החשבון כבר כולל את שאר החשבונות.</p>';
  }
  $('#an-prop').addEventListener('change', renderAnalysis);
  $('#an-range').addEventListener('change', renderAnalysis);
  $('#an-body').addEventListener('click', function (e) { if (e.target.closest('[data-go-docs]')) B.showTab('docs'); });

  function summaryText(a) {
    var lines = ['*סיכום תשלומים לבית*', 'סה"כ: ' + money(a.total) + ' · ממוצע לחודש: ' + money(a.avg), ''];
    a.cats.forEach(function (c) {
      var T = type(c.type), S = STATUS[c.status];
      lines.push(T.icon + ' ' + T.name + ': ' + money(c.total) + ' (≈' + money(c.avg) + ' לחודש)' +
        (c.change !== null ? ', ' + signed(c.change) : '') + (c.useLast ? ', צריכה ≈' + Math.round(c.useLast) + ' ' + c.uom + ' לחודש' : '') +
        (c.status === 'spike' || c.status === 'up' ? ' ' + S[0] + ' ' + S[1] : ''));
    });
    return lines.join('\n');
  }
  $('#an-wa').addEventListener('click', function () {
    var a = lastAnalysis;
    if (!a || !a.cats.length) { B.toast('אין עדיין נתונים לסיכום'); return; }
    window.open('https://wa.me/' + B.waPhone() + '?text=' + encodeURIComponent(summaryText(a)), '_blank', 'noopener');
  });
  $('#an-xlsx').addEventListener('click', function () { $('#hist-xlsx').click(); });

  // an advice paragraph from the AI: only the sums per body are sent, no names, addresses or customer numbers
  $('#an-ai').addEventListener('click', function () {
    var a = lastAnalysis, box = $('#an-ai-out');
    if (!a || !a.cats.length) { B.toast('אין עדיין נתונים לניתוח'); return; }
    var data = a.cats.map(function (c) {
      return { body: type(c.type).name, total: B.r2(c.total), monthly_avg: B.r2(c.avg), last6: B.r2(c.last6), prev6: c.prev6 === null ? null : B.r2(c.prev6),
        change_pct: c.change, yoy_pct: c.yoy, last_bill: c.lastBill ? B.r2(c.lastBill.amount) : null, usual_bill: c.med ? B.r2(c.med) : null,
        consumption_per_month: c.useLast ? Math.round(c.useLast) : null, unit: c.uom || null, price_per_unit: c.unitLast ? B.r2(c.unitLast) : null, fees: c.fees ? B.r2(c.fees) : null };
    });
    var prompt = 'אתה יועץ לכלכלת משק בית בישראל. הנה סיכום התשלומים של משק בית ב-' + a.range + ' החודשים האחרונים, לפי גוף (JSON):\n' +
      JSON.stringify(data) + '\nכתוב בעברית, בקצרה (עד 8 נקודות): מה המצב, מה חריג, ואילו צעדים מעשיים יכולים להוזיל (למשל ספק חשמל או גז אחר, מסלול עמלות בבנק, בדיקת נזילה, החזר ארנונה או הנחה). ' +
      'אל תמציא נתונים שאינם בסיכום. בלי כותרות, נקודות שמתחילות ב-"• ".';
    box.hidden = false;
    box.className = 'scan-status busy';
    box.textContent = 'מנתח…';
    P.askServer({ action: 'ai', tag: 'bills', prompt: prompt }).then(function (j) {
      if (!j || !j.ok || !j.text) throw new Error((j && j.error) || 'ai-failed');
      box.className = 'card ai-out';
      box.innerHTML = '<h2 class="sec">🤖 ניתוח חכם</h2>' + String(j.text).split(/\n+/).filter(Boolean).map(function (l) { return '<p>' + esc(l.replace(/\*\*/g, '')) + '</p>'; }).join('') +
        '<p class="hint">נוצר אוטומטית מהסכומים שלמעלה. זו לא ייעוץ פיננסי; בדקו מול הספקים.</p>';
    }).catch(function (err) {
      box.className = 'scan-status err';
      box.textContent = P.readError(err && err.message);
    });
  });

  // ---------- Excel sheets ----------
  function sheets() {
    var out = [];
    if (docs().length) {
      var rows = [['תאריך', 'סוג מסמך', 'גוף', 'ספק', 'נכס', 'תקופה', 'סכום ₪', 'עמלות ₪', 'צריכה', 'יחידה', 'מספר לקוח', 'מספר מונה', 'קובץ', 'הערות'].map(function (h) { return { v: h, s: 'head' }; })];
      docs().slice().sort(function (a, b) { return docMonth(a) < docMonth(b) ? -1 : 1; }).forEach(function (d) {
        rows.push([fmtDate(d.date || d.due) || docMonth(d), KIND_NAME[d.kind] || '', type(d.type).name, d.provider || '', propName(d.propId),
          d.from && d.to ? fmtDate(d.from) + '–' + fmtDate(d.to) : '', has(d.amount) ? { v: num(d.amount), s: 'money' } : null,
          has(d.fees) && num(d.fees) ? { v: num(d.fees), s: 'money' } : null, has(d.consumption) ? num(d.consumption) : null, d.uom || '',
          d.customerNo || '', d.meterNo || '', d.fileName || '', d.notes || '']);
      });
      out.push({ name: 'ארכיון מסמכים', cols: [11, 18, 13, 16, 16, 18, 12, 11, 10, 8, 14, 13, 24, 26], rows: rows });
    }
    var a = analyse('*', 12);
    if (a.cats.length) {
      var r2 = [['גוף', 'סה"כ 12 חודשים ₪', 'ממוצע לחודש ₪', '6 חודשים אחרונים ₪', '6 חודשים קודמים ₪', 'שינוי %', 'מול אשתקד %', 'צריכה לחודש', 'יחידה', '₪ ליחידה', 'עמלות ₪', 'מצב']
        .map(function (h) { return { v: h, s: 'head' }; })];
      a.cats.forEach(function (c) {
        r2.push([type(c.type).name + (c.turnover ? ' (עמלות בלבד)' : ''), { v: B.r2(c.total), s: 'money' }, { v: B.r2(c.avg), s: 'money' }, { v: B.r2(c.last6), s: 'money' },
          c.prev6 === null ? null : { v: B.r2(c.prev6), s: 'money' }, c.change, c.yoy, c.useLast ? Math.round(c.useLast) : null, c.uom || '',
          c.unitLast ? B.r2(c.unitLast) : null, c.fees ? { v: B.r2(c.fees), s: 'money' } : null, STATUS[c.status][1]]);
      });
      r2.push([{ v: 'סה"כ', s: 'bold' }, { v: B.r2(a.total), s: 'total' }, { v: B.r2(a.avg), s: 'total' }]);
      out.push({ name: 'ניתוח לפי גוף', cols: [16, 15, 14, 16, 16, 9, 11, 12, 8, 10, 11, 22], rows: r2 });
    }
    return out;
  }

  // ---------- backup of the files ----------
  function blobToB64(b) {
    return new Promise(function (res) { var r = new FileReader(); r.onload = function () { res(String(r.result)); }; r.onerror = function () { res(''); }; r.readAsDataURL(b); });
  }
  function filesForBackup() {
    var out = {};
    return docs().reduce(function (p, d) {
      return p.then(function () {
        if (!d.hasFile) return;
        return getFile(d.id).then(function (b) { return b ? blobToB64(b).then(function (s) { if (s) out[d.id] = s; }) : null; });
      });
    }, Promise.resolve()).then(function () { return out; });
  }
  function restoreFiles(files) {
    if (!files || typeof files !== 'object') return Promise.resolve();
    return Object.keys(files).reduce(function (p, id) {
      return p.then(function () {
        var m = /^data:([^;,]*)(;base64)?,(.*)$/.exec(String(files[id]));
        if (!m) return;
        var bin = atob(m[3]), arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return putFile(id, new Blob([arr], { type: m[1] })).catch(function () {});
      });
    }, Promise.resolve()).then(function () { B.persist(); });
  }
  function wipe() {
    store('readwrite').then(function (s) { return req(s.clear()); }).catch(function () {});
    render();
  }

  function render(which) {
    var active = document.querySelector('.panel.active');
    var id = which || (active ? active.id.replace('panel-', '') : '');
    if (id === 'docs' || !which) renderDocs();
    if (id === 'analysis' || !which) renderAnalysis();
  }

  window.BillsArchive = { add: add, render: render, sheets: sheets, filesForBackup: filesForBackup, restoreFiles: restoreFiles, wipe: wipe, analyse: analyse };
  render();
  try { var tab = sessionStorage.getItem('bills-tab'); if (tab === 'docs' || tab === 'analysis') B.showTab(tab); } catch (e) {}
})();
