/* ארון־פלאן — הדרכה קולית באנגלית מקצועית (קול נשי של הדפדפן) וצלילי עמדת החיווט.
   הטקסט נבנה מנתוני החוט: חתך, צבע, שרוול, אורך, מאיפה לאיפה, מסלול בתעלות ומה החוט עושה. */

const TYPE_EN = {
  main_switch: 'main isolator', mcb: 'circuit breaker', rcd: 'residual current device', fuse: 'fuse', psu: 'power supply',
  transformer: 'control transformer', socket: 'service socket', meter: 'meter', plc: 'PLC', io: 'I/O card', relay: 'relay',
  timer: 'timer relay', thermostat: 'thermostat', other: 'device', contactor: 'contactor', overload: 'overload relay',
  mpcb: 'motor protection breaker', vfd: 'frequency drive', softstarter: 'soft starter', terminal: 'terminal strip',
  pe_bar: 'earth bar', button: 'push button', selector: 'selector switch', estop: 'emergency stop', lamp: 'pilot light',
  door_meter: 'door meter', motor: 'motor', sensor: 'sensor', valve: 'valve', fan: 'fan', heater: 'heater', field: 'field device'
};
const FUNC_EN = {
  power: 'Power circuit', neutral: 'Neutral conductor', ctrl_ac: 'A C control circuit', ctrl_dc: 'D C control circuit',
  dc0: 'Zero volt return', foreign: 'Volt-free contact, external voltage', signal: 'Analogue signal', comm: 'Network cable', pe: 'Protective earth'
};
const KIND_EN = {
  coil: 'the coil terminal', coil0: 'the coil return', power: 'a power terminal', pole: 'a main contact', input: 'a digital input',
  output: 'a digital output', 'dc+': 'the plus terminal', dc0: 'the zero volt terminal', no: 'a normally-open contact',
  nc: 'a normally-closed contact', com: 'the common contact', co: 'a changeover contact', pe: 'the earth terminal',
  neutral: 'the neutral terminal', comm: 'a communication port', analog: 'an analogue channel', 'load+': 'the supply terminal', load0: 'the return terminal', sig: 'the signal core'
};

