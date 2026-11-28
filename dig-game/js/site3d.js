/* שכבות — standing on a real site of the world expedition, in first person. The ground is the real terrain of the place
   (elevation data from AWS Terrain Tiles, about 2 km around the site), with scanned rock and soil materials that change
   with the slope. You walk where you tap, look around by dragging, hold a metal detector, pick up potsherds, and dig a
   trench right in the ground with a pick and a brush. */
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from '../vendor/three/addons/geometries/RoundedBoxGeometry.js';

const CELL = 10, NEAR = 72, WALK = 62, EYE = 1.62;
let renderer, scene, camera, clock, raf = 0, host = null, ro = null, H = {}, site = null;
let dem = null, mats = null, holeU = null, sun = null;
let labels = [], sherds = [], buried = [], trench = null, spoil = null;
let me = null, mode = 'walk', tool = 'pick', detectorOn = false, beepT = 0, energy = 0, view = null, swingT = 9, keys = {};
const R0 = Math.random;

/* ---------- assets ---------- */
const texLoader = new THREE.TextureLoader();
const TEXC = {};
function tex(name, kind, rep) {
  const key = name + kind + rep;
  if (!TEXC[key]) { const t = texLoader.load(`assets/tex/${name}_${kind}.webp`); t.colorSpace = kind === 'diff' ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = 8; TEXC[key] = t; }
  return TEXC[key];
}
function pbr(name, rep = [1, 1], extra = {}) {
  const arm = tex(name, 'arm', rep);
  return new THREE.MeshStandardMaterial({ map: tex(name, 'diff', rep), normalMap: tex(name, 'nor', rep), aoMap: arm, roughnessMap: arm, metalnessMap: arm, roughness: 1, metalness: 1, ...extra });
}
const gltf = new GLTFLoader();
const MODELS = {};
const load = (url) => new Promise((res) => gltf.load(url, (g) => res(g), undefined, () => res(null)));
let ready = null;
function loadModels() {
  if (!ready) ready = Promise.all(['quiver_tree_01', 'shrub_01', 'namaqualand_boulder_02', 'wooden_crate_01', 'wooden_bucket_01', 'wicker_basket_01', 'antique_ceramic_vase_01', 'jug_01', 'picke_dirty_01']
    .map((n) => load(`assets/models/${n}.glb`).then((g) => { if (g) { g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); MODELS[n] = g.scene; } })));
  return ready;
}
function fit(name, w, h) {
  const src = MODELS[name]; if (!src) return null;
  const m = src.clone(true), box = new THREE.Box3().setFromObject(m), s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const k = Math.min(h / s.y, w / Math.max(s.x, s.z));
  m.scale.setScalar(k); m.position.set(-c.x * k, -box.min.y * k, -c.z * k);
  const g = new THREE.Group(); g.add(m); return g;
}
let demMeta = null;
async function loadDem(id) {
  if (!demMeta) demMeta = await fetch('assets/terrain/terrain.json').then((r) => r.json()).catch(() => ({}));
  const m = demMeta[id];
  if (!m) return null;
  const img = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = `assets/terrain/${id}.png`; });
  if (!img) return null;
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, c.width, c.height).data, n = c.width, data = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) data[i] = m.min + ((px[i * 4] * 256 + px[i * 4 + 1]) / 65535) * (m.max - m.min) - m.centre;
  return { n, data, span: m.span };
}

/* ---------- the ground ---------- */
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y) => vnoise(x, y) * 0.55 + vnoise(x * 2.1, y * 2.1) * 0.28 + vnoise(x * 4.3, y * 4.3) * 0.17;
const cellPos = (c, r) => new THREE.Vector2((c - 2) * CELL, (r - 2) * CELL);
function demAt(x, z) {
  const n = dem.n, f = (v) => Math.max(0, Math.min(n - 1.001, (v / dem.span + 0.5) * (n - 1)));
  const u = f(x), v = f(z), i = Math.floor(u), j = Math.floor(v), a = u - i, b = v - j, d = dem.data;
  return (d[j * n + i] * (1 - a) + d[j * n + i + 1] * a) * (1 - b) + (d[(j + 1) * n + i] * (1 - a) + d[(j + 1) * n + i + 1] * a) * b;
}
// on a sea site there is no elevation data: the sea floor is shaped from the map's landmarks
let bumps = [];
function hAt(x, z) {
  const r = Math.max(Math.abs(x), Math.abs(z));
  const near = 1 - Math.min(1, Math.max(0, (r - NEAR + 10) / 10));
  const detail = ((fbm(x * 0.22 + 3, z * 0.22 + 7) - 0.5) * 0.7 + (fbm(x * 1.4, z * 1.4) - 0.5) * 0.09) * near;
  if (dem) return demAt(x, z) + detail;
  let h = (fbm(x * 0.05 + 3, z * 0.05 + 7) - 0.5) * 1.6 + detail;
  for (const b of bumps) { const dx = x - b.x, dz = z - b.z, d2 = (dx * dx + dz * dz) / (b.s * b.s); h += b.h * Math.exp(-d2); }
  const rr = Math.hypot(x, z);
  h += Math.max(0, (rr - 40) / 14) ** 2 * 4 * (0.6 + fbm(x * 0.06, z * 0.06) * 0.8);
  return h;
}
const GROUND = { desert: ['sandy_gravel', '#d9c3a2'], hills: ['dry_ground_rocks', '#ffffff'], green: ['dry_ground_rocks', '#aebd8c'], sea: ['sandy_gravel', '#c9d8d0'], jungle: ['dry_ground_rocks', '#94ad7c'] };
// soil on the flats, bare rock on the slopes, and a square opened where a trench is dug
function groundMat(rep, far) {
  const [tx, tint] = GROUND[site.terrain] || GROUND.desert;
  const mat = pbr(tx, [rep, rep], { color: tint });
  const rock = tex('aerial_rocks_02', 'diff', [rep * 0.6, rep * 0.6]);
  if (far) { mat.polygonOffset = true; mat.polygonOffsetFactor = 2; mat.polygonOffsetUnits = 4; }
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uHole = holeU; sh.uniforms.uRock = { value: rock }; sh.uniforms.uInner = { value: far ? NEAR - 3 : -1 };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN; uniform vec4 uHole; uniform sampler2D uRock; uniform float uInner;')
      .replace('void main() {', 'void main() {\n if (uHole.w > 0.5 && abs(vWP.x - uHole.x) < uHole.z && abs(vWP.z - uHole.y) < uHole.z) discard;\n if (uInner > 0. && max(abs(vWP.x), abs(vWP.z)) < uInner) discard;')
      .replace('#include <map_fragment>', `#include <map_fragment>
 // bare rock on the slopes, and broad patches of lighter and darker ground so the texture never looks tiled
 float steep = smoothstep(0.9, 0.6, vWN.y);
 vec3 rockC = texture2D(uRock, vMapUv * 0.73).rgb * vec3(0.92, 0.84, 0.74);
 diffuseColor.rgb = mix(diffuseColor.rgb, rockC, steep);
 float macro = sin(vWP.x * 0.021 + sin(vWP.z * 0.017) * 2.0) * 0.5 + sin(vWP.z * 0.043 + vWP.x * 0.011) * 0.5;
 float macro2 = sin(vWP.x * 0.0041 + vWP.z * 0.0033) * 0.5 + 0.5;
 diffuseColor.rgb *= 0.86 + macro * 0.08 - macro2 * 0.1;
 diffuseColor.rgb *= mix(1.0, 0.72, smoothstep(0.75, 0.35, vWN.y));`);
  };
  return mat;
}
function makeTerrain() {
  const span = dem ? Math.min(dem.span, 2000) : 260;
  // the far ground: the real valleys and hills all around, to the horizon
  const far = new THREE.PlaneGeometry(span, span, 220, 220); far.rotateX(-Math.PI / 2);
  // the near ground: a metre-fine mesh where you walk and dig
  const near = new THREE.PlaneGeometry(NEAR * 2, NEAR * 2, NEAR * 2, NEAR * 2); near.rotateX(-Math.PI / 2);
  for (const geo of [far, near]) { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, hAt(p.getX(i), p.getZ(i))); geo.computeVertexNormals(); }
  holeU = { value: new THREE.Vector4(0, 0, 0, 0) };
  const fm = new THREE.Mesh(far, groundMat(span / 40, true)); fm.receiveShadow = true;
  const nm = new THREE.Mesh(near, groundMat(NEAR / 2.5, false)); nm.receiveShadow = true;
  scene.add(fm, nm);
  return nm;
}
let ground = null;

