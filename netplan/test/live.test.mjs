import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, defaultConfig } from '../js/planner.js';
import { compare, planIndex } from '../js/live.js';

const plan = buildPlan(defaultConfig());
const outlets = plan.idfs.flatMap((i) => i.outlets).filter((o) => o.ip);
const a = outlets[0];
const b = outlets[1];
const lan = { network: `${a.ip.split('.').slice(0, 3).join('.')}.0/24` };

test('plan index covers outlets, switches and gateways', () => {
  const idx = planIndex(plan);
  assert.ok(idx.byIp.get(a.ip));
  assert.equal(idx.byIp.get(a.ip).key, a.label);
  assert.ok(idx.byIp.get(plan.idfs[0].mgmtIp));
});

test('live devices are classified against the plan', () => {
  const devs = [
    { ip: a.ip, mac: 'AA:BB:CC:00:00:01', online: true },
    { ip: '203.0.113.9', mac: 'AA:BB:CC:00:00:02', online: true },
    { ip: b.ip, mac: '', online: false },
  ];
  const r = compare(devs, plan, lan);
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows.find((x) => x.d.ip === a.ip).status, 'match');
  assert.equal(r.rows.find((x) => x.d.ip === '203.0.113.9').status, 'unplanned');
  assert.ok(r.overlaps.length > 0);
  assert.ok(r.missing.some((o) => o.ip === b.ip));
});

test('MAC saved in the plan: wrong MAC and moved device are flagged', () => {
  const cfg = defaultConfig();
  cfg.overrides = { [a.label]: { mac: 'AA:BB:CC:00:00:01' } };
  const p2 = buildPlan(cfg);
  const r = compare([
    { ip: a.ip, mac: 'AA:BB:CC:00:00:99', online: true },
    { ip: b.ip, mac: 'AA:BB:CC:00:00:01', online: true },
  ], p2, lan);
  assert.equal(r.rows.find((x) => x.d.ip === a.ip).status, 'mac');
  const moved = r.rows.find((x) => x.d.ip === b.ip);
  assert.equal(moved.status, 'match'); // b.ip is itself a planned outlet; IP match wins
  const r2 = compare([{ ip: '203.0.113.50', mac: 'AA:BB:CC:00:00:01', online: true }], p2, lan);
  assert.equal(r2.rows[0].status, 'moved');
  assert.equal(r2.rows[0].p.ip, a.ip);
});
