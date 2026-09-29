# Portfolio — הפרויקטים שלי

Live: https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/

- `projects.json` — the list of projects (title, category, live URL or local path + repo name).
- `index.html`, `css/`, `js/` — the site. It checks GitHub for each repo, so a card switches to
  "באוויר" (live) by itself once its repo exists and has Pages turned on.
- `upload-projects.ps1` — run on Windows. It gives each local project its own repo and turns on Pages.

## Upload the local projects (once, on your PC)

```powershell
winget install GitHub.cli
gh auth login
cd <this repo>\portfolio
powershell -ExecutionPolicy Bypass -File .\upload-projects.ps1 -DryRun   # shows what it will do
powershell -ExecutionPolicy Bypass -File .\upload-projects.ps1           # uploads
```

It skips repos that already exist, so it is safe to run again. To add a project, add an entry to
`projects.json` (for the localhost ones, fill in `repo` and a `local` block) and run the script again.
`insurance-analysis` is uploaded as a private repo because it is a personal report.
