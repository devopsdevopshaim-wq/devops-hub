/* שכבות — "ניפוץ": a bright 3D cannon game. Ancient towers of jars, glazed tiles and columns stand on a
   pedestal; a bronze cannon fires at them with real physics (cannon-es). Every piece knocked off the
   pedestal is cleared, jars burst with what they held, and a treasure chest waits on top. */
import * as THREE from 'three';
import * as CANNON from '../vendor/cannon/cannon-es.min.js';
import { RoundedBoxGeometry } from '../vendor/three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from '../vendor/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/three/addons/postprocessing/OutputPass.js';

const PT = 2.0;          // height of the pedestal top
const PR = 2.75;         // pedestal radius
const CANNON_Z = 6.6;    // the cannon stands well in front of the pedestal
const G = 9.82;
const GROUP = { piece: 1, ground: 2, stage: 4, ball: 8 };
const BALL_R = 0.34;

let renderer, composer, scene, camera, clock, world, raf = 0, host = null, H = {}, mode = 'off';
let pieces = [], balls = [], shards = [], removeQ = [], clouds = [], cannon = null, pedestal = null;
let simT = 0, ballsLeft = 0, armed = null, lastShot = -9, settleT = 0, done = false, combo = 0, comboT = 0, autoT = 0, showT = 0, levelNum = 1;
let FX = null, FXA = null, flashLight = null, shake = 0, ro = null;
const camBase = new THREE.Vector3(), camLook = new THREE.Vector3();

