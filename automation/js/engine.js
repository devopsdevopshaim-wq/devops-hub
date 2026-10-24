// Calculation engine: drive selection, electrical sizing, communication addressing, parameter sheets,
// data maps, network timing, energy savings, bill of materials and warnings. Pure functions.

import {
  APPLICATIONS, DRIVE_KW, motorData, PROTOCOLS, BRANDS, APP_USE, PARAM_FUNCS, PARAMS, MODBUS_MAPS, TEMPLATES, PLCS,
} from './catalog.js';

export function defaultConfig(template = 'pumping') {
  return {
    version: 1,
    site: { name: TEMPLATES[template]?.he || 'מתקן חדש', code: 'PLANT1', number: 1 },
    template,
    brand: 'generic',
    protocol: 'modbus_tcp',
    plc: 'generic',
    supplyV: 400,
    hz: 50,
    environment: 'industrial',
    transformerKVA: 1000,
    network: { subnet: '192.168.10.0/24', start: 21, rtuBaud: 19200, rtuFormat: '8E1', canBitrate: 500 },
    redundancy: true,
    kwhPrice: 0.6,
    hours: 6000,
    motors: (TEMPLATES[template]?.motors || []).map(([tag, name, app, kw]) => motorRow(tag, name, app, kw)),
  };
}

export function motorRow(tag, name, app = 'pump', kw = 7.5) {
  return { tag, name, app, kw, v: 0, hz: 0, rpm: 0, cableM: 30, brand: '' };
}

const FUSES = [2, 4, 6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600];
// Copper, PVC, three loaded conductors, installation on tray (indicative current capacity, A).
const CABLES = [[1.5, 18], [2.5, 25], [4, 34], [6, 43], [10, 60], [16, 80], [25, 101], [35, 126], [50, 153], [70, 196], [95, 238], [120, 276], [150, 319], [185, 364], [240, 430]];
const TRAFO = [100, 160, 250, 400, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000];
const SQ3 = Math.sqrt(3);
const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

function cableFor(amps) {
  for (const [mm, a] of CABLES) if (a >= amps) return { mm2: mm, runs: 1, text: `${mm} ממ״ר` };
  const runs = Math.ceil(amps / 430);
  const per = cableFor(amps / runs);
  return { mm2: per.mm2, runs, text: `${runs}× ${per.mm2} ממ״ר במקביל` };
}

function ipv4(str) {
  const m = String(str).trim().match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)\/(\d+)$/);
  if (!m) throw new Error(`רשת לא תקינה: ${str} (פורמט: 192.168.10.0/24)`);
  const n = ((+m[1] << 24) >>> 0) + (+m[2] << 16) + (+m[3] << 8) + +m[4];
  const prefix = +m[5];
  if (prefix < 8 || prefix > 30) throw new Error('אורך הקידומת חייב להיות בין 8 ל-30');
  const size = 2 ** (32 - prefix);
  const base = Math.floor(n / size) * size;
  const ip = (x) => [x >>> 24, (x >>> 16) & 255, (x >>> 8) & 255, x & 255].join('.');
  const mask = ip(prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0);
  return { base, size, prefix, mask, ip };
}

export function chooseFamily(brand, app, driveKw) {
  const b = BRANDS[brand] || BRANDS.generic;
  const uses = APP_USE[app] || ['general'];
  const fits = b.families.filter((f) => driveKw >= f.kw[0] && driveKw <= f.kw[1]);
  for (const u of uses) { const f = fits.find((x) => x.use === u); if (f) return f; }
  return fits.find((x) => x.use === 'general') || fits[0] || b.families[b.families.length - 1];
}