/* ---------- landmarks from the site's map ---------- */
function MAT() {
  if (mats) return mats;
  mats = {
    wall: pbr('old_stone_wall', [1.2, 0.6]), blocks: pbr('large_sandstone_blocks', [1, 1]), marble: pbr('marble_01', [0.5, 1.5]),
    rock: pbr('aerial_rocks_02', [1, 1]), wood: pbr('weathered_planks', [1, 1]), clay: pbr('clay_plaster', [1, 1], { color: '#c07a50' }),
    brick: pbr('castle_brick_07', [1, 1]), cave: new THREE.MeshBasicMaterial({ color: '#0b0805' }), cloth: new THREE.MeshStandardMaterial({ color: '#cdb991', roughness: 0.95, side: THREE.DoubleSide }),
    iron: new THREE.MeshStandardMaterial({ color: '#5e6266', metalness: 0.85, roughness: 0.4 }), handle: new THREE.MeshStandardMaterial({ color: '#7a5030', roughness: 0.65 }),
  };
  return mats;
}
function kindOf(em, label) {
  if (em === '🕳️') return 'cave';
  if (em === '⛰️') return /צוק|מצוק|הר |רכס/.test(label) ? 'cliff' : 'mound';
  if (em === '🌊' || em === '🔵') return 'water';
  if (em === '🏞️') return 'river';
  if (em === '💧') return 'well';
  if ('🌳🌲🌴'.includes(em)) return 'trees';
  if (em === '⛺') return 'tent';
  if (em === '⭕') return 'circle';
  if ('🔺🔻'.includes(em)) return 'pyramid';
  if (em === '⚓') return 'wreck';
  if ('🪨🪸🐚🐙'.includes(em)) return 'rocks';
  if (em === '🌾' || em === '🍇') return 'field';
  if (em === '🛣️' || em === '🛤️' || em === '〰️') return 'road';
  if (em === '🗿') return 'obelisk';
  if (em === '⚰️' || em === '👑') return 'tombs';
  if (em === '🏝️') return 'island';
  if ('🏭🏡🏘️🏠⛪'.includes(em)) return 'houses';
  return 'ruins';
}
let decor = [];
function place(obj, x, z, ry = 0) { obj.position.set(x, hAt(x, z), z); obj.rotation.y = ry; obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(obj); decor.push(obj); return obj; }
function box(w, h, d, m) { return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.04), m); }
// a cave belongs in a cliff: look around the mapped spot for the steepest real slope
function steepNear(x, z) {
  let best = { x, z, s: -1, dir: 0 };
  for (let a = 0; a < 24; a++) for (const r of [0, 6, 12, 18, 24]) {
    const px = x + Math.cos(a / 24 * Math.PI * 2) * r, pz = z + Math.sin(a / 24 * Math.PI * 2) * r;
    if (Math.max(Math.abs(px), Math.abs(pz)) > WALK - 4) continue;
    const gx = hAt(px + 1, pz) - hAt(px - 1, pz), gz = hAt(px, pz + 1) - hAt(px, pz - 1), s = Math.hypot(gx, gz) / 2;
    if (s > best.s) best = { x: px, z: pz, s, dir: Math.atan2(-gx, -gz) };
  }
  return best;
}
const markPos = {};
function buildMark(em, c, r, label, R) {
  const M = MAT(), p = cellPos(c, r), k = kindOf(em, label), g = new THREE.Group();
  let x = p.x, z = p.y;
  if (dem && (k === 'water' || k === 'river' || k === 'cliff' || k === 'mound')) { markPos[c + ',' + r] = { x, z }; return addLabel(label, x, z, 3); }
  if (k === 'ruins' || k === 'houses') {
    const w = k === 'houses' ? 5 : 7, d = k === 'houses' ? 4 : 6, hh = k === 'houses' ? 1.6 : 1.1 + R() * 0.8;
    for (const [wx, wz, len, off] of [[0, -d / 2, w, 0], [0, d / 2, w * 0.4, -w * 0.3], [0, d / 2, w * 0.4, w * 0.3], [-w / 2, 0, d, 'v'], [w / 2, 0, d, 'v']]) {
      const b = box(off === 'v' ? 0.6 : len, hh * (0.6 + R() * 0.5), off === 'v' ? len : 0.6, M.wall);
      b.position.set(wx + (off === 'v' ? 0 : off), b.geometry.parameters.height / 2 - 0.2, wz); g.add(b);
    }
    if ('🏛️🛕⛩️'.includes(em)) for (let i = 0; i < 4; i++) { const col = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 2.2 + R() * 2.4, 16), M.marble); col.position.set(-w / 2 + 1 + i * (w - 2) / 3, col.geometry.parameters.height / 2 - 0.2, -d / 2 - 1); g.add(col); }
    if (em === '🚪' || em === '🦁') { for (const s of [-1, 1]) { const pi = box(1, 3.4, 1, M.blocks); pi.position.set(s * 1.4, 1.5, 0); g.add(pi); } const li = box(4, 0.7, 1.1, M.blocks); li.position.y = 3.4; g.add(li); }
    if (em === '🏰' || em === '🏯') { const tw = box(3, 4.5, 3, M.blocks); tw.position.set(w / 2, 2, -d / 2); g.add(tw); }
    if (em === '⛪' || em === '🏭' || em === '🏡') { const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.72, 2, 4), M.brick); roof.rotation.y = Math.PI / 4; roof.position.y = hh + 0.8; roof.scale.z = d / w; g.add(roof); }
    place(g, x, z, R() * 0.6 - 0.3);
  } else if (k === 'cave') {
    if (dem) { const s = steepNear(x, z); x = s.x; z = s.z; }
    const y = hAt(x, z);
    const face = dem ? steepNear(x, z).dir : 0;
    // the mouth: a dark hollow sunk into the slope, framed by rock
    const hollow = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#120c08', roughness: 1, side: THREE.BackSide }));
    hollow.scale.set(1.1, 1.3, 1.5); hollow.rotation.set(-Math.PI / 2, face, 0, 'YXZ');
    hollow.position.set(x, y + 0.9, z); scene.add(hollow);
    for (let i = 0; i < 3; i++) { const a = face + Math.PI / 2 + (i - 1) * 0.9; const rk = fit('namaqualand_boulder_02', 1.4 + R(), 0.8 + R() * 0.6); if (rk) place(rk, x + Math.sin(a) * 1.8, z + Math.cos(a) * 1.8, R() * 6); }
    markPos.caveFace = face;
  } else if (k === 'trees') {
    for (let i = 0; i < 3; i++) { const jungle = site.terrain === 'jungle' || site.terrain === 'green'; const t = fit(jungle ? 'shrub_01' : 'quiver_tree_01', 4, jungle ? 3.5 : 4.5 + R() * 2); if (t) { if (jungle) t.scale.multiplyScalar(2.2); place(t, x + (R() - 0.5) * 7, z + (R() - 0.5) * 7, R() * 6); } }
  } else if (k === 'tent') {
    const t = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.4, 4, 1, true), M.cloth); t.position.y = 1.2; t.rotation.y = Math.PI / 4; g.add(t);
    place(g, x, z);
  } else if (k === 'circle') {
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const st = box(0.8, 1.2 + R() * 1.2, 0.5, M.rock); st.position.set(Math.cos(a) * 4, st.geometry.parameters.height / 2 - 0.2, Math.sin(a) * 4); st.rotation.y = -a; g.add(st); }
    place(g, x, z);
  } else if (k === 'pyramid') {
    const hgt = em === '🔺' ? 7 : 3.2;
    const py = new THREE.Mesh(new THREE.ConeGeometry(6, hgt, 4), M.brick); py.rotation.y = Math.PI / 4; py.position.y = hgt / 2 - 0.6; g.add(py);
    place(g, x, z);
  } else if (k === 'wreck') {
    for (let i = 0; i < 9; i++) { const pl = box(0.3, 0.2, 4 + R() * 3, M.wood); pl.position.set((R() - 0.5) * 4, 0.15, (R() - 0.5) * 3); pl.rotation.set(R() * 0.3, R() * 0.6, R() * 0.3); g.add(pl); }
    for (let i = 0; i < 5; i++) { const v = fit(i % 2 ? 'jug_01' : 'antique_ceramic_vase_01', 0.5, 0.7); if (v) { v.traverse((o) => { if (o.isMesh) o.material = M.clay; }); v.position.set((R() - 0.5) * 5, 0, (R() - 0.5) * 4); v.rotation.z = 1.4; g.add(v); } }
    place(g, x, z);
  } else if (k === 'rocks' || k === 'island') {
    for (let i = 0; i < 4; i++) { const rk = fit('namaqualand_boulder_02', 2 + R() * 3, 1 + R() * 2); if (rk) place(rk, x + (R() - 0.5) * 7, z + (R() - 0.5) * 7, R() * 6); }
  } else if (k === 'field') {
    for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(8, 0.12, 0.35), new THREE.MeshStandardMaterial({ color: em === '🍇' ? '#5f7a3a' : '#a89a5a', roughness: 1 })); f.position.set(0, 0.03, -3 + i); g.add(f); }
    place(g, x, z);
  } else if (k === 'road') {
    const rd = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 12, 1, 12), new THREE.MeshStandardMaterial({ color: '#cbb592', roughness: 1, transparent: true, opacity: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }));
    rd.rotation.x = -Math.PI / 2; rd.position.y = 0.06; g.add(rd);
    place(g, x, z, 0.4);
  } else if (k === 'well') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.35, 10, 24), M.wall); ring.rotation.x = Math.PI / 2; ring.position.y = 0.3; g.add(ring);
    const wtr = new THREE.Mesh(new THREE.CircleGeometry(0.8, 20), new THREE.MeshStandardMaterial({ color: '#2a4a55', roughness: 0.1 })); wtr.rotation.x = -Math.PI / 2; wtr.position.y = 0.2; g.add(wtr);
    place(g, x, z);
  } else if (k === 'obelisk') {
    for (let i = 0; i < 3; i++) { const ob = box(0.9, 5 + R() * 6, 0.6, M.blocks); ob.position.set(-3 + i * 3, ob.geometry.parameters.height / 2 - 0.3, R() * 2); g.add(ob); }
    place(g, x, z);
  } else if (k === 'tombs') {
    for (let i = 0; i < 4; i++) { const sl = box(2, 0.5, 1, M.blocks); sl.position.set(-2.5 + (i % 2) * 3, 0.15, -1.5 + Math.floor(i / 2) * 2.5); g.add(sl); }
    place(g, x, z);
  } else if (k === 'water' && !dem) {
    const w = new THREE.Mesh(new THREE.CircleGeometry(14, 32), new THREE.MeshStandardMaterial({ color: '#3d6f86', roughness: 0.08, transparent: true, opacity: 0.85 }));
    w.rotation.x = -Math.PI / 2; w.position.set(x, -0.9, z); scene.add(w);
  }
  markPos[c + ',' + r] = { x, z };
  addLabel(label, x, z, k === 'cave' ? 3.4 : 3.2);
}
function addLabel(text, x, z, up) {
  const el = document.createElement('div'); el.className = 'site-label'; el.textContent = text;
  host.appendChild(el);
  labels.push({ el, p: new THREE.Vector3(x, hAt(x, z) + up, z) });
}

