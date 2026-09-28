#!/usr/bin/env python3
"""
Package a site folder as a Claude artifact page.

Artifacts are wrapped in their own <!doctype>/<head>/<body>, so this writes
the page body (between <!--APP-START--> and <!--APP-END--> in index.html)
with the title, stylesheets and scripts, and prints the `files` map to pass
to the Artifact tool alongside it.

Usage: python3 build-artifact.py <site-dir> <out.html>
"""
import json, re, sys
from pathlib import Path

site = Path(sys.argv[1]).resolve()
out = Path(sys.argv[2]).resolve()
html = (site / 'index.html').read_text(encoding='utf-8')
body = html.split('<!--APP-START-->')[1].split('<!--APP-END-->')[0]
title = re.search(r'<title>(.*?)</title>', html, re.S).group(1)
fonts = re.search(r'<link rel="stylesheet" href="(https://fonts\.googleapis\.com[^"]+)"', html).group(1)
scripts = re.findall(r'<script src="([^"]+)"></script>', html)
styles = [h for h in re.findall(r'<link rel="stylesheet" href="([^"]+)"', html) if not h.startswith('http')]

page = (f'<title>{title}</title>\n'
        f'<link rel="stylesheet" href="{fonts}">\n'
        + ''.join(f'<link rel="stylesheet" href="{s}">\n' for s in styles)
        + "<script>document.documentElement.lang='he';document.documentElement.dir='rtl';</script>\n"
        + body + '\n'
        + ''.join(f'<script src="{s}"></script>\n' for s in scripts))
out.write_text(page, encoding='utf-8')

files = {p: str(site / p) for p in styles + scripts}
print(f'Wrote {out}')
print('files =', json.dumps(files, ensure_ascii=False, indent=2))
