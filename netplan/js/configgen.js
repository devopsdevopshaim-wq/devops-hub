// Device configuration generators: Cisco IOS-XE (access stacks, core/distribution)
// and an ISC Kea DHCPv4 server file with per-wall-outlet reservations (DHCP option 82).

import { maskOf, intToIp } from './ip.js';

const line = (n = 1) => '!'.repeat(n);
const ranges = (nums) => {
  const v = [...new Set(nums.filter((x) => x != null))].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < v.length; i++) {
    let j = i;
    while (j + 1 < v.length && v[j + 1] === v[j] + 1) j++;
    out.push(j > i ? `${v[i]}-${v[j]}` : `${v[i]}`);
    i = j;
  }
  return out.join(',');
};
// Cisco limits a single "allowed vlan" line; split long lists.
const allowedLines = (list) => {
  const parts = ranges(list).split(',');
  const res = [];
  for (let i = 0; i < parts.length; i += 40) res.push(parts.slice(i, i + 40).join(','));
  return res;
};

function header(title, plan) {
  return [
    '!' + '='.repeat(70),
    `! ${title}`,
    `! אתר: ${plan.cfg.site.name} · נוצר ע״י נט־פלאן ${new Date().toISOString().slice(0, 10)}`,
    '! יש להחליף כל ערך <CHANGE-ME> לפני ההטמעה.',
    '!' + '='.repeat(70),
  ];
}

function baseHardening(plan, host, mgmtVlan) {
  const s = plan.services;
  return [
    `hostname ${host}`,
    `ip domain name ${plan.cfg.site.domain}`,
    'no ip domain lookup',
    'service password-encryption',
    'service timestamps debug datetime msec localtime',
    'service timestamps log datetime msec localtime',
    'no ip http server',
    'no ip http secure-server',
    'clock timezone IST 2 0',
    'clock summer-time IDT recurring last Fri Mar 2:00 last Sun Oct 2:00',
    'username netadmin privilege 15 algorithm-type scrypt secret <CHANGE-ME>',
    'enable algorithm-type scrypt secret <CHANGE-ME>',
    line(),
    'aaa new-model',
    'radius server NAC',
    ` address ipv4 ${s.radius} auth-port 1812 acct-port 1813`,
    ' key <CHANGE-ME>',
    'aaa group server radius NAC-GRP',
    ' server name NAC',
    'aaa authentication login default group NAC-GRP local',
    'aaa authorization exec default group NAC-GRP local if-authenticated',
    'aaa accounting exec default start-stop group NAC-GRP',
    line(),
    '! להריץ פעם אחת: crypto key generate rsa modulus 3072',
    'ip ssh version 2',
    'ip ssh time-out 60',
    'ip ssh authentication-retries 3',
    line(),
    `ntp server ${s.ntp} prefer`,
    `logging host ${s.syslog}`,
    'logging trap informational',
    mgmtVlan ? `logging source-interface Vlan${mgmtVlan}` : null,
    'snmp-server group NMS-GRP v3 priv',
    'snmp-server user nms NMS-GRP v3 auth sha <CHANGE-ME> priv aes 128 <CHANGE-ME>',
    `snmp-server host ${s.nms} version 3 priv nms`,
    'snmp-server enable traps',
    'lldp run',
    'cdp run',
    line(),
    'banner login ^',
    'גישה מורשית בלבד. כל הפעילות מתועדת.',
    'Authorized access only. All activity is logged.',
    '^',
  ].filter((x) => x !== null);
}

function vtyLines(plan) {
  const nets = plan.subnets.filter((s) => s.key === 'mgmt' || s.key === 'servers');
  return [
    'ip access-list standard MGMT-ONLY',
    ' remark ניהול מותר רק מרשתות הניהול והשרתים',
    ...nets.map((s) => ` permit ${s.network} ${s.wildcard}`),
    ' deny any log',
    'line con 0',
    ' exec-timeout 10 0',
    ' logging synchronous',
    'line vty 0 15',
    ' access-class MGMT-ONLY in',
    ' exec-timeout 10 0',
    ' transport input ssh',
  ];
}

