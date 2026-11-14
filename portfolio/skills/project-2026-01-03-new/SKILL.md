---
name: project-2026-01-03-new
description: "PRO Network Host (project-2026-01-03-new) — לוח בקרה לאירוח קבצים ולניטור רשת: מעלים קובץ, מפעילים שרת ועוקבים אחרי המצב בזמן אמת. Use when the user asks about \"PRO Network Host\" or project-2026-01-03-new: what it does, how to use it, explaining it to someone, troubleshooting it, or changing and extending its code."
---

# PRO Network Host

לוח בקרה לאירוח קבצים ולניטור רשת: מעלים קובץ, מפעילים שרת ועוקבים אחרי המצב בזמן אמת.

- כתובת: https://devopsdevopshaim-wq.github.io/project-2026-01-03-new/
- קוד: https://github.com/devopsdevopshaim-wq/project-2026-01-03-new
- תחום: DevOps ואירוח
- עמוד הפרויקט בתיק העבודות: https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/#p/project-2026-01-03-new

## מה הוא יודע לעשות

- העלאה והפעלה של קובץ בלחיצה
- שרת אוטומטי עם Dockerfile
- התראות בדפדפן
- Node.js בצד השרת

## איך משתמשים

- מסכים וחלקים בעמוד: PRO Network Host · העלאת קובץ
- כפתורים ופעולות: הפעל שרת אוטומטי · העלה קובץ · עצור הכל · נקה · העלה והפעל · ביטול

כשמסבירים למישהו: מתחילים מהמסך הראשון, ומתארים את הפעולות לפי הסדר שבו הן מופיעות.

## איך זה בנוי

- טכנולוגיות: Node.js, Docker, JavaScript
- אפשר להריץ אותו בקונטיינר Docker (יש Dockerfile)
- יש שרת צד־שרת משלו
- פרויקט Node.js עם תלויות מוגדרות
- מריץ פעולות מתוזמנות בדפדפן (setInterval)
- 6 קבצים, כ־53KB

קבצים עיקריים:

- `.nojekyll`
- `Package.json`
- `README.md`
- `dockerfile`
- `index.html`
- `server.js`

פונקציות בקוד: `switchView`, `uploadFile`, `closeUploadModal`, `handleFileSelect`, `startAutoServer`, `stopAllServers`, `checkServerStatus`, `updateUptime`, `updateMetrics`, `simulateNetworkTraffic`, `updateTrafficDisplay`, `simulatePackets`, `generatePacketInfo`, `updatePacketDisplay`, `getProtocolColor`, `updateProcesses`, `updateProcessDisplay`, `addActiveFile`, `viewFile`, `copyLink`, `stopFile`, `showNotification`, `clearTrafficLog`, `processUpload`, `handleWebSocketMessage`

## איך משנים ומפרסמים

- מורידים את הקוד: `git clone https://github.com/devopsdevopshaim-wq/project-2026-01-03-new.git`
- עורכים, ודוחפים ל־main. GitHub Pages מעדכן את האתר תוך דקה בערך.
- לפני כל שינוי קוראים את הקבצים עצמם. הרשימות כאן הן תקציר, לא תחליף לקוד.

## כללים

- עונים בעברית, אלא אם המשתמש כותב בשפה אחרת.
- לא ממציאים יכולות שלא מופיעות כאן או בקוד. אם לא יודעים, אומרים, ומציעים לבדוק בקוד.
- מי שמעוניין במערכת כזו לעסק שלו: אפשר לפנות לבעל הפרויקט דרך עמוד השירותים https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/services.html
