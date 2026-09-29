/* ספר — הנחיות הכתיבה, סוגות ומידות הספר.
   קובץ משותף: נטען בדפדפן (window.BookPrompts) ובשרת (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BookPrompts = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var GENRES = {
    memoir: {
      label: 'ממואר / דוקו אישי', factual: true,
      voice: 'ממואר ספרותי. נאמנות מוחלטת לעובדות, לשמות, לתאריכים ולמקומות שבחומר. מותר להעמיק ברגש, בתחושות, בהרהור ובתיאור החושי של רגעים שתוארו, ובהקשר ההיסטורי והחברתי של התקופה. אסור להמציא אירועים, דמויות או עובדות שלא נמסרו.'
    },
    biography: {
      label: 'ביוגרפיה', factual: true,
      voice: 'ביוגרפיה ספרותית רהוטה ומכובדת. נאמנות לעובדות שבחומר; מותר להוסיף הקשר תקופתי כללי ומוכר, אך לא להמציא פרטים ביוגרפיים.'
    },
    drama: { label: 'דרמה', voice: 'פרוזה דרמטית עשירה, מתח רגשי, דיאלוגים חיים, דמויות מורכבות וקשת התפתחות ברורה.' },
    romance: { label: 'רומן רומנטי', voice: 'פרוזה רומנטית, חושנית באיפוק, עדינה וסוחפת; כימיה, געגוע ומתח בין הדמויות, ותיאורי אווירה ענוגים.' },
    thriller: { label: 'מתח', voice: 'פרוזת מתח חדה: קצב, סוף פרק שמשאיר שאלה פתוחה, רמזים מדודים ותחושת איום מתגברת.' },
    historical: { label: 'רומן היסטורי', voice: 'רומן היסטורי עשיר בפרטי תקופה אמינים, בשפה מעט ארכאית ומהודרת, בלי אנכרוניזמים.' },
    fantasy: { label: 'פנטזיה', voice: 'פנטזיה אפית בשפה ציורית; בניית עולם עקבית, מיתוס ופלא.' },
    inspiration: { label: 'השראה והעצמה', voice: 'ספר השראה אישי: סיפור, תובנה ולקח, בשפה חמה, מרוממת ובהירה, בלי קלישאות.' },
    kids: { label: 'ספר ילדים', kids: true, voice: 'ספר ילדים מאויר: משפטים קצרים, מוזיקליים וקלים להקראה, חרוזים עדינים כשמתאים, חום, הומור ומסר ברור. אוצר מילים מותאם לגיל.' }
  };

  /* מידות העמוד במילימטרים. wpp = הערכת מילים לעמוד בגופן רגיל. */
  var TRIMS = {
    a5: { label: 'A5 — ‏14.8×21 ס״מ (ספר קריאה קלאסי)', w: 148, h: 210, m: [18, 16, 20, 14], wpp: 230 },
    us6x9: { label: '15.2×22.9 ס״מ (6×9 אינץ׳, סטנדרט הוצאות לאור)', w: 152, h: 229, m: [19, 17, 21, 15], wpp: 260 },
    large: { label: '17×24 ס״מ (ספר אלבום / ביוגרפיה)', w: 170, h: 240, m: [20, 19, 22, 17], wpp: 320 },
    kidsq: { label: '21×21 ס״מ (ספר ילדים ריבועי)', w: 210, h: 210, m: [14, 14, 16, 14], wpp: 45 },
    kidsl: { label: '28×21.6 ס״מ (ספר ילדים לרוחב)', w: 280, h: 216, m: [14, 14, 16, 14], wpp: 55 }
  };

  var LENGTHS = [24, 32, 50, 100, 150, 200, 250, 300, 350, 450];

  function wordsCount(text) {
    var m = String(text || '').trim().match(/\S+/g);
    return m ? m.length : 0;
  }

  function isKids(p) { return p.genre === 'kids'; }

  /* תכנון אורך: כמה מילים וכמה פרקים דרושים לספר ביעד העמודים. */
  function plan(p) {
    var trim = TRIMS[p.trim] || TRIMS.a5;
    var pages = Math.max(8, Number(p.targetPages) || 200);
    if (isKids(p)) {
      var scenes = Math.max(6, pages - 4);
      return { kids: true, chapters: scenes, wordsPerChapter: Math.round(trim.wpp * 0.8), totalWords: scenes * Math.round(trim.wpp * 0.8), wpp: trim.wpp };
    }
    var imagePages = (p.images || []).filter(function (i) { return i.place && i.place.position === 'full'; }).length;
    var front = 6 + Math.ceil(((p.chapters && p.chapters.length) || 12) / 16);
    var bodyPages = Math.max(4, pages - front - imagePages);
    var totalWords = Math.round(bodyPages * trim.wpp / (Number(p.fontScale) || 1) / (Number(p.fontScale) || 1));
    var chapters = Math.min(40, Math.max(3, Math.round(totalWords / 3500)));
    return { kids: false, chapters: chapters, wordsPerChapter: Math.round(totalWords / chapters), totalWords: totalWords, wpp: trim.wpp };
  }

  function sourceText(p) {
    var parts = (p.sections || []).filter(function (s) { return (s.text || '').trim(); }).map(function (s, i) {
      return '### קטע ' + (i + 1) + (s.title ? ' — ' + s.title : '') + '\n' + s.text.trim();
    });
    return parts.join('\n\n') || '(לא נמסר חומר גלם. כתבו לפי פרטי הספר בלבד.)';
  }

  function bookCard(p) {
    var g = GENRES[p.genre] || GENRES.memoir;
    var lines = [
      'שם הספר: ' + (p.title || '(טרם נקבע)'),
      p.subtitle ? 'כותרת משנה: ' + p.subtitle : '',
      'מחבר/ת: ' + (p.author || '(לא צוין)'),
      'סוגה: ' + g.label,
      'קול מספר: ' + (p.voice === 'third' ? 'גוף שלישי' : 'גוף ראשון'),
      isKids(p) ? 'גיל הקוראים: ' + (p.kidsAge || '4–7') : '',
      'משלב לשוני: ' + ({ high: 'גבוה, ספרותי ועשיר', mid: 'ספרותי אך נגיש', simple: 'פשוט וזורם' }[p.register || 'high']),
      p.notes ? 'הנחיות מיוחדות מהמחבר: ' + p.notes : ''
    ];
    return lines.filter(Boolean).join('\n');
  }

  function system(p) {
    var g = GENRES[p.genre] || GENRES.memoir;
    return [
      'אתה סופר ועורך ספרותי בכיר בעברית, בעל ניסיון של עשרות שנים בהוצאה לאור. תפקידך להפוך את החומר שהמחבר מוסר — זיכרונות, רשימות, תיאורים גולמיים — לספר קריאה מקצועי, מלוטש ומרגש.',
      '',
      'סגנון הספר: ' + g.voice,
      '',
      'עקרונות כתיבה:',
      '- עברית תקנית, עשירה ומהודרת; אוצר מילים גבוה ומגוון, תחביר מגוון ומוזיקלי, בלי מליצות ריקות ובלי חזרות.',
      '- להראות ולא רק לספר: סצנות, פרטים חושיים, דיאלוג כשמתאים, והרהור שמעניק משמעות.',
      '- מבנה ספרותי: פתיחה שתופסת, התפתחות, וסגירה שמעוררת רצון להמשיך.',
      '- לשמור על קול אחיד ועקבי לאורך כל הספר ועל רצף עם הפרקים הקודמים.',
      g.factual ? '- זהו ספר על חיים אמיתיים: אין להמציא עובדות, אנשים או אירועים. כשהחומר דל, להעמיק ברגש, בהקשר ובהרהור — לא בהמצאה.' : '- מותר להרחיב, להעשיר ולבנות עלילה סביב החומר, בנאמנות לרוחו ולפרטים שנמסרו.',
      '',
      'פורמט הפלט: טקסט נקי בלבד, בלי Markdown, בלי כוכביות להדגשה, בלי כותרות ובלי הערות לעורך. פסקה בכל שורה, שורה ריקה בין פסקאות. מעבר סצנה מסומן בשורה שבה רק: * * *'
    ].join('\n');
  }

  var OUTLINE_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['title_suggestion', 'blurb', 'chapters'],
    properties: {
      title_suggestion: { type: 'string' },
      blurb: { type: 'string' },
      chapters: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'summary', 'target_words', 'source_notes', 'illustration_idea'],
          properties: {
            title: { type: 'string' },
            summary: { type: 'string' },
            target_words: { type: 'integer' },
            source_notes: { type: 'string' },
            illustration_idea: { type: 'string' }
          }
        }
      }
    }
  };

  function outlineRequest(p) {
    var pl = plan(p);
    var unit = pl.kids ? 'עמודים (כל עמוד = סצנה מאוירת אחת)' : 'פרקים';
    var instruction = [
      'משימה: תכנן את מבנה הספר.',
      '',
      bookCard(p),
      '',
      'יעד: ספר של כ-' + p.targetPages + ' עמודים, כלומר כ-' + pl.totalWords + ' מילים של טקסט, ב-' + pl.chapters + ' ' + unit + ' (אפשר לסטות מעט אם הסיפור מחייב).',
      pl.kids
        ? 'לכל עמוד: title = כותרת קצרה פנימית, summary = מה קורה בעמוד, target_words = ' + pl.wordsPerChapter + ' לערך, illustration_idea = תיאור מדויק של האיור לעמוד (דמויות, פעולה, רקע, צבעים).'
        : 'לכל פרק: title = שם פרק ספרותי ומעורר סקרנות, summary = 3–5 משפטים על תוכן הפרק וקשת הרגש שלו, target_words = אורך יעד במילים, source_notes = אילו קטעים מחומר הגלם משמשים בו, illustration_idea = הצעה לאיור או לתמונה שתלווה את הפרק.',
      'title_suggestion = הצעה לשם ספר מהודר (גם אם כבר נבחר שם). blurb = טקסט כריכה אחורית של 80–120 מילים.',
      'השתמש בכל חומר הגלם, בסדר שמשרת את הסיפור. כל הטקסטים בעברית.'
    ].join('\n');
    return {
      task: 'outline', system: system(p),
      cached: 'חומר הגלם של המחבר:\n\n' + sourceText(p),
      instruction: instruction, schema: OUTLINE_SCHEMA, maxTokens: 16000, effort: 'high'
    };
  }

  function outlineText(p) {
    return (p.chapters || []).map(function (c, i) {
      return (i + 1) + '. ' + c.title + ' — ' + (c.summary || '') + (c.targetWords ? ' (' + c.targetWords + ' מילים)' : '');
    }).join('\n');
  }

  function tail(text, words) {
    var w = String(text || '').trim().split(/\s+/);
    return w.slice(Math.max(0, w.length - words)).join(' ');
  }

  function chapterRequest(p, index, opts) {
    opts = opts || {};
    var c = p.chapters[index];
    var prev = index > 0 ? p.chapters[index - 1] : null;
    var kids = isKids(p);
    var cached = [
      'כרטיס הספר:\n' + bookCard(p),
      'מבנה הספר המלא:\n' + outlineText(p),
      'חומר הגלם של המחבר:\n\n' + sourceText(p)
    ].join('\n\n');
    var lines = [];
    if (opts.mode === 'continue') {
      lines.push('משימה: המשך את ' + (kids ? 'העמוד' : 'הפרק') + ' "' + c.title + '" בדיוק מהנקודה שבה נעצר, בלי לחזור על מה שכבר נכתב.');
      lines.push('כך מסתיים הטקסט עד כה:\n«' + tail(c.text, 350) + '»');
      var left = Math.max(300, (c.targetWords || 3000) - wordsCount(c.text));
      lines.push('נותרו כ-' + left + ' מילים עד סוף הפרק. סיים את הפרק בסגירה ספרותית.');
    } else if (opts.mode === 'rewrite') {
      lines.push('משימה: שכתב את ' + (kids ? 'העמוד' : 'הפרק') + ' "' + c.title + '" לפי ההערה הבאה של המחבר, ושמור על כל מה שטוב בגרסה הקיימת.');
      lines.push('הערת המחבר: ' + (opts.note || 'שפר את הניסוח ואת הזרימה.'));
      lines.push('הגרסה הקיימת:\n' + c.text);
    } else {
      lines.push('משימה: כתוב את ' + (kids ? 'עמוד ' : 'פרק ') + (index + 1) + ' מתוך ' + p.chapters.length + ': "' + c.title + '".');
    }
    lines.push('תוכן: ' + (c.summary || ''));
    if (c.sourceNotes) lines.push('מקורות בחומר הגלם: ' + c.sourceNotes);
    if (opts.mode !== 'continue') {
      lines.push('אורך יעד: כ-' + (c.targetWords || plan(p).wordsPerChapter) + ' מילים.');
      if (prev && prev.text && !kids) lines.push('כך הסתיים הפרק הקודם ("' + prev.title + '"), כדי לשמור על רצף:\n«' + tail(prev.text, 180) + '»');
    }
    if (kids) lines.push('כתוב רק את הטקסט שיופיע בעמוד, קצר וקצבי, שמתאים לאיור: ' + (c.illustrationIdea || ''));
    else lines.push('אל תכתוב את שם הפרק או את מספרו — רק את גוף הטקסט.');
    var target = c.targetWords || plan(p).wordsPerChapter;
    return {
      task: 'chapter', system: system(p), cached: cached, instruction: lines.join('\n\n'),
      // טקסט עברי + חשיבה: מרווח נדיב כדי שהפרק לא ייקטע באמצע.
      maxTokens: Math.min(64000, Math.round(target * 8) + 12000), effort: 'high'
    };
  }

  function illustrationRequest(p, description) {
    var kids = isKids(p);
    var style = kids
      ? 'איור ילדים מקצועי: צורות רכות ומעוגלות, פלטה חמה והרמונית של 6–8 גוונים, דמויות חביבות עם הבעות ברורות, רקע מלא ועשיר, מראה של צבעי מים או גואש (באמצעות שכבות שקופות ומעברי צבע עדינים).'
      : 'איור ספרותי אלגנטי בסגנון חיתוך עץ / תחריט מודרני: קווים נקיים, פלטה מאופקת של 3–5 גוונים (דיו כהה, שנהב, זהב עמום ועוד גוון אחד), קומפוזיציה מאוזנת ומרחב נשימה.';
    return {
      task: 'illustration',
      system: 'אתה מאייר ספרים מקצועי שמצייר ב-SVG. אתה מחזיר אך ורק קוד SVG תקין אחד, בלי הסברים ובלי Markdown.',
      cached: 'כרטיס הספר:\n' + bookCard(p),
      instruction: [
        'צייר איור לספר.',
        'מה צריך להופיע: ' + description,
        'סגנון: ' + style,
        'דרישות טכניות: אלמנט <svg> יחיד עם viewBox="0 0 1200 900" ו-xmlns, בלי טקסט ובלי אותיות בתוך האיור, בלי <script>, בלי קישורים חיצוניים ובלי תמונות מוטמעות. השתמש ב-path, צורות, gradients ו-filters. הקפד על עומק, תאורה ופרטים — שיראה כמו איור מקצועי בספר מודפס.'
      ].join('\n'),
      maxTokens: 32000, effort: 'medium'
    };
  }

  function build(task, p, extra) {
    extra = extra || {};
    if (task === 'outline') return outlineRequest(p);
    if (task === 'chapter') return chapterRequest(p, extra.index, extra);
    if (task === 'illustration') return illustrationRequest(p, extra.description || '');
    throw new Error('Unknown task: ' + task);
  }

  /* הנחיה אחת לשליחה ידנית ל-Claude (מצב העתק-הדבק). */
  function manualText(req) {
    var out = [req.system, '', '---', req.cached, '', '---', req.instruction];
    if (req.schema) {
      out.push('', 'החזר JSON תקין בלבד (בלי טקסט נוסף) במבנה הבא:');
      out.push('{"title_suggestion": "...", "blurb": "...", "chapters": [{"title": "...", "summary": "...", "target_words": 3000, "source_notes": "...", "illustration_idea": "..."}]}');
    }
    return out.join('\n');
  }

  return {
    GENRES: GENRES, TRIMS: TRIMS, LENGTHS: LENGTHS,
    wordsCount: wordsCount, plan: plan, isKids: isKids,
    build: build, manualText: manualText
  };
});
