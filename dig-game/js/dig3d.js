/* שכבות — the 3D excavation: a square trench in real-feeling ground, carved where you strike.
   The game logic stays in game.js; this module owns the world, the ground and the effects. */
import * as THREE from 'three';
import { EffectComposer } from '../vendor/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from '../vendor/three/addons/postprocessing/GTAOPass.js';
import { GLTFLoader } from '../vendor/three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from '../vendor/three/addons/utils/SkeletonUtils.js';

const D = window.SHCHAVOT;
const PH = window.SHCHAVOT_PHOTOS || { sites: {}, finds: {} };
const COLS = 9, ROWS = 13;
const HALF = COLS / 2;          // the square runs from -HALF to +HALF in x and z
const ROWD = 0.34;              // depth of one "row" of the old grid, in metres of the world
const MAXD = ROWS * ROWD;
const RES = 12;                 // vertices per metre
const GN = COLS * RES + 1;      // vertices per side
const MOBILE = Math.min(window.innerWidth, window.innerHeight) < 700;

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- renderer ---------- */
let renderer, scene, camera, composer, bloom, clock, host = null, overlay = null, ro = null;
let viewLock = false, running = false, mode = 'idle', aoPass = null, slow = 0, showcaseHits = [], showSpot = null;
function initRenderer() {
  if (renderer) return true;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (e) { return false; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MOBILE ? 1.6 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'gl';
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
  clock = new THREE.Clock();
  return true;
}

function attach(el) {
  if (!initRenderer()) return false;
  host = el;
  if (renderer.domElement.parentNode !== el) el.prepend(renderer.domElement);
  overlay = el.querySelector('.gl-overlay');
  if (!overlay) { overlay = document.createElement('div'); overlay.className = 'gl-overlay'; el.appendChild(overlay); }
  if (ro) ro.disconnect();
  ro = new ResizeObserver(resize); ro.observe(el);
  resize();
  return true;
}
function resize() {
  if (!host || !renderer) return;
  const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
  camera.aspect = w / h;
  camera.fov = w / h < 0.8 ? 46 : 36;
  camera.updateProjectionMatrix();
  if (composer) { composer.setSize(w, h); composer.setPixelRatio(renderer.getPixelRatio()); }
}

/* ---------- shared shader bits ---------- */
const NOISE = /* glsl */`
float h3(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float n3(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(h3(i), h3(i+vec3(1,0,0)), f.x), mix(h3(i+vec3(0,1,0)), h3(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i+vec3(0,0,1)), h3(i+vec3(1,0,1)), f.x), mix(h3(i+vec3(0,1,1)), h3(i+vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a*n3(p); p *= 2.03; a *= 0.5; } return s; }
`;

/* ---------- the world ---------- */
let terrain, tGeo, tMat, heights, target, moving = false, ground, grass, heap, sky, sun, hemi, backdrop;
let arts = [], items = [], stones = [], glints = [], dig = null, handlers = {}, seedU = 0;
const U = {
  uRow: { value: Array.from({ length: 16 }, () => new THREE.Color()) },
  uRowD: { value: ROWD }, uSeed: { value: 0 }, uTime: { value: 0 },
  uHover: { value: new THREE.Vector3() }, uHoverR: { value: 0.7 }, uHoverC: { value: new THREE.Color('#ffcf6b') }, uHoverOn: { value: 0 },
  uSonar: { value: new THREE.Vector4(0, 0, 0, -1) },
  uDetail: { value: null },
};
// the grain of a real trench wall (photos/soil-detail.jpg), sampled on floor and walls
new THREE.TextureLoader().load('photos/soil-detail.jpg', (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; U.uDetail.value = t; if (tMat) tMat.needsUpdate = true; });

function soilMaterial() {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.96, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vW;
uniform vec3 uRow[16]; uniform float uRowD; uniform float uSeed; uniform float uTime;
uniform vec3 uHover; uniform float uHoverR; uniform vec3 uHoverC; uniform float uHoverOn; uniform vec4 uSonar;
uniform sampler2D uDetail;
${NOISE}
float depthAt(vec3 w){ float warp = (fbm(vec3(w.xz*0.33, uSeed)) - 0.5)*0.9 + (n3(vec3(w.xz*1.6, uSeed+3.0)) - 0.5)*0.18; return max(0.0, -w.y + warp*smoothstep(0.02, 0.35, -w.y)); }
vec3 soil(vec3 w){
  float d = depthAt(w);
  float fr = d / uRowD;
  int i0 = int(clamp(floor(fr), 0.0, 14.0)); int i1 = int(clamp(floor(fr) + 1.0, 0.0, 14.0));
  vec3 c = mix(uRow[i0], uRow[i1], smoothstep(0.7, 1.0, fract(fr)));
  float g = fbm(w*vec3(9.0, 24.0, 9.0) + uSeed);
  c *= 0.74 + g*0.5;
  c *= 0.92 + 0.08*(sin(d*58.0 + fbm(w*2.2)*7.0)*0.5 + 0.5);
  float peb = n3(w*vec3(24.0, 30.0, 24.0) + 11.0);
  c = mix(c, vec3(0.78, 0.72, 0.62)*(0.65 + g*0.55), smoothstep(0.82, 0.9, peb)*0.9);
  c *= 1.0 - 0.2*smoothstep(0.62, 0.9, n3(w*vec3(12.0, 40.0, 12.0) + 7.0));
  float top = smoothstep(0.035, 0.0, -w.y);
  float gg = fbm(vec3(w.xz*1.3, 1.0)), fine = n3(vec3(w.xz*48.0, 2.0)), mid = fbm(vec3(w.xz*9.0, 5.0));
  vec3 topc = mix(vec3(0.30, 0.21, 0.13), vec3(0.40, 0.30, 0.19), gg) * (0.82 + 0.3*mid) * (0.9 + 0.2*fine);
  topc = mix(topc, vec3(0.62, 0.56, 0.46), smoothstep(0.86, 0.93, n3(vec3(w.xz*22.0, 8.0))) * 0.8);
  topc = mix(topc, vec3(0.30, 0.31, 0.15), smoothstep(0.6, 0.8, fbm(vec3(w.xz*3.0, 3.0))) * 0.35);
  return mix(c, topc, top);
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb = soil(vW);
{ vec3 wn = normalize((vec4(vNormal, 0.0) * viewMatrix).xyz); float wall = smoothstep(0.35, 0.75, 1.0 - abs(wn.y));
  float dTop = texture2D(uDetail, vW.xz*0.5).r, dWall = texture2D(uDetail, vec2((vW.x + vW.z)*0.5, vW.y*0.85)).r;
  diffuseColor.rgb *= 0.5 + mix(dTop, dWall, wall) * 0.95; }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{ float e = 0.035; vec3 p = vW*vec3(7.0, 16.0, 7.0);
  float b0 = fbm(p), bx = fbm(p + vec3(e*7.0, 0, 0)), by = fbm(p + vec3(0, e*16.0, 0)), bz = fbm(p + vec3(0, 0, e*7.0));
  vec3 gw = vec3(bx - b0, by - b0, bz - b0) * 2.2;
  normal = normalize(normal - mat3(viewMatrix)*gw); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ float dist = length(vW.xz - uHover.xz);
  float ring = smoothstep(0.05, 0.0, abs(dist - uHoverR)) + 0.12*smoothstep(uHoverR, 0.0, dist);
  totalEmissiveRadiance += uHoverC * ring * uHoverOn * 1.4;
  if (uSonar.w >= 0.0) { float sd = length(vW.xz - uSonar.xz); float rr = uSonar.w*3.2;
    float wave = smoothstep(0.18, 0.0, abs(sd - rr)) * smoothstep(2.8, 1.2, uSonar.w);
    float grid = (step(0.96, fract(vW.x*3.0)) + step(0.96, fract(vW.z*3.0))) * smoothstep(2.6, 0.0, sd) * smoothstep(3.0, 1.6, uSonar.w) * 0.35;
    totalEmissiveRadiance += vec3(0.3, 0.9, 1.0) * (wave*1.6 + grid); } }`);
  };
  return m;
}

function grassMaterial() {
  const m = new THREE.MeshStandardMaterial({ roughness: 1 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vW; uniform float uSeed;\n${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float g = fbm(vec3(vW.xz*0.45, 4.0)), f = fbm(vec3(vW.xz*6.0, 5.0)), pch = smoothstep(0.42, 0.62, fbm(vec3(vW.xz*0.18, 9.0)));
vec3 dry = vec3(0.46, 0.4, 0.24), green = vec3(0.24, 0.3, 0.12), dirt = vec3(0.32, 0.23, 0.15);
diffuseColor.rgb = mix(mix(dirt, dry, smoothstep(0.3, 0.65, g)), green, pch*0.75) * (0.8 + 0.4*f);`);
  };
  return m;
}

