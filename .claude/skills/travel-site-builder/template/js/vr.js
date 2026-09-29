/* ===========================================================
   מסע — סיור תלת ממד (three.js)
   הדמיה ממוחשבת של סוגי לינה: צימר עם ג׳קוזי וגינה, חדר מלון עם מרפסת לים,
   דירת נופש בעיר, בקתה במדבר. הליכה בגוף ראשון, יום/שקיעה/לילה,
   מצב VR (WebXR) ותצוגת תמונות 360° שהמשתמש מעלה.
   נטען רק כשנכנסים לעמוד (vendor/three/three.min.js).
   =========================================================== */
(function () {
  'use strict';

  const PRESETS = {
    zimmer: { label: 'צימר עם ג׳קוזי וגינה', desc: 'בקתת עץ, מרפסת עם ג׳קוזי ופרגולה, גינה ירוקה ונוף הרים.' },
    hotel: { label: 'חדר מלון עם מרפסת לים', desc: 'סוויטה עם מיטה זוגית, פינת ישיבה ומרפסת מעל הבריכה והים.' },
    apartment: { label: 'דירת נופש בעיר', desc: 'סלון, מטבח פתוח, חדר שינה ומרפסת עם נוף לקו הרקיע.' },
    desert: { label: 'בקתה במדבר', desc: 'בקתה אבן וטיח, מרפסת עם ערסל ומדורה, דיונות ומצוקים. בלילה — שמיים זרועי כוכבים.' }
  };

  /* מספרים אקראיים קבועים — אותה סצנה בכל פעם */
  function rng(seed) { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function start(container, opts) {
    const T = window.THREE;
    if (!T) throw new Error('three.js not loaded');
    opts = opts || {};
    const res = [];                       // משאבים לשחרור
    const track = (x) => { res.push(x); return x; };
    const R = rng(7);

    /* ---------- רנדרר ---------- */
    const mobile = matchMedia('(pointer: coarse)').matches;
    const renderer = new T.WebGLRenderer({ antialias: !mobile, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);
    renderer.domElement.className = 'vr-canvas';
    renderer.domElement.setAttribute('aria-label', 'סיור תלת ממד');

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(70, 1, 0.05, 900);
    const rig = new T.Group(); rig.add(camera); scene.add(rig);
    let world = null, pano = null;

    /* ---------- טקסטורות מצוירות ---------- */
    function tex(w, h, draw, rep) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); draw(g, w, h);
      const t = track(new T.CanvasTexture(c));
      t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;
      if (rep) t.repeat.set(rep[0], rep[1]);
      return t;
    }
    const shade = (hex, f) => { const c = new T.Color(hex); c.offsetHSL(0, 0, f); return '#' + c.getHexString(); };
    const noise = (g, w, h, base, amt, n) => { g.fillStyle = base; g.fillRect(0, 0, w, h); for (let i = 0; i < n; i++) { g.fillStyle = shade(base, (R() - .5) * amt); g.globalAlpha = .35; g.fillRect(R() * w, R() * h, 1 + R() * 3, 1 + R() * 3); } g.globalAlpha = 1; };
    const TX = {
      wood: (col, rep) => tex(512, 512, (g, w, h) => {
        const rows = 8;
        for (let r = 0; r < rows; r++) {
          let x = -R() * 200;
          while (x < w) {
            const len = 180 + R() * 220;
            g.fillStyle = shade(col, (R() - .5) * .12); g.fillRect(x, r * h / rows, len, h / rows);
            g.strokeStyle = shade(col, -.08); g.globalAlpha = .35; g.lineWidth = 1;
            for (let k = 0; k < 6; k++) { g.beginPath(); const y = r * h / rows + R() * h / rows; g.moveTo(x, y); g.bezierCurveTo(x + len / 3, y + (R() - .5) * 6, x + 2 * len / 3, y + (R() - .5) * 6, x + len, y); g.stroke(); }
            g.globalAlpha = 1; g.fillStyle = shade(col, -.2); g.fillRect(x, r * h / rows, 2, h / rows);
            x += len;
          }
          g.fillStyle = shade(col, -.22); g.fillRect(0, r * h / rows, w, 2);
        }
      }, rep),
      logs: (col, rep) => tex(256, 256, (g, w, h) => {
        for (let r = 0; r < 6; r++) {
          const y = r * h / 6, grd = g.createLinearGradient(0, y, 0, y + h / 6);
          grd.addColorStop(0, shade(col, -.12)); grd.addColorStop(.45, shade(col, .06)); grd.addColorStop(1, shade(col, -.18));
          g.fillStyle = grd; g.fillRect(0, y, w, h / 6);
        }
      }, rep),
      tiles: (col, grout, rep) => tex(256, 256, (g, w, h) => { g.fillStyle = grout; g.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = shade(col, (R() - .5) * .06); g.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); } }, rep),
      marble: (col, rep) => tex(512, 512, (g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); g.strokeStyle = shade(col, -.25); for (let i = 0; i < 18; i++) { g.globalAlpha = .15 + R() * .2; g.lineWidth = .5 + R() * 1.5; g.beginPath(); let x = R() * w, y = 0; g.moveTo(x, y); while (y < h) { x += (R() - .5) * 40; y += 20 + R() * 30; g.lineTo(x, y); } g.stroke(); } g.globalAlpha = 1; g.fillStyle = shade(col, -.1); for (let i = 0; i <= 2; i++) { g.fillRect(0, i * 256 - 1, w, 2); g.fillRect(i * 256 - 1, 0, 2, h); } }, rep),
      plaster: (col, rep) => tex(256, 256, (g, w, h) => noise(g, w, h, col, .06, 2500), rep),
      grass: (rep) => tex(512, 512, (g, w, h) => { noise(g, w, h, '#557a36', .18, 22000); for (let i = 0; i < 2500; i++) { g.strokeStyle = shade('#6c9444', (R() - .5) * .2); g.globalAlpha = .5; g.beginPath(); const x = R() * w, y = R() * h; g.moveTo(x, y); g.lineTo(x + (R() - .5) * 3, y - 3 - R() * 4); g.stroke(); } g.globalAlpha = 1; }, rep),
      sand: (col, rep) => tex(512, 512, (g, w, h) => noise(g, w, h, col, .12, 30000), rep),
      stone: (col, rep) => tex(512, 512, (g, w, h) => { g.fillStyle = shade(col, -.25); g.fillRect(0, 0, w, h); let y = 0; while (y < h) { const rh = 40 + R() * 30; let x = -R() * 60; while (x < w) { const rw = 60 + R() * 70; g.fillStyle = shade(col, (R() - .5) * .16); g.fillRect(x + 3, y + 3, rw - 6, rh - 6); x += rw; } y += rh; } }, rep),
      fabric: (col, rep) => tex(128, 128, (g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); g.globalAlpha = .12; for (let i = 0; i < w; i += 2) { g.fillStyle = i % 4 ? '#fff' : '#000'; g.fillRect(i, 0, 1, h); g.fillRect(0, i, w, 1); } g.globalAlpha = 1; }, rep),
      water: (rep) => tex(512, 512, (g, w, h) => { const grd = g.createLinearGradient(0, 0, w, h); grd.addColorStop(0, '#1b8fb0'); grd.addColorStop(1, '#2ab3c8'); g.fillStyle = grd; g.fillRect(0, 0, w, h); g.strokeStyle = '#bff3ff'; for (let i = 0; i < 160; i++) { g.globalAlpha = .08 + R() * .18; g.lineWidth = 1 + R() * 2; g.beginPath(); const x = R() * w, y = R() * h; g.moveTo(x, y); g.quadraticCurveTo(x + 15, y - 6, x + 30 + R() * 20, y); g.stroke(); } g.globalAlpha = 1; }, rep),
      sea: (rep) => tex(512, 512, (g, w, h) => { noise(g, w, h, '#1f6f94', .12, 9000); g.strokeStyle = '#d6f4ff'; for (let i = 0; i < 260; i++) { g.globalAlpha = .06 + R() * .12; g.beginPath(); const x = R() * w, y = R() * h; g.moveTo(x, y); g.lineTo(x + 10 + R() * 24, y + (R() - .5) * 2); g.stroke(); } g.globalAlpha = 1; }, rep),
      windows: (lit) => tex(128, 256, (g, w, h) => { g.fillStyle = '#6d7686'; g.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) { const on = R() < (lit ? .55 : .0); g.fillStyle = on ? (R() < .5 ? '#ffd98a' : '#fff1c4') : shade('#9fb4c8', (R() - .5) * .2); g.fillRect(8 + i * 30, 8 + j * 31, 20, 20); } })
    };

    /* ---------- חומרים ועזרים ---------- */
    const M = (o) => track(new T.MeshStandardMaterial(o));
    const colliders = [];
    let G = null; // הקבוצה הנוכחית
    function box(w, h, d, mat, x, y, z, o) {
      o = o || {};
      const geo = track(new T.BoxGeometry(w, h, d));
      if (o.uv) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * o.uv[0], uv.getY(i) * o.uv[1]); }
      const m = new T.Mesh(geo, mat); m.position.set(x, y + h / 2, z);
      if (o.ry) m.rotation.y = o.ry;
      m.castShadow = o.cast !== false; m.receiveShadow = true;
      (o.parent || G).add(m);
      if (o.solid) colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
      return m;
    }
    function cyl(rt, rb, h, mat, x, y, z, seg, o) {
      const m = new T.Mesh(track(new T.CylinderGeometry(rt, rb, h, seg || 16)), mat);
      m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true; (o && o.parent || G).add(m);
      if (o && o.solid) colliders.push({ x0: x - rb, x1: x + rb, z0: z - rb, z1: z + rb });
      return m;
    }
    function plane(w, d, mat, x, y, z, seg) {
      const m = new T.Mesh(track(new T.PlaneGeometry(w, d, seg || 1, seg || 1)), mat);
      m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; G.add(m); return m;
    }
    const glassMat = () => M({ color: 0xcfe8f5, roughness: .05, metalness: 0, transparent: true, opacity: .16, depthWrite: false });

    /* קיר עם פתחים לאורך ציר x (z קבוע) או ציר z (x קבוע) */
    function wall(axis, fixed, from, to, openings, mat, H, th) {
      const segs = [[from, to]];
      const cut = (a, b) => { for (let i = segs.length - 1; i >= 0; i--) { const [s, e] = segs[i]; if (b <= s || a >= e) continue; segs.splice(i, 1, ...[[s, a], [b, e]].filter(q => q[1] - q[0] > .01)); } };
      (openings || []).forEach(o => cut(o.a, o.b));
      const mk = (a, b, y0, y1, solid) => {
        const len = b - a, mid = (a + b) / 2;
        const uv = [len / 2.5, (y1 - y0) / 2.5];
        if (axis === 'x') box(len, y1 - y0, th, mat, mid, y0, fixed, { solid, uv });
        else box(th, y1 - y0, len, mat, fixed, y0, mid, { solid, uv });
      };
      segs.forEach(([a, b]) => mk(a, b, 0, H, true));
      (openings || []).forEach(o => {
        if (o.sill > 0) mk(o.a, o.b, 0, o.sill, true);
        if (o.top < H) mk(o.a, o.b, o.top, H, false);
        if (o.glass !== false) {
          const len = o.b - o.a, mid = (o.a + o.b) / 2, h = o.top - o.sill;
          const gm = glassMat();
          const g = new T.Mesh(track(new T.PlaneGeometry(len, h)), gm);
          g.position.set(axis === 'x' ? mid : fixed, o.sill + h / 2, axis === 'x' ? fixed : mid);
          if (axis !== 'x') g.rotation.y = Math.PI / 2;
          G.add(g);
          const fr = M({ color: 0x2f2a26, roughness: .6 });
          if (axis === 'x') { box(len, .05, .08, fr, mid, o.sill, fixed); box(len, .05, .08, fr, mid, o.top - .05, fixed); box(.05, h, .08, fr, mid, o.sill, fixed); }
          else { box(.08, .05, len, fr, fixed, o.sill, mid); box(.08, .05, len, fr, fixed, o.top - .05, mid); box(.08, h, .05, fr, fixed, o.sill, mid); }
          if (o.sill < .05 && o.slide !== true) colliders.push(axis === 'x' ? { x0: o.a, x1: o.b, z0: fixed - .05, z1: fixed + .05, glass: true } : { x0: fixed - .05, x1: fixed + .05, z0: o.a, z1: o.b, glass: true });
        }
      });
    }

    /* ---------- רהיטים ---------- */
    const F = {
      bed(x, z, ry, col) {
        const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0; G.add(g);
        const wood = M({ map: TX.wood('#6b4a33', [1, 1]), roughness: .7 });
        box(1.9, .35, 2.1, wood, 0, 0, 0, { parent: g });
        box(1.85, .25, 2.0, M({ color: 0xf4f1ea, roughness: .95 }), 0, .35, .02, { parent: g });
        box(1.9, .06, 1.2, M({ map: TX.fabric(col || '#7c93a8', [3, 3]), roughness: 1 }), 0, .6, .4, { parent: g });
        box(1.95, 1.1, .08, wood, 0, 0, -1.05, { parent: g });
        [-.45, .45].forEach(px => { const p = box(.7, .14, .4, M({ color: 0xffffff, roughness: 1 }), px, .6, -.75, { parent: g }); p.rotation.x = -.25; });
        [-1.25, 1.25].forEach(px => { box(.45, .5, .4, wood, px, 0, -.8, { parent: g }); lamp(g, px, .5, -.8, .35); });
        colliders.push({ x0: x - 1.1, x1: x + 1.1, z0: z - 1.1, z1: z + 1.1 });
      },
      sofa(x, z, ry, col) {
        const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0; G.add(g);
        const f = M({ map: TX.fabric(col || '#8b8f7a', [2, 1]), roughness: 1 });
        box(2.2, .42, .9, f, 0, 0, 0, { parent: g }); box(2.2, .5, .22, f, 0, .42, -.34, { parent: g });
        [-1.0, 1.0].forEach(px => box(.2, .32, .9, f, px, .42, 0, { parent: g }));
        [-.5, .5].forEach(px => box(.9, .12, .6, M({ map: TX.fabric(shade(col || '#8b8f7a', .08), [1, 1]), roughness: 1 }), px, .42, .08, { parent: g }));
        const s = Math.abs(Math.sin(ry || 0)) > .5; colliders.push(s ? { x0: x - .5, x1: x + .5, z0: z - 1.15, z1: z + 1.15 } : { x0: x - 1.15, x1: x + 1.15, z0: z - .5, z1: z + .5 });
      },
      table(x, z, w, d, h, mat, chairs) {
        mat = mat || M({ map: TX.wood('#8a5a3a', [1, 1]), roughness: .6 });
        box(w, .05, d, mat, x, h - .05, z);
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => box(.06, h - .05, .06, mat, x + a * (w / 2 - .08), 0, z + b * (d / 2 - .08)));
        colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
        if (chairs) {
          const cm = M({ color: 0x3b332c, roughness: .7 });
          const put = (cx, cz, ry) => { const g = new T.Group(); g.position.set(cx, 0, cz); g.rotation.y = ry; G.add(g); box(.45, .05, .45, cm, 0, .45, 0, { parent: g }); box(.45, .5, .05, cm, 0, .5, -.2, { parent: g }); [[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]].forEach(([a, b]) => box(.04, .45, .04, cm, a, 0, b, { parent: g })); };
          put(x, z - d / 2 - .35, 0); put(x, z + d / 2 + .35, Math.PI);
          if (chairs > 2) { put(x - w / 2 - .35, z, Math.PI / 2); put(x + w / 2 + .35, z, -Math.PI / 2); }
        }
      },
      kitchen(x0, x1, z, dir) {
        const body = M({ color: 0xe9e4da, roughness: .6 }), top = M({ map: TX.marble('#d9d4cc', [1, 1]), roughness: .25 });
        const len = x1 - x0, mid = (x0 + x1) / 2;
        box(len, .88, .62, body, mid, 0, z + dir * .31, { solid: true });
        box(len + .02, .04, .64, top, mid, .88, z + dir * .31);
        box(len, .7, .35, body, mid, 1.5, z + dir * .18);
        box(.7, 1.9, .65, M({ color: 0xc9ccd0, metalness: .6, roughness: .3 }), x1 + .38, 0, z + dir * .33, { solid: true });
        for (let i = 0; i < 3; i++) box(.02, .12, .02, M({ color: 0x777777, metalness: .8, roughness: .3 }), x0 + .5 + i * (len - 1) / 2, .75, z + dir * .63);
      },
      tv(x, z, ry) { const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0; G.add(g); box(1.6, .45, .4, M({ map: TX.wood('#3b2a20', [1, 1]), roughness: .6 }), 0, 0, 0, { parent: g }); box(1.4, .8, .05, M({ color: 0x0b0d10, roughness: .2, metalness: .4 }), 0, .8, 0, { parent: g }); },
      rug(x, z, w, d, col) { const m = plane(w, d, M({ map: TX.fabric(col, [4, 3]), roughness: 1 }), x, .012, z); return m; },
      plant(x, z, s) { s = s || 1; cyl(.18 * s, .14 * s, .35 * s, M({ color: 0xb8683f, roughness: .8 }), x, 0, z, 12); foliage(x, .35 * s, z, .35 * s, 3, '#3f7a3a'); },
      wardrobe(x, z, ry) { const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0; G.add(g); box(1.4, 2.1, .6, M({ map: TX.wood('#a07a55', [1, 2]), roughness: .6 }), 0, 0, 0, { parent: g }); box(.02, 1.9, .01, M({ color: 0x3b2a20 }), 0, .1, .31, { parent: g }); colliders.push({ x0: x - .75, x1: x + .75, z0: z - .35, z1: z + .35 }); },
      lounger(x, z, ry) { const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0; G.add(g); const w = M({ color: 0xf2efe8, roughness: .9 }); box(.7, .3, 1.5, w, 0, 0, .2, { parent: g }); const b = box(.7, .08, .7, w, 0, .3, -.75, { parent: g }); b.rotation.x = .6; b.position.y = .55; },
      umbrella(x, z, col) { cyl(.03, .03, 2.2, M({ color: 0xdddddd }), x, 0, z, 8); const c = new T.Mesh(track(new T.ConeGeometry(1.3, .45, 12, 1, true)), M({ color: col || 0xf0e6d2, side: T.DoubleSide, roughness: .9 })); c.position.set(x, 2.3, z); c.castShadow = true; G.add(c); }
    };
    const lamps = [];
    function lamp(parent, x, y, z, h) {
      const base = M({ color: 0x3a3430, roughness: .5 }), shadeM = M({ color: 0xf6ead3, emissive: 0xffc77a, emissiveIntensity: 0, roughness: .9, side: T.DoubleSide });
      box(.04, h, .04, base, x, y, z, { parent });
      const sh = new T.Mesh(track(new T.CylinderGeometry(.12, .18, .22, 16, 1, true)), shadeM); sh.position.set(x, y + h + .08, z); parent.add(sh);
      const L = new T.PointLight(0xffc98a, 0, 7, 2); L.position.set(x, y + h + .05, z); parent.add(L);
      lamps.push({ L, m: shadeM, k: 1 });
    }
    function ceilingLight(x, z, H) {
      const m = M({ color: 0xffffff, emissive: 0xffe2b0, emissiveIntensity: 0 });
      const d = new T.Mesh(track(new T.CylinderGeometry(.25, .25, .04, 20)), m); d.position.set(x, H - .03, z); G.add(d);
      const L = new T.PointLight(0xffd6a0, 0, 9, 2); L.position.set(x, H - .2, z); G.add(L);
      lamps.push({ L, m, k: 1.6 });
    }
    function foliage(x, y, z, r, n, col) {
      const mat = M({ color: col || '#3f6f2f', roughness: .9, flatShading: true });
      for (let i = 0; i < n; i++) {
        const s = new T.Mesh(track(new T.IcosahedronGeometry(r * (.7 + R() * .5), 1)), mat);
        s.position.set(x + (R() - .5) * r * 1.2, y + r * .8 + i * r * .55, z + (R() - .5) * r * 1.2);
        s.castShadow = true; G.add(s);
      }
    }
    function tree(x, z, s, kind) {
      s = s || 1;
      if (kind === 'palm') {
        const trunkM = M({ color: 0x8a6f4d, roughness: 1 });
        for (let i = 0; i < 8; i++) cyl(.12 * s, .15 * s, .7 * s, trunkM, x + Math.sin(i * .25) * .15 * s, i * .68 * s, z, 8);
        const leafM = M({ color: 0x4f8a3a, roughness: .8, side: T.DoubleSide });
        for (let i = 0; i < 9; i++) {
          const l = new T.Mesh(track(new T.PlaneGeometry(.5 * s, 2.4 * s, 1, 4)), leafM);
          const pos = l.geometry.attributes.position; for (let k = 0; k < pos.count; k++) { const y = pos.getY(k); pos.setZ(k, -Math.pow((y + 1.2 * s) / (2.4 * s), 2) * .9 * s); }
          l.geometry.computeVertexNormals();
          l.position.set(x + .6, 5.5 * s, z); l.rotation.set(-1.1, i * (Math.PI * 2 / 9), 0, 'YXZ');
          l.position.x = x + Math.sin(2) * .15 * s; l.castShadow = true; G.add(l);
        }
        colliders.push({ x0: x - .25, x1: x + .25, z0: z - .25, z1: z + .25 });
        return;
      }
      cyl(.12 * s, .18 * s, 1.6 * s, M({ color: 0x5b4330, roughness: 1 }), x, 0, z, 8, { solid: true });
      foliage(x, 1.4 * s, z, .9 * s, kind === 'olive' ? 3 : 4, kind === 'olive' ? '#7d8f5a' : kind === 'pine' ? '#2f5a2e' : '#4a7a35');
    }

    /* ---------- תאורה ושמיים ---------- */
    const hemi = new T.HemisphereLight(0xcfe6ff, 0x6b5a45, 1); scene.add(hemi);
    const sun = new T.DirectionalLight(0xffffff, 3);
    sun.castShadow = true; sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 90 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = .02;
    scene.add(sun); scene.add(sun.target);
    const skyGeo = track(new T.SphereGeometry(600, 32, 16));
    const skyMat = track(new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new T.Color() }, hor: { value: new T.Color() }, bot: { value: new T.Color() } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(hor, top, pow(h, 0.55)) : mix(hor, bot, pow(-h, 0.4)); gl_FragColor = vec4(c, 1.0); }'
    }));
    const sky = new T.Mesh(skyGeo, skyMat); scene.add(sky);
    const starGeo = track(new T.BufferGeometry());
    { const p = []; for (let i = 0; i < 1800; i++) { const th = R() * Math.PI * 2, ph = Math.acos(R() * .95); p.push(500 * Math.sin(ph) * Math.cos(th), 500 * Math.cos(ph), 500 * Math.sin(ph) * Math.sin(th)); } starGeo.setAttribute('position', new T.Float32BufferAttribute(p, 3)); }
    const stars = new T.Points(starGeo, track(new T.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: .9, fog: false })));
    scene.add(stars);
    const sunDisc = new T.Mesh(track(new T.SphereGeometry(10, 16, 8)), track(new T.MeshBasicMaterial({ color: 0xfff3c4, fog: false })));
    scene.add(sunDisc);
    scene.fog = new T.Fog(0xcfe0ee, 60, 420);

    const TIMES = {
      day: { sun: [30, 45, 22], si: 3.2, sc: 0xfff4e0, hemi: [0xcfe6ff, 0x6b5a45, 1.1], top: 0x3f86d6, hor: 0xcfe3f2, bot: 0x9aa7ae, fog: 0xcfe0ee, lamps: 0, exp: 1.0, stars: false, win: false },
      sunset: { sun: [-40, 7, 20], si: 2.2, sc: 0xffa45c, hemi: [0xffc6a0, 0x4a3a40, .7], top: 0x33406e, hor: 0xf59a5b, bot: 0x5b4a4f, fog: 0xe8a57a, lamps: .6, exp: 1.05, stars: false, win: true },
      night: { sun: [20, 40, -30], si: .25, sc: 0x9fb6ff, hemi: [0x33456e, 0x10131a, .35], top: 0x050a1c, hor: 0x1a2542, bot: 0x07090f, fog: 0x0e1628, lamps: 1, exp: 1.25, stars: true, win: true }
    };
    let time = opts.time || 'day';
    const nightMats = [];   // חומרים שנדלקים בלילה (חלונות בניינים, גחלים)
    function applyTime(k) {
      time = TIMES[k] ? k : 'day';
      const t = TIMES[time];
      sun.position.set(...t.sun); sun.intensity = t.si; sun.color.set(t.sc);
      sunDisc.position.set(t.sun[0] * 12, t.sun[1] * 12, t.sun[2] * 12); sunDisc.visible = time !== 'night';
      sunDisc.material.color.set(time === 'sunset' ? 0xffb070 : 0xfff3c4);
      hemi.color.set(t.hemi[0]); hemi.groundColor.set(t.hemi[1]); hemi.intensity = t.hemi[2];
      skyMat.uniforms.top.value.set(t.top); skyMat.uniforms.hor.value.set(t.hor); skyMat.uniforms.bot.value.set(t.bot);
      scene.fog.color.set(t.fog); stars.visible = t.stars;
      renderer.toneMappingExposure = t.exp;
      lamps.forEach(l => { l.L.intensity = t.lamps * 5 * l.k; l.m.emissiveIntensity = t.lamps * 2.5; });
      nightMats.forEach(n => n(t));
    }

    /* ---------- בניית הסצנות ---------- */
    let stops = [], bounds = { x0: -30, x1: 30, z0: -30, z1: 30 }, water = [];
    function clearWorld() {
      if (world) { scene.remove(world); world = null; }
      colliders.length = 0; lamps.length = 0; nightMats.length = 0; water = [];
    }
    function house(o) {
      const H = 2.8, th = .16;
      const wallM = o.wallMat, floorM = o.floorMat;
      plane(10, 7, floorM, 0, .005, 0);
      box(10.2, .12, 7.2, M({ color: 0xf2eee8, roughness: .95 }), 0, H, 0, { cast: true });
      wall('x', -3.5, -5, 5, o.back || [], wallM, H, th);
      wall('x', 3.5, -5, 5, o.front, wallM, H, th);
      wall('z', -5, -3.5, 3.5, o.left || [], wallM, H, th);
      wall('z', 5, -3.5, 3.5, o.right || [], wallM, H, th);
      wall('z', 1, -3.5, 3.5, [{ a: -1.4, b: -.4, sill: 0, top: 2.1, glass: false }], o.innerMat || wallM, H, .1);
      ceilingLight(-2, 0, H); ceilingLight(3, 0, H);
      return H;
    }
    function gable(mat, H, rise, over) {
      const half = 3.5 + over, len = Math.hypot(half, rise), ang = Math.atan2(rise, half);
      [-1, 1].forEach(s => {
        const m = new T.Mesh(track(new T.BoxGeometry(10.8, .16, len)), mat);
        m.position.set(0, H + .12 + rise / 2, s * half / 2); m.rotation.x = s * ang; m.castShadow = true; m.receiveShadow = true; G.add(m);
      });
      const tri = new T.Shape(); tri.moveTo(-3.5, 0); tri.lineTo(3.5, 0); tri.lineTo(0, rise); tri.lineTo(-3.5, 0);
      const gm = track(new T.ShapeGeometry(tri));
      [-5, 5].forEach(x => { const m = new T.Mesh(gm, mat); m.rotation.y = Math.PI / 2; m.position.set(x, H + .12, 0); m.castShadow = true; G.add(m); const m2 = m.clone(); m2.rotation.y = -Math.PI / 2; G.add(m2); });
    }
    function deck(z0, z1, mat, rail) {
      box(10.4, .14, z1 - z0, mat, 0, -.14, (z0 + z1) / 2, { uv: [4, 2] });
      if (rail === 'glass') {
        const gm = glassMat(), pm = M({ color: 0xb8bcc2, metalness: .8, roughness: .3 });
        const gl = new T.Mesh(track(new T.PlaneGeometry(10.4, 1)), gm); gl.position.set(0, .5, z1); G.add(gl);
        [-1, 1].forEach(s => { const g2 = new T.Mesh(track(new T.PlaneGeometry(z1 - z0, 1)), gm); g2.rotation.y = Math.PI / 2; g2.position.set(s * 5.2, .5, (z0 + z1) / 2); G.add(g2); });
        box(10.4, .05, .06, pm, 0, 1, z1);
        colliders.push({ x0: -6, x1: 6, z0: z1 - .05, z1: z1 + .3 }, { x0: -5.4, x1: -5.2, z0: z0, z1: z1 }, { x0: 5.2, x1: 5.4, z0: z0, z1: z1 });
      }
    }
    function pergola(z0, z1, mat) {
      [-4.9, -1.7, 1.5, 4.9].forEach(x => box(.14, 2.6, .14, mat, x, 0, z1 - .1, { solid: true }));
      box(10, .16, .16, mat, 0, 2.6, z1 - .1);
      for (let x = -4.8; x <= 4.8; x += .5) box(.08, .12, z1 - z0 + .3, mat, x, 2.72, (z0 + z1) / 2);
    }
    function firePit(x, z) {
      const st = M({ color: 0x6f6a64, roughness: 1 });
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const s = new T.Mesh(track(new T.DodecahedronGeometry(.16)), st); s.position.set(x + Math.cos(a) * .55, .1, z + Math.sin(a) * .55); s.castShadow = true; G.add(s); }
      const emb = M({ color: 0x3a2418, emissive: 0xff5a1a, emissiveIntensity: 0, roughness: 1 });
      const e = new T.Mesh(track(new T.CylinderGeometry(.4, .45, .1, 12)), emb); e.position.set(x, .05, z); G.add(e);
      const L = new T.PointLight(0xff7a30, 0, 10, 2); L.position.set(x, .6, z); G.add(L);
      nightMats.push(t => { emb.emissiveIntensity = t.lamps * 2; L.intensity = t.lamps * 14; });
      colliders.push({ x0: x - .7, x1: x + .7, z0: z - .7, z1: z + .7 });
    }
    function jacuzzi(x, z) {
      const shell = M({ map: TX.wood('#7a5a40', [1, 1]), roughness: .7 });
      box(2.2, .75, 2.2, shell, x, -.14, z, { solid: true });
      const w = M({ map: TX.water([1, 1]), roughness: .05, metalness: .1, emissive: 0x0a4a6a, emissiveIntensity: 0, transparent: true, opacity: .92 });
      const p = plane(1.9, 1.9, w, x, .56, z); water.push(w);
      nightMats.push(t => { w.emissiveIntensity = t.lamps * .9; });
      return p;
    }
    function pool(x, z, w, d, y) {
      const tile = M({ map: TX.tiles('#d8f0f4', '#a9c7cc', [w, d]), roughness: .4 });
      const wm = M({ map: TX.water([w / 4, d / 4]), roughness: .05, metalness: .1, emissive: 0x06384f, emissiveIntensity: 0, transparent: true, opacity: .9 });
      box(w + .8, .12, d + .8, tile, x, y, z, { cast: false });
      plane(w, d, wm, x, y + .14, z); water.push(wm);
      nightMats.push(t => { wm.emissiveIntensity = t.lamps * 1.2; });
    }
    function terrain(size, seg, mat, y, amp, flatR, fn) {
      const g = track(new T.PlaneGeometry(size, size, seg, seg)); g.rotateX(-Math.PI / 2);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const d = Math.hypot(x, z); const k = Math.min(1, Math.max(0, (d - flatR) / 40)); p.setY(i, (fn ? fn(x, z) : 0) * amp * k); }
      g.computeVertexNormals();
      const m = new T.Mesh(g, mat); m.position.y = y; m.receiveShadow = true; G.add(m); return m;
    }
    const hills = (x, z) => Math.sin(x * .03) * 6 + Math.cos(z * .025) * 7 + Math.sin((x + z) * .05) * 3 + 8;
    const dunes = (x, z) => Math.sin(x * .05 + Math.cos(z * .03) * 2) * 2.2 + Math.cos(z * .04) * 1.4 + 1;
    function mesa(x, z, r, h, col) {
      const m = new T.Mesh(track(new T.CylinderGeometry(r * .92, r, h, 9, 3)), M({ color: col, roughness: 1, flatShading: true }));
      const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) { p.setX(i, p.getX(i) * (.85 + R() * .3)); p.setZ(i, p.getZ(i) * (.85 + R() * .3)); }
      m.geometry.computeVertexNormals(); m.position.set(x, h / 2 - 1, z); m.receiveShadow = true; G.add(m);
    }
    function skyline(radius, y, n) {
      const day = TX.windows(false), night = TX.windows(true);
      const mats = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 1.3 - Math.PI * .15 + (R() - .5) * .08; if (Math.sin(a) < -.2) continue;
        const r = radius + R() * 60, h = 20 + R() * 70, w = 10 + R() * 14;
        const mat = M({ map: day, roughness: .7, color: new T.Color().setHSL(.6, .06, .55 + R() * .25), emissive: 0xffd08a, emissiveMap: night, emissiveIntensity: 0 });
        mat.map = day.clone(); mat.map.repeat.set(w / 12, h / 24); mat.map.needsUpdate = true; track(mat.map);
        mat.emissiveMap = night.clone(); mat.emissiveMap.repeat.copy(mat.map.repeat); mat.emissiveMap.needsUpdate = true; track(mat.emissiveMap);
        mats.push(mat);
        const b = new T.Mesh(track(new T.BoxGeometry(w, h, w)), mat); b.position.set(Math.cos(a) * r, y + h / 2, Math.sin(a) * r); b.castShadow = false; G.add(b);
      }
      nightMats.push(t => mats.forEach(m => { m.emissiveIntensity = t.win ? (t.lamps > .9 ? 1.1 : .5) : 0; }));
    }

    const BUILD = {
      zimmer() {
        const logs = M({ map: TX.logs('#9a6a42', [1, 1]), roughness: .8 });
        const floor = M({ map: TX.wood('#b07a4c', [3, 2]), roughness: .6 });
        house({ wallMat: logs, floorMat: floor,
          front: [{ a: -4.2, b: -.6, sill: 0, top: 2.3, slide: true }, { a: 2, b: 4.2, sill: .8, top: 2.2 }],
          left: [{ a: -1, b: 1, sill: .9, top: 2.1 }], back: [{ a: 2.6, b: 3.8, sill: 1.1, top: 2.0 }] });
        gable(M({ color: 0x6b3b2a, roughness: .9 }), 2.8, 1.4, .6);
        F.sofa(-2.6, 1.2, Math.PI, '#8a6a4a'); F.rug(-2.5, .2, 3, 2.2, '#b98c62'); F.table(-2.4, -.2, 1.1, .6, .42);
        F.kitchen(-4.6, -2.2, -3.5, 1); F.table(-1, -1.9, 1.2, .8, .76, null, 2);
        F.tv(-4.6, .2, Math.PI / 2); F.plant(-.4, 3, 1.1);
        F.bed(3.2, -1.9, 0, '#9c4a3a'); F.wardrobe(4.55, 1.8, -Math.PI / 2);
        const dk = M({ map: TX.wood('#8f6440', [1, 1]), roughness: .75 });
        deck(3.5, 7.5, dk); pergola(3.5, 7.5, M({ map: TX.wood('#6f4a30', [1, 1]), roughness: .8 }));
        jacuzzi(3, 5.6);
        F.table(-2.5, 5.5, 1.4, .9, .74, M({ map: TX.wood('#7a5234', [1, 1]) }), 4);
        const gr = M({ map: TX.grass([40, 40]), roughness: 1 });
        terrain(260, 80, gr, -.15, 1, 16, (x, z) => Math.sin(x * .08) * .8 + Math.cos(z * .07) * .8);
        terrain(900, 60, M({ color: 0x6f7f4a, roughness: 1, flatShading: true }), -2, 1, 120, hills);
        const stoneM = M({ color: 0xbdb3a4, roughness: 1 });
        for (let i = 0; i < 9; i++) box(.7, .04, .5, stoneM, -1 + Math.sin(i) * .3, -.13, 8.3 + i * .9, { cast: false });
        [[-9, 9], [-12, 1], [9, 12], [13, 2], [-7, 16], [6, 18], [-15, -8], [12, -9], [0, -12], [-4, 22]].forEach(([x, z], i) => tree(x, z, 1 + R() * .5, i % 3 === 0 ? 'olive' : i % 3 === 1 ? 'pine' : ''));
        for (let i = 0; i < 40; i++) { const x = -8 + R() * 16, z = 8 + R() * 3; if (Math.abs(x + 1) < 1) continue; const f = new T.Mesh(track(new T.SphereGeometry(.12, 6, 4)), M({ color: [0xe84a5f, 0xf7c948, 0xffffff, 0xb05fd9][i % 4], roughness: .8 })); f.position.set(x, .1, z); G.add(f); }
        firePit(-6.5, 10);
        const fenceM = M({ map: TX.wood('#7a5a3a', [1, 1]) });
        for (let x = -18; x <= 18; x += 2) box(.1, 1, .1, fenceM, x, -.15, 22); box(36, .08, .06, fenceM, 0, .6, 22);
        bounds = { x0: -17, x1: 17, z0: -8, z1: 21 };
        stops = [['סלון', [-2.6, -.6], Math.PI], ['חדר שינה', [3, .8], 0], ['מרפסת וג׳קוזי', [0, 4.6], Math.PI * .92], ['גינה', [-1, 13], 0], ['מדורה', [-4.5, 11.5], Math.PI * .7]];
      },
      hotel() {
        const wallM = M({ map: TX.plaster('#efe9df', [1, 1]), roughness: .9 });
        const floor = M({ map: TX.marble('#e7e1d6', [3, 2]), roughness: .25 });
        house({ wallMat: wallM, floorMat: floor, front: [{ a: -4.7, b: -.3, sill: 0, top: 2.6, slide: true }, { a: 1.3, b: 4.7, sill: 0, top: 2.6, slide: true }] });
        box(10.6, .3, 7.6, M({ color: 0xe8e2d8, roughness: .9 }), 0, 2.92, 0);
        F.sofa(-2.6, -1.4, 0, '#c7b79c'); F.rug(-2.6, -.3, 3, 2, '#9fb0b8'); F.table(-2.6, -.3, 1, .6, .42, M({ map: TX.marble('#f1ede6', [1, 1]), roughness: .2 }));
        F.table(-4.3, 1.8, 1.2, .6, .75, null, 0); F.tv(-2.6, -3.1, 0); F.plant(-.5, -3, 1.2);
        F.bed(3, -1.8, 0, '#d8c7a8'); F.wardrobe(4.55, 1.2, -Math.PI / 2);
        deck(3.5, 5.8, M({ map: TX.tiles('#d9cbb5', '#b9a98f', [8, 3]), roughness: .7 }), 'glass');
        F.lounger(-3, 4.7, Math.PI); F.table(2.5, 4.7, .7, .7, .72, M({ color: 0xffffff, roughness: .4 }), 2);
        const GY = -14;
        box(10.6, -GY - .15, 7.6, M({ map: TX.plaster('#e9e3d8', [4, 6]) }), 0, GY, 0, { cast: false });
        [-11, 11].forEach(x => { box(11.4, -GY + 6, 7.6, M({ map: TX.plaster('#e2dccf', [4, 8]) }), x, GY, 0, { cast: false }); for (let f = 0; f < 6; f++) box(10.6, .12, 1.6, M({ color: 0xf5f1ea }), x, GY + 3.2 + f * 3.1, 4.6, { cast: false }); });
        plane(600, 90, M({ map: TX.tiles('#d7ccb8', '#bfb39c', [150, 22]), roughness: .9 }), 0, GY, 15);
        pool(0, 14, 18, 8, GY);
        box(22, .1, 1, M({ color: 0xf0ece4 }), 0, GY - .1, 9.5, { cast: false });
        for (let i = -3; i <= 3; i++) { F.lounger(i * 3, 20, Math.PI); F.umbrella(i * 3 + 1.3, 20.8); } G.children.slice(-7 * 3).forEach(m => { m.position.y += GY; });
        [[-12, 12], [12, 12], [-12, 22], [12, 22], [-5, 25], [5, 25]].forEach(([x, z]) => { tree(x, z, 1.1, 'palm'); G.children.slice(-17).forEach(m => { m.position.y += GY; }); });
        plane(600, 40, M({ map: TX.sand('#e6d3a8', [60, 4]), roughness: 1 }), 0, GY + .03, 50);
        const sea = M({ map: TX.sea([60, 30]), roughness: .15, metalness: .2, color: 0xbfe6f5 }); water.push(sea);
        plane(1400, 700, sea, 0, GY - .05, 420);
        bounds = { x0: -5, x1: 5, z0: -3.4, z1: 5.7 };
        stops = [['פינת ישיבה', [-2.6, .6], Math.PI * .95], ['מיטה זוגית', [2.6, .4], .15], ['מרפסת מעל הים', [0, 5.2], Math.PI], ['מבט לבריכה ולחוף', [3.5, 5.3], Math.PI * 1.1, .45]];
      },
      apartment() {
        const wallM = M({ map: TX.plaster('#e6e3de', [1, 1]), roughness: .9 });
        const floor = M({ map: TX.wood('#c49a6c', [3, 2]), roughness: .55 });
        house({ wallMat: wallM, floorMat: floor, innerMat: M({ map: TX.plaster('#cfd9d6', [1, 1]) }),
          front: [{ a: -4.6, b: -.4, sill: 0, top: 2.5, slide: true }, { a: 2, b: 4.4, sill: .7, top: 2.3 }],
          left: [{ a: -1.2, b: 1.2, sill: .8, top: 2.2 }] });
        F.kitchen(-4.6, -1.8, -3.5, 1); F.table(-3.2, -1.2, 1.4, .8, .76, M({ map: TX.wood('#e0c9a6', [1, 1]) }), 4);
        F.sofa(-1.6, 1.1, -Math.PI / 2, '#5d6e86'); F.rug(-2.8, 1.3, 2.4, 2.2, '#d9c9a8'); F.tv(-4.6, 1.3, Math.PI / 2); F.plant(.4, 3, 1);
        F.bed(3.1, -1.9, 0, '#6d8a6e'); F.wardrobe(4.55, 1.8, -Math.PI / 2);
        deck(3.5, 5.3, M({ map: TX.tiles('#c9c2b7', '#9c948a', [8, 2]), roughness: .8 }), 'glass');
        F.table(-2, 4.4, .7, .7, .74, M({ color: 0x2f3a3a, metalness: .6, roughness: .4 }), 2);
        [-4.3, 4.3].forEach(x => F.plant(x, 4.9, 1.3));
        const GY = -22;
        box(10.6, -GY - .15, 7.6, M({ map: TX.plaster('#d6d0c6', [4, 8]) }), 0, GY, 0, { cast: false });
        terrain(800, 10, M({ color: 0x8b8f8a, roughness: 1 }), GY, 0, 0);
        skyline(90, GY, 46);
        for (let i = 0; i < 12; i++) tree(-40 + i * 7, 30, 1.4); G.children.slice(-12 * 5).forEach(m => { m.position.y += GY; });
        bounds = { x0: -5, x1: 5, z0: -3.4, z1: 5.2 };
        stops = [['סלון', [-2.6, 2.2], Math.PI * 1.2], ['מטבח ופינת אוכל', [-1.2, -.3], Math.PI * .45], ['חדר שינה', [3, .8], 0], ['מרפסת עם נוף לעיר', [0, 4.6], Math.PI, -.08]];
      },
      desert() {
        const wallM = M({ map: TX.stone('#cdb48f', [1, 1]), roughness: .95 });
        const floor = M({ map: TX.tiles('#c07a52', '#8f5a3c', [6, 4]), roughness: .7 });
        house({ wallMat: wallM, innerMat: M({ map: TX.plaster('#e8dcc6', [1, 1]) }), floorMat: floor,
          front: [{ a: -4.2, b: -.8, sill: 0, top: 2.3, slide: true }, { a: 2.2, b: 4, sill: .9, top: 2.1 }], right: [{ a: -.8, b: .8, sill: 1, top: 2 }] });
        gable(M({ color: 0x8a7a64, roughness: 1 }), 2.8, 1, .8);
        F.sofa(-2.6, 1.2, Math.PI, '#b86b3e'); F.rug(-2.6, .1, 3, 2.2, '#8a3f2a'); F.table(-2.6, -.2, 1.1, .6, .4);
        F.kitchen(-4.6, -2.6, -3.5, 1); F.plant(-.5, 3, .9);
        F.bed(3.2, -1.9, 0, '#e8d8b8'); F.wardrobe(4.55, 1.8, -Math.PI / 2);
        deck(3.5, 7, M({ map: TX.wood('#9a7650', [1, 1]), roughness: .8 }));
        pergola(3.5, 7, M({ map: TX.wood('#6a4e34', [1, 1]) }));
        F.lounger(2.8, 5.3, Math.PI); F.lounger(4, 5.3, Math.PI);
        const sandM = M({ map: TX.sand('#d9b27c', [50, 50]), roughness: 1 });
        terrain(500, 90, sandM, -.15, 1, 14, dunes);
        [[-80, 140, 40, 26], [30, 180, 60, 34], [120, 120, 36, 22], [-160, 40, 50, 30], [150, -60, 45, 28], [-60, -150, 55, 30]].forEach(([x, z, r, h]) => mesa(x, z, r, h, R() < .5 ? 0xb4704a : 0xa9603f));
        firePit(0, 10);
        for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; box(.5, .4, .5, M({ color: 0x8b6b4a }), Math.cos(a) * 1.6, -.1, 10 + Math.sin(a) * 1.6); }
        [[-8, 12], [9, 13], [-12, -2]].forEach(([x, z]) => { cyl(.08, .12, 1.2, M({ color: 0x6b5a45 }), x, -.1, z, 6, { solid: true }); foliage(x, .9, z, .7, 2, '#7a8a4a'); });
        bounds = { x0: -20, x1: 20, z0: -10, z1: 22 };
        stops = [['סלון', [-2.6, -.6], Math.PI], ['חדר שינה', [3, .8], 0], ['מרפסת', [0, 5], Math.PI], ['מדורה וכוכבים', [0, 7.6], Math.PI * 1.05]];
      }
    };

    /* ---------- תנועה ---------- */
    const state = { yaw: Math.PI, pitch: 0, pos: new T.Vector3(0, 0, 0), keys: {}, drag: null, tour: null, target: null };
    const EYE = 1.6, RAD = .28;
    function hit(x, z) {
      if (x < bounds.x0 || x > bounds.x1 || z < bounds.z0 || z > bounds.z1) return true;
      return colliders.some(c => x > c.x0 - RAD && x < c.x1 + RAD && z > c.z0 - RAD && z < c.z1 + RAD);
    }
    function moveBy(dx, dz) {
      const p = state.pos;
      if (!hit(p.x + dx, p.z + dz)) { p.x += dx; p.z += dz; }
      else if (!hit(p.x + dx, p.z)) p.x += dx;
      else if (!hit(p.x, p.z + dz)) p.z += dz;
    }
    function goStop(i, instant) {
      const s = stops[i]; if (!s) return;
      state.target = { x: s[1][0], z: s[1][1], yaw: s[2], pitch: s[3] || 0, t0: performance.now(), from: { x: state.pos.x, z: state.pos.z, yaw: state.yaw, pitch: state.pitch } };
      if (instant) { state.pos.set(s[1][0], 0, s[1][1]); state.yaw = s[2]; state.pitch = s[3] || 0; state.target = null; }
      if (opts.onStop) opts.onStop(i);
    }
    const el = renderer.domElement;
    el.style.touchAction = 'none';
    const onDown = (e) => { state.drag = { x: e.clientX, y: e.clientY, yaw: state.yaw, pitch: state.pitch }; el.setPointerCapture && el.setPointerCapture(e.pointerId); stopTour(); };
    const onMove = (e) => { if (!state.drag) return; const k = pano ? .0035 : .004; state.yaw = state.drag.yaw + (e.clientX - state.drag.x) * k; state.pitch = Math.max(-1.3, Math.min(1.3, state.drag.pitch + (e.clientY - state.drag.y) * k)); state.target = null; };
    const onUp = () => { state.drag = null; };
    const KEYMAP = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
    const onKey = (down) => (e) => { const k = KEYMAP[e.code]; if (!k || !container.isConnected) return; if (document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return; state.keys[k] = down; if (down) { stopTour(); state.target = null; e.preventDefault(); } };
    const kd = onKey(true), ku = onKey(false);
    el.addEventListener('pointerdown', onDown); el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp); el.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);

    let tourTimer = null;
    function stopTour() { if (tourTimer) { clearInterval(tourTimer); tourTimer = null; if (opts.onTour) opts.onTour(false); } }
    function startTour() { stopTour(); let i = 0; goStop(0); tourTimer = setInterval(() => { i = (i + 1) % stops.length; goStop(i); }, 4500); if (opts.onTour) opts.onTour(true); }

    /* ---------- לולאה ---------- */
    const clock = new T.Clock();
    function frame() {
      const dt = Math.min(.05, clock.getDelta());
      if (state.target) {
        const tg = state.target; tg.t = Math.min(1, (performance.now() - tg.t0) / 1600);
        const e = tg.t < .5 ? 2 * tg.t * tg.t : 1 - Math.pow(-2 * tg.t + 2, 2) / 2;
        state.pos.x = tg.from.x + (tg.x - tg.from.x) * e; state.pos.z = tg.from.z + (tg.z - tg.from.z) * e;
        let dy = tg.yaw - tg.from.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        state.yaw = tg.from.yaw + dy * e; state.pitch = tg.from.pitch + (tg.pitch - tg.from.pitch) * e;
        if (tg.t >= 1) state.target = null;
      } else if (!pano) {
        const sp = 2.2 * dt; let f = 0, s = 0;
        if (state.keys.f) f += 1; if (state.keys.b) f -= 1; if (state.keys.l) s -= 1; if (state.keys.r) s += 1;
        if (f || s) { const fx = -Math.sin(state.yaw), fz = -Math.cos(state.yaw); moveBy((fx * f - fz * s) * sp, (fz * f + fx * s) * sp); }
      }
      if (renderer.xr.isPresenting) { rig.position.set(state.pos.x, 0, state.pos.z); rig.rotation.set(0, state.yaw, 0); camera.position.set(0, 0, 0); }
      else {
        rig.position.set(state.pos.x, pano ? 0 : EYE, state.pos.z); rig.rotation.set(0, 0, 0);
        camera.rotation.set(-state.pitch, state.yaw, 0, 'YXZ'); camera.position.set(0, 0, 0);
      }
      const t = clock.elapsedTime;
      water.forEach((w, i) => { if (w.map) { w.map.offset.x = Math.sin(t * .15 + i) * .05; w.map.offset.y = t * .02; } });
      renderer.render(scene, camera);
    }
    renderer.setAnimationLoop(frame);

    function resize() { const w = container.clientWidth || 300, h = container.clientHeight || 300; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    const ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(container); else window.addEventListener('resize', resize);
    resize();

    function build(preset) {
      stopTour(); clearWorld(); if (pano) { scene.remove(pano); pano = null; }
      sky.visible = true;
      world = new T.Group(); G = world; scene.add(world);
      (BUILD[preset] || BUILD.zimmer)();
      applyTime(time);
      goStop(0, true);
      renderer.shadowMap.needsUpdate = true;
    }
    build(PRESETS[opts.preset] ? opts.preset : 'zimmer');

    let xrSession = null;
    return {
      stops: () => stops.map(s => s[0]),
      go: goStop,
      setTime: applyTime,
      setPreset: build,
      tour: (on) => on ? startTour() : stopTour(),
      hold(dir, on) { state.keys[dir] = on; if (on) { stopTour(); state.target = null; } },
      turn(d) { state.yaw += d; state.target = null; },
      load360(url) {
        return new Promise((resolve, reject) => {
          new T.TextureLoader().load(url, (tx) => {
            track(tx); tx.colorSpace = T.SRGBColorSpace;
            clearWorld(); stopTour(); if (pano) scene.remove(pano);
            const g = track(new T.SphereGeometry(40, 64, 32)); g.scale(-1, 1, 1);
            pano = new T.Mesh(g, track(new T.MeshBasicMaterial({ map: tx, fog: false })));
            scene.add(pano); sky.visible = false; stars.visible = false; sunDisc.visible = false;
            stops = []; state.pos.set(0, 0, 0); state.yaw = 0; state.pitch = 0; state.target = null;
            resolve();
          }, undefined, reject);
        });
      },
      async vrSupported() { try { return !!(navigator.xr && await navigator.xr.isSessionSupported('immersive-vr')); } catch (e) { return false; } },
      async enterVR() {
        if (xrSession) { xrSession.end(); return; }
        const s = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
        xrSession = s; renderer.xr.setReferenceSpaceType('local-floor');
        await renderer.xr.setSession(s);
        s.addEventListener('end', () => { xrSession = null; if (opts.onVR) opts.onVR(false); });
        if (opts.onVR) opts.onVR(true);
      },
      dispose() {
        stopTour(); renderer.setAnimationLoop(null);
        if (xrSession) try { xrSession.end(); } catch (e) { /* */ }
        if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
        window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
        clearWorld();
        res.forEach(r => { try { r.dispose(); } catch (e) { /* */ } });
        renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss();
        el.remove();
      }
    };
  }

  window.MasaVR = { PRESETS, start };
})();
