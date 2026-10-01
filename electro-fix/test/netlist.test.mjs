import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dolStarter } from './sample.mjs';

const require = createRequire(import.meta.url);
const Netlist = require('../js/netlist.js');
const FixPrompts = require('../js/prompts.js');
const FixParts = require('../js/parts.js');
const TestKit = require('../js/testkit.js');
const HomePlan = require('../js/homeplan.js');
const FloorPlan = require('../js/floorplan.js');
const PlanSample = require('../js/plansample.js');

let n = 0;
function test(name, fn) { fn(); n++; console.log('✓', name); }

test('סכימה תקינה עוברת בלי שגיאות', () => {
  const r = Netlist.check(dolStarter());
  assert.equal(r.stats.errors, 0, JSON.stringify(r.issues, null, 1));
  assert.equal(r.stats.warnings, 0, JSON.stringify(r.issues, null, 1));
  assert.equal(r.stats.components, 7);
});

test('קצר בין פאזה לאפס מזוהה', () => {
  const s = dolStarter();
  s.wires.push({ from: 'K1.A1', to: 'X0.N', color: 'כחול', section: '1', label: 'x' });
  s.wires.push({ from: 'X0.L1', to: 'K1.A1', color: 'חום', section: '1', label: 'y' });
  const r = Netlist.check(s);
  assert.ok(r.issues.some((i) => i.level === 'error' && i.message.includes('קצר')));
});

test('חיבור N ל-PE מזוהה', () => {
  const s = dolStarter();
  s.wires.push({ from: 'X0.N', to: 'M1.PE', color: 'כחול', section: '1', label: 'z' });
  const r = Netlist.check(s);
  assert.ok(r.issues.some((i) => i.level === 'error' && i.message.includes('N ו-PE')));
});

test('ירוק-צהוב על פאזה, הדק לא קיים, הארקה חסרה', () => {
  const s = dolStarter();
  s.wires[0].color = 'ירוק-צהוב';
  s.wires.push({ from: 'K1.99', to: 'S1.14', color: 'אדום', section: '1', label: 'q' });
  s.components[3].terminals.pop();
  s.wires = s.wires.filter((w) => w.to !== 'M1.PE');
  const r = Netlist.check(s);
  const msgs = r.issues.map((i) => i.message).join('\n');
  assert.match(msgs, /ירוק-צהוב משמש רק להארקה/);
  assert.match(msgs, /K1\.99 לא קיים/);
  assert.match(msgs, /אין הדק הארקה/);
  assert.match(msgs, /X0\.PE .* לא מחובר/);
});

test('נרמול פוטנציאלים', () => {
  assert.equal(Netlist.normPotential('+24VDC'), '+24V');
  assert.equal(Netlist.normPotential('gnd'), '0V');
  assert.equal(Netlist.normPotential('M'), '0V');
  assert.equal(Netlist.normPotential('l2'), 'L2');
  assert.equal(Netlist.normPotential(''), '');
});

