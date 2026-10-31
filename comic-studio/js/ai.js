/* מצב AI (אופציונלי): ציור מחדש של התמונה בעזרת מודל התמונות של Google Gemini.
   עובד עם מפתח API אישי שנשמר רק בדפדפן הזה. הבקשה יוצאת ישירות מהדפדפן ל-Google. */
(function () {
  'use strict';

  var KEY = 'comic-studio-ai';
  var DEFAULT_MODEL = 'gemini-2.5-flash-image';

  var KEEP = ' Keep the people clearly recognizable: same face shape, hairstyle, facial hair, skin tone, head covering and clothing. Keep the composition and pose. No text, no watermark, no speech bubbles.';

  var STYLES = [
    { id: 'ai-comic', name: 'קומיקס גיבורי-על', prompt: 'Redraw this photo as a modern American superhero comic book panel: bold confident ink lines, cel shading, dramatic rim light, saturated colors, subtle halftone dots.' },
    { id: 'ai-caricature', name: 'קריקטורה מוגזמת', prompt: 'Turn this photo into a professional hand-drawn caricature: big expressive head on a smaller body, exaggerated but flattering features, clean ink outlines, warm watercolor and marker coloring on white paper.' },
    { id: 'ai-3d', name: 'אנימציה תלת-ממדית', prompt: 'Recreate this photo as a still from a high-end 3D animated family movie: soft stylized proportions, large expressive eyes, subsurface skin shading, cinematic lighting, shallow depth of field.' },
    { id: 'ai-anime', name: 'אנימה', prompt: 'Redraw this photo as a Japanese anime key frame: clean line art, flat cel shading with soft gradients, luminous painted background, vivid but gentle palette.' },
    { id: 'ai-manga', name: 'מנגה שחור-לבן', prompt: 'Redraw this photo as a black and white manga page panel: precise G-pen ink lines, screentone shading, speed lines where there is motion, high contrast.' },
    { id: 'ai-noir', name: 'גרפיק נובל אפל', prompt: 'Redraw this photo as a dark graphic novel panel: heavy spotted blacks, moody blue-teal night palette with a warm accent light, gritty ink texture, cinematic framing.' },
    { id: 'ai-chibi', name: 'צ׳יבי חמוד', prompt: 'Turn the person in this photo into a cute chibi character: tiny body, oversized head, big shiny eyes, simple pastel shading, thick clean outline.' },
    { id: 'ai-clay', name: 'פלסטלינה', prompt: 'Recreate this photo as a stop-motion claymation scene: handmade plasticine figures with visible fingerprints and texture, miniature set, soft studio light.' },
    { id: 'ai-sticker', name: 'סטיקר', prompt: 'Turn the main person in this photo into a die-cut cartoon sticker: bold vector cartoon style, thick white border around the figure, plain flat light-gray background.' },
    { id: 'ai-retro', name: 'קומיקס רטרו', prompt: 'Redraw this photo as a 1960s vintage comic book panel: Ben-Day dots, slightly off-register CMYK printing, yellowed newsprint paper, bold black outlines.' },
    { id: 'ai-oil', name: 'ציור שמן', prompt: 'Repaint this photo as a classical oil painting portrait with visible brush strokes, rich warm glazes and dramatic chiaroscuro lighting.' },
    { id: 'ai-pixel', name: 'משחק רטרו', prompt: 'Recreate this photo as detailed 16-bit pixel art from a classic adventure video game, limited palette, crisp pixels, no blur.' }
  ];

  var BY_ID = {};
  STYLES.forEach(function (s) { BY_ID[s.id] = s; });

  function settings() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; }
  }
  function save(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* פרטי */ }
  }
  function ready() { return Boolean(settings().key); }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1]); };
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  function b64ToBlob(b64, type) {
    var bin = atob(b64), arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: type || 'image/png' });
  }

  function hebrewError(status, msg) {
    if (status === 400 && /API key/i.test(msg)) return 'מפתח ה-API לא תקין. בדקו אותו בהגדרות ה-AI.';
    if (status === 403) return 'למפתח הזה אין הרשאה למודל התמונות. ודאו שהוא נוצר ב-Google AI Studio.';
    if (status === 404) return 'המודל לא נמצא. בדקו את שם המודל בהגדרות ה-AI.';
    if (status === 429) return 'עברתם את מכסת הבקשות של המפתח. נסו שוב בעוד דקה.';
    return 'השירות החזיר שגיאה (' + status + '): ' + msg;
  }

  /* images: מערך Blob. מחזיר Blob של תמונה חדשה */
  function generate(images, prompt) {
    var s = settings();
    if (!s.key) return Promise.reject(new Error('צריך להזין מפתח API בהגדרות ה-AI.'));
    var model = (s.model || DEFAULT_MODEL).trim();
    return Promise.all(images.map(blobToBase64)).then(function (b64s) {
      var parts = [{ text: prompt }];
      b64s.forEach(function (d, i) { parts.push({ inline_data: { mime_type: images[i].type || 'image/jpeg', data: d } }); });
      return fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': s.key },
        body: JSON.stringify({ contents: [{ role: 'user', parts: parts }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } })
      });
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (j) {
        if (!res.ok) throw new Error(hebrewError(res.status, (j.error && j.error.message) || res.statusText));
        var cand = j.candidates && j.candidates[0];
        var out = cand && cand.content && (cand.content.parts || []).find(function (p) { return p.inlineData || p.inline_data; });
        if (!out) {
          var why = cand && cand.finishReason ? ' (' + cand.finishReason + ')' : '';
          throw new Error('המודל לא החזיר תמונה' + why + '. נסו תמונה אחרת או ניסוח אחר.');
        }
        var d = out.inlineData || out.inline_data;
        return b64ToBlob(d.data, d.mimeType || d.mime_type);
      });
    });
  }

  function stylePrompt(id, extra) {
    var st = BY_ID[id];
    var p = st ? st.prompt : 'Redraw this photo as a comic book illustration.';
    if (extra) p += ' Additional direction: ' + extra + '.';
    return p + KEEP;
  }

  function scenePrompt(count, scene, styleId) {
    var st = BY_ID[styleId];
    return 'Combine the ' + count + ' people from these ' + count + ' photos into ONE new illustrated scene together. Scene: ' +
      (scene || 'standing together, smiling at the viewer') + '. Art style: ' +
      (st ? st.prompt.replace(/^(Redraw|Recreate|Turn|Repaint)[^:]*:\s*/, '') : 'modern comic book, bold ink lines, cel shading') + KEEP;
  }

  window.ComicAI = {
    STYLES: STYLES, byId: BY_ID, DEFAULT_MODEL: DEFAULT_MODEL,
    settings: settings, save: save, ready: ready, generate: generate, stylePrompt: stylePrompt, scenePrompt: scenePrompt
  };
})();
