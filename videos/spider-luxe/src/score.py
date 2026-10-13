# Original trailer score for SPIDER v2 — 100 BPM, C minor. A watch-tick pulse, braams, taiko, a 16th-note string
# ostinato and risers, every hit on the film's cut grid.  usage: python3 score.py <out.wav> <en|he> [vo_en.json]
import sys, json, wave, numpy as np
from scipy.signal import butter, sosfilt
OUT, LANG = sys.argv[1], sys.argv[2]
SR = 48000; T = 81.6; N = int(SR * T)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(23)
B = 0.6; BAR = 2.4

def hz(m): return 440 * 2 ** ((m - 69) / 12)
def add(sig, t0, pan=0.0, g=1.0):
    i = int(round(t0 * SR)); j = min(N, i + len(sig))
    if j <= i or i < 0: return
    s = sig[:j - i] * g
    L[i:j] += s * np.sqrt(0.5 * (1 - pan)); R[i:j] += s * np.sqrt(0.5 * (1 + pan))
def filt(x, kind, f, order=2):
    sos = butter(order, f, btype=kind, fs=SR, output='sos'); return sosfilt(sos, x)
def tt(d): return np.arange(int(d * SR)) / SR
def saw(f, d, nh=24, det=(0,)):
    t = tt(d); o = np.zeros_like(t)
    for dv in det:
        ff = f * (1 + dv); ph = rng.uniform(0, 6)
        for k in range(1, nh + 1):
            if ff * k > 16000: break
            o += np.sin(2 * np.pi * ff * k * t + ph * k) / k
    return o / len(det)

# ---------- instruments ----------
def tick(t0, g=.12, hi=True):           # a watch escapement: two tiny clicks
    t = tt(.05)
    c = (np.sin(2 * np.pi * (3800 if hi else 2600) * t) + .6 * np.sin(2 * np.pi * 6100 * t)) * np.exp(-t * 260)
    add(c, t0, .25 if hi else -.25, g)
def taiko(t0, g=.6, pitch=58):
    t = tt(1.4); f = pitch + 70 * np.exp(-t * 22)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4.2)
    skin = filt(rng.standard_normal(len(t)), 'lowpass', 900) * np.exp(-t * 18) * .8
    add(body + skin, t0, rng.uniform(-.15, .15), g)
def kick(t0, g=.55):
    t = tt(.6); f = 42 + 110 * np.exp(-t * 35)
    add(np.tanh(1.6 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)), t0, 0, g)
def snare(t0, g=.32):
    t = tt(.5); n = filt(rng.standard_normal(len(t)), 'bandpass', [900, 7000]) * np.exp(-t * 16)
    add(n + .5 * np.sin(2 * np.pi * 185 * t) * np.exp(-t * 26), t0, .05, g)
def hat(t0, g=.05, pan=.35):
    t = tt(.09); n = filt(rng.standard_normal(len(t)), 'highpass', 7000) * np.exp(-t * 70); add(n, t0, pan, g)
def braam(t0, d=3.6, root=36, g=.5):
    n = int(d * SR); t = np.arange(n) / SR; o = np.zeros(n)
    for m in (root, root + 12, root + 19, root + 24):
        o += saw(hz(m), d, 30, (-.006, 0, .007)) * (1.0 if m < root + 20 else .5)
    o = np.tanh(1.8 * o)
    lo = filt(o, 'lowpass', 1400) ; e = np.minimum(1, t / .04) * np.exp(-t * .9)
    add(lo * e, t0, -.2, g * .5); add(lo * e, t0 + .012, .2, g * .5)
def boom(t0, g=.6):
    t = tt(3.0); f = 30 + 45 * np.exp(-t * 6)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.3)
    n = filt(rng.standard_normal(len(t)), 'lowpass', 300) * np.exp(-t * 2.5) * 1.5
    add(np.tanh(1.5 * (s + n)), t0, 0, g)
def riser(t_hit, d, g=.22):
    n = int(d * SR); t = np.arange(n) / SR; x = rng.standard_normal(n)
    hp = filt(x, 'highpass', 1500); env = (t / d) ** 2.6
    s = hp * env + .35 * np.sin(2 * np.pi * np.cumsum(220 * 2 ** (3 * t / d)) / SR) * env
    add(s, t_hit - d, 0, g)
def whoosh(t0, d=.7, g=.16):
    n = int(d * SR); t = np.arange(n) / SR
    x = filt(rng.standard_normal(n), 'bandpass', [400, 4000]) * np.sin(np.pi * t / d) ** 2
    add(x, t0, 0, g)
