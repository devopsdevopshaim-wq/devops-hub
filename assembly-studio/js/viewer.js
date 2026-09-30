/* מכלול — מנוע התלת-ממד: טעינת מודלים, אנימציית הרכבה, הקלטת סרטונים ושרטוטים. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const OCCT_URL = 'https://cdn.jsdelivr.net/npm/occt-import-js@0.0.23/dist/';

export const MODEL_EXT = ['step', 'stp', 'iges', 'igs', 'stl', 'obj', 'glb', 'gltf'];
export const NATIVE_EXT = ['sldprt', 'sldasm', 'slddrw'];

const PALETTE = [0x8fa3b8, 0xc9a86a, 0x6f8fa6, 0xb4b9bf, 0x7fa38a, 0xa67f6f, 0x9a8fb8, 0xd0c7b0, 0x6f7f96, 0xb89a6f];
const ACCENT = 0xf2711c;

export function extOf(name) { return String(name).split('.').pop().toLowerCase(); }
export function baseName(name) { return String(name).replace(/\.[^.]+$/, ''); }
/* שם חלק בלי מספור המופע של SolidWorks: "Bolt-3", "Bolt<2>", "Bolt:1" → "Bolt" */
export function partKey(name) {
  return String(name || 'חלק').replace(/_primitive\d+$/i, '').replace(/(\s*<\d+>|-\d+|:\d+)$/, '').trim() || 'חלק';
}

const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const clamp01 = (u) => Math.max(0, Math.min(1, u));

let occtPromise = null;
function loadOcct() {
  if (occtPromise) return occtPromise;
  occtPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = OCCT_URL + 'occt-import-js.js';
    s.onload = () => window.occtimportjs({ locateFile: (f) => OCCT_URL + f }).then(resolve, reject);
    s.onerror = () => { occtPromise = null; reject(new Error('לא הצלחתי לטעון את קורא ה-STEP. בדקו חיבור לאינטרנט.')); };
    document.head.appendChild(s);
  });
  return occtPromise;
}

