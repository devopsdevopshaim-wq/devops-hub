---
name: lotto-series
description: "חיזוי סדרות לוטו (lotto-series) — חיזוי סדרות של 6 מספרים ומספר נוסף, מתוך מאגר ההגרלות. Use when the user asks about \"חיזוי סדרות לוטו\" or lotto-series: what it does, how to use it, explaining it to someone, troubleshooting it, or changing and extending its code."
---

# חיזוי סדרות לוטו

חיזוי סדרות של 6 מספרים ומספר נוסף, מתוך מאגר ההגרלות.

- כתובת: https://devopsdevopshaim-wq.github.io/lotto-series/
- קוד: https://github.com/devopsdevopshaim-wq/lotto-series
- תחום: לוטו
- עמוד הפרויקט בתיק העבודות: https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/#p/lotto-series

## מה הוא יודע לעשות

- ייבוא מאגר מ־CSV
- הפקת ניבויים לסדרות
- גרפים
- ייצוא CSV

## איך משתמשים

- מסכים וחלקים בעמוד: 🎯 Lotto — חיזוי סדרות (6+נוסף)
- כפתורים ופעולות: ייבא CSV · איפוס מאגר · הוסף · 🔮 הפק ניבויים · יצא CSV

כשמסבירים למישהו: מתחילים מהמסך הראשון, ומתארים את הפעולות לפי הסדר שבו הן מופיעות.

## איך זה בנוי

- טכנולוגיות: JavaScript, Chart.js, Bootstrap
- ספריות: chart.js, ajax, bootstrap
- קריאת קבצי CSV אוטומטית
- שומר נתונים בדפדפן (localStorage) בלי שרת
- 3 קבצים, כ־22KB

קבצים עיקריים:

- `.nojekyll`
- `README.md`
- `index.html`

פונקציות בקוד: `loadData`, `saveData`, `normalizeDateString`, `tupleKey`, `parseNumsString`, `computeSeriesStats`, `computeNumberFreq`, `scoreSeriesObj`, `renderSeriesTable`, `deleteSeries`, `arraysEqual`, `renderTopChart`, `generatePredictions`, `combinations`, `renderPredictions`, `renderAll`, `init`

## איך משנים ומפרסמים

- מורידים את הקוד: `git clone https://github.com/devopsdevopshaim-wq/lotto-series.git`
- עורכים, ודוחפים ל־main. GitHub Pages מעדכן את האתר תוך דקה בערך.
- לפני כל שינוי קוראים את הקבצים עצמם. הרשימות כאן הן תקציר, לא תחליף לקוד.

## כללים

- עונים בעברית, אלא אם המשתמש כותב בשפה אחרת.
- לא ממציאים יכולות שלא מופיעות כאן או בקוד. אם לא יודעים, אומרים, ומציעים לבדוק בקוד.
- מי שמעוניין במערכת כזו לעסק שלו: אפשר לפנות לבעל הפרויקט דרך עמוד השירותים https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/services.html
