"""ComfyUI client + the HunyuanVideo text-to-video workflow (native ComfyUI nodes, no custom nodes)."""
import asyncio
import os
import time
import uuid
from typing import Any, Dict, List, Optional

import httpx

from ..config import Settings


class ComfyUIError(RuntimeError):
    pass


def hunyuan_t2v_workflow(
    s: Settings,
    prompt: str,
    width: int = 848,
    height: int = 480,
    frames: int = 73,
    steps: int = 30,
    guidance: float = 6.0,
    shift: float = 7.0,
    fps: int = 24,
    seed: Optional[int] = None,
    filename_prefix: str = "hunyuan",
) -> Dict[str, Any]:
    """API-format graph equivalent to the official ComfyUI HunyuanVideo example."""
    if seed is None:
        seed = int.from_bytes(os.urandom(6), "big")
    # HunyuanVideo needs frames = 4k+1 and dimensions divisible by 16.
    frames = max(1, ((frames - 1) // 4) * 4 + 1)
    width, height = (width // 16) * 16, (height // 16) * 16
    return {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": s.hunyuan_unet, "weight_dtype": "default"}},
        "2": {
            "class_type": "DualCLIPLoader",
            "inputs": {"clip_name1": s.hunyuan_clip_l, "clip_name2": s.hunyuan_llm, "type": "hunyuan_video"},
        },
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": s.hunyuan_vae}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["2", 0]}},
        "5": {"class_type": "FluxGuidance", "inputs": {"conditioning": ["4", 0], "guidance": guidance}},
        "6": {"class_type": "ModelSamplingSD3", "inputs": {"model": ["1", 0], "shift": shift}},
        "7": {
            "class_type": "EmptyHunyuanLatentVideo",
            "inputs": {"width": width, "height": height, "length": frames, "batch_size": 1},
        },
        "8": {"class_type": "RandomNoise", "inputs": {"noise_seed": seed}},
        "9": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "euler"}},
        "10": {
            "class_type": "BasicScheduler",
            "inputs": {"model": ["6", 0], "scheduler": "simple", "steps": steps, "denoise": 1.0},
        },
        "11": {"class_type": "BasicGuider", "inputs": {"model": ["6", 0], "conditioning": ["5", 0]}},
        "12": {
            "class_type": "SamplerCustomAdvanced",
            "inputs": {
                "noise": ["8", 0],
                "guider": ["11", 0],
                "sampler": ["9", 0],
                "sigmas": ["10", 0],
                "latent_image": ["7", 0],
            },
        },
        "13": {
            "class_type": "VAEDecodeTiled",
            "inputs": {
                "samples": ["12", 0],
                "vae": ["3", 0],
                "tile_size": 256,
                "overlap": 64,
                "temporal_size": 64,
                "temporal_overlap": 8,
            },
        },
        "14": {"class_type": "CreateVideo", "inputs": {"images": ["13", 0], "fps": fps}},
        "15": {
            "class_type": "SaveVideo",
            "inputs": {"video": ["14", 0], "filename_prefix": filename_prefix, "format": "mp4", "codec": "h264"},
        },
    }


class ComfyUIClient:
    def __init__(self, settings: Settings, http: Optional[httpx.AsyncClient] = None):
        self.s = settings
        self.base = settings.comfyui_url
        self.http = http or httpx.AsyncClient(timeout=60)
        self.client_id = uuid.uuid4().hex

    async def health(self) -> Dict[str, Any]:
        try:
            r = await self.http.get(f"{self.base}/system_stats", timeout=5)
            r.raise_for_status()
            stats = r.json()
            devices = [d.get("name") for d in stats.get("devices", [])]
            return {"ok": True, "devices": devices}
        except Exception as e:  # noqa: BLE001 - health must never raise
            return {"ok": False, "error": f"{type(e).__name__}: {e}"}

    async def missing_hunyuan_models(self) -> List[str]:
        """Ask ComfyUI which model files it can see and report the HunyuanVideo ones that are absent."""
        wanted = {
            "diffusion_models": [self.s.hunyuan_unet],
            "text_encoders": [self.s.hunyuan_clip_l, self.s.hunyuan_llm],
            "vae": [self.s.hunyuan_vae],
        }
        missing = []
        for folder, names in wanted.items():
            r = await self.http.get(f"{self.base}/models/{folder}", timeout=10)
            available = set(r.json()) if r.status_code == 200 else set()
            if folder == "text_encoders" and r.status_code != 200:
                # Older ComfyUI builds only know the legacy "clip" folder name.
                r = await self.http.get(f"{self.base}/models/clip", timeout=10)
                available = set(r.json()) if r.status_code == 200 else set()
            missing += [f"{folder}/{n}" for n in names if n not in available]
        return missing

    async def submit(self, workflow: Dict[str, Any]) -> str:
        r = await self.http.post(f"{self.base}/prompt", json={"prompt": workflow, "client_id": self.client_id})
        if r.status_code != 200:
            try:
                detail = r.json()
            except ValueError:
                detail = r.text
            raise ComfyUIError(f"ComfyUI rejected the workflow ({r.status_code}): {detail}")
        return r.json()["prompt_id"]

    async def wait(self, prompt_id: str) -> Dict[str, Any]:
        deadline = time.monotonic() + self.s.comfyui_timeout_s
        while time.monotonic() < deadline:
            r = await self.http.get(f"{self.base}/history/{prompt_id}")
            if r.status_code == 200:
                entry = r.json().get(prompt_id)
                if entry:
                    status = entry.get("status", {})
                    if status.get("status_str") == "error":
                        msgs = [m for m in status.get("messages", []) if m and m[0] == "execution_error"]
                        detail = msgs[-1][1] if msgs else status
                        raise ComfyUIError(f"ComfyUI execution failed: {detail}")
                    if status.get("completed") or entry.get("outputs"):
                        return entry
            await asyncio.sleep(self.s.poll_interval_s)
        raise ComfyUIError(f"timed out after {self.s.comfyui_timeout_s}s waiting for ComfyUI prompt {prompt_id}")

    @staticmethod
    def output_files(entry: Dict[str, Any]) -> List[Dict[str, str]]:
        """Collect every saved file regardless of which output key a node uses (images/gifs/videos...)."""
        files = []
        for node_out in entry.get("outputs", {}).values():
            for items in node_out.values():
                if not isinstance(items, list):
                    continue
                for it in items:
                    if isinstance(it, dict) and "filename" in it and it.get("type", "output") == "output":
                        files.append(
                            {"filename": it["filename"], "subfolder": it.get("subfolder", ""), "type": "output"}
                        )
        return files

    async def download(self, f: Dict[str, str], dest_dir: str) -> str:
        path = os.path.join(dest_dir, os.path.basename(f["filename"]))
        async with self.http.stream("GET", f"{self.base}/view", params=f, timeout=300) as r:
            r.raise_for_status()
            with open(path, "wb") as out:
                async for chunk in r.aiter_bytes():
                    out.write(chunk)
        return path

    async def run(self, workflow: Dict[str, Any], dest_dir: str) -> List[str]:
        prompt_id = await self.submit(workflow)
        entry = await self.wait(prompt_id)
        files = self.output_files(entry)
        if not files:
            raise ComfyUIError("workflow finished but produced no output files (does it have a Save node?)")
        return [await self.download(f, dest_dir) for f in files]
