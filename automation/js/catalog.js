// Catalog: load types, manufacturers and drive families, fieldbus protocols, PLC platforms,
// per-manufacturer parameter numbers and Modbus register maps, and plant templates.
// Manufacturer data is a field reference; always confirm against the drive manual for the firmware in use.

export const APPLICATIONS = {
  pump: { he: 'משאבה צנטריפוגלית', torque: 'VT', duty: 'ND', accel: 10, decel: 10, fmin: 25, fmax: 50, control: 'quadratic', energy: true, flying: false, brake: false },
  fan: { he: 'מפוח / מאוורר', torque: 'VT', duty: 'ND', accel: 20, decel: 30, fmin: 15, fmax: 50, control: 'quadratic', energy: true, flying: true, brake: false },
  compressor: { he: 'מדחס בורגי', torque: 'CT', duty: 'ND', accel: 10, decel: 10, fmin: 25, fmax: 50, control: 'vector', energy: true, flying: false, brake: false },
  conveyor: { he: 'מסוע', torque: 'CT', duty: 'HD', accel: 5, decel: 5, fmin: 5, fmax: 50, control: 'vector', energy: false, flying: false, brake: false },
  mixer: { he: 'מערבל / מגיס', torque: 'CT', duty: 'HD', accel: 10, decel: 10, fmin: 10, fmax: 50, control: 'vector', energy: false, flying: false, brake: false },
  hoist: { he: 'עגורן / הרמה', torque: 'CT', duty: 'HD', accel: 3, decel: 3, fmin: 2, fmax: 50, control: 'vector', energy: false, flying: false, brake: true },
  extruder: { he: 'אקסטרודר', torque: 'CT', duty: 'HD', accel: 15, decel: 15, fmin: 5, fmax: 50, control: 'vector', energy: false, flying: false, brake: false },
  centrifuge: { he: 'צנטריפוגה / אינרציה גבוהה', torque: 'CT', duty: 'HD', accel: 60, decel: 120, fmin: 5, fmax: 50, control: 'vector', energy: false, flying: true, brake: true },
  general: { he: 'כללי', torque: 'CT', duty: 'ND', accel: 10, decel: 10, fmin: 5, fmax: 50, control: 'vf', energy: false, flying: false, brake: false },
};

export const VOLTAGES = [230, 400, 480, 690];

// Standard drive power ladder (kW, normal duty).
export const DRIVE_KW = [0.37, 0.55, 0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75, 90, 110, 132, 160, 200, 250, 315, 355, 400, 450, 500, 560, 630, 710, 800];

// Typical IE3 4-pole motor efficiency and power factor by size.
export function motorData(kw) {
  const t = [[0.75, 0.825, 0.75], [1.5, 0.855, 0.79], [3, 0.876, 0.81], [5.5, 0.896, 0.83], [11, 0.914, 0.84], [22, 0.93, 0.85], [45, 0.941, 0.86], [90, 0.952, 0.87], [200, 0.96, 0.88], [1e9, 0.962, 0.88]];
  const r = t.find((x) => kw <= x[0]);
  return { eff: r[1], pf: r[2] };
}

export const PROTOCOLS = {
  modbus_rtu: { he: 'Modbus RTU (RS-485)', medium: 'rs485', topology: 'line', maxNodes: 31, profile: 'modbus', addr: 'slave' },
  modbus_tcp: { he: 'Modbus TCP', medium: 'ethernet', topology: 'star', profile: 'modbus', addr: 'ip' },
  profinet: { he: 'PROFINET', medium: 'ethernet', topology: 'ring', profile: 'profidrive', addr: 'ip+name' },
  ethernetip: { he: 'EtherNet/IP', medium: 'ethernet', topology: 'star', profile: 'odva', addr: 'ip' },
  ethercat: { he: 'EtherCAT', medium: 'ethernet', topology: 'line', profile: 'cia402', addr: 'position' },
  profibus: { he: 'PROFIBUS DP', medium: 'rs485', topology: 'line', maxNodes: 31, profile: 'profidrive', addr: 'slave' },
  canopen: { he: 'CANopen', medium: 'can', topology: 'line', maxNodes: 127, profile: 'cia402', addr: 'node' },
  bacnet_ip: { he: 'BACnet/IP', medium: 'ethernet', topology: 'star', profile: 'bacnet', addr: 'ip' },
  bacnet_mstp: { he: 'BACnet MS/TP', medium: 'rs485', topology: 'line', maxNodes: 31, profile: 'bacnet', addr: 'mac' },
};

