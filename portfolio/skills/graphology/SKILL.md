---
name: graphology
description: "מעבדת גרפולוגיה (graphology) — מעבדה לניתוח כתב יד שרצה כולה בדפדפן: מסמנים את מאפייני הכתב ומקבלים דו״ח עם ארכיטיפ, ממדים ודיוקן אישי. Use when the user asks about \"מעבדת גרפולוגיה\" or graphology: what it does, how to use it, explaining it to someone, troubleshooting it, or changing and extending its code."
---

# מעבדת גרפולוגיה

מעבדה לניתוח כתב יד שרצה כולה בדפדפן: מסמנים את מאפייני הכתב ומקבלים דו״ח עם ארכיטיפ, ממדים ודיוקן אישי.

- כתובת: https://devopsdevopshaim-wq.github.io/graphology/
- קוד: https://github.com/devopsdevopshaim-wq/graphology
- תחום: סוכני AI
- עמוד הפרויקט בתיק העבודות: https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/#p/graphology

## מה הוא יודע לעשות

- סימון מאפייני כתב היד
- דו״ח עם ארכיטיפ, ממדים ורמת ביטחון
- עמוד שיטה שמסביר את שרשרת החישוב
- תיק עבודות, הדפסה ועברית/אנגלית

## איך משתמשים

- מסכים וחלקים בעמוד: סמנו את מאפייני כתב היד · עדיין לא הופק דו״ח · תיק העבודות · ' + esc(L(grp)) + " · " + esc(L(p)) + " · ' + esc(rep.archetype ? rep.archetype.name : "") + " · ' + esc(t("result.confidence")) + " · ' + esc(t("result.dimensions")) + " · ' + esc(t("result.standout")) + " · ' + esc(t("result.portrait")) + " · ' + esc(s.title) + " · איך המערכת מגיעה לתחזית · 1. שרשרת החישוב · 2. מד השיפוע
- כפתורים ופעולות: EN · ניתוח · הדו״ח · השיטה · תיק עבודות · איפוס · הפקת דו״ח · בדיקת מצב

כשמסבירים למישהו: מתחילים מהמסך הראשון, ומתארים את הפעולות לפי הסדר שבו הן מופיעות.

## איך זה בנוי

- טכנולוגיות: JavaScript, Chart.js, localStorage, n8n, Postgres
- שומר נתונים בדפדפן (localStorage) בלי שרת
- 1 קבצים, כ־213KB

קבצים עיקריים:

- `index.html`

פונקציות בקוד: `clamp`, `round2`, `band`, `labelFor`, `matchCombination`, `pickArchetype`, `joinClauses`, `buildSections`, `buildStress`, `buildMotivation`, `buildLeadership`, `confidenceLabel`, `analyze`, `validateAnswers`, `load`, `persist`, `applyLang`, `toggleLang`, `wireNav`, `view`, `showView`, `loadSchema`, `maybeRouteFromUrl`, `buildForm`, `buildRulerTicks`

## איך משנים ומפרסמים

- מורידים את הקוד: `git clone https://github.com/devopsdevopshaim-wq/graphology.git`
- עורכים, ודוחפים ל־main. GitHub Pages מעדכן את האתר תוך דקה בערך.
- לפני כל שינוי קוראים את הקבצים עצמם. הרשימות כאן הן תקציר, לא תחליף לקוד.

## למה זה נבנה

רציתי לבדוק אם אפשר להפוך ניתוח גרפולוגי לשיטה שקופה: כל מסקנה בדו״ח נשענת על מאפיין שסומן, ואפשר לראות איך הגענו אליה.

## כללים

- עונים בעברית, אלא אם המשתמש כותב בשפה אחרת.
- לא ממציאים יכולות שלא מופיעות כאן או בקוד. אם לא יודעים, אומרים, ומציעים לבדוק בקוד.
- מי שמעוניין במערכת כזו לעסק שלו: אפשר לפנות לבעל הפרויקט דרך עמוד השירותים https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/services.html
