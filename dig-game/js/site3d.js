/* שכבות — walking a real site of the world expedition. The ground is shaped from the site's landmarks (cliffs,
   caves, mounds, walls, water), the archaeologist walks where you tap, a metal detector beeps faster near metal,
   potsherds lie on the surface more thickly near what is buried, and a trench is dug right there in the ground. */
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from '../vendor/three/addons/utils/SkeletonUtils.js';
import { RoundedBoxGeometry } from '../vendor/three/addons/geometries/RoundedBoxGeometry.js';

const SIZE = 110, SEG = 176, CELL = 10;
let renderer, scene, camera, clock, raf = 0, host = null, ro = null, H = {}, site = null;
let terrain = null, holeU = null, water = null, labels = [], sherds = [], buried = [], trench = null;
let player = null, mode = 'walk', tool = 'pick', detectorOn = false, beepT = 0, energy = 0;
let camYaw = 0, camPitch = 0.3, camDist = 13, lastFrame = 0, bumps = [];
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
const ready = Promise.all([
  load('models/explorer.glb').then((g) => { MODELS.hero = g; }),
  ...['quiver_tree_01', 'shrub_01', 'namaqualand_boulder_02', 'wooden_crate_01', 'wooden_bucket_01', 'wicker_basket_01', 'antique_ceramic_vase_01', 'jug_01']
    .map((n) => load(`assets/models/${n}.glb`).then((g) => { if (g) { g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); MODELS[n] = g.scene; } })),
]);
function fit(name, w, h) {
  const src = MODELS[name]; if (!src) return null;
  const m = src.clone(true), box = new THREE.Box3().setFromObject(m), s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const k = Math.min(h / s.y, w / Math.max(s.x, s.z));
  m.scale.setScalar(k); m.position.set(-c.x * k, -box.min.y * k, -c.z * k);
  const g = new THREE.Group(); g.add(m); return g;
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
// grid cell (column west→east, row north→south) to the middle of its 10 m square
const cellPos = (c, r) => new THREE.Vector2((c - 2) * CELL, (r - 2) * CELL);
function kindOf(em, label) {
  if (/צוק|הר |הרי|פסגת|פסגה|גבעה|גבעת|הגבעה|התל|תל |רכס|מצוק|⛰️/.test(label + em) && !/🕳️/.test(em)) return /צוק|מצוק|הר |הרי|רכס/.test(label) ? 'cliff' : 'mound';
  if (em === '🕳️') return 'cave';
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
function shapeGround() {
  bumps = [];
  for (const [em, c, r, label] of site.map.marks) {
    const p = cellPos(c, r), k = kindOf(em, label);
    if (k === 'cliff') bumps.push({ x: p.x, z: p.y, h: 10, s: 7.5, sharp: 1.6 });
    else if (k === 'mound') bumps.push({ x: p.x, z: p.y, h: 4.2, s: 6.5, sharp: 1 });
    else if (k === 'cave') bumps.push({ x: p.x, z: p.y - 3, h: 7, s: 5, sharp: 1.5 });
    else if (k === 'water') bumps.push({ x: p.x, z: p.y, h: -2.6, s: 11, sharp: 1, water: true });
    else if (k === 'river') bumps.push({ x: p.x, z: p.y, h: -1.2, s: 4, sharp: 1, line: true });
    else if (k === 'pyramid') bumps.push({ x: p.x, z: p.y, h: 2, s: 6, sharp: 1 });
    else if (k === 'island') bumps.push({ x: p.x, z: p.y, h: 2.5, s: 7, sharp: 1 });
  }
}
function hAt(x, z) {
  let h = (fbm(x * 0.05 + 3, z * 0.05 + 7) - 0.5) * 1.6 + (fbm(x * 0.4, z * 0.4) - 0.5) * 0.15;
  for (const b of bumps) {
    const dx = x - b.x, dz = b.line ? 0 : z - b.z, d2 = (dx * dx + dz * dz) / (b.s * b.s);
    h += b.h * Math.exp(-Math.pow(d2, b.sharp)) * (b.h > 4 ? 0.85 + fbm(x * 0.3, z * 0.3) * 0.3 : 1);
  }
  // hills close the horizon all around
  const r = Math.hypot(x, z);
  h += Math.max(0, (r - 38) / 14) ** 2 * 4 * (0.6 + fbm(x * 0.06, z * 0.06) * 0.8);
  return h;
}
const GROUND = { desert: ['sandy_gravel', '#e6d2b0'], hills: ['dry_ground_rocks', '#ffffff'], green: ['dry_ground_rocks', '#b9c79a'], sea: ['sandy_gravel', '#c9d8d0'], jungle: ['dry_ground_rocks', '#9fb486'] };
function makeTerrain() {
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, hAt(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  const [tx, tint] = GROUND[site.terrain] || GROUND.desert;
  const mat = pbr(tx, [SIZE / 4, SIZE / 4], { color: tint });
  holeU = { value: new THREE.Vector4(0, 0, 0, 0) };
  // the ground opens where a trench is dug
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uHole = holeU;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nuniform vec4 uHole;').replace('void main() {', 'void main() {\n if (uHole.w > 0.5 && abs(vWP.x - uHole.x) < uHole.z && abs(vWP.z - uHole.y) < uHole.z) discard;');
  };
  terrain = new THREE.Mesh(geo, mat); terrain.receiveShadow = true;
  scene.add(terrain);
  if (bumps.some((b) => b.water)) {
    water = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), new THREE.MeshStandardMaterial({ color: '#3d6f86', roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.86 }));
    water.rotation.x = -Math.PI / 2; water.position.y = -0.9; scene.add(water);
  }
}

/* ---------- landmarks from the site's map ---------- */
let MAT = null;
function mats() {
  if (MAT) return MAT;
  MAT = {
    wall: pbr('old_stone_wall', [1.2, 0.6]), blocks: pbr('large_sandstone_blocks', [1, 1]), marble: pbr('marble_01', [0.5, 1.5]),
    rock: pbr('aerial_rocks_02', [1, 1]), wood: pbr('weathered_planks', [1, 1]), clay: pbr('clay_plaster', [1, 1], { color: '#c07a50' }),
    brick: pbr('castle_brick_07', [1, 1]), cave: new THREE.MeshBasicMaterial({ color: '#0d0905' }), cloth: new THREE.MeshStandardMaterial({ color: '#c9b48a', roughness: 0.95, side: THREE.DoubleSide }),
    soil: pbr('excavated_soil_wall', [1, 1]),
  };
  return MAT;
}
function place(obj, x, z, ry = 0) { obj.position.set(x, hAt(x, z), z); obj.rotation.y = ry; obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(obj); return obj; }
function box(w, h, d, m) { return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.04), m); }
function buildMark(em, c, r, label, R) {
  const M = mats(), p = cellPos(c, r), k = kindOf(em, label), g = new THREE.Group();
  const x = p.x, z = p.y;
  if (k === 'ruins' || k === 'houses') {
    // the stubs of walls of a building, a few courses high, with a doorway
    const w = k === 'houses' ? 5 : 7, d = k === 'houses' ? 4 : 6, hh = k === 'houses' ? 1.6 : 1.1 + R() * 0.8;
    const walls = [[0, -d / 2, w, 0], [0, d / 2, w * 0.4, -w * 0.3], [0, d / 2, w * 0.4, w * 0.3], [-w / 2, 0, d, 'v'], [w / 2, 0, d, 'v']];
    for (const [wx, wz, len, off] of walls) {
      const b = box(off === 'v' ? 0.6 : len, hh * (0.6 + R() * 0.5), off === 'v' ? len : 0.6, M.wall);
      b.position.set(wx + (off === 'v' ? 0 : off), b.geometry.parameters.height / 2, wz); g.add(b);
    }
    if ('🏛️🛕⛩️'.includes(em)) for (let i = 0; i < 4; i++) { const col = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 2.2 + R() * 2.4, 16), M.marble); col.position.set(-w / 2 + 1 + i * (w - 2) / 3, col.geometry.parameters.height / 2, -d / 2 - 1); g.add(col); }
    if (em === '🚪' || em === '🦁') { for (const s of [-1, 1]) { const pi = box(1, 3.4, 1, M.blocks); pi.position.set(s * 1.4, 1.7, 0); g.add(pi); } const li = box(4, 0.7, 1.1, M.blocks); li.position.y = 3.6; g.add(li); }
    if (em === '🏰' || em === '🏯') { const tw = box(3, 4.5, 3, M.blocks); tw.position.set(w / 2, 2.25, -d / 2); g.add(tw); }
    if (em === '⛪' || em === '🏭' || em === '🏡') { const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.72, 2, 4), M.brick); roof.rotation.y = Math.PI / 4; roof.position.y = hh + 1; roof.scale.z = d / w; g.add(roof); }
    place(g, x, z, R() * 0.6 - 0.3);
  } else if (k === 'cave') {
    // a dark opening in a rocky face that looks south, towards the camp
    const mouth = new THREE.Mesh(new THREE.CircleGeometry(1.4, 24, 0, Math.PI), M.cave);
    const y = hAt(x, z + 1.5);
    mouth.position.set(x, y + 0.05, z + 1.3); mouth.scale.set(1, 1.3, 1); scene.add(mouth);
    for (let i = 0; i < 5; i++) { const rk = fit('namaqualand_boulder_02', 2 + R() * 2, 1 + R() * 1.4); if (rk) place(rk, x + (R() - 0.5) * 6, z + 2 + R() * 2.5, R() * 6); }
  } else if (k === 'trees') {
    for (let i = 0; i < 3; i++) { const t = fit(site.terrain === 'jungle' || site.terrain === 'green' ? 'shrub_01' : 'quiver_tree_01', 4, site.terrain === 'jungle' ? 3.5 : 4.5 + R() * 2); if (t) { t.scale.multiplyScalar(site.terrain === 'jungle' ? 2.2 : 1); place(t, x + (R() - 0.5) * 7, z + (R() - 0.5) * 7, R() * 6); } }
  } else if (k === 'tent') {
    const t = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.4, 4, 1, true), M.cloth); t.position.y = 1.2; t.rotation.y = Math.PI / 4; g.add(t);
    const cr = fit('wooden_crate_01', 0.8, 0.7); if (cr) { cr.position.set(2.2, 0, 1); g.add(cr); }
    place(g, x, z);
  } else if (k === 'circle') {
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const st = box(0.8, 1.2 + R() * 1.2, 0.5, M.rock); st.position.set(Math.cos(a) * 4, st.geometry.parameters.height / 2, Math.sin(a) * 4); st.rotation.y = -a; g.add(st); }
    place(g, x, z);
  } else if (k === 'pyramid') {
    const py = new THREE.Mesh(new THREE.ConeGeometry(6, em === '🔺' ? 7 : 3.2, 4), M.brick); py.rotation.y = Math.PI / 4; py.position.y = (em === '🔺' ? 7 : 3.2) / 2 - 0.4; g.add(py);
    place(g, x, z);
  } else if (k === 'wreck') {
    for (let i = 0; i < 9; i++) { const pl = box(0.3, 0.2, 4 + R() * 3, M.wood); pl.position.set((R() - 0.5) * 4, 0.15, (R() - 0.5) * 3); pl.rotation.set(R() * 0.3, R() * 0.6, R() * 0.3); g.add(pl); }
    for (let i = 0; i < 5; i++) { const v = fit(i % 2 ? 'jug_01' : 'antique_ceramic_vase_01', 0.5, 0.7); if (v) { v.traverse((o) => { if (o.isMesh) o.material = M.clay; }); v.position.set((R() - 0.5) * 5, 0, (R() - 0.5) * 4); v.rotation.z = 1.4; g.add(v); } }
    place(g, x, z);
  } else if (k === 'rocks' || k === 'island') {
    for (let i = 0; i < 4; i++) { const rk = fit('namaqualand_boulder_02', 2 + R() * 3, 1 + R() * 2); if (rk) place(rk, x + (R() - 0.5) * 7, z + (R() - 0.5) * 7, R() * 6); }
  } else if (k === 'field') {
    for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(8, 0.12, 0.35), new THREE.MeshStandardMaterial({ color: em === '🍇' ? '#5f7a3a' : '#a89a5a', roughness: 1 })); f.position.set(0, 0.06, -3 + i); g.add(f); }
    place(g, x, z);
  } else if (k === 'road') {
    const rd = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 12), new THREE.MeshStandardMaterial({ color: '#cbb592', roughness: 1, transparent: true, opacity: 0.7 })); rd.rotation.x = -Math.PI / 2; rd.position.y = 0.05; g.add(rd);
    place(g, x, z, 0.4);
  } else if (k === 'well') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.35, 10, 24), M.wall); ring.rotation.x = Math.PI / 2; ring.position.y = 0.35; g.add(ring);
    const wtr = new THREE.Mesh(new THREE.CircleGeometry(0.8, 20), new THREE.MeshStandardMaterial({ color: '#2a4a55', roughness: 0.1 })); wtr.rotation.x = -Math.PI / 2; wtr.position.y = 0.2; g.add(wtr);
    place(g, x, z);
  } else if (k === 'obelisk') {
    for (let i = 0; i < 3; i++) { const ob = box(0.9, 5 + R() * 6, 0.6, M.blocks); ob.position.set(-3 + i * 3, ob.geometry.parameters.height / 2, R() * 2); g.add(ob); }
    place(g, x, z);
  } else if (k === 'tombs') {
    for (let i = 0; i < 4; i++) { const sl = box(2, 0.5, 1, M.blocks); sl.position.set(-2.5 + (i % 2) * 3, 0.25, -1.5 + Math.floor(i / 2) * 2.5); g.add(sl); }
    place(g, x, z);
  }
  // the name of the place floats above it
  const el = document.createElement('div'); el.className = 'site-label'; el.textContent = label;
  host.appendChild(el);
  const top = Math.max(hAt(x, z), k === 'cliff' ? 6 : 0) + (k === 'cliff' ? 3 : 3.2);
  labels.push({ el, p: new THREE.Vector3(x, top, z) });
}

