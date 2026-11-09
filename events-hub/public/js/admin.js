/* global $, $$, api, esc, toast, money, fmtDate, icon, asset, adminToken, shrinkImage, PHOTOS */
(function () {
  const A = '/api/admin';
  const ref = { cities: [], categories: [], collections: [], printTypes: [], statuses: [], suppliers: [], couriers: [], settings: {}, payments: {} };
  const REGIONS = () => [...new Set(ref.cities.map((c) => c.region))];
  const view = $('#view');
  let current = 'dashboard';

  // ---------- מודאל וטפסים ----------
  function openModal(html) { $('#modal-body').innerHTML = html; $('#modal').classList.remove('hidden'); }
  function closeModal() { $('#modal').classList.add('hidden'); }
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal(); });

  function checkList(name, options, selected = []) {
    const sel = new Set(selected);
    return `<input placeholder="חיפוש…" data-filter="${name}" style="margin-bottom:6px">
      <div data-checklist="${name}" style="max-height:180px;overflow:auto;border:1px solid var(--border);border-radius:10px;padding:8px;display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:4px">
      ${options.map((o) => `<label class="check" data-label="${esc(o.label)}"><input type="checkbox" name="${name}" value="${esc(o.value)}" ${sel.has(o.value) ? 'checked' : ''}> ${esc(o.label)}</label>`).join('')}</div>`;
  }

  // fields: [{k,label,type,options,full}]
  function formHtml(fields, rec = {}) {
    return `<div class="fields">${fields.map((f) => {
      const v = rec[f.k] ?? f.def ?? '';
      const wrap = (inner) => `<div class="field" ${f.full ? 'style="grid-column:1/-1"' : ''}><label>${esc(f.label)}</label>${inner}</div>`;
      switch (f.type) {
        case 'textarea': return wrap(`<textarea name="${f.k}">${esc(v)}</textarea>`);
        case 'select': return wrap(`<select name="${f.k}">${f.options.map((o) => `<option value="${esc(o.value)}" ${o.value === v ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`);
        case 'checks': return `<div class="field" style="grid-column:1/-1"><label>${esc(f.label)}</label>${checkList(f.k, f.options, v || [])}</div>`;
        case 'bool': return `<div class="field"><label class="check" style="margin-top:28px"><input type="checkbox" name="${f.k}" ${v !== false ? 'checked' : ''}> ${esc(f.label)}</label></div>`;
        default: return wrap(`<input name="${f.k}" type="${f.type || 'text'}" value="${esc(v)}" ${f.step ? `step="${f.step}"` : ''}>`);
      }
    }).join('')}</div>`;
  }

  function readForm(root, fields) {
    const out = {};
    for (const f of fields) {
      if (f.type === 'checks') out[f.k] = $$(`input[name="${f.k}"]:checked`, root).map((i) => i.value);
      else if (f.type === 'bool') out[f.k] = $(`[name="${f.k}"]`, root).checked;
      else if (f.type === 'number') out[f.k] = Number($(`[name="${f.k}"]`, root).value);
      else out[f.k] = $(`[name="${f.k}"]`, root).value;
    }
    return out;
  }

  document.addEventListener('input', (e) => {
    const name = e.target.dataset.filter;
    if (!name) return;
    const q = e.target.value.trim();
    $$(`[data-checklist="${name}"] [data-label]`).forEach((l) => { l.style.display = !q || l.dataset.label.includes(q) ? '' : 'none'; });
  });

  function editForm({ title, fields, rec, url, onSaved, extraHtml = '', collectExtra }) {
    openModal(`<div class="row between"><h2 style="margin:0">${esc(title)}</h2><button class="icon-btn" data-close>✕</button></div>
      <form id="edit-form" style="margin-top:12px">${formHtml(fields, rec || {})}${extraHtml}
      <div class="row" style="margin-top:12px"><button class="btn">שמירה</button><button type="button" class="btn ghost" data-close>ביטול</button>
      ${rec?.id ? '<span class="spacer"></span><button type="button" class="btn danger sm" id="del-btn">מחיקה</button>' : ''}</div></form>`);
    const form = $('#edit-form');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const body = { ...readForm(form, fields), ...(collectExtra ? collectExtra(form) : {}) };
      try {
        await api(rec?.id ? `${url}/${rec.id}` : url, { method: rec?.id ? 'PUT' : 'POST', body });
        closeModal(); toast('נשמר ✓'); onSaved();
      } catch (err) { toast(err.message); }
    };
    if (rec?.id) {
      $('#del-btn').onclick = async () => {
        if (!confirm('למחוק?')) return;
        await api(`${url}/${rec.id}`, { method: 'DELETE' });
        closeModal(); toast('נמחק'); onSaved();
      };
    }
  }

  const cityOpts = () => ref.cities.map((c) => ({ value: c.name, label: c.name })).sort((a, b) => a.label.localeCompare(b.label, 'he'));
  const regionOpts = () => REGIONS().map((r) => ({ value: r, label: r }));
  const catOpts = () => ref.categories.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }));
  const catName = (id) => { const c = ref.categories.find((x) => x.id === id); return c ? `${c.icon} ${c.name}` : id; };
  const ACTIVE = (a) => (a === false ? '<span class="badge">לא פעיל</span>' : '<span class="badge ok">פעיל</span>');

  // ---------- לוח בקרה ----------
  // גרף עמודות של 30 הימים האחרונים (SVG)
  function salesChart(days) {
    const W = 600; const H = 160; const max = Math.max(1, ...days.map((d) => d.revenue)); const bw = W / days.length;
    return `<svg viewBox="0 0 ${W} ${H + 18}" class="chart" role="img" aria-label="מכירות ב-30 הימים האחרונים">
      ${days.map((d, i) => {
        const h = Math.round((d.revenue / max) * H);
        const x = W - (i + 1) * bw; // מימין לשמאל: היום מצד שמאל
        return `<rect x="${x + 2}" y="${H - h}" width="${bw - 4}" height="${Math.max(h, d.revenue ? 2 : 0)}" rx="3"><title>${new Date(d.date).toLocaleDateString('he-IL')}: ${money(d.revenue)} · ${d.orders} הזמנות</title></rect>`;
      }).join('')}
      <line x1="0" x2="${W}" y1="${H}" y2="${H}" class="axis"/>
      <text x="${W - 2}" y="${H + 14}" text-anchor="start">לפני 30 יום</text><text x="2" y="${H + 14}" text-anchor="end">היום</text>
    </svg>`;
  }
  function renderStats(st) {
    $('#stats').innerHTML = `<div class="grid" style="margin-top:14px">
      <div class="card" style="grid-column:1/-1"><div class="row between"><h2 style="margin:0">מכירות ב-30 יום</h2>
        <span class="muted">${money(st.revenue)} · ${st.orders} הזמנות · ממוצע ${money(st.avgOrder)}</span></div>${salesChart(st.days)}</div>
      <div class="card"><h2>הנמכרים ביותר</h2>${st.top.length ? `<ol class="top-list">${st.top.map((t) => `<li><b>${esc(t.name)}</b><span>${t.qty} יח׳ · ${money(t.revenue)}</span></li>`).join('')}</ol>` : '<p class="muted">עוד אין מכירות</p>'}</div>
      <div class="card"><h2>ביצועי מבצעים</h2>
        <p>${st.promo.orders} הזמנות עם הנחה · ${money(st.promo.revenue)} הכנסות</p><p class="muted">סה"כ הנחות שניתנו: ${money(st.promo.discount)}</p>
        ${Object.keys(st.promo.coupons).length ? `<p>קופונים: ${Object.entries(st.promo.coupons).map(([c, n]) => `<span class="badge primary" dir="ltr">${esc(c)} × ${n}</span>`).join(' ')}</p>` : ''}
        <button class="btn soft sm" data-go="promotions">${icon('tag')}למבצעים</button></div>
    </div>`;
    $$('#stats [data-go]').forEach((c) => { c.onclick = () => go(c.dataset.go); });
  }

  async function dashboard() {
    const d = await api(`${A}/dashboard`);
    const stat = (ico, label, val, cls = '', go = '') => `<div class="card stat-card${cls ? ' alert' : ''}" ${go ? `data-go="${go}" style="cursor:pointer" role="button" tabindex="0"` : ''}>
      <div class="stat-ico">${icon(ico, '')}</div><div class="muted">${label}</div><div class="stat ${cls}">${val}</div></div>`;
    view.innerHTML = `<div class="stage" style="grid-template-columns:1fr"><div>
        <span class="eyebrow"><img src="icon.svg" alt="">פריים אירועים · ניהול</span>
        <h1>${(() => { const h = new Date().getHours(); return h < 12 ? 'בוקר טוב' : h < 18 ? 'צהריים טובים' : 'ערב טוב'; })()}, <em>הנה מה שקורה היום</em></h1>
        <div class="row"><button class="btn gold" data-go="events:new">${icon('plus')}אירוע חדש</button><button class="btn ghost light" data-go="promotions">${icon('tag')}מבצעים</button></div>
      </div></div>
      <div class="stat-grid">
      ${stat('box', 'הזמנות פתוחות', d.ordersOpen, '', 'orders')}
      ${stat('alert', 'משלוחים תקועים', d.ordersStuck, d.ordersStuck ? 'bad' : '', 'orders:stuck')}
      ${stat('truck', 'דורשות שיוך ספק/שליח', d.needsAssignment, d.needsAssignment ? 'bad' : '', 'orders')}
      ${stat('print', 'תמונות ממתינות להדפסה', d.photosPending, '', 'events')}
      ${stat('calendar', 'אירועים', d.events, '', 'events')}
      ${stat('users', 'אורחים רשומים', d.guests, '', 'guests')}
      ${stat('coins', 'הכנסות (הזמנות ששולמו)', money(d.revenue))}
    </div>
    <div id="stats" class="stats-area"><p class="muted">טוען נתוני מכירות…</p></div>`;
    api(`${A}/stats`).then(renderStats).catch(() => { $('#stats').innerHTML = ''; });
    $$('[data-go]').forEach((c) => { c.onclick = () => { const [v, f] = c.dataset.go.split(':'); go(v, f); }; });
  }

  // ---------- אירועים ----------
  const EVENT_FIELDS = [
    { k: 'name', label: 'שם האירוע', full: true },
    { k: 'type', label: 'סוג אירוע', type: 'select', options: ['חתונה', 'חינה', 'בר מצווה', 'בת מצווה', 'ברית', 'יום הולדת', 'מקווה', 'אירוסין', 'כנס', 'אירוע חברה', 'אחר'].map((x) => ({ value: x, label: x })) },
    { k: 'date', label: 'תאריך', type: 'date' },
    { k: 'endsAt', label: 'סיום קבלת תמונות', type: 'datetime-local' },
    { k: 'photosPerGuest', label: 'כמות תמונות לכל אורח (דרך ה-QR)', type: 'number', def: 3 },
    { k: 'totalPhotoLimit', label: 'מגבלה כוללת לאירוע (0 = ללא)', type: 'number', def: 0 },
    { k: 'clientName', label: 'שם בעל/ת האירוע' },
    { k: 'clientPhone', label: 'טלפון בעל/ת האירוע' },
    { k: 'welcomeText', label: 'הודעת פתיחה לאורחים', type: 'textarea', full: true },
    { k: 'allowAnimations', label: 'לאפשר יצירת אנימציות', type: 'bool' },
    { k: 'active', label: 'אירוע פעיל', type: 'bool' },
    { k: 'notes', label: 'הערות פנימיות', type: 'textarea', full: true },
  ];

  function poRow(o = {}) {
    {
      const t = ref.printTypes.find((x) => x.type === o.type) || ref.printTypes[0];
      return `<div class="fields po-row" style="align-items:end;margin-bottom:6px">
        <div><label>סוג</label><select class="po-type">${ref.printTypes.map((x) => `<option value="${x.type}" ${x.type === t.type ? 'selected' : ''}>${x.name}</option>`).join('')}</select></div>
        <div><label>גודל (ס"מ) - כל מידה שתרצו</label><input class="po-size" dir="ltr" list="sizes-${t.type}" value="${esc(o.size || t.sizes[0])}" placeholder="למשל 7x10" required></div>
        <div><label>שם לתצוגה</label><input class="po-label" value="${esc(o.label || '')}" placeholder="אוטומטי"></div>
        <input type="hidden" class="po-id" value="${esc(o.id || '')}"><input type="hidden" class="po-frame" value="${esc(o.frame || '')}">
        <div class="po-frame-box"><label>מסגרת האירוע (PNG שקוף)</label><div class="row" style="gap:6px;flex-wrap:nowrap">
          <span class="po-frame-prev">${o.frame ? `<img src="${esc(asset(o.frame))}" alt="">` : '—'}</span>
          <label class="btn soft sm" style="margin:0">${o.frame ? 'החלפה' : '🖼️ העלאה'}<input type="file" accept="image/png,image/webp" class="hidden po-frame-file"></label>
          ${o.frame ? '<button type="button" class="btn ghost sm po-frame-del">✕</button>' : ''}</div></div>
        <div><button type="button" class="btn ghost sm po-del">הסרה</button></div></div>`;
    }
  }

  function printOptionsEditor(list = []) {
    return `${ref.printTypes.map((t) => `<datalist id="sizes-${t.type}">${t.sizes.map((z) => `<option value="${esc(z)}">`).join('')}</datalist>`).join('')}
      <div class="card flat" style="margin-top:12px"><h3>אפשרויות הדפסה לאורחים (עד 3)</h3>
      <p class="muted small">🖼️ לכל אפשרות אפשר להעלות מסגרת של האירוע (PNG עם חלון שקוף, באותו יחס כמו המידה): האורח עורך את התמונה כבר בתוך המסגרת, והיא נשלחת להדפסה איתה.</p>
      <p class="muted small">קובעים סוג, מידה ושם לכל אפשרות. המידה חופשית (רוחב x גובה בס"מ); הרשימה המוצעת נערכת ב"סליקה והגדרות" ← מידות הדפסה.</p><div id="po-list">${list.map((o) => poRow(o)).join('')}</div>
      <button type="button" class="btn soft sm" id="po-add">➕ הוספת אפשרות</button></div>`;
  }

  function bindPrintOptions() {
    const list = $('#po-list');
    const refreshSizes = (r) => {
      const t = ref.printTypes.find((x) => x.type === $('.po-type', r).value);
      const inp = $('.po-size', r);
      inp.setAttribute('list', `sizes-${t.type}`);
      if (!t.sizes.includes(inp.value)) inp.value = t.sizes[0] || '';
    };
    const updateAdd = () => { $('#po-add').disabled = $$('.po-row', list).length >= 3; };
    $('#po-add').onclick = () => {
      if ($$('.po-row', list).length >= 3) return;
      list.insertAdjacentHTML('beforeend', poRow({}));
      updateAdd();
    };
    list.addEventListener('change', (e) => { if (e.target.classList.contains('po-type')) refreshSizes(e.target.closest('.po-row')); });
    list.addEventListener('click', (e) => {
      if (e.target.classList.contains('po-del')) { e.target.closest('.po-row').remove(); updateAdd(); }
      if (e.target.classList.contains('po-frame-del')) { const r = e.target.closest('.po-row'); $('.po-frame', r).value = ''; r.outerHTML = poRow(rowData(r)); }
    });
    // מסגרת לאפשרות ההדפסה: PNG עם חלון שקוף. נשמרת כ-PNG (שקיפות), ומוקטנת רק אם היא גדולה מדי
    list.addEventListener('change', async (e) => {
      if (!e.target.classList.contains('po-frame-file')) return;
      const f = e.target.files[0]; const r = e.target.closest('.po-row');
      if (!f) return;
      try {
        toast('מעלה את המסגרת…');
        const fd = new FormData();
        fd.append('file', f.size > 1.8e6 ? await shrinkPng(f) : f, 'frame.png');
        const up = await api(`${A}/uploads`, { method: 'POST', body: fd });
        $('.po-frame', r).value = up.url;
        r.outerHTML = poRow(rowData(r));
        toast('המסגרת נוספה. לחצו "שמירה" באירוע.');
      } catch (err) { toast(err.message); }
    });
    updateAdd();
  }

  const rowData = (r) => ({ id: $('.po-id', r).value || undefined, type: $('.po-type', r).value, size: $('.po-size', r).value, label: $('.po-label', r).value, frame: $('.po-frame', r).value });
  const collectPrintOptions = (form) => ({ printOptions: $$('.po-row', form).map(rowData) });
  // PNG גדול מדי: מקטינים בדפדפן ושומרים על השקיפות
  function shrinkPng(file, maxSide = 2000) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file); const img = new Image();
      img.onload = () => {
        const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error('המסגרת לא נקראה'))), 'image/png');
      };
      img.onerror = () => reject(new Error('המסגרת לא נקראה'));
      img.src = url;
    });
  }

  function editEvent(ev) {
    editForm({
      title: ev ? 'עריכת אירוע' : 'אירוע חדש', fields: EVENT_FIELDS, rec: ev ? { ...ev, endsAt: (ev.endsAt || '').slice(0, 16) } : null,
      url: `${A}/events`, onSaved: events,
      extraHtml: printOptionsEditor(ev?.printOptions || [{ type: 'magnet', size: '6x9' }]), collectExtra: collectPrintOptions,
    });
    bindPrintOptions();
  }

  async function events(arg) {
    const list = await api(`${A}/events`);
    view.innerHTML = `<div class="row between"><h1>אירועים ו-QR</h1><button class="btn" id="new-ev">➕ אירוע חדש</button></div>
      <div class="grid">${list.map((e) => `<div class="card stack">
        <div class="row between"><h3 style="margin:0">${esc(e.name)}</h3>${ACTIVE(e.active)}</div>
        <div class="muted small">${esc(e.type || '')} · ${e.date ? new Date(e.date).toLocaleDateString('he-IL') : ''}</div>
        <canvas data-qr="${esc(e.link)}" aria-label="קוד QR לאירוע" style="width:160px;height:160px;margin:0 auto;background:#fff;border-radius:8px"></canvas>
        <div class="small">🔗 <a href="${esc(e.link)}" target="_blank">${esc(e.link)}</a></div>
        <div class="small">📸 ${e.photosPerGuest} תמונות לאורח · 👥 ${e.guests} אורחים · 🖨️ ${e.photos} הדפסות</div>
        <div class="small">${e.printOptions.map((o) => `<span class="badge primary">${o.frame ? '🖼️ ' : ''}${esc(o.label)}</span>`).join(' ')}</div>
        <button class="btn gold sm" data-frame="${e.id}">🖼️ ${e.printOptions.some((o) => o.frame) ? 'מסגרת האירוע ✓ (החלפה)' : 'מסגרת לאירוע'}</button>
        <div class="row"><button class="btn sm" data-photos="${e.id}">תמונות להדפסה</button><button class="btn soft sm" data-edit="${e.id}">עריכה</button>
        <button class="btn ghost sm" data-qrdl="${esc(e.link)}" data-name="qr-${esc(e.code)}.png">הורדת QR</button></div>
      </div>`).join('') || '<p class="muted">אין אירועים עדיין</p>'}</div>`;
    $('#new-ev').onclick = () => editEvent(null);
    if (arg === 'new') editEvent(null);
    $$('[data-edit]').forEach((b) => { b.onclick = () => editEvent(list.find((e) => e.id === b.dataset.edit)); });
    $$('[data-photos]').forEach((b) => { b.onclick = () => eventPhotos(list.find((e) => e.id === b.dataset.photos)); });
    $$('[data-frame]').forEach((b) => { b.onclick = () => eventFrames(list.find((e) => e.id === b.dataset.frame)); });
    $$('canvas[data-qr]').forEach((c) => drawQR(c, c.dataset.qr));
    if (arg && arg.frameFor) { const ev = list.find((e) => e.id === arg.frameFor); if (ev) eventFrames(ev); }
  }

  // 🖼️ מסגרת האירוע: PNG עם חלון שקוף לכל אפשרות הדפסה. האורח שסורק את ה-QR עורך את התמונה כבר בתוך המסגרת
  function eventFrames(ev) {
    const px = (size) => { const m = String(size).match(/([\d.]+)x([\d.]+)/); return m ? `${Math.round(m[1] * 200)}×${Math.round(m[2] * 200)}` : ''; };
    openModal(`<div class="row between"><h2 style="margin:0">🖼️ מסגרת לאירוע: ${esc(ev.name)}</h2><button class="icon-btn" data-close aria-label="סגירה">✕</button></div>
      <p class="muted">מעלים קובץ PNG של המסגרת, עם חלון שקוף במקום שבו תהיה התמונה. האורחים שסורקים את ה-QR יערכו את התמונה כבר בתוך המסגרת, והיא תודפס איתה.</p>
      <div class="stack">${ev.printOptions.map((o, i) => `<div class="card flat row" style="align-items:center;gap:14px">
        <span class="po-frame-prev" style="width:84px;height:112px">${o.frame ? `<img src="${esc(asset(o.frame))}" alt="">` : 'אין'}</span>
        <div style="flex:1;min-width:180px"><b>${esc(o.label)}</b><div class="muted small">גודל ${esc(o.size)} ס"מ · מומלץ PNG בגודל ${px(o.size)} פיקסלים (אותו יחס)</div></div>
        <div class="row" style="gap:6px"><label class="btn ${o.frame ? 'soft' : 'gold'} sm" style="margin:0">${o.frame ? 'החלפת מסגרת' : '⬆️ העלאת מסגרת'}<input type="file" accept="image/png,image/webp" class="hidden" data-fr-up="${i}"></label>
        ${o.frame ? `<button class="btn ghost sm" data-fr-del="${i}">הסרה</button>` : ''}</div></div>`).join('')}</div>`);
    const save = async (opts, msg) => {
      try {
        await api(`${A}/events/${ev.id}`, { method: 'PUT', body: { ...ev, printOptions: opts } });
        toast(msg);
        events({ frameFor: ev.id });
      } catch (err) { toast(err.message); }
    };
    $$('[data-fr-up]').forEach((inp) => {
      inp.onchange = async () => {
        const f = inp.files[0]; const i = Number(inp.dataset.frUp); const o = ev.printOptions[i];
        if (!f) return;
        try {
          toast('מעלה את המסגרת…');
          const dims = await new Promise((res) => { const u = URL.createObjectURL(f); const im = new Image(); im.onload = () => { res([im.naturalWidth, im.naturalHeight]); URL.revokeObjectURL(u); }; im.onerror = () => res(null); im.src = u; });
          const m = String(o.size).match(/([\d.]+)x([\d.]+)/);
          if (dims && m) {
            const want = m[1] / m[2]; const got = dims[0] / dims[1];
            if (Math.abs(got - want) > 0.03 && Math.abs(got - 1 / want) > 0.03) toast(`שימו לב: המסגרת ביחס ${dims[0]}×${dims[1]} ולא ${o.size}. היא תימתח לגודל ההדפסה.`);
          }
          const fd = new FormData();
          fd.append('file', f.size > 1.8e6 ? await shrinkPng(f) : f, 'frame.png');
          const up = await api(`${A}/uploads`, { method: 'POST', body: fd });
          await save(ev.printOptions.map((x, j) => (j === i ? { ...x, frame: up.url } : x)), 'המסגרת נשמרה ✓ האורחים כבר רואים אותה');
        } catch (err) { toast(err.message); }
      };
    });
    $$('[data-fr-del]').forEach((b) => { b.onclick = () => save(ev.printOptions.map((x, j) => (j === Number(b.dataset.frDel) ? { ...x, frame: '' } : x)), 'המסגרת הוסרה'); });
  }

  // ---------- QR (נוצר בדפדפן, js/qrcode.js) ----------
  function drawQR(canvas, text, px = 800) {
    const Q = window.qrcode(0, 'M');
    Q.addData(text);
    Q.make();
    const n = Q.getModuleCount(); const margin = 4; const k = Math.max(4, Math.floor(px / (n + margin * 2)));
    canvas.width = canvas.height = (n + margin * 2) * k;
    const x = canvas.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, canvas.width, canvas.height); x.fillStyle = '#111';
    for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) if (Q.isDark(r, col)) x.fillRect((col + margin) * k, (r + margin) * k, k, k);
    return canvas;
  }

  function saveBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  document.addEventListener('click', async (e) => {
    const q = e.target.closest('[data-qrdl]');
    if (q) drawQR(document.createElement('canvas'), q.dataset.qrdl, 1200).toBlob((b) => saveBlob(b, q.dataset.name));
    const d = e.target.closest('[data-dl]');
    if (d) {
      try { saveBlob(await (await fetch(d.dataset.dl)).blob(), d.dataset.name); } catch { window.open(d.dataset.dl, '_blank', 'noopener'); }
    }
  });

  async function eventPhotos(ev) {
    const photos = await api(`${A}/events/${ev.id}/photos`);
    const st = { pending: 'ממתין', printing: 'בהדפסה', printed: 'הודפס', delivered: 'נמסר', rejected: 'נדחה' };
    view.innerHTML = `<div class="row between"><h1>תמונות - ${esc(ev.name)}</h1><button class="btn ghost" id="back">← חזרה</button></div>
      <div class="tabs" style="margin-bottom:12px"><button class="tab active" data-f="all">הכול</button>${Object.entries(st).map(([k, v]) => `<button class="tab" data-f="${k}">${v}</button>`).join('')}<button class="tab" data-f="animation">אנימציות</button></div>
      <div class="grid" id="ph">${photos.map((p) => `<div class="card flat stack" data-st="${p.kind === 'animation' ? 'animation' : p.printStatus}">
        <a href="${esc(asset(p.url))}" target="_blank" rel="noopener" class="photo-tile">${p.kind === 'animation' ? `<video src="${esc(asset(p.url))}" muted loop autoplay playsinline></video>` : `<img src="${esc(asset(p.url))}" loading="lazy" alt="">`}</a>
        <div class="small"><b>${esc(p.guestName || '')}</b> ${esc(p.guestPhone || '')}<br>${esc(p.printOption)} · ${fmtDate(p.createdAt)}${p.editsApplied ? `<br><span class="muted">עריכות: ${esc(p.editsApplied)}</span>` : ''}</div>
        ${p.kind === 'print' ? `<select data-photo="${p.id}">${Object.entries(st).map(([k, v]) => `<option value="${k}" ${k === p.printStatus ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <button class="btn soft sm" data-dl="${esc(asset(p.url))}" data-name="${esc((p.guestName || 'photo') + '-' + p.id)}.jpg">⬇️ הורדה להדפסה</button>` : ''}
      </div>`).join('') || '<p class="muted">אין תמונות עדיין</p>'}</div>`;
    $('#back').onclick = events;
    $$('[data-photo]').forEach((s) => {
      s.onchange = async () => { await api(`${A}/photos/${s.dataset.photo}`, { method: 'PATCH', body: { printStatus: s.value } }); s.closest('[data-st]').dataset.st = s.value; toast('עודכן'); };
    });
    $$('[data-f]').forEach((t) => {
      t.onclick = () => {
        $$('[data-f]').forEach((x) => x.classList.toggle('active', x === t));
        $$('#ph [data-st]').forEach((c) => { c.style.display = t.dataset.f === 'all' || c.dataset.st === t.dataset.f ? '' : 'none'; });
      };
    });
  }

  // ---------- הזמנות ומשלוחים ----------
  async function orders(filter = 'open') {
    const city = $('#o-city')?.value || '';
    const list = await api(`${A}/orders?filter=${filter}${city ? `&city=${encodeURIComponent(city)}` : ''}`);
    view.innerHTML = `<h1>הזמנות ומשלוחים</h1>
      <div class="row" style="margin-bottom:12px"><div class="tabs">${[['open', 'פתוחות'], ['stuck', '⚠️ תקועות'], ['all', 'הכול']].map(([k, v]) => `<button class="tab${k === filter ? ' active' : ''}" data-of="${k}">${v}</button>`).join('')}</div>
      <select id="o-city" style="max-width:220px"><option value="">כל הערים</option>${cityOpts().map((c) => `<option ${c.value === city ? 'selected' : ''}>${esc(c.value)}</option>`).join('')}</select></div>
      <div class="card table-wrap"><table><thead><tr><th>#</th><th>תאריך</th><th>לקוח</th><th>עיר</th><th>סכום</th><th>סטטוס</th><th>זמן בסטטוס</th><th>ספק / שליח</th></tr></thead><tbody>
      ${list.map((o) => `<tr class="${o.stuck ? 'stuck' : ''}" data-order="${o.id}" style="cursor:pointer">
        <td><b>${o.number}</b></td><td class="small">${fmtDate(o.createdAt)}</td><td>${esc(o.customer.name)}<div class="muted small">${esc(o.customer.phone)}</div></td>
        <td>${esc(o.customer.city)}</td><td>${money(o.total)}</td>
        <td><span class="badge ${o.stuck ? 'bad' : o.status === 'delivered' ? 'ok' : 'primary'}">${esc(o.statusName)}</span>${o.stuck ? '<div class="small" style="color:var(--bad)">⚠️ תקוע</div>' : ''}</td>
        <td class="small">${o.hoursInStatus} ש׳${o.slaHours != null ? ` / ${o.slaHours}` : ''}</td>
        <td class="small">${o.items.map((i) => esc(i.supplier?.name || '❗ ללא ספק')).filter((v, i, a) => a.indexOf(v) === i).join(', ')}<br>${o.courier ? `🛵 ${esc(o.courier.name)}` : '❗ ללא שליח'}</td>
      </tr>`).join('') || '<tr><td colspan="8" class="muted">אין הזמנות</td></tr>'}</tbody></table></div>`;
    $$('[data-of]').forEach((t) => { t.onclick = () => orders(t.dataset.of); });
    $('#o-city').onchange = () => orders(filter);
    $$('[data-order]').forEach((r) => { r.onclick = () => orderDetail(r.dataset.order, () => orders(filter)); });
  }

  // הודעת וואטסאפ מוכנה ללקוח, עם הסטטוס וקישור המעקב
  function waLink(o) {
    const d = String(o.customer.phone || '').replace(/\D/g, '');
    const phone = d.startsWith('0') ? `972${d.slice(1)}` : d;
    const text = `שלום ${o.customer.name}, כאן ${ref.settings.businessName || 'פריים אירועים'} 💐\nהזמנה #${o.number}: ${o.statusName}.\nאפשר לעקוב כאן: ${o.trackUrl}`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  }

  async function orderDetail(id, back) {
    const o = await api(`${A}/orders/${id}`);
    const supSel = (idx, i) => {
      const fit = ref.suppliers.filter((s) => s.active !== false && (s.categories || []).includes(i.category));
      return `<select data-sup="${idx}"><option value="">— ללא —</option>${fit.map((s) => `<option value="${s.id}" ${s.id === i.supplierId ? 'selected' : ''}>${esc(s.name)} (${esc((s.cities || []).slice(0, 3).join(', '))})</option>`).join('')}</select>`;
    };
    openModal(`<div class="row between"><h2 style="margin:0">הזמנה #${o.number}</h2><button class="icon-btn" data-close>✕</button></div>
      <p><span class="badge ${o.stuck ? 'bad' : 'primary'}">${esc(o.statusName)}</span> ${o.stuck ? `<b style="color:var(--bad)">⚠️ תקוע ${o.hoursInStatus} שעות (יעד: ${o.slaHours ?? '-'})</b>` : ''}</p>
      <div class="fields"><div><b>${esc(o.customer.name)}</b><br>${esc(o.customer.phone)}<br>${esc(o.customer.email)}</div>
      <div>${esc(o.customer.address)}, <b>${esc(o.customer.city)}</b>${o.customer.notes ? `<br><span class="muted">הערת לקוח: ${esc(o.customer.notes)}</span>` : ''}</div></div>
      <h3 style="margin-top:12px">פריטים וספקים</h3>
      ${o.items.map((i, idx) => `<div class="row" style="margin-bottom:6px">${i.photoUrl ? `<a href="${esc(asset(i.photoUrl))}" target="_blank" rel="noopener"><img src="${esc(asset(i.photoUrl))}" style="width:48px;height:48px;object-fit:cover;border-radius:6px" alt=""></a>` : ''}
        <span style="flex:1">${esc(i.name)} × ${i.qty} · ${money(i.price * i.qty)}${i.promo ? ` <span class="badge bad">🏷️ ${esc(i.promo)}</span>` : ''}<div class="muted small">${catName(i.category)}</div></span>${supSel(idx, i)}</div>`).join('')}
      ${o.reward ? `<p class="small">💎 מימוש נקודות: <b>${esc(o.reward.name)}</b> (${o.reward.points} נק׳)</p>` : ''}${o.loyaltyEarned ? `<p class="small">💎 נצברו ${o.loyaltyEarned} נקודות</p>` : ''}
      <p class="small">סכום: <b>${money(o.total)}</b>${o.discount ? ` (הנחה ${money(o.discount)}${o.coupon ? `, קופון <b dir="ltr">${esc(o.coupon)}</b>` : ''})` : ''} · משלוח ${o.shipping ? money(o.shipping) : 'חינם'}</p>
      <div class="row"><label style="margin:0">שליח</label><select id="courier-sel" style="max-width:300px"><option value="">— ללא —</option>${ref.couriers.filter((k) => k.active !== false).map((k) => `<option value="${k.id}" ${k.id === o.courierId ? 'selected' : ''}>${esc(k.name)} ${esc(k.phone)}</option>`).join('')}</select>
        <button class="btn soft sm" id="save-assign">שמירת שיוך</button><button class="btn ghost sm" id="auto-assign">🔄 שיוך אוטומטי לפי עיר</button></div>
      <p class="small">🔗 קישור מעקב ללקוח: <a href="${esc(o.trackUrl)}" target="_blank">פתיחה</a> <button class="btn ghost sm" id="copy-track">העתקה</button>
        <a class="btn sm wa" target="_blank" rel="noopener" href="${esc(waLink(o))}">${icon('whatsapp')}וואטסאפ ללקוח</a></p>
      <h3>עדכון סטטוס / הערה</h3>
      <div class="fields"><select id="ev-status"><option value="">— הערה בלבד —</option>${ref.statuses.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>
      <input id="ev-note" placeholder="הערה (למשל: תקוע אצל הספק - חסר חומר)"></div>
      <div class="row" style="margin-top:8px"><label class="check"><input type="checkbox" id="ev-public"> הצגת ההערה ללקוח</label><span class="spacer"></span><button class="btn" id="add-ev">עדכון</button></div>
      <h3 style="margin-top:12px">ציר זמן</h3>
      <ul class="timeline">${o.timeline.slice().reverse().map((t) => `<li class="${t.status ? '' : 'note'}"><b>${esc(t.status ? (ref.statuses.find((s) => s.id === t.status)?.name || t.status) : 'הערה')}</b>
        ${t.internal ? '<span class="badge">פנימי</span>' : ''}${t.publicNote ? '<span class="badge ok">גלוי ללקוח</span>' : ''}
        ${t.note ? `<div>${esc(t.note)}</div>` : ''}<time>${fmtDate(t.at)} · ${esc(t.by)}</time></li>`).join('')}</ul>`);
    const reload = () => { orderDetail(id, back); back(); };
    $('#add-ev').onclick = async () => {
      try {
        await api(`${A}/orders/${id}/events`, { method: 'POST', body: { status: $('#ev-status').value, note: $('#ev-note').value, publicNote: $('#ev-public').checked } });
        toast('עודכן ✓'); reload();
      } catch (e) { toast(e.message); }
    };
    $('#save-assign').onclick = async () => {
      const suppliers = Object.fromEntries($$('[data-sup]').map((s) => [s.dataset.sup, s.value]));
      await api(`${A}/orders/${id}/assign`, { method: 'POST', body: { suppliers, courierId: $('#courier-sel').value } });
      toast('השיוך נשמר'); reload();
    };
    $('#auto-assign').onclick = async () => { await api(`${A}/orders/${id}/assign`, { method: 'POST', body: { auto: true } }); toast('שויך מחדש'); reload(); };
    $('#copy-track').onclick = () => navigator.clipboard.writeText(o.trackUrl).then(() => toast('הועתק'));
  }

  // ---------- מוצרים ----------
  const productImgs = (p) => (p.images && p.images.length ? p.images : (p.image ? [p.image] : []));

  // ניהול תמונות למוצר: העלאה (כמה בבת אחת), הסרה, וקביעת תמונה ראשית
  function imagesEditor(list) {
    return `<div class="card flat" style="margin-top:12px"><h3>📷 תמונות המוצר <small class="muted">(הראשונה מוצגת בחנות, עד 12)</small></h3>
      <div class="img-edit" id="img-list">${list.map((u) => imgChip(u)).join('')}</div>
      <div class="row" style="margin-top:8px">
        <label class="btn soft sm" for="img-up" style="margin:0">⬆️ הוספת תמונות</label>
        <input type="file" id="img-up" accept="image/*" multiple class="hidden">
        <span class="muted small" id="img-busy"></span>
      </div></div>`;
  }
  const imgChip = (u) => `<div class="img-chip" data-url="${esc(u)}"><img src="${esc(asset(u))}" alt="">
    <button type="button" data-img="first" title="תמונה ראשית">⭐</button><button type="button" data-img="del" title="הסרה">✕</button></div>`;

  function bindImages() {
    const box = $('#img-list');
    box.onclick = (e) => {
      const b = e.target.closest('[data-img]');
      if (!b) return;
      const chip = b.closest('.img-chip');
      if (b.dataset.img === 'del') chip.remove();
      if (b.dataset.img === 'first') box.prepend(chip);
    };
    $('#img-up').onchange = async (e) => {
      const files = [...e.target.files].slice(0, 12);
      e.target.value = '';
      for (const [i, f] of files.entries()) {
        if ($$('.img-chip', box).length >= 12) { toast('עד 12 תמונות למוצר'); break; }
        $('#img-busy').textContent = `מעלה ${i + 1}/${files.length}…`;
        try {
          const fd = new FormData();
          fd.append('file', await shrinkImage(f, 1600, 0.86), 'product.jpg');
          const r = await api(`${A}/uploads`, { method: 'POST', body: fd });
          box.insertAdjacentHTML('beforeend', imgChip(r.url));
        } catch (err) { toast(err.message); }
      }
      $('#img-busy').textContent = '';
    };
  }
  const collectImages = (form) => ({ images: $$('#img-list .img-chip', form).map((c) => c.dataset.url) });

  // גדלים/אפשרויות: לכל גודל מחיר משלו (למשל מגנט 5x7.5 / 6x9 / 10x15)
  const variantRow = (v = {}) => `<div class="fields var-row" style="align-items:end;margin-bottom:6px">
    <div><label>גודל / אפשרות</label><input class="var-name" value="${esc(v.name || '')}" placeholder='למשל 10x15 ס"מ' maxlength="40"></div>
    <div><label>מחיר (₪)</label><input class="var-price" type="number" step="0.01" min="0" value="${v.price ?? ''}"></div>
    <div><button type="button" class="btn ghost sm var-del">הסרה</button></div></div>`;
  function variantsEditor(list) {
    return `<div class="card flat" style="margin-top:12px"><h3>📐 גדלים ומחירים <small class="muted">(לא חובה: בלי גדלים יש מחיר אחד)</small></h3>
      <div id="var-list">${list.map(variantRow).join('')}</div><button type="button" class="btn soft sm" id="var-add">${icon('plus')}הוספת גודל</button></div>`;
  }
  function bindVariants() {
    $('#var-add').onclick = () => { if ($$('.var-row').length < 8) $('#var-list').insertAdjacentHTML('beforeend', variantRow()); };
    $('#var-list').onclick = (e) => { if (e.target.closest('.var-del')) e.target.closest('.var-row').remove(); };
  }
  const collectVariants = (form) => ({
    variants: $$('.var-row', form).map((r) => ({ name: $('.var-name', r).value.trim(), price: Number($('.var-price', r).value) })).filter((v) => v.name),
  });

  async function products() {
    const [list, store] = await Promise.all([api(`${A}/products`), api('/api/store').catch(() => ({ products: [] }))]);
    const sale = Object.fromEntries(store.products.filter((p) => p.promo).map((p) => [p.id, p]));
    const fields = [
      { k: 'name', label: 'שם המוצר' }, { k: 'price', label: 'מחיר רגיל (₪)', type: 'number', step: '0.01' },
      { k: 'category', label: 'קטגוריה', type: 'select', options: catOpts() }, { k: 'icon', label: 'אייקון (כשאין תמונה)' },
      { k: 'description', label: 'תיאור', type: 'textarea', full: true },
      { k: 'collectionIds', label: 'שיוך לקולקציה עונתית (המוצר יוצג רק בזמן הקולקציה)', type: 'checks', options: ref.collections.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` })) },
      { k: 'eventTypes', label: 'מתאים לאירועים (בלי סימון = לכל האירועים)', type: 'checks', options: (ref.eventTypes || []).map((e) => ({ value: e.id, label: e.name })) },
      { k: 'needsPhoto', label: 'המוצר דורש תמונה מהלקוח', type: 'bool', def: false }, { k: 'upsell', label: 'להציע בסל ("אולי תאהבו גם")', type: 'bool', def: false },
      { k: 'active', label: 'פעיל', type: 'bool' },
    ];
    view.innerHTML = `<div class="row between"><h1>מוצרים</h1><div class="row"><button class="btn soft" id="cat-photos">${icon('image')}תמונות קטגוריות</button><button class="btn soft" id="ev-photos">${icon('image')}תמונות אירועים</button><button class="btn soft" data-go-promos>${icon('tag')}מבצעים</button><button class="btn" id="new">${icon('plus')}מוצר חדש</button></div></div>
      <p class="muted small">את המחיר אפשר לשנות ישר בטבלה. מחיר מבצע נקבע במסך "מבצעים".</p>
      <div class="card table-wrap"><table><thead><tr><th></th><th>שם</th><th>קטגוריה</th><th>מחיר רגיל</th><th>במבצע</th><th>סטטוס</th></tr></thead><tbody>
      ${list.map((p) => {
        const img = productImgs(p)[0];
        const s = sale[p.id];
        return `<tr data-id="${p.id}" style="cursor:pointer">
        <td>${img ? `<img src="${esc(asset(img))}" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:8px">` : `<span style="font-size:1.6rem">${esc(p.icon)}</span>`}</td>
        <td>${esc(p.name)}<div class="muted small">${productImgs(p).length} תמונות${(p.variants || []).length ? ` · ${p.variants.length} גדלים` : ''}${p.upsell ? ' · מוצע בסל' : ''}</div></td><td>${catName(p.category)}</td>
        <td><input type="number" step="0.01" min="0" value="${p.price}" data-price="${p.id}" aria-label="מחיר" style="width:100px;min-height:36px;padding:4px 8px"></td>
        <td>${s ? `<b style="color:var(--bad)">${money(s.salePrice)}</b><div class="small">${esc(s.promo.name)}</div>` : '<span class="muted">—</span>'}</td>
        <td>${ACTIVE(p.active)}</td></tr>`;
      }).join('')}</tbody></table></div>`;
    const open = (rec) => {
      editForm({
        title: rec ? 'עריכת מוצר' : 'מוצר חדש', fields, rec: rec ? { ...rec, needsPhoto: rec.needsPhoto || false, upsell: rec.upsell || false } : { needsPhoto: false, upsell: false },
        url: `${A}/products`, onSaved: products,
        extraHtml: variantsEditor(rec ? rec.variants || [] : []) + imagesEditor(rec ? productImgs(rec) : []),
        collectExtra: (form) => ({ ...collectImages(form), ...collectVariants(form) }),
      });
      bindImages();
      bindVariants();
    };
    $('#new').onclick = () => open(null);
    $('[data-go-promos]').onclick = () => go('promotions');
    $('#cat-photos').onclick = categoryPhotos;
    $('#ev-photos').onclick = eventTypePhotos;
    // עריכת מחיר ישר מהטבלה
    $$('[data-price]').forEach((inp) => {
      inp.onclick = (e) => e.stopPropagation();
      inp.onchange = async () => {
        const p = list.find((x) => x.id === inp.dataset.price);
        try {
          await api(`${A}/products/${p.id}`, { method: 'PUT', body: { ...p, price: Number(inp.value) } });
          p.price = Number(inp.value);
          toast(`המחיר של "${p.name}" עודכן ל-${money(p.price)}`);
        } catch (err) { toast(err.message); }
      };
    });
    $$('tr[data-id]').forEach((r) => { r.onclick = () => open(list.find((p) => p.id === r.dataset.id)); });
  }

  // תמונות הקטגוריות בחנות: תמונה משלכם במקום תמונת ברירת המחדל
  async function categoryPhotos() {
    const cats = await api(`${A}/categories`);
    PHOTOS.setCustom(cats);
    openModal(`<div class="row between"><h2 style="margin:0">תמונות קטגוריות</h2><button class="icon-btn" data-close aria-label="סגירה">✕</button></div>
      <p class="muted">אלה התמונות שעל כפתורי הקטגוריות ועל מוצרים בלי תמונה. אפשר להעלות צילום משלכם לכל קטגוריה.</p>
      <div class="grid sm">${cats.map((c) => `<div class="card flat stack" style="padding:10px">
        <div class="photo-tile" style="aspect-ratio:4/3">${PHOTOS.img(c.id, c.name, 400, 300)}</div>
        <b>${esc(c.icon)} ${esc(c.name)}</b>
        <label class="btn soft sm" style="margin:0">${icon('image')}החלפת תמונה<input type="file" accept="image/*" data-cat-up="${esc(c.id)}" class="hidden"></label>
        ${c.image ? `<button class="btn ghost sm" data-cat-reset="${esc(c.id)}">חזרה לתמונה המקורית</button>` : ''}
      </div>`).join('')}</div>`);
    $$('[data-cat-up]').forEach((inp) => {
      inp.onchange = async () => {
        const f = inp.files[0];
        if (!f) return;
        try {
          const fd = new FormData();
          fd.append('file', await shrinkImage(f, 1200, 0.86), 'category.jpg');
          const up = await api(`${A}/uploads`, { method: 'POST', body: fd });
          await api(`${A}/categories/${inp.dataset.catUp}`, { method: 'PUT', body: { image: up.url } });
          toast('התמונה הוחלפה');
          categoryPhotos();
        } catch (err) { toast(err.message); }
      };
    });
    $$('[data-cat-reset]').forEach((b) => {
      b.onclick = async () => { await api(`${A}/categories/${b.dataset.catReset}`, { method: 'PUT', body: { image: '' } }); categoryPhotos(); };
    });
  }

  // תמונות "קנו לפי אירוע": לכל סוג אירוע תמונה משלכם
  async function eventTypePhotos() {
    const list = await api(`${A}/event-types`);
    ref.eventTypes = list;
    openModal(`<div class="row between"><h2 style="margin:0">תמונות אירועים</h2><button class="icon-btn" data-close aria-label="סגירה">✕</button></div>
      <p class="muted">התמונות של "קנו לפי אירוע" בחנות. מעלים צילום משלכם לכל סוג אירוע (חתונה, בת מצווה, חינה…).</p>
      <div class="grid sm">${list.map((e) => `<div class="card flat stack" style="padding:10px">
        <div class="photo-tile" style="aspect-ratio:4/5"><img src="${esc(asset(e.image))}" alt="${esc(e.name)}" loading="lazy"></div>
        <b>${esc(e.name)}</b>
        <label class="btn soft sm" style="margin:0">${icon('image')}החלפת תמונה<input type="file" accept="image/*" data-ev-up="${esc(e.id)}" class="hidden"></label>
        ${e.custom ? `<button class="btn ghost sm" data-ev-reset="${esc(e.id)}">חזרה לתמונה המקורית</button>` : ''}
      </div>`).join('')}</div>`);
    $$('[data-ev-up]').forEach((inp) => {
      inp.onchange = async () => {
        const f = inp.files[0];
        if (!f) return;
        try {
          const fd = new FormData();
          fd.append('file', await shrinkImage(f, 1200, 0.86), 'event.jpg');
          const up = await api(`${A}/uploads`, { method: 'POST', body: fd });
          await api(`${A}/event-types/${inp.dataset.evUp}`, { method: 'PUT', body: { image: up.url } });
          toast('התמונה הוחלפה');
          eventTypePhotos();
        } catch (err) { toast(err.message); }
      };
    });
    $$('[data-ev-reset]').forEach((b) => {
      b.onclick = async () => { await api(`${A}/event-types/${b.dataset.evReset}`, { method: 'PUT', body: { image: '' } }); eventTypePhotos(); };
    });
  }

  // ---------- מועדון נקודות ----------
  async function clubView() {
    const [data, rewards, prods] = await Promise.all([api(`${A}/loyalty`), api(`${A}/rewards`), api(`${A}/products`)]);
    const s = data.settings;
    const rewardFields = [
      { k: 'name', label: 'שם ההטבה (למשל: ₪30 הנחה, מגנט מתנה)' }, { k: 'description', label: 'תיאור קצר' },
      { k: 'kind', label: 'סוג', type: 'select', options: [{ value: 'discount', label: 'הנחה בשקלים על ההזמנה' }, { value: 'gift', label: 'מתנה: מוצר בחינם' }] },
      { k: 'amount', label: 'סכום ההנחה ב-₪ (להנחה)', type: 'number' },
      { k: 'productId', label: 'המוצר במתנה (למתנה)', type: 'select', options: [{ value: '', label: '—' }].concat(prods.map((p) => ({ value: p.id, label: p.name }))) },
      { k: 'points', label: 'עלות בנקודות', type: 'number' }, { k: 'active', label: 'פעיל', type: 'bool' },
    ];
    view.innerHTML = `<div class="stage" style="grid-template-columns:1fr"><div>
        <span class="eyebrow"><img src="icon.svg" alt="">מועדון פריים</span>
        <h1>💎 נקודות, <em>הנחות ומתנות</em></h1>
        <p>על כל הזמנה ששולמה הלקוח צובר ${s.earnPercent}% מסכום המוצרים בנקודות (נקודה = ₪1). מ-${s.minPoints} נקודות הוא מממש אותן בהטבות שתגדירו כאן.</p>
      </div></div>
      <form class="card" id="club-settings"><h2>הגדרות</h2><div class="fields">
        <div class="field"><label class="check" style="margin-top:28px"><input type="checkbox" name="enabled" ${s.enabled ? 'checked' : ''}> המועדון פעיל</label></div>
        <div class="field"><label>אחוז צבירה מכל קנייה</label><input type="number" name="earnPercent" min="0" max="100" step="0.5" value="${s.earnPercent}"></div>
        <div class="field"><label>מינימום נקודות למימוש</label><input type="number" name="minPoints" min="0" value="${s.minPoints}"></div>
      </div><button class="btn">שמירה</button></form>
      <div class="row between" style="margin-top:18px"><h2 style="margin:0">הטבות למימוש</h2><button class="btn" id="new-reward">${icon('plus')}הטבה חדשה</button></div>
      <div class="grid" style="margin-top:10px">${rewards.sort((a, b) => a.points - b.points).map((r) => `<div class="card" data-reward="${r.id}" style="cursor:pointer">
        <div class="row between"><h3 style="margin:0">${r.kind === 'gift' ? '🎁' : '🏷️'} ${esc(r.name)}</h3>${ACTIVE(r.active)}</div>
        <p class="muted small">${esc(r.description || '')}</p><b class="stat" style="font-size:1.4rem">${r.points} נק׳</b></div>`).join('') || '<p class="muted">אין הטבות עדיין</p>'}</div>
      <h2 style="margin-top:22px">חברי המועדון (${data.members.length})</h2>
      <div class="card table-wrap"><table><thead><tr><th>שם</th><th>טלפון</th><th>יתרה</th><th>נצבר</th><th>מומש</th><th>פעילות אחרונה</th><th></th></tr></thead><tbody>
      ${data.members.map((m) => `<tr><td>${esc(m.name)}</td><td dir="ltr">${esc(m.phone)}</td><td><b>${m.points}</b></td><td>${m.earned}</td><td>${m.spent}</td><td class="small">${fmtDate(m.lastAt)}</td>
        <td><div class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn soft sm" data-adjust="${m.id}">± נקודות</button>
        <a class="btn sm wa" target="_blank" rel="noopener" href="https://wa.me/${'972' + m.phone.slice(1)}?text=${encodeURIComponent(`שלום ${m.name}, יש לך ${m.points} נקודות במועדון ${ref.settings.businessName || 'פריים אירועים'} 💎\nהכרטיס שלך: ${m.clubLink}`)}">${icon('whatsapp')}</a></div></td></tr>`).join('') || '<tr><td colspan="7" class="muted">עוד אין חברים. החשבון נפתח אוטומטית בהזמנה הראשונה של כל לקוח.</td></tr>'}
      </tbody></table></div>`;
    $('#club-settings').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        ref.settings = await api(`${A}/settings`, { method: 'PUT', body: { ...ref.settings, loyalty: { enabled: f.enabled.checked, earnPercent: Number(f.earnPercent.value), minPoints: Number(f.minPoints.value) } } });
        toast('הגדרות המועדון נשמרו');
        clubView();
      } catch (err) { toast(err.message); }
    };
    const openReward = (rec) => editForm({ title: rec ? 'עריכת הטבה' : 'הטבה חדשה', fields: rewardFields, rec: rec || { kind: 'discount', points: s.minPoints || 100, amount: 20 }, url: `${A}/rewards`, onSaved: clubView });
    $('#new-reward').onclick = () => openReward(null);
    $$('[data-reward]').forEach((c) => { c.onclick = () => openReward(rewards.find((r) => r.id === c.dataset.reward)); });
    $$('[data-adjust]').forEach((b) => {
      b.onclick = async () => {
        const v = prompt('כמה נקודות להוסיף? (מספר שלילי מוריד נקודות)');
        if (!v) return;
        const note = prompt('סיבה (תופיע ללקוח בהיסטוריה):', 'בונוס') || '';
        try { await api(`${A}/loyalty/${b.dataset.adjust}/adjust`, { method: 'POST', body: { points: Number(v), note } }); toast('עודכן'); clubView(); } catch (err) { toast(err.message); }
      };
    });
  }

  // ---------- באנרים (הפתיח המתחלף בחנות) ----------
  async function banners() {
    const [list, prods] = await Promise.all([api(`${A}/banners`), api(`${A}/products`)]);
    const LINK = { none: 'בלי כפתור', category: 'לקטגוריה', event: 'לסוג אירוע', product: 'למוצר', url: 'לקישור חיצוני' };
    const fields = [
      { k: 'name', label: 'כותרת (למשל: עונת החתונות)' }, { k: 'subtitle', label: 'משפט משנה' }, { k: 'cta', label: 'טקסט הכפתור (למשל: לכל מוצרי החתונה)' },
      { k: 'linkType', label: 'לאן הכפתור מוביל', type: 'select', options: Object.entries(LINK).map(([value, label]) => ({ value, label })) },
      { k: 'linkValue', label: 'יעד', type: 'select', options: [{ value: '', label: '—' }]
        .concat(ref.categories.map((c) => ({ value: c.id, label: `קטגוריה: ${c.name}` })))
        .concat((ref.eventTypes || []).map((e) => ({ value: e.id, label: `אירוע: ${e.name}` })))
        .concat(prods.map((p) => ({ value: p.id, label: `מוצר: ${p.name}` }))) },
      { k: 'url', label: 'קישור חיצוני (כשבוחרים "לקישור חיצוני")', type: 'url' },
      { k: 'startDate', label: 'מתאריך (ריק = מעכשיו)', type: 'date' }, { k: 'endDate', label: 'עד תאריך (ריק = בלי סוף)', type: 'date' },
      { k: 'order', label: 'סדר הופעה (מספר קטן = ראשון)', type: 'number' }, { k: 'active', label: 'פעיל', type: 'bool' },
    ];
    const today = new Date().toISOString().slice(0, 10);
    const live = (b) => b.active !== false && (!b.startDate || b.startDate <= today) && (!b.endDate || b.endDate >= today);
    view.innerHTML = `<div class="row between"><h1>באנרים</h1><button class="btn" id="new">${icon('plus')}באנר חדש</button></div>
      <p class="muted">הבאנרים מתחלפים בראש החנות. מתאים למבצעים, חגים וקולקציות חדשות. מומלץ תמונה רחבה ואיכותית.</p>
      <div class="grid">${list.slice().sort((a, b) => (a.order || 0) - (b.order || 0)).map((b) => `<div class="card" data-id="${b.id}" style="cursor:pointer;padding:0;overflow:hidden">
        <div class="banner" style="--img:url('${esc(asset(b.image))}');min-height:150px"><div class="banner-text"><h3>${esc(b.name)}</h3>${b.subtitle ? `<p>${esc(b.subtitle)}</p>` : ''}</div></div>
        <div class="row between" style="padding:10px 14px">${live(b) ? '<span class="badge ok">מוצג עכשיו</span>' : '<span class="badge">לא מוצג</span>'}<span class="muted small">${LINK[b.linkType] || ''}</span></div>
      </div>`).join('') || '<p class="muted">אין באנרים עדיין</p>'}</div>`;
    const open = (rec) => {
      const r0 = rec ? { ...rec, url: rec.linkType === 'url' ? rec.linkValue : '', linkValue: rec.linkType === 'url' ? '' : rec.linkValue } : { linkType: 'category', order: list.length + 1 };
      editForm({
        title: rec ? 'עריכת באנר' : 'באנר חדש', fields, rec: r0, url: `${A}/banners`, onSaved: banners,
        extraHtml: `<div class="card flat" style="margin-top:12px"><h3>📷 תמונת הבאנר</h3>
          <div class="banner" id="bn-preview" style="--img:url('${esc(asset(rec ? rec.image : ''))}');min-height:140px;border-radius:14px"><div class="banner-text"><h3>תצוגה מקדימה</h3></div></div>
          <input type="hidden" id="bn-image" value="${esc(rec ? rec.image : '')}">
          <label class="btn soft sm" style="margin-top:8px">${icon('image')}העלאת תמונה<input type="file" accept="image/*" id="bn-up" class="hidden"></label></div>`,
        collectExtra: (form) => {
          const t = $('[name="linkType"]', form).value;
          return { image: $('#bn-image').value, linkValue: t === 'url' ? $('[name="url"]', form).value : $('[name="linkValue"]', form).value };
        },
      });
      $('#bn-up').onchange = async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try {
          const fd = new FormData();
          fd.append('file', await shrinkImage(f, 1800, 0.85), 'banner.jpg');
          const up = await api(`${A}/uploads`, { method: 'POST', body: fd });
          $('#bn-image').value = up.url;
          $('#bn-preview').style.setProperty('--img', `url('${asset(up.url)}')`);
        } catch (err) { toast(err.message); }
      };
    };
    $('#new').onclick = () => open(null);
    $$('[data-id]').forEach((c) => { c.onclick = () => open(list.find((b) => b.id === c.dataset.id)); });
  }

  // ---------- מבצעים ----------
  const KIND_TXT = { percent: (v) => `${v}% הנחה`, amount: (v) => `${money(v)} הנחה`, price: (v) => `מחיר מבצע ${money(v)}` };
  const SCOPE_TXT = { all: 'כל החנות', category: 'קטגוריות', products: 'מוצרים נבחרים', collection: 'קולקציות' };

  async function promotions() {
    const [list, prods] = await Promise.all([api(`${A}/promotions`), api(`${A}/products`)]);
    const today = new Date().toISOString().slice(0, 10);
    const live = (p) => p.active !== false && (!p.startDate || p.startDate <= today) && (!p.endDate || p.endDate >= today);
    const fields = [
      { k: 'name', label: 'שם המבצע (למשל: מבצע ראש השנה, 1+1 מגנטים)' },
      { k: 'badge', label: 'תווית על המוצר (למשל: 20%- או "מבצע!")' },
      { k: 'kind', label: 'סוג ההנחה', type: 'select', options: [{ value: 'percent', label: 'אחוז הנחה (%)' }, { value: 'amount', label: 'סכום הנחה ליחידה (₪)' }, { value: 'price', label: 'מחיר מבצע קבוע ליחידה (₪)' }] },
      { k: 'value', label: 'ערך (אחוז / ₪)', type: 'number', step: '0.01' },
      { k: 'scope', label: 'על מה המבצע', type: 'select', options: Object.entries(SCOPE_TXT).map(([value, label]) => ({ value, label })) },
      { k: 'categories', label: 'קטגוריות (כשבוחרים "קטגוריות")', type: 'checks', options: catOpts() },
      { k: 'productIds', label: 'מוצרים (כשבוחרים "מוצרים נבחרים")', type: 'checks', options: prods.map((p) => ({ value: p.id, label: `${p.name} (${money(p.price)})` })) },
      { k: 'collectionIds', label: 'קולקציות (כשבוחרים "קולקציות")', type: 'checks', options: ref.collections.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` })) },
      { k: 'startDate', label: 'מתאריך (ריק = מעכשיו)', type: 'date' }, { k: 'endDate', label: 'עד תאריך (ריק = בלי סוף)', type: 'date' },
      { k: 'code', label: 'קוד קופון (ריק = לכולם, בלי קוד)' }, { k: 'minSubtotal', label: 'מינימום הזמנה ב-₪ (0 = בלי)', type: 'number' },
      { k: 'active', label: 'פעיל', type: 'bool' },
    ];
    view.innerHTML = `<div class="row between"><h1>🏷️ מבצעים</h1><button class="btn" id="new">➕ מבצע חדש</button></div>
      <p class="muted">מבצע יכול להיות אחוז, סכום או מחיר קבוע; על כל החנות, קטגוריה, מוצרים או קולקציה; לפי תאריכים; עם קוד קופון או מינימום הזמנה.
      כשכמה מבצעים פתוחים מתאימים, הלקוח מקבל את המחיר הנמוך ביותר. קופון חל בנוסף, על מחיר המבצע.</p>
      <div class="grid">${list.map((p) => `<div class="card" data-id="${p.id}" style="cursor:pointer">
        <div class="row between"><h3 style="margin:0">${esc(p.name)}</h3>${live(p) ? '<span class="badge ok">פעיל עכשיו</span>' : '<span class="badge">לא פעיל</span>'}</div>
        <div style="margin-top:6px"><b>${KIND_TXT[p.kind] ? KIND_TXT[p.kind](p.value) : ''}</b> · ${SCOPE_TXT[p.scope] || ''}</div>
        <div class="muted small">${p.startDate || 'מעכשיו'} ← ${p.endDate || 'בלי סוף'}${p.code ? ` · קופון <b dir="ltr">${esc(p.code)}</b>` : ''}${p.minSubtotal ? ` · מעל ${money(p.minSubtotal)}` : ''}</div>
        ${p.badge ? `<span class="sale-badge" style="position:static;display:inline-block;margin-top:6px">${esc(p.badge)}</span>` : ''}
      </div>`).join('') || '<p class="muted">אין מבצעים עדיין</p>'}</div>`;
    const open = (rec) => editForm({ title: rec ? 'עריכת מבצע' : 'מבצע חדש', fields, rec: rec || { kind: 'percent', scope: 'all', value: 10 }, url: `${A}/promotions`, onSaved: promotions });
    $('#new').onclick = () => open(null);
    $$('[data-id]').forEach((r) => { r.onclick = () => open(list.find((p) => p.id === r.dataset.id)); });
  }

  // ---------- קולקציות ----------
  async function collections() {
    const list = await api(`${A}/collections`);
    ref.collections = list;
    const today = new Date().toISOString().slice(0, 10);
    const live = (c) => c.active && (!c.startDate || c.startDate <= today) && (!c.endDate || c.endDate >= today);
    const fields = [
      { k: 'name', label: 'שם (למשל: חנוכה, כנס רפואה 2027, מבצע קיץ)' }, { k: 'icon', label: 'אייקון' },
      { k: 'kind', label: 'סוג', type: 'select', options: [{ value: 'holiday', label: 'חג' }, { value: 'conference', label: 'כנס' }, { value: 'special', label: 'חבילה מיוחדת / מבצע' }] },
      { k: 'startDate', label: 'מתאריך (ריק = תמיד)', type: 'date' }, { k: 'endDate', label: 'עד תאריך', type: 'date' }, { k: 'active', label: 'פעיל', type: 'bool' },
    ];
    const KIND = { holiday: 'חג', conference: 'כנס', special: 'מיוחד' };
    view.innerHTML = `<div class="row between"><h1>קולקציות עונתיות</h1><button class="btn" id="new">➕ קולקציה חדשה</button></div>
      <p class="muted">מתנות וחבילות לפי המצב: חגים, כנסים וחבילות מיוחדות. מוצרים שמשויכים לקולקציה מוצגים בחנות רק בטווח התאריכים.</p>
      <div class="grid">${list.map((c) => `<div class="card" data-id="${c.id}" style="cursor:pointer"><div class="row between"><h3 style="margin:0">${esc(c.icon)} ${esc(c.name)}</h3>
        ${live(c) ? '<span class="badge ok">מוצג עכשיו</span>' : '<span class="badge">לא מוצג</span>'}</div>
        <div class="muted small">${KIND[c.kind] || ''} · ${c.startDate || '∞'} ← ${c.endDate || '∞'}</div></div>`).join('')}</div>`;
    const open = (rec) => editForm({ title: rec ? 'עריכת קולקציה' : 'קולקציה חדשה', fields, rec, url: `${A}/collections`, onSaved: collections });
    $('#new').onclick = () => open(null);
    $$('[data-id]').forEach((r) => { r.onclick = () => open(list.find((p) => p.id === r.dataset.id)); });
  }

  // ---------- ספקים (לשוניות לפי תחום) ----------
  async function suppliers(cat = 'all') {
    const list = await api(`${A}/suppliers`);
    ref.suppliers = list;
    const fields = [
      { k: 'name', label: 'שם הספק' }, { k: 'contact', label: 'איש קשר' }, { k: 'phone', label: 'טלפון', type: 'tel' }, { k: 'email', label: 'אימייל', type: 'email' },
      { k: 'categories', label: 'תחומים', type: 'checks', options: catOpts() },
      { k: 'cities', label: 'ערים שהספק משרת', type: 'checks', options: cityOpts() },
      { k: 'regions', label: 'אזורים (גיבוי כשאין ספק בעיר)', type: 'checks', options: regionOpts() },
      { k: 'notes', label: 'הערות', type: 'textarea', full: true }, { k: 'active', label: 'פעיל', type: 'bool' },
    ];
    const shown = list.filter((s) => cat === 'all' || (s.categories || []).includes(cat));
    view.innerHTML = `<div class="row between"><h1>ספקים</h1><button class="btn" id="new">➕ ספק חדש</button></div>
      <div class="tabs" style="margin-bottom:12px"><button class="tab${cat === 'all' ? ' active' : ''}" data-cat="all">הכול (${list.length})</button>
      ${ref.categories.map((c) => `<button class="tab${cat === c.id ? ' active' : ''}" data-cat="${c.id}">${c.icon} ${esc(c.name)} (${list.filter((s) => (s.categories || []).includes(c.id)).length})</button>`).join('')}</div>
      <div class="card table-wrap"><table><thead><tr><th>שם</th><th>טלפון</th><th>תחומים</th><th>ערים / אזורים</th><th>סטטוס</th></tr></thead><tbody>
      ${shown.map((s) => `<tr data-id="${s.id}" style="cursor:pointer"><td><b>${esc(s.name)}</b><div class="muted small">${esc(s.contact || '')}</div></td><td>${esc(s.phone)}</td>
        <td class="small">${(s.categories || []).map(catName).join(', ')}</td><td class="small">${esc((s.cities || []).join(', '))}${(s.regions || []).length ? `<br><span class="muted">אזורים: ${esc(s.regions.join(', '))}</span>` : ''}</td><td>${ACTIVE(s.active)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">אין ספקים בתחום זה</td></tr>'}</tbody></table></div>`;
    $$('[data-cat]').forEach((t) => { t.onclick = () => suppliers(t.dataset.cat); });
    const open = (rec) => editForm({ title: rec ? 'עריכת ספק' : 'ספק חדש', fields, rec: rec || { categories: cat === 'all' ? [] : [cat] }, url: `${A}/suppliers`, onSaved: () => suppliers(cat) });
    $('#new').onclick = () => open(null);
    $$('[data-id]').forEach((r) => { r.onclick = () => open(list.find((p) => p.id === r.dataset.id)); });
  }

  // ---------- שליחים (לפי עיר) ----------
  async function couriers(city = '') {
    const list = await api(`${A}/couriers`);
    ref.couriers = list;
    const region = ref.cities.find((c) => c.name === city)?.region;
    const fields = [
      { k: 'name', label: 'שם השליח / חברת השליחויות' }, { k: 'phone', label: 'טלפון', type: 'tel' }, { k: 'vehicle', label: 'סוג רכב' },
      { k: 'cities', label: 'ערים', type: 'checks', options: cityOpts() }, { k: 'regions', label: 'אזורים שלמים', type: 'checks', options: regionOpts() },
      { k: 'notes', label: 'הערות', type: 'textarea', full: true }, { k: 'active', label: 'פעיל', type: 'bool' },
    ];
    const covers = (k) => !city || (k.cities || []).includes(city) || (region && (k.regions || []).includes(region));
    view.innerHTML = `<div class="row between"><h1>שליחים</h1><button class="btn" id="new">➕ שליח חדש</button></div>
      <div class="row" style="margin-bottom:12px"><label style="margin:0">הצגת שליחים שמשרתים את העיר:</label>
      <select id="k-city" style="max-width:240px"><option value="">כל הערים</option>${cityOpts().map((c) => `<option ${c.value === city ? 'selected' : ''}>${esc(c.value)}</option>`).join('')}</select></div>
      <div class="card table-wrap"><table><thead><tr><th>שם</th><th>טלפון</th><th>רכב</th><th>ערים</th><th>אזורים</th><th>סטטוס</th></tr></thead><tbody>
      ${list.filter(covers).map((k) => `<tr data-id="${k.id}" style="cursor:pointer"><td><b>${esc(k.name)}</b>${city ? `<div class="small">${(k.cities || []).includes(city) ? '<span class="badge ok">בעיר</span>' : '<span class="badge warn">באזור</span>'}</div>` : ''}</td>
        <td>${esc(k.phone)}</td><td>${esc(k.vehicle || '')}</td><td class="small">${esc((k.cities || []).join(', '))}</td><td class="small">${esc((k.regions || []).join(', '))}</td><td>${ACTIVE(k.active)}</td></tr>`).join('') || `<tr><td colspan="6"><b style="color:var(--bad)">⚠️ אין שליח שמשרת את ${esc(city)}</b></td></tr>`}</tbody></table></div>
      <h2 style="margin-top:20px">כיסוי לפי אזור</h2><div class="grid">${REGIONS().map((r) => {
        const cs = ref.cities.filter((c) => c.region === r);
        const missing = cs.filter((c) => !list.some((k) => k.active !== false && ((k.cities || []).includes(c.name) || (k.regions || []).includes(r))));
        return `<div class="card flat"><h3>${esc(r)}</h3><div class="small">${cs.length - missing.length}/${cs.length} ערים מכוסות</div>${missing.length ? `<div class="small muted">ללא שליח: ${esc(missing.map((c) => c.name).join(', '))}</div>` : '<span class="badge ok">כיסוי מלא</span>'}</div>`;
      }).join('')}</div>`;
    $('#k-city').onchange = (e) => couriers(e.target.value);
    const open = (rec) => editForm({ title: rec ? 'עריכת שליח' : 'שליח חדש', fields, rec: rec || { cities: city ? [city] : [] }, url: `${A}/couriers`, onSaved: () => couriers(city) });
    $('#new').onclick = () => open(null);
    $$('[data-id]').forEach((r) => { r.onclick = () => open(list.find((p) => p.id === r.dataset.id)); });
  }

  // ---------- ערים ----------
  async function cities() {
    ref.cities = await api(`${A}/cities`);
    view.innerHTML = `<div class="row between"><h1>ערים</h1><button class="btn" id="new">➕ עיר חדשה</button></div>
      <p class="muted">העיר והאזור משמשים לשיוך אוטומטי של ספק ושליח להזמנה.</p>
      <div class="grid">${REGIONS().map((r) => `<div class="card flat"><h3>${esc(r)}</h3><div class="row" style="gap:6px">${ref.cities.filter((c) => c.region === r).map((c) => `<button class="badge" style="border:0;cursor:pointer" data-id="${c.id}">${esc(c.name)}</button>`).join('')}</div></div>`).join('')}</div>`;
    const fields = [{ k: 'name', label: 'שם העיר' }, { k: 'region', label: 'אזור', type: 'select', options: regionOpts() }];
    const open = (rec) => editForm({ title: rec ? 'עריכת עיר' : 'עיר חדשה', fields, rec, url: `${A}/cities`, onSaved: cities });
    $('#new').onclick = () => open(null);
    $$('[data-id]').forEach((r) => { r.onclick = () => open(ref.cities.find((p) => p.id === r.dataset.id)); });
  }

  // ---------- אורחים ----------
  async function guests() {
    const list = await api(`${A}/guests`);
    view.innerHTML = `<h1>אורחים</h1><p class="muted">אורחים שנרשמו דרך QR - בסיס ללקוחות חוזרים.</p>
      <div class="card table-wrap"><table><thead><tr><th>שם</th><th>טלפון</th><th>אירוע</th><th>הסכמה לדיוור</th><th>תאריך</th></tr></thead><tbody>
      ${list.map((g) => `<tr><td>${esc(g.name)}</td><td>${esc(g.phone)}</td><td>${esc(g.eventName || '')}</td><td>${g.marketingConsent ? '✓' : ''}</td><td class="small">${fmtDate(g.createdAt)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  // ---------- סליקה והגדרות ----------
  const TOOL_NAMES = { crop: '✂️ חיתוך וסיבוב', adjust: '🎚️ בהירות וניגודיות', filters: '🎨 פילטרים', ai: '🤖 אפקטי AI', text: '🔤 טקסט וברכה', stickers: '😍 מדבקות', frames: '🖼️ מסגרות', anim: '🎬 אנימציה' };
  const AI_NAMES = { enhance: '✨ שיפור אוטומטי', cartoon: '🎭 קריקטורה', sketch: '✏️ ציור עיפרון', popart: '🟨 פופ ארט', oil: '🖌️ ציור שמן', removebg: '🪄 הסרת רקע' };
  async function settings() {
    const d = await api(`${A}/settings`);
    ref.settings = d.settings; ref.payments = d.payments;
    const s = d.settings;
    const pays = await api(`${A}/payments`);
    const ed = (await api('/api/config')).editor;
    view.innerHTML = `<h1>סליקה והגדרות</h1>
      <div class="card stack">
        <h2>💳 חברת סליקה</h2>
        <p>ספק פעיל: <b>${esc(d.payments.providers.find((p) => p.id === d.payments.active)?.name)}</b>
        ${d.payments.active === 'mock' ? '<span class="badge warn">מצב בדיקה - אין חיוב אמיתי</span>' : d.payments.configured ? '<span class="badge ok">מחובר</span>' : '<span class="badge bad">חסרים פרטי חיבור</span>'}</p>
        <p class="muted small">התשתית מוכנה: הלקוח מועבר לדף תשלום מאובטח של חברת הסליקה, והאישור חוזר לשרת (webhook) לכתובת <code dir="ltr">${esc((API_BASE || location.origin) + '/api/payments/callback')}</code>. לחיבור ספק אמיתי: פתחו חשבון, הוסיפו ב-GitHub את פרטי המסוף כסודות (EVENTS_PAYMENT_PROVIDER, EVENTS_PAYMENT_TERMINAL, EVENTS_PAYMENT_API_KEY), והשלימו את המימוש ב-events-hub/src/payments/index.js.</p>
        <div class="grid">${d.payments.providers.filter((p) => p.id !== 'mock').map((p) => `<div class="card flat stack">
          <h3 style="margin:0">${esc(p.name)} ${p.id === d.payments.active ? '<span class="badge ok">פעיל</span>' : ''}</h3>
          <div class="muted small">${esc(p.notes)}</div>
          <div class="row"><a class="btn sm" href="${esc(p.signupUrl)}" target="_blank" rel="noopener">הרשמה / אתר</a><a class="btn soft sm" href="${esc(p.dashboardUrl)}" target="_blank" rel="noopener">כניסה לממשק</a>
          <button class="btn ghost sm" data-shortcut="${esc(p.dashboardUrl)}">קבע כקיצור דרך</button></div></div>`).join('')}</div>
      </div>
      <form class="card" id="settings-form" style="margin-top:16px">
        <h2>הגדרות כלליות</h2>
        <div class="fields">
          <div class="field"><label>שם העסק</label><input name="businessName" value="${esc(s.businessName)}"></div>
          <div class="field"><label>מחיר משלוח (₪)</label><input name="shippingPrice" type="number" value="${s.shippingPrice}"></div>
          <div class="field"><label>משלוח חינם מעל (₪)</label><input name="freeShippingFrom" type="number" value="${s.freeShippingFrom}"></div>
          <div class="field" style="grid-column:1/-1"><label>קיצור דרך - כתובת ממשק חברת הסליקה (לכפתור למעלה)</label><input name="paymentDashboardUrl" id="dash-url" type="url" value="${esc(s.paymentDashboardUrl)}" placeholder="https://..."></div>
        </div>
        <h3>זמני יעד לכל שלב במשלוח (שעות) - מעבר לזמן ההזמנה תסומן "תקועה"</h3>
        <div class="fields">${Object.entries(s.slaHours || {}).map(([k, v]) => `<div class="field"><label>${esc(ref.statuses.find((x) => x.id === k)?.name || k)}</label><input type="number" data-sla="${k}" value="${v}"></div>`).join('')}</div>
        <button class="btn">שמירה</button>
      </form>
      <form class="card" id="editor-form" style="margin-top:16px">
        <h2>🎨 עורך התמונות ללקוחות</h2>
        <p class="muted small">אתם קובעים מה הלקוח יכול לעשות בתמונה, גם באירוע וגם בחנות: חיתוך לגודל המוצר, אפקטי AI, פילטרים, טקסט, מדבקות, מסגרות ואנימציה.</p>
        <label class="check"><input type="checkbox" name="store" ${ed.store ? 'checked' : ''}> עריכת תמונה גם בחנות (לפני הוספה לסל, וגם מתוך הסל)</label>
        <h3>כלים פתוחים</h3>
        <div class="tool-toggles">${Object.entries(TOOL_NAMES).map(([k, n]) => `<label class="check"><input type="checkbox" data-tool="${k}" ${ed.tools[k] ? 'checked' : ''}> ${n}</label>`).join('')}</div>
        <h3>אפקטי AI</h3>
        <div class="tool-toggles">${Object.entries(AI_NAMES).map(([k, n]) => `<label class="check"><input type="checkbox" data-ai="${k}" ${ed.ai[k] ? 'checked' : ''}> ${n}</label>`).join('')}</div>
        <p class="muted small">אנימציה באירוע נקבעת גם לכל אירוע בנפרד ("לאפשר יצירת אנימציות"). הסרת רקע עובדת רק כשמחובר שירות AI לשרת${ref.aiRemoveBg ? ' ✓ מחובר' : ' (כרגע לא מחובר)'}.</p>
        <h2 style="margin-top:18px">📏 מידות הדפסה</h2>
        <p class="muted small">המידות שאתם מציעים (בס"מ, רוחב x גובה, מופרדות בפסיק). מהן בוחרים את 3 האפשרויות לכל אירוע, ואפשר גם להקליד מידה אחרת. המידה קובעת את יחס החיתוך בעורך. מידות ומחירים של מוצרי החנות נקבעים בכל מוצר (מוצרים ← עריכה ← מידות ומחירים).</p>
        <div class="fields">${ref.printTypes.map((t) => `<div class="field"><label>${esc(t.name)}</label><input dir="ltr" data-sizes="${t.type}" value="${esc(t.sizes.join(', '))}" placeholder="5x7.5, 6x9, 10x15"></div>`).join('')}</div>
        <button class="btn">שמירה</button>
      </form>
      <div class="card table-wrap" style="margin-top:16px"><h2>תשלומים אחרונים</h2><table><thead><tr><th>תאריך</th><th>הזמנה</th><th>סכום</th><th>ספק</th><th>סטטוס</th></tr></thead><tbody>
      ${pays.slice(0, 30).map((p) => `<tr><td class="small">${fmtDate(p.createdAt)}</td><td class="small">${esc(p.orderId)}</td><td>${money(p.amount)}</td><td>${esc(p.provider)}</td><td><span class="badge ${p.status === 'approved' ? 'ok' : p.status === 'declined' || p.status === 'error' ? 'bad' : ''}">${esc(p.status)}</span></td></tr>`).join('')}</tbody></table></div>`;
    $('#editor-form').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      const sizes = Object.fromEntries($$('[data-sizes]', f).map((i) => [i.dataset.sizes, i.value.split(/[,،\n]+/).map((x) => x.trim()).filter(Boolean)]));
      try {
        ref.settings = await api(`${A}/settings`, { method: 'PUT', body: { ...ref.settings,
          editor: { store: f.store.checked, tools: Object.fromEntries($$('[data-tool]', f).map((i) => [i.dataset.tool, i.checked])), ai: Object.fromEntries($$('[data-ai]', f).map((i) => [i.dataset.ai, i.checked])) },
          printSizes: sizes } });
        ref.printTypes = await api(`${A}/print-types`);
        toast('הגדרות העורך והמידות נשמרו ✓');
        settings();
      } catch (err) { toast(err.message); }
    };
    $$('[data-shortcut]').forEach((b) => { b.onclick = () => { $('#dash-url').value = b.dataset.shortcut; toast('לחצו "שמירה" כדי לקבוע'); }; });
    $('#settings-form').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      const body = {
        businessName: f.businessName.value, shippingPrice: f.shippingPrice.value, freeShippingFrom: f.freeShippingFrom.value,
        paymentDashboardUrl: f.paymentDashboardUrl.value, slaHours: Object.fromEntries($$('[data-sla]', f).map((i) => [i.dataset.sla, i.value])),
      };
      ref.settings = await api(`${A}/settings`, { method: 'PUT', body });
      updateShortcut();
      toast('נשמר ✓');
    };
  }

  function updateShortcut() {
    const active = ref.payments.providers?.find((p) => p.id === ref.payments.active);
    const url = ref.settings.paymentDashboardUrl || active?.dashboardUrl || '';
    const a = $('#pay-shortcut');
    if (url) { a.href = url; a.onclick = null; } else {
      a.removeAttribute('href');
      a.onclick = () => { go('settings'); toast('בחרו חברת סליקה וקבעו קיצור דרך'); };
    }
  }

  // ---------- ניווט ----------
  const VIEWS = { dashboard, events, orders, products, promotions, banners, club: clubView, collections, suppliers, couriers, cities, guests, settings };
  async function go(v, arg) {
    current = v;
    $$('[data-view]').forEach((t) => t.classList.toggle('active', t.dataset.view === v));
    closeModal();
    view.innerHTML = '<p class="muted">טוען…</p>';
    try { await VIEWS[v](arg); } catch (e) {
      if (e.status === 401) return showLogin();
      view.innerHTML = `<div class="card"><b>שגיאה:</b> ${esc(e.message)}</div>`;
    }
    history.replaceState(null, '', `#${v}`);
  }
  document.addEventListener('click', (e) => { const t = e.target.closest('[data-view]'); if (t) go(t.dataset.view); });
  // תפריט "עוד" במובייל - כל המסכים
  $('#more-btn').onclick = () => openModal(`<div class="row between"><h2 style="margin:0">תפריט</h2><button class="icon-btn" data-close>✕</button></div>
    <div class="sheet-list" style="margin-top:12px">${$$('#nav [data-view]').map((t) => `<button class="btn soft" data-view="${t.dataset.view}">${esc(t.textContent)}</button>`).join('')}
    <a class="btn soft" href="../" target="_blank">🛍️ אפליקציית הלקוח</a><button class="btn soft" data-install>📲 התקנת אפליקציית הניהול</button></div>`);
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (VIEWS[h] && h !== current) go(h); });

  async function loadRefs() {
    const [cfg, citiesL, cats, cols, pts, sups, kurs, st, evTypes] = await Promise.all([
      api('/api/config'), api(`${A}/cities`), api(`${A}/categories`), api(`${A}/collections`), api(`${A}/print-types`),
      api(`${A}/suppliers`), api(`${A}/couriers`), api(`${A}/settings`), api(`${A}/event-types`),
    ]);
    Object.assign(ref, { aiRemoveBg: cfg.aiRemoveBg, eventTypes: evTypes, statuses: cfg.statuses, cities: citiesL, categories: cats, collections: cols, printTypes: pts, suppliers: sups, couriers: kurs, settings: st.settings, payments: st.payments });
    updateShortcut();
  }

  function showLogin() { $('#app').classList.add('hidden'); $('#login').classList.remove('hidden'); $('#pw').focus(); }
  async function start() {
    $('#login').classList.add('hidden');
    $('#app').classList.remove('hidden');
    await loadRefs();
    const h = location.hash.slice(1);
    go(VIEWS[h] ? h : 'dashboard');
  }

  $('#login-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const r = await api(`${A}/login`, { method: 'POST', body: { password: $('#pw').value } });
      adminToken.set(r.token);
      start();
    } catch (err) { toast(err.message); }
  };
  $('#logout').onclick = () => { adminToken.set(''); showLogin(); };

  api(`${A}/me`).then(start).catch(showLogin);
}());
