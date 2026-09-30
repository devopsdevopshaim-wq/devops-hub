# Temporary public URL for the gateway without a Cloudflare account (changes on every run).
#   powershell -ExecutionPolicy Bypass -File scripts\quick-tunnel.ps1
# Copy the https://....trycloudflare.com address it prints into the n8n Config node. Keep this window open.
Write-Host 'Starting quick tunnel... look for the https://*.trycloudflare.com line below.'
docker run --rm --network ai-video-stack_default cloudflare/cloudflared:2026.9.3 tunnel --no-autoupdate --url http://gateway:8000
