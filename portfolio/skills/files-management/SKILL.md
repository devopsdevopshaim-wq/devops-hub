---
name: files-management
description: "מערכת אירוח קבצי HTML (files-management) — מעלים קבצי HTML, מנהלים אותם ומפרסמים: שרת מקומי, Docker או AWS, עם לוגים וגיבוי. Use when the user asks about \"מערכת אירוח קבצי HTML\" or files-management: what it does, how to use it, explaining it to someone, troubleshooting it, or changing and extending its code."
---

# מערכת אירוח קבצי HTML

מעלים קבצי HTML, מנהלים אותם ומפרסמים: שרת מקומי, Docker או AWS, עם לוגים וגיבוי.

- כתובת: https://devopsdevopshaim-wq.github.io/files-management/
- קוד: https://github.com/devopsdevopshaim-wq/files-management
- תחום: DevOps ואירוח
- עמוד הפרויקט בתיק העבודות: https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/#p/files-management

## מה הוא יודע לעשות

- העלאה, צפייה והעתקת קישור
- פריסה מקומית, ב־Docker או ל־AWS
- לוגים וניטור שרת
- ייצוא וייבוא גיבוי

## איך משתמשים

- מסכים וחלקים בעמוד: מערכת אירוח קבצי HTML אוטומטית · העלאת קובץ HTML · הגדרות אירוח · מידע על המערכת · הוראות שימוש: · קבצים מאוחסנים · סטטיסטיקות · ניהול שרת · הגדרות פריסה · לוגים וניטור · צפייה בקובץ
- כפתורים ופעולות: העלאת קבצים · ניהול קבצים · ניהול שרת · בחר קובץ מהמחשב · רענן רשימה · נקה הכל · הפעל שרת מקומי · פריסה עם Docker · פריסה ל-AWS · עצור שרת · נקה לוגים · צפה · מחק · העתק קישור · יצא גיבוי · ייבא גיבוי

כשמסבירים למישהו: מתחילים מהמסך הראשון, ומתארים את הפעולות לפי הסדר שבו הן מופיעות.

## איך זה בנוי

- טכנולוגיות: Python, Docker, Nginx, JavaScript
- אפשר להריץ אותו בקונטיינר Docker (יש Dockerfile)
- מוגדר להרצה עם docker-compose
- יש הגדרת Nginx כשרת אינטרנט
- יש סקריפט התקנה או הפעלה אוטומטי (shell)
- יש שרת צד־שרת משלו
- שרת Python עם תלויות מוגדרות
- מריץ פעולות מתוזמנות בדפדפן (setInterval)
- שומר נתונים בדפדפן (localStorage) בלי שרת
- 14 קבצים, כ־78KB, 3 גרסאות HTML

קבצים עיקריים:

- `.nojekyll`
- `Dockerfile`
- `README.md`
- `auto-host.html`
- `docker-compose.yml`
- `index.html`
- `install.sh`
- `nginx.conf`
- `requirements.txt`
- `run.html`
- `server.py`
- `start.sh`
- `stop.sh`
- `הפעל את המערכת.docx`

פונקציות בקוד: `loadAndHostExternalFile`, `showHostingOptions`, `setupSimpleDragDrop`, `handleFileSelect`, `handleFile`, `startAutoHost`, `switchTab`, `setupDragAndDrop`, `preventDefaults`, `highlight`, `unhighlight`, `handleDrop`, `handleFiles`, `loadFiles`, `saveToLocalStorage`, `deleteFile`, `clearAllFiles`, `copyLink`, `viewFile`, `closeViewer`, `updateStats`, `checkServerStatus`, `startLocalServer`, `deployDocker`, `deployAWS`

## איך משנים ומפרסמים

- מורידים את הקוד: `git clone https://github.com/devopsdevopshaim-wq/files-management.git`
- עורכים, ודוחפים ל־main. GitHub Pages מעדכן את האתר תוך דקה בערך.
- לפני כל שינוי קוראים את הקבצים עצמם. הרשימות כאן הן תקציר, לא תחליף לקוד.

## למה זה נבנה

רציתי דרך פשוטה להפוך קובץ HTML לאתר חי, בלי להסתבך בשרתים. זה היה אחד הצעדים הראשונים שלי ב־DevOps.

## כללים

- עונים בעברית, אלא אם המשתמש כותב בשפה אחרת.
- לא ממציאים יכולות שלא מופיעות כאן או בקוד. אם לא יודעים, אומרים, ומציעים לבדוק בקוד.
- מי שמעוניין במערכת כזו לעסק שלו: אפשר לפנות לבעל הפרויקט דרך עמוד השירותים https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/services.html
