---
name: dreams-hub
description: "Work on the standalone site 'פשר — פתרון חלומות לפי המקורות' (dreams-hub/ in devops-hub, live at https://devopsdevopshaim-wq.github.io/devops-hub/dreams-hub/): explain it, use it, change its pages, fix it or extend it. Use when the user mentions פתרון חלומות, פשר, חלום, הטבת חלום, תענית חלום, ברכות נה-נז, זוהר על חלומות or dreams-hub."
---

# פשר — פתרון חלומות לפי המקורות (dreams-hub)

One page. The visitor writes a dream in free Hebrew; the site finds its symbols, weighs the dream (dawn dream, repeated dream, a friend's dream, how they woke) and gives an interpretation per symbol with its source, a verse to say first ("יקדים ויאמר"), and practical recommendations (hatavat chalom, the prayer during Birkat Kohanim, tzedakah, Kriat Shema al hamita, ta'anit chalom only with a rav). Also: a symbol dictionary, principles and library (all linked to Sefaria), the full hatavat chalom order, and a dream journal (localStorage only).

Live: https://devopsdevopshaim-wq.github.io/devops-hub/dreams-hub/ · Code: `dreams-hub/`

| File | Role |
| --- | --- |
| `index.html` | the page and its sections (interpret, symbols, sources, hatava, journal) |
| `js/symbols.js` | the symbol database and the principles (`window.PESHER`) |
| `js/dreams.js` | matching (Hebrew prefix stripping), verdict, recommendations, rendering, AI, journal, dictionary, the night sky |
| `css/dreams.css` | the look: night blue and old gold, Frank Ruhl Libre + Heebo |
| `img/mark.svg` | the mark and favicon |

## Content rules
- Every symbol carries `src` and `ref`. A meaning that is not explicit in the Gemara is marked `note: true` and shown as "רוח הדברים" — never present it as a quotation.
- Never invent a source or a daf. If unsure, cite the chapter generally or mark it `note`.
- Always interpret for the good ("כל החלומות הולכים אחר הפה"); no predictions of death, illness or disaster.
- Keep the disclaimer: not a substitute for a rav (halacha) or for medical/mental-health care.
- A keyword that is also a common word in another sense (e.g. "לבנה" = white) causes false hits; prefer longer, unambiguous forms.

## AI
Optional "פירוש מעמיק" posts `{action:'ai', prompt}` to the n8n webhook `hasadna-hubs` (origin-locked to the Pages origin). Everything else works without it; errors show a message and the source-based result stands.

## Checking it
Serve the repo root statically, open `/dreams-hub/`, click "דוגמה" then "פתרו את החלום"; check symbols, recommendations, journal and dictionary search at 1360px and 390px (no horizontal scroll). Mock `**/webhook/hasadna-hubs` with `{ok:true,text}` and with `{ok:false,error:'no-key'}`.

## Deploy
Push to `main`: `.github/workflows/vacation-hub-pages.yml` copies `dreams-hub/` to Pages.
