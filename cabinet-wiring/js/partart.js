/* ארון־פלאן — ציור של החלק עצמו (לא תמונת יצרן): צורה, צבעים וסימונים כמו של הרכיב האמיתי,
   עם היצרן, המק"ט והדירוג. לתמונות אמיתיות — הקישורים לדף המוצר אצל היצרן. */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const ACCENT = (m) => /schneider/i.test(m) ? '#3dcd58' : /^abb/i.test(m) ? '#ff000f' : /siemens/i.test(m) ? '#009999' : /phoenix/i.test(m) ? '#0098a1' : /weidm/i.test(m) ? '#f5a300' : /mean/i.test(m) ? '#1a5fb4' : /finder/i.test(m) ? '#e2001a' : '#a85a26';
const BRAND = (m) => String(m || '').replace(/ Electric$/, '').replace('Phoenix Contact', 'PHOENIX').toUpperCase().slice(0, 12);

function rating(c) {
  const t = `${c.name || ''} ${c.desc || ''} ${c.partDesc || ''}`;
  const m = /\b([BCD])\s?(\d{1,3})\b/.exec(t) || /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*A/.exec(t.replace(/[–—]/g, '-')) || /(\d+(?:\.\d+)?)\s*A\b/.exec(t);
  if (!m) return '';
  if (/^[BCD]$/.test(m[1])) return m[1] + m[2];
  return m[2] && /-/.test(m[0]) ? `${m[1]}–${m[2]}A` : `${m[1]}A`;
}
function poleCount(c, def) {
  const t = `${c.name || ''} ${c.desc || ''} ${c.partDesc || ''}`;
  const m = /\b([1-4])\s*[×xP]/.exec(t) || /\b([1-4])\s*קטב/.exec(t);
  return m ? Number(m[1]) : def;
}
const screws = (x, y, n, gap) => Array.from({ length: n }, (_, i) => `<g transform="translate(${x + i * gap} ${y})"><circle r="5.2" fill="#c9ced3" stroke="#6b737b"/><path d="M-3.4 0H3.4M0 -3.4V3.4" stroke="#55606a" stroke-width="1.3"/></g>`).join('');