/* ---------- random ---------- */
function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------- painted textures ---------- */
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const TEX = {};
function textures() {
  if (TEX.ready) return TEX;
  // glazed tiles: the blue and gold of the Ishtar gate, turquoise, terracotta and sandstone
  const tile = (base, edge, motif) => canvasTex(256, 256, (g, w) => {
    const gr = g.createLinearGradient(0, 0, w, w); gr.addColorStop(0, base[0]); gr.addColorStop(1, base[1]);
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
    g.strokeStyle = edge; g.lineWidth = 18; g.strokeRect(9, 9, w - 18, w - 18);
    g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,.35)'; g.strokeRect(26, 26, w - 52, w - 52);
    motif(g, w);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`; g.fillRect(Math.random() * w, Math.random() * w, 3, 3); }
  });
  const rosette = (col) => (g, w) => {
    g.save(); g.translate(w / 2, w / 2); g.fillStyle = col;
    for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); g.beginPath(); g.ellipse(0, 34, 16, 34, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#fff6d0'; g.beginPath(); g.arc(0, 0, 16, 0, Math.PI * 2); g.fill(); g.restore();
  };
  const zig = (col) => (g, w) => {
    g.strokeStyle = col; g.lineWidth = 12; g.lineJoin = 'round';
    for (const yy of [0.38, 0.62]) { g.beginPath(); for (let i = 0; i <= 6; i++) g.lineTo(40 + i * ((w - 80) / 6), w * yy + (i % 2 ? -18 : 18)); g.stroke(); }
  };
  const meander = (col) => (g, w) => {
    g.strokeStyle = col; g.lineWidth = 10;
    for (let i = 0; i < 4; i++) { const x = 44 + i * 44; g.beginPath(); g.moveTo(x, 150); g.lineTo(x, 100); g.lineTo(x + 30, 100); g.lineTo(x + 30, 130); g.lineTo(x + 14, 130); g.stroke(); }
  };
  TEX.blue = tile(['#2f6fe0', '#1d48b8'], '#ffcf3a', rosette('#ffd84a'));
  TEX.turq = tile(['#22c7c0', '#109a9c'], '#fff2b0', zig('#ffffff'));
  TEX.terra = tile(['#ff7a3d', '#e2522a'], '#ffe08a', meander('#7a2a12'));
  TEX.purple = tile(['#9a4dff', '#6d2bd6'], '#ffcf3a', rosette('#ff9de0'));
  TEX.sand = tile(['#f2cf8a', '#d9a95c'], '#b77a35', (g, w) => { g.strokeStyle = 'rgba(120,70,20,.35)'; g.lineWidth = 3; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(30 + Math.random() * 200, 30 + Math.random() * 200); g.lineTo(30 + Math.random() * 200, 30 + Math.random() * 200); g.stroke(); } });
  // painted bands for the jars
  const jar = (a, b, band) => canvasTex(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, a); gr.addColorStop(1, b);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = band; g.fillRect(0, h * 0.42, w, h * 0.16);
    g.fillStyle = '#fff4cf'; g.fillRect(0, h * 0.4, w, 6); g.fillRect(0, h * 0.58, w, 6);
    g.fillStyle = '#fff4cf';
    for (let i = 0; i < 12; i++) { const x = (i + 0.5) * (w / 12); g.beginPath(); g.moveTo(x - 14, h * 0.47); g.lineTo(x, h * 0.53); g.lineTo(x + 14, h * 0.47); g.closePath(); g.fill(); }
    g.strokeStyle = band; g.lineWidth = 6;
    for (let i = 0; i < 8; i++) { const x = (i + 0.5) * (w / 8); g.beginPath(); g.arc(x, h * 0.75, 16, Math.PI, 0); g.stroke(); }
  });
  TEX.jarRed = jar('#ff4d4d', '#c81f3a', '#5a1020');
  TEX.jarPurple = jar('#b05cff', '#6b22c9', '#2d0f5c');
  TEX.jarOrange = jar('#ffb13b', '#f0781e', '#6a2a0a');
  TEX.jarTeal = jar('#38d9c9', '#139c9c', '#0a3f45');
  TEX.flames = canvasTex(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#5b23c4'); gr.addColorStop(1, '#3c158f');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) {
      const y = (i + 0.5) * (h / 6);
      const fl = g.createLinearGradient(0, 0, w * 0.7, 0); fl.addColorStop(0, '#ffe14a'); fl.addColorStop(0.5, '#ff8a1c'); fl.addColorStop(1, 'rgba(255,60,20,0)');
      g.fillStyle = fl; g.beginPath(); g.moveTo(0, y - 16);
      g.bezierCurveTo(w * 0.3, y - 30, w * 0.45, y + 10, w * 0.7, y - 4); g.bezierCurveTo(w * 0.45, y + 26, w * 0.25, y + 10, 0, y + 16); g.fill();
    }
    g.fillStyle = '#ffcf3a'; g.fillRect(w - 26, 0, 26, h); g.fillRect(0, 0, 16, h);
  });
  TEX.lawn = canvasTex(512, 512, (g, w) => {
    g.fillStyle = '#4fae2e'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#5fc23a' : '#47a02a'; g.fillRect(i * (w / 8), 0, w / 8, w); }
    for (let i = 0; i < 9000; i++) { const s = Math.random(); g.fillStyle = s > 0.5 ? 'rgba(160,230,90,.35)' : 'rgba(30,90,20,.3)'; g.fillRect(Math.random() * w, Math.random() * w, 2, 4); }
    for (let i = 0; i < 70; i++) { g.fillStyle = ['#fff', '#ffe14a', '#ff8ad0'][i % 3]; g.beginPath(); g.arc(Math.random() * w, Math.random() * w, 2.6, 0, 7); g.fill(); }
  }, [26, 26]);
  TEX.stripes = canvasTex(512, 64, (g, w, h) => {
    const cols = ['#ff3d5a', '#ffd23a', '#2f7bff', '#ffd23a'];
    for (let i = 0; i < 16; i++) { g.fillStyle = cols[i % 4]; g.fillRect(i * (w / 16), 0, w / 16 + 1, h); }
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, 4, w, 6);
  });
  TEX.ball = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#ff2f3a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd23a'; g.fillRect(0, h * 0.44, w, h * 0.12);
    g.fillStyle = '#2f4dff'; g.fillRect(0, h * 0.4, w, 5); g.fillRect(0, h * 0.58, w, 5);
    const star = (cx, cy, r) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); g.fill(); };
    g.fillStyle = '#ffd23a'; star(w * 0.25, h * 0.25, 18); star(w * 0.75, h * 0.25, 18);
    g.fillStyle = '#ffffff'; star(w * 0.25, h * 0.78, 14); star(w * 0.75, h * 0.78, 14);
  });
  TEX.dot = canvasTex(64, 64, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.45, 'rgba(255,255,255,.85)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
  TEX.dot.colorSpace = THREE.NoColorSpace;
  TEX.ready = true;
  return TEX;
}

/* ---------- materials and shapes of the pieces ---------- */
const MAT = {}, GEO = {};
function kit() {
  if (MAT.ready) return;
  const T = textures();
  const glaze = (map, extra = {}) => new THREE.MeshPhysicalMaterial({ map, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.18, ...extra });
  MAT.tiles = { blue: glaze(T.blue), turq: glaze(T.turq), terra: glaze(T.terra), purple: glaze(T.purple), sand: new THREE.MeshStandardMaterial({ map: T.sand, roughness: 0.75 }) };
  MAT.jars = { red: glaze(T.jarRed), purple: glaze(T.jarPurple), orange: glaze(T.jarOrange), teal: glaze(T.jarTeal) };
  MAT.gold = new THREE.MeshPhysicalMaterial({ color: '#ffcc3a', metalness: 0.55, roughness: 0.22, clearcoat: 1, emissive: '#8a5600', emissiveIntensity: 0.45 });
  MAT.marble = new THREE.MeshPhysicalMaterial({ color: '#fbf6ee', roughness: 0.3, clearcoat: 0.8 });
  MAT.roofs = { red: glaze(null, { color: '#ff3048' }), blue: glaze(null, { color: '#2f6dff' }), purple: glaze(null, { color: '#9a3dff' }) };
  MAT.wood = new THREE.MeshStandardMaterial({ color: '#9b5a2a', roughness: 0.6 });
  GEO.block = new RoundedBoxGeometry(0.8, 0.8, 0.8, 3, 0.07);
  GEO.slab = (L) => new RoundedBoxGeometry(L, 0.2, 0.84, 2, 0.05);
  // an amphora turned on a wheel: foot, belly, shoulder, neck and rim, one metre tall
  const prof = [[0.0, -0.5], [0.16, -0.5], [0.2, -0.46], [0.18, -0.4], [0.27, -0.26], [0.34, -0.06], [0.34, 0.08], [0.3, 0.2], [0.2, 0.3], [0.14, 0.36], [0.13, 0.43], [0.18, 0.47], [0.17, 0.5], [0.0, 0.5]];
  GEO.jar = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 28);
  GEO.handle = new THREE.TorusGeometry(0.1, 0.028, 8, 16, Math.PI * 1.2);
  GEO.column = new THREE.CylinderGeometry(0.22, 0.25, 1.36, 20);
  GEO.capital = new RoundedBoxGeometry(0.62, 0.12, 0.62, 2, 0.03);
  GEO.cone = new THREE.ConeGeometry(0.42, 0.78, 20);
  GEO.coin = new THREE.CylinderGeometry(0.22, 0.22, 0.06, 26);
  GEO.chest = new RoundedBoxGeometry(0.84, 0.46, 0.6, 2, 0.05);
  GEO.lid = new THREE.CylinderGeometry(0.3, 0.3, 0.84, 18, 1, false, 0, Math.PI);
  GEO.shard = new THREE.TetrahedronGeometry(0.11);
  MAT.ready = true;
}

const DEF = {
  block: { mass: 1.2, shape: () => new CANNON.Box(new CANNON.Vec3(0.4, 0.4, 0.4)), h: 0.8 },
  jar: { mass: 0.6, shape: () => new CANNON.Cylinder(0.3, 0.2, 1.0, 10), h: 1.0, breaks: 3.2 },
  column: { mass: 1.5, shape: () => new CANNON.Cylinder(0.27, 0.27, 1.6, 10), h: 1.6 },
  cone: { mass: 0.3, shape: () => new CANNON.Cylinder(0.04, 0.42, 0.78, 10), h: 0.78 },
  coin: { mass: 0.12, shape: () => new CANNON.Cylinder(0.22, 0.22, 0.07, 10), h: 0.44 },
  chest: { mass: 1.4, shape: () => new CANNON.Box(new CANNON.Vec3(0.42, 0.3, 0.3)), h: 0.6 },
};
const JUICE = { red: '#ff3355', purple: '#a24dff', orange: '#ffb12e', teal: '#2ee0d0' };

function pieceMesh(p) {
  const g = new THREE.Group();
  const add = (geo, mat, y = 0) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  if (p.type === 'block') add(GEO.block, MAT.tiles[p.look]);
  else if (p.type === 'slab') add(GEO.slab(p.L), MAT.tiles[p.look]);
  else if (p.type === 'jar') {
    add(GEO.jar, MAT.jars[p.look]);
    for (const s of [-1, 1]) { const hd = add(GEO.handle, MAT.jars[p.look], 0.26); hd.position.x = s * 0.2; hd.rotation.z = s > 0 ? -0.3 : Math.PI + 0.3; }
  } else if (p.type === 'column') {
    add(GEO.column, MAT.marble);
    add(GEO.capital, MAT.gold, 0.74); add(GEO.capital, MAT.gold, -0.74);
  } else if (p.type === 'cone') {
    add(GEO.cone, MAT.roofs[p.look]);
    const tip = add(new THREE.SphereGeometry(0.07, 12, 8), MAT.gold, 0.42); tip.castShadow = false;
  } else if (p.type === 'coin') {
    const c = add(GEO.coin, MAT.gold); c.rotation.x = Math.PI / 2;
    p.spin = c;
  } else if (p.type === 'chest') {
    add(GEO.chest, MAT.wood, -0.07);
    const lid = add(GEO.lid, MAT.wood, 0.16); lid.rotation.z = Math.PI / 2; lid.scale.set(0.5, 1, 1);
    const band = add(new RoundedBoxGeometry(0.88, 0.5, 0.1, 2, 0.03), MAT.gold, -0.06); band.position.z = 0;
    const lock = add(new RoundedBoxGeometry(0.16, 0.18, 0.06, 2, 0.02), MAT.gold, 0.05); lock.position.z = 0.32;
    const glow = new THREE.PointLight('#ffd060', 2.2, 3, 2); glow.position.set(0, 0.3, 0.5); g.add(glow);
  }
  return g;
}

/* ---------- the levels ---------- */
// every level is built from one of five plans, bigger and taller as the levels climb
const LOOKS = ['blue', 'turq', 'terra', 'purple', 'sand'];
const JARS = ['red', 'purple', 'orange', 'teal'];
function buildLevel(n) {
  const R = rng(n * 7919 + 13);
  const d = Math.min(1.6, (n - 1) / 9);
  const out = [];
  const tileA = LOOKS[Math.floor(R() * 4)], tileB = LOOKS[(LOOKS.indexOf(tileA) + 1 + Math.floor(R() * 3)) % 4];
  const jar = () => JARS[Math.floor(R() * JARS.length)];
  const put = (type, x, y, z, extra = {}) => out.push({ type, x, y, z, ...extra });
  const plan = (n - 1) % 5;
  if (plan === 0) {
    // shelves of jars: a row of jars, a slab, a shorter row, a slab…
    const base = 3 + Math.round(d * 1.5), depth = d > 0.6 ? [-0.38, 0.38] : [0];
    let y = PT;
    for (let row = 0; row < base; row++) {
      const k = base - row, w = k * 0.76;
      for (const z of depth) for (let i = 0; i < k; i++) put('jar', -w / 2 + 0.38 + i * 0.76, y + 0.5, z, { look: jar() });
      y += 1.0;
      if (row < base - 1) { put('slab', 0, y + 0.1, 0, { L: w + 0.1, look: row % 2 ? tileA : tileB, D: depth.length > 1 ? 1.6 : 0.84 }); y += 0.2; }
    }
    put('coin', 0, y + 0.22, 0);
  } else if (plan === 1) {
    // a glazed wall with jars along its top
    const cols = 3 + Math.round(d * 1.6), rows = 2 + Math.round(d * 1.4);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) put('block', -(cols - 1) * 0.41 + c * 0.82, PT + 0.4 + r * 0.8, 0, { look: (r + c) % 2 ? tileA : tileB });
    const top = PT + rows * 0.8;
    for (let c = 0; c < cols; c++) if (c % 2 === 0) put('jar', -(cols - 1) * 0.41 + c * 0.82, top + 0.5, 0, { look: jar() }); else put('coin', -(cols - 1) * 0.41 + c * 0.82, top + 0.22, 0);
    if (d > 0.5) for (let c = 0; c < cols - 1; c += 2) put('block', -(cols - 1) * 0.41 + c * 0.82 + 0.41, PT + 0.4, 0.84, { look: tileA });
  } else if (plan === 2) {
    // a little temple: pairs of columns, lintels, jars between, roofs on top
    const bays = 2 + Math.round(d), span = 1.25, w = bays * span;
    for (let i = 0; i <= bays; i++) put('column', -w / 2 + i * span, PT + 0.8, 0);
    for (let i = 0; i < bays; i++) { put('slab', -w / 2 + i * span + span / 2, PT + 1.7, 0, { L: span + 0.5, look: i % 2 ? tileA : tileB }); put('jar', -w / 2 + i * span + span / 2, PT + 0.5, 0, { look: jar() }); }
    for (let i = 0; i < bays; i++) put('jar', -w / 2 + i * span + span / 2, PT + 2.3, 0, { look: jar() });
    if (d > 0.7) { for (let i = 0; i < bays; i++) put('slab', -w / 2 + i * span + span / 2, PT + 2.9, 0, { L: span + 0.4, look: tileA }); for (let i = 0; i <= bays; i += bays) put('cone', -w / 2 + i * span + (i ? -0.4 : 0.4), PT + 3.39, 0, { look: 'red' }); }
    else for (let i = 0; i <= bays; i++) put('cone', -w / 2 + i * span, PT + 2.79, 0, { look: i % 2 ? 'blue' : 'red' });
  } else if (plan === 3) {
    // a castle of glazed towers with pointed roofs
    const towers = 3 + Math.round(d * 1.2), sp = 0.84, w = (towers - 1) * sp;
    for (let t = 0; t < towers; t++) {
      const mid = Math.abs(t - (towers - 1) / 2), hgt = 2 + Math.round((towers / 2 - mid) * (0.6 + d * 0.6));
      const x = -w / 2 + t * sp;
      for (let k = 0; k < hgt; k++) put('block', x, PT + 0.4 + k * 0.8, 0, { look: k === hgt - 1 ? tileB : tileA });
      if (t % 2 === 0 || towers <= 3) put('cone', x, PT + hgt * 0.8 + 0.39, 0, { look: ['red', 'blue', 'purple'][t % 3] });
      else put('coin', x, PT + hgt * 0.8 + 0.22, 0);
    }
    put('jar', 0, PT + 0.5, 0.86, { look: jar() });
  } else {
    // a ziggurat with jars at its corners
    const base = 3 + Math.round(d * 1.3);
    let y = PT;
    for (let lv = 0; lv < base; lv++) {
      const k = base - lv;
      for (let c = 0; c < k; c++) put('block', -(k - 1) * 0.41 + c * 0.82, y + 0.4, 0, { look: lv % 2 ? tileA : tileB });
      if (lv === 0 && k > 2) { put('jar', -(k - 1) * 0.41 - 0.86, y + 0.5, 0, { look: jar() }); put('jar', (k - 1) * 0.41 + 0.86, y + 0.5, 0, { look: jar() }); }
      y += 0.8;
    }
    put('jar', 0, y + 0.5, 0, { look: jar() });
  }
  // the treasure chest crowns the building: on the highest piece over the middle (or in place of a jar there)
  const covers = (p, x) => Math.abs(p.x - x) < (p.type === 'slab' ? p.L / 2 : 0.45) && Math.abs(p.z) < 0.5;
  const core = out.filter((p) => covers(p, 0) && p.type !== 'coin' && p.type !== 'cone').sort((a, b) => b.y - a.y);
  const topP = core[0];
  for (let i = out.length - 1; i >= 0; i--) { const p = out[i]; if ((p.type === 'coin' || p.type === 'cone') && covers(p, 0) && p.y > topP.y) out.splice(i, 1); }
  if (topP.type === 'jar') { out.splice(out.indexOf(topP), 1); put('chest', topP.x, topP.y - 0.2, 0); }
  else put('chest', topP.type === 'slab' ? 0 : topP.x, topP.y + (topP.type === 'slab' ? 0.1 : (DEF[topP.type].h / 2)) + 0.31, 0);
  const solid = out.filter((p) => p.type !== 'coin').length;
  const balls = Math.ceil(solid * Math.max(0.3, 0.5 - n * 0.01)) + 2;
  return { pieces: out, balls, plan };
}

/* ---------- the world ---------- */
function makeWorld() {
  world = new CANNON.World({ gravity: new CANNON.Vec3(0, -G, 0) });
  world.allowSleep = true;
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.solver.iterations = 14;
  world.defaultContactMaterial.friction = 0.55;
  world.defaultContactMaterial.restitution = 0.08;
  const ground = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
  ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  ground.userData = { ground: true };
  ground.collisionFilterGroup = GROUP.ground;
  world.addBody(ground);
  const top = new CANNON.Body({ mass: 0, shape: new CANNON.Cylinder(PR, PR, 0.4, 24), position: new CANNON.Vec3(0, PT - 0.2, 0) });
  top.collisionFilterGroup = GROUP.stage; top.collisionFilterMask = GROUP.piece;
  world.addBody(top);
  const pole = new CANNON.Body({ mass: 0, shape: new CANNON.Cylinder(0.45, 0.6, PT - 0.4, 12), position: new CANNON.Vec3(0, (PT - 0.4) / 2, 0) });
  pole.collisionFilterGroup = GROUP.stage; pole.collisionFilterMask = GROUP.piece;
  world.addBody(pole);
}

function makeScene(el) {
  kit();
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  el.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#bfe6ff', 38, 95);
  camera = new THREE.PerspectiveCamera(50, 1, 0.1, 300);
  clock = new THREE.Clock();

  // sky: a gradient dome, and the same dome lights the glossy glaze
  const sky = new THREE.Mesh(new THREE.SphereGeometry(140, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#1f6fe6') }, mid: { value: new THREE.Color('#62b4ff') }, bot: { value: new THREE.Color('#d8f1ff') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform vec3 top, mid, bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > .18 ? mix(mid, top, smoothstep(.18,.75,h)) : mix(bot, mid, smoothstep(-.02,.18,h)); gl_FragColor = vec4(c,1.); }',
  }));
  scene.add(sky);
  const env = new THREE.Scene();
  env.add(sky.clone());
  const sunBlob = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' })); sunBlob.position.set(40, 60, 30); env.add(sunBlob);
  const grassBlob = new THREE.Mesh(new THREE.CircleGeometry(120, 24), new THREE.MeshBasicMaterial({ color: '#3d8f25' })); grassBlob.rotation.x = -Math.PI / 2; grassBlob.position.y = -6; env.add(grassBlob);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(env, 0.03).texture;
  scene.environmentIntensity = 0.8;

  scene.add(new THREE.HemisphereLight('#cfe9ff', '#3f7d22', 1.1));
  const sun = new THREE.DirectionalLight('#fff3d6', 2.6);
  sun.position.set(9, 16, 10); sun.castShadow = true;
  const big = Math.max(window.innerWidth, window.innerHeight) > 900;
  sun.shadow.mapSize.set(big ? 2048 : 1024, big ? 2048 : 1024);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 12, bottom: -6, near: 1, far: 50 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  scene.add(sun);
  flashLight = new THREE.PointLight('#ffb54a', 0, 12, 2); scene.add(flashLight);

  // the lawn, hills, trees and a ruined temple on the horizon
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ map: TEX.lawn, roughness: 0.95 }));
  lawn.rotation.x = -Math.PI / 2; lawn.receiveShadow = true; scene.add(lawn);
  const hillM = new THREE.MeshStandardMaterial({ color: '#58b83a', roughness: 1 });
  [[-40, -60, 26, 9], [10, -75, 34, 12], [55, -58, 24, 8], [-75, -40, 22, 10], [80, -35, 26, 9]].forEach(([x, z, r, h]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12), hillM); m.scale.y = h / r; m.position.set(x, 0, z); scene.add(m);
  });
  const trunk = new THREE.MeshStandardMaterial({ color: '#8a5a2e', roughness: 0.8 }), leaf = new THREE.MeshStandardMaterial({ color: '#3fae3a', roughness: 0.7 }), palmLeaf = new THREE.MeshStandardMaterial({ color: '#2f9e3a', roughness: 0.6, side: THREE.DoubleSide });
  const tree = (x, z, s) => {
    const t = new THREE.Group();
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 2.4, 8), trunk); tr.position.y = 1.2; t.add(tr);
    for (const [ox, oy, r] of [[0, 3.3, 1.5], [-0.8, 2.8, 1.1], [0.8, 2.9, 1.1]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), leaf); b.position.set(ox, oy, 0); b.castShadow = true; t.add(b); }
    t.position.set(x, 0, z); t.scale.setScalar(s); scene.add(t);
  };
  const palm = (x, z, s) => {
    const t = new THREE.Group();
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 5, 8), trunk); tr.position.y = 2.5; tr.rotation.z = 0.08; t.add(tr);
    for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 3.2), palmLeaf); f.position.set(0.2, 5, 0); f.rotation.set(1.0, (i / 7) * Math.PI * 2, 0); f.translateY(1.3); t.add(f); }
    t.position.set(x, 0, z); t.scale.setScalar(s); scene.add(t);
  };
  [[-14, -10, 1.3], [15, -12, 1.4], [-22, -22, 1.6], [24, -20, 1.5], [-9, -26, 1.2], [8, -30, 1.3]].forEach((a) => tree(...a));
  [[-11, -4, 1], [12, -5, 1.1], [-18, -15, 1.2], [19, -14, 1]].forEach((a) => palm(...a));
  const ruin = new THREE.Group(), sandM = new THREE.MeshStandardMaterial({ color: '#f1d39a', roughness: 0.8 });
  for (let i = 0; i < 6; i++) { if (i === 4) continue; const c = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, i === 2 ? 4 : 7, 14), sandM); c.position.set(-7.5 + i * 3, i === 2 ? 2 : 3.5, 0); ruin.add(c); }
  const ped = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 2.2), sandM); ped.position.set(-3, 7.6, 0); ped.rotation.z = 0.03; ruin.add(ped);
  const base = new THREE.Mesh(new THREE.BoxGeometry(19, 0.8, 3), sandM); base.position.y = 0.4; ruin.add(base);
  ruin.position.set(2, 0, -42); scene.add(ruin);
  // a striped circus-like canopy tent and flags give it the colour of a fair
  const tentM = new THREE.MeshStandardMaterial({ map: TEX.stripes, roughness: 0.6 });
  const tent = (x, z, s) => { const t = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.6, 16, 1, true), tentM); t.position.set(x, 3.6, z); const w = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 2.4, 16, 1, true), tentM); w.position.set(x, 1.2, z); t.scale.setScalar(s); w.scale.setScalar(s); w.position.y *= s; t.position.y = (2.4 + 1.3) * s; scene.add(t, w); };
  tent(-20, -30, 1.2); tent(22, -34, 1.4);

  // clouds of soft puffs that drift
  const cloudM = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#dbeeff', emissiveIntensity: 0.35, fog: false });
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Group();
    for (let k = 0; k < 5; k++) { const p = new THREE.Mesh(new THREE.SphereGeometry(2 + Math.random() * 1.6, 14, 10), cloudM); p.position.set(k * 2.3 - 4.6, Math.random() * 1.2, Math.random()); c.add(p); }
    c.position.set(-60 + i * 20 + Math.random() * 8, 24 + Math.random() * 12, -70 - Math.random() * 20);
    c.scale.setScalar(0.8 + Math.random() * 0.6); scene.add(c); clouds.push(c);
  }

  // the pedestal: a striped drum on a pole
  pedestal = new THREE.Group();
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(PR, PR, 0.4, 48, 1, true), new THREE.MeshStandardMaterial({ map: TEX.stripes, roughness: 0.4 }));
  drum.position.y = PT - 0.2; drum.castShadow = true; drum.receiveShadow = true;
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(PR, PR, 0.04, 48), new THREE.MeshPhysicalMaterial({ color: '#2f6dff', roughness: 0.35, clearcoat: 1 }));
  lid.position.y = PT - 0.02; lid.receiveShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(PR, 0.07, 10, 64), MAT.gold); rim.rotation.x = Math.PI / 2; rim.position.y = PT;
  const rim2 = rim.clone(); rim2.position.y = PT - 0.4;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, PT - 0.4, 20), new THREE.MeshPhysicalMaterial({ color: '#8a3dff', roughness: 0.3, clearcoat: 1 }));
  pole.position.y = (PT - 0.4) / 2; pole.castShadow = true;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.3, 24), new THREE.MeshPhysicalMaterial({ color: '#ff3048', roughness: 0.3, clearcoat: 1 }));
  foot.position.y = 0.15; foot.receiveShadow = true;
  pedestal.add(drum, lid, rim, rim2, pole, foot);
  scene.add(pedestal);

  // the cannon in the foreground: bronze-purple barrel painted with flames, on red wheels
  cannon = new THREE.Group();
  const barrelProf = [[0, -1.1], [0.42, -1.1], [0.48, -1.0], [0.46, -0.8], [0.4, -0.4], [0.36, 0.4], [0.34, 0.9], [0.42, 0.98], [0.44, 1.1], [0.3, 1.12], [0.28, 1.0], [0.0, 1.0]];
  const barrel = new THREE.Mesh(new THREE.LatheGeometry(barrelProf.map(([r, y]) => new THREE.Vector2(r, y)), 40), new THREE.MeshPhysicalMaterial({ map: TEX.flames, roughness: 0.3, clearcoat: 1, metalness: 0.2 }));
  barrel.rotation.x = Math.PI / 2; barrel.castShadow = true;
  const muzzleRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 12, 32), MAT.gold); muzzleRing.position.z = 1.04;
  const breech = new THREE.Mesh(new THREE.SphereGeometry(0.46, 24, 16), MAT.gold); breech.position.z = -1.08; breech.scale.z = 0.6;
  const pitch = new THREE.Group(); pitch.add(barrel, muzzleRing, breech);
  const muzzle = new THREE.Object3D(); muzzle.position.z = 1.15; pitch.add(muzzle);
  const yaw = new THREE.Group(); yaw.add(pitch); pitch.position.y = 0.95;
  const wheelM = new THREE.MeshPhysicalMaterial({ color: '#ff2f48', roughness: 0.3, clearcoat: 1 });
  for (const s of [-1, 1]) {
    const w = new THREE.Group();
    const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.12, 12, 32), wheelM);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.24, 16), MAT.gold); hub.rotation.x = Math.PI / 2;
    w.add(tyre, hub);
    for (let i = 0; i < 8; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.15, 0.06), MAT.gold); sp.rotation.z = (i / 8) * Math.PI; w.add(sp); }
    w.rotation.y = Math.PI / 2; w.position.set(s * 0.68, 0.7, -0.2); yaw.add(w);
  }
  const carriage = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.4, 1.6, 2, 0.08), new THREE.MeshPhysicalMaterial({ color: '#5b23c4', roughness: 0.35, clearcoat: 1 }));
  carriage.position.set(0, 0.55, -0.2); yaw.add(carriage);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 0.3, 40), new THREE.MeshPhysicalMaterial({ color: '#ffcf3a', roughness: 0.35, clearcoat: 1, metalness: 0.3 }));
  plate.position.y = 0.15; plate.receiveShadow = true;
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 8, 32), new THREE.MeshPhysicalMaterial({ color: '#7a3be0', roughness: 0.4, clearcoat: 0.6 }));
  stand.position.y = -4;
  cannon.add(plate, stand, yaw);
  cannon.rotation.y = Math.PI; // its own +z, where the barrel points, faces the building
  cannon.userData = { yaw, pitch, muzzle, recoil: 0 };
  scene.add(cannon);

  // particles: a glowing set (fire, sparks) and a coloured set (splashes, dust)
  FXA = particles(700, true);
  FX = particles(900, false);
  scene.add(FXA.points, FX.points);

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.5, 0.92));
  composer.addPass(new OutputPass());
  resize();
  ro = new ResizeObserver(resize); ro.observe(el);
}

function particles(N, additive) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N), alpha = new Float32Array(N);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { map: { value: TEX.dot }, scale: { value: 400 } },
    vertexShader: 'attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float scale; void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform sampler2D map; varying vec3 vC; varying float vA; void main(){ vec4 t = texture2D(map, gl_PointCoord); if (t.a * vA < .02) discard; gl_FragColor = vec4(vC, t.a * vA); }',
  });
  const points = new THREE.Points(geo, mat); points.frustumCulled = false;
  const P = { points, geo, N, pos, col, size, alpha, v: new Float32Array(N * 3), life: new Float32Array(N), max: new Float32Array(N), s0: new Float32Array(N), grav: new Float32Array(N), drag: new Float32Array(N), next: 0 };
  return P;
}
const tmpC = new THREE.Color();
function emit(P, x, y, z, vx, vy, vz, color, s, life, grav = 1, drag = 0.6) {
  const i = P.next; P.next = (P.next + 1) % P.N;
  P.pos[i * 3] = x; P.pos[i * 3 + 1] = y; P.pos[i * 3 + 2] = z;
  P.v[i * 3] = vx; P.v[i * 3 + 1] = vy; P.v[i * 3 + 2] = vz;
  tmpC.set(color); P.col[i * 3] = tmpC.r; P.col[i * 3 + 1] = tmpC.g; P.col[i * 3 + 2] = tmpC.b;
  P.life[i] = life; P.max[i] = life; P.s0[i] = s; P.grav[i] = grav; P.drag[i] = drag;
}
function stepParticles(P, dt) {
  for (let i = 0; i < P.N; i++) {
    if (P.life[i] <= 0) { P.alpha[i] = 0; continue; }
    P.life[i] -= dt;
    const k = Math.max(0, P.life[i] / P.max[i]);
    const dr = Math.pow(P.drag[i], dt);
    P.v[i * 3] *= dr; P.v[i * 3 + 2] *= dr; P.v[i * 3 + 1] = P.v[i * 3 + 1] * dr - G * P.grav[i] * dt;
    P.pos[i * 3] += P.v[i * 3] * dt; P.pos[i * 3 + 1] += P.v[i * 3 + 1] * dt; P.pos[i * 3 + 2] += P.v[i * 3 + 2] * dt;
    if (P.pos[i * 3 + 1] < 0.03) { P.pos[i * 3 + 1] = 0.03; P.v[i * 3 + 1] *= -0.2; P.v[i * 3] *= 0.6; P.v[i * 3 + 2] *= 0.6; }
    P.alpha[i] = Math.min(1, k * 2.2);
    P.size[i] = P.s0[i] * (0.5 + k * 0.6);
  }
  P.geo.attributes.position.needsUpdate = true; P.geo.attributes.color.needsUpdate = true;
  P.geo.attributes.size.needsUpdate = true; P.geo.attributes.alpha.needsUpdate = true;
}

function resize() {
  if (!renderer || !host) return;
  const w = host.clientWidth || window.innerWidth, h = host.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false); composer.setSize(w, h);
  camera.aspect = w / h;
  // frame the tower (about 7 m wide, 7.5 m tall above the lawn) whatever the shape of the screen
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const dist = Math.max(4.1 / t, 3.5 / (t * camera.aspect), CANNON_Z + 4.4);
  camBase.set(0, 3.4 + dist * 0.04, dist);
  camLook.set(0, PT + 2.5, 0);
  camera.position.copy(camBase); camera.lookAt(camLook); camera.updateProjectionMatrix();
  // the cannon sits low in front of the camera, cut by the bottom of the screen like a player's view
  // the barrel's pivot sits just above the bottom edge of the picture at the cannon's depth
  const near = dist - CANNON_Z, tilt = Math.atan2(camLook.y - camBase.y, dist);
  const bottom = camBase.y - near * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2) - tilt);
  cannon.scale.setScalar(0.85);
  cannon.position.set(0, bottom + 0.42 - 0.95 * 0.85, CANNON_Z);
  FX.points.material.uniforms.scale.value = FXA.points.material.uniforms.scale.value = h / 2;
}

/* ---------- pieces in the world ---------- */
function addPiece(p) {
  const def = p.type === 'slab' ? { mass: 0.9 * p.L, shape: () => new CANNON.Box(new CANNON.Vec3(p.L / 2, 0.1, (p.D || 0.84) / 2)) } : DEF[p.type];
  const body = new CANNON.Body({ mass: def.mass, shape: def.shape(), position: new CANNON.Vec3(p.x, p.y, p.z) });
  if (p.type === 'coin') body.quaternion.setFromEuler(Math.PI / 2, 0, 0);
  body.linearDamping = 0.05; body.angularDamping = 0.12;
  body.sleepSpeedLimit = 0.3; body.sleepTimeLimit = 0.4;
  body.allowSleep = true;
  body.collisionFilterGroup = GROUP.piece; body.collisionFilterMask = GROUP.piece | GROUP.ground | GROUP.stage | GROUP.ball;
  world.addBody(body);
  body.sleep();
  const mesh = pieceMesh(p);
  if (p.type === 'slab' && p.D) mesh.scale.z = p.D / 0.84;
  if (p.type === 'coin') { mesh.children[0].rotation.x = 0; mesh.rotation.x = 0; }
  scene.add(mesh);
  const it = { ...p, body, mesh, cleared: false, broken: false, gone: 0, def };
  body.addEventListener('collide', (e) => {
    if (it.broken || !def.breaks) return;
    const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
    const byBall = e.body.userData && e.body.userData.ball;
    if (v > def.breaks || (byBall && v > 1.5)) removeQ.push(() => breakJar(it));
  });
  pieces.push(it);
  return it;
}

function clearLevel() {
  for (const it of pieces) { if (it.body) world.removeBody(it.body); scene.remove(it.mesh); }
  for (const b of balls) { world.removeBody(b.body); scene.remove(b.mesh); }
  for (const s of shards) scene.remove(s.m);
  pieces = []; balls = []; shards = []; removeQ = [];
}

function loadLevel(n) {
  clearLevel();
  levelNum = n;
  const L = buildLevel(n);
  L.pieces.forEach(addPiece);
  ballsLeft = L.balls; done = false; settleT = 0; combo = 0; armed = null;
  return L;
}

// sounds only while playing: the opening screen stays quiet
const sfx = (name) => { if (mode === 'play' && window.SFX && SFX[name]) SFX[name](); };
const toScreen = (v) => {
  const p = v.clone().project(camera);
  const r = renderer.domElement.getBoundingClientRect();
  return { x: r.left + (p.x * 0.5 + 0.5) * r.width, y: r.top + (-p.y * 0.5 + 0.5) * r.height };
};

/* ---------- effects ---------- */
function splash(at, color, n = 46) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 5;
    emit(FX, at.x, at.y, at.z, Math.cos(a) * s, 1.5 + Math.random() * 5, Math.sin(a) * s * 0.7 + 1, color, 0.14 + Math.random() * 0.2, 0.7 + Math.random() * 0.6, 1, 0.5);
  }
  for (let i = 0; i < 10; i++) emit(FXA, at.x, at.y, at.z, (Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 5, '#fff7c0', 0.12, 0.4, 0.3);
}
function sparkBurst(at, n = 30, color = '#ffb03a') {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI, s = 3 + Math.random() * 7;
    emit(FXA, at.x, at.y, at.z, Math.cos(a) * Math.sin(b) * s, Math.cos(b) * s + 2, Math.sin(a) * Math.sin(b) * s, Math.random() < 0.3 ? '#fff3a0' : color, 0.12 + Math.random() * 0.25, 0.4 + Math.random() * 0.5, 0.6, 0.4);
  }
}
function dust(at, n = 14, color = '#f3e6c8') {
  for (let i = 0; i < n; i++) emit(FX, at.x + (Math.random() - 0.5) * 0.6, at.y, at.z + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 2, 0.5 + Math.random() * 1.5, (Math.random() - 0.5) * 2, color, 0.5 + Math.random() * 0.5, 0.8 + Math.random() * 0.6, -0.05, 0.3);
}
function boom(at, big) {
  sparkBurst(at, big ? 90 : 34);
  for (let i = 0; i < (big ? 26 : 10); i++) emit(FXA, at.x, at.y, at.z, (Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3, i % 2 ? '#ff6a1a' : '#ffd23a', big ? 1.1 : 0.6, 0.35, 0, 0.2);
  dust(at, big ? 24 : 10, '#e8e2d8');
  flashLight.position.copy(at); flashLight.intensity = big ? 120 : 45;
  shake = Math.max(shake, big ? 0.5 : 0.18);
}
function shatter(it, color) {
  const at = it.mesh.position;
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(GEO.shard, MAT.jars[it.look]);
    m.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.5));
    m.scale.setScalar(0.6 + Math.random() * 1.3); m.castShadow = true;
    scene.add(m);
    shards.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 7, 2 + Math.random() * 5, (Math.random() - 0.3) * 6), w: new THREE.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9), life: 2.4 + Math.random() });
  }
  splash(at, color);
}
function breakJar(it) {
  if (it.broken || !it.body) return;
  it.broken = true;
  shatter(it, JUICE[it.look]);
  world.removeBody(it.body); it.body = null;
  scene.remove(it.mesh);
  sfx('shatter');
  clearPiece(it, true);
}
function clearPiece(it, burst) {
  if (it.cleared) return;
  it.cleared = true;
  if (mode !== 'play') return;
  const now = simT;
  combo = now - comboT < 1.1 ? combo + 1 : 1; comboT = now;
  const pos = toScreen(it.mesh.position.clone().add(new THREE.Vector3(0, 0.3, 0)));
  H.onClear && H.onClear({ type: it.type, look: it.look, burst, combo, x: pos.x, y: pos.y });
  H.onProgress && H.onProgress(progress());
}
const progress = () => { const s = pieces.filter((p) => p.type !== 'coin'); return s.length ? s.filter((p) => p.cleared).length / s.length : 1; };

/* ---------- firing ---------- */
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.2);
function aimAt(clientX, clientY) {
  const r = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  // a piece under the finger wins; otherwise the plane through the building
  const hits = ray.intersectObjects(pieces.filter((p) => !p.cleared).map((p) => p.mesh), true);
  if (hits.length) return hits[0].point;
  const p = new THREE.Vector3();
  return ray.ray.intersectPlane(plane, p) ? p : null;
}
function fire(target, kind = 'ball') {
  const C = cannon.userData;
  // aim the barrel first so the ball leaves from where the muzzle points
  const d = cannon.worldToLocal(target.clone());
  C.yaw.rotation.y = Math.atan2(d.x, d.z);
  C.pitch.rotation.x = -Math.atan2(d.y - C.pitch.position.y, Math.hypot(d.x, d.z)) - 0.06;
  cannon.updateMatrixWorld(true);
  const start = new THREE.Vector3(); C.muzzle.getWorldPosition(start);
  // the fastest flight that still clears the front rim of the pedestal
  // a fast, nearly flat shot; balls pass over the stage's lip (they only meet the pieces and the lawn)
  const T = Math.min(0.7, Math.max(0.3, start.distanceTo(target) / 24));
  const v = target.clone().sub(start).divideScalar(T); v.y += 0.5 * G * T;
  const body = new CANNON.Body({ mass: kind === 'bomb' ? 12 : 9, shape: new CANNON.Sphere(BALL_R), position: new CANNON.Vec3(start.x, start.y, start.z) });
  body.velocity.set(v.x, v.y, v.z);
  body.linearDamping = 0.01; body.allowSleep = false;
  body.collisionFilterGroup = GROUP.ball; body.collisionFilterMask = GROUP.piece | GROUP.ground;
  body.userData = { ball: true };
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 28, 18), kind === 'bomb'
    ? new THREE.MeshPhysicalMaterial({ color: '#2a2a3a', roughness: 0.25, clearcoat: 1, emissive: '#ff4a1a', emissiveIntensity: 0.6 })
    : new THREE.MeshPhysicalMaterial({ map: TEX.ball, roughness: 0.25, clearcoat: 1, emissive: '#ff3a1a', emissiveIntensity: 0.25 }));
  mesh.castShadow = true; scene.add(mesh);
  const B = { body, mesh, t: 0, kind, hit: false };
  body.addEventListener('collide', (e) => {
    if (B.hit) return;
    if (e.body.userData && e.body.userData.ground) return;
    B.hit = true;
    const at = new THREE.Vector3(body.position.x, body.position.y, body.position.z);
    B.hitT = B.t;
    removeQ.push(() => { boom(at, kind === 'bomb'); if (kind === 'bomb') explode(at, 2.8, 14, 1.7); else explode(at, 1.25, 6, 0.6); sfx(kind === 'bomb' ? 'boom' : 'impact'); });
  });
  world.addBody(body); balls.push(B);
  // muzzle flash, smoke and recoil
  for (let i = 0; i < 26; i++) emit(FXA, start.x, start.y, start.z, v.x * 0.08 + (Math.random() - 0.5) * 3, v.y * 0.05 + Math.random() * 2, v.z * 0.08 + (Math.random() - 0.5) * 3, i % 3 ? '#ffb02e' : '#fff2a0', 0.5 + Math.random() * 0.5, 0.25 + Math.random() * 0.2, 0, 0.15);
  for (let i = 0; i < 12; i++) emit(FX, start.x, start.y, start.z, (Math.random() - 0.5) * 2, 0.5 + Math.random() * 1.5, -Math.random() * 1.5, '#f4f1ea', 0.9 + Math.random() * 0.6, 1 + Math.random() * 0.6, -0.08, 0.35);
  flashLight.position.copy(start); flashLight.intensity = 60;
  C.recoil = 1; shake = Math.max(shake, 0.12);
  lastShot = simT;
  sfx('cannon');
}
// every ball bursts where it lands, a bomb much harder: pieces nearby are thrown back and outward
function explode(at, R, F, breakR) {
  for (const it of pieces) {
    if (!it.body) continue;
    const p = it.body.position, d = Math.hypot(p.x - at.x, p.y - at.y, p.z - at.z);
    if (d > R) continue;
    if (it.def.breaks && d < breakR) { removeQ.push(() => breakJar(it)); continue; }
    const k = (1 - d / R) * F * it.body.mass;
    it.body.wakeUp();
    it.body.applyImpulse(new CANNON.Vec3((p.x - at.x) / (d + 0.1) * k, k * 0.5 + 2, (p.z - at.z) / (d + 0.1) * k - k * 0.4));
  }
}
function shoot(clientX, clientY) {
  if (mode !== 'play' || done) return;
  if (simT - lastShot < 0.28) return;
  if (ballsLeft <= 0) { H.onEmpty && H.onEmpty(); return; }
  const target = aimAt(clientX, clientY);
  if (!target) return;
  ballsLeft--;
  const kind = armed; armed = null;
  if (kind === 'triple') {
    fire(target);
    setTimeout(() => fire(target.clone().add(new THREE.Vector3(-0.9, 0.25, 0))), 90);
    setTimeout(() => fire(target.clone().add(new THREE.Vector3(0.9, 0.25, 0))), 180);
  } else fire(target, kind === 'bomb' ? 'bomb' : 'ball');
  H.onBalls && H.onBalls(ballsLeft, kind);
  settleT = 0;
}

/* ---------- the loop ---------- */
function tick() {
  raf = requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 1 / 20);
  simT += dt; const t = simT; // game time: on a slow device everything slows together
  world.step(1 / 120, dt, 8);
  while (removeQ.length) removeQ.shift()();
  for (const it of pieces) {
    if (!it.body) continue;
    it.mesh.position.copy(it.body.position); it.mesh.quaternion.copy(it.body.quaternion);
    if (it.spin && it.body.sleepState === CANNON.Body.SLEEPING) it.mesh.rotation.y = t * 2;
    const p = it.body.position;
    if (!it.cleared && (p.y < PT - 0.7 || Math.hypot(p.x, p.z) > PR + 0.2)) {
      clearPiece(it, false);
      if (it.type === 'coin') sparkBurst(it.mesh.position, 16, '#ffd23a');
    }
    // a cleared piece that lies on the lawn sinks away after a moment
    if (it.cleared && p.y < 1.2) {
      it.gone += dt;
      if (it.gone > 1.6) {
        if (it.gone < 1.65) dust(it.mesh.position, 6);
        it.mesh.scale.multiplyScalar(0.9);
        if (it.gone > 2.2) { world.removeBody(it.body); it.body = null; scene.remove(it.mesh); }
      }
    }
  }
  for (let i = balls.length - 1; i >= 0; i--) {
    const B = balls[i];
    B.t += dt;
    B.mesh.position.copy(B.body.position); B.mesh.quaternion.copy(B.body.quaternion);
    if (!B.hit || B.t < 0.6) for (let k = 0; k < 3; k++) emit(FXA, B.mesh.position.x, B.mesh.position.y, B.mesh.position.z, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, k ? '#ff7a1a' : '#ffe26a', 0.42, 0.28, 0, 0.3);
    // a spent ball shrinks away so it doesn't hold up the pieces
    if (B.hit && B.t - B.hitT > 1.1) B.mesh.scale.multiplyScalar(Math.pow(0.02, dt));
    if (B.t > 3.5 || B.body.position.y < -2 || (B.hit && B.t - B.hitT > 1.6)) { world.removeBody(B.body); scene.remove(B.mesh); balls.splice(i, 1); }
  }
  for (let i = shards.length - 1; i >= 0; i--) {
    const s = shards[i];
    s.life -= dt; s.v.y -= G * dt;
    s.m.position.addScaledVector(s.v, dt);
    s.m.rotation.x += s.w.x * dt; s.m.rotation.y += s.w.y * dt;
    if (s.m.position.y < 0.05) { s.m.position.y = 0.05; s.v.multiplyScalar(0.3); s.v.y = Math.abs(s.v.y) * 0.3; s.w.multiplyScalar(0.5); }
    if (s.life < 0.5) s.m.scale.multiplyScalar(0.9);
    if (s.life <= 0) { scene.remove(s.m); shards.splice(i, 1); }
  }
  stepParticles(FX, dt); stepParticles(FXA, dt);
  flashLight.intensity *= Math.pow(0.002, dt);
  for (const c of clouds) { c.position.x += dt * 0.8; if (c.position.x > 80) c.position.x = -80; }
  // cannon recoil and idle sway
  const C = cannon.userData;
  C.recoil *= Math.pow(0.004, dt);
  C.pitch.position.z = -C.recoil * 0.45;
  if (t - lastShot > 2) { C.yaw.rotation.y *= Math.pow(0.4, dt); C.pitch.rotation.x += (-0.32 - C.pitch.rotation.x) * (1 - Math.pow(0.3, dt)); }
  // camera shake
  shake *= Math.pow(0.02, dt);
  camera.position.copy(camBase).add(new THREE.Vector3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0));
  camera.lookAt(camLook);

  if (mode === 'play' && !done) {
    const left = pieces.filter((p) => p.type !== 'coin' && !p.cleared).length;
    const moving = balls.length > 0 || pieces.some((p) => p.body && p.body.sleepState !== CANNON.Body.SLEEPING && !p.cleared);
    settleT = moving ? 0 : settleT + dt;
    if (left === 0) { done = true; setTimeout(() => H.onWin && H.onWin({ ballsLeft }), 900); }
    else if (ballsLeft <= 0 && t - lastShot > 1.2 && (settleT > 0.8 || t - lastShot > 6)) { done = true; H.onFail && H.onFail({ left, progress: progress() }); }
  }
  if (mode === 'show') {
    // the opening screen: the cannon fires by itself, and a new building rises when this one falls
    autoT -= dt; showT += dt;
    const standing = pieces.filter((p) => !p.cleared && p.body);
    if (autoT <= 0 && standing.length) {
      const pick = standing[Math.floor(Math.random() * standing.length)];
      fire(pick.mesh.position.clone().add(new THREE.Vector3(0, 0.1, 0)), Math.random() < 0.15 ? 'bomb' : 'ball');
      autoT = 1.6 + Math.random() * 1.2;
    }
    if ((standing.length <= 2 && showT > 6) || showT > 22) { showT = 0; autoT = 1.2; loadLevel(1 + Math.floor(Math.random() * 20)); }
  }
  composer.render();
}

function onDown(e) { if (mode === 'play') { e.preventDefault(); shoot(e.clientX, e.clientY); } }

function boot(el) {
  stop();
  host = el;
  makeWorld();
  makeScene(el);
  renderer.domElement.addEventListener('pointerdown', onDown);
}

function start(el, n, handlers) {
  boot(el);
  H = handlers || {};
  mode = 'play';
  const L = loadLevel(n);
  H.onBalls && H.onBalls(ballsLeft);
  H.onProgress && H.onProgress(0);
  tick();
  return { balls: L.balls, pieces: L.pieces.length };
}
function showcase(el) {
  try { boot(el); } catch (e) { console.warn('smash showcase', e); return false; }
  H = {}; mode = 'show'; autoT = 1.5; showT = 0;
  loadLevel(4);
  tick();
  return true;
}
function stop() {
  cancelAnimationFrame(raf); raf = 0;
  if (ro) { ro.disconnect(); ro = null; }
  if (renderer) {
    renderer.domElement.removeEventListener('pointerdown', onDown);
    renderer.domElement.remove();
    renderer.dispose();
  }
  renderer = null; composer = null; scene = null; world = null; host = null; mode = 'off';
  pieces = []; balls = []; shards = []; removeQ = []; clouds = [];
}

window.SMASH3D = {
  start, showcase, stop,
  info: (n) => { const L = buildLevel(n); return { balls: L.balls, pieces: L.pieces.length, plan: L.plan }; },
  addBalls: (k) => { ballsLeft += k; done = false; settleT = 0; H.onBalls && H.onBalls(ballsLeft); },
  arm: (kind) => { armed = armed === kind ? null : kind; return armed; },
  armed: () => armed,
  balls: () => ballsLeft,
  progress,
  // for scripted checks: shoot at a world point
  _fireAt: (x, y, z) => { if (ballsLeft > 0 && mode === 'play') { const p = toScreen(new THREE.Vector3(x, y, z)); shoot(p.x, p.y); } },
  _busy: () => balls.length > 0 || pieces.some((p) => p.body && !p.cleared && p.body.sleepState !== CANNON.Body.SLEEPING),
  _pieces: () => pieces.filter((p) => !p.cleared && p.body).map((p) => ({ type: p.type, x: p.body.position.x, y: p.body.position.y, z: p.body.position.z })),
  supported: !!window.WebGL2RenderingContext,
};
window.dispatchEvent(new Event('smash3d-ready'));
