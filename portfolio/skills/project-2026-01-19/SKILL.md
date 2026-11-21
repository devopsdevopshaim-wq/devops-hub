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
- שומר נתונים בדפדפן (localStorage) בלי שרת
- עובד גם בלי אינטרנט (Service Worker)
- 130 קבצים, כ־14058KB, 2 גרסאות HTML

קבצים עיקריים:

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
- `game/audio/sfx/expl2.mp3`

פונקציות בקוד: `init`, `load`, `loadAll`, `play`, `tone`, `noise`, `makeDeck`, `startTrack`, `stopMusic`, `startAmb`, `stopAmb`, `install`, `puffMesh`, `canvasTex`, `textures`, `mats`, `mesh`, `soldier`, `poseArms`, `prepUnit`, `prepScenery`, `tintMat`, `loadAssets`, `fromAsset`, `makeUnit`

## איך משנים ומפרסמים

- מורידים את הקוד: `git clone https://github.com/devopsdevopshaim-wq/project-2026-01-19.git`
- עורכים, ודוחפים ל־main. GitHub Pages מעדכן את האתר תוך דקה בערך.
- לפני כל שינוי קוראים את הקבצים עצמם. הרשימות כאן הן תקציר, לא תחליף לקוד.

## מתוך ה־README

# פרויקט 19.1.26 Site: https://devopsdevopshaim-wq.github.io/project-2026-01-19/ ## 🎮 חזית הניאון – משחק אסטרטגיה לכיבוש שטחים **לשחק:** https://devopsdevopshaim-wq.github.io/project-2026-01-19/game/ משחק אסטרטגיה בתורות בסגנון ניאון-שקיעה: כבוש מדינות, גייס צבא, חקור טכנולוגיות ושלוט בחמישה עולמות. ### מה יש במשחק - **גרפיקת תלת-ממד בזמן אמת (WebGL / Three.js):** תאורה וצללים, ים מונפש עם קצף וגלים, זוהר ניאון (Bloom), מודלים תלת-ממדיים של טנקים, מסוקים, מטוסים ורובוטים, וקרבות קולנועיים על המפה עם פיצוצים וחלקיקים. - **5 עולמות** עם מפות משושים תלת-ממדיות שנוצרות אוטומטית: חוף הניאון, מדבר הזהב, רכס הקרח, ארץ הגעש, מטרופולין 2099. - **קמפיין** – כל עולם מחולק למדינות; כובשים מדינה אחת בכל משימה, ובסוף "מלחמה כוללת" על כל העולם. - **כיבוש עולם** – לשחק ישר על עולם שלם (עולם 1 פתוח מההתחלה). - **8 סוגי יחידות** עם יחסי כוחות (רגלים, קומנדו, טנק, ארטילריה, נ״מ, מסוק, מטוס חמקן, רובוט מכ״ם). - **מעבדת מחקר** קבועה (24 מחקרים): יחידות, כלכלה, צבא ויכולות מיוחדות (תקיפה אווירית, תגבורת, כיפת מגן, EMP). - **סאונד אמיתי:** מוזיקת אקשן של Komiku (CC0), קולות חיילים בקשר ("Go go go!", "Fire in the hole!"), ירי, פיצוצים, צעקות קרב ואווירה לכל עולם. - מצב גרפיקה "חסכונית" בהגדרות למכשירים ח

## כללים

- עונים בעברית, אלא אם המשתמש כותב בשפה אחרת.
- לא ממציאים יכולות שלא מופיעות כאן או בקוד. אם לא יודעים, אומרים, ומציעים לבדוק בקוד.
- מי שמעוניין במערכת כזו לעסק שלו: אפשר לפנות לבעל הפרויקט דרך עמוד השירותים https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/services.html
