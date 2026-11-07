---
name: astrology-decoder
description: "פענוח אסטרולוגי (astrology-decoder) — מחשב מפת לידה מדויקת עם גלגל, בתים והיבטים, ומשווה אותה לטרנזיטים של השמיים עכשיו. Use when the user asks about \"פענוח אסטרולוגי\" or astrology-decoder: what it does, how to use it, explaining it to someone, troubleshooting it, or changing and extending its code."
---

# פענוח אסטרולוגי

מחשב מפת לידה מדויקת עם גלגל, בתים והיבטים, ומשווה אותה לטרנזיטים של השמיים עכשיו.

- כתובת: https://devopsdevopshaim-wq.github.io/astrology-decoder/%D7%A4%D7%A2%D7%A0%D7%95%D7%97-%D7%90%D7%A1%D7%98%D7%A8%D7%95%D7%9C%D7%95%D7%92%D7%99-%D7%9E%D7%A9%D7%95%D7%A4%D7%A8.html
- קוד: https://github.com/devopsdevopshaim-wq/astrology-decoder
- תחום: סוכני AI
- עמוד הפרויקט בתיק העבודות: https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/#p/astrology-decoder

## מה הוא יודע לעשות

- גלגל מפה ומיקומי כוכבים ובתים
- היבטים, יסודות ומופע ירח
- טרנזיטים חיים מול מפת הלידה
- תחזיות יומיות עד שנתיות והדפסה

## איך משתמשים

- מסכים וחלקים בעמוד: פענוח אסטרולוגי מדויק · נתוני לידה · גלגל המפה · מיקומי כוכבים ובתים · היבטים במפה · איזון יסודות ואיכויות · מופע ירח · נומרולוגיה · טרנזיטים — השמיים עכשיו מול מפת הלידה · תחזיות ופירוש
- כפתורים ופעולות: חשב מפה אסטרולוגית ✨ · הדפסה 🖨️ · העתק JSON · יומי · שבועי · חודשי · שנתי · תחומים

כשמסבירים למישהו: מתחילים מהמסך הראשון, ומתארים את הפעולות לפי הסדר שבו הן מופיעות.

## איך זה בנוי

- טכנולוגיות: JavaScript, SVG, Node.js
- יש שרת צד־שרת משלו
- שולח בקשות ל־Webhook של n8n, שמפעיל תהליכים אוטומטיים
- 5 קבצים, כ־67KB, 2 גרסאות HTML

קבצים עיקריים:

- `.nojekyll`
- `README.md`
- `index.html`
- `server.mjs`
- `פענוח-אסטרולוגי-משופר.html`

פונקציות בקוד: `showErr`, `clearErr`, `renderWheel`, `renderBigThree`, `renderPlanets`, `renderAspects`, `renderBalance`, `renderTransits`, `renderForecast`, `renderAIReading`, `catName`, `localReading`, `relevance`, `toneAdvice`, `copyJSON`, `fmtDeg`, `dayNumber`, `elements`, `eccentricAnomaly`, `heliocentric`, `sunPosition`, `moonPosition`, `planetPosition`, `plutoPosition`, `longitudeOf`

## איך משנים ומפרסמים

- מורידים את הקוד: `git clone https://github.com/devopsdevopshaim-wq/astrology-decoder.git`
- עורכים, ודוחפים ל־main. GitHub Pages מעדכן את האתר תוך דקה בערך.
- לפני כל שינוי קוראים את הקבצים עצמם. הרשימות כאן הן תקציר, לא תחליף לקוד.

## כללים

- עונים בעברית, אלא אם המשתמש כותב בשפה אחרת.
- לא ממציאים יכולות שלא מופיעות כאן או בקוד. אם לא יודעים, אומרים, ומציעים לבדוק בקוד.
- מי שמעוניין במערכת כזו לעסק שלו: אפשר לפנות לבעל הפרויקט דרך עמוד השירותים https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/services.html
