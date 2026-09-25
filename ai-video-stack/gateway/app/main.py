"""Video gateway: one authenticated HTTP API in front of ComfyUI/HunyuanVideo (local GPU) and Seedance (API).

n8n (Cloud or self-hosted) only ever talks to this service:
    POST /v1/generate      -> {"job_id": ...}      (or the finished job when wait=true)
    GET  /v1/jobs/{id}     -> status + output URLs
    GET  /v1/files/{id}/{name}
"""
import asyncio
import hmac
import logging
import os
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Literal, Optional

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from .config import Settings, settings as default_settings
from .jobs import JobStore
from .providers.comfyui import ComfyUIClient, hunyuan_t2v_workflow
from .providers.seedance import SeedanceClient, ratio_for

log = logging.getLogger("gateway")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

Provider = Literal["auto", "hunyuan", "seedance", "comfyui"]


class GenerateRequest(BaseModel):
    provider: Provider = "auto"
    prompt: Optional[str] = None
    # HunyuanVideo (local) parameters
    width: int = Field(848, ge=256, le=1920)
    height: int = Field(480, ge=256, le=1920)
    frames: int = Field(73, ge=1, le=257)
    steps: int = Field(30, ge=1, le=100)
    fps: int = Field(24, ge=1, le=60)
    guidance: float = 6.0
    seed: Optional[int] = None
    # Seedance (API) parameters
    duration: int = Field(5, ge=2, le=30)
    generate_audio: Optional[bool] = None
    resolution: str = "720p"
    image_url: Optional[str] = None
    seedance_model: Optional[str] = None
    extra: Dict[str, Any] = Field(default_factory=dict)
    # provider=comfyui: any API-format workflow exported from ComfyUI ("Export (API)")
    workflow: Optional[Dict[str, Any]] = None
    # Delivery
    callback_url: Optional[str] = None
    wait: bool = False
    wait_timeout_s: int = Field(90, ge=1, le=3600)


