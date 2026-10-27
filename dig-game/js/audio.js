/* שכבות — sound effects synthesized with WebAudio (no audio files). */
(function () {
  'use strict';
  let ctx = null, master = null, noiseBuf = null, enabled = true;

  function ensure() {
    if (!enabled) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function noise(dur, { type = 'lowpass', freq = 800, q = 1, vol = 0.5, attack = 0.002, at = 0 } = {}) {
    const c = ensure(); if (!c) return;
    const t = c.currentTime + at;
    const src = c.createBufferSource(); src.buffer = noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }

  function tone(freq, dur, { type = 'sine', vol = 0.3, at = 0, slide = 0, attack = 0.005 } = {}) {
    const c = ensure(); if (!c) return;
    const t = c.currentTime + at;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  const SFX = {
    hit(hard = 0.3) {
      noise(0.09 + hard * 0.05, { freq: 900 + hard * 2200, vol: 0.45 });
      tone(110 + hard * 120, 0.08, { type: 'triangle', vol: 0.35, slide: 0.5 });
    },
    trowel() { noise(0.08, { type: 'bandpass', freq: 1800, q: 2, vol: 0.4 }); },
    brush() { noise(0.16, { type: 'highpass', freq: 3200, vol: 0.18, attack: 0.04 }); },
    breakTile(hard = 0.3) {
      noise(0.22, { freq: 500 + hard * 900, vol: 0.5 });
      noise(0.12, { type: 'bandpass', freq: 2400, q: 1.5, vol: 0.2, at: 0.03 });
    },
    crack() {
      tone(2400, 0.05, { type: 'square', vol: 0.12, slide: 0.4 });
      noise(0.12, { type: 'highpass', freq: 2500, vol: 0.35 });
    },
    reveal() { tone(880, 0.12, { vol: 0.16 }); tone(1320, 0.18, { vol: 0.12, at: 0.06 }); },
    find(rank = 0) {
      const notes = [523, 659, 784, 1047, 1319, 1568, 2093];
      const n = 2 + rank;
      for (let i = 0; i < n; i++) tone(notes[i], 0.28 + rank * 0.05, { type: i % 2 ? 'triangle' : 'sine', vol: 0.18, at: i * 0.07 });
      if (rank >= 3) for (let i = 0; i < 6; i++) tone(2093 + i * 220, 0.12, { vol: 0.05, at: 0.45 + i * 0.05 });
    },
    coin() { tone(988, 0.07, { type: 'square', vol: 0.08 }); tone(1319, 0.16, { type: 'square', vol: 0.08, at: 0.07 }); },
    boom() { noise(0.9, { freq: 260, vol: 0.9, attack: 0.005 }); tone(70, 0.6, { type: 'sine', vol: 0.6, slide: 0.4 }); },
    sonar() { tone(660, 0.6, { vol: 0.18, slide: 1.6 }); tone(990, 0.5, { vol: 0.08, at: 0.25 }); },
    water() { tone(500, 0.12, { vol: 0.15, slide: 1.8 }); tone(700, 0.12, { vol: 0.12, at: 0.1, slide: 1.6 }); },
    levelup() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.2, at: i * 0.1 })); },
    click() { tone(1400, 0.03, { type: 'square', vol: 0.05 }); },
    deny() { tone(220, 0.14, { type: 'sawtooth', vol: 0.08, slide: 0.7 }); },
    end() { [784, 659, 523].forEach((f, i) => tone(f, 0.3, { vol: 0.14, at: i * 0.14 })); },
  };

  window.SFX = new Proxy(SFX, {
    get(t, k) {
      if (k === 'setEnabled') return (v) => { enabled = !!v; };
      if (k === 'unlock') return () => ensure();
      const fn = t[k];
      return (...a) => { try { if (enabled) fn(...a); } catch (e) { /* audio is optional */ } };
    },
  });
})();
