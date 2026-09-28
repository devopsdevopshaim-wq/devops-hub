# Data schema

All data files assign a global on `window` and are plain scripts (no modules), so the site works from `file://`.

## js/data.js → `window.APP_DATA = { origin, holidays, bookingSites, destinations }`

### Destination object (one per entry in `D`)

```js
{
  id: 'rome',                    // lowercase latin, unique; used in URLs (#dest-rome) and media/money keys
  name: 'רומא', nameEn: 'Rome',  // nameEn is used in booking-site searches and map queries
  country: 'איטליה',
  region: 'abroad',              // 'il' (Israel, no flight) | 'abroad'
  iata: 'FCO',                   // destination airport code; 'TLV' for Israeli cities reached by road
  coords: [41.9028, 12.4964], zoom: 13,          // map center
  tagline: 'שורה אחת', about: '2–3 משפטים',
  currency: { code: 'EUR', name: 'אירו', rate: 4.1 },  // rate = ₪ per 1 unit (fallback when live rate fails)
  language: 'איטלקית',
  tzDiff: -1,                    // hours relative to Israel
  flightTime: 3.5,               // hours from TLV; 0 = no flight
  visa: 'טקסט', plug: 'C / F / L', emergency: '112', drivingSide: 'ימין', tipping: 'טקסט',
  climate: [12,13,16,19,23,28,31,31,27,22,16,13],  // avg max °C Jan..Dec (exactly 12)
  bestMonths: [4,5,6,9,10],                          // 1-based months
  costs: {                       // ₪, used by ranking, budget and deal estimates
    flight: 1300,                // round trip per person, economy
    hotel: { budget: 450, mid: 950, lux: 3500 },     // per night per double room
    car: 200, food: 280, transport: 35               // per day (car per vehicle; food/transport per person)
  },
  airport: {
    name: 'פיומיצ׳ינו', code: 'FCO',
    toCity: [ { mode: 'Leonardo Express', time: '32 דק׳', cost: '€14 בערך' } ],  // first entry = default transfer (its minutes feed the airport planner)
    note: 'טקסט'
  },
  hotels: [                      // 3–4, mix of tiers; the deal builder lists these
    { name: 'Hotel Artemide', addr: 'Via Nazionale 22, 00184 Roma', phone: '+39 06 489911',
      web: 'https://…', area: 'Via Nazionale', tier: 'mid', price: 1000, note: 'קרוב לטרמיני' }
    // addr/phone/web optional — include ONLY when verified. phone format: +<country> <digits with spaces>
    // kind (optional, default 'hotel'): hotel | boutique | resort | spa | zimmer | cabins | farm | kibbutz | lodge | hostel
    //   → drives the stay filters (מלונות / צימרים, בקתות וחוות / ספא …). zimmer/cabins/farm/lodge/kibbutz count as "צימרים".
    // tags (optional): family | couple | spa | pool | adults | nature | budget | view — only what the source supports
  ],
  car: { need: 'לא בעיר; כן לטוסקנה', companies: ['Europcar','Hertz'], tips: ['...'] },
      // need starting with חיוני|מומלץ|כן|שימושי → car is included in cost estimates
  kosherNote: 'טקסט', kosher: [ { name, area, note, addr?, phone?, web? } ],
  food: [ { name, type, area, price: '€€' } ],             // local, not necessarily kosher
  michelinNote: 'טקסט', michelin: [ { name, stars: 3, cuisine, area, addr?, phone?, web? } ],  // [] in Israel
  transit: { system, card, single, day, apps: ['Moovit'], notes },
  routes: [ { name, days: 2, stops: ['...'], desc } ],
  pois: [ { name: 'הקולוסיאום', c: [41.8902, 12.4922] } ],   // map markers, 4–6
  fun: [                          // optional — "בילוי ואטרקציות" tab (shown only when present)
    { name, type: 'מוזיאון', tags: ['family', 'culture'], addr?, phone?, web?, note: 'שעות, שבת, הזמנה מראש' }
    // tags: family | couple | nature | relax | culture | night | food | adventure (filter chips are built from them)
  ],
  vibes: { family: 3, couple: 2, nature: 2, relax: 3, culture: 0, night: 2, food: 1, adventure: 3, religious: 2 },
    // 0–3 per trip type; drives ranking when the visitor picks trip types (and kids > 0 adds 'family').
    // religious = ease for Shabbat-observant / kosher travelers (kosher food, Chabad, Shabbat logistics).
  poster: { sky: ['#F5C98B','#E9A26B'], sun: '#FFF0CF', land: '#9A4A2F', far: '#C98760', icon: 'colosseum', ink: '#3A1B10' }
}
```

