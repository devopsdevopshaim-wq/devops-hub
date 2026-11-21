---
name: finance-hub
description: "Work on the standalone site 'מצפן פיננסי' (finance-hub/ in devops-hub, live at https://devopsdevopshaim-wq.github.io/devops-hub/finance-hub/): explain it, use it, change its pages, fix it or extend it. Use when the user mentions מצפן פיננסי, תוכנית התנהלות פיננסית, קרן חירום, תקציב 50/30/20, נתוני שוק, finance compass or finance-hub."
---

# מצפן פיננסי (finance-hub)

A Hebrew (RTL) personal-finance compass: the visitor enters income, expenses, savings and debts; the site computes metrics (savings rate, emergency months, debt-to-income, net worth, flags) and writes a personalized plan, and a second tab shows market quotes, headlines and an outlook. Educational only, never investment advice.

Live: https://devopsdevopshaim-wq.github.io/devops-hub/finance-hub/ · Code: `finance-hub/` in https://github.com/devopsdevopshaim-wq/devops-hub

## How it is built
The site is self-contained on GitHub Pages. It was written for a server (calls to `/api/...`); `hub/runtime.js` answers those calls inside the browser by running the server's own modules (`hub/lib/*.js`, copied unchanged) with small shims for files, https and the AI. Nothing is loaded from any other host except fonts and (for the AI and market data) the n8n server `https://haimkripisn.app.n8n.cloud/webhook/hasadna-hubs`.

| File | Role |
| --- | --- |
| `index.html` | the page: form, results, plan, market tab |
| `js/finance.js` | all the page logic (tabs, form, metrics, plan, market) |
| `hub/lib/financeAdvisor.js` | the server module, unchanged: computeMetrics(), the prompt, analyze() |
| `hub/lib/marketData.js` | quotes, news and outlook from Yahoo Finance and Globes |
| `hub/lib/local.js` | finance(): the plan computed without AI (50/30/20, debt payoff months, emergency fund timeline) |
| `hub/runtime.js` | the fetch hook, the module loader, the routes, `window.HUBMD` |
| `css/premium.css`, `js/premium.js`, `img/` | the luxury layer: tokens per site, the hero, illustration (`img/hero.svg`), background (`img/bg.webp`) |

## AI and no-AI behavior
The plan is written by Gemini through the n8n server; with no key, quota or network the same eight sections are computed locally (source label: חישוב מקומי). Market data goes through the server (browsers may not read Yahoo/Globes).
The n8n workflow is `n8n/hasadna-hubs.json` (built by `n8n/build-hubs-workflow.py`): origin lock, per-address rate limit, a daily cap, an allow-list of hosts. The key comes from the GEMINI_API_KEY secret at install time and is never in the repo.

## Changing it
1. The pages and the `js/` files of the site are edited in place. They are regenerated only by `node tools/build-hubs.mjs <path to magnet-studio>`, which overwrites `css/`, `js/` (except `premium.js`), `hub/` from the full system; if you edit a page by hand, put the change in `tools/build-hubs.mjs` or `tools/hubs/*` as well, or it will be lost.
2. The look is in `tools/hubs/premium.css` and `tools/hubs/premium.js` (shared by the five sites) and the pictures come from `python3 tools/hubs/art.py`. Rebuild with `node tools/build-hubs.mjs ...`.
3. Push to `main`: the Pages workflow publishes the site (about two minutes). The deploy copies the whole folder.

## Checking it
Fill #netIncome, #fixedExpenses, #variableExpenses, #cashSavings, click #fin-analyze; open the market tab (.fin-tab[data-panel=market]). Test with Playwright against a static server, mocking `/webhook/hasadna-hubs`: `{action:'ai'}` answers `{ok:true,text}` or `{ok:false,error:'no-key'}`, `{action:'fetch'}` answers `{ok:true,status:200,body}`. Both the AI and the no-AI paths must work. `node n8n/test/run-all.mjs` runs the server tests.

## Rules
- Answer in Hebrew unless the user writes in another language. The site is RTL.
- Health and finance output is educational: keep the disclaimers, never present it as medical or investment advice.
- Do not add keys, accounts or personal data to the repo. Do not point the site back at the Render app.
