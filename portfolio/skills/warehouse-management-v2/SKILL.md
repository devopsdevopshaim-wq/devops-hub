---
name: warehouse-management-v2
description: "ניהול מלאי וחלפים (warehouse-management-v2) — ניהול מלאי, חלקי חילוף, הזמנות וספקים, עם התחלה מהירה מקובץ Excel ודוחות. Use when the user asks about \"ניהול מלאי וחלפים\" or warehouse-management-v2: what it does, how to use it, explaining it to someone, troubleshooting it, or changing and extending its code."
---

# ניהול מלאי וחלפים

ניהול מלאי, חלקי חילוף, הזמנות וספקים, עם התחלה מהירה מקובץ Excel ודוחות.

- כתובת: https://devopsdevopshaim-wq.github.io/warehouse-management-v2/
- קוד: https://github.com/devopsdevopshaim-wq/warehouse-management-v2
- תחום: ניהול נתונים ומחסן
- עמוד הפרויקט בתיק העבודות: https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/#p/warehouse-management-v2

## מה הוא יודע לעשות

- מלאי, חלפים, הזמנות וספקים
- התחלה מהירה מ־Excel עם קובץ לדוגמה
- התראות וסטטיסטיקות לפי קטגוריה
- ייצוא דוחות ל־Excel

## איך משתמשים

- מסכים וחלקים בעמוד: Haim Krispin · לוח בקרה · התחלה מהירה עם Excel · פריטי מלאי · פריטי חלפים · הזמנות · התראות · סטטיסטיקות מלאי לפי קטגוריה · ניהול מלאי · ניהול חלפים · ניהול הזמנות · ניהול ספקים · יצוא וייבוא Excel · מלאי
- כפתורים ופעולות: איפוס כל הנתונים · יצוא Excel · ייבוא Excel · ייבוא קובץ Excel ראשון · הורדת קובץ לדוגמה · יצוא דוח ל‑Excel · רענן נתונים · יצוא מלאי ל‑Excel · פריט חדש · יצוא חלפים ל‑Excel · חלף חדש · יצוא הזמנות ל‑Excel · הזמנה חדשה · יצוא ספקים ל‑Excel · ספק חדש · יצוא · קובץ לדוגמה · יצוא הכל

כשמסבירים למישהו: מתחילים מהמסך הראשון, ומתארים את הפעולות לפי הסדר שבו הן מופיעות.

## איך זה בנוי

- טכנולוגיות: JavaScript, SheetJS
- ספריות: ajax
- ייבוא וייצוא אוטומטי של קבצי Excel
- שומר נתונים בדפדפן (localStorage) בלי שרת
- 3 קבצים, כ־296KB

קבצים עיקריים:

- `.nojekyll`
- `README.md`
- `index.html`

פונקציות בקוד: `loadDataFromStorage`, `saveDataToStorage`, `createSampleData`, `updateDashboard`, `updateInventorySummary`, `getCategoryName`, `getStatusClass`, `loadInventory`, `loadSpareParts`, `loadOrders`, `loadSuppliers`, `loadPageData`, `setPage`, `showModal`, `closeModal`, `showAddModal`, `editItem`, `deleteItem`, `getInventoryForm`, `getSparePartForm`, `getOrderForm`, `getSupplierForm`, `addFormListeners`, `saveItem`, `showNotesModal`

## איך משנים ומפרסמים

- מורידים את הקוד: `git clone https://github.com/devopsdevopshaim-wq/warehouse-management-v2.git`
- עורכים, ודוחפים ל־main. GitHub Pages מעדכן את האתר תוך דקה בערך.
- לפני כל שינוי קוראים את הקבצים עצמם. הרשימות כאן הן תקציר, לא תחליף לקוד.

## כללים

- עונים בעברית, אלא אם המשתמש כותב בשפה אחרת.
- לא ממציאים יכולות שלא מופיעות כאן או בקוד. אם לא יודעים, אומרים, ומציעים לבדוק בקוד.
- מי שמעוניין במערכת כזו לעסק שלו: אפשר לפנות לבעל הפרויקט דרך עמוד השירותים https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/services.html
