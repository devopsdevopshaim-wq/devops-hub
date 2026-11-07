---
name: warehouse-management-v1
description: "Mantis WMS (warehouse-management-v1) — הגרסה הראשונה של מערכת המחסן: מלאי עם תמונות והערות, חלקי חילוף, הזמנות וייצוא ל־Excel. Use when the user asks about \"Mantis WMS\" or warehouse-management-v1: what it does, how to use it, explaining it to someone, troubleshooting it, or changing and extending its code."
---

# Mantis WMS

הגרסה הראשונה של מערכת המחסן: מלאי עם תמונות והערות, חלקי חילוף, הזמנות וייצוא ל־Excel.

- כתובת: https://devopsdevopshaim-wq.github.io/warehouse-management-v1/
- קוד: https://github.com/devopsdevopshaim-wq/warehouse-management-v1
- תחום: ניהול נתונים ומחסן
- עמוד הפרויקט בתיק העבודות: https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/#p/warehouse-management-v1

## מה הוא יודע לעשות

- פריטים עם תמונות והערות
- העלאה מרובה וייבוא מ־Excel
- הזמנות מכר וספקים
- ייצוא הכול ל־Excel

## איך משתמשים

- מסכים וחלקים בעמוד: מערכת Mantis WMS · דשבורד ניהול מחסן · פריטים במלאי · חלקי חילוף · הזמנות פעילות · התראות · סטטיסטיקות מהירות · ניהול מלאי עם תמונות והערות · ניהול חלקי חילוף · ניהול הזמנות מכר · ניהול ספקים · ייצוא נתונים ל-Excel · מלאי · הזמנות
- כפתורים ופעולות: אפס נתונים · ייצוא ל-Excel · ייצוא דשבורד · ייצוא מלאי · הוסף פריט חדש · פריט חדש · העלאה מרובה · ייבוא מ-Excel · ייצוא חלקים · הוסף חלק חדש · ייצוא הזמנות · הזמנה חדשה · ייצוא ספקים · הוסף ספק חדש · ייצוא הכל ל-Excel · ייצוא מותאם אישית · צור גיבוי · שחזר מגיבוי

כשמסבירים למישהו: מתחילים מהמסך הראשון, ומתארים את הפעולות לפי הסדר שבו הן מופיעות.

## איך זה בנוי

- טכנולוגיות: JavaScript, SheetJS
- ייבוא וייצוא אוטומטי של קבצי Excel
- שומר נתונים בדפדפן (localStorage) בלי שרת
- 3 קבצים, כ־123KB

קבצים עיקריים:

- `.nojekyll`
- `README.md`
- `index.html`

פונקציות בקוד: `loadXLSX`, `loadDataFromStorage`, `saveDataToStorage`, `createSampleData`, `loadPageData`, `loadDashboard`, `loadInventory`, `loadSpareParts`, `loadOrders`, `loadSuppliers`, `getCategoryName`, `getStatusClass`, `showAddModal`, `editItem`, `getInventoryForm`, `getSparePartForm`, `getOrderForm`, `getSupplierForm`, `saveItem`, `deleteItem`, `handleImageUpload`, `handlePartImageUpload`, `createImagePreview`, `showImageModal`, `closeImageModal`

## איך משנים ומפרסמים

- מורידים את הקוד: `git clone https://github.com/devopsdevopshaim-wq/warehouse-management-v1.git`
- עורכים, ודוחפים ל־main. GitHub Pages מעדכן את האתר תוך דקה בערך.
- לפני כל שינוי קוראים את הקבצים עצמם. הרשימות כאן הן תקציר, לא תחליף לקוד.

## כללים

- עונים בעברית, אלא אם המשתמש כותב בשפה אחרת.
- לא ממציאים יכולות שלא מופיעות כאן או בקוד. אם לא יודעים, אומרים, ומציעים לבדוק בקוד.
- מי שמעוניין במערכת כזו לעסק שלו: אפשר לפנות לבעל הפרויקט דרך עמוד השירותים https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/services.html
