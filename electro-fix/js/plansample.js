/* מעגל סגור — שרטוט לדוגמה: דירת 4.5 חדרים (14×10 מ׳), כתמונה ותוצאת הניתוח שלה.
   משמש ככפתור "דוגמה" באתר וכנתוני בדיקה. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PlanSample = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
var W = 1400, H = 1000, PPM = 100;
var R = [
  ['living', 'סלון', 0, 0, 6, 5, [[6, 4.3]], [[3, 0], [0, 2.5]]],
  ['kitchen', 'מטבח', 6, 0, 10, 3.5, [[8, 3.5]], [[8, 0]]],
  ['entrance', 'מבואה', 6, 3.5, 10, 5, [[10, 4.2], [8, 3.5]], []],
  ['master', 'חדר שינה הורים', 10, 0, 14, 4.5, [[10.6, 4.5]], [[12, 0], [14, 2.2]]],
  ['bath', 'רחצה הורים', 10, 4.5, 12, 6.5, [[10.6, 4.5]], [[11, 6.5]]],
  ['mamad', 'ממ״ד', 12, 4.5, 14, 8, [[12, 6]], [[14, 6.2]]],
  ['bedroom', 'חדר ילדים', 0, 5, 4, 8.5, [[3.4, 5]], [[0, 6.8]]],
  ['bath', 'רחצה כללי', 4, 5, 6, 7.5, [[6, 5.6]], []],
  ['hall', 'מסדרון', 6, 5, 10, 6.5, [[6, 5.6], [8, 6.5], [10, 6]], []],
  ['office', 'חדר עבודה', 6, 6.5, 10, 10, [[8, 6.5]], [[8, 10]]],
  ['laundry', 'מרפסת שירות', 4, 7.5, 6, 10, [[5, 7.5]], [[6, 9]]],
  ['toilet', 'שירותים', 10, 6.5, 12, 8, [[10, 7.2]], []],
  ['balcony', 'מרפסת', 0, 8.5, 4, 10, [[2, 8.5]], [[2, 10]]]
];

function n(v, max) { return Math.round(v / max * 1000); }

function sampleProject() {
  var rooms = R.map(([type, name, x0, y0, x1, y1, doors, wins], i) => ({
    id: 'r' + (i + 1), type, name,
    box: { x0: n(x0, 14), y0: n(y0, 10), x1: n(x1, 14), y1: n(y1, 10) },
    width_m: +(x1 - x0).toFixed(2), length_m: +(y1 - y0).toFixed(2), area_m2: +((x1 - x0) * (y1 - y0)).toFixed(1),
    doors: doors.map(([x, y]) => ({ x: n(x, 14), y: n(y, 10) })),
    windows: wins.map(([x, y]) => ({ x: n(x, 14), y: n(y, 10) }))
  }));
  return {
    title: 'דירת 4.5 חדרים', kind: 'apartment', supply: '3x25', tech: 'wifi',
    floors: [{
      id: 'f1', label: 'קומה 3', level: 3, repeat: 1, kind: 'residential', image_index: 0, w: W, h: H,
      apartments: [{ id: 'a1', name: 'דירה 7', entrance: { x: n(10, 14), y: n(4.2, 10) }, panel: { x: n(10, 14), y: n(4.6, 10) }, rooms }],
      common: []
    }]
  };
}

// שרטוט אדריכלי פשוט: קירות, שמות חדרים ומידות
function sampleSvg() {
  var p = (v) => v * PPM;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial">`;
  s += `<rect width="${W}" height="${H}" fill="#fff"/>`;
  for (var [, name, x0, y0, x1, y1] of R) {
    s += `<rect x="${p(x0)}" y="${p(y0)}" width="${p(x1 - x0)}" height="${p(y1 - y0)}" fill="none" stroke="#111" stroke-width="10"/>`;
    s += `<text x="${p((x0 + x1) / 2)}" y="${p((y0 + y1) / 2)}" text-anchor="middle" direction="rtl" font-size="26" fill="#222">${name}</text>`;
    s += `<text x="${p((x0 + x1) / 2)}" y="${p((y0 + y1) / 2) + 30}" text-anchor="middle" font-size="18" fill="#555">${(x1 - x0).toFixed(2)}×${(y1 - y0).toFixed(2)}</text>`;
  }
  for (var [, , , , , , doors] of R) for (var [x, y] of doors) s += `<circle cx="${p(x)}" cy="${p(y)}" r="22" fill="#fff" stroke="#888" stroke-width="3"/>`;
  return s + '</svg>';
}

  return { sampleProject: sampleProject, sampleSvg: sampleSvg, W: W, H: H };
});
