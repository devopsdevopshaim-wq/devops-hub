---
name: lotto-new
description: "לוטו — מערכת חכמה (lotto-new) — הגרסה המעוצבת של מערכת הלוטו: יצירת ניחושים, בדיקת דיוק מול תוצאות, סינון ומיון. Use when the user asks about \"לוטו — מערכת חכמה\" or lotto-new: what it does, how to use it, explaining it to someone, troubleshooting it, or changing and extending its code."
---

# לוטו — מערכת חכמה

הגרסה המעוצבת של מערכת הלוטו: יצירת ניחושים, בדיקת דיוק מול תוצאות, סינון ומיון.

- כתובת: https://devopsdevopshaim-wq.github.io/lotto-new/
- קוד: https://github.com/devopsdevopshaim-wq/lotto-new
- תחום: לוטו
- עמוד הפרויקט בתיק העבודות: https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/#p/lotto-new

## מה הוא יודע לעשות

- יצירת ניחושים
- בדיקת דיוק מול הגרלות קודמות
- מסננים ומיון לפי תאריך
- ייבוא וייצוא CSV ו־JSON

## איך משתמשים

- מסכים וחלקים בעמוד: 🎲 לוטו — מערכת חכמה ומעוצבת
- כפתורים ופעולות: ייצא CSV · ייצא JSON · איפוס מאגר · ➕ הוסף · ייבא CSV · ייבא JSON · 🔮 צור ניחושים · 📊 בדיקת דיוק · מיין לפי תאריך · נקה מסננים · מחק

כשמסבירים למישהו: מתחילים מהמסך הראשון, ומתארים את הפעולות לפי הסדר שבו הן מופיעות.

## איך זה בנוי

- טכנולוגיות: JavaScript, Chart.js, Bootstrap, PapaParse
- ספריות: chart.js, ajax, bootstrap
- קריאת קבצי CSV אוטומטית
- שומר נתונים בדפדפן (localStorage) בלי שרת
- 8 קבצים, כ־559KB, 3 גרסאות HTML

קבצים עיקריים:

- `.nojekyll`
- `Lotto.csv`
- `README.md`
- `index.html`
- `lotto.html`
- `lotto_log.csv`
- `לוטו חדש/lotto_advanced.html`
- `לוטו חדש/style.css`

פונקציות בקוד: `loadData`, `saveData`, `loadWeights`, `saveWeights`, `normalizeDateString`, `tuplKey`, `parseNumsString`, `arraysEqual`, `computeSeriesStats`, `computeNumberFreq`, `computePairFreq`, `scoreSeries`, `generateCandidates`, `combinations`, `renderSeriesTable`, `renderTopChart`, `renderPredictions`, `renderPerNumber`, `deleteSeries`, `setWeights`, `renderAll`, `init`

## איך משנים ומפרסמים

- מורידים את הקוד: `git clone https://github.com/devopsdevopshaim-wq/lotto-new.git`
- עורכים, ודוחפים ל־main. GitHub Pages מעדכן את האתר תוך דקה בערך.
- לפני כל שינוי קוראים את הקבצים עצמם. הרשימות כאן הן תקציר, לא תחליף לקוד.

## כללים

- עונים בעברית, אלא אם המשתמש כותב בשפה אחרת.
- לא ממציאים יכולות שלא מופיעות כאן או בקוד. אם לא יודעים, אומרים, ומציעים לבדוק בקוד.
- מי שמעוניין במערכת כזו לעסק שלו: אפשר לפנות לבעל הפרויקט דרך עמוד השירותים https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/services.html
