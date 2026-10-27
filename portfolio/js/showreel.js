/* The film at the top of the page: it starts by itself (muted, in a loop), the visitor can switch language, turn the sound on, open it
   full screen, download it to post, or copy the link to the site. The films are listed in media.json under "showreel". */
(function () {
  'use strict';
  var box = document.getElementById('reel'); if (!box) return;
  var SITE = 'https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/';
  function el(tag, attrs, kids) { var n = document.createElement(tag); Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]); }); (kids || []).forEach(function (c) { if (c) n.appendChild(c); }); return n; }
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  fetch('media.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (m) {
    var list = (m.showreel || []).filter(function (x) { return x && x.url; }); if (!list.length) return;
    var cur = get('reel-lang') === 'en' && list.some(function (x) { return x.lang === 'en'; }) ? 'en' : (list[0].lang || 'he');
    var by = function (l) { return list.filter(function (x) { return x.lang === l; })[0] || list[0]; };
    var v = el('video', { muted: '', loop: '', playsinline: '', autoplay: '', preload: 'auto', 'aria-label': 'הדמיה של האתר' }); v.muted = true; v.loop = true;
    var snd = el('button', { type: 'button', class: 'reel-snd', 'aria-label': 'הפעלת קול', title: 'הפעלת קול', text: '🔇' });
    var title = el('h2'), desc = el('p');
    var langs = el('div', { class: 'reel-lang', role: 'group', 'aria-label': 'שפה' });
    var dl = el('a', { class: 'main', href: '#', download: '', text: '⬇ הורדת הסרטון' });
    var full = el('button', { type: 'button', text: '⛶ מסך מלא' });
    var cp = el('button', { type: 'button', text: '🔗 העתקת קישור לאתר' });
    var go = el('a', { href: SITE, target: '_blank', rel: 'noopener', text: 'לכניסה לאתר ↗' });
    function load(l, keep) {
      var x = by(l); cur = x.lang; var t = keep ? v.currentTime : 0;
      v.poster = x.poster || ''; v.src = x.url; title.textContent = x.title; desc.textContent = x.desc || ''; dl.href = x.url; dl.setAttribute('download', x.url.split('/').pop());
      Array.prototype.forEach.call(langs.children, function (b) { b.setAttribute('aria-pressed', String(b.dataset.l === cur)); });
      v.addEventListener('loadedmetadata', function once() { v.removeEventListener('loadedmetadata', once); try { if (t) v.currentTime = t; } catch (e) {} }, { once: true });
      var p = v.play(); if (p && p.catch) p.catch(function () {});
    }
    list.forEach(function (x) { var b = el('button', { type: 'button', 'data-l': x.lang, text: x.lang === 'en' ? 'English' : 'עברית' }); b.addEventListener('click', function () { set('reel-lang', x.lang); load(x.lang, false); }); langs.appendChild(b); });
    snd.addEventListener('click', function () { v.muted = !v.muted; snd.textContent = v.muted ? '🔇' : '🔊'; snd.title = v.muted ? 'הפעלת קול' : 'השתקה'; snd.setAttribute('aria-label', snd.title); if (!v.muted) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } });
    full.addEventListener('click', function () { var f = v.requestFullscreen || v.webkitRequestFullscreen; if (f) { v.muted = false; snd.textContent = '🔊'; f.call(v); } else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen(); });
    cp.addEventListener('click', function () {
      var done = function () { cp.textContent = '✓ הקישור הועתק'; setTimeout(function () { cp.textContent = '🔗 העתקת קישור לאתר'; }, 2200); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(SITE).then(done, function () { prompt('הקישור לאתר:', SITE); }); else prompt('הקישור לאתר:', SITE);
    });
    var card = el('div', { class: 'reel-card' }, [
      el('div', { class: 'reel-vid' }, [v, snd]),
      el('div', { class: 'reel-txt' }, [el('p', { class: 'eyebrow', text: 'הדמיה · 1:19' }), title, desc, langs, el('div', { class: 'reel-acts' }, [go, dl, full, cp])])
    ]);
    box.replaceChildren(card); box.hidden = false;
    load(cur, false);
    // a film that autoplay blocked starts on the first touch
    document.addEventListener('pointerdown', function kick() { document.removeEventListener('pointerdown', kick); if (v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } }, { once: true });
  }).catch(function () {});
})();
