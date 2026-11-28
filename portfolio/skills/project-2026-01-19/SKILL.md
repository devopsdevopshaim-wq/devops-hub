---
name: project-2026-01-19
description: "הורדת קבצי וידאו (project-2026-01-19) — כלי פשוט להורדת קבצי וידאו מקישור ישיר, עם היסטוריית הורדות. Use when the user asks about \"הורדת קבצי וידאו\" or project-2026-01-19: what it does, how to use it, explaining it to someone, troubleshooting it, or changing and extending its code."
---

# הורדת קבצי וידאו

כלי פשוט להורדת קבצי וידאו מקישור ישיר, עם היסטוריית הורדות.

- כתובת: https://devopsdevopshaim-wq.github.io/project-2026-01-19/
- קוד: https://github.com/devopsdevopshaim-wq/project-2026-01-19
- תחום: כלים ומחשבונים
- עמוד הפרויקט בתיק העבודות: https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/#p/project-2026-01-19

## מה הוא יודע לעשות

- הורדה מקישור ישיר
- יצירת קובץ וידאו לדוגמה
- רשימת קבצים שהורדתם

## איך משתמשים

- מסכים וחלקים בעמוד: 🎬 הורדת קבצי וידאו ישירים · הורדת קובץ וידאו ישיר · יצירת קובץ וידאו מדוגמה · קבצים שהורדת · ⚠️ חשוב לדעת
- כפתורים ופעולות: ⬇️ הורד קובץ ישיר · 🎥 צור קובץ וידאו לדוגמה · הורד שוב

כשמסבירים למישהו: מתחילים מהמסך הראשון, ומתארים את הפעולות לפי הסדר שבו הן מופיעות.

## איך זה בנוי

- טכנולוגיות: JavaScript
- יש סקריפט התקנה או הפעלה אוטומטי (shell)
- יש GitHub Actions שרצים אוטומטית
- שומר נתונים בדפדפן (localStorage) בלי שרת
- עובד גם בלי אינטרנט (Service Worker)
- 171 קבצים, כ־18545KB, 3 גרסאות HTML

קבצים עיקריים:

- `.github/workflows/toto-data.yml`
- `.nojekyll`
- `README.md`
- `game/audio/CREDITS.md`
- `game/audio/music/defeat.mp3`
- `game/audio/music/levelup.mp3`
- `game/audio/music/menu.mp3`
- `game/audio/music/victory.mp3`
- `game/audio/music/war1.mp3`
- `game/audio/music/war2.mp3`
- `game/audio/music/war3.mp3`
- `game/audio/music/war4.mp3`
- `game/audio/sfx/amb_city.mp3`
- `game/audio/sfx/amb_sea.mp3`
- `game/audio/sfx/amb_wind.mp3`
- `game/audio/sfx/boom_big1.mp3`
- `game/audio/sfx/boom_big2.mp3`
- `game/audio/sfx/engine.mp3`
- `game/audio/sfx/expl0.mp3`
- `game/audio/sfx/expl1.mp3`

פונקציות בקוד: `init`, `load`, `loadAll`, `play`, `tone`, `noise`, `makeDeck`, `startTrack`, `stopMusic`, `startAmb`, `stopAmb`, `install`, `puffMesh`, `canvasTex`, `textures`, `mats`, `mesh`, `soldier`, `poseArms`, `prepUnit`, `prepScenery`, `tintMat`, `loadAssets`, `fromAsset`, `makeUnit`

## איך משנים ומפרסמים

- מורידים את הקוד: `git clone https://github.com/devopsdevopshaim-wq/project-2026-01-19.git`
- עורכים, ודוחפים ל־main. GitHub Pages מעדכן את האתר תוך דקה בערך.
- לפני כל שינוי קוראים את הקבצים עצמם. הרשימות כאן הן תקציר, לא תחליף לקוד.

## מתוך ה־README

# פרויקט 19.1.26 Site: https://devopsdevopshaim-wq.github.io/project-2026-01-19/ ## ⚽ טוטו חכם – מערכת ניחושים לטוטו כדורגל **לפתוח:** https://devopsdevopshaim-wq.github.io/project-2026-01-19/toto/ - **הטופס שלי:** בונים את טופס 16 המשחקים (מהטופס הרשמי, או מילוי אוטומטי מהמשחקים הקרובים). המערכת מסמנת 1 / X / 2 לכל משחק, ומחלקת כפולים ומשולשים לפי מספר הטורים שבחרת, כך שהסיכוי לפגוע בכל הטופס יהיה הגבוה ביותר. מציגה עלות, צפי פגיעות וסיכוי ל־16, 15 ו־14. אפשר לנעול ניחוש ידני ולהעתיק את הטופס כטקסט. - **משחקי השבוע:** כל המשחקים בטווח תאריכים, עם הסתברות לכל תוצאה, צפי שערים וניחוש. - **סקירת משחק:** ראש בראש מלא (כמה פעמים כל קבוצה ניצחה, תיקו, שערים, כל המפגשים), מקום בטבלה, כושר, בית/חוץ, ממוצעי שערים, מעל 2.5, שתי הקבוצות יבקיעו, שער נקי, רצפים, תוצאות סבירות וניתוח מילולי. - **טבלאות:** טבלה מחושבת לכל ליגה + פרופיל קבוצה. **ליגות:** אנגליה (פרמייר + צ'מפיונשיפ), ספרד, איטליה, גרמניה, צרפת, הולנד, פורטוגל, טורקיה, בלגיה, סקוטלנד, ליגת האלופות, הליגה האירופית, הקונפרנס. ליגת העל: היסטוריה עד מאי 2025 בלבד (אין מקור פתוח עדכני). הליגה הלאומית: הזנה ידנית. **המודל:** פואסון משוקלל זמן (דיקסון-קולס) לכל ליגה + תיקון ראש בראש. בבדיקה לאחור על 2023–2025: ניחוש בודד צודק ב־51%–55%,

## כללים

- עונים בעברית, אלא אם המשתמש כותב בשפה אחרת.
- לא ממציאים יכולות שלא מופיעות כאן או בקוד. אם לא יודעים, אומרים, ומציעים לבדוק בקוד.
- מי שמעוניין במערכת כזו לעסק שלו: אפשר לפנות לבעל הפרויקט דרך עמוד השירותים https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/services.html
