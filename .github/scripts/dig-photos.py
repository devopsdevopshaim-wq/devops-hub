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
    'site-yard': ('Galilee village old stone house olive', 'site'),
    'site-akko': ('Acre Israel old city walls sea', 'site'),
    'site-caesarea': ('Caesarea Maritima aqueduct', 'site'),
    'site-david': ('City of David Jerusalem archaeological', 'site'),
    'site-qumran': ('Qumran caves', 'site'),
    'site-megiddo': ('Tel Megiddo', 'site'),
    'site-carmel': ('Nahal Me\'arot caves Carmel', 'site'),
    'site-daily': ('archaeological excavation Israel dig site', 'site'),
    'soil-1': ('stratigraphy archaeological section wall excavation', 'soil'),
    'soil-2': ('soil profile horizons', 'soil'),
    'soil-3': ('archaeological excavation trench layers', 'soil'),
    'r_pilate': ('Pilate stone', 'find'),
    'f_bulla': ('Hezekiah bulla', 'find'),
    's_trumpet': ('Trumpeting place inscription', 'find'),
    's_shekel': ('shekel Jewish revolt silver', 'find'),
    'k_ivory': ('Megiddo ivory', 'find'),
    'p_skull': ('Skhul skull', 'find'),
    'c_sword': ('crusader sword found sea Carmel', 'find'),
    's_scroll': ('Great Isaiah Scroll', 'find'),
    's_jar': ('Qumran scroll jar', 'find'),
    'f_lmlk': ('LMLK seal impression handle', 'find'),
    'f_figurine': ('Judean pillar figurine', 'find'),
    's_mug': ('stone vessel Second Temple period', 'find'),
    'b_mosaic': ('Byzantine mosaic bird Israel', 'find'),
    'r_head': ('Caesarea marble statue head', 'find'),
    'p_handaxe': ('Acheulean handaxe', 'find'),
    'k_scarab': ('scarab Canaan Israel Museum', 'find'),
    'o_pipe': ('Ottoman clay tobacco pipe', 'find'),
    'f_ostracon': ('Lachish letter ostracon', 'find'),
    'b_amphora': ('Gaza amphora', 'find'),
    'r_helmet': ('Roman legionary helmet galea', 'find'),
    'p_mortar': ('Natufian basalt mortar', 'find'),
    's_lamp': ('Herodian oil lamp', 'find'),
    'b_lamp': ('Byzantine oil lamp', 'find'),
    'k_figurine': ('Canaanite bronze figurine gold Megiddo', 'find'),
    'o_dallah': ('dallah coffee pot', 'find'),
    'b_solidus': ('solidus Heraclius gold coin', 'find'),
    'r_denarius': ('Tiberius denarius tribute penny', 'find'),
    'p_flint': ('flint blade Levallois Levant', 'find'),
    'p_beads': ('Nassarius shell beads', 'find'),
    'k_dagger': ('Bronze Age dagger Levant', 'find'),
    'k_axe': ('Bronze Age axe Canaan', 'find'),
    'c_coin': ('denier Kingdom of Jerusalem coin', 'find'),
    'o_coin': ('Ottoman akce silver coin', 'find'),
    'r_glass': ('Roman glass bottle iridescent', 'find'),
    'r_amphora': ('Roman amphora', 'find'),
    'o_glass': ('Hebron glass', 'find'),
    'c_arrow': ('medieval iron arrowhead crusader', 'find'),
    'c_seal': ('crusader seal Hospitaller', 'find'),
    'f_sherd': ('Iron Age pottery sherd Israel', 'find'),
    'o_sultani': ('Ottoman sultani gold coin', 'find'),
    'o_shoe': ('antique horseshoe iron', 'find'),
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
