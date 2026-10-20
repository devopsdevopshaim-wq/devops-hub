/* The printer, the print log and the event summary.
   A web page can't see which printers are connected or read their ink: the computer's print window chooses the printer.
   So the owner describes the printer once (model, type, how many prints a roll / cartridge gives), and every print sent
   from here is counted: sheets out, photos by size, estimated ink and paper left. A fixed line at the bottom left
   always shows the sheets sent, the sheets still waiting to print and the estimates. */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$, S = FS.state;
  var KP = 'frame-studio-printer', KL = 'frame-studio-printlog';
  function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } }

  var TYPES = { dye: 'סובלימציה (דיו ונייר בגליל)', inkjet: 'הזרקת דיו', laser: 'לייזר' };
  /* common event printers and what one roll / ink set gives, in prints of the usual size */
  var MODELS = [
    ['DNP DS620', 'dye', 400], ['DNP DS-RX1HS', 'dye', 700], ['DNP QW410', 'dye', 300], ['Mitsubishi CP-D70DW', 'dye', 400], ['Mitsubishi CP-D80DW', 'dye', 400],
    ['Citizen CX-02', 'dye', 400], ['HiTi P525L', 'dye', 500], ['Canon SELPHY CP1500', 'dye', 54], ['Epson EcoTank L8050', 'inkjet', 2100],
    ['Epson SureColor P700', 'inkjet', 120], ['Canon PIXMA G650', 'inkjet', 3700], ['HP Smart Tank', 'inkjet', 3000], ['מדפסת לייזר צבעונית', 'laser', 1500]
  ];
  var pr = load(KP, null);
  var log = load(KL, null);
  if (!log || !Array.isArray(log.jobs)) log = { start: Date.now(), name: '', jobs: [] };

  function inkLeft() { if (!pr || !(pr.inkCap > 0)) return null; return Math.max(0, Math.floor(100 - (pr.inkUsed || 0) / pr.inkCap * 100)); }
  function sheetsTxt(n) { return n === 1 ? 'דף אחד' : n + ' דפים'; }
  function paperLeft() { if (!pr || !(pr.paperCap > 0)) return null; return Math.max(0, pr.paperCap - (pr.paperUsed || 0)); }
  function printerName() { return pr && pr.name ? pr.name : 'לא הוגדרה מדפסת'; }
  function sizeName(mm) {
    var z = FS.mySizes().filter(function (s) { return Math.abs(s.w - mm[0]) < 0.6 && Math.abs(s.h - mm[1]) < 0.6; })[0];
    return z ? FS.sizeLabel(z) : (mm[0] / 10).toFixed(1).replace(/\.0$/, '') + '×' + (mm[1] / 10).toFixed(1).replace(/\.0$/, '') + ' ס״מ';
  }
  function totals() {
    var t = { jobs: log.jobs.length, sheets: 0, items: 0, photos: {}, sizes: {}, papers: {} };
    log.jobs.forEach(function (j) {
      t.sheets += j.sheets; t.items += j.items; t.papers[j.paper] = (t.papers[j.paper] || 0) + j.sheets;
      Object.keys(j.sizes).forEach(function (k) { t.sizes[k] = (t.sizes[k] || 0) + j.sizes[k]; });
      (j.ids || []).forEach(function (id) { t.photos[id] = 1; });
    });
    t.unique = Object.keys(t.photos).length; return t;
  }

  /* every print sent from the studio */
  FS.on('print-job', function (plan) {
    var sizes = {}, ids = {};
    plan.pages.forEach(function (pg) { pg.forEach(function (it) { var k = sizeName(FS.mmOf(it.p.doc)); sizes[k] = (sizes[k] || 0) + 1; ids[it.p.id] = 1; it.p.printed = (it.p.printed || 0) + 1; }); });
    var sheets = plan.pages.length, area = plan.paper[2] * plan.paper[3] / (102 * 152);
    log.jobs.push({ t: Date.now(), sheets: sheets, items: plan.total, sizes: sizes, ids: Object.keys(ids), paper: plan.paper[1], printer: printerName() });
    save(KL, log);
    if (pr) { pr.inkUsed = (pr.inkUsed || 0) + sheets * (pr.type === 'dye' ? Math.max(1, Math.round(area)) : area); pr.paperUsed = (pr.paperUsed || 0) + sheets; save(KP, pr); }
    var ink = inkLeft(), pap = paperLeft();
    setTimeout(function () {
      FS.toast('🖨️ נשלחו ' + sheetsTxt(sheets) + ' (' + (plan.total === 1 ? 'תמונה אחת' : plan.total + ' תמונות') + ') ל־' + printerName() + (ink != null ? ' · דיו משוער ' + ink + '%' : '') + (pap != null ? ' · נייר: עוד ' + pap : ''), 6000);
      if (ink != null && ink <= 10) setTimeout(function () { FS.toast('⚠️ הדיו כמעט נגמר (' + ink + '%). כדאי להכין גליל / מחסנית חדשים.', 6000); }, 6200);
    }, 900);
    refresh();
  });

  /* the sheets still to print: the photos never printed, laid out with the print panel's settings */
  function pending() {
    var list = S.photos.filter(function (p) { return !p.printed; }); if (!list.length) return { sheets: 0, items: 0 };
    var job = { list: list, paper: $('#paper').value, layout: $('#layout').value, margin: Number($('#margin').value), copies: FS.clamp(Number($('#copies').value) || 1, 1, 50) };
    try { var pl = FS.planPrint(job); return { sheets: pl.pages.length, items: pl.total }; } catch (e) { return { sheets: 0, items: 0 }; }
  }

  /* the line at the bottom left */
  var bar = document.createElement('button'); bar.className = 'pl-bar'; bar.id = 'pl-bar'; bar.type = 'button'; bar.title = 'סיכום ההדפסות באירוע';
  document.body.appendChild(bar);
  bar.addEventListener('click', function () { FS.printSummary(); });
  var rt = 0;
  function refresh() { clearTimeout(rt); rt = setTimeout(draw, 120); }
  function draw() {
    var t = totals(), q = pending(), ink = inkLeft(), pap = paperLeft();
    bar.classList.toggle('warn', ink != null && ink <= 15);
    bar.innerHTML = '<b>🖨️ ' + FS.esc(printerName()) + '</b>' +
      '<span>נשלחו <b>' + t.sheets + '</b> דפים</span>' +
      '<span>ממתינים <b>' + q.sheets + '</b> דפים' + (q.items ? ' (' + q.items + ')' : '') + '</span>' +
      (ink != null ? '<span class="pl-ink" style="--v:' + ink + '%">דיו <b>~' + ink + '%</b></span>' : '') +
      (pap != null ? '<span>נייר <b>' + pap + '</b></span>' : '');
  }
  ['doc', 'history', 'photos-added', 'sizes'].forEach(function (e) { FS.on(e, refresh); });
  ['#paper', '#layout', '#margin', '#copies'].forEach(function (s) { var el = $(s); if (el) el.addEventListener('change', refresh); });
  setInterval(refresh, 4000);

  /* the printer profile */
  FS.printerSetup = function (after) {
    var p = pr || { name: '', type: 'dye', inkCap: 400, paperCap: 400, inkUsed: 0, paperUsed: 0 };
    var body = FS.dialog('🖨️ המדפסת שלי',
      '<p class="hint">דפדפן לא יכול לראות איזו מדפסת מחוברת או לקרוא את מפלס הדיו. מגדירים כאן את המדפסת פעם אחת, וכל הדפסה מהסטודיו נספרת: כמה דפים יצאו, והערכה כמה דיו ונייר נשארו. את המדפסת עצמה בוחרים בחלון ההדפסה של המחשב.</p>' +
      '<div class="field"><label>דגם המדפסת</label><input id="pp-name" list="pp-models" maxlength="60" placeholder="למשל DNP DS620" value="' + FS.esc(p.name) + '"><datalist id="pp-models">' + MODELS.map(function (m) { return '<option value="' + FS.esc(m[0]) + '">'; }).join('') + '</datalist></div>' +
      '<div class="field"><label>סוג</label><select id="pp-type">' + Object.keys(TYPES).map(function (k) { return '<option value="' + k + '">' + TYPES[k] + '</option>'; }).join('') + '</select></div>' +
      '<div class="row2"><div class="field"><label>הדפסות לגליל / מחסנית דיו</label><input type="number" id="pp-ink" min="1" max="100000" value="' + (p.inkCap || '') + '"></div><div class="field"><label>דפים בגליל / במגש</label><input type="number" id="pp-paper" min="0" max="100000" value="' + (p.paperCap || '') + '"></div></div>' +
      '<div class="stats"><div><b>' + (inkLeft() != null ? inkLeft() + '%' : '—') + '</b><small>דיו משוער</small></div><div><b>' + (paperLeft() != null ? paperLeft() : '—') + '</b><small>דפים נשארו</small></div><div><b>' + Math.round(p.paperUsed || 0) + '</b><small>מאז ההחלפה</small></div><div><b>' + totals().sheets + '</b><small>באירוע</small></div></div>' +
      '<div class="row2"><button class="btn" id="pp-new-ink">🔄 החלפתי דיו / גליל</button><button class="btn" id="pp-new-paper">📄 מילאתי נייר</button></div>' +
      '<button class="btn wide" id="pp-test">🧪 דף בדיקה למדפסת</button>' +
      '<button class="btn primary wide" id="pp-save">💾 שמירה</button>');
    $('#pp-type', body).value = p.type || 'dye';
    $('#pp-name', body).addEventListener('change', function () { var m = MODELS.filter(function (x) { return x[0] === this.value; }, this)[0]; if (m) { $('#pp-type', body).value = m[1]; $('#pp-ink', body).value = m[2]; if (m[1] === 'dye') $('#pp-paper', body).value = m[2]; } });
    function read() { p.name = $('#pp-name', body).value.trim().slice(0, 60); p.type = $('#pp-type', body).value; p.inkCap = Math.max(1, Number($('#pp-ink', body).value) || 0); p.paperCap = Math.max(0, Number($('#pp-paper', body).value) || 0); }
    $('#pp-new-ink', body).addEventListener('click', function () { read(); p.inkUsed = 0; if (p.type === 'dye') p.paperUsed = 0; pr = p; save(KP, pr); refresh(); FS.toast('🔄 הדיו אופס ל־100%'); FS.printerSetup(after); });
    $('#pp-new-paper', body).addEventListener('click', function () { read(); p.paperUsed = 0; pr = p; save(KP, pr); refresh(); FS.toast('📄 הנייר אופס'); FS.printerSetup(after); });
    $('#pp-test', body).addEventListener('click', function () { read(); pr = p; save(KP, pr); FS.closeDialog(); testPage(); });
    $('#pp-save', body).addEventListener('click', function () { read(); if (!p.name) return FS.toast('כותבים את דגם המדפסת'); pr = p; save(KP, pr); FS.closeDialog(); refresh(); FS.toast('✔ ' + p.name + ' נשמרה'); if (after) after(); });
  };
  /* colour bars, greys and a ruler, to see that the printer is connected and prints true */
  function testPage() {
    var root = $('#print-root'), bars = ['#00ffff', '#ff00ff', '#ffff00', '#000000', '#ff0000', '#00ff00', '#0000ff'].map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('');
    var greys = []; for (var i = 0; i <= 10; i++) greys.push('<i style="background:hsl(0,0%,' + (i * 10) + '%)"></i>');
    root.innerHTML = '<div class="pp pl-test" style="width:102mm;height:152mm"><h1>דף בדיקה</h1><p>' + FS.esc(printerName()) + ' · ' + new Date().toLocaleString('he-IL') + '</p><div class="pl-bars">' + bars + '</div><div class="pl-bars">' + greys.join('') + '</div><div class="pl-ruler"></div><p>הסרגל באורך 80 מ״מ בדיוק. אם הוא קצר או ארוך, בחלון ההדפסה בוחרים "גודל בפועל" (100%).</p></div>';
    var st = $('#page-size') || document.head.appendChild(Object.assign(document.createElement('style'), { id: 'page-size' }));
    st.textContent = '@page { size: 102mm 152mm; margin: 0; }';
    document.body.classList.add('printing'); setTimeout(function () { window.print(); }, 60);
  }

  /* the event summary: photos printed, by size, and sheets out */
  FS.printSummary = function () {
    var t = totals(), q = pending();
    var sizes = Object.keys(t.sizes).sort(function (a, b) { return t.sizes[b] - t.sizes[a]; });
    var papers = Object.keys(t.papers);
    var since = new Date(log.start).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
    var body = FS.dialog('📊 סיכום האירוע',
      '<div class="field"><label>שם האירוע</label><input id="ps-name" maxlength="60" placeholder="למשל: החתונה של נועה ודניאל" value="' + FS.esc(log.name || '') + '"></div>' +
      '<p class="hint">מאז ' + since + ' · ' + FS.esc(printerName()) + '</p>' +
      '<div class="stats"><div><b>' + t.items + '</b><small>תמונות הודפסו</small></div><div><b>' + t.unique + '</b><small>תמונות שונות</small></div><div><b>' + t.sheets + '</b><small>דפים יצאו</small></div><div><b>' + q.sheets + '</b><small>דפים ממתינים</small></div></div>' +
      '<h3>לפי גודל</h3>' + (sizes.length ? '<table class="ps-t"><tr><th>גודל</th><th>תמונות</th></tr>' + sizes.map(function (k) { return '<tr><td>' + FS.esc(k) + '</td><td>' + t.sizes[k] + '</td></tr>'; }).join('') + '</table>' : '<p class="hint">עוד לא הודפס כלום באירוע הזה.</p>') +
      (papers.length ? '<h3>לפי נייר</h3><table class="ps-t"><tr><th>נייר</th><th>דפים</th></tr>' + papers.map(function (k) { return '<tr><td>' + FS.esc(k) + '</td><td>' + t.papers[k] + '</td></tr>'; }).join('') + '</table>' : '') +
      (log.jobs.length ? '<h3>ההדפסות (' + log.jobs.length + ')</h3><div class="ps-jobs">' + log.jobs.slice().reverse().slice(0, 60).map(function (j) { return '<div><span>' + new Date(j.t).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) + '</span><b>' + j.sheets + ' דפים</b><span>' + j.items + ' תמונות</span><small>' + FS.esc(Object.keys(j.sizes).map(function (k) { return k + ' ×' + j.sizes[k]; }).join(' · ')) + '</small></div>'; }).join('') + '</div>' : '') +
      '<div class="row2"><button class="btn" id="ps-printer">🖨️ המדפסת שלי</button><button class="btn" id="ps-csv">⬇ קובץ לאקסל</button></div>' +
      '<div class="row2"><button class="btn" id="ps-copy">📋 העתקת הסיכום</button><button class="btn danger" id="ps-reset">🆕 סיום ואירוע חדש</button></div>');
    $('#ps-name', body).addEventListener('change', function () { log.name = this.value.trim().slice(0, 60); save(KL, log); });
    function text() {
      return ['סיכום אירוע' + (log.name ? ': ' + log.name : ''), 'מאז ' + since, 'מדפסת: ' + printerName(), 'תמונות הודפסו: ' + t.items + ' (' + t.unique + ' שונות)', 'דפים יצאו: ' + t.sheets]
        .concat(sizes.map(function (k) { return k + ': ' + t.sizes[k]; })).join('\n');
    }
    $('#ps-printer', body).addEventListener('click', function () { FS.printerSetup(FS.printSummary); });
    $('#ps-copy', body).addEventListener('click', function () { (navigator.clipboard ? navigator.clipboard.writeText(text()) : Promise.reject()).then(function () { FS.toast('📋 הועתק'); }, function () { FS.toast('ההעתקה לא הצליחה'); }); });
    $('#ps-csv', body).addEventListener('click', function () {
      var rows = [['שעה', 'דפים', 'תמונות', 'נייר', 'מדפסת', 'גדלים']].concat(log.jobs.map(function (j) { return [new Date(j.t).toLocaleString('he-IL'), j.sheets, j.items, j.paper, j.printer, Object.keys(j.sizes).map(function (k) { return k + ' ×' + j.sizes[k]; }).join(' | ')]; }));
      rows.push([]); rows.push(['סה״כ', t.sheets, t.items]); sizes.forEach(function (k) { rows.push([k, '', t.sizes[k]]); });
      var csv = '﻿' + rows.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'סיכום-אירוע-' + new Date(log.start).toISOString().slice(0, 10) + '.csv'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    });
    $('#ps-reset', body).addEventListener('click', function () {
      if (!confirm('לסגור את האירוע ולהתחיל ספירה חדשה? (כדאי להוריד קודם את הקובץ לאקסל)')) return;
      var past = load(KL + '-past', []); past.unshift({ name: log.name, start: log.start, end: Date.now(), totals: { sheets: t.sheets, items: t.items, sizes: t.sizes } }); save(KL + '-past', past.slice(0, 50));
      log = { start: Date.now(), name: '', jobs: [] }; save(KL, log);
      S.photos.forEach(function (p) { delete p.printed; });
      FS.closeDialog(); refresh(); FS.toast('🆕 התחיל אירוע חדש');
    });
  };

  /* the print window shows the printer and its state, and asks for it the first time */
  var preview = FS.printPreview;
  FS.printPreview = function () {
    if (!pr) { FS.printerSetup(function () { FS.printPreview(); }); return; }
    preview.apply(this, arguments);
    var side = $('.pv-side'); if (!side) return;
    var ink = inkLeft(), pap = paperLeft(), q = pending(), box = document.createElement('div'); box.className = 'pv-printer';
    box.innerHTML = '<div><b>🖨️ ' + FS.esc(printerName()) + '</b><small>' + (TYPES[pr.type] || '') + '</small></div>' +
      '<div class="pv-pst">' + (ink != null ? '<span class="pl-ink" style="--v:' + ink + '%">דיו ~' + ink + '%</span>' : '') + (pap != null ? '<span>נייר: ' + pap + ' דפים</span>' : '') + '<span>ממתינים: ' + q.sheets + ' דפים</span></div>' +
      '<p class="hint">בחלון ההדפסה שנפתח בוחרים את המדפסת הזאת ו"גודל בפועל".</p><button class="btn small" id="pv-printer-set">⚙️ שינוי מדפסת</button>';
    side.insertBefore(box, side.firstChild);
    $('#pv-printer-set', box).addEventListener('click', function () { FS.printerSetup(function () { FS.printPreview(); }); });
  };

  draw();
})();
