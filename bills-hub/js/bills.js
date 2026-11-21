/* תשלומים חודשיים: מונים (קריאה קודמת ונוכחית), תשלומים קבועים, היסטוריה,
   קובץ Excel אחד עם כל הנתונים, תמונת חשבון ושליחה בוואטסאפ.
   Everything stays in this browser (localStorage); nothing is sent to a server. */
(function () {
  'use strict';

  var KEY = 'bills-hub-v1';
  var DEFAULT_METERS = [
    { icon: '⚡', name: 'חשמל', uom: 'קוט"ש', rate: 0.64, fixed: 0, vat: false },
    { icon: '💧', name: 'מים', uom: 'מ"ק', rate: 7.7, fixed: 0, vat: false },
    { icon: '🔥', name: 'גז', uom: 'מ"ק', rate: 0, fixed: 0, vat: false }
  ];
  var DEFAULT_FIXED = ['ארנונה', 'ועד בית', 'אינטרנט', 'טלוויזיה', 'טלפון'];
  var ICONS = { 'חשמל': '⚡', 'מים': '💧', 'גז': '🔥' };

  var $ = function (s) { return document.querySelector(s); };
  function num(v) { var n = parseFloat(String(v === undefined || v === null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; }
  function has(v) { return v !== '' && v !== null && v !== undefined && isFinite(parseFloat(v)); }
  function r2(n) { return Math.round(n * 100) / 100; }
  function money(n) { return r2(n).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₪'; }
  function plain(n) { return r2(n).toLocaleString('he-IL', { maximumFractionDigits: 3 }); }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function monthName(m) {
    var p = String(m || '').split('-');
    if (p.length !== 2) return m || '';
    return new Date(+p[0], +p[1] - 1, 1).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
  }
  function thisMonth() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }

  // ---------- storage ----------
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && Array.isArray(s.records)) {
        s.settings = Object.assign({ phone: '', vat: 18, lastUnit: '' }, s.settings || {});
        if (!Array.isArray(s.properties)) s.properties = [];
        if (!s.dues || typeof s.dues !== 'object') s.dues = {};
        return s;
      }
    } catch (e) {}
    return { settings: { phone: '', vat: 18, lastUnit: '' }, records: [], properties: [], dues: {} };
  }
  var db = load();
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); return true; }
    catch (e) { toast('לא ניתן לשמור בדפדפן הזה (מצב פרטי?) — הורידו קובץ כדי לא לאבד נתונים'); return false; }
  }
  function idOf(month, unit) { return month + '|' + (unit || '').trim(); }
  function find(month, unit) { var id = idOf(month, unit); return db.records.find(function (r) { return r.id === id; }); }
  function previousOf(month, unit) {
    unit = (unit || '').trim();
    return db.records
      .filter(function (r) { return (r.unit || '') === unit && r.month < month; })
      .sort(function (a, b) { return a.month < b.month ? 1 : -1; })[0];
  }
  function units() {
    var u = {};
    db.records.forEach(function (r) { u[r.unit || ''] = 1; });
    db.properties.forEach(function (p) { if ((p.name || '').trim()) u[p.name.trim()] = 1; });
    return Object.keys(u).sort();
  }

  // ---------- calculation ----------
  function calcMeter(m, vatPct) {
    var cons = has(m.curr) && has(m.prev) ? num(m.curr) - num(m.prev) : 0;
    var base = cons * num(m.rate) + num(m.fixed);
    var amount = m.vat ? base * (1 + num(vatPct) / 100) : base;
    return { cons: r2(cons * 1000) / 1000, amount: r2(amount) };
  }
  function totals(r) {
    var meters = 0, fixed = 0;
    r.meters.forEach(function (m) { meters += calcMeter(m, r.vatPct).amount; });
    r.fixed.forEach(function (f) { fixed += num(f.amount); });
    return { meters: r2(meters), fixed: r2(fixed), total: r2(meters + fixed) };
  }
  function meterUsed(m) { return has(m.curr) || num(m.fixed) > 0; }

  // ---------- the bill being edited ----------
  var cur = null;

  function freshRecord(month, unit) {
    var prev = previousOf(month, unit);
    return {
      id: idOf(month, unit), month: month, unit: (unit || '').trim(), vatPct: num(db.settings.vat),
      meters: prev
        ? prev.meters.map(function (m) { return { icon: m.icon, name: m.name, uom: m.uom, prev: has(m.curr) ? m.curr : m.prev, curr: '', rate: m.rate, fixed: m.fixed, vat: !!m.vat }; })
        : DEFAULT_METERS.map(function (m) { return Object.assign({ prev: '', curr: '' }, m); }),
      fixed: prev
        ? prev.fixed.map(function (f) { return { name: f.name, amount: f.amount }; })
        : DEFAULT_FIXED.map(function (n) { return { name: n, amount: '' }; }),
      notes: ''
    };
  }

  function open(month, unit) {
    var rec = find(month, unit);
    cur = rec ? copy(rec) : freshRecord(month, unit);
    $('#month').value = cur.month;
    $('#unit').value = cur.unit;
    $('#notes').value = cur.notes || '';
    var prev = previousOf(cur.month, cur.unit);
    $('#status').innerHTML = rec
      ? 'עריכת חודש שנשמר ב-' + esc(new Date(rec.savedAt).toLocaleString('he-IL')) + '.'
      : prev
        ? 'חודש חדש. הקריאות הקודמות הועתקו מ<b>' + esc(monthName(prev.month)) + '</b>; נשאר למלא את הקריאות הנוכחיות.'
        : 'חודש ראשון' + (cur.unit ? ' לנכס הזה' : '') + ': מלאו קריאה קודמת וקריאה נוכחית לכל מונה.';
    // keep the same inputs when the layout is unchanged, so a click that triggered this does not lose its target
    var mBoxes = document.querySelectorAll('.meter'), fRows = document.querySelectorAll('.fixed-row');
    if (mBoxes.length === cur.meters.length && fRows.length === cur.fixed.length && mBoxes.length + fRows.length) {
      cur.meters.forEach(function (m, i) {
        mBoxes[i].querySelectorAll('[data-k]').forEach(function (inp) {
          if (inp.type === 'checkbox') inp.checked = !!m.vat; else inp.value = m[inp.dataset.k] === undefined ? '' : m[inp.dataset.k];
        });
        mBoxes[i].querySelector('.meter-icon').textContent = m.icon || '🔢';
        var info = mBoxes[i].querySelector('.meter-info'), html = meterInfo(m);
        if (info) info.remove();
        if (html) mBoxes[i].querySelector('.meter-head').insertAdjacentHTML('afterend', html);
      });
      cur.fixed.forEach(function (f, i) {
        fRows[i].querySelectorAll('[data-k]').forEach(function (inp) { inp.value = f[inp.dataset.k] === undefined ? '' : f[inp.dataset.k]; });
      });
      cur._prevRec = prev;
    } else {
      renderMeters();
      renderFixed();
    }
    recalc();
  }

  function renderMeters() {
    var prevRec = previousOf(cur.month, cur.unit);
    $('#meters').innerHTML = cur.meters.map(function (m, i) {
      return '<div class="meter" data-i="' + i + '">' +
        '<div class="meter-head">' +
          '<span class="meter-icon">' + esc(m.icon || '🔢') + '</span>' +
          '<input class="name" data-k="name" value="' + esc(m.name) + '" aria-label="שם המונה" />' +
          '<input class="uom" data-k="uom" value="' + esc(m.uom) + '" aria-label="יחידת מידה" />' +
          '<button type="button" class="icon-btn" data-del-meter="' + i + '" title="הסר מונה" aria-label="הסר מונה">✕</button>' +
        '</div>' +
        meterInfo(m) +
        '<div class="meter-grid">' +
          field('קריאה קודמת', 'prev', m.prev, 'reading') +
          field('קריאה נוכחית', 'curr', m.curr, 'reading') +
          field('תעריף ליחידה (₪)', 'rate', m.rate) +
          field('תשלום קבוע (₪)', 'fixed', m.fixed) +
        '</div>' +
        '<div class="meter-foot">' +
          '<span class="meter-calc" data-calc="' + i + '"></span>' +
          '<label class="check"><input type="checkbox" data-k="vat"' + (m.vat ? ' checked' : '') + ' /> + מע"מ</label>' +
          '<span class="meter-sum" data-sum="' + i + '"></span>' +
        '</div>' +
        '<div class="warn" data-warn="' + i + '" hidden></div>' +
      '</div>';
    }).join('');
    function field(label, k, v, cls) {
      return '<label class="fld ' + (cls || '') + '"><span>' + label + '</span>' +
        '<input type="number" inputmode="decimal" step="any" data-k="' + k + '" value="' + esc(v) + '" /></label>';
    }
    cur._prevRec = prevRec;
  }

  // the meter number and provider from the property page, when the bill's property has them
  function meterInfo(m) {
    var P = window.BillsPayments;
    var t = P && P.meterInfo(cur.unit, m.name);
    return t ? '<div class="meter-info">' + esc(t) + '</div>' : '';
  }

  function renderFixed() {
    $('#fixed').innerHTML = cur.fixed.map(function (f, i) {
      return '<div class="fixed-row" data-f="' + i + '">' +
        '<input data-k="name" value="' + esc(f.name) + '" placeholder="שם התשלום" aria-label="שם התשלום" />' +
        '<input type="number" inputmode="decimal" step="any" data-k="amount" value="' + esc(f.amount) + '" placeholder="₪" aria-label="סכום" />' +
        '<button type="button" class="icon-btn" data-del-fixed="' + i + '" title="הסר" aria-label="הסר">✕</button>' +
      '</div>';
    }).join('');
  }

  function recalc() {
    var prevRec = cur._prevRec;
    cur.meters.forEach(function (m, i) {
      var c = calcMeter(m, cur.vatPct);
      var calc = document.querySelector('[data-calc="' + i + '"]');
      var sum = document.querySelector('[data-sum="' + i + '"]');
      var warn = document.querySelector('[data-warn="' + i + '"]');
      if (!calc) return;
      var txt = has(m.curr) && has(m.prev)
        ? 'צריכה: <b>' + plain(c.cons) + ' ' + esc(m.uom) + '</b>' + (num(m.rate) ? ' × ' + plain(num(m.rate)) + ' ₪' : '')
        : 'הזינו קריאה קודמת ונוכחית';
      var pm = prevRec && prevRec.meters.find(function (x) { return x.name === m.name; });
      if (pm && has(m.curr) && has(m.prev)) {
        var pc = calcMeter(pm, prevRec.vatPct).cons;
        if (pc > 0) {
          var d = Math.round((c.cons - pc) / pc * 100);
          txt += ' <span class="trend ' + (d > 0 ? 'up' : d < 0 ? 'down' : '') + '">' + (d > 0 ? '▲ ' : d < 0 ? '▼ ' : '') + Math.abs(d) + '% מהחודש הקודם</span>';
        }
      }
      calc.innerHTML = txt;
      sum.textContent = money(c.amount);
      var w = '';
      if (has(m.curr) && has(m.prev) && num(m.curr) < num(m.prev)) w = 'הקריאה הנוכחית קטנה מהקודמת. אם המונה הוחלף או התאפס, תקנו את הקריאה הקודמת.';
      warn.hidden = !w;
      warn.textContent = w;
    });
    var t = totals(cur);
    $('#total').textContent = money(t.total);
    $('#total-split').innerHTML = '<span>מונים: ' + money(t.meters) + '</span><span>קבועים: ' + money(t.fixed) + '</span>';
  }

  // ---------- events on the bill ----------
  $('#meters').addEventListener('input', function (e) {
    var k = e.target.dataset.k, box = e.target.closest('.meter');
    if (!k || !box) return;
    var m = cur.meters[+box.dataset.i];
    if (k === 'vat') m.vat = e.target.checked;
    else m[k] = e.target.value;
    if (k === 'name') { m.icon = ICONS[m.name.trim()] || m.icon || '🔢'; box.querySelector('.meter-icon').textContent = m.icon; }
    recalc();
  });
  $('#meters').addEventListener('change', function (e) {
    if (e.target.dataset.k === 'vat') { cur.meters[+e.target.closest('.meter').dataset.i].vat = e.target.checked; recalc(); }
  });
  $('#meters').addEventListener('click', function (e) {
    var b = e.target.closest('[data-del-meter]');
    if (!b) return;
    var m = cur.meters[+b.dataset.delMeter];
    if (!confirm('להסיר את המונה "' + (m.name || '') + '" מהחודש הזה?')) return;
    cur.meters.splice(+b.dataset.delMeter, 1);
    renderMeters(); recalc();
  });
  $('#add-meter').addEventListener('click', function () {
    cur.meters.push({ icon: '🔢', name: 'מונה חדש', uom: 'יח\'', prev: '', curr: '', rate: '', fixed: '', vat: false });
    renderMeters(); recalc();
    var last = document.querySelector('.meter:last-child input.name');
    if (last) { last.focus(); last.select(); }
  });
  $('#fixed').addEventListener('input', function (e) {
    var row = e.target.closest('.fixed-row');
    if (!row || !e.target.dataset.k) return;
    cur.fixed[+row.dataset.f][e.target.dataset.k] = e.target.value;
    recalc();
  });
  $('#fixed').addEventListener('click', function (e) {
    var b = e.target.closest('[data-del-fixed]');
    if (!b) return;
    cur.fixed.splice(+b.dataset.delFixed, 1);
    renderFixed(); recalc();
  });
  $('#add-fixed').addEventListener('click', function () {
    cur.fixed.push({ name: '', amount: '' });
    renderFixed();
    var rows = document.querySelectorAll('.fixed-row input[data-k="name"]');
    rows[rows.length - 1].focus();
  });
  $('#notes').addEventListener('input', function (e) { cur.notes = e.target.value; });
  $('#month').addEventListener('change', function () {
    var m = $('#month').value;
    if (m && m !== cur.month) open(m, $('#unit').value);
  });
  $('#unit').addEventListener('change', function () {
    var u = $('#unit').value.trim();
    if (u !== cur.unit) open($('#month').value || thisMonth(), u);
  });

  function save(quiet) {
    if (!/^\d{4}-\d{2}$/.test(cur.month)) { toast('בחרו חודש'); return false; }
    var rec = copy(cur);
    delete rec._prevRec;
    rec.fixed = rec.fixed.filter(function (f) { return (f.name || '').trim() || has(f.amount); });
    rec.savedAt = new Date().toISOString();
    var i = db.records.findIndex(function (r) { return r.id === rec.id; });
    if (i >= 0) db.records[i] = rec; else db.records.push(rec);
    db.settings.lastUnit = rec.unit;
    var ok = persist();
    cur.savedAt = rec.savedAt;
    refreshUnits();
    renderHistory();
    if (ok && !quiet) toast('נשמר: ' + monthName(rec.month) + (rec.unit ? ' · ' + rec.unit : ''));
    if (ok) $('#status').textContent = 'נשמר ב-' + new Date(rec.savedAt).toLocaleString('he-IL') + '.';
    return true;
  }
  $('#save').addEventListener('click', function () { save(false); });

  // ---------- the unified Excel file ----------
  function sorted(list) {
    return list.slice().sort(function (a, b) {
      return a.month === b.month ? (a.unit || '').localeCompare(b.unit || '', 'he') : a.month < b.month ? -1 : 1;
    });
  }
  function workbook(list, withTracking) {
    list = sorted(list);
    // sheet 1: one row per month, one column per item
    var meterNames = [], fixedNames = [];
    list.forEach(function (r) {
      r.meters.forEach(function (m) { if (meterUsed(m) && meterNames.indexOf(m.name) < 0) meterNames.push(m.name); });
      r.fixed.forEach(function (f) { if (num(f.amount) && fixedNames.indexOf(f.name) < 0) fixedNames.push(f.name); });
    });
    var head = ['חודש', 'נכס'];
    meterNames.forEach(function (n) { head.push(n + ' — צריכה', n + ' — ₪'); });
    fixedNames.forEach(function (n) { head.push(n + ' — ₪'); });
    head.push('סה"כ ₪');
    var sum = [head.map(function (h) { return { v: h, s: 'head' }; })];
    var grand = 0;
    list.forEach(function (r) {
      var row = [monthName(r.month), r.unit || ''];
      meterNames.forEach(function (n) {
        var m = r.meters.find(function (x) { return x.name === n; });
        if (!m || !meterUsed(m)) { row.push(null, null); return; }
        var c = calcMeter(m, r.vatPct);
        row.push(has(m.curr) ? c.cons : null, { v: c.amount, s: 'money' });
      });
      fixedNames.forEach(function (n) {
        var v = r.fixed.filter(function (x) { return x.name === n; }).reduce(function (s, x) { return s + num(x.amount); }, 0);
        row.push(v ? { v: r2(v), s: 'money' } : null);
      });
      var t = totals(r).total;
      grand += t;
      row.push({ v: t, s: 'total' });
      sum.push(row);
    });
    if (list.length > 1) {
      var tr = [{ v: 'סה"כ', s: 'bold' }];
      for (var i = 1; i < head.length - 1; i++) tr.push(null);
      tr.push({ v: r2(grand), s: 'total' });
      sum.push(tr);
    }
    var sumCols = head.map(function (h, i) { return i === 0 ? 16 : i === 1 ? 18 : Math.max(12, h.length + 2); });

    // sheet 2: every line of every bill, readings included
    var dh = ['חודש', 'נכס', 'סוג', 'פריט', 'קריאה קודמת', 'קריאה נוכחית', 'צריכה', 'יחידה', 'תעריף ₪', 'תשלום קבוע ₪', 'מע"מ', 'סכום ₪', 'הערות'];
    var det = [dh.map(function (h) { return { v: h, s: 'head' }; })];
    list.forEach(function (r) {
      var first = true;
      r.meters.forEach(function (m) {
        if (!meterUsed(m)) return;
        var c = calcMeter(m, r.vatPct);
        det.push([monthName(r.month), r.unit || '', 'מונה', m.name,
          has(m.prev) ? num(m.prev) : null, has(m.curr) ? num(m.curr) : null, has(m.curr) ? c.cons : null, m.uom,
          num(m.rate) || null, num(m.fixed) ? { v: num(m.fixed), s: 'money' } : null,
          m.vat ? num(r.vatPct) + '%' : '', { v: c.amount, s: 'money' }, first ? (r.notes || '') : '']);
        first = false;
      });
      r.fixed.forEach(function (f) {
        if (!num(f.amount)) return;
        det.push([monthName(r.month), r.unit || '', 'קבוע', f.name, null, null, null, '', null, null, '',
          { v: r2(num(f.amount)), s: 'money' }, first ? (r.notes || '') : '']);
        first = false;
      });
      det.push([{ v: monthName(r.month), s: 'bold' }, { v: r.unit || '', s: 'bold' }, { v: 'סה"כ', s: 'bold' },
        null, null, null, null, null, null, null, null, { v: totals(r).total, s: 'total' }, null]);
    });
    var sheets = [
      { name: 'סיכום חודשי', cols: sumCols, rows: sum },
      { name: 'פירוט מלא', cols: [16, 18, 8, 16, 13, 13, 10, 9, 10, 13, 7, 13, 30], rows: det }
    ];
    var P = window.BillsPayments, track = withTracking && P && P.sheet();
    if (track) sheets.push(track);
    return MiniXLSX.build(sheets);
  }
  function xlsxFile() {
    var all = $('#scope-all').checked;
    var list = all ? db.records : db.records.filter(function (r) { return r.id === cur.id; });
    var name = all ? 'תשלומים-חודשיים-' + thisMonth() + '.xlsx' : 'חשבון-' + cur.month + (cur.unit ? '-' + cur.unit.replace(/[\\\/:*?"<>|]/g, '') : '') + '.xlsx';
    return new File([workbook(list, all)], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  // ---------- the bill picture ----------
  function billCanvas(r) {
    var W = 1080, P = 64;
    var meters = r.meters.filter(meterUsed);
    var fixed = r.fixed.filter(function (f) { return num(f.amount); });
    var H = 250 + (meters.length ? 70 + meters.length * 110 : 0) + (fixed.length ? 70 + fixed.length * 64 : 0) + (r.notes ? 90 : 0) + 190;
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var x = cv.getContext('2d');
    var F = 'Heebo, Arial, sans-serif';
    x.direction = 'rtl';
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#0f5c55'; x.fillRect(0, 0, W, 200);
    x.fillStyle = '#ffffff'; x.textAlign = 'right';
    x.font = '800 54px ' + F; x.fillText('חשבון תשלומים חודשי', W - P, 92);
    x.font = '500 34px ' + F; x.fillText(monthName(r.month) + (r.unit ? '  ·  ' + r.unit : ''), W - P, 150);
    var y = 250;
    function section(title) {
      x.fillStyle = '#5a6b68'; x.textAlign = 'right'; x.font = '700 30px ' + F;
      x.fillText(title, W - P, y + 20); y += 70;
    }
    function line() { x.fillStyle = '#e3ebe9'; x.fillRect(P, y - 22, W - 2 * P, 2); }
    if (meters.length) {
      section('מונים');
      meters.forEach(function (m) {
        var c = calcMeter(m, r.vatPct);
        x.fillStyle = '#15211f'; x.textAlign = 'right'; x.font = '700 38px ' + F;
        x.fillText((m.icon ? m.icon + '  ' : '') + m.name, W - P, y + 12);
        x.textAlign = 'left'; x.font = '800 38px ' + F; x.fillStyle = '#0f5c55';
        x.fillText(money(c.amount), P, y + 12);
        x.textAlign = 'right'; x.font = '400 27px ' + F; x.fillStyle = '#5a6b68';
        var d = has(m.curr) && has(m.prev)
          ? 'קודם ' + plain(num(m.prev)) + '  ←  נוכחי ' + plain(num(m.curr)) + '   ·   צריכה ' + plain(c.cons) + ' ' + m.uom + (num(m.rate) ? ' × ' + plain(num(m.rate)) + ' ₪' : '')
          : 'תשלום קבוע';
        if (num(m.fixed) && has(m.curr)) d += '  + קבוע ' + plain(num(m.fixed));
        if (m.vat) d += '  + מע"מ ' + plain(num(r.vatPct)) + '%';
        x.fillText(d, W - P, y + 56);
        y += 110; line();
      });
    }
    if (fixed.length) {
      section('תשלומים קבועים');
      fixed.forEach(function (f) {
        x.fillStyle = '#15211f'; x.textAlign = 'right'; x.font = '500 34px ' + F;
        x.fillText(f.name || 'תשלום', W - P, y + 12);
        x.textAlign = 'left'; x.font = '700 34px ' + F;
        x.fillText(money(num(f.amount)), P, y + 12);
        y += 64; line();
      });
    }
    if (r.notes) {
      x.fillStyle = '#5a6b68'; x.textAlign = 'right'; x.font = '400 27px ' + F;
      x.fillText('הערות: ' + String(r.notes).replace(/\s+/g, ' ').slice(0, 70), W - P, y + 30);
      y += 90;
    }
    y += 20;
    x.fillStyle = '#0f5c55';
    roundRect(x, P, y, W - 2 * P, 120, 22); x.fill();
    x.fillStyle = '#ffffff'; x.textAlign = 'right'; x.font = '500 36px ' + F;
    x.fillText('סה"כ לתשלום', W - P - 36, y + 74);
    x.textAlign = 'left'; x.font = '800 52px ' + F;
    x.fillText(money(totals(r).total), P + 36, y + 80);
    return cv;
  }
  function roundRect(x, l, t, w, h, rad) {
    x.beginPath();
    x.moveTo(l + rad, t); x.arcTo(l + w, t, l + w, t + h, rad); x.arcTo(l + w, t + h, l, t + h, rad);
    x.arcTo(l, t + h, l, t, rad); x.arcTo(l, t, l + w, t, rad); x.closePath();
  }
  function pngFile(r) {
    return new Promise(function (res) {
      billCanvas(r).toBlob(function (b) {
        res(new File([b], 'חשבון-' + r.month + (r.unit ? '-' + r.unit.replace(/[\\\/:*?"<>|]/g, '') : '') + '.png', { type: 'image/png' }));
      }, 'image/png');
    });
  }

  // ---------- WhatsApp ----------
  function summaryText(r) {
    var lines = ['*חשבון תשלומים — ' + monthName(r.month) + '*'];
    if (r.unit) lines.push('נכס: ' + r.unit);
    lines.push('');
    r.meters.filter(meterUsed).forEach(function (m) {
      var c = calcMeter(m, r.vatPct);
      lines.push((m.icon ? m.icon + ' ' : '') + m.name + ': ' +
        (has(m.curr) && has(m.prev) ? plain(num(m.prev)) + ' ← ' + plain(num(m.curr)) + ' (' + plain(c.cons) + ' ' + m.uom + ') = ' : '') + money(c.amount));
    });
    r.fixed.filter(function (f) { return num(f.amount); }).forEach(function (f) { lines.push('• ' + f.name + ': ' + money(num(f.amount))); });
    lines.push('', '*סה"כ לתשלום: ' + money(totals(r).total) + '*');
    if (r.notes) lines.push('הערות: ' + r.notes);
    return lines.join('\n');
  }
  function waPhone() {
    var p = String(db.settings.phone || '').replace(/\D/g, '');
    if (!p) return '';
    if (p.indexOf('00') === 0) p = p.slice(2);
    else if (p.charAt(0) === '0') p = '972' + p.slice(1);
    return p;
  }
  function download(file) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  $('#share').addEventListener('click', function () {
    if (!save(true)) return;
    var text = summaryText(cur), x = xlsxFile();
    pngFile(cur).then(function (png) {
      var files = [x, png];
      if (navigator.canShare && navigator.share) {
        var data = { files: files, title: 'חשבון ' + monthName(cur.month), text: text };
        if (!navigator.canShare(data)) data = { files: [x], text: text };
        if (navigator.canShare(data)) {
          return navigator.share(data).then(function () { toast('נשלח'); }, function (e) {
            if (e && e.name === 'AbortError') return;
            fallback();
          });
        }
      }
      fallback();
      function fallback() {
        download(x);
        var p = waPhone();
        window.open('https://wa.me/' + p + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
        toast('קובץ ה-Excel ירד למכשיר. צרפו אותו בשיחת הוואטסאפ שנפתחה (📎)');
      }
    });
  });
  $('#dl-xlsx').addEventListener('click', function () { if (save(true)) download(xlsxFile()); });
  $('#dl-png').addEventListener('click', function () { if (save(true)) pngFile(cur).then(download); });

  // ---------- history ----------
  function refreshUnits() {
    var u = units();
    $('#units').innerHTML = u.filter(Boolean).map(function (n) { return '<option value="' + esc(n) + '">'; }).join('');
    var sel = $('#hist-unit'), was = sel.value;
    sel.innerHTML = '<option value="*">כל הנכסים</option>' + u.map(function (n) {
      return '<option value="' + esc(n) + '">' + (n ? esc(n) : 'ללא שם נכס') + '</option>';
    }).join('');
    sel.value = u.indexOf(was) >= 0 || was === '*' ? was : '*';
  }
  function renderHistory() {
    var f = $('#hist-unit').value || '*';
    var list = sorted(db.records.filter(function (r) { return f === '*' || (r.unit || '') === f; })).reverse();
    $('#hist-empty').hidden = list.length > 0;
    $('#hist').hidden = !list.length;
    var names = [];
    list.forEach(function (r) { r.meters.forEach(function (m) { if (meterUsed(m) && names.indexOf(m.name) < 0) names.push(m.name); }); });
    $('#hist').innerHTML = !list.length ? '' :
      '<thead><tr><th>חודש</th><th>נכס</th>' + names.map(function (n) { return '<th>' + esc(n) + '</th>'; }).join('') +
      '<th>קבועים</th><th>סה"כ</th><th></th></tr></thead><tbody>' +
      list.map(function (r) {
        var t = totals(r);
        return '<tr><td>' + esc(monthName(r.month)) + '</td><td>' + esc(r.unit || '—') + '</td>' +
          names.map(function (n) {
            var m = r.meters.find(function (x) { return x.name === n; });
            if (!m || !meterUsed(m)) return '<td>—</td>';
            var c = calcMeter(m, r.vatPct);
            return '<td class="num">' + money(c.amount) + (has(m.curr) ? '<span class="sub">' + plain(c.cons) + ' ' + esc(m.uom) + '</span>' : '') + '</td>';
          }).join('') +
          '<td class="num">' + money(t.fixed) + '</td><td class="num tot">' + money(t.total) + '</td>' +
          '<td><div class="row-actions"><button type="button" class="btn small" data-open="' + esc(r.id) + '">פתח</button>' +
          '<button type="button" class="btn small danger" data-del="' + esc(r.id) + '" aria-label="מחק">🗑️</button></div></td></tr>';
      }).join('') + '</tbody>';

    // monthly totals, oldest to newest, last 12 months
    var byMonth = {};
    list.forEach(function (r) { byMonth[r.month] = (byMonth[r.month] || 0) + totals(r).total; });
    var months = Object.keys(byMonth).sort().slice(-12);
    var max = Math.max.apply(null, months.map(function (m) { return byMonth[m]; }).concat([1]));
    $('#chart').innerHTML = months.length < 2 ? '' : months.map(function (m) {
      var p = m.split('-');
      return '<div class="bar-col" title="' + esc(monthName(m)) + ': ' + money(byMonth[m]) + '">' +
        '<span class="bar-val">' + Math.round(byMonth[m]).toLocaleString('he-IL') + '</span>' +
        '<div class="bar" style="height:' + Math.max(2, byMonth[m] / max * 100 * 0.78) + '%"></div>' +
        '<span class="bar-lbl">' + p[1] + '/' + p[0].slice(2) + '</span></div>';
    }).join('');
  }
  $('#hist-unit').addEventListener('change', renderHistory);
  $('#hist').addEventListener('click', function (e) {
    var o = e.target.closest('[data-open]'), d = e.target.closest('[data-del]');
    if (o) {
      var r = db.records.find(function (x) { return x.id === o.dataset.open; });
      if (r) { open(r.month, r.unit); showTab('bill'); window.scrollTo(0, 0); }
    } else if (d) {
      var rec = db.records.find(function (x) { return x.id === d.dataset.del; });
      if (!rec || !confirm('למחוק את ' + monthName(rec.month) + (rec.unit ? ' (' + rec.unit + ')' : '') + '?')) return;
      db.records = db.records.filter(function (x) { return x.id !== rec.id; });
      persist(); refreshUnits(); renderHistory();
      if (cur.id === rec.id) open(cur.month, cur.unit);
    }
  });
  $('#hist-xlsx').addEventListener('click', function () {
    if (!db.records.length && !db.properties.length) { toast('אין עדיין נתונים'); return; }
    download(new File([workbook(db.records, true)], 'תשלומים-חודשיים-' + thisMonth() + '.xlsx'));
  });

  // ---------- settings and backup ----------
  $('#phone').value = db.settings.phone || '';
  $('#vat').value = db.settings.vat;
  $('#phone').addEventListener('change', function (e) { db.settings.phone = e.target.value.trim(); persist(); });
  $('#vat').addEventListener('change', function (e) {
    db.settings.vat = num(e.target.value);
    persist();
    if (!find(cur.month, cur.unit)) { cur.vatPct = db.settings.vat; recalc(); }
  });
  $('#backup').addEventListener('click', function () {
    download(new File([JSON.stringify(db, null, 1)], 'גיבוי-תשלומים-' + new Date().toISOString().slice(0, 10) + '.json', { type: 'application/json' }));
  });
  $('#restore').addEventListener('change', function (e) {
    var f = e.target.files[0];
    if (!f) return;
    f.text().then(function (t) {
      var s = JSON.parse(t);
      if (!s || !Array.isArray(s.records)) throw new Error('bad');
      (Array.isArray(s.properties) ? s.properties : []).forEach(function (p) {
        if (!p || !p.id || !Array.isArray(p.services)) return;
        var i = db.properties.findIndex(function (x) { return x.id === p.id; });
        if (i >= 0) db.properties[i] = p; else db.properties.push(p);
      });
      if (s.dues && typeof s.dues === 'object') Object.keys(s.dues).forEach(function (k) { db.dues[k] = s.dues[k]; });
      var add = 0;
      s.records.forEach(function (r) {
        if (!r || !/^\d{4}-\d{2}$/.test(r.month) || !Array.isArray(r.meters) || !Array.isArray(r.fixed)) return;
        r.id = idOf(r.month, r.unit);
        var i = db.records.findIndex(function (x) { return x.id === r.id; });
        if (i >= 0) db.records[i] = r; else db.records.push(r);
        add++;
      });
      persist(); refreshUnits(); renderHistory(); open(cur.month, cur.unit);
      if (window.BillsPayments) BillsPayments.render();
      toast('נטענו ' + add + ' חודשים ו-' + db.properties.length + ' נכסים מהגיבוי');
    }).catch(function () { toast('הקובץ אינו גיבוי תקין של האתר'); });
    e.target.value = '';
  });
  $('#wipe').addEventListener('click', function () {
    if (!confirm('למחוק את כל הנתונים (חודשים, נכסים ותשלומים) שנשמרו בדפדפן הזה? מומלץ להוריד גיבוי קודם.')) return;
    db.records = [];
    db.properties = [];
    db.dues = {};
    if (window.BillsPayments) BillsPayments.render();
    persist(); refreshUnits(); renderHistory(); open(thisMonth(), '');
    toast('כל הנתונים נמחקו');
  });

  // ---------- tabs, toast, start ----------
  function showTab(name) {
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('active', t.dataset.tab === name); });
    document.querySelectorAll('.panel').forEach(function (p) { p.classList.toggle('active', p.id === 'panel-' + name); });
    try { sessionStorage.setItem('bills-tab', name); } catch (e) {}
    if (window.BillsPayments && (name === 'due' || name === 'props')) BillsPayments.render();
    if (name === 'bill' && cur) { renderMeters(); renderFixed(); recalc(); }
  }
  document.querySelectorAll('.tab').forEach(function (t) { t.addEventListener('click', function () { showTab(t.dataset.tab); }); });
  var tt;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(tt); tt = setTimeout(function () { el.classList.remove('show'); }, 3800);
  }

  // what js/payments.js (properties, due payments, reading a bill) uses
  window.Bills = {
    db: function () { return db; }, persist: persist, toast: toast, showTab: showTab, download: download,
    num: num, has: has, r2: r2, money: money, plain: plain, esc: esc, monthName: monthName, thisMonth: thisMonth,
    calcMeter: calcMeter, totals: totals, meterUsed: meterUsed, find: find, freshRecord: freshRecord, waPhone: waPhone,
    // writes a whole month record (from a read bill) and refreshes what shows it
    storeRecord: function (rec) {
      rec.id = idOf(rec.month, rec.unit);
      delete rec._prevRec;
      rec.savedAt = new Date().toISOString();
      var i = db.records.findIndex(function (r) { return r.id === rec.id; });
      if (i >= 0) db.records[i] = rec; else db.records.push(rec);
      persist(); refreshUnits(); renderHistory();
      if (cur && cur.id === rec.id) open(rec.month, rec.unit);
    },
    openBill: function (month, unit) { open(month, unit); showTab('bill'); window.scrollTo(0, 0); },
    refreshUnits: refreshUnits
  };

  refreshUnits();
  open(thisMonth(), db.settings.lastUnit || '');
  renderHistory();
  try { var tab = sessionStorage.getItem('bills-tab'); if (tab) showTab(tab); } catch (e) {}
})();
