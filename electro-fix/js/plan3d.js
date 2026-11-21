/* מעגל סגור — תצוגת תלת-ממד של דירה: קירות עם פתחי דלתות וחלונות, רצפה עם השרטוט, וכל נקודות החשמל בגובה האמיתי.
   מודול ES שנטען רק כשפותחים את לשונית התלת-ממד. */
import * as THREE from '../vendor/three.module.min.js';
import { OrbitControls } from '../vendor/OrbitControls.js';

const H = 2.7, T = 0.12, DOOR_W = 0.9, DOOR_H = 2.1, WIN_W = 1.3, SILL = 0.9, WIN_TOP = 2.15;

const KIND = {
  socket: { color: 0x2f6bd8, size: [0.14, 0.09, 0.03] },
  switch: { color: 0x14213d, size: [0.09, 0.09, 0.03] },
  ac: { color: 0xf4f8fb, size: [0.95, 0.3, 0.22] },
  tv: { color: 0x151515, size: [1.1, 0.62, 0.05] },
  net: { color: 0x2b9348, size: [0.09, 0.09, 0.03] },
  appliance: { color: 0xc62828, size: [0.16, 0.16, 0.04] },
  fan: { color: 0x9aa1ad, size: [0.25, 0.25, 0.06] },
  panel: { color: 0x0c1424, size: [0.5, 0.65, 0.12] }
};

function label(text, sub) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(12,20,36,.82)';
  g.beginPath(); g.roundRect(6, 6, 500, 148, 28); g.fill();
  g.strokeStyle = '#c9a45c'; g.lineWidth = 4; g.stroke();
  g.direction = 'rtl'; g.textAlign = 'center';
  g.fillStyle = '#f6e7bf'; g.font = '700 52px Heebo, Arial'; g.fillText(text, 256, 72);
  g.fillStyle = '#cfc5ae'; g.font = '36px Heebo, Arial'; g.fillText(sub, 256, 124);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  s.scale.set(1.6, 0.5, 1);
  s.renderOrder = 10;
  return s;
}

