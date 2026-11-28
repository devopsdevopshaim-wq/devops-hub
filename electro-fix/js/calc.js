/* מחשבונים לשטח: חוק אוהם, מפל מתח וחתך כבל, זרם מנוע, קוד צבעים לנגד, נגד ל-LED. */
(function () {
  'use strict';

  var RHO_CU = 0.0225; // Ω·mm²/m בטמפרטורת עבודה (1.25 × ρ20), לפי IEC 60364
  var SECTIONS = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];
  // כושר הולכה משוער, נחושת PVC, שיטת התקנה B2 (בצינור על קיר), IEC 60364-5-52
  var AMP_2 = [16.5, 23, 30, 38, 52, 69, 90, 111, 133, 168, 201, 232, 258, 294, 344];
  var AMP_3 = [15, 20, 28, 35, 48, 64, 85, 104, 125, 160, 194, 225, 260, 297, 350];
  var BREAKERS = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250];

  var BANDS = [
    { name: 'שחור', hex: '#1d1d1f', d: 0, m: 1 },
    { name: 'חום', hex: '#8a4b1f', d: 1, m: 10, t: '±1%' },
    { name: 'אדום', hex: '#d9362b', d: 2, m: 100, t: '±2%' },
    { name: 'כתום', hex: '#f08c00', d: 3, m: 1e3 },
    { name: 'צהוב', hex: '#f2c500', d: 4, m: 1e4 },
    { name: 'ירוק', hex: '#2f9e44', d: 5, m: 1e5, t: '±0.5%' },
    { name: 'כחול', hex: '#1c6fe0', d: 6, m: 1e6, t: '±0.25%' },
    { name: 'סגול', hex: '#8a3ffc', d: 7, m: 1e7, t: '±0.1%' },
    { name: 'אפור', hex: '#8a8f98', d: 8, m: 1e8, t: '±0.05%' },
    { name: 'לבן', hex: '#f1f3f5', d: 9, m: 1e9 },
    { name: 'זהב', hex: '#c9a227', m: 0.1, t: '±5%' },
    { name: 'כסף', hex: '#b8bec6', m: 0.01, t: '±10%' }
  ];

  function $(s, r) { return (r || document).querySelector(s); }
  function num(el) { var v = parseFloat(String(el.value).replace(',', '.')); return isFinite(v) ? v : null; }
  function fmt(v, unit) {
    if (v == null || !isFinite(v)) return '—';
    var a = Math.abs(v), pre = '';
    if (a >= 1e6) { v /= 1e6; pre = 'M'; } else if (a >= 1e3 && unit !== 'W' && unit !== 'V' && unit !== 'A') { v /= 1e3; pre = 'k'; }
    else if (a > 0 && a < 1e-3) { v *= 1e6; pre = 'µ'; } else if (a > 0 && a < 1) { v *= 1e3; pre = 'm'; }
    return ltr((Math.round(v * 1000) / 1000).toLocaleString('he-IL') + ' ' + pre + unit);
  }
  // ערך עם יחידה לועזית בתוך טקסט עברי — מבודד כדי שלא יתהפך (A 10.6)
  function ltr(s) { return '<bdi dir="ltr">' + s + '</bdi>'; }

  function card(title, desc, body) {
    var el = document.createElement('article');
    el.className = 'card tool';
    el.innerHTML = '<h2>' + title + '</h2><p class="muted">' + desc + '</p>' + body;
    return el;
  }
  function field(id, label, unit, attrs) {
    return '<div class="field"><label for="' + id + '">' + label + '</label><div class="unit-input"><input id="' + id + '" inputmode="decimal" dir="ltr" ' + (attrs || '') + '><span>' + unit + '</span></div></div>';
  }

  function ohm() {
    var el = card('חוק אוהם והספק', 'מלאו שני ערכים כלשהם, והשאר יחושב.',
      '<div class="calc-grid">' + field('o-v', 'מתח', 'V') + field('o-i', 'זרם', 'A') + field('o-r', 'התנגדות', 'Ω') + field('o-p', 'הספק', 'W') + '</div>' +
      '<div class="calc-out" id="o-out" aria-live="polite"></div><button class="btn ghost small" type="button" id="o-clear">ניקוי</button>');
    var ids = ['v', 'i', 'r', 'p'];
    function calc() {
      var v = num($('#o-v', el)), i = num($('#o-i', el)), r = num($('#o-r', el)), p = num($('#o-p', el));
      var n = [v, i, r, p].filter(function (x) { return x != null; }).length;
      var out = $('#o-out', el);
      if (n < 2) { out.textContent = 'חסרים ערכים'; return; }
      if (v != null && i != null) { r = v / i; p = v * i; }
      else if (v != null && r != null) { i = v / r; p = v * i; }
      else if (v != null && p != null) { i = p / v; r = v / i; }
      else if (i != null && r != null) { v = i * r; p = v * i; }
      else if (i != null && p != null) { v = p / i; r = v / i; }
      else if (r != null && p != null) { v = Math.sqrt(p * r); i = v / r; }
      out.innerHTML = '<span><b>V</b> ' + fmt(v, 'V') + '</span><span><b>I</b> ' + fmt(i, 'A') + '</span><span><b>R</b> ' + fmt(r, 'Ω') + '</span><span><b>P</b> ' + fmt(p, 'W') + '</span>';
    }
    ids.forEach(function (k) { $('#o-' + k, el).addEventListener('input', calc); });
    $('#o-clear', el).addEventListener('click', function () { ids.forEach(function (k) { $('#o-' + k, el).value = ''; }); calc(); });
    calc();
    return el;
  }

  function vdrop() {
    var el = card('מפל מתח וחתך כבל', 'נחושת בטמפרטורת עבודה. כושר ההולכה הוא הערכה לשיטת התקנה B2 — בדקו תמיד מול טבלאות ההתקנה ותקנות החשמל.',
      '<div class="calc-grid">' +
      '<div class="field"><label for="d-sys">מערכת</label><select id="d-sys"><option value="1">חד-פאזי 230V</option><option value="3">תלת-פאזי 400V</option><option value="dc24">DC 24V</option><option value="dc12">DC 12V</option></select></div>' +
      field('d-i', 'זרם', 'A', 'value="16"') + field('d-l', 'אורך (כיוון אחד)', 'm', 'value="25"') +
      '<div class="field"><label for="d-s">חתך</label><select id="d-s">' + SECTIONS.map(function (s) { return '<option' + (s === 2.5 ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>' +
      field('d-max', 'מפל מרבי מותר', '%', 'value="5"') +
      '</div><div class="calc-out" id="d-out" aria-live="polite"></div>');
    function calc() {
      var sys = $('#d-sys', el).value, I = num($('#d-i', el)), L = num($('#d-l', el)), S = parseFloat($('#d-s', el).value), max = num($('#d-max', el)) || 5;
      var U = sys === '3' ? 400 : sys === '1' ? 230 : sys === 'dc24' ? 24 : 12;
      var k = sys === '3' ? Math.sqrt(3) : 2;
      var out = $('#d-out', el);
      if (!I || !L) { out.textContent = 'מלאו זרם ואורך'; return; }
      var du = k * L * I * RHO_CU / S, pct = du / U * 100;
      var need = SECTIONS.filter(function (s) { return k * L * I * RHO_CU / s / U * 100 <= max; })[0];
      var amp = (sys === '3' ? AMP_3 : AMP_2);
      var byCurrent = SECTIONS.filter(function (s, i) { return amp[i] >= I; })[0];
      var rec = Math.max(need || 999, byCurrent || 999);
      var ampS = amp[SECTIONS.indexOf(S)];
      var brk = BREAKERS.filter(function (b) { return b >= I && b <= ampS; })[0];
      out.innerHTML =
        '<span class="' + (pct > max ? 'bad' : 'good') + '"><b>מפל מתח</b> ' + ltr(du.toFixed(2) + ' V · ' + pct.toFixed(2) + '%') + '</span>' +
        '<span><b>כושר הולכה משוער ל-' + S + ' ממ״ר</b> ' + ltr(ampS + ' A') + (I > ampS ? ' — <em class="bad">עומס יתר</em>' : '') + '</span>' +
        '<span><b>חתך מומלץ</b> ' + (rec < 999 ? rec + ' ממ״ר' : 'מעל 240 ממ״ר') + '</span>' +
        '<span><b>מפסק מתאים לחתך הנבחר</b> ' + (brk ? ltr(brk + ' A') : 'אין — הגדילו חתך') + '</span>';
    }
    ['d-sys', 'd-i', 'd-l', 'd-s', 'd-max'].forEach(function (id) { $('#' + id, el).addEventListener('input', calc); });
    calc();
    return el;
  }

  function motor() {
    var el = card('זרם מנוע וכיול תרמי', 'זרם נומינלי משוער לפי הספק ציר. הערך המדויק כתוב על שלט המנוע — הוא הקובע לכיול הממסר התרמי.',
      '<div class="calc-grid">' +
      field('m-p', 'הספק ציר', 'kW', 'value="5.5"') +
      '<div class="field"><label for="m-u">מתח</label><select id="m-u"><option value="400">400V תלת-פאזי</option><option value="230">230V תלת-פאזי (משולש)</option><option value="230-1">230V חד-פאזי</option></select></div>' +
      field('m-pf', 'מקדם הספק cosφ', '', 'value="0.85"') + field('m-eff', 'נצילות', '%', 'value="88"') +
      '</div><div class="calc-out" id="m-out" aria-live="polite"></div>');
    function calc() {
      var P = num($('#m-p', el)) * 1000, u = $('#m-u', el).value, pf = num($('#m-pf', el)), eff = num($('#m-eff', el)) / 100;
      var out = $('#m-out', el);
      if (!P || !pf || !eff) { out.textContent = 'מלאו את כל הערכים'; return; }
      var I = u === '230-1' ? P / (230 * pf * eff) : P / (Math.sqrt(3) * parseFloat(u) * pf * eff);
      var dol = BREAKERS.filter(function (b) { return b >= I * 1.25; })[0];
      out.innerHTML =
        '<span><b>זרם נומינלי</b> ' + ltr(I.toFixed(1) + ' A') + '</span>' +
        '<span><b>כיול ממסר תרמי</b> ' + ltr(I.toFixed(1) + ' A') + ' (לפי השלט)</span>' +
        '<span><b>זרם התנעה ישירה משוער</b> ' + ltr((I * 6).toFixed(0) + '–' + (I * 8).toFixed(0) + ' A') + '</span>' +
        '<span><b>מגן מנוע / מפסק (עקומה D או מגן מנוע)</b> ' + (dol ? ltr(dol + ' A') : '—') + '</span>';
    }
    ['m-p', 'm-u', 'm-pf', 'm-eff'].forEach(function (id) { $('#' + id, el).addEventListener('input', calc); });
    calc();
    return el;
  }

  function resistor() {
    function opts(filter, sel) {
      return BANDS.map(function (b, i) { return filter(b) ? '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' + b.name + '</option>' : ''; }).join('');
    }
    var digit = function (b) { return b.d != null; };
    var el = card('קוד צבעים לנגד', 'בחרו את הפסים משמאל לימין (פס הסבולת בקצה).',
      '<div class="calc-grid">' +
      '<div class="field"><label for="r-n">מספר פסים</label><select id="r-n"><option value="4">4 פסים</option><option value="5">5 פסים</option></select></div>' +
      '<div class="field"><label for="r-1">פס 1</label><select id="r-1">' + opts(function (b) { return b.d > 0; }, 1) + '</select></div>' +
      '<div class="field"><label for="r-2">פס 2</label><select id="r-2">' + opts(digit, 0) + '</select></div>' +
      '<div class="field r5"><label for="r-3">פס 3</label><select id="r-3">' + opts(digit, 0) + '</select></div>' +
      '<div class="field"><label for="r-m">מכפיל</label><select id="r-m">' + opts(function () { return true; }, 2) + '</select></div>' +
      '<div class="field"><label for="r-t">סבולת</label><select id="r-t">' + opts(function (b) { return b.t; }, 10) + '</select></div>' +
      '</div><div class="resistor" id="r-draw" aria-hidden="true"></div><div class="calc-out" id="r-out" aria-live="polite"></div>');
    function calc() {
      var five = $('#r-n', el).value === '5';
      el.querySelector('.r5').hidden = !five;
      var b = ['r-1', 'r-2', 'r-3', 'r-m', 'r-t'].map(function (id) { return BANDS[+$('#' + id, el).value]; });
      var digits = five ? b[0].d * 100 + b[1].d * 10 + b[2].d : b[0].d * 10 + b[1].d;
      var val = digits * b[3].m;
      var shown = five ? b : [b[0], b[1], b[3], b[4]];
      $('#r-draw', el).innerHTML = '<span class="lead"></span><span class="body">' + shown.map(function (x, i) {
        return '<i style="background:' + x.hex + (i === shown.length - 1 ? ';margin-inline-start:auto' : '') + '"></i>';
      }).join('') + '</span><span class="lead"></span>';
      $('#r-out', el).innerHTML = '<span><b>ערך</b> ' + fmt(val, 'Ω') + ' ' + ltr(b[4].t || '') + '</span>';
    }
    ['r-n', 'r-1', 'r-2', 'r-3', 'r-m', 'r-t'].forEach(function (id) { $('#' + id, el).addEventListener('input', calc); });
    calc();
    return el;
  }

  function led() {
    var E12 = [1, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
    var el = card('נגד טורי ל-LED', 'נגד להגבלת זרם, מעוגל כלפי מעלה לסדרת E12.',
      '<div class="calc-grid">' + field('l-vs', 'מתח הזנה', 'V', 'value="24"') + field('l-vf', 'מתח קדמי של הנורית', 'V', 'value="2.0"') + field('l-i', 'זרם רצוי', 'mA', 'value="10"') + field('l-n', 'נוריות בטור', '', 'value="1"') + '</div>' +
      '<div class="calc-out" id="l-out" aria-live="polite"></div>');
    function calc() {
      var vs = num($('#l-vs', el)), vf = num($('#l-vf', el)), i = num($('#l-i', el)) / 1000, n = num($('#l-n', el)) || 1;
      var out = $('#l-out', el);
      var vr = vs - vf * n;
      if (!i || vr <= 0) { out.innerHTML = '<span class="bad">המתח לא מספיק לנוריות האלה</span>'; return; }
      var r = vr / i, dec = Math.pow(10, Math.floor(Math.log10(r)));
      var e = E12.map(function (x) { return x * dec; }).concat(10 * dec).filter(function (x) { return x >= r - 1e-9; })[0];
      var p = vr * vr / e;
      var rating = [0.125, 0.25, 0.5, 1, 2, 5].filter(function (w) { return w >= p * 2; })[0];
      out.innerHTML = '<span><b>נגד מחושב</b> ' + fmt(r, 'Ω') + '</span><span><b>ערך סטנדרטי</b> ' + fmt(e, 'Ω') + '</span>' +
        '<span><b>זרם בפועל</b> ' + fmt(vr / e, 'A') + '</span><span><b>הספק על הנגד</b> ' + fmt(p, 'W') + ' → נגד ' + ltr((rating || '>5') + 'W') + '</span>';
    }
    ['l-vs', 'l-vf', 'l-i', 'l-n'].forEach(function (id) { $('#' + id, el).addEventListener('input', calc); });
    calc();
    return el;
  }

  window.FixCalc = {
    mount: function (host) {
      if (host.childElementCount) return;
      [ohm, vdrop, motor, resistor, led].forEach(function (f) { host.appendChild(f()); });
    }
  };
})();
