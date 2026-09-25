# AI Video Stack: ComfyUI + HunyuanVideo + Seedance, driven by n8n

A local system that runs ComfyUI with HunyuanVideo on your own GPU,
connects Seedance 2.5, and exposes everything through one secure API
that n8n Cloud (or a self-hosted n8n) calls on its own: from a webhook,
on a schedule, or manually.

## Architecture

```text
 n8n Cloud ──HTTPS──► Cloudflare Tunnel ──► gateway :8000 ──┬──► ComfyUI :8188 (GPU) ── HunyuanVideo
 (Webhook/Schedule)       (no open ports)     X-API-Key     │
                                                            └──► BytePlus ModelArk ── Seedance 2.5
```

- **gateway** (`gateway/`): a small FastAPI service. It accepts a job,
  picks a provider, waits for the result, saves the MP4 locally, and
  returns a download link. It is the only thing n8n talks to.
- **comfyui** (`comfyui/`): ComfyUI v0.37.2 plus ComfyUI-Manager, CUDA
  12.8 (RTX 20xx through RTX 50xx). HunyuanVideo uses the native nodes,
  with no custom nodes that can break.
- **cloudflared**: a tunnel from your machine to the internet, so
  n8n Cloud can reach you without opening a port on the router.

## Important: Seedance does not run locally

Seedance 2.5 is a closed ByteDance model. **Its weights were never
published**, so no one can run it on a local GPU. The only way to use
it is through ByteDance's API (BytePlus ModelArk).

What this system does: Seedance goes through **the same gateway**, with
the same request shape and the same job API, and the finished video is
downloaded and **stored locally** next to the HunyuanVideo videos. For
n8n it looks exactly like another local provider. With `provider: auto`,
the gateway tries HunyuanVideo locally first, and if that fails (out of
GPU memory, ComfyUI down) it falls back to Seedance automatically.

If you want a model that is fully local, free, and close to Seedance in
quality, HunyuanVideo is already here. Wan 2.x can be added the same
way through `provider: comfyui` (see below).

## Requirements

| Item | Minimum |
| --- | --- |
| GPU | NVIDIA, 12GB+ VRAM (`--fp8`); 24GB+ for bf16 |
| Driver | Recent NVIDIA driver (CUDA 12.8 support) |
| Docker | Docker Engine + Compose v2 + NVIDIA Container Toolkit |
| Windows | Docker Desktop with the WSL2 backend; run the scripts from WSL |
| Disk | ~50GB free for models |

## Installation (one time)

```bash
cd ai-video-stack
scripts/setup.sh          # 24GB+ card
# or
scripts/setup.sh --fp8    # 12-16GB card (also add COMFYUI_ARGS=--lowvram to .env on 12GB)
scripts/doctor.sh         # checks every link in the chain and shows what is broken
```

`setup.sh` checks that Docker can see the GPU, creates `.env` with a
random API key, downloads the HunyuanVideo weights (resumable), and
starts everything. The ComfyUI UI is at `http://127.0.0.1:8188`.

## Why ComfyUI and HunyuanVideo were not working

`scripts/doctor.sh` checks the common failures in order and prints
exactly which one it is:

1. **Docker cannot see the GPU**: NVIDIA Container Toolkit is missing,
   or GPU support is off in Docker Desktop. ComfyUI then crashes or
   runs on CPU.
2. **Wrong model files or wrong folder**: HunyuanVideo needs four files
   in `diffusion_models`, `text_encoders` and `vae`. The gateway checks
   this before every job and returns an error naming the missing file.
3. **Old ComfyUI**: the Hunyuan/video nodes are missing. The image is
   pinned to a version that was tested against this workflow.
4. **Out of memory (OOM)**: use `--fp8`, `COMFYUI_ARGS=--lowvram`, or
   lower `frames`, `width` and `height`.

ComfyUI errors (for example `node_errors` or an execution error) are
passed through as-is in the job's `error` field, so they also show up
in n8n.

