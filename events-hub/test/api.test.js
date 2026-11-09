// בדיקות השרת. רצות מול אותו קוד שרץ ב-Cloudflare (src/app.js), עם אחסון בקובץ זמני.
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { start } from '../server.js';
import db from '../src/db.js';

let base;
let tok;
let server;

test.before(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'events-hub-'));
  server = await start({ port: 0, env: { DATA_DIR: dataDir, ADMIN_PASSWORD: 'test-pass', PAYMENT_PROVIDER: 'mock', RATE_LIMIT: 'off' } });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

async function call(method, url, body, headers = {}) {
  const opts = { method, headers: { ...headers }, redirect: 'manual' };
  if (tok && url.startsWith('/api/admin')) opts.headers.authorization = `Bearer ${tok}`;
  if (body instanceof FormData || typeof body === 'string') opts.body = body;
  else if (body) { opts.headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(base + url, opts);
  const type = res.headers.get('content-type') || '';
  return { status: res.status, headers: res.headers, data: type.includes('json') ? await res.json() : await res.text() };
}

const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');

let ev;
test('admin login required and works (bearer token)', async () => {
  assert.equal((await call('GET', '/api/admin/events')).status, 401);
  assert.equal((await call('POST', '/api/admin/login', { password: 'wrong' })).status, 401);
  const r = await call('POST', '/api/admin/login', { password: 'test-pass' });
  assert.equal(r.status, 200);
  tok = r.data.token;
  assert.equal((await call('GET', '/api/admin/me')).status, 200);
});

test('CORS lets the GitHub Pages site call the server', async () => {
  const r = await fetch(base + '/api/config', { method: 'OPTIONS', headers: { origin: 'https://devopsdevopshaim-wq.github.io' } });
  assert.equal(r.status, 204);
  assert.match(r.headers.get('access-control-allow-headers'), /Authorization/);
});

test('create event keeps at most 3 print options and links to the site', async () => {
  const r = await call('POST', '/api/admin/events', {
    name: 'חתונת בדיקה', photosPerGuest: 2,
    printOptions: [{ type: 'magnet', size: '6x9' }, { type: 'block', size: '15x15' }, { type: 'frame', size: '13x18' }, { type: 'magnet', size: '10x15' }],
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.printOptions.length, 3);
  assert.match(r.data.link, /\/event\.html\?c=[a-f0-9]{8}$/);
  ev = r.data;
});

test('guest photo quota is enforced and photos are served', async () => {
  const g = (await call('POST', `/api/event/${ev.code}/guest`, { name: 'אורח' })).data;
  const h = { 'x-guest-id': g.guestId, 'x-guest-token': g.guestToken };
  assert.equal(g.remaining, 2);
  const send = () => {
    const fd = new FormData();
    fd.append('kind', 'print');
    fd.append('printOptionId', ev.printOptions[0].id);
    fd.append('file', new Blob([JPEG], { type: 'image/jpeg' }), 'a.jpg');
    return call('POST', `/api/event/${ev.code}/photos`, fd, h);
  };
  const first = await send();
  assert.equal(first.status, 200);
  assert.match(first.data.photo.url, /^\/img\/[a-f0-9]{24}$/);
  const img = await fetch(base + first.data.photo.url);
  assert.equal(img.headers.get('content-type'), 'image/jpeg');
  assert.equal(Buffer.from(await img.arrayBuffer()).length, JPEG.length);
  const second = await send();
  assert.equal(second.data.remaining, 0);
  assert.equal((await send()).status, 403);
  const bad = await call('GET', `/api/event/${ev.code}/me`, null, { 'x-guest-id': g.guestId, 'x-guest-token': 'nope' });
  assert.equal(bad.status, 401);
});

test('uploads refuse non-image files', async () => {
  const fd = new FormData();
  fd.append('file', new Blob(['<script>alert(1)</script>'], { type: 'text/html' }), 'x.html');
  assert.equal((await call('POST', '/api/uploads', fd)).status, 400);
});

test('order from Beer Sheva is routed to Beer Sheva supplier and courier after payment', async () => {
  const r = await call('POST', '/api/orders', {
    customer: { name: 'לקוח', phone: '0500000000', city: 'באר שבע', address: 'רגר 1' },
    items: [{ productId: 'mag-6x9', variant: '6x9 ס\"מ', qty: 2, price: 1 }],
  });
  assert.equal(r.status, 200);
  const order = db.get('orders', r.data.orderId);
  assert.equal(order.total, 15 * 2 + 30, 'price comes from server, not client');
  assert.ok(r.data.redirectUrl.startsWith(base + '/pay/mock/'));
  const payId = r.data.redirectUrl.split('/').pop();
  const pay = await call('POST', `/pay/mock/${payId}`, 'result=approved', { 'content-type': 'application/x-www-form-urlencoded' });
  assert.equal(pay.status, 302);
  const back = await call('GET', new URL(pay.headers.get('location')).pathname + new URL(pay.headers.get('location')).search);
  assert.match(back.headers.get('location'), /\/track\.html\?id=.+&t=.+&new=1$/);
  assert.equal(order.status, 'paid');
  const supplier = db.get('suppliers', order.items[0].supplierId);
  const courier = db.get('couriers', order.courierId);
  assert.ok(supplier.cities.includes('באר שבע'));
  assert.ok(courier.cities.includes('באר שבע'));
  const track = await call('GET', `/api/orders/${order.id}?t=${order.trackToken}`);
  assert.equal(track.data.status, 'paid');
  assert.equal((await call('GET', `/api/orders/${order.id}?t=wrong`)).status, 404);
});

test('city with no local supplier falls back to region', async () => {
  const r = await call('POST', '/api/orders', {
    customer: { name: 'לקוח', phone: '050', city: 'אילת', address: 'x' }, items: [{ productId: 'block-15x15', variant: '15x15 ס\"מ', qty: 1 }],
  });
  const payId = r.data.redirectUrl.split('/').pop();
  await call('POST', `/pay/mock/${payId}`, 'result=approved', { 'content-type': 'application/x-www-form-urlencoded' });
  const order = db.get('orders', r.data.orderId);
  assert.ok(order.items[0].supplierId, 'regional supplier assigned');
  assert.equal(db.get('couriers', order.courierId).regions[0], 'דרום');
});

test('stuck orders are flagged and notes are recorded', async () => {
  const order = db.all('orders').find((o) => o.status === 'paid');
  order.statusChangedAt = new Date(Date.now() - 10 * 36e5).toISOString();
  const list = await call('GET', '/api/admin/orders?filter=stuck');
  assert.ok(list.data.some((o) => o.id === order.id));
  const upd = await call('POST', `/api/admin/orders/${order.id}/events`, { status: 'issue', note: 'תקוע אצל הספק', publicNote: true });
  assert.equal(upd.data.status, 'issue');
  const track = await call('GET', `/api/orders/${order.id}?t=${order.trackToken}`);
  assert.ok(track.data.timeline.some((t) => t.note === 'תקוע אצל הספק'));
});

test('product images: uploaded from the admin app and saved on the product', async () => {
  const fd = new FormData();
  fd.append('file', new Blob([JPEG], { type: 'image/jpeg' }), 'p.jpg');
  const up = await call('POST', '/api/admin/uploads', fd);
  assert.equal(up.status, 200);
  const p = db.get('products', 'gift-mug');
  const r = await call('PUT', '/api/admin/products/gift-mug', { ...p, price: 64.9, images: [up.data.url, 'https://example.com/a.jpg', 'javascript:alert(1)'] });
  assert.deepEqual(r.data.images, [up.data.url, 'https://example.com/a.jpg']);
  assert.equal(r.data.price, 64.9);
  const store = await call('GET', '/api/store');
  assert.equal(store.data.products.find((x) => x.id === 'gift-mug').images[0], up.data.url);
});

test('promotions: best price per product, coupon codes and minimum order', async () => {
  // 20% על כל המגנטים, פתוח לכולם
  const a = await call('POST', '/api/admin/promotions', { name: 'מבצע מגנטים', badge: '20%-', kind: 'percent', value: 20, scope: 'category', categories: ['magnets'] });
  assert.equal(a.status, 200);
  // מחיר קבוע 10 ₪ למגנט 6x9 עם קוד
  await call('POST', '/api/admin/promotions', { name: 'קופון חתונה', kind: 'price', value: 10, scope: 'products', productIds: ['mag-6x9'], code: 'wedding10' });
  // 50 ₪ הנחה לחבילת חינה בהזמנה מעל 2000
  await call('POST', '/api/admin/promotions', { name: 'חינה מעל 2000', kind: 'amount', value: 50, scope: 'products', productIds: ['pkg-henna'], minSubtotal: 2000 });
  // מבצע שהסתיים לא חל
  await call('POST', '/api/admin/promotions', { name: 'ישן', kind: 'percent', value: 90, scope: 'all', endDate: '2020-01-01' });

  const store = (await call('GET', '/api/store')).data;
  const mag = store.products.find((x) => x.id === 'mag-6x9');
  assert.equal(mag.salePrice, 12);
  assert.equal(mag.promo.badge, '20%-');
  assert.ok(!store.promotions.some((p) => p.name === 'קופון חתונה'), 'coupon promos stay hidden');

  let q = (await call('POST', '/api/cart/quote', { items: [{ productId: 'mag-6x9', variant: '6x9 ס\"מ', qty: 2 }] })).data;
  assert.equal(q.subtotal, 24);
  q = (await call('POST', '/api/cart/quote', { items: [{ productId: 'mag-6x9', variant: '6x9 ס\"מ', qty: 2 }], code: ' Wedding10 ' })).data;
  assert.equal(q.subtotal, 20);
  assert.equal(q.codeUsed, true);
  q = (await call('POST', '/api/cart/quote', { items: [{ productId: 'mag-6x9', variant: '6x9 ס\"מ', qty: 1 }], code: 'NOPE' })).data;
  assert.equal(q.codeValid, false);

  q = (await call('POST', '/api/cart/quote', { items: [{ productId: 'pkg-henna', qty: 1 }] })).data;
  assert.equal(q.subtotal, 1490, 'below the minimum: no discount');
  q = (await call('POST', '/api/cart/quote', { items: [{ productId: 'pkg-henna', qty: 1 }, { productId: 'pkg-mikveh', qty: 1 }] })).data;
  assert.equal(q.discount, 50);

  const bad = await call('POST', '/api/orders', { customer: { name: 'x', phone: '1', city: 'באר שבע', address: 'x' }, items: [{ productId: 'mag-6x9', variant: '6x9 ס\"מ', qty: 1 }], code: 'NOPE' });
  assert.equal(bad.status, 400);
  const o = await call('POST', '/api/orders', { customer: { name: 'x', phone: '1', city: 'באר שבע', address: 'x' }, items: [{ productId: 'mag-6x9', variant: '6x9 ס\"מ', qty: 3 }], code: 'wedding10' });
  const order = db.get('orders', o.data.orderId);
  assert.equal(order.subtotal, 30);
  assert.equal(order.discount, 15);
  assert.equal(order.coupon, 'WEDDING10');
  assert.equal(order.total, 60);
});

test('a coupon applies on top of an automatic sale', async () => {
  // הספל: 25% הנחה פתוחה + קופון של 10 ₪ על כל החנות
  await call('POST', '/api/admin/promotions', { name: 'מתנות 25', kind: 'percent', value: 25, scope: 'category', categories: ['gifts'] });
  await call('POST', '/api/admin/promotions', { name: 'קופון כלה', kind: 'amount', value: 10, scope: 'all', code: 'KALA' });
  const mug = db.get('products', 'gift-mug').price; // 64.9 מהבדיקה הקודמת
  const q = (await call('POST', '/api/cart/quote', { items: [{ productId: 'gift-mug', qty: 1 }], code: 'kala' })).data;
  assert.equal(q.lines[0].price, Math.round((mug * 0.75 - 10) * 100) / 100);
  assert.equal(q.codeUsed, true);
  assert.ok(q.lines[0].promo && q.lines[0].coupon);
});

test('category photo can be replaced from the admin app and reset', async () => {
  const fd = new FormData();
  fd.append('file', new Blob([JPEG], { type: 'image/jpeg' }), 'c.jpg');
  const up = (await call('POST', '/api/admin/uploads', fd)).data;
  assert.equal((await call('PUT', '/api/admin/categories/magnets', { image: up.url })).data.image, up.url);
  assert.equal((await call('PUT', '/api/admin/categories/magnets', { image: 'https://evil.example/x.jpg' })).status, 400);
  const store = (await call('GET', '/api/store')).data;
  assert.equal(store.categories.find((c) => c.id === 'magnets').image, up.url);
  assert.equal((await call('PUT', '/api/admin/categories/magnets', { image: '' })).data.image, '');
});

test('sizes: each size has its own price, chosen on the server', async () => {
  const store = (await call('GET', '/api/store')).data;
  const mag = store.products.find((p) => p.id === 'mag-6x9');
  assert.deepEqual(mag.variants.map((v) => v.price), [12, 15, 22]);
  const no = await call('POST', '/api/cart/quote', { items: [{ productId: 'mag-6x9', qty: 1 }] });
  assert.equal(no.status, 400);
  const fake = await call('POST', '/api/cart/quote', { items: [{ productId: 'mag-6x9', variant: '1x1', qty: 1 }] });
  assert.equal(fake.status, 400);
  const big = (await call('POST', '/api/cart/quote', { items: [{ productId: 'mag-6x9', variant: '10x15 ס"מ', qty: 2 }] })).data;
  // מבצע 20% על מגנטים מהבדיקה הקודמת: 22 * 0.8 = 17.6
  assert.equal(big.lines[0].price, 17.6);
  const o = await call('POST', '/api/orders', { customer: { name: 'x', phone: '1', city: 'באר שבע', address: 'x' }, items: [{ productId: 'mag-6x9', variant: '10x15 ס"מ', qty: 1 }] });
  assert.equal(db.get('orders', o.data.orderId).items[0].name, 'מגנט תמונה 6x9 (10x15 ס"מ)');
});

test('shop by event, banners, best sellers and admin stats', async () => {
  const store = (await call('GET', '/api/store')).data;
  assert.ok(store.events.some((e) => e.id === 'henna'));
  assert.deepEqual(store.products.find((p) => p.id === 'pkg-henna').eventTypes, ['henna']);
  assert.ok(store.banners.length >= 3);
  assert.ok(store.products.find((p) => p.id === 'mag-6x9').sold > 0, 'paid orders count as sold');
  const bn = await call('POST', '/api/admin/banners', { name: 'מבצע חנוכה', image: 'javascript:alert(1)', linkType: 'url', linkValue: 'http://x' });
  assert.equal(bn.data.image, '');
  assert.equal(bn.data.linkValue, '');
  const st = (await call('GET', '/api/admin/stats')).data;
  assert.equal(st.days.length, 30);
  assert.ok(st.revenue > 0 && st.top.length > 0);
  assert.equal(st.promo.orders, 0, 'unpaid orders with a discount do not count');
  // הזמנה עם מבצע ששולמה נספרת בביצועי המבצעים
  const o = (await call('POST', '/api/orders', { customer: { name: 'x', phone: '1', city: 'באר שבע', address: 'x' }, items: [{ productId: 'mag-6x9', variant: '6x9 ס"מ', qty: 4 }] })).data;
  await call('POST', `/pay/mock/${o.redirectUrl.split('/').pop()}`, 'result=approved', { 'content-type': 'application/x-www-form-urlencoded' });
  const st2 = (await call('GET', '/api/admin/stats')).data;
  assert.equal(st2.promo.orders, 1);
  assert.ok(st2.promo.discount > 0);
  const pe = await call('PUT', '/api/admin/products/pkg-henna', { ...db.get('products', 'pkg-henna'), eventTypes: ['henna', 'nope'] });
  assert.deepEqual(pe.data.eventTypes, ['henna']);
});

test('points club: earn 10% on paid orders, redeem above the minimum, protected by the club key', async () => {
  const cust = { name: 'נועה', phone: '054-777-8899', city: 'באר שבע', address: 'x' };
  const buy = async (items, extra = {}) => {
    const r = await call('POST', '/api/orders', { customer: cust, items, ...extra });
    if (r.status !== 200) return r;
    await call('POST', `/pay/mock/${r.data.redirectUrl.split('/').pop()}`, 'result=approved', { 'content-type': 'application/x-www-form-urlencoded' });
    return r;
  };
  // הזמנה ראשונה: נפתח חשבון והמפתח חוזר ללקוח
  const first = await buy([{ productId: 'pkg-birthday', qty: 1 }]); // 790
  const tokenKey = first.data.clubToken;
  assert.match(tokenKey, /^[a-f0-9]{32}$/);
  let me = (await call('GET', `/api/club/me?t=${tokenKey}`)).data;
  assert.equal(me.points, 79, '10% of 790');
  assert.equal(me.canRedeem, false, 'below the 100 minimum');
  // מימוש מתחת למינימום נדחה
  const rewards = (await call('GET', '/api/store')).data.club.rewards;
  const r20 = rewards.find((r) => r.kind === 'discount' && r.amount === 20);
  let q = (await call('POST', '/api/cart/quote', { items: [{ productId: 'gift-mug', qty: 1 }], clubToken: tokenKey, rewardId: r20.id })).data;
  assert.match(q.club.rewardError, /100/);
  // עוד קנייה: 790 נוספים -> 158 נקודות
  await buy([{ productId: 'pkg-birthday', qty: 1 }], { clubToken: tokenKey });
  me = (await call('GET', `/api/club/me?t=${tokenKey}`)).data;
  assert.equal(me.points, 158);
  assert.equal(me.canRedeem, true);
  // מישהו אחר עם אותו טלפון אבל בלי המפתח: לא מקבל מפתח ולא יכול לממש
  const thief = await call('POST', '/api/orders', { customer: { ...cust, name: 'גנב' }, items: [{ productId: 'gift-mug', qty: 1 }], rewardId: r20.id });
  assert.equal(thief.status, 400);
  const thief2 = await call('POST', '/api/orders', { customer: { ...cust, name: 'גנב' }, items: [{ productId: 'gift-mug', qty: 1 }] });
  assert.equal(thief2.data.clubToken, '', 'the key is not handed to someone else');
  // מפתח נכון אבל טלפון אחר: נדחה
  const other = await call('POST', '/api/orders', { customer: { ...cust, phone: '0500000001' }, items: [{ productId: 'gift-mug', qty: 1 }], clubToken: tokenKey, rewardId: r20.id });
  assert.equal(other.status, 400);
  // מימוש תקין: 20 ₪ הנחה, 100 נקודות יורדות, ונצברות נקודות על הסכום אחרי ההנחה
  q = (await call('POST', '/api/cart/quote', { items: [{ productId: 'pkg-mikveh', qty: 1 }], clubToken: tokenKey, rewardId: r20.id })).data;
  assert.equal(q.club.reward.amount, 20);
  const used = await buy([{ productId: 'pkg-mikveh', qty: 1 }], { clubToken: tokenKey, rewardId: r20.id }); // 690 - 20 = 670
  const order = db.get('orders', used.data.orderId);
  assert.equal(order.subtotal, 670);
  me = (await call('GET', `/api/club/me?t=${tokenKey}`)).data;
  assert.equal(me.points, 158 - 100 + 67);
  // מתנה מהנקודות נוספת כשורה בחינם
  await call('POST', '/api/admin/loyalty/ph_0547778899/adjust', { points: 200, note: 'בונוס' });
  const gift = rewards.find((r) => r.kind === 'gift');
  const g = await buy([{ productId: 'gift-mug', qty: 1 }], { clubToken: tokenKey, rewardId: gift.id });
  const go = db.get('orders', g.data.orderId);
  assert.ok(go.items.some((i) => i.price === 0 && i.productId === 'sweet-box'));
  // ביטול הזמנה מחזיר את המצב
  const before = (await call('GET', `/api/club/me?t=${tokenKey}`)).data.points;
  await call('POST', `/api/admin/orders/${go.id}/events`, { status: 'cancelled', note: 'בוטל' });
  const after = (await call('GET', `/api/club/me?t=${tokenKey}`)).data.points;
  assert.equal(after, before - go.loyaltyEarned + gift.points);
  // הגדרות: אחוז ומינימום לפי בחירת המנהל
  const st = (await call('GET', '/api/admin/settings')).data.settings;
  await call('PUT', '/api/admin/settings', { ...st, loyalty: { enabled: true, earnPercent: 5, minPoints: 300 } });
  const club = (await call('GET', '/api/store')).data.club;
  assert.equal(club.earnPercent, 5);
  assert.equal(club.minPoints, 300);
  const members = (await call('GET', '/api/admin/loyalty')).data.members;
  assert.ok(members.some((m) => m.phone === '0547778899' && m.clubLink.includes('?club=')));
});

test('admin controls the photo editor tools and the print sizes (any size)', async () => {
  let cfg = (await call('GET', '/api/config')).data;
  assert.equal(cfg.editor.store, true);
  assert.equal(cfg.editor.tools.ai, true);
  const st = (await call('GET', '/api/admin/settings')).data.settings;
  await call('PUT', '/api/admin/settings', { ...st,
    editor: { store: true, tools: { stickers: false, anim: false }, ai: { removebg: false } },
    printSizes: { magnet: ['7 x 10', '6×9', 'junk', '5x5'] } });
  cfg = (await call('GET', '/api/config')).data;
  assert.equal(cfg.editor.tools.stickers, false);
  assert.equal(cfg.editor.tools.crop, true);
  assert.equal(cfg.editor.ai.removebg, false);
  assert.equal(cfg.editor.ai.cartoon, true);
  const types = (await call('GET', '/api/admin/print-types')).data;
  assert.deepEqual(types.find((t) => t.type === 'magnet').sizes, ['7x10', '6x9', '5x5']);
  // באירוע: כל מידה שהמנהל קובע, והאורח מקבל את הגדרות העורך
  const r = await call('POST', '/api/admin/events', { name: 'מידות שלי', photosPerGuest: 2,
    printOptions: [{ type: 'magnet', size: '7x10' }, { type: 'block', size: '12 x 12' }, { type: 'frame', size: 'bad' }] });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.printOptions.map((o) => o.size), ['7x10', '12x12', '10x15']);
  const pub = (await call('GET', `/api/event/${r.data.code}`)).data;
  assert.equal(pub.editor.tools.stickers, false);
  // שמירת הגדרות כלליות בלי העורך לא מוחקת אותו
  await call('PUT', '/api/admin/settings', { businessName: 'פריים אירועים', shippingPrice: 30, freeShippingFrom: 300, slaHours: {} });
  assert.equal((await call('GET', '/api/config')).data.editor.tools.stickers, false);
  assert.equal((await call('GET', '/api/admin/print-types')).data.find((t) => t.type === 'magnet').sizes[0], '7x10');
});

test('customer photos for the studio: who, phone, where, size, and marking them printed', async () => {
  const e2 = (await call('POST', '/api/admin/events', { name: 'חינה של שירה', photosPerGuest: 3, printOptions: [{ type: 'magnet', size: '6x9' }] })).data;
  const g = (await call('POST', `/api/event/${e2.code}/guest`, { name: 'רותי כהן', phone: '052-1112222' })).data;
  const fd = new FormData();
  fd.append('kind', 'print'); fd.append('printOptionId', e2.printOptions[0].id);
  fd.append('file', new Blob([JPEG], { type: 'image/jpeg' }), 'a.jpg');
  await call('POST', `/api/event/${e2.code}/photos`, fd, { 'x-guest-id': g.guestId, 'x-guest-token': g.guestToken });
  const up = new FormData(); up.append('file', new Blob([JPEG], { type: 'image/jpeg' }), 'b.jpg');
  const photoUrl = (await call('POST', '/api/uploads', up)).data.url;
  const r = await call('POST', '/api/orders', { customer: { name: 'משה לוי', phone: '0503334444', city: 'באר שבע', address: 'הרצל 1' }, items: [{ productId: 'mag-6x9', variant: '10x15 ס"מ', qty: 2, photoUrl }] });
  await call('POST', `/pay/mock/${r.data.redirectUrl.split('/').pop()}`, 'result=approved', { 'content-type': 'application/x-www-form-urlencoded' });
  assert.equal((await fetch(base + '/api/admin/customer-photos')).status, 401);
  const list = (await call('GET', '/api/admin/customer-photos')).data;
  const ph = list.find((x) => x.name === 'רותי כהן');
  assert.equal(ph.phone, '052-1112222'); assert.equal(ph.where, 'חינה של שירה'); assert.equal(ph.size, '6x9'); assert.equal(ph.source, 'event');
  const oi = list.find((x) => x.name === 'משה לוי');
  assert.equal(oi.source, 'order'); assert.equal(oi.size, '10x15'); assert.equal(oi.qty, 2); assert.equal(oi.url, photoUrl); assert.match(oi.where, /הזמנה #/);
  assert.equal((await call('PATCH', `/api/admin/customer-photos/${encodeURIComponent(ph.id)}`, { status: 'printed' })).status, 200);
  assert.equal((await call('PATCH', `/api/admin/customer-photos/${encodeURIComponent(oi.id)}`, { status: 'printed' })).status, 200);
  assert.equal((await call('PATCH', `/api/admin/customer-photos/${encodeURIComponent(oi.id)}`, { status: 'nope' })).status, 400);
  const after = (await call('GET', '/api/admin/customer-photos')).data;
  assert.equal(after.find((x) => x.id === ph.id).status, 'printed');
  assert.equal(after.find((x) => x.id === oi.id).status, 'printed');
});

test('event type photos: the admin sets their own and can go back to the default', async () => {
  const before = (await call('GET', '/api/store')).data.events.find((e) => e.id === 'batmitzvah');
  assert.match(before.image, /^https:\/\/images\.unsplash\.com\//);
  const up = new FormData(); up.append('file', new Blob([JPEG], { type: 'image/jpeg' }), 'e.jpg');
  const url = (await call('POST', '/api/admin/uploads', up)).data.url;
  assert.equal((await call('PUT', '/api/admin/event-types/batmitzvah', { image: 'https://evil.example/x.jpg' })).status, 400);
  assert.equal((await call('PUT', '/api/admin/event-types/nope', { image: url })).status, 404);
  assert.equal((await call('PUT', '/api/admin/event-types/batmitzvah', { image: url })).data.custom, true);
  assert.equal((await call('GET', '/api/store')).data.events.find((e) => e.id === 'batmitzvah').image, url);
  await call('PUT', '/api/admin/event-types/batmitzvah', { image: '' });
  assert.equal((await call('GET', '/api/store')).data.events.find((e) => e.id === 'batmitzvah').image, before.image);
});
