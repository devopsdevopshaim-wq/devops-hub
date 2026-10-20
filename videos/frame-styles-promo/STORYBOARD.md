---
format: 1920x1080
duration: 30s
message: "תמונה אחת מהאירוע, עשרות סגנונות: מגנט שאורחים לא שוכחים"
arc: Feature-Benefit Cascade
audience: זוגות ומשפחות שמתכננים אירוע ומחפשים מגנטים לאירוע
mode: autonomous
music: none
---

## Video direction

- **No narration.** The "voiceover" field of each frame is the ON-SCREEN Hebrew text (RTL, right-aligned or centered), and
  reveals are paced to those text cues and to a 112 bpm music bed (one beat ≈ 0.54s; host-made track in assets/music.m4a).
- **Palette (frame.md):** canvas = ink #1d1633 (dark plum) for the style frames so photos glow; paper #fbf6ee only for the
  intro/CTA title cards; gold sun #c9a45c / ember #e3c98e as the single accent (sun-bloom behind the hero, hairline rules,
  the wipe line). Text: paper on ink, ink on paper. Never purple-blue AI gradients.
- **Type (frame.md roles):** display = Frank Ruhl Libre (headlines, Hebrew), body = Heebo (labels, chips), mono-data for
  the small style counter "01/22". Hebrew is RTL: set `dir="rtl"` on every text block.
- **Motion grammar:** smooth long-tail power3 everywhere; no bounce. Each piece enters on its cue (text appears when it is
  "said"), never front-loaded. Photo transformations are the hero motion: a gold vertical wipe line sweeps right→left and the
  styled version is revealed behind it (clip-path), so the viewer SEES the photo change.
- **Rhythm:** Frame 2 is a short held breather before the wipe sequence; Frame 5 holds the finished magnet still before the CTA.
- **Negative list:** no slideshow (dump then freeze), no screensaver floating, no lazy breathing, no back-half slow push, no
  repeat/yoyo, no Math.random, no real cursors or browser chrome, no other company's names.
- Keep everything important inside the top ~83% (bottom band clear).

## Frame 1 — One photo
- src: compositions/frames/01-one-photo.html
- type: hook
- duration: 4s
- transition_in: cut
- status: animated
- scene: A single event photo lands; Hebrew line "תמונה אחת." then "עשרות סגנונות." swaps in.
- voiceover: "תמונה אחת. | עשרות סגנונות."
- asset_candidates: capture/assets/portrait-original.jpg; capture/assets/portrait-comic.jpg; capture/assets/portrait-pop.jpg; capture/assets/portrait-manga.jpg
- blueprint: kinetic-type-beats (Adapt)
- focal: capture/assets/portrait-original.jpg
- roles: portrait-original = cutout (hero photo card) · portrait-comic / pop / manga = supporting (flash frames)

Adapt: keep the in-place token swap signature on the second word; the photo card next to the type flashes through three styles on the swap.
Scene 1 (0.0–1.4s): ink canvas, faint sun-bloom left-center. The original portrait sits as a tall photo card (left 40% of frame, slight tilt, thin gold hairline border) entering with a smooth rise+fade; on the right, display headline "תמונה אחת." per-word staggered reveal → `dynamic-content-sequencing`. Asymmetric 60/40.
Scene 2 (1.4–2.9s): the headline's word swaps in place by hard cut (`discrete-text-sequence`) to "עשרות סגנונות." while the photo card hard-cuts on each beat comic → pop → manga (three flashes, one per beat) — the card itself stays put.
Scene 3 (2.9–4.0s): the card settles back on the comic version; a small gold micro-label "22 סגנונות מיידיים + עוד ב־AI" fades in under the headline; hold still.

## Frame 2 — The brand
- src: compositions/frames/02-brand.html
- type: product_intro
- duration: 3.5s
- transition_in: crossfade
- status: animated
- scene: Title card on paper: "פריים מגנטים" with the finished portrait magnet.
- voiceover: "פריים מגנטים | סטודיו הסגנונות לתמונות מהאירוע"
- asset_candidates: capture/assets/magnet-portrait.png
- blueprint: titlecard-reveal (Adapt)
- focal: capture/assets/magnet-portrait.png
- roles: portrait magnet = cutout (right side, ~45% height)

Adapt: one restrained move per element (slide-up crossfade), paper canvas with sun-bloom; the magnet card is the visual anchor.
Scene 1 (0.0–1.2s): paper canvas, sun-bloom behind right third. Display "פריים מגנטים" slides up + fades in on the right half (RTL, right-aligned), a 1px gold hairline draws under it (`svg-path-draw`).
Scene 2 (1.2–2.4s): body-lede "סטודיו הסגנונות לתמונות מהאירוע" slides up under the rule; the finished magnet (gold classic frame) rises in on the left with a soft shadow.
Scene 3 (2.4–3.5s): held breather — everything still.

## Frame 3 — Watch it change
- src: compositions/frames/03-watch-it-change.html
- type: feature_showcase
- duration: 7s
- transition_in: cut
- status: animated
- scene: The same portrait, a gold wipe line sweeps across and reveals a new style each time: קומיקס → פופ־ארט → מנגה → תמונה ישנה.
- voiceover: "קומיקס | פופ־ארט | מנגה | תמונה ישנה"
- asset_candidates: capture/assets/portrait-original.jpg; capture/assets/portrait-comic.jpg; capture/assets/portrait-pop.jpg; capture/assets/portrait-manga.jpg; capture/assets/portrait-oldphoto.jpg
- blueprint: compose
- focal: capture/assets/portrait-comic.jpg
- roles: all = cutout (stacked layers of the same photo in one big centered card)

