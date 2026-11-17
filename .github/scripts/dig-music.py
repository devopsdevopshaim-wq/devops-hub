"""Fetch background music for the dig game: tracks by Kevin MacLeod (incompetech.com, CC BY 4.0), converted to
small mono-free Ogg/MP3 files in dig-game/audio/_incoming with a list of what was found."""
import json
import os
import subprocess
import urllib.parse
import urllib.request

OUT = 'dig-game/audio/_incoming'
UA = 'shchavot-dig-game/1.0 (https://github.com/devopsdevopshaim-wq/devops-hub)'
TITLES = ['Desert City', 'Lost Frontier', 'Ancient Rite', 'Mystery Bazaar', 'Investigations', 'Lost Time', 'Unanswered Questions',
          'Arcadia', 'Hidden Past', 'Egyptian', 'Ishikari Lore', 'Hero Theme', 'Heroic Age', 'Achilles', 'Volatile Reaction',
          'Constance', 'Dreamer', 'Dark Walk', 'Sneaky Adventure', 'Spy Glass', 'Pyramid', 'Cave', 'Tempting Secrets', 'Clean Soul',
          'Midnight Tale', 'Eastern Thought', 'Thief in the Night', 'Satiate', 'Long Note Four', 'The Descent']


def main():
    os.makedirs(OUT, exist_ok=True)
    got = {}
    for t in TITLES:
        url = 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/' + urllib.parse.quote(t) + '.mp3'
        try:
            raw = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60).read()
        except Exception as e:
            print('missing', t, e)
            continue
        src = os.path.join(OUT, 'src.mp3')
        open(src, 'wb').write(raw)
        name = t.lower().replace(' ', '-')
        dst = os.path.join(OUT, name + '.mp3')
        # 96 kb/s stereo is plenty for background music
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-b:a', '96k', '-ar', '44100', dst], check=True)
        dur = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dst], capture_output=True, text=True).stdout.strip()
        got[name] = {'title': t, 'url': url, 'seconds': round(float(dur or 0)), 'bytes': os.path.getsize(dst),
                     'credit': f'"{t}" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0'}
        os.remove(src)
        print('ok', t, got[name]['seconds'])
    json.dump(got, open(os.path.join(OUT, 'music.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
