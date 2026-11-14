// SVG drawings: riser (physical) diagram, per-cabinet logical diagram, rack elevation.

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const TYPE_META = {
  data: { he: 'מחשב', color: 'var(--s-data)' },
  voice: { he: 'טלפון', color: 'var(--s-voice)' },
  ap: { he: 'נקודת גישה', color: 'var(--s-ap)' },
  cam: { he: 'מצלמה', color: 'var(--s-cam)' },
  iot: { he: 'בקר / IoT', color: 'var(--s-iot)' },
  iptv: { he: 'טלוויזיה', color: 'var(--s-iptv)' },
  print: { he: 'מדפסת', color: 'var(--s-print)' },
};

function box(x, y, w, h, { fill = 'var(--surface-2)', stroke = 'var(--line-strong)', r = 10, sw = 1 } = {}) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
}
// `anchor` is always in left-to-right geometry; Hebrew text is laid out RTL, so start/end swap.
function text(x, y, s, { size = 12, weight = 400, fill = 'var(--text)', anchor = 'middle', mono = false } = {}) {
  const a = mono ? anchor : ({ start: 'end', end: 'start' }[anchor] || anchor);
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${a}" ${mono ? 'font-family="IBM Plex Mono, monospace" direction="ltr"' : 'font-family="Heebo, sans-serif" direction="rtl"'}>${esc(s)}</text>`;
}
// Keeps number ranges and codes in LTR order inside Hebrew labels.
const iso = (s) => `\u2066${s}\u2069`;
const path = (d, { stroke = 'var(--cyan)', sw = 1.6, dash = '' } = {}) => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" ${dash ? `stroke-dasharray="${dash}"` : ''} stroke-linecap="round" stroke-linejoin="round"/>`;

function device(x, y, w, h, title, sub, kind) {
  const accent = { fw: 'var(--bad)', core: 'var(--gold)', isp: 'var(--muted)', dist: 'var(--gold)', idf: 'var(--cyan)' }[kind] || 'var(--cyan)';
  return `<g>${box(x, y, w, h, { stroke: accent, sw: 1.4 })}<rect x="${x}" y="${y + 8}" width="3" height="${h - 16}" rx="1.5" fill="${accent}"/>${text(x + w / 2, y + h / 2 - 2, title, { size: 12.5, weight: 700, mono: true })}${sub ? text(x + w / 2, y + h / 2 + 14, sub, { size: 10.5, fill: 'var(--text-2)' }) : ''}</g>`;
}

