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

test('הארון לפי השרטוט: מסילות וסדר הדקים מהתכנית, וההמלצה בנפרד', () => {
  const P = E.enrich(lib.project());
  const L = E.layout(P), A = E.layout(P, { mode: 'auto' });
  assert.equal(L.mode, 'drawing'); assert.equal(A.mode, 'auto');
  const r1 = L.rails.find((r) => r.fromDrawing && r.items[0].tag === '-A1');
  assert.deepEqual(r1.items.map((c) => c.tag), ['-A1', '-IO1', '-IO2', '-IO3', '-IO4', '-IO5', '-IO6', '-IO7', '-EK1', '-EK2']);
  const t = L.rails.find((r) => r.fromDrawing && r.items[0].tag === '-XS');
  assert.deepEqual(t.items.map((c) => c.tag).slice(0, 4), ['-XS', '-XUPS', '-XMG1', '-XMG2']);
  const order = (LL, tag) => Object.keys(LL.pins).filter((k) => k.startsWith(tag + ':')).sort((a, b) => LL.pins[a].x - LL.pins[b].x).map((k) => k.slice(tag.length + 1));
  assert.deepEqual(order(L, '-XG1').slice(0, 7), ['G1O1', 'G1O2', 'G1C1', 'G1C2', 'G1S1', 'G1S2', '105']);
  assert.notDeepEqual(order(A, '-XG1'), order(L, '-XG1'));
  assert.ok(L.unplaced.includes('-F1') && !L.unplaced.includes('-A1'));
  /* בלי שרטוט פריסה: ההמלצה היא הפריסה */
  assert.equal(E.layout(demo()).mode, 'auto');
});

test('קריאת פריסה מתשובת Claude', () => {
  const Pr = require('../js/prompts.js');
  const r = Pr.fromJson({ wires: [], components: [], layout: { pages: [5], enclosure: { w: 800, h: 1200, d: 300 }, rails: [{ label: 'כוח', tags: ['Q1', '-F1'], spacer: 0 }], door: [], terminalOrder: [{ tag: 'X1', terms: ['3', '1', '2'] }], glands: [{ label: 'הזנה', size: 'M25', row: 1 }], notes: '' } });
  assert.deepEqual(r.layoutPlan.rails[0].tags, ['-Q1', '-F1']);
  assert.deepEqual(r.layoutPlan.termOrder['-X1'], ['3', '1', '2']);
  const empty = Pr.fromJson({ wires: [], components: [], layout: { pages: [], enclosure: { w: 0, h: 0, d: 0 }, rails: [], door: [], terminalOrder: [], glands: [], notes: '' } });
  assert.equal(empty.layoutPlan, undefined);
});

test('כמה ארונות בשרטוט: כל רכיב בארון שלו, וחוטים בין ארונות הופכים לכבל', () => {
  const SP = require('../js/split.js');
  const P = demo(), L = E.layout(P);
  const bin = {}; ['-X0', '-Q0', '-F1', '-K1', '-X1'].forEach((t) => { bin[t] = 0; }); ['-F2', '-F3', '-G1', '-A1', '-X2'].forEach((t) => { bin[t] = 1; });
  const r = SP.split(P, L, 2, { bin, roles: ['ארון כוח', 'ארון פיקוד'] });
  assert.deepEqual(r.roles, ['ארון כוח', 'ארון פיקוד']);
  const has = (i, t) => r.cabinets[i].components.some((c) => c.tag === t);
  assert.ok(has(0, '-K1') && has(0, '-Q0') && !has(0, '-A1'));
  assert.ok(has(1, '-A1') && has(1, '-G1') && !has(1, '-K1'));
  assert.ok(r.links.length >= 1);
});