export function validate(cfg) {
  const errs = [];
  if (!cfg.motors?.length) errs.push('יש להגדיר לפחות מנוע אחד.');
  const tags = new Set();
  (cfg.motors || []).forEach((m, i) => {
    const id = m.tag || `שורה ${i + 1}`;
    if (!m.tag) errs.push(`שורה ${i + 1}: חסר תג (למשל P-101).`);
    if (tags.has(m.tag)) errs.push(`התג ${m.tag} מופיע פעמיים.`);
    tags.add(m.tag);
    if (!(+m.kw > 0 && +m.kw <= 5000)) errs.push(`${id}: הספק המנוע חייב להיות בין 0.1 ל-5000 kW.`);
    if (!APPLICATIONS[m.app]) errs.push(`${id}: סוג עומס לא מוכר.`);
    if (+m.cableM < 0 || +m.cableM > 2000) errs.push(`${id}: אורך כבל המנוע חייב להיות עד 2000 מ׳.`);
  });
  if (!PROTOCOLS[cfg.protocol]) errs.push('פרוטוקול לא מוכר.');
  if (errs.length) { const e = new Error(errs.join('\n')); e.list = errs; throw e; }
}

export function buildPlant(raw) {
  const cfg = JSON.parse(JSON.stringify(raw));
  validate(cfg);
  const proto = PROTOCOLS[cfg.protocol];
  const net = ipv4(cfg.network.subnet);
  const warnings = [];
  const notes = [];
  const sid = Math.max(1, Math.min(4000, Math.round(+cfg.site.number || 1)));

  // ---------- drives
  const drives = cfg.motors.map((m, i) => {
    const app = APPLICATIONS[m.app];
    const V = +m.v || +cfg.supplyV;
    const hz = +m.hz || +cfg.hz;
    const rpm = +m.rpm || (hz === 60 ? 1775 : 1475);
    const kw = +m.kw;
    const { eff, pf } = motorData(kw);
    const In = (kw * 1000) / (SQ3 * V * pf * eff);
    let idx = DRIVE_KW.findIndex((x) => x >= kw);
    if (idx < 0) idx = DRIVE_KW.length - 1;
    if (app.duty === 'HD' && idx < DRIVE_KW.length - 1) idx += 1; // heavy duty: one frame up for 150% overload
    const driveKw = DRIVE_KW[idx];
    const dd = motorData(driveKw);
    const driveI = (driveKw * 1000) / (SQ3 * V * dd.pf * dd.eff);
    const brand = m.brand || cfg.brand;
    const family = chooseFamily(brand, m.app, driveKw);
    const commOpt = (BRANDS[brand] || BRANDS.generic).comm[cfg.protocol] || 'Gateway';
    if (/gateway/i.test(commOpt)) warnings.push(`${m.tag}: ל-${BRANDS[brand].he} אין ממשק ${proto.he} מקורי. נדרש Gateway (ממיר פרוטוקול), או שיש לבחור פרוטוקול אחר.`);

    // electrical
    const Iin = (kw * 1000) / (eff * 0.97 * SQ3 * V * 0.95);
    const fuse = FUSES.find((f) => f >= Iin * 1.25) || FUSES[FUSES.length - 1];
    const inCable = cableFor(Math.max(fuse, Iin * 1.25));
    const motorCable = cableFor(In * 1.1);
    const lossW = Math.round(driveKw * 1000 * 0.025);
    const L = +m.cableM || 0;
    const chokeLimit = driveKw < 4 ? 30 : driveKw < 30 ? 50 : 100;
    const accessories = [];
    if (L > 300) accessories.push({ k: 'sine', he: 'מסנן סינוס במוצא', why: `כבל מנוע ארוך מאוד (${L} מ׳)` });
    else if (L > chokeLimit) accessories.push({ k: 'dvdt', he: 'מסנן du/dt או משנק מוצא', why: `כבל מנוע ${L} מ׳ (מעל ${chokeLimit} מ׳ לגודל הזה)` });
    if (driveKw >= 22 || cfg.environment === 'commercial') accessories.push({ k: 'reactor', he: 'משנק קו 3–4% (אם אין משנק DC מובנה)', why: 'הפחתת הרמוניות והגנה מפני קפיצות ברשת' });
    accessories.push({ k: 'emc', he: cfg.environment === 'commercial' ? 'מסנן EMC קטגוריה C2' : 'מסנן EMC קטגוריה C3 (מובנה ברוב הממירים)', why: cfg.environment === 'commercial' ? 'סביבה ראשונה: מבנה מסחרי או מגורים' : 'סביבה שנייה: רשת תעשייתית' });
    if (app.brake) accessories.push({ k: 'brake', he: `נגד בלימה ‎~${round(kw * (m.app === 'hoist' ? 0.5 : 0.25), 1)} kW (או יחידת השבה)`, why: m.app === 'hoist' ? 'עומס גרירה בהורדה' : 'אינרציה גבוהה בהאטה' });
    if (m.app === 'hoist') accessories.push({ k: 'encoder', he: 'אנקודר ובקרת בלם מכני מהממיר', why: 'החזקת עומס במהירות אפס' });

    // communication address
    const a = {};
    if (proto.addr === 'ip' || proto.addr === 'ip+name') {
      const off = +cfg.network.start + i;
      if (off >= net.size - 1) throw new Error(`הרשת ${cfg.network.subnet} קטנה מדי ל-${cfg.motors.length} ממירים מכתובת ‎.${cfg.network.start}.`);
      a.ip = net.ip(net.base + off);
      a.mask = net.mask;
      a.gw = net.ip(net.base + 1);
      if (cfg.protocol === 'profinet') a.name = `vfd-${String(m.tag).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || i + 1}`;
      if (cfg.protocol === 'modbus_tcp') { a.unit = 1; a.port = 502; }
      if (cfg.protocol === 'bacnet_ip') { a.instance = sid * 1000 + i + 1; a.port = 47808; }
    } else if (proto.addr === 'slave' || proto.addr === 'mac') {
      const per = proto.maxNodes;
      a.segment = Math.floor(i / per) + 1;
      a.slave = (i % per) + 1;
      if (cfg.protocol === 'bacnet_mstp') { a.mac = a.slave; a.instance = sid * 1000 + i + 1; delete a.slave; }
      if (cfg.protocol === 'profibus') a.slave = (i % per) + 3; // 1–2 left for the master and an engineering PG
    } else if (proto.addr === 'node') {
      a.node = i + 2;
    } else if (proto.addr === 'position') {
      a.position = i + 1;
      a.station = 1001 + i;
    }

    const d = {
      i, tag: m.tag, name: m.name, app: m.app, appMeta: app, kw, V, hz, rpm, In: round(In, 1), eff, pf,
      driveKw, driveI: round(driveI, 1), duty: app.duty, brand, family: family.name, commOpt,
      Iin: round(Iin, 1), fuse, inCable, motorCable, cableM: L, lossW, accessories, addr: a,
      poles: Math.max(2, Math.round((120 * hz) / rpm / 2) * 2),
    };
    d.params = paramSheet(d, cfg);
    d.datamap = dataMap(d, cfg);
    return d;
  });

  // ---------- network
  const network = networkPlan(drives, cfg, net, warnings);

  // ---------- electrical totals & harmonics
  const totalKw = drives.reduce((s, d) => s + d.kw, 0);
  const totalKva = drives.reduce((s, d) => s + (d.kw / (d.eff * 0.97 * 0.95)), 0);
  const heatW = drives.reduce((s, d) => s + d.lossW, 0);
  const airflow = Math.round((3.1 * heatW) / 10); // m³/h for a 10 K rise
  const trafoNeed = TRAFO.find((t) => t >= totalKva * 1.25) || TRAFO[TRAFO.length - 1];
  const share = cfg.transformerKVA > 0 ? totalKva / cfg.transformerKVA : 0;
  const harmonics = {
    thdiNoChoke: 90, thdiChoke: 40, thdiAfe: 5,
    share: round(share * 100, 0),
    recommend: share > 0.3 ? 'active' : share > 0.15 ? 'choke' : 'ok',
  };
  if (cfg.transformerKVA > 0 && totalKva * 1.1 > cfg.transformerKVA) warnings.push(`עומס הממירים (${round(totalKva, 0)} kVA) קרוב לגודל השנאי (${cfg.transformerKVA} kVA) או מעליו. מומלץ שנאי של ${trafoNeed} kVA.`);
  if (harmonics.recommend === 'active') warnings.push(`הממירים הם ${harmonics.share}% מעומס השנאי. כדי לעמוד ב-IEEE 519 / IEC 61000-3-12 מומלץ מסנן הרמוניות אקטיבי או ממירים עם AFE.`);

  // ---------- energy
  const energy = drives.filter((d) => d.appMeta.energy).map((d) => energySaving(d, cfg));
  const saveKwh = energy.reduce((s, e) => s + e.saveKwh, 0);

  // ---------- BOM
  const bom = [];
  const add = (item, qty, note = '') => { const x = bom.find((b) => b.item === item); if (x) x.qty += qty; else bom.push({ item, qty, note }); };
  for (const d of drives) {
    add(`ממיר ${BRANDS[d.brand].he} ${d.family} · ${d.driveKw} kW ${d.duty === 'HD' ? '(עומס כבד)' : ''} ${d.V}V`.replace(/\s+/g, ' '), 1, d.duty === 'HD' ? 'דירוג 150% ל-60 שנ׳' : 'דירוג 110% ל-60 שנ׳');
    if (!/built-in/.test(d.commOpt)) add(`ממשק ${PROTOCOLS[cfg.protocol].he}: ${d.commOpt}`, 1, BRANDS[d.brand].he);
    add(`נתיכים ${d.fuse}A (gG, או aR לפי היצרן) / מפסק מגן מנוע`, 3, 'לכל פאזה');
    for (const ac of d.accessories) add(ac.he, 1, ac.why);
  }
  for (const n of network.devices.filter((x) => x.kind === 'switch')) add(n.model, 1, n.note);
  if (network.rs485) add('נגד סיום קו 120Ω', network.rs485.segments * 2, 'בשני קצות כל קו RS-485');
  add(`בקר ${PLCS[cfg.plc].he}`, 1, 'עם ממשק ' + PROTOCOLS[cfg.protocol].he);
  add('מסך HMI ‏10–15 אינץ׳', 1, '');
  add('כבל מנוע מסוכך סימטרי (VFD)', drives.reduce((s, d) => s + d.cableM, 0), 'מטר. הארקת הסיכוך ב-360° בשני הקצוות');

  const stats = {
    drives: drives.length, totalKw: round(totalKw, 1), totalKva: round(totalKva, 0), heatW, airflow, trafoNeed,
    saveKwh: Math.round(saveKwh), saveMoney: Math.round(saveKwh * cfg.kwhPrice), saveCo2: round((saveKwh * 0.47) / 1000, 1),
    brands: new Set(drives.map((d) => d.brand)).size,
  };
  if (cfg.environment === 'commercial') notes.push('סביבה ראשונה (מסחרית): מסנני EMC בקטגוריה C2 ותוואי כבלים נפרד לתקשורת.');
  notes.push('Safe Torque Off ‏(STO): מחברים את מעגל עצירת החירום לכניסות STO דרך ממסר בטיחות, לפי רמת ה-PL/SIL שמתקבלת מניתוח הסיכונים.');

  return { cfg, proto, drives, network, energy, bom, stats, harmonics, warnings, notes };
}

