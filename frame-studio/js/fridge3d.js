/* The entry scene: a brushed-steel fridge door under a camera flash. The magnets the studio itself designs fly in from
   the camera, snap onto the door with a magnetic spring, cast soft shadows, and lean towards the pointer.
   ES module on three.js; the page passes the magnet pictures (canvases). window.Fridge3D.mount(canvas, magnets, opts). */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

function brushed(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.fillStyle = '#a9adb6'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) { const y = Math.random() * h, l = 40 + Math.random() * 260, a = Math.random() * 0.08; x.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(40,44,52,${a})`; x.fillRect(Math.random() * w - 40, y, l, 1); }
  const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(0,0,0,.10)'); g.addColorStop(0.45, 'rgba(255,255,255,.10)'); g.addColorStop(1, 'rgba(0,0,0,.14)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  return c;
}
const ease = (t) => 1 - Math.pow(1 - t, 3);
/* a damped spring from 0 to 1 with one soft overshoot: the magnet "clicks" on */
const snap = (t) => t >= 1 ? 1 : 1 - Math.exp(-7 * t) * Math.cos(11 * t);

function mount(canvas, magnets, opts = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.32;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  const camHome = new THREE.Vector3(opts.camX || 0, 0, 7.2); camera.position.copy(camHome);

  /* everything on the door turns a little towards the words beside it */
  const world = new THREE.Group(); world.rotation.set(0.03, opts.turn != null ? opts.turn : -0.2, 0); scene.add(world);
  /* the door */
  const doorW = 4.6, doorH = 5.6;
  const tex = new THREE.CanvasTexture(brushed(1024, 1024)); tex.colorSpace = THREE.SRGBColorSpace;
  const door = new THREE.Mesh(new RoundedBoxGeometry(doorW, doorH, 0.3, 6, 0.12), new THREE.MeshPhysicalMaterial({ map: tex, metalness: 0.55, roughness: 0.42, clearcoat: 0.2, clearcoatRoughness: 0.55 }));
  door.position.z = -0.15; door.receiveShadow = true; world.add(door);
  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 1.9, 8, 24), new THREE.MeshPhysicalMaterial({ color: 0xe9ebef, metalness: 1, roughness: 0.18 }));
  handle.position.set(-doorW / 2 + 0.3, 0.4, 0.18); handle.castShadow = true; world.add(handle);
  [-1, 1].forEach((s) => { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 16), handle.material); f.rotation.x = Math.PI / 2; f.position.set(-doorW / 2 + 0.3, 0.4 + s * 0.85, 0.08); world.add(f); });
  const group = new THREE.Group(); world.add(group);

  /* light: a soft key from the top (the "flash" pulses it), a cool fill, a warm rim */
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x1a1024, 0.35));
  const key = new THREE.SpotLight(0xfff1dc, 26, 30, Math.PI / 5, 0.65, 1.6); key.position.set(-2.4, 3.4, 6); key.target.position.set(0, -0.2, 0); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.radius = 6; scene.add(key, key.target);
  const rim = new THREE.PointLight(0xe7cf9c, 6, 12); rim.position.set(3.2, -2.2, 2.6); scene.add(rim);
  const flash = new THREE.PointLight(0xffffff, 0, 20); flash.position.set(0, 0.4, 6.5); scene.add(flash);

  /* the magnets */
  const spots = opts.spots || [[-1.05, 1.6, -7], [0.75, 1.75, 5], [-0.15, 0.05, -2], [1.55, 0.2, 7], [-1.15, -1.6, 4], [0.6, -1.65, -6], [1.75, -1.45, 3]];
  const items = [];
  const side = new THREE.MeshPhysicalMaterial({ color: 0x1b1b1f, roughness: 0.5, metalness: 0.2 });
  magnets.slice(0, spots.length).forEach((cv, i) => {
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const ar = cv.width / cv.height, h = opts.size || 1.32, w = h * ar;
    const face = new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.18, envMapIntensity: 0.15 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.035), [side, side, side, side, face, side]);
    m.castShadow = true; m.receiveShadow = true;
    const s = spots[i], target = new THREE.Vector3(s[0], s[1], 0.04 + i * 0.002);
    const start = new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 1.6 - 0.4, 5.6);
    m.position.copy(reduced ? target : start);
    const rot = THREE.MathUtils.degToRad(s[2]);
    m.rotation.set(reduced ? 0 : (Math.random() - 0.5) * 2.4, reduced ? 0 : (Math.random() - 0.5) * 2.4, reduced ? rot : (Math.random() - 0.5) * 3);
    group.add(m);
    items.push({ m, start, target, rot, t0: 0.55 + i * 0.16, lift: 0, landed: reduced, from: m.rotation.clone() });
  });

  /* size to the box */
  function resize() {
    const r = canvas.getBoundingClientRect(), w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setSize(w, h, false); camera.aspect = w / h;
    const fit = Math.max(doorH / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), (doorW / 2) / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect)) * (opts.fit || 1.08);
    camHome.z = fit; camera.updateProjectionMatrix();
    world.rotation.y = camera.aspect < 0.8 ? 0 : (opts.turn != null ? opts.turn : -0.2);
  }
  resize(); addEventListener('resize', resize);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);

  /* pointer: the scene leans, the magnet under the pointer lifts */
  const ptr = new THREE.Vector2(0, 0), aim = new THREE.Vector2(0, 0), ray = new THREE.Raycaster(); let hover = null;
  const host = opts.pointerHost || canvas;
  host.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); });
  host.addEventListener('pointerleave', () => { ptr.set(0, 0); hover = null; });

  let t0 = performance.now(), shake = 0, visible = true, raf = 0, flashed = false;
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible && !raf) loop(); }).observe(canvas);
  function loop() {
    raf = 0; if (!visible) return;
    const t = (performance.now() - t0) / 1000;
    /* the opening flash */
    if (!reduced) { const f = t < 0.12 ? t / 0.12 : Math.max(0, 1 - (t - 0.12) / 0.5); flash.intensity = 60 * f; if (!flashed && t > 0.05) { flashed = true; opts.onFlash && opts.onFlash(); } }
    aim.lerp(ptr, 0.06);
    camera.position.set(camHome.x + aim.x * 0.55, camHome.y + aim.y * 0.35 + Math.sin(t * 0.4) * 0.03, camHome.z);
    if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake *= 0.86; }
    camera.lookAt(aim.x * 0.15, aim.y * 0.1, 0);
    ray.setFromCamera(ptr, camera); const hit = ray.intersectObjects(group.children)[0]; hover = hit ? hit.object : null;
    items.forEach((it, i) => {
      const k = Math.max(0, (t - it.t0) / 0.9);
      if (!it.landed) {
        const p = ease(Math.min(1, k)), sp = snap(k);
        it.m.position.lerpVectors(it.start, it.target, p);
        it.m.rotation.x = it.from.x * (1 - p); it.m.rotation.y = it.from.y * (1 - p); it.m.rotation.z = it.from.z + (it.rot - it.from.z) * sp;
        const sq = k > 1 ? 0.07 * Math.exp(-9 * (k - 1)) * Math.sin(26 * (k - 1)) : 0; it.m.scale.set(1 + sq, 1 + sq, 1 - sq * 3);
        if (k >= 1.6) { it.landed = true; it.m.scale.set(1, 1, 1); }
        if (k >= 0.98 && !it.clicked) { it.clicked = true; shake = Math.max(shake, 0.025); opts.onSnap && opts.onSnap(i); }
      } else {
        it.lift += ((hover === it.m ? 1 : 0) - it.lift) * 0.12;
        it.m.position.z = it.target.z + it.lift * 0.28;
        it.m.rotation.x = -aim.y * 0.12 * it.lift + Math.sin(t * 1.3 + i) * 0.006; it.m.rotation.y = aim.x * 0.16 * it.lift + Math.cos(t * 1.1 + i) * 0.006;
        it.m.rotation.z = it.rot + Math.sin(t * 0.8 + i * 1.7) * 0.012;
      }
    });
    canvas.style.cursor = hover ? 'grab' : '';
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  loop();
  opts.onReady && opts.onReady();
  return { stop() { cancelAnimationFrame(raf); visible = false; renderer.dispose(); } };
}

window.Fridge3D = { mount };
window.dispatchEvent(new Event('fridge3d:ready'));
