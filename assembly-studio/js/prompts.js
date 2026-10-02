/* מכלול — ההנחיות ל-Claude, מבנה התכנית ותכנית בסיסית בלי AI.
   קובץ משותף: נטען בדפדפן (window.AsmPrompts) ובשרת (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AsmPrompts = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SYSTEMS = {
    machine: 'מכונה / מתקן מכני',
    conveyor: 'מסוע / מערכת שינוע',
    automation: 'אוטומציה / רובוטיקה',
    steel: 'מבנה פלדה / שלדה',
    hydraulic: 'צנרת / הידראוליקה / פנאומטיקה',
    electrical: 'ארון חשמל / לוח בקרה',
    pump: 'משאבה / מדחס / תמסורת',
    furniture: 'רהיט / נגרות / מסגרות',
    other: 'אחר'
  };

  var FASTENER = /(bolt|screw|nut|washer|rivet|pin|dowel|stud|circlip|retaining|key\b|iso\s?\d|din\s?\d|m\d+\s?x|בורג|ברג|אום|דיסקית|פין|מסמרת|טבעת\s?נעילה|שגם)/i;
  var WEAR = /(bearing|seal|o-?ring|gasket|belt|chain|filter|bush|spring|brush|pad|wheel|roller|coupling|hose|מיסב|אטם|אטמים|רצועה|שרשרת|מסנן|פילטר|תותב|קפיץ|גלגל|גלגלת|מצמד|צינור|רפידה)/i;
  var PURCHASED = /(motor|gear\s?box|reducer|sensor|valve|cylinder|pump|switch|relay|plc|drive|מנוע|תמסורת|חיישן|ברז|שסתום|בוכנה|משאבה|מפסק|ממסר|בקר)/i;

  function guessType(name) {
    if (FASTENER.test(name)) return 'fastener';
    if (PURCHASED.test(name)) return 'purchased';
    return 'part';
  }

  var TYPE_LABELS = { part: 'חלק מיוצר', fastener: 'מחבר / בורג', purchased: 'פריט קנוי', sub: 'תת-מכלול' };
  var SPARE_LABELS = { wear: 'חלק בלאי', critical: 'חלק קריטי', consumable: 'מתכלה', fastener: 'מחברים' };

  /* ---------- מבנה התכנית (JSON Schema לפלט מובנה) ---------- */
  var PLAN_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'summary', 'crew', 'bom', 'tools', 'safety', 'steps', 'spares', 'maintenance', 'notes'],
    properties: {
      title: { type: 'string' },
      bom: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'qty', 'type', 'material', 'size', 'ref', 'notes'],
          properties: {
            name: { type: 'string' },
            qty: { type: 'integer' },
            type: { type: 'string', enum: ['part', 'fastener', 'purchased', 'sub'] },
            material: { type: 'string' },
            size: { type: 'string' },
            ref: { type: 'string' },
            notes: { type: 'string' }
          }
        }
      },
      summary: { type: 'string' },
      crew: { type: 'integer' },
      tools: { type: 'array', items: { type: 'string' } },
      safety: { type: 'array', items: { type: 'string' } },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'part_ids', 'instructions', 'fasteners', 'torque', 'check', 'caution', 'minutes'],
          properties: {
            title: { type: 'string' },
            part_ids: { type: 'array', items: { type: 'integer' } },
            instructions: { type: 'array', items: { type: 'string' } },
            fasteners: { type: 'string' },
            torque: { type: 'string' },
            check: { type: 'string' },
            caution: { type: 'string' },
            minutes: { type: 'integer' }
          }
        }
      },
      spares: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['part_id', 'name', 'qty', 'category', 'reason', 'interval'],
          properties: {
            part_id: { type: 'integer' },
            name: { type: 'string' },
            qty: { type: 'integer' },
            category: { type: 'string', enum: ['wear', 'critical', 'consumable', 'fastener'] },
            reason: { type: 'string' },
            interval: { type: 'string' }
          }
        }
      },
      maintenance: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['task', 'interval'],
          properties: { task: { type: 'string' }, interval: { type: 'string' } }
        }
      },
      notes: { type: 'string' }
    }
  };

  function fmt(n) { return Math.round(Number(n) || 0); }

  function bomText(p) {
    return (p.parts || []).map(function (part, i) {
      var line = '#' + (i + 1) + ' ' + part.name + ' ×' + (part.qty || 1) + ' [' + (TYPE_LABELS[part.type] || 'חלק') + ']';
      if (part.size) line += ' מידות ' + part.size.map(fmt).join('×');
      else if (part.dims) line += ' מידות ' + part.dims;
      if (part.center) line += ' מרכז (' + part.center.map(fmt).join(', ') + ')';
      if (part.material) line += ' חומר: ' + part.material;
      if (!part.geo) line += ' (ללא גאומטריה, שם מקובץ SolidWorks)';
      if (part.notes) line += ' — ' + part.notes;
      return line;
    }).join('\n') || '(אין רשימת חלקים מהמודל. בנה אותה מהשרטוטים, מהתמונות ומהתיאור.)';
  }

  function projectCard(p) {
    return [
      'שם הפרויקט: ' + (p.name || '(ללא שם)'),
      'סוג המערכת: ' + (SYSTEMS[p.system] || p.system || 'לא צוין'),
      'תיאור המערכת ומה רוצים לבנות: ' + (p.description || '(לא נמסר)'),
      p.environment ? 'סביבת עבודה ושימוש: ' + p.environment : '',
      p.crew ? 'צוות ההרכבה: ' + p.crew + ' אנשים' : '',
      'קבצים שהועלו: ' + ((p.files || []).map(function (f) { return f.name; }).join(', ') || 'אין'),
      p.drawings && p.drawings.length ? 'שרטוטים ותמונות מצורפים: ' + p.drawings.join(', ') : '',
      p.bounds ? 'מידות המכלול הכולל (יחידות המודל, בדרך כלל מ״מ): ' + p.bounds.map(fmt).join(' × ') + ' (רוחב X × גובה Y × עומק Z, ציר Y כלפי מעלה)' : ''
    ].filter(Boolean).join('\n');
  }

  var SYSTEM_PROMPT = [
    'אתה מהנדס ייצור והרכבה בכיר. אתה כותב תכניות הרכבה ותיקי הרכבה לטכנאים בשטח, בעברית מקצועית, ברורה ותמציתית.',
    'אתה מקבל רשימת חלקים (BOM) שחולצה ממודל SolidWorks, עם מידות ומיקום כל חלק במכלול, ולעיתים שרטוט איזומטרי ממוספר.',
    'כללים:',
    '- סדר השלבים חייב להיות בר-ביצוע פיזית: קודם בסיס/שלדה, אחר כך חלקים שנתמכים עליו, ומחברים מיד אחרי החלקים שהם מחברים. היעזר במיקומים ובמידות כדי להבין מה נשען על מה.',
    '- כל חלק מה-BOM מופיע בדיוק בשלב אחד (part_ids הם מספרי השורות ב-BOM). אל תמציא מספרי חלקים.',
    '- 4 עד 14 שלבים. כל שלב: כותרת קצרה, 2 עד 6 הוראות בפעלים (״הנח״, ״הברג״, ״ודא״), ומה בודקים בסוף השלב.',
    '- מומנטי הידוק: תן ערך מקובל לפי קוטר הבורג ודרגת החוזק אם אפשר להסיק אותם (למשל M8 8.8 ≈ 25 נ״מ), וציין ״יש לאמת מול המפרט״. אם אין מחברים, כתוב ״—״.',
    '- חלקי חילוף: חלקי בלאי (מיסבים, אטמים, רצועות, מסננים), חלקים קריטיים שהשבתתם עוצרת את המערכת, מתכלים (שמן, גריז, דבק הברגות) ומחברים. part_id הוא מספר השורה ב-BOM, או 0 לפריט שאינו ב-BOM. תן כמות מומלצת למלאי ותדירות החלפה.',
    '- בטיחות: ציוד מגן, הרמה (משקל משוער לחלקים גדולים), ניתוק אנרגיה כשרלוונטי.',
    '- אל תמציא נתונים שאין להם בסיס. כשאתה מניח הנחה, כתוב אותה ב-notes.',
    'ניתוח שרטוטים ותמונות (כשהם מצורפים):',
    '- קרא את השרטוט כמו מהנדס: טבלת הכותרת (שם, מספר שרטוט, חומר, משקל, קנה מידה), טבלת החלקים (BOM) אם יש, בלונים ממוספרים, מבטים וחתכים, מידות עיקריות, הערות כלליות, סימוני ריתוך, טולרנסים וגימור.',
    '- הבן מהמבטים אילו חלקים יש, כמה פעמים כל אחד מופיע (גם ברגים, אומים, דיסקיות ופינים), ואיך הם מתחברים.',
    '- bom הוא רשימת החלקים המלאה: name בעברית או כפי שכתוב בשרטוט, qty, type, material (מהשרטוט או ״לא צוין״), size (מידות עיקריות או מידת בורג, למשל M8×25), ref (מספר הבלון או מספר הפריט בשרטוט, או ריק), notes.',
    '- אם בקלט כבר יש רשימת חלקים מהמודל: השאר את השורות שלה באותו סדר ובאותם שמות בתחילת bom, ורק הוסף בסופה פריטים שמופיעים בשרטוט ולא במודל. אם אין רשימה, בנה אותה מהשרטוט.',
    '- part_ids בשלבים וב-spares מתייחסים למספרי השורות ב-bom שלך (מ-1).',
    '- מה שלא קריא או לא ודאי בשרטוט: כתוב זאת ב-notes של הפריט ובהערות הכלליות, ואל תנחש מספרים.'
  ].join('\n');

  function build(p) {
    var cached = '## פרטי הפרויקט\n' + projectCard(p) + '\n\n## רשימת חלקים (BOM)\n' + bomText(p);
    if (p.drawingText) cached += '\n\n## טקסט שחולץ מקבצי השרטוט (PDF)\n' + String(p.drawingText).slice(0, 30000);
    var instruction = (p.drawings && p.drawings.length ? 'נתח את השרטוטים והתמונות המצורפים, בנה מהם רשימת חלקים מלאה (bom), ' : 'בנה רשימת חלקים (bom), ') +
      'וכתוב תכנית הרכבה מלאה למערכת: שלבים, כלים, בטיחות, חלקי חילוף ותחזוקה. החזר JSON בלבד לפי המבנה.';
    if (p.planNote) instruction += '\nהערה מהמשתמש לגרסה הזו: ' + p.planNote;
    return { system: SYSTEM_PROMPT, cached: cached, instruction: instruction, schema: PLAN_SCHEMA, maxTokens: 16000, effort: 'high' };
  }

  /* הנחיה מלאה להעתקה ל-Claude.ai (מצב בלי שרת) */
  function copyPrompt(p) {
    var s = build(p);
    var attach = p.drawings && p.drawings.length ? '\n\n(מצורפות להודעה הזו תמונות השרטוט: ' + p.drawings.join(', ') + ')' : '';
    return s.system + '\n\n' + s.cached + attach + '\n\n' + s.instruction +
      '\n\nהחזר אובייקט JSON יחיד, בלי טקסט נוסף, במבנה הזה:\n' + JSON.stringify(PLAN_SCHEMA);
  }

  /* ---------- תכנית בסיסית בלי AI ---------- */
  function dist(a, b) {
    if (!a || !b) return 1e9;
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  }
  function vol(part) { return part.size ? part.size[0] * part.size[1] * part.size[2] : 0; }
  function foot(part) { return part.size ? part.size[0] * part.size[2] : 0; }

  function basicPlan(p) {
    var parts = (p.parts || []).map(function (part, i) { return Object.assign({ id: i + 1 }, part); });
    var bodies = parts.filter(function (x) { return x.type !== 'fastener'; });
    var fasteners = parts.filter(function (x) { return x.type === 'fastener'; });
    // בסיס = החלק עם שטח המגע הגדול ביותר מבין החלקים הנמוכים; אחר כך מלמטה למעלה
    var bottom = function (x) { return x.center && x.size ? x.center[1] - x.size[1] / 2 : 0; };
    var low = Math.min.apply(null, bodies.map(bottom).concat([0]));
    var span = Math.max.apply(null, bodies.map(function (x) { return x.size ? x.size[1] : 0; }).concat([1]));
    bodies.sort(function (a, b) {
      var al = bottom(a) - low < span * 0.1, bl = bottom(b) - low < span * 0.1;
      if (al !== bl) return al ? -1 : 1;
      return foot(b) - foot(a) || vol(b) - vol(a);
    });
    var base = bodies.shift();
    bodies.sort(function (a, b) {
      var ay = a.center ? a.center[1] - (a.size ? a.size[1] / 2 : 0) : 0;
      var by = b.center ? b.center[1] - (b.size ? b.size[1] / 2 : 0) : 0;
      return ay - by;
    });
    var order = base ? [base].concat(bodies) : bodies;
    var steps = order.map(function (part, i) {
      return {
        title: i === 0 ? 'הצבת ' + part.name + ' כבסיס' : 'התקנת ' + part.name,
        part_ids: [part.id],
        instructions: i === 0
          ? ['נקה את משטח העבודה והנח עליו את ' + part.name + '.', 'פלס וקבע את החלק כך שלא יזוז בזמן ההרכבה.']
          : ['הבא את ' + part.name + ' (×' + (part.qty || 1) + ') למקומו לפי השרטוט.', 'ודא התאמה ומיקום נכון לפני קיבוע.'],
        fasteners: '', torque: '—', check: 'החלק יושב במקומו ללא מרווחים או מאמצים.', caution: '', minutes: 5 + Math.round((part.qty || 1) * 2)
      };
    });
    // כל מחבר מצטרף לשלב של החלק הקרוב אליו
    fasteners.forEach(function (f) {
      var best = 0, bestD = 1e12;
      order.forEach(function (part, i) { var d = dist(f.center, part.center); if (d < bestD) { bestD = d; best = i; } });
      var st = steps[Math.min(best, steps.length - 1)];
      if (!st) { steps.push(st = { title: 'חיבורים', part_ids: [], instructions: [], fasteners: '', torque: '—', check: '', caution: '', minutes: 5 }); }
      st.part_ids.push(f.id);
      st.fasteners = (st.fasteners ? st.fasteners + ', ' : '') + f.name + ' ×' + (f.qty || 1);
      st.instructions.push('הברג את ' + f.name + ' (×' + (f.qty || 1) + ') בהידוק אלכסוני הדרגתי.');
      st.torque = 'לפי מפרט הבורג';
      st.minutes += Math.round((f.qty || 1) * 1.5);
    });
    var spares = [];
    parts.forEach(function (part) {
      if (part.type === 'fastener') spares.push({ part_id: part.id, name: part.name, qty: Math.max(2, Math.ceil((part.qty || 1) * 0.1)), category: 'fastener', reason: 'אובדן או נזק בזמן פירוק', interval: 'מלאי קבוע' });
      else if (WEAR.test(part.name)) spares.push({ part_id: part.id, name: part.name, qty: part.qty || 1, category: 'wear', reason: 'חלק בלאי', interval: 'לפי הוראות היצרן' });
      else if (part.type === 'purchased') spares.push({ part_id: part.id, name: part.name, qty: 1, category: 'critical', reason: 'פריט קנוי שהשבתתו עוצרת את המערכת', interval: 'לפי צורך' });
    });
    return {
      title: 'תכנית הרכבה — ' + (p.name || 'מכלול'),
      summary: 'תכנית בסיסית שנבנתה אוטומטית לפי גודל ומיקום החלקים במודל. מומלץ לעבור עליה ולהתאים, או ליצור תכנית מלאה עם Claude.',
      crew: Number(p.crew) || 2,
      tools: ['סט מפתחות רינג-פתוח', 'מפתח מומנט', 'סט אלנים', 'פלס', 'סרט מדידה', 'פטיש גומי'],
      safety: ['נעלי בטיחות, כפפות ומשקפי מגן', 'הרמת חלקים מעל 25 ק״ג בשניים או בציוד הרמה'],
      steps: steps,
      spares: spares,
      maintenance: [{ task: 'בדיקת הידוק ברגים', interval: 'אחרי 50 שעות עבודה ואחר כך כל רבעון' }],
      notes: ''
    };
  }

  /* ניקוי JSON שהודבק ידנית */
  function parsePlan(text) {
    var s = String(text || '').trim();
    var a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b < a) throw new Error('לא נמצא JSON בתשובה');
    var plan = JSON.parse(s.slice(a, b + 1));
    if (!plan || !Array.isArray(plan.steps)) throw new Error('בתשובה חסרים שלבים (steps)');
    return normalize(plan);
  }

  function normalize(plan) {
    plan.bom = Array.isArray(plan.bom) ? plan.bom.filter(function (b) { return b && b.name; }) : null;
    plan.tools = plan.tools || []; plan.safety = plan.safety || []; plan.spares = plan.spares || []; plan.maintenance = plan.maintenance || [];
    plan.steps = plan.steps.map(function (s) {
      return {
        title: s.title || 'שלב', part_ids: (s.part_ids || []).map(Number).filter(Boolean),
        instructions: Array.isArray(s.instructions) ? s.instructions : String(s.instructions || '').split('\n').filter(Boolean),
        fasteners: s.fasteners || '', torque: s.torque || '—', check: s.check || '', caution: s.caution || '', minutes: Number(s.minutes) || 0
      };
    });
    return plan;
  }

  return {
    SYSTEMS: SYSTEMS, TYPE_LABELS: TYPE_LABELS, SPARE_LABELS: SPARE_LABELS, PLAN_SCHEMA: PLAN_SCHEMA,
    guessType: guessType, build: build, copyPrompt: copyPrompt, basicPlan: basicPlan, parsePlan: parsePlan, normalize: normalize, bomText: bomText
  };
});
