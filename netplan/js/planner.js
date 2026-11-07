// Network planning engine: turns a building description into a full plan
// (VLANs, subnets, per-room addresses, cabinets, switches, ports, PoE, uplinks, BOM).
// Pure functions only, so it runs both in the browser and under node --test.

import {
  ipToInt, parseCidr, intToIp, prefixForHosts, subnetInfo, maskOf, usable,
  ulaFromSeed, parseV6_48, v6Subnet,
} from './ip.js';

export const PROFILES = {
  office: {
    label: 'משרדים', mode: 'floor',
    perRoom: { data: 2, voice: 1, iptv: 0, iot: 0 },
    wifiPerRoom: 4, guestPerRoom: 1, apPerRooms: 3, camerasPerFloor: 4, printersPerFloor: 2,
  },
  hotel: {
    label: 'מלון', mode: 'room',
    perRoom: { data: 1, voice: 1, iptv: 1, iot: 1 },
    wifiPerRoom: 0, guestPerRoom: 4, apPerRooms: 2, camerasPerFloor: 6, printersPerFloor: 0,
  },
  hospital: {
    label: 'בית חולים / מרפאה', mode: 'floor',
    perRoom: { data: 2, voice: 1, iptv: 1, iot: 2 },
    wifiPerRoom: 4, guestPerRoom: 2, apPerRooms: 2, camerasPerFloor: 6, printersPerFloor: 2,
  },
  school: {
    label: 'מוסד חינוך', mode: 'floor',
    perRoom: { data: 1, voice: 1, iptv: 1, iot: 1 },
    wifiPerRoom: 32, guestPerRoom: 0, apPerRooms: 1, camerasPerFloor: 4, printersPerFloor: 1,
  },
  residential: {
    label: 'מגורים / מעונות', mode: 'room',
    perRoom: { data: 1, voice: 0, iptv: 1, iot: 2 },
    wifiPerRoom: 0, guestPerRoom: 6, apPerRooms: 1, camerasPerFloor: 2, printersPerFloor: 0,
  },
};

export const WIFI_GENS = {
  wifi6: { label: 'Wi-Fi 6 (802.11ax)', poeW: 25.5, poeClass: 4, reserveW: 30, busyMbps: 120, port: '1G / 2.5G' },
  wifi6e: { label: 'Wi-Fi 6E (6GHz)', poeW: 30, poeClass: 5, reserveW: 45, busyMbps: 180, port: '2.5G mGig' },
  wifi7: { label: 'Wi-Fi 7 (802.11be)', poeW: 38, poeClass: 6, reserveW: 60, busyMbps: 250, port: '5G/10G mGig' },
};

// Devices: PoE draw (W), PoE class budget the switch reserves (W), busy-hour throughput (Mbps).
export const DEVICES = {
  data: { he: 'מחשב / נקודת רשת', poeW: 0, reserveW: 0, busyMbps: 25 },
  voice: { he: 'טלפון IP', poeW: 5.5, reserveW: 7, busyMbps: 0.1 },
  iptv: { he: 'טלוויזיה / IPTV', poeW: 0, reserveW: 0, busyMbps: 8 },
  iot: { he: 'בקר / IoT', poeW: 3, reserveW: 4, busyMbps: 0.5 },
  cam: { he: 'מצלמת IP', poeW: 9, reserveW: 15.4, busyMbps: 8 },
  print: { he: 'מדפסת', poeW: 0, reserveW: 0, busyMbps: 2 },
};

export const SERVICES = {
  data: { name: 'DATA', he: 'נתונים — מחשבים קוויים', scope: 'floor' },
  voice: { name: 'VOICE', he: 'טלפוניה IP', scope: 'floor' },
  room: { name: 'ROOM', he: 'רשת פרטית לחדר', scope: 'room' },
  wifi: { name: 'WIFI', he: 'Wi-Fi ארגוני', scope: 'building', k: 10 },
  guest: { name: 'GUEST', he: 'Wi-Fi אורחים (מבודד)', scope: 'building', k: 20 },
  cctv: { name: 'CCTV', he: 'מצלמות אבטחה', scope: 'building', k: 30 },
  iot: { name: 'IOT', he: 'IoT · IPTV · בקרת מבנה', scope: 'building', k: 40 },
  print: { name: 'PRINT', he: 'מדפסות', scope: 'building', k: 50 },
  mgmt: { name: 'MGMT', he: 'ניהול ציוד רשת ונקודות גישה', scope: 'building', k: 99 },
  servers: { name: 'SERVERS', he: 'שרתים ושירותי ליבה', scope: 'site', vlan: 10 },
  transit: { name: 'FW-TRANSIT', he: 'מעבר ליבה ↔ חומת אש', scope: 'site', vlan: 900 },
  p2p: { name: 'P2P', he: 'קישורי ניתוב ליבה ↔ הפצה', scope: 'site' },
  loop: { name: 'LOOPBACK', he: 'כתובות Loopback לנתבים', scope: 'site' },
};

export const UPLINKS = {
  10: { label: '10G SFP+', optic: 'SFP-10G-LR', cisco: 'Te' },
  25: { label: '25G SFP28', optic: 'SFP-25G-LR', cisco: 'Twe' },
  40: { label: '40G QSFP+', optic: 'QSFP-40G-LR4', cisco: 'Fo' },
  100: { label: '100G QSFP28', optic: 'QSFP-100G-LR4', cisco: 'Hu' },
};

const RACK_SIZES = [9, 12, 15, 18, 22, 27, 32, 37, 42, 47];

export function defaultConfig() {
  const p = PROFILES.office;
  return {
    version: 1,
    site: { name: 'מגדל הייטק', code: 'HQ', domain: 'corp.local' },
    buildings: [{ name: 'בניין A', code: 'A', floors: 6, firstFloor: 1, roomsPerFloor: 35 }],
    profile: 'office',
    perRoom: { ...p.perRoom },
    wifiPerRoom: p.wifiPerRoom,
    guestPerRoom: p.guestPerRoom,
    apPerRooms: p.apPerRooms,
    camerasPerFloor: p.camerasPerFloor,
    printersPerFloor: p.printersPerFloor,
    wifiGen: 'wifi7',
    phonePassthrough: false,
    roomsPerIdf: 40,
    switchPorts: 48,
    sparePortsPct: 20,
    growthPct: 30,
    uplinkGbps: 10,
    redundancy: true,
    avgCableM: 40,
    wanMbps: 5000,
    isps: 2,
    vendor: 'cisco',
    addressing: { base: '10.0.0.0/8', mode: p.mode, roomPrefix: 28, ipv6: true, ipv6Prefix: '' },
  };
}

