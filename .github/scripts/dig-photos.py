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
    'earth': ('Whole world land and oceans 12000', 'earth'),
    'earth2': ('Land ocean ice 8192 Blue Marble', 'earth'),
    's_qumran': ('Qumran caves cave 4', 'site'),
    'f_qumran': ('Great Isaiah Scroll', 'find'),
    's_mishmar': ('Nahal Mishmar', 'site'),
    'f_mishmar': ('Nahal Mishmar hoard copper', 'find'),
    's_siloam': ('Hezekiah tunnel Siloam', 'site'),
    'f_siloam': ('Siloam inscription', 'find'),
    's_dan': ('Tel Dan gate', 'site'),
    'f_dan': ('Tel Dan stele', 'find'),
    's_hinnom': ('Ketef Hinnom', 'site'),
    'f_hinnom': ('Ketef Hinnom silver scroll', 'find'),
    's_masada': ('Masada aerial', 'site'),
    'f_masada': ('Masada ostraca', 'find'),
    's_valley': ('Valley of the Kings Luxor', 'site'),
    'f_valley': ('Tutankhamun mask', 'find'),
    's_amarna': ('Amarna ruins', 'site'),
    'f_amarna': ('Amarna letter cuneiform tablet', 'find'),
    's_tanis': ('Tanis Egypt ruins', 'site'),
    'f_tanis': ('Psusennes I gold mask', 'find'),
    's_ur': ('Ziggurat of Ur', 'site'),
    'f_ur': ('Standard of Ur', 'find'),
    's_nineveh': ('Nineveh Mashki gate', 'site'),
    'f_nineveh': ('Flood tablet Gilgamesh British Museum', 'find'),
    's_nimrud': ('Nimrud ruins', 'site'),
    'f_nimrud': ('Nimrud ivory', 'find'),
    's_persepolis': ('Persepolis Gate of All Nations', 'site'),
    'f_persepolis': ('Persepolis foundation tablet gold', 'find'),
    's_troy': ('Troy Hisarlik walls', 'site'),
    'f_troy': ('Priam treasure', 'find'),
    's_uluburun': ('Uluburun shipwreck museum Bodrum', 'site'),
    'f_uluburun': ('Uluburun copper ingot', 'find'),
    's_hattusa': ('Hattusa Lion Gate', 'site'),
    'f_hattusa': ('Treaty of Kadesh tablet', 'find'),
    's_gobekli': ('Gobekli Tepe', 'site'),
    'f_gobekli': ('Gobekli Tepe pillar relief', 'find'),
    's_mycenae': ('Mycenae Lion Gate', 'site'),
    'f_mycenae': ('Mask of Agamemnon', 'find'),
    's_vergina': ('Vergina royal tombs Aigai', 'site'),
    'f_vergina': ('Vergina golden larnax', 'find'),
    's_knossos': ('Knossos palace north entrance', 'site'),
    'f_knossos': ('Linear B tablet Knossos', 'find'),
    's_antikythera': ('Antikythera island', 'site'),
    'f_antikythera': ('Antikythera mechanism', 'find'),
    's_pompeii': ('Pompeii forum Vesuvius', 'site'),
    'f_pompeii': ('Pompeii House of the Menander silver', 'find'),
    's_varna': ('Varna Archaeological Museum', 'site'),
    'f_varna': ('Varna necropolis gold', 'find'),
    's_panagyurishte': ('Panagyurishte', 'site'),
    'f_panagyurishte': ('Panagyurishte treasure rhyton', 'find'),
    's_suttonhoo': ('Sutton Hoo burial mounds', 'site'),
    'f_suttonhoo': ('Sutton Hoo helmet', 'find'),
    's_staffordshire': ('Staffordshire Hoard find site', 'site'),
    'f_staffordshire': ('Staffordshire Hoard gold', 'find'),
    's_hoxne': ('Hoxne Suffolk village', 'site'),
    'f_hoxne': ('Hoxne Hoard pepper pot', 'find'),
    's_oseberg': ('Oseberg burial mound', 'site'),
    'f_oseberg': ('Oseberg ship', 'find'),
    's_spillings': ('Gotland coast Visby', 'site'),
    'f_spillings': ('Spillings Hoard', 'find'),
    's_nebra': ('Mittelberg Nebra', 'site'),
    'f_nebra': ('Nebra sky disc', 'find'),
    's_pietroasele': ('Pietroasele', 'site'),
    'f_pietroasele': ('Pietroasele treasure', 'find'),
    's_xian': ('Terracotta Army pit 1', 'site'),
    'f_xian': ('Terracotta warrior kneeling archer', 'find'),
    's_sanxingdui': ('Sanxingdui', 'site'),
    'f_sanxingdui': ('Sanxingdui bronze mask', 'find'),
    's_tillyatepe': ('Sheberghan Afghanistan', 'site'),
    'f_tillyatepe': ('Tillya Tepe gold crown', 'find'),
    's_mohenjodaro': ('Mohenjo-daro great bath', 'site'),
    'f_mohenjodaro': ('Dancing Girl Mohenjo-daro', 'find'),
    's_belitung': ('Belitung island beach', 'site'),
    'f_belitung': ('Belitung shipwreck ceramics', 'find'),
    's_mapungubwe': ('Mapungubwe hill', 'site'),
    'f_mapungubwe': ('Golden rhinoceros of Mapungubwe', 'find'),
    's_igboukwu': ('Igbo-Ukwu', 'site'),
    'f_igboukwu': ('Igbo-Ukwu bronze', 'find'),
    's_zimbabwe': ('Great Zimbabwe Great Enclosure', 'site'),
    'f_zimbabwe': ('Zimbabwe bird soapstone', 'find'),
    's_aksum': ('Aksum stelae', 'site'),
    'f_aksum': ('Aksumite coin', 'find'),
    's_sipan': ('Huaca Rajada Sipan', 'site'),
    'f_sipan': ('Lord of Sipan ear ornament', 'find'),
    's_chichen': ('Sacred Cenote Chichen Itza', 'site'),
    'f_chichen': ('Chichen Itza cenote gold disk', 'find'),
    's_atocha': ('Marquesas Keys Florida', 'site'),
    'f_atocha': ('Atocha shipwreck silver coins', 'find'),
    's_guatavita': ('Lake Guatavita', 'site'),
    'f_guatavita': ('Muisca raft', 'find'),
    's_machu': ('Machu Picchu', 'site'),
    'f_machu': ('Inca aryballos', 'find'),
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
        width = 4096 if kind == 'earth' else 1400 if kind in ('site', 'soil') else 700
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
            if n >= (1 if kind == 'earth' else 2):
                break
            ii = (p.get('imageinfo') or [{}])[0]
            meta = ii.get('extmetadata', {})
            lic = strip_html(meta.get('LicenseShortName', {}).get('value', ''))
            if not FREE.match(lic) or ii.get('mime') not in ('image/jpeg', 'image/png'):
                continue
            w, h = ii.get('width', 0), ii.get('height', 0)
            if kind == 'earth' and (w < 4000 or abs(w - 2 * h) > 4):
                continue
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
