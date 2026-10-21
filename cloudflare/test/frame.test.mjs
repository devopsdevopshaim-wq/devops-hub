// The frame business data (src/frame.mjs) on an in-memory copy of Durable Object storage: who may do what, nothing leaks,
// big values are split and come back whole, and card numbers are refused.
import { frameBiz, frameSite, frameFile, frameBook, frameCal, hasCard, today } from '../src/frame.mjs';

let bad = 0;
const check = (n, ok, x) => { if (!ok) { bad++; console.error('FAIL', n, x === undefined ? '' : JSON.stringify(x).slice(0, 300)); } else console.log('ok  ', n); };
function storage() {
  const m = new Map(), copy = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  return {
    m,
    async get(k) { if (Array.isArray(k)) return new Map(k.filter((x) => m.has(x)).map((x) => [x, copy(m.get(x))])); return copy(m.get(k)); },
    async put(k, v) { if (typeof k === 'object') { for (const [a, b] of Object.entries(k)) { if (JSON.stringify(b).length > 131072) throw new Error('value too big'); m.set(a, copy(b)); } return; } if (JSON.stringify(v).length > 131072) throw new Error('value too big'); m.set(k, copy(v)); },
    async delete(k) { (Array.isArray(k) ? k : [k]).forEach((x) => m.delete(x)); },
    async list({ prefix }) { return new Map([...m.entries()].filter(([k]) => k.startsWith(prefix)).sort().map(([k, v]) => [k, copy(v)])); }
  };
}
const S = storage();
const ADMIN = { role: 'admin', email: 'devopsdevopshaim@gmail.com' }, DANA = { role: 'client', email: 'dana@example.com' }, EVE = { role: 'client', email: 'eve@example.com' };

let r = await frameBiz(S, null, { action: 'designs' });
check('no session: nothing', r.code === 401);
r = await frameBiz(S, DANA, { action: 'all' });
check('a customer cannot read the business', r.code === 403);
for (const a of ['site-save', 'settings-save', 'deal-save', 'deals-import', 'deal-del', 'expense-save', 'frame-add', 'frame-del', 'designs-of', 'design-of']) {
  r = await frameBiz(S, DANA, { action: a, id: 'x', email: 'eve@example.com' });
  if (r.code !== 403) check('a customer cannot ' + a, false, r);
}
check('a customer cannot use any of the owner\'s actions', true);

// a customer's own designs, big ones too
const big = 'data:image/png;base64,' + 'A'.repeat(450000);
r = await frameBiz(S, DANA, { action: 'design-save', design: { id: 'd1', name: 'החתונה שלנו', type: 'wedding', deco: [{ src: big }], thumb: 'data:image/jpeg;base64,QUJD' } });
check('a customer saves a big design', r.body.ok, r);
r = await frameBiz(S, DANA, { action: 'design-get', id: 'd1' });
check('... and gets it back whole', r.body.ok && r.body.design.deco[0].src === big);
r = await frameBiz(S, DANA, { action: 'designs' });
check('her list has it, with the thumbnail', r.body.designs.length === 1 && r.body.designs[0].name === 'החתונה שלנו' && r.body.designs[0].thumb === 'data:image/jpeg;base64,QUJD');
r = await frameBiz(S, EVE, { action: 'design-get', id: 'd1' });
check('another customer cannot see it', r.code === 404);
r = await frameBiz(S, EVE, { action: 'designs' });
check('... nor list it', r.body.designs.length === 0);
r = await frameBiz(S, DANA, { action: 'design-save', design: { id: 'd2', thumb: 'javascript:alert(1)' } });
r = await frameBiz(S, DANA, { action: 'designs' });
check('a bad thumbnail is dropped', r.body.designs.find((x) => x.id === 'd2').thumb === '');
r = await frameBiz(S, DANA, { action: 'design-save', design: { id: '../x' } });
check('a bad id is refused', r.code === 400);
r = await frameBiz(S, DANA, { action: 'design-save', design: { id: 'huge', blob: 'x'.repeat(1900000) } });
check('a design over the limit is refused', r.code === 413);

