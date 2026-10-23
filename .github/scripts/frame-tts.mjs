// Speaks the narration of a Frame Studio film (videos/promo-src/<film>/script.json) in Hebrew and English and writes one
// m4a per scene and language to <out>/<lang>/<id>.m4a, with report.json (which voice, how long). Keys are read like the
// deploys read them (each secret on its own, or inside SPIDER); none is ever printed.
// Order per language: Gemini TTS → Azure Speech → ElevenLabs → Microsoft Edge voices (edge-tts, no key). The first one that
// speaks the first scene is used for the whole language, and the others stand in only when they are not Edge, so the
// film keeps one voice. A scene its voice cannot speak today (quota) stays missing and is spoken on the next run.
//   node .github/scripts/frame-tts.mjs videos/promo-src/app-tutorial/script.json out
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const [scriptPath, out] = process.argv.slice(2);
const script = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));
const combined = [process.env.SPIDER, process.env.HAIM_WEB_KEY].filter(Boolean).join('\n');
const label = (name, re) => (process.env[name] || (combined.match(new RegExp(name + '\\W*(' + re + ')')) || [])[1] || '').trim();
const pick = (re) => (combined.match(re) || [])[0] || '';
const KEYS = {
  gemini: label('GEMINI_API_KEY', 'AIza[\\w-]{30,45}') || pick(/\bAIza[\w-]{35}\b/),
  azure: label('AZURE_SPEECH_KEY', '[A-Za-z0-9]{32,100}'), region: label('AZURE_SPEECH_REGION', '[a-z0-9]{4,30}') || 'westeurope',
  eleven: label('ELEVENLABS_API_KEY', '(?:sk_)?[A-Za-z0-9]{32,80}') || pick(/\bsk_[a-f0-9]{40,}\b/),
};
const ffmpeg = (args) => { const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args]); if (r.status) throw new Error('ffmpeg: ' + String(r.stderr).slice(0, 300)); };
const dur = (f) => Number(String(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).stdout).trim());

const STYLE = {
  he: 'קרא בעברית ברורה ונעימה, בקצב רגוע ומקצועי של סרטון הדרכה, עם הגייה מדויקת: ',
  en: 'Read in clear, warm, professional English, at a calm tutorial pace: ',
};
const VOICES = {
  gemini: { he: 'Charon', en: 'Charon' },
  azure: { he: 'he-IL-AvriNeural', en: 'en-US-AndrewNeural' },
  eleven: { he: 'pNInz6obpgDQGcFmaJgB', en: 'pNInz6obpgDQGcFmaJgB' },
  edge: { he: 'he-IL-AvriNeural', en: 'en-US-AndrewNeural' },
};

