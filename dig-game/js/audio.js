/* שכבות — sound effects synthesized with WebAudio (no audio files). */
(function () {
  'use strict';
  let ctx = null, master = null, noiseBuf = null, enabled = true;

  function ensure(force) {
    if (!enabled && !force && !musicOn) return null;
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

  /* ambient music: a slow drone, an oud-like pluck wandering a hijaz scale on D, and a soft frame drum */
  let musicOn = false, musicBus = null, musicTimer = 0, step = 0, note = 4;
  const HIJAZ = [146.83, 155.56, 185.0, 196.0, 220.0, 233.08, 261.63, 293.66, 311.13, 369.99, 392.0, 440.0];
  function reverb(c) {
    const len = c.sampleRate * 2.6, buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    const cv = c.createConvolver(); cv.buffer = buf; return cv;
  }
  function musicStart() {
    const c = ensure(); if (!c || musicBus) return;
    musicBus = c.createGain(); musicBus.gain.value = 0;
    musicBus.gain.linearRampToValueAtTime(0.5, c.currentTime + 3);
    const rv = reverb(c), wet = c.createGain(); wet.gain.value = 0.55;
    musicBus.connect(master); musicBus.connect(rv); rv.connect(wet); wet.connect(master);
    musicBus._drone = [73.42, 110, 146.83].map((f, i) => {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = (i - 1) * 6;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 340;
      const g = c.createGain(); g.gain.value = 0.022;
      const lfo = c.createOscillator(); lfo.frequency.value = 0.07 + i * 0.03; const lg = c.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
      o.connect(lp); lp.connect(g); g.connect(musicBus); o.start();
      return [o, lfo];
    });
    const beat = 0.42;
    musicTimer = setInterval(() => {
      if (!musicBus) return;
      const t = c.currentTime + 0.05;
      step++;
      // drum: dum on 1, tek on 3 and 4 of an 8-step cycle
      const pos = step % 8;
      if (pos === 0 || pos === 5) { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.25); g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.4); }
      if (pos === 3 || pos === 7 || (pos === 6 && Math.random() < 0.4)) {
        const src = c.createBufferSource(); src.buffer = noiseBuf; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 1.4;
        const g = c.createGain(); g.gain.setValueAtTime(0.07, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08); src.connect(f); f.connect(g); g.connect(musicBus); src.start(t, Math.random()); src.stop(t + 0.1);
      }
      // melody: a random walk, resting now and then
      if (Math.random() < (pos % 2 ? 0.35 : 0.7)) {
        note = Math.max(0, Math.min(HIJAZ.length - 1, note + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
        const fr = HIJAZ[note] * 2;
        [1, 2.01].forEach((m, i) => {
          const o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
          o.type = i ? 'sine' : 'triangle'; o.frequency.setValueAtTime(fr * m, t);
          if (Math.random() < 0.15) o.frequency.exponentialRampToValueAtTime(fr * m * 1.06, t + 0.12);
          lp.type = 'lowpass'; lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(600, t + 0.5);
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(i ? 0.02 : 0.07, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
          o.connect(lp); lp.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 1.2);
        });
      }
    }, beat * 1000);
  }
  function musicStop() {
    if (!musicBus || !ctx) return;
    const bus = musicBus; musicBus = null; clearInterval(musicTimer);
    bus.gain.cancelScheduledValues(ctx.currentTime); bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime); bus.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
    setTimeout(() => { bus._drone.forEach(([o, l]) => { try { o.stop(); l.stop(); } catch (e) { /* already stopped */ } }); bus.disconnect(); }, 1000);
  }
  window.MUSIC = {
    set(on) { musicOn = !!on; if (musicOn && ctx) musicStart(); if (!musicOn) musicStop(); },
    kick() { if (musicOn) { ensure(true); musicStart(); } },
    get on() { return musicOn; },
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