export function accessSwitchConfig(plan, idf) {
  const b = plan.buildings[idf.building];
  const mgmt = b.mgmt;
  const up = plan.uplink.cisco;
  const outlets = idf.outlets;
  const vlans = new Map();
  const addV = (s) => { if (s && s.vlan) vlans.set(s.vlan, s.name); };
  for (const o of outlets) { addV(o.subnet); if (o.phoneSubnet) addV(o.phoneSubnet); }
  for (const o of outlets.filter((x) => x.type === 'voice')) addV(o.subnet);
  addV(mgmt);
  if (idf.aps.length) { addV(b.wifi); addV(b.guest); }
  const vlanIds = [...vlans.keys()].sort((a, c) => a - c);
  const userVlans = vlanIds.filter((v) => v !== mgmt.vlan);

  const L = header(`${idf.host} · ארון ${idf.id} · מחסנית ${idf.members} מתגים`, plan);
  L.push(...baseHardening(plan, idf.host, mgmt.vlan));
  L.push(line(), '! ---- Stack ----');
  for (let m = 1; m <= idf.members; m++) L.push(`switch ${m} priority ${m === 1 ? 15 : m === 2 ? 14 : 1}`);
  L.push(line(), '! ---- Layer 2 ----',
    'vtp mode transparent',
    'spanning-tree mode rapid-pvst',
    'spanning-tree extend system-id',
    'spanning-tree loopguard default',
    'udld enable',
    'errdisable recovery cause bpduguard',
    'errdisable recovery interval 300');
  for (const v of vlanIds) L.push(`vlan ${v}`, ` name ${vlans.get(v)}`);
  L.push(line(), '! ---- אבטחת שכבה 2: DHCP Snooping + Option 82 (שיוך כתובת לשקע בקיר) ----');
  L.push(`ip dhcp snooping vlan ${ranges(userVlans)}`);
  L.push('ip dhcp snooping information option');
  L.push('ip dhcp snooping');
  const daiVlans = userVlans.filter((v) => ![b.wifi?.vlan, b.guest?.vlan].includes(v));
  if (daiVlans.length) L.push(`ip arp inspection vlan ${ranges(daiVlans)}`, 'ip arp inspection validate src-mac dst-mac ip');
  L.push(line(), '! ---- ניהול ----',
    `interface Vlan${mgmt.vlan}`,
    ` description MGMT ${idf.host}`,
    ` ip address ${idf.mgmtIp} ${mgmt.mask}`,
    ' no shutdown',
    `ip default-gateway ${mgmt.gateway}`);

  L.push(line(), '! ---- Uplink: LACP אל הליבה ----',
    'interface Port-channel1',
    ` description UPLINK ${[...new Set(idf.coreLinks.map((l) => l.remote))].join('+')}`,
    ' switchport mode trunk',
    ' switchport trunk native vlan 999');
  allowedLines(vlanIds).forEach((a, i) => L.push(` switchport trunk allowed vlan ${i ? 'add ' : ''}${a}`));
  L.push(' ip dhcp snooping trust', ' ip arp inspection trust');
  for (const l of idf.coreLinks) {
    const down = plan.coreDown[l.remote].find((x) => x.idf === idf.id);
    L.push(`interface ${l.local}`,
      ` description UPLINK ${l.remote} ${down ? down.port : ''}`.trimEnd(),
      ' switchport mode trunk',
      ' switchport trunk native vlan 999',
      ' channel-group 1 mode active',
      ' udld port aggressive',
      ' no shutdown');
  }

  L.push(line(), '! ---- פורטים לנקודות קצה ----');
  for (const o of outlets) {
    L.push(`interface GigabitEthernet${o.member}/0/${o.port}`);
    L.push(` description ${o.label} ${o.patch}${o.type === 'ap' ? ' AP' : o.type === 'cam' ? ' CAM' : o.type === 'print' ? ' PRINTER' : ''}${o.hostname ? ` ${o.hostname}` : ''}`.slice(0, 200));
    if (o.type === 'ap') {
      const allowed = [mgmt.vlan, b.wifi?.vlan, b.guest?.vlan].filter(Boolean);
      L.push(' switchport mode trunk',
        ` switchport trunk native vlan ${mgmt.vlan}`,
        ` switchport trunk allowed vlan ${ranges(allowed)}`,
        ' spanning-tree portfast trunk',
        ' power inline auto',
        ` ip dhcp snooping vlan ${mgmt.vlan} information option format-type circuit-id string ${o.label}`);
    } else {
      const access = o.type === 'voice' ? (o.dataVlan ?? 999) : o.vlan;
      L.push(' switchport mode access',
        ` switchport access vlan ${access}`);
      if (o.voiceVlan) L.push(` switchport voice vlan ${o.voiceVlan}`);
      L.push(' switchport nonegotiate',
        ' spanning-tree portfast',
        ' spanning-tree bpduguard enable',
        ' storm-control broadcast level 5.00',
        ' storm-control multicast level 10.00',
        ' ip dhcp snooping limit rate 20',
        ` ip dhcp snooping vlan ${access} information option format-type circuit-id string ${o.type === 'voice' ? `${o.label}-PC` : o.label}`);
      if (o.voiceVlan && o.type === 'voice') {
        L.push(` ip dhcp snooping vlan ${o.voiceVlan} information option format-type circuit-id string ${o.label}`);
      } else if (o.voiceVlan) {
        L.push(` ip dhcp snooping vlan ${o.voiceVlan} information option format-type circuit-id string ${o.label}-PH`);
      }
      if (o.type === 'data' || o.type === 'voice') L.push(' power inline auto');
      else if (o.type === 'iptv' || o.type === 'print') L.push(' power inline never');
    }
    L.push(' no shutdown');
  }
  // spare ports: shut and park
  const ports = plan.cfg.switchPorts;
  for (let m = 1; m <= idf.members; m++) {
    const used = outlets.filter((o) => o.member === m).length || 0;
    if (used < ports) {
      L.push(`interface range GigabitEthernet${m}/0/${used + 1} - ${ports}`,
        ' description SPARE',
        ' switchport mode access',
        ' switchport access vlan 999',
        ' shutdown');
    }
  }
  L.push('vlan 999', ' name PARKING-UNUSED');
  L.push(line(), ...vtyLines(plan), 'end', '');
  return L.join('\n');
}