test('הגדרות ציוד: בקר ומפת I/O, ראוטר לפי החיווט, דרייבר עם פרמטרים', () => {
  const W = require('../js/config.js');
  const P = E.enrich(lib.project()), L = E.layout(P);
  const c = W.build(P, L);
  assert.equal(c.plcs.length, 1);
  assert.deepEqual(c.plcs[0].hw.map((h) => h.tag).slice(0, 3), ['-A1', '-IO1', '-IO2']);
  assert.ok(c.plcs[0].io.length >= 100);
  assert.ok(c.plcs[0].io.some((r) => r.module === '-IO1' && r.ch === '11' && r.dir === 'in' && r.to === '-SW3:3'));
  assert.deepEqual(c.routers.map((r) => r.tag), ['-SW3']);
  assert.ok(c.routers[0].setup.some((x) => /RTEL/.test(x.value)));
  assert.ok(c.settings.some((x) => x.tag === '-SW3' && x.name === 'WAN'));
  /* דרייבר: נתוני המנוע מהשרטוט, פרמטר שכתוב בתכנית גובר */
  const raw = { name: 't', components: [{ tag: '-T1', type: 'vfd', name: 'ממיר תדר SINAMICS G120' }, { tag: '-M1', type: 'motor', name: 'משאבה 2.2kW 400V 4.9A 1430rpm' }], wires: ['U', 'V', 'W'].map((t, i) => ({ no: String(i + 1), from: { tag: '-T1', term: t }, to: { tag: '-M1', term: t + '1' } })), deviceSettings: [{ tag: '-T1', group: 'פרמטרים', name: 'p1120', value: '5 s', page: 12 }] };
  const P2 = E.enrich(raw);
  const d = W.build(P2, E.layout(P2)).drives[0];
  assert.equal(d.family, 'siemens');
  assert.equal(d.motor.tag, '-M1');
  const pv = (id) => d.params.find((p) => p.id === id);
  assert.equal(pv('p0307').value, '2.2 kW'); assert.equal(pv('p0307').src, 'drawing');
  assert.equal(pv('p0305').value, '4.9 A'); assert.equal(pv('p0311').value, '1430 rpm');
  assert.equal(pv('p1120').value, '5 s'); assert.equal(pv('p1120').src, 'drawing');
  assert.equal(pv('p1121').src, 'recommended');
});

test('שאלות על התכנית: מסלול האות של שער 1 פתוח / סגור, וכל חיווט הסייפטי', () => {
  const A = require('../js/ask.js');
  const P = E.enrich(lib.project());
  const r = A.ask(P, 'לאן מחובר חיישן שער 1 מצב פתוח ומצב סגור?');
  const open = r.circuits.find((c) => c.pin === '-IO1:5'), closed = r.circuits.find((c) => c.pin === '-IO1:6');
  assert.ok(open && closed);
  assert.deepEqual(open.steps.map((s) => s.tag + ':' + s.term), ['-GATE1:+24V', '-GATE1:OPENED', '-XG1:105', '-IO1:5']);
  assert.deepEqual(closed.steps.map((s) => s.tag + ':' + s.term), ['-GATE1:+24V', '-GATE1:CLOSED', '-XG1:106', '-IO1:6']);
  assert.ok(r.pages.includes(7));
  const s = A.ask(P, 'מה התכנית רושמת על הסייפטי?');
  assert.ok(s.broad && s.comps.includes('-KSFT') && s.wires.length > 50);
  const pw = A.ask(P, 'איך מוזן הבקר?').circuits.find((c) => c.pin === '-A1:24V');
  assert.equal(pw.steps[0].tag, '-PS1');
  assert.ok(pw.steps.some((x) => x.tag === '-RPLC'));
  assert.equal(A.ask(P, 'קשקוש בלי שום קשר').ok, false);
});

