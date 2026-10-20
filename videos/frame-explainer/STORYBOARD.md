---
format: 1920x1080
duration: 60s
message: "מגנט מעוצב מהאירוע שלכם, ביד של כל אורח תוך דקה, בלי שום טרחה"
arc: BAB with a 4-step bridge (before → after tease → bridge/product → step 1…4 → wow → CTA)
audience: זוגות ומשפחות שמתכננים חתונה, בר/בת מצווה, ברית או אירוע חברה
mode: autonomous
music: none
---

## Video direction

- **No narration.** Each frame's "voiceover" is the ON-SCREEN Hebrew text; "|" separates cues, and each cue is its own
  reveal. Music: a host-made 104 bpm bed (one beat ≈ 0.577s) in assets/music.m4a.
- **Palette (frame.md):** cream paper #fbf6ee is the main canvas (warm, like the site); ink #1d1633 plum for headlines and
  for the two "night" frames (Frame 1 hook, Frame 6 AI wow) so photos glow; gold #c9a45c / ember #e3c98e is the one accent:
  sun-bloom behind heroes, hairline rules, step numbers, check marks. Never purple-blue AI gradients.
- **Type:** display = Frank Ruhl Libre (Hebrew headlines), body = Heebo (labels, chips, step text), numbers/phone in Heebo
  500 tabular. Hebrew RTL everywhere (`dir="rtl"`).
- **Recurring device — the 4 steps:** a slim step rail at the top-right of Frames 3–6 shows ① מתאמים ② מעצבים ③ מצלמים ④ מדביקים;
  the current step lights gold, previous steps show a gold check. Same position, same size in every frame (handoff).
- **Screens:** real screenshots are shown inside clean device frames (a laptop-style rounded window with a thin bezel, or a
  phone with rounded corners), floating with a soft shadow on the paper, slightly tilted in 3D for depth — never full-bleed flat.
- **Motion grammar:** power3 long-tail, smooth; every element enters on its cue; one camera move per frame at most and only in
  the first half; no breathing, no back-half pans, no repeat/yoyo, no randomness.
- **Rhythm:** Frame 2 (the promise) and Frame 8 (CTA) are held reads; Frame 6 is the energetic climax (fast style swaps on the beat).
- **Negative list:** no slideshow dump, no screensaver float, no bounce, no real cursors/browser chrome beyond the clean device
  frame, no other company names, no invented prices or features.
- Content in the top ~83%.

## Frame 1 — The moment
- src: compositions/frames/01-moment.html
- type: hook
- duration: 6s
- transition_in: cut
- status: animated
- scene: Magnets fall onto a dark field one by one, each a real event magnet; line "הרגע הכי יפה באירוע" then "…על המקרר שלהם לשנים."
- voiceover: "הרגע הכי יפה באירוע | על המקרר של כל אורח. לשנים."
- asset_candidates: capture/assets/magnet-0.png; capture/assets/magnet-1.png; capture/assets/magnet-2.png; capture/assets/magnet-3.png; capture/assets/magnet-4.png; capture/assets/magnet-5.png
- blueprint: kinetic-type-beats (Adapt)
- focal: capture/assets/magnet-0.png
- roles: magnets = cutout (scattered like on a fridge door, left 55%)

Adapt: keep the beat-by-beat statement build; the magnets landing are the visual beat.
Scene 1 (0.0–2.4s): ink canvas with a faint brushed-steel vertical sheen on the left half (a fridge door suggestion, made from a soft gradient). Headline cue 1 "הרגע הכי יפה באירוע" per-word reveal on the right (display, paper), right-aligned, upper third. On each beat one magnet lands on the left half (drops from slightly above with a smooth settle, a small rotation each, soft shadow): magnets 0, 2, 5.
Scene 2 (2.4–4.6s): cue 2 "על המקרר של כל אורח. לשנים." appears under it with the word "לשנים." in gold; three more magnets land (1, 3, 4), filling a loose collage.
Scene 3 (4.6–6.0s): hold still.

## Frame 2 — The promise
- src: compositions/frames/02-promise.html
- type: product_intro
- duration: 6s
- transition_in: crossfade
- status: animated
- scene: Paper title card: "פריים מגנטים", line "צילום, עיצוב והדפסה במקום · מגנט ביד תוך דקה" and the site's hero screen in a laptop frame.
- voiceover: "פריים מגנטים | צילום, עיצוב והדפסה במקום | מגנט ביד תוך דקה"
- asset_candidates: capture/assets/shot-site-hero.png
- blueprint: titlecard-reveal (Adapt)
- focal: capture/assets/shot-site-hero.png
- roles: shot-site-hero = supporting (in a laptop window, left 50%, tilted slightly toward the text)

Adapt: three calm slide-ups, then the site window rises in; a held read.
Scene 1 (0.0–1.2s): paper canvas, sun-bloom right. Display "פריים מגנטים" (ink) slides up, right half; gold hairline draws under it.
Scene 2 (1.2–2.6s): body-lede "צילום, עיצוב והדפסה במקום" slides up under the rule.
Scene 3 (2.6–4.2s): a gold pill "⏱ מגנט ביד תוך דקה" slides up; the laptop window with the site hero rises in on the left half with a soft shadow.
Scene 4 (4.2–6.0s): hold still.

