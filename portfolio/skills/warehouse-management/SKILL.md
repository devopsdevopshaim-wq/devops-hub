---
name: warehouse-management
description: "WMS חכם — ניהול מחסן (warehouse-management) — מערכת ניהול מחסן מלאה: מדפים, פריטים וספקים, סריקת ברקוד במצלמה, ייבוא וייצוא Excel וגרפים. Use when the user asks about \"WMS חכם — ניהול מחסן\" or warehouse-management: what it does, how to use it, explaining it to someone, troubleshooting it, or changing and extending its code."
---

# WMS חכם — ניהול מחסן

מערכת ניהול מחסן מלאה: מדפים, פריטים וספקים, סריקת ברקוד במצלמה, ייבוא וייצוא Excel וגרפים.

- כתובת: https://devopsdevopshaim-wq.github.io/warehouse-management/
- קוד: https://github.com/devopsdevopshaim-wq/warehouse-management
- תחום: ניהול נתונים ומחסן
- עמוד הפרויקט בתיק העבודות: https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/#p/warehouse-management

## מה הוא יודע לעשות

- סריקת ברקוד ו־QR במצלמה
- מפת מדפים ופריטים בכל מדף
- ייבוא וייצוא Excel
- דשבורד עם גרפים והתחברות משתמש

## איך משתמשים

- מסכים וחלקים בעמוד: Haim Krispin · מערכת Haim Krispin · דשבורד ניהול · הוספת פריט חדש · ייצוא נתונים · ייבוא מ-Excel · הערות · איפוס נתונים · פרטי מנהל · ניהול משתמש · מדף A1 · פריטים במדף · עריכת פרטי ספק · פריטים במלאי
- כפתורים ופעולות: סגור · התחבר למערכת · התנתק · ייצוא · ייבוא · פריט חדש · ביטול · שמור · אפס הכל · שמור שינויים · צור הזמנה · הוסף פריט מלאי · ייצוא מלאי · ייבוא נתונים · צור הזמנות למלאי נמוך · הוסף פריט · רענון מפה · הוסף מדף חדש

כשמסבירים למישהו: מתחילים מהמסך הראשון, ומתארים את הפעולות לפי הסדר שבו הן מופיעות.

## איך זה בנוי

- טכנולוגיות: JavaScript, Chart.js, SheetJS, html5-qrcode
- ספריות: ajax, chart.js, html5-qrcode
- מריץ פעולות מתוזמנות בדפדפן (setInterval)
- ייבוא וייצוא אוטומטי של קבצי Excel
- סריקת ברקוד ו־QR במצלמה
- שומר נתונים בדפדפן (localStorage) בלי שרת
- 18 קבצים, כ־1973KB, 2 גרסאות HTML

קבצים עיקריים:

- `.nojekyll`
- `README.md`
- `Scan2026-01-14_152436.pdf`
- `Scan2026-01-14_152608.pdf`
- `Scan2026-01-14_152648.pdf`
- `index.html`
- `parameters_roc-tp3_03_D.02.02.02_000-000-000_20190101133003.zip`
- `גיבוי_WMS_2026-01-21.json`
- `דוגמה_all_WMS.xlsx`
- `דוגמה_inventory_WMS.xlsx`
- `דוגמה_spare-parts_WMS.xlsx`
- `הוראות_הורדה.txt`
- `הזמנות_WMS.json`
- `הצעת מחיר_64811_20260112_125104.pdf`
- `חלקי_חילוף_WMS.xlsx`
- `מלאי מחסן 20.1.26.xlsx`
- `מלאי_WMS.xlsx`
- `ניהול מחסן ממוחשב.html`

פונקציות בקוד: `saveDataToStorage`, `loadDataFromStorage`, `getRandomSupplier`, `assignSupplierToSparePart`, `assignSuppliersToAllSpareParts`, `addActivity`, `updateActivityTimeline`, `resetInactivityTimer`, `startSessionTimer`, `updateClock`, `createSampleData`, `checkPermission`, `setupNavigation`, `loadDashboard`, `loadInventory`, `renderInventoryRows`, `loadLocations`, `render3DShelves`, `getShelfData`, `renderShelfMap`, `renderRecentLocationItems`, `renderShelvesTable`, `loadSpareParts`, `renderSpareCards`, `loadOrders`

## איך משנים ומפרסמים

- מורידים את הקוד: `git clone https://github.com/devopsdevopshaim-wq/warehouse-management.git`
- עורכים, ודוחפים ל־main. GitHub Pages מעדכן את האתר תוך דקה בערך.
- לפני כל שינוי קוראים את הקבצים עצמם. הרשימות כאן הן תקציר, לא תחליף לקוד.

## למה זה נבנה

מחסן אמיתי עובד עם מדפים, ברקודים וקבצי Excel. בניתי מערכת שמדברת בשפה הזאת, ורצה מהדפדפן בלי התקנה.

## כללים

- עונים בעברית, אלא אם המשתמש כותב בשפה אחרת.
- לא ממציאים יכולות שלא מופיעות כאן או בקוד. אם לא יודעים, אומרים, ומציעים לבדוק בקוד.
- מי שמעוניין במערכת כזו לעסק שלו: אפשר לפנות לבעל הפרויקט דרך עמוד השירותים https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/services.html
