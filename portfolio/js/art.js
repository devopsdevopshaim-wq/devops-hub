// Line illustrations for each project category. Drawn on a 160x100 grid with
// round caps so they read as hand-drawn; colors come from CSS (--c is the
// category hue, --c2 the brass accent).
window.PORTFOLIO_ART = (function () {
  var s = 'fill="none" stroke="var(--c)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
  var g = 'fill="none" stroke="var(--c2)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
  var dot = function (x, y, r, c) { return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="var(' + (c || '--c2') + ')"/>'; };

  var art = {
    web:
      '<rect x="22" y="16" width="92" height="64" rx="8" ' + s + '/>' +
      '<path d="M22 30h92" ' + s + '/>' + dot(31, 23, 2.2) + dot(39, 23, 2.2, '--c') + dot(47, 23, 2.2, '--c') +
      '<path d="M34 44h36M34 54h26M34 64h32" ' + s + ' opacity=".55"/>' +
      '<circle cx="118" cy="62" r="22" ' + g + '/>' +
      '<path d="M96 62h44M118 40c-9 12-9 32 0 44M118 40c9 12 9 32 0 44" ' + g + '/>' +
      '<path d="M84 70l6 16 3-7 7-3z" fill="var(--c)" opacity=".9"/>',
    ai:
      '<path d="M58 84V70c-12-3-20-14-20-28 0-17 14-30 32-30s32 12 32 28c0 4 5 8 7 12l-7 3v9c0 5-4 8-9 8h-7v12" ' + s + '/>' +
      '<path d="M58 34h14l6 8h10M64 50h18M72 42v16l8 6" ' + g + '/>' +
      dot(58, 34, 3) + dot(88, 42, 3) + dot(64, 50, 3) + dot(80, 64, 3) +
      '<path d="M122 26l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="var(--c2)"/>' +
      '<path d="M134 56l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="var(--c)" opacity=".8"/>',
    tools:
      '<rect x="24" y="18" width="46" height="66" rx="7" ' + s + '/>' +
      '<rect x="32" y="26" width="30" height="14" rx="3" ' + g + '/>' +
      dot(36, 52, 3, '--c') + dot(47, 52, 3, '--c') + dot(58, 52, 3, '--c') +
      dot(36, 63, 3, '--c') + dot(47, 63, 3, '--c') + dot(58, 63, 3) +
      dot(36, 74, 3, '--c') + dot(47, 74, 3, '--c') + dot(58, 74, 3, '--c') +
      '<circle cx="112" cy="50" r="16" ' + g + '/>' +
      '<path d="M112 26v6M112 68v6M88 50h6M130 50h6M95 33l4 4M125 63l4 4M95 67l4-4M125 37l4-4" ' + g + '/>' +
      '<circle cx="112" cy="50" r="5" ' + s + '/>',
    data:
      '<path d="M20 84h120M28 84V22M132 84V22M28 44h104M28 64h104" ' + s + '/>' +
      '<rect x="38" y="28" width="18" height="16" rx="2" ' + g + '/><rect x="60" y="32" width="14" height="12" rx="2" ' + s + '/>' +
      '<rect x="92" y="48" width="22" height="16" rx="2" ' + g + '/><rect x="42" y="50" width="16" height="14" rx="2" ' + s + '/>' +
      '<rect x="64" y="70" width="10" height="14" rx="1.5" fill="var(--c)" opacity=".5"/><rect x="78" y="66" width="10" height="18" rx="1.5" fill="var(--c)" opacity=".75"/>' +
      '<rect x="92" y="72" width="10" height="12" rx="1.5" fill="var(--c2)"/>',
    lotto:
      '<circle cx="50" cy="56" r="20" ' + s + '/><circle cx="92" cy="44" r="16" ' + g + '/><circle cx="120" cy="68" r="13" ' + s + '/>' +
      '<text x="50" y="63" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="18" fill="var(--c)">7</text>' +
      '<text x="92" y="50" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="15" fill="var(--c2)">21</text>' +
      '<text x="120" y="73" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="12" fill="var(--c)">36</text>' +
      '<path d="M128 22l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="var(--c2)"/>' + dot(26, 28, 2.5) + dot(140, 90, 2, '--c'),
    study:
      '<path d="M80 30c-14-8-34-9-50-4v56c16-5 36-4 50 4 14-8 34-9 50-4V26c-16-5-36-4-50 4z" ' + s + '/>' +
      '<path d="M80 30v56" ' + s + '/>' +
      '<path d="M40 40c10-2 22-1 30 3M40 52c10-2 22-1 30 3M40 64c10-2 22-1 30 3" ' + g + ' opacity=".8"/>' +
      '<path d="M90 43c8-4 20-5 30-3M90 55c8-4 20-5 30-3" ' + s + ' opacity=".55"/>' +
      '<path d="M112 8l2.4 6.6 6.6 2.4-6.6 2.4-2.4 6.6-2.4-6.6-6.6-2.4 6.6-2.4z" fill="var(--c2)"/>',
    devops:
      '<rect x="26" y="16" width="56" height="18" rx="4" ' + s + '/><rect x="26" y="40" width="56" height="18" rx="4" ' + s + '/><rect x="26" y="64" width="56" height="18" rx="4" ' + s + '/>' +
      dot(36, 25, 2.6) + dot(36, 49, 2.6, '--c') + dot(36, 73, 2.6) + '<path d="M50 25h22M50 49h22M50 73h22" ' + s + ' opacity=".5"/>' +
      '<path d="M96 30c10-10 30-10 38 4M134 34l1-9M134 34l-9-1" ' + g + '/>' +
      '<path d="M134 68c-10 10-30 10-38-4M96 64l-1 9M96 64l9 1" ' + g + '/>' +
      '<rect x="104" y="40" width="22" height="18" rx="3" ' + s + '/><path d="M110 46l4 3-4 3M117 52h5" ' + s + '/>',
    other:
      '<rect x="30" y="14" width="40" height="72" rx="9" ' + s + '/><path d="M44 22h12" ' + s + '/>' +
      '<rect x="37" y="30" width="26" height="20" rx="3" ' + g + '/><path d="M37 58h26M37 66h18" ' + s + ' opacity=".6"/>' +
      '<rect x="84" y="30" width="56" height="38" rx="5" ' + s + '/>' +
      '<path d="M94 58l10-12 8 8 6-6 12 10" ' + g + '/><path d="M112 68v12M100 84h24" ' + s + '/>' + dot(128, 40, 3)
  };

  return function (category) {
    return '<svg viewBox="0 0 160 100" aria-hidden="true" focusable="false">' + (art[category] || art.web) + '</svg>';
  };
})();