/* תג או הדק → מה שהקול אומר: ‎-KSFT → "K S F T", ES15.3 → "E S 15 point 3", +24V → "plus 24 volts" */
export function sayId(s) {
  let t = String(s == null ? '' : s).trim().replace(/^[-=+](?=[A-Z])/i, '');
  if (/^(\+24V?|24V)$/i.test(t)) return 'plus 24 volts';
  if (/^0V(\/\d+)?$/i.test(t)) return 'zero volts';
  if (/^\+$/.test(t)) return 'plus';
  if (/^-$/.test(t)) return 'minus';
  if (/^PE$/i.test(t)) return 'P E';
  t = t.replace(/\+/g, ' plus ').replace(/([A-Za-z])-/g, '$1 minus ');
  t = t.replace(/\./g, ' point ').replace(/\//g, ' ').replace(/_/g, ' ');
  t = t.replace(/([A-Za-z]+)/g, (m) => (m === m.toUpperCase() && (m.length <= 3 || !/[AEIOU]/.test(m)) ? ' ' + m.split('').join(' ') + ' ' : ' ' + m.toLowerCase() + ' '));
  /* מספרי חוטים בני 3 ספרות נקראים ספרה-ספרה, כמו בעבודה בשטח */
  t = t.replace(/\b(\d)(\d)(\d)\b/g, '$1 $2 $3');
  return t.replace(/\s+/g, ' ').trim();
}
const num = (s) => {
  const n = Number(s);
  return n < 1 ? 'nought point ' + String(n).split('.')[1].split('').join(' ') : String(n).replace('.', ' point ');
};
const mm2 = (s) => {
  const n = Number(s);
  if (n === 0.75) return 'nought point seven five square millimetres';
  if (n === 0.5) return 'nought point five square millimetres';
  if (n === 0.25) return 'nought point two five square millimetres';
  if (n === 0.34) return 'nought point three four square millimetres';
  return String(n).replace('.', ' point ') + ' square millimetres';
};
const latin = (s) => { const m = /^([A-Za-z][A-Za-z0-9 _.\/+()'-]{2,60})/.exec(String(s || '')); return m ? m[1].replace(/[\s(—-]+$/, '').trim() : ''; };

/* הטקסט באנגלית לחוט אחד: רשימת משפטים (כל משפט מודגש בזמן שהוא נאמר) */
export function englishSteps(w, P, L, C, E) {
  const cb = {};
  P.components.forEach((c) => { cb[c.tag] = c; });
  const A = cb[w.from.tag] || { type: 'other' }, B = cb[w.to.tag] || { type: 'other' };
  const role = (comp, e) => {
    let r = E.termRole(comp.type, e.term);
    if (comp.type === 'io' && comp.io && r.kind === 'io') return comp.io === 'out' ? 'a digital output' : 'a digital input';
    return KIND_EN[r.kind] || '';
  };
  const dev = (comp, e) => `${TYPE_EN[comp.type] || 'device'} ${sayId(e.tag)}, terminal ${sayId(e.term)}`;
  const col = C.COLORS[w.color] || { en: 'black' };
  const r = L.routes[w.id];
  const fer = C.ferrule(w.section, false);
  const out = [];
  out.push(`Wire ${sayId(w.no)}. ${FUNC_EN[w.func] || 'Control circuit'}${w.potential && !/^(L[123]|N|PE)$/.test(w.potential) ? ', ' + sayId(w.potential) : ''}.`);
  const tag = latin(w.desc);
  if (tag) out.push(`Signal: ${tag.toLowerCase()}.`);
  const type = /^H0[57]V/i.test(w.wireType) ? w.wireType.replace(/-/g, ' ') : /גשר|jumper/i.test(w.wireType) ? 'a comb jumper' : /כבל|LiY|NYY|ÖLFLEX|SICK|Cat/i.test(w.wireType) ? 'the field cable, ' + w.wireType.replace(/×/g, ' by ').replace(/[^A-Za-z0-9 .]/g, ' ') : 'single-core flexible wire';
  if (/comb jumper/.test(type)) out.push(`Fit a comb jumper between terminal ${sayId(w.from.term)} and terminal ${sayId(w.to.term)} on ${sayId(w.from.tag)}.`);
  else {
    out.push(`Use ${type}, ${mm2(w.section)}, ${col.en}${w.colorSource === 'standard' ? ', per the standard colour code' : ''}.`);
    if (r && r.len) out.push(`Cut about ${Math.round(r.len / 10)} centimetres${r.door ? ', including the hinge loop' : ''}.`);
    else out.push('Cut to length on site.');
    out.push(`Strip ${fer.strip} millimetres and crimp a ${C.COLORS[fer.color].en} ${num(fer.size)} ferrule${w.twinFrom || w.twinTo ? ', and a twin ferrule at the shared terminal' : ''}.`);
    out.push(`Slide marker sleeves ${sayId(w.no)} onto both ends.`);
  }
  out.push(`Start at ${dev(A, w.from)}${role(A, w.from) ? ', ' + role(A, w.from) : ''}.`);
  const ducts = E.routeDucts ? E.routeDucts(L, w.id) : [];
  if (ducts.length) out.push('Route ' + ducts.map((d) => d.kind === 'h' ? `along horizontal duct ${d.n}` : d.kind === 'v' ? `down the ${d.side === 'L' ? 'left' : 'right'}-hand vertical duct` : d.kind === 'door' ? 'through the door loop at the hinge' : 'out through the gland plate to the field').join(', then ') + '.');
  out.push(`Finish at ${dev(B, w.to)}${role(B, w.to) ? ', ' + role(B, w.to) : ''}.`);
  out.push(purposeEn(w, A, B, role));
  const push = P.settings && P.settings.termTech === 'pushin';
  out.push(push && (A.type === 'terminal' || B.type === 'terminal') ? 'Push-in terminals need no torque. Push fully home, then give a gentle pull test.' : `Tighten to the maker's torque, typically ${w.section <= 2.5 ? 'half to point eight' : 'one point two to one point five'} newton metres, then give a gentle pull test.`);
  return out;
}

function purposeEn(w, A, B, role) {
  const ra = role(A, w.from), rb = role(B, w.to);
  const nameB = `${sayId(w.to.tag)}`, nameA = `${sayId(w.from.tag)}`;
  if (w.func === 'pe') return 'Purpose: protective earth bond. If a fault reaches the metal body, the current flows here and the protection trips. Never omit it.';
  if (/comb|גשר/.test(w.wireType)) return 'Purpose: it shares the same potential between neighbouring terminals.';
  if (rb === 'the coil terminal') return `Purpose: it energises the coil of ${nameB}. When this wire is live, the relay picks up and its contacts change over.`;
  if (ra === 'the coil terminal') return `Purpose: it energises the coil of ${nameA}.`;
  if (rb === 'the coil return' || ra === 'the coil return') return 'Purpose: the coil return to zero volts. Without it the coil will not pull in.';
  if (rb === 'a digital input') return `Purpose: it brings the status of ${nameA} to PLC input ${sayId(w.to.term)} on ${nameB}. When the contact closes, the input LED lights.`;
  if (ra === 'a digital input') return `Purpose: it brings the status of ${nameB} to PLC input ${sayId(w.from.term)}.`;
  if (ra === 'a digital output') return `Purpose: PLC output ${sayId(w.from.term)} drives ${nameB}. When the program switches the output on, ${nameB} receives twenty four volts.`;
  if (w.func === 'foreign') return 'Purpose: a volt-free contact to field equipment. The voltage comes from the gate or door controller and stays live when the cabinet main switch is off. Treat it as live.';
  if (w.func === 'power') return `Purpose: a power conductor${w.potential ? ', phase ' + sayId(w.potential) : ''}. It carries load current, so its size follows the protective device upstream.`;
  if (w.func === 'neutral') return 'Purpose: the neutral return of the single-phase loads.';
  if (w.func === 'dc0') return 'Purpose: the zero volt return of the control circuit.';
  if (w.func === 'comm') return 'Purpose: a network link. Keep it away from power cables and use a pre-made patch lead where possible.';
  if (w.func === 'signal') return 'Purpose: a data signal. Route it away from power cables.';
  return 'Purpose: it distributes control voltage to the next device.';
}

/* ---------- קול ---------- */
const FEMALE = ['Google UK English Female', 'Microsoft Libby', 'Microsoft Sonia', 'Microsoft Jenny', 'Microsoft Aria', 'Microsoft Zira', 'Samantha', 'Serena', 'Kate', 'Karen', 'Moira', 'Tessa', 'Fiona', 'Victoria', 'Allison', 'Ava', 'Susan', 'Hazel', 'Emma', 'Female'];

export class Speaker {
  constructor() {
    this.ok = typeof window !== 'undefined' && 'speechSynthesis' in window;
    this.rate = 0.95;
    this.voiceName = '';
    this.voices = [];
    this.onSentence = () => {};
    this.onEnd = () => {};
    if (this.ok) {
      const load = () => { this.voices = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang)); if (this.onVoices) this.onVoices(this.voices); };
      load();
      speechSynthesis.addEventListener('voiceschanged', load);
    }
  }
  /* הקול הנשי הכי טוב שיש במכשיר */
  pick() {
    if (this.voiceName) { const v = this.voices.find((x) => x.name === this.voiceName); if (v) return v; }
    for (const n of FEMALE) { const v = this.voices.find((x) => x.name.includes(n) && !/male\b/i.test(x.name.replace(/female/i, ''))); if (v) return v; }
    return this.voices.find((v) => /en-GB/i.test(v.lang)) || this.voices[0] || null;
  }
  isFemale(v) { return Boolean(v && FEMALE.some((n) => v.name.includes(n))); }
  speak(sentences) {
    if (!this.ok) return;
    this.stop();
    const v = this.pick();
    const female = this.isFemale(v);
    sentences.forEach((s, i) => {
      const u = new SpeechSynthesisUtterance(s);
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-GB';
      u.rate = this.rate;
      u.pitch = female ? 1 : 1.25;
      u.onstart = () => this.onSentence(i);
      if (i === sentences.length - 1) u.onend = () => this.onEnd();
      speechSynthesis.speak(u);
    });
  }
  say(text) { this.speak([text]); }
  stop() { if (this.ok) speechSynthesis.cancel(); }
}

/* ---------- צלילים: "קליק" של מהדק, וצליל הצלחה בסיום קבוצה ---------- */
let actx = null;
function ctx() { if (!actx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) actx = new AC(); } return actx; }
export function sfx(kind) {
  const a = ctx();
  if (!a) return;
  const t = a.currentTime;
  const tone = (f, start, dur, type = 'sine', vol = 0.12) => {
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t + start);
    g.gain.setValueAtTime(0.0001, t + start);
    g.gain.exponentialRampToValueAtTime(vol, t + start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + start + dur);
    o.connect(g).connect(a.destination);
    o.start(t + start); o.stop(t + start + dur + 0.02);
  };
  if (kind === 'click') { tone(1900, 0, 0.035, 'square', 0.05); tone(620, 0.03, 0.08, 'triangle', 0.09); }
  else if (kind === 'step') tone(880, 0, 0.05, 'sine', 0.05);
  else if (kind === 'milestone') { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.22, 'triangle', 0.08)); }
}
