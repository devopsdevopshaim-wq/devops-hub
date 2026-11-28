#!/usr/bin/env python3
"""A new release of frame-studio: one version number everywhere (python3 frame-studio/tools/bump.py 33).
?v= on every local script and stylesheet, window.FS_V in the self-heal script, version.json, the service worker's
CACHE, and the CSP hash of the self-heal script in admin.html (its CSP allows only that inline script)."""
import re, sys, glob, json, hashlib, base64, os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
V = sys.argv[1]
for p in glob.glob('*.html'):
    s = open(p, encoding='utf-8').read()
    s = re.sub(r"window\.FS_V='\d+'", "window.FS_V='" + V + "'", s)
    s = re.sub(r'((?:src|href)="(?:js|css)/[^"?]+\.(?:js|css))(\?v=\d+)?"', lambda m: m.group(1) + '?v=' + V + '"', s)
    m = re.search(r'<script>(/\* self-heal:.*?)</script>', s, re.S)
    if m and 'Content-Security-Policy' in s:
        h = base64.b64encode(hashlib.sha256(m.group(1).encode('utf-8')).digest()).decode()
        s = re.sub(r"script-src 'self'( 'sha256-[^']+')?", "script-src 'self' 'sha256-" + h + "'", s, count=1)
    open(p, 'w', encoding='utf-8').write(s)
json.dump({'v': V}, open('version.json', 'w'))
s = open('sw.js', encoding='utf-8').read(); open('sw.js', 'w', encoding='utf-8').write(re.sub(r"frame-studio-v\d+", 'frame-studio-v' + V, s))
print('version', V)
