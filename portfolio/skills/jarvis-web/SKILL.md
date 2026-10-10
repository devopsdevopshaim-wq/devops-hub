---
name: jarvis-web
description: "JARVIS — עוזר רב־סוכנים (jarvis-web) — עוזר אישי בדפדפן שמפנה כל בקשה למחלקה המתאימה: מחקר, תכנון משימות, עזרה בקוד או דעה שנייה. Use when the user asks about \"JARVIS — עוזר רב־סוכנים\" or jarvis-web: what it does, how to use it, explaining it to someone, troubleshooting it, or changing and extending its code."
---

# JARVIS — עוזר רב־סוכנים

עוזר אישי בדפדפן שמפנה כל בקשה למחלקה המתאימה: מחקר, תכנון משימות, עזרה בקוד או דעה שנייה.

- כתובת: https://devopsdevopshaim-wq.github.io/jarvis-web/
- קוד: https://github.com/devopsdevopshaim-wq/jarvis-web
- תחום: סוכני AI
- עמוד הפרויקט בתיק העבודות: https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/#p/jarvis-web

## מה הוא יודע לעשות

- מחלקות סוכנים לפי סוג המשימה
- דעה שנייה מ־Claude
- חיבור ל־n8n דרך Webhook
- בדיקת חיבור והגדרות שנשמרות

## איך משתמשים

- מסכים וחלקים בעמוד: JARVIS · שלום, אני JARVIS · הגדרות חיבור
- כפתורים ופעולות: 🎙 התחילו שיחה קולית · ⌨ להקליד · 🎙 דיבור · 📞 שיחה רציפה · 🔊 קול · 💬 כתוביות · ⛶ מסך מלא · כל המחלקות · מחקר ומקורות · תכנון משימות · עזרה בקוד · דעה שנייה (Claude) · בדיקת חיבור · ביטול · שמירה

כשמסבירים למישהו: מתחילים מהמסך הראשון, ומתארים את הפעולות לפי הסדר שבו הן מופיעות.

## איך זה בנוי

- טכנולוגיות: JavaScript, n8n, AI agents
- שולח בקשות ל־Webhook של n8n, שמפעיל תהליכים אוטומטיים
- הקראה בקול (Web Speech)
- זיהוי דיבור
- שומר נתונים בדפדפן (localStorage) בלי שרת
- 7 קבצים, כ־157KB

קבצים עיקריים:

- `.nojekyll`
- `README.md`
- `face-mesh.json`
- `face.jpg`
- `face.js`
- `index.html`
- `tools/build-face.py`

פונקציות בקוד: `shader`, `load`, `clamp`, `TalkingFace`, `follow`, `base_pos`, `blinkSide`, `smooth`, `loadCfg`, `saveCfg`, `loadSession`, `newSession`, `uuid`, `webhookUrl`, `loadHistory`, `persist`, `mdToHtml`, `timeNow`, `addMsg`, `showTyping`, `hideTyping`, `extractReply`, `send`, `httpErrorHint`, `networkErrorHint`

## איך משנים ומפרסמים

- מורידים את הקוד: `git clone https://github.com/devopsdevopshaim-wq/jarvis-web.git`
- עורכים, ודוחפים ל־main. GitHub Pages מעדכן את האתר תוך דקה בערך.
- לפני כל שינוי קוראים את הקבצים עצמם. הרשימות כאן הן תקציר, לא תחליף לקוד.

## למה זה נבנה

במקום צ׳אט אחד שעושה הכול, JARVIS מחלק עבודה בין סוכנים שכל אחד טוב בדבר אחד.

## מתוך ה־README

# Jarvis עוזר אישי בדפדפן, בשיחת וידאו: פנים דוברות עם הבעות, קול, ומיקרופון. Site: https://devopsdevopshaim-wq.github.io/jarvis-web/ ## איך זה עובד - **הפנים**: `face.jpg` + `face-mesh.json` (רשת של 576 נקודות שנבנתה מהתמונה). `face.js` מזיז אותה ב־WebGL: לסת, שפתיים, שיניים, גבות, מצמוץ, חיוך, תנועת ראש ונשימה. הכול רץ בדפדפן, בחינם. - **הקול**: קול נשי בעברית מהדפדפן (Edge: Hila), ואם אין, מה־webhook `hasadna-voice` ב־n8n. הפה זז לפי הצליל עצמו (אנלייזר) או לפי המילים. - **ההבעות**: חיוך, גבות מורמות בשאלה, דאגה בהתנצלות, "חושב" בזמן המתנה, הנהון בסוף משפט. - **השיחה**: מיקרופון (זיהוי דיבור בעברית) ו"שיחה רציפה" ללא לחיצות. ## להחליף פנים ``` pip install mediapipe==0.10.14 opencv-python-headless scipy numpy python3 tools/build-face.py face.jpg face-mesh.json ``` תמונה חזיתית, פנים ברורות, פה סגור ועיניים פתוחות.

## כללים

- עונים בעברית, אלא אם המשתמש כותב בשפה אחרת.
- לא ממציאים יכולות שלא מופיעות כאן או בקוד. אם לא יודעים, אומרים, ומציעים לבדוק בקוד.
- מי שמעוניין במערכת כזו לעסק שלו: אפשר לפנות לבעל הפרויקט דרך עמוד השירותים https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/services.html
