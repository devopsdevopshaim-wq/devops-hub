// Shir HaShirim as a film: the cast, the look, and one shot per verse (a long verse gets a second shot in the edit).
// Each prompt = camera + the cast that appears (always the same words, so they look the same in every clip) + the action + LOOK.
// Treatment: modest, faithful to how the song is read on Friday. Love is shown in looks, distance, longing and nature,
// never in touch beyond holding a hand; the descriptions of the body are filmed as the images they compare to (doves, goats, pomegranate, tower).

export const CAST = {
  S: 'the Shulamite, a young woman in her early twenties from the hills of ancient Judea, warm olive sun-tanned skin, dark brown eyes, long dark braided hair under a loose cream linen head scarf, a modest long-sleeved undyed linen dress with a red woven belt',
  D: 'her beloved, a young ancient Judean shepherd in his twenties, short dark curly hair and a short beard, warm olive skin, a modest off-white wool tunic and a brown striped cloak, a wooden staff',
  B: 'the daughters of Jerusalem, a group of young women in modest colorful linen robes and head scarves',
  W: 'the night watchmen of ancient Jerusalem in worn leather armor, carrying burning torches',
  K: 'King Solomon, a dignified man in his thirties with a dark beard, purple and gold royal robes and a gold crown',
  A: 'her two older brothers, young men in rough brown work tunics'
};

export const LOOK = 'Cinematic biblical epic, shot on 35mm anamorphic lenses, natural golden light, rich earthy colors, shallow depth of field, subtle film grain, ancient Land of Israel, historically authentic clothing and props, modest and respectful. Audio: natural ambient sound of the scene only, no dialogue, no music, no singing.';
export const NEGATIVE = 'text, subtitles, watermark, logo, modern objects, kissing, embracing, nudity, revealing clothing, blood, distorted faces, extra fingers';

