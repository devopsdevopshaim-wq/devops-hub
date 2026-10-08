# Smoke test from Windows: generates one short video through the gateway and waits for it.
#   powershell -ExecutionPolicy Bypass -File scripts\test-generate.ps1 [-Provider auto|hunyuan|seedance] [-Prompt "..."]
#     [-Width 480] [-Height 320] [-Frames 25] [-Steps 20]   (small defaults so it also fits 6-8GB laptop GPUs)
param(
    [string]$Provider = 'auto',
    [string]$Prompt = 'a red fox running through snow, cinematic, golden hour',
    [int]$Width = 480, [int]$Height = 320, [int]$Frames = 25, [int]$Steps = 20
)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$key = ((Get-Content .env | Where-Object { $_ -match '^GATEWAY_API_KEY=' }) -split '=', 2)[1].Trim()
$gw = if ($env:GW) { $env:GW } else { 'http://127.0.0.1:8000' }
$headers = @{ 'X-API-Key' = $key }
$body = @{ provider = $Provider; prompt = $Prompt; width = $Width; height = $Height; frames = $Frames; steps = $Steps } | ConvertTo-Json
Write-Host "$Provider ${Width}x$Height, $Frames frames, $Steps steps - on a small GPU this can take a long time"
$job = Invoke-RestMethod "$gw/v1/generate" -Method Post -Headers $headers -ContentType 'application/json' -Body $body
Write-Host "job $($job.job_id)"
do {
    Start-Sleep -Seconds 10
    $j = Invoke-RestMethod "$gw/v1/jobs/$($job.job_id)" -Headers $headers
    Write-Host "  $($j.status)"
} while ($j.status -ne 'succeeded' -and $j.status -ne 'failed')
if ($j.status -eq 'succeeded') {
    $out = Join-Path (Get-Location) $j.outputs[0].filename
    Invoke-WebRequest $j.video_url -Headers $headers -OutFile $out -UseBasicParsing
    Write-Host "saved $out" -ForegroundColor Green
} else {
    Write-Host "failed: $($j.error)" -ForegroundColor Red
    exit 1
}
