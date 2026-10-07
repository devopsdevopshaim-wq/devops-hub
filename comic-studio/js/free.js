/* מצב חינמי: קומיקס בלי עלות.
   1. תיאור האנשים בתמונות ותסריט פאנל-פאנל עם טקסט בעברית: מודל טקסט חינמי של Gemini דרך שרת האתר,
      ואם השרת לא זמין, שירות הטקסט החינמי של Pollinations.
   2. כל פאנל מצויר בשירות הציור החינמי Pollinations, באותו תיאור דמות ובאותו "זרע", כדי שהדמות תהיה עקבית.
   3. העמוד נבנה בעורך: תבנית, פאנלים, ובועות וכיתובים בעברית (מודלי ציור לא יודעים לכתוב עברית). */
(function () {
  'use strict';

  var A = window.ComicApp, PG = window.ComicPage;
  var API = 'https://haimkripisn.app.n8n.cloud/webhook/comic-draw';
  var POL_TEXT = 'https://text.pollinations.ai/openai';
  var POL_IMG = 'https://image.pollinations.ai/prompt/';

  var LOOK = {
    'superhero': 'modern American superhero comic book art, bold confident ink lines, dynamic cel shading, dramatic lighting, saturated colors',
    'graphic-novel': 'gritty graphic novel art, heavy black shadows, moody cinematic lighting, muted teal and amber palette, ink brushwork',
    'manga': 'black and white manga panel, precise ink line art, screentone shading, speed lines, high contrast',
    'anime': 'anime key frame, clean line art, soft cel shading, luminous painted background',
    'ligne-claire': 'Franco-Belgian ligne claire comic, clean uniform black outlines, flat bright colors, detailed background',
    'retro-pop': '1960s vintage comic book panel, Ben-Day dots, bold outlines, off-register print, yellowed paper',
    'caricature': 'professional caricature illustration, big expressive head, exaggerated friendly features, ink and marker',
    'webtoon': 'Korean webtoon art, clean digital line art, soft gradients, polished full color',
    'cartoon-3d': '3D animated family movie still, stylized proportions, expressive eyes, soft cinematic lighting',
    'storybook': 'children\'s storybook illustration, soft watercolor and gouache, warm light',
    'street-art': 'street art graffiti mural style, bold spray paint colors, thick outlines, drips',
    'noir': 'black and white film noir comic, stark chiaroscuro, rain, deep shadows'
  };
  var LAYOUT = { 1: 'one', 2: 'two-rows', 3: 'hero-top', 4: 'grid-4', 5: 'manga-5', 6: 'grid-6' };

  function timeout(ms) {
    if (typeof AbortController === 'undefined') return undefined;
    var c = new AbortController();
    setTimeout(function () { c.abort(); }, ms);
    return c.signal;
  }

  function server(body, ms) {
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(body), signal: timeout(ms || 35000) })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (j) { if (!j.ok) throw new Error(j.error || 'server'); return j; });
  }

  /* שירות הטקסט החינמי של Pollinations (תואם OpenAI) */
  function polText(content, json) {
    return fetch(POL_TEXT, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: timeout(40000),
      body: JSON.stringify({ model: 'openai', messages: [{ role: 'user', content: content }], response_format: json ? { type: 'json_object' } : undefined, private: true })
    }).then(function (r) { if (!r.ok) throw new Error('pol ' + r.status); return r.json(); })
      .then(function (j) {
        var t = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
        if (!t) throw new Error('pol empty');
        return json ? JSON.parse(String(t).replace(/^```(json)?|```$/g, '').trim()) : String(t);
      });
  }

  var DESCRIBE = 'For each photo, describe the main person for a comic artist so they can be drawn recognizably: apparent age, gender, face shape, hair, beard, head covering (such as a kippah), skin tone, glasses, expression, clothing with colors. One short English paragraph per photo, no names. Reply as JSON: {"people": ["..."]}';

  function describe(images) {
    return server({ mode: 'describe', images: images }).then(function (j) { return j.people; }).catch(function () {
      var content = [{ type: 'text', text: DESCRIBE }].concat(images.map(function (x) {
        return { type: 'image_url', image_url: { url: 'data:' + x.mime + ';base64,' + x.data } };
      }));
      return polText(content, true).then(function (j) { return j.people || []; });
    }).catch(function () { return []; });
  }

  function scriptLocal(story, n) {
    /* בלי שירות טקסט: מפרקים את הסיפור לפי "פאנל N:" או לפי שורות */
    var parts = String(story || '').split(/פאנל\s*\d+\s*[:：]|\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!parts.length) parts = ['the hero arrives', 'a surprising moment', 'the hero smiles'];
    var out = [];
    for (var i = 0; i < n; i++) {
      var p = parts[i % parts.length];
      var speech = (p.match(/בועה\s*[:：]\s*["“”״]?([^"“”״]+)["“”״]?/) || [])[1] || '';
      var caption = (p.match(/כיתוב\s*[:：]\s*["“”״]?([^"“”״]+)["“”״]?/) || [])[1] || '';
      out.push({ scene: p.replace(/(בועה|כיתוב)\s*[:：].*$/, '').trim() || p, speech: speech.trim(), caption: caption.trim() });
    }
    return out;
  }

  function script(people, story, title, n) {
    return server({ mode: 'script', people: people, story: story, title: title, panels: n }).catch(function () {
      var ask = 'Write a comic page script in ' + n + ' panels as JSON {"title": "...", "panels": [{"scene": "...", "speech": "...", "caption": "..."}]}. ' +
        'Characters: ' + (people.join(' | ') || 'a friendly main character') + '. Story idea (Hebrew or English): ' + (story || 'a short uplifting adventure') + '. Title: ' + (title || 'a short Hebrew title') + '. ' +
        '"scene" is a vivid English description of what to draw with no text in the image; "speech" is what a character says in short natural Hebrew (or empty); "caption" is a short Hebrew narration (or empty). Follow the user\'s panel-by-panel story exactly when given.';
      return polText(ask, true);
    }).then(function (j) {
      var p = (j.panels || []).slice(0, n);
      if (!p.length) throw new Error('empty');
      return { title: title || j.title || '', panels: p };
    }).catch(function () { return { title: title, panels: scriptLocal(story, n) }; });
  }

  function dims(w, h) {
    var k = 1024 / Math.max(w, h);
    return [Math.max(256, Math.round(w * k / 64) * 64), Math.max(256, Math.round(h * k / 64) * 64)];
  }

  /* ציור פאנל אחד בשירות החינמי. ניסיון שני עם זרע אחר אם נכשל */
  function paint(prompt, w, h, seed) {
    var d = dims(w, h);
    var url = function (s) {
      return POL_IMG + encodeURIComponent(prompt.slice(0, 1400)) + '?width=' + d[0] + '&height=' + d[1] + '&nologo=true&private=true&enhance=true&model=flux&seed=' + s;
    };
    var once = function (s) {
      if (cancelled) return Promise.reject(stopErr());
      /* שירות חינמי: לא מחכים לו יותר מדקה לניסיון. "עצירה" מנתקת את הבקשה מיד */
      var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var t = ctl ? setTimeout(function () { ctl.abort(); }, 70000) : 0;
      current = ctl;
      return fetch(url(s), { signal: ctl ? ctl.signal : undefined }).then(function (r) {
        clearTimeout(t);
        if (!r.ok) throw new Error('paint ' + r.status);
        return r.blob();
      }).then(function (b) { if (!/^image\//.test(b.type)) throw new Error('not image'); return b; })
        .catch(function (e) { clearTimeout(t); if (cancelled) throw stopErr(); throw e; });
    };
    /* ניסיון שני רק אם הראשון נכשל מהר (שגיאה); אם השירות פשוט לא ענה דקה, לא מחכים עוד דקה */
    return once(seed).catch(function (e) {
      if (e && (e.stopped || e.name === 'AbortError')) throw e;
      return once(seed + 101);
    });
  }

  var cancelled = false, current = null;
  function stopErr() { return Object.assign(new Error('הציור נעצר.'), { stopped: true }); }
  function cancel() { cancelled = true; if (current) { try { current.abort(); } catch (e) { /* כבר נעצר */ } } }

  function prompt(style, scene, people) {
    return LOOK[style] + '. ' + scene + (people.length ? '. Characters: ' + people.join(' | ') : '') +
      '. Comic panel, professional comic artist, no text, no letters, no speech bubbles, no watermark.';
  }

  function prepare(id) {
    return A.loadBitmap(id, 768).then(function (b) {
      var c = A.scaled(b, 768);
      A.closeImg(b);
      return A.canvasToBlob(c, 'image/jpeg', 0.85);
    }).then(function (blob) {
      return new Promise(function (res, rej) {
        var r = new FileReader();
        r.onload = function () { res({ mime: 'image/jpeg', data: String(r.result).split(',')[1] }); };
        r.onerror = rej;
        r.readAsDataURL(blob);
      });
    });
  }

  /* opts: { mode, ids, style, story, title, panels, aspect }. status(text) */
  function run(opts, status) {
    cancelled = false;
    var style = LOOK[opts.style] ? opts.style : 'superhero';
    var seed = Math.floor(Math.random() * 1e8);
    status('מתאר את הדמויות בתמונות…');
    return Promise.all(opts.ids.slice(0, 4).map(prepare)).then(describe).then(function (people) {
      if (opts.mode === 'character') return characters(opts, people, style, seed, status);
      if (opts.mode === 'scene') return scene(opts, people, style, seed, status);
      return page(opts, people, style, seed, status);
    });
  }

  function save(blob, name, origin) {
    return A.addAiResult(blob, name, origin).then(function (m) { A.saveMeta(); return m; });
  }

  function characters(opts, people, style, seed, status) {
    var ids = opts.ids.slice(0, 4), made = [];
    return ids.reduce(function (p, id, i) {
      return p.then(function () {
        status('מצייר דמות ' + (i + 1) + ' מתוך ' + ids.length + '…');
        var who = people[i] ? [people[i]] : [];
        var sc = 'portrait of the character in a heroic, expressive pose' + (opts.story ? ', ' + opts.story : '');
        return paint(prompt(style, sc, who), 768, 1024, seed + i).then(function (b) {
          return save(b, ((A.imageById(id) || {}).name || 'דמות') + ' · חינמי', id).then(function (m) { made.push({ meta: m, blob: b }); });
        });
      });
    }, Promise.resolve()).then(function () { return { kind: 'images', items: made }; });
  }

  function scene(opts, people, style, seed, status) {
    status('מצייר את הסצנה…');
    var sc = (opts.story || 'the characters together, smiling, in a dynamic heroic pose');
    return paint(prompt(style, sc, people), 1024, 768, seed).then(function (b) {
      return save(b, 'סצנה משולבת · חינמי', opts.ids[0]).then(function (m) { return { kind: 'images', items: [{ meta: m, blob: b }] }; });
    });
  }

  function page(opts, people, style, seed, status) {
    var n = Math.min(6, Math.max(1, parseInt(opts.panels, 10) || 5));
    status('כותב תסריט לעמוד…');
    return script(people, opts.story, opts.title, n).then(function (sc) {
      var panels = sc.panels.slice(0, n);
      var pg = PG.newPage(opts.aspect === 'square' ? 'square' : opts.aspect === 'landscape' ? 'landscape' : opts.aspect === 'tall' ? 'story' : 'a4', LAYOUT[panels.length] || 'grid-6');
      pg.title.text = sc.title || 'הקומיקס שלי';
      pg.title.show = Boolean(pg.title.text);
      var polys = PG.computePanels(pg), made = [], failed = 0;
      return panels.reduce(function (p, panel, i) {
        return p.then(function () {
          if (cancelled) throw stopErr();
          /* אם שני הפאנלים הראשונים נכשלו, השירות לא זמין: עוצרים במקום לחכות דקות */
          if (!made.length && failed >= 1) throw new Error('שירות הציור החינמי לא מגיב כרגע. נסו שוב בעוד כמה דקות, או לחצו על "בדיקת מערכת".');
          status('מצייר פאנל ' + (i + 1) + ' מתוך ' + panels.length + '… (עד דקה לפאנל)');
          var b = PG.bbox(polys[i]);
          return paint(prompt(style, panel.scene || '', people), b.w, b.h, seed + i).then(function (blob) {
            return save(blob, (pg.title.text || 'קומיקס') + ' · פאנל ' + (i + 1), opts.ids[0]).then(function (m) {
              pg.panels[i].img = m.id;
              pg.panels[i].style = 'original';
              pg.panels[i].params = { sat: 100, contrast: 0 };
              made.push({ meta: m, blob: blob });
            });
          }, function (e) {
            if (e && e.stopped) throw e;
            failed++; /* פאנל שנכשל נשאר ריק, ואפשר לגרור אליו תמונה */
          });
        });
      }, Promise.resolve()).then(function () {
        if (!made.length) throw new Error('שירות הציור החינמי לא הגיב. נסו שוב בעוד דקה.');
        addText(pg, polys, panels);
        return { kind: 'page', page: pg, items: made, failed: panels.length - made.length };
      });
    });
  }

  /* בועות דיבור וכיתובים בעברית, בכל פאנל במקום משלו */
  function addText(pg, polys, panels) {
    panels.forEach(function (p, i) {
      var b = PG.bbox(polys[i]), pad = pg.w * 0.012;
      if (p.caption) {
        var c = PG.newItem('caption', pg);
        c.text = p.caption;
        c.w = Math.min(b.w * 0.8, pg.w * 0.42); c.h = Math.max(pg.w * 0.05, c.w * 0.2);
        c.x = b.x + b.w - c.w - pad; c.y = b.y + pad;
        c.size = Math.round(pg.w * 0.022);
        pg.items.push(c);
      }
      if (p.speech) {
        var s = PG.newItem('speech', pg);
        s.text = p.speech;
        s.w = Math.min(b.w * 0.62, pg.w * 0.36); s.h = s.w * 0.52;
        s.x = b.x + pad; s.y = p.caption ? b.y + b.h * 0.3 : b.y + pad;
        if (s.y + s.h > b.y + b.h - pad) s.y = b.y + pad;
        s.tx = s.x + s.w * 0.65; s.ty = Math.min(b.y + b.h - pad, s.y + s.h * 1.5);
        s.size = Math.round(pg.w * 0.028);
        pg.items.push(s);
      }
    });
  }

  /* בדיקת מערכת: האם שירות הציור החינמי עונה מהמכשיר הזה (תמונה זעירה) */
  function ping() {
    var t0 = Date.now();
    return fetch(POL_IMG + encodeURIComponent('a red circle') + '?width=64&height=64&nologo=true&seed=1', { signal: timeout(45000) })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
      .then(function (b) { if (!/^image\//.test(b.type)) throw new Error('לא תמונה'); return { ok: true, ms: Date.now() - t0 }; })
      .catch(function (e) { return { ok: false, why: e.name === 'AbortError' ? 'לא ענה תוך 45 שניות' : e.message }; });
  }

  window.ComicFree = { run: run, cancel: cancel, ping: ping };
})();
