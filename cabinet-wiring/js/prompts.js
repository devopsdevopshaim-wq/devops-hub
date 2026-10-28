/* ארון־פלאן — ההנחיה ל-Claude לקריאת תכנית חיווט, מבנה התשובה (JSON Schema) ופענוח התשובה.
   קובץ משותף: window.WPrompts בדפדפן, require בשרת. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WPrompts = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TYPE_KEYS = ['main_switch', 'mcb', 'rcd', 'fuse', 'psu', 'transformer', 'socket', 'meter', 'plc', 'io', 'relay', 'timer', 'thermostat', 'other',
    'contactor', 'overload', 'mpcb', 'vfd', 'softstarter', 'terminal', 'pe_bar', 'button', 'selector', 'estop', 'lamp', 'door_meter',
    'motor', 'sensor', 'valve', 'fan', 'heater', 'field'];
  var FUNC_KEYS = ['power', 'neutral', 'ctrl_ac', 'ctrl_dc', 'dc0', 'foreign', 'signal', 'comm', 'pe'];
  var COLOR_KEYS = ['BK', 'BN', 'RD', 'OG', 'YE', 'GN', 'BU', 'LBU', 'VT', 'GY', 'WH', 'PK', 'TQ', 'GNYE', 'WHBU'];

  var str = { type: 'string' };
  var SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['meta', 'components', 'wires', 'notes', 'layout'],
    properties: {
      meta: {
        type: 'object', additionalProperties: false,
        required: ['title', 'drawingNo', 'revision', 'supply', 'control', 'notes'],
        properties: { title: str, drawingNo: str, revision: str, supply: str, control: str, notes: str }
      },
      components: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          required: ['tag', 'type', 'name', 'desc', 'maker', 'partNo', 'location', 'page'],
          properties: {
            tag: str, type: { type: 'string', enum: TYPE_KEYS }, name: str, desc: str, maker: str, partNo: str,
            location: { type: 'string', enum: ['cabinet', 'door', 'field'] }, page: { type: 'integer' }
          }
        }
      },
      wires: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          required: ['no', 'fromTag', 'fromTerm', 'toTag', 'toTerm', 'color', 'colorSource', 'section', 'wireType', 'func', 'potential', 'desc', 'explain', 'page'],
          properties: {
            no: str, fromTag: str, fromTerm: str, toTag: str, toTerm: str,
            color: { type: 'string', enum: COLOR_KEYS },
            colorSource: { type: 'string', enum: ['drawing', 'standard'] },
            section: { type: 'number' }, wireType: str,
            func: { type: 'string', enum: FUNC_KEYS },
            potential: str, desc: str, explain: str, page: { type: 'integer' }
          }
        }
      },
      notes: { type: 'array', items: str },
      layout: {
        type: 'object', additionalProperties: false,
        required: ['pages', 'enclosure', 'rails', 'door', 'terminalOrder', 'glands', 'notes'],
        properties: {
          pages: { type: 'array', items: { type: 'integer' } },
          enclosure: { type: 'object', additionalProperties: false, required: ['w', 'h', 'd'], properties: { w: { type: 'number' }, h: { type: 'number' }, d: { type: 'number' } } },
          rails: {
            type: 'array',
            items: { type: 'object', additionalProperties: false, required: ['label', 'tags', 'spacer'], properties: { label: str, tags: { type: 'array', items: str }, spacer: { type: 'number' } } }
          },
          door: { type: 'array', items: str },
          terminalOrder: {
            type: 'array',
            items: { type: 'object', additionalProperties: false, required: ['tag', 'terms'], properties: { tag: str, terms: { type: 'array', items: str } } }
          },
          glands: {
            type: 'array',
            items: { type: 'object', additionalProperties: false, required: ['label', 'size', 'row'], properties: { label: str, size: str, row: { type: 'integer' } } }
          },
          notes: str
        }
      }
    }
  };

  var SYSTEM = [
    'אתה מהנדס חשמל ובונה לוחות (Panel builder) ותיק, שקורא תכניות חשמל ותכניות חיווט של ארונות פיקוד (EPLAN, AutoCAD Electrical, SEE, שרטוטים ידניים).',
    'המשימה: לקרוא את כל עמודי התכנית ולהוציא ממנה רשימת חוטים מלאה, נקודה-לנקודה, שבונה לוחות יכול לחווט לפיה בלי לפתוח את התכנית.',
    'עונים בעברית בשדות הטקסט. תגים, מספרי הדקים, קודי צבע ומק"טים נשארים כמו בתכנית.'
  ].join('\n');

  var RULES = [
    'כללים:',
    '1. רכיבים: כל רכיב עם תג (‎-Q1, -K1, -X1, -A1...). type לפי הטבלה: main_switch, mcb, rcd, fuse, psu, transformer, socket, meter, plc, io, relay, timer, thermostat, contactor, overload, mpcb, vfd, softstarter, terminal (פס מהדקים שלם, למשל ‎-X1), pe_bar, button, selector, estop, lamp, door_meter, motor, sensor, valve, fan, heater, field, other.',
    '   location: cabinet (על פלטת ההרכבה), door (לחצנים, נוריות, מדים בדלת), field (מנועים, חיישנים, שסתומים מחוץ לארון).',
    '2. כל מוליך הוא חוט נפרד. הזנה תלת־פאזית = 3 חוטים (L1, L2, L3) ועוד N ו-PE אם הם מחוברים; מנוע = U, V, W ו-PE; מאמ"ת 3P = חוט לכל קוטב (1-2, 3-4, 5-6). לעולם לא חוט אחד עם הדק "1/3/5" או פוטנציאל "L1-L3" — מפרקים לחוטים, כל אחד עם ההדק שלו.',
    '   חוטים: כל קו בתכנית בין שני הדקים הוא חוט. צומת שמחבר כמה הדקים מפורק לשרשרת של חוטים נקודה-לנקודה (Daisy chain) בסדר הגיוני: לא יותר משני חוטים על הדק אחד.',
    '   פס מהדקים: fromTag = "-X2", fromTerm = "5". מהדק PE: term = "PE". הדק של רכיב: כפי שמסומן (A1, 13, L1, I0.3, +, 0V...).',
    '   חוטים בין מהדקים שכנים באותו פס (גשרים) נכנסים כחוטים רגילים עם wireType "גשר מסרק".',
    '   גידים של כבל לשטח: כל גיד הוא חוט נפרד, wireType = סוג הכבל (למשל "ÖLFLEX 4G1.5"), color = צבע הגיד.',
    '3. צבע: אם הצבע כתוב בתכנית (BK, BU, RD, GNYE, SW, BL...) משתמשים בו ו-colorSource = "drawing". אחרת לפי IEC 60204-1 ו-colorSource = "standard":',
    '   כוח AC ו-DC: BK · אפס: LBU · PE: GNYE · פיקוד AC: RD · פיקוד DC ‎+24V: BU · ‎0V DC: WHBU · מתח זר (נשאר חי כשהמפסק הראשי מנותק): OG.',
    '4. חתך במ"מ רבועים (section, מספר): מהתכנית. אם לא כתוב: לפי ההגנה שלפני החוט (C6–C10: 1.5, C16: 2.5, C20–C25: 4, C32: 6), פיקוד 0.75, PE לפחות כמו הפאזות.',
    '   wireType: מהתכנית, אחרת H05V-K עד 1 ממ"ר ו-H07V-K מ-1.5.',
    '5. func: power, neutral, ctrl_ac, ctrl_dc, dc0, foreign, signal, comm, pe. potential: L1/L2/L3/N/PE/+24V/0V/U/V/W או שם הפוטנציאל בתכנית.',
    '6. no: מספר החוט כפי שמופיע בתכנית. אם אין מספור, משאירים "" (המערכת תמספר).',
    '7. desc: תיאור קצר (עד 10 מילים). explain: 2–4 משפטים שמסבירים לחשמלאי מה החוט עושה במעגל, מה קורה כשיש בו מתח, ולמה הוא מחובר דווקא להדקים האלה. לא חוזרים על הצבע והחתך.',
    '8. page: מספר העמוד ב-PDF שבו החוט מופיע.',
    '9. אל תמציא חוטים שלא בתכנית. אם משהו לא קריא או לא ברור, כתוב זאת ב-notes (למשל: "עמוד 4: מספר ההדק של ‎-K3 לא קריא").',
    '10. meta: שם התכנית, מספר שרטוט, גרסה, מתח הזנה ומתח פיקוד כפי שמופיעים בטבלת הכותרת.',
    '11. layout — הארון כפי שהוא מוגדר בשרטוטים (לא המלצה שלך). ממלאים רק ממה שמופיע בתכנית: שרטוט פריסה / מבט חזית של הפלטה (Layout, Mounting plate, פלטה), רשימת מהדקים, שרטוט בלוק הבקר, פלטת אנטיגרונים (PG).',
    '   rails: כל מסילת DIN מלמעלה למטה, ובכל אחת התגים משמאל לימין בדיוק בסדר שבשרטוט. label = שם המסילה או מה שעליה. spacer = גובה מרווח (ספייסר) במ"מ אם כתוב, אחרת 0.',
    '   terminalOrder: לכל פס מהדקים בתכנית — ההדקים בסדר הפיזי שלהם משמאל לימין, כמו ברשימת המהדקים. door: התגים בדלת בסדר שבשרטוט.',
    '   glands: כל כניסת כבל בפלטת האנטיגרונים: label = הכבל או היעד, size = הגודל כפי שכתוב (PG21, M20, 16...), row = שורה מלמעלה (1, 2...).',
    '   enclosure: רוחב, גובה ועומק הארון במ"מ אם כתובים, אחרת 0. pages = העמודים שמהם נלקחה הפריסה. אם אין בתכנית שום שרטוט פריסה — מחזירים מערכים ריקים, ולא ממציאים.'
  ].join('\n');

  function build(opts) {
    opts = opts || {};
    var hint = [];
    if (opts.hint) hint.push('הערות המשתמש על התכנית: ' + String(opts.hint).slice(0, 2000));
    if (opts.text) hint.push('טקסט שנשלף מה-PDF (לעזרה בקריאת מספרים קטנים; הקובץ עצמו הוא המקור):\n' + String(opts.text).slice(0, 60000));
    return {
      system: SYSTEM,
      cached: RULES,
      instruction: (hint.length ? hint.join('\n\n') + '\n\n' : '') + 'קרא את תכנית החיווט המצורפת והחזר את כל הרכיבים וכל החוטים לפי המבנה.',
      schema: SCHEMA,
      maxTokens: 64000,
      effort: 'high'
    };
  }

  /* בקשה להעתקה ל-Claude.ai (עם צירוף ה-PDF בצ'אט) */
  function copyPrompt(opts) {
    var spec = build(opts);
    return [
      spec.system, '', spec.cached, '',
      spec.instruction, '',
      'צירפתי את קובץ ה-PDF של התכנית. החזר JSON בלבד (בלי הסברים לפני או אחרי), במבנה:',
      '{"meta":{"title":"","drawingNo":"","revision":"","supply":"","control":"","notes":""},',
      ' "components":[{"tag":"-K1","type":"contactor","name":"","desc":"","maker":"","partNo":"","location":"cabinet","page":1}],',
      ' "wires":[{"no":"","fromTag":"-X1","fromTerm":"1","toTag":"-Q1","toTerm":"1","color":"BK","colorSource":"drawing","section":2.5,"wireType":"H07V-K","func":"power","potential":"L1","desc":"","explain":"","page":1}],',
      ' "notes":[],',
      ' "layout":{"pages":[],"enclosure":{"w":0,"h":0,"d":0},"rails":[{"label":"","tags":["-Q1","-F1"],"spacer":0}],"door":[],"terminalOrder":[{"tag":"-X1","terms":["1","2","PE"]}],"glands":[{"label":"","size":"PG16","row":1}],"notes":""}}'
    ].join('\n');
  }

  /* בקשה לקטע של כמה עמודים (נשלח עם תמונות העמודים דרך השרת של האתר). עד 24,000 תווים. */
  function chunkPrompt(opts) {
    opts = opts || {};
    var pages = opts.pages || [];
    var known = (opts.known || []).slice(0, 120);
    var parts = [
      SYSTEM, '', RULES, '',
      'מצורפים ' + pages.length + ' עמודים מתוך התכנית: עמודים ' + pages.join(', ') + ' ב-PDF, בסדר הזה. page = מספר העמוד ב-PDF.',
      'אם עמוד הוא כריכה, תוכן עניינים או רשימת חלקים בלי חוטים, החזר ממנו רק רכיבים.',
      'אם עמוד הוא שרטוט פריסה, רשימת מהדקים, בלוק בקר או פלטת אנטיגרונים — מלא ממנו את layout (סעיף 11).',
      'קו שממשיך לעמוד אחר (חץ עם הפניה כמו /5.3): חבר אותו לתג וההדק שמופיעים בהפניה אם הם ידועים.',
      known.length ? 'רכיבים שכבר זוהו בעמודים קודמים (השתמש באותם תגים): ' + known.join(', ') : '',
      opts.hint ? 'הערות המשתמש: ' + String(opts.hint).slice(0, 1500) : '',
      opts.text ? 'טקסט שנשלף מהעמודים האלה (לעזרה בקריאת מספרים קטנים):\n' + String(opts.text).slice(0, 7000) : '',
      '',
      'החזר JSON בלבד במבנה:',
      '{"meta":{"title":"","drawingNo":"","revision":"","supply":"","control":"","notes":""},"components":[{"tag":"-K1","type":"contactor","name":"","desc":"","maker":"","partNo":"","location":"cabinet","page":1}],"wires":[{"no":"","fromTag":"-X1","fromTerm":"1","toTag":"-Q1","toTerm":"1","color":"BK","colorSource":"drawing","section":2.5,"wireType":"H07V-K","func":"power","potential":"L1","desc":"","explain":"","page":1}],"notes":[],"layout":{"pages":[],"enclosure":{"w":0,"h":0,"d":0},"rails":[],"door":[],"terminalOrder":[],"glands":[],"notes":""}}'
    ];
    return parts.filter(function (x) { return x !== ''; }).join('\n').slice(0, 23800);
  }

  /* איחוד התשובות של כמה קטעים לתוצאה אחת: רכיבים לפי תג, חוטים לפי שני הקצוות */
  function merge(list) {
    var meta = {}, comps = {}, order = [], wires = [], seen = {}, notes = [], lays = [];
    var nt = function (t) { t = String(t || '').trim().toUpperCase().replace(/\s+/g, ''); return t && /^[A-Z0-9]/.test(t) ? '-' + t : t; };
    (list || []).forEach(function (r) {
      if (!r) return;
      Object.keys(r.meta || {}).forEach(function (k) { if (r.meta[k] && !meta[k]) meta[k] = r.meta[k]; });
      (r.components || []).forEach(function (c) {
        var k = nt(c.tag);
        if (!k) return;
        if (!comps[k]) { comps[k] = Object.assign({}, c, { tag: k }); order.push(k); }
        else Object.keys(c).forEach(function (f) { if (c[f] && !comps[k][f]) comps[k][f] = c[f]; });
      });
      (r.wires || []).forEach(function (w) {
        var a = nt(w.from.tag) + ':' + String(w.from.term).trim(), b = nt(w.to.tag) + ':' + String(w.to.term).trim();
        var key = a < b ? a + '|' + b : b + '|' + a;
        if (seen[key]) return;
        seen[key] = 1;
        wires.push(w);
      });
      (r.notes || []).forEach(function (n) { if (notes.indexOf(n) < 0) notes.push(n); });
      if (r.layoutPlan) lays.push(r.layoutPlan);
    });
    var out = { meta: meta, components: order.map(function (k) { return comps[k]; }), wires: wires, notes: notes };
    var lp = mergeLayouts(lays);
    if (lp) out.layoutPlan = lp;
    return out;
  }

  /* הארון כפי שהוא מוגדר בשרטוטים: מסילות, סדר רכיבים, סדר הדקים, אנטיגרונים */
  var normTag = function (t) { t = String(t || '').trim().toUpperCase().replace(/\s+/g, ''); return t && /^[A-Z0-9]/.test(t) ? '-' + t : t; };
  function layoutFromJson(l) {
    if (!l || typeof l !== 'object') return null;
    var rails = (l.rails || []).map(function (r) { return { label: String(r.label || ''), tags: (r.tags || []).map(normTag).filter(Boolean), spacer: Number(r.spacer) || 0 }; }).filter(function (r) { return r.tags.length; });
    var termOrder = {};
    (l.terminalOrder || []).forEach(function (t) { var k = normTag(t.tag); if (k && t.terms && t.terms.length) termOrder[k] = t.terms.map(function (x) { return String(x).trim(); }); });
    var glands = (l.glands || []).map(function (g) { return { label: String(g.label || ''), size: String(g.size || ''), row: Number(g.row) || 1 }; }).filter(function (g) { return g.size || g.label; });
    var door = (l.door || []).map(normTag).filter(Boolean);
    var e = l.enclosure || {};
    var enc = Number(e.w) > 0 && Number(e.h) > 0 ? { w: Number(e.w), h: Number(e.h), d: Number(e.d) || 0 } : null;
    if (!rails.length && !Object.keys(termOrder).length && !glands.length && !door.length && !enc) return null;
    return { source: 'drawing', pages: (l.pages || []).map(Number).filter(Boolean), enclosure: enc, rails: rails, door: door, termOrder: termOrder, glands: glands, notes: String(l.notes || '') };
  }
  function mergeLayouts(list) {
    list = (list || []).filter(Boolean);
    if (!list.length) return null;
    var out = { source: 'drawing', pages: [], enclosure: null, rails: [], door: [], termOrder: {}, glands: [], notes: '' };
    var used = {};
    list.forEach(function (l) {
      (l.pages || []).forEach(function (p) { if (out.pages.indexOf(p) < 0) out.pages.push(p); });
      if (!out.enclosure && l.enclosure) out.enclosure = l.enclosure;
      (l.rails || []).forEach(function (r) { var tags = r.tags.filter(function (t) { return !used[t]; }); tags.forEach(function (t) { used[t] = 1; }); if (tags.length) out.rails.push({ label: r.label, tags: tags, spacer: r.spacer || 0 }); });
      (l.door || []).forEach(function (t) { if (out.door.indexOf(t) < 0) out.door.push(t); });
      Object.keys(l.termOrder || {}).forEach(function (k) { if (!out.termOrder[k]) out.termOrder[k] = l.termOrder[k]; });
      out.glands = out.glands.concat(l.glands || []);
      if (l.notes) out.notes = (out.notes ? out.notes + ' ' : '') + l.notes;
    });
    out.pages.sort(function (a, b) { return a - b; });
    return out;
  }

  /* תשובה (מהשרת או מהדבקה) → פרויקט חלקי */
  function parse(text) {
    var s = String(text || '').trim();
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    var a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b < a) throw new Error('לא נמצא JSON בתשובה. העתיקו את כל התשובה של Claude.');
    var j;
    try { j = JSON.parse(s.slice(a, b + 1)); }
    catch (e) { throw new Error('ה-JSON לא תקין (' + e.message + '). אם התשובה נקטעה, בקשו מ-Claude "המשך" והדביקו הכל.'); }
    return fromJson(j);
  }

  function fromJson(j) {
    if (!j || !Array.isArray(j.wires)) throw new Error('בתשובה אין רשימת חוטים (wires).');
    var wires = j.wires.map(function (w) {
      var from = w.from && typeof w.from === 'object' ? w.from : { tag: w.fromTag, term: w.fromTerm };
      var to = w.to && typeof w.to === 'object' ? w.to : { tag: w.toTag, term: w.toTerm };
      return {
        no: String(w.no || ''), from: { tag: String(from.tag || ''), term: String(from.term || '') }, to: { tag: String(to.tag || ''), term: String(to.term || '') },
        color: w.color || '', colorSource: w.colorSource || '', section: Number(w.section) || null, wireType: w.wireType || '',
        func: w.func || '', potential: w.potential || '', desc: w.desc || '', explain: w.explain || '', page: Number(w.page) || null
      };
    }).filter(function (w) { return w.from.tag && w.to.tag; });
    var components = (j.components || []).map(function (c) {
      return { tag: String(c.tag || ''), type: c.type || '', name: c.name || '', desc: c.desc || '', maker: c.maker || '', partNo: c.partNo || '', location: c.location || '', page: Number(c.page) || null };
    }).filter(function (c) { return c.tag; });
    var out = { meta: j.meta || {}, components: components, wires: wires, notes: Array.isArray(j.notes) ? j.notes : [] };
    var lp = layoutFromJson(j.layout);
    if (lp) out.layoutPlan = lp;
    return out;
  }

  return { SCHEMA: SCHEMA, build: build, copyPrompt: copyPrompt, chunkPrompt: chunkPrompt, merge: merge, parse: parse, fromJson: fromJson, layoutFromJson: layoutFromJson, mergeLayouts: mergeLayouts };
});