## Frame 3 — Step 1: pick a date
- src: compositions/frames/03-date.html
- type: feature_showcase
- duration: 8s
- transition_in: wipe
- status: animated
- scene: Step ① מתאמים lights; a phone shows the booking form, then the confirmation "הבקשה נשלחה!"; a calendar chip "✔ התאריך פנוי ביומן" pops; caption "בוחרים תאריך ושולחים בקשה. אנחנו מאשרים."
- voiceover: "① בוחרים תאריך באתר | המערכת בודקת ביומן | ✔ פנוי? אנחנו מאשרים וחוזרים אליכם"
- asset_candidates: capture/assets/shot-bk-form-M.png; capture/assets/shot-bk-done-M.png
- blueprint: device-surface-showcase (Adapt)
- focal: capture/assets/shot-bk-form-M.png
- roles: both = cutout (inside one phone frame, left-center, ~78% of frame height); the done screen replaces the form

Adapt: keep the held device with its screens cycling through a real flow; cursorless.
Scene 1 (0.0–1.6s): paper canvas. The 4-step rail appears top-right with ① lit. Headline "בוחרים תאריך באתר" (display, ink) on the right; the phone frame rises in on the left showing the form.
Scene 2 (1.6–4.2s): cue 2: a gold calendar chip "📅 המערכת בודקת ביומן…" slides out from the phone's side, then resolves to "✔ התאריך פנוי ביומן" (in-place token swap, green check).
Scene 3 (4.2–6.4s): the phone's screen swaps (vertical slide inside the screen) to the confirmation screen; cue 3 line "פנוי? אנחנו מאשרים וחוזרים אליכם" appears under the headline.
Scene 4 (6.4–8.0s): hold.

## Frame 4 — Step 2: design the frame
- src: compositions/frames/04-design.html
- type: feature_showcase
- duration: 8s
- transition_in: crossfade
- status: animated
- scene: Step ② מעצבים lights; the designer screen in a laptop window, then three finished magnets fan out from it; line "מעצבים מסגרת אישית — גם עם AI מתוך ההזמנה".
- voiceover: "② מעצבים מסגרת אישית | שמות, תאריך, צבעים | ✨ או AI שמעצב מתוך ההזמנה שלכם"
- asset_candidates: capture/assets/shot-designer.png; capture/assets/magnet-0.png; capture/assets/magnet-4.png; capture/assets/magnet-6.png
- blueprint: video-text-pivot (Adapt)
- focal: capture/assets/shot-designer.png
- roles: shot-designer = supporting (laptop window); magnets = cutout (fan out)

Adapt: keep the pivot signature — the screen holds center, then slides aside to hand the weight to the result (three magnets), then the AI line lands.
Scene 1 (0.0–2.0s): rail with ② lit (① checked). The designer laptop window holds center-left; headline "מעצבים מסגרת אישית" on the right.
Scene 2 (2.0–4.6s): the window slides left and shrinks; three finished magnets fan out to the right of it one per beat (0, 4, 6) with small rotations; chips "שמות", "תאריך", "צבעים" pop under the headline one per beat.
Scene 3 (4.6–8.0s): a gold sparkle chip "✨ או AI שמעצב מתוך ההזמנה שלכם" slides up under the chips; hold.

## Frame 5 — Step 3: on the day
- src: compositions/frames/05-day.html
- type: feature_showcase
- duration: 8s
- transition_in: crossfade
- status: animated
- scene: Step ③ מצלמים lights; the studio's photos screen in a laptop window, photos fill it; a big counter counts 60→0 "שניות"; line "הצלם מצלם, הסטודיו מעצב ומדפיס".
- voiceover: "③ ביום האירוע הצלם מסתובב בין האורחים | הסטודיו מעצב כל תמונה במסגרת שלכם | ומדפיס"
- asset_candidates: capture/assets/shot-studio-grid.png; capture/assets/shot-gv-filter.png
- blueprint: dataviz-countup (Adapt)
- focal: capture/assets/shot-studio-grid.png
- roles: shot-studio-grid = supporting (laptop window, left 58%); shot-gv-filter = supporting (second window slides over it in scene 2)

Adapt: keep a value-scaled counter as the hero number, paired with the real studio screens.
Scene 1 (0.0–2.2s): rail ③ lit. Laptop window with the studio grid rises in on the left; headline "ביום האירוע" + body line "הצלם מסתובב בין האורחים" on the right.
Scene 2 (2.2–5.0s): the second window (filter applied to several photos) slides in over the first, offset; body line 2 "הסטודיו מעצב כל תמונה במסגרת שלכם" appears.
Scene 3 (5.0–8.0s): on the right a big gold number counts down 60 → 0 with the label "שניות עד מגנט ביד" (value-scaled counter), then "ומדפיס 🖨️" lands; hold.

