---
name: assembly-studio
description: "מכלול — סטודיו הרכבה (assembly-studio) — מעלים קבצי SolidWorks ומתארים את המערכת, ומקבלים תכנית הרכבה, סרטון הרכבה, שרטוטים ותיק הרכבה עם חלקי חילוף. Use when the user asks about \"מכלול — סטודיו הרכבה\" or assembly-studio: what it does, how to use it, explaining it to someone, troubleshooting it, or changing and extending its code."
---

# מכלול — סטודיו הרכבה

מעלים קבצי SolidWorks ומתארים את המערכת, ומקבלים תכנית הרכבה, סרטון הרכבה, שרטוטים ותיק הרכבה עם חלקי חילוף.

- כתובת: https://devopsdevopshaim-wq.github.io/devops-hub/assembly-studio/
- קוד: https://github.com/devopsdevopshaim-wq/devops-hub
- הקוד יושב בתיקייה `assembly-studio/` במאגר https://github.com/devopsdevopshaim-wq/devops-hub
- תחום: אתרים ומערכות
- עמוד הפרויקט בתיק העבודות: https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/#p/assembly-studio

## מה הוא יודע לעשות

- קריאת STEP, STL, OBJ ו-GLB עם רשימת חלקים אוטומטית
- Claude בונה סדר הרכבה, מומנטים וחלקי חילוף
- סרטון הרכבה מונפש להורדה ושרטוטי A3 עם בלונים
- כל תכנית פותחת משימה בלוח משימות

## איך זה בנוי

- טכנולוגיות: JavaScript, Three.js, Claude API, OpenCascade

## איך משנים ומפרסמים

- מורידים את המאגר: `git clone https://github.com/devopsdevopshaim-wq/devops-hub.git` ועובדים בתיקייה `assembly-studio/`.
- כל שינוי שנדחף ל־main מתפרסם לבד ל־GitHub Pages תוך כ־2 דקות (Action: Deploy vacation-hub to GitHub Pages).
- לפני כל שינוי קוראים את הקבצים עצמם. הרשימות כאן הן תקציר, לא תחליף לקוד.

## למה זה נבנה

מהנדסים מבזבזים ימים על הוראות הרכבה אחרי שהמודל כבר גמור. מכלול לוקח את המודל ומוציא ממנו את כל מה שהטכנאי צריך ברצפת הייצור.

## כללים

- עונים בעברית, אלא אם המשתמש כותב בשפה אחרת.
- לא ממציאים יכולות שלא מופיעות כאן או בקוד. אם לא יודעים, אומרים, ומציעים לבדוק בקוד.
- מי שמעוניין במערכת כזו לעסק שלו: אפשר לפנות לבעל הפרויקט דרך עמוד השירותים https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/services.html
