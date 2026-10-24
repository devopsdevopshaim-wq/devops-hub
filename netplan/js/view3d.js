// Realistic 3D model of the building: floors, rooms, corridors, communication cabinets, risers,
// cabling and every network point at its recommended mounting position.
// Orbit view, enter any room, first-person walk, and WebXR (VR headsets).
// Loaded on demand (dynamic import) so the rest of the site never waits for WebGL.

import * as THREE from './vendor/three/three.module.min.js';
import { OrbitControls } from './vendor/three/OrbitControls.js';
import { PointerLockControls } from './vendor/three/PointerLockControls.js';
import { CSS2DRenderer, CSS2DObject } from './vendor/three/CSS2DRenderer.js';
import { EffectComposer } from './vendor/three/EffectComposer.js';
import { RenderPass } from './vendor/three/RenderPass.js';
import { UnrealBloomPass } from './vendor/three/UnrealBloomPass.js';
import { OutputPass } from './vendor/three/OutputPass.js';
import { RoomEnvironment } from './vendor/three/RoomEnvironment.js';
import { VRButton } from './vendor/three/VRButton.js';

// ---- dimensions (meters)
const RW = 4; // room width along the corridor
const RD = 5; // room depth
const CW = 2.4; // corridor width
const WH = 3.0; // wall height
const FH = 3.6; // floor-to-floor
const T = 0.12; // wall thickness
const CORE = 7; // stairs / elevators / riser zone at the west end
const DOOR = { from: 0.35, to: 1.3 }; // door opening along the corridor wall (from the room's right side)

const COLORS = {
  data: 0x3f8cff, voice: 0xff7a3d, ap: 0x22d39a, cam: 0xffb300, iot: 0xff5fa2, iptv: 0x39d353, print: 0xa99bff,
};
const HE = {
  data: 'מחשב', voice: 'טלפון', ap: 'נקודת גישה', cam: 'מצלמה', iot: 'בקר / IoT', iptv: 'טלוויזיה', print: 'מדפסת',
};

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Recommended mounting position of each point, in the room's local frame:
// x across the room (side walls at ±RW/2), z from the window wall (-RD/2) to the corridor wall (+RD/2), y above the floor.
export function placements(profile, room, outlets, apHere) {
  const out = [];
  const data = outlets.filter((o) => o.type === 'data');
  const voice = outlets.filter((o) => o.type === 'voice' || o.hasPhone);
  const hotel = profile === 'hotel' || profile === 'residential';
  const school = profile === 'school';
  data.forEach((o, i) => {
    const z = -1.6 + i * (data.length > 2 ? 3.2 / (data.length - 1) : 1.3);
    out.push({ o, type: 'data', pos: [-RW / 2 + T / 2 + 0.02, 0.3, z], wall: 'קיר צד, ליד עמדת העבודה', h: 30,
      tip: hotel ? 'ליד שולחן הכתיבה, בגובה 30 ס״מ, בשקע כפול עם חשמל' : school ? 'בקיר הכיתה ליד עמדת המורה, 30 ס״מ' : 'שקע RJ45 כפול בגובה 30 ס״מ, ליד שקעי החשמל ועד 1 מ׳ מעמדת העבודה' });
  });
  voice.forEach((o, i) => {
    if (o.hasPhone) return; // shares the PC outlet
    out.push({ o, type: 'voice', pos: hotel ? [-RW / 2 + 0.6 + i * 0.2, 0.6, -RD / 2 + T / 2 + 0.02] : [-RW / 2 + T / 2 + 0.02, 0.3, -1.6 + 0.3 + i * 0.25], wall: hotel ? 'ליד המיטה' : 'ליד שקע המחשב', h: hotel ? 60 : 30,
      tip: hotel ? 'ליד שידת המיטה בגובה 60 ס״מ' : 'צמוד לשקע המחשב, טלפון PoE (או מחשב דרך הטלפון)' });
  });
  outlets.filter((o) => o.type === 'iptv').forEach((o, i) => {
    out.push({ o, type: 'iptv', pos: [RW / 2 - T / 2 - 0.02, school ? 2.2 : 1.2, -0.3 + i * 0.3], wall: 'קיר המסך', h: school ? 220 : 120,
      tip: school ? 'מעל הלוח, למקרן/מסך אינטראקטיבי, 220 ס״מ' : 'מאחורי מסך הטלוויזיה, 120 ס״מ, ליד שקע חשמל' });
  });
  outlets.filter((o) => o.type === 'iot').forEach((o, i) => {
    out.push({ o, type: 'iot', pos: [-RW / 2 + 0.45 + i * 0.25, 1.4, RD / 2 - T / 2 - 0.02], wall: 'ליד הדלת', h: 140,
      tip: 'בקר חדר / תרמוסטט / קורא כרטיס, 140 ס״מ ליד הדלת' });
  });
  if (apHere) out.push({ o: apHere, type: 'ap', pos: [0, WH - 0.04, -0.2], wall: 'מרכז התקרה', h: Math.round((WH - 0.04) * 100),
    tip: 'מרכז התקרה, רחוק מגופי תאורה ותעלות מתכת, כבל Cat6A ישירות לארון' });
  void room;
  return out;
}