export function applyProfile(cfg, key) {
  const p = PROFILES[key];
  if (!p) return cfg;
  return {
    ...cfg,
    profile: key,
    perRoom: { ...p.perRoom },
    wifiPerRoom: p.wifiPerRoom,
    guestPerRoom: p.guestPerRoom,
    apPerRooms: p.apPerRooms,
    camerasPerFloor: p.camerasPerFloor,
    printersPerFloor: p.printersPerFloor,
    addressing: { ...cfg.addressing, mode: p.mode },
  };
}

const pad = (n, w = 2) => String(n).padStart(w, '0');
const int = (v, d = 0) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : d);
const nextPow2 = (n) => 2 ** Math.ceil(Math.log2(Math.max(1, n)));

export function floorLabel(n) {
  return n < 0 ? `B${-n}` : String(n);
}

export function roomNumber(floorNo, idx, roomsPerFloor) {
  return `${floorLabel(floorNo)}${pad(idx + 1, roomsPerFloor > 99 ? 3 : 2)}`;
}

function validate(cfg) {
  const errs = [];
  if (!cfg.buildings?.length) errs.push('יש להגדיר לפחות מבנה אחד.');
  if (cfg.buildings.length > 9) errs.push('המערכת תומכת עד 9 מבנים באתר (מגבלת תכנון ה-VLAN).');
  const codes = new Set();
  cfg.buildings.forEach((b, i) => {
    const name = b.name || `מבנה ${i + 1}`;
    if (!(int(b.floors) >= 1 && int(b.floors) <= 99)) errs.push(`${name}: מספר הקומות חייב להיות בין 1 ל-99.`);
    if (!(int(b.roomsPerFloor) >= 1 && int(b.roomsPerFloor) <= 999)) errs.push(`${name}: מספר החדרים בקומה חייב להיות בין 1 ל-999.`);
    if (!(int(b.firstFloor) >= -9 && int(b.firstFloor) <= 89)) errs.push(`${name}: הקומה הראשונה חייבת להיות בין ‎-9 ל-89.`);
    else if (int(b.firstFloor) + int(b.floors) - 1 > 89) errs.push(`${name}: הקומה העליונה חייבת להיות עד 89 (מגבלת מספור ה-VLAN).`);
    const code = String(b.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{1,3}$/.test(code)) errs.push(`${name}: קוד מבנה חייב להיות 1–3 אותיות/ספרות באנגלית (למשל A).`);
    if (codes.has(code)) errs.push(`קוד המבנה ${code} מופיע פעמיים.`);
    codes.add(code);
  });
  if (!(int(cfg.roomsPerIdf) >= 1)) errs.push('מספר החדרים לארון תקשורת חייב להיות לפחות 1.');
  if (![24, 48].includes(int(cfg.switchPorts))) errs.push('גודל מתג חייב להיות 24 או 48 פורטים.');
  if (!UPLINKS[int(cfg.uplinkGbps)]) errs.push('מהירות Uplink לא נתמכת.');
  for (const k of ['data', 'voice', 'iptv', 'iot']) {
    const v = int(cfg.perRoom?.[k]);
    if (!(v >= 0 && v <= 12)) errs.push(`מספר הנקודות מסוג ${DEVICES[k].he} בחדר חייב להיות בין 0 ל-12.`);
  }
  if (int(cfg.perRoom?.data) + int(cfg.perRoom?.voice) + int(cfg.perRoom?.iptv) + int(cfg.perRoom?.iot) < 1
    && !(int(cfg.apPerRooms) > 0)) errs.push('יש להגדיר לפחות נקודת רשת אחת בחדר או נקודות גישה אלחוטיות.');
  if (errs.length) {
    const e = new Error(errs.join('\n'));
    e.list = errs;
    throw e;
  }
}

// Allocates power-of-two blocks (largest first) sequentially from `start`.
function vlsm(start, items) {
  const order = items.map((it, i) => ({ it, i })).sort((a, b) => (b.it.size - a.it.size) || (a.i - b.i));
  let cur = start;
  for (const { it } of order) {
    cur = Math.ceil(cur / it.size) * it.size;
    it.network = cur;
    cur += it.size;
  }
  return cur - start;
}