// קטעים על אותו קו: מאחדים חפיפות (קיר משותף לשני חדרים) ומוציאים פתחים
function mergeIntervals(list) {
  list.sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [a, b] of list) {
    const last = out[out.length - 1];
    if (last && a <= last[1] + 0.05) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

export function mount(el, data) {
  const { rooms, image, bbox, onHover } = data; // rooms: [{name, area, m:{x,y,w,h}, points, doors, windows}]
  const W = el.clientWidth || 800, Hh = el.clientHeight || 560;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(W, Hh);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f1828);
  scene.fog = new THREE.Fog(0x0f1828, 40, 90);
  const cx = bbox.x + bbox.w / 2, cz = bbox.y + bbox.h / 2;
  const P = (x, y) => [x - cx, y - cz];

  const camera = new THREE.PerspectiveCamera(42, W / Hh, 0.1, 300);
  const span = Math.max(bbox.w, bbox.h);
  camera.position.set(span * 0.15, span * 1.05, span * 0.95);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.6, 0);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 3; controls.maxDistance = span * 3;

  scene.add(new THREE.HemisphereLight(0xfff6e5, 0x26324a, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(span * 0.6, span * 1.2, span * 0.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span });
  scene.add(sun);

  // רצפה: השרטוט עצמו כטקסטורה
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  if (image) {
    const tex = new THREE.CanvasTexture(image);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    floorMat.map = tex;
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(bbox.w, bbox.h), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const base = new THREE.Mesh(new THREE.BoxGeometry(bbox.w + 1.2, 0.25, bbox.h + 1.2), new THREE.MeshStandardMaterial({ color: 0x1b2638, roughness: 1 }));
  base.position.y = -0.13;
  scene.add(base);

  // קירות
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf5efe3, roughness: 0.85 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x9cc9e8, transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.1 });
  const lines = {}; // key → {dir, c, segs: [], doors: [], wins: []}
  function line(dir, c) {
    const k = dir + ':' + Math.round(c * 10);
    return (lines[k] = lines[k] || { dir, c, segs: [], doors: [], wins: [] });
  }
  const pos = (m, wall, at) => wall === 'top' ? [m.x + at, m.y] : wall === 'bottom' ? [m.x + at, m.y + m.h] : wall === 'left' ? [m.x, m.y + at] : [m.x + m.w, m.y + at];
  for (const r of rooms) {
    const m = r.m;
    line('h', m.y).segs.push([m.x, m.x + m.w]);
    line('h', m.y + m.h).segs.push([m.x, m.x + m.w]);
    line('v', m.x).segs.push([m.y, m.y + m.h]);
    line('v', m.x + m.w).segs.push([m.y, m.y + m.h]);
    for (const d of r.doors) { const p = pos(m, d.wall, d.at); const L = d.wall === 'top' || d.wall === 'bottom' ? line('h', p[1]) : line('v', p[0]); L.doors.push(d.wall === 'top' || d.wall === 'bottom' ? p[0] : p[1]); }
    for (const w of r.windows) { const p = pos(m, w.wall, w.at); const L = w.wall === 'top' || w.wall === 'bottom' ? line('h', p[1]) : line('v', p[0]); L.wins.push(w.wall === 'top' || w.wall === 'bottom' ? p[0] : p[1]); }
  }
  const full = new THREE.Group(), cut = new THREE.Group();
  scene.add(full); scene.add(cut);
  function piece(group, L, a, b, y0, y1, mat) {
    if (b - a < 0.02 || y1 - y0 < 0.02) return;
    const len = b - a, mid = (a + b) / 2;
    const g = new THREE.Mesh(new THREE.BoxGeometry(L.dir === 'h' ? len : T, y1 - y0, L.dir === 'h' ? T : len), mat);
    const [x, z] = L.dir === 'h' ? P(mid, L.c) : P(L.c, mid);
    g.position.set(x, (y0 + y1) / 2, z);
    g.castShadow = mat === wallMat; g.receiveShadow = true;
    group.add(g);
  }
  for (const L of Object.values(lines)) {
    // אותה דלת נרשמת משני צדי קיר משותף — משאירים פתח אחד
    const seen = new Set();
    const uniq = (list, kind) => list.filter((c) => { const k = kind + Math.round(c * 4); if (seen.has(k)) return false; seen.add(k); return true; });
    const openings = uniq(L.doors, 'd').map((c) => [c - DOOR_W / 2, c + DOOR_W / 2, 'd']).concat(uniq(L.wins, 'w').map((c) => [c - WIN_W / 2, c + WIN_W / 2, 'w'])).sort((p, q) => p[0] - q[0]);
    for (const [a, b] of mergeIntervals(L.segs)) {
      let x = a;
      for (const [o0, o1, kind] of openings) {
        if (o1 <= a || o0 >= b) continue;
        const s0 = Math.max(a, o0), s1 = Math.min(b, o1);
        piece(full, L, x, s0, 0, H, wallMat); piece(cut, L, x, s0, 0, 1.2, wallMat);
        if (kind === 'd') piece(full, L, s0, s1, DOOR_H, H, wallMat);
        else {
          piece(full, L, s0, s1, 0, SILL, wallMat); piece(cut, L, s0, s1, 0, SILL, wallMat);
          piece(full, L, s0, s1, WIN_TOP, H, wallMat);
          piece(full, L, s0, s1, SILL, WIN_TOP, glassMat);
        }
        x = Math.max(x, s1);
      }
      piece(full, L, x, b, 0, H, wallMat); piece(cut, L, x, b, 0, 1.2, wallMat);
    }
  }
  cut.visible = false;

  // נקודות חשמל
  const pick = [];
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff1c1, emissive: 0xffc966, emissiveIntensity: 1.4 });
  let lamps = 0;
  for (const r of rooms) {
    for (const p of r.points) {
      const ax = r.m.x + p.x, ay = r.m.y + p.y, [x, z] = P(ax, ay);
      let mesh;
      if (p.kind === 'light') {
        mesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 12), lightMat);
        mesh.position.set(x, H - 0.12, z);
        if (lamps++ < 10) { const pl = new THREE.PointLight(0xffd59a, 2.2, 5, 1.6); pl.position.set(x, H - 0.3, z); scene.add(pl); }
      } else {
        const k = KIND[p.kind] || KIND.appliance;
        mesh = new THREE.Mesh(new THREE.BoxGeometry(...k.size), new THREE.MeshStandardMaterial({ color: k.color, roughness: 0.5, emissive: p.kind === 'panel' ? 0x3d2f10 : 0x000000 }));
        mesh.position.set(x, p.h, z);
        if (p.wall === 'left' || p.wall === 'right') mesh.rotation.y = Math.PI / 2;
        if (p.kind === 'panel') {
          const edge = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: 0xc9a45c }));
          mesh.add(edge);
        }
      }
      mesh.userData = { p, room: r.name };
      mesh.castShadow = true;
      scene.add(mesh);
      pick.push(mesh);
    }
    const lbl = label(r.name, r.area.toFixed(1) + ' מ״ר');
    const [lx, lz] = P(r.m.x + r.m.w / 2, r.m.y + r.m.h / 2);
    lbl.position.set(lx, H + 0.5, lz);
    scene.add(lbl);
  }

  // ריחוף: מידע על הנקודה
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  let hovered = null;
  function move(ev) {
    const b = renderer.domElement.getBoundingClientRect();
    mouse.x = ((ev.clientX - b.left) / b.width) * 2 - 1;
    mouse.y = -((ev.clientY - b.top) / b.height) * 2 + 1;
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(pick, false)[0];
    const obj = hit ? hit.object : null;
    if (obj !== hovered) {
      if (hovered) hovered.scale.setScalar(1);
      hovered = obj;
      if (hovered) hovered.scale.setScalar(1.6);
      if (onHover) onHover(hovered ? hovered.userData : null, ev);
    }
  }
  renderer.domElement.addEventListener('pointermove', move);

  let raf = 0;
  (function loop() { raf = requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); })();
  const ro = new ResizeObserver(() => {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  });
  ro.observe(el);

  return {
    setCut(on) { full.visible = !on; cut.visible = on; },
    top() { camera.position.set(0.01, span * 1.6, 0.01); controls.update(); },
    persp() { camera.position.set(span * 0.15, span * 1.05, span * 0.95); controls.update(); },
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect();
      renderer.domElement.removeEventListener('pointermove', move);
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); } });
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
