---
name: torah-hub
description: "Work on the standalone site 'ספריית קודש, הלכות חגים ואוצר לחג' (torah-hub/ in devops-hub, live at https://devopsdevopshaim-wq.github.io/devops-hub/torah-hub/): explain it, use it, change its pages, fix it or extend it. Use when the user mentions תנ"ך, סידור, רש"י, רמב"ם, תלמוד בבלי, הלכות חגים, זמני כניסת שבת, הגדה, מגילה, תהילים, ספריית קודש or torah-hub."
---

# ספריית קודש, הלכות חגים ואוצר לחג (torah-hub)

Three pages. The sacred library reads Tanakh, the siddur, Rashi/Rambam/Or HaChaim and the Babylonian Talmud live from Sefaria. Holiday halacha shows customs, laws and blessings for every holiday with real dates and candle-lighting/havdalah times (Jerusalem). The treasury lists haggadah, megillah, tehillim and other files that surface by date, with a countdown.

Live: https://devopsdevopshaim-wq.github.io/devops-hub/torah-hub/ · Code: `torah-hub/` in https://github.com/devopsdevopshaim-wq/devops-hub

## How it is built
The site is self-contained on GitHub Pages. It was written for a server (calls to `/api/...`); `hub/runtime.js` answers those calls inside the browser by running the server's own modules (`hub/lib/*.js`, copied unchanged) with small shims for files, https and the AI. Nothing is loaded from any other host except fonts and (for the AI and market data) the n8n server `https://haimkripisn.app.n8n.cloud/webhook/hasadna-hubs`.

| File | Role |
| --- | --- |
| `index.html` | the library |
| `holidays.html` | holiday halacha |
| `library.html` | the treasury |
| `js/torah.js, js/holidays.js, js/library.js` | page logic |
| `hub/lib/sefariaLibrary.js` | Sefaria reader and the catalog of books |
| `hub/lib/holidayHalacha.js` | the content registry and the date computation |
| `hub/lib/holidayResources.js, holidayStories.js, shabbatClient.js` | files by occasion, stories, candle lighting |
| `hub/hebcal-core.mjs` | the Hebrew calendar library, bundled (no CDN) |
| `data/holiday-resources.json` | which file belongs to which occasion |
| `library/` | haggadah, megillah, tehillim, reader.js |
| `hub/runtime.js` | the fetch hook, the module loader, the routes, `window.HUBMD` |
| `css/premium.css`, `js/premium.js`, `img/` | the luxury layer: tokens per site, the hero, illustration (`img/hero.svg`), background (`img/bg.webp`) |

## AI and no-AI behavior
No AI at all: dates and times are computed in the browser with @hebcal/core and texts come from Sefaria (CORS-enabled).
The n8n workflow is `n8n/hasadna-hubs.json` (built by `n8n/build-hubs-workflow.py`): origin lock, per-address rate limit, a daily cap, an allow-list of hosts. The key comes from the GEMINI_API_KEY secret at install time and is never in the repo.

## Changing it
1. The pages and the `js/` files of the site are edited in place. They are regenerated only by `node tools/build-hubs.mjs <path to magnet-studio>`, which overwrites `css/`, `js/` (except `premium.js`), `hub/` from the full system; if you edit a page by hand, put the change in `tools/build-hubs.mjs` or `tools/hubs/*` as well, or it will be lost.
2. The look is in `tools/hubs/premium.css` and `tools/hubs/premium.js` (shared by the five sites) and the pictures come from `python3 tools/hubs/art.py`. Rebuild with `node tools/build-hubs.mjs ...`.
3. Push to `main`: the Pages workflow publishes the site (about two minutes). The deploy copies the whole folder.

## Checking it
Open holidays.html and library.html and check the cards and the upcoming list; in index.html open a book. Test with Playwright against a static server, mocking `/webhook/hasadna-hubs`: `{action:'ai'}` answers `{ok:true,text}` or `{ok:false,error:'no-key'}`, `{action:'fetch'}` answers `{ok:true,status:200,body}`. Both the AI and the no-AI paths must work. `node n8n/test/run-all.mjs` runs the server tests.

## Rules
- Answer in Hebrew unless the user writes in another language. The site is RTL.
- Health and finance output is educational: keep the disclaimers, never present it as medical or investment advice.
- Do not add keys, accounts or personal data to the repo. Do not point the site back at the Render app.