export function buildPlan(rawCfg) {
  const cfg = JSON.parse(JSON.stringify(rawCfg));
  validate(cfg);

  const growth = Math.max(0, int(cfg.growthPct)) / 100;
  const spare = Math.max(0, int(cfg.sparePortsPct)) / 100;
  const per = {
    data: int(cfg.perRoom.data), voice: int(cfg.perRoom.voice),
    iptv: int(cfg.perRoom.iptv), iot: int(cfg.perRoom.iot),
  };
  const mode = cfg.addressing.mode === 'room' ? 'room' : 'floor';
  const redundancy = !!cfg.redundancy;
  const wifi = WIFI_GENS[cfg.wifiGen] || WIFI_GENS.wifi6;
  const uplinkGbps = int(cfg.uplinkGbps, 10);
  const switchPorts = int(cfg.switchPorts, 48);
  const roomsPerIdf = int(cfg.roomsPerIdf, 40);
  const passthrough = !!cfg.phonePassthrough && per.voice > 0 && per.data > 0;
  const multiBuilding = cfg.buildings.length > 1;
  const warnings = [];
  const notes = [];

  const base = parseCidr(cfg.addressing.base);
  const sized = (fixed, variable) => prefixForHosts(fixed + Math.ceil(variable * (1 + growth)));

  // ---------- 1. physical skeleton: buildings → floors → IDFs → rooms ----------
  const buildings = cfg.buildings.map((b, bi) => {
    const code = String(b.code).trim().toUpperCase();
    const floorsN = int(b.floors);
    const rpf = int(b.roomsPerFloor);
    const floors = [];
    let gidx = 0;
    for (let f = 0; f < floorsN; f++) {
      const floorNo = int(b.firstFloor) + f;
      const nIdf = Math.ceil(rpf / roomsPerIdf);
      const baseCount = Math.floor(rpf / nIdf);
      const extra = rpf % nIdf;
      const rooms = [];
      const idfs = [];
      let r = 0;
      for (let k = 0; k < nIdf; k++) {
        const count = baseCount + (k < extra ? 1 : 0);
        const idf = {
          id: `IDF-${code}-${pad(floorLabel(floorNo))}-${k + 1}`,
          host: `SW-${code}-${pad(floorLabel(floorNo))}-${k + 1}`,
          building: bi, floor: f, floorNo, index: k,
          rooms: [], outlets: [], aps: [], cams: [], printers: [],
        };
        for (let c = 0; c < count; c++, r++, gidx++) {
          const no = roomNumber(floorNo, r, rpf);
          const room = {
            id: `${code}-${no}`, no, building: bi, bCode: code, floor: f, floorNo,
            idx: r, gidx, idf: idf.id, outlets: [],
          };
          rooms.push(room);
          idf.rooms.push(room);
        }
        idfs.push(idf);
      }
      floors.push({ index: f, floorNo, label: floorLabel(floorNo), rooms, idfs });
    }
    return {
      index: bi, code, name: b.name || `מבנה ${code}`,
      floors, roomCount: floorsN * rpf, roomsPerFloor: rpf,
    };
  });

  // Place APs, cameras and printers on each floor, spread over its IDFs.
  for (const b of buildings) {
    for (const fl of b.floors) {
      const nRooms = fl.rooms.length;
      const apN = int(cfg.apPerRooms) > 0 ? Math.ceil(nRooms / int(cfg.apPerRooms)) : 0;
      for (let i = 0; i < apN; i++) {
        const room = fl.rooms[Math.min(nRooms - 1, Math.floor((i + 0.5) * nRooms / apN))];
        const idf = fl.idfs.find((x) => x.id === room.idf);
        idf.aps.push({ label: `${b.code}${pad(fl.label)}-AP${pad(i + 1)}`, near: room.no });
      }
      for (let i = 0; i < int(cfg.camerasPerFloor); i++) {
        fl.idfs[i % fl.idfs.length].cams.push({ label: `${b.code}${pad(fl.label)}-CAM${pad(i + 1)}` });
      }
      for (let i = 0; i < int(cfg.printersPerFloor); i++) {
        fl.idfs[i % fl.idfs.length].printers.push({ label: `${b.code}${pad(fl.label)}-PRN${pad(i + 1)}` });
      }
    }
  }

  // ---------- 2. VLANs and subnet sizing ----------
  const subnets = [];
  const addSubnet = (s) => { subnets.push(s); return s; };

  const site = {
    servers: addSubnet({ key: 'servers', scope: 'site', vlan: 10, name: 'SERVERS', prefix: 24, purpose: SERVICES.servers.he }),
    transit: addSubnet({ key: 'transit', scope: 'site', vlan: 900, name: 'FW-TRANSIT', prefix: 29, purpose: SERVICES.transit.he }),
  };
  if (multiBuilding) {
    const links = buildings.length * (redundancy ? 4 : 1);
    site.p2p = addSubnet({ key: 'p2p', scope: 'site', vlan: null, name: 'P2P-LINKS', prefix: Math.min(29, 32 - Math.log2(nextPow2(links * 2))), purpose: SERVICES.p2p.he });
    site.loop = addSubnet({ key: 'loop', scope: 'site', vlan: null, name: 'LOOPBACKS', prefix: 27, purpose: SERVICES.loop.he });
  }

  for (const b of buildings) {
    const B = b.index;
    b.subnets = [];
    const own = (s) => { b.subnets.push(s); return addSubnet({ building: B, ...s }); };
    const totalRooms = b.roomCount;
    for (const fl of b.floors) {
      const n = fl.rooms.length;
      const F = fl.index;
      const vf = fl.floorNo >= 0 ? fl.floorNo : 90 - fl.floorNo; // basement B1 -> 91
      if (mode === 'floor' && per.data > 0) {
        fl.data = own({ key: 'data', scope: 'floor', floor: F, vlan: 1000 + B * 100 + vf, name: `DATA-${b.code}${pad(fl.label)}`, prefix: sized(10, n * per.data), purpose: `${SERVICES.data.he} · קומה ${fl.label}` });
      }
      if (per.voice > 0) {
        fl.voice = own({ key: 'voice', scope: 'floor', floor: F, vlan: 2000 + B * 100 + vf, name: `VOICE-${b.code}${pad(fl.label)}`, prefix: sized(10, n * per.voice), purpose: `${SERVICES.voice.he} · קומה ${fl.label}` });
      }
    }
    if (mode === 'room') {
      const roomHosts = per.data + per.iptv + per.iot;
      const need = prefixForHosts(2 + Math.ceil(Math.max(1, roomHosts) * (1 + growth)) + 4);
      const prefix = Math.min(int(cfg.addressing.roomPrefix, 28), need);
      for (const fl of b.floors) {
        for (const room of fl.rooms) {
          room.subnet = own({ key: 'room', scope: 'room', floor: fl.index, room: room.id, vlan: null, name: `ROOM-${room.id}`, prefix, purpose: `${SERVICES.room.he} ${room.no}` });
        }
      }
    }
    const aps = b.floors.reduce((s, fl) => s + fl.idfs.reduce((t, x) => t + x.aps.length, 0), 0);
    const cams = b.floors.reduce((s, fl) => s + fl.idfs.reduce((t, x) => t + x.cams.length, 0), 0);
    const prns = b.floors.reduce((s, fl) => s + fl.idfs.reduce((t, x) => t + x.printers.length, 0), 0);
    const idfN = b.floors.reduce((s, fl) => s + fl.idfs.length, 0);
    const bv = (k) => 3000 + B * 100 + SERVICES[k].k;
    if (aps > 0 && int(cfg.wifiPerRoom) > 0) {
      b.wifi = own({ key: 'wifi', scope: 'building', vlan: bv('wifi'), name: `WIFI-${b.code}`, prefix: sized(10, totalRooms * int(cfg.wifiPerRoom)), purpose: SERVICES.wifi.he });
    }
    if (aps > 0 && int(cfg.guestPerRoom) > 0) {
      b.guest = own({ key: 'guest', scope: 'building', vlan: bv('guest'), name: `GUEST-${b.code}`, prefix: sized(10, totalRooms * int(cfg.guestPerRoom)), purpose: SERVICES.guest.he });
    }
    if (cams > 0) b.cctv = own({ key: 'cctv', scope: 'building', vlan: bv('cctv'), name: `CCTV-${b.code}`, prefix: sized(10, cams), purpose: SERVICES.cctv.he });
    if (mode === 'floor' && per.iot + per.iptv > 0) {
      b.iot = own({ key: 'iot', scope: 'building', vlan: bv('iot'), name: `IOT-${b.code}`, prefix: sized(10, totalRooms * (per.iot + per.iptv)), purpose: SERVICES.iot.he });
    }
    if (prns > 0) b.print = own({ key: 'print', scope: 'building', vlan: bv('print'), name: `PRINT-${b.code}`, prefix: sized(10, prns), purpose: SERVICES.print.he });
    // Switch count is not known yet; size management for a generous stack estimate.
    const estStacks = idfN * 2;
    b.mgmt = own({ key: 'mgmt', scope: 'building', vlan: bv('mgmt'), name: `MGMT-${b.code}`, prefix: sized(40, estStacks + idfN + aps), purpose: SERVICES.mgmt.he });
  }

  // Room VLAN IDs (room mode): 1000.. so they never clash with building VLANs (3000+) or voice (2000+).
  if (mode === 'room') {
    let v = 1000;
    for (const s of subnets.filter((x) => x.key === 'room')) {
      if (v > 1999) { throw new Error('מצב "רשת לכל חדר" תומך עד 1000 חדרים באתר. עברו למצב "רשת לכל קומה" או פצלו את האתר.'); }
      s.vlan = v++;
    }
  }

  // ---------- 3. address allocation ----------
  for (const s of subnets) s.size = 2 ** (32 - s.prefix);
  const siteItems = subnets.filter((s) => s.scope === 'site');
  const blocks = [{ key: 'site', items: siteItems, building: null }];
  for (const b of buildings) blocks.push({ key: `b${b.index}`, items: subnets.filter((s) => s.building === b.index), building: b.index });
  for (const blk of blocks) {
    blk.used = vlsm(0, blk.items);
    blk.size = nextPow2(blk.used);
    blk.prefix = 32 - Math.log2(blk.size);
  }
  const SLASH16 = 65536;
  const readable = base.prefix <= 16 && blocks.every((x) => x.size <= SLASH16) && blocks.length * SLASH16 <= base.size;
  if (readable) {
    blocks.forEach((blk, i) => { blk.network = base.network + i * SLASH16; blk.prefix = Math.min(blk.prefix, 16); });
  } else {
    const total = vlsm(base.network, blocks);
    if (total > base.size) {
      throw new Error(`טווח הכתובות ${cfg.addressing.base} קטן מדי לתכנית: נדרשות ${total.toLocaleString('he-IL')} כתובות. בחרו טווח גדול יותר (למשל 10.0.0.0/8).`);
    }
  }
  for (const blk of blocks) {
    for (const s of blk.items) s.network += blk.network;
    blk.cidr = `${intToIp(blk.network)}/${readable ? 16 : blk.prefix}`;
  }
  if (!readable) notes.push('הכתובות הוקצו ברצף (VLSM) כי הטווח שנבחר קטן מ-‎/16 לכל מבנה.');

  // IPv6: one /64 per VLAN under the site /48. Subnet ID = VLAN ID in hex-readable decimal.
  let v6head = null;
  if (cfg.addressing.ipv6) {
    const pfx = cfg.addressing.ipv6Prefix?.trim() || ulaFromSeed(`${cfg.site.name}|${cfg.site.code}`);
    v6head = parseV6_48(pfx);
    cfg.addressing.ipv6Effective = pfx;
  }

  const gwOffset = redundancy ? { vip: 1, a: 2, b: 3 } : { vip: 1 };
  for (const s of subnets) {
    s.base = s.network; // numeric; subnetInfo() replaces .network with its dotted string
    Object.assign(s, subnetInfo(s.base, s.prefix));
    s.gateway = s.prefix <= 30 && s.key !== 'p2p' && s.key !== 'loop' ? intToIp(s.base + 1) : null;
    s.gwA = redundancy && s.prefix <= 29 && s.gateway ? intToIp(s.base + gwOffset.a) : null;
    s.gwB = redundancy && s.prefix <= 29 && s.gateway ? intToIp(s.base + gwOffset.b) : null;
    s.reserved = 0;
    s.ipv6 = v6head && s.vlan ? v6Subnet(v6head, s.vlan) : null;
    s.dhcp = !['servers', 'transit', 'p2p', 'loop', 'mgmt'].includes(s.key);
  }

  const at = (s, off) => intToIp(s.base + off);
  const claim = (s, off) => {
    if (off > s.usable) throw new Error(`הרשת ${s.name} (${s.cidr}) מלאה — הגדילו את אחוז הצמיחה או את הטווח.`);
    s.reserved = Math.max(s.reserved, off);
    return at(s, off);
  };

  // Site services in the servers VLAN.
  const srv = site.servers;
  const services = {
    dns1: claim(srv, 10), dns2: claim(srv, 11), dhcp1: at(srv, 10), dhcp2: at(srv, 11),
    ntp: claim(srv, 12), nms: claim(srv, 20), syslog: at(srv, 20), radius: claim(srv, 21),
    nvr: claim(srv, 30), wlc: claim(srv, 31), pbx: claim(srv, 40),
  };

  // ---------- 4. per-IDF outlets, switch ports, endpoint addresses ----------
  const idfList = [];
  for (const b of buildings) {
    let mgmtOff = 10;
    let iotOff = 10;
    let camOff = 10;
    let prnOff = 10;
    const mgmtIps = [];
    for (const fl of b.floors) {
      let dataOff = 10;
      let voiceOff = 10;
      for (const idf of fl.idfs) {
        const outlets = [];
        for (const room of idf.rooms) {
          const net = room.subnet;
          let roomOff = 2;
          if (net) {
            net.gateway = at(net, 1);
            net.gwA = null; net.gwB = null;
          }
          const mk = (type, n, extra) => {
            const o = { label: `${room.id}-${type === 'data' ? 'D' : type === 'voice' ? 'V' : type === 'iptv' ? 'T' : 'X'}${n}`, type, room: room.id, roomNo: room.no, ...extra };
            outlets.push(o);
            room.outlets.push(o);
            return o;
          };
          for (let i = 1; i <= per.data; i++) {
            const o = net
              ? mk('data', i, { subnet: net, ip: claim(net, roomOff++) })
              : mk('data', i, { subnet: fl.data, ip: claim(fl.data, dataOff++) });
            if (passthrough && i === 1) {
              for (let v = 1; v <= per.voice; v++) {
                o.phoneIp = claim(fl.voice, voiceOff++);
                o.phoneSubnet = fl.voice;
                o.hasPhone = true;
              }
            }
          }
          if (!passthrough) {
            for (let i = 1; i <= per.voice; i++) mk('voice', i, { subnet: fl.voice, ip: claim(fl.voice, voiceOff++), dataVlan: net ? net.vlan : fl.data?.vlan ?? null });
          }
          for (let i = 1; i <= per.iptv; i++) {
            mk('iptv', i, net ? { subnet: net, ip: claim(net, roomOff++) } : { subnet: b.iot, ip: claim(b.iot, iotOff++) });
          }
          for (let i = 1; i <= per.iot; i++) {
            mk('iot', i, net ? { subnet: net, ip: claim(net, roomOff++) } : { subnet: b.iot, ip: claim(b.iot, iotOff++) });
          }
          if (net) {
            net.poolStart = at(net, roomOff);
            net.poolEnd = net.last;
          }
        }
        for (const ap of idf.aps) {
          ap.type = 'ap';
          ap.subnet = b.mgmt;
          ap.ip = null; // filled after switches get their management IPs
          outlets.push(ap);
        }
        for (const c of idf.cams) {
          c.type = 'cam';
          c.subnet = b.cctv;
          c.ip = claim(b.cctv, camOff++);
          outlets.push(c);
        }
        for (const p of idf.printers) {
          p.type = 'print';
          p.subnet = b.print;
          p.ip = claim(b.print, prnOff++);
          outlets.push(p);
        }

        // Switches: enough ports for outlets plus spare, spread evenly across a stack.
        const need = Math.ceil(outlets.length * (1 + spare));
        const members = Math.max(1, Math.ceil(need / switchPorts));
        const perMember = Math.ceil(outlets.length / members);
        outlets.forEach((o, i) => {
          o.member = Math.floor(i / perMember) + 1;
          o.port = (i % perMember) + 1;
          o.panel = Math.floor(i / 24) + 1;
          o.panelPort = (i % 24) + 1;
          o.patch = `PP${o.panel}-${pad(o.panelPort)}`;
          o.idf = idf.id;
          o.switch = idf.host;
        });
        idf.outlets = outlets;
        idf.members = members;
        idf.stacks = Math.ceil(members / 8);
        if (members > 8) warnings.push(`${idf.id}: נדרשים ${members} מתגים — יותר מ-8 במחסנית אחת. שקלו להקטין את מספר החדרים לארון.`);
        idf.portsTotal = members * switchPorts;
        idf.portsUsed = outlets.length;
        idf.patchPanels = Math.max(1, Math.ceil(outlets.length / 24));
        idf.mgmtIp = claim(b.mgmt, mgmtOff++);
        idf.upsIp = null;
        mgmtIps.push(idf);
        idfList.push(idf);
      }
      if (fl.data) { fl.data.poolStart = at(fl.data, dataOff); fl.data.poolEnd = fl.data.last; }
      if (fl.voice) { fl.voice.poolStart = at(fl.voice, voiceOff); fl.voice.poolEnd = fl.voice.last; }
    }
    // UPS management, then APs, after all switch addresses.
    mgmtOff = Math.ceil((mgmtOff + 5) / 10) * 10;
    for (const idf of mgmtIps) idf.upsIp = claim(b.mgmt, mgmtOff++);
    mgmtOff = Math.ceil((mgmtOff + 5) / 10) * 10;
    for (const idf of mgmtIps) for (const ap of idf.aps) ap.ip = claim(b.mgmt, mgmtOff++);
    if (b.iot) { b.iot.poolStart = at(b.iot, iotOff); b.iot.poolEnd = b.iot.last; }
    for (const s of [b.wifi, b.guest]) if (s) { s.poolStart = at(s, 10); s.poolEnd = s.last; s.reserved = 9; }
    if (b.cctv) { b.cctv.poolStart = null; }
    if (b.print) { b.print.poolStart = null; }
  }
  if (site.transit) {
    site.transit.fw = intToIp(site.transit.base + 1);
    site.transit.fwA = redundancy ? intToIp(site.transit.base + 2) : null;
    site.transit.fwB = redundancy ? intToIp(site.transit.base + 3) : null;
    site.transit.core = intToIp(site.transit.base + 4);
    site.transit.coreA = redundancy ? intToIp(site.transit.base + 5) : null;
    site.transit.coreB = redundancy ? intToIp(site.transit.base + 6) : null;
    site.transit.reserved = 6;
    site.transit.gateway = site.transit.fw;
  }
  site.servers.gateway = intToIp(site.servers.base + 1);

  // ---------- 4b. manual changes per point (cfg.overrides, keyed by outlet label) ----------
  const overrides = cfg.overrides || {};
  const manual = [];
  if (Object.keys(overrides).length) {
    const used = new Map(); // ip -> owner label
    const own = (ipStr, who) => { if (ipStr) used.set(ipStr, who); };
    for (const idf of idfList) {
      own(idf.mgmtIp, idf.host);
      own(idf.upsIp, `${idf.id}-UPS`);
      for (const o of idf.outlets) { own(o.ip, o.label); if (o.phoneIp) own(o.phoneIp, `${o.label}-PH`); }
    }
    for (const sn of subnets) for (const g of [sn.gateway, sn.gwA, sn.gwB]) own(g, `Gateway ${sn.name}`);
    const byName = new Map(subnets.map((sn) => [sn.name, sn]));
    const outletByLabel = new Map(idfList.flatMap((idf) => idf.outlets.map((o) => [o.label, { o, idf }])));
    const ipOk = (sn, ipStr) => {
      let n;
      try { n = ipToInt(ipStr); } catch { return 'כתובת לא תקינה'; }
      if (n <= sn.base || n >= sn.base + sn.size - 1) return `הכתובת מחוץ לרשת ${sn.cidr}`;
      return null;
    };
    for (const [key, ov] of Object.entries(overrides)) {
      if (!ov || typeof ov !== 'object') continue;
      const isPhone = key.endsWith('-PH');
      const hit = outletByLabel.get(isPhone ? key.slice(0, -3) : key);
      if (!hit) { warnings.push(`שינוי ידני לנקודה ${key}: הנקודה לא קיימת יותר בתכנית, והשינוי לא הוחל.`); continue; }
      const { o } = hit;
      const ipField = isPhone ? 'phoneIp' : 'ip';
      const subField = isPhone ? 'phoneSubnet' : 'subnet';
      if (isPhone && !o.hasPhone) continue;
      const before = { ip: o[ipField], vlan: o[subField]?.vlan };
      let target = o[subField];
      if (ov.subnet && ov.subnet !== target?.name) {
        const t = byName.get(ov.subnet);
        if (!t || t.building !== hit.idf.building || (t.key === 'room' && t.room !== o.room) || o.type === 'ap' || isPhone) {
          warnings.push(`שינוי ידני ל-${key}: הרשת ${ov.subnet} לא זמינה לנקודה הזו, והשינוי לא הוחל.`);
        } else {
          target = t;
        }
      }
      const moved = target !== o[subField];
      let newIp = o[ipField];
      if (ov.ip) {
        const err = ipOk(target, ov.ip);
        const owner = used.get(ov.ip);
        if (err) warnings.push(`שינוי ידני ל-${key}: ${err}. נשארה כתובת אוטומטית.`);
        else if (owner && owner !== key) warnings.push(`שינוי ידני ל-${key}: הכתובת ${ov.ip} כבר בשימוש של ${owner}. נשארה כתובת אוטומטית.`);
        else newIp = ov.ip;
      }
      if (moved && (!ov.ip || newIp === o[ipField])) {
        // next free address in the new subnet, after the infrastructure block
        newIp = null;
        for (let off = 10; off <= target.usable; off++) {
          const cand = intToIp(target.base + off);
          if (!used.has(cand)) { newIp = cand; break; }
        }
        if (!newIp) { warnings.push(`שינוי ידני ל-${key}: אין כתובת פנויה ב-${target.name}.`); continue; }
      }
      if (newIp !== o[ipField]) {
        used.delete(o[ipField]);
        used.set(newIp, key);
        const off = ipToInt(newIp) - target.base;
        target.reserved = Math.max(target.reserved, Math.min(off, target.usable));
      }
      o[ipField] = newIp;
      o[subField] = target;
      if (!isPhone) {
        o.hostname = ov.hostname || '';
        o.mac = ov.mac || '';
        o.note = ov.note || '';
      }
      o.manual = true;
      manual.push({ key, label: o.label, room: o.room || null, before, after: { ip: newIp, vlan: target.vlan }, hostname: ov.hostname || '', mac: ov.mac || '', note: ov.note || '' });
    }
  }

  // Fill subnet & VLAN fields on endpoints.
  for (const idf of idfList) {
    for (const o of idf.outlets) {
      const s = o.subnet;
      o.vlan = s?.vlan ?? null;
      o.vlanName = s?.name ?? '';
      o.cidr = s?.cidr ?? '';
      o.mask = s?.mask ?? '';
      o.prefix = s?.prefix ?? null;
      o.gateway = s?.gateway ?? '';
      o.voiceVlan = o.hasPhone ? o.phoneSubnet.vlan : (o.type === 'voice' ? o.subnet.vlan : null);
      const dev = o.type === 'ap' ? { poeW: wifi.poeW, reserveW: wifi.reserveW, busyMbps: wifi.busyMbps } : DEVICES[o.type];
      o.poeW = dev.poeW + (o.hasPhone ? DEVICES.voice.poeW : 0);
      o.reserveW = dev.reserveW + (o.hasPhone ? DEVICES.voice.reserveW : 0);
      o.busyMbps = dev.busyMbps;
    }
  }

  // ---------- 5. gateways, L3 design, uplinks ----------
  const coreNames = redundancy ? ['CORE-1', 'CORE-2'] : ['CORE-1'];
  const fwNames = redundancy ? ['FW-1', 'FW-2'] : ['FW-1'];
  const dist = multiBuilding
    ? buildings.map((b) => ({ building: b.index, names: redundancy ? [`DS-${b.code}-1`, `DS-${b.code}-2`] : [`DS-${b.code}-1`] }))
    : null;
  for (const b of buildings) b.gatewayDevices = dist ? dist[b.index].names : coreNames;

  if (multiBuilding) {
    let off = 0;
    const p2p = site.p2p;
    const loop = site.loop;
    let lo = 1;
    const loops = {};
    for (const n of coreNames) loops[n] = intToIp(loop.base + lo++);
    b_links: for (const d of dist) {
      d.links = [];
      for (const dn of d.names) {
        loops[dn] = intToIp(loop.base + lo++);
        const cores = redundancy ? coreNames : [coreNames[0]];
        for (const cn of cores) {
          if (off + 2 > p2p.size) break b_links;
          d.links.push({ a: cn, aIp: intToIp(p2p.base + off), b: dn, bIp: intToIp(p2p.base + off + 1), cidr: `${intToIp(p2p.base + off)}/31` });
          off += 2;
        }
      }
    }
    p2p.reserved = off;
    loop.reserved = lo;
    site.loops = loops;
  }

  // ---------- 6. per-IDF engineering numbers ----------
  const up = UPLINKS[uplinkGbps];
  const linksPerStack = redundancy ? 2 : 1;
  for (const idf of idfList) {
    const o = idf.outlets;
    idf.poeDrawW = Math.round(o.reduce((s, x) => s + x.poeW, 0));
    idf.poeReserveW = Math.round(o.reduce((s, x) => s + x.reserveW, 0));
    const perSwitch = idf.poeReserveW / idf.members;
    idf.poeBudgetPerSwitch = perSwitch <= 370 ? 370 : perSwitch <= 740 ? 740 : perSwitch <= 1100 ? 1100 : 1440;
    if (perSwitch > 1440) warnings.push(`${idf.id}: צריכת PoE (${Math.round(perSwitch)}W למתג) גבוהה מכל ספק סטנדרטי — הוסיפו מתג או ספקי כוח כפולים.`);
    const dataMbps = o.filter((x) => x.type !== 'ap').reduce((s, x) => s + x.busyMbps * (x.type === 'data' ? 0.6 : 1), 0);
    const apMbps = o.filter((x) => x.type === 'ap').reduce((s, x) => s + x.busyMbps, 0);
    idf.busyMbps = Math.round(dataMbps + apMbps);
    idf.uplinks = linksPerStack * idf.stacks;
    idf.uplinkGbps = uplinkGbps * idf.uplinks;
    const accessGbps = o.reduce((s, x) => s + (x.type === 'ap' ? (cfg.wifiGen === 'wifi6' ? 1 : cfg.wifiGen === 'wifi6e' ? 2.5 : 5) : 1), 0);
    idf.oversub = +(accessGbps / idf.uplinkGbps).toFixed(1);
    idf.uplinkUtil = +(idf.busyMbps / (uplinkGbps * 1000)).toFixed(3); // against a single link (failover case)
    if (idf.uplinkUtil > 0.7) warnings.push(`${idf.id}: עומס שיא משוער ${Math.round(idf.busyMbps)} Mbps — מעל 70% מקישור ${uplinkGbps}G יחיד. העלו ל-${uplinkGbps < 25 ? 25 : 100}G.`);
    idf.coreLinks = Array.from({ length: idf.uplinks }, (_, i) => ({
      local: `${up.cisco}${(i % idf.members) + 1}/1/${Math.floor(i / idf.members) + 1}`,
      remote: multiBuilding ? dist[idf.building].names[i % dist[idf.building].names.length] : coreNames[i % coreNames.length],
    }));
    idf.rack = rackFor(idf, cfg);
  }

  // Core / distribution downlink ports.
  const coreDown = {};
  for (const idf of idfList) {
    idf.coreLinks.forEach((l) => {
      coreDown[l.remote] = coreDown[l.remote] || [];
      coreDown[l.remote].push({ idf: idf.id, host: idf.host, local: l.local });
    });
  }
  for (const [dev, list] of Object.entries(coreDown)) {
    const member = coreNames.includes(dev) ? coreNames.indexOf(dev) + 1 : dist.find((d) => d.names.includes(dev)).names.indexOf(dev) + 1;
    list.forEach((x, i) => { x.port = `${up.cisco}${member}/0/${i + 1}`; x.po = idfList.findIndex((d) => d.id === x.idf) + 1; });
    if (list.length > 48) warnings.push(`${dev}: ${list.length} קישורי Uplink — מעל 48 פורטים. נדרש מתג ליבה מודולרי או שכבת הפצה.`);
  }

  // ---------- 7. totals, BOM, WAN ----------
  const allOutlets = idfList.flatMap((x) => x.outlets);
  const count = (t) => allOutlets.filter((o) => o.type === t).length;
  const rooms = buildings.flatMap((b) => b.floors.flatMap((f) => f.rooms));
  const switches = idfList.reduce((s, x) => s + x.members, 0);
  const busyTotal = idfList.reduce((s, x) => s + x.busyMbps, 0);
  const internetMbps = Math.round(busyTotal * 0.12);
  const wanMbps = int(cfg.wanMbps, 1000);
  if (internetMbps > wanMbps * 0.8) {
    warnings.push(`קצב האינטרנט המשוער בשעת שיא (${internetMbps.toLocaleString('he-IL')} Mbps) מעל 80% מהחבילה (${wanMbps.toLocaleString('he-IL')} Mbps).`);
  }
  if (cfg.isps < 2) notes.push('ספק אינטרנט יחיד הוא נקודת כשל יחידה. מומלץ קו שני מספק אחר עם SD-WAN או Failover.');

  const cableRuns = allOutlets.length;
  const cableM = cableRuns * int(cfg.avgCableM, 40);
  const fiberLinks = idfList.reduce((s, x) => s + x.uplinks, 0) + (dist ? dist.reduce((s, d) => s + d.links.length, 0) : 0);
  const mdf = mdfRack(cfg, { coreNames, fwNames, idfCount: idfList.length, fiberLinks, isps: int(cfg.isps, 1) });

  const bom = [
    { item: `מתג גישה ${switchPorts} פורטים PoE+ מנוהל, Stackable, ‏2×${up.label}`, qty: switches, note: `תקציב PoE ${Math.max(...idfList.map((x) => x.poeBudgetPerSwitch))}W למתג` },
    { item: `מתג ליבה L3 (${up.label} downlinks, ‏100G בין הליבות)`, qty: coreNames.length, note: redundancy ? 'זוג ב-StackWise Virtual / MLAG' : '' },
    ...(dist ? [{ item: 'מתג הפצה L3 לכל מבנה', qty: dist.reduce((s, d) => s + d.names.length, 0), note: 'OSPF מול הליבה' }] : []),
    { item: 'חומת אש NGFW (IPS, סינון תוכן, VPN)', qty: fwNames.length, note: redundancy ? 'אשכול Active/Standby' : '' },
    { item: `נקודת גישה ${wifi.label}`, qty: count('ap'), note: `PoE class ${wifi.poeClass}, פורט ${wifi.port}` },
    { item: `מודול אופטי ${up.optic}`, qty: fiberLinks * 2, note: 'שני קצוות לכל קישור' },
    { item: 'כבל Cat6A (גליל 305 מ׳)', qty: Math.ceil(cableM / 305), note: `${cableRuns} ריצות × ~${int(cfg.avgCableM, 40)} מ׳` },
    { item: 'נקודת קיר Cat6A (שקע + פלטה)', qty: cableRuns - count('ap') - count('cam'), note: '' },
    { item: 'לוח ניתוב (Patch Panel) ‏24 פורטים Cat6A', qty: idfList.reduce((s, x) => s + x.patchPanels, 0), note: '' },
    { item: 'כבל מגשר (Patch Cord) ‏0.5 מ׳', qty: cableRuns, note: 'לוח ניתוב ← מתג' },
    { item: 'כבל אופטי OS2 ‏12 גידים', qty: idfList.length + (dist ? dist.length : 0), note: 'לכל ארון' },
    { item: 'ארון תקשורת (IDF)', qty: idfList.length, note: summarizeRacks(idfList) },
    { item: 'ארון ראשי (MDF) ‏42U', qty: 1, note: '' },
    { item: 'UPS ‏Online לארון', qty: idfList.length + mdf.ups, note: 'עם כרטיס ניהול SNMP' },
    { item: 'מצלמת IP', qty: count('cam'), note: 'PoE class 3' },
  ].filter((x) => x.qty > 0);

  const allSubnets = subnets;
  const totalUsable = allSubnets.reduce((s, x) => s + x.usable, 0);
  const totalReserved = allSubnets.reduce((s, x) => s + x.reserved, 0);
  const stats = {
    buildings: buildings.length,
    floors: buildings.reduce((s, b) => s + b.floors.length, 0),
    rooms: rooms.length,
    idfs: idfList.length,
    switches,
    accessPorts: idfList.reduce((s, x) => s + x.portsTotal, 0),
    outlets: allOutlets.length,
    endpoints: {
      data: count('data'), voice: count('voice') + allOutlets.filter((o) => o.hasPhone).length,
      iptv: count('iptv'), iot: count('iot'), ap: count('ap'), cam: count('cam'), print: count('print'),
    },
    vlans: new Set(allSubnets.filter((s) => s.vlan).map((s) => s.vlan)).size,
    subnets: allSubnets.length,
    addresses: { total: totalUsable, reserved: totalReserved, base: cfg.addressing.base },
    poeW: idfList.reduce((s, x) => s + x.poeDrawW, 0),
    poeReserveW: idfList.reduce((s, x) => s + x.poeReserveW, 0),
    busyMbps: busyTotal,
    internetMbps,
    wanMbps,
    fiberLinks,
    cableM,
    rackU: idfList.reduce((s, x) => s + x.rack.usedU, 0) + mdf.usedU,
  };

  const recommendation = recommend(cfg, { switches, wifi, up, multiBuilding, idfList, stats, redundancy });

  return {
    manual,
    cfg, mode, redundancy, passthrough, multiBuilding, wifi, uplink: up, uplinkGbps,
    buildings, idfs: idfList, rooms, subnets: allSubnets, blocks, site, services,
    coreNames, fwNames, dist, coreDown, mdf, bom, stats, warnings, notes, recommendation,
  };
}