export function riserSvg(plan) {
  const ROW = 64;
  const CHIP_W = 150;
  const CHIP_H = 46;
  const LEFT = 260;
  const GAP = 40;
  const top = 70;
  const maxFloors = Math.max(...plan.buildings.map((b) => b.floors.length));
  const bW = plan.buildings.map((b) => Math.max(260, Math.max(...b.floors.map((f) => f.idfs.length)) * (CHIP_W + 14) + 120));
  const width = LEFT + bW.reduce((s, w) => s + w + GAP, 0) + 20;
  const bottomY = top + maxFloors * ROW + (plan.multiBuilding ? 120 + plan.buildings.length * 8 : 40);
  const height = Math.max(bottomY + 60, 560);
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" direction="ltr" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`);
  out.push(`<title>שרטוט פיזי — ${esc(plan.cfg.site.name)}</title><desc>מבנים, קומות וארונות תקשורת, סיבים לארון הראשי וחיבור לאינטרנט</desc>`);
  out.push(`<rect width="${width}" height="${height}" fill="var(--surface-solid)"/>`);

  // Edge column: Internet → ISP → FW → Core.
  const cx = 30;
  const cw = 200;
  let y = 20;
  out.push(`<g><path d="M${cx + 40} ${y + 50} a26 26 0 0 1 10-46 a34 34 0 0 1 62-8 a28 28 0 0 1 48 22 a22 22 0 0 1 -6 32 z" fill="var(--surface-2)" stroke="var(--line-strong)"/>${text(cx + cw / 2, y + 34, 'אינטרנט', { weight: 800, size: 14 })}</g>`);
  y += 80;
  const isps = Math.max(1, plan.cfg.isps | 0);
  const ispW = (cw - (isps - 1) * 8) / isps;
  for (let i = 0; i < isps; i++) {
    out.push(device(cx + i * (ispW + 8), y, ispW, 40, `ISP-${i + 1}`, isps > 2 ? '' : 'נתב ספק', 'isp'));
    out.push(path(`M${cx + i * (ispW + 8) + ispW / 2} ${y} V${y - 22}`, { stroke: 'var(--muted)' }));
  }
  y += 70;
  const fwW = (cw - (plan.fwNames.length - 1) * 8) / plan.fwNames.length;
  plan.fwNames.forEach((n, i) => out.push(device(cx + i * (fwW + 8), y, fwW, 46, n, 'חומת אש NGFW', 'fw')));
  out.push(path(`M${cx + cw / 2} ${y} V${y - 30}`, { stroke: 'var(--muted)' }));
  y += 76;
  const coreY = y;
  const coreW = (cw - (plan.coreNames.length - 1) * 8) / plan.coreNames.length;
  plan.coreNames.forEach((n, i) => out.push(device(cx + i * (coreW + 8), y, coreW, 52, n, 'ליבה L3', 'core')));
  out.push(path(`M${cx + cw / 2} ${y} V${y - 30}`, { stroke: 'var(--muted)', sw: 2 }));
  out.push(text(cx + cw / 2, y + 80, `ארון ראשי MDF · ${iso(`${plan.mdf.sizeU}U`)}`, { size: 11, fill: 'var(--text-2)' }));
  out.push(`<rect x="${cx - 10}" y="${coreY - 196}" width="${cw + 20}" height="${300}" rx="16" fill="none" stroke="var(--gold)" stroke-dasharray="5 6" opacity=".55"/>`);
  const coreOut = { x: cx + cw, y: coreY + 26 };

  // Buildings
  let bx = LEFT;
  plan.buildings.forEach((b, bi) => {
    const w = bW[bi];
    const floors = b.floors.length;
    const bTop = top + (maxFloors - floors) * ROW;
    out.push(`<rect x="${bx}" y="${bTop - 40}" width="${w}" height="${floors * ROW + 40}" rx="14" fill="none" stroke="var(--line-strong)"/>`);
    out.push(text(bx + w / 2, bTop - 16, `${b.name} (${b.code}) · ${floors} קומות · ${b.roomCount} חדרים`, { weight: 800, size: 13, fill: 'var(--gold)' }));
    const riserX = bx + 22;
    const fl = [...b.floors].reverse();
    fl.forEach((f, i) => {
      const ry = bTop + i * ROW;
      out.push(`<line x1="${bx}" y1="${ry + ROW}" x2="${bx + w}" y2="${ry + ROW}" stroke="var(--line)" />`);
      out.push(text(bx + w - 12, ry + ROW / 2 + 4, `קומה ${f.label}`, { anchor: 'end', size: 12, weight: 700, fill: 'var(--text-2)' }));
      f.idfs.forEach((idf, k) => {
        const x = bx + 50 + k * (CHIP_W + 14);
        const yy = ry + (ROW - CHIP_H) / 2;
        const first = idf.rooms[0]?.no;
        const last = idf.rooms[idf.rooms.length - 1]?.no;
        out.push(`<g tabindex="0" data-idf="${esc(idf.id)}" aria-label="${esc(`${idf.id}: ${idf.members} מתגים, חדרים ${first} עד ${last}`)}">${box(x, yy, CHIP_W, CHIP_H, { stroke: 'var(--cyan)' })}${text(x + CHIP_W / 2, yy + 18, idf.id, { size: 11.5, weight: 700, mono: true })}${text(x + CHIP_W / 2, yy + 35, `חדרים ${iso(`${first}–${last}`)} · ${iso(`${idf.members}×SW`)}`, { size: 10, fill: 'var(--text-2)' })}</g>`);
        out.push(path(`M${x} ${yy + CHIP_H / 2} H${riserX}`, { stroke: 'var(--cyan)', sw: 1.2 }));
      });
    });
    const riserBottom = top + maxFloors * ROW + 20;
    out.push(path(`M${riserX} ${bTop + 10} V${riserBottom}`, { stroke: 'var(--cyan)', sw: 3 }));
    if (plan.multiBuilding) {
      const d = plan.dist[bi];
      const dy = riserBottom + 10;
      const dw = Math.min(200, w - 40);
      out.push(device(riserX - 10, dy, dw, 46, d.names.length > 1 ? `DS-${b.code}-1/2` : d.names[0], 'הפצה L3', 'dist'));
      out.push(path(`M${riserX} ${riserBottom} V${dy}`, { stroke: 'var(--cyan)', sw: 3 }));
      // route under the distribution boxes so lines never cross another building's switch
      const lane = dy + 60 + bi * 8;
      out.push(path(`M${riserX + 10} ${dy + 46} V${lane} H${coreOut.x + 24 + bi * 8} V${coreOut.y - 12 + bi * 8} H${coreOut.x}`, { stroke: 'var(--gold)', sw: 2.2 }));
    } else {
      out.push(path(`M${riserX} ${riserBottom} V${riserBottom + 10} H${coreOut.x + 30} V${coreOut.y} H${coreOut.x}`, { stroke: 'var(--cyan)', sw: 3 }));
    }
    bx += w + GAP;
  });
  out.push(text(width - 16, height - 16, `${iso(plan.uplink.label)} · סיב OS2 · ${plan.redundancy ? 'שני קישורים מכל ארון' : 'קישור יחיד'}`, { anchor: 'end', size: 11, fill: 'var(--muted)' }));
  out.push('</svg>');
  return out.join('');
}