/* ---------- what lies on and under the ground ---------- */
function scatter(R) {
  const [tc, tr] = site.map.t, T = cellPos(tc, tr);
  // the find lies about a metre down, somewhere in its square
  const tx = T.x + (R() - 0.5) * 5, tz = T.y + (R() - 0.5) * 5;
  buried = [{ kind: 'main', x: tx, z: tz, depth: 1.05, metal: true, found: false, exposed: 0, cond: 100 }];
  for (let i = 0; i < 14; i++) {
    const a = R() * Math.PI * 2, d = 4 + R() * 30;
    buried.push({ kind: 'small', x: Math.cos(a) * d, z: Math.sin(a) * d - 4, depth: 0.35 + R() * 0.6, metal: R() < 0.35, found: false, exposed: 0, cond: 100 });
  }
  // potsherds on the surface: thick around the old settlement, scattered elsewhere
  const geo = new THREE.TetrahedronGeometry(0.13), M = mats();
  for (let i = 0; i < 90; i++) {
    const near = i < 40;
    const x = near ? tx + (R() + R() + R() - 1.5) * 7 : (R() - 0.5) * 70, z = near ? tz + (R() + R() + R() - 1.5) * 7 : (R() - 0.5) * 70;
    if (hAt(x, z) < -0.6 || Math.hypot(x, z) > 45) continue;
    const m = new THREE.Mesh(geo, M.clay); m.scale.set(1.4, 0.35, 1); m.rotation.y = R() * 6;
    m.position.set(x, hAt(x, z) + 0.03, z); m.castShadow = true;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 16), new THREE.MeshBasicMaterial({ color: '#fff3c8', transparent: true, opacity: 0.0, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, hAt(x, z) + 0.05, z);
    scene.add(m, ring);
    sherds.push({ m, ring, near: Math.hypot(x - tx, z - tz) < 10 });
  }
}

