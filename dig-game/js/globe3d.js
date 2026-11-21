/* שכבות — the globe of the world expedition: NASA's Earth on a sphere, a glow of atmosphere, stars, and a pin on
   every real site. Drag to turn, pinch or wheel to zoom, tap a pin to choose it. */
import * as THREE from 'three';

let renderer, scene, camera, globe, raf = 0, host = null, ro = null, pins = [], H = {}, label = null;
let rotX = 0.35, rotY = -2.2, velX = 0, velY = 0, dist = 3.2, goal = null, idle = 0, selected = null;
const R = 1;

// latitude and longitude on the sphere (the same mapping as the Earth photo on a THREE.SphereGeometry)
function toVec(lat, lon, r = R) {
  const phi = (90 - lat) * Math.PI / 180, theta = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

function start(el, sites, handlers = {}) {
  stop();
  host = el; H = handlers;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#03060d');
  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);

  // stars
  const sg = new THREE.BufferGeometry(), sp = new Float32Array(1800 * 3);
  for (let i = 0; i < 1800; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(30 + Math.random() * 20); sp.set([v.x, v.y, v.z], i * 3); }
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#dfe8ff', size: 0.08, sizeAttenuation: true, transparent: true, opacity: 0.85 })));

  // the Earth (NASA, public domain)
  globe = new THREE.Group();
  const big = Math.max(innerWidth, innerHeight) * Math.min(devicePixelRatio || 1, 2) > 1400;
  const ph = window.SHCHAVOT_WORLD_PHOTOS;
  const tex = new THREE.TextureLoader().load(big ? ph.earth.src.replace('2k', '4k') : ph.earth.src);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0 }));
  globe.add(earth);
  // a thin glow of atmosphere at the rim
  const atm = new THREE.Mesh(new THREE.SphereGeometry(R * 1.035, 64, 48), new THREE.ShaderMaterial({
    transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vec4 p = modelViewMatrix * vec4(position,1.); vP = p.xyz; gl_Position = projectionMatrix * p; }',
    fragmentShader: 'varying vec3 vN; varying vec3 vP; void main(){ float f = pow(1. - abs(dot(vN, normalize(-vP))), 2.2); gl_FragColor = vec4(.35,.62,1., 1.) * f * 1.4; }',
  }));
  scene.add(atm);
  scene.add(new THREE.AmbientLight('#ffffff', 1.4));
  const sun = new THREE.DirectionalLight('#fff6e8', 1.6); sun.position.set(3, 2, 4); scene.add(sun);

  // pins
  pins = sites.map((s) => {
    const g = new THREE.Group();
    const found = H.isFound && H.isFound(s.id);
    const col = found ? '#f2c14e' : s.region === 'il' ? '#7fe0ff' : '#ff6a4d';
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.06, 6), new THREE.MeshBasicMaterial({ color: '#f4ecd8' }));
    stick.position.y = 0.03;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.014, 14, 10), new THREE.MeshBasicMaterial({ color: col }));
    head.position.y = 0.062;
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.05; hit.userData.site = s;
    g.add(stick, head, hit);
    g.position.copy(toVec(s.lat, s.lon));
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), g.position.clone().normalize());
    globe.add(g);
    return { s, g, head, hit };
  });
  scene.add(globe);

  label = document.createElement('div');
  label.className = 'globe-label'; el.appendChild(label);

  bind(el);
  resize();
  ro = new ResizeObserver(resize); ro.observe(el);
  tick();
  return true;
}

function resize() {
  if (!renderer || !host) return;
  const w = host.clientWidth || innerWidth, h = host.clientHeight || innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}

