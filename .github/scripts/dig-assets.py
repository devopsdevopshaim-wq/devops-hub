"""Fetch free (CC0) realistic assets for the dig game from Poly Haven.

mode 'catalog': writes dig-game/assets/_incoming/catalog.json, a short list of the
textures, skies and models whose names or tags match what the game needs.
mode 'fetch': downloads the assets named in WANT into dig-game/assets/_incoming/.
The chosen files are then moved into dig-game/assets/ by hand.
"""
import json
import os
import sys
import urllib.request

API = 'https://api.polyhaven.com'
UA = 'shchavot-dig-game/1.0 (https://github.com/devopsdevopshaim-wq/devops-hub)'
OUT = 'dig-game/assets/_incoming'
MODE = 'fetch'

WORDS = ['stone', 'rock', 'brick', 'castle', 'sand', 'desert', 'dry', 'ground', 'gravel', 'dirt', 'marble', 'plaster',
         'terracotta', 'clay', 'ceramic', 'vase', 'pot', 'amphora', 'jar', 'wood', 'plank', 'barrel', 'chest', 'crate',
         'bronze', 'metal', 'iron', 'column', 'pillar', 'ruin', 'boulder', 'sky', 'cloud', 'noon', 'sunny', 'grass', 'tile',
         'mosaic', 'cannon', 'rope', 'leather', 'fabric', 'tree', 'olive', 'palm', 'bush', 'shrub']

# filled in after looking at the catalog: (type, id, resolution)
WANT = [
    ('hdri', 'goegap', '2k'), ('hdri', 'circus_maximus_2', '2k'), ('hdri', 'roofless_ruins', '2k'), ('hdri', 'qwantani_noon', '2k'),
    ('texture', 'large_sandstone_blocks', '1k'), ('texture', 'medieval_blocks_02', '1k'), ('texture', 'castle_brick_07', '1k'),
    ('texture', 'sandstone_blocks_08', '1k'), ('texture', 'marble_01', '1k'), ('texture', 'dry_ground_rocks', '1k'),
    ('texture', 'aerial_rocks_02', '1k'), ('texture', 'excavated_soil_wall', '1k'), ('texture', 'sandy_gravel', '1k'),
    ('texture', 'weathered_planks', '1k'), ('texture', 'sandstone_cracks', '1k'), ('texture', 'old_stone_wall', '1k'),
    ('texture', 'clay_plaster', '1k'), ('texture', 'patterned_clay_plaster', '1k'),
    ('model', 'cannon_01', '1k'), ('model', 'treasure_chest', '1k'), ('model', 'antique_ceramic_vase_01', '1k'),
    ('model', 'ceramic_vase_01', '1k'), ('model', 'ceramic_vase_02', '1k'), ('model', 'ceramic_vase_03', '1k'),
    ('model', 'ceramic_vase_04', '1k'), ('model', 'planter_pot_clay', '1k'), ('model', 'jug_01', '1k'),
    ('model', 'boulder_01', '1k'), ('model', 'namaqualand_boulder_02', '1k'), ('model', 'wooden_crate_01', '1k'),
    ('model', 'quiver_tree_01', '1k'), ('model', 'shrub_01', '1k'), ('model', 'rock_moss_set_01', '1k'),
    ('model', 'picke_dirty_01', '1k'), ('model', 'wooden_bucket_01', '1k'), ('model', 'wicker_basket_01', '1k'),
]


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read()


def catalog():
    out = {}
    for t in ('hdris', 'textures', 'models'):
        data = json.loads(get(f'{API}/assets?t={t}'))
        rows = []
        for aid, a in data.items():
            text = ' '.join([aid, a.get('name', '')] + a.get('categories', []) + a.get('tags', [])).lower()
            if t == 'hdris' or any(w in text for w in WORDS):
                rows.append([aid, a.get('name'), ','.join(a.get('categories', []))])
        out[t] = sorted(rows, key=lambda r: r[0])
        print(t, len(rows))
    # what files one HDRI offers, to choose formats and sizes
    sample = out['hdris'][0][0] if out['hdris'] else None
    if sample:
        files = json.loads(get(f'{API}/files/{sample}'))
        out['hdri_file_keys'] = {k: list(v.keys()) if isinstance(v, dict) else v for k, v in files.items()}
    with open(os.path.join(OUT, 'catalog.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=0)


def save(url, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(get(url))
    print('saved', path, os.path.getsize(path))


def fetch():
    for kind, aid, res in WANT:
        files = json.loads(get(f'{API}/files/{aid}'))
        base = os.path.join(OUT, aid)
        if kind == 'hdri':
            for fmt in ('hdr', 'exr'):
                f = files.get('hdri', {}).get(res, {}).get(fmt)
                if f:
                    save(f['url'], f'{base}/{aid}_{res}.{fmt}')
                    break
            tm = files.get('tonemapped')
            if isinstance(tm, dict) and tm.get('url'):
                save(tm['url'], f'{base}/{aid}_tonemapped.jpg')
        elif kind == 'texture':
            for mapname in ('Diffuse', 'nor_gl', 'arm', 'Rough', 'AO', 'Displacement'):
                m = files.get(mapname, {}).get(res, {})
                f = m.get('jpg') or m.get('png')
                if f:
                    save(f['url'], f'{base}/{mapname}_{res}.' + ('jpg' if m.get('jpg') else 'png'))
        elif kind == 'model':
            g = files.get('gltf', {}).get(res, {}).get('gltf')
            if g:
                save(g['url'], f'{base}/{aid}.gltf')
                for rel, inc in g.get('include', {}).items():
                    save(inc['url'], f'{base}/{rel}')


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    mode = sys.argv[1] if len(sys.argv) > 1 else MODE
    catalog() if mode == 'catalog' else fetch()
