/* Hero orbit: a living 3D globe behind the project count — a dotted sphere that
   turns, pulses ripple across it, comets arc over its surface and hundreds of
   particles with glowing trails circle it on tilted orbits. */
(function () {
  'use strict';
  var svg = document.getElementById('orbit-svg'), fig = document.getElementById('orbit');
  if (!svg || !fig) return;
  var cv = document.createElement('canvas'); cv.id = 'orbit-fx'; cv.setAttribute('aria-hidden', 'true');
  fig.insertBefore(cv, fig.firstChild);
  var cx = cv.getContext('2d'), TAU = Math.PI * 2, R = Math.random;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var VI = '#8b7bff', BR = '#e0b25a', MI = '#62dcb8', PK = '#f472b6';
  var w = 0, h = 0, s = 1, dpr = 1, mx = 0, my = 0, tx = 0, ty = 0, vis = true;

  function size() {
    var r = svg.getBoundingClientRect(); if (!r.width) return;
    dpr = Math.min(devicePixelRatio || 1, 2); w = r.width; h = r.height; s = w / 530;
    cv.style.height = h + 'px'; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  var mob = function () { return w < 380; };

  /* globe points (fibonacci sphere) */
  var N = 640, pts = [];
  for (var i = 0; i < N; i++) { var y = 1 - 2 * (i + .5) / N, r0 = Math.sqrt(1 - y * y), ph = i * 2.399963; pts.push([Math.cos(ph) * r0, y, Math.sin(ph) * r0, R()]); }

  /* orbiting particle rings: inclination, node, radius (in globe radii), speed */
  var rings = [
    { inc: .35, node: 0.2, rad: 1.55, sp: .55, n: 26, col: VI },
    { inc: 1.05, node: 1.4, rad: 1.8, sp: -.42, n: 30, col: BR },
    { inc: -.6, node: 2.6, rad: 2.05, sp: .33, n: 34, col: MI },
    { inc: 1.45, node: .6, rad: 1.35, sp: -.7, n: 20, col: PK },
    { inc: .1, node: 3.8, rad: 2.35, sp: .22, n: 40, col: VI },
    { inc: -1.1, node: 5.0, rad: 1.7, sp: .48, n: 24, col: MI }
  ];
  rings.forEach(function (rg) { rg.p = []; for (var k = 0; k < rg.n; k++) rg.p.push({ a: R() * TAU, v: .6 + R() * .8, z: .7 + R() * 1.3, c: rg.n > 30 || R() < .15 }); });

  var arcs = []; for (i = 0; i < 4; i++) arcs.push({ a0: R() * TAU, b0: R() * 2 - 1, a1: R() * TAU, b1: R() * 2 - 1, t: R(), v: .12 + R() * .1, col: i % 2 ? MI : BR });
  var pulses = [], nextPulse = 0;

  function glowDot(x, y, r, col, a) {
    var g = cx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    cx.globalAlpha = a; cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, r, 0, TAU); cx.fill(); cx.globalAlpha = 1;
  }

  var t0 = performance.now(), last = t0;
  function draw(now, dt) {
    var t = (now - t0) / 1000;
    tx += (mx - tx) * .05; ty += (my - ty) * .05;
    cx.clearRect(0, 0, w, h);
    var X0 = w / 2, Y0 = h / 2, G = 126 * s;                 // globe radius
    var rot = t * .22 + tx * .5, tilt = .38 + ty * .25;
    var cr = Math.cos(rot), sr = Math.sin(rot), ct = Math.cos(tilt), st = Math.sin(tilt);
    function P(x, y, z) {                                     // sphere space -> screen (+depth)
      var x1 = x * cr + z * sr, z1 = -x * sr + z * cr;
      var y1 = y * ct - z1 * st, z2 = y * st + z1 * ct;
      return [X0 + x1 * G, Y0 - y1 * G, z2];
    }
    function Q(x, y, z, k) {                                  // free orbit space (own tilt, no globe rotation)
      var y1 = y * ct - z * st, z2 = y * st + z * ct;
      return [X0 + x * G * k, Y0 - y1 * G * k, z2];
    }

    glowDot(X0, Y0, G * 2.3, VI, .28); glowDot(X0, Y0, G * 1.35, MI, .12);

    /* back half of the particle orbits */
    var front = [];
    rings.forEach(function (rg) {
      var ci = Math.cos(rg.inc), si = Math.sin(rg.inc), cn = Math.cos(rg.node), sn = Math.sin(rg.node);
      function O(a) { var x = Math.cos(a), z = Math.sin(a), y = z * si; z = z * ci; return [x * cn - z * sn, y, x * sn + z * cn]; }
      // faint ring path
      cx.strokeStyle = rg.col; cx.lineWidth = 1; cx.globalAlpha = .1; cx.beginPath();
      for (var a = 0; a <= TAU + .1; a += .12) { var o = O(a), q = Q(o[0], o[1], o[2], rg.rad); a ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1]); } cx.stroke(); cx.globalAlpha = 1;
      rg.p.forEach(function (p) {
        var ang = p.a + t * rg.sp * p.v, dir = rg.sp > 0 ? 1 : -1;
        var o = O(ang), q = Q(o[0], o[1], o[2], rg.rad);
        var d = (q[2] + rg.rad) / (2 * rg.rad);                // 0 back .. 1 front
        var item = { q: q, d: d, rg: rg, p: p, ang: ang, dir: dir, O: O };
        if (q[2] < 0) paint(item); else front.push(item);
      });
    });
    function paint(it) {
      var q = it.q, sz = (1 + it.d * 1.6) * it.p.z * s * 1.15, a = .25 + it.d * .75;
      if (it.p.c) {                                            // comet trail
        cx.lineCap = 'round'; cx.strokeStyle = it.rg.col;
        var prev = q;
        for (var j = 1; j <= 9; j++) {
          var o2 = it.O(it.ang - it.dir * j * .045), q2 = Q(o2[0], o2[1], o2[2], it.rg.rad);
          cx.globalAlpha = a * (1 - j / 10) * .8; cx.lineWidth = sz * (1 - j / 11) * 1.6;
          cx.beginPath(); cx.moveTo(prev[0], prev[1]); cx.lineTo(q2[0], q2[1]); cx.stroke(); prev = q2;
        }
        cx.globalAlpha = 1;
      }
      glowDot(q[0], q[1], sz * 4, it.rg.col, a * .55);
      cx.globalAlpha = a; cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(q[0], q[1], sz * .75, 0, TAU); cx.fill(); cx.globalAlpha = 1;
    }

    /* graticule */
    cx.lineWidth = 1; cx.strokeStyle = VI;
    for (var la = -60; la <= 60; la += 30) {
      var yy = Math.sin(la * Math.PI / 180), rr = Math.cos(la * Math.PI / 180);
      for (var pass = 0; pass < 2; pass++) {
        cx.beginPath(); var on = false;
        for (var lo = 0; lo <= TAU + .1; lo += .15) { var p = P(Math.cos(lo) * rr, yy, Math.sin(lo) * rr); var ok = pass ? p[2] >= 0 : p[2] < 0; if (!ok) { on = false; continue; } on ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1]); on = true; }
        cx.globalAlpha = pass ? .22 : .07; cx.stroke();
      }
    }
    cx.globalAlpha = 1;

    /* dotted globe */
    var sz = Math.max(1.6, 2.3 * s);
    for (i = 0; i < N; i++) {
      var pt = pts[i], p2 = P(pt[0], pt[1], pt[2]), fr = p2[2] >= 0;
      var tw = .6 + .4 * Math.sin(t * 1.6 + pt[3] * 40);
      cx.fillStyle = pt[1] > .55 ? BR : (pt[3] < .5 ? MI : VI);
      cx.globalAlpha = fr ? (.6 + .4 * p2[2]) * tw : .16;
      cx.fillRect(p2[0] - sz / 2, p2[1] - sz / 2, sz, sz);
    }
    cx.globalAlpha = 1;
    // rim light
    cx.strokeStyle = MI; cx.globalAlpha = .28; cx.lineWidth = 1.4; cx.beginPath(); cx.arc(X0, Y0, G, 0, TAU); cx.stroke(); cx.globalAlpha = 1;

    /* ripples that spread over the surface */
    if (t > nextPulse) { var la2 = Math.asin(R() * 1.6 - .8), lo2 = R() * TAU; pulses.push({ x: Math.cos(lo2) * Math.cos(la2), y: Math.sin(la2), z: Math.sin(lo2) * Math.cos(la2), t: t, c: R() < .5 ? MI : BR }); nextPulse = t + .7 + R() * .9; }
    pulses = pulses.filter(function (u) { return t - u.t < 2.4; });
    pulses.forEach(function (u) {
      var p = P(u.x, u.y, u.z); if (p[2] < .05) return; var k = (t - u.t) / 2.4;
      cx.strokeStyle = u.c; cx.lineWidth = 1.4; cx.globalAlpha = (1 - k) * .8 * p[2];
      cx.beginPath(); cx.ellipse(p[0], p[1], (4 + k * 34) * s, (4 + k * 34) * s * Math.max(.25, p[2]), 0, 0, TAU); cx.stroke();
      glowDot(p[0], p[1], 9 * s, u.c, (1 - k) * .9);
    });
    cx.globalAlpha = 1;

    /* comets flying along arcs over the surface */
    arcs.forEach(function (a) {
      a.t = (a.t + dt * a.v) % 1;
      function pos(u) {
        var lon = a.a0 + (a.a1 - a.a0) * u, lat = a.b0 + (a.b1 - a.b0) * u, cl = Math.sqrt(Math.max(0, 1 - lat * lat)), lift = 1 + Math.sin(u * Math.PI) * .32;
        return P(Math.cos(lon) * cl * lift, lat * lift, Math.sin(lon) * cl * lift);
      }
      cx.strokeStyle = a.col; cx.lineWidth = 1.3;
      for (var j = 0; j < 14; j++) {
        var u0 = a.t - j * .012, u1 = a.t - (j + 1) * .012; if (u1 < 0) break;
        var p0 = pos(u0), p1 = pos(u1); if (p0[2] < -.2 && p1[2] < -.2) continue;
        cx.globalAlpha = (1 - j / 14) * .9; cx.beginPath(); cx.moveTo(p0[0], p0[1]); cx.lineTo(p1[0], p1[1]); cx.stroke();
      }
      var hd = pos(a.t); if (hd[2] > -.2) glowDot(hd[0], hd[1], 12 * s, '#fff', .9);
    });
    cx.globalAlpha = 1;

    /* front half of the particle orbits (over the globe) */
    front.sort(function (a, b) { return a.q[2] - b.q[2]; }).forEach(paint);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!vis || !w) return;
    var dt = Math.min(.08, (now - last) / 1000); last = now; draw(now, dt);
  }
  size();
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(size).observe(svg); else addEventListener('resize', size);
  fig.addEventListener('pointermove', function (e) { var r = fig.getBoundingClientRect(); mx = ((e.clientX - r.left) / r.width - .5) * 2; my = ((e.clientY - r.top) / r.height - .5) * 2; });
  fig.addEventListener('pointerleave', function () { mx = my = 0; });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { vis = e[0].isIntersecting && !document.hidden; }).observe(fig);
  document.addEventListener('visibilitychange', function () { if (document.hidden) vis = false; });
  if (reduce) { requestAnimationFrame(function () { size(); draw(t0 + 4000, .03); }); }
  else requestAnimationFrame(frame);
})();