function svi(plan, s, { relay = true, acl = null } = {}) {
  const L = [`interface Vlan${s.vlan}`, ` description ${s.name} · ${s.purpose}`, ` ip address ${s.gateway} ${s.mask}`];
  if (relay && s.dhcp) {
    L.push(` ip helper-address ${plan.services.dhcp1}`, ` ip helper-address ${plan.services.dhcp2}`, ' ip dhcp relay information trusted');
  }
  if (s.ipv6) {
    const head = s.ipv6.replace('::/64', '');
    L.push(` ipv6 address ${head}::1/64`, ' ipv6 nd managed-config-flag', ' ipv6 nd other-config-flag');
    if (relay && s.dhcp) L.push(` ipv6 dhcp relay destination <DHCPv6-SERVER>`);
  }
  if (acl) L.push(` ip access-group ${acl} in`);
  L.push(' no ip redirects', ' no ip proxy-arp', ' no shutdown');
  return L;
}

function securityAcls(plan) {
  const s = plan.services;
  const rfc = ['10.0.0.0 0.255.255.255', '172.16.0.0 0.15.255.255', '192.168.0.0 0.0.255.255'];
  return [
    line(), '! ---- מדיניות בידוד (ACL) ----',
    'ip access-list extended GUEST-IN',
    ' remark אורחים: אינטרנט בלבד',
    ' permit udp any any eq bootps',
    ` permit udp any host ${s.dns1} eq domain`,
    ` permit udp any host ${s.dns2} eq domain`,
    ...rfc.map((r) => ` deny ip any ${r}`),
    ' permit ip any any',
    'ip access-list extended ROOM-IN',
    ' remark חדר: אינטרנט + DNS בלבד, ללא גישה לחדרים אחרים',
    ' permit udp any any eq bootps',
    ` permit udp any host ${s.dns1} eq domain`,
    ` permit udp any host ${s.dns2} eq domain`,
    ...rfc.map((r) => ` deny ip any ${r}`),
    ' permit ip any any',
    'ip access-list extended CCTV-IN',
    ' remark מצלמות: רק אל מקליט ה-NVR ומערכת הניטור',
    ' permit udp any any eq bootps',
    ` permit ip any host ${s.nvr}`,
    ` permit ip any host ${s.nms}`,
    ` permit udp any host ${s.ntp} eq ntp`,
    ' deny ip any any log',
    'ip access-list extended IOT-IN',
    ' remark IoT / IPTV: שרתים ואינטרנט, ללא רשתות משתמשים',
    ' permit udp any any eq bootps',
    ` permit ip any ${intToIp(plan.site.servers.base)} ${maskWild(plan.site.servers.prefix)}`,
    ...rfc.map((r) => ` deny ip any ${r}`),
    ' permit ip any any',
  ];
}

