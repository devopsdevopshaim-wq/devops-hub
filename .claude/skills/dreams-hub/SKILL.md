---
name: dreams-hub
description: "Work on the standalone site 'פשר — פתרון חלומות לפי המקורות' (dreams-hub/ in devops-hub, live at https://devopsdevopshaim-wq.github.io/devops-hub/dreams-hub/): explain it, use it, change its pages, fix it or extend it. Use when the user mentions פתרון חלומות, פשר, חלום, הטבת חלום, תענית חלום, ברכות נה-נז, זוהר על חלומות or dreams-hub."
---

# פשר — פתרון חלומות לפי המקורות (dreams-hub)

One page, a full interpretation engine that runs in the browser. The visitor writes a dream in free Hebrew; the engine finds symbols (prefix and light suffix stripping, multi-word phrases), decides the dream's theme (פרנסה, משפחה, בריאות, רוחניות, פחד, עלייה, דרך, נשמות, חכמה — also from plain theme words when no symbol matches), weighs the dream (dawn, repeated, a friend's dream, how they woke), and writes a full reading in five paragraphs (ראשית, לב החלום, המסר, המימד הפנימי, הלכה למעשה). Where the Gemara distinguishes cases (snake bit / killed, what the dead gave or took, horse colour, eggs broken…) the card asks a clarifying question; words in the dream answer it automatically and a click changes it. Then a treatment plan by time (morning, day, before sleep, coming days) with verses, Tehillim, hatavat chalom, tzedakah. Also: gematria hints and a calculator (only equivalences known from the sources), a symbol dictionary, principles and library (linked to Sefaria), the full hatavat chalom order, and a dream journal (localStorage) that spots recurring themes and symbols. The AI "חוות דעת מורחבת" is an optional extra.

Live: https://devopsdevopshaim-wq.github.io/devops-hub/dreams-hub/ · Code: `dreams-hub/`

| File | Role |
| --- | --- |
| `index.html` | the page and its sections (interpret, symbols, sources, hatava, journal) |
| `js/symbols.js` | the first symbols (mostly Berakhot 55–57) and the principles (`window.PESHER`) |
| `js/knowledge.js` | more symbols, `ASK` (clarifying questions) and `ASK_AUTO` (dream words that answer them), `THEMES` (message, inner dimension, Tehillim, act), `THEME_WORDS`, `GEMATRIA`, extra principles |
| `js/dreams.js` | matching, auto-answers, theme, verdict, the written reading, the plan, rendering, AI, journal, dictionary, gematria calculator, the night sky; `PESHER.interpret(text, ctx, answers)` is exposed for tests |
| `css/dreams.css` | the look: night blue and old gold, Frank Ruhl Libre + Heebo |
| `img/mark.svg` | the mark and favicon |

## Content rules
- Every symbol carries `src` and `ref`. A meaning that is not explicit in the Gemara is marked `note: true` and shown as "רוח הדברים" — never present it as a quotation.
- Never invent a source or a daf. If unsure, cite the chapter generally or mark it `note`.
- Always interpret for the good ("כל החלומות הולכים אחר הפה"); no predictions of death, illness or disaster.
- Keep the disclaimer: not a substitute for a rav (halacha) or for medical/mental-health care.
- A keyword that is also a common word in another sense causes false hits (seen: "סוף" in "בסוף", "רבה"/"הרב" in "הרבה", "סדר" in "בסדר", "נר" inside "נראה"); prefer longer, unambiguous forms, and run a sweep of ordinary dreams through `PESHER.interpret` after adding words.
- Gematria: only show equivalences that appear in the sources (נחש=משיח, יין=סוד, סלם=סיני…), never invent meanings for a number.

## AI
Optional "פירוש מעמיק" posts `{action:'ai', prompt}` to the n8n webhook `hasadna-hubs` (origin-locked to the Pages origin). Everything else works without it; errors show a message and the source-based result stands.

## Checking it
Serve the repo root statically, open `/dreams-hub/`, click "דוגמה לחלום" then "פתרו את החלום"; answer a clarifying question and see the reading change; check symbols, recommendations, journal and dictionary search at 1360px and 390px (no horizontal scroll). Mock `**/webhook/hasadna-hubs` with `{ok:true,text}` and with `{ok:false,error:'no-key'}`.

## Deploy
Push to `main`: `.github/workflows/vacation-hub-pages.yml` copies `dreams-hub/` to Pages.
