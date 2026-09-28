#!/usr/bin/env bash
# Publish a site folder to the gh-pages branch of the current git repo.
# Pushing gh-pages turns GitHub Pages on automatically for public repos
# (no Settings change needed). Site URL: https://<owner>.github.io/<repo>/
# Usage: publish-gh-pages.sh <site-dir> [remote-name]
set -euo pipefail
SITE="$(cd "${1:?site dir}" && pwd)"
REMOTE="${2:-origin}"
URL="$(git remote get-url "$REMOTE")"
TMP="$(mktemp -d)"
cp -r "$SITE/." "$TMP/"
rm -f "$TMP/README.md"
touch "$TMP/.nojekyll"
cd "$TMP"
git init -q -b gh-pages
git add -A
git -c user.name="${GIT_AUTHOR_NAME:-site-publisher}" -c user.email="${GIT_AUTHOR_EMAIL:-site-publisher@users.noreply.github.com}" \
  commit -q -m "Publish site"
git push -f "$URL" gh-pages
echo "Pushed to gh-pages. Check the 'pages build and deployment' run in Actions."
