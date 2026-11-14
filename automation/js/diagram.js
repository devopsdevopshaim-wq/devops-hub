// SVG drawings: communication topology and single-line power diagram.

import { PROTOCOLS, APPLICATIONS } from './catalog.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const iso = (s) => `⁦${s}⁩`;
function text(x, y, s, { size = 12, weight = 400, fill = 'var(--text)', anchor = 'middle', mono = false } = {}) {
  const a = mono ? anchor : ({ start: 'end', end: 'start' }[anchor] || anchor);
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${a}" ${mono ? 'font-family="IBM Plex Mono, monospace" direction="ltr"' : 'font-family="Heebo, sans-serif" direction="rtl"'}>${esc(s)}</text>`;
}
const box = (x, y, w, h, stroke = 'var(--line-strong)', fill = 'var(--surface-2)', r = 10) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.4"/>`;
const line = (d, stroke = 'var(--cyan)', sw = 1.8, dash = '') => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" ${dash ? `stroke-dasharray="${dash}"` : ''} stroke-linejoin="round" stroke-linecap="round"/>`;
const addrText = (a) => a.name ? a.name : a.ip ? a.ip : a.slave != null ? `slave ${a.slave}` : a.mac != null ? `MAC ${a.mac}` : a.node != null ? `node ${a.node}` : a.position != null ? `pos ${a.position}` : '';

