/* From an event invitation to a frame: the invitation's colours (worked out in the browser), its words and decorations
   (read by the AI through the sites' server: names, date, venue, mood, a fitting frame and font, and boxes around the
   ornaments), and pieces cut out of it with their background removed, ready to place on a frame. Shared by the
   customers' designer (design.html) and the studio. */
(function () {
  'use strict';
  var FS = window.FS;
  var HUB = window.HUB_SERVER || 'https://haimkripisn.app.n8n.cloud/webhook/hasadna-hubs';

  /* the server call (text/plain: the server answers no CORS preflight); the studio's ai.js defines the same */
  if (!FS.askServer) {
    FS.askServer = function (body) {
      var ctl = window.AbortController ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); }, body.action === 'ai' && !body.image ? 45000 : 115000);
      return fetch(HUB, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined })
        .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'http-' + r.status }; }); })
        .catch(function (e) { return { ok: false, error: e && e.name === 'AbortError' ? 'timeout' : 'offline' }; })
        .then(function (r) { clearTimeout(to); FS.lastAiDetail = r && !r.ok ? String(r.detail || '') : ''; return r; });
    };
  }
  if (!FS.aiError) {
    FS.aiError = function (m) {
      m = String(m || '');
      if (m === 'quota') return 'הגענו למכסת ה־AI היומית. מחר זה יתאפס.';
      if (m === 'rate-limited') return 'יותר מדי בקשות בשעה האחרונה. נסו שוב בעוד כמה דקות.';
      if (m === 'timeout') return 'ה־AI לא ענה בזמן. נסו שוב.';
      if (m === 'offline') return 'אין חיבור לשרת ה־AI. בודקים אינטרנט ומנסים שוב.';
      return 'ה־AI לא הצליח הפעם. נסו שוב.';
    };
  }

  function small(img, max) {
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, k = Math.min(1, max / Math.max(w, h)), c = FS.canvas(w * k, h * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c;
  }
  function hex(r, g, b) { return '#' + [r, g, b].map(function (v) { return ('0' + Math.round(Math.max(0, Math.min(255, v))).toString(16)).slice(-2); }).join(''); }
  function lum(c) { return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; }
  function sat(c) { var mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2]); return mx ? (mx - mn) / mx : 0; }

  /* the invitation's main colours: k-means on a small copy, the paper colour first, then the strongest accents */
  FS.invitePalette = function (img, n) {
    n = n || 6; var c = small(img, 120), d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data, px = [];
    for (var i = 0; i < d.length; i += 4) if (d[i + 3] > 200) px.push([d[i], d[i + 1], d[i + 2]]);
    if (!px.length) return [];
    var cent = []; for (i = 0; i < n; i++) cent.push(px[Math.floor((i + 0.5) * px.length / n)].slice());
    var cnt = [];
    for (var it = 0; it < 10; it++) {
      var sum = cent.map(function () { return [0, 0, 0]; }); cnt = cent.map(function () { return 0; });
      px.forEach(function (p) { var best = 0, bd = 1e9; cent.forEach(function (q, k) { var dd = (p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1]) + (p[2] - q[2]) * (p[2] - q[2]); if (dd < bd) { bd = dd; best = k; } }); sum[best][0] += p[0]; sum[best][1] += p[1]; sum[best][2] += p[2]; cnt[best]++; });
      cent = cent.map(function (q, k) { return cnt[k] ? [sum[k][0] / cnt[k], sum[k][1] / cnt[k], sum[k][2] / cnt[k]] : q; });
    }
    var list = cent.map(function (q, k) { return { c: q, n: cnt[k] }; }).filter(function (x) { return x.n > px.length * 0.01; }).sort(function (a, b) { return b.n - a.n; });
    var paper = list[0], rest = list.slice(1).sort(function (a, b) { return (sat(b.c) * 2 + b.n / px.length) - (sat(a.c) * 2 + a.n / px.length); });
    var out = [paper].concat(rest).map(function (x) { return hex(x.c[0], x.c[1], x.c[2]); });
    return out.filter(function (h, i) { return out.indexOf(h) === i; });
  };
  /* the colour to draw the frame in: the strongest accent that is neither paper-white nor near black */
  FS.accentOf = function (pal) {
    var best = null, score = -1;
    (pal || []).slice(1).forEach(function (h) { var c = FS.hexRgb(h), L = lum(c), s = sat(c) * 1.4 + (L > 40 && L < 225 ? 0.5 : 0); if (s > score) { score = s; best = h; } });
    return best || (pal && pal[1]) || '#c9a45c';
  };

  /* what the AI reads from the invitation; everything is checked before use */
  FS.readInvite = function (img) {
    var c = small(img, 1280), frames = FS.GEN_FRAMES.map(function (f) { return f.id + ' (' + f.name + ')'; }).join(', '), events = FS.EVENTS.map(function (e) { return e.id + ' (' + e.name + ')'; }).join(', ');
    var prompt = 'This is an event invitation (often in Hebrew). Read it and answer ONLY with JSON, no other text:\n' +
      '{"eventType":"one id from: ' + events + '","names":"the celebrants as printed, e.g. נועה & דניאל","title":"a short heading for a photo magnet, Hebrew","date":"YYYY-MM-DD or empty","time":"HH:MM or empty","venue":"place name or empty",' +
      '"line":"one short warm Hebrew line for the magnet (max 6 words)","mood":"2-4 English words about the style","palette":["#hex","#hex","#hex","#hex"],' +
      '"font":"script|serif|modern|playful|hand","frame":"the best fitting frame id from: ' + frames + '",' +
      '"ornaments":[{"label":"what it is (flowers, leaves, gold line, logo, monogram...)","box":[ymin,xmin,ymax,xmax]}]}\n' +
      'Boxes are 0-1000 relative to the image. List up to 6 decorative pieces worth reusing on a photo frame (not blocks of text). Hebrew text values must be exactly as on the invitation.';
    return FS.askServer({ action: 'ai', tag: 'invite', prompt: prompt, image: c.toDataURL('image/jpeg', 0.88).split(',')[1], mime: 'image/jpeg' }).then(function (r) {
      if (!r || !r.ok || !r.text) throw new Error((r && r.error) || 'ai-failed');
      var t = String(r.text), a = t.indexOf('{'), z = t.lastIndexOf('}'), j = JSON.parse(t.slice(a, z + 1));
      var str = function (v, n) { return String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 60); };
      var out = { eventType: FS.EVENTS.some(function (e) { return e.id === j.eventType; }) ? j.eventType : '', names: str(j.names), title: str(j.title), date: /^\d{4}-\d{2}-\d{2}$/.test(j.date || '') ? j.date : '',
        time: /^\d{1,2}:\d{2}$/.test(j.time || '') ? j.time : '', venue: str(j.venue), line: str(j.line, 50), mood: str(j.mood), font: str(j.font, 12),
        palette: (Array.isArray(j.palette) ? j.palette : []).filter(function (h) { return /^#[0-9a-f]{6}$/i.test(h); }).slice(0, 6),
        frame: FS.GEN_FRAMES.some(function (f) { return f.id === j.frame; }) ? j.frame : '',
        ornaments: (Array.isArray(j.ornaments) ? j.ornaments : []).map(function (o) { var b = (o && o.box || []).map(Number); return b.length === 4 && b.every(isFinite) && b[2] > b[0] && b[3] > b[1] ? { label: str(o.label, 30), box: b.map(function (v) { return Math.max(0, Math.min(1000, v)); }) } : null; }).filter(Boolean).slice(0, 8),
        model: r.model || r.source || '' };
      return out;
    });
  };
  /* the font family that fits a style word */
  FS.fontFor = function (style) {
    return { script: 'Amatic SC', serif: 'Frank Ruhl Libre', modern: 'Rubik', playful: 'Secular One', hand: 'Playpen Sans Hebrew' }[style] || 'Frank Ruhl Libre';
  };

  /* a piece of the invitation (box 0-1000) as a canvas whose background is see-through: the colour around its edge is
     removed where it touches the edge (flood fill), so a flower on cream paper comes out as just the flower */
  FS.cutPiece = function (img, box, opts) {
    opts = opts || {};
    var W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
    var x0 = Math.floor(box[1] / 1000 * W), y0 = Math.floor(box[0] / 1000 * H), x1 = Math.ceil(box[3] / 1000 * W), y1 = Math.ceil(box[2] / 1000 * H);
    var w = Math.max(2, x1 - x0), h = Math.max(2, y1 - y0), k = Math.min(1, 900 / Math.max(w, h));
    var c = FS.canvas(w * k, h * k), x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, x0, y0, w, h, 0, 0, c.width, c.height);
    if (opts.keepBg) return c;
    var cw = c.width, ch = c.height, id = x.getImageData(0, 0, cw, ch), d = id.data;
    /* the background: the most common colour along the edge */
    var edge = {}, best = null, bn = 0;
    function key(i) { return (d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4); }
    for (var i = 0; i < cw; i++) { [i, (ch - 1) * cw + i].forEach(function (p) { var kk = key(p * 4); edge[kk] = (edge[kk] || 0) + 1; }); }
    for (i = 0; i < ch; i++) { [i * cw, i * cw + cw - 1].forEach(function (p) { var kk = key(p * 4); edge[kk] = (edge[kk] || 0) + 1; }); }
    Object.keys(edge).forEach(function (kk) { if (edge[kk] > bn) { bn = edge[kk]; best = kk; } });
    var bg = best.split(',').map(function (v) { return Number(v) * 16 + 8; }), tol = opts.tol || 46;
    function near(p) { return Math.abs(d[p] - bg[0]) + Math.abs(d[p + 1] - bg[1]) + Math.abs(d[p + 2] - bg[2]) < tol * 1.6; }
    var seen = new Uint8Array(cw * ch), st = [];
    for (i = 0; i < cw; i++) st.push(i, (ch - 1) * cw + i);
    for (i = 0; i < ch; i++) st.push(i * cw, i * cw + cw - 1);
    while (st.length) {
      var q = st.pop(); if (seen[q] || !near(q * 4)) continue; seen[q] = 1; d[q * 4 + 3] = 0;
      var qx = q % cw; if (qx > 0) st.push(q - 1); if (qx < cw - 1) st.push(q + 1); if (q >= cw) st.push(q - cw); if (q < cw * (ch - 1)) st.push(q + cw);
    }
    /* soften the cut edge a little */
    for (i = 0; i < cw * ch; i++) if (!seen[i] && d[i * 4 + 3]) {
      var px = i % cw, n = 0; if (px > 0 && seen[i - 1]) n++; if (px < cw - 1 && seen[i + 1]) n++; if (i >= cw && seen[i - cw]) n++; if (i < cw * (ch - 1) && seen[i + cw]) n++;
      if (n) d[i * 4 + 3] = Math.round(255 * (1 - n * 0.18));
    }
    x.putImageData(id, 0, 0);
    return c;
  };
})();
