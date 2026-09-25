#!/usr/bin/env bash
# Temporary public URL without a Cloudflare account (URL changes every run - fine for testing).
# For a permanent URL use a named tunnel: CLOUDFLARE_TUNNEL_TOKEN in .env + `docker compose --profile tunnel up -d`.
set -euo pipefail
cd "$(dirname "$0")/.."
echo "Starting quick tunnel to the gateway... copy the https://*.trycloudflare.com URL below into n8n (Config node)."
exec docker run --rm --network ai-video-stack_default cloudflare/cloudflared:2026.9.3 \
  tunnel --no-autoupdate --url http://gateway:8000
