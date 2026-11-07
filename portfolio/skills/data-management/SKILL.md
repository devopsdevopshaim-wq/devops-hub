---
name: data-management
description: "ProDev Host מורחב (data-management) — הגרסה המורחבת של ProDev Host: בחירת סביבת הפעלה (Docker, Node.js, Python, PHP, Nginx), לוגים וייצוא. Use when the user asks about \"ProDev Host מורחב\" or data-management: what it does, how to use it, explaining it to someone, troubleshooting it, or changing and extending its code."
---

# ProDev Host מורחב

הגרסה המורחבת של ProDev Host: בחירת סביבת הפעלה (Docker, Node.js, Python, PHP, Nginx), לוגים וייצוא.

- כתובת: https://devopsdevopshaim-wq.github.io/data-management/index2.html
- קוד: https://github.com/devopsdevopshaim-wq/data-management
- תחום: DevOps ואירוח
- עמוד הפרויקט בתיק העבודות: https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/#p/data-management

## מה הוא יודע לעשות

- חמש סביבות הפעלה לבחירה
- גרפים וסטטיסטיקות
- יומן אירועים עם סינון
- ייצוא והדפסה

## איך משתמשים

- מסכים וחלקים בעמוד: ProDev Host · העלאת קובץ לאירוח · גרור קובץ HTML לכאן · בחר שיטת הפעלה · Docker · Node.js · Python · PHP · Nginx
- כפתורים ופעולות: הפעל שרת · העלה קובץ · עצור הכל · סרוק רשת · נקה מטמון · אתחל שירותים · פרס מיידי · הפעל · שמור הגדרות · נקה · ייצא · הכל · מידע · הצלחה · אזהרה · שגיאה · Debug · העלה והפעל

כשמסבירים למישהו: מתחילים מהמסך הראשון, ומתארים את הפעולות לפי הסדר שבו הן מופיעות.

## איך זה בנוי

- טכנולוגיות: JavaScript, Chart.js, Docker
- שירותים חיצוניים: https://api.ipify.org?format=json
- מריץ פעולות מתוזמנות בדפדפן (setInterval)
- שומר נתונים בדפדפן (localStorage) בלי שרת
- 5 קבצים, כ־349KB, 3 גרסאות HTML

קבצים עיקריים:

- `.nojekyll`
- `README.md`
- `index.html`
- `index1.html`
- `index2.html`

פונקציות בקוד: `initializeApp`, `showSection`, `setupEventListeners`, `verifyVercelToken`, `createVercelProject`, `deployToVercel`, `checkDeploymentStatus`, `handleDeploymentNotFoundError`, `handleVercelError`, `connectToServer`, `startAutoHosting`, `startServer`, `emergencyStop`, `setupDragAndDrop`, `handleFileSelect`, `clearSelectedFile`, `hostFileNow`, `addFileToManager`, `checkDeployment`, `addSampleFiles`, `removeFile`, `setupNetworkGraph`, `updateNetworkGraph`, `showNodeInfo`, `scanNetwork`

## איך משנים ומפרסמים

- מורידים את הקוד: `git clone https://github.com/devopsdevopshaim-wq/data-management.git`
- עורכים, ודוחפים ל־main. GitHub Pages מעדכן את האתר תוך דקה בערך.
- לפני כל שינוי קוראים את הקבצים עצמם. הרשימות כאן הן תקציר, לא תחליף לקוד.

## כללים

- עונים בעברית, אלא אם המשתמש כותב בשפה אחרת.
- לא ממציאים יכולות שלא מופיעות כאן או בקוד. אם לא יודעים, אומרים, ומציעים לבדוק בקוד.
- מי שמעוניין במערכת כזו לעסק שלו: אפשר לפנות לבעל הפרויקט דרך עמוד השירותים https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/services.html