function rackFor(idf, cfg) {
  const items = [];
  items.push({ type: 'fiber', label: 'ODF סיב אופטי (LC)', u: 1 });
  items.push({ type: 'cm', label: 'מארגן כבלים', u: 1 });
  let panelsLeft = idf.patchPanels;
  let pp = 1;
  for (let m = 1; m <= idf.members; m++) {
    for (let k = 0; k < (cfg.switchPorts >= 48 ? 2 : 1) && panelsLeft > 0; k++, panelsLeft--) {
      items.push({ type: 'panel', label: `Patch Panel ${pp++} (24)`, u: 1 });
    }
    items.push({ type: 'cm', label: 'מארגן כבלים', u: 1 });
    items.push({ type: 'switch', label: `${idf.host} · מתג ${m}`, u: 1 });
  }
  while (panelsLeft-- > 0) items.push({ type: 'panel', label: `Patch Panel ${pp++} (24)`, u: 1 });
  items.push({ type: 'cm', label: 'מארגן כבלים', u: 1 });
  items.push({ type: 'shelf', label: 'מדף / ציוד ספק', u: 2 });
  items.push({ type: 'ups', label: 'UPS ‏1500VA Online', u: 2 });
  const usedU = items.reduce((s, x) => s + x.u, 0);
  const sizeU = RACK_SIZES.find((n) => n >= Math.ceil(usedU * 1.35)) || 47;
  return { items, usedU, sizeU, kind: sizeU <= 22 ? 'ארון תלוי 600×600' : 'ארון עומד 800×1000' };
}

