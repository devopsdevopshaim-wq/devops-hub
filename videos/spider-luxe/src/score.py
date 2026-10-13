# Original score for SPIDER "The Atelier": warm strings, felt piano, low swells and gold shimmers, synced to the scenes.
# usage: python3 score.py <out.wav> <en|he> [vo_en.json]
import sys, json, wave, numpy as np
OUT, LANG = sys.argv[1], sys.argv[2]
SR = 44100; T = 73.0; N = int(SR * T)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(11)
STARTS = [0, 6, 12.5, 20, 29, 38, 47, 55, 63]

def hz(m): return 440 * 2 ** ((m - 69) / 12)
def add(sig, t0, pan=0.0, g=1.0):
    i = int(t0 * SR); j = min(N, i + len(sig))
    if j <= i: return
    s = sig[:j - i] * g
    L[i:j] += s * np.sqrt(0.5 * (1 - pan)); R[i:j] += s * np.sqrt(0.5 * (1 + pan))
def lp(x, a):  # one-pole low-pass, a in (0,1): smaller = darker
    y = np.empty_like(x); acc = 0.0
    for n in range(len(x)): acc += a * (x[n] - acc); y[n] = acc
    return y

def strings(t0, dur, notes, g=0.2, att=1.8, rel=2.5):
    n = int((dur + rel) * SR); t = np.arange(n) / SR
    e = np.minimum(1, t / att) * np.where(t > dur, np.exp(-(t - dur) / (rel / 3)), 1)
    for m in notes:
        f = hz(m); s = np.zeros(n)
        for d in (-0.004, 0, 0.0045):
            ph = 2 * np.pi * f * (1 + d) * t + rng.uniform(0, 6)
            vib = 0.0025 * np.sin(2 * np.pi * 5.2 * t)
            s += sum(np.sin(ph * k + vib * k) / k ** 1.4 for k in range(1, 7))
        add(s * e / 3, t0, pan=rng.uniform(-.6, .6), g=g / len(notes))

def piano(t0, m, g=0.2, pan=0.0):
    d = 5.0; t = np.arange(int(d * SR)) / SR; f = hz(m)
    s = sum(np.sin(2 * np.pi * f * k * (1 + 0.0004 * k * k) * t) * np.exp(-t * (0.6 + 0.9 * k)) / k ** 1.1 for k in range(1, 9))
    s *= np.minimum(1, t / 0.006)
    add(s, t0, pan, g)

def boom(t0, g=0.45):
    d = 4.0; t = np.arange(int(d * SR)) / SR; f = 34 + 40 * np.exp(-t * 5)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.1)
    nz = lp(rng.standard_normal(len(t)), 0.02) * np.exp(-t * 2.2) * 2.0
    add(s + nz, t0, 0, g)

def swell(t_hit, dur=2.2, g=0.22):  # reversed cymbal into a downbeat
    n = int(dur * SR); t = np.arange(n) / SR
    x = rng.standard_normal(n); x = x - lp(x, 0.08)
    add(x * (t / dur) ** 3, t_hit - dur, 0, g)

def shimmer(t0, base=84, g=0.06, n=7):
    for i in range(n):
        m = base + [0, 7, 12, 14, 19, 24, 26][i % 7]
        d = 3.2; t = np.arange(int(d * SR)) / SR
        s = (np.sin(2 * np.pi * hz(m) * t) + .3 * np.sin(2 * np.pi * hz(m) * 2.76 * t)) * np.exp(-t * 1.6) * np.minimum(1, t / .002)
        add(s, t0 + i * 0.07, pan=-.6 + .2 * i, g=g)

def pulse(t0, t1, bpm=76, g=0.16):
    b = 60 / bpm; t = t0
    while t < t1 - 0.05:
        d = .5; tt = np.arange(int(d * SR)) / SR; f = 46 + 70 * np.exp(-tt * 30)
        add(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9), t, 0, g)
        d2 = .07; nz = rng.standard_normal(int(d2 * SR)); nz = nz - lp(nz, .3)
        add(nz * np.exp(-np.arange(len(nz)) / SR * 60), t + b / 2, .35, g * .18)
        t += b

def bass(t0, dur, m, g=0.2):
    n = int((dur + 1) * SR); t = np.arange(n) / SR
    e = np.minimum(1, t / .4) * np.where(t > dur, np.exp(-(t - dur) * 3), 1)
    add((np.sin(2 * np.pi * hz(m) * t) + .25 * np.sin(4 * np.pi * hz(m) * t)) * e, t0, 0, g)