/* ---------- what lies on and under the ground ---------- */
function scatter(R) {
  const [tc, tr] = site.map.t, mp = markPos[tc + ',' + tr], T = mp ? new THREE.Vector2(mp.x, mp.z) : cellPos(tc, tr);
  let tx = T.x + (R() - 0.5) * (mp ? 3 : 5), tz = T.y + (R() - 0.5) * (mp ? 3 : 5);
  if (markPos.caveFace !== undefined && site.map.marks.some(([em, c, r]) => em === '🕳️' && c === tc && r === tr)) { tx = T.x + Math.sin(markPos.caveFace) * 2.6; tz = T.y + Math.cos(markPos.caveFace) * 2.6; }
  buried = [{ kind: 'main', x: tx, z: tz, depth: 1.05, metal: true, found: false, exposed: 0, cond: 100 }];
  for (let i = 0; i < 16; i++) {
    const a = R() * Math.PI * 2, d = 4 + R() * 40;
    buried.push({ kind: 'small', x: Math.cos(a) * d, z: Math.sin(a) * d - 4, depth: 0.3 + R() * 0.6, metal: R() < 0.4, found: false, exposed: 0, cond: 100 });
  }
  const M = MAT();
  const geos = [new THREE.TetrahedronGeometry(0.13), new THREE.DodecahedronGeometry(0.08)];
  for (let i = 0; i < 110; i++) {
    const nearT = i < 45;
    const x = nearT ? tx + (R() + R() + R() - 1.5) * 7 : (R() - 0.5) * 110, z = nearT ? tz + (R() + R() + R() - 1.5) * 7 : (R() - 0.5) * 110;
    if (Math.max(Math.abs(x), Math.abs(z)) > WALK) continue;
    const m = new THREE.Mesh(geos[i % 2], M.clay); m.scale.set(1.4, 0.35, 1); m.rotation.y = R() * 6;
    m.position.set(x, hAt(x, z) + 0.02, z); m.castShadow = true;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.27, 16), new THREE.MeshBasicMaterial({ color: '#fff3c8', transparent: true, opacity: 0, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, hAt(x, z) + 0.05, z);
    scene.add(m, ring);
    sherds.push({ m, ring, near: Math.hypot(x - tx, z - tz) < 10 });
  }
}

