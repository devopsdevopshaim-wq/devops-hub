---
name: frame-studio
description: "Work on the standalone site 'פריים־סטודיו' (frame-studio/ in devops-hub, live at https://devopsdevopshaim-wq.github.io/devops-hub/frame-studio/): explain it, use it, change it, fix it or extend it. Use when the user mentions פריים סטודיו, עריכת תמונות, מסגרות PNG, מסגרת לתמונה, הדפסת תמונות, מדפסת תמונות, הסרת רקע, צלם אירועים, magnet / מגנטים לאירועים, frame studio or frame-studio."
---

# פריים־סטודיו (frame-studio)

A Hebrew (RTL) photo editor for photographers that runs in the browser and installs as an app on Mac, Windows and phones (PWA: `manifest.webmanifest`, `sw.js`). The user loads photos (several at once), edits them, puts frames on them (ready frames drawn in code, or their own PNG frames), adds text, stickers and AI effects, plays games with the photos, saves in several formats and prints on any printer installed on the computer.

Live: https://devopsdevopshaim-wq.github.io/devops-hub/frame-studio/ · Code: `frame-studio/` in https://github.com/devopsdevopshaim-wq/devops-hub

## How it is built
Plain static files, no build step, no server. Photos never leave the computer, except the downsized picture the editing assistant sends when the user presses it.

| File | Role |
| --- | --- |
| `index.html` | the screen: tool rail (8 tabs), the panel, the canvas stage, the photo strip, a dialog, the hidden print area |
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
Edit the files in place. Push to `main`: `.github/workflows/vacation-hub-pages.yml` publishes `frame-studio/` to GitHub Pages (about two minutes). If you add a file, add it to `FILES` in `sw.js` and bump `CACHE`.

## Checking it
Serve the repo root (`python3 -m http.server`) and open `/frame-studio/`. With Playwright: click `#demo` (a drawn sample photo), move `[data-adj]` sliders, click `#presets .tile`, `#gen-frames .tile`, set `#file-frames` with a PNG that has a transparent middle and check `FS.USER_FRAMES`, `#add-text`, drag on `#view`, Ctrl+Z, open each `[data-game]`, then `#save-one`, `#save-all` (ZIP), `#out-type [data-t=pdf]` (check with `pdfinfo`), `#save-project` and reopen it through `#file-project`, and `#print` with `window.print` stubbed (check `#print-root .pp` and `#page-size`). For AI, route `cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/**` to a local `npm pack` copy and load `portfolio/img/maya-full.jpg`. Check there is no horizontal scroll at 360px.

## Rules
- Answer in Hebrew unless the user writes in another language. The site is RTL.
- Do not name or copy another company's product (for example MAGNETOTI); this is the user's own tool.
- Do not add keys, accounts or personal data to the repo. Photos stay in the browser unless the user presses the editing assistant.
