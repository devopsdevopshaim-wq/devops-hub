"""The promo's Hebrew voice-over (a woman's voice) from NARRATION.md, mixed over the music, into the finished films.

    python3 videos/promo-src/voice.py --from narration.mp3            # one recording of the whole text (any free tool)
    GOOGLE_TTS_API_KEY=… python3 videos/promo-src/voice.py           # or: make the voice with Google
    python3 videos/promo-src/voice.py --test                          # the mix with tones instead of speech
- --from: one file with all 25 lines read in order, a short pause (half a second or more) between them. It is cut at
  its 25 longest pauses into the lines and each line is placed at its scene.

- The text is NARRATION.md: one line per scene, "N. [m:ss.s] text"; each line starts at its scene's time.
- Google Cloud Text-to-Speech (the key from the environment, sent in a header and never printed). The first Hebrew
  woman's voice that answers is used: Chirp3-HD, then Wavenet, then Standard. A line that runs past the next one is
  sped up a little (at most 15%).
- The music (music/src/Beauty_Flow.mp3 from 0:17) is lowered under the voice (side-chain) and fades out at the end.
- The new soundtrack replaces the audio of frame-studio/media/promo/optimus.mp4 and optimus-v.mp4; the picture is
  copied as it is. The voice alone is kept in music/voice.m4a.
"""
import json, os, re, subprocess, sys, tempfile, base64, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
FILMS = [os.path.join(ROOT, 'frame-studio', 'media', 'promo', f) for f in ('optimus.mp4', 'optimus-v.mp4')]
MUSIC, MUSIC_FROM = os.path.join(HERE, 'music', 'src', 'Beauty_Flow.mp3'), 17
VOICES = ['he-IL-Chirp3-HD-Aoede', 'he-IL-Chirp3-HD-Kore', 'he-IL-Wavenet-A', 'he-IL-Wavenet-C', 'he-IL-Standard-A']


def lines():
    out = []
    for l in open(os.path.join(HERE, 'NARRATION.md'), encoding='utf-8'):
        m = re.match(r'\s*\d+\.\s*\[(\d+):(\d+(?:\.\d+)?)\]\s*(.+)', l)
        if m:
            out.append((int(m.group(1)) * 60 + float(m.group(2)), m.group(3).strip()))
    return out


def dur(f):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True, check=True).stdout)


def tts(text, out, key, voice=[None]):
    names = [voice[0]] if voice[0] else VOICES
    last = ''
    for name in names:
        body = json.dumps({'input': {'text': text}, 'voice': {'languageCode': 'he-IL', 'name': name},
                           'audioConfig': {'audioEncoding': 'LINEAR16', 'sampleRateHertz': 48000, 'speakingRate': 0.97}}).encode()
        req = urllib.request.Request('https://texttospeech.googleapis.com/v1/text:synthesize', data=body,
                                     headers={'Content-Type': 'application/json', 'X-Goog-Api-Key': key})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                audio = json.load(r)['audioContent']
            open(out, 'wb').write(base64.b64decode(audio))
            if not voice[0]:
                voice[0] = name
                print('voice:', name)
            return
        except urllib.error.HTTPError as e:
            last = f'{name}: HTTP {e.code} {e.read()[:200].decode(errors="replace")}'
    sys.exit('Text-to-Speech failed. ' + last)


def tone(text, out):   # --test: a soft tone as long as the line would take to say
    d = max(1.0, len(text.split()) / 2.4)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', f'sine=frequency=440:duration={d:.2f}', '-af', 'volume=0.3', '-ar', '48000', out], check=True)


