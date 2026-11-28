#!/usr/bin/env bash
# Zip a site folder for download. Usage: make-zip.sh <site-dir> [out.zip]
set -euo pipefail
SITE="${1:?site dir}"; OUT="${2:-$(basename "$SITE").zip}"
rm -f "$OUT"; ( cd "$(dirname "$SITE")" && zip -rq "$OLDPWD/$OUT" "$(basename "$SITE")" -x "*/node_modules/*" ); echo "Created $OUT"
