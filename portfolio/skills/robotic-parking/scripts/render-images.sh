#!/usr/bin/env bash
# Render img/*.jpg from the site's own three.js model, then grade them.
# Usage: render-images.sh <site-dir>
set -euo pipefail
SITE="$(cd "${1:?site dir}" && pwd)"; HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="${TMPDIR:-/tmp}/rp-render"; mkdir -p "$WORK"
if [ -z "${THREE_BUILD:-}" ]; then
  if [ ! -f "$WORK/node_modules/three/build/three.module.js" ] || ! grep -q '"version": "0.186.1"' "$WORK/node_modules/three/package.json"; then (cd "$WORK" && npm init -y >/dev/null && npm install --no-audit --no-fund three@0.186.1 >/dev/null); fi
  THREE_BUILD="$WORK/node_modules/three/build"
fi
sh "$SITE/build.sh" >/dev/null
SITE="$SITE" WORK="$WORK" THREE_BUILD="$THREE_BUILD" node "$HERE/render-images.js"
post(){ # in out W H mood
  case $5 in dusk) G="-modulate 100,108,100 -fill #ff9d4d -colorize 4%"; B=55;; day) G="-modulate 102,104,100 -fill #ffe2b0 -colorize 3%"; B=30;; *) G="-modulate 101,100,100"; B=08;; esac
  convert "$1" -filter Lanczos -resize "${3}x${4}!" \( +clone -level 72%,100% -blur 0x$(( $3 / 90 )) -evaluate multiply 0.$B \) -compose screen -composite \
    $G -sigmoidal-contrast 3,50% \( -size "${3}x${4}" radial-gradient:white-gray28 -gamma 1.6 \) -compose multiply -composite \
    -attenuate 0.18 +noise Gaussian -unsharp 0x0.8+0.6+0 -strip -quality 82 -sampling-factor 4:2:0 -interlace JPEG "$2"; }
mkdir -p "$SITE/img"
post "$WORK/hero.png" "$SITE/img/hero.jpg" 2000 1000 dusk
post "$WORK/cutaway.png" "$SITE/img/cutaway.jpg" 1600 900 day
post "$WORK/type-tower.png" "$SITE/img/type-tower.jpg" 1200 800 dusk
post "$WORK/type-shuttle.png" "$SITE/img/type-shuttle.jpg" 1200 800 day
post "$WORK/type-twin.png" "$SITE/img/type-twin.jpg" 1200 800 dusk
post "$WORK/type-under.png" "$SITE/img/type-under.jpg" 1200 800 day
post "$WORK/cabinet.png" "$SITE/img/cabinet.jpg" 1200 900 studio
echo "Images written to $SITE/img"
