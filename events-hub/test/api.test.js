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
  server = await start({ port: 0, env: { DATA_DIR: dataDir, ADMIN_PASSWORD: 'test-pass', PAYMENT_PROVIDER: 'mock' } });
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
    items: [{ productId: 'mag-6x9', qty: 2, price: 1 }],
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
