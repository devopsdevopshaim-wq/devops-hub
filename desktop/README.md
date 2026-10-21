# פריים־סטודיו למחשב (Electron)

תוכנה להתקנה בווינדוס שמריצה את `frame-studio/` (הסטודיו) כחלון רגיל של תוכנה, גם בלי אינטרנט.

## הורדה

הקישור הקבוע לגרסה האחרונה (לשים באתר):

https://github.com/devopsdevopshaim-wq/devops-hub/releases/download/desktop-latest/FrameStudio-Setup.exe

ההתקנה לא חתומה דיגיטלית, לכן בפעם הראשונה Windows עלול להציג "Windows protected your PC".
לוחצים **More info** ואז **Run anyway**.

## איך זה עובד

- החלון טוען את `https://devopsdevopshaim-wq.github.io/devops-hub/frame-studio/studio.html`,
  אבל `main.js` מגיש כל קובץ תחת `/devops-hub/` מהעותק שנארז בתוך התוכנה (`app/devops-hub/`).
  כך הסטודיו עובד בלי רשת, והשרת (`spider-auth…workers.dev`) רואה את אותו Origin של האתר.
  קובץ שלא נארז (למשל סרטוני השיווק) נטען מהרשת.
- כל בקשה אחרת (גופנים, השרת, n8n, מדפסת מקומית ב־`http://localhost:17777`) עוברת לרשת כרגיל.
- ה־Service Worker (`sw.js`) חסום בתוכנה: עדכון מגיע רק עם התקנה חדשה.
- קישורים לאתרים אחרים נפתחים בדפדפן ברירת המחדל.
- לדפים זמין `window.FSDesktop`:
  `{ isDesktop: true, version, platform, machineId() }` — `machineId()` מחזיר SHA-256 (64 תווי hex) של מזהה המחשב
  (MachineGuid בווינדוס) עם מלח קבוע, אף פעם לא את המזהה עצמו.

## בנייה

הבנייה רצה אוטומטית ב־GitHub Actions (`.github/workflows/desktop-build.yml`) על כל שינוי ב־`desktop/` או `frame-studio/`
שנדחף ל־main, או ידנית (Run workflow). התוצאה:

- release בשם `desktop-v1.0.<מספר ריצה>` עם `FrameStudio-Setup-1.0.<n>.exe`
- release בשם `desktop-latest` עם `FrameStudio-Setup.exe` (מוחלף בכל ריצה)

בנייה מקומית (בווינדוס):

```bash
cd desktop
npm ci
npm run start      # מעתיק את האתר ומריץ את התוכנה
npm run dist:win   # בונה dist/FrameStudio-Setup-<version>.exe
```

`scripts/copy-app.mjs` מעתיק את `frame-studio/` ואת קבצי `portfolio/` שהדפים צריכים אל `app/devops-hub/`
(התיקייה לא נשמרת בגיט). רשימת הקבצים שלא נארזים נמצאת בראש הסקריפט.

הסמל (`build/icon.png`, `build/icon.ico`) נוצר מ־`frame-studio/icon.svg` עם `python3 scripts/make-icon.py` (Pillow).

## מנוע AI מקומי (בלי אינטרנט)

אפשרות להריץ את עריכות ה־AI של התמונות (`restyle` — עריכת תמונה, `image` — תמונה חדשה מתיאור) על המחשב של המשתמש,
עם [stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp) והמודל **FLUX.2 klein 4B** (אותו מודל שהשרת מריץ בענן).
פעולות טקסט (`ai`) ממשיכות לשרת כרגיל.

**איפה בתוכנה:** ☰ ← "🖥️ AI מקומי (בלי אינטרנט)", או הכרטיס "🖥️ AI מקומי" בראש לשונית AI.
בחלון: מצב ההתקנה (פסי התקדמות לכל קובץ), כרטיס המסך והמהירות הצפויה, התקנה / עצירה / הסרה, תמונת ניסיון,
ובחירת מצב (נשמר ב־`localStorage` בשם `fs-ai-mode`):

- **אוטומטי** (ברירת המחדל אחרי התקנה): ענן כשיש אינטרנט; מקומי כשאין רשת או כשהענן נכשל (שגיאת רשת, מכסה, timeout, כישלון AI).
- **תמיד מקומי**: שום תמונה לא יוצאת מהמחשב.
- **תמיד ענן**: כמו בלי המנוע.

גודל התמונה במחשב: 1024 (איכות, ברירת מחדל) או 768 (מהיר יותר) — `fs-ai-local-size`. כפתור "⏹ עצירה" עוצר גם הרצה מקומית.

### דרישות ומהירות

| | |
|---|---|
| מערכת | Windows 10/11 ‏x64 (גם Linux x64 ו־macOS ‏Apple Silicon נתמכים בקוד) |
| מקום בדיסק | כ־5.5GB (מודל התמונה ~2.5GB, מקודד הטקסט Qwen3‑4B ~2.5GB, VAE ~0.3GB, מנוע ~50MB) + 1GB פנוי בזמן ההתקנה |
| זיכרון | 16GB מומלץ (עובד עם 8–12GB, לאט) |
| כרטיס מסך עם 6GB+ (NVIDIA / AMD / Intel, דרך Vulkan) | **מהיר**: בערך 10–40 שניות לתמונה |
| כרטיס חלש / לא ידוע / בלי כרטיס (גרסת מעבד) | **איטי**: כמה דקות לתמונה |

