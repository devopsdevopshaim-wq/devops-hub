---
name: cabinet-wiring
description: "Work on the standalone site 'ארון־פלאן' (cabinet-wiring/ in devops-hub, live at https://devopsdevopshaim-wq.github.io/devops-hub/cabinet-wiring/): explain it, use it, change it, fix it or extend it. Use when the user mentions ארון פיקוד, לוח חשמל, תכנית חיווט, רשימת חוטים, חיווט ארון, צבע חוט, שרוול / פרול, מהדקים, EPLAN wire list, control cabinet wiring or cabinet-wiring."
---

# ארון־פלאן (cabinet-wiring)

A Hebrew (RTL) site that turns a control-cabinet wiring diagram PDF into a full point-to-point wire list and an assembly/wiring guide. Every wire gets: number, from tag:terminal, to tag:terminal, circuit function, color, cross-section, wire type, estimated length, end ferrule (DIN 46228-4 color, TWIN when two wires share a terminal), strip length, torque, and an explanation of what it does — shown as a tooltip when hovering the wire in the cabinet drawing.

Live: https://devopsdevopshaim-wq.github.io/devops-hub/cabinet-wiring/ · Code: `cabinet-wiring/`

## How it is built
Static files, no build step. `server.mjs` (Node, `@anthropic-ai/sdk`) is optional: it serves the site and `POST /api/analyze` sends the PDF as a document block to Claude with structured output (schema in `js/prompts.js`), streamed back as NDJSON. Without the server, Claude works by copy-paste to Claude.ai.

| File | Role |
| --- | --- |
| `js/catalog.js` | colors + aliases (`colorCode`), FUNCS (power, neutral, ctrl_ac, ctrl_dc, dc0, foreign, signal, comm, pe), component TYPES with sizes/rows/zones, ferrules, wire types, torque |
| `js/engine.js` | `extractFromText` (wire lists in PDF text), `enrich` (type inference by name/IEC 81346 prefix/terminals, nets via union-find through terminals and closed protection devices, func/color/section defaults, explanation per wire), `layout` (plate, ducts, DIN rails by row, door, field), routing in ducts, `wireOrder`, `assemblySteps`, CSV, `cutList` |
| `js/prompts.js` | Claude system prompt, rules, JSON Schema, `copyPrompt`, `parse`/`fromJson` |
| `js/view.js` | `CabinetView`: SVG drawing, hover/select, zoom/pinch; styles embedded (`SVG_STYLE`) so print/SVG export match |
| `js/app.js` | UI: home, tabs plan/parts/wires/cabinet/wiring/assembly/export, drawer, dialogs |
| `js/pdf.js`, `js/store.js`, `js/book.js`, `js/demo.js` | pdf.js reading (page image + positioned text), localStorage/IndexedDB, print book and wire labels, demo project (57 wires) |

catalog/engine/prompts/demo are UMD (browser globals `WCat`, `WEngine`, `WPrompts`, `WDemo`, and `require` in node). Raw project in localStorage key `cabinet-wiring-v1`; PDF and pages in IndexedDB `cabinet-wiring` (`<pid>:pdf`, `<pid>:p<n>`).

## Checking it
`cd cabinet-wiring && npm test` (engine tests). In a browser: serve the repo root (`python3 -m http.server`), open `/cabinet-wiring/`, click `#openDemo`, hover `.w .hit` in `#cabHost` (tooltip `#tip`), click it (drawer `#drawer`), use `#wDone` in the wiring tab, `#printBook` in export. pdf.js loads from cdn.jsdelivr.net; in a sandbox without it, route that URL to a local `pdfjs-dist@4.10.38/build`.

## Rules
- Answer in Hebrew unless the user writes in another language. The site is RTL; wrap tag:terminal text in isolates (`⁦…⁩`) or `.ep`/`.mono` spans.
- Values the site fills in (color, section, torque) are standard defaults; keep them marked (`*`) and keep the disclaimer.
- No API keys in the repo. Publishing: push to `main`, `.github/workflows/vacation-hub-pages.yml` copies `cabinet-wiring/` to GitHub Pages.
