---
name: translate-dub
description: "VocalizePro — תרגום ודיבוב (translate-dub) — מתרגם טקסט ומקריא אותו בקול, עם אווטאר מדבר שבוחרים לו דמות וקול. Use when the user asks about \"VocalizePro — תרגום ודיבוב\" or translate-dub: what it does, how to use it, explaining it to someone, troubleshooting it, or changing and extending its code."
---

# VocalizePro — תרגום ודיבוב

מתרגם טקסט ומקריא אותו בקול, עם אווטאר מדבר שבוחרים לו דמות וקול.

- כתובת: https://devopsdevopshaim-wq.github.io/translate-dub/
- קוד: https://github.com/devopsdevopshaim-wq/translate-dub
- תחום: כלים ומחשבונים
- עמוד הפרויקט בתיק העבודות: https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/#p/translate-dub

## מה הוא יודע לעשות

- תרגום טקסט
- אווטאר מדבר עם בחירת דמות
- בחירת קול ובקרת השמעה
- העתקה, הדפסה ושמירה

## איך משתמשים

- מסכים וחלקים בעמוד: VocalizePro · הזן טקסט לתרגום · בחר דמות מדובבת: · בחר קול: · אפשרויות נוספות · תוצאות התרגום · אווטאר מדבר · תרגום: · בקרת השמעה · VocalizePro - תרגום
- כפתורים ופעולות: תרגם והשמע · עצור · העתק · הדפס · שמור · האזן לדוגמה

כשמסבירים למישהו: מתחילים מהמסך הראשון, ומתארים את הפעולות לפי הסדר שבו הן מופיעות.

## איך זה בנוי

- טכנולוגיות: JavaScript, Web Speech
- מריץ פעולות מתוזמנות בדפדפן (setInterval)
- הקראה בקול (Web Speech)
- 9 קבצים, כ־454KB, 7 גרסאות HTML

קבצים עיקריים:

- `.nojekyll`
- `README.md`
- `index.html`
- `‏‏‏‏translate1.html`
- `‏‏‏‏translate2.html`
- `‏‏‏‏translate3.html`
- `‏‏‏‏translate4.html`
- `‏‏‏‏translate5.html`
- `‏‏‏‏translate6.html`

פונקציות בקוד: `init`, `showNotification`, `updateSpeedValue`, `updatePitchValue`, `setupAvatarSelection`, `updateAvatarPreview`, `resetAvatarPreview`, `updateAvatarDisplay`, `setupVoiceSelection`, `loadVoices`, `findQualityVoice`, `translateText`, `textToSpeech`, `startProgressTracking`, `stopProgressTracking`, `updateProgressBar`, `formatTime`, `copyToClipboard`, `printTranslatedText`, `setupEventListeners`, `findVoice`

## איך משנים ומפרסמים

- מורידים את הקוד: `git clone https://github.com/devopsdevopshaim-wq/translate-dub.git`
- עורכים, ודוחפים ל־main. GitHub Pages מעדכן את האתר תוך דקה בערך.
- לפני כל שינוי קוראים את הקבצים עצמם. הרשימות כאן הן תקציר, לא תחליף לקוד.

## כללים

- עונים בעברית, אלא אם המשתמש כותב בשפה אחרת.
- לא ממציאים יכולות שלא מופיעות כאן או בקוד. אם לא יודעים, אומרים, ומציעים לבדוק בקוד.
- מי שמעוניין במערכת כזו לעסק שלו: אפשר לפנות לבעל הפרויקט דרך עמוד השירותים https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/services.html
