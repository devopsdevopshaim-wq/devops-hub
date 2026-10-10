---
name: zohar
description: "לוח שנה עם פירושי הפרשות (zohar) — לוח שנה עברי עם חיפוש, חגים ומועדים, ופירושים מלאים לכל 54 פרשות השבוע. Use when the user asks about \"לוח שנה עם פירושי הפרשות\" or zohar: what it does, how to use it, explaining it to someone, troubleshooting it, or changing and extending its code."
---

# לוח שנה עם פירושי הפרשות

לוח שנה עברי עם חיפוש, חגים ומועדים, ופירושים מלאים לכל 54 פרשות השבוע.

- כתובת: https://devopsdevopshaim-wq.github.io/zohar/index10.html
- קוד: https://github.com/devopsdevopshaim-wq/zohar
- תחום: לימוד ותוכן
- עמוד הפרויקט בתיק העבודות: https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/#p/zohar

## מה הוא יודע לעשות

- פירוש מלא לכל 54 הפרשות
- חגים ומועדים
- חיפוש בלוח
- מעבר בין שנים

## איך משתמשים

- מסכים וחלקים בעמוד: לוח שנה עברי מושלם · חגים ומועדים לשנת · כל פרשות השבוע לשנת
- כפתורים ופעולות: חפש · לוח שנה · חגים ומועדים · כל הפרשות · סגירה

כשמסבירים למישהו: מתחילים מהמסך הראשון, ומתארים את הפעולות לפי הסדר שבו הן מופיעות.

## איך זה בנוי

- טכנולוגיות: JavaScript
- מריץ פעולות מתוזמנות בדפדפן (setInterval)
- מושך זמנים ותאריכים עבריים מ־Hebcal
- 21 קבצים, כ־1903KB, 18 גרסאות HTML

קבצים עיקריים:

- `.nojekyll`
- `README.md`
- `heb.js`
- `hebrew-calendar.html`
- `hebrew-calendar1.html`
- `hebrew-calendar2.html`
- `hebrew-calendar3.html`
- `hebrew-calendar4.html`
- `hebrew-calendar5.html`
- `index.html`
- `index1.html`
- `index10.html`
- `index11.html`
- `index2.html`
- `index3.html`
- `index4.html`
- `index5.html`
- `index6.html`
- `index7.html`
- `index8.html`

פונקציות בקוד: `isLeap`, `elapsed`, `delay`, `newYearRD`, `newYearDay`, `yearLength`, `monthLength`, `monthsOf`, `monthName`, `fromDay`, `toDay`, `dayOf`, `dateOf`, `weekday`, `numeral`, `yearName`, `parshaless`, `parshaTable`, `parshaName`, `parshaFor`, `parshiotOfYear`, `holidaysOfYear`, `fast`, `holidayOn`, `roshChodesh`

## איך משנים ומפרסמים

- מורידים את הקוד: `git clone https://github.com/devopsdevopshaim-wq/zohar.git`
- עורכים, ודוחפים ל־main. GitHub Pages מעדכן את האתר תוך דקה בערך.
- לפני כל שינוי קוראים את הקבצים עצמם. הרשימות כאן הן תקציר, לא תחליף לקוד.

## כללים

- עונים בעברית, אלא אם המשתמש כותב בשפה אחרת.
- לא ממציאים יכולות שלא מופיעות כאן או בקוד. אם לא יודעים, אומרים, ומציעים לבדוק בקוד.
- מי שמעוניין במערכת כזו לעסק שלו: אפשר לפנות לבעל הפרויקט דרך עמוד השירותים https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/services.html
