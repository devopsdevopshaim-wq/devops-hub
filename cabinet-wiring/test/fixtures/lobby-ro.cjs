// חלק מתכנית L-RO (ארון לובי עם גג, פרקומט) — לפי רשימת החיבורים (עמ' 21-26): שער קדמי, ממסרי ההיתר RS1/RS2
// שהסלילים שלהם מוזנים ממסרי הבטיחות SR3 ("מעלית ב0") ו-SR2 ("גג סגור"), ושרשרת ה-STO של השער. לבדיקות של שאלות תכנון.
module.exports = function project() {
  const comps = [
    ['-XS1', 'terminal', 'מהדקי הזנה 24V / 0V'],
    ['-X5', 'terminal', 'מהדקי שערים'],
    ['-PLC1.1', 'io', 'Digital Inputs, 16pt, 24VDC', 'GT-12DF'],
    ['-PLC1.3', 'io', '16 Channels, Source Output Terminal, 24Vdc/0.3A', 'GT-226F'],
    ['-R1', 'relay', 'שער קדמי סגירה (Relay Module)', '2900299'],
    ['-R2', 'relay', 'שער קדמי פתיחה (Relay Module)', '2900299'],
    ['-RS1', 'relay', 'Single relay REL-IR4/LDP-24DC/4X21AU', '2903670'],
    ['-RS2', 'relay', 'Single relay REL-IR4/LDP-24DC/4X21AU', '2903670'],
    ['-SR3', 'relay', 'Safety relays RLY3-OSSD200 SICK', '1085344'],
    ['-SR2', 'relay', 'Safety relays RLY3-OSSD400 SICK', '1099971'],
    ['-R17', 'relay', 'ספייר', '2900299']
  ].map(([tag, type, name, partNo]) => ({ tag, type, name, partNo: partNo || '', location: 'cabinet' }));
  const W = (no, a, b, desc, page, color) => ({ no, from: { tag: a.split(':')[0], term: a.split(':')[1] }, to: { tag: b.split(':')[0], term: b.split(':')[1] }, desc: desc || '', page, color: color || '' });
  const wires = [
    W('24V+', '-SR3:1', '-XS1:24V', '', 21, 'RD'),
    W('24V+', '-SR3:3', '-XS1:24V', '', 21, 'RD'),
    W('24V+', '-SR2:5', '-XS1:24V', '', 21, 'RD'),
    W('24V+', '-SR2:7', '-XS1:24V', '', 21, 'RD'),
    W('I1.0', '-PLC1.1:8', '-SR3:13', 'מעלית ב0', 21, 'GY'),
    W('I1.1', '-PLC1.1:9', '-SR2:11', 'גג סגור', 21, 'GY'),
    W('Q1.0', '-PLC1.3:0', '-R1:A1', 'שער קדמי סגירה', 22, 'GN'),
    W('Q1.1', '-PLC1.3:1', '-R2:A1', 'שער קדמי פתיחה', 22, 'GN'),
    W('X5.1', '-R1:14', '-X5:L1', '', 21, 'RD'),
    W('R1', '-R1:11', '-X5:L2', '', 22, 'PK'),
    W('R2', '-R2:11', '-X5:L3', '', 22, 'PK'),
    W('RS2', '-RS2:A1', '-SR3:4', '', 23, 'OG'),
    W('FGO1', '-RS2:11', '-X5:L4', '', 23, 'OG'),
    W('FGO2', '-RS1:11', '-RS2:14', '', 23, 'OG'),
    W('FGO3', '-RS1:14', '-X5:L5', '', 23, 'OG'),
    W('RS1', '-SR2:6', '-SR3:2', '', 23, 'OG'),
    W('RS1', '-RS1:A1', '-SR3:2', '', 23, 'OG'),
    W('RS2', '-SR2:8', '-SR3:4', '', 23, 'OG'),
    W('24V-', '-SR2:18', '-XS1:0V', '', 24, 'BK'),
    W('24V-', '-SR3:16', '-XS1:0V', '', 24, 'BK'),
    W('24V-', '-RS1:A2', '-XS1:0V', '', 24, 'BK'),
    W('24V-', '-R1:A2', '-XS1:0V', '', 24, 'BK'),
    W('גשר', '-R1:A2', '-R2:A2', '', 25, 'BU'),
    W('גשר', '-R1:14', '-R2:14', '', 25, 'RD'),
    W('24V-', '-RS1:A2', '-RS2:A2', '', 26, 'BK')
  ];
  return { name: 'L-RO · ארון לובי עם גג (קטע לבדיקה)', meta: { title: 'ארון לובי עם גג', drawingNo: 'L-RO' }, components: comps, wires, notes: [] };
};
