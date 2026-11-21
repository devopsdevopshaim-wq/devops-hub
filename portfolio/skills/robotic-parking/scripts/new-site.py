#!/usr/bin/env python3
"""Scaffold a robotic-parking site from the skill template.

Usage:
  new-site.py <target-dir> [--brand NAME] [--project NAME] [--whatsapp 05X..] [--phone "05X-..."]
              [--repo owner/repo] [--site-path robotic-parking]
              [--floors N] [--cells N] [--sides 1|2] [--lifts 1|2] [--pitch MM]
              [--car-l MM] [--car-w MM] [--car-mass KG]
"""
import argparse, os, re, shutil, subprocess, sys, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
TPL = os.path.join(HERE, "..", "template")

def intl(num):
    d = re.sub(r"\D", "", num or "")
    if d.startswith("0"): d = "972" + d[1:]
    return d

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("target")
    ap.add_argument("--brand"); ap.add_argument("--project")
    ap.add_argument("--whatsapp"); ap.add_argument("--phone")
    ap.add_argument("--repo"); ap.add_argument("--site-path")
    for k in ["floors", "cells", "sides", "lifts", "pitch", "car-l", "car-w", "car-mass"]:
        ap.add_argument("--" + k, type=int)
    a = ap.parse_args()
    if os.path.exists(a.target) and os.listdir(a.target):
        sys.exit(f"{a.target} exists and is not empty")
    shutil.copytree(TPL, a.target, dirs_exist_ok=True)
    p = os.path.join(a.target, "app.html")
    s = open(p, encoding="utf-8").read()
    def sub(old, new, count=0):
        nonlocal s
        if old not in s: sys.exit(f"template marker not found: {old[:60]}")
        s = s.replace(old, new) if count == 0 else s.replace(old, new, count)
    if a.brand:
        sub("<span>פארק־פלאן</span>", f"<span>{a.brand}</span>")
        sub("פארק־פלאן · תכנון חניונים רובוטיים", f"{a.brand} · תכנון חניונים רובוטיים")
    if a.project:
        s = re.sub(r'project:"[^"]*"', 'project:"' + a.project.replace('"', "'") + '"', s, count=1)
    if a.whatsapp:
        s = re.sub(r"https://wa\.me/\d+", "https://wa.me/" + intl(a.whatsapp), s)
    if a.phone:
        s = re.sub(r'(<span class="cta-num">)[^<]*(</span>)', r"\g<1>" + a.phone + r"\g<2>", s)
    if a.repo:
        s = re.sub(r'repo:"[^"]+/[^"]+",dir:"[^"]*"', f'repo:"{a.repo}",dir:"{(a.site_path or "robotic-parking").strip("/")}/gallery/"', s, count=1)
    elif a.site_path:
        s = re.sub(r'dir:"[^"]*/gallery/"', f'dir:"{a.site_path.strip("/")}/gallery/"', s, count=1)
    m = {"floors": "floors", "cells": "cellsPerSide", "sides": "sides", "lifts": "lifts", "pitch": "cellPitch",
         "car_l": "carL", "car_w": "carW", "car_mass": "carMass"}
    for arg, key in m.items():
        v = getattr(a, arg)
        if v is not None:
            s, n = re.subn(r"(const DEF=\{[^;]*?\b" + key + r":)\d+", r"\g<1>" + str(v), s, count=1)
            if not n: sys.exit(f"DEF.{key} not found")
    open(p, "w", encoding="utf-8").write(s)
    subprocess.run(["sh", os.path.join(a.target, "build.sh")], check=True)
    print(f"Site ready in {a.target}. Next: render-images.sh {a.target} (if the configuration changed), then validate.mjs.")

if __name__ == "__main__":
    main()
