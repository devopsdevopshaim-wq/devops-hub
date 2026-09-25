# Windows version of download-models.sh: downloads the HunyuanVideo weights ComfyUI needs.
#   powershell -ExecutionPolicy Bypass -File scripts\download-models.ps1          # bf16, ~24GB VRAM
#   powershell -ExecutionPolicy Bypass -File scripts\download-models.ps1 -Fp8     # 12-16GB cards
# Resumable: run it again after a broken download. Set $env:HF_TOKEN if HuggingFace rate-limits you.
param([switch]$Fp8)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

$HF = if ($env:HF_BASE) { $env:HF_BASE } else { 'https://huggingface.co' }
$Repo = "$HF/Comfy-Org/HunyuanVideo_repackaged/resolve/main/split_files"
$M = 'data/models'
# curl.exe ships with Windows 10 1803+ and supports resume; Invoke-WebRequest does not.
$Curl = if (Get-Command curl.exe -ErrorAction SilentlyContinue) { 'curl.exe' } else { 'curl' }

function Fetch([string]$Url, [string]$Dest) {
    New-Item -ItemType Directory -Force -Path (Split-Path $Dest -Parent) | Out-Null
    if ((Test-Path $Dest) -and (Get-Item $Dest).Length -gt 0 -and -not (Test-Path "$Dest.part")) {
        Write-Host "ok    $Dest"; return
    }
    Write-Host "get   $Dest"
    New-Item -ItemType File -Force -Path "$Dest.part" | Out-Null
    $curlArgs = @('-fL', '--retry', '5', '--retry-delay', '5', '-C', '-', '-o', $Dest, $Url)
    if ($env:HF_TOKEN) { $curlArgs = @('-H', "Authorization: Bearer $($env:HF_TOKEN)") + $curlArgs }
    & $Curl @curlArgs
    if ($LASTEXITCODE -ne 0) { throw "download failed ($LASTEXITCODE): $Url - run the script again to resume" }
    Remove-Item "$Dest.part"
}

Fetch "$Repo/text_encoders/clip_l.safetensors" "$M/text_encoders/clip_l.safetensors"
Fetch "$Repo/text_encoders/llava_llama3_fp8_scaled.safetensors" "$M/text_encoders/llava_llama3_fp8_scaled.safetensors"
Fetch "$Repo/vae/hunyuan_video_vae_bf16.safetensors" "$M/vae/hunyuan_video_vae_bf16.safetensors"

if ($Fp8) {
    $Unet = 'hunyuan_video_720_cfgdistill_fp8_e4m3fn.safetensors'
    Fetch "$HF/Kijai/HunyuanVideo_comfy/resolve/main/$Unet" "$M/diffusion_models/$Unet"
} else {
    $Unet = 'hunyuan_video_t2v_720p_bf16.safetensors'
    Fetch "$Repo/diffusion_models/$Unet" "$M/diffusion_models/$Unet"
}

if (Test-Path .env) {
    $text = [IO.File]::ReadAllText((Resolve-Path .env)) -replace '(?m)^HUNYUAN_UNET=.*$', "HUNYUAN_UNET=$Unet"
    [IO.File]::WriteAllText((Join-Path (Get-Location) '.env'), $text, (New-Object Text.UTF8Encoding $false))
    Write-Host "HUNYUAN_UNET=$Unet written to .env"
}
Write-Host 'done.'
