/* SPIDER · future layer — a different hi-tech landscape on every visit.
   Fixed canvas behind the page (never blocks taps), 8 procedural scenes,
   quiet on reduced-motion / data-saver / low-power, one tap to change scene. */
(function () {
  'use strict';
  if (window.__spiderFuture) return; window.__spiderFuture = 1;
  var doc = document, root = doc.documentElement;
  var lite = matchMedia('(prefers-reduced-motion: reduce)').matches ||
    (navigator.connection && navigator.connection.saveData) ||
    (navigator.deviceMemory && navigator.deviceMemory < 2);
  var TAU = Math.PI * 2, R = Math.random;
  function rnd(a, b) { return a + R() * (b - a); }

  var SCENES = [
    { id: 'city', he: 'עיר ניאון', a: '#22d3ee', b: '#e879f9' },
    { id: 'grid', he: 'שמש סינת׳', a: '#f472b6', b: '#fbbf24' },
    { id: 'aurora', he: 'זוהר צפוני', a: '#34d399', b: '#818cf8' },
    { id: 'orbit', he: 'תחנת מסלול', a: '#60a5fa', b: '#f0abfc' },
    { id: 'globe', he: 'כדור נתונים', a: '#2dd4bf', b: '#38bdf8' },
    { id: 'circuit', he: 'לוח מעגלים', a: '#a3e635', b: '#22d3ee' },
    { id: 'quantum', he: 'שדה קוונטי', a: '#c084fc', b: '#67e8f9' },
    { id: 'rain', he: 'גשם דיגיטלי', a: '#4ade80', b: '#22d3ee' }
  ];
  var pick;
  try {
    var q = /[?&]scene=(\w+)/.exec(location.search);
    var last = +sessionStorage.getItem('spider-scene-i');
    pick = q ? SCENES.findIndex(function (s) { return s.id === q[1]; }) : -1;
    if (pick < 0) { do { pick = Math.floor(R() * SCENES.length); } while (pick === last && SCENES.length > 1); }
  } catch (e) { pick = Math.floor(R() * SCENES.length); }

  var cv = doc.createElement('canvas'), cx = cv.getContext('2d');
  cv.id = 'future-bg'; cv.setAttribute('aria-hidden', 'true');
  var W = 0, H = 0, dpr = 1, S = null, st = {}, t0 = performance.now(), raf = 0, visible = true;

  function size() {
    dpr = Math.min(devicePixelRatio || 1, W0() < 700 ? 1.5 : 1.25);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    init();
  }
  function W0() { return innerWidth; }
  var mobile = function () { return W < 700; };

  /* ---------- scene state ---------- */
  function init() {
    st = {};
    var n = mobile() ? 0.55 : 1;
    switch (S.id) {
      case 'city':
        st.layers = [0, 1, 2].map(function (l) {
          var arr = [], x = -40, h0 = [0.18, 0.28, 0.4][l];
          while (x < W + 200) {
            var w = rnd(30, 70) * (1 + l * 0.35), h = rnd(0.35, 1) * H * h0 + 30;
            var wins = []; for (var k = 0; k < w * h / 260; k++) wins.push([rnd(4, w - 6), rnd(6, h - 6), R() < 0.5 ? 0 : 1, R() * TAU]);
            arr.push({ x: x, w: w, h: h, wins: wins, ant: R() < 0.3 }); x += w + rnd(0, 6);
          } return arr;
        });
        st.stars = stars(60 * n); break;
      case 'aurora': st.stars = stars(120 * n); break;
      case 'orbit': st.stars = stars(140 * n); st.sats = [0, 1, 2, 3].map(function (i) { return { r: rnd(0.55, 1.1), p: R() * TAU, s: rnd(0.15, 0.4) * (R() < .5 ? -1 : 1), z: rnd(2, 4) }; }); break;
      case 'globe':
        st.pts = []; var N = Math.round(520 * n);
        for (var i = 0; i < N; i++) { var y = 1 - 2 * (i + .5) / N, r = Math.sqrt(1 - y * y), ph = i * 2.399963; st.pts.push([Math.cos(ph) * r, y, Math.sin(ph) * r]); }
        st.arcs = []; for (i = 0; i < 7; i++) st.arcs.push([R() * TAU, rnd(-1, 1), R() * TAU, rnd(-1, 1), R()]);
        st.stars = stars(70 * n); break;
      case 'circuit':
        st.tr = []; var cols = Math.ceil(W / 26), rows = Math.ceil(H / 26), cnt = Math.round(46 * n);
        for (i = 0; i < cnt; i++) {
          var gx = Math.floor(R() * cols), gy = Math.floor(R() * rows), pts = [[gx, gy]], dx = R() < .5 ? 1 : -1, dy = 0;
          for (var s = 0; s < rnd(6, 16); s++) {
            if (R() < .45) { var tmp = dx; dx = dy || (R() < .5 ? 1 : -1); dy = tmp ? 0 : (R() < .5 ? 1 : -1); if (dx && dy) dy = 0; if (!dx && !dy) dx = 1; }
            var L = Math.floor(rnd(1, 5)); gx += dx * L; gy += dy * L; pts.push([gx, gy]);
          } st.tr.push({ pts: pts, ph: R(), sp: rnd(.08, .22) });
        } break;
      case 'quantum':
        st.p = []; var P = Math.round(Math.min(120, W * H / 5500) * n * 1.2);
        for (i = 0; i < P; i++) st.p.push({ x: R() * W, y: R() * H, vx: rnd(-.3, .3), vy: rnd(-.3, .3), r: rnd(1, 2.4) }); break;
      case 'rain':
        var cw = mobile() ? 16 : 20; st.cw = cw; st.d = [];
        for (i = 0; i < Math.ceil(W / cw); i++) st.d.push({ y: R() * H, v: rnd(40, 140), l: Math.floor(rnd(8, 22)), g: [] });
        break;
    }
  }
  function stars(n) { var a = []; for (var i = 0; i < n; i++) a.push([R() * W, R() * H * .85, R() * 1.4 + .3, R() * TAU]); return a; }
  function drawStars(t, al) {
    cx.fillStyle = '#fff';
    st.stars.forEach(function (s) { cx.globalAlpha = al * (.35 + .65 * Math.abs(Math.sin(t * .8 + s[3]))); cx.fillRect(s[0], s[1], s[2], s[2]); });
    cx.globalAlpha = 1;
  }
  function sky(c0, c1) { var g = cx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, c0); g.addColorStop(1, c1); cx.fillStyle = g; cx.fillRect(0, 0, W, H); }
  function glow(x, y, r, col, a) { var g = cx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); cx.globalAlpha = a; cx.fillStyle = g; cx.fillRect(x - r, y - r, r * 2, r * 2); cx.globalAlpha = 1; }

  /* ---------- scenes ---------- */
  var draw = {
    city: function (t) {
      sky('#070a1c', '#2a1048'); drawStars(t, .6);
      glow(W * .72, H * .75, Math.max(W, H) * .6, S.b, .4); glow(W * .2, H * .85, Math.max(W, H) * .5, S.a, .3);
      st.layers.forEach(function (L, li) {
        var base = H, sp = (li + 1) * 6, off = (t * sp) % 160;
        cx.save(); cx.translate(-off, 0);
        L.forEach(function (b) {
          var shade = 14 + li * 7; cx.fillStyle = 'rgb(' + shade + ',' + (shade + 4) + ',' + (shade + 22) + ')';
          cx.fillRect(b.x, base - b.h, b.w, b.h);
          if (b.ant) { cx.fillRect(b.x + b.w / 2 - 1, base - b.h - 22, 2, 22); cx.fillStyle = '#ff3b6b'; cx.globalAlpha = .5 + .5 * Math.sin(t * 3 + b.x); cx.fillRect(b.x + b.w / 2 - 2, base - b.h - 24, 4, 4); cx.globalAlpha = 1; }
          b.wins.forEach(function (w) {
            var on = Math.sin(t * .4 + w[3] * 3) > -.2;
            if (!on) return; cx.fillStyle = w[2] ? S.a : S.b; cx.globalAlpha = .55 + li * .22; cx.fillRect(b.x + w[0], base - b.h + w[1], 3, 4);
          }); cx.globalAlpha = 1;
        });
        cx.restore();
      });
    },
    grid: function (t) {
      sky('#12062b', '#3b0d4f'); var hy = H * .58;
      var sg = cx.createLinearGradient(0, hy - H * .3, 0, hy); sg.addColorStop(0, S.b); sg.addColorStop(1, S.a);
      cx.save(); cx.beginPath(); cx.arc(W / 2, hy - H * .02, Math.min(W, H) * .24, Math.PI, 0); cx.closePath(); cx.clip();
      cx.fillStyle = sg; cx.globalAlpha = .9; cx.fillRect(0, 0, W, H);
      cx.globalAlpha = 1; cx.fillStyle = '#12062b';
      for (var i = 0; i < 7; i++) { var yy = hy - i * H * .028 - 6; cx.fillRect(0, yy, W, 1.5 + i * .9); }
      cx.restore();
      cx.fillStyle = '#0b0420'; cx.fillRect(0, hy, W, H - hy);
      cx.strokeStyle = S.a; cx.lineWidth = 1; cx.globalAlpha = .6;
      for (i = -14; i <= 14; i++) { cx.beginPath(); cx.moveTo(W / 2 + i * 12, hy); cx.lineTo(W / 2 + i * (mobile() ? 90 : 160), H); cx.stroke(); }
      var f = (t * .35) % 1;
      for (i = 0; i < 14; i++) { var z = (i + f) / 14, y = hy + (H - hy) * z * z; cx.globalAlpha = .15 + z * .6; cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke(); }
      cx.globalAlpha = 1; glow(W / 2, hy, W * .5, S.b, .18);
    },
    aurora: function (t) {
      sky('#030816', '#0a1633'); drawStars(t, .8);
      for (var k = 0; k < 3; k++) {
        cx.beginPath(); var base = H * (.22 + k * .1);
        for (var x = 0; x <= W + 14; x += 14) { var y = base + Math.sin(x * .004 + t * .25 + k * 2) * H * .06 + Math.sin(x * .011 - t * .4 + k) * H * .025; x ? cx.lineTo(x, y) : cx.moveTo(x, y); }
        cx.lineTo(W + 14, 0); cx.lineTo(0, 0); cx.closePath();
        var g = cx.createLinearGradient(0, 0, 0, base + H * .12); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.7, k % 2 ? S.b : S.a); g.addColorStop(1, 'rgba(0,0,0,0)');
        cx.globalAlpha = .5; cx.fillStyle = g; cx.fill();
      } cx.globalAlpha = 1;
      [[.12, '#08111f'], [.2, '#050b15']].forEach(function (L, li) {
        cx.fillStyle = L[1]; cx.beginPath(); cx.moveTo(0, H);
        for (var x = 0; x <= W + 40; x += 40) cx.lineTo(x, H - H * L[0] * (.6 + .4 * Math.abs(Math.sin(x * .007 * (li + 1.3) + li * 3))) - (li ? 0 : 20));
        cx.lineTo(W, H); cx.fill();
      });
    },
    orbit: function (t) {
      sky('#02030a', '#0a1030'); drawStars(t, .9);
      var R0 = Math.max(W * 1.15, H * 1.1), cxp = W * .5, cyp = H + R0 - H * .24;
      var g = cx.createRadialGradient(cxp, cyp, R0 * .93, cxp, cyp, R0 * 1.02); g.addColorStop(0, '#0b1a3a'); g.addColorStop(.9, S.a); g.addColorStop(1, 'rgba(0,0,0,0)');
      cx.globalAlpha = .9; cx.fillStyle = g; cx.beginPath(); cx.arc(cxp, cyp, R0 * 1.02, 0, TAU); cx.fill(); cx.globalAlpha = 1;
      var pg = cx.createRadialGradient(cxp, cyp - R0 * .9, R0 * .05, cxp, cyp, R0); pg.addColorStop(0, '#16306a'); pg.addColorStop(.35, '#0a1a40'); pg.addColorStop(1, '#040816'); cx.fillStyle = pg; cx.beginPath(); cx.arc(cxp, cyp, R0 * .985, 0, TAU); cx.fill();
      glow(cxp, H - H * .24, W * .7, S.a, .25);
      cx.strokeStyle = S.a; cx.globalAlpha = .12; cx.lineWidth = 1;
      st.sats.forEach(function (s) {
        var rr = R0 * (1.03 + s.r * .08); cx.globalAlpha = .14; cx.beginPath(); cx.arc(cxp, cyp, rr, Math.PI * 1.15, Math.PI * 1.85); cx.stroke();
        var a = Math.PI * 1.5 + Math.sin(t * s.s + s.p) * .3, x = cxp + Math.cos(a) * rr, y = cyp + Math.sin(a) * rr;
        cx.globalAlpha = 1; cx.fillStyle = '#fff'; cx.fillRect(x - s.z, y - 1, s.z * 2, 2); cx.fillStyle = S.b; cx.fillRect(x - 1, y - s.z, 2, s.z * 2);
        glow(x, y, 26, S.a, .55); cx.globalAlpha = .12;
      }); cx.globalAlpha = 1;
    },
    globe: function (t) {
      sky('#020a12', '#06182b'); drawStars(t, .5);
      var r = Math.min(W, H) * (mobile() ? .42 : .36), x0 = W / 2, y0 = H * (mobile() ? .38 : .5), rot = t * .25;
      glow(x0, y0, r * 1.7, S.a, .38); cx.strokeStyle = S.a; cx.globalAlpha = .35; cx.lineWidth = 1.5; cx.beginPath(); cx.arc(x0, y0, r * 1.02, 0, TAU); cx.stroke(); cx.globalAlpha = 1; var cs = Math.cos(rot), sn = Math.sin(rot);
      function proj(p) { var x = p[0] * cs - p[2] * sn, z = p[0] * sn + p[2] * cs; return [x0 + x * r, y0 - p[1] * r * .98, z]; }
      st.pts.forEach(function (p) { var q = proj(p); cx.globalAlpha = q[2] > 0 ? .95 : .25; cx.fillStyle = q[2] > 0 ? S.a : S.b; cx.fillRect(q[0], q[1], 2.2, 2.2); });
      cx.globalAlpha = 1; cx.lineWidth = 1.3;
      st.arcs.forEach(function (a) {
        var f = (t * .18 + a[4]) % 1; cx.strokeStyle = S.b; cx.beginPath(); var on = false;
        for (var i = 0; i <= 28; i++) {
          var u = i / 28, lon = a[0] + (a[2] - a[0]) * u, lat = a[1] + (a[3] - a[1]) * u, lift = 1 + Math.sin(u * Math.PI) * .22, cl = Math.sqrt(Math.max(0, 1 - lat * lat));
          var q = proj([Math.cos(lon) * cl * lift, lat * lift, Math.sin(lon) * cl * lift]);
          if (q[2] < -.1) { on = false; continue; } on ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1]); on = true;
        } cx.globalAlpha = .55; cx.stroke();
        var ul = a[0] + (a[2] - a[0]) * f, la = a[1] + (a[3] - a[1]) * f, lf = 1 + Math.sin(f * Math.PI) * .22, c2 = Math.sqrt(Math.max(0, 1 - la * la));
        var hd = proj([Math.cos(ul) * c2 * lf, la * lf, Math.sin(ul) * c2 * lf]); if (hd[2] > 0) glow(hd[0], hd[1], 16, '#fff', .8);
      }); cx.globalAlpha = 1;
    },
    circuit: function (t) {
      sky('#030b0c', '#06151a'); cx.lineCap = 'round'; cx.lineJoin = 'round';
      var G = 26; cx.fillStyle = S.a; cx.globalAlpha = .12;
      for (var x = 0; x < W; x += G) for (var y = 0; y < H; y += G) cx.fillRect(x, y, 1.5, 1.5);
      cx.lineWidth = 1.5;
      st.tr.forEach(function (tr) {
        cx.strokeStyle = S.a; cx.globalAlpha = .4; cx.beginPath();
        tr.pts.forEach(function (p, i) { i ? cx.lineTo(p[0] * G, p[1] * G) : cx.moveTo(p[0] * G, p[1] * G); }); cx.stroke();
        var e = tr.pts[tr.pts.length - 1]; cx.fillStyle = S.b; cx.globalAlpha = .5; cx.beginPath(); cx.arc(e[0] * G, e[1] * G, 3, 0, TAU); cx.fill();
        var len = 0, seg = []; for (var i = 1; i < tr.pts.length; i++) { var d = Math.abs(tr.pts[i][0] - tr.pts[i - 1][0]) + Math.abs(tr.pts[i][1] - tr.pts[i - 1][1]); seg.push(d); len += d; }
        var pos = ((t * tr.sp + tr.ph) % 1) * len, k = 0; while (k < seg.length - 1 && pos > seg[k]) { pos -= seg[k]; k++; }
        var a = tr.pts[k], b = tr.pts[k + 1], u = seg[k] ? pos / seg[k] : 0;
        if (b) glow((a[0] + (b[0] - a[0]) * u) * G, (a[1] + (b[1] - a[1]) * u) * G, 18, S.b, .9);
      }); cx.globalAlpha = 1;
    },
    quantum: function (t) {
      sky('#07041a', '#10072e'); var mx = W * (.5 + Math.sin(t * .2) * .25), my = H * (.5 + Math.cos(t * .17) * .25);
      glow(mx, my, Math.max(W, H) * .5, S.a, .14);
      var p = st.p, md = mobile() ? 110 : 160;
      p.forEach(function (a) { a.x += a.vx; a.y += a.vy; if (a.x < 0 || a.x > W) a.vx *= -1; if (a.y < 0 || a.y > H) a.vy *= -1; });
      cx.lineWidth = 1;
      for (var i = 0; i < p.length; i++) for (var j = i + 1; j < p.length; j++) {
        var dx = p[i].x - p[j].x, dy = p[i].y - p[j].y, d = dx * dx + dy * dy;
        if (d < md * md) { cx.strokeStyle = (i + j) % 2 ? S.a : S.b; cx.globalAlpha = (1 - Math.sqrt(d) / md) * .7; cx.beginPath(); cx.moveTo(p[i].x, p[i].y); cx.lineTo(p[j].x, p[j].y); cx.stroke(); }
      }
      cx.globalAlpha = 1; p.forEach(function (a, i) { cx.fillStyle = i % 2 ? S.a : S.b; cx.beginPath(); cx.arc(a.x, a.y, a.r, 0, TAU); cx.fill(); }); cx.globalAlpha = 1;
    },
    rain: function (t, dt) {
      cx.fillStyle = 'rgba(2,10,6,.18)'; if (!st.init) { sky('#020a06', '#03140c'); st.init = 1; } cx.fillRect(0, 0, W, H);
      cx.font = (st.cw - 4) + 'px monospace'; cx.textAlign = 'center';
      var ch = '01<>{}[]/=+*#$%ABCDEF';
      st.d.forEach(function (c, i) {
        c.y += c.v * dt; if (c.y > H + c.l * st.cw) { c.y = -R() * H * .4; c.v = rnd(40, 140); }
        for (var k = 0; k < c.l; k++) {
          var y = c.y - k * st.cw; if (y < 0 || y > H) continue;
          cx.globalAlpha = k ? Math.max(.05, .6 - k / c.l * .6) : 1; cx.fillStyle = k ? S.a : '#e8fff4';
          cx.fillText(ch[(Math.floor(t * 6) + i * 7 + k * 3) % ch.length], i * st.cw + st.cw / 2, y);
        }
      }); cx.globalAlpha = 1;
    }
  };

  /* ---------- run ---------- */
  var lastT = 0, acc = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible) return;
    var t = (now - t0) / 1000, dt = Math.min(.1, t - lastT); acc += dt; lastT = t;
    if (acc < 1 / 30) return; dt = acc; acc = 0;
    draw[S.id](t, dt);
  }
  function setScene(i, remember) {
    pick = (i + SCENES.length) % SCENES.length; S = SCENES[pick];
    root.style.setProperty('--fa', S.a); root.style.setProperty('--fb', S.b);
    root.setAttribute('data-scene', S.id);
    if (remember) try { sessionStorage.setItem('spider-scene-i', pick); } catch (e) {}
    cx.clearRect(0, 0, W, H); if (W) init();
    if (lite) { draw[S.id](6, .03); draw[S.id](6.1, .03); }
    var b = doc.getElementById('future-switch'); if (b) b.setAttribute('aria-label', 'החלף נוף · ' + S.he);
    var l = doc.getElementById('future-name'); if (l) { l.textContent = S.he; l.classList.remove('on'); void l.offsetWidth; l.classList.add('on'); }
  }

  function start() {
    var cs = getComputedStyle(doc.body), bg = cs.backgroundColor;
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(bg);
    if (!m || (m[4] !== undefined && +m[4] === 0)) { /* transparent body: leave as is */ }
    else if (0.299 * m[1] + 0.587 * m[2] + 0.114 * m[3] > 120) return; // light site — skip
    if (m && !(m[4] !== undefined && +m[4] === 0)) { root.style.backgroundColor = bg; doc.body.style.backgroundColor = 'transparent'; }
    root.classList.add('has-future');
    doc.body.insertBefore(cv, doc.body.firstChild);
    var veil = doc.createElement('div'); veil.id = 'future-veil'; veil.setAttribute('aria-hidden', 'true'); doc.body.insertBefore(veil, cv.nextSibling);
    var btn = doc.createElement('button'); btn.id = 'future-switch'; btn.type = 'button'; btn.innerHTML = '<span aria-hidden="true">◈</span><b id="future-name"></b>';
    btn.addEventListener('click', function () { setScene(pick + 1, true); });
    doc.body.appendChild(btn);
    S = SCENES[pick]; size(); setScene(pick, true);
    var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (innerWidth !== W || Math.abs(innerHeight - H) > 120) { size(); if (lite) draw[S.id](6, .03); } }, 200); });
    doc.addEventListener('visibilitychange', function () { visible = !doc.hidden; });
    if (!lite) raf = requestAnimationFrame(frame);
  }
  if (doc.body) start(); else doc.addEventListener('DOMContentLoaded', start);
})();