// ---------- parameter sheet
function paramSheet(d, cfg) {
  const app = d.appMeta;
  const proto = cfg.protocol;
  const b = d.brand;
  const map = PARAMS[b] || {};
  const rtu = PROTOCOLS[proto].medium === 'rs485';
  const fieldbusName = PROTOCOLS[proto].he;
  const ctrl = {
    quadratic: { generic: 'V/f ריבועי (עומס משתנה)', abb: 'Scalar (או DTC עם אופטימיזציית אנרגיה)', siemens: '2 = V/f ריבועי', danfoss: '1-01 = VVC+, ‏1-03 = Variable Torque', schneider: 'UFq (ריבועי)', yaskawa: '0 = V/f', delta: '0 = V/F', mitsubishi: 'V/F + אופטימום חיסכון (Pr.60)', rockwell: '2 = Economize', weg: 'V/f ריבועי' },
    vector: { generic: 'וקטורי ללא חיישן (SVC)', abb: 'DTC', siemens: '20 = בקרת מהירות ללא אנקודר', danfoss: '1-01 = VVC+ / Flux sensorless', schneider: 'Std / SVC', yaskawa: '2 = OLV', delta: '2 = SVC', mitsubishi: 'Advanced magnetic flux vector', rockwell: '1 = SVC', weg: 'וקטורי ללא חיישן' },
    vf: { generic: 'V/f ליניארי', abb: 'Scalar', siemens: '0 = V/f ליניארי', danfoss: '1-01 = U/f', schneider: 'UF5 / Std', yaskawa: '0 = V/f', delta: '0 = V/F', mitsubishi: 'V/F', rockwell: '0 = V/Hz', weg: 'V/f' },
  }[app.control];
  const src = {
    abb: rtu ? 'Embedded fieldbus' : 'Fieldbus A',
    siemens: rtu ? 'מאקרו Fieldbus (Modbus/USS)' : 'מאקרו 7 (Fieldbus)',
    danfoss: `8-01 = Digital and ctrl. word, 8-02 = ${rtu ? 'FC Port' : 'Option A'}`,
    schneider: rtu ? 'Mdb' : (proto === 'modbus_tcp' || proto === 'ethernetip' ? 'EtH (מובנה) / nEt (כרטיס)' : 'nEt'),
    yaskawa: rtu ? '2 = MEMOBUS' : '3 = כרטיס אופציה',
    delta: rtu ? 'פקודה 00-21 = 2, ייחוס 00-20 = 1 (RS-485)' : 'פקודה 00-21 = 5, ייחוס 00-20 = 8 (כרטיס)',
    rockwell: proto === 'ethernetip' ? 'P046 = 5, P047 = 15 (EtherNet/IP)' : 'P046 = 3, P047 = 3 (Serial/DSI)',
    mitsubishi: 'Pr.79 = 0 / 2 עם Pr.340 = 1 (התחלה במצב NET)',
    weg: rtu ? 'Serial' : 'Fieldbus (CO/DN/PB/ETH)',
  }[b] || `Fieldbus (${fieldbusName})`;
  const toRpm = (hz) => Math.round((hz * d.rpm) / d.hz);
  const fmt = cfg.network.rtuFormat;
  const a = d.addr;
  const addrVal = a.name ? `שם התקן: ${a.name}` : a.slave != null ? String(a.slave) : a.mac != null ? `MAC ${a.mac}` : a.node != null ? `Node ${a.node}` : a.position != null ? `מיקום ${a.position} (כתובת ${a.station})` : (a.unit != null ? `Unit ID ${a.unit}` : '—');
  const values = {
    motorV: `${d.V} V`, motorI: `${d.In} A`, motorKW: `${d.kw} kW`, motorHz: `${d.hz} Hz`, motorRPM: b === 'yaskawa' || b === 'mitsubishi' ? `${d.poles} קטבים (${d.rpm} rpm)` : `${d.rpm} rpm`,
    controlMode: ctrl[b] || ctrl.generic,
    autotune: app.control === 'vector' ? 'זיהוי סיבובי כשהמנוע מנותק מהעומס, אחרת זיהוי סטטי' : 'זיהוי סטטי (Standstill) לפני הפעלה ראשונה',
    accel: `${app.accel} s`, decel: `${app.decel} s`,
    fmin: b === 'siemens' ? `${toRpm(app.fmin)} rpm (${app.fmin} Hz)` : `${app.fmin} Hz`,
    fmax: b === 'siemens' ? `${toRpm(app.fmax)} rpm (${app.fmax} Hz)` : `${app.fmax} Hz`,
    cmdSource: src, refSource: src,
    commProto: fieldbusName,
    commAddr: addrVal,
    commBaud: rtu ? `${cfg.network.rtuBaud} bps` : PROTOCOLS[proto].medium === 'can' ? `${cfg.network.canBitrate} kbit/s` : '—',
    commParity: rtu ? fmt : '—',
    commIp: a.ip ? `${a.ip} / ${a.mask}, GW ${a.gw}` : '—',
    commTimeout: ['hoist', 'conveyor', 'extruder'].includes(d.app) ? 'תקלה ועצירה מיידית אחרי ‎0.5 s' : `תקלה ועצירה בשיפוע אחרי ‎${rtu ? 3 : 1} s`,
    flying: app.flying ? 'מופעל' : 'כבוי',
  };
  return PARAM_FUNCS.map(([k, he]) => ({ key: k, he, id: map[k] || '—', value: values[k] }));
}

