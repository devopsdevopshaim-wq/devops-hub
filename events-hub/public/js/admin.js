/* global $, $$, api, esc, toast, money, fmtDate */
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
  async function dashboard() {
    const d = await api(`${A}/dashboard`);
    const stat = (label, val, cls = '', go = '') => `<div class="card" ${go ? `data-go="${go}" style="cursor:pointer"` : ''}><div class="muted">${label}</div><div class="stat ${cls}">${val}</div></div>`;
    view.innerHTML = `<h1>לוח בקרה</h1><div class="grid">
      ${stat('הזמנות פתוחות', d.ordersOpen, '', 'orders')}
      ${stat('משלוחים תקועים ⚠️', d.ordersStuck, d.ordersStuck ? 'bad' : '', 'orders:stuck')}
      ${stat('דורשות שיוך ידני', d.needsAssignment, d.needsAssignment ? 'bad' : '', 'orders')}
      ${stat('תמונות ממתינות להדפסה', d.photosPending, '', 'events')}
      ${stat('אירועים', d.events, '', 'events')}
      ${stat('אורחים רשומים', d.guests, '', 'guests')}
      ${stat('הכנסות (הזמנות ששולמו)', money(d.revenue))}
    </div>`;
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
        <div><label>גודל (ס"מ)</label><select class="po-size">${t.sizes.map((s) => `<option ${s === o.size ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div><label>שם לתצוגה</label><input class="po-label" value="${esc(o.label || '')}" placeholder="אוטומטי"></div>
        <input type="hidden" class="po-id" value="${esc(o.id || '')}">
        <div><button type="button" class="btn ghost sm po-del">הסרה</button></div></div>`;
    }
  }

  function printOptionsEditor(list = []) {
    return `<div class="card flat" style="margin-top:12px"><h3>אפשרויות הדפסה לאורחים (עד 3)</h3><div id="po-list">${list.map((o) => poRow(o)).join('')}</div>
      <button type="button" class="btn soft sm" id="po-add">➕ הוספת אפשרות</button></div>`;
  }

  function bindPrintOptions() {
    const list = $('#po-list');
    const refreshSizes = (r) => {
      const t = ref.printTypes.find((x) => x.type === $('.po-type', r).value);
      $('.po-size', r).innerHTML = t.sizes.map((s) => `<option>${s}</option>`).join('');
    };
    const updateAdd = () => { $('#po-add').disabled = $$('.po-row', list).length >= 3; };
    $('#po-add').onclick = () => {
      if ($$('.po-row', list).length >= 3) return;
      list.insertAdjacentHTML('beforeend', poRow({}));
      updateAdd();
    };
    list.addEventListener('change', (e) => { if (e.target.classList.contains('po-type')) refreshSizes(e.target.closest('.po-row')); });
    list.addEventListener('click', (e) => { if (e.target.classList.contains('po-del')) { e.target.closest('.po-row').remove(); updateAdd(); } });
    updateAdd();
  }

  const collectPrintOptions = (form) => ({
    printOptions: $$('.po-row', form).map((r) => ({ id: $('.po-id', r).value || undefined, type: $('.po-type', r).value, size: $('.po-size', r).value, label: $('.po-label', r).value })),
  });

  function editEvent(ev) {
    editForm({
      title: ev ? 'עריכת אירוע' : 'אירוע חדש', fields: EVENT_FIELDS, rec: ev ? { ...ev, endsAt: (ev.endsAt || '').slice(0, 16) } : null,
      url: `${A}/events`, onSaved: events,
      extraHtml: printOptionsEditor(ev?.printOptions || [{ type: 'magnet', size: '6x9' }]), collectExtra: collectPrintOptions,
    });
    bindPrintOptions();
  }

  async function events() {
    const list = await api(`${A}/events`);
    view.innerHTML = `<div class="row between"><h1>אירועים ו-QR</h1><button class="btn" id="new-ev">➕ אירוע חדש</button></div>
      <div class="grid">${list.map((e) => `<div class="card stack">
        <div class="row between"><h3 style="margin:0">${esc(e.name)}</h3>${ACTIVE(e.active)}</div>
        <div class="muted small">${esc(e.type || '')} · ${e.date ? new Date(e.date).toLocaleDateString('he-IL') : ''}</div>
        <canvas data-qr="${esc(e.link)}" aria-label="קוד QR לאירוע" style="width:160px;height:160px;margin:0 auto;background:#fff;border-radius:8px"></canvas>
        <div class="small">🔗 <a href="${esc(e.link)}" target="_blank">${esc(e.link)}</a></div>
        <div class="small">📸 ${e.photosPerGuest} תמונות לאורח · 👥 ${e.guests} אורחים · 🖨️ ${e.photos} הדפסות</div>
        <div class="small">${e.printOptions.map((o) => `<span class="badge primary">${esc(o.label)}</span>`).join(' ')}</div>
        <div class="row"><button class="btn sm" data-photos="${e.id}">תמונות להדפסה</button><button class="btn soft sm" data-edit="${e.id}">עריכה</button>
        <button class="btn ghost sm" data-qrdl="${esc(e.link)}" data-name="qr-${esc(e.code)}.png">הורדת QR</button></div>
      </div>`).join('') || '<p class="muted">אין אירועים עדיין</p>'}</div>`;
    $('#new-ev').onclick = () => editEvent(null);
    $$('[data-edit]').forEach((b) => { b.onclick = () => editEvent(list.find((e) => e.id === b.dataset.edit)); });
    $$('[data-photos]').forEach((b) => { b.onclick = () => eventPhotos(list.find((e) => e.id === b.dataset.photos)); });
    $$('canvas[data-qr]').forEach((c) => drawQR(c, c.dataset.qr));
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
      <p class="small">סכום: <b>${money(o.total)}</b>${o.discount ? ` (הנחה ${money(o.discount)}${o.coupon ? `, קופון <b dir="ltr">${esc(o.coupon)}</b>` : ''})` : ''} · משלוח ${o.shipping ? money(o.shipping) : 'חינם'}</p>
      <div class="row"><label style="margin:0">שליח</label><select id="courier-sel" style="max-width:300px"><option value="">— ללא —</option>${ref.couriers.filter((k) => k.active !== false).map((k) => `<option value="${k.id}" ${k.id === o.courierId ? 'selected' : ''}>${esc(k.name)} ${esc(k.phone)}</option>`).join('')}</select>
        <button class="btn soft sm" id="save-assign">שמירת שיוך</button><button class="btn ghost sm" id="auto-assign">🔄 שיוך אוטומטי לפי עיר</button></div>
      <p class="small">🔗 קישור מעקב ללקוח: <a href="${esc(o.trackUrl)}" target="_blank">פתיחה</a> <button class="btn ghost sm" id="copy-track">העתקה</button></p>
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

  async function products() {
    const [list, store] = await Promise.all([api(`${A}/products`), api('/api/store').catch(() => ({ products: [] }))]);
    const sale = Object.fromEntries(store.products.filter((p) => p.promo).map((p) => [p.id, p]));
    const fields = [
      { k: 'name', label: 'שם המוצר' }, { k: 'price', label: 'מחיר רגיל (₪)', type: 'number', step: '0.01' },
      { k: 'category', label: 'קטגוריה', type: 'select', options: catOpts() }, { k: 'icon', label: 'אייקון (כשאין תמונה)' },
      { k: 'description', label: 'תיאור', type: 'textarea', full: true },
      { k: 'collectionIds', label: 'שיוך לקולקציה עונתית (המוצר יוצג רק בזמן הקולקציה)', type: 'checks', options: ref.collections.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` })) },
      { k: 'needsPhoto', label: 'המוצר דורש תמונה מהלקוח', type: 'bool', def: false }, { k: 'active', label: 'פעיל', type: 'bool' },
    ];
    view.innerHTML = `<div class="row between"><h1>מוצרים</h1><div class="row"><button class="btn soft" data-go-promos>🏷️ מבצעים</button><button class="btn" id="new">➕ מוצר חדש</button></div></div>
      <p class="muted small">את המחיר אפשר לשנות ישר בטבלה. מחיר מבצע נקבע במסך "מבצעים".</p>
      <div class="card table-wrap"><table><thead><tr><th></th><th>שם</th><th>קטגוריה</th><th>מחיר רגיל</th><th>במבצע</th><th>סטטוס</th></tr></thead><tbody>
      ${list.map((p) => {
        const img = productImgs(p)[0];
        const s = sale[p.id];
        return `<tr data-id="${p.id}" style="cursor:pointer">
        <td>${img ? `<img src="${esc(asset(img))}" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:8px">` : `<span style="font-size:1.6rem">${esc(p.icon)}</span>`}</td>
        <td>${esc(p.name)}<div class="muted small">${productImgs(p).length} תמונות</div></td><td>${catName(p.category)}</td>
        <td><input type="number" step="0.01" min="0" value="${p.price}" data-price="${p.id}" aria-label="מחיר" style="width:100px;min-height:36px;padding:4px 8px"></td>
        <td>${s ? `<b style="color:var(--bad)">${money(s.salePrice)}</b><div class="small">${esc(s.promo.name)}</div>` : '<span class="muted">—</span>'}</td>
        <td>${ACTIVE(p.active)}</td></tr>`;
      }).join('')}</tbody></table></div>`;
    const open = (rec) => {
      editForm({
        title: rec ? 'עריכת מוצר' : 'מוצר חדש', fields, rec: rec ? { ...rec, needsPhoto: rec.needsPhoto || false } : { needsPhoto: false },
        url: `${A}/products`, onSaved: products, extraHtml: imagesEditor(rec ? productImgs(rec) : []), collectExtra: collectImages,
      });
      bindImages();
    };
    $('#new').onclick = () => open(null);
    $('[data-go-promos]').onclick = () => go('promotions');
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
  async function settings() {
    const d = await api(`${A}/settings`);
    ref.settings = d.settings; ref.payments = d.payments;
    const s = d.settings;
    const pays = await api(`${A}/payments`);
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
      <div class="card table-wrap" style="margin-top:16px"><h2>תשלומים אחרונים</h2><table><thead><tr><th>תאריך</th><th>הזמנה</th><th>סכום</th><th>ספק</th><th>סטטוס</th></tr></thead><tbody>
      ${pays.slice(0, 30).map((p) => `<tr><td class="small">${fmtDate(p.createdAt)}</td><td class="small">${esc(p.orderId)}</td><td>${money(p.amount)}</td><td>${esc(p.provider)}</td><td><span class="badge ${p.status === 'approved' ? 'ok' : p.status === 'declined' || p.status === 'error' ? 'bad' : ''}">${esc(p.status)}</span></td></tr>`).join('')}</tbody></table></div>`;
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
  const VIEWS = { dashboard, events, orders, products, promotions, collections, suppliers, couriers, cities, guests, settings };
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
    const [cfg, citiesL, cats, cols, pts, sups, kurs, st] = await Promise.all([
      api('/api/config'), api(`${A}/cities`), api(`${A}/categories`), api(`${A}/collections`), api(`${A}/print-types`),
      api(`${A}/suppliers`), api(`${A}/couriers`), api(`${A}/settings`),
    ]);
    Object.assign(ref, { statuses: cfg.statuses, cities: citiesL, categories: cats, collections: cols, printTypes: pts, suppliers: sups, couriers: kurs, settings: st.settings, payments: st.payments });
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
