"""Seedance client (ByteDance video model, hosted on BytePlus ModelArk / Volcengine Ark).

Seedance weights are not published, so it cannot run on a local GPU. The gateway still
treats it as a first-class provider: same request shape, same job API, and the finished
video is downloaded into the local output folder (Ark links expire after ~24h).
"""
import asyncio
import os
import time
from typing import Any, Dict, List, Optional

import httpx

from ..config import Settings


class SeedanceError(RuntimeError):
    pass


def ratio_for(width: int, height: int) -> str:
    known = {"16:9": 16 / 9, "9:16": 9 / 16, "1:1": 1.0, "4:3": 4 / 3, "3:4": 3 / 4, "21:9": 21 / 9}
    r = width / height
    return min(known, key=lambda k: abs(known[k] - r))


class SeedanceClient:
    def __init__(self, settings: Settings, http: Optional[httpx.AsyncClient] = None):
        self.s = settings
        self.http = http or httpx.AsyncClient(timeout=60)

    def _headers(self) -> Dict[str, str]:
        return {"Authorization": f"Bearer {self.s.seedance_api_key}", "Content-Type": "application/json"}

    def build_body(
        self,
        prompt: str,
        resolution: str = "720p",
        duration: int = 5,
        ratio: str = "16:9",
        seed: Optional[int] = None,
        image_url: Optional[str] = None,
        model: Optional[str] = None,
        extra: Optional[Dict[str, Any]] = None,
        generate_audio: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """ModelArk create-task body. Seedance 2.x takes resolution/ratio/duration as top-level fields."""
        content: List[Dict[str, Any]] = [{"type": "text", "text": prompt}]
        if image_url:
            content.append({"type": "image_url", "image_url": {"url": image_url}, "role": "first_frame"})
        body: Dict[str, Any] = {
            "model": model or self.s.seedance_model,
            "content": content,
            "resolution": resolution,
            "ratio": ratio,
            "duration": duration,
            "watermark": False,
        }
        if seed is not None:
            body["seed"] = seed
        if generate_audio is not None:
            body["generate_audio"] = generate_audio
        body.update(extra or {})
        return body

    async def submit(self, body: Dict[str, Any]) -> str:
        if not self.s.seedance_enabled:
            raise SeedanceError("SEEDANCE_API_KEY is not set - add it to .env to enable Seedance")
        r = await self.http.post(
            f"{self.s.seedance_base_url}/contents/generations/tasks", json=body, headers=self._headers()
        )
        if r.status_code >= 400:
            raise SeedanceError(f"Seedance API rejected the request ({r.status_code}): {r.text}")
        return r.json()["id"]

    async def wait(self, task_id: str) -> Dict[str, Any]:
        deadline = time.monotonic() + self.s.seedance_timeout_s
        while time.monotonic() < deadline:
            r = await self.http.get(
                f"{self.s.seedance_base_url}/contents/generations/tasks/{task_id}", headers=self._headers()
            )
            if r.status_code >= 400:
                raise SeedanceError(f"Seedance status check failed ({r.status_code}): {r.text}")
            task = r.json()
            status = task.get("status")
            if status == "succeeded":
                return task
            if status in ("failed", "cancelled", "expired"):
                raise SeedanceError(f"Seedance task {status}: {task.get('error')}")
            await asyncio.sleep(max(self.s.poll_interval_s, 5))
        raise SeedanceError(f"timed out after {self.s.seedance_timeout_s}s waiting for Seedance task {task_id}")

    async def run(self, body: Dict[str, Any], dest_dir: str) -> List[str]:
        task_id = await self.submit(body)
        task = await self.wait(task_id)
        url = (task.get("content") or {}).get("video_url")
        if not url:
            raise SeedanceError(f"Seedance task succeeded but returned no video_url: {task}")
        path = os.path.join(dest_dir, f"seedance_{task_id}.mp4")
        async with self.http.stream("GET", url, timeout=300) as r:
            r.raise_for_status()
            with open(path, "wb") as out:
                async for chunk in r.aiter_bytes():
                    out.write(chunk)
        return [path]
