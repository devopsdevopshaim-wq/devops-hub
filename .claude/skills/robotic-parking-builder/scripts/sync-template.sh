#!/usr/bin/env bash
# Refresh the skill template from a working site (default: <repo>/robotic-parking) and rebuild the skill ZIP.
# Usage: sync-template.sh [site-dir] [zip-out]
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; SK="$(dirname "$HERE")"; ROOT="$(cd "$SK/../../.." && pwd)"
SITE="${1:-$ROOT/robotic-parking}"; OUT="${2:-$ROOT/robotic-parking-builder-skill.zip}"
rm -rf "$SK/template"; mkdir -p "$SK/template"
cp "$SITE/app.html" "$SITE/build.sh" "$SITE/index.html" "$SITE/README.md" "$SK/template/"
cp -r "$SITE/img" "$SITE/gallery" "$SK/template/"
if [ -f "$SITE/site.json" ]; then cp "$SITE/site.json" "$SK/template/"; fi
rm -f "$OUT"; ( cd "$(dirname "$SK")" && zip -rq "$OUT" "$(basename "$SK")" ); echo "Template synced; skill zip: $OUT"
