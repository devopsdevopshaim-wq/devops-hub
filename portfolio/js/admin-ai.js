/* Admin screen · AI models. Local ones (Ollama, Open WebUI, OpenClaw) are called from this browser on this computer;
   the cloud ones (Gemini, ChatGPT, DeepSeek, Claude) with keys that stay in this browser's localStorage.
   Nothing here goes through any server of ours, and the screen only runs for the signed-in admin. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') n.textContent = attrs[k]; else if (attrs[k] != null) n.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  var KEY = 'spider-ai-admin';

  // kind: how the provider speaks. local: runs on this computer (no key needed unless set).
  var P = [
    { id: 'ollama', name: 'Ollama', local: true, signup: 'https://ollama.com/download', kind: 'ollama', base: 'http://localhost:11434', key: false, model: '', suggest: [] },
    { id: 'openwebui', name: 'Open WebUI', local: true, signup: 'https://docs.openwebui.com/getting-started/', kind: 'openai', base: 'http://localhost:3000', path: '/api', key: true, model: '', suggest: [] },
    { id: 'openclaw', name: 'OpenClaw', local: true, kind: 'openai', base: 'http://127.0.0.1:18789', path: '/v1', key: true, model: 'openclaw', suggest: ['openclaw'] },
    { id: 'gemini', name: 'Gemini', signup: 'https://aistudio.google.com/', kind: 'gemini', base: 'https://generativelanguage.googleapis.com', key: true, model: 'gemini-flash-latest', suggest: ['gemini-flash-latest', 'gemini-pro-latest', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'], free: true, keyUrl: 'https://aistudio.google.com/apikey', chat: 'https://gemini.google.com/app' },
    { id: 'openai', name: 'ChatGPT (OpenAI)', signup: 'https://platform.openai.com/signup', kind: 'openai', base: 'https://api.openai.com', path: '/v1', key: true, model: 'gpt-5', suggest: ['gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt-4o-mini'], paid: true, chat: 'https://chatgpt.com/', keyUrl: 'https://platform.openai.com/api-keys' },
    { id: 'deepseek', name: 'DeepSeek', signup: 'https://platform.deepseek.com/sign_up', kind: 'openai', base: 'https://api.deepseek.com', path: '', key: true, model: 'deepseek-chat', suggest: ['deepseek-chat', 'deepseek-reasoner'], paid: true, chat: 'https://chat.deepseek.com/', keyUrl: 'https://platform.deepseek.com/api_keys' },
    { id: 'openrouter', name: 'OpenRouter (דגמים חינמיים)', signup: 'https://openrouter.ai/', kind: 'openai', base: 'https://openrouter.ai/api', path: '/v1', key: true, model: 'deepseek/deepseek-chat-v3.1:free', suggest: ['deepseek/deepseek-chat-v3.1:free', 'deepseek/deepseek-r1:free', 'meta-llama/llama-3.3-70b-instruct:free', 'google/gemini-2.0-flash-exp:free'], free: true, keyUrl: 'https://openrouter.ai/keys' },
    { id: 'groq', name: 'Groq (חינם, מהיר)', signup: 'https://console.groq.com/', kind: 'openai', base: 'https://api.groq.com/openai', path: '/v1', key: true, model: 'llama-3.3-70b-versatile', suggest: ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'deepseek-r1-distill-llama-70b'], free: true, keyUrl: 'https://console.groq.com/keys' },
    { id: 'github', name: 'ChatGPT ו־DeepSeek בחינם (GitHub Models)', kind: 'openai', base: 'https://models.github.ai', path: '/inference', key: true, model: 'openai/gpt-4.1-mini', suggest: ['openai/gpt-4.1-mini', 'openai/gpt-4.1', 'openai/gpt-4o', 'deepseek/DeepSeek-V3-0324', 'deepseek/DeepSeek-R1', 'meta/Llama-3.3-70B-Instruct'], free: true, bridgeable: true, signup: 'https://github.com/marketplace/models', keyUrl: 'https://github.com/settings/personal-access-tokens/new', note: 'חינם עם חשבון GitHub: מפיקים טוקן עם הרשאת Models (קריאה). דגמי ChatGPT ו־DeepSeek רצים כאן בתוך האתר שלך, בלי לעבור לאתר שלהם. יש מגבלת קצב. אם הדפדפן חוסם, הגשר המקומי מעביר.' },
    { id: 'claude', name: 'Claude (Anthropic)', signup: 'https://console.anthropic.com/', kind: 'claude', base: 'https://api.anthropic.com', key: true, model: 'claude-sonnet-5-5', suggest: ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-fable-5-1', 'claude-haiku-4-5-20251001'], paid: true, chat: 'https://claude.ai/new', keyUrl: 'https://console.anthropic.com/settings/keys' }
  ];
  var byId = {}; P.forEach(function (p) { byId[p.id] = p; });

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  var vaultTimer = null, vaultOK = null;
  function save(o) {
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
    // a second copy in the admin's own n8n (readable only with the admin session), so another browser or a cleared one does not lose it
    clearTimeout(vaultTimer);
    vaultTimer = setTimeout(function () {
      window.HasadnaAuth.api('ai-vault-set', { blob: JSON.stringify(o) }).then(function (j) { vaultOK = !!(j && j.ok); showVault(); }, function () { vaultOK = false; showVault(); });
    }, 700);
  }
  function showVault() {
    var m = $('ai-vault'); if (!m) return;
    m.textContent = vaultOK === true ? '✓ המפתחות שמורים בדפדפן ובכספת של ה־n8n שלך (רק מנהל מחובר יכול לקרוא). לא יימחקו.' : vaultOK === false ? '⚠ נשמר בדפדפן הזה בלבד. הכספת ב־n8n לא ענתה (בדוק ש"כניסה והרשאות" פעיל).' : '';
    m.className = 'ai-msg ' + (vaultOK ? 'ok' : vaultOK === false ? 'bad' : '');
  }
  var cfg = load();
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}   // ask the browser not to clear it
  function conf(id) { var p = byId[id], c = cfg[id] || {}; return { base: (c.base || p.base).replace(/\/+$/, ''), key: c.key || '', model: c.model || p.model }; }

  // ---- talking to each kind of provider
  function http(url, init, ms) {
    var ctl = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (ctl) ctl.abort(); }, ms || 120000);
    init = init || {}; if (ctl) init.signal = ctl.signal;
    return fetch(url, init).then(function (r) {
      clearTimeout(t);
      return r.text().then(function (txt) {
        var j = null; try { j = JSON.parse(txt); } catch (e) {}
        if (!r.ok) { if (r.status === 402 || /insufficient balance|no credits|credit balance|billing|quota exceeded|exceeded your current quota/i.test(txt)) throw new Error('אין יתרה או מכסה ב־API. חשבון ה־API משולם בנפרד מהצ׳אט החינמי באתר (גם כשהצ׳אט עובד). אפשר: להטעין יתרה, להשתמש בדגם חינמי (Gemini, OpenRouter, Groq), או לפתוח את הצ׳אט החינמי בכפתור. · ' + r.status); var m = (j && (j.error && (j.error.message || j.error) || j.message || j.detail)) || txt.slice(0, 200) || r.status; throw new Error(r.status + ' · ' + (typeof m === 'string' ? m : JSON.stringify(m))); }
        return j == null ? txt : j;
      });
    }, function (e) {
      clearTimeout(t);
      throw new Error(e && e.name === 'AbortError' ? 'לא ענה בזמן' : 'אין חיבור (השרת לא רץ, או שהוא לא מאפשר לאתר הזה לפנות אליו)');
    });
  }
  function bearer(c) { return c.key ? { Authorization: 'Bearer ' + c.key } : {}; }

  function models(id) {
    var p = byId[id], c = conf(id);
    if (p.kind === 'ollama') return http(c.base + '/api/tags', {}, 8000).then(function (j) { return (j.models || []).map(function (m) { return m.name; }); });
    if (p.kind === 'gemini') return http(c.base + '/v1beta/models?pageSize=100&key=' + encodeURIComponent(c.key), {}, 10000).then(function (j) {
      return (j.models || []).filter(function (m) { return (m.supportedGenerationMethods || []).indexOf('generateContent') > -1; }).map(function (m) { return m.name.replace(/^models\//, ''); });
    });
    if (p.kind === 'claude') return http(c.base + '/v1/models?limit=100', { headers: { 'x-api-key': c.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' } }, 10000).then(function (j) { return (j.data || []).map(function (m) { return m.id; }); });
    if (id === 'github') return http(c.base + '/catalog/models', { headers: Object.assign({ Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, bearer(c)) }, 10000).then(function (j) { return (Array.isArray(j) ? j : j.models || []).map(function (m) { return m.id; }); });
    return http(c.base + p.path + '/models', { headers: bearer(c) }, 10000).then(function (j) {
      var l = j.data || j.models || [];
      if (id === 'openrouter') l = l.filter(function (m) { return /:free$/.test(m.id) || (m.pricing && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0); });
      return l.map(function (m) { return m.id || m.name; });
    });
  }

  // Gemini is sometimes overloaded (503) or busy (429): try again, then another model, before giving up
  var GEMINI_FALLBACK = ['gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-pro-latest'];
  function ask(id, prompt, system) {
    if (id !== 'gemini') return ask1(id, prompt, system);
    var first = conf('gemini').model, order = [first].concat(GEMINI_FALLBACK.filter(function (m) { return m !== first; })), i = 0, last;
    function next() {
      if (i >= order.length) return Promise.reject(last);
      var m = order[i++];
      return ask1('gemini', prompt, system, m).then(function (r) { if (m !== first) r.text += '\n\n(' + first + ' היה עמוס, נענה ע״י ' + m + ')'; return r; }, function (e) {
        last = e;
        if (/ 50\d | 429 |overload|high demand|unavailable|busy/i.test(e.message + ' ')) return new Promise(function (ok) { setTimeout(ok, 900); }).then(next);
        throw e;
      });
    }
    return next();
  }
  function ask1(id, prompt, system, modelOverride) {
    var p = byId[id], c = conf(id), t0 = Date.now();
    if (modelOverride) c.model = modelOverride;
    if (!c.model) return Promise.reject(new Error('בחר דגם (כפתור "טעינת דגמים")'));
    var done = function (text) { return { text: String(text || '').trim() || '(תשובה ריקה)', ms: Date.now() - t0 }; };
    var msgs = (system ? [{ role: 'system', content: system }] : []).concat([{ role: 'user', content: prompt }]);
    if (p.kind === 'ollama') return http(c.base + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: c.model, messages: msgs, stream: false }) }).then(function (j) { return done(j.message && j.message.content); });
    if (p.kind === 'gemini') return http(c.base + '/v1beta/models/' + encodeURIComponent(c.model) + ':generateContent', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': c.key }, body: JSON.stringify(Object.assign({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }, system ? { systemInstruction: { parts: [{ text: system }] } } : {})) })
      .then(function (j) { var cand = j.candidates && j.candidates[0]; return done(cand && cand.content && (cand.content.parts || []).map(function (x) { return x.text || ''; }).join('')); });
    if (p.kind === 'claude') return http(c.base + '/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': c.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify(Object.assign({ model: c.model, max_tokens: 2048, messages: [{ role: 'user', content: prompt }] }, system ? { system: system } : {})) })
      .then(function (j) { return done((j.content || []).map(function (x) { return x.text || ''; }).join('')); });
    return http(c.base + p.path + '/chat/completions', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, id === 'github' ? { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } : {}, bearer(c)), body: JSON.stringify({ model: c.model, messages: msgs }) })
      .then(function (j) { return done(j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content); });
  }

  // ---- the cards
  var cards = {};
  function setMsg(id, text, cls) { var m = cards[id].msg; m.textContent = text || ''; m.className = 'ai-msg' + (cls ? ' ' + cls : ''); }
  function setDot(id, cls) { cards[id].dot.className = 'ai-dot' + (cls ? ' ' + cls : ''); }
  function readFields(id) {
    var f = cards[id], c = cfg[id] || {};
    c.base = f.base.value.trim(); c.key = f.key ? f.key.value.trim() : (c.key || ''); c.model = f.model.value.trim();
    cfg[id] = c; save(cfg); refreshPicks();
  }
  var BRIDGE = 'http://127.0.0.1:8765', bridgeUp = false;
  function probeBridge() {
    return http(BRIDGE + '/health', {}, 2500).then(function (j) { bridgeUp = !!(j && j.bridge); return j; }, function () { bridgeUp = false; return null; });
  }
  // a server that answers a no-cors request is running, so the block is CORS; one that does not is off, or the browser blocked the local network
  function diagnose(id, err) {
    var c = conf(id), p = byId[id];
    return fetch(c.base, { mode: 'no-cors', signal: window.AbortController ? AbortSignal.timeout(2500) : undefined }).then(function () {
      return p.id === 'ollama' ? 'השרת רץ אבל חוסם את האתר (CORS). הפעל את הגשר המקומי (למעלה), או הגדר OLLAMA_ORIGINS.' : 'השרת רץ אבל חוסם את האתר (CORS). הפעל את הגשר המקומי (למעלה).';
    }, function () {
      return 'לא מגיע ל־' + c.base + '. בדוק שהכלי רץ, ושהדפדפן לא חסם "גישה לרשת המקומית" (אייקון המנעול ליד הכתובת ← הרשאות). או הפעל את הגשר המקומי.';
    });
  }
  function useModels(id, list) {
    var p = byId[id], dl = cards[id].list; dl.replaceChildren();
    p.suggest.concat(list).filter(function (v, i, a) { return v && a.indexOf(v) === i; }).forEach(function (m) { dl.appendChild(el('option', { value: m })); });
    if (!cards[id].model.value && list.length) { cards[id].model.value = list[0]; readFields(id); }
  }
  function check(id) {
    var p = byId[id];
    readFields(id); setDot(id, 'wait'); setMsg(id, 'בודק…');
    if (p.key && !conf(id).key && !p.local) { setDot(id, 'bad'); setMsg(id, 'חסר מפתח API', 'bad'); return Promise.resolve(false); }
    var ok = function (list, via) { useModels(id, list); setDot(id, 'ok'); setMsg(id, 'מחובר' + (via ? ' דרך הגשר' : '') + ' · ' + list.length + ' דגמים', 'ok'); return true; };
    return models(id).then(function (list) { return ok(list, /127\.0\.0\.1:8765/.test(conf(id).base)); }, function (e) {
      if (!p.local && !p.bridgeable) { setDot(id, 'bad'); setMsg(id, e.message, 'bad'); return false; }
      // a local tool that did not answer directly: try through the bridge
      return probeBridge().then(function () {
        if (!bridgeUp) return diagnose(id, e).then(function (t) { setDot(id, 'bad'); setMsg(id, t, 'bad'); return false; });
        var prev = (cfg[id] || {}).base, c = cfg[id] = cfg[id] || {};
        c.base = BRIDGE + '/' + id; cards[id].base.value = c.base;
        return models(id).then(function (list) { save(cfg); return ok(list, true); }, function (e2) {
          c.base = prev || ''; cards[id].base.value = conf(id).base;
          setDot(id, 'bad'); setMsg(id, 'הגשר רץ אבל ' + p.name + ' לא עונה לו. הפעל את ' + p.name + ' ובדוק את הכתובת שלו (משתנה סביבה ' + id.toUpperCase().replace('OPENWEBUI', 'OPENWEBUI') + '_URL).', 'bad'); return false;
        });
      });
    });
  }
  function card(p) {
    var c = conf(p.id), f = { list: el('datalist', { id: 'ai-list-' + p.id }) };
    f.dot = el('span', { class: 'ai-dot' }); f.msg = el('div', { class: 'ai-msg' });
    f.base = el('input', { type: 'text', value: c.base, dir: 'ltr', spellcheck: 'false' });
    var fields = [el('label', null, [el('span', { text: p.local ? 'כתובת (בדרך כלל לא משנים)' : 'כתובת השירות' }), f.base])];
    if (p.key) { f.key = el('input', { type: 'password', value: c.key, dir: 'ltr', autocomplete: 'off', placeholder: p.local ? 'מפתח / טוקן (אם הגדרת)' : 'מפתח API' }); fields.push(el('label', null, [el('span', { text: 'מפתח' }), f.key])); }
    f.model = el('input', { type: 'text', value: c.model, dir: 'ltr', list: 'ai-list-' + p.id, spellcheck: 'false', placeholder: 'דגם' });
    fields.push(el('label', null, [el('span', { text: 'דגם' }), f.model, f.list]));
    p.suggest.forEach(function (m) { f.list.appendChild(el('option', { value: m })); });
    var links = [];
    if (p.keyUrl) links.push(el('a', { href: p.keyUrl, target: '_blank', rel: 'noopener', text: p.free ? 'מפתח חינמי ↗' : 'מפתח API (בתשלום) ↗' }));
    if (p.chat) links.push(el('a', { href: p.chat, target: '_blank', rel: 'noopener', text: 'הצ׳אט החינמי באתר ↗' }));
    if (p.paid) fields.push(el('p', { class: 'ai-note', text: 'ה־API כאן בתשלום לפי שימוש, והוא נפרד מהצ׳אט החינמי. בלי יתרה תקבל שגיאה גם כשהצ׳אט באתר עובד.' }));
    if (p.free) fields.push(el('p', { class: 'ai-note ok', text: p.note || 'יש מכסה חינמית. מפתח אחד, בלי כרטיס אשראי.' }));
    if (links.length) fields.push(el('div', { class: 'ai-links' }, links));
    var test = el('button', { type: 'button', text: 'בדיקה וטעינת דגמים' }), saveB = el('button', { type: 'button', text: 'שמירה' });
    test.addEventListener('click', function () { check(p.id); });
    saveB.addEventListener('click', function () { readFields(p.id); setMsg(p.id, 'נשמר בדפדפן הזה', 'ok'); });
    [f.base, f.key, f.model].forEach(function (i) { if (i) i.addEventListener('input', function () { readFields(p.id); }); });
    cards[p.id] = f;
    if (p.id === 'ollama') {
      var pull = el('input', { type: 'text', dir: 'ltr', list: 'ai-pull-list', placeholder: 'שם דגם להתקנה, למשל deepseek-r1:8b', spellcheck: 'false' });
      var pl = el('datalist', { id: 'ai-pull-list' }); ['deepseek-r1:8b', 'gpt-oss:20b', 'llama3.2', 'qwen2.5:7b', 'gemma3:4b', 'mistral'].forEach(function (m) { pl.appendChild(el('option', { value: m })); });
      var pb = el('button', { type: 'button', text: 'התקנת דגם ב־Ollama' }), pm = el('div', { class: 'ai-msg' });
      pb.addEventListener('click', function () {
        var name = pull.value.trim(); if (!name) { pm.textContent = 'כתוב שם דגם (למשל deepseek-r1:8b: DeepSeek, או gpt-oss:20b: דגם של OpenAI)'; return; }
        pm.className = 'ai-msg'; pm.textContent = 'מתחיל…'; pb.disabled = true;
        var base = conf('ollama').base;
        fetch(base + '/api/pull', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name, stream: true }) }).then(function (r) {
          if (!r.ok || !r.body) throw new Error(r.status);
          var rd = r.body.getReader(), dec = new TextDecoder(), buf = '';
          function pump() { return rd.read().then(function (x) {
            if (x.done) return;
            buf += dec.decode(x.value, { stream: true }); var lines = buf.split('\n'); buf = lines.pop();
            lines.forEach(function (l) { try { var j = JSON.parse(l); pm.textContent = (j.status || '') + (j.total ? ' · ' + Math.round(100 * (j.completed || 0) / j.total) + '%' : ''); } catch (e) {} });
            return pump(); }); }
          return pump();
        }).then(function () { pm.className = 'ai-msg ok'; pm.textContent = 'הדגם ' + name + ' מותקן. לוחצים "בדיקה וטעינת דגמים".'; }, function () { pm.className = 'ai-msg bad'; pm.textContent = 'לא הצליח להתחבר ל־Ollama. הפעל את הגשר ואת Ollama ונסה שוב.'; }).then(function () { pb.disabled = false; });
      });
      f.pull = el('div', { class: 'ai-pull' }, [pull, pl, pb, pm]);
    }
    return el('article', { class: 'ai-card' }, [el('header', null, [f.dot, el('b', { text: p.name }), el('span', { class: 'ai-kind' + (p.local ? ' local' : ''), text: p.local ? 'במחשב שלך' : 'ענן' })])].concat(fields, [el('div', { class: 'acts' }, [test, saveB]), f.msg, f.pull]));
  }

  // ---- the local bridge
  var bridgeEls = {};
  function bridgeCard() {
    var dot = el('span', { class: 'ai-dot' }), msg = el('div', { class: 'ai-msg' });
    var test = el('button', { type: 'button', text: 'בדיקת הגשר' });
    test.addEventListener('click', function () { dot.className = 'ai-dot wait'; probeBridge().then(setBridge); });
    bridgeEls = { dot: dot, msg: msg };
    return el('article', { class: 'ai-card ai-bridge' }, [
      el('header', null, [dot, el('b', { text: 'גשר מקומי (מומלץ ל־Ollama, Open WebUI, OpenClaw)' }), el('span', { class: 'ai-kind local', text: 'במחשב שלך' })]),
      el('p', { class: 'ai-note', text: 'תוכנה קטנה שרצה אצלך במחשב ומחברת את האתר לכלים המקומיים, בלי לשנות הגדרות בכל כלי. מורידים, מפעילים (Node.js 18+ דרוש), משאירים את החלון פתוח ולוחצים כאן "בדיקת הגשר".' }),
      el('div', { class: 'acts' }, [el('a', { class: 'btn btn-gold btn-sm', href: 'local-ai-bridge.mjs', download: 'local-ai-bridge.mjs', text: '⬇ הגשר (local-ai-bridge.mjs)' }), el('a', { class: 'btn btn-ghost btn-sm', href: 'local-ai-bridge.bat', download: 'local-ai-bridge.bat', text: '⬇ הפעלה ב־Windows (.bat)' }), test]),
      msg
    ]);
  }
  function setBridge(j) {
    if (!bridgeEls.dot) return;
    if (!j || !j.bridge) { bridgeEls.dot.className = 'ai-dot bad'; bridgeEls.msg.className = 'ai-msg bad'; bridgeEls.msg.textContent = 'הגשר לא רץ. מפעילים: node local-ai-bridge.mjs (או לחיצה כפולה על ה־.bat).'; return; }
    bridgeEls.dot.className = 'ai-dot ok'; bridgeEls.msg.className = 'ai-msg ok';
    var t = j.targets || {};
    bridgeEls.msg.textContent = 'הגשר רץ · Ollama ' + (t.ollama ? '✓' : '✗') + ' · Open WebUI ' + (t.openwebui ? '✓' : '✗') + ' · OpenClaw ' + (t.openclaw ? '✓' : '✗');
  }

  // ---- the lab
  function ready(p) { var c = conf(p.id); return p.local ? !!c.model : (!!c.key && !!c.model); }
  function refreshPicks() {
    var n = P.filter(ready).length, st = $('ai-status');
    if (st) st.textContent = 'מוגדרים ' + n + ' מתוך ' + P.length;
  }
  function result(p, r, bad) {
    var kids = [el('header', null, [el('b', { text: p.name }), el('span', { dir: 'ltr', text: (conf(p.id).model || '') + (r.ms ? ' · ' + (r.ms / 1000).toFixed(1) + 's' : '') })]), el('pre', { text: r.text })];
    if (bad) {
      var acts = [];
      var set = el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: '⚙ להגדרות' });
      set.addEventListener('click', function () { tab('settings'); });
      acts.push(set);
      if (p.chat) {
        var ch = el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'צ׳אט חינמי (השאלה תועתק) ↗' });
        ch.addEventListener('click', function () {
          var q = $('ai-prompt').value.trim();
          (navigator.clipboard && q ? navigator.clipboard.writeText(q) : Promise.resolve()).catch(function () {}).then(function () { window.open(p.chat, '_blank', 'noopener'); });
        });
        acts.push(ch);
      }
      kids.push(el('div', { class: 'acts ai-res-acts' }, acts));
    }
    return el('article', { class: 'ai-res' + (bad ? ' bad' : '') }, kids);
  }
  function tab(name) {
    Array.prototype.forEach.call(document.querySelectorAll('.ai-tab'), function (b) { var on = b.getAttribute('data-tab') === name; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    $('ai-panel-ask').hidden = name !== 'ask'; $('ai-panel-settings').hidden = name !== 'settings';
    try { history.replaceState(null, '', name === 'settings' ? '#settings' : location.pathname); } catch (e) {}
  }
  // a local tool that does not answer directly is tried again through the bridge
  function askSmart(id, prompt, sys) {
    var p = byId[id];
    return ask(id, prompt, sys).catch(function (e) {
      if (!(p.local || p.bridgeable) || !/אין חיבור/.test(e.message) || /127\.0\.0\.1:8765/.test(conf(id).base)) throw e;
      return probeBridge().then(function () {
        if (!bridgeUp) throw e;
        var c = cfg[id] = cfg[id] || {}, prev = c.base;
        c.base = BRIDGE + '/' + id;
        return ask(id, prompt, sys).then(function (r) { save(cfg); if (cards[id]) cards[id].base.value = c.base; return r; }, function (e2) { c.base = prev || ''; throw e2; });
      });
    });
  }
  // every model gets the question; whoever cannot answer says why
  function send() {
    var prompt = $('ai-prompt').value.trim(), sys = $('ai-sys').value.trim();
    if (!prompt) { $('ai-state').textContent = 'כתוב שאלה'; return; }
    $('ai-state').textContent = 'שולח לכולם…'; $('ai-send').disabled = true;
    var out = $('ai-results'); out.replaceChildren();
    Promise.all(P.map(function (p) {
      var holder = el('article', { class: 'ai-res' }, [el('header', null, [el('b', { text: p.name })]), el('pre', { text: 'חושב…' })]);
      out.appendChild(holder);
      if (!ready(p)) { holder.replaceWith(result(p, { text: p.local ? 'לא מחובר. הפעל את ' + p.name + ' (או את הגשר המקומי) ובדוק חיבור בלשונית הגדרות.' : 'חסר מפתח. נרשמים ומדביקים מפתח בלשונית הגדרות.' }, true)); return null; }
      return askSmart(p.id, prompt, sys).then(function (r) { holder.replaceWith(result(p, r)); }, function (e) { holder.replaceWith(result(p, { text: e.message }, true)); });
    })).then(function () { $('ai-state').textContent = ''; $('ai-send').disabled = false; });
  }

  window.HasadnaAuth.ready.then(function (who) {
    var sec = $('ai');
    if (!who || who.role !== 'admin') { if (sec) sec.remove(); return; }   // nobody else even gets the cards
    var grid = $('ai-grid'); grid.replaceChildren();
    // the vault copy fills anything this browser does not have yet
    window.HasadnaAuth.api('ai-vault-get').then(function (j) {
      if (!j || !j.ok) { vaultOK = false; showVault(); return; }
      vaultOK = true;
      var remote = {}; try { remote = JSON.parse(j.blob || '{}') || {}; } catch (e) {}
      var changed = false;
      Object.keys(remote).forEach(function (id) {
        if (!byId[id]) return;
        var l = cfg[id] = cfg[id] || {}, r = remote[id] || {};
        ['base', 'key', 'model'].forEach(function (k) { if (!l[k] && r[k]) { l[k] = r[k]; changed = true; } });
      });
      if (changed) { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} P.forEach(function (p) { var f = cards[p.id], c = conf(p.id); if (f) { f.base.value = c.base; if (f.key) f.key.value = c.key; f.model.value = c.model; } }); refreshPicks(); }
      // and whatever only this browser has goes up, so the two never differ
      if (Object.keys(cfg).length) save(cfg); else showVault();
    }, function () { vaultOK = false; showVault(); });
    grid.appendChild(bridgeCard());
    P.forEach(function (p) { grid.appendChild(card(p)); });
    refreshPicks();
    probeBridge().then(function (j) { setBridge(j); });
    $('ai-send').addEventListener('click', send);
    Array.prototype.forEach.call(document.querySelectorAll('.ai-tab'), function (b) { b.addEventListener('click', function () { tab(b.getAttribute('data-tab')); }); });
    var reg = $('ai-reg');
    var tbl = el('table', { class: 'ptable ai-regtbl' }, [el('thead', null, [el('tr', null, ['שירות', 'סוג', 'הרשמה', 'מפתח', 'צ׳אט חינמי'].map(function (h) { return el('th', { text: h }); }))])]);
    var tb = el('tbody');
    P.forEach(function (p) {
      var a = function (u, t) { return u ? el('a', { href: u, target: '_blank', rel: 'noopener', text: t + ' ↗' }) : el('span', { class: 'muted', text: '—' }); };
      tb.appendChild(el('tr', null, [el('td', { text: p.name }), el('td', { text: p.local ? 'במחשב שלך (חינם)' : p.free ? 'חינמי (מפתח אחד)' : 'API בתשלום' }),
        el('td', null, [a(p.signup, 'הרשמה')]), el('td', null, [p.local ? el('span', { class: 'muted', text: 'לא צריך' }) : a(p.keyUrl, 'הפקת מפתח')]), el('td', null, [a(p.chat, 'לצ׳אט')])]));
    });
    tbl.appendChild(tb); reg.appendChild(el('div', { class: 'table-wrap' }, [tbl]));
    if (location.hash === '#settings') tab('settings');
    $('ai-test-all').addEventListener('click', function () { P.forEach(function (p) { var c = conf(p.id); if (p.local || c.key) check(p.id); }); });
    $('ai-export').addEventListener('click', function () {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(cfg, null, 1)], { type: 'application/json' }));
      a.download = 'spider-ai-settings.json'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    });
    $('ai-import').addEventListener('change', function () {
      var f = this.files && this.files[0]; if (!f) return;
      f.text().then(function (t) {
        var o = JSON.parse(t); Object.keys(o).forEach(function (id) { if (byId[id]) cfg[id] = Object.assign(cfg[id] || {}, o[id]); });
        save(cfg); location.reload();
      }).catch(function () { alert('הקובץ לא תקין'); });
    });
    $('ai-wipe').addEventListener('click', function () {
      if (!confirm('למחוק את כל המפתחות והכתובות, גם מהדפדפן וגם מהכספת? לא ניתן לשחזר.')) return;
      try { localStorage.removeItem(KEY); } catch (e) {} cfg = {};
      window.HasadnaAuth.api('ai-vault-set', { blob: '' }).then(function () { location.reload(); }, function () { location.reload(); });
    });
  });
})();
