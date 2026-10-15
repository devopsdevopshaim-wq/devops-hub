---
name: frame-studio
description: "Work on the standalone site 'פריים מגנטים / פריים־סטודיו' (a business site for event photo magnets plus its editing and printing studio) (frame-studio/ in devops-hub, live at https://devopsdevopshaim-wq.github.io/devops-hub/frame-studio/): explain it, use it, change it, fix it or extend it. Use when the user mentions פריים סטודיו, עריכת תמונות, מסגרות PNG, מסגרת לתמונה, הדפסת תמונות, מדפסת תמונות, הסרת רקע, צלם אירועים, magnet / מגנטים לאירועים, frame studio or frame-studio."
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

## Changing it
Edit the files in place. Push to `main`: `.github/workflows/vacation-hub-pages.yml` publishes `frame-studio/` to GitHub Pages (about two minutes). If you add a file, add it to `FILES` in `sw.js` and bump `CACHE`. Business details change in `business.json` only.

## Checking it
Serve the repo root (`python3 -m http.server`) and open `/frame-studio/` (site: check `.mag`, `.g-item canvas`, the designer `#d-canvas` after changing `#d-type`/`#d-names`, no sideways scroll at 390px) and `/frame-studio/studio.html`. Studio, with Playwright: click `#demo` (a drawn sample photo), move `[data-adj]` sliders, click `#presets .tile`, `#gen-frames .tile`, set `#file-frames` with a PNG that has a transparent middle and check `FS.USER_FRAMES`, `#add-text`, drag on `#view`, Ctrl+Z, open each `[data-game]`, then `#save-one`, `#save-all` (ZIP), `#out-type [data-t=pdf]` (check with `pdfinfo`), `#save-project` and reopen it through `#file-project`, and `#print` with `window.print` stubbed (check `#print-root .pp` and `#page-size`). For AI, route `cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/**` to a local `npm pack` copy and load `portfolio/img/maya-full.jpg`. For the event flow: fill `#mg-prompt` and click `#mg-make` (mock `/webhook/hasadna-hubs` with `{ok:false,error:'no-key'}` to test the local fallback), `#qc-one` then read `FS.cur().quality`, `#face-all`, and the station by replacing `window.showDirectoryPicker` with a fake folder whose `values()` yields files, `#st-print` on and `window.print` stubbed. Check there is no horizontal scroll at 360px.

## Rules
- Answer in Hebrew unless the user writes in another language. The site is RTL.
- Do not name or copy another company's product (for example MAGNETOTI); this is the user's own tool.
- Do not add keys, accounts or personal data to the repo. Photos stay in the browser unless the user presses the editing assistant.
