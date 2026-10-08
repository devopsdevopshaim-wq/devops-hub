---
name: marketing-hub
description: "Work on the standalone site 'פרסום ושיווק' (marketing-hub/ in devops-hub, live at https://devopsdevopshaim-wq.github.io/devops-hub/marketing-hub/): explain it, use it, change its pages, fix it or extend it. Use when the user mentions קמפיין, קופירייטינג, כותרות, פוסט לפייסבוק, אינסטגרם, מודעת גוגל, פלייר, וואטסאפ סטטוס, campaign builder or marketing-hub."
---

# פרסום ושיווק (marketing-hub)

A campaign builder: from a short brief (business, offer, goal, platform, tone, audience) it produces headlines, short/medium/long copy, calls to action, hashtags, target audience and a visual brief with an image-generator prompt, each with a copy button.

Live: https://devopsdevopshaim-wq.github.io/devops-hub/marketing-hub/ · Code: `marketing-hub/` in https://github.com/devopsdevopshaim-wq/devops-hub

## How it is built
The site is self-contained on GitHub Pages. It was written for a server (calls to `/api/...`); `hub/runtime.js` answers those calls inside the browser by running the server's own modules (`hub/lib/*.js`, copied unchanged) with small shims for files, https and the AI. Nothing is loaded from any other host except fonts and (for the AI and market data) the n8n server `https://haimkripisn.app.n8n.cloud/webhook/hasadna-hubs`.

| File | Role |
| --- | --- |
| `index.html` | the brief form and the result area |
| `js/marketing.js` | form, rendering, copy buttons |
| `hub/lib/adStudio.js` | server module, unchanged: prompt, parser, labels |
| `hub/lib/local.js` | marketing(): a template campaign built from the brief, no AI |
| `hub/runtime.js` | the fetch hook, the module loader, the routes, `window.HUBMD` |
| `css/premium.css`, `js/premium.js`, `img/` | the luxury layer: tokens per site, the hero, illustration (`img/hero.svg`), background (`img/bg.webp`) |

## AI and no-AI behavior
Copy is written by Gemini through the n8n server; without it a well-formed template campaign is built from the brief itself (source label: תבנית מקומית).
The n8n workflow is `n8n/hasadna-hubs.json` (built by `n8n/build-hubs-workflow.py`): origin lock, per-address rate limit, a daily cap, an allow-list of hosts. The key comes from the GEMINI_API_KEY secret at install time and is never in the repo.

## Changing it
1. The pages and the `js/` files of the site are edited in place. They are regenerated only by `node tools/build-hubs.mjs <path to magnet-studio>`, which overwrites `css/`, `js/` (except `premium.js`), `hub/` from the full system; if you edit a page by hand, put the change in `tools/build-hubs.mjs` or `tools/hubs/*` as well, or it will be lost.
2. The look is in `tools/hubs/premium.css` and `tools/hubs/premium.js` (shared by the five sites) and the pictures come from `python3 tools/hubs/art.py`. Rebuild with `node tools/build-hubs.mjs ...`.
3. Push to `main`: the Pages workflow publishes the site (about two minutes). The deploy copies the whole folder.

## Checking it
Fill #mk-business and #mk-offer and submit #mk-form; the result appears in #mk-result. Test with Playwright against a static server, mocking `/webhook/hasadna-hubs`: `{action:'ai'}` answers `{ok:true,text}` or `{ok:false,error:'no-key'}`, `{action:'fetch'}` answers `{ok:true,status:200,body}`. Both the AI and the no-AI paths must work. `node n8n/test/run-all.mjs` runs the server tests.

## Rules
- Answer in Hebrew unless the user writes in another language. The site is RTL.
- Health and finance output is educational: keep the disclaimers, never present it as medical or investment advice.
- Do not add keys, accounts or personal data to the repo. Do not point the site back at the Render app.
