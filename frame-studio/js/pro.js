/* The professional editor's extras: a status bar under the photo (name, place in the set, pixels, print size, zoom,
   where the AI runs) and a keyboard shortcuts sheet (?), plus a few more shortcuts: [ and ] for the previous / next photo,
   0 to fit, + and − to zoom, \ held to compare with the original. */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, S = FS.state, stage = $('#stage'); if (!stage) return;
  var bar = document.createElement('div'); bar.className = 'pro-status'; bar.setAttribute('role', 'status'); bar.setAttribute('aria-live', 'off');
  stage.appendChild(bar); stage.classList.add('has-status');
  function aiWhere() {
    var mode = ''; try { mode = localStorage.getItem('fs-ai-mode') || ''; } catch (e) { /* private mode */ }
    var local = !!(window.FSDesktop && window.FSDesktop.localAI);
    if (local && mode === 'local') return ['<span class="dot"></span>AI מקומי', ''];
    if (!navigator.onLine) return local ? ['<span class="dot"></span>AI מקומי (אין רשת)', ''] : ['<span class="dot off"></span>AI: אין רשת', 'off'];
    return ['<span class="dot"></span>AI בענן' + (local && mode !== 'cloud' ? ' · מקומי כגיבוי' : ''), ''];
  }
  function esc(s) { return FS.esc ? FS.esc(s) : String(s); }
  function draw() {
    var p = FS.cur(), info = ($('#stage-info') || {}).textContent || '', n = S.photos.length;
    var parts = info.split(' · ').filter(Boolean);
    bar.innerHTML = (p ? '<span><b>' + esc(p.name || 'תמונה') + '</b></span><span>' + (S.cur + 1) + ' / ' + n + '</span>' + parts.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') : '<span>' + (n ? n + ' תמונות' : 'אין תמונות פתוחות') + '</span>') +
      '<span class="grow"></span><span>' + aiWhere()[0] + '</span><span><button type="button" id="pro-keys-btn" title="קיצורי מקלדת">? קיצורים</button></span>';
    var kb = $('#pro-keys-btn'); if (kb) kb.addEventListener('click', keys);
  }
  var t = 0; function soon() { clearTimeout(t); t = setTimeout(draw, 60); }
  var si = $('#stage-info'); if (si && window.MutationObserver) new MutationObserver(soon).observe(si, { childList: true, characterData: true, subtree: true });
  ['doc', 'photos-added', 'history'].forEach(function (e) { FS.on(e, soon); });
  window.addEventListener('online', soon); window.addEventListener('offline', soon); window.addEventListener('storage', soon);
  setInterval(soon, 5000);
  draw();

  var sheet = null;
  function keys() {
    if (!sheet) {
      sheet = document.createElement('div'); sheet.className = 'pro-keys'; sheet.hidden = true; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-label', 'קיצורי מקלדת');
      var K = [['Ctrl', 'Z', 'ביטול'], ['Ctrl', 'Y', 'חזרה'], ['Ctrl', 'S', 'שמירה'], ['Ctrl', 'P', 'הדפסה'], ['[', ']', 'התמונה הקודמת / הבאה'], ['+', '−', 'זום פנימה / החוצה'], ['0', '', 'התאמה למסך'],
        ['\\', '', 'החזקה: השוואה למקור'], ['חצים', '', 'הזזת התמונה או השכבה (Shift: צעד גדול)'], ['Ctrl', 'D', 'שכפול שכבה'], ['Delete', '', 'מחיקת שכבה'], ['Esc', '', 'ביטול בחירה / סגירה'], ['?', '', 'החלון הזה']];
      sheet.innerHTML = '<div class="pro-keys-card"><h2>קיצורי מקלדת</h2><dl>' + K.map(function (k) { return '<dt><kbd>' + esc(k[0]) + '</kbd>' + (k[1] ? (k[0] === 'Ctrl' ? '+' : ' ') + '<kbd>' + esc(k[1]) + '</kbd>' : '') + '</dt><dd>' + esc(k[2]) + '</dd>'; }).join('') + '</dl><p class="hint" style="margin-top:16px">לחיצה בכל מקום סוגרת.</p></div>';
      sheet.addEventListener('click', function () { sheet.hidden = true; });
      document.body.appendChild(sheet);
    }
    sheet.hidden = !sheet.hidden;
  }
  var cmp = $('#compare');
  document.addEventListener('keydown', function (e) {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key;
    if (k === '?') { e.preventDefault(); keys(); }
    else if (k === 'Escape' && sheet && !sheet.hidden) sheet.hidden = true;
    else if ((k === '[' || k === ']') && S.photos.length > 1 && FS.select) { e.preventDefault(); var i = (S.cur + (k === ']' ? 1 : -1) + S.photos.length) % S.photos.length; FS.select(i); }
    else if (k === '0') { var f = $('#zoom-fit'); if (f) { e.preventDefault(); f.click(); } }
    else if (k === '+' || k === '=') { var zi = $('#zoom-in'); if (zi) { e.preventDefault(); zi.click(); } }
    else if (k === '-' || k === '_') { var zo = $('#zoom-out'); if (zo) { e.preventDefault(); zo.click(); } }
    else if (k === '\\' && cmp && !e.repeat) { e.preventDefault(); cmp.dispatchEvent(new PointerEvent('pointerdown')); }
  });
  document.addEventListener('keyup', function (e) { if (e.key === '\\' && cmp) cmp.dispatchEvent(new PointerEvent('pointerup')); });
})();
