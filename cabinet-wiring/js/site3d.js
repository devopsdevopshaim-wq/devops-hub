/* ארון־פלאן — האתר בתלת־ממד: חדר, הארונות במקום שלהם, מגש כבלים והכבלים בין הארונות.
   מעבר עכבר על כבל → הסבר; לחיצה על ארון → פרטים; לחיצה כפולה → פתיחת הפרויקט של הארון. */

function tex(THREE, w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const CABLE_COL = { power: 0x1c1c1c, control: 0x7d868e, comm: 0x8e44ad };

export class Site3D {
  constructor(host, { onHover, onPick, onOpen } = {}) {
    this.host = host;
    this.onHover = onHover || (() => {});
    this.onPick = onPick || (() => {});
    this.onOpen = onOpen || (() => {});
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
    r.toneMappingExposure = 0.95;
    r.domElement.className = 'three-canvas';
    this.host.querySelectorAll('canvas').forEach((c) => c.remove());
    this.host.appendChild(r.domElement);
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdfe2df);
    scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9096, 0.6));
    const sun = this.sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(4, 8, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    scene.add(sun);
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.05, 200);
    const c = this.controls = new OrbitControls(this.camera, r.domElement);
    c.enableDamping = true; c.dampingFactor = 0.09; c.maxPolarAngle = Math.PI * 0.49; c.minDistance = 1; c.maxDistance = 60;
    c.addEventListener('change', () => this.request());
    this.ray = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.bind();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.host);
    this.resize();
  }

  resize() {
    if (!this.renderer) return;
    const w = this.host.clientWidth || 800, h = this.host.clientHeight || 500;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.request();
  }
  request() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      const m = this.controls.update();
      this.renderer.render(this.scene, this.camera);
      if (m) this.request();
    });
  }

  /* site: {room, layout, trayH}; cabs: [{id, name, P, enc}]; links: [{id, a, b, kind, cable, length}] */
  async build(site, cabs, links) {
    await this.ready;
    const THREE = this.THREE;
    if (this.root) { this.scene.remove(this.root); this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    const root = this.root = new THREE.Group();
    this.scene.add(root);
    const R = site.room, trayH = site.trayH || 2.6;
    /* רצפה וקירות */
    const floorTex = tex(THREE, 256, 256, (g, w, h) => {
      g.fillStyle = '#c9ccc9'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${90 + Math.random() * 60},${90 + Math.random() * 60},${90 + Math.random() * 60},.08)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(R.w, R.d);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(R.w, R.d), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(R.w / 2, 0, R.d / 2); floor.receiveShadow = true;
    root.add(floor);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xeceeea, roughness: 0.95, side: THREE.DoubleSide });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(R.w, 3.2), wallMat); back.position.set(R.w / 2, 1.6, 0); back.receiveShadow = true; root.add(back);
    const left = new THREE.Mesh(new THREE.PlaneGeometry(R.d, 3.2), wallMat); left.rotation.y = Math.PI / 2; left.position.set(0, 1.6, R.d / 2); left.receiveShadow = true; root.add(left);
    /* ארונות */
    this.cabMeshes = [];
    this.cabPos = {};
    const steel = new THREE.MeshStandardMaterial({ color: 0xc3c8c4, roughness: 0.55, metalness: 0.12 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b3035, roughness: 0.6 });
    cabs.forEach((c) => {
      const L = site.layout[c.id]; if (!L) return;
      const W = c.enc.w / 1000, H = c.enc.h / 1000, D = c.enc.d / 1000, base = c.enc.plinth ? 0.1 : 0.06;
      const g = new THREE.Group();
      g.position.set(L.x, 0, L.z);
      g.rotation.y = -(L.rot || 0) * Math.PI / 180;
      root.add(g);
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(W, base, D), dark); plinth.position.y = base / 2; plinth.castShadow = true; g.add(plinth);
      const label = tex(THREE, 512, 640, (x, w, h) => {
        x.fillStyle = '#c6cbc7'; x.fillRect(0, 0, w, h);
        x.fillStyle = '#cfd4d6'; x.fillRect(w * 0.15, h * 0.08, w * 0.7, h * 0.16); x.strokeStyle = '#7d868e'; x.lineWidth = 4; x.strokeRect(w * 0.15, h * 0.08, w * 0.7, h * 0.16);
        x.fillStyle = '#1c2126'; x.textAlign = 'center'; x.direction = /^[\u0590-\u05FF]/.test(c.name) ? 'rtl' : 'ltr'; x.font = '700 36px "IBM Plex Sans Hebrew", Arial';
        x.fillText(String(c.name).slice(0, 22), w / 2, h * 0.15);
        x.font = '600 28px "IBM Plex Mono", monospace'; x.direction = 'ltr';
        x.fillText(String((c.P.meta && c.P.meta.drawingNo) || '').slice(0, 20), w / 2, h * 0.21);
        x.fillStyle = '#1e2226'; x.fillRect(w * 0.06, h * 0.42, w * 0.035, h * 0.18);
        x.fillStyle = '#f2c21b'; x.beginPath(); x.moveTo(w / 2, h * 0.78); x.lineTo(w / 2 + 34, h * 0.86); x.lineTo(w / 2 - 34, h * 0.86); x.closePath(); x.fill();
      });
      const front = new THREE.MeshStandardMaterial({ map: label, roughness: 0.55, metalness: 0.1 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), [steel, steel, steel, steel, front, steel]);
      body.position.y = base + H / 2; body.castShadow = true; body.receiveShadow = true;
      body.userData.pid = c.id;
      g.add(body);
      this.cabMeshes.push(body);
      this.cabPos[c.id] = { x: L.x, z: L.z, top: base + H, front: L.z + D / 2 };
      /* שלט מעל הארון */
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(THREE, 512, 128, (x, w, h) => {
        x.fillStyle = 'rgba(43,48,53,.92)'; x.beginPath(); x.roundRect(4, 4, w - 8, h - 8, 18); x.fill();
        x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = /^[\u0590-\u05FF]/.test(c.name) ? 'rtl' : 'ltr'; x.font = '600 44px "IBM Plex Sans Hebrew", Arial';
        x.fillText(String(c.name).slice(0, 20), w / 2, h / 2);
      }), depthTest: false }));
      sp.scale.set(0.9, 0.225, 1); sp.position.set(L.x, base + H + 0.25, L.z + D / 2);
      root.add(sp);
    });
    /* מגש וכבלים: עולים מראש הארון למגש, לאורך המגש בציר X ואז Z, ויורדים לארון השני */
    this.cableMeshes = [];
    const trayMat = new THREE.MeshStandardMaterial({ color: 0x9aa1a8, roughness: 0.4, metalness: 0.7, transparent: true, opacity: 0.55, depthWrite: false });
    const trays = new Set();
    links.forEach((l, i) => {
      const A = this.cabPos[l.a.pid], B = this.cabPos[l.b.pid];
      if (!A || !B) return;
      const lane = ((i % 6) - 2.5) * 0.035;
      const y = trayH + 0.04 + Math.floor(i / 6) * 0.03;
      const pts = [
        new THREE.Vector3(A.x + lane, A.top - 0.05, A.z), new THREE.Vector3(A.x + lane, y, A.z),
        new THREE.Vector3(B.x + lane, y, A.z), new THREE.Vector3(B.x + lane, y, B.z), new THREE.Vector3(B.x + lane, B.top - 0.05, B.z)
      ];
      trays.add(`x|${Math.min(A.x, B.x).toFixed(2)}|${Math.max(A.x, B.x).toFixed(2)}|${A.z.toFixed(2)}`);
      if (Math.abs(A.z - B.z) > 0.01) trays.add(`z|${Math.min(A.z, B.z).toFixed(2)}|${Math.max(A.z, B.z).toFixed(2)}|${B.x.toFixed(2)}`);
      const path = new THREE.CurvePath();
      for (let k = 1; k < pts.length; k++) if (pts[k - 1].distanceTo(pts[k]) > 0.001) path.add(new THREE.LineCurve3(pts[k - 1], pts[k]));
      const rad = l.kind === 'power' ? 0.012 : l.kind === 'comm' ? 0.004 : 0.008;
      const m = new THREE.Mesh(new THREE.TubeGeometry(path, 120, rad, 8, false), new THREE.MeshStandardMaterial({ color: CABLE_COL[l.kind] || CABLE_COL.control, roughness: 0.5, emissive: 0x000000 }));
      m.castShadow = true;
      m.userData.lid = l.id;
      root.add(m);
      this.cableMeshes.push(m);
    });
    trays.forEach((t) => {
      const [ax, a, b, c] = t.split('|'); const s = Number(a), e = Number(b), k = Number(c);
      const len = Math.max(0.3, e - s + 0.3);
      const geo = new THREE.BoxGeometry(ax === 'x' ? len : 0.3, 0.06, ax === 'x' ? 0.3 : len);
      const mesh = new THREE.Mesh(geo, trayMat);
      mesh.position.set(ax === 'x' ? (s + e) / 2 : k, trayH + 0.03, ax === 'x' ? k : (s + e) / 2);
      root.add(mesh);
    });
    this.sun.shadow.camera.left = -R.w; this.sun.shadow.camera.right = R.w; this.sun.shadow.camera.top = R.d + 4; this.sun.shadow.camera.bottom = -R.d - 2;
    this.sun.shadow.camera.updateProjectionMatrix();
    this.home();
  }

  home() {
    if (!this.scene) return;
    const R = this.lastRoom || null;
    const box = new this.THREE.Box3();
    if (this.root) this.root.updateMatrixWorld(true);
    (this.cabMeshes || []).forEach((m) => box.expandByObject(m));
    if (box.isEmpty()) box.set(new this.THREE.Vector3(0, 0, 0), new this.THREE.Vector3(4, 2, 2));
    const c = box.getCenter(new this.THREE.Vector3()), s = box.getSize(new this.THREE.Vector3());
    const dist = Math.max(s.x * 1.15, s.y * 1.9, 3.5) * 1.35 * Math.max(1, 1.3 / (this.camera.aspect || 1));
    this.controls.target.set(c.x, 1.2, c.z);
    this.camera.position.set(c.x + dist * 0.35, 1.2 + dist * 0.45, c.z + dist);
    this.controls.update(); this.request();
    void R;
  }
  select(pid) {
    (this.cabMeshes || []).forEach((m) => { const on = m.userData.pid === pid; (Array.isArray(m.material) ? m.material : [m.material]).forEach((mt) => { if (mt.emissive) mt.emissive.setHex(on ? 0x3a1a06 : 0x000000); }); });
    this.request();
  }
  highlightLink(lid) {
    (this.cableMeshes || []).forEach((m) => { m.material.emissive.setHex(m.userData.lid === lid ? 0x8a3a10 : 0x000000); });
    this.request();
  }
  png() { this.renderer.render(this.scene, this.camera); return this.renderer.domElement.toDataURL('image/png'); }

  bind() {
    const el = this.renderer.domElement;
    const pick = (ev, list) => {
      const r = el.getBoundingClientRect();
      this.mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      this.ray.setFromCamera(this.mouse, this.camera);
      const h = this.ray.intersectObjects(list || [], false)[0];
      return h ? h.object : null;
    };
    let down = null;
    el.addEventListener('pointermove', (ev) => {
      if (ev.buttons) return;
      const o = pick(ev, this.cableMeshes);
      el.style.cursor = o || pick(ev, this.cabMeshes) ? 'pointer' : 'grab';
      this.onHover(o ? o.userData.lid : null, ev);
    });
    el.addEventListener('pointerleave', (ev) => this.onHover(null, ev));
    el.addEventListener('pointerdown', (ev) => { down = { x: ev.clientX, y: ev.clientY }; });
    el.addEventListener('pointerup', (ev) => {
      if (!down || Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 5) return;
      const cab = pick(ev, this.cableMeshes);
      if (cab) { this.highlightLink(cab.userData.lid); this.onPick(null, cab.userData.lid); return; }
      const o = pick(ev, this.cabMeshes);
      if (o) { this.select(o.userData.pid); this.onPick(o.userData.pid, null); }
    });
    el.addEventListener('dblclick', (ev) => { const o = pick(ev, this.cabMeshes); if (o) this.onOpen(o.userData.pid); });
  }
}
