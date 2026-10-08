# Windows one-shot setup (Docker Desktop + WSL2 backend + NVIDIA driver).
#   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1            # 24GB+ VRAM
#   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1 -Fp8       # 12-16GB VRAM
#   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1 -NoModels  # skip the ~40GB download
param([switch]$Fp8, [switch]$NoModels)
$ErrorActionPreference = 'Continue'
Set-Location (Split-Path $PSScriptRoot -Parent)

function Ok([string]$m)   { Write-Host "[ok]   $m" -ForegroundColor Green }
function Bad([string]$m)  { Write-Host "[fail] $m" -ForegroundColor Red }
function Stop-Setup([string]$m) { Bad $m; exit 1 }

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Stop-Setup 'Docker is not installed. Install Docker Desktop: https://docs.docker.com/desktop/setup/install/windows-install/'
}
docker info *> $null
if ($LASTEXITCODE -ne 0) { Stop-Setup 'Docker Desktop is not running. Start it, wait for "Engine running", then run this again.' }
docker compose version *> $null
if ($LASTEXITCODE -ne 0) { Stop-Setup 'docker compose v2 is missing - update Docker Desktop.' }
Ok 'Docker is running'

$gpu = $null
if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
    $gpu = & nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>$null
}
$vramMiB = 0
if ($gpu) {
    Ok "GPU: $($gpu | Select-Object -First 1)"
    if (($gpu | Select-Object -First 1) -match '(\d+)\s*MiB') { $vramMiB = [int]$Matches[1] }
}
if ($vramMiB -gt 0 -and $vramMiB -lt 20000 -and -not $Fp8) {
    Write-Host "Only $vramMiB MiB of VRAM - switching to the fp8 HunyuanVideo model (the bf16 one needs 24GB)." -ForegroundColor Yellow
    $Fp8 = [switch]$true
}
else { Bad 'nvidia-smi failed - install the latest NVIDIA driver. Without it only Seedance (API) will work.' }

Write-Host 'Checking that Docker can use the GPU (first run downloads a ~3GB image)...'
docker run --rm --gpus all pytorch/pytorch:2.8.0-cuda12.8-cudnn9-runtime nvidia-smi -L *> $null
if ($LASTEXITCODE -eq 0) { Ok 'Docker can see the GPU' }
else { Bad 'Docker cannot see the GPU. Docker Desktop -> Settings -> General: "Use the WSL 2 based engine" must be on; update the NVIDIA driver and WSL (wsl --update).' }

if (-not (Test-Path .env)) {
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $key = -join ($bytes | ForEach-Object { $_.ToString('x2') })
    $text = [IO.File]::ReadAllText((Resolve-Path .env.example)) -replace '(?m)^GATEWAY_API_KEY=.*$', "GATEWAY_API_KEY=$key"
    [IO.File]::WriteAllText((Join-Path (Get-Location) '.env'), $text, (New-Object Text.UTF8Encoding $false))
    Ok 'Created .env with a random GATEWAY_API_KEY'
}
if ($vramMiB -gt 0 -and $vramMiB -le 12288) {
    $envPath = Join-Path (Get-Location) '.env'
    $text = [IO.File]::ReadAllText($envPath)
    if ($text -match '(?m)^COMFYUI_ARGS=\s*$') {
        $text = $text -replace '(?m)^COMFYUI_ARGS=\s*$', 'COMFYUI_ARGS=--lowvram'
        [IO.File]::WriteAllText($envPath, $text, (New-Object Text.UTF8Encoding $false))
        Write-Host 'Low-VRAM card: set COMFYUI_ARGS=--lowvram in .env' -ForegroundColor Yellow
    }
}
foreach ($d in 'models', 'output', 'input', 'custom_nodes', 'user', 'gateway', 'n8n') {
    New-Item -ItemType Directory -Force -Path "data/$d" | Out-Null
}

if (-not $NoModels) {
    $dl = Join-Path $PSScriptRoot 'download-models.ps1'
    if ($Fp8) { & $dl -Fp8 } else { & $dl }
    if (-not $?) { Stop-Setup 'model download failed - run the setup again to resume' }
}

$composeArgs = @()
if (Select-String -Path .env -Pattern '^CLOUDFLARE_TUNNEL_TOKEN=.+' -Quiet) { $composeArgs += @('--profile', 'tunnel') }
Write-Host 'Building and starting containers (first build takes 10-20 minutes)...'
docker compose @composeArgs up -d --build
if ($LASTEXITCODE -ne 0) { Stop-Setup 'docker compose up failed - see the output above' }

Ok 'Started. ComfyUI: http://127.0.0.1:8188   Gateway: http://127.0.0.1:8000'
Write-Host 'Next: powershell -ExecutionPolicy Bypass -File scripts\doctor.ps1'
