/* שכבות — the animated opening scene and the drifting dust behind the menus. */
(function () {
  'use strict';
  const D = window.SHCHAVOT;

  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* ---------- hero ---------- */
  const cv = document.getElementById('hero-cv');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1, horizon = 0, ground = null, stars = [], motes = [], ridges = [], finds = [], running = false, px = 0, py = 0, tpx = 0, tpy = 0;
  const STRATA = ['#7a4a2a', '#a8683c', '#c9a46e', '#8a6a48', '#b8a98a', '#6e5e50', '#4a3e36'];
  const FIND_IDS = ['r_head', 's_shekel', 'o_dallah', 'b_amphora', 'k_ivory', 'c_sword', 'f_bulla', 'p_skull', 'r_helmet', 's_scroll', 'k_figurine', 'b_mosaic'];
  const imgs = {};
  FIND_IDS.forEach((id) => { const im = new Image(); im.src = D.svgUrl(D.BY_ID[id].svg); imgs[id] = im; });

  function ridge(R, base, amp, n) {
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push(base - amp * (0.35 + 0.65 * Math.abs(Math.sin(i * 0.9 + R() * 2)) * (0.6 + R() * 0.4)));
    return pts;
  }
  const waveY = (x, y0, k, amp) => y0 + Math.sin(x * 0.006 + k) * amp + Math.sin(x * 0.017 + k * 2.3) * amp * 0.45;

  function build() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = cv.getBoundingClientRect();
    W = Math.max(320, r.width); H = Math.max(480, r.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    horizon = H * 0.5;
    const R = rng(7);
    stars = Array.from({ length: Math.round((W * H) / 5200) }, () => ({ x: R() * W, y: R() * horizon * 0.85, r: 0.4 + R() * 1.3, p: R() * 6.28, s: 0.6 + R() * 2 }));
    ridges = [ridge(R, horizon - 6, H * 0.16, 14), ridge(R, horizon + 4, H * 0.1, 18), ridge(R, horizon + 12, H * 0.05, 24)];
    // the soil cross-section is painted once, then drawn each frame
    ground = document.createElement('canvas');
    ground.width = Math.round(W * dpr); ground.height = Math.round((H - horizon) * dpr);
    const g = ground.getContext('2d'); g.scale(dpr, dpr);
    const GH = H - horizon;
    const bands = STRATA.length;
    for (let i = 0; i < bands; i++) {
      const y0 = 14 + (i * (GH - 14)) / bands;
      g.fillStyle = STRATA[i];
      g.beginPath(); g.moveTo(0, GH);
      for (let x = 0; x <= W; x += 8) g.lineTo(x, i === 0 ? 10 : waveY(x, y0, i * 1.7, 7));
      g.lineTo(W, GH); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,240,210,.12)'; g.lineWidth = 1.5;
      g.beginPath(); for (let x = 0; x <= W; x += 8) { const y = i === 0 ? 10 : waveY(x, y0, i * 1.7, 7); x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    }
    for (let i = 0; i < (W * GH) / 60; i++) {
      g.fillStyle = R() < 0.5 ? 'rgba(255,235,200,.12)' : 'rgba(0,0,0,.22)';
      const s = 0.6 + R() * 2; g.fillRect(R() * W, 12 + R() * GH, s, s);
    }
    for (let i = 0; i < (W * GH) / 2600; i++) {
      const x = R() * W, y = 20 + R() * GH, rr = 1.5 + R() * 5;
      g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x + 1, y + 1.4, rr, rr * 0.7, 0, 0, 7); g.fill();
      g.fillStyle = R() < 0.5 ? '#cdb58e' : '#6e5a46'; g.beginPath(); g.ellipse(x, y, rr, rr * 0.7, 0, 0, 7); g.fill();
    }
    // grass lip and roots
    g.fillStyle = '#3f5a26'; g.fillRect(0, 0, W, 12);
    for (let x = 0; x < W; x += 3) { const h = 3 + R() * 9; g.fillStyle = R() < 0.5 ? '#5f8a36' : '#456a26'; g.fillRect(x, 10 - h, 1.8, h + 2); }
    g.strokeStyle = 'rgba(60,35,15,.55)'; g.lineWidth = 1.2;
    for (let i = 0; i < W / 40; i++) { let x = R() * W, y = 12; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (R() - 0.5) * 14; y += 4 + R() * 7; g.lineTo(x, y); } g.stroke(); }
    // finds sit in the deeper bands, away from the centre where the title is
    const RF = rng(11);
    finds = FIND_IDS.map((id, i) => {
      const f = D.BY_ID[id];
      const side = i % 2 ? 1 : -1;
      const x = W / 2 + side * (W * 0.16 + RF() * W * 0.32);
      const band = 1 + (i % (bands - 1));
      const y = horizon + 14 + ((band + 0.5) * (GH - 14)) / bands;
      const size = Math.min(W, 900) * (0.05 + RF() * 0.025) * (1 + 0.35 * (f.w * f.h > 2));
      return { id, x, y, size, rot: (RF() - 0.5) * 0.8, ph: RF() * 6, color: D.RARITY[f.rarity].color };
    }).filter((f) => f.x > 20 && f.x < W - 20);
    motes = Array.from({ length: 70 }, () => ({ x: R() * W, y: R() * H, v: 6 + R() * 18, r: 0.6 + R() * 2.2, p: R() * 6 }));
  }

  function drawRidge(pts, color, off) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(-40, horizon + 40);
    const step = (W + 80) / (pts.length - 1);
    for (let i = 0; i < pts.length; i++) {
      const x = -40 + i * step + off;
      if (i === 0) ctx.lineTo(x, pts[i]); else { const xp = -40 + (i - 1) * step + off; ctx.quadraticCurveTo(xp + step / 2, (pts[i - 1] + pts[i]) / 2 - 6, x, pts[i]); }
    }
    ctx.lineTo(W + 80, horizon + 40); ctx.closePath(); ctx.fill();
  }

  function frame(now) {
    if (!running) return;
    const t = now / 1000;
    px += (tpx - px) * 0.05; py += (tpy - py) * 0.05;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#120a26'); sky.addColorStop(0.45, '#4a2050'); sky.addColorStop(0.78, '#c4564a'); sky.addColorStop(1, '#f8a85a');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, horizon + 2);
    for (const s of stars) { ctx.globalAlpha = (0.35 + 0.65 * Math.abs(Math.sin(t * s.s * 0.5 + s.p))) * (1 - s.y / horizon); ctx.fillStyle = '#fff'; ctx.fillRect(s.x, s.y, s.r, s.r); }
    ctx.globalAlpha = 1;
    // sun with a slow breathing glow
    const sx = W * 0.5 + px * 10, sy = horizon - H * 0.04;
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, H * 0.55);
    glow.addColorStop(0, 'rgba(255,236,170,.95)'); glow.addColorStop(0.08, 'rgba(255,190,110,.75)'); glow.addColorStop(0.3, 'rgba(240,120,80,.25)'); glow.addColorStop(1, 'rgba(240,120,80,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, horizon + 2);
    ctx.fillStyle = '#fff2c4'; ctx.beginPath(); ctx.arc(sx, sy, H * (0.06 + 0.003 * Math.sin(t)), 0, 7); ctx.fill();
    // light rays
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.32 + Math.sin(t * 0.2 + i) * 0.04;
      ctx.fillStyle = `rgba(255,200,130,${0.035 + 0.02 * Math.sin(t * 0.7 + i)})`;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(a - 0.06) * H, sy + Math.sin(a - 0.06) * H); ctx.lineTo(sx + Math.cos(a + 0.06) * H, sy + Math.sin(a + 0.06) * H); ctx.fill();
    }
    ctx.restore();
    drawRidge(ridges[0], '#5a2a4e', px * -12 + Math.sin(t * 0.05) * 6);
    drawRidge(ridges[1], '#3a1c34', px * -22);
    drawRidge(ridges[2], '#24131e', px * -34);
    // ground
    ctx.drawImage(ground, 0, horizon, W, H - horizon);
    ctx.save(); ctx.translate(0, py * 4);
    for (const f of finds) {
      const im = imgs[f.id]; if (!im.complete) continue;
      const pulse = 0.5 + 0.5 * Math.sin(t * 1.6 + f.ph);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const hg = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.size * 1.4);
      hg.addColorStop(0, f.color + '66'); hg.addColorStop(1, f.color + '00');
      ctx.globalAlpha = 0.5 + pulse * 0.5; ctx.fillStyle = hg; ctx.fillRect(f.x - f.size * 1.5, f.y - f.size * 1.5, f.size * 3, f.size * 3);
      ctx.restore();
      const ar = im.width && im.height ? im.width / im.height : 1;
      const w = ar >= 1 ? f.size : f.size * ar, h = ar >= 1 ? f.size / ar : f.size;
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
      ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
      ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore();
      if (Math.random() < 0.025) motes.push({ x: f.x + (Math.random() - 0.5) * f.size, y: f.y, v: 20 + Math.random() * 20, r: 1.5 + Math.random() * 1.5, p: 0, spark: f.color, life: 1 });
    }
    ctx.restore();
    // depth shading + vignette
    const dg = ctx.createLinearGradient(0, horizon, 0, H);
    dg.addColorStop(0, 'rgba(0,0,0,0)'); dg.addColorStop(1, 'rgba(10,5,2,.55)');
    ctx.fillStyle = dg; ctx.fillRect(0, horizon, W, H - horizon);
    const vg = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.25, W / 2, H * 0.5, Math.max(W, H) * 0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    // floating dust and sparks
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    motes = motes.filter((m) => m.life === undefined || (m.life -= 0.012) > 0);
    for (const m of motes) {
      m.y -= m.v * 0.016; m.x += Math.sin(t + m.p) * 0.3;
      if (m.y < -5 && m.life === undefined) { m.y = H + 5; m.x = Math.random() * W; }
      ctx.globalAlpha = m.life !== undefined ? m.life : 0.35 + 0.3 * Math.sin(t * 2 + m.p);
      ctx.fillStyle = m.spark || '#ffd9a0';
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 7); ctx.fill();
    }
    ctx.restore();
    requestAnimationFrame(frame);
  }

  window.addEventListener('pointermove', (e) => { tpx = e.clientX / window.innerWidth - 0.5; tpy = e.clientY / window.innerHeight - 0.5; });
  window.addEventListener('resize', () => { if (running) build(); });

  /* ---------- dust behind the menus ---------- */
  const bg = document.getElementById('bg-cv');
  const bctx = bg.getContext('2d');
  let bRun = false, bdots = [];
  function bgBuild() {
    const d = Math.min(2, window.devicePixelRatio || 1);
    bg.width = window.innerWidth * d; bg.height = window.innerHeight * d;
    bctx.setTransform(d, 0, 0, d, 0, 0);
    bdots = Array.from({ length: 46 }, () => ({ x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight, v: 4 + Math.random() * 10, r: 0.6 + Math.random() * 2, p: Math.random() * 6 }));
  }
  function bgFrame(now) {
    if (!bRun) return;
    const t = now / 1000;
    bctx.clearRect(0, 0, bg.width, bg.height);
    bctx.globalCompositeOperation = 'lighter';
    for (const m of bdots) {
      m.y -= m.v * 0.016; m.x += Math.sin(t * 0.6 + m.p) * 0.25;
      if (m.y < -5) { m.y = window.innerHeight + 5; m.x = Math.random() * window.innerWidth; }
      bctx.globalAlpha = 0.25 + 0.25 * Math.sin(t * 1.5 + m.p);
      bctx.fillStyle = '#ffcf8a'; bctx.beginPath(); bctx.arc(m.x, m.y, m.r, 0, 7); bctx.fill();
    }
    bctx.globalAlpha = 1; bctx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(bgFrame);
  }
  window.addEventListener('resize', () => { if (bRun) bgBuild(); });

  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.SHCHAVOT_HERO = {
    start() { if (running) return; running = true; build(); requestAnimationFrame(frame); },
    stop() { running = false; },
    bg(on) {
      if (on && !bRun && !reduce) { bRun = true; bgBuild(); requestAnimationFrame(bgFrame); }
      if (!on) { bRun = false; bctx.clearRect(0, 0, bg.width, bg.height); }
    },
  };
})();