// ---------- data map
function dataMap(d, cfg) {
  const p = PROTOCOLS[cfg.protocol].profile;
  if (p === 'profidrive') {
    return {
      title: 'PROFIdrive · Standard Telegram 1', unit: 'מילים (WORD)',
      out: [['STW1', 'מילת פיקוד', 'Word 0'], ['NSOLL_A', 'מהירות רצויה (0x4000 = 100%)', 'Word 1']],
      inp: [['ZSW1', 'מילת מצב', 'Word 0'], ['NIST_A', 'מהירות בפועל (0x4000 = 100%)', 'Word 1']],
      words: { ready: '0x047E', on: '0x047E', run: '0x047F', reset: '0x04FE' },
      bits: [['ZSW1.0', 'מוכן להפעלה'], ['ZSW1.1', 'מוכן לפעולה'], ['ZSW1.2', 'פעולה מאופשרת (רץ)'], ['ZSW1.3', 'תקלה'], ['ZSW1.7', 'אזהרה'], ['ZSW1.10', 'הגיע לייחוס']],
      runBit: 2, faultBit: 3, scale: 16384,
    };
  }
  if (p === 'odva') {
    return {
      title: 'ODVA AC Drive Profile · Assembly 21 / 71', unit: 'בתים',
      out: [['Byte 0', 'bit0 Run Fwd · bit1 Run Rev · bit2 Fault Reset · bit5 NetCtrl · bit6 NetRef', '21'], ['Bytes 2–3', 'מהירות רצויה (rpm)', '21']],
      inp: [['Byte 0', 'bit0 Faulted · bit1 Warning · bit2 Running Fwd · bit3 Running Rev · bit4 Ready · bit7 At Reference', '71'], ['Bytes 2–3', 'מהירות בפועל (rpm)', '71']],
      words: { ready: '0x60', on: '0x60', run: '0x61', reset: '0x64' },
      bits: [['bit0', 'תקלה'], ['bit2', 'רץ קדימה'], ['bit4', 'מוכן'], ['bit7', 'הגיע לייחוס']],
      runBit: 2, faultBit: 0, scale: 'rpm', rpi: '10–20 ms',
    };
  }
  if (p === 'cia402') {
    return {
      title: 'CiA 402 · מצב מהירות (vl)', unit: 'אובייקטים',
      out: [['0x6040', 'Controlword', 'RxPDO'], ['0x6042', 'vl target velocity (rpm)', 'RxPDO'], ['0x6060', 'Modes of operation = 2', 'SDO']],
      inp: [['0x6041', 'Statusword', 'TxPDO'], ['0x6044', 'vl velocity actual value (rpm)', 'TxPDO']],
      words: { ready: '0x0006', on: '0x0007', run: '0x000F', reset: '0x0080' },
      bits: [['bit0', 'מוכן להפעלה'], ['bit1', 'מופעל'], ['bit2', 'פעולה מאופשרת'], ['bit3', 'תקלה'], ['bit7', 'אזהרה'], ['bit10', 'הגיע ליעד']],
      runBit: 2, faultBit: 3, scale: 'rpm',
    };
  }
  if (p === 'bacnet') {
    return {
      title: 'BACnet · אובייקטים (שמות לפי ה-PICS של היצרן)', unit: 'אובייקטים',
      out: [['BV / BO', 'פקודת הפעלה / עצירה', 'Write'], ['AV', 'ייחוס מהירות (%)', 'Write'], ['BV', 'איפוס תקלה', 'Write']],
      inp: [['BI', 'מצב ריצה', 'COV'], ['BI', 'תקלה', 'COV'], ['AI', 'תדר מוצא (Hz)', 'COV'], ['AI', 'זרם מנוע (A)', 'COV'], ['AI', 'הספק (kW)', 'COV']],
      words: { ready: 'Inactive', on: 'Inactive', run: 'Active', reset: 'Active' }, bits: [], runBit: null, faultBit: null, scale: '%',
    };
  }
  const m = MODBUS_MAPS[d.brand];
  if (m) {
    const hex = (x) => (x > 9999 && x < 100000 ? String(x) : x >= 0x1000 ? `0x${x.toString(16).toUpperCase()} (${x})` : String(x));
    return {
      title: `Modbus · ${m.profile}`, unit: 'Holding registers',
      out: [[hex(m.cw), 'מילת פיקוד', 'Write'], [hex(m.ref), `ייחוס מהירות (${m.scale})`, 'Write']],
      inp: [[hex(m.sw), 'מילת מצב', 'Read'], [hex(m.act), 'מהירות / תדר בפועל', 'Read']],
      words: m.words, bits: [], runBit: null, faultBit: null, scale: m.scale, regs: m,
    };
  }
  return {
    title: 'Modbus · מפת רגיסטרים של היצרן', unit: 'Holding registers',
    out: [['לפי המדריך', 'מילת פיקוד', 'Write'], ['לפי המדריך', 'ייחוס מהירות', 'Write']],
    inp: [['לפי המדריך', 'מילת מצב', 'Read'], ['לפי המדריך', 'תדר / מהירות בפועל', 'Read'], ['לפי המדריך', 'זרם, הספק, קוד תקלה', 'Read']],
    words: { ready: 'לפי המדריך', on: 'לפי המדריך', run: 'לפי המדריך', reset: 'לפי המדריך' }, bits: [], runBit: null, faultBit: null, scale: 'לפי המדריך',
    generic: true,
  };
}

