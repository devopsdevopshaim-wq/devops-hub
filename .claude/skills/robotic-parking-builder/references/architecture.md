# Architecture

One HTML file, one IIFE script, no build step. State lives in `S` (persisted to `localStorage` key `rp-cfg-v1`), the derived engineering model in `M = model()`.

## Data flow
`S` (inputs) → `model()` → `M` {axes, io, cabs, net, levelZ, cycle times, …} → every tab renders from `M`.

| Function | Produces |
| --- | --- |
| `model()` | Motor sizing per axis, sensor/IO list with addresses and terminals, cabinets with drives/IO cards/sizes, PROFINET devices and IPs, cycle times |
| `paramsFor(axis)` / `blockCfg(axis)` | SINAMICS G120 parameter list grouped by commissioning step / SINA_POS·SINA_SPEED settings |
| `plcFiles()` | TIA Portal external sources: UDTs, `Plant` DB, FB_Transfer/Shuttle/Lift/Turntable/Lobby/Job/Plant, FC_Cells/Config/MapIO, tag table CSV. Arrays and loops are sized from the counts; disabled cells are excluded |
| `cabinetBuild(cab)` | Cabinet layout in mm (rows, ducts, rails, components, terminals), numbered wires with duct routing, field cables and devices |
| `cabinetSVG(B)` | 2D wiring sheet (tab "ארון – חיווט מלא", pan/zoom/click-to-trace) |
| `buildCabinet3D(V,B)` | 3D cabinet in 11 assembly steps (`STEPS`) |
| `buildGarage(V,opt)` | 3D garage: structure, facade, cars (`makeCar`), lifts, shuttles, street, lamps, neighbours. `opt.lights`, `opt.cut`, `opt.underground`, `opt.lit` |
| `DRAW.*` | SVG drawings (plan, section, overhang detail, cabinet front, single-line, network, lobby, shuttle, lift, turntable, cell, wiring) |
| `projectZip()` | ZIP: PLC sources, all drawings, cabinet wiring SVG + wire lists, CSV tables, report |

## Tabs (`TABS`)
overview, floors, equip, cabinets, cabwire, cab3d, ip, params, sensors, lobby, plc, tpl, wiring, drawings, sim, report.

## Front page
`renderLanding()` fills hero stats, value cards and example cards from `M` and `PRESETS` (`withPreset` computes a preset's model without touching `S`). `startGarage3D()` lazy-loads three.js r128 from cdnjs.

## Gallery
`galInit()` picks a backend: artifact (`assets` + `db` capabilities, collection `gallery`), web (IndexedDB drafts + `ghPublish` via the GitHub contents API into `GAL.dir`, updating `gallery.json`), or read-only in a frame.

## Hooks for scripts
`window.RP` exposes `skyEnv, loadThree, View3D, buildGarage, buildCabinet3D, cabinetBuild, withPreset, PRESETS, getM, getS` — used by `render-images.js`.
