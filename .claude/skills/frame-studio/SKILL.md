---
name: frame-studio
description: "Work on the standalone site 'פריים מגנטים / פריים־סטודיו' (a business site for event photo magnets plus its editing and printing studio) (frame-studio/ in devops-hub, live at https://devopsdevopshaim-wq.github.io/devops-hub/frame-studio/): explain it, use it, change it, fix it or extend it. Use when the user mentions פריים סטודיו, עריכת תמונות, מסגרות PNG, מסגרת לתמונה, הדפסת תמונות, מדפסת תמונות, הסרת רקע, צלם אירועים, magnet / מגנטים לאירועים, frame studio, frame-studio, עריכה מרובה, סגנון קומיקס / מנגה / גרפיטי, גיבורי על, ספריית אירועים or תכנון הדפסה."
---

# פריים מגנטים + פריים־סטודיו (frame-studio)

Two pages:
- `index.html` — the public site of an event-magnets business (פריים מגנטים): a designer's portfolio hero, how it works, a gallery of designs per event type, a designer where a visitor picks event type, names, date, frame, colour and font (and may load their own photo, which stays on the device) and sends the request to WhatsApp, packages, the AI/tech section, FAQ and a contact form that opens WhatsApp. All business details (name, phone/WhatsApp, e-mail, social links, areas, hours, packages and prices, FAQ, event types) live in `business.json`; the prices there are examples until the owner sets real ones. With no WhatsApp number, links open WhatsApp's contact picker. Code: `js/site.js`, `css/site.css`.
- `studio.html` — the working studio described below (it was `index.html` before; the PWA starts here).

