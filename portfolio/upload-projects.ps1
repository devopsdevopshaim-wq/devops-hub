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

# 'Continue', not 'Stop': Windows PowerShell 5.1 turns any stderr output from
# gh/git into a terminating error under 'Stop', even when the exit code is what
# we check. Cmdlets that must not fail get -ErrorAction Stop instead.
$ErrorActionPreference = 'Continue'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$data = Get-Content -Raw -Encoding UTF8 -ErrorAction Stop (Join-Path $here 'projects.json') | ConvertFrom-Json
$owner = $data.owner

foreach ($tool in 'git', 'gh') {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "$tool is not installed" }
}
gh auth status 2>&1 | Out-Null
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
  gh repo view $full 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Repository already exists, skipping"; $skipped += $p.id; continue
  }
  if ($DryRun) { Write-Host "Would upload $src"; continue }

  $dir = Join-Path $work $p.repo
  if (Test-Path -LiteralPath $dir) { Remove-Item -LiteralPath $dir -Recurse -Force }
  New-Item -ItemType Directory -Path $dir -ErrorAction Stop | Out-Null

  if ($p.local.mode -eq 'file') {
    # A single page becomes the site's index.html
    Copy-Item -LiteralPath $src -Destination (Join-Path $dir 'index.html') -ErrorAction Stop
  } else {
    robocopy $src $dir /E /XD node_modules .git .venv __pycache__ /XF .env .env.* *.pem *.key /NFL /NDL /NJH /NJS /NP | Out-Null
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

  # Public repos must not carry API keys. Stop on anything that looks like one.
  if (-not $p.private) {
    $keyPattern = '(?<![A-Za-z0-9_-])sk-(ant-|proj-)?[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{35}|gh[pousr]_[A-Za-z0-9]{36}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}'
    $textFiles = Get-ChildItem -LiteralPath $dir -Recurse -File | Where-Object { $_.Extension -match '^\.(html?|js|mjs|ts|json|py|txt|md|env|ya?ml|ini|cfg)$' }
    $hits = $textFiles | Select-String -Pattern $keyPattern -List
    if ($hits) {
      foreach ($h in $hits) { Write-Warning "Possible API key in $($h.Path.Substring($dir.Length + 1)) line $($h.LineNumber)" }
      Write-Warning "Not uploading $($p.id). Remove the key from $src and run again with -Only $($p.id)"
      $skipped += $p.id
      continue
    }
  }

  $readme = "# $($p.title)`n`n$($p.desc)`n`nSite: https://$owner.github.io/$($p.repo)/`n"
  [IO.File]::WriteAllText((Join-Path $dir 'README.md'), $readme, (New-Object Text.UTF8Encoding $false))
  New-Item -ItemType File -Force -Path (Join-Path $dir '.nojekyll') | Out-Null

  Push-Location $dir
  try {
    git init -q 2>&1 | Out-Null
    git symbolic-ref HEAD refs/heads/main
    git add -A 2>&1 | Out-Null
    git commit -q -m "Upload $($p.id)" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "git commit failed in $dir" }
    $visibility = if ($p.private) { '--private' } else { '--public' }
    gh repo create $full $visibility --source . --remote origin --push
    if ($LASTEXITCODE -ne 0) { throw "gh repo create failed for $full" }
    if (-not $p.private) {
      gh api -X POST "repos/$full/pages" -f "source[branch]=main" -f "source[path]=/" 2>&1 | Out-Null
      if ($LASTEXITCODE -ne 0) { Write-Warning "Could not turn on Pages for $full; turn it on in the repo's Settings > Pages" }
      Write-Host "Pages: https://$owner.github.io/$($p.repo)/" -ForegroundColor Green
    }
    $done += $p.id
  } finally {
    Pop-Location
  }
}

Write-Host "`nUploaded: $($done.Count)  Skipped: $($skipped.Count)" -ForegroundColor Yellow
if ($skipped.Count) { Write-Host ("Skipped: " + ($skipped -join ', ')) }
