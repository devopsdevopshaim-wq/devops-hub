---
name: dig-game
description: "Work on the browser game 'שכבות — הרפתקה ארכיאולוגית' (dig-game/ in devops-hub, live at https://devopsdevopshaim-wq.github.io/devops-hub/dig-game/): explain it, play it, balance it, fix it or extend it. Use when the user mentions שכבות, משחק ארכיאולוגיה, משחק חפירות, ממצאים, מוזיאון, חפירת היום, archaeology game or dig-game."
---

# שכבות — הרפתקה ארכיאולוגית (dig-game)

A Hebrew RTL browser game with no server. The dig is real 3D (three.js, `js/dig3d.js`). It is a 9×9 m excavation square with strings and stakes, sun and soft shadows, wind in the grass, a sieve, a bucket and a spoil heap that grows with what you remove. Behind the dig, the site's real photo stands on the horizon. The trench floor is a heightfield (`RES` vertices per metre). A strike carves a round bite with straight walls, and its depth depends on the material at that depth (the old 9×13 grid's rows, `ROWD` m each, harder deeper). The walls show the strata in the shader, with the grain of a real trench-wall photo. Finds lie flat at the depth of their era. The ground stops at a find's surface, and overkill there damages it. Stones take blows and shatter. A find comes out at 72% uncovered, rising with a glow (bloom) and a light beam for rare ones. The pick is wide and strong but risky, the trowel is in between, and the brush never harms a find but is weak on stone. Every strike costs ⚡ energy. When the energy runs out the player can buy +10 with coins or end the dig.

Live: https://devopsdevopshaim-wq.github.io/devops-hub/dig-game/ · Code: `dig-game/`

| File | Role |
| --- | --- |
| `index.html` | screens: home, map (daily dig, quests, sites), dig (canvas + tools), museum, camp |
| `js/art.js` | every artwork as an SVG string drawn in code (`A.*`), and the data: `RARITY`, `ERAS`, `FINDS` (41), `ITEMS`, `SITES` (7) → `window.SHCHAVOT` |
| `js/icons.js` | the drawn icon set (`ICONS`: tools, coin, bolt, tabs…) and `scene(site)`, the illustrated landscape on each site card |
| `js/hero.js` | the animated opening scene (sunset, stars, mountains with parallax, soil with glowing finds) and the drifting dust behind the menus |
| `js/audio.js` | sound effects (`window.SFX`) and generative background music on a hijaz scale (`window.MUSIC`), all synthesized with WebAudio |
| `js/photos.js` | `SHCHAVOT_PHOTOS`: the real photo of each site and of objects like the finds, with Hebrew caption, author, licence and Commons page. Every caption must say exactly what is in the photo (e.g. "from Turin", "a copy") |
| `photos/` | the photos themselves (sites ~1100px, objects ~560px), `soil-detail.jpg` (a seamless grain map cut from a real trench wall, sampled by the terrain shader) and `cut/<findId>.webp`: the object cut out of its background. Where a cut-out exists (`cut` in `photos.js`), it is the find's image everywhere: in the ground in 3D (with a bump map from the photo), in the find card, the museum and the summary. Otherwise the SVG drawing is used. Cut-outs were made with a numpy flood-fill from the border colour, by saturation for clay on grey, or by brightness for a light object on a dark cloth; check them on a checkerboard before adding |
| `js/dig3d.js` | ES module: renderer, world, terrain shader (strata, real grain, hover ring, sonar wave), `carve()`, stones, finds as textured planes, effects (debris, dust, sparks, beams, floating labels), camera (two fingers or right mouse orbit, wheel or pinch zoom, ⟲⟳ buttons) and the opening-screen `showcase()`. It also draws a 3D tool in hand (pick, trowel or brush) that swings at every strike (`setTool`), image-based light from the sky, and ambient occlusion (GTAO) on larger screens, which switches itself off if frames get slow. Exposes `window.DIG3D` and fires `dig3d-ready` |
| `vendor/three/` | three.js r170 (`three.module.min.js` via the import map in `index.html`) and the post-processing addons it needs (EffectComposer, RenderPass, UnrealBloomPass, GTAOPass, OutputPass and their shaders) |
| `js/game.js` | save (`localStorage` key `shchavot.v1`), progression, upgrades, quests, dig generation, canvas rendering and effects, input, modals |
| `css/game.css` | night-desert look, Suez One + Heebo |

## Systems
- Levels: `xpFor(l)`. Sites open by `level`, and each has a value multiplier `mult`.
- Upgrades (`UPS`): pick, stamina, detector (glint radius), sonar, restore (less harm), luck, funding (more finds), dynamite. Cost is `base × 1.65^level`.
- Value = base × site mult × (0.25 + 0.75·condition) × 1.5 if perfect × 1.15 if the era's collection is complete.
- Daily dig: seeded by date with a fixed loadout, so it is identical for everyone. The first run is the one that counts, and the result is shared as emoji squares.
- Three daily quests are seeded by date. Three map fragments make a treasure map, and the next regular dig then places an epic or legendary find in the deepest layer, marked with an X.
- game.js keeps all the rules (energy, damage, scoring, quests). It calls `DIG3D.carve(point, {r, power, harm, kind})` and applies the result (`harmed`, `first`, `done`, `stoneHit/Broke`) in `applyCarve()`.
- If WebGL is missing, the dig shows a message and the opening screen falls back to the 2D `hero.js` scene. There is also a work lamp at the last strike, a streak counter ("רצף") with a coin bonus every 5 breaks, cinematic finds with a holographic card for epic and above, and a full-screen level-up.
- The first dig ever places an uncommon find in rows 1–2, so a new player finds something fast.

## Photos
The container can't reach Wikimedia, so photos come in through `.github/workflows/dig-photos.yml`. A push that changes `.github/scripts/dig-photos.py` (its `QUERIES`) makes Actions download up to 3 freely licensed candidates per key into `dig-game/photos/_candidates/` with `credits.json`. Pull, look at them, copy the good ones to `photos/` at web size, add them to `js/photos.js`, then delete `_candidates/`. The museum has a "קרדיטים לצילומים" list. Keep it complete, since CC BY and CC BY-SA require attribution.

## Content rules
- Facts about finds must be true and modest (real sites, real years). If unsure, say less rather than invent.
- Keep it fair: no real-money purchases, no timers that punish leaving.

## Checking it
Serve the repo root statically and open `/dig-game/`. `window.SHCHAVOT_GAME` exposes `state()`, `dig()`, `startDig(i, daily)` and `endDig()` for scripted checks. Headless Chromium needs `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader` to render WebGL. A bot can aim at a find with `DIG3D.project(DIG3D.artCenter(a))`. Check at 390px and 1360px (no horizontal scroll), play a dig to its summary, and look at the museum and the camp. To view all the art, put every id in `museum` in localStorage.

## Deploy
Push to `main`: `.github/workflows/vacation-hub-pages.yml` copies `dig-game/` to Pages.
