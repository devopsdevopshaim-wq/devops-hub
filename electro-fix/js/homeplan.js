/* מעגל סגור — תכנון חשמל לבית: נקודות לכל חדר, חלוקה למעגלים, לוח חשמל דירתי, מרשם מעגלים ושכבת בית חכם.
   הכללים הם הנחיות מקובלות לתכנון ראשוני בישראל ואינם תחליף לתכנון ולביצוע של חשמלאי מוסמך לפי חוק החשמל ותקנותיו.
   קובץ משותף: נטען בדפדפן (window.HomePlan) ובבדיקות (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HomePlan = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SUPPLIES = {
    '1x40': { name: 'חד-פאזי 1×40A', phases: 1, amps: 40, main: 'מפסק ראשי 2P 40A', mainMod: 2 },
    '3x25': { name: 'תלת-פאזי 3×25A', phases: 3, amps: 25, main: 'מפסק ראשי 4P 3×25A', mainMod: 4 },
    '3x40': { name: 'תלת-פאזי 3×40A', phases: 3, amps: 40, main: 'מפסק ראשי 4P 3×40A', mainMod: 4 },
    '3x63': { name: 'תלת-פאזי 3×63A', phases: 3, amps: 63, main: 'מפסק ראשי 4P 3×63A', mainMod: 4 }
  };

  // מכשירים במעגל ייעודי. kw = הספק מחובר, df = מקדם ביקוש, amps/cable לחד-פאזי, tri = חלופה תלת-פאזית
  var APPLIANCES = {
    oven: { name: 'תנור בנוי', kw: 3.0, df: 0.4, amps: 16, cable: '3×2.5' },
    cooktop: { name: 'כיריים אינדוקציה', kw: 7.2, df: 0.35, amps: 32, cable: '3×6', tri: { amps: 16, cable: '5×2.5' } },
    dishwasher: { name: 'מדיח כלים', kw: 2.0, df: 0.3, amps: 16, cable: '3×2.5' },
    fridge: { name: 'מקרר (שקע ייעודי)', kw: 0.3, df: 0.5, amps: 16, cable: '3×2.5' },
    washer: { name: 'מכונת כביסה', kw: 2.2, df: 0.3, amps: 16, cable: '3×2.5' },
    dryer: { name: 'מייבש כביסה', kw: 2.5, df: 0.3, amps: 16, cable: '3×2.5' },
    heater: { name: 'דוד חשמל', kw: 2.5, df: 0.6, amps: 16, cable: '3×2.5', timer: true },
    ev: { name: 'עמדת טעינה לרכב', kw: 7.4, df: 1, amps: 32, cable: '3×6', tri: { amps: 16, cable: '5×4', kw: 11 }, rcdB: true },
    comm: { name: 'ארון תקשורת', kw: 0.15, df: 1, amps: 16, cable: '3×2.5' }
  };

  var AC_SIZES = {
    '': null,
    '1': { name: 'מזגן 1 כ״ס', kw: 0.9, amps: 16, cable: '3×2.5' },
    '1.5': { name: 'מזגן 1.5 כ״ס', kw: 1.3, amps: 16, cable: '3×2.5' },
    '2.5': { name: 'מזגן 2.5 כ״ס', kw: 2.2, amps: 16, cable: '3×2.5' },
    '3.5': { name: 'מזגן 3.5 כ״ס', kw: 3.1, amps: 20, cable: '3×4' },
    central: { name: 'מיני מרכזי 5 כ״ס', kw: 4.4, amps: 32, cable: '3×6', tri: { amps: 16, cable: '5×2.5' } }
  };

  // סוגי חדרים וברירות מחדל
  var ROOMS = {
    living: { name: 'סלון', area: 28, sockets: function (a) { return Math.max(6, Math.ceil(a / 4.5)); }, lights: function (a) { return a > 25 ? 4 : 3; }, net: 2, tv: 1, ac: '2.5', smoke: true },
    kitchen: { name: 'מטבח', area: 12, sockets: function () { return 6; }, lights: function () { return 3; }, net: 0, tv: 0, ac: '', app: ['oven', 'cooktop', 'dishwasher', 'fridge'], kitchen: true },
    master: { name: 'חדר שינה הורים', area: 14, sockets: function () { return 5; }, lights: function () { return 2; }, net: 1, tv: 1, ac: '1.5', smoke: true },
    bedroom: { name: 'חדר שינה', area: 11, sockets: function () { return 4; }, lights: function () { return 1; }, net: 1, tv: 0, ac: '1', smoke: true },
    mamad: { name: 'ממ״ד', area: 10, sockets: function () { return 4; }, lights: function () { return 1; }, net: 1, tv: 0, ac: '1', smoke: true, mamad: true },
    office: { name: 'חדר עבודה', area: 10, sockets: function () { return 6; }, lights: function () { return 1; }, net: 2, tv: 0, ac: '1' },
    bath: { name: 'חדר רחצה', area: 5, sockets: function () { return 1; }, lights: function () { return 2; }, net: 0, tv: 0, ac: '', app: ['heater'], wet: true, fan: 1 },
    toilet: { name: 'שירותים', area: 2, sockets: function () { return 0; }, lights: function () { return 1; }, net: 0, tv: 0, ac: '', wet: true, fan: 1 },
    laundry: { name: 'חדר כביסה', area: 4, sockets: function () { return 1; }, lights: function () { return 1; }, net: 0, tv: 0, ac: '', app: ['washer', 'dryer'], wet: true },
    balcony: { name: 'מרפסת', area: 10, sockets: function () { return 2; }, lights: function () { return 2; }, net: 0, tv: 0, ac: '', wet: true, outdoor: true },
    hall: { name: 'מסדרון', area: 8, sockets: function () { return 2; }, lights: function () { return 2; }, net: 0, tv: 0, ac: '', smoke: true, twoWay: true },
    entrance: { name: 'כניסה', area: 4, sockets: function () { return 1; }, lights: function () { return 1; }, net: 0, tv: 0, ac: '', app: ['comm'] },
    storage: { name: 'מחסן', area: 4, sockets: function () { return 1; }, lights: function () { return 1; }, net: 0, tv: 0, ac: '' },
    yard: { name: 'חצר / גינה', area: 40, sockets: function () { return 2; }, lights: function () { return 4; }, net: 0, tv: 0, ac: '', wet: true, outdoor: true },
    parking: { name: 'חניה', area: 15, sockets: function () { return 1; }, lights: function () { return 1; }, net: 0, tv: 0, ac: '', app: ['ev'], outdoor: true }
  };

  var SMART_TECH = {
    none: { name: 'ללא בית חכם' },
    wifi: { name: 'Wi-Fi (למשל Shelly)', desc: 'מודולים קטנים מאחורי המתגים הקיימים, מתחברים לרשת הביתית. זול ומהיר להתקנה, מתאים גם לשיפוץ.' },
    zigbee: { name: 'Zigbee (רכזת + מודולים)', desc: 'רשת אלחוטית חסכונית ויציבה עם רכזת מרכזית (למשל Home Assistant). חיישנים על סוללה מחזיקים שנים.' },
    knx: { name: 'KNX חוטי', desc: 'תקן מקצועי חוטי: כבל בקרה ירוק לכל חדר ומפעילים בלוח. הכי אמין ומתאים לבנייה חדשה, יקר יותר.' }
  };

  var n = 0;
  function rid() { return 'r' + Date.now().toString(36) + (n++).toString(36); }

  function newRoom(type, name) {
    var t = ROOMS[type];
    var r = {
      id: rid(), type: type, name: name || t.name, area: t.area,
      sockets: t.sockets(t.area), lights: t.lights(t.area), net: t.net, tv: t.tv, ac: t.ac,
      app: {}, smart: { lights: true, shutters: 0, ac: !!t.ac, motion: !!(t.twoWay || type === 'entrance'), leak: !!t.wet && type !== 'balcony', smoke: !!t.smoke, contacts: 0 }
    };
    (t.app || []).forEach(function (a) { r.app[a] = true; });
    if (['living', 'master', 'bedroom', 'mamad', 'office', 'kitchen'].indexOf(type) >= 0) r.smart.shutters = type === 'living' ? 2 : 1;
    if (type === 'living' || type === 'balcony') r.smart.contacts = 1;
    return r;
  }

  var PRESETS = {
    apt3: { name: 'דירת 3 חדרים', supply: '3x25', rooms: [['living'], ['kitchen'], ['master'], ['mamad'], ['bath'], ['toilet'], ['balcony'], ['hall'], ['entrance']] },
    apt4: { name: 'דירת 4 חדרים', supply: '3x25', rooms: [['living'], ['kitchen'], ['master'], ['bedroom', 'חדר ילדים'], ['mamad'], ['bath', 'חדר רחצה הורים'], ['bath', 'חדר רחצה כללי'], ['toilet'], ['laundry'], ['balcony'], ['hall'], ['entrance']] },
    apt5: { name: 'דירת 5 חדרים', supply: '3x25', rooms: [['living'], ['kitchen'], ['master'], ['bedroom', 'חדר ילדים 1'], ['bedroom', 'חדר ילדים 2'], ['mamad'], ['bath', 'חדר רחצה הורים'], ['bath', 'חדר רחצה כללי'], ['toilet'], ['laundry'], ['balcony'], ['hall'], ['entrance']] },
    house: { name: 'בית פרטי', supply: '3x40', rooms: [['living'], ['kitchen'], ['master'], ['bedroom', 'חדר ילדים 1'], ['bedroom', 'חדר ילדים 2'], ['office'], ['mamad'], ['bath', 'חדר רחצה הורים'], ['bath', 'חדר רחצה כללי'], ['toilet'], ['laundry'], ['balcony'], ['hall'], ['entrance'], ['storage'], ['yard'], ['parking']] }
  };

  function preset(key) {
    var p = PRESETS[key];
    return {
      name: p.name, supply: p.supply, tech: 'wifi', spd: true, shabbat: true,
      rooms: p.rooms.map(function (x) {
        var r = newRoom(x[0], x[1]);
        // דוד אחד לבית: רק בחדר הרחצה הראשון
        return r;
      }).map(function (r, i, all) {
        if (r.type === 'bath' && all.filter(function (x, j) { return x.type === 'bath' && j < i; }).length) r.app.heater = false;
        return r;
      })
    };
  }

  /* ---------- חלוקה למעגלים ---------- */

  var LIGHTS_PER = 10, SOCKETS_PER = 8, KITCHEN_PER = 6, WET_PER = 6;

  function circuits(plan) {
    var sup = SUPPLIES[plan.supply] || SUPPLIES['1x40'];
    var tri = sup.phases === 3;
    var out = [];
    function add(c) { c.id = out.length + 1; out.push(c); return c; }
    function pack(list, per, make) {
      var cur = null;
      list.forEach(function (it) {
        var left = it.count;
        // חדר שנכנס שלם למעגל חדש לא מתפצל בין שני מעגלים
        if (cur && cur.points + left > per && left <= per) cur = null;
        while (left > 0) {
          if (!cur || cur.points >= per) cur = add(make());
          var take = Math.min(left, per - cur.points);
          cur.points += take;
          if (cur.rooms.indexOf(it.name) < 0) cur.rooms.push(it.name);
          left -= take;
        }
      });
    }
    var rooms = plan.rooms || [];

    pack(rooms.filter(function (r) { return r.lights > 0; }).map(function (r) { return { name: r.name, count: r.lights }; }), LIGHTS_PER,
      function () { return { kind: 'light', title: 'תאורה', rooms: [], points: 0, amps: 10, poles: 1, cable: '3×1.5', kw: 0, df: 0.6 }; });

    pack(rooms.filter(function (r) { return ROOMS[r.type].kitchen && r.sockets > 0; }).map(function (r) { return { name: r.name, count: r.sockets }; }), KITCHEN_PER,
      function () { return { kind: 'socket', title: 'שקעי משטח עבודה', rooms: [], points: 0, amps: 16, poles: 1, cable: '3×2.5', kw: 3.5, df: 0.15 }; });

    pack(rooms.filter(function (r) { return !ROOMS[r.type].kitchen && !ROOMS[r.type].wet && !ROOMS[r.type].outdoor && r.sockets > 0; }).map(function (r) { return { name: r.name, count: r.sockets }; }), SOCKETS_PER,
      function () { return { kind: 'socket', title: 'שקעים', rooms: [], points: 0, amps: 16, poles: 1, cable: '3×2.5', kw: 3.5, df: 0.15 }; });

    pack(rooms.filter(function (r) { return (ROOMS[r.type].wet || ROOMS[r.type].outdoor) && !ROOMS[r.type].kitchen && (r.sockets > 0 || ROOMS[r.type].fan); }).map(function (r) { return { name: r.name, count: r.sockets + (ROOMS[r.type].fan || 0) }; }), WET_PER,
      function () { return { kind: 'socket', title: 'שקעים ומאווררים — אזורים רטובים וחוץ', rooms: [], points: 0, amps: 16, poles: 1, cable: '3×2.5', kw: 2.5, df: 0.15, ip: 'IP44' }; });

    rooms.forEach(function (r) {
      var ac = AC_SIZES[r.ac];
      if (ac) {
        var t3 = tri && ac.tri;
        add({ kind: 'ac', title: ac.name, rooms: [r.name], points: 1, amps: t3 ? ac.tri.amps : ac.amps, poles: t3 ? 3 : 1, cable: t3 ? ac.tri.cable : ac.cable, kw: ac.kw, df: 0.7 });
      }
      Object.keys(r.app || {}).forEach(function (k) {
        if (!r.app[k]) return;
        var a = APPLIANCES[k];
        var t = tri && a.tri;
        add({ kind: k, title: a.name, rooms: [r.name], points: 1, amps: t ? a.tri.amps : a.amps, poles: t ? 3 : 1, cable: t ? a.tri.cable : a.cable, kw: t && a.tri.kw ? a.tri.kw : a.kw, df: a.df, timer: !!a.timer, rcdB: !!a.rcdB });
      });
    });

    // שיוך פאזות: המעגל הכבד ביותר לפאזה העמוסה פחות
    var load = [0, 0, 0];
    out.forEach(function (c) {
      if (c.kind === 'light') c.kw = c.points * 0.08; // כ-80W לנקודת מאור LED
      c.demand = c.kw * c.df;
      c.breaker = 'C' + c.amps + (c.poles === 3 ? ' 3P' : '');
    });
    if (tri) {
      out.filter(function (c) { return c.poles === 3; }).forEach(function (c) { c.phase = 'L1+L2+L3'; for (var i = 0; i < 3; i++) load[i] += c.demand / 3; });
      out.filter(function (c) { return c.poles === 1; }).slice().sort(function (a, b) { return b.demand - a.demand; }).forEach(function (c) {
        var i = load.indexOf(Math.min.apply(null, load));
        c.phase = 'L' + (i + 1);
        load[i] += c.demand;
      });
    } else {
      out.forEach(function (c) { c.phase = 'L'; load[0] += c.demand; });
    }

    // ממסרי פחת: עמדת טעינה לבד (סוג B), והשאר בקבוצות של עד 8 מעגלים
    var normal = out.filter(function (c) { return !c.rcdB; });
    var groups = Math.max(1, Math.ceil(normal.length / 8));
    var rcds = [];
    for (var g = 0; g < groups; g++) rcds.push({ id: 'RCD' + (g + 1), name: 'ממסר פחת ' + (g + 1), type: 'A', ma: 30, amps: sup.amps > 40 ? 63 : 40, poles: tri ? 4 : 2, circuits: [] });
    // מפזרים: תאורה ושקעים לסירוגין, כדי שקפיצה אחת לא תחשיך את כל הבית
    var order = normal.filter(function (c) { return c.kind === 'light'; }).concat(normal.filter(function (c) { return c.kind !== 'light'; }));
    order.forEach(function (c, i) { var r = rcds[i % groups]; r.circuits.push(c); c.rcd = r.id; });
    out.filter(function (c) { return c.rcdB; }).forEach(function (c, i) {
      var r = { id: 'RCD-B' + (i + 1), name: 'ממסר פחת סוג B לטעינה', type: 'B', ma: 30, amps: 40, poles: c.poles === 3 ? 4 : 2, circuits: [c] };
      rcds.push(r);
      c.rcd = r.id;
    });

    // מקדם בו-זמניות כללי: ככל שיש יותר מעגלים, פחות סביר שכולם בשיא יחד
    var coin = out.length > 15 ? 0.8 : out.length > 8 ? 0.9 : 1;
    load = load.map(function (kw) { return kw * coin; });
    var perPhaseA = load.slice(0, tri ? 3 : 1).map(function (kw) { return kw * 1000 / 230; });
    return { circuits: out, rcds: rcds, supply: sup, loadKw: load, perPhaseA: perPhaseA, tri: tri };
  }

  /* ---------- בית חכם ---------- */

  function smart(plan) {
    var tech = plan.tech || 'none';
    var rooms = plan.rooms || [];
    var dev = {}, wiring = [], panel = [], scenes = [];
    function addDev(key, name, qty, where, note) {
      if (!qty) return;
      var d = dev[key] = dev[key] || { name: name, qty: 0, where: [], note: note || '' };
      d.qty += qty;
      if (where && d.where.indexOf(where) < 0) d.where.push(where);
    }
    if (tech === 'none') return { tech: tech, devices: [], wiring: [], panel: [], scenes: [] };
    var lightsSmart = 0, shutters = 0;
    rooms.forEach(function (r) {
      var s = r.smart || {};
      var lg = s.lights ? Math.ceil(r.lights / 2) : 0;
      lightsSmart += s.lights ? r.lights : 0;
      shutters += s.shutters || 0;
      if (tech === 'wifi') {
        addDev('relay', 'מודול תאורה Wi-Fi דו-ערוצי (Shelly Plus 2PM / 2 Mini)', lg, r.name, 'מאחורי המתג, צריך אפס בקופסה');
        addDev('shutter', 'מודול תריס Wi-Fi (Shelly Plus 2PM)', s.shutters, r.name);
        addDev('ir', 'בקר מזגן IR חכם (Sensibo / Broadlink)', s.ac && r.ac ? 1 : 0, r.name);
        addDev('motion', 'חיישן תנועה (Shelly BLU Motion)', s.motion ? 1 : 0, r.name);
        addDev('leak', 'חיישן הצפה (Shelly Flood)', s.leak ? 1 : 0, r.name);
        addDev('contact', 'חיישן פתיחת חלון/דלת (Shelly BLU Door/Window)', s.contacts, r.name);
      } else if (tech === 'zigbee') {
        addDev('relay', 'מודול תאורה Zigbee דו-ערוצי (Aqara T2 / Moes)', lg, r.name, 'מאחורי המתג, צריך אפס בקופסה');
        addDev('shutter', 'מודול תריס Zigbee', s.shutters, r.name);
        addDev('ir', 'בקר מזגן IR Zigbee', s.ac && r.ac ? 1 : 0, r.name);
        addDev('motion', 'חיישן נוכחות Zigbee (Aqara P1/FP2)', s.motion ? 1 : 0, r.name);
        addDev('leak', 'חיישן הצפה Zigbee', s.leak ? 1 : 0, r.name);
        addDev('contact', 'חיישן פתיחה Zigbee', s.contacts, r.name);
      } else if (tech === 'knx') {
        addDev('push', 'לחצן KNX רב-ערוצי (4–6 לחצנים)', s.lights || s.shutters ? 1 : 0, r.name);
        addDev('motion', 'גלאי נוכחות KNX תקרתי', s.motion ? 1 : 0, r.name);
        addDev('hvac', 'ממשק מזגן KNX (Intesis / CoolMaster)', s.ac && r.ac ? 1 : 0, r.name);
        addDev('leak', 'חיישן הצפה עם כניסה בינארית KNX', s.leak ? 1 : 0, r.name);
        addDev('contact', 'מגע חלון לכניסה בינארית KNX', s.contacts, r.name);
      }
      addDev('smoke', 'גלאי עשן חכם', s.smoke ? 1 : 0, r.name);
    });

    if (tech === 'wifi') {
      addDev('meter', 'מד אנרגיה תלת-פאזי בלוח (Shelly Pro 3EM)', 1, 'לוח החשמל');
      addDev('heater', 'מפסק חכם לדוד בלוח (Shelly Pro 1PM)', rooms.some(function (r) { return r.app && r.app.heater; }) ? 1 : 0, 'לוח החשמל');
      addDev('ap', 'נקודת גישה Wi-Fi תקרתית (Mesh)', Math.max(1, Math.ceil(area(rooms) / 80)), 'תקרה');
      panel.push({ name: 'מד אנרגיה Shelly Pro 3EM', mod: 4 }, { name: 'מפסק חכם לדוד', mod: 1 });
      wiring.push('אפס (N) בכל קופסת מתג — המודולים צריכים אותו. בבנייה ישנה לעיתים חסר, ויש להשחיל.', 'קופסאות מתג עמוקות (55 מ״מ לפחות) כדי שהמודול ייכנס מאחורי המתג.', 'כיסוי Wi-Fi טוב בכל הבית: נקודת גישה תקרתית עם כבל CAT6 לכל 80 מ״ר בערך.', 'מודולים בלוח (מד אנרגיה, דוד) לפי מקום שמור בלוח.');
    } else if (tech === 'zigbee') {
      addDev('hub', 'רכזת בית חכם (Home Assistant Green + מקלט Zigbee)', 1, 'ארון תקשורת');
      addDev('meter', 'מד אנרגיה חכם בלוח', 1, 'לוח החשמל');
      panel.push({ name: 'מד אנרגיה', mod: 4 }, { name: 'ממסר חכם לדוד', mod: 1 });
      wiring.push('אפס (N) בכל קופסת מתג ובכל נקודת תריס.', 'קופסאות מתג עמוקות (55 מ״מ).', 'הרכזת בארון התקשורת, במרכז הבית, עם שקע ייעודי וחיבור רשת.', 'רשת Zigbee מתחזקת ממודולים שמחוברים ל-230V; חיישנים על סוללה נשענים עליהם.');
    } else if (tech === 'knx') {
      var chans = lightsSmart ? Math.ceil(lightsSmart / 2) : 0;
      addDev('psu', 'ספק KNX 640mA', 1, 'לוח החשמל');
      addDev('act', 'מפעיל מיתוג KNX 8 ערוצים', Math.ceil(chans / 8), 'לוח החשמל');
      addDev('dim', 'מפעיל עמעום KNX 4 ערוצים (לסלון ולחדר הורים)', 1, 'לוח החשמל');
      addDev('shut', 'מפעיל תריסים KNX 4 ערוצים', Math.ceil(shutters / 4), 'לוח החשמל');
      addDev('ip', 'ממשק KNX IP ושרת ויזואליזציה', 1, 'לוח החשמל / ארון תקשורת');
      panel.push({ name: 'ספק KNX 640mA', mod: 4 });
      for (var i = 0; i < Math.ceil(chans / 8); i++) panel.push({ name: 'מפעיל מיתוג 8 ערוצים', mod: 4 });
      panel.push({ name: 'מפעיל עמעום 4 ערוצים', mod: 4 });
      for (i = 0; i < Math.ceil(shutters / 4); i++) panel.push({ name: 'מפעיל תריסים 4 ערוצים', mod: 4 });
      panel.push({ name: 'ממשק KNX IP', mod: 2 });
      wiring.push('כבל KNX ירוק (YCYM 2×2×0.8) לכל לחצן, גלאי וממשק, בטופולוגיית קו או עץ — לא טבעת.', 'כל נקודת מאור ותריס מקבלת קו 230V ישיר ללוח (טופולוגיית כוכב), כי המיתוג נעשה במפעילים בלוח.', 'לוח גדול יותר: המפעילים תופסים ' + panel.reduce(function (s, p) { return s + p.mod; }, 0) + ' מודולים.', 'שרוול נפרד לכבל KNX ולכבלי 230V, או כבל מאושר להשחלה משותפת.');
    }
    wiring.push('ארון תקשורת עם שקע ייעודי, ונקודת רשת CAT6 בכל חדר מגורים.');
    if (plan.shabbat) scenes.push({ name: 'מצב שבת', desc: 'תאורה ותריסים לפי לוח זמנים קבוע מראש, דוד מופעל לפי שעון, בלי הפעלה ידנית בשבת.' });
    scenes.push({ name: 'יציאה מהבית', desc: 'כיבוי כל התאורה והמזגנים, סגירת תריסים, הפעלת חיישני תנועה כהתראה.' });
    scenes.push({ name: 'לילה טוב', desc: 'כיבוי תאורה בחלקים המשותפים, תאורת לילה עמומה במסדרון, סגירת תריסים בחדרי השינה.' });
    scenes.push({ name: 'חזרה הביתה', desc: 'הדלקת תאורת כניסה, הפעלת מזגן הסלון 15 דקות לפני ההגעה לפי מיקום הטלפון.' });
    if (rooms.some(function (r) { return r.smart && r.smart.leak; })) scenes.push({ name: 'הגנה מהצפה', desc: 'חיישן הצפה מפעיל התראה לטלפון' + (tech !== 'none' ? ' ויכול לסגור ברז חשמלי ראשי אם מותקן' : '') + '.' });

    return {
      tech: tech,
      devices: Object.keys(dev).map(function (k) { return dev[k]; }),
      wiring: wiring, panel: panel, scenes: scenes
    };
  }

  function area(rooms) { return rooms.reduce(function (s, r) { return s + (+r.area || 0); }, 0); }

  /* ---------- לוח החשמל ---------- */

  var ROW_MOD = 18;

  function panel(plan) {
    var C = circuits(plan), S = smart(plan), sup = C.supply, tri = C.tri;
    var devs = [];
    function dev(kind, title, mod, extra) { var d = { kind: kind, title: title, mod: mod }; for (var k in extra || {}) d[k] = extra[k]; devs.push(d); return d; }
    dev('main', sup.main, sup.mainMod, { short: 'ראשי' });
    if (plan.spd !== false) dev('spd', 'מגן ברק (SPD) סוג 2', tri ? 4 : 2, { short: 'מגן ברק' });
    dev('lamp', 'נוריות סימון פאזה', tri ? 3 : 1, { short: 'נוריות' });
    var heaterC = C.circuits.filter(function (c) { return c.timer; })[0];
    C.rcds.forEach(function (r) {
      dev('rcd', r.name + ' ' + (r.poles === 4 ? '4P' : '2P') + ' ' + r.amps + 'A ' + r.ma + 'mA סוג ' + r.type, r.poles, { short: 'פחת ' + r.id.replace('RCD', '').replace('-', ''), rcd: r.id, groupStart: true });
      r.circuits.forEach(function (c) {
        dev('mcb', c.title + ' — ' + c.rooms.join(', '), c.poles, { short: shortName(c), circuit: c, rcd: r.id, phase: c.phase });
        if (c === heaterC) {
          dev('timer', 'קוצב זמן / שעון שבת לדוד', 1, { short: 'שעון דוד', rcd: r.id });
          dev('contactor', 'מגען 25A לדוד', 2, { short: 'מגען דוד', rcd: r.id });
        }
      });
    });
    S.panel.forEach(function (p) { dev('smart', p.name, p.mod, { short: p.name.split(' ')[0] === 'מד' ? 'מד אנרגיה' : p.name.split(' ').slice(0, 2).join(' ') }); });

    var used = devs.reduce(function (s, d) { return s + d.mod; }, 0);
    var rowsN = Math.max(2, Math.ceil(used * 1.3 / ROW_MOD));
    // פריסה לשורות: רכיב לא נחצה בין שורות
    var rows = [[]], fill = 0;
    devs.forEach(function (d) {
      if (fill + d.mod > ROW_MOD) { rows.push([]); fill = 0; }
      rows[rows.length - 1].push(d);
      d.pos = fill;
      fill += d.mod;
    });
    while (rows.length < rowsN) rows.push([]);
    var no = 0;
    devs.forEach(function (d) { if (d.kind === 'mcb') d.no = ++no; });
    return {
      devices: devs, rows: rows, rowMod: ROW_MOD, used: used, total: rows.length * ROW_MOD,
      spare: rows.length * ROW_MOD - used, circuits: C, smart: S
    };
  }

  function shortName(c) {
    var map = { light: 'תאורה', socket: c.title.indexOf('משטח') >= 0 ? 'שקעי מטבח' : c.ip ? 'שקעים רטוב' : 'שקעים', ac: 'מזגן' };
    var base = map[c.kind] || (APPLIANCES[c.kind] ? APPLIANCES[c.kind].name.split(' ')[0] : c.title);
    var room = c.kind === 'light' || c.kind === 'socket' ? '' : ' ' + (c.rooms[0] || '').replace('חדר שינה ', '').replace('חדר ', '');
    return (base + room).slice(0, 16);
  }

  /* ---------- בדיקות ואזהרות ---------- */

  function advice(plan) {
    var P = panel(plan), C = P.circuits, out = [];
    var sup = C.supply;
    var maxA = Math.max.apply(null, C.perPhaseA);
    var pct = maxA / sup.amps * 100;
    function w(level, text) { out.push({ level: level, text: text }); }
    if (pct > 90) w('error', 'העומס המשוער בפאזה העמוסה (' + Math.round(maxA) + 'A) קרוב לגודל החיבור (' + sup.amps + 'A). שקלו הגדלת חיבור או הפחתת מכשירים שפועלים יחד.');
    else if (pct > 70) w('warning', 'העומס המשוער בפאזה העמוסה הוא ' + Math.round(pct) + '% מגודל החיבור. יש מעט מרווח לתוספות.');
    else w('ok', 'העומס המשוער (' + Math.round(maxA) + 'A בפאזה העמוסה) בתוך גודל החיבור ' + sup.name + '.');
    var heavy = C.circuits.filter(function (c) { return c.kw >= 2; }).reduce(function (s, c) { return s + c.kw; }, 0);
    if (!C.tri && heavy > 12) w('warning', 'יש הרבה צרכנים כבדים (' + heavy.toFixed(1) + 'kW מחוברים) על חיבור חד-פאזי. חיבור תלת-פאזי 3×25A יאפשר כיריים אינדוקציה, מיזוג ודוד בו-זמנית.');
    if (C.circuits.some(function (c) { return c.kind === 'ev'; }) && !C.tri) w('warning', 'עמדת טעינה על חיבור חד-פאזי מוגבלת ל-7.4kW ועלולה להעמיס. מומלץ לנהל טעינה דינמית.');
    if (P.spare / P.total < 0.2) w('warning', 'נשאר פחות מ-20% מקום שמור בלוח. בחרו לוח גדול יותר.');
    else w('ok', 'לוח של ' + P.rows.length + ' שורות × ' + P.rowMod + ' מודולים, עם ' + Math.round(P.spare / P.total * 100) + '% מקום שמור להרחבות.');
    (plan.rooms || []).forEach(function (r) {
      var t = ROOMS[r.type];
      if (t.wet && r.sockets > 0) w('info', r.name + ': שקעים מוגנים מים (IP44 לפחות), מחוץ לאזורים 0–1 סביב המקלחת והאמבטיה, ועל ממסר פחת 30mA.');
      if (t.mamad) w('info', r.name + ': כל ההשחלות דרך שרוולים מאושרים בלבד, בלי קידוחים בקירות ובתקרה, לפי הנחיות פיקוד העורף.');
      if (t.kitchen && r.sockets < 5) w('warning', r.name + ': מומלצים לפחות 5 שקעים מעל משטח העבודה.');
      if (r.type === 'living' && r.sockets < 6) w('warning', r.name + ': מעט שקעים לסלון. מומלץ לפחות 6, כולל פינת טלוויזיה.');
    });
    if (C.circuits.some(function (c) { return c.timer; })) w('info', 'הדוד מקבל קוצב זמן ומגען 25A בלוח, ומפסק דו-קוטבי עם נורית סימון ליד הכניסה לחדר הרחצה.');
    w('info', 'כל מעגלי השקעים והתאורה על ממסרי פחת 30mA סוג A. ' + (C.rcds.length > 1 ? 'המעגלים מחולקים בין ' + C.rcds.length + ' ממסרים, כדי שקפיצה אחת לא תנתק את כל הבית.' : ''));
    return out;
  }

  /* ---------- שרטוט הלוח ---------- */

  var MOD_PX = 36, DEV_H = 96, ROW_H = 190, PAD = 34;
  var PH = { L1: '#8a4b1f', L2: '#1d1d1f', L3: '#8a8f98', L: '#8a4b1f', 'L1+L2+L3': 'url(#tri)' };
  var RCD_TINT = ['#c9a45c', '#5f8dd3', '#7fb069', '#d9776a', '#9b7fd1'];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function renderPanel(P, title) {
    var W = P.rowMod * MOD_PX + PAD * 2, H = P.rows.length * ROW_H + 110;
    var tint = {};
    P.circuits.rcds.forEach(function (r, i) { tint[r.id] = r.type === 'B' ? '#e0a100' : RCD_TINT[i % RCD_TINT.length]; });
    var o = [];
    o.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" class="panel-svg" font-family="Heebo, Arial, sans-serif" role="img" aria-label="' + esc(title) + '">');
    o.push('<defs><linearGradient id="encl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c2538"/><stop offset="1" stop-color="#101726"/></linearGradient>' +
      '<linearGradient id="rail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d7dbe2"/><stop offset=".5" stop-color="#9aa1ad"/><stop offset="1" stop-color="#c7ccd4"/></linearGradient>' +
      '<linearGradient id="devg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e9ebef"/></linearGradient>' +
      '<linearGradient id="tri" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a4b1f"/><stop offset=".5" stop-color="#1d1d1f"/><stop offset="1" stop-color="#8a8f98"/></linearGradient></defs>');
    o.push('<rect x="4" y="4" width="' + (W - 8) + '" height="' + (H - 8) + '" rx="18" fill="url(#encl)" stroke="#c9a45c" stroke-width="2"/>');
    o.push('<rect x="12" y="12" width="' + (W - 24) + '" height="' + (H - 24) + '" rx="12" fill="none" stroke="#c9a45c" stroke-opacity=".35"/>');
    o.push('<text x="' + (W - PAD) + '" y="46" text-anchor="start" direction="rtl" fill="#f4ead6" font-size="20" font-weight="700">' + esc(title) + '</text>');
    o.push('<text x="' + PAD + '" y="46" fill="#c9a45c" font-size="12" font-family="IBM Plex Mono, monospace">' + P.used + '/' + P.total + ' MOD</text>');

    P.rows.forEach(function (row, ri) {
      var y = 76 + ri * ROW_H;
      o.push('<rect x="' + (PAD - 10) + '" y="' + (y + DEV_H / 2 - 9) + '" width="' + (P.rowMod * MOD_PX + 20) + '" height="18" rx="3" fill="url(#rail)"/>');
      // קבוצות פחת: פס צבעוני מעל הרכיבים
      var spans = {};
      row.forEach(function (d) { if (d.rcd) { var s = spans[d.rcd] = spans[d.rcd] || { a: d.pos, b: d.pos + d.mod }; s.a = Math.min(s.a, d.pos); s.b = Math.max(s.b, d.pos + d.mod); } });
      Object.keys(spans).forEach(function (id) {
        var s = spans[id], x1 = PAD + (P.rowMod - s.b) * MOD_PX, x2 = PAD + (P.rowMod - s.a) * MOD_PX;
        o.push('<rect x="' + (x1 + 2) + '" y="' + (y - 14) + '" width="' + (x2 - x1 - 4) + '" height="5" rx="2.5" fill="' + tint[id] + '"/>');
      });
      row.forEach(function (d) {
        // בלוח ישראלי מסדרים מימין לשמאל
        var x = PAD + (P.rowMod - d.pos - d.mod) * MOD_PX, w = d.mod * MOD_PX;
        o.push('<g class="pdev" data-kind="' + d.kind + '"><title>' + esc((d.no ? d.no + '. ' : '') + d.title) + '</title>');
        o.push('<rect x="' + (x + 1.5) + '" y="' + y + '" width="' + (w - 3) + '" height="' + DEV_H + '" rx="4" fill="url(#devg)" stroke="#aeb4bf"/>');
        var cx = x + w / 2;
        if (d.kind === 'main') {
          o.push('<rect x="' + (cx - w * 0.32) + '" y="' + (y + 30) + '" width="' + (w * 0.64) + '" height="26" rx="4" fill="#c62828"/><text x="' + cx + '" y="' + (y + 20) + '" text-anchor="middle" font-size="10" font-weight="700" fill="#333">I-O</text>');
        } else if (d.kind === 'rcd') {
          o.push('<rect x="' + (cx - w * 0.3) + '" y="' + (y + 32) + '" width="' + (w * 0.6) + '" height="22" rx="3" fill="#2b2f36"/><circle cx="' + (x + 12) + '" cy="' + (y + 16) + '" r="6" fill="#f2c500" stroke="#b58f00"/><text x="' + (x + 12) + '" y="' + (y + 19.5) + '" text-anchor="middle" font-size="8" font-weight="700" fill="#333">T</text>');
          o.push('<text x="' + cx + '" y="' + (y + 76) + '" text-anchor="middle" font-size="9" fill="#444" font-family="IBM Plex Mono, monospace">30mA</text>');
        } else if (d.kind === 'mcb') {
          o.push('<rect x="' + (cx - 8) + '" y="' + (y + 32) + '" width="16" height="24" rx="3" fill="#2b2f36"/>');
          o.push('<text x="' + cx + '" y="' + (y + 18) + '" text-anchor="middle" font-size="11" font-weight="700" fill="#222" font-family="IBM Plex Mono, monospace">' + esc(d.circuit.breaker.replace(' 3P', '')) + '</text>');
          o.push('<circle cx="' + cx + '" cy="' + (y + 72) + '" r="6" fill="' + (PH[d.phase] || '#999') + '" stroke="#fff" stroke-width="1.5"/>');
          if (d.no != null) o.push('<text x="' + cx + '" y="' + (y + 89) + '" text-anchor="middle" font-size="10" font-weight="700" fill="#555">' + d.no + '</text>');
        } else if (d.kind === 'spd') {
          o.push('<path d="M' + (cx + 4) + ' ' + (y + 26) + 'l-10 18h9l-6 18 14-22h-9l6-14z" fill="#c9a45c"/>');
        } else if (d.kind === 'lamp') {
          for (var i = 0; i < d.mod; i++) o.push('<circle cx="' + (x + MOD_PX * i + MOD_PX / 2) + '" cy="' + (y + 44) + '" r="8" fill="' + ['#e03131', '#f08c00', '#2f9e44'][i % 3] + '" opacity=".9"/>');
        } else if (d.kind === 'timer') {
          o.push('<circle cx="' + cx + '" cy="' + (y + 44) + '" r="12" fill="none" stroke="#444" stroke-width="1.5"/><path d="M' + cx + ' ' + (y + 36) + 'v8l5 4" stroke="#444" stroke-width="1.5" fill="none"/>');
        } else if (d.kind === 'contactor') {
          o.push('<rect x="' + (cx - 16) + '" y="' + (y + 28) + '" width="32" height="30" rx="3" fill="#dfe3ea" stroke="#999"/><text x="' + cx + '" y="' + (y + 48) + '" text-anchor="middle" font-size="10" fill="#333">K</text>');
        } else if (d.kind === 'smart' && w < 60) {
          o.push('<rect x="' + (x + 7) + '" y="' + (y + 28) + '" width="' + (w - 14) + '" height="28" rx="3" fill="#14213d"/><circle cx="' + cx + '" cy="' + (y + 42) + '" r="3" fill="#c9a45c"/>');
        } else if (d.kind === 'smart') {
          o.push('<rect x="' + (x + 8) + '" y="' + (y + 26) + '" width="' + (w - 16) + '" height="30" rx="4" fill="#14213d"/><text x="' + cx + '" y="' + (y + 46) + '" text-anchor="middle" font-size="10" fill="#c9a45c" font-family="IBM Plex Mono, monospace">SMART</text>');
        }
        // תווית מתחת לרכיב
        o.push('<text x="' + cx + '" y="' + (y + DEV_H + 18) + '" text-anchor="middle" direction="rtl" font-size="' + (w < 40 ? 9 : 10.5) + '" fill="#f4ead6">' + esc(fit(d.short || d.title, w)) + '</text>');
        o.push('</g>');
      });
      var usedRow = row.reduce(function (s, d) { return s + d.mod; }, 0);
      if (usedRow < P.rowMod) {
        var sx = PAD, sw = (P.rowMod - usedRow) * MOD_PX;
        o.push('<rect x="' + (sx + 2) + '" y="' + (y + 8) + '" width="' + (sw - 4) + '" height="' + (DEV_H - 16) + '" rx="4" fill="none" stroke="#c9a45c" stroke-opacity=".35" stroke-dasharray="5 5"/>');
        if (sw > 80) o.push('<text x="' + (sx + sw / 2) + '" y="' + (y + 26) + '" text-anchor="middle" fill="#c9a45c" fill-opacity=".8" font-size="11">מקום שמור · ' + (P.rowMod - usedRow) + ' מודולים</text>');
      }
    });
    // מקרא
    var ly = H - 26, lx = W - PAD;
    o.push('<g font-size="11" fill="#f4ead6">');
    P.circuits.rcds.forEach(function (r) {
      o.push('<rect x="' + (lx - 14) + '" y="' + (ly - 9) + '" width="14" height="5" rx="2.5" fill="' + tint[r.id] + '"/><text x="' + (lx - 20) + '" y="' + ly + '" text-anchor="start" direction="rtl">' + esc(r.name) + '</text>');
      lx -= 150;
    });
    o.push('</g>');
    o.push('</svg>');
    return o.join('');
  }

  function fit(s, w) { var max = Math.max(3, Math.floor(w / 6.2)); s = String(s); return s.length > max ? s.slice(0, max - 1) + '…' : s; }

  return {
    SUPPLIES: SUPPLIES, ROOMS: ROOMS, APPLIANCES: APPLIANCES, AC_SIZES: AC_SIZES, SMART_TECH: SMART_TECH, PRESETS: PRESETS,
    newRoom: newRoom, preset: preset, circuits: circuits, smart: smart, panel: panel, advice: advice, renderPanel: renderPanel, area: area
  };
});
