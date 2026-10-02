---
name: israel-holidays
description: "דפדפן חגי ישראל (israel-holidays) — כל חג במקום אחד: הסבר, תפילות, קריאת התורה, מקורות מהתנ״ך, הגמרא והזוהר, וזמני כניסה ויציאה. Use when the user asks about \"דפדפן חגי ישראל\" or israel-holidays: what it does, how to use it, explaining it to someone, troubleshooting it, or changing and extending its code."
---

# דפדפן חגי ישראל

כל חג במקום אחד: הסבר, תפילות, קריאת התורה, מקורות מהתנ״ך, הגמרא והזוהר, וזמני כניסה ויציאה.

- כתובת: https://devopsdevopshaim-wq.github.io/israel-holidays/
- קוד: https://github.com/devopsdevopshaim-wq/israel-holidays
- תחום: כלים ומחשבונים
- עמוד הפרויקט בתיק העבודות: https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/#p/israel-holidays

## מה הוא יודע לעשות

- זמני כניסה ויציאה לפי מיקום
- תפילות וקריאת התורה
- טקסטים מלאים מהמקורות
- קישורים מומלצים

## איך משתמשים

- מסכים וחלקים בעמוד: דפדפן חגים של ישראל — גרסה מלאה · תקציר והסבר · תפילה ובית הכנסת · טלית · סידור ותפילות · קריאת תורה והפטרה · טקסטים מהתנ"ך (מלאים) · מראי מקום בגמרא · זוהר - ציטוטים והסברים · מקורות וקישורים מומלצים
- כפתורים ופעולות: טען חגים וחשב זמני כניסה/יציאה · נקה

כשמסבירים למישהו: מתחילים מהמסך הראשון, ומתארים את הפעולות לפי הסדר שבו הן מופיעות.

## איך זה בנוי

- טכנולוגיות: JavaScript, Hebcal API, Sunrise-Sunset API
- שירותים חיצוניים: https://api.sunrise-sunset.org
- הקראה בקול (Web Speech)
- מושך זמנים ותאריכים עבריים מ־Hebcal
- 11 קבצים, כ־128KB, 9 גרסאות HTML

קבצים עיקריים:

- `.nojekyll`
- `Israel-holidays-browser.html`
- `Israel-holidays-browser1.html`
- `Israel-holidays-browser2.html`
- `Israel-holidays-browser3.html`
- `Israel-holidays-browser4.html`
- `Israel-holidays-browser5.html`
- `Israel-holidays-browser6.html`
- `Israel-holidays-browser7.html`
- `README.md`
- `index.html`

פונקציות בקוד: `fetchHolidays`, `formatDate`, `createRow`, `load`, `renderList`, `selectHoliday`, `buildTabs`, `activateTab`, `loadDatesForCurrent`, `renderTabContent`, `renderTab`, `renderBlessings`, `renderTexts`, `renderHalacha`, `escapeHtml`, `downloadFile`, `populateVoices`, `speakText`, `loadTimesForCurrent`, `showHoliday`

## איך משנים ומפרסמים

- מורידים את הקוד: `git clone https://github.com/devopsdevopshaim-wq/israel-holidays.git`
- עורכים, ודוחפים ל־main. GitHub Pages מעדכן את האתר תוך דקה בערך.
- לפני כל שינוי קוראים את הקבצים עצמם. הרשימות כאן הן תקציר, לא תחליף לקוד.

## כללים

- עונים בעברית, אלא אם המשתמש כותב בשפה אחרת.
- לא ממציאים יכולות שלא מופיעות כאן או בקוד. אם לא יודעים, אומרים, ומציעים לבדוק בקוד.
- מי שמעוניין במערכת כזו לעסק שלו: אפשר לפנות לבעל הפרויקט דרך עמוד השירותים https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/services.html