function mdfRack(cfg, { coreNames, fwNames, fiberLinks, isps }) {
  const items = [];
  for (let i = 1; i <= isps; i++) items.push({ type: 'isp', label: `נתב ספק ISP-${i}`, u: 1 });
  items.push({ type: 'cm', label: 'מארגן כבלים', u: 1 });
  for (const n of fwNames) items.push({ type: 'fw', label: `${n} · חומת אש`, u: 1 });
  items.push({ type: 'cm', label: 'מארגן כבלים', u: 1 });
  for (const n of coreNames) items.push({ type: 'core', label: `${n} · ליבה L3`, u: 1 });
  items.push({ type: 'cm', label: 'מארגן כבלים', u: 1 });
  const odf = Math.max(1, Math.ceil(fiberLinks / 24));
  for (let i = 1; i <= odf; i++) items.push({ type: 'fiber', label: `ODF ${i} · ‏24 LC Duplex`, u: 1 });
  items.push({ type: 'panel', label: 'Patch Panel שרתים (24)', u: 1 });
  items.push({ type: 'server', label: 'שרת DC/DNS/DHCP 1', u: 1 });
  items.push({ type: 'server', label: 'שרת DC/DNS/DHCP 2', u: 1 });
  items.push({ type: 'server', label: 'NMS · Syslog · RADIUS', u: 1 });
  items.push({ type: 'server', label: 'NVR הקלטת מצלמות', u: 2 });
  const ups = cfg.redundancy ? 2 : 1;
  for (let i = 1; i <= ups; i++) items.push({ type: 'ups', label: `UPS ‏3kVA Online ${i}`, u: 3 });
  const usedU = items.reduce((s, x) => s + x.u, 0);
  return { id: 'MDF', items, usedU, sizeU: usedU > 32 ? 47 : 42, kind: 'ארון עומד 800×1000', ups };
}

