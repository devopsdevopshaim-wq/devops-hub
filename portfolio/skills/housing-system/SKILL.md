---
name: housing-system
description: "DiraFinder — חיפוש דירות (housing-system) — כל הדירות עד רמת השכונה בדף אחד, עם שמונה שכבות ניתוח לכל נכס ומחשבון משכנתא. Use when the user asks about \"DiraFinder — חיפוש דירות\" or housing-system: what it does, how to use it, explaining it to someone, troubleshooting it, or changing and extending its code."
---

# DiraFinder — חיפוש דירות

כל הדירות עד רמת השכונה בדף אחד, עם שמונה שכבות ניתוח לכל נכס ומחשבון משכנתא.

- כתובת: https://devopsdevopshaim-wq.github.io/housing-system/
- קוד: https://github.com/devopsdevopshaim-wq/housing-system
- תחום: סוכני AI
- עמוד הפרויקט בתיק העבודות: https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/#p/housing-system

## מה הוא יודע לעשות

- מכירה, השכרה, כינוס נכסים וחו״ל
- מחיר מול השוק ומגמה בשכונה
- תב״ע, בנייה עתידית ותמ״א 38
- מחשבון זכאות ותמהיל משכנתא

## איך משתמשים

- מסכים וחלקים בעמוד: כל הדירות. עד רמת השכונה . בדף אחד. · חיפוש נכסים לפי אזור · אזורים נבחרים · נכסים בכינוס והוצאה לפועל · לפני שמגישים הצעה · מחשבון זכאות ותמהיל משכנתא · שמונה שכבות ניתוח על כל נכס · מחיר מול השוק · גודל, שטח וקרקע · ריהוט · מגורים או השקעה · מתאר ותב״ע · בנייה עתידית · תמ״א 38 / פינוי־בינוי
- כפתורים ופעולות: למכירה · להשכרה · כונס נכסים / הוצל״פ · חו״ל · הכל · מרוהט · ללא · דירה יחידה · משפר דיור · השקעה

כשמסבירים למישהו: מתחילים מהמסך הראשון, ומתארים את הפעולות לפי הסדר שבו הן מופיעות.

## איך זה בנוי

- טכנולוגיות: JavaScript, localStorage
- שומר נתונים בדפדפן (localStorage) בלי שרת
- 4 קבצים, כ־95KB, 2 גרסאות HTML

קבצים עיקריים:

- `.nojekyll`
- `README.md`
- `index.html`
- `landing.html`

פונקציות בקוד: `tween`, `step`, `loanFromPayment`, `paymentFromLoan`, `sliderOut`, `compute`, `setCalcPrice`, `pickKind`, `marketRef`, `ppmOf`, `gapOf`, `hoodTags`, `slug`, `madlanUrl`, `yad2Url`, `abroadName`, `abroadUrl`, `googleUrl`, `nadlanUrl`, `citiesForMode`, `buildCities`, `buildHoods`, `buildPrices`, `buildLive`, `renderAreaPanel`

## איך משנים ומפרסמים

- מורידים את הקוד: `git clone https://github.com/devopsdevopshaim-wq/housing-system.git`
- עורכים, ודוחפים ל־main. GitHub Pages מעדכן את האתר תוך דקה בערך.
- לפני כל שינוי קוראים את הקבצים עצמם. הרשימות כאן הן תקציר, לא תחליף לקוד.

## למה זה נבנה

לפני שמגישים הצעה על דירה צריך לבדוק עשרות דברים. DiraFinder שם את כולם על המסך יחד.

## כללים

- עונים בעברית, אלא אם המשתמש כותב בשפה אחרת.
- לא ממציאים יכולות שלא מופיעות כאן או בקוד. אם לא יודעים, אומרים, ומציעים לבדוק בקוד.
- מי שמעוניין במערכת כזו לעסק שלו: אפשר לפנות לבעל הפרויקט דרך עמוד השירותים https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/services.html
