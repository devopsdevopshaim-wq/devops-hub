/* ארון־פלאן — חלקים אמיתיים: לכל רכיב בלוח מק"ט של יצרן אמיתי לפי סוג ודירוג (זרם, קטבים, מתח סליל).
   מותגים: Schneider Electric, ABB, Siemens; מהדקים Phoenix Contact / Weidmüller; ספקים Mean Well / Phoenix; ממסרים Finder.
   exact=true: מק"ט מלא לפי שיטת המספור של היצרן. exact=false: סדרה ודגם בלבד — לבחור מק"ט סופי בקטלוג.
   בכל מקרה: לאמת מול קטלוג היצרן לפני הזמנה. קובץ משותף: window.WParts בדפדפן, require בבדיקות. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WParts = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BRANDS = { schneider: 'Schneider Electric', abb: 'ABB', siemens: 'Siemens' };
  var TERM_BRANDS = { phoenix: 'Phoenix Contact', weidmuller: 'Weidmüller', main: 'כמו המותג הראשי' };
  var PSU_BRANDS = { main: 'כמו המותג הראשי', meanwell: 'Mean Well', phoenix: 'Phoenix Contact' };
  var RELAY_BRANDS = { main: 'כמו המותג הראשי', finder: 'Finder' };

  var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
  var up = function (list, v) { for (var i = 0; i < list.length; i++) if (list[i] >= v) return list[i]; return list[list.length - 1]; };

  /* ---------- דירוג מתוך השם / התיאור ---------- */
  function text(c) { return ((c.name || '') + ' ' + (c.desc || '')).replace(/[–—]/g, '-'); }
  function amps(c) {
    var t = text(c), m;
    if ((m = /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*A\b/i.exec(t))) return { lo: Number(m[1]), hi: Number(m[2]) };
    if ((m = /\b[BCD](\d{1,3})\b/.exec(t))) return { hi: Number(m[1]) };
    if ((m = /(?:\d\s*[×x]\s*)?(\d+(?:\.\d+)?)\s*A\b/i.exec(t))) return { hi: Number(m[1]) };
    return null;
  }
  function poles(c, def) {
    var t = text(c), m;
    if ((m = /\b([1-4])\s*[×x]\s*\d/.exec(t))) return Number(m[1]);
    if ((m = /\b([1-4])\s*P\b/i.exec(t))) return Number(m[1]);
    if ((m = /\b([1-4])\s*קטב/.exec(t))) return Number(m[1]);
    return def;
  }
  function kw(c) { var m = /(\d+(?:\.\d+)?)\s*kW/i.exec(text(c)); return m ? Number(m[1]) : null; }
  function volts(c) {
    var t = text(c);
    if (/12\s*V/i.test(t)) return 12;
    if (/48\s*V/i.test(t)) return 48;
    return 24;
  }
  function coilAc(c, opts) {
    var t = text(c);
    if (/סליל\s*230|230\s*V\s*AC|230VAC/i.test(t)) return true;
    if (/סליל\s*24|24\s*V\s*DC|24VDC/i.test(t)) return false;
    return opts.coil === 'ac230';
  }

  /* ---------- מאמ"ת ---------- */
  var MCB_A = [6, 10, 16, 20, 25, 32, 40, 50, 63];
  function mcb(c, b) {
    var a = up(MCB_A, (amps(c) || { hi: 16 }).hi), p = poles(c, 1);
    if (b === 'abb') return { maker: 'ABB', partNo: 'S20' + p + '-C' + a + ' (2CDS25' + p + '001R0' + pad2(a) + '4)', series: 'S200', exact: true, desc: 'מאמ"ת ' + p + 'P C' + a + ' 6kA' };
    if (b === 'siemens') return { maker: 'Siemens', partNo: '5SL6' + p + pad2(a) + '-7', series: '5SL6', exact: true, desc: 'מאמ"ת ' + p + 'P C' + a + ' 6kA' };
    return { maker: 'Schneider Electric', partNo: 'A9F74' + p + pad2(a), series: 'Acti9 iC60N', exact: true, desc: 'מאמ"ת ' + p + 'P C' + a + ' 6kA' };
  }

  /* ---------- מפסק פחת ---------- */
  function rcd(c, b) {
    var a = up([25, 40, 63], (amps(c) || { hi: 40 }).hi), p = poles(c, 4) >= 3 ? 4 : 2;
    var ma = /300\s*mA/i.test(text(c)) ? 300 : 30;
    if (b === 'abb') return { maker: 'ABB', partNo: 'F20' + p + ' A-' + a + '/' + (ma === 30 ? '0.03' : '0.3') + (ma === 30 ? ' (2CSF20' + p + '101R1' + pad2(a) + '0)' : ''), series: 'F200 סוג A', exact: ma === 30, desc: 'מפסק פחת ' + p + 'P ' + a + 'A ' + ma + 'mA סוג A' };
    if (b === 'siemens') return { maker: 'Siemens', partNo: '5SV3' + (p === 4 ? '3' : '3') + (p === 4 ? '4' : '1') + ({ 25: 2, 40: 4, 63: 6 })[a] + '-6', series: '5SV3 סוג A', exact: ma === 30, desc: 'מפסק פחת ' + p + 'P ' + a + 'A ' + ma + 'mA סוג A' };
    return { maker: 'Schneider Electric', partNo: 'A9R11' + p + pad2(a), series: 'Acti9 iID סוג AC', exact: ma === 30, desc: 'מפסק פחת ' + p + 'P ' + a + 'A ' + ma + 'mA סוג AC (לציוד אלקטרוני לשקול סוג A)' };
  }

  /* ---------- מפסק ראשי ---------- */
  function mainSwitch(c, b) {
    var a = up([25, 32, 40, 63, 80], (amps(c) || { hi: 32 }).hi);
    if (b === 'abb') return { maker: 'ABB', partNo: 'OT' + a + 'F3 + OHB65J6', series: 'OT', exact: true, desc: 'מפסק עומס ראשי 3P ' + a + 'A עם ידית לדלת' };
    if (b === 'siemens') return { maker: 'Siemens', partNo: '3LD2 · ' + a + 'A', series: 'SENTRON 3LD2', exact: false, desc: 'מפסק ראשי 3P ' + a + 'A עם ידית אדום/צהוב' };
    var v = { 25: 'VCF01', 32: 'VCF02', 40: 'VCF1', 63: 'VCF2', 80: 'VCF3' }[a];
    return { maker: 'Schneider Electric', partNo: v, series: 'TeSys Vario', exact: true, desc: 'מפסק ראשי 3P ' + a + 'A ידית אדום/צהוב, ננעל' };
  }

  /* ---------- מגען ---------- */
  function contactor(c, b, opts) {
    var k = kw(c), a = amps(c);
    var need = k ? k * 2.1 : a ? a.hi : 9;
    var ac = coilAc(c, opts);
    if (b === 'abb') {
      var s = up([9, 12, 16, 26, 30, 38], need);
      return { maker: 'ABB', partNo: 'AF' + pad2(s) + '-30-' + (s >= 26 ? '00' : '10') + '-' + (ac ? '13' : '41'), series: 'AF', exact: true, desc: 'מגען 3P ' + s + 'A AC-3, סליל ' + (ac ? '100–250V AC/DC' : '24–60V AC/20–60V DC') };
    }
    if (b === 'siemens') {
      var sm = [[7, '2015-1'], [9, '2016-1'], [12, '2017-1'], [16, '2018-1'], [25, '2026-1'], [32, '2027-1'], [38, '2028-1']];
      var pick = sm.find(function (x) { return x[0] >= need; }) || sm[sm.length - 1];
      var big = pick[0] >= 25;
      return { maker: 'Siemens', partNo: '3RT' + pick[1] + (ac ? (big ? 'AP00' : 'AP01') : (big ? 'BB40' : 'BB41')), series: 'SIRIUS 3RT2', exact: true, desc: 'מגען 3P ' + pick[0] + 'A AC-3, סליל ' + (ac ? '230V AC' : '24V DC') };
    }
    var sd = up([9, 12, 18, 25, 32, 38], need);
    return { maker: 'Schneider Electric', partNo: 'LC1D' + pad2(sd) + (ac ? 'P7' : 'BD'), series: 'TeSys D', exact: true, desc: 'מגען 3P ' + sd + 'A AC-3, סליל ' + (ac ? '230V AC' : '24V DC') };
  }

  /* ---------- מפסק מגן מנוע ---------- */
  function rangePick(list, a) {
    var hi = a ? a.hi : 6.3;
    return list.find(function (r) { return r[1] >= hi; }) || list[list.length - 1];
  }
  function mpcb(c, b) {
    var a = amps(c) || (kw(c) ? { hi: kw(c) * 2.1 } : null);
    if (b === 'abb') {
      var r = rangePick([[1, 1.6, '1.6'], [1.6, 2.5, '2.5'], [2.5, 4, '4.0'], [4, 6.3, '6.3'], [6.3, 10, '10'], [8, 12, '12'], [10, 16, '16'], [16, 20, '20'], [20, 25, '25'], [25, 32, '32']], a);
      return { maker: 'ABB', partNo: 'MS132-' + r[2], series: 'MS132', exact: true, desc: 'מפסק מגן מנוע ' + r[0] + '–' + r[1] + 'A' };
    }
    if (b === 'siemens') {
      var rs = rangePick([[1.1, 1.6, '2011-1AA10'], [1.4, 2, '2011-1BA10'], [1.8, 2.5, '2011-1CA10'], [2.2, 3.2, '2011-1DA10'], [2.8, 4, '2011-1EA10'], [3.5, 5, '2011-1FA10'], [4.5, 6.3, '2011-1GA10'], [5.5, 8, '2011-1HA10'], [7, 10, '2011-1JA10'], [9, 12.5, '2011-1KA10'], [10, 16, '2011-4AA10'], [13, 20, '2021-4BA10'], [17, 22, '2021-4CA10'], [20, 25, '2021-4DA10']], a);
      return { maker: 'Siemens', partNo: '3RV' + rs[2], series: 'SIRIUS 3RV2', exact: true, desc: 'מפסק מגן מנוע ' + rs[0] + '–' + rs[1] + 'A' };
    }
    var rg = rangePick([[1, 1.6, '06'], [1.6, 2.5, '07'], [2.5, 4, '08'], [4, 6.3, '10'], [6, 10, '14'], [9, 14, '16'], [13, 18, '20'], [17, 23, '21'], [20, 25, '22'], [24, 32, '32']], a);
    return { maker: 'Schneider Electric', partNo: 'GV2ME' + rg[2], series: 'TeSys GV2', exact: true, desc: 'מפסק מגן מנוע ' + rg[0] + '–' + rg[1] + 'A' };
  }

  /* ---------- ממסר תרמי ---------- */
  function overload(c, b) {
    var a = amps(c);
    if (b === 'abb') { var r = rangePick([[2.8, 4, '4.0'], [4.2, 5.7, '5.7'], [5.5, 7.6, '7.6'], [7.6, 10, '10'], [10, 13, '13'], [13, 17, '17'], [16, 20, '20'], [20, 24, '24']], a); return { maker: 'ABB', partNo: 'TF42-' + r[2], series: 'TF42', exact: true, desc: 'ממסר תרמי ' + r[0] + '–' + r[1] + 'A' }; }
    if (b === 'siemens') return { maker: 'Siemens', partNo: '3RU2116 · ' + (a ? a.hi : '?') + 'A', series: 'SIRIUS 3RU2', exact: false, desc: 'ממסר תרמי לפי זרם המנוע' };
    var rl = rangePick([[2.5, 4, '08'], [4, 6, '10'], [5.5, 8, '12'], [7, 10, '14'], [9, 13, '16'], [12, 18, '21'], [16, 24, '22'], [23, 32, '32']], a);
    return { maker: 'Schneider Electric', partNo: 'LRD' + rl[2], series: 'TeSys LRD', exact: true, desc: 'ממסר תרמי ' + rl[0] + '–' + rl[1] + 'A' };
  }

  /* ---------- ספק כוח ---------- */
  function psu(c, b, opts) {
    var v = volts(c), a = (amps(c) || { hi: 5 }).hi;
    var pb = opts.psu && opts.psu !== 'main' ? opts.psu : b;
    if (pb === 'meanwell') {
      var mw = v === 12 ? [[4.5, 'HDR-60-12'], [10, 'NDR-120-12'], [20, 'NDR-240-12']] : [[2.5, 'HDR-60-24'], [3.83, 'HDR-100-24N'], [5, 'NDR-120-24'], [6.25, 'HDR-150-24'], [10, 'NDR-240-24'], [20, 'NDR-480-24']];
      var m = mw.find(function (x) { return x[0] >= a; }) || mw[mw.length - 1];
      return { maker: 'Mean Well', partNo: m[1], series: v === 12 ? 'HDR/NDR 12V' : 'HDR/NDR 24V', exact: true, desc: 'ספק ' + v + 'VDC ' + m[0] + 'A לפס DIN' };
    }
    if (pb === 'phoenix' && v === 24) {
      var px = [[2.5, 'UNO-PS/1AC/24DC/60W', '2902992'], [4.2, 'UNO-PS/1AC/24DC/100W', '2902993'], [6.25, 'UNO-PS/1AC/24DC/150W', '2904376'], [10, 'UNO-PS/1AC/24DC/240W', '2904372']];
      var q = px.find(function (x) { return x[0] >= a; }) || px[px.length - 1];
      return { maker: 'Phoenix Contact', partNo: q[1] + ' (' + q[2] + ')', series: 'UNO POWER', exact: true, desc: 'ספק 24VDC ' + q[0] + 'A לפס DIN' };
    }
    if (pb === 'abb') {
      var ab = (v === 12 ? [[2.5, 'CP-E 12/2.5'], [10, 'CP-E 12/10.0']] : [[2.5, 'CP-E 24/2.5'], [5, 'CP-E 24/5.0'], [10, 'CP-E 24/10.0'], [20, 'CP-E 24/20.0']]);
      var t = ab.find(function (x) { return x[0] >= a; }) || ab[ab.length - 1];
      return { maker: 'ABB', partNo: t[1], series: 'CP-E', exact: true, desc: 'ספק ' + v + 'VDC ' + t[0] + 'A' };
    }
    if (pb === 'siemens') {
      if (v === 12) return { maker: 'Siemens', partNo: 'SITOP PSU100C 12V', series: 'SITOP', exact: false, desc: 'ספק 12VDC' };
      var sp = [[2.5, '6EP1332-2BA20'], [5, '6EP1333-2BA20'], [10, '6EP1334-2BA20']];
      var u = sp.find(function (x) { return x[0] >= a; }) || sp[sp.length - 1];
      return { maker: 'Siemens', partNo: u[1], series: 'SITOP smart', exact: true, desc: 'ספק 24VDC ' + u[0] + 'A' };
    }
    var sc = v === 12 ? [[5, 'ABL8REM12050']] : [[3, 'ABL8REM24030'], [5, 'ABL8REM24050'], [10, 'ABL8RPS24100']];
    var w = sc.find(function (x) { return x[0] >= a; }) || sc[sc.length - 1];
    return { maker: 'Schneider Electric', partNo: w[1], series: 'Modicon Power ABL8', exact: true, desc: 'ספק ' + v + 'VDC ' + w[0] + 'A' };
  }

  /* ---------- ממסר / ממסר זמן ---------- */
  function relay(c, b, opts) {
    var ac = coilAc(c, opts);
    var rb = opts.relay && opts.relay !== 'main' ? opts.relay : b;
    if (rb === 'finder' || rb === 'siemens') return { maker: 'Finder', partNo: (ac ? '40.52.8.230.0000' : '40.52.9.024.0000') + ' + 95.95.3', series: '40.52', exact: true, desc: 'ממסר 2 מגעים מחליפים 8A, סליל ' + (ac ? '230VAC' : '24VDC') + ', עם בסיס' };
    if (rb === 'abb') return { maker: 'ABB', partNo: 'CR-M' + (ac ? '230AC' : '024DC') + '4 + CR-M4SS', series: 'CR-M', exact: true, desc: 'ממסר 4 מגעים מחליפים, סליל ' + (ac ? '230VAC' : '24VDC') + ', עם בסיס' };
    return { maker: 'Schneider Electric', partNo: 'RXM4AB2' + (ac ? 'P7' : 'BD') + ' + RXZE2M114M', series: 'Zelio RXM', exact: true, desc: 'ממסר 4 מגעים מחליפים, סליל ' + (ac ? '230VAC' : '24VDC') + ', עם בסיס' };
  }
  function timer(c, b) {
    if (b === 'abb') return { maker: 'ABB', partNo: 'CT-ERS.21S', series: 'CT-S', exact: true, desc: 'ממסר זמן השהיה בהפעלה, 2 מגעים מחליפים' };
    if (b === 'siemens') return { maker: 'Siemens', partNo: '3RP2505-1AW30', series: 'SIRIUS 3RP25', exact: true, desc: 'ממסר זמן רב-תפקודי' };
    return { maker: 'Schneider Electric', partNo: 'RE17RAMU', series: 'Zelio Time', exact: true, desc: 'ממסר זמן השהיה בהפעלה' };
  }

  /* ---------- דלת: לחצנים, חירום, נוריות, בורר ---------- */
  function colorOf(c) {
    var t = text(c);
    if (/ירוק|green|הפעלה|start/i.test(t)) return 'G';
    if (/אדום|red|עצירה|stop|תקלה/i.test(t)) return 'R';
    if (/צהוב|כתום|amber|yellow/i.test(t)) return 'Y';
    if (/כחול|blue|reset|איפוס/i.test(t)) return 'B';
    if (/לבן|white/i.test(t)) return 'W';
    return 'K';
  }
  function door(c, b) {
    var col = colorOf(c);
    var he = { G: 'ירוק', R: 'אדום', Y: 'צהוב', B: 'כחול', W: 'לבן', K: 'שחור' }[col];
    if (b === 'siemens') {
      if (c.type === 'estop') return { maker: 'Siemens', partNo: '3SU1150-1HB20-1CA0', series: 'SIRIUS ACT', exact: true, desc: 'לחצן חירום 40 מ"מ, שחרור בסיבוב, 1NC' };
      if (c.type === 'lamp') return { maker: 'Siemens', partNo: '3SU1156-6AA' + ({ G: '40', R: '20', Y: '30', B: '50', W: '60', K: '60' })[col] + '-1AA0', series: 'SIRIUS ACT', exact: true, desc: 'נורית סימון LED 24V ' + he };
      if (c.type === 'selector') return { maker: 'Siemens', partNo: '3SU1150-2BF60-1BA0', series: 'SIRIUS ACT', exact: true, desc: 'בורר 2 מצבים, 1NO' };
      return { maker: 'Siemens', partNo: '3SU1150-0AB' + ({ G: '40', R: '20', Y: '30', B: '50', W: '60', K: '10' })[col] + '-1' + (col === 'R' ? 'CA0' : 'BA0'), series: 'SIRIUS ACT', exact: true, desc: 'לחצן ' + he + ' ' + (col === 'R' ? '1NC' : '1NO') };
    }
    if (b === 'abb') {
      if (c.type === 'estop') return { maker: 'ABB', partNo: 'MPET4-10R', series: 'Modular 22 מ"מ', exact: false, desc: 'לחצן חירום 40 מ"מ, שחרור בסיבוב' };
      if (c.type === 'lamp') return { maker: 'ABB', partNo: 'MLB-1 · LED 24V ' + he, series: 'Modular 22 מ"מ', exact: false, desc: 'נורית סימון LED 24V ' + he };
      if (c.type === 'selector') return { maker: 'ABB', partNo: 'M2SS1-10B', series: 'Modular 22 מ"מ', exact: false, desc: 'בורר 2 מצבים' };
      return { maker: 'ABB', partNo: 'MP1-10' + col, series: 'Modular 22 מ"מ', exact: false, desc: 'לחצן ' + he };
    }
    if (c.type === 'estop') return { maker: 'Schneider Electric', partNo: 'XB5AS8445', series: 'Harmony XB5', exact: true, desc: 'לחצן חירום 40 מ"מ, שחרור בסיבוב, 1NO+1NC' };
    if (c.type === 'lamp') return { maker: 'Schneider Electric', partNo: 'XB5AVB' + ({ G: 3, R: 4, Y: 5, B: 6, W: 1, K: 1 })[col], series: 'Harmony XB5', exact: true, desc: 'נורית סימון LED 24V ' + he };
    if (c.type === 'selector') return { maker: 'Schneider Electric', partNo: 'XB5AD21', series: 'Harmony XB5', exact: true, desc: 'בורר 2 מצבים, 1NO' };
    return { maker: 'Schneider Electric', partNo: 'XB5AA' + ({ G: 31, R: 42, Y: 51, B: 61, W: 11, K: 21 })[col], series: 'Harmony XB5', exact: true, desc: 'לחצן ' + he + ' ' + (col === 'R' ? '1NC' : '1NO') };
  }

  /* ---------- מהדקים ---------- */
  var TERM = {
    phoenix: { maker: 'Phoenix Contact', series: 'UT', t: { 2.5: ['UT 2,5', '3044076'], 4: ['UT 4', '3044102'], 6: ['UT 6', '3044131'], 10: ['UT 10', '3044160'] }, pe: { 2.5: ['UT 2,5-PE', '3044089'], 4: ['UT 4-PE', '3044115'], 6: ['UT 6-PE', '3044128'], 10: ['UT 10-PE', '3044157'] }, end: 'D-UT 2,5/10 (3047028)', stop: 'E/UK (1201442)' },
    weidmuller: { maker: 'Weidmüller', series: 'W-Series WDU', t: { 2.5: ['WDU 2.5', '1020000000'], 4: ['WDU 4', '1020100000'], 6: ['WDU 6', '1020200000'], 10: ['WDU 10', '1020300000'] }, pe: { 2.5: ['WPE 2.5', '1010000000'], 4: ['WPE 4', '1010100000'], 6: ['WPE 6', '1010200000'], 10: ['WPE 10', '1010300000'] }, end: 'WAP 2.5-10 (1050000000)', stop: 'WEW 35/2 (1061200000)' },
    schneider: { maker: 'Schneider Electric', series: 'Linergy TR', t: { 2.5: ['NSYTRV22', ''], 4: ['NSYTRV42', ''], 6: ['NSYTRV62', ''], 10: ['NSYTRV102', ''] }, pe: { 2.5: ['NSYTRV22PE', ''], 4: ['NSYTRV42PE', ''], 6: ['NSYTRV62PE', ''], 10: ['NSYTRV102PE', ''] }, end: 'NSYTRAC22', stop: 'NSYTRAAB35' },
    abb: { maker: 'ABB', series: 'SNK', t: { 2.5: ['ZS2.5', '1SNK505010R0000'], 4: ['ZS4', '1SNK506010R0000'], 6: ['ZS6', '1SNK508010R0000'], 10: ['ZS10', '1SNK510010R0000'] }, pe: { 2.5: ['ZS2.5-PE', '1SNK505150R0000'], 4: ['ZS4-PE', '1SNK506150R0000'], 6: ['ZS6-PE', ''], 10: ['ZS10-PE', ''] }, end: 'ZS-EP (לפי קטלוג)', stop: 'BADL (לפי קטלוג)' }
  };
  function terminal(c, b, opts, P, L) {
    var tb = opts.terminals && opts.terminals !== 'main' ? opts.terminals : (b === 'siemens' ? 'phoenix' : b);
    var T = TERM[tb] || TERM.phoenix;
    var keys = L && L.pins ? Object.keys(L.pins).filter(function (k) { return k.indexOf(c.tag + ':') === 0; }) : [];
    var terms = keys.map(function (k) { return k.slice(c.tag.length + 1); });
    var sec = 0;
    (P && P.wires || []).forEach(function (w) { if (w.from.tag === c.tag || w.to.tag === c.tag) sec = Math.max(sec, Number(w.section) || 0); });
    var s = up([2.5, 4, 6, 10], sec || 2.5);
    var nPe = terms.filter(function (t) { return /^PE/i.test(t); }).length, n = Math.max(1, terms.length - nPe);
    var a = T.t[s], p = T.pe[s];
    var pn = n + '× ' + a[0] + (a[1] ? ' (' + a[1] + ')' : '') + (nPe ? ' + ' + nPe + '× ' + p[0] + (p[1] ? ' (' + p[1] + ')' : '') : '') + ' + ' + T.end + ' + 2× ' + T.stop;
    return { maker: T.maker, partNo: pn, series: T.series, exact: true, desc: 'פס מהדקים ' + s + ' ממ"ר: ' + n + ' הדקים' + (nPe ? ' + ' + nPe + ' הארקה' : ''), lines: [{ partNo: a[0], code: a[1], qty: n, desc: 'הדק מעבר ' + s + ' ממ"ר' }].concat(nPe ? [{ partNo: p[0], code: p[1], qty: nPe, desc: 'הדק הארקה ' + s + ' ממ"ר' }] : []).concat([{ partNo: T.end, code: '', qty: 1, desc: 'מכסה קצה' }, { partNo: T.stop, code: '', qty: 2, desc: 'עוצר קצה' }]) };
  }

  /* ---------- שונות ---------- */
  function misc(c, b) {
    if (c.type === 'thermostat') return { maker: b === 'schneider' ? 'Schneider Electric' : 'Rittal', partNo: b === 'schneider' ? 'NSYCCOTHO' : 'SK 3110.000', series: b === 'schneider' ? 'ClimaSys' : 'SK', exact: true, desc: 'תרמוסטט ללוח, מגע NO (לאוורור)' };
    if (c.type === 'fan') return { maker: b === 'schneider' ? 'Schneider Electric' : 'Rittal', partNo: b === 'schneider' ? 'NSYCVF38M230PF' : 'SK 3237.100', series: b === 'schneider' ? 'ClimaSys' : 'TopTherm', exact: b === 'schneider', desc: 'מאוורר מסנן 230V ללוח' };
    if (c.type === 'fuse') return { maker: 'Phoenix Contact', partNo: 'UT 4-HESI (5x20) (3046090)', series: 'UT', exact: true, desc: 'מהדק נתיך 5×20 עם נורית' };
    if (c.type === 'pe_bar') return { maker: 'Phoenix Contact', partNo: 'AB-SK + פס נחושת 10×3', series: 'פס הארקה', exact: false, desc: 'פס הארקה מנחושת על מבודדים' };
    return null;
  }

  /* ---------- בחירה לרכיב ---------- */
  function pick(c, opts, P, L) {
    opts = opts || {};
    var b = opts.brand || 'schneider';
    switch (c.type) {
      case 'mcb': return mcb(c, b);
      case 'rcd': return rcd(c, b);
      case 'main_switch': return mainSwitch(c, b);
      case 'contactor': return contactor(c, b, opts);
      case 'mpcb': return mpcb(c, b);
      case 'overload': return overload(c, b);
      case 'psu': return psu(c, b, opts);
      case 'relay': return relay(c, b, opts);
      case 'timer': return timer(c, b);
      case 'button': case 'estop': case 'lamp': case 'selector': return door(c, b);
      case 'terminal': return terminal(c, b, opts, P, L);
      default: return misc(c, b);
    }
  }

  /* כל הלוח: רכיבים שכבר יש להם מק"ט מהתכנית נשארים, אלא אם overwrite */
  function assign(P, L, opts) {
    opts = opts || {};
    var out = [];
    (P.components || []).forEach(function (c) {
      if (c.zone === 'field' && c.type !== 'fan') return;
      if (!opts.overwrite && c.partNo && c.maker) return;
      var r = pick(c, opts, P, L);
      if (r) out.push(Object.assign({ tag: c.tag }, r));
    });
    return out;
  }

  /* רשימת הזמנה: לפי יצרן ומק"ט, עם כמויות */
  function orderList(P, L, opts) {
    var rows = {};
    var add = function (maker, partNo, desc, qty, tag) {
      var k = maker + '|' + partNo;
      var r = rows[k] || (rows[k] = { maker: maker, partNo: partNo, desc: desc, qty: 0, tags: [] });
      r.qty += qty; if (tag && r.tags.indexOf(tag) < 0) r.tags.push(tag);
    };
    (P.components || []).forEach(function (c) {
      if (c.zone === 'field') return;
      if (c.type === 'terminal') {
        var t = pick(c, opts, P, L);
        if (t && t.lines && (!c.partNo || opts.overwrite || /×/.test(c.partNo))) {
          t.lines.forEach(function (ln) { add(t.maker, ln.partNo + (ln.code ? ' (' + ln.code + ')' : ''), ln.desc, ln.qty, c.tag); });
          return;
        }
      }
      /* פס מהדקים עם מק"ט מהתכנית: הכמות היא מספר ההדקים בפס */
      if (c.type === 'terminal' && c.partNo) {
        var nt = L && L.pins ? Object.keys(L.pins).filter(function (k) { return k.indexOf(c.tag + ':') === 0; }).length : 1;
        add(c.maker || '', c.partNo, 'הדקים לפס ' + c.tag, Math.max(1, nt), c.tag);
        return;
      }
      if (c.partNo) add(c.maker || '', c.partNo, c.partDesc || c.desc || c.name || '', 1, c.tag);
      else add('—', 'חסר מק"ט', (c.name || c.type), 1, c.tag);
    });
    return Object.keys(rows).map(function (k) { return rows[k]; }).sort(function (a, b) { return (a.maker + a.partNo).localeCompare(b.maker + b.partNo); });
  }

  /* מעטפת מומלצת לפי המידות */
  function enclosureFor(enc, brand) {
    var size = enc.w + '×' + enc.h + '×' + enc.d;
    if (brand === 'schneider') return { maker: 'Schneider Electric', partNo: (enc.h >= 1400 ? 'Spacial SF/SM ' : 'Spacial S3D ') + size, exact: false, desc: 'ארון פלדה RAL 7035 עם פלטת הרכבה' };
    if (brand === 'abb') return { maker: 'ABB', partNo: (enc.h >= 1400 ? 'ArTu / SR2 ' : 'SR2 ') + size, exact: false, desc: 'ארון פלדה עם פלטת הרכבה' };
    return { maker: 'Rittal', partNo: (enc.h >= 1400 ? 'VX25 ' : 'AX ') + size, exact: false, desc: 'ארון פלדה RAL 7035 עם פלטת הרכבה' };
  }

  /* קישורים לחלק האמיתי: דף המוצר אצל היצרן (תמונות, נתונים, דף נתונים), חיפוש תמונות וחיפוש דף נתונים */
  function productLinks(maker, partNo) {
    if (!partNo) return null;
    var code = (/\((\d{7}|\d{10}|[0-9A-Z]{4,}R\d{4,})\)/.exec(partNo) || [])[1];
    var first = String(partNo).split(/\s[+(]|\s·/)[0].replace(/^\d+×\s*/, '').trim();
    var m = String(maker || '').toLowerCase(), ref = encodeURIComponent(first), url = null;
    if (/schneider/.test(m)) url = 'https://www.se.com/il/he/product/' + ref + '/';
    else if (/^abb/.test(m)) url = code ? 'https://new.abb.com/products/' + code : 'https://new.abb.com/search/en/results?QueryText=' + ref;
    else if (/siemens/.test(m)) url = 'https://sieportal.siemens.com/en-ww/products-services/detail/' + ref;
    else if (/phoenix/.test(m)) url = code && /^\d{7}$/.test(code) ? 'https://www.phoenixcontact.com/en-pc/products/' + code : 'https://www.phoenixcontact.com/en-pc/search?q=' + ref;
    else if (/weidm/.test(m)) url = 'https://catalog.weidmueller.com/catalog/Start.do?localeId=en&ObjectID=' + encodeURIComponent(code || first);
    else if (/mean ?well/.test(m)) url = 'https://www.meanwell.com/webapp/product/search.aspx?prod=' + ref;
    var q = encodeURIComponent(((maker || '') + ' ' + first).trim());
    return { ref: first, product: url, images: 'https://www.google.com/search?tbm=isch&q=' + q, datasheet: 'https://www.google.com/search?q=' + q + '+datasheet+pdf' };
  }

  return { productLinks: productLinks, BRANDS: BRANDS, TERM_BRANDS: TERM_BRANDS, PSU_BRANDS: PSU_BRANDS, RELAY_BRANDS: RELAY_BRANDS, pick: pick, assign: assign, orderList: orderList, enclosureFor: enclosureFor, amps: amps, poles: poles };
});
