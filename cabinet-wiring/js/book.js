/* ארון־פלאן — תיק חיווט להדפסה ושרוולי סימון לחוטים. נפתח בחלון חדש ומודפס (או נשמר כ-PDF). */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const BASE_CSS = `
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'IBM Plex Sans Hebrew', Arial, sans-serif; color: #1c2126; margin: 0; font-size: 10.5pt; line-height: 1.45; }
  h1 { font-size: 22pt; margin: 0 0 6mm; }
  h2 { font-size: 14pt; margin: 8mm 0 3mm; border-bottom: 2px solid #a85a26; padding-bottom: 1mm; break-after: avoid; }
  h3 { font-size: 11pt; margin: 4mm 0 2mm; break-after: avoid; }
  table { width: 100%; border-collapse: collapse; font-size: 8.8pt; }
  th, td { border: 1px solid #bbb; padding: 1.2mm 1.6mm; text-align: start; vertical-align: top; }
  th { background: #f3f3f3; }
  tr { break-inside: avoid; }
  .ep { font-family: 'IBM Plex Mono', Consolas, monospace; direction: ltr; unicode-bidi: isolate; white-space: nowrap; }
  .sw { display: inline-block; width: 9mm; height: 3mm; border: 1px solid #555; border-radius: 1.5mm; vertical-align: middle; margin-inline-end: 1mm; }
  .box { display: inline-block; width: 4mm; height: 4mm; border: 1px solid #333; }
  .cover { border: 2px solid #111; padding: 8mm; margin-bottom: 6mm; }
  .kv { display: grid; grid-template-columns: 40mm 1fr; gap: 1mm 4mm; }
  .kv dt { color: #555; }
  .kv dd { margin: 0; font-weight: 700; }
  .page-break { break-before: page; }
  .drawing { background: #2b3035; padding: 3mm; border-radius: 2mm; break-inside: avoid; }
  .drawing svg { width: 100%; height: auto; max-height: 245mm; display: block; }
  .sign { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; margin-top: 6mm; }
  .sign div { border-top: 1px solid #333; padding-top: 1mm; font-size: 9pt; color: #444; }
  .muted { color: #666; }
  .small { font-size: 8.5pt; }
  ol.steps li { margin-bottom: 2mm; break-inside: avoid; }
  .noprint { margin: 4mm 0; }
  @media print { .noprint { display: none; } }
`;

function swatch(C, code) {
  const c = C.COLORS[code] || { hex: '#999' };
  const bg = c.stripe ? `repeating-linear-gradient(90deg, ${c.hex} 0 2mm, ${c.stripe} 2mm 4mm)` : c.hex;
  return `<span class="sw" style="background:${bg}"></span>`;
}