function buildWorld(site, withAO = false) {
  scene = new THREE.Scene();
  const skyTop = new THREE.Color('#3f7cc4'), skyHor = new THREE.Color(site && site.sky ? site.sky[1] : '#ffd9a0');
  scene.fog = new THREE.Fog(skyHor.clone().lerp(new THREE.Color('#c9d6e4'), 0.4), 34, 120);
  // sky dome
  sky = new THREE.Mesh(new THREE.SphereGeometry(220, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: skyTop }, hor: { value: skyHor }, sunDir: { value: new THREE.Vector3(0.5, 0.42, -0.75).normalize() } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; uniform vec3 top, hor, sunDir;
      void main(){ float h = clamp(vP.y, -0.1, 1.0); vec3 c = mix(hor, top, pow(max(h, 0.0), 0.55));
        float s = max(dot(vP, sunDir), 0.0); c += vec3(1.0, 0.85, 0.6) * (pow(s, 600.0)*6.0 + pow(s, 12.0)*0.35);
        gl_FragColor = vec4(c, 1.0); }`,
  }));
  scene.add(sky);
  // the sky also lights everything softly (image-based lighting)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene(); envScene.add(sky.clone());
  const gnd = new THREE.Mesh(new THREE.CircleGeometry(200, 16), new THREE.MeshBasicMaterial({ color: '#6b5236' })); gnd.rotation.x = -Math.PI / 2; gnd.position.y = -1; envScene.add(gnd);
  scene.environment = pmrem.fromScene(envScene, 0.04).texture;
  scene.environmentIntensity = 0.6;
  pmrem.dispose();
  // light
  hemi = new THREE.HemisphereLight('#cfe3ff', '#6b4a2c', 0.45); scene.add(hemi);
  sun = new THREE.DirectionalLight('#fff0d6', 2.6);
  sun.position.set(9, 13, -6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 50 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
  scene.add(sun);
  // the trench
  tGeo = new THREE.PlaneGeometry(COLS, COLS, GN - 1, GN - 1); tGeo.rotateX(-Math.PI / 2);
  tMat = soilMaterial();
  terrain = new THREE.Mesh(tGeo, tMat); terrain.receiveShadow = true; terrain.castShadow = true;
  tGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -MAXD / 2, 0), 12);
  scene.add(terrain);
  // ground around it, with a square hole for the trench
  const shape = new THREE.Shape(); shape.moveTo(-70, -70); shape.lineTo(70, -70); shape.lineTo(70, 70); shape.lineTo(-70, 70);
  const hole = new THREE.Path(); hole.moveTo(-HALF, -HALF); hole.lineTo(-HALF, HALF); hole.lineTo(HALF, HALF); hole.lineTo(HALF, -HALF); shape.holes.push(hole);
  const gg = new THREE.ShapeGeometry(shape, 1); gg.rotateX(-Math.PI / 2);
  ground = new THREE.Mesh(gg, grassMaterial()); ground.receiveShadow = true; ground.position.y = 0.001; scene.add(ground);
  addGrass(); addProps();
  // the real place on the horizon
  const ph = site && (PH.sites[site.id && site.id.startsWith('daily') ? 'daily' : site.id]);
  if (ph) {
    new THREE.TextureLoader().load(ph.src, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      const ar = tex.image.width / tex.image.height;
      const w = 150, h = w / ar;
      backdrop = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, fog: true, transparent: true }));
      backdrop.material.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\nfloat fy = vMapUv.y; diffuseColor.a *= smoothstep(0.0, 0.18, fy) * smoothstep(1.0, 0.75, fy) * smoothstep(0.0, 0.12, vMapUv.x) * smoothstep(1.0, 0.88, vMapUv.x);');
      };
      backdrop.position.set(0, h * 0.28, -78);
      scene.add(backdrop);
    });
  }
  // post-processing: a soft bloom on the bright things (finds, the sun, holograms)
  if (composer) composer.dispose();
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  aoPass = null; slow = 0;
  if (!MOBILE && withAO) {
    try {
      const ao = new GTAOPass(scene, camera, host.clientWidth, host.clientHeight);
      aoPass = ao;
      ao.output = GTAOPass.OUTPUT.Default; ao.blendIntensity = 0.9;
      ao.updateGtaoMaterial({ radius: 0.7, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 16 });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
      composer.addPass(ao);
    } catch (e) { /* ambient occlusion is a bonus */ }
  }
  bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.55, 0.86);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  resize();
  buildFx();
  person = buildPerson();
}

function addGrass() {
  const n = MOBILE ? 5000 : 9000;
  const geo = new THREE.ConeGeometry(0.011, 0.3, 3, 1, true); geo.translate(0, 0.15, 0);
  const mat = new THREE.MeshStandardMaterial({ roughness: 1, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
float sway = sin(uTime*1.6 + ip.x*0.7 + ip.z*0.5) * 0.08 + sin(uTime*3.1 + ip.z) * 0.025;
transformed.x += sway * position.y * 2.2; transformed.z += sway * position.y * 0.8;`);
  };
  grass = new THREE.InstancedMesh(geo, mat, n);
  const R = rng(99), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  let k = 0;
  while (k < n) {
    const a = R() * Math.PI * 2, r = HALF + 0.5 + Math.pow(R(), 1.5) * 24;
    const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
    if (Math.abs(cx) < HALF + 0.4 && Math.abs(cz) < HALF + 0.4) continue;
    if (cx > 5.5 && cx < 10 && cz > -4 && cz < 1) continue; // the spoil heap
    const hue = 0.11 + R() * 0.1, dry = R();
    for (let b = 0; b < 9 && k < n; b++, k++) {
      const s = 0.6 + R() * 0.9;
      q.setFromEuler(new THREE.Euler((R() - 0.5) * 0.9, R() * 6.28, (R() - 0.5) * 0.9));
      m4.compose(new THREE.Vector3(cx + (R() - 0.5) * 0.22, 0, cz + (R() - 0.5) * 0.22), q, new THREE.Vector3(s, s * (0.6 + R()), s));
      grass.setMatrixAt(k, m4);
      grass.setColorAt(k, c.setHSL(hue, 0.3 + dry * 0.3, 0.26 + dry * 0.2 + R() * 0.08));
    }
  }
  grass.castShadow = true; grass.receiveShadow = true;
  scene.add(grass);
}

function addProps() {
  const wood = new THREE.MeshStandardMaterial({ color: '#8a5a32', roughness: 0.85 });
  const strMat = new THREE.MeshStandardMaterial({ color: '#f3efe6', roughness: 0.6 });
  // pegs and the string around the square, like on every real dig
  const pegG = new THREE.BoxGeometry(0.08, 0.7, 0.08);
  const corners = [[-HALF, -HALF], [HALF, -HALF], [HALF, HALF], [-HALF, HALF]];
  for (const [x, z] of corners) { const p = new THREE.Mesh(pegG, wood); p.position.set(x * 1.012, 0.28, z * 1.012); p.castShadow = true; scene.add(p); }
  for (let i = 0; i < 4; i++) {
    const [x0, z0] = corners[i], [x1, z1] = corners[(i + 1) % 4];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const s = new THREE.Mesh(new THREE.BoxGeometry(len, 0.012, 0.012), strMat);
    s.position.set((x0 + x1) / 2 * 1.012, 0.52, (z0 + z1) / 2 * 1.012); s.rotation.y = -Math.atan2(z1 - z0, x1 - x0); s.castShadow = true; scene.add(s);
  }
  // a rubber bucket, a sieve on its frame and a leaning scale bar
  const bucket = new THREE.Group();
  const bm = new THREE.MeshStandardMaterial({ color: '#1d1d1f', roughness: 0.7 });
  const bw = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.27, 0.5, 24, 1, true), bm); bw.material.side = THREE.DoubleSide; bw.position.y = 0.25;
  const bb = new THREE.Mesh(new THREE.CircleGeometry(0.27, 24), bm); bb.rotation.x = -Math.PI / 2; bb.position.y = 0.02;
  const bs = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 20), soilMaterial()); bs.position.y = 0.4;
  bucket.add(bw, bb, bs); bucket.position.set(-6.2, 0, 2.6); bucket.traverse((o) => { o.castShadow = true; o.receiveShadow = true; }); scene.add(bucket);
  const sieve = new THREE.Group();
  const meshC = document.createElement('canvas'); meshC.width = meshC.height = 128; const mx = meshC.getContext('2d');
  mx.strokeStyle = '#555'; mx.lineWidth = 2; for (let i = 0; i <= 128; i += 8) { mx.beginPath(); mx.moveTo(i, 0); mx.lineTo(i, 128); mx.moveTo(0, i); mx.lineTo(128, i); mx.stroke(); }
  const mt = new THREE.CanvasTexture(meshC); mt.colorSpace = THREE.SRGBColorSpace;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 1.0), wood); frame.position.y = 0.75;
  const net = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.9), new THREE.MeshStandardMaterial({ map: mt, transparent: true, alphaTest: 0.2, side: THREE.DoubleSide })); net.rotation.x = -Math.PI / 2; net.position.y = 0.76;
  for (const [x, z] of [[-0.6, -0.4], [0.6, -0.4], [-0.6, 0.4], [0.6, 0.4]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.75, 0.06), wood); l.position.set(x, 0.37, z); sieve.add(l); }
  sieve.add(frame, net); sieve.position.set(-6.4, 0, -2.2); sieve.rotation.y = 0.3; sieve.traverse((o) => { o.castShadow = true; }); scene.add(sieve);
  const barC = document.createElement('canvas'); barC.width = 8; barC.height = 64; const bx = barC.getContext('2d');
  for (let i = 0; i < 8; i++) { bx.fillStyle = i % 2 ? '#f4f1ea' : '#c8261c'; bx.fillRect(0, i * 8, 8, 8); }
  const bt = new THREE.CanvasTexture(barC); bt.colorSpace = THREE.SRGBColorSpace; bt.magFilter = THREE.NearestFilter;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2, 0.03), new THREE.MeshStandardMaterial({ map: bt })); bar.position.set(HALF + 0.35, 0.9, -HALF + 0.6); bar.rotation.z = 0.2; bar.castShadow = true; scene.add(bar);
  // the spoil heap grows with every bucket you take out
  const hg = new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
  const hp = hg.attributes.position; const R = rng(5);
  for (let i = 0; i < hp.count; i++) { const k = 1 + (R() - 0.5) * 0.12; hp.setXYZ(i, hp.getX(i) * k, hp.getY(i) * k, hp.getZ(i) * k); }
  hg.computeVertexNormals();
  const heapMat = new THREE.MeshStandardMaterial({ roughness: 1 });
  heapMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <project_vertex>', '#include <project_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vW;\n${NOISE}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat g = fbm(vW*9.0); diffuseColor.rgb = mix(vec3(0.42,0.3,0.19), vec3(0.6,0.47,0.32), fbm(vW*1.7)) * (0.7 + g*0.6);');
  };
  heap = new THREE.Mesh(hg, heapMat); heap.position.set(7.6, 0, -1.6); heap.scale.set(0.01, 0.01, 0.01); heap.castShadow = true; heap.receiveShadow = true; scene.add(heap);
}

