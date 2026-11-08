/* global $, $$, api, esc, toast, store, money, fmtDate, myEvents, myOrders, asset, shrinkImage, PHOTOS, icon, fillIcons */
(function () {
  let catalog = { categories: [], collections: [], products: [], promotions: [] };
  let coupon = store.get('coupon', '');
  let lastQuote = null;
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
  const imgs = (p) => (p.images && p.images.length ? p.images : (p.image ? [p.image] : []));
  const priceHtml = (p) => (p.salePrice !== null && p.salePrice !== undefined && p.salePrice < p.price
    ? `<span class="price sale">${money(p.salePrice)}</span><span class="old-price">${money(p.price)}</span>`
    : `<span class="price">${money(p.price)}</span>`);

  function productCard(p) {
    const im = imgs(p);
    return `<div class="card product">
      <div class="thumb" data-show="${esc(p.id)}" role="button" tabindex="0" aria-label="${esc(p.name)} - פרטים ותמונות">
        ${im.length ? `<img src="${esc(asset(im[0]))}" alt="" loading="lazy">` : PHOTOS.img(p.category, p.name)}
        ${p.promo ? `<span class="sale-badge">${esc(p.promo.badge || 'מבצע')}</span>` : ''}
        ${im.length > 1 ? `<span class="badge" style="position:absolute;bottom:6px;left:6px">📷 ${im.length}</span>` : ''}
      </div>
      <h3>${esc(p.name)}</h3>
      <p class="muted small">${esc(String(p.description || '').slice(0, 110))}${String(p.description || '').length > 110 ? '…' : ''}</p>
      <div class="row between"><span>${priceHtml(p)}</span>
      <button class="btn sm" data-add="${esc(p.id)}">${p.needsPhoto ? `${icon('camera')}בחירת תמונה` : `${icon('cart')}לסל`}</button></div>
    </div>`;
  }

  // דף מוצר: כל התמונות (החלקה), תיאור מלא ומחיר
  function showProduct(p) {
    const im = imgs(p);
    $('#product-body').innerHTML = `
      <div class="row between"><h2 style="margin:0">${esc(p.name)}</h2><button class="icon-btn" data-pclose aria-label="סגירה">✕</button></div>
      ${im.length ? `<div class="gallery" id="gallery">${im.map((u) => `<img src="${esc(asset(u))}" alt="">`).join('')}</div>
        ${im.length > 1 ? `<div class="gallery-dots" id="gallery-dots">1 / ${im.length} · מחליקים לתמונה הבאה</div>` : ''}`
        : `<div style="border-radius:14px;overflow:hidden;aspect-ratio:4/3">${PHOTOS.img(p.category, p.name, 1000, 750)}</div>`}
      ${p.promo ? `<p style="margin:10px 0 0"><span class="sale-badge" style="position:static">${esc(p.promo.badge || 'מבצע')}</span> ${esc(p.promo.name)}</p>` : ''}
      <p style="white-space:pre-line">${esc(p.description)}</p>
      <div class="row between"><span>${priceHtml(p)}</span><button class="btn" data-add="${esc(p.id)}" data-pclose>${p.needsPhoto ? '📷 בחירת תמונה' : 'הוספה לסל 🛒'}</button></div>`;
    $('#product-modal').classList.remove('hidden');
    const g = $('#gallery');
    if (g && im.length > 1) g.onscroll = () => { $('#gallery-dots').textContent = `${Math.round(Math.abs(g.scrollLeft) / g.clientWidth) + 1} / ${im.length}`; };
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-show]');
    if (t) showProduct(catalog.products.find((x) => x.id === t.dataset.show));
    if (e.target.closest('[data-pclose]') || e.target.id === 'product-modal') $('#product-modal').classList.add('hidden');
  });
  document.addEventListener('keydown', (e) => {
    const t = e.target.closest && e.target.closest('[data-show]');
    if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); showProduct(catalog.products.find((x) => x.id === t.dataset.show)); }
  });

  function promoText(p) {
    const v = p.kind === 'percent' ? `${p.value}% הנחה` : p.kind === 'amount' ? `${money(p.value)} הנחה` : `ב-${money(p.value)} בלבד`;
    return `🏷️ ${esc(p.name)}: ${v}${p.minSubtotal ? ` בהזמנה מעל ${money(p.minSubtotal)}` : ''}${p.endDate ? ` · עד ${new Date(p.endDate).toLocaleDateString('he-IL')}` : ''}`;
  }

  function renderStore() {
    $('#promo-strip').innerHTML = (catalog.promotions || []).map((p) => `<span class="chip">${promoText(p)}</span>`).join('');
    $('#collections').innerHTML = catalog.collections.map((c) => `
      <div class="card" style="margin-bottom:12px;background:linear-gradient(120deg,color-mix(in srgb,var(--accent) 20%,var(--surface)),var(--surface))">
        <div class="row between"><h2 style="margin:0">${esc(c.icon)} ${esc(c.name)}</h2>${c.endDate ? `<span class="badge warn">עד ${new Date(c.endDate).toLocaleDateString('he-IL')}</span>` : ''}</div>
        <div class="grid" style="margin-top:12px">${catalog.products.filter((p) => (p.collectionIds || []).includes(c.id)).map(productCard).join('')}</div>
      </div>`).join('');
    const tile = (id, label, art) => `<button class="print-tile${activeCat === id ? ' active' : ''}" data-cat="${esc(id)}" role="tab" aria-selected="${activeCat === id}">
        <span class="pin"></span><span class="art">${art}</span><span class="label">${esc(label)}</span></button>`;
    $('#cat-tabs').innerHTML = [tile('all', 'הכול', '<img src="icons/icon.svg" alt="">')]
      .concat(catalog.categories.map((c) => tile(c.id, c.name, PHOTOS.img(c.id, c.name, 400, 300)))).join('');
    const list = catalog.products.filter((p) => !(p.collectionIds || []).length && (activeCat === 'all' || p.category === activeCat));
    $('#products').innerHTML = list.map(productCard).join('') || '<p class="muted">אין מוצרים בקטגוריה זו</p>';
    $('#shop-count').textContent = `${list.length} מוצרים`;
  }

  $('#cat-tabs').addEventListener('click', (e) => {
    const t = e.target.closest('[data-cat]');
    if (!t) return;
    activeCat = t.dataset.cat;
    renderStore();
    const now = $(`#cat-tabs [data-cat="${activeCat}"]`);
    now.classList.add('flash'); // הבזק מצלמה
    setTimeout(() => now.classList.remove('flash'), 500);
  });
  // פתיח: תמונת רקע אמיתית ושלוש "הדפסות" במניפה (מגנטים, בלוקים, מסגרות)
  function renderHero() {
    $('.stage').style.setProperty('--hero-photo', `url("${PHOTOS.hero}")`);
    $('.stage').classList.add('has-photo');
    $('#hero-fan').innerHTML = [['magnets', 'מגנטים'], ['blocks', 'בלוקים'], ['frames', 'מסגרות']]
      .map(([k, l]) => `<div class="print-tile"><span class="pin"></span><span class="art">${PHOTOS.img(k, l, 480, 360)}</span><span class="label">${l}</span></div>`).join('');
  }
  renderHero();
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
    ['#cart-count', '#cart-count-nav'].forEach((sel) => { $(sel).textContent = n; $(sel).classList.toggle('hidden', !n); });
  }

  function addToCart(p, photoUrl = '') {
    const key = p.id + '|' + photoUrl;
    const ex = cart.find((i) => i.key === key);
    const img = imgs(p)[0] || '';
    if (ex) ex.qty++; else cart.push({ key, productId: p.id, name: p.name, price: p.salePrice ?? p.price, icon: p.icon, img, qty: 1, photoUrl });
    saveCart();
    lastQuote = null;
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
    const q = lastQuote && lastQuote.lines.length === cart.length ? lastQuote : null;
    $('#cart-items').innerHTML = cart.map((i, idx) => {
      const l = q && q.lines[idx];
      const unit = l ? l.price : i.price;
      const orig = l ? l.originalPrice : unit;
      const thumb = i.photoUrl || i.img;
      return `
      <div class="row" style="align-items:flex-start">
        <div class="photo-tile" style="width:64px;flex:none">${thumb ? `<img src="${esc(asset(thumb))}" alt="">` : `<div style="font-size:2rem;display:grid;place-items:center;height:100%">${esc(i.icon)}</div>`}</div>
        <div style="flex:1"><b>${esc(i.name)}</b><div class="muted small">${money(unit)} ליחידה${orig > unit ? ` <span class="old-price">${money(orig)}</span>` : ''}</div>
          ${l && (l.promo || l.coupon) ? `<div class="small" style="color:var(--bad);font-weight:700">🏷️ ${[l.promo && esc(l.promo.name), l.coupon && `קופון ${esc(l.coupon.code)}`].filter(Boolean).join(' + ')}</div>` : ''}
          <div class="row" style="gap:6px;margin-top:4px"><button class="btn soft sm" data-q="${idx}" data-d="-1">−</button><b>${i.qty}</b><button class="btn soft sm" data-q="${idx}" data-d="1">+</button></div></div>
        <b>${money(unit * i.qty)}</b>
      </div>`;
    }).join('');
    const local = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const t = q || { subtotalBefore: local, discount: 0, subtotal: local, shipping: local >= cfg.freeShippingFrom ? 0 : cfg.shippingPrice, total: 0 };
    if (!q) t.total = t.subtotal + t.shipping;
    $('#cart-summary').innerHTML = `<div class="card flat">
      ${t.discount ? `<div class="row between"><span>לפני הנחות</span><span class="old-price" style="margin:0">${money(t.subtotalBefore)}</span></div>
        <div class="row between" style="color:var(--bad);font-weight:700"><span>🏷️ חסכתם</span><span>−${money(t.discount)}</span></div>` : ''}
      <div class="row between"><span>סכום ביניים</span><b>${money(t.subtotal)}</b></div>
      <div class="row between"><span>משלוח</span><b>${t.shipping ? money(t.shipping) : 'חינם'}</b></div>
      ${t.shipping ? `<div class="muted small">משלוח חינם מעל ${money(cfg.freeShippingFrom)}</div>` : ''}
      <hr style="border:0;border-top:1px solid var(--border)"><div class="row between"><span>סה"כ לתשלום</span><span class="price">${money(t.total)}</span></div>
      <form class="row" id="coupon-form" style="margin-top:10px;flex-wrap:nowrap"><input id="coupon" placeholder="קוד קופון" value="${esc(coupon)}" style="flex:1" autocomplete="off"><button class="btn soft sm">החלה</button></form>
      ${q && q.code ? `<div class="small" style="margin-top:4px;color:${q.codeUsed ? 'var(--ok)' : 'var(--bad)'}">${q.codeUsed ? `✓ הקופון ${esc(q.code)} הופעל` : q.codeValid ? 'הקופון תקף, אבל לא חל על המוצרים בסל' : 'קוד הקופון לא תקף'}</div>` : ''}
    </div>`;
    $('#coupon-form').onsubmit = (e) => { e.preventDefault(); coupon = $('#coupon').value.trim(); store.set('coupon', coupon); refreshQuote(); };
    $('#checkout').classList.remove('hidden');
    if (!q) refreshQuote();
  }

  // המחיר הסופי (מבצעים, קופון, משלוח) תמיד מהשרת
  let quoting = 0;
  async function refreshQuote() {
    if (!cart.length) { lastQuote = null; return; }
    const my = ++quoting;
    try {
      const q = await api('/api/cart/quote', { method: 'POST', body: { code: coupon, items: cart.map(({ productId, qty }) => ({ productId, qty })) } });
      if (my !== quoting) return;
      lastQuote = q;
      if (!$('#cart').classList.contains('hidden')) renderCart();
    } catch (err) {
      if (/לא זמין/.test(err.message)) toast('אחד המוצרים בסל כבר לא זמין. הסירו אותו ונסו שוב.');
    }
  }

  $('#cart-items').addEventListener('click', (e) => {
    const b = e.target.closest('[data-q]');
    if (!b) return;
    const i = cart[b.dataset.q];
    i.qty += Number(b.dataset.d);
    if (i.qty <= 0) cart.splice(b.dataset.q, 1);
    saveCart();
    lastQuote = null;
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
      const r = await api('/api/orders', { method: 'POST', body: { customer, code: coupon, items: cart.map(({ productId, qty, photoUrl }) => ({ productId, qty, photoUrl })) } });
      myOrders.add({ id: r.orderId, number: r.number, t: r.trackToken, at: new Date().toISOString() });
      cart = [];
      coupon = '';
      store.set('coupon', '');
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
    $('#my-photos').innerHTML = urls.map((u) => `<button class="photo-tile" style="border:0;padding:0;cursor:pointer" data-photo="${esc(u)}"><img src="${esc(asset(u))}" alt=""></button>`).join('') || '<p class="muted">אין עדיין תמונות - העלו תמונה</p>';
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
    try {
      const fd = new FormData();
      fd.append('file', await shrinkImage(f), 'photo.jpg');
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
    $('#events-list').innerHTML = list.map((e) => `<div class="card flat" id="ev-${esc(e.code)}"><div class="row between"><h3 style="margin:0">${esc(e.name)}</h3><a class="btn sm" href="event.html?c=${esc(e.code)}">פתיחה</a></div><div class="grid sm" style="margin-top:10px"></div></div>`).join('');
    for (const e of list) {
      try {
        const d = await api(`/api/event/${e.code}/me`, { headers: { 'x-guest-id': e.guestId, 'x-guest-token': e.guestToken } });
        $(`#ev-${e.code} .grid`).innerHTML = d.photos.map((p) => `<div class="photo-tile">${p.kind === 'animation' ? `<video src="${esc(asset(p.url))}" muted loop autoplay playsinline></video>` : `<img src="${esc(asset(p.url))}" alt="" loading="lazy">`}</div>`).join('');
      } catch { /* התעלמות */ }
    }
  }

  // ---------- ההזמנות שלי ----------
  async function renderOrders() {
    const list = myOrders.all();
    if (!list.length) { $('#orders-list').innerHTML = '<p class="muted">אין הזמנות עדיין.</p>'; return; }
    $('#orders-list').innerHTML = list.map((o) => `<a class="card flat row between" style="text-decoration:none;color:inherit" href="track.html?id=${esc(o.id)}&t=${esc(o.t)}" data-o="${esc(o.id)}"><b>הזמנה #${esc(o.number)}</b><span class="muted small">${fmtDate(o.at)}</span><span class="badge" data-st>…</span></a>`).join('');
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
      PHOTOS.setCustom(catalog.categories);
      renderHero();
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