Compose: one big photo card (centered, ~70% of frame height, 3:2 landscape crop of the portrait, rounded corners, gold hairline). All style versions are stacked layers in the same card; each new one is revealed by a vertical gold wipe line moving right→left (clip-path inset on the incoming layer). The style name (display, paper color) sits in a gold pill top-right of the card and swaps by hard cut when its wipe completes; a mono counter "01 / 22" bottom-left of the card ticks.
Scene 1 (0.0–1.6s): card on ink canvas showing the original; the line sweeps → comic revealed; pill "קומיקס", counter 01.
Scene 2 (1.6–3.2s): sweep → pop-art; pill "פופ־ארט", counter 02.
Scene 3 (3.2–4.8s): sweep → manga; pill "מנגה", counter 03.
Scene 4 (4.8–7.0s): sweep → old photo; pill "תמונה ישנה", counter 04; hold still on the result for the last ~1.2s.

## Frame 4 — The wall of styles
- src: compositions/frames/04-wall-of-styles.html
- type: benefit_highlight
- duration: 6s
- transition_in: zoom-through
- status: animated
- scene: A grid of 12 styled versions assembles tile by tile, each labelled in Hebrew; headline "בוחרים סגנון בלחיצה".
- voiceover: "בוחרים סגנון בלחיצה"
- asset_candidates: capture/assets/portrait-cartoon.jpg; capture/assets/portrait-sketch.jpg; capture/assets/portrait-neon.jpg; capture/assets/portrait-mosaic.jpg; capture/assets/portrait-engrave.jpg; capture/assets/portrait-lineart.jpg; capture/assets/portrait-thermal.jpg; capture/assets/portrait-stained.jpg; capture/assets/portrait-graffiti.jpg; capture/assets/portrait-noir.jpg; capture/assets/portrait-blueprint.jpg; capture/assets/portrait-lomo.jpg
- blueprint: grid-card-assemble (Adapt)
- focal: capture/assets/portrait-neon.jpg
- roles: all 12 = supporting tiles; neon = focal (gets the gold "selected" ring at the end)

Adapt: keep the staggered self-assembling grid signature; tiles are the real styled photos with Hebrew labels (סרט מצויר, סקיצה, ניאון, פסיפס, תחריט זהב, דף צביעה, תרמית, ויטראז׳, גרפיטי, נואר, שרטוט כחול, לומו).
Scene 1 (0.0–0.8s): headline "בוחרים סגנון בלחיצה" (display, paper) top-right, per-word reveal.
Scene 2 (0.8–4.0s): 4×3 grid of tiles (top ~80% of frame under the headline) assembles in a staggered cascade right→left, row by row, each tile rising+fading in with its label chip under it → `grid-card-assemble` / `dynamic-content-sequencing`.
Scene 3 (4.0–6.0s): a gold ring snaps around the ניאון tile and it lifts slightly (one press, `press-release-spring` without overshoot); others dim to ~55% (`depth-of-field-blur` light); hold.

## Frame 5 — On every magnet
- src: compositions/frames/05-on-every-magnet.html
- type: benefit_highlight
- duration: 5s
- transition_in: crossfade
- status: animated
- scene: A finished magnet frame stays pinned in the center while the photo inside cycles through styles on the beat; line "על המגנט. ביום האירוע."
- voiceover: "על המגנט | ביום האירוע"
- asset_candidates: capture/assets/magnet-portrait.png; capture/assets/magnet-0.png; capture/assets/magnet-2.png; capture/assets/magnet-5.png
- blueprint: fixed-anchor-cycle (Adapt)
- focal: capture/assets/magnet-portrait.png
- roles: magnets = cutout; the three showcase magnets fan in as supporting at the end

Adapt: keep the pinned-anchor signature: the portrait magnet stays dead-center; what cycles is the event around it — three of the site's other showcase magnets (wedding classic, wedding floral, engagement hearts) slide in beside it one per cue, like magnets landing on a fridge.
Scene 1 (0.0–1.5s): paper canvas, sun-bloom center. The portrait magnet (pinned, center, ~70% height) enters with a smooth scale-up from 92%; headline "על המגנט." top-right.
Scene 2 (1.5–3.6s): on each beat a showcase magnet lands left and right of the pinned one (slight rotations, soft shadows), three in all; second line "ביום האירוע." appears under the headline.
Scene 3 (3.6–5.0s): hold still (subtle jitter at most).

## Frame 6 — CTA
- src: compositions/frames/06-cta.html
- type: cta
- duration: 4.5s
- transition_in: crossfade
- status: animated
- scene: End card: "בחרו סגנון. אנחנו מדפיסים." + site address + WhatsApp.
- voiceover: "בחרו סגנון. אנחנו מדפיסים. | פריים מגנטים · 054-4979771"
- asset_candidates: capture/assets/portrait-comic.jpg
- blueprint: kinetic-type-beats (Adapt)
- focal: none (typographic end card)
- roles: portrait-comic = background (right third, dim ~35%, masked with a soft gradient into the ink)

Adapt: closing line snapping beat-by-beat onto the brand + contact; final frame has a real exit (fade to ink at the very end).
Scene 1 (0.0–1.2s): ink canvas; "בחרו סגנון." slams in (smooth, no overshoot) centered-right; on the next beat "אנחנו מדפיסים." appears under it in gold.
Scene 2 (1.2–2.8s): a gold hairline draws; under it the brand "פריים מגנטים" (display, paper) and a row with 💬 054-4979771 and the site address in mono-data (LTR inside RTL).
Scene 3 (2.8–4.5s): hold; last 0.4s fade to ink.