function summarizeRacks(idfs) {
  const m = {};
  for (const x of idfs) m[x.rack.sizeU] = (m[x.rack.sizeU] || 0) + 1;
  return Object.entries(m).map(([u, n]) => `${n}× ‏${u}U`).join(', ');
}

function recommend(cfg, { wifi, up, multiBuilding, idfList, stats, redundancy }) {
  const maxPoe = Math.max(...idfList.map((x) => x.poeBudgetPerSwitch));
  return {
    hub: 'לא להשתמש ב-Hub בשום מקום. Hub משדר כל חבילה לכל הפורטים, עובד ב-Half Duplex, לא תומך ב-VLAN ויוצר התנגשויות. זו טכנולוגיה שיצאה משימוש.',
    access: `בכל ארון קומה: מתג גישה מנוהל (Layer 2+), ‏${cfg.switchPorts} פורטים עם PoE+ ‏(802.3at/bt) ותקציב ${maxPoe}W למתג. צריך ${wifi.port} לנקודות הגישה, ‏2× ${up.label} ל-Uplink ותמיכה ב-Stacking. דוגמאות לדגמים: Cisco Catalyst 9300/9200, ‏HPE Aruba CX 6300/6200, ‏Juniper EX4100, ‏Fortinet FortiSwitch 448E.`,
    core: multiBuilding
      ? `ארכיטקטורה תלת־שכבתית: ליבה L3 ${redundancy ? 'כפולה' : ''} ב-MDF, מתג הפצה L3 בכל מבנה (Gateway של ה-VLANים עם VRRP/HSRP) וניתוב OSPF ביניהם.`
      : `ליבה מכווצת (Collapsed Core): ${redundancy ? 'זוג' : ''} מתגי L3 ב-MDF שמשמשים Gateway לכל ה-VLANים (${redundancy ? 'HSRP/VRRP' : 'SVI'}). כל ארון קומה מתחבר לליבה ב-${up.label}${redundancy ? ' לשני מתגי הליבה (LACP/MLAG)' : ''}.`,
    router: `נתב/חומת אש בקצה: ${redundancy ? 'זוג' : ''} NGFW שמבצע NAT, ניתוב לאינטרנט, VPN ובידוד בין רשתות (אורחים, מצלמות, IoT). את הניתוב בין ה-VLANים הפנימיים עושה מתג הליבה, לא הנתב, כדי לקבל ביצועי Wire-speed.`,
    wifi: stats.endpoints.ap ? `${stats.endpoints.ap} נקודות גישה ${wifi.label} בניהול מרכזי (Controller או ענן), עם SSID ארגוני (WPA3-Enterprise ‏802.1X) ו-SSID אורחים מבודד (WPA3-SAE/OWE + Captive Portal).` : '',
    summary: `לתכנית: ${stats.switches} מתגי גישה ב-${stats.idfs} ארונות תקשורת, ${redundancy ? 'ליבה כפולה' : 'ליבה'} ו-${redundancy ? 'זוג' : ''} חומת אש. אין צורך ב-Hub, ונתב נדרש רק בקצה מול ספק האינטרנט.`,
  };
}