def split(src, n, tmp):
    """One recording -> n line files, cut in the middle of its n-1 longest pauses."""
    wav = os.path.join(tmp, 'all.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-ar', '48000', '-ac', '1', wav], check=True)
    r = subprocess.run(['ffmpeg', '-i', wav, '-af', 'silencedetect=noise=-38dB:d=0.25', '-f', 'null', '-'], capture_output=True, text=True)
    st = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', r.stderr)]
    en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', r.stderr)]
    total = dur(wav)
    gaps = [(e - s0, s0, e) for s0, e in zip(st, en) if s0 > 0.2 and e < total - 0.2]
    if len(gaps) < n - 1:
        sys.exit(f'Found {len(gaps)} pauses, need {n - 1}: leave a short pause between the lines.')
    cuts = sorted((s0 + e) / 2 for _, s0, e in sorted(gaps, reverse=True)[:n - 1])
    edges = [0.0] + cuts + [total]
    out = []
    for i in range(n):
        f = os.path.join(tmp, f'{i:02d}.wav')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{edges[i]:.3f}', '-to', f'{edges[i + 1]:.3f}', '-i', wav,
                        '-af', 'silenceremove=start_periods=1:start_threshold=-40dB,areverse,silenceremove=start_periods=1:start_threshold=-40dB,areverse', f], check=True)
        out.append(f)
    return out


def main():
    test = '--test' in sys.argv
    src = sys.argv[sys.argv.index('--from') + 1] if '--from' in sys.argv else None
    key = os.environ.get('GOOGLE_TTS_API_KEY', '')
    if not test and not src and not key:
        sys.exit('Give --from <recording>, or set GOOGLE_TTS_API_KEY.')
    L = lines()
    total = dur(FILMS[0])
    tmp = tempfile.mkdtemp(prefix='voice-')
    clips = []
    given = split(src, len(L), tmp) if src else None
    for i, (t, text) in enumerate(L):
        raw = os.path.join(tmp, f'{i:02d}.wav')
        if given:
            raw = given[i]
        else:
            (tone if test else lambda a, b: tts(a, b, key))(text, raw)
        room = (L[i + 1][0] if i + 1 < len(L) else total - 0.5) - t - 0.15
        d = dur(raw)
        speed = min(1.15, d / room) if d > room else 1.0
        fit = os.path.join(tmp, f'{i:02d}f.wav')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', raw, '-af', f'atempo={speed:.3f}' if speed > 1 else 'anull', '-ar', '48000', '-ac', '2', fit], check=True)
        clips.append((t + 0.25, fit))
        print(f'{i + 1:2d}. {t:6.1f}s  {d:4.1f}s' + (f'  ×{speed:.2f}' if speed > 1 else ''))
    # the voice track: every line at its time
    ins = sum([['-i', f] for _, f in clips], [])
    parts = ''.join(f'[{k}]adelay={int(t * 1000)}|{int(t * 1000)}[v{k}];' for k, (t, _) in enumerate(clips))
    voice = os.path.join(HERE, 'music', 'voice.m4a')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *ins, '-filter_complex',
                    parts + ''.join(f'[v{k}]' for k in range(len(clips))) + f'amix=inputs={len(clips)}:normalize=0,apad,atrim=0:{total:.2f},loudnorm=I=-16:TP=-1.5[out]',
                    '-map', '[out]', '-c:a', 'aac', '-b:a', '160k', voice], check=True)
    # music under the voice, then into both films
    mix = os.path.join(tmp, 'mix.m4a')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(MUSIC_FROM), '-t', f'{total:.2f}', '-i', MUSIC, '-i', voice, '-filter_complex',
                    f'[0]loudnorm=I=-20:TP=-2,afade=t=in:d=1.5,afade=t=out:st={total - 5:.2f}:d=5[m];[1]asplit[v1][v2];'
                    '[m][v1]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[duck];'
                    '[duck][v2]amix=inputs=2:normalize=0,alimiter=limit=0.95[out]',
                    '-map', '[out]', '-c:a', 'aac', '-b:a', '192k', mix], check=True)
    if test or '--dry' in sys.argv:
        print('mix only:', mix)
        return
    for f in FILMS:
        out = f + '.new.mp4'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f, '-i', mix, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', out], check=True)
        os.replace(out, f)
        print('updated', os.path.relpath(f, ROOT))


if __name__ == '__main__':
    main()
