---
name: hebrew-calendar
description: "לוח שנה עברי תשפ״ו (hebrew-calendar) — לוח שנה עברי מדויק עם כל החגים והמועדים ופרשות השבוע, ופירוש מלא לכל פרשה. Use when the user asks about \"לוח שנה עברי תשפ״ו\" or hebrew-calendar: what it does, how to use it, explaining it to someone, troubleshooting it, or changing and extending its code."
---

# לוח שנה עברי תשפ״ו

לוח שנה עברי מדויק עם כל החגים והמועדים ופרשות השבוע, ופירוש מלא לכל פרשה.

- כתובת: https://devopsdevopshaim-wq.github.io/hebrew-calendar/
- קוד: https://github.com/devopsdevopshaim-wq/hebrew-calendar
- תחום: כלים ומחשבונים
- עמוד הפרויקט בתיק העבודות: https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/#p/hebrew-calendar

## מה הוא יודע לעשות

- לוח חודשי עברי ולועזי
- חגים ומועדים לשנה
- כל פרשות השבוע
- פירוש מלא לכל פרשה

## איך משתמשים

- מסכים וחלקים בעמוד: לוח שנה עברי מושלם · חגים ומועדים לשנת · כל פרשות השבוע לשנת
- כפתורים ופעולות: חפש · לוח שנה · חגים ומועדים · כל הפרשות · סגירה

כשמסבירים למישהו: מתחילים מהמסך הראשון, ומתארים את הפעולות לפי הסדר שבו הן מופיעות.

## איך זה בנוי

- טכנולוגיות: JavaScript
- מריץ פעולות מתוזמנות בדפדפן (setInterval)
- מושך זמנים ותאריכים עבריים מ־Hebcal
- 4 קבצים, כ־172KB

קבצים עיקריים:

- `.nojekyll`
- `README.md`
- `heb.js`
- `index.html`

פונקציות בקוד: `isLeap`, `elapsed`, `delay`, `newYearRD`, `newYearDay`, `yearLength`, `monthLength`, `monthsOf`, `monthName`, `fromDay`, `toDay`, `dayOf`, `dateOf`, `weekday`, `numeral`, `yearName`, `parshaless`, `parshaTable`, `parshaName`, `parshaFor`, `parshiotOfYear`, `holidaysOfYear`, `fast`, `holidayOn`, `roshChodesh`

## איך משנים ומפרסמים

- מורידים את הקוד: `git clone https://github.com/devopsdevopshaim-wq/hebrew-calendar.git`
- עורכים, ודוחפים ל־main. GitHub Pages מעדכן את האתר תוך דקה בערך.
- לפני כל שינוי קוראים את הקבצים עצמם. הרשימות כאן הן תקציר, לא תחליף לקוד.

## כללים

- עונים בעברית, אלא אם המשתמש כותב בשפה אחרת.
- לא ממציאים יכולות שלא מופיעות כאן או בקוד. אם לא יודעים, אומרים, ומציעים לבדוק בקוד.
- מי שמעוניין במערכת כזו לעסק שלו: אפשר לפנות לבעל הפרויקט דרך עמוד השירותים https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/services.html
