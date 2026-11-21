/* שכבות — artwork (SVG drawn in code) and game data: rarities, eras, finds, items, sites. */
(function () {
  'use strict';

  /* ---------- SVG helpers ---------- */
  const svg = (w, h, body) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;
  const stops = (s) => s.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('');
  const lg = (id, s, x1 = 0, y1 = 0, x2 = 1, y2 = 1) =>
    `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops(s)}</linearGradient>`;
  const rg = (id, s, cx = '35%', cy = '30%', r = '75%') =>
    `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops(s)}</radialGradient>`;
  // earthy grain clipped to the shape it is applied to
  const noise = (id, seed = 2, op = 0.35, freq = 0.9) =>
    `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" seed="${seed}"/>` +
    `<feColorMatrix values="0 0 0 0 .22 0 0 0 0 .16 0 0 0 0 .09 0 0 0 ${op * 2.4} -${op * 0.6}"/><feComposite in2="SourceGraphic" operator="in"/></filter>`;
  const shadow = (id) =>
    `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity=".45"/></filter>`;

  // a shape drawn once with its fill, once more with grain on top
  const worn = (id, shape, fill, extra = '') =>
    `<g filter="url(#${id}s)">${shape.replace('/>', ` fill="${fill}" ${extra}/>`)}</g><g filter="url(#${id}n)" opacity=".9">${shape.replace('/>', ' fill="#000"/>')}</g>`;

  const METAL = {
    gold: ['#fff4b8', '#f2c14e', '#a8741a'],
    silver: ['#ffffff', '#c9ccd2', '#6d727c'],
    bronze: ['#f6d2a4', '#b9773d', '#5a3417'],
    copper: ['#ffd3b0', '#c46a3a', '#6b2c12'],
  };

  /* ---------- the artworks ---------- */
  const A = {};

  A.coin = (id, metal, mark, seed = 3) => {
    const [a, b, c] = METAL[metal];
    return svg(100, 100,
      `<defs>${rg(id + 'g', [[0, a], [0.55, b], [1, c]])}${noise(id + 'n', seed, 0.28)}${shadow(id + 's')}</defs>` +
      worn(id, `<path d="M50 11 C73 10 90 28 89 51 C88 74 71 90 49 89 C27 88 10 72 11 49 C12 27 29 12 50 11Z"/>`, `url(#${id}g)`, `stroke="${c}" stroke-width="3"`) +
      `<circle cx="50" cy="50" r="31" fill="none" stroke="${c}" stroke-opacity=".55" stroke-width="2" stroke-dasharray="2 3.4"/>` +
      `<g fill="${c}" fill-opacity=".72" stroke="${c}" stroke-opacity=".5">${mark}</g>` +
      `<ellipse cx="38" cy="30" rx="14" ry="6" fill="#fff" opacity=".35" transform="rotate(-30 38 30)"/>`);
  };
  const MARK = {
    bust: `<path d="M38 74 C35 66 37 60 41 57 C37 53 36 47 39 43 C40 34 48 28 56 30 C63 31 66 38 64 44 L68 48 L64 50 C65 54 63 57 60 58 L60 64 C66 66 68 70 68 74 Z" stroke="none"/><path d="M41 36 C46 31 54 29 60 32" fill="none" stroke-width="3"/>`,
    chalice: `<path d="M37 30 h26 c0 15 -7 23 -11 25 v9 c5 1 9 3 9 7 h-22 c0 -4 4 -6 9 -7 v-9 c-4 -2 -11 -10 -11 -25z" stroke="none"/><circle cx="44" cy="27" r="2.4" stroke="none"/><circle cx="50" cy="26" r="2.4" stroke="none"/><circle cx="56" cy="27" r="2.4" stroke="none"/>`,
    cross: `<path d="M46 28 h8 v18 h18 v8 h-18 v18 h-8 v-18 h-18 v-8 h18z" stroke="none"/><circle cx="35" cy="35" r="2.5"/><circle cx="65" cy="35" r="2.5"/><circle cx="35" cy="65" r="2.5"/><circle cx="65" cy="65" r="2.5"/>`,
    tughra: `<path d="M30 64 C38 60 46 62 54 58 M36 66 C44 44 52 30 50 26 M46 66 C50 46 56 34 56 28 M54 64 C58 50 62 40 62 34 M30 64 C24 54 34 48 40 54 C46 60 66 58 72 48 C76 40 66 38 64 46" fill="none" stroke-width="3.2" stroke-opacity=".8" stroke-linecap="round"/>`,
    star: `<path d="M50 28 L56 44 L73 44 L59 54 L64 71 L50 61 L36 71 L41 54 L27 44 L44 44Z" stroke="none"/>`,
  };

  A.pipe = (id) => svg(200, 100,
    `<defs>${lg(id + 'g', [[0, '#e48a5c'], [0.5, '#b4532a'], [1, '#6f2a12']], 0, 0, 0, 1)}${noise(id + 'n', 5)}${shadow(id + 's')}</defs>` +
    worn(id, `<path d="M18 22 C16 14 24 8 36 8 C50 8 58 14 56 22 L54 52 C54 60 60 64 70 64 L172 58 C180 58 186 62 186 68 L186 78 C186 84 180 88 172 88 L66 90 C42 90 26 80 22 62 Z"/>`, `url(#${id}g)`) +
    `<ellipse cx="37" cy="18" rx="15" ry="6" fill="#3a160a"/>` +
    `<g fill="#f6c29a" opacity=".55">${[0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${80 + i * 16}" cy="76" r="2.6"/>`).join('')}</g>` +
    `<path d="M24 36 C28 52 34 62 46 70" stroke="#ffd2b0" stroke-opacity=".45" stroke-width="3" fill="none"/>` +
    `<path d="M162 60 v26" stroke="#5a200c" stroke-width="2"/>`);

  A.horseshoe = (id) => svg(100, 100,
    `<defs>${lg(id + 'g', [[0, '#a9897a'], [0.5, '#6e4a36'], [1, '#3b241a']])}${noise(id + 'n', 7, 0.5)}${shadow(id + 's')}</defs>` +
    worn(id, `<path d="M22 88 L14 50 C12 24 30 10 50 10 C70 10 88 24 86 50 L78 88 L64 88 L70 52 C72 34 62 26 50 26 C38 26 28 34 30 52 L36 88 Z"/>`, `url(#${id}g)`) +
    `<g fill="#24140c">${[[22, 66], [19, 46], [26, 28], [78, 66], [81, 46], [74, 28]].map(([x, y]) => `<rect x="${x - 2.5}" y="${y - 4}" width="5" height="8" rx="1.5"/>`).join('')}</g>` +
    `<g fill="#b4592a" opacity=".55"><circle cx="30" cy="20" r="5"/><circle cx="82" cy="72" r="4"/><circle cx="17" cy="56" r="3.5"/></g>`);

  A.bracelet = (id) => svg(100, 100,
    `<defs>${lg(id + 'g', [[0, '#7fd3ff'], [0.45, '#1f6fd1'], [1, '#0b2f73']])}${shadow(id + 's')}</defs>` +
    `<g filter="url(#${id}s)"><circle cx="50" cy="50" r="33" fill="none" stroke="url(#${id}g)" stroke-width="15"/></g>` +
    `<circle cx="50" cy="50" r="33" fill="none" stroke="#ffe066" stroke-width="3.5" stroke-dasharray="7 9" opacity=".85"/>` +
    `<circle cx="50" cy="50" r="33" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="4 12" stroke-dashoffset="8" opacity=".7"/>` +
    `<path d="M26 32 C32 24 40 20 48 19" stroke="#fff" stroke-opacity=".6" stroke-width="4" fill="none" stroke-linecap="round"/>` +
    `<path d="M74 70 l6 6 M70 75 l3 7" stroke="#0b2f73" stroke-width="2"/>`);

  A.dallah = (id) => svg(200, 200,
    `<defs>${lg(id + 'g', [[0, '#ffd8a8'], [0.35, '#e08a45'], [0.75, '#a14d1f'], [1, '#5a2410']], 0, 0, 1, 0)}${noise(id + 'n', 9, 0.3)}${shadow(id + 's')}</defs>` +
    worn(id, `<path d="M72 60 C70 44 82 36 100 36 C118 36 130 44 128 60 L124 84 C150 100 158 140 150 168 C146 182 130 188 100 188 C70 188 54 182 50 168 C42 140 50 100 76 84 Z"/>`, `url(#${id}g)`) +
    `<path d="M66 118 C40 96 26 64 18 40 C30 46 36 50 40 52 C44 74 56 92 72 104" fill="url(#${id}g)" stroke="#6b2c12" stroke-width="2"/>` +
    `<path d="M134 80 C170 70 186 104 168 140 C160 154 150 160 144 162" stroke="#7a3514" stroke-width="9" fill="none" stroke-linecap="round"/>` +
    `<path d="M100 36 C96 26 98 16 100 10 C102 16 104 26 100 36Z" fill="#c46a3a" stroke="#6b2c12"/>` +
    `<path d="M62 136 H138 M58 150 H142" stroke="#5a2410" stroke-opacity=".5" stroke-width="3"/>` +
    `<g fill="#ffe7c2" opacity=".5">${[0, 1, 2, 3, 4].map((i) => `<circle cx="${72 + i * 14}" cy="143" r="3"/>`).join('')}</g>` +
    `<path d="M84 96 C80 120 80 150 86 176" stroke="#fff" stroke-opacity=".35" stroke-width="6" fill="none" stroke-linecap="round"/>`);

  A.arrow = (id) => svg(100, 200,
    `<defs>${lg(id + 'g', [[0, '#8d7a72'], [0.5, '#4d3a33'], [1, '#2a1b16']], 0, 0, 1, 0)}${noise(id + 'n', 11, 0.55)}${shadow(id + 's')}</defs>` +
    worn(id, `<path d="M50 10 L62 70 L58 120 L60 184 C60 190 40 190 40 184 L42 120 L38 70 Z"/>`, `url(#${id}g)`) +
    `<path d="M50 14 L50 116" stroke="#b9a59a" stroke-opacity=".45" stroke-width="2"/>` +
    `<g fill="#a2491d" opacity=".6"><circle cx="56" cy="150" r="5"/><circle cx="45" cy="92" r="4"/><circle cx="52" cy="176" r="3.5"/></g>`);

  A.sword = (id) => svg(100, 400,
    `<defs>${lg(id + 'g', [[0, '#9aa0a6'], [0.45, '#5b5f63'], [0.55, '#3f4245'], [1, '#2a2b2d']], 0, 0, 1, 0)}${lg(id + 'h', [[0, '#7a4b2a'], [1, '#3a2010']], 0, 0, 1, 0)}${noise(id + 'n', 13, 0.6, 0.7)}${shadow(id + 's')}</defs>` +
    worn(id, `<path d="M38 118 L62 118 L60 360 L50 392 L40 360 Z"/>`, `url(#${id}g)`) +
    `<path d="M50 124 L50 366" stroke="#202224" stroke-width="5"/>` +
    worn(id, `<path d="M8 100 C8 94 92 94 92 100 L92 112 C92 118 8 118 8 112 Z"/>`, '#4b4d50') +
    `<rect x="42" y="34" width="16" height="64" rx="4" fill="url(#${id}h)"/>` +
    `<path d="M42 44 h16 M42 56 h16 M42 68 h16 M42 80 h16" stroke="#24140a" stroke-width="2.5"/>` +
    worn(id, `<circle cx="50" cy="24" r="14"/>`, '#5c5e61') +
    `<g fill="#9c4a20" opacity=".7"><circle cx="54" cy="160" r="7"/><circle cx="46" cy="240" r="9"/><circle cx="55" cy="300" r="6"/><circle cx="20" cy="104" r="5"/></g>`);

  A.wax = (id) => svg(100, 100,
    `<defs>${rg(id + 'g', [[0, '#ff7a6b'], [0.6, '#b3241c'], [1, '#5e0d09']])}${noise(id + 'n', 15, 0.25)}${shadow(id + 's')}</defs>` +
    worn(id, `<path d="M50 8 C62 10 70 6 80 16 C92 26 86 36 92 48 C96 62 86 70 82 80 C74 92 62 90 50 94 C36 96 26 92 18 82 C8 72 12 60 8 48 C6 34 16 26 22 18 C30 8 40 8 50 8Z"/>`, `url(#${id}g)`) +
    `<circle cx="50" cy="51" r="30" fill="#7a120c" opacity=".45"/>` +
    `<circle cx="50" cy="51" r="30" fill="none" stroke="#ffb3a6" stroke-opacity=".45" stroke-width="1.5"/>` +
    `<path d="M33 60 C36 46 42 40 50 40 C58 40 62 46 66 60 M50 40 V28 M44 32 h12 M38 60 h26 M40 60 l-4 10 M60 60 l4 10" stroke="#ffcfc6" stroke-opacity=".7" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
    `<ellipse cx="34" cy="26" rx="10" ry="5" fill="#fff" opacity=".35" transform="rotate(-25 34 26)"/>`);

  A.lamp = (id, body, deep, dots = true) => svg(200, 100,
    `<defs>${lg(id + 'g', [[0, body], [1, deep]], 0, 0, 0, 1)}${noise(id + 'n', 17)}${shadow(id + 's')}</defs>` +
    worn(id, `<path d="M30 60 C28 40 52 30 86 30 C112 30 132 36 150 46 L176 48 C188 50 190 66 178 70 L150 72 C130 84 110 88 86 88 C54 88 32 80 30 60Z"/>`, `url(#${id}g)`) +
    `<path d="M30 58 C16 56 10 46 16 38 C20 34 26 40 32 46" stroke="${deep}" stroke-width="7" fill="none" stroke-linecap="round"/>` +
    `<ellipse cx="86" cy="42" rx="20" ry="6" fill="#2a120a" opacity=".8"/>` +
    `<ellipse cx="174" cy="58" rx="6" ry="4" fill="#1a0a05"/>` +
    (dots ? `<g fill="#fff3d6" opacity=".45">${[0, 1, 2, 3, 4, 5, 6].map((i) => `<circle cx="${50 + i * 12}" cy="${62 + Math.sin(i) * 2}" r="2.6"/>`).join('')}</g>` : '') +
    `<path d="M48 38 C70 32 100 32 126 38" stroke="#fff" stroke-opacity=".35" stroke-width="3" fill="none"/>`);

  A.herodLamp = (id) => svg(100, 100,
    `<defs>${rg(id + 'g', [[0, '#e7b48a'], [0.7, '#a7643a'], [1, '#5a2e14']])}${noise(id + 'n', 19)}${shadow(id + 's')}</defs>` +
    worn(id, `<path d="M40 22 C58 20 70 32 70 46 L92 40 C98 38 98 56 92 56 L70 52 C68 68 56 78 40 78 C22 78 10 66 10 50 C10 34 22 22 40 22Z"/>`, `url(#${id}g)`) +
    `<circle cx="40" cy="50" r="11" fill="#3a1a0a"/><circle cx="40" cy="50" r="17" fill="none" stroke="#5a2e14" stroke-width="2"/>` +
    `<path d="M70 46 L92 44 M70 52 L92 52" stroke="#5a2e14" stroke-opacity=".6" stroke-width="1.5"/>` +
    `<circle cx="93" cy="48" r="3.2" fill="#1a0a05"/>`);

  A.amphora = (id, body, deep, ribs = false) => svg(100, 300,
    `<defs>${lg(id + 'g', [[0, deep], [0.35, body], [0.6, body], [1, deep]], 0, 0, 1, 0)}${noise(id + 'n', 21)}${shadow(id + 's')}</defs>` +
    worn(id, `<path d="M40 16 h20 v10 h-3 v44 C80 82 88 112 86 152 C84 202 66 242 55 272 L53 292 h-6 L45 272 C34 242 16 202 14 152 C12 112 20 82 43 70 v-44 h-3 z"/>`, `url(#${id}g)`) +
    `<path d="M43 36 C22 36 18 70 24 94 M57 36 C78 36 82 70 76 94" stroke="${deep}" stroke-width="7" fill="none" stroke-linecap="round"/>` +
    (ribs ? `<g stroke="${deep}" stroke-opacity=".45" stroke-width="2.4" fill="none">${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<path d="M${17 + i * 0.6} ${120 + i * 16} Q50 ${126 + i * 16} ${83 - i * 1.6} ${120 + i * 16}"/>`).join('')}</g>` : '') +
    `<path d="M30 110 C26 150 32 200 46 250" stroke="#fff" stroke-opacity=".28" stroke-width="7" fill="none" stroke-linecap="round"/>`);

  A.mosaic = (id) => {
    const N = 16, s = 200 / N;
    const cells = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const cx = x + 0.5, cy = y + 0.5;
      let c;
      const border = x < 1 || y < 1 || x >= N - 1 || y >= N - 1;
      const border2 = x === 1 || y === 1 || x === N - 2 || y === N - 2;
      const body = ((cx - 8) / 4.6) ** 2 + ((cy - 9) / 3) ** 2 < 1;
      const head = (cx - 11.6) ** 2 + (cy - 6.2) ** 2 < 2.4;
      const wing = ((cx - 7.2) / 3.2) ** 2 + ((cy - 8.2) / 1.8) ** 2 < 1;
      const tail = cx < 4.5 && cx > 1.8 && Math.abs(cy - 9 + (4.5 - cx) * 0.5) < 1.2;
      const leg = (Math.abs(cx - 7.5) < 0.6 || Math.abs(cx - 9.5) < 0.6) && cy > 11.5 && cy < 14;
      const beak = cx > 12.8 && cx < 14.6 && Math.abs(cy - 6.4) < 0.6;
      if (border) c = '#7a2a1a'; else if (border2) c = '#d8b06a';
      else if (beak) c = '#e3a12f';
      else if (head && Math.abs(cx - 12.2) < 0.6 && Math.abs(cy - 5.8) < 0.6) c = '#1b1b1b';
      else if (wing) c = '#2f6f6a'; else if (body || head) c = '#4fa39b';
      else if (tail) c = '#a03a26'; else if (leg) c = '#7a2a1a';
      else c = ((x * 7 + y * 3) % 5 === 0) ? '#efe2c4' : '#f6ecd6';
      const j = ((x * 13 + y * 7) % 5) * 0.25;
      cells.push(`<rect x="${(x * s + 0.8 + j * 0.4).toFixed(1)}" y="${(y * s + 0.8).toFixed(1)}" width="${(s - 1.6).toFixed(1)}" height="${(s - 1.6).toFixed(1)}" rx="1.2" fill="${c}"/>`);
    }
    return svg(200, 200,
      `<defs>${noise(id + 'n', 23, 0.3)}${shadow(id + 's')}</defs>` +
      `<rect x="0" y="0" width="200" height="200" rx="6" fill="#8b7350" filter="url(#${id}s)"/>` + cells.join('') +
      `<rect x="0" y="0" width="200" height="200" rx="6" fill="#000" filter="url(#${id}n)" opacity=".8"/>` +
      `<path d="M150 0 L200 0 L200 64 C186 58 176 40 164 30 C158 24 152 12 150 0Z" fill="#5a4630" opacity=".9"/>`);
  };

  A.glass = (id) => svg(100, 200,
    `<defs>${lg(id + 'g', [[0, '#9be7c4', 0.85], [0.25, '#d6b4ff', 0.8], [0.5, '#7cc8ff', 0.75], [0.75, '#ffe08a', 0.8], [1, '#69d1a5', 0.85]], 0, 0, 1, 1)}${shadow(id + 's')}</defs>` +
    `<g filter="url(#${id}s)"><path d="M42 10 h16 v8 h-3 v62 C78 92 86 120 84 150 C82 180 68 192 50 192 C32 192 18 180 16 150 C14 120 22 92 45 80 v-62 h-3z" fill="url(#${id}g)" stroke="#e8fff6" stroke-opacity=".7" stroke-width="2"/></g>` +
    `<path d="M30 118 C26 140 28 164 38 178" stroke="#fff" stroke-opacity=".6" stroke-width="5" fill="none" stroke-linecap="round"/>` +
    `<path d="M48 22 v52" stroke="#fff" stroke-opacity=".5" stroke-width="3"/>` +
    `<path d="M20 140 C40 150 60 132 82 142" stroke="#fff" stroke-opacity=".35" stroke-width="2" fill="none"/>`);

  A.head = (id) => svg(200, 200,
    `<defs>${rg(id + 'g', [[0, '#ffffff'], [0.6, '#e4e0d8'], [1, '#a9a297']], '40%', '35%', '70%')}${noise(id + 'n', 25, 0.22, 0.6)}${shadow(id + 's')}</defs>` +
    worn(id, `<path d="M100 22 C140 22 164 52 162 92 C160 120 150 140 136 154 L132 176 L118 168 L112 186 L96 172 L82 186 L72 166 L64 154 C50 140 40 118 40 92 C38 52 60 22 100 22Z"/>`, `url(#${id}g)`) +
    `<g fill="#d8d2c6" stroke="#9c958a" stroke-width="2">${[[62, 54], [78, 40], [96, 34], [114, 36], [132, 44], [146, 60], [54, 72], [150, 80]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="13"/>`).join('')}</g>` +
    `<path d="M74 92 C80 88 90 88 94 92 M108 92 C112 88 122 88 128 92" stroke="#7c766c" stroke-width="3.5" fill="none" stroke-linecap="round"/>` +
    `<path d="M100 94 C98 110 96 120 92 126 C96 130 104 130 108 126" stroke="#8a8378" stroke-width="3" fill="none"/>` +
    `<path d="M86 142 C94 146 106 146 114 142" stroke="#8a8378" stroke-width="3" fill="none" stroke-linecap="round"/>` +
    `<path d="M150 98 L158 118 L148 124" stroke="#6f6a62" stroke-width="2" fill="none"/>` +
    `<path d="M60 110 C62 130 70 146 82 156" stroke="#fff" stroke-opacity=".6" stroke-width="5" fill="none"/>`);

  A.helmet = (id) => svg(200, 200,
    `<defs>${lg(id + 'g', [[0, '#ffe2a8'], [0.4, '#c88a3a'], [1, '#5c3510']])}${lg(id + 'i', [[0, '#b7bcc2'], [1, '#4a4f55']])}${noise(id + 'n', 27, 0.3)}${shadow(id + 's')}</defs>` +
    worn(id, `<path d="M36 120 C30 66 62 30 108 30 C150 30 176 62 174 104 L176 126 C186 132 192 144 190 152 L150 150 C146 138 140 130 132 128 L132 120 Z"/>`, `url(#${id}g)`) +
    worn(id, `<path d="M70 114 L112 114 L118 168 C110 180 88 182 76 172 Z"/>`, `url(#${id}i)`) +
    `<path d="M36 116 L132 116" stroke="#3a2008" stroke-width="7" stroke-linecap="round"/>` +
    `<path d="M150 150 L192 152" stroke="#3a2008" stroke-width="5" stroke-linecap="round"/>` +
    `<rect x="96" y="14" width="22" height="20" rx="4" fill="#7a4a18"/>` +
    `<circle cx="94" cy="142" r="5" fill="#2a2d30"/><circle cx="100" cy="160" r="3.6" fill="#2a2d30"/>` +
    `<path d="M60 84 C70 56 94 42 120 42" stroke="#fff" stroke-opacity=".45" stroke-width="6" fill="none" stroke-linecap="round"/>` +
    `<g fill="#4fa77f" opacity=".55"><circle cx="150" cy="80" r="8"/><circle cx="58" cy="104" r="6"/></g>`);

  A.plaque = (id, lines, latin = true) => {
    const w = 300, h = latin ? 200 : 100;
    const fs = latin ? 21 : 34;
    const rows = lines.map((t, i) => `<text x="${w / 2}" y="${(latin ? 62 : 62) + i * 46}" text-anchor="middle" font-family="${latin ? 'Georgia, serif' : 'Frank Ruhl Libre, David, serif'}" font-size="${fs}" letter-spacing="${latin ? 3 : 1}" fill="#6f655a" stroke="#fffaf0" stroke-opacity=".4" stroke-width=".8"${latin ? '' : ' direction="rtl"'}>${t}</text>`).join('');
    return svg(w, h,
      `<defs>${lg(id + 'g', [[0, '#f2ead9'], [0.6, '#d9ccb3'], [1, '#a8987a']])}${noise(id + 'n', 29, 0.35, 0.5)}${shadow(id + 's')}</defs>` +
      worn(id, latin
        ? `<path d="M6 10 L210 6 L236 20 L262 8 L294 30 L284 86 L296 120 L276 192 L18 194 L4 150 L12 96 Z"/>`
        : `<path d="M6 8 L294 6 L296 52 L286 94 L10 96 L4 50 Z"/>`, `url(#${id}g)`) + rows +
      `<path d="M240 30 L262 60 L250 100" stroke="#8a7a60" stroke-width="2" fill="none" opacity=".7"/>`);
  };

  A.mug = (id) => svg(100, 200,
    `<defs>${lg(id + 'g', [[0, '#bdb3a0'], [0.4, '#f1ead9'], [0.7, '#e1d7c2'], [1, '#9f9480']], 0, 0, 1, 0)}${noise(id + 'n', 31, 0.3, 0.6)}${shadow(id + 's')}</defs>` +
    worn(id, `<path d="M18 30 L72 30 L70 184 C70 190 20 190 20 184 Z"/>`, `url(#${id}g)`) +
    `<path d="M72 60 h16 v80 h-16" stroke="#cfc5b0" stroke-width="9" fill="none"/>` +
    `<g stroke="#8b806c" stroke-opacity=".55" stroke-width="2">${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M${26 + i * 8} 40 L${26 + i * 8} 178"/>`).join('')}</g>` +
    `<ellipse cx="45" cy="30" rx="27" ry="6" fill="#7d725f"/>`);

  A.jar = (id) => svg(100, 200,
    `<defs>${lg(id + 'g', [[0, '#a8875a'], [0.4, '#ead7b2'], [0.7, '#d8bf93'], [1, '#8f6f45']], 0, 0, 1, 0)}${noise(id + 'n', 33)}${shadow(id + 's')}</defs>` +
    worn(id, `<path d="M24 52 C24 44 30 40 36 40 L64 40 C70 40 76 44 76 52 L80 168 C80 184 68 192 50 192 C32 192 20 184 20 168 Z"/>`, `url(#${id}g)`) +
    worn(id, `<path d="M18 40 C18 22 34 12 50 12 C66 12 82 22 82 40 Z"/>`, '#c8a877') +
    `<g fill="#8f6f45">${[0, 1, 2, 3].map((i) => `<rect x="${i % 2 ? 72 : 22}" y="${56 + (i >> 1) * 10}" width="6" height="7" rx="2"/>`).join('')}</g>` +
    `<path d="M34 60 C30 100 30 140 36 176" stroke="#fff" stroke-opacity=".4" stroke-width="6" fill="none" stroke-linecap="round"/>`);

  A.scroll = (id) => {
    const lines = [];
    for (let col = 0; col < 3; col++) for (let r = 0; r < 6; r++) {
      const x = 186 - col * 44;
      const len = 26 + ((col * 7 + r * 5) % 9);
      lines.push(`<path d="M${x} ${20 + r * 11} h-${len}" stroke="#3a2a18" stroke-opacity=".6" stroke-width="3" stroke-dasharray="${2 + (r % 3)} 2"/>`);
    }
    return svg(200, 100,
      `<defs>${lg(id + 'g', [[0, '#e9d6ad'], [1, '#b89664']], 0, 0, 0, 1)}${lg(id + 'r', [[0, '#7a5a34'], [0.5, '#d9bb88'], [1, '#6e4f2c']], 0, 0, 1, 0)}${noise(id + 'n', 35, 0.4, 0.5)}${shadow(id + 's')}</defs>` +
      worn(id, `<path d="M40 10 L194 8 L190 30 L196 52 L188 76 L194 92 L40 90 Z"/>`, `url(#${id}g)`) + lines.join('') +
      worn(id, `<rect x="6" y="4" width="40" height="92" rx="18"/>`, `url(#${id}r)`) +
      `<path d="M14 14 v72 M24 10 v80" stroke="#5a3f20" stroke-opacity=".45" stroke-width="2"/>`);
  };

  A.lmlk = (id) => svg(100, 100,
    `<defs>${lg(id + 'g', [[0, '#e8a172'], [0.5, '#b8653a'], [1, '#6d3216']])}${noise(id + 'n', 37)}${shadow(id + 's')}</defs>` +
    worn(id, `<path d="M18 92 C14 50 22 18 50 10 C78 18 86 50 82 92 L64 92 C66 56 62 36 50 30 C38 36 34 56 36 92Z"/>`, `url(#${id}g)`) +
    `<ellipse cx="50" cy="60" rx="17" ry="20" fill="#8a4422" opacity=".65"/>` +
    `<path d="M50 46 v28 M38 54 l12 6 12 -6 M38 66 l12 -6 12 6 M44 46 h12" stroke="#f3c5a0" stroke-opacity=".75" stroke-width="2.4" fill="none" stroke-linecap="round"/>`);

  A.figurine = (id, gold = false) => svg(100, 200, gold
    ? `<defs>${lg(id + 'g', [[0, '#fff3b0'], [0.4, '#e2b23c'], [0.8, '#7a5a1a'], [1, '#3c6e4f']])}${noise(id + 'n', 39, 0.3)}${shadow(id + 's')}</defs>` +
      worn(id, `<path d="M46 14 C46 6 54 6 54 14 L56 30 C64 32 66 40 64 50 L74 22 L80 24 L72 62 L64 70 L64 120 L70 186 L58 186 L52 130 L48 130 L42 186 L30 186 L36 120 L36 70 C32 60 30 52 36 40 C40 34 42 32 46 30 Z"/>`, `url(#${id}g)`) +
      `<circle cx="52" cy="22" r="1.8" fill="#3a2a08"/>` +
      `<path d="M40 70 h24" stroke="#5a420e" stroke-width="3"/>` +
      `<path d="M42 40 C40 60 42 100 44 130" stroke="#fff8d0" stroke-opacity=".5" stroke-width="3" fill="none"/>`
    : `<defs>${lg(id + 'g', [[0, '#e9b48c'], [0.5, '#c08058'], [1, '#7a4426']], 0, 0, 1, 0)}${noise(id + 'n', 41)}${shadow(id + 's')}</defs>` +
      worn(id, `<path d="M50 12 C64 12 70 22 68 34 C66 44 60 48 58 50 C70 54 74 66 70 76 L64 84 L66 168 C72 172 76 180 74 188 L26 188 C24 180 28 172 34 168 L36 84 L30 76 C26 66 30 54 42 50 C40 48 34 44 32 34 C30 22 36 12 50 12Z"/>`, `url(#${id}g)`) +
      `<circle cx="44" cy="30" r="2.6" fill="#3a1c0c"/><circle cx="56" cy="30" r="2.6" fill="#3a1c0c"/>` +
      `<path d="M34 64 C42 76 58 76 66 64" stroke="#7a4426" stroke-width="4" fill="none"/>` +
      `<g fill="#7a4426" opacity=".7">${[0, 1, 2, 3, 4].map((i) => `<circle cx="${36 + i * 7}" cy="18" r="3"/>`).join('')}</g>`);

  A.ostracon = (id) => {
    const strokes = [];
    for (let r = 0; r < 4; r++) for (let k = 0; k < 7; k++) {
      const x = 160 - k * 18 - (r % 2) * 6, y = 28 + r * 17;
      const v = (r * 7 + k * 3) % 4;
      strokes.push(v === 0 ? `<path d="M${x} ${y} l-6 9 l8 0"/>` : v === 1 ? `<path d="M${x} ${y} v10 M${x - 6} ${y + 3} h8"/>` : v === 2 ? `<path d="M${x} ${y} l-7 4 l7 5"/>` : `<path d="M${x - 6} ${y} l6 10 l3 -8"/>`);
    }
    return svg(200, 100,
      `<defs>${lg(id + 'g', [[0, '#e7a777'], [0.6, '#c57a49'], [1, '#8a4a24']])}${noise(id + 'n', 43)}${shadow(id + 's')}</defs>` +
      worn(id, `<path d="M14 18 L80 6 L150 10 L192 28 L186 66 L158 94 L64 92 L18 76 Z"/>`, `url(#${id}g)`) +
      `<g stroke="#2a160c" stroke-opacity=".75" stroke-width="2.6" fill="none" stroke-linecap="round">${strokes.join('')}</g>`);
  };

  A.bulla = (id) => svg(100, 100,
    `<defs>${rg(id + 'g', [[0, '#d9a77a'], [0.7, '#9a6238'], [1, '#5a3418']])}${noise(id + 'n', 45, 0.4, 0.7)}${shadow(id + 's')}</defs>` +
    worn(id, `<path d="M50 10 C70 8 88 22 90 44 C92 66 80 88 54 90 C28 92 10 76 10 52 C10 30 28 12 50 10Z"/>`, `url(#${id}g)`) +
    `<path d="M50 10 C70 8 88 22 90 44 C92 66 80 88 54 90 C28 92 10 76 10 52 C10 30 28 12 50 10Z" fill="none" stroke="#4a2a12" stroke-width="2"/>` +
    `<ellipse cx="50" cy="50" rx="28" ry="24" fill="#7a4a26" opacity=".55"/>` +
    `<g stroke="#f4cfa8" stroke-opacity=".8" stroke-width="2.2" fill="none" stroke-linecap="round">` +
    `<circle cx="50" cy="50" r="6"/><path d="M44 50 C36 44 30 42 24 44 M44 52 C36 50 30 50 26 52 M56 50 C64 44 70 42 76 44 M56 52 C64 50 70 50 74 52 M46 58 l-4 8 M54 58 l4 8"/>` +
    `<path d="M32 32 h8 M44 30 v6 M50 31 h8 M62 30 v6 M34 72 h10 M50 70 v6 M58 72 h8"/></g>`);

  A.scarab = (id) => svg(100, 100,
    `<defs>${rg(id + 'g', [[0, '#d9e3c8'], [0.6, '#8fa27a'], [1, '#43543a']])}${noise(id + 'n', 47, 0.25)}${shadow(id + 's')}</defs>` +
    worn(id, `<path d="M50 10 C70 10 84 30 84 54 C84 78 70 92 50 92 C30 92 16 78 16 54 C16 30 30 10 50 10Z"/>`, `url(#${id}g)`) +
    `<g stroke="#3a4a30" stroke-width="2.4" fill="none"><path d="M24 34 C40 28 60 28 76 34"/><path d="M50 34 V88"/><path d="M30 24 C38 16 62 16 70 24"/><path d="M28 60 C36 64 44 64 48 62 M72 60 C64 64 56 64 52 62"/></g>` +
    `<ellipse cx="36" cy="44" rx="8" ry="12" fill="#fff" opacity=".25"/>`);

  A.axe = (id) => svg(100, 200,
    `<defs>${lg(id + 'g', [[0, '#7fbf9e'], [0.4, '#b9874a'], [0.7, '#8a5a2a'], [1, '#3f7a5c']])}${noise(id + 'n', 49, 0.45)}${shadow(id + 's')}</defs>` +
    worn(id, `<path d="M38 14 L62 14 L64 96 C82 120 90 150 88 186 C70 178 30 178 12 186 C10 150 18 120 36 96 Z"/>`, `url(#${id}g)`) +
    `<ellipse cx="50" cy="40" rx="8" ry="14" fill="#2a1c10"/>` +
    `<path d="M16 180 C36 174 64 174 84 180" stroke="#f6dcae" stroke-opacity=".5" stroke-width="3" fill="none"/>` +
    `<g fill="#3f9a72" opacity=".55"><circle cx="40" cy="130" r="7"/><circle cx="66" cy="150" r="5"/><circle cx="54" cy="70" r="4"/></g>`);

  A.dagger = (id) => svg(100, 200,
    `<defs>${lg(id + 'g', [[0, '#e8c48a'], [0.5, '#a8743a'], [1, '#4a6e4e']], 0, 0, 1, 0)}${noise(id + 'n', 51, 0.45)}${shadow(id + 's')}</defs>` +
    worn(id, `<path d="M50 192 L62 150 L64 70 L74 62 L26 62 L36 70 L38 150 Z"/>`, `url(#${id}g)`) +
    `<path d="M50 70 V180" stroke="#6d4a20" stroke-width="3"/>` +
    worn(id, `<path d="M40 60 L42 22 C42 14 58 14 58 22 L60 60 Z"/>`, '#6d4a26') +
    `<circle cx="44" cy="68" r="3" fill="#2a1c10"/><circle cx="56" cy="68" r="3" fill="#2a1c10"/>` +
    `<g fill="#3f9a72" opacity=".6"><circle cx="56" cy="120" r="6"/><circle cx="46" cy="160" r="4"/></g>`);

  A.ivory = (id) => svg(200, 200,
    `<defs>${lg(id + 'g', [[0, '#fff8e6'], [0.6, '#ecdcb4'], [1, '#b89a64']])}${noise(id + 'n', 53, 0.25, 0.6)}${shadow(id + 's')}</defs>` +
    worn(id, `<rect x="10" y="12" width="180" height="178" rx="8"/>`, `url(#${id}g)`) +
    `<rect x="22" y="24" width="156" height="154" rx="4" fill="none" stroke="#a88a52" stroke-width="3"/>` +
    `<g stroke="#8a6c3a" stroke-width="3" fill="none" stroke-linecap="round">` +
    `<path d="M100 170 V96"/><path d="M100 96 C80 84 70 64 74 44 M100 96 C120 84 130 64 126 44 M100 96 C88 76 90 56 100 40 C110 56 112 76 100 96"/>` +
    `<path d="M48 170 C46 140 52 120 64 110 C58 100 60 88 70 84 M152 170 C154 140 148 120 136 110 C142 100 140 88 130 84"/>` +
    `<path d="M40 112 C46 104 56 104 62 112 M138 112 C144 104 154 104 160 112"/></g>` +
    `<g fill="#a88a52">${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<circle cx="${34 + i * 19}" cy="30" r="3"/>`).join('')}</g>` +
    `<path d="M150 12 L190 12 L190 70 C172 52 160 32 150 12Z" fill="#7a6040" opacity=".85"/>`);

  A.flint = (id) => svg(100, 100,
    `<defs>${lg(id + 'g', [[0, '#d8cbb0'], [0.5, '#9a8466'], [1, '#5a4a36']])}${noise(id + 'n', 55, 0.3)}${shadow(id + 's')}</defs>` +
    worn(id, `<path d="M18 86 L72 12 C78 8 86 12 84 20 L30 92 C26 96 16 94 18 86Z"/>`, `url(#${id}g)`) +
    `<path d="M24 86 L78 16 M34 88 L80 26" stroke="#4a3c2a" stroke-opacity=".5" stroke-width="2"/>` +
    `<path d="M22 80 L70 18" stroke="#fff" stroke-opacity=".4" stroke-width="2.5"/>`);

  A.handaxe = (id) => {
    const facets = [[50, 12, 34, 50, 50, 60], [50, 12, 66, 50, 50, 60], [34, 50, 22, 110, 50, 100], [66, 50, 78, 110, 50, 100], [34, 50, 50, 60, 50, 100], [66, 50, 50, 60, 50, 100], [22, 110, 30, 160, 50, 150], [78, 110, 70, 160, 50, 150], [22, 110, 50, 100, 50, 150], [78, 110, 50, 100, 50, 150], [30, 160, 50, 188, 50, 150], [70, 160, 50, 188, 50, 150]];
    const shades = ['#c9b18a', '#a88f68', '#b8a07a', '#977e58', '#d4be98', '#8c7450'];
    return svg(100, 200,
      `<defs>${noise(id + 'n', 57, 0.35)}${shadow(id + 's')}</defs>` +
      `<g filter="url(#${id}s)">${facets.map((f, i) => `<polygon points="${f.join(' ')}" fill="${shades[i % shades.length]}" stroke="#6a5436" stroke-width="1.2"/>`).join('')}</g>` +
      `<polygon points="50,12 78,110 70,160 50,188 30,160 22,110" fill="#000" filter="url(#${id}n)"/>`);
  };

  A.beads = (id) => svg(100, 100,
    `<defs>${rg(id + 'g', [[0, '#fffaf0'], [0.6, '#e8d6b6'], [1, '#a88e66']])}${shadow(id + 's')}</defs>` +
    `<path d="M12 30 C30 70 70 70 88 30" stroke="#6a4a2a" stroke-width="2" fill="none"/>` +
    `<g filter="url(#${id}s)">${[[16, 40], [30, 56], [50, 62], [70, 56], [84, 40]].map(([x, y], i) => `<g transform="translate(${x} ${y}) rotate(${i * 30 - 60})"><path d="M0 -12 C9 -12 12 -4 11 4 C10 10 5 13 0 13 C-5 13 -10 10 -11 4 C-12 -4 -9 -12 0 -12Z" fill="url(#${id}g)" stroke="#8a6e46" stroke-width="1.2"/><path d="M-6 -4 C-2 2 2 2 6 -4 M-7 3 C-2 8 2 8 7 3" stroke="#a88e66" stroke-width="1" fill="none"/><circle cx="0" cy="-7" r="2.2" fill="#3a2a18"/></g>`).join('')}</g>` +
    `<path d="M40 78 C44 84 50 86 58 84" stroke="#c84a2a" stroke-width="3" stroke-opacity=".5" fill="none"/>`);

  A.skull = (id) => svg(200, 200,
    `<defs>${rg(id + 'g', [[0, '#fbf3df'], [0.6, '#e2cfa8'], [1, '#9c845a']], '45%', '35%', '70%')}${noise(id + 'n', 59, 0.3, 0.6)}${shadow(id + 's')}</defs>` +
    worn(id, `<path d="M36 104 C30 56 66 22 112 24 C156 26 182 60 176 104 C174 124 164 136 150 142 L148 166 C148 178 136 186 124 186 L82 186 C70 186 62 178 62 168 L60 146 C46 140 38 124 36 104Z"/>`, `url(#${id}g)`) +
    `<path d="M70 92 C66 108 74 124 92 124 C106 124 112 110 106 98 C100 86 76 82 70 92Z" fill="#3a2a18"/>` +
    `<path d="M120 98 C116 110 122 124 138 124 C152 124 158 110 152 98 C146 88 124 88 120 98Z" fill="#3a2a18"/>` +
    `<path d="M106 132 L100 150 L112 150 Z" fill="#3a2a18"/>` +
    `<g stroke="#8a7350" stroke-width="2.4" fill="#f4ead2">${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${78 + i * 9}" y="160" width="8" height="14" rx="2"/>`).join('')}</g>` +
    `<path d="M60 60 C80 40 112 34 140 44" stroke="#fff" stroke-opacity=".5" stroke-width="6" fill="none" stroke-linecap="round"/>` +
    `<path d="M150 50 L140 70 L154 82" stroke="#7a6444" stroke-width="2" fill="none"/>`);

  A.mortar = (id) => svg(200, 200,
    `<defs>${lg(id + 'g', [[0, '#8a8d92'], [0.5, '#53565b'], [1, '#2a2c30']])}${noise(id + 'n', 61, 0.5, 1.2)}${shadow(id + 's')}</defs>` +
    worn(id, `<path d="M20 86 C20 76 180 76 180 86 C180 140 150 182 100 182 C50 182 20 140 20 86Z"/>`, `url(#${id}g)`) +
    `<ellipse cx="100" cy="86" rx="80" ry="16" fill="#3a3c40"/><ellipse cx="100" cy="90" rx="64" ry="11" fill="#1f2124"/>` +
    worn(id, `<path d="M118 76 L150 18 C154 10 168 16 164 26 L134 84 Z"/>`, '#6a6d72') +
    `<path d="M40 110 C46 140 70 166 100 172" stroke="#fff" stroke-opacity=".25" stroke-width="6" fill="none" stroke-linecap="round"/>`);

  A.sherd = (id) => svg(100, 100,
    `<defs>${lg(id + 'g', [[0, '#f0c9a0'], [1, '#c58a5a']])}${noise(id + 'n', 63)}${shadow(id + 's')}</defs>` +
    worn(id, `<path d="M14 24 L70 10 L90 50 L62 90 L20 78 Z"/>`, `url(#${id}g)`) +
    `<path d="M16 40 L82 26 M18 54 L86 40" stroke="#8a2a14" stroke-width="5"/><path d="M20 68 L80 56" stroke="#1f1410" stroke-width="3"/>` +
    `<path d="M30 74 l8 -8 8 8 8 -8 8 8" stroke="#1f1410" stroke-width="2.4" fill="none"/>`);

  /* items */
  A.canteen = (id) => svg(100, 100,
    `<defs>${rg(id + 'g', [[0, '#bfe3ff'], [0.5, '#3d8fd6'], [1, '#164a80']])}${shadow(id + 's')}</defs>` +
    `<path d="M20 30 C20 10 80 10 80 30" stroke="#7a5230" stroke-width="5" fill="none"/>` +
    `<g filter="url(#${id}s)"><circle cx="50" cy="56" r="34" fill="url(#${id}g)" stroke="#0e3560" stroke-width="3"/></g>` +
    `<rect x="42" y="12" width="16" height="14" rx="3" fill="#5a3a1c"/>` +
    `<path d="M50 40 C58 52 62 58 62 64 C62 71 56 76 50 76 C44 76 38 71 38 64 C38 58 42 52 50 40Z" fill="#fff" opacity=".9"/>`);
  A.pouch = (id) => svg(100, 100,
    `<defs>${rg(id + 'g', [[0, '#d9a066'], [0.6, '#9a5f2c'], [1, '#5a3214']])}${rg(id + 'c', [[0, '#fff4b8'], [0.6, '#f2c14e'], [1, '#a8741a']])}${shadow(id + 's')}</defs>` +
    `<g filter="url(#${id}s)"><path d="M34 30 C20 44 12 64 16 78 C20 92 80 92 84 78 C88 64 80 44 66 30 Z" fill="url(#${id}g)"/></g>` +
    `<path d="M34 30 C30 20 40 14 50 18 C60 14 70 20 66 30" fill="#b57a42" stroke="#5a3214" stroke-width="2"/>` +
    `<path d="M32 32 h36" stroke="#e8c48a" stroke-width="4"/>` +
    `<circle cx="70" cy="20" r="10" fill="url(#${id}c)" stroke="#a8741a" stroke-width="2"/><circle cx="82" cy="34" r="8" fill="url(#${id}c)" stroke="#a8741a" stroke-width="2"/>`);
  A.mapfrag = (id) => svg(100, 100,
    `<defs>${lg(id + 'g', [[0, '#f6e7c1'], [1, '#c9a66b']])}${noise(id + 'n', 65, 0.3)}${shadow(id + 's')}</defs>` +
    worn(id, `<path d="M12 18 L46 10 L58 20 L88 12 L84 50 L92 84 L54 90 L40 82 L14 88 L18 52 Z"/>`, `url(#${id}g)`) +
    `<path d="M22 74 C34 60 30 46 46 42 C58 38 56 28 68 26" stroke="#7a3a1a" stroke-width="2.5" stroke-dasharray="4 4" fill="none"/>` +
    `<path d="M62 20 l12 12 M74 20 l-12 12" stroke="#c0281a" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M24 26 l6 6 M30 26 l-6 6" stroke="#5a3a1c" stroke-width="2" opacity=".6"/>`);
  A.chest = (id) => svg(200, 100,
    `<defs>${lg(id + 'g', [[0, '#a56a34'], [1, '#5a3214']], 0, 0, 0, 1)}${lg(id + 'b', [[0, '#fff4b8'], [0.5, '#f2c14e'], [1, '#a8741a']], 0, 0, 0, 1)}${shadow(id + 's')}</defs>` +
    `<g filter="url(#${id}s)"><path d="M14 40 C14 14 186 14 186 40 L186 90 L14 90 Z" fill="url(#${id}g)" stroke="#3a1c08" stroke-width="3"/></g>` +
    `<path d="M14 44 H186" stroke="#3a1c08" stroke-width="3"/>` +
    `<rect x="40" y="18" width="14" height="72" fill="url(#${id}b)"/><rect x="146" y="18" width="14" height="72" fill="url(#${id}b)"/>` +
    `<rect x="88" y="36" width="24" height="26" rx="4" fill="url(#${id}b)" stroke="#7a5212" stroke-width="2"/><circle cx="100" cy="48" r="3.4" fill="#3a1c08"/>` +
    `<path d="M70 28 C80 24 120 24 130 28" stroke="#fff" stroke-opacity=".3" stroke-width="4" fill="none"/>`);

  /* ---------- data ---------- */
  const RARITY = {
    common: { name: 'נפוץ', color: '#cfc6b4', glow: 'rgba(230,220,200,.5)', w: 55, xp: 5, rank: 0 },
    uncommon: { name: 'לא שכיח', color: '#6fd17a', glow: 'rgba(111,209,122,.6)', w: 26, xp: 12, rank: 1 },
    rare: { name: 'נדיר', color: '#5ab0ff', glow: 'rgba(90,176,255,.7)', w: 12, xp: 30, rank: 2 },
    epic: { name: 'נדיר ביותר', color: '#c27dff', glow: 'rgba(194,125,255,.75)', w: 5.5, xp: 70, rank: 3 },
    legendary: { name: 'אגדי', color: '#ffbe3b', glow: 'rgba(255,190,59,.85)', w: 1.5, xp: 200, rank: 4 },
  };

  const ERAS = [
    { id: 'ottoman', name: 'התקופה העות׳מאנית', short: 'עות׳מאני', years: '1517–1917' },
    { id: 'crusader', name: 'התקופה הצלבנית', short: 'צלבני', years: '1099–1291' },
    { id: 'byzantine', name: 'התקופה הביזנטית', short: 'ביזנטי', years: '324–638' },
    { id: 'roman', name: 'התקופה הרומית', short: 'רומי', years: '63 לפנה״ס–324' },
    { id: 'second', name: 'ימי הבית השני', short: 'בית שני', years: '516 לפנה״ס–70' },
    { id: 'first', name: 'ימי הבית הראשון', short: 'בית ראשון', years: '1000–586 לפנה״ס' },
    { id: 'canaan', name: 'התקופה הכנענית', short: 'כנעני', years: '3300–1200 לפנה״ס' },
    { id: 'prehistory', name: 'הפרהיסטוריה', short: 'פרהיסטורי', years: 'לפני 500,000–10,000 שנה' },
  ];

  // [id, era, name, rarity, w, h, value, art(id), fact]
  const F = [
    ['o_coin', 'ottoman', 'אקצ׳ה — מטבע כסף עות׳מאני', 'common', 1, 1, 12, (i) => A.coin(i, 'silver', MARK.tughra, 4), 'מטבע כסף קטן שהיה המטבע הבסיסי של האימפריה העות׳מאנית במשך מאות שנים.'],
    ['o_pipe', 'ottoman', 'מקטרת חרס', 'common', 2, 1, 15, (i) => A.pipe(i), 'מקטרות חרס לטבק היו נפוצות מאוד בארץ מהמאה ה־17. הסגנונות שלהן השתנו מהר, ולכן הן עוזרות לארכיאולוגים לתארך שכבות.'],
    ['o_shoe', 'ottoman', 'פרסת ברזל', 'common', 1, 1, 10, (i) => A.horseshoe(i), 'פרסות ברזל מסמנות את דרכי השיירות והחאנים שלאורך הדרכים הראשיות בארץ.'],
    ['o_glass', 'ottoman', 'צמיד זכוכית חברונית', 'uncommon', 1, 1, 45, (i) => A.bracelet(i), 'תעשיית הזכוכית של חברון פעלה מאות שנים ונודעה בצמידים ובחרוזים כחולים וצבעוניים.'],
    ['o_dallah', 'ottoman', 'דלה — קומקום קפה מנחושת', 'rare', 2, 2, 140, (i) => A.dallah(i), 'קומקום הקפה עם המקור המעוקל הוא סמל הכנסת אורחים במזרח התיכון כבר מאות שנים.'],
    ['o_sultani', 'ottoman', 'סולטאני — מטבע זהב', 'epic', 1, 1, 380, (i) => A.coin(i, 'gold', MARK.tughra, 6), 'מטבע זהב שנשא את הטורה, חתימת הסולטן המסוגננת, במקום דיוקן.'],

    ['c_arrow', 'crusader', 'ראש חץ מברזל', 'common', 1, 2, 16, (i) => A.arrow(i), 'ראשי חצים מברזל נמצאים בשפע באתרי קרבות ובמבצרים מתקופת מסעי הצלב.'],
    ['c_coin', 'crusader', 'דינר כסף צלבני', 'uncommon', 1, 1, 50, (i) => A.coin(i, 'silver', MARK.cross, 8), 'מטבע שהוטבע בממלכת ירושלים הצלבנית. רבים מהם נושאים צלב בצד אחד.'],
    ['c_seal', 'crusader', 'חותם שעווה של מסדר', 'rare', 1, 1, 150, (i) => A.wax(i), 'חותמות אימתו מסמכים של המסדרים הצבאיים, שמרכזם בארץ היה בעכו.'],
    ['c_sword', 'crusader', 'חרב צלבנית', 'epic', 1, 4, 520, (i) => A.sword(i), 'ב־2021 מצא צוללן מול חוף הכרמל חרב צלבנית בת כ־900 שנה, מכוסה באורגניזמים ימיים.'],

    ['b_lamp', 'byzantine', 'נר שמן ביזנטי', 'common', 2, 1, 18, (i) => A.lamp(i, '#e0a77a', '#7a3e1c'), 'נרות שמן מחרס היו מקור האור העיקרי בבית. הביזנטיים מעוטרים לעיתים קרובות בדגמים על השוליים.'],
    ['b_amphora', 'byzantine', 'אמפורת יין עזתית', 'uncommon', 1, 3, 70, (i) => A.amphora(i, '#d99a6a', '#7a3e1c', true), '"יין עזה" היה מפורסם בכל העולם הביזנטי ונשלח באמפורות מצולעות לאורך הים התיכון.'],
    ['b_mosaic', 'byzantine', 'פסיפס הציפור', 'rare', 2, 2, 190, (i) => A.mosaic(i), 'רצפות פסיפס מרהיבות עם ציפורים ובעלי חיים נמצאו בבתי כנסת ובכנסיות ביזנטיים בכל רחבי הארץ.'],
    ['b_solidus', 'byzantine', 'סולידוס — מטבע זהב ביזנטי', 'epic', 1, 1, 450, (i) => A.coin(i, 'gold', MARK.bust, 10), 'מטבע הזהב של האימפריה הביזנטית. משקלו נשמר כמעט ללא שינוי במשך מאות שנים.'],

    ['r_denarius', 'roman', 'דינר רומי', 'common', 1, 1, 20, (i) => A.coin(i, 'silver', MARK.bust, 12), 'מטבע הכסף הרומי, שמקובל לראות בו שכר יום עבודה של פועל.'],
    ['r_glass', 'roman', 'בקבוק זכוכית רומי', 'uncommon', 1, 2, 65, (i) => A.glass(i), 'זכוכית רומית מקבלת עם השנים ברק בצבעי הקשת, בגלל תהליכי בלייה ארוכים באדמה.'],
    ['r_amphora', 'roman', 'אמפורה רומית', 'uncommon', 1, 3, 60, (i) => A.amphora(i, '#e8b48a', '#8a4a24'), 'אמפורות הובילו יין, שמן ורוטב דגים בכל רחבי האימפריה הרומית.'],
    ['r_head', 'roman', 'ראש פסל שיש', 'rare', 2, 2, 210, (i) => A.head(i), 'קיסריה, עיר הנמל של הורדוס, הייתה בירת הפרובינציה הרומית ומלאה בפסלי שיש.'],
    ['r_helmet', 'roman', 'קסדת לגיונר', 'epic', 2, 2, 600, (i) => A.helmet(i), 'קסדת לגיונר עם מגן עורף רחב ומגיני לחיים הייתה חלק מהציוד הסטנדרטי של הצבא הרומי.'],
    ['r_pilate', 'roman', 'כתובת פונטיוס פילטוס', 'legendary', 3, 2, 2600, (i) => A.plaque(i, ['S TIBERIEVM', 'PONTIVS PILATVS', 'PRAEFECTVS IVDAEAE']), 'הכתובת היחידה מתקופתו שמזכירה את פונטיוס פילטוס, נציב יהודה. היא נמצאה בתיאטרון של קיסריה ב־1961.'],

    ['s_lamp', 'second', 'נר הרודיאני', 'common', 1, 1, 22, (i) => A.herodLamp(i), 'נר שהפיה שלו גולפה בסכין. הוא היה נפוץ ביהודה בסוף ימי הבית השני.'],
    ['s_mug', 'second', 'ספל אבן גיר', 'uncommon', 1, 2, 60, (i) => A.mug(i), 'יהודים השתמשו בכלי אבן בימי הבית השני, כי לפי ההלכה אבן אינה מקבלת טומאה.'],
    ['s_jar', 'second', 'כד מגילות', 'rare', 1, 2, 220, (i) => A.jar(i), 'כד גלילי עם מכסה, כמו הכדים שבהם נמצאו מגילות ים המלח במערות קומראן.'],
    ['s_shekel', 'second', 'שקל ישראל', 'epic', 1, 1, 650, (i) => A.coin(i, 'silver', MARK.chalice, 14), 'שקל כסף מימי המרד הגדול ברומאים (66–70). הוא נושא את הכתובת "שקל ישראל" ועליה גביע.'],
    ['s_scroll', 'second', 'קטע מגילה', 'legendary', 2, 1, 2800, (i) => A.scroll(i), 'מגילות ים המלח הן כתבי היד העבריים העתיקים ביותר של התנ״ך שנמצאו עד היום.'],
    ['s_trumpet', 'second', 'אבן "לבית התקיעה"', 'legendary', 3, 1, 3200, (i) => A.plaque(i, ['לבית התקיעה'], false), 'אבן מפינת הר הבית שעליה הכתובת "לבית התקיעה", המקום שבו תקע הכהן בשופר להכרזה על כניסת השבת. היא נמצאה ב־1968.'],

    ['f_sherd', 'first', 'חרס צבוע', 'common', 1, 1, 18, (i) => A.sherd(i), 'שברי כלי חרס הם הממצא הנפוץ ביותר בחפירות. הם "השעון" שלפיו מתארכים שכבות.'],
    ['f_lmlk', 'first', 'ידית "למלך"', 'uncommon', 1, 1, 70, (i) => A.lmlk(i), 'ידיות קנקנים עם חותם "למלך" מיוחסות למנהל של ממלכת יהודה בימי חזקיהו.'],
    ['f_figurine', 'first', 'צלמית עמוד', 'uncommon', 1, 2, 75, (i) => A.figurine(i), 'צלמיות עמוד מחרס היו נפוצות מאוד באתרים ביהודה במאות ה־8 וה־7 לפנה״ס.'],
    ['f_ostracon', 'first', 'אוסטרקון', 'rare', 2, 1, 260, (i) => A.ostracon(i), 'אוסטרקון הוא חרס שכתבו עליו מכתבים ורשימות בכתב עברי קדום, כמו מכתבי לכיש.'],
    ['f_bulla', 'first', 'בולת חזקיהו מלך יהודה', 'legendary', 1, 1, 3500, (i) => A.bulla(i), 'טביעת החותם "לחזקיהו [בן] אחז מלך יהדה" נמצאה בעופל ב־2015. היא טביעת החותם הראשונה של מלך יהודה שנמצאה בחפירה מסודרת.'],

    ['k_axe', 'canaan', 'גרזן ברונזה', 'common', 1, 2, 30, (i) => A.axe(i), 'גרזן יצוק מברונזה, סגסוגת של נחושת ובדיל, שהעניקה לתקופה כולה את שמה.'],
    ['k_scarab', 'canaan', 'חרפושית', 'uncommon', 1, 1, 80, (i) => A.scarab(i), 'חרפושיות מצריות שימשו כחותמות וכקמעות. הן מעידות על הקשרים ההדוקים בין כנען למצרים.'],
    ['k_dagger', 'canaan', 'פגיון ברונזה', 'rare', 1, 2, 280, (i) => A.dagger(i), 'פגיונות ברונזה עם ניצב מחובר במסמרות נמצאו בקברים של לוחמים כנענים.'],
    ['k_figurine', 'canaan', 'פסלון מצופה זהב', 'epic', 1, 2, 700, (i) => A.figurine(i, true), 'פסלוני ברונזה של אלים כנעניים, חלקם מצופים זהב או כסף, נמצאו בתלים כמו מגידו וחצור.'],
    ['k_ivory', 'canaan', 'שנהב מגידו', 'legendary', 2, 2, 4000, (i) => A.ivory(i), 'במגידו נמצא אוצר של מאות לוחות שנהב מגולפים מסוף תקופת הברונזה.'],

    ['p_flint', 'prehistory', 'להב צור', 'common', 1, 1, 25, (i) => A.flint(i), 'להבי צור היו הסכין של האדם הקדום במשך מאות אלפי שנים.'],
    ['p_handaxe', 'prehistory', 'אבן יד אשלית', 'uncommon', 1, 2, 90, (i) => A.handaxe(i), 'אבן היד הייתה הכלי הרב־שימושי של האדם הקדום. אלפים כאלה נמצאו בגשר בנות יעקב.'],
    ['p_beads', 'prehistory', 'חרוזי צדף', 'rare', 1, 1, 300, (i) => A.beads(i), 'צדפים מנוקבים ממערת קפזה וממערת סחול הם מהתכשיטים העתיקים בעולם, בני כ־100 אלף שנה.'],
    ['p_mortar', 'prehistory', 'מכתש בזלת נאטופי', 'epic', 2, 2, 800, (i) => A.mortar(i), 'הנאטופים היו מהראשונים שהתיישבו בכפרי קבע. במכתשים כבדים מבזלת הם כתשו דגנים.'],
    ['p_skull', 'prehistory', 'גולגולת אדם קדום', 'legendary', 2, 2, 5000, (i) => A.skull(i), 'במערות הכרמל, סחול ותבון, נמצאו שרידי אדם מודרני וניאנדרטלי. המערות הוכרזו אתר מורשת עולמית.'],
  ];

  const FINDS = F.map(([id, era, name, rarity, w, h, value, art, fact]) => ({ id, era, name, rarity, w, h, value, svg: art(id), fact }));
  const BY_ID = Object.fromEntries(FINDS.map((f) => [f.id, f]));

  const ITEMS = {
    canteen: { id: 'canteen', name: 'מימייה', w: 1, h: 1, svg: A.canteen('it_canteen'), note: '+8 אנרגיה' },
    pouch: { id: 'pouch', name: 'צרור מטבעות', w: 1, h: 1, svg: A.pouch('it_pouch'), note: 'מטבעות' },
    mapfrag: { id: 'mapfrag', name: 'קרע של מפת אוצר', w: 1, h: 1, svg: A.mapfrag('it_map'), note: '3 קרעים = מפת אוצר' },
    chest: { id: 'chest', name: 'תיבת אוצר', w: 2, h: 1, svg: A.chest('it_chest'), note: 'שלל גדול' },
  };

  // eras listed shallow → deep
  const SITES = [
    { id: 'yard', name: 'החצר של סבא', place: 'כפר בגליל', eras: ['ottoman', 'crusader'], level: 1, mult: 1, sky: ['#8fd3ff', '#ffe7b0'], blurb: 'מתחילים כאן: אדמה רכה ומה שהשאירו הדורות הקודמים.' },
    { id: 'akko', name: 'עכו העתיקה', place: 'חוף הגליל', eras: ['ottoman', 'crusader', 'byzantine'], level: 2, mult: 1.3, sky: ['#7cc0f0', '#ffd9a0'], blurb: 'מבצר על הים: עיר הנמל של הצלבנים, והמסדרים שישבו בה.' },
    { id: 'caesarea', name: 'קיסריה', place: 'חוף השרון', eras: ['crusader', 'byzantine', 'roman'], level: 4, mult: 1.8, sky: ['#6fb6ee', '#ffc98a'], blurb: 'עיר הנמל של הורדוס ובירת הנציבים הרומיים.' },
    { id: 'david', name: 'עיר דוד', place: 'ירושלים', eras: ['roman', 'second', 'first'], level: 6, mult: 2.5, sky: ['#86b8e8', '#ffd2a0'], blurb: 'מתחת לרחובות ירושלים: הבית השני, והבית הראשון שמתחתיו.' },
    { id: 'qumran', name: 'מערות קומראן', place: 'מדבר יהודה', eras: ['roman', 'second'], level: 8, mult: 3.2, sky: ['#f0b070', '#ffe2b0'], blurb: 'מערות במדבר שבהן נשמרו מגילות במשך אלפיים שנה.' },
    { id: 'megiddo', name: 'תל מגידו', place: 'עמק יזרעאל', eras: ['first', 'canaan'], level: 10, mult: 4, sky: ['#7ab8e0', '#ffd9a8'], blurb: 'עשרים ערים בנויות זו על גבי זו. כאן נמצא אוצר השנהב.' },
    { id: 'carmel', name: 'מערות הכרמל', place: 'נחל מערות', eras: ['canaan', 'prehistory'], level: 13, mult: 5.2, sky: ['#5f9fd6', '#f7c890'], blurb: 'מאות אלפי שנים של אדם קדום, שכבה מתחת לשכבה.' },
  ];

  window.SHCHAVOT = { RARITY, ERAS, FINDS, BY_ID, ITEMS, SITES, svgUrl: (s) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s) };
})();
