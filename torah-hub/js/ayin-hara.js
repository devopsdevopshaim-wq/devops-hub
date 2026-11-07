/* עין הרע וחלומות: מקורות, הסרה ושמירה, פותר חלומות לפי מסכת ברכות, הטבת חלום ושאלות.
   הטקסטים המקוריים נטענים מספריא דרך /api/torah/text (hub/runtime.js). ה־AI רשות: בלעדיו הפתרון נעשה מהמילון שכאן. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (x) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x]; }); }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem('ah:' + k) || 'null'); localStorage.setItem('ah:' + k, JSON.stringify(v)); } catch (e) { return null; } }
  function toast(msg, err) {
    var t = $('toast'); if (!t) return;
    t.textContent = msg; t.className = 'toast show' + (err ? ' error' : '');
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.className = 'toast'; }, 2600);
  }
  // כפתור שפותח מקור בחלון: refs הוא מקור אחד או כמה, find מדגיש את השורות שמכילות את המילה
  function srcBtn(label, refs, find) {
    return '<button class="ah-src" data-refs="' + esc([].concat(refs).join('|')) + '"' + (find ? ' data-find="' + esc(find) + '"' : '') + '>📖 ' + esc(label) + '</button>';
  }

  // ------------------------------------------------------------------ מקורות על עין הרע
  var SOURCES = [
    { group: 'תורה, נביאים וכתובים', items: [
      { t: 'בן פורת יוסף בן פורת עלי עין', ref: 'Genesis 49:22', label: 'בראשית מט, כב',
        d: 'ברכת יעקב ליוסף. חז״ל דרשו: ״עלי עין״ — עולי עין, שעין הרע אינה שולטת בזרעו של יוסף (ברכות כ ע״א).' },
      { t: 'וידגו לרב בקרב הארץ', ref: 'Genesis 48:16', label: 'בראשית מח, טז',
        d: '״המלאך הגואל אותי מכל רע״. חז״ל: כדגים שהמים מכסים עליהם ואין עין הרע שולטת בהם (ברכות נה ע״ב). פסוק שנוהגים לומר לשמירה.' },
      { t: 'טוב עין הוא יבורך', ref: 'Proverbs 22:9', label: 'משלי כב, ט',
        d: 'מי שמסתכל על האחר בעין טובה — מתברך. זה היסוד: התרופה לעין רעה היא עין טובה.' },
      { t: 'אל תלחם את לחם רע עין', ref: 'Proverbs 23:6', label: 'משלי כג, ו',
        d: 'אזהרה מפני מי שעינו צרה בזולתו.' },
      { t: 'ורעה עינך באחיך האביון', ref: 'Deuteronomy 15:9', label: 'דברים טו, ט',
        d: 'עין רעה בתורה היא קודם כול צרות עין: קמצנות וקנאה כלפי האחר.' },
      { t: 'וישא בלעם את עיניו', ref: 'Rashi on Numbers 24:2', label: 'רש״י במדבר כד, ב',
        d: 'רש״י: ״ביקש להכניס בהם עין רעה״ — וראה שאהליהם אינם מכוונים זה מול זה, ונהפכה הקללה לברכה.' },
    ] },
    { group: 'רש״י על התורה', items: [
      { t: 'כי תשא את ראש בני ישראל', ref: 'Rashi on Exodus 30:12', label: 'רש״י שמות ל, יב',
        d: '״שהמנין שולט בו עין הרע״ — ולכן סופרים את ישראל במחצית השקל ולא לפי הגולגולת. מכאן המנהג שלא למנות אנשים במספר.' },
      { t: 'ויבואו בני ישראל לשבור בתוך הבאים', ref: 'Rashi on Genesis 42:5', label: 'רש״י בראשית מב, ה',
        d: 'יעקב ציווה את בניו שלא ייכנסו כולם בפתח אחד, שלא תשלוט בהם עין הרע.' },
      { t: 'ואיש לא יעלה עמך', ref: 'Rashi on Exodus 34:3', label: 'רש״י שמות לד, ג',
        d: 'הלוחות הראשונים ניתנו בפומבי ובקולות — ושלטה בהן עין רעה. ״אין לך יפה מן הצניעות״.' },
    ] },
    { group: 'משנה ותלמוד', items: [
      { t: 'עין הרע מוציאין את האדם מן העולם', ref: 'Pirkei Avot 2:11', label: 'אבות ב, יא',
        d: '״עין הרע ויצר הרע ושנאת הבריות מוציאין את האדם מן העולם״. רוב המפרשים: עין הרע כאן היא צרות העין של האדם עצמו.' },
      { t: 'תלמידיו של אברהם אבינו — עין טובה', ref: 'Pirkei Avot 5:19', label: 'אבות ה, יט',
        d: '״עין טובה ורוח נמוכה ונפש שפלה — מתלמידיו של אברהם אבינו״.' },
      { t: 'אנא מזרעא דיוסף קאתינא', ref: 'Berakhot 20a', label: 'ברכות כ ע״א',
        d: 'רבי יוחנן: ״אנא מזרעא דיוסף קאתינא, דלא שלטא ביה עינא בישא״ — ומביא את ״בן פורת יוסף״.' },
      { t: 'הדרך לשמירה מעין הרע', ref: 'Berakhot 55b', label: 'ברכות נה ע״ב',
        d: 'הגמרא מלמדת מה יעשה מי שנכנס לעיר וחושש מעין הרע, ומה יעשה מי שחושש מעינו שלו. הנוסח המלא בלשונית ״הסרה ושמירה״.' },
      { t: 'תשעים ותשעה בעין רעה', ref: 'Bava Metzia 107b', label: 'בבא מציעא קז ע״ב',
        d: 'רב אמר שרוב המתים מתים בעין רעה. מכאן שחז״ל ראו בעין הרע כוח ממשי.' },
      { t: 'היזק ראייה', ref: 'Bava Batra 2b', label: 'בבא בתרא ב ע״ב',
        d: 'אסור לאדם לעמוד בשדה חברו כשהיא עומדת בקמותיה — מכאן גם דיני ״היזק ראייה״ בין שכנים.' },
      { t: 'מאן דקפיד — קפדי בהדיה', ref: 'Pesachim 110b', label: 'פסחים קי ע״ב',
        d: '״כל דקפיד — קפדי בהדיה, ודלא קפיד — לא קפדי בהדיה״. פוסקים רבים למדו מכאן גם על עין הרע: מי שאינו מתעסק בה ואינו חושש, פחות שולטת בו.' },
      { t: 'שיר של פגעים', ref: 'Shevuot 15b', label: 'שבועות טו ע״ב',
        d: 'תהילים צא (״יושב בסתר עליון״) נקרא ״שיר של פגעים״ — מזמור לשמירה מכל נזק.' },
    ] },
    { group: 'הלכה', items: [
      { t: 'שני אחים לא יעלו לתורה זה אחר זה', ref: 'Shulchan Arukh, Orach Chayim 141:6', label: 'שולחן ערוך או״ח קמא, ו',
        d: 'אין קוראים לתורה שני אחים, או אב ובנו, זה אחר זה — משום עין הרע.' },
    ] }
  ];

  function renderSources() {
    $('pane-sources').innerHTML =
      '<div class="ah-intro"><h2>מהי עין הרע?</h2>' +
      '<p>בתורה ובנביאים ״עין רעה״ היא קודם כול <b>מידה</b>: צרות עין, קנאה, חוסר שמחה בטוב של האחר. חז״ל הוסיפו שלמבט כזה יש גם <b>כוח</b> — הוא יכול להזיק למי שמסתכלים עליו, בעיקר כשמתהדרים ומפרסמים. ומכאן שתי הדרכים שחוזרות בכל המקורות: <b>לא לעורר</b> אותה (צניעות, לא להתפאר, לא למנות), ו<b>לא להיות</b> בעל עין רעה (עין טובה, שמחה בחלקו).</p></div>' +
      SOURCES.map(function (g) {
        return '<h3 class="ah-group">' + esc(g.group) + '</h3><div class="ah-grid">' + g.items.map(function (s) {
          return '<article class="ah-card"><h4>' + esc(s.t) + '</h4><p>' + esc(s.d) + '</p>' + srcBtn(s.label, s.ref) + '</article>';
        }).join('') + '</div>';
      }).join('');
  }

  // ------------------------------------------------------------------ הסרה ושמירה
  var STEPS = [
    { id: 'ayin-tova', t: 'עין טובה', src: ['אבות ה, יט', 'Pirkei Avot 5:19'],
      d: 'השמירה הראשונה היא במידות: לשמוח בהצלחת אחרים, לברך ולא לקנא. מי שעינו טובה — ״טוב עין הוא יבורך״ (משלי כב, ט).' },
    { id: 'tzniut', t: 'צניעות ולא להתפאר', src: ['רש״י שמות לד, ג', 'Rashi on Exodus 34:3'],
      d: 'לא לפרסם הצלחות, רכוש ושמחות בראש חוצות; לא למנות אנשים במספר (רש״י שמות ל, יב). ״אין לך יפה מן הצניעות״.' },
    { id: 'segula', t: 'האמירה מהגמרא', src: ['ברכות נה ע״ב', 'Berakhot 55b'], formula: true,
      d: 'אוחזים את אגודל יד ימין ביד שמאל ואת אגודל יד שמאל ביד ימין, ואומרים את הנוסח שלמטה (עם השם שלכם).' },
    { id: 'psukim', t: 'פסוקי שמירה', src: ['תהילים צא', 'Psalms 91'], verses: true,
      d: 'נוהגים לומר ״המלאך הגואל״, ״בן פורת יוסף״, ברכת כהנים, ואת תהילים צא (״שיר של פגעים״) וקכא (״שיר למעלות, אשא עיני״).' },
    { id: 'tzedaka', t: 'צדקה', src: ['משלי י, ב', 'Proverbs 10:2'],
      d: '״וצדקה תציל ממות״. נוהגים לתת צדקה לפני בקשת שמירה או רפואה.' },
    { id: 'tefila', t: 'תפילה ותשובה', src: ['ברכות נה ע״ב', 'Berakhot 55b'],
      d: 'בקשה אישית בתפילת שמונה עשרה (ב״שומע תפילה״) ובברכת כהנים. עין הרע אינה ״גזרה״ — תפילה ותשובה פועלות עליה.' },
    { id: 'lo-lehitasek', t: 'לא להיתפס לפחד', src: ['פסחים קי ע״ב', 'Pesachim 110b'],
      d: '״דלא קפיד — לא קפדי בהדיה״. אחרי שעשיתם מה שהמקורות מלמדים, לא להתעסק בזה כל הזמן. הדאגה עצמה מזיקה יותר.' }
  ];
  var VERSES = [
    { t: 'המלאך הגואל', ref: 'Genesis 48:16', label: 'בראשית מח, טז' },
    { t: 'בן פורת יוסף', ref: 'Genesis 49:22', label: 'בראשית מט, כב' },
    { t: 'ברכת כהנים', ref: 'Numbers 6:24-26', label: 'במדבר ו, כד–כו' },
    { t: 'יושב בסתר עליון', ref: 'Psalms 91', label: 'תהילים צא' },
    { t: 'אשא עיני אל ההרים', ref: 'Psalms 121', label: 'תהילים קכא' }
  ];
  function formulaText(name, parent) {
    var who = (name || 'פלוני') + ' ' + (parent ? 'בר ' + parent : 'בר פלוני');
    return 'אנא ' + who + ' מזרעא דיוסף קאתינא, דלא שלטא ביה עינא בישא, שנאמר: ״בן פורת יוסף, בן פורת עלי עין״ — אל תקרי ״עלי עין״ אלא ״עולי עין״.';
  }
  function renderProtect() {
    var done = store('done') || {}, me = store('me') || {};
    var n = STEPS.filter(function (s) { return done[s.id]; }).length;
    $('pane-protect').innerHTML =
      '<div class="ah-intro"><h2>סדר הסרה ושמירה</h2><p>הסדר בנוי מהמקורות עצמם. אפשר לסמן מה עשיתם — הסימון נשמר רק בדפדפן שלכם.</p>' +
      '<div class="ah-progress"><span style="width:' + Math.round(n / STEPS.length * 100) + '%"></span></div><small>' + n + ' מתוך ' + STEPS.length + '</small></div>' +
      '<ol class="ah-steps">' + STEPS.map(function (s, i) {
        var extra = '';
        if (s.formula) {
          extra = '<div class="ah-formula-box"><div class="ah-row">' +
            '<label>השם שלך<input id="ah-name" value="' + esc(me.name || '') + '" placeholder="למשל: חיים"></label>' +
            '<label>שם האב <small>(בגמרא: ״בר פלוני״)</small><input id="ah-parent" value="' + esc(me.parent || '') + '" placeholder="למשל: אברהם"></label></div>' +
            '<blockquote class="ah-formula" id="ah-formula">' + esc(formulaText(me.name, me.parent)) + '</blockquote>' +
            '<p class="ah-small">ומי שחושש מעינו שלו (שלא יזיק לאחרים) — יסתכל בכנף אפו השמאלית (ברכות נה ע״ב).</p>' +
            '<div class="ah-row"><button class="btn ghost" id="ah-copy">העתקה</button><button class="btn ghost" id="ah-print">הדפסת כרטיס</button></div></div>';
        }
        if (s.verses) extra = '<div class="ah-chips">' + VERSES.map(function (v) { return srcBtn(v.t + ' · ' + v.label, v.ref); }).join('') + '</div>';
        return '<li class="ah-step' + (done[s.id] ? ' done' : '') + '"><label class="ah-check"><input type="checkbox" data-step="' + s.id + '"' + (done[s.id] ? ' checked' : '') + '><span>' + (i + 1) + '</span></label>' +
          '<div><h4>' + esc(s.t) + '</h4><p>' + esc(s.d) + '</p>' + extra + srcBtn(s.src[0], s.src[1]) + '</div></li>';
      }).join('') + '</ol>' +
      '<div class="ah-custom"><h3>מנהגי עדות להסרת עין הרע</h3>' +
      '<p>בקהילות רבות נהגו ב״הסרת עין הרע״ על ידי אדם ירא שמיים (בעופרת, בשמן במים, בלחש של פסוקים ועוד). אלה <b>מנהגים</b>, לא דין מהגמרא, ויש פוסקים שהסתייגו מחלקם (למשל מחוט אדום, שבתוספתא שבת נמנה בין ״דרכי האמורי״). מי שרוצה לנהוג כך — ישאל את רב הקהילה שלו, ויקפיד שהדבר ייעשה בפסוקים ובתפילה ולא בכישוף, ושלא ייקח על כך תשלום מופרז.</p></div>';

    $('pane-protect').querySelectorAll('input[data-step]').forEach(function (c) {
      c.addEventListener('change', function () { var d = store('done') || {}; d[c.dataset.step] = c.checked; store('done', d); renderProtect(); });
    });
    var upd = function () {
      var m = { name: $('ah-name').value.trim(), parent: $('ah-parent').value.trim() };
      store('me', m); $('ah-formula').textContent = formulaText(m.name, m.parent);
    };
    $('ah-name').addEventListener('input', upd); $('ah-parent').addEventListener('input', upd);
    $('ah-copy').addEventListener('click', function () {
      var t = $('ah-formula').textContent;
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('הנוסח הועתק'); }, function () { toast('לא הצלחתי להעתיק', true); });
    });
    $('ah-print').addEventListener('click', function () { printCard('שמירה מעין הרע · ברכות נה ע״ב', $('ah-formula').textContent); });
  }
  function printCard(title, text) {
    var w = window.open('', '_blank');
    if (!w) { toast('הדפדפן חסם חלון חדש', true); return; }
    w.document.write('<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><title>' + esc(title) + '</title>' +
      '<style>body{font-family:"Frank Ruhl Libre",David,serif;max-width:560px;margin:40px auto;padding:28px;border:3px double #8a6a22;border-radius:14px;text-align:center;line-height:1.9;font-size:22px}h1{font-size:20px;color:#8a6a22}</style>' +
      '<h1>' + esc(title) + '</h1><p>' + esc(text).replace(/\n/g, '<br>') + '</p><script>print()<\/script></html>');
    w.document.close();
  }

  // ------------------------------------------------------------------ פותר חלומות (ברכות נה–נז)
  // k: מילים לחיפוש, find: איך המילה כתובה בגמרא (להדגשה), tone: good / mixed / bad
  var DAF = ['Berakhot 56b', 'Berakhot 57a', 'Berakhot 57b'];
  var SYMBOLS = [
    { n: 'באר', k: ['באר', 'בור מים', 'מעיין'], find: 'באר', tone: 'good', m: 'רואה שלום', v: '״ויחפרו עבדי יצחק בנחל וימצאו שם באר מים חיים״' },
    { n: 'נהר', k: ['נהר', 'נחל', 'זרם'], find: 'נהר', tone: 'good', m: 'רואה שלום', v: '״הנני נוטה אליה כנהר שלום״ (ישעיהו סו)' },
    { n: 'ציפור', k: ['ציפור', 'צפור', 'ציפורים', 'יונה', 'עוף'], find: 'צפור', tone: 'good', m: 'רואה שלום', v: '״כצפרים עפות כן יגן ה׳ צבאות״ (ישעיהו לא)' },
    { n: 'קדרה / סיר', k: ['קדרה', 'קדירה', 'סיר', 'בישול'], find: 'קדרה', tone: 'good', m: 'רואה שלום', v: '״ה׳ תשפות שלום לנו״ (ישעיהו כו)' },
    { n: 'קנה', k: ['קנה', 'קנים', 'סוף'], find: 'קנה', tone: 'good', m: 'יצפה לחכמה', v: '״קנה חכמה״ (משלי ד)' },
    { n: 'חמור', k: ['חמור', 'חמורים'], find: 'חמור', tone: 'good', m: 'יצפה לישועה', v: '״הנה מלכך יבוא לך... עני ורוכב על חמור״ (זכריה ט)' },
    { n: 'גמל', k: ['גמל', 'גמלים'], find: 'גמל', tone: 'mixed', m: 'נגזרה עליו גזרה מן השמים — וניצל ממנה', v: '' },
    { n: 'פיל', k: ['פיל', 'פילים'], find: 'פיל', tone: 'mixed', m: 'פלאות נעשו לו. ובמקום אחר: כל מיני חיה יפים לחלום חוץ מפיל, קוף וקיפוד — והגמרא מיישבת שתלוי אם הפיל מסורג (רתום) או לא', v: '' },
    { n: 'נחש', k: ['נחש', 'נחשים'], find: 'נחש', tone: 'mixed', m: 'פרנסתו מזומנת לו; נשכו — נכפלה לו; הרגו — אבדה פרנסתו (ויש שפירשו: תוכפל)', v: '' },
    { n: 'חיטים', k: ['חיטה', 'חיטים', 'חטים', 'שדה חיטה'], find: 'חטים', tone: 'good', m: 'ראה שלום', v: '״השם גבולך שלום, חלב חטים ישביעך״ (תהילים קמז)' },
    { n: 'שעורים', k: ['שעורה', 'שעורים'], find: 'שעורים', tone: 'good', m: 'סרו עוונותיו', v: '״וסר עונך וחטאתך תכפר״ (ישעיהו ו)' },
    { n: 'גפן', k: ['גפן', 'כרם'], find: 'גפן', tone: 'good', m: 'גפן טעונה — אין אשתו מפלת; שורק — יצפה למשיח', v: '' },
    { n: 'ענבים', k: ['ענבים', 'ענב', 'אשכול'], find: 'ענבים', tone: 'mixed', m: 'לבנים — סימן יפה תמיד; שחורים — בעונתם יפה, שלא בעונתם רע', v: '' },
    { n: 'תאנה', k: ['תאנה', 'תאנים', 'תאנת'], find: 'תאנה', tone: 'good', m: 'תורתו משתמרת בתוכו', v: '״נוצר תאנה יאכל פריה״ (משלי כז)' },
    { n: 'רימון', k: ['רימון', 'רימונים', 'רמון'], find: 'רמונים', tone: 'good', m: 'קטנים — פרים עסקיו כרימון; גדולים — ירבו עסקיו; ולתלמיד חכם — יצפה לתורה', v: '' },
    { n: 'זית', k: ['זית', 'זיתים', 'שמן זית'], find: 'זית', tone: 'good', m: 'שם טוב יוצא לו; זיתים — פרייה ורבייה, ריבוי עסקים', v: '״זית רענן יפה פרי תאר קרא ה׳ שמך״ (ירמיהו יא)' },
    { n: 'תמרים', k: ['תמר', 'תמרים', 'דקל'], find: 'תמרים', tone: 'good', m: 'תמו עוונותיו', v: '״תם עונך בת ציון״ (איכה ד)' },
    { n: 'אתרוג', k: ['אתרוג'], find: 'אתרוג', tone: 'good', m: 'הדור הוא לפני קונו', v: '' },
    { n: 'לולב', k: ['לולב'], find: 'לולב', tone: 'good', m: 'אין לו אלא לב אחד לאביו שבשמים', v: '' },
    { n: 'ביצים', k: ['ביצה', 'ביצים'], find: 'ביצים', tone: 'mixed', m: 'בקשתו תלויה; נשברו — נעשתה בקשתו', v: '' },
    { n: 'תפילין', k: ['תפילין', 'תפלין'], find: 'תפלין', tone: 'good', m: 'יצפה לגדולה', v: '״וראו כל עמי הארץ כי שם ה׳ נקרא עליך״ (דברים כח)' },
    { n: 'תפילה', k: ['מתפלל', 'תפילה', 'בית כנסת'], find: 'המתפלל', tone: 'good', m: 'סימן יפה — והוא שלא גמר את התפילה', v: '' },
    { n: 'יין', k: ['יין', 'שתיית יין', 'משקה'], find: 'יין', tone: 'mixed', m: 'כל המשקים יפים לחלום חוץ מיין: יש ששותהו וטוב לו ויש ששותהו ורע לו; לתלמיד חכם — טוב', v: '' },
    { n: 'צבעים', k: ['צבע', 'צבעים', 'כחול', 'תכלת'], find: 'צבעונין', tone: 'mixed', m: 'כל מיני צבעונים יפים לחלום חוץ מתכלת', v: '' },
    { n: 'פירות וירקות', k: ['פרי', 'פירות', 'ירק', 'ירקות', 'לפת'], find: 'פירות', tone: 'good', m: 'כל מיני פירות יפים לחלום חוץ מפגי תמרה (תמרים בוסר); כל מיני ירקות יפים חוץ מראשי לפתות', v: '' },
    { n: 'אגם / יער', k: ['אגם', 'יער'], find: 'לאגם', tone: 'good', m: 'נכנס לאגם — נעשה ראש ישיבה; ליער — נעשה ראש לבני כלה', v: '' },
    { n: 'ספרי קודש', k: ['ספר', 'תהילים', 'משלי', 'איוב', 'שיר השירים', 'קהלת', 'איכה', 'מגילה', 'אסתר', 'ישעיהו', 'ירמיהו', 'יחזקאל', 'מלכים'], find: 'הרואה ספר', tone: 'mixed',
      m: 'תהילים — יצפה לחסידות; משלי — לחכמה; איוב — ידאג מפורענות; שיר השירים — חסידות; קהלת — חכמה; איכה — פורענות; מגילת אסתר — נס נעשה לו; מלכים — גדולה; יחזקאל — חכמה; ישעיהו — נחמה; ירמיהו — פורענות', v: '' },
    { n: 'מת', k: ['מת', 'נפטר', 'אבא שנפטר', 'אמא שנפטרה', 'סבא', 'סבתא', 'מתים'], find: 'מת', tone: 'mixed',
      m: 'בגמרא: מה שהמת נותן — לרוב סימן טוב, ומה שהוא נוטל — לרוב סימן רע (בפרטים). ובכלל: חלום על נפטר קרוב הוא לרוב הרהור הלב והגעגוע, ואין לפחד ממנו', v: '' }
  ];
  var PRINCIPLES = [
    { t: '״כל החלומות הולכים אחר הפה״', s: 'ברכות נה ע״ב', ref: 'Berakhot 55b', d: 'הפתרון משפיע על החלום. לכן מספרים חלום רק לאוהב, ופותרים אותו לטובה.' },
    { t: '״אין מראין לו לאדם אלא מהרהורי לבו״', s: 'ברכות נה ע״ב', ref: 'Berakhot 55b', d: 'רוב החלומות הם מחשבות היום. לא כל חלום הוא מסר.' },
    { t: '״אי אפשר לחלום בלא דברים בטלים״', s: 'ברכות נה ע״א', ref: 'Berakhot 55a', d: 'כמו שאין בר בלי תבן — גם חלום שמתקיים, חלקו לא מתקיים.' },
    { t: '״חלמא דלא מפשר — כאגרתא דלא מקריא״', s: 'ברכות נה ע״א', ref: 'Berakhot 55a', d: 'חלום שלא נפתר הוא כמכתב שלא נקרא: מי שלא מתעסק בו — אין לו השפעה.' },
    { t: '״חלום — אחד משישים לנבואה״', s: 'ברכות נז ע״ב', ref: 'Berakhot 57b', d: 'יש בחלום ממד אמיתי, אבל קטן מאוד.' },
    { t: 'שלושה חלומות מתקיימים', s: 'ברכות נה ע״ב', ref: 'Berakhot 55b', d: 'חלום של שחרית, חלום שחלם לו חברו, וחלום שנפתר בתוך חלום. ויש אומרים: גם חלום שחוזר כמה פעמים.' },
    { t: '״השכים ונפל פסוק לתוך פיו — נבואה קטנה״', s: 'ברכות נה ע״ב', ref: 'Berakhot 55b', d: 'פסוק שעולה מיד בקימה — סימן. כדאי לבדוק אותו בספרייה.' },
    { t: 'בתנ״ך: ״בחלום אדבר בו״', s: 'במדבר יב, ו', ref: 'Numbers 12:6', d: 'חלומות יעקב (בראשית כח), יוסף (לז), פרעה (מא), שלמה בגבעון (מלכים א ג) ודניאל (ב).' }
  ];
  function norm(s) { return String(s || '').replace(/[֑-ׇ]/g, '').replace(/[״"׳']/g, '').trim(); }
  function matchDream(text) {
    var w = ' ' + norm(text).replace(/[^א-ת\s]/g, ' ').replace(/\s+/g, ' ') + ' ';
    return SYMBOLS.filter(function (s) {
      return s.k.some(function (k) {
        k = norm(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // מילה שלמה, או עם אות שימוש לפניה (ב, ה, ו, כ, ל, מ, ש)
        return new RegExp('[\\s](?:[בהוכלמש]{0,2})' + k + '(?:ים|ות)?[\\s]').test(w);
      });
    });
  }
  var TONE = { good: 'סימן טוב', mixed: 'תלוי בפרטים', bad: 'צריך הטבה' };
  function symbolCard(s) {
    return '<article class="ah-card ah-sym tone-' + s.tone + '"><div class="ah-sym-head"><h4>' + esc(s.n) + '</h4><span class="ah-tone">' + TONE[s.tone] + '</span></div>' +
      '<p>' + esc(s.m) + '</p>' + (s.v ? '<p class="ah-verse">' + esc(s.v) + '</p>' : '') + srcBtn('ברכות נו–נז', DAF, s.find) + '</article>';
  }
  function renderDreams() {
    var last = store('dream') || '';
    $('pane-dreams').innerHTML =
      '<div class="ah-intro"><h2>פותר חלומות לפי חז״ל</h2><p>כתבו את החלום במילים פשוטות. הפותר מחפש בו את הסימנים שמנויים בגמרא (ברכות נו–נז) ומראה מה נאמר עליהם, עם המקור. ״כל החלומות הולכים אחר הפה״ — לכן הפתרון כאן תמיד לטובה.</p></div>' +
      '<div class="ah-dream-box"><textarea id="ah-dream" rows="5" placeholder="למשל: חלמתי שאני עומד ליד באר, ויונה לבנה עפה מעל…">' + esc(last) + '</textarea>' +
      '<div class="ah-row"><button class="btn primary" id="ah-solve">לפתור לפי המקורות</button><button class="btn ghost" id="ah-ai">פירוש מורחב (AI)</button><button class="btn ghost" id="ah-clear">ניקוי</button></div>' +
      '<label class="ah-small ah-bad"><input type="checkbox" id="ah-heavy"> החלום הטריד אותי / היה קשה</label></div>' +
      '<div id="ah-result"></div>' +
      '<h3 class="ah-group">כללי החלומות בגמרא</h3><div class="ah-grid">' + PRINCIPLES.map(function (p) {
        return '<article class="ah-card"><h4>' + esc(p.t) + '</h4><p>' + esc(p.d) + '</p>' + srcBtn(p.s, p.ref) + '</article>';
      }).join('') + '</div>' +
      '<h3 class="ah-group">מילון הסימנים</h3><input class="ah-filter" id="ah-filter" placeholder="סינון: באר, נחש, ענבים…"><div class="ah-grid" id="ah-dict">' + SYMBOLS.map(symbolCard).join('') + '</div>';

    $('ah-solve').addEventListener('click', solve);
    $('ah-ai').addEventListener('click', solveAI);
    $('ah-clear').addEventListener('click', function () { $('ah-dream').value = ''; store('dream', ''); $('ah-result').innerHTML = ''; });
    $('ah-filter').addEventListener('input', function () {
      var q = norm(this.value);
      $('ah-dict').innerHTML = SYMBOLS.filter(function (s) { return !q || norm(s.n + ' ' + s.k.join(' ') + ' ' + s.m).indexOf(q) >= 0; }).map(symbolCard).join('') || '<p class="ah-small">לא נמצא סימן כזה במילון.</p>';
    });
  }
  function heavyAdvice() {
    return '<div class="ah-card ah-advice"><h4>חלום שהטריד — מה עושים?</h4><ol>' +
      '<li>לא לספר אותו למי שעלול לפתור לרעה. ״כל החלומות הולכים אחר הפה״.</li>' +
      '<li><b>הטבת חלום</b> לפני שלושה אוהבים — הנוסח המלא בלשונית ״הטבת חלום״.</li>' +
      '<li>לומר ״רבונו של עולם, אני שלך וחלומותי שלך״ בשעת ברכת כהנים.</li>' +
      '<li>צדקה ותפילה. מי שנוהג — תענית חלום ביום שאחרי החלום (שבת יא ע״א), אחרי שאלת רב.</li>' +
      '<li>אם חלומות קשים חוזרים ופוגעים בשינה — זה גם עניין לרופא או לאיש מקצוע, ואין בזה שום סתירה לאמונה.</li></ol>' +
      '<button class="btn primary" data-go="hatava">לנוסח הטבת חלום ←</button></div>';
  }
  function solve() {
    var text = $('ah-dream').value.trim();
    store('dream', text);
    if (!text) { toast('כתבו קודם את החלום', true); return; }
    var hits = matchDream(text), heavy = $('ah-heavy').checked;
    $('ah-result').innerHTML = '<h3 class="ah-group">מה נמצא בחלום</h3>' +
      (hits.length ? '<div class="ah-grid">' + hits.map(symbolCard).join('') + '</div>'
        : '<div class="ah-card"><p>לא מצאתי בחלום סימן שמפורש בגמרא. זה לא אומר שהחלום רע: ״אין מראין לאדם אלא מהרהורי לבו״, ורוב החלומות הם מחשבות היום. אפשר לנסות ״פירוש מורחב״, או לעיין במילון למטה.</p></div>') +
      (heavy ? heavyAdvice() : '<p class="ah-small">ואם חלמתם טוב — אומרים ״חלמא טבא חזאי״ ומבקשים שיתקיים, כחלומות יוסף.</p>');
    wireGo($('ah-result'));
    $('ah-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function solveAI() {
    var text = $('ah-dream').value.trim();
    store('dream', text);
    if (!text) { toast('כתבו קודם את החלום', true); return; }
    if (!window.HUB || !window.HUB.ask) { solve(); return; }
    var hits = matchDream(text), heavy = $('ah-heavy').checked;
    var out = $('ah-result');
    out.innerHTML = '<div class="ah-card"><p>מעיין במקורות…</p></div>';
    var prompt = 'אתה מלמד תורה שפותר חלומות אך ורק לפי חז״ל: מסכת ברכות נה–נז, פסוקי התנ״ך, והמפרשים המקובלים. ענה בעברית, בחום ובקיצור (עד 220 מילים), בפורמט Markdown.\n' +
      'כללים: ״כל החלומות הולכים אחר הפה״ — פתור לטובה; אל תנבא אסונות ואל תפחיד; ציין מקור (מסכת ודף או ספר פרק ופסוק) לכל סימן; אם אין לסימן מקור — אמור זאת ואל תמציא; ״אין מראין לאדם אלא מהרהורי לבו״. ' +
      (heavy ? 'החולם כתב שהחלום הטריד אותו: הצע הטבת חלום לפני שלושה אוהבים ואמירת ״רבונו של עולם״ בברכת כהנים, והזכר בעדינות שאם חלומות קשים חוזרים כדאי לפנות גם לאיש מקצוע. ' : '') +
      (hits.length ? 'סימנים שזוהו מהגמרא: ' + hits.map(function (s) { return s.n + ' — ' + s.m; }).join('; ') + '. ' : '') +
      'אל תיתן עצה רפואית. סיים בברכה קצרה.\n\nהחלום:\n' + text;
    window.HUB.ask(prompt).then(function (r) {
      out.innerHTML = '<div class="ah-card ah-ai-out"><div class="ah-sym-head"><h4>פירוש מורחב</h4><span class="ah-tone">AI · לבדוק במקורות</span></div>' + (window.HUBMD ? window.HUBMD(r.text) : esc(r.text)) + '</div>' +
        (hits.length ? '<h3 class="ah-group">הסימנים מהגמרא</h3><div class="ah-grid">' + hits.map(symbolCard).join('') + '</div>' : '') + (heavy ? heavyAdvice() : '');
      wireGo(out);
    }, function (e) {
      toast(e.message || 'ה־AI לא ענה', true);
      solve();
    });
  }

  // ------------------------------------------------------------------ הטבת חלום
  var HATAVA = [
    { h: 'החולם אומר שבע פעמים', who: 'החולם', x: 'חֶלְמָא טָבָא חֲזַאי.' },
    { h: 'השלושה עונים שבע פעמים', who: 'השלושה', x: 'טָבָא הוּא וְטָבָא לֶהֱוֵי, רַחֲמָנָא לְשַׁוְּיֵהּ לְטָב. שְׁבַע זִמְנִין לִגְזְרוּ עֲלָךְ מִן שְׁמַיָּא דְּלֶהֱוֵי טָבָא, וְטָבָא לֶהֱוֵי.' },
    { h: 'שלוש ״הפיכות״', who: 'השלושה', x: 'הָפַכְתָּ מִסְפְּדִי לְמָחוֹל לִי, פִּתַּחְתָּ שַׂקִּי וַתְּאַזְּרֵנִי שִׂמְחָה. (תהילים ל, יב)\nאָז תִּשְׂמַח בְּתוּלָה בְּמָחוֹל וּבַחֻרִים וּזְקֵנִים יַחְדָּו, וְהָפַכְתִּי אֶבְלָם לְשָׂשׂוֹן וְנִחַמְתִּים וְשִׂמַּחְתִּים מִיגוֹנָם. (ירמיהו לא, יב)\nוְלֹא אָבָה ה׳ אֱלֹהֶיךָ לִשְׁמֹעַ אֶל בִּלְעָם, וַיַּהֲפֹךְ ה׳ אֱלֹהֶיךָ לְּךָ אֶת הַקְּלָלָה לִבְרָכָה, כִּי אֲהֵבְךָ ה׳ אֱלֹהֶיךָ. (דברים כג, ו)' },
    { h: 'שלוש ״פדיות״', who: 'השלושה', x: 'פָּדָה בְשָׁלוֹם נַפְשִׁי מִקְּרָב לִי, כִּי בְרַבִּים הָיוּ עִמָּדִי. (תהילים נה, יט)\nוּפְדוּיֵי ה׳ יְשֻׁבוּן וּבָאוּ צִיּוֹן בְּרִנָּה, וְשִׂמְחַת עוֹלָם עַל רֹאשָׁם, שָׂשׂוֹן וְשִׂמְחָה יַשִּׂיגוּ, וְנָסוּ יָגוֹן וַאֲנָחָה. (ישעיהו לה, י)\nוַיֹּאמֶר הָעָם אֶל שָׁאוּל: הֲיוֹנָתָן יָמוּת אֲשֶׁר עָשָׂה הַיְשׁוּעָה הַגְּדוֹלָה הַזֹּאת בְּיִשְׂרָאֵל? חָלִילָה! חַי ה׳ אִם יִפֹּל מִשַּׂעֲרַת רֹאשׁוֹ אַרְצָה כִּי עִם אֱלֹהִים עָשָׂה הַיּוֹם הַזֶּה. וַיִּפְדּוּ הָעָם אֶת יוֹנָתָן וְלֹא מֵת. (שמואל א יד, מה)' },
    { h: 'שלושה ״שלומות״', who: 'השלושה', x: 'בּוֹרֵא נִיב שְׂפָתָיִם, שָׁלוֹם שָׁלוֹם לָרָחוֹק וְלַקָּרוֹב אָמַר ה׳, וּרְפָאתִיו. (ישעיהו נז, יט)\nוְרוּחַ לָבְשָׁה אֶת עֲמָשַׂי רֹאשׁ הַשָּׁלִישִׁים: לְךָ דָוִיד וְעִמְּךָ בֶן יִשַׁי, שָׁלוֹם שָׁלוֹם לְךָ וְשָׁלוֹם לְעֹזְרֶךָ, כִּי עֲזָרְךָ אֱלֹהֶיךָ. (דברי הימים א יב, יט)\nוַאֲמַרְתֶּם כֹּה לֶחָי: וְאַתָּה שָׁלוֹם, וּבֵיתְךָ שָׁלוֹם, וְכֹל אֲשֶׁר לְךָ שָׁלוֹם. (שמואל א כה, ו)' }
  ];
  var RIBONO = 'רִבּוֹנוֹ שֶׁל עוֹלָם, אֲנִי שֶׁלָּךְ וַחֲלוֹמוֹתַי שֶׁלָּךְ. חֲלוֹם חָלַמְתִּי וְאֵינִי יוֹדֵעַ מַה הוּא. יְהִי רָצוֹן מִלְּפָנֶיךָ ה׳ אֱלֹהַי וֵאלֹהֵי אֲבוֹתַי, שֶׁיִּהְיוּ כָּל חֲלוֹמוֹתַי עָלַי וְעַל כָּל יִשְׂרָאֵל לְטוֹבָה, בֵּין שֶׁחָלַמְתִּי עַל עַצְמִי, וּבֵין שֶׁחָלַמְתִּי עַל אֲחֵרִים, וּבֵין שֶׁחָלְמוּ אֲחֵרִים עָלַי. אִם טוֹבִים הֵם — חַזְּקֵם וְאַמְּצֵם, וְיִתְקַיְּמוּ בִי וּבָהֶם כַּחֲלוֹמוֹתָיו שֶׁל יוֹסֵף הַצַּדִּיק. וְאִם צְרִיכִים רְפוּאָה — רְפָאֵם כְּמֵי מָרָה עַל יְדֵי מֹשֶׁה רַבֵּנוּ, וּכְמִרְיָם מִצָּרַעְתָּהּ, וּכְנַעֲמָן מִצָּרַעְתּוֹ, וּכְחִזְקִיָּהוּ מֵחָלְיוֹ, וּכְמֵי יְרִיחוֹ עַל יְדֵי אֱלִישָׁע. וּכְשֵׁם שֶׁהָפַכְתָּ אֶת קִלְלַת בִּלְעָם הָרָשָׁע לִבְרָכָה, כֵּן תַּהֲפֹךְ כָּל חֲלוֹמוֹתַי עָלַי וְעַל כָּל יִשְׂרָאֵל לְטוֹבָה, וְתִשְׁמְרֵנִי וּתְחָנֵּנִי וְתִרְצֵנִי. אָמֵן.';
  function renderHatava() {
    $('pane-hatava').innerHTML =
      '<div class="ah-intro"><h2>הטבת חלום</h2><p>מקור הסדר בגמרא (ברכות נה ע״ב): ״הרואה חלום ונפשו עגומה — ילך ויפתרנו בפני שלושה… יביא שלושה ויטיבוהו לו״. עושים זאת ביום שאחרי החלום, בבוקר, לפני שלושה אוהבים (נהוג: לפני עשרה עדיף). ' + srcBtn('ברכות נה ע״ב', 'Berakhot 55b', 'תלתא') + '</p></div>' +
      '<ol class="ah-hatava">' + HATAVA.map(function (h) {
        return '<li><div class="ah-who">' + esc(h.who) + '</div><h4>' + esc(h.h) + '</h4><p class="ah-nusach">' + esc(h.x).replace(/\n/g, '<br>') + '</p></li>';
      }).join('') +
      '<li><div class="ah-who">השלושה</div><h4>ומסיימים</h4><p>״לֵךְ אֱכֹל בְּשִׂמְחָה לַחְמֶךָ וּשְׁתֵה בְלֶב טוֹב יֵינֶךָ, כִּי כְבָר רָצָה הָאֱלֹהִים אֶת מַעֲשֶׂיךָ״ (קהלת ט, ז). ונוהגים לתת צדקה.</p></li></ol>' +
      '<div class="ah-row"><button class="btn ghost" id="ah-print-hatava">הדפסת הסדר</button></div>' +
      '<h3 class="ah-group">״רבונו של עולם״ — בשעת ברכת כהנים</h3>' +
      '<div class="ah-card"><p class="ah-small">הגמרא (ברכות נה ע״ב) מלמדת: מי שראה חלום ואינו יודע מה ראה — יעמוד לפני הכוהנים בשעה שהם פורשים כפיהם ויאמר. זה הנוסח שבסידורים:</p><p class="ah-nusach">' + esc(RIBONO) + '</p>' + srcBtn('ברכות נה ע״ב', 'Berakhot 55b', 'רבונו של עולם') + '</div>' +
      '<h3 class="ah-group">תענית חלום</h3>' +
      '<div class="ah-card"><p>״יפה תענית לחלום כאש לנעורת״ — ובו ביום, ואפילו בשבת (שבת יא ע״א). זה מנהג חמור, ובימינו רוב הפוסקים מורים להסתפק בהטבת חלום ובצדקה. לא להתענות בלי לשאול רב, ובוודאי לא מי שבריאותו אינה מאפשרת.</p>' + srcBtn('שבת יא ע״א', 'Shabbat 11a', 'תענית לחלום') + '</div>';
    $('ah-print-hatava').addEventListener('click', function () {
      printCard('סדר הטבת חלום · ברכות נה ע״ב', HATAVA.map(function (h) { return '【' + h.h + '】\n' + h.x; }).join('\n\n'));
    });
  }

  // ------------------------------------------------------------------ שאלות
  var FAQ = [
    ['האם עין הרע היא דבר אמיתי ביהדות?', 'כן. חז״ל מתייחסים אליה ככוח ממשי (בבא מציעא קז ע״ב; ברכות כ ע״א), וההלכה מתחשבת בה (שולחן ערוך או״ח קמא, ו). אבל באותה נשימה הם מלמדים לא להיבהל ממנה: ״דלא קפיד — לא קפדי בהדיה״ (פסחים קי ע״ב).'],
    ['איך יודעים שיש עליי עין הרע?', 'אין במקורות ״סימנים״ לאבחון עין הרע, ומי שמבטיח לאבחן — נזהר ממנו. כשמשהו קשה קורה, הדרך שהמקורות מלמדים היא תפילה, צדקה, תשובה ומידות טובות, לצד כל טיפול מעשי שצריך (רפואה, ייעוץ). ״ורפא ירפא״ — ניתנה רשות לרופא לרפאות.'],
    ['האם מותר לשלם למי ש״מוריד עין הרע״?', 'מנהגי עדות של הסרת עין הרע קיימים, אבל אין מקור שמחייב אותם. לפני שנוהגים — לשאול רב קהילה. להיזהר ממי שדורש סכומים גדולים, מבטיח הבטחות, או מפחיד.'],
    ['מה עם חוט אדום, חמסה וקמעות?', 'בגמרא (שבת סא) יש דיון על ״קמיע מומחה״. על חוט אדום יש מחלוקת: בתוספתא הוא נמנה בין ״דרכי האמורי״, ויש שנהגו בו. חמסה היא מנהג עממי. כל אלה אינם תחליף לתפילה ולמידות.'],
    ['למה אומרים ״בלי עין הרע״?', 'זה מנהג לשון שנובע מהחשש להתפאר: כשמספרים טוב — מוסיפים ברכה ולא מתגאים. ברוח ״אין לך יפה מן הצניעות״ (רש״י שמות לד, ג).'],
    ['חלמתי חלום רע. לפחד?', 'לא. ״אין מראין לאדם אלא מהרהורי לבו״, ו״חלמא דלא מפשר כאגרתא דלא מקריא״. אם החלום מטריד — עושים הטבת חלום. ואם חלומות קשים חוזרים — פונים גם לרופא; אין בזה סתירה.'],
    ['למה כאן הנוסח ״בר פלוני״ ולא שם האם?', 'כך בלשון הגמרא בברכות נה ע״ב. בתפילות לרפואה נהוג להזכיר את שם האם; מי שנוהג כך גם כאן — יכול לכתוב את שם האם בשדה.']
  ];
  function renderFaq() {
    $('pane-faq').innerHTML = '<div class="ah-intro"><h2>שאלות נפוצות</h2></div>' + FAQ.map(function (q) {
      return '<details class="ah-card ah-faq"><summary>' + esc(q[0]) + '</summary><p>' + esc(q[1]) + '</p></details>';
    }).join('') +
      '<div class="lib-note ah-note">רוצים ללמוד את הסוגיות במלואן? פתחו ב<a href="index.html">ספריית הקודש</a> את מסכת ברכות, דפים נה–נז.</div>';
  }

  // ------------------------------------------------------------------ חלון המקור
  function openSource(refs, find) {
    var dlg = $('ah-dialog'), body = $('ah-dlg-body');
    $('ah-dlg-title').textContent = 'טוען…';
    body.innerHTML = '<p class="ah-small">טוען מספריא…</p>';
    $('ah-dlg-link').href = 'https://www.sefaria.org/' + encodeURIComponent(refs[0].replace(/ /g, '_')) + '?lang=he';
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    var f = find ? norm(find) : '';
    Promise.all(refs.map(function (r) {
      return fetch('/api/torah/text?ref=' + encodeURIComponent(r)).then(function (x) { return x.json(); }).catch(function () { return { error: 'offline' }; });
    })).then(function (all) {
      var ok = all.filter(function (t) { return t && !t.error && t.he && t.he.length; });
      if (!ok.length) {
        $('ah-dlg-title').textContent = refs[0];
        body.innerHTML = '<p>לא הצלחתי לטעון את הטקסט כרגע. אפשר לפתוח אותו ישירות בספריא בקישור למטה.</p>';
        return;
      }
      $('ah-dlg-title').textContent = ok.map(function (t) { return t.heRef || t.ref; }).join(' · ');
      body.innerHTML = ok.map(function (t) {
        return (ok.length > 1 ? '<h4 class="ah-dlg-ref">' + esc(t.heRef || t.ref) + '</h4>' : '') + t.he.map(function (line) {
          var hit = f && norm(line).indexOf(f) >= 0;
          return '<p' + (hit ? ' class="hit"' : '') + '>' + esc(line) + '</p>';
        }).join('');
      }).join('');
      var first = body.querySelector('.hit');
      if (first) first.scrollIntoView({ block: 'center' });
    });
  }

  // ------------------------------------------------------------------ לשוניות וחיבורים
  function show(tab) {
    document.querySelectorAll('#ah-tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === tab); b.setAttribute('aria-selected', b.dataset.tab === tab); });
    document.querySelectorAll('.ah-pane').forEach(function (p) { p.classList.toggle('on', p.id === 'pane-' + tab); });
    store('tab', tab);
    if (location.hash !== '#' + tab) history.replaceState(null, '', '#' + tab);
  }
  function wireGo(root) {
    root.querySelectorAll('[data-go]').forEach(function (b) { b.addEventListener('click', function () { show(b.dataset.go); $('ah-tabs').scrollIntoView({ behavior: 'smooth' }); }); });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.ah-src');
    if (b) { e.preventDefault(); openSource(b.dataset.refs.split('|'), b.dataset.find); }
  });
  $('ah-dlg-close').addEventListener('click', function () { var d = $('ah-dialog'); if (d.close) d.close(); else d.removeAttribute('open'); });
  $('ah-dialog').addEventListener('click', function (e) { if (e.target === this && this.close) this.close(); });
  $('ah-tabs').addEventListener('click', function (e) { var b = e.target.closest('button[data-tab]'); if (b) show(b.dataset.tab); });

  renderSources(); renderProtect(); renderDreams(); renderHatava(); renderFaq();
  var start = (location.hash || '').slice(1);
  show(['sources', 'protect', 'dreams', 'hatava', 'faq'].indexOf(start) >= 0 ? start : (store('tab') || 'sources'));
})();