export function topologySvg(plant) {
  const { cfg, drives, network } = plant;
  const p = PROTOCOLS[cfg.protocol];
  const per = 6;
  const DW = 150;
  const DH = 64;
  const GX = 22;
  const rows = Math.ceil(drives.length / per);
  const W = Math.max(760, per * (DW + GX) + 80);
  const top = 150;
  const H = top + rows * (DH + 90) + 40;
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" direction="ltr" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><title>טופולוגיית תקשורת</title><rect width="${W}" height="${H}" fill="var(--surface-solid)"/>`];
  const plc = network.devices.find((x) => x.kind === 'plc');
  out.push(`<g>${box(30, 24, 190, 58, 'var(--gold)')}${text(125, 48, 'PLC', { weight: 800, size: 14, mono: true })}${text(125, 68, plc.ip !== '—' ? plc.ip : 'Master', { size: 11, mono: true, fill: 'var(--text-2)' })}</g>`);
  const hmi = network.devices.find((x) => x.kind === 'hmi');
  if (hmi) out.push(`<g>${box(240, 24, 150, 58)}${text(315, 48, 'HMI', { weight: 800, mono: true })}${text(315, 68, hmi.ip, { size: 11, mono: true, fill: 'var(--text-2)' })}</g>`);
  const switches = network.devices.filter((x) => x.kind === 'switch');
  const color = { ethernet: 'var(--cyan)', rs485: 'var(--gold)', can: '#e87ba4' }[p.medium];
  const dpos = drives.map((d, i) => ({ d, x: 40 + (i % per) * (DW + GX), y: top + Math.floor(i / per) * (DH + 90) + 40 }));
  if (switches.length) {
    const sw = switches.map((s, i) => ({ s, x: 420 + i * 130, y: 30 }));
    sw.forEach(({ s, x, y }) => out.push(`<g>${box(x, y, 110, 46, 'var(--cyan)')}${text(x + 55, y + 21, s.name, { weight: 700, mono: true })}${text(x + 55, y + 37, s.ip, { size: 10, mono: true, fill: 'var(--text-2)' })}</g>`));
    out.push(line(`M220 53 H${sw[0].x}`, color, 2.4));
    if (hmi) out.push(line(`M390 53 H${sw[0].x}`, color, 1.6));
    for (let i = 1; i < sw.length; i++) out.push(line(`M${sw[i - 1].x + 110} 53 H${sw[i].x}`, color, 2.4));
    if (sw.length > 1 && switches[0].note === 'טבעת') out.push(line(`M${sw[0].x + 55} 30 V14 H${sw[sw.length - 1].x + 55} V30`, color, 2.4, '6 5'));
    dpos.forEach(({ d, x, y }, i) => {
      const s = sw[Math.min(sw.length - 1, Math.floor(i / 6))];
      out.push(line(`M${s.x + 55} 76 V${100 + (i % 6) * 4} H${x + DW / 2} V${y}`, color, 1.3));
    });
  } else {
    // bus: line through all drives, row by row
    const pts = [[220, 53], [240, 53], [240, top]];
    for (let r = 0; r < rows; r++) {
      const y = top + r * (DH + 90) + 18;
      const row = dpos.filter((_, i) => Math.floor(i / per) === r);
      const xs = row.map((q) => q.x + DW / 2);
      const [x0, x1] = r % 2 === 0 ? [40, Math.max(...xs)] : [Math.max(...xs), 40];
      pts.push([pts[pts.length - 1][0], y], [x0, y], [x1, y]);
      row.forEach((q) => out.push(line(`M${q.x + DW / 2} ${y} V${q.y}`, color, 1.4)));
      if (r < rows - 1) pts.push([x1, y + DH + 60]);
    }
    out.push(line(`M${pts.map((q) => q.join(' ')).join(' L')}`, color, 3));
    if (p.medium === 'rs485' || p.medium === 'can') {
      const last = pts[pts.length - 1];
      out.push(`<rect x="${last[0] - 9}" y="${last[1] - 9}" width="18" height="18" rx="3" fill="var(--warn)"/>${text(last[0], last[1] + 26, '120Ω', { size: 10, mono: true })}`);
      out.push(`<rect x="231" y="44" width="18" height="18" rx="3" fill="var(--warn)"/>`);
    }
  }
  dpos.forEach(({ d, x, y }) => {
    out.push(`<g>${box(x, y, DW, DH, 'var(--line-strong)')}<rect x="${x}" y="${y}" width="${DW}" height="5" rx="2" fill="${color}"/>${text(x + DW / 2, y + 24, d.tag, { weight: 800, mono: true })}${text(x + DW / 2, y + 40, `${d.kw} kW · ${APPLICATIONS[d.app].he}`, { size: 10.5, fill: 'var(--text-2)' })}${text(x + DW / 2, y + 56, addrText(d.addr), { size: 10, mono: true, fill: 'var(--text-2)' })}</g>`);
  });
  out.push(text(W - 20, H - 14, `${p.he} · ${{ line: 'טופולוגיית קו', star: 'טופולוגיית כוכב', ring: 'טבעת עם שרידות' }[p.topology]}`, { anchor: 'end', size: 11, fill: 'var(--muted)' }));
  out.push('</svg>');
  return out.join('');
}