// VLANs a floor cabinet needs on its uplink trunk.
export function idfVlans(plan, idf) {
  const rooms = new Set(idf.rooms.map((r) => r.id));
  return plan.subnets
    .filter((s) => s.building === idf.building && s.vlan && (
      (s.scope === 'floor' && s.floor === idf.floor) || s.scope === 'building' || (s.key === 'room' && rooms.has(s.room))))
    .map((s) => s.vlan)
    // points moved by hand to another network still need their VLAN on the trunk
    .concat(idf.outlets.map((o) => o.vlan), idf.outlets.map((o) => o.voiceVlan))
    .filter((v, i, a) => v != null && a.indexOf(v) === i);
}

const maskWild = (p) => intToIp(p === 32 ? 0 : 2 ** (32 - p) - 1);

function aclFor(s) {
  return { guest: 'GUEST-IN', room: 'ROOM-IN', cctv: 'CCTV-IN', iot: 'IOT-IN' }[s.key] || null;
}

// Logical core: a StackWise Virtual pair (CORE-1 = switch 1, CORE-2 = switch 2) managed as one device.
export function coreConfig(plan) {
  const name = plan.redundancy ? 'CORE' : 'CORE-1';
  const L = header(`${name} · ליבה L3 ${plan.redundancy ? '(StackWise Virtual: CORE-1 + CORE-2)' : ''}`, plan);
  const firstMgmt = plan.buildings[0].mgmt;
  L.push(...baseHardening(plan, name, plan.multiBuilding ? null : firstMgmt.vlan));
  if (plan.redundancy) {
    L.push(line(), '! ---- StackWise Virtual (להריץ על כל מתג לפני האיחוד) ----',
      'stackwise-virtual', ' domain 1',
      'interface HundredGigE1/0/53', ' stackwise-virtual link 1',
      'interface HundredGigE1/0/54', ' stackwise-virtual link 1',
      'interface TenGigabitEthernet1/0/48', ' stackwise-virtual dual-active-detection',
      '! חזרו על אותן פקודות ב-switch 2 (HundredGigE2/0/53-54)');
  }
  L.push(line(), 'ip routing', 'ipv6 unicast-routing', 'ip multicast-routing', 'vtp mode transparent', 'spanning-tree mode rapid-pvst');
  const local = plan.multiBuilding
    ? plan.subnets.filter((s) => s.scope === 'site' && s.vlan)
    : plan.subnets.filter((s) => s.vlan);
  for (const s of local) L.push(`vlan ${s.vlan}`, ` name ${s.name}`);
  L.push(...securityAcls(plan));
  L.push(line(), '! ---- Gateways (SVI) ----');
  for (const s of local) {
    if (s.key === 'transit') {
      L.push(`interface Vlan${s.vlan}`, ` description ${s.name} · ${s.purpose}`, ` ip address ${s.core} ${s.mask}`, ' no shutdown');
    } else {
      L.push(...svi(plan, s, { acl: aclFor(s) }));
    }
  }
  L.push(line(), '! ---- ניתוב ----', `ip route 0.0.0.0 0.0.0.0 ${plan.site.transit.fw} name DEFAULT-TO-FW`);
  if (plan.multiBuilding) {
    L.push('interface Loopback0', ` ip address ${plan.site.loops[plan.coreNames[0]]} 255.255.255.255`);
    L.push(`router ospf 1`, ` router-id ${plan.site.loops[plan.coreNames[0]]}`, ' auto-cost reference-bandwidth 100000', ' passive-interface default',
      ` network ${intToIp(plan.site.p2p.base)} ${maskWild(plan.site.p2p.prefix)} area 0`,
      ` network ${intToIp(plan.site.loop.base)} ${maskWild(plan.site.loop.prefix)} area 0`,
      ` network ${intToIp(plan.site.servers.base)} ${maskWild(plan.site.servers.prefix)} area 0`,
      ' default-information originate');
    const p2pIf = [];
    plan.dist.forEach((d) => d.links.forEach((l) => p2pIf.push(l)));
    p2pIf.forEach((l, i) => {
      const m = plan.coreNames.indexOf(l.a) + 1;
      const ifn = `${plan.uplink.cisco}${m}/0/${40 + Math.floor(i / plan.coreNames.length) + 1}`;
      L.splice(L.indexOf(' default-information originate'), 0, ` no passive-interface ${ifn}`);
      L.push(`interface ${ifn}`, ` description P2P ${l.a} -> ${l.b}`, ' no switchport', ` ip address ${l.aIp} 255.255.255.254`, ' ip ospf network point-to-point', ' no shutdown');
    });
  } else {
    L.push(line(), '! ---- Downlinks אל ארונות הקומה (Port-channel לכל ארון) ----');
    plan.idfs.forEach((idf, i) => {
      const po = i + 10;
      L.push(`interface Port-channel${po}`, ` description DOWNLINK ${idf.host} (${idf.id})`, ' switchport mode trunk', ' switchport trunk native vlan 999');
      allowedLines(idfVlans(plan, idf)).forEach((a, k) => L.push(` switchport trunk allowed vlan ${k ? 'add ' : ''}${a}`));
      idf.coreLinks.forEach((l) => {
        const m = plan.coreNames.indexOf(l.remote) + 1;
        const idx = plan.coreDown[l.remote].findIndex((x) => x.idf === idf.id) + 1;
        L.push(`interface ${plan.uplink.cisco}${m}/0/${idx}`, ` description ${idf.host} ${l.local}`, ' switchport mode trunk', ` channel-group ${po} mode active`, ' udld port aggressive', ' no shutdown');
      });
    });
  }
  L.push(line(), '! ---- אל חומת האש ----', `interface ${plan.uplink.cisco}1/0/47`, ` description FW-1 inside`, ' switchport mode access', ` switchport access vlan ${plan.site.transit.vlan}`, ' no shutdown');
  if (plan.redundancy) L.push(`interface ${plan.uplink.cisco}2/0/47`, ` description FW-2 inside`, ' switchport mode access', ` switchport access vlan ${plan.site.transit.vlan}`, ' no shutdown');
  L.push(line(), ...vtyLines(plan), 'end', '');
  return L.join('\n');
}

