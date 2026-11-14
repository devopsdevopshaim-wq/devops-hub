---
name: bills-hub
description: "Work on the standalone site 'תשלומים חודשיים' (bills-hub/ in devops-hub, live at https://devopsdevopshaim-wq.github.io/devops-hub/bills-hub/): explain it, use it, change its pages, fix it or extend it. Use when the user mentions תשלומים חודשיים, קריאת מונה, מונה חשמל, מונה מים, חשבון חשמל, חשבון מים, ארנונה, ועד בית, שליחת חשבון בוואטסאפ, monthly bills or bills-hub."
---

# תשלומים לבית (bills-hub)

A Hebrew (RTL) monthly-bills site. The first tab, "לתשלום", lists what to pay now (late, due in 14 days, later, paid automatically, paid) across properties, with a pay link, a paid mark, a WhatsApp reminder, calendar reminders (.ics) and reading a bill from a photo or PDF. For each month (and optionally each property or tenant) the visitor enters the previous and current reading of each meter (electricity, water, gas, or any meter they add), a rate per unit, a fixed charge and optional VAT, plus fixed monthly payments (ארנונה, ועד בית, אינטרנט…). The site computes consumption and amounts, saves every month, and exports one Excel file with all the data, a bill picture (PNG), and shares both to WhatsApp.

Live: https://devopsdevopshaim-wq.github.io/devops-hub/bills-hub/ · Code: `bills-hub/` in https://github.com/devopsdevopshaim-wq/devops-hub

## How it is built
Plain static files with no build step and no server. Data lives only in the browser (`localStorage` key `bills-hub-v1`); the settings tab downloads and restores a JSON backup.

| File | Role |
| --- | --- |
| `index.html` | the page: tabs for the month's bill, history, settings and backup |
| `js/bills.js` | all logic: records, calculation, history and chart, Excel and PNG export, WhatsApp share, backup |
| `js/payments.js` | properties and services (provider, meter no., customer no., cycle, due day, method), the due list, pay links, .ics, the "מעקב תשלומים" Excel sheet, reading a bill (`window.BillsPayments`) |
| `js/hero3d.js` | the 3D scene in the top panel (three.js 0.186.1 through the import map in `index.html`): a house, the three utilities circling it (an orb turns red while that utility has a late bill, event `bills:status`), rising coins; drag to turn; it stops when off screen and stays still with reduced motion; the drawn SVG (`.hero.no3d`) shows when WebGL or the CDN is missing |
| `js/xlsx.js` | `MiniXLSX.build(sheets)`: a real .xlsx (stored zip, RTL sheets, frozen header) with no library |
| `css/bills.css` | the look, light and dark |

Stored in `localStorage` as `{ settings, records, properties, dues }`. A property is `{ id, name, address, city, services:[{ id, type, name, provider, meterNo, customerNo, cycle, dueDay, startMonth, amount, method, payUrl }] }`; `dues['<serviceId>|YYYY-MM']` holds `{ amount, date, period, source:'bill', auto, paidAt, paidAmount }`. Expected payments run from each service's `startMonth` every `cycle` months; the amount comes from a read bill, else from the property's month records, else the typed estimate. The property name is the month records' `unit`.

Reading a bill: the picture (resized JPEG) or PDF goes to the n8n server `hasadna-hubs` as `{action:'ai', tag:'bills', prompt, image, mime}`; Gemini answers JSON (type, provider, customer/meter number, readings, amount, due date, period, standing order). The user checks the fields, then the service, the due and the month readings are filled in. There is no public service that returns a bill by meter number in Israel (personal areas need ID + one-time code), so the site does not scrape providers; say so if asked.
Pay links: known providers' home pages (`PROVIDER_URLS`), else a Google search for the water corporation / arnona by city.

Record: `{ id: month|unit, month: 'YYYY-MM', unit, vatPct, meters:[{icon,name,uom,prev,curr,rate,fixed,vat}], fixed:[{name,amount}], notes, savedAt }`.
Meter amount = (curr − prev) × rate + fixed, × (1 + VAT%) when `vat` is ticked. A new month copies the previous month's current readings into "previous", and the rates and fixed payments, for the same unit.

The Excel file has two sheets: "סיכום חודשי" (a row per month and unit, a column per item) and "פירוט מלא" (every line with readings, consumption, rate, amount). The checkbox under the buttons picks all months or only the current one.

WhatsApp: on phones `navigator.share` sends the Excel file and the PNG straight into a chat. Where file sharing is not supported (most desktops) the Excel file downloads and `wa.me/<phone>?text=<summary>` opens; the user attaches the file. The phone number (optional) is in settings; a leading 0 becomes 972.

In the portfolio the site sits on the "בית ותשלומים" shelf (category `home` in `portfolio/projects.json`, with finance-hub). The top bar links the shelf: this site, מצפן פיננסי, all sites; finance-hub links back (kept by `tools/build-hubs.mjs`).

## Changing it
Edit the files in place. Push to `main`: `.github/workflows/vacation-hub-pages.yml` publishes `bills-hub/` to GitHub Pages (about two minutes).

## Checking it
Mock `/webhook/hasadna-hubs` in Playwright: `{ok:true,text:'<json>'}` and `{ok:false,error:'no-key'}`; open `#scan-open`, set `#scan-file`, click `#scan-apply`, then check `.due` rows, `.tile` sums, `#ics`, and the third Excel sheet. `node n8n/test/run-all.mjs` covers the server's picture handling.

Serve the repo root (`python3 -m http.server`) and open `/bills-hub/`. With Playwright: fill `#month`, the `.meter [data-k=prev|curr]` inputs and `.fixed-row [data-k=amount]`, click `#save`, check `#total`; switch to the next month and check that `prev` was copied; click `#dl-xlsx` and open the file with openpyxl; click `#dl-png`. Check there is no horizontal scroll at 360px.

## Rules
- Answer in Hebrew unless the user writes in another language. The site is RTL.
- The default rates are estimates; keep the note that tells users to update them from their bill.
- Do not add keys, accounts or personal data to the repo. Nothing is sent to a server except the shared usage counter (`../portfolio/js/track.js`).