export function singleLineSvg(plant) {
  const { drives, stats, cfg } = plant;
  const per = 8;
  const CW = 118;
  const rows = Math.ceil(drives.length / per);
  const W = Math.max(760, per * CW + 120);
  const rowH = 380;
  const H = 150 + rows * rowH;
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" direction="ltr" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><title>תרשים חד־קווי</title><rect width="${W}" height="${H}" fill="var(--surface-solid)"/>`];
  // supply
  out.push(`<circle cx="70" cy="44" r="18" fill="none" stroke="var(--gold)" stroke-width="2"/><circle cx="70" cy="66" r="18" fill="none" stroke="var(--gold)" stroke-width="2"/>`);
  out.push(text(110, 50, `שנאי ${cfg.transformerKVA} kVA`, { anchor: 'start', weight: 700 }), text(110, 68, iso(`${cfg.supplyV} V · ${cfg.hz} Hz`), { anchor: 'start', size: 11, fill: 'var(--text-2)' }));
  out.push(line('M70 84 V104', 'var(--text)', 2), `<rect x="62" y="104" width="16" height="22" fill="none" stroke="var(--text)" stroke-width="2"/>`, line('M70 126 V140', 'var(--text)', 2));
  out.push(text(110, 122, `מפסק ראשי · ${iso(`${Math.round(stats.totalKva * 1000 / (Math.sqrt(3) * cfg.supplyV))} A`)}`, { anchor: 'start', size: 11 }));
  for (let r = 0; r < rows; r++) {
    const by = 140 + r * rowH;
    const row = drives.slice(r * per, (r + 1) * per);
    const x1 = 60 + row.length * CW;
    out.push(line(`M50 ${by} H${x1}`, 'var(--gold)', 5));
    if (r > 0) out.push(line(`M50 ${by - rowH} V${by}`, 'var(--gold)', 5));
    row.forEach((d, k) => {
      const x = 60 + k * CW + CW / 2 - 6;
      let y = by;
      const seg = (len) => { out.push(line(`M${x} ${y} V${y + len}`, 'var(--text)', 1.8)); y += len; };
      seg(16);
      out.push(`<rect x="${x - 6}" y="${y}" width="12" height="22" fill="none" stroke="var(--text)" stroke-width="1.6"/>`, text(x + 12, y + 15, `${d.fuse}A`, { anchor: 'start', size: 10, mono: true }));
      y += 22;
      seg(10);
      if (d.accessories.some((a) => a.k === 'reactor')) {
        out.push(`<path d="M${x} ${y} q8 4 0 8 q8 4 0 8 q8 4 0 8" fill="none" stroke="var(--text)" stroke-width="1.6"/>`, text(x + 12, y + 16, 'L', { anchor: 'start', size: 10, mono: true }));
        y += 24;
        seg(8);
      }
      out.push(`<g>${box(x - 34, y, 68, 46, 'var(--cyan)', 'var(--surface-2)', 6)}${text(x, y + 19, 'VFD', { weight: 800, size: 12, mono: true })}${text(x, y + 35, `${d.driveKw}kW`, { size: 10, mono: true, fill: 'var(--text-2)' })}</g>`);
      y += 46;
      seg(10);
      const filt = d.accessories.find((a) => a.k === 'sine' || a.k === 'dvdt');
      if (filt) {
        out.push(`<rect x="${x - 14}" y="${y}" width="28" height="18" rx="3" fill="none" stroke="var(--warn)" stroke-width="1.6"/>`, text(x, y + 13, filt.k === 'sine' ? '~' : 'du/dt', { size: 9, mono: true }));
        y += 18;
        seg(8);
      }
      out.push(line(`M${x} ${y} V${y + 30}`, 'var(--text)', 1.8, '4 3'), text(x + 8, y + 20, `${d.cableM}m`, { anchor: 'start', size: 9.5, mono: true, fill: 'var(--muted)' }));
      y += 30;
      out.push(`<circle cx="${x}" cy="${y + 20}" r="20" fill="var(--surface-2)" stroke="var(--gold)" stroke-width="2"/>${text(x, y + 25, 'M', { weight: 900, size: 14, mono: true })}`);
      out.push(text(x, y + 56, d.tag, { weight: 800, mono: true, size: 11.5 }), text(x, y + 72, `${d.kw} kW · ${d.In} A`, { size: 10, mono: true, fill: 'var(--text-2)' }));
      if (d.accessories.some((a) => a.k === 'brake')) out.push(`<rect x="${x + 36}" y="${by + 90}" width="12" height="26" fill="none" stroke="var(--bad)" stroke-width="1.6"/>`, line(`M${x + 34} ${by + 103} H${x + 36}`, 'var(--bad)', 1.4));
    });
  }
  out.push('</svg>');
  return out.join('');
}

export function resolveSvgVars(svg) {
  const cs = getComputedStyle(document.documentElement);
  return svg.replace(/var\((--[\w-]+)\)/g, (_, v) => cs.getPropertyValue(v).trim() || '#888');
}
