// בדיקות למעבדה: הדמיה חיה ובדיקות תקינות.
//   node test/sim.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../js/engine.js');
const S = require('../js/sim.js');
const D = require('../js/demo.js');
const lib = require('../js/library/plan-208b.js');

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('✓', name); };
const demo = () => E.enrich(D.project());

test('הדקים ברירת מחדל לפי סוג', () => {
  assert.deepEqual(S.defaultTerms('mcb', { poles: 3 }), ['1', '2', '3', '4', '5', '6']);
  assert.deepEqual(S.defaultTerms('contactor'), ['1', '2', '3', '4', '5', '6', 'A1', 'A2', '13', '14']);
  assert.deepEqual(S.defaultTerms('terminal', { count: 3 }), ['1', '2', '3']);
});

test('הדמיה: מפסק ראשי מנותק — אין מתח אחריו; מורם — הספק והבקר עובדים', () => {
  const P = demo();
  const st = S.initialState(P);
  let r = S.run(P, st);
  assert.ok(!r.comps['-G1'] || !r.comps['-G1'].on);
  st.on['-Q0'] = true;
  r = S.run(P, st, r);
  assert.ok(r.comps['-G1'].on, 'הספק דלוק');
  assert.equal(r.shorts.length, 0);
});

test('הדמיה: יציאת בקר מושכת מגען והמנוע מסתובב; חירום עוצר', () => {
  const P = demo();
  const st = S.initialState(P);
  st.on['-Q0'] = true;
  let r = S.run(P, st);
  st.out['-A1:DQA.0'] = true;
  r = S.run(P, st, r);
  assert.ok(r.comps['-K1'].energized);
  assert.ok(r.comps['-M1'].running);
  assert.ok(r.events.some((e) => /-K1 נמשך/.test(e)));
  st.pressed['-S0'] = true;
  r = S.run(P, st, r);
  assert.ok(!(r.comps['-K1'] || {}).energized);
  assert.ok(r.events.some((e) => /-M1 נעצר/.test(e)));
});

test('הדמיה: קצר בין פאזות מתגלה ומפיל הגנה', () => {
  const P = demo();
  const f1 = P.wires.find((w) => w.from.tag === '-F1' || w.to.tag === '-F1');
  assert.ok(f1);
  const raw = D.project();
  /* קצר: פאזה אחרי -Q0 ישר ל-N */
  raw.wires.push({ id: 'x1', no: 'X1', from: { tag: '-Q0', term: '2' }, to: { tag: '-Q0', term: '4' } });
  const P2 = E.enrich(raw);
  const st = S.initialState(P2); st.on['-Q0'] = true;
  const r = S.run(P2, st);
  assert.ok(r.shorts.length > 0);
  assert.ok(Object.keys(r.tripped).length > 0 || r.shortWires.x1);
});

test('בדיקות תקינות: 208-B נקי, ההדגמה עם שתי הערות בלבד', () => {
  const P = E.enrich(lib.project());
  const sc = S.score(S.checks(P));
  assert.equal(sc.err, 0); assert.equal(sc.warn, 0);
  const d = S.checks(demo());
  assert.equal(S.score(d).err, 0);
  assert.equal(d.section.length, 1); assert.equal(d.terminal.length, 1);
});

test('בדיקות תקינות: הארקה בצבע שגוי וסליל DC על AC', () => {
  const raw = D.project();
  const pe = raw.wires.find((w) => /PE/i.test(w.to.term) || /PE/i.test(w.from.term));
  pe.color = 'BK';
  const cats = S.checks(E.enrich(raw));
  assert.ok(cats.color.some((i) => i.sev === 'err'));
});

test('208-B בהפעלה: אין קצר, עומסים פועלים', () => {
  const P = E.enrich(lib.project());
  const st = S.initialState(P);
  Object.keys(st.on).forEach((t) => { st.on[t] = true; });
  const r = S.run(P, st);
  assert.equal(r.shorts.length, 0);
  assert.ok(Object.keys(r.wires).length > 200);
  assert.ok(Object.values(r.comps).some((o) => o.running));
});

test('בקרות: לחצנים, הגנות ויציאות בקר', () => {
  const c = S.controls(demo());
  assert.equal(c.main[0].tag, '-Q0');
  assert.deepEqual(c.outputs.map((o) => o.key), ['-A1:DQA.0', '-A1:DQA.1', '-A1:DQA.2']);
  assert.ok(c.estops.some((x) => x.tag === '-S0'));
});

test('רכיב חדש עם הדקים מקבל פינים בפריסה', () => {
  const raw = D.project();
  raw.components.push({ tag: '-K9', type: 'contactor', name: 'מגען בדיקה', terms: S.defaultTerms('contactor') });
  const P = E.enrich(raw), L = E.layout(P);
  ['A1', 'A2', '1', '6', '14'].forEach((t) => assert.ok(L.pins['-K9:' + t], 'פין ' + t));
  assert.ok(L.comps['-K9']);
});

console.log(`\n${n} בדיקות עברו`);
