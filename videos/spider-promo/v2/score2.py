# Original score for "הרשת" — composed procedurally, synced to the cut list.
import numpy as np, wave, sys, json
LANG=sys.argv[2]; EN=LANG=='en'
SR=44100; T=118.0; N=int(SR*T)
L=np.zeros(N); R=np.zeros(N)
rng=np.random.default_rng(7)
BPM=96; B=60/BPM          # beat 0.625s, bar 2.5s
def hz(m): return 440*2**((m-69)/12)
def env(n,a,d,s=0.0,rel=None):
    t=np.arange(n)/SR; e=np.minimum(1,t/max(a,1e-4))
    if rel is None: e=e*np.exp(-t/d)
    else:
        e=e*(s+(1-s)*np.exp(-t/d)); r0=int(max(0,n-rel*SR)); e[r0:]*=np.linspace(1,0,n-r0)
    return e
def add(sig,t0,pan=0.0,g=1.0):
    i=int(t0*SR); j=min(N,i+len(sig))
    if j<=i: return
    s=sig[:j-i]*g
    L[i:j]+=s*np.sqrt(0.5*(1-pan)); R[i:j]+=s*np.sqrt(0.5*(1+pan))
def tone(f,dur,harm=((1,1),),det=0.0):
    t=np.arange(int(dur*SR))/SR; o=np.zeros_like(t)
    for k,a in harm:
        o+=a*np.sin(2*np.pi*f*k*t)
        if det: o+=a*np.sin(2*np.pi*f*k*(1+det)*t+1.3)
    return o
# chord progression in D minor: Dm Bb F C (i VI III VII), 2 bars (5s) each
CH=[[50,57,62,65],[46,53,58,62],[53,60,65,69],[48,55,60,64]]
def pad(t0,dur,ch,g):
    for m in ch:
        s=tone(hz(m),dur+1.4,((1,1),(2,.35),(3,.12)),det=0.003)*env(int((dur+1.4)*SR),1.1,9e9,1.0,rel=2.4)
        add(s,t0,pan=rng.uniform(-.5,.5),g=g/len(ch))
def pluck(t0,m,g=.25,pan=0):
    d=1.8; s=tone(hz(m),d,((1,1),(2,.5),(3,.25),(4,.12)))*env(int(d*SR),.003,.35); add(s,t0,pan,g)
def bell(t0,m,g=.2,pan=0):
    d=4; s=tone(hz(m),d,((1,1),(2.76,.4),(5.4,.15)))*env(int(d*SR),.002,1.1); add(s,t0,pan,g)
def kick(t0,g=.55):
    d=.45; t=np.arange(int(d*SR))/SR; f=48+90*np.exp(-t*28); ph=2*np.pi*np.cumsum(f)/SR
    add(np.sin(ph)*np.exp(-t*7),t0,0,g)
def hat(t0,g=.06,pan=.3):
    d=.08; n=rng.standard_normal(int(d*SR)); n=np.diff(n,prepend=0); add(n*env(len(n),.001,.018),t0,pan,g)
def sub(t0,m,dur,g=.32):
    s=tone(hz(m),dur,((1,1),(2,.2)))*env(int(dur*SR),.02,9e9,1.0,rel=.25); add(s,t0,0,g)
def riser(t0,dur,g=.18):
    n=int(dur*SR); t=np.arange(n)/SR; x=rng.standard_normal(n)
    k=np.linspace(40,4,n).astype(int)                      # rough sweep: moving average shrinking
    c=np.cumsum(np.insert(x,0,0)); idx=np.arange(n); lo=np.maximum(0,idx-k)
    y=(c[idx+1]-c[lo])/(idx+1-lo); y=y*(t/dur)**2
    add(y,t0,0,g); add(tone(hz(62),dur,((1,1),(2,.3)))*(t/dur)**3*.5,t0,0,g)
def hit(t0,g=.5):
    d=6; t=np.arange(int(d*SR))/SR; n=rng.standard_normal(len(t))*np.exp(-t*3)*.25
    s=n+sum(tone(hz(m),d,((1,1),(2,.3))) for m in [38,50,57,62,65])*np.exp(-t*.8)*.25; add(s,t0,0,g)

