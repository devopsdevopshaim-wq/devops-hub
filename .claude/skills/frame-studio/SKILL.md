---
name: frame-studio
description: "Work on the standalone site 'פריים מגנטים / פריים־סטודיו' (a business site for event photo magnets plus its editing and printing studio) (frame-studio/ in devops-hub, live at https://devopsdevopshaim-wq.github.io/devops-hub/frame-studio/): explain it, use it, change it, fix it or extend it. Use when the user mentions פריים סטודיו, עריכת תמונות, מסגרות PNG, מסגרת לתמונה, הדפסת תמונות, מדפסת תמונות, הסרת רקע, צלם אירועים, magnet / מגנטים לאירועים, frame studio, frame-studio, עריכה מרובה, סגנון קומיקס / מנגה / גרפיטי, גיבורי על, ספריית אירועים or תכנון הדפסה."
---

# פריים מגנטים + פריים־סטודיו (frame-studio)

Two pages:
- `index.html` — the public site of an event-magnets business (פריים מגנטים): a fridge with live-drawn magnets, how it works, a gallery of designs per event type, a designer where a visitor picks event type, names, date, frame, colour and font (and may load their own photo, which stays on the device) and sends the request to WhatsApp, packages, the AI/tech section, FAQ and a contact form that opens WhatsApp. All business details (name, phone/WhatsApp, e-mail, social links, areas, hours, packages and prices, FAQ, event types) live in `business.json`; the prices there are examples until the owner sets real ones. With no WhatsApp number, links open WhatsApp's contact picker. Code: `js/site.js`, `css/site.css`.
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

## Offline, light, base frames (Oct 2026)
- **Everything AI runs locally.** These are shipped with the site, and the service worker keeps them in their own cache (`frame-studio-ai-v1`):
  - In `vendor/`: MediaPipe tasks-vision 0.10.14, onnxruntime-web 1.20.1 (WASM build), pdf.js 3.11.174 and qrcode-generator.
  - In `models/`: the selfie multiclass and selfie segmenters, the BlazeFace detector, the face landmarker and the AnimeGAN ONNX model.
  - The styles tab is as before #342 (restored at the owner's request after the local looks were rejected): instant styles (`FS.LOCAL_STYLES`), anime on the computer (`FS.LOCAL_AI`), and the server transformations (`FS.AI_STYLES` through `FS.restyle` → the hubs server) with a free-text request (`#ai-custom`). The AI tab shows all its cards (server ones included). Don't bring back built-in "looks" in their place.
- **Light files.**
  - Photos over 3000px (`FS.PHOTO_MAX`), or JPEGs over 4MB, are re-encoded on arrival.
  - Frame files are compacted to at most 2400px, WebP with alpha when that is smaller (`FS.compactFrame`); stored old frames are compacted once on load.
  - The photos screen caches a small whole-photo thumbnail per photo (`p._gt`).
- **Base frames.** `FS.BASE_FRAMES` holds six plain white frames (thin, classic, wide, band for text, rounded, oval), drawn in any colour. They are the only ready frames in the studio and come first in the designer. The decorated frames stay for the site's samples and the event templates.
  - "🗑 מחיקת כל המסגרות השמורות" clears the user frames, and a one-time question (`fs-frames-clean-v1`) offers it.
- **Photos screen** shows each whole photo uncropped by default ("🖼 כל התמונה"), or "🧲 כמו בהדפסה".
- **Designer (`js/inv-frame.js`)**:
  - `FS.frameFromInvite(img, W, H, {border, band, text, accent})` rebuilds the invitation's own border around the photo at any size. It uses nine parts: corners kept, edges repeated mirrored, a names band in the invitation's paper colour, and the window cut see-through.
  - Buttons make a portrait, landscape or square frame from it. The result is kept in the design as `D.invFrame` (WebP) and registered as a PNG frame.
  - `FS.ELEMENTS` and `FS.elementCanvas` give 15 ornaments drawn in code, in any colour. `FS.textCanvas` adds free text.
  - Elements are added on the 🧩 tab and deleted with 🗑 or the Delete key; "ניקוי כל האלמנטים" removes them all.