/* ---------- the archaeologist ---------- */
const CLIPS = { idle: 'Idle', walk: 'Walking_A', run: 'Running_A', chop: '2H_Melee_Attack_Chop', pickup: 'PickUp', cheer: 'Cheer', use: 'Use_Item' };
function makePlayer(x, z) {
  player = { pos: new THREE.Vector3(x, hAt(x, z), z), goal: null, face: Math.PI, root: new THREE.Group(), mixer: null, actions: {}, cur: null, busy: 0, after: null };
  player.root.position.copy(player.pos);
  scene.add(player.root);
  const g = MODELS.hero;
  if (g) {
    const m = SkeletonUtils.clone(g.scene);
    ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable', 'Rogue_Cape'].forEach((n) => { const o = m.getObjectByName(n); if (o) o.visible = false; });
    m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    const b = new THREE.Box3().setFromObject(m), k = 1.75 / (b.max.y - b.min.y);
    m.scale.setScalar(k); player.root.add(m);
    // a fedora and a pick
    const head = m.getObjectByName('head');
    if (head) {
      const hatM = new THREE.MeshStandardMaterial({ color: '#b9a27a', roughness: 0.9 }), bandM = new THREE.MeshStandardMaterial({ color: '#4a3622' });
      const hat = new THREE.Group();
      hat.add(new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.86, 0.05, 32), hatM));
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.42, 28), hatM); crown.position.y = 0.22; hat.add(crown);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.605, 0.605, 0.1, 28), bandM); band.position.y = 0.07; hat.add(band);
      hat.position.set(0, 0.86, 0.02); head.add(hat);
    }
    const slot = m.getObjectByName('handslotr');
    if (slot) {
      const tool = new THREE.Group();
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.9, 8), new THREE.MeshStandardMaterial({ color: '#7a5030', roughness: 0.7 })); handle.position.y = 0.3;
      const headM = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.5), new THREE.MeshStandardMaterial({ color: '#8a8f96', metalness: 0.8, roughness: 0.35 })); headM.position.y = 0.72;
      tool.add(handle, headM); tool.scale.setScalar(1 / k); slot.add(tool);
    }
    player.mixer = new THREE.AnimationMixer(m);
    for (const [key, name] of Object.entries(CLIPS)) { const c = THREE.AnimationClip.findByName(g.animations, name); if (c) player.actions[key] = player.mixer.clipAction(c); }
    for (const key of ['chop', 'pickup', 'cheer', 'use']) if (player.actions[key]) { player.actions[key].setLoop(THREE.LoopOnce); player.actions[key].clampWhenFinished = true; }
    play('idle', 0);
  } else {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.1, 6, 12), new THREE.MeshStandardMaterial({ color: '#b49c74' })); body.position.y = 0.85; player.root.add(body);
  }
}
function play(key, fade = 0.2, restart = false) {
  const a = player.actions[key]; if (!a) return;
  if (player.cur === key && !restart) return;
  const prev = player.cur && player.actions[player.cur];
  a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.play();
  if (prev && prev !== a) prev.crossFadeTo(a, fade, false);
  player.cur = key;
}
function walkTo(x, z, after) {
  if (hAt(x, z) < -0.6) { H.onStatus && H.onStatus('אי אפשר ללכת לתוך המים.'); return; }
  player.goal = new THREE.Vector3(x, 0, z); player.after = after || null;
}

