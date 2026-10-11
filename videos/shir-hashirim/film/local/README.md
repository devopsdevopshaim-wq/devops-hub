# שיר השירים: הפקת הסרט במחשב שלך, בחינם

כל השוטים נוצרים במחשב שלך עם **Wan**, מודל וידאו פתוח וחינמי. אין מנוי, אין מפתח ואין תשלום לשנייה.

## מה צריך
- **כרטיס גרפי של NVIDIA.** 8 GB זיכרון גרפי מספיקים למודל הבסיסי, ו-24 GB נדרשים למודל החד יותר.
- **Windows או Linux**, ובערך 30 GB פנויים בדיסק בשביל המודל והשוטים.
- **התוכנות:** [Python 3.10 ומעלה](https://www.python.org/downloads/), [Node.js 18 ומעלה](https://nodejs.org), [Git](https://git-scm.com) ו-[ffmpeg](https://ffmpeg.org/download.html).

בלי כרטיס NVIDIA זה לא יעבוד. במקרה כזה, הדרך החינמית היא הקרדיטים היומיים באתרים כמו hailuoai.video ו-klingai.com.

## התקנה, פעם אחת
```
git clone https://github.com/devopsdevopshaim-wq/devops-hub.git
cd devops-hub/videos/shir-hashirim/film/local
pip install torch --index-url https://download.pytorch.org/whl/cu124
pip install diffusers transformers accelerate ftfy imageio imageio-ffmpeg sentencepiece
```

## הפקה
```
python wan_generate.py --chapter 1 --limit 2     # שני שוטים ראשונים כדי לראות את המראה
python wan_generate.py --chapter 1               # כל פרק א' (23 שוטים)
```
- בהפעלה הראשונה המודל יורד מהאינטרנט, בערך 15 GB למודל הבסיסי.
- **זמנים:** בכרטיס כמו RTX 3060 או 4060, שוט אחד לוקח בערך 4–8 דקות. פרק שלם לוקח כמה שעות, אז אפשר להשאיר את המחשב לעבוד בלילה. אם עוצרים באמצע, ההפעלה הבאה ממשיכה מאותה נקודה.
- **אם הזיכרון הגרפי נגמר:** מוסיפים `--low-memory`.
- **מודל חד יותר:** `--model wan2.2-5b` מפיק ב-720p, וצריך בערך 24 GB זיכרון גרפי.

## עריכה והוצאת הסרט
מתיקיית `videos/shir-hashirim`:
```
set CLIP_SECONDS=5            (ב-Linux/Mac:  export CLIP_SECONDS=5)
node film/edit.mjs 1
npx hyperframes render film/chapters/chapter-1 -o renders/film-1.mp4
```
אפשר גם לשלוח לי את תיקיית `film/clips/chapter-1`, ואני אערוך ואוציא את הפרק.

## מה לצפות
- Wan מפיק סרטון בלי סאונד, ברזולוציה נמוכה יותר מ-Veo. כל קטע הוא באורך 5 שניות, ולכן לכל פסוק יש 1–3 שוטים. בסך הכול 199 שוטים, ו-23 מהם בפרק א'.
- הדמויות מתוארות באותן מילים בכל שוט, אבל הפנים לא יהיו זהים לגמרי בין השוטים. המודל החינמי מפיק איכות פחות טובה ממודלים בתשלום.
- הרשימה המלאה של השוטים נמצאת ב-`film/prompts.json`. אם משנים את `film/shots.mjs`, צריך להריץ `CLIP_SECONDS=5 node film/export-prompts.mjs`.
