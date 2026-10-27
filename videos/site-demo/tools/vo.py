# English voice-over for the site demo film: Kokoro (af_heart), every line fitted into its window.
# needs: pip install kokoro-onnx soundfile ; model files in $KOKORO_DIR (kokoro.onnx, voices.bin)
import os, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
KD = os.environ.get('KOKORO_DIR', '/tmp/claude-0/kokoro')
SR = 24000
_k = None
def tts(text, speed=1.0):
    global _k
    if _k is None: _k = Kokoro(os.path.join(KD, 'kokoro.onnx'), os.path.join(KD, 'voices.bin'))
    a, sr = _k.create(text, voice='af_heart', speed=speed, lang='en-us')
    assert sr == SR
    return np.asarray(a, dtype=np.float32)

def build(lines, total, out):
    """lines: [(start_s, max_s, text)] -> one mono wav of `total` seconds"""
    buf = np.zeros(int(total * SR) + SR, dtype=np.float32)
    for start, mx, text in lines:
        sp = 1.0; a = tts(text, sp)
        while len(a) / SR > mx and sp < 1.35:
            sp += 0.05; a = tts(text, sp)
        print(f'  {start:6.2f}s {len(a)/SR:4.1f}s (max {mx:.1f}, speed {sp:.2f}) {text[:60]}')
        i = int(start * SR); buf[i:i + len(a)] += a
    buf = buf[:int(total * SR)]
    pk = float(np.abs(buf).max()) or 1.0
    sf.write(out, buf * (0.95 / pk), SR)