// the owner
r = await frameBiz(S, ADMIN, { action: 'designs-of', email: 'dana@example.com' });
check('the owner sees a customer\'s designs', r.body.ok && r.body.designs.length === 2);
r = await frameBiz(S, ADMIN, { action: 'design-of', email: 'dana@example.com', id: 'd1' });
check('... and opens one', r.body.ok && r.body.design.name === 'החתונה שלנו');
r = await frameBiz(S, ADMIN, { action: 'site-save', site: { name: 'פריים מגנטים', packages: [{ name: 'בסיסי', price: '₪1,590' }], settingsLeak: 'secret', bank: '123' } });
check('the owner publishes the site', r.body.ok);
r = await frameSite(S);
check('the public site gets the content', r.ok && r.site.name === 'פריים מגנטים' && r.site.packages[0].price === '₪1,590');
check('... and only the public fields', !('settingsLeak' in r.site) && !('bank' in r.site));
r = await frameBiz(S, ADMIN, { action: 'settings-save', settings: { bankName: 'לאומי', account: '123456', iban: 'IL62 0108 0000 0009 9999 999', bit: '054-4979771' } });
check('bank details are kept', r.body.ok);
r = await frameBiz(S, ADMIN, { action: 'settings-save', settings: { note: 'card 4111 1111 1111 1111' } });
check('a card number is refused', r.code === 400 && r.body.error === 'card-number', r);
r = await frameBiz(S, ADMIN, { action: 'settings-save', settings: { pay: { account: '4111-1111-1111-1111' } } });
check('a card number inside the payment details is refused too', r.code === 400 && r.body.error === 'card-number');
check('card detection', hasCard('4111 1111 1111 1111') && !hasCard('IL62 0108 0000 0009 9999 999') && !hasCard('054-4979771'));
r = await frameSite(S);
check('settings never reach the public site', !JSON.stringify(r).includes('123456'));

// deals, payments, expenses
const deal = (id, date, amounts, up) => ({ id, no: 1000 + id.length, client: { name: 'לקוח ' + id }, date, price: 2000, payments: amounts.map((a, i) => ({ id: id + i, amount: a, method: 'bit', date })), updatedAt: up || 1 });
r = await frameBiz(S, ADMIN, { action: 'deal-save', deal: deal('a1', '2026-10-05', [600]) });
r = await frameBiz(S, ADMIN, { action: 'deals-import', deals: [deal('a1', '2026-10-05', [600, 1400], 5), deal('b2', '2026-11-10', [500], 1), { id: '<bad>' }] });
check('deals import: newer wins, bad ones skipped', r.body.saved === 2 && r.body.skipped === 1, r.body);
r = await frameBiz(S, ADMIN, { action: 'deals-import', deals: [deal('a1', '2026-10-05', [1], 2)] });
check('... an older copy does not overwrite', r.body.saved === 0);
r = await frameBiz(S, ADMIN, { action: 'expense-save', expense: { id: 'e1', date: '2026-10-07', desc: 'נייר מגנטי', amount: '312.5', vat: true, cat: 'חומרים' } });
check('an expense is kept', r.body.ok && r.body.expense.amount === 312.5);
r = await frameBiz(S, ADMIN, { action: 'all' });
check('everything comes back for the owner', r.body.ok && r.body.deals.length === 2 && r.body.deals.find((d) => d.id === 'a1').payments.length === 2 && r.body.expenses.length === 1 && r.body.settings.account === '123456' && r.body.customers[0].email === 'dana@example.com');
r = await frameBiz(S, ADMIN, { action: 'deal-del', id: 'b2' });
r = await frameBiz(S, ADMIN, { action: 'all' });
check('a deal is deleted', r.body.deals.length === 1);

