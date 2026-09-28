# Researching a destination

The goal is data a customer can act on: call the hotel, walk to the kosher restaurant, watch the video. Everything specific must trace back to a search result you saw in this session.

## Hotels (3–4 per destination, mixed tiers)
1. Choose well-known properties you're confident exist: a luxury icon, one or two mid-range boutique or chain hotels, and a hostel or budget option.
2. For each one: `WebSearch "<hotel name> <city> address phone"`. The result summary usually states the address and phone. Official sites, Yelp and hotelplanner are reliable.
3. Record `addr` in local format, `phone` as `+<country code> <number>`, and `web` as the official site if one appears.
4. If a result says **closed** or **permanently closed**, or sources conflict about whether it's open, replace the hotel.
5. `price` is an estimated ₪ per night for a double room. Luxury in European capitals runs about ₪3,000–7,000, mid about ₪800–1,500, budget ₪250–500.

## Zimmers, cabins and guest farms (Israel)
Search named properties: "<name> <area> phone", for example kibbutz resort villages, guest farms and desert lodges. Generic "zimmers in the Golan" rows are not allowed; every stay must be a named, verifiable place. Set `kind` (zimmer / cabins / farm / kibbutz / lodge) and `tags` only from what the source says (hot tub, adults only, family).

## Attractions and nightlife (`fun`)
4–6 per destination: a family attraction, a nature site, a museum or culture spot, a water or spa option, and an evening area. Verify the phone and address for each. Add opening and Shabbat notes when the source states them (for example "closed on Shabbat" or "only part of the trails open after flood damage"). A nightlife *area* may appear without a phone.

## Restaurants
- **Kosher:** search "<city> kosher restaurant address phone", Chabad house listings, and the city's Jewish quarter. Verify each named place individually. Prefer 2–3 named places plus the area with the highest concentration. Always keep the note that kashrut status changes.
- **Michelin:** list 2–3 well-known starred restaurants with star counts. Stars change yearly; the site says so. Look up contact details for at least the top one.
- **Israel:** there is no Michelin guide; `michelin: []` shows "chef restaurants" from `food`.

## Photos (Wikimedia Commons)
- `WebSearch "<landmark> <city> site:commons.wikimedia.org File jpg"` with `allowed_domains: ["commons.wikimedia.org"]`.
- Take the file name from a result URL `https://commons.wikimedia.org/wiki/File:<NAME>`. Decode `%C3%BC` and similar to real characters, and keep the underscores.
- Prefer files described as "Featured picture" or "Quality image", landscape orientation, and recent. Avoid maps, historical engravings, crops of people and portrait-orientation files for the hero.
- 3 per destination: an iconic landmark first (used as the hero), then variety (a street, the sea, night).

## Videos (YouTube)
- `WebSearch "<city> travel guide"`, "first time in <city>" or "<city> Rick Steves" with `allowed_domains: ["youtube.com"]`. For Hebrew, search in Hebrew, for example "טיול ל<עיר> המלצות".
- The ID is the `v=` value (11 characters). Skip shorts, live streams, playlists and results marked CLOSED or removed.
- Fill in the channel name only when the title or result shows it (for example "Rick Steves' Europe"); otherwise use `''`.
- 3 per destination, with at least one Hebrew video where one exists.

## Money
Know-how rather than lookups: notes and coins, card vs cash culture, ATM traps (Euronet, DCC), tourist VAT refunds and their thresholds, and 4 typical prices in local currency. Search to confirm anything recent, such as tax-refund rule changes.

## Airport and transit
Name the main airport and 2–3 transfer options with time and cost, noting a secondary low-cost airport if one exists. For transit, give the system, the card, and single and day fares. Round fares and mark them "בערך".

## Citations
Collect the source URLs as you go. The final message to the user must list the main sources.
