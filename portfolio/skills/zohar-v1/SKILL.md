---
name: zohar-v1
description: "פירושי הזוהר והקבלה (zohar-v1) — מאגר מאמרים ופירושים על הזוהר, מסודר לפי פרשה, ספר ונושא, עם אפשרות לשאול שאלה. Use when the user asks about \"פירושי הזוהר והקבלה\" or zohar-v1: what it does, how to use it, explaining it to someone, troubleshooting it, or changing and extending its code."
---

# פירושי הזוהר והקבלה

מאגר מאמרים ופירושים על הזוהר, מסודר לפי פרשה, ספר ונושא, עם אפשרות לשאול שאלה.

- כתובת: https://devopsdevopshaim-wq.github.io/zohar-v1/
- קוד: https://github.com/devopsdevopshaim-wq/zohar-v1
- תחום: לימוד ותוכן
- עמוד הפרויקט בתיק העבודות: https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/#p/zohar-v1

## מה הוא יודע לעשות

- פירושים לפי פרשה וספר
- נושאים: פריון, שפע, משפחה ובריאות
- מאמרים מומלצים ואקראיים
- שליחת שאלה

## איך משתמשים

- מסכים וחלקים בעמוד: ... · קטגוריות נושאים · פריון והורות · כלכלה ושפע · פירושים לפי פרשה · פירושים לפי ספרים · משפחה וזוגיות · בריאות ורפואה · פירושים למאמרים · מאמרים אחרונים · סוד הפריון על פי האר"י הקדוש · פרשת נח - סוד התיבה על פי הזוהר · שערי השפע - פתיחת צינורות הברכה · פתרונות לבעיות נפוצות
- כפתורים ופעולות: חפש · שאל שאלה · מאמרים חדשים · מומלצים · פתרונות אקראיים · חוברות להורדה · הכל · פריון · כלכלה · משפחה · בריאות · פרשת שבוע · שלח שאלה

כשמסבירים למישהו: מתחילים מהמסך הראשון, ומתארים את הפעולות לפי הסדר שבו הן מופיעות.

## איך זה בנוי

- טכנולוגיות: JavaScript
- מריץ פעולות מתוזמנות בדפדפן (setInterval)
- מושך זמנים ותאריכים עבריים מ־Hebcal
- 5 קבצים, כ־88KB

קבצים עיקריים:

- `.nojekyll`
- `README.md`
- `heb.js`
- `index.html`
- `parsha-data.js`

פונקציות בקוד: `isLeap`, `elapsed`, `delay`, `newYearRD`, `newYearDay`, `yearLength`, `monthLength`, `monthsOf`, `monthName`, `fromDay`, `toDay`, `dayOf`, `dateOf`, `weekday`, `numeral`, `yearName`, `parshaless`, `parshaTable`, `parshaName`, `parshaFor`, `parshiotOfYear`, `holidaysOfYear`, `fast`, `holidayOn`, `roshChodesh`

## איך משנים ומפרסמים

- מורידים את הקוד: `git clone https://github.com/devopsdevopshaim-wq/zohar-v1.git`
- עורכים, ודוחפים ל־main. GitHub Pages מעדכן את האתר תוך דקה בערך.
- לפני כל שינוי קוראים את הקבצים עצמם. הרשימות כאן הן תקציר, לא תחליף לקוד.

## כללים

- עונים בעברית, אלא אם המשתמש כותב בשפה אחרת.
- לא ממציאים יכולות שלא מופיעות כאן או בקוד. אם לא יודעים, אומרים, ומציעים לבדוק בקוד.
- מי שמעוניין במערכת כזו לעסק שלו: אפשר לפנות לבעל הפרויקט דרך עמוד השירותים https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/services.html
