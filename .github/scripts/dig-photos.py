"""Fetch real, freely licensed photos for the dig game from Wikimedia Commons.

For every key it searches Commons, keeps up to 3 candidates under a free licence,
saves them as dig-game/photos/_candidates/<key>-<n>.jpg and records the credit
(title, author, licence, source page) in dig-game/photos/_candidates/credits.json.
The chosen photos are then copied to dig-game/photos/ by hand.
"""
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

from PIL import Image

API = 'https://commons.wikimedia.org/w/api.php'
UA = 'shchavot-dig-game/1.0 (https://github.com/devopsdevopshaim-wq/devops-hub)'
OUT = sys.argv[1] if len(sys.argv) > 1 else 'dig-game/photos/_candidates'
FREE = re.compile(r'^(cc0|public domain|pd|cc by(-sa)? ?[0-9.]*|cc-by(-sa)?-[0-9.]+)', re.I)

# key: (search, kind) ; kind 'site' wants wide photos, 'find' wants objects, 'soil' wants sections
QUERIES = {
    'o_shoe': ('horseshoe archaeological find', 'find'),
    'c_arrow': ('medieval iron arrowhead museum', 'find'),
    'c_sword': ('medieval sword museum crusader', 'find'),
    'b_amphora': ('Gaza amphora', 'find'),
    'r_glass': ('Roman glass unguentarium', 'find'),
    's_mug': ('stone measuring cup Second Temple Jerusalem', 'find'),
    's_shekel': ('shekel of Israel Jewish War silver coin', 'find'),
    'f_sherd': ('painted pottery sherd Iron Age', 'find'),
    'f_lmlk': ('lmlk stamp', 'find'),
    'f_ostracon': ('ostracon Hebrew inscription', 'find'),
    'k_axe': ('bronze axe head Bronze Age museum', 'find'),
    'k_dagger': ('bronze dagger Middle Bronze Age', 'find'),
    'k_figurine': ('Canaanite bronze figurine', 'find'),
    'p_flint': ('flint blade Neolithic', 'find'),
    'r_helmet': ('Roman helmet Imperial Gallic', 'find'),
    'o_dallah': ('dallah', 'find'),
}


def api(params):
    params = dict(params, format='json')
    req = urllib.request.Request(API + '?' + urllib.parse.urlencode(params), headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.load(r)


def strip_html(s):
    return re.sub(r'<[^>]+>', '', s or '').strip()


def main():
    os.makedirs(OUT, exist_ok=True)
    credits = {}
    for key, (q, kind) in QUERIES.items():
        width = 1400 if kind in ('site', 'soil') else 700
        try:
            data = api({
                'action': 'query', 'generator': 'search', 'gsrnamespace': 6, 'gsrlimit': 12,
                'gsrsearch': f'{q} filetype:bitmap', 'prop': 'imageinfo',
                'iiprop': 'url|size|extmetadata|mime', 'iiurlwidth': width,
                'iiextmetadatafilter': 'LicenseShortName|Artist|ImageDescription',
            })
        except Exception as e:  # keep going: one failed search must not stop the rest
            print('search failed', key, e)
            continue
        pages = sorted(data.get('query', {}).get('pages', {}).values(), key=lambda p: p.get('index', 99))
        n = 0
        for p in pages:
            if n >= 3:
                break
            ii = (p.get('imageinfo') or [{}])[0]
            meta = ii.get('extmetadata', {})
            lic = strip_html(meta.get('LicenseShortName', {}).get('value', ''))
            if not FREE.match(lic) or ii.get('mime') not in ('image/jpeg', 'image/png'):
                continue
            w, h = ii.get('width', 0), ii.get('height', 0)
            if kind in ('site', 'soil') and (w < 1000 or w < h):
                continue
            if kind == 'find' and min(w, h) < 300:
                continue
            try:
                req = urllib.request.Request(ii['thumburl'], headers={'User-Agent': UA})
                raw = urllib.request.urlopen(req, timeout=60).read()
                im = Image.open(io.BytesIO(raw)).convert('RGB')
                im.thumbnail((width, width))
                n += 1
                name = f'{key}-{n}.jpg'
                im.save(os.path.join(OUT, name), 'JPEG', quality=82, optimize=True, progressive=True)
            except Exception as e:
                print('download failed', key, p.get('title'), e)
                continue
            credits[name] = {
                'title': p['title'], 'license': lic,
                'artist': strip_html(meta.get('Artist', {}).get('value', ''))[:160],
                'page': ii.get('descriptionurl', ''),
            }
            time.sleep(0.3)
        print(key, n)
    with open(os.path.join(OUT, 'credits.json'), 'w', encoding='utf-8') as f:
        json.dump(credits, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
