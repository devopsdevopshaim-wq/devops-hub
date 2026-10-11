# שיר השירים: פרומפטים ל-Veo 3, רקע לכל פרק

רקע וידאו של 8 שניות לכל פרק, ביחס 9:16, שמתאים לסרטוני הפסוקים. רק נופים, בלי דמויות ובלי טקסט, מתוך כבוד לטקסט.
הקטע יוצג כהה ומעומעם מאחורי הפסוקים, ולכן הפרומפטים מבקשים תמונה רגועה וכמעט סטטית, שנראית טוב גם בלולאה.

הפקה (כשיש `GEMINI_API_KEY`), למשל לפרק א':
```
node .claude/skills/veo3/scripts/veo3.mjs --aspect 9:16 --negative "people, faces, text, watermark, logo" \
  --out videos/shir-hashirim/assets/bg/chapter-1.mp4 --prompt "<הפרומפט של פרק א'>"
```

## פרק א': כרמים ואוהלי קדר
```
Static wide shot at dusk, slow gentle push-in, terraced vineyards on golden Judean hills, a few dark goat-hair tents in the distance, warm amber sunset light fading to deep blue, soft haze, cinematic, natural colors, calm and reverent mood, no people. Audio: light evening wind, distant crickets, a very soft sustained string drone.
```

## פרק ב': חבצלת השרון ושושנת העמקים
```
Macro shot, slow dolly-in across a field of white lilies and red anemones in a valley at first light, dew drops glistening, an apple tree in soft focus behind, shallow depth of field, gentle breeze moving petals, cinematic, warm and tender mood, no people. Audio: soft birdsong, light breeze, gentle harp notes.
```

## פרק ג': מדבר ותמרות עשן
```
Wide aerial drone shot slowly gliding over golden desert dunes at dawn, thin columns of incense-like smoke rising in the distance into still air, warm pink and gold sky, cinematic, majestic and quiet mood, no people. Audio: soft desert wind, a deep calm ambient pad.
```

## פרק ד': הר המור וגבעת הלבונה, גן נעול
```
Slow tracking shot through a walled ancient garden at golden hour, pomegranate trees, spice plants and a small stone spring with clear flowing water, cedar trees of Lebanon on mountains beyond, rich greens and gold, cinematic, serene mood, no people. Audio: trickling spring water, birds, soft flute.
```

## פרק ה': אני ישנה ולבי ער
```
Static shot at night, slow push-in toward an old wooden door in a stone courtyard in Jerusalem, moonlight and dew on the stones, a single warm lamp glow from a window, deep blue tones, cinematic, quiet longing mood, no people. Audio: night crickets, a soft distant breeze, a single sustained cello note.
```

## פרק ו': יפה כלבנה, ברה כחמה
```
Time-lapse feel, slow camera tilt up from a valley of blossoming nut trees and vines to a bright full moon rising over a dark ridge, then first sunlight touching the clouds, silver and gold palette, cinematic, awe-filled mood, no people. Audio: gentle night ambience turning to dawn birdsong, soft choir hum.
```

## פרק ז': תמר ואשכולות
```
Slow orbit around a tall date palm heavy with golden clusters, beside pools of still water reflecting the evening sky like the pools of Heshbon, vineyards and pomegranates nearby, warm golden-hour light, cinematic, peaceful mood, no people. Audio: soft breeze in palm fronds, water lapping, gentle oud melody.
```

## פרק ח': מים רבים לא יוכלו לכבות את האהבה
```
Slow push-in on a single steady flame of an oil lamp on a stone ledge, with a vast calm sea and rolling waves behind it at twilight, the flame never wavering, spice-covered mountains on the horizon, deep blue and warm gold, cinematic, strong and eternal mood, no people. Audio: deep slow ocean waves, a soft steady fire crackle, a warm sustained string chord.
```

## איך מחברים את הרקע לסרטון
שמים את הקובץ ב-`assets/bg/chapter-N.mp4`, מוסיפים לתבנית ב-`build.mjs`, מעל `.bg`, את השורה
`<video id="bgv" src="assets/bg/chapter-N.mp4" muted data-start="0" data-duration="<אורך>" data-playback-rate="0.5">`
עם שקיפות 0.35. מריצים שוב `node build.mjs` ואז מפיקים מחדש.
הקטע הוא 8 שניות, ולכן כדאי להפיק 2–3 קטעים לכל פרק ולחבר אותם עם מעבר רך.
