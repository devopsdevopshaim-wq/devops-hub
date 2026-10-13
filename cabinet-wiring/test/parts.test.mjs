// בדיקות לחלקים אמיתיים ולפיצול לארונות.
//   node test/parts.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../js/engine.js');
const W = require('../js/parts.js');
const SP = require('../js/split.js');
const D = require('../js/demo.js');
const lib = require('../js/library/plan-208b.js');

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('✓', name); };
const c = (type, name) => ({ tag: '-X', type, name, zone: 'cabinet' });

test('מאמ"ת לפי קטבים וזרם, בשלושת המותגים', () => {
  assert.equal(W.pick(c('mcb', 'מאמ"ת 3×16A'), { brand: 'schneider' }).partNo, 'A9F74316');
  assert.equal(W.pick(c('mcb', 'מאמ"ת C6 1P'), { brand: 'siemens' }).partNo, '5SL6106-7');
  assert.equal(W.pick(c('mcb', 'מאמ"ת 1×10A'), { brand: 'abb' }).partNo, 'S201-C10 (2CDS251001R0104)');
});

test('מגען לפי הספק וסליל', () => {
  assert.equal(W.pick(c('contactor', 'מגען 7.5kW סליל 24VDC'), { brand: 'schneider' }).partNo, 'LC1D18BD');
  assert.equal(W.pick(c('contactor', 'מגען 7.5kW סליל 230VAC'), { brand: 'siemens' }).partNo, '3RT2018-1AP01');
  assert.equal(W.pick(c('contactor', 'מגען 3kW'), { brand: 'abb', coil: 'dc24' }).partNo, 'AF09-30-10-41');
});

test('מגן מנוע לפי תחום, ספק לפי זרם', () => {
  assert.equal(W.pick(c('mpcb', 'מגן מנוע 4–6.3A'), { brand: 'schneider' }).partNo, 'GV2ME10');
  assert.equal(W.pick(c('mpcb', 'מגן מנוע 4–6.3A'), { brand: 'siemens' }).partNo, '3RV2011-1GA10');
  assert.equal(W.pick(c('psu', 'ספק 24VDC 5A'), { brand: 'abb', psu: 'meanwell' }).partNo, 'NDR-120-24');
});

test('שיבוץ ורשימת הזמנה: לא דורס מק"ט מהתכנית, ומונה מהדקים', () => {
  const P = E.enrich(D.project()); const L = E.layout(P);
  const a = W.assign(P, L, { brand: 'schneider' });
  assert.ok(!a.some((x) => x.tag === '-K1'), 'ל-K1 יש מק"ט מהתכנית');
  const t = W.pick(P.components.find((x) => x.tag === '-X2'), { brand: 'schneider', terminals: 'phoenix' }, P, L);
  assert.match(t.partNo, /^12× UT 2,5 \(3044076\)/);
  const rows = W.orderList(P, L, { brand: 'schneider', terminals: 'phoenix' });
  assert.equal(rows.find((r) => r.partNo === 'PT 2.5').qty, 12);
  const rows2 = W.orderList(P, L, { brand: 'schneider', terminals: 'phoenix', overwrite: true });
  assert.ok(rows2.find((r) => /UT 2,5 \(3044076\)/.test(r.partNo)).qty >= 12);
});

test('פיצול: כל חוט נשמר, חוטים בין ארונות עוברים דרך מהדקי ממשק ובכבל', () => {
  const P = E.enrich(lib.project()); const L = E.layout(P);
  const r = SP.split(P, L, 2);
  assert.equal(r.cabinets.length, 2);
  const cores = r.links.reduce((s, l) => s + l.cores.length, 0);
  assert.ok(cores > 0);
  const out = r.cabinets.reduce((s, x) => s + x.wires.length, 0);
  assert.ok(out >= P.wires.length);
  /* כל הדק ממשק בארון 1 מופיע בדיוק בגיד אחד */
  const xc = r.cabinets[0].wires.filter((w) => w.to.tag === '-XC2' || w.from.tag === '-XC2').map((w) => (w.to.tag === '-XC2' ? w.to.term : w.from.term));
  assert.deepEqual([...new Set(xc)].sort((a, b) => a - b), r.links[0].cores.map((k) => k.a.split(':')[1]));
  /* כל רכיב של הלוח נמצא בארון אחד לפחות */
  const all = new Set(r.cabinets.flatMap((x) => x.components.map((k) => k.tag)));
  P.components.filter((k) => k.zone === 'cabinet').forEach((k) => assert.ok(all.has(k.tag), k.tag));
  assert.ok(SP.advise(P, L).count >= 1);
});

test('כל מוליך הוא חוט: "1/3/5" ו-L1-L3 מתפרקים לחוט לכל פאזה; הדק "0V/2" לא', () => {
  const comps = [{ tag: '-Q0', type: 'main_switch' }, { tag: '-F1', type: 'mpcb' }, { tag: '-K1', type: 'contactor' }, { tag: '-X1', type: 'terminal' }, { tag: '-M1', type: 'motor' }];
  const w = (no, a, at, b, bt, extra = {}) => ({ no, from: { tag: a, term: at }, to: { tag: b, term: bt }, func: 'power', ...extra });
  const r = E.expandMultiCore(comps, [w('1', '-Q0', '2', '-F1', '1', { potential: 'L1-L3' }), w('2', '-F1', '2/4/6', '-K1', '1/3/5'), w('4', '-X1', '1-2-3', '-M1', 'U1/V1/W1'), w('9', '-X1', '0V/2', '-K1', 'A2', { func: 'dc0' })]);
  assert.equal(r.added, 6);
  assert.deepEqual(r.wires.filter((x) => x.from.tag === '-Q0').map((x) => x.from.term + '>' + x.to.term + ':' + x.potential), ['2>1:L1', '4>3:L2', '6>5:L3']);
  assert.deepEqual(r.wires.filter((x) => x.to.tag === '-M1').map((x) => x.to.term), ['U1', 'V1', 'W1']);
  assert.ok(r.wires.some((x) => x.from.term === '0V/2'));
});

test('בדיקת שלמות: קוטב חסר, סליל בלי A2, מנוע בלי PE — ובלי התראות שווא על התכניות', () => {
  const P = E.enrich({ components: [{ tag: '-K1', type: 'contactor' }, { tag: '-M1', type: 'motor', location: 'field' }],
    wires: [{ from: { tag: '-K1', term: '2' }, to: { tag: '-M1', term: 'U1' } }, { from: { tag: '-K1', term: 'A1' }, to: { tag: '-M1', term: 'V1' } }] });
  const k = E.checkWiring(P).map((i) => i.kind).sort();
  assert.ok(k.includes('pole') && k.includes('coil') && k.includes('pe'));
  assert.equal(E.checkWiring(E.enrich(lib.project())).length, 0);
  assert.equal(E.checkWiring(E.enrich(D.project())).length, 0);
});

test('קישורים לחלק האמיתי', () => {
  assert.equal(W.productLinks('Schneider Electric', 'A9F74316').product, 'https://www.se.com/il/he/product/A9F74316/');
  assert.equal(W.productLinks('ABB', 'S203-C16 (2CDS253001R0164)').product, 'https://new.abb.com/products/2CDS253001R0164');
  assert.equal(W.productLinks('Phoenix Contact', '12× UT 2,5 (3044076) + D-UT').product, 'https://www.phoenixcontact.com/en-pc/products/3044076');
});

console.log(`\n${n} בדיקות עברו`);