/* ---------- you, and the tools in your hands ---------- */
function makeView() {
  const M = MAT();
  view = new THREE.Group(); camera.add(view);
  const pick = new THREE.Group();
  const ph = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.95, 10), M.handle); ph.position.y = -0.1;
  const head = new THREE.Group(); head.position.y = 0.36;
  const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.032, 0.34, 8), M.iron); blade.rotation.x = Math.PI / 2; blade.position.z = 0.17;
  const adze = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.016, 0.22), M.iron); adze.position.z = -0.11;
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.08, 0.075), M.iron);
  head.add(blade, adze, eye); pick.add(ph, head);
  const brush = new THREE.Group();
  const bh = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.24, 10), M.handle);
  const fer = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.04, 12), new THREE.MeshStandardMaterial({ color: '#b8923a', metalness: 0.8, roughness: 0.3 })); fer.position.y = -0.14;
  const bristle = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.024), new THREE.MeshStandardMaterial({ color: '#d8c49a', roughness: 1 })); bristle.position.y = -0.19;
  brush.add(bh, fer, bristle);
  const det = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.2, 8), M.iron); pole.rotation.x = -0.9; pole.position.set(0, -0.25, -0.35);
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 8, 28), new THREE.MeshStandardMaterial({ color: '#1f2a33', roughness: 0.5 })); coil.rotation.x = Math.PI / 2 - 0.3; coil.position.set(0, -0.7, -0.8);
  const boxD = box(0.12, 0.06, 0.16, new THREE.MeshStandardMaterial({ color: '#2a2f33', roughness: 0.5 })); boxD.position.set(0, 0.05, 0.05);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.05), new THREE.MeshBasicMaterial({ color: '#3a5a2a' })); scr.position.set(0, 0.082, 0.06); scr.rotation.x = -Math.PI / 2;
  det.add(pole, coil, boxD, scr);
  view.userData = { pick, brush, det, scr };
  view.add(pick, brush, det);
  for (const o of [pick, brush, det]) o.traverse((m) => { if (m.isMesh) { m.castShadow = false; m.renderOrder = 10; } });
}
function poseView(dt, t) {
  const V = view.userData, walking = !!me.goal;
  V.det.visible = detectorOn && mode === 'walk';
  V.pick.visible = !V.det.visible && (mode === 'walk' || tool === 'pick');
  V.brush.visible = mode === 'dig' && tool === 'brush';
  const bob = walking ? Math.sin(t * 9) * 0.012 : Math.sin(t * 1.6) * 0.004;
  // rest poses, low in the right of the view
  V.pick.position.set(0.32, -0.42 + bob, -0.62); V.pick.rotation.set(-0.35, 0.25, -0.35);
  V.brush.position.set(0.26, -0.3 + bob, -0.5); V.brush.rotation.set(-0.9, 0, -0.2);
  V.det.position.set(0.18, -0.34 + bob, -0.45); V.det.rotation.set(0.12 + Math.sin(t * 2.2) * 0.03, Math.sin(t * 1.3) * 0.18, 0);
  // a swing: up, then down into the ground
  swingT += dt;
  if (swingT < 0.42) {
    const k = swingT / 0.42;
    if (tool === 'pick') { const up = k < 0.45 ? k / 0.45 : 1 - (k - 0.45) / 0.55; V.pick.rotation.x = -0.35 - up * 1.1 + (k > 0.45 ? (k - 0.45) * 2.6 : 0); V.pick.position.y += up * 0.18; V.pick.position.z += (k > 0.45 ? -0.15 : 0); }
    else { V.brush.position.x += Math.sin(k * Math.PI * 4) * 0.08; V.brush.position.z -= 0.08; }
  }
}

