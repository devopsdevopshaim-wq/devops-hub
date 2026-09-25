#!/usr/bin/env bash
# Downloads the HunyuanVideo weights ComfyUI needs (~40GB for bf16, ~25GB for --fp8).
#   scripts/download-models.sh          # bf16, best quality, ~24GB VRAM
#   scripts/download-models.sh --fp8    # fp8 transformer for 12-16GB cards (also updates .env)
# Resumable: re-run it after a broken download. Set HF_TOKEN if HuggingFace rate-limits you.
set -euo pipefail
cd "$(dirname "$0")/.."
M=data/models
HF=https://huggingface.co
REPO=$HF/Comfy-Org/HunyuanVideo_repackaged/resolve/main/split_files

fetch() {  # url dest
  local url=$1 dest=$2
  mkdir -p "$(dirname "$dest")"
  if [ -s "$dest" ] && [ ! -f "$dest.part" ]; then echo "ok    $dest"; return; fi
  echo "get   $dest"
  touch "$dest.part"
  curl -fL --retry 5 --retry-delay 5 -C - ${HF_TOKEN:+-H "Authorization: Bearer $HF_TOKEN"} -o "$dest" "$url"
  rm -f "$dest.part"
}

fetch "$REPO/text_encoders/clip_l.safetensors"               "$M/text_encoders/clip_l.safetensors"
fetch "$REPO/text_encoders/llava_llama3_fp8_scaled.safetensors" "$M/text_encoders/llava_llama3_fp8_scaled.safetensors"
fetch "$REPO/vae/hunyuan_video_vae_bf16.safetensors"          "$M/vae/hunyuan_video_vae_bf16.safetensors"

if [ "${1:-}" = "--fp8" ]; then
  UNET=hunyuan_video_720_cfgdistill_fp8_e4m3fn.safetensors
  fetch "$HF/Kijai/HunyuanVideo_comfy/resolve/main/$UNET" "$M/diffusion_models/$UNET"
else
  UNET=hunyuan_video_t2v_720p_bf16.safetensors
  fetch "$REPO/diffusion_models/$UNET" "$M/diffusion_models/$UNET"
fi

if [ -f .env ]; then
  sed -i.bak "s#^HUNYUAN_UNET=.*#HUNYUAN_UNET=$UNET#" .env && rm -f .env.bak
  echo "HUNYUAN_UNET=$UNET written to .env - run: docker compose up -d gateway"
fi
echo "done."