Poster icons: `mesa` (flat plateau — Masada, crater rim), `eiffel, bigben, colosseum, sagrada, parthenon, castle, skyline, burj, temple, pagoda, palms, walls, city-sea, hills-lake`. Pick the closest silhouette. `palms`, `city-sea` and `hills-lake` add water. `pagoda` adds Mt Fuji. Set `poster.sea: true|false` to force water on or off for any icon.

### Other keys in data.js
- `origin`: departure airport (TLV), terminal arrival times, check-in and gate close minutes, and Israeli cities with car/train/taxi minutes to the airport (train 0 = no train). This feeds the airport planner.
- `holidays`: `{ date: 'YYYY-MM-DD', name }`. Marked on the calendar and used for the peak-season price bump. **Update the year range** when building a new site.
- `bookingSites`: the booking links shown in results and on destination pages. `id` must match a `case` in `siteUrl()` in app.js.

## js/media.js → `window.APP_MEDIA` and `window.APP_MEDIA_FEATURED`

```js
window.APP_MEDIA = {
  rome: {
    photos: [ ['Colosseum_in_rome.jpg', 'הקולוסיאום'], ... ],   // Commons file name (underscores), Hebrew caption; first = hero
    videos: [ ['4kqyR4jouuI', 'Rome: Rick Steves\' Travel Tips', 'Rick Steves\' Europe', 'en'], ... ]  // [id, title, channel or '', 'he'|'en']
  }
};
window.APP_MEDIA_FEATURED = [ ['rome', 0], ... ];  // home "travelers recommend" grid (6 is ideal)
```
Photos load from `https://commons.wikimedia.org/wiki/Special:FilePath/<file>?width=N`. If a photo fails, the SVG poster underneath stays visible.

## js/money.js → `window.APP_MONEY`

```js
{
  currencies: { EUR: { symbol: '€', notes: '€5, €10…', coins: '1 סנט עד €2' }, ... },
  byDest: { rome: { pay: 'טקסט', atm: 'טקסט', tax: 'טקסט', prices: [['קפה', 1.5], ['ארוחה עממית', 15], ...] } }
}
```
Prices are in local currency and are converted to ₪ with the live rate. Live rates come from Frankfurter (ECB). ECB has no AED, so AED is derived from USD at the 3.6725 peg. When adding a currency that ECB doesn't publish, extend `applyRates()` in app.js or rely on `currency.rate`.

## js/config.js → `window.APP_CONFIG`

```js
{
  brand: { name: 'מסע', title: 'מסע — ניהול חופשות' },
  agency: { name, whatsapp: '9725…', phone: '05…', email, license },
  partners: { bookingAid, travelpayoutsMarker, expediaAffcid, discoverCarsAid, getYourGuidePartner }
}
```

## js/sites.js → `window.APP_SITES`
`[{ cat: 'טיסות', items: [{ n: 'Skyscanner', u: 'https://…', d: 'תיאור', deep: 'skyscanner' }] }]`. `deep` (optional) names a `siteUrl()` case, so the link opens with the destination and dates filled in.

## js/israel.js → `window.APP_IL` (optional, Israel sites)
Powers two views: **#stays** (every hotel, zimmer, cabin, hostel, apartment and campsite in Israel, loaded live in the visitor's browser from the OpenStreetMap Overpass API, cached 7 days in localStorage, with the curated `hotels` of `region: 'il'` destinations always shown and used as fallback) and **#go** (point-to-point navigation: OSRM car route drawn on the map, Waze / Google / Moovit links, bus and rail lines).
```js
{
  regions: [['north', 'גליל, גולן ועמקים'], ...],          // region filter on #stays; a stay's region = region of its nearest place
  places: [{ id: 'tlv', name: 'תל אביב', c: [32.0853, 34.7818], r: 'center', rail: true, dest: 'telaviv' }],
       // rail = has an Israel Railways station; dest = destination id (adds "how to get here" on its transit tab)
  bus: [{ a: 'jlm', b: ['eingedi', 'masada'], lines: '486', op: 'אגד', from: 'terminal/platform', time: 'כ-2 ש׳', note: '' }],
       // verify every line via Moovit / operator search; lines are matched both ways and one-transfer routes are derived
  rail: [['tlv', 'jlm', 'כ-35 דק׳', 'note']],
  links: { moovit, egged, rail }
}
```
Live APIs (Overpass, OSRM, Wikidata photos) need a real browser on http(s) or file://; they are blocked inside Claude artifacts, where only the curated list and estimates appear.