/* ---------- the tool in your hand ---------- */
/* ---------- the archaeologist ---------- */
// a professionally made, rigged character with motion-captured style animations (KayKit Adventurers, free for commercial use);
// the figure built in code below stays as a fallback if the model cannot load
const heroGLTF = new Promise((res) => new GLTFLoader().load('models/explorer.glb', res, undefined, () => res(null)));
const CLIPS = { idle: 'Idle', ready: '2H_Melee_Idle', walk: 'Walking_A', run: 'Running_A', chop: '2H_Melee_Attack_Chop', pickup: 'PickUp', cheer: 'Cheer' };
function lowestHandTime(mixer, root, action, hand) {
  // the moment the tool meets the ground: when the hand is lowest in the clip
  const clip = action.getClip(); let best = 0, by = Infinity; const v = new THREE.Vector3();
  action.reset().play();
  for (let t = 0; t <= clip.duration; t += clip.duration / 40) { mixer.setTime(t); root.updateMatrixWorld(true); hand.getWorldPosition(v); if (v.y < by) { by = v.y; best = t; } }
  action.stop(); mixer.setTime(0);
  return best;
}
function attachModel(P, g) {
  // each digger (opening screen, dig) gets its own copy of the rig
  const m = SkeletonUtils.clone(g.scene);
  ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable', 'Rogue_Cape'].forEach((n) => { const o = m.getObjectByName(n); if (o) o.visible = false; });
  m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  m.scale.setScalar(1); m.position.set(0, 0, 0); m.rotation.set(0, 0, 0);
  const box = new THREE.Box3().setFromObject(m), k = 1.75 / PS / (box.max.y - box.min.y); // 1.75 m in the world
  m.scale.setScalar(k);
  P.body.visible = false;
  P.root.add(m);
  const slot = m.getObjectByName('handslotr') || m.getObjectByName('handr');
  for (const [name, t] of Object.entries(P.tools)) {
    t.parent && t.parent.remove(t);
    t.scale.setScalar(1 / k); t.position.set(0, 0, 0);
    // the slot holds weapons along its own y axis, blade up: turn our tools to match
    t.rotation.set(Math.PI, 0, 0);
    if (name === 'pick') t.position.y = 0.45 / k;
    slot.add(t);
  }
  const head = m.getObjectByName('head');
  if (head && !head.getObjectByName('fedora')) {
    const hatM = new THREE.MeshStandardMaterial({ color: '#c9b386', roughness: 0.85 }), bandM = new THREE.MeshStandardMaterial({ color: '#4a3622' });
    const hat = new THREE.Group(); hat.name = 'fedora';
    // sizes in the rig's own units: the head runs about 1.0 up from its bone and 0.55 out to each side
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.86, 0.05, 40), hatM);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.42, 32), hatM); crown.position.y = 0.22;
    const dent = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), hatM); dent.scale.set(1, 0.25, 0.8); dent.position.y = 0.42;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.605, 0.605, 0.1, 32), bandM); band.position.y = 0.07;
    hat.add(brim, crown, dent, band); hat.traverse((o) => { o.castShadow = true; });
    hat.position.set(0, 0.86, 0.02); hat.rotation.x = -0.1;
    head.add(hat);
  }
  const mixer = new THREE.AnimationMixer(m), actions = {};
  for (const [key, name] of Object.entries(CLIPS)) { const c = THREE.AnimationClip.findByName(g.animations, name); if (c) actions[key] = mixer.clipAction(c); }
  for (const key of ['chop', 'pickup', 'cheer']) if (actions[key]) { actions[key].setLoop(THREE.LoopOnce); actions[key].clampWhenFinished = true; }
  const hand = m.getObjectByName('handr') || slot;
  const imp = {};
  // time the blows: the chop lands at about 0.3 s, a bend reaches the ground at about 0.35 s
  if (actions.chop) { const tr = lowestHandTime(mixer, P.root, actions.chop, hand); actions.chop.timeScale = Math.max(0.8, tr / 0.3); imp.pick = tr / actions.chop.timeScale; }
  if (actions.pickup) { const tr = lowestHandTime(mixer, P.root, actions.pickup, hand); actions.pickup.timeScale = Math.max(0.8, tr / 0.35); imp.brush = imp.trowel = tr / actions.pickup.timeScale; }
  Object.assign(IMPACT, imp);
  P.model = { m, mixer, actions, cur: null, played: -1 };
  playClip(P, 'idle', 0);
}
function playClip(P, key, fade = 0.18, restart = false) {
  const M = P.model, a = M.actions[key];
  if (!a) return;
  if (M.cur === key && !restart) return;
  const prev = M.cur && M.actions[M.cur];
  a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.play();
  if (prev && prev !== a && fade > 0) prev.crossFadeTo(a, fade, false); else if (prev && prev !== a) prev.stop();
  M.cur = key;
}
let person = null, toolKind = 'pick', holdUntil = 0, pendingFx = [], focus = null;
// effects of a strike wait for the moment the tool meets the ground
function later(fn) { if (clock && clock.elapsedTime < holdUntil) pendingFx.push(fn); else fn(); }

function toolModel(kind) {
  const wood = new THREE.MeshStandardMaterial({ color: '#8a5a32', roughness: 0.7 });
  const steel = new THREE.MeshStandardMaterial({ color: '#c7ccd2', roughness: 0.35, metalness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2a2d31', roughness: 0.5, metalness: 0.6 });
  const g = new THREE.Group();
  if (kind === 'pick') {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.95, 10), wood); handle.position.y = -0.4; g.add(handle);
    const head = new THREE.Group(); head.position.y = -0.86;
    const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.035, 0.34, 8), steel); blade.rotation.x = Math.PI / 2; blade.position.z = 0.17;
    const adze = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 0.24), steel); adze.position.z = -0.12;
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.08), dark);
    head.add(blade, adze, eye); g.add(head);
  } else if (kind === 'trowel') {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.13, 10), wood); handle.position.y = -0.03; g.add(handle);
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.055, 0.03); sh.lineTo(0, 0.2); sh.lineTo(-0.055, 0.03); sh.closePath();
    const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.005, bevelEnabled: false }), steel); blade.rotation.x = Math.PI; blade.position.y = -0.13; g.add(blade);
  } else {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.017, 0.16, 10), wood); handle.position.y = -0.04; g.add(handle);
    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 12), new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 0.8, roughness: 0.3 })); ferrule.position.y = -0.13; g.add(ferrule);
    const bristles = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.022), new THREE.MeshStandardMaterial({ color: '#d8c49a', roughness: 1 })); bristles.position.y = -0.17; g.add(bristles);
  }
  g.traverse((o) => { o.castShadow = true; });
  return g;
}

