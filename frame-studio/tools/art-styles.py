"""The paintings behind the AI art styles (js/ai-art.js): public-domain works from Wikimedia Commons, saved small
(384 px, they only teach the AI the style) to frame-studio/media/styles/<id>.jpg, with credits.json (artist, title,
licence, source). Run in CI (frame-art-styles.yml); a work that cannot be found is skipped and reported."""
import io, json, os, sys, urllib.error, urllib.parse, urllib.request
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'media', 'styles')
UA = {'User-Agent': 'frame-studio-styles/1.0 (https://github.com/devopsdevopshaim-wq/devops-hub)'}
API = 'https://commons.wikimedia.org/w/api.php'
# id, exact file title (tried first), search words (if the title is not found)
WORKS = [
    ('starry', 'File:Van Gogh - Starry Night - Google Art Project.jpg', 'Van Gogh Starry Night 1889'),
    ('wave', 'File:Tsunami by hokusai 19th century.jpg', 'Great Wave off Kanagawa Hokusai'),
    ('impression', 'File:Monet - Impression, Sunrise.jpg', 'Monet Impression soleil levant'),
    ('kiss', 'File:The Kiss - Gustav Klimt - Google Cultural Institute.jpg', 'Klimt The Kiss 1908'),
    ('scream', 'File:Edvard Munch, 1893, The Scream, oil, tempera and pastel on cardboard, 91 x 73 cm, National Gallery of Norway.jpg', 'Munch The Scream 1893'),
    ('kandinsky', 'File:Vassily Kandinsky, 1913 - Composition 7.jpg', 'Kandinsky Composition VII 1913'),
    ('sunflowers', 'File:Vincent Willem van Gogh 127.jpg', 'Van Gogh Sunflowers 1888'),
    ('seurat', 'File:A Sunday on La Grande Jatte, Georges Seurat, 1884.jpg', 'Seurat Grande Jatte'),
    ('turner', 'File:The Fighting Temeraire, JMW Turner, National Gallery.jpg', 'Turner Fighting Temeraire'),
    ('mucha', '', 'Alfons Mucha Zodiac 1896'),
    ('vangogh-self', 'File:Vincent van Gogh - Self-Portrait - Google Art Project (454045).jpg', 'Van Gogh self-portrait 1889 Orsay'),
    ('mondrian', '', 'Mondrian Composition with Red Blue and Yellow 1930'),
    ('nightwatch', 'File:The Night Watch - HD.jpg', 'Rembrandt Night Watch'),
    ('pearl', 'File:1665 Girl with a Pearl Earring.jpg', 'Vermeer Girl with a Pearl Earring'),
    ('hiroshige', '', 'Hiroshige Sudden Shower over Shin-Ohashi bridge'),
    ('yellow-red-blue', '', 'Kandinsky Yellow-Red-Blue 1925'),
    ('bluehorse', '', 'Franz Marc Blue Horse I 1911'),
    ('treeoflife', '', 'Klimt Tree of Life Stoclet Frieze'),
    ('lilies', '', 'Monet Water Lilies 1906 Art Institute Chicago'),
    ('rhone', '', 'Van Gogh Starry Night Over the Rhone'),
    ('redfuji', '', 'Hokusai Fine Wind Clear Morning Red Fuji'),
    ('stainedglass', '', 'Chartres Cathedral rose window stained glass'),
    ('ravenna', '', 'Ravenna San Vitale mosaic Justinian'),
    ('almondblossom', '', 'Van Gogh Almond Blossom 1890'),
    ('klimt-adele', '', 'Klimt Portrait of Adele Bloch-Bauer I'),
    ('cafe', '', 'Van Gogh Cafe Terrace at Night'),
    ('waterloo', '', 'Monet Houses of Parliament sunset'),
    ('marc-fox', '', 'Franz Marc The Fox 1913'),
    ('delaunay', '', 'Robert Delaunay Rhythm 1912'),
    ('schiele', '', 'Egon Schiele self portrait 1912'),
]


def get(params):
    q = urllib.parse.urlencode(dict(params, format='json', formatversion=2))
    try:
        with urllib.request.urlopen(urllib.request.Request(API + '?' + q, headers=UA), timeout=40) as r:
            raw = r.read()
    except urllib.error.HTTPError as e:
        raw = e.read(); print('http', e.code, raw[:300])
    try:
        return json.loads(raw)
    except ValueError:
        print('not json:', raw[:300]); raise


def info(page):
    ii = (page.get('imageinfo') or [None])[0]
    if not ii:
        return None
    md = ii.get('extmetadata') or {}
    lic = (md.get('LicenseShortName') or {}).get('value', '')
    return {'url': ii.get('thumburl') or ii.get('url'), 'page': ii.get('descriptionurl'), 'licence': lic,
            'artist': (md.get('Artist') or {}).get('value', ''), 'title': page.get('title', '')}


def find(title, words):
    props = {'prop': 'imageinfo', 'iiprop': 'url|extmetadata', 'iiurlwidth': 640}
    if title:
        p = (get(dict(props, titles=title)).get('query') or {}).get('pages') or []
        if p and not p[0].get('missing'):
            i = info(p[0])
            if i:
                return i
    p = (get(dict(props, generator='search', gsrsearch=words + ' filetype:bitmap', gsrnamespace=6, gsrlimit=5)).get('query') or {}).get('pages') or []
    p.sort(key=lambda x: x.get('index', 99))
    for pg in p:
        i = info(pg)
        if i and ('public domain' in i['licence'].lower() or i['licence'].upper().startswith('PD')):
            return i
    return None


def main():
    os.makedirs(OUT, exist_ok=True)
    credits, missing = {}, []
    for wid, title, words in WORKS:
        try:
            i = find(title, words)
            if not i:
                missing.append(wid); continue
            with urllib.request.urlopen(urllib.request.Request(i['url'], headers=UA), timeout=60) as r:
                im = Image.open(io.BytesIO(r.read())).convert('RGB')
            im.thumbnail((384, 384), Image.LANCZOS)
            im.save(os.path.join(OUT, wid + '.jpg'), quality=88)
            import re
            credits[wid] = {'title': i['title'].replace('File:', ''), 'artist': re.sub('<[^>]+>', '', i['artist']).strip()[:120], 'licence': i['licence'], 'source': i['page']}
            print('ok', wid, i['licence'], i['title'])
        except Exception as e:  # one work is never worth the whole run
            print('fail', wid, e); missing.append(wid)
    json.dump(credits, open(os.path.join(OUT, 'credits.json'), 'w'), ensure_ascii=False, indent=1)
    print('saved', len(credits), 'missing', missing)
    if len(credits) < 10:
        sys.exit(1)


if __name__ == '__main__':
    main()