export function distConfig(plan, d) {
  const b = plan.buildings[d.building];
  const name = plan.redundancy ? `DS-${b.code}` : d.names[0];
  const L = header(`${name} · הפצה L3 ל${b.name}${plan.redundancy ? ` (StackWise Virtual: ${d.names.join(' + ')})` : ''}`, plan);
  L.push(...baseHardening(plan, name, b.mgmt.vlan));
  L.push(line(), 'ip routing', 'ipv6 unicast-routing', 'vtp mode transparent', 'spanning-tree mode rapid-pvst');
  const local = plan.subnets.filter((s) => s.building === d.building && s.vlan);
  for (const s of local) L.push(`vlan ${s.vlan}`, ` name ${s.name}`);
  L.push(...securityAcls(plan));
  for (const s of local) L.push(...svi(plan, s, { acl: aclFor(s) }));
  const lo = plan.site.loops[d.names[0]];
  L.push(line(), 'interface Loopback0', ` ip address ${lo} 255.255.255.255`);
  L.push('router ospf 1', ` router-id ${lo}`, ' auto-cost reference-bandwidth 100000', ' passive-interface default');
  d.links.forEach((l, i) => L.push(` no passive-interface ${plan.uplink.cisco}${d.names.indexOf(l.b) + 1}/1/${(i % 2) + 1}`));
  for (const s of local) L.push(` network ${s.network} ${s.wildcard} area 0`);
  L.push(` network ${intToIp(plan.site.loop.base)} ${maskWild(plan.site.loop.prefix)} area 0`);
  L.push(` network ${intToIp(plan.site.p2p.base)} ${maskWild(plan.site.p2p.prefix)} area 0`);
  d.links.forEach((l, i) => {
    L.push(`interface ${plan.uplink.cisco}${d.names.indexOf(l.b) + 1}/1/${(i % 2) + 1}`, ` description P2P ${l.b} -> ${l.a}`, ' no switchport', ` ip address ${l.bIp} 255.255.255.254`, ' ip ospf network point-to-point', ' no shutdown');
  });
  L.push(line(), '! ---- Downlinks אל ארונות הקומה ----');
  plan.idfs.filter((x) => x.building === d.building).forEach((idf, i) => {
    const po = i + 10;
    L.push(`interface Port-channel${po}`, ` description DOWNLINK ${idf.host}`, ' switchport mode trunk', ' switchport trunk native vlan 999');
    allowedLines(idfVlans(plan, idf)).forEach((a, k) => L.push(` switchport trunk allowed vlan ${k ? 'add ' : ''}${a}`));
    idf.coreLinks.forEach((l) => {
      const m = d.names.indexOf(l.remote) + 1;
      const idx = plan.coreDown[l.remote].findIndex((x) => x.idf === idf.id) + 1;
      L.push(`interface ${plan.uplink.cisco}${m}/0/${idx}`, ` description ${idf.host} ${l.local}`, ' switchport mode trunk', ` channel-group ${po} mode active`, ' no shutdown');
    });
  });
  L.push(line(), ...vtyLines(plan), 'end', '');
  return L.join('\n');
}

