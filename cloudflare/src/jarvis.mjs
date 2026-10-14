// JARVIS (the personal assistant with the talking face, repo jarvis-web) asks here instead of n8n's Chat Trigger, so it works with no
// execution cap. It uses the first AI key that answers: Gemini, then Claude, then OpenAI, so one empty account does not stop it.
const SYSTEM = 'אתה JARVIS, העוזר האישי של חיים קריספין (SPIDER). אתה עונה בעברית טבעית, חמה וקצרה (עד ארבעה משפטים, בלי רשימות ארוכות ובלי כותרות), כי התשובה גם מוקראת בקול. ' +
  'אתה עוזר בעסקים, שיווק, טכנולוגיה, אוטומציה, כתיבה וכל שאלה יומיומית. אם אינך יודע, אמור זאת ואל תמציא. לשיחה עם חיים: וואטסאפ 054-4979771.';

const seen = new Map();   // per address: the times of its latest questions (this isolate only; a cap against running up a bill)
export function allowed(ip) {
  const now = Date.now(), a = (seen.get(ip) || []).filter((t) => now - t < 10 * 60000);
  if (a.length >= 40) { seen.set(ip, a); return false; }
  a.push(now); seen.set(ip, a);
  if (seen.size > 5000) seen.clear();
  return true;
}

const clip = (s, n) => String(s || '').slice(0, n);

async function post(url, headers, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(45000) });
  const t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch (e) { /* not json */ }
  return { ok: r.ok, status: r.status, j };
}

// turns: [{role:'user'|'assistant', text}] ending with the new question; system: the instructions. Returns {text, by} or {text:'', tried}.
export async function askChain(env, system, turns, maxTokens = 700) {
  const tried = [];
  turns = turns.slice(-12);
  if (env.GEMINI_API_KEY) {
    const r = await post('https://generativelanguage.googleapis.com/v1beta/models/' + (env.GEMINI_MODEL || 'gemini-flash-latest') + ':generateContent', { 'x-goog-api-key': env.GEMINI_API_KEY },
      { systemInstruction: { parts: [{ text: system }] }, contents: turns.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] })), generationConfig: { maxOutputTokens: maxTokens } }).catch(() => null);
    const c = r && r.ok && r.j.candidates && r.j.candidates[0];
    const text = c && c.content ? (c.content.parts || []).map((x) => x.text || '').join('').trim() : '';
    if (text) return { text, by: 'gemini' };
    tried.push('gemini ' + (r ? r.status : 'net'));
  }
  if (env.ANTHROPIC_API_KEY) {
    const r = await post('https://api.anthropic.com/v1/messages', { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      { model: env.CLAUDE_MODEL || 'claude-sonnet-5-5', max_tokens: maxTokens, system, messages: turns.map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })) }).catch(() => null);
    const text = r && r.ok ? (r.j.content || []).map((x) => x.text || '').join('').trim() : '';
    if (text) return { text, by: 'claude' };
    tried.push('claude ' + (r ? r.status : 'net'));
  }
  if (env.OPENAI_API_KEY) {
    const r = await post('https://api.openai.com/v1/chat/completions', { Authorization: 'Bearer ' + env.OPENAI_API_KEY },
      { model: env.OPENAI_MODEL || 'gpt-4.1-mini', max_tokens: maxTokens, messages: [{ role: 'system', content: system }, ...turns.map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }))] }).catch(() => null);
    const text = r && r.ok && r.j.choices && r.j.choices[0] ? String(r.j.choices[0].message.content || '').trim() : '';
    if (text) return { text, by: 'openai' };
    tried.push('openai ' + (r ? r.status : 'net'));
  }
  // last resort, no key needed: Pollinations' free text endpoint (OpenAI-compatible). Quality and speed vary; a key above is better.
  if (env.FREE_AI !== '0') {
    const r = await post('https://text.pollinations.ai/openai', {}, { model: 'openai', private: true, messages: [{ role: 'system', content: system }, ...turns.map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }))] }).catch(() => null);
    const text = r && r.ok && r.j.choices && r.j.choices[0] ? String(r.j.choices[0].message.content || '').trim() : '';
    if (text && !/pollinations|deprecated|IMPORTANT NOTICE/i.test(text.slice(0, 200))) return { text, by: 'free' };
    tried.push('free ' + (r ? r.status : 'net'));
  }
  return { text: '', tried };
}
export const jarvisAsk = (env, hist) => askChain(env, SYSTEM, hist, 700);

export const NO_ANSWER = 'כרגע אני לא מצליח לענות: אף אחד ממפתחות ה־AI בשרת לא זמין (חסר מפתח או שאין יתרה). אפשר להוסיף מפתח Gemini חינמי ב־aistudio.google.com ולשמור אותו כסוד GEMINI_API_KEY ב־GitHub. בינתיים אפשר לדבר עם חיים בוואטסאפ: 054-4979771.';

export function jarvisInput(body) {
  const sid = clip(body.sessionId, 64).replace(/[^\w-]/g, '') || 'anon';
  return { sid, text: clip(body.chatInput || body.question, 1500).trim() };
}