# ---- arrangement (frame starts: 0 8 17 26 37 49 59 69 81 92 100 109) ----
# Intro 0–17: pad + thread pluck motifs
for b in range(0,17,5): pad(b,5.4,CH[(b//5)%4],.26 if b<8 else .34)
bell(0.1,74,.22); pluck(2.0,69,.22); pluck(2.3,74,.18,.3); pluck(6.0,77,.2,-.3)
bell(8.0,69,.25); pluck(10.1,72,.15,.4); pluck(11.0,74,.16,-.4); bell(12.4,77,.15)
# Count 17–26: rising arpeggio ticks (one per dot cadence)
arp=[62,65,69,72,74,77,81,84]
for i in range(48):
    t=17.2+i*0.11; pluck(t,arp[i%8]+(12 if i>40 else 0),.07+.002*i,pan=(-1)**i*.4)
for b in (17,22): pad(b,5.4,CH[(b//5)%4],.42)
bell(23.0,81,.2); bell(24.4,86,.12)
# Strands 26–69: groove
t=26.0
while t<69:
    bar=int((t-26)/2.5); ch=CH[(bar//2)%4]
    if (t-26)%5<1e-6: pad(t,5.4,ch,.4)
    sub(t,ch[0]-12,2.4)
    for q in range(4):
        tb=t+q*B
        kick(tb,.42 if q in (0,2) else .25)
        hat(tb+B/2,.05+(.02 if t>49 else 0),pan=.35*(-1)**q)
        m=ch[(q*2)%4]+12; pluck(tb+B/2,m+(12 if q==3 else 0),.09,pan=-.3+.2*q)
    t+=2.5
for at in (27.8,30.6,33.2,38.0,40.8,43.8,46.0,51.0,52.3,53.6,54.9,61.0,63.0,65.0,67.0): bell(at,81 if at<49 else 84,.09,pan=.2)
# Web 69–81: drop to pad, long riser, impact at the lock (78s)
pad(69,10,[50,57,62,65,69],.5); riser(70.5,7.5,.22); hit(78.0,.55); pad(78,4,[46,53,58,62,65],.45)
# Pipeline + live 81–100: lighter pulse, bead plings at the stations
t=81.0
while t<100:
    ch=CH[(int((t-81)/2.5)//2)%4]
    if (t-81)%5<1e-6: pad(t,5.4,ch,.36)
    sub(t,ch[0]-12,2.4,.22)
    for q in range(4): kick(t+q*B,.22 if q in(0,2) else 0); hat(t+q*B+B/2,.045)
    t+=2.5
ST=(85.6,86.3,87.3,88.2) if EN else (83.0,84.7,86.4,88.1)
for i,at in enumerate(ST): bell(at,[74,77,81,86][i],.2,pan=.4-.25*i)
for i in range(6): pluck(92.4+i*0.42,86,.07,pan=-.3)
# CTA 100–109: breakdown, drop pluck callback
pad(100,9.5,[46,53,58,62],.45); pluck(100.5,74,.22); bell(102.0,69,.2); bell(105.4,81,.14)
# Brand 109–118: final chord, S-draw shimmer, tail
riser(108.6,1.6,.1); hit(110.6,.4); pad(110.6,7.4,[50,57,62,66,69],.55)
for i,m in enumerate([74,78,81,86]): bell(111.6+i*0.12,m,.12,pan=-.3+.2*i)
for i in range(10): pluck(115.4+i*0.09,93-i,.035,pan=.3)


# ---- sound design (v2) ----
def whoosh(t0,dur=0.9,g=.16,up=True):
    n=int(dur*SR); t=np.arange(n)/SR; x=rng.standard_normal(n)
    k=(np.linspace(30,3,n) if up else np.linspace(3,30,n)).astype(int); c=np.cumsum(np.insert(x,0,0)); idx=np.arange(n); lo=np.maximum(0,idx-k)
    y=(c[idx+1]-c[lo])/(idx+1-lo); e=np.sin(np.pi*np.clip(t/dur,0,1))**2; add(y*e,t0,pan=0,g=g)
def tick(t0,g=.10,pan=0):
    d=.12; t=np.arange(int(d*SR))/SR; s_=np.sin(2*np.pi*2400*t)*np.exp(-t*60)+np.sin(2*np.pi*1200*t)*np.exp(-t*40)*.5; add(s_,t0,pan,g)
def chime(t0,g=.06):
    for i,m in enumerate([93,96,100]): bell(t0+i*0.05,m,g,pan=-.3+.3*i)
def boom(t0,g=.35):
    d=1.6; t=np.arange(int(d*SR))/SR; f=40+60*np.exp(-t*9); ph=2*np.pi*np.cumsum(f)/SR; add(np.sin(ph)*np.exp(-t*2.5),t0,0,g)
for b in (8,26,49,59,92,109): whoosh(b-0.55,0.9,.11)
for b in (17,69,100): whoosh(b-0.7,1.0,.16); boom(b,.22)
for b in (37,81): whoosh(b-0.45,0.7,.15)
CARDS = ([26+4.4,26+5.4,26+6.9] if EN else [26+1.8,26+4.4,26+6.8]) + [37.5,39.9,42.6,44.1] + ([50.4,50.9,51.4,51.9] if EN else [50.8,52.1,53.4,54.7])
for i,ct in enumerate(CARDS): tick(ct+0.15,.09,pan=(-1)**i*.3); chime(ct+0.6,.035)
boom(19.3 if EN else 22.8,.3); bell(19.3 if EN else 22.8,86,.12)
SW=[59+4.6,59+5.6,59+7.4] if EN else [61.0,63.0,65.0]
for t_ in SW: whoosh(t_-0.2,0.6,.07)

# ---- simple reverb: FFT convolution with a decaying noise tail ----
ir_n=int(2.4*SR); ti=np.arange(ir_n)/SR; ir=rng.standard_normal(ir_n)*np.exp(-ti*2.6); ir[0]=0; ir/=np.abs(ir).sum()/6
def conv(x):
    n=len(x)+ir_n; F=1<<int(np.ceil(np.log2(n)))
    return np.fft.irfft(np.fft.rfft(x,F)*np.fft.rfft(ir,F),F)[:len(x)]
L=L+.32*conv(L); R=R+.32*conv(np.roll(R,int(.013*SR)))

if EN:
    vo=json.load(open(sys.argv[3])); env_=np.ones(N)
    for m in vo:
        a=int(max(0,m['start']-0.25)*SR); b=int(min(T,m['end']+0.35)*SR); env_[a:b]=0.42
    k=int(0.18*SR); ker=np.ones(k)/k; env_=np.convolve(env_,ker,mode='same')
    L*=env_; R*=env_
# fades + master
f=np.ones(N); fi=int(.6*SR); f[:fi]=np.linspace(0,1,fi); fo=int(1.6*SR); f[-fo:]=np.linspace(1,0,fo)**1.5
L*=f; R*=f
pk=max(np.abs(L).max(),np.abs(R).max()); L=np.tanh(1.2*L/pk)*.9; R=np.tanh(1.2*R/pk)*.9
out=np.stack([L,R],1); out=(out*32767).astype(np.int16)
w=wave.open(sys.argv[1],'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes()); w.close()
print('wrote',sys.argv[1])
