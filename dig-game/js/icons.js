/* שכבות — drawn icon set (tools, HUD, tabs) and the illustrated landscape of each site. */
(function () {
  'use strict';
  const s = (body, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true"><defs>${defs}</defs>${body}</svg>`;
  const lg = (id, a, b, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  const wood = (id) => lg(id, '#c98a4a', '#6e3d18', 1, 0);
  const steel = (id) => lg(id, '#f4f7fb', '#7c8794');
  const gold = (id) => `<radialGradient id="${id}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff6c2"/><stop offset=".55" stop-color="#f6c444"/><stop offset="1" stop-color="#a86d12"/></radialGradient>`;

  const ICONS = {
    pick: s(`<path d="M17 52 L44 25" stroke="url(#ipw)" stroke-width="6.5" stroke-linecap="round"/><path d="M17 52 L44 25" stroke="#3a1c08" stroke-opacity=".35" stroke-width="1.5" stroke-dasharray="3 5"/>
      <path d="M22 16 C34 10 50 14 58 26 C50 22 44 21 40 22 L36 28 L30 22 C28 20 25 18 22 16Z" fill="url(#ips)" stroke="#3d4650" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M24 17 C34 13 46 15 54 22" stroke="#fff" stroke-opacity=".7" stroke-width="1.6" fill="none"/>`, wood('ipw') + steel('ips')),
    trowel: s(`<path d="M10 54 L22 42" stroke="url(#itw)" stroke-width="7" stroke-linecap="round"/><rect x="21" y="36" width="8" height="8" rx="2" transform="rotate(45 25 40)" fill="#6d737b"/>
      <path d="M28 36 L56 8 L50 36 Z" fill="url(#its)" stroke="#3d4650" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M31 34 L53 12" stroke="#fff" stroke-opacity=".75" stroke-width="1.6"/>`, wood('itw') + steel('its')),
    brush: s(`<path d="M12 56 L30 38" stroke="url(#ibw)" stroke-width="7" stroke-linecap="round"/><path d="M27 32 L37 42 L33 46 L23 36Z" fill="#c9a24a" stroke="#6b4e12" stroke-width="1.4"/>
      <path d="M33 26 C42 14 52 10 58 8 C56 14 52 24 40 33 Z" fill="url(#ibb)" stroke="#5a3a1c" stroke-width="1.4"/>
      <path d="M37 28 L54 11 M40 31 L56 14 M35 25 L50 10" stroke="#2a1608" stroke-opacity=".45" stroke-width="1.2"/>`, wood('ibw') + lg('ibb', '#f2d9a8', '#a8743a')),
    sonar: s(`<circle cx="32" cy="36" r="13" fill="url(#iss)" stroke="#0d4a5c" stroke-width="2"/><circle cx="32" cy="36" r="5" fill="#bff6ff"/>
      <path d="M14 22 C22 12 42 12 50 22 M8 15 C20 2 44 2 56 15" stroke="#7fe7ff" stroke-width="3.4" fill="none" stroke-linecap="round"/>
      <path d="M26 50 L22 60 M38 50 L42 60" stroke="#46525e" stroke-width="3.4" stroke-linecap="round"/>`, `<radialGradient id="iss" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#7fe7ff"/><stop offset="1" stop-color="#0f6d86"/></radialGradient>`),
    dyn: s(`<g transform="rotate(-18 32 38)"><rect x="14" y="26" width="10" height="30" rx="3" fill="url(#idr)"/><rect x="27" y="24" width="10" height="32" rx="3" fill="url(#idr)"/><rect x="40" y="26" width="10" height="30" rx="3" fill="url(#idr)"/>
      <rect x="12" y="38" width="40" height="5" fill="#3a2a18"/></g>
      <path d="M33 22 C36 14 42 14 44 8" stroke="#3a2a18" stroke-width="2.2" fill="none"/><circle cx="45" cy="7" r="5" fill="#ffdd57"/><circle cx="45" cy="7" r="2.6" fill="#fff"/>
      <path d="M45 0 v3 M51 2 l-2 2.4 M53 8 h-3 M39 2 l2 2.4" stroke="#ffb347" stroke-width="2" stroke-linecap="round"/>`, lg('idr', '#ff6b4a', '#a0200f', 1, 0)),
    coin: s(`<circle cx="32" cy="33" r="25" fill="#7a4a08"/><circle cx="32" cy="31" r="25" fill="url(#icg)" stroke="#9a6410" stroke-width="2"/><circle cx="32" cy="31" r="18" fill="none" stroke="#a86d12" stroke-opacity=".6" stroke-width="2"/>
      <path d="M25 22 h14 c0 9 -4 13 -6 14 v4 c3 0 5 1 5 3 h-12 c0 -2 2 -3 5 -3 v-4 c-2 -1 -6 -5 -6 -14z" fill="#a86d12" fill-opacity=".8"/><ellipse cx="24" cy="18" rx="8" ry="3.4" fill="#fff" opacity=".55" transform="rotate(-30 24 18)"/>`, gold('icg')),
    bolt: s(`<path d="M36 4 L12 36 H30 L26 60 L52 26 H34 Z" fill="url(#ieb)" stroke="#0d5a72" stroke-width="2" stroke-linejoin="round"/><path d="M34 10 L19 32" stroke="#fff" stroke-opacity=".7" stroke-width="2"/>`, lg('ieb', '#d6fbff', '#18a6d8')),
    star: s(`<path d="M32 4 L40 23 L60 24 L44 37 L50 58 L32 46 L14 58 L20 37 L4 24 L24 23 Z" fill="url(#ist)" stroke="#9a6410" stroke-width="2" stroke-linejoin="round"/><path d="M26 22 L32 9" stroke="#fff" stroke-opacity=".7" stroke-width="2"/>`, gold('ist')),
    map: s(`<path d="M6 14 L22 8 L42 14 L58 8 V50 L42 56 L22 50 L6 56 Z" fill="url(#imp)" stroke="#7a5228" stroke-width="2" stroke-linejoin="round"/><path d="M22 8 V50 M42 14 V56" stroke="#7a5228" stroke-opacity=".4" stroke-width="1.6"/>
      <path d="M12 44 C18 36 24 40 28 32 C32 24 38 28 44 22" stroke="#8a3a1a" stroke-width="2.2" stroke-dasharray="3 3" fill="none"/><path d="M45 17 l7 7 M52 17 l-7 7" stroke="#d8321e" stroke-width="3" stroke-linecap="round"/>`, lg('imp', '#fbefcf', '#d4b077')),
    museum: s(`<path d="M6 24 L32 8 L58 24 Z" fill="url(#imu)" stroke="#7a5a2a" stroke-width="2" stroke-linejoin="round"/><rect x="8" y="24" width="48" height="5" fill="#e8d6ae"/>
      ${[13, 23, 33, 43].map((x) => `<rect x="${x}" y="30" width="8" height="20" fill="url(#imc)"/>`).join('')}<rect x="6" y="50" width="52" height="6" rx="1" fill="#c9b07a"/><circle cx="32" cy="18" r="3" fill="#f6c444"/>`, lg('imu', '#fff2cf', '#d9bb7c') + lg('imc', '#fffaf0', '#c9b48a', 1, 0)),
    camp: s(`<path d="M4 54 L32 8 L60 54 Z" fill="url(#ict)" stroke="#6a4a1c" stroke-width="2" stroke-linejoin="round"/><path d="M32 8 L44 54 H60 Z" fill="#000" opacity=".18"/>
      <path d="M24 54 L32 30 L40 54 Z" fill="#2a1a0a"/><path d="M32 8 V2 L42 5 L32 8" fill="#e74c3c"/><path d="M2 56 H62" stroke="#6a4a1c" stroke-width="3" stroke-linecap="round"/>`, lg('ict', '#f6e3b8', '#c49a5a', 1, 1)),
    vase: s(`<path d="M24 6 h16 v5 h-2 v8 C50 24 54 34 52 44 C50 54 42 60 32 60 C22 60 14 54 12 44 C10 34 14 24 26 19 v-8 h-2z" fill="url(#iva)" stroke="#6b2c12" stroke-width="2"/>
      <path d="M14 38 H50 M15 44 H49" stroke="#3a1608" stroke-width="2.4"/><path d="M18 41 l4 -3 4 3 4 -3 4 3 4 -3 4 3 4 -3 4 3" stroke="#3a1608" stroke-width="1.6" fill="none"/><path d="M20 28 C18 36 20 46 26 52" stroke="#fff" stroke-opacity=".4" stroke-width="3" fill="none"/>`, lg('iva', '#f0a46a', '#9a4a1e', 1, 0)),
    soundOn: s(`<path d="M8 24 H20 L34 12 V52 L20 40 H8 Z" fill="#f6ead6"/><path d="M42 22 C47 27 47 37 42 42 M48 16 C57 25 57 39 48 48" stroke="#f6ead6" stroke-width="4" fill="none" stroke-linecap="round"/>`),
    soundOff: s(`<path d="M8 24 H20 L34 12 V52 L20 40 H8 Z" fill="#c4ad8c"/><path d="M42 24 L56 40 M56 24 L42 40" stroke="#ff6b5b" stroke-width="4" stroke-linecap="round"/>`),
    music: s(`<path d="M24 46 V14 L52 8 V40" stroke="#f6ead6" stroke-width="4" fill="none" stroke-linejoin="round"/><ellipse cx="18" cy="47" rx="8" ry="6" fill="#f6ead6"/><ellipse cx="46" cy="41" rx="8" ry="6" fill="#f6ead6"/>`),
    musicOff: s(`<path d="M24 46 V14 L52 8 V40" stroke="#8a7a62" stroke-width="4" fill="none" stroke-linejoin="round"/><ellipse cx="18" cy="47" rx="8" ry="6" fill="#8a7a62"/><ellipse cx="46" cy="41" rx="8" ry="6" fill="#8a7a62"/><path d="M8 8 L56 56" stroke="#ff6b5b" stroke-width="4" stroke-linecap="round"/>`),
    close: s(`<path d="M16 16 L48 48 M48 16 L16 48" stroke="#f6ead6" stroke-width="6" stroke-linecap="round"/>`),
    lock: s(`<rect x="12" y="28" width="40" height="30" rx="6" fill="url(#ilk)" stroke="#6b4a10" stroke-width="2"/><path d="M20 28 V20 C20 6 44 6 44 20 V28" stroke="#c9ced6" stroke-width="6" fill="none"/><circle cx="32" cy="42" r="4" fill="#5a3a08"/><rect x="30" y="42" width="4" height="8" fill="#5a3a08"/>`, gold('ilk')),
    trophy: s(`<path d="M18 8 H46 V22 C46 32 40 38 32 38 C24 38 18 32 18 22 Z" fill="url(#itr)" stroke="#9a6410" stroke-width="2"/><path d="M18 14 H8 C8 24 14 28 20 28 M46 14 H56 C56 24 50 28 44 28" stroke="#d9a32a" stroke-width="3.4" fill="none"/>
      <rect x="28" y="38" width="8" height="10" fill="#c48a1c"/><rect x="18" y="48" width="28" height="8" rx="2" fill="url(#itr)" stroke="#9a6410" stroke-width="2"/>`, gold('itr')),
  };

  /* illustrated landscape per site (viewBox 400×170) */
  function scene(site, eraColors) {
    const id = 'sc' + site.id;
    const [s0, s1] = site.sky;
    const sea = (y) => `<rect x="0" y="${y}" width="400" height="${110 - y}" fill="url(#${id}sea)"/>` + [0, 1, 2, 3].map((i) => `<path d="M${20 + i * 90} ${y + 8 + i % 2 * 6} q10 -4 20 0 t20 0" stroke="#fff" stroke-opacity=".35" stroke-width="2" fill="none"/>`).join('');
    const parts = {
      yard: `<path d="M0 98 Q100 70 200 92 T400 86 V110 H0Z" fill="#7a8a4a"/><rect x="226" y="58" width="70" height="44" fill="#e8d2a8"/><path d="M220 60 L261 34 L302 60Z" fill="#a8502a"/><rect x="252" y="76" width="16" height="26" fill="#6a3a1a"/><rect x="234" y="68" width="12" height="12" fill="#4a6a8a"/><rect x="276" y="68" width="12" height="12" fill="#4a6a8a"/>
        <path d="M110 104 C108 84 112 74 116 64" stroke="#5a3a1a" stroke-width="7" fill="none"/><ellipse cx="116" cy="56" rx="34" ry="22" fill="#5a7a3a"/><ellipse cx="102" cy="50" rx="18" ry="12" fill="#6f9248"/><ellipse cx="132" cy="48" rx="16" ry="11" fill="#6f9248"/>
        ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<rect x="${310 + i * 10}" y="88" width="3" height="16" fill="#8a6a3a"/>`).join('')}<path d="M308 92 H398" stroke="#8a6a3a" stroke-width="2"/>`,
      akko: sea(84) + `<path d="M150 104 V54 H330 V104Z" fill="#d6b88a"/>${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<rect x="${150 + i * 20}" y="46" width="12" height="10" fill="#d6b88a"/>`).join('')}
        <rect x="226" y="20" width="12" height="40" fill="#e8d2a8"/><path d="M226 20 L232 8 L238 20Z" fill="#3a8a7a"/><ellipse cx="282" cy="54" rx="26" ry="20" fill="#3a8a7a"/><rect x="256" y="54" width="52" height="10" fill="#d6b88a"/>
        ${[0, 1, 2, 3].map((i) => `<path d="M${164 + i * 34} 104 V86 a10 10 0 0 1 20 0 V104" fill="#7a5a3a"/>`).join('')}<path d="M40 96 L70 96 L64 104 L46 104Z" fill="#6a4a2a"/><path d="M55 96 V70 L72 92Z" fill="#f4ead6"/>`,
      caesarea: sea(80) + `${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<path d="M${120 + i * 34} 104 V70 H${154 + i * 34} V104 H${148 + i * 34} V86 a11 11 0 0 0 -22 0 V104Z" fill="#cfb183"/>`).join('')}
        <rect x="118" y="62" width="276" height="9" fill="#bfa070"/><path d="M20 104 a60 50 0 0 1 120 0Z" fill="#d8c09a"/>${[0, 1, 2, 3].map((i) => `<path d="M${30 + i * 8} 104 a${50 - i * 8} ${42 - i * 7} 0 0 1 ${100 - i * 16} 0" stroke="#a8875a" stroke-width="2" fill="none"/>`).join('')}
        <rect x="350" y="40" width="8" height="30" fill="#efe2c4"/><rect x="364" y="46" width="8" height="24" fill="#efe2c4"/>`,
      david: `<path d="M0 104 L0 82 Q60 66 130 76 T260 70 T400 78 V104Z" fill="#c9ad7a"/><path d="M60 104 V60 H340 V104Z" fill="#e2cfa2"/>${Array.from({ length: 14 }, (_, i) => `<rect x="${60 + i * 20}" y="52" width="12" height="10" fill="#e2cfa2"/>`).join('')}
        <rect x="90" y="34" width="34" height="70" fill="#d6c094"/>${[0, 1, 2].map((i) => `<rect x="${90 + i * 13}" y="26" width="8" height="10" fill="#d6c094"/>`).join('')}<rect x="102" y="52" width="10" height="16" rx="5" fill="#5a4a3a"/>
        <ellipse cx="236" cy="40" rx="24" ry="22" fill="url(#${id}gold)"/><rect x="210" y="40" width="52" height="20" fill="#3a6aa8"/><rect x="232" y="12" width="4" height="10" fill="#c9a24a"/>
        <path d="M186 104 V86 a14 14 0 0 1 28 0 V104" fill="#5a4a3a"/><path d="M300 104 C300 86 302 78 304 70" stroke="#4a3a1a" stroke-width="4"/><path d="M304 70 C290 62 286 66 280 70 M304 70 C316 60 322 64 328 68 M304 70 C298 56 300 52 304 48 M304 70 C312 56 316 56 320 58" stroke="#4f7a3a" stroke-width="4" fill="none"/>`,
      qumran: `<path d="M0 104 L0 40 L40 30 L80 42 L120 28 L170 36 L220 24 L270 34 L320 22 L360 30 L400 26 V104Z" fill="url(#${id}cliff)"/>
        <path d="M0 60 L60 56 L130 64 L200 58 L280 66 L400 58" stroke="#8a5a2a" stroke-opacity=".5" stroke-width="2" fill="none"/><path d="M0 80 L90 76 L170 84 L260 78 L400 82" stroke="#8a5a2a" stroke-opacity=".5" stroke-width="2" fill="none"/>
        <ellipse cx="96" cy="66" rx="12" ry="10" fill="#2a160a"/><ellipse cx="236" cy="54" rx="15" ry="12" fill="#2a160a"/><ellipse cx="320" cy="72" rx="10" ry="8" fill="#2a160a"/><ellipse cx="166" cy="86" rx="9" ry="7" fill="#2a160a"/>
        <path d="M0 104 Q200 92 400 104Z" fill="#d8b07a"/><rect x="232" y="56" width="8" height="10" rx="3" fill="#e8d6ae"/>`,
      megiddo: `<path d="M0 104 Q70 92 120 94 Q160 52 200 48 L280 50 Q320 56 340 94 Q370 92 400 96 V104Z" fill="url(#${id}tel)"/>
        ${[0, 1, 2, 3].map((i) => `<path d="M${170 + i * 10} ${60 + i * 9} H${300 - i * 8}" stroke="#7a5a32" stroke-width="2.4"/>`).join('')}<rect x="214" y="58" width="40" height="34" fill="#5a3a1a" opacity=".5"/>
        <path d="M60 104 C60 86 62 76 64 66" stroke="#5a3a1a" stroke-width="4"/><path d="M64 66 C50 56 44 60 38 66 M64 66 C76 54 84 58 90 62 M64 66 C58 52 60 48 64 42 M64 66 C72 52 78 52 82 54" stroke="#4f7a3a" stroke-width="4.4" fill="none"/>
        <rect x="236" y="34" width="4" height="16" fill="#3a2a18"/><path d="M240 34 L252 38 L240 42" fill="#e74c3c"/>`,
      carmel: `<path d="M0 104 L0 50 Q60 20 140 30 Q220 14 300 26 Q360 34 400 44 V104Z" fill="url(#${id}mt)"/>
        <path d="M150 104 V78 C150 52 210 52 210 78 V104Z" fill="#1a0e06"/><path d="M156 104 V80 C156 60 204 60 204 80" stroke="#7a6a4a" stroke-width="3" fill="none"/>
        ${[[50, 56], [80, 46], [300, 42], [336, 52], [370, 58], [260, 40]].map(([x, y]) => `<path d="M${x} ${y + 26} V${y + 12}" stroke="#4a3a1a" stroke-width="3"/><ellipse cx="${x}" cy="${y + 8}" rx="12" ry="10" fill="#4f7a3a"/>`).join('')}
        <circle cx="178" cy="90" r="5" fill="#ff8a3d" opacity=".85"/><circle cx="178" cy="90" r="14" fill="#ff8a3d" opacity=".18"/>`,
    };
    const strata = (eraColors || []).map((c, i, a) => `<rect x="0" y="${110 + (i * 60) / a.length}" width="400" height="${60 / a.length + 1}" fill="${c}"/>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 170" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
      <linearGradient id="${id}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s0}"/><stop offset="1" stop-color="${s1}"/></linearGradient>
      <linearGradient id="${id}sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3aa0c8"/><stop offset="1" stop-color="#1a5a86"/></linearGradient>
      <linearGradient id="${id}cliff" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2a868"/><stop offset="1" stop-color="#a8642e"/></linearGradient>
      <linearGradient id="${id}tel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8a06a"/><stop offset="1" stop-color="#8a6236"/></linearGradient>
      <linearGradient id="${id}mt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a8a5a"/><stop offset="1" stop-color="#4a5a32"/></linearGradient>
      <radialGradient id="${id}gold" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fff2b0"/><stop offset=".6" stop-color="#e8b23a"/><stop offset="1" stop-color="#9a6a12"/></radialGradient>
      <radialGradient id="${id}sun" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fffbe6"/><stop offset=".3" stop-color="#ffe9a8" stop-opacity=".9"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
      </defs><rect width="400" height="110" fill="url(#${id}sky)"/><circle class="sun" cx="330" cy="34" r="46" fill="url(#${id}sun)"/>
      <g class="clouds" fill="#fff" opacity=".55"><ellipse cx="80" cy="26" rx="34" ry="8"/><ellipse cx="100" cy="21" rx="20" ry="8"/><ellipse cx="250" cy="18" rx="26" ry="6"/></g>
      <path d="M0 80 Q80 56 160 70 T320 62 T400 66 V110 H0Z" fill="#000" opacity=".12"/>${parts[site.id] || ''}
      <rect x="0" y="104" width="400" height="7" fill="#5a7a3a"/>${strata}
      <rect x="0" y="110" width="400" height="60" fill="url(#${id}sky)" opacity=".0"/></svg>`;
  }

  window.SHCHAVOT_ICONS = { ICONS, scene };
})();
