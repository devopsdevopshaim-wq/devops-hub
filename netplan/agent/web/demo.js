/* Demo data, used only when the page is opened without the local NetPlan service
   (for example on the public preview site). Every value here is invented. */
window.NETPLAN_DEMO = (() => {
  const now = () => Date.now() / 1000;
  const T0 = now();
  const dev = (id, ip, o) => Object.assign({
    id, ip, uid: o.mac || 'ip:' + ip, alias: '', notes: '', approved: true, online: true, first_seen: T0 - 86400 * 20,
    last_seen: T0 - 30, ports: [], risks: [], reasons: [], services: [], http: [], banners: {}, confidence: 70,
    ip_history: [ip], evidence: ['ping', 'arp'],
  }, o);
  const devices = [
    dev(1, '192.168.1.1', { mac: '50:C7:BF:3A:11:02', vendor: 'TP-Link', name: 'Archer-AX55', type: 'router', type_label: 'ראוטר / שער רשת', icon: 'router', is_gateway: true, confidence: 98, ttl: 64, rtt: 0.6, os_ttl: 'Linux / Android / macOS / iOS', ports: [53, 80, 443, 1900, 49152], reasons: ['שער ברירת המחדל של הרשת', 'מכריז על עצמו כ־Internet Gateway (UPnP)'], upnp: { friendly: 'Archer AX55', manufacturer: 'TP-Link', model: 'Archer AX55', device_type: 'urn:schemas-upnp-org:device:InternetGatewayDevice:1', types: ['urn:schemas-upnp-org:device:InternetGatewayDevice:1'] }, http: [{ port: 80, title: 'Opening...', server: '' }] }),
    dev(2, '192.168.1.23', { mac: '3C:52:82:9B:44:10', vendor: 'Dell', name: 'DESKTOP-7QK2M1', netbios: 'DESKTOP-7QK2M1', workgroup: 'WORKGROUP', type: 'self', type_label: 'המחשב שלי', icon: 'laptop', self: true, confidence: 100, rtt: 0 }),
    dev(3, '192.168.1.10', { mac: '00:11:32:AB:CD:01', vendor: 'Synology', name: 'DiskStation', type: 'nas', type_label: 'שרת קבצים (NAS)', icon: 'nas', ports: [22, 80, 139, 443, 445, 5000, 5001], rtt: 0.8, ttl: 64, confidence: 85, reasons: ['שרת אחסון רשת (NAS)', 'SSH + שירותי שרת'], risks: [{ port: 445, severity: 'info', text: 'שיתוף קבצים SMB פתוח. ודא ש־SMBv1 כבוי ושהשיתופים מוגנים בסיסמה.' }], alias: 'גיבוי משרד' }),
    dev(4, '192.168.1.15', { mac: 'A0:D3:C1:22:19:7E', vendor: 'HP', name: 'HP-LaserJet-M404', type: 'printer', type_label: 'מדפסת', icon: 'printer', ports: [80, 443, 631, 9100], rtt: 1.9, ttl: 255, confidence: 88, reasons: ['פורטי הדפסה פתוחים (9100/631/515)'], services: ['_ipp', '_printer'] }),
    dev(5, '192.168.1.31', { mac: '9C:5C:8E:01:77:20', vendor: 'ASUSTek', name: 'MOSHE-PC', netbios: 'MOSHE-PC', type: 'pc_win', type_label: 'מחשב Windows', icon: 'pc', ports: [135, 139, 445, 3389], rtt: 0.9, ttl: 128, os_ttl: 'Windows', confidence: 64, reasons: ['שירותי Windows (SMB/RPC/RDP) או TTL 128'], risks: [{ port: 3389, severity: 'warn', text: 'RDP פתוח: יעד נפוץ להתקפות. הגבל לרשת המקומית/VPN והפעל NLA.' }, { port: 445, severity: 'info', text: 'שיתוף קבצים SMB פתוח.' }] }),
    dev(6, '192.168.1.40', { mac: '4C:BD:8F:10:20:30', vendor: 'Hikvision', name: 'DS-7608NI', type: 'camera', type_label: 'מצלמה / מקליט (DVR/NVR)', icon: 'camera', ports: [23, 80, 554, 8000], rtt: 2.4, ttl: 64, confidence: 86, reasons: ['יצרן/ממשק מצלמות או פורט DVR'], risks: [{ port: 554, severity: 'info', text: 'שידור וידאו RTSP: ודא שלמצלמה יש סיסמה שאינה ברירת המחדל.' }, { port: 23, severity: 'bad', text: 'Telnet פתוח: סיסמאות עוברות בטקסט גלוי. יש לכבות ולהשתמש ב־SSH.' }], approved: true, alias: 'מקליט מצלמות' }),
    dev(7, '192.168.1.52', { mac: 'DA:A1:19:5E:22:8B', vendor: '', random_mac: true, name: 'iPhone', mdns: 'iPhone.local', type: 'phone', type_label: 'טלפון / טאבלט', icon: 'phone', ports: [62078], rtt: 8.5, ttl: 64, confidence: 90, reasons: ['פורט סנכרון של iPhone/iPad (62078)'] }),
    dev(8, '192.168.1.53', { mac: '72:3B:0A:91:CC:12', vendor: '', random_mac: true, name: '', type: 'phone', type_label: 'טלפון / טאבלט', icon: 'phone', ports: [], rtt: 22.1, ttl: 64, confidence: 55, reasons: ['כתובת MAC אקראית (פרטיות) – אופייני לטלפונים ומחשבים ניידים'], approved: false, first_seen: T0 - 600 }),
    dev(9, '192.168.1.60', { mac: 'F4:F5:D8:66:12:01', vendor: 'Google', name: 'Chromecast-Living', type: 'tv', type_label: 'טלוויזיה / סטרימר', icon: 'tv', ports: [8008, 8009, 8443], services: ['_googlecast'], rtt: 3.2, confidence: 84, reasons: ['Chromecast / Google Cast'] }),
    dev(10, '192.168.1.71', { mac: '24:0A:C4:5D:9E:01', vendor: 'Espressif (IoT)', name: 'shelly-plug', type: 'iot', type_label: 'מכשיר חכם (IoT)', icon: 'iot', ports: [80], rtt: 6.6, confidence: 66, reasons: ['מכשיר חכם (IoT / בית חכם)'] }),
    dev(11, '192.168.1.2', { mac: '24:A4:3C:11:22:33', vendor: 'Ubiquiti', name: 'U6-Lite', type: 'netdev', type_label: 'ציוד רשת (מתג / נקודת גישה)', icon: 'switch', ports: [22, 80, 443], rtt: 0.7, confidence: 74, reasons: ['ציוד רשת מנוהל (ממשק ניהול פתוח)'] }),
    dev(12, '192.168.1.80', { mac: '00:0C:29:4F:88:10', vendor: 'VMware', name: 'srv-app01', type: 'vm', type_label: 'מכונה וירטואלית', icon: 'server', ports: [22, 80, 443, 3306], rtt: 1.1, ttl: 64, confidence: 80, reasons: ['כרטיס רשת וירטואלי (VMware)'], risks: [{ port: 3306, severity: 'warn', text: 'מסד נתונים MySQL חשוף ברשת.' }] }),
    dev(13, '192.168.1.95', { mac: 'B8:27:EB:00:12:34', vendor: 'Raspberry Pi', name: 'pihole', type: 'pc_linux', type_label: 'מחשב / שרת Linux', icon: 'pc', ports: [22, 53, 80], rtt: 1.3, ttl: 64, confidence: 50, reasons: ['SSH'], online: false, last_seen: T0 - 7200 }),
  ];
  const checks = [
    { id: 'link', title: 'הצפנת קו התקשורת (כבל)', status: 'info', category: 'link', text: 'הכבל עצמו לא מוצפן; זה תקין כל עוד התעבורה הרגישה מוצפנת.', details: ['חיבור קווי (Ethernet). כבל רשת רגיל אינו מוצפן ברמת הקו.', 'אימות 802.1X לא פעיל במחשב – היציאה ברשת לא דורשת זיהוי (מקובל בבית, חלש בארגון).'], fix: ['ברשת ארגונית: הפעלת 802.1X / MACsec במתגים.'] },
    { id: 'traffic', title: 'תעבורה לא מוצפנת יוצאת מהמחשב', status: 'warn', category: 'leak', text: '2 חיבורים פעילים עוברים ללא הצפנה (מתוך 64); 94% מוצפנים בוודאות.', details: ['updater.exe → 93.184.216.34:80 (HTTP)', 'printsvc.exe → 192.168.1.15:9100'], fix: ['בדוק אילו תוכנות מתקשרות ב־HTTP/FTP/Telnet ועבור לגרסה מוצפנת.', 'ברשת ציבורית/זרה – הפעל VPN.'] },
    { id: 'tls', title: 'יירוט HTTPS (SSL Inspection)', status: 'ok', category: 'leak', text: 'התעודה של www.google.com הונפקה ע״י Google Trust Services – אין סימן ליירוט התעבורה המוצפנת.' },
    { id: 'dns_hijack', title: 'חטיפת DNS', status: 'ok', category: 'leak', text: 'תשובות ה־DNS תקינות (אין הפניה של שמות שגויים).' },
    { id: 'dns_privacy', title: 'פרטיות DNS', status: 'info', category: 'leak', text: 'שאילתות DNS רגילות עוברות ללא הצפנה – הספק/הרשת רואים לאילו אתרים אתה נכנס.', fix: ['Windows 11: הגדרות ← רשת ← DNS ← הצפנה "מוצפן בלבד (DNS over HTTPS)".'] },
    { id: 'vpn', title: 'VPN', status: 'info', category: 'leak', text: 'אין VPN פעיל. ברשת ביתית זה תקין; ברשת ציבורית מומלץ VPN.' },
    { id: 'arp', title: 'הרעלת ARP (ARP Spoofing)', status: 'ok', category: 'network', text: 'לא נמצאה התחזות לראוטר בטבלת ה־ARP. ראוטר: 50:C7:BF:3A:11:02' },
    { id: 'upnp', title: 'UPnP פעיל בראוטר', status: 'warn', category: 'network', text: 'כל מכשיר ברשת (כולל נוזקה) יכול לפתוח לעצמו פורטים לאינטרנט בלי אישור.', details: ['TP-Link Archer AX55'], fix: ['בממשק הראוטר: כבה UPnP אם אינך צריך אותו.'] },
    { id: 'router_admin', title: 'אבטחת הראוטר', status: 'ok', category: 'network', text: 'לא נמצאו שירותי ניהול לא מוצפנים בראוטר.', details: ['פורטים פתוחים: 53, 80, 443'] },
    { id: 'lan_services', title: 'שירותים מסוכנים ברשת', status: 'bad', category: 'network', text: '3 שירותים חשופים שכדאי לבדוק.', details: ['192.168.1.40 מקליט מצלמות: Telnet פתוח', '192.168.1.31 MOSHE-PC: RDP פתוח', '192.168.1.80 srv-app01: MySQL חשוף'], fix: ['כבה שירותים שאינך צריך; הגן בסיסמה חזקה על השאר.'] },
    { id: 'unknown_devices', title: 'מכשירים לא מאושרים ברשת', status: 'warn', category: 'network', text: '1 מכשירים עדיין לא סומנו כמוכרים.', details: ['192.168.1.53 – טלפון / טאבלט'], fix: ['במסך "התקנים" סמן כל מכשיר מוכר כ"מאושר".'] },
    { id: 'firewall', title: 'חומת אש', status: 'ok', category: 'host', text: 'חומת האש של Windows פעילה בכל הפרופילים.' },
    { id: 'profile', title: 'פרופיל רשת', status: 'info', category: 'host', text: 'הרשת מוגדרת כפרטית – המחשב גלוי ומשתף ברשת. מתאים לבית בלבד.' },
    { id: 'proxy', title: 'שרת Proxy', status: 'ok', category: 'leak', text: 'לא מוגדר Proxy במערכת.' },
    { id: 'listening', title: 'שירותים פתוחים במחשב שלך', status: 'info', category: 'host', text: 'המחשב מאזין לחיבורים מהרשת בפורטים רגישים.', details: ['445 (SMB) – System'] },
  ];
  const samples = [];
  for (let i = 180; i > 0; i--) samples.push(sample(T0 - i * 5));
  function sample(t) {
    const spike = Math.random() < 0.04;
    return { t, gw: +(0.5 + Math.random() * 0.8).toFixed(1), inet: +(11 + Math.random() * 5 + (spike ? 40 : 0)).toFixed(1), dns: +(13 + Math.random() * 7).toFixed(1) };
  }
  const st = (k) => {
    const v = samples.slice(-60).map((s) => s[k]);
    const avg = v.reduce((a, b) => a + b, 0) / v.length;
    return { loss: 0, avg: +avg.toFixed(1), max: Math.max(...v), jitter: 1.2, n: v.length };
  };
  const events = [
    { id: 9, t: T0 - 600, level: 'warn', kind: 'new_device', text: 'מכשיר חדש ברשת: 192.168.1.53 – טלפון / טאבלט' },
    { id: 8, t: T0 - 640, level: 'ok', kind: 'scan', text: 'סריקה מלאה הושלמה: 12 מכשירים פעילים, ציון אבטחה 72' },
    { id: 7, t: T0 - 700, level: 'ok', kind: 'connected', text: 'התקבלה כתובת 192.168.1.23 ב־Ethernet. כבל 1000 Mbps · IP 192.168.1.23/24 · ראוטר 192.168.1.1' },
    { id: 6, t: T0 - 706, level: 'ok', kind: 'cable_in', text: 'כבל רשת חובר (Ethernet) – ממתין לכתובת IP…' },
    { id: 5, t: T0 - 3600, level: 'bad', kind: 'link_down', text: 'כבל הרשת נותק (Ethernet)' },
    { id: 4, t: T0 - 7200, level: 'info', kind: 'start', text: 'NetPlan הופעל' },
  ];
  const iface = { name: 'Ethernet', description: 'Intel(R) Ethernet Connection I219-LM', kind: 'ethernet', is_up: true, mac: '3C:52:82:9B:44:10', speed: 1000, duplex: 'full', mtu: 1500, dhcp: true, dhcp_server: '192.168.1.1', lease_expires: '2026-11-27 09:14', dns: ['192.168.1.1'], ipv4: [{ ip: '192.168.1.23', netmask: '255.255.255.0', prefix: 24 }], ipv6: [] };
  const state = {
    app: { version: '1.0.0', os: 'windows', started: T0 - 7200, psutil: true, ping: true, oui_vendors: 38512, hostname: 'DESKTOP-7QK2M1' },
    progress: { running: false, pct: 100, msg: '', kind: '' },
    snapshot: { dns: ['192.168.1.1'], vpn_active: false, vpn_ifaces: [], interfaces: [iface], primary: 'Ethernet', lan: 'Ethernet' },
    lan: { iface, ip: '192.168.1.23', netmask: '255.255.255.0', prefix: 24, network: '192.168.1.0/24', gateway: '192.168.1.1', broadcast: '192.168.1.255', hosts: 254 },
    network: { id: 1, name: 'המשרד – קומה 2', subnet: '192.168.1.0/24', gateway: '192.168.1.1', gateway_mac: '50:C7:BF:3A:11:02' },
    networks: [{ id: 1, name: 'המשרד – קומה 2', subnet: '192.168.1.0/24', gateway: '192.168.1.1', gateway_mac: '50:C7:BF:3A:11:02', devices: 13, last_seen: T0 }, { id: 2, name: 'הבית', subnet: '10.0.0.0/24', gateway: '10.0.0.138', gateway_mac: '', devices: 9, last_seen: T0 - 86400 * 2 }],
    devices,
    scan: { t: T0 - 640, scanned: 254, duration: 18.4, range: '192.168.1.1 – 192.168.1.254', note: '', ping_available: true },
    security: { t: T0 - 630, score: 72, checks, counts: { ok: 6, info: 5, warn: 3, bad: 1 } },
    trace: { t: T0 - 635, target: '1.1.1.1', available: true, findings: [], hops: [
      { hop: 1, ip: '192.168.1.1', rtt: 0.6, kind: 'gateway', role: 'הראוטר שלך (שער הרשת)', name: '' },
      { hop: 2, ip: '', rtt: null, kind: 'silent', role: 'נתב שאינו עונה (חוסם ICMP) – תקין', name: '' },
      { hop: 3, ip: '203.0.113.17', rtt: 7.9, kind: 'isp', role: 'כניסה לרשת ספק האינטרנט', name: 'core1.isp.example', jump: 7.3 },
      { hop: 4, ip: '198.51.100.9', rtt: 9.4, kind: 'internet', role: 'נתב באינטרנט', name: 'ix-peer.example' },
      { hop: 5, ip: '1.1.1.1', rtt: 11.8, kind: 'target', role: 'יעד הבדיקה', name: 'one.one.one.one' },
    ] },
    diag: { t: T0 - 620, findings: [], tests: { gateway: { loss: 0, avg: 0.6, jitter: 0.1, max: 0.9, n: 5 }, internet: { loss: 0, avg: 12.1, jitter: 0.8, max: 13.4, n: 5 }, dns: { '192.168.1.1': 14.2, '1.1.1.1': 9.6, '8.8.8.8': 12.3, '9.9.9.9': 21.7 }, mtu: 1500, captive: { ok: true, status: 204 }, speed: { download_mbps: 487.3, upload_mbps: 92.6 } } },
    quick: [],
    public: { ip: '203.0.113.88', isp: 'ספק אינטרנט לדוגמה', asn: 'AS64500', city: 'Tel Aviv', country: 'IL' },
    events,
    settings: { auto_scan_on_connect: true, rescan_minutes: 15, sample_seconds: 5, public_ip_lookup: true, trace_target: '1.1.1.1', custom_range: '', notify_new_device: true, notify_issues: true },
  };
  return {
    tick() {
      samples.push(sample(now()));
      if (samples.length > 180) samples.shift();
      state.samples = samples.slice();
      state.stats = { gw: st('gw'), inet: st('inet'), dns: st('dns') };
      return JSON.parse(JSON.stringify(state));
    },
  };
})();
