// בדיקות לאתר התקנה: הצעת כבלים בין ארונות, סוג כבל, אורך, סידור ומערך התקנה.
//   node test/site.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../js/engine.js');
const S = require('../js/site.js');

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('✓', name); };

/* שני ארונות: בכל אחד פס מהדקים -X2 שיוצא למכשיר שטח ‎-W1 עם אותם שמות אותות */
const cab = (id, name, extra = {}) => {
  const raw = {
    name, meta: { title: name, ...(extra.meta || {}) },
    components: [{ tag: '-X2', type: 'terminal' }, { tag: '-W1', name: 'קו לארון שכן', type: 'sensor' }, { tag: '-K1', type: 'relay' }],
    wires: ['RUN', 'FAULT', 'ESTOP'].flatMap((sig, i) => [
      { no: String(10 + i), from: { tag: '-K1', term: String(11 + i * 10) }, to: { tag: '-X2', term: sig } },
      { no: String(20 + i), from: { tag: '-X2', term: sig }, to: { tag: '-W1', term: sig } }
    ])
  };
  const P = E.enrich(raw); P.meta = raw.meta;
  return { id, name, P };
};

const A = cab('a', 'לוח A'), B = cab('b', 'לוח B', { meta: { supply: '3×400V מלוח A, 32A' } });

test('יציאות לשטח לפי פס מהדקים', () => {
  const ext = S.externals(A.P);
  assert.equal(ext.length, 1);
  assert.equal(ext[0].device, '-W1');
  assert.deepEqual(ext[0].strips, ['-X2']);
  assert.equal(ext[0].cores.length, 3);
});

test('הצעת כבל פיקוד לפי אותות זהים, והזנה לפי "מלוח A"', () => {
  const sg = S.suggest([A, B]);
  const ctl = sg.find((l) => l.kind === 'control');
  assert.ok(ctl, 'יש הצעת פיקוד');
  assert.equal(ctl.cores.length, 3);
  assert.equal(ctl.cores[0].a, '-X2:RUN');
  const pw = sg.find((l) => l.kind === 'power');
  assert.ok(pw, 'יש הצעת הזנה');
  assert.equal(pw.a.pid, 'a'); assert.equal(pw.b.pid, 'b');
  assert.equal(pw.cores.length, 5);
  assert.equal(pw.cores[0].section, 6);
});

test('סוג כבל: רזרבה בפיקוד, NYY בכוח', () => {
  const ctl = S.cableFor({ cores: [{ func: 'ctrl_dc' }, { func: 'ctrl_dc' }, { func: 'ctrl_dc' }] });
  assert.equal(ctl.type, 'LiYY 5×0.75');
  const pw = S.cableFor({ cores: ['L1', 'L2', 'L3', 'N', 'PE'].map((t) => ({ func: t === 'PE' ? 'pe' : t === 'N' ? 'neutral' : 'power', section: 6 })) });
  assert.equal(pw.type, 'NYY-J 5×6');
});

test('סידור, אורך כבל ומערך התקנה', () => {
  const site = { layout: {}, trayH: 2.6 };
  const dims = { a: { w: 0.8, h: 2.1, d: 0.4 }, b: { w: 0.6, h: 1.3, d: 0.3 } };
  S.autoLayout(site, [A, B], dims);
  assert.ok(site.layout.b.x > site.layout.a.x + 0.7);
  assert.ok(site.room.w >= 6);
  const link = S.manualLink(A, '-W1', B, '-W1');
  assert.equal(link.cores.length, 3);
  const len = S.linkLength(site, link, dims);
  const dx = site.layout.b.x - site.layout.a.x;
  assert.ok(Math.abs(len - ((2.6 - 2.1) + (2.6 - 1.3) + dx + 1.0) * 1.1) <= 0.11, String(len));
  const steps = S.installSteps(site, [A, B], [{ ...link, cable: S.cableFor(link), length: len }], dims);
  assert.ok(steps.some((s) => s.id === 'place-a') && steps.some((s) => s.id === 'cable-' + link.id) && steps.at(-1).id === 'handover');
});

test('כרטיס רכיב: חיווט מכשיר בשטח דרך פס המהדקים עד הרכיב בארון', () => {
  const r = E.compWiring(A.P, '-W1');
  assert.equal(r.rows.length, 3);
  assert.equal(r.rows[0].other.tag, '-X2');
  assert.equal(r.rows[0].via[0][0].at.tag, '-K1');
  assert.deepEqual(r.strips, ['-X2']);
  assert.match(r.cable, /^LiY/);
  assert.equal(E.compWiring(A.P, '-NOPE'), null);
});

test('הפניות בין ארונות: כל הדק יודע לאיזה ארון, כבל וגיד הוא ממשיך', () => {
  const link = S.manualLink(A, '-W1', B, '-W1');
  const site = { links: [link] };
  const ra = S.crossRefs(site, 'a'), rb = S.crossRefs(site, 'b');
  assert.equal(Object.keys(ra).length, 3);
  assert.deepEqual(ra['-X2:RUN'].map((x) => [x.peer, x.peerRef, x.no, x.core]), [['b', '-X2:RUN', 1, 1]]);
  assert.equal(rb['-X2:FAULT'][0].peer, 'a');
  assert.equal(S.refKey('x2 : 5'), '-X2:5');
  assert.equal(S.refKey('L1'), '');
});

console.log(`\n${n} בדיקות עברו`);
