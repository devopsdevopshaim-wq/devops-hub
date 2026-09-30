import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dolStarter } from './sample.mjs';

const require = createRequire(import.meta.url);
const Netlist = require('../js/netlist.js');
const FixPrompts = require('../js/prompts.js');

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

console.log(`\n${n} בדיקות עברו`);