export class Studio3D {
  constructor(host) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'three-canvas';
    this.scene = new THREE.Scene();
    this.bg = new THREE.Color(0x10151f);
    this.scene.background = this.bg;
    this.camera = new THREE.PerspectiveCamera(40, 16 / 9, 1, 1e6);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445066, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(1, 2, 1.4);
    this.sun = sun;
    this.scene.add(sun);
    this.camLight = new THREE.DirectionalLight(0xffffff, 0.6);
    this.camera.add(this.camLight);
    this.scene.add(this.camera);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.grid = null;
    this.occ = [];
    this.keys = [];
    this.stepOf = new Map();
    this.steps = [];
    this.playing = null;
    this.center = new THREE.Vector3();
    this.radius = 100;
    this.attach(host);
    this._resize = new ResizeObserver(() => this.fit());
    this._resize.observe(host);
    const loop = () => {
      requestAnimationFrame(loop);
      if (this.playing) this._tick();
      else this.controls.update();
      if (!this.frozen) this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  attach(host) {
    this.host = host;
    host.appendChild(this.canvas);
    if (this._resize) { this._resize.disconnect(); this._resize.observe(host); }
    this.fit();
  }

  fit() {
    if (this.frozen || !this.host) return;
    const w = this.host.clientWidth || 640, h = this.host.clientHeight || 360;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  clear() {
    this.stop();
    this.root.clear();
    this.occ = [];
    this.keys = [];
    this.stepOf.clear();
    this.steps = [];
  }

  hasGeometry() { return this.occ.length > 0; }

  _material(key) {
    let i = this.keys.indexOf(key);
    if (i < 0) { this.keys.push(key); i = this.keys.length - 1; }
    return new THREE.MeshStandardMaterial({ color: PALETTE[i % PALETTE.length], metalness: 0.35, roughness: 0.5 });
  }

  _addOccurrence(name, meshes) {
    const key = partKey(name);
    const g = new THREE.Group();
    g.name = name;
    const mat = this._material(key);
    meshes.forEach((m) => {
      if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals();
      m.material = m.userData.color ? new THREE.MeshStandardMaterial({ color: m.userData.color, metalness: 0.35, roughness: 0.5 }) : mat;
      m.userData.baseMat = m.material;
      g.add(m);
    });
    this.root.add(g);
    this.occ.push({ obj: g, key, name });
  }

  async loadFile(name, blob) {
    const ext = extOf(name);
    const buf = await blob.arrayBuffer();
    if (ext === 'stl') {
      const geo = new STLLoader().parse(buf);
      this._addOccurrence(baseName(name), [new THREE.Mesh(geo)]);
    } else if (ext === 'obj') {
      const obj = new OBJLoader().parse(new TextDecoder().decode(buf));
      const meshes = [];
      obj.traverse((m) => { if (m.isMesh) meshes.push(m); });
      if (meshes.length === 1) this._addOccurrence(baseName(name), meshes);
      else meshes.forEach((m) => this._addOccurrence(m.name || baseName(name), [m]));
    } else if (ext === 'glb' || ext === 'gltf') {
      const gltf = await new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej));
      gltf.scene.updateMatrixWorld(true);
      const mm = new THREE.Matrix4().makeScale(1000, 1000, 1000); // glTF במטרים → מ״מ
      gltf.scene.traverse((m) => {
        if (!m.isMesh) return;
        const geo = m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(mm, m.matrixWorld));
        this._addOccurrence(m.name || (m.parent && m.parent.name) || baseName(name), [new THREE.Mesh(geo)]);
      });
    } else if (ext === 'step' || ext === 'stp' || ext === 'iges' || ext === 'igs') {
      const occt = await loadOcct();
      const params = { linearUnit: 'millimeter', linearDeflectionType: 'bounding_box_ratio', linearDeflection: 0.002, angularDeflection: 0.4 };
      const data = new Uint8Array(buf);
      const res = ext.startsWith('i') ? occt.ReadIgesFile(data, params) : occt.ReadStepFile(data, params);
      if (!res || !res.success) throw new Error('הקובץ ' + name + ' לא נקרא. ודאו שזה STEP/IGES תקין.');
      const toMesh = (i) => {
        const src = res.meshes[i];
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(src.attributes.position.array, 3));
        if (src.attributes.normal) geo.setAttribute('normal', new THREE.Float32BufferAttribute(src.attributes.normal.array, 3));
        if (src.index) geo.setIndex(Array.from(src.index.array));
        const m = new THREE.Mesh(geo);
        if (src.color) m.userData.color = new THREE.Color(src.color[0], src.color[1], src.color[2]);
        return { m, name: src.name };
      };
      let found = 0;
      const walk = (node) => {
        // occt מצמיד את החלקים של תת-מכלול לצומת שלו; לכל רשת יש את שם החלק
        (node.meshes || []).forEach((i) => {
          const x = toMesh(i);
          this._addOccurrence(x.name || node.name || baseName(name), [x.m]);
          found++;
        });
        (node.children || []).forEach(walk);
      };
      walk(res.root);
      if (!found) res.meshes.forEach((_, i) => { const x = toMesh(i); this._addOccurrence(x.name || baseName(name), [x.m]); });
    } else {
      throw new Error('סוג קובץ לא נתמך לתלת-ממד: ' + ext);
    }
  }

  /* מכלול לדוגמה: יחידת הנעה על פלטת בסיס */
  demo() {
    this.clear();
    const box = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return new THREE.Mesh(g); };
    const cylX = (r, len, x, y, z, seg = 40) => { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateZ(Math.PI / 2); g.translate(x, y, z); return new THREE.Mesh(g); };
    const cylY = (r, h, x, y, z, seg = 32) => { const g = new THREE.CylinderGeometry(r, r, h, seg); g.translate(x, y, z); return new THREE.Mesh(g); };
    this._addOccurrence('Base Plate', [box(620, 20, 260, 0, 10, 0)]);
    this._addOccurrence('Motor Bracket', [box(180, 50, 150, -190, 45, 0)]);
    this._addOccurrence('Motor', [cylX(60, 180, -190, 130, 0), cylX(12, 50, -75, 130, 0), box(60, 30, 50, -190, 195, 0)]);
    this._addOccurrence('Coupling', [cylX(28, 50, -40, 130, 0)]);
    [30, 200].forEach((x, i) => this._addOccurrence('Bearing Block-' + (i + 1), [box(80, 90, 120, x, 65, 0), cylX(42, 70, x, 130, 0)]));
    this._addOccurrence('Shaft', [cylX(18, 330, 110, 130, 0)]);
    this._addOccurrence('Pulley', [cylX(75, 35, 262, 130, 0)]);
    this._addOccurrence('Key 8x7x30', [box(30, 7, 8, 262, 150, 0)]);
    const bolts = [];
    [30, 200].forEach((x) => [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => bolts.push([x + sx * 28, sz * 45, 110]))));
    [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => bolts.push([-190 + sx * 70, sz * 60, 70])));
    bolts.forEach(([x, z, top], i) => {
      this._addOccurrence('Bolt M10x40-' + (i + 1), [cylY(9, 7, x, top + 5.5, z, 6), cylY(5, 40, x, top - 18, z)]);
      this._addOccurrence('Washer M10-' + (i + 1), [cylY(10.5, 2, x, top + 1, z)]);
    });
    return this.finalize();
  }

  finalize() {
    const box = new THREE.Box3();
    this.occ.forEach((o) => {
      o.obj.position.set(0, 0, 0);
      o.obj.updateMatrixWorld(true);
      o.box = new THREE.Box3().setFromObject(o.obj);
      o.center = o.box.getCenter(new THREE.Vector3());
      box.union(o.box);
    });
    if (box.isEmpty()) return [];
    this.box = box;
    this.center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    this.size = size;
    this.radius = Math.max(size.length() / 2, 1);
    const up = new THREE.Vector3(0, 1, 0);
    this.occ.forEach((o) => {
      const d = o.center.clone().sub(this.center);
      d.y = Math.max(d.y, 0);
      o.dir = d.lengthSq() < 1e-6 ? up.clone() : d.normalize().add(up.clone().multiplyScalar(0.8)).normalize();
    });
    this.explodeDist = this.radius * 0.9;
    if (this.grid) this.scene.remove(this.grid);
    const gsize = Math.ceil(this.radius * 5 / 100) * 100;
    this.grid = new THREE.GridHelper(gsize, 20, 0x3a4a63, 0x243044);
    this.grid.position.set(this.center.x, box.min.y - 0.5, this.center.z);
    this.scene.add(this.grid);
    this.sun.position.set(this.center.x + this.radius * 2, this.center.y + this.radius * 3, this.center.z + this.radius * 2.5);
    this.home();
    return this.parts();
  }

  home() {
    const r = this.radius;
    this.camera.near = r / 100; this.camera.far = r * 100;
    this.camera.position.set(this.center.x + r * 1.6, this.center.y + r * 1.1, this.center.z + r * 2.0);
    this.controls.target.copy(this.center);
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  /* סיכום חלקים לפי שם: כמות, מידות ומיקום */
  parts() {
    const map = new Map();
    this.occ.forEach((o) => {
      if (!map.has(o.key)) {
        const s = o.box.getSize(new THREE.Vector3());
        map.set(o.key, { key: o.key, name: o.key, qty: 0, size: [s.x, s.y, s.z], center: [o.center.x, o.center.y, o.center.z], geo: true });
      }
      map.get(o.key).qty++;
    });
    return Array.from(map.values());
  }

  bounds() { return this.size ? [this.size.x, this.size.y, this.size.z] : null; }

  highlight(keys) {
    const set = new Set(keys || []);
    this.occ.forEach((o) => o.obj.traverse((m) => {
      if (!m.isMesh) return;
      if (set.size && set.has(o.key)) {
        if (!m.userData.hiMat) { m.userData.hiMat = m.userData.baseMat.clone(); m.userData.hiMat.emissive = new THREE.Color(ACCENT); m.userData.hiMat.emissiveIntensity = 0.55; }
        m.material = m.userData.hiMat;
      } else m.material = m.userData.baseMat;
    }));
  }

  /* steps: מערך של מערכי מפתחות חלקים, לפי סדר ההרכבה */
  setPlan(steps, captions) {
    this.steps = steps || [];
    this.captions = captions || [];
    this.stepOf.clear();
    this.steps.forEach((keys, i) => keys.forEach((k) => { if (!this.stepOf.has(k)) this.stepOf.set(k, i); }));
  }

  _stepIndex(o) { return this.stepOf.has(o.key) ? this.stepOf.get(o.key) : 0; }

  /* ---------- ציר הזמן של סרטון ההרכבה ---------- */
  timeline(opts = {}) {
    const per = opts.stepSeconds || 3.4;
    const from = opts.from ?? 0, to = opts.to ?? this.steps.length - 1;
    const segs = [];
    if (opts.intro !== false) segs.push({ kind: 'intro', len: 3 });
    for (let s = from; s <= to; s++) segs.push({ kind: 'step', step: s, len: per });
    if (opts.outro !== false) segs.push({ kind: 'outro', len: 3 });
    let t = 0;
    segs.forEach((g) => { g.start = t; t += g.len; });
    return { segs, total: t };
  }

  poseAt(tl, t) {
    const seg = tl.segs.find((g) => t < g.start + g.len) || tl.segs[tl.segs.length - 1];
    const u = clamp01((t - seg.start) / seg.len);
    const D = this.explodeDist;
    let cap = null;
    this.occ.forEach((o) => {
      const si = this._stepIndex(o);
      let visible = true, off = 0, hi = false;
      if (seg.kind === 'intro') off = ease(clamp01((u - 0.45) / 0.45)) * 0.6;
      else if (seg.kind === 'step') {
        if (si > seg.step) visible = false;
        else if (si === seg.step) { off = 1 - ease(clamp01((u - 0.12) / 0.62)); hi = u < 0.92; }
      }
      o.obj.visible = visible;
      o.obj.position.copy(o.dir).multiplyScalar(off * D);
      o.hi = hi;
    });
    this.highlight(this.occ.filter((o) => o.hi && o.obj.visible).map((o) => o.key));
    const az = 0.7 + t * 0.12, el = 0.42, r = this.radius * 2.7;
    this.camera.position.set(this.center.x + r * Math.cos(el) * Math.sin(az), this.center.y + r * Math.sin(el), this.center.z + r * Math.cos(el) * Math.cos(az));
    this.camera.lookAt(this.center);
    if (seg.kind === 'intro') cap = { kicker: 'סרטון הרכבה', title: this.title || 'מכלול', line: this.steps.length + ' שלבים' };
    else if (seg.kind === 'outro') cap = { kicker: 'סיום', title: 'ההרכבה הושלמה', line: this.title || '' };
    else {
      const c = this.captions[seg.step] || {};
      cap = { kicker: 'שלב ' + (seg.step + 1) + ' מתוך ' + this.steps.length, title: c.title || '', line: c.line || '' };
    }
    return cap;
  }

  resetPose() {
    this.occ.forEach((o) => { o.obj.visible = true; o.obj.position.set(0, 0, 0); });
    this.highlight([]);
  }

  play(opts = {}) {
    this.stop();
    const tl = this.timeline(opts);
    this.playing = { tl, t0: performance.now(), onFrame: opts.onFrame, onEnd: opts.onEnd, loop: opts.loop };
    this.controls.enabled = false;
    return tl;
  }

  _tick() {
    const p = this.playing;
    let t = (performance.now() - p.t0) / 1000;
    if (t >= p.tl.total) {
      if (p.loop) { p.t0 = performance.now(); t = 0; }
      else { const end = p.onEnd; this.stop(); if (end) end(); return; }
    }
    const cap = this.poseAt(p.tl, t);
    if (p.onFrame) p.onFrame(cap, t, p.tl.total);
  }

  stop() {
    if (!this.playing) return;
    this.playing = null;
    this.controls.enabled = true;
    this.resetPose();
    this.home();
  }

  /* הקלטת סרטון WebM עם כתוביות. מחזיר Blob. */
  record(opts = {}) {
    const W = 1280, H = 720;
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const ctx = out.getContext('2d');
    const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
    const mime = types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
    if (!mime) return Promise.reject(new Error('הדפדפן הזה לא תומך בהקלטת וידאו. נסו Chrome או Edge.'));
    const stream = out.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6e6 });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    this.frozen = true;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(W, H, false);
    this.camera.aspect = W / H; this.camera.updateProjectionMatrix();
    return new Promise((resolve, reject) => {
      rec.onstop = () => resolve({ blob: new Blob(chunks, { type: mime.split(';')[0] }), mime });
      rec.onerror = (e) => reject(e.error || new Error('ההקלטה נכשלה'));
      rec.start(250);
      const tl = this.timeline(opts);
      const t0 = performance.now();
      const frame = () => {
        const t = (performance.now() - t0) / 1000;
        if (t >= tl.total || opts.signal?.aborted) {
          rec.stop();
          this.frozen = false;
          this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
          this.resetPose(); this.home(); this.fit();
          return;
        }
        const cap = this.poseAt(tl, t);
        this.renderer.render(this.scene, this.camera);
        ctx.drawImage(this.canvas, 0, 0, W, H);
        drawCaption(ctx, W, H, cap, t, tl);
        if (opts.onProgress) opts.onProgress(t / tl.total);
        requestAnimationFrame(frame);
      };
      frame();
    });
  }

  /* ---------- שרטוטים ---------- */
  _drawMode(on) {
    if (on && !this._saved) {
      this._saved = { bg: this.scene.background, grid: this.grid && this.grid.visible };
      this.scene.background = new THREE.Color(0xffffff);
      if (this.grid) this.grid.visible = false;
    } else if (!on && this._saved) {
      this.scene.background = this._saved.bg;
      if (this.grid) this.grid.visible = this._saved.grid;
      this._saved = null;
    }
    this.occ.forEach((o) => o.obj.traverse((m) => {
      if (!m.isMesh) return;
      if (on && !m.userData.edges) {
        const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 28), new THREE.LineBasicMaterial({ color: 0x111111 }));
        e.visible = false;
        m.add(e);
        m.userData.edges = e;
      }
      if (m.userData.edges) m.userData.edges.visible = on;
    }));
  }

  _style(o, style) {
    const face = { plain: 0xe9edf2, ghost: 0xf6f7f8, focus: 0xffc79a }[style];
    const line = { plain: 0x111111, ghost: 0xb8bec6, focus: 0x6b2a00 }[style];
    o.obj.traverse((m) => {
      if (!m.isMesh) return;
      m.userData.drawMat = m.userData.drawMat || new THREE.MeshLambertMaterial({ polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
      m.userData.drawMat.color.setHex(face);
      m.material = m.userData.drawMat;
      if (m.userData.edges) m.userData.edges.material.color.setHex(line);
    });
  }

  /* מצלם מבט אורתוגרפי לאזור בגיליון. מחזיר פונקציה שממירה נקודה בעולם לפיקסל בגיליון. */
  _view(ctx, rect, dir, upv) {
    const vis = this.occ.filter((o) => o.obj.visible);
    const box = new THREE.Box3();
    vis.forEach((o) => { o.obj.updateMatrixWorld(true); box.union(new THREE.Box3().setFromObject(o.obj)); });
    const c = box.getCenter(new THREE.Vector3());
    const R = box.getSize(new THREE.Vector3()).length() || 1;
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, R * 0.01, R * 10);
    cam.up.copy(upv || new THREE.Vector3(0, 1, 0));
    cam.position.copy(c).add(dir.clone().normalize().multiplyScalar(R * 3));
    cam.lookAt(c);
    cam.updateMatrixWorld(true);
    const inv = cam.matrixWorldInverse;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    vis.forEach((o) => {
      const b = new THREE.Box3().setFromObject(o.obj);
      for (let i = 0; i < 8; i++) {
        const p = new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(inv);
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
    });
    const aspect = rect.w / rect.h;
    let w = (maxX - minX) * 1.12 || 1, h = (maxY - minY) * 1.12 || 1;
    if (w / h > aspect) h = w / aspect; else w = h * aspect;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    Object.assign(cam, { left: cx - w / 2, right: cx + w / 2, top: cy + h / 2, bottom: cy - h / 2 });
    cam.updateProjectionMatrix();
    const scale = 2;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(rect.w * scale, rect.h * scale, false);
    this.renderer.render(this.scene, cam);
    ctx.drawImage(this.canvas, rect.x, rect.y, rect.w, rect.h);
    return (v) => {
      const p = v.clone().applyMatrix4(inv);
      return { x: rect.x + ((p.x - cam.left) / (cam.right - cam.left)) * rect.w, y: rect.y + ((cam.top - p.y) / (cam.top - cam.bottom)) * rect.h };
    };
  }

  /* bom: [{key, name, qty}] לפי סדר המספור; plan: { steps:[{title, keys}] } */
  drawings(info, bom, plan) {
    const sheets = [];
    const num = new Map(bom.map((b, i) => [b.key, i + 1]));
    const date = new Date().toLocaleDateString('he-IL');
    const code = 'ASM-' + String(info.id || '').slice(-5).toUpperCase();
    const totalSheets = 2 + (plan ? plan.steps.length : 0);
    this.frozen = true;
    this.stop();
    this._drawMode(true);
    const iso = new THREE.Vector3(1, 0.8, 1.15);
    try {
      // גיליון 1: מבטים כלליים עם מידות
      {
        const { cv, ctx, area } = sheet('מבטים כלליים', info, code + '-01', date, 1, totalSheets);
        this.resetPose(); this._drawMode(true);
        this.occ.forEach((o) => this._style(o, 'plain'));
        const gw = area.w / 2, gh = area.h / 2;
        const cells = [
          { t: 'מבט חזית', r: { x: area.x + gw, y: area.y, w: gw, h: gh }, d: new THREE.Vector3(0, 0, 1) },
          { t: 'מבט צד', r: { x: area.x, y: area.y, w: gw, h: gh }, d: new THREE.Vector3(1, 0, 0) },
          { t: 'מבט על', r: { x: area.x + gw, y: area.y + gh, w: gw, h: gh }, d: new THREE.Vector3(0, 1, 0), up: new THREE.Vector3(0, 0, -1) },
          { t: 'מבט איזומטרי', r: { x: area.x, y: area.y + gh, w: gw, h: gh }, d: iso }
        ];
        cells.forEach((cell) => {
          const pad = { x: cell.r.x + 50, y: cell.r.y + 60, w: cell.r.w - 100, h: cell.r.h - 120 };
          const proj = this._view(ctx, pad, cell.d, cell.up);
          label(ctx, cell.t, cell.r.x + cell.r.w / 2, cell.r.y + 44);
          const b = this.box, s = this.size;
          if (cell.t === 'מבט חזית') {
            dimension(ctx, proj(new THREE.Vector3(b.min.x, b.min.y, b.max.z)), proj(new THREE.Vector3(b.max.x, b.min.y, b.max.z)), 30, s.x);
            dimension(ctx, proj(new THREE.Vector3(b.max.x, b.min.y, b.max.z)), proj(new THREE.Vector3(b.max.x, b.max.y, b.max.z)), 30, s.y);
          } else if (cell.t === 'מבט צד') {
            dimension(ctx, proj(new THREE.Vector3(b.max.x, b.min.y, b.max.z)), proj(new THREE.Vector3(b.max.x, b.min.y, b.min.z)), 30, s.z);
          }
          ctx.strokeStyle = '#c8ccd2'; ctx.lineWidth = 1; ctx.strokeRect(cell.r.x + 8, cell.r.y + 8, cell.r.w - 16, cell.r.h - 16);
        });
        sheets.push({ title: 'מבטים כלליים', file: code + '-01.png', canvas: cv });
      }
      // גיליון 2: מבט מפוצץ עם בלונים ורשימת חלקים
      {
        const { cv, ctx, area } = sheet('מבט מפוצץ ורשימת חלקים', info, code + '-02', date, 2, totalSheets);
        this.resetPose(); this._drawMode(true);
        this.occ.forEach((o) => { this._style(o, 'plain'); o.obj.position.copy(o.dir).multiplyScalar(this.explodeDist * 0.55); });
        const tableW = 520;
        const draw = { x: area.x + tableW + 40, y: area.y + 30, w: area.w - tableW - 80, h: area.h - 60 };
        const proj = this._view(ctx, draw, iso);
        balloons(ctx, draw, bom.map((b) => {
          const o = this.occ.find((x) => x.key === b.key);
          if (!o) return null;
          const c = new THREE.Box3().setFromObject(o.obj).getCenter(new THREE.Vector3());
          return { n: num.get(b.key), at: proj(c) };
        }).filter(Boolean));
        bomTable(ctx, { x: area.x + 20, y: area.y + 20, w: tableW }, bom.map((b, i) => [i + 1, b.name, b.qty]));
        sheets.push({ title: 'מבט מפוצץ ורשימת חלקים', file: code + '-02.png', canvas: cv });
      }
      // גיליון לכל שלב
      (plan ? plan.steps : []).forEach((st, i) => {
        const title = 'שלב ' + (i + 1) + ': ' + st.title;
        const { cv, ctx, area } = sheet(title, info, code + '-' + String(i + 3).padStart(2, '0'), date, i + 3, totalSheets);
        const keys = new Set(st.keys);
        this.resetPose(); this._drawMode(true);
        const cur = [];
        this.occ.forEach((o) => {
          const si = this._stepIndex(o);
          o.obj.visible = si <= i;
          if (si === i) { this._style(o, 'focus'); o.obj.position.copy(o.dir).multiplyScalar(i ? this.explodeDist * 0.35 : 0); cur.push(o); } else this._style(o, 'ghost');
        });
        if (!cur.length && !this.occ.some((o) => o.obj.visible)) return;
        const tableW = 460;
        const draw = { x: area.x + tableW + 40, y: area.y + 30, w: area.w - tableW - 80, h: area.h - 60 };
        const proj = this._view(ctx, draw, iso);
        // חץ הכנסה: מהמיקום המפוצץ למקום הסופי
        ctx.save(); ctx.setLineDash([10, 8]); ctx.strokeStyle = '#b3470b'; ctx.lineWidth = 2.5;
        const seen = new Set();
        cur.forEach((o) => {
          const c = new THREE.Box3().setFromObject(o.obj).getCenter(new THREE.Vector3());
          const a = proj(c), b = proj(c.clone().sub(o.obj.position));
          if (Math.hypot(a.x - b.x, a.y - b.y) > 20) arrow(ctx, a, b);
          seen.add(o.key);
        });
        ctx.restore();
        const items = [];
        seen.forEach((k) => {
          const o = cur.find((x) => x.key === k);
          const c = new THREE.Box3().setFromObject(o.obj).getCenter(new THREE.Vector3());
          items.push({ n: num.get(k) || '?', at: proj(c) });
        });
        balloons(ctx, draw, items);
        const rows = st.keys.filter((k) => keys.has(k)).map((k) => { const b = bom.find((x) => x.key === k); return [num.get(k) || '', b ? b.name : k, b ? b.qty : '']; });
        bomTable(ctx, { x: area.x + 20, y: area.y + 20, w: tableW }, rows, 'חלקים בשלב זה');
        sheets.push({ title, file: code + '-' + String(i + 3).padStart(2, '0') + '.png', canvas: cv });
      });
    } finally {
      this.resetPose();
      this._drawMode(false);
      this.frozen = false;
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      this.fit();
    }
    return sheets;
  }

  /* תמונת תצוגה של המכלול (לשליחה ל-Claude ולמסמך) */
  snapshot(w = 1200, h = 800) {
    this.frozen = true;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
    const url = this.canvas.toDataURL('image/jpeg', 0.85);
    this.frozen = false;
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.fit();
    return url;
  }
}

/* ---------- ציור על גבי הגיליון (Canvas 2D) ---------- */
const FONT = '"Heebo", "Assistant", Arial, sans-serif';

function sheet(title, info, dwg, date, n, total) {
  const W = 2339, H = 1654; // A3 לרוחב ב-200dpi
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.strokeRect(20, 20, W - 40, H - 40);
  ctx.lineWidth = 4; ctx.strokeRect(50, 50, W - 100, H - 100);
  // סימוני אזורים בשוליים
  ctx.font = '20px ' + FONT; ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < 8; i++) { const x = 50 + (W - 100) * (i + 0.5) / 8; ctx.fillText(String(8 - i), x, 35); ctx.fillText(String(8 - i), x, H - 35); }
  for (let i = 0; i < 6; i++) { const y = 50 + (H - 100) * (i + 0.5) / 6; const L = 'ABCDEF'[i]; ctx.fillText(L, 35, y); ctx.fillText(L, W - 35, y); }
  // כותרת
  const tb = { x: 50, y: H - 50 - 220, w: 820, h: 220 };
  ctx.lineWidth = 3; ctx.strokeRect(tb.x, tb.y, tb.w, tb.h);
  ctx.lineWidth = 1.5;
  const rows = [[tb.y + 70], [tb.y + 130], [tb.y + 190]];
  rows.forEach(([y]) => { ctx.beginPath(); ctx.moveTo(tb.x, y); ctx.lineTo(tb.x + tb.w, y); ctx.stroke(); });
  [tb.x + 280, tb.x + 560].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, tb.y + 70); ctx.lineTo(x, tb.y + 190); ctx.stroke(); });
  ctx.textAlign = 'right'; ctx.direction = 'rtl'; ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 34px ' + FONT; ctx.fillText(fitText(ctx, info.name || 'מכלול', tb.w - 30), tb.x + tb.w - 16, tb.y + 48);
  const cell = (label, value, x, y) => { ctx.font = '17px ' + FONT; ctx.fillStyle = '#555'; ctx.fillText(label, x + 270, y + 20); ctx.font = 'bold 22px ' + FONT; ctx.fillStyle = '#111'; ctx.fillText(fitText(ctx, value, 250), x + 270, y + 44); };
  cell('שם הגיליון', title, tb.x + 540, tb.y + 70);
  cell('מספר שרטוט', dwg, tb.x + 270, tb.y + 70);
  cell('תאריך', date, tb.x - 10, tb.y + 70);
  cell('קנה מידה', 'ללא קנ״מ', tb.x + 540, tb.y + 130);
  cell('יחידות', 'מ״מ', tb.x + 270, tb.y + 130);
  cell('גיליון', n + ' / ' + total, tb.x - 10, tb.y + 130);
  ctx.font = '17px ' + FONT; ctx.fillStyle = '#555';
  ctx.fillText('הופק במכלול — סטודיו הרכבה. מבט איזומטרי בהיטל אורתוגרפי.', tb.x + tb.w - 16, tb.y + 212);
  // כותרת הגיליון למעלה
  ctx.fillStyle = '#111'; ctx.font = 'bold 40px ' + FONT;
  ctx.fillText(fitText(ctx, title, W - 200), W - 80, 110);
  ctx.fillStyle = '#111';
  const area = { x: 60, y: 130, w: W - 120, h: H - 130 - 60 - 230 };
  return { cv, ctx, area };
}

