// IEC 61131-3 Structured Text: one function block per control profile, plus a program with an
// instance per drive, and a tag list. Runs on CODESYS-based PLCs and maps directly to SCL / Studio 5000 ST.

import { PROTOCOLS, PLCS, MODBUS_MAPS } from './catalog.js';

const id = (tag) => String(tag).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'DRV';

function fbProfidrive() {
  return `FUNCTION_BLOCK FB_VFD_PROFIDRIVE
(* PROFIdrive Standard Telegram 1: STW1/NSOLL_A out, ZSW1/NIST_A in. 0x4000 = 100 % *)
VAR_INPUT
    xRun       : BOOL;   (* run command *)
    xReverse   : BOOL;   (* reverse = negative setpoint *)
    xReset     : BOOL;   (* fault acknowledge (rising edge) *)
    rSpeedPct  : REAL;   (* 0..100 % of p2000 / reference speed *)
    wZSW1      : WORD;   (* from drive *)
    iNIST_A    : INT;    (* from drive *)
END_VAR
VAR_OUTPUT
    wSTW1      : WORD;   (* to drive *)
    iNSOLL_A   : INT;    (* to drive *)
    xReady     : BOOL;
    xRunning   : BOOL;
    xFault     : BOOL;
    xWarning   : BOOL;
    rActPct    : REAL;
END_VAR
VAR
    rtReset    : R_TRIG;
END_VAR

rtReset(CLK := xReset);
IF xRun AND NOT xFault THEN
    wSTW1 := 16#047F;                 (* ON, no OFF2/OFF3, enable inverter, ramp, setpoint, control by PLC *)
ELSE
    wSTW1 := 16#047E;                 (* OFF1: ramp down, ready *)
END_IF;
IF rtReset.Q THEN
    wSTW1 := wSTW1 OR 16#0080;        (* bit 7: acknowledge fault *)
END_IF;
iNSOLL_A := REAL_TO_INT(LIMIT(0.0, rSpeedPct, 100.0) * 163.84);
IF xReverse THEN iNSOLL_A := -iNSOLL_A; END_IF;

xReady   := wZSW1.1;
xRunning := wZSW1.2;
xFault   := wZSW1.3;
xWarning := wZSW1.7;
rActPct  := INT_TO_REAL(iNIST_A) / 163.84;
END_FUNCTION_BLOCK
`;
}

function fbCia402() {
  return `FUNCTION_BLOCK FB_VFD_CIA402
(* CiA 402 velocity mode (vl): 0x6040 controlword, 0x6042 target velocity, 0x6041 statusword, 0x6044 actual velocity *)
VAR_INPUT
    xRun       : BOOL;
    xReverse   : BOOL;
    xReset     : BOOL;
    iTargetRpm : INT;    (* motor rpm *)
    wStatus    : WORD;   (* 0x6041 *)
    iActualRpm : INT;    (* 0x6044 *)
END_VAR
VAR_OUTPUT
    wControl   : WORD;   (* 0x6040 *)
    iVlTarget  : INT;    (* 0x6042 *)
    xRunning   : BOOL;
    xFault     : BOOL;
    xWarning   : BOOL;
    sState     : STRING(24);
END_VAR

xFault   := (wStatus AND 16#004F) = 16#0008;
xWarning := wStatus.7;
xRunning := (wStatus AND 16#006F) = 16#0027;

IF xFault THEN
    sState := 'FAULT';
    IF xReset THEN wControl := 16#0080; ELSE wControl := 16#0000; END_IF;
ELSIF (wStatus AND 16#004F) = 16#0040 THEN
    sState := 'SWITCH ON DISABLED';
    wControl := 16#0006;                       (* shutdown -> ready to switch on *)
ELSIF (wStatus AND 16#006F) = 16#0021 THEN
    sState := 'READY TO SWITCH ON';
    IF xRun THEN wControl := 16#0007; ELSE wControl := 16#0006; END_IF;
ELSIF (wStatus AND 16#006F) = 16#0023 THEN
    sState := 'SWITCHED ON';
    IF xRun THEN wControl := 16#000F; ELSE wControl := 16#0006; END_IF;
ELSIF xRunning THEN
    sState := 'OPERATION ENABLED';
    IF xRun THEN wControl := 16#000F; ELSE wControl := 16#0007; END_IF;
END_IF;

iVlTarget := iTargetRpm;
IF xReverse THEN iVlTarget := -iTargetRpm; END_IF;
END_FUNCTION_BLOCK
`;
}