// ISC Kea DHCPv4: every wall outlet gets its fixed address through option 82 circuit-id.
export function keaConfig(plan) {
  const subnets = [];
  const resBySubnet = new Map();
  // A reservation has exactly one identifier: the device MAC when one was entered, else the wall outlet.
  const addRes = (s, id, ip, mac, hostname) => {
    if (!s) return;
    if (!resBySubnet.has(s)) resBySubnet.set(s, []);
    const r = mac ? { 'hw-address': mac.toLowerCase() } : { 'circuit-id': `'${id}'` };
    resBySubnet.get(s).push({ ...r, 'ip-address': ip, hostname: (hostname || id).toLowerCase() });
  };
  for (const idf of plan.idfs) {
    for (const o of idf.outlets) {
      addRes(o.subnet, o.label, o.ip, o.mac, o.hostname);
      if (o.hasPhone) addRes(o.phoneSubnet, `${o.label}-PH`, o.phoneIp);
    }
  }
  let id = 1;
  for (const s of plan.subnets) {
    if (!s.dhcp && s.key !== 'mgmt') continue;
    if (!s.vlan) continue;
    const entry = {
      id: id++,
      subnet: s.cidr,
      'user-context': { vlan: s.vlan, name: s.name },
      'option-data': [
        { name: 'routers', data: s.gateway },
        { name: 'domain-name-servers', data: s.key === 'guest' || s.key === 'room' ? '1.1.1.1, 8.8.8.8' : `${plan.services.dns1}, ${plan.services.dns2}` },
        { name: 'domain-name', data: plan.cfg.site.domain },
        { name: 'ntp-servers', data: plan.services.ntp },
      ],
    };
    if (s.poolStart) entry.pools = [{ pool: `${s.poolStart} - ${s.poolEnd}` }];
    const res = resBySubnet.get(s);
    if (res?.length) entry.reservations = res;
    if (s.key === 'voice') entry['option-data'].push({ name: 'tftp-server-name', data: plan.services.pbx });
    subnets.push(entry);
  }
  const conf = {
    Dhcp4: {
      'interfaces-config': { interfaces: ['*'], 'dhcp-socket-type': 'udp' },
      'lease-database': { type: 'memfile', persist: true, name: '/var/lib/kea/dhcp4.leases' },
      'valid-lifetime': 28800,
      'renew-timer': 14400,
      'rebind-timer': 25200,
      'host-reservation-identifiers': ['circuit-id', 'hw-address'],
      'reservations-out-of-pool': false, // manual addresses may sit inside a pool; Kea then skips them for leases
      'high-availability-note': `שרת שני: ${plan.services.dhcp2} עם libdhcp_ha.so במצב hot-standby`,
      subnet4: subnets,
      loggers: [{ name: 'kea-dhcp4', 'output-options': [{ output: '/var/log/kea/dhcp4.log' }], severity: 'INFO' }],
    },
  };
  return JSON.stringify(conf, null, 2) + '\n';
}

export function allConfigs(plan) {
  const files = [];
  files.push({ name: `${plan.redundancy ? 'CORE' : 'CORE-1'}.txt`, title: 'ליבה', text: coreConfig(plan) });
  if (plan.dist) for (const d of plan.dist) files.push({ name: `DS-${plan.buildings[d.building].code}.txt`, title: `הפצה ${plan.buildings[d.building].name}`, text: distConfig(plan, d) });
  for (const idf of plan.idfs) files.push({ name: `${idf.host}.txt`, title: `${idf.id}`, text: accessSwitchConfig(plan, idf) });
  files.push({ name: 'kea-dhcp4.json', title: 'שרת DHCP (Kea)', text: keaConfig(plan) });
  return files;
}

export { maskOf };