test('שאלת תכנון (L-RO): השער ייפתח רק כשהמעלית למעלה וגם הגג — כל ממסר היתר ממקור אחד', () => {
  const A = require('../js/ask.js');
  const P = E.enrich(require('./fixtures/lobby-ro.cjs')());
  const q = 'אני רוצה שהשער יפתח רק כאשר המעלית למעלה ויש לי אינדיקציה של גג למעלה';
  assert.ok(A.isDesign(q) && !A.isDesign('לאן מחובר K1?'));
  assert.deepEqual(A.splitDesign(q).conds, ['המעלית למעלה', 'גג למעלה']);
  const r = A.design(P, q);
  assert.deepEqual(r.action.outputs.map((o) => o.pin), ['-PLC1.3:1']);
  assert.deepEqual(r.action.targets, ['-X5 L1…L5']);
  assert.deepEqual(r.permits.map((p) => p.tag).sort(), ['-RS1', '-RS2']);
  assert.ok(r.permits.every((p) => p.parallel));
  assert.equal(r.conds[0].inputs[0].pin, '-PLC1.1:8');
  assert.equal(r.conds[1].inputs[0].pin, '-PLC1.1:9');
  assert.ok(r.conds[1].inputs[0].nc && /גג סגור/.test(r.conds[1].warn));
  /* המגעים כבר בטור ב-STO: מפרידים את ההזנה — RS2 רק מ-SR3, RS1 רק מ-SR2 (או להפך) */
  assert.equal(r.plan.mode, 'split');
  assert.deepEqual(r.chains[0].pins, ['-X5:L4', '-RS2:11', '-RS2:14', '-RS1:11', '-RS1:14', '-X5:L5']);
  const feeds = r.plan.rewire.map((w) => w.feed.split(':')[0]).sort();
  assert.deepEqual(feeds, ['-SR2', '-SR3']);
  assert.ok(r.plan.rewire.every((w) => w.steps.some((s) => s.op === 'remove')));
  /* חי: היום מספיק תנאי אחד, אחרי השינוי צריך את שניהם */
  const { evaluate } = { evaluate: (L, st, mode) => {
    const on = (c) => c < 0 || !!st.cond[c];
    const rel = {}; L.permits.forEach((p) => { const src = mode === 'after' ? p.after : p.today; rel[p.tag] = src.some((s) => on(s.cond)); });
    return L.chains.every((ch) => ch.relays.every((t) => rel[t]));
  } };
  assert.equal(evaluate(r.live, { cond: [true, false] }, 'today'), true);
  assert.equal(evaluate(r.live, { cond: [true, false] }, 'after'), false);
  assert.equal(evaluate(r.live, { cond: [true, true] }, 'after'), true);
  assert.ok(r.pages.includes(21) && r.pages.includes(23));
});

test('רשימת חיבורים של EPLAN בשני טורים, ושמות האותות מעמודי הבקר', () => {
  const it = (s, x, y) => ({ s, x, y, w: 0.03, h: 0.01 });
  const row = (y, a, b) => [it(a[0], 0.06, y), it(a[1], 0.12, y), it(a[2], 0.25, y), it('אפור', 0.36, y), it('0,5', 0.42, y), it(b[0], 0.53, y), it(b[1], 0.6, y), it(b[2], 0.68, y), it('כתום', 0.8, y), it('0,5', 0.9, y)];
  const list = { page: 21, items: [it('Connection', 0.06, 0.1), it('Target 1', 0.12, 0.1), it('Target 2', 0.25, 0.1),
    ...row(0.14, ['I1.0', '-PLC1.1:8', '-SR3:13'], ['RS1', '-RS1:A1', '-SR3:2']),
    ...row(0.18, ['I1.1', '-PLC1.1:9', '-SR2:11'], ['RS1', '-SR2:6', '-SR3:2']),
    ...row(0.22, ['24V+', '-X9:5:2', '-XS1:24V:2'], ['FGO1', '-RS2:11', '-X5:L4:2'])] };
  const io = { page: 4, items: [it('I1.0', 0.1, 0.18), it('מיקום רכב קדימה', 0.09, 0.3), it('I1.0', 0.1, 0.45), it('אפור', 0.11, 0.44), it('מעלית ב0', 0.09, 0.62),
    it('I1.1', 0.2, 0.18), it('I1.1', 0.2, 0.45), it('גג סגור', 0.19, 0.62)] };
  const ex = E.extractFromText([io, list]);
  const k = (w) => `${w.no}|${w.from.tag}:${w.from.term}|${w.to.tag}:${w.to.term}`;
  const got = ex.wires.map(k);
  ['I1.0|-PLC1.1:8|-SR3:13', 'RS1|-RS1:A1|-SR3:2', 'I1.1|-PLC1.1:9|-SR2:11', 'RS1|-SR2:6|-SR3:2', '24V+|-X9:5|-XS1:24V', 'FGO1|-RS2:11|-X5:L4'].forEach((x) => assert.ok(got.includes(x), x + ' — ' + got.join(', ')));
  assert.equal(ex.wires.length, 6);
  assert.equal(ex.wires.find((w) => w.no === 'I1.0').desc, 'מעלית ב0');
  assert.equal(ex.wires.find((w) => w.no === 'I1.1').desc, 'גג סגור');
});

console.log(`\n${n} בדיקות עברו`);
