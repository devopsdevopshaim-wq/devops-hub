---
name: cabinet-wiring
description: "Work on the standalone site 'ארון־פלאן' (cabinet-wiring/ in devops-hub, live at https://devopsdevopshaim-wq.github.io/devops-hub/cabinet-wiring/): explain it, use it, change it, fix it or extend it. Use when the user mentions ארון פיקוד, לוח חשמל, תכנית חיווט, רשימת חוטים, חיווט ארון, צבע חוט, שרוול / פרול, מהדקים, EPLAN wire list, control cabinet wiring or cabinet-wiring."
---

# ארון־פלאן (cabinet-wiring)

A Hebrew (RTL) site that turns a control-cabinet wiring diagram PDF into a full point-to-point wire list and an assembly/wiring guide. Every wire gets: number, from tag:terminal, to tag:terminal, circuit function, color, cross-section, wire type, estimated length, end ferrule (DIN 46228-4 color, TWIN when two wires share a terminal), strip length, torque, and an explanation of what it does — shown as a tooltip when hovering the wire in the cabinet drawing.

Live: https://devopsdevopshaim-wq.github.io/devops-hub/cabinet-wiring/ · Claude version (reads any drawing with Claude via the Artifact `sample` capability, images; built by `cabinet-wiring/tools/build-claude-app.py`, republish to https://claude.ai/artifact/JxrsPNHAUZsM9C2kBNHNwk after changes): `window.CLAUDE_APP` · Code: `cabinet-wiring/`

In the claude.ai frame `confirm`/`prompt`/`window.open`/`<a download>` don't work: use `askConfirm`/`askText`, `openPrint` (in-page book dialog) and `download()` (uses the `downloads` capability). Storage calls have timeouts and pages are also cached in memory, so the site works where IndexedDB is blocked.

## How it is built
Static files, no build step. `server.mjs` (Node, `@anthropic-ai/sdk`) is optional: it serves the site and `POST /api/analyze` sends the PDF as a document block to Claude with structured output (schema in `js/prompts.js`), streamed back as NDJSON. Without the server, Claude works by copy-paste to Claude.ai.

| File | Role |
| --- | --- |
| `js/catalog.js` | colors + aliases (`colorCode`), FUNCS (power, neutral, ctrl_ac, ctrl_dc, dc0, foreign, signal, comm, pe), component TYPES with sizes/rows/zones, ferrules, wire types, torque |
| `js/engine.js` | `extractFromText` (wire lists in PDF text), `enrich` (type inference by name/IEC 81346 prefix/terminals, nets via union-find through terminals and closed protection devices, func/color/section defaults, explanation per wire), `layout` (plate, ducts, DIN rails by row, door, field), routing in ducts, `wireOrder`, `assemblySteps`, CSV, `cutList`, `compWiring` (component card: terminals, wires, trace through terminal strips, field cable) |
| `js/prompts.js` | Claude system prompt, rules, JSON Schema, `copyPrompt`, `parse`/`fromJson` |
| `js/view.js` | `CabinetView`: SVG drawing, hover/select, zoom/pinch; styles embedded (`SVG_STYLE`) so print/SVG export match |
| `js/app.js` | UI: home, tabs plan/parts/wires/cabinet/wiring/assembly/export, drawer, dialogs |
| `js/site.js` (UMD `WSite`), `js/siteplan.js`, `js/site3d.js` | installation sites: several cabinets per site (`state.sites[]`: cabinets, files, layout, room, trayH, links, stepsDone); `externals`, `suggest` (shared signal names on outgoing terminal strips, "לוח X" supply), `cableFor`, `linkLength`, `autoLayout`, `installSteps`; top-view plan with drag; 3D room with tray and cables. Route `#site/<id>`; files in IDB `site:<sid>:f:<fid>` |
| `js/pdf.js`, `js/store.js`, `js/book.js`, `js/demo.js` | pdf.js reading (page image + positioned text), localStorage/IndexedDB, print book and wire labels, demo project (57 wires) |

catalog/engine/prompts/demo are UMD (browser globals `WCat`, `WEngine`, `WPrompts`, `WDemo`, and `require` in node). State (projects + sites) in IndexedDB key `__state__` and localStorage key `cabinet-wiring-v1`; PDF and pages in IndexedDB `cabinet-wiring` (`<pid>:pdf`, `<pid>:p<n>`).

## Layout from the drawing (`layoutPlan`)
When the PDF defines the cabinet (layout / front view, terminal list, PLC block, gland plate), the reading returns `layout` (schema in `js/prompts.js`) → project `layoutPlan` {pages, enclosure, rails[{label,tags,spacer}], door, termOrder{tag:[terms]}, glands[{label,size,row}], notes}. `E.layout(P)` builds from it (L.mode 'drawing', rails `fromDrawing`, `L.unplaced` = parts placed by recommendation, drawn with a dashed orange outline); `E.layout(P, {mode:'auto'})` is the system's recommendation, shown only in the `rec` tab ("המלצת הרכבה") with a diff. Wiring, routes, 3D and the lab always use the drawing layout. The 208-B library carries its plan (pages 23, 27, 28).

## Lab (`js/sim.js`, tab `lab`)
`WSim.run(P, state, prev)` simulates the panel: nets via union-find through wires and through each component's closed contacts for its state (breakers on, contactor/relay coils energized, buttons pressed, sensors sensing), sources from the main switch inputs / supply strips, PSUs, and manual PLC outputs (`state.out['TAG:TERM']`); iterates until coils are stable, trips protection on shorts, burns 24V DC coils fed AC. `WSim.checks(P)` returns categories short/color/section/terminal/coil/pe/dup/complete. `WSim.controls(P)` lists what can be operated. In the UI (`renderLab` in app.js) `CabinetView.setSim(res)` colors live wires by potential and `setPinMode` lets the user click two pins to create a wire (opens `#wireDialog` prefilled). Components added in the lab carry `terms` (from `defaultTerms`) so the layout draws their pins before any wire exists, and `added: 'lab'`.

## Checking it
`cd cabinet-wiring && npm test` (engine, site, parts and sim tests). In a browser: serve the repo root (`python3 -m http.server`), open `/cabinet-wiring/`, click `#openDemo`, hover `.w .hit` in `#cabHost` (tooltip `#tip`), click it (drawer `#drawer`), use `#wDone` in the wiring tab, `#printBook` in export. pdf.js loads from cdn.jsdelivr.net; in a sandbox without it, route that URL to a local `pdfjs-dist@4.10.38/build`.

## Rules
- Answer in Hebrew unless the user writes in another language. The site is RTL; wrap tag:terminal text in isolates (`⁦…⁩`) or `.ep`/`.mono` spans.
- Values the site fills in (color, section, torque) are standard defaults; keep them marked (`*`) and keep the disclaimer.
- No API keys in the repo. Publishing: push to `main`, `.github/workflows/vacation-hub-pages.yml` copies `cabinet-wiring/` to GitHub Pages.
