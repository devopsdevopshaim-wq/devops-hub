---
name: dig-game
description: "Work on the browser game 'שכבות — הרפתקה ארכיאולוגית' (dig-game/ in devops-hub, live at https://devopsdevopshaim-wq.github.io/devops-hub/dig-game/): explain it, play it, balance it, fix it or extend it. Use when the user mentions שכבות, משחק ארכיאולוגיה, משחק חפירות, ממצאים, מוזיאון, חפירת היום, archaeology game or dig-game."
---

# שכבות — הרפתקה ארכיאולוגית (dig-game)

A Hebrew RTL browser game with no server. The player digs a 9×13 grid of soil on a canvas. Each band of rows is a historical era (shallow is recent, deep is old), and deeper rows are harder material. Finds are hidden under the soil and cover 1×1 up to 3×2 cells. The rule that makes it a game: a strike that deals more damage than the tile has left ("overkill") damages the find under it. The pick is fast but risky, the trowel is in between, and the brush never harms a find. Every strike costs ⚡ energy. When the energy runs out the player can buy +10 with coins or end the dig.

Live: https://devopsdevopshaim-wq.github.io/devops-hub/dig-game/ · Code: `dig-game/`

| File | Role |
| --- | --- |
| `index.html` | screens: home, map (daily dig, quests, sites), dig (canvas + tools), museum, camp |
| `js/art.js` | every artwork as an SVG string drawn in code (`A.*`), and the data: `RARITY`, `ERAS`, `FINDS` (41), `ITEMS`, `SITES` (7) → `window.SHCHAVOT` |
| `js/icons.js` | the drawn icon set (`ICONS`: tools, coin, bolt, tabs…) and `scene(site)`, the illustrated landscape on each site card |
| `js/hero.js` | the animated opening scene (sunset, stars, mountains with parallax, soil with glowing finds) and the drifting dust behind the menus |
| `js/audio.js` | sound effects (`window.SFX`) and generative background music on a hijaz scale (`window.MUSIC`), all synthesized with WebAudio |
| `js/game.js` | save (`localStorage` key `shchavot.v1`), progression, upgrades, quests, dig generation, canvas rendering and effects, input, modals |
| `css/game.css` | night-desert look, Suez One + Heebo |

## Systems
- Levels: `xpFor(l)`. Sites open by `level`, and each has a value multiplier `mult`.
- Upgrades (`UPS`): pick, stamina, detector (glint radius), sonar, restore (less harm), luck, funding (more finds), dynamite. Cost is `base × 1.65^level`.
- Value = base × site mult × (0.25 + 0.75·condition) × 1.5 if perfect × 1.15 if the era's collection is complete.
- Daily dig: seeded by date with a fixed loadout, so it is identical for everyone. The first run is the one that counts, and the result is shared as emoji squares.
- Three daily quests are seeded by date. Three map fragments make a treasure map, and the next regular dig then places an epic or legendary find in the deepest layer, marked with an X.
- The look: the soil is painted once per dig as one continuous cross-section (`buildSoil`), and the hole edges crumble. There is also a work lamp at the last strike, a streak counter ("רצף") with a coin bonus every 5 breaks, cinematic finds with a holographic card for epic and above, and a full-screen level-up.
- The first dig ever places an uncommon find in rows 1–2, so a new player finds something fast.

## Content rules
- Facts about finds must be true and modest (real sites, real years). If unsure, say less rather than invent.
- Keep it fair: no real-money purchases, no timers that punish leaving.

## Checking it
Serve the repo root statically and open `/dig-game/`. `window.SHCHAVOT_GAME` exposes `state()`, `dig()`, `startDig(i, daily)` and `endDig()` for scripted checks. Check at 390px and 1360px (no horizontal scroll), play a dig to its summary, and look at the museum and the camp. To view all the art, put every id in `museum` in localStorage.

## Deploy
Push to `main`: `.github/workflows/vacation-hub-pages.yml` copies `dig-game/` to Pages.
