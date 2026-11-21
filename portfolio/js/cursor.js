/* A custom pointer: a brass dot that follows exactly and a ring that trails it softly. The ring grows over anything
   clickable, takes the shape of small round buttons, and squeezes on press. Mouse and trackpad only: touch, reduced
   motion and the "no animations" accessibility switch keep the normal cursor. */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  var calm = matchMedia('(prefers-reduced-motion: reduce)');
  function off() { return calm.matches || root.classList.contains('a11y-calm'); }

  var HOT = 'a, button, [role="button"], [role="tab"], label, select, summary, .chip, .node, input[type="range"], input[type="checkbox"], input[type="radio"]';
  var TEXT = 'input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), textarea, [contenteditable="true"]';

  var dot = doc.createElement('div'), ring = doc.createElement('div');
  dot.className = 'cur-dot'; ring.className = 'cur-ring';
  dot.setAttribute('aria-hidden', 'true'); ring.setAttribute('aria-hidden', 'true');

  var mx = -100, my = -100, rx = -100, ry = -100, rw = 34, rh = 34, tw = 34, th = 34, rr = 17, tr = 17, raf = 0, snap = null;

  function target(e) {
    var t = e.target && e.target.closest ? e.target : null;
    var text = t && t.closest(TEXT), hot = !text && t && t.closest(HOT);
    root.classList.toggle('cur-text', !!text);
    ring.classList.toggle('hot', !!hot);
    snap = null;
    if (hot) {
      var b = hot.getBoundingClientRect(), s = getComputedStyle(hot);
      // small round things (the rail, icon buttons): the ring wraps them exactly
      if (b.width <= 64 && b.height <= 64 && Math.abs(b.width - b.height) < 8 && parseFloat(s.borderRadius) >= b.width / 3) snap = hot;
    }
  }

  function loop() {
    var x = mx, y = my;
    if (snap) {
      var b = snap.getBoundingClientRect();
      x = b.left + b.width / 2; y = b.top + b.height / 2;
      tw = b.width + 12; th = b.height + 12; tr = Math.max(tw, th) / 2;
    } else if (ring.classList.contains('hot')) { tw = th = 56; tr = 28; }
    else { tw = th = 34; tr = 17; }
    if (ring.classList.contains('down')) { tw *= .82; th *= .82; }
    rx += (x - rx) * .2; ry += (y - ry) * .2;
    rw += (tw - rw) * .25; rh += (th - rh) * .25; rr += (tr - rr) * .25;
    dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
    ring.style.transform = 'translate3d(' + (rx - rw / 2) + 'px,' + (ry - rh / 2) + 'px,0)';
    ring.style.width = rw + 'px'; ring.style.height = rh + 'px'; ring.style.borderRadius = rr + 'px';
    raf = requestAnimationFrame(loop);
  }

  function on() {
    var want = !off();
    if (root.classList.contains('has-cursor') !== want) root.classList.toggle('has-cursor', want);   // toggling only on change, or the observer below would wake itself forever
  }

  function init() {
    doc.body.appendChild(ring); doc.body.appendChild(dot);
    on();
    calm.addEventListener && calm.addEventListener('change', on);
    new MutationObserver(on).observe(root, { attributes: true, attributeFilter: ['class'] });
    doc.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY;
      if (!root.classList.contains('cur-in')) { rx = mx; ry = my; root.classList.add('cur-in'); }
    }, { passive: true });
    doc.addEventListener('mouseover', target, { passive: true });
    doc.addEventListener('mousedown', function () { ring.classList.add('down'); });
    doc.addEventListener('mouseup', function () { ring.classList.remove('down'); });
    // leaving the window, or entering an embedded player (it swallows mouse events)
    doc.addEventListener('mouseout', function (e) { if (!e.relatedTarget || e.relatedTarget.tagName === 'IFRAME') root.classList.remove('cur-in'); });
    doc.addEventListener('visibilitychange', function () {
      if (doc.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!raf) raf = requestAnimationFrame(loop);
    });
    raf = requestAnimationFrame(loop);
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
