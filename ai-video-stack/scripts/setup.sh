#!/usr/bin/env bash
# One-shot setup: checks the machine, creates .env, downloads models, builds and starts the stack.
#   scripts/setup.sh            # bf16 HunyuanVideo (24GB+ VRAM)
#   scripts/setup.sh --fp8      # smaller HunyuanVideo for 12-16GB cards
#   scripts/setup.sh --no-models
set -euo pipefail
cd "$(dirname "$0")/.."

red() { printf '\033[31m%s\033[0m\n' "$*"; }
grn() { printf '\033[32m%s\033[0m\n' "$*"; }

command -v docker >/dev/null || { red "Docker is not installed: https://docs.docker.com/get-docker/"; exit 1; }
docker compose version >/dev/null || { red "Docker Compose v2 is missing (docker compose ...)"; exit 1; }

if command -v nvidia-smi >/dev/null && nvidia-smi >/dev/null 2>&1; then
  grn "GPU: $(nvidia-smi --query-gpu=name,memory.total --format=csv,noheader | head -1)"
  VRAM=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -1 | tr -dc 0-9)
else
  red "nvidia-smi failed - no NVIDIA GPU/driver found. HunyuanVideo needs an NVIDIA GPU; only Seedance (API) will work."
fi
if ! docker run --rm --gpus all pytorch/pytorch:2.8.0-cuda12.8-cudnn9-runtime nvidia-smi -L >/dev/null 2>&1; then
  red "Docker cannot see the GPU. Install NVIDIA Container Toolkit:"
  red "  https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html"
  red "  (Windows: Docker Desktop + WSL2 backend + a recent NVIDIA driver is enough)"
fi

if [ ! -f .env ]; then
  cp .env.example .env
  key=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
  sed -i.bak "s#^GATEWAY_API_KEY=.*#GATEWAY_API_KEY=$key#" .env && rm -f .env.bak
  grn "Created .env with a random GATEWAY_API_KEY"
fi
MODE=${1:-}
if [ -n "${VRAM:-}" ] && [ "$VRAM" -lt 20000 ] && [ -z "$MODE" ]; then
  red "Only ${VRAM} MiB of VRAM - switching to the fp8 HunyuanVideo model (bf16 needs 24GB)."
  MODE=--fp8
fi
if [ -n "${VRAM:-}" ] && [ "$VRAM" -le 12288 ] && grep -q '^COMFYUI_ARGS=\s*$' .env; then
  sed -i.bak 's#^COMFYUI_ARGS=.*#COMFYUI_ARGS=--lowvram#' .env && rm -f .env.bak
  red "Low-VRAM card: set COMFYUI_ARGS=--lowvram in .env"
fi
mkdir -p data/{models,output,input,custom_nodes,user,gateway,n8n}

case "$MODE" in
  --no-models) ;;
  --fp8) scripts/download-models.sh --fp8 ;;
  *) scripts/download-models.sh ;;
esac

profiles=()
grep -q '^CLOUDFLARE_TUNNEL_TOKEN=.\+' .env && profiles+=(--profile tunnel)
docker compose "${profiles[@]}" up -d --build
grn "Started. ComfyUI UI: http://127.0.0.1:8188   Gateway: http://127.0.0.1:8000"
echo "Next: scripts/doctor.sh   then import n8n/workflows/*.json into n8n."
