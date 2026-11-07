/* Games played with your own photos: design roulette, sliding puzzle, scratch card, guess the filter, sticker rain, memory. */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$, S = FS.state;
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function clone(p) { return { src: p.src, name: p.name, doc: JSON.parse(JSON.stringify(p.doc)), cache: {}, mask: p.mask, maskV: p.maskV }; }
  function preview(p, size) { var d = p.doc, k = size / Math.max(d.w, d.h), c = FS.canvas(d.w * k, d.h * k); FS.draw(c.getContext('2d'), p, { scale: k, max: size * 1.4, fast: true }); return c; }
  function needPhoto() { if (!FS.cur()) { FS.toast('בוחרים תמונה קודם, ואז משחקים איתה'); return false; } return true; }
  var COLORS = ['#c9a14a', '#ff4f8b', '#35c8ff', '#1d2d6e', '#ffffff', '#111111', '#2fd38a', '#7b5cff', '#e8355a', '#f4efe6'];
  var STICK = ['✨', '⭐', '💖', '🎉', '🌸', '🦋', '👑', '🔥', '🌈', '🎈', '💫', '🥂'];
  var running = null;
  FS.on('dialog-closed', function () { if (running) { running(); running = null; } });

  function burst(host) { /* a little confetti over a box */
    var c = FS.canvas(host.clientWidth, host.clientHeight); c.className = 'burst'; host.appendChild(c);
    var x = c.getContext('2d'), parts = [], t0 = performance.now();
    for (var i = 0; i < 120; i++) parts.push({ x: c.width / 2, y: c.height / 2, vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 12 - 3, c: pick(COLORS), r: Math.random() * 6 });
    (function f(t) { x.clearRect(0, 0, c.width, c.height); parts.forEach(function (p) { p.x += p.vx; p.y += p.vy; p.vy += 0.35; x.fillStyle = p.c; x.fillRect(p.x, p.y, 7, 4); });
      if (t - t0 < 2200) requestAnimationFrame(f); else c.remove(); })(t0);
  }

  var GAMES = {
    roulette: function () {
      var base = FS.cur(), body = FS.dialog('🎰 רולטת עיצוב', '<div class="game-stage"><canvas id="g-c"></canvas></div><p class="hint center" id="g-msg">מגרילים מסגרת, פילטר ומדבקות…</p><div class="row2"><button class="btn primary" id="g-keep" disabled>✔ זה! להחיל על התמונה</button><button class="btn" id="g-spin" disabled>🎰 עוד סיבוב</button></div>');
      var cur = null, stop = false; running = function () { stop = true; };
      function roll() {
        var t = clone(base), f = pick(FS.GEN_FRAMES), pr = pick(FS.PRESETS);
        FS.setFrame(t, { kind: 'gen', id: f.id, color: Math.random() < 0.5 ? f.color : pick(COLORS), thick: 0.7 + Math.random() * 0.8, opacity: 1 }, { quiet: true });
        t.doc.photo.adj = FS.presetAdj(pr[2], 1); t.doc.layers = t.doc.layers.filter(function (L) { return L.frameText; });
        var n = Math.floor(Math.random() * 4), H = FS.hole(t.doc);
        for (var i = 0; i < n; i++) t.doc.layers.push({ id: FS.uid(), type: 'emoji', ch: pick(STICK), x: H.x + Math.random() * H.w, y: H.y + Math.random() * H.h * 0.35, size: Math.min(t.doc.w, t.doc.h) * (0.08 + Math.random() * 0.08), r: Math.round((Math.random() - 0.5) * 40), opacity: 1 });
        t.label = f.name + ' · ' + pr[1]; return t;
      }
      function spin() {
        $('#g-keep', body).disabled = $('#g-spin', body).disabled = true; var step = 0, steps = 12 + Math.floor(Math.random() * 6);
        (function next() {
          if (stop) return; cur = roll(); var c = preview(cur, 420), old = $('#g-c', body); c.id = 'g-c'; old.replaceWith(c);
          $('#g-msg', body).textContent = cur.label;
          if (++step < steps) setTimeout(next, 60 + step * step * 2.5);
          else { $('#g-keep', body).disabled = $('#g-spin', body).disabled = false; $('#g-msg', body).textContent = '🎉 יצא: ' + cur.label; burst($('.game-stage', body)); }
        })();
      }
      $('#g-spin', body).addEventListener('click', spin);
      $('#g-keep', body).addEventListener('click', function () { base.doc = cur.doc; FS.snap(base); FS.emit('doc'); FS.closeDialog(); FS.toast('העיצוב הוחל. ↶ מבטל.'); });
      spin();
    },

    puzzle: function () {
      var body = FS.dialog('🧩 פאזל הזזה', '<div class="inline center"><label>גודל <select id="g-n"><option value="3">3×3 קל</option><option value="4">4×4 בינוני</option><option value="5">5×5 קשה</option></select></label><span id="g-stat" class="stat"></span></div><div class="game-stage"><div class="puzzle" id="g-p"></div></div><div class="row2"><button class="btn" id="g-new">🔀 ערבוב</button><button class="btn" id="g-peek">👁 הצצה</button></div>');
      var src = preview(FS.cur(), 480), url = src.toDataURL('image/jpeg', 0.9), n = 3, tiles, moves, t0, timer;
      running = function () { clearInterval(timer); };
      function draw() {
        var box = $('#g-p', body), W = Math.min(420, window.innerWidth - 60), H = W * src.height / src.width;
        box.style.width = W + 'px'; box.style.height = H + 'px'; box.innerHTML = '';
        tiles.forEach(function (v, i) {
          if (v === n * n - 1) return;
          var b = document.createElement('button'); b.className = 'pz';
          Object.assign(b.style, { width: W / n + 'px', height: H / n + 'px', left: (i % n) * W / n + 'px', top: Math.floor(i / n) * H / n + 'px', backgroundImage: 'url(' + url + ')', backgroundSize: W + 'px ' + H + 'px', backgroundPosition: -(v % n) * W / n + 'px ' + -Math.floor(v / n) * H / n + 'px' });
          b.addEventListener('click', function () { move(i); }); box.appendChild(b);
        });
        $('#g-stat', body).textContent = moves + ' מהלכים · ' + Math.round((Date.now() - t0) / 1000) + ' שניות';
      }
      function move(i) {
        var e = tiles.indexOf(n * n - 1), r = Math.floor(i / n), c = i % n, er = Math.floor(e / n), ec = e % n;
        if (Math.abs(r - er) + Math.abs(c - ec) !== 1) return;
        tiles[e] = tiles[i]; tiles[i] = n * n - 1; moves++; draw();
        if (tiles.every(function (v, k) { return v === k; })) { clearInterval(timer); $('#g-stat', body).textContent = '🏆 נפתר ב־' + moves + ' מהלכים ו־' + Math.round((Date.now() - t0) / 1000) + ' שניות!'; burst($('.game-stage', body)); }
      }
      function shuffle() {
        n = Number($('#g-n', body).value); tiles = []; for (var i = 0; i < n * n; i++) tiles.push(i);
        var e = n * n - 1, last = -1;
        for (var k = 0; k < n * n * 40; k++) { var opts = [e - n, e + n, e % n ? e - 1 : -1, e % n < n - 1 ? e + 1 : -1].filter(function (q) { return q >= 0 && q < n * n && q !== last; }); var q = pick(opts); tiles[e] = tiles[q]; tiles[q] = n * n - 1; last = e; e = q; }
        moves = 0; t0 = Date.now(); clearInterval(timer); timer = setInterval(function () { if (moves >= 0) $('#g-stat', body).textContent = moves + ' מהלכים · ' + Math.round((Date.now() - t0) / 1000) + ' שניות'; }, 1000); draw();
      }
      $('#g-new', body).addEventListener('click', shuffle); $('#g-n', body).addEventListener('change', shuffle);
      $('#g-peek', body).addEventListener('pointerdown', function () { $('#g-p', body).style.backgroundImage = 'url(' + url + ')'; $('#g-p', body).classList.add('peek'); });
      ['pointerup', 'pointerleave'].forEach(function (ev) { $('#g-peek', body).addEventListener(ev, function () { $('#g-p', body).classList.remove('peek'); $('#g-p', body).style.backgroundImage = ''; }); });
      shuffle();
    },

    scratch: function () {
      var p = FS.cur(), after = preview(p, 460);
      var t = clone(p); t.doc.photo.adj = Object.assign({}, FS.ADJ0); t.doc.frame = null; t.doc.layers = []; t.doc.photo.bg = { mode: 'none' }; t.doc.photo.blurs = [];
      FS.fitPhoto(t.doc, FS.img(t.src)); var before = preview(t, 460);
      var body = FS.dialog('🪄 כרטיס גירוד', '<p class="hint center">מגרדים עם העכבר או האצבע ומגלים את התמונה הערוכה מתחת למקור</p><div class="game-stage"><div class="scratch" id="g-s"></div></div><p class="center stat" id="g-pct">0%</p>');
      var box = $('#g-s', body); box.style.width = after.width + 'px'; box.style.height = after.height + 'px'; box.style.maxWidth = '100%';
      after.className = 'under'; box.appendChild(after); before.className = 'over'; box.appendChild(before);
      var x = before.getContext('2d'), down = false, done = false;
      function sc(e) { var r = before.getBoundingClientRect(); x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc((e.clientX - r.left) / r.width * before.width, (e.clientY - r.top) / r.height * before.height, before.width * 0.06, 0, 7); x.fill(); }
      before.addEventListener('pointerdown', function (e) { down = true; before.setPointerCapture(e.pointerId); sc(e); });
      before.addEventListener('pointermove', function (e) { if (down) sc(e); });
      before.addEventListener('pointerup', function () { down = false;
        var d = x.getImageData(0, 0, before.width, before.height).data, clear = 0; for (var i = 3; i < d.length; i += 64) if (d[i] < 20) clear++;
        var pct = Math.round(clear / (d.length / 64) * 100); $('#g-pct', body).textContent = pct + '% נחשף';
        if (pct > 70 && !done) { done = true; before.style.transition = 'opacity .6s'; before.style.opacity = 0; $('#g-pct', body).textContent = '✨ הנה העריכה שלך!'; burst($('.game-stage', body)); } });
    },

    guess: function () {
      var p = FS.cur(), round = 0, score = 0, body = FS.dialog('🎯 נחשו את הפילטר', '<p class="center stat" id="g-sc"></p><div class="game-stage"><canvas id="g-c"></canvas></div><div class="answers" id="g-a"></div>');
      var pool = FS.PRESETS.filter(function (q) { return q[0] !== 'original'; });
      function next() {
        if (round >= 6) { $('#g-sc', body).textContent = '🏁 ' + score + ' מתוך 6 · ' + (score >= 5 ? 'עין של צלם מקצועי! 🏆' : score >= 3 ? 'לא רע בכלל 👏' : 'עוד קצת אימון 📸'); $('#g-a', body).innerHTML = '<button class="btn primary" id="g-again">עוד משחק</button>'; $('#g-again', body).addEventListener('click', function () { round = score = 0; next(); }); if (score >= 5) burst($('.game-stage', body)); return; }
        round++; var ans = pick(pool), opts = [ans]; while (opts.length < 3) { var o = pick(pool); if (opts.indexOf(o) < 0) opts.push(o); } opts.sort(function () { return Math.random() - 0.5; });
        var c = FS.presetThumb(p, FS.presetAdj(ans[2], 1)), big = FS.canvas(c.width * 2.6, c.height * 2.6); big.getContext('2d').drawImage(c, 0, 0, big.width, big.height); big.id = 'g-c'; $('#g-c', body).replaceWith(big);
        $('#g-sc', body).textContent = 'סיבוב ' + round + ' מתוך 6 · נקודות: ' + score;
        $('#g-a', body).innerHTML = opts.map(function (o) { return '<button class="btn" data-id="' + o[0] + '">' + o[1] + '</button>'; }).join('');
        $$('#g-a [data-id]', body).forEach(function (b) { b.addEventListener('click', function () {
          var ok = b.dataset.id === ans[0]; if (ok) score++; b.classList.add(ok ? 'good' : 'bad');
          if (!ok) $('#g-a [data-id="' + ans[0] + '"]', body).classList.add('good');
          $$('#g-a button', body).forEach(function (x) { x.disabled = true; }); setTimeout(next, 900); }); });
      }
      next();
    },

    confetti: function () {
      var base = FS.cur(), body = FS.dialog('🎉 גשם מדבקות', '<div class="chips center" id="g-set"><button data-s="love" class="on">💖 אהבה</button><button data-s="party">🎉 מסיבה</button><button data-s="nature">🌸 טבע</button><button data-s="stars">⭐ כוכבים</button></div><div class="game-stage"><canvas id="g-c"></canvas></div><div class="row2"><button class="btn" id="g-go">🌧️ להמטיר!</button><button class="btn primary" id="g-keep" disabled>✔ להשאיר על התמונה</button></div>');
      var SETS = { love: ['💖', '❤️', '💕', '🌹', '💋'], party: ['🎉', '🎈', '🥳', '🎊', '🍾', '✨'], nature: ['🌸', '🦋', '🌿', '🌼', '🍃'], stars: ['⭐', '✨', '🌟', '💫'] }, set = 'love';
      var bg = preview(base, 420), c = $('#g-c', body); c.width = bg.width; c.height = bg.height; var x = c.getContext('2d'); x.drawImage(bg, 0, 0);
      var drops = [], anim = 0; running = function () { cancelAnimationFrame(anim); };
      $$('#g-set [data-s]', body).forEach(function (b) { b.addEventListener('click', function () { set = b.dataset.s; $$('#g-set button', body).forEach(function (q) { q.classList.toggle('on', q === b); }); }); });
      $('#g-go', body).addEventListener('click', function () {
        drops = []; for (var i = 0; i < 18; i++) drops.push({ ch: pick(SETS[set]), x: Math.random() * c.width, y: -Math.random() * c.height, end: c.height * (0.05 + Math.random() * 0.9), v: 2 + Math.random() * 3, s: 18 + Math.random() * 26, r: (Math.random() - 0.5) * 0.8, w: Math.random() * 6 });
        $('#g-keep', body).disabled = true; cancelAnimationFrame(anim);
        (function f() { x.drawImage(bg, 0, 0); var moving = false;
          drops.forEach(function (d) { if (d.y < d.end) { d.y += d.v; d.v += 0.12; d.w += 0.08; moving = true; } else d.y = d.end; x.save(); x.translate(d.x + Math.sin(d.w) * 6, d.y); x.rotate(d.r); x.font = d.s + 'px sans-serif'; x.textAlign = 'center'; x.fillText(d.ch, 0, 0); x.restore(); });
          if (moving) anim = requestAnimationFrame(f); else $('#g-keep', body).disabled = false; })();
      });
      $('#g-keep', body).addEventListener('click', function () {
        var k = base.doc.w / c.width; drops.forEach(function (d) { base.doc.layers.push({ id: FS.uid(), type: 'emoji', ch: d.ch, x: (d.x + Math.sin(d.w) * 6) * k, y: d.y * k, size: d.s * k * 1.1, r: Math.round(d.r * 57), opacity: 1 }); });
        FS.snap(base); FS.emit('doc'); FS.closeDialog(); FS.toast('המדבקות על התמונה. אפשר להזיז כל אחת.');
      });
    },

    memory: function () {
      var cards = [], faces = S.photos.slice(0, 6).map(function (p) { return preview(p, 160).toDataURL('image/jpeg', 0.8); });
      var p = FS.cur(), i = 0; while (faces.length < 6) { faces.push(FS.presetThumb(p, FS.presetAdj(FS.PRESETS[(i++ * 3 + 1) % FS.PRESETS.length][2], 1)).toDataURL('image/jpeg', 0.8)); }
      faces.forEach(function (u, k) { cards.push(k, k); }); cards.sort(function () { return Math.random() - 0.5; });
      var body = FS.dialog('🃏 משחק זיכרון', '<p class="center stat" id="g-st">מוצאים את הזוגות</p><div class="game-stage"><div class="memory" id="g-m"></div></div>');
      var open = [], found = 0, tries = 0, lock = false;
      $('#g-m', body).innerHTML = cards.map(function (v, k) { return '<button class="card" data-k="' + k + '"><span class="back">📸</span><img src="' + faces[v] + '" alt=""></button>'; }).join('');
      $$('#g-m .card', body).forEach(function (b) { b.addEventListener('click', function () {
        if (lock || b.classList.contains('up')) return; b.classList.add('up'); open.push(b);
        if (open.length === 2) { tries++; lock = true; var a = cards[open[0].dataset.k], c = cards[open[1].dataset.k];
          setTimeout(function () { if (a === c) { open.forEach(function (q) { q.classList.add('done'); }); found++; } else open.forEach(function (q) { q.classList.remove('up'); });
            open = []; lock = false; $('#g-st', body).textContent = found === 6 ? '🏆 כל הזוגות ב־' + tries + ' ניסיונות!' : found + ' זוגות · ' + tries + ' ניסיונות'; if (found === 6) burst($('.game-stage', body)); }, a === c ? 300 : 800); }
      }); });
    }
  };
  $$('[data-game]').forEach(function (b) { b.addEventListener('click', function () { if (b.dataset.game !== 'memory' && !needPhoto()) return; if (b.dataset.game === 'memory' && !needPhoto()) return; GAMES[b.dataset.game](); }); });
})();