export const PLCS = {
  generic: { he: 'כללי · IEC 61131-3 (CODESYS)', lang: 'ST', tips: 'הקוד בשפת Structured Text רץ בכל סביבה תומכת IEC 61131-3: CODESYS, TwinCAT, Sysmac ועוד.' },
  siemens: { he: 'Siemens S7-1200 / S7-1500 (TIA Portal)', lang: 'SCL', tips: 'PROFINET: מוסיפים את הממיר מקטלוג החומרה או מקובץ GSDML ובוחרים Standard Telegram 1. ב-TIA אפשר להשתמש גם בבלוק SINA_SPEED מספריית DriveLib. Modbus TCP: MB_CLIENT. Modbus RTU: מודול CM 1241 עם MB_COMM_LOAD ו-MB_MASTER.' },
  rockwell: { he: 'Rockwell ControlLogix / CompactLogix (Studio 5000)', lang: 'ST', tips: 'EtherNet/IP: מוסיפים את הממיר לעץ ה-I/O (קובץ EDS או Add-On Profile), RPI של 10–20 ms. ממירים שאינם Rockwell: Generic Ethernet Module, ‏Assembly 21/71. Modbus: הוראת MSG או מודול Gateway.' },
  schneider: { he: 'Schneider Modicon M241 / M251 / M580 (Machine Expert)', lang: 'ST', tips: 'Machine Expert מבוסס CODESYS. Modbus TCP: ‏IO Scanner. ‏ATV: ספריית GMC / ATV Library. ‏EtherNet/IP: מוסיפים קובץ EDS.' },
  omron: { he: 'Omron NX / NJ (Sysmac Studio)', lang: 'ST', tips: 'EtherCAT: מייבאים ESI ומשתמשים ב-PDO של CiA 402. ‏EtherNet/IP: Tag Data Link.' },
  mitsubishi: { he: 'Mitsubishi iQ-R / iQ-F (GX Works3)', lang: 'ST', tips: 'GX Works3 תומך ב-ST. ‏Modbus TCP/RTU: פונקציות SP.MODBUS או הגדרת Simple CPU Communication. ‏CC-Link IE עם ממירי Mitsubishi.' },
  beckhoff: { he: 'Beckhoff TwinCAT 3', lang: 'ST', tips: 'EtherCAT: סריקת רשת, ‏ESI של הממיר ו-PDO של CiA 402. ‏Modbus TCP: ספריית Tc2_ModbusSrv.' },
  abb_plc: { he: 'ABB AC500 (Automation Builder)', lang: 'ST', tips: 'מבוסס CODESYS. ‏Modbus TCP: ‏ETH_MOD_MAST. ‏PROFINET: מודול CM579-PNIO.' },
  unitronics: { he: 'Unitronics UniStream / Vision', lang: 'Ladder', tips: 'בממשק UniLogic: Modbus TCP/RTU דרך Protocol Configuration. מימוש הבלוק בסולם לפי הלוגיקה שבקוד.' },
  delta_plc: { he: 'Delta AS / DVP (ISPSoft)', lang: 'ST', tips: 'ISPSoft תומך ב-ST. ‏Modbus RTU מובנה עם ממירי Delta: הוראת MODRW.' },
};

