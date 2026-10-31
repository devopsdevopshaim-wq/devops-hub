/* Help in place: a short floating explanation when the mouse rests on a tab or a button (the TIPS below, else the button's own
   title), and a guide to every part of the program that opens once, before the first work, and again from "❓ עזרה". */
(function () {
  'use strict';
  var FS = window.FS;
  var TIPS = [
    ['[data-sw="mt"]', 'עבודה מהירה: המסך לאירוע. מכניסים תמונות, מסדרים גודל ועותקים, עורכים כמה ביחד ומדפיסים. (F2)'],
    ['[data-sw="studio"]', 'סטודיו עיצוב: העורך המלא עם כל הכלים, השכבות, הקולאז׳ והמצגות.'],
    ['#mt [data-v="main"]', 'ראשי: כל התמונות בעבודה. כאן קובעים גודל הדפסה, מספר עותקים, מסננים לאורך / לרוחב ומוסיפים את פרטי העסק.'],
    ['#mt [data-v="edit"]', 'ערוך תמונה: תיקון צבע, כותרת, מסגרות, אפקטים וקליפארט. רואים תמונה אחת גדולה או כמה ביחד ועוברים בחיצים.'],
    ['#mt [data-v="design"]', 'עורך מלא: תמונה אחת על כל המסך, טקסטים ועצמים, חיתוך, סיבוב וכלי AI. גוררים כדי להזיז.'],
    ['#mt [data-v="ai"]', 'AI: גיבורי על, סגנונות, עריכות חכמות וטרנדים על התמונות המסומנות. רואים לפני ואחרי ואפשר לבטל.'],
    ['#mt [data-v="print"]', 'הדפסה: בוחרים מדפסת ונייר, רואים כמה דפים יוצאים ומדפיסים את כל העותקים בבת אחת.'],
    ['#mt [data-bar="size"]', 'גודל: גודל ההדפסה לכל התמונות או למסומנות, להתאים (כל התמונה) או לחתוך (ממלא את הדף).'],
    ['#mt [data-bar="files"]', 'תמונות: סימון, סינון (שלא הודפסו, שנערכו), מיון והסרה מהעבודה.'],
    ['#mt [data-bar="copies"]', 'הדפסים: כמה עותקים מכל תמונה. 0 = לא מודפסת.'],
    ['#mt [data-bar="biz"]', 'פרטי העסק: שורה קטנה עם השם והטלפון שלך על התמונות, רק כשרוצים.'],
    ['#mt .mt-ori [data-ori="all"]', 'כל התמונות, קודם אלה שלאורך ואחר כך אלה שלרוחב.'],
    ['#mt .mt-ori [data-ori="tall"]', 'רק התמונות לאורך. טוב כשרוצים לשים עליהן מסגרת לאורך.'],
    ['#mt .mt-ori [data-ori="wide"]', 'רק התמונות לרוחב. טוב כשרוצים לשים עליהן מסגרת לרוחב.'],
    ['#mt-orient', 'כל תמונה נשארת בכיוון שלה: לאורך נשארת לאורך, לרוחב נשארת לרוחב.'],
    ['#mt-en', 'כמה תמונות רואים בבת אחת. 1 = תמונה אחת גדולה ושלמה.'],
    ['#mt-etog', 'כשמסומן: כל שינוי חל על כל התמונות שבמסך יחד.'],
    ['#mt [data-pt="color"]', 'תיקון צבע: בהירות, ניגודיות, חשיפה, רוויה, חום וחדות. "אוטומטי" מתקן לבד.'],
    ['#mt [data-pt="title"]', 'כותרת: טקסט על התמונות (שמות, תאריך), בגופן ובצבע שבוחרים.'],
    ['#mt [data-pt="frames"]', 'מסגרות: מסגרות מוכנות, PNG משלך, מסגרת לפי כיוון ועורך מסגרות מקצועי מההזמנה.'],
    ['#mt [data-pt="fx"]', 'אפקטים: סגנונות צבע מוכנים בלחיצה.'],
    ['#mt [data-pt="clip"]', 'קליפארט: אימוג׳י, לוגו או תמונה קטנה על התמונות.'],
    ['#mt [data-pt="looks"]', 'שמורים: שומרים עריכה שאוהבים ומחילים אותה שוב בלחיצה, גם באירוע הבא.'],
    ['#mt-ai-eng', 'מנוע ה־AI: אוטומטי בוחר לבד את המנוע הזמין. מקומי עובד במחשב בלי אינטרנט.'],
    ['#mt-keep', 'שומר על הפנים המקוריות בעיצוב, כדי שהאנשים יישארו דומים לעצמם.'],
    ['#mt-one', 'בתמונה עם כמה אנשים בוחרים אדם אחד, ורק הוא מעוצב.'],
    ['#mt-ai-go', 'כותבים במילים מה לעשות בתמונה, וה־AI עושה.'],
    ['#mt-ai-back', 'מבטל את עיצוב ה־AI האחרון.'],
    ['#mt-ai-orig', 'מחזיר את התמונה המקורית, בלי שום עיצוב AI.'],
    ['#mt-estrip', 'כל התמונות בקטן. לחיצה עוברת לתמונה.'],
    ['#plan-pill', 'התוכנית שלך: כמה נשאר בניסיון, או שדרוג לאופטימוס המלא.'],
    ['[data-fm-open]', 'עורך מסגרות מקצועי: 16 עיצובי AI לפי ההזמנה, שכבות, טקסטים ושמירה לתיקייה.'],
    ['#mt-files', 'הוספת תמונות מהמחשב (גם RAW ו־HEIC).'], ['#mt-folder', 'פתיחת תיקייה שלמה של תמונות.'], ['#help-btn', 'הסבר על כל חלקי התוכנה.']
  ];
  var GUIDE = [
    ['🗂️', 'ראשי', 'מכניסים תמונות (📂 תמונות או 📁 תיקייה). כל תמונה נכנסת בכיוון שלה. קובעים גודל הדפסה ועותקים, ומסננים לאורך / לרוחב.'],
    ['🎚️', 'ערוך תמונה', 'תמונה אחת גדולה, או 2–9 ביחד לעריכה מרובה. עוברים בחיצים, במקלדת (← →) או ברצועה למטה. לחיצה ארוכה על תמונה מראה את המקור.'],
    ['🖼️', 'מסגרות', 'בלשונית "מסגרות" בוחרים מסגרת לאורך ומסגרת לרוחב, וכל אחת עולה רק על התמונות בכיוון שלה.'],
    ['🖌️', 'עורך מלא', 'תמונה אחת על כל המסך: טקסטים, אימוג׳י, לוגו, חיתוך, סיבוב וכלי AI. גוררים כדי להזיז.'],
    ['🤖', 'AI', 'מסמנים תמונות ובוחרים עיצוב: גיבורי על, על אדם אמיתי, עריכות חכמות, טרנדים או סגנון. אפשר גם לכתוב במילים. "👤 רק על אדם אחד" מעצב רק את מי שבוחרים.'],
    ['🖨️', 'הדפסה', 'בוחרים מדפסת ונייר ומדפיסים את כל העותקים. בגרסה החינמית יש פס קטן "נערך באופטימוס".'],
    ['⭐', 'שדרוג', 'בניסיון הכל פתוח. אחריו, בלחיצה על התווית למעלה: כרטיס אירוע, מנוי או רישיון מלא.'],
    ['💡', 'טיפ', 'עומדים עם העכבר על כל לשונית או כפתור ומופיע הסבר קצר.']
  ];
  var tip = document.createElement('div'); tip.id = 'fs-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true; document.body.appendChild(tip);
  var tm = 0, on = null;
  function textOf(el) {
    for (var i = 0; i < TIPS.length; i++) { try { if (el.matches(TIPS[i][0]) || el.closest(TIPS[i][0]) === el) return TIPS[i][1]; } catch (e) { /* a selector this page lacks */ } }
    var t = el.getAttribute('data-tip') || el.getAttribute('title');
    if (t) { el.setAttribute('data-tip', t); el.removeAttribute('title'); }   /* our tip instead of the browser's slow one */
    return t || '';
  }
  function target(n) {
    for (var el = n; el && el !== document.body; el = el.parentElement) {
      if (!el.matches) continue;
      if (el.matches('button, a, label, select, [data-tip], [title], .mt-seg, #mt-estrip')) { var t = textOf(el); if (t) return { el: el, t: t }; }
    }
    return null;
  }
  function show(x) {
    tip.textContent = x.t; tip.hidden = false;
    var r = x.el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    var top = r.bottom + 8; if (top + h > innerHeight - 6) top = r.top - h - 8;
    var left = Math.min(innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2));
    tip.style.top = Math.max(6, top) + 'px'; tip.style.left = left + 'px';
  }
  function hide() { clearTimeout(tm); tip.hidden = true; on = null; }
  document.addEventListener('mouseover', function (e) {
    var x = target(e.target); if (!x) { if (on) hide(); return; } if (on === x.el) return;
    hide(); on = x.el; tm = setTimeout(function () { if (on === x.el && x.el.isConnected) show(x); }, 450);
  });
  document.addEventListener('mousedown', hide, true); document.addEventListener('keydown', hide, true); window.addEventListener('scroll', hide, true);

  /* the guide: before the first work, and from ❓ */
  FS.helpGuide = function () {
    if (!FS.dialog) return;
    FS.dialog('❓ איך עובדים עם אופטימוס',
      '<div class="hp-g">' + GUIDE.map(function (g) { return '<div class="hp-i"><i>' + g[0] + '</i><div><b>' + g[1] + '</b><p>' + g[2] + '</p></div></div>'; }).join('') + '</div>' +
      '<p class="hp-f">אפשר לפתוח את ההסבר שוב בכל רגע בכפתור ❓ למעלה.</p><div class="hp-a"><button class="btn" id="hp-go">✔ הבנתי, מתחילים</button></div>', true);
    var b = document.getElementById('hp-go'); if (b) b.addEventListener('click', function () { FS.closeDialog(); });
    try { localStorage.setItem('fs-guide-seen', '1'); } catch (e) { /* private mode */ }
  };
  FS.helpWelcome = function () { var seen = null; try { seen = localStorage.getItem('fs-guide-seen'); } catch (e) { /* private mode */ } if (!seen && !document.body.classList.contains('gated')) FS.helpGuide(); };
  function button() {
    var host = document.querySelector('#mt .mt-acts'); if (!host || document.getElementById('help-btn')) return;
    var b = document.createElement('button'); b.id = 'help-btn'; b.type = 'button'; b.className = 'mt-btn'; b.textContent = '❓ עזרה';
    b.addEventListener('click', FS.helpGuide); host.appendChild(b);
  }
  setTimeout(function () { button(); FS.helpWelcome(); }, 2000);
})();
