---
name: robotic-parking-builder
description: Build or update a Hebrew (RTL) robotic / automated car-park website in the "פארק־פלאן" format. It is a developer showcase (realistic 3D renders of the configured garage, live three.js garage viewer, value figures, example configurations, project gallery with photo upload and GitHub publishing, contact) on top of a full engineering planner: floors and cells, lifts, shuttles and turntable with motor sizing, control cabinets per floor with drives and IO, PROFINET IP plan, SINAMICS G120 parameters, sensor/IO lists with overhang sensor models and lobby height checks, ready TIA Portal (S7-1500) PLC templates that replicate by cell count, full cabinet wiring with click-to-trace, a 3D cabinet assembly walkthrough, SVG drawings, simulation and a project ZIP. Use when the user wants a site, planner, presentation or tool for a robotic parking garage, automated car park, parking tower, shuttle/lift parking system, "חניון רובוטי", "חניון אוטומטי", "מגדל חניה", "אתר כמו פארק־פלאן", "תכנון חניון רובוטי", or wants to change, re-brand, re-render or redeploy a site built from this template.
---

# Robotic Parking Builder (פארק־פלאן)

`template/` is a complete, working single-page site. `app.html` is the source (also the Claude-artifact body); `build.sh` wraps it into a standalone `index.html`. Everything — model, drawings, PLC code, 3D — is generated in the browser from one configuration object, so most work is configuration, brand and images, not code.

## Files at a glance

| Path | Role | Usually edited? |
| --- | --- | --- |
| `app.html` → `DEF` object | Default configuration: project name, floors, cells per side, sides, lifts, pitch, car size/mass, height sensors, speeds, drives location, subnet, overhang sensor model | Always (via `new-site.py`) |
| `app.html` → landing markup (top of body) | Brand "פארק־פלאן", hero text, contact WhatsApp/phone, footer | Always (via `new-site.py`) |
| `app.html` → `PRESETS` | The four example configurations on the front page (tower, shuttle, twin-lift, underground) | Sometimes |
| `app.html` → `GAL.repo` / `GAL.dir` | GitHub repo and folder the gallery publishes photos to | Always (via `new-site.py`) |
| `img/*.jpg` | Hero, cutaway, example and cabinet renders | After config changes (`render-images.sh`) |
| `gallery/gallery.json` | Published gallery items (`file` in `gallery/` or `url` to `img/`) | Grows from the site's upload button |
| `build.sh` | Builds `index.html` from `app.html` | Never |

Architecture and where each tab lives: [references/architecture.md](references/architecture.md).

## Workflow

### 1. Collect what only the user knows
Ask once, briefly, only for what is missing:
- **Brand** (Hebrew name shown in the nav, default "פארק־פלאן") and **project name**.
- **Contact**: WhatsApp number and display phone for the contact band.
- **Repo** for gallery publishing (`owner/repo`) and the **site path** inside it (default `robotic-parking`).
- Optional: real project figures (floors, cells per side, lifts, car size, speeds). Without them keep the template defaults (6 floors, 12 cells per side, 2 sides, 1 lift).

### 2. Scaffold
```bash
python3 <skill>/scripts/new-site.py <target-dir> --brand "פארק־פלאן" --project "חניון רובוטי – מגדלי הים" \
  --whatsapp 0544979771 --phone "054-497-9771" --repo owner/repo --site-path robotic-parking \
  [--floors 6 --cells 12 --sides 2 --lifts 1 --pitch 2700 --car-l 5300 --car-w 2100 --car-mass 2500]
```
It copies `template/`, writes the brand, contacts, repo and defaults into `app.html`, and runs `build.sh`.

### 3. Re-render the images (when the configuration changes)
```bash
<skill>/scripts/render-images.sh <target-dir>
```
Renders the hero, cutaway, the four examples and a cabinet from the site's own three.js model in headless Chromium (2× supersampling), then grades them with ImageMagick (bloom, vignette, grain). Needs Node + Playwright and ImageMagick; on Claude Code on the web Chromium is at `/opt/pw-browsers/chromium`. The images are **renders of the configured system**, never stock photos; never present them as photos of a real built project. Real photos come in through the gallery.

### 4. Validate
```bash
node <skill>/scripts/validate.mjs <target-dir>
```
Fix every `ERROR`. Then open the page once in Playwright at 1440 and 390 px: no `pageerror`, `scrollWidth` equals the viewport, every tab renders, the 3D viewer starts (route `cdnjs…/three.js/r128/three.min.js` to a local copy when the sandbox blocks the CDN).

### 5. Deliver
Details in [references/deploy.md](references/deploy.md).
- **GitHub Pages**: copy `index.html`, `img/`, `gallery/` to the site path; add the path to the Pages workflow. Gallery publishing then works with the owner's fine-grained token (Contents: read & write on that repo only).
- **Claude artifact**: publish `app.html` with `files` = every `img/*.jpg` + `gallery/gallery.json`, and `capabilities: {downloads: true, assets: {}, db: {}}` (ZIP export, gallery uploads stored in the artifact).
- **ZIP**: `<skill>/scripts/make-zip.sh <target-dir>`.

### 6. Report honestly
Say what was verified (browser checks, static checks of the generated SCL) and what was not (compiling in TIA Portal, real drive parameters, publishing with the user's token). All engineering output is a **preliminary design**: it must be approved by an electrical engineer and a safety inspector (EN 14010, EN ISO 13849-1, EN 60204-1, EN 81-20). Parameter numbers, module part numbers and terminal names must be checked against manufacturer manuals. Engineering notes: [references/engineering.md](references/engineering.md).

## Common changes
- **Different PLC/drive brand**: the generator is Siemens-specific (S7-1500F, SINAMICS, PROFINET). Keep it unless the user asks; then change `paramsFor`, `plcFiles` and the device names in `model()` together.
- **Another overhang sensor**: add an entry to `OVH` (name, range, light, output, connector, note, source URL from a page you actually opened).
- **More example configurations**: append to `PRESETS` and add `img/type-<id>.jpg` with `render-images.sh`.
- **Contact or brand**: rerun `new-site.py` on a copy, or edit the landing markup directly.
