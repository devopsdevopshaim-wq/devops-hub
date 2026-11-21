/* ✨ The first time the program opens: a short film. Gold light gathers out of the dark, a wedding magnet appears and the
   couple steps out of its frame in 3D (the living photo, with a person mask prepared in advance, so nothing has to load),
   the name is written in gold, and what the program does flies in, one after another. A click, Enter or Esc skips it; it
   shows once (FS.showWow() plays it again). With "reduce motion" the still version shows. */
(function () {
  'use strict';
  var FS = window.FS = window.FS || {}, MC = window.MagicCore, KEY = 'fs-wow-v1';
  function seen() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return true; } }
  function mark() { try { localStorage.setItem(KEY, '1'); } catch (e) { /* private mode */ } }
  var FEAT = [['🎨', 'עיצובי AI', 'עשרות סגנונות בלחיצה'], ['🧲', 'מגנט שמתעורר', 'סורקים, והתמונה חיה'], ['🪞', 'מראה קסם', 'האורחים בתוך המגנט'], ['⚡', '6 תמונות יחד', 'עריכה מהירה באמת'], ['🖨️', 'הדפסה בקליק', 'ישר למדפסת, בגודל מדויק']];

  function play(force) {
    if (!MC || document.getElementById('wow1')) return;
    if (!force && seen()) return;
    var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var box = document.createElement('div'); box.id = 'wow1'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'ברוכים הבאים לאופטימוס');
    box.innerHTML = '<canvas class="w1-cv" aria-hidden="true"></canvas><div class="w1-txt"><h1 class="w1-name">אופטימוס</h1><p class="w1-tag">התמונה שלכם. חיה.</p></div>' +
      '<ul class="w1-feat">' + FEAT.map(function (f, i) { return '<li style="--i:' + i + '"><i>' + f[0] + '</i><b>' + f[1] + '</b><small>' + f[2] + '</small></li>'; }).join('') + '</ul>' +
      '<button class="w1-go" type="button">✨ בואו נתחיל</button><button class="w1-skip" type="button">דילוג ←</button>';
    document.body.appendChild(box);
    var cv = box.querySelector('canvas'), ctx = cv.getContext('2d'), raf = 0, t0 = performance.now(), L = null, W = 0, H = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
    var sparks = Array.from({ length: 140 }, function () { var a = Math.random() * 6.283, r = 0.5 + Math.random() * 0.7; return { a: a, r: r, s: 0.6 + Math.random() * 1.6, z: Math.random() }; });
    function size() { W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    size(); window.addEventListener('resize', size);
    function load(u) { return new Promise(function (ok, no) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = no; i.src = u; }); }
    Promise.all([load('media/demo/couple.jpg'), load('media/demo/couple-mask.png')]).then(function (r) { L = MC.layers(r[0], r[1], 900); }).catch(function () { L = null; });
    var ease = function (x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
    function frame(now) {
      var t = (now - t0) / 1000; ctx.clearRect(0, 0, W, H);
      /* 1. the gold gathers (0 → 1.8 s), then a soft glow stays behind the magnet */
      var g = ease(t / 1.8), cx = W / 2, cy = H * 0.47;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      sparks.forEach(function (p) {
        var rr = (1 - g) * p.r * Math.max(W, H) * 0.7 + g * (40 + p.z * Math.min(W, H) * 0.28), a = p.a + t * 0.35 * p.s;
        var x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.8, al = t > 1.8 ? Math.max(0.15, 0.6 - (t - 1.8) * 0.2) : 0.7;
        ctx.fillStyle = 'rgba(243,221,166,' + al * (0.4 + p.z * 0.6) + ')'; ctx.beginPath(); ctx.arc(x, y, 0.8 + p.z * 2.2, 0, 6.29); ctx.fill();
      });
      ctx.restore();
      if (t > 1.6 && t < 2.2) { ctx.fillStyle = 'rgba(255,240,200,' + (1 - Math.abs(t - 1.9) / 0.3) * 0.5 + ')'; ctx.fillRect(0, 0, W, H); }
      /* 2. the magnet: a white frame with the couple; they step out of it */
      if (L && t > 1.7) {
        var appear = ease((t - 1.7) / 0.9), mh = Math.min(H * 0.43, 520), mw = mh * L.w / L.h, b = mw * 0.07;
        var fw = mw + b * 2, fh = mh + b * 2.8, fx = cx - fw / 2, fy = cy - fh / 2 + (1 - appear) * 40;
        ctx.save(); ctx.globalAlpha = appear;
        ctx.translate(cx, cy); ctx.rotate((1 - appear) * -0.08 + Math.sin(t * 0.6) * 0.01); ctx.translate(-cx, -cy);
        ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20; ctx.fillStyle = '#fbfaf6'; ctx.fillRect(fx, fy, fw, fh); ctx.shadowColor = 'transparent';
        var px = fx + b, py = fy + b, pop = t > 2.8 ? ease((t - 2.8) / 1.6) : 0, loop = t > 4.4 ? MC.swing(((t - 4.4) / 6) % 1) * 0.35 : 0, z = 1 + 0.16 * pop + 0.05 * loop;
        ctx.save(); ctx.beginPath(); ctx.rect(px, py, mw, mh); ctx.clip(); ctx.drawImage(L.bg, px, py, mw, mh);
        MC.dots(ctx, L.dots, mw, mh, (t / 6) % 1, false); ctx.restore();
        /* the couple, in front of the frame (over the top and the sides), larger as they come out */
        var ax = px + L.c.x * mw, ay = py + L.c.y * mh;
        ctx.save(); ctx.beginPath(); ctx.rect(fx - mw, fy - mh, fw + mw * 2, py + mh - (fy - mh)); ctx.clip();
        ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 30 * pop; ctx.shadowOffsetY = 12 * pop;
        ctx.translate(ax, ay - mh * 0.04 * pop); ctx.scale(z, z); ctx.translate(-ax, -ay); ctx.drawImage(L.person, px, py, mw, mh); ctx.restore();
        ctx.save(); ctx.translate(px, py); MC.sheen(ctx, mw, mh, ((t - 2) / 4) % 1); ctx.restore();
        ctx.fillStyle = '#8a6d36'; ctx.font = '700 ' + Math.round(b * 0.9) + 'px "Amatic SC", Heebo, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('נועה & דניאל', cx, fy + fh - b * 0.9);
        ctx.restore();
      }
      box.classList.toggle('s2', t > 3.2); box.classList.toggle('s3', t > 4.6); box.classList.toggle('s4', t > 7.2);
      raf = requestAnimationFrame(frame);
    }
    if (still) { box.classList.add('s2', 's3', 's4', 'still'); t0 = performance.now() - 6000; }
    raf = requestAnimationFrame(frame);
    function close() {
      if (box.classList.contains('out')) return; mark(); box.classList.add('out');
      setTimeout(function () { cancelAnimationFrame(raf); window.removeEventListener('resize', size); document.removeEventListener('keydown', key, true); box.remove(); }, 650);
    }
    function key(e) { if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); close(); } }
    document.addEventListener('keydown', key, true);
    box.querySelector('.w1-go').addEventListener('click', close); box.querySelector('.w1-skip').addEventListener('click', close);
  }
  FS.showWow = function () { play(true); };
  if (/[?&]skip\b/.test(location.search)) return;
  /* after the logo's opening (#op-splash, about 5 s) has gone, so the two never overlap */
  function whenFree(n) {
    var sp = document.getElementById('op-splash'), busy = sp && !sp.classList.contains('op-out') && getComputedStyle(sp).display !== 'none' && sp.isConnected;
    if (busy && n < 45) return setTimeout(function () { whenFree(n + 1); }, 200);
    play(false);
  }
  if (!seen()) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { whenFree(0); }); else whenFree(0); }
})();
