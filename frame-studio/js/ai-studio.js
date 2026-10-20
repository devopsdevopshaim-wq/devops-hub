/* The AI panel (the "סגנונות" tab): real image AI on the hubs server (Gemini, then FLUX on Cloudflare) that redraws the
   photo and keeps the people. A combination builder (style × world × costume × atmosphere, or 🎲 a surprise), ready
   combinations, single styles and free text. Every run can be stopped in the middle (⏹ on the busy sign). */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$;
  var KEEP = FS.AI_KEEP || '';

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
    ['glass', 'ויטראז׳', '⛪', 'Make it a glowing stained-glass window with lead lines and jewel colours']
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
    ['jungle', 'ג׳ונגל טרופי', '🌴', 'a lush rainforest with a waterfall']
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
    ['angels', 'מלאכים', '🕊️', 'soft white angel wings and glowing halos']
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
    ['spot', 'זרקורים ועשן', '🔦', 'stage spotlights and soft smoke']
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
    ['שפים בפריז', '👨‍🍳', 'cartoon', 'paris', 'chef', '']
  ];
  function find(list, id) { return list.filter(function (x) { return x[0] === id; })[0] || list[0]; }
  function promptOf(c) {
    var st = find(STYLE, c.style), w = find(WORLD, c.world), o = find(OUTFIT, c.outfit), m = find(MOOD, c.mood), parts = ['Transform this photo.'];
    parts.push(st[3] + '.');
    if (w[3]) parts.push('Move the people into ' + w[3] + ', with matching natural lighting on them.');
    if (o[3]) parts.push('Dress every person in ' + o[3] + '.');
    if (m[3]) parts.push('Add ' + m[3] + '.');
    return parts.join(' ') + KEEP;
  }
  function nameOf(c) { return [find(STYLE, c.style), find(WORLD, c.world), find(OUTFIT, c.outfit), find(MOOD, c.mood)].filter(function (x, i) { return i === 0 || x[0]; }).map(function (x) { return x[1]; }).join(' · '); }

  /* run one prompt on the photos, one at a time; ⏹ stops the run (the photos done so far keep their result) */
  FS.runAI = function (prompt, label, list) {
    list = list || FS.targets(); if (!list.length) return FS.toast('בוחרים תמונה קודם');
    var done = 0, stop = false, failed = null, chain = Promise.resolve();
    function onStop() { stop = true; FS.aiStop && FS.aiStop(); }
    list.forEach(function (p, i) { chain = chain.then(function () {
      if (stop || failed) return;
      FS.busy('🤖 ' + label + ' · תמונה ' + (i + 1) + ' מתוך ' + list.length + ' (עד דקה לתמונה)', onStop);
      return FS.findFaces(p, true).catch(function () {}).then(function () { if (!stop) return FS.restyle(p, prompt).then(function () { done++; }); })
        .catch(function (e) { if (!stop) failed = e; });
    }); });
    return chain.then(function () {
      FS.busy(); FS.emit('doc'); FS.refreshStrip && FS.refreshStrip(); FS.buildGrid && FS.gridMode && FS.gridMode() && FS.buildGrid();
      if (stop) FS.toast('⏹ העריכה נעצרה' + (done ? '. ' + done + ' תמונות כבר עודכנו ("↩ החזרת המקור" מבטל).' : '. התמונות לא השתנו.'), 5000);
      else if (done) FS.toast('✨ ' + label + ': ' + done + ' תמונות. "↩ החזרת המקור" מבטל.', 4500);
      if (failed && !stop) FS.toast(FS.aiError(String(failed.message)), 9000);
    });
  };

  var pane = $('[data-pane=styles]'); if (!pane) return;
  var cur = { style: '3d', world: '', outfit: '', mood: '' };
  function chips(id, list, key) {
    return '<div class="ax-group"><label>' + id + '</label><div class="ax-chips" data-k="' + key + '">' + list.map(function (x) { return '<button data-v="' + x[0] + '"' + (cur[key] === x[0] ? ' class="on"' : '') + '><i>' + x[2] + '</i>' + FS.esc(x[1]) + '</button>'; }).join('') + '</div></div>';
  }
  pane.innerHTML = '<h2>עריכות AI</h2>' +
    '<p class="hint">AI אמיתי בשרת מצייר את התמונה מחדש ושומר על האנשים. עד דקה לתמונה. חל על התמונה, או על כל המסומנות. אפשר לעצור באמצע עם ⏹.</p>' +
    '<button class="btn wide" id="style-orig">↩ החזרת המקור (ביטול ה־AI)</button>' +
    '<div class="card ax-build"><h3>🎛️ שילוב משלך</h3>' + chips('🎨 סגנון', STYLE, 'style') + chips('🌍 איפה', WORLD, 'world') + chips('👗 תלבושת', OUTFIT, 'outfit') + chips('✨ אווירה', MOOD, 'mood') +
    '<p class="ax-name" id="ax-name"></p><div class="row2"><button class="btn" id="ax-random">🎲 הפתעה</button><button class="btn primary" id="ax-go">✨ ליצור</button></div></div>' +
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
  COMBOS.forEach(function (c) {
    var o = { style: c[2], world: c[3], outfit: c[4], mood: c[5] }, b = document.createElement('button'); b.className = 'ai-style'; b.title = nameOf(o);
    b.innerHTML = '<i>' + c[1] + '</i><span>' + FS.esc(c[0]) + '</span>';
    b.addEventListener('click', function () { FS.runAI(promptOf(o), c[0]); }); $('#ax-combos').appendChild(b);
  });
  (FS.AI_STYLES || []).forEach(function (s) {
    var b = document.createElement('button'); b.className = 'ai-style'; b.innerHTML = '<i>' + s[2] + '</i><span>' + FS.esc(s[1]) + '</span>';
    b.addEventListener('click', function () { FS.runAI(s[3] + KEEP, s[1]); }); $('#ai-styles').appendChild(b);
  });
  $('#style-orig').addEventListener('click', function () { var n = 0; FS.targets().forEach(function (q) { if (FS.unstyle(q)) n++; }); FS.emit('doc'); FS.refreshStrip && FS.refreshStrip(); FS.toast(n ? '↩ המקור הוחזר ל־' + n + ' תמונות' : 'אין עריכת AI להחזיר'); });
  $('#ai-custom-go').addEventListener('click', function () { var t = $('#ai-custom').value.trim(); if (!t) return FS.toast('כותבים מה לעשות לתמונה'); FS.runAI('Edit this photo: ' + t + '.' + KEEP, 'עריכת AI'); });
  sync();
  FS.buildStyles = function () {};
  FS.AI_COMBOS = { STYLE: STYLE, WORLD: WORLD, OUTFIT: OUTFIT, MOOD: MOOD, COMBOS: COMBOS, promptOf: promptOf, nameOf: nameOf };
})();
