/* The guests' gallery of one event (gallery.html?a=<album id>, the album the studio published to library/library.json):
   view, save one photo or all of them, and an invitation to book magnets for their own event. */
(function () {
  'use strict';
  var app = document.getElementById('app'), view = document.getElementById('view'), img = document.getElementById('view-img'), dl = document.getElementById('v-dl');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function safe(src) { src = String(src || ''); return /^library\/[\w֐-׿.\/-]+\.(jpe?g|png|webp)$/i.test(src) && src.indexOf('..') < 0 ? src : ''; }
  function toast(t) { var el = document.getElementById('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('on'); }, 2600); }
  var id = new URLSearchParams(location.search).get('a') || '', biz = {}, album = null, i = 0;
  function wa() { var n = String(biz.whatsapp || biz.phone || '').replace(/\D/g, ''); return n.charAt(0) === '0' ? '972' + n.slice(1) : n; }
  function cta() {
    var n = wa();
    return '<section class="card cta"><h2>רוצים מגנטים כאלה גם באירוע שלכם? 🧲</h2><p>' + esc(biz.name || 'פריים מגנטים') + (biz.phone ? ' · ' + esc(biz.phone) : '') + '</p><div class="gtools"><a class="gbtn main" href="./">לאתר ולחבילות</a>' +
      (n ? '<a class="gbtn" target="_blank" rel="noopener" href="https://wa.me/' + n + '?text=' + encodeURIComponent('היי! ראיתי את המגנטים באירוע' + (album ? ' "' + album.title + '"' : '') + ' ואשמח לבדוק תאריך 🧲') + '">💬 וואטסאפ</a>' : '') + '</div></section>';
  }
  function show(k) { var l = album.images; i = (k + l.length) % l.length; img.src = l[i].src; dl.href = l[i].src; dl.download = 'event-' + (i + 1) + '.jpg'; if (!view.open) view.showModal(); }
  document.getElementById('v-prev').onclick = function () { show(i - 1); };
  document.getElementById('v-next').onclick = function () { show(i + 1); };
  document.getElementById('v-x').onclick = function () { view.close(); };
  document.addEventListener('keydown', function (e) { if (!view.open) return; if (e.key === 'ArrowRight') show(i - 1); if (e.key === 'ArrowLeft') show(i + 1); });
  function saveAll() {
    var l = album.images;
    if (navigator.canShare && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
      toast('מכין את התמונות…');
      Promise.all(l.map(function (im, k) { return fetch(im.src).then(function (r) { return r.blob(); }).then(function (b) { return new File([b], 'event-' + (k + 1) + '.jpg', { type: 'image/jpeg' }); }); })).then(function (files) {
        if (navigator.canShare({ files: files })) return navigator.share({ files: files, title: album.title });
        throw new Error('share');
      }).catch(function (e) { if (!e || e.name !== 'AbortError') one(0); });
      return;
    }
    function one(k) { if (k >= l.length) return; var a = document.createElement('a'); a.href = l[k].src; a.download = 'event-' + (k + 1) + '.jpg'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { one(k + 1); }, 350); }
    one(0); toast('⬇️ שומר ' + l.length + ' תמונות');
  }
  Promise.all([fetch('library/library.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }), fetch('business.json').then(function (r) { return r.json(); }).catch(function () { return {}; })]).then(function (r) {
    var list = (Array.isArray(r[0]) ? r[0] : []).map(function (a) { return Object.assign({}, a, { images: (a.images || []).map(function (im) { return { src: safe(im.src) }; }).filter(function (im) { return im.src; }) }); }).filter(function (a) { return a.images.length; });
    biz = r[1] || {}; album = list.filter(function (a) { return a.id === id; })[0] || null;
    if (!album) {
      app.innerHTML = '<header class="ghead"><h1>אלבומים מאירועים</h1><p>' + (id ? 'האלבום הזה כבר לא זמין. אלה האלבומים שיש:' : 'בחרו אירוע') + '</p></header>' +
        (list.length ? '<div class="galbums">' + list.map(function (a) { return '<a href="?a=' + encodeURIComponent(a.id) + '"><img loading="lazy" src="' + esc(a.images[0].src) + '" alt=""><b>' + esc(a.title) + '</b><small>' + a.images.length + ' תמונות</small></a>'; }).join('') + '</div>' : '<div class="card load">עוד אין אלבומים.</div>') + cta();
      return;
    }
    document.title = album.title + ' · התמונות מהאירוע';
    app.innerHTML = '<header class="ghead"><p>📸 ' + esc(biz.name || '') + '</p><h1>' + esc(album.title) + '</h1><p>' + album.images.length + ' תמונות' + (album.date ? ' · ' + new Date(album.date + 'T12:00:00').toLocaleDateString('he-IL') : '') + '</p>' +
      '<div class="gtools"><button class="gbtn main" id="all">⬇️ שמירת כל התמונות</button></div></header><div class="ggrid">' +
      album.images.map(function (im, k) { return '<button data-k="' + k + '" aria-label="תמונה ' + (k + 1) + '"><img loading="lazy" src="' + esc(im.src) + '" alt=""></button>'; }).join('') + '</div>' + cta();
    document.getElementById('all').onclick = saveAll;
    Array.prototype.forEach.call(app.querySelectorAll('[data-k]'), function (b) { b.onclick = function () { show(Number(b.dataset.k)); }; });
  });
})();
