/* 🎨 Colour calibration: the screen, the printer and the camera agreeing on colour.
   - The screen: Windows' own tools (Display Color Calibration, Color Management, display settings) from the desktop program,
     and a test chart to look at (grey steps, primaries, skin tones).
   - The printer: a correction per printer (brightness, contrast, saturation, warmth, tint), put on every sheet at print time
     (output.js pageCanvas / doPrint call FS.printCorrect), a test sheet to print, and a reset. A dye-sublimation printer often
     prints darker or warmer than the screen shows: the owner prints the test sheet, compares, moves the sliders, prints again.
   - The camera: a correction put on every new photo (FS.afterAdd → the photo's own adjustments, so it can still be changed per
     photo), for a camera that comes out too cold, too dark or too flat; "put on the photos already in"; and a reset.
   Kept in this computer (localStorage). */
(function () {
  'use strict';
  var FS = window.FS; if (!FS) return;
  function lsj(k, d) { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } }
  function lss(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }

  /* ---------- the printer ---------- */
  var P0 = { b: 0, c: 0, s: 0, w: 0, t: 0 };   /* brightness, contrast, saturation, warmth, tint (green − / magenta +), each −50..50 */
  function pkey(name) { return String(name || (FS.printerChoice && FS.printerChoice()) || 'default'); }
  FS.printCal = {
    get: function (name) { var all = lsj('fs-printcal', {}); return Object.assign({}, P0, all[pkey(name)] || {}); },
    set: function (name, v) { var all = lsj('fs-printcal', {}); all[pkey(name)] = Object.assign({}, P0, v); lss('fs-printcal', all); },
    reset: function (name) { var all = lsj('fs-printcal', {}); delete all[pkey(name)]; lss('fs-printcal', all); },
    isZero: function (v) { return !v || Object.keys(P0).every(function (k) { return !Number(v[k]); }); }
  };
  /* a copy of the canvas with the printer's correction; the same canvas when there is none */
  FS.printCorrect = function (src, name, cal) {
    var v = cal || FS.printCal.get(name); if (FS.printCal.isZero(v) || !src || !src.width) return src;
    var c = FS.canvas(src.width, src.height), x = c.getContext('2d');
    if ('filter' in x) x.filter = 'brightness(' + (1 + v.b / 100) + ') contrast(' + (1 + v.c / 100) + ') saturate(' + (1 + v.s / 100) + ')';
    x.drawImage(src, 0, 0); x.filter = 'none';
    function wash(rgb, amt) { if (!amt) return; x.globalCompositeOperation = 'soft-light'; x.fillStyle = 'rgba(' + rgb + ',' + Math.min(0.6, Math.abs(amt) / 100) + ')'; x.fillRect(0, 0, c.width, c.height); x.globalCompositeOperation = 'source-over'; }
    wash(v.w > 0 ? '255,150,40' : '40,130,255', v.w);
    wash(v.t > 0 ? '235,60,200' : '60,200,90', v.t);
    return c;
  };

  /* ---------- the test chart: grey steps, primaries and secondaries, skin tones, a smooth ramp ---------- */
  FS.colorChart = function (w, h) {
    w = w || 1200; h = h || 1800;
    var c = FS.canvas(w, h), x = c.getContext('2d'), m = w * 0.05, cw = w - m * 2;
    x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#222'; x.font = '700 ' + Math.round(w * 0.045) + 'px Heebo, Arial, sans-serif'; x.textAlign = 'center'; x.fillText('דף בדיקת צבע · אופטימוס', w / 2, m + w * 0.04);
    var y = m + w * 0.08, row = (h - y - m) / 6;
    for (var i = 0; i <= 10; i++) { var g = Math.round(i * 25.5); x.fillStyle = 'rgb(' + g + ',' + g + ',' + g + ')'; x.fillRect(m + i * cw / 11, y, cw / 11 + 1, row * 0.8); }
    y += row;
    ['#ff0000', '#00ff00', '#0000ff', '#00ffff', '#ff00ff', '#ffff00'].forEach(function (col, i) { x.fillStyle = col; x.fillRect(m + i * cw / 6, y, cw / 6 + 1, row * 0.8); });
    y += row;
    ['#f6d7c3', '#e8b796', '#d29a76', '#b67b58', '#8d5a3c', '#5e3a26'].forEach(function (col, i) { x.fillStyle = col; x.fillRect(m + i * cw / 6, y, cw / 6 + 1, row * 0.8); });
    y += row;
    var gr = x.createLinearGradient(m, 0, m + cw, 0); ['#000', '#f00', '#ff0', '#0f0', '#0ff', '#00f', '#f0f', '#fff'].forEach(function (col, i, a) { gr.addColorStop(i / (a.length - 1), col); });
    x.fillStyle = gr; x.fillRect(m, y, cw, row * 0.8);
    y += row;
    var g2 = x.createLinearGradient(m, 0, m + cw, 0); g2.addColorStop(0, '#000'); g2.addColorStop(1, '#fff'); x.fillStyle = g2; x.fillRect(m, y, cw, row * 0.8);
    y += row;
    ['#8a1c2b', '#c9a14a', '#2f5d50', '#3b4a8c', '#d9b677', '#edb6be'].forEach(function (col, i) { x.fillStyle = col; x.fillRect(m + i * cw / 6, y, cw / 6 + 1, row * 0.8); });
    return c;
  };
  /* the test sheet out to the printer, with its correction, at the print window's paper size */
  FS.printChart = function (name, paperMm) {
    var pw = (paperMm && paperMm[0]) || 102, ph = (paperMm && paperMm[1]) || 152, k = 300 / 25.4;
    var chart = FS.printCorrect(FS.colorChart(Math.round(pw * k), Math.round(ph * k)), name);
    var root = document.getElementById('print-root'); if (!root) return;
    root.innerHTML = '<div class="pp" style="width:' + pw + 'mm;height:' + ph + 'mm"><img src="' + chart.toDataURL('image/jpeg', 0.95) + '" style="left:0;top:0;width:' + pw + 'mm;height:' + ph + 'mm"></div>';
    var st = document.getElementById('page-size') || document.head.appendChild(Object.assign(document.createElement('style'), { id: 'page-size' }));
    st.textContent = '@page { size: ' + pw + 'mm ' + ph + 'mm; margin: 0; }';
    document.body.classList.add('printing');
    var done = function () { document.body.classList.remove('printing'); root.innerHTML = ''; };
    var dev = name || (FS.printerChoice && FS.printerChoice());
    if (window.FSDesktop && FSDesktop.print && FSDesktop.print.run && dev) {
      setTimeout(function () { FSDesktop.print.run({ deviceName: dev, wMm: pw, hMm: ph }).then(function (r) { done(); FS.toast(r && r.ok ? '🧪 דף הבדיקה נשלח ל' + dev + '. משווים למסך ומזיזים את המחוונים.' : '⚠️ דף הבדיקה לא יצא', 6000); }); }, 80);
    } else setTimeout(function () { window.print(); setTimeout(done, 800); }, 80);
  };

  /* ---------- the camera ---------- */
  var C0 = { exposure: 0, temp: 0, tint: 0, contrast: 0, saturation: 0 };
  FS.cameraCal = {
    get: function () { return Object.assign({ on: false }, C0, lsj('fs-camcal', {})); },
    set: function (v) { lss('fs-camcal', v); },
    reset: function () { try { localStorage.removeItem('fs-camcal'); } catch (e) {} },
    /* the correction added to one photo's own adjustments (once) */
    apply: function (p, v) {
      v = v || FS.cameraCal.get(); if (!p || !p.doc) return false;
      var a = p.doc.photo.adj, prev = p.camCal || {};
      Object.keys(C0).forEach(function (k) { a[k] = Math.max(-100, Math.min(100, (Number(a[k]) || 0) - (Number(prev[k]) || 0) + (Number(v[k]) || 0))); });
      p.camCal = Object.keys(C0).reduce(function (o, k) { o[k] = Number(v[k]) || 0; return o; }, {});
      p.cache = {}; p._pt = null; p._gt = null; p._pv = null; return true;
    }
  };
  FS.afterAdd = FS.afterAdd || [];
  FS.afterAdd.push(function (p) { var v = FS.cameraCal.get(); if (v.on) FS.cameraCal.apply(p, v); });

  /* ---------- the panel (the print window's ⚙️ tab, mate.js) ---------- */
  var PS = [['b', 'בהירות'], ['c', 'ניגודיות'], ['s', 'רוויה'], ['w', 'חום (קר ↔ חם)'], ['t', 'גוון (ירוק ↔ מג׳נטה)']];
  var CS = [['exposure', 'חשיפה'], ['temp', 'חום (קר ↔ חם)'], ['tint', 'גוון (ירוק ↔ מג׳נטה)'], ['contrast', 'ניגודיות'], ['saturation', 'רוויה']];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); }
  function sliders(list, v, attr, min, max) { return list.map(function (s) { return '<label class="cc-sl"><span>' + s[1] + '</span><input type="range" min="' + min + '" max="' + max + '" step="1" ' + attr + '="' + s[0] + '" value="' + (Number(v[s[0]]) || 0) + '"><output>' + (Number(v[s[0]]) || 0) + '</output></label>'; }).join(''); }
  FS.colorCalPanel = function (box, getPrinter, onChange) {
    var D = window.FSDesktop && FSDesktop.print, prn = getPrinter() || '', pv = FS.printCal.get(prn), cv = FS.cameraCal.get();
    box.innerHTML =
      '<h5>🖥️ המסך</h5><div class="mp-tools">' +
        (D ? '<button type="button" class="mt-btn" data-ptool="calibrate">🖥️ כיול צבעי המסך (Windows)</button><button type="button" class="mt-btn" data-ptool="colormgmt">🎨 ניהול צבעים</button><button type="button" class="mt-btn" data-ptool="display">⚙️ הגדרות תצוגה</button>' : '') +
        '<button type="button" class="mt-btn" data-cc="chart">👁️ דף בדיקה על המסך</button></div>' +
      '<p class="mt-hint">מתחילים כאן: כיול המסך של Windows (בהירות, ניגודיות, איזון צבע). אחר כך מתאימים את המדפסת למסך.</p>' +
      '<h5>🖨️ התאמה למדפסת <small>' + esc(prn || 'חלון ההדפסה של המחשב') + '</small></h5>' +
      '<div class="cc-row"><div class="cc-sls">' + sliders(PS, pv, 'data-pc', -50, 50) + '</div><canvas class="cc-sample" width="180" height="270" aria-label="דוגמה עם התיקון"></canvas></div>' +
      '<div class="mp-tools"><button type="button" class="mt-btn" data-cc="ptest">🧪 הדפסת דף בדיקה</button><button type="button" class="mt-btn" data-cc="preset">🌗 המדפסת מדפיסה כהה</button><button type="button" class="mt-btn" data-cc="preset2">🔥 המדפסת מדפיסה חם מדי</button><button type="button" class="mt-btn" data-cc="preset3">💧 המדפסת מדפיסה דהוי</button><button type="button" class="mt-btn" data-cc="preset">↺ איפוס</button></div>' +
      '<p class="mt-hint">מדפיסים דף בדיקה ומשווים למסך. אם ההדפסה כהה מוסיפים בהירות, אם היא צהבהבה מורידים חום. התיקון נשמר לכל מדפסת בנפרד וחל על כל הדפסה.</p>' +
      '<h5>📷 המצלמה</h5><label class="mt-chk-l"><input type="checkbox" data-cc="camon"' + (cv.on ? ' checked' : '') + '> להחיל על כל תמונה חדשה</label>' +
      '<div class="cc-sls">' + sliders(CS, cv, 'data-cm', -60, 60) + '</div>' +
      '<div class="mp-tools"><button type="button" class="mt-btn" data-cc="camall">📷 להחיל על התמונות שכבר בתוכנה</button><button type="button" class="mt-btn" data-cc="camreset">↺ איפוס</button></div>' +
      '<p class="mt-hint">למצלמה שיוצאת כחולה, כהה או שטוחה. התיקון נכנס לכיוונון של כל תמונה, ואפשר לשנות אותו בכל תמונה בנפרד.</p>';
    var chart = FS.colorChart(180, 270), sample = box.querySelector('.cc-sample');
    function drawSample() { var x = sample.getContext('2d'); x.clearRect(0, 0, 180, 270); x.drawImage(FS.printCorrect(chart, prn, pv), 0, 0); }
    drawSample();
    function readP() { box.querySelectorAll('[data-pc]').forEach(function (r) { pv[r.dataset.pc] = Number(r.value); r.nextElementSibling.textContent = r.value; }); FS.printCal.set(prn, pv); drawSample(); if (onChange) onChange(); }
    function readC() { box.querySelectorAll('[data-cm]').forEach(function (r) { cv[r.dataset.cm] = Number(r.value); r.nextElementSibling.textContent = r.value; }); FS.cameraCal.set(cv); }
    box.querySelectorAll('[data-pc]').forEach(function (r) { r.addEventListener('input', readP); });
    box.querySelectorAll('[data-cm]').forEach(function (r) { r.addEventListener('input', readC); });
    function setP(v) { pv = Object.assign({}, P0, v); box.querySelectorAll('[data-pc]').forEach(function (r) { r.value = pv[r.dataset.pc]; }); readP(); }
    box.addEventListener('click', function (e) {
      var t = e.target.closest('[data-cc]'); if (!t) return; var k = t.dataset.cc;
      if (k === 'chart') { var big = FS.colorChart(800, 1200); FS.dialog('👁️ דף בדיקה על המסך', '<p class="mt-hint">בפסי האפור צריך לראות 11 מדרגות נפרדות, גם הכהות וגם הבהירות. אם לא: כיול המסך של Windows.</p><img src="' + big.toDataURL('image/png') + '" style="display:block;max-width:100%;max-height:70vh;margin:auto;border-radius:6px" alt="דף בדיקת צבע">', true); }
      else if (k === 'ptest') { var paper = window.__mpPaper || null; FS.printChart(prn, paper); }
      else if (k === 'preset') setP(t.textContent.indexOf('איפוס') >= 0 ? P0 : { b: 12, c: -4, s: 4, w: 0, t: 0 });
      else if (k === 'preset2') setP({ b: pv.b, c: pv.c, s: pv.s, w: -14, t: pv.t });
      else if (k === 'preset3') setP({ b: pv.b, c: 10, s: 14, w: pv.w, t: pv.t });
      else if (k === 'camreset') { FS.cameraCal.reset(); cv = FS.cameraCal.get(); box.querySelectorAll('[data-cm]').forEach(function (r) { r.value = 0; r.nextElementSibling.textContent = '0'; }); var cb = box.querySelector('[data-cc=camon]'); if (cb) cb.checked = false; FS.toast('↺ תיקון המצלמה אופס'); }
      else if (k === 'camall') { var n = 0; FS.state.photos.forEach(function (p) { if (FS.cameraCal.apply(p, cv)) n++; }); FS.emit('doc'); if (FS.render) FS.render(true); if (onChange) onChange(); FS.toast('📷 התיקון הוחל על ' + n + ' תמונות'); }
    });
    var on = box.querySelector('[data-cc=camon]'); if (on) on.addEventListener('change', function () { cv.on = on.checked; FS.cameraCal.set(cv); FS.toast(on.checked ? '📷 כל תמונה חדשה מקבלת את תיקון המצלמה' : 'תיקון המצלמה כבוי לתמונות חדשות'); });
  };
})();