function fbOdva() {
  return `FUNCTION_BLOCK FB_VFD_ODVA
(* ODVA AC Drive profile: output assembly 21, input assembly 71 *)
VAR_INPUT
    xRun       : BOOL;
    xReverse   : BOOL;
    xReset     : BOOL;
    iSpeedRpm  : INT;
    bStatus    : BYTE;   (* assembly 71, byte 0 *)
    iActualRpm : INT;    (* assembly 71, bytes 2-3 *)
END_VAR
VAR_OUTPUT
    bControl   : BYTE;   (* assembly 21, byte 0 *)
    iRefRpm    : INT;    (* assembly 21, bytes 2-3 *)
    xRunning   : BOOL;
    xFault     : BOOL;
    xReady     : BOOL;
    xAtRef     : BOOL;
END_VAR

bControl := 16#60;                                   (* bit5 NetCtrl + bit6 NetRef: control and speed from the network *)
IF xRun AND NOT xReverse THEN bControl := bControl OR 16#01; END_IF;
IF xRun AND xReverse THEN bControl := bControl OR 16#02; END_IF;
IF xReset THEN bControl := bControl OR 16#04; END_IF;
iRefRpm := iSpeedRpm;

xFault   := bStatus.0;
xRunning := bStatus.2 OR bStatus.3;
xReady   := bStatus.4;
xAtRef   := bStatus.7;
END_FUNCTION_BLOCK
`;
}

function fbModbus(maps) {
  return `FUNCTION_BLOCK FB_VFD_MODBUS
(* Control/status words exchanged through Modbus registers.
   The communication itself is done by the PLC's Modbus client block (see notes),
   writing wCmd + iRef and reading wStatus + iActual every cycle. *)
VAR_INPUT
    xRun       : BOOL;
    xReset     : BOOL;
    rSpeedPct  : REAL;    (* 0..100 % *)
    wStatus    : WORD;
    iActual    : INT;
    wRunWord   : WORD;    (* manufacturer constants, set once per drive *)
    wStopWord  : WORD;
    wResetBit  : WORD;
    rScale100  : REAL;    (* raw value that means 100 % *)
    iRunBit    : INT := 2;
    iFaultBit  : INT := 3;
END_VAR
VAR_OUTPUT
    wCmd       : WORD;
    iRef       : INT;
    xRunning   : BOOL;
    xFault     : BOOL;
    rActPct    : REAL;
END_VAR
VAR
    rtReset    : R_TRIG;
END_VAR

rtReset(CLK := xReset);
IF xRun AND NOT xFault THEN wCmd := wRunWord; ELSE wCmd := wStopWord; END_IF;
IF rtReset.Q THEN wCmd := wCmd OR wResetBit; END_IF;
iRef := REAL_TO_INT(LIMIT(0.0, rSpeedPct, 100.0) / 100.0 * rScale100);
xRunning := (SHR(wStatus, iRunBit) AND 16#0001) = 16#0001;
xFault   := (SHR(wStatus, iFaultBit) AND 16#0001) = 16#0001;
rActPct  := INT_TO_REAL(iActual) / rScale100 * 100.0;
END_FUNCTION_BLOCK
(* Manufacturer constants used below: ${maps} *)
`;
}

function modbusConsts(brand) {
  const m = MODBUS_MAPS[brand];
  const C = {
    abb: { run: '16#047F', stop: '16#0476', reset: '16#0080', scale: '20000.0', runBit: 2, faultBit: 3 },
    siemens: { run: '16#047F', stop: '16#047E', reset: '16#0080', scale: '16384.0', runBit: 2, faultBit: 3 },
    danfoss: { run: '16#047C', stop: '16#043C', reset: '16#0080', scale: '16384.0', runBit: 11, faultBit: 3 },
    schneider: { run: '16#000F', stop: '16#0006', reset: '16#0080', scale: '500.0 (* 0.1 Hz: 50.0 Hz *)', runBit: 2, faultBit: 3 },
    yaskawa: { run: '16#0001', stop: '16#0000', reset: '16#0008', scale: '5000.0 (* 0.01 Hz *)', runBit: 0, faultBit: 7 },
    delta: { run: '16#0002', stop: '16#0001', reset: '16#0000 (* reset: write 2 to 0x2002 *)', scale: '5000.0 (* 0.01 Hz *)', runBit: 0, faultBit: 0 },
    rockwell: { run: '16#0002', stop: '16#0001', reset: '16#0008', scale: '5000.0 (* 0.01 Hz *)', runBit: 1, faultBit: 7 },
    weg: { run: '16#0003', stop: '16#0002', reset: '16#0080', scale: '8192.0', runBit: 2, faultBit: 15 },
  }[brand];
  return { m, c: C };
}

