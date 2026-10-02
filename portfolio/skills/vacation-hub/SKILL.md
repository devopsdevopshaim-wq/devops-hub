---
name: vacation-hub
description: "מסע — ניהול חופשות (vacation-hub) — מתכנן חופשות שלם: בוחרים תאריכים ומקבלים יעדים מדורגים לפי מזג אוויר ועונה, עם טיסות, מלונות ומסעדות. Use when the user asks about \"מסע — ניהול חופשות\" or vacation-hub: what it does, how to use it, explaining it to someone, troubleshooting it, or changing and extending its code."
---

# מסע — ניהול חופשות

מתכנן חופשות שלם: בוחרים תאריכים ומקבלים יעדים מדורגים לפי מזג אוויר ועונה, עם טיסות, מלונות ומסעדות.

- כתובת: https://devopsdevopshaim-wq.github.io/devops-hub/
- קוד: https://github.com/devopsdevopshaim-wq/devops-hub
- הקוד יושב בתיקייה `vacation-hub/` במאגר https://github.com/devopsdevopshaim-wq/devops-hub
- תחום: אתרים ומערכות
- עמוד הפרויקט בתיק העבודות: https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/#p/vacation-hub

## מה הוא יודע לעשות

- יומן תאריכים שמדרג יעדים לפי עונה
- עמוד לכל יעד: טיסות, מלונות, רכב ומסעדות
- מפות, מסלולים ותחבורה ציבורית
- מחשבון תקציב ושמירת טיולים

## איך משתמשים

- כפתורים ופעולות: צריכים עזרה? · שליחה

כשמסבירים למישהו: מתחילים מהמסך הראשון, ומתארים את הפעולות לפי הסדר שבו הן מופיעות.

## איך זה בנוי

- טכנולוגיות: HTML, JavaScript, Leaflet, n8n
- שירותים חיצוניים: https://data.gov.il, https://www.wikidata.org, https://router.project-osrm.org
- שולח בקשות ל־Webhook של n8n, שמפעיל תהליכים אוטומטיים
- מריץ פעולות מתוזמנות בדפדפן (setInterval)
- שומר נתונים בדפדפן (localStorage) בלי שרת
- 14 קבצים, כ־644KB

קבצים עיקריים:

- `README.md`
- `api/knowledge.json`
- `css/styles.css`
- `index.html`
- `js/app.js`
- `js/config.js`
- `js/data.js`
- `js/israel.js`
- `js/media.js`
- `js/money.js`
- `js/posters.js`
- `js/safety.js`
- `js/sites.js`
- `js/vr.js`

פונקציות בקוד: `n8nPost`, `defaultStart`, `holidaysBetween`, `workdaysBetween`, `stayMatches`, `typeFit`, `weatherWord`, `isPeak`, `estimate`, `evaluate`, `ranked`, `siteUrl`, `gcal`, `photoTag`, `videoCard`, `route`, `toast`, `renderHome`, `startSlides`, `typeChipsHTML`, `bindTypeChips`, `bindSeg`, `drawCal`, `passHTML`, `updatePlan`

## איך משנים ומפרסמים

- מורידים את המאגר: `git clone https://github.com/devopsdevopshaim-wq/devops-hub.git` ועובדים בתיקייה `vacation-hub/`.
- כל שינוי שנדחף ל־main מתפרסם לבד ל־GitHub Pages תוך כ־2 דקות (Action: Deploy vacation-hub to GitHub Pages).
- לפני כל שינוי קוראים את הקבצים עצמם. הרשימות כאן הן תקציר, לא תחליף לקוד.

## למה זה נבנה

רציתי מקום אחד שבו כל תכנון חופשה מתחיל ונגמר, במקום עשרות לשוניות פתוחות. מסע מרכז את כל ההחלטות לפי התאריכים שבחרתם.

## מתוך ה־README

# מסע — מערכת לניהול חופשות אתר לתכנון וניהול חופשות בארץ ובחו״ל, בעברית, עובד מכל דפדפן ובלי התקנה. ## הפעלה **הדרך הכי פשוטה:** לחיצה כפולה על `index.html`. האתר נפתח בדפדפן ועובד מיד. **עם שרת מקומי** (מומלץ, כדי שהמפות והתמונות ייטענו בצורה חלקה): ```bash cd vacation-hub npx serve . # או: python3 -m http.server 8080 ``` ואז פותחים את הכתובת שמופיעה (למשל `http://localhost:3000`). **כתובת האתר (GitHub Pages):** https://devopsdevopshaim-wq.github.io/devops-hub/ — האתר מוגש מהענף `gh-pages`. כל שינוי ב-`vacation-hub` שנכנס ל-`main` מועתק לשם אוטומטית ומתפרסם תוך דקה-שתיים. אפשר גם להעלות את התיקייה כמו שהיא ל-Netlify או Vercel. אין צורך בשלב build. > בפתיחה ישירה של הקובץ (לחיצה כפולה) הסרטונים נפתחים ב-YouTube. מאתר אינטרנט (GitHub Pages או שרת מקומי) הם מתנגנים בתוך העמוד. ## מה יש באתר | אזור | מה עושים שם | | --- | --- | | תכנון לפי תאריכים | מסמנים ביומן יציאה וחזרה. האתר מדרג את היעדים לפי מזג האוויר, העונה ואורך החופשה, מציג כמה ימי עבודה צריך לקחת וחגים בתקופה, ומחשב עלות משוערת. | | יעדים | 14 יעדים (אילת, ירושלים, תל אביב, הגליל, פריז, לונדון, רומא, ברצלונה, אתונה, פראג, ניו יורק, דובאי, בנגקוק, טוקיו). | | עמוד יעד | סקירה ומזג אוויר, טיסה ושדה תעופה, מלונות, השכרת רכב,

## כללים

- עונים בעברית, אלא אם המשתמש כותב בשפה אחרת.
- לא ממציאים יכולות שלא מופיעות כאן או בקוד. אם לא יודעים, אומרים, ומציעים לבדוק בקוד.
- מי שמעוניין במערכת כזו לעסק שלו: אפשר לפנות לבעל הפרויקט דרך עמוד השירותים https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/services.html
