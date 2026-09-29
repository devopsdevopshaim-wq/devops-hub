<#
  Uploads every local project listed in projects.json to its own GitHub
  repository and turns on GitHub Pages for it, so the portfolio site can
  link to https://<owner>.github.io/<repo>/.

  Needs: git and the GitHub CLI (winget install GitHub.cli), then `gh auth login`.

  Usage (from this folder):
    powershell -ExecutionPolicy Bypass -File .\upload-projects.ps1 -DryRun
    powershell -ExecutionPolicy Bypass -File .\upload-projects.ps1
    powershell -ExecutionPolicy Bypass -File .\upload-projects.ps1 -Only zohar

  Repositories that already exist are skipped, so it is safe to run again.
#>
param(
  [string]$Only = '',
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$data = Get-Content -Raw -Encoding UTF8 (Join-Path $here 'projects.json') | ConvertFrom-Json
$owner = $data.owner

foreach ($tool in 'git', 'gh') {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "$tool is not installed" }
}
gh auth status *> $null
if ($LASTEXITCODE -ne 0) { throw "Run 'gh auth login' first" }

$work = Join-Path $env:TEMP 'portfolio-upload'
New-Item -ItemType Directory -Force -Path $work | Out-Null
$done = @(); $skipped = @()

foreach ($p in $data.projects) {
  if (-not $p.local -or -not $p.repo) { continue }
  if ($Only -and $p.id -ne $Only) { continue }

  $src = $p.local.path
  $full = "$owner/$($p.repo)"
  Write-Host "`n== $($p.id) -> $full" -ForegroundColor Cyan

  if (-not (Test-Path -LiteralPath $src)) {
    Write-Warning "Not found: $src"; $skipped += $p.id; continue
  }
  gh repo view $full *> $null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Repository already exists, skipping"; $skipped += $p.id; continue
  }
  if ($DryRun) { Write-Host "Would upload $src"; continue }

  $dir = Join-Path $work $p.repo
  if (Test-Path -LiteralPath $dir) { Remove-Item -LiteralPath $dir -Recurse -Force }
  New-Item -ItemType Directory -Path $dir | Out-Null

  if ($p.local.mode -eq 'file') {
    # A single page becomes the site's index.html
    Copy-Item -LiteralPath $src -Destination (Join-Path $dir 'index.html')
  } else {
    robocopy $src $dir /E /XD node_modules .git .venv __pycache__ /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "Copy failed for $src" }
    $entry = Get-ChildItem -LiteralPath $dir -File | Where-Object { $_.Name -like $p.local.entry } | Select-Object -First 1
    if (-not $entry) {
      Write-Warning "Start page '$($p.local.entry)' not found in $src"
    } elseif ($entry.Name -ne 'index.html') {
      if (Test-Path -LiteralPath (Join-Path $dir 'index.html')) {
        Write-Warning "Folder already has an index.html; the site will open that instead of $($entry.Name)"
      } else {
        $target = [uri]::EscapeDataString($entry.Name)
        $html = "<!doctype html><meta charset=`"utf-8`"><meta http-equiv=`"refresh`" content=`"0; url=$target`"><a href=`"$target`">$($entry.Name)</a>"
        [IO.File]::WriteAllText((Join-Path $dir 'index.html'), $html, (New-Object Text.UTF8Encoding $false))
      }
    }
  }

  # GitHub rejects files over 100 MB
  $big = Get-ChildItem -LiteralPath $dir -Recurse -File | Where-Object { $_.Length -gt 95MB }
  foreach ($f in $big) { Write-Warning "Leaving out large file: $($f.FullName)"; Remove-Item -LiteralPath $f.FullName }

  $readme = "# $($p.title)`n`n$($p.desc)`n`nSite: https://$owner.github.io/$($p.repo)/`n"
  [IO.File]::WriteAllText((Join-Path $dir 'README.md'), $readme, (New-Object Text.UTF8Encoding $false))
  New-Item -ItemType File -Force -Path (Join-Path $dir '.nojekyll') | Out-Null

  Push-Location $dir
  try {
    git init -q
    git checkout -q -b main
    git add -A
    git commit -q -m "Upload $($p.id)"
    $visibility = if ($p.private) { '--private' } else { '--public' }
    gh repo create $full $visibility --source . --remote origin --push
    if ($LASTEXITCODE -ne 0) { throw "gh repo create failed for $full" }
    if (-not $p.private) {
      gh api -X POST "repos/$full/pages" -f "source[branch]=main" -f "source[path]=/" | Out-Null
      Write-Host "Pages: https://$owner.github.io/$($p.repo)/" -ForegroundColor Green
    }
    $done += $p.id
  } finally {
    Pop-Location
  }
}

Write-Host "`nUploaded: $($done.Count)  Skipped: $($skipped.Count)" -ForegroundColor Yellow
if ($skipped.Count) { Write-Host ("Skipped: " + ($skipped -join ', ')) }
