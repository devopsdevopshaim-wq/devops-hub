"""Tiny persistent job store (JSON file) - enough for a single-node local stack."""
import json
import os
import threading
import time
import uuid
from typing import Any, Dict, List, Optional


class JobStore:
    def __init__(self, data_dir: str):
        self.dir = os.path.join(data_dir, "jobs")
        os.makedirs(self.dir, exist_ok=True)
        self.index_path = os.path.join(data_dir, "jobs.json")
        self._lock = threading.Lock()
        self._jobs: Dict[str, Dict[str, Any]] = {}
        if os.path.exists(self.index_path):
            try:
                with open(self.index_path, encoding="utf-8") as f:
                    self._jobs = json.load(f)
            except (OSError, ValueError):
                self._jobs = {}
        # Anything that was running when the process died will never finish.
        for job in self._jobs.values():
            if job["status"] in ("queued", "running"):
                job["status"] = "failed"
                job["error"] = "gateway restarted while the job was running"

    def _flush(self) -> None:
        tmp = self.index_path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(self._jobs, f, indent=1)
        os.replace(tmp, self.index_path)

    def create(self, provider: str, request: Dict[str, Any]) -> Dict[str, Any]:
        job_id = uuid.uuid4().hex[:16]
        now = time.time()
        job = {
            "id": job_id,
            "provider": provider,
            "status": "queued",
            "request": request,
            "outputs": [],
            "error": None,
            "created_at": now,
            "updated_at": now,
        }
        with self._lock:
            self._jobs[job_id] = job
            self._flush()
        os.makedirs(self.job_dir(job_id), exist_ok=True)
        return dict(job)

    def update(self, job_id: str, **fields: Any) -> Dict[str, Any]:
        with self._lock:
            job = self._jobs[job_id]
            job.update(fields)
            job["updated_at"] = time.time()
            self._flush()
            return dict(job)

    def get(self, job_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            job = self._jobs.get(job_id)
            return dict(job) if job else None

    def list(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._lock:
            jobs = sorted(self._jobs.values(), key=lambda j: j["created_at"], reverse=True)
            return [dict(j) for j in jobs[:limit]]

    def job_dir(self, job_id: str) -> str:
        return os.path.join(self.dir, job_id)
