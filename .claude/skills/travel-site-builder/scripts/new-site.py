#!/usr/bin/env python3
"""
Create a new travel-management site from the skill template.

Usage:
  python3 new-site.py <target-dir> --brand "שם האתר" [--title "..."] \
      [--whatsapp 972501234567] [--phone 050-123-4567] [--email a@b.com] \
      [--agency "שם הסוכנות"] [--license 1234] [--keep-destinations]

By default the 14 example destinations stay in place as a working
reference; replace them in js/data.js, js/media.js and js/money.js.
"""
import argparse, json, re, shutil, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
TEMPLATE = HERE.parent / 'template'


def set_field(text, key, value):
    """Replace `key: '...'` (first occurrence) in config.js, keeping the comment."""
    pat = re.compile(r"(\b%s:\s*)'[^']*'" % re.escape(key))
    lit = json.dumps(value, ensure_ascii=False)[1:-1].replace("'", "\\'")
    new, n = pat.subn(lambda m: f"{m.group(1)}'{lit}'", text, count=1)
    if not n:
        sys.exit(f'config.js: field {key} not found')
    return new


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('target')
    ap.add_argument('--brand', required=True)
    ap.add_argument('--title')
    ap.add_argument('--whatsapp', default='')
    ap.add_argument('--phone', default='')
    ap.add_argument('--email', default='')
    ap.add_argument('--agency', default='')
    ap.add_argument('--license', default='')
    a = ap.parse_args()

    target = Path(a.target).resolve()
    if target.exists() and any(target.iterdir()):
        sys.exit(f'{target} exists and is not empty — pick a new folder')
    shutil.copytree(TEMPLATE, target, dirs_exist_ok=True)

    wa = re.sub(r'\D', '', a.whatsapp)
    if wa.startswith('0'):          # Israeli local number → international
        wa = '972' + wa[1:]

    cfg = target / 'js' / 'config.js'
    t = cfg.read_text(encoding='utf-8')
    t = set_field(t, 'name', a.brand)                       # brand.name (first "name:")
    t = set_field(t, 'title', a.title or f'{a.brand} — ניהול חופשות')
    # agency.name is the second "name:" in the file
    t = re.sub(r"(agency:\s*\{\s*name:\s*)'[^']*'", lambda m: f"{m.group(1)}'{a.agency}'", t, count=1)
    t = set_field(t, 'whatsapp', wa)
    t = set_field(t, 'phone', a.phone)
    t = set_field(t, 'email', a.email)
    t = set_field(t, 'license', a.license)
    cfg.write_text(t, encoding='utf-8')

    idx = target / 'index.html'
    h = idx.read_text(encoding='utf-8')
    h = re.sub(r'<title>[^<]*</title>', f'<title>{a.title or a.brand + " — ניהול חופשות"}</title>', h, count=1)
    h = re.sub(r'(<[^>]*data-brand[^>]*>)[^<]*(<)', lambda m: m.group(1) + a.brand + m.group(2), h)
    idx.write_text(h, encoding='utf-8')

    print(f'Created {target}')
    print('Next: edit js/data.js, js/media.js, js/money.js, then run validate.mjs')


if __name__ == '__main__':
    main()
