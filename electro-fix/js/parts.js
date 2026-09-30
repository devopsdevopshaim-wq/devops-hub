/* מעגל סגור — ספריית רכיבים ותבניות (שבלונות) מוכנות לתכנון כרטיסים.
   כל תבנית היא סכימה מלאה שעוברת את הבודק האוטומטי בלי שגיאות.
   קובץ משותף: נטען בדפדפן (window.FixParts) ובבדיקות (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FixParts = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // הדק: [מזהה, שם, צד, פוטנציאל]
  var PARTS = {
    resistor: { name: 'נגד', group: 'פסיביים', type: 'resistor', prefix: 'R', value: '10kΩ', t: [['1', '', 'left'], ['2', '', 'right']] },
    capacitor: { name: 'קבל קרמי', group: 'פסיביים', type: 'capacitor', prefix: 'C', value: '100nF', t: [['1', '', 'left'], ['2', '', 'right']] },
    ecap: { name: 'קבל אלקטרוליטי', group: 'פסיביים', type: 'capacitor', prefix: 'C', value: '100µF 25V', t: [['+', 'חיובי', 'left'], ['-', 'שלילי', 'right']] },
    inductor: { name: 'סליל', group: 'פסיביים', type: 'inductor', prefix: 'L', value: '10µH', t: [['1', '', 'left'], ['2', '', 'right']] },
    pot: { name: 'פוטנציומטר', group: 'פסיביים', type: 'resistor', prefix: 'RV', value: '10kΩ', t: [['1', 'קצה', 'left'], ['3', 'קצה', 'left'], ['W', 'מגב', 'right']] },
    crystal: { name: 'גביש', group: 'פסיביים', type: 'crystal', prefix: 'Y', value: '16MHz', t: [['1', '', 'left'], ['2', '', 'right']] },
    fuse: { name: 'נתיך', group: 'פסיביים', type: 'fuse', prefix: 'F', value: '500mA', t: [['1', '', 'left'], ['2', '', 'right']] },

    led: { name: 'נורית LED', group: 'מוליכים למחצה', type: 'led', prefix: 'D', value: 'אדומה 2V 10mA', t: [['A', 'אנודה', 'left'], ['K', 'קתודה', 'right']] },
    diode: { name: 'דיודה', group: 'מוליכים למחצה', type: 'diode', prefix: 'D', value: '1N4007', t: [['A', 'אנודה', 'left'], ['K', 'קתודה', 'right']] },
    npn: { name: 'טרנזיסטור NPN', group: 'מוליכים למחצה', type: 'transistor', prefix: 'Q', value: 'BC547', t: [['B', 'בסיס', 'left'], ['C', 'קולט', 'right'], ['E', 'פולט', 'right']] },
    mosfet: { name: 'MOSFET N', group: 'מוליכים למחצה', type: 'transistor', prefix: 'Q', value: 'AO3400', t: [['G', 'שער', 'left'], ['D', 'מרזב', 'right'], ['S', 'מקור', 'right']] },
    regulator: { name: 'רגולטור מתח', group: 'מוליכים למחצה', type: 'regulator', prefix: 'U', value: 'AMS1117-3.3', t: [['IN', 'כניסה', 'left'], ['GND', 'אדמה', 'left'], ['OUT', 'יציאה', 'right']] },

    mcu: { name: 'מיקרו-בקר ESP32', group: 'רכיבים משולבים', type: 'mcu', prefix: 'U', value: 'ESP32-WROOM-32', t: [['3V3', 'הזנה', 'left', '+3.3V'], ['GND', 'אדמה', 'left', '0V'], ['EN', 'איפוס', 'left'], ['IO0', 'BOOT', 'left'], ['IO2', 'GPIO', 'right'], ['IO4', 'GPIO', 'right'], ['IO5', 'GPIO', 'right'], ['TX', 'UART', 'right'], ['RX', 'UART', 'right']] },
    arduino: { name: 'Arduino Nano', group: 'רכיבים משולבים', type: 'mcu', prefix: 'U', value: 'ATmega328P Nano', t: [['5V', 'הזנה', 'left', '+5V'], ['GND', 'אדמה', 'left', '0V'], ['VIN', 'כניסה 7-12V', 'left'], ['D2', 'GPIO', 'right'], ['D3', 'PWM', 'right'], ['D13', 'LED', 'right'], ['A0', 'אנלוגי', 'right']] },
    ic555: { name: 'טיימר 555', group: 'רכיבים משולבים', type: 'ic', prefix: 'U', value: 'NE555', t: [['VCC', 'הזנה 8', 'left'], ['GND', 'אדמה 1', 'left'], ['TRIG', 'הדק 2', 'left'], ['THR', 'סף 6', 'left'], ['OUT', 'יציאה 3', 'right'], ['DIS', 'פריקה 7', 'right'], ['CV', 'בקרה 5', 'right'], ['RST', 'איפוס 4', 'right']] },
    opto: { name: 'אופטוקפלר', group: 'רכיבים משולבים', type: 'ic', prefix: 'U', value: 'PC817', t: [['A', 'אנודה', 'left'], ['K', 'קתודה', 'left'], ['C', 'קולט', 'right'], ['E', 'פולט', 'right']] },
    sensor: { name: 'חיישן דיגיטלי', group: 'רכיבים משולבים', type: 'ic', prefix: 'U', value: 'DHT22', t: [['VCC', 'הזנה', 'left'], ['GND', 'אדמה', 'left'], ['DATA', 'נתונים', 'right']] },

    usb: { name: 'מחבר USB (5V)', group: 'הזנה ומחברים', type: 'source', prefix: 'J', value: 'USB-C', t: [['VBUS', '5V', 'right', '+5V'], ['GND', 'אדמה', 'right', '0V']] },
    dc12: { name: 'ספק DC 12V', group: 'הזנה ומחברים', type: 'source', prefix: 'J', value: 'שקע DC 5.5mm', t: [['+', '12V', 'right', '+12V'], ['-', 'אדמה', 'right', '0V']] },
    battery: { name: 'סוללה 9V', group: 'הזנה ומחברים', type: 'source', prefix: 'BT', value: '9V', t: [['+', 'חיובי', 'right', '+9V'], ['-', 'שלילי', 'right', '0V']] },
    conn2: { name: 'מחבר 2 פינים', group: 'הזנה ומחברים', type: 'connector', prefix: 'J', value: 'בלוק הדקים 5.08mm', t: [['1', '', 'left'], ['2', '', 'left']] },
    conn3: { name: 'מחבר 3 פינים', group: 'הזנה ומחברים', type: 'connector', prefix: 'J', value: 'בלוק הדקים 5.08mm', t: [['1', '', 'left'], ['2', '', 'left'], ['3', '', 'left']] },
    button: { name: 'לחצן', group: 'הזנה ומחברים', type: 'button', prefix: 'S', value: 'לחצן טקט', t: [['1', '', 'left'], ['2', '', 'right']] },
    relay: { name: 'ממסר', group: 'הזנה ומחברים', type: 'relay', prefix: 'K', value: 'SRD-05VDC', t: [['A1', 'סליל +', 'left'], ['A2', 'סליל −', 'left'], ['COM', 'משותף', 'right'], ['NO', 'פתוח', 'right'], ['NC', 'סגור', 'right']] },
    dcmotor: { name: 'מנוע DC', group: 'הזנה ומחברים', type: 'motor', prefix: 'M', value: '5V 200mA', t: [['+', '', 'left'], ['-', '', 'left']] }
  };

  var RAILS = ['', '+3.3V', '+5V', '+9V', '+12V', '+24V', '0V', 'L', 'N', 'PE'];
  var WIRE_COLORS = ['אדום', 'שחור', 'כחול', 'צהוב', 'ירוק', 'כתום', 'לבן', 'סגול', 'אפור', 'חום', 'כחול כהה', 'ירוק-צהוב'];

  function make(key, id, col, row, over) {
    var p = PARTS[key];
    over = over || {};
    return {
      id: id, label: over.label || p.name, value: over.value != null ? over.value : p.value, type: p.type, col: col, row: row,
      terminals: p.t.map(function (t) {
        var pot = over.pot && over.pot[t[0]] != null ? over.pot[t[0]] : (t[3] || '');
        return { id: t[0], name: (over.names && over.names[t[0]]) || t[1], side: t[2], potential: pot };
      })
    };
  }

  // מזהה פנוי לרכיב חדש: R1, R2, ...
  function nextId(sch, prefix) {
    var used = {};
    (sch.components || []).forEach(function (c) { used[c.id] = 1; });
    for (var n = 1; ; n++) if (!used[prefix + n]) return prefix + n;
  }

  function newComponent(sch, key, col, row) {
    return make(key, nextId(sch, PARTS[key].prefix), col, row);
  }

  function wires(list) {
    return list.map(function (w, i) {
      var color = w[2] || 'כחול';
      return { from: w[0], to: w[1], color: color, section: '', label: String(i + 1) };
    });
  }

  function sch(title, notes, components, wireList) {
    return { needed: true, title: title, notes: notes, components: components, wires: wires(wireList) };
  }

  var R = 'אדום', B = 'שחור', S = 'כחול', Y = 'צהוב', O = 'כתום';

  var TEMPLATES = [
    {
      id: 'blank', name: 'כרטיס ריק עם הזנת USB', desc: 'נקודת התחלה נקייה: מחבר USB עם 5V ו-GND. מוסיפים רכיבים ומחברים.',
      build: function () { return sch('כרטיס חדש', [], [make('usb', 'J1', 0, 0)], []); }
    },
    {
      id: 'led', name: 'נורית עם נגד טורי', desc: 'המעגל הבסיסי ביותר: LED מ-5V דרך נגד שמגביל את הזרם ל-9mA.',
      build: function () {
        return sch('נורית חיווי מ-5V', ['R = (5V − 2V) / 9mA ≈ 330Ω. להספק 0.03W מספיק נגד 1/4W.'], [
          make('usb', 'J1', 0, 0), make('resistor', 'R1', 1, 0, { value: '330Ω' }), make('led', 'D1', 2, 0)
        ], [['J1.VBUS', 'R1.1', R], ['R1.2', 'D1.A', O], ['D1.K', 'J1.GND', B]]);
      }
    },
    {
      id: 'ldo', name: 'ספק 3.3V מ-5V (AMS1117)', desc: 'רגולטור LDO עם קבלי כניסה ויציאה, נורית הזנה ומחבר יציאה. בסיס לכל כרטיס 3.3V.',
      build: function () {
        return sch('ספק 3.3V מ-USB', ['AMS1117 מתחמם: בזרם 500mA הוא מפזר כ-0.85W. השאירו משטח נחושת מתחת ללשונית.', 'קבל היציאה 22µF נדרש ליציבות לפי דף הנתונים.'], [
          make('usb', 'J1', 0, 0), make('regulator', 'U1', 1, 0),
          make('ecap', 'C1', 1, 1, { value: '10µF 16V' }), make('ecap', 'C2', 2, 1, { value: '22µF 10V' }), make('capacitor', 'C3', 2, 2),
          make('resistor', 'R1', 2, 0, { value: '1kΩ' }), make('led', 'D1', 3, 0, { value: 'ירוקה 2V' }),
          make('conn2', 'J2', 3, 1, { label: 'יציאת 3.3V', names: { 1: '3.3V', 2: 'GND' }, pot: { 1: '+3.3V' } })
        ], [
          ['J1.VBUS', 'U1.IN', R], ['J1.VBUS', 'C1.+', R], ['C1.-', 'J1.GND', B], ['U1.GND', 'J1.GND', B],
          ['U1.OUT', 'C2.+', R], ['C2.-', 'U1.GND', B], ['U1.OUT', 'C3.1', R], ['C3.2', 'U1.GND', B],
          ['U1.OUT', 'R1.1', R], ['R1.2', 'D1.A', O], ['D1.K', 'U1.GND', B], ['U1.OUT', 'J2.1', R], ['J2.2', 'U1.GND', B]
        ]);
      }
    },
    {
      id: 'relay', name: 'דרייבר ממסר מיציאת בקר', desc: 'יציאת GPIO מפעילה ממסר 5V דרך טרנזיסטור, עם נגד בסיס, נגד משיכה ודיודת גלגול חופשי.',
      build: function () {
        return sch('דרייבר ממסר 5V מ-GPIO', ['זרם הסליל כ-70mA. BC547 מתאים עד 100mA; לממסר גדול יותר השתמשו ב-MOSFET.', 'אם מגעי הממסר מחליפים 230V: מרווח של 6mm לפחות בין מסלולי המתח הגבוה לנמוך בכרטיס, וחריץ בידוד מתחת לממסר.'], [
          make('usb', 'J1', 0, 0), make('conn2', 'J2', 0, 1, { label: 'מהבקר', names: { 1: 'GPIO', 2: 'GND' }, pot: { 2: '0V' } }),
          make('resistor', 'R1', 1, 1, { value: '1kΩ' }), make('resistor', 'R2', 1, 2, { value: '10kΩ', label: 'נגד משיכה' }),
          make('npn', 'Q1', 2, 1), make('diode', 'D1', 2, 0), make('relay', 'K1', 3, 0),
          make('conn3', 'J3', 4, 0, { label: 'לעומס', names: { 1: 'COM', 2: 'NO', 3: 'NC' } })
        ], [
          ['J2.1', 'R1.1', Y], ['R1.2', 'Q1.B', Y], ['Q1.B', 'R2.1', Y], ['R2.2', 'J1.GND', B], ['J2.2', 'J1.GND', B],
          ['Q1.E', 'J1.GND', B], ['Q1.C', 'K1.A2', S], ['K1.A1', 'J1.VBUS', R], ['D1.K', 'K1.A1', R], ['D1.A', 'K1.A2', S],
          ['K1.COM', 'J3.1', O], ['K1.NO', 'J3.2', O], ['K1.NC', 'J3.3', O]
        ]);
      }
    },
    {
      id: 'esp32', name: 'כרטיס ESP32 בסיסי', desc: 'הזנת USB, רגולטור 3.3V, מודול ESP32 עם מעגל איפוס, לחצני BOOT ו-RESET, קבל ניתוק ונורית על IO2.',
      build: function () {
        return sch('כרטיס ESP32 בסיסי', ['מודול ה-ESP32 צורך עד 500mA בשידור. AMS1117 מספיק, אבל עדיף רגולטור של 800mA ומעלה.', 'השאירו את אזור האנטנה של המודול בלי נחושת מתחתיו ומסביבו, בקצה הכרטיס.', 'קבל ה-100nF צמוד לפין 3V3 של המודול.'], [
          make('usb', 'J1', 0, 0), make('regulator', 'U1', 1, 0), make('ecap', 'C1', 1, 1, { value: '10µF 16V' }), make('ecap', 'C2', 1, 2, { value: '22µF 10V' }),
          make('mcu', 'U2', 3, 0), make('capacitor', 'C3', 2, 1), make('resistor', 'R1', 2, 0, { value: '10kΩ', label: 'משיכת EN' }),
          make('capacitor', 'C4', 2, 2, { value: '1µF', label: 'השהיית איפוס' }), make('button', 'S2', 2, 3, { label: 'RESET' }),
          make('resistor', 'R2', 4, 1, { value: '10kΩ', label: 'משיכת IO0' }), make('button', 'S1', 4, 2, { label: 'BOOT' }),
          make('resistor', 'R3', 4, 0, { value: '1kΩ' }), make('led', 'D1', 5, 0, { value: 'כחולה 3V' })
        ], [
          ['J1.VBUS', 'U1.IN', R], ['J1.VBUS', 'C1.+', R], ['C1.-', 'J1.GND', B], ['U1.GND', 'J1.GND', B],
          ['U1.OUT', 'C2.+', R], ['C2.-', 'J1.GND', B], ['U1.OUT', 'U2.3V3', R], ['U2.GND', 'J1.GND', B],
          ['C3.1', 'U2.3V3', R], ['C3.2', 'U2.GND', B], ['R1.1', 'U2.3V3', R], ['R1.2', 'U2.EN', Y],
          ['C4.1', 'U2.EN', Y], ['C4.2', 'U2.GND', B], ['S2.1', 'U2.EN', Y], ['S2.2', 'U2.GND', B],
          ['R2.1', 'U2.3V3', R], ['R2.2', 'U2.IO0', Y], ['S1.1', 'U2.IO0', Y], ['S1.2', 'U2.GND', B],
          ['U2.IO2', 'R3.1', O], ['R3.2', 'D1.A', O], ['D1.K', 'U2.GND', B]
        ]);
      }
    },
    {
      id: 'divider', name: 'מחלק מתח 12V לכניסה אנלוגית', desc: 'מדידת מתח 12V בכניסת ADC של 3.3V: מחלק 10k/3.3k וקבל סינון.',
      build: function () {
        return sch('מדידת 12V בכניסת ADC', ['Vout = 12V × 3.3k / (10k + 3.3k) ≈ 2.98V. ב-14.4V (סוללה בטעינה) מתקבל 3.57V — מעל 3.3V. להגנה החליפו את R2 ב-2.7kΩ או הוסיפו זנר 3.3V.'], [
          make('dc12', 'J1', 0, 0), make('resistor', 'R1', 1, 0, { value: '10kΩ 1%' }), make('resistor', 'R2', 2, 1, { value: '3.3kΩ 1%' }),
          make('capacitor', 'C1', 2, 2), make('conn2', 'J2', 3, 0, { label: 'ל-ADC', names: { 1: 'ADC', 2: 'GND' } })
        ], [
          ['J1.+', 'R1.1', R], ['R1.2', 'R2.1', Y], ['R2.2', 'J1.-', B], ['R1.2', 'C1.1', Y], ['C1.2', 'J1.-', B], ['R1.2', 'J2.1', Y], ['J2.2', 'J1.-', B]
        ]);
      }
    },
    {
      id: 'ne555', name: 'מהבהב עם טיימר 555', desc: 'NE555 במצב אסטבילי מהבהב נורית בכ-0.7Hz מסוללה 9V.',
      build: function () {
        return sch('מהבהב NE555', ['f ≈ 1.44 / ((R1 + 2·R2) · C1) = 1.44 / (21kΩ · 100µF) ≈ 0.69Hz; מחזור עבודה ≈ 52%.'], [
          make('battery', 'BT1', 0, 0), make('ic555', 'U1', 2, 0), make('resistor', 'R1', 1, 0, { value: '1kΩ' }), make('resistor', 'R2', 1, 1, { value: '10kΩ' }),
          make('ecap', 'C1', 1, 2, { value: '100µF 16V' }), make('capacitor', 'C2', 3, 1, { value: '10nF' }), make('capacitor', 'C3', 0, 1),
          make('resistor', 'R3', 3, 0, { value: '470Ω' }), make('led', 'D1', 4, 0)
        ], [
          ['BT1.+', 'U1.VCC', R], ['BT1.+', 'U1.RST', R], ['U1.GND', 'BT1.-', B], ['C3.1', 'BT1.+', R], ['C3.2', 'BT1.-', B],
          ['R1.1', 'BT1.+', R], ['R1.2', 'U1.DIS', Y], ['R2.1', 'U1.DIS', Y], ['R2.2', 'U1.THR', Y], ['U1.THR', 'U1.TRIG', Y],
          ['C1.+', 'U1.TRIG', Y], ['C1.-', 'BT1.-', B], ['U1.CV', 'C2.1', Y], ['C2.2', 'BT1.-', B],
          ['U1.OUT', 'R3.1', O], ['R3.2', 'D1.A', O], ['D1.K', 'BT1.-', B]
        ]);
      }
    },
    {
      id: 'opto24', name: 'כניסת 24V מבודדת לבקר', desc: 'אות 24V תעשייתי (חיישן, לחצן) לכניסת 3.3V דרך אופטוקפלר PC817, עם הגנה מקוטביות הפוכה.',
      build: function () {
        return sch('כניסת 24V מבודדת (PC817)', ['זרם הלד: (24V − 1.2V) / 2.2kΩ ≈ 10mA; הספק על R1 כ-0.24W — השתמשו בנגד 0.5W.', 'שני צדי הבידוד (0V של 24V ו-GND של הבקר) לא מתחברים. השאירו ביניהם בכרטיס מרווח של 3mm לפחות.'], [
          make('conn2', 'J1', 0, 0, { label: 'כניסת 24V', names: { 1: '24V', 2: '0V שטח' }, pot: { 1: '+24V', 2: '0VF' } }),
          make('resistor', 'R1', 1, 0, { value: '2.2kΩ 0.5W' }), make('diode', 'D1', 1, 1, { value: '1N4148', label: 'הגנה מהיפוך' }),
          make('opto', 'U1', 2, 0), make('resistor', 'R2', 3, 1, { value: '10kΩ', label: 'משיכה ל-3.3V' }),
          make('conn3', 'J2', 4, 0, { label: 'לבקר', names: { 1: '3.3V', 2: 'GPIO', 3: 'GND' }, pot: { 1: '+3.3V', 3: '0V' } })
        ], [
          ['J1.1', 'R1.1', R], ['R1.2', 'U1.A', R], ['U1.K', 'J1.2', S], ['D1.A', 'U1.K', S], ['D1.K', 'U1.A', R],
          ['U1.C', 'J2.2', Y], ['R2.1', 'J2.1', R], ['R2.2', 'U1.C', Y], ['U1.E', 'J2.3', B]
        ]);
      }
    }
  ];

  return { PARTS: PARTS, RAILS: RAILS, WIRE_COLORS: WIRE_COLORS, TEMPLATES: TEMPLATES, make: make, newComponent: newComponent, nextId: nextId };
});
