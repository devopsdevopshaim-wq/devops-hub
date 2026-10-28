/* ארון־פלאן — קריאה מלאה של תכנית 208-B (B CABINET, הגדוד העברי 53, שקמה, גרסה 1 מ-27.10.19, 28 עמודים).
   כל רכיב וכל חוט נלקחו מהשרטוט, נקודה לנקודה, עם מספר העמוד. החתכים והצבעים נקבעו לפי תקנות החשמל,
   ת"י 61439 ו-IEC 60204-1 / IEC 60445 (בתכנית עצמה אין צבעים וחתכים, חוץ ממהדקי PT 1.5).
   קובץ משותף: window.WPlan208B בדפדפן, require בבדיקות. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WPlan208B = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* טביעת אצבע: הטקסט של ה-PDF כולל את כל אלה */
  function matches(text) {
    var t = String(text || '');
    return /208\s*[-–]\s*B/.test(t) && /B\s*CABINET/i.test(t) && /Hagdod\s*Haivri/i.test(t);
  }

  var comps = [];
  var C = function (tag, type, name, extra) { comps.push(Object.assign({ tag: tag, type: type, name: name }, extra || {})); };

  /* ---------- רכיבים בארון ---------- */
  C('-XS', 'terminal', 'מהדקי הזנה S0', { desc: 'הזנה 3×400V+N+PE 20A מלוח A מעגל F50', partNo: 'Phoenix UT 6 / UT 6-PE', maker: 'Phoenix Contact', page: 1 });
  C('-S0', 'main_switch', 'מפסק ראשי (פק"ט) 3×25A', { desc: 'מפסק זרם ראשי עם ידית בדלת', page: 1 });
  C('-FB101', 'rcd', 'מפסק פחת 4×40A / 30mA', { desc: 'הגנה מחשמול על כל הלוח, כולל השקעים', page: 1 });
  C('-F1', 'mcb', 'מאמ"ת 3×16A — שער 1', { desc: 'הזנת בקר שער 1 (MG1)', page: 2 });
  C('-F2', 'mcb', 'מאמ"ת 3×16A — שער 2', { desc: 'הזנת בקר שער 2 (MG2)', page: 2 });
  C('-FSK', 'mcb', 'מאמ"ת 1×16A — שקעים', { desc: 'שלישיית שקעים N3 על הדופן הפנימית', page: 1 });
  C('-FPS1', 'mcb', 'מאמ"ת 1×6A — ספק PS1', { page: 1 });
  C('-FPS2', 'mcb', 'מאמ"ת 1×6A — ספק PS2', { page: 1 });
  C('-FPS3', 'mcb', 'מאמ"ת 1×6A — ספק PS3', { page: 1 });
  C('-FPS4', 'mcb', 'מאמ"ת 1×6A — ספק PS4', { page: 1 });
  C('-FF', 'mcb', 'מאמ"ת 1×6A — מאוורר לוח', { page: 1 });
  C('-XN', 'terminal', 'פס אפס (N) מחולק', { desc: 'מהדקי N מגושרים בגשר מסרק', page: 1 });
  C('-PS1', 'psu', 'ספק 24VDC 4.2A (+24V)', { desc: 'מזין את כל מעגלי הפיקוד ‎+24V. עובר דרך UPS כשמותקן', page: 1 });
  C('-PS2', 'psu', 'ספק 24VDC 4.2A (24G)', { desc: 'מזין את 24G (נורית LED 19)', page: 1 });
  C('-PS3', 'psu', 'ספק 12VDC 2.5A (12T)', { desc: 'מזין קורא כרטיסים 1, Tibbo ומסך', page: 1 });
  C('-PS4', 'psu', 'ספק 12VDC 2.5A (12R)', { desc: 'מזין קורא כרטיסים 2', page: 1 });
  C('-N3', 'socket', 'שלישיית שקעים 230V', { desc: 'על הדופן הפנימית של הארון', page: 1 });
  C('-XUPS', 'terminal', 'מהדקי UPS', { desc: 'UPS1→UPS2 מגושרים כשאין UPS', page: 1 });
  C('-RUPS', 'relay', 'ממסר מצב רשת (סליל 230VAC)', { desc: 'מגע 11-12 לטלטוניקה, 21-22 לכניסת PLC on UPS', page: 1 });
  C('-RF', 'relay', 'ממסר כיבוי מאוורר', { desc: 'יציאה 4.1 — TURN OFF cabinet fan', page: 13 });
  C('-RM', 'relay', 'ממסר כיבוי מסך', { desc: 'יציאה 4.12 — TURN OFF monitor', page: 14 });
  C('-X24', 'terminal', 'פס חלוקה ‎+24V', { desc: 'מ-PS1, מגושר בגשר מסרק', page: 4 });
  C('-X0V', 'terminal', 'פס חלוקה 0V', { desc: '0V משותף של כל הספקים', page: 1 });
  C('-X12', 'terminal', 'פס חלוקה 12T', { desc: 'מ-PS3', page: 26 });
  C('-RPLT', 'relay', 'ממסר משטח למעלה (3 מגעים)', { desc: 'PALLET UPPER POSITION — נעילת פתיחת דלת 1 ושער 1', page: 4 });
  C('-RPLC', 'relay', 'ממסר איפוס PLC', { desc: 'מגע NC מנתק את מתח הבקר (RESET PLC)', page: 4 });
  C('-RSW1', 'relay', 'ממסר איפוס מתג Ethernet 1', { page: 4 });
  C('-RSW2', 'relay', 'ממסר איפוס מתג Ethernet 2', { page: 4 });
  C('-SL', 'other', 'מפסק דלת לתאורת לוח', { desc: 'נסגר כשהדלת נפתחת', page: 4 });
  C('-HL1', 'other', 'תאורת לוח 24V', { page: 4 });
  C('-SW1', 'other', 'מתג Ethernet 1', { maker: 'Phoenix Contact', partNo: '2891001 (FL SWITCH SFNB 5TX)', page: 4 });
  C('-SW2', 'other', 'מתג Ethernet 2', { maker: 'Phoenix Contact', partNo: '2891001 (FL SWITCH SFNB 5TX)', page: 4 });
  C('-KSFT', 'relay', 'ממסר בטיחות לחירום', { maker: 'Phoenix Contact', partNo: 'PSR-MC30 2700498', desc: 'מעגל חירום 15 לחצנים, יציאות 13-14 ל-PLC ו-23-24 ל-Enable', page: 5 });
  C('-KES', 'relay', 'ממסר משוב שרשרת חירום', { desc: 'מגע 13-14 בלולאת המשוב S21-S22', page: 5 });
  C('-XEN', 'terminal', 'מהדקי Enable', { desc: '4 יציאות Enable (E+/E-) מממסר הבטיחות', page: 5 });
  C('-SW3', 'other', 'נתב סלולרי Teltonika', { maker: 'Teltonika', partNo: 'RUT955', page: 6 });
  C('-RTEL', 'relay', 'ממסר איפוס Teltonika', { page: 6 });
  C('-XTL', 'terminal', 'מהדקי Teltonika', { page: 27 });
  C('-A1', 'plc', 'בקר Beckhoff CX2020 + CX2100', { maker: 'Beckhoff', partNo: 'CX2020 / CX2550 / CX2100', desc: 'להתקין על ספייסר 50 מ"מ (הערה בעמוד 23)', page: 23 });
  for (var i = 1; i <= 7; i++) {
    var inp = i <= 3;
    C('-IO' + i, 'io', 'I/O TERMINAL ' + i + ' — ' + (inp ? 'EL1809 16 כניסות' : 'EL2809 16 יציאות'), { maker: 'Beckhoff', partNo: inp ? 'EL1809' : 'EL2809', io: inp ? 'in' : 'out', page: 6 + i * 2 - 1 });
  }
  C('-EK1', 'io', 'EtherCAT Junction C1/C2', { maker: 'Beckhoff', partNo: 'EK1122', page: 23 });
  C('-EK2', 'io', 'EtherCAT Junction E1/E2', { maker: 'Beckhoff', partNo: 'EK1122', page: 23 });
  C('-TB', 'other', 'Tibbo — בקרת קוראי כרטיסים', { desc: 'כניסות in1/in2 מה-PLC, ממסר 2 מאפס את Teltonika', page: 26 });
  ['RD1', 'RD2', 'RG1O', 'RG1C', 'RG2O', 'RG2C', 'RG1S', 'RG2S', 'RLD19'].forEach(function (r) {
    var he = { RD1: 'פתיחת דלת 1', RD2: 'פתיחת דלת 2', RG1O: 'פתיחת שער 1', RG1C: 'סגירת שער 1', RG2O: 'פתיחת שער 2', RG2C: 'סגירת שער 2', RG1S: 'עצירת שער 1', RG2S: 'עצירת שער 2', RLD19: 'LED 19' }[r];
    C('-' + r, 'relay', 'ממסר ' + he, { desc: 'ממסר ממשק 24VDC, מגע יבש 11-14', page: 3 });
  });
  C('-XRJ', 'terminal', 'שקעי RJ45 על פס DIN', { desc: 'C1 C2 E1 E2 Client — מחוברים לבקר', page: 27 });

  /* פסי המהדקים לשטח, בסדר של רשימת המהדקים (עמוד 27) */
  var STRIPS = [
    ['-XMG1', 'מהדקי שער 1 — כוח (MG1)', ['R', 'S', 'T', 'N', 'PE']],
    ['-XMG2', 'מהדקי שער 2 — כוח (MG2)', ['R', 'S', 'T', 'N', 'PE']],
    ['-XG1', 'מהדקי שער 1 — פיקוד', ['G1O1', 'G1O2', 'G1C1', 'G1C2', 'G1S1', 'G1S2', '105', '106', '109', '+24V', '0V']],
    ['-XG2', 'מהדקי שער 2 — פיקוד', ['G2O1', 'G2O2', 'G2C1', 'G2C2', 'G2S1', 'G2S2', '107', '108', '+24V', '0V']],
    ['-XD1', 'מהדקי דלת 1', ['D1.1', 'D1.2', '103', '+24V', '0V']],
    ['-XD2', 'מהדקי דלת 2', ['D2.1', 'D2.2', '104', '+24V', '0V']],
    ['-XPUP', 'מהדקי חיישן משטח (PUP)', ['+24V', '0V', 'PLT']],
    ['-XSR', 'מהדקי סורק ימני (Scanner R)', ['201', '202', '203', '204', '501', '502', '503', '504', '+24V', '0V']],
    ['-XSL', 'מהדקי סורק שמאלי (Scanner L)', ['205', '206', '207', '208', '505', '506', '507', '508', '+24V', '0V']],
    ['-XST', 'מהדקי סורק עליון (Scanner T)', ['209', '210', '211', '212', '509', '510', '511', '512', '+24V', '0V']],
    ['-XSPR', 'מהדקי רזרבה', ['113', '114', '115', '116', '213', '214', '215', '216', '316', '605', '606', '607', '608', '712', '713', '714', '715', '716']],
    ['-XMP', 'מהדקי פאנל לקוח ראשי', ['T1', 'T2', '12T', '0V', 'M+', 'M-', '413', '24V', '112', '414', '0V/2', '415', '0V/3']],
    ['-XSP', 'מהדקי פאנל משני', ['12R', '0V', 'T11', 'T12', '513', '0V/2', '514', '0V/3']],
    ['-XLT', 'מהדקי מגדל אור', ['515', '0V', '516', '0V/2']],
    ['-XDP', 'מהדקי פאנל כיוונים', ['609', '610', '611', '612', '613', '614', '615', '616', '701', '702', '703', '704', '705', '706', '707', '708', '709', '710', 'LD19', '0V']]
  ];
  STRIPS.forEach(function (s) { C(s[0], 'terminal', s[1], { partNo: 'Phoenix PT 1.5', maker: 'Phoenix Contact', page: 27 }); });
  var esTerms = [];
  for (var e = 1; e <= 15; e++) esTerms.push('ES' + e + '.1', 'ES' + e + '.2', 'ES' + e + '.3');
  C('-XES', 'terminal', 'מהדקי לחצני חירום 1–15', { partNo: 'Phoenix PT 1.5', maker: 'Phoenix Contact', page: 21 });
  C('-PE', 'pe_bar', 'פס הארקה ראשי', { page: 1 });

  /* ---------- בשטח ---------- */
  C('-GATE1', 'field', 'בקר שער 1', { location: 'field', desc: 'כוח MG1 ופיקוד: פתח / סגור / עצור, מצב פתוח / סגור, Gate guard', page: 2 });
  C('-GATE2', 'field', 'בקר שער 2', { location: 'field', page: 2 });
  C('-DOOR1', 'field', 'דלת 1', { location: 'field', page: 3 });
  C('-DOOR2', 'field', 'דלת 2', { location: 'field', page: 3 });
  C('-SP', 'sensor', 'חיישן משטח למעלה (SP)', { location: 'field', desc: 'PALLET UPPER POSITION', page: 4 });
  C('-EN', 'field', 'יציאות Enable לציוד החניון', { location: 'field', page: 5 });
  C('-SCR', 'sensor', 'סורק SICK TIM351 ימני', { location: 'field', maker: 'SICK', partNo: 'TIM351', page: 9 });
  C('-SCL', 'sensor', 'סורק SICK TIM351 שמאלי', { location: 'field', maker: 'SICK', partNo: 'TIM351', page: 9 });
  C('-SCT', 'sensor', 'סורק SICK TIM351 עליון', { location: 'field', maker: 'SICK', partNo: 'TIM351', page: 10 });
  for (e = 1; e <= 15; e++) C('-ES' + e, 'estop', 'לחצן חירום ' + e, { location: 'field', desc: 'NC 11-12 בשרשרת, NO 13-14 לכניסת PLC', page: e <= 5 ? 21 : 22 });
  C('-MP', 'field', 'פאנל לקוח ראשי', { location: 'field', desc: 'קורא כרטיסים 1 (GP20), מסך, לחצן ירוק, נוריות ירוקה ואדומה, זמזם', page: 14 });
  C('-SEC', 'field', 'פאנל לקוח משני', { location: 'field', desc: 'קורא כרטיסים 2 (GP20), נורית ירוקה ואדומה', page: 16 });
  C('-LT', 'field', 'מגדל אור (רמזור)', { location: 'field', page: 16 });
  C('-DP', 'field', 'פאנל כיוונים (19 LED)', { location: 'field', page: 18 });
  C('-PDC', 'field', 'מגעי דלתות החניון', { location: 'field', desc: 'PARKING DOORS ARE CLOSE', page: 8 });
  C('-FAN', 'fan', 'מאוורר לוח 230V', { location: 'field', desc: 'מאוורר עם מסנן בדופן הארון', page: 1 });

  /* ---------- חוטים ---------- */
  var wires = [];
  var W = function (no, a, b, o) {
    o = o || {};
    var x = a.split(':'), y = b.split(':');
    wires.push({
      no: String(no), from: { tag: x[0], term: x.slice(1).join(':') }, to: { tag: y[0], term: y.slice(1).join(':') },
      color: o.c || '', colorSource: 'standard', section: o.s || 0.75, wireType: o.t || '', func: o.f || '', potential: o.p || '', desc: o.d || '', explain: o.x || '', page: o.pg || 1
    });
  };
  var P = function (s, c, f, p, pg, t) { return { s: s, c: c, f: f, p: p, pg: pg, t: t }; };
  var ph = function (i) { return ['BN', 'BK', 'GY'][i]; };
  var L = ['L1', 'L2', 'L3'];

  /* עמוד 1: הזנה → מפסק ראשי → פחת → פס L1/L2/L3/N */
  ['R', 'S', 'T'].forEach(function (t, i) {
    W(L[i], '-XS:' + t, '-S0:' + (2 * i + 1), Object.assign(P(4, ph(i), 'power', L[i], 1, 'H07V-K'), { d: 'הזנה ' + L[i] + ' למפסק הראשי' }));
    W(L[i], '-S0:' + (2 * i + 2), '-FB101:' + (2 * i + 1), Object.assign(P(4, ph(i), 'power', L[i], 1, 'H07V-K'), { d: L[i] + ' מהמפסק הראשי לפחת' }));
  });
  W('N', '-XS:N', '-FB101:N', Object.assign(P(4, 'LBU', 'neutral', 'N', 1, 'H07V-K'), { d: 'אפס לפחת (S0 3 קטבים, N לא מנותק)' }));
  W('PE', '-XS:PE', '-PE:1', Object.assign(P(4, 'GNYE', 'pe', 'PE', 1, 'H07V-K'), { d: 'הארקה ראשית מההזנה לפס' }));
  /* גישורי כניסות המאמ"תים: 4 ממ"ר כי ההגנה שלפניהם היא 20A בלוח A (או פס צמד) */
  var bus = [
    ['-FB101:2', '-F1:1', '-F2:1', '-FSK:1', '-FPS3:1'],
    ['-FB101:4', '-F1:3', '-F2:3', '-FPS1:1', '-FPS4:1'],
    ['-FB101:6', '-F1:5', '-F2:5', '-FPS2:1', '-FF:1']
  ];
  bus.forEach(function (chain, i) {
    for (var k = 1; k < chain.length; k++) W(L[i], chain[k - 1], chain[k], Object.assign(P(4, ph(i), 'power', L[i], k <= 2 ? 2 : 1, 'H07V-K'), { d: 'גישור ' + L[i] + ' לכניסת ' + chain[k].split(':')[0] + ' (אפשר פס צמד)' }));
  });
  W('N', '-FB101:N2', '-XN:N1', Object.assign(P(4, 'LBU', 'neutral', 'N', 1, 'H07V-K'), { d: 'אפס מהפחת לפס האפס' }));
  for (var n = 1; n < 10; n++) W('N', '-XN:N' + n, '-XN:N' + (n + 1), Object.assign(P(4, 'LBU', 'neutral', 'N', 1, 'גשר מסרק'), { d: 'גשר בפס האפס' }));
  /* עמוד 2: שערים */
  [['-F1', '-XMG1', 'N2'], ['-F2', '-XMG2', 'N3']].forEach(function (g, gi) {
    ['R', 'S', 'T'].forEach(function (t, i) { W('MG' + (gi + 1) + '-' + L[i], g[0] + ':' + (2 * i + 2), g[1] + ':' + t, Object.assign(P(2.5, ph(i), 'power', L[i], 2, 'H07V-K'), { d: 'הזנת שער ' + (gi + 1) + ' ' + L[i] })); });
    W('N', '-XN:' + g[2], g[1] + ':N', Object.assign(P(2.5, 'LBU', 'neutral', 'N', 2, 'H07V-K'), { d: 'אפס לשער ' + (gi + 1) }));
    W('PE', '-PE:' + (gi + 2), g[1] + ':PE', Object.assign(P(2.5, 'GNYE', 'pe', 'PE', 2, 'H07V-K'), { d: 'הארקה לשער ' + (gi + 1) }));
  });
  /* שקעים */
  W('SK', '-FSK:2', '-N3:L', Object.assign(P(2.5, 'BN', 'power', 'L1', 1, 'H07V-K'), { d: 'פאזה לשקעים' }));
  W('N', '-XN:N4', '-N3:N', Object.assign(P(2.5, 'LBU', 'neutral', 'N', 1, 'H07V-K'), { d: 'אפס לשקעים (לא מצויר בתכנית; חובה)' }));
  W('PE', '-PE:4', '-N3:PE', Object.assign(P(2.5, 'GNYE', 'pe', 'PE', 1, 'H07V-K'), { d: 'הארקה לשקעים (לא מצויר בתכנית; חובה)' }));
  /* ספקים */
  W('UPS1', '-FPS1:2', '-XUPS:UPS1', Object.assign(P(1.5, 'BK', 'power', 'L2', 1, 'H07V-K'), { d: 'L2 מוגן אל כניסת ה-UPS' }));
  W('UPS1', '-XUPS:UPS1', '-XUPS:UPS2', Object.assign(P(1.5, 'BK', 'power', 'L2', 1, 'גשר מסרק'), { d: 'גישור UPS1→UPS2 כשאין UPS' }));
  W('UPS2', '-XUPS:UPS2', '-PS1:L', Object.assign(P(1.5, 'BK', 'power', 'L2', 1, 'H07V-K'), { d: 'הזנת ספק PS1' }));
  W('N', '-XN:N5', '-XUPS:UPS1N', Object.assign(P(1.5, 'LBU', 'neutral', 'N', 1, 'H07V-K'), { d: 'אפס אל כניסת ה-UPS' }));
  W('UPS1N', '-XUPS:UPS1N', '-XUPS:UPS2N', Object.assign(P(1.5, 'LBU', 'neutral', 'N', 1, 'גשר מסרק'), { d: 'גישור UPS1N→UPS2N' }));
  W('UPS2N', '-XUPS:UPS2N', '-PS1:N', Object.assign(P(1.5, 'LBU', 'neutral', 'N', 1, 'H07V-K'), { d: 'אפס לספק PS1' }));
  W('RUPS', '-XUPS:UPS1', '-RUPS:A1', Object.assign(P(1.5, 'BK', 'power', 'L2', 1, 'H07V-K'), { d: 'סליל RUPS מזהה מתח רשת לפני ה-UPS' }));
  W('N', '-XN:N10', '-RUPS:A2', Object.assign(P(1.5, 'LBU', 'neutral', 'N', 1, 'H07V-K'), { d: 'אפס לסליל RUPS' }));
  [['-FPS2', '-PS2', 'L3', 'N6'], ['-FPS3', '-PS3', 'L1', 'N7'], ['-FPS4', '-PS4', 'L2', 'N8']].forEach(function (s) {
    W(s[2], s[0] + ':2', s[1] + ':L', Object.assign(P(1.5, ph(L.indexOf(s[2])), 'power', s[2], 1, 'H07V-K'), { d: 'הזנת ספק ' + s[1] }));
    W('N', '-XN:' + s[3], s[1] + ':N', Object.assign(P(1.5, 'LBU', 'neutral', 'N', 1, 'H07V-K'), { d: 'אפס לספק ' + s[1] }));
  });
  ['-PS1', '-PS2', '-PS3', '-PS4'].forEach(function (s, i) { W('PE', '-PE:' + (5 + i), s + ':PE', Object.assign(P(1.5, 'GNYE', 'pe', 'PE', 1, 'H07V-K'), { d: 'הארקת ' + s })); });
  /* מאוורר */
  W('RF', '-FF:2', '-RF:11', Object.assign(P(1.5, 'GY', 'power', 'L3', 1, 'H07V-K'), { d: 'L3 מוגן אל מגע הכיבוי של המאוורר' }));
  W('F', '-RF:12', '-FAN:L', Object.assign(P(1.5, 'GY', 'power', 'L3', 1, 'כבל 3G1.5'), { d: 'פאזה למאוורר דרך מגע NC של RF' }));
  W('N', '-XN:N9', '-FAN:N', Object.assign(P(1.5, 'LBU', 'neutral', 'N', 1, 'כבל 3G1.5'), { d: 'אפס למאוורר' }));
  W('PE', '-PE:9', '-FAN:PE', Object.assign(P(1.5, 'GNYE', 'pe', 'PE', 1, 'כבל 3G1.5'), { d: 'הארקת המאוורר' }));
  W('PE', '-PE:10', '-PE:11', Object.assign(P(4, 'GNYE', 'pe', 'PE', 1, 'פס הארקה גמיש'), { d: 'גישור הארקה לדלת ולגוף הארון' }));

  /* יציאות הספקים ופסי החלוקה DC */
  W('+24', '-PS1:+', '-X24:1', Object.assign(P(1.5, 'BU', 'ctrl_dc', '+24V', 1, 'H07V-K'), { d: '‎+24V מ-PS1 לפס החלוקה' }));
  W('0V', '-PS1:-', '-X0V:1', Object.assign(P(1.5, 'WHBU', 'dc0', '0V', 1, 'H07V-K'), { d: '0V של PS1' }));
  W('0V', '-PS2:-', '-X0V:2', Object.assign(P(1.5, 'WHBU', 'dc0', '0V', 1, 'H07V-K'), { d: '0V של PS2 (0V משותף)' }));
  W('0V', '-PS3:-', '-X0V:3', Object.assign(P(1.5, 'WHBU', 'dc0', '0V', 1, 'H07V-K'), { d: '0V של PS3 (0V משותף)' }));
  W('0V', '-PS4:-', '-X0V:4', Object.assign(P(1.5, 'WHBU', 'dc0', '0V', 1, 'H07V-K'), { d: '0V של PS4 (0V משותף)' }));
  W('12T', '-PS3:+', '-X12:1', Object.assign(P(1.0, 'BU', 'ctrl_dc', '12T', 26, 'H05V-K'), { d: '12T מ-PS3 לפס החלוקה' }));
  for (n = 1; n < 3; n++) W('12T', '-X12:' + n, '-X12:' + (n + 1), Object.assign(P(1.0, 'BU', 'ctrl_dc', '12T', 26, 'גשר מסרק'), { d: 'גשר 12T' }));
  var t24 = 1, t0 = 4;
  var p24 = function (to, no, d, pg) { t24++; W('+24', '-X24:' + t24, to, Object.assign(P(0.75, 'BU', 'ctrl_dc', '+24V', pg || 4, 'H05V-K'), { d: d })); };
  var p0 = function (to, d, pg) { t0++; W('0V', '-X0V:' + t0, to, Object.assign(P(0.75, 'WHBU', 'dc0', '0V', pg || 4, 'H05V-K'), { d: d })); };
  /* עמוד 4 */
  p24('-XPUP:+24V', '+24', '‎+24V לחיישן המשטח', 4);
  W('PLT', '-XPUP:PLT', '-RPLT:A1', Object.assign(P(0.75, 'BU', 'ctrl_dc', '', 4, 'H05V-K'), { d: 'חיישן משטח למעלה → סליל RPLT' }));
  p0('-RPLT:A2', 'חזרת סליל RPLT', 4);
  p0('-XPUP:0V', '0V לחיישן המשטח', 4);
  p24('-SL:1', '+24', '‎+24V למפסק הדלת של התאורה', 4);
  W('SL', '-SL:2', '-HL1:1', Object.assign(P(0.75, 'BU', 'ctrl_dc', '', 4, 'H05V-K'), { d: 'תאורת לוח נדלקת כשהדלת נפתחת' }));
  p0('-HL1:2', '0V לתאורת הלוח', 4);
  p24('-RPLC:11', '+24', '‎+24V אל מגע RESET PLC', 4);
  W('24PLC', '-RPLC:12', '-A1:24V', Object.assign(P(1.0, 'BU', 'ctrl_dc', '24PLC', 23, 'H05V-K'), { d: '24PLC — מתח הבקר (Us)' }));
  W('24PLC', '-A1:24V', '-A1:24Vp', Object.assign(P(1.0, 'BU', 'ctrl_dc', '24PLC', 23, 'H05V-K'), { d: 'גישור Us→Up (מגעי כוח לכרטיסי ה-I/O)' }));
  p0('-A1:0V', '0V לבקר', 23);
  W('0V', '-A1:0V', '-A1:0Vp', Object.assign(P(1.0, 'WHBU', 'dc0', '0V', 23, 'H05V-K'), { d: 'גישור 0V→0Vp' }));
  p24('-RSW1:11', '+24', '‎+24V אל מגע RSW1', 4);
  W('24SW1', '-RSW1:12', '-SW1:1', Object.assign(P(0.75, 'BU', 'ctrl_dc', '24SW1', 4, 'H05V-K'), { d: 'הזנת מתג Ethernet 1' }));
  p0('-SW1:2', '0V למתג 1', 4);
  p24('-RSW2:11', '+24', '‎+24V אל מגע RSW2', 4);
  W('24SW2', '-RSW2:12', '-SW2:1', Object.assign(P(0.75, 'BU', 'ctrl_dc', '24SW2', 4, 'H05V-K'), { d: 'הזנת מתג Ethernet 2' }));
  p0('-SW2:2', '0V למתג 2', 4);
  /* עמוד 5: ממסר בטיחות */
  W('411', '-IO4:11', '-KSFT:A1', Object.assign(P(0.75, 'BU', 'ctrl_dc', '', 5, 'H05V-K'), { d: 'PLC EMERGENCY STOP — מתח לממסר הבטיחות' }));
  W('416', '-IO4:16', '-KSFT:S34', Object.assign(P(0.75, 'BU', 'ctrl_dc', '', 5, 'H05V-K'), { d: 'איפוס ממסר הבטיחות (reset safety relay)' }));
  W('ES', '-XES:ES15.3', '-KSFT:S12', Object.assign(P(0.75, 'BU', 'ctrl_dc', '', 5, 'H05V-K'), { d: 'סוף שרשרת החירום → כניסת S12' }));
  W('ES', '-KSFT:S12', '-KES:A1', Object.assign(P(0.75, 'BU', 'ctrl_dc', '', 5, 'H05V-K'), { d: 'סליל KES מקבל מתח כששרשרת החירום סגורה' }));
  p0('-KES:A2', 'חזרת סליל KES', 5);
  p0('-KSFT:A2', '0V לממסר הבטיחות', 5);
  W('S21', '-KSFT:S21', '-KES:13', Object.assign(P(0.75, 'BU', 'ctrl_dc', '', 5, 'H05V-K'), { d: 'לולאת משוב S21 דרך מגע KES' }));
  W('S22', '-KES:14', '-KSFT:S22', Object.assign(P(0.75, 'BU', 'ctrl_dc', '', 5, 'H05V-K'), { d: 'לולאת משוב חזרה ל-S22' }));
  p24('-KSFT:13', '+24', '‎+24V למגע הבטיחות 13', 5);
  W('101', '-KSFT:14', '-IO1:1', Object.assign(P(0.75, 'BU', 'ctrl_dc', '', 7, 'H05V-K'), { d: 'From Safety relay → כניסה 1.1' }));
  p24('-KSFT:23', '+24', '‎+24V למגע הבטיחות 23', 5);
  W('E+', '-KSFT:24', '-XEN:E+1', Object.assign(P(0.75, 'BU', 'ctrl_dc', '', 5, 'H05V-K'), { d: 'Enable +' }));
  for (n = 1; n < 4; n++) W('E+', '-XEN:E+' + n, '-XEN:E+' + (n + 1), Object.assign(P(0.75, 'BU', 'ctrl_dc', '', 5, 'גשר מסרק (מדלג על E-)'), { d: 'חלוקת Enable +' }));
  p0('-XEN:E-1', 'Enable −', 5);
  for (n = 1; n < 4; n++) W('E-', '-XEN:E-' + n, '-XEN:E-' + (n + 1), Object.assign(P(0.75, 'WHBU', 'dc0', '0V', 5, 'גשר מסרק (מדלג על E+)'), { d: 'חלוקת Enable −' }));
  /* עמוד 6: Teltonika */
  p24('-RTEL:10', '+24', '‎+24V אל מגע RTEL', 6);
  W('24SW3', '-RTEL:2', '-SW3:+', Object.assign(P(0.75, 'BU', 'ctrl_dc', '24SW3', 6, 'H05V-K'), { d: 'הזנת Teltonika דרך מגע האיפוס' }));
  p0('-SW3:-', '0V ל-Teltonika', 6);
  W('0V', '-SW3:-', '-SW3:7', Object.assign(P(0.75, 'WHBU', 'dc0', '0V', 6, 'H05V-K'), { d: '0V להדק 7' }));
  W('0V', '-SW3:7', '-SW3:8', Object.assign(P(0.75, 'WHBU', 'dc0', '0V', 6, 'H05V-K'), { d: '0V להדק 8' }));
  W('0V', '-SW3:8', '-SW3:9', Object.assign(P(0.75, 'WHBU', 'dc0', '0V', 6, 'H05V-K'), { d: '0V להדק 9' }));
  W('TL1', '-XTL:TL1', '-SW3:1', Object.assign(P(0.75, 'BU', 'ctrl_dc', '', 6, 'H05V-K'), { d: 'כניסה 1 של Teltonika' }));
  p24('-RUPS:11', '+24', '‎+24V למגע RUPS 11', 6);
  W('TL2', '-RUPS:12', '-SW3:2', Object.assign(P(0.75, 'BU', 'ctrl_dc', '', 6, 'H05V-K'), { d: 'מצב רשת → כניסה 2 של Teltonika' }));
  W('111', '-SW3:3', '-IO1:11', Object.assign(P(0.75, 'BU', 'ctrl_dc', '', 8, 'H05V-K'), { d: 'TELTONIKA OUTPUT → כניסה 1.11' }));
  p24('-SW3:5', '+24', '‎+24V להדק 5', 6);
  W('RPLC', '-SW3:10', '-RPLC:A1', Object.assign(P(0.75, 'BU', 'ctrl_dc', '', 6, 'H05V-K'), { d: 'Teltonika מאפס את הבקר (סליל RPLC)' }));
  p0('-RPLC:A2', 'חזרת סליל RPLC', 6);
  p24('-XTL:+24V', '+24', '‎+24V למגעי דלתות החניון', 8);
  p0('-XTL:0V', '0V למהדקי Teltonika', 27);
  W('110', '-XTL:110', '-IO1:10', Object.assign(P(0.75, 'BU', 'ctrl_dc', '', 8, 'H05V-K'), { d: 'PARKING DOORS ARE CLOSE → כניסה 1.10' }));
  /* עמודים 7–8: כרטיס כניסות 1 */
  p24('-RPLT:33', '+24', '‎+24V למגע RPLT 33', 7);
  W('102', '-RPLT:34', '-IO1:2', Object.assign(P(0.75, 'BU', 'ctrl_dc', '', 7, 'H05V-K'), { d: 'LIFT IN BOX → כניסה 1.2' }));
  [['-XD1:103', 3, 'Door 1 is close'], ['-XD2:104', 4, 'Door 2 is close'], ['-XG1:105', 5, 'Gate 1 is open'], ['-XG1:106', 6, 'Gate 1 is close'], ['-XG2:107', 7, 'Gate 2 — מצב (בשרטוט: "Gate 2 is close")'], ['-XG2:108', 8, 'Gate 2 is close'], ['-XG1:109', 9, 'Gate guard'], ['-XMP:112', 12, 'MAIN PANEL GREEN BUTTON']].forEach(function (x) {
    W(x[0].split(':')[1], x[0], '-IO1:' + x[1], Object.assign(P(0.75, 'BU', 'ctrl_dc', '', x[1] <= 8 ? 7 : 8, 'H05V-K'), { d: x[2] + ' → כניסה 1.' + x[1] }));
  });
  p24('-RUPS:22', '+24', '‎+24V למגע RUPS 22', 8);
  W('113', '-RUPS:21', '-IO1:13', Object.assign(P(0.75, 'BU', 'ctrl_dc', '', 8, 'H05V-K'), { d: 'PLC on UPS → כניסה 1.13' }));
  W('113', '-IO1:13', '-XSPR:113', Object.assign(P(0.75, 'BU', 'ctrl_dc', '', 27, 'H05V-K'), { d: 'הדק בדיקה 113' }));
  [114, 115, 116].forEach(function (k) { W(k, '-XSPR:' + k, '-IO1:' + (k - 100), Object.assign(P(0.75, 'BU', 'ctrl_dc', '', 8, 'H05V-K'), { d: 'רזרבה → כניסה 1.' + (k - 100) })); });
  /* עמודים 9–10: כרטיס כניסות 2 (סורקים) */
  for (n = 1; n <= 16; n++) {
    var no = 200 + n, src = n <= 4 ? '-XSR' : n <= 8 ? '-XSL' : n <= 12 ? '-XST' : '-XSPR';
    var lbl = n <= 12 ? 'From Scanner ' + (n <= 4 ? '1_' + n : n <= 8 ? '2_' + (n - 4) : '3_' + (n - 8)) : 'Spare';
    W(no, src + ':' + no, '-IO2:' + n, Object.assign(P(0.75, 'BU', 'ctrl_dc', '', n <= 8 ? 9 : 10, 'H05V-K'), { d: lbl + ' → כניסה 2.' + n }));
  }
  /* עמודים 11–12: כרטיס כניסות 3 (לחצני חירום) */
  for (n = 1; n <= 15; n++) W(300 + n, '-XES:ES' + n + '.2', '-IO3:' + n, Object.assign(P(0.75, 'BU', 'ctrl_dc', '', n <= 8 ? 11 : 12, 'H05V-K'), { d: 'Emergency stop ' + n + ' נלחץ → כניסה 3.' + n }));
  W(316, '-XSPR:316', '-IO3:16', Object.assign(P(0.75, 'BU', 'ctrl_dc', '', 12, 'H05V-K'), { d: 'SPARE → כניסה 3.16' }));
  /* עמודים 13–14: כרטיס יציאות 4 */
  var coil = [['-RF', 1, 'TURN OFF Cabinet fan'], ['-RSW1', 2, 'TURN OFF Ethernet Switch 1'], ['-RSW2', 3, 'TURN OFF Ethernet Switch 2'], ['-RD1', 4, 'OPEN Door 1'], ['-RD2', 5, 'OPEN Door 2'], ['-RG1O', 6, 'Open Gate 1'], ['-RG1C', 7, 'Close Gate 1'], ['-RG2O', 8, 'OPEN GATE 2'], ['-RG2C', 9, 'CLOSE GATE 2'], ['-RTEL', 10, 'RESET TELTONIKA'], ['-RM', 12, 'TURN OFF MONITOR']];
  coil.forEach(function (c) { W(400 + c[1], '-IO4:' + c[1], c[0] + ':A1', Object.assign(P(0.75, 'BU', 'ctrl_dc', '', c[1] <= 8 ? 13 : 14, 'H05V-K'), { d: c[2] + ' — יציאה 4.' + c[1] + ' לסליל ' + c[0] })); });
  [[13, 'MAIN PANEL GREEN LED'], [14, 'MAIN PANEL LED RED'], [15, 'Buzzer MAIN PANEL']].forEach(function (x) { W(400 + x[0], '-IO4:' + x[0], '-XMP:' + (400 + x[0]), Object.assign(P(0.75, 'BU', 'ctrl_dc', '', 14, 'H05V-K'), { d: x[1] + ' — יציאה 4.' + x[0] })); });
  /* עמודים 15–16: כרטיס יציאות 5 */
  for (n = 1; n <= 16; n++) {
    var dst = n <= 4 ? '-XSR' : n <= 8 ? '-XSL' : n <= 12 ? '-XST' : n <= 14 ? '-XSP' : '-XLT';
    var lb = n <= 12 ? 'To Scanner ' + (n <= 4 ? '1_' + n : n <= 8 ? '2_' + (n - 4) : '3_' + (n - 8)) : ['Sec. panel green light', 'Sec. panel red light', 'Green Traffic light 1', 'Red Traffic light 1'][n - 13];
    W(500 + n, '-IO5:' + n, dst + ':' + (500 + n), Object.assign(P(0.75, 'BU', 'ctrl_dc', '', n <= 8 ? 15 : 16, 'H05V-K'), { d: lb + ' — יציאה 5.' + n }));
  }
  /* עמודים 17–18: כרטיס יציאות 6 */
  W(601, '-IO6:1', '-TB:IN1', Object.assign(P(0.75, 'BU', 'ctrl_dc', '', 17, 'H05V-K'), { d: 'Tibbo in 1 — watch dog' }));
  W(602, '-IO6:2', '-TB:IN2', Object.assign(P(0.75, 'BU', 'ctrl_dc', '', 17, 'H05V-K'), { d: 'Tibbo in 2 — reset' }));
  W(603, '-IO6:3', '-RG1S:A1', Object.assign(P(0.75, 'BU', 'ctrl_dc', '', 17, 'H05V-K'), { d: 'STOP GATE 1 — יציאה 6.3' }));
  W(604, '-IO6:4', '-RG2S:A1', Object.assign(P(0.75, 'BU', 'ctrl_dc', '', 17, 'H05V-K'), { d: 'STOP GATE 2 — יציאה 6.4' }));
  for (n = 5; n <= 8; n++) W(600 + n, '-IO6:' + n, '-XSPR:' + (600 + n), Object.assign(P(0.75, 'BU', 'ctrl_dc', '', 17, 'H05V-K'), { d: 'Spare — יציאה 6.' + n }));
  for (n = 9; n <= 16; n++) W(600 + n, '-IO6:' + n, '-XDP:' + (600 + n), Object.assign(P(0.75, 'BU', 'ctrl_dc', '', 18, 'H05V-K'), { d: 'LED ' + (n - 8) + ' — יציאה 6.' + n }));
  /* עמודים 19–20: כרטיס יציאות 7 */
  for (n = 1; n <= 10; n++) W(700 + n, '-IO7:' + n, '-XDP:' + (700 + n), Object.assign(P(0.75, 'BU', 'ctrl_dc', '', n <= 8 ? 19 : 20, 'H05V-K'), { d: 'LED ' + (n + 8) + ' — יציאה 7.' + n }));
  W(711, '-IO7:11', '-RLD19:A1', Object.assign(P(0.75, 'BU', 'ctrl_dc', '', 20, 'H05V-K'), { d: 'LED 19 — סליל RLD19' }));
  for (n = 12; n <= 16; n++) W(700 + n, '-IO7:' + n, '-XSPR:' + (700 + n), Object.assign(P(0.75, 'BU', 'ctrl_dc', '', 20, 'H05V-K'), { d: 'Spare — יציאה 7.' + n }));
  /* חזרות הסלילים: גשר A2 בין בסיסי הממסרים */
  var a2 = ['-RF', '-RSW1', '-RSW2', '-RD1', '-RD2', '-RG1O', '-RG1C', '-RG2O', '-RG2C', '-RTEL', '-RM', '-RG1S', '-RG2S', '-RLD19'];
  p0(a2[0] + ':A2', 'חזרת סלילי הממסרים (0V)', 13);
  for (n = 1; n < a2.length; n++) W('0V', a2[n - 1] + ':A2', a2[n] + ':A2', Object.assign(P(0.75, 'WHBU', 'dc0', '0V', 13, 'גשר בסיסי ממסרים'), { d: 'גשר 0V בין הסלילים' }));
  /* עמוד 3: מגעים יבשים לשערים ולדלתות — מתח של בקר השער, לכן כתום (מתח זר) */
  var dry = function (no, a, b, pg, d) { W(no, a, b, Object.assign(P(0.75, 'OG', 'foreign', '', pg || 3, 'H05V-K'), { d: d })); };
  dry('G2O1', '-RG2O:11', '-XG2:G2O1', 3, 'OPEN GATE 2 — מגע יבש'); dry('G2O2', '-RG2O:14', '-XG2:G2O2', 3, 'OPEN GATE 2 — מגע יבש');
  dry('G2C1', '-RG2C:11', '-XG2:G2C1', 3, 'CLOSE GATE 2 — מגע יבש'); dry('G2C2', '-RG2C:14', '-XG2:G2C2', 3, 'CLOSE GATE 2 — מגע יבש');
  dry('D1.1', '-RD1:14', '-XD1:D1.1', 3, 'OPEN DOOR 1 — דרך RD1 ו-RPLT בטור'); dry('PLT12', '-RD1:11', '-RPLT:14', 3, 'נעילה: דלת 1 נפתחת רק כשהמשטח למעלה'); dry('D1.2', '-RPLT:13', '-XD1:D1.2', 3, 'OPEN DOOR 1');
  dry('D2.1', '-RD2:14', '-XD2:D2.1', 3, 'OPEN DOOR 2 — מגע יבש'); dry('D2.2', '-RD2:11', '-XD2:D2.2', 3, 'OPEN DOOR 2 — מגע יבש');
  dry('G1O1', '-RG1O:14', '-XG1:G1O1', 3, 'OPEN GATE 1 — דרך RG1O ו-RPLT בטור'); dry('PLT22', '-RG1O:11', '-RPLT:24', 3, 'נעילה: שער 1 נפתח רק כשהמשטח למעלה'); dry('G1O2', '-RPLT:23', '-XG1:G1O2', 3, 'OPEN GATE 1');
  dry('G1C1', '-RG1C:14', '-XG1:G1C1', 3, 'CLOSE GATE 1 — מגע יבש'); dry('G1C2', '-RG1C:11', '-XG1:G1C2', 3, 'CLOSE GATE 1 — מגע יבש');
  dry('G1S1', '-RG1S:11', '-XG1:G1S1', 3, 'STOP GATE 1 — מגע יבש'); dry('G1S2', '-RG1S:14', '-XG1:G1S2', 3, 'STOP GATE 1 — מגע יבש');
  dry('G2S1', '-RG2S:11', '-XG2:G2S1', 3, 'STOP GATE 2 — מגע יבש'); dry('G2S2', '-RG2S:14', '-XG2:G2S2', 3, 'STOP GATE 2 — מגע יבש');
  W('24G', '-PS2:+', '-RLD19:11', Object.assign(P(0.75, 'BU', 'ctrl_dc', '24G', 3, 'H05V-K'), { d: '24G מ-PS2 למגע RLD19' }));
  W('LD19', '-RLD19:14', '-XDP:LD19', Object.assign(P(0.75, 'BU', 'ctrl_dc', '24G', 3, 'H05V-K'), { d: 'LED 19 בפאנל הכיוונים' }));
  /* 12V: מסך וקוראי כרטיסים (עמודים 1, 26) */
  W('12T', '-X12:2', '-RM:11', Object.assign(P(0.75, 'BU', 'ctrl_dc', '12T', 1, 'H05V-K'), { d: '12T אל מגע כיבוי המסך' }));
  W('M+', '-RM:12', '-XMP:M+', Object.assign(P(0.75, 'BU', 'ctrl_dc', '12T', 1, 'H05V-K'), { d: 'הזנת המסך (M+)' }));
  p0('-XMP:M-', 'M− של המסך', 1);
  W('12T', '-X12:3', '-XMP:12T', Object.assign(P(0.75, 'BU', 'ctrl_dc', '12T', 26, 'H05V-K'), { d: '12T לקורא כרטיסים 1' }));
  W('12T', '-X12:1', '-TB:12V', Object.assign(P(0.75, 'BU', 'ctrl_dc', '12T', 26, 'H05V-K'), { d: '12V ל-Tibbo' }));
  W('12R', '-PS4:+', '-XSP:12R', Object.assign(P(0.75, 'BU', 'ctrl_dc', '12R', 26, 'H05V-K'), { d: '12R לקורא כרטיסים 2' }));
  p0('-TB:0V', '0V ל-Tibbo', 26);
  W('0V', '-TB:0V', '-TB:5', Object.assign(P(0.75, 'WHBU', 'dc0', '0V', 26, 'H05V-K'), { d: '0V להדק 5 של Tibbo' }));
  W('0V', '-TB:5', '-TB:C1', Object.assign(P(0.75, 'WHBU', 'dc0', '0V', 26, 'H05V-K'), { d: 'משותף הכניסות in1' }));
  W('0V', '-TB:C1', '-TB:C3', Object.assign(P(0.75, 'WHBU', 'dc0', '0V', 26, 'H05V-K'), { d: 'משותף הכניסות in2' }));
  W('T1', '-TB:GR1', '-XMP:T1', Object.assign(P(0.75, 'WH', 'signal', '', 26, 'LiYCY'), { d: 'נתוני קורא 1 (GR)' }));
  W('T2', '-TB:WY2', '-XMP:T2', Object.assign(P(0.75, 'WH', 'signal', '', 26, 'LiYCY'), { d: 'נתוני קורא 1 (WH+YL)' }));
  W('T11', '-TB:GR6', '-XSP:T11', Object.assign(P(0.75, 'WH', 'signal', '', 26, 'LiYCY'), { d: 'נתוני קורא 2 (GR)' }));
  W('T12', '-TB:WY7', '-XSP:T12', Object.assign(P(0.75, 'WH', 'signal', '', 26, 'LiYCY'), { d: 'נתוני קורא 2 (WH+YL)' }));
  p0('-XMP:0V', '0V לקורא כרטיסים 1', 26);
  p0('-XSP:0V', '0V לקורא כרטיסים 2', 26);
  p24('-TB:6', '+24', '‎+24V לממסר 1 של Tibbo', 26);
  p24('-TB:8', '+24', '‎+24V לממסר 2 של Tibbo', 26);
  W('T2Q', '-TB:9', '-RTEL:A1', Object.assign(P(0.75, 'BU', 'ctrl_dc', '', 26, 'H05V-K'), { d: 'Tibbo מאפס את Teltonika (במקביל ליציאה 4.10)' }));
  /* ‎+24V ו-0V לשטח */
  [['-XG1', 3], ['-XG2', 3], ['-XD1', 3], ['-XD2', 3], ['-XSR', 9], ['-XSL', 9], ['-XST', 10]].forEach(function (x) {
    p24(x[0] + ':+24V', '+24', '‎+24V לשטח (' + x[0] + ')', x[1]);
    p0(x[0] + ':0V', '0V לשטח (' + x[0] + ')', x[1]);
  });
  p24('-XMP:24V', '+24', '‎+24V ללחצן הירוק בפאנל הראשי', 14);
  p0('-XMP:0V/2', '0V לנורית האדומה', 14);
  p0('-XMP:0V/3', '0V לזמזם', 14);
  p0('-XSP:0V/2', '0V לנורית הירוקה בפאנל המשני', 16);
  p0('-XSP:0V/3', '0V לנורית האדומה בפאנל המשני', 16);
  p0('-XLT:0V', '0V לרמזור ירוק', 16);
  p0('-XLT:0V/2', '0V לרמזור אדום', 16);
  p0('-XDP:0V', '0V משותף לפאנל הכיוונים', 20);
  /* שרשרת לחצני החירום (עמודים 21–22) */
  p24('-XES:ES1.1', '+24', '‎+24V לתחילת שרשרת החירום (X1)', 21);
  for (n = 1; n < 15; n++) W('ES' + (n + 1) + '.1', '-XES:ES' + n + '.3', '-XES:ES' + (n + 1) + '.1', Object.assign(P(0.75, 'BU', 'ctrl_dc', '', n < 5 ? 21 : 22, 'H05V-K'), { d: 'גשר בשרשרת: חירום ' + n + ' → חירום ' + (n + 1) }));
  /* גשרי מסרק בפסי החלוקה */
  for (n = 1; n < t24; n++) W('+24', '-X24:' + n, '-X24:' + (n + 1), Object.assign(P(1.5, 'BU', 'ctrl_dc', '+24V', 4, 'גשר מסרק'), { d: 'גשר ‎+24V' }));
  for (n = 1; n < t0; n++) W('0V', '-X0V:' + n, '-X0V:' + (n + 1), Object.assign(P(1.5, 'WHBU', 'dc0', '0V', 1, 'גשר מסרק'), { d: 'גשר 0V' }));
  /* רשת (עמודים 23–25): כבלי Cat6 */
  var cat = function (a, b, d) { W('CAT6', a, b, Object.assign(P(0.25, 'VT', 'comm', '', 24, 'Cat6 S/FTP'), { d: d })); };
  cat('-SW1:X3', '-A1:X001', 'מתג 1 → בקר X001');
  cat('-SW1:X1', '-TB:LAN', 'מתג 1 → Tibbo');
  cat('-SW2:X3', '-A1:X000', 'מתג 2 → בקר X000');
  cat('-SW2:X2', '-SW3:LAN1', 'מתג 2 → Teltonika LAN1');
  cat('-EK1:X1', '-XRJ:C1', 'EtherCAT C1 Cabinet');
  cat('-EK1:X2', '-XRJ:C2', 'EtherCAT C2 Cabinet');
  cat('-EK2:X1', '-XRJ:E1', 'EtherCAT E1 Cabinet');
  cat('-EK2:X2', '-XRJ:E2', 'EtherCAT E2 Cabinet');

  /* ---------- כבלים לשטח ---------- */
  var core = ['WH', 'BN', 'GN', 'YE', 'GY', 'PK', 'BU', 'RD', 'BK', 'VT', 'GY', 'RD', 'WH', 'BN', 'GN', 'YE', 'GY', 'PK', 'BU', 'RD'];
  var cable = function (strip, dev, pairs, type, sec, pg, func) {
    pairs.forEach(function (pr, i) {
      W(pr[0], strip + ':' + pr[0], dev + ':' + pr[1], { c: pr[2] || core[i % core.length], s: sec, f: pr[3] || func || '', t: type, pg: pg, d: 'כבל ' + type + ', גיד ' + (i + 1) });
    });
  };
  cable('-XMG1', '-GATE1', [['R', 'L1', 'BN', 'power'], ['S', 'L2', 'BK', 'power'], ['T', 'L3', 'GY', 'power'], ['N', 'N', 'LBU', 'neutral'], ['PE', 'PE', 'GNYE', 'pe']], 'NYY 5×2.5', 2.5, 2);
  cable('-XMG2', '-GATE2', [['R', 'L1', 'BN', 'power'], ['S', 'L2', 'BK', 'power'], ['T', 'L3', 'GY', 'power'], ['N', 'N', 'LBU', 'neutral'], ['PE', 'PE', 'GNYE', 'pe']], 'NYY 5×2.5', 2.5, 2);
  cable('-XG1', '-GATE1', [['G1O1', 'OPEN-A', 0, 'foreign'], ['G1O2', 'OPEN-B', 0, 'foreign'], ['G1C1', 'CLOSE-A', 0, 'foreign'], ['G1C2', 'CLOSE-B', 0, 'foreign'], ['G1S1', 'STOP-A', 0, 'foreign'], ['G1S2', 'STOP-B', 0, 'foreign'], ['105', 'OPENED'], ['106', 'CLOSED'], ['109', 'GUARD'], ['+24V', '+24V'], ['0V', '0V', 0, 'dc0']], 'LiYY 12×0.75', 0.75, 3, 'ctrl_dc');
  cable('-XG2', '-GATE2', [['G2O1', 'OPEN-A', 0, 'foreign'], ['G2O2', 'OPEN-B', 0, 'foreign'], ['G2C1', 'CLOSE-A', 0, 'foreign'], ['G2C2', 'CLOSE-B', 0, 'foreign'], ['G2S1', 'STOP-A', 0, 'foreign'], ['G2S2', 'STOP-B', 0, 'foreign'], ['107', 'OPENED'], ['108', 'CLOSED'], ['+24V', '+24V'], ['0V', '0V', 0, 'dc0']], 'LiYY 12×0.75', 0.75, 3, 'ctrl_dc');
  cable('-XD1', '-DOOR1', [['D1.1', 'OPEN-A', 0, 'foreign'], ['D1.2', 'OPEN-B', 0, 'foreign'], ['103', 'CLOSED'], ['+24V', '+24V'], ['0V', '0V', 0, 'dc0']], 'LiYY 7×0.75', 0.75, 3, 'ctrl_dc');
  cable('-XD2', '-DOOR2', [['D2.1', 'OPEN-A', 0, 'foreign'], ['D2.2', 'OPEN-B', 0, 'foreign'], ['104', 'CLOSED'], ['+24V', '+24V'], ['0V', '0V', 0, 'dc0']], 'LiYY 7×0.75', 0.75, 3, 'ctrl_dc');
  cable('-XPUP', '-SP', [['+24V', '1'], ['PLT', '2']], 'LiYY 3×0.75', 0.75, 4, 'ctrl_dc');
  cable('-XEN', '-EN', [['E+1', 'E+1'], ['E-1', 'E-1', 0, 'dc0'], ['E+2', 'E+2'], ['E-2', 'E-2', 0, 'dc0'], ['E+3', 'E+3'], ['E-3', 'E-3', 0, 'dc0'], ['E+4', 'E+4'], ['E-4', 'E-4', 0, 'dc0']], 'LiYCY 8×0.75', 0.75, 5, 'ctrl_dc');
  [['-XSR', '-SCR', 201, 501], ['-XSL', '-SCL', 205, 505], ['-XST', '-SCT', 209, 509]].forEach(function (s) {
    var pr = [];
    for (var k = 0; k < 4; k++) pr.push([String(s[2] + k), 'OUT' + (k + 1)]);
    for (k = 0; k < 4; k++) pr.push([String(s[3] + k), 'IN' + (k + 1)]);
    pr.push(['+24V', '+24V', 'BN'], ['0V', '0V', 'BU', 'dc0']);
    cable(s[0], s[1], pr, 'SICK I/O 12×0.25', 0.25, 9, 'ctrl_dc');
  });
  for (n = 1; n <= 15; n++) {
    var pg = n <= 5 ? 21 : 22;
    W('ES' + n + '.1', '-XES:ES' + n + '.1', '-ES' + n + ':11', { c: 'BN', s: 0.75, f: 'ctrl_dc', t: 'LiYY 3×0.75', pg: pg, d: 'כניסת השרשרת ללחצן ' + n });
    W('ES' + n + '.2', '-ES' + n + ':14', '-XES:ES' + n + '.2', { c: 'WH', s: 0.75, f: 'ctrl_dc', t: 'LiYY 3×0.75', pg: pg, d: 'מגע NO — הלחצן נלחץ' });
    W('ES' + n + '.3', '-ES' + n + ':12', '-XES:ES' + n + '.3', { c: 'GN', s: 0.75, f: 'ctrl_dc', t: 'LiYY 3×0.75', pg: pg, d: 'המשך השרשרת (NC)' });
    W('ES' + n + '.1', '-ES' + n + ':11', '-ES' + n + ':13', { c: 'BN', s: 0.75, f: 'ctrl_dc', t: 'גשר בתוך הלחצן', pg: pg, d: 'גשר 11-13 בתוך תיבת הלחצן' });
  }
  cable('-XMP', '-MP', [['T1', 'T1-GR'], ['T2', 'T2-WHYL'], ['12T', '12V'], ['0V', '0V', 0, 'dc0'], ['M+', 'M+'], ['M-', 'M-', 0, 'dc0'], ['413', 'LED-G'], ['24V', 'BTN-COM'], ['112', 'BTN-G'], ['414', 'LED-R'], ['0V/2', 'LED-R0V', 0, 'dc0'], ['415', 'BUZ'], ['0V/3', 'BUZ0V', 0, 'dc0']], 'LiYCY 14×0.75', 0.75, 14, 'ctrl_dc');
  cable('-XSP', '-SEC', [['12R', '12V'], ['0V', '0V', 0, 'dc0'], ['T11', 'T11-GR'], ['T12', 'T12-WHYL'], ['513', 'LED-G'], ['0V/2', 'LED-G0V', 0, 'dc0'], ['514', 'LED-R'], ['0V/3', 'LED-R0V', 0, 'dc0']], 'LiYCY 8×0.75', 0.75, 16, 'ctrl_dc');
  cable('-XLT', '-LT', [['515', 'GREEN'], ['0V', 'G-0V', 0, 'dc0'], ['516', 'RED'], ['0V/2', 'R-0V', 0, 'dc0']], 'LiYY 4×0.75', 0.75, 16, 'ctrl_dc');
  var dp = [];
  for (n = 609; n <= 616; n++) dp.push([String(n), 'LED' + (n - 608)]);
  for (n = 701; n <= 710; n++) dp.push([String(n), 'LED' + (n - 692)]);
  dp.push(['LD19', 'LED19'], ['0V', 'COM', 0, 'dc0']);
  cable('-XDP', '-DP', dp, 'LiYY 25×0.75', 0.75, 18, 'ctrl_dc');
  cable('-XTL', '-PDC', [['+24V', '1'], ['110', '2']], 'LiYY 3×0.75', 0.75, 8, 'ctrl_dc');

  var NOTES = [
    'התכנית 208-B נקראה עמוד אחרי עמוד (28 עמודים). מספרי החוטים, ההדקים והרכיבים הם מהשרטוט. חוטים בלי מספר בשרטוט קיבלו את שם הפוטנציאל (‎+24, 0V, L1…).',
    'בשרטוט אין צבעים וחתכים (רק מהדקי PT 1.5). הם נקבעו לפי תקנות החשמל, ת"י 61439 ו-IEC 60204-1 / IEC 60445, ומסומנים בכוכבית. יש לאשר מול מהנדס החשמל של הפרויקט.',
    'חתכים: הזנה וגישורי כניסות המאמ"תים 4 ממ"ר (ההגנה שלפניהם היא 20A בלוח A, ו-S0 הוא 25A); יציאות 16A (שערים ושקעים) 2.5 ממ"ר; מעגלי 6A (ספקים, מאוורר) 1.5 ממ"ר, המינימום למעגל כוח 230V; יציאות הספקים 1.5 ממ"ר; פיקוד 0.75 ממ"ר H05V-K (מתאים למהדקי PT 1.5).',
    'צבעים: L1 חום, L2 שחור, L3 אפור, אפס כחול בהיר, הארקה ירוק-צהוב בלבד (IEC 60445). פיקוד ‎+24V/12V כחול כהה, 0V לבן-כחול, ומגעים יבשים לשערים ולדלתות כתום — הם נושאים מתח של בקר השער ונשארים חיים כשמפסק הארון מנותק (IEC 60204-1 סעיף 13.2.4).',
    'השקעים N3: בשרטוט מצוירת רק הפאזה. הוספו אפס והארקה בחתך 2.5 ממ"ר — חובה לפי התקנות. השקעים מוגנים בפחת 30mA (FB101).',
    'סדר ההזנה בשרטוט: מהדקי S0 → מפסק ראשי S0 (3 קטבים) → פחת FB101 (4 קטבים). האפס לא עובר במפסק הראשי.',
    'הבקר CX2020 מותקן על ספייסר 50 מ"מ (הערה בעמוד 23). כרטיסי EL1809/EL2809 מקבלים מתח דרך מגעי הכוח של CX2100 (24PLC דרך מגע RPLC).',
    'מומלץ: לחבר את ה-0V של הפיקוד להארקה בנקודה אחת (PELV, IEC 60204-1 סעיף 9.4.3), ולהוסיף מאמ"ת או נתיך אלקטרוני ביציאת PS1 לחלוקת ‎+24V לשטח. שני אלה לא מופיעים בשרטוט.',
    'חוק החשמל: הלוח מורכב ומחובר בידי חשמלאי בעל רישיון מתאים, ונבדק לפני הפעלה (בידוד, רציפות הארקה, פחת). לצרף תעודת בדיקה ותכנית מעודכנת בכיס הדלת.'
  ];

  /* הארון כפי שהוא מוגדר בשרטוטים: בלוק הבקר (עמוד 23), רשימת המהדקים (עמוד 27) ופלטת האנטיגרונים (עמוד 28).
     רכיבים שהשרטוטים לא ממקמים (מפסקים, ספקים, ממסרים) נכנסים לפי ההמלצה ומסומנים. */
  var LAYOUT = {
    source: 'drawing', pages: [23, 27, 28], enclosure: null,
    rails: [
      { label: 'בקר Beckhoff ו-I/O — עמוד 23 (על ספייסר 50 מ"מ)', spacer: 50, tags: ['-A1', '-IO1', '-IO2', '-IO3', '-IO4', '-IO5', '-IO6', '-IO7', '-EK1', '-EK2'] },
      { label: 'מהדקים, שורה 1 — עמוד 27', spacer: 0, tags: ['-XS', '-XUPS', '-XMG1', '-XMG2', '-XG1', '-XG2', '-XD1', '-XD2', '-XEN', '-XPUP'] },
      { label: 'מהדקים, שורה 2 — עמוד 27', spacer: 0, tags: ['-XSR', '-XSL', '-XST', '-XES'] },
      { label: 'מהדקים, שורה 3 — עמוד 27', spacer: 0, tags: ['-XMP', '-XSP', '-XLT', '-XDP', '-XSPR'] },
      { label: 'Teltonika ושקעי RJ45 על פס DIN — עמוד 27', spacer: 0, tags: ['-XTL', '-XRJ'] }
    ],
    door: [],
    termOrder: {
      '-XS': ['R', 'S', 'T', 'N', 'PE'],
      '-XUPS': ['UPS1', 'UPS2', 'UPS1N', 'UPS2N'],
      '-XMG1': ['R', 'S', 'T', 'N', 'PE'],
      '-XMG2': ['R', 'S', 'T', 'N', 'PE'],
      '-XG1': ['G1O1', 'G1O2', 'G1C1', 'G1C2', 'G1S1', 'G1S2', '105', '106', '109', '+24V', '0V'],
      '-XG2': ['G2O1', 'G2O2', 'G2C1', 'G2C2', 'G2S1', 'G2S2', '107', '108', '+24V', '0V'],
      '-XD1': ['D1.1', 'D1.2', '103', '+24V', '0V'],
      '-XD2': ['D2.1', 'D2.2', '104', '+24V', '0V'],
      '-XEN': ['E+1', 'E-1', 'E+2', 'E-2', 'E+3', 'E-3', 'E+4', 'E-4'],
      '-XPUP': ['+24V', '0V', 'PLT'],
      '-XSR': ['201', '202', '203', '204', '501', '502', '503', '504', '+24V', '0V'],
      '-XSL': ['205', '206', '207', '208', '505', '506', '507', '508', '+24V', '0V'],
      '-XST': ['209', '210', '211', '212', '509', '510', '511', '512', '+24V', '0V'],
      '-XES': (function () { var a = []; for (var i = 1; i <= 15; i++) a.push('ES' + i + '.1', 'ES' + i + '.2', 'ES' + i + '.3'); return a; })(),
      '-XMP': ['T1', 'T2', '12T', '0V', 'M+', 'M-', '413', '0V/2', '24V', '112', '414', '0V/3', '415'],
      '-XSP': ['12R', '0V', 'T11', 'T12', '513', '0V/2', '514', '0V/3'],
      '-XLT': ['515', '0V', '516', '0V/2'],
      '-XDP': ['609', '610', '611', '612', '613', '614', '615', '616', '701', '702', '703', '704', '705', '706', '707', '708', '709', '710', 'LD19', '0V'],
      '-XSPR': ['113', '114', '115', '116', '213', '214', '215', '216', '316', '605', '606', '607', '608', '712', '713', '714', '715', '716'],
      '-XTL': ['110', '+24V', 'TL1', '0V'],
      '-XRJ': ['C1', 'C2', 'E1', 'E2']
    },
    glands: [
      { label: 'S0 — הזנה', size: 'PG21', row: 1 }, { label: 'MG1', size: 'PG21', row: 1 }, { label: 'Gate 1', size: 'PG16', row: 1 }, { label: 'D1', size: 'PG13.5', row: 1 },
      { label: 'Enable', size: 'PG11', row: 1 }, { label: 'Enable', size: 'PG11', row: 1 }, { label: 'Scan R', size: 'PG11', row: 1 }, { label: 'Scan T', size: 'PG11', row: 1 },
      { label: 'ES1', size: 'PG11', row: 1 }, { label: 'ES3', size: 'PG11', row: 1 }, { label: 'ES5', size: 'PG11', row: 1 }, { label: 'ES7', size: 'PG11', row: 1 },
      { label: 'Main Customer Panel', size: 'PG16', row: 1 }, { label: 'Secondary Customer Panel', size: 'PG16', row: 1 }, { label: 'Direction Panel', size: 'PG16', row: 1 },
      { label: 'CAT6 C1', size: 'PG11', row: 1 }, { label: 'CAT6 E1', size: 'PG11', row: 1 }, { label: 'רזרבה', size: 'PG11', row: 1 }, { label: 'רזרבה', size: 'PG11', row: 1 },
      { label: 'רזרבה', size: 'PG21', row: 2 }, { label: 'MG2', size: 'PG21', row: 2 }, { label: 'Gate 2', size: 'PG16', row: 2 }, { label: 'D2', size: 'PG13.5', row: 2 },
      { label: 'Enable', size: 'PG11', row: 2 }, { label: 'Enable', size: 'PG11', row: 2 }, { label: 'PUP', size: 'PG11', row: 2 }, { label: 'Scan L', size: 'PG11', row: 2 },
      { label: 'ES2', size: 'PG11', row: 2 }, { label: 'ES4', size: 'PG11', row: 2 }, { label: 'ES6', size: 'PG11', row: 2 }, { label: 'ES8', size: 'PG11', row: 2 },
      { label: 'Main Customer Panel', size: 'PG13.5', row: 2 }, { label: 'Light Tower', size: 'PG11', row: 2 }, { label: 'רזרבה', size: 'PG11', row: 2 },
      { label: 'CAT6 C2', size: 'PG11', row: 2 }, { label: 'CAT6 E2', size: 'PG11', row: 2 }, { label: 'רזרבה', size: 'PG11', row: 2 }, { label: 'רזרבה', size: 'PG11', row: 2 }
    ],
    notes: 'הבקר מותקן על ספייסר של 50 מ"מ (עמוד 23). מהדקי פיקוד: PT 1.5 של Phoenix Contact (עמוד 27). ‎-XSPR (מהדקי הרזרבה) מפוזר בשרטוט בשלוש השורות — כאן הוא פס אחד בסוף שורה 3.'
  };

  function project() {
    return {
      name: '208-B · B CABINET · הגדוד העברי 53',
      source: 'library',
      meta: { title: 'B CABINET — הגדוד העברי 53', drawingNo: '208-B', revision: '1 (27.10.19, FOR CONSTRUCTION)', supply: '3×400V+N+PE 20A (לוח A, מעגל F50)', control: '24VDC / 12VDC', notes: 'שקמה · תכנון SA 24.06.19' },
      components: JSON.parse(JSON.stringify(comps)),
      wires: JSON.parse(JSON.stringify(wires)),
      notes: NOTES.slice(),
      settings: { control: 'dc24', phaseColors: 'iec60445', termTech: 'pushin', plateWidth: 1100, powerSection: 2.5, controlSection: 0.75, peSection: 2.5 },
      layoutPlan: JSON.parse(JSON.stringify(LAYOUT))
    };
  }

  return { id: '208-B', title: 'תכנית 208-B · B CABINET', matches: matches, project: project };
});