def shimmer(t0, base=84, g=.05):
    for i, m in enumerate([0, 7, 12, 15, 19, 24, 27]):
        t = tt(3.0); f = hz(base + m)
        s = (np.sin(2 * np.pi * f * t) + .3 * np.sin(2 * np.pi * f * 2.76 * t)) * np.exp(-t * 1.5) * np.minimum(1, t / .003)
        add(s, t0 + i * .06, -.6 + .2 * i, g)
def piano(t0, m, g=.2, pan=0.):
    t = tt(4.5); f = hz(m)
    s = sum(np.sin(2 * np.pi * f * k * (1 + .0004 * k * k) * t) * np.exp(-t * (.7 + .9 * k)) / k ** 1.1 for k in range(1, 9))
    add(s * np.minimum(1, t / .005), t0, pan, g)
def strings(t0, d, notes, g=.2, att=.6, rel=1.4):
    n = int((d + rel) * SR); t = np.arange(n) / SR
    e = np.minimum(1, t / att) * np.where(t > d, np.exp(-(t - d) / (rel / 3)), 1)
    o = np.zeros(n)
    for m in notes: o += saw(hz(m), d + rel, 18, (-.004, 0, .005))
    o = filt(o, 'lowpass', 2600) * e / len(notes)
    add(o, t0, -.3, g * .7); add(o, t0 + .01, .3, g * .7)
def ostinato(t0, t1, chords, g=.11, bright=2200):
    """16th-note string spiccato, one chord per bar"""
    t = t0; k = 0
    while t < t1 - 1e-6:
        ch = chords[int((t - t0) / BAR) % len(chords)]
        m = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[1] + 12][k % 4]
        d = .14; s = saw(hz(m), d, 14) * np.exp(-tt(d) * 26) * np.minimum(1, tt(d) / .004)
        add(filt(s, 'lowpass', bright), t, (-1) ** k * .25, g * (1.0 if k % 4 == 0 else .7))
        t += B / 4; k += 1
def bass(t0, d, m, g=.25):
    n = int((d + .3) * SR); t = np.arange(n) / SR
    e = np.minimum(1, t / .02) * np.where(t > d, np.exp(-(t - d) * 12), 1)
    add(np.tanh(1.4 * (np.sin(2 * np.pi * hz(m) * t) + .3 * np.sin(4 * np.pi * hz(m) * t))) * e, t0, 0, g)

Cm, Ab, Eb, Bb = [48, 51, 55], [44, 48, 51], [51, 55, 58], [46, 50, 53]
PROG = [Cm, Ab, Eb, Bb]

# ---------- 0–7.2  cold open: watch ticks, low drone, two braams ----------
for i in range(12): tick(i * B, .10, i % 2 == 0)
strings(0, 7.0, [36, 43, 48], .22, att=2.5)
braam(0.0, 4.4, 36, .55); boom(0.0, .45)
braam(4.8, 2.6, 32, .5); boom(4.8, .4)
piano(1.2, 72, .16); piano(1.8, 67, .12); piano(4.85, 75, .16); piano(5.45, 70, .12)
shimmer(1.25, 84, .04); riser(7.2, 2.2, .2)

# ---------- 7.2–14.4  montage: hits on every beat ----------
for k in range(12):
    t = 7.2 + k * B
    taiko(t, .55 if k % 4 == 0 else .38, 55 if k % 2 else 60); hat(t + B / 2, .05)
    if k % 4 == 0: boom(t, .32); kick(t, .45)
    if k % 4 == 2: snare(t, .3)
ostinato(7.2, 14.4, PROG, .12, 2600)
for k, ch in enumerate(PROG[:3]): strings(7.2 + k * BAR, BAR, [c + 12 for c in ch], .2); bass(7.2 + k * BAR, BAR, ch[0] - 12, .26)
for t in (13.2, 13.5, 13.8, 13.95, 14.1, 14.25): taiko(t, .32, 64)
riser(14.4, 2.4, .26)

# ---------- 14.4–19.2  logo slam ----------
braam(14.4, 4.6, 36, .7); boom(14.4, .7); shimmer(14.45, 84, .07)
for i in range(8): tick(15.0 + i * B, .08, i % 2 == 0)
strings(14.4, 4.6, [48, 55, 60, 63], .22)
riser(19.2, 2.4, .22); whoosh(18.7, .6, .2)

# ---------- 19.2–28.8  tunnel: the pulse builds ----------
for k in range(16):
    t = 19.2 + k * B
    kick(t, .38 if k % 2 == 0 else .0); hat(t + B / 2, .045 + .002 * k)
    if k >= 8: taiko(t, .25, 58)
