// Traffic monitor: keeps a 120-second history for every endpoint, aggregates it to
// rooms / cabinets / WAN, and draws an oscilloscope-style trace.
// Data comes from a simulation, a live JSON endpoint, or an imported CSV snapshot.

const HIST = 120;

// Busy-hour behaviour per device type (Mbps): mean, burst ceiling, tx/rx ratio.
const MODEL = {
  data: { mean: 4, burst: 180, tx: 0.18, burstP: 0.012 },
  voice: { mean: 0.05, burst: 0.1, tx: 1, burstP: 0 },
  ap: { mean: 45, burst: 420, tx: 0.25, burstP: 0.02 },
  cam: { mean: 0.15, burst: 0.3, tx: 40, burstP: 0 },
  iot: { mean: 0.03, burst: 0.4, tx: 0.6, burstP: 0.005 },
  iptv: { mean: 6, burst: 14, tx: 0.02, burstP: 0.01 },
  print: { mean: 0.02, burst: 40, tx: 0.05, burstP: 0.004 },
};

function dayFactor(profile, d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60;
  if (profile === 'hotel' || profile === 'residential') {
    // evenings are busiest
    return 0.25 + 0.75 * Math.exp(-((h - 21) ** 2) / 10) + 0.25 * Math.exp(-((h - 8) ** 2) / 4);
  }
  const wd = d.getDay();
  const work = wd === 5 || wd === 6 ? 0.25 : 1; // Fri/Sat lighter
  return 0.08 + 0.92 * work * Math.exp(-((h - 12.5) ** 2) / 14);
}

export class Monitor {
  constructor(plan) {
    this.source = 'sim';
    this.paused = false;
    this.live = new Map();
    this.setPlan(plan);
    this.listeners = new Set();
    this.timer = null;
    this.fetchTimer = null;
  }

  setPlan(plan) {
    this.plan = plan;
    const eps = [];
    for (const idf of plan.idfs) {
      for (const o of idf.outlets) {
        eps.push({ ip: o.ip, type: o.type, label: o.label, room: o.room || null, roomNo: o.roomNo || null, idf: idf.id });
        if (o.hasPhone) eps.push({ ip: o.phoneIp, type: 'voice', label: `${o.label}-PH`, room: o.room, roomNo: o.roomNo, idf: idf.id });
      }
    }
    this.eps = eps;
    this.byIp = new Map(eps.map((e, i) => [e.ip, i]));
    this.rx = eps.map(() => new Float32Array(HIST));
    this.tx = eps.map(() => new Float32Array(HIST));
    this.lvl = new Float32Array(eps.length).fill(0.5);
    this.burst = new Float32Array(eps.length);
    this.on = eps.map((e) => (e.type === 'iptv' ? Math.random() < 0.4 : true));
    this.head = 0;
    this.ticks = 0;
    this.wanRx = new Float32Array(HIST);
    this.wanTx = new Float32Array(HIST);
    this.wanTotal = 0;
    // Bytes "so far today" (estimate) so volume readouts are meaningful immediately.
    const now = new Date();
    this.secToday = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    this.bytes = new Float64Array(eps.length);
    this.wanBytes = 0;
    for (let i = 0; i < HIST; i++) this.step(true);
    for (let i = 0; i < eps.length; i++) {
      const m = MODEL[eps[i].type] || MODEL.data;
      this.bytes[i] = (m.mean * (1 + m.tx)) * 1e6 / 8 * this.secToday * 0.25;
      this.wanBytes += this.bytes[i] * this.internetShare(eps[i].type);
    }
  }

