# Customizing the look

The template's identity is an **airport departure board** (amber on night-navy), **boarding-pass** components (perforated summary cards) and **vintage travel posters** (flat SVG illustrations). Keep that identity unless the user asks for another direction. Change one or two levers per site so each site feels like its own brand.

## Brand
`js/config.js → brand.name / brand.title`. `new-site.py` also writes them into `index.html` (the `<title>` and every `[data-brand]` element), so the name is right even before JS runs.

## Colors: `css/styles.css`
Tokens are defined on `:root` (light) and redefined twice for dark: under `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` and under `:root[data-theme="dark"]`. **Change a token in all three places.**

| Token | Role |
| --- | --- |
| `--teal` | Primary action and link color |
| `--amber` / `--board-text` | Accent, departure-board digits, highlight buttons |
| `--board` | Top bar, departure board, deal pass header |
| `--paper` / `--surface` / `--surface-2` | Page and card backgrounds |
| `--ink` / `--muted` / `--line` | Text and hairlines |

Keep enough contrast. Amber text on `--board` and white text on `--teal` must stay readable.

## Fonts
The Google Fonts link in `index.html` and `--font-display / --font-body / --font-mono` in `:root`. The display font must support Hebrew. Good pairs: Karantina + IBM Plex Sans Hebrew (default), Suez One + Assistant, Frank Ruhl Libre + Heebo, Secular One + Rubik.

## Posters
Each destination's `poster` palette sets its card, hero and fallback art. Pick colors from the place itself (sea, stone, sunset, city lights). Icons are listed in data-schema.md. To add an icon, add a function to `icons` in `js/posters.js` that draws in a 100×160 box with the base at y=160.

## Home page
In `js/app.js`:
- **Hero slideshow:** the `SLIDES` array in `renderHome()`. It holds destination ids whose first photo rotates behind the hero.
- **Feature cards:** the `.features` block in `renderHome()`.
- **Featured videos:** `APP_MEDIA_FEATURED` in media.js.
- **Chat suggestion chips:** the `CHIPS` array. Keep the examples tied to the site's destinations.

## Scope changes
- **Israel-only site:** set every destination to `region: 'il'`. Flight and booking tabs adapt automatically (no flight sites when `flightTime: 0`).
- **Different origin airport:** edit `origin` in data.js. Some UI copy mentions נתב״ג/TLV; search app.js for `TLV` and `נתב״ג`.
- **Without kosher focus:** keep `kosher: []` and set `kosherNote` to a neutral line. The tab still renders.