ההתקנה צריכה אינטרנט פעם אחת; אחר כך הכול עובד בלי רשת.

### איך זה בנוי

- `local-ai.js` — כל הלוגיקה, Node רגיל בלי Electron (אפשר לבדוק אותו לבד). `main.js` רק מחבר אותו ל־IPC,
  ו־`preload.js` חושף `window.FSDesktop.localAI = { status, gpuInfo, install(onProgress, {variant}), cancelInstall, remove, run(o, onProgress), cancel }`.
  ה־IPC עונה רק לדפים של הסטודיו (`event.senderFrame.url` מתחיל ב־`.../devops-hub/frame-studio/`), והדף מעביר רק ערכים פשוטים:
  אין לו דרך להעביר נתיב קובץ או ארגומנט לתוכנה.
- קבצים: `<userData>/local-ai/` (בווינדוס `%APPDATA%\Frame Studio\local-ai\`): `engine/`, `models/`, `manifest.json`, ובזמן הורדה `downloads/*.part`.
- **גילוי הקבצים בזמן ההתקנה** (לא שמות קבועים בקוד):
  - מנוע: `https://api.github.com/repos/leejet/stable-diffusion.cpp/releases/latest`, הקובץ `*-bin-win-vulkan-x64.zip`
    (ואם אין GPU שעובד — `*-bin-win-cpu-x64.zip`, ובגרסאות ישנות `*-bin-win-avx2-x64.zip`). אחרי הפתיחה מריצים `sd-cli --list-devices`;
    אם Vulkan לא רואה כרטיס, מותקנת אוטומטית גרסת המעבד. בחלון יש גם מעבר ידני בין הגרסאות (המודלים נשארים).
  - מודלים: דרך ה־API של Hugging Face (`/api/models/<repo>/tree/main?recursive=true`), נבחר הקובץ לפי תבנית:
    `leejet/FLUX.2-klein-4B-GGUF` (העדפה Q4_K_M → Q4_K_S → Q4_K → Q4_0 → Q5…), `unsloth/Qwen3-4B-GGUF` (Q4_K_M, לא UD),
    ו־VAE מהראשון שמופיע ונותן להוריד מתוך: `leejet/FLUX.2-klein-4B-GGUF`, `Comfy-Org/flux2-klein-4B`, `Comfy-Org/flux2-klein`,
    `Comfy-Org/flux2-dev` (‏`split_files/vae/`), `black-forest-labs/FLUX.2-klein-4B`, `black-forest-labs/FLUX.2-dev` (שני האחרונים חסומים בלי טוקן).
  - הורדה עם המשך (HTTP Range) אחרי עצירה או ניתוק, בדיקת גודל מול ה־API ובדיקת SHA‑256 (ה־`lfs.oid` של Hugging Face, ה־`digest` של GitHub).
  - אם קובץ לא נמצא, החלון מציג "לא נמצא…" עם רשימת המקומות שנבדקו.
- **ההרצה** (`execFile`/`spawn` בלי shell, תמונה אחת בכל פעם, תור, עצירה הורגת את התהליך, מקסימום 15 דקות):

  ```
  sd-cli --diffusion-model <models>/flux-2-klein-4b-Q4_K.gguf --vae <models>/flux2-vae.safetensors --llm <models>/Qwen3-4B-Q4_K_M.gguf
         -p "<prompt>" --cfg-scale 1.0 --sampling-method euler --steps 4 -W <w> -H <h> --seed <n> -o <tmp>/out.png
         [-r <tmp>/in.jpg]            # עריכת תמונה
         [--offload-to-cpu]           # כשזיכרון המסך פחות מ־10GB או לא ידוע
         [--vae-tiling]               # כשזיכרון המסך פחות מ־8GB או לא ידוע
  ```
  אם הכרטיס נגמר לו הזיכרון, ההרצה חוזרת פעם אחת עם `--offload-to-cpu --vae-tiling`. ההתקדמות נקראת מהשורות של sd.cpp
  (`2/4 - 3.21s/it`) ומוצגת בשלט "AI מקומי… 45%".
- בדיקות (בלי Electron, בלי רשת; Linux/macOS): `npm run test:local-ai` — שרת דמה ל־GitHub/Hugging Face ו־`test/fake-sd-cli.js` במקום sd-cli.

### רישיונות

FLUX.2 klein 4B ו־Qwen3‑4B — ‏Apache‑2.0 (מותר לשימוש מסחרי). stable-diffusion.cpp ו־ggml — ‏MIT.
הקבצים לא נארזים בתוכנה: הם יורדים ישירות מ־Hugging Face ו־GitHub אל מחשב המשתמש.
