# English narration for SPIDER "The Atelier": local Kokoro voice, each line placed at a fixed time in its scene.
# usage: python3 vo.py <out_dir>
import sys, os, json, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
OUT = sys.argv[1]
KD = os.path.expanduser('~/.cache/hyperframes/tts')
VOICE, SPEED = 'af_bella', 0.9
STARTS = [0, 6, 12.5, 20, 29, 38, 47, 55, 63]; TOTAL = 73.0
LINES = [  # (scene, offset in scene, line)
 (0, 1.6, "Every masterpiece begins with a single line."),
 (1, 0.9, "This is SPIDER."),
 (1, 2.6, "The digital atelier of Haim Krispin."),
 (2, 0.8, "Forty-eight bespoke systems."),
 (2, 3.6, "Each one real. Each one live."),
 (3, 0.8, "Artificial intelligence, tailored to the way you work."),
 (3, 4.8, "Agents, assistants and studios that think with you."),
 (4, 0.8, "Engineering, with absolute precision."),
 (4, 4.0, "From robotic parking, to the electrical panel."),
 (5, 0.8, "Refined tools for everyday life."),
 (5, 3.8, "Travel, finance, health and growth."),
 (6, 0.8, "Studios for creation, and for heritage."),
 (6, 4.0, "Books, comics, and a library of sacred texts."),
 (7, 1.0, "One craftsman. Every detail."),
 (7, 4.2, "From the first line, to live."),
 (8, 2.4, "SPIDER."),
 (8, 3.8, "Your next system, crafted by Haim Krispin."),
]
k = Kokoro(f'{KD}/models/kokoro-v1.0.onnx', f'{KD}/voices/voices-v1.0.bin')
SR = 24000
mix = np.zeros(int(TOTAL * SR)); meta = []; bad = 0
for si, off, text in LINES:
    s, sr = k.create(text, voice=VOICE, speed=SPEED, lang='en-us'); assert sr == SR
    a = np.abs(s); nz = np.where(a > 0.008)[0]; s = s[max(0, nz[0] - 240): nz[-1] + 1600]
    t0 = STARTS[si] + off; d = len(s) / SR
    limit = (STARTS[si + 1] if si + 1 < len(STARTS) else TOTAL - 1.5) - 0.2
    nxt = [STARTS[sj] + o for sj, o, _ in LINES if STARTS[sj] + o > t0]
    if nxt: limit = min(limit, min(nxt) - 0.25)
    if t0 + d > limit: print(f'OVERRUN {text!r}: ends {t0+d:.2f} > {limit:.2f}'); bad += 1
    i = int(t0 * SR); mix[i:i + len(s)] += s
    meta.append({'scene': si + 1, 'start': round(t0, 3), 'end': round(t0 + d, 3), 'text': text})
mix = mix / np.abs(mix).max() * 0.9
sf.write(os.path.join(OUT, 'vo_en.wav'), mix, SR)
json.dump(meta, open(os.path.join(OUT, 'vo_en.json'), 'w'), indent=1)
for m in meta: print(f"{m['start']:6.2f}-{m['end']:6.2f}  S{m['scene']}  {m['text']}")
sys.exit(1 if bad else 0)
