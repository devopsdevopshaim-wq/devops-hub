/* ארון־פלאן — ציור מדויק של החוט הנוכחי בעמדת החיווט:
   בידוד בצבע ובעובי היחסי, קילוף, שרוול קצה בצבע DIN 46228-4 (TWIN כשצריך), שרוולי סימון עם המספר, ומידות.
   ב-RTL: הקצה "מאיפה" מימין והקצה "לאן" משמאל, כמו החץ ← בכרטיס. */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function wireSvg(w, { C, len, fromLabel, toLabel, done }) {
  const col = C.COLORS[w.color] || C.COLORS.BK;
  const fer = C.ferrule(w.section, false);
  const ferC = C.COLORS[fer.color];
  const th = Math.max(9, Math.min(20, 7 + Math.sqrt(w.section || 0.75) * 6));
  const W = 760, H = 190, y = 82;
  const id = 'w' + Math.random().toString(36).slice(2, 7);
  const insul = col.stripe ? `url(#${id}s)` : col.hex;
  const dark = /^#(1c|1f|7b|2f|8e|d6)/i.test(col.hex);
  /* קצה אחד: x0 = קצה המתכת, dir = 1 (שמאל) או -1 (ימין) */
  const end = (x0, dir, twin, label, sub) => {
    const X = (d) => x0 + dir * d;
    const metal = 34, collar = twin ? 30 : 24, sleeve = 50;
    const g = [];
    /* שרוול מתכת עם חוטי נחושת */
    g.push(`<rect x="${Math.min(X(0), X(metal))}" y="${y - 7}" width="${metal}" height="14" rx="2" fill="url(#${id}m)" stroke="#8b9198" stroke-width=".8"/>`);
    for (let i = 0; i < 4; i++) g.push(`<line x1="${X(2)}" y1="${y - 4 + i * 2.6}" x2="${X(metal - 2)}" y2="${y - 4 + i * 2.6}" stroke="#c98a4b" stroke-width=".9" opacity=".55"/>`);
    /* צווארון פלסטיק של השרוול */
    g.push(`<path d="M${X(metal)} ${y - (twin ? 15 : 11)} L${X(metal + collar)} ${y - (twin ? 17 : 13)} L${X(metal + collar)} ${y + (twin ? 17 : 13)} L${X(metal)} ${y + (twin ? 15 : 11)} Z" fill="${ferC.hex}" stroke="rgba(0,0,0,.35)" stroke-width=".8"/>`);
    if (twin) g.push(`<text x="${X(metal + collar / 2)}" y="${y + 4}" class="wr-twin" text-anchor="middle">TWIN</text>`);
    /* שרוול סימון */
    const sx = X(metal + collar + 14);
    g.push(`<rect x="${Math.min(sx, X(metal + collar + 14 + sleeve))}" y="${y - 13}" width="${sleeve}" height="26" rx="5" fill="#fbfbf9" stroke="#9aa2a8"/>`);
    g.push(`<text x="${X(metal + collar + 14 + sleeve / 2)}" y="${y + 5}" class="wr-no" text-anchor="middle">${esc(String(w.no).slice(0, 7))}</text>`);
    /* מידת קילוף */
    g.push(`<line x1="${X(0)}" y1="${y - 24}" x2="${X(metal)}" y2="${y - 24}" class="wr-dim" marker-start="url(#${id}a)" marker-end="url(#${id}a)"/>`);
    g.push(`<text x="${X(metal / 2)}" y="${y - 30}" class="wr-dimt" text-anchor="middle">${fer.strip} מ"מ</text>`);
    /* תווית הקצה */
    g.push(`<text x="${X(10)}" y="${y + 44}" class="wr-ep" text-anchor="${dir === 1 ? 'start' : 'end'}">${esc(label)}</text>`);
    g.push(`<text x="${X(10)}" y="${y + 62}" class="wr-sub" text-anchor="${dir === 1 ? 'start' : 'end'}">${esc(sub)}</text>`);
    return { svg: g.join(''), inner: X(metal + collar) };
  };
  const L = end(26, 1, w.twinTo, toLabel[0], toLabel[1]);
  const R = end(W - 26, -1, w.twinFrom, fromLabel[0], fromLabel[1]);
  const mid = W / 2;
  const body = (x1, x2) => `<rect x="${Math.min(x1, x2)}" y="${y - th / 2}" width="${Math.abs(x2 - x1)}" height="${th}" rx="${th / 2}" fill="${insul}" stroke="${dark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.28)'}" stroke-width=".8"/><rect x="${Math.min(x1, x2)}" y="${y - th / 2 + 2}" width="${Math.abs(x2 - x1)}" height="${Math.max(2, th / 4)}" rx="2" fill="#fff" opacity=".22"/>`;
  return `<svg class="wire-render${done ? ' is-done' : ''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="חוט ${esc(w.no)}: ${esc(col.he)}, ${esc(C.fmtSection(w.section))} ממ&quot;ר, ${len ? esc(len) + ' ס&quot;מ' : 'אורך לפי השטח'}">
    <defs>
      <linearGradient id="${id}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef0f2"/><stop offset=".5" stop-color="#b9bec4"/><stop offset="1" stop-color="#e0e3e6"/></linearGradient>
      ${col.stripe ? `<pattern id="${id}s" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="22" height="22" fill="${col.hex}"/><rect width="9" height="22" fill="${col.stripe}"/></pattern>` : ''}
      <marker id="${id}a" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 z" fill="#5f6870"/></marker>
    </defs>
    ${body(L.inner, mid - 22)}${body(mid + 22, R.inner)}
    <path d="M${mid - 26} ${y + 14} l10 -28 M${mid + 16} ${y + 14} l10 -28" stroke="#9aa2a8" stroke-width="2"/>
    ${L.svg}${R.svg}
    <line x1="${L.inner + 70}" y1="${y + 30}" x2="${R.inner - 70}" y2="${y + 30}" class="wr-dim" marker-start="url(#${id}a)" marker-end="url(#${id}a)"/>
    <rect x="${mid - 60}" y="${y + 20}" width="120" height="20" rx="4" fill="var(--surface, #f8f8f6)"/>
    <text x="${mid}" y="${y + 35}" class="wr-len" text-anchor="middle">${len ? '≈ ' + esc(len) + ' ס"מ' : 'אורך לפי השטח'}</text>
    <text x="${mid}" y="${y - 22}" class="wr-spec" text-anchor="middle">${esc(col.he)} · ${esc(C.fmtSection(w.section))} ממ"ר · ${esc(w.wireType || '')}</text>
    <g transform="translate(${mid} ${y})"><g class="wr-check"><circle r="22" fill="#2f7d4f"/><path d="M-10 0 l7 7 l13 -14" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g></g>
  </svg>`;
}
