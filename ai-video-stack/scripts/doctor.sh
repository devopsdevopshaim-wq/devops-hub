#!/usr/bin/env bash
# Diagnoses the usual reasons "ComfyUI doesn't work" and checks every hop n8n depends on.
cd "$(dirname "$0")/.."
ok()  { printf '\033[32m[ok]\033[0m   %s\n' "$*"; }
bad() { printf '\033[31m[fail]\033[0m %s\n' "$*"; FAIL=1; }
FAIL=0
[ -f .env ] && set -a && . ./.env && set +a || bad ".env missing - run scripts/setup.sh"
GW=http://127.0.0.1:${GATEWAY_PORT:-8000}
CF=http://127.0.0.1:${COMFYUI_PORT:-8188}

nvidia-smi >/dev/null 2>&1 && ok "host GPU: $(nvidia-smi --query-gpu=name,memory.total,memory.used --format=csv,noheader | head -1)" \
  || bad "nvidia-smi failed on host (driver not installed?)"

for s in comfyui gateway; do
  st=$(docker compose ps --format '{{.State}} {{.Health}}' "$s" 2>/dev/null)
  [[ "$st" == running* ]] && ok "container $s: $st" || { bad "container $s: ${st:-not created}"; docker compose logs --tail 30 "$s" 2>/dev/null; }
done

docker compose exec -T comfyui python -c "import torch,sys; sys.exit(0 if torch.cuda.is_available() else 1)" 2>/dev/null \
  && ok "CUDA visible inside ComfyUI container" \
  || bad "CUDA NOT visible inside ComfyUI container -> install NVIDIA Container Toolkit / enable GPU in Docker Desktop"

curl -sf "$CF/system_stats" >/dev/null && ok "ComfyUI API answers on $CF" || bad "ComfyUI API not answering on $CF (see logs above; first start takes 1-2 min)"
curl -sf "$GW/health" >/dev/null && ok "gateway answers on $GW" || bad "gateway not answering on $GW"

status=$(curl -sf -H "X-API-Key: ${GATEWAY_API_KEY:-}" "$GW/v1/status")
if [ -n "$status" ]; then
  echo "$status" | python3 -c '
import json,sys
s=json.load(sys.stdin); c=s["comfyui"]; m=c.get("missing_hunyuan_models")
print("       comfyui:", "ok" if c["ok"] else c.get("error"), "| devices:", c.get("devices"))
print("       hunyuan models missing:", m or "none" if c["ok"] else "not checked (ComfyUI unreachable)")
print("       seedance configured:", s["seedance"]["configured"], "| model:", s["seedance"]["model"])'
else
  bad "gateway /v1/status failed (wrong GATEWAY_API_KEY?)"
fi

if [ -n "${PUBLIC_BASE_URL:-}" ]; then
  curl -sf "$PUBLIC_BASE_URL/health" >/dev/null && ok "public URL reachable: $PUBLIC_BASE_URL (n8n Cloud can reach you)" \
    || bad "public URL $PUBLIC_BASE_URL not reachable - check the cloudflared container / tunnel hostname"
else
  echo "       PUBLIC_BASE_URL not set - n8n Cloud cannot reach this machine until you set up the tunnel"
fi
exit $FAIL