// Option modules / embedded interfaces per manufacturer and protocol ('built-in', module name or null = via gateway).
const OPT = (o) => o;
export const BRANDS = {
  generic: {
    he: 'ממיר כללי (כל יצרן)', families: [{ name: 'ממיר תדר כללי', kw: [0.37, 800], use: 'all' }],
    comm: OPT({ modbus_rtu: 'built-in', modbus_tcp: 'כרטיס תקשורת', profinet: 'כרטיס תקשורת', ethernetip: 'כרטיס תקשורת', ethercat: 'כרטיס תקשורת', profibus: 'כרטיס תקשורת', canopen: 'כרטיס תקשורת', bacnet_ip: 'כרטיס תקשורת', bacnet_mstp: 'כרטיס תקשורת' }),
  },
  abb: {
    he: 'ABB', families: [
      { name: 'ACS180', kw: [0.25, 22], use: 'machinery' }, { name: 'ACS380', kw: [0.25, 22], use: 'machinery' },
      { name: 'ACH580 (HVAC)', kw: [0.75, 500], use: 'hvac' }, { name: 'ACQ580 (מים)', kw: [0.75, 500], use: 'water' },
      { name: 'ACS580', kw: [0.75, 500], use: 'general' }, { name: 'ACS880', kw: [0.55, 5600], use: 'industrial' }],
    comm: { modbus_rtu: 'built-in (EFB)', modbus_tcp: 'FMBT-21 / FENA-21', profinet: 'FPNO-21 / FENA-21', ethernetip: 'FEIP-21 / FENA-21', ethercat: 'FECA-01', profibus: 'FPBA-01', canopen: 'FCAN-01', bacnet_ip: 'FBIP-21', bacnet_mstp: 'built-in (ACH/ACQ)' },
  },
  siemens: {
    he: 'Siemens', families: [
      { name: 'SINAMICS V20', kw: [0.12, 30], use: 'machinery' }, { name: 'SINAMICS G120C', kw: [0.55, 132], use: 'general' },
      { name: 'SINAMICS G120X', kw: [0.75, 630], use: 'water' }, { name: 'SINAMICS G120 (CU240E-2)', kw: [0.55, 250], use: 'industrial' },
      { name: 'SINAMICS S120', kw: [1.6, 4500], use: 'motion' }],
    comm: { modbus_rtu: 'built-in (גרסת USS/MB)', modbus_tcp: 'Gateway', profinet: 'built-in (גרסת PN)', ethernetip: 'built-in (גרסת PN)', ethercat: 'Gateway', profibus: 'built-in (גרסת DP)', canopen: 'CU עם CAN (S120/G120)', bacnet_ip: 'Gateway', bacnet_mstp: 'built-in (G120X / G120P)' },
  },
  danfoss: {
    he: 'Danfoss', families: [
      { name: 'VLT Micro FC 51', kw: [0.18, 22], use: 'machinery' }, { name: 'VLT HVAC FC 102', kw: [1.1, 1400], use: 'hvac' },
      { name: 'VLT AQUA FC 202', kw: [0.25, 2000], use: 'water' }, { name: 'VLT AutomationDrive FC 302', kw: [0.25, 1200], use: 'industrial' },
      { name: 'VACON 100 FLOW', kw: [0.55, 160], use: 'hvac' }],
    comm: { modbus_rtu: 'built-in', modbus_tcp: 'MCA 122', profinet: 'MCA 120', ethernetip: 'MCA 121', ethercat: 'MCA 124', profibus: 'MCA 101', canopen: 'MCA 105', bacnet_ip: 'MCA 125', bacnet_mstp: 'built-in (FC 102)' },
  },
  schneider: {
    he: 'Schneider Electric', families: [
      { name: 'Altivar ATV320', kw: [0.18, 15], use: 'machinery' }, { name: 'Altivar ATV340', kw: [0.75, 75], use: 'machinery' },
      { name: 'Altivar ATV212 (HVAC)', kw: [0.75, 75], use: 'hvac' }, { name: 'Altivar Process ATV630', kw: [0.75, 800], use: 'water' },
      { name: 'Altivar Process ATV930', kw: [0.75, 900], use: 'industrial' }],
    comm: { modbus_rtu: 'built-in', modbus_tcp: 'built-in (ATV630/930) / VW3A3616', profinet: 'VW3A3627', ethernetip: 'built-in (ATV630/930) / VW3A3616', ethercat: 'VW3A3601', profibus: 'VW3A3607', canopen: 'built-in / VW3A3608', bacnet_ip: 'Gateway', bacnet_mstp: 'built-in (ATV212)' },
  },
  yaskawa: {
    he: 'Yaskawa', families: [
      { name: 'GA500', kw: [0.1, 30], use: 'machinery' }, { name: 'GA700', kw: [0.4, 355], use: 'general' },
      { name: 'FP605 (HVAC)', kw: [0.75, 500], use: 'hvac' }, { name: 'GA800', kw: [0.75, 630], use: 'industrial' }],
    comm: { modbus_rtu: 'built-in (MEMOBUS)', modbus_tcp: 'SI-EM3', profinet: 'SI-EP3', ethernetip: 'SI-EN3', ethercat: 'SI-ES3', profibus: 'SI-P3', canopen: 'SI-S3', bacnet_ip: 'Gateway', bacnet_mstp: 'built-in (FP605)' },
  },
  mitsubishi: {
    he: 'Mitsubishi Electric', families: [
      { name: 'FR-E800', kw: [0.1, 22], use: 'machinery' }, { name: 'FR-F800 (משאבות/מאווררים)', kw: [0.75, 630], use: 'water' },
      { name: 'FR-A800', kw: [0.4, 500], use: 'industrial' }],
    comm: { modbus_rtu: 'built-in', modbus_tcp: 'built-in (FR-E800-E)', profinet: 'FR-A8NPRT', ethernetip: 'built-in (FR-E800-E)', ethercat: 'FR-A8NECT', profibus: 'FR-A8NP', canopen: 'Gateway', bacnet_ip: 'built-in (FR-E800-E)', bacnet_mstp: 'built-in (FR-F800)' },
  },
  delta: {
    he: 'Delta Electronics', families: [
      { name: 'MS300', kw: [0.2, 22], use: 'machinery' }, { name: 'CP2000 (משאבות/מאווררים)', kw: [0.75, 630], use: 'water' },
      { name: 'C2000 Plus', kw: [0.75, 630], use: 'industrial' }],
    comm: { modbus_rtu: 'built-in', modbus_tcp: 'CMC-EIP01 / CMC-MOD01', profinet: 'CMC-PN01', ethernetip: 'CMC-EIP01', ethercat: 'CMC-EC01', profibus: 'CMC-PD01', canopen: 'built-in / CMC-COP01', bacnet_ip: 'Gateway', bacnet_mstp: 'built-in (CP2000)' },
  },
  rockwell: {
    he: 'Rockwell Automation (Allen-Bradley)', families: [
      { name: 'PowerFlex 525', kw: [0.4, 22], use: 'machinery' }, { name: 'PowerFlex 753', kw: [0.75, 250], use: 'general' },
      { name: 'PowerFlex 755', kw: [0.75, 1500], use: 'industrial' }],
    comm: { modbus_rtu: 'built-in (RS-485 DSI)', modbus_tcp: 'Gateway', profinet: 'Gateway', ethernetip: 'built-in', ethercat: 'Gateway', profibus: '25-COMM-P / 20-750-PBUS', canopen: 'Gateway', bacnet_ip: '20-750-BNETIP', bacnet_mstp: 'Gateway' },
  },
  weg: {
    he: 'WEG', families: [
      { name: 'CFW500', kw: [0.18, 15], use: 'machinery' }, { name: 'CFW700', kw: [1.5, 110], use: 'general' },
      { name: 'CFW11', kw: [1.5, 500], use: 'industrial' }, { name: 'CFW701 (HVAC)', kw: [1.5, 110], use: 'hvac' }],
    comm: { modbus_rtu: 'built-in / מודול RS-485', modbus_tcp: 'מודול Ethernet', profinet: 'מודול PROFINET', ethernetip: 'מודול EtherNet/IP', ethercat: 'Gateway', profibus: 'מודול PROFIBUS', canopen: 'מודול CAN', bacnet_ip: 'Gateway', bacnet_mstp: 'built-in (CFW701)' },
  },
  lenze: { he: 'Lenze', families: [{ name: 'i510 / i550', kw: [0.25, 132], use: 'machinery' }, { name: '8400', kw: [0.25, 45], use: 'general' }], comm: { modbus_rtu: 'built-in (i550 MB)', modbus_tcp: 'built-in (i550 גרסת Ethernet)', profinet: 'built-in (גרסת PN)', ethernetip: 'built-in (גרסת EIP)', ethercat: 'built-in (גרסת ECAT)', profibus: 'built-in (גרסת DP)', canopen: 'built-in (גרסת CAN)', bacnet_ip: 'Gateway', bacnet_mstp: 'Gateway' } },
  fuji: { he: 'Fuji Electric', families: [{ name: 'FRENIC-Ace', kw: [0.1, 630], use: 'general' }, { name: 'FRENIC-HVAC/AQUA', kw: [0.75, 710], use: 'hvac' }], comm: { modbus_rtu: 'built-in', modbus_tcp: 'OPC-ETM', profinet: 'OPC-PNET', ethernetip: 'OPC-EIP', ethercat: 'OPC-ETC', profibus: 'OPC-PDP', canopen: 'OPC-COP', bacnet_ip: 'Gateway', bacnet_mstp: 'built-in (HVAC)' } },
  invertek: { he: 'Invertek Drives', families: [{ name: 'Optidrive E3', kw: [0.37, 22], use: 'machinery' }, { name: 'Optidrive Eco', kw: [0.75, 250], use: 'hvac' }, { name: 'Optidrive P2', kw: [0.75, 250], use: 'industrial' }], comm: { modbus_rtu: 'built-in', modbus_tcp: 'OPT-2-MODTC', profinet: 'OPT-2-PROFN', ethernetip: 'OPT-2-ETHIP', ethercat: 'OPT-2-ETCAT', profibus: 'OPT-2-PROFB', canopen: 'built-in', bacnet_ip: 'OPT-2-BACIP', bacnet_mstp: 'built-in (Eco)' } },
  hitachi: { he: 'Hitachi', families: [{ name: 'WJ-C1', kw: [0.1, 15], use: 'machinery' }, { name: 'SJ-P1', kw: [0.4, 132], use: 'industrial' }], comm: { modbus_rtu: 'built-in', modbus_tcp: 'כרטיס תקשורת', profinet: 'כרטיס תקשורת', ethernetip: 'כרטיס תקשורת', ethercat: 'כרטיס תקשורת', profibus: 'כרטיס תקשורת', canopen: 'Gateway', bacnet_ip: 'Gateway', bacnet_mstp: 'built-in (SJ-P1)' } },
  ls: { he: 'LS Electric', families: [{ name: 'G100', kw: [0.4, 22], use: 'machinery' }, { name: 'S100', kw: [0.4, 75], use: 'general' }, { name: 'H100 (HVAC)', kw: [0.75, 500], use: 'hvac' }], comm: { modbus_rtu: 'built-in', modbus_tcp: 'כרטיס Modbus TCP', profinet: 'כרטיס PROFINET', ethernetip: 'כרטיס EtherNet/IP', ethercat: 'כרטיס EtherCAT', profibus: 'כרטיס PROFIBUS', canopen: 'כרטיס CANopen', bacnet_ip: 'Gateway', bacnet_mstp: 'built-in (H100)' } },
  invt: { he: 'INVT', families: [{ name: 'GD20', kw: [0.4, 110], use: 'machinery' }, { name: 'GD350', kw: [1.5, 500], use: 'industrial' }, { name: 'GD300L (מעליות)', kw: [4, 37], use: 'motion' }], comm: { modbus_rtu: 'built-in', modbus_tcp: 'EC-TX515', profinet: 'EC-TX509', ethernetip: 'EC-TX510', ethercat: 'EC-TX508', profibus: 'EC-TX503', canopen: 'EC-TX505', bacnet_ip: 'Gateway', bacnet_mstp: 'Gateway' } },
  omron: { he: 'Omron', families: [{ name: 'M1', kw: [0.1, 22], use: 'machinery' }, { name: 'RX2', kw: [0.4, 132], use: 'industrial' }], comm: { modbus_rtu: 'built-in', modbus_tcp: 'Gateway', profinet: 'Gateway', ethernetip: 'כרטיס EtherNet/IP', ethercat: 'כרטיס EtherCAT', profibus: 'Gateway', canopen: 'Gateway', bacnet_ip: 'Gateway', bacnet_mstp: 'Gateway' } },
};