/* ---------- the trench ---------- */
const TH = 1.5, TSEG = 48, MAXD = 2.2;
function openTrench() {
  const fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw);
  const cx = me.pos.x + fx * 2.4, cz = me.pos.z + fz * 2.4;
  const slope = Math.max(Math.abs(hAt(cx + TH, cz) - hAt(cx - TH, cz)), Math.abs(hAt(cx, cz + TH) - hAt(cx, cz - TH))) / (TH * 2);
  if (slope > 0.55) return { steep: true };
  if (trench) closeTrench();
  const geo = new THREE.PlaneGeometry(TH * 2, TH * 2, TSEG, TSEG); geo.rotateX(-Math.PI / 2);
  const n = (TSEG + 1) * (TSEG + 1), base = new Float32Array(n), depth = new Float32Array(n), cols = new Float32Array(n * 3);
  const p = geo.attributes.position;
  for (let i = 0; i < n; i++) { const x = p.getX(i) + cx, z = p.getZ(i) + cz; base[i] = hAt(x, z); p.setY(i, base[i] + 0.012); }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, map: tex('excavated_soil_wall', 'diff', [1.5, 1.5]), normalMap: tex('excavated_soil_wall', 'nor', [1.5, 1.5]) }));
  mesh.position.set(cx, 0, cz); mesh.receiveShadow = true;
  scene.add(mesh);
  // pegs and a string around the square, a sieve and a bucket beside it
  const extra = new THREE.Group(), M = MAT();
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => new THREE.Vector3(cx + sx * TH, hAt(cx + sx * TH, cz + sz * TH) + 0.18, cz + sz * TH));
  for (const c of corners) { const pg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), M.wood); pg.position.copy(c).add(new THREE.Vector3(0, 0.05, 0)); extra.add(pg); }
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([...corners, corners[0]].map((v) => v.clone().add(new THREE.Vector3(0, 0.2, 0)))), new THREE.LineBasicMaterial({ color: '#f2e6c8' }));
  extra.add(line);
  const bk = fit('wooden_bucket_01', 0.45, 0.42); if (bk) { bk.position.set(cx + TH + 0.6, hAt(cx + TH + 0.6, cz - 0.6), cz - 0.6); extra.add(bk); }
  const sv = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.12, 24, 1, true), M.wood); sv.position.set(cx - TH - 0.7, hAt(cx - TH - 0.7, cz + 0.4) + 0.3, cz + 0.4); sv.rotation.z = 0.3; extra.add(sv);
  scene.add(extra);
  spoil = new THREE.Mesh(new THREE.ConeGeometry(1, 0.6, 20), new THREE.MeshStandardMaterial({ color: '#9a7a54', roughness: 1, map: tex('dry_ground_rocks', 'diff', [1, 1]) }));
  spoil.position.set(cx + TH + 1.4, hAt(cx + TH + 1.4, cz + 1) - 0.25, cz + 1); spoil.scale.set(0.3, 0.1, 0.3); spoil.receiveShadow = true; spoil.castShadow = true; scene.add(spoil);
  for (const o of decor) { const d = Math.max(Math.abs(o.position.x - cx), Math.abs(o.position.z - cz)); o.visible = d > TH + 1; }
  trench = { mesh, geo, base, depth, cx, cz, extra, finds: [], removed: 0 };
  holeU.value.set(cx, cz, TH - 0.03, 1);
  for (const b of buried) if (!b.found && Math.abs(b.x - cx) < TH - 0.3 && Math.abs(b.z - cz) < TH - 0.3) {
    const g = new THREE.Mesh(new THREE.DodecahedronGeometry(b.kind === 'main' ? 0.32 : 0.12, 1), new THREE.MeshStandardMaterial({ color: b.kind === 'main' ? '#6e5236' : '#7d6448', roughness: 1, map: tex('dry_ground_rocks', 'diff', [0.5, 0.5]) }));
    g.scale.y = 0.6; g.position.set(b.x, hAt(b.x, b.z) - b.depth, b.z); g.visible = false; g.castShadow = true;
    // a glint of what's inside the lump
    if (b.kind === 'main') { const gl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshStandardMaterial({ color: '#d9b25a', metalness: 1, roughness: 0.25, emissive: '#6a4a10', emissiveIntensity: 0.4 })); gl.position.set(0.18, 0.12, 0.12); g.add(gl); }
    scene.add(g); trench.finds.push({ b, g });
  }
  colourTrench();
  mode = 'dig';
  me.goal = null; me.pitch = -0.75;
  return { inside: trench.finds.length };
}
function closeTrench() {
  if (!trench) return;
  scene.remove(trench.mesh, trench.extra, spoil); trench.geo.dispose();
  for (const f of trench.finds) scene.remove(f.g);
  trench = null; spoil = null; holeU.value.w = 0;
}
// the walls show the layers: topsoil, later layers, an ashy line, and the layer of the period sought
function colourTrench() {
  const t = trench, c = t.geo.attributes.color, p = t.geo.attributes.position;
  const top = new THREE.Color('#8a6a48'), mid = new THREE.Color('#c9a77a'), ash = new THREE.Color('#5b5048'), old = new THREE.Color(site.terrain === 'sea' ? '#9aa6a0' : '#a0603c'), tmp = new THREE.Color();
  for (let i = 0; i < t.depth.length; i++) {
    const d = t.depth[i], w = (fbm(p.getX(i) * 3 + 5, p.getZ(i) * 3) - 0.5) * 0.18;
    if (d < 0.28 + w) tmp.copy(top); else if (d < 0.78 + w) tmp.copy(mid); else if (d < 0.88 + w) tmp.copy(ash); else tmp.copy(old);
    tmp.multiplyScalar(1.2 - d * 0.16);
    c.setXYZ(i, tmp.r, tmp.g, tmp.b);
  }
  c.needsUpdate = true;
}
function carve(px, pz, power, radius) {
  const t = trench, p = t.geo.attributes.position, step = (TH * 2) / TSEG;
  let removed = 0;
  for (let gz = 1; gz < TSEG; gz++) for (let gx = 1; gx < TSEG; gx++) {
    const i = gz * (TSEG + 1) + gx, x = p.getX(i) + t.cx, z = p.getZ(i) + t.cz;
    const d = Math.hypot(x - px, z - pz); if (d > radius) continue;
    const edge = Math.min(gx, gz, TSEG - gx, TSEG - gz) * step;
    let floor = Math.min(MAXD, edge * 7);
    for (const f of t.finds) { if (f.b.found) continue; const fd = Math.hypot(x - f.b.x, z - f.b.z); if (fd < (f.b.kind === 'main' ? 0.36 : 0.15)) floor = Math.min(floor, f.b.depth - (f.b.kind === 'main' ? 0.18 : 0.06)); }
    const nd = Math.min(floor, t.depth[i] + power * (1 - d / radius));
    if (nd > t.depth[i]) { removed += nd - t.depth[i]; t.depth[i] = nd; p.setY(i, t.base[i] - nd + 0.012); }
  }
  p.needsUpdate = true; t.geo.computeVertexNormals(); colourTrench();
  // the earth goes onto the spoil heap
  t.removed += removed * step * step * 6;
  const s = Math.min(1.3, 0.3 + Math.cbrt(t.removed) * 0.35);
  spoil.scale.set(s, s * 0.55, s);
  return removed;
}
function depthAt(x, z) {
  const t = trench, step = (TH * 2) / TSEG;
  const gx = Math.round((x - t.cx + TH) / step), gz = Math.round((z - t.cz + TH) / step);
  if (gx < 0 || gz < 0 || gx > TSEG || gz > TSEG) return 0;
  return t.depth[gz * (TSEG + 1) + gx];
}