export function logicSvg(plan, idf) {
  const b = plan.buildings[idf.building];
  const groups = [];
  const byType = {};
  for (const o of idf.outlets) (byType[o.type] = byType[o.type] || []).push(o);
  for (const [t, list] of Object.entries(byType)) {
    const s = list[0].subnet;
    groups.push({ t, n: list.length, vlan: t === 'room' ? '' : (s?.key === 'room' ? 'VLAN לכל חדר' : `VLAN ${s?.vlan}`), cidr: s?.key === 'room' ? `‎/${s.prefix} לחדר` : s?.cidr });
  }
  const phones = idf.outlets.filter((o) => o.hasPhone).length;
  if (phones) groups.push({ t: 'voice', n: phones, vlan: `VLAN ${idf.outlets.find((o) => o.hasPhone).phoneSubnet.vlan}`, cidr: 'דרך שקע המחשב' });
  const W = Math.max(760, groups.length * 170 + 40);
  const H = 430;
  const upstream = plan.multiBuilding ? plan.dist[idf.building].names : plan.coreNames;
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" direction="ltr" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><title>שרטוט לוגי ${esc(idf.id)}</title><rect width="${W}" height="${H}" fill="var(--surface-solid)"/>`];
  const uw = 170;
  const ux0 = W / 2 - (upstream.length * uw + (upstream.length - 1) * 20) / 2;
  upstream.forEach((n, i) => out.push(device(ux0 + i * (uw + 20), 20, uw, 50, n, plan.multiBuilding ? 'הפצה L3 · Gateway' : 'ליבה L3 · Gateway', 'core')));
  const sx = W / 2 - 160;
  const sy = 130;
  out.push(device(sx, sy, 320, 64, idf.host, `מחסנית ${iso(`${idf.members}×${plan.cfg.switchPorts}`)} · ניהול ${iso(idf.mgmtIp)}`, 'idf'));
  upstream.forEach((n, i) => {
    const x = ux0 + i * (uw + 20) + uw / 2;
    out.push(path(`M${x} 70 V100 H${W / 2 + (i - (upstream.length - 1) / 2) * 60} V${sy}`, { stroke: 'var(--gold)', sw: 2.4 }));
  });
  out.push(text(W / 2 + 12, 112, `Port-channel · ${iso(`${idf.uplinks}×${plan.uplink.label}`)} · Trunk`, { anchor: 'start', size: 11, fill: 'var(--text-2)' }));
  const gw = (W - 40) / groups.length;
  groups.forEach((g, i) => {
    const x = 20 + i * gw + 6;
    const y = 270;
    const meta = TYPE_META[g.t] || TYPE_META.data;
    out.push(path(`M${W / 2} ${sy + 64} V230 H${x + (gw - 12) / 2} V${y}`, { stroke: meta.color, sw: 1.6 }));
    out.push(`<g>${box(x, y, gw - 12, 120, { stroke: meta.color })}<rect x="${x}" y="${y}" width="${gw - 12}" height="6" rx="3" fill="${meta.color}"/>${text(x + (gw - 12) / 2, y + 32, meta.he, { weight: 800, size: 13 })}${text(x + (gw - 12) / 2, y + 58, `${g.n}`, { weight: 900, size: 22 })}${text(x + (gw - 12) / 2, y + 82, g.vlan, { size: 11, fill: 'var(--text-2)' })}${text(x + (gw - 12) / 2, y + 100, g.cidr || '', { size: 10.5, mono: true, fill: 'var(--text-2)' })}</g>`);
  });
  out.push(text(W / 2, H - 10, `${b.name} · קומה ${plan.buildings[idf.building].floors[idf.floor].label} · ${idf.rooms.length} חדרים`, { size: 11, fill: 'var(--muted)' }));
  out.push('</svg>');
  return out.join('');
}