// Which drive family suits an application.
export const APP_USE = { pump: ['water', 'hvac', 'general'], fan: ['hvac', 'water', 'general'], compressor: ['general', 'industrial'], conveyor: ['machinery', 'general'], mixer: ['general', 'industrial'], hoist: ['industrial', 'motion'], extruder: ['industrial'], centrifuge: ['industrial'], general: ['general', 'machinery'] };

// ---- Parameter numbers per manufacturer (generic function → parameter, with the value logic in engine.js).
export const PARAM_FUNCS = [
  ['motorV', 'מתח נקוב של המנוע'], ['motorI', 'זרם נקוב של המנוע'], ['motorKW', 'הספק נקוב של המנוע'], ['motorHz', 'תדר נקוב של המנוע'],
  ['motorRPM', 'מהירות נקובה של המנוע'], ['controlMode', 'שיטת בקרה'], ['autotune', 'זיהוי מנוע (Auto-tune)'], ['accel', 'זמן האצה'],
  ['decel', 'זמן האטה'], ['fmin', 'מהירות / תדר מינימלי'], ['fmax', 'מהירות / תדר מקסימלי'], ['cmdSource', 'מקור פקודות הפעלה'],
  ['refSource', 'מקור הייחוס למהירות'], ['commProto', 'הפעלת פרוטוקול התקשורת'], ['commAddr', 'כתובת בתקשורת'], ['commBaud', 'קצב תקשורת'],
  ['commParity', 'פורמט / זוגיות'], ['commIp', 'כתובת IP'], ['commTimeout', 'פעולה ופסק זמן באובדן תקשורת'], ['flying', 'התנעה על מנוע מסתובב'],
];

