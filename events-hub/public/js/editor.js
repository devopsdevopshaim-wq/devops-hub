// עורך תמונות בדפדפן: חיתוך לגודל ההדפסה, פילטרים, אפקטי AI, טקסט, מדבקות, מסגרות ואנימציות.
/* global $, esc, api, toast */
(function () {
  const PRESETS = {
    none: { name: 'מקורי', f: '' },
    bw: { name: 'שחור לבן', f: 'grayscale(1) contrast(1.1)' },
    sepia: { name: 'ספיה', f: 'sepia(.85)' },
    vintage: { name: 'וינטג׳', f: 'sepia(.35) contrast(.9) saturate(.8) brightness(1.05)' },
    warm: { name: 'חמים', f: 'saturate(1.2) sepia(.2) brightness(1.03)' },
    cool: { name: 'קריר', f: 'saturate(.9) hue-rotate(-12deg) brightness(1.03)' },
    vivid: { name: 'חי', f: 'saturate(1.5) contrast(1.1)' },
    drama: { name: 'דרמטי', f: 'contrast(1.4) saturate(.8) brightness(.95)' },
  };

  const AI_EFFECTS = {
    none: { name: 'ללא', ico: '⭕' },
    enhance: { name: 'שיפור אוטומטי', ico: '✨' },
    cartoon: { name: 'קריקטורה', ico: '🎭' },
    sketch: { name: 'ציור עיפרון', ico: '✏️' },
    popart: { name: 'פופ ארט', ico: '🟨' },
    oil: { name: 'ציור שמן', ico: '🖌️' },
    removebg: { name: 'הסרת רקע', ico: '🪄' },
  };

  const FRAMES = {
    none: 'ללא', white: 'שוליים לבנים', polaroid: 'פולרואיד', gold: 'זהב', hearts: 'לבבות', floral: 'פרחים', stars: 'כוכבים',
  };

  const ANIMATIONS = {
    zoom: { name: 'זום עדין', ico: '🔍' },
    pulse: { name: 'פעימה', ico: '💓' },
    hearts: { name: 'גשם לבבות', ico: '💕' },
    confetti: { name: 'קונפטי', ico: '🎉' },
    sparkle: { name: 'נצנוצים', ico: '✨' },
    snow: { name: 'שלג', ico: '❄️' },
  };

  const STICKERS = ['❤️', '💍', '🎉', '🥂', '🌸', '⭐', '👑', '🕊️', '🎂', '💐', '✡️', '🌿', '😍', '🎈', '💃', '🕺'];

  function loadImage(src, cors = false) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      if (cors) img.crossOrigin = 'anonymous'; // מסגרת מהשרת: בלי זה התמונה הסופית לא נשמרת
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function toCanvas(img, maxSide = 2000) {
    const s = Math.min(1, maxSide / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * s);
    c.height = Math.round(img.height * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  // ---------- אפקטים ברמת פיקסל ----------
  function pixels(src, fn) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(src, 0, 0);
    const id = ctx.getImageData(0, 0, c.width, c.height);
    fn(id.data, c.width, c.height);
    ctx.putImageData(id, 0, 0);
    return c;
  }

  function autoEnhance(src) {
    return pixels(src, (d) => {
      const lo = [255, 255, 255]; const hi = [0, 0, 0];
      const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
      for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) hist[k][d[i + k]]++;
      const total = d.length / 4; const cut = total * 0.005;
      for (let k = 0; k < 3; k++) {
        let acc = 0; for (let v = 0; v < 256; v++) { acc += hist[k][v]; if (acc > cut) { lo[k] = v; break; } }
        acc = 0; for (let v = 255; v >= 0; v--) { acc += hist[k][v]; if (acc > cut) { hi[k] = v; break; } }
      }
      for (let i = 0; i < d.length; i += 4) {
        for (let k = 0; k < 3; k++) {
          const r = Math.max(1, hi[k] - lo[k]);
          d[i + k] = Math.max(0, Math.min(255, ((d[i + k] - lo[k]) * 255) / r));
        }
        // הגברת רוויה קלה
        const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
        for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, avg + (d[i + k] - avg) * 1.12));
      }
    });
  }

  function grayArr(d, w, h) {
    const g = new Float32Array(w * h);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) g[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    return g;
  }

  function boxBlur(g, w, h, r) {
    const out = new Float32Array(g.length); const tmp = new Float32Array(g.length);
    for (let y = 0; y < h; y++) {
      let acc = 0; const row = y * w;
      for (let x = -r; x <= r; x++) acc += g[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[row + x] = acc / (2 * r + 1);
        acc += g[row + Math.min(w - 1, x + r + 1)] - g[row + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = acc / (2 * r + 1);
        acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
    return out;
  }

  function sobel(g, w, h) {
    const e = new Float32Array(g.length);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const gx = -g[i - w - 1] - 2 * g[i - 1] - g[i + w - 1] + g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1];
        const gy = -g[i - w - 1] - 2 * g[i - w] - g[i - w + 1] + g[i + w - 1] + 2 * g[i + w] + g[i + w + 1];
        e[i] = Math.sqrt(gx * gx + gy * gy);
      }
    }
    return e;
  }

  function cartoon(src) {
    return pixels(src, (d, w, h) => {
      const edges = sobel(boxBlur(grayArr(d, w, h), w, h, 1), w, h);
      const levels = 6; const step = 255 / (levels - 1);
      for (let i = 0, j = 0; i < d.length; i += 4, j++) {
        for (let k = 0; k < 3; k++) d[i + k] = Math.round(Math.min(255, d[i + k] * 1.1) / step) * step;
        if (edges[j] > 90) { d[i] = d[i + 1] = d[i + 2] = 20; }
      }
    });
  }

  function sketch(src) {
    return pixels(src, (d, w, h) => {
      const g = grayArr(d, w, h);
      const inv = g.map((v) => 255 - v);
      const bl = boxBlur(boxBlur(inv, w, h, 4), w, h, 4);
      for (let i = 0, j = 0; i < d.length; i += 4, j++) {
        const v = Math.min(255, (g[j] * 255) / Math.max(1, 255 - bl[j]));
        d[i] = d[i + 1] = d[i + 2] = v;
      }
    });
  }

  function popart(src) {
    const palette = [[255, 64, 129], [255, 214, 0], [0, 176, 255], [30, 30, 60]];
    return pixels(src, (d, w, h) => {
      const g = grayArr(d, w, h);
      for (let i = 0, j = 0; i < d.length; i += 4, j++) {
        const idx = g[j] > 190 ? 1 : g[j] > 120 ? 0 : g[j] > 60 ? 2 : 3;
        [d[i], d[i + 1], d[i + 2]] = palette[idx];
      }
    });
  }

  function oil(src) {
    return pixels(src, (d, w, h) => {
      const r = 3; const levels = 20; const out = new Uint8ClampedArray(d);
      const g = grayArr(d, w, h);
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          const cnt = new Uint16Array(levels); const sr = new Float32Array(levels); const sg = new Float32Array(levels); const sb = new Float32Array(levels);
          for (let dy = -r; dy <= r; dy += 2) {
            for (let dx = -r; dx <= r; dx += 2) {
              const xx = Math.min(w - 1, Math.max(0, x + dx)); const yy = Math.min(h - 1, Math.max(0, y + dy));
              const j = yy * w + xx; const l = Math.min(levels - 1, (g[j] * levels / 256) | 0); const i = j * 4;
              cnt[l]++; sr[l] += d[i]; sg[l] += d[i + 1]; sb[l] += d[i + 2];
            }
          }
          let best = 0; for (let l = 1; l < levels; l++) if (cnt[l] > cnt[best]) best = l;
          const o = (y * w + x) * 4;
          out[o] = sr[best] / cnt[best]; out[o + 1] = sg[best] / cnt[best]; out[o + 2] = sb[best] / cnt[best];
        }
      }
      d.set(out);
    });
  }

  async function removeBg(src) {
    const blob = await new Promise((r) => src.toBlob(r, 'image/jpeg', 0.92));
    const fd = new FormData();
    fd.append('file', blob, 'photo.jpg');
    const res = await fetch(API_BASE + '/api/ai/remove-bg', { method: 'POST', body: fd });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || 'הסרת רקע נכשלה');
    }
    const url = URL.createObjectURL(await res.blob());
    const img = await loadImage(url);
    URL.revokeObjectURL(url);
    return toCanvas(img, 2000);
  }

  // ---------- העורך ----------
  class PhotoEditor {
    constructor(root, opts) {
      this.root = root;
      this.opts = opts; // { file, aspect (w/h או 'free'), overlay (מסגרת האירוע, PNG שקוף), allowAnimations, tools, ai, doneLabel, title, onCancel, onPrint(blob, edits), onAnimation(blob) }
      // המנהל קובע אילו כלים פתוחים ללקוח (הגדרות > עורך התמונות)
      this.tools = Object.assign({}, opts.tools || {});
      this.aiList = Object.fromEntries(Object.entries(AI_EFFECTS).filter(([k]) => k === 'none' || !opts.ai || opts.ai[k] !== false));
      if (Object.keys(this.aiList).length <= 1) this.tools.ai = false;
      this.state = {
        rotation: 0, zoom: 1, offX: 0, offY: 0, preset: 'none', ai: 'none',
        brightness: 100, contrast: 100, saturation: 100,
        frame: 'none', text: '', textColor: '#ffffff', textPos: 'bottom', textSize: 7,
        stickers: [], animation: 'hearts', landscape: false,
      };
      this.tab = null;
      this.init();
    }

    async init() {
      const url = URL.createObjectURL(this.opts.file);
      try {
        this.original = toCanvas(await loadImage(url), 2000);
      } catch {
        toast('לא ניתן לטעון את התמונה');
        this.opts.onCancel();
        return;
      } finally {
        URL.revokeObjectURL(url);
      }
      this.state.landscape = this.original.width > this.original.height;
      // מסגרת האירוע שהמנהל העלה: התמונה נכנסת לתוכה, והגודל והכיוון הם של המסגרת
      if (this.opts.overlay) {
        try { this.overlayImg = await loadImage(this.opts.overlay, true); } catch { this.overlayImg = null; toast('מסגרת האירוע לא נטענה, ממשיכים בלעדיה'); }
      }
      this.processed = this.original;
      this.renderUI();
      this.rebuildBase();
    }

    get aspect() {
      if (this.overlayImg) return this.overlayImg.naturalWidth / this.overlayImg.naturalHeight;
      // 'free' = היחס של התמונה עצמה (מוצר בלי מידת הדפסה, כמו ספל או אלבום)
      const a = this.opts.aspect === 'free' ? this.original.width / this.original.height : (this.opts.aspect || 2 / 3); // רוחב/גובה
      const portrait = a <= 1 ? a : 1 / a;
      return this.state.landscape ? 1 / portrait : portrait;
    }

    rebuildBase() {
      const src = this.processed;
      const rot = this.state.rotation % 360;
      const c = document.createElement('canvas');
      const swap = rot === 90 || rot === 270;
      c.width = swap ? src.height : src.width;
      c.height = swap ? src.width : src.height;
      const ctx = c.getContext('2d');
      ctx.translate(c.width / 2, c.height / 2);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.drawImage(src, -src.width / 2, -src.height / 2);
      this.base = c;
      this.draw();
    }

    async applyAI(name) {
      this.state.ai = name;
      if (name === 'none') { this.processed = this.original; this.rebuildBase(); return; }
      const busy = $('#ed-busy', this.root);
      busy.classList.remove('hidden');
      await new Promise((r) => setTimeout(r, 30));
      try {
        // עיבוד ברזולוציה מופחתת לאפקטים כבדים
        const small = toCanvas(this.original, name === 'oil' ? 900 : 1400);
        const fx = { enhance: autoEnhance, cartoon, sketch, popart, oil };
        this.processed = name === 'removebg' ? await removeBg(this.original) : fx[name](name === 'enhance' ? this.original : small);
        this.rebuildBase();
      } catch (e) {
        toast(e.message);
        this.state.ai = 'none';
        this.processed = this.original;
        this.rebuildBase();
        this.renderPanel();
      } finally {
        busy.classList.add('hidden');
      }
    }

    // מצייר את התמונה הסופית על הקנבס בגודל נתון. t = זמן לאנימציה (שניות) או null
    paint(ctx, W, H, t = null) {
      const s = this.state;
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      // מסגרת: אזור התמונה בתוך המסגרת
      let ix = 0; let iy = 0; let iw = W; let ih = H;
      const m = Math.min(W, H);
      if (s.frame === 'white' || s.frame === 'gold' || s.frame === 'hearts' || s.frame === 'floral' || s.frame === 'stars') {
        const pad = m * 0.05; ix = pad; iy = pad; iw = W - 2 * pad; ih = H - 2 * pad;
      } else if (s.frame === 'polaroid') {
        const pad = m * 0.05; ix = pad; iy = pad; iw = W - 2 * pad; ih = H - pad - m * 0.18;
      }

      // חיתוך cover + זום + הזזה
      let zoom = s.zoom;
      if (t !== null && s.animation === 'zoom') zoom *= 1 + 0.12 * (t / 4);
      if (t !== null && s.animation === 'pulse') zoom *= 1 + 0.04 * Math.sin(t * Math.PI * 2);
      const b = this.base;
      const scale = Math.max(iw / b.width, ih / b.height) * zoom;
      const dw = b.width * scale; const dh = b.height * scale;
      const maxX = Math.max(0, (dw - iw) / 2); const maxY = Math.max(0, (dh - ih) / 2);
      const dx = ix + (iw - dw) / 2 + s.offX * maxX;
      const dy = iy + (ih - dh) / 2 + s.offY * maxY;

      ctx.save();
      ctx.beginPath();
      ctx.rect(ix, iy, iw, ih);
      ctx.clip();
      const pf = PRESETS[s.preset].f;
      ctx.filter = `brightness(${s.brightness}%) contrast(${s.contrast}%) saturate(${s.saturation}%) ${pf}`.trim();
      ctx.drawImage(b, dx, dy, dw, dh);
      ctx.filter = 'none';
      ctx.restore();

      this.paintFrame(ctx, W, H, m);
      if (this.overlayImg) ctx.drawImage(this.overlayImg, 0, 0, W, H); // מסגרת האירוע

      // טקסט
      if (s.text) {
        const fs = (m * s.textSize) / 100;
        ctx.font = `800 ${fs}px Assistant, Rubik, Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.direction = 'rtl';
        let ty;
        if (s.frame === 'polaroid') { ctx.fillStyle = '#333'; ty = H - m * 0.08; } else {
          ctx.fillStyle = s.textColor;
          ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = fs * 0.25;
          ty = s.textPos === 'top' ? iy + fs * 1.3 : s.textPos === 'middle' ? H / 2 + fs / 3 : iy + ih - fs * 0.6;
        }
        if (t !== null) ctx.globalAlpha = Math.min(1, t / 0.8);
        ctx.fillText(s.text, W / 2, ty, W * 0.9);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }

      // מדבקות
      for (const st of s.stickers) {
        const size = m * st.size;
        ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let bob = 0;
        if (t !== null) bob = Math.sin(t * 3 + st.x * 10) * m * 0.01;
        ctx.fillText(st.e, st.x * W, st.y * H + bob);
        ctx.textBaseline = 'alphabetic';
      }

      if (t !== null) this.paintAnimation(ctx, W, H, m, t);
      ctx.restore();
    }

    paintFrame(ctx, W, H, m) {
      const f = this.state.frame;
      if (f === 'gold') {
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, '#b8862b'); g.addColorStop(0.5, '#f5d77a'); g.addColorStop(1, '#a67412');
        ctx.strokeStyle = g; ctx.lineWidth = m * 0.05; ctx.strokeRect(m * 0.025, m * 0.025, W - m * 0.05, H - m * 0.05);
      }
      const corners = { hearts: '💕', floral: '🌸', stars: '⭐' }[f];
      if (corners) {
        ctx.fillStyle = { hearts: '#ffe3ec', floral: '#f3fbe9', stars: '#1d2340' }[f];
        const pad = m * 0.05;
        ctx.fillRect(0, 0, W, pad); ctx.fillRect(0, H - pad, W, pad); ctx.fillRect(0, 0, pad, H); ctx.fillRect(W - pad, 0, pad, H);
        const sz = m * 0.09;
        ctx.font = `${sz}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        [[pad, pad], [W - pad, pad], [pad, H - pad], [W - pad, H - pad]].forEach(([x, y]) => ctx.fillText(corners, x, y));
        ctx.textBaseline = 'alphabetic';
      }
    }

    paintAnimation(ctx, W, H, m, t) {
      const a = this.state.animation;
      const seedRand = (i) => { const x = Math.sin(i * 999.13) * 43758.5453; return x - Math.floor(x); };
      if (a === 'hearts' || a === 'snow' || a === 'confetti') {
        const n = a === 'confetti' ? 70 : 28;
        for (let i = 0; i < n; i++) {
          const speed = 0.15 + seedRand(i) * 0.25;
          const y = ((seedRand(i + 7) + t * speed) % 1.1) * H - H * 0.05;
          const x = seedRand(i + 3) * W + Math.sin(t * 2 + i) * m * 0.02;
          if (a === 'confetti') {
            ctx.save(); ctx.translate(x, y); ctx.rotate(t * 4 + i);
            ctx.fillStyle = `hsl(${(i * 47) % 360} 85% 60%)`; ctx.fillRect(-m * 0.008, -m * 0.004, m * 0.016, m * 0.008);
            ctx.restore();
          } else {
            const sz = m * (0.03 + seedRand(i + 11) * 0.04);
            ctx.font = `${sz}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
            ctx.fillText(a === 'hearts' ? '❤️' : '❄️', x, y);
          }
        }
      }
      if (a === 'sparkle') {
        for (let i = 0; i < 25; i++) {
          const ph = (t * 1.5 + seedRand(i)) % 1;
          const alpha = Math.sin(ph * Math.PI);
          const x = seedRand(i + 1) * W; const y = seedRand(i + 2) * H; const r = m * 0.02 * alpha;
          ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = '#fff8d6'; ctx.translate(x, y);
          ctx.beginPath();
          for (let k = 0; k < 8; k++) { const rr = k % 2 ? r * 0.3 : r; const an = (k * Math.PI) / 4; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
          ctx.fill(); ctx.restore();
        }
      }
    }

    outSize(longSide) {
      const a = this.aspect;
      return a >= 1 ? [longSide, Math.round(longSide / a)] : [Math.round(longSide * a), longSide];
    }

    draw() {
      if (!this.base) return;
      const c = $('#ed-canvas', this.root);
      const [w, h] = this.outSize(900);
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      this.paint(c.getContext('2d'), w, h, this.previewT ?? null);
    }

    exportBlob(longSide = 1800) {
      const c = document.createElement('canvas');
      [c.width, c.height] = this.outSize(longSide);
      this.paint(c.getContext('2d'), c.width, c.height, null);
      return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
    }

    async recordAnimation(seconds = 4) {
      if (!window.MediaRecorder) throw new Error('הדפדפן לא תומך ביצירת וידאו');
      const c = document.createElement('canvas');
      [c.width, c.height] = this.outSize(720);
      const ctx = c.getContext('2d');
      const stream = c.captureStream(30);
      const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find((t) => MediaRecorder.isTypeSupported(t));
      if (!mime) throw new Error('הדפדפן לא תומך ביצירת וידאו');
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2.4e6 });
      const chunks = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const done = new Promise((r) => { rec.onstop = r; });
      rec.start();
      const t0 = performance.now();
      await new Promise((resolve) => {
        const tick = () => {
          const t = (performance.now() - t0) / 1000;
          this.paint(ctx, c.width, c.height, Math.min(t, seconds));
          if (t < seconds) requestAnimationFrame(tick); else resolve();
        };
        tick();
      });
      rec.stop();
      await done;
      return new Blob(chunks, { type: mime.split(';')[0] });
    }

    edits() {
      const s = this.state;
      return [this.overlayImg && 'event-frame', s.ai !== 'none' && `ai:${s.ai}`, s.preset !== 'none' && `filter:${s.preset}`, s.frame !== 'none' && `frame:${s.frame}`,
        s.text && 'text', s.stickers.length && `stickers:${s.stickers.length}`].filter(Boolean).join(',');
    }

    // ---------- ממשק ----------
    renderUI() {
      const tabs = [['crop', '✂️ חיתוך'], ['adjust', '🎚️ כיוונון'], ['filters', '🎨 פילטרים'], ['ai', '🤖 AI'],
        ['text', '🔤 טקסט'], ['stickers', '😍 מדבקות'], ['frames', '🖼️ מסגרת'], ['anim', '🎬 אנימציה']]
        .filter(([id]) => this.tools[id] !== false && (id !== 'anim' || this.opts.allowAnimations) && !(id === 'frames' && this.overlayImg));
      if (!tabs.find(([id]) => id === this.tab)) this.tab = tabs.length ? tabs[0][0] : null;
      this.root.innerHTML = `
        <div class="stack">${this.opts.title ? `<h2 style="margin:0">${esc(this.opts.title)}</h2>` : ''}
          <div class="editor-stage" id="ed-stage"><canvas id="ed-canvas"></canvas></div>
          <div id="ed-busy" class="hidden badge primary">מעבד… ⏳</div>
          <div class="tabs" id="ed-tabs">${tabs.map(([id, n]) => `<button class="tab${id === this.tab ? ' active' : ''}" data-tab="${id}">${n}</button>`).join('')}</div>
          <div id="ed-panel" class="card flat"></div>
          <div class="row">
            <button class="btn ghost" id="ed-cancel">ביטול</button>
            <span class="spacer"></span>
            <button class="btn" id="ed-done">${esc(this.opts.doneLabel || 'המשך ✓')}</button>
          </div>
        </div>`;
      $('#ed-tabs', this.root).addEventListener('click', (e) => {
        const b = e.target.closest('[data-tab]'); if (!b) return;
        this.tab = b.dataset.tab;
        $$('#ed-tabs .tab', this.root).forEach((x) => x.classList.toggle('active', x === b));
        this.stopPreview();
        this.renderPanel();
      });
      $('#ed-cancel', this.root).onclick = () => { this.stopPreview(); this.opts.onCancel(); };
      $('#ed-done', this.root).onclick = async () => { this.stopPreview(); this.opts.onPrint(await this.exportBlob(), this.edits()); };
      this.bindDrag();
      this.renderPanel();
    }

    bindDrag() {
      const c = $('#ed-canvas', this.root);
      let start = null;
      c.addEventListener('pointerdown', (e) => {
        const r = c.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width; const py = (e.clientY - r.top) / r.height;
        // אם לוחצים על מדבקה - מזיזים אותה, אחרת מזיזים את התמונה
        const hit = [...this.state.stickers].reverse().find((s) => Math.hypot(s.x - px, (s.y - py) * (r.height / r.width)) < s.size * 0.6);
        start = { x: e.clientX, y: e.clientY, offX: this.state.offX, offY: this.state.offY, sticker: hit, r };
        c.setPointerCapture(e.pointerId);
      });
      c.addEventListener('pointermove', (e) => {
        if (!start) return;
        const dx = (e.clientX - start.x) / start.r.width; const dy = (e.clientY - start.y) / start.r.height;
        if (start.sticker) {
          start.sticker.x = Math.min(1, Math.max(0, start.sticker.x + dx));
          start.sticker.y = Math.min(1, Math.max(0, start.sticker.y + dy));
          start.x = e.clientX; start.y = e.clientY;
        } else {
          this.state.offX = Math.min(1, Math.max(-1, start.offX + dx * 2));
          this.state.offY = Math.min(1, Math.max(-1, start.offY + dy * 2));
        }
        this.draw();
      });
      const end = () => { start = null; };
      c.addEventListener('pointerup', end);
      c.addEventListener('pointercancel', end);
    }

    slider(key, label, min, max, step = 1) {
      return `<div class="field"><label>${label}</label><input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${this.state[key]}"></div>`;
    }

    renderPanel() {
      const p = $('#ed-panel', this.root);
      const s = this.state;
      p.classList.toggle('hidden', !this.tab);
      if (!this.tab) return;
      const tools = (map, cur, attr) => `<div class="tool-grid">${Object.entries(map).map(([id, v]) =>
        `<button class="tool${id === cur ? ' active' : ''}" data-${attr}="${id}"><span class="ico">${v.ico || ''}</span>${esc(v.name || v)}</button>`).join('')}</div>`;
      const html = {
        crop: `<p class="muted small">${this.overlayImg ? '🖼️ התמונה בתוך המסגרת של האירוע. גררו והגדילו כדי למקם אותה.' : 'גררו את התמונה כדי למקם אותה במסגרת ההדפסה.'}</p>
          ${this.slider('zoom', 'זום', 1, 3, 0.01)}
          <div class="row"><button class="btn soft sm" data-act="rotate">↻ סיבוב</button>
          ${this.overlayImg ? '' : `<button class="btn soft sm" data-act="orient">${s.landscape ? '▯ לאורך' : '▭ לרוחב'}</button>`}
          <button class="btn soft sm" data-act="reset">איפוס</button></div>`,
        adjust: this.slider('brightness', 'בהירות', 50, 150) + this.slider('contrast', 'ניגודיות', 50, 150) + this.slider('saturation', 'רוויה', 0, 200),
        filters: tools(Object.fromEntries(Object.entries(PRESETS).map(([k, v]) => [k, { name: v.name, ico: '🎨' }])), s.preset, 'preset'),
        ai: `<p class="muted small">אפקטים חכמים שמעבדים את התמונה. "הסרת רקע" דורשת חיבור לשירות AI בהגדרות השרת.</p>${tools(this.aiList, s.ai, 'ai')}`,
        text: `<div class="field"><label>טקסט / ברכה</label><input id="ed-text" maxlength="60" value="${esc(s.text)}" placeholder="לדוגמה: מזל טוב! 💍"></div>
          <div class="fields"><div class="field"><label>צבע</label><input type="color" id="ed-color" value="${s.textColor}"></div>
          <div class="field"><label>מיקום</label><select id="ed-pos"><option value="top">למעלה</option><option value="middle">באמצע</option><option value="bottom">למטה</option></select></div></div>
          ${this.slider('textSize', 'גודל', 3, 14, 0.5)}`,
        stickers: `<p class="muted small">לחצו להוספה, גררו על התמונה להזזה.</p>
          <div class="tool-grid">${STICKERS.map((e) => `<button class="tool" data-sticker="${e}"><span class="ico">${e}</span></button>`).join('')}</div>
          <div class="row" style="margin-top:10px"><button class="btn soft sm" data-act="bigger">הגדלה אחרונה ➕</button><button class="btn soft sm" data-act="smaller">הקטנה ➖</button><button class="btn soft sm" data-act="unsticker">מחיקת אחרונה</button></div>`,
        frames: tools(Object.fromEntries(Object.entries(FRAMES).map(([k, v]) => [k, { name: v, ico: '🖼️' }])), s.frame, 'frame'),
        anim: `<p class="muted small">יוצרים סרטון קצר מהתמונה המעוצבת - מזכרת דיגיטלית לשמירה ושיתוף (לא נספרת במכסת ההדפסה).</p>
          ${tools(ANIMATIONS, s.animation, 'anim')}
          <div class="row" style="margin-top:10px"><button class="btn soft" data-act="preview">▶ תצוגה מקדימה</button><button class="btn" data-act="record">🎬 יצירת סרטון</button></div>`,
      }[this.tab];
      p.innerHTML = html;
      if (this.tab === 'text') {
        $('#ed-pos', p).value = s.textPos;
        $('#ed-text', p).oninput = (e) => { s.text = e.target.value; this.draw(); };
        $('#ed-color', p).oninput = (e) => { s.textColor = e.target.value; this.draw(); };
        $('#ed-pos', p).onchange = (e) => { s.textPos = e.target.value; this.draw(); };
      }
      $$('input[type=range][data-k]', p).forEach((r) => {
        r.oninput = () => { s[r.dataset.k] = Number(r.value); this.draw(); };
      });
      p.onclick = async (e) => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.preset) { s.preset = b.dataset.preset; this.draw(); this.renderPanel(); }
        if (b.dataset.frame) { s.frame = b.dataset.frame; this.draw(); this.renderPanel(); }
        if (b.dataset.ai) { await this.applyAI(b.dataset.ai); this.renderPanel(); }
        if (b.dataset.anim) { s.animation = b.dataset.anim; this.renderPanel(); this.startPreview(); }
        if (b.dataset.sticker) { s.stickers.push({ e: b.dataset.sticker, x: 0.5, y: 0.5, size: 0.14 }); this.draw(); }
        const last = s.stickers[s.stickers.length - 1];
        switch (b.dataset.act) {
          case 'rotate': s.rotation = (s.rotation + 90) % 360; this.rebuildBase(); break;
          case 'orient': s.landscape = !s.landscape; this.draw(); this.renderPanel(); break;
          case 'reset': Object.assign(s, { zoom: 1, offX: 0, offY: 0, rotation: 0 }); this.rebuildBase(); this.renderPanel(); break;
          case 'bigger': if (last) { last.size = Math.min(0.5, last.size * 1.2); this.draw(); } break;
          case 'smaller': if (last) { last.size = Math.max(0.04, last.size / 1.2); this.draw(); } break;
          case 'unsticker': s.stickers.pop(); this.draw(); break;
          case 'preview': this.startPreview(); break;
          case 'record': {
            this.stopPreview();
            b.disabled = true; b.textContent = 'מקליט… ⏳';
            try { this.opts.onAnimation(await this.recordAnimation(4)); } catch (err) { toast(err.message); }
            b.disabled = false; b.textContent = '🎬 יצירת סרטון';
            break;
          }
          default:
        }
      };
    }

    startPreview() {
      this.stopPreview();
      const t0 = performance.now();
      const tick = () => {
        this.previewT = ((performance.now() - t0) / 1000) % 4;
        this.draw();
        this.raf = requestAnimationFrame(tick);
      };
      tick();
    }

    stopPreview() {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
      this.previewT = null;
      this.draw();
    }
  }

  // "10x15" -> יחס רוחב/גובה
  PhotoEditor.aspectFromSize = (size) => {
    const m = String(size || '').match(/([\d.]+)\s*x\s*([\d.]+)/i);
    return m ? Number(m[1]) / Number(m[2]) : 2 / 3;
  };

  window.PhotoEditor = PhotoEditor;
}());