## Frame 6 — The wow: AI styles
- src: compositions/frames/06-styles.html
- type: benefit_highlight
- duration: 9s
- transition_in: zoom-through
- status: animated
- scene: Dark climax: the same portrait split in half (original | styled), the styled half swaps on every beat through 8 styles with Hebrew labels; line "ואפילו סגנונות AI — האורחים לא מאמינים".
- voiceover: "✨ ובונוס: סגנונות AI | קומיקס · מנגה · פופ־ארט · ציור · פסיפס · ניאון | האורחים לא מאמינים"
- asset_candidates: capture/assets/portrait-original.jpg; capture/assets/portrait-comic.jpg; capture/assets/portrait-manga.jpg; capture/assets/portrait-pop.jpg; capture/assets/portrait-cartoon.jpg; capture/assets/portrait-mosaic.jpg; capture/assets/portrait-neon.jpg; capture/assets/portrait-sketch.jpg; capture/assets/portrait-oldphoto.jpg
- blueprint: fixed-anchor-cycle (Adapt)
- focal: capture/assets/portrait-comic.jpg
- roles: all = cutout (one big square card, center-left ~78% height; the left half shows the original, the right half the style)

Adapt: keep the pinned anchor — the card never moves; what cycles is the styled half and its label, on the beat.
Scene 1 (0.0–1.6s): ink canvas, sun-bloom behind the card. The square photo card (gold hairline) appears with the original; a vertical gold divider draws down its middle; headline "ובונוס: סגנונות AI" on the right (display, paper).
Scene 2 (1.6–7.0s): on every second beat the right half of the card hard-cuts to the next style (comic, manga, pop, cartoon, mosaic, neon, sketch, old photo) while a gold label pill under the card swaps the style name in place (קומיקס, מנגה, פופ־ארט, סרט מצויר, פסיפס, ניאון, סקיצה, תמונה ישנה); a small counter "22+ סגנונות" sits under the headline.
Scene 3 (7.0–9.0s): line "האורחים לא מאמינים" lands under the headline in gold; hold on the comic split.

## Frame 7 — Step 4: take it home
- src: compositions/frames/07-home.html
- type: benefit_highlight
- duration: 8s
- transition_in: crossfade
- status: animated
- scene: Step ④ מדביקים lights; the finished magnet drops into a gift bag; three package cards (בסיסי ₪1,490 · פרימיום ₪2,290 · VIP ₪3,190) slide up; line "כל אורח יוצא עם מגנט מעוצב".
- voiceover: "④ כל אורח יוצא עם מגנט בשקית מתנה | חבילות לכל אירוע | בסיסי ₪1,490 · פרימיום ₪2,290 · VIP ₪3,190"
- asset_candidates: capture/assets/magnet-portrait.png
- blueprint: grid-card-assemble (Adapt)
- focal: capture/assets/magnet-portrait.png
- roles: magnet-portrait = cutout (left, ~60% height)

Adapt: the grid is three package cards assembling in a staggered cascade (paper cards, gold hairline, the middle one highlighted with an ink fill and "הכי מבוקש").
Scene 1 (0.0–2.4s): rail ④ lit (all others checked). The portrait magnet rises in on the left; a simple drawn kraft gift bag (CSS shapes in cream/gold) slides up in front of its lower third so the magnet looks tucked in; line "כל אורח יוצא עם מגנט בשקית מתנה" on the right.
Scene 2 (2.4–6.0s): headline "חבילות לכל אירוע" and three package cards assemble right→left one per beat on the right half: בסיסי ₪1,490, פרימיום ₪2,290 (highlighted), VIP ₪3,190.
Scene 3 (6.0–8.0s): hold.

## Frame 8 — CTA
- src: compositions/frames/08-cta.html
- type: cta
- duration: 7s
- transition_in: crossfade
- status: animated
- scene: End card on paper: "בודקים אם התאריך שלכם פנוי" + WhatsApp + site; the six magnets in a row along the bottom-top.
- voiceover: "התאריך שלכם עוד פנוי? | בודקים באתר בשנייה | 💬 054-4979771 · פריים מגנטים"
- asset_candidates: capture/assets/magnet-0.png; capture/assets/magnet-2.png; capture/assets/magnet-5.png
- blueprint: kinetic-type-beats (Adapt)
- focal: none (typographic end card)
- roles: magnets = supporting (small, a tidy row above the brand line)

Adapt: a closing line built beat-by-beat onto the brand and contact; real exit at the end (fade to paper).
Scene 1 (0.0–1.6s): paper canvas, sun-bloom center. "התאריך שלכם עוד פנוי?" (display, ink, centered) per-word reveal.
Scene 2 (1.6–3.6s): "בודקים באתר בשנייה" (gold) appears under it; three magnets slide up into a small row above the headline.
Scene 3 (3.6–5.6s): gold hairline draws; "פריים מגנטים" + "💬 054-4979771" + the site address appear in a row.
Scene 4 (5.6–7.0s): hold; the last 0.5s fades to paper.