function buildPerson() {
  const M = (c, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const skin = M('#c48a62', 0.55), shirt = M('#b49c74'), pants = M('#5d5140'), boot = M('#3a291b', 0.6), hatM = M('#c9b386'), bandM = M('#4a3622'), scarfM = M('#a8362a'), hairM = M('#3a2a1c', 0.9), dark = M('#1c1714', 0.4), beltM = M('#5a3a20', 0.6), packM = M('#6e6a4a');
  const cap = (r, len, mat) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), mat); m.castShadow = true; m.receiveShadow = true; return m; };
  const box = (w, h, d, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = true; return m; };
  const joint = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const P = { root: new THREE.Group() };
  P.body = joint(P.root, 0, 0, 0);
  P.hips = joint(P.body, 0, 0.95, 0);
  const pelvis = cap(0.135, 0.07, pants); pelvis.scale.set(1.15, 1, 0.78); P.hips.add(pelvis);
  P.spine = joint(P.hips, 0, 0.07, 0);
  const torso = cap(0.15, 0.3, shirt); torso.scale.set(1.15, 1, 0.74); torso.position.y = 0.22; P.spine.add(torso);
  const belt = box(0.35, 0.05, 0.23, beltM); belt.position.y = 0.0; P.spine.add(belt);
  const buckle = box(0.05, 0.035, 0.01, M('#c9a24a', 0.3)); buckle.position.set(0, 0.0, 0.116); P.spine.add(buckle);
  for (const sx of [-1, 1]) { const pk = box(0.08, 0.07, 0.02, shirt); pk.position.set(sx * 0.07, 0.32, 0.105); P.spine.add(pk); }
  const pack = box(0.24, 0.3, 0.12, packM); pack.position.set(0, 0.25, -0.15); P.spine.add(pack);
  P.neck = joint(P.spine, 0, 0.47, 0);
  const neckM = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 12), skin); neckM.position.y = 0.03; P.neck.add(neckM);
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.028, 8, 18), scarfM); scarf.rotation.x = Math.PI / 2; scarf.position.y = 0.0; scarf.castShadow = true; P.neck.add(scarf);
  P.head = joint(P.neck, 0, 0.09, 0);
  const headM = new THREE.Mesh(new THREE.SphereGeometry(0.102, 24, 18), skin); headM.scale.set(0.92, 1.1, 1); headM.position.y = 0.1; headM.castShadow = true; P.head.add(headM);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), hairM); jaw.scale.set(1, 0.6, 0.95); jaw.position.set(0, 0.04, 0.02); P.head.add(jaw); // a short beard
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 8), skin); nose.rotation.x = Math.PI / 2; nose.position.set(0, 0.1, 0.105); P.head.add(nose);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), dark); eye.position.set(sx * 0.035, 0.125, 0.088); P.head.add(eye);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), skin); ear.scale.set(0.5, 1, 0.8); ear.position.set(sx * 0.094, 0.1, 0); P.head.add(ear);
  }
  const hat = new THREE.Group(); hat.position.y = 0.19; P.head.add(hat);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.21, 0.012, 28), hatM); brim.castShadow = true;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.11, 0.1, 22), hatM); crown.position.y = 0.055; crown.castShadow = true;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.112, 0.112, 0.024, 22), bandM); band.position.y = 0.018;
  hat.add(brim, crown, band); hat.rotation.x = -0.08;
  for (const sx of [-1, 1]) {
    const k = sx < 0 ? 'L' : 'R';
    P['sh' + k] = joint(P.spine, sx * 0.21, 0.42, 0);
    const up = cap(0.048, 0.19, shirt); up.position.y = -0.13; P['sh' + k].add(up);
    P['el' + k] = joint(P['sh' + k], 0, -0.28, 0);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12), shirt); cuff.position.y = -0.01; P['el' + k].add(cuff);
    const fore = cap(0.038, 0.17, skin); fore.position.y = -0.11; P['el' + k].add(fore);
    P['ha' + k] = joint(P['el' + k], 0, -0.26, 0);
    const hand = box(0.06, 0.085, 0.04, skin); hand.position.y = -0.03; P['ha' + k].add(hand);
    P['hp' + k] = joint(P.hips, sx * 0.095, -0.04, 0);
    const thigh = cap(0.066, 0.29, pants); thigh.position.y = -0.2; P['hp' + k].add(thigh);
    const pocket = box(0.05, 0.09, 0.07, pants); pocket.position.set(sx * 0.07, -0.22, 0); P['hp' + k].add(pocket);
    P['kn' + k] = joint(P['hp' + k], 0, -0.42, 0);
    const shin = cap(0.056, 0.29, pants); shin.position.y = -0.19; P['kn' + k].add(shin);
    P['an' + k] = joint(P['kn' + k], 0, -0.41, 0);
    const b = box(0.1, 0.1, 0.24, boot); b.position.set(0, -0.03, 0.045); P['an' + k].add(b);
  }
  // tools in the right hand
  P.tools = { pick: toolModel('pick'), trowel: toolModel('trowel'), brush: toolModel('brush') };
  for (const [k, t] of Object.entries(P.tools)) { t.position.y = -0.03; t.rotation.x = k === 'pick' ? 0.15 : 0.3; P.haR.add(t); }
  P.cur = { ...POSES.stand }; P.pos = new THREE.Vector3(0, 0, HALF + 1.2); P.goal = P.pos.clone(); P.face = Math.PI; P.act = 'idle'; P.t = 0; P.walk = 0; P.aim = null;
  P.root.position.copy(P.pos); P.root.scale.setScalar(PS);
  scene.add(P.root);
  P.seq = 0;
  heroGLTF.then((g) => { if (g && person === P) { try { attachModel(P, g); } catch (e) { console.warn('model', e); P.body.visible = true; } } });
  return P;
}

// joint angles, in radians. shoulders: x lifts the arm forward (negative), z spreads it out; elbows and knees bend
const POSES = {
  stand: { drop: 0, spine: 0.05, neck: 0.1, shLx: -0.25, shLz: 0.1, elL: 0.35, shRx: -0.35, shRz: 0.08, elR: 0.6, hpL: 0, knL: 0.03, hpR: 0, knR: 0.03 },
  pickUp: { drop: 0.02, spine: -0.22, neck: 0.25, shLx: -2.75, shLz: 0.05, elL: 0.45, shRx: -2.85, shRz: 0.05, elR: 0.35, hpL: -0.18, knL: 0.15, hpR: 0.12, knR: 0.1 },
  pickHit: { drop: 0.1, spine: 0.85, neck: -0.25, shLx: -1.45, shLz: 0.02, elL: 0.15, shRx: -1.4, shRz: 0.02, elR: 0.1, hpL: -0.6, knL: 0.5, hpR: -0.05, knR: 0.38 },
  kneel: { drop: 0.42, spine: 0.75, neck: -0.15, shLx: -0.55, shLz: 0.22, elL: 1.15, shRx: -1.25, shRz: 0.05, elR: 0.35, hpL: -1.45, knL: 1.55, hpR: -0.2, knR: 1.95 },
  cheer: { drop: 0, spine: -0.18, neck: -0.35, shLx: -2.95, shLz: 0.55, elL: 0.25, shRx: -2.95, shRz: 0.55, elR: 0.25, hpL: 0, knL: 0.05, hpR: 0, knR: 0.05 },
};
const IMPACT = { pick: 0.27, trowel: 0.16, brush: 0.12 };
const PS = 1.3; // a little larger than life, so he reads on a phone
const STAND_OFF = { pick: 1.0, trowel: 0.78, brush: 0.78 };

// where the digger stands for a strike at p: across the hole from the camera, facing it, at the height of the ground there
function standFor(p, kind) {
  const d = (STAND_OFF[kind] || 0.9) * PS;
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
  const cands = [[fx, fz], [rx, rz], [-rx, -rz], [-fx, -fz]].map(([ax, az]) => new THREE.Vector3(p.x + ax * d, 0, p.z + az * d));
  let best = null, bs = Infinity;
  cands.forEach((c, k) => {
    const out = Math.max(0, Math.abs(c.x) - (HALF + 1.6)) + Math.max(0, Math.abs(c.z) - (HALF + 1.6));
    const inside = Math.abs(c.x) < HALF - 0.1 && Math.abs(c.z) < HALF - 0.1;
    c.y = inside ? heightAt(c.x, c.z) : 0;
    const score = out * 10 + Math.abs(c.y - p.y) * 1.5 + k * 0.35;
    if (score < bs) { bs = score; best = c; }
  });
  return best;
}
// start an action; returns how long until the tool meets the ground
function act(kind, p) {
  if (!person) return 0;
  const P = person;
  const goal = standFor(p, kind);
  const dist = Math.hypot(goal.x - P.pos.x, goal.z - P.pos.z);
  P.goal.copy(goal); P.aim = p.clone(); P.kind = kind;
  const walkT = dist > 0.12 ? Math.min(0.9, dist / 3.2) : 0;
  P.walkLeft = walkT;
  P.act = kind; P.t = -walkT; P.seq = (P.seq || 0) + 1;
  return walkT + IMPACT[kind];
}
function cheer() { if (person) { person.act = 'cheer'; person.t = 0; person.seq = (person.seq || 0) + 1; } }
const lerpPose = (a, b, k) => { const o = {}; for (const key in a) o[key] = a[key] + (b[key] - a[key]) * k; return o; };
const ease = (x) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
function updatePerson(dt, t) {
  const P = person;
  if (!P) return;
  for (const [k, m] of Object.entries(P.tools)) m.visible = k === toolKind;
  // walk toward the goal
  const dx = P.goal.x - P.pos.x, dz = P.goal.z - P.pos.z, dist = Math.hypot(dx, dz);
  let walking = false;
  if (dist > 0.03) {
    const step = Math.min(dist, dt * 3.2);
    P.pos.x += (dx / dist) * step; P.pos.z += (dz / dist) * step;
    P.face = Math.atan2(dx, dz); walking = true; P.walk += dt * 11;
  } else if (P.aim) P.face = Math.atan2(P.aim.x - P.pos.x, P.aim.z - P.pos.z);
  const inside = Math.abs(P.pos.x) < HALF - 0.05 && Math.abs(P.pos.z) < HALF - 0.05;
  const gy = inside ? heightAt(P.pos.x, P.pos.z) : 0;
  P.pos.y += (gy - P.pos.y) * (1 - Math.pow(0.0005, dt));
  // turn smoothly
  let da = P.face - P.root.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da));
  P.root.rotation.y += da * (1 - Math.pow(0.0002, dt));
  P.t += dt;
  if (P.model) {
    const M = P.model;
    M.mixer.update(dt);
    if (walking && P.t < 0) playClip(P, dist > 1.5 ? 'run' : 'walk', 0.15);
    else if (P.t >= 0 && M.played !== P.seq && (P.act === 'pick' || P.act === 'brush' || P.act === 'trowel' || P.act === 'cheer')) {
      M.played = P.seq;
      playClip(P, P.act === 'pick' ? 'chop' : P.act === 'cheer' ? 'cheer' : 'pickup', 0.08, true);
    } else if (M.cur && ['chop', 'pickup', 'cheer'].includes(M.cur)) {
      const a = M.actions[M.cur];
      if (!a.isRunning() || a.time >= a.getClip().duration - 0.02) playClip(P, toolKind === 'pick' ? 'ready' : 'idle', 0.25);
    } else if (!walking) playClip(P, toolKind === 'pick' ? 'ready' : 'idle', 0.25);
    P.root.position.set(P.pos.x, P.pos.y, P.pos.z);
    return;
  }
  // the pose for this moment
  let target = POSES.stand, k = 1 - Math.pow(0.001, dt);
  const breathe = Math.sin(t * 1.8) * 0.02;
  if (walking && P.t < 0) {
    const s = Math.sin(P.walk);
    target = { ...POSES.stand, hpL: s * 0.55, hpR: -s * 0.55, knL: Math.max(0, -s) * 0.9 + 0.05, knR: Math.max(0, s) * 0.9 + 0.05, shLx: -0.25 - s * 0.45, shRx: -0.35 + s * 0.3, spine: 0.12, drop: Math.abs(Math.cos(P.walk)) * -0.03 + 0.02 };
    k = 1 - Math.pow(0.00001, dt);
  } else if (P.act === 'pick' && P.t >= 0) {
    const ph = P.t;
    if (ph < 0.2) { target = POSES.pickUp; k = 1 - Math.pow(0.000001, dt); }
    else if (ph < 0.62) { target = POSES.pickHit; k = ph < 0.3 ? 1 - Math.pow(1e-12, dt) : 1 - Math.pow(0.01, dt); }
    else { target = POSES.stand; k = 1 - Math.pow(0.002, dt); if (ph > 1.2) P.act = 'idle'; }
  } else if ((P.act === 'brush' || P.act === 'trowel') && P.t >= 0) {
    const ph = P.t, stroke = Math.sin(ph * (P.act === 'brush' ? 26 : 16));
    target = { ...POSES.kneel, shRx: POSES.kneel.shRx + stroke * (P.act === 'brush' ? 0.22 : 0.3) - (P.act === 'trowel' ? 0.15 : 0), elR: POSES.kneel.elR - stroke * 0.15, spine: POSES.kneel.spine + (P.act === 'trowel' ? 0.1 : 0) };
    k = 1 - Math.pow(0.00001, dt);
    if (ph > 1.6) P.act = 'idle';
  } else if (P.act === 'cheer') {
    const j = Math.max(0, Math.sin(P.t * 9)) * (P.t < 1.2 ? 1 : 0);
    target = { ...POSES.cheer, drop: -j * 0.12, shLz: 0.55 + Math.sin(P.t * 12) * 0.15, shRz: 0.55 - Math.sin(P.t * 12) * 0.15 };
    k = 1 - Math.pow(0.00001, dt);
    if (P.t > 1.6) P.act = 'idle';
  } else if (P.act === 'idle' && P.kind && P.kind !== 'pick') {
    target = POSES.kneel; // stays down by the find between strokes
    if (P.t > 3) P.kind = 'pick';
  }
  P.cur = lerpPose(P.cur, target, k);
  const c = P.cur;
  P.root.position.set(P.pos.x, P.pos.y, P.pos.z);
  P.body.position.y = -c.drop;
  P.spine.rotation.x = c.spine + breathe; P.neck.rotation.x = c.neck;
  P.shL.rotation.set(c.shLx, 0, -c.shLz); P.shR.rotation.set(c.shRx, 0, c.shRz);
  P.elL.rotation.x = -c.elL; P.elR.rotation.x = -c.elR;
  P.hpL.rotation.x = c.hpL; P.hpR.rotation.x = c.hpR; P.knL.rotation.x = c.knL; P.knR.rotation.x = c.knR;
  P.anL.rotation.x = -(c.hpL + c.knL) * 0.6; P.anR.rotation.x = -(c.hpR + c.knR) * 0.6;
}
function showTool(kind) { toolKind = kind; }

