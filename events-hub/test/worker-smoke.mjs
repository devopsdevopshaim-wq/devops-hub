// בדיקת עשן מול השרת כפי שהוא רץ ב-Cloudflare (wrangler dev --local, או הכתובת האמיתית אחרי פריסה).
//   WORKER_URL=http://localhost:8787 ADMIN_PASSWORD=... node test/worker-smoke.mjs
// ה-workflow של הפריסה מריץ אותה מול workerd לפני הפריסה.
import assert from 'node:assert';

const base = (process.env.WORKER_URL || 'http://localhost:8787').replace(/\/$/, '');
const pw = process.env.ADMIN_PASSWORD || 'smoke-test-pass';
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');

async function call(method, url, body, headers = {}) {
  const opts = { method, headers: { ...headers }, redirect: 'manual' };
  if (body instanceof FormData || typeof body === 'string') opts.body = body;
  else if (body) { opts.headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(base + url, opts);
  const type = res.headers.get('content-type') || '';
  return { status: res.status, headers: res.headers, data: type.includes('json') ? await res.json() : await res.text() };
}

const step = (t) => console.log('✓', t);

const login = await call('POST', '/api/admin/login', { password: pw });
assert.equal(login.status, 200, JSON.stringify(login.data));
const A = { authorization: `Bearer ${login.data.token}` };
step('admin login');

const cities = await call('GET', '/api/cities');
assert.ok(cities.data.length > 50);
step(`seed data (${cities.data.length} cities)`);

const ev = (await call('POST', '/api/admin/events', { name: 'בדיקת עשן', photosPerGuest: 1, printOptions: [{ type: 'magnet', size: '6x9' }] }, A)).data;
assert.ok(ev.code);
step(`event ${ev.code} -> ${ev.link}`);

const g = (await call('POST', `/api/event/${ev.code}/guest`, { name: 'אורח בדיקה' })).data;
const fd = new FormData();
fd.append('kind', 'print');
fd.append('printOptionId', ev.printOptions[0].id);
fd.append('file', new Blob([JPEG], { type: 'image/jpeg' }), 'a.jpg');
const up = await call('POST', `/api/event/${ev.code}/photos`, fd, { 'x-guest-id': g.guestId, 'x-guest-token': g.guestToken });
assert.equal(up.status, 200, JSON.stringify(up.data));
const img = await fetch(base + up.data.photo.url);
assert.equal(Buffer.from(await img.arrayBuffer()).length, JPEG.length);
step('guest upload + photo served from the Durable Object');

const o = (await call('POST', '/api/orders', { customer: { name: 'לקוח', phone: '050', city: 'באר שבע', address: 'x' }, items: [{ productId: 'mag-6x9', variant: '6x9 ס"מ', qty: 1 }] })).data;
const payId = o.redirectUrl.split('/').pop();
await call('POST', `/pay/mock/${payId}`, 'result=approved', { 'content-type': 'application/x-www-form-urlencoded' });
const t = (await call('GET', `/api/orders/${o.orderId}?t=${o.trackToken}`)).data;
assert.equal(t.status, 'paid');
const adminOrder = (await call('GET', `/api/admin/orders/${o.orderId}`, null, A)).data;
assert.ok(adminOrder.courier && adminOrder.items[0].supplier, 'assigned in Beer Sheva');
step(`order #${t.number}: paid, supplier ${adminOrder.items[0].supplier.name}, courier ${adminOrder.courier.name}`);

// ניקוי: מחיקת אירוע הבדיקה
await call('DELETE', `/api/admin/events/${ev.id}`, null, A);
console.log('ALL OK');
