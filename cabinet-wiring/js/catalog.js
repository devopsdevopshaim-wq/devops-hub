/* ארון־פלאן — קטלוג: צבעי חוטים, סוגי רכיבים, תפקידי מעגל, שרוולים וחתכים.
   קובץ משותף: נטען בדפדפן (window.WCat) ובשרת / בבדיקות (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WCat = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* צבעי בידוד לפי IEC 60757. LBU (תכלת) הוא קוד עזר לאפס, WHBU לבן-כחול ל-0V. */
  var COLORS = {
    BK: { he: 'שחור', en: 'black', hex: '#1c1c1c' },
    BN: { he: 'חום', en: 'brown', hex: '#7b4a26' },
    RD: { he: 'אדום', en: 'red', hex: '#d62828' },
    OG: { he: 'כתום', en: 'orange', hex: '#f28c28' },
    YE: { he: 'צהוב', en: 'yellow', hex: '#f2d22e' },
    GN: { he: 'ירוק', en: 'green', hex: '#2f9e44' },
    BU: { he: 'כחול כהה', en: 'dark blue', hex: '#1f4fd1' },
    LBU: { he: 'תכלת', en: 'light blue', hex: '#62b6f0' },
    VT: { he: 'סגול', en: 'violet', hex: '#8e44ad' },
    GY: { he: 'אפור', en: 'grey', hex: '#8a8f98' },
    WH: { he: 'לבן', en: 'white', hex: '#f4f4f4' },
    PK: { he: 'ורוד', en: 'pink', hex: '#f49ac1' },
    TQ: { he: 'טורקיז', en: 'turquoise', hex: '#1abc9c' },
    GNYE: { he: 'ירוק-צהוב', en: 'green-yellow', hex: '#2f9e44', stripe: '#f2d22e' },
    WHBU: { he: 'לבן-כחול', en: 'white-blue', hex: '#f4f4f4', stripe: '#1f4fd1' }
  };

  var COLOR_ALIASES = {
    BK: ['BK', 'BLK', 'BLACK', 'SW', 'SCHWARZ', 'NOIR', 'שחור'],
    BN: ['BN', 'BRN', 'BROWN', 'BR', 'BRAUN', 'חום'],
    RD: ['RD', 'RED', 'RT', 'ROT', 'ROUGE', 'אדום'],
    OG: ['OG', 'OR', 'ORANGE', 'כתום'],
    YE: ['YE', 'YEL', 'YELLOW', 'GE', 'GELB', 'צהוב'],
    GN: ['GN', 'GRN', 'GREEN', 'GRUEN', 'ירוק'],
    BU: ['BU', 'BL', 'BLU', 'BLUE', 'DBU', 'DARKBLUE', 'DKBU', 'BLAU', 'כחול', 'כחולכהה'],
    LBU: ['LBU', 'LB', 'HBL', 'LTBU', 'LIGHTBLUE', 'HELLBLAU', 'תכלת', 'כחולבהיר'],
    VT: ['VT', 'VI', 'VIO', 'VIOLET', 'PURPLE', 'PU', 'סגול'],
    GY: ['GY', 'GR', 'GRY', 'GREY', 'GRAY', 'GRAU', 'אפור'],
    WH: ['WH', 'WHT', 'WHITE', 'WS', 'WEISS', 'לבן'],
    PK: ['PK', 'PINK', 'RS', 'ROSA', 'ורוד'],
    TQ: ['TQ', 'TURQUOISE', 'טורקיז'],
    GNYE: ['GNYE', 'YEGN', 'GNGE', 'GEGN', 'GREENYELLOW', 'YELLOWGREEN', 'PE', 'ירוקצהוב', 'צהובירוק'],
    WHBU: ['WHBU', 'BUWH', 'WSBL', 'BLWS', 'WHITEBLUE', 'BLUEWHITE', 'לבןכחול', 'כחוללבן']
  };
  var ALIAS_INDEX = {};
  Object.keys(COLOR_ALIASES).forEach(function (k) {
    COLOR_ALIASES[k].forEach(function (a) { ALIAS_INDEX[a] = k; });
  });

  function colorCode(s) {
    if (s == null) return '';
    var k = String(s).toUpperCase().replace(/[\s\-\/_.,]+/g, '');
    if (!k) return '';
    if (COLORS[k]) return k;
    return ALIAS_INDEX[k] || '';
  }

  /* תפקיד החוט במעגל. הצבע הוא ברירת המחדל לפי IEC 60204-1 סעיף 13.2.4 */
  var FUNCS = {
    power: { he: 'מעגל כוח AC', short: 'כוח', color: 'BK', order: 1 },
    neutral: { he: 'אפס (N)', short: 'N', color: 'LBU', order: 2 },
    ctrl_ac: { he: 'פיקוד AC', short: 'פיקוד AC', color: 'RD', order: 3 },
    ctrl_dc: { he: 'פיקוד DC (+24V)', short: '+24V', color: 'BU', order: 4 },
    dc0: { he: '0V DC', short: '0V', color: 'WHBU', order: 5 },
    foreign: { he: 'מתח זר / נשאר חי כשהמפסק הראשי מנותק', short: 'מתח זר', color: 'OG', order: 6 },
    signal: { he: 'אות אנלוגי / מדידה', short: 'אנלוגי', color: 'WH', order: 7 },
    comm: { he: 'תקשורת', short: 'תקשורת', color: 'VT', order: 8 },
    pe: { he: 'הארקת הגנה (PE)', short: 'PE', color: 'GNYE', order: 9 }
  };

  /* סוגי רכיבים: מידות טיפוסיות במ"מ, שורת מסילה בארון, אזור (ארון / דלת / שטח) */
  var TYPES = {
    main_switch: { he: 'מפסק ראשי', w: 54, h: 95, row: 0, zone: 'cabinet', fill: '#6b2d2d' },
    mcb: { he: 'מאמ"ת (מפסק אוטומטי)', w: 18, h: 90, row: 0, zone: 'cabinet', fill: '#3b4252', perPole: 18 },
    rcd: { he: 'מפסק פחת', w: 36, h: 90, row: 0, zone: 'cabinet', fill: '#3b4252', perPole: 18 },
    fuse: { he: 'נתיך / בית נתיך', w: 18, h: 85, row: 0, zone: 'cabinet', fill: '#4a4a4a', perPole: 18 },
    psu: { he: 'ספק כוח', w: 60, h: 125, row: 0, zone: 'cabinet', fill: '#2c4a6b' },
    transformer: { he: 'שנאי פיקוד', w: 85, h: 85, row: 0, zone: 'cabinet', fill: '#5a4a2a' },
    socket: { he: 'שקע שירות', w: 45, h: 90, row: 0, zone: 'cabinet', fill: '#555' },
    meter: { he: 'מונה / מד', w: 72, h: 90, row: 0, zone: 'cabinet', fill: '#2f3f3f' },
    plc: { he: 'בקר PLC', w: 110, h: 100, row: 1, zone: 'cabinet', fill: '#1f5d50' },
    io: { he: 'כרטיס כניסות/יציאות', w: 45, h: 100, row: 1, zone: 'cabinet', fill: '#25695b' },
    relay: { he: 'ממסר', w: 16, h: 90, row: 1, zone: 'cabinet', fill: '#3d3d5c' },
    timer: { he: 'ממסר זמן', w: 18, h: 90, row: 1, zone: 'cabinet', fill: '#44446a' },
    thermostat: { he: 'תרמוסטט', w: 18, h: 60, row: 1, zone: 'cabinet', fill: '#4a3a5c' },
    other: { he: 'רכיב', w: 36, h: 80, row: 1, zone: 'cabinet', fill: '#444' },
    contactor: { he: 'מגען', w: 45, h: 85, row: 2, zone: 'cabinet', fill: '#2d3e5c' },
    overload: { he: 'ממסר תרמי', w: 45, h: 70, row: 2, zone: 'cabinet', fill: '#2d4e5c' },
    mpcb: { he: 'מפסק מגן מנוע', w: 45, h: 100, row: 2, zone: 'cabinet', fill: '#3b3b55' },
    vfd: { he: 'ממיר תדר', w: 90, h: 200, row: 2, zone: 'cabinet', fill: '#1d3557' },
    softstarter: { he: 'מתנע רך', w: 45, h: 125, row: 2, zone: 'cabinet', fill: '#1d3557' },
    terminal: { he: 'פס מהדקים', w: 6.2, h: 50, row: 3, zone: 'cabinet', fill: '#8a8f98' },
    pe_bar: { he: 'פס הארקה', w: 10, h: 22, row: 3, zone: 'cabinet', fill: '#2f9e44' },
    button: { he: 'לחצן', w: 40, h: 40, zone: 'door', fill: '#333' },
    selector: { he: 'בורר', w: 40, h: 40, zone: 'door', fill: '#333' },
    estop: { he: 'לחצן חירום', w: 46, h: 46, zone: 'door', fill: '#b51f1f' },
    lamp: { he: 'נורית סימון', w: 40, h: 40, zone: 'door', fill: '#333' },
    door_meter: { he: 'מד בדלת', w: 72, h: 72, zone: 'door', fill: '#2f3f3f' },
    motor: { he: 'מנוע', w: 110, h: 110, zone: 'field', fill: '#28323f' },
    sensor: { he: 'חיישן', w: 50, h: 80, zone: 'field', fill: '#3a3a2a' },
    valve: { he: 'שסתום / סולנואיד', w: 60, h: 60, zone: 'field', fill: '#3a2a3a' },
    fan: { he: 'מאוורר / מסנן', w: 90, h: 90, zone: 'field', fill: '#2a3a3a' },
    heater: { he: 'גוף חימום', w: 60, h: 60, zone: 'field', fill: '#3a2a2a' },
    field: { he: 'מכשיר בשטח', w: 60, h: 60, zone: 'field', fill: '#333' }
  };

  var ROWS = ['הזנה והגנות', 'בקרה וממסרים', 'מיתוג כוח והנעות', 'מהדקים והארקה'];
  var ZONES = { cabinet: 'בתוך הארון', door: 'דלת הארון', field: 'בשטח (מחוץ לארון)' };

  /* מילות מפתח בשם / תיאור → סוג. נבדק לפני הקידומת של התג. */
  var NAME_RULES = [
    [/מפסק\s*ראשי|main\s*switch|isolat|disconnect|מנתק|load\s*break|hauptschalter/i, 'main_switch'],
    [/חירום|e-?stop|emergency|not-?halt|נוטאוס/i, 'estop'],
    [/מגן\s*מנוע|motor\s*prot|mpcb|\bgv[23]|pkz|3rv|ms116|ms132/i, 'mpcb'],
    [/ממסר\s*תרמי|overload|thermal\s*rel|3ru|lrd|\btr\b/i, 'overload'],
    [/פחת|rcd|rccb|rcbo|fi-?schutz|residual/i, 'rcd'],
    [/מגען|contactor|schütz|schuetz|3rt|lc1|\baf\d/i, 'contactor'],
    [/ממסר\s*זמן|timer|השהי|zeitrel/i, 'timer'],
    [/ממסר|relay|relais|interface/i, 'relay'],
    [/ספק|power\s*supply|psu|netzteil|sitop|\bsmps/i, 'psu'],
    [/שנאי|transformer|trafo/i, 'transformer'],
    [/ממיר|vfd|inverter|frequency|drive|sinamics|altivar|\batv\d|acs\d|umrichter/i, 'vfd'],
    [/מתנע\s*רך|soft\s*start/i, 'softstarter'],
    [/בקר|plc|cpu|s7-?1[25]00|logo!?|controller|steuerung/i, 'plc'],
    [/כרטיס|i\/o|input\s*module|output\s*module|\bdi\d|\bdo\d|\bsm\s?12|et\s?200/i, 'io'],
    [/מאמ"?ת|מא"?ז|breaker|\bmcb\b|leitungsschutz|מפסק\s*אוטומטי|\b[bcd](?:2|4|6|10|13|16|20|25|32|40|50|63)\s*a\b/i, 'mcb'],
    [/נתיך|fuse|sicherung/i, 'fuse'],
    [/מנוע|motor/i, 'motor'],
    [/נורית|נורה|lamp|pilot\s*light|indicator|leuchtmelder/i, 'lamp'],
    [/בורר|selector|wahlschalter|key\s*switch/i, 'selector'],
    [/לחצן|push\s*button|button|taster/i, 'button'],
    [/חיישן|sensor|proximity|limit\s*sw|גבול|photo|encoder|pressure|level|מפלס|לחץ|טמפ/i, 'sensor'],
    [/סולנואיד|שסתום|valve|solenoid|ventil/i, 'valve'],
    [/תרמוסטט|thermostat|hygrostat/i, 'thermostat'],
    [/מאוורר|fan|lüfter|filter\s*fan/i, 'fan'],
    [/חימום|heater|heizung/i, 'heater'],
    [/שקע|socket|steckdose/i, 'socket'],
    [/פס\s*הארקה|pe\s*bar|earth\s*bar|busbar\s*pe|pe-?schiene/i, 'pe_bar'],
    [/מהדק|terminal|klemme|clamp/i, 'terminal'],
    [/מונה|meter|מד\s|multimeter|ammeter|voltmeter|zähler/i, 'meter']
  ];

  /* קידומת התג לפי IEC 81346-2 ו-IEC 60617 הישן (KM, KA, QF...) */
  var PREFIX_RULES = [
    [/^(XPE|PE|PEN|XE)$/, 'pe_bar'], [/^X/, 'terminal'],
    [/^KM$/, 'contactor'], [/^KT$/, 'timer'], [/^K/, 'relay'],
    [/^(QS|Q0|QA0)$/, 'main_switch'], [/^QM$/, 'mpcb'], [/^QA$/, 'contactor'], [/^Q/, 'mcb'],
    [/^(FR|FT|BT)$/, 'overload'], [/^FU$/, 'fuse'], [/^FA$/, 'mcb'], [/^F/, 'mcb'],
    [/^(TC|T)$/, 'transformer'], [/^(G|GS|TS|GB)$/, 'psu'],
    [/^(TA|UF|U|TF)$/, 'vfd'],
    [/^(AP|AD|KF)$/, 'plc'], [/^A/, 'plc'],
    [/^M/, 'motor'],
    [/^(SB|SF|S)$/, 'button'], [/^SA$/, 'selector'], [/^(SQ|SP|SL|ST|B|BG|BP|BT|BL|BQ)/, 'sensor'],
    [/^(H|HL|HG|PF|P)$/, 'lamp'], [/^P/, 'meter'],
    [/^(YV|Y|MB)$/, 'valve'], [/^(E|EV|EB)$/, 'fan'], [/^(EH|R)$/, 'heater']
  ];

  /* שרוולי קצה (פרולים) — קוד צבע DIN 46228-4, אורך שרוול טיפוסי במ"מ */
  var FERRULES = [
    { s: 0.25, color: 'TQ', len: 6 }, { s: 0.34, color: 'TQ', len: 6 }, { s: 0.5, color: 'WH', len: 8 },
    { s: 0.75, color: 'GY', len: 8 }, { s: 1, color: 'RD', len: 8 }, { s: 1.5, color: 'BK', len: 8 },
    { s: 2.5, color: 'BU', len: 10 }, { s: 4, color: 'GY', len: 10 }, { s: 6, color: 'YE', len: 12 },
    { s: 10, color: 'RD', len: 12 }, { s: 16, color: 'BU', len: 12 }, { s: 25, color: 'YE', len: 16 },
    { s: 35, color: 'RD', len: 16 }, { s: 50, color: 'BU', len: 20 }
  ];
  var AWG = { 0.25: 24, 0.34: 22, 0.5: 20, 0.75: 18, 1: 17, 1.5: 16, 2.5: 14, 4: 12, 6: 10, 10: 8, 16: 6, 25: 4, 35: 2, 50: 1 };
  var SECTIONS = [0.25, 0.34, 0.5, 0.75, 1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50];

  function ferrule(section, twin) {
    var s = Number(section) || 0;
    var f = FERRULES[0];
    for (var i = 0; i < FERRULES.length; i++) { if (FERRULES[i].s <= s + 1e-9) f = FERRULES[i]; }
    return {
      size: f.s, color: f.color, colorHe: COLORS[f.color].he, len: f.len, strip: f.len,
      twin: Boolean(twin),
      text: (twin ? 'שרוול כפול (TWIN) ' : 'שרוול מבודד ') + fmtSection(f.s) + ' ממ"ר, ' + COLORS[f.color].he + ' (DIN 46228-4), אורך ' + f.len + ' מ"מ'
    };
  }

  function wireTypeFor(section, func) {
    var s = Number(section) || 0;
    if (func === 'comm') return 'כבל תקשורת מסוכך';
    if (func === 'signal') return 'LiYCY מסוכך (זוג שזור)';
    return s <= 1 ? 'H05V-K' : 'H07V-K';
  }

  function wireTypeHe(type) {
    var t = String(type || '').toUpperCase();
    if (/H05V-?K/.test(t)) return 'H05V-K: גיד בודד גמיש (נחושת שזורה דקה), בידוד PVC, 300/500V. לחיווט פיקוד פנימי.';
    if (/H07V-?K/.test(t)) return 'H07V-K: גיד בודד גמיש, בידוד PVC, 450/750V. לחיווט כוח ופיקוד פנימי.';
    if (/H07V-?U|H07V-?R/.test(t)) return 'H07V-U/R: גיד קשיח. מתאים לחיבורים קבועים בלי תנועה.';
    if (/LIYCY/.test(t)) return 'LiYCY: כבל רב-גידי עם סיכוך רשת. לאותות אנלוגיים ולמדידה. מחברים את הסיכוך להארקה בצד אחד.';
    if (/LIYY/.test(t)) return 'LiYY: כבל פיקוד רב-גידי גמיש בלי סיכוך.';
    if (/NYY|N2XY|XLPE/.test(t)) return 'NYY / N2XY: כבל כוח קשיח להתקנה קבועה בשטח.';
    if (/ÖLFLEX|OLFLEX|H05VV5|YSLY|JZ/.test(t)) return 'כבל פיקוד / כוח גמיש רב-גידי (ÖLFLEX / YSLY). לחיבור מכשירים בשטח.';
    if (/M12|M8/.test(t)) return 'כבל חיישן עם מחבר M12/M8. צבעי הגידים: BN = +24V, BU = 0V, BK = אות, WH = אות שני.';
    if (/AWG/.test(t)) return 'חוט לפי תקן אמריקאי (AWG / UL1015 / MTW).';
    return '';
  }

  function torqueFor(section, compType, tech) {
    if (tech === 'pushin' && (compType === 'terminal' || compType === 'pe_bar')) return 'מהדק קפיץ (Push-in): בלי מומנט. דוחפים עד הסוף ובודקים במשיכה.';
    var s = Number(section) || 0;
    var t = s <= 2.5 ? '0.5–0.8' : s <= 6 ? '1.2–1.5' : s <= 16 ? '2.0–2.5' : '4.0–4.5';
    if (compType === 'main_switch' && s <= 6) t = '0.8–1.2';
    return t + ' Nm (ערך טיפוסי למהדק בורג. לבדוק מול דף היצרן)';
  }

  function fmtSection(s) {
    var n = Number(s);
    if (!isFinite(n) || n <= 0) return '';
    return String(Math.round(n * 100) / 100);
  }

  function sectionVis(s) {
    var n = Number(s) || 0.75;
    return Math.max(1.4, Math.min(5, 1 + Math.sqrt(n) * 1.15));
  }

  return {
    COLORS: COLORS, FUNCS: FUNCS, TYPES: TYPES, ROWS: ROWS, ZONES: ZONES,
    NAME_RULES: NAME_RULES, PREFIX_RULES: PREFIX_RULES, SECTIONS: SECTIONS, AWG: AWG,
    colorCode: colorCode, ferrule: ferrule, wireTypeFor: wireTypeFor, wireTypeHe: wireTypeHe,
    torqueFor: torqueFor, fmtSection: fmtSection, sectionVis: sectionVis
  };
});
