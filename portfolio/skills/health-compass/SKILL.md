---
name: health-compass
description: "מצפן בריאות (health-compass) — כלי אישי לניהול משקל, נפיחות ובעיות עיכול: אוסף נתונים, מסכם המלצות מרופאים ומנתח את המקרה שלכם. Use when the user asks about \"מצפן בריאות\" or health-compass: what it does, how to use it, explaining it to someone, troubleshooting it, or changing and extending its code."
---

# מצפן בריאות

כלי אישי לניהול משקל, נפיחות ובעיות עיכול: אוסף נתונים, מסכם המלצות מרופאים ומנתח את המקרה שלכם.

- כתובת: https://devopsdevopshaim-wq.github.io/health-compass/
- קוד: https://github.com/devopsdevopshaim-wq/health-compass
- תחום: סוכני AI
- עמוד הפרויקט בתיק העבודות: https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/#p/health-compass

## מה הוא יודע לעשות

- סינון דגלים אדומים לפני הכול
- שאלון נתונים עם שמירת טיוטה
- תמצית המלצות תזונה ופעילות
- ניתוח אישי וייצוא סיכום

## איך משתמשים

- מסכים וחלקים בעמוד: ניהול משקל, נפיחות ובעיות עיכול — במקום אחד · סינון דגלים אדומים · איסוף נתונים · מה ממליצים — תמצית מרוכזת · תזונה לירידה במשקל · פעילות גופנית · נפיחות בטנית וגזים · גורמים וטיפולים נוספים · ניתוח אישי
- כפתורים ופעולות: שמירת טיוטה · איפוס · נתח את המקרה שלי · עצור · ייצוא הסיכום

כשמסבירים למישהו: מתחילים מהמסך הראשון, ומתארים את הפעולות לפי הסדר שבו הן מופיעות.

## איך זה בנוי

- טכנולוגיות: JavaScript, localStorage
- שומר נתונים בדפדפן (localStorage) בלי שרת
- 4 קבצים, כ־50KB, 2 גרסאות HTML

קבצים עיקריים:

- `.nojekyll`
- `README.md`
- `health-compass.html`
- `index.html`

פונקציות בקוד: `checkedFlags`, `updateFlags`, `fillChips`, `calcBMI`, `collect`, `restore`, `save`, `buildPrompt`, `setBusy`

## איך משנים ומפרסמים

- מורידים את הקוד: `git clone https://github.com/devopsdevopshaim-wq/health-compass.git`
- עורכים, ודוחפים ל־main. GitHub Pages מעדכן את האתר תוך דקה בערך.
- לפני כל שינוי קוראים את הקבצים עצמם. הרשימות כאן הן תקציר, לא תחליף לקוד.

## למה זה נבנה

מידע רפואי ברשת מפוזר וסותר. מצפן בריאות מרכז את ההנחיות במקום אחד ומתאים אותן לנתונים שלכם.

## כללים

- עונים בעברית, אלא אם המשתמש כותב בשפה אחרת.
- לא ממציאים יכולות שלא מופיעות כאן או בקוד. אם לא יודעים, אומרים, ומציעים לבדוק בקוד.
- מי שמעוניין במערכת כזו לעסק שלו: אפשר לפנות לבעל הפרויקט דרך עמוד השירותים https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/services.html