def create_app(s: Settings = default_settings) -> FastAPI:
    store = JobStore(s.data_dir)
    http = httpx.AsyncClient(timeout=60, follow_redirects=True)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        yield
        await http.aclose()

    app = FastAPI(title="Local AI Video Gateway", version="1.0.0", lifespan=lifespan)
    comfy = ComfyUIClient(s, http)
    seedance = SeedanceClient(s, http)
    tasks: Dict[str, asyncio.Task] = {}
    gpu_lock = asyncio.Lock()  # one local GPU job at a time; ComfyUI queues anyway, this keeps timeouts honest

    if not s.api_key:
        raise RuntimeError("GATEWAY_API_KEY must be set - the gateway is reachable from the internet via the tunnel")

    def auth(x_api_key: Optional[str] = Header(None), key: Optional[str] = Query(None)) -> None:
        supplied = x_api_key or key or ""
        if not hmac.compare_digest(supplied.encode(), s.api_key.encode()):
            raise HTTPException(401, "missing or wrong X-API-Key")

    def public(job: Dict[str, Any], request: Optional[Request] = None) -> Dict[str, Any]:
        base = s.public_base_url or (str(request.base_url).rstrip("/") if request else "")
        out = {k: job[k] for k in ("id", "provider", "status", "error", "created_at", "updated_at")}
        out["attempts"] = job.get("attempts", [])
        out["outputs"] = [
            {"filename": name, "url": f"{base}/v1/files/{job['id']}/{name}"} for name in job.get("outputs", [])
        ]
        out["video_url"] = out["outputs"][0]["url"] if out["outputs"] else None
        return out

    async def run_provider(provider: str, req: GenerateRequest, dest: str) -> List[str]:
        if provider == "hunyuan":
            missing = await comfy.missing_hunyuan_models()
            if missing:
                raise RuntimeError(
                    "HunyuanVideo model files missing in ComfyUI: " + ", ".join(missing)
                    + " - run scripts/download-models.sh"
                )
            wf = hunyuan_t2v_workflow(
                s, req.prompt or "", req.width, req.height, req.frames, req.steps, req.guidance,
                fps=req.fps, seed=req.seed,
            )
            async with gpu_lock:
                return await comfy.run(wf, dest)
        if provider == "comfyui":
            async with gpu_lock:
                return await comfy.run(req.workflow or {}, dest)
        if provider == "seedance":
            body = seedance.build_body(
                req.prompt or "", req.resolution, req.duration, ratio_for(req.width, req.height),
                req.seed, req.image_url, req.seedance_model, req.extra, req.generate_audio,
            )
            return await seedance.run(body, dest)
        raise ValueError(f"unknown provider {provider}")

    async def plan(req: GenerateRequest) -> List[str]:
        if req.provider != "auto":
            return [req.provider]
        order = []
        if (await comfy.health())["ok"] and not req.image_url:
            order.append("hunyuan")
        if s.seedance_enabled:
            order.append("seedance")
        return order

    async def execute(job_id: str, req: GenerateRequest) -> None:
        dest = store.job_dir(job_id)
        attempts: List[Dict[str, str]] = []
        try:
            order = await plan(req)
            if not order:
                raise RuntimeError(
                    "no provider available: ComfyUI is unreachable and SEEDANCE_API_KEY is not set"
                )
            for provider in order:
                store.update(job_id, status="running", provider=provider, attempts=attempts)
                try:
                    paths = await run_provider(provider, req, dest)
                    store.update(
                        job_id, status="succeeded", provider=provider, error=None, attempts=attempts,
                        outputs=[os.path.basename(p) for p in paths],
                    )
                    break
                except Exception as e:  # noqa: BLE001 - recorded, then fall through to next provider
                    log.exception("job %s: provider %s failed", job_id, provider)
                    attempts.append({"provider": provider, "error": str(e)})
            else:
                store.update(job_id, status="failed", attempts=attempts, error=attempts[-1]["error"])
        except Exception as e:  # noqa: BLE001
            log.exception("job %s failed", job_id)
            store.update(job_id, status="failed", attempts=attempts, error=str(e))
        finally:
            tasks.pop(job_id, None)

        if req.callback_url:
            try:
                await http.post(req.callback_url, json=public(store.get(job_id)), timeout=30)
            except Exception:  # noqa: BLE001
                log.exception("job %s: callback to %s failed", job_id, req.callback_url)

    @app.get("/health")
    async def health() -> Dict[str, Any]:
        return {"ok": True}

    @app.get("/v1/status", dependencies=[Depends(auth)])
    async def status() -> Dict[str, Any]:
        c = await comfy.health()
        if c["ok"]:
            try:
                c["missing_hunyuan_models"] = await comfy.missing_hunyuan_models()
            except Exception as e:  # noqa: BLE001
                c["missing_hunyuan_models"] = f"could not check: {e}"
        return {
            "comfyui": c,
            "seedance": {"configured": s.seedance_enabled, "model": s.seedance_model, "base_url": s.seedance_base_url},
            "running_jobs": len(tasks),
        }

    @app.post("/v1/generate", dependencies=[Depends(auth)])
    async def generate(req: GenerateRequest, request: Request) -> Dict[str, Any]:
        if req.provider == "comfyui" and not req.workflow:
            raise HTTPException(422, "provider=comfyui needs a 'workflow' (API format JSON)")
        if req.provider != "comfyui" and not (req.prompt or "").strip():
            raise HTTPException(422, "'prompt' is required")
        if req.provider == "seedance" and not s.seedance_enabled:
            raise HTTPException(503, "Seedance is not configured - set SEEDANCE_API_KEY in .env")
        if req.provider == "hunyuan" and req.image_url:
            raise HTTPException(422, "image_url (image-to-video) is only supported by provider=seedance")

        job = store.create(req.provider, req.model_dump(exclude={"workflow"}))
        tasks[job["id"]] = asyncio.create_task(execute(job["id"], req))
        if req.wait:
            try:
                await asyncio.wait_for(asyncio.shield(tasks[job["id"]]), timeout=req.wait_timeout_s)
            except (asyncio.TimeoutError, KeyError):
                pass
        result = public(store.get(job["id"]), request)
        result["job_id"] = job["id"]
        return result

    @app.get("/v1/jobs", dependencies=[Depends(auth)])
    async def list_jobs(request: Request, limit: int = 20) -> List[Dict[str, Any]]:
        return [public(j, request) for j in store.list(limit)]

    @app.get("/v1/jobs/{job_id}", dependencies=[Depends(auth)])
    async def get_job(job_id: str, request: Request) -> Dict[str, Any]:
        job = store.get(job_id)
        if not job:
            raise HTTPException(404, "job not found")
        return public(job, request)

    @app.get("/v1/files/{job_id}/{name}", dependencies=[Depends(auth)])
    async def get_file(job_id: str, name: str) -> FileResponse:
        job = store.get(job_id)
        if not job or name not in job.get("outputs", []):
            raise HTTPException(404, "file not found")
        return FileResponse(os.path.join(store.job_dir(job_id), name), filename=name)

    return app

