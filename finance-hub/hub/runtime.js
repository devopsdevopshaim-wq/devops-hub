/* The standalone sites' runtime.
   These pages were written for a server (they call /api/...). This file answers those calls inside the browser, so each
   site works on its own from GitHub Pages:
     - the server's own modules (hub/lib/*.js, copied unchanged) run here, with small replacements for the server-only
       parts (files, https, the AI): see the "node" shims below;
     - a text answer from an AI, and the market data that browsers may not read, come from the n8n server
       (hasadna-hubs), which keeps the keys;
     - the sites' own files (data, library) are fetched from the site.
   Nothing here talks to the old Render app. */
(function () {
  'use strict';
  var me = document.currentScript && document.currentScript.src || '';
  var BASE = me.replace(/hub\/runtime\.js.*$/, '');                 // the site's own root, with a closing slash
  var SERVER = window.HUB_SERVER || 'https://haimkripisn.app.n8n.cloud/webhook/hasadna-hubs';
  var nativeFetch = window.fetch.bind(window);

  // ------------------------------------------------------------------ small helpers
  function json(body, status) {
    return new Response(JSON.stringify(body), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
  function text(body, status, type, extra) {
    return new Response(body, { status: status || 200, headers: Object.assign({ 'Content-Type': type || 'text/plain; charset=utf-8' }, extra || {}) });
  }
  function readJSON(file) { return nativeFetch(BASE + file, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(file + ' ' + r.status); return r.json(); }); }

  // ------------------------------------------------------------------ the n8n server: AI and market reads
  function server(payload) {
    var ctl = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (ctl) ctl.abort(); }, 100000);
    return nativeFetch(SERVER, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(payload), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'bad-response' }; }); })
      .then(function (j) { clearTimeout(t); return j; })
      .catch(function () { clearTimeout(t); return { ok: false, error: 'offline' }; });
  }
  var AI_ERR = {
    quota: 'המכסה היומית של ה־AI נגמרה. נסו שוב מחר.',
    'rate-limited': 'יותר מדי בקשות בזמן קצר. נסו שוב בעוד כמה דקות.',
    'no-key': 'ה־AI עדיין לא הופעל בשרת. ',
    offline: 'אין חיבור לשרת. בדקו את החיבור לאינטרנט ונסו שוב.',
    forbidden: 'הבקשה נחסמה: האתר צריך לפעול מהכתובת שלו.'
  };
  function askAI(prompt) {
    return server({ action: 'ai', prompt: String(prompt || '') }).then(function (j) {
      if (j && j.ok && j.text) return { text: j.text, source: j.source || 'Gemini' };
      var e = new Error(AI_ERR[j && j.error] || 'ה־AI לא ענה כרגע. נסו שוב בעוד רגע.'); e.code = j && j.error; throw e;
    });
  }
  // a GET of an allowed market host, through the server
  function proxyGet(host, path) {
    return server({ action: 'fetch', url: 'https://' + host + path }).then(function (j) {
      if (!j || !j.ok) throw new Error('market');
      return j.body;
    });
  }
  function directGet(host, path) {
    return nativeFetch('https://' + host + path).then(function (r) { return r.text(); });
  }

  // ------------------------------------------------------------------ the pieces of node the server modules use
  var DATA = {};          // data/*.json, by file name (preloaded, so readFileSync can be synchronous)
  var LIBFILES = {};      // library/ files and their sizes
  function nodeFs() {
    function ent(p) { var e = new Error('ENOENT: ' + p); e.code = 'ENOENT'; return e; }
    return {
      readFileSync: function (p) {
        var n = String(p).split('/').pop();
        if (Object.prototype.hasOwnProperty.call(DATA, n)) return DATA[n];
        throw ent(p);
      },
      existsSync: function (p) { var n = String(p).split('/').pop(); return Object.prototype.hasOwnProperty.call(DATA, n) || Object.prototype.hasOwnProperty.call(LIBFILES, n); },
      statSync: function (p) { var n = String(p).split('/').pop(); if (Object.prototype.hasOwnProperty.call(LIBFILES, n)) return { size: LIBFILES[n] }; throw ent(p); },
      mkdirSync: function () {}, writeFileSync: function () {}, readdirSync: function () { return []; }, rmSync: function () {}
    };
  }
  var nodePath = {
    sep: '/',
    join: function () { return Array.prototype.slice.call(arguments).join('/').replace(/\/+/g, '/'); },
    resolve: function () { return Array.prototype.slice.call(arguments).join('/').replace(/\/+/g, '/'); },
    basename: function (p) { return String(p).split('/').pop(); },
    dirname: function (p) { return String(p).split('/').slice(0, -1).join('/'); }
  };
  // Buffer: only what the server modules do with a response: collect strings and turn them back into text
  var nodeBuffer = { concat: function (parts) { return { toString: function () { return parts.join(''); } }; } };
  // https.get({host, path, headers, timeout}, cb): the answer arrives as 'data' / 'end' events, like the real thing
  function nodeHttps() {
    return {
      get: function (opts, cb) {
        var handlers = {}, dead = false;
        var req = {
          on: function (ev, fn) { handlers[ev] = fn; return req; },
          destroy: function () { dead = true; }
        };
        var host = opts.host, path = opts.path;
        var viaServer = /yahoo\.com$|globes\.co\.il$/.test(host);
        var timer = setTimeout(function () { if (!dead && handlers.timeout) handlers.timeout.call(req); }, opts.timeout || 12000);
        (viaServer ? proxyGet(host, path) : directGet(host, path)).then(function (body) {
          clearTimeout(timer); if (dead) return;
          var res = { on: function (ev, fn) { res[ev] = fn; return res; } };
          cb(res);
          if (res.data) res.data(body);
          if (res.end) res.end();
        }).catch(function (e) { clearTimeout(timer); if (!dead && handlers.error) handlers.error(e); });
        return req;
      }
    };
  }
  var shims = {
    fs: nodeFs(), path: nodePath, https: nodeHttps(),
    './dailyNarrative': { askAI: askAI },
    './astroConfig': { readAstroConfig: function () { return null; } },
    './business': function () { return { listCalendar: function () { return []; }, saveCalendarEntry: function () {} }; },
    './paths': { PERSIST_DIR: '/' },
    './aiPanel': {}
  };

  // ------------------------------------------------------------------ loading the server's modules
  var libs = {};
  var HEBCAL = BASE + 'hub/hebcal-core.mjs';
  function lib(name) {
    if (libs[name]) return libs[name];
    libs[name] = nativeFetch(BASE + 'hub/lib/' + name + '.js').then(function (r) {
      if (!r.ok) throw new Error('missing module ' + name);
      return r.text();
    }).then(function (src) {
      var deps = [], re = /require\("\.\/([\w]+)"\)/g, m;
      while ((m = re.exec(src))) if (!shims['./' + m[1]]) deps.push(m[1]);
      return Promise.all(deps.map(lib)).then(function (mods) {
        var map = {}; deps.forEach(function (d, i) { map['./' + d] = mods[i]; });
        var module = { exports: {} };
        var require = function (id) { if (shims[id]) return shims[id]; if (map[id]) return map[id]; throw new Error('no module ' + id); };
        var code = src.replace(/import\("@hebcal\/core"\)/g, 'import(__HEBCAL__)');
        new Function('require', 'module', 'exports', '__dirname', 'Buffer', 'process', '__HEBCAL__', code)(require, module, module.exports, '/lib', nodeBuffer, { env: {} }, HEBCAL);
        return module.exports;
      });
    });
    return libs[name];
  }

  var ready = null;
  function preload() {
    if (ready) return ready;
    ready = readJSON('hub/manifest.json').then(function (man) {
      return Promise.all((man.data || []).map(function (f) {
        return nativeFetch(BASE + 'data/' + f).then(function (r) { return r.text(); }).then(function (t) { DATA[f] = t; }).catch(function () {});
      })).then(function () { LIBFILES = man.library || {}; return man; });
    }).catch(function () { return {}; });
    return ready;
  }

  // ------------------------------------------------------------------ the routes
  var routes = [];
  function route(method, re, fn) { routes.push({ method: method, re: re, fn: fn }); }
  function wrap(fn) { return function (ctx) { return Promise.resolve().then(function () { return fn(ctx); }); }; }

  route('POST', /^\/api\/finance\/metrics$/, wrap(function (c) { return lib('financeAdvisor').then(function (m) { return json({ metrics: m.computeMetrics(c.body || {}) }); }); }));
  route('POST', /^\/api\/finance\/analyze$/, function (c) {
    // the AI writes the plan; with no AI the same sections are computed from the numbers
    return Promise.all([lib('financeAdvisor'), lib('local')]).then(function (ms) {
      return ms[0].analyze(c.body || {}).catch(function (e) { return { ok: false, error: e.message, metrics: ms[0].computeMetrics(c.body || {}) }; }).then(function (r) {
        if (r && r.ok && r.plan) return json(r);
        var l = ms[1].finance(c.body || {}, r.metrics || ms[0].computeMetrics(c.body || {}));
        return json({ ok: true, metrics: r.metrics, plan: l.plan, source: l.source, generatedAt: new Date().toISOString() });
      });
    }).catch(function (e) { return json({ ok: false, error: e.message }, 502); });
  });
  ['market', 'market/news', 'market/outlook'].forEach(function (p) {
    route('GET', new RegExp('^/api/' + p + '$'), function () {
      return lib('marketData').then(function (m) {
        return p === 'market' ? m.getMarket() : p === 'market/news' ? m.getMarketNews().then(function (items) { return { items: items }; }) : m.getMarketOutlook();
      }).then(function (r) { return json(r); }, function (e) { return json(p === 'market/news' ? { items: [], error: e.message } : { error: e.message }, 502); });
    });
  });
  route('GET', /^\/api\/market\/lookup$/, function (c) {
    return lib('marketData').then(function (m) { return m.lookupTicker(c.query.get('symbol') || ''); }).then(function (r) { return json(r); }, function (e) { return json({ error: e.message }, 400); });
  });
  route('POST', /^\/api\/health\/analyze$/, function (c) {
    var data = c.body && typeof c.body === 'object' ? c.body : {};
    return Promise.all([lib('healthAdvisor'), lib('local')]).then(function (ms) {
      return ms[0].analyze(data).catch(function () { return { ok: false }; }).then(function (r) { return json(r && r.ok ? r : ms[1].health(data)); });
    }).catch(function (e) { return json({ ok: false, error: e.message }, 500); });
  });
  route('POST', /^\/api\/marketing\/generate$/, function (c) {
    var b = c.body || {};
    if (!b.business) return json({ error: 'צריך שם עסק' }, 400);
    if (!b.offer) return json({ error: 'צריך תיאור מוצר/הצעה' }, 400);
    return Promise.all([lib('adStudio'), lib('local')]).then(function (ms) {
      return ms[0].generate(b).catch(function () {
        var r = ms[1].marketing(b);
        r.business = b.business; r.platform = ms[0].PLATFORM_LABELS[b.platform] || b.platform;
        return r;
      });
    }).then(function (r) { return json(r); }, function (e) { return json({ error: e.message }, 400); });
  });
  route('GET', /^\/api\/marketing\/options$/, function () {
    return lib('adStudio').then(function (m) { return json({ platforms: m.PLATFORM_LABELS, goals: m.GOAL_LABELS }); });
  });
  route('GET', /^\/api\/fitness$/, function () {
    return readJSON('data/exercises.json').then(function (j) {
      var today = new Date().getDay();
      var routine = (j.week || []).find(function (w) { return w.day === today; }) || (j.week || [])[0];
      var exercises = (j.exercises || []).map(function (e) { return Object.assign({}, e, { video: null }); });   // no video search: the sites show the drawn figure
      return json(Object.assign({}, j, { exercises: exercises, today: today, routine: routine }));
    }, function (e) { return json({ error: e.message, exercises: [], week: [] }, 500); });
  });
  route('GET', /^\/api\/shabbat$/, function () {
    return lib('shabbatClient').then(function (m) { return m.getShabbatTimes(); }).then(function (r) { return json(r); }, function (e) { return json({ available: false, error: e.message }, 500); });
  });
  route('GET', /^\/api\/holidays$/, function () { return lib('holidayHalacha').then(function (m) { return json({ holidays: m.listAll() }); }); });
  route('GET', /^\/api\/holidays\/upcoming$/, function () {
    return lib('holidayHalacha').then(function (m) { return m.computeUpcoming(); }).then(function (u) { return json({ upcoming: u }); }, function (e) { return json({ upcoming: [], error: e.message }, 500); });
  });
  route('POST', /^\/api\/holidays\/sync-calendar$/, function () {
    // the calendar of the full system is not part of this site: nothing to sync to
    return json({ ok: true, added: 0, total: 0, note: 'סנכרון ליומן זמין במערכת העסקית, לא באתר העצמאי.' });
  });
  route('GET', /^\/api\/holidays\/([\w-]+)$/, function (c) {
    return lib('holidayHalacha').then(function (m) { var x = m.getContent(c.m[1]); return x ? json(x) : json({ error: 'חג לא נמצא' }, 404); });
  });
  route('GET', /^\/api\/library$/, function () {
    return Promise.all([lib('holidayResources'), lib('holidayStories')]).then(function (ms) {
      var hr = ms[0], st = ms[1];
      return Promise.all([hr.active(), hr.upcomingHolidays().catch(function () { return []; })]).then(function (r) {
        return json({ resources: hr.list(), active: r[0], holidays: r[1], stories: st.list() });
      });
    }).catch(function (e) { return json({ resources: [], active: [], holidays: [], stories: [], error: e.message }, 500); });
  });
  route('GET', /^\/api\/torah\/catalog$/, function () {
    return lib('sefariaLibrary').then(function (L) { return json({ books: L.TANAKH_BOOKS, commentaries: L.COMMENTARIES, rambam: L.RAMBAM_SECTIONS, talmud: L.TALMUD_TRACTATES }); });
  });
  route('GET', /^\/api\/torah\/siddur-tree$/, function () {
    return lib('sefariaLibrary').then(function (L) { return L.getSiddurTree(); }).then(function (t) { return json({ tree: t }); }, function (e) { return json({ tree: [], error: e.message }, 502); });
  });
  route('GET', /^\/api\/torah\/text$/, function (c) {
    return lib('sefariaLibrary').then(function (L) { return L.getText(c.query.get('ref')); }).then(function (t) { return json(t); }, function (e) { return json({ error: e.message }, 502); });
  });

  // the AIA studio: projects, reference images and the production package, kept in this browser (IndexedDB)
  function aia() { return lib('aiaBrowser'); }
  route('GET', /^\/api\/aia\/projects$/, function () { return aia().then(function (A) { return A.list(); }).then(function (r) { return json(r); }); });
  route('POST', /^\/api\/aia\/stage$/, function (c) { return aia().then(function (A) { return A.stage(c.body || {}); }).then(function (r) { return json(r); }, function (e) { return json({ error: e.message }, 400); }); });
  route('POST', /^\/api\/aia\/stage\/clear$/, function (c) { return aia().then(function (A) { return A.clearStage((c.body || {}).stageId || ''); }).then(function () { return json({ ok: true }); }); });
  route('POST', /^\/api\/aia\/generate$/, function (c) {
    var b = c.body || {};
    if (!b.text && !(b.files || []).length && !b.title && !b.stageId) return json({ error: 'צריך לפחות כותרת, תיאור טקסטואלי, או תמונת ייחוס' }, 400);
    return Promise.all([aia(), lib('local')]).then(function (ms) { return ms[0].create(b, askAI, ms[1].aia); }).then(function (p) { return json(p); }, function (e) { return json({ error: e.message }, 502); });
  });
  route('GET', /^\/api\/aia\/project\/([\w-]+)\/markdown$/, function (c) {
    return aia().then(function (A) { return A.markdown(c.m[1]); }).then(function (md) {
      return md == null ? text('לא נמצא', 404) : text(md, 200, 'text/markdown; charset=utf-8', { 'Content-Disposition': 'attachment; filename="aia-' + c.m[1] + '.md"' });
    });
  });
  route('GET', /^\/api\/aia\/project\/([\w-]+)$/, function (c) { return aia().then(function (A) { return A.get(c.m[1]); }).then(function (p) { return p ? json(p) : json({ error: 'לא נמצא' }, 404); }); });
  route('DELETE', /^\/api\/aia\/project\/([\w-]+)$/, function (c) { return aia().then(function (A) { return A.remove(c.m[1]); }).then(function () { return json({ ok: true }); }); });
  route('GET', /^\/api\/aia\/asset\/([\w-]+)\/([\w.-]+)$/, function (c) {
    return aia().then(function (A) { return A.asset(c.m[1], c.m[2]); }).then(function (b) { return b ? new Response(b, { status: 200, headers: { 'Content-Type': b.type || 'image/png' } }) : text('', 404); });
  });
  // what this site cannot do on its own: the real video render (a server tool), outside video engines and a local ComfyUI
  route('GET', /^\/api\/aia\/video\/providers$/, function () { return json({ providers: [] }); });
  route('POST', /^\/api\/aia\/video\/config$/, function () { return json({ error: 'חיבור מנועי וידאו זמין במערכת המלאה, לא באתר העצמאי.' }, 400); });
  route('GET', /^\/api\/aia\/comfyui\/status$/, function () { return json({ configured: false, available: false, ok: false }); });
  route('POST', /^\/api\/aia\/comfyui\/config$/, function () { return json({ error: 'ComfyUI מקומי זמין במערכת המלאה, לא באתר העצמאי.' }, 400); });
  route('GET', /^\/api\/aia\/project\/([\w-]+)\/(render|video|comfyui)$/, function () { return json({ status: 'none' }); });
  route('POST', /^\/api\/aia\/project\/([\w-]+)\/(render|video|comfyui)$/, function () { return json({ error: 'הפקת וידאו אמיתי דורשת את שרת הסטודיו המלא. כאן מקבלים את חבילת ההפקה: קונספט, פרומפטים וסטוריבורד.' }, 400); });

  // everything else under /api/ is a feature of the full system
  route('*', /^\/api\//, function () { return json({ error: 'לא זמין באתר העצמאי' }, 404); });

  // ------------------------------------------------------------------ the fetch hook
  function pathOf(url) {
    try { var u = new URL(url, location.href); return u.origin === location.origin ? u : null; } catch (e) { return null; }
  }
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : input && input.url;
    var u = typeof url === 'string' ? pathOf(url) : null;
    var raw = typeof url === 'string' ? url : '';
    // addresses written from the root (/api/..., /library/...) belong to this site, not to the whole domain
    var p = /^\/(?!\/)/.test(raw) ? raw.split('#')[0] : (u ? u.pathname + u.search : '');
    if (/^\/api\//.test(p)) {
      var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      var q = new URLSearchParams(p.indexOf('?') > -1 ? p.slice(p.indexOf('?') + 1) : '');
      var pathOnly = p.split('?')[0];
      var body = null;
      if (init && typeof init.body === 'string') { try { body = JSON.parse(init.body); } catch (e) { body = null; } }
      return preload().then(function () {
        for (var i = 0; i < routes.length; i++) {
          var r = routes[i];
          if (r.method !== '*' && r.method !== method) continue;
          var m = r.re.exec(pathOnly);
          if (m) return r.fn({ m: m, query: q, body: body, method: method });
        }
        return json({ error: 'not found' }, 404);
      });
    }
    if (/^\/(library|data|icons|js|css|vendor|img)\//.test(raw)) return nativeFetch(BASE + raw.slice(1), init);
    return nativeFetch(input, init);
  };
  // a small Markdown reader for the reports: **bold**, lists, paragraphs
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  window.HUBMD = function (md) {
    var out = [], list = null;
    function close() { if (list) { out.push('</ul>'); list = null; } }
    String(md || '').split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim();
      if (!line) { close(); return; }
      var h = /^\*\*(.+?)\*\*$/.exec(line);
      if (h) { close(); out.push('<h4 class="hub-md-h">' + esc(h[1]) + '</h4>'); return; }
      var inl = function (t) { return esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); };
      var li = /^(?:[-•]|\d+\.)\s+(.*)$/.exec(line);
      if (li) { if (!list) { out.push('<ul class="hub-md-ul">'); list = true; } out.push('<li>' + inl(li[1]) + '</li>'); return; }
      close(); out.push('<p>' + inl(line) + '</p>');
    });
    close();
    return out.join('');
  };
  window.HUB = { base: BASE, ask: askAI, lib: lib };
})();