/* מחזיר SVG מלא לרכיב */
export function partSvg(c) {
  const mk = c.maker || '', acc = ACCENT(mk), brand = BRAND(mk), pn = String(c.partNo || '').split(/\s[+(]/)[0].replace(/^\d+×\s*/, '').slice(0, 22), r = rating(c);
  const W = 240, H = 240;
  let body = '';
  const label = (y) => `<text x="${W / 2}" y="${y}" text-anchor="middle" class="pa-brand">${esc(brand)}</text>`;
  switch (c.type) {
    case 'mcb': case 'rcd': {
      const n = Math.min(4, poleCount(c, c.type === 'rcd' ? 4 : 1)), mw = 36, x0 = (W - n * mw) / 2;
      for (let i = 0; i < n; i++) {
        const x = x0 + i * mw;
        body += `<rect x="${x}" y="28" width="${mw}" height="180" rx="3" fill="#f6f6f3" stroke="#9aa0a6"/>${screws(x + mw / 2, 44, 1, 0)}${screws(x + mw / 2, 192, 1, 0)}
          <rect x="${x + 5}" y="62" width="${mw - 10}" height="34" rx="2" fill="#e9eae7" stroke="#b7bcc1"/><text x="${x + mw / 2}" y="83" text-anchor="middle" class="pa-r">${esc(c.type === 'rcd' && i === n - 1 ? '30mA' : r || 'C16')}</text>
          <rect x="${x + 10}" y="106" width="${mw - 20}" height="44" rx="3" fill="#2b3035"/><rect x="${x + 12}" y="108" width="${mw - 24}" height="18" rx="2" fill="#4a5158"/>
          <rect x="${x + 6}" y="156" width="${mw - 12}" height="6" rx="2" fill="${i === 0 ? acc : '#d4d7da'}"/>`;
      }
      if (c.type === 'rcd') body += `<circle cx="${x0 + n * mw - 18}" cy="176" r="7" fill="#f2c21b" stroke="#8a6d00"/><text x="${x0 + n * mw - 18}" y="179" text-anchor="middle" class="pa-s">T</text>`;
      body += `<rect x="${x0 - 4}" y="210" width="${n * mw + 8}" height="8" rx="2" fill="#9aa0a6"/>` + label(22);
      break;
    }
    case 'main_switch':
      body = `<rect x="60" y="30" width="120" height="170" rx="6" fill="#d9dcdf" stroke="#8d959f"/>${screws(80, 46, 3, 40)}${screws(80, 184, 3, 40)}
        <rect x="78" y="72" width="84" height="84" rx="6" fill="#f2c21b" stroke="#8a6d00"/><circle cx="120" cy="114" r="30" fill="#d81f26" stroke="#7a0d10" stroke-width="2"/><rect x="113" y="80" width="14" height="62" rx="5" fill="#b3141b"/>
        <text x="94" y="152" class="pa-s">0</text><text x="141" y="90" class="pa-s">I</text>${label(22)}<text x="120" y="216" text-anchor="middle" class="pa-r">${esc(r || '')}</text>`;
      break;
    case 'contactor': case 'overload': case 'mpcb': {
      const top = c.type === 'overload' ? 70 : 30;
      body = `<rect x="70" y="${top}" width="100" height="${210 - top}" rx="5" fill="${c.type === 'mpcb' ? '#3a3f45' : '#c9cdd1'}" stroke="#6b737b"/>${screws(88, top + 16, 3, 32)}${screws(88, 194, 3, 32)}`;
      if (c.type === 'contactor') body += `<rect x="82" y="68" width="76" height="24" rx="3" fill="#e8eaec" stroke="#9aa0a6"/><text x="120" y="85" text-anchor="middle" class="pa-s">A1 · A2</text><rect x="92" y="104" width="56" height="54" rx="4" fill="#5b636b"/><rect x="104" y="116" width="32" height="30" rx="3" fill="#9aa3ab"/><rect x="82" y="166" width="76" height="12" rx="2" fill="${acc}"/>`;
      if (c.type === 'mpcb') body += `<circle cx="120" cy="116" r="30" fill="#1c1f22" stroke="#5b636b" stroke-width="3"/><rect x="114" y="88" width="12" height="40" rx="4" fill="${acc}"/><circle cx="120" cy="164" r="12" fill="#e8eaec"/><text x="120" y="168" text-anchor="middle" class="pa-s" fill="#1c2126">${esc(r)}</text>`;
      if (c.type === 'overload') body += `<circle cx="120" cy="130" r="18" fill="#e8eaec" stroke="#6b737b"/><path d="M120 116v14l9 6" stroke="#2b3035" stroke-width="3" fill="none"/><rect x="146" y="158" width="16" height="16" rx="3" fill="#1f6fd1"/><text x="98" y="170" class="pa-s">${esc(r)}</text>`;
      body += label(c.type === 'overload' ? 62 : 22);
      break;
    }
    case 'psu':
      body = `<rect x="40" y="36" width="160" height="168" rx="5" fill="#b9c0c6" stroke="#6b737b"/>${Array.from({ length: 9 }, (_, i) => `<rect x="${52 + i * 16}" y="44" width="8" height="34" rx="2" fill="#8d959f"/>`).join('')}
        ${screws(64, 96, 5, 28)}<rect x="52" y="112" width="136" height="54" rx="3" fill="#dfe3e6"/><text x="120" y="134" text-anchor="middle" class="pa-r">24V DC</text><text x="120" y="154" text-anchor="middle" class="pa-s">${esc(r)}</text>
        <circle cx="70" cy="182" r="5" fill="#3ddc84"/><text x="80" y="186" class="pa-s">DC OK</text><circle cx="170" cy="182" r="6" fill="#e8eaec" stroke="#6b737b"/>${label(28)}`;
      break;
    case 'relay': case 'timer':
      body = `<rect x="70" y="120" width="100" height="90" rx="4" fill="#2b3035"/>${screws(88, 134, 3, 32)}${screws(88, 196, 3, 32)}
        <rect x="82" y="40" width="76" height="92" rx="5" fill="${c.type === 'timer' ? '#c9cdd1' : 'rgba(210,225,235,.75)'}" stroke="#6b737b"/>${c.type === 'timer' ? '<circle cx="120" cy="80" r="18" fill="#fff" stroke="#6b737b"/><path d="M120 66v14l8 5" stroke="#2b3035" stroke-width="3" fill="none"/>' : '<rect x="96" y="58" width="48" height="40" rx="4" fill="#c98a4b"/><rect x="100" y="104" width="40" height="8" fill="#9aa0a6"/>'}${label(30)}`;
      break;
    case 'terminal': {
      const n = 9, tw = 16, x0 = (W - n * tw) / 2;
      body = Array.from({ length: n }, (_, i) => { const pe = i === n - 1, blue = i === n - 2 && /N\b|אפס/.test(c.name || ''); return `<rect x="${x0 + i * tw}" y="40" width="${tw - 1}" height="160" rx="2" fill="${pe ? '#3aa655' : blue ? '#4da3ff' : '#c4cad1'}" stroke="#6b737b"/>${pe ? `<rect x="${x0 + i * tw}" y="40" width="${tw - 1}" height="160" fill="url(#pa-gy)" opacity=".9"/>` : ''}<circle cx="${x0 + i * tw + tw / 2 - .5}" cy="62" r="4.5" fill="#e8eaec" stroke="#55606a"/><circle cx="${x0 + i * tw + tw / 2 - .5}" cy="178" r="4.5" fill="#e8eaec" stroke="#55606a"/><rect x="${x0 + i * tw + 2}" y="110" width="${tw - 5}" height="18" fill="#fff"/><text x="${x0 + i * tw + tw / 2 - .5}" y="123" text-anchor="middle" class="pa-t">${i + 1}</text>`; }).join('')
        + `<rect x="${x0 - 8}" y="200" width="${n * tw + 16}" height="10" fill="#9aa0a6"/>${label(28)}`;
      break;
    }
    case 'button': case 'lamp': case 'selector': case 'estop': {
      const col = /ירוק|green|הפעלה/i.test(c.name + c.desc) ? '#2f9e44' : /אדום|red|עצירה|תקלה/i.test(c.name + c.desc) ? '#d62828' : /צהוב|yellow|amber/i.test(c.name + c.desc) ? '#f2c21b' : /כחול|blue/i.test(c.name + c.desc) ? '#1f6fd1' : '#e8eaec';
      if (c.type === 'estop') body = `<circle cx="120" cy="120" r="80" fill="#f2c21b" stroke="#8a6d00"/><text x="120" y="60" text-anchor="middle" class="pa-s">EMERGENCY STOP</text><circle cx="120" cy="124" r="50" fill="#c4161c" stroke="#7a0d10" stroke-width="3"/><ellipse cx="108" cy="108" rx="18" ry="10" fill="rgba(255,255,255,.35)"/>`;
      else if (c.type === 'lamp') body = `<circle cx="120" cy="120" r="62" fill="#2b3035"/><circle cx="120" cy="120" r="46" fill="${col}" opacity=".95"/><circle cx="120" cy="120" r="46" fill="url(#pa-glow)"/>`;
      else if (c.type === 'selector') body = `<circle cx="120" cy="120" r="62" fill="#2b3035"/><circle cx="120" cy="120" r="46" fill="#1c1f22"/><rect x="112" y="78" width="16" height="84" rx="6" fill="#e8eaec"/><text x="70" y="70" class="pa-s">0</text><text x="162" y="70" class="pa-s">I</text>`;
      else body = `<circle cx="120" cy="120" r="62" fill="#c0c6cc" stroke="#6b737b"/><circle cx="120" cy="120" r="46" fill="${col}" stroke="rgba(0,0,0,.3)"/><ellipse cx="108" cy="106" rx="16" ry="8" fill="rgba(255,255,255,.35)"/>`;
      body += `<text x="120" y="226" text-anchor="middle" class="pa-brand">${esc(brand)}</text>`;
      break;
    }
    default:
      body = `<rect x="56" y="34" width="128" height="172" rx="6" fill="#4a5158" stroke="#2b3035"/>${screws(76, 50, 4, 29)}${screws(76, 190, 4, 29)}
        <rect x="68" y="70" width="104" height="70" rx="4" fill="#2b3035"/>${Array.from({ length: 8 }, (_, i) => `<circle cx="${80 + (i % 4) * 26}" cy="${88 + Math.floor(i / 4) * 30}" r="5" fill="${i % 3 ? '#3ddc84' : '#ffc93c'}"/>`).join('')}
        <rect x="68" y="150" width="104" height="22" rx="3" fill="#e8eaec"/><text x="120" y="166" text-anchor="middle" class="pa-s" fill="#1c2126">${esc(pn || c.tag)}</text>${label(26)}`;
  }
  return `<svg class="part-art" viewBox="0 0 ${W} ${H}" role="img" aria-label="ציור של ${esc(c.name || c.type)}${mk ? ' · ' + esc(mk) : ''}">
    <defs><pattern id="pa-gy" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#3aa655"/><rect width="4" height="8" fill="#f2c21b"/></pattern>
      <radialGradient id="pa-glow"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
    <style>.pa-brand{font:700 13px Arial,sans-serif;fill:#3b434b;letter-spacing:.04em}.pa-r{font:700 12px 'IBM Plex Mono',monospace;fill:#1c2126}.pa-s{font:600 10px Arial,sans-serif;fill:#3b434b}.pa-t{font:600 8px 'IBM Plex Mono',monospace;fill:#1c2126}</style>
    ${body}</svg>`;
}
