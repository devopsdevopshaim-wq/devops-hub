import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, defaultConfig, applyProfile, lookup } from '../js/planner.js';
import { allConfigs } from '../js/configgen.js';
import { ipToInt, parseCidr, prefixForHosts } from '../js/ip.js';

const inside = (ip, s) => {
  const n = ipToInt(ip);
  return n > s.base && n < s.base + s.size - 1;
};

test('ip helpers', () => {
  assert.equal(prefixForHosts(126), 25);
  assert.equal(prefixForHosts(127), 24);
  assert.deepEqual(parseCidr('10.1.2.3/16'), { network: ipToInt('10.1.0.0'), prefix: 16, size: 65536 });
});

test('default office plan: every room gets valid, unique addresses inside its subnet', () => {
  const plan = buildPlan(defaultConfig());
  assert.equal(plan.stats.rooms, 6 * 35);
  const seen = new Set();
  for (const idf of plan.idfs) {
    for (const o of idf.outlets) {
      assert.ok(o.ip, `${o.label} has an IP`);
      assert.ok(inside(o.ip, o.subnet), `${o.label} ${o.ip} inside ${o.subnet.cidr}`);
      assert.notEqual(o.ip, o.gateway);
      assert.ok(!seen.has(o.ip), `duplicate ${o.ip}`);
      seen.add(o.ip);
    }
  }
});

test('subnets never overlap and VLAN IDs are unique', () => {
  for (const cfg of [
    defaultConfig(),
    { ...applyProfile(defaultConfig(), 'hotel'), buildings: [{ name: 'a', code: 'A', floors: 4, firstFloor: -1, roomsPerFloor: 40 }, { name: 'b', code: 'B', floors: 2, firstFloor: 0, roomsPerFloor: 120 }] },
    { ...defaultConfig(), addressing: { ...defaultConfig().addressing, base: '172.16.0.0/16' } },
  ]) {
    const plan = buildPlan(cfg);
    const s = [...plan.subnets].sort((a, b) => a.base - b.base);
    for (let i = 1; i < s.length; i++) assert.ok(s[i].base >= s[i - 1].base + s[i - 1].size, `${s[i - 1].cidr} overlaps ${s[i].cidr}`);
    const vlans = plan.subnets.filter((x) => x.vlan).map((x) => x.vlan);
    assert.equal(new Set(vlans).size, vlans.length);
    assert.ok(vlans.every((v) => v >= 2 && v <= 4094));
  }
});

test('40-room cabinet: one IDF, enough switch ports with spare', () => {
  const cfg = { ...defaultConfig(), buildings: [{ name: 'x', code: 'A', floors: 1, firstFloor: 1, roomsPerFloor: 40 }] };
  const plan = buildPlan(cfg);
  assert.equal(plan.idfs.length, 1);
  const idf = plan.idfs[0];
  assert.ok(idf.portsTotal >= idf.portsUsed * 1.2);
  assert.equal(idf.rooms.length, 40);
});

test('floors larger than the cabinet limit are split', () => {
  const cfg = { ...defaultConfig(), roomsPerIdf: 20, buildings: [{ name: 'x', code: 'A', floors: 2, firstFloor: 1, roomsPerFloor: 35 }] };
  const plan = buildPlan(cfg);
  assert.equal(plan.idfs.length, 4);
  assert.deepEqual(plan.idfs.slice(0, 2).map((i) => i.rooms.length), [18, 17]);
});

test('too small address range fails with a clear message', () => {
  const cfg = { ...defaultConfig(), addressing: { ...defaultConfig().addressing, base: '192.168.1.0/24' } };
  assert.throws(() => buildPlan(cfg), /קטן מדי/);
});

test('lookup finds a room by IP', () => {
  const plan = buildPlan(defaultConfig());
  const o = plan.idfs[2].outlets[5];
  const hits = lookup(plan, o.ip);
  assert.ok(hits.some((h) => h.o === o));
});

test('configs are generated for every device and Kea JSON parses', () => {
  const plan = buildPlan({ ...defaultConfig(), buildings: [{ name: 'a', code: 'A', floors: 2, firstFloor: 1, roomsPerFloor: 35 }, { name: 'b', code: 'B', floors: 1, firstFloor: 1, roomsPerFloor: 10 }] });
  const files = allConfigs(plan);
  assert.equal(files.length, 1 + 2 + plan.idfs.length + 1);
  const kea = JSON.parse(files.at(-1).text);
  assert.ok(kea.Dhcp4.subnet4.length > 0);
  for (const f of files.slice(0, -1)) {
    assert.match(f.text, /^hostname /m);
    assert.doesNotMatch(f.text, /undefined|NaN|null/);
  }
});
