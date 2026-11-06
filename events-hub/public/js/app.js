/* global $, $$, api, esc, toast, store, money, fmtDate, myEvents, myOrders */
(function () {
  let catalog = { categories: [], collections: [], products: [] };
  let cfg = {};
  let activeCat = 'all';
  let cart = store.get('cart', []);
  let photoTarget = null; // מוצר שממתין לבחירת תמונה

  // ---------- ניווט ----------
  function go(view) {
    $$('[data-view]').forEach((t) => t.classList.toggle('active', t.dataset.view === view));
    ['store', 'events', 'orders'].forEach((v) => $(`#view-${v}`).classList.toggle('hidden', v !== view));
    if (view === 'events') renderEvents();
    if (view === 'orders') renderOrders();
    history.replaceState(null, '', `#${view}`);
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-view]');
    if (t) go(t.dataset.view);
    if (e.target.closest('[data-open-cart]')) openCart();
  });

  // ---------- חנות ----------
  function productCard(p) {
    return `<div class="card product">
      <div class="thumb">${p.image ? `<img src="${esc(p.image)}" alt="">` : esc(p.icon || '🎁')}</div>
      <h3>${esc(p.name)}</h3>
      <p class="muted small">${esc(p.description)}</p>
      <div class="row between"><span class="price">${money(p.price)}</span>
      <button class="btn sm" data-add="${esc(p.id)}">${p.needsPhoto ? '📷 בחירת תמונה' : 'הוספה לסל'}</button></div>
    </div>`;
  }

  function renderStore() {
    $('#collections').innerHTML = catalog.collections.map((c) => `
      <div class="card" style="margin-bottom:12px;background:linear-gradient(120deg,color-mix(in srgb,var(--accent) 20%,var(--surface)),var(--surface))">
        <div class="row between"><h2 style="margin:0">${esc(c.icon)} ${esc(c.name)}</h2>${c.endDate ? `<span class="badge warn">עד ${new Date(c.endDate).toLocaleDateString('he-IL')}</span>` : ''}</div>
        <div class="grid" style="margin-top:12px">${catalog.products.filter((p) => (p.collectionIds || []).includes(c.id)).map(productCard).join('')}</div>
      </div>`).join('');
    $('#cat-tabs').innerHTML = [`<button class="tab${activeCat === 'all' ? ' active' : ''}" data-cat="all">הכול</button>`]
      .concat(catalog.categories.map((c) => `<button class="tab${activeCat === c.id ? ' active' : ''}" data-cat="${esc(c.id)}">${esc(c.icon)} ${esc(c.name)}</button>`)).join('');
    const list = catalog.products.filter((p) => !(p.collectionIds || []).length && (activeCat === 'all' || p.category === activeCat));
    $('#products').innerHTML = list.map(productCard).join('') || '<p class="muted">אין מוצרים בקטגוריה זו</p>';
  }

  $('#cat-tabs').addEventListener('click', (e) => { const t = e.target.closest('[data-cat]'); if (t) { activeCat = t.dataset.cat; renderStore(); } });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]');
    if (!b) return;
    const p = catalog.products.find((x) => x.id === b.dataset.add);
    if (p.needsPhoto) openPhotoModal(p); else addToCart(p);
  });

  // ---------- סל ----------
  function saveCart() {
    store.set('cart', cart);
    const n = cart.reduce((s, i) => s + i.qty, 0);
    $('#cart-count').textContent = n;
    $('#cart-count').classList.toggle('hidden', !n);
  }

  function addToCart(p, photoUrl = '') {
    const key = p.id + '|' + photoUrl;
    const ex = cart.find((i) => i.key === key);
    if (ex) ex.qty++; else cart.push({ key, productId: p.id, name: p.name, price: p.price, icon: p.icon, qty: 1, photoUrl });
    saveCart();
    toast(`נוסף לסל: ${p.name}`);
  }

  function openCart() {
    $('#cart').classList.remove('hidden');
    $('#cart-bg').classList.remove('hidden');
    renderCart();
  }
  function closeCart() { $('#cart').classList.add('hidden'); $('#cart-bg').classList.add('hidden'); }
  $('#cart-btn').onclick = openCart;
  $('#cart-close').onclick = closeCart;
  $('#cart-bg').onclick = closeCart;

  function renderCart() {
    if (!cart.length) {
      $('#cart-items').innerHTML = '<p class="muted">הסל ריק</p>';
      $('#cart-summary').innerHTML = '';
      $('#checkout').classList.add('hidden');
      return;
    }
    $('#cart-items').innerHTML = cart.map((i, idx) => `
      <div class="row" style="align-items:flex-start">
        <div class="photo-tile" style="width:64px;flex:none">${i.photoUrl ? `<img src="${esc(i.photoUrl)}" alt="">` : `<div style="font-size:2rem;display:grid;place-items:center;height:100%">${esc(i.icon)}</div>`}</div>
        <div style="flex:1"><b>${esc(i.name)}</b><div class="muted small">${money(i.price)} ליחידה</div>
          <div class="row" style="gap:6px;margin-top:4px"><button class="btn soft sm" data-q="${idx}" data-d="-1">−</button><b>${i.qty}</b><button class="btn soft sm" data-q="${idx}" data-d="1">+</button></div></div>
        <b>${money(i.price * i.qty)}</b>
      </div>`).join('');
    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const shipping = subtotal >= cfg.freeShippingFrom ? 0 : cfg.shippingPrice;
    $('#cart-summary').innerHTML = `<div class="card flat">
      <div class="row between"><span>סכום ביניים</span><b>${money(subtotal)}</b></div>
      <div class="row between"><span>משלוח</span><b>${shipping ? money(shipping) : 'חינם'}</b></div>
      ${shipping ? `<div class="muted small">משלוח חינם מעל ${money(cfg.freeShippingFrom)}</div>` : ''}
      <hr style="border:0;border-top:1px solid var(--border)"><div class="row between"><span>סה"כ לתשלום</span><span class="price">${money(subtotal + shipping)}</span></div></div>`;
    $('#checkout').classList.remove('hidden');
  }

  $('#cart-items').addEventListener('click', (e) => {
    const b = e.target.closest('[data-q]');
    if (!b) return;
    const i = cart[b.dataset.q];
    i.qty += Number(b.dataset.d);
    if (i.qty <= 0) cart.splice(b.dataset.q, 1);
    saveCart();
    renderCart();
  });

  const saved = store.get('customer', {});
  ['name', 'phone', 'email', 'city', 'address'].forEach((k) => { if (saved[k]) $(`#c-${k}`).value = saved[k]; });

  $('#checkout').addEventListener('submit', async (e) => {
    e.preventDefault();
    const customer = { name: $('#c-name').value, phone: $('#c-phone').value, email: $('#c-email').value, city: $('#c-city').value, address: $('#c-address').value, notes: $('#c-notes').value };
    store.set('customer', { ...customer, notes: '' });
    const btn = $('#pay-btn');
    btn.disabled = true;
    try {
      const r = await api('/api/orders', { method: 'POST', body: { customer, items: cart.map(({ productId, qty, photoUrl }) => ({ productId, qty, photoUrl })) } });
      myOrders.add({ id: r.orderId, number: r.number, t: r.trackToken, at: new Date().toISOString() });
      cart = [];
      saveCart();
      location.href = r.redirectUrl;
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
    }
  });

  // ---------- בחירת תמונה למוצר ----------
  async function myPhotoUrls() {
    const urls = [];
    for (const ev of myEvents.all()) {
      try {
        const d = await api(`/api/event/${ev.code}/me`, { headers: { 'x-guest-id': ev.guestId, 'x-guest-token': ev.guestToken } });
        d.photos.filter((p) => p.kind === 'print').forEach((p) => urls.push(p.url));
      } catch { /* אירוע שנמחק */ }
    }
    return urls.concat(store.get('uploadedPhotos', []));
  }

  async function openPhotoModal(p) {
    photoTarget = p;
    $('#photo-modal').classList.remove('hidden');
    $('#my-photos').innerHTML = '<p class="muted">טוען…</p>';
    const urls = [...new Set(await myPhotoUrls())];
    $('#my-photos').innerHTML = urls.map((u) => `<button class="photo-tile" style="border:0;padding:0;cursor:pointer" data-photo="${esc(u)}"><img src="${esc(u)}" alt=""></button>`).join('') || '<p class="muted">אין עדיין תמונות - העלו תמונה</p>';
  }
  $('#photo-modal').addEventListener('click', (e) => {
    if (e.target.closest('[data-close]') || e.target.id === 'photo-modal') $('#photo-modal').classList.add('hidden');
    const t = e.target.closest('[data-photo]');
    if (t) { addToCart(photoTarget, t.dataset.photo); $('#photo-modal').classList.add('hidden'); }
  });
  $('#store-upload').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const fd = new FormData();
    fd.append('file', f);
    try {
      const r = await api('/api/uploads', { method: 'POST', body: fd });
      store.set('uploadedPhotos', [r.url, ...store.get('uploadedPhotos', [])].slice(0, 30));
      addToCart(photoTarget, r.url);
      $('#photo-modal').classList.add('hidden');
    } catch (err) { toast(err.message); }
  });

  // ---------- האירועים שלי ----------
  async function renderEvents() {
    const list = myEvents.all();
    if (!list.length) { $('#events-list').innerHTML = '<p class="muted">עוד לא סרקתם QR באירוע.</p>'; return; }
    $('#events-list').innerHTML = list.map((e) => `<div class="card flat" id="ev-${esc(e.code)}"><div class="row between"><h3 style="margin:0">${esc(e.name)}</h3><a class="btn sm" href="/e/${esc(e.code)}">פתיחה</a></div><div class="grid sm" style="margin-top:10px"></div></div>`).join('');
    for (const e of list) {
      try {
        const d = await api(`/api/event/${e.code}/me`, { headers: { 'x-guest-id': e.guestId, 'x-guest-token': e.guestToken } });
        $(`#ev-${e.code} .grid`).innerHTML = d.photos.map((p) => `<div class="photo-tile">${p.kind === 'animation' ? `<video src="${esc(p.url)}" muted loop autoplay playsinline></video>` : `<img src="${esc(p.url)}" alt="" loading="lazy">`}</div>`).join('');
      } catch { /* התעלמות */ }
    }
  }

  // ---------- ההזמנות שלי ----------
  async function renderOrders() {
    const list = myOrders.all();
    if (!list.length) { $('#orders-list').innerHTML = '<p class="muted">אין הזמנות עדיין.</p>'; return; }
    $('#orders-list').innerHTML = list.map((o) => `<a class="card flat row between" style="text-decoration:none;color:inherit" href="/track.html?id=${esc(o.id)}&t=${esc(o.t)}" data-o="${esc(o.id)}"><b>הזמנה #${esc(o.number)}</b><span class="muted small">${fmtDate(o.at)}</span><span class="badge" data-st>…</span></a>`).join('');
    for (const o of list) {
      api(`/api/orders/${o.id}?t=${o.t}`).then((d) => { $(`[data-o="${o.id}"] [data-st]`).textContent = d.statusName; }).catch(() => {});
    }
  }

  // ---------- התחלה ----------
  (async () => {
    saveCart();
    try {
      [cfg, catalog] = await Promise.all([api('/api/config'), api('/api/store')]);
      $('#brand-name').textContent = cfg.businessName;
      document.title = cfg.businessName;
      renderStore();
      const cities = await api('/api/cities');
      $('#cities').innerHTML = cities.map((c) => `<option value="${esc(c.name)}">`).join('');
    } catch (e) { toast(e.message); }
    const hash = location.hash.slice(1);
    // אם יש אירוע שמור והלקוח פתח את האפליקציה מהמסך הראשי - מציגים את האירועים
    go(['store', 'events', 'orders'].includes(hash) ? hash : 'store');
    setTimeout(() => offerInstall(), 2500);
  })();
}());