/* ---------- input ---------- */
const ray = new THREE.Raycaster();
function rayAt(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
}
function walkTo(x, z, after, stop = 0.2) {
  if (Math.max(Math.abs(x), Math.abs(z)) > WALK) { H.onStatus && H.onStatus('זה מחוץ לשטח הסקר.'); return; }
  me.goal = new THREE.Vector3(x, 0, z); me.after = after || null; me.stop = stop;
}
function tap(e) {
  rayAt(e);
  if (mode === 'dig' && trench) {
    const h = ray.intersectObject(trench.mesh)[0];
    if (h) { strike(h.point); return; }
  }
  const sh = ray.intersectObjects(sherds.map((s) => s.m))[0];
  if (sh && sh.distance < 25) {
    const s = sherds.find((q) => q.m === sh.object);
    if (me.pos.distanceTo(s.m.position) < 2.6) pickSherd(s); else walkTo(s.m.position.x, s.m.position.z, () => pickSherd(s), 1.2);
    return;
  }
  if (mode === 'dig') return;
  const g = ray.intersectObject(ground)[0];
  if (g) walkTo(g.point.x, g.point.z);
}
function pickSherd(s) {
  if (!sherds.includes(s)) return;
  scene.remove(s.m, s.ring); sherds.splice(sherds.indexOf(s), 1);
  H.onSherd && H.onSherd(s.near);
}
let busy = 0;
function strike(pt) {
  if (busy > 0) return;
  if (energy <= 0) { H.onEnergy && H.onEnergy(0, true); return; }
  energy -= tool === 'pick' ? 1 : 0.34;
  H.onEnergy && H.onEnergy(energy);
  swingT = 0; busy = tool === 'pick' ? 0.42 : 0.26;
  setTimeout(() => {
    if (!trench) return;
    const removed = carve(pt.x, pt.z, (tool === 'pick' ? 0.2 : 0.05) * (tool === 'pick' ? H.pick || 1 : 1), tool === 'pick' ? 0.55 : 0.35);
    dust(pt, removed);
    if (tool === 'pick') shake = 0.05;
    H.onDig && H.onDig(tool, removed);
    for (const f of trench.finds) {
      if (f.b.found) continue;
      const d = depthAt(f.b.x, f.b.z), dist = Math.hypot(pt.x - f.b.x, pt.z - f.b.z);
      const show = d >= f.b.depth - (f.b.kind === 'main' ? 0.3 : 0.12);
      if (show && !f.g.visible) { f.g.visible = true; H.onReveal && H.onReveal(f.b.kind); }
      if (!show) continue;
      if (tool === 'pick' && dist < 0.5) { f.b.cond = Math.max(30, f.b.cond - 7); H.onDamage && H.onDamage(f.b.cond); }
      if (tool === 'brush' && dist < (f.b.kind === 'main' ? 0.7 : 0.4)) {
        f.b.exposed = Math.min(1, f.b.exposed + (f.b.kind === 'main' ? 0.12 : 0.34) * (H.brush || 1));
        H.onExpose && H.onExpose(f.b.kind, f.b.exposed);
        if (f.b.exposed >= 1) { f.b.found = true; scene.remove(f.g); H.onFind && H.onFind(f.b); }
      }
    }
  }, tool === 'pick' ? 210 : 140);
}

