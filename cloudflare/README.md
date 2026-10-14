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

## מה עוד רץ שם (גיבוי מלא ל־n8n)
אותו Worker מגיש גם את שאר נקודות הקצה שהיו ב־n8n, מאותו קוד: `hasadna-lead` / `hasadna-prices` / `hasadna-admin` (לידים ומחירון), `hasadna-hubs` (ה־AI ונתוני השוק של האתרים העצמאיים), `comic-draw` (סטודיו הקומיקס) ו־`hasadna-voice` (הקול של מאיה). לכל שירות מצב משלו.
האתר קורא קודם ל־Cloudflare ואם אין תשובה (שגיאה, 404, 5xx) עובר אוטומטית ל־n8n (`portfolio/js/failover.js`, והכניסה ב־`auth.js`). אפשר לכבות כל אחד מהשרתים והאתר ממשיך.
סודות נוספים שהפריסה מעבירה אם קיימים: `GEMINI_API_KEY`, `OPENAI_API_KEY`, `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION`, `ELEVENLABS_API_KEY`.
שים לב: הלידים והלקוחות נשמרים בכל שרת בנפרד. מה שנכנס כשהאתר עבד מול שרת אחד נשאר בו.
מאיה (`hasadna-guide`) עונה בשיחה אחת עם Claude (במקום צוות הסוכנים של n8n) ומקבלת את כל המידע על הפרויקטים; הצריך סוד `ANTHROPIC_API_KEY`. בדיקת הזמינות (`hasadna-status`) רצה כל שעתיים (Cron Trigger), שומרת את התוצאה ומגישה את עמוד הבקרה.
לא עברו: סוכני Parkomat (כלים של Claude, קבצים ל־Drive/Slack); הם נשארים ב־n8n.

## Clients' mailboxes (Gmail)

`src/mail.mjs` gives every signed-in client a mailbox panel on the portfolio home page: a pill shows the unread count, the panel filters
(personal, bills & receipts, promotions, social, updates, attachments, unread, starred, own folders), and the client deletes (Gmail trash,
recoverable for 30 days), keeps, marks read, or moves messages to folders of their own (Gmail labels `SPIDER/<name>`), and writes rules
that sort what arrives. Nothing is sent and nothing is deleted for good. Refresh tokens are kept AES-GCM encrypted in the Durable Object.

One-time setup (the secrets GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, optional MAIL_KEY, go in the repository secrets; the deploy sets them):
1. Google Cloud Console → a project → APIs & Services → enable **Gmail API**.
2. OAuth consent screen: User type External; add the scopes `gmail.modify` and `userinfo.email`; while the app is in *Testing* add each client's Gmail
   address under Test users (up to 100; Google expires the permission every 7 days in this mode, so a client reconnects weekly). To remove both
   limits publish the app: Google reviews restricted scopes like `gmail.modify` (a security assessment).
3. Credentials → Create OAuth client ID → Web application → Authorized redirect URI:
   `https://spider-auth.devopsdevopshaim.workers.dev/hasadna-mail-callback`
4. Copy the client id and secret into the repository secrets, then run the "Cloudflare deploy" workflow.

## Live video avatar (HeyGen)

`hasadna-heygen` mints short-lived HeyGen streaming tokens for signed-in visitors (6 sessions an hour each); the API key stays on the server.
Set the repository secrets `HEYGEN_API_KEY` (and optionally `HEYGEN_AVATAR_ID`, `HEYGEN_VOICE_ID`), then run "Cloudflare deploy". The portfolio
shows "🎥 שיחת וידאו" in Maya's chat only when the key exists; the call ends when the chat closes or after five idle minutes.