async function gemini(text, lang, file) {
  if (!KEYS.gemini) throw new Error('no key');
  let last = '';
  for (const model of ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts']) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'x-goog-api-key': KEYS.gemini, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: STYLE[lang] + text }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICES.gemini[lang] } } } } }),
    });
    const j = await r.json().catch(() => ({}));
    const part = j && j.candidates && j.candidates[0] && j.candidates[0].content && (j.candidates[0].content.parts || []).find((x) => x.inlineData);
    if (part) {
      const raw = file + '.pcm'; fs.writeFileSync(raw, Buffer.from(part.inlineData.data, 'base64'));
      const rate = Number((/rate=(\d+)/.exec(part.inlineData.mimeType || '') || [])[1] || 24000);
      ffmpeg(['-f', 's16le', '-ar', String(rate), '-ac', '1', '-i', raw, file]); fs.rmSync(raw); return model + '/' + VOICES.gemini[lang];
    }
    // 429: each model has its own quota, so the next one is asked; 404: the model is gone
    if (r.status !== 404 && r.status !== 429) throw new Error('gemini ' + r.status + ' ' + String((j.error && j.error.message) || '').slice(0, 160));
    last = 'gemini ' + r.status + ' ' + String((j.error && j.error.message) || '').slice(0, 160);
  }
  if (last) throw new Error(last);
  throw new Error('gemini: no model');
}
async function azure(text, lang, file) {
  if (!KEYS.azure) throw new Error('no key');
  const v = VOICES.azure[lang], xml = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const ssml = `<speak version="1.0" xml:lang="${lang === 'he' ? 'he-IL' : 'en-US'}"><voice name="${v}"><prosody rate="-6%">${xml}</prosody></voice></speak>`;
  const r = await fetch(`https://${KEYS.region}.tts.speech.microsoft.com/cognitiveservices/v1`, { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': KEYS.azure, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-48khz-192kbitrate-mono-mp3' }, body: ssml });
  if (!r.ok) throw new Error('azure ' + r.status);
  const mp3 = file + '.mp3'; fs.writeFileSync(mp3, Buffer.from(await r.arrayBuffer())); ffmpeg(['-i', mp3, file]); fs.rmSync(mp3); return 'azure/' + v;
}
async function eleven(text, lang, file) {
  if (!KEYS.eleven) throw new Error('no key');
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICES.eleven[lang]}`, { method: 'POST', headers: { 'xi-api-key': KEYS.eleven, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify({ text, model_id: 'eleven_v3' }) });
  if (!r.ok) throw new Error('elevenlabs ' + r.status);
  const mp3 = file + '.mp3'; fs.writeFileSync(mp3, Buffer.from(await r.arrayBuffer())); ffmpeg(['-i', mp3, file]); fs.rmSync(mp3); return 'elevenlabs/eleven_v3';
}
async function edge(text, lang, file) {
  const mp3 = file + '.mp3', v = VOICES.edge[lang];
  const r = spawnSync('edge-tts', ['--voice', v, '--rate=-6%', '--text', text, '--write-media', mp3]);
  if (r.status || !fs.existsSync(mp3)) throw new Error('edge-tts ' + String(r.stderr).slice(0, 200));
  ffmpeg(['-i', mp3, file]); fs.rmSync(mp3); return 'edge/' + v;
}
const PROVIDERS = { gemini, azure, eleven, edge };

// Clips already in <out> (from an earlier run, kept on the branch ci-tts) are not spoken again. Every scene is also
// spoken with the Edge voice into <out>/<lang>-edge, so a film whose main voice ran out of quota can still use one voice.
const old = fs.existsSync(path.join(out, 'report.json')) ? JSON.parse(fs.readFileSync(path.join(out, 'report.json'), 'utf8')) : { langs: {} };
const report = { made: new Date().toISOString(), langs: {} };
for (const lang of ['he', 'en', 'he-edge', 'en-edge']) {
  const base = lang.slice(0, 2), only = lang.endsWith('-edge') ? 'edge' : '';
  const prev = Object.fromEntries(((old.langs[lang] || {}).scenes || []).filter((x) => x.voice).map((x) => [x.id, x]));
  fs.mkdirSync(path.join(out, lang), { recursive: true });
  let chosen = null; const tried = [];
  report.langs[lang] = { scenes: [] };
  for (const sc of script.scenes) {
    const wav = path.join(out, lang, sc.id + '.wav'), m4a = path.join(out, lang, sc.id + '.m4a');
    if (prev[sc.id] && fs.existsSync(m4a)) { report.langs[lang].scenes.push(prev[sc.id]); if (!chosen) chosen = prev[sc.id].voice.startsWith('edge') ? 'edge' : prev[sc.id].voice.startsWith('gemini') ? 'gemini' : chosen; continue; }
    const main = Object.keys(PROVIDERS).filter((p) => p !== 'edge' || chosen === 'edge');
    const order = only ? [only] : chosen ? [chosen, ...main.filter((p) => p !== chosen)] : Object.keys(PROVIDERS);
    let voice = '';
    for (const p of order) {
      try { voice = await PROVIDERS[p](sc[base], base, wav); if (!chosen) chosen = p; break; } catch (e) { tried.push(p + ': ' + String(e.message || e).slice(0, 200)); }
    }
    if (!voice) { report.langs[lang].scenes.push({ id: sc.id, error: 'no voice' }); continue; }
    // the voice levelled and a little air at both ends
    ffmpeg(['-i', wav, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,loudnorm=I=-16:TP=-1.5:LRA=7,apad=pad_dur=0.15', '-ar', '48000', '-c:a', 'aac', '-b:a', '160k', m4a]);
    fs.rmSync(wav);
    report.langs[lang].scenes.push({ id: sc.id, voice, seconds: Math.round(dur(m4a) * 100) / 100 });
    console.log(lang, sc.id, voice, dur(m4a).toFixed(2) + 's');
  }
  report.langs[lang].provider = chosen; report.langs[lang].tried = tried.slice(0, 12);
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
const missing = Object.entries(report.langs).filter(([k]) => k.endsWith('-edge')).flatMap(([, l]) => l.scenes.filter((s) => s.error));
if (missing.length) { console.error('missing:', JSON.stringify(missing)); process.exitCode = 1; }
