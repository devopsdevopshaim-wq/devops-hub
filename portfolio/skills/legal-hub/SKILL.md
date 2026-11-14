---
name: legal-hub
description: "Work on the standalone site 'מצפן משפטי — מענה משפטי ראשוני' (legal-hub/ in devops-hub, live at https://devopsdevopshaim-wq.github.io/devops-hub/legal-hub/): explain it, use it, change its pages, fix it or extend it. Use when the user mentions מצפן משפטי, שאלה משפטית, מענה משפטי, ייעוץ משפטי ראשוני, פיצויי פיטורים, מכתב התראה, תביעה קטנה, צו הגנה, הוצאה לפועל or legal-hub."
---

# מצפן משפטי (legal-hub)

One page with hash routes. The visitor writes a legal question in free Hebrew. The engine finds the area and the situation, and spots danger, arrest and deadlines. The answer is shown as a "חוות דעת ראשונית" sheet: the question, a short answer, rights, numbered steps, where to turn, when a lawyer is needed, and a side column with deadlines, documents and laws (linked to Wikisource). An urgency seal marks how pressing it is. An optional "מענה מורחב" (AI) writes an answer to the exact question, and the visitor can ask follow-ups. Also: 5 calculators (severance, notice, recuperation pay, deadlines, maternity), 7 letter templates, a courts guide, a directory of where to turn, a glossary, and saved questions (localStorage only).

Live: https://devopsdevopshaim-wq.github.io/devops-hub/legal-hub/ · Code: `legal-hub/`

| File | Role |
| --- | --- |
| `index.html` | the views (`data-view`): home, areas, area, answer, tools, letters, courts, help, glossary, saved |
| `js/law.js` | the knowledge base `window.LAW`: `AREAS` → `issues` (fields documented at the top of the file), `WHERE` (where to turn), `GLOSSARY`, `COURTS`, `STEPS_CIVIL` |
| `js/engine.js` | `ENGINE.analyze(text)` — Hebrew normalising, prefix/suffix variants, keyword and phrase scoring, red flags; `ENGINE._dbg(text)` shows which keywords hit |
| `js/tools.js` | calculators (`TOOLS.calc`), deadline list `LIMITS`, letter templates `LETTERS` |
| `js/app.js` | routing, rendering, AI call, follow-ups, accessibility (font size, contrast), saved questions |
| `css/legal.css` | the look: navy ink, burgundy seal, brass; Frank Ruhl Libre (headings), Assistant (UI), David Libre (the opinion body, as in court rulings) |

## Content rules
- Israeli law only. Never invent a statute, section number, ruling or amount; cite a section only when certain, otherwise the law's name.
- Amounts and caps that change yearly (minimum wage, small claims cap, recuperation day value) are written as approximate and "מתעדכן".
- Keep the disclaimer and the line saying the site is not affiliated with the judiciary or any government body; never use the state emblem or court branding.
- Danger (violence, self-harm) always shows emergency numbers first: 100, 118, 1201, 1202/1203, 105.
- After adding keywords, run a sweep of ordinary questions through `ENGINE.analyze` (node: set `global.window={}` and require law.js then engine.js) and check no common word causes false hits.

## AI
"מענה מורחב" posts `{action:'ai', tag:'legal', prompt}` to the n8n webhook `hasadna-hubs` (origin-locked to the Pages origin). Everything else works without it.

## Checking it
Serve the repo root statically, open `/legal-hub/`, ask an example question, check the answer and the AI box (mock `**/webhook/hasadna-hubs` with `{ok:true,text}` and `{ok:false,error:'no-key'}`), calculators, letters, at 1360px and 390px (no horizontal scroll).

## Deploy
Push to `main`: `.github/workflows/vacation-hub-pages.yml` copies `legal-hub/` to Pages.
