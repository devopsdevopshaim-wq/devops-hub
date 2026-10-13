// בדיקות למנוע: השלמה, פריסה, ניתוב, שליפה מטקסט ופענוח תשובה של Claude.
//   node test/engine.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const C = require('../js/catalog.js');
const E = require('../js/engine.js');
const D = require('../js/demo.js');
const Pr = require('../js/prompts.js');

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('✓', name); };

test('צבעים: כינויים בעברית, אנגלית וגרמנית', () => {
  assert.equal(C.colorCode('sw'), 'BK');
  assert.equal(C.colorCode('GN/YE'), 'GNYE');
  assert.equal(C.colorCode('ירוק-צהוב'), 'GNYE');
  assert.equal(C.colorCode('hbl'), 'LBU');
  assert.equal(C.colorCode('blue'), 'BU');
  assert.equal(C.colorCode('xyz'), '');
});

test('סוג רכיב לפי שם, קידומת והדקים', () => {
  assert.equal(E.inferType('-K1', 'מגען 3RT2016', []), 'contactor');
  assert.equal(E.inferType('-K5', '', ['1', '2', 'A1', 'A2']), 'contactor');
  assert.equal(E.inferType('-K5', '', ['11', '14', 'A1', 'A2']), 'relay');
  assert.equal(E.inferType('-X3', '', []), 'terminal');
  assert.equal(E.inferType('-Q0', '', []), 'main_switch');
  assert.equal(E.inferType('-M2', '', []), 'motor');
  assert.equal(E.inferType('-S4', 'לחצן הפעלה', []), 'button');
  assert.equal(E.inferType('=A1+S1-H3', '', []), 'lamp');
});

test('דוגמה: כל החוטים מקבלים תפקיד, צבע, שרוול והסבר', () => {
  const p = E.enrich(D.project());
  assert.equal(p.wires.length, 57);
  for (const w of p.wires) {
    assert.ok(C.FUNCS[w.func], 'func ' + w.no);
    assert.ok(C.COLORS[w.color], 'color ' + w.no);
    assert.ok(w.section > 0, 'section ' + w.no);
    assert.ok(w.auto.purpose.length > 10, 'purpose ' + w.no);
    assert.ok(w.auto.steps.length >= 4);
  }
  const by = (no) => p.wires.find((w) => w.no === no);
  assert.equal(by('1').func, 'power');
  assert.equal(by('15').func, 'neutral');
  assert.equal(by('17').func, 'ctrl_dc');
  assert.equal(by('35').func, 'dc0');
  assert.equal(by('54').func, 'pe');
  assert.equal(by('37').kind, 'bridge');
  assert.equal(by('50').kind, 'field');
  assert.equal(by('4').twinFrom, true, 'Q0:2 נושא שני חוטים');
  assert.match(by('34').auto.purpose, /סליל -K1/);
  assert.match(by('23').auto.purpose, /-S1/);
});

test('השלמת צבע לפי התקן כשהתכנית לא מציינת', () => {
  const p = E.enrich({ components: [], wires: [
    { from: { tag: 'X1', term: '1' }, to: { tag: 'Q1', term: 'L1' } },
    { from: { tag: 'X1', term: 'PE' }, to: { tag: 'PE', term: '1' } },
    { from: { tag: 'A1', term: 'Q0.0' }, to: { tag: 'K1', term: 'A1' } },
    { from: { tag: 'K1', term: 'A2' }, to: { tag: 'G1', term: '0V' } }
  ] });
  assert.deepEqual(p.wires.map((w) => w.color), ['BK', 'GNYE', 'BU', 'WHBU']);
  assert.ok(p.wires.every((w) => w.colorSource === 'standard'));
  assert.equal(p.wires[0].from.tag, '-X1');
  assert.equal(p.wires[2].section, 0.75);
  const p2 = E.enrich({ settings: { phaseColors: 'iec60445' }, wires: [
    { from: { tag: 'X1', term: '1' }, to: { tag: 'Q1', term: 'L2' }, potential: 'L2' }] });
  assert.equal(p2.wires[0].color, 'BK');
  const p3 = E.enrich({ settings: { phaseColors: 'iec60445' }, wires: [
    { from: { tag: 'X1', term: '1' }, to: { tag: 'Q1', term: 'L1' }, potential: 'L1' }] });
  assert.equal(p3.wires[0].color, 'BN');
});

test('פריסה וניתוב: כל חוט מנותב, אורך לחוטים פנימיים, רכיבים בתוך הפלטה', () => {
  const p = E.enrich(D.project());
  const L = E.layout(p);
  assert.ok(L.plate.w >= 400 && L.plate.h >= 600);
  for (const w of p.wires) {
    const r = L.routes[w.id];
    assert.ok(r && r.pts.length >= 2, 'route ' + w.no);
    if (w.kind === 'internal') assert.ok(r.len > 100, 'len ' + w.no);
  }
  for (const [tag, b] of Object.entries(L.comps)) {
    if (b.zone !== 'cabinet') continue;
    assert.ok(b.x >= 0 && b.x + b.w <= L.plate.w && b.y >= 0 && b.y + b.h <= L.plate.h, 'inside ' + tag);
  }
  assert.equal(L.rails[0].items[0].tag, '-Q0', 'המפסק הראשי ראשון');
  const steps = E.assemblySteps(p, L);
  assert.ok(steps.some((s) => s.id === 'wire-power'));
  assert.ok(steps.some((s) => s.id === 'tests'));
});