/* ---------- the trench ---------- */
const TH = 1.6, TSEG = 40, MAXD = 2.2;
function openTrench() {
  if (trench) closeTrench();
  const cx = player.pos.x + Math.sin(player.face) * 2.2, cz = player.pos.z + Math.cos(player.face) * 2.2;
  const geo = new THREE.PlaneGeometry(TH * 2, TH * 2, TSEG, TSEG); geo.rotateX(-Math.PI / 2);
  const n = (TSEG + 1) * (TSEG + 1), base = new Float32Array(n), depth = new Float32Array(n), cols = new Float32Array(n * 3);
  const p = geo.attributes.position;
  for (let i = 0; i < n; i++) { const x = p.getX(i) + cx, z = p.getZ(i) + cz; base[i] = hAt(x, z); p.setY(i, base[i] + 0.01); }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, map: tex('excavated_soil_wall', 'diff', [2, 2]), normalMap: tex('excavated_soil_wall', 'nor', [2, 2]) }));
  mesh.position.set(cx, 0, cz); mesh.receiveShadow = true; mesh.castShadow = false;
  scene.add(mesh);
  // pegs and string around the square
  const pegs = new THREE.Group(), M = mats();
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const pg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 6), M.wood); pg.position.set(cx + sx * TH, hAt(cx + sx * TH, cz + sz * TH) + 0.25, cz + sz * TH); pegs.add(pg); }
  scene.add(pegs);
  trench = { mesh, geo, base, depth, cx, cz, pegs, finds: [] };
  holeU.value.set(cx, cz, TH - 0.02, 1);
  // what lies inside the square comes up as lumps of earth
  for (const b of buried) if (!b.found && Math.abs(b.x - cx) < TH - 0.3 && Math.abs(b.z - cz) < TH - 0.3) {
    const g = new THREE.Mesh(new THREE.DodecahedronGeometry(b.kind === 'main' ? 0.32 : 0.12, 1), new THREE.MeshStandardMaterial({ color: b.kind === 'main' ? '#6e5236' : '#7d6448', roughness: 1 }));
    g.scale.y = 0.6; g.position.set(b.x, hAt(b.x, b.z) - b.depth, b.z); g.visible = false; g.castShadow = true;
    scene.add(g); trench.finds.push({ b, g });
  }
  colourTrench();
  mode = 'dig'; camDist = 6.5; camPitch = 0.9; camYaw = Math.atan2(cx - player.pos.x, cz - player.pos.z); // across the trench, facing the digger
  player.goal = null;
  return { inside: trench.finds.length };
}
function closeTrench() {
  if (!trench) return;
  scene.remove(trench.mesh, trench.pegs); trench.geo.dispose();
  for (const f of trench.finds) scene.remove(f.g);
  trench = null; holeU.value.w = 0;
}
// the walls show the layers: topsoil, later layers, and the layer of the period sought
function colourTrench() {
  const t = trench, c = t.geo.attributes.color, p = t.geo.attributes.position;
  const top = new THREE.Color('#8a6a48'), mid = new THREE.Color('#c9a77a'), old = new THREE.Color(site.terrain === 'sea' ? '#9aa6a0' : '#8e5a3c'), tmp = new THREE.Color();
  for (let i = 0; i < t.depth.length; i++) {
    const d = t.depth[i], w = fbm(p.getX(i) * 3 + 5, p.getZ(i) * 3) * 0.2;
    if (d < 0.3 + w) tmp.copy(top); else if (d < 0.85 + w) tmp.copy(mid); else tmp.copy(old);
    tmp.multiplyScalar(1.15 - d * 0.18);
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
    // the walls of a trench stay straight: the edge rows never sink
    const edge = Math.min(gx, gz, TSEG - gx, TSEG - gz) * step;
    const lim = Math.min(MAXD, edge * 6);
    // a find stops the tool: dig down to it, not through it
    let floor = lim;
    for (const f of t.finds) { const fd = Math.hypot(x - f.b.x, z - f.b.z); if (fd < (f.b.kind === 'main' ? 0.36 : 0.15)) floor = Math.min(floor, f.b.depth - (f.b.kind === 'main' ? 0.18 : 0.06)); }
    const add = power * (1 - d / radius);
    const nd = Math.min(floor, t.depth[i] + add);
    if (nd > t.depth[i]) { removed += nd - t.depth[i]; t.depth[i] = nd; p.setY(i, t.base[i] - nd + 0.01); }
  }
  p.needsUpdate = true; t.geo.computeVertexNormals(); colourTrench();
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
function tap(e) {
  rayAt(e);
  if (mode === 'dig' && trench) {
    const h = ray.intersectObject(trench.mesh)[0];
    if (h) { strike(h.point); return; }
  }
  const sh = ray.intersectObjects(sherds.map((s) => s.m))[0];
  if (sh) {
    const s = sherds.find((q) => q.m === sh.object);
    const go = () => pickSherd(s);
    if (player.pos.distanceTo(s.m.position) < 2.2) go(); else walkTo(s.m.position.x, s.m.position.z, go);
    return;
  }
  if (mode === 'dig') return;
  const g = ray.intersectObject(terrain)[0];
  if (g) walkTo(g.point.x, g.point.z);
}
function pickSherd(s) {
  if (!sherds.includes(s)) return;
  play('pickup', 0.1, true); player.busy = 0.9;
  scene.remove(s.m, s.ring); sherds.splice(sherds.indexOf(s), 1);
  H.onSherd && H.onSherd(s.near);
}
function strike(pt) {
  if (player.busy > 0) return;
  if (energy <= 0) { H.onEnergy && H.onEnergy(0, true); return; }
  energy -= tool === 'pick' ? 1 : 0.34;
  H.onEnergy && H.onEnergy(energy);
  // face the spot and swing
  player.face = Math.atan2(pt.x - player.pos.x, pt.z - player.pos.z);
  play(tool === 'pick' ? 'chop' : 'pickup', 0.08, true);
  player.busy = tool === 'pick' ? 0.55 : 0.4;
  setTimeout(() => {
    if (!trench) return;
    const removed = carve(pt.x, pt.z, tool === 'pick' ? 0.2 : 0.05, tool === 'pick' ? 0.55 : 0.35);
    dust(pt, removed);
    H.onDig && H.onDig(tool, removed);
    for (const f of trench.finds) {
      if (f.b.found) continue;
      const d = depthAt(f.b.x, f.b.z), dist = Math.hypot(pt.x - f.b.x, pt.z - f.b.z);
      const show = d >= f.b.depth - (f.b.kind === 'main' ? 0.3 : 0.12);
      if (show && !f.g.visible) { f.g.visible = true; H.onReveal && H.onReveal(f.b.kind); }
      if (!show) continue;
      if (tool === 'pick' && dist < 0.5) { f.b.cond = Math.max(30, f.b.cond - 7); H.onDamage && H.onDamage(f.b.cond); }
      if (tool === 'brush' && dist < (f.b.kind === 'main' ? 0.7 : 0.4)) {
        f.b.exposed = Math.min(1, f.b.exposed + (f.b.kind === 'main' ? 0.12 : 0.34));
        H.onExpose && H.onExpose(f.b.kind, f.b.exposed);
        if (f.b.exposed >= 1) { f.b.found = true; scene.remove(f.g); play('cheer', 0.15, true); player.busy = 1.4; H.onFind && H.onFind(f.b); }
      }
    }
  }, tool === 'pick' ? 330 : 220);
}

/* ---------- effects ---------- */
let dustPts = null, dustP = [];
function dust(pt, amt) {
  const n = 6 + Math.min(20, Math.round(amt * 60));
  for (let i = 0; i < n; i++) dustP.push({ x: pt.x, y: pt.y + 0.1, z: pt.z, vx: (Math.random() - 0.5) * 1.6, vy: 0.6 + Math.random() * 1.6, vz: (Math.random() - 0.5) * 1.6, life: 0.8 + Math.random() * 0.5 });
}
function stepDust(dt) {
  if (!dustPts) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(600 * 3), 3));
    dustPts = new THREE.Points(g, new THREE.PointsMaterial({ color: '#c9ad85', size: 0.035, transparent: true, opacity: 0.75, depthWrite: false })); dustPts.frustumCulled = false; scene.add(dustPts);
  }
  const a = dustPts.geometry.attributes.position.array; let k = 0;
  for (let i = dustP.length - 1; i >= 0; i--) { const q = dustP[i]; q.life -= dt; if (q.life <= 0) { dustP.splice(i, 1); continue; } q.vy -= 4 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; }
  for (const q of dustP.slice(0, 600)) { a[k++] = q.x; a[k++] = q.y; a[k++] = q.z; }
  for (; k < 1800; k++) a[k] = 0;
  dustPts.geometry.attributes.position.needsUpdate = true;
}

