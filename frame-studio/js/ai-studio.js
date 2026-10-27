/* The AI panel (the "סגנונות" tab): real image AI on the hubs server (Gemini, then FLUX on Cloudflare) that redraws the
   photo and keeps the people. A combination builder (style × world × costume × atmosphere, or 🎲 a surprise), ready
   combinations, single styles and free text. Every run can be stopped in the middle (⏹ on the busy sign). */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$;
  var KEEP = FS.AI_KEEP || '';
  /* for the viral ideas the scene, framing (and in two of them the age) change on purpose: only the people stay recognisable */
  var KEEP_FREE = ' IMPORTANT: these are real people from an event. Keep every person clearly recognisable to their family (same face features, skin tone, hair and expression) and keep the same number of people. No text, no letters, no watermark. Highly detailed, professional quality.';

  /* [id, Hebrew name, icon, what it adds to the prompt] */
  var STYLE = [
    ['photo', 'צילום אמיתי', '📷', 'Keep it a realistic, high-end photograph with natural skin and real lighting'],
    ['3d', 'סרט אנימציה תלת־ממד', '🧸', 'Render it as a still from a modern 3D animated family movie, soft cinematic light, expressive eyes, smooth stylized characters'],
    ['anime', 'אנימה', '🌸', 'Draw it as a beautiful Japanese anime illustration with clean line art and cel shading'],
    ['ghibli', 'אנימה מצוירת ביד', '🍃', 'Paint it as a hand-painted Japanese animated film frame, soft watercolour backgrounds, warm nostalgic light'],
    ['comic', 'קומיקס', '💥', 'Draw it as a vintage American comic book panel with bold ink outlines, halftone dots and vivid flat colours'],
    ['cartoon', 'מצויר מהטלוויזיה', '📺', 'Draw it as a colourful 2D TV cartoon with simple bold shapes and thick outlines'],
    ['clay', 'פלסטלינה', '🧱', 'Make it a claymation stop-motion scene, characters of modelling clay with fingerprint texture, miniature set'],
    ['bricks', 'לבני צעצוע', '🟥', 'Build the whole scene from colourful plastic toy bricks with minifigure-style people'],
    ['plush', 'בובות פרווה', '🧸', 'Make everyone soft plush toys with fabric and stitching'],
    ['oil', 'ציור שמן', '🖼️', 'Paint it as a classical oil painting with visible brush strokes and rich museum lighting'],
    ['water', 'צבעי מים', '💧', 'Paint it as a delicate watercolour on textured paper with soft washes'],
    ['pixel', 'משחק וידאו רטרו', '👾', 'Draw it as colourful 16-bit pixel art from a retro video game'],
    ['game', 'עטיפת משחק מחשב', '🎮', 'Make it a dramatic open-world video game cover illustration with painterly realism'],
    ['pop', 'פופ־ארט', '🟨', 'Make it bold pop art with flat bright colours, thick outlines and Ben-Day dots'],
    ['neon', 'ניאון', '💡', 'Make it glowing neon line art on a dark background, vivid electric colours'],
    ['paper', 'גזרי נייר', '✂️', 'Make it a layered paper-cut craft diorama with soft shadows between the paper layers'],
    ['lowpoly', 'לואו־פולי', '🔷', 'Make it a low-poly 3D render made of flat-shaded triangles'],
    ['statue', 'פסל שיש', '🏛️', 'Turn everyone into polished white marble statues, museum lighting'],
    ['gold', 'פסל זהב', '🏆', 'Turn everyone into shiny gold statues on a marble plinth'],
    ['chibi', 'סטיקר צ׳יבי', '🍡', 'Draw everyone as cute chibi characters with big heads, as a die-cut sticker with a white border'],
    ['caric', 'קריקטורה', '😜', 'Draw it as a friendly, funny caricature with exaggerated but kind features'],
    ['sketch', 'רישום עיפרון', '✏️', 'Draw it as a realistic graphite pencil drawing with fine shading'],
    ['1920', 'צילום מ־1920', '🎞️', 'Make it an authentic 1920s sepia photograph with film grain and an aged border'],
    ['80s', 'שנות ה־80', '📼', 'Make it an authentic 1980s photo with film colours and retro flash'],
    ['ukiyoe', 'הדפס יפני', '🌊', 'Make it a traditional Japanese ukiyo-e woodblock print'],
    ['glass', 'ויטראז׳', '⛪', 'Make it a glowing stained-glass window with lead lines and jewel colours'],
    ['magazine', 'שער מגזין אופנה', '📰', 'Make it a glossy high-fashion magazine cover photo, studio lighting, editorial retouching, elegant poses (no text)'],
    ['cinema', 'פריים מסרט הוליוודי', '🎞️', 'Make it a still from a big-budget Hollywood movie, anamorphic cinematic light, teal and orange colour grade, shallow depth of field'],
    ['noir', 'קולנוע נואר', '🕵️', 'Make it a 1940s film-noir photograph, dramatic black and white, hard shadows from window blinds, smoky mood'],
    ['polaroid', 'פולארויד וינטג׳', '📸', 'Make it a faded vintage instant-film photograph with soft warm colours, light leaks and gentle grain'],
    ['renaissance', 'ציור רנסנס', '🖼️', 'Paint it as a Renaissance master oil painting, rich chiaroscuro, classical composition, fine cracked varnish'],
    ['impression', 'אימפרסיוניזם', '🌻', 'Paint it in the style of French impressionism, loose visible brush strokes, dappled sunlight, soft pastel colours'],
    ['charcoal', 'פחם על נייר', '✏️', 'Draw it as an expressive charcoal drawing on textured paper, deep blacks and soft smudged shading'],
    ['mosaic', 'פסיפס רומי', '🧩', 'Make it an ancient Roman floor mosaic of small stone tiles with natural earthy colours'],
    ['origami', 'אוריגמי', '🦢', 'Make everything look folded from origami paper, crisp folds, soft studio light, paper texture'],
    ['knit', 'סרוג ביד', '🧶', 'Make everything look hand-knitted from soft wool yarn, cosy stitches, warm light'],
    ['cyber', 'סייברפאנק', '🌆', 'Make it a cyberpunk scene, neon pink and cyan light, rain-soaked reflections, futuristic details'],
    ['fantasy', 'פנטזיה אפית', '🐉', 'Paint it as epic fantasy book-cover art, dramatic light, rich detail, heroic atmosphere'],
    ['wedding', 'צילום חתונה יוקרתי', '💍', 'Make it a luxury fine-art wedding photograph, soft romantic light, creamy bokeh, elegant and timeless'],
    ['bw', 'שחור־לבן אמנותי', '⚫', 'Make it a fine-art black and white portrait photograph with rich tones and soft contrast']
  ];
  var WORLD = [
    ['', 'בלי שינוי רקע', '🖼️', ''],
    ['beach', 'חוף טרופי', '🏝️', 'a sunny tropical beach with turquoise water and palm trees'],
    ['snow', 'חורף מושלג', '❄️', 'a snowy winter wonderland with falling snow and warm lights'],
    ['space', 'החלל', '🚀', 'outer space with Earth, stars and a nebula behind them'],
    ['moon', 'על הירח', '🌕', 'the surface of the Moon with Earth rising in the black sky'],
    ['sea', 'מתחת למים', '🐠', 'an underwater coral reef with tropical fish and sun rays'],
    ['forest', 'יער קסום', '🧚', 'an enchanted glowing forest with fireflies and giant mushrooms'],
    ['castle', 'טירה מימי הביניים', '🏰', 'a grand medieval castle courtyard'],
    ['paris', 'פריז בלילה', '🗼', 'Paris at night with the Eiffel Tower sparkling behind them'],
    ['nyc', 'ניו יורק', '🗽', 'Times Square in New York at night with bright billboards'],
    ['tokyo', 'טוקיו בניאון', '🏮', 'a rainy neon-lit Tokyo street at night'],
    ['venice', 'ונציה', '🛶', 'a gondola on a Venice canal at sunset'],
    ['santorini', 'סנטוריני', '🇬🇷', 'the white and blue houses of Santorini above the sea'],
    ['egypt', 'מצרים העתיקה', '🐫', 'ancient Egypt with the pyramids and the Sphinx'],
    ['jerusalem', 'ירושלים העתיקה', '🕍', 'the Old City of Jerusalem in golden evening light'],
    ['west', 'עיירה במערב הפרוע', '🤠', 'a wild-west desert town at sunset'],
    ['dino', 'ג׳ונגל עם דינוזאורים', '🦖', 'a prehistoric jungle with friendly dinosaurs around them'],
    ['safari', 'ספארי באפריקה', '🦒', 'an African safari with giraffes and elephants at golden hour'],
    ['candy', 'ארץ הממתקים', '🍭', 'a whimsical candy land made of sweets, lollipops and chocolate rivers'],
    ['magic', 'בית ספר לקוסמים', '🪄', 'the great hall of a magic school with floating candles'],
    ['future', 'עיר עתידנית', '🌆', 'a futuristic city with flying cars and glass towers'],
    ['redcarpet', 'השטיח האדום', '🎬', 'a Hollywood red carpet premiere with flashing cameras'],
    ['stage', 'במה של הופעה', '🎤', 'a huge concert stage with lights and a cheering crowd'],
    ['clouds', 'בין העננים', '☁️', 'soft pastel clouds high in the sky at sunrise'],
    ['ice', 'ארמון קרח', '🧊', 'a sparkling ice palace'],
    ['jungle', 'ג׳ונגל טרופי', '🌴', 'a lush rainforest with a waterfall'],
    ['maldives', 'וילה במלדיביים', '🌴', 'an overwater villa in the Maldives with crystal lagoon and sunset sky'],
    ['london', 'לונדון', '💂', 'a London street with red buses, Big Ben and soft drizzle'],
    ['rome', 'רומא', '🏛️', 'the Colosseum and old Roman streets in warm afternoon light'],
    ['dubai', 'דובאי', '🏙️', 'the Dubai skyline at dusk with glittering skyscrapers'],
    ['northern', 'זוהר צפוני', '🌌', 'a snowy landscape under bright green northern lights'],
    ['desert', 'מדבר וגמלים', '🐫', 'golden desert dunes with camels at sunset'],
    ['garden', 'גן פרחים', '🌷', 'a blooming flower garden full of roses and tulips'],
    ['library', 'ספרייה קסומה', '📚', 'a grand old library with towering bookshelves and warm lamps'],
    ['circus', 'קרקס', '🎪', 'a colourful vintage circus tent with lights and performers'],
    ['ballroom', 'אולם נשפים', '🕯️', 'a grand palace ballroom with crystal chandeliers and golden walls'],
    ['underwater', 'עיר אטלנטיס', '🐚', 'the sunken city of Atlantis with glowing coral and fish'],
    ['mountains', 'פסגת הרים', '🏔️', 'a dramatic mountain peak above the clouds at sunrise']
  ];
  var OUTFIT = [
    ['', 'הבגדים שלהם', '👕', ''],
    ['hero', 'גיבורי על', '🦸', 'colourful superhero suits with capes and emblems'],
    ['royal', 'מלכים ומלכות', '👑', 'royal robes and crowns'],
    ['astro', 'אסטרונאוטים', '👩‍🚀', 'astronaut space suits'],
    ['pirate', 'פיראטים', '🏴‍☠️', 'pirate outfits with hats and sashes'],
    ['wizard', 'קוסמים', '🧙', 'wizard robes and pointy hats'],
    ['knight', 'אבירים', '🛡️', 'shining knight armour'],
    ['cowboy', 'קאובויים', '🤠', 'cowboy hats, vests and boots'],
    ['ninja', 'נינג׳ות', '🥷', 'ninja outfits'],
    ['gala', 'ערב גאלה', '🤵', 'elegant black-tie gala outfits: tuxedos and ball gowns'],
    ['gatsby', 'שנות ה־20', '🎩', 'glamorous 1920s outfits with feathers, pearls and bow ties'],
    ['rock', 'כוכבי רוק', '🎸', 'rock-star outfits with leather jackets'],
    ['viking', 'ויקינגים', '🪓', 'viking furs and helmets'],
    ['roman', 'רומאים', '🏛️', 'ancient Roman togas and laurel wreaths'],
    ['samurai', 'סמוראים', '⚔️', 'samurai armour and kimonos'],
    ['steampunk', 'סטימפאנק', '⚙️', 'steampunk outfits with goggles and brass gears'],
    ['hawaii', 'הוואי', '🌺', 'Hawaiian shirts and flower leis'],
    ['chef', 'שפים', '👨‍🍳', 'chef jackets and tall white hats'],
    ['sport', 'נבחרת ספורט', '⚽', 'matching sports team jerseys'],
    ['animals', 'חיות', '🦁', 'cute animal versions of themselves (a fitting animal for each), same clothes'],
    ['angels', 'מלאכים', '🕊️', 'soft white angel wings and glowing halos'],
    ['wedding', 'חתן וכלה', '👰', 'elegant wedding dress and tailored groom suit'],
    ['princess', 'נסיכות ונסיכים', '👸', 'fairy-tale princess gowns and prince outfits with crowns'],
    ['spy', 'סוכנים חשאיים', '🕶️', 'sleek black spy suits and sunglasses'],
    ['fairy', 'פיות', '🧚', 'sparkling fairy outfits with delicate translucent wings'],
    ['80sfit', 'שנות ה־80', '📼', 'colourful 1980s outfits, neon windbreakers and big hair'],
    ['retro50', 'שנות ה־50', '🎙️', '1950s rock-and-roll outfits, polka dots and leather jackets'],
    ['dancers', 'רקדנים', '💃', 'glamorous ballroom dance costumes'],
    ['doctors', 'רופאים', '🩺', 'doctors in white coats and scrubs']
  ];
  var MOOD = [
    ['', 'רגיל', '✨', ''],
    ['golden', 'שעת זהב', '🌅', 'warm golden-hour sunlight'],
    ['fireworks', 'זיקוקים', '🎆', 'colourful fireworks in the sky'],
    ['confetti', 'קונפטי', '🎉', 'confetti and streamers falling'],
    ['sparkle', 'נצנוצי קסם', '✨', 'magical sparkles and glowing particles'],
    ['petals', 'עלי ורדים', '🌹', 'rose petals floating in the air'],
    ['balloons', 'בלונים', '🎈', 'colourful balloons around them'],
    ['snowfall', 'שלג יורד', '🌨️', 'gentle snowfall'],
    ['rainbow', 'קשת', '🌈', 'a bright rainbow'],
    ['lanterns', 'פנסים מרחפים', '🏮', 'glowing floating lanterns'],
    ['cherry', 'פריחת דובדבן', '🌸', 'cherry blossoms'],
    ['storm', 'סערה דרמטית', '⚡', 'a dramatic stormy sky with lightning'],
    ['spot', 'זרקורים ועשן', '🔦', 'stage spotlights and soft smoke'],
    ['bokeh', 'אורות מטושטשים', '✨', 'soft dreamy bokeh lights in the background'],
    ['candle', 'אור נרות', '🕯️', 'warm intimate candlelight'],
    ['moonlight', 'אור ירח', '🌙', 'cool silver moonlight and a starry sky'],
    ['butterflies', 'פרפרים', '🦋', 'colourful butterflies fluttering around'],
    ['bubbles', 'בועות סבון', '🫧', 'floating iridescent soap bubbles'],
    ['hearts', 'לבבות', '💖', 'little floating hearts and a romantic glow']
  ];
  /* ready combinations: style, world, outfit, mood */
  var COMBOS = [
    ['גיבורי על בניו יורק', '🦸', '3d', 'nyc', 'hero', 'fireworks'],
    ['אסטרונאוטים על הירח', '🌕', 'photo', 'moon', 'astro', ''],
    ['מלכים בטירה', '👑', 'oil', 'castle', 'royal', 'golden'],
    ['פיראטים בחוף', '🏴‍☠️', '3d', 'beach', 'pirate', 'golden'],
    ['קוסמים בבית הספר לקסם', '🪄', 'photo', 'magic', 'wizard', 'sparkle'],
    ['אנימה בטוקיו', '🏮', 'anime', 'tokyo', '', 'lanterns'],
    ['ערב גאלה בשטיח האדום', '🎬', 'photo', 'redcarpet', 'gala', 'spot'],
    ['שנות ה־20 בפריז', '🗼', '1920', 'paris', 'gatsby', ''],
    ['כוכבי רוק על הבמה', '🎸', 'photo', 'stage', 'rock', 'spot'],
    ['ספארי עם חיות', '🦒', 'ghibli', 'safari', 'animals', 'golden'],
    ['דינוזאורים בג׳ונגל', '🦖', '3d', 'dino', '', ''],
    ['אבירים מצוירים', '🛡️', 'comic', 'castle', 'knight', 'storm'],
    ['קאובויים במערב', '🤠', 'photo', 'west', 'cowboy', 'golden'],
    ['ארץ הממתקים', '🍭', '3d', 'candy', '', 'confetti'],
    ['מתחת למים', '🐠', 'ghibli', 'sea', '', 'sparkle'],
    ['ויקינגים בשלג', '🪓', 'photo', 'snow', 'viking', 'snowfall'],
    ['סמוראים ביפן', '⚔️', 'ukiyoe', 'tokyo', 'samurai', 'cherry'],
    ['מלאכים בעננים', '🕊️', 'oil', 'clouds', 'angels', 'golden'],
    ['עתידנים בעיר העתיד', '🌆', 'game', 'future', 'steampunk', ''],
    ['לבני צעצוע בחלל', '🟥', 'bricks', 'space', 'astro', ''],
    ['פלסטלינה בהוואי', '🌺', 'clay', 'beach', 'hawaii', ''],
    ['פסלי זהב במצרים', '🏆', 'gold', 'egypt', 'roman', 'golden'],
    ['ונציה רומנטית', '🛶', 'water', 'venice', 'gala', 'golden'],
    ['ירושלים של זהב', '🕍', 'photo', 'jerusalem', '', 'golden'],
    ['סנטוריני בקיץ', '🇬🇷', 'photo', 'santorini', '', 'golden'],
    ['ארמון הקרח', '🧊', '3d', 'ice', 'royal', 'snowfall'],
    ['משחק וידאו רטרו', '👾', 'pixel', 'forest', 'knight', ''],
    ['בובות פרווה ביער', '🧸', 'plush', 'forest', 'animals', 'sparkle'],
    ['נבחרת על הבמה', '⚽', 'photo', 'stage', 'sport', 'confetti'],
    ['שפים בפריז', '👨‍🍳', 'cartoon', 'paris', 'chef', ''],
    ['שער מגזין אופנה', '📰', 'magazine', '', 'gala', 'spot'],
    ['סרט הוליוודי', '🎞️', 'cinema', 'nyc', 'spy', ''],
    ['חתונה במלדיביים', '💍', 'wedding', 'maldives', 'wedding', 'golden'],
    ['נשף בארמון', '🕯️', 'renaissance', 'ballroom', 'princess', 'candle'],
    ['פיות בגן הפרחים', '🧚', 'ghibli', 'garden', 'fairy', 'butterflies'],
    ['זוהר צפוני', '🌌', 'photo', 'northern', '', 'moonlight'],
    ['סייברפאנק בטוקיו', '🌆', 'cyber', 'tokyo', '', ''],
    ['נואר בלונדון', '🕵️', 'noir', 'london', 'spy', ''],
    ['פולארויד בחוף', '📸', 'polaroid', 'beach', '', 'golden'],
    ['אימפרסיוניזם בפריז', '🌻', 'impression', 'paris', '', 'petals'],
    ['רומאים ברומא', '🏛️', 'photo', 'rome', 'roman', 'golden'],
    ['קרקס וינטג׳', '🎪', 'polaroid', 'circus', 'retro50', 'balloons'],
    ['דרקונים ופנטזיה', '🐉', 'fantasy', 'mountains', 'knight', 'storm'],
    ['אוריגמי קסום', '🦢', 'origami', 'garden', '', 'butterflies'],
    ['סרוג ביד בחורף', '🧶', 'knit', 'snow', '', 'snowfall'],
    ['דובאי בלילה', '🏙️', 'cinema', 'dubai', 'gala', 'bokeh'],
    ['שנות ה־80 בניאון', '📼', '80s', 'future', '80sfit', ''],
    ['פסיפס רומי', '🧩', 'mosaic', 'rome', 'roman', ''],
    ['אטלנטיס', '🐚', '3d', 'underwater', 'princess', 'bubbles'],
    ['ספרייה קסומה', '📚', 'ghibli', 'library', 'wizard', 'candle'],
    ['שחור־לבן אמנותי', '⚫', 'bw', '', '', ''],
    ['רקדנים על הבמה', '💃', 'cinema', 'stage', 'dancers', 'spot'],
    ['מדבר וגמלים', '🐫', 'photo', 'desert', '', 'golden'],
    ['רישום פחם', '✏️', 'charcoal', '', '', '']
  ];
  /* the viral ones: whole ideas, not style + place. Each is a complete instruction (the people's faces are kept by KEEP). */
  var VIRAL = [
    ['בובת אקשן בקופסה', '🧸', 'Turn each person into a collectible action figure sealed in a retail blister pack: glossy plastic figure with visible joints, cardboard backing card with bold colourful graphics, a few tiny accessories that match the event in their own plastic slots, shot on a clean studio background with soft reflections'],
    ['בובת ויניל אספנית', '🎁', 'Turn the people into cute collectible vinyl figures with big heads and simple dot eyes, standing in front of their open window-box packaging, studio product shot'],
    ['דמויות לגו', '🧱', 'Rebuild the whole scene from toy bricks, the people as toy-brick minifigures with their hairstyles and outfits, crisp plastic shine, tilt-shift macro photo'],
    ['כדור שלג', '🔮', 'Place the people as tiny figurines inside a glass snow globe on a wooden base, swirling snowflakes inside, warm bokeh lights around, macro photo'],
    ['עולם מיניאטורה', '🏘️', 'Make it a miniature diorama: tiny hand-painted figurines of the people in a detailed model set, tilt-shift macro photography, shallow depth of field'],
    ['כרזת סרט', '🎬', 'Make it a dramatic Hollywood blockbuster movie poster: cinematic lighting, epic sky, the people as the heroes posed in front, lens flare, rich colour grade (leave space at the top, no text)'],
    ['קלף אספנים', '🃏', 'Make it a rare holographic trading card: the people framed in an ornate shiny foil card border with sparkles and a glossy finish, flat front view'],
    ['בובות ראש מתנדנד', '🏆', 'Turn the people into bobblehead dolls with oversized heads on small bodies, standing on a desk, playful product photo'],
    ['פלסטלינה סטופ־מושן', '🎞️', 'Make it a stop-motion claymation scene: everything sculpted from plasticine with visible fingerprints and handmade texture, warm studio light'],
    ['שלט ניאון', '💡', 'Turn the people into a glowing neon-tube sign artwork on a dark brick wall, bright pink and blue neon lines tracing their outlines, soft glow'],
    ['פסל קרח', '🧊', 'Turn the people into a crystal-clear ice sculpture glowing with blue light, frosty details, at a luxury winter gala'],
    ['פסל בלונים', '🎈', 'Recreate the people as a sculpture made of shiny twisted party balloons in bright colours, on a festive background'],
    ['מדבקות', '🏷️', 'Turn the people into a sheet of cute die-cut vinyl stickers with thick white borders, several fun poses and little party icons around them, flat lay'],
    ['רקמה', '🧵', 'Make it an embroidered patch: the people stitched in colourful thread on fabric, satin stitches and a stitched border'],
    ['ציור קיר גרפיטי', '🎨', 'Paint the people as a huge colourful street-art mural on a city wall, spray-paint texture, drips and bold shapes, a ladder and paint cans beside it'],
    ['שער מגזין טיים', '📰', 'Make it a prestigious news-magazine cover portrait: bold red frame border, dramatic studio portrait lighting, serious editorial look (no text)'],
    ['פוסטר וינטג׳ ממסע', '🗺️', 'Make it a 1950s vintage travel poster: flat screen-printed colours, bold simple shapes, retro paper texture, the people as stylized poster figures'],
    ['תמונת תינוקות', '👶', 'Show the same people as cute toddlers of about three years old, keeping each one recognisable, same clothes colours and the same scene, soft natural light'],
    ['בעוד 50 שנה', '👴', 'Show the same people aged about eighty, naturally and warmly, keeping each one recognisable, same pose and scene, gentle portrait light'],
    ['כרטיס ברכה אנימציה', '💌', 'Make it a heart-warming 3D animated-movie greeting card scene, soft pastel colours, sparkles and floating hearts around the people'],
    ['אריזת קורנפלקס', '🥣', 'Put the people on the front of a colourful retro breakfast-cereal box as the cheerful cartoon mascots, studio product shot of the box'],
    ['בובות סרוגות', '🧶', 'Turn the people into adorable hand-crocheted amigurumi dolls with yarn texture, sitting together on a cosy knitted blanket']
  ];
  function find(list, id) { return list.filter(function (x) { return x[0] === id; })[0] || list[0]; }
  function promptOf(c) {
    var st = find(STYLE, c.style), w = find(WORLD, c.world), o = find(OUTFIT, c.outfit), m = find(MOOD, c.mood), parts = ['Transform this photo of real people. The same people stay the main subjects, as large in the frame and in the same poses and places as in the photo; only the look around them changes.'];
    parts.push(st[3] + '.');
    if (w[3]) parts.push('Move the people into ' + w[3] + ', with matching natural lighting on them.');
    if (o[3]) parts.push('Dress every person in ' + o[3] + '.');
    if (m[3]) parts.push('Add ' + m[3] + '.');
    return parts.join(' ') + KEEP;
  }
  function nameOf(c) { return [find(STYLE, c.style), find(WORLD, c.world), find(OUTFIT, c.outfit), find(MOOD, c.mood)].filter(function (x, i) { return i === 0 || x[0]; }).map(function (x) { return x[1]; }).join(' · '); }

  /* run one prompt on the photos, one at a time; ⏹ stops the run (the photos done so far keep their result) */
  /* a design that needs the internet, without the internet (and no local engine): offer the built-in designs right away */
  var noNet = false;
  function localReady() { return !!(FS.localAI && FS.localAI.isReady && FS.localAI.isReady()); }
  FS.offlineChooser = function (label) {
    var body = FS.dialog('📴 אין חיבור לאינטרנט', '<p>' + (label ? 'העיצוב "<b>' + FS.esc(label) + '</b>" ' : 'העיצוב הזה ') + 'נוצר במודל AI גדול, בשרת' + (FS.localAI ? ' או במנוע ה־AI המקומי שעל המחשב.</p><p>עם המנוע המקומי <b>כל</b> עיצובי ה־AI עובדים בלי אינטרנט. מתקינים אותו פעם אחת כשיש אינטרנט (כ־5.5GB).</p><button class="btn primary wide" id="oc-la">📥 מנוע ה־AI המקומי</button>' : ', ולכן צריך אינטרנט.</p>') +
      '<p><b>בינתיים, אלה עובדים עכשיו על המחשב:</b></p><div class="ai-styles" id="oc-list"></div>', true);
    var la = $('#oc-la', body); if (la) la.addEventListener('click', function () { FS.closeDialog(); if (FS.localAI && FS.localAI.open) FS.localAI.open(); });
    (FS.OFFLINE_AI || []).forEach(function (o) { var b = document.createElement('button'); b.className = 'ai-style off'; b.innerHTML = '<i>' + o[2] + '</i><span>' + FS.esc(o[1]) + '</span>'; b.addEventListener('click', function () { FS.closeDialog(); runOffline(o[0], o[1]); }); $('#oc-list', body).appendChild(b); });
  };
  function variantsOn() { try { return localStorage.getItem('fs-ai-variants') === '1'; } catch (e) { return false; } }
  /* "3 versions": the same design from up to three engines at once; the person picks the one they like */
  function runVariants(p, prompt, label) {
    return FS.aiEngines().then(function (av) {
      var order = ['gemini', 'flux', 'free', 'openai'].filter(function (k) { return av[k]; }).slice(0, 3);
      if (order.length < 2) return FS.restyle(p, prompt).then(function () { FS.emit('doc'); FS.refreshStrip && FS.refreshStrip(); FS.toast('✨ ' + label + ' (רק מנוע אחד פעיל בשרת, אז גרסה אחת)'); });
      var stop = false, got = 0;
      function msg() { FS.busy('🎯 ' + label + ' · ' + order.length + ' גרסאות ממנועים שונים · ' + got + ' מוכנות (עד דקה)', function () { stop = true; FS.aiStop && FS.aiStop(); }); }
      msg();
      return FS.findFaces(p, true).catch(function () {}).then(function () {
        return Promise.all(order.map(function (k) { return FS.restyleTry(p, prompt, k).then(function (im) { got++; if (!stop) msg(); return { k: k, im: im }; }, function (e) { return { k: k, err: e }; }); }));
      }).then(function (rs) {
        FS.busy(); if (stop) return FS.toast('⏹ נעצר. התמונה לא השתנתה.');
        var ok = rs.filter(function (r) { return r.im; });
        if (!ok.length) { var e = rs[0] && rs[0].err; return FS.toast(FS.aiError(String(e && e.message || 'ai-failed')), 8000); }
        var body = FS.dialog('🎯 ' + FS.esc(label) + ' · בוחרים גרסה', '<p class="hint">כל גרסה נוצרה במנוע AI אחר. לוחצים על היפה ביותר והיא נכנסת לתמונה.</p><div class="ai-vars" id="ai-vars"></div>' +
          (ok.length < rs.length ? '<p class="hint">' + rs.filter(function (r) { return !r.im; }).map(function (r) { return FS.ENGINE_NAMES[r.k] + ': ' + FS.aiError(String(r.err && r.err.message || '')); }).join('<br>') + '</p>' : ''), true);
        ok.forEach(function (r) {
          var b = document.createElement('button'); b.className = 'ai-var'; b.type = 'button';
          b.innerHTML = '<img alt="" src="' + r.im.src + '"><b>' + FS.esc(FS.ENGINE_NAMES[r.k] || r.k) + '</b>';
          b.addEventListener('click', function () { FS.closeDialog(); FS.applyAI(p, r.im); FS.emit('doc'); FS.refreshStrip && FS.refreshStrip(); FS.toast('✨ ' + label + ' · ' + (FS.ENGINE_NAMES[r.k] || r.k) + '. "↶ ביטול העיצוב האחרון" מחזיר.', 4500); });
          $('#ai-vars', body).appendChild(b);
        });
      });
    });
  }
  FS.runAI = function (prompt, label, list) {
    list = list || FS.targets(); if (!list.length) return FS.toast('בוחרים תמונה קודם');
    if ((navigator.onLine === false || noNet) && !localReady()) return FS.offlineChooser(label);
    if (variantsOn() && list.length === 1 && navigator.onLine !== false) return runVariants(list[0], prompt, label);
    var done = 0, stop = false, failed = null, next = 0;
    function onStop() { stop = true; FS.aiStop && FS.aiStop(); }
    /* several photos at once (the server answers each on its own), so an event's batch takes the time of a few photos, not of all;
       the engine on this computer runs one picture at a time */
    var local = FS.aiEngine() === 'local' || (FS.localAI && FS.localAI.mode && FS.localAI.mode() === 'local') || navigator.onLine === false;
    /* auto, online, with the engine installed here: the free cloud (3 at once) and this computer (1) work at the same time */
    var both = !local && !FS.aiEngine() && localReady() && list.length > 1 && !(FS.localAI.mode && FS.localAI.mode() === 'cloud');
    var lanes = local ? 1 : Math.min(3, list.length), engines = [];
    for (var ei = 0; ei < lanes; ei++) engines.push(undefined);
    if (both) { engines.push('local'); lanes++; }
    function msg() { FS.busy('🤖 ' + label + ' · ' + done + ' מתוך ' + list.length + ' מוכנות' + (lanes > 1 ? ' (' + lanes + ' במקביל' + (both ? ', כולל המחשב' : '') + ')' : ''), onStop); }
    function lane(eng) {
      if (stop || failed || next >= list.length) return Promise.resolve();
      var p = list[next++];
      return FS.findFaces(p, true).catch(function () {}).then(function () { if (!stop) return FS.restyle(p, prompt, eng).then(function () { done++; if (!stop) msg(); }); })
        .catch(function (e) { if (!stop) failed = e; }).then(function () { return lane(eng); });
    }
    msg();
    var lanesP = engines.map(function (eng) { return lane(eng); });
    return Promise.all(lanesP).then(function () {
      FS.busy(); FS.emit('doc'); FS.refreshStrip && FS.refreshStrip(); FS.buildGrid && FS.gridMode && FS.gridMode() && FS.buildGrid();
      if (stop) FS.toast('⏹ העריכה נעצרה' + (done ? '. ' + done + ' תמונות כבר עודכנו ("↩ החזרת המקור" מבטל).' : '. התמונות לא השתנו.'), 5000);
      else if (done) FS.toast('✨ ' + label + ': ' + done + ' תמונות. "↩ החזרת המקור" מבטל.', 4500);
      if (failed && !stop && /offline/.test(String(failed.message)) && !localReady()) { noNet = true; setTimeout(function () { noNet = false; }, 60000); FS.offlineChooser(label); }
      else if (failed && !stop) FS.toast(FS.aiError(String(failed.message)) + (/timeout/.test(String(failed.message)) ? ' בלי אינטרנט עובדים העיצובים ב"🖥️ מובנה בתוכנה" שבראש הלשונית.' : ''), 9000);
    });
  };

  /* smart edits (Oct 23): the photo stays the photo; one thing changes. Same people, faces, poses, clothes and framing. */
  var SAME = ' Keep everything else exactly as it is: the same people, faces, expressions, poses, clothes and framing. Photorealistic, no text, no watermark.';
  var EDITS = [
    ['שחזור תמונה ישנה', '🧓', 'Restore this old or damaged photo: remove scratches, dust, creases and fading, recover sharp natural detail and faces'],
    ['צביעת שחור־לבן', '🎨', 'Colourise this black and white photo with natural, historically believable colours and skin tones'],
    ['שיפור חדות ופנים', '🔍', 'Enhance this photo like a professional retoucher: sharper detail, clean natural skin, bright eyes, corrected focus and noise'],
    ['תאורת סטודיו', '💡', 'Relight the people with soft, flattering professional studio light, balanced exposure and gentle shadows'],
    ['חיוך טבעי לכולם', '😊', 'Give everyone a natural, relaxed, happy expression with open eyes, subtle and believable'],
    ['פתיחת עיניים עצומות', '👁️', 'Open any closed eyes naturally so everyone looks at the camera with natural eyes matching their face'],
    ['הסרת אנשים ברקע', '🧹', 'Remove the strangers and passers-by in the background and fill the space naturally, keep the main people'],
    ['רקע חופה', '💒', 'Replace only the background with an elegant wedding chuppah decorated with white flowers and soft lights'],
    ['רקע אולם מעוצב', '🥂', 'Replace only the background with a beautifully lit, elegant event hall with warm lights and flowers'],
    ['רקע בלונים', '🎈', 'Replace only the background with a festive wall of pastel balloons and soft party lights'],
    ['רקע ים בשקיעה', '🌅', 'Replace only the background with a calm sea at sunset with a warm golden sky'],
    ['רקע גן פורח', '🌷', 'Replace only the background with a lush blooming garden with soft afternoon light'],
    ['רקע ירושלים', '🕍', 'Replace only the background with a view of Jerusalem\'s golden stone walls at sunset'],
    ['רקע סטודיו לבן', '⬜', 'Replace only the background with a clean seamless white studio backdrop with a soft floor shadow'],
    ['רקע לילה מנצנץ', '🌌', 'Replace only the background with a magical night sky full of stars and soft glowing lights'],
    ['קונפטי וחגיגה', '🎉', 'Add colourful falling confetti and a festive sparkle in the air around the people'],
    ['שלג יורד', '❄️', 'Add gently falling snowflakes and a soft winter glow over the scene'],
    ['הרחבת התמונה', '↔️', 'Extend the scene naturally beyond its edges, giving more room around the people while keeping them the same size in the middle']
  ];
  FS.AI_EDITS = EDITS.map(function (e) { return [e[0], e[1], e[2] + '.' + SAME]; });
  /* on the real person (Oct 25): the result stays a photograph of the same people, only the look, the clothes or the place change */
  var REAL_KEEP = ' This must stay a real photograph of the very same people: identical faces, features, skin tone, age, body and expression, so their family recognises them at once. Photorealistic, natural skin texture, professional camera and lighting. Keep the same framing, camera angle and the people\'s size in the picture; change only the clothes, the look and the surroundings. No cartoon, no painting, no text, no watermark.';
  var REAL = [
    ['חתן וכלה בהוליווד', '🎬', 'Dress the people as glamorous Hollywood stars on a red carpet with flashing cameras and velvet ropes'],
    ['שער מגזין', '📰', 'Make it a professional fashion magazine cover shoot with editorial lighting and elegant styling, no text'],
    ['צילום תדמית עסקי', '💼', 'Make it a professional corporate headshot: smart business clothes, soft studio light, a clean office background'],
    ['שמלת כלה וחליפה', '👰', 'Dress the people in an elegant white wedding gown and a classic black tuxedo, a romantic wedding setting'],
    ['ערב גאלה', '🥂', 'Dress the people in black-tie evening wear at a luxurious gala with chandeliers and warm light'],
    ['שנות ה־20', '🎩', 'Dress the people in 1920s Great Gatsby fashion in an art deco ballroom, as a real photograph'],
    ['שנות ה־50', '🚗', 'Dress the people in 1950s fashion beside a classic car on a sunny retro street, as a real photograph'],
    ['שנות ה־70 דיסקו', '🪩', 'Dress the people in 1970s disco fashion under a glittering mirror ball on a lit dance floor'],
    ['מערב פרוע', '🤠', 'Dress the people as cowboys in the wild west with a dusty town and a golden sunset behind them'],
    ['אבירים ונסיכות', '🏰', 'Dress the people as a medieval knight and royalty in a real stone castle hall, cinematic light'],
    ['טייסים', '✈️', 'Dress the people as airline pilots in uniform in front of a jet on the runway'],
    ['רופאים', '🩺', 'Dress the people as doctors in white coats in a bright modern hospital'],
    ['שפים', '👨‍🍳', 'Dress the people as chefs in white uniforms in a professional restaurant kitchen'],
    ['כדורגלנים', '⚽', 'Dress the people as football players in team kits on a stadium pitch under the floodlights'],
    ['כוכבי רוק', '🎸', 'Make the people rock stars on a concert stage with lights, smoke and a cheering crowd'],
    ['דוגמנות מסלול', '💃', 'Make the people models on a fashion runway with photographers and bright stage lights'],
    ['אסטרונאוטים אמיתיים', '👨‍🚀', 'Dress the people in realistic NASA space suits at a launch pad with a rocket behind them'],
    ['טיול בפריז', '🗼', 'Place the people in Paris with the Eiffel Tower behind them on a golden evening, natural travel photo'],
    ['ניו יורק', '🗽', 'Place the people in Times Square in New York at night with bright billboards, natural travel photo'],
    ['ונציה', '🛶', 'Place the people in a gondola on a canal in Venice at sunset, natural travel photo'],
    ['מלדיביים', '🏝️', 'Place the people on a white sand beach in the Maldives with turquoise water and palm trees'],
    ['הרים מושלגים', '🏔️', 'Place the people in the Swiss Alps with snowy peaks and warm winter clothes'],
    ['ספארי', '🦒', 'Place the people on an African safari with giraffes and an acacia tree at sunset'],
    ['יאכטה', '🛥️', 'Place the people on a luxury yacht on a blue sea on a sunny day'],
    ['הכותל המערבי', '🕍', 'Place the people at the Western Wall in Jerusalem in soft morning light, natural photo'],
    ['שקיעה בים המלח', '🌄', 'Place the people at the Dead Sea at sunset with the mountains of Moab behind them'],
    ['איפור ותסרוקת ערב', '💄', 'Give the people elegant evening makeup and a professional salon hairstyle, flattering beauty light'],
    ['תמונת משפחה בסטודיו', '👨‍👩‍👧', 'Make it a professional family studio portrait with matching outfits and a soft grey backdrop'],
    ['פסטיבל אורות', '🏮', 'Place the people at a night festival full of glowing lanterns and fairy lights, warm bokeh'],
    ['20 שנה אחורה', '⏪', 'Show the same people about 20 years younger, natural and believable, the same setting']
  ];
  FS.AI_REAL = REAL.map(function (e) { return [e[0], e[1], e[2] + '.' + REAL_KEEP]; });
  /* superheroes on the real people (Oct 25): original costumes of our own (no known characters, logos or brands), a movie-still look */
  var HERO_KEEP = ' Original costume design, no logos of existing characters or brands, the faces uncovered and clearly visible. Like a still from a big-budget superhero movie.' + REAL_KEEP;
  var HEROES = [
    ['גיבור על קלאסי', '🦸', 'Dress each person in a heroic superhero suit with a flowing cape and a bold emblem, standing proudly on a city rooftop at sunset'],
    ['שריון היי־טק', '🤖', 'Dress each person in sleek high-tech metallic armour with glowing blue lines, the helmet open so the face shows, sparks and city lights behind'],
    ['גיבור הלילה', '🦇', 'Dress each person as a dark night vigilante in black tactical armour and a long cape, on a gothic rooftop in the rain with the city lights below'],
    ['כוחות ברק', '⚡', 'Give each person a sleek speedster suit with electric lightning crackling around them, motion streaks of a city street behind'],
    ['כוחות אש', '🔥', 'Give each person a fiery hero suit with flames swirling from their hands, embers in the air, dramatic orange light'],
    ['כוחות קרח', '❄️', 'Give each person an icy hero suit with frost and ice crystals forming around their hands, a frozen landscape and cold blue light'],
    ['עפים מעל העיר', '🌆', 'Show the people flying in hero suits with capes high above a city skyline at golden hour, wind in their hair'],
    ['צוות גיבורים', '👨‍👩‍👧‍👦', 'Make the people a superhero team in matching suits of different colours, posed together heroically with an explosion of light behind them'],
    ['גיבורת על', '🦸‍♀️', 'Dress each person in an elegant warrior-hero suit with armour details and a cape, a glowing shield, a dramatic battlefield of light behind'],
    ['גיבור על קטן', '🧒', 'Dress each person in a cute colourful superhero costume with a little cape and mask pushed up on the forehead, a playful heroic pose in a bright city'],
    ['כרזת סרט גיבורים', '🎬', 'Make it a photorealistic superhero movie poster: the people in hero suits, dramatic sky, lens flares and cinematic colour grade, no text'],
    ['מגן החלל', '🌌', 'Dress each person in a cosmic hero suit with glowing star patterns, floating in space with planets and a nebula behind']
  ];
  FS.AI_HEROES = HEROES.map(function (e) { return [e[0], e[1], e[2] + '.' + HERO_KEEP]; });
  FS.AI_VIRAL = VIRAL; FS.AI_KEEP_FREE = KEEP_FREE;

  var pane = $('[data-pane=styles]'); if (!pane) return;
  var cur = { style: '3d', world: '', outfit: '', mood: '' };
  function chips(id, list, key) {
    return '<div class="ax-group"><label>' + id + '</label><div class="ax-chips" data-k="' + key + '">' + list.map(function (x) { return '<button data-v="' + x[0] + '"' + (cur[key] === x[0] ? ' class="on"' : '') + '><i>' + x[2] + '</i>' + FS.esc(x[1]) + '</button>'; }).join('') + '</div></div>';
  }
  pane.innerHTML = '<h2>עריכות AI</h2>' +
    '<p class="hint">AI אמיתי בשרת מצייר את התמונה מחדש ושומר על האנשים. עד דקה לתמונה. חל על התמונה, או על כל המסומנות. אפשר לעצור באמצע עם ⏹.</p>' +
    '<div class="card ax-off"><h3>🖥️ מובנה בתוכנה · עובד בלי אינטרנט</h3><p class="hint" id="ax-net"></p>' +
      '<div class="ai-styles" id="ax-offline"></div></div>' +
    '<div class="card ax-eng"><h3>⚙️ מנוע ה־AI</h3><div class="ax-chips" id="ax-eng"></div>' +
      '<label class="ax-var"><input type="checkbox" id="ax-keep"> 🙂 שמירת הפנים המקוריות <small>בעיצובים על אדם אמיתי, גיבורי על ועריכות חכמות: הפנים האמיתיות מוחזרות לתוצאה, בלי עיוות (על המחשב)</small></label>' +
      '<label class="ax-var"><input type="checkbox" id="ax-var"> 🎯 3 גרסאות לבחירה <small>אותו עיצוב משלושה מנועים, בוחרים את היפה (לתמונה אחת)</small></label></div>' +
    '<div class="row2 ax-undo"><button class="btn" id="style-back" title="מבטל את עיצוב ה־AI האחרון (בתמונה או בכל המסומנות)">↶ ביטול העיצוב האחרון</button><button class="btn" id="style-orig" title="מחזיר את התמונה המקורית, בלי שום עיצוב AI">↩ חזרה למקור</button></div>' +
    '<div class="card ax-build"><h3>🎛️ שילוב משלך</h3>' + chips('🎨 סגנון', STYLE, 'style') + chips('🌍 איפה', WORLD, 'world') + chips('👗 תלבושת', OUTFIT, 'outfit') + chips('✨ אווירה', MOOD, 'mood') +
    '<p class="ax-name" id="ax-name"></p><div class="row2"><button class="btn" id="ax-random">🎲 הפתעה</button><button class="btn primary" id="ax-go">✨ ליצור</button></div></div>' +
    '<p class="ax-cloud-note">🌐 העיצובים מכאן ולמטה נוצרים בשרת AI וצריכים אינטרנט' + (FS.localAI ? ' (או את מנוע ה־AI המקומי)' : '') + '.</p><h3>🦸 גיבורי על <small>על האנשים האמיתיים, כמו סצנה מסרט</small></h3><div class="ai-styles" id="ax-heroes"></div><h3>🧑 על אדם אמיתי <small>נשאר צילום אמיתי, משתנים הלבוש והמקום</small></h3><div class="ai-styles" id="ax-real"></div><h3>🪄 עריכות חכמות <small>התמונה נשארת, משתנה דבר אחד</small></h3><div class="ai-styles" id="ax-edits"></div><h3>🔥 טרנדים ויראליים</h3><div class="ai-styles" id="ax-viral"></div>' +
    '<h3>⭐ שילובים מוכנים</h3><div class="ai-styles" id="ax-combos"></div>' +
    '<h3>🎨 סגנונות</h3><div class="ai-styles" id="ai-styles"></div>' +
    '<h3>✍️ לתאר במילים</h3><div class="field"><textarea id="ai-custom" rows="2" placeholder="למשל: להלביש את כולם בתחפושות של פיראטים על ספינה בסערה"></textarea></div>' +
    '<button class="btn primary wide" id="ai-custom-go">✨ לעשות</button>';
  function sync() { $$('.ax-chips', pane).forEach(function (g) { $$('button', g).forEach(function (b) { b.classList.toggle('on', cur[g.dataset.k] === b.dataset.v); }); }); $('#ax-name').textContent = nameOf(cur); }
  $$('.ax-chips', pane).forEach(function (g) { g.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; cur[g.dataset.k] = b.dataset.v; sync(); }); });
  function pick(l) { return l[Math.floor(Math.random() * l.length)][0]; }
  $('#ax-random').addEventListener('click', function () {
    cur = { style: pick(STYLE), world: pick(WORLD.slice(1)), outfit: Math.random() < 0.75 ? pick(OUTFIT.slice(1)) : '', mood: Math.random() < 0.6 ? pick(MOOD.slice(1)) : '' }; sync();
    $$('.ax-chips button.on', pane).forEach(function (b) { b.scrollIntoView({ block: 'nearest', inline: 'center' }); });
  });
  $('#ax-go').addEventListener('click', function () { FS.runAI(promptOf(cur), nameOf(cur)); });
  FS.AI_HEROES.forEach(function (v) {
    var b = document.createElement('button'); b.className = 'ai-style hot'; b.title = v[0];
    b.innerHTML = '<i>' + v[1] + '</i><span>' + FS.esc(v[0]) + '</span>';
    b.addEventListener('click', function () { FS.runAI(v[2], v[0]); }); $('#ax-heroes').appendChild(b);
  });
  FS.AI_REAL.forEach(function (v) {
    var b = document.createElement('button'); b.className = 'ai-style'; b.title = v[0];
    b.innerHTML = '<i>' + v[1] + '</i><span>' + FS.esc(v[0]) + '</span>';
    b.addEventListener('click', function () { FS.runAI(v[2], v[0]); }); $('#ax-real').appendChild(b);
  });
  FS.AI_EDITS.forEach(function (v) {
    var b = document.createElement('button'); b.className = 'ai-style'; b.title = v[0];
    b.innerHTML = '<i>' + v[1] + '</i><span>' + FS.esc(v[0]) + '</span>';
    b.addEventListener('click', function () { FS.runAI(v[2], v[0]); }); $('#ax-edits').appendChild(b);
  });
  VIRAL.forEach(function (v) {
    var b = document.createElement('button'); b.className = 'ai-style hot'; b.title = v[0];
    b.innerHTML = '<i>' + v[1] + '</i><span>' + FS.esc(v[0]) + '</span>';
    b.addEventListener('click', function () { FS.runAI(v[2] + '.' + KEEP_FREE, v[0]); }); $('#ax-viral').appendChild(b);
  });
  COMBOS.forEach(function (c) {
    var o = { style: c[2], world: c[3], outfit: c[4], mood: c[5] }, b = document.createElement('button'); b.className = 'ai-style'; b.title = nameOf(o);
    b.innerHTML = '<i>' + c[1] + '</i><span>' + FS.esc(c[0]) + '</span>';
    b.addEventListener('click', function () { FS.runAI(promptOf(o), c[0]); }); $('#ax-combos').appendChild(b);
  });
  (FS.AI_STYLES || []).forEach(function (s) {
    var b = document.createElement('button'); b.className = 'ai-style'; b.innerHTML = '<i>' + s[2] + '</i><span>' + FS.esc(s[1]) + '</span>';
    b.addEventListener('click', function () { FS.runAI(s[3] + KEEP, s[1]); }); $('#ai-styles').appendChild(b);
  });
  /* ---------- built in, no internet: the neural styles (offline-ai.js); the pixel filters are no longer offered here (they distort faces) ---------- */
  (FS.OFFLINE_AI || []).forEach(function (o) {
    var b = document.createElement('button'); b.className = 'ai-style off'; b.title = o[1] + ' · עובד בלי אינטרנט';
    b.innerHTML = '<i>' + o[2] + '</i><span>' + FS.esc(o[1]) + '</span>';
    b.addEventListener('click', function () { runOffline(o[0], o[1]); }); $('#ax-offline').appendChild(b);
  });
  function runOffline(id, label) {
    var list = FS.targets(); if (!list.length) return FS.toast('בוחרים תמונה קודם');
    var done = 0, stop = false, failed = null;
    list.reduce(function (ch, p, i) {
      return ch.then(function () {
        if (stop || failed) return;
        var base = '🖥️ ' + label + ' · תמונה ' + (i + 1) + ' מתוך ' + list.length + ' (על המחשב, בלי אינטרנט)';
        FS.busy(base, function () { stop = true; });
        return FS.restyleOffline(p, id, function (f) { if (!stop) FS.busy(base + ' · ' + Math.round(f * 100) + '%', function () { stop = true; }); }).then(function () { done++; }, function (e) { failed = e; });
      });
    }, Promise.resolve()).then(function () {
      FS.busy(); FS.emit('doc'); FS.refreshStrip && FS.refreshStrip();
      if (failed) FS.toast('העיצוב המובנה לא הצליח: ' + ((failed && failed.message) || '') + '. "🔄 רענון מלא" ומנסים שוב.', 7000);
      else if (done) FS.toast('✨ ' + label + ': ' + done + ' תמונות, בלי אינטרנט. "↩ ביטול AI" מחזיר.', 4500);
    });
  }
  /* the engine bar: auto, the engines this server has, and this computer's engine in the desktop program */
  function engBar() {
    var box = $('#ax-eng'); if (!box) return;
    FS.aiEngines().then(function (av) {
      var cur = FS.aiEngine(), keys = [''].concat(['gemini', 'flux', 'free', 'openai'].filter(function (k) { return av[k]; }));
      if (FS.localAI) keys.push('local');
      if (keys.indexOf(cur) < 0) { cur = ''; FS.aiEngine(''); }
      box.innerHTML = keys.map(function (k) { return '<button data-eng="' + k + '"' + (k === cur ? ' class="on"' : '') + '>' + FS.esc(FS.ENGINE_NAMES[k]) + '</button>'; }).join('');
    });
  }
  $('#ax-eng').addEventListener('click', function (e) {
    var b = e.target.closest('[data-eng]'); if (!b) return;
    if (b.dataset.eng === 'local' && !localReady()) { FS.toast('מנוע ה־AI המקומי עוד לא מותקן. ☰ ← AI מקומי'); if (FS.localAI && FS.localAI.open) FS.localAI.open(); return; }
    FS.aiEngine(b.dataset.eng); $$('#ax-eng button').forEach(function (x) { x.classList.toggle('on', x === b); });
    FS.toast('⚙️ מנוע: ' + FS.ENGINE_NAMES[b.dataset.eng] + (b.dataset.eng ? '' : ' (הכי טוב שזמין, ואם נכשל הבא בתור)'));
  });
  var kbox = $('#ax-keep'); if (kbox && FS.keepFacesOn) { kbox.checked = FS.keepFacesOn(); kbox.addEventListener('change', function () { FS.keepFacesOn(kbox.checked); FS.toast(kbox.checked ? '🙂 הפנים המקוריות יוחזרו לכל עיצוב על אדם אמיתי' : 'הפנים יישארו כמו שה־AI צייר'); }); }
  var vbox = $('#ax-var'); try { vbox.checked = localStorage.getItem('fs-ai-variants') === '1'; } catch (e) {}
  vbox.addEventListener('change', function () { try { localStorage.setItem('fs-ai-variants', vbox.checked ? '1' : '0'); } catch (e) {} FS.toast(vbox.checked ? '🎯 כל עיצוב יגיע ב־3 גרסאות לבחירה' : 'גרסה אחת לכל עיצוב'); });
  engBar(); window.addEventListener('online', engBar);
  /* without the internet: say what still works */
  function net() {
    document.body.classList.toggle('no-net', navigator.onLine === false && !localReady());
    var el = $('#ax-net'); if (!el) return;
    var local = FS.localAI && FS.localAI.isReady && FS.localAI.isReady();
    el.innerHTML = navigator.onLine === false
      ? (local ? '📴 אין אינטרנט · מנוע ה־AI המקומי מותקן, אז גם כל העיצובים שלמטה עובדים (לאט יותר).' : '📴 אין אינטרנט · העיצובים כאן עובדים. העיצובים שלמטה צריכים אינטרנט, או את <a href="#" id="ax-la">מנוע ה־AI המקומי</a> (הורדה חד־פעמית).')
      : 'רצים על המחשב שלכם: אין המתנה לשרת ואין מכסה. העיצובים שלמטה (ויראליים, שילובים, סגנונות) עובדים דרך האינטרנט' + (local ? ', או על מנוע ה־AI המקומי כשאין רשת.' : '.');
    var a = $('#ax-la'); if (a) a.addEventListener('click', function (e) { e.preventDefault(); if (FS.localAI && FS.localAI.open) FS.localAI.open(); else FS.toast('מנוע ה־AI המקומי זמין בתוכנה למחשב'); });
  }
  window.addEventListener('online', net); window.addEventListener('offline', net); setTimeout(net, 1500); net();

  $('#style-back').addEventListener('click', function () { var n = 0; FS.targets().forEach(function (q) { if (FS.unstyleStep(q)) n++; }); FS.emit('doc'); FS.refreshStrip && FS.refreshStrip(); FS.toast(n ? '↶ עיצוב ה־AI האחרון בוטל ב־' + n + ' תמונות' : 'אין עיצוב AI לבטל'); });
  $('#style-orig').addEventListener('click', function () { var n = 0; FS.targets().forEach(function (q) { if (FS.unstyle(q)) n++; }); FS.emit('doc'); FS.refreshStrip && FS.refreshStrip(); FS.toast(n ? '↩ המקור הוחזר ל־' + n + ' תמונות' : 'אין עריכת AI להחזיר'); });
  $('#ai-custom-go').addEventListener('click', function () { var t = $('#ai-custom').value.trim(); if (!t) return FS.toast('כותבים מה לעשות לתמונה'); FS.runAI('Edit this photo: ' + t + '.' + KEEP, 'עריכת AI'); });
  sync();
  FS.buildStyles = function () {};
  FS.AI_COMBOS = { VIRAL: VIRAL, STYLE: STYLE, WORLD: WORLD, OUTFIT: OUTFIT, MOOD: MOOD, COMBOS: COMBOS, promptOf: promptOf, nameOf: nameOf };
})();