  internetShare(type) {
    return { data: 0.55, ap: 0.8, iptv: 0.9, voice: 0.3, cam: 0.02, iot: 0.3, print: 0 }[type] ?? 0.5;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => { if (!this.paused) { this.step(false); this.emit(); } }, 1000);
  }

  stop() {
    clearInterval(this.timer); this.timer = null;
    clearInterval(this.fetchTimer); this.fetchTimer = null;
  }

  onTick(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(this); }

  setSource(kind, opts = {}) {
    this.source = kind;
    clearInterval(this.fetchTimer); this.fetchTimer = null;
    this.live = new Map();
    this.error = null;
    if (kind === 'json' && opts.url) {
      const pull = async () => {
        try {
          const res = await fetch(opts.url, { cache: 'no-store' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const items = Array.isArray(data) ? data : data.items || [];
          const m = new Map();
          for (const it of items) m.set(String(it.ip), { rx: (+it.rx_bps || 0) / 1e6, tx: (+it.tx_bps || 0) / 1e6 });
          this.live = m;
          this.error = null;
        } catch (e) {
          this.error = `לא ניתן לקרוא את מקור הנתונים: ${e.message}`;
        }
        this.emit();
      };
      pull();
      this.fetchTimer = setInterval(pull, 5000);
    }
    if (kind === 'csv' && opts.text) {
      const m = new Map();
      for (const line of opts.text.split(/\r?\n/)) {
        const [ip, rx, tx] = line.split(/[,;\t]/).map((x) => x && x.trim());
        if (!ip || !/^[\d.]+$|^WAN$/i.test(ip)) continue;
        m.set(ip.toUpperCase() === 'WAN' ? 'WAN' : ip, { rx: (+rx || 0) / 1e6, tx: (+tx || 0) / 1e6 });
      }
      this.live = m;
    }
  }

  step(warm) {
    const h = this.head;
    const df = dayFactor(this.plan.cfg.profile);
    let wr = 0;
    let wt = 0;
    for (let i = 0; i < this.eps.length; i++) {
      const e = this.eps[i];
      let r;
      let t;
      if (this.source === 'sim') {
        const m = MODEL[e.type] || MODEL.data;
        // mean-reverting random walk + occasional bursts
        let l = this.lvl[i] + (Math.random() - 0.5) * 0.25 + (0.5 - this.lvl[i]) * 0.08;
        l = Math.min(1.6, Math.max(0, l));
        this.lvl[i] = l;
        if (this.burst[i] > 0) this.burst[i]--;
        else if (Math.random() < m.burstP * df) this.burst[i] = 2 + Math.floor(Math.random() * 12);
        if (e.type === 'iptv' && Math.random() < 0.002) this.on[i] = !this.on[i];
        const active = this.on[i] ? 1 : 0.02;
        const base = e.type === 'cam' ? m.mean : m.mean * df * l * 2 * active;
        r = this.burst[i] > 0 ? m.burst * (0.4 + Math.random() * 0.6) * df : base;
        t = e.type === 'cam' ? 6 + Math.random() * 2.5 : r * m.tx * (0.6 + Math.random() * 0.8);
        if (e.type === 'cam') r = 0.1 + Math.random() * 0.1;
      } else {
        const v = this.live.get(e.ip);
        r = v ? v.rx : 0;
        t = v ? v.tx : 0;
      }
      this.rx[i][h] = r;
      this.tx[i][h] = t;
      if (!warm) this.bytes[i] += (r + t) * 1e6 / 8;
      const share = this.internetShare(e.type);
      wr += r * share;
      wt += t * share;
    }
    if (this.source !== 'sim' && this.live.has('WAN')) {
      const v = this.live.get('WAN');
      wr = v.rx; wt = v.tx;
    }
    this.wanRx[h] = wr;
    this.wanTx[h] = wt;
    if (!warm) this.wanBytes += (wr + wt) * 1e6 / 8;
    this.head = (h + 1) % HIST;
    this.ticks++;
  }

  // Series for a target: {kind:'wan'|'idf'|'room'|'ip'|'core', id}
  series(target) {
    const rx = new Float32Array(HIST);
    const tx = new Float32Array(HIST);
    let bytes = 0;
    let idxs = [];
    if (target.kind === 'wan') {
      for (let k = 0; k < HIST; k++) { rx[k] = this.wanRx[(this.head + k) % HIST]; tx[k] = this.wanTx[(this.head + k) % HIST]; }
      return { rx, tx, bytes: this.wanBytes, count: this.eps.length };
    }
    if (target.kind === 'core') idxs = this.eps.map((_, i) => i);
    else if (target.kind === 'idf') idxs = this.eps.map((e, i) => (e.idf === target.id ? i : -1)).filter((i) => i >= 0);
    else if (target.kind === 'room') idxs = this.eps.map((e, i) => (e.room === target.id ? i : -1)).filter((i) => i >= 0);
    else if (target.kind === 'ip') { const i = this.byIp.get(target.id); if (i != null) idxs = [i]; }
    for (const i of idxs) {
      const a = this.rx[i];
      const b = this.tx[i];
      for (let k = 0; k < HIST; k++) { const j = (this.head + k) % HIST; rx[k] += a[j]; tx[k] += b[j]; }
      bytes += this.bytes[i];
    }
    return { rx, tx, bytes, count: idxs.length };
  }

  current(i) {
    const j = (this.head - 1 + HIST) % HIST;
    return this.rx[i][j] + this.tx[i][j];
  }

  top(n = 10) {
    return this.eps.map((e, i) => ({ e, i, v: this.current(i) })).sort((a, b) => b.v - a.v).slice(0, n);
  }

  idfLoad() {
    const m = new Map();
    this.eps.forEach((e, i) => m.set(e.idf, (m.get(e.idf) || 0) + this.current(i)));
    return m;
  }

  roomLoad() {
    const m = new Map();
    this.eps.forEach((e, i) => { if (e.room) m.set(e.room, (m.get(e.room) || 0) + this.current(i)); });
    return m;
  }

  totals() {
    const j = (this.head - 1 + HIST) % HIST;
    let now = 0;
    let bytes = 0;
    for (let i = 0; i < this.eps.length; i++) { now += this.rx[i][j] + this.tx[i][j]; bytes += this.bytes[i]; }
    let peak = 0;
    for (let k = 0; k < HIST; k++) peak = Math.max(peak, this.wanRx[k] + this.wanTx[k]);
    return { now, bytes, wanNow: this.wanRx[j] + this.wanTx[j], wanBytes: this.wanBytes, wanPeak: peak };
  }
}

export function fmtRate(mbps) {
  if (mbps >= 1000) return `${(mbps / 1000).toFixed(2)} Gbps`;
  if (mbps >= 1) return `${mbps.toFixed(1)} Mbps`;
  return `${(mbps * 1000).toFixed(0)} Kbps`;
}

export function fmtBytes(b) {
  const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let i = 0;
  while (b >= 1000 && i < u.length - 1) { b /= 1000; i++; }
  return `${b.toFixed(i ? 1 : 0)} ${u[i]}`;
}

export function stats(arr) {
  const v = Array.from(arr);
  const sorted = [...v].sort((a, b) => a - b);
  const avg = v.reduce((s, x) => s + x, 0) / v.length;
  return { avg, peak: sorted[sorted.length - 1], p95: sorted[Math.floor(sorted.length * 0.95) - 1] ?? 0, now: v[v.length - 1] };
}

const niceMax = (v) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
};

