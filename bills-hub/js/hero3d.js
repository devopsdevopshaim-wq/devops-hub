// The 3D scene at the top: a small house on a disc, the three utilities (electricity, water, gas) circling it,
// and coins rising from it. An orb turns red and pulses while that utility has a late bill (event 'bills:status').
// three.js 0.186.1 from the import map; any failure leaves the drawn picture (.hero.no3d) in place.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const hero = document.querySelector('.hero');
const canvas = document.getElementById('hero3d');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function webgl() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}

if (hero && canvas && webgl()) {
  try { start(); } catch (e) { hero.classList.add('no3d'); }
} else if (hero) hero.classList.add('no3d');

function start() {
  let running = false, visible = true, last = performance.now(), clock = 0;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(7.2, 5.2, 8.4);
  camera.lookAt(0, 1.1, 0);

  scene.add(new THREE.HemisphereLight(0xdff6ef, 0x0d2422, 0.55));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.1);
  sun.position.set(5, 9, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -5; sun.shadow.camera.right = 5; sun.shadow.camera.top = 5; sun.shadow.camera.bottom = -5;
  sun.shadow.bias = -0.0008;
  scene.add(sun);

  const world = new THREE.Group();
  scene.add(world);

  const std = (color, o) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.62, metalness: 0.05 }, o || {}));

  // the disc it stands on, with a brass rim
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.45, 0.28, 72), std(0x15403d, { roughness: 0.85 }));
  disc.position.y = -0.14;
  disc.receiveShadow = true;
  world.add(disc);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(3.38, 0.035, 12, 120), std(0xe9b949, { metalness: 0.9, roughness: 0.28 }));
  rim.rotation.x = Math.PI / 2;
  world.add(rim);
  const lawn = new THREE.Mesh(new THREE.CylinderGeometry(3.05, 3.05, 0.04, 72), std(0x2f7d5d, { roughness: 0.95 }));
  lawn.position.y = 0.02;
  lawn.receiveShadow = true;
  world.add(lawn);

  // the house
  const house = new THREE.Group();
  world.add(house);
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.45, 1.8), std(0xf3ede2));
  body.position.y = 0.76;
  house.add(body);
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-1.32, 0); roofShape.lineTo(1.32, 0); roofShape.lineTo(0, 1.02); roofShape.closePath();
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(roofShape, { depth: 2.06, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 }), std(0xc4573f, { roughness: 0.55 }));
  roof.position.set(0, 1.47, -1.03);
  house.add(roof);
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.6, 0.26), std(0x8f3d2c));
  chimney.position.set(0.62, 2.05, -0.35);
  house.add(chimney);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.78, 0.05), std(0x0f5c55, { roughness: 0.4 }));
  door.position.set(-0.45, 0.43, 0.91);
  house.add(door);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 12), std(0xe9b949, { metalness: 1, roughness: 0.2 }));
  knob.position.set(-0.31, 0.44, 0.95);
  house.add(knob);
  const glow = std(0xffd88a, { emissive: 0xffc35a, emissiveIntensity: 0.9, roughness: 0.3 });
  [[0.45, 0.9, 0.91, 0.5, 0.42], [1.11, 0.85, 0.35, 0.05, 0.4], [-1.11, 0.85, -0.3, 0.05, 0.4]].forEach(([x, y, z, w, h], i) => {
    const win = new THREE.Mesh(new THREE.BoxGeometry(i ? 0.05 : w, h, i ? 0.46 : 0.05), glow);
    win.position.set(x, y, z);
    house.add(win);
  });
  // a meter box on the wall, with its little dial
  const meter = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.08), std(0xdfe7e5, { metalness: 0.3, roughness: 0.35 }));
  meter.position.set(0.98, 0.62, 0.95);
  house.add(meter);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.1, 24), std(0x0f5c55, { emissive: 0x2ad1b2, emissiveIntensity: 0.6 }));
  dial.position.set(0.98, 0.66, 1.0);
  house.add(dial);
  // a path and two shrubs
  const path = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.03, 1.5), std(0xd9cdb6, { roughness: 0.9 }));
  path.position.set(-0.45, 0.05, 1.68);
  path.receiveShadow = true;
  world.add(path);
  [[-1.45, 1.25, 0.32], [1.55, 1.15, 0.26], [1.9, -1.4, 0.36]].forEach(([x, z, r]) => {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), std(0x3f9d6c, { flatShading: true, roughness: 0.8 }));
    b.position.set(x, r * 0.85, z);
    b.castShadow = true;
    world.add(b);
  });
  house.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  // the three utilities, circling the house
  function bolt() {
    const s = new THREE.Shape();
    s.moveTo(0.06, 0.32); s.lineTo(-0.16, -0.02); s.lineTo(-0.01, -0.02); s.lineTo(-0.08, -0.32); s.lineTo(0.16, 0.06); s.lineTo(0.01, 0.06); s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.09, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
  }
  function drop() {
    // a tear: the lower part of a circle, then straight to a point at the top
    const prof = [];
    for (let i = 0; i <= 20; i++) {
      const a = -Math.PI / 2 + (i / 20) * (Math.PI / 2 + 0.5);
      prof.push(new THREE.Vector2(Math.max(0.0001, Math.cos(a) * 0.2), Math.sin(a) * 0.2));
    }
    prof.push(new THREE.Vector2(0.0001, 0.38));
    return new THREE.LatheGeometry(prof, 32);
  }
  function flame() {
    const prof = [];
    for (let i = 0; i <= 30; i++) {
      const t = i / 30, y = -0.18 + t * 0.5;
      prof.push(new THREE.Vector2(Math.max(0.0001, 0.17 * Math.sin(Math.PI * Math.pow(t, 0.7)) * (1 - t * 0.35)), y));
    }
    return new THREE.LatheGeometry(prof, 28);
  }
  const UTIL = [
    { type: 'elec', geo: bolt(), color: 0xffd23f, emissive: 0xffb800, r: 2.55, y: 2.25, speed: 0.32, phase: 0 },
    { type: 'water', geo: drop(), color: 0x5cc8ff, emissive: 0x1a8fd6, r: 2.75, y: 1.65, speed: 0.26, phase: 2.1 },
    { type: 'gas', geo: flame(), color: 0xff8a3d, emissive: 0xff5a1f, r: 2.45, y: 1.2, speed: 0.38, phase: 4.2 }
  ];
  const RED = new THREE.Color(0xff3b3b);
  UTIL.forEach((u) => {
    u.mat = new THREE.MeshStandardMaterial({ color: u.color, emissive: u.emissive, emissiveIntensity: 0.55, metalness: 0.15, roughness: 0.25 });
    u.base = new THREE.Color(u.emissive);
    u.mesh = new THREE.Mesh(u.geo, u.mat);
    u.mesh.castShadow = true;
    if (u.type === 'elec') u.mesh.geometry.center();
    u.halo = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.02, 10, 48), new THREE.MeshBasicMaterial({ color: u.color, transparent: true, opacity: 0.5 }));
    u.group = new THREE.Group();
    u.group.add(u.mesh, u.halo);
    world.add(u.group);
    u.late = false;
  });
  // the orbit line they ride on
  const orbit = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.008, 6, 160), new THREE.MeshBasicMaterial({ color: 0xe9b949, transparent: true, opacity: 0.35 }));
  orbit.rotation.x = Math.PI / 2;
  orbit.position.y = 1.7;
  world.add(orbit);

  // coins rising from the chimney side and fading at the top
  const coinGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.045, 36);
  const coinMat = new THREE.MeshStandardMaterial({ color: 0xe9b949, metalness: 0.95, roughness: 0.22 });
  const coins = [];
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(coinGeo, coinMat);
    m.castShadow = true;
    m.userData = { t: i / 7, a: i * 0.9, r: 0.55 + (i % 3) * 0.28 };
    coins.push(m);
    world.add(m);
  }

  world.rotation.y = -0.35;

  // pointer: a gentle tilt toward the pointer; drag turns the scene
  let tx = 0, ty = 0, drag = null, spin = 0, spinV = 0;
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    if (drag !== null) { spinV = (e.clientX - drag) * 0.006; spin += spinV; drag = e.clientX; }
  });
  canvas.addEventListener('pointerdown', (e) => { drag = e.clientX; canvas.setPointerCapture(e.pointerId); });
  const end = () => { drag = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; });

  // late bills from the payments list
  window.addEventListener('bills:status', (e) => {
    const late = (e.detail && e.detail.late) || [];
    UTIL.forEach((u) => { u.late = late.indexOf(u.type) >= 0; });
    if (!running) frame(performance.now());
  });
  if (window.__billsStatus) window.dispatchEvent(new CustomEvent('bills:status', { detail: window.__billsStatus }));

  function size() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole disc in view on a narrow phone
    camera.position.setLength(w / h < 0.9 ? 15.5 : w / h < 1.3 ? 13.4 : 12.2);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(() => { size(); if (!running) frame(performance.now()); }).observe(canvas);
  size();

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!reduce) clock += dt;
    const t = reduce ? 1.6 : clock;
    spinV *= 0.94;
    if (drag === null) spin += spinV + (reduce ? 0 : dt * 0.12);
    world.rotation.y += (-0.35 + spin + tx * 0.25 - world.rotation.y) * 0.08;
    world.rotation.x += (ty * 0.06 - world.rotation.x) * 0.08;

    UTIL.forEach((u, i) => {
      const a = t * u.speed + u.phase;
      u.group.position.set(Math.cos(a) * u.r, u.y + Math.sin(t * 1.3 + i) * 0.12, Math.sin(a) * u.r);
      u.mesh.rotation.y = t * 1.2 + i;
      u.halo.lookAt(camera.position);
      const pulse = u.late ? 0.5 + 0.5 * Math.sin(t * 6) : 0;
      u.mat.emissive.copy(u.base).lerp(RED, u.late ? 0.85 : 0);
      u.mat.emissiveIntensity = 0.55 + pulse * 0.9;
      u.halo.material.color.set(u.late ? 0xff4d4d : u.color);
      u.halo.scale.setScalar(1 + pulse * 0.35);
      u.halo.material.opacity = u.late ? 0.35 + pulse * 0.5 : 0.45;
    });
    coins.forEach((c) => {
      const d = c.userData;
      const k = (d.t + t * 0.09) % 1;
      c.position.set(0.62 + Math.cos(d.a + k * 4) * d.r * k, 2.4 + k * 2.4, -0.35 + Math.sin(d.a + k * 4) * d.r * k);
      c.rotation.set(Math.PI / 2 * 0.85, t * 2 + d.a, 0);
      c.scale.setScalar(Math.min(1, k * 6) * (1 - Math.max(0, k - 0.75) * 4));
    });
    glow.emissiveIntensity = 0.85 + Math.sin(t * 0.8) * 0.1;

    renderer.render(scene, camera);
    hero.classList.add('ready');
    running = !reduce && visible && !document.hidden;
    if (running) requestAnimationFrame(frame);
  }
  function wake() {
    const go = !reduce && visible && !document.hidden;
    if (go && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
  }
  new IntersectionObserver((en) => { visible = en[0].isIntersecting; wake(); }).observe(hero);
  document.addEventListener('visibilitychange', wake);
  frame(performance.now());
}