function fitText(ctx, s, max) {
  s = String(s || '');
  if (ctx.measureText(s).width <= max) return s;
  while (s.length > 1 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1);
  return s + '…';
}

function label(ctx, t, x, y) {
  ctx.save(); ctx.font = 'bold 26px ' + FONT; ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.direction = 'rtl';
  ctx.fillText(t, x, y);
  const w = ctx.measureText(t).width; ctx.fillRect(x - w / 2, y + 6, w, 2);
  ctx.restore();
}

function arrowHead(ctx, from, to, size = 16) {
  const a = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - size * Math.cos(a - 0.35), to.y - size * Math.sin(a - 0.35));
  ctx.lineTo(to.x - size * Math.cos(a + 0.35), to.y - size * Math.sin(a + 0.35));
  ctx.closePath(); ctx.fill();
}

function arrow(ctx, a, b) {
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.save(); ctx.setLineDash([]); ctx.fillStyle = ctx.strokeStyle; arrowHead(ctx, a, b, 20); ctx.restore();
}

/* קו מידה בין שתי נקודות, מוסט החוצה ב-off פיקסלים */
function dimension(ctx, a, b, off, value) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  if (len < 10) return;
  let nx = dy / len, ny = -dx / len;
  if (Math.abs(dx) > Math.abs(dy)) { if (ny < 0) { nx = -nx; ny = -ny; } } else if (nx < 0) { nx = -nx; ny = -ny; }
  const A = { x: a.x + nx * off, y: a.y + ny * off }, B = { x: b.x + nx * off, y: b.y + ny * off };
  ctx.save();
  ctx.strokeStyle = '#0b4f8a'; ctx.fillStyle = '#0b4f8a'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(a.x + nx * 6, a.y + ny * 6); ctx.lineTo(A.x + nx * 10, A.y + ny * 10);
  ctx.moveTo(b.x + nx * 6, b.y + ny * 6); ctx.lineTo(B.x + nx * 10, B.y + ny * 10);
  ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
  arrowHead(ctx, B, A, 14); arrowHead(ctx, A, B, 14);
  ctx.translate((A.x + B.x) / 2 + nx * 18, (A.y + B.y) / 2 + ny * 18);
  let ang = Math.atan2(dy, dx); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
  ctx.rotate(ang);
  ctx.font = 'bold 24px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'ltr';
  const txt = String(Math.round(value));
  ctx.fillStyle = '#fff'; const w = ctx.measureText(txt).width; ctx.fillRect(-w / 2 - 4, -14, w + 8, 28);
  ctx.fillStyle = '#0b4f8a'; ctx.fillText(txt, 0, 0);
  ctx.restore();
}

