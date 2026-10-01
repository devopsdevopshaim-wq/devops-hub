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

test('manual address change per point: valid, outside subnet, duplicate, move to another network', () => {
  const base = defaultConfig();
  const plan0 = buildPlan(base);
  const [a, b] = plan0.idfs[0].outlets;
  const s = a.subnet;
  const free = `${s.network.split('.').slice(0, 3).join('.')}.${Number(s.last.split('.')[3]) - 1}`;
  const cfg = {
    ...base,
    overrides: {
      [a.label]: { ip: free, hostname: 'pc-reception', mac: 'aa:bb:cc:dd:ee:ff' },
      [b.label]: { ip: '192.168.50.5' },
    },
  };
  let plan = buildPlan(cfg);
  let oa = plan.idfs[0].outlets[0];
  assert.equal(oa.ip, free);
  assert.equal(oa.manual, true);
  assert.equal(oa.hostname, 'pc-reception');
  assert.equal(plan.idfs[0].outlets[1].ip, b.ip, 'invalid override keeps the automatic address');
  assert.ok(plan.warnings.some((w) => w.includes(b.label)));

  // duplicate of another point is refused
  plan = buildPlan({ ...base, overrides: { [a.label]: { ip: b.ip } } });
  assert.equal(plan.idfs[0].outlets[0].ip, a.ip);
  assert.ok(plan.warnings.some((w) => w.includes('כבר בשימוש')));

  // move to the building's printer network: gets a free address there, VLAN follows, config has it
  const prn = plan0.subnets.find((x) => x.key === 'print');
  plan = buildPlan({ ...base, overrides: { [a.label]: { subnet: prn.name } } });
  oa = plan.idfs[0].outlets[0];
  assert.equal(oa.vlan, prn.vlan);
  assert.ok(inside(oa.ip, oa.subnet));
  const ips = plan.idfs.flatMap((i) => i.outlets.map((o) => o.ip));
  assert.equal(new Set(ips).size, ips.length, 'no duplicates after the move');
  const sw = allConfigs(plan).find((f) => f.name === `${plan.idfs[0].host}.txt`).text;
  assert.match(sw, new RegExp(`description ${a.label}[\\s\\S]*?switchport access vlan ${prn.vlan}`));
  const kea = JSON.parse(allConfigs(buildPlan(cfg)).at(-1).text);
  assert.ok(kea.Dhcp4.subnet4.some((x) => (x.reservations || []).some((r) => r['hw-address'] === 'aa:bb:cc:dd:ee:ff' && r['ip-address'] === free)));
});