export function bookHtml({ P, L, svg, done, C, E, steps }) {
  const m = P.meta || {};
  const order = E.wireOrder(P, L);
  const cut = E.cutList(P, L);
  const today = new Date().toLocaleDateString('he-IL');
  const zoneHe = (c) => C.ZONES[c.zone] || '';
  const h = [];
  h.push(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>תיק חיווט — ${esc(m.title || P.name)}</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Hebrew:wght@400;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap">
    <style>${BASE_CSS}</style></head><body>`);
  h.push(`<div class="noprint"><button onclick="print()">הדפסה / שמירה כ-PDF</button></div>`);
  h.push(`<div class="cover"><h1>תיק חיווט והרכבה</h1><dl class="kv">
    <dt>פרויקט</dt><dd>${esc(m.title || P.name)}</dd>
    <dt>מס' שרטוט</dt><dd>${esc(m.drawingNo || '—')} ${m.revision ? 'גרסה ' + esc(m.revision) : ''}</dd>
    <dt>הזנה</dt><dd>${esc(m.supply || '—')}</dd>
    <dt>מתח פיקוד</dt><dd>${esc(m.control || '—')}</dd>
    <dt>פלטת הרכבה</dt><dd>${L.plate.w}×${L.plate.h} מ"מ, ${L.rails.length} מסילות DIN</dd>
    <dt>היקף</dt><dd>${P.components.length} רכיבים · ${P.wires.length} חוטים · ${done.size} סומנו כמחווטים</dd>
    <dt>הופק</dt><dd>${today}</dd></dl>
    <p class="small muted">צבע / חתך / סוג חוט שמסומנים ב-* לא היו כתובים בתכנית והושלמו לפי IEC 60204-1. יש לאמת מול התכנית המאושרת ודפי היצרן.</p></div>`);
  /* ציור */
  h.push(`<h2>פריסת הארון</h2><div class="drawing">${svg}</div>`);
  if (P.notes && P.notes.length) h.push(`<h2>הערות תכנון ותקנות</h2><ul>${P.notes.map((n) => '<li>' + esc(n) + '</li>').join('')}</ul>`);
  /* רכיבים */
  h.push(`<h2 class="page-break">רשימת רכיבים</h2><table><thead><tr><th>תג</th><th>סוג</th><th>שם</th><th>יצרן / מק"ט</th><th>מיקום</th><th>✓</th></tr></thead><tbody>`);
  P.components.slice().sort((a, b) => E.natCmp(a.tag, b.tag)).forEach((c) => {
    h.push(`<tr><td class="ep" translate="no">${esc(c.tag)}</td><td>${esc((C.TYPES[c.type] || {}).he || '')}</td><td>${esc(c.name)}${c.desc ? '<div class="small muted">' + esc(c.desc) + '</div>' : ''}</td><td>${esc([c.maker, c.partNo].filter(Boolean).join(' · '))}</td><td>${esc(zoneHe(c))}</td><td><span class="box"></span></td></tr>`);
  });
  h.push('</tbody></table>');
  /* שלבי הרכבה */
  h.push(`<h2 class="page-break">תכנית הרכבה</h2><ol class="steps">`);
  steps.forEach((s) => { h.push(`<li><b>${esc(s.title)}</b><ul>${s.body.map((b) => '<li>' + esc(b) + '</li>').join('')}</ul></li>`); });
  h.push('</ol>');
  /* רשימת חוטים לפי סדר חיווט */
  h.push(`<h2 class="page-break">רשימת חוטים לפי סדר החיווט</h2>`);
  order.forEach((g) => {
    h.push(`<h3>${esc(g.group.he)} (${g.wires.length})</h3><table><thead><tr><th>✓</th><th>מס'</th><th>מ-</th><th>אל-</th><th>צבע</th><th>ממ"ר</th><th>סוג</th><th>אורך</th><th>שרוול</th><th>הסבר</th></tr></thead><tbody>`);
    g.wires.forEach((w) => {
      const r = L.routes[w.id];
      const len = r && r.len ? Math.round(r.len / 10) + ' ס"מ' : 'שטח';
      const fer = w.auto.ferrule;
      h.push(`<tr><td>${done.has(w.id) ? '✓' : '<span class="box"></span>'}</td><td class="ep" translate="no">${esc(w.no)}</td><td class="ep" translate="no">${esc(w.from.tag + ':' + w.from.term)}</td><td class="ep" translate="no">${esc(w.to.tag + ':' + w.to.term)}</td>
        <td>${swatch(C, w.color)}${esc((C.COLORS[w.color] || {}).he || w.color)}${w.colorSource === 'standard' ? '*' : ''}</td><td>${esc(C.fmtSection(w.section))}${w.sectionInferred ? '*' : ''}</td><td>${esc(w.wireType)}${w.wireTypeInferred ? '*' : ''}</td><td>${len}</td>
        <td class="small">${esc(C.COLORS[fer.color].he)} ${fer.size}${w.twinFrom || w.twinTo ? ' / TWIN' : ''}</td><td class="small">${esc(w.explain || w.auto.purpose)}</td></tr>`);
    });
    h.push('</tbody></table>');
  });
  /* תכנית מהדקים: לכל פס, לכל מהדק — החוט מבפנים ומבחוץ */
  const strips = P.components.filter((c) => c.type === 'terminal' && P.wires.some((w) => w.from.tag === c.tag || w.to.tag === c.tag)).sort((a, b) => E.natCmp(a.tag, b.tag));
  if (strips.length) {
    h.push(`<h2 class="page-break">תכנית מהדקים</h2><p class="small muted">לכל מהדק: החוטים שמחוברים אליו מצד הארון ומצד השטח. גשר מסרק מסומן "גשר".</p>`);
    const zoneOf = (tag) => (P.components.find((c) => c.tag === tag) || {}).zone;
    strips.forEach((st) => {
      const terms = [];
      P.wires.forEach((w) => [[w.from, w.to], [w.to, w.from]].forEach(([a, b]) => { if (a.tag === st.tag && !terms.includes(a.term)) terms.push(a.term); }));
      terms.sort(E.natCmp);
      h.push(`<h3><span class="ep">${esc(st.tag)}</span> · ${esc(st.name)} (${terms.length} מהדקים)</h3><table><thead><tr><th>מהדק</th><th>צד הארון</th><th>צד השטח</th><th>גשר</th></tr></thead><tbody>`);
      terms.forEach((t) => {
        const ins = [], outs = [], br = [];
        P.wires.forEach((w) => [[w.from, w.to], [w.to, w.from]].forEach(([a, b]) => {
          if (a.tag !== st.tag || a.term !== t) return;
          const cell = `<span class="ep">${esc(w.no)}</span> → <span class="ep">${esc(b.tag + ':' + b.term)}</span> ${swatch(C, w.color)}${esc(C.fmtSection(w.section))}`;
          if (b.tag === st.tag) br.push(`<span class="ep">${esc(b.term)}</span>`);
          else if (zoneOf(b.tag) === 'field' || zoneOf(b.tag) === 'door') outs.push(cell);
          else ins.push(cell);
        }));
        h.push(`<tr><td class="ep"><b>${esc(t)}</b></td><td>${ins.join('<br>')}</td><td>${outs.join('<br>')}</td><td>${br.join(', ')}</td></tr>`);
      });
      h.push('</tbody></table>');
    });
  }
  /* חיתוך */
  h.push(`<h2 class="page-break">רשימת חיתוך וקנייה</h2><table><thead><tr><th>סוג</th><th>חתך</th><th>צבע</th><th>חוטים</th><th>אורך פנימי משוער</th><th>לשטח</th></tr></thead><tbody>`);
  cut.forEach((c) => h.push(`<tr><td>${esc(c.wireType)}</td><td>${esc(C.fmtSection(c.section))}</td><td>${swatch(C, c.color)}${esc((C.COLORS[c.color] || {}).he || c.color)}</td><td>${c.count}</td><td>${c.mm ? (c.mm / 1000).toFixed(1) + ' מ\'' : '—'}</td><td>${c.ext || ''}</td></tr>`));
  h.push('</tbody></table>');
  /* מסירה */
  h.push(`<h2>בדיקות ומסירה</h2><table><thead><tr><th>בדיקה</th><th>ערך / תוצאה</th><th>✓</th></tr></thead><tbody>
    <tr><td>בדיקה ויזואלית: סימון בשני הקצוות, שרוולים, אין נחושת חשופה</td><td></td><td><span class="box"></span></td></tr>
    <tr><td>מומנט הידוק במהדקי כוח ומשיכה בכל חוט</td><td></td><td><span class="box"></span></td></tr>
    <tr><td>רציפות הארקה (IEC 60204-1 18.2)</td><td>Ω</td><td><span class="box"></span></td></tr>
    <tr><td>התנגדות בידוד 500V DC פאזות–PE (≥ 1 MΩ)</td><td>MΩ</td><td><span class="box"></span></td></tr>
    <tr><td>מתח ספק הפיקוד</td><td>V</td><td><span class="box"></span></td></tr>
    <tr><td>בדיקה פונקציונלית, כולל עצירת חירום</td><td></td><td><span class="box"></span></td></tr>
  </tbody></table>
  <div class="sign"><div>חיווט: שם וחתימה</div><div>בדיקה: שם וחתימה</div><div>תאריך</div></div>`);
  h.push('</body></html>');
  return h.join('');
}

/* שרוולי סימון: לכל חוט שתי תוויות. בכל קצה כתוב מספר החוט ולאן הוא הולך (סימון מקור/יעד). */
export function labelsHtml({ P, C }) {
  const h = [];
  h.push(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>שרוולי סימון — ${esc(P.name)}</title>
    <style>${BASE_CSS}
    .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1.5mm; }
    .lbl { border: 1px dashed #999; height: 11mm; display: flex; align-items: center; justify-content: space-between; padding: 0 2mm; font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 8.5pt; direction: ltr; break-inside: avoid; }
    .lbl b { font-size: 10pt; }
    .lbl i { width: 2mm; height: 8mm; border-radius: 1mm; }
    </style></head><body>
    <div class="noprint"><button onclick="print()">הדפסה</button> <span class="muted small">בכל קצה מסמנים את מספר החוט ואת היעד בצד השני. לחותכים על הקווים או מדפיסים על מדבקות.</span></div>
    <h2>שרוולי סימון לחוטים — ${esc(P.name)}</h2><div class="grid">`);
  P.wires.forEach((w) => {
    const c = C.COLORS[w.color] || { hex: '#999' };
    const bar = c.stripe ? `repeating-linear-gradient(0deg, ${c.hex} 0 1.5mm, ${c.stripe} 1.5mm 3mm)` : c.hex;
    h.push(`<div class="lbl"><i style="background:${bar}"></i><b>${esc(w.no)}</b><span>→ ${esc(w.to.tag + ':' + w.to.term)}</span></div>`);
    h.push(`<div class="lbl"><i style="background:${bar}"></i><b>${esc(w.no)}</b><span>→ ${esc(w.from.tag + ':' + w.from.term)}</span></div>`);
  });
  h.push('</div></body></html>');
  return h.join('');
}

/* תיק אתר: תכנית ההתקנה, תמונת תלת־ממד, רשימת ארונות, טבלת כבלים עם כל הגידים ומערך ההתקנה */
export function siteBookHtml({ site, cabs, links, steps, plan, img, C }) {
  const h = [];
  const name = (pid) => { const c = cabs.find((x) => x.id === pid); return c ? c.name : '?'; };
  const meters = links.reduce((s, l) => s + (l.length || 0), 0);
  h.push(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>מערך התקנה — ${esc(site.name)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans+Hebrew:wght@400;600;700&display=swap" rel="stylesheet">
    <style>${BASE_CSS}
      .plan svg { width: 100%; height: auto; max-height: 150mm; display: block; border: 1px solid #bbb; }
      .shot img { width: 100%; border: 1px solid #bbb; border-radius: 2mm; }
      .spare td { color: #666; font-style: italic; }
    </style></head><body>`);
  h.push(`<div class="noprint"><button onclick="print()">הדפסה / שמירה כ-PDF</button></div>`);
  h.push(`<div class="cover"><h1>מערך התקנה — ${esc(site.name)}</h1><dl class="kv">
    ${site.address ? `<dt>מקום</dt><dd>${esc(site.address)}</dd>` : ''}
    <dt>ארונות</dt><dd>${cabs.length}</dd><dt>כבלים בין ארונות</dt><dd>${links.length} (כ-${Math.round(meters)} מ')</dd>
    <dt>חדר</dt><dd>${site.room.w}×${site.room.d} מ', מגש בגובה ${site.trayH || 2.6} מ'</dd>
    <dt>תאריך</dt><dd>${new Date().toLocaleDateString('he-IL')}</dd></dl>
    <p class="muted small">צבעים, חתכים וסוגי כבלים שהמערכת השלימה הם ברירות מחדל לפי התקן. ההתקנה, הבדיקות והחיבור לרשת — בידי חשמלאי מוסמך בלבד.</p></div>`);
  if (plan) h.push(`<h2>תכנית ההתקנה · מבט על</h2><div class="plan">${plan.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')}</div>`);
  if (img) h.push(`<h2>האתר בתלת־ממד</h2><div class="shot"><img src="${img}" alt="האתר בתלת־ממד"></div>`);
  h.push(`<h2 class="page-break">ארונות</h2><table><thead><tr><th>#</th><th>ארון</th><th>שרטוט</th><th>מעטפת</th><th>מיקום (x / z)</th><th>הזנה</th><th>חוטים</th></tr></thead><tbody>
    ${cabs.map((c, i) => { const l = site.layout[c.id] || {}; return `<tr><td>${i + 1}</td><td>${esc(c.name)}</td><td class="ep">${esc(c.P.meta.drawingNo || '')}</td><td>${esc(c.enc.text)}</td><td class="ep">${(l.x || 0).toFixed(2)} / ${(l.z || 0).toFixed(2)} מ'</td><td>${esc(c.P.meta.supply || '')}</td><td>${c.P.wires.length}</td></tr>`; }).join('')}</tbody></table>`);
  h.push(`<h2>טבלת כבלים</h2><table><thead><tr><th>כבל</th><th>מארון</th><th>לארון</th><th>סוג</th><th>גידים</th><th>אורך</th><th>הערה</th></tr></thead><tbody>
    ${links.map((l, i) => `<tr><td class="ep">W${i + 1}</td><td>${esc(name(l.a.pid))} <span class="ep">${esc(l.a.device || '')}</span></td><td>${esc(name(l.b.pid))} <span class="ep">${esc(l.b.device || '')}</span></td><td class="ep">${esc(l.cable.type)}</td><td>${l.cores.length}/${l.cable.cores}</td><td>${l.length || '?'} מ'</td><td>${esc(l.cable.why)}</td></tr>`).join('') || '<tr><td colspan="7">אין כבלים בין ארונות.</td></tr>'}</tbody></table>`);
  links.forEach((l, i) => {
    h.push(`<h3>W${i + 1}: ${esc(name(l.a.pid))} ← ${esc(name(l.b.pid))} · <span class="ep">${esc(l.cable.type)}</span> · ${l.length || '?'} מ'</h3>
      <table><thead><tr><th>גיד</th><th>${esc(name(l.a.pid))}</th><th>${esc(name(l.b.pid))}</th><th>אות</th><th>תפקיד</th><th>✓ רציפות</th><th>בידוד MΩ</th></tr></thead><tbody>
      ${l.cores.map((k, j) => `<tr><td>${j + 1}</td><td class="ep">${esc(k.a)}</td><td class="ep">${esc(k.b)}</td><td class="ep">${esc(k.label)}</td><td>${esc((C.FUNCS[k.func] || {}).he || '')}</td><td><span class="box"></span></td><td></td></tr>`).join('')}
      ${l.cable.cores > l.cores.length ? `<tr class="spare"><td colspan="7">${l.cable.cores - l.cores.length} גידים רזרביים — מבודדים ומסומנים "רזרבה".</td></tr>` : ''}</tbody></table>`);
  });
  h.push(`<h2 class="page-break">מערך ההתקנה</h2><ol class="steps">${steps.map((s) => `<li><strong>${esc(s.title)}</strong> <span class="box"></span><ul>${s.body.map((b) => `<li>${esc(b)}</li>`).join('')}</ul></li>`).join('')}</ol>`);
  h.push(`<div class="sign"><div>מתקין</div><div>חשמלאי בודק</div><div>תאריך</div></div>`);
  h.push('</body></html>');
  return h.join('\n');
}