ostinato(19.2, 28.8, PROG, .1, 1400)
for k, ch in enumerate(PROG): strings(19.2 + k * BAR, BAR, [c + 12 for c in ch], .2); bass(19.2 + k * BAR, BAR, ch[0] - 12, .24)
boom(23.2, .35); shimmer(23.2, 87, .05)
for t in (27.6, 27.9, 28.2, 28.35, 28.5, 28.65): snare(t, .22)
riser(28.8, 3.2, .26)

# ---------- 28.8–67.2  chapters: half-time trailer groove ----------
for c in range(4):
    c0 = 28.8 + c * 9.6
    boom(c0, .5); braam(c0, 2.0, 36 if c % 2 == 0 else 34, .35)
    for k in range(16):
        t = c0 + k * B
        if k % 4 == 0: kick(t, .5)
        if k % 4 == 2: snare(t, .34)
        if k % 4 == 3: kick(t + B / 2, .3)
        hat(t, .04); hat(t + B / 2, .055)
    ostinato(c0, c0 + 9.6, PROG, .11, 2000 + 300 * c)
    for k, ch in enumerate(PROG):
        strings(c0 + k * BAR, BAR, [x + 12 for x in ch] + [ch[0] + 24], .22)
        bass(c0 + k * BAR, BAR - .1, ch[0] - 12, .26)
    whoosh(c0 + 4.6, .5, .14)                    # the page swap
    for t in (c0 + 8.4, c0 + 8.7, c0 + 9.0, c0 + 9.15, c0 + 9.3, c0 + 9.45): taiko(t, .3, 62)
    piano(c0 + .3, [72, 75, 79, 77][c], .12, .2)
riser(67.2, 2.4, .24)

# ---------- 67.2–72  recap: accelerating cuts ----------
for k in range(16):
    t = 67.2 + k * .3
    taiko(t, .3 + .015 * k, 60); tick(t, .07, k % 2 == 0)
    if k >= 8: snare(t + .15, .2 + .01 * k)
ostinato(67.2, 71.7, [Cm, Ab], .13, 3200)
riser(71.85, 3.0, .32)

# ---------- 72–81.6  finale ----------
braam(72.0, 6.5, 36, .75); boom(72.0, .8); shimmer(72.05, 84, .08)
strings(72.0, 8.0, [48, 55, 60, 63, 67], .26, att=.2, rel=3.0); bass(72.0, 6.0, 24, .3)
for i, m in enumerate([75, 70, 67, 63]): piano(73.6 + i * .6, m, .16, .15)
piano(76.0, 60, .2); piano(76.0, 72, .14)
for i in range(10): tick(76.8 + i * B * (1 + i * .12), .07, i % 2 == 0)

# ---------- master: hall reverb, VO duck, glue ----------
irn = int(2.6 * SR); ti = np.arange(irn) / SR
def ir(seed):
    r = np.random.default_rng(seed).standard_normal(irn) * np.exp(-ti * 2.4); r[:int(.015 * SR)] = 0
    return filt(r, 'lowpass', 6000) / np.abs(r).sum() * 7
def conv(x, h):
    n = len(x) + irn; F = 1 << int(np.ceil(np.log2(n)))
    return np.fft.irfft(np.fft.rfft(x, F) * np.fft.rfft(h, F), F)[:len(x)]
L, R = L + .3 * conv(L, ir(1)), R + .3 * conv(R, ir(2))
if LANG == 'en':
    vo = json.load(open(sys.argv[3])); env = np.ones(N)
    for m in vo:
        a = int(max(0, m['start'] - .25) * SR); b = int(min(T, m['end'] + .3) * SR); env[a:b] = .45
    k = int(.2 * SR); env = np.convolve(env, np.ones(k) / k, mode='same')
    # duck only the mids, so drums and sub keep their weight
    for ch in ('L', 'R'):
        x = L if ch == 'L' else R
        lo = filt(x, 'lowpass', 180); hi = x - lo
        x2 = lo + hi * env
        if ch == 'L': L = x2
        else: R = x2
f = np.ones(N); fo = int(2.2 * SR); f[-fo:] = np.linspace(1, 0, fo) ** 1.5
L *= f; R *= f
pk = max(np.abs(L).max(), np.abs(R).max()); L = np.tanh(1.6 * L / pk) * .9; R = np.tanh(1.6 * R / pk) * .9
out = (np.stack([L, R], 1) * 32767).astype(np.int16)
w = wave.open(OUT, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes()); w.close()
print('wrote', OUT)