function bind(el) {
  const c = renderer.domElement;
  const pts = new Map();
  let downAt = null, moved = 0, pinch0 = 0, dist0 = dist;
  c.addEventListener('pointerdown', (e) => {
    c.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; moved = 0; goal = null; idle = 0;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); dist0 = dist; }
  });
  c.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) { hover(e); return; }
    if (pts.size === 2) {
      p.x = e.clientX; p.y = e.clientY;
      const [a, b] = [...pts.values()];
      dist = THREE.MathUtils.clamp(dist0 * pinch0 / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), 1.6, 5);
      return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    const k = 0.005 * (dist - 0.9) / 2.3;
    velY = dx * k; velX = dy * k;
    rotY += velY; rotX = THREE.MathUtils.clamp(rotX + velX, -1.3, 1.3);
  });
  const up = (e) => {
    pts.delete(e.pointerId);
    if (downAt && moved < 8 && performance.now() - downAt.t < 500) pick(e);
    downAt = null;
  };
  c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  c.addEventListener('wheel', (e) => { e.preventDefault(); dist = THREE.MathUtils.clamp(dist * (1 + Math.sign(e.deltaY) * 0.08), 1.6, 5); }, { passive: false });
}

const ray = new THREE.Raycaster();
function hitAt(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  const hits = ray.intersectObjects(pins.map((p) => p.hit), false);
  // a pin on the far side of the Earth doesn't count
  for (const h of hits) { const n = h.object.getWorldPosition(new THREE.Vector3()).normalize(); if (n.dot(camera.position.clone().normalize()) > 0.15) return h.object.userData.site; }
  return null;
}
function hover(e) {
  const s = hitAt(e);
  renderer.domElement.style.cursor = s ? 'pointer' : 'grab';
}
function pick(e) {
  const s = hitAt(e);
  if (s) { select(s.id); H.onPick && H.onPick(s); }
}

// turn the Earth so a site faces the camera
function focus(id) {
  const p = pins.find((x) => x.s.id === id);
  if (!p) return;
  const lat = p.s.lat * Math.PI / 180, lon = p.s.lon * Math.PI / 180;
  goal = { x: lat, y: -lon - Math.PI / 2 };
  // take the short way round
  while (goal.y - rotY > Math.PI) goal.y -= Math.PI * 2;
  while (goal.y - rotY < -Math.PI) goal.y += Math.PI * 2;
  dist = Math.min(dist, 2.6);
  select(id);
}
function select(id) {
  selected = id;
  for (const p of pins) p.head.scale.setScalar(p.s.id === id ? 1.9 : 1);
}
function setFound(id) {
  const p = pins.find((x) => x.s.id === id);
  if (p) p.head.material.color.set('#f2c14e');
}

function tick() {
  raf = requestAnimationFrame(tick);
  if (goal) {
    rotX += (goal.x - rotX) * 0.08; rotY += (goal.y - rotY) * 0.08;
    if (Math.abs(goal.x - rotX) + Math.abs(goal.y - rotY) < 0.002) goal = null;
  } else {
    velX *= 0.92; velY *= 0.92;
    if (Math.abs(velY) > 1e-4) { rotY += velY; rotX = THREE.MathUtils.clamp(rotX + velX, -1.3, 1.3); }
    idle += 1;
    if (idle > 240 && !selected) rotY += 0.0012; // a slow turn while nobody touches it
  }
  globe.rotation.set(rotX, rotY, 0, 'XYZ');
  camera.position.set(0, 0, dist); camera.lookAt(0, 0, 0);
  // the name of the chosen site floats over its pin
  const p = pins.find((x) => x.s.id === selected);
  if (p && label) {
    const w = p.head.getWorldPosition(new THREE.Vector3());
    const facing = w.clone().normalize().dot(camera.position.clone().normalize()) > 0.2;
    const v = w.project(camera), r = renderer.domElement.getBoundingClientRect();
    label.textContent = `${p.s.flag} ${p.s.name}`;
    label.style.opacity = facing ? 1 : 0;
    label.style.transform = `translate(${(v.x * 0.5 + 0.5) * r.width}px, ${(-v.y * 0.5 + 0.5) * r.height}px) translate(-50%, -150%)`;
  } else if (label) label.style.opacity = 0;
  renderer.render(scene, camera);
}

function stop() {
  cancelAnimationFrame(raf); raf = 0;
  if (ro) { ro.disconnect(); ro = null; }
  if (renderer) { renderer.domElement.remove(); renderer.dispose(); }
  if (label) label.remove();
  renderer = null; scene = null; host = null; pins = []; label = null; selected = null;
}

window.GLOBE3D = { start, stop, focus, select, setFound, supported: !!window.WebGL2RenderingContext };
window.dispatchEvent(new Event('globe3d-ready'));
