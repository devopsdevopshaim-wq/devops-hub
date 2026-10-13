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
    required: ['meta', 'components', 'wires', 'notes'],
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
      notes: { type: 'array', items: str }
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
    '2. חוטים: כל קו בתכנית בין שני הדקים הוא חוט. צומת שמחבר כמה הדקים מפורק לשרשרת של חוטים נקודה-לנקודה (Daisy chain) בסדר הגיוני: לא יותר משני חוטים על הדק אחד.',
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
    '10. meta: שם התכנית, מספר שרטוט, גרסה, מתח הזנה ומתח פיקוד כפי שמופיעים בטבלת הכותרת.'
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
      ' "notes":[]}'
    ].join('\n');
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
    return { meta: j.meta || {}, components: components, wires: wires, notes: Array.isArray(j.notes) ? j.notes : [] };
  }

  return { SCHEMA: SCHEMA, build: build, copyPrompt: copyPrompt, parse: parse, fromJson: fromJson };
});