// Subnets an outlet may be moved to: its building's floor/building networks, or its own room network.
export function subnetsFor(plan, o) {
  if (o.type === 'ap') return [o.subnet];
  const idf = plan.idfs.find((x) => x.id === o.idf);
  return plan.subnets.filter((s) => s.building === idf.building && s.vlan && s.key !== 'mgmt'
    && (s.key !== 'room' || s.room === o.room));
}

// Free addresses in a subnet (for the edit dialog), skipping everything already assigned.
export function freeIps(plan, s, limit = 20) {
  const used = new Set();
  for (const idf of plan.idfs) {
    used.add(idf.mgmtIp); used.add(idf.upsIp);
    for (const o of idf.outlets) { used.add(o.ip); if (o.phoneIp) used.add(o.phoneIp); }
  }
  for (const x of plan.subnets) [x.gateway, x.gwA, x.gwB].forEach((g) => g && used.add(g));
  const out = [];
  for (let off = 10; off <= s.usable && out.length < limit; off++) {
    const c = intToIp(s.base + off);
    if (!used.has(c)) out.push(c);
  }
  return out;
}

// Finds an IP anywhere in the plan.
export function lookup(plan, query) {
  const q = String(query).trim().toLowerCase();
  if (!q) return [];
  const hits = [];
  for (const idf of plan.idfs) {
    for (const o of idf.outlets) {
      if (o.ip === q || o.phoneIp === q || o.label.toLowerCase().includes(q) || (o.hostname && o.hostname.toLowerCase().includes(q)) || (o.mac && o.mac.toLowerCase() === q) || (o.roomNo && (o.roomNo === q || o.room.toLowerCase() === q))) {
        hits.push({ kind: 'endpoint', o, idf });
      }
    }
    if (idf.mgmtIp === q || idf.id.toLowerCase() === q || idf.host.toLowerCase() === q) hits.push({ kind: 'idf', idf });
  }
  for (const s of plan.subnets) {
    if (s.gateway === q || s.cidr === q || s.name.toLowerCase() === q || String(s.vlan) === q) hits.push({ kind: 'subnet', s });
  }
  return hits.slice(0, 50);
}

export { maskOf, usable };