/* בלונים ממוספרים עם קווי הפניה, מפוזרים כדי לא לחפוף */
function balloons(ctx, rect, items) {
  const R = 24;
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  const b = items.map((it) => {
    let dx = it.at.x - cx, dy = it.at.y - cy; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    return { ...it, x: it.at.x + dx * 110, y: it.at.y + dy * 110 };
  });
  for (let k = 0; k < 80; k++) {
    for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
      const dx = b[j].x - b[i].x, dy = b[j].y - b[i].y, d = Math.hypot(dx, dy) || 0.01, min = R * 2 + 10;
      if (d < min) { const p = (min - d) / 2; b[i].x -= dx / d * p; b[i].y -= dy / d * p; b[j].x += dx / d * p; b[j].y += dy / d * p; }
    }
    b.forEach((p) => { p.x = Math.max(rect.x + R, Math.min(rect.x + rect.w - R, p.x)); p.y = Math.max(rect.y + R, Math.min(rect.y + rect.h - R, p.y)); });
  }
  ctx.save();
  b.forEach((p) => {
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1.6; ctx.setLineDash([]);
    const dx = p.at.x - p.x, dy = p.at.y - p.y, l = Math.hypot(dx, dy) || 1;
    ctx.beginPath(); ctx.moveTo(p.x + dx / l * R, p.y + dy / l * R); ctx.lineTo(p.at.x, p.at.y); ctx.stroke();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(p.at.x, p.at.y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 2.4; ctx.stroke();
    ctx.fillStyle = '#111'; ctx.font = 'bold 24px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'ltr';
    ctx.fillText(String(p.n), p.x, p.y + 1);
  });
  ctx.restore();
}