/* ---------- the dig in this world ---------- */
const vIdx = (gx, gz) => gz * GN + gx;
const wx = (gx) => -HALF + gx / RES, wz = (gz) => -HALF + gz / RES;
function strata(d) {
  // material of the trench at a depth: the old grid's rows, so harder ground lies deeper
  const r = clamp(Math.floor(d / ROWD), 0, ROWS - 1);
  return dig.rowMat[r];
}
function prepareDig(dg) {
  dig = dg;
  // average material of each old row decides colour and hardness there
  const MATS = D.MATS3D;
  dig.rowMat = [];
  for (let r = 0; r < ROWS; r++) {
    const ms = dig.grid[r].map((c) => c.m); ms.sort((a, b) => a - b);
    dig.rowMat[r] = ms[Math.floor(ms.length / 2)];
  }
  for (let r = 0; r <= 15; r++) {
    const m = MATS[dig.rowMat[Math.min(r, ROWS - 1)]];
    const c = new THREE.Color(m.c[0]).lerp(new THREE.Color(m.c[1]), 0.45);
    U.uRow.value[r].copy(c);
  }
  seedU = (dig.grid[0][0].seed % 1000) / 37;
  U.uSeed.value = seedU;
  heights = new Float32Array(GN * GN); target = new Float32Array(GN * GN);
  const pos = tGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, 0);
  pos.needsUpdate = true; tGeo.computeVertexNormals();
  // finds lie flat in the ground at the depth of their era
  for (const o of [...arts, ...items, ...stones]) { scene.remove(o.mesh); if (o.mesh.geometry) o.mesh.geometry.dispose(); }
  arts = []; items = []; stones = [];
  const place = (z, isItem) => {
    const R = rng(z.seed || (z.x * 131 + z.y * 977 + 7));
    const w = z.w, h = z.h;
    const x0 = -HALF + z.x;
    // never lie on top of another find, so each can be reached from above
    let zz0 = -HALF + 0.15 + R() * (COLS - h - 0.3);
    for (let tries = 0; tries < 30; tries++) {
      const clash = placed.some((q) => x0 < q.x1 + 0.1 && x0 + w > q.x0 - 0.1 && zz0 < q.z1 + 0.1 && zz0 + h > q.z0 - 0.1);
      if (!clash) break;
      zz0 = -HALF + 0.15 + R() * (COLS - h - 0.3);
    }
    const top = 0.22 + z.y * ROWD + R() * 0.12;
    const svg = isItem ? z.it.svg : z.f.svg;
    const ph = !isItem && PH.finds[z.f.id];
    const SLABS = { r_pilate: 1, s_scroll: 1, b_mosaic: 1 };
    const url = ph && (ph.cut || (SLABS[z.f.id] ? ph.src : null));
    const mesh = spriteMesh(svg, w - 0.12, h - 0.12, isItem ? null : D.RARITY[z.f.rarity], url, R);
    mesh.position.set(x0 + w / 2, -top + 0.012, zz0 + h / 2);
    scene.add(mesh);
    const o = { z, x0: x0 + 0.06, x1: x0 + w - 0.06, z0: zz0 + 0.06, z1: zz0 + h - 0.06, top, mesh, verts: [], exposedFirst: false };
    for (let gz = 0; gz < GN; gz++) for (let gx = 0; gx < GN; gx++) { const X = wx(gx), Z = wz(gz); if (X >= o.x0 && X <= o.x1 && Z >= o.z0 && Z <= o.z1) o.verts.push(vIdx(gx, gz)); }
    z.total = o.verts.length; z.exposed = 0;
    placed.push(o);
    return o;
  };
  const placed = [];
  arts = dig.arts.map((a) => place(a, false));
  items = dig.items.map((it) => place(it, true));
  // stones: hard, and they break apart when struck enough
  const R = rng(dig.grid[0][0].seed + 17);
  const nst = 4 + Math.floor(R() * 4) + Math.min(5, dig.siteIdx || 0);
  for (let i = 0; i < nst; i++) {
    const r = 0.22 + R() * 0.32, x = -HALF + 0.6 + R() * (COLS - 1.2), z = -HALF + 0.6 + R() * (COLS - 1.2), top = 0.5 + R() * (MAXD - 1);
    if ([...arts, ...items].some((a) => x > a.x0 - r - 0.2 && x < a.x1 + r + 0.2 && z > a.z0 - r - 0.2 && z < a.z1 + r + 0.2)) continue;
    const g = new THREE.IcosahedronGeometry(r, 1); const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const s = 1 + (R() - 0.5) * 0.35; p.setXYZ(k, p.getX(k) * s, p.getY(k) * s * 0.75, p.getZ(k) * s); }
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.08, 0.06 + R() * 0.08, 0.38 + R() * 0.2), roughness: 0.9, flatShading: true }));
    mesh.position.set(x, -top - r * 0.2, z); mesh.rotation.set(R() * 3, R() * 3, R() * 3);
    mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
    stones.push({ x, z, r, top, hp: 10 + R() * 8 + (dig.siteIdx || 0), mesh, alive: true });
  }
  glints = [];
  heapVol = 0;
  heap.scale.set(0.01, 0.01, 0.01);
  camT.set(0, -0.6, 0); camYaw = 0.6; camPitch = 0.9; camDist = 13;
}

const texCache = {};
function spriteMesh(svg, w, h, rar, url, R) {
  const key = url || svg.length + ':' + svg.slice(-60);
  let tex = texCache[key];
  if (!tex && url) {
    // a real object: its photo, fitted into the footprint without stretching
    tex = new THREE.Texture(); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas'), px = 384;
      c.width = Math.round(px * Math.min(3, w / h)); c.height = Math.round(px * Math.min(3, h / w));
      const x = c.getContext('2d'), s = Math.min(c.width / im.width, c.height / im.height);
      const turn = (w > h) !== (im.width > im.height) && Math.abs(w - h) > 0.3;
      if (turn) { const s2 = Math.min(c.width / im.height, c.height / im.width); x.translate(c.width / 2, c.height / 2); x.rotate(Math.PI / 2); x.drawImage(im, -im.width * s2 / 2, -im.height * s2 / 2, im.width * s2, im.height * s2); }
      else x.drawImage(im, (c.width - im.width * s) / 2, (c.height - im.height * s) / 2, im.width * s, im.height * s);
      tex.image = c; tex.needsUpdate = true;
    };
    im.src = url;
    texCache[key] = tex;
  }
  if (!tex) {
    const c = document.createElement('canvas'); const px = 256;
    c.width = Math.round(px * Math.min(3, w / h)); c.height = Math.round(px * Math.min(3, h / w));
    tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const im = new Image();
    im.onload = () => { const x = c.getContext('2d'); x.drawImage(im, 0, 0, c.width, c.height); tex.needsUpdate = true; };
    im.src = D.svgUrl(svg);
    texCache[key] = tex;
  }
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.25, roughness: url ? 0.7 : 0.55, metalness: 0.05, bumpMap: url ? tex : null, bumpScale: url ? 2.2 : 0, emissive: new THREE.Color(rar ? rar.color : '#ffffff'), emissiveMap: tex, emissiveIntensity: 0 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.rotation.x = -Math.PI / 2;
  if (R) m.rotation.z = (R() - 0.5) * 0.18;
  m.receiveShadow = true;
  return m;
}