// frames
const png = 'iVBORw0KGgo' + 'B'.repeat(300000);
r = await frameBiz(S, ADMIN, { action: 'frame-add', name: 'זהב', data: 'data:image/png;base64,' + png, for: ['wedding'] });
check('the owner adds a PNG frame', r.body.ok && r.body.frames.length === 1);
const fid = r.body.id;
r = await frameBiz(S, ADMIN, { action: 'frame-add', name: 'x', data: 'PHN2Zz4=' });
check('a file that is not a PNG is refused', r.code === 400);
let file = await frameFile(S, fid);
check('the frame file is served whole', file && file.length === Buffer.from(png, 'base64').length);
r = await frameSite(S);
check('the site lists it', r.frames.length === 1 && r.frames[0].name === 'זהב' && r.frames[0].for[0] === 'wedding');
await frameBiz(S, ADMIN, { action: 'frame-update', id: fid, hidden: true });
r = await frameSite(S); file = await frameFile(S, fid);
check('a hidden frame is not listed or served', r.frames.length === 0 && file === null);
await frameBiz(S, ADMIN, { action: 'frame-del', id: fid });
check('a deleted frame leaves nothing behind', ![...S.m.keys()].some((k) => k.startsWith('ff:')));
await frameBiz(S, DANA, { action: 'design-del', id: 'd1' });
check('a deleted design leaves nothing behind', ![...S.m.keys()].some((k) => k.startsWith('d:dana@example.com:d1')));