/* ---------- effects ---------- */
let dustPts = null, dustP = [], shake = 0;
function dust(pt, amt) {
  const n = 8 + Math.min(26, Math.round(amt * 70));
  for (let i = 0; i < n; i++) dustP.push({ x: pt.x, y: pt.y + 0.05, z: pt.z, vx: (Math.random() - 0.5) * 1.4, vy: 0.5 + Math.random() * 1.4, vz: (Math.random() - 0.5) * 1.4, life: 0.7 + Math.random() * 0.5 });
}
function stepDust(dt) {
  if (!dustPts) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(600 * 3), 3));
    dustPts = new THREE.Points(g, new THREE.PointsMaterial({ color: '#b39674', size: 0.018, transparent: true, opacity: 0.7, depthWrite: false })); dustPts.frustumCulled = false; scene.add(dustPts);
  }
  const a = dustPts.geometry.attributes.position.array; let k = 0;
  for (let i = dustP.length - 1; i >= 0; i--) { const q = dustP[i]; q.life -= dt; if (q.life <= 0) { dustP.splice(i, 1); continue; } q.vy -= 4 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; }
  for (const q of dustP.slice(0, 600)) { a[k++] = q.x; a[k++] = q.y; a[k++] = q.z; }
  for (; k < 1800; k++) a[k] = 0;
  dustPts.geometry.attributes.position.needsUpdate = true;
}

