# Deploy

## GitHub Pages (recommended, public)
Put the built site in `<site-path>/` of the repo: `index.html`, `img/`, `gallery/` (plus `app.html`, `build.sh`, `README.md` as sources).
If the repo publishes with a workflow that assembles `gh-pages`, add:
```yaml
          if [ -d <site-path> ]; then
            mkdir -p /tmp/site/<site-path>
            cp <site-path>/index.html /tmp/site/<site-path>/
            cp -r <site-path>/img <site-path>/gallery /tmp/site/<site-path>/ 2>/dev/null || true
          fi
```
and `'<site-path>/**'` to the workflow's `paths`, and keep the folder in any "restore sub-sites" loop.

Gallery publishing from the live site: the owner opens "הגדרות פרסום" and stores a fine-grained token (Contents: Read and write, this repo only). "פרסום באתר" commits the photo and `gallery.json`; the Pages workflow republishes in ~2 minutes.

## Claude artifact (private link)
Publish `app.html` (not `index.html`) with
```
files: { "img/hero.jpg": ".../img/hero.jpg", …every img…, "gallery/gallery.json": ".../gallery/gallery.json" }
capabilities: { downloads: true, assets: {}, db: {} }
```
Inside the artifact: three.js loads from jsDelivr (allowed), ZIP/CSV downloads go through the `downloads` capability, gallery uploads go to the artifact's asset store with metadata in the `gallery` db collection, printing is unavailable (use the standalone `index.html`).

## Portfolio entry
If the user keeps a portfolio `projects.json`, add an entry with `id`, `title`, `desc`, `category`, `url`, `features`, `tech`, `story`, plus desktop/mobile screenshots (1280×800 and 390×844 JPEG q72).
