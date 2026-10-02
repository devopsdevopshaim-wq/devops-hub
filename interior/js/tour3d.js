/* 3D walkthrough with photographic lighting: first-person walk with 360° look-around,
   plus a dollhouse view. ES module on three.js r160 (vendored).
   Real product-style 3D models (Khronos glTF sample assets by Wayfair and others)
   replace the generated furniture where one fits; everything else is modelled here. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const EYE = 1.6;
const RADIUS = 0.22;
const ASSETS = new URL('../assets/', import.meta.url).href;

// which real model stands in for which planned piece, per style
const MODELS = {
  velvetSofa: 'models/GlamVelvetSofa.glb',
  leatherSofa: 'models/SheenWoodLeatherSofa.glb',
  armchair: 'models/SheenChair.glb',
  damaskChair: 'models/ChairDamaskPurplegold.glb',
  plant: 'models/DiffuseTransmissionPlant.glb',
  vase: 'models/GlassVaseFlowers.glb'
};
function modelFor(type, styleKey) {
  if (type === 'sofa3' || type === 'sofa2') return ['industrial', 'classic'].includes(styleKey) ? 'leatherSofa' : 'velvetSofa';
  if (type === 'armchair') return ['classic', 'boho'].includes(styleKey) ? 'damaskChair' : 'armchair';
  if (type === 'plant') return 'plant';
  return null;
}

const VARIANT = {
  velvetSofa: { scandi: 'GlamVelvetSofa_fabric_gray', japandi: 'GlamVelvetSofa_fabric_champagne', boho: 'GlamVelvetSofa_fabric_champagne', modern: 'GlamVelvetSofa_fabric_navy' },
  armchair: { scandi: 'fabric Mystere Peacock Velvet', modern: 'fabric Mystere Peacock Velvet', industrial: 'fabric Mystere Peacock Velvet' }
};

/* ---------- procedural textures ---------- */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function canvasTex(w, h, draw, srgb) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function hsl(hex, dl, ds) {
  const c = new THREE.Color(hex);
  const o = {};
  c.getHSL(o);
  c.setHSL(o.h, Math.max(0, Math.min(1, o.s + (ds || 0))), Math.max(0, Math.min(1, o.l + dl)));
  return '#' + c.getHexString();
}
const TEX = {
  fabric(color) {
    return canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = color; g.fillRect(0, 0, w, h);
      const r = rng(7);
      for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.04})`; g.fillRect(0, y, w, 1); }
      for (let x = 0; x < w; x += 2) { g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.04})`; g.fillRect(x, 0, 1, h); }
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '0,0,0'},0.05)`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1); }
    });
  },
  fabricBump() {
    return canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 2) { g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, y, w, 1); }
      for (let x = 0; x < w; x += 4) { g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x, 0, 2, h); }
    }, false);
  },
  wood(color) {
    return canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = color; g.fillRect(0, 0, w, h);
      const r = rng(11);
      for (let i = 0; i < 140; i++) {
        const y0 = r() * h, amp = 2 + r() * 6, f = 0.004 + r() * 0.01, ph = r() * 6;
        g.strokeStyle = r() > 0.5 ? `rgba(0,0,0,${0.04 + r() * 0.08})` : `rgba(255,255,255,${0.03 + r() * 0.05})`;
        g.lineWidth = 0.6 + r() * 2.2;
        g.beginPath();
        for (let x = 0; x <= w; x += 8) g.lineTo(x, y0 + Math.sin(x * f + ph) * amp);
        g.stroke();
      }
    });
  },
  marble() {
    return canvasTex(1024, 512, (g, w, h) => {
      g.fillStyle = '#eeece8'; g.fillRect(0, 0, w, h);
      const r = rng(5);
      g.filter = 'blur(1.2px)';
      for (let i = 0; i < 26; i++) {
        let x = r() * w, y = r() * h;
        g.strokeStyle = `rgba(110,110,115,${0.1 + r() * 0.25})`;
        g.lineWidth = 0.6 + r() * 1.8;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 40; k++) { x += 8 + r() * 26; y += (r() - 0.5) * 30; g.lineTo(x, y); }
        g.stroke();
      }
      g.filter = 'none';
    });
  },
  tile(base, n, grout) {
    return canvasTex(512, 512, (g, w, h) => {
      const r = rng(3);
      const s = w / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        g.fillStyle = hsl(base, (r() - 0.5) * 0.03);
        g.fillRect(i * s, j * s, s, s);
        for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(0,0,0,${r() * 0.03})`; g.fillRect(i * s + r() * s, j * s + r() * s, 2 + r() * 10, 1 + r() * 3); }
      }
      g.strokeStyle = grout; g.lineWidth = 2.5;
      for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
    });
  },
  tileBump(n) {
    return canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#000'; g.lineWidth = 4;
      const s = w / n;
      for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
    }, false);
  },
  concrete(base) {
    return canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      const r = rng(9);
      for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '0,0,0'},${r() * 0.05})`; g.fillRect(r() * w, r() * h, 1 + r() * 4, 1 + r() * 4); }
      g.filter = 'blur(10px)';
      for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.05})`; g.beginPath(); g.arc(r() * w, r() * h, 20 + r() * 60, 0, 7); g.fill(); }
      g.filter = 'none';
    });
  },
  plaster() {
    return canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
      const r = rng(21);
      for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '0,0,0'},0.08)`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
    }, false);
  },
  rug(style) {
    return canvasTex(512, 512, (g, w, h) => {
      const r = rng(17);
      g.fillStyle = style.rug; g.fillRect(0, 0, w, h);
      if (style.key === 'boho' || style.key === 'classic') {
        g.strokeStyle = hsl(style.rug, -0.18); g.lineWidth = 10;
        g.strokeRect(24, 24, w - 48, h - 48);
        g.fillStyle = hsl(style.accent, 0.05);
        for (let y = 80; y < h - 60; y += 70) for (let x = 80; x < w - 60; x += 70) {
          g.beginPath(); g.moveTo(x, y - 22); g.lineTo(x + 22, y); g.lineTo(x, y + 22); g.lineTo(x - 22, y); g.closePath(); g.fill();
        }
      } else {
        g.strokeStyle = hsl(style.rug, -0.08); g.lineWidth = 6; g.strokeRect(18, 18, w - 36, h - 36);
      }
      for (let i = 0; i < 12000; i++) { g.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '0,0,0'},0.05)`; g.fillRect(r() * w, r() * h, 1, 2); }
    });
  },
  art(style, seed) {
    return canvasTex(512, 640, (g, w, h) => {
      const r = rng(seed);
      g.fillStyle = hsl(style.wall, -0.02); g.fillRect(0, 0, w, h);
      const cols = [style.accent, style.fabric2, style.wood, hsl(style.accent, 0.2), '#e9dcc8'];
      for (let i = 0; i < 6; i++) {
        g.fillStyle = cols[i % cols.length];
        g.globalAlpha = 0.75;
        if (r() > 0.5) { g.beginPath(); g.arc(r() * w, r() * h, 60 + r() * 140, 0, 7); g.fill(); }
        else { g.save(); g.translate(r() * w, r() * h); g.rotate(r() * 3); g.fillRect(-100, -30, 200 + r() * 120, 60 + r() * 90); g.restore(); }
      }
      g.globalAlpha = 1;
    });
  },
  grass() {
    return canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#5f8a3a'; g.fillRect(0, 0, w, h);
      const r = rng(31);
      for (let i = 0; i < 26000; i++) {
        const l = r();
        g.fillStyle = l > 0.66 ? 'rgba(160,200,90,0.35)' : l > 0.33 ? 'rgba(40,80,20,0.35)' : 'rgba(110,150,60,0.3)';
        g.fillRect(r() * w, r() * h, 1, 2 + r() * 4);
      }
    });
  },
  gravel() {
    return canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#b9ad98'; g.fillRect(0, 0, w, h);
      const r = rng(41);
      for (let i = 0; i < 9000; i++) {
        const c = 150 + r() * 90;
        g.fillStyle = `rgb(${c},${c - 8},${c - 22})`;
        g.beginPath(); g.ellipse(r() * w, r() * h, 1 + r() * 3, 1 + r() * 2.5, r() * 3, 0, 7); g.fill();
      }
    });
  },
  stone() {
    return canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#cbbfa9'; g.fillRect(0, 0, w, h);
      const r = rng(51);
      let y = 0;
      while (y < h) {
        const bh = 40 + r() * 30;
        let x = -r() * 60;
        while (x < w) {
          const bw = 60 + r() * 90;
          g.fillStyle = hsl('#cbbfa9', (r() - 0.5) * 0.12);
          g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
          x += bw;
        }
        y += bh;
      }
      for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.06})`; g.fillRect(r() * w, r() * h, 2, 2); }
    });
  },
  water() {
    return canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#8080ff'; g.fillRect(0, 0, w, h);
      const r = rng(61);
      for (let i = 0; i < 90; i++) {
        const x = r() * w, y = r() * h, rad = 8 + r() * 30;
        const gr = g.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, `rgba(${r() > 0.5 ? '160,160,255' : '100,100,255'},0.5)`);
        gr.addColorStop(1, 'rgba(128,128,255,0)');
        g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
    }, false);
  },
  shadow() {
    return canvasTex(128, 128, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(0,0,0,0.55)');
      gr.addColorStop(0.55, 'rgba(0,0,0,0.3)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
  }
};

/* ---------- the tour ---------- */
// software rendering (no graphics card): keep the heavy effects off
function softwareGL(r) {
  try {
    const gl = r.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    return /swiftshader|llvmpipe|software|basic render/i.test(name);
  } catch (e) { return false; }
}

// bounding box of the visible pixels of a rendered cut-out
function alphaBox(img, W, H) {
  const d = img.data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y += 2) {
    const row = y * W * 4;
    for (let x = 0; x < W; x += 2) {
      if (d[row + x * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  if (x1 < 0) return null;
  x0 = Math.max(0, x0 - 3); y0 = Math.max(0, y0 - 3);
  x1 = Math.min(W - 1, x1 + 3); y1 = Math.min(H - 1, y1 + 3);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export class Tour {
  constructor(container, opts) {
    this.el = container;
    this.opts = opts || {};
    this.mode = 'walk';
    this.yaw = 0;
    this.pitch = -0.05;
    this.pos = new THREE.Vector3(1, EYE, 1);
    this.keys = {};
    this.hold = {};
    this.mats = {};
    this.texCache = {};
    this.blockers = [];
    this.pickables = [];
    this.spin = 0;
    this.orbit = { az: -0.7, el: 0.95, dist: 14, target: new THREE.Vector3() };
    this.walkTo = null;
    this.models = {};
    this.variants = {};

    const mobile = matchMedia('(pointer: coarse)').matches;
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = r;
    container.appendChild(r.domElement);
    r.domElement.className = 'tour-canvas';
    r.domElement.setAttribute('tabindex', '0');
    r.domElement.setAttribute('aria-label', 'סיור תלת-ממדי בדירה. גררו כדי להסתכל, חיצים או WASD כדי ללכת');

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 300);
    this.ray = new THREE.Raycaster();
    this.clock = new THREE.Clock();
    this.pmrem = new THREE.PMREMGenerator(r);

    // soft shadows where surfaces meet (ambient occlusion); off on phones to keep walking smooth
    this.software = softwareGL(r);
    this.quality = !mobile && !this.software;
    try {
      this.composer = new EffectComposer(r);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.gtao = new GTAOPass(this.scene, this.camera, 300, 300);
      this.gtao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 16 });
      this.gtao.updatePdMaterial({ radius: 6, rings: 2, samples: 16 });
      this.gtao.blendIntensity = 0.9;
      this.composer.addPass(this.gtao);
      this.composer.addPass(new OutputPass());
    } catch (e) { this.composer = null; }

    this.loadEnvironment();
    this.loadModels();
    this.bindInput();
    this.resize();
    r.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
      if (this.pt) { this.pt = null; }
      if (this.opts.onLost) this.opts.onLost(true);
    });
    r.domElement.addEventListener('webglcontextrestored', () => {
      this.lost = false;
      if (this.plan) this.load(this.plan);
      if (this.opts.onLost) this.opts.onLost(false);
    });
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.loop = this.loop.bind(this);
    this.running = true;
    r.setAnimationLoop(this.loop);
  }

  // hosts that do not serve .glb/.exr get them packed as base64 JSON (window.IH_PACKED_ASSETS)
  fetchBinary(path) {
    if (!window.IH_PACKED_ASSETS) return fetch(ASSETS + path).then((r) => { if (!r.ok) throw new Error(path); return r.arrayBuffer(); });
    return fetch(ASSETS + path + '.json').then((r) => r.json()).then((j) => {
      const bin = atob(j.b64);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out.buffer;
    });
  }

  loadEnvironment() {
    const exr = new EXRLoader();
    const load = (path, done) => this.fetchBinary(path).then((buf) => {
      const d = exr.parse(buf);
      const t = new THREE.DataTexture(d.data, d.width, d.height, d.format, d.type);
      t.colorSpace = d.colorSpace || THREE.LinearSRGBColorSpace;
      t.minFilter = t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      t.flipY = false;
      t.needsUpdate = true;
      t.mapping = THREE.EquirectangularReflectionMapping;
      done(t);
    }).catch(() => { /* plain lighting stays */ });
    load('hdri/apartment.exr', (t) => {
      this.envEquirect = t;
      this.envMap = this.pmrem.fromEquirectangular(t).texture;
      this.scene.environment = this.envMap;
    });
    load('hdri/city.exr', (t) => {
      this.skyCity = t;
      if (!this.plan || !this.plan.yard) { this.sky = t; this.scene.background = t; this.scene.backgroundIntensity = 1.6; }
    });
    load('hdri/park.exr', (t) => {
      this.skyPark = t;
      if (this.plan && this.plan.yard) { this.sky = t; this.scene.background = t; this.scene.backgroundIntensity = 1.3; }
    });
  }

  loadModels() {
    const loader = new GLTFLoader();
    Object.entries(MODELS).forEach(([key, file]) => {
      this.fetchBinary(file).then((buf) => loader.parseAsync(buf, ASSETS)).then((g) => {
        g.scene.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
            if (o.material) {
              o.material.envMapIntensity = 0.9;
              // maps that point at a second UV set the mesh does not carry fall back to the first
              if (!o.geometry.attributes.uv1) {
                ['aoMap', 'lightMap', 'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'sheenColorMap', 'sheenRoughnessMap', 'specularColorMap', 'specularIntensityMap'].forEach((k) => {
                  const t = o.material[k];
                  if (t && t.channel === 1) { t.channel = 0; o.material.needsUpdate = true; }
                });
              }
            }
          }
        });
        this.models[key] = g.scene;
        // colour variants that ship inside the model (KHR_materials_variants)
        g.parser.getDependencies('material').then((mats) => {
          this.variants[key] = {};
          mats.forEach((m) => {
            m.envMapIntensity = 0.9;
            ['aoMap', 'lightMap'].forEach((k) => { if (m[k] && m[k].channel === 1) m[k].channel = 0; });
            this.variants[key][m.name] = m;
          });
          if (this.plan) this.refreshModels(true);
        });
        if (this.plan) this.refreshModels();
      }).catch(() => { /* the generated piece stays */ });
    });
  }

  /* ---------- materials ---------- */
  tex(key, make) {
    if (!this.texCache[key]) this.texCache[key] = make();
    return this.texCache[key];
  }
  mat(key, make) {
    if (!this.mats[key]) this.mats[key] = make();
    return this.mats[key];
  }
  fabric(color) {
    return this.mat('fab' + color, () => new THREE.MeshPhysicalMaterial({
      color: '#ffffff', map: this.tex('fab' + color, () => TEX.fabric(color)), roughness: 0.92,
      bumpMap: this.tex('fabBump', TEX.fabricBump), bumpScale: 0.6,
      sheen: 0.6, sheenRoughness: 0.7, sheenColor: new THREE.Color(hsl(color, 0.25))
    }));
  }
  wood(color) {
    return this.mat('wood' + color, () => new THREE.MeshStandardMaterial({ map: this.tex('wood' + color, () => TEX.wood(color)), roughness: 0.55 }));
  }
  plain(color, rough, metal) {
    return this.mat(`p${color}${rough}${metal}`, () => new THREE.MeshStandardMaterial({ color, roughness: rough == null ? 0.6 : rough, metalness: metal || 0 }));
  }

  /* ---------- scene ---------- */
  load(plan) {
    this.plan = plan;
    const scene = this.scene;
    for (let i = scene.children.length - 1; i >= 0; i--) scene.remove(scene.children[i]);
    this.blockers = [];
    this.pickables = [];
    this.floors = [];
    this.itemGroups = {};
    this.selectedItem = null;
    const st = Object.assign({ key: plan.q.style }, plan.style);
    this.st = st;
    this.sky = plan.yard ? (this.skyPark || this.skyCity) : (this.skyCity || this.skyPark);
    if (this.sky) { scene.background = this.sky; scene.backgroundIntensity = plan.yard ? 1.3 : 1.6; }
    if (this.envMap) scene.environment = this.envMap;

    // daylight: a low sun through the front windows, plus a soft sky fill
    scene.add(new THREE.HemisphereLight('#f4f7fb', '#b4a48f', 0.35));
    const sun = new THREE.DirectionalLight('#fff1dc', 3.2);
    const Bd = plan.bounds || { x0: 0, y0: 0, x1: plan.W, y1: plan.D };
    sun.position.set((Bd.x0 + Bd.x1) * 0.35, 9, Bd.y0 - 7);
    sun.target.position.set(plan.W / 2, 0, plan.D / 2);
    sun.castShadow = true;
    const sc = sun.shadow.camera;
    const ext = Math.max(Bd.x1 - Bd.x0, Bd.y1 - Bd.y0) * 0.75 + 3;
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 0.5; sc.far = 40;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 3;
    scene.add(sun, sun.target);

    // land beyond the plot; around a private house the yard is cut out of it (the pool sits below it)
    let groundGeo;
    if (plan.yard) {
      const y = plan.yard, cx = plan.W / 2, cz = plan.D / 2;
      const sh = new THREE.Shape();
      sh.moveTo(cx - 150, -(cz - 150)); sh.lineTo(cx + 150, -(cz - 150)); sh.lineTo(cx + 150, -(cz + 150)); sh.lineTo(cx - 150, -(cz + 150)); sh.lineTo(cx - 150, -(cz - 150));
      const hole = new THREE.Path();
      hole.moveTo(y.x0, -y.y0); hole.lineTo(y.x0, -y.y1); hole.lineTo(y.x1, -y.y1); hole.lineTo(y.x1, -y.y0); hole.lineTo(y.x0, -y.y0);
      sh.holes.push(hole);
      groundGeo = new THREE.ShapeGeometry(sh);
      groundGeo.rotateX(-Math.PI / 2);
    }
    const ground = new THREE.Mesh(groundGeo || new THREE.PlaneGeometry(300, 300), this.plain('#9aa38f', 1));
    if (groundGeo) ground.position.y = -0.03;
    else { ground.rotation.x = -Math.PI / 2; ground.position.set(plan.W / 2, -0.03, plan.D / 2); }
    ground.receiveShadow = true;
    scene.add(ground);

    this.buildFloors();

    // ceiling with recessed lights
    this.ceiling = new THREE.Group();
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(plan.W, plan.D), this.mat('ceilingMat', () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#e9e6e0', emissiveIntensity: 0.55 })));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(plan.W / 2, plan.wallH, plan.D / 2);
    ceil.castShadow = true;
    this.ceiling.add(ceil);
    const spotMat = this.mat('spot', () => new THREE.MeshBasicMaterial({ color: '#fff6e6' }));
    const spotGeo = new THREE.CircleGeometry(0.05, 20);
    plan.rooms.filter((r) => !r.outdoor).forEach((rm) => {
      const nx = Math.max(1, Math.round(rm.w / 1.6)), nz = Math.max(1, Math.round(rm.d / 1.6));
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const s = new THREE.Mesh(spotGeo, spotMat);
        s.rotation.x = Math.PI / 2;
        s.position.set(rm.x + (rm.w * (i + 0.5)) / nx, plan.wallH - 0.002, rm.y + (rm.d * (j + 0.5)) / nz);
        this.ceiling.add(s);
      }
    });
    scene.add(this.ceiling);

    this.walls = new THREE.Group();
    scene.add(this.walls);
    plan.segs.forEach((s) => this.buildWall(s));
    this.buildBalcony();
    if (plan.yard) this.buildYard();

    this.shadowMat = this.mat('contact', () => new THREE.MeshBasicMaterial({ map: this.tex('shadow', TEX.shadow), transparent: true, depthWrite: false }));
    plan.items.forEach((it) => this.placeItem(it));
    this.buildDecor();
    this.collectPickables();

    const corr = plan.rooms.find((r) => r.kind === 'corridor');
    if (corr) { this.pos.set(1.0, EYE, corr.y + corr.d / 2); this.yaw = -0.9; }
    else { const k = plan.rooms.find((r) => r.kind === 'kitchen'); this.pos.set(1.4, EYE, k.d - 0.6); this.yaw = -0.9; }
    this.pitch = -0.08;
    this.orbit.target.set(plan.W / 2, 0, plan.D / 2);
    this.orbit.dist = Math.max(plan.W, plan.D) * 1.25;
    this.selectBox = null;
    this.setMode(this.mode);
  }

  buildFloors() {
    const plan = this.plan, st = this.st;
    const loader = new THREE.TextureLoader();
    const hw = (name, srgb) => this.tex('hw' + name, () => {
      const t = loader.load(ASSETS + 'textures/hardwood2_' + name + '.jpg');
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    });
    // the same oak photo, colour-graded per style (light oak, natural ash, walnut...)
    const grade = { scandi: 'saturate(40%) brightness(128%) contrast(85%)', japandi: 'saturate(55%) brightness(118%) contrast(88%)', boho: 'saturate(75%) brightness(108%)', classic: 'saturate(85%) brightness(72%) contrast(110%)', modern: 'saturate(30%) brightness(100%) contrast(90%)', industrial: 'saturate(50%) brightness(85%)' }[st.key] || 'none';
    const woodMap = this.tex('hwGraded' + st.key, () => {
      const c = document.createElement('canvas');
      c.width = 1024; c.height = 512;
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      t.colorSpace = THREE.SRGBColorSpace;
      const img = new Image();
      img.onload = () => { const g = c.getContext('2d'); g.filter = grade; g.drawImage(img, 0, 0, c.width, c.height); t.needsUpdate = true; this.floorMats.forEach((m) => { if (m.map && m.map.source === t.source) m.map.needsUpdate = true; }); };
      img.src = ASSETS + 'textures/hardwood2_diffuse.jpg';
      return t;
    });
    this.floorMats = [];
    const tint = '#ffffff';
    plan.rooms.forEach((rm) => {
      if (rm.yard) return;
      const wet = ['bath', 'wc', 'ensuite', 'utility'].includes(rm.kind);
      const pub = ['kitchen', 'corridor', 'dining', 'living'].includes(rm.kind);
      const rep = (t, sx, sy) => { const c = t.clone(); c.needsUpdate = true; c.repeat.set(rm.w / sx, rm.d / sy); return c; };
      let m;
      if (rm.outdoor) {
        m = new THREE.MeshStandardMaterial({ map: rep(this.tex('deck', () => TEX.wood('#8d6b4d')), 1.2, 1.2), roughness: 0.8 });
      } else if (wet) {
        m = new THREE.MeshStandardMaterial({ map: rep(this.tex('wetTile', () => TEX.tile('#dedbd5', 4, 'rgba(0,0,0,0.18)')), 1.2, 1.2), bumpMap: rep(this.tex('wetBump', () => TEX.tileBump(4)), 1.2, 1.2), bumpScale: 0.8, roughness: 0.35 });
      } else if (st.floorKind === 'concrete') {
        m = new THREE.MeshStandardMaterial({ map: rep(this.tex('concrete', () => TEX.concrete(st.floor)), 3, 3), roughness: 0.45 });
      } else if (st.floorKind === 'tile' && pub) {
        m = new THREE.MeshStandardMaterial({ map: rep(this.tex('bigTile', () => TEX.tile(st.tile, 2, 'rgba(0,0,0,0.08)')), 2.4, 2.4), bumpMap: rep(this.tex('bigBump', () => TEX.tileBump(2)), 2.4, 2.4), bumpScale: 0.5, roughness: 0.28 });
      } else {
        m = new THREE.MeshStandardMaterial({ color: tint, map: rep(woodMap, 1.8, 0.9), roughnessMap: rep(hw('roughness'), 1.8, 0.9), bumpMap: rep(hw('bump'), 1.8, 0.9), bumpScale: 0.4, roughness: 0.85 });
        this.floorMats.push(m);
      }
      m.envMapIntensity = 0.7;
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(rm.w, rm.d), m);
      fl.rotation.x = -Math.PI / 2;
      fl.position.set(rm.x + rm.w / 2, 0.001, rm.y + rm.d / 2);
      fl.receiveShadow = true;
      fl.userData.floor = true;
      this.scene.add(fl);
      this.floors.push(fl);
    });
  }

  /* ---------- the plot around a private house ---------- */
  buildYard() {
    const plan = this.plan, y = plan.yard;
    const pool = plan.items.find((it) => it.type === 'pool');
    const groundItem = plan.items.find((it) => it.type === 'lawn' || it.type === 'gravel');
    // ground with a cut-out for the pool
    const shape = new THREE.Shape();
    shape.moveTo(y.x0, -y.y0); shape.lineTo(y.x1, -y.y0); shape.lineTo(y.x1, -y.y1); shape.lineTo(y.x0, -y.y1); shape.lineTo(y.x0, -y.y0);
    if (pool) {
      const h = new THREE.Path();
      h.moveTo(pool.x, -pool.y); h.lineTo(pool.x, -(pool.y + pool.d)); h.lineTo(pool.x + pool.w, -(pool.y + pool.d)); h.lineTo(pool.x + pool.w, -pool.y); h.lineTo(pool.x, -pool.y);
      shape.holes.push(h);
    }
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    // ShapeGeometry UVs are in meters: scale the texture to about 2 m per repeat
    const tex = (y.ground === 'gravel' ? this.tex('gravel', TEX.gravel) : this.tex('grass', TEX.grass)).clone();
    tex.needsUpdate = true;
    tex.repeat.set(0.45, 0.45);
    const gm = new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
    const g = new THREE.Mesh(geo, gm);
    g.position.y = -0.015;
    g.receiveShadow = true;
    g.userData.floor = true;
    if (groundItem) g.userData.itemId = groundItem.id;
    this.scene.add(g);
    this.floors.push(g);

    // stone boundary walls, 1.8 m
    const stone = this.mat('stoneWall', () => new THREE.MeshStandardMaterial({ map: this.tex('stone', TEX.stone), roughness: 0.95 }));
    y.walls.forEach((w) => {
      const horiz = w.y1 === w.y2;
      const len = horiz ? Math.abs(w.x2 - w.x1) : Math.abs(w.y2 - w.y1);
      const m = new THREE.Mesh(horiz ? new THREE.BoxGeometry(len + 0.3, 1.8, 0.3) : new THREE.BoxGeometry(0.3, 1.8, len + 0.3), stone);
      const cx = (w.x1 + w.x2) / 2, cz = (w.y1 + w.y2) / 2;
      m.position.set(cx, 0.9, cz);
      m.castShadow = true; m.receiveShadow = true;
      this.walls.add(m);
      this.blockers.push(horiz ? { x0: cx - len / 2, x1: cx + len / 2, z0: cz - 0.2, z1: cz + 0.2 } : { x0: cx - 0.2, x1: cx + 0.2, z0: cz - len / 2, z1: cz + len / 2 });
    });

    // roof slab with a parapet so the house reads as a house from the garden
    const roofMat = this.plain('#e8e4dc', 0.9);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(plan.W + 0.4, 0.35, plan.D + 0.4), roofMat);
    roof.position.set(plan.W / 2, plan.wallH + 0.175, plan.D / 2);
    roof.castShadow = true;
    this.ceiling.add(roof);

    // the pool shell and its water
    if (pool) {
      const depth = 1.4;
      const tile = this.mat('poolTile', () => new THREE.MeshStandardMaterial({ map: TEX.tile('#9fd3de', 6, 'rgba(255,255,255,0.5)'), roughness: 0.3, emissive: '#2a7f95', emissiveIntensity: 0.35 }));
      const shell = new THREE.Group();
      const side = (w, d, x, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, depth, d), tile); m.position.set(x, -depth / 2, z); shell.add(m); };
      side(pool.w, 0.05, pool.x + pool.w / 2, pool.y);
      side(pool.w, 0.05, pool.x + pool.w / 2, pool.y + pool.d);
      side(0.05, pool.d, pool.x, pool.y + pool.d / 2);
      side(0.05, pool.d, pool.x + pool.w, pool.y + pool.d / 2);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(pool.w, pool.d), tile);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(pool.x + pool.w / 2, -depth, pool.y + pool.d / 2);
      shell.add(floor);
      shell.traverse((o) => { o.userData.itemId = pool.id; });
      this.scene.add(shell);
      this.waterTex = TEX.water();
      this.waterTex.repeat.set(pool.w / 2, pool.d / 2);
      const water = new THREE.Mesh(new THREE.PlaneGeometry(pool.w, pool.d), new THREE.MeshStandardMaterial({
        color: '#1aa3d0', emissive: '#1690b8', emissiveIntensity: 1.0, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.94, normalMap: this.waterTex, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 0.9
      }));
      water.rotation.x = -Math.PI / 2;
      water.position.set(pool.x + pool.w / 2, -0.12, pool.y + pool.d / 2);
      water.userData.itemId = pool.id;
      this.scene.add(water);
      this.pickables.push(water);
      this.blockers.push({ x0: pool.x, x1: pool.x + pool.w, z0: pool.y, z1: pool.y + pool.d });
    }
  }

  buildBalcony() {
    const bal = this.plan.rooms.find((r) => r.outdoor);
    if (!bal) return;
    const glass = this.mat('railGlass', () => new THREE.MeshStandardMaterial({ color: '#cfe3ea', transparent: true, opacity: 0.25, roughness: 0.05 }));
    const rail = this.plain('#2f3133', 0.35, 0.8);
    const add = (x, z, w, d) => {
      const g = new THREE.Mesh(new THREE.BoxGeometry(w, 1.0, d), glass);
      g.position.set(x, 0.5, z);
      this.walls.add(g);
      const t = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.05, d + 0.04), rail);
      t.position.set(x, 1.05, z);
      t.castShadow = true;
      this.walls.add(t);
      this.blockers.push({ x0: x - w / 2 - 0.02, x1: x + w / 2 + 0.02, z0: z - d / 2 - 0.02, z1: z + d / 2 + 0.02 });
    };
    add(bal.x + bal.w / 2, bal.y, bal.w, 0.04);
    add(bal.x, bal.y + bal.d / 2, 0.04, bal.d);
    add(bal.x + bal.w, bal.y + bal.d / 2, 0.04, bal.d);
  }

  buildWall(s) {
    const H = this.plan.wallH;
    const horiz = s.y1 === s.y2;
    const len = horiz ? s.x2 - s.x1 : s.y2 - s.y1;
    const th = s.ext ? 0.2 : 0.1;
    const wallMat = this.mat('wall', () => new THREE.MeshStandardMaterial({ color: this.st.wall, roughness: 0.95, bumpMap: this.tex('plaster', TEX.plaster), bumpScale: 0.3 }));
    const skirt = this.plain('#f4f3ef', 0.5);
    const place = (mesh, t, y) => {
      mesh.position.set(horiz ? s.x1 + t : s.x1, y, horiz ? s.y1 : s.y1 + t);
      this.walls.add(mesh);
    };
    const box = (t0, t1, y0, y1, mat, block) => {
      const w = t1 - t0;
      if (w <= 0.001 || y1 - y0 <= 0.001) return;
      const ext0 = t0 === 0 ? th / 2 : 0, ext1 = t1 === len ? th / 2 : 0;
      const L = w + ext0 + ext1;
      const c = t0 - ext0 + L / 2;
      const geo = horiz ? new THREE.BoxGeometry(L, y1 - y0, th) : new THREE.BoxGeometry(th, y1 - y0, L);
      const m = new THREE.Mesh(geo, mat || wallMat);
      m.castShadow = !mat;
      m.receiveShadow = true;
      place(m, c, (y0 + y1) / 2);
      if (block) {
        const x = m.position.x, z = m.position.z;
        this.blockers.push(horiz ? { x0: x - L / 2, x1: x + L / 2, z0: z - th / 2, z1: z + th / 2 } : { x0: x - th / 2, x1: x + th / 2, z0: z - L / 2, z1: z + L / 2 });
      }
      // skirting boards on both faces of every piece that reaches the floor
      if (!mat && y0 === 0) {
        const sg = horiz ? new THREE.BoxGeometry(L, 0.08, th + 0.024) : new THREE.BoxGeometry(th + 0.024, 0.08, L);
        place(new THREE.Mesh(sg, skirt), c, 0.04);
      }
    };
    const frameMat = this.plain('#2b2e30', 0.4, 0.6);
    const frame = (t0, t1, y0, y1, depth, mat) => {
      const w = t1 - t0;
      const geo = horiz ? new THREE.BoxGeometry(w, y1 - y0, depth) : new THREE.BoxGeometry(depth, y1 - y0, w);
      const m = new THREE.Mesh(geo, mat || frameMat);
      m.castShadow = true;
      place(m, (t0 + t1) / 2, (y0 + y1) / 2);
    };
    let t = 0;
    s.open.forEach((o) => {
      box(t, o.t0, 0, H, null, true);
      const isWin = o.type === 'window';
      if (isWin) box(o.t0, o.t1, 0, o.sill, null, true);
      box(o.t0, o.t1, o.head, H, null, false);
      if (isWin || o.type === 'slider') {
        const glass = this.mat('glass', () => new THREE.MeshStandardMaterial({ color: '#dfeef3', transparent: true, opacity: 0.12, roughness: 0.02, metalness: 0.1, depthWrite: false }));
        box(o.t0, o.t1, o.sill, o.head, glass, o.type !== 'slider');
        frame(o.t0, o.t1, o.sill, o.sill + 0.05, th + 0.02);
        frame(o.t0, o.t1, o.head - 0.05, o.head, th + 0.02);
        frame(o.t0, o.t0 + 0.05, o.sill, o.head, th + 0.02);
        frame(o.t1 - 0.05, o.t1, o.sill, o.head, th + 0.02);
        frame((o.t0 + o.t1) / 2 - 0.025, (o.t0 + o.t1) / 2 + 0.025, o.sill, o.head, th + 0.02);
        if (isWin && o.sill > 0.3) frame(o.t0 - 0.03, o.t1 + 0.03, o.sill - 0.03, o.sill, th + 0.08, this.plain('#e9e6df', 0.4));
        if (s.ext && o.t1 - o.t0 >= 1.0 && o.sill < 0.95) this.curtains(s, o, horiz, th);
      } else {
        const fm = this.plain(o.type === 'entry' ? '#3f3128' : '#eeece7', 0.5);
        frame(o.t0, o.t0 + 0.05, 0, o.head, th + 0.03, fm);
        frame(o.t1 - 0.05, o.t1, 0, o.head, th + 0.03, fm);
        frame(o.t0, o.t1, o.head - 0.05, o.head, th + 0.03, fm);
        if (o.type === 'door' || o.type === 'entry') {
          const w = o.t1 - o.t0 - 0.08;
          const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.04, o.head - 0.07, w), this.plain(o.type === 'entry' ? '#54402f' : '#f2f0eb', 0.45));
          leaf.castShadow = true;
          const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.14), this.plain('#c9c9c9', 0.25, 1));
          handle.position.set(0, 1.02 - (o.head - 0.07) / 2, (o.hinge === 'end' ? 1 : -1) * (w / 2 - 0.08));
          leaf.add(handle);
          const hingeT = o.hinge === 'end' ? o.t1 - 0.04 : o.t0 + 0.04;
          const sign = o.into === 'S' || o.into === 'E' ? 1 : -1;
          if (horiz) leaf.position.set(s.x1 + hingeT + (o.hinge === 'end' ? -0.03 : 0.03), (o.head - 0.07) / 2, s.y1 + sign * (w / 2 + th / 2));
          else { leaf.rotation.y = Math.PI / 2; leaf.position.set(s.x1 + sign * (w / 2 + th / 2), (o.head - 0.07) / 2, s.y1 + hingeT + (o.hinge === 'end' ? -0.03 : 0.03)); }
          this.walls.add(leaf);
        }
      }
      t = o.t1;
    });
    box(t, len, 0, H, null, true);
  }

  // sheer curtains gathered at both sides of a window, hung close to the ceiling
  curtains(s, o, horiz, th) {
    const H = this.plan.wallH;
    const inside = horiz ? (s.y1 <= 0.01 ? 1 : -1) : (s.x1 <= 0.01 ? 1 : -1);
    const mat = this.mat('curtain', () => new THREE.MeshStandardMaterial({ color: '#f6f2ea', roughness: 1, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    const w = 0.45, h = H - 0.08;
    const off = inside * (th / 2 + 0.09);
    [o.t0 - 0.28, o.t1 + 0.28].forEach((c) => {
      const geo = new THREE.PlaneGeometry(w, h, 24, 1);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 42) * 0.035);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      if (horiz) m.position.set(s.x1 + c, h / 2 + 0.02, s.y1 + off);
      else { m.rotation.y = Math.PI / 2; m.position.set(s.x1 + off, h / 2 + 0.02, s.y1 + c); }
      this.walls.add(m);
    });
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, o.t1 - o.t0 + 1.2, 8), this.plain('#2a2a2a', 0.4, 0.8));
    if (horiz) { r.rotation.z = Math.PI / 2; r.position.set(s.x1 + (o.t0 + o.t1) / 2, H - 0.06, s.y1 + off); }
    else { r.rotation.x = Math.PI / 2; r.position.set(s.x1 + off, H - 0.06, s.y1 + (o.t0 + o.t1) / 2); }
    this.walls.add(r);
  }

  // framed art above the double beds
  buildDecor() {
    const st = this.st;
    let seed = 3;
    const frameMat = this.plain(st.key === 'classic' ? '#a88a55' : '#1f1f1f', 0.4, st.key === 'classic' ? 0.8 : 0);
    const rot = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };
    this.plan.items.filter((it) => it.type === 'bedDouble').forEach((it) => {
      const back = { S: [0, -1], N: [0, 1], E: [-1, 0], W: [1, 0] }[it.face];
      const g = new THREE.Group();
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.65, 0.03), frameMat);
      const s = seed++;
      const art = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), new THREE.MeshStandardMaterial({ map: this.tex('art' + s, () => TEX.art(st, s * 13)), roughness: 0.8 }));
      art.position.z = 0.016;
      g.add(f, art);
      g.position.set(it.x + it.w / 2 + back[0] * (it.w / 2 - 0.02), 1.45, it.y + it.d / 2 + back[1] * (it.d / 2 - 0.02));
      g.rotation.y = rot[it.face];
      g.userData.decorFor = it.id;
      this.scene.add(g);
    });
  }

  isYardItem(it) {
    const r = this.plan.rooms.find((x) => x.id === it.room);
    return !!(r && r.yard);
  }

  collectPickables() {
    this.pickables = [...this.floors];
    Object.values(this.itemGroups).forEach((g) => g.traverse((o) => { if (o.isMesh) this.pickables.push(o); }));
  }

  placeItem(it) {
    const g = this.buildItem(it);
    if (!g) return;
    g.traverse((o) => {
      o.userData.itemId = it.id;
      if (o.isMesh) { o.castShadow = it.type !== 'rug' && !o.material.transparent; o.receiveShadow = true; }
    });
    this.scene.add(g);
    this.itemGroups[it.id] = g;
    const flat = ['pendant', 'tv', 'kitchenUpper', 'hood', 'deck', 'pergola', 'poolDeck', 'path', 'gardenLight', 'irrigation', 'lawn', 'gravel', 'pool'];
    const floorPiece = it.type !== 'rug' && it.z < 1 && it.h > 0.3 && !flat.includes(it.type);
    const tree = /Tree$/.test(it.type);
    if (tree && !this.blockers.some((b) => b.item === it.id)) {
      const cx = it.x + it.w / 2, cz = it.y + it.d / 2;
      this.blockers.push({ x0: cx - 0.25, x1: cx + 0.25, z0: cz - 0.25, z1: cz + 0.25, item: it.id });
    } else if (floorPiece && !this.blockers.some((b) => b.item === it.id)) {
      this.blockers.push({ x0: it.x, x1: it.x + it.w, z0: it.y, z1: it.y + it.d, item: it.id });
      (it.parts || []).forEach((p) => this.blockers.push({ x0: p.x, x1: p.x + p.w, z0: p.y, z1: p.y + p.d, item: it.id }));
    }
    // soft contact shadow under everything that stands on the floor
    if (floorPiece && !tree) {
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(it.w + 0.25, it.d + 0.25), this.shadowMat);
      sh.rotation.x = -Math.PI / 2;
      sh.position.set(it.x + it.w / 2, 0.004, it.y + it.d / 2);
      sh.renderOrder = 1;
      sh.userData.itemId = it.id;
      this.scene.add(sh);
      g.userData.contact = sh;
    }
  }

  refreshModels(force) {
    if (!this.plan) return;
    this.plan.items.forEach((it) => {
      const key = modelFor(it.type, this.st.key);
      const decor = ['diningTable', 'coffeeTable', 'island'].includes(it.type);
      if (!(key && this.models[key]) && !(decor && this.models.vase)) return;
      const old = this.itemGroups[it.id];
      if (old && old.userData.real && !(force && key)) return;
      if (old) { this.scene.remove(old); if (old.userData.contact) this.scene.remove(old.userData.contact); }
      this.placeItem(it);
    });
    this.collectPickables();
    if (this.selectedItem) this.highlight(this.selectedItem);
  }

  /* ---------- furniture ---------- */
  fitModel(src, W, D, H) {
    const m = src.clone(true);
    const box = new THREE.Box3().setFromObject(m);
    const size = box.getSize(new THREE.Vector3());
    const sx = W / size.x, sz = D / size.z;
    const sy = H ? H / size.y : (sx + sz) / 2;
    m.scale.set(sx, sy, sz);
    const b2 = new THREE.Box3().setFromObject(m);
    const c = b2.getCenter(new THREE.Vector3());
    m.position.set(-c.x, -b2.min.y, -c.z);
    const wrap = new THREE.Group();
    wrap.add(m);
    return wrap;
  }

  buildItem(it) {
    const st = this.st;
    const g = new THREE.Group();
    const faceRot = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 }[it.face || 'S'];
    const side = it.face === 'E' || it.face === 'W';
    const W = side ? it.d : it.w;
    const D = side ? it.w : it.d;
    const H = it.h;
    const RB = (w, h, d, r, x, y, z, m, parent) => {
      const rr = Math.max(0.002, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
      const mesh = new THREE.Mesh(new RoundedBoxGeometry(Math.max(w, 0.01), Math.max(h, 0.01), Math.max(d, 0.01), 3, rr), m);
      mesh.position.set(x, y + h / 2, z);
      (parent || g).add(mesh);
      return mesh;
    };
    const box = (w, h, d, x, y, z, m) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.max(w, 0.004), Math.max(h, 0.004), Math.max(d, 0.004)), m);
      mesh.position.set(x, y + h / 2, z);
      g.add(mesh);
      return mesh;
    };
    const cyl = (rt, rb, h, x, y, z, m, seg) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 24), m);
      mesh.position.set(x, y + h / 2, z);
      g.add(mesh);
      return mesh;
    };
    const legs = (w, d, h, m, inset, r, taper, dx) => {
      const i = inset || 0.05;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => cyl(r || 0.018, (r || 0.018) * (taper || 1), h, (dx || 0) + a * (w / 2 - i), 0, b * (d / 2 - i), m, 12));
    };
    const wood = this.wood(st.wood);
    const woodDark = this.wood(hsl(st.wood, -0.12));
    const fabric = this.fabric(st.fabric);
    const fabric2 = this.fabric(st.fabric2);
    const accentFab = this.fabric(st.accent);
    const linen = this.fabric('#f1eee8');
    const metal = this.plain(st.metal, 0.35, 0.9);
    const steel = this.plain('#c6c9cc', 0.28, 1);
    const black = this.plain('#161718', 0.35);
    const ceramic = this.mat('ceramic', () => new THREE.MeshPhysicalMaterial({ color: '#fbfbf9', roughness: 0.12, clearcoat: 0.6 }));
    const counter = this.mat('marble', () => new THREE.MeshPhysicalMaterial({ map: this.tex('marble', TEX.marble), roughness: 0.18, clearcoat: 0.4 }));
    const lacquer = this.plain(st.floorKind === 'wood' || st.key === 'boho' ? '#f1efea' : hsl(st.fabric2, 0.1), 0.42);
    const mirror = this.plain('#dfe7ea', 0.02, 1);
    const led = this.mat('led', () => new THREE.MeshBasicMaterial({ color: '#fff3dd' }));

    const real = (key, w, d, h) => {
      const src = key && this.models[key];
      if (!src) return false;
      const m = this.fitModel(src, w, d, h);
      const want = VARIANT[key] && VARIANT[key][st.key];
      const vmat = want && this.variants[key] && this.variants[key][want];
      if (vmat) m.traverse((o) => { if (o.isMesh && /fabric/i.test(o.material.name)) o.material = vmat; });
      g.add(m);
      g.userData.real = true;
      return true;
    };

    const sofa = (w, d) => {
      RB(w, 0.16, d, 0.03, 0, 0.07, 0, fabric2);
      legs(w - 0.1, d - 0.1, 0.07, woodDark, 0.02, 0.02, 0.7);
      const seats = Math.max(1, Math.round((w - 0.4) / 0.72));
      const sw = (w - 0.36) / seats;
      for (let i = 0; i < seats; i++) RB(sw - 0.01, 0.18, d - 0.3, 0.06, -w / 2 + 0.18 + sw * (i + 0.5), 0.23, 0.1, fabric);
      for (let i = 0; i < seats; i++) RB(sw - 0.02, 0.44, 0.2, 0.07, -w / 2 + 0.18 + sw * (i + 0.5), 0.4, -d / 2 + 0.2, fabric).rotation.x = -0.12;
      RB(w, 0.62, 0.16, 0.05, 0, 0.07, -d / 2 + 0.08, fabric2);
      RB(0.18, 0.5, d, 0.07, -w / 2 + 0.09, 0.07, 0, fabric2);
      RB(0.18, 0.5, d, 0.07, w / 2 - 0.09, 0.07, 0, fabric2);
      [[-1, accentFab], [1, linen]].forEach(([k, m]) => {
        const p = RB(0.42, 0.4, 0.13, 0.08, k * (w / 2 - 0.42), 0.47, -d / 2 + 0.36, m);
        p.rotation.x = -0.25; p.rotation.z = k * 0.08;
      });
    };

    switch (it.type) {
      case 'sofa2': case 'sofa3':
        if (!real(modelFor(it.type, st.key), W, D + 0.05, 0.84)) sofa(W, D);
        break;
      case 'sofaL': case 'sofaBed':
        sofa(W, D);
        break;
      case 'armchair':
        if (!real(modelFor(it.type, st.key), W, D - 0.1, 0.8)) sofa(W, D);
        break;
      case 'chair': {
        const frameMat = st.key === 'industrial' || st.key === 'modern' ? metal : wood;
        RB(W * 0.9, 0.04, D * 0.8, 0.012, 0, 0.44, 0.03, wood);
        legs(W * 0.9, D * 0.8, 0.44, frameMat, 0.03, 0.014);
        RB(W * 0.86, 0.3, 0.03, 0.012, 0, 0.55, -D * 0.4 + 0.02, st.key === 'boho' ? this.plain('#c8a472', 0.8) : wood).rotation.x = 0.12;
        cyl(0.012, 0.012, 0.45, -W * 0.4, 0.44, -D * 0.4 + 0.02, frameMat, 8);
        cyl(0.012, 0.012, 0.45, W * 0.4, 0.44, -D * 0.4 + 0.02, frameMat, 8);
        RB(W * 0.8, 0.035, D * 0.7, 0.015, 0, 0.48, 0.03, fabric2);
        break;
      }
      case 'officeChair':
        RB(W * 0.8, 0.08, D * 0.72, 0.035, 0, 0.44, 0.03, fabric2);
        RB(W * 0.74, 0.55, 0.07, 0.035, 0, 0.56, -D * 0.34, fabric2);
        cyl(0.025, 0.025, 0.38, 0, 0.06, 0, steel, 12);
        for (let k = 0; k < 5; k++) { const a = box(0.3, 0.025, 0.04, Math.cos(k * 1.2566) * 0.14, 0.04, Math.sin(k * 1.2566) * 0.14, black); a.rotation.y = -k * 1.2566; }
        break;
      case 'stool':
        cyl(0.19, 0.18, 0.05, 0, 0.62, 0, wood);
        legs(0.3, 0.3, 0.62, metal, 0.02, 0.012);
        cyl(0.16, 0.16, 0.012, 0, 0.25, 0, metal, 24);
        break;
      case 'coffeeTable':
        RB(W, 0.045, D, 0.015, 0, 0.36, 0, st.key === 'modern' ? counter : wood);
        RB(W - 0.1, 0.02, D - 0.1, 0.008, 0, 0.12, 0, woodDark);
        legs(W, D, 0.36, st.key === 'industrial' || st.key === 'modern' ? metal : woodDark, 0.06, 0.02);
        this.decorOn(g, 0.405, W, D);
        break;
      case 'sideTable':
        cyl(W / 2, W / 2, 0.03, 0, 0.52, 0, st.key === 'modern' ? counter : wood, 40);
        cyl(0.02, 0.02, 0.52, 0, 0, 0, metal, 12);
        cyl(0.15, 0.15, 0.02, 0, 0, 0, metal, 32);
        cyl(0.05, 0.06, 0.12, 0.05, 0.55, 0, ceramic, 24);
        break;
      case 'diningTable':
        RB(W, 0.045, D, 0.01, 0, 0.715, 0, st.key === 'modern' ? counter : wood);
        if (st.key === 'industrial' || st.key === 'modern') {
          if (W >= D) { box(0.05, 0.7, D * 0.8, -W / 2 + 0.12, 0, 0, metal); box(0.05, 0.7, D * 0.8, W / 2 - 0.12, 0, 0, metal); }
          else { box(W * 0.8, 0.7, 0.05, 0, 0, -D / 2 + 0.12, metal); box(W * 0.8, 0.7, 0.05, 0, 0, D / 2 - 0.12, metal); }
        } else legs(W, D, 0.715, woodDark, 0.08, 0.03, 0.7);
        this.decorOn(g, 0.76, W, D, true);
        break;
      case 'desk':
        RB(W, 0.035, D, 0.008, 0, 0.705, 0, wood);
        legs(W, D, 0.705, metal, 0.04, 0.015);
        box(0.52, 0.32, 0.02, 0, 0.83, -D / 2 + 0.12, black);
        box(0.5, 0.3, 0.004, 0, 0.84, -D / 2 + 0.132, this.mat('screen', () => new THREE.MeshStandardMaterial({ color: '#0e1621', emissive: '#29425c', emissiveIntensity: 0.5, roughness: 0.1 })));
        box(0.06, 0.09, 0.06, 0, 0.74, -D / 2 + 0.14, steel);
        box(0.36, 0.015, 0.13, 0, 0.74, 0.03, this.plain('#d9d9d6', 0.5));
        break;
      case 'tvConsole':
        RB(W, H - 0.1, D, 0.01, 0, 0.1, 0, st.key === 'modern' ? lacquer : wood);
        legs(W, D, 0.1, metal, 0.05, 0.012);
        for (let i = 1; i < 3; i++) box(0.004, H - 0.16, 0.004, -W / 2 + (W * i) / 3, 0.13, D / 2 + 0.002, black);
        cyl(0.07, 0.05, 0.22, -W / 2 + 0.25, H, 0, ceramic, 24);
        RB(0.2, 0.05, 0.14, 0.01, W / 2 - 0.3, H, 0, this.plain(st.accent, 0.8));
        break;
      case 'tv':
        RB(W, H, 0.035, 0.004, 0, 0, 0, black);
        box(W - 0.02, H - 0.02, 0.002, 0, 0.01, 0.018, this.mat('tvScreen', () => new THREE.MeshPhysicalMaterial({ color: '#05070a', roughness: 0.05, clearcoat: 1, emissive: '#0b1624', emissiveIntensity: 0.4 })));
        break;
      case 'rug': {
        const rm = this.mat('rug' + st.key, () => new THREE.MeshStandardMaterial({ map: this.tex('rug' + st.key, () => TEX.rug(st)), roughness: 1, bumpMap: this.tex('fabBump', TEX.fabricBump), bumpScale: 1.2 }));
        RB(W, 0.014, D, 0.005, 0, 0, 0, rm);
        break;
      }
      case 'floorLamp':
        cyl(0.14, 0.15, 0.025, 0, 0, 0, metal, 32);
        cyl(0.011, 0.011, 1.38, 0, 0.025, 0, metal, 12);
        cyl(0.14, 0.2, 0.28, 0, 1.33, 0, this.mat('shade', () => new THREE.MeshStandardMaterial({ color: '#f3ecdf', roughness: 1, emissive: '#ffd9a0', emissiveIntensity: 0.35, side: THREE.DoubleSide })), 32);
        break;
      case 'pendant': {
        cyl(0.004, 0.004, this.plan.wallH - it.z - H, 0, H, 0, black, 6);
        const shadeMat = this.mat('pendant' + st.key, () => new THREE.MeshStandardMaterial({ color: st.metal, roughness: 0.35, metalness: st.key === 'classic' ? 0.9 : 0.2, side: THREE.DoubleSide }));
        const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.28, H, 40, 1, true), shadeMat);
        shade.position.y = H / 2;
        g.add(shade);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), this.mat('bulb', () => new THREE.MeshBasicMaterial({ color: '#fff4dc' })));
        bulb.position.y = 0.06;
        g.add(bulb);
        break;
      }
      case 'plant':
        if (!real('plant', W * 1.25, D * 1.25, Math.max(0.7, H * 0.75))) {
          cyl(W * 0.38, W * 0.3, 0.38, 0, 0, 0, this.plain('#b9744a', 0.8));
          const leaf = this.plain('#4d6b3c', 0.7);
          for (let i = 0; i < 7; i++) {
            const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15 + (i % 3) * 0.05, 1), leaf);
            s.position.set(Math.cos(i * 2.1) * 0.12, 0.55 + i * ((H - 0.6) / 7), Math.sin(i * 2.1) * 0.12);
            g.add(s);
          }
        }
        break;
      case 'bookshelf': {
        box(0.02, H, D, -W / 2 + 0.01, 0, 0, wood);
        box(0.02, H, D, W / 2 - 0.01, 0, 0, wood);
        box(W, H, 0.01, 0, 0, -D / 2 + 0.005, wood);
        const n = Math.max(3, Math.round(H / 0.38));
        const colors = [st.accent, st.fabric2, '#c9b28a', '#7d8a8c', '#a4563a', '#e0d8c8', '#2f3e4f'];
        const r = rng(it.id.length * 31 + n + Math.round(it.x * 10));
        for (let i = 0; i <= n; i++) {
          const y = (i * (H - 0.02)) / n;
          box(W, 0.02, D, 0, y, 0, wood);
          if (i < n) {
            let x = -W / 2 + 0.04;
            while (x < W / 2 - 0.1) {
              const bw = 0.025 + r() * 0.03, bh = 0.18 + r() * 0.08;
              const b = box(bw, bh, D * 0.75, x + bw / 2, y + 0.02, 0.02, this.plain(colors[Math.floor(r() * colors.length)], 0.7));
              if (r() > 0.93) b.rotation.z = 0.25;
              x += bw + 0.003;
              if (r() > 0.9) x += 0.1 + r() * 0.12;
            }
          }
        }
        break;
      }
      case 'wardrobe': {
        RB(W, H, D, 0.005, 0, 0, 0, lacquer);
        const n = Math.max(2, Math.round(W / 0.5));
        for (let i = 1; i < n; i++) box(0.004, H - 0.08, 0.004, -W / 2 + (W * i) / n, 0.04, D / 2 + 0.002, this.plain('#9a9790', 0.6));
        for (let i = 0; i < n; i++) box(0.012, 0.3, 0.02, -W / 2 + (W * (i + 0.5)) / n + ((i % 2) ? -1 : 1) * (W / n / 2 - 0.05), 1.0, D / 2 + 0.012, steel);
        break;
      }
      case 'dresser':
        RB(W, H, D, 0.008, 0, 0, 0, wood);
        for (let i = 1; i < 3; i++) box(W - 0.04, 0.004, 0.004, 0, (H * i) / 3, D / 2 + 0.002, woodDark);
        box(W * 0.6, 0.8, 0.02, 0, H + 0.25, -D / 2 + 0.01, mirror);
        cyl(0.06, 0.05, 0.2, W / 2 - 0.15, H, 0, ceramic, 24);
        break;
      case 'nightstand':
        RB(W, H, D, 0.01, 0, 0, 0, wood);
        box(W - 0.04, 0.004, 0.004, 0, H * 0.55, D / 2 + 0.002, woodDark);
        cyl(0.05, 0.07, 0.22, 0, H, 0, ceramic, 24);
        cyl(0.09, 0.13, 0.17, 0, H + 0.22, 0, this.mat('shadeWarm', () => new THREE.MeshStandardMaterial({ color: '#f4ecdc', emissive: '#ffd8a3', emissiveIntensity: 0.5, roughness: 1 })), 32);
        break;
      case 'bedDouble': case 'bedSingle': {
        RB(W, 0.28, D, 0.02, 0, 0.05, 0, st.key === 'industrial' || st.key === 'japandi' ? woodDark : fabric2);
        legs(W - 0.06, D - 0.06, 0.05, woodDark, 0.04, 0.025);
        RB(W - 0.06, 0.22, D - 0.1, 0.06, 0, 0.33, 0.03, linen);
        RB(W + 0.02, 0.09, D * 0.66, 0.045, 0, 0.5, D * 0.17, this.fabric(st.key === 'boho' ? '#e8d6bb' : '#f4f1ec'));
        RB(W + 0.03, 0.04, D * 0.2, 0.02, 0, 0.58, D * 0.38, st.key === 'boho' ? accentFab : fabric2);
        RB(W, 1.05, 0.1, 0.03, 0, 0.05, -D / 2 + 0.05, it.type === 'bedDouble' ? fabric : wood);
        const n = it.type === 'bedDouble' ? 2 : 1;
        for (let i = 0; i < n; i++) RB(W / n - 0.16, 0.14, 0.42, 0.07, -W / 2 + (W / n) * (i + 0.5), 0.54, -D / 2 + 0.33, linen).rotation.x = -0.3;
        if (n === 2) RB(0.45, 0.28, 0.12, 0.06, 0, 0.58, -D / 2 + 0.5, accentFab).rotation.x = -0.35;
        break;
      }
      case 'bunk': {
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => RB(0.055, H, 0.055, 0.01, a * (W / 2 - 0.03), 0, b * (D / 2 - 0.03), wood));
        [0.2, 1.15].forEach((y, i) => {
          box(W, 0.06, D, 0, y, 0, wood);
          RB(W - 0.06, 0.16, D - 0.06, 0.05, 0, y + 0.06, 0, linen);
          RB(W - 0.04, 0.06, D * 0.6, 0.03, 0, y + 0.22, D * 0.18, i ? fabric2 : accentFab);
          RB(W - 0.25, 0.1, 0.34, 0.05, 0, y + 0.23, -D / 2 + 0.25, linen);
        });
        box(0.04, 0.2, D, W / 2 - 0.02, 1.37, 0, wood);
        for (let k = 0; k < 4; k++) box(0.04, 0.03, 0.4, W / 2 - 0.02, 0.35 + k * 0.28, D / 2 - 0.3, wood);
        break;
      }
      case 'kitchenBase': case 'cooktop': case 'sink': case 'dishwasher': {
        box(W - 0.01, 0.1, D - 0.08, 0, 0, -0.04, black);
        RB(W - 0.012, 0.76, D - 0.03, 0.004, 0, 0.1, -0.015, it.type === 'dishwasher' ? steel : lacquer);
        if (it.type !== 'dishwasher') box(Math.min(0.3, W * 0.4), 0.012, 0.02, 0, 0.8, D / 2 - 0.005, steel);
        box(W, 0.035, D + 0.02, 0, 0.86, 0.01, counter);
        if (it.type === 'cooktop') {
          box(Math.min(W - 0.1, 0.6), 0.006, 0.5, 0, 0.895, 0, this.mat('glassBlack', () => new THREE.MeshPhysicalMaterial({ color: '#0a0a0b', roughness: 0.05, clearcoat: 1 })));
          box(W - 0.06, 0.5, 0.02, 0, 0.22, D / 2 - 0.005, this.mat('ovenDoor', () => new THREE.MeshPhysicalMaterial({ color: '#141516', roughness: 0.08, clearcoat: 1 })));
          box(W - 0.2, 0.015, 0.03, 0, 0.66, D / 2 + 0.01, steel);
        }
        if (it.type === 'sink') {
          box(Math.min(W - 0.2, 0.6), 0.004, 0.42, 0, 0.893, 0.02, this.plain('#8e9396', 0.25, 1));
          cyl(0.016, 0.02, 0.32, 0, 0.895, -D / 2 + 0.08, steel, 16);
          box(0.025, 0.025, 0.2, 0, 1.19, -D / 2 + 0.17, steel);
        }
        break;
      }
      case 'kitchenUpper': {
        RB(W - 0.01, H, D, 0.004, 0, 0, 0, lacquer);
        const n = Math.max(1, Math.round(W / 0.6));
        for (let i = 1; i < n; i++) box(0.004, H - 0.04, 0.004, -W / 2 + (W * i) / n, 0.02, D / 2 + 0.002, this.plain('#9a9790', 0.6));
        box(W - 0.04, 0.01, 0.03, 0, -0.012, D / 2 - 0.05, led);
        break;
      }
      case 'hood':
        RB(W, 0.08, D, 0.01, 0, 0, 0, steel);
        box(0.3, this.plan.wallH - it.z - 0.08, 0.25, 0, 0.08, -D / 2 + 0.14, steel);
        break;
      case 'fridge':
        RB(W - 0.02, H, D - 0.02, 0.02, 0, 0, 0, steel);
        box(W - 0.04, 0.004, 0.004, 0, H * 0.62, D / 2 - 0.008, black);
        box(0.02, 0.5, 0.03, -W / 2 + 0.07, H * 0.62 + 0.1, D / 2, this.plain('#9ea2a5', 0.2, 1));
        box(0.02, 0.5, 0.03, -W / 2 + 0.07, H * 0.62 - 0.6, D / 2, this.plain('#9ea2a5', 0.2, 1));
        break;
      case 'island':
        RB(W - 0.06, 0.86, D - 0.3, 0.004, 0, 0, -0.1, st.key === 'classic' || st.key === 'japandi' ? wood : lacquer);
        box(W, 0.04, D, 0, 0.86, 0, counter);
        this.decorOn(g, 0.9, W, D * 0.5);
        break;
      case 'toilet':
        RB(W * 0.85, 0.55, 0.12, 0.02, 0, 0.35, -D / 2 + 0.06, this.plain('#f1f0ec', 0.3));
        box(0.18, 0.1, 0.01, 0, 1.0, -D / 2 + 0.125, this.plain('#d9d9d6', 0.2, 0.8));
        RB(W * 0.72, 0.2, D * 0.72, 0.1, 0, 0.2, 0.02, ceramic);
        RB(W * 0.74, 0.025, D * 0.72, 0.012, 0, 0.405, 0.02, ceramic);
        break;
      case 'vanity':
        RB(W, 0.45, D, 0.008, 0, it.small ? 0.4 : 0.35, 0, it.small ? ceramic : wood);
        RB(W * 0.82, 0.07, D * 0.8, 0.02, 0, 0.8, 0, ceramic);
        cyl(0.012, 0.012, 0.2, 0, 0.87, -D / 2 + 0.06, steel, 12);
        box(W * 0.9, 0.75, 0.02, 0, 1.05, -D / 2 + 0.01, mirror);
        box(W * 0.8, 0.03, 0.03, 0, 1.83, -D / 2 + 0.03, led);
        break;
      case 'shower': {
        const sg = this.mat('showerGlass', () => new THREE.MeshPhysicalMaterial({ color: '#e8f4f7', transparent: true, opacity: 0.2, roughness: 0.02, depthWrite: false }));
        box(W, 0.04, D, 0, 0, 0, ceramic);
        box(W, 2.0, 0.008, 0, 0.04, D / 2 - 0.01, sg);
        box(0.008, 2.0, D, W / 2 - 0.01, 0.04, 0, sg);
        cyl(0.11, 0.11, 0.01, 0, 2.05, -D / 2 + 0.2, steel, 32);
        box(0.02, 0.02, 0.2, 0, 2.06, -D / 2 + 0.1, steel);
        break;
      }
      case 'bathtub':
        RB(W, 0.55, D, 0.04, 0, 0, 0, ceramic);
        box(W - 0.14, 0.01, D - 0.14, 0, 0.47, 0, this.mat('water', () => new THREE.MeshPhysicalMaterial({ color: '#cfe6ea', roughness: 0.02, transparent: true, opacity: 0.6 })));
        break;
      case 'washer':
        [0, 0.86].forEach((y) => {
          RB(W - 0.02, 0.84, D - 0.02, 0.02, 0, y, 0, this.plain('#f6f6f4', 0.35));
          const drum = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 12, 40), this.plain('#b9bec2', 0.2, 1));
          drum.position.set(0, y + 0.4, D / 2 - 0.005);
          g.add(drum);
          const gl = new THREE.Mesh(new THREE.CircleGeometry(0.16, 32), this.mat('drumGlass', () => new THREE.MeshPhysicalMaterial({ color: '#1c262d', roughness: 0.05, clearcoat: 1 })));
          gl.position.set(0, y + 0.4, D / 2 - 0.003);
          g.add(gl);
        });
        break;
      case 'shoeCabinet':
        RB(W, H, D, 0.006, 0, 0.1, 0, lacquer);
        box(W, 0.1, D - 0.04, 0, 0, -0.02, black);
        box(0.5, 0.7, 0.02, 0, 1.4, -D / 2 + 0.01, mirror);
        break;
      case 'outdoorSet':
        cyl(0.35, 0.35, 0.03, 0, 0.72, 0, this.plain('#d9d4c7', 0.6));
        cyl(0.03, 0.03, 0.72, 0, 0, 0, metal, 12);
        [-1, 1].forEach((k) => {
          RB(0.48, 0.08, 0.48, 0.03, k * 0.55, 0.42, 0, accentFab);
          legs(0.46, 0.46, 0.42, metal, 0.03, 0.012, 1, k * 0.55);
          RB(0.05, 0.42, 0.48, 0.02, k * 0.79, 0.44, 0, metal);
        });
        break;
      case 'deck': {
        const dm = this.wood('#8a6446');
        RB(W, 0.1, D, 0.01, 0, 0, 0, dm);
        for (let zz = -D / 2 + 0.14; zz < D / 2; zz += 0.14) box(W, 0.004, 0.006, 0, 0.1, zz, this.plain('#4a3526', 0.8));
        break;
      }
      case 'pergola': {
        const pm = st.key === 'industrial' || st.key === 'modern' ? this.plain('#2d2f31', 0.5, 0.6) : this.wood('#b08a62');
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => box(0.12, H, 0.12, a * (W / 2 - 0.08), 0, b * (D / 2 - 0.08), pm));
        box(W, 0.18, 0.12, 0, H - 0.18, -D / 2 + 0.08, pm);
        box(W, 0.18, 0.12, 0, H - 0.18, D / 2 - 0.08, pm);
        for (let xx = -W / 2 + 0.1; xx <= W / 2 - 0.05; xx += 0.28) box(0.05, 0.12, D, xx, H, 0, pm);
        break;
      }
      case 'outdoorSofa': {
        const cushion = this.fabric(st.key === 'boho' ? '#d9c3a3' : '#e8e4dc');
        const frameM = this.plain(st.key === 'modern' || st.key === 'industrial' ? '#3a3a3a' : '#8b7355', 0.85);
        RB(W, 0.35, 0.8, 0.03, 0, 0.05, -D / 2 + 0.4, frameM);
        RB(W - 0.1, 0.14, 0.7, 0.05, 0, 0.4, -D / 2 + 0.42, cushion);
        RB(W, 0.4, 0.14, 0.04, 0, 0.35, -D / 2 + 0.07, frameM);
        RB(W - 0.2, 0.36, 0.14, 0.06, 0, 0.52, -D / 2 + 0.18, cushion).rotation.x = -0.15;
        RB(0.9, 0.35, 0.55, 0.02, 0, 0.05, D / 2 - 0.35, frameM);
        RB(0.9, 0.02, 0.55, 0.01, 0, 0.4, D / 2 - 0.35, this.plain('#dcd6cc', 0.3));
        break;
      }
      case 'outdoorDining': {
        const tm = st.key === 'modern' || st.key === 'industrial' ? this.plain('#dad6cf', 0.4) : this.wood('#9c7650');
        const lm = this.plain('#2f3133', 0.5, 0.6);
        RB(W * 0.75, 0.04, D * 0.5, 0.01, 0, 0.72, 0, tm);
        legs(W * 0.72, D * 0.46, 0.72, lm, 0.06, 0.02);
        const seatM = this.fabric(st.accent);
        [-W * 0.26, 0, W * 0.26].forEach((cx) => [-1, 1].forEach((k) => {
          RB(0.46, 0.05, 0.46, 0.01, cx, 0.44, k * (D * 0.25 + 0.28), tm);
          legs(0.42, 0.42, 0.44, lm, 0.03, 0.012, 1, cx);
          g.children.slice(-4).forEach((c) => { c.position.z += k * (D * 0.25 + 0.28); });
          RB(0.44, 0.4, 0.04, 0.01, cx, 0.49, k * (D * 0.25 + 0.5), tm);
          RB(0.4, 0.04, 0.4, 0.015, cx, 0.49, k * (D * 0.25 + 0.28), seatM);
        }));
        break;
      }
      case 'grill':
        RB(W, 0.85, D, 0.01, 0, 0, 0, this.plain('#b9bcbe', 0.3, 1));
        RB(W * 0.55, 0.28, D * 0.9, 0.08, -W * 0.15, 0.85, 0, this.plain('#1b1c1d', 0.35, 0.4));
        box(W * 0.35, 0.02, D * 0.9, W * 0.3, 0.87, 0, this.plain('#d8d8d6', 0.2, 1));
        break;
      case 'sunLounger': {
        const fm = this.plain(st.key === 'modern' ? '#e9e7e2' : '#6d5a47', 0.8);
        RB(W, 0.12, D * 0.62, 0.02, 0, 0.28, D * 0.18, fm);
        legs(W - 0.06, D * 0.6, 0.28, fm, 0.04, 0.02, 1);
        g.children.slice(-4).forEach((c) => { c.position.z += D * 0.18; });
        const back = RB(W, 0.1, D * 0.38, 0.02, 0, 0.3, -D * 0.28, fm);
        back.rotation.x = 0.55; back.position.y += 0.18;
        RB(W - 0.08, 0.06, D * 0.6, 0.03, 0, 0.4, D * 0.18, this.fabric('#f2efe8'));
        break;
      }
      case 'waterfall': case 'fountain': {
        const stoneM = this.mat('stoneWall', () => new THREE.MeshStandardMaterial({ map: this.tex('stone', TEX.stone), roughness: 0.95 }));
        RB(W, H, D * 0.6, 0.03, 0, 0, -D * 0.2, stoneM);
        box(W * 0.7, 0.04, D * 0.5, 0, H - 0.1, D * 0.15, stoneM);
        if (!this.fallTex) {
          this.fallTex = canvasTex(64, 256, (c, w, h) => {
            const r = rng(71);
            for (let yy = 0; yy < h; yy += 2) { c.fillStyle = `rgba(${200 + r() * 55},${230 + r() * 25},255,${0.35 + r() * 0.45})`; c.fillRect(0, yy, w, 2); }
          });
          this.fallTex.repeat.set(1, 2);
        }
        const sheet = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.6, H - 0.05), new THREE.MeshBasicMaterial({ map: this.fallTex, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
        sheet.position.set(0, (H - 0.05) / 2 - (it.type === 'waterfall' ? 0.12 : 0), D * 0.38);
        g.add(sheet);
        if (it.type === 'fountain') RB(W, 0.35, D * 0.5, 0.03, 0, 0, D * 0.2, stoneM);
        break;
      }
      case 'oliveTree': case 'citrusTree': case 'palmTree': {
        const bark = this.plain(it.type === 'oliveTree' ? '#6b6356' : '#5a4636', 0.95);
        if (it.type === 'palmTree') {
          let px = 0, pz = 0;
          for (let k = 0; k < 10; k++) {
            const seg = cyl(0.13 - k * 0.004, 0.15 - k * 0.004, H / 10, px, (k * H) / 10, pz, bark, 10);
            seg.rotation.z = 0.02;
            px += 0.02;
          }
          const frond = this.mat('frond', () => new THREE.MeshStandardMaterial({ color: '#4f7a2f', roughness: 0.8, side: THREE.DoubleSide }));
          for (let k = 0; k < 12; k++) {
            const f = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 2.0, 1, 4), frond);
            const p = f.geometry.attributes.position;
            for (let i = 0; i < p.count; i++) { const yy = p.getY(i); p.setZ(i, -0.35 * (yy + 1) * (yy + 1) * 0.5); }
            f.geometry.computeVertexNormals();
            f.geometry.translate(0, 1.0, 0);
            f.rotation.order = 'YXZ';
            f.rotation.y = (k / 12) * Math.PI * 2;
            f.rotation.x = -1.0 - (k % 2) * 0.35;
            f.position.set(px, H, pz);
            g.add(f);
          }
        } else {
          const trunkH = it.type === 'oliveTree' ? 1.3 : 0.9;
          const t1 = cyl(0.1, 0.17, trunkH, 0, 0, 0, bark, 10); t1.rotation.z = 0.08;
          if (it.type === 'oliveTree') { const t2 = cyl(0.07, 0.1, 0.9, 0.12, trunkH - 0.2, 0, bark, 8); t2.rotation.z = -0.45; const t3 = cyl(0.06, 0.09, 0.8, -0.1, trunkH - 0.25, 0.05, bark, 8); t3.rotation.z = 0.5; }
          const leaf = this.plain(it.type === 'oliveTree' ? '#7d8c6a' : '#3f6b2a', 0.9);
          const r = rng(it.x * 100 + it.y * 7);
          const n = it.type === 'oliveTree' ? 14 : 10;
          const crown = it.type === 'oliveTree' ? 1.25 : 0.85;
          for (let k = 0; k < n; k++) {
            const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35 + r() * 0.35, 1), leaf);
            const a = r() * Math.PI * 2, rad = r() * crown;
            s.position.set(Math.cos(a) * rad, trunkH + 0.5 + r() * (H - trunkH - 0.9), Math.sin(a) * rad);
            s.scale.y = 0.75;
            g.add(s);
          }
          if (it.type === 'citrusTree') {
            const fruit = this.plain('#f2c230', 0.5);
            for (let k = 0; k < 18; k++) {
              const s = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), fruit);
              const a = r() * Math.PI * 2;
              s.position.set(Math.cos(a) * (0.55 + r() * 0.35), trunkH + 0.4 + r() * 1.1, Math.sin(a) * (0.55 + r() * 0.35));
              g.add(s);
            }
          }
        }
        break;
      }
      case 'planterBed': {
        const stoneM = this.mat('stoneWall', () => new THREE.MeshStandardMaterial({ map: this.tex('stone', TEX.stone), roughness: 0.95 }));
        box(W, 0.3, D, 0, 0, 0, stoneM);
        box(W - 0.1, 0.02, D - 0.1, 0, 0.3, 0, this.plain('#4a3a2c', 1));
        const cols = it.colors || ['#7a9a5a'];
        const r = rng(it.x * 31 + it.y * 17);
        for (let xx = -W / 2 + 0.3; xx < W / 2 - 0.1; xx += 0.42) {
          const zz = (r() - 0.5) * (D - 0.35);
          const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2 + r() * 0.12, 1), this.plain('#557a3a', 0.9));
          bush.position.set(xx, 0.45, zz);
          g.add(bush);
          const flower = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), this.plain(cols[Math.floor(r() * cols.length)], 0.8));
          flower.position.set(xx + 0.08, 0.6, zz + 0.05);
          g.add(flower);
        }
        break;
      }
      case 'path': {
        const pm = this.plain('#c9c1b3', 0.9);
        for (let zz = -D / 2 + 0.3; zz < D / 2 - 0.2; zz += 0.65) RB(W - 0.2, 0.04, 0.45, 0.02, 0, 0, zz, pm);
        break;
      }
      case 'poolDeck': {
        const pool = this.plan.items.find((x) => x.type === 'pool');
        const pm = this.mat('paving', () => new THREE.MeshStandardMaterial({ map: TEX.tile('#d8d1c4', 3, 'rgba(0,0,0,0.12)'), roughness: 0.85 }));
        if (pool) {
          // four strips around the water (the group sits at the paving centre, facing N)
          const cx = it.x + it.w / 2, cz = it.y + it.d / 2;
          const strip = (x0, z0, x1, z1) => { if (x1 - x0 < 0.01 || z1 - z0 < 0.01) return; const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.05, z1 - z0), pm); m.position.set(-((x0 + x1) / 2 - cx), 0.025, -((z0 + z1) / 2 - cz)); g.add(m); };
          strip(it.x, it.y, it.x + it.w, pool.y);
          strip(it.x, pool.y + pool.d, it.x + it.w, it.y + it.d);
          strip(it.x, pool.y, pool.x, pool.y + pool.d);
          strip(pool.x + pool.w, pool.y, it.x + it.w, pool.y + pool.d);
        }
        break;
      }
      case 'gardenLight':
        cyl(0.05, 0.06, 0.55, 0, 0, 0, this.plain('#2b2b2b', 0.5, 0.6), 12);
        cyl(0.055, 0.055, 0.06, 0, 0.55, 0, this.mat('lampGlow', () => new THREE.MeshStandardMaterial({ color: '#fff2d6', emissive: '#ffd9a0', emissiveIntensity: 1.2 })), 12);
        break;
      case 'irrigation':
        RB(0.28, 0.3, 0.12, 0.02, 0, 0, 0, this.plain('#3b6e8f', 0.5));
        break;
      case 'playSet': {
        const pw = this.wood('#b98b5a');
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => box(0.1, H, 0.1, a * (W / 2 - 0.1) * 0.5 - W * 0.2, 0, b * (D / 2 - 0.1), pw));
        box(W * 0.55, 0.06, D, -W * 0.2, 1.2, 0, pw);
        const slide = box(0.5, 0.03, 1.9, W * 0.25, 0.6, 0, this.plain('#2e8b57', 0.4));
        slide.rotation.x = 0.6;
        box(0.08, 0.08, D, W * 0.35, H - 0.1, 0, pw);
        box(0.04, 0.9, 0.04, W * 0.35, H - 1.0, 0, this.plain('#555', 0.5));
        box(0.45, 0.04, 0.2, W * 0.35, H - 1.05, 0, this.plain(st.accent, 0.6));
        break;
      }
      case 'lawn': case 'gravel':
        return null;
      case 'pool':
        break; // shell and water are built with the yard
      default:
        RB(W, H, D, 0.01, 0, 0, 0, lacquer);
    }

    g.rotation.y = faceRot;
    g.position.set(it.x + it.w / 2, it.z || 0, it.y + it.d / 2);

    if (it.parts && it.parts.length) {
      const outer = new THREE.Group();
      outer.add(g);
      it.parts.forEach((p) => {
        const base = new THREE.Mesh(new RoundedBoxGeometry(p.w, 0.16, p.d, 3, 0.03), fabric2);
        base.position.set(p.x + p.w / 2, 0.15, p.y + p.d / 2);
        const seat = new THREE.Mesh(new RoundedBoxGeometry(p.w - 0.02, 0.18, p.d - 0.02, 3, 0.06), fabric);
        seat.position.set(p.x + p.w / 2, 0.32, p.y + p.d / 2);
        outer.add(base, seat);
      });
      outer.userData = g.userData;
      return outer;
    }
    return g;
  }

  // a glass vase with flowers (a real model) and a bowl on tables
  decorOn(g, y, W, D, big) {
    if (this.models.vase) {
      const v = this.fitModel(this.models.vase, big ? 0.28 : 0.2, big ? 0.18 : 0.13, big ? 0.34 : 0.24);
      v.position.y = y;
      v.position.x = big ? 0 : -W * 0.2;
      g.add(v);
      g.userData.real = true;
    }
    if (!big) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.06, 0.05, 32, 1, true), this.mat('bowl', () => new THREE.MeshStandardMaterial({ color: this.st.accent, roughness: 0.5, side: THREE.DoubleSide })));
      b.position.set(W * 0.2, y + 0.025, 0);
      g.add(b);
    }
  }

  /* ---------- modes and navigation ---------- */
  setMode(mode) {
    this.mode = mode;
    if (!this.plan) return;
    const doll = mode === 'doll';
    this.ceiling.visible = !doll;
    this.walls.scale.y = doll ? 0.42 : 1;
    this.camera.fov = doll ? 45 : 75;
    this.camera.updateProjectionMatrix();
    this.el.classList.toggle('is-doll', doll);
  }

  goToRoom(roomId) {
    const r = this.plan.rooms.find((x) => x.id === roomId);
    if (!r) return;
    if (this.mode === 'doll') {
      this.orbit.target.set(r.x + r.w / 2, 0, r.y + r.d / 2);
      this.orbit.dist = Math.max(5, Math.max(r.w, r.d) * 2.2);
      return;
    }
    let best = null;
    for (let i = 1; i < 10; i++) {
      for (let j = 1; j < 10; j++) {
        const x = r.x + (r.w * i) / 10, z = r.y + (r.d * j) / 10;
        if (this.collides(x, z, 0.35)) continue;
        // stand in a free corner and take in the whole room, the way interiors are photographed
        const score = Math.hypot(x - (r.x + r.w / 2), z - (r.y + r.d / 2));
        if (!best || score > best.s) best = { x, z, s: score };
      }
    }
    if (!best) best = { x: r.x + r.w / 2, z: r.y + r.d / 2 };
    this.pos.set(best.x, EYE, best.z);
    const cx = r.x + r.w / 2, cz = r.y + r.d / 2;
    this.yaw = Math.atan2(-(cx - best.x), -(cz - best.z));
    this.pitch = -0.18;
    this.walkTo = null;
  }

  lookAtItem(id) {
    const it = this.plan.items.find((x) => x.id === id);
    if (!it) return;
    const cx = it.x + it.w / 2, cz = it.y + it.d / 2;
    if (this.mode === 'doll') {
      this.orbit.target.set(cx, 0, cz);
      this.orbit.dist = Math.max(4, this.orbit.dist * 0.7);
    } else {
      const room = this.plan.rooms.find((r) => r.id === it.room);
      const inRoom = (p) => p.x > room.x && p.x < room.x + room.w && p.z > room.y && p.z < room.y + room.d;
      if (!inRoom(this.pos)) this.goToRoom(room.id);
      this.targetYaw = Math.atan2(-(cx - this.pos.x), -(cz - this.pos.z));
      const dist = Math.hypot(cx - this.pos.x, cz - this.pos.z) || 1;
      this.targetPitch = Math.atan2((it.z || 0) + it.h / 2 - EYE, dist);
    }
    this.highlight(it);
  }

  highlight(it) {
    if (this.selectBox) { this.scene.remove(this.selectBox); this.selectBox.geometry.dispose(); this.selectBox = null; }
    this.selectedItem = it || null;
    if (!it) return;
    const h = Math.max(it.h, 0.05);
    const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(it.w + 0.06, h + 0.06, it.d + 0.06));
    const line = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: this.opts.accent || '#c47a2c' }));
    line.position.set(it.x + it.w / 2, (it.z || 0) + h / 2, it.y + it.d / 2);
    this.scene.add(line);
    this.selectBox = line;
  }

  collides(x, z, r) {
    const rad = r || RADIUS;
    const p = this.plan;
    const Bd = p.bounds || { x0: 0, y0: p.rooms.some((rm) => rm.outdoor) ? -1.8 : 0, x1: p.W, y1: p.D };
    if (x < Bd.x0 - 0.1 || z < Bd.y0 - 0.1 || x > Bd.x1 + 0.1 || z > Bd.y1 + 0.1) return true;
    return this.blockers.some((b) => x + rad > b.x0 && x - rad < b.x1 && z + rad > b.z0 && z - rad < b.z1);
  }

  move(dx, dz) {
    const nx = this.pos.x + dx, nz = this.pos.z + dz;
    if (!this.collides(nx, this.pos.z)) this.pos.x = nx;
    if (!this.collides(this.pos.x, nz)) this.pos.z = nz;
  }

  startSpin() { this.spin = Math.PI * 2; this.walkTo = null; }

  /* ---------- input ---------- */
  bindInput() {
    const c = () => this.renderer.domElement;
    let drag = null;
    const pointers = new Map();
    const locked = () => document.pointerLockElement === c();
    const onDown = (e) => {
      if (this.gyro) { this.hold.fwd = true; return; }
      if (locked()) {
        // the crosshair in the middle of the screen is the pointer
        const r = c().getBoundingClientRect();
        this.click({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
        return;
      }
      if (this.looking && e.pointerType === 'mouse') { this.lockPointer(); return; }
      c().focus({ preventScroll: true });
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      drag = { moved: 0, t: performance.now() };
      c().setPointerCapture(e.pointerId);
      this.spin = 0;
    };
    const onMove = (e) => {
      if (this.gyro || locked()) return;
      if (!pointers.has(e.pointerId)) { this.hover(e); return; }
      const prev = pointers.get(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinch) {
          const k = this.pinch / d;
          if (this.mode === 'doll') this.orbit.dist = Math.max(3, Math.min(60, this.orbit.dist * k));
          else this.move(-Math.sin(this.yaw) * (1 - k) * 2, -Math.cos(this.yaw) * (1 - k) * 2);
        }
        this.pinch = d;
        return;
      }
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      if (drag) drag.moved += Math.abs(dx) + Math.abs(dy);
      if (this.mode === 'doll') {
        this.orbit.az -= dx * 0.006;
        this.orbit.el = Math.max(0.2, Math.min(1.45, this.orbit.el + dy * 0.004));
      } else {
        this.yaw += dx * 0.005;
        this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch + dy * 0.004));
        this.targetYaw = this.targetPitch = undefined;
      }
    };
    const onUp = (e) => {
      if (this.gyro) { this.hold.fwd = false; return; }
      pointers.delete(e.pointerId);
      if (pointers.size < 2) this.pinch = null;
      if (drag && drag.moved < 6 && performance.now() - drag.t < 500) this.click(e);
      drag = null;
    };
    document.addEventListener('mousemove', (e) => {
      if (!locked()) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch - e.movementY * 0.0022));
      this.targetYaw = this.targetPitch = undefined;
    });
    document.addEventListener('pointerlockchange', () => {
      this.el.classList.toggle('is-locked', locked());
      if (this.opts.onLock) this.opts.onLock(locked());
    });
    c().addEventListener('pointerdown', onDown);
    c().addEventListener('pointermove', onMove);
    c().addEventListener('pointerup', onUp);
    c().addEventListener('pointercancel', onUp);
    c().addEventListener('pointerleave', () => { if (this.opts.onHover) this.opts.onHover(null); });
    c().addEventListener('wheel', (e) => {
      e.preventDefault();
      if (this.mode === 'doll') this.orbit.dist = Math.max(3, Math.min(60, this.orbit.dist * (1 + Math.sign(e.deltaY) * 0.1)));
      else { const k = -Math.sign(e.deltaY) * 0.35; this.move(-Math.sin(this.yaw) * k, -Math.cos(this.yaw) * k); }
    }, { passive: false });
    c().addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', 'ש', 'ג', 'ד', "'"].includes(k)) { e.preventDefault(); this.keys[k] = true; this.spin = 0; this.walkTo = null; }
    });
    c().addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });
    c().addEventListener('blur', () => { this.keys = {}; });
  }

  pick(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(v, this.camera);
    const hits = this.ray.intersectObjects(this.pickables, false);
    return hits.find((h) => h.object.visible) || null;
  }

  hover(e) {
    if (!this.opts.onHover || e.pointerType === 'touch') return;
    const now = performance.now();
    if (this.lastHover && now - this.lastHover < 80) return;
    this.lastHover = now;
    const h = this.pick(e);
    const id = h && h.object.userData.itemId;
    this.renderer.domElement.style.cursor = id ? 'pointer' : (this.mode === 'doll' ? 'grab' : 'crosshair');
    this.opts.onHover(id || null, e);
  }

  click(e) {
    const h = this.pick(e);
    if (!h) return;
    if (h.object.userData.itemId) {
      if (this.opts.onSelect) this.opts.onSelect(h.object.userData.itemId);
      return;
    }
    if (h.object.userData.floor && this.mode === 'walk') this.walkTo = new THREE.Vector3(h.point.x, EYE, h.point.z);
    else if (h.object.userData.floor && this.mode === 'doll') this.orbit.target.set(h.point.x, 0, h.point.z);
  }

  /* ---------- frame loop ---------- */

  /* ---------- photo overlays ---------- */
  // Where a person stands to photograph one wall of a room: in the middle of the opposite
  // wall, phone level at chest height. 'floor' looks straight down.
  photoCamera(room, wall, aspect) {
    const r = room, cx = r.x + r.w / 2, cz = r.y + r.d / 2;
    if (wall === 'floor') {
      const half = Math.max(r.w / 2 / aspect, r.d / 2) * 1.04;
      const cam = new THREE.OrthographicCamera(-half * aspect, half * aspect, half, -half, 0.1, 20);
      cam.position.set(cx, 6, cz);
      cam.up.set(0, 0, -1);
      cam.lookAt(cx, 0, cz);
      return cam;
    }
    const V = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] }[wall];
    const across = V[0] ? r.w : r.d, width = V[0] ? r.d : r.w;
    const dist = Math.max(1.2, across - 0.2);
    const px = cx - V[0] * (across / 2 - 0.1), pz = cz - V[1] * (across / 2 - 0.1);
    let hf = 2 * Math.atan((width / 2) / dist) * 1.04;
    hf = Math.min(Math.max(hf, THREE.MathUtils.degToRad(66)), THREE.MathUtils.degToRad(100));
    const vf = 2 * Math.atan(Math.tan(hf / 2) / aspect);
    const cam = new THREE.PerspectiveCamera(THREE.MathUtils.radToDeg(vf), aspect, 0.05, 60);
    cam.position.set(px, 1.45, pz);
    cam.lookAt(px + V[0] * dist, 1.2, pz + V[1] * dist);
    return cam;
  }

  // Render every piece of furniture in a room, one at a time, as a transparent cut-out seen
  // from the photo camera. Returns sprites with their box in the frame (0..1) and depth.
  renderLayers(roomId, wall, W, H) {
    const plan = this.plan;
    const room = plan && plan.rooms.find((r) => r.id === roomId);
    if (!room) return [];
    const cam = this.photoCamera(room, wall, W / H);
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    const items = plan.items.filter((it) => it.room === roomId && this.itemGroups[it.id]).filter((it) => {
      if (wall === 'floor') return true;
      const c = new THREE.Vector3(it.x + it.w / 2, (it.z || 0) + it.h / 2, it.y + it.d / 2).sub(cam.position);
      return c.dot(fwd) > 0.45;
    });
    const out = [];
    this.offscreen((show) => {
      items.forEach((it) => {
        show(it.id);
        this.renderer.render(this.scene, cam);
        const src = this.renderer.domElement;
        const full = document.createElement('canvas');
        full.width = W; full.height = H;
        const fx = full.getContext('2d', { willReadFrequently: true });
        fx.drawImage(src, 0, 0, W, H);
        const box = alphaBox(fx.getImageData(0, 0, W, H), W, H);
        if (!box) return;
        const cut = document.createElement('canvas');
        cut.width = box.w; cut.height = box.h;
        cut.getContext('2d').drawImage(full, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
        const c = new THREE.Vector3(it.x + it.w / 2, it.z || 0, it.y + it.d / 2);
        const depth = wall === 'floor' ? -((it.z || 0) + it.h) : c.distanceTo(cam.position);
        out.push({ id: it.id, type: it.type, canvas: cut, x: box.x / W, y: box.y / H, w: box.w / W, h: box.h / H, depth });
      });
    }, W, H, false);
    return out.sort((a, b) => b.depth - a.depth);
  }

  // Full rendered view of a room from its best corner, for print and sharing.
  snapshotRoom(roomId, W, H) {
    const plan = this.plan;
    const r = plan && plan.rooms.find((x) => x.id === roomId);
    if (!r) return null;
    let best = null;
    for (let i = 1; i < 10; i++) for (let j = 1; j < 10; j++) {
      const x = r.x + (r.w * i) / 10, z = r.y + (r.d * j) / 10;
      if (this.collides(x, z, 0.35)) continue;
      const sc = Math.hypot(x - (r.x + r.w / 2), z - (r.y + r.d / 2));
      if (!best || sc > best.s) best = { x, z, s: sc };
    }
    if (!best) best = { x: r.x + r.w / 2, z: r.y + r.d / 2 };
    const cam = new THREE.PerspectiveCamera(r.outdoor ? 60 : 68, W / H, 0.05, 300);
    cam.position.set(best.x, r.outdoor ? 1.7 : EYE, best.z);
    cam.lookAt(r.x + r.w / 2, r.outdoor ? 0.8 : 1.0, r.y + r.d / 2);
    let url = null;
    this.offscreen(() => {
      this.renderer.render(this.scene, cam);
      url = this.renderer.domElement.toDataURL('image/jpeg', 0.88);
    }, W, H, true);
    return url;
  }

  // run renders at a fixed size with the house in walk-through state, then restore the view
  offscreen(fn, W, H, fullScene) {
    const r = this.renderer, scene = this.scene;
    const pr = r.getPixelRatio();
    const wallScale = this.walls.scale.y, ceilVis = this.ceiling.visible;
    const bg = scene.background, sel = this.selectBox;
    if (sel) sel.visible = false;
    r.setPixelRatio(1);
    r.setSize(W, H, false);
    this.walls.scale.y = 1;
    this.ceiling.visible = true;
    const vis = new Map();
    if (!fullScene) {
      scene.background = null;
      r.setClearColor(0x000000, 0);
      scene.children.forEach((o) => { vis.set(o, o.visible); if (!o.isLight) o.visible = false; });
    }
    const show = (id) => {
      scene.children.forEach((o) => {
        if (o.isLight) return;
        const u = o.userData;
        o.visible = u.itemId === id || u.decorFor === id;
      });
    };
    try { fn(show); } finally {
      vis.forEach((v, o) => { o.visible = v; });
      scene.background = bg;
      this.walls.scale.y = wallScale;
      this.ceiling.visible = ceilVis;
      if (sel) sel.visible = true;
      r.setPixelRatio(pr);
      this.resize();
    }
  }

  resize() {
    const w = this.el.clientWidth || 300, h = this.el.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
    }
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  loop() {
    if (!this.running) return;
    const dt = Math.min(0.05, this.clock.getDelta());
    if (!this.plan || this.el.getClientRects().length === 0 || this.lost) return;

    if (this.pt) { /* view frozen while the photo renders */ } else if (this.gyro) {
      this.gyroStep(dt);
    } else if (this.mode === 'walk') {
      const k = this.keys;
      const speed = 1.8 * dt;
      let f = 0, t = 0;
      if (k.w || k.arrowup || k["'"] || this.hold.fwd) f += 1;
      if (k.s || k.arrowdown || k['ד'] || this.hold.back) f -= 1;
      if (k.a || k.arrowleft || k['ש'] || this.hold.left) t += 1;
      if (k.d || k.arrowright || k['ג'] || this.hold.right) t -= 1;
      if (t) { this.yaw += t * 1.6 * dt; this.targetYaw = undefined; }
      if (f) this.move(-Math.sin(this.yaw) * f * speed, -Math.cos(this.yaw) * f * speed);
      if (this.walkTo) {
        const dx = this.walkTo.x - this.pos.x, dz = this.walkTo.z - this.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.1) this.walkTo = null;
        else {
          let diff = Math.atan2(-dx, -dz) - this.yaw;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          this.yaw += diff * Math.min(1, dt * 6);
          const bx = this.pos.x, bz = this.pos.z;
          this.move((dx / d) * speed * 1.2, (dz / d) * speed * 1.2);
          if (Math.hypot(this.pos.x - bx, this.pos.z - bz) < 0.001) this.walkTo = null;
        }
      }
      if (this.spin > 0) { const s = Math.min(this.spin, dt * 0.55); this.yaw += s; this.spin -= s; }
      if (this.targetYaw !== undefined) {
        let diff = this.targetYaw - this.yaw;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.yaw += diff * Math.min(1, dt * 5);
        if (Math.abs(diff) < 0.002) this.targetYaw = undefined;
      }
      if (this.targetPitch !== undefined) {
        this.pitch += (this.targetPitch - this.pitch) * Math.min(1, dt * 5);
        if (Math.abs(this.targetPitch - this.pitch) < 0.002) this.targetPitch = undefined;
      }
      this.camera.position.copy(this.pos);
      const dir = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
      this.camera.lookAt(this.pos.clone().add(dir));
      if (this.opts.onMove) this.opts.onMove(this.pos.x, this.pos.z, this.yaw);
    } else {
      if (this.spin > 0) { const s = Math.min(this.spin, dt * 0.5); this.orbit.az += s; this.spin -= s; }
      const o = this.orbit;
      this.camera.position.set(o.target.x + Math.sin(o.az) * Math.cos(o.el) * o.dist, Math.sin(o.el) * o.dist, o.target.z + Math.cos(o.az) * Math.cos(o.el) * o.dist);
      this.camera.lookAt(o.target.x, 0.6, o.target.z);
    }
    if (this.waterTex) {
      const t = this.clock.elapsedTime;
      this.waterTex.offset.set(t * 0.02, t * 0.013);
      if (this.fallTex) this.fallTex.offset.y = -t * 0.8;
    }
    if (this.pt) this.ptStep();
    else if (this.gyro && this.gyro.stereo) this.renderStereo();
    else if (this.composer && this.quality) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }

  /* ---------- phone: look around by moving the phone; optional side-by-side for cardboard viewers ---------- */
  async startGyro(stereo) {
    const D = window.DeviceOrientationEvent;
    if (!D) throw new Error('no-orientation');
    if (typeof D.requestPermission === 'function') {
      const p = await D.requestPermission();
      if (p !== 'granted') throw new Error('denied');
    }
    if (this.mode !== 'walk') this.setMode('walk');
    this.gyro = { stereo: !!stereo, o: null, offset: null };
    this.onOrient = (e) => { if (e.alpha != null && this.gyro) this.gyro.o = { a: e.alpha, b: e.beta, g: e.gamma }; };
    window.addEventListener('deviceorientation', this.onOrient);
    if (stereo) { this.stereo = new THREE.StereoCamera(); this.stereo.aspect = 0.5; this.stereo.eyeSep = 0.064; }
    this.el.classList.add('is-gyro');
    this.el.classList.toggle('is-stereo', !!stereo);
    try { if (stereo && screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape'); } catch (e) { /* not allowed */ }
    this.resize();
  }
  stopGyro() {
    if (!this.gyro) return;
    window.removeEventListener('deviceorientation', this.onOrient);
    this.gyro = null;
    this.hold.fwd = false;
    this.el.classList.remove('is-gyro', 'is-stereo');
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { /* ignore */ }
    this.resize();
  }

  /* ---------- computer: look around with the mouse without dragging (pointer lock) ---------- */
  startLook() {
    if (this.mode !== 'walk') this.setMode('walk');
    this.looking = true;
    this.el.classList.add('is-look');
    this.renderer.domElement.focus({ preventScroll: true });
    this.lockPointer();
  }
  lockPointer() {
    const c = this.renderer.domElement;
    try { const p = c.requestPointerLock && c.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* not allowed here: drag still works */ }
  }
  stopLook() {
    this.looking = false;
    this.el.classList.remove('is-look', 'is-locked');
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* ignore */ }
  }
  gyroStep(dt) {
    const g = this.gyro;
    const cam = this.camera;
    if (g.o) {
      const deg = THREE.MathUtils.degToRad;
      const orient = deg((screen.orientation && screen.orientation.angle) || window.orientation || 0);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(deg(g.o.b), deg(g.o.a), -deg(g.o.g), 'YXZ'));
      q.multiply(new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)));
      q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -orient));
      const f = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
      const devYaw = Math.atan2(-f.x, -f.z);
      if (g.offset === null) g.offset = this.yaw - devYaw;
      cam.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), g.offset)).multiply(q);
      this.yaw = devYaw + g.offset;
    }
    const k = this.keys;
    let fw = 0;
    if (this.hold.fwd || k.w || k.arrowup) fw += 1;
    if (this.hold.back || k.s || k.arrowdown) fw -= 1;
    if (fw) this.move(-Math.sin(this.yaw) * fw * 1.4 * dt, -Math.cos(this.yaw) * fw * 1.4 * dt);
    cam.position.copy(this.pos);
    if (!g.o) cam.lookAt(this.pos.clone().add(new THREE.Vector3(-Math.sin(this.yaw), this.pitch, -Math.cos(this.yaw))));
    if (this.opts.onMove) this.opts.onMove(this.pos.x, this.pos.z, this.yaw);
  }
  renderStereo() {
    const r = this.renderer, size = r.getSize(new THREE.Vector2());
    this.camera.updateMatrixWorld();
    this.stereo.update(this.camera);
    r.setScissorTest(true);
    r.setScissor(0, 0, size.x / 2, size.y); r.setViewport(0, 0, size.x / 2, size.y);
    r.render(this.scene, this.stereo.cameraL);
    r.setScissor(size.x / 2, 0, size.x / 2, size.y); r.setViewport(size.x / 2, 0, size.x / 2, size.y);
    r.render(this.scene, this.stereo.cameraR);
    r.setScissorTest(false);
    r.setViewport(0, 0, size.x, size.y);
  }

  setQuality(on) { this.quality = !!on && !!this.composer; }

  /* ---------- photoreal still: path tracing of the current view ---------- */
  // Light is traced bounce by bounce (sun and sky through the windows, reflections, soft
  // shadows), the way architectural renderers work. The view freezes until it is closed.
  async startPhoto(onProgress, target) {
    if (this.pt || !this.plan) return false;
    // the tracer reads rotations that newer three.js scenes carry; r160 scenes get neutral ones
    if (new THREE.Scene().environmentRotation === undefined) {
      THREE.Scene.prototype.environmentRotation = new THREE.Euler();
      THREE.Scene.prototype.backgroundRotation = new THREE.Euler();
    }
    const mod = await import('three-gpu-pathtracer');
    const scene = this.scene;
    const hidden = [];
    scene.traverse((o) => {
      if ((o.isMesh && o.material === this.shadowMat) || o === this.selectBox) { if (o.visible) { hidden.push(o); o.visible = false; } }
    });
    const env = scene.environment;
    // the outdoor sky lights the rooms through the windows; the studio HDR fills in
    scene.environment = this.sky || this.envEquirect || env;
    scene.environmentIntensity = this.plan.yard ? 1.2 : 1.5;
    const cam = this.camera.clone();
    const tracer = new mod.WebGLPathTracer(this.renderer);
    tracer.bounces = 5;
    tracer.filteredGlossyFactor = 0.6;
    tracer.tiles.set(3, 3);
    tracer.minSamples = 1;
    tracer.fadeDuration = 300;
    tracer.renderDelay = 0;
    tracer.dynamicLowRes = true;
    tracer.lowResScale = 0.25;
    const exposure = this.renderer.toneMappingExposure;
    this.renderer.toneMappingExposure = 1.25;
    this.pt = { tracer, cam, hidden, env, exposure, target: target || 160, onProgress, ready: false, grab: null };
    this.running = true;
    if (onProgress) onProgress(0.05, 'build');
    await new Promise((res) => setTimeout(res, 60));
    tracer.setScene(scene, cam);
    if (this.pt) this.pt.ready = true;
    return true;
  }
  ptStep() {
    const pt = this.pt;
    if (!pt.ready) { this.renderer.render(this.scene, pt.cam); return; }
    if (pt.tracer.samples < pt.target) {
      pt.tracer.renderSample();
      if (pt.onProgress) pt.onProgress(0.1 + 0.9 * Math.min(1, pt.tracer.samples / pt.target), 'trace', Math.floor(pt.tracer.samples));
    } else pt.tracer.renderSample();
    if (pt.grab) { const g = pt.grab; pt.grab = null; g(this.renderer.domElement.toDataURL('image/jpeg', 0.93)); }
  }
  grabPhoto() {
    return new Promise((res) => { if (!this.pt) res(null); else this.pt.grab = res; });
  }
  stopPhoto() {
    const pt = this.pt;
    if (!pt) return;
    this.pt = null;
    try { pt.tracer.dispose(); } catch (e) { /* already gone */ }
    pt.hidden.forEach((o) => { o.visible = true; });
    this.scene.environment = pt.env;
    this.scene.environmentIntensity = 1;
    this.renderer.toneMappingExposure = pt.exposure;
    this.renderer.setRenderTarget(null);
    this.resize();
  }

  dispose() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
    this.ro.disconnect();
    this.renderer.dispose();
  }
}

window.IH = window.IH || {};
window.IH.Tour = Tour;
window.dispatchEvent(new Event('ih-tour-ready'));