export const PARAMS = {
  abb: { motorV: '99.07', motorI: '99.06', motorKW: '99.10', motorHz: '99.08', motorRPM: '99.09', controlMode: '99.04', autotune: '99.13', accel: '23.12', decel: '23.13', fmin: '30.11 / 30.13', fmax: '30.12 / 30.14', cmdSource: '20.01', refSource: '22.11', commProto: '58.01 (EFB) / 50.01 (FBA A)', commAddr: '58.03', commBaud: '58.04', commParity: '58.05', commIp: '51.04–51.08 (FENA)', commTimeout: '58.14 + 58.16 / 50.02 + 50.03', flying: '21.01 / 21.19' },
  siemens: { motorV: 'p0304', motorI: 'p0305', motorKW: 'p0307', motorHz: 'p0310', motorRPM: 'p0311', controlMode: 'p1300', autotune: 'p1900', accel: 'p1120', decel: 'p1121', fmin: 'p1080', fmax: 'p1082', cmdSource: 'p0015 (מאקרו)', refSource: 'p0922 (טלגרמה) / p1070', commProto: 'p2030', commAddr: 'p2021', commBaud: 'p2020', commParity: 'p2031', commIp: 'p8921 / שם התקן ב-TIA', commTimeout: 'p2040', flying: 'p1200' },
  danfoss: { motorV: '1-22', motorI: '1-24', motorKW: '1-20', motorHz: '1-23', motorRPM: '1-25', controlMode: '1-01 / 1-03', autotune: '1-29', accel: '3-41', decel: '3-42', fmin: '4-12', fmax: '4-14', cmdSource: '8-01 / 8-02', refSource: '3-15', commProto: '8-30', commAddr: '8-31', commBaud: '8-32', commParity: '8-33', commIp: '12-00 … 12-03', commTimeout: '8-03 + 8-04', flying: '1-73' },
  schneider: { motorV: 'UnS', motorI: 'nCr', motorKW: 'nPr', motorHz: 'FrS', motorRPM: 'nSP', controlMode: 'Ctt', autotune: 'tUn', accel: 'ACC', decel: 'dEC', fmin: 'LSP', fmax: 'HSP / tFr', cmdSource: 'Cd1', refSource: 'Fr1', commProto: 'Cd1/Fr1 = Mdb / EtH / nEt', commAddr: 'Add', commBaud: 'tbr', commParity: 'tFO', commIp: 'IPE1…IPE4 / IPC1…IPC4', commTimeout: 'ttO + SLL / ETHL', flying: 'FLr' },
  yaskawa: { motorV: 'E1-05', motorI: 'E2-01', motorKW: 'E2-11', motorHz: 'E1-06', motorRPM: 'E2-04 (קטבים)', controlMode: 'A1-02', autotune: 'T1-01', accel: 'C1-01', decel: 'C1-02', fmin: 'd2-02', fmax: 'E1-04 / d2-01', cmdSource: 'b1-02', refSource: 'b1-01', commProto: 'b1-01/b1-02 = 2 (MEMOBUS) / 3 (כרטיס)', commAddr: 'H5-01', commBaud: 'H5-02', commParity: 'H5-03', commIp: 'F7-01 … F7-04', commTimeout: 'H5-04 + H5-09', flying: 'b3-01' },
  mitsubishi: { motorV: 'Pr.83', motorI: 'Pr.9', motorKW: 'Pr.80', motorHz: 'Pr.84 / Pr.3', motorRPM: 'Pr.81 (קטבים)', controlMode: 'Pr.800', autotune: 'Pr.96', accel: 'Pr.7', decel: 'Pr.8', fmin: 'Pr.2', fmax: 'Pr.1', cmdSource: 'Pr.79 / Pr.338', refSource: 'Pr.339', commProto: 'Pr.549', commAddr: 'Pr.331', commBaud: 'Pr.332', commParity: 'Pr.334', commIp: 'Pr.1434 … Pr.1437', commTimeout: 'Pr.336 / Pr.502', flying: 'Pr.57' },
  delta: { motorV: '01-02', motorI: '05-01', motorKW: '05-02', motorHz: '01-01', motorRPM: '05-03', controlMode: '00-11', autotune: '05-00', accel: '01-12', decel: '01-13', fmin: '01-11', fmax: '01-00 / 01-10', cmdSource: '00-21', refSource: '00-20', commProto: '09-04', commAddr: '09-00', commBaud: '09-01', commParity: '09-04', commIp: 'בכרטיס התקשורת (DCISoft)', commTimeout: '09-02 + 09-03', flying: '07-12' },
  rockwell: { motorV: 'P031', motorI: 'P034', motorKW: 'P037', motorHz: 'P032', motorRPM: 'P036', controlMode: 'P039', autotune: 'P040', accel: 'P041', decel: 'P042', fmin: 'P043', fmax: 'P044', cmdSource: 'P046', refSource: 'P047', commProto: 'P046/P047 = EtherNet/IP או Serial', commAddr: 'C124', commBaud: 'C123', commParity: 'C125', commIp: 'C128 + C129…C132', commTimeout: 'C143 / C126', flying: 'A545' },
  weg: { motorV: 'P0400', motorI: 'P0401', motorKW: 'P0404', motorHz: 'P0403', motorRPM: 'P0402', controlMode: 'P0202', autotune: 'P0408', accel: 'P0100', decel: 'P0101', fmin: 'P0133', fmax: 'P0134', cmdSource: 'P0220 / P0224 / P0227', refSource: 'P0221 / P0222', commProto: 'P0312', commAddr: 'P0308', commBaud: 'P0310', commParity: 'P0311', commIp: 'בכרטיס התקשורת', commTimeout: 'P0314', flying: 'P0320' },
};

