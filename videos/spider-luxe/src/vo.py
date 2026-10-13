# English narration for SPIDER v3: local Kokoro voice, placed on the beat grid, then voiced like a trailer read
# (warmth, presence, compression and a short room).  usage: python3 vo.py <out_dir>
import sys, os, json, subprocess, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
OUT = sys.argv[1]
KD = os.path.expanduser('~/.cache/hyperframes/tts')
VOICE, SPEED = 'af_heart', 0.93
TOTAL = 93.6
LINES = [  # absolute start (s), line
 (1.2, "Fifty-one systems."),
 (4.85, "One mind."),
 (7.3, "Designed."), (9.7, "Engineered."), (12.1, "Live."),
 (14.7, "This is SPIDER."),
 (16.3, "The digital atelier of Haim Krispin."),
 (19.7, "Fifty-one live systems."),
 (22.0, "Every one of them, built from scratch."),
 (26.6, "Intelligence that creates."),
 (29.2, "Design, comics, books and campaigns."),
 (36.2, "Engineering, down to the last wire."),
 (39.0, "Robotic parking, control cabinets, automation."),
 (45.8, "Tools that run a life."),
 (48.4, "Travel, health, money and home."),
 (55.4, "And a library for the soul."),
 (58.0, "Sacred texts, dreams, and the Hebrew calendar."),
 (65.0, "And so much more."),
 (67.4, "AI agents. Warehouses. Networks. Apps."),
 (84.7, "SPIDER."),
 (86.4, "Your next system. Crafted by Haim Krispin."),
]
k = Kokoro(f'{KD}/models/kokoro-v1.0.onnx', f'{KD}/voices/voices-v1.0.bin')
SR = 24000
mix = np.zeros(int(TOTAL * SR)); meta = []; bad = 0
for n, (t0, text) in enumerate(LINES):
    s, sr = k.create(text, voice=VOICE, speed=SPEED, lang='en-us'); assert sr == SR
    a = np.abs(s); nz = np.where(a > 0.008)[0]; s = s[max(0, nz[0] - 240): nz[-1] + 1600]
    d = len(s) / SR
    limit = (LINES[n + 1][0] - 0.2) if n + 1 < len(LINES) else TOTAL - 2
    if t0 + d > limit: print(f'OVERRUN {text!r}: ends {t0+d:.2f} > {limit:.2f}'); bad += 1
    i = int(t0 * SR); mix[i:i + len(s)] += s
    meta.append({'start': round(t0, 3), 'end': round(t0 + d, 3), 'text': text})
mix = mix / np.abs(mix).max() * 0.9
raw = os.path.join(OUT, 'vo_raw.wav'); sf.write(raw, mix, SR)
chain = ('aresample=48000,highpass=f=70,equalizer=f=180:t=q:w=1:g=2.5,equalizer=f=3200:t=q:w=1.2:g=2,'
         'equalizer=f=7500:t=q:w=1.5:g=-2,acompressor=threshold=-20dB:ratio=3.5:attack=8:release=120:makeup=3,'
         'aecho=0.8:0.5:38|61:0.16|0.1')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-af', chain, os.path.join(OUT, 'vo_en.wav')], check=True)
os.remove(raw)
json.dump(meta, open(os.path.join(OUT, 'vo_en.json'), 'w'), indent=1)
for m in meta: print(f"{m['start']:6.2f}-{m['end']:6.2f}  {m['text']}")
sys.exit(1 if bad else 0)
