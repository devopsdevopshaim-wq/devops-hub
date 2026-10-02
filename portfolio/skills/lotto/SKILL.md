---
name: lotto
description: "Lotto Predictor (lotto) — מאגר תוצאות לוטו עם חיזוי מבוסס משקלים שאפשר לכוונן, גרפים וייבוא וייצוא. Use when the user asks about \"Lotto Predictor\" or lotto: what it does, how to use it, explaining it to someone, troubleshooting it, or changing and extending its code."
---

# Lotto Predictor

מאגר תוצאות לוטו עם חיזוי מבוסס משקלים שאפשר לכוונן, גרפים וייבוא וייצוא.

- כתובת: https://devopsdevopshaim-wq.github.io/lotto/
- קוד: https://github.com/devopsdevopshaim-wq/lotto
- תחום: לוטו
- עמוד הפרויקט בתיק העבודות: https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/#p/lotto

## מה הוא יודע לעשות

- מאגר הגרלות עם ייבוא CSV ו־JSON
- חיזוי לפי משקלים מכווננים
- גרפי שכיחות
- ייצוא נתונים

## איך משתמשים

- מסכים וחלקים בעמוד: טוען נתונים… · מנוע התחזיות · התחזית להגרלה הקרובה · דירוג כל 37 המספרים · טפסים לפי המודל · טופס שיטתי · תחזית מול תוצאה · השוואת כל המודלים · המספרים החמים · המספרים הקרים · הכי הרבה זמן בלי להופיע · האם ההגרלות אקראיות? · האם אפשר לחזות? בדיקה לאחור בקצרה · הגרלות אחרונות
- כפתורים ופעולות: תחזית · סקירה · שכיחות · פערים · זוגות · התפלגויות · בדיקה לאחור · מחולל טפסים · בדיקת טופס · נתונים · לכל התחזיות והטפסים · כל הפורמט הנוכחי · 500 · 200 · 100 · 50 · צור טפסים · העתק

כשמסבירים למישהו: מתחילים מהמסך הראשון, ומתארים את הפעולות לפי הסדר שבו הן מופיעות.

## איך זה בנוי

- טכנולוגיות: JavaScript, Chart.js, Bootstrap, PapaParse
- יש GitHub Actions שרצים אוטומטית
- מריץ פעולות מתוזמנות בדפדפן (setInterval)
- ייבוא וייצוא אוטומטי של קבצי Excel
- שומר נתונים בדפדפן (localStorage) בלי שרת
- 8 קבצים, כ־272KB, 2 גרסאות HTML

קבצים עיקריים:

- `.github/workflows/update-results.yml`
- `.gitignore`
- `.nojekyll`
- `README.md`
- `index.html`
- `lotto.csv`
- `lotto.html`
- `scripts/update_results.py`

פונקציות בקוד: `lnGamma`, `gammaQ`, `shuffle`, `decodeBuffer`, `splitCsvLine`, `toISO`, `mkDraw`, `rowToDraw`, `parseCsv`, `parseXlsx`, `parseJson`, `rebuild`, `saveUser`, `loadUser`, `stats`, `toast`, `chart`, `drawChart`, `barChart`, `renderAll`, `renderHero`, `renderOverview`, `zColor`, `renderFreq`, `renderGaps`

## איך משנים ומפרסמים

- מורידים את הקוד: `git clone https://github.com/devopsdevopshaim-wq/lotto.git`
- עורכים, ודוחפים ל־main. GitHub Pages מעדכן את האתר תוך דקה בערך.
- לפני כל שינוי קוראים את הקבצים עצמם. הרשימות כאן הן תקציר, לא תחליף לקוד.

## מתוך ה־README

# לוטו · מרכז ניתוח Site: https://devopsdevopshaim-wq.github.io/lotto/ ניתוח סטטיסטי של תוצאות הלוטו (הפורמט הנוכחי: 37 מספרים + חזק 1–7, מאז מרץ 2011): שכיחויות ומבחן חי בריבוע, פערים, זוגות ושלישיות, התפלגויות מול התאוריה, בדיקה לאחור של שיטות "חיזוי", מחולל טפסים ובדיקת טופס מול כל ההיסטוריה. ## עדכון התוצאות האתר טוען את `lotto.csv` אוטומטית. הקובץ מתעדכן לבד: ה־workflow `.github/workflows/update-results.yml` מריץ את `scripts/update_results.py` בלילה שאחרי כל הגרלה ובבוקר שלמחרת. הסקריפט מושך את ההגרלות החדשות מ־paisresults.co.il, מצליב אותן מול lottoplus.co.il, ועוצר בלי לכתוב אם יש אי־התאמה או הגרלה חסרה. אפשר גם להריץ אותו ידנית מלשונית Actions (Run workflow). מספרי הזוכים לא מופיעים במקורות האלה, ולכן בהגרלות שנוספו אוטומטית העמודות האלה ריקות. גיבוי ידני: בעמוד "נתונים" אפשר לגרור קובץ CSV/Excel, להדביק שורות או להוסיף הגרלה.

## כללים

- עונים בעברית, אלא אם המשתמש כותב בשפה אחרת.
- לא ממציאים יכולות שלא מופיעות כאן או בקוד. אם לא יודעים, אומרים, ומציעים לבדוק בקוד.
- מי שמעוניין במערכת כזו לעסק שלו: אפשר לפנות לבעל הפרויקט דרך עמוד השירותים https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/services.html