export function generatePlc(plant) {
  const { cfg, drives } = plant;
  const p = PROTOCOLS[cfg.protocol];
  const plc = PLCS[cfg.plc];
  const L = [];
  L.push(`(* ===================================================================`);
  L.push(`   ${cfg.site.name} · ${drives.length} ממירים · ${p.he}`);
  L.push(`   בקר: ${plc.he}`);
  L.push(`   נוצר ע"י דרייב־פלאן. יש לבדוק ולבצע ניסוי הפעלה לפני עבודה עם עומס.`);
  L.push(`   =================================================================== *)`);
  L.push('');
  const profile = p.profile;
  if (profile === 'profidrive') L.push(fbProfidrive());
  else if (profile === 'cia402') L.push(fbCia402());
  else if (profile === 'odva') L.push(fbOdva());
  else L.push(fbModbus([...new Set(drives.map((d) => d.brand))].join(', ')));

  L.push('PROGRAM PRG_DRIVES');
  L.push('VAR');
  for (const d of drives) {
    const n = id(d.tag);
    const fb = { profidrive: 'FB_VFD_PROFIDRIVE', cia402: 'FB_VFD_CIA402', odva: 'FB_VFD_ODVA' }[profile] || 'FB_VFD_MODBUS';
    L.push(`    ${n.padEnd(14)}: ${fb};   (* ${d.name} · ${d.kw} kW${d.addr.ip ? ` · ${d.addr.ip}` : ''}${d.addr.slave != null ? ` · slave ${d.addr.slave}` : ''}${d.addr.node != null ? ` · node ${d.addr.node}` : ''}${d.addr.position != null ? ` · pos ${d.addr.position}` : ''} *)`);
    L.push(`    ${(`${n}_Run`).padEnd(14)}: BOOL;`);
    L.push(`    ${(`${n}_Spd`).padEnd(14)}: REAL := ${profile === 'cia402' || profile === 'odva' ? d.rpm : 100.0};`);
  }
  L.push('    xResetAll     : BOOL;');
  L.push('    xEStopOK      : BOOL;   (* from safety relay; STO is hard-wired, this is status only *)');
  L.push('END_VAR');
  L.push('');
  for (const d of drives) {
    const n = id(d.tag);
    if (profile === 'profidrive') {
      L.push(`${n}(xRun := ${n}_Run AND xEStopOK, xReset := xResetAll, rSpeedPct := ${n}_Spd,`);
      L.push(`    wZSW1 := ${n}_IN_ZSW1, iNIST_A := ${n}_IN_NIST);   (* map to the drive's input words *)`);
      L.push(`${n}_OUT_STW1 := ${n}.wSTW1; ${n}_OUT_NSOLL := ${n}.iNSOLL_A;`);
    } else if (profile === 'cia402') {
      L.push(`${n}(xRun := ${n}_Run AND xEStopOK, xReset := xResetAll, iTargetRpm := REAL_TO_INT(${n}_Spd),`);
      L.push(`    wStatus := ${n}_TxPDO_Status, iActualRpm := ${n}_TxPDO_Vel);`);
      L.push(`${n}_RxPDO_Control := ${n}.wControl; ${n}_RxPDO_Target := ${n}.iVlTarget;`);
    } else if (profile === 'odva') {
      L.push(`${n}(xRun := ${n}_Run AND xEStopOK, xReset := xResetAll, iSpeedRpm := REAL_TO_INT(${n}_Spd),`);
      L.push(`    bStatus := ${n}_I_Data[0], iActualRpm := ${n}_I_Speed);   (* assembly 71 *)`);
      L.push(`${n}_O_Data[0] := ${n}.bControl; ${n}_O_Speed := ${n}.iRefRpm;   (* assembly 21 *)`);
    } else {
      const { m, c } = modbusConsts(d.brand);
      if (c) {
        L.push(`(* ${n}: קבועי ${m.profile}. יש לאמת מול מדריך התקשורת של היצרן לגרסת הקושחה *)`);
        L.push(`${n}(xRun := ${n}_Run AND xEStopOK, xReset := xResetAll, rSpeedPct := ${n}_Spd,`);
        L.push(`    wStatus := ${n}_MB_Status, iActual := ${n}_MB_Actual,`);
        L.push(`    wRunWord := ${c.run}, wStopWord := ${c.stop}, wResetBit := ${c.reset}, rScale100 := ${c.scale.split(' ')[0]},`);
        L.push(`    iRunBit := ${c.runBit}, iFaultBit := ${c.faultBit});`);
        if (profile === 'bacnet') {
          L.push(`(* BACnet ${d.addr.ip ? `IP ${d.addr.ip}` : `MS/TP MAC ${d.addr.mac}`} · Device Instance ${d.addr.instance}:`);
          L.push(`   BV/BO הפעלה <- ${n}_Run, AV ייחוס <- ${n}_Spd, BI מצב/תקלה -> ${n}_MB_Status, AI תדר -> ${n}_MB_Actual (לפי PICS של היצרן) *)`);
        } else {
          L.push(`(* Modbus ${cfg.protocol === 'modbus_tcp' ? `TCP ${d.addr.ip}:502 unit ${d.addr.unit}` : `RTU slave ${d.addr.slave} (קו ${d.addr.segment})`}:`);
          L.push(`   כתיבה: ${m.cw} := ${n}.wCmd, ${m.ref} := ${n}.iRef · קריאה: ${m.sw} -> ${n}_MB_Status, ${m.act} -> ${n}_MB_Actual *)`);
        }
      } else {
        L.push(`(* ${n}: ${d.brand === 'generic' ? 'ממיר כללי' : d.brand} — מלאו את קבועי מילת הפיקוד, הסטטוס והקנה מידה לפי מדריך התקשורת של היצרן *)`);
        L.push(`${n}(xRun := ${n}_Run AND xEStopOK, xReset := xResetAll, rSpeedPct := ${n}_Spd,`);
        L.push(`    wStatus := ${n}_MB_Status, iActual := ${n}_MB_Actual,`);
        L.push('    wRunWord := 16#0000, wStopWord := 16#0000, wResetBit := 16#0000, rScale100 := 10000.0);');
      }
    }
    L.push('');
  }
  L.push('END_PROGRAM');
  return L.join('\n');
}

