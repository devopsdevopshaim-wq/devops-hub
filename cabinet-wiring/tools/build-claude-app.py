#!/usr/bin/env python3
"""בונה את גרסת claude.ai של ארון־פלאן מאותם קבצים של האתר.

בגרסה הזו השרטוטים נקראים עם Claude (יכולת sample של דף Artifact), בלי מפתחות ובלי n8n.
הפלט: תיקייה עם index.html (תוכן הדף בלבד: הפלטפורמה עוטפת אותו ב-<html>/<head>) וקבצי js.

    python3 tools/build-claude-app.py OUT_DIR
"""
import pathlib
import re
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
REPO = ROOT.parent
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'dist-claude')
if out.exists():
    shutil.rmtree(out)
(out / 'js' / 'library').mkdir(parents=True)

html = (ROOT / 'index.html').read_text(encoding='utf-8')
head = re.search(r'<head>(.*?)</head>', html, re.S).group(1)
body = re.search(r'<body[^>]*>(.*?)</body>', html, re.S).group(1)

importmap = re.search(r'<script type="importmap">.*?</script>', head, re.S).group(0)
umd = re.findall(r'<script src="(js/[^"]+)"></script>', head)
fonts = re.search(r'<link rel="stylesheet" href="(https://fonts.googleapis.com[^"]+)">', head).group(1)

css = (REPO / 'portfolio/css/mobile.css').read_text(encoding='utf-8') + '\n' + (ROOT / 'css/styles.css').read_text(encoding='utf-8')
css = css.replace('</style', '<\\/style')

# הקישור לגרסת Claude מיותר כשכבר נמצאים בה
body = body.replace('<script type="module" src="js/app.js"></script>', '')

page = f'''<title>ארון־פלאן</title>
<script>document.documentElement.lang = 'he'; document.documentElement.dir = 'rtl'; window.CLAUDE_APP = '';</script>
<link rel="stylesheet" href="{fonts}">
<style>
{css}
</style>
{importmap}
{''.join(f'<script src="{s}"></script>' for s in umd)}
{body}
<script type="module" src="js/app.js"></script>
'''
(out / 'index.html').write_text(page, encoding='utf-8')
for f in list((ROOT / 'js').glob('*.js')) + list((ROOT / 'js/library').glob('*.js')):
    rel = f.relative_to(ROOT)
    shutil.copy(f, out / rel)
print(out, len(page), 'bytes;', len(umd), 'umd scripts')