export function drawScope(canvas, rx, tx, { reduceMotion = false } = {}) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.direction = 'ltr';
  const padL = 84;
  const padR = 14;
  const padT = 40;
  const padB = 24;
  const pw = w - padL - padR;
  const ph = h - padT - padB;
  let max = 0;
  for (let i = 0; i < rx.length; i++) max = Math.max(max, rx[i], tx[i]);
  max = niceMax(max * 1.1);
  // graticule
  ctx.strokeStyle = 'rgba(80, 255, 200, 0.10)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i++) { const x = padL + (pw * i) / 10; ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + ph); ctx.stroke(); }
  for (let i = 0; i <= 5; i++) { const y = padT + (ph * i) / 5; ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + pw, y); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(80, 255, 200, 0.25)';
  ctx.beginPath(); ctx.moveTo(padL, padT + ph / 2); ctx.lineTo(padL + pw, padT + ph / 2); ctx.stroke();
  ctx.fillStyle = 'rgba(170, 255, 225, 0.75)';
  ctx.font = '11px "IBM Plex Mono", monospace';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 5; i++) {
    const v = max * (1 - i / 5);
    ctx.fillText(fmtRate(v), padL - 8, padT + (ph * i) / 5 + 4);
  }
  ctx.textAlign = 'center';
  ctx.fillText('-120s', padL, h - 6);
  ctx.fillText('-60s', padL + pw / 2, h - 6);
  ctx.fillText('עכשיו', padL + pw - 14, h - 6);
  const trace = (arr, color, fill) => {
    ctx.beginPath();
    for (let i = 0; i < arr.length; i++) {
      const x = padL + (pw * i) / (arr.length - 1);
      const y = padT + ph - (arr[i] / max) * ph;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.save();
    if (!reduceMotion) { ctx.shadowColor = color; ctx.shadowBlur = 10; }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    if (fill) {
      ctx.lineTo(padL + pw, padT + ph);
      ctx.lineTo(padL, padT + ph);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, padT, 0, padT + ph);
      g.addColorStop(0, fill);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fill();
    }
    const lx = padL + pw;
    const ly = padT + ph - (arr[arr.length - 1] / max) * ph;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI * 2); ctx.fill();
  };
  trace(rx, '#3cf2b4', 'rgba(60, 242, 180, 0.18)');
  trace(tx, '#ffc861', null);
  return max;
}
