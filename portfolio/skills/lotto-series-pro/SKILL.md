---
name: lotto-series-pro
description: "Lotto Pro — הסתברויות (lotto-series-pro) — הגרסה המתקדמת: חיזוי לפי הסתברויות, ניתוח רצפים, משקלים שנשמרים והיסטוריית חיזויים. Use when the user asks about \"Lotto Pro — הסתברויות\" or lotto-series-pro: what it does, how to use it, explaining it to someone, troubleshooting it, or changing and extending its code."
---

# Lotto Pro — הסתברויות

הגרסה המתקדמת: חיזוי לפי הסתברויות, ניתוח רצפים, משקלים שנשמרים והיסטוריית חיזויים.

- כתובת: https://devopsdevopshaim-wq.github.io/lotto-series-pro/
- קוד: https://github.com/devopsdevopshaim-wq/lotto-series-pro
- תחום: לוטו
- עמוד הפרויקט בתיק העבודות: https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/#p/lotto-series-pro

## מה הוא יודע לעשות

- חיזוי לפי הסתברויות
- ניתוח רצפים
- שמירת משקלים והיסטוריה
- ייצוא ל־PDF ו־CSV

## איך משתמשים

- מסכים וחלקים בעמוד: 🔷 Lotto Pro — חיזוי הסתברויות
- כפתורים ופעולות: ייבא CSV · איפוס מאגר · הוסף · איפוס ברירת-מחדל · שמור משקלים · ייצא CSV · הרץ חיזוי · שמור לחזית היסטוריה · ייצא PDF · נתח רצפים · צור · הצג · נקה · מחק

כשמסבירים למישהו: מתחילים מהמסך הראשון, ומתארים את הפעולות לפי הסדר שבו הן מופיעות.

## איך זה בנוי

- טכנולוגיות: JavaScript, Chart.js, jsPDF, Bootstrap
- ספריות: chart.js, ajax, dist, jspdf, bootstrap
- קריאת קבצי CSV אוטומטית
- הפקת דוחות PDF אוטומטית
- שומר נתונים בדפדפן (localStorage) בלי שרת
- 3 קבצים, כ־29KB

קבצים עיקריים:

- `.nojekyll`
- `README.md`
- `index.html`

פונקציות בקוד: `saveDataset`, `loadDataset`, `saveWeightsToStorage`, `loadWeightsFromStorage`, `setDefaultWeights`, `updateWeightLabels`, `loadHistory`, `saveHistory`, `normalizeDate`, `parseSix`, `tupleKey`, `arraysEqual`, `computeSeriesMap`, `computeNumFreq`, `computePairFreq`, `analyzeSequences`, `computePerNumberScores`, `computeProbabilities`, `generatePredictions`, `combs`, `renderSeriesTable`, `renderTopChart`, `renderProbChart`, `renderPredictions`, `renderAll`

## איך משנים ומפרסמים

- מורידים את הקוד: `git clone https://github.com/devopsdevopshaim-wq/lotto-series-pro.git`
- עורכים, ודוחפים ל־main. GitHub Pages מעדכן את האתר תוך דקה בערך.
- לפני כל שינוי קוראים את הקבצים עצמם. הרשימות כאן הן תקציר, לא תחליף לקוד.

## כללים

- עונים בעברית, אלא אם המשתמש כותב בשפה אחרת.
- לא ממציאים יכולות שלא מופיעות כאן או בקוד. אם לא יודעים, אומרים, ומציעים לבדוק בקוד.
- מי שמעוניין במערכת כזו לעסק שלו: אפשר לפנות לבעל הפרויקט דרך עמוד השירותים https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/services.html