/* ---------- the loop ---------- */
let stepT = 0;
function tick() {
  raf = requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 1 / 20), t = clock.elapsedTime;
  busy -= dt;
  // keys on a computer: W/S/A/D or the arrows
  const kf = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), ks = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  if ((kf || ks) && mode === 'walk') { const fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw); me.goal = new THREE.Vector3(me.pos.x + (fx * kf + -fz * ks) * 2, 0, me.pos.z + (fz * kf + fx * ks) * 2); me.after = null; me.stop = 0.1; }
  if (me.goal) {
    const dx = me.goal.x - me.pos.x, dz = me.goal.z - me.pos.z, d = Math.hypot(dx, dz);
    if (d > (me.stop || 0.2)) {
      const sp = d > 8 ? 4.4 : 2.6, step = Math.min(d, sp * dt);
      me.pos.x += (dx / d) * step; me.pos.z += (dz / d) * step;
      // turn gently towards where you walk
      const want = Math.atan2(-dx, -dz); let da = want - me.yaw; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (!(kf || ks)) me.yaw += da * (1 - Math.pow(0.02, dt));
      stepT -= dt; if (stepT <= 0) { stepT = d > 8 ? 0.3 : 0.45; H.onStep && H.onStep(); }
    } else { me.goal = null; const f = me.after; me.after = null; if (f) f(); }
  }
  me.pos.y = hAt(me.pos.x, me.pos.z);
  const walking = !!me.goal, bob = walking ? Math.abs(Math.sin(t * 9)) * 0.045 : 0;
  shake *= Math.pow(0.001, dt);
  camera.position.set(me.pos.x + (Math.random() - 0.5) * shake, me.pos.y + EYE + bob, me.pos.z + (Math.random() - 0.5) * shake);
  camera.rotation.set(me.pitch, me.yaw, 0, 'YXZ');
  poseView(dt, t);
  sun.position.set(me.pos.x + 30, me.pos.y + 45, me.pos.z + 26); sun.target.position.copy(me.pos);
  // the metal detector
  if (detectorOn && mode === 'walk') {
    let best = 0;
    const cx = me.pos.x - Math.sin(me.yaw) * 1.1, cz = me.pos.z - Math.cos(me.yaw) * 1.1; // the coil is a step ahead
    const reach = H.detector || 1;
    for (const b of buried) if (b.metal && !b.found) best = Math.max(best, Math.exp(-Math.hypot(b.x - cx, b.z - cz) / ((b.kind === 'main' ? 5 : 2.2) * reach)) * (b.kind === 'main' ? 1 : 0.7));
    beepT -= dt;
    if (beepT <= 0) { beepT = 1.4 - best * 1.32; H.onBeep && H.onBeep(best); }
    H.onSignal && H.onSignal(best);
    view.userData.scr.material.color.setHSL(0.3 - best * 0.3, 0.8, 0.25 + best * 0.3);
  }
  for (const s of sherds) s.ring.material.opacity = Math.max(0, Math.sin(t * 2 + s.m.position.x)) * 0.4 * (me.pos.distanceTo(s.m.position) < 14 ? 1 : 0);
  stepDust(dt);
  const r = renderer.domElement.getBoundingClientRect();
  for (const L of labels) {
    const v = L.p.clone().project(camera), far = camera.position.distanceTo(L.p);
    const vis = v.z < 1 && far < 70 && far > 4 && mode === 'walk';
    L.el.style.opacity = vis ? Math.min(1, (70 - far) / 20) : 0;
    L.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * r.width}px, ${(-v.y * 0.5 + 0.5) * r.height}px) translate(-50%, -100%)`;
  }
  renderer.render(scene, camera);
}

function bind() {
  const c = renderer.domElement, pts = new Map();
  let down = null, moved = 0;
  c.addEventListener('pointerdown', (e) => { c.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); down = { t: performance.now() }; moved = 0; });
  c.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    // drag to look around
    if (moved > 8) { me.yaw += dx * 0.005; me.pitch = THREE.MathUtils.clamp(me.pitch + dy * 0.004, -1.35, 0.9); }
  });
  const up = (e) => { const wasTap = down && moved < 8 && performance.now() - down.t < 450; pts.delete(e.pointerId); if (wasTap) tap(e); down = null; };
  c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  addEventListener('keydown', onKey); addEventListener('keyup', onKey);
}
const onKey = (e) => { if (!renderer) return; keys[e.code] = e.type === 'keydown'; };
function resize() {
  if (!renderer || !host) return;
  const w = host.clientWidth || innerWidth, h = host.clientHeight || innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}

async function start(el, s, handlers = {}) {
  stop();
  host = el; site = s; H = handlers;
  const sea = s.terrain === 'sea';
  [dem] = await Promise.all([sea ? null : loadDem(s.id), loadModels()]);
  if (host !== el) return false;
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  el.appendChild(renderer.domElement);
  scene = new THREE.Scene(); clock = new THREE.Clock();
  camera = new THREE.PerspectiveCamera(62, 1, 0.05, 4000); scene.add(camera);
  if (sea) { scene.background = new THREE.Color('#1d5a73'); scene.fog = new THREE.FogExp2('#1d5a73', 0.04); }
  else {
    // only the sky of the desert photo: its own hills belong to another place, the real ones here are the terrain
    const haze = s.terrain === 'green' || s.terrain === 'jungle' ? '#aebfcc' : '#c9bfae';
    const img = new Image();
    img.onload = () => {
      if (!renderer) return;
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const cut = Math.round(img.height * 0.3), gr = g.createLinearGradient(0, cut - img.height * 0.04, 0, img.height * 0.5);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, haze);
      g.fillStyle = gr; g.fillRect(0, cut - img.height * 0.04, img.width, img.height); g.fillStyle = haze; g.fillRect(0, img.height * 0.5, img.width, img.height);
      const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
      scene.background = t; scene.backgroundRotation.y = -0.38; scene.environmentRotation.y = -0.38;
      scene.environment = new THREE.PMREMGenerator(renderer).fromEquirectangular(t).texture;
    };
    img.src = 'assets/sky/goegap_2k.jpg';
    scene.background = new THREE.Color(haze);
    scene.fog = new THREE.Fog(haze, 350, 2600);
  }
  scene.add(new THREE.HemisphereLight(sea ? '#9fd6e6' : '#dbe6f2', sea ? '#2a4a3a' : '#a5845a', sea ? 1.2 : 0.75));
  sun = new THREE.DirectionalLight(sea ? '#cfefff' : '#fff1dc', sea ? 1.6 : 3.1);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 140 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  bumps = [];
  if (!dem) for (const [em, c, r, label] of s.map.marks) { const p = cellPos(c, r), k = kindOf(em, label); if (k === 'cliff' || k === 'cave') bumps.push({ x: p.x, z: p.y - 3, h: 7, s: 6 }); else if (k === 'mound' || k === 'island') bumps.push({ x: p.x, z: p.y, h: 3, s: 6 }); else if (k === 'water') bumps.push({ x: p.x, z: p.y, h: -2.6, s: 11 }); }
  ground = makeTerrain();
  let seed = s.id.length * 977 + (s.lat * 100 | 0);
  const R = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (const [em, c, r, label] of s.map.marks) buildMark(em, c, r, label, R);
  for (let i = 0; i < 70; i++) { const x = (R() - 0.5) * 130, z = (R() - 0.5) * 130; const m = fit(R() < 0.75 ? 'shrub_01' : 'namaqualand_boulder_02', 1.4, 0.4 + R() * 0.8); if (m) place(m, x, z, R() * 6); }
  scatter(Math.random);
  // the camp at the south edge, where the expedition starts
  const camp = new THREE.Group(), M = MAT();
  const tent = new THREE.Mesh(new THREE.ConeGeometry(2, 2.2, 4, 1, true), M.cloth); tent.position.y = 1.0; tent.rotation.y = Math.PI / 4; camp.add(tent);
  for (const [n, x, z, w, h] of [['wooden_crate_01', 2.3, 0.4, 0.8, 0.7], ['wooden_bucket_01', 2.1, 1.4, 0.45, 0.42], ['wicker_basket_01', -2.2, 1, 0.7, 0.5], ['picke_dirty_01', 1.2, -1.4, 1.2, 0.3]]) { const m = fit(n, w, h); if (m) { m.position.set(x, 0, z); camp.add(m); } }
  place(camp, -4, 38);
  me = { pos: new THREE.Vector3(0, 0, 30), yaw: 0, pitch: -0.12, goal: null, after: null };
  makeView();
  bind(); resize();
  ro = new ResizeObserver(resize); ro.observe(el);
  energy = handlers.energy || 80;
  tick();
  return true;
}
function stop() {
  cancelAnimationFrame(raf); raf = 0;
  if (ro) { ro.disconnect(); ro = null; }
  removeEventListener('keydown', onKey); removeEventListener('keyup', onKey);
  for (const L of labels) L.el.remove();
  if (renderer) { renderer.domElement.remove(); renderer.dispose(); }
  renderer = null; scene = null; host = null; labels = []; decor = []; for (const k in markPos) delete markPos[k]; sherds = []; buried = []; trench = null; me = null; dustPts = null; dustP = []; mode = 'walk'; keys = {}; dem = null;
}

window.SITE3D = {
  start, stop,
  setTool: (t) => { tool = t; },
  detector: (on) => { detectorOn = on; return detectorOn; },
  digHere: () => openTrench(),
  leaveTrench: () => { mode = 'walk'; me.pitch = -0.12; closeTrench(); },
  where: () => me && { x: me.pos.x, z: me.pos.z, col: me.pos.x / CELL + 2.5, row: me.pos.z / CELL + 2.5 },
  energy: () => energy, addEnergy: (k) => { energy += k; },
  mode: () => mode,
  // for scripted checks
  _buried: () => buried, _walk: (x, z) => walkTo(x, z), _teleport: (x, z, yaw = 0) => { me.pos.set(x, hAt(x, z), z); me.goal = null; me.yaw = yaw; }, _look: (yaw, pitch) => { me.yaw = yaw; me.pitch = pitch; },
  _strike: (x, z) => { busy = 0; strike(new THREE.Vector3(x, hAt(x, z), z)); }, _trench: () => trench && { cx: trench.cx, cz: trench.cz },
  supported: !!window.WebGL2RenderingContext,
};
window.dispatchEvent(new Event('site3d-ready'));