- **Videos.** `media/explainer.mp4` (60s) and `media/promo.mp4` (30s), with posters, sit in the site's `#videos` section. They were made with HyperFrames in `videos/frame-explainer` and `videos/frame-styles-promo`, and the music bed is synthesized in code.

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

## Entry screen and the 3D fridge
- `js/fridge3d.js` (ES module, three.js 0.186.1 through the import map) exposes `window.Fridge3D.mount(canvas, magnetCanvases, opts)`. It draws a brushed-steel fridge door (RoundedBox with a canvas brushed texture, RoomEnvironment reflections) turned a little towards the words. A camera flash opens the scene. The magnets fly in from the camera and snap on with a damped spring and a squash, and they cast soft shadows. The scene leans with the pointer, a magnet lifts under it, and it pauses when off screen. Options: `pointerHost`, `fit`, `turn`, `spots`, `onFlash`, `onSnap`. A ResizeObserver keeps the size right.
- The magnets are the studio's own designs: `FS.SHOWCASE` drawn by `FS.magnetCanvas(o, size)` (in `events.js`).
- `studio.html` opens on `#intro` (`js/intro.js`, `css/intro.css`), with a "darkroom and gold foil" look: the date line with a safelight dot, a gold-foil title, and four ways in (new event, open photos, continue project, my designs). It also has a demo, the business site, and "ישר לסטודיו" (Enter or Esc). Its counts come from this browser only (saved events, magnets printed, my frames), and a zero is left out. Dropping files also closes it. `?skip` in the address skips it, which is what the tests use. Without WebGL or the CDN after 3.5s, it shows a flat fridge (`.intro.flat`).
- The business site's hero uses the same scene (`#hero3d`, 6 magnets) and falls back to the drawn CSS fridge.

Edit the files in place. Push to `main`: `.github/workflows/vacation-hub-pages.yml` publishes `frame-studio/` to GitHub Pages (about two minutes). If you add a file, add it to `FILES` in `sw.js` and bump `CACHE`. Business details change in `business.json` only.

## Checking it
Serve the repo root (`python3 -m http.server`) and open `/frame-studio/` (site: check `.mag`, `.g-item canvas`, the designer `#d-canvas` after changing `#d-type`/`#d-names`, no sideways scroll at 390px) and `/frame-studio/studio.html`. Studio, with Playwright: click `#demo` (a drawn sample photo), move `[data-adj]` sliders, click `#presets .tile`, `#gen-frames .tile`, set `#file-frames` with a PNG that has a transparent middle and check `FS.USER_FRAMES`, `#add-text`, drag on `#view`, Ctrl+Z, open each `[data-game]`, then `#save-one`, `#save-all` (ZIP), `#out-type [data-t=pdf]` (check with `pdfinfo`), `#save-project` and reopen it through `#file-project`, and `#print` with `window.print` stubbed (check `#print-root .pp` and `#page-size`). For AI, route `cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/**` to a local `npm pack` copy and load `portfolio/img/maya-full.jpg`. For the event flow: fill `#mg-prompt` and click `#mg-make` (mock `/webhook/hasadna-hubs` with `{ok:false,error:'no-key'}` to test the local fallback), `#qc-one` then read `FS.cur().quality`, `#face-all`, and the station by replacing `window.showDirectoryPicker` with a fake folder whose `values()` yields files, `#st-print` on and `window.print` stubbed. Check there is no horizontal scroll at 360px.

## Rules
- Answer in Hebrew unless the user writes in another language. The site is RTL.
- Do not name or copy another company's product (for example MAGNETOTI); this is the user's own tool.
- Do not add keys, accounts or personal data to the repo. Photos stay in the browser unless the user presses the editing assistant.
