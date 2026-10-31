---
name: lotto
description: "Lotto Predictor (lotto) — מאגר תוצאות לוטו עם חיזוי מבוסס משקלים שאפשר לכוונן, גרפים וייבוא וייצוא. Use when the user asks about \"Lotto Predictor\" or lotto: what it does, how to use it, explaining it to someone, troubleshooting it, or changing and extending its code."
---

# Lotto Predictor

מאגר תוצאות לוטו עם חיזוי מבוסס משקלים שאפשר לכוונן, גרפים וייבוא וייצוא.

- כתובת: https://devopsdevopshaim-wq.github.io/lotto/
- קוד: https://github.com/devopsdevopshaim-wq/lotto
- תחום: לוטו
- עמוד הפרויקט בתיק העבודות: https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/#p/lotto

## מה הוא יודע לעשות

- מאגר הגרלות עם ייבוא CSV ו־JSON
- חיזוי לפי משקלים מכווננים
- גרפי שכיחות
- ייצוא נתונים

## איך משתמשים

- מסכים וחלקים בעמוד: טוען נתונים… · מנוע התחזיות · התחזית להגרלה הקרובה · דירוג כל 37 המספרים · טפסים לפי המודל · טופס שיטתי · תחזית מול תוצאה · השוואת כל המודלים · טפסים ועלות · יש לי תקציב · הוספת טופס · מחירון · יומן הניחושים וניסיון לפצח · מעבדת אלגוריטמים
- כפתורים ופעולות: הגרלה · טפסים · ניתוח · אלגוריתמים · נתונים · תחזית · טפסים ועלות · מחולל טפסים · בדיקת טופס · סקירה · שכיחות · פערים · זוגות · התפלגויות · אלגוריטמים · בדיקה לאחור · יומן ופיצוח · ▶ הדמיית ההגרלה

כשמסבירים למישהו: מתחילים מהמסך הראשון, ומתארים את הפעולות לפי הסדר שבו הן מופיעות.

## איך זה בנוי

- טכנולוגיות: JavaScript, Chart.js, Bootstrap, PapaParse
- יש GitHub Actions שרצים אוטומטית
- מריץ פעולות מתוזמנות בדפדפן (setInterval)
- ייבוא וייצוא אוטומטי של קבצי Excel
- הקראה בקול (Web Speech)
- שומר נתונים בדפדפן (localStorage) בלי שרת
- 11 קבצים, כ־456KB, 2 גרסאות HTML

קבצים עיקריים:

- `.github/workflows/update-results.yml`
- `.github/workflows/voice.yml`
- `.gitignore`
- `.nojekyll`
- `README.md`
- `index.html`
- `lotto.csv`
- `lotto.html`
- `scripts/make_voice.py`
- `scripts/update_results.py`
- `scripts/voice_texts.mjs`

פונקציות בקוד: `lnGamma`, `gammaQ`, `shuffle`, `decodeBuffer`, `splitCsvLine`, `toISO`, `mkDraw`, `rowToDraw`, `parseCsv`, `parseXlsx`, `parseJson`, `rebuild`, `saveUser`, `loadUser`, `stats`, `toast`, `chart`, `drawChart`, `barChart`, `renderAll`, `applyA11y`, `pickVoice`, `hashText`, `loadVoiceManifest`, `useAzure`

## איך משנים ומפרסמים

- מורידים את הקוד: `git clone https://github.com/devopsdevopshaim-wq/lotto.git`
- עורכים, ודוחפים ל־main. GitHub Pages מעדכן את האתר תוך דקה בערך.
- לפני כל שינוי קוראים את הקבצים עצמם. הרשימות כאן הן תקציר, לא תחליף לקוד.

## מתוך ה־README

# לוטו · מרכז ניתוח Site: https://devopsdevopshaim-wq.github.io/lotto/ ניתוח סטטיסטי של תוצאות הלוטו (הפורמט הנוכחי: 37 מספרים + חזק 1–7, מאז מרץ 2011): שכיחויות ומבחן חי בריבוע, פערים, זוגות ושלישיות, התפלגויות מול התאוריה, בדיקה לאחור של שיטות "חיזוי", מחולל טפסים ובדיקת טופס מול כל ההיסטוריה. ## עדכון התוצאות האתר טוען את `lotto.csv` אוטומטית. הקובץ מתעדכן לבד: ה־workflow `.github/workflows/update-results.yml` מריץ את `scripts/update_results.py` בלילה שאחרי כל הגרלה ובבוקר שלמחרת. הסקריפט מושך את ההגרלות החדשות מ־paisresults.co.il, מצליב אותן מול lottoplus.co.il, ועוצר בלי לכתוב אם יש אי־התאמה או הגרלה חסרה. אפשר גם להריץ אותו ידנית מלשונית Actions (Run workflow). מספרי הזוכים לא מופיעים במקורות האלה, ולכן בהגרלות שנוספו אוטומטית העמודות האלה ריקות. גיבוי ידני: בעמוד "נתונים" אפשר לגרור קובץ CSV/Excel, להדביק שורות או להוסיף הגרלה. ## הקראה בקול של הילה (Azure) ההקראה באתר משתמשת בהקלטות של הקול העצבי `he-IL-HilaNeural` של Microsoft Azure, כשהן קיימות. ה־workflow ‏`.github/workflows/voice.yml` רץ אחרי כל עדכון תוצאות: `scripts/voice_texts.mjs` פותח את האתר בדפדפן ושומר את טקסטי ההקראה ב־`voice/texts.json`, ו־`scripts/make_voice.py` מקליט רק טקסטים שהשתנו, שומר אותם כ־MP3 בתיקייה

## כללים

- עונים בעברית, אלא אם המשתמש כותב בשפה אחרת.
- לא ממציאים יכולות שלא מופיעות כאן או בקוד. אם לא יודעים, אומרים, ומציעים לבדוק בקוד.
- מי שמעוניין במערכת כזו לעסק שלו: אפשר לפנות לבעל הפרויקט דרך עמוד השירותים https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/services.html
