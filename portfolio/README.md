# Portfolio — הסדנה

Live: https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/

| Path | What it is |
| --- | --- |
| `projects.json` | Every project: title, field, description, features, technologies, story, and either a live `url` or a GitHub `repo`. `noshot: true` skips the screenshot. `guideApi` is the address of Guy's AI agent: the n8n webhook URL (see `n8n/README.md`) or the base URL of `guide-server/`. Empty = word matching only. |
| `index.html`, `css/`, `js/` | The site. `#p/<id>` opens a project's page. |
| `js/guide.js` | Guy, the talking guide. |
| `js/add.js` | The "הוספת פרויקט" form. |
| `shots/` | Screenshots, made by `.github/workflows/portfolio-shots.yml`. |
| `knowledge.json` | Built on every deploy by `.github/scripts/portfolio-knowledge.mjs` from each project's code; read by Guy's n8n agent. Not committed. |
| `og.png` | The image shown when the link is shared. |
| `guide-server/` | Optional AI server for Guy (Claude API). |
| `upload-projects.ps1` | Windows script that put each local project in its own repo. |

## Adding a project

Use the "הוספת פרויקט" form on the site. It opens a GitHub issue titled `הוספת פרויקט: …`;
`.github/workflows/portfolio-add.yml` adds the project to `projects.json`, takes its screenshot,
republishes the site and closes the issue. Only issues opened by the repository owner are processed.

## Refreshing screenshots

Actions → "Portfolio screenshots" → Run workflow (leave ids empty for all, or list ids).

## Turning on Guy's AI answers

Recommended: the multi-agent n8n Cloud workflow in `n8n/hasadna-multi-agent.json`, installed by the "Deploy agents to n8n Cloud" action (steps in `n8n/README.md`). It also sets `statusUrl`, the live control center the cards read their status from. The alternative below runs the same idea as a small server on Render.

1. Create an API key at https://console.anthropic.com (usage is billed per question).
2. On Render: New → Blueprint → this repo, and set **Blueprint Path** to `portfolio/guide-server/render.yaml`. Paste the key into `ANTHROPIC_API_KEY`.
3. Put the service address (e.g. `https://hasadna-guide.onrender.com`) in `guideApi` in `projects.json`.

The server answers only requests from the site's own address and limits each visitor to 40 questions an hour.
If it is down or asleep, Guy falls back to word matching.