// [camera, cast, action]
export const SHOTS = {
  1: [
    ['Slow aerial push-in at dawn', '', 'over the walls and stone houses of ancient Jerusalem on the hills, mist in the valleys, first sunlight on the stones'],
    ['Medium close-up, slow dolly-in', 'S', 'stands between vineyard rows at sunrise holding a clay cup of wine, gazing toward the far hills with longing'],
    ['Wide shot, gentle pan', 'B', 'gather at a stone well, one pours fragrant oil from an alabaster jar, they smile and breathe in the scent'],
    ['Tracking shot from behind', 'S', 'runs lightly along the vineyard rows toward a distant stone palace gate, her scarf flowing'],
    ['Medium shot, slow push-in', 'S', 'stands tall and proud in front of black goat-hair tents of Kedar, sunlight on her face, curtains of fine fabric moving in the wind behind her'],
    ['Wide shot, harsh noon light', 'S, A', 'she tends the vines alone under the burning sun, wiping her brow, while her brothers stand on the hill above pointing at the vineyard'],
    ['Wide shot across a valley', 'S', 'calls out across a wide valley at noon, shading her eyes, searching for the shepherd among distant flocks resting in the shade'],
    ['Low tracking shot', 'S', 'follows the tracks of sheep in the dust, leading a few young goats toward the shepherds’ tents'],
    ['Slow motion side tracking shot', '', 'a majestic white mare in ornamented royal harness gallops across a plain, dust glowing in the sun'],
    ['Close-up, soft golden light', 'S', 'a simple string of beads and braided hair frame her face as she turns toward the camera with a shy smile'],
    ['Macro shot', '', 'a goldsmith’s hands in an ancient workshop shape fine gold chains studded with small silver points'],
    ['Wide shot, evening', 'K', 'reclines at a royal banquet table lit by oil lamps, a servant opens a flask of spikenard and fragrant smoke drifts across the hall'],
    ['Close-up', 'S', 'holds a small linen pouch of myrrh to her heart, eyes closed'],
    ['Slow crane down', '', 'the oasis of Ein Gedi, a waterfall falls into a green pool among clusters of white henna blossoms'],
    ['Medium shot, rack focus', 'D', 'two white doves sit on a branch in the foreground, behind them he looks across the field with a warm smile'],
    ['Wide shot', 'S', 'sits on a lush green meadow under spreading trees, smiling, wildflowers moving in the breeze'],
    ['Slow tilt up', '', 'through the branches of cedar and cypress trees that form a natural roof against the bright sky']
  ],
  2: [
    ['Wide shot, morning', 'S', 'walks through a plain of the Sharon covered with wild lilies, trailing her hand over the flowers'],
    ['Macro shot', '', 'a single white lily blooming among sharp thorns, dew on its petals'],
    ['Medium shot', 'S', 'sits in the cool shade of an apple tree in a forest clearing, holding a ripe apple, sunbeams through the leaves'],
    ['Wide shot, warm interior', '', 'an ancient banquet hall with long woven banners fluttering above tables of food and wine'],
    ['Medium shot', 'S, B', 'she rests on cushions, faint with love, as the women bring her raisin cakes and apples'],
    ['Medium shot, soft light', 'S', 'rests her head on a folded brown striped shepherd’s cloak beneath a tree, peaceful, eyes closed'],
    ['Medium shot', 'S, B', 'she raises a finger to her lips asking quiet, gazelles and does graze in the field behind them'],
    ['Wide tracking shot', 'D', 'leaps and runs across rocky hills toward the camera, joyful'],
    ['Medium shot', 'D', 'a gazelle bounds past, then he is seen standing behind a stone wall, peering through a wooden lattice window'],
    ['Over-the-shoulder shot', 'S, D', 'from the courtyard he calls up, she appears at the lattice window and rises to go out'],
    ['Wide shot', '', 'the last winter rain clouds part over green hills, sunlight breaks through, the ground is wet and fresh'],
    ['Slow push-in', '', 'wildflowers burst open across a hillside, a turtledove sings on a branch'],
    ['Macro to wide', '', 'young green figs swell on a fig tree, vines in blossom sway, petals drift in the warm air'],
    ['Slow push-in on the rocks', 'S', 'a dove nests in the cleft of a cliff, then she looks out shyly from a hidden crevice in the rock'],
    ['Low tracking shot', '', 'several little red foxes dash between the rows of a blossoming vineyard'],
    ['Wide shot', 'D', 'grazes his flock among fields of lilies, leaning on his staff'],
    ['Wide shot, sunset', 'D', 'long evening shadows stretch over the hills as he turns and bounds away over the mountains like a young stag']
  ],
  3: [
    ['Medium shot, night', 'S', 'lies awake on a simple bed by the light of a small oil lamp, restless, searching in the dark'],
    ['Tracking shot, night', 'S', 'walks through the narrow stone streets and squares of ancient Jerusalem holding a small lamp'],
    ['Medium shot, night', 'S, W', 'the watchmen making their rounds stop her in a dark alley, she asks them anxiously'],
    ['Wide shot, first light', 'S, D', 'just past the watchmen she finds him at the end of an alley, takes his hand and leads him toward the doorway of her mother’s house'],
    ['Wide shot, dawn', 'B', 'stand in a dewy field at dawn as gazelles graze quietly around them'],
    ['Epic wide shot', '', 'a royal procession rises out of the desert at sunrise, columns of incense smoke of myrrh and frankincense rising into the air'],
    ['Wide shot', 'K', 'his ornate litter is carried forward surrounded by sixty mighty warriors'],
    ['Medium tracking shot, night', '', 'warriors with swords on their thighs guard the royal camp, torches flickering in the night wind'],
    ['Medium shot', '', 'craftsmen build an ornate palanquin from the wood of Lebanon cedar in a sunlit workshop'],
    ['Slow macro pan', '', 'silver pillars, a base of gold and a seat of royal purple fabric with fine inlaid work'],
    ['Wide shot, celebration', 'K, B', 'his mother places a gold crown on his head on his wedding day as the daughters of Zion come out rejoicing']
  ],
  4: [
    ['Epic wide shot', '', 'a flock of black goats streams down the slopes of Mount Gilead in the evening light'],
    ['Wide shot', '', 'freshly washed white ewes come up in pairs from a clear stream, water glistening on their wool'],
    ['Macro shot', '', 'a ripe pomegranate splits open revealing bright red seeds, beside a fine scarlet thread'],
    ['Low angle wide shot', '', 'an ancient stone tower of David hung with a thousand round bronze shields of mighty men'],
    ['Wide shot, soft light', '', 'two young twin gazelle fawns graze among the lilies'],
    ['Wide shot, dusk', '', 'a mountain covered with myrrh bushes and a hill of frankincense trees as the evening breeze rises'],
    ['Medium shot', 'S, D', 'she stands in golden light, serene and radiant, while he watches from a respectful distance in wonder'],
    ['Epic aerial', '', 'the snowy peaks of Lebanon and Mount Hermon, a lion on a rocky ledge and leopards on the mountainside'],
    ['Medium close-up', 'D', 'places his hand on his heart, overwhelmed, as he glimpses a single gold chain on her neck'],
    ['Close-up', '', 'deep red wine is poured into a goblet beside open jars of fragrant spices and oils'],
    ['Macro to wide', '', 'golden honey drips from a honeycomb, then the camera rises over a fragrant forest of Lebanon cedars'],
    ['Slow push-in', '', 'a walled garden behind a closed wooden gate, a spring with a stone seal over it'],
    ['Slow tracking shot', '', 'an orchard of pomegranate trees heavy with fruit among henna and spikenard plants'],
    ['Macro shots', '', 'saffron flowers, calamus reeds, cinnamon bark and aloes in a lush spice garden'],
    ['Wide shot', '', 'clear streams of living water flow down from the mountains of Lebanon into a garden spring'],
    ['Medium shot', 'S', 'the north wind and the south wind blow through the garden scattering spice petals as she opens the garden gate and smiles in welcome']
  ],
  5: [
    ['Wide shot, afternoon', 'D', 'enters the garden, gathers myrrh and spice, eats from a honeycomb and raises a cup of wine with his friends'],
    ['Medium shot, night', 'S', 'sleeps lightly by a dim oil lamp, she stirs as someone knocks softly on the wooden door'],
    ['Medium shot, night', 'S', 'sits up on the bed wrapped in a shawl, hesitating, looking at the door'],
    ['Close-up, night', '', 'a man’s hand reaches through the latch hole of an old wooden door'],
    ['Close-up, night', 'S', 'rises and reaches for the door bolt, her fingers dripping with liquid myrrh'],
    ['Wide shot, night', 'S', 'opens the door to an empty moonlit street, he is gone, she steps out calling silently'],
    ['Medium shot, night', 'S, W', 'the watchmen going around the city confront her roughly on the wall and pull the shawl from her shoulders'],
    ['Medium shot, dawn', 'S, B', 'pale and longing, she pleads with the women at dawn'],
    ['Medium shot', 'B', 'turn to one another with curious smiles, asking what makes her beloved different'],
    ['Wide shot, crowd', 'D', 'stands out radiant among a crowd of ten thousand people in a sunlit market square'],
    ['Close-up', 'D', 'sunlight on his black curly hair, glowing like fine gold, a raven flies past'],
    ['Slow motion', '', 'white doves bathe beside streams of water, droplets like milk in the light'],
    ['Slow tracking shot', '', 'raised beds of fragrant spices and lilies dripping with flowing myrrh'],
    ['Macro shot', '', 'gold rings set with deep blue stones and polished ivory inlaid with sapphires'],
    ['Low angle', '', 'pillars of white marble set on bases of fine gold, and tall cedars of Lebanon beyond'],
    ['Medium shot', 'S, B', 'she smiles proudly and points toward the hills as the women listen, delighted']
  ],
  6: [
    ['Medium shot', 'B', 'gathered around her, they ask where her beloved has gone, ready to help search'],
    ['Wide shot', 'D', 'walks down into his garden among beds of spices, gathering lilies'],
    ['Wide shot, golden hour', 'S, D', 'they stand at a modest distance among the lilies, looking at each other, his flock grazing around them'],
    ['Epic wide shot', '', 'the ancient city of Tirzah and Jerusalem shining on their hills, a host with banners on the plain below'],
    ['Medium close-up then wide', 'S', 'lowers her gaze shyly, then a flock of goats streams down Mount Gilead'],
    ['Wide shot', '', 'white ewes come up in pairs from the washing, glistening in the sun'],
    ['Macro shot', '', 'a pomegranate cut open, red seeds shining'],
    ['Wide shot', '', 'a royal court of noble women in rich modest robes in a grand hall of the palace'],
    ['Medium shot', 'S, B', 'she stands alone in a ray of light as the women and queens turn and praise her'],
    ['Wide shot on a hilltop', 'S', 'appears like the dawn, the pale moon and the rising sun behind her, a banner waving'],
    ['Slow push-in', '', 'a walnut grove in a green valley, young vines budding and pomegranate trees in blossom'],
    ['Wide tracking shot', '', 'royal chariots race across a plain at sunrise, dust glowing']
  ],
  7: [
    ['Wide shot', 'S, B', 'the women call to her as she turns in a joyful circle dance between two groups of dancers on a threshing floor'],
    ['Low close-up, slow motion', 'S', 'her sandaled feet dance lightly on the stone floor, the hem of her dress swirling'],
    ['Macro shot', '', 'a round goblet of mixed wine beside a heap of golden wheat ringed with lilies'],
    ['Wide shot, soft light', '', 'two young twin gazelle fawns among the flowers'],
    ['Epic wide shot', '', 'an ivory tower, still pools at the gate of the city of Heshbon, and a high tower of Lebanon facing Damascus'],
    ['Wide aerial shot', '', 'Mount Carmel above the sea, then a close-up of rich purple woven threads on a loom'],
    ['Close-up', 'S', 'laughs with pure joy in the late afternoon light'],
    ['Low angle slow tilt up', '', 'a tall, graceful date palm with heavy golden clusters against the sky'],
    ['Medium shot', 'D', 'climbs the trunk of a date palm and grasps its branches, apple trees in blossom nearby'],
    ['Slow motion', '', 'the finest red wine flows gently from a clay jug into a cup'],
    ['Wide shot', 'S, D', 'across a field she looks toward him and smiles, he returns her gaze'],
    ['Wide shot, morning', 'S, D', 'walk out side by side toward the open fields and the small villages in the distance'],
    ['Wide shot, dawn', 'S, D', 'rise early to the vineyards to see whether the vines have budded and the pomegranates are in bloom'],
    ['Macro to medium', 'S', 'mandrakes give their scent, at the door of the house she arranges baskets of choice fruits, new and old']
  ],
  8: [
    ['Medium shot', 'S', 'sits at the doorway of her house in thought, wishing he were close as family'],
    ['Wide shot', 'S, D', 'she leads him by the hand to her mother’s house and offers him spiced wine and pomegranate juice'],
    ['Medium shot, soft light', 'S', 'rests peacefully beneath a tree, a brown striped cloak beside her'],
    ['Wide shot, dawn', 'B', 'stand quietly at dawn in the dewy field as gazelles graze'],
    ['Wide shot', 'S, D', 'they come up from the desert together, she leans lightly on his arm, and they stop beneath an apple tree'],
    ['Macro shot', '', 'a stone signet seal pressed into warm red wax, then a strong steady flame of fire'],
    ['Epic wide shot', '', 'great waves crash against the rocks at dusk, a small oil lamp on a ledge keeps burning, never going out'],
    ['Medium shot', 'A', 'sit by the fire at home and talk about their little sister, looking toward her'],
    ['Wide shot', '', 'builders set silver battlements on an ancient city wall and fit a door with boards of cedar'],
    ['Wide shot', 'S', 'stands on top of a city wall, strong and at peace, the wind in her scarf'],
    ['Epic wide shot', '', 'a vast vineyard at Baal-hamon tended by keepers, a basket of silver coins'],
    ['Medium shot', 'S', 'tends her own vineyard with joy, picking grapes in the sun'],
    ['Medium shot', 'S, B', 'she sits in the garden as friends gather and listen to her voice'],
    ['Epic wide shot, sunrise', '', 'a gazelle leaps across mountains of spices toward the rising sun, the final image']
  ]
};

export function promptFor(chapter, i) {
  const [camera, cast, action] = SHOTS[chapter][i];
  const who = cast ? cast.split(/,\s*/).map((c) => CAST[c]) : [];
  const people = who.length ? (who.length === 1 ? `Subject: ${who[0]}. ` : `Characters: ${who.join('; ')}. `) : 'No people in the shot. ';
  return `${camera}. ${people}Action: ${action}. ${LOOK}`;
}
