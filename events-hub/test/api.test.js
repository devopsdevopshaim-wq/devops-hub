const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'events-app-'));
process.env.ADMIN_PASSWORD = 'test-pass';
process.env.PAYMENT_PROVIDER = 'mock';

const app = require('../server');
const db = require('../src/db');

let base;
let cookie;
let server;

test.before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

async function call(method, url, body, headers = {}) {
  const opts = { method, headers: { ...headers }, redirect: 'manual' };
  if (cookie) opts.headers.cookie = cookie;
  if (body instanceof FormData || typeof body === 'string') opts.body = body;
  else if (body) { opts.headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(base + url, opts);
  const type = res.headers.get('content-type') || '';
  return { status: res.status, headers: res.headers, data: type.includes('json') ? await res.json() : await res.text() };
}

const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');

let ev;
test('admin login required and works', async () => {
  assert.equal((await call('GET', '/api/admin/events')).status, 401);
  assert.equal((await call('POST', '/api/admin/login', { password: 'wrong' })).status, 401);
  const r = await call('POST', '/api/admin/login', { password: 'test-pass' });
  assert.equal(r.status, 200);
  cookie = r.headers.get('set-cookie').split(';')[0];
});

test('create event keeps at most 3 print options', async () => {
  const r = await call('POST', '/api/admin/events', {
    name: 'חתונת בדיקה', photosPerGuest: 2,
    printOptions: [{ type: 'magnet', size: '6x9' }, { type: 'block', size: '15x15' }, { type: 'frame', size: '13x18' }, { type: 'magnet', size: '10x15' }],
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.printOptions.length, 3);
  ev = r.data;
  const qr = await call('GET', `/api/admin/events/${ev.id}/qr.png`);
  assert.equal(qr.status, 200);
});

test('guest photo quota is enforced', async () => {
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
  assert.equal((await send()).status, 200);
  const second = await send();
  assert.equal(second.data.remaining, 0);
  assert.equal((await send()).status, 403);
  const bad = await call('GET', `/api/event/${ev.code}/me`, null, { 'x-guest-id': g.guestId, 'x-guest-token': 'nope' });
  assert.equal(bad.status, 401);
});

test('order from Beer Sheva is routed to Beer Sheva supplier and courier after payment', async () => {
  const r = await call('POST', '/api/orders', {
    customer: { name: 'לקוח', phone: '0500000000', city: 'באר שבע', address: 'רגר 1' },
    items: [{ productId: 'mag-6x9', qty: 2, price: 1 }],
  });
  assert.equal(r.status, 200);
  const order = db.get('orders', r.data.orderId);
  assert.equal(order.total, 15 * 2 + 30, 'price comes from server, not client');
  const payId = r.data.redirectUrl.split('/').pop();
  const pay = await call('POST', `/pay/mock/${payId}`, 'result=approved', { 'content-type': 'application/x-www-form-urlencoded' });
  assert.equal(pay.status, 302);
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
    customer: { name: 'לקוח', phone: '050', city: 'אילת', address: 'x' }, items: [{ productId: 'block-15x15', qty: 1 }],
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