export function mount3d(stage, side, plan, opts = {}) {
  const reduceMotion = () => document.documentElement.dataset.motion === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- renderer / scene
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.xr.enabled = true;
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'הדמיה תלת־ממדית של המבנה');
  renderer.domElement.tabIndex = 0;
  stage.prepend(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = 'v3-labels';
  stage.append(labelRenderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060a13);
  scene.fog = new THREE.Fog(0x060a13, 120, 420);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(48, 1, 0.05, 2000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.autoRotateSpeed = 0.6;
  const walk = new PointerLockControls(camera, renderer.domElement);
  const dolly = new THREE.Group();
  scene.add(dolly);

  scene.add(new THREE.HemisphereLight(0xbcd6ff, 0x1a1408, 0.55));
  const sun = new THREE.DirectionalLight(0xfff2dc, 1.25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);

  // ground: dark plaza with a soft grid
  const groundTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#0b1220'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(95,212,234,0.16)'; g.lineWidth = 2;
    for (let i = 0; i <= 256; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(80, 80);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.3;
  ground.receiveShadow = true;
  scene.add(ground);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.4, 1.6);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---------- shared materials & geometries
  const M = {
    slab: new THREE.MeshStandardMaterial({ color: 0x2b3446, roughness: 0.85, metalness: 0.05 }),
    roomFloor: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0 }),
    corridor: new THREE.MeshStandardMaterial({ color: 0x3a4255, roughness: 0.6, metalness: 0.05 }),
    partition: new THREE.MeshPhysicalMaterial({ color: 0xe9eef7, roughness: 0.35, metalness: 0, transparent: true, opacity: 0.32, depthWrite: false }),
    facade: new THREE.MeshPhysicalMaterial({ color: 0x8fc4ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.16, depthWrite: false, envMapIntensity: 1.6 }),
    edge: new THREE.LineBasicMaterial({ color: 0xe2c27d, transparent: true, opacity: 0.55 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x9a7650, roughness: 0.6 }),
    fabric: new THREE.MeshStandardMaterial({ color: 0xd9dde6, roughness: 0.9 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1c2333, roughness: 0.5, metalness: 0.4 }),
    plate: new THREE.MeshStandardMaterial({ color: 0xf4f6fa, roughness: 0.4 }),
    glow: new THREE.MeshBasicMaterial({ toneMapped: false }),
    rack: new THREE.MeshStandardMaterial({ color: 0x141a26, roughness: 0.35, metalness: 0.7 }),
    led: new THREE.MeshBasicMaterial({ color: new THREE.Color(0x5fd4ea).multiplyScalar(4), toneMapped: false }),
    cable: new THREE.LineBasicMaterial({ color: 0x5fd4ea, transparent: true, opacity: 0.35 }),
    fiber: new THREE.LineBasicMaterial({ color: 0xffc861, transparent: true, opacity: 0.9 }),
    riser: new THREE.MeshBasicMaterial({ color: new THREE.Color(0x5fd4ea).multiplyScalar(3.5), toneMapped: false }),
    core: new THREE.MeshStandardMaterial({ color: 0x1e2636, roughness: 0.7 }),
  };
  const G = {
    box: new THREE.BoxGeometry(1, 1, 1),
    sphere: new THREE.SphereGeometry(1, 16, 12),
    disc: new THREE.CylinderGeometry(1, 1, 1, 24),
  };

  const state = {
    building: 0, floor: 'all', explode: 1, showCables: true, showFurniture: true, tour: false,
    hoverRoom: null, room: null, fly: null, keys: {}, floors: [], picks: [], markerPicks: [], labels: [],
  };
  let root = new THREE.Group();
  scene.add(root);

  // ---------- helpers
  const mtx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  function instanced(geo, mat, list, { cast = false, receive = false, colors = null } = {}) {
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
    mesh.count = list.length;
    list.forEach((b, i) => {
      q.setFromEuler(new THREE.Euler(0, b.ry || 0, 0));
      mtx.compose(v.set(b.x, b.y, b.z), q, s.set(b.w, b.h, b.d));
      mesh.setMatrixAt(i, mtx);
      if (colors) mesh.setColorAt(i, colors[i]);
    });
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return mesh;
  }
  function boxEdges(list) {
    const pts = [];
    for (const b of list) {
      const c = Math.cos(b.ry || 0);
      const sn = Math.sin(b.ry || 0);
      const corner = (dx, dy, dz) => { const lx = dx * b.w / 2; const lz = dz * b.d / 2; return [b.x + lx * c + lz * sn, b.y + dy * b.h / 2, b.z - lx * sn + lz * c]; };
      const top = [corner(-1, 1, -1), corner(1, 1, -1), corner(1, 1, 1), corner(-1, 1, 1)];
      for (let i = 0; i < 4; i++) pts.push(...top[i], ...top[(i + 1) % 4]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return new THREE.LineSegments(g, M.edge);
  }
  function textSprite(text, { size = 1.2, color = '#e2c27d', bg = 'rgba(8,12,22,0.75)' } = {}) {
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    const fs = 64;
    g.font = `800 ${fs}px Heebo, Arial, sans-serif`;
    const w = Math.ceil(g.measureText(text).width) + 48;
    c.width = w; c.height = fs + 36;
    g.font = `800 ${fs}px Heebo, Arial, sans-serif`;
    g.fillStyle = bg;
    g.beginPath(); g.roundRect(0, 0, w, c.height, 22); g.fill();
    g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
    g.fillText(text, w / 2, c.height / 2 + 2);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
    sp.scale.set(size * w / c.height, size, 1);
    return sp;
  }

  // Room centre & rotation on a floor: north row left→right, then south row right→left.
  function roomFrame(i, n) {
    const cols = Math.ceil(n / 2);
    const L = cols * RW;
    if (i < cols) return { x: -L / 2 + (i + 0.5) * RW, z: -(CW / 2 + RD / 2), ry: 0, L };
    const j = i - cols;
    return { x: L / 2 - (j + 0.5) * RW, z: CW / 2 + RD / 2, ry: Math.PI, L };
  }
  const toWorld = (f, lp) => {
    const c = Math.cos(f.ry);
    const sn = Math.sin(f.ry);
    return [f.x + lp[0] * c + lp[2] * sn, lp[1], f.z - lp[0] * sn + lp[2] * c];
  };

  // ---------- build the building
  function build() {
    scene.remove(root);
    root.traverse((o) => { if (o.isMesh || o.isLineSegments || o.isSprite) { o.geometry?.dispose?.(); if (o.material?.map) o.material.map.dispose(); } });
    root = new THREE.Group();
    scene.add(root);
    state.floors = [];
    state.picks = [];
    state.markerPicks = [];
    clearLabels();
    const b = plan.buildings[state.building] || plan.buildings[0];
    const profile = plan.cfg.profile;
    const maxCols = Math.max(...b.floors.map((f) => Math.ceil(f.rooms.length / 2)));
    const Lmax = maxCols * RW;
    const depth = 2 * RD + CW;

    b.floors.forEach((fl, fi) => {
      const g = new THREE.Group();
      g.userData = { fi, fl };
      const n = fl.rooms.length;
      const cols = Math.ceil(n / 2);
      const L = cols * RW;
      const x0 = -L / 2 - CORE;
      // slab + corridor
      const slab = new THREE.Mesh(G.box, M.slab);
      slab.scale.set(L + CORE + 0.6, 0.28, depth + 0.6);
      slab.position.set((x0 + L / 2 + 0.6) / 2, -0.14, 0);
      slab.receiveShadow = true; slab.castShadow = true;
      const corr = new THREE.Mesh(G.box, M.corridor);
      corr.scale.set(L + CORE, 0.02, CW);
      corr.position.set(x0 + (L + CORE) / 2, 0.01, 0);
      corr.receiveShadow = true;
      g.add(slab, corr);

      // core: stairs + 2 elevators + riser shaft
      const coreBoxes = [
        { x: x0 + 2, y: WH / 2, z: -(CW / 2 + RD / 2), w: 3.4, h: WH, d: RD - 0.4 },
        { x: x0 + 1.6, y: WH / 2, z: CW / 2 + 1.3, w: 2.2, h: WH, d: 2.2 },
        { x: x0 + 4.1, y: WH / 2, z: CW / 2 + 1.3, w: 2.2, h: WH, d: 2.2 },
      ];
      g.add(instanced(G.box, M.core, coreBoxes, { cast: true, receive: true }));

      const walls = [];
      const facade = [];
      const floorTiles = [];
      const tileColors = [];
      const furnWood = [];
      const furnFabric = [];
      const furnDark = [];
      const plates = [];
      const glows = [];
      const glowColors = [];
      const glowInfo = [];
      const cablePts = [];
      const roomFrames = [];

      // facade glass around the floor
      facade.push({ x: -L / 2 - CORE / 2 + L / 2 / 1, y: WH / 2, z: -depth / 2, w: L + CORE, h: WH, d: 0.05 });
      facade.push({ x: -L / 2 - CORE / 2 + L / 2 / 1, y: WH / 2, z: depth / 2, w: L + CORE, h: WH, d: 0.05 });
      facade.push({ x: L / 2, y: WH / 2, z: 0, w: 0.05, h: WH, d: depth });
      facade.push({ x: x0, y: WH / 2, z: 0, w: 0.05, h: WH, d: depth });
      facade[0].x = x0 + (L + CORE) / 2; facade[1].x = x0 + (L + CORE) / 2;

      const aps = new Map();
      for (const idf of fl.idfs) for (const ap of idf.aps) aps.set(ap.near, ap);

      fl.rooms.forEach((room, i) => {
        const f = roomFrame(i, n);
        roomFrames.push(f);
        const W = (lx, ly, lz, w, h, d) => { const p = toWorld(f, [lx, ly, lz]); return { x: p[0], y: p[1], z: p[2], w, h, d, ry: f.ry }; };
        // side wall (left), corridor wall with a door gap
        walls.push(W(-RW / 2, WH / 2, 0, T, WH, RD));
        if (i === cols - 1 || i === n - 1) walls.push(W(RW / 2, WH / 2, 0, T, WH, RD));
        const dA = RW / 2 - DOOR.to;
        const dB = RW / 2 - DOOR.from;
        walls.push(W((-RW / 2 + dA) / 2, WH / 2, RD / 2, dA + RW / 2, WH, T));
        walls.push(W((dB + RW / 2) / 2, WH / 2, RD / 2, RW / 2 - dB, WH, T));
        walls.push(W((dA + dB) / 2, WH - 0.4, RD / 2, dB - dA, 0.8, T)); // over the door
        const tile = W(0, 0.015, 0, RW - T, 0.03, RD - T);
        floorTiles.push(tile);
        tileColors.push(baseTile(profile));

        // furniture
        if (profile === 'hotel' || profile === 'residential') {
          furnFabric.push(W(-RW / 2 + 1.05, 0.28, -0.6, 1.6, 0.5, 2.0));
          furnWood.push(W(-RW / 2 + 1.05, 0.55, -1.7, 1.7, 1.0, 0.08));
          furnWood.push(W(RW / 2 - 0.3, 0.35, -0.3, 0.45, 0.7, 1.4));
          furnDark.push(W(RW / 2 - 0.08, 1.25, -0.3, 0.05, 0.62, 1.1));
        } else if (profile === 'school') {
          for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) furnWood.push(W(-0.8 + c * 1.6, 0.38, -1.2 + r * 1.1, 1.2, 0.04, 0.5));
          furnDark.push(W(RW / 2 - 0.08, 1.6, 0, 0.05, 1.0, 2.2));
        } else if (profile === 'hospital') {
          furnFabric.push(W(-RW / 2 + 0.75, 0.45, -0.7, 1.0, 0.25, 2.1));
          furnDark.push(W(-RW / 2 + 0.75, 0.25, -0.7, 0.9, 0.3, 1.9));
          furnDark.push(W(RW / 2 - 0.08, 1.25, -0.3, 0.05, 0.5, 0.9));
        } else {
          const desks = Math.max(1, Math.min(3, room.outlets.filter((o) => o.type === 'data').length));
          for (let d = 0; d < desks; d++) {
            const z = -1.6 + d * (desks > 1 ? 3.2 / (desks - 1) : 0);
            furnWood.push(W(-RW / 2 + 0.45, 0.74, Math.max(-1.9, Math.min(1.5, z)), 0.75, 0.04, 1.4));
            furnDark.push(W(-RW / 2 + 1.05, 0.45, Math.max(-1.9, Math.min(1.5, z)), 0.5, 0.9, 0.5));
            furnDark.push(W(-RW / 2 + 0.2, 1.0, Math.max(-1.9, Math.min(1.5, z)), 0.04, 0.32, 0.55));
          }
          furnWood.push(W(RW / 2 - 0.25, 1.0, -1.6, 0.4, 2.0, 1.2));
        }

        // points at their recommended positions
        const idf = fl.idfs.find((x) => x.id === room.idf);
        const rack = rackPos(fl, idf);
        const places = placements(profile, room, room.outlets, aps.get(room.no));
        room._places = places.map((p) => ({ ...p, world: toWorld(f, p.pos) }));
        room._frame = f;
        for (const p of room._places) {
          const [x, y, z] = p.world;
          const flat = p.type === 'ap';
          plates.push({ x, y, z, w: flat ? 0.26 : 0.09, h: flat ? 0.03 : 0.12, d: flat ? 0.26 : 0.09, ry: f.ry });
          glows.push({ x, y: y + (flat ? -0.04 : 0), z, w: flat ? 0.08 : 0.06, h: flat ? 0.08 : 0.06, d: flat ? 0.08 : 0.06 });
          glowColors.push(new THREE.Color(COLORS[p.type]).multiplyScalar(5));
          glowInfo.push({ p, room });
          // cable: cabinet → corridor ceiling → above the point → down the wall
          const door = toWorld(f, [(RW / 2 - (DOOR.from + DOOR.to) / 2), 0, RD / 2]);
          const yc = WH - 0.15;
          cablePts.push(rack[0], yc, rack[2], rack[0], yc, 0, rack[0], yc, 0, door[0], yc, 0, door[0], yc, 0, door[0], yc, door[2], door[0], yc, door[2], x, yc, z, x, yc, z, x, y, z);
        }
      });

      g.add(instanced(G.box, M.partition, walls));
      g.add(boxEdges(walls.filter((w) => w.h === WH)));
      g.add(instanced(G.box, M.facade, facade));
      const tiles = instanced(G.box, M.roomFloor, floorTiles, { receive: true, colors: tileColors });
      tiles.userData = { kind: 'rooms', fl, fi };
      g.add(tiles);
      state.picks.push(tiles);
      const furn = new THREE.Group();
      furn.add(instanced(G.box, M.wood, furnWood, { cast: true, receive: true }), instanced(G.box, M.fabric, furnFabric, { cast: true, receive: true }), instanced(G.box, M.dark, furnDark, { cast: true }));
      furn.visible = state.showFurniture;
      furn.userData.kind = 'furniture';
      g.add(furn);
      g.add(instanced(G.box, M.plate, plates));
      const gl = instanced(G.sphere, M.glow, glows, { colors: glowColors });
      gl.userData = { kind: 'markers', info: glowInfo };
      g.add(gl);
      state.markerPicks.push(gl);

      // corridor: cameras on the ceiling, printers in a niche
      const camBoxes = [];
      const camGlow = [];
      const camInfo = [];
      const corrItems = fl.idfs.flatMap((x) => [...x.cams.map((c) => ({ c, t: 'cam' })), ...x.printers.map((c) => ({ c, t: 'print' }))]);
      corrItems.forEach(({ c, t }, k) => {
        const x = -L / 2 + ((k + 0.5) / corrItems.length) * L;
        if (t === 'cam') {
          camBoxes.push({ x, y: WH - 0.08, z: 0, w: 0.16, h: 0.12, d: 0.16 });
          camGlow.push({ x, y: WH - 0.18, z: 0, w: 0.05, h: 0.05, d: 0.05 });
        } else {
          camBoxes.push({ x, y: 0.5, z: CW / 2 - 0.3, w: 0.5, h: 1.0, d: 0.45 });
          camGlow.push({ x, y: 1.05, z: CW / 2 - 0.3, w: 0.05, h: 0.05, d: 0.05 });
        }
        camInfo.push({ p: { o: c, type: t, wall: t === 'cam' ? 'תקרת המסדרון' : 'גומחה במסדרון', h: t === 'cam' ? Math.round((WH - 0.08) * 100) : 100, tip: t === 'cam' ? 'מצלמת כיפה בתקרת המסדרון, כיסוי מלא של הדלתות' : 'גומחה ליד ארון התקשורת' }, room: null });
      });
      if (camBoxes.length) {
        g.add(instanced(G.box, M.dark, camBoxes, { cast: true }));
        const cg = instanced(G.sphere, M.glow, camGlow, { colors: camInfo.map((c) => new THREE.Color(COLORS[c.p.type]).multiplyScalar(5)) });
        cg.userData = { kind: 'markers', info: camInfo };
        g.add(cg);
        state.markerPicks.push(cg);
      }

      // communication cabinets (IDF racks) with live LEDs, fiber to the core riser
      const fiberPts = [];
      fl.idfs.forEach((idf) => {
        const [rx, , rz] = rackPos(fl, idf);
        const rk = new THREE.Mesh(G.box, M.rack);
        rk.scale.set(0.8, 2.0, 0.6);
        rk.position.set(rx, 1.0, rz);
        rk.castShadow = true;
        rk.userData = { kind: 'rack', idf };
        g.add(rk);
        const leds = [];
        for (let u = 0; u < Math.min(10, idf.members * 2 + 2); u++) leds.push({ x: rx - 0.25 + (u % 5) * 0.12, y: 0.6 + Math.floor(u / 5) * 0.35 + (u % 2) * 0.05, z: rz + 0.31, w: 0.05, h: 0.02, d: 0.01 });
        g.add(instanced(G.box, M.led, leds));
        const lab = textSprite(idf.id, { size: 0.45, color: '#5fd4ea' });
        lab.position.set(rx, 2.4, rz);
        g.add(lab);
        fiberPts.push(rx, WH - 0.1, rz, rx, WH - 0.1, 0, rx, WH - 0.1, 0, x0 + 6, WH - 0.1, 0, x0 + 6, WH - 0.1, 0, x0 + 6, WH - 0.1, -1.0);
      });
      const fg = new THREE.BufferGeometry();
      fg.setAttribute('position', new THREE.Float32BufferAttribute(fiberPts, 3));
      g.add(new THREE.LineSegments(fg, M.fiber));
      const cg2 = new THREE.BufferGeometry();
      cg2.setAttribute('position', new THREE.Float32BufferAttribute(cablePts, 3));
      const cables = new THREE.LineSegments(cg2, M.cable);
      cables.visible = state.showCables;
      cables.userData.kind = 'cables';
      g.add(cables);

      // floor label
      const fl3 = textSprite(`קומה ${fl.label}`, { size: 1.1 });
      fl3.position.set(L / 2 + 3.2, 1.6, 0);
      g.add(fl3);

      g.userData.L = L;
      g.userData.x0 = x0;
      root.add(g);
      state.floors.push(g);
    });

    // riser shaft through all floors + MDF on a plinth
    const riser = new THREE.Mesh(G.disc, M.riser);
    const xr = -Lmax / 2 - CORE + 6;
    riser.userData.kind = 'riser';
    root.add(riser);
    state.riser = riser;
    state.riserX = xr;
    const mdf = new THREE.Group();
    const mdfBody = new THREE.Mesh(G.box, M.rack);
    mdfBody.scale.set(2.6, 2.1, 0.9);
    mdfBody.position.set(xr - 1.2, 1.05, -2.2);
    mdfBody.castShadow = true;
    const mdfLeds = [];
    for (let k = 0; k < 24; k++) mdfLeds.push({ x: xr - 2.3 + (k % 12) * 0.18, y: 0.5 + Math.floor(k / 12) * 0.9, z: -1.74, w: 0.08, h: 0.03, d: 0.01 });
    const mdfLab = textSprite('MDF · ליבה וחומת אש', { size: 0.6, color: '#e2c27d' });
    mdfLab.position.set(xr - 1.2, 2.7, -2.2);
    mdf.add(mdfBody, instanced(G.box, M.led, mdfLeds), mdfLab);
    mdf.userData.kind = 'mdf';
    root.add(mdf);
    state.mdf = mdf;

    layout();
    const span = Math.max(Lmax + CORE, 30);
    sun.position.set(span * 0.6, span * 1.1, span * 0.8);
    sun.target.position.set(0, 0, 0);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -span; sc.right = sc.top = span; sc.near = 1; sc.far = span * 4;
    sc.updateProjectionMatrix();
    state.span = span;
    state.depth = depth;
    if (!state.room) overview(true);
    renderSide();
  }

  function baseTile(profile) {
    return new THREE.Color(profile === 'hotel' || profile === 'residential' ? 0x6b5a4a : profile === 'hospital' ? 0x9fb3c8 : profile === 'school' ? 0x7b6a55 : 0x5d6678);
  }

  function rackPos(fl, idf) {
    const n = fl.rooms.length;
    const cols = Math.ceil(n / 2);
    const L = cols * RW;
    const idx = fl.rooms.findIndex((r) => r.id === idf.rooms[Math.floor(idf.rooms.length / 2)].id);
    const col = idx < cols ? idx : n - 1 - idx;
    const x = fl.idfs.length === 1 ? -L / 2 - 1.2 : -L / 2 + (Math.max(0, Math.min(cols - 1, col)) + 0.5) * RW;
    return [x, 1.0, -CW / 2 + 0.35];
  }

  // Floor heights (exploded view) and which floors are visible.
  function layout() {
    const sel = state.floor;
    const topVisible = state.room ? state.room._fi : Infinity;
    state.floors.forEach((g) => {
      const fi = g.userData.fi;
      g.position.y = fi * FH * state.explode;
      g.visible = (sel === 'all' || +sel === fi) && fi <= topVisible;
    });
    const top = (state.floors.length - 1) * FH * state.explode + WH;
    state.riser.scale.set(0.09, top + 0.3, 0.09);
    state.riser.position.set(state.riserX, (top - 0.3) / 2, -1.0);
    state.riser.visible = state.floor === 'all';
  }

  // ---------- camera moves
  function flyTo(pos, target, dur = 1.3) {
    if (reduceMotion()) { camera.position.copy(pos); controls.target.copy(target); controls.update(); return; }
    state.fly = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: target, t: 0, dur };
  }
  function overview(instant = false) {
    const nF = state.floors.length;
    const h = nF * FH * state.explode;
    const span = state.span || 40;
    const fi = state.floor === 'all' ? null : +state.floor;
    const cy = fi == null ? h / 2 : fi * FH * state.explode + 1;
    const dist = fi == null ? Math.max(span * 1.15, h * 1.4) : span * 0.9;
    const pos = new THREE.Vector3(dist * 0.75, cy + dist * (fi == null ? 0.45 : 0.75), dist * 0.85);
    const tgt = new THREE.Vector3(-CORE / 2, cy, 0);
    if (instant) { camera.position.copy(pos); controls.target.copy(tgt); controls.update(); } else flyTo(pos, tgt);
  }

  function enterRoom(room) {
    if (!room) return;
    const fi = state.floors.findIndex((g) => g.userData.fl.rooms.includes(room));
    room._fi = fi;
    state.room = room;
    controls.autoRotate = false;
    state.tour = false;
    layout();
    const y0 = fi * FH * state.explode;
    const f = room._frame;
    const eye = toWorld(f, [RW / 2 - 0.8, 1.65, RD / 2 - 0.6]);
    const look = toWorld(f, [-RW / 2 + 0.3, 0.9, -0.6]);
    flyTo(new THREE.Vector3(eye[0], y0 + eye[1], eye[2]), new THREE.Vector3(look[0], y0 + look[1], look[2]), 1.6);
    showLabels(room, y0);
    renderSide();
    opts.onRoom?.(room);
    stage.querySelector('.v3-hint').textContent = `חדר ${room.no} · גוררים כדי להסתכל מסביב · "חזרה לבניין" ליציאה`;
  }
  function exitRoom() {
    state.room = null;
    clearLabels();
    layout();
    overview();
    renderSide();
    stage.querySelector('.v3-hint').textContent = 'גוררים לסיבוב · גלגלת לזום · לחיצה על חדר כדי להיכנס אליו';
  }

  function clearLabels() {
    for (const l of state.labels) l.parent?.remove(l);
    state.labels = [];
  }
  function showLabels(room, y0) {
    clearLabels();
    room._places.forEach((p, i) => {
      const el = document.createElement('div');
      el.className = 'v3-pin';
      el.style.setProperty('--c', `#${new THREE.Color(COLORS[p.type]).getHexString()}`);
      el.innerHTML = `<b>${esc(p.type === 'ap' ? p.o.label : p.o.label)}</b><span>${esc(HE[p.type])} · ${esc(p.o.ip || '')}</span><span>${p.h} ס״מ · ${esc(p.wall)}</span>`;
      const obj = new CSS2DObject(el);
      // stagger neighbouring points so their tags don't cover each other
      obj.position.set(p.world[0], y0 + p.world[1] + 0.2 + (i % 3) * 0.28, p.world[2]);
      scene.add(obj);
      state.labels.push(obj);
    });
  }

  // ---------- side panel
  function renderSide() {
    const b = plan.buildings[state.building] || plan.buildings[0];
    if (state.room) {
      const r = state.room;
      side.innerHTML = `
        <div class="v3-side-head"><span class="eyebrow">בתוך החדר</span><h3>חדר ${esc(r.no)}</h3>
          <p class="small muted">קומה ${esc(b.floors[r.floor].label)} · ארון <span class="ltr">${esc(r.idf)}</span> · ${r._places.length} נקודות</p></div>
        <ol class="v3-points">${r._places.map((p) => `
          <li style="--c:#${new THREE.Color(COLORS[p.type]).getHexString()}">
            <div class="v3-pt-title"><i></i><b class="ltr">${esc(p.o.label)}</b><span class="muted small">${esc(HE[p.type])}</span></div>
            <div class="small"><b>היכן:</b> ${esc(p.wall)}, גובה ${p.h} ס״מ</div>
            <div class="small">${esc(p.tip)}</div>
            <div class="small ip">${esc(p.o.ip || '')}${p.o.vlan ? ` · VLAN ${p.o.vlan}` : ''}${p.o.patch ? ` · ${esc(p.o.patch)}` : ''}</div>
            ${p.type !== 'ap' && opts.onEdit ? `<button class="btn sm ghost" data-v3edit="${esc(p.o.label)}">✎ עריכת כתובת</button>` : ''}
          </li>`).join('')}</ol>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
          <button class="btn sm primary" data-v3="exit">חזרה לבניין</button>
          ${opts.onCard ? `<button class="btn sm" data-v3card="${esc(r.id)}">כרטיס חדר</button>` : ''}
        </div>`;
      return;
    }
    const f = state.floor === 'all' ? null : b.floors[+state.floor];
    const totalPts = b.floors.reduce((a, fl) => a + fl.rooms.reduce((x, r) => x + (r._places?.length || 0), 0), 0);
    side.innerHTML = `
      <div class="v3-side-head"><span class="eyebrow">הדמיה</span><h3>${esc(b.name)}</h3>
        <p class="small muted">${b.floors.length} קומות · ${b.roomCount} חדרים · ${totalPts} נקודות בחדרים</p></div>
      <ul class="v3-legend">${Object.keys(COLORS).map((k) => `<li><i style="background:#${new THREE.Color(COLORS[k]).getHexString()}"></i>${HE[k]}</li>`).join('')}
        <li><i style="background:#ffc861"></i>סיב לארון הראשי</li><li><i style="background:#5fd4ea"></i>כבל נחושת לנקודה</li></ul>
      ${f ? `<h4 style="margin:12px 0 6px">חדרים בקומה ${esc(f.label)}</h4><div class="v3-rooms">${f.rooms.map((r) => `<button class="btn sm" data-v3room="${esc(r.id)}" aria-label="כניסה לחדר ${esc(r.no)}">${esc(r.no)}</button>`).join('')}</div>`
        : '<p class="small muted" style="margin-top:10px">בחרו קומה כדי לראות את רשימת החדרים, או לחצו על חדר במודל.</p>'}
      <p class="small muted" style="margin-top:10px">המיקומים בחדר הם המלצה: שקעי מחשב ליד עמדת העבודה, בקר ליד הדלת, מסך מול המיטה או הישיבה, ונקודת גישה במרכז התקרה. אפשר להתאים אותם לתוכנית האדריכלית.</p>`;
  }
  side.addEventListener('click', (e) => {
    const r = e.target.closest('[data-v3room]');
    if (r) { const room = findRoom(r.dataset.v3room); enterRoom(room); return; }
    if (e.target.closest('[data-v3="exit"]')) { exitRoom(); return; }
    const ed = e.target.closest('[data-v3edit]');
    if (ed) { opts.onEdit?.(ed.dataset.v3edit); return; }
    const card = e.target.closest('[data-v3card]');
    if (card) opts.onCard?.(card.dataset.v3card);
  });
  const findRoom = (id) => plan.buildings[state.building].floors.flatMap((f) => f.rooms).find((r) => r.id === id);

  // ---------- picking
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tip = stage.querySelector('.v3-tip');
  let pending = null;
  function pick(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const vis = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
    const mk = ray.intersectObjects(state.markerPicks.filter(vis), false)[0];
    const rm = ray.intersectObjects(state.picks.filter(vis), false)[0];
    if (mk && (!rm || mk.distance <= rm.distance + 0.5)) return { kind: 'marker', info: mk.object.userData.info[mk.instanceId] };
    if (rm) return { kind: 'room', mesh: rm.object, id: rm.instanceId, room: rm.object.userData.fl.rooms[rm.instanceId] };
    return null;
  }
  function setHover(h, ev) {
    const prev = state.hoverRoom;
    if (prev && (!h || h.kind !== 'room' || h.room !== prev.room)) {
      prev.mesh.setColorAt(prev.id, baseTile(plan.cfg.profile));
      prev.mesh.instanceColor.needsUpdate = true;
      state.hoverRoom = null;
    }
    if (h?.kind === 'room' && !state.room) {
      h.mesh.setColorAt(h.id, new THREE.Color(0x2aa7c4));
      h.mesh.instanceColor.needsUpdate = true;
      state.hoverRoom = h;
      tip.innerHTML = `<b>חדר ${esc(h.room.no)}</b><br>${h.room._places.length} נקודות · <span class="ltr">${esc(h.room.idf)}</span><br><span class="muted">לחיצה לכניסה</span>`;
    } else if (h?.kind === 'marker') {
      const { p } = h.info;
      tip.innerHTML = `<b class="ltr">${esc(p.o.label)}</b> · ${esc(HE[p.type])}<br><span class="ltr">${esc(p.o.ip || '')}</span>${p.o.vlan ? ` · VLAN ${p.o.vlan}` : ''}<br>${esc(p.wall)} · ${p.h} ס״מ`;
    }
    if (h && (h.kind === 'marker' || !state.room)) {
      const r = stage.getBoundingClientRect();
      tip.hidden = false;
      tip.style.left = `${Math.min(r.width - 220, ev.clientX - r.left + 14)}px`;
      tip.style.top = `${Math.max(8, ev.clientY - r.top - 10)}px`;
      renderer.domElement.style.cursor = 'pointer';
    } else {
      tip.hidden = true;
      renderer.domElement.style.cursor = '';
    }
  }
  renderer.domElement.addEventListener('pointermove', (ev) => {
    if (walk.isLocked) return;
    if (pending) return;
    pending = requestAnimationFrame(() => { pending = null; setHover(pick(ev), ev); });
  });
  renderer.domElement.addEventListener('pointerleave', () => { tip.hidden = true; });
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (ev) => { down = [ev.clientX, ev.clientY]; });
  renderer.domElement.addEventListener('pointerup', (ev) => {
    if (!down || Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) > 5 || walk.isLocked) return;
    const h = pick(ev);
    if (h?.kind === 'room' && h.room !== state.room) enterRoom(h.room);
  });

  // ---------- walk mode (first person)
  const walkHint = stage.querySelector('.v3-walk');
  walk.addEventListener('lock', () => { controls.enabled = false; walkHint.hidden = true; });
  walk.addEventListener('unlock', () => {
    controls.enabled = true;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    controls.target.copy(camera.position).addScaledVector(dir, 3);
    walkHint.hidden = true;
  });
  const onKey = (down2) => (e) => { state.keys[e.code] = down2; };
  window.addEventListener('keydown', onKey(true));
  window.addEventListener('keyup', onKey(false));
  function startWalk() {
    const fi = state.room ? state.room._fi : (state.floor === 'all' ? 0 : +state.floor);
    const y = fi * FH * state.explode + 1.65;
    if (!state.room) {
      const g = state.floors[fi];
      camera.position.set(g.userData.x0 + CORE + 1, y, 0);
      controls.target.set(camera.position.x + 5, y, 0);
      camera.lookAt(controls.target);
    } else {
      camera.position.y = y;
    }
    state.walkY = y;
    walkHint.hidden = false;
  }
  walkHint.addEventListener('click', () => walk.lock());

  // ---------- VR
  const vrBtn = VRButton.createButton(renderer);
  vrBtn.classList.add('v3-vr');
  stage.append(vrBtn);
  const vrText = { 'VR NOT SUPPORTED': 'VR: לא זוהו משקפיים', 'ENTER VR': 'כניסה ל-VR', 'EXIT VR': 'יציאה מ-VR', 'VR NOT ALLOWED': 'VR: נדרש חיבור מאובטח' };
  const tr = () => { const t = vrText[vrBtn.textContent.trim()]; if (t) vrBtn.textContent = t; };
  new MutationObserver(tr).observe(vrBtn, { childList: true, characterData: true, subtree: true });
  tr();
  renderer.xr.addEventListener('sessionstart', () => {
    const p = camera.position.clone();
    const fi = state.room ? state.room._fi : 0;
    dolly.position.set(p.x, fi * FH * state.explode, p.z);
    dolly.add(camera);
    camera.position.set(0, 0, 0);
  });
  renderer.xr.addEventListener('sessionend', () => {
    scene.add(camera);
    camera.position.copy(dolly.position).add(new THREE.Vector3(0, 1.6, 0));
    controls.update();
  });

  // ---------- loop
  const clock = new THREE.Timer();
  let tourT = 0;
  function frame(time) {
    clock.update(time);
    const raw = clock.getDelta();
    const dt = Math.min(0.05, raw);
    if (state.fly) {
      const f = state.fly;
      f.t += Math.min(raw, 0.25) / f.dur; // real time, so slow GPUs still finish the move on schedule
      const k = ease(Math.min(1, f.t));
      camera.position.lerpVectors(f.p0, f.p1, k);
      controls.target.lerpVectors(f.t0, f.t1, k);
      if (f.t >= 1) state.fly = null;
    }
    if (walk.isLocked) {
      const sp = (state.keys.ShiftLeft || state.keys.ShiftRight ? 6 : 2.6) * dt;
      if (state.keys.KeyW || state.keys.ArrowUp) walk.moveForward(sp);
      if (state.keys.KeyS || state.keys.ArrowDown) walk.moveForward(-sp);
      if (state.keys.KeyA || state.keys.ArrowLeft) walk.moveRight(-sp);
      if (state.keys.KeyD || state.keys.ArrowRight) walk.moveRight(sp);
      camera.position.y = state.walkY;
    } else if (!renderer.xr.isPresenting) {
      controls.update();
    }
    if (state.tour && !state.room) {
      tourT += dt;
      const nF = state.floors.length;
      const active = Math.floor(tourT / 2.5) % nF;
      state.floors.forEach((g, i) => { g.children.forEach((c) => { if (c.userData.kind === 'cables') c.visible = state.showCables || i === active; }); });
    }
    // LED shimmer on cabinets
    M.led.color.setHSL(0.53, 0.8, 0.55 + 0.25 * Math.sin(performance.now() / 260));
    M.led.color.multiplyScalar(4);
    if (renderer.xr.isPresenting) renderer.render(scene, camera);
    else composer.render();
    labelRenderer.render(scene, camera);
  }
  renderer.setAnimationLoop(frame);

  function resize() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloom.setSize(w, h);
    labelRenderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  resize();

  build();

  return {
    setPlan(p) { plan = p; state.room = null; build(); },
    setBuilding(i) { state.building = i; state.floor = 'all'; state.room = null; build(); },
    setFloor(f) { state.floor = f; if (state.room) { state.room = null; clearLabels(); } layout(); overview(); renderSide(); },
    setExplode(x) { state.explode = x; layout(); if (state.room) enterRoom(state.room); },
    toggle(kind, on) {
      if (kind === 'cables') state.showCables = on;
      if (kind === 'furniture') state.showFurniture = on;
      state.floors.forEach((g) => g.children.forEach((c) => { if (c.userData.kind === kind) c.visible = on; }));
    },
    tour(on) { state.tour = on; controls.autoRotate = on; if (on) { if (state.room) exitRoom(); else overview(); } else state.floors.forEach((g) => g.children.forEach((c) => { if (c.userData.kind === 'cables') c.visible = state.showCables; })); },
    overview() { if (state.room) exitRoom(); else overview(); },
    walk: startWalk,
    enterRoomById(id) { const r = findRoom(id); if (r) enterRoom(r); },
    screenshot() { composer.render(); return renderer.domElement.toDataURL('image/png'); },
    resize,
    pause() { renderer.setAnimationLoop(null); },
    resume() { resize(); renderer.setAnimationLoop(frame); },
    destroy() {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      walk.disconnect?.();
      renderer.dispose();
      stage.querySelectorAll('canvas, .v3-labels, .v3-vr').forEach((x) => x.remove());
    },
  };
}