# harmony: Eb major colours. Ebmaj9 / Cm9 / Abmaj9 / Bbsus4 / Gm7 / Fm9
EBM9 = [51, 58, 62, 65, 70]; CM9 = [48, 55, 58, 62, 63]; ABM9 = [44, 51, 55, 58, 63]; BBS = [46, 53, 58, 60, 65]
GM7 = [43, 50, 53, 58, 62]; FM9 = [41, 48, 51, 55, 56]
PLAN = [  # scene -> chords (start offset, dur, chord)
 (0, [(0, 6.4, EBM9)]),
 (1, [(0, 6.9, ABM9)]),
 (2, [(0, 3.8, CM9), (3.8, 3.9, BBS)]),
 (3, [(0, 4.5, EBM9), (4.5, 4.7, ABM9)]),
 (4, [(0, 4.5, CM9), (4.5, 4.7, GM7)]),
 (5, [(0, 4.5, ABM9), (4.5, 4.7, BBS)]),
 (6, [(0, 4.0, FM9), (4.0, 4.2, ABM9)]),
 (7, [(0, 4.0, CM9), (4.0, 4.2, BBS)]),
 (8, [(0, 10.0, EBM9 + [74])]),
]
for si, chs in PLAN:
    for off, d, ch in chs:
        t0 = STARTS[si] + off
        lvl = 0.14 if si < 1 else 0.2 if si < 3 else 0.24
        strings(t0, d, ch, g=lvl * len(ch) / 4, att=1.6 if si else 3.0)
        bass(t0, d, ch[0] - 12, g=0.16 if si else 0.1)

# piano motif (Eb - Bb - G - F, answered) on the scene openings
MOTIF = [(0, 75), (0.55, 70), (1.1, 67), (2.2, 65)]
for t0, sh in ((0.3, 0), (6.3, 0), (20.2, 0), (38.2, 5), (55.2, 0), (63.4, 0)):
    for dt, m in MOTIF: piano(t0 + dt, m + sh, g=0.16, pan=.15)
for t0 in (29.2, 47.2):
    for dt, m in [(0, 72), (0.6, 70), (1.2, 67), (2.4, 63)]: piano(t0 + dt, m, g=0.14, pan=-.15)
for i in range(8): piano(13.0 + i * 0.3, [63, 67, 70, 74, 75, 79, 82, 86][i], g=0.07, pan=-.4 + .1 * i)  # count-up run

# downbeats: swell + boom into the big scenes
for t in (6.0, 12.5, 20.0, 55.0, 63.0):
    swell(t, 2.0, .18); boom(t, .42 if t in (6.0, 63.0) else .3)
for t in (29.0, 38.0, 47.0): swell(t, 1.4, .12); boom(t, .18)
pulse(20.0, 54.6, 76, .14)
shimmer(1.4, 84, .05); shimmer(7.4, 84, .06); shimmer(15.6, 87, .05); shimmer(57.6, 84, .05); shimmer(65.4, 84, .08)
# final ring-out: high Eb octave and a long tail
piano(66.0, 87, .1); piano(66.0, 75, .12); piano(66.0, 63, .14)

# reverb: FFT convolution with a long decaying stereo tail (a hall)
irn = int(3.2 * SR); ti = np.arange(irn) / SR
def ir(seed):
    r = np.random.default_rng(seed).standard_normal(irn) * np.exp(-ti * 2.0); r[:int(.02 * SR)] = 0
    return r / np.abs(r).sum() * 8
def conv(x, h):
    n = len(x) + irn; F = 1 << int(np.ceil(np.log2(n)))
    return np.fft.irfft(np.fft.rfft(x, F) * np.fft.rfft(h, F), F)[:len(x)]
L, R = L + .38 * conv(L, ir(1)), R + .38 * conv(R, ir(2))

if LANG == 'en':
    vo = json.load(open(sys.argv[3])); env = np.ones(N)
    for m in vo:
        a = int(max(0, m['start'] - .3) * SR); b = int(min(T, m['end'] + .4) * SR); env[a:b] = 0.5
    k = int(.25 * SR); env = np.convolve(env, np.ones(k) / k, mode='same')
    L *= env; R *= env
f = np.ones(N); fi = int(.4 * SR); f[:fi] = np.linspace(0, 1, fi); fo = int(2.5 * SR); f[-fo:] = np.linspace(1, 0, fo) ** 1.6
L *= f; R *= f
pk = max(np.abs(L).max(), np.abs(R).max()); L = np.tanh(1.3 * L / pk) * .88; R = np.tanh(1.3 * R / pk) * .88
out = (np.stack([L, R], 1) * 32767).astype(np.int16)
w = wave.open(OUT, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes()); w.close()
print('wrote', OUT)
