/* The site's "living" layer:
   - smooth scrolling (Lenis), a scroll progress line and a parallax night scene
   - background music from YouTube, bottom-left (stations are set in the admin screen)
   - today's headlines and a daily riddle, bottom-right
   - the videos section
   Everything here is optional: if a part fails, the rest of the site works as before. */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; }
  }
  function getJSON(u) { return fetch(u, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  function ago(iso) {
    if (!iso) return '';
    var m = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (m < 1) return 'עכשיו';
    if (m < 60) return 'לפני ' + m + ' דק׳';
    var h = Math.round(m / 60);
    if (h < 24) return h === 1 ? 'לפני שעה' : h === 2 ? 'לפני שעתיים' : 'לפני ' + h + ' שעות';
    var d = Math.round(h / 24);
    return d === 1 ? 'אתמול' : 'לפני ' + d + ' ימים';
  }

  // ================================================================ scroll
  var lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new window.Lenis({
      autoRaf: true, lerp: 0.09, wheelMultiplier: 0.95, anchors: { offset: -70 },
      prevent: function (node) { return !!(node.closest && node.closest('.detail, .guide, .mu-panel, .dk-panel, dialog, [data-lenis-prevent]')); }
    });
    // the project page is its own scroller: pause the page underneath
    new MutationObserver(function () {
      document.documentElement.classList.contains('detail-open') ? lenis.stop() : lenis.start();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }

  var bar = el('div', { class: 'scroll-bar', 'aria-hidden': 'true' });
  document.body.appendChild(bar);
  var nav = $('.nav');

  // night sky with two mountain ridges, moving at different speeds
  var scene = null, layers = [];
  if (document.body.classList.contains('has-scene')) {
    scene = el('div', { class: 'scene', 'aria-hidden': 'true' }, [
      el('div', { class: 'sc sky' }), el('div', { class: 'sc stars' }), el('div', { class: 'sc ridge far' }), el('div', { class: 'sc ridge near' }), el('div', { class: 'sc mist' })
    ]);
    document.body.insertBefore(scene, document.body.firstChild);
    layers = [[$('.sky', scene), 0.05], [$('.stars', scene), 0.09], [$('.ridge.far', scene), 0.2], [$('.ridge.near', scene), 0.34]];
  }
  var heroCopy = $('.hero-copy'), heroArt = $('.orbit');
  var mx = 0, my = 0;
  if (!reduce) {
    window.addEventListener('pointermove', function (e) {
      mx = e.clientX / window.innerWidth - 0.5; my = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });
  }

  var ticking = false;
  function frame() {
    ticking = false;
    var y = window.scrollY, h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, y / h) : 0) + ')';
    if (nav) nav.classList.toggle('scrolled', y > 30);
    if (scene && !reduce) {
      var vh = window.innerHeight, ye = Math.min(y, vh * 1.6);
      // as the page goes up, the mountains sink: nearer layers faster
      layers.forEach(function (l, i) {
        l[0].style.transform = 'translate3d(' + (mx * (i + 1) * -6).toFixed(1) + 'px,' + (ye * l[1] + my * (i + 1) * -4).toFixed(1) + 'px,0)';
      });
      scene.style.opacity = String(Math.max(0.28, 1 - y / (vh * 1.6)));
      if (heroCopy && y < vh * 1.2) heroCopy.style.transform = 'translate3d(0,' + (y * 0.12).toFixed(1) + 'px,0)';
      if (heroArt && y < vh * 1.2) heroArt.style.transform = 'translate3d(0,' + (y * -0.06).toFixed(1) + 'px,0)';
    }
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pointermove', onScroll, { passive: true });
  frame();

  // a quiet "scroll" cue under the hero buttons
  var cta = $('.hero .cta');
  if (cta && !reduce) {
    var cue = el('a', { class: 'scroll-cue', href: '#featured', 'aria-label': 'גללו למטה' }, [el('span', { class: 'mouse' }, [el('i')]), el('span', { text: 'גללו' })]);
    cta.parentNode.insertBefore(cue, cta.nextSibling);
    window.addEventListener('scroll', function () { cue.classList.toggle('gone', window.scrollY > 80); }, { passive: true });
  }

  // ================================================================ YouTube
  var ytReady = null;
  function loadYT() {
    if (ytReady) return ytReady;
    ytReady = new Promise(function (resolve) {
      if (window.YT && window.YT.Player) return resolve();
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () { if (prev) prev(); resolve(); };
      document.head.appendChild(el('script', { src: 'https://www.youtube.com/iframe_api' }));
    });
    return ytReady;
  }
  function ytParse(url) {
    url = String(url || '').trim();
    var list = (url.match(/[?&]list=([\w-]+)/) || [])[1];
    var id = (url.match(/(?:v=|youtu\.be\/|\/live\/|\/shorts\/|\/embed\/)([\w-]{11})/) || [])[1] || (/^[\w-]{11}$/.test(url) ? url : null);
    return id || list ? { id: id, list: list } : null;
  }

  // ================================================================ music (bottom-left)
  function music(stations) {
    stations = (stations || []).filter(function (s) { return ytParse(s.url); });
    if (!stations.length) return;
    var player = null, current = -1, playing = false;
    var vol = Number(store('music-vol') || 40);

    var pill = el('button', { class: 'mu-pill', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'mu-panel' }, [
      el('span', { class: 'eq', 'aria-hidden': 'true' }, [el('i'), el('i'), el('i'), el('i')]),
      el('span', { class: 'mu-label', text: 'מוזיקה' })
    ]);
    var chips = el('div', { class: 'mu-styles', role: 'group', 'aria-label': 'סגנון מוזיקה' });
    var status = el('p', { class: 'mu-now', role: 'status', text: 'בחרו סגנון, והמוזיקה תתחיל.' });
    var playBtn = el('button', { class: 'mu-btn', type: 'button', 'aria-label': 'נגינה', text: '▶' });
    var nextBtn = el('button', { class: 'mu-btn', type: 'button', 'aria-label': 'התחנה הבאה', text: '⏭' });
    var volIn = el('input', { type: 'range', min: '0', max: '100', value: String(vol), 'aria-label': 'עוצמה' });
    var frame = el('div', { class: 'mu-frame' }, [el('div', { id: 'mu-yt' })]);
    var panel = el('div', { class: 'mu-panel', id: 'mu-panel', role: 'dialog', 'aria-label': 'מוזיקה ברקע' }, [
      el('header', {}, [el('b', { text: '♫ מוזיקה ברקע' }), el('button', { class: 'x', type: 'button', 'aria-label': 'סגירה', text: '×' })]),
      chips, frame, status,
      el('div', { class: 'mu-ctrl' }, [playBtn, nextBtn, el('span', { class: 'vol', 'aria-hidden': 'true', text: '🔈' }), volIn]),
      el('p', { class: 'mu-note', text: 'המוזיקה מנוגנת מיוטיוב. אפשר לסגור את החלון והיא ממשיכה.' })
    ]);
    var box = el('div', { class: 'music' }, [panel, pill]);
    document.body.appendChild(box);

    stations.forEach(function (s, i) {
      var c = el('button', { class: 'chip', type: 'button', 'data-i': String(i), text: s.style, title: s.title || s.style });
      c.addEventListener('click', function () { play(i); });
      chips.appendChild(c);
    });

    function open(on) {
      box.classList.toggle('open', on);
      pill.setAttribute('aria-expanded', String(on));
    }
    pill.addEventListener('click', function () { open(!box.classList.contains('open')); });
    $('.x', panel).addEventListener('click', function () { open(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') open(false); });

    function setPlaying(on) {
      playing = on;
      box.classList.toggle('playing', on);
      playBtn.textContent = on ? '⏸' : '▶';
      playBtn.setAttribute('aria-label', on ? 'השהיה' : 'נגינה');
      $('.mu-label', pill).textContent = current >= 0 ? stations[current].style : 'מוזיקה';
    }
    function mark() {
      Array.prototype.forEach.call(chips.children, function (c, i) { c.setAttribute('aria-pressed', String(i === current)); });
    }

    function play(i) {
      current = (i + stations.length) % stations.length;
      store('music-last', String(current));
      mark();
      var s = stations[current], v = ytParse(s.url);
      status.textContent = 'טוען: ' + (s.title || s.style) + '…';
      loadYT().then(function () {
        if (!player) {
          player = new window.YT.Player('mu-yt', {
            width: '100%', height: '100%',
            playerVars: v.id ? { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 }
              : { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1, listType: 'playlist', list: v.list },
            videoId: v.id || undefined,
            events: {
              onReady: function (e) {
                e.target.setVolume(vol);
                e.target.playVideo();
              },
              onStateChange: function (e) {
                if (e.data === 1) { setPlaying(true); status.textContent = '♪ ' + (stations[current].title || stations[current].style); }
                else if (e.data === 2 || e.data === 0) setPlaying(false);
              },
              onError: function () {
                setPlaying(false);
                status.textContent = 'התחנה "' + stations[current].style + '" לא זמינה כרגע. נסו סגנון אחר.';
              }
            }
          });
        } else if (v.id) player.loadVideoById(v.id);
        else player.loadPlaylist({ list: v.list, listType: 'playlist' });
      });
    }

    playBtn.addEventListener('click', function () {
      if (!player) { play(current >= 0 ? current : Number(store('music-last') || 0)); return; }
      playing ? player.pauseVideo() : player.playVideo();
    });
    nextBtn.addEventListener('click', function () { play(current + 1); });
    volIn.addEventListener('input', function () {
      vol = Number(volIn.value); store('music-vol', String(vol));
      if (player && player.setVolume) player.setVolume(vol);
    });

    var last = Number(store('music-last'));
    if (store('music-last') !== null && stations[last]) {
      current = -1;
      status.textContent = 'בפעם הקודמת הקשבתם ל"' + stations[last].style + '". לחצו ▶ כדי להמשיך.';
    }
  }

  // ================================================================ news + riddles (bottom-right)
  function dock(news, riddles) {
    var main = (news && news.feeds && news.feeds.main) || [];
    var tech = (news && news.feeds && news.feeds.tech) || [];
    var list = (riddles && riddles.riddles) || [];
    if (!main.length && !tech.length && !list.length) return;
    document.body.classList.add('has-dock');

    var tick = el('span', { class: 'dk-tick' });
    var pill = el('button', { class: 'dk-pill', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'dk-panel' }, [
      el('span', { class: 'dk-ico', 'aria-hidden': 'true', text: main.length ? '📰' : '🧩' }), tick
    ]);
    var tabNews = el('button', { class: 'dk-tab', type: 'button', role: 'tab', text: 'חדשות היום' });
    var tabRid = el('button', { class: 'dk-tab', type: 'button', role: 'tab', text: 'חידת היום' });
    var paneNews = el('div', { class: 'dk-pane', role: 'tabpanel' });
    var paneRid = el('div', { class: 'dk-pane', role: 'tabpanel' });
    var panel = el('div', { class: 'dk-panel', id: 'dk-panel', role: 'dialog', 'aria-label': 'חדשות וחידות' }, [
      el('header', {}, [el('div', { class: 'dk-tabs', role: 'tablist' }, [main.length || tech.length ? tabNews : null, list.length ? tabRid : null]),
        el('button', { class: 'x', type: 'button', 'aria-label': 'סגירה', text: '×' })]),
      paneNews, paneRid
    ]);
    var box = el('div', { class: 'dock' }, [panel, pill]);
    document.body.appendChild(box);

    function open(on) { box.classList.toggle('open', on); document.body.classList.toggle('dock-open', on); pill.setAttribute('aria-expanded', String(on)); }
    pill.addEventListener('click', function () { open(!box.classList.contains('open')); });
    $('.x', panel).addEventListener('click', function () { open(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') open(false); });

    function show(which) {
      var n = which === 'news';
      tabNews.setAttribute('aria-selected', String(n)); tabRid.setAttribute('aria-selected', String(!n));
      paneNews.hidden = !n; paneRid.hidden = n;
      store('dock-tab', which);
    }
    tabNews.addEventListener('click', function () { show('news'); });
    tabRid.addEventListener('click', function () { show('riddle'); });

    // --- news
    var feed = 'main';
    var feedBtns = el('div', { class: 'dk-feeds' });
    var ul = el('ol', { class: 'dk-news' });
    function drawNews() {
      var items = (feed === 'main' ? main : tech).slice(0, 12);
      ul.replaceChildren.apply(ul, items.map(function (x) {
        return el('li', {}, [el('a', { href: x.link, target: '_blank', rel: 'noopener' }, [
          el('b', { text: x.title }), el('small', { text: x.source + (x.at ? ' · ' + ago(x.at) : '') })
        ])]);
      }));
      if (!items.length) ul.appendChild(el('li', { class: 'muted', text: 'אין כרגע כותרות בתחום הזה.' }));
      Array.prototype.forEach.call(feedBtns.children, function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-f') === feed)); });
    }
    [['main', 'ראשי'], ['tech', 'טכנולוגיה']].forEach(function (f) {
      if ((f[0] === 'main' ? main : tech).length) {
        var b = el('button', { class: 'chip', type: 'button', 'data-f': f[0], text: f[1] });
        b.addEventListener('click', function () { feed = f[0]; drawNews(); });
        feedBtns.appendChild(b);
      }
    });
    if (!main.length) feed = 'tech';
    paneNews.append(feedBtns, ul, el('p', { class: 'dk-foot', text: news && news.updatedAt ? 'עודכן ' + ago(news.updatedAt) + ' · מתעדכן לבד כל שעתיים' : '' }));
    drawNews();

    // --- riddle of the day
    var day = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    var at = list.length ? day % list.length : 0;
    var kind = el('span', { class: 'rd-kind' }), title = el('h4'), q = el('p', { class: 'rd-q' });
    var ans = el('p', { class: 'rd-a', hidden: '' });
    var reveal = el('button', { class: 'g-btn', type: 'button', text: 'גלו את התשובה' });
    var count = el('span', { class: 'rd-count' });
    var prev = el('button', { class: 'g-btn ghost', type: 'button', 'aria-label': 'החידה הקודמת', text: '→ הקודמת' });
    var next = el('button', { class: 'g-btn ghost', type: 'button', 'aria-label': 'החידה הבאה', text: 'הבאה ←' });
    var share = el('a', { class: 'rd-share', target: '_blank', rel: 'noopener', text: 'לשלוח לחבר בוואטסאפ ↗' });
    function drawRiddle() {
      var r = list[at];
      kind.textContent = (at === day % list.length ? 'חידת היום · ' : '') + r.kind;
      title.textContent = r.title;
      q.textContent = r.q;
      ans.textContent = '💡 ' + r.a;
      ans.hidden = true; reveal.hidden = false;
      count.textContent = (at + 1) + ' / ' + list.length;
      share.href = 'https://wa.me/?text=' + encodeURIComponent('חידה: ' + r.q + '\n\n(התשובה באתר: ' + location.origin + location.pathname + ')');
    }
    reveal.addEventListener('click', function () { ans.hidden = false; reveal.hidden = true; });
    prev.addEventListener('click', function () { at = (at - 1 + list.length) % list.length; drawRiddle(); });
    next.addEventListener('click', function () { at = (at + 1) % list.length; drawRiddle(); });
    if (list.length) {
      paneRid.append(kind, title, q, reveal, ans, el('div', { class: 'rd-nav' }, [prev, count, next]), share);
      drawRiddle();
    }

    // --- the pill rotates between the newest headlines and the riddle's title
    var lines = main.slice(0, 5).map(function (x) { return ['📰', x.title]; });
    if (list.length) lines.push(['🧩', 'חידת היום: ' + list[day % list.length].title]);
    var li = 0, ico = $('.dk-ico', pill);
    function rotate() {
      tick.classList.remove('in');
      setTimeout(function () { var l = lines[li % lines.length]; ico.textContent = l[0]; tick.textContent = l[1]; tick.classList.add('in'); li++; }, 250);
    }
    rotate();
    if (lines.length > 1 && !reduce) setInterval(function () { if (!box.classList.contains('open')) rotate(); }, 6000);

    show(store('dock-tab') === 'riddle' || !(main.length || tech.length) ? 'riddle' : 'news');
  }

  // ================================================================ videos section
  function videos(items) {
    var sec = document.getElementById('videos');
    if (!sec) return;
    items = (items || []).filter(function (v) { return v && v.url; });
    if (!items.length) return;
    var grid = $('.v-grid', sec);
    items.forEach(function (v) {
      var yt = ytParse(v.url);
      var media;
      if (yt && /youtu/.test(v.url)) {
        // a light thumbnail; the real player loads only on click
        media = el('button', { class: 'v-thumb', type: 'button', 'aria-label': 'ניגון: ' + v.title,
          style: yt.id ? 'background-image:url(https://i.ytimg.com/vi/' + yt.id + '/hqdefault.jpg)' : null }, [el('span', { class: 'v-play', 'aria-hidden': 'true', text: '▶' })]);
        media.addEventListener('click', function () {
          var src = 'https://www.youtube-nocookie.com/embed/' + (yt.id || 'videoseries') + '?autoplay=1&rel=0' + (yt.list ? '&list=' + yt.list : '');
          media.replaceWith(el('iframe', { class: 'v-frame', src: src, title: v.title, allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: '' }));
        });
      } else {
        media = el('video', { class: 'v-frame', src: v.url, controls: '', preload: 'metadata', playsinline: '' });
      }
      var canDownload = v.download && !(yt && /youtu/.test(v.url));
      grid.appendChild(el('article', { class: 'v-card reveal' }, [
        el('div', { class: 'v-media' }, [media]),
        el('div', { class: 'v-body' }, [
          el('h3', { text: v.title }),
          v.desc ? el('p', { text: v.desc }) : null,
          canDownload ? el('a', { class: 'g-btn ghost v-dl', href: v.url, download: '', text: '⬇ הורדה' }) : null
        ])
      ]));
    });
    sec.hidden = false;
    Array.prototype.forEach.call(sec.querySelectorAll('.reveal'), function (n) { setTimeout(function () { n.classList.add('in'); }, 60); });
  }

  // ================================================================ start
  var base = (document.currentScript && document.currentScript.src || '').replace(/js\/extras\.js.*$/, '');
  Promise.all([
    getJSON(base + 'media.json').catch(function () { return {}; }),
    getJSON(base + 'news.json').catch(function () { return null; }),
    getJSON(base + 'riddles.json').catch(function () { return null; })
  ]).then(function (r) {
    try { music(r[0].music); } catch (e) { console.warn('music', e); }
    try { if (!document.body.classList.contains('no-dock')) dock(r[1], r[2]); } catch (e) { console.warn('dock', e); }
    try { videos(r[0].videos); } catch (e) { console.warn('videos', e); }
  });
})();
