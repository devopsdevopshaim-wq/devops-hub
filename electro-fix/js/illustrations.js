/* מעגל סגור — איורים להדרכות ללקוחות. כל איור הוא SVG פשוט וברור (מבט חזיתי), עם הדגשה של מה שצריך לעשות.
   החיצים והידיות מונפשים ב-CSS (מחלקות anim-*), ומושבתים למי שביקש פחות תנועה.
   קובץ משותף: נטען בדפדפן (window.Illus) ובבדיקות (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Illus = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NAVY = '#14213d', GOLD = '#c9a45c', RED = '#d64545', GREEN = '#2b8a3e', BLUE = '#2f6bd8', WALL = '#f4efe4', LINE = '#3a4560';

  function svg(body, label) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220" class="illus" role="img" aria-label="' + label + '" font-family="Heebo, Arial, sans-serif">' +
      '<rect width="320" height="220" rx="18" fill="#fbf8f1"/>' + body + '</svg>';
  }
  function txt(x, y, s, size, fill, weight, anchor) {
    return '<text x="' + x + '" y="' + y + '" font-size="' + (size || 12) + '" fill="' + (fill || NAVY) + '" font-weight="' + (weight || 600) + '" text-anchor="' + (anchor || 'middle') + '" direction="rtl">' + s + '</text>';
  }
  function arrow(x1, y1, x2, y2, color, cls) {
    var a = Math.atan2(y2 - y1, x2 - x1), h = 10;
    var p1 = (x2 - h * Math.cos(a - 0.45)) + ' ' + (y2 - h * Math.sin(a - 0.45)), p2 = (x2 - h * Math.cos(a + 0.45)) + ' ' + (y2 - h * Math.sin(a + 0.45));
    return '<g class="' + (cls || 'anim-pulse') + '"><path d="M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2 + '" stroke="' + (color || RED) + '" stroke-width="4" stroke-linecap="round"/><path d="M' + x2 + ' ' + y2 + 'L' + p1 + 'L' + p2 + 'Z" fill="' + (color || RED) + '"/></g>';
  }
  // מאמ"ת (מפסק קטן): up=true למעלה. hl = צבע הדגשה
  function mcb(x, y, up, hl, label) {
    var o = '<g><rect x="' + x + '" y="' + y + '" width="26" height="62" rx="4" fill="#fff" stroke="' + (hl || '#b8bec8') + '" stroke-width="' + (hl ? 3 : 1.5) + '"/>' +
      '<rect x="' + (x + 7) + '" y="' + (y + 16) + '" width="12" height="30" rx="3" fill="#2b2f36"/>' +
      '<rect class="' + (hl && !up ? 'anim-lever' : '') + '" x="' + (x + 8) + '" y="' + (y + (up ? 17 : 31)) + '" width="10" height="14" rx="2" fill="' + (up ? '#e9ecef' : '#f1c40f') + '"/>';
    if (label) o += txt(x + 13, y + 78, label, 9, hl || LINE, 700);
    return o + '</g>';
  }
  function rcd(x, y, up, hl) {
    return '<g><rect x="' + x + '" y="' + y + '" width="54" height="62" rx="4" fill="#fff" stroke="' + (hl || '#b8bec8') + '" stroke-width="' + (hl ? 3 : 1.5) + '"/>' +
      '<rect x="' + (x + 9) + '" y="' + (y + 18) + '" width="36" height="28" rx="3" fill="#2b2f36"/>' +
      '<rect class="' + (hl && !up ? 'anim-lever' : '') + '" x="' + (x + 10) + '" y="' + (y + (up ? 19 : 32)) + '" width="34" height="13" rx="2" fill="' + (up ? '#e9ecef' : '#f1c40f') + '"/>' +
      '<circle cx="' + (x + 45) + '" cy="' + (y + 9) + '" r="5.5" fill="#f2c500" stroke="#b58f00"/><text x="' + (x + 45) + '" y="' + (y + 12.5) + '" font-size="8" font-weight="800" text-anchor="middle" fill="#333">T</text>' +
      txt(x + 27, y + 78, 'פחת', 10, hl || LINE, 800) + '</g>';
  }
  function main(x, y, up, hl) {
    return '<g><rect x="' + x + '" y="' + y + '" width="54" height="62" rx="4" fill="#fff" stroke="' + (hl || '#b8bec8') + '" stroke-width="' + (hl ? 3 : 1.5) + '"/>' +
      '<rect x="' + (x + 9) + '" y="' + (y + 18) + '" width="36" height="28" rx="3" fill="#2b2f36"/>' +
      '<rect class="' + (hl && !up ? 'anim-lever' : '') + '" x="' + (x + 10) + '" y="' + (y + (up ? 19 : 32)) + '" width="34" height="13" rx="2" fill="' + RED + '"/>' +
      txt(x + 27, y + 78, 'ראשי', 10, hl || LINE, 800) + '</g>';
  }
  function panelBox(inner) {
    return '<rect x="22" y="24" width="276" height="150" rx="12" fill="#1c2538" stroke="' + GOLD + '" stroke-width="2"/>' +
      '<rect x="34" y="70" width="252" height="10" rx="2" fill="#9aa1ad"/>' + inner;
  }
  function hand(x, y, rot) {
    return '<g transform="translate(' + x + ' ' + y + ') rotate(' + (rot || 0) + ')"><path d="M0 0c-6-2-9 3-7 8l8 22c2 5 7 8 13 8h12c7 0 12-5 12-12V8c0-3-3-5-6-4l-3 1V2c0-3-3-5-6-4l-3 1v-1c0-3-3-5-6-4l-3 1V-12c0-3-3-5-6-4-2 1-3 3-3 5z" fill="#f2c9a0" stroke="#b07a4f" stroke-width="1.6"/></g>';
  }
  function socket(x, y, hl) {
    return '<g><rect x="' + x + '" y="' + y + '" width="56" height="56" rx="10" fill="#fff" stroke="' + (hl || '#c7cdd6') + '" stroke-width="' + (hl ? 3 : 2) + '"/><circle cx="' + (x + 28) + '" cy="' + (y + 28) + '" r="19" fill="#f1f3f5" stroke="#d0d5dc"/>' +
      '<circle cx="' + (x + 20) + '" cy="' + (y + 28) + '" r="3.3" fill="#3a4560"/><circle cx="' + (x + 36) + '" cy="' + (y + 28) + '" r="3.3" fill="#3a4560"/><rect x="' + (x + 25) + '" y="' + (y + 13) + '" width="6" height="5" rx="1.5" fill="#3a4560"/></g>';
  }
  function plug(x, y, cls) {
    return '<g class="' + (cls || '') + '"><rect x="' + x + '" y="' + y + '" width="34" height="30" rx="8" fill="#e9ecef" stroke="#9aa1ad" stroke-width="1.5"/><path d="M' + (x + 34) + ' ' + (y + 15) + 'q40 0 60 30" stroke="#6c757d" stroke-width="5" fill="none" stroke-linecap="round"/></g>';
  }
  function badge(x, y, ok) {
    return '<g><circle cx="' + x + '" cy="' + y + '" r="16" fill="' + (ok ? GREEN : RED) + '"/>' + (ok ? '<path d="M' + (x - 7) + ' ' + y + 'l5 5 9-10" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' : '<path d="M' + (x - 6) + ' ' + (y - 6) + 'l12 12M' + (x + 6) + ' ' + (y - 6) + 'l-12 12" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>') + '</g>';
  }

  var LIB = {
    'panel-location': function () {
      return svg('<rect x="0" y="0" width="320" height="220" rx="18" fill="' + WALL + '"/><rect x="0" y="186" width="320" height="34" fill="#d8cdb6"/>' +
        '<rect x="40" y="46" width="88" height="140" rx="4" fill="#8a5a3b" stroke="#5e3b24" stroke-width="3"/><circle cx="114" cy="122" r="5" fill="' + GOLD + '"/>' + txt(84, 38, 'דלת הכניסה', 12, LINE) +
        '<rect class="anim-glow" x="172" y="62" width="70" height="92" rx="6" fill="#fff" stroke="' + GOLD + '" stroke-width="3"/><rect x="180" y="74" width="54" height="8" rx="2" fill="#d0d5dc"/><rect x="180" y="90" width="54" height="8" rx="2" fill="#d0d5dc"/><path d="M196 116l-6 12h7l-5 12 13-17h-7l5-7z" fill="' + GOLD + '"/>' +
        txt(207, 176, 'לוח החשמל', 13, NAVY, 800) + arrow(280, 40, 248, 70, RED), 'לוח החשמל נמצא בדרך כלל ליד דלת הכניסה או במסדרון');
    },
    'panel-open': function () {
      return svg(panelBox(main(232, 44, true) + rcd(170, 44, true) + mcb(130, 44, true, null, '1') + mcb(100, 44, true, null, '2') + mcb(70, 44, true, null, '3') + mcb(40, 44, true, null, '4')) +
        txt(259, 200, 'מפסק ראשי', 11, RED, 800) + txt(197, 200, 'ממסר פחת', 11, '#b58f00', 800) + txt(100, 200, 'מפסקים קטנים (מאמ״תים)', 11, LINE, 800), 'לוח חשמל פתוח: מפסק ראשי, ממסר פחת ומפסקים קטנים');
    },
    'panel-mcb-down': function () {
      return svg(panelBox(main(232, 44, true) + rcd(170, 44, true) + mcb(130, 44, true, null, 'סלון') + mcb(100, 44, false, RED, 'מטבח') + mcb(70, 44, true, null, 'חדרים') + mcb(40, 44, true, null, 'מזגן')) +
        arrow(113, 206, 113, 172, RED) + txt(206, 205, 'מפסק אחד למטה = המעגל שקפץ', 12, RED, 800), 'מפסק קטן אחד במצב למטה');
    },
    'panel-rcd-down': function () {
      return svg(panelBox(main(232, 44, true) + rcd(170, 44, false, RED) + mcb(130, 44, true) + mcb(100, 44, true) + mcb(70, 44, true) + mcb(40, 44, true)) +
        arrow(197, 206, 197, 172, RED) + txt(110, 205, 'ממסר הפחת (עם כפתור T) למטה', 12, RED, 800), 'ממסר הפחת במצב למטה');
    },
    'panel-main-down': function () {
      return svg(panelBox(main(232, 44, false, RED) + rcd(170, 44, true) + mcb(130, 44, true) + mcb(100, 44, true) + mcb(70, 44, true) + mcb(40, 44, true)) +
        arrow(259, 206, 259, 172, RED) + txt(140, 205, 'המפסק הראשי (ידית אדומה) למטה', 12, RED, 800), 'המפסק הראשי במצב למטה');
    },
    'panel-all-up': function () {
      return svg(panelBox(main(232, 44, true) + rcd(170, 44, true) + mcb(130, 44, true) + mcb(100, 44, true) + mcb(70, 44, true) + mcb(40, 44, true)) +
        badge(46, 200, true) + txt(180, 205, 'כל הידיות למעלה — הלוח תקין', 12, GREEN, 800), 'כל המפסקים למעלה');
    },
    'all-mcb-down': function () {
      return svg(panelBox(main(232, 44, true) + rcd(170, 44, true, GOLD) + mcb(130, 44, false, BLUE) + mcb(100, 44, false, BLUE) + mcb(70, 44, false, BLUE) + mcb(40, 44, false, BLUE)) +
        txt(160, 205, 'מורידים את כל הקטנים, ואז מרימים את הפחת', 12, NAVY, 800), 'מורידים את כל המפסקים הקטנים');
    },
    'one-by-one-up': function () {
      return svg(panelBox(main(232, 44, true) + rcd(170, 44, true) + mcb(130, 44, true, GREEN, '1') + mcb(100, 44, true, GREEN, '2') + mcb(70, 44, false, BLUE, '3') + mcb(40, 44, false, null, '4')) +
        arrow(83, 206, 83, 174, BLUE) + txt(200, 205, 'מרימים אחד-אחד, ומחכים כמה שניות', 12, NAVY, 800), 'מרימים את המפסקים אחד אחרי השני');
    },
    'lever-up': function () {
      return svg('<rect x="110" y="30" width="100" height="160" rx="10" fill="#fff" stroke="' + GOLD + '" stroke-width="3"/><rect x="134" y="62" width="52" height="96" rx="8" fill="#2b2f36"/>' +
        '<rect class="anim-up" x="138" y="66" width="44" height="42" rx="6" fill="#e9ecef"/>' + arrow(250, 150, 250, 60, GREEN, 'anim-pulse') + hand(196, 96, -20) +
        txt(160, 210, 'בתנועה אחת, עד הסוף למעלה', 13, GREEN, 800), 'מרימים את הידית בתנועה אחת עד הסוף');
    },
    'unplug': function () {
      return svg('<rect x="0" y="0" width="320" height="220" rx="18" fill="' + WALL + '"/>' + socket(196, 70) + plug(110, 82, 'anim-out') + arrow(150, 60, 100, 60, RED) + hand(118, 92, 10) +
        txt(160, 196, 'מושכים בתקע עצמו — לא בכבל', 13, NAVY, 800), 'מוציאים תקעים מהשקעים');
    },
    'plug-one-by-one': function () {
      var o = '<rect x="0" y="0" width="320" height="220" rx="18" fill="' + WALL + '"/>';
      [['מקרר', 40, GREEN], ['קומקום', 130, GREEN], ['מכונת כביסה', 220, RED]].forEach(function (a, i) {
        o += '<rect x="' + a[1] + '" y="56" width="66" height="74" rx="10" fill="#fff" stroke="' + a[2] + '" stroke-width="3"/>' + txt(a[1] + 33, 100, a[0], 11, NAVY, 800) +
          '<circle cx="' + (a[1] + 33) + '" cy="46" r="13" fill="' + NAVY + '"/>' + txt(a[1] + 33, 51, String(i + 1), 13, '#fff', 800) + badge(a[1] + 33, 152, i < 2);
      });
      return svg(o + txt(160, 200, 'מחברים אחד, מחכים 10 שניות, ואז הבא', 12.5, NAVY, 800), 'מחברים מכשירים אחד אחד');
    },
    'light-switch-off': function () {
      return svg('<rect x="0" y="0" width="320" height="220" rx="18" fill="' + WALL + '"/><rect x="118" y="40" width="84" height="120" rx="12" fill="#fff" stroke="#c7cdd6" stroke-width="2"/>' +
        '<rect class="anim-press" x="136" y="62" width="48" height="76" rx="8" fill="#f1f3f5" stroke="#9aa1ad"/><circle cx="160" cy="80" r="4" fill="' + RED + '"/>' + hand(176, 108, -30) +
        txt(160, 196, 'מכבים את מתגי האור באזור שנפל', 13, NAVY, 800), 'מכבים את מתגי התאורה');
    },
    'danger-smoke': function () {
      return svg('<rect x="0" y="0" width="320" height="220" rx="18" fill="#fff1f0"/>' + socket(132, 92, RED) +
        '<path class="anim-smoke" d="M150 86c-10-16 10-20 0-36M166 86c-10-16 10-20 0-36M182 86c-10-16 10-20 0-36" stroke="#8a8f98" stroke-width="5" fill="none" stroke-linecap="round"/>' +
        '<path d="M136 150l-6 10M150 152l-2 12M186 150l6 10" stroke="#f08c00" stroke-width="4" stroke-linecap="round"/>' +
        '<path d="M44 40l26 46H18z" fill="' + RED + '"/>' + txt(44, 78, '!', 26, '#fff', 900) + '<path d="M276 40l26 46h-52z" fill="' + RED + '"/>' + txt(276, 78, '!', 26, '#fff', 900) +
        txt(160, 196, 'ריח שרוף, עשן, ניצוצות או שקע חם — לא נוגעים', 12.5, RED, 800), 'סכנה: עשן, ניצוצות או שקע חם');
    },
    'dry-hands': function () {
      return svg('<rect x="0" y="0" width="320" height="220" rx="18" fill="' + WALL + '"/>' + hand(100, 80, 0) + hand(196, 80, 0) +
        '<path d="M160 40c-12 18-12 30 0 30s12-12 0-30z" fill="' + BLUE + '"/><circle cx="160" cy="58" r="30" fill="none" stroke="' + RED + '" stroke-width="5"/><path d="M139 37l42 42" stroke="' + RED + '" stroke-width="5"/>' +
        txt(160, 176, 'ידיים יבשות, רצפה יבשה, נעליים לרגליים', 13, NAVY, 800), 'עובדים רק בידיים יבשות');
    },
    'neighbors': function () {
      var o = '<rect x="0" y="0" width="320" height="220" rx="18" fill="#1c2538"/><circle cx="270" cy="40" r="16" fill="#f4ead6"/>';
      [[40, 80, 70, 120], [130, 50, 70, 150], [220, 90, 70, 110]].forEach(function (b) {
        o += '<rect x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + b[3] + '" fill="#2c3a55" stroke="#3d4d6e"/>';
        for (var yy = b[1] + 12; yy < b[1] + b[3] - 14; yy += 22) for (var xx = b[0] + 10; xx < b[0] + b[2] - 12; xx += 20) o += '<rect x="' + xx + '" y="' + yy + '" width="10" height="12" fill="#121a2a"/>';
      });
      return svg(o + txt(160, 212, 'גם אצל השכנים חושך? זו הפסקה באזור', 13, '#f4ead6', 800), 'גם לשכנים אין חשמל');
    },
    'phone-call': function () {
      return svg('<rect x="0" y="0" width="320" height="220" rx="18" fill="' + WALL + '"/><rect x="120" y="26" width="80" height="150" rx="14" fill="' + NAVY + '"/><rect x="128" y="40" width="64" height="112" rx="6" fill="#fff"/>' +
        txt(160, 80, '103', 22, NAVY, 900) + txt(160, 100, 'חברת החשמל', 10, LINE, 700) + '<circle class="anim-pulse" cx="160" cy="128" r="12" fill="' + GREEN + '"/><path d="M155 124c2 5 4 7 9 9l2-3 4 2-1 4c-7 1-15-7-14-14l4-1 2 4z" fill="#fff"/>' +
        txt(160, 200, 'מתקשרים ומדווחים', 13, NAVY, 800), 'מתקשרים לחברת החשמל 103');
    },
    'call-electrician': function () {
      return svg('<rect x="0" y="0" width="320" height="220" rx="18" fill="#fff8e6"/><circle cx="110" cy="92" r="40" fill="#f2c9a0"/><path d="M68 86c0-34 84-34 84 0z" fill="#f2c500" stroke="#b58f00" stroke-width="2"/><rect x="64" y="80" width="92" height="8" rx="4" fill="#d4a800"/>' +
        '<rect x="80" y="132" width="60" height="58" rx="10" fill="' + NAVY + '"/><path d="M106 146l-6 12h7l-5 12 13-17h-7l5-7z" fill="' + GOLD + '"/>' +
        '<rect x="196" y="58" width="84" height="120" rx="14" fill="' + NAVY + '"/><rect x="204" y="70" width="68" height="84" rx="6" fill="#fff"/>' + txt(238, 108, 'חשמלאי', 13, NAVY, 800) + txt(238, 126, 'מוסמך', 11, LINE, 700) +
        txt(160, 210, 'כאן עוצרים ומזמינים חשמלאי מוסמך', 13, '#9a5a00', 800), 'מזמינים חשמלאי מוסמך');
    },
    'test-button': function () {
      return svg('<rect x="0" y="0" width="320" height="220" rx="18" fill="' + WALL + '"/>' + '<g transform="translate(110 40) scale(1.8)">' + rcd(0, 0, true, GOLD) + '</g>' + hand(196, 40, 200) + arrow(250, 30, 205, 52, RED) +
        txt(160, 200, 'לחיצה על T — הפחת צריך לקפוץ מיד', 13, NAVY, 800), 'לחיצה על כפתור הבדיקה של ממסר הפחת');
    },
    'bulb': function () {
      return svg('<rect x="0" y="0" width="320" height="220" rx="18" fill="' + WALL + '"/><path d="M160 34a40 40 0 0 0-24 72c6 5 8 10 8 16h32c0-6 2-11 8-16a40 40 0 0 0-24-72z" fill="#fff6d6" stroke="' + GOLD + '" stroke-width="3"/>' +
        '<rect x="144" y="124" width="32" height="10" rx="2" fill="#9aa1ad"/><rect x="146" y="134" width="28" height="8" rx="2" fill="#adb5bd"/><rect x="148" y="142" width="24" height="8" rx="2" fill="#9aa1ad"/>' +
        '<path class="anim-turn" d="M206 80a50 50 0 0 1 0 60" stroke="' + BLUE + '" stroke-width="4" fill="none" marker-end=""/><path d="M200 140l8 2-2-9z" fill="' + BLUE + '"/>' +
        txt(160, 180, 'מכבים, מחכים שתתקרר, מחליפים', 13, NAVY, 800) + txt(160, 200, 'נורה חדשה באותו סוג בסיס (E27 / E14 / GU10)', 11, LINE, 600), 'מחליפים נורה');
    },
    'heater-switch': function () {
      return svg('<rect x="0" y="0" width="320" height="220" rx="18" fill="' + WALL + '"/><rect x="106" y="36" width="108" height="120" rx="12" fill="#fff" stroke="#c7cdd6" stroke-width="2"/>' +
        '<rect x="126" y="58" width="68" height="76" rx="8" fill="#f1f3f5" stroke="#9aa1ad"/><circle class="anim-glow-red" cx="160" cy="76" r="8" fill="' + RED + '"/>' + txt(160, 120, 'דוד', 14, NAVY, 800) +
        txt(160, 180, 'מפסק הדוד דולק — הנורית האדומה מאירה', 13, NAVY, 800) + txt(160, 200, 'בדרך כלל מחוץ לחדר הרחצה', 11, LINE, 600), 'מפסק הדוד עם נורית');
    },
    'socket-test': function () {
      return svg('<rect x="0" y="0" width="320" height="220" rx="18" fill="' + WALL + '"/>' + socket(180, 80) + plug(108, 92) +
        '<path d="M78 70a24 24 0 0 0-14 43c3 3 4 6 4 9h20c0-3 1-6 4-9a24 24 0 0 0-14-43z" fill="#fff6d6" stroke="' + GOLD + '" stroke-width="2.5"/><path class="anim-pulse" d="M78 52v-10M52 62l-7-7M104 62l7-7" stroke="' + GOLD + '" stroke-width="3" stroke-linecap="round"/>' +
        txt(160, 196, 'בודקים עם מכשיר שעובד בוודאות', 13, NAVY, 800), 'בודקים שקע עם מכשיר תקין');
    },
    'router-reset': function () {
      return svg('<rect x="0" y="0" width="320" height="220" rx="18" fill="' + WALL + '"/><rect x="90" y="96" width="140" height="44" rx="10" fill="' + NAVY + '"/><path d="M120 96l-12-40M200 96l12-40" stroke="' + NAVY + '" stroke-width="5" stroke-linecap="round"/>' +
        '<circle cx="120" cy="118" r="4" fill="' + GREEN + '"/><circle cx="136" cy="118" r="4" fill="' + GREEN + '"/><circle cx="152" cy="118" r="4" fill="#f08c00"/>' +
        '<path class="anim-turn" d="M250 100a26 26 0 1 1-8-18" stroke="' + BLUE + '" stroke-width="4" fill="none"/><path d="M240 70l4 14 12-6z" fill="' + BLUE + '"/>' +
        txt(160, 182, 'מנתקים מהחשמל ל-30 שניות ומחברים שוב', 13, NAVY, 800), 'מאתחלים את הנתב');
    },
    'appliance-cord': function () {
      return svg('<rect x="0" y="0" width="320" height="220" rx="18" fill="' + WALL + '"/><rect x="40" y="60" width="90" height="100" rx="12" fill="#fff" stroke="#9aa1ad" stroke-width="2"/><circle cx="85" cy="110" r="28" fill="#e9ecef" stroke="#9aa1ad"/>' +
        '<path d="M130 120q40 0 60-10t60 10" stroke="#6c757d" stroke-width="6" fill="none" stroke-linecap="round"/><circle class="anim-glow-red" cx="198" cy="108" r="16" fill="none" stroke="' + RED + '" stroke-width="3"/><path d="M193 102l4 6-5 4 6 4" stroke="#f08c00" stroke-width="2.5" fill="none"/>' +
        txt(160, 196, 'כבל סדוק או תקע שחור — לא משתמשים', 12.5, RED, 800), 'בודקים את כבל המכשיר');
    },
    'fire-ext': function () {
      return svg('<rect x="0" y="0" width="320" height="220" rx="18" fill="#fff1f0"/><path d="M84 150c-26-20-10-56 6-70 0 18 14 22 14 22 0-26 12-44 30-52-6 22 30 40 18 76-4 12-16 24-30 24z" fill="#f08c00"/><path d="M98 152c-10-10-4-26 4-32 0 8 8 12 8 12 2-10 8-18 14-20-2 12 10 22 2 36z" fill="#ffd43b"/>' +
        '<rect x="200" y="70" width="40" height="100" rx="12" fill="' + RED + '"/><rect x="208" y="56" width="24" height="16" rx="4" fill="#495057"/><path d="M232 62h26l10 10" stroke="#495057" stroke-width="5" fill="none"/>' +
        '<circle cx="160" cy="40" r="22" fill="none" stroke="' + RED + '" stroke-width="4"/><path d="M160 26c-7 10-7 17 0 17s7-7 0-17z" fill="' + BLUE + '"/><path d="M145 25l30 30" stroke="' + RED + '" stroke-width="4"/>' +
        txt(160, 200, 'שריפה חשמלית: 102, ולא מכבים במים', 13, RED, 800), 'שריפה חשמלית: מתקשרים 102 ולא מכבים במים');
    },
    'app-check': function () {
      return svg('<rect x="0" y="0" width="320" height="220" rx="18" fill="' + WALL + '"/><rect x="120" y="22" width="80" height="150" rx="14" fill="' + NAVY + '"/><rect x="128" y="36" width="64" height="112" rx="6" fill="#fff"/>' +
        '<rect x="136" y="48" width="48" height="20" rx="5" fill="#e7f3e8"/><circle cx="146" cy="58" r="4" fill="' + GREEN + '"/><rect x="136" y="76" width="48" height="20" rx="5" fill="#fbe9e7"/><circle cx="146" cy="86" r="4" fill="' + RED + '"/><rect x="136" y="104" width="48" height="20" rx="5" fill="#e7f3e8"/><circle cx="146" cy="114" r="4" fill="' + GREEN + '"/>' +
        txt(160, 196, 'באפליקציה: איזה מכשיר מסומן "לא מחובר"?', 13, NAVY, 800), 'בודקים באפליקציה איזה מכשיר לא מחובר');
    },
    'success': function () {
      return svg('<rect x="0" y="0" width="320" height="220" rx="18" fill="#eef7ef"/><circle class="anim-pop" cx="160" cy="92" r="52" fill="' + GREEN + '"/><path d="M134 92l18 18 34-38" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
        txt(160, 182, 'הבעיה טופלה', 18, GREEN, 900), 'הבעיה טופלה');
    }
  };

  function render(key) { return (LIB[key] || LIB['panel-open'])(); }

  return { KEYS: Object.keys(LIB), render: render, has: function (k) { return !!LIB[k]; } };
});