// booking requests: the site asks, the calendar answers, only the owner approves
const S2 = storage();
const plus = (n) => new Date(Date.parse(today() + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const D1 = plus(40), D2 = plus(41);
const ask = (o) => frameBook(S2, null, Object.assign({ name: 'דנה כהן', phone: '050-1234567', email: 'dana@example.com', date: D1, type: 'wedding', typeName: 'חתונה', guests: '250', venue: 'אולם הגן', pkg: 'פרימיום' }, o));
await frameBiz(S2, ADMIN, { action: 'site-save', site: { packages: [{ name: 'פרימיום', price: '₪2,290' }], busy: [D2] } });
r = await ask({});
check('a booking request is kept, the date is free', r.body.ok && r.body.free === true && /^R-\d+$/.test(r.body.ref) && r.notify.request.status === 'pending' && r.notify.state.free, r.body);
const rq1 = r.body.id;
r = await ask({ notes: 'שינוי קטן' });
check('the same phone and date updates the open request', r.body.again && r.body.id === rq1);
r = await ask({ date: D2, phone: '052-7654321', name: 'יוסי', email: 'yossi@example.com' });
check('a date the owner marked busy is reported as taken', r.body.ok && r.body.free === false);
const rq2 = r.body.id;
check('a past date is refused', (await ask({ date: '2020-01-01' })).code === 400);
check('a bad phone is refused', (await ask({ phone: '12' })).code === 400);
check('a card number in a request is refused', (await ask({ notes: '4111 1111 1111 1111' })).body.error === 'card-number');
check('a bot (hidden field) is ignored', (await ask({ website: 'x' })).notify === undefined);
r = await frameBiz(S2, DANA, { action: 'request-decide', id: rq1, decision: 'approve' });
check('a customer cannot approve', r.code === 403);
r = await frameBiz(S2, DANA, { action: 'my-requests' });
check('the customer sees her own requests and their state', r.body.requests.length === 1 && r.body.requests[0].status === 'pending' && !('phone' in r.body.requests[0]));
r = await frameBiz(S2, ADMIN, { action: 'all' });
check('the owner sees the requests', r.body.requests.length === 2 && r.body.requests.every((x) => x.status === 'pending'));
r = await frameBiz(S2, ADMIN, { action: 'request-decide', id: rq1, decision: 'approve', answer: 'מחכים לכם!' });
check('approving makes a closed deal with the package price', r.body.ok && r.body.deal.closed && r.body.deal.no === 1001 && r.body.deal.price === 2290 && r.body.deal.deposit === 687 && r.body.deal.client.name === 'דנה כהן' && r.notify.decision === 'approve', r.body);
check('... and it cannot be approved twice', (await frameBiz(S2, ADMIN, { action: 'request-decide', id: rq1, decision: 'approve' })).code === 409);
r = await frameSite(S2);
check('the date is now taken on the public site (dates only)', r.taken.includes(D1) && !JSON.stringify(r.taken).includes('דנה'));
r = await frameBook(S2, null, { name: 'אחר', phone: '053-1112223', date: D1, type: 'brit' });
check('a new request for that date hears it is taken', r.body.ok && r.body.free === false && r.notify.state.deals.length === 1);
const rq3 = r.body.id;
r = await frameBiz(S2, ADMIN, { action: 'request-decide', id: rq3, decision: 'approve' });
check('approving a taken date needs the owner to insist', r.code === 409 && r.body.error === 'date-taken');
await frameBiz(S2, ADMIN, { action: 'settings-save', settings: { perDay: 2 } });
r = await frameBiz(S2, ADMIN, { action: 'date-state', date: D1 });
check('with two events a day the date is free again', r.body.state.free && r.body.state.perDay === 2);
r = await frameBiz(S2, ADMIN, { action: 'request-decide', id: rq2, decision: 'decline', answer: 'מצטערים' });
check('declining keeps the answer and tells the customer', r.body.request.status === 'declined' && r.notify.decision === 'decline');
r = await frameBiz(S2, ADMIN, { action: 'all' });
const dl = r.body.deals.find((d) => d.rq === rq1);
await frameBiz(S2, ADMIN, { action: 'deal-del', id: dl.id });
await frameBiz(S2, ADMIN, { action: 'settings-save', settings: { perDay: 1 } });
check('deleting the deal frees the date', !(await frameSite(S2)).taken.includes(D1));
check('no calendar feed without the secret', (await frameCal(S2, 'nope')) === null);
r = await frameBiz(S2, ADMIN, { action: 'cal-key' });
const ics = await frameCal(S2, r.body.calKey);
check('the calendar feed has the pending requests', /BEGIN:VCALENDAR/.test(ics) && ics.includes('STATUS:TENTATIVE') && ics.includes('DTSTART;VALUE=DATE:' + D1.replace(/-/g, '')));
check('... and a wrong key of the same length gets nothing', (await frameCal(S2, r.body.calKey.replace(/./, (c) => (c === 'a' ? 'b' : 'a')))) === null);

// a customer approves a design: the print frame reaches the owner, nobody else
{
  const S3 = storage(), PNG = 'iVBORw0KGgo' + 'A'.repeat(400000);
  await frameBiz(S3, DANA, { action: 'design-save', design: { id: 'dz1', name: 'נועה ודניאל', names: 'נועה & דניאל', type: 'wedding', fmt: 'magnet', thumb: 'data:image/jpeg;base64,QUJD' } });
  r = await frameBiz(S3, EVE, { action: 'design-approve', id: 'dz1', frame: PNG });
  check('approve: only the design\'s owner', r.code === 404);
  r = await frameBiz(S3, DANA, { action: 'design-approve', id: 'dz1', frame: 'not an image!' });
  check('approve: a broken frame is refused', r.code === 400);
  r = await frameBiz(S3, DANA, { action: 'design-approve', id: 'dz1', frame: PNG, preview: 'QUJD', eventDate: '2027-06-12', phone: '0501234567', note: 'בלי דבר' });
  check('approve: the customer approves, the owner is told', r.body.ok && r.notify && r.notify.design.names === 'נועה & דניאל' && r.notify.design.eventDate === '2027-06-12', r);
  r = await frameBiz(S3, DANA, { action: 'designs' });
  check('approve: her list shows it approved', r.body.designs[0].approved > 0);
  r = await frameBiz(S3, DANA, { action: 'approved-list' });
  check('approve: a customer cannot list approved designs', r.code === 403);
  r = await frameBiz(S3, ADMIN, { action: 'approved-list' });
  check('approve: the owner lists it', r.body.designs.length === 1 && r.body.designs[0].email === 'dana@example.com' && r.body.designs[0].thumb);
  r = await frameBiz(S3, ADMIN, { action: 'approved-frame', email: 'dana@example.com', id: 'dz1' });
  check('approve: the owner gets the print frame whole', r.body.frame === PNG && r.body.preview === 'QUJD');
  await frameBiz(S3, DANA, { action: 'design-approve', id: 'dz1', frame: PNG });
  r = await frameBiz(S3, ADMIN, { action: 'approved-list' });
  check('approve: approving again replaces it', r.body.designs.length === 1);
  await frameBiz(S3, ADMIN, { action: 'approved-del', email: 'dana@example.com', id: 'dz1' });
  r = await frameBiz(S3, ADMIN, { action: 'approved-frame', email: 'dana@example.com', id: 'dz1' });
  check('approve: the owner removes it', r.code === 404 && ![...S3.m.keys()].some((k) => k.startsWith('dzf:')));
}

console.log(bad ? `\n${bad} failed` : '\nframe: all passed');
process.exit(bad ? 1 : 0);
