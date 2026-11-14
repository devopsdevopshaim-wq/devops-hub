/* global $, $$, api, esc, toast, store, money, fmtDate, myEvents, myOrders, asset, shrinkImage, PHOTOS, icon, offerInstall, club, PhotoEditor */
(function () {
  let catalog = { categories: [], collections: [], products: [], promotions: [], events: [], banners: [] };
  let coupon = store.get('coupon', '');
  let lastQuote = null;
  let cfg = {};
  let activeCat = 'all';
  let activeEvent = '';
  let query = '';
  let sort = 'recommended';
  let cart = store.get('cart', []).filter((i) => i && i.productId);
  let pending = null; // { product, variant } שממתין לבחירת תמונה
  let rewardId = ''; // הטבת נקודות שנבחרה בסל
  // "להזמנה מהתמונה": תמונה מהאירוע שהלקוח בחר, ממתינה למוצר
  let photoPick = (new URLSearchParams(location.search).get('photo') || '').match(/^\/img\/[a-f0-9]{24}$/) ? new URLSearchParams(location.search).get('photo') : '';

  // ---------- ניווט ----------
  function go(view) {
    $$('[data-view]').forEach((t) => t.classList.toggle('active', t.dataset.view === view));
    ['store', 'events', 'orders'].forEach((v) => $(`#view-${v}`).classList.toggle('hidden', v !== view));
    if (view === 'events') renderEvents();
    if (view === 'orders') renderOrders();
    history.replaceState(null, '', `${location.pathname}${photoPick ? `?photo=${encodeURIComponent(photoPick)}` : ''}#${view}`);
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-view]');
    if (t) go(t.dataset.view);
    if (e.target.closest('[data-open-cart]')) openCart();
  });
  const toShop = () => $('#shop').scrollIntoView({ behavior: 'smooth', block: 'start' });
  // מעבר מסך לפי הכתובת (קישורים עם #store / #events / #orders, וכפתור "חזרה")
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (['store', 'events', 'orders'].includes(h)) go(h); });

  // ---------- מוצרים ----------
  const imgs = (p) => (p.images && p.images.length ? p.images : (p.image ? [p.image] : []));
  const thumb = (p, w, h) => (imgs(p).length ? `<img src="${esc(asset(imgs(p)[0]))}" alt="" loading="lazy" decoding="async">` : PHOTOS.img(p.category, p.name, w, h));
  const now = (x) => (x.salePrice !== null && x.salePrice !== undefined && x.salePrice < x.price ? x.salePrice : x.price);
  const fromPrice = (p) => (p.variants && p.variants.length ? Math.min(...p.variants.map(now)) : now(p));
  function priceHtml(x) {
    return x.salePrice !== null && x.salePrice !== undefined && x.salePrice < x.price
      ? `<span class="price sale">${money(x.salePrice)}</span><span class="old-price">${money(x.price)}</span>`
      : `<span class="price">${money(x.price)}</span>`;
  }
  const cardPrice = (p) => (p.variants && p.variants.length
    ? `<span class="from">החל מ-</span><span class="price${p.variants.some((v) => v.salePrice !== null) ? ' sale' : ''}">${money(fromPrice(p))}</span>`
    : priceHtml(p));
  const needsChoice = (p) => (p.variants && p.variants.length) || p.needsPhoto;

  function productCard(p) {
    const n = imgs(p).length;
    return `<article class="card product">
      <div class="thumb" data-show="${esc(p.id)}" role="button" tabindex="0" aria-label="${esc(p.name)}: פרטים ותמונות">
        ${thumb(p, 640, 480)}
        ${p.promo ? `<span class="sale-badge">${esc(p.promo.badge || 'מבצע')}</span>` : ''}
        ${p.sold >= 3 ? '<span class="hot-badge">🔥 נמכר הרבה</span>' : ''}
        ${n > 1 ? `<span class="badge" style="position:absolute;bottom:6px;left:6px">📷 ${n}</span>` : ''}
      </div>
      <h3>${esc(p.name)}</h3>
      <p class="muted small">${esc(String(p.description || '').slice(0, 90))}${String(p.description || '').length > 90 ? '…' : ''}</p>
      <div class="row between"><span>${cardPrice(p)}</span>
      <button class="btn sm" data-add="${esc(p.id)}" aria-label="${needsChoice(p) ? 'בחירה' : 'הוספה לסל'}: ${esc(p.name)}">${p.variants && p.variants.length ? `${icon('plus')}בחירת גודל` : p.needsPhoto ? `${icon('camera')}בחירת תמונה` : `${icon('cart')}לסל`}</button></div>
    </article>`;
  }

  // דף מוצר: גלריה, גדלים, תיאור
  let modalVariant = '';
  function showProduct(p) {
    const im = imgs(p);
    modalVariant = p.variants && p.variants.length ? (p.variants.find((v) => /6x9|15x15/.test(v.name)) || p.variants[0]).name : '';
    const draw = () => {
      const v = (p.variants || []).find((x) => x.name === modalVariant);
      $('#pm-price').innerHTML = priceHtml(v || p);
      $$('#pm-sizes [data-size]').forEach((b) => b.setAttribute('aria-checked', b.dataset.size === modalVariant));
    };
    $('#product-body').innerHTML = `
      <div class="row between"><h2 style="margin:0">${esc(p.name)}</h2><button class="icon-btn" data-pclose aria-label="סגירה">✕</button></div>
      ${im.length ? `<div class="gallery" id="gallery">${im.map((u) => `<img src="${esc(asset(u))}" alt="">`).join('')}</div>
        ${im.length > 1 ? `<div class="gallery-dots" id="gallery-dots">1 / ${im.length} · מחליקים לתמונה הבאה</div>` : ''}`
        : `<div style="border-radius:14px;overflow:hidden;aspect-ratio:4/3">${PHOTOS.img(p.category, p.name, 1000, 750)}</div>`}
      ${p.promo ? `<p style="margin:10px 0 0"><span class="sale-badge" style="position:static">${esc(p.promo.badge || 'מבצע')}</span> ${esc(p.promo.name)}</p>` : ''}
      <p style="white-space:pre-line">${esc(p.description)}</p>
      ${p.variants && p.variants.length ? `<div class="field"><label>גודל</label><div class="sizes" id="pm-sizes" role="radiogroup" aria-label="גודל">
        ${p.variants.map((v) => `<button type="button" role="radio" data-size="${esc(v.name)}"><b>${esc(v.name)}</b><span>${money(now(v))}</span></button>`).join('')}</div></div>` : ''}
      ${p.needsPhoto ? `<p class="muted small">${photoPick ? '✓ המוצר יוכן מהתמונה שבחרתם מהאירוע' : 'בשלב הבא בוחרים תמונה מהאירוע או מהטלפון'}</p>` : ''}
      <div class="row between"><span id="pm-price"></span><button class="btn gold" id="pm-add">${icon('cart')}הוספה לסל</button></div>`;
    $('#product-modal').classList.remove('hidden');
    draw();
    $$('#pm-sizes [data-size]').forEach((b) => { b.onclick = () => { modalVariant = b.dataset.size; draw(); }; });
    $('#pm-add').onclick = () => { $('#product-modal').classList.add('hidden'); choose(p, modalVariant); };
    const g = $('#gallery');
    if (g && im.length > 1) g.onscroll = () => { $('#gallery-dots').textContent = `${Math.round(Math.abs(g.scrollLeft) / g.clientWidth) + 1} / ${im.length}`; };
  }
  // אחרי בחירת גודל: תמונה (אם צריך) ואז לסל
  function choose(p, variant) {
    if (p.needsPhoto && photoPick) return editPhoto(p, variant, photoPick);
    if (p.needsPhoto) return openPhotoModal(p, variant);
    return addToCart(p, variant);
  }
  const product = (id) => catalog.products.find((x) => x.id === id);
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-show]');
    if (t) showProduct(product(t.dataset.show));
    if (e.target.closest('[data-pclose]') || e.target.id === 'product-modal') $('#product-modal').classList.add('hidden');
    const b = e.target.closest('[data-add]');
    if (b) {
      const p = product(b.dataset.add);
      if (p.variants && p.variants.length) showProduct(p); else choose(p, '');
    }
  });
  document.addEventListener('keydown', (e) => {
    const t = e.target.closest && e.target.closest('[data-show]');
    if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); showProduct(product(t.dataset.show)); }
  });

  // ---------- באנרים מתחלפים ----------
  let bannerTimer = null;
  function renderBanners() {
    const list = catalog.banners || [];
    $('#banners-wrap').classList.toggle('hidden', !list.length);
    if (!list.length) return;
    $('#banners').innerHTML = list.map((b, i) => `<div class="banner" role="group" aria-roledescription="באנר" aria-label="${i + 1} מתוך ${list.length}" style="--img:url('${esc(asset(b.image))}')">
      <div class="banner-text"><h3>${esc(b.name)}</h3>${b.subtitle ? `<p>${esc(b.subtitle)}</p>` : ''}
      ${b.linkType !== 'none' ? `<button class="btn gold sm" data-banner="${i}">${esc(b.cta || 'לפרטים')}</button>` : ''}</div></div>`).join('');
    $('#banner-dots').innerHTML = list.map((_, i) => `<button aria-label="באנר ${i + 1}" data-dot="${i}"${i ? '' : ' aria-current="true"'}></button>`).join('');
    const track = $('#banners');
    const at = () => Math.round(Math.abs(track.scrollLeft) / track.clientWidth);
    const to = (i) => track.scrollTo({ left: -i * track.clientWidth * (getComputedStyle(track).direction === 'rtl' ? 1 : -1), behavior: 'smooth' });
    track.onscroll = () => $$('#banner-dots button').forEach((d, i) => d.toggleAttribute('aria-current', i === at()));
    $('#banner-dots').onclick = (e) => { const d = e.target.closest('[data-dot]'); if (d) to(Number(d.dataset.dot)); };
    track.onclick = (e) => {
      const btn = e.target.closest('[data-banner]');
      if (!btn) return;
      const b = list[btn.dataset.banner];
      if (b.linkType === 'category') { activeCat = b.linkValue; activeEvent = ''; renderStore(); toShop(); }
      if (b.linkType === 'event') { activeEvent = b.linkValue; activeCat = 'all'; renderStore(); toShop(); }
      if (b.linkType === 'product' && product(b.linkValue)) showProduct(product(b.linkValue));
      if (b.linkType === 'url' && /^https:\/\//.test(b.linkValue)) window.open(b.linkValue, '_blank', 'noopener');
    };
    clearInterval(bannerTimer);
    if (list.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      bannerTimer = setInterval(() => { if (!document.hidden && !track.matches(':hover')) to((at() + 1) % list.length); }, 5500);
      track.addEventListener('touchstart', () => clearInterval(bannerTimer), { once: true, passive: true });
    }
  }

  // ---------- קנו לפי אירוע ----------
  function renderEventsRow() {
    $('#events-row').innerHTML = (catalog.events || []).map((ev) => `<button class="event-card${activeEvent === ev.id ? ' active' : ''}" data-event="${esc(ev.id)}" aria-pressed="${activeEvent === ev.id}">
      <img src="${esc(asset(ev.image))}" alt="" loading="lazy" decoding="async"><span>${esc(ev.name)}</span></button>`).join('');
  }
  $('#events-row').addEventListener('click', (e) => {
    const b = e.target.closest('[data-event]');
    if (!b) return;
    activeEvent = activeEvent === b.dataset.event ? '' : b.dataset.event;
    activeCat = 'all';
    renderStore();
    if (activeEvent) toShop();
  });

  // ---------- החנות ----------
  function promoText(p) {
    const v = p.kind === 'percent' ? `${p.value}% הנחה` : p.kind === 'amount' ? `${money(p.value)} הנחה` : `ב-${money(p.value)} בלבד`;
    return `🏷️ ${esc(p.name)}: ${v}${p.minSubtotal ? ` בהזמנה מעל ${money(p.minSubtotal)}` : ''}${p.endDate ? ` · עד ${new Date(p.endDate).toLocaleDateString('he-IL')}` : ''}`;
  }

  function visibleProducts() {
    const q = query.trim().toLowerCase();
    let list = catalog.products.filter((p) => (q || activeEvent || !(p.collectionIds || []).length)
      && (activeCat === 'all' || p.category === activeCat)
      && (!activeEvent || !(p.eventTypes || []).length || p.eventTypes.includes(activeEvent))
      && (!photoPick || p.needsPhoto)
      && (!q || `${p.name} ${p.description || ''}`.toLowerCase().includes(q)));
    if (sort === 'sold') list = list.slice().sort((a, b) => (b.sold || 0) - (a.sold || 0));
    if (sort === 'low') list = list.slice().sort((a, b) => fromPrice(a) - fromPrice(b));
    if (sort === 'high') list = list.slice().sort((a, b) => fromPrice(b) - fromPrice(a));
    if (sort === 'sale') list = list.filter((p) => p.promo || (p.variants || []).some((v) => v.salePrice !== null));
    return list;
  }

  function renderStore() {
    $('#promo-strip').innerHTML = (catalog.promotions || []).map((p) => `<span class="chip">${promoText(p)}</span>`).join('');
    const cl = catalog.club || {};
    $('#club-strip').innerHTML = cl.enabled ? `<button class="club-strip" data-view="orders">
      <span class="gem">💎</span><span><b>מועדון פריים:</b> ${cl.earnPercent}% מכל קנייה חוזרים אליכם בנקודות, ומ-${cl.minPoints} נקודות מקבלים הנחות ומתנות</span>
      <span class="club-bal" id="club-bal">${store.get('clubPoints', null) !== null && club.get() ? `${store.get('clubPoints')} נק׳` : 'לפרטים'}</span></button>` : '';
    $('#collections').innerHTML = query || activeEvent || photoPick ? '' : catalog.collections.map((c) => `
      <div class="card" style="margin-bottom:12px">
        <div class="row between"><h2 style="margin:0">${esc(c.icon)} ${esc(c.name)}</h2>${c.endDate ? `<span class="badge warn">עד ${new Date(c.endDate).toLocaleDateString('he-IL')}</span>` : ''}</div>
        <div class="grid" style="margin-top:12px">${catalog.products.filter((p) => (p.collectionIds || []).includes(c.id)).map(productCard).join('')}</div>
      </div>`).join('');
    const tile = (id, label, art) => `<button class="print-tile${activeCat === id ? ' active' : ''}" data-cat="${esc(id)}" role="tab" aria-selected="${activeCat === id}">
        <span class="pin"></span><span class="art">${art}</span><span class="label">${esc(label)}</span></button>`;
    $('#cat-tabs').innerHTML = [tile('all', 'הכול', '<img src="icons/icon.svg" alt="">')]
      .concat(catalog.categories.map((c) => tile(c.id, c.name, PHOTOS.img(c.id, c.name, 400, 300)))).join('');
    renderEventsRow();
    const ev = (catalog.events || []).find((x) => x.id === activeEvent);
    $('#filters').innerHTML = [
      ev ? `<button class="chip-x" data-clear="event">${esc(ev.name)} ✕</button>` : '',
      photoPick ? `<span class="chip-photo"><img src="${esc(asset(photoPick))}" alt="">מוצרים מהתמונה שבחרתם<button class="chip-x" data-clear="photo" aria-label="ביטול">✕</button></span>` : '',
    ].join('');
    const list = visibleProducts();
    $('#products').innerHTML = list.map(productCard).join('') || `<div class="empty"><p>לא מצאנו מוצרים${query ? ` ל"${esc(query)}"` : ''}.</p><button class="btn soft" data-clear="all">ניקוי החיפוש</button></div>`;
    $('#shop-count').textContent = `${list.length} מוצרים`;
  }

  $('#cat-tabs').addEventListener('click', (e) => {
    const t = e.target.closest('[data-cat]');
    if (!t) return;
    activeCat = t.dataset.cat;
    renderStore();
    const cur = $(`#cat-tabs [data-cat="${activeCat}"]`);
    cur.classList.add('flash'); // הבזק מצלמה
    setTimeout(() => cur.classList.remove('flash'), 500);
  });
  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-clear]');
    if (!c) return;
    if (c.dataset.clear === 'event' || c.dataset.clear === 'all') activeEvent = '';
    if (c.dataset.clear === 'photo' || c.dataset.clear === 'all') { photoPick = ''; history.replaceState(null, '', `${location.pathname}#store`); }
    if (c.dataset.clear === 'all') { query = ''; $('#q').value = ''; activeCat = 'all'; sort = 'recommended'; $('#sort').value = sort; }
    renderStore();
  });
  let typing = null;
  $('#q').addEventListener('input', (e) => { clearTimeout(typing); typing = setTimeout(() => { query = e.target.value; renderStore(); }, 180); });
  $('#sort').addEventListener('change', (e) => { sort = e.target.value; renderStore(); });

  // פתיח: תמונת רקע אמיתית ושלוש "הדפסות" במניפה
  function renderHero() {
    $('.stage').style.setProperty('--hero-photo', `url("${PHOTOS.hero}")`);
    $('.stage').classList.add('has-photo');
    $('#hero-fan').innerHTML = [['magnets', 'מגנטים'], ['blocks', 'בלוקים'], ['frames', 'מסגרות']]
      .map(([k, l]) => `<div class="print-tile"><span class="pin"></span><span class="art">${PHOTOS.img(k, l, 480, 360)}</span><span class="label">${l}</span></div>`).join('');
  }
  renderHero();

  // ---------- סל ----------
  function saveCart() {
    store.set('cart', cart);
    const n = cart.reduce((s, i) => s + i.qty, 0);
    ['#cart-count', '#cart-count-nav'].forEach((sel) => { $(sel).textContent = n; $(sel).classList.toggle('hidden', !n); });
  }

  function addToCart(p, variant = '', photoUrl = '') {
    const key = `${p.id}|${variant}|${photoUrl}`;
    const ex = cart.find((i) => i.key === key);
    const v = (p.variants || []).find((x) => x.name === variant);
    if (ex) ex.qty++;
    else cart.push({ key, productId: p.id, variant, name: variant ? `${p.name} (${variant})` : p.name, price: now(v || p), icon: p.icon, img: imgs(p)[0] || '', category: p.category, qty: 1, photoUrl });
    saveCart();
    lastQuote = null;
    bump();
    toast(`נוסף לסל: ${p.name}${variant ? ` (${variant})` : ''}`);
    if (!$('#cart').classList.contains('hidden')) renderCart();
  }
  // הסל "קופץ" כשמוסיפים
  function bump() { $$('#cart-btn, .bottom-nav [data-open-cart]').forEach((b) => { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }); }

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
      $('#cart-items').innerHTML = `<div class="empty"><p>הסל עדיין ריק.</p><button class="btn soft" id="cart-shop">${icon('store')}לחנות</button></div>`;
      $('#cart-shop').onclick = () => { closeCart(); go('store'); toShop(); };
      $('#cart-summary').innerHTML = '';
      $('#cart-extra').innerHTML = '';
      $('#checkout').classList.add('hidden');
      return;
    }
    const q = lastQuote && lastQuote.lines.length === cart.length ? lastQuote : null;
    $('#cart-items').innerHTML = cart.map((i, idx) => {
      const l = q && q.lines[idx];
      const unit = l ? l.price : i.price;
      const orig = l ? l.originalPrice : unit;
      const pic = i.photoUrl || i.img;
      return `
      <div class="row cart-line" style="align-items:flex-start">
        <div class="photo-tile" style="width:64px;flex:none">${pic ? `<img src="${esc(asset(pic))}" alt="">` : PHOTOS.img(i.category || 'packages', '', 160, 160)}</div>
        <div style="flex:1"><b>${esc(i.name)}</b><div class="muted small">${money(unit)} ליחידה${orig > unit ? ` <span class="old-price">${money(orig)}</span>` : ''}</div>
          ${l && (l.promo || l.coupon) ? `<div class="small" style="color:var(--bad);font-weight:700">🏷️ ${[l.promo && esc(l.promo.name), l.coupon && `קופון ${esc(l.coupon.code)}`].filter(Boolean).join(' + ')}</div>` : ''}
          <div class="row" style="gap:6px;margin-top:4px"><button class="btn soft sm" data-q="${idx}" data-d="-1" aria-label="פחות">−</button><b>${i.qty}</b><button class="btn soft sm" data-q="${idx}" data-d="1" aria-label="עוד אחד">+</button>
          ${i.photoUrl && editorOn() ? `<button class="btn ghost sm" data-edit="${idx}">✏️ עריכת התמונה</button>` : ''}</div></div>
        <b>${money(unit * i.qty)}</b>
      </div>`;
    }).join('');
    const local = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const t = q || { subtotalBefore: local, discount: 0, subtotal: local, shipping: local >= cfg.freeShippingFrom ? 0 : cfg.shippingPrice, total: 0 };
    if (!q) t.total = t.subtotal + t.shipping;
    // פס משלוח חינם
    const left = Math.max(0, cfg.freeShippingFrom - t.subtotal);
    const pct = cfg.freeShippingFrom ? Math.min(100, Math.round((t.subtotal / cfg.freeShippingFrom) * 100)) : 100;
    const ship = `<div class="ship-bar${left ? '' : ' done'}"><div class="ship-text">${left ? `${icon('truck')}עוד <b>${money(left)}</b> ומשלוח חינם` : `${icon('truck')}<b>המשלוח עליכם חינם!</b>`}</div>
      <div class="ship-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div></div>`;
    $('#cart-summary').innerHTML = `${ship}<div class="card flat">
      ${t.discount ? `<div class="row between"><span>לפני הנחות</span><span class="old-price" style="margin:0">${money(t.subtotalBefore)}</span></div>
        <div class="row between" style="color:var(--bad);font-weight:700"><span>🏷️ חסכתם</span><span>−${money(t.discount)}</span></div>` : ''}
      <div class="row between"><span>סכום ביניים</span><b>${money(t.subtotal)}</b></div>
      <div class="row between"><span>משלוח</span><b>${t.shipping ? money(t.shipping) : 'חינם'}</b></div>
      <hr style="border:0;border-top:1px solid var(--border)"><div class="row between"><span>סה"כ לתשלום</span><span class="price">${money(t.total)}</span></div>
      <form class="row" id="coupon-form" style="margin-top:10px;flex-wrap:nowrap"><input id="coupon" placeholder="קוד קופון" value="${esc(coupon)}" style="flex:1" autocomplete="off" aria-label="קוד קופון"><button class="btn soft sm">החלה</button></form>
      ${q && q.code ? `<div class="small" style="margin-top:4px;color:${q.codeUsed ? 'var(--ok)' : 'var(--bad)'}">${q.codeUsed ? `✓ הקופון ${esc(q.code)} הופעל` : q.codeValid ? 'הקופון תקף, אבל לא חל על המוצרים בסל' : 'קוד הקופון לא תקף'}</div>` : ''}
    </div>`;
    // מועדון: כמה נקודות יצברו, ומימוש הטבה כשיש מספיק
    const cq = q && q.club;
    const rewards = (catalog.club && catalog.club.rewards) || [];
    const clubBox = cq && cq.enabled ? `<div class="club-box">
      <div class="row between"><b>💎 מועדון פריים</b>${cq.member ? `<span>יש לכם <b>${cq.points}</b> נקודות</span>` : ''}</div>
      <div class="small">בהזמנה הזו תצברו <b>${cq.earn}</b> נקודות${cq.member ? '' : ' (החשבון נפתח אוטומטית עם ההזמנה)'}</div>
      ${cq.member && cq.canRedeem ? `<div class="rewards" role="radiogroup" aria-label="מימוש נקודות">
        <label class="reward-opt"><input type="radio" name="reward" value=""${rewardId ? '' : ' checked'}> בלי מימוש הפעם</label>
        ${rewards.map((r) => `<label class="reward-opt${cq.points < r.points ? ' off' : ''}"><input type="radio" name="reward" value="${esc(r.id)}"${rewardId === r.id ? ' checked' : ''}${cq.points < r.points ? ' disabled' : ''}>
          <span>${r.kind === 'gift' ? '🎁' : '🏷️'} ${esc(r.name)}</span><span class="cost">${r.points} נק׳</span></label>`).join('')}</div>`
      : cq.member ? `<div class="small muted">מימוש נקודות מ-${cq.minPoints} נקודות. חסרות לכם ${Math.max(0, cq.minPoints - cq.points)}.</div>` : ''}
      ${cq.reward ? `<div class="small" style="color:var(--ok);font-weight:700">✓ ${esc(cq.reward.name)} (${cq.reward.points} נקודות ירדו אחרי התשלום)</div>` : ''}
      ${cq.rewardError ? `<div class="small" style="color:var(--bad)">${esc(cq.rewardError)}</div>` : ''}
    </div>` : '';
    // אולי תאהבו גם: מוצרים שסומנו "הצעה בסל" ועוד לא בסל
    const inCart = new Set(cart.map((i) => i.productId));
    const ups = catalog.products.filter((p) => p.upsell && !inCart.has(p.id)).slice(0, 2);
    $('#cart-extra').innerHTML = clubBox + (ups.length ? `<h3 style="margin:14px 0 8px">אולי תאהבו גם</h3><div class="upsell">${ups.map((p) => `
      <div class="up-card"><div class="photo-tile">${thumb(p, 240, 240)}</div><div><b>${esc(p.name)}</b><div>${cardPrice(p)}</div></div>
      <button class="btn soft sm" data-add="${esc(p.id)}" aria-label="הוספה: ${esc(p.name)}">${icon('plus')}</button></div>`).join('')}</div>` : '');
    $$('#cart-extra input[name="reward"]').forEach((r) => { r.onchange = () => { rewardId = r.value; lastQuote = null; refreshQuote(); }; });
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
      const q = await api('/api/cart/quote', { method: 'POST', body: { code: coupon, clubToken: club.get(), rewardId, items: cart.map(({ productId, variant, qty }) => ({ productId, variant, qty })) } });
      if (q.club && q.club.member) store.set('clubPoints', q.club.points);
      if (my !== quoting) return;
      lastQuote = q;
      if (!$('#cart').classList.contains('hidden')) renderCart();
    } catch (err) {
      toast(/לא זמין|גודל/.test(err.message) ? `${err.message}. הסירו את המוצר מהסל ובחרו מחדש.` : err.message, 5000);
    }
  }

  $('#cart-items').addEventListener('click', (e) => {
    const ed = e.target.closest('[data-edit]');
    if (ed) {
      const i = cart[ed.dataset.edit];
      const p = catalog.products.find((x) => x.id === i.productId);
      if (p) { closeCart(); editPhoto(p, i.variant, i.photoUrl, i.key); }
      return;
    }
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
      const r = await api('/api/orders', { method: 'POST', body: { customer, code: coupon, clubToken: club.get(), rewardId, items: cart.map(({ productId, variant, qty, photoUrl }) => ({ productId, variant, qty, photoUrl })) } });
      if (r.clubToken) club.set(r.clubToken);
      rewardId = '';
      myOrders.add({ id: r.orderId, number: r.number, t: r.trackToken, at: new Date().toISOString() });
      cart = [];
      coupon = '';
      store.set('coupon', '');
      saveCart();
      location.href = r.redirectUrl;
    } catch (err) {
      toast(err.message, 5000);
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

  async function openPhotoModal(p, variant) {
    pending = { product: p, variant };
    $('#photo-modal').classList.remove('hidden');
    $('#my-photos').innerHTML = '<p class="muted">טוען…</p>';
    const urls = [...new Set(await myPhotoUrls())];
    $('#my-photos').innerHTML = urls.map((u) => `<button class="photo-tile" style="border:0;padding:0;cursor:pointer" data-photo="${esc(u)}" aria-label="בחירת התמונה"><img src="${esc(asset(u))}" alt=""></button>`).join('') || '<p class="muted">אין עדיין תמונות. מעלים תמונה מהטלפון.</p>';
  }
  $('#photo-modal').addEventListener('click', (e) => {
    if (e.target.closest('[data-close]') || e.target.id === 'photo-modal') $('#photo-modal').classList.add('hidden');
    const t = e.target.closest('[data-photo]');
    if (t) { $('#photo-modal').classList.add('hidden'); editPhoto(pending.product, pending.variant, t.dataset.photo); }
  });
  $('#store-upload').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    $('#photo-modal').classList.add('hidden');
    if (editorOn()) return editPhoto(pending.product, pending.variant, f);
    try { addToCart(pending.product, pending.variant, await uploadPhoto(await shrinkImage(f))); } catch (err) { toast(err.message); }
  });

  // ---------- עריכת התמונה לפני ההזמנה ----------
  // הלקוח עורך כרצונו: חיתוך לגודל המוצר, AI, פילטרים, טקסט, מדבקות ומסגרות. המנהל קובע אילו כלים פתוחים.
  const editorOn = () => Boolean(window.PhotoEditor) && !(cfg.editor && cfg.editor.store === false);
  async function uploadPhoto(blob) {
    const fd = new FormData();
    fd.append('file', blob, 'photo.jpg');
    const r = await api('/api/uploads', { method: 'POST', body: fd });
    store.set('uploadedPhotos', [r.url, ...store.get('uploadedPhotos', [])].slice(0, 30));
    return r.url;
  }
  // יחס החיתוך לפי המידה שנבחרה ("6x9 ס"מ") או שם המוצר; מוצר בלי מידה - היחס של התמונה
  const aspectFor = (p, variant) => {
    const src = /\d\s*[x×]\s*\d/i.test(variant || '') ? variant : p.name;
    return /\d\s*[x×]\s*\d/i.test(src || '') ? PhotoEditor.aspectFromSize(String(src).replace('×', 'x')) : 'free';
  };
  function closeEditor() { $('#editor-modal').classList.add('hidden'); $('#store-editor').innerHTML = ''; document.body.classList.remove('no-scroll'); }
  // src: קובץ מהטלפון או כתובת של תמונה שכבר במערכת. replaceKey: עריכה מחדש של פריט שכבר בסל
  async function editPhoto(p, variant, src, replaceKey = '') {
    if (!editorOn()) { if (typeof src === 'string') addToCart(p, variant, src); return; }
    let file = src;
    if (typeof src === 'string') {
      try {
        const res = await fetch(asset(src));
        if (!res.ok) throw new Error();
        file = await res.blob();
      } catch { toast('לא הצלחנו לפתוח את התמונה לעריכה'); return addToCart(p, variant, src); }
    }
    $('#editor-modal').classList.remove('hidden');
    document.body.classList.add('no-scroll');
    const ed = cfg.editor || {};
    // eslint-disable-next-line no-new
    new PhotoEditor($('#store-editor'), {
      file, aspect: aspectFor(p, variant), allowAnimations: true, tools: ed.tools, ai: ed.ai,
      title: `עיצוב התמונה: ${p.name}${variant ? ` (${variant})` : ''}`, doneLabel: replaceKey ? 'שמירת השינויים ✓' : 'הוספה לסל ✓',
      onCancel: closeEditor,
      onPrint: async (blob) => {
        const btn = $('#ed-done');
        if (btn) { btn.disabled = true; btn.textContent = 'שומר…'; }
        try {
          const url = await uploadPhoto(blob);
          if (replaceKey) {
            const item = cart.find((i) => i.key === replaceKey);
            if (item) { item.photoUrl = url; item.key = `${item.productId}|${item.variant}|${url}`; saveCart(); renderCart(); toast('התמונה עודכנה ✓'); }
          } else addToCart(p, variant, url);
          closeEditor();
        } catch (err) { toast(err.message); if (btn) { btn.disabled = false; btn.textContent = 'נסו שוב'; } }
      },
      onAnimation: (blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${p.name}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`;
        a.click();
        toast('הסרטון נשמר בטלפון 🎬');
      },
    });
  }

  // ---------- האירועים שלי ----------
  async function renderEvents() {
    const list = myEvents.all();
    if (!list.length) { $('#events-list').innerHTML = '<p class="muted">עוד לא סרקתם QR באירוע. אחרי הסריקה האירוע והתמונות יישמרו כאן.</p>'; return; }
    $('#events-list').innerHTML = list.map((e) => `<div class="card flat" id="ev-${esc(e.code)}"><div class="row between"><h3 style="margin:0">${esc(e.name)}</h3><a class="btn sm" href="event.html?c=${esc(e.code)}">פתיחה</a></div><div class="grid sm" style="margin-top:10px"></div></div>`).join('');
    for (const e of list) {
      try {
        const d = await api(`/api/event/${e.code}/me`, { headers: { 'x-guest-id': e.guestId, 'x-guest-token': e.guestToken } });
        $(`#ev-${e.code} .grid`).innerHTML = d.photos.map((p) => `<div class="photo-tile">${p.kind === 'animation'
          ? `<video src="${esc(asset(p.url))}" muted loop autoplay playsinline></video>`
          : `<img src="${esc(asset(p.url))}" alt="" loading="lazy"><a class="order-photo" href="./?photo=${encodeURIComponent(p.url)}#store">${icon('cart')}להזמנה</a>`}</div>`).join('');
      } catch { /* התעלמות */ }
    }
  }

  // ---------- ההזמנות שלי ----------
  async function renderClub() {
    const cl = catalog.club || {};
    if (!cl.enabled) { $('#club-card').innerHTML = ''; return; }
    const rewardsHtml = (pts) => `<div class="reward-list">${(cl.rewards || []).map((r) => `<div class="reward-item${pts >= r.points && pts >= cl.minPoints ? ' ok' : ''}">
      <span class="ri-ico">${r.kind === 'gift' ? '🎁' : '🏷️'}</span><div><b>${esc(r.name)}</b>${r.description ? `<div class="small muted">${esc(r.description)}</div>` : ''}</div><span class="cost">${r.points} נק׳</span></div>`).join('')}</div>`;
    if (!club.get()) {
      $('#club-card').innerHTML = `<div class="club-card"><h2>💎 מועדון פריים</h2>
        <p>על כל קנייה <b>${cl.earnPercent}%</b> מהסכום חוזר אליכם בנקודות (נקודה = ₪1). מ-<b>${cl.minPoints}</b> נקודות מממשים אותן בהנחות ובמתנות.</p>
        <p class="small">החשבון נפתח אוטומטית עם ההזמנה הראשונה, לפי מספר הטלפון.</p>${rewardsHtml(0)}</div>`;
      return;
    }
    try {
      const me = await api(`/api/club/me?t=${club.get()}`);
      store.set('clubPoints', me.points);
      const pct = me.minPoints ? Math.min(100, Math.round((me.points / me.minPoints) * 100)) : 100;
      $('#club-card').innerHTML = `<div class="club-card"><div class="row between"><h2>💎 מועדון פריים</h2><span class="small">${esc(me.phone)}</span></div>
        <div class="club-points"><span class="big">${me.points}</span><span>נקודות</span></div>
        ${me.canRedeem ? '<p class="club-ok">✓ אפשר לממש! בוחרים הטבה בסל, לפני התשלום.</p>'
          : `<div class="ship-track" style="margin:8px 0"><span style="width:${pct}%"></span></div><p class="small">עוד ${me.minPoints - me.points} נקודות עד המימוש הראשון</p>`}
        ${rewardsHtml(me.points)}
        ${me.history.length ? `<details><summary>היסטוריית נקודות</summary><ul class="club-hist">${me.history.map((h) => `<li><span>${esc(h.note)}</span><b class="${h.points > 0 ? 'plus' : 'minus'}">${h.points > 0 ? '+' : ''}${h.points}</b><time>${fmtDate(h.at)}</time></li>`).join('')}</ul></details>` : ''}
      </div>`;
    } catch {
      $('#club-card').innerHTML = '';
    }
  }

  async function renderOrders() {
    renderClub();
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
      $('#brand-name').textContent = String(cfg.businessName || '').split(' - ')[0];
      document.title = cfg.businessName;
      PHOTOS.setCustom(catalog.categories);
      renderHero();
      renderBanners();
      renderStore();
      api('/api/cities').then((cities) => { $('#cities').innerHTML = cities.map((c) => `<option value="${esc(c.name)}">`).join(''); }).catch(() => {});
    } catch (e) { toast(e.message); }
    const hash = location.hash.slice(1);
    go(['store', 'events', 'orders'].includes(hash) ? hash : 'store');
    if (photoPick) { toShop(); toast('בחרו מה להכין מהתמונה: מגנט, בלוק, מסגרת או מתנה'); }
    setTimeout(() => offerInstall(), 2500);
  })();
}());
