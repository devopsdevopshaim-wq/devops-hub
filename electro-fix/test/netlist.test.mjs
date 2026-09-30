import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dolStarter } from './sample.mjs';

const require = createRequire(import.meta.url);
const Netlist = require('../js/netlist.js');
const FixPrompts = require('../js/prompts.js');
const FixParts = require('../js/parts.js');

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

console.log(`\n${n} בדיקות עברו`);