function bomTable(ctx, pos, rows, heading) {
  const rh = 38, cols = [70, pos.w - 70 - 90, 90];
  ctx.save();
  ctx.direction = 'rtl'; ctx.textBaseline = 'middle';
  let y = pos.y;
  ctx.font = 'bold 26px ' + FONT; ctx.fillStyle = '#111'; ctx.textAlign = 'right';
  ctx.fillText(heading || 'רשימת חלקים', pos.x + pos.w, y + 16); y += 40;
  const maxRows = Math.floor((1654 - 60 - 250 - y) / rh) - 1;
  const shown = rows.slice(0, Math.max(0, maxRows));
  const all = [['#', 'תיאור', 'כמות']].concat(shown);
  if (rows.length > shown.length) all.push(['', '+' + (rows.length - shown.length) + ' פריטים נוספים במסמך', '']);
  all.forEach((r, i) => {
    let x = pos.x + pos.w;
    ctx.fillStyle = i === 0 ? '#e8ecf1' : (i % 2 ? '#fff' : '#f7f8fa');
    ctx.fillRect(pos.x, y, pos.w, rh);
    ctx.strokeStyle = '#111'; ctx.lineWidth = i === 0 ? 2 : 1; ctx.strokeRect(pos.x, y, pos.w, rh);
    r.forEach((v, c) => {
      const w = cols[c];
      ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x - w, y + rh); ctx.stroke();
      ctx.fillStyle = '#111'; ctx.font = (i === 0 ? 'bold ' : '') + '21px ' + FONT;
      ctx.textAlign = c === 1 ? 'right' : 'center';
      ctx.fillText(fitText(ctx, v, w - 16), c === 1 ? x - 10 : x - w / 2, y + rh / 2 + 1);
      x -= w;
    });
    y += rh;
  });
  ctx.restore();
}