/* ---------- the loop ---------- */
const tmpV = new THREE.Vector3();
function tick() {
  raf = requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 1 / 20), t = clock.elapsedTime;
  // walking
  if (player.goal && player.busy <= 0) {
    const dx = player.goal.x - player.pos.x, dz = player.goal.z - player.pos.z, d = Math.hypot(dx, dz);
    if (d > 0.15) {
      const sp = d > 6 ? 4.2 : 2.4, step = Math.min(d, sp * dt);
      const nx = player.pos.x + (dx / d) * step, nz = player.pos.z + (dz / d) * step;
      if (hAt(nx, nz) < -0.6 || Math.hypot(nx, nz) > 44) { player.goal = null; play('idle'); }
      else { player.pos.x = nx; player.pos.z = nz; player.face = Math.atan2(dx, dz); play(d > 6 ? 'run' : 'walk', 0.15); }
    } else { player.goal = null; play('idle'); const f = player.after; player.after = null; if (f) f(); }
  } else if (player.busy > 0) { player.busy -= dt; if (player.busy <= 0) play(mode === 'dig' ? 'idle' : 'idle', 0.25); }
  player.pos.y = hAt(player.pos.x, player.pos.z);
  player.root.position.copy(player.pos);
  let da = player.face - player.root.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da));
  player.root.rotation.y += da * (1 - Math.pow(0.0005, dt));
  if (player.mixer) player.mixer.update(dt);
  // the camera follows from behind and above
  const focus = mode === 'dig' && trench ? tmpV.set(trench.cx, hAt(trench.cx, trench.cz) - 0.5, trench.cz) : tmpV.copy(player.pos).add(new THREE.Vector3(0, 1.8, 0));
  const cx = focus.x + Math.sin(camYaw) * Math.cos(camPitch) * camDist, cz = focus.z + Math.cos(camYaw) * Math.cos(camPitch) * camDist;
  const cy = Math.max(focus.y + Math.sin(camPitch) * camDist, hAt(cx, cz) + 0.6);
  camera.position.lerp(new THREE.Vector3(cx, cy, cz), 1 - Math.pow(0.002, dt));
  camera.lookAt(focus);
  // the metal detector
  if (detectorOn && mode === 'walk') {
    let best = 0;
    for (const b of buried) if (b.metal && !b.found) best = Math.max(best, Math.exp(-Math.hypot(b.x - player.pos.x, b.z - player.pos.z) / (b.kind === 'main' ? 6 : 2.5)) * (b.kind === 'main' ? 1 : 0.7));
    beepT -= dt;
    const every = 1.4 - best * 1.32;
    if (beepT <= 0) { beepT = every; H.onBeep && H.onBeep(best); }
    H.onSignal && H.onSignal(best);
  }
  // sherds glint a little so they can be spotted
  for (const s of sherds) s.ring.material.opacity = Math.max(0, Math.sin(t * 2 + s.m.position.x) * 0.35) * (player.pos.distanceTo(s.m.position) < 16 ? 1 : 0);
  stepDust(dt);
  // labels over the landmarks
  const r = renderer.domElement.getBoundingClientRect();
  for (const L of labels) {
    const v = L.p.clone().project(camera), far = camera.position.distanceTo(L.p);
    const vis = v.z < 1 && far < 60 && mode === 'walk';
    L.el.style.opacity = vis ? Math.min(1, (60 - far) / 20) : 0;
    L.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * r.width}px, ${(-v.y * 0.5 + 0.5) * r.height}px) translate(-50%, -100%)`;
  }
  renderer.render(scene, camera);
}

function bind() {
  const c = renderer.domElement, pts = new Map();
  let down = null, moved = 0, pinch0 = 0, d0 = camDist;
  c.addEventListener('pointerdown', (e) => {
    c.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    down = { t: performance.now() }; moved = 0;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); d0 = camDist; }
  });
  c.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId); if (!p) return;
    if (pts.size === 2) { p.x = e.clientX; p.y = e.clientY; const [a, b] = [...pts.values()]; camDist = THREE.MathUtils.clamp(d0 * pinch0 / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), 3, 22); return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    if (moved > 8) { camYaw -= dx * 0.006; camPitch = THREE.MathUtils.clamp(camPitch + dy * 0.004, 0.15, 1.35); }
  });
  const up = (e) => { const wasTap = down && moved < 8 && pts.size === 1 && performance.now() - down.t < 450; pts.delete(e.pointerId); if (wasTap) tap(e); down = null; };
  c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  c.addEventListener('wheel', (e) => { e.preventDefault(); camDist = THREE.MathUtils.clamp(camDist * (1 + Math.sign(e.deltaY) * 0.1), 3, 22); }, { passive: false });
}
function resize() {
  if (!renderer || !host) return;
  const w = host.clientWidth || innerWidth, h = host.clientHeight || innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}

async function start(el, s, handlers = {}) {
  stop();
  host = el; site = s; H = handlers;
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  el.appendChild(renderer.domElement);
  scene = new THREE.Scene(); clock = new THREE.Clock();
  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
  const sea = s.terrain === 'sea';
  // the sky: the real desert sky photo; under water, a blue haze
  if (sea) { scene.background = new THREE.Color('#1d5a73'); scene.fog = new THREE.FogExp2('#1d5a73', 0.035); }
  else {
    const sky = texLoader.load('assets/sky/goegap_2k.jpg', (t) => { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(t).texture; });
    sky.mapping = THREE.EquirectangularReflectionMapping; sky.colorSpace = THREE.SRGBColorSpace;
    scene.background = sky; scene.backgroundRotation.y = -0.38; scene.environmentRotation.y = -0.38;
    scene.fog = new THREE.Fog(s.terrain === 'green' || s.terrain === 'jungle' ? '#c9d6d8' : '#d8c8a8', 45, 140);
  }
  scene.add(new THREE.HemisphereLight(sea ? '#9fd6e6' : '#dbe6f2', sea ? '#2a4a3a' : '#a5845a', sea ? 1.2 : 0.7));
  const sun = new THREE.DirectionalLight(sea ? '#cfefff' : '#fff1dc', sea ? 1.6 : 3);
  sun.position.set(20, 32, 24); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  shapeGround();
  makeTerrain();
  await ready;
  if (!renderer) return false;
  let seed = s.id.length * 977 + (s.lat * 100 | 0);
  const R = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (const [em, c, r, label] of s.map.marks) buildMark(em, c, r, label, R);
  // shrubs and stones all around
  for (let i = 0; i < 40; i++) { const x = (R() - 0.5) * 80, z = (R() - 0.5) * 80; if (hAt(x, z) < -0.5 || Math.hypot(x, z) > 42) continue; const m = fit(R() < 0.7 ? 'shrub_01' : 'namaqualand_boulder_02', 1.4, 0.5 + R() * 0.8); if (m) place(m, x, z, R() * 6); }
  scatter(Math.random);
  // the camp at the south edge, where the expedition starts
  const camp = new THREE.Group(), M = mats();
  const tent = new THREE.Mesh(new THREE.ConeGeometry(2, 2.2, 4, 1, true), M.cloth); tent.position.y = 1.1; tent.rotation.y = Math.PI / 4; camp.add(tent);
  for (const [n, x, z, w, h] of [['wooden_crate_01', 2.3, 0.4, 0.8, 0.7], ['wooden_bucket_01', 2.1, 1.4, 0.45, 0.42], ['wicker_basket_01', -2.2, 1, 0.7, 0.5]]) { const m = fit(n, w, h); if (m) { m.position.set(x, 0, z); camp.add(m); } }
  place(camp, -4, 30);
  makePlayer(0, 28);
  camYaw = 0; camPitch = 0.3; camDist = 13;
  bind(); resize();
  ro = new ResizeObserver(resize); ro.observe(el);
  energy = handlers.energy || 80;
  tick();
  return true;
}
function stop() {
  cancelAnimationFrame(raf); raf = 0;
  if (ro) { ro.disconnect(); ro = null; }
  for (const L of labels) L.el.remove();
  if (renderer) { renderer.domElement.remove(); renderer.dispose(); }
  renderer = null; scene = null; host = null; labels = []; sherds = []; buried = []; trench = null; player = null; dustPts = null; dustP = []; water = null; mode = 'walk';
}

window.SITE3D = {
  start, stop,
  setTool: (t) => { tool = t; },
  detector: (on) => { detectorOn = on; return detectorOn; },
  digHere: () => openTrench(),
  leaveTrench: () => { mode = 'walk'; camDist = 12; camPitch = 0.36; closeTrench(); },
  where: () => player && { x: player.pos.x, z: player.pos.z, col: player.pos.x / CELL + 2.5, row: player.pos.z / CELL + 2.5 },
  energy: () => energy, addEnergy: (k) => { energy += k; },
  mode: () => mode,
  // for scripted checks
  _buried: () => buried, _walk: (x, z) => walkTo(x, z), _teleport: (x, z) => { player.pos.set(x, hAt(x, z), z); player.goal = null; }, _strike: (x, z) => { player.busy = 0; strike(new THREE.Vector3(x, hAt(x, z), z)); }, _trench: () => trench && { cx: trench.cx, cz: trench.cz },
  supported: !!window.WebGL2RenderingContext,
};
window.dispatchEvent(new Event('site3d-ready'));
