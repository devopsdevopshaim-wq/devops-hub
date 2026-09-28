---
name: travel-site-builder
description: Build a complete Hebrew (RTL) vacation-management website in the "Masa" format. It has a date-range calendar that ranks destinations by weather and season, and a page per destination covering flights and airport transfers, hotels with verified addresses and phones, car rental, kosher/Michelin/local restaurants, money and live exchange rates, contacts, public transport, routes, a map, and real photos and traveler videos. It also has a deal builder that closes through the agent's WhatsApp/email or affiliate links, a portal of all vacation sites, a TLV airport departure planner, a budget calculator, saved trips and a help chat. Use when the user wants a vacation, travel, tourism or travel-agency website, or "a site like מסע", for example "אתר חופשות", "אתר נופש", "אתר לסוכנות נסיעות", "תבנה לי אתר טיולים ליוון", "אתר דומה למסע", "עוד אתר במתכונת של אתר החופשות". Also use when adding or updating destinations on a site built from this template.
---

# Travel Site Builder (Masa format)

This skill builds a static site that runs from `index.html`, needs no build step and deploys to GitHub Pages, Netlify or a Claude artifact. `template/` holds a complete, working site with 14 example destinations. Every new site starts as a copy of it. You then swap the brand, contacts and destinations for real, verified data.

## Files at a glance

| Path in the site | Role | Usually edited? |
| --- | --- | --- |
| `js/config.js` | Brand name, agency WhatsApp/email/phone, affiliate partner IDs | Always |
| `js/data.js` | Destinations: facts, climate, costs, airport, hotels, car, food, transit, routes, map points, poster palette. Also origin airport, holidays and booking sites | Always |
| `js/media.js` | Per destination: Wikimedia Commons photo file names and YouTube video IDs | Always |
| `js/money.js` | Currencies (notes and coins), plus per-destination payment, ATM and tax tips and typical prices | Always |
| `js/sites.js` | The all-sites portal (flights, hotels, packages, cars, activities, insurance) | Sometimes |
| `css/styles.css` | Design tokens on `:root` (light) and the dark blocks | For rebranding |
| `js/posters.js` | SVG travel-poster illustrations (14 landmark icons) | Rarely |
| `js/app.js` | All views and logic | Rarely |

Full field reference: [references/data-schema.md](references/data-schema.md).

## Workflow

### 1. Collect what only the user knows
Ask once, briefly, and only for what's missing:
- **Site name** (the brand, in Hebrew).
- **Agency contacts:** WhatsApp, phone and email. These power the "close the deal via the agent" button. Without them the button stays hidden and the site shows a neutral note.
- **Destinations:** which ones, and how many. If the user gives a theme ("Greek islands", "family ski"), pick 8–14 fitting destinations yourself and say which.
- Optional: affiliate IDs (Booking aid, Expedia affcid, Discover Cars a_aid, GetYourGuide partner_id, Travelpayouts marker), a color direction, and where to publish.

Don't ask about anything else. Use the template's defaults.

### 2. Scaffold
```bash
python3 <skill>/scripts/new-site.py <target-dir> --brand "שם" \
  --whatsapp 0501234567 --phone 050-123-4567 --email x@y.com [--agency "..."] [--license ...]
```
This copies `template/` and writes the brand into `config.js` and `index.html`. Local Israeli numbers (0…) are converted to `972…`.

### 3. Replace the destinations with researched data
Build each destination by following [references/research.md](references/research.md). The rules that matter most:
- **Never invent a phone number, address, video ID or photo file name.** Every one must come from a search result you actually saw. If you can't verify one, leave the field out; the UI hides missing contact fields.
- **Check for closures.** A result marked "CLOSED" or "permanently closed" means drop the listing.
- **Never fabricate testimonials or reviews.** The "recommenders" section uses real YouTube videos by real travelers. If the user wants customer testimonials, add only real ones they supply.
- Prices, flight times, climate and Michelin stars are **estimates**. The site already labels them as such. Keep them realistic.
- Keep `media.js` and `money.js` keys identical to destination `id`s.

Mind the effort: each destination needs roughly 4–6 hotel/restaurant lookups, 1–3 photo searches and 1–2 video searches. Run independent searches in parallel.

### 4. Customize the look (optional)
See [references/customization.md](references/customization.md): palette tokens, fonts, poster palettes and icons, hero slideshow destinations, featured videos, chat suggestion chips.

### 5. Validate
```bash
node <skill>/scripts/validate.mjs <site-dir>
```
Fix every `ERROR`. Review each `WARN`: a missing phone is fine if it couldn't be verified. Then render once with Playwright to check desktop and mobile. In Claude Code on the web, use `executablePath: '/opt/pw-browsers/chromium'`. Check that `document.documentElement.scrollWidth` equals the viewport width at 390px and that there are no `pageerror`s. Network errors for blocked image hosts in a sandbox are expected.

### 6. Deliver
Pick what fits the user. Details are in [references/deploy.md](references/deploy.md).
- **Claude artifact** (instant private link): `python3 <skill>/scripts/build-artifact.py <site-dir> <out.html>`, then publish `<out.html>` with the `files` map it prints. In artifacts, external photos, the YouTube player and map tiles are blocked by CSP; the illustrated posters and link-outs cover for them.
- **ZIP**: `<skill>/scripts/make-zip.sh <site-dir>`. The user unzips it and opens `index.html`.
- **GitHub Pages**: `<skill>/scripts/publish-gh-pages.sh <site-dir>` pushes a `gh-pages` branch. For a **public** repo, that alone turns Pages on, with no Settings step. Private repos need a paid plan. For automatic updates, add the workflow from deploy.md.
- **Netlify Drop**: the user drags the folder onto app.netlify.com/drop.

### 7. Report honestly
Tell the user what you verified and where (list the sources), what is estimated, which listings you removed as closed, and what they still need to provide (contacts, partner IDs). Payment processing inside the site is **not** supported. It needs a merchant account and a backend. Deals close through the agent or at the provider.

## Adding destinations to an existing site
Append an object to `D` in `js/data.js`, add matching keys in `media.js` and `money.js` (plus a currency entry if the currency is new), and run `validate.mjs`. Nothing else needs to change: the destination grid, ranking, deal builder, portal, budget, chat and airport planner all read from the data.
