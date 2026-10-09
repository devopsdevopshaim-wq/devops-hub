---
name: bills-hub
description: "Work on the standalone site 'תשלומים חודשיים' (bills-hub/ in devops-hub, live at https://devopsdevopshaim-wq.github.io/devops-hub/bills-hub/): explain it, use it, change its pages, fix it or extend it. Use when the user mentions תשלומים חודשיים, קריאת מונה, מונה חשמל, מונה מים, חשבון חשמל, חשבון מים, ארנונה, ועד בית, שליחת חשבון בוואטסאפ, monthly bills or bills-hub."
---

# תשלומים חודשיים (bills-hub)

A Hebrew (RTL) monthly-bills site. For each month (and optionally each property or tenant) the visitor enters the previous and current reading of each meter (electricity, water, gas, or any meter they add), a rate per unit, a fixed charge and optional VAT, plus fixed monthly payments (ארנונה, ועד בית, אינטרנט…). The site computes consumption and amounts, saves every month, and exports one Excel file with all the data, a bill picture (PNG), and shares both to WhatsApp.

Live: https://devopsdevopshaim-wq.github.io/devops-hub/bills-hub/ · Code: `bills-hub/` in https://github.com/devopsdevopshaim-wq/devops-hub

## How it is built
Plain static files with no build step and no server. Data lives only in the browser (`localStorage` key `bills-hub-v1`); the settings tab downloads and restores a JSON backup.

| File | Role |
| --- | --- |
| `index.html` | the page: tabs for the month's bill, history, settings and backup |
| `js/bills.js` | all logic: records, calculation, history and chart, Excel and PNG export, WhatsApp share, backup |
| `js/xlsx.js` | `MiniXLSX.build(sheets)`: a real .xlsx (stored zip, RTL sheets, frozen header) with no library |
| `css/bills.css` | the look, light and dark |

Record: `{ id: month|unit, month: 'YYYY-MM', unit, vatPct, meters:[{icon,name,uom,prev,curr,rate,fixed,vat}], fixed:[{name,amount}], notes, savedAt }`.
Meter amount = (curr − prev) × rate + fixed, × (1 + VAT%) when `vat` is ticked. A new month copies the previous month's current readings into "previous", and the rates and fixed payments, for the same unit.

The Excel file has two sheets: "סיכום חודשי" (a row per month and unit, a column per item) and "פירוט מלא" (every line with readings, consumption, rate, amount). The checkbox under the buttons picks all months or only the current one.

WhatsApp: on phones `navigator.share` sends the Excel file and the PNG straight into a chat. Where file sharing is not supported (most desktops) the Excel file downloads and `wa.me/<phone>?text=<summary>` opens; the user attaches the file. The phone number (optional) is in settings; a leading 0 becomes 972.

## Changing it
Edit the files in place. Push to `main`: `.github/workflows/vacation-hub-pages.yml` publishes `bills-hub/` to GitHub Pages (about two minutes).

## Checking it
Serve the repo root (`python3 -m http.server`) and open `/bills-hub/`. With Playwright: fill `#month`, the `.meter [data-k=prev|curr]` inputs and `.fixed-row [data-k=amount]`, click `#save`, check `#total`; switch to the next month and check that `prev` was copied; click `#dl-xlsx` and open the file with openpyxl; click `#dl-png`. Check there is no horizontal scroll at 360px.

## Rules
- Answer in Hebrew unless the user writes in another language. The site is RTL.
- The default rates are estimates; keep the note that tells users to update them from their bill.
- Do not add keys, accounts or personal data to the repo. Nothing is sent to a server except the shared usage counter (`../portfolio/js/track.js`).
