---
name: wellness-hub
description: "Work on the standalone site 'מצפן בריאות וכושר יומי' (wellness-hub/ in devops-hub, live at https://devopsdevopshaim-wq.github.io/devops-hub/wellness-hub/): explain it, use it, change its pages, fix it or extend it. Use when the user mentions מצפן בריאות, BMI, ירידה במשקל, נפיחות, דגלים אדומים, כושר יומי, תרגילים, health compass or wellness-hub."
---

# מצפן בריאות וכושר יומי (wellness-hub)

Two pages. The health compass screens red flags, collects data (age, sex, height, weight, waist, symptoms, habits), shows BMI and waist risk and produces a four-week plan (calories, protein, activity, bloating steps, tests to discuss, follow-up). The daily fitness page shows today's routine, the weekly cycle and an exercise library with drawn figures. Never a diagnosis or medical advice.

Live: https://devopsdevopshaim-wq.github.io/devops-hub/wellness-hub/ · Code: `wellness-hub/` in https://github.com/devopsdevopshaim-wq/devops-hub

## How it is built
The site is self-contained on GitHub Pages. It was written for a server (calls to `/api/...`); `hub/runtime.js` answers those calls inside the browser by running the server's own modules (`hub/lib/*.js`, copied unchanged) with small shims for files, https and the AI. Nothing is loaded from any other host except fonts and (for the AI and market data) the n8n server `https://haimkripisn.app.n8n.cloud/webhook/hasadna-hubs`.

| File | Role |
| --- | --- |
| `index.html` | the compass |
| `fitness.html` | the daily training page |
| `js/health.js` | flags, form, BMI, report |
| `js/fitness.js` | routine and library |
| `js/exercise-figures.js` | the SVG figures |
| `data/exercises.json` | the exercises and the weekly cycle |
| `hub/lib/healthAdvisor.js` | server module, unchanged |
| `hub/lib/local.js` | health(): the report computed from the data (Mifflin-St Jeor, deficit of 500 kcal with a floor, protein per kg, 4-week activity plan) |
| `hub/runtime.js` | the fetch hook, the module loader, the routes, `window.HUBMD` |
| `css/premium.css`, `js/premium.js`, `img/` | the luxury layer: tokens per site, the hero, illustration (`img/hero.svg`), background (`img/bg.webp`) |

## AI and no-AI behavior
The report is written by Gemini through the n8n server; without it the same eight sections are computed locally, so the compass always works. The report is rendered with window.HUBMD (a small Markdown reader in the runtime).
The n8n workflow is `n8n/hasadna-hubs.json` (built by `n8n/build-hubs-workflow.py`): origin lock, per-address rate limit, a daily cap, an allow-list of hosts. The key comes from the GEMINI_API_KEY secret at install time and is never in the repo.

## Changing it
1. The pages and the `js/` files of the site are edited in place. They are regenerated only by `node tools/build-hubs.mjs <path to magnet-studio>`, which overwrites `css/`, `js/` (except `premium.js`), `hub/` from the full system; if you edit a page by hand, put the change in `tools/build-hubs.mjs` or `tools/hubs/*` as well, or it will be lost.
2. The look is in `tools/hubs/premium.css` and `tools/hubs/premium.js` (shared by the five sites) and the pictures come from `python3 tools/hubs/art.py`. Rebuild with `node tools/build-hubs.mjs ...`.
3. Push to `main`: the Pages workflow publishes the site (about two minutes). The deploy copies the whole folder.

## Checking it
Fill #age, #sex, #height, #weight, tick a symptom, click #hcAnalyze; on fitness.html check the routine renders. Test with Playwright against a static server, mocking `/webhook/hasadna-hubs`: `{action:'ai'}` answers `{ok:true,text}` or `{ok:false,error:'no-key'}`, `{action:'fetch'}` answers `{ok:true,status:200,body}`. Both the AI and the no-AI paths must work. `node n8n/test/run-all.mjs` runs the server tests.

## Rules
- Answer in Hebrew unless the user writes in another language. The site is RTL.
- Health and finance output is educational: keep the disclaimers, never present it as medical or investment advice.
- Do not add keys, accounts or personal data to the repo. Do not point the site back at the Render app.