let heapVol = 0;
// carve a round bite out of the trench floor. Returns what happened for game.js to score.
function carve(p, spec) {
  const res = { touched: false, removed: 0, harmed: new Map(), first: [], done: [], hard: 0.2, colors: ['#8a6a48', '#5a4030', '#b89a72'] };
  if (!dig) return res;
  if (spec.kind !== 'dyn' && person) holdUntil = clock.elapsedTime + act(spec.kind, p);
  const rad = spec.r, gx0 = Math.max(1, Math.floor((p.x - rad + HALF) * RES)), gx1 = Math.min(GN - 2, Math.ceil((p.x + rad + HALF) * RES));
  const gz0 = Math.max(1, Math.floor((p.z - rad + HALF) * RES)), gz1 = Math.min(GN - 2, Math.ceil((p.z + rad + HALF) * RES));
  const MATS = D.MATS3D;
  let hardSum = 0, hardN = 0;
  const struck = new Set();
  for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) {
    const X = wx(gx), Z = wz(gz), dd = Math.hypot(X - p.x, Z - p.z);
    if (dd > rad) continue;
    const i = vIdx(gx, gz);
    const cur = target[i];
    if (cur <= -MAXD + 0.001) continue;
    const m = MATS[strata(-cur)];
    const hp = m.hp;
    // the brush is made for the last few centimetres over a find: there it cleans fast whatever the ground
    let overFind = false;
    if (spec.kind === 'brush') for (const o of arts) if (!o.z.done && X >= o.x0 - 0.15 && X <= o.x1 + 0.15 && Z >= o.z0 - 0.15 && Z <= o.z1 + 0.15 && cur + o.top < 0.4) { overFind = true; break; }
    const hardMul = spec.kind === 'brush' ? (overFind ? 1.8 : m.hard > 0.4 ? 0.4 : 1) : 1;
    const u = dd / rad, fall = u < 0.62 ? 1 : Math.max(0.08, 1 - Math.pow((u - 0.62) / 0.38, 1.4) * 0.92);
    let lower = (spec.power * 0.2 * fall * hardMul) / (hp * 0.5);
    let next = Math.max(-MAXD, cur - lower);
    // a stone in the way takes the blow instead
    for (const st of stones) {
      if (!st.alive) continue;
      if (Math.hypot(X - st.x, Z - st.z) < st.r * 0.95 && next < -(st.top - st.r * 0.6) && cur > -(st.top + st.r)) {
        next = Math.max(next, -(st.top - st.r * 0.6)); struck.add(st);
      }
    }
    // a find in the way stops the ground at its surface; overkill hurts it
    for (const o of arts) {
      if (o.z.done) continue;
      if (X >= o.x0 && X <= o.x1 && Z >= o.z0 && Z <= o.z1 && next < -o.top) {
        const over = -o.top - next;
        if (spec.harm) res.harmed.set(o.z, (res.harmed.get(o.z) || 0) + (over * spec.harm * 4) / Math.max(1, o.verts.length));
        next = Math.min(cur, -o.top);
      }
    }
    for (const o of items) {
      if (o.z.done) continue;
      if (X >= o.x0 && X <= o.x1 && Z >= o.z0 && Z <= o.z1 && next < -o.top) next = Math.min(cur, -o.top);
    }
    if (next < cur - 1e-4) { res.touched = true; res.removed += cur - next; target[i] = next; }
    else if (cur > -MAXD + 0.01) res.touched = true;
    hardSum += m.hard; hardN++;
    if (hardN === 1) res.colors = [m.c[0], m.c[1], m.sp];
  }
  res.hard = hardN ? hardSum / hardN : 0.2;
  for (const st of struck) {
    st.hp -= spec.power * (spec.kind === 'brush' ? 0.15 : 1);
    res.touched = true;
    if (st.hp <= 0) { st.alive = false; scene.remove(st.mesh); burst(new THREE.Vector3(st.x, -st.top, st.z), ['#8d8780', '#6a655f', '#b4aea6'], 26, 1.3); res.stoneBroke = true; }
    else res.stoneHit = true;
  }
  if (res.removed > 0) { moving = true; heapVol += res.removed / (RES * RES); }
  // exposure of finds and items
  for (const o of [...arts, ...items]) {
    if (o.z.done) continue;
    let n = 0;
    for (const i of o.verts) if (target[i] <= -o.top + 0.03) n++;
    o.z.exposed = n;
    if (n > 0 && !o.exposedFirst) { o.exposedFirst = true; res.first.push(o.z); }
    if (n >= o.verts.length * (o.z.f ? 0.72 : 0.6)) res.done.push(o.z);
  }
  updateGlints();
  return res;
}

function updateGlints() {
  const det = (dig.lo && dig.lo.det) || 1;
  glints = [];
  for (const o of arts) {
    if (o.z.done) continue;
    const m = det * 0.55;
    let near = false;
    const gx0 = Math.max(0, Math.floor((o.x0 - m + HALF) * RES)), gx1 = Math.min(GN - 1, Math.ceil((o.x1 + m + HALF) * RES));
    const gz0 = Math.max(0, Math.floor((o.z0 - m + HALF) * RES)), gz1 = Math.min(GN - 1, Math.ceil((o.z1 + m + HALF) * RES));
    for (let gz = gz0; gz <= gz1 && !near; gz += 2) for (let gx = gx0; gx <= gx1; gx += 2) if (target[vIdx(gx, gz)] <= -(o.top - det * 0.42)) { near = true; break; }
    if (near) glints.push(o);
  }
}

function heightAt(x, z) {
  const gx = clamp(Math.round((x + HALF) * RES), 0, GN - 1), gz = clamp(Math.round((z + HALF) * RES), 0, GN - 1);
  return target ? target[vIdx(gx, gz)] : 0;
}
function eraAt(x, z) {
  if (!dig) return null;
  const d = -heightAt(x, z);
  const r = clamp(Math.floor(d / ROWD), 0, ROWS - 1);
  return { depth: d, era: dig.eras[dig.rowEra[r]] };
}

/* ---------- effects ---------- */
let debris, debrisData = [], dustPts, dustData = [], sparkPts, sparkData = [], beams = [], lifts = [], labels = [], sonarT = -1, shake = 0;
function softTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t;
}
function pointsLayer(n, additive, size) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(n), 1));
  g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(n), 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { tex: { value: softTex() }, scale: { value: size } },
    vertexShader: 'attribute float alpha; attribute float size; attribute vec3 color; varying float vA; varying vec3 vC; uniform float scale; void main(){ vA = alpha; vC = color; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = size*scale/(-mv.z); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform sampler2D tex; varying float vA; varying vec3 vC; void main(){ vec4 t = texture2D(tex, gl_PointCoord); gl_FragColor = vec4(vC, t.a*vA); }',
  });
  const p = new THREE.Points(g, mat); p.frustumCulled = false; scene.add(p);
  return p;
}
function buildFx() {
  debris = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.05, 0), new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), 260);
  debris.castShadow = true; debris.frustumCulled = false; debris.count = 0; scene.add(debris);
  debrisData = []; dustData = []; sparkData = []; beams = []; lifts = []; labels.forEach((l) => l.el.remove()); labels = [];
  dustPts = pointsLayer(400, false, 420);
  sparkPts = pointsLayer(500, true, 300);
}
const tmpC = new THREE.Color(), tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3();
function burst(p, colors, n, power = 1) {
  if (clock.elapsedTime < holdUntil) { const q = p.clone(); pendingFx.push(() => burst(q, colors, n, power)); return; }
  for (let i = 0; i < n && debrisData.length < 260; i++) {
    const a = Math.random() * Math.PI * 2, up = 2 + Math.random() * 3.2;
    debrisData.push({ p: p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.05, (Math.random() - 0.5) * 0.3)), v: new THREE.Vector3(Math.cos(a) * (0.6 + Math.random() * 1.6) * power, up * power, Math.sin(a) * (0.6 + Math.random() * 1.6) * power), r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0), s: 0.5 + Math.random() * 1.3, c: colors[i % colors.length], t: 0, life: 1.1 + Math.random() * 0.6 });
  }
}
function dust(p, color = '#c8b08a', n = 6, spread = 0.4) {
  if (clock.elapsedTime < holdUntil) { const q = p.clone(); pendingFx.push(() => dust(q, color, n, spread)); return; }
  for (let i = 0; i < n && dustData.length < 400; i++) dustData.push({ p: p.clone().add(new THREE.Vector3((Math.random() - 0.5) * spread, Math.random() * 0.2, (Math.random() - 0.5) * spread)), v: new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.3 + Math.random() * 0.5, (Math.random() - 0.5) * 0.4), c: new THREE.Color(color), t: 0, life: 1.4 + Math.random(), s: 1 + Math.random() });
}
function sparkle(p, color = '#fff3b0', n = 1, spread = 0.3) {
  for (let i = 0; i < n && sparkData.length < 500; i++) sparkData.push({ p: p.clone().add(new THREE.Vector3((Math.random() - 0.5) * spread, Math.random() * 0.1, (Math.random() - 0.5) * spread)), v: new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.4 + Math.random() * 0.6, (Math.random() - 0.5) * 0.3), c: new THREE.Color(color), t: 0, life: 0.7 + Math.random() * 0.7, s: 0.6 + Math.random() * 0.9 });
}
function floatText(p, text, color = '#fff', big = false) {
  if (!overlay) return;
  if (clock.elapsedTime < holdUntil) { const q = p.clone(); pendingFx.push(() => floatText(q, text, color, big)); return; }
  const el = document.createElement('div'); el.className = 'f3d' + (big ? ' big' : ''); el.textContent = text; el.style.color = color;
  overlay.appendChild(el);
  labels.push({ el, p: p.clone(), t: 0, life: big ? 1.7 : 1.2 });
}
function project(p) {
  tmpV.copy(p).project(camera);
  return { x: (tmpV.x * 0.5 + 0.5) * host.clientWidth, y: (-tmpV.y * 0.5 + 0.5) * host.clientHeight, behind: tmpV.z > 1 };
}
// a find rises out of the ground, turns in the light and flies away
function lift(z, color, rank) {
  if (clock.elapsedTime < holdUntil) { pendingFx.push(() => lift(z, color, rank)); return; }
  const o = arts.find((a) => a.z === z) || items.find((a) => a.z === z);
  if (!o) return;
  // the digger cheers and the camera leans in on the find
  cheer();
  if (z.f) focus = { pos: o.mesh.position.clone(), t: 0, life: rank >= 2 ? 2.4 : 1.6 };
  const m = o.mesh;
  const start = m.position.clone();
  m.material.depthTest = true;
  lifts.push({ m, start, t: 0, color: new THREE.Color(color), rank });
  if (rank >= 2) {
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 14, 32, 1, true), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { c: { value: new THREE.Color(color) }, a: { value: 0 } },
      vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 c; uniform float a; varying vec2 vU; void main(){ gl_FragColor = vec4(c, a*pow(1.0 - vU.y, 1.5)*0.55); }',
    }));
    beam.position.copy(start).add(new THREE.Vector3(0, 7, 0)); scene.add(beam);
    beams.push({ m: beam, t: 0, life: 2.2 });
  }
  for (let i = 0; i < 10 + rank * 10; i++) sparkle(start, color, 1, 0.9);
}

