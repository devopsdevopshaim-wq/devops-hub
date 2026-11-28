/* Accessibility glue (IS 5568 / WCAG 2.1 AA), for the program's many screens and the windows that open later:
   - a field's visible <label> is tied to its control when the markup didn't (".field > label" + one control, or a
     label right before a control);
   - a control or a button with no accessible name gets one from its title, placeholder or the text around it;
   - icon-only buttons (an emoji, an SVG, a "×") get their title as the name;
   - decorative images without alt get alt="" so a screen reader skips them.
   It never changes what is seen. It runs once at load and on every change to the page (MutationObserver, batched). */
(function () {
  'use strict';
  var seq = 0;
  function named(el) {
    if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return true;
    if (el.id) { try { if (document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) return true; } catch (e) { /* odd id */ } }
    if (el.closest('label')) return true;
    return false;
  }
  function textOf(n) { return (n && (n.textContent || '').replace(/\s+/g, ' ').trim()) || ''; }
  function fixControls(root) {
    root.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea').forEach(function (el) {
      if (named(el)) return;
      /* a label just before it, or the field's own label */
      var lab = el.previousElementSibling && el.previousElementSibling.tagName === 'LABEL' && !el.previousElementSibling.htmlFor ? el.previousElementSibling : null;
      if (!lab) { var f = el.closest('.field, .mp-step, .hub-in label, .row, .mt-row'); var l = f && f.querySelector(':scope > label:not([for])'); if (l && f.querySelectorAll('input:not([type=hidden]), select, textarea').length === 1) lab = l; }
      if (lab) { if (!el.id) el.id = 'a11y-' + (++seq); lab.htmlFor = el.id; return; }
      var host = el.parentElement, near = host && host.querySelector(':scope > label, :scope > span, :scope > b, :scope > em');
      var t = el.getAttribute('title') || el.getAttribute('placeholder') || (near && textOf(near)) || (el.tagName === 'SELECT' && el.options[0] && el.options[0].text) || '';
      if (t) el.setAttribute('aria-label', t.slice(0, 80));
    });
  }
  function fixButtons(root) {
    root.querySelectorAll('button, [role=button], a[href]').forEach(function (el) {
      if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return;
      var t = textOf(el).replace(/[\u{1F300}-\u{1FAFF}☀-➿️×✕✓⟲⟳⇋⇵◀▶<>|]/gu, '').trim();
      if (t.length >= 2) return;
      var name = el.getAttribute('title') || (el.querySelector('img[alt]') && el.querySelector('img[alt]').alt) || '';
      if (!name && /×|✕/.test(textOf(el))) name = 'סגירה';
      if (name) el.setAttribute('aria-label', name.slice(0, 80));
    });
  }
  function fixImages(root) { root.querySelectorAll('img:not([alt])').forEach(function (im) { im.setAttribute('alt', ''); }); }
  function fix(root) { try { fixControls(root); fixButtons(root); fixImages(root); } catch (e) { /* never in the way */ } }
  var pending = false;
  function later() { if (pending) return; pending = true; (window.requestIdleCallback || setTimeout)(function () { pending = false; fix(document); }); }
  function start() { fix(document); new MutationObserver(later).observe(document.body, { childList: true, subtree: true }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