test('שרטוט מחזיר SVG עם כל הרכיבים והחוטים', () => {
  const svg = Netlist.render(dolStarter());
  assert.match(svg, /^<svg/);
  for (const id of ['X0', 'Q1', 'K1', 'M1', 'F2', 'S0', 'S1']) assert.ok(svg.includes('data-id="' + id + '"'), id);
  assert.ok((svg.match(/<path d="M/g) || []).length >= 17);
});

test('בניית הודעות ל-Claude', () => {
  const msgs = FixPrompts.buildMessages([
    { role: 'user', text: 'מגען לא נסגר', files: [{ name: 'a.jpg', type: 'image/jpeg', data: 'AAAA' }, { name: 'd.pdf', type: 'application/pdf', data: 'BBBB' }] },
    { role: 'assistant', result: { title: 't', summary: 's' } },
    { role: 'user', text: 'מדדתי 0V' }
  ]);
  assert.equal(msgs.length, 3);
  assert.equal(msgs[0].content[0].type, 'image');
  assert.equal(msgs[0].content[1].type, 'document');
  assert.equal(msgs[0].content.at(-1).type, 'text');
  assert.equal(msgs[1].role, 'assistant');
});

test('הסכמה תקינה ל-structured outputs (additionalProperties=false וכל השדות חובה)', () => {
  (function walk(s, path) {
    if (s.type === 'object') {
      assert.equal(s.additionalProperties, false, path);
      assert.deepEqual([...s.required].sort(), Object.keys(s.properties).sort(), path);
      for (const [k, v] of Object.entries(s.properties)) walk(v, path + '.' + k);
    }
    if (s.type === 'array') walk(s.items, path + '[]');
  })(FixPrompts.SCHEMA, '$');
});

test('פענוח תשובה עם טקסט מסביב (מצב העתק-הדבק)', () => {
  const r = FixPrompts.parseResult('הנה:\n```json\n{"title":"x","summary":"y"}\n```');
  assert.equal(r.title, 'x');
  assert.deepEqual(r.causes, []);
  assert.equal(r.schematic.needed, false);
});

test('כל התבניות נקיות משגיאות ומהערות', () => {
  for (const t of FixParts.TEMPLATES) {
    if (t.id === 'blank') continue;
    const r = Netlist.check(t.build());
    assert.equal(r.stats.errors + r.stats.warnings, 0, t.id + ': ' + r.issues.map((i) => i.message).join(' | '));
    assert.ok(Netlist.render(t.build(), { interactive: true }).includes('data-pin='), t.id);
  }
});

const tpl = (id) => FixParts.TEMPLATES.find((t) => t.id === id).build();
const msgs = (s) => Netlist.check(s).issues.map((i) => i.level + ': ' + i.message).join('\n');

test('נורית בלי נגד טורי', () => {
  const s = tpl('led');
  s.wires = [{ from: 'J1.VBUS', to: 'D1.A' }, { from: 'D1.K', to: 'J1.GND' }];
  assert.match(msgs(s), /error: הנורית D1.*בלי נגד טורי/);
});

test('קבל אלקטרוליטי הפוך ומתח עבודה נמוך', () => {
  const s = tpl('ldo');
  const c1 = s.components.find((c) => c.id === 'C1');
  c1.value = '10µF 4V';
  s.wires = s.wires.map((w) => ({ ...w, from: w.from === 'C1.+' ? 'C1.-' : w.from === 'C1.-' ? 'C1.+' : w.from, to: w.to === 'C1.+' ? 'C1.-' : w.to === 'C1.-' ? 'C1.+' : w.to }));
  const m = msgs(s);
  assert.match(m, /C1.*מחובר הפוך/);
  assert.match(m, /מתח העבודה של C1 .*נמוך/);
});

test('ממסר בלי דיודת גלגול חופשי, ודיודה הפוכה', () => {
  const s = tpl('relay');
  const noDiode = { ...s, wires: s.wires.filter((w) => !w.from.startsWith('D1') && !w.to.startsWith('D1')) };
  noDiode.components = s.components.filter((c) => c.id !== 'D1');
  assert.match(msgs(noDiode), /warning: אין דיודת גלגול חופשי/);
  const rev = JSON.parse(JSON.stringify(s));
  rev.wires.forEach((w) => { if (w.from === 'D1.K') w.from = 'D1.A'; else if (w.from === 'D1.A') w.from = 'D1.K'; });
  assert.match(msgs(rev), /error: דיודת הגלגול החופשי .* הפוכה/);
});

test('טרנזיסטור בלי נגד בסיס', () => {
  const s = tpl('relay');
  s.wires = s.wires.filter((w) => !(w.from === 'R1.2' && w.to === 'Q1.B') && !(w.from === 'Q1.B' && w.to === 'R2.1'));
  s.wires.push({ from: 'J2.1', to: 'Q1.B' });
  assert.match(msgs(s), /אין נגד בסיס ל-Q1/);
});

test('רכיב 3.3V על 5V, חסר קבל ניתוק, ורגולטור שמעלה מתח', () => {
  const s = tpl('esp32');
  s.wires.push({ from: 'J1.VBUS', to: 'U2.3V3' });
  assert.match(msgs(s), /שני מתחי הזנה שונים/);
  const s2 = tpl('esp32');
  s2.components = s2.components.filter((c) => !['C2', 'C3'].includes(c.id));
  s2.wires = s2.wires.filter((w) => !/^C[23]\./.test(w.from) && !/^C[23]\./.test(w.to));
  assert.match(msgs(s2), /אין קבל ניתוק/);
  const s3 = tpl('ldo');
  s3.components.find((c) => c.id === 'J1').terminals[0].potential = '+3.3V';
  s3.components.find((c) => c.id === 'J2').terminals[0].potential = '+5V';
  assert.match(msgs(s3), /לא יכול להעלות מתח/);
});

test('סכמת התכנון תקינה ל-structured outputs, ופענוח תשובה', () => {
  (function walk(s, path) {
    if (s.type === 'object') {
      assert.equal(s.additionalProperties, false, path);
      assert.deepEqual([...s.required].sort(), Object.keys(s.properties).sort(), path);
      for (const [k, v] of Object.entries(s.properties)) walk(v, path + '.' + k);
    }
    if (s.type === 'array') walk(s.items, path + '[]');
  })(FixPrompts.DESIGN_SCHEMA, '$');
  const r = FixPrompts.parseDesign(JSON.stringify({ title: 't', summary: 's', schematic: { components: [] } }));
  assert.equal(r.schematic.needed, true);
  assert.deepEqual(r.pcb_notes, []);
  const m = FixPrompts.designMessages('review', 'שאלה', tpl('led'), [{ level: 'warning', message: 'x' }]);
  assert.match(m[0].content[0].text, /"D1"/);
});

test('פותר DC: מחלק מתח, זרם נורית ורגולטור', () => {
  const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, a + ' ≠ ' + b);
  const div = TestKit.solve(tpl('divider'));
  near(div.voltAt('J2.1'), 12 * 3.3 / 13.3, 0.01);
  const led = TestKit.solve(tpl('led'));
  const d1 = led.diodes.find((d) => d.id === 'D1');
  near(d1.i, (5 - 2) / 330, 1e-4);
  const ldo = TestKit.solve(tpl('ldo'));
  near(ldo.voltAt('U1.OUT'), 3.3, 1e-9);
  // נורית הפוכה לא מוליכה
  const rev = tpl('led');
  rev.wires = [{ from: 'J1.VBUS', to: 'R1.1' }, { from: 'R1.2', to: 'D1.K' }, { from: 'D1.A', to: 'J1.GND' }];
  assert.equal(TestKit.solve(rev).diodes[0].on, false);
});

test('ערכות מדידה: תדר 555, קצר, ובדיקת ערך נמדד', () => {
  const k = TestKit.kits(tpl('ne555')).kits;
  const f = k.find((x) => x.id === 'function').steps.find((s) => /תדר/.test(s.title));
  assert.ok(Math.abs((f.expect.min + f.expect.max) / 2 - 1.44 / (21000 * 100e-6)) < 0.01);
  const off = TestKit.kits(tpl('divider')).kits.find((x) => x.id === 'unpowered');
  const short = off.steps.find((s) => /אין קצר/.test(s.title));
  assert.equal(TestKit.evaluate(short, '3.2'), 'fail');
  assert.equal(TestKit.evaluate(short, '13.3k'), 'pass');
  assert.equal(TestKit.evaluate(short, 'OL'), 'pass');
  assert.equal(TestKit.evaluate({ expect: { check: true } }, 'ok'), 'pass');
  assert.equal(TestKit.parseMeasure('4.7k'), 4700);
  assert.equal(TestKit.resistance('4k7'), 4700);
  assert.equal(TestKit.resistance('2.2kΩ 0.5W'), 2200);
  for (const t of FixParts.TEMPLATES) for (const kit of TestKit.kits(t.build()).kits) assert.ok(kit.steps.length > 0, t.id + '/' + kit.id);
});

test('תכנון לבית: מעגלים, פאזות, פחת ולוח', () => {
  for (const k of Object.keys(HomePlan.PRESETS)) {
    const plan = HomePlan.preset(k), P = HomePlan.panel(plan), C = P.circuits;
    const lights = plan.rooms.reduce((s, r) => s + r.lights, 0);
    assert.equal(C.circuits.filter((c) => c.kind === 'light').reduce((s, c) => s + c.points, 0), lights, k);
    assert.ok(C.circuits.every((c) => c.points <= (c.kind === 'light' ? 10 : 8)), k + ' points per circuit');
    assert.ok(C.circuits.every((c) => c.rcd), k + ' every circuit on an RCD');
    assert.ok(P.spare / P.total >= 0.2, k + ' spare space');
    if (C.tri) assert.ok(Math.max(...C.perPhaseA) - Math.min(...C.perPhaseA) < 3, k + ' phases balanced');
    assert.match(HomePlan.renderPanel(P, 't'), /^<svg/);
  }
  const house = HomePlan.panel(HomePlan.preset('house'));
  assert.ok(house.circuits.rcds.some((r) => r.type === 'B'), 'EV gets a type B RCD');
  const one = HomePlan.preset('apt4'); one.supply = '1x40';
  assert.equal(HomePlan.advice(one)[0].level, 'error');
  const knx = HomePlan.preset('apt4'); knx.tech = 'knx';
  assert.ok(HomePlan.smart(knx).panel.length >= 3);
});

test('שרטוט אדריכלי: קנה מידה, נקודות בכל חדר, לוח ובניין', () => {
  const proj = PlanSample.sampleProject(), f = proj.floors[0], a = f.apartments[0];
  assert.ok(Math.abs(FloorPlan.scale(f) - 0.01) < 0.0002, 'scale from written dimensions');
  assert.deepEqual(FloorPlan.validate(proj), []);
  const P = FloorPlan.placePoints(proj, f, a);
  for (const r of a.rooms) {
    const x = P[r.id];
    for (const p of x.points) assert.ok(p.x >= -0.01 && p.y >= -0.01 && p.x <= x.m.w + 0.01 && p.y <= x.m.h + 0.01, r.name + ' ' + p.kind + ' inside room');
    const want = HomePlan.ROOMS[r.type].sockets(Math.round(x.m.area * 10) / 10);
    assert.equal(x.points.filter((p) => p.kind === 'socket').length, want, r.name + ' sockets');
    if (x.plan.lights) assert.ok(x.points.some((p) => p.kind === 'switch'), r.name + ' has a switch');
  }
  const living = a.rooms.find((r) => r.type === 'living');
  const ac = P[living.id].points.find((p) => p.kind === 'ac');
  assert.ok(ac && ac.circuit && /C16/.test(ac.circuit.breaker), 'AC on its own C16 circuit');
  assert.equal(P._panelRoom, a.rooms.find((r) => r.type === 'entrance').id, 'panel by the entrance');
  // דלת: המתג לא נופל על פתח הדלת
  const kitchen = a.rooms.find((r) => r.type === 'kitchen');
  const sw = P[kitchen.id].points.find((p) => p.kind === 'switch'), door = P[kitchen.id].doors[0];
  assert.ok(door && Math.abs((sw.wall === door.wall ? (door.wall === 'top' || door.wall === 'bottom' ? sw.x : sw.y) : 99) - door.at) > 0.45);
  const B = FloorPlan.building(proj);
  assert.equal(B.apartments, 1); assert.equal(B.isBuilding, false); assert.equal(B.units[0].supply, '3x25');
  // בניין: קומה טיפוסית ×5 עם שתי דירות
  const b2 = JSON.parse(JSON.stringify(proj));
  b2.kind = 'building';
  const half = (r, dx) => ({ ...r, id: r.id + dx, box: { x0: Math.round(r.box.x0 / 2 + dx), x1: Math.round(r.box.x1 / 2 + dx), y0: r.box.y0, y1: r.box.y1 }, width_m: r.width_m / 2 }), ap = b2.floors[0].apartments[0];
  b2.floors[0].repeat = 5;
  b2.floors[0].apartments = [{ ...ap, id: 'A', name: 'דירה A', rooms: ap.rooms.map((r) => half(r, 0)) }, { ...ap, id: 'B', name: 'דירה B', rooms: ap.rooms.map((r) => half(r, 500)) }];
  const BB = FloorPlan.building(b2);
  assert.equal(BB.apartments, 10);
  assert.equal(BB.ks, 0.5);
  assert.ok(BB.common.some((c) => /מעלית/.test(c.name)));
  assert.ok(BB.main >= BB.amps * 1.2);
  assert.equal(BB.meters, 12);
  assert.match(FloorPlan.renderRiser(BB, 't'), /חדר מונים/);
  assert.match(FloorPlan.renderOverlay(proj, f, { apt: 'a1' }), /class="fp-pt"/);
  // חפיפה מזוהה
  const bad = JSON.parse(JSON.stringify(proj));
  bad.floors[0].apartments[0].rooms.push({ ...a.rooms[0], id: 'dup', name: 'כפול' });
  assert.ok(FloorPlan.validate(bad).some((x) => /חופפים/.test(x)));
  // סכמה ל-structured outputs
  (function walk(s2, path) {
    if (s2.type === 'object') { assert.equal(s2.additionalProperties, false, path); assert.deepEqual([...s2.required].sort(), Object.keys(s2.properties).sort(), path); for (const [k, v] of Object.entries(s2.properties)) walk(v, path + '.' + k); }
    if (s2.type === 'array') walk(s2.items, path + '[]');
  })(FixPrompts.FLOOR_SCHEMA, '$');
  const m = FixPrompts.floorMessages([{ data: 'A'.repeat(200), name: 'x' }], 'הערה', 'building');
  assert.equal(m[0].content.filter((c) => c.type === 'image').length, 1);
});

console.log(`\n${n} בדיקות עברו`);