/* ---------- camera ---------- */
let camYaw = 0.55, camPitch = 0.98, camDist = 15.5, camZoom = 1;
const camT = new THREE.Vector3(0, -0.6, 0), camLook = new THREE.Vector3(0, -0.6, 0);
function updateCamera(dt, t) {
  if (mode === 'showcase') camYaw = 0.5 + Math.sin(t * 0.08) * 0.6;
  // follow the pit down a little
  if (dig && target && mode === 'dig' && !viewLock) {
    let s = 0, n = 0;
    for (let i = 0; i < target.length; i += 23) { if (target[i] < -0.05) { s += target[i]; n++; } }
    camT.y = n ? Math.max(-2.4, (s / n) * 0.5) - 0.4 : -0.5;
  }
  let tgt = camT, dmul = 1;
  if (focus) { focus.t += dt; if (focus.t > focus.life) focus = null; else { tgt = focus.pos; dmul = 0.55 + 0.45 * ease((focus.t - focus.life + 0.6) / 0.6); } }
  camLook.lerp(tgt, 1 - Math.pow(0.02, dt));
  camZoom += (dmul - camZoom) * (1 - Math.pow(0.03, dt));
  const sx = shake > 0.002 ? (Math.random() - 0.5) * shake : 0, sy = shake > 0.002 ? (Math.random() - 0.5) * shake : 0;
  const dist = camDist * camZoom * (camera.aspect < 0.8 ? 1.42 : 1);
  camera.position.set(camLook.x + Math.sin(camYaw) * Math.cos(camPitch) * dist + sx, camLook.y + Math.sin(camPitch) * dist + sy, camLook.z + Math.cos(camYaw) * Math.cos(camPitch) * dist);
  camera.lookAt(camLook);
  shake *= Math.pow(0.002, dt);
}