// Modbus register map of each manufacturer's native/drive profile (1-based holding register numbers).
export const MODBUS_MAPS = {
  abb: { profile: 'ABB Drives (58.25), מצב כתובות 0 (58.33)', cw: 400001, ref: 400002, sw: 400004, act: 400005, scale: '20000 = 100%', words: { ready: '0x0476', on: '0x0477', run: '0x047F', reset: '0x04FF (שינוי ביט 7)' } },
  siemens: { profile: 'PROFIdrive דרך Modbus RTU', cw: 40100, ref: 40101, sw: 40110, act: 40111, scale: '0x4000 (16384) = 100% של p2000', words: { ready: '0x047E', on: '0x047E', run: '0x047F', reset: '0x04FE (ביט 7)' } },
  danfoss: { profile: 'FC profile (8-10)', cw: 2810, ref: 2811, sw: 2910, act: 2911, scale: '0x4000 (16384) = 100%', words: { ready: '0x043C', on: '0x043C', run: '0x047C', reset: '0x04BC (ביט 7)' } },
  schneider: { profile: 'CiA 402 (I/O profile = CiA402)', cw: 8501, ref: 8502, sw: 3201, act: 3202, scale: 'LFR ב-0.1 Hz', words: { ready: '0x0006', on: '0x0007', run: '0x000F', reset: '0x0080' } },
  yaskawa: { profile: 'MEMOBUS', cw: 0x0001, ref: 0x0002, sw: 0x0020, act: 0x0024, scale: '0.01 Hz (לפי o1-03)', words: { ready: '0x0000', on: '0x0000', run: '0x0001 (קדימה)', reset: '0x0008 (ביט 3)' } },
  delta: { profile: 'Delta', cw: 0x2000, ref: 0x2001, sw: 0x2101, act: 0x2103, scale: '0.01 Hz', words: { ready: '0x0001 (עצירה)', on: '0x0001', run: '0x0002 (הפעלה)', reset: '0x2002 = 0x0002' } },
  rockwell: { profile: 'PowerFlex 4-class', cw: 0x2000, ref: 0x2001, sw: 0x2100, act: 0x2103, scale: '0.01 Hz', words: { ready: '0x0001 (עצירה)', on: '0x0001', run: '0x0002 (התנעה)', reset: '0x0008 (ניקוי תקלות)' } },
  weg: { profile: 'WEG (רגיסטר = מספר פרמטר)', cw: 682, ref: 683, sw: 680, act: 681, scale: '8192 = מהירות סינכרונית', words: { ready: '0x0000', on: '0x0002 (Enable)', run: '0x0003 (Run+Enable)', reset: '0x0080 (ביט 7)' } },
};