// ---------- network plan & timing
function networkPlan(drives, cfg, net, warnings) {
  const proto = PROTOCOLS[cfg.protocol];
  const devices = [];
  const n = drives.length;
  let cycleMs = 0;
  let load = null;
  let rs485 = null;
  const eth = proto.medium === 'ethernet';
  const plcIp = net.ip(net.base + 10);
  if (eth || cfg.protocol === 'bacnet_mstp' || cfg.protocol === 'modbus_rtu') {
    devices.push({ kind: 'plc', name: 'PLC', ip: plcIp, note: PLCS[cfg.plc].he });
    devices.push({ kind: 'hmi', name: 'HMI', ip: net.ip(net.base + 11), note: 'מסך הפעלה' });
    devices.push({ kind: 'eng', name: 'מחשב הנדסי', ip: net.ip(net.base + 100), note: 'תכנות ואבחון' });
  } else {
    devices.push({ kind: 'plc', name: 'PLC', ip: '—', note: `${PLCS[cfg.plc].he} · Master` });
  }
  if (eth) {
    const ring = cfg.redundancy && proto.topology !== 'line';
    const perSwitch = 6;
    const sw = Math.max(1, Math.ceil((n + 2) / perSwitch));
    for (let i = 0; i < sw; i++) {
      devices.push({ kind: 'switch', name: `SW-${i + 1}`, ip: net.ip(net.base + 2 + i), model: `מתג תעשייתי מנוהל 8 פורטים${cfg.protocol === 'profinet' ? ' עם PROFINET ו-MRP' : cfg.protocol === 'ethernetip' ? ' עם IGMP Snooping ו-DLR/ring' : ''}`, note: ring ? 'טבעת' : 'כוכב' });
    }
    if (cfg.protocol === 'ethercat') { devices.splice(devices.findIndex((x) => x.kind === 'switch'), sw); }
    cycleMs = { modbus_tcp: Math.max(20, n * 4), profinet: 4, ethernetip: 10, ethercat: 1, bacnet_ip: 1000 }[cfg.protocol];
    if (cfg.protocol === 'modbus_tcp') load = { text: `סריקה של כ-${cycleMs} ms לכל הממירים (בקשה לכל ממיר בכל מחזור)` };
    if (cfg.protocol === 'profinet') load = { text: `זמן עדכון 4 ms (RT, קבוצה 1). ${ring ? 'טבעת MRP עם התאוששות של עד 200 ms.' : ''}` };
    if (cfg.protocol === 'ethernetip') load = { text: `RPI של 10 ms לכל ממיר, ‏${n * 2} חיבורי CIP Class 1${n * 2 > 128 ? ' (מעל 128, נדרש בקר גדול יותר)' : ''}` };
    if (cfg.protocol === 'ethercat') load = { text: `מחזור 1 ms, טופולוגיית קו: Master ← ממיר 1 ← … ← ממיר ${n}` };
    if (cfg.protocol === 'bacnet_ip') load = { text: 'COV או סריקה כל 1 s ממערכת ה-BMS. יש לוודא מספר מופע (Device Instance) ייחודי באתר.' };
    if (n > 50 && cfg.protocol === 'profinet' && ring) warnings.push('בטבעת MRP אחת מומלצים עד 50 התקנים. כדאי לפצל לכמה טבעות.');
  } else if (proto.medium === 'rs485') {
    const segments = Math.ceil(n / proto.maxNodes);
    const baud = cfg.protocol === 'profibus' ? 1500000 : +cfg.network.rtuBaud;
    rs485 = { segments, baud, lengthM: baud > 500000 ? 200 : baud > 100000 ? 400 : 1200 };
    if (cfg.protocol === 'profibus') {
      cycleMs = Math.max(2, Math.round(n * 0.25 * 10) / 10 + 1);
      load = { text: `‎1.5 Mbit/s, מחזור משוער ‎${cycleMs} ms, עד ${rs485.lengthM} מ׳ לסגמנט` };
    } else {
      const charT = 11 / baud;
      const perDrive = (13 + 8 + 8 + 9) * charT + 4 * 3.5 * charT + 2 * 0.006; // write 2 + read 2 registers, gaps, turnaround
      cycleMs = Math.round((n / segments) * perDrive * 1000);
      load = { text: `מחזור משוער ${cycleMs} ms ל-${Math.ceil(n / segments)} ממירים בקו (כתיבת 2 רגיסטרים וקריאת 2 רגיסטרים לכל ממיר)` };
      if (cycleMs > 300) warnings.push(`מחזור Modbus RTU של ${cycleMs} ms איטי. כדאי להעלות קצב ל-38400/115200, לפצל לקווים נוספים או לעבור ל-Modbus TCP.`);
    }
    if (segments > 1) warnings.push(`${n} ממירים: נדרשים ${segments} קווי RS-485 (עד 31 ממירים לקו, בלי Repeater).`);
  } else if (proto.medium === 'can') {
    const br = +cfg.network.canBitrate;
    const lengthM = { 1000: 25, 500: 100, 250: 250, 125: 500, 50: 1000 }[br] || 100;
    const bits = n * 2 * 111;
    const loadPct = Math.round((bits / (br * 1000 * 0.01)) * 100);
    cycleMs = 10;
    load = { text: `עומס אפיק משוער ${loadPct}% במחזור של 10 ms (2 PDO לכל ממיר), עד ${lengthM} מ׳ ב-${br} kbit/s` };
    if (loadPct > 60) warnings.push(`עומס אפיק CANopen של ${loadPct}%. כדאי להאריך את מחזור ה-SYNC, לעבור לקצב גבוה יותר או לפצל את האפיק.`);
  }
  return { devices, cycleMs, load, rs485, plcIp };
}

// ---------- energy (variable-torque loads)
export function energySaving(d, cfg) {
  const profile = [[1.0, 0.1], [0.9, 0.2], [0.8, 0.3], [0.7, 0.25], [0.6, 0.15]];
  const P = d.kw * 0.85 / d.eff; // electrical input at full flow, load factor 0.85
  const hours = +cfg.hours;
  const stat = d.app === 'pump' ? 0.2 : 0;
  let throttle = 0;
  let vfd = 0;
  for (const [q, share] of profile) {
    const h = hours * share;
    throttle += h * P * (d.app === 'fan' ? 0.6 + 0.4 * q : d.app === 'compressor' ? 0.75 + 0.25 * q : 0.55 + 0.45 * q);
    const speedPower = d.app === 'compressor' ? q : stat * q + (1 - stat) * q ** 3;
    vfd += (h * P * speedPower) / 0.97;
  }
  return { tag: d.tag, name: d.name, kw: d.kw, throttle: Math.round(throttle), vfd: Math.round(vfd), saveKwh: Math.round(throttle - vfd), saveMoney: Math.round((throttle - vfd) * cfg.kwhPrice), pct: Math.round((1 - vfd / throttle) * 100) };
}
