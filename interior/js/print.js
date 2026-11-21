/* Print and PDF: a report of the plan built from what the user ticks (floor plan, 3D views of
   every room, room photos before and after, shopping list with stores and phones, budget,
   garden, rules). Printed from the page, or downloaded as a standalone HTML file. */
(function () {
  'use strict';
  const IH = window.IH;
  const $ = (s, r) => (r || document).querySelector(s);
  const app = () => IH.app;

  // report styles: used on the page when printing and inside the downloaded file
  const REPORT_CSS = `
.rp{font-family:'IBM Plex Sans Hebrew',Assistant,Arial,sans-serif;color:#1a1e21;background:#fff;direction:rtl;font-size:11pt;line-height:1.45}
.rp h1{font-family:'IBM Plex Sans Hebrew',Arial,sans-serif;font-weight:300;font-size:26pt;letter-spacing:-.01em;margin:0 0 4pt}
.rp h2{font-family:'IBM Plex Sans Hebrew',Arial,sans-serif;font-weight:400;font-size:16pt;margin:0 0 8pt;padding-bottom:4pt;border-bottom:1pt solid #2d5a4e}
.rp h3{font-size:12pt;margin:10pt 0 4pt}
.rp .rp-sec{break-before:page;page-break-before:always;padding-top:4pt}
.rp .rp-sec.first{break-before:auto;page-break-before:auto}
.rp .rp-eyebrow{font-family:'IBM Plex Mono',monospace;color:#a5723f;font-weight:600;letter-spacing:.04em;margin:0}
.rp .rp-muted{color:#6b665c;font-size:9.5pt}
.rp .rp-facts{display:grid;grid-template-columns:repeat(3,1fr);gap:6pt 14pt;margin:12pt 0}
.rp .rp-facts div{border-top:.75pt solid #d8d4ca;padding-top:4pt}
.rp .rp-facts dt{color:#6b665c;font-size:9pt}.rp .rp-facts dd{margin:0;font-weight:600}
.rp img{max-width:100%;display:block}
.rp .rp-plan svg{width:100%;height:auto;max-height:22cm}
.rp .rp-grid{display:grid;grid-template-columns:1fr 1fr;gap:10pt}
.rp figure{margin:0;break-inside:avoid;page-break-inside:avoid}
.rp figcaption{font-size:9.5pt;color:#6b665c;margin-top:3pt}
.rp .rp-pair{display:grid;grid-template-columns:1fr 1fr;gap:8pt;margin-bottom:12pt;break-inside:avoid;page-break-inside:avoid}
.rp .rp-pair h3{grid-column:1/-1;margin:0}
.rp table{width:100%;border-collapse:collapse;margin:4pt 0 10pt;font-size:9.5pt}
.rp th,.rp td{text-align:right;padding:3pt 4pt;border-bottom:.5pt solid #d8d4ca;vertical-align:top}
.rp th{font-weight:600;color:#6b665c;font-size:8.5pt}
.rp tr{break-inside:avoid;page-break-inside:avoid}
.rp .num{font-variant-numeric:tabular-nums;white-space:nowrap}
.rp tfoot td{font-weight:700;border-top:1pt solid #1c1a16}
.rp .rp-store{overflow-wrap:anywhere;break-inside:avoid;page-break-inside:avoid;border:.75pt solid #d8d4ca;padding:6pt 8pt;margin-bottom:6pt}
.rp .rp-store b{font-size:11pt}
.rp .rp-stores{columns:2;column-gap:10pt}
.rp [dir=ltr]{unicode-bidi:isolate}
.rp .rp-rule dl{margin:0}.rp .rp-rule div{display:flex;gap:8pt;margin:2pt 0}.rp .rp-rule dt{font-weight:600;min-width:70pt}.rp .rp-rule dd{margin:0}
.rp .plan text{font-family:Assistant,Arial,sans-serif}
`;
  const PAGE_CSS = `
.print-root{display:none}
@media print{
  @page{size:A4;margin:14mm 12mm}
  body.is-printing > *:not(.print-root){display:none !important}
  body.is-printing .print-root{display:block}
  body.is-printing{background:#fff}
}`;
  const style = document.createElement('style');
  style.textContent = PAGE_CSS + REPORT_CSS;
  document.head.appendChild(style);

  const esc = (s) => app().esc(s);
  const rich = (s) => app().rich(s);
  const money = (n) => app().money(n);

  function blobToData(b) {
    return new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(''); r.readAsDataURL(b); });
  }

  function planSvg(opts) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'plan');
    svg.setAttribute('xmlns', ns);
    IH.renderPlan(svg, app().plan, Object.assign({ triangle: true }, opts || {}));
    // inline the computed look so the drawing prints the same outside this page
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:-9999px;top:0;width:900px';
    host.appendChild(svg);
    document.body.appendChild(host);
    const props = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline'];
    svg.querySelectorAll('*').forEach((el) => {
      const cs = getComputedStyle(el);
      props.forEach((p) => { const v = cs.getPropertyValue(p); if (v) el.style.setProperty(p, v); });
    });
    host.remove();
    return svg.outerHTML;
  }

  function siteHost(u) {
    try { const h = new URL(u).hostname.replace(/^www\./, ''); return /google\./.test(h) ? '' : h; } catch (e) { return ''; }
  }
  function storeLine(id) {
    const s = IH.STORES[id];
    const b = IH.nearestBranch(id, app().state.region);
    const phone = (b && b.phone) || s.hotline;
    return `${esc(s.name)}${phone ? ` <span dir="ltr" class="num">${esc(phone)}</span>` : ''}`;
  }

  async function build(sel, forFile) {
    const a = app(), plan = a.plan, st = a.state;
    const parts = [];
    const cls = () => (parts.length ? 'rp-sec' : 'rp-sec first');
    const img = async (blob) => (forFile ? blobToData(blob) : URL.createObjectURL(blob));
    const status = $('#print-status');
    const date = new Date().toLocaleDateString('he-IL');

    if (sel.cover) {
      const facts = Array.from(document.querySelectorAll('#facts > div')).map((d) => d.outerHTML).join('');
      parts.push(`<section class="${cls()}">
        <p class="rp-eyebrow">מתאר · תכנון פנים לבית · ${esc(date)}</p>
        <h1>${esc($('#plan-title').textContent)}</h1>
        <p>${esc($('#plan-lede').textContent)}</p>
        <dl class="rp-facts">${facts}</dl>
        <p class="rp-muted">אזור: ${esc(IH.REGIONS[st.region])} · תקציב: ${esc(IH.TIERS[st.budget])} · ${st.adults} מבוגרים, ${st.kids} ילדים${plan.yard ? ` · חצר של כ-${Math.round(plan.yard.area)} מ״ר` : ''}</p>
      </section>`);
    }
    if (sel.plan) {
      parts.push(`<section class="${cls()}"><h2>תוכנית קומה</h2><div class="rp-plan">${planSvg()}</div>
        <p class="rp-muted">מידות במטרים. הרהיטים בקנה מידה; מומלץ לאמת מידות קירות ופתחים במדידה בבית.</p></section>`);
    }
    if (sel.views && a.tour) {
      status.textContent = 'מכין הדמיות של החדרים…';
      await new Promise((r) => setTimeout(r, 30));
      const rooms = plan.rooms.filter((r) => r.kind !== 'corridor' && plan.items.some((it) => it.room === r.id && IH.CATALOG[it.type]));
      const figs = rooms.map((r) => {
        const u = a.tour.snapshotRoom(r.id, 1200, 780);
        return u ? `<figure><img src="${u}" alt="${esc(r.name)}"><figcaption>${esc(r.name)}</figcaption></figure>` : '';
      }).join('');
      parts.push(`<section class="${cls()}"><h2>הדמיות תלת-ממד</h2><div class="rp-grid">${figs}</div></section>`);
    }
    if (sel.photos && IH.photos) {
      const recs = await IH.photos.records();
      if (recs.length) {
        status.textContent = 'מצרף את צילומי החדרים…';
        let html = '';
        for (const r of recs) {
          const b = await img(r.before);
          const af = r.after ? await img(r.after) : null;
          html += `<div class="rp-pair"><h3>${esc(r.title)}</h3>
            <figure><img src="${b}" alt=""><figcaption>לפני</figcaption></figure>
            ${af ? `<figure><img src="${af}" alt=""><figcaption>אחרי: הריהוט המומלץ</figcaption></figure>` : '<p class="rp-muted">עוד לא הוצב ריהוט בתמונה הזאת.</p>'}
          </div>`;
        }
        parts.push(`<section class="${cls()}"><h2>צילומי החדרים לפני ואחרי</h2>${html}</section>`);
      }
    }
    if (sel.list) {
      const rooms = plan.rooms.filter((r) => plan.items.some((it) => it.room === r.id && IH.CATALOG[it.type]));
      let total = 0;
      const html = rooms.map((r) => {
        const groups = a.groupItems(plan.items.filter((it) => it.room === r.id && IH.CATALOG[it.type]));
        const sum = groups.reduce((s, g) => s + g.total, 0);
        total += sum;
        return `<h3>${esc(r.name)} · <span class="num">${money(sum)}</span></h3>
          <table><thead><tr><th>פריט</th><th>כמות</th><th>מידות (ס״מ)</th><th>מחיר משוער</th><th>איפה קונים (הסניף הקרוב)</th></tr></thead>
          <tbody>${groups.map((g) => {
            const c = IH.CATALOG[g.it.type];
            const models = (IH.MODELS[g.it.type] || []).filter((m) => m.price).slice(0, 2).map((m) => `${esc(m.name)} ${money(m.price)}`).join('; ');
            return `<tr><td>${esc(c.name)}${g.it.note ? ` <span class="rp-muted">${rich(g.it.note)}</span>` : ''}${models ? `<br><span class="rp-muted">דגמים: ${rich(models)}</span>` : ''}</td>
              <td class="num">${g.n}</td><td class="num"><bdi dir="ltr">${esc(a.dims(g.it))}</bdi></td><td class="num">${money(g.total)}</td>
              <td>${a.storesFor(g.it).map(storeLine).join('<br>')}</td></tr>`;
          }).join('')}</tbody></table>`;
      }).join('');
      parts.push(`<section class="${cls()}"><h2>רשימת קניות לפי חדר</h2>${html}
        <table><tfoot><tr><td>סה״כ משוער (${esc(IH.TIERS[st.budget])})</td><td class="num">${money(total)}</td></tr></tfoot></table>
        <p class="rp-muted">מחירים משוערים לספטמבר 2026, לפני מבצעים והובלה. המחיר הסופי רק מול החנות.</p></section>`);
    }
    if (sel.stores) {
      const ids = new Set();
      plan.items.forEach((it) => { if (IH.CATALOG[it.type]) a.storesFor(it).forEach((s) => ids.add(s)); });
      const html = Array.from(ids).map((id) => {
        const s = IH.STORES[id];
        const b = IH.nearestBranch(id, st.region);
        return `<div class="rp-store"><b>${esc(s.name)}</b> <span class="rp-muted">${esc(s.kind)}</span><br>
          ${s.hotline ? `${esc(s.hotlineNote)}: <span dir="ltr" class="num">${esc(s.hotline)}</span><br>` : ''}
          ${(s.extra || []).map(([k, v]) => `${esc(k)}: <span dir="ltr" class="num">${esc(v)}</span><br>`).join('')}
          ${b ? `הסניף הקרוב: ${esc(b.addr)}, ${esc(b.city)}${b.phone ? ` · <span dir="ltr" class="num">${esc(b.phone)}</span>` : ''}<br>` : ''}
          ${siteHost(s.site) ? `<span class="rp-muted" dir="ltr">${esc(siteHost(s.site))}</span>` : ''}</div>`;
      }).join('');
      parts.push(`<section class="${cls()}"><h2>חנויות, טלפונים וכתובות · ${esc(IH.REGIONS[st.region])}</h2><div class="rp-stores">${html}</div>
        <p class="rp-muted">נאסף בספטמבר 2026. כדאי להתקשר לפני שנוסעים.</p></section>`);
    }
    if (sel.budget) {
      parts.push(`<section class="${cls()}"><h2>הערכת תקציב</h2>${budgetTable()}</section>`);
    }
    if (sel.garden && plan.yard) {
      parts.push(`<section class="${cls()}"><h2>תכנון החצר</h2><p>${esc($('#garden-lede').textContent)}</p><div class="rp-plan">${planSvg()}</div></section>`);
    }
    if (sel.rules) {
      parts.push(`<section class="${cls()}"><h2>עקרונות התכנון</h2>${a.RULES.concat(plan.yard ? a.GARDEN_RULES : []).map(([t, rows, src]) => `<div class="rp-rule"><h3>${esc(t)}</h3><dl>${rows.map(([k, v]) => `<div><dt>${rich(k)}</dt><dd>${rich(v)}</dd></div>`).join('')}</dl><p class="rp-muted">מקור: ${esc(src)}</p></div>`).join('')}</section>`);
    }
    status.textContent = '';
    return `<div class="rp">${parts.join('')}</div>`;
  }

  function budgetTable() {
    const a = app(), plan = a.plan;
    const by = {};
    plan.items.forEach((it) => { const c = IH.CATALOG[it.type]; if (c) by[c.cat] = (by[c.cat] || 0) + a.price(it); });
    const rows = Object.entries(by).sort((x, y) => y[1] - x[1]);
    return `<table><thead><tr><th>קטגוריה</th><th>סכום</th></tr></thead><tbody>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${money(v)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td>סה״כ</td><td class="num">${money(a.totalBudget())}</td></tr></tfoot></table>`;
  }

  function selection() {
    const f = $('#print-form');
    const sel = {};
    Array.from(f.querySelectorAll('input[type=checkbox]')).forEach((c) => { sel[c.name] = c.checked; });
    return sel;
  }

  async function doPrint() {
    const btn = $('#print-go');
    btn.disabled = true;
    try {
      const html = await build(selection(), false);
      const root = $('#print-root');
      root.innerHTML = html;
      document.body.classList.add('is-printing');
      $('#print-dlg').close();
      await Promise.all(Array.from(root.querySelectorAll('img')).map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
      const started = Date.now();
      window.print();
      // some embedded viewers block printing and return at once; point to the file instead
      if (Date.now() - started < 60 && !matchMedia('print').matches) {
        setTimeout(() => {
          if (!document.body.classList.contains('is-printing')) return;
          $('#print-dlg').showModal();
          $('#print-status').textContent = 'אם חלון ההדפסה לא נפתח, הורידו את הדוח כקובץ ופתחו אותו בדפדפן כדי להדפיס או לשמור כ-PDF.';
        }, 400);
      }
    } finally { btn.disabled = false; }
  }
  window.addEventListener('afterprint', () => {
    document.body.classList.remove('is-printing');
    const root = $('#print-root');
    root.querySelectorAll('img[src^="blob:"]').forEach((i) => URL.revokeObjectURL(i.src));
    root.innerHTML = '';
  });

  async function doFile() {
    const btn = $('#print-file');
    btn.disabled = true;
    try {
      const body = await build(selection(), true);
      const doc = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>מתאר · ${esc($('#plan-title').textContent)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Hebrew:wght@300;400;600;700&family=IBM+Plex+Mono:wght@500&display=swap">
<style>body{margin:0;background:#fff}.rp{max-width:190mm;margin:0 auto;padding:12mm 10mm}@page{size:A4;margin:14mm 12mm}@media print{.rp{padding:0;max-width:none}}.rp-bar{position:sticky;top:0;background:#f4f1ea;padding:8px 12px;text-align:center;font-family:Assistant,Arial,sans-serif}@media print{.rp-bar{display:none}}${REPORT_CSS}</style>
</head><body><div class="rp-bar"><button onclick="print()">הדפסה / שמירה כ-PDF</button></div>${body}</body></html>`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([doc], { type: 'text/html' }));
      a.download = 'matar-report.html';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
      $('#print-status').textContent = 'הקובץ ירד. פותחים אותו בדפדפן ולוחצים ״הדפסה / שמירה כ-PDF״.';
    } finally { btn.disabled = false; }
  }

  function open(preset) {
    const dlg = $('#print-dlg');
    if (preset) Array.from($('#print-form').querySelectorAll('input[type=checkbox]')).forEach((c) => { c.checked = preset.includes(c.name); });
    $('#print-status').textContent = '';
    const g = $('#print-form [name=garden]');
    g.closest('label').hidden = !(app().plan && app().plan.yard);
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }

  $('#btn-print').addEventListener('click', () => open());
  $('#print-go').addEventListener('click', doPrint);
  $('#print-file').addEventListener('click', doFile);
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-print]');
    if (b) open(b.dataset.print.split(','));
  });

  IH.print = { open };
})();
