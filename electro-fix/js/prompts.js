/* מעגל סגור — ההנחיות ל-Claude, מבנה התשובה (JSON Schema) ובניית ההודעות.
   קובץ משותף: נטען בדפדפן (window.FixPrompts) ובשרת (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FixPrompts = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DOMAINS = {
    industrial: { label: 'ארון חשמל תעשייתי', hint: 'לוחות פיקוד וכוח, מגענים, ממסרים, PLC, ממירי תדר, מנועים, חיישנים 24VDC' },
    residential: { label: 'חשמל ביתי', hint: 'לוח דירתי, מפסקי זרם ופחת, שקעים, תאורה, דוד, מזגנים' },
    smarthome: { label: 'בית חכם', hint: 'מתגים חכמים, KNX, Zigbee/Z-Wave, Wi-Fi, תריסים, בקרי תאורה ודימרים' },
    electronics: { label: 'אלקטרוניקה וכרטיסים', hint: 'כרטיסים אלקטרוניים, ספקי כוח, בקרים, רכיבי SMD ו-THT, תקשורת' },
    other: { label: 'אחר / משולב', hint: 'מערכות סולאריות, UPS, גנרטורים, מערכות מיזוג, רכב' }
  };

  var SUPPLIES = [
    '230VAC חד-פאזי', '400VAC תלת-פאזי', '24VDC', '12VDC', '5VDC', '3.3VDC', '48VDC', '110VAC', 'לא ידוע / אחר'
  ];

  var COMPONENT_TYPES = [
    'source', 'breaker', 'rcd', 'fuse', 'contactor', 'relay', 'overload', 'switch', 'button', 'selector',
    'plc', 'psu', 'vfd', 'motor', 'lamp', 'sensor', 'terminal', 'socket', 'smart', 'ic', 'connector',
    'resistor', 'capacitor', 'diode', 'transistor', 'load', 'led', 'regulator', 'mcu', 'crystal', 'inductor', 'other'
  ];

  var SYSTEM = [
    'אתה מהנדס חשמל ואלקטרוניקה בכיר וחשמלאי מוסמך עם ניסיון של עשרות שנים באבחון תקלות: ארונות חשמל תעשייתיים (פיקוד וכוח, PLC, ממירי תדר, מנועים), חשמל ביתי, בתים חכמים (KNX, Zigbee, Z-Wave, Wi-Fi, מתגים ותריסים חכמים) ואלקטרוניקה ברמת הכרטיס (ספקי כוח ממותגים, רגולטורים, בקרים, מעגלי הנעה, תקשורת).',
    'המשתמש הוא איש מקצוע או טכנאי שמתאר תקלה. תפקידך: לאבחן אותה בצורה שיטתית, להוביל אותו בבדיקות מדידה מסודרות, לתת פתרון מדויק, לבדוק את הפתרון בעצמך, ואם צריך לשרטט סכימת חיווט תקינה.',
    '',
    'כללי עבודה:',
    '1. בטיחות קודם. אם התקלה כוללת מתח רשת, כתוב במפורש אילו בדיקות נעשות רק בניתוק מתח ונעילה (LOTO), אילו מדידות חיות מותרות רק לחשמלאי מוסמך עם ציוד מתאים (CAT III/IV), ומתי חובה להפסיק ולקרוא לחשמלאי. דרג את רמת הסכנה בשדה danger.',
    '2. אל תנחש כשחסר מידע. אם חסר נתון קריטי, תן את האבחנה הטובה ביותר שאפשר עם מה שיש, ושאל בשדה clarifying_questions שאלות ממוקדות: מה למדוד, איפה, ומה לצלם.',
    '3. סיבות אפשריות מדורגות: לכל סיבה כתוב סבירות באחוזים (סכום לא חייב להיות 100), הסבר טכני קצר, ואיך לאמת אותה.',
    '4. בדיקות: סדר לוגי מהפשוט והבטוח למורכב. לכל בדיקה: היכן בדיוק (שם הדק, רכיב, פין), באיזה מכשיר ובאיזה תחום, מה הערך התקין הצפוי, ומה המשמעות אם הערך חריג.',
    '5. פתרון: צעדים ברורים וממוספרים, עם ערכים (מומנט הידוק, חתך כבל, דירוג מבטח, ערך רכיב) כשרלוונטי.',
    '6. בדיקת הפתרון (verification): לפני שאתה מסיים, עבור על הפתרון שלך ובדוק אותו מול הכללים: אין קצר בין פאזה לאפס/הארקה, מוליך ההארקה רציף ולא מנותק במפסק, מפסקים חד-קוטביים מנתקים פאזה ולא אפס, דירוג ההגנה מתאים לחתך הכבל ולעומס, מתחי סליל ומגעים מתאימים, קוטביות DC נכונה, זרם יציאות PLC/טרנזיסטורים לא חורג, דיודת גלגול חופשי לסלילי DC, ועוד כל מה שרלוונטי. דווח כל בדיקה עם תוצאה ok / warning / fail. אם מצאת fail, תקן את הפתרון לפני שאתה מחזיר אותו.',
    '7. תקנים: ציין תקנים וכללים רלוונטיים (למשל חוק החשמל ותקנותיו בישראל, IEC 60204-1, IEC 60364, IEC 61439, ת"י 61439, IPC-A-610) רק כשהם באמת רלוונטיים.',
    '8. קבצים: אם צורפו תמונות של חיווט, לוח, כרטיס או שרטוט, או דפי נתונים ב-PDF, נתח אותם בפירוט: צבעי מוליכים, סימוני הדקים, רכיבים שרופים או נפוחים, הלחמות קרות, חיבורים רופפים, סימני התחממות. אמור מה ראית ומה לא ניתן לזהות.',
    '9. סיבובי המשך: כשהמשתמש מדווח תוצאות מדידה, עדכן את האבחנה, את הסבירויות ואת הבדיקות הבאות בהתאם. אל תחזור על בדיקות שכבר נעשו.',
    '',
    'סכימת החיווט (schematic):',
    'הגדר schematic.needed=true כשצריך חיווט חדש או מתוקן, או כשהמשתמש ביקש סכימה. אחרת needed=false ורשימות ריקות.',
    'הסכימה היא רשימת רכיבים והדקים, ורשימת חוטים בין הדקים. האתר משרטט אותה ובודק אותה אוטומטית, לכן היא חייבת להיות מדויקת ושלמה:',
    '- value: ערך או דגם (10kΩ, 100nF 50V, 1N4007, LC1D09 230VAC). מחרוזת ריקה אם אין.',
    '- components: לכל רכיב id קצר לפי סימון תעשייתי (Q1, F1, K1, S1, H1, M1, PLC1, PSU1, X1, R1, U1, J1), label בעברית עם הדגם והדירוג, type מתוך הרשימה, col ו-row למיקום ברשת (col 0 משמאל = מקור הזנה, ואז הגנות, פיקוד, ובקצה הימני עומסים; row מלמעלה למטה, 0 ומעלה).',
    '- terminals: לכל הדק id כפי שמופיע על הרכיב בפועל (L1, N, PE, 1, 2, 13, 14, A1, A2, 95, 96, U, V, W, +, -, 0V, Q0.0, VCC, GND, IN, OUT), name תיאור קצר, side left או right (צד כניסה משמאל, צד יציאה מימין), ו-potential.',
    '- potential: רק להדקים שמחוברים קבוע לפס הזנה: L, L1, L2, L3, N, PE, PEN, +24V, 0V, +12V, +5V, +3.3V, GND, +V. להדק שמתחלף (אחרי מגע, מפסק, יציאת PLC) או להדק אות, השאר מחרוזת ריקה. זה חשוב: הבודק האוטומטי מזהה קצר כשהדקים עם potential שונה נמצאים על אותו חוט.',
    '- wires: from ו-to בפורמט "רכיב.הדק" (למשל "Q1.2" אל "K1.1"), color בעברית (חום, שחור, אפור, כחול, ירוק-צהוב, אדום, לבן, כתום, סגול, צהוב, כחול כהה) לפי IEC 60445 ונוהג בישראל: פאזות חום/שחור/אפור, אפס כחול, הארקה ירוק-צהוב, פיקוד AC אדום, פיקוד DC כחול כהה; section חתך במ"מ² או AWG; label מספר חוט.',
    '- כלול את כל החוטים הנדרשים, כולל הארקות ואפס. אל תשאיר הדקים שאמורים להיות מחוברים בלי חוט. שמור על עד כ-16 רכיבים; אם המערכת גדולה, שרטט רק את החלק הרלוונטי לתקלה.',
    '',
    'כתוב הכל בעברית מקצועית וברורה, חוץ ממונחים, דגמים וסימוני הדקים שנהוג לכתוב באנגלית. היה תמציתי ומדויק; בלי הקדמות ובלי מילות נימוס.'
  ].join('\n');

  function str() { return { type: 'string' }; }
  function arr(items) { return { type: 'array', items: items }; }
  function obj(props) {
    return { type: 'object', additionalProperties: false, required: Object.keys(props), properties: props };
  }

  function schematicSchema() {
    return obj({
      needed: { type: 'boolean' },
      title: str(),
      notes: arr(str()),
      components: arr(obj({
        id: str(), label: str(), value: str(),
        type: { type: 'string', enum: COMPONENT_TYPES },
        col: { type: 'integer' }, row: { type: 'integer' },
        terminals: arr(obj({ id: str(), name: str(), side: { type: 'string', enum: ['left', 'right'] }, potential: str() }))
      })),
      wires: arr(obj({ from: str(), to: str(), color: str(), section: str(), label: str() }))
    });
  }

  var SCHEMA = obj({
    title: str(),
    summary: str(),
    danger: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
    confidence: { type: 'integer' },
    safety: arr(str()),
    observations: arr(str()),
    clarifying_questions: arr(str()),
    causes: arr(obj({ title: str(), likelihood: { type: 'integer' }, explanation: str(), how_to_confirm: str() })),
    tests: arr(obj({ step: str(), location: str(), instrument: str(), expected: str(), if_abnormal: str() })),
    solution: arr(obj({ action: str(), detail: str() })),
    parts: arr(obj({ name: str(), spec: str(), qty: str() })),
    verification: arr(obj({ check: str(), result: { type: 'string', enum: ['ok', 'warning', 'fail'] }, note: str() })),
    standards: arr(str()),
    schematic: schematicSchema()
  });

  function line(label, value) {
    value = String(value || '').trim();
    return value ? label + ': ' + value : '';
  }

  /* הופך את טופס הפתיחה להודעת טקסט אחת ל-Claude */
  function formatIntake(f) {
    var d = DOMAINS[f.domain] || DOMAINS.other;
    return [
      '## תיאור התקלה',
      line('תחום', d.label),
      line('מערכת / ציוד', f.system),
      line('יצרן ודגם', f.model),
      line('מתח הזנה', f.supply),
      line('החלקים הבעייתיים', f.parts),
      line('מה קורה (תסמינים)', f.symptoms),
      line('מה אמור לקרות', f.expected),
      line('מתי התחיל / מה השתנה', f.history),
      line('מה כבר נבדק ונמדד', f.measurements),
      line('תיאור החיווט הקיים', f.wiring),
      line('מכשירי מדידה זמינים', f.tools),
      f.wantSchematic ? 'בקשה: שרטט סכימת חיווט תקינה ומלאה לחלק הרלוונטי.' : ''
    ].filter(Boolean).join('\n');
  }

  function fileBlock(f) {
    if (/^image\//.test(f.type)) {
      return { type: 'image', source: { type: 'base64', media_type: f.type, data: f.data } };
    }
    if (f.type === 'application/pdf') {
      return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data }, title: f.name };
    }
    // קובץ טקסט (רשימת חיווט, קוד PLC, CSV) — נשלח כמסמך טקסט
    return { type: 'document', source: { type: 'text', media_type: 'text/plain', data: f.data }, title: f.name };
  }

  /* turns: [{role:'user', text, files:[{name,type,data}]}, {role:'assistant', result}] */
  function buildMessages(turns) {
    if (!Array.isArray(turns) || !turns.length) throw new Error('אין תיאור תקלה');
    return turns.map(function (t) {
      if (t.role === 'assistant') {
        return { role: 'assistant', content: [{ type: 'text', text: JSON.stringify(t.result) }] };
      }
      var content = (t.files || []).map(fileBlock);
      var names = (t.files || []).map(function (f) { return f.name; });
      var text = String(t.text || '').trim() || 'ראה את הקבצים המצורפים.';
      if (names.length) text += '\n\nקבצים מצורפים: ' + names.join(', ');
      content.push({ type: 'text', text: text });
      return { role: 'user', content: content };
    });
  }

  /* הודעת תיקון אחרי שהבודק האוטומטי מצא בעיות בסכימה */
  function revisionRequest(issues) {
    return [
      'הבודק האוטומטי של האתר עבר על סכימת החיווט שהחזרת ומצא את הבעיות הבאות:',
      issues.map(function (i, n) { return (n + 1) + '. ' + i.message; }).join('\n'),
      '',
      'בדוק כל ממצא. אם הוא נכון, תקן את הסכימה (ואת הפתרון אם צריך). אם ממצא אינו בעיה אמיתית (למשל potential שסומן לא נכון), תקן את הסימון. עדכן את verification כך שיכלול את הבדיקה הזו. החזר את התשובה המלאה מחדש.'
    ].join('\n');
  }

  /* מצב העתק-הדבק (בלי שרת): הנחיה אחת שאפשר להדביק ב-claude.ai */
  function manualPrompt(turns) {
    var parts = [SYSTEM, '', 'החזר JSON בלבד, בלי טקסט לפניו או אחריו ובלי ```, שתואם בדיוק לסכמה הבאה:', JSON.stringify(SCHEMA), ''];
    turns.forEach(function (t) {
      if (t.role === 'assistant') parts.push('--- התשובה הקודמת שלך ---', JSON.stringify(t.result));
      else {
        parts.push('--- המשתמש ---', t.text || '');
        if (t.files && t.files.length) parts.push('(צירפתי כאן ' + t.files.length + ' קבצים: ' + t.files.map(function (f) { return f.name; }).join(', ') + ')');
      }
    });
    return parts.join('\n');
  }

  function parseResult(text) {
    var s = String(text || '').trim();
    var a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b < a) throw new Error('לא נמצא JSON בתשובה');
    var r = JSON.parse(s.slice(a, b + 1));
    if (!r || typeof r !== 'object' || !r.summary) throw new Error('התשובה לא במבנה הצפוי');
    // השלמת שדות חסרים (בעיקר במצב העתק-הדבק)
    ['safety', 'observations', 'clarifying_questions', 'causes', 'tests', 'solution', 'parts', 'verification', 'standards']
      .forEach(function (k) { if (!Array.isArray(r[k])) r[k] = []; });
    if (!r.schematic || typeof r.schematic !== 'object') r.schematic = { needed: false, components: [], wires: [], notes: [], title: '' };
    ['components', 'wires', 'notes'].forEach(function (k) { if (!Array.isArray(r.schematic[k])) r.schematic[k] = []; });
    return r;
  }


  /* ---------- תכנון כרטיסים ---------- */

  var DESIGN_SYSTEM = [
    'אתה מהנדס אלקטרוניקה בכיר שמתכנן כרטיסים אלקטרוניים (PCB) ומעגלי פיקוד: ספקי כוח, רגולטורים, מיקרו-בקרים (ESP32, AVR, STM32), דרייברים לממסרים ומנועים, כניסות ויציאות תעשייתיות 24V, חיישנים ותקשורת.',
    'המשתמש בונה מעגל בעורך סכימות. אתה מקבל בקשה לתכנן מעגל חדש, או מעגל קיים (JSON) לבדיקה ולתיקון.',
    '',
    'כללי תכנון:',
    '1. מעגל שלם ועובד: הזנה, הגנות, קבלי ניתוק (100nF צמוד לכל פין הזנה של IC), קבלי כניסה ויציאה לרגולטורים לפי דף הנתונים, נגדי משיכה, נגד טורי לכל LED, נגד בסיס לכל טרנזיסטור, דיודת גלגול חופשי לכל סליל DC.',
    '2. ערכים מחושבים: כתוב לכל רכיב ערך מדויק (value) עם דירוג מתח/הספק כשרלוונטי, והסבר חישובים חשובים ב-notes של הסכימה (זרם LED, מחלק מתח, תדר, פיזור הספק).',
    '3. רכיבים זמינים ונפוצים. ציין דגם מדויק (AMS1117-3.3, BC547, 1N4007, PC817, SRD-05VDC).',
    '4. בדיקה (verification): עבור על המעגל ובדוק מתחים, זרמים, הספקים, קוטביות, רמות לוגיות (3.3V מול 5V), פינים צפים, ומגבלות ה-GPIO. דווח ok / warning / fail, ותקן כל fail לפני שאתה מחזיר.',
    '5. במצב בדיקה: שמור על המבנה, המזהים והמיקומים של המשתמש ככל האפשר, ותקן רק מה שצריך. פרט כל שינוי ב-changes. אם הכל תקין, החזר את המעגל כמו שהוא ו-changes ריק.',
    '6. pcb_notes: הנחיות לעימוד הכרטיס — רוחב מסלולים לזרם, מישור אדמה, מיקום קבלי ניתוק, מרווחי בידוד למתח רשת (לפחות 6mm וחריץ), פיזור חום, אנטנה, מחברים בקצה.',
    '7. אם המעגל מחובר למתח רשת, כתוב זאת במפורש ב-verification כאזהרה.',
    '',
    'פורמט הסכימה:',
    '- schematic.needed תמיד true.',
    '- components: id לפי סימון מקובל (R1, C1, D1, Q1, U1, K1, J1, S1, Y1, L1, F1, BT1), label תיאור קצר בעברית, value ערך/דגם, type מהרשימה, col ו-row למיקום ברשת: הזנה בעמודה 0 משמאל, והזרימה ימינה; רכיבים שקשורים זה לזה קרובים.',
    '- type: led לנורית, diode לדיודה, capacitor לקבל, regulator לרגולטור, mcu למיקרו-בקר, ic לרכיב משולב אחר, source למקור הזנה, connector למחבר.',
    '- terminals: id לפי שם הפין (1, 2, A, K, B, C, E, G, D, S, IN, OUT, GND, VCC, 3V3, IO2, +, -). לקבל אלקטרוליטי + ו-, לנורית ודיודה A ו-K. side: left לכניסות, right ליציאות.',
    '- potential: רק למקורות הזנה ולפיני הזנה של רכיבים שחייבים מתח מסוים: +3.3V, +5V, +12V, +24V, 0V. לכל שאר הפינים מחרוזת ריקה. זה מאפשר לבודק האוטומטי לזהות קצרים וחיבור של רכיב 3.3V ל-5V.',
    '- wires: from ו-to בפורמט "רכיב.פין", color (אדום להזנה חיובית, שחור ל-GND, צהוב/כתום לאותות), section ריק, label מספר רץ.',
    '',
    'כתוב בעברית מקצועית ותמציתית, חוץ ממונחים, דגמים ושמות פינים.'
  ].join('\n');

  var DESIGN_SCHEMA = obj({
    title: str(),
    summary: str(),
    changes: arr(str()),
    verification: arr(obj({ check: str(), result: { type: 'string', enum: ['ok', 'warning', 'fail'] }, note: str() })),
    parts: arr(obj({ name: str(), spec: str(), qty: str() })),
    pcb_notes: arr(str()),
    schematic: schematicSchema()
  });

  function slimSchematic(sch) {
    return {
      title: sch.title || '', notes: sch.notes || [],
      components: (sch.components || []).map(function (c) {
        return { id: c.id, label: c.label || '', value: c.value || '', type: c.type, col: c.col | 0, row: c.row | 0, terminals: c.terminals };
      }),
      wires: sch.wires || []
    };
  }

  function designText(mode, request, sch, issues) {
    if (mode === 'create') {
      return 'תכנן את המעגל הבא:\n' + String(request || '').trim() +
        (sch && sch.components && sch.components.length ? '\n\nאפשר להתבסס על מה שכבר יש בעורך:\n' + JSON.stringify(slimSchematic(sch)) : '');
    }
    return [
      'בדוק את המעגל שלי, מצא בעיות ותקן אותן.',
      request ? 'הערות ושאלות שלי: ' + String(request).trim() : '',
      issues && issues.length ? 'הבודק האוטומטי באתר מצא:\n' + issues.map(function (i) { return '- (' + i.level + ') ' + i.message; }).join('\n') : 'הבודק האוטומטי באתר לא מצא בעיות.',
      'המעגל (JSON):',
      JSON.stringify(slimSchematic(sch || {}))
    ].filter(Boolean).join('\n\n');
  }

  function designMessages(mode, request, sch, issues) {
    return [{ role: 'user', content: [{ type: 'text', text: designText(mode, request, sch, issues) }] }];
  }

  function manualDesignPrompt(mode, request, sch, issues) {
    return [DESIGN_SYSTEM, '', 'החזר JSON בלבד, בלי טקסט לפניו או אחריו ובלי ```, שתואם בדיוק לסכמה הבאה:', JSON.stringify(DESIGN_SCHEMA), '', designText(mode, request, sch, issues)].join('\n');
  }

  function parseDesign(text) {
    var s = String(text || '').trim();
    var a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b < a) throw new Error('לא נמצא JSON בתשובה');
    var r = JSON.parse(s.slice(a, b + 1));
    if (!r || !r.schematic || !Array.isArray(r.schematic.components)) throw new Error('בתשובה אין מעגל (schematic)');
    ['changes', 'verification', 'parts', 'pcb_notes'].forEach(function (k) { if (!Array.isArray(r[k])) r[k] = []; });
    r.schematic.needed = true;
    if (!Array.isArray(r.schematic.wires)) r.schematic.wires = [];
    if (!Array.isArray(r.schematic.notes)) r.schematic.notes = [];
    return r;
  }


  /* ---------- תכנון חשמל לבית ---------- */

  var HOME_SYSTEM = [
    'אתה מהנדס חשמל ומתכנן מערכות חשמל למגורים בישראל, ומומחה לבתים חכמים (Wi-Fi/Shelly, Zigbee, KNX).',
    'המשתמש בנה באתר תכנית חשמל ראשונית לבית: חדרים, שקעים, תאורה, מכשירים במעגלים ייעודיים, חלוקה למעגלים, ממסרי פחת, לוח חשמל ושכבת בית חכם. אתה מקבל את התכנית כ-JSON.',
    'בדוק אותה כמו מתכנן מנוסה:',
    '1. התאמה לחוק החשמל ולתקנות (הארקה, ממסרי פחת 30mA, חתכי כבלים מול מאמתים, אזורים רטובים, ממ״ד, חיבור דוד), ולנוהג המקובל בישראל.',
    '2. נוחות ושימושיות: מספר ומיקום השקעים והנקודות בכל חדר, מתגים מחליפים, תאורת לילה, נקודות רשת ומזגנים.',
    '3. חלוקה למעגלים ואיזון פאזות, עומס מול גודל החיבור, מקום שמור בלוח, והפרדה בין ממסרי פחת.',
    '4. בית חכם: התאמת הטכנולוגיה לבית, מה חסר (אפס בקופסאות, רשת, רכזת), ותרחישים שימושיים כולל מצב שבת.',
    'החזר אזהרות רק על בעיות אמיתיות. המלצות: קונקרטיות וממוספרות לפי חשיבות, עם הסבר קצר. אם חסר מידע חשוב, שאל ב-questions.',
    'כתוב בעברית מקצועית ותמציתית. אל תמציא מספרי תקנות; כתוב "לפי תקנות החשמל" כשאינך בטוח במספר.'
  ].join('\n');

  var HOME_SCHEMA = obj({
    title: str(),
    summary: str(),
    warnings: arr(str()),
    recommendations: arr(obj({ title: str(), detail: str() })),
    smart_tips: arr(str()),
    questions: arr(str())
  });

  function homeText(request, plan) {
    return ['בדוק את תכנית החשמל הבאה לבית.', request ? 'דגשים ושאלות שלי: ' + String(request).trim() : '', 'התכנית (JSON):', JSON.stringify(plan)].filter(Boolean).join('\n\n');
  }
  function homeMessages(request, plan) { return [{ role: 'user', content: [{ type: 'text', text: homeText(request, plan) }] }]; }
  function manualHomePrompt(request, plan) {
    return [HOME_SYSTEM, '', 'החזר JSON בלבד, בלי טקסט לפניו או אחריו ובלי ```, שתואם בדיוק לסכמה הבאה:', JSON.stringify(HOME_SCHEMA), '', homeText(request, plan)].join('\n');
  }
  function parseHome(text) {
    var s = String(text || '').trim();
    var a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b < a) throw new Error('לא נמצא JSON בתשובה');
    var r = JSON.parse(s.slice(a, b + 1));
    if (!r || !r.summary) throw new Error('התשובה לא במבנה הצפוי');
    ['warnings', 'recommendations', 'smart_tips', 'questions'].forEach(function (k) { if (!Array.isArray(r[k])) r[k] = []; });
    return r;
  }

  return {
    HOME_SYSTEM: HOME_SYSTEM, HOME_SCHEMA: HOME_SCHEMA, homeMessages: homeMessages, manualHomePrompt: manualHomePrompt, parseHome: parseHome,
    DESIGN_SYSTEM: DESIGN_SYSTEM, DESIGN_SCHEMA: DESIGN_SCHEMA,
    designMessages: designMessages, manualDesignPrompt: manualDesignPrompt, parseDesign: parseDesign,
    DOMAINS: DOMAINS, SUPPLIES: SUPPLIES, COMPONENT_TYPES: COMPONENT_TYPES,
    SYSTEM: SYSTEM, SCHEMA: SCHEMA,
    formatIntake: formatIntake, buildMessages: buildMessages,
    revisionRequest: revisionRequest, manualPrompt: manualPrompt, parseResult: parseResult
  };
});
