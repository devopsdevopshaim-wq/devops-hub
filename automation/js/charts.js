// Small accessible SVG charts: horizontal bars, optionally drawn against a capacity track.

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => Number(n).toLocaleString('he-IL', { maximumFractionDigits: 1 });

let tipEl;
function tip(show, html, ev) {
  tipEl = tipEl || document.getElementById('tip');
  if (!tipEl) return;
  if (!show) { tipEl.hidden = true; return; }
  tipEl.innerHTML = html;
  tipEl.hidden = false;
  const r = ev.target.getBoundingClientRect?.() || { left: ev.clientX, top: ev.clientY, width: 0 };
  const x = ev.clientX ?? r.left + r.width / 2;
  const y = ev.clientY ?? r.top;
  tipEl.style.left = `${Math.min(window.innerWidth - tipEl.offsetWidth - 8, Math.max(8, x + 12))}px`;
  tipEl.style.top = `${Math.max(8, y - tipEl.offsetHeight - 12)}px`;
}

/**
 * rows: [{label, value, cap?, color?, tip?}]
 * Bars grow from the right (RTL reading start). Values are labelled at the bar end.
 */
export function hbars(el, rows, { unit = '', capLabel = 'זמין', valueLabel = 'בשימוש', max = null } = {}) {
  if (!rows.length) { el.innerHTML = '<p class="muted">אין נתונים.</p>'; return; }
  const rowH = 30;
  const labelW = 150;
  const W = 640;
  const H = rows.length * rowH + 10;
  const plotW = W - labelW - 130;
  const m = max ?? Math.max(...rows.map((r) => Math.max(r.value, r.cap ?? 0)), 1);
  const parts = [`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(el.dataset.title || 'תרשים עמודות')}">`];
  rows.forEach((r, i) => {
    const y = i * rowH + 6;
    const right = W - labelW;
    const w = Math.max(r.value > 0 ? 3 : 0, (r.value / m) * plotW);
    const tipText = r.tip || `${r.label}: ${fmt(r.value)}${unit}${r.cap != null ? ` מתוך ${fmt(r.cap)}${unit}` : ''}`;
    parts.push(`<g class="hb" tabindex="0" role="listitem" aria-label="${esc(tipText)}" data-tip="${esc(tipText)}">`);
    parts.push(`<rect x="0" y="${y - 3}" width="${W}" height="${rowH}" fill="transparent"/>`);
    parts.push(`<text x="${W - 4}" y="${y + 15}" text-anchor="end">${esc(r.label)}</text>`);
    if (r.cap != null) {
      const cw = (r.cap / m) * plotW;
      parts.push(`<rect x="${right - cw}" y="${y + 3}" width="${cw}" height="16" rx="4" fill="var(--grid)"/>`);
    }
    parts.push(`<rect x="${right - w}" y="${y + 3}" width="${w}" height="16" rx="4" fill="${r.color || 'var(--s-data)'}"/>`);
    const vx = right - Math.max(w, r.cap != null ? (r.cap / m) * plotW : 0) - 6;
    parts.push(`<text x="${vx}" y="${y + 15}" text-anchor="end" style="font-variant-numeric:tabular-nums">${fmt(r.value)}${r.cap != null ? ` / ${fmt(r.cap)}` : ''}${unit}</text>`);
    parts.push('</g>');
  });
  parts.push('</svg>');
  if (rows.some((r) => r.cap != null)) {
    parts.push(`<div class="legend"><span><i class="dot" style="background:${rows[0].color || 'var(--s-data)'}"></i>${esc(valueLabel)}</span><span><i class="dot" style="background:var(--grid)"></i>${esc(capLabel)}</span></div>`);
  }
  el.innerHTML = parts.join('');
  el.querySelector('svg').setAttribute('role', 'list');
  el.querySelectorAll('.hb').forEach((g) => {
    const show = (ev) => tip(true, esc(g.dataset.tip), ev);
    g.addEventListener('mousemove', show);
    g.addEventListener('mouseleave', () => tip(false));
    g.addEventListener('focus', (ev) => { const b = g.getBoundingClientRect(); tip(true, esc(g.dataset.tip), { target: g, clientX: b.left + b.width / 2, clientY: b.top }); void ev; });
    g.addEventListener('blur', () => tip(false));
  });
}
