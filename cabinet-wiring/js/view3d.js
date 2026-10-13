/* ארון־פלאן — הארון בתלת־ממד (three.js): מעטפת RAL 7035 עם דלת שנפתחת, רכיבי הדלת, פלטת הרכבה,
   מסילות, תעלות, הרכיבים וכל חוט כמוליך בצבע ובעובי שלו לאורך המסלול בתעלות.
   מעבר עכבר על חוט → הסבר; לחיצה על חוט → פרטים; לחיצה על רכיב → כל החוטים שלו. */
const MM = 0.001;

function canvasTex(THREE, w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function lampHex(name) {
  const n = String(name || '');
  if (/ירוק|green/i.test(n)) return 0x2fd06a;
  if (/אדום|red/i.test(n)) return 0xf03a3a;
  if (/צהוב|כתום|amber|yellow|orange/i.test(n)) return 0xffbf2e;
  if (/כחול|blue/i.test(n)) return 0x3d8bff;
  if (/לבן|white/i.test(n)) return 0xf2f2f2;
  return 0xbbbbbb;
}

export class Cabinet3D {
  constructor(host, { onHover, onSelect, onComp } = {}) {
    this.host = host;
    this.onHover = onHover || (() => {});
    this.onSelect = onSelect || (() => {});
    this.onComp = onComp || (() => {});
    this.doorOpen = true;
    this.coversOn = false;
    this.ready = this.init();
  }

  async init() {
    const THREE = this.THREE = await import('three');
    const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
    const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.92;
    r.domElement.className = 'three-canvas';
    this.host.querySelectorAll('canvas').forEach((c) => c.remove());
    this.host.appendChild(r.domElement);
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdfe2df);
    const pm = new THREE.PMREMGenerator(r);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9096, 0.55));
    const sun = this.sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(1.6, 2.6, 2.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.18 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.floor = floor;
    scene.add(floor);
    const grid = new THREE.GridHelper(12, 60, 0xc4c9cc, 0xd2d6d6);
    grid.material.transparent = true; grid.material.opacity = 0.55;
    this.grid = grid;
    scene.add(grid);
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.01, 50);
    const c = this.controls = new OrbitControls(this.camera, r.domElement);
    c.enableDamping = true;
    c.dampingFactor = 0.09;
    c.maxPolarAngle = Math.PI * 0.52;
    c.minDistance = 0.25;
    c.maxDistance = 8;
    c.addEventListener('change', () => this.request());
    this.ray = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.bindPointer();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.host);
    this.resize();
  }

  resize() {
    if (!this.renderer) return;
    const w = this.host.clientWidth || 800, h = this.host.clientHeight || 600;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.request();
  }

  request() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      const moving = this.controls.update();
      if (this.anim) this.anim();
      this.renderer.render(this.scene, this.camera);
      if (moving || this.anim) this.request();
    });
  }

  /* ---------- בניית הארון ---------- */
  async build(P, L, E, C) {
    await this.ready;
    const THREE = this.THREE;
    this.P = P; this.L = L;
    if (this.root) { this.scene.remove(this.root); this.dispose(this.root); }
    const root = this.root = new THREE.Group();
    this.scene.add(root);
    const enc = this.enc = E.enclosure(P, L);
    const W = enc.w * MM, H = enc.h * MM, D = enc.d * MM, T = 0.0015 * 6;
    const base = enc.plinth ? enc.plinth * MM : 0.08;
    const X = (x) => (x - L.plate.w / 2) * MM;
    const Y = (y) => base + H / 2 + (L.plate.h / 2 - y) * MM;
    this.X = X; this.Y = Y;
    const steel = new THREE.MeshStandardMaterial({ color: 0xc3c8c4, roughness: 0.55, metalness: 0.12 });
    const steelIn = new THREE.MeshStandardMaterial({ color: 0xc6cbc7, roughness: 0.7, metalness: 0.1, side: THREE.DoubleSide });
    const box = (w, h, d, mat, x, y, z, parent = root, shadow = true) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = shadow; m.receiveShadow = true;
      parent.add(m);
      return m;
    };
    /* מעטפת: גב, צדדים, גג, רצפה, מסגרת קדמית */
    const z0 = -0.03;   // פני הפלטה
    const zb = z0 - 0.012;
    box(W + 2 * T, H + 2 * T, T, steel, 0, base + H / 2, zb - T / 2);
    box(T, H + 2 * T, D, steel, -W / 2 - T / 2, base + H / 2, zb + D / 2);
    box(T, H + 2 * T, D, steel, W / 2 + T / 2, base + H / 2, zb + D / 2);
    box(W, T, D, steel, 0, base + H + T / 2, zb + D / 2);
    box(W, T, D, steelIn, 0, base - T / 2, zb + D / 2);
    const frame = 0.018;
    [[W, frame, 0, base + H - frame / 2], [W, frame, 0, base + frame / 2]].forEach(([w, h, x, y]) => box(w, h, 0.012, steel, x, y, zb + D - 0.006));
    [[-W / 2 + frame / 2], [W / 2 - frame / 2]].forEach(([x]) => box(frame, H, 0.012, steel, x, base + H / 2, zb + D - 0.006));
    /* בסיס / רגליות */
    const plinthMat = new THREE.MeshStandardMaterial({ color: 0x2b3035, roughness: 0.6, metalness: 0.2 });
    if (enc.plinth) box(W + 2 * T, base, D, plinthMat, 0, base / 2, zb + D / 2);
    else [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => box(0.03, base, 0.03, plinthMat, sx * (W / 2 - 0.03), base / 2, zb + D / 2 + sz * (D / 2 - 0.03)));
    /* פלטת הרכבה מגולוונת */
    const plateTex = canvasTex(THREE, 256, 256, (g, w, h) => {
      g.fillStyle = '#d4d8d9'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${150 + Math.random() * 60},${155 + Math.random() * 60},${160 + Math.random() * 60},.18)`; g.fillRect(Math.random() * w, Math.random() * h, 6 + Math.random() * 16, 3 + Math.random() * 10); }
    });
    plateTex.wrapS = plateTex.wrapT = THREE.RepeatWrapping; plateTex.repeat.set(3, 4);
    const plate = box(L.plate.w * MM, L.plate.h * MM, 0.003, new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.45, metalness: 0.55 }), 0, Y(L.plate.h / 2), z0 - 0.0015);
    plate.castShadow = false;
    /* מסילות DIN */
    const railMat = new THREE.MeshStandardMaterial({ color: 0xbfc4c8, roughness: 0.3, metalness: 0.85 });
    L.rails.forEach((rl) => box((rl.x2 - rl.x1) * MM, 0.035, 0.0075, railMat, X((rl.x1 + rl.x2) / 2), Y(rl.y), z0 + 0.00375));
    /* תעלות חיווט */
    const slot = canvasTex(THREE, 64, 64, (g, w, h) => { g.fillStyle = '#9ea6ad'; g.fillRect(0, 0, w, h); g.fillStyle = '#7d868e'; g.fillRect(8, 0, 14, h); g.fillRect(40, 0, 14, h); });
    slot.wrapS = slot.wrapT = THREE.RepeatWrapping;
    this.ductMats = [];
    const DD = 0.06;
    L.ducts.forEach((d) => {
      const tex = slot.clone(); tex.needsUpdate = true;
      const horiz = d.kind === 'h';
      tex.repeat.set(horiz ? d.w / 25 : 1, horiz ? 1 : d.h / 25);
      if (!horiz) tex.rotation = Math.PI / 2;
      const side = new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.75, transparent: true, opacity: 0.5, depthWrite: false });
      const base2 = new THREE.MeshStandardMaterial({ color: 0x8f989f, roughness: 0.8 });
      const cover = new THREE.MeshStandardMaterial({ color: 0xa3abb2, roughness: 0.6, transparent: true, opacity: this.coversOn ? 0.96 : 0 });
      cover.userData.cover = true;
      this.ductMats.push(cover);
      const g = new THREE.Group();
      const w = d.w * MM, h = d.h * MM;
      box(w, h, 0.002, base2, 0, 0, 0.001, g, false);
      if (horiz) { box(w, 0.0025, DD, side, 0, h / 2, DD / 2, g, false); box(w, 0.0025, DD, side, 0, -h / 2, DD / 2, g, false); }
      else { box(0.0025, h, DD, side, w / 2, 0, DD / 2, g, false); box(0.0025, h, DD, side, -w / 2, 0, DD / 2, g, false); }
      const cv = box(w + 0.004, h + 0.004, 0.003, cover, 0, 0, DD + 0.0015, g, false);
      cv.visible = this.coversOn;
      this.covers = (this.covers || []).concat(cv);
      g.position.set(X(d.x + d.w / 2), Y(d.y + d.h / 2), z0);
      root.add(g);
    });
    /* רכיבים */
    const compBy = {};
    P.components.forEach((c) => { compBy[c.tag] = c; });
    this.compMeshes = [];
    const faceTex = (c, b, info) => canvasTex(THREE, Math.max(64, Math.round(b.w * 4)), Math.max(64, Math.round(b.h * 4)), (g, w, h) => {
      g.fillStyle = info.fill || '#444'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, h * 0.36, w, h * 0.28);
      g.fillStyle = '#f1f3f2'; g.fillRect(w * 0.08, h * 0.05, w * 0.84, Math.min(h * 0.16, 64));
      g.fillStyle = '#1c2126'; g.font = `600 ${Math.min(h * 0.11, w * 0.22, 44)}px "IBM Plex Mono", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(c.tag, w / 2, h * 0.05 + Math.min(h * 0.16, 64) / 2);
      g.fillStyle = 'rgba(255,255,255,.88)'; g.font = `500 ${Math.min(h * 0.075, w * 0.12, 24)}px "IBM Plex Sans Hebrew", Arial`;
      g.direction = 'rtl';
      wrapText(g, c.name || info.he, w / 2, h * 0.5, w * 0.86, Math.min(h * 0.09, 28));
      g.fillStyle = 'rgba(0,0,0,.35)';
      for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(w * (0.2 + i * 0.2), h * 0.9, Math.min(w, h) * 0.04, 0, Math.PI * 2); g.fill(); }
    });
    Object.values(L.comps).forEach((b) => {
      const c = compBy[b.tag];
      if (!c || b.zone !== 'cabinet') return;
      const info = C.TYPES[c.type] || C.TYPES.other;
      const depth = E.depthOf(c.type) * MM;
      if (c.type === 'terminal') {
        const g = new THREE.Group();
        const keys = Object.keys(L.pins).filter((k) => k.startsWith(b.tag + ':'));
        const grey = new THREE.MeshStandardMaterial({ color: 0xc3c8cc, roughness: 0.55 });
        const grey2 = new THREE.MeshStandardMaterial({ color: 0xaeb4b9, roughness: 0.55 });
        const pe = new THREE.MeshStandardMaterial({ color: 0x3aa655, roughness: 0.5 });
        keys.forEach((k, i) => {
          const term = k.slice(b.tag.length + 1);
          const pn = L.pins[k];
          const m = box(0.0058, b.h * MM, depth, /^PE/i.test(term) ? pe : i % 2 ? grey2 : grey, X(pn.x), Y(b.y + b.h / 2), z0 + 0.0075 + depth / 2, g);
          m.userData.tag = b.tag;
          this.compMeshes.push(m);
        });
        const label = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(0.03, b.w * MM), 0.012), new THREE.MeshBasicMaterial({ map: canvasTex(THREE, 256, 64, (g2, w, h) => { g2.fillStyle = '#fff'; g2.fillRect(0, 0, w, h); g2.fillStyle = '#1c2126'; g2.font = '600 40px "IBM Plex Mono", monospace'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(b.tag, w / 2, h / 2); }) }));
        label.position.set(X(b.x + b.w / 2), Y(b.y + b.h) - 0.012, z0 + 0.0075 + depth + 0.001);
        g.add(label);
        root.add(g);
        return;
      }
      if (c.type === 'pe_bar') {
        const m = box(b.w * MM, 0.012, 0.012, new THREE.MeshStandardMaterial({ color: 0xc89b5a, roughness: 0.3, metalness: 0.9 }), X(b.x + b.w / 2), Y(b.y + b.h / 2), z0 + 0.02);
        m.userData.tag = b.tag; this.compMeshes.push(m);
        return;
      }
      const side = new THREE.MeshStandardMaterial({ color: new THREE.Color(info.fill || '#444').multiplyScalar(0.8), roughness: 0.55 });
      const front = new THREE.MeshStandardMaterial({ map: faceTex(c, b, info), roughness: 0.5 });
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.w * MM, b.h * MM, depth), [side, side, side, side, front, side]);
      m.position.set(X(b.x + b.w / 2), Y(b.y + b.h / 2), z0 + 0.0075 + depth / 2);
      m.castShadow = true; m.receiveShadow = true;
      m.userData.tag = b.tag;
      root.add(m);
      this.compMeshes.push(m);
      /* ידית מפסק / ידית מפסק ראשי */
      if (/mcb|rcd|mpcb|main_switch/.test(c.type)) {
        const lever = box(Math.min(0.012, b.w * MM * 0.5), 0.016, 0.012, new THREE.MeshStandardMaterial({ color: c.type === 'main_switch' ? 0xd81f26 : 0x22272c, roughness: 0.4 }), m.position.x, m.position.y + 0.006, z0 + 0.0075 + depth + 0.006);
        lever.userData.tag = b.tag;
      }
    });
    /* הדלת: ציר מימין, ידית משמאל, לוחית זיהוי, מדבקת אזהרה ורכיבי הדלת */
    const door = this.door = new THREE.Group();
    door.position.set(W / 2 + T, base + H / 2, zb + D);
    root.add(door);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xc3c8c4, roughness: 0.55, metalness: 0.12 });
    const dp = box(W + 2 * T, H + 2 * T, 0.02, doorMat, -(W / 2 + T), 0, 0.01, door);
    dp.castShadow = true;
    box(W - 0.06, H - 0.06, 0.004, steelIn, -(W / 2 + T), 0, -0.002, door, false);
    const blk = new THREE.MeshStandardMaterial({ color: 0x1e2226, roughness: 0.35, metalness: 0.3 });
    box(0.02, 0.16, 0.025, blk, -(W + 2 * T) + 0.04, 0, 0.032, door);
    box(0.012, 0.012, 0.04, blk, -(W + 2 * T) + 0.04, 0.05, 0.05, door);
    const meta = P.meta || {};
    const plateLbl = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.06), new THREE.MeshBasicMaterial({ map: canvasTex(THREE, 512, 192, (g, w, h) => {
      g.fillStyle = '#cfd4d6'; g.fillRect(0, 0, w, h); g.strokeStyle = '#7d868e'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
      g.fillStyle = '#1c2126'; g.textAlign = 'center'; g.direction = 'rtl'; g.font = '700 44px "IBM Plex Sans Hebrew", Arial';
      g.fillText(String(meta.title || P.name || '').slice(0, 26), w / 2, 76);
      g.font = '500 30px "IBM Plex Mono", monospace'; g.direction = 'ltr';
      g.fillText([meta.drawingNo, meta.supply].filter(Boolean).join('  ·  ').slice(0, 34), w / 2, 136);
    }) }));
    plateLbl.position.set(-(W / 2 + T), H / 2 - 0.07, 0.0205);
    door.add(plateLbl);
    const warn = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.062), new THREE.MeshBasicMaterial({ transparent: true, map: canvasTex(THREE, 128, 112, (g) => {
      g.fillStyle = '#f2c21b'; g.strokeStyle = '#111'; g.lineWidth = 8; g.beginPath(); g.moveTo(64, 8); g.lineTo(122, 106); g.lineTo(6, 106); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#111'; g.beginPath(); g.moveTo(70, 34); g.lineTo(48, 74); g.lineTo(62, 74); g.lineTo(54, 98); g.lineTo(80, 60); g.lineTo(66, 60); g.lineTo(76, 34); g.closePath(); g.fill();
    }) }));
    warn.position.set(-(W / 2 + T), -H / 2 + 0.12, 0.0205);
    door.add(warn);
    this.doorPos = {};
    const doorDev = P.components.filter((c) => c.zone === 'door' && L.comps[c.tag]);
    const cols = Math.min(3, Math.max(1, Math.ceil(doorDev.length / 5)));
    doorDev.forEach((c, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = -(W / 2 + T) + (col - (cols - 1) / 2) * 0.075;
      const y = H / 2 - 0.17 - row * 0.07;
      const g = new THREE.Group();
      g.position.set(x, y, 0.02);
      door.add(g);
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.0145, 0.0145, 0.008, 32), blk);
      ring.rotation.x = Math.PI / 2; ring.position.z = 0.004; ring.castShadow = true;
      g.add(ring);
      let head;
      if (c.type === 'estop') {
        const yel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.002, 40), new THREE.MeshStandardMaterial({ color: 0xf2c21b, roughness: 0.5 }));
        yel.rotation.x = Math.PI / 2; yel.position.z = 0.001; g.add(yel);
        head = new THREE.Mesh(new THREE.SphereGeometry(0.02, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc4161c, roughness: 0.35 }));
        head.rotation.x = Math.PI / 2; head.position.z = 0.012;
      } else if (c.type === 'lamp') {
        head = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 32), new THREE.MeshStandardMaterial({ color: lampHex(c.name + ' ' + c.desc), emissive: lampHex(c.name + ' ' + c.desc), emissiveIntensity: 0.55, roughness: 0.2, transparent: true, opacity: 0.92 }));
        head.rotation.x = Math.PI / 2; head.position.z = 0.012;
      } else if (c.type === 'selector') {
        head = new THREE.Group();
        const k = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.01, 32), blk); k.rotation.x = Math.PI / 2; k.position.z = 0.011; head.add(k);
        head.add(box(0.004, 0.018, 0.008, new THREE.MeshStandardMaterial({ color: 0xdddddd }), 0, 0, 0.018, head));
      } else {
        head = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.0105, 0.01, 32), new THREE.MeshStandardMaterial({ color: lampHex(c.name + ' ' + c.desc), roughness: 0.4 }));
        head.rotation.x = Math.PI / 2; head.position.z = 0.011;
      }
      head.castShadow = true;
      g.add(head);
      const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.012), new THREE.MeshBasicMaterial({ map: canvasTex(THREE, 256, 64, (g2, w, h) => { g2.fillStyle = '#f4f5f3'; g2.fillRect(0, 0, w, h); g2.fillStyle = '#1c2126'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.direction = 'rtl'; g2.font = '600 26px "IBM Plex Sans Hebrew", Arial'; g2.fillText(`${c.tag}  ${String(c.name || '').slice(0, 14)}`, w / 2, h / 2); }) }));
      lbl.position.set(0, -0.028, 0.0005);
      g.add(lbl);
      [g, ring, head].forEach((o) => { o.userData.tag = c.tag; });
      this.compMeshes.push(ring, head);
      this.doorPos[c.tag] = new THREE.Vector3(x, y, -0.004);
    });
    /* חוטים */
    this.wireMeshes = [];
    this.byId = {};
    const zW = z0 + 0.026;
    const hinge = new THREE.Vector3(W / 2 - 0.02, 0, zb + D - 0.03);
    P.wires.forEach((w, wi) => {
      const rt = L.routes[w.id];
      if (!rt) return;
      const col = C.COLORS[w.color] || C.COLORS.BK;
      const rad = (0.9 + Math.sqrt(w.section || 0.75) * 0.75) * MM;
      const lane = ((wi % 7) - 3) * 0.0028;
      const pts = [];
      const fromB = L.comps[w.from.tag], toB = L.comps[w.to.tag];
      const compZ = (b) => b && compBy[b.tag] ? z0 + 0.0075 + E.depthOf(compBy[b.tag].type) * MM * (compBy[b.tag].type === 'terminal' ? 0.85 : 0.35) : zW;
      const inside = (p) => p[0] >= 0 && p[0] <= L.plate.w && p[1] >= 0 && p[1] <= L.plate.h + 1;
      const raw = rt.pts;
      let doorTag = null, fieldOut = false;
      if (fromB && fromB.zone === 'door') doorTag = w.from.tag; else if (toB && toB.zone === 'door') doorTag = w.to.tag;
      if ((fromB && fromB.zone === 'field') || (toB && toB.zone === 'field')) fieldOut = true;
      let seq = raw.slice();
      if (doorTag && toB && toB.zone === 'door') { /* בכיוון ארון → דלת */ } else if (doorTag) seq = seq.slice().reverse();
      if (fieldOut && fromB && fromB.zone === 'field') seq = seq.slice().reverse();
      const startB = doorTag ? (fromB.zone === 'door' ? toB : fromB) : fieldOut ? (fromB.zone === 'field' ? toB : fromB) : fromB;
      const cabin = seq.filter(inside);
      if (!cabin.length) return;
      pts.push(new THREE.Vector3(X(cabin[0][0]), Y(cabin[0][1]), compZ(startB)));
      /* מהפין אחורה לעומק התעלה, לאורך המסלול, ובחזרה אל פני הרכיב בקצה השני */
      cabin.forEach((p) => pts.push(new THREE.Vector3(X(p[0]), Y(p[1]), zW + lane)));
      if (!doorTag && !fieldOut) {
        const endB = toB; const last = cabin[cabin.length - 1];
        pts.push(new THREE.Vector3(X(last[0]), Y(last[1]), compZ(endB)));
      } else if (doorTag) {
        const last = pts[pts.length - 1];
        pts.push(new THREE.Vector3(hinge.x, last.y, zW + lane));
        pts.push(new THREE.Vector3(hinge.x, last.y, hinge.z));
      } else {
        const last = pts[pts.length - 1];
        pts.push(new THREE.Vector3(last.x, base + 0.02, zW + lane));
        pts.push(new THREE.Vector3(last.x, base - 0.25 - (wi % 5) * 0.02, zW + 0.03));
      }
      const mesh = this.tube(pts, rad, col, w.id);
      if (!mesh) return;
      root.add(mesh);
      this.wireMeshes.push(mesh); this.byId[w.id] = [mesh];
      if (doorTag && this.doorPos[doorTag]) {
        /* החלק שעל הדלת: מהציר לרכיב, זז יחד עם הדלת */
        const dpos = this.doorPos[doorTag];
        const yLocal = pts[pts.length - 1].y - (base + H / 2);
        const a = new THREE.Vector3(-0.03, yLocal, -0.03), b2 = new THREE.Vector3(-0.03, dpos.y, -0.025), c2 = new THREE.Vector3(dpos.x, dpos.y, -0.012);
        const m2 = this.tube([a, b2, c2, new THREE.Vector3(dpos.x, dpos.y, -0.004)], rad, col, w.id);
        if (m2) { door.add(m2); this.wireMeshes.push(m2); this.byId[w.id].push(m2); }
      }
    });
    /* ציוד בשטח: ליד הארון על הרצפה, כל מכשיר עם הכבל שלו מתחתית הארון. לחיצה → כרטיס הרכיב */
    this.fieldBox = null;
    const field = P.components.filter((c) => c.zone === 'field');
    if (field.length) {
      const fg = new THREE.Group();
      root.add(fg);
      const fbox = new THREE.Box3();
      const colsF = Math.min(6, Math.max(2, Math.ceil(Math.sqrt(field.length * 1.4))));
      const sp = 0.46;
      const x0 = W / 2 + T + 0.5, zF = zb + D / 2;
      const dark = new THREE.MeshStandardMaterial({ color: 0x23282d, roughness: 0.5, metalness: 0.3 });
      const postMat = new THREE.MeshStandardMaterial({ color: 0x7d868e, roughness: 0.4, metalness: 0.6 });
      const ral = new THREE.MeshStandardMaterial({ color: 0xc6cbc7, roughness: 0.55, metalness: 0.1 });
      const yel = new THREE.MeshStandardMaterial({ color: 0xf2c21b, roughness: 0.45 });
      const red = new THREE.MeshStandardMaterial({ color: 0xc4161c, roughness: 0.35 });
      const cyl = (r, h, mat, x, y, z, par) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), mat); m.position.set(x, y, z); m.castShadow = true; par.add(m); return m; };
      const lens = (hex, x, y, z, par) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 24), new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.5, roughness: 0.2 })); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); par.add(m); return m; };
      const cableMat = new THREE.MeshStandardMaterial({ color: 0x3b434b, roughness: 0.6 });
      field.forEach((c, i) => {
        const col = i % colsF, row = Math.floor(i / colsF);
        const x = x0 + col * sp, z = zF + row * sp;
        const g = new THREE.Group();
        g.position.set(x, 0, z);
        fg.add(g);
        const parts = [];
        const n = `${c.name || ''} ${c.desc || ''}`;
        let top;
        if (/רמזור|מגדל אור|traffic|stack ?light/i.test(n) || c.type === 'lamp') {
          parts.push(cyl(0.018, 1.25, postMat, 0, 0.625, 0, g));
          parts.push(box(0.13, 0.38, 0.1, dark, 0, 1.43, 0, g));
          [[0xd62828, 0.12], [0xf2a20c, 0], [0x2f9e44, -0.12]].forEach(([hex, dy]) => parts.push(lens(hex, 0, 1.43 + dy, 0.055, g)));
          top = 1.68;
        } else if (c.type === 'estop') {
          parts.push(cyl(0.015, 0.95, postMat, 0, 0.475, 0, g));
          parts.push(box(0.09, 0.09, 0.07, yel, 0, 0.99, 0, g));
          const mush = new THREE.Mesh(new THREE.SphereGeometry(0.03, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), red);
          mush.rotation.x = Math.PI / 2; mush.position.set(0, 0.99, 0.04); g.add(mush); parts.push(mush);
          top = 1.1;
        } else if (c.type === 'sensor' || /סורק|scanner|חיישן|TIM\d/i.test(n)) {
          parts.push(cyl(0.015, 0.85, postMat, 0, 0.425, 0, g));
          parts.push(cyl(0.05, 0.08, yel, 0, 0.9, 0, g));
          parts.push(cyl(0.045, 0.05, dark, 0, 0.965, 0, g));
          top = 1.06;
        } else if (c.type === 'motor') {
          const m = cyl(0.11, 0.32, new THREE.MeshStandardMaterial({ color: 0x3b5b7a, roughness: 0.5, metalness: 0.3 }), 0, 0.13, 0, g);
          m.rotation.z = Math.PI / 2; parts.push(m);
          parts.push(box(0.09, 0.06, 0.09, dark, 0, 0.27, 0, g));
          top = 0.42;
        } else if (c.type === 'fan' || c.type === 'heater' || c.type === 'valve') {
          parts.push(box(0.2, 0.2, 0.1, c.type === 'fan' ? dark : ral, 0, 0.6, 0, g));
          parts.push(cyl(0.015, 0.5, postMat, 0, 0.25, 0, g));
          top = 0.8;
        } else {
          parts.push(cyl(0.018, 0.7, postMat, 0, 0.35, 0, g));
          const face = new THREE.MeshStandardMaterial({ roughness: 0.5, map: canvasTex(THREE, 256, 320, (x2, w, h) => {
            x2.fillStyle = '#c6cbc7'; x2.fillRect(0, 0, w, h);
            x2.fillStyle = '#2b3035'; x2.fillRect(0, 0, w, 64);
            x2.fillStyle = '#fff'; x2.textAlign = 'center'; x2.textBaseline = 'middle'; x2.font = '600 34px "IBM Plex Mono", monospace'; x2.fillText(c.tag, w / 2, 34);
            x2.fillStyle = '#1c2126'; x2.font = '500 26px "IBM Plex Sans Hebrew", Arial'; x2.direction = 'rtl';
            wrapText(x2, c.name || '', w / 2, h * 0.55, w * 0.86, 32);
          }) });
          const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.12), [ral, ral, ral, ral, face, ral]);
          b.position.set(0, 0.84, 0); b.castShadow = true; g.add(b); parts.push(b);
          top = 1.04;
        }
        /* שלט */
        const lbl = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(THREE, 512, 112, (x2, w, h) => {
          x2.fillStyle = 'rgba(43,48,53,.9)'; x2.beginPath(); x2.roundRect(4, 4, w - 8, h - 8, 16); x2.fill();
          x2.fillStyle = '#f0a46b'; x2.textAlign = 'center'; x2.textBaseline = 'middle'; x2.font = '600 34px "IBM Plex Mono", monospace'; x2.fillText(c.tag, w / 2, 34);
          x2.fillStyle = '#fff'; x2.font = '500 28px "IBM Plex Sans Hebrew", Arial'; x2.direction = /^[֐-׿]/.test(c.name || '') ? 'rtl' : 'ltr'; x2.fillText(String(c.name || '').slice(0, 24), w / 2, 78);
        }) }));
        lbl.scale.set(0.36, 0.079, 1); lbl.position.set(0, top + 0.08, 0);
        g.add(lbl); parts.push(lbl);
        parts.forEach((o) => { o.userData.tag = c.tag; });
        this.compMeshes.push(...parts);
        /* הכבל: מתחתית הארון על הרצפה ועד המכשיר */
        const lane = (i % 9) * 0.012;
        const pts = [new THREE.Vector3(W / 2 - 0.06 - lane * 0.5, base, zb + D * 0.45), new THREE.Vector3(W / 2 - 0.06 - lane * 0.5, 0.012 + lane * 0.2, zb + D * 0.45),
          new THREE.Vector3(x - 0.06, 0.012 + lane * 0.2, zb + D * 0.45), new THREE.Vector3(x - 0.06, 0.012 + lane * 0.2, z + 0.02), new THREE.Vector3(x - 0.02, 0.05, z + 0.02)];
        const path = new THREE.CurvePath();
        for (let k = 1; k < pts.length; k++) if (pts[k - 1].distanceTo(pts[k]) > 0.001) path.add(new THREE.LineCurve3(pts[k - 1], pts[k]));
        const cab = new THREE.Mesh(new THREE.TubeGeometry(path, 60, 0.0055, 8, false), cableMat);
        cab.castShadow = true; cab.userData.tag = c.tag;
        fg.add(cab); this.compMeshes.push(cab);
        fbox.expandByPoint(new THREE.Vector3(x - 0.2, 0, z - 0.2)); fbox.expandByPoint(new THREE.Vector3(x + 0.2, top + 0.2, z + 0.2));
      });
      this.fieldBox = fbox;
    }
    this.setDoor(this.doorOpen, true);
    this.setCovers(this.coversOn);
    const fx = Math.max(W, 0.5);
    const far = Math.max(W * 1.6, H) * 2.7;
    this.home = { pos: new THREE.Vector3(-far * 0.42, base + H * 0.72, far), target: new THREE.Vector3(W * 0.22, base + H * 0.48, 0.05) };
    this.view('home');
    this.sun.shadow.camera.left = -2; this.sun.shadow.camera.right = this.fieldBox ? Math.max(2, this.fieldBox.max.x + 1) : 2; this.sun.shadow.camera.top = this.fieldBox ? Math.max(3, this.fieldBox.max.z + 1) : 3; this.sun.shadow.camera.bottom = -1;
    this.sun.shadow.camera.updateProjectionMatrix();
    if (this.selected) this.select(this.selected, false);
    this.request();
    return enc;
  }

  tube(pts, rad, col, id) {
    const THREE = this.THREE;
    const clean = [];
    pts.forEach((p) => { if (!clean.length || clean[clean.length - 1].distanceTo(p) > 0.0005) clean.push(p); });
    if (clean.length < 2) return null;
    /* פינות מעוגלות קצת, כמו חוט אמיתי שמתכופף */
    const path = new THREE.CurvePath();
    const R = 0.008;
    let prev = clean[0].clone();
    for (let i = 1; i < clean.length; i++) {
      const p = clean[i];
      if (i < clean.length - 1) {
        const n = clean[i + 1];
        const a = p.clone().sub(prev), bb = n.clone().sub(p);
        const r = Math.min(R, a.length() / 2, bb.length() / 2);
        const s1 = p.clone().sub(a.normalize().multiplyScalar(r)), s2 = p.clone().add(bb.normalize().multiplyScalar(r));
        if (prev.distanceTo(s1) > 1e-5) path.add(new THREE.LineCurve3(prev, s1));
        path.add(new THREE.QuadraticBezierCurve3(s1, p.clone(), s2));
        prev = s2;
      } else if (prev.distanceTo(p) > 1e-5) path.add(new THREE.LineCurve3(prev, p.clone()));
    }
    const len = path.getLength();
    const geo = new THREE.TubeGeometry(path, Math.min(360, Math.max(12, Math.round(len * 170))), rad, 6, false);
    let map = null;
    if (col.stripe) {
      map = canvasTex(THREE, 64, 8, (g, w, h) => { g.fillStyle = col.hex; g.fillRect(0, 0, w, h); g.fillStyle = col.stripe; g.fillRect(0, 0, w / 2, h); });
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(Math.max(1, len / 0.018), 1);
    }
    const mat = new THREE.MeshStandardMaterial({ color: col.stripe ? 0xffffff : col.hex, map, roughness: 0.42, metalness: 0.02, transparent: true, opacity: 1 });
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.userData.id = id;
    m.userData.base = mat.color.getHex();
    return m;
  }

  /* ---------- שליטה ---------- */
  setDoor(open, instant) {
    this.doorOpen = open;
    if (!this.door) return;
    const target = open ? 1.95 : 0;
    if (instant || matchMedia('(prefers-reduced-motion: reduce)').matches) { this.door.rotation.y = target; this.request(); return; }
    const start = this.door.rotation.y, t0 = performance.now(), dur = 900;
    this.anim = () => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      this.door.rotation.y = start + (target - start) * e;
      if (k >= 1) this.anim = null;
    };
    this.request();
  }
  setCovers(on) {
    this.coversOn = on;
    (this.covers || []).forEach((c) => { c.visible = on; c.material.opacity = on ? 0.96 : 0; });
    this.request();
  }
  view(name) {
    if (!this.home) return;
    const THREE = this.THREE;
    const t = this.home.target.clone();
    let pos;
    if (name === 'front') { t.x = 0; pos = new THREE.Vector3(0, t.y, this.enc.d * MM + Math.max(this.enc.w * 1.4, this.enc.h) * MM * 2.7); }
    else if (name === 'field' && this.fieldBox) {
      const c = this.fieldBox.getCenter(new THREE.Vector3()), sz = this.fieldBox.getSize(new THREE.Vector3());
      t.copy(c); t.y = 0.8;
      const d = Math.max(sz.x, sz.z, 1.5) * 1.5;
      pos = new THREE.Vector3(c.x - d * 0.25, 1.4 + d * 0.35, c.z + d);
    } else if (name === 'inside') { t.x = 0; pos = new THREE.Vector3(-0.12 * this.enc.w * MM, t.y + 0.05, this.enc.d * MM + Math.max(this.enc.w, this.enc.h) * MM * 1.05); }
    else pos = this.home.pos.clone();
    this.camera.position.copy(pos);
    this.controls.target.copy(t);
    this.controls.update();
    this.request();
  }
  focusComp(tag) {
    const m = this.compMeshes && this.compMeshes.find((x) => x.userData.tag === tag);
    if (!m) return;
    const p = new this.THREE.Vector3(); m.getWorldPosition(p);
    if (this.fieldBox && this.fieldBox.containsPoint(p)) {
      /* מכשיר בשטח: ממסגרים את כל המכשיר, מלפנים ומעט מלמעלה */
      const box = new this.THREE.Box3();
      this.compMeshes.filter((x) => x.userData.tag === tag && !x.isSprite && x.geometry && x.geometry.type !== 'TubeGeometry').forEach((x) => box.expandByObject(x));
      const c = box.getCenter(new this.THREE.Vector3()), sz = box.getSize(new this.THREE.Vector3());
      /* מסתכלים על ראש המכשיר (הפנסים, הלחצן, החיישן), לא על העמוד */
      c.y = Math.max(0.3, box.max.y - Math.min(0.3, sz.y * 0.25));
      const d = 1.1 + Math.min(sz.y, 1.5) * 0.4;
      this.controls.target.copy(c);
      this.camera.position.set(c.x - d * 0.3, c.y + d * 0.12, c.z + d);
      this.controls.update(); this.request();
      return;
    }
    const far = 0.42;
    this.controls.target.copy(p);
    this.camera.position.set(p.x + far * 0.3, p.y + far * 0.2, p.z + far);
    this.controls.update(); this.request();
  }

  select(id, notify = true) {
    this.selected = id;
    this.compHl = null;
    this.paint();
    if (notify) this.onSelect(id);
  }
  highlightIds(ids) { this.hlSet = ids ? new Set(ids) : null; this.paint(); }
  paint() {
    const sel = this.selected, hl = this.hlSet;
    (this.wireMeshes || []).forEach((m) => {
      const on = sel ? m.userData.id === sel : hl ? hl.has(m.userData.id) : true;
      m.material.opacity = on ? 1 : 0.12;
      m.material.depthWrite = on;
      m.material.emissive && m.material.emissive.setHex(sel && m.userData.id === sel ? 0x6b2f0c : 0x000000);
    });
    this.request();
  }

  png() { this.renderer.render(this.scene, this.camera); return this.renderer.domElement.toDataURL('image/png'); }

  bindPointer() {
    const el = this.renderer.domElement;
    const pick = (ev, list) => {
      const r = el.getBoundingClientRect();
      this.mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      this.ray.setFromCamera(this.mouse, this.camera);
      this.ray.params.Line = { threshold: 0.01 };
      const hit = this.ray.intersectObjects(list || [], false).find((h) => h.object.material.opacity > 0.5 || list !== this.wireMeshes);
      return hit ? hit.object : null;
    };
    let down = null;
    el.addEventListener('pointermove', (ev) => {
      if (ev.pointerType !== 'mouse' || ev.buttons) return;
      const o = pick(ev, this.wireMeshes);
      el.style.cursor = o ? 'pointer' : 'grab';
      this.onHover(o ? o.userData.id : null, ev);
    });
    el.addEventListener('pointerleave', (ev) => this.onHover(null, ev));
    el.addEventListener('pointerdown', (ev) => { down = { x: ev.clientX, y: ev.clientY }; });
    el.addEventListener('pointerup', (ev) => {
      if (!down || Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 5) return;
      const w = pick(ev, this.wireMeshes);
      if (w) { this.select(w.userData.id === this.selected ? null : w.userData.id); return; }
      const c = pick(ev, this.compMeshes);
      if (c) { this.selected = null; this.onComp(c.userData.tag); return; }
      this.hlSet = null; this.select(null);
    });
  }

  dispose(obj) {
    obj.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      ms.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
    });
    this.covers = [];
  }
}

function wrapText(g, text, x, y, maxW, lh) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let cur = '';
  words.forEach((w) => { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
  if (cur) lines.push(cur);
  lines.slice(0, 3).forEach((l, i) => g.fillText(l, x, y + (i - (Math.min(lines.length, 3) - 1) / 2) * lh));
}
