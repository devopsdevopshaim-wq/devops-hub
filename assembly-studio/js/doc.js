/* מכלול — בניית תיק ההרכבה (HTML מוכן להדפסה ל-PDF) וקבצי CSV. */
(function () {
  'use strict';
  var P = window.AsmPrompts;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function mm(size) { return size ? size.map(function (n) { return Math.round(n); }).join(' × ') : '—'; }

  var CSS = [
    '@page{size:A4;margin:16mm 14mm 18mm}',
    '*{box-sizing:border-box}',
    'body{font-family:Heebo,Assistant,Arial,sans-serif;color:#141a24;margin:0;font-size:10.5pt;line-height:1.55;background:#fff}',
    '.page{max-width:190mm;margin:0 auto;padding:10mm 0}',
    'h1{font-size:26pt;margin:0 0 4mm;line-height:1.15}',
    'h2{font-size:15pt;margin:0 0 4mm;padding-bottom:2mm;border-bottom:2.5px solid #f2711c;break-after:avoid}',
    'h3{font-size:12pt;margin:5mm 0 2mm;break-after:avoid}',
    'section{break-before:page}',
    'section.cont{break-before:auto;margin-top:8mm}',
    'table{width:100%;border-collapse:collapse;margin:2mm 0 4mm;font-size:9.5pt}',
    'th,td{border:1px solid #9aa3b0;padding:1.4mm 2mm;text-align:right;vertical-align:top}',
    'th{background:#e9edf2;font-weight:700}',
    'tr{break-inside:avoid}',
    '.num{font-family:"IBM Plex Mono",monospace;text-align:center;white-space:nowrap}',
    '.cover{min-height:250mm;display:flex;flex-direction:column;gap:6mm}',
    '.cover .kick{color:#b3470b;font-weight:700;letter-spacing:.08em}',
    '.cover img{width:100%;max-height:115mm;object-fit:contain;border:1px solid #d5dae1;background:#10151f}',
    '.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border:1.5px solid #141a24}',
    '.meta div{padding:2mm 3mm;border:.5px solid #9aa3b0}',
    '.meta small{display:block;color:#5a6474;font-size:8pt}',
    '.meta b{font-size:10.5pt}',
    '.toc li{margin:1mm 0}',
    '.sheet{width:100%;border:1px solid #c9ced6;margin:2mm 0 5mm;break-inside:avoid}',
    '.step{break-inside:avoid-page;border:1.5px solid #141a24;margin:0 0 6mm;padding:4mm}',
    '.step h3{margin-top:0;display:flex;gap:3mm;align-items:baseline}',
    '.step h3 .n{background:#141a24;color:#fff;border-radius:2mm;padding:0 2.5mm;font-family:"IBM Plex Mono",monospace}',
    '.kv{display:grid;grid-template-columns:28mm 1fr;gap:1mm 3mm;margin:2mm 0}',
    '.kv dt{color:#5a6474}.kv dd{margin:0;font-weight:500}',
    '.caution{border-inline-start:4px solid #f2711c;background:#fff4ec;padding:2mm 3mm;margin:2mm 0}',
    '.sign{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm;margin-top:3mm;font-size:9pt;color:#39424f}',
    '.sign span{border-top:1px solid #141a24;padding-top:1mm}',
    '.box{display:inline-block;width:3.6mm;height:3.6mm;border:1.2px solid #141a24;vertical-align:-0.6mm;margin-inline-end:1.5mm}',
    '.pill{display:inline-block;padding:0 2mm;border-radius:10mm;font-size:8.5pt;font-weight:700}',
    '.c-wear{background:#fde3cf}.c-critical{background:#f9d0d0}.c-consumable{background:#dcebd8}.c-fastener{background:#dde5f2}',
    '.muted{color:#5a6474}',
    'ul,ol{padding-inline-start:6mm;margin:1mm 0}',
    'footer.run{position:fixed;bottom:-12mm;left:0;right:0;font-size:8pt;color:#5a6474;display:flex;justify-content:space-between}',
    '@media screen{body{background:#dfe3e9}.page{background:#fff;padding:14mm;margin:8mm auto;box-shadow:0 2px 12px rgba(0,0,0,.15)}footer.run{display:none}section{margin-top:12mm;padding-top:8mm;border-top:1px dashed #c9ced6}}'
  ].join('\n');

  /* opts: { project, bom:[{name,qty,type,size,material,notes,key}], plan, sheets:[{title,src}], snapshot, videos:[names], rev, by, forWord } */
  function build(o) {
    var p = o.project, plan = o.plan, bom = o.bom || [];
    var date = new Date().toLocaleDateString('he-IL');
    var code = 'ASM-' + String(p.id || '').slice(-5).toUpperCase();
    var num = {}; bom.forEach(function (b, i) { num[b.key] = i + 1; });
    var sheets = o.forWord ? [] : (o.sheets || []);
    var totalMin = plan ? plan.steps.reduce(function (s, x) { return s + (Number(x.minutes) || 0); }, 0) : 0;
    var h = [];
    h.push('<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>' + esc('תיק הרכבה — ' + (p.name || '')) + '</title>');
    if (!o.forWord) h.push('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800&family=IBM+Plex+Mono:wght@500&display=swap">');
    h.push('<style>' + CSS + '</style></head><body><div class="page">');
    h.push('<footer class="run"><span>' + esc(code) + ' · מהדורה ' + esc(o.rev || 'A') + '</span><span>' + esc(p.name || '') + '</span></footer>');

    // שער
    h.push('<div class="cover"><div class="kick">תיק הרכבה</div><h1>' + esc(p.name || 'מכלול') + '</h1>');
    h.push('<div class="muted">' + esc(P.SYSTEMS[p.system] || '') + '</div>');
    if (o.snapshot && !o.forWord) h.push('<img src="' + o.snapshot + '" alt="תצוגת המכלול">');
    h.push('<div class="meta">' + [
      ['מספר מסמך', code], ['מהדורה', o.rev || 'A'], ['תאריך', date],
      ['פריטים ברשימה', bom.length], ['יחידות בסך הכול', bom.reduce(function (s, b) { return s + (Number(b.qty) || 0); }, 0)], ['שלבי הרכבה', plan ? plan.steps.length : '—'],
      ['מידות כלליות (מ״מ)', mm(p.bounds)], ['זמן הרכבה משוער', totalMin ? Math.round(totalMin / 6) / 10 + ' שעות' : '—'], ['הוכן על ידי', o.by || '']
    ].map(function (x) { return '<div><small>' + esc(x[0]) + '</small><b>' + esc(x[1]) + '</b></div>'; }).join('') + '</div></div>');

    // תוכן עניינים
    var toc = ['תיאור המערכת', 'רשימת חלקים', 'שרטוטים כלליים', 'כלים, ציוד ובטיחות', 'שלבי ההרכבה', 'חלקי חילוף', 'תחזוקה מונעת', 'אישור ומסירה'];
    h.push('<section><h2>תוכן העניינים</h2><ol class="toc">' + toc.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ol>');

    // 1. תיאור
    h.push('<h3>1. תיאור המערכת</h3><p>' + esc(p.description || 'לא נמסר תיאור.').replace(/\n/g, '<br>') + '</p>');
    if (plan && plan.summary) h.push('<p>' + esc(plan.summary) + '</p>');
    h.push('<dl class="kv"><dt>סוג המערכת</dt><dd>' + esc(P.SYSTEMS[p.system] || '—') + '</dd>' +
      (p.environment ? '<dt>סביבת עבודה</dt><dd>' + esc(p.environment) + '</dd>' : '') +
      '<dt>צוות</dt><dd>' + esc((plan && plan.crew) || p.crew || 2) + ' אנשים</dd>' +
      '<dt>קבצי מקור</dt><dd>' + esc((p.files || []).map(function (f) { return f.name; }).join(', ') || '—') + '</dd>' +
      ((o.videos || []).length ? '<dt>סרטוני הרכבה</dt><dd>' + esc(o.videos.join(', ')) + '</dd>' : '') + '</dl></section>');

    // 2. BOM
    h.push('<section><h2>2. רשימת חלקים (BOM)</h2><table><thead><tr><th>#</th><th>תיאור</th><th>סוג</th><th>כמות</th><th>מידות (מ״מ)</th><th>חומר</th><th>הערות</th></tr></thead><tbody>');
    bom.forEach(function (b, i) {
      h.push('<tr><td class="num">' + (i + 1) + '</td><td>' + esc(b.name) + '</td><td>' + esc(P.TYPE_LABELS[b.type] || '') + '</td><td class="num">' + esc(b.qty) + '</td><td class="num">' + mm(b.size) + '</td><td>' + esc(b.material || '') + '</td><td>' + esc(b.notes || '') + '</td></tr>');
    });
    h.push('</tbody></table></section>');

    // 3. שרטוטים כלליים
    h.push('<section><h2>3. שרטוטים כלליים</h2>');
    var general = sheets.slice(0, 2);
    if (general.length) general.forEach(function (s) { h.push('<img class="sheet" src="' + s.src + '" alt="' + esc(s.title) + '">'); });
    else h.push('<p class="muted">' + (o.forWord ? 'השרטוטים מצורפים כקבצי PNG נפרדים.' : 'לא נוצרו שרטוטים. יוצרים אותם בלשונית ״שרטוטים״.') + '</p>');
    h.push('</section>');

    if (!plan) {
      h.push('<section><h2>4. שלבי ההרכבה</h2><p class="muted">עוד לא נוצרה תכנית הרכבה.</p></section></div></body></html>');
      return h.join('');
    }

    // 4. כלים ובטיחות
    h.push('<section><h2>4. כלים, ציוד ובטיחות</h2><h3>כלים וציוד</h3><ul>' + plan.tools.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>');
    h.push('<h3>בטיחות</h3><ul>' + plan.safety.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></section>');

    // 5. שלבים
    h.push('<section><h2>5. שלבי ההרכבה</h2>');
    plan.steps.forEach(function (st, i) {
      h.push('<div class="step"><h3><span class="n">' + (i + 1) + '</span>' + esc(st.title) + '</h3>');
      var parts = (st.part_ids || []).map(function (id) { return bom[id - 1]; }).filter(Boolean);
      if (parts.length) {
        h.push('<table><thead><tr><th>#</th><th>חלק</th><th>כמות</th></tr></thead><tbody>' + parts.map(function (b) {
          return '<tr><td class="num">' + num[b.key] + '</td><td>' + esc(b.name) + '</td><td class="num">' + esc(b.qty) + '</td></tr>';
        }).join('') + '</tbody></table>');
      }
      h.push('<ol>' + st.instructions.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>');
      h.push('<dl class="kv">' + (st.fasteners ? '<dt>מחברים</dt><dd>' + esc(st.fasteners) + '</dd>' : '') +
        '<dt>מומנט הידוק</dt><dd>' + esc(st.torque || '—') + '</dd>' +
        (st.minutes ? '<dt>זמן משוער</dt><dd>' + esc(st.minutes) + ' דקות</dd>' : '') + '</dl>');
      if (st.caution) h.push('<div class="caution"><b>זהירות: </b>' + esc(st.caution) + '</div>');
      var sh = sheets[i + 2];
      if (sh) h.push('<img class="sheet" src="' + sh.src + '" alt="' + esc(sh.title) + '">');
      h.push('<p><span class="box"></span><b>בדיקה:</b> ' + esc(st.check || 'השלב בוצע לפי ההוראות.') + '</p>');
      h.push('<div class="sign"><span>בוצע על ידי</span><span>תאריך</span><span>חתימה</span></div></div>');
    });
    h.push('</section>');

    // 6. חלקי חילוף
    h.push('<section><h2>6. חלקי חילוף מומלצים</h2>');
    var cats = {}; plan.spares.forEach(function (s) { cats[s.category] = (cats[s.category] || 0) + 1; });
    h.push('<p class="muted">' + Object.keys(cats).map(function (c) { return (P.SPARE_LABELS[c] || c) + ': ' + cats[c]; }).join(' · ') + '</p>');
    h.push('<table><thead><tr><th>#</th><th>פריט</th><th>קטגוריה</th><th>במכלול</th><th>למלאי</th><th>תדירות החלפה</th><th>סיבה</th></tr></thead><tbody>');
    plan.spares.forEach(function (s) {
      var b = s.part_id ? bom[s.part_id - 1] : null;
      h.push('<tr><td class="num">' + (b ? s.part_id : '—') + '</td><td>' + esc(s.name || (b && b.name)) + '</td><td><span class="pill c-' + esc(s.category) + '">' + esc(P.SPARE_LABELS[s.category] || s.category) + '</span></td><td class="num">' + (b ? esc(b.qty) : '—') + '</td><td class="num">' + esc(s.qty) + '</td><td>' + esc(s.interval) + '</td><td>' + esc(s.reason) + '</td></tr>');
    });
    h.push('</tbody></table></section>');

    // 7. תחזוקה
    h.push('<section class="cont"><h2>7. תחזוקה מונעת</h2><table><thead><tr><th>פעולה</th><th>תדירות</th><th>בוצע</th></tr></thead><tbody>' +
      plan.maintenance.map(function (m) { return '<tr><td>' + esc(m.task) + '</td><td>' + esc(m.interval) + '</td><td><span class="box"></span></td></tr>'; }).join('') + '</tbody></table>');
    if (plan.notes) h.push('<h3>הערות והנחות</h3><p>' + esc(plan.notes).replace(/\n/g, '<br>') + '</p>');
    h.push('</section>');

    // 8. אישור
    h.push('<section class="cont"><h2>8. אישור ומסירה</h2><table><thead><tr><th>תפקיד</th><th>שם</th><th>תאריך</th><th>חתימה</th></tr></thead><tbody>' +
      ['מרכיב אחראי', 'בקרת איכות', 'מקבל המערכת'].map(function (r) { return '<tr><td>' + r + '</td><td style="height:11mm"></td><td></td><td></td></tr>'; }).join('') +
      '</tbody></table></section>');
    h.push('</div></body></html>');
    return h.join('');
  }

  function csv(rows) {
    return '﻿' + rows.map(function (r) {
      return r.map(function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',');
    }).join('\r\n');
  }

  function bomCsv(bom) {
    return csv([['#', 'שם', 'סוג', 'כמות', 'מידות (מ״מ)', 'חומר', 'הערות']].concat(bom.map(function (b, i) {
      return [i + 1, b.name, P.TYPE_LABELS[b.type] || '', b.qty, mm(b.size), b.material || '', b.notes || ''];
    })));
  }

  function sparesCsv(plan, bom) {
    return csv([['# ב-BOM', 'פריט', 'קטגוריה', 'כמות במכלול', 'כמות למלאי', 'תדירות', 'סיבה']].concat((plan ? plan.spares : []).map(function (s) {
      var b = s.part_id ? bom[s.part_id - 1] : null;
      return [s.part_id || '', s.name || (b && b.name) || '', P.SPARE_LABELS[s.category] || s.category, b ? b.qty : '', s.qty, s.interval, s.reason];
    })));
  }

  window.AsmDoc = { build: build, bomCsv: bomCsv, sparesCsv: sparesCsv, csv: csv, esc: esc };
})();
