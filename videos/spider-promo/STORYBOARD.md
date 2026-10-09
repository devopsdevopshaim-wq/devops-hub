---
format: 1920x1080
duration: 120s
mode: collaborative
message: "אדם אחד בונה הכול: 48 מערכות אמיתיות, מסוכני AI ועד הנדסה, ומחבר ביניהן"
arc: Feature-Benefit Cascade (hook → thesis → proof strands → whole web → how → CTA → brand)
audience: לקוחות, מעסיקים ושותפים פוטנציאליים בלינקדאין ובאינסטגרם
music: none
concept: "הרשת" — a spider web being spun; every project is a node on a silk thread
---

# SPIDER — סרטון תדמית "הרשת"

No voiceover: every line is on-screen Hebrew kinetic type (RTL), so the piece works with sound off in the feed.
`voiceover` below is the on-screen copy each frame reveals, cue by cue, not narration.

## Locked

- Plan approved by the user (frame table v1), music option A (an original score composed in code), sketches approved: storyboard.html v1, all 12 frames.

## Video direction

- **Palette** (frame.md, from the site CSS): night #0f0d24 canvas with a violet sky glow (deep #17143a / #2a2366) · porcelain #f1eefc type · mist #a9a4cc secondary · brass #e0b25a the silk thread and the one accent word per line · brass-2 #f3d596 nodes · mint #62dcb8 only for "live" (frames 09–10).
- **Spine**: one brass silk thread. It drops in 01, knots in 02, scatters into stars in 03, carries the camera in 04–07, becomes the web in 08, carries the light bead in 09, and contracts into the S mark in 12. Every frame shows a piece of it.
- **Motion grammar**: long-tail eases (power3.out default, expo.out for the camera), smooth over bouncy; thread draw-on via stroke-dashoffset; screenshots enter with a short rise + scale 0.94→1 + blur 6→0; Hebrew lines reveal word by word right→left (per-word x-stagger). Progress travels right → left across the film.
- **Reveal model**: onscreen film, no narration: the `voiceover` field is the on-screen copy and each `|` cue is a reveal point; reveals spread across each frame, the back half included.
- **Holds**: 02 tail (held read before the count), 08 lock (the whole web), 10 (still list), 12 tail (brand). Elsewhere the camera or the thread keeps moving with purpose.
- **Never**: fake product UI (real screenshots only) · stock photos · glow on text · purple-blue "AI" gradients beyond the site's own sky · slideshow (front-load then freeze) · screensaver (things floating with no reason) · content in the bottom 17% band.

## Frame 1 — חוט אחד

- scene: Darkness and a few stars; a single brass silk thread drops from the top of frame and stops with a tiny bounce
- voiceover: "כל מערכת | מתחילה | בחוט אחד."
- duration: 8s
- transition_in: cut
- status: animated
- src: compositions/frames/01-thread.html
- type: hook
- persuasion: Curiosity gap
- beat: intrigue
- blueprint: kinetic-type-beats
- asset_candidates: assets/sky.webp — the site's own night-sky backdrop
- focal: assets/sky.webp
- roles: sky = background (dim ~50%)
- blueprint: kinetic-type-beats (Adapt)

Adapt: keep the statement-builds-across-cues signature; the "payoff" is the accent phrase in brass.
Scene 1 (0.0–2.2s): night sky with slow parallax stars; the brass thread draws down from the top edge at x≈62% to mid-height and its drop settles with a small bounce. Centered-right, thread is the only object.
Scene 2 (2.2–4.6s): "כל מערכת" rises word by word at the right third, display ramp.
Scene 3 (4.6–6.4s): "מתחילה" then "בחוט אחד." lands in brass; the drop pulses once.
Scene 4 (6.4–8.0s): held read; stars drift a hair.

narrativeRole: Opens on one image only this brand can own (SPIDER, a thread) and asks the viewer to follow it.
keyMessage: Something is being built here, one connection at a time.

## Frame 2 — את כולן