test('שליפה מטקסט של רשימת חוטים בסגנון EPLAN', () => {
  const items = [];
  const rows = [
    ['101', '-X1:1', '-Q1:1', 'BK', '2.5 mm²', 'H07V-K'],
    ['102', '-Q1:2', '-K1:1', 'SW', '2.5mm2', 'H07V-K'],
    ['201', '-F3:2', '-K1:A1', 'BU', '0.75 mm²', 'H05V-K'],
    ['PE1', '-X1:PE', '-PE:1', 'GNYE', '2.5 mm²', 'H07V-K']
  ];
  rows.forEach((r, i) => r.forEach((s, j) => items.push({ s, x: j * 0.1, y: 0.1 + i * 0.03, w: 0.05, h: 0.01 })));
  items.push({ s: '-K1', x: 0, y: 0.5, w: 0.03, h: 0.01 }, { s: 'Contactor 3RT2016 24VDC', x: 0.1, y: 0.5, w: 0.2, h: 0.01 });
  const ex = E.extractFromText([{ page: 2, items }]);
  assert.equal(ex.wires.length, 4);
  assert.deepEqual(ex.wires[0].from, { tag: '-X1', term: '1' });
  assert.equal(ex.wires[0].no, '101');
  assert.equal(ex.wires[1].color, 'BK');
  assert.equal(ex.wires[2].section, 0.75);
  assert.equal(ex.wires[2].wireType, 'H05V-K');
  assert.equal(ex.wires[3].color, 'GNYE');
  assert.equal(ex.wires[0].page, 2);
  const k1 = ex.components.find((c) => c.tag === '-K1');
  assert.match(k1.name, /Contactor/);
});

test('פענוח תשובה של Claude (עם גדרות קוד)', () => {
  const txt = '```json\n' + JSON.stringify({ meta: { title: 'T' }, components: [{ tag: '-K1', type: 'contactor', name: 'מגען' }],
    wires: [{ no: '5', fromTag: '-X1', fromTerm: '3', toTag: '-K1', toTerm: 'A1', color: 'BU', colorSource: 'drawing', section: 0.75, wireType: 'H05V-K', func: 'ctrl_dc', potential: '', desc: 'x', explain: 'y', page: 3 }], notes: ['n'] }) + '\n```';
  const r = Pr.parse(txt);
  assert.equal(r.wires.length, 1);
  assert.deepEqual(r.wires[0].to, { tag: '-K1', term: 'A1' });
  assert.equal(r.meta.title, 'T');
  assert.throws(() => Pr.parse('אין כאן JSON'));
  const spec = Pr.build({ hint: 'h' });
  assert.equal(spec.schema.properties.wires.items.additionalProperties, false);
  assert.ok(spec.schema.properties.wires.items.required.includes('explain'));
});

test('CSV ורשימת חיתוך', () => {
  const p = E.enrich(D.project());
  const L = E.layout(p);
  const csv = E.wireListCsv(p, L);
  assert.equal(csv.split('\r\n').length, 58);
  const cut = E.cutList(p, L);
  assert.equal(cut.reduce((s, c) => s + c.count, 0), 57);
});

test('איחוד קטעי עמודים: רכיבים לפי תג, חוט כפול נספר פעם אחת', () => {
  const a = { meta: { title: 'T' }, components: [{ tag: 'K1', name: '' }], wires: [{ from: { tag: '-X1', term: '1' }, to: { tag: '-K1', term: 'A1' } }], notes: ['n1'] };
  const b = { meta: { title: 'X', supply: '400V' }, components: [{ tag: '-K1', name: 'מגען' }, { tag: '-Q1' }], wires: [{ from: { tag: 'K1', term: 'A1' }, to: { tag: 'X1', term: '1' } }, { from: { tag: '-Q1', term: '2' }, to: { tag: '-K1', term: '1' } }], notes: ['n1', 'n2'] };
  const m = Pr.merge([a, null, b]);
  assert.equal(m.components.length, 2);
  assert.equal(m.components[0].name, 'מגען');
  assert.equal(m.wires.length, 2);
  assert.deepEqual(m.meta, { title: 'T', supply: '400V' });
  assert.deepEqual(m.notes, ['n1', 'n2']);
  const pr = Pr.chunkPrompt({ pages: [4, 5, 6], known: ['-K1'], text: 'x'.repeat(50000) });
  assert.ok(pr.length <= 23800 && /4, 5, 6/.test(pr) && /-K1/.test(pr));
});

test('מעטפת הארון: מידות סטנדרטיות שמכילות את הפלטה', () => {
  const p = E.enrich(D.project());
  const L = E.layout(p);
  const enc = E.enclosure(p, L);
  assert.ok(enc.w >= L.plate.w + 50 && enc.h >= L.plate.h + 50);
  assert.ok([150, 200, 250, 300, 400, 500].includes(enc.d) && enc.d >= enc.deepest + 90);
  assert.ok(enc.wireM > 10 && enc.rails === L.rails.length);
});

console.log(`\n${n} בדיקות עברו`);
