# Windows version of doctor.sh: checks every link from the GPU to the public URL n8n Cloud uses.
#   powershell -ExecutionPolicy Bypass -File scripts\doctor.ps1
$ErrorActionPreference = 'Continue'
Set-Location (Split-Path $PSScriptRoot -Parent)
$script:Fail = $false
function Ok([string]$m)  { Write-Host "[ok]   $m" -ForegroundColor Green }
function Bad([string]$m) { Write-Host "[fail] $m" -ForegroundColor Red; $script:Fail = $true }

$envVars = @{}
if (Test-Path .env) {
    foreach ($line in Get-Content .env) {
        if ($line -match '^\s*([A-Z_]+)=(.*)$') { $envVars[$Matches[1]] = $Matches[2].Trim() }
    }
} else { Bad '.env missing - run scripts\setup.ps1' }
$gwPort = if ($envVars['GATEWAY_PORT']) { $envVars['GATEWAY_PORT'] } else { '8000' }
$cfPort = if ($envVars['COMFYUI_PORT']) { $envVars['COMFYUI_PORT'] } else { '8188' }
$GW = "http://127.0.0.1:$gwPort"
$CF = "http://127.0.0.1:$cfPort"
$headers = @{ 'X-API-Key' = $envVars['GATEWAY_API_KEY'] }

$gpu = $null
if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
    $gpu = & nvidia-smi --query-gpu=name,memory.total,memory.used --format=csv,noheader 2>$null
}
if ($gpu) { Ok "host GPU: $($gpu | Select-Object -First 1)" } else { Bad 'nvidia-smi failed (NVIDIA driver not installed?)' }

docker info *> $null
if ($LASTEXITCODE -ne 0) { Bad 'Docker Desktop is not running' }

foreach ($s in 'comfyui', 'gateway') {
    $state = (docker compose ps --format '{{.State}} {{.Health}}' $s 2>$null | Select-Object -First 1)
    if ($state -like 'running*') { Ok "container ${s}: $state" }
    else { Bad "container ${s}: $(if ($state) { $state } else { 'not created' })"; docker compose logs --tail 30 $s }
}

docker compose exec -T comfyui python -c "import torch,sys; sys.exit(0 if torch.cuda.is_available() else 1)" *> $null
if ($LASTEXITCODE -eq 0) { Ok 'CUDA visible inside the ComfyUI container' }
else { Bad 'CUDA NOT visible inside the ComfyUI container - enable the WSL 2 engine in Docker Desktop and update the NVIDIA driver' }

try { Invoke-RestMethod "$CF/system_stats" -TimeoutSec 5 | Out-Null; Ok "ComfyUI API answers on $CF" }
catch { Bad "ComfyUI API not answering on $CF (first start takes 1-2 minutes)" }
try { Invoke-RestMethod "$GW/health" -TimeoutSec 5 | Out-Null; Ok "gateway answers on $GW" }
catch { Bad "gateway not answering on $GW" }

try {
    $st = Invoke-RestMethod "$GW/v1/status" -Headers $headers -TimeoutSec 15
    $c = $st.comfyui
    Write-Host "       comfyui: $(if ($c.ok) { 'ok' } else { $c.error }) | devices: $($c.devices -join ', ')"
    if (-not $c.ok) {
        Bad 'gateway cannot reach ComfyUI, so the HunyuanVideo model files could not be checked'
    } elseif ($c.missing_hunyuan_models -is [string]) {
        Bad "could not check HunyuanVideo model files: $($c.missing_hunyuan_models)"
    } elseif (@($c.missing_hunyuan_models).Count -gt 0) {
        Bad "HunyuanVideo model files missing: $(@($c.missing_hunyuan_models) -join ', ') - run scripts\download-models.ps1"
    } else { Ok 'HunyuanVideo model files present' }
    Write-Host "       seedance configured: $($st.seedance.configured) | model: $($st.seedance.model)"
} catch { Bad "gateway /v1/status failed (wrong GATEWAY_API_KEY?): $($_.Exception.Message)" }

$public = $envVars['PUBLIC_BASE_URL']
if ($public) {
    try { Invoke-RestMethod "$public/health" -TimeoutSec 10 | Out-Null; Ok "public URL reachable: $public (n8n Cloud can reach you)" }
    catch { Bad "public URL $public not reachable - check the tunnel" }
} else {
    Write-Host '       PUBLIC_BASE_URL not set - n8n Cloud cannot reach this machine until the tunnel is set up'
}
if ($script:Fail) { exit 1 }