`js/events.js` (shared): `FS.EVENTS` (style per event type: frame, colour, font, palette, frames, greetings), `FS.buildMagnet(p, o)` (frame + names + date/hashtag + logo laid out in the frame's free band; `o.frameRef` for a user PNG frame), `FS.sampleScene` (drawn sample photos, no real people), `FS.photoFrom`.

`js/event-studio.js` (studio): the "אירוע" tab — event form saved in prefs, "תבנית פעילה" applies the event to every new photo (`FS.afterAdd` hook in `core.js`), smart face centring, saved events (`localStorage` `frame-studio-events`), logo colours (k-means); the live event station — `showDirectoryPicker` on the camera folder, polled every 1.5s, a file is taken once its size is steady, template → quality check → queue → `FS.printNow({list, paper, layout, margin, marks})` when a sheet is full (Chrome `--kiosk-printing` prints with no dialog); counters (printed total in `localStorage`). Extra AI: magnet design from a description (Gemini through the hubs server, local keyword fallback), quality check (`FS.quality`: variance of the Laplacian for blur, MediaPipe FaceLandmarker blendshapes for closed eyes; badges on the strip; print can skip failed photos), skin retouch (`FS.smoothSkin`, edge-keeping blur in face ovals, `doc.photo.skin`), face light (exposure/shadows from face brightness), greetings (ready per event + AI). Magnet sizes in `FS.FORMATS`: 5×7.5, 7.5×5, 6×9, 7×10, 6×6. Extra frames: `classic`, `floral`, `boho`.

The studio: a Hebrew (RTL) photo editor for photographers that runs in the browser and installs as an app on Mac, Windows and phones (PWA: `manifest.webmanifest`, `sw.js`). The user loads photos (several at once), edits them, puts frames on them (ready frames drawn in code, or their own PNG frames), adds text, stickers and AI effects, plays games with the photos, saves in several formats and prints on any printer installed on the computer.

Live: https://devopsdevopshaim-wq.github.io/devops-hub/frame-studio/ · Code: `frame-studio/` in https://github.com/devopsdevopshaim-wq/devops-hub

## How it is built
Plain static files, no build step, no server. Photos never leave the computer, except the downsized picture the editing assistant sends when the user presses it.

| File | Role |
| --- | --- |
| `studio.html` | the studio screen: tool rail (8 tabs), the panel, the canvas stage, the photo strip, a dialog, the hidden print area |
| `js/core.js` | `window.FS`: state, page formats (300dpi px + paper mm), the photo pipeline (`FS.processed` → `FS.adjustPixels`: exposure, tone curve LUT, white balance, vibrance, hue matrix, clarity/sharpen by box blur, vignette, grain; `FS.pixelate` for face blur; `FS.replaceBackground` with the person mask), `FS.draw` (page → photo → frame → layers → selection), layers and hit testing, undo/redo (page JSON per photo), IndexedDB (`frame-studio` db: `frames`, `designs`) |
| `js/frames.js` | `FS.GEN_FRAMES` (15 frames drawn at the page size with any colour/thickness; some add their own text layers), user PNG frames (`FS.detectHole` finds the transparent window by flood fill), `FS.setFrame` (a PNG frame of another shape changes the page to its shape) |
| `js/ui.js` | tabs, photo strip, pointer drag / pinch / wheel / handle (scale+rotate), keyboard (Ctrl+Z/Y/S/P/D, Delete, arrows), sliders, presets (`FS.PRESETS`, my presets in `localStorage`), frames panel, text and sticker editor, layers list |
| `js/ai.js` | MediaPipe tasks-vision 0.10.14 from jsDelivr, loaded on first use: selfie segmenter (background blur / colour / image / B&W / transparent) and BlazeFace (smart centring, face stickers, face blur). Pictures from a description: Pollinations (`image.pollinations.ai`, no key); Hebrew is first translated through the hubs server. Editing assistant: `{action:'ai', tag:'photo', prompt, image, mime}` to `hasadna-hubs` (Gemini), answers JSON with adjustments, captions and a frame |
| `js/output.js` | JPG/PNG/WEBP, PDF written directly (`FS.pdf`, JPEG pages at true mm size), ZIP of all (`FS.zip`, stored), project file `.fstudio.json` (photos, pages, the PNG frames used), "my designs" in IndexedDB, save a design as a new PNG frame, share, print |
| `js/games.js` | design roulette, sliding puzzle, scratch card (original over edited), guess the filter, sticker rain, memory |
| `css/studio.css` | dark editor look; under 980px the stage goes on top and the tools become a sideways bar; print rules |

A page: `{ fmt, w, h, bg, frame, layers:[], photo:{ x, y, s, r, fh, fv, adj, preset, bg:{mode,color,src,amount}, blurs } }`. Layers: `text` (font, size, colour, gradient, stroke, background, shadow, spacing), `emoji`, `image` (src data URL, `s`). Frame refs: `{kind:'gen', id, color, thick, opacity}` or `{kind:'png', id, tint, tintAmt, opacity, clip}`.

Printing: the browser cannot list printers, so the site builds pages at the exact paper size (`@page size`) and opens the system print dialog, where the user picks any installed printer. Layouts: one per page (borderless fills the paper), as many as fit at true size, 2/4/9 per page, copies, cut marks.

## Real faces kept, no distortion (Oct 26, v58)
- `js/face-keep.js`, `FS.keepFaces(original, result)`: for prompts that must stay a photograph of the same people (`REAL_KEEP` "very same people", smart edits "Keep everything else exactly as it is"), `FS.restyleTry` lays every original face back into the AI result. It runs on this computer, with no internet:
  - MediaPipe FaceLandmarker on both pictures;
  - each face matched by place and size;
  - a least-squares similarity fit on 15 stable points; a fit error above 7.5% of the face width leaves the model's face;
  - the original warped onto the new head;
  - colours moved 55% towards the new light (mean/std in the oval);
  - laid in through the face oval pulled in a little and blurred.
- Tried on the live comparison results: 2 faces restored per picture in about 0.3s (2.6s on the first, with the model loading). Results that redrew the people at another size are left as they are.
- On/off: `fs-ai-keepfaces` (on by default), "🙂 שמירת הפנים המקוריות" in the AI tab and the workspace's engine card. Cartoon-style looks (the KEEP prompt) are never touched.

## Free and faster: the cloud and this computer together (Oct 26, v57)
- The owner wants no paid engine. So, in the desktop program with the local engine installed, auto mode online runs the free cloud (3 at once) **and** this computer (1 more lane, `engine: 'local'`) at the same time (`both` in `FS.runAI`; the busy sign says "כולל המחשב").
- When the cloud answers quota / no-free-tier / rate-limited / engine-off / ai-failed, `askServer` sends pictures straight to the local engine for 30 minutes (`cloudOff`, `FS.cloudOff()`), so no time is lost waiting on a cloud that ran out. The local engine queues its runs, so parallel calls are safe.
- Local speed: the reference photo is scaled down to the size of the picture being made (`fitRef` in js/local-ai.js; fewer tokens, much faster on a processor), and the panel offers 512 "⚡ הכי מהיר" beside 768 and 1024 (`fs-ai-local-size`).
- What stays true: free cloud capacity is small (Workers AI ~8-20 pictures a day; Pollinations' anonymous limit). Free *and* fast all evening needs a graphics card in the event computer (the same FLUX.2 klein 4B then makes a picture in seconds).

## Lifelike AI on real people (Oct 26, v56)
- **Compared on the live server** (`frame-ai-compare.yml` + `.github/scripts/frame-ai-compare.mjs`, one event photo `.github/ai-compare/wedding-*.jpg`, the real-person looks, results with times on the branch `ci-ai-compare`):
  - FLUX.2 klein 4B given the old 496px copy (`small`) drew new, generic people;
  - given the 1024px photo it kept the same faces and framing and looked like a real photo (about 6-8s);
  - FLUX.2 dev drifted further from the faces;
  - Workers AI sometimes refuses real-person results (3030 "output flagged", then the next model is tried);
  - the free daily neurons ran out after about 8 pictures, and Pollinations answered 402 FREE_LIMIT.
- So `FS.restyleTry` sends the same 1024px JPEG as `image` and `small`. The real-person prompt (`REAL_KEEP`, also used by the heroes) asks to keep the framing, the camera angle and the people's size, and to change only clothes, look and surroundings.
- The hubs server takes `fluxModel` (klein-4b / klein-9b / dev) to put one FLUX model first (default order unchanged).
- Offline, the local engine runs the same klein 4B on the 1024px photo, so the quality matches; its speed depends on the graphics card.

## Fast switch, 4/6/9 edit screen (Oct 25, v55)
- `#mt-switch` (mate.js): one fixed switch "⚡ עבודה מהירה | 🎨 סטודיו עיצוב" on both screens (top centre in the workspace, bottom above the status line in the studio, bottom on phones), and F2 toggles (`FS.mate.toggle`). The old "⚡ סביבת עבודה" and "🎨 הסטודיו המלא" buttons are gone. A switch takes ~10–50 ms: grids keep their drawn canvases (`keepCanvases`/`reuse`, by photo and size; `drawTile` redraws only a photo whose doc changed), and closing selects the photo on the next frame only when it changed.
- The edit view ("ערוך תמונה") shows a page of 4 (2×2), 6 (3×2) or 9 (3×3) photos filling the screen (`fs-mate-en`), with paging (◀ ▶, PageUp/PageDown). "🔗 עריכה של כל התמונות שבמסך יחד" (`fs-mate-etog`, on by default) makes every change (sliders, auto, reset, title, frames, effects, clipart) reach all the photos on the page, redrawn live while the slider moves.

## Faster AI at events, photoreal looks (Oct 25, v53)
- `FS.runAI` runs up to 3 photos at once (one at a time on the local engine); the busy sign counts the ready ones. The cloud photo is 1024px JPEG 0.86 (was 1280 at 0.9), and the server's per-address picture limit is 120 an hour (`IMG_IP_HOUR`).
- Measured live on Oct 25 (`frame-ai-health.yml`, 512×768): auto 7s, FLUX on Cloudflare 8s, Pollinations gptimage 6s; Gemini still 429 (no billing). Once FLUX's free daily neurons run out, only Pollinations is left (one picture per 45s per address), so lasting speed at events needs billing on Gemini or Workers Paid.
- `FS.AI_HEROES` (v54): 12 superhero looks on the real people (classic suit and cape, high-tech armour with the helmet open, night vigilante, lightning, fire, ice, flying over the city, a team, a warrior heroine, a kid hero, a movie poster, cosmic). Original costumes only: no known characters, logos or brands, the faces uncovered. "🦸 גיבורי על" in the AI tab and the workspace.
- `FS.AI_REAL` (ai-studio.js): 30 looks that keep a real photograph of the same people (Hollywood, magazine cover, business headshot, wedding attire, gala, the 20s/50s/70s, wild west, knights, pilots, doctors, chefs, football, rock stars, runway, astronauts, Paris, New York, Venice, the Maldives, the Alps, safari, a yacht, the Western Wall, the Dead Sea, evening make-up, a family studio portrait, a lantern festival, 20 years younger). In the studio's AI tab ("🧑 על אדם אמיתי") and the workspace's AI view.

## Paid program updates, managed by the owner (Oct 23, v52)
- **Server** (`n8n/snippets/access-handle.js`, tests `[updates]` in `n8n/test/access.test.mjs`): a licence may run desktop versions ("1.0.N") up to `L.appVer`, set from the version it was first activated or checked with. `sd.appUpd = {versions:[{ver, notes, price, free, at}], price}`. `updFor(L, running)` rides on every `lic-activate` / `lic-check` answer as `upd`: `latest`, `allowed` (a download link only then), `locked` (running a version newer than approved and not covered by a free update), `back` (the approved version's installer), `req`. A page version like "52" (the online studio) is never locked.
  - Licence holder: `upd-request {token, ver}` (4 a day) emails the owner.
  - Admin: `upd-publish {ver, notes, price, free}`, `upd-unpublish`, `upd-settings {price}`, `upd-grant {email, ver, amount, method}` (adds a payment with `kind: 'update'`, raises `appVer`, clears the request). `lic-list` returns `upd`; each licence view has `appVer` and `updReq`.
- **Studio** (`js/updates.js`, loaded right after account.js): wraps `FS.license.check/activate`, keeps `fs-upd`; "⬆️ עדכון גרסה" in ☰ (red dot when there is a newer one) and in the workspace; the dialog shows what's new and the price, "📨 בקשת העדכון", WhatsApp to Haim, or "⬇️ הורדה והתקנה" once approved. An unapproved version shows `#upd-lock` (remembered per version in `fs-upd-lock`, also offline) with the way back. The owner is never locked; in a browser nothing shows.
- **Desktop** (`main.js` IPC `app:update`, preload `FSDesktop.update(ver, onProgress)`): downloads only `releases/download/desktop-v<ver>/FrameStudio-Setup-<ver>.exe`, checks it is an exe (MZ, >5MB), runs it with `--updated` (data and the local AI stay) and quits.
- **Admin** (`js/admin-licenses.js`, "⬆️ עדכוני גרסה"): default price, publish a recent build (from the GitHub releases) with notes, price or free, the published list, open requests with WhatsApp and "✔ אישור", and ⬆️ per licence.
- Every push still builds a new installer and moves `desktop-latest`; customers who install it without approval get the lock and the way back.

## The fast workspace, no site name on photos, more AI (Oct 23, v51)
- **`js/mate.js` + `css/mate.css`** (`FS.mate.open/close/print`): a full-screen workspace over the same photos, where the studio opens (`fs-mate` = on/off, remembered). Tabs:
  - **ראשי**: a tile per photo with its print size ("10X15"), copies (− / + per tile, 0 = not printed; `p.copies`), ✓ mark (`S.marked`), 🔍 and the name. Bars: 📐 size (`FS.mySizes()`, להתאים/לחתוך = `FS.fitPhoto(d, img, 'contain'|'cover')`, turned to the photo's direction, on the marked photos or all), 📁 photos (mark all/none/invert, show filter, sort, remove), 🧾 copies, 🏷️ business details (add / remove the credit layer on request). Tiles draw from their own small cache (`p._mc`, a proxy object to `FS.draw`), lazily, a few per frame.
  - **ערוך תמונה**: big tiles + a panel: colour correction (brightness, contrast, exposure, saturation, warmth, **R/G/B** = new adj fields `cr/cg/cb` in `FS.ADJ0`, sharpness), title (a linked `mt-title` layer), frames (base + user PNG), effects (the presets with previews, the pro styles), clipart (emoji, logo). Changes reach the marked photos (or the highlighted one); "החל את התיקון על כל התמונות".
  - **עורך מלא**: one photo on a big canvas (drag to move the photo or an object, wheel to zoom), a folder browser (`showDirectoryPicker`, subfolders, thumbnails, click to bring a photo in), and tools underneath: general (frame, auto level, sharpen, clarity, backlight, film tone, filters, resize, rotate/flip, quick sliders), objects, crop (sizes, fit/crop, centre on faces), AI; save, print, undo/redo, undo all.
  - **AI**: on-computer tools (auto, face light, skin, centre, full, background blur/white/B&W/remove, face blur, eyes & sharpness check, mark the best), the engine bar, smart edits (`FS.AI_EDITS`, 18: restore, colourise, enhance, studio light, smiles, open eyes, remove people, new backgrounds, confetti, snow, extend), viral and styles.
  - **הדפסה** (dialog): printer (`FS.choosePrinter`, through the helper), paper (`FS.PAPERS`), DPI (`plan.dpi` → `FS.pageCanvas`), true size (margins, cut marks) or page size (fit / crop, one per sheet, turned to the sheet), which photos, a page-by-page preview, print the current page or all, saved settings (`fs-mate-print`).
- **No site name**: the business line (`FS.BIZ.credit.on`) is off by default and was turned off once for everyone (`fs-credit-off-v1`); `business.json` credit.on is false. The studio's title and welcome say "סטודיו עריכה", and saved PDF/ZIP names are the date (`FS.outName()`).
- **AI**: 80 `FS.AI_STYLES` (18 new: cinematic B&W, golden hour, bokeh, fashion cover, charcoal, pastel, stained glass, mosaic, ukiyo-e, impressionism, gold leaf, neon night, Mediterranean beach, garden, castle, 80s, polaroid, caricature) and the smart edits also sit in the studio's AI tab.

## Offline, light, base frames (Oct 2026)
- **Everything AI runs locally.** These are shipped with the site, and the service worker keeps them in their own cache (`frame-studio-ai-v1`):
  - In `vendor/`: MediaPipe tasks-vision 0.10.14, onnxruntime-web 1.20.1 (WASM build), pdf.js 3.11.174 and qrcode-generator.
  - In `models/`: the selfie multiclass and selfie segmenters, the BlazeFace detector, the face landmarker and the AnimeGAN ONNX model.
  - The "עריכות AI" tab (`js/ai-studio.js`, data-tab `styles`) is real image AI only: a combination builder (`FS.AI_COMBOS`: 26 styles × 26 worlds × 21 outfits × 13 moods, 🎲 surprise), 30 ready combinations, the 36 `FS.AI_STYLES` and free text. `FS.runAI(prompt, label, list)` runs photo by photo; the busy sign's ⏹ (`FS.busy(msg, onStop)`, `FS.aiStop()` aborts the request in flight) stops it, and photos done so far keep their result. The photos screen's 🤖 AI menu runs the same on the picked photos. The drawing styles and the in-browser anime were removed at the owner's request (the pixel style engine stays so old projects render; `js/anime.js` is no longer loaded). Each restyle starts from the original (`p.origSrc`), sending a 1280px copy (`image`, for Gemini) and a 496px one (`small`, for FLUX).
  - Server (`n8n/build-hubs-workflow.py`, generated into the Worker): restyle/image tries Gemini's image models first, then OpenAI `gpt-image-1` (edits / generations through `fetch`, when OPENAI_API_KEY is set), when GEMINI_API_KEY is set (a key without image allowance is skipped for 6 hours, `sd.gemImgOff`), then FLUX on Workers AI. A FLUX answer carries `skipped` (why the better models didn't answer), and the deploy log prints it; FLUX out of its daily 10,000 neurons stops at once and answers `quota`.
- **Light files.**
  - Photos over 3000px (`FS.PHOTO_MAX`), or JPEGs over 4MB, are re-encoded on arrival.
  - Frame files are compacted to at most 2400px, WebP with alpha when that is smaller (`FS.compactFrame`); stored old frames are compacted once on load.
  - The photos screen caches a small whole-photo thumbnail per photo (`p._gt`).
- **Base frames.** `FS.BASE_FRAMES` holds six plain white frames (thin, classic, wide, band for text, rounded, oval), drawn in any colour. They are the only ready frames in the studio and come first in the designer. The decorated frames stay for the site's samples and the event templates.
  - "🗑 מחיקת כל המסגרות השמורות" clears the user frames, and a one-time question (`fs-frames-clean-v1`) offers it.
- **Photos screen** shows each whole photo uncropped by default ("🖼 כל התמונה"), or "🧲 כמו בהדפסה".
- **Designer (`js/inv-frame.js`)**:
  - **AI frame like the invitation (the main way, "🤖 מסגרת AI כמו ההזמנה"):** `FS.aiFrameFromInvite(img, W, H, {round, band})` sends the invitation, placed on a canvas of the frame's shape (image models answer in the shape they get), to the image AI (`restyle`). `FS.invFramePrompt` asks for a new frame in the invitation's exact colours, paper and ornaments, with a window of flat pure green (#00FF00) and no text. `FS.keyGreenWindow` cuts the green part holding the centre (or the biggest one), fills specks inside it and cleans the green fringe, giving a PNG frame. Every result stays as a thumbnail to pick from (`#ai-frames`). Names and date are added as text afterwards.
  - **"✨ הכי איכותי: ליצור ב־ChatGPT או ב־Gemini" (`#ext`):** for the owner's own ChatGPT / Gemini account. It gives the invitation on a canvas of the chosen shape (`FS.invShot`), copies the instruction (`FS.invFramePrompt`), and links to chatgpt.com / gemini.google.com (plus Web Share to the apps on phones). "📥 העלאת המסגרת שקיבלתי" cuts the green window with `FS.keyGreenWindow`; when the answer's shape differs from the chosen one, the matching shape is used.
  - The basic offline builder below is folded under "גרסה בסיסית, בלי אינטרנט": `FS.frameFromInvite(img, W, H, {border, band, text, accent})` rebuilds the invitation's own border around the photo at any size. It uses nine parts: corners kept, edges repeated mirrored, a names band in the invitation's paper colour, and the window cut see-through.
  - Buttons make a portrait, landscape or square frame from it. The result is kept in the design as `D.invFrame` (WebP) and registered as a PNG frame.
  - `FS.ELEMENTS` and `FS.elementCanvas` give 15 ornaments drawn in code, in any colour. `FS.textCanvas` adds free text.
  - Elements are added on the 🧩 tab and deleted with 🗑 or the Delete key; "ניקוי כל האלמנטים" removes them all.
- **Videos.** The site's `#videos` section holds the three promo films plus `media/explainer.mp4` (60s); show.html plays the studio film. The old `media/promo.mp4` (styles that are no longer offered) was removed.
- **Promo films (Oct 22):** `media/promo/{site,studio,app}.mp4` (16:9, ~45s each) and `*-v.mp4` (9:16 for status, Reels and TikTok), with posters `*.jpg`. They are made by `videos/promo-src/build.py`, which generates six HyperFrames projects (`videos/promo-{site,studio,app}{,-v}`, git-ignored) from one scene spec. The pictures are real: screenshots taken with `videos/promo-src/capture/cap*.cjs`, the sample photos and show images, and the local-AI end-to-end pictures in `promo-src/e2e`. Render each project with `npx hyperframes@0.8.185 render -o renders/video.mp4`, then encode for the web (H.264 CRF 25/26, faststart, loudnorm -15 LUFS); the commands are in the PR that added them (#379).
  - Music: Kevin MacLeod (incompetech.com), CC BY 4.0 ("Inspired", "Upbeat Forever", "Beauty Flow"), credited on each end card and under the site videos (`promo-src/music/CREDITS.md`). The tracks were fetched by `.github/workflows/ci-music-fetch.yml` (incompetech and FreePD are blocked from the sandbox); MusicGen was not used because its weights are non-commercial.
  - The admin home has a "🎬 סרטוני תדמית" section: each film plays, with downloads in both shapes and a WhatsApp share (`PROMOS` in admin.js). The desktop bundle leaves `media/promo` out (streamed from the web).

## Collages, choosing photos, slideshow; the look (Oct 2026)
- **Look:** all four screens share one identity, a design studio for graphic and photo design.
  - **Palette and type:** velvet black, champagne gold foil and ivory, in Frank Ruhl Libre, Assistant and Heebo.
  - **Where it lives:** the studio in `css/lux-studio.css` (its `--ink` means ivory there; the near-black is `--lx-ink`), the admin in `css/lux-admin.css`, the main site in `css/lux-site.css` + `js/lux.js`, and the showcase in `show.*`.
  - **No fridge or magnets theme:** magnets are one product among several.
- **"קולאז׳" tab (`js/collage.js`):**
  - `FS.collageLayouts(ars, W, H, gap, mode, seed)` tries up to 4000 guillotine trees. Split ratios follow the photos' aspects, and the cost is crop + small cells + uneven sizes, or the first photo at about 45% in `hero` mode; `grid` is a uniform grid. It returns up to 12 distinct layouts ("🔀 סידור אחר").
  - `FS.drawCollage` cover-crops around `p.faces`, and adds margin, gap, corner radius, background and an optional title band.
  - The result is added as a photo with `applyFormat('cm', W, H)` (`p.collage`).
- **"בחירה ומצגת" tab (`js/curate.js`):**
  - `FS.scorePhoto(p)` → `p.rate`, a score from 0 to 100: sharpness via Laplacian variance (40), exposure via histogram middle and clipping (25), faces with eyes open (20) and smiles (15), using `FS.getLandmarker()` blendshapes. Reasons: מטושטשת / חשוכה / שרופה / עיניים עצומות.
  - `FS.scoreAll` adds near-duplicates (64-bit dHash, Hamming ≤ 6); in each group only the best stays good.
  - Weak photos are listed with their reasons, and can be marked or removed.
  - `FS.slideshow(list, sec, title)` plays the best N spread over the evening: a canvas with a blurred fill, a slow move towards the faces and dissolves. ⏺ records it with MediaRecorder (mp4 where supported, otherwise webm).
  - **Transitions:**
    - 14 transitions sit in the `TR` table (`FS.slideTransitions`). "אקראי (מתחלף)" is the default; it shuffles without repeating a transition twice in a row.
    - Slides are prerendered once (`makeFrame`), with the blur made by drawing small and stretching back.
    - Controls: a transition select with a live preview, transition length 0.4–2.5s, seconds per photo, and the same select in the player bar. They are saved under `fs-slide-prefs`.
    - The recording captures the same transitions.
  - `scoreAll` yields to the browser about every 14ms (requestIdleCallback), so scoring hundreds of photos doesn't freeze the page.
- `FS.busy(msg, onStop)` shows ⏹ on the busy sign, which lives in `.stage` so it shows on the photos screen too.

## Admin-only studio, calendar sync, the invitation as the magnet (Oct 2026)
- **The studio opens only for the owner** (`js/gate.js`, `css/gate.css`). `<body class="gated">` hides everything until `FS.account.isAdmin()`. A device signed in as admin opens at once, even offline at an event. `FS.account.me()` then checks with the server, and a signed-out, revoked or non-admin session closes it. Anyone else gets `FS.account.form(..., { adminOnly: true })`.
  - This hides the tool; the protection itself is on the server, since business data needs an admin token there. The public site no longer links to the studio.
- **Two screens in the admin** (`js/admin-views.js`): "⚙️ מסך מנהל" and "👁 מסך לקוח". The customer screen shows the site as customers see it (main site, showcase or designer) in a frame, at desktop or phone width.
- **Admin locked out:** the admin password comes from the GitHub secret ADMIN_PASSWORD. Never write the password in code or commits.
  - When the secret's hash changes, the server resets the admin password to it and clears lock-outs.
  - `RESET` in `.github/scripts/cloudflare-deploy.mjs` (now 'v2') changes that hash once for the same secret value. Bump it, then run the Cloudflare deploy after the owner sets the secret.
  - The emailed "forgot password" needs BREVO_API_KEY or RESEND_API_KEY, and none is set.
- **Calendar sync** (`admin-biz.js`, `#cal-link`): "📅 הוספה ל־Google Calendar" opens `calendar.google.com/calendar/render?cid=webcal://…/frame-cal?k=…`, which subscribes the private feed in the signed-in Gmail account. There is also an Apple/Outlook `webcal:` link, and the raw link sits under a fold. Google refreshes such feeds every few hours.
- **The invitation itself as the magnet** (designer, invitation tab, "💌 מסגרת מההזמנה"), the main way to make a frame from an invitation. It is made automatically as soon as the invitation is uploaded (`imCreate('smart')` in `openInvite`), and "💌 יצירת המגנט מההזמנה" makes it again.
  - `FS.inviteAsMagnet(img, W, H, rect, shape, edge)` keeps the invitation untouched (cover-fit) and cuts the window. It returns `{canvas, hole, map}`, where `map` is where the invitation sits on the page, so a window moved on the magnet maps back.
  - Shapes: rect, round, oval, arch.
  - Edges: `none`, `line` (a fine line in the invitation's darkest tone), `double`, and `mat` (a paper-coloured passe-partout inside the window).
  - `FS.invSmartWindow(img, aspect, area)` finds the quietest spot on the invitation (the least edge detail, via an integral image on a ~96px map) for a photo-shaped window: 4:5 on a tall invitation, about 4:3 on a wide one.
  - Placement buttons (`data-place`): smart, big, center, top, bottom. The magnet format is the one closest to the invitation's proportions, and the designer's names, date and line are cleared.
  - The window stays editable (`IM`: format, rect, shape, edge, map, key):
    - the sliders, ➖/➕ and the placement buttons;
    - the `#inv-sel` box on the invitation (drag to move, corner handle to resize, or draw a new box);
    - directly on the preview `#cv`, where the corners resize the window and its edge moves it. The move is shown live as an outline and rebuilt on release (`imFromPage`).
  - Rebuilds drop the previous invitation frame from `FS.USER_FRAMES` and `FS.IMGS`, so memory doesn't grow.
  - **Editing everything on the preview** (design.js, `overlay()` + the `#cv` pointer handlers):
    - the photo is dragged inside the window and the wheel zooms it (`PZ`, preview only);
    - texts with a stable key (`mg0…` from `buildMagnet`, `biz`, `line`) are dragged, resized with their round handle, or resized with the wheel when selected. The changes are kept in `D.lay[key] = {dx, dy, k}` and applied in `build()`;
    - ornaments are dragged and resized with their handle.
  - The other ways (AI frame, ChatGPT/Gemini, the basic offline frame, auto-design with ornaments, cutting pieces) are folded under "עוד דרכים" (`.dz-more`), because the owner found the ornament version tacky.

## Showcase page (`show.html`, Oct 2026)
A designed landing page for customers, linked from the site's nav ("✨ החוויה"). Its look: a fridge door at night, with enamel #EEF0F3, night #14101F, horseshoe-magnet red #E5383B, steel and foil gold. Type is Karantina for display, Assistant for body text and Rubik 900 for the letter magnets.
- **Hero:** the headline "על המקרר" is coloured plastic letter magnets. A camera flash plays on arrival, and photo magnets (`show/m*.webp`, the site's sample magnets) snap on and can be dragged.
- **"דקה אחת":** pinned and scrubbed by scroll (GSAP ScrollTrigger). A stopwatch runs 0:00 to 1:00 through flash, frame, print and in hand, and the card goes into the printer and comes out framed.
- **Styles:** one photo in ten styles, with a clip-path wipe (`show/p-*.webp`).
- **"המגנט שלכם" (`#yours`):** a live magnet. Names, date, event type, frame colour and the visitor's own photo (an object URL, never uploaded) update it as they type. "שולחים לנו את העיצוב בוואטסאפ" opens wa.me with the names, date, event and colour.
- **The fridge wall:** a magnet per event type, each with a label-maker tape, linking to its page in `l/`.
- **Packages and FAQ:** price tags held by magnets. Both are read from `business.json`, with a built-in fallback.
- **The rest:** the promo film, the booking block (WhatsApp, phone, form, designer), and magnetic CTAs.
- Page-to-page cross-fade with `@view-transition`. The shared mobile sheet's padding on `<main>` is cancelled here, so sections run edge to edge.
- GSAP 3.14.2 is vendored in `vendor/gsap/`. Without it, or with reduced motion, every section shows its final state.

## Clean editor, offline AI tab, printer and event summary (Oct 2026)
- **No top row (`js/shell.js`).** `body.clean-shell` hides `.standalone-bar` and `.topbar`.
  - Undo / redo, ◐ original and `#fmt` move into the stage bar (`.sb-quick`); 🖨️ print, 💾 save and ☰ (`#sb-menu`: business details, packages, deals, site admin, install, business site, invitation frame) go to `.sb-act`.
  - The event, text & stickers and games tab buttons are removed. `FS.openTab('event'|'games')` falls back to photos; the text pane still opens when a layer is selected. The event template (`prefs.eventOn`) is forced off, and the intro's "אירוע חדש" is hidden.
- **Undo.** `FS.undo` / `FS.redo` step every photo being batch-edited, not just the current one. `FS.resetEdits()` (⟲ איפוס in the stage bar) returns to the photo as it came in (first snapshot, AI restyle undone) and is itself undoable. The undo button shows the number of steps.
- **The computer's printers (`helper/`).** A web page can't list printers, so a small local helper answers on `http://localhost:17777` only:
  - Windows: `frame-print.ps1` + `start-frame-print.bat` (PowerShell HttpListener; `Win32_Printer` / `Win32_PrintJob` for state, Windows-reported problems such as no paper or low ink, and queue; prints a 300dpi sheet JPEG with `System.Drawing.Printing` on the printer's closest paper, from the paper's edge).
  - Mac / Linux: `frame_print.py` + `frame-print-mac.command` (CUPS `lpstat` / `lpoptions` / `lp`).
  - Both send CORS and `Access-Control-Allow-Private-Network`. The downloads are `helper/frame-print-windows.zip` and `frame-print-mac.zip`; rebuild them when the scripts change.
  - In `printlog.js`, `poll()` reads `/printers` every 5s (15s while it's not running). "המדפסות במחשב" in the output tab lists each printer with its state and queue, plus "חלון ההדפסה של המחשב". The choice is kept in `frame-studio-printer-sel` (the default printer is picked once), and every printer keeps its own ink/paper counters (`frame-studio-printers`).
  - When a printer is chosen, `FS.doPrint` goes through `FS.directPrint(plan)`: `FS.pageCanvas` per sheet is POSTed to `/print`, and the same `printed` / `print-job` events fire. The preview and the status line show the printer, its state and its queue.
- **Printer and print log (`js/printlog.js`).** Most printers don't report ink to the computer, so:
  - The owner sets a printer profile once (`localStorage` `frame-studio-printer`: name with a model list, type dye/inkjet/laser, prints per ink set and per paper roll, used counters, "החלפתי דיו" / "מילאתי נייר", a test page). The print preview shows it on top and asks for it on first print.
  - `doPrint` emits `print-job` with the plan. Each job is logged (`frame-studio-printlog`: sheets, photos, per-size counts, paper, printer), photos get `p.printed`, and a toast shows sheets out and estimated ink/paper left.
  - `#pl-bar`, fixed at the bottom left: printer, sheets sent, sheets still waiting (`FS.planPrint` over unprinted photos with the print panel's settings) and ink/paper estimates. A click opens `FS.printSummary()`: photos printed, by size and by paper, sheets, a jobs list, CSV, copy, and "סיום ואירוע חדש" (archived to `frame-studio-printlog-past`).

## Pro workflow (filmstrip, batch, styles, print plan, library)
- **The photos screen (`js/grid.js`, `#gv`).** Two or more photos added at once open the photos screen instead of the editor. Every photo is spread out on the main screen, and the tile size is a slider.
  - Picking: a click picks a photo, Shift picks a range, Ctrl+A picks all, Esc clears. A double-click or ✏️ opens that one photo.
  - Show filters: all, picked, edited, untouched or failed, plus a size filter.
  - Actions on the picked photos, right on this screen: 🎨 filter (every preset and my presets), 🖌️ instant style, 📐 size (the formats, my saved sizes, or a new size in cm that can be saved with a name), copies and remove.
  - "✏️ עריכת N התמונות" opens the editor with batch editing on. The strip then shows only those photos (`S.onlyMarked`), and "▦ כל התמונות" (`#to-grid`) goes back.
  - Exposed: `FS.showGrid()`, `FS.gridMode()`, `FS.isEdited(p)` (the business credit line does not count) and `FS.select(i)`. `FS.emit('photos-added')` fires after files are added.
- **Sizes.** Seven fixed base sizes (`FS.BASE_SIZES`: 7.5×10, 10×7.5, 10×10, 10×15, 15×10, 15×20, 20×15 cm, ids `b<w>x<h>` in mm) plus any number of the owner's own (`FS.prefs.sizes`, `[{id, name, w, h}]` in mm; `prefs.sizesV2` dropped the old seeded 5×7.5 sizes once).
  - `FS.mySizes()` (base + own), `FS.userSizes()`, `FS.saveSize`, `FS.delSize`, `FS.sizeOf('my:<id>')`, `FS.sizeOfDoc(doc)` (matches a page by mm), `FS.sizeLabel(z)`, `FS.syncFmt()`, `FS.manageSizes()` (base sizes shown fixed, own sizes editable).
  - Only these show in `#fmt` (two optgroups, plus "＋ הוספת גודל / ניהול" and a "נוכחי" entry when a page matches none), `#fmt-new` (with a 📐 גדלים button), the ☰ menu, the photos screen's 📐 menu and the print preview's per-photo size. Applied as `applyFormat(doc, 'cm', img, w, h)`. `FS.FORMATS` remains only for the site samples and the designer.
- **Any number of photos.** Photos are blob URLs (`FS.addPhotoFile`), thumbnails are drawn only when they scroll into view (IntersectionObserver), and only the photo on screen keeps a big preview (`p.cache` is cleared on switching). 150 photos load in about 3s. Project files and "my designs" turn blobs into data URLs on save (`FS.toDataURL`, async `FS.projectOf`).
- **Filmstrip (`ui.js`).** Each tile shows the frame name, the size in cm, `×copies`, 🎨 for a style, 🤖 for an AI restyle, and a quality badge. Click selects. Ctrl/⌘+click or the checkbox marks a tile, and Shift marks a range. The bar has mark all / clear / invert / "פסולות", copies for the marked photos (`p.copies`) and remove. **Batch is automatic**: marking two or more photos turns it on (`S.batch` is undefined = on, ✏️ toggles it off), and marking a photo brings a marked one onto the screen, so `FS.targets()` returns every marked photo, and `FS.batch(fn)` copies the change from the current photo to the rest. It covers sliders, tone, auto, reset, presets, frames and frame options, rotate/flip/fit, page size, background colour and styles. The event tab's "להחיל" applies to the marked photos, and "📋 העתקת הטקסט והמדבקות" copies layers to them.
- **Linked layers.** Frame words (`link: 'ft<i>'`), magnet words (`'mg<i>'`, `'mglogo'`) and layers added or copied while photos are marked share a `link`. `FS.syncLinked(L, keys)` copies text, colour, font, size, position, rotation and toggles to the same layer on every marked photo. Deleting a linked layer deletes it on all of them.
- **AI accuracy.** Person masks use MediaPipe's multiclass 256 model (with the selfie model as fallback), are brought up to 1024px and refined on the photo's edges with a guided filter. Faces are found on the whole photo plus five overlapping tiles and merged, so small faces in group photos are found too. AI restyles send 1536px and a prompt that keeps identity, the number of faces and the aspect ratio. The answer is centre-cropped back to the original's shape.
- **Motion.** Line icons on the tool rail, a ripple on press, a gold sheen on primary buttons, panels and tiles that slide in, a spring on dialogs and toasts, custom sliders and a turning-lens loader. The site's sections rise in on scroll. All of it turns off with `prefers-reduced-motion`.
- **Stage.** "▣ עריכה" or "◧ מקור | עריכה" (split: the untouched photo on the left, the page on the right). Zoom −/100%/+ (`S.zoom`). Info shows px, cm, 300dpi, zoom and copies. A histogram (RGB + luminance) sits in the adjust tab.
- **Custom size.** "📐 גודל מותאם (ס״מ)…" in the size menu, or `cm` in the event tab: `FS.applyFormat(d, 'cm', img, wmm, hmm)` sets `d.mm`. `FS.mmOf(d)` is the true size used everywhere.
- **Styles tab (`styles.js`).** 22 instant styles (also: old photo, soft pastel, colouring page, blueprint, mosaic, lomo, gold engraving, thermal), 11 in-browser AI looks (anime plus a style on top), 36 AI transformations. Instant styles run in the pipeline as `doc.photo.style = {id, amt}` (Kuwahara with integral images, Sobel ink, halftone, screentone, posterize…; at most 1400px, then mixed back): cartoon, comic, manga, pop, graffiti, sketch, oil, watercolor, stained, neon, pixel, glitch, duotone, noir. There are 20 AI transformations (3D animation, anime, manga, comic, superheroes, animals, graffiti, clay, oil, watercolor, pixel game, cyberpunk, fairy tale, astronauts, royalty, pop art, chibi sticker, caricature, 1920s, costumes) plus free text. Each sends a 1280px JPEG to the hubs server's `restyle` action (Gemini image model). The answer replaces `p.src`, and the original stays in `p.origSrc`; "↩ החזרת המקור" brings it back.
- **Print plan (`output.js`).** `FS.planPrint(job)` gives pages of `{p, x, y, w, h, rot}` in mm. Items of the same size share sheets. Layouts: fill-at-true-size with a gap, or 1/2/4/6/9. `FS.printPreview()` opens the layout dialog: paper, layout, margins, gap, cut marks, totals (items, sheets, per sheet, paper use), and a row per photo for include, frame, size and copies, with live page previews. `FS.doPrint(plan)` prints. The station calls `FS.printNow(job)` and prints at once.
- **Library (`library.js`).** "📤 פרסום לספריית האתר" renders the marked photos (1400px JPEG). It commits them with the git-data API (one commit) to `frame-studio/library/<album>/n.jpg` and prepends the album to `frame-studio/library/library.json`, using the owner's fine-grained token (Contents read/write on devops-hub) kept in `localStorage['fs-gh-token']`. Without a token, albums stay in IndexedDB (`designs` with `lib:true`). "ניהול הספרייה" removes an album from the site (one commit), and can publish local albums. The site's "אירועים" section reads `library/library.json`, shows albums by event type, and opens them in a lightbox.
- **Server.** `n8n/build-hubs-workflow.py` has the `restyle` action, rate limited per address (12/hour) and per day (200). Tests are in `n8n/test/hubs.test.mjs`, and `n8n-deploy.yml` deploys it on push.

## Deals, documents and payments (`js/deals.js`, `pay.html`)

The studio's 📑 עסקאות button opens one file per client deal, stored in IndexedDB (`frame-studio` v2, store `deals`): client, event, package (its price fills in, with a 30% deposit), extras, discount, VAT mode (none / included / plus), deposit, balance date, terms, private notes, a payments log and two signature pads. "🤝 סגירת עסקה" gives the deal a number (`fs-no-deal` in localStorage, from 1001) and prints the deal-closure document. Each recorded payment gets a number (`fs-no-pay`) and a "📄 אישור" payment confirmation. Both documents print on A4 into `#print-root` (`body.printing-doc`, RTL) and can be saved as PDF from the print dialog. The ⚙️ tab keeps the owner's payment options (Bit, PayBox, card and PayPal links, which must be https; bank details; cash/check) and document details in `FS.BIZ.pay`.

`pay.html` (`js/pay.js`, `css/pay.css`) is the client's payment page. The deal summary and payment options travel in the link (`pay.html#<base64url JSON>`, written by `FS.dealPayLink`); nothing is stored on a server. It escapes everything and only opens https links. A payment confirmation is not a tax invoice or receipt; official ones come from a licensed invoicing service.

## Accounts and the business's data on the server (`cloudflare/src/frame.mjs`)

- **Sign-in**: the admin and the customers use the sites' sign-in server (Cloudflare Worker `hasadna-auth`, the same one as SPIDER's): email and password (PBKDF2), an initial password by email, choosing one's own, lock-outs, new devices approved by email, and the owner's authenticator code when `ADMIN_TOTP_SECRET` is set. `js/account.js` (`FS.account`) wraps it.
  - Customers sign up from `design.html` with `site: 'frame'`. That gives them `sites: ['frame']`, plan `frame`, no end date, and emails in the frame shop's name, open even when SPIDER's own sign-up is closed (`n8n/snippets/access-handle.js`, test `[frame]` in `n8n/test/access.test.mjs`).
  - **Emails only go out when the Worker has `BREVO_API_KEY` or `RESEND_API_KEY`.** Without one, no initial password arrives.
- **Data**: it lives in its own Durable Object (`frame`). The Worker resolves the session in the `main` object (`whoIs`) and passes `{role, email}`; a page can never set it.
  - `GET /frame-site` returns the published site content (only the `PUBLIC` keys) and the owner's frames. `GET /frame-file?id=` serves a frame PNG.
  - `POST /frame-biz` (text/plain JSON with `token`): a person's own designs (`designs`, `design-get`, `design-save`, `design-del`). Admin only: `all`, `site-save`, `settings-save` (card numbers refused by Luhn), `deal-save`, `deals-import` (newer wins), `deal-del`, `expense-save`, `expense-del`, `frame-add`, `frame-update`, `frame-del`, `designs-of`, `design-of`.
  - Big values are split into 100KB chunks. Tests: `cloudflare/test/frame.test.mjs` (unit) and the `frame:` checks in `cloudflare/test/worker.test.mjs` (wrangler dev, in CI).
- **Booking requests** (`frameBook`, `POST /frame-book`, anyone, from the site's origin only):
  - Senders: the site's contact form (`#c-form`, now "שליחת בקשת הזמנה") and the chat, after it asks for a phone number.
  - The server checks the date against the calendar and keeps the request as `rq:<id>` with status `pending` and a number `R-101…`.
  - It answers `free` true or false. The calendar is the deals that hold a date (closed or with a payment), indexed in `cal`, plus the owner's `busy` dates, with `settings.perDay` events a day.
  - The same phone asking for the same date updates the open request.
  - Refused: a past date, a bad phone, or a card number. A hidden `website` field catches bots. The rate limit is 6 an hour per address and 300 a day.
  - The owner gets an email, and a WhatsApp message through CallMeBot when `CALLMEBOT_APIKEY` and `CALLMEBOT_PHONE` are set. The customer gets an email when they gave one.
  - **Only the owner approves.** Admin actions:
    - `request-decide` `approve` makes a closed deal with the next number and the package price, and puts it in the calendar. A taken date answers 409 `date-taken` unless `force` is set.
    - `request-decide` `decline` or `pending`, with an optional `answer` emailed to the customer.
    - `request-del`, `date-state`, and `cal-key`. `cal-key` makes the secret for `GET /frame-cal?k=`, an iCalendar feed of the events plus the pending requests as tentative, for Google Calendar's "from URL".
  - `/frame-site` returns `taken`, the full future dates only, and the site shows them as busy.
  - A signed-in customer reads their own requests with `my-requests`, shown in design.html → "👤 החשבון שלי".
- **Customers' accounts**: `all` also returns `accounts`, the frame customers from the sign-in data: name, email, phone, sign-up, last sign-in, online, active. `account-set` blocks or unblocks a frame-only customer and ends their sessions. Both are handled in the Worker against the main object.
- **Pages**: `FS.siteData()` merges `business.json` with `/frame-site`, so whatever is published in the admin shows at once; the site, the designer, the studio and `l/*.html` use it.
  - The studio's `FS.publishSite` and its deals (`deals.js`) go to the server when the owner is signed in. Each deal is saved locally at once and sent to the server after 2.5s. Studio links: `?deals`, `?deal=<id>`.
  - `admin.html` has a CSP (scripts only from the site, connections to `*.workers.dev` and the n8n host) and no GitHub token.
  - `js/admin-biz.js` holds these sections:
    - 📥 requests: approve, decline, WhatsApp to the customer, add to Google Calendar.
    - 🗓️ calendar: a month grid, events a day, and the private calendar link.
    - Deals, and reports (month and year, print and CSV).
    - Expenses.
    - 👥 customers: everyone with an account, a request or a deal, each with their designs, requests and deals, contact buttons, and block or unblock.
    - Payment and bank details.
  - The side menu links to the site, the designer and the studio.
  - `#requests` and the other hashes open a section. New requests are fetched every 90 seconds, with a count badge and a toast.

## The three platforms: site, customers' designer, admin

- **`design.html` (`js/design.js`, `css/design.css`)**: customers design their own frame.
  - They pick an event type, a frame (the built-in frames minus `business.json` `hideFrames`, plus the owner's PNG frames from `frames/frames.json`) and a magnet size.
  - They set names, date, hashtag, an extra line, font, frame colour and text colour.
  - Ornaments are image layers that can be dragged on the preview and changed in size, rotation and opacity. They can be flipped, duplicated as a mirrored pair, or copied to all four corners.
  - "📨 מההזמנה": an image or a PDF (pdf.js 3.11.174, first page). `js/invite.js` takes the colours locally (k-means) and asks the hubs server `ai` (tag `invite`) for names, date, venue, line, palette, font, frame and ornament boxes (0–1000). `FS.cutPiece` cuts those boxes with the edge colour flood-filled away, and the customer can cut a box by hand too. "✨ עיצוב מסגרת מההזמנה" applies all of it, with the biggest ornament placed in the corners.
  - "✨ עיצוב עם AI": a request in plain words becomes a JSON patch (tag `design`). A new ornament comes from the `image` action (FLUX on Cloudflare) with its white background removed.
  - PNG: "⬇️ שמירת המסגרת כ־PNG" (under the preview, and on the save tab) builds the page at 2x its 300dpi size (600dpi, e.g. 1182×1772 for 5×7.5). The frame is see-through where the photo goes, and "הדמיה" includes the photo.
  - Saving: designs go to IndexedDB `mydesigns` (`frame-studio` v3). There are PNG downloads of the preview and of a see-through frame, and a WhatsApp send (files shared on phones). `?owner` adds "הוספה למסגרות שלי בסטודיו" (`FS.addUserFrame`).
- **`admin.html` (`js/admin.js`, `js/admin-biz.js`, `css/admin.css`)**: the owner's business and content management, signed in with email and password (see above).
  - Sections: business details, the site's texts, packages, FAQ, reviews, busy dates, event types, and frames for customers.
  - Site texts: every element with `data-t` in `index.html` can be overridden from `business.json` `texts`, and `site.js` `texts()` applies them.
  - The draft is kept in localStorage `fs-admin-draft` on every change, comes back by itself, and "💾 שמירה" confirms it. The packages are one draft shared with the studio's 💰 editor through `frame-studio-packages`: the latest save from either one wins, and publishing writes the published list back. "פרסום באתר" re-reads `business.json` and writes only the changed top-level keys.
  - Preview: `index.html?preview` takes the draft by `postMessage` from the same origin.
  - The owner's PNG frames are committed at once (git-data) to `frames/<id>.png` together with `frames/frames.json`.
  - ✨ next to every text field asks the AI (tag `admin`) for 3 alternatives, and the FAQ section can suggest missing questions.
- **Hubs server, text on Cloudflare**: when Gemini can't answer, `ai` falls back to Workers AI: Llama 3.3 70B for text, Llama 4 Scout for one picture (as a data URL). Tests are in `n8n/test/hubs-cloudflare.test.mjs`.

## AI without Gemini

- **In the browser** (`js/anime.js`): AnimeGANv2 "face paint 512 v2" (MIT, `models/face-paint-512-v2.onnx`, about 9MB) through onnxruntime-web 1.20.1 from jsDelivr. It uses WebGPU when present, WebAssembly otherwise, and works in 512px tiles with feathered overlaps. `FS.LOCAL_AI` (in `styles.js`) holds the anime result plus an optional instant style on top (comic, cartoon, oil, sketch). It is free, has no quota, and keeps faces. The Hayao and Shinkai weights are personal-use only and must not be used.
- **On the server**: in the Cloudflare Worker, the hubs code sees `ENV.AI` (Workers AI). `image` uses FLUX.1 schnell, then FLUX.2 klein 4B. `restyle` uses FLUX.2 klein 4B, then 9B, then FLUX.2 dev, in a multipart form with `input_image_0` (the studio sends the photo under 512px, plus `w`/`h` for the output). It is free up to the daily neurons allowance. In n8n, which has no `ENV`, the old Gemini path stays.
- Tests: `n8n/test/hubs-cloudflare.test.mjs`. The Cloudflare deploy runs whenever `n8n/hasadna-*.json` changes, and its summary shows one real text and one real picture.

## Growth tools: chat, free dates, reviews, guest gallery, event pages

- **Chat** (`js/chat.js`, styles in `css/site.css`) replaces the WhatsApp button on the site. Fixed answers come from `business.json`: packages, FAQ, areas and hours. Free text goes to the hubs server (`action: 'ai'`, `tag: 'frame-chat'`) with the business facts and asks for JSON `{reply, lead, handoff}`. When the server is down or busy, it falls back to keyword and FAQ matching, then to WhatsApp. It asks for a quote step by step (event, date, guests, venue, name), checks the date against `busy`, and hands off to the owner's WhatsApp. The message carries `studio.html#lead=<base64url>`, which `js/grow.js` opens as a new deal. "בדיקת תאריך פנוי" and the package buttons open the chat.
- **Free dates**: in the deals list, "📢 עדכון תאריכים תפוסים באתר" writes the future dates of closed deals to `business.json` `busy` (dates only, no names). The contact form date shows free or busy.
- **Reviews** live in `business.json` `reviews` [{name, type, stars, text}] and `googleReviews`, and are edited in the deals dialog's ⭐ tab (`js/grow.js`). The site section `#reviews` stays hidden until there are some. Never invent reviews. In a deal, "⭐ בקשת המלצה" asks the client for one on WhatsApp.
- **WhatsApp Business replies**: the 💬 tab builds a greeting, an away message and quick replies from the real packages and payment options.
- **Receipts**: when ⚙️ has "קישור לתוכנת הקבלות", each payment gets 🧾, which copies its details and opens that service.
- **Guest gallery**: `gallery.html?a=<album id>` (`js/gallery.js`, `css/gallery.css`) shows a published album with save one and save all. In the studio's library dialog, "📱 QR לאורחים" draws a QR code (qrcode-generator 1.4.4 from jsDelivr, `FS.qrCanvas`) and prints a table sign.
- **Event pages for Google**: `l/<event>.html` and `sitemap.xml` are generated by `python3 frame-studio/tools/build-landing.py`. Edit the texts there and rerun it. `js/landing.js` refreshes the packages from `business.json`. `index.html` carries LocalBusiness JSON-LD and og tags.
- **Accessibility**: `accessibility.html` is the statement, linked from the footers. There is a skip link and visible focus.

## Offline AI built in, realistic sample photos, sign-in that stays (Oct 2026, v44)

**AI designs that need no internet** (`js/offline-ai.js`; the old `js/anime.js` is gone):
- Quality pass (Oct 22): only what keeps faces clean is offered. `FS.PRO_STYLES` (11 of the 22 pixel styles: cartoon, oil, watercolor, sketch, lineart, noir, duotone, oldphoto, lomo, pastel, manga). Pointillism was removed (muddy).
- With no internet (or a failed call with `offline`) and no local engine, a cloud design opens `FS.offlineChooser(label)`, which lists the built-in designs, instead of an error. `body.no-net` dims the cloud designs, and `.ax-cloud-note` says they need the internet.
- `FS.OFFLINE_AI` lists the built-in designs. They are run with onnxruntime-web 1.20 from `vendor/ort` (WebAssembly, one thread unless cross-origin isolated):
  - anime: AnimeGANv2 face paint, `models/face-paint-512-v2.onnx`, 512 tiles;
  - mosaic, candy, rain, udnie, pointillism: fast neural style, `models/style/*.onnx`, the whole photo at once.
- Read tensor values with `.data`: `getData()` is async in 1.20 and gave black pictures.
- `FS.restyleOffline(p, id, progress)` replaces the photo like a cloud design: `origSrc`, `aiPrev`, and "↩ ביטול AI" undoes it. Output is 1024px on the long side.
- The AI designs tab has a "🖥️ מובנה בתוכנה · עובד בלי אינטרנט" card at the top. It holds the neural styles, and the 22 instant pixel styles of `FS.LOCAL_STYLES`, applied as `p.doc.photo.style` (click again to remove).
- `#ax-net` says what works offline; the local engine also runs the cloud designs when installed.
- The desktop bundle now includes `vendor/ort` and the models (app content ~70 MB).
- Measured in a one-core container: candy at 1024px takes ~16 s, anime at 768px ~36 s.

**Realistic sample photos:**
- `js/real-photos.js` holds `FS.REAL_PHOTOS` {event type: [media/real/*.webp]}. It is loaded before `events.js` on index, design, studio and admin.
- `FS.realPhoto(type, seed)` feeds:
  - `FS.magnetCanvas`;
  - the site's `magnet()`;
  - the designer's `sample()`;
  - the studio's `#demo` and the event tab's demo photo.
- When the list is empty, the drawn scenes stay.
- The photos are AI-generated people, made in CI by `.github/workflows/frame-studio-photos.yml` (run by hand) with `frame-studio/tools/real-photos.mjs`. It tries the site's own image server first (`/hasadna-hubs` `action: image`, Gemini / FLUX on Cloudflare, no watermark), with Pollinations as the fallback (its watermark cropped), then sharp to 900×1350 WebP. Any file can be replaced by a real photo with the same name.
- Look at every new set before keeping it. In v46, henna-1/2 (Indian bridal look, a bindi) and holiday-1 (a Christmas tree) were deleted from the list and the folder.
- The homepage and show.html images (`show/p-*.webp`, `show/m0..m6.webp`, `show/mp.webp`) are rendered in a browser from these photos: `FS.magnetCanvas` for the magnets (m0 wedding, m1 bar mitzvah, m2 engagement, m3 birthday 6.6×6.6, m4 brit, m5 henna, m6 company; mp = wedding seed 5), and a 640px square crop of the wedding seed 5 photo run through `FS.applyStyle` / `FS.offlineStyleCanvas` for the styles. Show only styles that are still offered (PRO_STYLES and the built-in AI ones): original, oldphoto, noir, sketch, manga, cartoon, oil, lomo, anime, candy, rain.
- The sketch filter lifts dark tones (`0.2 + 0.8·L`) before its colour dodge and darkens the lines ×2.3: without the lift, deep shadows turned JPEG/WebP block noise into black squares.

**Sign-in that stays:**
- Licence:
  - `FS.license.check` has no 7-day limit: offline it is always ok;
  - `signed-out` (the 30-day session ended) re-activates quietly with the email and code kept in the vault;
  - only revoked, moved or unpaid closes it, and forgets the code.
- `FS.vault` (`js/account.js`): in the desktop program it uses `FSDesktop.vault` (Electron `safeStorage`, DPAPI on Windows) in `userData/vault.json`, and keeps nothing without OS encryption. In a browser it uses `localStorage` `fs-vault-*`, for the licence code only.
- The owner's email and password are kept only in the desktop program, after an admin login. `FS.account.relogin()` signs in again when `me` says the session ended.
- `gate.js` opens at once when there is an admin session, a licence or a saved sign-in, and checks in the background.
- "🚪 יציאה" (`FS.gateLogout`) forgets the vault.
- Tested: a licence 40 days old with no internet opens; an expired session gets a new token through `lic-activate`; a revoked licence closes.

## RAW developed for real, and the event folder on the computer (Oct 2026, v43)

**RAW files:**
- `FS.addPhotoFile` first uses the full-size JPEG the camera stored inside the RAW (fast).
- When there is none, it is under 1500px (many DNG files), or `FS.prefs.rawMode === 'full'`, the RAW is developed by `FS.decodeRaw`:
  - LibRaw through `vendor/libraw/` (libraw-wasm 1.6.0, ISC, ~1.4 MB wasm, its own module worker; it needs no cross-origin isolation);
  - half size, the camera's white balance, 8-bit, JPEG 0.95.
- Measured: a 26 MP Sony ARW opens from its preview in ~0.5 s; developed takes ~5–20 s.
- RAW is accepted everywhere photos come in: the main inputs, the strip's "+", drag and drop, and the folder station (`isImg` uses `FS.RAW_EXT`).

**The event folder (`js/folders.js`, card at the top of "שמירה והדפסה"):**
- `showDirectoryPicker` (readwrite, `id: 'frame-studio-events'`). The handle is kept in IndexedDB `fs-folders`; permission is checked with `queryPermission` and asked again with "חיבור לתיקייה".
- Each event gets a folder named after the event: the name field, or the live event's date + title, or the date + "אירוע". Inside it:
  - "מגנטים מוכנים": `FS.renderFull(p, 1)` as JPEG 0.95, rewritten only when the photo changed (`sig`);
  - "מקור": `p.origFile`, set by wrapping `FS.addPhotoFile`, with RAW bytes kept as they are.
- Settings in `localStorage` `fs-folders`: auto-save on `print-job`, and whether to keep the originals.
- "🏁 סיום האירוע" (also in the live tab, `#lv-finish`):
  - saves everything missing;
  - then **asks** whether to ZIP the event's folders;
  - the ZIP is streamed to `<event>.zip` next to the folder: stored, UTF-8 names, DOS dates, stopped above 4 GB;
  - the folders stay.
- Browsers without the API (Firefox, Safari, phones) get a note to use "שמירת הכל (ZIP)".
- It works in the Electron program too (checked: `showDirectoryPicker` exists, and LibRaw's worker and wasm load through the bundle).
- Testing in this container: mock `showDirectoryPicker` with the browser's private storage (`navigator.storage.getDirectory()`), and launch Chromium with `LANG=C.UTF-8`. Without it, Hebrew folder names silently write into the parent folder.

## The customer's design reaches the studio (Oct 2026, v42)

**Designer (`design.html` / `js/design.js`):**
- A "הבא ←" button (`.dz-next`) at the end of each step: frame → text → decorations → approve. The last tab is now "✅ אישור ושליחה".
- "📏 בדיקת הדפסה" (`#guides`):
  - It draws the cut line and the safe area 3 mm inside it (`safe(d)` from `FS.mmOf`).
  - `printCheck` warns in `#warn` about texts (not the business credit) that cross it and decorations that leave the magnet.
- **Approval** (`#approve`):
  - Fields: event date, phone, a note, and a checkbox confirming names, date, spelling and the print check.
  - It needs the customer's account; otherwise the account dialog opens, and the design is saved first.
  - It sends `design-approve` with the see-through print frame (`snapshot(2400, true)`, or 1800 when the PNG is over 4.1 MB) and a JPEG preview.
  - `#ap-st` shows when it was approved, and "my designs" mark it "✅ אושר".

**Server (`frame.mjs`):**
- Customer action `design-approve`:
  - Stores `dzf:<email>:<id>` (the PNG, ≤ `MAX_FRAME`) and `dzp:…` (the preview), and sets `approved` on the design and its index row.
  - Adds a row to `dzok` (newest first, at most 300).
  - Notify `{design}` emails the owner (`frameNotify`).
- Admin actions: `approved-list`, `approved-frame` {email, id}, `approved-del`.

**Studio (`js/live.js`), for the admin:**
- "🎨 עיצובים מאושרים של לקוחות" opens a list with these actions:
  - "🎯 המגנט של האירוע": `useDesign` saves `design` {email, id, name} on the live event and sets the station's `cfg.tplFrame`;
  - "🖼️ על התמונה שעל המסך";
  - "⬇️ PNG להדפסה";
  - "✏️ פתיחה בעורך" (`design.html?owner&open=`);
  - "🗑".
- `dzFrame` turns the PNG into one of the studio's own frames once (`FS.addUserFrame`, kept in `fs-live-dz`).
- `putDesign` applies it with `FS.setFrame`, and sets `p.noCredit` and removes the credit layer, because the frame already carries the business line. `FS.applyCredit` respects `p.noCredit`.
- When a station starts on an event with `design`, it loads that frame, and every guest photo arrives in it.

## Live event: guests' photos, big screen, couple's album, stations, reports, staff mode (Oct 2026, v41)

**Server:** `cloudflare/src/live.mjs` runs in the `frame` Durable Object through `State.liveCall`. Tests: `cloudflare/test/live.test.mjs` (unit), plus the `live:` checks in `test/worker.test.mjs`.

**Routes:**
- `POST /frame-live`: site origin only.
- `GET /frame-live-img?e=&p=&v=[&a=1]`: one photo, or its voice message.

**Event data:**
- An event `lv:<id>` belongs to the signed-in studio that made it: the admin, or a licensed studio (`role: 'studio'`, the email is the owner). `lvidx` maps id to owner.
- Each event has two random keys:
  - `k` (the guests' key, in the QR code): uploads only;
  - `v` (the viewing key): the big screen and the album, read-only.
- Photos:
  - meta `lp:<e>:<p>` = {st: new / claimed / printed / hidden, src: guest / studio, name, text, audio, station};
  - image `li:<e>:<p>` and voice `la:<e>:<p>`, both chunked through `FrameStore.putBig`;
  - limits: image ≤1.7 MB base64, voice ≤700 KB, 1500 guest photos per event.

**Actions:**
- Public:
  - `guest-info` / `guest-up` (key `k`; card numbers refused; 120 an hour per IP);
  - `feed` (key `v`; hidden photos left out; returns `k` only while uploads are open).
- Owner:
  - `ev-list`, `ev-save` (title, date, couple {name, phone, email}, open, copies 1–4, album, cost per magnet, price, bizName, google), `ev-del`, `ev-get`;
  - `claim` (the shared queue: each photo goes to one station; a claim untouched for 10 minutes returns to the queue);
  - `mark` (printed / hidden / new), `studio-up` (a printed magnet into the album), `stat` (prints for the report), `review-sent`.

**Cron** (`State.liveTick`, every 2 hours):
- Photos are deleted 60 days after the event (`purged`; the numbers stay).
- One to four days after the event, the couple gets an email with the album link and the Google review link, once, when mail is configured.

**Pages** (no sign-in; the keys are in the link; shared helper `js/live-common.js` → `window.FL`):
- `live.html` + `js/live-guest.js`: the guest's phone page.
  - Camera or gallery; the photo is scaled to 1600px JPEG on the phone.
  - Name, a written greeting, and a voice greeting (MediaRecorder, up to 30 s).
  - Styles: `css/live.css` on `pay.css`.
- `wall.html` + `js/wall.js` + `css/wall.css`: the big screen.
  - A slideshow with six transitions and Ken Burns; new photos jump the queue, marked "חדש".
  - Greetings appear as captions; the QR code is in the corner.
  - Polls every 6 s.
- `album.html` + `js/album.js`: the couple's album.
  - Tabs: everything, magnets, guests' photos, guest book with audio.
  - Saved photos and the ZIP carry the business's name small in a corner; the ZIP adds `ספר הברכות.txt`.
  - Print the guest book; review and CTA cards.

**Studio** (`js/live.js` + `css/live-studio.css`, rail tab "אירוע חי", before קולאז׳):
- The event: new, from a deal, edit, delete.
- The table sign: two on an A4, through `FS.printDoc` and `FS.qrCanvas`.
- Links: the wall (opens in a window), the guest link, the album link.
- Managing photos: hide, show, back to the queue.
- The open-for-uploads switch.
- The station:
  - Name, and print each photo at once or 2, 4 or "fill" on a sheet, with auto-print.
  - Double print (`copies`, set as `p.copies`).
  - "🎯 העיצוב של התמונה שעל המסך" stores `cfg.tpl` (a copy of the doc) and applies it to every guest photo with `FS.fitPhoto`.
  - It polls `claim` every 4 s.
  - On `print-job` it marks the photos printed, adds to `stat`, and uploads each printed magnet once to the album (`p.albumUp`).
- The event report: guest photos, greetings, magnets, paper cost, income, profit. A monthly report with CSV.
- Review reminders for events of the past week: a WhatsApp message to the couple with the album and the Google link.
- Staff mode: `body.staff-mode`. The PIN is SHA-256 in `localStorage` `fs-staff`. Only these tabs stay: photos, adjust, frames, output, live. The ☰ menu and the owner blocks (`.lv-owner`) are hidden. A bar offers exit with the PIN.
  - It is a convenience for an event worker, not a security boundary.

**Main site:** `index.html` `#tech` has cards for these features.

**Testing:**
- Run `wrangler dev` on 8787.
- Serve the repo on 8099.
- In Playwright, route `spider-auth…workers.dev` to localhost with `Origin: https://devopsdevopshaim-wq.github.io`.
- Put the admin session into `localStorage` `frame-session`.

## Desktop program fixes, collage shapes, undoing AI (Oct 2026, v39)

- **AI in the program**: Chromium no longer falls back to software WebGL by itself, so on a computer whose graphics driver it rejects, `getContext('webgl2')` is null and MediaPipe (faces, cut-outs, quality check, smart centring) failed with "רכיב ה־AI לא נטען" (`_glActiveTexture ... activeTexture`). `desktop/main.js` sets `app.commandLine.appendSwitch('enable-unsafe-swiftshader')`, which gives software WebGL only when the GPU is unavailable.
- **Closing**: the studio's `beforeunload` (unsaved photos) made Electron cancel the close silently, so the X did nothing. `will-prevent-unload` now asks (יציאה / ביטול) with `dialog.showMessageBoxSync`. Desktop only: a ✕ `#app-close` in the stage bar and "✕ סגירת התוכנה" in ☰ call `FSDesktop.close()` (preload → IPC `app:close` → `win.close()`).
- **Opening again**: `will-quit` shuts the local AI engine down and forces `app.exit(0)` after 4 s, so nothing keeps the single-instance lock. A second launch focuses the window, opens a new one if none is left, or relaunches if the old run is quitting.
- **Removing the program**: `desktop/build/installer.nsh` (UTF-8 with BOM, `nsis.include`):
  - `customCheckAppRunning` force-closes `Frame Studio.exe` and `sd-cli.exe` before installing or removing, because a stuck background run made the old uninstaller give up.
  - `customUnInstall` (not on updates) offers to delete `%APPDATA%\Frame Studio` (settings and the local AI, up to ~6 GB).
  - The program appears in Windows' apps list as "פריים־סטודיו (Frame Studio)".
  - In the studio, ☰ → "🗑️ הסרת התוכנה מהמחשב" calls `FSDesktop.uninstall()` (IPC `app:uninstall`): it asks, starts `Uninstall *.exe` from the install folder, detached, and exits.
  - `download.html` has a "how to remove" section.
- **Undoing AI designs**: `FS.restyle` keeps up to 5 earlier AI results in `p.aiPrev`. `FS.unstyleStep(p)` goes back one step, and `FS.unstyle(p)` goes back to the original. A "↩ ביטול AI" `#ai-undo` button appears in the stage bar whenever the photo on screen has an AI design. The AI designs tab has `#style-back` (last design) and `#style-orig` (original), both for the photo or for all marked photos.
- **Collage** (`js/collage.js`):
  - Arrangements (`SPECIAL` in `FS.collageLayouts`):
    - `polaroid`: rotated cards with a wide bottom;
    - `film`: strips with sprocket holes, from `cells.under`;
    - `heart`: a heart of small squares, where photos repeat;
    - `circle`: a big round photo and a ring around it;
    - `hex`: a honeycomb.
  - Photo shapes `#cl-shape`: rect, circle, oval, heart, hex, arch, diamond (`shapeBox` / `shapePath`).
  - Photo styles `#cl-deco`: none, white border, shadow, gold line, thin line.
  - Background styles `#cl-bgs`: solid, soft glow, paper, dots, stripes, plus colour swatches `#cl-sw`.
  - Cells may carry `shape`, `rot` and `card`.
- **Testing the program locally**:
  - Download Electron with `node node_modules/electron/install.js`.
  - Run it under `xvfb-run` with `--remote-debugging-port`.
  - Connect with Playwright `connectOverCDP`.
  - For the server, map `spider-auth...workers.dev` to a local HTTPS mock with `--host-resolver-rules`, with the mock's CA added to `~/.pki/nssdb`.

## Professional editor, richer edits, local AI (Oct 2026)
- **Look:** a pro layer at the end of `css/lux-studio.css` makes the studio a neutral graphite workspace (#121214 / #1B1B1E / #232327, hairlines in black and white with alpha), with champagne for active states and the main actions.
- **`js/pro.js`:**
  - A status bar under the photo: name, i/n, px, cm, dpi, zoom, where the AI runs, and "? קיצורים". It mirrors the hidden `#stage-info`.
  - A shortcuts sheet (`?`) and new shortcuts: `[` `]` previous/next photo, `0` fit, `+`/`−` zoom, `\` held to compare.
- **Adjust pane (Lightroom-style):**
  - Seven collapsible sections, each with a reset: אור, צבע, נוכחות, מיקסר צבעים, דירוג צבע, עקומה, אפקטים.
  - One-row sliders with a number box; double-click resets a slider.
  - New adj fields: `dehaze`, `texture`, `hsl` (8 bands), `grade` (shadows/mid/highlights hue+amount, balance), `curve` (points).
    - The object ones are `null` unless used, and `FS.adjPlain(a)` tells whether the photo needs a pixel pass.
    - `adjustPixels` stays a single pass with LUTs (a 33³ LUT for the mixer in fast preview).
  - The styling is in `css/edits-x.css`.
- **Filters:** 59 presets in category chips. Thumbnails come from one 132px copy and are drawn in chunks.
- **Local AI, desktop only:**
  - Code: `desktop/local-ai.js` (pure Node, tested by `cd desktop && node --test test/local-ai.test.js`), wired in `desktop/main.js` and `preload.js` as `window.FSDesktop.localAI`.
  - Engine and model: stable-diffusion.cpp from GitHub releases (Vulkan by default, falling back to CPU) running FLUX.2 klein 4B, the same model as the cloud. Apache-2.0, so commercial use is fine. About 5.5 GB is downloaded from Hugging Face to userData/local-ai.
  - Panel: `js/local-ai.js` and `css/local-ai.css`, reached from the AI tab and ☰.
  - Mode in `fs-ai-mode`:
    - auto: cloud when online, local when offline or when the cloud fails;
    - local;
    - cloud.
  - `FS.askServer` in `js/ai.js` routes `restyle`/`image` through `askLocal` when the mode says so; text AI stays in the cloud.
  - **Proven end to end (Oct 22)** by `.github/workflows/local-ai-e2e.yml` (`desktop/scripts/local-ai-e2e.mjs`, run by hand on windows-latest, pictures pushed to the branch `ci-local-ai-e2e`): the CPU build installed from the real GitHub/HF in 30 s (sd master-987, flux-2-klein-4b-Q4_0 2.46 GB, Qwen3-4B-Q4_K_M 2.5 GB, flux2-vae 336 MB), and 3d / anime / oil on a 512×768 wedding photo all came out at cloud quality with the faces kept, about **24 minutes each** on 4 EPYC cores. So the CPU build works at 768 by default (`localSize`) and the panel says 10–25 minutes; with a 6 GB+ graphics card (Vulkan) it should be tens of seconds (not measured).
  - **The download is visible everywhere (v50):** a floating card (`#la-float`, `showFloat` in js/local-ai.js) on every screen with %, GB and time left; the taskbar button's progress bar (`FSDesktop.progress`, `app:progress` → `setProgressBar`; red when it fails); at the end "✅ ההתקנה הסתיימה" on the card and a Windows notification (`FSDesktop.notify`, `app:notify`; `setAppUserModelId('il.frame-magnets.studio')`). A page reloaded mid-download follows it again from `status()` (`followStatus`).
  - **Installs itself:** the first opening with internet starts the download in the background (`fs-ai-local-auto`; stopping or removing it turns that off), the progress shows on the AI tab pill and the ☰ button, then `activate()` makes a 256×256 test picture and, if the graphics-card build fails, installs the CPU build and tests again. The NSIS installer says so (`customInstall`, new installs only) and runs the program at the end (`runAfterFinish`).
  - The instant pixel filters are no longer offered in the AI tab or the no-internet dialog (the owner found them ugly); without internet the dialog points to the local engine. An experiment with Magenta arbitrary style transfer and more AnimeGAN weights was judged not professional and left out.

## AI engines and more designs (Oct 22)
- **Engine choice:** the hubs server (`n8n/build-hubs-workflow.py`) takes `engine` on `restyle`/`image`: `gemini`, `openai` (gpt-image-1, needs OPENAI_API_KEY), `flux` (Workers AI, Cloudflare only) or `free` (Pollinations). Empty means each in turn, as before. An engine the server lacks answers `engine-off` (503); an unknown one `bad-engine`. `action: 'engines'` lists what is on. Tests are in `n8n/test/hubs-cloudflare.test.mjs`.
- **Studio:** the AI tab has a "⚙️ מנוע ה־AI" bar. It shows auto, the engines `FS.aiEngines()` reports, and "🖥️ מקומי" in the desktop program; the choice is stored in `fs-ai-engine` (`FS.aiEngine`). `FS.askServer` sends `engine: 'local'` to the local engine and any other engine straight to the cloud.
- **3 versions:** "🎯 3 גרסאות לבחירה" (`fs-ai-variants`). For one photo, `runVariants` asks up to three engines at once (`FS.restyleTry`, which does not apply), then shows a chooser (`.ai-vars`); the picked one is applied with `FS.applyAI`. Failed engines are listed with their reason. With several photos, the chosen engine runs as usual.
- **Live check (Oct 22, `.github/workflows/frame-ai-health.yml`, run by hand):** Gemini images answered 429 (no billing on the key), Workers AI was out of its 10,000 daily neurons, and Pollinations without POLLINATIONS_TOKEN opens only `gptimage` (kontext, nanobanana and seedream need a "pollen key"). The n8n hub answered "problem executing the workflow". So the free engine now asks `gptimage` first without a key, remembers key-only models for 6 hours (`sd.polKeyOnly`), waits once on its 429; `engines` drops FLUX for the rest of the day once the neurons run out (`sd.fluxOffDay`). For AI that always works, the owner needs billing on the Gemini key, a Pollinations key, Workers Paid, or an OpenAI key.
- **26 more styles** in `FS.AI_STYLES` (62 now): Israel and the holidays (the Kotel, Jerusalem, Tel Aviv beach, Hanukkah, Seder, Rosh Hashana, a chuppah at sunset), travel (Paris, Santorini, a safari, underwater), looks (classic 2D animation, dreamy anime, fashion dolls, a 1950s wedding, classic Hollywood, a fashion shoot, a child's crayon drawing) and materials (marble, wood, origami), plus vikings, samurai, Egypt, a flower crown and a vintage circus.

## Main site navigation and a lighter desktop program (Oct 2026)
- **index.html's menu is short:** works, frames, how it works, design it yourself, packages, questions, contact. Then the studio download and "👤 כניסה".
  - The full editor, the showcase, and the admin and studio links are in the footer.
  - Under 1120px a "תפריט" button (`#menu-btn`, code in `js/lux.js`) opens a full-screen menu. The header drops its blur while open, so the fixed menu fills the viewport.
- The hub strip (`.standalone-bar`) is hidden on the business site.
- The events section (`#events`) stays hidden until there are albums.
- **The desktop bundle leaves out:**
  - the unused anime model and onnxruntime (`models/face-paint-512-v2.onnx`, `vendor/ort`);
  - the 16 MB fine background model, which is fetched from the web when online, with the small one used offline;
  - Electron locales other than `he`/`en-US` (`electronLanguages`).
  - NSIS compression is `maximum`. The app content went from 52 MB to 17 MB.
- `.github/workflows/portfolio-manage.yml` had invalid YAML (a `: ` in a plain `run:` line) and failed on every push; that step now uses a block scalar.

## Paid licences, the purchase agreement, downloads (Oct 2026)
- **A licence opens only after the owner records a payment.**
  - `lic-activate` answers `license-unpaid` (402) until the licence is paid.
  - `lic-check` closes the studio if the payment is removed.
- **The owner's actions:**
  - `lic-pay` {email, amount, date, method, ref, note} adds a payment and marks the licence paid. `undo: '1'` with the payment's `at` removes it.
  - `lic-create` takes `price`, plus `paidNow`/`amount`/`method`/`ref`.
  - `lic-settings` {price} sets the default price, kept in `sd.licSettings` (default 990 ₪). The public `lic-info` returns the price, which `download.html` shows through `js/download.js`.
- **Purchase agreement:** `agreement.html`, version **v1**, held in `FS.license.AGREEMENT`.
  - The gate has a required checkbox. `lic-activate` needs `agree: 'v1'` and stores `L.agreement = {ver, at, ip, ua}`.
  - A new version: bump both the page and `AGREEMENT`, and everyone accepts again on their next activation.
  - The text is a base draft and should be checked by a lawyer.
- **Admin "🔑 רישיונות סטודיו":**
  - Counts: downloads of the installer (GitHub releases API, public; admin.html's CSP allows `https://api.github.com`), licences, paid, installed, used this week, software income, this month, and money waiting.
  - A price setting, and a payment form per licence (💰) with a payments list and delete.
  - Each licence shows its payment status and whether the agreement was accepted.
- **"🔥 טרנדים ויראליים":** in `js/ai-studio.js` (`VIRAL`, 22 complete prompts, e.g. action figure in a blister pack, snow globe, toy-brick minifigures, movie poster, trading card, toddlers, 50 years on). They use `KEEP_FREE`, which keeps the faces recognisable but doesn't lock the framing or age.

## AI pictures that don't run out (Oct 2026)
- **The server's image order** (`n8n/build-hubs-workflow.py`, `restyle` and `image`):
  1. Gemini (this key has no image allowance, so it is skipped for 6h).
  2. OpenAI (if OPENAI_API_KEY is set).
  3. FLUX on Workers AI (the free daily allowance). Output is now at most 1024px, about 3× more pictures a day.
  4. **Pollinations**: free, with no daily allowance.
- **Pollinations, new picture:** `flux`, then `turbo`.
- **Pollinations, photo edit:** `kontext`, then `nanobanana`, `seedream`, `gptimage`.
  - Pollinations reads the photo from a link on the Worker, `GET /hubs-tmp?id=<40 hex>`. It lives 3 minutes in the hubs Durable Object's memory and is never stored (`ENV.TMP_PUT`, through a Proxy over env in `State.handle`).
  - The optional secret `POLLINATIONS_TOKEN` (free at auth.pollinations.ai) lifts the anonymous limit and opens the edit models. The deploy passes it if set.
  - Privacy: photos sent this way go to a third-party free service (`private=true`, no logo).
- **Caps:** IMG_DAY is 800 and IMG_IP_HOUR is 60; the hubs test was updated to match.
- **Combos in `js/ai-studio.js`:** 40 styles, 38 places, 29 outfits, 19 moods and 54 ready combos.

## Studio licences and the desktop program (Oct 2026)
- **Who can open the studio:** the owner (admin sign-in) or a licence holder. `js/gate.js` shows two tabs, "🔑 קוד הפעלה" (email + code) and "🔐 מנהל".
  - A licence holder gets `body.studio-licensed`, which hides the owner's business screens and admin links (`css/gate.css`).
  - ☰ has "🚪 יציאה".
- **Server** (`n8n/snippets/access-handle.js`, the `lic-*` actions on `/hasadna-auth`):
  - **One licence per email** in `sd.licenses`. The code is random, `FS-XXXX-XXXX-XXXX-XXXX` (31-letter alphabet, ~79 bits). It is kept in the server so the owner can see it; only an admin session can list it.
  - **`lic-activate` {email, code, machine}** binds the licence to the first machine (`sha256('lic-machine:'+machine)`). Another machine gets `license-in-use`, an entry in the history, and an email alert to the owner. It allows 12 tries per IP per hour and locks the email for an hour after 6 wrong codes. It opens one `studio` session (30 days), ending any other for that licence.
  - **`lic-check` {token, machine}** answers on every studio start. A revoked licence ends the session; so does a token used from another machine (`license-moved`). It renews the session while in use.
  - **Admin actions:** `lic-list`, `lic-create` {email, name, phone, note, send}, `lic-set` {active}, `lic-release` (frees the computer), `lic-rotate` (new code; the old one stops), `lic-mail`, `lic-delete`.
  - A `studio` session is not a site login (`me` refuses it).
  - Local server test: `node /path/lic.mjs` against `wrangler dev`; the 20 checks are described in PR history.
- **Page side** (`FS.license` in account.js):
  - The machine id is `window.FSDesktop.machineId()` in the desktop program (a hash of the Windows MachineGuid), or the browser's device id.
  - The licence is kept in localStorage `frame-license`.
  - Offline, a licence checked in the last 7 days keeps working.
- **Admin:** "🔑 רישיונות סטודיו" (`js/admin-licenses.js`).
  - Counts: total, active, installed, in the desktop program, used this week.
  - Issuing a code shows it in a card, with copy and WhatsApp.
  - Per licence: copy, WhatsApp, email, release computer, new code, cancel/restore, history, delete.
- **`download.html`** links the Windows installer `https://github.com/devopsdevopshaim-wq/devops-hub/releases/download/desktop-latest/FrameStudio-Setup.exe` and explains SmartScreen and activation. The main site's nav has "⬇ הסטודיו למחשב"; the footer links download and studio.
- **The desktop program** is in `desktop/` (Electron), built by `.github/workflows/desktop-build.yml`; see `desktop/README.md`.

## Customers' way in, and RAW photos (Oct 2026)
- **admin.html opens on "👤 כניסת לקוח"**, with no password: name plus phone or email (`FS.account.enterForm`). "🔐 כניסת מנהל" is the second tab; `admin.html?admin` opens on it.
  - With an email, the server emails a 6-digit code (`frame-code`). The right code (`frame-code-verify`, 5 tries, 10 minutes) creates or opens a frame client (`sites: ['frame']`), approves the device as an emailed password would, and opens a client session.
  - With a phone only, or when the code can't be emailed (`mail-failed`: no BREVO_API_KEY or RESEND_API_KEY), the customer enters as an unverified visitor (`frame-visit`).
  - Every entry is recorded in `sd.frameVisitors` (name, email or phone, first and last visit, visits, verified). The admin's `all` call returns it as `visitors`, and the customers screen shows it in "🚪 מי נכנס למסך הלקוח", with counts for 24h, 7 days and verified.
  - A customer gets the customer screen (`body.adm-client-mode`: only the client view of admin-views.js, with "שלום NAME" and a logout). The visitor is kept in localStorage `frame-visitor`.
  - The main site's nav has "👤 כניסה" (admin.html), and the footer has links for customers and the owner.
- **Server source:** the cases are in `n8n/snippets/access-handle.js`. Rebuild with `python3 n8n/build-access-workflow.py`, then `cd cloudflare && node build.mjs`. `frameVisitors()` is in `cloudflare/src/worker.mjs`.
- **WhatsApp codes to customers** would need the WhatsApp Business Cloud API (Meta: a business account, an approved authentication template, paid per message). It isn't wired; CallMeBot only messages the owner's own phone.
- **RAW** (`FS.RAW_EXT`: CR2, CR3, NEF, ARW, DNG, RAF, ORF, RW2, PEF and others):
  - `FS.addPhotoFile` takes the biggest embedded JPEG in the file and applies the TIFF orientation tag 0x0112.
  - The photo inputs' `accept` lists the RAW extensions, since Windows hides them under `image/*`.
  - A RAW file with no embedded JPEG fails with a clear reason.

## Speed (Oct 2026, the owner's computer is slow)
Profile with Playwright, CPU throttling ×4 (CDP `Emulation.setCPUThrottlingRate`) and a longtask observer before changing anything heavy.
- `FS.PHOTO_MAX` is 2400 (300dpi on the biggest 15×20 magnet).
- `FS.processed` skips the getImageData/putImageData pass when the photo has no edits.
- The grid's whole-photo tiles draw from `FS.smallOf(p, 720)`, a small copy made once.
- While dragging or using a slider, the stage draws at most 640px.
- Never use `toDataURL` on big canvases; use `FS.canvasURL(c, type, q)`, which goes through toBlob and FileReader. This is used for frames and the invitation frame.
- Frame tiles (`buildFrames`) render on a ~320px copy of the page, are cached in `FP`, and are drawn a few at a time in idle time.
- The studio has no `backdrop-filter`; it repainted every frame and every grid tile.
- `#file-frames` accepts any image. A frame without transparency (JPG) gets its flat centre cut as the window by `FS.cutFlatWindow` (a flood fill from the centre with a soft edge).

## Entry screen
- `studio.html` opens on `#intro` (`js/intro.js`, `css/intro.css`). It is a design studio's portfolio wall: three columns of the studio's work (`show/p-*.webp`), matted like prints with a number and a name, drifting slowly. The motion is CSS transform only and pauses on hover. There is no WebGL, no three.js and no fridge, at the owner's request (the fridge and `js/fridge3d.js` were removed in Oct 2026).
- The copy side has the date line, a gold-foil title and four ways in: new event, open photos, continue project and my designs. The owner asked for no link row under them; admin, the business details, packages, deals and the designer are all in the studio's ☰ menu. "לסטודיו Enter" sits in the top corner, and Enter or Esc closes the screen.
- Its counts come from this browser only (saved events, magnets printed, my frames), and a zero is left out. Dropping files also closes it. `?skip` in the address skips it, which is what the tests use.

Edit the files in place. Push to `main`: `.github/workflows/vacation-hub-pages.yml` publishes `frame-studio/` to GitHub Pages (about two minutes). If you add a file, add it to `FILES` in `sw.js` and bump `CACHE`. Every page loads its own `js/` and `css/` files with `?v=N` (now 38). Bump that number in all the `*.html` pages on each release, together with `CACHE`, so a new page never runs with old scripts from the browser cache. That mix froze the studio intro and the designer in Oct 2026. `sw.js` fetches with `cache: 'no-cache'` and, offline, falls back to the cache with `ignoreSearch`. Each page also has an inline self-heal script at the top of `<head>` (`window.FS_V`). It compares `FS_V` with `version.json` (fetched with no-store; the service worker skips it). On a mismatch it unregisters the service worker, deletes the caches except the AI models cache (`frame-studio-ai*`), and reloads once with `?fresh=`. Any script error from `/frame-studio/` shows a "🔄 רענון מלא" pill that calls `FS_HEAL`, and the ☰ menu has the same action. **On each release run `python3 frame-studio/tools/bump.py N`.** It sets `?v=`, `FS_V`, `version.json` and `CACHE` together, and recomputes the sha256 of the self-heal script in admin.html's CSP (`script-src 'self' 'sha256-…'`); without that the inline script is blocked there.
- Opening photos (`addFiles` in ui.js) yields between photos and shows "טוען תמונות… i מתוך n" with the file name and size, plus a stop button. A photo that has not opened after 45s is skipped. `FS.addPhotoFile` first reads the file into memory, so an unreadable cloud placeholder fails at once; it recognises HEIC by its `ftyp` header (outside Safari). Every failure carries a Hebrew `err.why`, and a dialog lists the files that didn't open, with the reason and the version. The ☰ menu shows the version next to "רענון מלא". Decoding stays on the plain `<img>` path (`FS.addPhotoFile`); a createImageBitmap path hung on the owner's Windows Chrome app in Oct 2026, so don't bring it back. Business details change in `business.json` only.

## Checking it
Serve the repo root (`python3 -m http.server`) and open `/frame-studio/` (site: check `.mag`, `.g-item canvas`, the designer `#d-canvas` after changing `#d-type`/`#d-names`, no sideways scroll at 390px) and `/frame-studio/studio.html`. Studio, with Playwright: click `#demo` (a drawn sample photo), move `[data-adj]` sliders, click `#presets .tile`, `#gen-frames .tile`, set `#file-frames` with a PNG that has a transparent middle and check `FS.USER_FRAMES`, `#add-text`, drag on `#view`, Ctrl+Z, open each `[data-game]`, then `#save-one`, `#save-all` (ZIP), `#out-type [data-t=pdf]` (check with `pdfinfo`), `#save-project` and reopen it through `#file-project`, and `#print` with `window.print` stubbed (check `#print-root .pp` and `#page-size`). For AI, route `cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/**` to a local `npm pack` copy and load `portfolio/img/maya-full.jpg`. For the event flow: fill `#mg-prompt` and click `#mg-make` (mock `/webhook/hasadna-hubs` with `{ok:false,error:'no-key'}` to test the local fallback), `#qc-one` then read `FS.cur().quality`, `#face-all`, and the station by replacing `window.showDirectoryPicker` with a fake folder whose `values()` yields files, `#st-print` on and `window.print` stubbed. Check there is no horizontal scroll at 360px.

## Rules
- Answer in Hebrew unless the user writes in another language. The site is RTL.
- Do not name or copy another company's product (for example MAGNETOTI); this is the user's own tool.
- Do not add keys, accounts or personal data to the repo. Photos stay in the browser unless the user presses the editing assistant.