## Connecting n8n Cloud

1. **Public URL for the gateway.** Pick one:
   - Permanent (recommended): in Cloudflare Zero Trust → Networks →
     Tunnels, create a tunnel, add a Public Hostname (for example
     `video.your-domain.com`) pointing to `http://gateway:8000`, and put
     the token in `.env` as `CLOUDFLARE_TUNNEL_TOKEN`. Then run
     `docker compose --profile tunnel up -d`.
   - Quick test with no account: `scripts/quick-tunnel.sh` prints a
     temporary `https://….trycloudflare.com` address.

   Put the address in `.env` as `PUBLIC_BASE_URL` and run
   `docker compose up -d gateway`.
2. **In n8n**: Workflows → Import from File →
   `n8n/workflows/ai-video-generate.json`.
3. **Credential**: create a *Header Auth* credential named
   `AI Video Gateway` with Name `X-API-Key` and Value set to
   `GATEWAY_API_KEY` from `.env`. Select it in the three HTTP nodes.
4. **Config node**: set `gateway_url` to your tunnel address.
5. Activate the workflow. It now runs by itself:
   - **Webhook** `POST /webhook/ai-video` with a body like
     `{"prompt": "...", "provider": "auto|hunyuan|seedance"}`
   - **Schedule**: every day at 09:00 (change it or turn it off as you like)
   - **Manual**: the "Execute workflow" button

   The flow: submit job → wait 20 seconds → check status → loop until
   done → download the MP4 as a binary file (ready to send on to Drive,
   Telegram, YouTube, and so on). A failure stops the run with the
   exact reason.

Using self-hosted n8n instead of Cloud? Run
`docker compose --profile n8n up -d` (`http://127.0.0.1:5678`) and set
`gateway_url` to `http://gateway:8000`. No tunnel is needed.

## Gateway API

Every request needs the `X-API-Key` header.

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/v1/generate` | Create a job. Returns `job_id` |
| `GET` | `/v1/jobs/{id}` | Status (`queued`/`running`/`succeeded`/`failed`), `video_url`, `error`, `attempts` |
| `GET` | `/v1/jobs` | Recent jobs |
| `GET` | `/v1/files/{id}/{name}` | Download the video |
| `GET` | `/v1/status` | ComfyUI/GPU state, missing models, Seedance configuration |
| `GET` | `/health` | Liveness, no authentication |

`POST /v1/generate` fields:

| Field | Default | Notes |
| --- | --- | --- |
| `provider` | `auto` | `auto`, `hunyuan`, `seedance`, `comfyui` |
| `prompt` | (required) | Not required for `comfyui` |
| `width`, `height` | 848, 480 | Rounded down to a multiple of 16 |
| `frames`, `steps`, `fps`, `guidance`, `seed` | 73, 30, 24, 6.0, random | HunyuanVideo |
| `duration`, `resolution`, `image_url`, `generate_audio` | 5, `720p`, none, none | Seedance (`image_url` = image-to-video) |
| `workflow` | none | `provider=comfyui`: any workflow exported from ComfyUI via *Export (API)* |
| `callback_url` | none | The gateway POSTs the result here when the job finishes (for example an n8n webhook) |
| `wait` | `false` | `true` waits up to `wait_timeout_s` (default 90) and returns the result directly |

Example:

```bash
curl -H "X-API-Key: $GATEWAY_API_KEY" -H 'Content-Type: application/json' \
  http://127.0.0.1:8000/v1/generate \
  -d '{"provider":"hunyuan","prompt":"a red fox running through snow, cinematic","frames":49}'
```

`provider: comfyui` lets n8n run **any** ComfyUI workflow (Wan, LTX,
upscaling, and so on): build it in the ComfyUI UI, choose Export (API),
and send the JSON in the `workflow` field.

## Development

```bash
cd gateway
pip install -r requirements-dev.txt
python -m pytest -q
python ../n8n/build_workflow.py   # regenerates the n8n workflow JSON
```
