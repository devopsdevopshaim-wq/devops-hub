// v219: the products a guest picks from the QR (2-3 per event) and the guests' benefit shown in their app after the event
import { frameLive } from '../src/live.mjs';
import { today } from '../src/frame.mjs';
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
const S = storage(), SITE = { name: 'פריים מגנטים' }, OWNER = { role: 'studio', email: 'studio@example.com' };
const call = (who, b) => frameLive(S, who, b, SITE), JPG = Buffer.from('jpeg-bytes-' + 'x'.repeat(3000)).toString('base64');
const T = today(), back = (n) => new Date(Date.parse(T + 'T12:00:00Z') - n * 864e5).toISOString().slice(0, 10);
const PRODUCTS = [{ id: 'magnet', name: 'מגנט', icon: '🧲', w: 7.5, h: 10 }, { id: 'block', name: 'בלוק עץ', icon: '🪵', w: 10, h: 15 }, { id: 'frame', name: 'מסגרת קרטון', w: 13, h: 18 }, { id: 'x', name: 'רביעי' }];
let r = await call(OWNER, { action: 'ev-save', event: { title: 'חתונה', date: back(1), products: PRODUCTS, offer: { on: true, pct: 25, what: 'אלבום', after: 1, days: 7, url: 'https://example.com/shop', code: 'guest25' } } });
const ev = r.body.event;
check('three products at most, with their sizes', ev.products.length === 3 && ev.products[1].w === 10 && ev.products[1].h === 15, ev.products);
check('the benefit kept', ev.offer && ev.offer.pct === 25 && ev.offer.code === 'GUEST25' && ev.offer.url === 'https://example.com/shop', ev.offer);
r = await call(null, { action: 'guest-info', e: ev.id, k: ev.k });
check('the guest sees the products', r.body.products.length === 3 && r.body.products[2].name === 'מסגרת קרטון');
check('a day after the event the benefit is on', r.body.offer && r.body.offer.live === true && r.body.offer.pct === 25 && r.body.offer.to === back(1 - 7), r.body.offer);
r = await call(null, { action: 'guest-up', e: ev.id, k: ev.k, img: JPG, name: 'רותי' });
check('with several products, the guest must pick one', r.code === 400 && r.body.error === 'no-product');
r = await call(null, { action: 'guest-up', e: ev.id, k: ev.k, img: JPG, name: 'רותי', text: 'מזל טוב', product: 'block' });
check('a photo with its product', r.body.ok);
r = await call(OWNER, { action: 'claim', e: ev.id, station: 'עמדה 1', max: 3 });
check('the station gets the product and its size', r.body.photos[0].product && r.body.photos[0].product.name === 'בלוק עץ' && r.body.photos[0].product.w === 10, r.body.photos[0]);
r = await call(OWNER, { action: 'ev-save', event: Object.assign({}, ev, { date: T }) });
r = await call(null, { action: 'guest-info', e: ev.id, k: ev.k });
check('on the event day itself the benefit waits', r.body.offer && r.body.offer.live === false);
r = await call(OWNER, { action: 'ev-save', event: Object.assign({}, ev, { date: back(9) }) });
r = await call(null, { action: 'guest-info', e: ev.id, k: ev.k });
check('after its week it is over', r.body.offer && r.body.offer.live === false);
r = await call(OWNER, { action: 'ev-save', event: Object.assign({}, ev, { products: [PRODUCTS[0]], offer: { on: false } }) });
r = await call(null, { action: 'guest-up', e: ev.id, k: ev.k, img: JPG, name: 'משה' });
check('one product: nothing to pick', r.body.ok);
r = await call(null, { action: 'guest-info', e: ev.id, k: ev.k });
check('no benefit when it is off', r.body.offer === null);
r = await call(OWNER, { action: 'ev-save', event: Object.assign({}, ev, { offer: { on: true, url: 'javascript:alert(1)' } }) });
check('only an https link', r.body.event.offer.url === '');
if (bad) { console.error(bad + ' failed'); process.exit(1); }
console.log('live-products: all passed');
