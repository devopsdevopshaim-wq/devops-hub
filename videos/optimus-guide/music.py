import numpy as np, wave, sys
SR=32000; DUR=float(sys.argv[2]); N=int(SR*DUR)
L=np.zeros(N); R=np.zeros(N)
bpm=76; beat=60/bpm; bar=4*beat
def f(m): return 440*2**((m-69)/12)
# D major: D A Bm G | Em A D D  (2 bars each chord? one bar each, 8-bar loop)
prog=[(50,[62,66,69]),(45,[61,64,69]),(47,[62,66,71]),(43,[62,67,71]),(52,[64,67,71]),(45,[61,64,69]),(50,[62,66,69]),(43,[62,67,71])]
rng=np.random.default_rng(7)
def add(sig,start,pan=0.0,gain=1.0):
    i=int(start*SR); 
    if i>=N: return
    s=sig[:N-i]*gain; L[i:i+len(s)]+=s*(1-pan)*0.5*2**0.5*0.7; R[i:i+len(s)]+=s*(1+pan)*0.5*2**0.5*0.7
def env(n,a,d):
    t=np.arange(n)/SR; e=np.minimum(1,t/a)*np.exp(-t/d); return e
def piano(m,dur=2.2,vel=0.3):
    n=int(SR*dur); t=np.arange(n)/SR; fr=f(m)
    s=sum((0.6**k)*np.sin(2*np.pi*fr*(k+1)*t*(1+0.0004*k)) for k in range(5))
    return s*env(n,0.004,0.55+0.2*(m<60))*vel
def pad(ms,dur,vel=0.08):
    n=int(SR*dur); t=np.arange(n)/SR; s=np.zeros(n)
    for m in ms:
        for dt in (-0.12,0,0.11):
            fr=f(m)*2**(dt/12); s+=np.sin(2*np.pi*fr*t+rng.random()*6)+0.25*np.sin(4*np.pi*fr*t)
    a=np.minimum(1,t/1.2)*np.minimum(1,(dur-t)/1.0); return s*a*vel/len(ms)
def bass(m,dur,vel=0.22):
    n=int(SR*dur); t=np.arange(n)/SR; fr=f(m-12)
    return (np.sin(2*np.pi*fr*t)+0.2*np.sin(4*np.pi*fr*t))*env(n,0.02,1.6)*vel
melody=[78,76,74,76, 73,74,76,None, 74,76,78,81, 79,78,76,None]
nbars=int(DUR/bar)+1
for b in range(nbars):
    t0=b*bar; root,ch=prog[b%8]; sec=(b//16)
    intro=t0<10; outro=t0>DUR-14
    add(pad(ch,bar+1.0,0.07 if intro else 0.06),t0,0.0)
    if not intro: add(bass(root,bar),t0,0.0,0.9 if not outro else 0.5)
    if t0>=6:
        # arpeggio eighths
        arp=[ch[0],ch[1],ch[2],ch[1]+12 if ch[1]+12<84 else ch[1],ch[2],ch[1],ch[0]+12,ch[2]]
        for k,m in enumerate(arp):
            v=0.16 if k%2==0 else 0.11
            if outro: v*=0.6
            add(piano(m,1.8,v),t0+k*beat/2+rng.normal(0,0.006),pan=-0.35+0.1*(k%3))
    # a gentle melody on alternating 16-bar sections
    if sec%2==1 and not outro:
        for k in range(2):
            m=melody[(b%8)*2+k]
            if m: add(piano(m,3.0,0.12),t0+k*2*beat,pan=0.3)
mx=max(np.abs(L).max(),np.abs(R).max()); L/=mx*1.12; R/=mx*1.12
st=np.stack([L,R],1); pcm=(st*32767).astype('<i2')
w=wave.open(sys.argv[1],'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes()); w.close()