/* ---------- frame ---------- */
function frame() {
  if (!running) return;
  requestAnimationFrame(frame);
  const raw = clock.getDelta(), dt = Math.min(0.05, raw), t = clock.elapsedTime;
  // keep it smooth: if frames get slow, drop the ambient occlusion first
  if (aoPass && aoPass.enabled) { slow = slow * 0.95 + (raw > 0.045 ? 1 : 0) * 0.05; if (slow > 0.6) aoPass.enabled = false; }
  U.uTime.value = t;
  // the ground settles into its new shape over a few frames
  if (moving && heights && t >= holdUntil) {
    let still = true; const pos = tGeo.attributes.position;
    const k = 1 - Math.pow(0.0005, dt);
    for (let i = 0; i < heights.length; i++) {
      const d = target[i] - heights[i];
      if (d !== 0) { if (Math.abs(d) < 0.002) heights[i] = target[i]; else { heights[i] += d * k; still = false; } pos.setY(i, heights[i]); }
    }
    pos.needsUpdate = true; tGeo.computeVertexNormals();
    if (still) moving = false;
  }
  // the spoil heap
  const hs = Math.cbrt(Math.max(0.0001, heapVol)) * 0.95;
  heap.scale.lerp(tmpV.set(hs * 1.25, hs * 0.75, hs), 1 - Math.pow(0.05, dt));
  // glints over finds that are close
  for (const o of glints) if (Math.random() < dt * 2.2) sparkle(new THREE.Vector3(o.x0 + Math.random() * (o.x1 - o.x0), Math.max(heightAt(o.x0 + (o.x1 - o.x0) / 2, o.z0 + (o.z1 - o.z0) / 2), -o.top) + 0.05, o.z0 + Math.random() * (o.z1 - o.z0)), '#fff1b0', 1, 0.05);
  // exposed finds glow softly by rarity
  for (const o of arts) if (!o.z.done && o.z.exposed > 0 && o.z.f) { const rk = D.RARITY[o.z.f.rarity].rank; o.mesh.material.emissiveIntensity = 0.08 + rk * 0.07 + Math.sin(t * 3 + o.top) * 0.05 * (1 + rk); }
  // sonar
  if (sonarT >= 0) { sonarT += dt; U.uSonar.value.w = sonarT; if (sonarT > 3.2) { sonarT = -1; U.uSonar.value.w = -1; holo(false); } }
  // debris
  let k = 0;
  debrisData = debrisData.filter((d) => (d.t += dt) < d.life);
  for (const d of debrisData) {
    d.v.y -= 9.8 * dt; d.p.addScaledVector(d.v, dt);
    const gy = Math.abs(d.p.x) < HALF && Math.abs(d.p.z) < HALF ? heightAt(d.p.x, d.p.z) : 0;
    if (d.p.y < gy + 0.03) { d.p.y = gy + 0.03; d.v.y *= -0.3; d.v.x *= 0.6; d.v.z *= 0.6; }
    d.r.x += dt * 8; d.r.y += dt * 6;
    const s = d.s * Math.min(1, (d.life - d.t) * 3);
    tmpM.compose(d.p, tmpQ.setFromEuler(d.r), tmpV.set(s, s, s));
    debris.setMatrixAt(k, tmpM); debris.setColorAt(k, tmpC.set(d.c)); k++;
  }
  debris.count = k; debris.instanceMatrix.needsUpdate = true; if (debris.instanceColor) debris.instanceColor.needsUpdate = true;
  // dust and sparks
  const upd = (pts, data, grow) => {
    data.splice(0, data.length, ...data.filter((d) => (d.t += dt) < d.life));
    const P = pts.geometry.attributes.position, C = pts.geometry.attributes.color, A = pts.geometry.attributes.alpha, S = pts.geometry.attributes.size;
    for (let i = 0; i < data.length; i++) {
      const d = data[i]; d.p.addScaledVector(d.v, dt); d.v.multiplyScalar(1 - dt * 0.8);
      const f = d.t / d.life;
      P.setXYZ(i, d.p.x, d.p.y, d.p.z); C.setXYZ(i, d.c.r, d.c.g, d.c.b);
      A.setX(i, grow ? (1 - f) * 0.55 : (1 - f) * (0.6 + 0.4 * Math.sin(d.t * 30)));
      S.setX(i, grow ? d.s * (0.6 + f * 1.8) : d.s * (1 - f * 0.5));
    }
    pts.geometry.setDrawRange(0, data.length);
    P.needsUpdate = C.needsUpdate = A.needsUpdate = S.needsUpdate = true;
  };
  upd(dustPts, dustData, true); upd(sparkPts, sparkData, false);
  // lifting finds
  lifts = lifts.filter((l) => (l.t += dt) < 1.9);
  for (const l of lifts) {
    const e = Math.min(1, l.t / 0.9);
    l.m.position.set(l.start.x, l.start.y + (1 - Math.pow(1 - e, 3)) * 1.8 + (l.t > 0.9 ? (l.t - 0.9) * (l.t - 0.9) * 9 : 0), l.start.z);
    l.m.rotation.set(-Math.PI / 2 + Math.sin(l.t * 2) * 0.4 * e, 0, l.t * 3.2);
    const s = 1 + e * 0.35 - (l.t > 1.2 ? (l.t - 1.2) * 1.4 : 0);
    l.m.scale.setScalar(Math.max(0.01, s));
    l.m.material.emissiveIntensity = 0.3 + e * (0.6 + l.rank * 0.35);
    if (Math.random() < 0.5) sparkle(l.m.position, '#' + l.color.getHexString(), 1, 0.4);
    if (l.t > 1.85) scene.remove(l.m);
  }
  beams = beams.filter((b) => { b.t += dt; b.m.material.uniforms.a.value = Math.sin(Math.min(1, b.t / b.life) * Math.PI); if (b.t > b.life) { scene.remove(b.m); return false; } return true; });
  updateCamera(dt, t);
  updatePerson(dt, t);
  if (pendingFx.length && t >= holdUntil) { const q = pendingFx; pendingFx = []; q.forEach((fn) => fn()); }
  if (mode === 'showcase' && person && (!person.nextDig || t > person.nextDig)) {
    // on the opening screen he keeps working the trench
    const spot = showSpot;
    const d = act('pick', spot); person.nextDig = t + 1.7;
    showcaseHits.push({ at: t + d, p: spot });
  }
  showcaseHits = showcaseHits.filter((h) => { if (t >= h.at) { burst(h.p, ['#8a6a48', '#5a4030', '#b89a72'], 8, 0.7); dust(h.p, '#bfa47c', 5, 0.5); shake = Math.max(shake, mode === 'showcase' ? 0 : 0.05); return false; } return true; });
  // labels follow their point in the world
  labels = labels.filter((l) => {
    l.t += dt; const f = l.t / l.life;
    if (f >= 1) { l.el.remove(); return false; }
    const s = project(tmpV.copy(l.p).add(new THREE.Vector3(0, f * 0.9, 0)));
    l.el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%) scale(${f < 0.12 ? 0.6 + f * 3.3 : 1})`;
    l.el.style.opacity = f > 0.75 ? (1 - f) / 0.25 : 1;
    return true;
  });
  if (mode === 'showcase') for (const o of arts) if (Math.random() < dt * 0.6) sparkle(o.mesh.position, D.RARITY[o.z.f.rarity].color, 1, 0.5);
  composer.render();
}

/* ---------- sonar hologram ---------- */
let holoMeshes = [];
function holo(on, p) {
  holoMeshes.forEach((m) => scene.remove(m)); holoMeshes = [];
  if (!on) return;
  for (const o of [...arts, ...items]) {
    if (o.z.done) continue;
    const cx = (o.x0 + o.x1) / 2, cz = (o.z0 + o.z1) / 2;
    if (Math.hypot(cx - p.x, cz - p.z) > 2.9) continue;
    const m = o.mesh.clone();
    m.material = new THREE.MeshBasicMaterial({ map: o.mesh.material.map, color: o.z.f ? D.RARITY[o.z.f.rarity].color : '#7fe7ff', transparent: true, opacity: 0.85, depthTest: false, blending: THREE.AdditiveBlending, alphaTest: 0.2 });
    m.renderOrder = 10; scene.add(m); holoMeshes.push(m);
  }
}

/* ---------- input ---------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let hoverP = null, pointers = new Map(), pinch0 = 0, orbit = null;
function pick(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObject(terrain, false)[0];
  if (!hit || Math.abs(hit.point.x) > HALF - 0.05 || Math.abs(hit.point.z) > HALF - 0.05) return null;
  return hit.point.clone();
}
function setHover(p, radius, color) {
  hoverP = p;
  U.uHoverOn.value = p ? 1 : 0;
  if (p) { U.uHover.value.copy(p); U.uHoverR.value = radius; U.uHoverC.value.set(color); }
}
function bindInput() {
  const el = renderer.domElement;
  el.style.touchAction = 'none';
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('pointerdown', (e) => {
    if (mode !== 'dig') return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ }
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); orbit = { x: (a.x + b.x) / 2, yaw: camYaw, pitch: camPitch, dist: camDist, y: (a.y + b.y) / 2 }; handlers.release && handlers.release(); return; }
    if (e.button === 2) { orbit = { x: e.clientX, y: e.clientY, yaw: camYaw, pitch: camPitch, dist: camDist }; return; }
    const p = pick(e);
    if (p && handlers.down) handlers.down(p);
  });
  el.addEventListener('pointermove', (e) => {
    if (mode !== 'dig') return;
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (orbit && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      camYaw = orbit.yaw - (((a.x + b.x) / 2) - orbit.x) * 0.006;
      camPitch = clamp(orbit.pitch + (((a.y + b.y) / 2) - orbit.y) * 0.004, 0.45, 1.35);
      camDist = clamp(orbit.dist * pinch0 / Math.max(40, Math.hypot(a.x - b.x, a.y - b.y)), 8, 24);
      return;
    }
    if (orbit && e.buttons & 2) { camYaw = orbit.yaw - (e.clientX - orbit.x) * 0.006; camPitch = clamp(orbit.pitch + (e.clientY - orbit.y) * 0.004, 0.45, 1.35); return; }
    const p = pick(e);
    if (handlers.move) handlers.move(p);
  });
  const up = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) orbit = null; if (handlers.release) handlers.release(); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('pointerleave', () => { if (!pointers.size && handlers.move) handlers.move(null); });
  el.addEventListener('wheel', (e) => { if (mode !== 'dig') return; e.preventDefault(); camDist = clamp(camDist * (1 + Math.sign(e.deltaY) * 0.08), 8, 24); }, { passive: false });
}

/* ---------- public ---------- */
let inputBound = false;
function start(el, dg, site, h) {
  if (!attach(el)) return false;
  handlers = h || {};
  buildWorld(site, true);
  prepareDig(dg);
  if (!inputBound) { bindInput(); inputBound = true; }
  mode = 'dig';
  if (!running) { running = true; clock.getDelta(); requestAnimationFrame(frame); }
  return true;
}
function showcase(el, dg, site) {
  if (!attach(el)) return false;
  buildWorld(site);
  prepareDig(dg);
  // a half-dug trench with finds showing, for the opening screen
  for (const o of arts) {
    const cx = (o.x0 + o.x1) / 2, cz = (o.z0 + o.z1) / 2, rr = Math.max(o.x1 - o.x0, o.z1 - o.z0) / 2 + 0.9;
    for (let gz = 0; gz < GN; gz++) for (let gx = 0; gx < GN; gx++) {
      if (gx === 0 || gz === 0 || gx === GN - 1 || gz === GN - 1) continue;
      const X = wx(gx), Z = wz(gz), d = Math.max(Math.abs(X - cx) - (o.x1 - o.x0) / 2, Math.abs(Z - cz) - (o.z1 - o.z0) / 2);
      const want = d <= 0 ? -o.top : -o.top + Math.max(0, d / 0.9) * o.top;
      if (d < rr) { const i = vIdx(gx, gz); target[i] = Math.min(target[i], Math.min(0, want)); }
    }
    o.z.exposed = o.verts.length;
    o.mesh.material.emissiveIntensity = 0.25;
  }
  heights.set(target); const pos = tGeo.attributes.position; for (let i = 0; i < heights.length; i++) pos.setY(i, heights[i]); pos.needsUpdate = true; tGeo.computeVertexNormals();
  heapVol = 2.2;
  // he works a spot in the trench; the camera frames him low on the screen, under the title
  const o = arts[0];
  // a spot on untouched ground at the lip of the pit, so he stands in plain view
  showSpot = new THREE.Vector3(0, 0, 0);
  if (o) {
    const cx = (o.x0 + o.x1) / 2, cz = (o.z0 + o.z1) / 2; let best = Infinity;
    for (let gz = 6; gz < GN - 6; gz += 2) for (let gx = 6; gx < GN - 6; gx += 2) {
      const X = wx(gx), Z = wz(gz); if (target[vIdx(gx, gz)] < -0.02) continue;
      const d = Math.hypot(X - cx, Z - cz); if (d < best) { best = d; showSpot.set(X, 0, Z); }
    }
  }
  camYaw = 0.5; camPitch = 0.3; camDist = 7.6;
  if (person) { person.pos.copy(standFor(showSpot, 'pick')); person.goal.copy(person.pos); person.nextDig = 0; }
  camT.copy(showSpot).add(new THREE.Vector3(0, 3.4, 0));
  mode = 'showcase';
  if (!running) { running = true; clock.getDelta(); requestAnimationFrame(frame); }
  return true;
}
function stop() { running = false; mode = 'idle'; setHover(null); }

window.DIG3D = {
  start, showcase, stop, carve, setHover, heightAt, eraAt, project,
  fx: { burst: (p, c, n, pw) => burst(p, c, n, pw), dust, sparkle, float: floatText, lift, shake: (a) => { shake = Math.max(shake, a); } },
  sonar(p) { sonarT = 0; U.uSonar.value.set(p.x, p.y, p.z, 0); holo(true, p); },
  artCenter(z) { const o = arts.find((a) => a.z === z) || items.find((a) => a.z === z); return o ? new THREE.Vector3((o.x0 + o.x1) / 2, -o.top + 0.1, (o.z0 + o.z1) / 2) : new THREE.Vector3(); },
  rotate(dir) { camYaw += dir * Math.PI / 4; },
  setTool(kind) { showTool(kind); },
  // point the camera somewhere (used by checks and by close-ups)
  view(x, y, z, dist, pitch, yaw) { camT.set(x, y, z); camLook.set(x, y, z); camDist = dist; camPitch = pitch; camYaw = yaw; mode = mode === 'dig' ? 'dig' : mode; viewLock = true; },
  personAt: () => person && person.pos.clone(),
  _person: () => person,
  vec: (x, y, z) => new THREE.Vector3(x, y, z),
  supported: !!window.WebGL2RenderingContext,
};
window.dispatchEvent(new Event('dig3d-ready'));
