import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlant, defaultConfig, motorRow } from '../js/engine.js';
import { generatePlc, tagList } from '../js/plccode.js';
import { BRANDS, PROTOCOLS, TEMPLATES, PLCS } from '../js/catalog.js';

test('every template, brand, protocol and PLC builds without errors', () => {
  for (const t of Object.keys(TEMPLATES)) for (const proto of Object.keys(PROTOCOLS)) for (const brand of Object.keys(BRANDS)) {
    const c = defaultConfig(t);
    c.protocol = proto; c.brand = brand; c.plc = Object.keys(PLCS)[brand.length % Object.keys(PLCS).length];
    const p = buildPlant(c);
    assert.equal(p.drives.length, TEMPLATES[t].motors.length);
    for (const d of p.drives) {
      assert.ok(d.driveKw >= d.kw, `${d.tag} drive ≥ motor`);
      assert.equal(d.params.length, 20);
      assert.ok(d.fuse >= d.Iin, `${d.tag} fuse ≥ input current`);
    }
    const code = generatePlc(p);
    assert.match(code, /END_PROGRAM/);
    assert.doesNotMatch(code, /undefined|NaN/);
    assert.ok(tagList(p).length > p.drives.length);
  }
});

test('heavy-duty loads get one frame larger; long cables get filters', () => {
  const c = defaultConfig('pumping');
  c.motors = [motorRow('P-1', 'p', 'pump', 30), { ...motorRow('H-1', 'h', 'hoist', 30), cableM: 400 }];
  const [p, h] = buildPlant(c).drives;
  assert.equal(p.driveKw, 30);
  assert.equal(h.driveKw, 37);
  assert.ok(h.accessories.some((a) => a.k === 'sine'));
  assert.ok(h.accessories.some((a) => a.k === 'brake'));
});

test('addresses are unique per protocol', () => {
  for (const proto of Object.keys(PROTOCOLS)) {
    const c = defaultConfig('wastewater');
    c.protocol = proto;
    c.motors = Array.from({ length: 40 }, (_, i) => motorRow(`M-${i + 1}`, 'm', 'pump', 5.5));
    const p = buildPlant(c);
    const keys = p.drives.map((d) => JSON.stringify([d.addr.ip, d.addr.segment, d.addr.slave, d.addr.node, d.addr.position, d.addr.mac]));
    assert.equal(new Set(keys).size, keys.length, proto);
  }
});

test('Modbus RTU splits into lines of 31 and warns on slow cycles', () => {
  const c = defaultConfig('pumping');
  c.protocol = 'modbus_rtu';
  c.network.rtuBaud = 9600;
  c.motors = Array.from({ length: 40 }, (_, i) => motorRow(`M-${i + 1}`, 'm', 'fan', 3));
  const p = buildPlant(c);
  assert.equal(p.network.rs485.segments, 2);
  assert.ok(p.warnings.some((w) => w.includes('קווי RS-485')));
});

test('energy savings exist for pumps and fans only', () => {
  const p = buildPlant(defaultConfig('production'));
  assert.ok(p.energy.every((e) => e.saveKwh > 0));
  assert.ok(p.energy.every((e) => !e.tag.startsWith('CV')));
});

test('validation errors are readable', () => {
  const c = defaultConfig('pumping');
  c.motors[1].tag = c.motors[0].tag;
  assert.throws(() => buildPlant(c), /פעמיים/);
});