export function tagList(plant) {
  const { cfg, drives } = plant;
  const prof = PROTOCOLS[cfg.protocol].profile;
  const rows = [['Tag', 'Description', 'DataType', 'Direction', 'Address / Object', 'Drive', 'Comm address']];
  for (const d of drives) {
    const n = id(d.tag);
    const addr = d.addr.ip || (d.addr.slave != null ? `slave ${d.addr.slave}` : d.addr.node != null ? `node ${d.addr.node}` : d.addr.position != null ? `pos ${d.addr.position}` : d.addr.mac != null ? `mac ${d.addr.mac}` : '');
    const dm = d.datamap;
    dm.out.forEach(([a, desc]) => rows.push([`${n}_${a.replace(/\W+/g, '_')}`, desc, prof === 'odva' && a.startsWith('Byte 0') ? 'BYTE' : 'WORD', 'OUT', a, d.tag, addr]));
    dm.inp.forEach(([a, desc]) => rows.push([`${n}_${a.replace(/\W+/g, '_')}`, desc, 'WORD', 'IN', a, d.tag, addr]));
    rows.push([`${n}_Run`, `${d.name}: פקודת הפעלה`, 'BOOL', 'INTERNAL', '', d.tag, addr]);
    rows.push([`${n}_Spd`, `${d.name}: מהירות רצויה`, 'REAL', 'INTERNAL', '', d.tag, addr]);
  }
  return rows;
}
