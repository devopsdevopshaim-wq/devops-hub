// איורים מקוריים של רגעים (SVG בקוד): תמונה לכל קטגוריה, לכפתורי הקטגוריות ולמוצרים בלי תמונה.
// צבעי המותג: שזיף, קטיפה, ורוד, זהב. כל איור מקבל מזהים ייחודיים כדי שכמה איורים יחיו באותו דף.
/* exported ART */
const ART = (() => {
  let n = 0;
  const C = { night: '#24112F', velvet: '#8E2463', rose: '#E0719A', blush: '#FBF3F2', mist: '#F3E4EA', gold: '#E2B659', goldD: '#B98A2E', wood: '#C8935A', woodD: '#9A6534', ink: '#3B1D33' };

  // תמונה קטנה בתוך מגנט/מסגרת: שמש, גבעות ולב - "רגע" מהאירוע
  function photo(x, y, w, h, id, hue = 0) {
    const sky = ['#F7C6D6', '#F9D9A8', '#D9C6F2'][hue % 3];
    return `<g><clipPath id="${id}c"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/></clipPath>
      <g clip-path="url(#${id}c)">
        <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${sky}"/>
        <circle cx="${x + w * 0.72}" cy="${y + h * 0.34}" r="${h * 0.16}" fill="#FFF3D6"/>
        <path d="M${x} ${y + h * 0.78} Q${x + w * 0.3} ${y + h * 0.5} ${x + w * 0.58} ${y + h * 0.72} T${x + w} ${y + h * 0.6} V${y + h} H${x}Z" fill="${C.velvet}" opacity=".85"/>
        <path d="M${x} ${y + h * 0.9} Q${x + w * 0.45} ${y + h * 0.68} ${x + w} ${y + h * 0.86} V${y + h} H${x}Z" fill="${C.night}" opacity=".9"/>
        <path transform="translate(${x + w * 0.3} ${y + h * 0.42}) scale(${h / 120})" d="M0 10 C-8 4 -14 -2 -14 -9 C-14 -14 -10 -17 -6 -17 C-3 -17 -1 -15 0 -13 C1 -15 3 -17 6 -17 C10 -17 14 -14 14 -9 C14 -2 8 4 0 10Z" fill="#fff"/>
      </g></g>`;
  }

  const shadow = (id) => `<filter id="${id}s" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="${C.night}" flood-opacity=".28"/></filter>`;
  const goldGrad = (id) => `<linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF0C2"/><stop offset=".5" stop-color="${C.gold}"/><stop offset="1" stop-color="${C.goldD}"/></linearGradient>`;
  const bg = (id, a, b) => `<linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><rect width="320" height="240" fill="url(#${id}b)"/>`;
  const sparkle = (x, y, r, id) => `<path d="M${x} ${y - r} Q${x + r * .2} ${y - r * .2} ${x + r} ${y} Q${x + r * .2} ${y + r * .2} ${x} ${y + r} Q${x - r * .2} ${y + r * .2} ${x - r} ${y} Q${x - r * .2} ${y - r * .2} ${x} ${y - r}Z" fill="url(#${id}g)"/>`;

  const scenes = {
    // מגנטים: שלוש תמונות-מגנט על דלת מקרר
    magnets: (id) => `${bg(id, '#F6E7EE', '#EBD3DF')}
      <g filter="url(#${id}s)">
        <g transform="rotate(-8 92 128)"><rect x="40" y="70" width="104" height="120" rx="6" fill="#fff"/>${photo(48, 78, 88, 88, id + 'a', 0)}<circle cx="92" cy="74" r="7" fill="url(#${id}g)"/></g>
        <g transform="rotate(5 226 116)"><rect x="176" y="56" width="100" height="116" rx="6" fill="#fff"/>${photo(184, 64, 84, 84, id + 'b', 1)}<circle cx="226" cy="60" r="7" fill="url(#${id}g)"/></g>
        <g transform="rotate(-2 160 170)"><rect x="118" y="118" width="88" height="100" rx="6" fill="#fff"/>${photo(125, 125, 74, 72, id + 'c', 2)}<circle cx="162" cy="122" r="6" fill="url(#${id}g)"/></g>
      </g>${sparkle(286, 40, 12, id)}${sparkle(36, 44, 8, id)}`,

    // בלוקים: בלוק עץ עבה עם תמונה
    blocks: (id) => `${bg(id, '#F4E6DA', '#E7CDB8')}
      <linearGradient id="${id}w" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.wood}"/><stop offset="1" stop-color="${C.woodD}"/></linearGradient>
      <ellipse cx="160" cy="212" rx="110" ry="12" fill="${C.night}" opacity=".15"/>
      <g filter="url(#${id}s)">
        <path d="M84 52 L106 34 L254 34 L232 52 Z" fill="#E6BB88"/>
        <path d="M110 40 Q170 36 246 40" stroke="#b07a44" stroke-opacity=".35" fill="none"/>
        <path d="M232 52 L254 34 L254 172 L232 190 Z" fill="url(#${id}w)"/>
        <path d="M240 50 Q246 110 240 180 M247 44 Q252 104 247 172" stroke="#6e4422" stroke-opacity=".35" fill="none"/>
        <rect x="84" y="52" width="148" height="138" fill="#F7EFE6"/>
        ${photo(92, 60, 132, 122, id + 'p', 1)}
      </g>${sparkle(276, 40, 10, id)}`,

    // מסגרות קרטון: מסגרת מעוטרת עם פספרטו
    frames: (id) => `${bg(id, '#F3E4EA', '#E5CCD9')}
      <g filter="url(#${id}s)" transform="rotate(-3 160 124)">
        <rect x="74" y="28" width="172" height="196" rx="4" fill="url(#${id}g)"/>
        <rect x="84" y="38" width="152" height="176" fill="#FDF8F2"/>
        <rect x="98" y="52" width="124" height="128" fill="#fff" stroke="${C.goldD}" stroke-opacity=".4"/>
        ${photo(104, 58, 112, 116, id + 'p', 0)}
        <path d="M120 196 h80" stroke="${C.velvet}" stroke-width="3" stroke-linecap="round" opacity=".6"/>
      </g>${sparkle(270, 48, 11, id)}${sparkle(52, 196, 8, id)}`,

    // תמונה בעיצוב מיוחד: קנבס על כן ציור עם משיכות מכחול
    'designed-photos': (id) => `${bg(id, '#2C1438', '#5A1E4C')}
      <circle cx="250" cy="50" r="70" fill="${C.rose}" opacity=".18"/>
      <path d="M118 214 L160 60 L202 214" stroke="${C.wood}" stroke-width="7" fill="none" stroke-linecap="round"/>
      <g filter="url(#${id}s)"><rect x="96" y="40" width="128" height="128" rx="3" fill="#fff"/>
        <rect x="104" y="48" width="112" height="112" fill="#FDE9F0"/>
        <path d="M104 132 C130 90 150 150 176 104 S210 96 216 88 V160 H104Z" fill="${C.velvet}"/>
        <path d="M116 80 C140 60 170 74 196 62" stroke="${C.gold}" stroke-width="9" fill="none" stroke-linecap="round"/>
        <circle cx="140" cy="104" r="12" fill="${C.rose}"/><circle cx="186" cy="128" r="8" fill="${C.gold}"/></g>
      ${sparkle(260, 170, 12, id)}${sparkle(62, 70, 9, id)}`,

    // חבילות לאירועים: קופסת מתנה גדולה עם סרט זהב
    packages: (id) => `${bg(id, '#F6E3EA', '#E9C7D6')}
      <ellipse cx="160" cy="214" rx="96" ry="10" fill="${C.night}" opacity=".15"/>
      <g filter="url(#${id}s)">
        <rect x="88" y="104" width="144" height="104" rx="6" fill="${C.velvet}"/>
        <rect x="80" y="86" width="160" height="30" rx="6" fill="#A6306F"/>
        <rect x="150" y="86" width="20" height="122" fill="url(#${id}g)"/>
        <path d="M160 86 C130 40 98 62 124 84 Z M160 86 C190 40 222 62 196 84 Z" fill="url(#${id}g)"/>
        <circle cx="160" cy="86" r="9" fill="${C.goldD}"/>
      </g>${sparkle(256, 60, 13, id)}${sparkle(66, 120, 9, id)}${sparkle(250, 180, 7, id)}`,

    // מתנות: ספל עם תמונה וליבים
    gifts: (id) => `${bg(id, '#FBEFF3', '#EED7E0')}
      <ellipse cx="150" cy="208" rx="80" ry="9" fill="${C.night}" opacity=".15"/>
      <g filter="url(#${id}s)">
        <path d="M216 104 c34 0 34 60 0 60" stroke="#fff" stroke-width="14" fill="none"/>
        <rect x="90" y="70" width="130" height="138" rx="14" fill="#fff"/>
        ${photo(106, 92, 98, 84, id + 'p', 2)}
      </g>
      <path transform="translate(250 70) scale(1.4)" d="M0 10 C-8 4 -14 -2 -14 -9 C-14 -14 -10 -17 -6 -17 C-3 -17 -1 -15 0 -13 C1 -15 3 -17 6 -17 C10 -17 14 -14 14 -9 C14 -2 8 4 0 10Z" fill="${C.rose}"/>
      <path transform="translate(60 92)" d="M0 10 C-8 4 -14 -2 -14 -9 C-14 -14 -10 -17 -6 -17 C-3 -17 -1 -15 0 -13 C1 -15 3 -17 6 -17 C10 -17 14 -14 14 -9 C14 -2 8 4 0 10Z" fill="${C.velvet}" opacity=".7"/>`,

    // מתוקים: קופסת פרלינים פתוחה
    sweets: (id) => `${bg(id, '#F5E6DC', '#E8CDBB')}
      <g filter="url(#${id}s)" transform="rotate(-4 160 130)">
        <rect x="60" y="62" width="200" height="140" rx="10" fill="${C.night}"/>
        <rect x="72" y="74" width="176" height="116" rx="6" fill="#3E1D3C"/>
        ${[0, 1, 2, 3].map((c) => [0, 1].map((r) => {
          const x = 98 + c * 42; const y = 104 + r * 54; const k = (c + r) % 3;
          return `<circle cx="${x}" cy="${y}" r="17" fill="${['#6B3A22', C.velvet, '#8A5A34'][k]}"/><path d="M${x - 9} ${y - 4} q9 -8 18 0" stroke="${k === 1 ? C.gold : '#F3D9B5'}" stroke-width="3" fill="none"/>`;
        }).join('')).join('')}
        <rect x="60" y="54" width="200" height="14" rx="5" fill="url(#${id}g)"/>
      </g>${sparkle(280, 46, 11, id)}`,

    // פרחים: זר בעטיפה
    flowers: (id) => `${bg(id, '#F4F0E6', '#E5E9D6')}
      <g filter="url(#${id}s)">
        <path d="M118 120 L160 220 L202 120 Z" fill="#F6E2D0"/><path d="M128 120 L160 210 L192 120" fill="#EDD2BC"/>
        <path d="M152 196 h16" stroke="url(#${id}g)" stroke-width="10" stroke-linecap="round"/>
        ${[[130, 100, C.rose], [160, 84, C.velvet], [192, 102, '#F2A7C0'], [146, 124, '#F7C6D6'], [178, 124, C.rose], [160, 112, '#FFF3D6']].map(([x, y, col]) => `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map((a) => `<ellipse rx="9" ry="15" transform="rotate(${a}) translate(0 -10)" fill="${col}"/>`).join('')}<circle r="6" fill="${C.gold}"/></g>`).join('')}
        <path d="M112 112 q-20 -24 -2 -40 q8 22 2 40Z M208 112 q20 -24 2 -40 q-8 22 -2 40Z" fill="#7FA36B"/>
      </g>${sparkle(262, 52, 10, id)}`,

    // עיצוב ודקורציה: קשת בלונים
    decor: (id) => `${bg(id, '#2A1236', '#4C1A45')}
      ${[...Array(13)].map((_, i) => {
        const a = Math.PI * (i / 12); const x = 160 - Math.cos(a) * 112; const y = 210 - Math.sin(a) * 150;
        const col = [C.rose, C.gold, '#fff', C.velvet][i % 4];
        return `<ellipse cx="${x}" cy="${y}" rx="${20 + (i % 3) * 3}" ry="${24 + (i % 3) * 3}" fill="${col}" opacity="${col === '#fff' ? .9 : 1}"/><ellipse cx="${x - 6}" cy="${y - 8}" rx="5" ry="7" fill="#fff" opacity=".35"/>`;
      }).join('')}
      ${sparkle(160, 120, 16, id)}${sparkle(120, 160, 8, id)}${sparkle(204, 150, 9, id)}`,
  };
  scenes.default = scenes.packages;

  return {
    // ART.svg('magnets') -> מחרוזת SVG
    svg(key) {
      const id = `art${++n}`;
      const fn = scenes[key] || scenes.default;
      return `<svg viewBox="0 0 320 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid slice"><defs>${shadow(id)}${goldGrad(id)}</defs>${fn(id)}</svg>`;
    },
    // סוג הדפסה באירוע -> קטגוריה
    forPrint: (type) => ({ magnet: 'magnets', block: 'blocks', frame: 'frames' }[type] || 'magnets'),
    keys: Object.keys(scenes).filter((k) => k !== 'default'),
  };
})();
