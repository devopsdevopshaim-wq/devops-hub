# English voiceover for SPIDER v2 — Kokoro (af_heart), fitted to the fixed frame timings.
import sys, json, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
KD, OUT = sys.argv[1], sys.argv[2]
FRAMES = [0, 8, 17, 26, 37, 49, 59, 69, 81, 92, 100, 109]   # frame starts (s)
# (frame index, offset inside frame, line)
LINES = [
 (0, 1.6, "Every system begins with a single thread."),
 (1, 1.2, "I'm Haim Krispin."),
 (1, 3.0, "And I build all of them. Everything I've made, in one place."),
 (2, 1.0, "Forty-eight projects."),
 (2, 3.6, "Every point is a real, working product."),
 (3, 0.8, "AI agents that actually work for you."),
 (3, 4.4, "JARVIS, a smart office assistant, and an AI production studio."),
 (4, 1.0, "Real engineering, too."),
 (4, 3.4, "From a robotic parking garage, to a home's electrical panel."),
 (5, 0.8, "Tools for everyday life."),
 (5, 3.4, "Travel, money, health, and marketing."),
 (6, 0.8, "Studios for creativity, and heritage."),
 (6, 4.0, "Books, comics, and a library of sacred texts."),
 (7, 4.2, "And every thread connects to all the others."),
 (8, 0.6, "From my computer to the world, in four steps."),
 (8, 4.6, "Build it. Push it to GitHub. Publish it. Live."),
 (9, 1.0, "Live, right now."),
 (9, 3.4, "And it keeps itself up to date."),
 (10, 1.8, "Want one like this for your business?"),
 (10, 4.6, "Let's spin your next thread."),
 (11, 2.8, "SPIDER. Built by Haim Krispin."),
]
k = Kokoro(KD + '/kokoro-v1.0.onnx', KD + '/voices-v1.0.bin')
SR = 24000; T = 118.0
mix = np.zeros(int(T * SR)); meta = []
for fi, off, text in LINES:
    s, sr = k.create(text, voice='af_heart', speed=0.98, lang='en-us')
    assert sr == SR
    # trim leading/trailing silence
    a = np.abs(s); nz = np.where(a > 0.01)[0]; s = s[max(0, nz[0] - 240): nz[-1] + 1200]
    t0 = FRAMES[fi] + off; i = int(t0 * SR)
    end_next = FRAMES[fi + 1] if fi + 1 < len(FRAMES) else T
    dur = len(s) / SR
    if t0 + dur > end_next - 0.25: print(f'WARN overrun frame {fi+1}: "{text}" ends {t0+dur:.2f} > {end_next-0.25:.2f}')
    mix[i:i + len(s)] += s
    meta.append({'frame': fi + 1, 'start': round(t0, 3), 'end': round(t0 + dur, 3), 'text': text})
mix = mix / np.abs(mix).max() * 0.89
sf.write(OUT + '/vo_en.wav', mix, SR)
json.dump(meta, open(OUT + '/vo_en.json', 'w'), indent=1)
for m in meta: print(f"{m['start']:7.2f}-{m['end']:7.2f}  F{m['frame']:02d}  {m['text']}")
