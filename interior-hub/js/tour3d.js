/* 3D walkthrough: first-person walk with 360° look-around, plus a dollhouse view.
   Built from the same plan the 2D drawing uses. Needs THREE (r128) as a global. */
(function () {
  'use strict';
  const EYE = 1.6;
  const RADIUS = 0.22;

  function shade(hex, k) {
    const c = new THREE.Color(hex);
    const hsl = {};
    c.getHSL(hsl);
    c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + k)));
    return c;
  }

  /* ---------- procedural textures ---------- */
  function canvasTex(size, draw, repeat) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (repeat) t.repeat.set(repeat[0], repeat[1]);
    t.anisotropy = 4;
    return t;
  }
  function woodTex(base) {
    return canvasTex(512, (g, s) => {
      const planks = 6;
      const ph = s / planks;
      for (let i = 0; i < planks; i++) {
        let x = -((i * 173) % 300);
        while (x < s) {
          const len = 260 + ((i * 97 + x * 7) % 160);
          const k = (((i * 31 + Math.floor(x)) * 9301 + 49297) % 233280) / 233280 - 0.5;
          g.fillStyle = '#' + shade(base, k * 0.08).getHexString();
          g.fillRect(x, i * ph, len, ph);
          g.strokeStyle = 'rgba(0,0,0,0.06)';
          for (let j = 0; j < 5; j++) {
            g.beginPath();
            const yy = i * ph + 6 + j * (ph / 5);
            g.moveTo(x, yy);
            g.bezierCurveTo(x + len * 0.3, yy + 3, x + len * 0.6, yy - 3, x + len, yy);
            g.stroke();
          }
          g.fillStyle = 'rgba(0,0,0,0.18)';
          g.fillRect(x, i * ph, 1.5, ph);
          x += len;
        }
        g.fillStyle = 'rgba(0,0,0,0.2)';
        g.fillRect(0, i * ph, s, 1.5);
      }
    });
  }
  function tileTex(base, grout, n) {
    return canvasTex(512, (g, s) => {
      const step = s / n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const k = (((i * 7 + j * 13) * 9301 + 49297) % 233280) / 233280 - 0.5;
          g.fillStyle = '#' + shade(base, k * 0.03).getHexString();
          g.fillRect(i * step, j * step, step, step);
        }
      }
      g.strokeStyle = grout;
      g.lineWidth = 3;
      for (let i = 0; i <= n; i++) {
        g.beginPath(); g.moveTo(i * step, 0); g.lineTo(i * step, s); g.stroke();
        g.beginPath(); g.moveTo(0, i * step); g.lineTo(s, i * step); g.stroke();
      }
    });
  }
  function concreteTex(base) {
    return canvasTex(256, (g, s) => {
      g.fillStyle = base;
      g.fillRect(0, 0, s, s);
      for (let i = 0; i < 2600; i++) {
        const v = Math.random();
        g.fillStyle = `rgba(${v > 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.05})`;
        g.fillRect(Math.random() * s, Math.random() * s, 2 + Math.random() * 3, 2 + Math.random() * 3);
      }
    });
  }

  class Tour {
    constructor(container, opts) {
      this.el = container;
      this.opts = opts || {};
      this.mode = 'walk';
      this.yaw = 0;
      this.pitch = -0.05;
      this.pos = new THREE.Vector3(1, EYE, 1);
      this.keys = {};
      this.hold = {};
      this.mats = {};
      this.blockers = [];
      this.pickables = [];
      this.spin = 0;
      this.orbit = { az: -0.7, el: 0.95, dist: 14, target: new THREE.Vector3() };
      this.walkTo = null;

      const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer = r;
      container.appendChild(r.domElement);
      r.domElement.className = 'tour-canvas';
      r.domElement.setAttribute('tabindex', '0');
      r.domElement.setAttribute('aria-label', 'סיור תלת-ממדי בדירה. גררו כדי להסתכל, חיצים או WASD כדי ללכת');

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(72, 1, 0.05, 200);
      this.ray = new THREE.Raycaster();
      this.clock = new THREE.Clock();

      this.bindInput();
      this.resize();
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(container);
      this.loop = this.loop.bind(this);
      this.running = true;
      requestAnimationFrame(this.loop);
    }

    /* ---------- scene ---------- */
    mat(color, opts) {
      const key = color + JSON.stringify(opts || {});
      if (!this.mats[key]) this.mats[key] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.8, metalness: 0 }, opts || {}));
      return this.mats[key];
    }

    load(plan) {
      this.plan = plan;
      const scene = this.scene;
      while (scene.children.length) scene.remove(scene.children[0]);
      Object.values(this.mats).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
      this.mats = {};
      this.blockers = [];
      this.pickables = [];
      this.itemGroups = {};
      const st = plan.style;
      this.st = st;

      scene.background = new THREE.Color('#cfdde6');
      scene.fog = new THREE.Fog('#cfdde6', 30, 90);
      scene.add(new THREE.HemisphereLight('#ffffff', '#8f8676', 0.62));
      const sun = new THREE.DirectionalLight('#fff4e0', 0.45);
      sun.position.set(plan.W * 0.3, 12, -8);
      scene.add(sun);
      scene.add(new THREE.AmbientLight('#ffffff', 0.18));
      const fill = new THREE.DirectionalLight('#e8eef5', 0.2);
      fill.position.set(-6, 8, plan.D + 6);
      scene.add(fill);

      // ground outside
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), this.mat('#b8bfae'));
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(plan.W / 2, -0.02, plan.D / 2);
      scene.add(ground);

      // floors
      const woodMat = new THREE.MeshStandardMaterial({ map: woodTex(st.floor), roughness: 0.7 });
      const tileMat = new THREE.MeshStandardMaterial({ map: st.floorKind === 'concrete' ? concreteTex(st.floor) : tileTex(st.tile, 'rgba(0,0,0,0.12)', 4), roughness: 0.55 });
      const wetMat = new THREE.MeshStandardMaterial({ map: tileTex('#dcdad5', 'rgba(0,0,0,0.15)', 8), roughness: 0.5 });
      const deckMat = new THREE.MeshStandardMaterial({ map: woodTex('#9a7b5c'), roughness: 0.85 });
      plan.rooms.forEach((rm) => {
        const wet = ['bath', 'wc', 'ensuite', 'utility'].includes(rm.kind);
        const pub = ['kitchen', 'corridor', 'dining', 'living'].includes(rm.kind);
        let m = rm.outdoor ? deckMat : wet ? wetMat : (pub && st.floorKind !== 'wood') ? tileMat : (st.floorKind === 'concrete' ? tileMat : woodMat);
        m = m.clone();
        m.map = m.map.clone();
        m.map.needsUpdate = true;
        const sc = rm.outdoor ? 1.6 : wet ? 1.6 : m.map === woodMat.map || m.map.image === woodMat.map.image ? 1.3 : 2.4;
        m.map.repeat.set(rm.w / sc, rm.d / sc);
        const fl = new THREE.Mesh(new THREE.PlaneGeometry(rm.w, rm.d), m);
        fl.rotation.x = -Math.PI / 2;
        fl.position.set(rm.x + rm.w / 2, 0.001, rm.y + rm.d / 2);
        fl.userData.floor = true;
        fl.userData.roomId = rm.id;
        scene.add(fl);
        this.pickables.push(fl);
      });

      // ceiling
      this.ceiling = new THREE.Mesh(new THREE.PlaneGeometry(plan.W, plan.D), new THREE.MeshBasicMaterial({ color: '#e4e3de' }));
      this.ceiling.rotation.x = Math.PI / 2;
      this.ceiling.position.set(plan.W / 2, plan.wallH, plan.D / 2);
      scene.add(this.ceiling);

      // walls
      this.walls = new THREE.Group();
      scene.add(this.walls);
      plan.segs.forEach((s) => this.buildWall(s));

      // balcony railing
      const bal = plan.rooms.find((r) => r.outdoor);
      if (bal) {
        const glass = this.mat('#a9c7d3', { transparent: true, opacity: 0.35, roughness: 0.1 });
        const rail = this.mat('#3a3a3a', { metalness: 0.4, roughness: 0.4 });
        const add = (x, z, w, d) => {
          const g = new THREE.Mesh(new THREE.BoxGeometry(w, 1.0, d), glass);
          g.position.set(x, 0.5, z);
          this.walls.add(g);
          const t = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.05, d + 0.04), rail);
          t.position.set(x, 1.05, z);
          this.walls.add(t);
          this.blockers.push({ x0: x - w / 2 - 0.02, x1: x + w / 2 + 0.02, z0: z - d / 2 - 0.02, z1: z + d / 2 + 0.02 });
        };
        add(bal.x + bal.w / 2, bal.y, bal.w, 0.04);
        add(bal.x, bal.y + bal.d / 2, 0.04, bal.d);
        add(bal.x + bal.w, bal.y + bal.d / 2, 0.04, bal.d);
      }

      // furniture
      plan.items.forEach((it) => {
        const g = this.buildItem(it);
        if (!g) return;
        g.traverse((o) => { o.userData.itemId = it.id; if (o.isMesh) this.pickables.push(o); });
        this.scene.add(g);
        this.itemGroups[it.id] = g;
        const solid = it.type !== 'rug' && it.z < 1 && it.h > 0.3 && !['pendant', 'tv', 'kitchenUpper', 'hood'].includes(it.type);
        if (solid) {
          this.blockers.push({ x0: it.x, x1: it.x + it.w, z0: it.y, z1: it.y + it.d, item: true });
          (it.parts || []).forEach((p) => this.blockers.push({ x0: p.x, x1: p.x + p.w, z0: p.y, z1: p.y + p.d, item: true }));
        }
      });

      // start at the front door, looking into the home
      const corr = plan.rooms.find((r) => r.kind === 'corridor');
      if (corr) { this.pos.set(1.0, EYE, corr.y + corr.d / 2); this.yaw = -0.9; }
      else { const k = plan.rooms.find((r) => r.kind === 'kitchen'); this.pos.set(1.4, EYE, k.d - 0.6); this.yaw = -0.9; }
      this.pitch = -0.08;
      this.orbit.target.set(plan.W / 2, 0, plan.D / 2);
      this.orbit.dist = Math.max(plan.W, plan.D) * 1.25;
      this.selectBox = null;
      this.setMode(this.mode);
    }

    buildWall(s) {
      const H = this.plan.wallH;
      const horiz = s.y1 === s.y2;
      const len = horiz ? s.x2 - s.x1 : s.y2 - s.y1;
      const th = s.ext ? 0.2 : 0.1;
      const wallMat = this.mat(this.st.wall, { roughness: 0.95 });
      const box = (t0, t1, y0, y1, mat, block) => {
        const w = t1 - t0;
        if (w <= 0.001 || y1 - y0 <= 0.001) return;
        const ext0 = t0 === 0 ? th / 2 : 0, ext1 = t1 === len ? th / 2 : 0;
        const L = w + ext0 + ext1;
        const c = t0 - ext0 + L / 2;
        const geo = horiz ? new THREE.BoxGeometry(L, y1 - y0, th) : new THREE.BoxGeometry(th, y1 - y0, L);
        const m = new THREE.Mesh(geo, mat || wallMat);
        const x = horiz ? s.x1 + c : s.x1;
        const z = horiz ? s.y1 : s.y1 + c;
        m.position.set(x, (y0 + y1) / 2, z);
        this.walls.add(m);
        if (block) {
          this.blockers.push(horiz ? { x0: x - L / 2, x1: x + L / 2, z0: z - th / 2, z1: z + th / 2 } : { x0: x - th / 2, x1: x + th / 2, z0: z - L / 2, z1: z + L / 2 });
        }
      };
      let t = 0;
      s.open.forEach((o) => {
        box(t, o.t0, 0, H, null, true);
        const isWin = o.type === 'window';
        if (isWin) box(o.t0, o.t1, 0, o.sill, null, true);
        box(o.t0, o.t1, o.head, H, null, false);
        if (isWin || o.type === 'slider') {
          const glass = this.mat('#b7d3de', { transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1 });
          const frame = this.mat('#2f3336', { roughness: 0.5, metalness: 0.3 });
          box(o.t0, o.t1, o.sill, o.head, glass, o.type === 'slider' ? false : true);
          // frame: sill, head and mullion
          const fr = (t0, t1, y0, y1) => {
            const w = t1 - t0;
            const geo = horiz ? new THREE.BoxGeometry(w, y1 - y0, th + 0.02) : new THREE.BoxGeometry(th + 0.02, y1 - y0, w);
            const m = new THREE.Mesh(geo, frame);
            m.position.set(horiz ? s.x1 + (t0 + t1) / 2 : s.x1, (y0 + y1) / 2, horiz ? s.y1 : s.y1 + (t0 + t1) / 2);
            this.walls.add(m);
          };
          fr(o.t0, o.t1, o.sill, o.sill + 0.04);
          fr(o.t0, o.t1, o.head - 0.04, o.head);
          fr(o.t0, o.t0 + 0.04, o.sill, o.head);
          fr(o.t1 - 0.04, o.t1, o.sill, o.head);
          fr((o.t0 + o.t1) / 2 - 0.02, (o.t0 + o.t1) / 2 + 0.02, o.sill, o.head);
        } else {
          // door frame
          const frame = this.mat(o.type === 'entry' ? '#4a3a2c' : '#e9e7e2', { roughness: 0.6 });
          const fr = (t0, t1, y0, y1) => {
            const w = t1 - t0;
            const geo = horiz ? new THREE.BoxGeometry(w, y1 - y0, th + 0.03) : new THREE.BoxGeometry(th + 0.03, y1 - y0, w);
            const m = new THREE.Mesh(geo, frame);
            m.position.set(horiz ? s.x1 + (t0 + t1) / 2 : s.x1, (y0 + y1) / 2, horiz ? s.y1 : s.y1 + (t0 + t1) / 2);
            this.walls.add(m);
          };
          fr(o.t0, o.t0 + 0.05, 0, o.head);
          fr(o.t1 - 0.05, o.t1, 0, o.head);
          fr(o.t0, o.t1, o.head - 0.05, o.head);
          if (o.type === 'door' || o.type === 'entry') {
            // open door leaf against the wall inside the room
            const w = o.t1 - o.t0 - 0.08;
            const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.04, o.head - 0.07, w), this.mat(o.type === 'entry' ? '#5b4636' : '#f1efea', { roughness: 0.6 }));
            const hingeT = o.hinge === 'end' ? o.t1 - 0.04 : o.t0 + 0.04;
            const sign = o.into === 'S' || o.into === 'E' ? 1 : -1;
            if (horiz) {
              leaf.position.set(s.x1 + hingeT + (o.hinge === 'end' ? -0.03 : 0.03), (o.head - 0.07) / 2, s.y1 + sign * (w / 2 + th / 2));
            } else {
              leaf.rotation.y = Math.PI / 2;
              leaf.position.set(s.x1 + sign * (w / 2 + th / 2), (o.head - 0.07) / 2, s.y1 + hingeT + (o.hinge === 'end' ? -0.03 : 0.03));
            }
            this.walls.add(leaf);
          }
        }
        t = o.t1;
      });
      box(t, len, 0, H, null, true);
    }

    /* ---------- furniture models ---------- */
    buildItem(it) {
      const st = this.st;
      const g = new THREE.Group();
      const faceRot = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 }[it.face || 'S'];
      const side = it.face === 'E' || it.face === 'W';
      const W = side ? it.d : it.w;
      const D = side ? it.w : it.d;
      const H = it.h;
      const M = (c, o) => this.mat(c, o);
      const box = (w, h, d, x, y, z, m, parent) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.max(w, 0.005), Math.max(h, 0.005), Math.max(d, 0.005)), m);
        mesh.position.set(x, y + h / 2, z);
        (parent || g).add(mesh);
        return mesh;
      };
      const cyl = (rt, rb, h, x, y, z, m, seg) => {
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 20), m);
        mesh.position.set(x, y + h / 2, z);
        g.add(mesh);
        return mesh;
      };
      const legs = (w, d, h, m, inset, r) => {
        const i = inset || 0.05;
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => cyl(r || 0.018, r || 0.018, h, a * (w / 2 - i), 0, b * (d / 2 - i), m, 8));
      };
      const wood = M(st.wood, { roughness: 0.6 });
      const woodDark = M('#' + shade(st.wood, -0.12).getHexString(), { roughness: 0.6 });
      const fabric = M(st.fabric, { roughness: 0.95 });
      const fabric2 = M(st.fabric2, { roughness: 0.95 });
      const metal = M(st.metal, { roughness: 0.4, metalness: 0.5 });
      const white = M('#f4f3ef', { roughness: 0.5 });
      const counter = M('#e6e3dc', { roughness: 0.35 });
      const steel = M('#c9ccce', { roughness: 0.3, metalness: 0.6 });
      const black = M('#1d1e20', { roughness: 0.3 });
      const ceramic = M('#fbfbf9', { roughness: 0.2 });
      const front = M(st.floorKind === 'wood' ? '#f2f0eb' : '#' + shade(st.fabric2, 0.05).getHexString(), { roughness: 0.5 });

      const sofa = (w, d, withArms) => {
        box(w, 0.1, d, 0, 0.06, 0, fabric2);
        legs(w, d, 0.06, metal, 0.08, 0.02);
        box(w - (withArms ? 0.36 : 0.04), 0.3, d - 0.2, 0, 0.16, 0.08, fabric);
        box(w, 0.42, 0.2, 0, 0.16, -d / 2 + 0.1, fabric);
        if (withArms) { box(0.18, 0.46, d, -w / 2 + 0.09, 0.16, 0, fabric); box(0.18, 0.46, d, w / 2 - 0.09, 0.16, 0, fabric); }
        const pc = M(st.accent, { roughness: 0.95 });
        const n = Math.max(1, Math.round((w - 0.4) / 0.6));
        for (let i = 0; i < n; i++) {
          const px = -w / 2 + 0.2 + (i + 0.5) * ((w - 0.4) / n);
          const p = box(0.42, 0.4, 0.14, px, 0.44, -d / 2 + 0.26, i % 2 ? pc : fabric);
          p.rotation.x = -0.18;
        }
      };

      switch (it.type) {
        case 'sofa2': case 'sofa3': case 'sofaL': case 'sofaBed':
          sofa(W, D, true);
          break;
        case 'armchair':
          sofa(W, D, true);
          break;
        case 'chair':
          box(W * 0.9, 0.04, D * 0.8, 0, 0.44, 0.03, wood);
          legs(W * 0.9, D * 0.8, 0.44, wood, 0.03, 0.015);
          box(W * 0.9, 0.4, 0.035, 0, 0.48, -D * 0.4 + 0.02, wood);
          break;
        case 'officeChair':
          box(W * 0.8, 0.07, D * 0.75, 0, 0.45, 0.03, fabric2);
          box(W * 0.75, 0.5, 0.06, 0, 0.55, -D * 0.35, fabric2);
          cyl(0.025, 0.025, 0.4, 0, 0.06, 0, metal, 8);
          cyl(0.28, 0.28, 0.04, 0, 0.02, 0, metal, 5);
          break;
        case 'stool':
          cyl(0.2, 0.2, 0.05, 0, 0.62, 0, wood);
          legs(0.3, 0.3, 0.62, metal, 0.02, 0.012);
          box(0.3, 0.02, 0.02, 0, 0.3, 0, metal);
          break;
        case 'coffeeTable':
          box(W, 0.04, D, 0, 0.36, 0, wood);
          box(W - 0.1, 0.02, D - 0.1, 0, 0.12, 0, woodDark);
          legs(W, D, 0.36, woodDark, 0.06, 0.02);
          break;
        case 'sideTable':
          cyl(W / 2, W / 2, 0.03, 0, 0.52, 0, wood);
          cyl(0.02, 0.02, 0.52, 0, 0, 0, metal, 8);
          cyl(0.15, 0.15, 0.02, 0, 0, 0, metal);
          break;
        case 'diningTable':
          box(W, 0.045, D, 0, 0.715, 0, wood);
          legs(W, D, 0.715, woodDark, 0.08, 0.03);
          break;
        case 'desk':
          box(W, 0.035, D, 0, 0.705, 0, wood);
          legs(W, D, 0.705, metal, 0.04, 0.015);
          box(0.4, 0.3, 0.02, 0, 0.74, -D / 2 + 0.12, black); // monitor
          box(0.06, 0.1, 0.06, 0, 0.74, -D / 2 + 0.14, metal);
          break;
        case 'tvConsole':
          box(W, H - 0.1, D, 0, 0.1, 0, wood);
          legs(W, D, 0.1, metal, 0.05, 0.012);
          for (let i = 1; i < 3; i++) box(0.005, H - 0.16, 0.005, -W / 2 + (W * i) / 3, 0.13, D / 2 + 0.002, woodDark);
          break;
        case 'tv':
          box(W, H, 0.04, 0, 0, 0, black);
          box(W - 0.03, H - 0.03, 0.002, 0, 0.015, 0.021, M('#202a33', { roughness: 0.15, emissive: '#0d1620', emissiveIntensity: 0.6 }));
          break;
        case 'rug': {
          box(W, 0.012, D, 0, 0, 0, M(st.rug, { roughness: 1 }));
          box(W - 0.2, 0.013, D - 0.2, 0, 0, 0, M('#' + shade(st.rug, -0.06).getHexString(), { roughness: 1 }));
          break;
        }
        case 'floorLamp':
          cyl(0.14, 0.14, 0.03, 0, 0, 0, metal);
          cyl(0.012, 0.012, 1.4, 0, 0.03, 0, metal, 8);
          cyl(0.13, 0.2, 0.26, 0, 1.36, 0, M('#f3ead8', { emissive: '#ffe2b0', emissiveIntensity: 0.5 }));
          break;
        case 'pendant': {
          const top = this.plan.wallH;
          cyl(0.006, 0.006, top - it.z - H, 0, H, 0, black, 6);
          cyl(0.08, 0.25, H, 0, 0, 0, M(st.metal, { roughness: 0.4, metalness: 0.4, side: THREE.DoubleSide }));
          const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), M('#fff6df', { emissive: '#ffe6b8', emissiveIntensity: 1 }));
          bulb.position.set(0, 0.03, 0);
          g.add(bulb);
          break;
        }
        case 'plant': {
          cyl(W * 0.38, W * 0.3, 0.38, 0, 0, 0, M('#b9744a', { roughness: 0.9 }));
          const leaf = M('#4d6b3c', { roughness: 0.9 });
          const n = 6;
          for (let i = 0; i < n; i++) {
            const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 + (i % 3) * 0.05, 0), leaf);
            s.position.set(Math.cos(i * 2.1) * 0.12, 0.55 + i * ((H - 0.6) / n), Math.sin(i * 2.1) * 0.12);
            g.add(s);
          }
          break;
        }
        case 'bookshelf': {
          box(0.02, H, D, -W / 2 + 0.01, 0, 0, wood);
          box(0.02, H, D, W / 2 - 0.01, 0, 0, wood);
          const n = Math.max(3, Math.round(H / 0.38));
          const colors = [st.accent, st.fabric2, '#c9b28a', '#7d8a8c', '#a4563a', '#e0d8c8'];
          for (let i = 0; i <= n; i++) {
            const y = (i * (H - 0.02)) / n;
            box(W, 0.02, D, 0, y, 0, wood);
            if (i < n) {
              let x = -W / 2 + 0.04;
              let k = i * 3;
              while (x < W / 2 - 0.12) {
                const bw = 0.03 + ((k * 7) % 5) * 0.008;
                const bh = 0.2 + ((k * 11) % 5) * 0.02;
                box(bw, bh, D * 0.7, x + bw / 2, y + 0.02, 0, M(colors[k % colors.length]));
                x += bw + 0.004;
                k++;
                if ((k * 13) % 9 === 0) x += 0.12;
              }
            }
          }
          break;
        }
        case 'wardrobe': {
          box(W, H, D, 0, 0, 0, front);
          const n = Math.max(2, Math.round(W / 0.5));
          for (let i = 1; i < n; i++) box(0.006, H - 0.1, 0.006, -W / 2 + (W * i) / n, 0.05, D / 2 + 0.003, woodDark);
          for (let i = 0; i < n; i++) box(0.015, 0.25, 0.02, -W / 2 + (W * (i + 0.5)) / n + ((i % 2) ? -1 : 1) * (W / n / 2 - 0.06), 1.0, D / 2 + 0.01, metal);
          break;
        }
        case 'dresser':
          box(W, H, D, 0, 0, 0, wood);
          for (let i = 1; i < 3; i++) box(W - 0.06, 0.006, 0.006, 0, (H * i) / 3, D / 2 + 0.003, woodDark);
          box(W * 0.6, 0.8, 0.02, 0, H + 0.2, -D / 2 + 0.01, M('#dfe8ec', { roughness: 0.05, metalness: 0.6 }));
          break;
        case 'nightstand': {
          box(W, H, D, 0, 0, 0, wood);
          box(W - 0.04, 0.006, 0.006, 0, H * 0.55, D / 2 + 0.003, woodDark);
          cyl(0.05, 0.07, 0.2, 0, H, 0, ceramic);
          cyl(0.09, 0.13, 0.16, 0, H + 0.2, 0, M('#f4ecdc', { emissive: '#ffe0b0', emissiveIntensity: 0.35 }));
          break;
        }
        case 'bedDouble': case 'bedSingle': {
          const frameH = 0.28;
          box(W, frameH, D, 0, 0.04, 0, woodDark);
          legs(W, D, 0.04, woodDark, 0.06, 0.03);
          box(W - 0.04, 0.2, D - 0.1, 0, 0.32, 0.03, white);
          box(W + 0.02, 0.06, D * 0.62, 0, 0.5, D * 0.19, fabric2);
          box(W, 1.0, 0.08, 0, 0.04, -D / 2 + 0.04, it.type === 'bedDouble' ? fabric : wood);
          const n = it.type === 'bedDouble' ? 2 : 1;
          for (let i = 0; i < n; i++) box(W / n - 0.14, 0.13, 0.36, -W / 2 + (W / n) * (i + 0.5), 0.52, -D / 2 + 0.3, white);
          break;
        }
        case 'bunk': {
          const post = wood;
          [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => box(0.05, H, 0.05, a * (W / 2 - 0.025), 0, b * (D / 2 - 0.025), post));
          [0.2, 1.15].forEach((y, i) => {
            box(W, 0.06, D, 0, y, 0, post);
            box(W - 0.06, 0.16, D - 0.06, 0, y + 0.06, 0, white);
            box(W - 0.04, 0.05, D * 0.6, 0, y + 0.22, D * 0.18, i ? fabric2 : M(st.accent));
          });
          box(0.04, 0.2, D, W / 2 - 0.02, 1.37, 0, post);
          for (let k = 0; k < 4; k++) box(0.04, 0.03, 0.4, W / 2 - 0.02, 0.35 + k * 0.28, D / 2 - 0.3, post);
          break;
        }
        case 'kitchenBase': case 'cooktop': case 'sink': case 'dishwasher': {
          box(W - 0.01, 0.1, D - 0.06, 0, 0, -0.03, black);
          box(W - 0.01, 0.76, D - 0.02, 0, 0.1, -0.01, it.type === 'dishwasher' ? steel : front);
          if (it.type !== 'dishwasher') box(0.005, 0.7, 0.005, 0, 0.13, D / 2 + 0.002, woodDark);
          box(W, 0.04, D + 0.02, 0, 0.86, 0.01, counter);
          if (it.type === 'cooktop') {
            box(Math.min(W - 0.1, 0.6), 0.008, 0.5, 0, 0.9, 0, black);
            box(W - 0.06, 0.55, 0.02, 0, 0.2, D / 2, M('#2a2c2e', { roughness: 0.2 })); // oven door
          }
          if (it.type === 'sink') {
            box(Math.min(W - 0.2, 0.6), 0.012, 0.4, 0, 0.9, 0.02, M('#8c9194', { roughness: 0.3, metalness: 0.6 }));
            cyl(0.015, 0.015, 0.3, 0, 0.9, -D / 2 + 0.08, steel, 8);
            box(0.03, 0.03, 0.18, 0, 1.17, -D / 2 + 0.16, steel);
          }
          break;
        }
        case 'kitchenUpper': {
          box(W - 0.01, H, D, 0, 0, 0, front);
          const n = Math.max(1, Math.round(W / 0.6));
          for (let i = 1; i < n; i++) box(0.005, H - 0.04, 0.005, -W / 2 + (W * i) / n, 0.02, D / 2 + 0.002, woodDark);
          break;
        }
        case 'hood':
          box(W, 0.08, D, 0, 0, 0, steel);
          box(0.3, this.plan.wallH - it.z - 0.08, 0.25, 0, 0.08, -D / 2 + 0.14, steel);
          break;
        case 'fridge':
          box(W - 0.02, H, D - 0.02, 0, 0, 0, steel);
          box(W - 0.04, 0.006, 0.006, 0, H * 0.62, D / 2, black);
          box(0.02, 0.5, 0.03, -W / 2 + 0.06, H * 0.62 + 0.1, D / 2, black);
          box(0.02, 0.5, 0.03, -W / 2 + 0.06, H * 0.62 - 0.6, D / 2, black);
          break;
        case 'island':
          box(W - 0.06, 0.86, D - 0.3, 0, 0, -0.1, front);
          box(W, 0.04, D, 0, 0.86, 0, counter);
          break;
        case 'toilet':
          box(W * 0.9, 0.5, 0.14, 0, 0.3, -D / 2 + 0.07, white);
          box(W * 0.8, 0.22, D * 0.75, 0, 0.18, 0.02, ceramic);
          box(W * 0.8, 0.03, D * 0.72, 0, 0.4, 0.02, white);
          break;
        case 'vanity':
          box(W, 0.45, D, 0, it.small ? 0.4 : 0.35, 0, it.small ? ceramic : wood);
          box(W * 0.8, 0.06, D * 0.8, 0, 0.8, 0, ceramic);
          cyl(0.012, 0.012, 0.2, 0, 0.86, -D / 2 + 0.06, steel, 8);
          box(W * 0.9, 0.75, 0.02, 0, 1.05, -D / 2 + 0.01, M('#dfe8ec', { roughness: 0.05, metalness: 0.6 }));
          break;
        case 'shower':
          box(W, 0.04, D, 0, 0, 0, ceramic);
          box(W, 2.0, 0.01, 0, 0.04, D / 2 - 0.01, M('#bfe0ea', { transparent: true, opacity: 0.25, roughness: 0.05 }));
          box(0.01, 2.0, D, W / 2 - 0.01, 0.04, 0, M('#bfe0ea', { transparent: true, opacity: 0.25, roughness: 0.05 }));
          cyl(0.1, 0.1, 0.02, 0, 2.0, -D / 2 + 0.2, steel);
          break;
        case 'bathtub':
          box(W, 0.55, D, 0, 0, 0, ceramic);
          box(W - 0.14, 0.02, D - 0.14, 0, 0.5, 0, M('#bcd6dd', { roughness: 0.1 }));
          break;
        case 'washer':
          [0, 0.86].forEach((y) => {
            box(W - 0.02, 0.84, D - 0.02, 0, y, 0, white);
            const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 24), M('#39424a', { roughness: 0.2 }));
            drum.rotation.x = Math.PI / 2;
            drum.position.set(0, y + 0.4, D / 2 - 0.005);
            g.add(drum);
          });
          break;
        case 'shoeCabinet':
          box(W, H, D, 0, 0.1, 0, front);
          box(W, 0.1, D - 0.04, 0, 0, -0.02, black);
          box(0.5, 0.7, 0.02, 0, 1.4, -D / 2 + 0.01, M('#dfe8ec', { roughness: 0.05, metalness: 0.6 }));
          break;
        case 'outdoorSet': {
          cyl(0.35, 0.35, 0.03, 0, 0.72, 0, M('#d9d4c7'));
          cyl(0.03, 0.03, 0.72, 0, 0, 0, metal, 8);
          [-1, 1].forEach((k) => {
            box(0.46, 0.04, 0.46, k * 0.55, 0.44, 0, M(st.accent));
            legs(0.46, 0.46, 0.44, metal, 0.03, 0.012);
            const b = box(0.04, 0.4, 0.46, k * 0.55 + k * 0.22, 0.48, 0, M(st.accent));
            b.position.x = k * 0.78;
          });
          break;
        }
        default:
          box(W, H, D, 0, 0, 0, front);
      }

      g.rotation.y = faceRot;
      g.position.set(it.x + it.w / 2, it.z || 0, it.y + it.d / 2);

      // the chaise of an L sofa, in plan coordinates
      if (it.parts && it.parts.length) {
        const outer = new THREE.Group();
        outer.add(g);
        it.parts.forEach((p) => {
          const seat = new THREE.Mesh(new THREE.BoxGeometry(p.w, 0.3, p.d), fabric);
          seat.position.set(p.x + p.w / 2, 0.31, p.y + p.d / 2);
          outer.add(seat);
          const base = new THREE.Mesh(new THREE.BoxGeometry(p.w, 0.1, p.d), fabric2);
          base.position.set(p.x + p.w / 2, 0.11, p.y + p.d / 2);
          outer.add(base);
        });
        return outer;
      }
      return g;
    }

    /* ---------- modes and navigation ---------- */
    setMode(mode) {
      this.mode = mode;
      if (!this.plan) return;
      const doll = mode === 'doll';
      this.ceiling.visible = !doll;
      this.walls.scale.y = doll ? 0.42 : 1;
      this.camera.fov = doll ? 45 : 72;
      this.camera.updateProjectionMatrix();
      this.el.classList.toggle('is-doll', doll);
    }

    goToRoom(roomId) {
      const r = this.plan.rooms.find((x) => x.id === roomId);
      if (!r) return;
      if (this.mode === 'doll') {
        this.orbit.target.set(r.x + r.w / 2, 0, r.y + r.d / 2);
        this.orbit.dist = Math.max(5, Math.max(r.w, r.d) * 2.2);
        return;
      }
      // stand in the freest spot of the room and look across its longest diagonal
      let best = null;
      for (let i = 1; i < 8; i++) {
        for (let j = 1; j < 8; j++) {
          const x = r.x + (r.w * i) / 8, z = r.y + (r.d * j) / 8;
          if (this.collides(x, z, 0.3)) continue;
          const edge = Math.min(x - r.x, r.x + r.w - x, z - r.y, r.y + r.d - z);
          const score = -Math.abs(edge - 0.8) + Math.hypot(x - (r.x + r.w / 2), z - (r.y + r.d / 2)) * 0.3;
          if (!best || score > best.s) best = { x, z, s: score };
        }
      }
      if (!best) best = { x: r.x + r.w / 2, z: r.y + r.d / 2 };
      this.pos.set(best.x, EYE, best.z);
      const cx = r.x + r.w / 2, cz = r.y + r.d / 2;
      const tx = cx + (cx - best.x), tz = cz + (cz - best.z);
      this.yaw = Math.atan2(-(tx - best.x), -(tz - best.z));
      this.pitch = -0.12;
      this.walkTo = null;
    }

    lookAtItem(id) {
      const it = this.plan.items.find((x) => x.id === id);
      if (!it) return;
      const cx = it.x + it.w / 2, cz = it.y + it.d / 2;
      if (this.mode === 'doll') {
        this.orbit.target.set(cx, 0, cz);
        this.orbit.dist = Math.max(4, this.orbit.dist * 0.7);
      } else {
        const room = this.plan.rooms.find((r) => r.id === it.room);
        const inRoom = (p) => p.x > room.x && p.x < room.x + room.w && p.z > room.y && p.z < room.y + room.d;
        if (!inRoom(this.pos)) this.goToRoom(room.id);
        this.targetYaw = Math.atan2(-(cx - this.pos.x), -(cz - this.pos.z));
        const dist = Math.hypot(cx - this.pos.x, cz - this.pos.z) || 1;
        this.targetPitch = Math.atan2((it.z || 0) + it.h / 2 - EYE, dist);
      }
      this.highlight(it);
    }

    highlight(it) {
      if (this.selectBox) { this.scene.remove(this.selectBox); this.selectBox.geometry.dispose(); this.selectBox = null; }
      if (!it) return;
      const h = Math.max(it.h, 0.05);
      const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(it.w + 0.06, h + 0.06, it.d + 0.06));
      const line = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: this.opts.accent || '#c47a2c' }));
      line.position.set(it.x + it.w / 2, (it.z || 0) + h / 2, it.y + it.d / 2);
      this.scene.add(line);
      this.selectBox = line;
    }

    collides(x, z, r) {
      const rad = r || RADIUS;
      const p = this.plan;
      if (x < -0.1 || z < (p.rooms.some((rm) => rm.outdoor) ? -1.9 : -0.1) || x > p.W + 0.1 || z > p.D + 0.1) return true;
      return this.blockers.some((b) => x + rad > b.x0 && x - rad < b.x1 && z + rad > b.z0 && z - rad < b.z1);
    }

    move(dx, dz) {
      const nx = this.pos.x + dx, nz = this.pos.z + dz;
      if (!this.collides(nx, this.pos.z)) this.pos.x = nx;
      if (!this.collides(this.pos.x, nz)) this.pos.z = nz;
    }

    startSpin() { this.spin = Math.PI * 2; this.walkTo = null; }

    /* ---------- input ---------- */
    bindInput() {
      const c = () => this.renderer.domElement;
      let drag = null;
      const pointers = new Map();
      const onDown = (e) => {
        c().focus({ preventScroll: true });
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        drag = { x: e.clientX, y: e.clientY, moved: 0, t: performance.now() };
        c().setPointerCapture(e.pointerId);
        this.spin = 0;
      };
      const onMove = (e) => {
        if (!pointers.has(e.pointerId)) { this.hover(e); return; }
        const prev = pointers.get(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (this.pinch) {
            const k = this.pinch / d;
            if (this.mode === 'doll') this.orbit.dist = Math.max(3, Math.min(60, this.orbit.dist * k));
            else this.move(-Math.sin(this.yaw) * (1 - k) * 2, -Math.cos(this.yaw) * (1 - k) * 2);
          }
          this.pinch = d;
          return;
        }
        const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
        if (drag) drag.moved += Math.abs(dx) + Math.abs(dy);
        if (this.mode === 'doll') {
          this.orbit.az -= dx * 0.006;
          this.orbit.el = Math.max(0.2, Math.min(1.45, this.orbit.el + dy * 0.004));
        } else {
          this.yaw += dx * 0.005;
          this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch + dy * 0.004));
          this.targetYaw = this.targetPitch = undefined;
        }
      };
      const onUp = (e) => {
        pointers.delete(e.pointerId);
        if (pointers.size < 2) this.pinch = null;
        if (drag && drag.moved < 6 && performance.now() - drag.t < 500) this.click(e);
        drag = null;
      };
      c().addEventListener('pointerdown', onDown);
      c().addEventListener('pointermove', onMove);
      c().addEventListener('pointerup', onUp);
      c().addEventListener('pointercancel', onUp);
      c().addEventListener('pointerleave', () => { if (this.opts.onHover) this.opts.onHover(null); });
      c().addEventListener('wheel', (e) => {
        e.preventDefault();
        if (this.mode === 'doll') this.orbit.dist = Math.max(3, Math.min(60, this.orbit.dist * (1 + Math.sign(e.deltaY) * 0.1)));
        else { const k = -Math.sign(e.deltaY) * 0.35; this.move(-Math.sin(this.yaw) * k, -Math.cos(this.yaw) * k); }
      }, { passive: false });
      c().addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', 'ש', 'ג', 'ד', 'כ', "'"].includes(k)) { e.preventDefault(); this.keys[k] = true; this.spin = 0; this.walkTo = null; }
      });
      c().addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });
      c().addEventListener('blur', () => { this.keys = {}; });
    }

    pick(e) {
      const rect = this.renderer.domElement.getBoundingClientRect();
      const v = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      this.ray.setFromCamera(v, this.camera);
      const hits = this.ray.intersectObjects(this.pickables, false);
      return hits.find((h) => h.object.visible) || null;
    }

    hover(e) {
      if (!this.opts.onHover || e.pointerType === 'touch') return;
      const now = performance.now();
      if (this.lastHover && now - this.lastHover < 60) return;
      this.lastHover = now;
      const h = this.pick(e);
      const id = h && h.object.userData.itemId;
      this.renderer.domElement.style.cursor = id ? 'pointer' : (this.mode === 'doll' ? 'grab' : 'crosshair');
      this.opts.onHover(id || null, e);
    }

    click(e) {
      const h = this.pick(e);
      if (!h) return;
      if (h.object.userData.itemId) {
        if (this.opts.onSelect) this.opts.onSelect(h.object.userData.itemId);
        return;
      }
      if (h.object.userData.floor && this.mode === 'walk') {
        this.walkTo = new THREE.Vector3(h.point.x, EYE, h.point.z);
      } else if (h.object.userData.floor && this.mode === 'doll') {
        this.orbit.target.set(h.point.x, 0, h.point.z);
      }
    }

    /* ---------- frame loop ---------- */
    resize() {
      const w = this.el.clientWidth || 300, h = this.el.clientHeight || 300;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }

    loop() {
      if (!this.running) return;
      requestAnimationFrame(this.loop);
      const dt = Math.min(0.05, this.clock.getDelta());
      if (!this.plan) return;
      if (this.el.offsetParent === null) return; // hidden tab: skip rendering

      if (this.mode === 'walk') {
        const k = this.keys;
        const speed = 1.8 * dt;
        let f = 0, t = 0;
        if (k.w || k.arrowup || k["'"] || this.hold.fwd) f += 1;
        if (k.s || k.arrowdown || k['ד'] || this.hold.back) f -= 1;
        if (k.a || k.arrowleft || k['ש'] || this.hold.left) t += 1;
        if (k.d || k.arrowright || k['ג'] || this.hold.right) t -= 1;
        if (t) { this.yaw += t * 1.6 * dt; this.targetYaw = undefined; }
        if (f) this.move(-Math.sin(this.yaw) * f * speed, -Math.cos(this.yaw) * f * speed);
        if (this.walkTo) {
          const dx = this.walkTo.x - this.pos.x, dz = this.walkTo.z - this.pos.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.1) this.walkTo = null;
          else {
            const want = Math.atan2(-dx, -dz);
            let diff = want - this.yaw;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            this.yaw += diff * Math.min(1, dt * 6);
            const bx = this.pos.x, bz = this.pos.z;
            this.move((dx / d) * speed * 1.2, (dz / d) * speed * 1.2);
            if (Math.hypot(this.pos.x - bx, this.pos.z - bz) < 0.001) this.walkTo = null;
          }
        }
        if (this.spin > 0) {
          const s = Math.min(this.spin, dt * 0.55);
          this.yaw += s;
          this.spin -= s;
        }
        if (this.targetYaw !== undefined) {
          let diff = this.targetYaw - this.yaw;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          this.yaw += diff * Math.min(1, dt * 5);
          if (Math.abs(diff) < 0.002) this.targetYaw = undefined;
        }
        if (this.targetPitch !== undefined) {
          this.pitch += (this.targetPitch - this.pitch) * Math.min(1, dt * 5);
          if (Math.abs(this.targetPitch - this.pitch) < 0.002) this.targetPitch = undefined;
        }
        this.camera.position.copy(this.pos);
        const dir = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
        this.camera.lookAt(this.pos.clone().add(dir));
        if (this.opts.onMove) this.opts.onMove(this.pos.x, this.pos.z, this.yaw);
      } else {
        if (this.spin > 0) { const s = Math.min(this.spin, dt * 0.5); this.orbit.az += s; this.spin -= s; }
        const o = this.orbit;
        const tx = o.target.x, tz = o.target.z;
        this.camera.position.set(tx + Math.sin(o.az) * Math.cos(o.el) * o.dist, Math.sin(o.el) * o.dist, tz + Math.cos(o.az) * Math.cos(o.el) * o.dist);
        this.camera.lookAt(tx, 0.6, tz);
      }
      this.renderer.render(this.scene, this.camera);
    }

    dispose() {
      this.running = false;
      this.ro.disconnect();
      this.renderer.dispose();
    }
  }

  window.IH = window.IH || {};
  window.IH.Tour = Tour;
})();