export const TEMPLATES = {
  pumping: {
    he: 'תחנת שאיבה', motors: [
      ['P-101', 'משאבה ראשית 1', 'pump', 45], ['P-102', 'משאבה ראשית 2', 'pump', 45], ['P-103', 'משאבה ראשית 3', 'pump', 45], ['P-104', 'משאבת גיבוי', 'pump', 45],
      ['P-201', 'משאבת דישון 1', 'pump', 0.75], ['P-202', 'משאבת דישון 2', 'pump', 0.75], ['F-301', 'מפוח אוורור', 'fan', 5.5]],
  },
  hvac: {
    he: 'מיזוג ואוורור (HVAC)', motors: [
      ['AHU-01', 'מפוח אספקה 1', 'fan', 15], ['AHU-02', 'מפוח אספקה 2', 'fan', 15], ['RAF-01', 'מפוח החזרה 1', 'fan', 11], ['RAF-02', 'מפוח החזרה 2', 'fan', 11],
      ['CHWP-1', 'משאבת מים קרים 1', 'pump', 22], ['CHWP-2', 'משאבת מים קרים 2', 'pump', 22], ['CT-1', 'מגדל קירור', 'fan', 7.5], ['EF-01', 'מפוח פליטה חניון', 'fan', 18.5]],
  },
  production: {
    he: 'קו ייצור ומסועים', motors: [
      ['CV-01', 'מסוע הזנה', 'conveyor', 2.2], ['CV-02', 'מסוע 2', 'conveyor', 3], ['CV-03', 'מסוע 3', 'conveyor', 3], ['CV-04', 'מסוע אריזה', 'conveyor', 1.5],
      ['MX-01', 'מערבל 1', 'mixer', 15], ['MX-02', 'מערבל 2', 'mixer', 15], ['EX-01', 'אקסטרודר', 'extruder', 55], ['CP-01', 'מדחס אוויר', 'compressor', 37]],
  },
  wastewater: {
    he: 'מכון טיהור שפכים', motors: [
      ['BL-01', 'מפוח אוורור 1', 'compressor', 90], ['BL-02', 'מפוח אוורור 2', 'compressor', 90], ['BL-03', 'מפוח אוורור 3', 'compressor', 90],
      ['RAS-1', 'משאבת בוצה חוזרת 1', 'pump', 30], ['RAS-2', 'משאבת בוצה חוזרת 2', 'pump', 30], ['IN-1', 'משאבת כניסה 1', 'pump', 55], ['IN-2', 'משאבת כניסה 2', 'pump', 55],
      ['MX-1', 'מערבל אנוקסי 1', 'mixer', 5.5], ['MX-2', 'מערבל אנוקסי 2', 'mixer', 5.5], ['CF-1', 'צנטריפוגה לבוצה', 'centrifuge', 75]],
  },
  crane: {
    he: 'עגורן גשר', motors: [['HO-1', 'הרמה', 'hoist', 22], ['TR-1', 'עגלה', 'conveyor', 4], ['BR-1', 'גשר צד א׳', 'conveyor', 5.5], ['BR-2', 'גשר צד ב׳', 'conveyor', 5.5]],
  },
  compressors: { he: 'חדר מדחסים', motors: [['CP-1', 'מדחס 1', 'compressor', 75], ['CP-2', 'מדחס 2', 'compressor', 75], ['DR-1', 'מייבש', 'fan', 3]] },
};
