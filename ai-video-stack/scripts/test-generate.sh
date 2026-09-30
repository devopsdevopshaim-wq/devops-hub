#!/usr/bin/env bash
# Smoke test from the command line: scripts/test-generate.sh [provider] "prompt"
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
GW=${GW:-http://127.0.0.1:${GATEWAY_PORT:-8000}}
P=${1:-auto}; PROMPT=${2:-"a red fox running through snow, cinematic, golden hour"}
job=$(curl -sf -H "X-API-Key: $GATEWAY_API_KEY" -H 'Content-Type: application/json' "$GW/v1/generate" \
  -d "$(python3 -c 'import json,sys; print(json.dumps({"provider":sys.argv[1],"prompt":sys.argv[2],"frames":33,"steps":20}))' "$P" "$PROMPT")" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["job_id"])')
echo "job $job"
while :; do
  j=$(curl -sf -H "X-API-Key: $GATEWAY_API_KEY" "$GW/v1/jobs/$job")
  st=$(echo "$j" | python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])')
  echo "  $st"; [[ $st == succeeded || $st == failed ]] && break; sleep 10
done
echo "$j" | python3 -m json.tool
