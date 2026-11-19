# Finds ONNX builds of Real-ESRGAN and GFPGAN on Hugging Face: lists candidate repos, downloads the small ones and prints
# each file's size, sha256, inputs and outputs (and, for Real-ESRGAN, keeps it in models-out/ for the studio).
import json, hashlib, os, sys, urllib.request
import onnx
OUT = 'models-out'; os.makedirs(OUT, exist_ok=True)
def get(u):
    req = urllib.request.Request(u, headers={'User-Agent': 'frame-studio-probe'})
    return urllib.request.urlopen(req, timeout=120)
def tree(repo):
    try: return json.load(get('https://huggingface.co/api/models/%s/tree/main?recursive=true' % repo))
    except Exception as e: print('  ', repo, 'tree failed', e); return []
for q in ['gfpgan', 'realesrgan onnx', 'real-esrgan onnx', 'realesr-general']:
    try:
        r = json.load(get('https://huggingface.co/api/models?search=%s&limit=15' % urllib.parse.quote(q)))
        print('search', q, ':', ', '.join(m['id'] for m in r))
    except Exception as e: print('search', q, 'failed', e)
cands = ['facefusion/models-3.0.0', 'facefusion/models-3.1.0', 'facefusion/models-3.2.0', 'facefusion/models', 'Kijai/ClearReality', 'OwlMaster/AllFilesRope']
for repo in cands:
    files = [f for f in tree(repo) if f.get('type') == 'file' and f['path'].endswith('.onnx') and any(k in f['path'].lower() for k in ['gfpgan', 'esrgan', 'realesr'])]
    for f in files:
        size = (f.get('lfs') or {}).get('size') or f.get('size')
        print('FILE', repo, f['path'], size, (f.get('lfs') or {}).get('oid', ''))
picks = [l.strip() for l in os.environ.get('PICKS', '').split(',') if l.strip()]
for u in picks:
    name = u.split('/')[-1]; path = os.path.join(OUT, name)
    try:
        data = get(u).read(); open(path, 'wb').write(data)
        m = onnx.load(path)
        shp = lambda vs: [(v.name, [d.dim_value or d.dim_param for d in v.type.tensor_type.shape.dim], v.type.tensor_type.elem_type) for v in vs]
        print('MODEL', name, len(data), hashlib.sha256(data).hexdigest(), 'opset', [o.version for o in m.opset_import], 'in', shp(m.graph.input), 'out', shp(m.graph.output))
    except Exception as e: print('MODEL', name, 'failed', e)
