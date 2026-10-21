# פריים־סטודיו למחשב (Electron)

תוכנה להתקנה בווינדוס שמריצה את `frame-studio/` (הסטודיו) כחלון רגיל של תוכנה, גם בלי אינטרנט.

## הורדה

הקישור הקבוע לגרסה האחרונה (לשים באתר):

https://github.com/devopsdevopshaim-wq/devops-hub/releases/download/desktop-latest/FrameStudio-Setup.exe

ההתקנה לא חתומה דיגיטלית, לכן בפעם הראשונה Windows עלול להציג "Windows protected your PC".
לוחצים **More info** ואז **Run anyway**.

## איך זה עובד

- החלון טוען את `https://devopsdevopshaim-wq.github.io/devops-hub/frame-studio/studio.html`,
  אבל `main.js` מגיש כל קובץ תחת `/devops-hub/` מהעותק שנארז בתוך התוכנה (`app/devops-hub/`).
  כך הסטודיו עובד בלי רשת, והשרת (`spider-auth…workers.dev`) רואה את אותו Origin של האתר.
  קובץ שלא נארז (למשל סרטוני השיווק) נטען מהרשת.
- כל בקשה אחרת (גופנים, השרת, n8n, מדפסת מקומית ב־`http://localhost:17777`) עוברת לרשת כרגיל.
- ה־Service Worker (`sw.js`) חסום בתוכנה: עדכון מגיע רק עם התקנה חדשה.
- קישורים לאתרים אחרים נפתחים בדפדפן ברירת המחדל.
- לדפים זמין `window.FSDesktop`:
  `{ isDesktop: true, version, platform, machineId() }` — `machineId()` מחזיר SHA-256 (64 תווי hex) של מזהה המחשב
  (MachineGuid בווינדוס) עם מלח קבוע, אף פעם לא את המזהה עצמו.

## בנייה

הבנייה רצה אוטומטית ב־GitHub Actions (`.github/workflows/desktop-build.yml`) על כל שינוי ב־`desktop/` או `frame-studio/`
שנדחף ל־main, או ידנית (Run workflow). התוצאה:

- release בשם `desktop-v1.0.<מספר ריצה>` עם `FrameStudio-Setup-1.0.<n>.exe`
- release בשם `desktop-latest` עם `FrameStudio-Setup.exe` (מוחלף בכל ריצה)

בנייה מקומית (בווינדוס):

```bash
cd desktop
npm ci
npm run start      # מעתיק את האתר ומריץ את התוכנה
npm run dist:win   # בונה dist/FrameStudio-Setup-<version>.exe
```

`scripts/copy-app.mjs` מעתיק את `frame-studio/` ואת קבצי `portfolio/` שהדפים צריכים אל `app/devops-hub/`
(התיקייה לא נשמרת בגיט). רשימת הקבצים שלא נארזים נמצאת בראש הסקריפט.

הסמל (`build/icon.png`, `build/icon.ico`) נוצר מ־`frame-studio/icon.svg` עם `python3 scripts/make-icon.py` (Pillow).