const RACK_COLORS = {
  switch: 'var(--cyan)', panel: '#8b97ae', cm: 'var(--line-strong)', fiber: 'var(--gold)', ups: 'var(--ok)', shelf: 'var(--line-strong)',
  core: 'var(--gold)', fw: 'var(--bad)', isp: 'var(--muted)', server: '#9085e9',
};

export function rackSvg(rack, title) {
  const U = 17;
  const W = 330;
  const top = 30;
  const H = top + rack.sizeU * U + 30;
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" direction="ltr" viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px"><title>${esc(title)}</title><rect width="${W}" height="${H}" rx="12" fill="var(--surface-solid)"/>`];
  out.push(`<rect x="34" y="${top - 6}" width="${W - 68}" height="${rack.sizeU * U + 12}" rx="6" fill="var(--surface-2)" stroke="var(--line-strong)" stroke-width="2"/>`);
  for (let u = 0; u < rack.sizeU; u++) {
    const y = top + u * U;
    out.push(text(20, y + 12, rack.sizeU - u, { size: 9, fill: 'var(--muted)', mono: true }));
    out.push(`<line x1="40" y1="${y + U}" x2="${W - 40}" y2="${y + U}" stroke="var(--line)" stroke-width=".5"/>`);
  }
  let u = 0;
  for (const it of rack.items) {
    const y = top + u * U + 1;
    const h = it.u * U - 2;
    const c = RACK_COLORS[it.type] || 'var(--line-strong)';
    if (it.type === 'cm') {
      out.push(`<rect x="44" y="${y}" width="${W - 88}" height="${h}" rx="3" fill="none" stroke="${c}" stroke-dasharray="3 3"/>`);
    } else {
      out.push(`<rect x="44" y="${y}" width="${W - 88}" height="${h}" rx="3" fill="color-mix(in srgb, ${c} 18%, var(--surface-solid))" stroke="${c}"/>`);
      if (it.type === 'switch' || it.type === 'panel') {
        for (let p = 0; p < 12; p++) out.push(`<rect x="${56 + p * 9}" y="${y + 4}" width="6" height="${h - 8}" rx="1" fill="${c}" opacity=".55"/>`);
      }
    }
    out.push(text(W - 50, y + h / 2 + 4, it.label, { anchor: 'end', size: it.type === 'cm' ? 9 : 10.5, weight: it.type === 'switch' || it.type === 'core' ? 700 : 400, fill: it.type === 'cm' ? 'var(--muted)' : 'var(--text)' }));
    u += it.u;
  }
  out.push(text(W / 2, H - 8, `${iso(`${rack.usedU}U`)} בשימוש מתוך ${iso(`${rack.sizeU}U`)}`, { size: 11, fill: 'var(--text-2)' }));
  out.push('</svg>');
  return out.join('');
}

// Inline computed colors so a downloaded SVG looks right outside the page.
export function resolveSvgVars(svg) {
  const cs = getComputedStyle(document.documentElement);
  return svg.replace(/var\((--[\w-]+)\)/g, (_, v) => cs.getPropertyValue(v).trim() || '#888');
}