function drawCaption(ctx, W, H, cap, t, tl) {
  if (!cap) return;
  ctx.save();
  ctx.direction = 'rtl'; ctx.textAlign = 'right';
  const g = ctx.createLinearGradient(0, H - 190, 0, H);
  g.addColorStop(0, 'rgba(10,14,22,0)'); g.addColorStop(0.45, 'rgba(10,14,22,.82)'); g.addColorStop(1, 'rgba(10,14,22,.92)');
  ctx.fillStyle = g; ctx.fillRect(0, H - 190, W, 190);
  ctx.fillStyle = '#f2711c'; ctx.fillRect(W - 60, H - 128, 6, 86);
  ctx.fillStyle = '#f5b98c'; ctx.font = '600 24px ' + FONT; ctx.fillText(cap.kicker || '', W - 76, H - 108);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 40px ' + FONT; ctx.fillText(fitText(ctx, cap.title || '', W - 160), W - 76, H - 66);
  ctx.fillStyle = '#d6dde8'; ctx.font = '26px ' + FONT; ctx.fillText(fitText(ctx, cap.line || '', W - 160), W - 76, H - 28);
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(0, H - 6, W, 6);
  ctx.fillStyle = '#f2711c'; ctx.fillRect(W - W * (t / tl.total), H - 6, W * (t / tl.total), 6);
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = 'bold 22px ' + FONT; ctx.textAlign = 'left'; ctx.direction = 'ltr';
  ctx.fillText('מכלול', 28, 44);
  ctx.restore();
}
