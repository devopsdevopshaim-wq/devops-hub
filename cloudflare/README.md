# שרת הכניסה על Cloudflare Workers

מחליף את תהליך ה־n8n "SPIDER · כניסה והרשאות": אותו קוד בדיוק (נבנה מ־`n8n/hasadna-access.json` ע"י `build.mjs`), רק שהוא רץ על Cloudflare Workers.
בתוכנית החינמית אין מכסה חודשית של הרצות (עד 100,000 בקשות ביום), והשרת לא נרדם. המצב (לקוחות, כניסות, סטטיסטיקות, תכנית, כספת) נשמר ב־Durable Object אחד, ובקשה אחת בכל רגע, כמו ב־n8n.

## הקמה, פעם אחת
1. חשבון חינמי ב־https://dash.cloudflare.com (הרשמה בלי כרטיס אשראי).
2. טוקן: My Profile ← API Tokens ← Create Token ← התבנית **Edit Cloudflare Workers**. את מזהה החשבון (Account ID) רואים בעמוד Workers & Pages.
3. ב־GitHub, Settings ← Secrets and variables ← Actions, מוסיפים: `CLOUDFLARE_API_TOKEN` ו־`CLOUDFLARE_ACCOUNT_ID`.
4. מיילים (סיסמה ראשונית ללקוחות, התראות): חשבון חינמי ב־https://www.brevo.com ← SMTP & API ← API key, ואימות כתובת שולח (Senders) לכתובת ה־Gmail. סודות: `BREVO_API_KEY` ו־`MAIL_FROM` (הכתובת שאומתה). חלופה: `RESEND_API_KEY`.
5. הסוד `ADMIN_PASSWORD` (לפחות 8 תווים) קובע את סיסמת המנהל, בדיוק כמו ב־n8n. אפשר גם `ADMIN_TOTP_SECRET`.
6. מריצים את ה־Action **Deploy sign-in server to Cloudflare** (Run workflow). הוא בונה, בודק מול workerd מקומי, מפרוס, מגדיר סודות, בודק שהשרת עונה, וכותב את `portfolio/api.json`. מאותו רגע האתר מדבר עם Cloudflare.
7. מעבירים לקוחות: `portfolio/migrate.html` (ייצוא מהשרת הישן, ייבוא לחדש). הסיסמאות לא עוברות: כל לקוח לוחץ "קבלת סיסמה ראשונית למייל".

## עלות סיסמאות
תוכנית Workers החינמית נותנת כ־10ms CPU לבקשה, ולכן הסיסמאות נשמרות עם PBKDF2 של 10,000 סבבים (`PBKDF2_ITER`). בתוכנית בתשלום (5$ לחודש) אפשר להעלות ל־210,000 כמו ב־n8n.

## פיתוח מקומי
```
cd cloudflare && npm ci && node build.mjs
echo "ADMIN_PASSWORD_HASH=$(node test/hash.mjs 'Test-Passw0rd-xyz')" > .dev.vars
npx wrangler dev --local --port 8787 &
node test/worker.test.mjs
```
