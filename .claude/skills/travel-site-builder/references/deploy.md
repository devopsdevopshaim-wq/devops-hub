# Deploying

## GitHub Pages (public URL, auto-updates)

**Fastest way to switch it on:** push a `gh-pages` branch that holds only the site. For a **public** repo, GitHub creates the Pages site automatically on that first push. The Actions `configure-pages` / `deploy-pages` route fails with `Resource not accessible by integration` until someone sets Settings → Pages by hand, so don't depend on it.

```bash
<skill>/scripts/publish-gh-pages.sh <site-dir>
# → https://<owner>.github.io/<repo>/  (first build takes ~1 minute: Actions → "pages build and deployment")
```

A private repo needs GitHub Pro or Team for Pages, and the site is public even then. Tell the user and offer to make the repo public, or use Netlify.

**Automatic updates**: add `.github/workflows/<site>-pages.yml` on the default branch (replace `SITE_DIR`):

```yaml
name: Deploy site to GitHub Pages
on:
  push:
    branches: [main]
    paths: ['SITE_DIR/**']
  workflow_dispatch:
permissions:
  contents: write
concurrency:
  group: site-pages
  cancel-in-progress: true
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Publish to gh-pages
        run: |
          set -euo pipefail
          rm -rf /tmp/site && mkdir -p /tmp/site
          cp -r SITE_DIR/. /tmp/site/ && rm -f /tmp/site/README.md && touch /tmp/site/.nojekyll
          cd /tmp/site && git init -q -b gh-pages
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add -A && git commit -q -m "Publish from ${GITHUB_SHA}"
          git push -f "https://x-access-token:${{ secrets.GITHUB_TOKEN }}@github.com/${GITHUB_REPOSITORY}.git" gh-pages
```

## Claude artifact (instant private link)
```bash
python3 <skill>/scripts/build-artifact.py <site-dir> <scratch>/site-artifact.html
```
The script prints the `files` map. Publish with the Artifact tool, passing `file_path` = the generated html, `files` = that map, and an `icon` such as "plane". The artifact CSP blocks external images, the YouTube iframe, map tiles and the live-rate fetch. The site degrades gracefully: posters instead of photos, videos open YouTube, the map falls back to Google Maps links, and the fallback exchange rate is labeled "משוער".

## ZIP / Netlify
- `<skill>/scripts/make-zip.sh <site-dir>`, then send the zip to the user. Opening `index.html` directly works. From `file://`, YouTube refuses embeds, so the videos open YouTube instead.
- Netlify Drop: the user drags the unzipped folder onto https://app.netlify.com/drop and gets a public https URL. Embedded videos, photos and live rates all work there.

## Behaviour by environment

| Feature | file:// | GitHub Pages / Netlify | Claude artifact |
| --- | --- | --- | --- |
| Real photos | ✓ | ✓ | posters only |
| Inline YouTube player | opens YouTube | ✓ | opens YouTube |
| Map tiles | ✓ | ✓ | link fallback |
| Live exchange rate | ✓ | ✓ | fallback rate |
| WhatsApp deal button | ✓ | ✓ | may not open for some viewers |

## n8n (deals and AI agent)
1. `node <skill>/scripts/build-knowledge.mjs <site-dir>` writes `<site-dir>/api/knowledge.json`. Commit it, and add the same command as a step in the Pages workflow before publishing so it stays current.
2. `python3 <skill>/scripts/build-workflow.py --owner O --repo R --site-dir D --brand "שם" --email agent@x --prefix slug --out n8n/<slug>.json`.
3. The user imports the JSON in n8n Cloud (Import from File), connects Gmail and an Anthropic key, optionally enables the Google Sheets node, and activates the workflow.
4. The site served at `https://<name>.app.n8n.cloud/webhook/<slug>` connects to the deal and chat webhooks automatically, because n8n injects `window.APP_N8N`. For the GitHub Pages copy, set `n8n.base` in `js/config.js`.

The site posts `text/plain` JSON (no CORS preflight). The Code nodes accept either a string or an object body. If n8n is unreachable, the chat falls back to the local keyword assistant and deals fall back to WhatsApp or copy-paste.
