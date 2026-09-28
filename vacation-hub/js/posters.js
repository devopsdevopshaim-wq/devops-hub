/* ===========================================================
   פוסטרי מסע — איורי SVG בסגנון כרזות תיירות וינטג׳
   כל יעד מקבל פלטה ואייקון. עובד גם בלי אינטרנט.
   האייקונים מצוירים בקואורדינטות 0..100 (רוחב) × 0..160 (גובה, בסיס ב-160).
   =========================================================== */

window.Posters = (function () {

  const icons = {
    eiffel: (c) => `
      <polygon fill="${c}" points="50,0 53,38 58,86 70,126 92,160 72,160 58,138 50,134 42,138 28,160 8,160 30,126 42,86 47,38"/>
      <rect fill="${c}" x="36" y="84" width="28" height="5"/>
      <rect fill="${c}" x="26" y="122" width="48" height="6"/>`,

    bigben: (c, p) => `
      <rect fill="${c}" x="38" y="42" width="24" height="118"/>
      <polygon fill="${c}" points="36,44 50,4 64,44"/>
      <rect fill="${c}" x="35" y="40" width="30" height="6"/>
      <circle fill="${p}" cx="50" cy="60" r="8"/>
      <path d="M50 60 L50 55 M50 60 L54 60" stroke="${c}" stroke-width="1.6"/>
      <rect fill="${c}" x="-20" y="118" width="140" height="42"/>
      ${[-16, -4, 70, 82, 94, 106].map(x => `<polygon fill="${c}" points="${x},118 ${x + 3},104 ${x + 6},118"/>`).join('')}`,

    colosseum: (c, p) => {
      let s = `<path fill="${c}" d="M-10 160 L-10 78 Q50 62 110 70 L110 104 L96 100 L92 160 Z"/>`;
      for (let row = 0; row < 3; row++) {
        for (let i = 0; i < 8; i++) {
          const x = -4 + i * 13, y = 86 + row * 24;
          if (row === 0 && i > 6) continue;
          s += `<path fill="${p}" opacity=".55" d="M${x} ${y + 16} L${x} ${y + 6} Q${x + 4} ${y} ${x + 8} ${y + 6} L${x + 8} ${y + 16} Z"/>`;
        }
      }
      return s;
    },

    sagrada: (c) => {
      const spires = [[10, 40], [26, 18], [40, 4], [58, 10], [74, 26], [88, 46]];
      let s = `<rect fill="${c}" x="2" y="104" width="96" height="56"/>`;
      spires.forEach(([x, top]) => {
        s += `<polygon fill="${c}" points="${x - 6},110 ${x - 5},${top + 30} ${x},${top} ${x + 5},${top + 30} ${x + 6},110"/>`;
        s += `<circle fill="${c}" cx="${x}" cy="${top - 3}" r="3"/>`;
      });
      return s;
    },

    parthenon: (c, p) => {
      let s = `<path fill="${c}" d="M-30 160 Q50 112 130 160 Z"/>
        <polygon fill="${c}" points="2,82 50,60 98,82"/>
        <rect fill="${c}" x="2" y="82" width="96" height="8"/>
        <rect fill="${c}" x="0" y="124" width="100" height="6"/>`;
      for (let i = 0; i < 8; i++) s += `<rect fill="${c}" x="${6 + i * 12}" y="90" width="6" height="34"/>`;
      s += `<polygon fill="${p}" opacity=".35" points="20,80 50,67 80,80"/>`;
      return s;
    },

    castle: (c, p) => {
      let s = `<rect fill="${c}" x="-20" y="112" width="140" height="48"/>
        <rect fill="${c}" x="52" y="54" width="24" height="60"/>
        <polygon fill="${c}" points="52,56 58,14 64,56"/>
        <polygon fill="${c}" points="64,56 70,20 76,56"/>
        <rect fill="${c}" x="14" y="84" width="14" height="30"/>
        <polygon fill="${c}" points="12,86 21,62 30,86"/>`;
      for (let i = 0; i < 9; i++) s += `<rect fill="${p}" opacity=".5" x="${-14 + i * 15}" y="124" width="5" height="8"/>`;
      return s;
    },

    skyline: (c, p) => {
      const b = [[-20, 104, 16], [-2, 84, 14], [14, 118, 12], [60, 76, 14], [76, 100, 16], [94, 66, 14], [110, 110, 14]];
      let s = b.map(([x, y, w]) => `<rect fill="${c}" x="${x}" y="${y}" width="${w}" height="${160 - y}"/>`).join('');
      /* אמפייר סטייט */
      s += `<rect fill="${c}" x="28" y="60" width="30" height="100"/>
        <rect fill="${c}" x="33" y="40" width="20" height="22"/>
        <rect fill="${c}" x="38" y="24" width="10" height="18"/>
        <rect fill="${c}" x="42" y="2" width="2" height="24"/>`;
      for (let r = 0; r < 8; r++) for (let k = 0; k < 4; k++)
        s += `<rect fill="${p}" opacity=".45" x="${31 + k * 7}" y="${66 + r * 11}" width="3" height="5"/>`;
      return s;
    },

    burj: (c) => `
      <polygon fill="${c}" points="50,0 51.5,30 54,60 57,92 61,122 64,160 36,160 39,122 43,92 46,60 48.5,30"/>
      <rect fill="${c}" x="-16" y="128" width="26" height="32"/>
      <rect fill="${c}" x="10" y="112" width="16" height="48"/>
      <rect fill="${c}" x="74" y="118" width="18" height="42"/>
      <rect fill="${c}" x="92" y="132" width="26" height="28"/>`,

    temple: (c, p) => `
      <path fill="${c}" d="M36 160 L38 120 Q42 70 47 36 L50 0 L53 36 Q58 70 62 120 L64 160 Z"/>
      <rect fill="${p}" opacity=".45" x="41" y="96" width="18" height="3"/>
      <rect fill="${p}" opacity=".45" x="44" y="70" width="12" height="3"/>
      <path fill="${c}" d="M0 160 L4 132 Q12 120 16 96 L18 88 L20 96 Q24 120 32 132 L36 160 Z"/>
      <path fill="${c}" d="M64 160 L68 132 Q76 120 80 96 L82 88 L84 96 Q88 120 96 132 L100 160 Z"/>`,

    pagoda: (c, p) => {
      let s = '';
      for (let i = 0; i < 5; i++) {
        const y = 150 - i * 24, w = 46 - i * 6;
        s += `<rect fill="${c}" x="${50 - w / 2 + 6}" y="${y - 14}" width="${w - 12}" height="16"/>`;
        s += `<path fill="${c}" d="M${50 - w / 2 - 8} ${y - 12} Q50 ${y - 26} ${50 + w / 2 + 8} ${y - 12} L${50 + w / 2} ${y - 16} L${50 - w / 2} ${y - 16} Z"/>`;
      }
      s += `<rect fill="${c}" x="49" y="18" width="2" height="20"/>`;
      s += `<rect fill="${c}" x="20" y="150" width="60" height="10"/>`;
      return s;
    },

    palms: (c, p) => `
      <path d="M58 160 Q62 110 50 64" stroke="${c}" stroke-width="5" fill="none"/>
      <path fill="${c}" d="M50 64 Q30 52 10 66 Q30 58 50 66 Z"/>
      <path fill="${c}" d="M50 64 Q70 48 94 60 Q72 56 50 66 Z"/>
      <path fill="${c}" d="M50 64 Q40 40 20 36 Q42 46 50 66 Z"/>
      <path fill="${c}" d="M50 64 Q64 38 84 36 Q62 48 50 66 Z"/>
      <path fill="${c}" d="M50 64 Q34 72 26 92 Q38 74 50 66 Z"/>
      <path d="M86 160 Q88 132 80 110" stroke="${c}" stroke-width="3.5" fill="none"/>
      <path fill="${c}" d="M80 110 Q68 102 58 110 Q70 106 80 112 Z"/>
      <path fill="${c}" d="M80 110 Q92 100 104 106 Q92 106 80 112 Z"/>
      <path fill="${c}" d="M80 110 Q78 96 70 92 Q82 100 80 112 Z"/>`,

    walls: (c, p) => {
      let s = `<rect fill="${c}" x="-24" y="116" width="148" height="44"/>`;
      for (let i = 0; i < 15; i++) s += `<rect fill="${c}" x="${-24 + i * 10}" y="108" width="6" height="9"/>`;
      s += `<rect fill="${c}" x="64" y="52" width="22" height="66"/>
        <rect fill="${c}" x="61" y="50" width="28" height="5"/>
        <path fill="${c}" d="M68 50 Q75 36 82 50 Z"/>
        <rect fill="${c}" x="74" y="28" width="2" height="10"/>
        <rect fill="${c}" x="10" y="92" width="36" height="18"/>
        <path fill="${p}" d="M12 92 Q28 60 44 92 Z"/>
        <rect fill="${c}" x="27" y="62" width="2" height="8"/>`;
      return s;
    },

    'city-sea': (c, p) => {
      const b = [[-20, 116, 14], [-4, 104, 12], [10, 96, 10], [60, 110, 12], [88, 112, 14], [104, 100, 12]];
      let s = b.map(([x, y, w]) => `<rect fill="${c}" x="${x}" y="${y}" width="${w}" height="${150 - y}"/>`).join('');
      s += `<rect fill="${c}" x="24" y="36" width="12" height="114"/>
        <polygon fill="${c}" points="38,150 38,48 50,40 50,150"/>
        <rect fill="${c}" x="52" y="54" width="10" height="96"/>`;
      s += `<rect fill="${c}" x="-30" y="148" width="160" height="12"/>`;
      return s;
    },

    'hills-lake': (c, p) => `
      <path fill="${c}" d="M20 160 L22 96 Q26 70 28 60 Q30 70 34 96 L36 160 Z"/>
      <path fill="${c}" d="M40 160 L42 110 Q45 88 46 80 Q48 88 51 110 L52 160 Z"/>
      <path fill="${c}" d="M74 160 L75 118 Q78 100 79 92 Q81 100 83 118 L84 160 Z"/>
      <path d="M-30 160 Q20 144 60 150 Q100 156 130 142 L130 160 Z" fill="${c}"/>`
  };

  /* נושאים שבהם יש ים / אגם ברקע */
  const water = { palms: 1, 'city-sea': 1, 'hills-lake': 1, burj: 0 };

  function svg(dest, opts) {
    const o = Object.assign({ w: 300, h: 400, label: false }, opts || {});
    const p = dest.poster, W = o.w, H = o.h;
    const uid = dest.id + '-' + W + 'x' + H;
    const horizon = H * 0.66;
    const sunR = Math.min(W, H) * 0.2;
    const sunX = W * (W > H ? 0.26 : 0.3), sunY = H * 0.34;
    const scale = (H * 0.58) / 160;
    const iconX = W > H ? W * 0.62 : W * 0.5;
    const tx = iconX - 50 * scale, ty = H * 0.92 - 160 * scale;

    /* פסי שמש בסגנון רטרו */
    let stripes = '';
    for (let i = 0; i < 4; i++) {
      const y = sunY + sunR * (0.15 + i * 0.22);
      stripes += `<rect x="${sunX - sunR}" y="${y}" width="${sunR * 2}" height="${2 + i * 1.6}" fill="url(#sky-${uid})"/>`;
    }

    const fuji = p.icon === 'pagoda'
      ? `<polygon fill="${p.far}" points="${W * 0.02},${horizon + 10} ${W * 0.3},${H * 0.36} ${W * 0.36},${H * 0.36} ${W * 0.7},${horizon + 10}"/>
         <polygon fill="#FFFFFF" opacity=".85" points="${W * 0.24},${H * 0.43} ${W * 0.3},${H * 0.36} ${W * 0.36},${H * 0.36} ${W * 0.42},${H * 0.43} ${W * 0.37},${H * 0.41} ${W * 0.33},${H * 0.44} ${W * 0.29},${H * 0.41}"/>`
      : '';

    const far = `<path fill="${p.far}" d="M0 ${horizon} Q${W * 0.18} ${horizon - H * 0.1} ${W * 0.38} ${horizon - H * 0.03} T${W * 0.72} ${horizon - H * 0.06} T${W} ${horizon - H * 0.02} L${W} ${H} L0 ${H} Z"/>`;

    const sea = water[p.icon]
      ? `<rect x="0" y="${H * 0.8}" width="${W}" height="${H * 0.2}" fill="${p.land}" opacity=".85"/>
         ${[0, 1, 2].map(i => `<path d="M${W * 0.05} ${H * (0.84 + i * 0.045)} q${W * 0.06} -6 ${W * 0.12} 0 t${W * 0.12} 0 t${W * 0.12} 0 t${W * 0.12} 0 t${W * 0.12} 0 t${W * 0.12} 0 t${W * 0.12} 0" stroke="${p.sun}" stroke-opacity=".5" stroke-width="1.4" fill="none"/>`).join('')}`
      : `<path fill="${p.land}" d="M0 ${H * 0.9} Q${W * 0.3} ${H * 0.84} ${W * 0.6} ${H * 0.88} T${W} ${H * 0.86} L${W} ${H} L0 ${H} Z"/>`;

    const icon = (icons[p.icon] || icons.skyline)(p.ink, p.sun);

    return `<svg class="poster-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="איור של ${dest.name}">
      <defs>
        <linearGradient id="sky-${uid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${p.sky[0]}"/><stop offset="1" stop-color="${p.sky[1]}"/>
        </linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#sky-${uid})"/>
      <circle cx="${sunX}" cy="${sunY}" r="${sunR}" fill="${p.sun}"/>
      ${stripes}
      ${fuji}
      ${far}
      <g transform="translate(${tx} ${ty}) scale(${scale})">${icon}</g>
      ${sea}
    </svg>`;
  }

  return { svg };
})();