- scene: The thread knots into a first glowing node; the line "אני בונה את כולן." lands, then swaps to the site's own hero line
- voiceover: "ואני בונה | את כולן. | כל מה שבניתי, במקום אחד."
- duration: 9s
- transition_in: crossfade
- status: animated
- src: compositions/frames/02-thesis.html
- type: product_intro
- persuasion: Bold claim, then source-proof (the site's real headline)
- beat: confidence
- blueprint: kinetic-type-beats
- asset_candidates: assets/spider.svg — the SPIDER logo mark
- focal: assets/spider.svg
- roles: spider mark = supporting (appears only as the node's glyph glint)
- blueprint: kinetic-type-beats (Reproduce)

Scene 1 (0.0–2.0s): the drop from 01 tightens into a glowing brass node, a halo ring blooms outward once.
Scene 2 (2.0–4.4s): "ואני בונה" rises, then "את כולן." lands in brass, right third.
Scene 3 (4.4–6.6s): the site's line "כל מה שבניתי, במקום אחד." fades up beneath in mist.
Scene 4 (6.6–9.0s): held read, nothing moves but the node's slow glint.

narrativeRole: Lands the value claim by beat 2: one builder behind many systems.
keyMessage: Haim builds the whole thing, end to end.

## Frame 3 — 48 נקודות

- scene: Dots spring into a constellation across the sky while a jumbo numeral counts 0 → 48; label "פרויקטים", sub-line "כל נקודה היא פרויקט אמיתי."
- voiceover: "48 | פרויקטים. | כל נקודה היא פרויקט אמיתי."
- duration: 9s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/03-count.html
- type: social_proof
- persuasion: Statistical proof (the site's own counter and copy)
- beat: awe
- blueprint: dataviz-countup
- asset_candidates: assets/topo.webp — the site's topographic-lines texture
- focal: assets/topo.webp
- roles: topo lines = background (dim ~80%, only a whisper)
- blueprint: dataviz-countup (Adapt)

Adapt: keep the count-up hero number; the "chart" is the constellation of 48 dots.
Scene 1 (0.0–1.0s): the node from 02 bursts into points that spring outward across the left two-thirds.
Scene 2 (1.0–6.0s): jumbo mono numeral counts 0 → 48 at upper right while dots keep landing, one per count; thin brass lines connect neighbouring dots as they arrive.
Scene 3 (6.0–7.4s): "פרויקטים" lands under the numeral.
Scene 4 (7.4–9.0s): "כל נקודה היא פרויקט אמיתי." fades up; a few dots glow brass and hold.

narrativeRole: Turns the claim into a number the viewer can feel, using the site's own "every dot is a real project".
keyMessage: This is not a concept: 48 real, working projects.

## Frame 4 — חוט ה־AI

- scene: The camera travels along one strand to its nodes; each node opens into a real screenshot card: JARVIS, עוזר משרד חכם, עיצוב AIA
- voiceover: "סוכני AI | שעובדים בשבילך: | JARVIS · עוזר משרד חכם · עיצוב AIA"
- duration: 11s
- transition_in: crossfade
- status: animated
- src: compositions/frames/04-ai.html
- type: feature_showcase
- persuasion: Show-don't-tell proof
- beat: curiosity → confidence
- blueprint: camera-journey
- asset_candidates: assets/jarvis-web.jpg — JARVIS multi-agent assistant screenshot; assets/smart-office-assistant.jpg — smart office assistant screenshot; assets/aia-studio.jpg — AIA production studio screenshot
- focal: assets/jarvis-web.jpg
- roles: jarvis-web = cutout (hero card) · smart-office-assistant = supporting · aia-studio = supporting
- blueprint: camera-journey (Adapt)

Adapt: keep the multi-leg camera journey; the world is the diagonal strand and its three nodes.
Scene 1 (0.0–1.4s): title "סוכני AI" + "שעובדים בשבילך" at top right; the strand draws from the upper right corner down-left.
Scene 2 (1.4–4.2s): the camera travels down the strand; the first node opens into the AIA studio screenshot card (lower right).
Scene 3 (4.2–6.8s): travel on; the second node opens into the smart office assistant card.
Scene 4 (6.8–11.0s): the camera lands on the hero: the JARVIS screenshot card scales up at the left (≈45% of frame) with a brass rim, label chip "JARVIS — עוזר רב־סוכנים"; hold the read.

narrativeRole: First strand of evidence: AI agents, the field the audience asks about first.
keyMessage: He ships working AI agents, not demos.

## Frame 5 — חוט ההנדסה

- scene: Stations on one wide strand, panned one by one: פארק־פלאן (robotic parking), נט־פלאן (networks), מעגל סגור (electrical), מכלול (assembly), each a real screenshot with a short label
- voiceover: "הנדסה אמיתית: | מחניון רובוטי | ועד לוח חשמל."
- duration: 12s
- transition_in: push-slide LEFT
- status: animated
- src: compositions/frames/05-engineering.html
- type: feature_showcase
- persuasion: Range / authority by depth
- beat: respect
- blueprint: spatial-pan-stations
- asset_candidates: assets/robotic-parking.jpg — robotic parking planner screenshot; assets/netplan.jpg — network planning screenshot; assets/electro-fix.jpg — electrical fault diagnosis screenshot; assets/assembly-studio.jpg — assembly studio screenshot
- focal: assets/robotic-parking.jpg
- roles: robotic-parking = cutout (hero) · netplan, electro-fix, assembly-studio = supporting
- blueprint: spatial-pan-stations (Reproduce)

Scene 1 (0.0–2.4s): a horizontal thread spans the frame; the camera starts on station נט־פלאן at the right.
Scene 2 (2.4–5.4s): pan left to the hero station פארק־פלאן (larger card, brass rim), its label pops.
Scene 3 (5.4–8.4s): pan on to מעגל סגור, then מכלול, each label popping as it centers.
Scene 4 (8.4–12.0s): the camera pulls back so all four stations sit on the thread; the line "הנדסה אמיתית: מחניון רובוטי ועד לוח חשמל." reveals word by word below; hold.

narrativeRole: Proves depth outside software: real engineering planners.
keyMessage: He also builds hard, technical systems.

## Frame 6 — חוט היומיום

- scene: Cards self-assemble along a curved strand: מסע (vacations), מצפן פיננסי, מצפן בריאות, פרסום ושיווק
- voiceover: "כלים | לחיים עצמם: | חופשה · כסף · בריאות · שיווק"
- duration: 10s
- transition_in: crossfade
- status: animated
- src: compositions/frames/06-everyday.html
- type: benefit_highlight
- persuasion: Feature-to-benefit translation (each tool named by the life area it fixes)
- beat: ease
- blueprint: grid-card-assemble
- asset_candidates: assets/vacation-hub.jpg — vacation management site screenshot; assets/finance-hub.jpg — finance compass screenshot; assets/wellness-hub.jpg — health compass screenshot; assets/marketing-hub.jpg — marketing hub screenshot
- focal: assets/marketing-hub.jpg
- roles: vacation-hub, finance-hub, wellness-hub = supporting · marketing-hub = cutout (last, brass rim)
- blueprint: grid-card-assemble (Reproduce)

Scene 1 (0.0–1.6s): a curved strand draws across the upper left; the title "כלים לחיים עצמם" rises at the right.
Scene 2 (1.6–7.0s): four cards drop from the strand in a staggered cascade into a 2×2 grid (מסע, מצפן פיננסי, מצפן בריאות, פרסום ושיווק); each word in "חופשה · כסף · בריאות · שיווק" lights brass as its card lands.
Scene 3 (7.0–10.0s): the last card takes the brass rim; hold.

narrativeRole: Brings the work home: tools ordinary people use.
keyMessage: His systems solve everyday problems.

## Frame 7 — חוט היצירה

- scene: A floating window cycles through creative studios and heritage: סטודיו ספרים, פאנל קומיקס, ספריית קודש, לוח שנה עברי
- voiceover: "סטודיו ליצירה | ומורשת: | ספרים · קומיקס · ספריית קודש"
- duration: 10s
- transition_in: crossfade
- status: animated
- src: compositions/frames/07-creative.html
- type: feature_showcase
- persuasion: Rule of three
- beat: warmth
- blueprint: device-surface-showcase
- asset_candidates: assets/book-studio.jpg — book studio screenshot; assets/comic-studio.jpg — comic studio screenshot; assets/torah-hub.jpg — Torah library screenshot; assets/hebrew-calendar.jpg — Hebrew calendar screenshot
- focal: assets/book-studio.jpg
- roles: book-studio = cutout (floating window, first screen) · comic-studio, torah-hub, hebrew-calendar = the window's next screens
- blueprint: device-surface-showcase (Adapt)

Adapt: the "device" is a single floating window (no fake bezel); its screen cycles four real screenshots.
Scene 1 (0.0–2.0s): the window drifts in tilted with a slow 3D push; title "סטודיו ליצירה ומורשת" at right.
Scene 2 (2.0–8.0s): every 2s the window's screen wipes to the next screenshot (ספרים → קומיקס → ספריית קודש → לוח שנה עברי) and the list item on the right lights in step.
Scene 3 (8.0–10.0s): settle on the calendar; hold.

narrativeRole: Last strand; shows taste and range beyond business.
keyMessage: The same builder brings craft to culture too.

## Frame 8 — כל הרשת

- scene: Open tight on one node, then one long decelerating zoom-out reveals the entire web: dozens of screenshot tiles hung on brass threads, all connected
- voiceover: "וכל חוט | מחובר | לכל השאר."
- duration: 12s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/08-web.html
- type: benefit_highlight
- persuasion: Value stacking
- beat: awe
- blueprint: zoom-out-workspace-reveal
- asset_candidates: assets/devops-hubnew.jpg — DevOps Hub screenshot; assets/warehouse-management.jpg — smart WMS screenshot; assets/translate-dub.jpg — VocalizePro screenshot; assets/hapinkas-hayomi.jpg — daily notebook screenshot; assets/automation.jpg — automation screenshot; assets/data-management.jpg — data management screenshot; assets/gamma-deck.jpg — Gamma deck screenshot; assets/recipe-calculator.jpg — recipes screenshot
- focal: assets/devops-hubnew.jpg
- roles: all eight screenshots = supporting tiles on the web; devops-hubnew = the opening close-up
- blueprint: zoom-out-workspace-reveal (Reproduce)

Scene 1 (0.0–2.0s): open tight on one screenshot tile hanging on a brass thread (DevOps Hub), filling most of the frame.
Scene 2 (2.0–9.0s): ONE continuous decelerating zoom-out reveals the whole web: radial spokes and rings draw on, tiles hang at the crossings, small dots fill the rest of the web.
Scene 3 (9.0–10.6s): the web locks; "וכל חוט" then "מחובר לכל השאר." reveal at the bottom-center (above the keep-out).
Scene 4 (10.6–12.0s): held read.

narrativeRole: The climax: the separate strands are one connected web, one builder.
keyMessage: It's a system, not a pile of projects.

## Frame 9 — מהמחשב לאוויר

- scene: Four stations light up in sequence along one thread: תיקייה במחשב → מאגר ב־GitHub → GitHub Pages → כאן, בסדנה
- voiceover: "מהמחשב לאוויר, | בארבעה צעדים: | תיקייה · GitHub · Pages · באוויר"
- duration: 11s
- transition_in: push-slide LEFT
- status: animated
- src: compositions/frames/09-pipeline.html
- type: feature_showcase
- persuasion: Friction reduction (the site's own 4-step process)
- beat: clarity
- asset_candidates:
- focal:
- roles: typography and line-art only
- blueprint: compose

Scene 1 (0.0–1.6s): title "מהמחשב לאוויר, בארבעה צעדים" rises at the top right; a thread draws right→left across the middle.
Scene 2 (1.6–8.4s): a bead of light runs right→left along the thread; each station circle 1→4 ignites as the bead reaches it, with its name and one mono sub-line (תיקייה במחשב / מאגר ב־GitHub / GitHub Pages / באוויר).
Scene 3 (8.4–11.0s): station 4 turns mint and holds.

narrativeRole: Answers "how": a repeatable DevOps path, from the site's own "איך זה עובד".
keyMessage: Everything he builds goes live, fast, and stays live.

## Frame 10 — באוויר עכשיו

- scene: Status lights blink green across a column of project names; label "באוויר עכשיו"; sub-line "העמוד בודק את GitHub ומעדכן סטטוס לבד."
- voiceover: "באוויר עכשיו. | מתעדכן לבד."
- duration: 8s
- transition_in: crossfade
- status: animated
- src: compositions/frames/10-live.html
- type: social_proof
- persuasion: Show-don't-tell proof (live status)
- beat: trust
- blueprint: titlecard-reveal
- asset_candidates:
- focal:
- roles: typography only (project names are real titles from projects.json)
- blueprint: titlecard-reveal (Adapt)

Adapt: one restrained move on the title, plus the status column the site really has.
Scene 1 (0.0–3.0s): six project rows appear top-down on the left, each mint LED blinking on as its row lands.
Scene 2 (3.0–5.0s): "באוויר עכשיו." slides up at the right, "עכשיו" in mint.
Scene 3 (5.0–8.0s): "העמוד בודק את GitHub ומעדכן סטטוס לבד." fades up; still hold.

narrativeRole: Trust beat: these are running products, monitored automatically.
keyMessage: Live, maintained, real.

## Frame 11 — החוט הבא

- scene: A new empty thread drops beside the web; the question lands, then the offer
- voiceover: "רוצים כזה | לעסק? | בואו נטווה את החוט הבא."
- duration: 9s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/11-cta.html
- type: cta
- persuasion: Direct address + future pacing
- beat: motivation
- blueprint: kinetic-type-beats
- asset_candidates:
- focal:
- roles: line-art (the finished web, small) + typography
- blueprint: kinetic-type-beats (Adapt)

Scene 1 (0.0–2.0s): the finished web sits small at the left; a new empty thread drops at center-right (callback to 01).
Scene 2 (2.0–4.6s): "רוצים כזה" then "לעסק?" in brass.
Scene 3 (4.6–7.0s): "בואו נטווה את החוט הבא." fades up beneath; the new drop pulses.
Scene 4 (7.0–9.0s): hold.

narrativeRole: Turns admiration into a request; uses the site's own CTA "רוצים כזה לעסק?".
keyMessage: Your project can be the next node.

## Frame 12 — SPIDER

- scene: The whole web contracts into the SPIDER mark; wordmark, name, phone and site address settle under it
- voiceover: "SPIDER | חיים קריספין · 054-4979771 | devopsdevopshaim-wq.github.io/devops-hub/portfolio"
- duration: 9s
- transition_in: crossfade
- status: animated
- src: compositions/frames/12-brand.html
- type: branding
- persuasion: Brand recall
- beat: belonging
- blueprint: logo-assemble-lockup
- asset_candidates: assets/spider.svg — the SPIDER logo mark
- focal: assets/spider.svg
- roles: spider mark = cutout (center)
- blueprint: logo-assemble-lockup (Reproduce)

Scene 1 (0.0–2.6s): threads converge from the frame edges onto the center and draw the circle of the mark; the S lands inside.
Scene 2 (2.6–4.6s): the SPIDER wordmark tracks in under it (letter-spacing collapses to the set value).
Scene 3 (4.6–6.4s): "חיים קריספין · 054-4979771" rises, then the site address in mono.
Scene 4 (6.4–9.0s): a slow brass shimmer passes across the mark once; hold to the end, then fade the whole frame out over the last 0.8s (final frame).

narrativeRole: Brand lockup and contact so the viewer can act.
keyMessage: SPIDER = Haim Krispin, and here's how to reach him.
