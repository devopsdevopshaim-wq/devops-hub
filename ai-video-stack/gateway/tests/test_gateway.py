import dataclasses
import json
import time

import httpx
import pytest
import respx
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.providers.comfyui import ComfyUIClient, hunyuan_t2v_workflow

COMFY = "http://comfy.test"
ARK = "http://ark.test/api/v3"
KEY = {"X-API-Key": "secret"}


def make_settings(tmp_path, **kw):
    base = Settings()
    return dataclasses.replace(
        base, api_key="secret", data_dir=str(tmp_path), comfyui_url=COMFY, seedance_base_url=ARK,
        seedance_api_key="", poll_interval_s=0.01, **kw,
    )


def mock_comfy(router, models_ok=True, fail=False):
    router.get(f"{COMFY}/system_stats").respond(json={"devices": [{"name": "cuda:0 RTX"}]})
    s = Settings()
    router.get(f"{COMFY}/models/diffusion_models").respond(json=[s.hunyuan_unet] if models_ok else [])
    router.get(f"{COMFY}/models/text_encoders").respond(json=[s.hunyuan_clip_l, s.hunyuan_llm])
    router.get(f"{COMFY}/models/vae").respond(json=[s.hunyuan_vae])
    router.post(f"{COMFY}/prompt").respond(json={"prompt_id": "p1"})
    status = (
        {"status_str": "error", "completed": False, "messages": [["execution_error", {"exception_message": "OOM"}]]}
        if fail else {"status_str": "success", "completed": True}
    )
    router.get(f"{COMFY}/history/p1").respond(
        json={"p1": {"status": status, "outputs": {} if fail else {
            "15": {"images": [{"filename": "hunyuan_00001_.mp4", "subfolder": "video", "type": "output"}]}
        }}}
    )
    router.get(f"{COMFY}/view").respond(content=b"MP4DATA")


def wait_done(client, job_id):
    for _ in range(200):
        j = client.get(f"/v1/jobs/{job_id}", headers=KEY).json()
        if j["status"] in ("succeeded", "failed"):
            return j
        time.sleep(0.02)
    raise AssertionError("job never finished")


def test_workflow_normalises_frames_and_size():
    wf = hunyuan_t2v_workflow(Settings(), "a cat", width=850, height=481, frames=75, seed=1)
    assert wf["7"]["inputs"] == {"width": 848, "height": 480, "length": 73, "batch_size": 1}
    assert wf["4"]["inputs"]["text"] == "a cat"
    assert wf["2"]["inputs"]["type"] == "hunyuan_video"


def test_output_files_collects_all_keys():
    entry = {"outputs": {"1": {"images": [{"filename": "a.png", "type": "temp"}]},
                         "2": {"gifs": [{"filename": "b.mp4", "subfolder": "", "type": "output"}]},
                         "3": {"animated": [True]}}}
    assert ComfyUIClient.output_files(entry) == [{"filename": "b.mp4", "subfolder": "", "type": "output"}]


def test_requires_api_key(tmp_path):
    with respx.mock(assert_all_called=False):
        client = TestClient(create_app(make_settings(tmp_path)))
        assert client.get("/health").status_code == 200
        assert client.post("/v1/generate", json={"prompt": "x"}).status_code == 401
        assert client.get("/v1/jobs", headers={"X-API-Key": "wrong"}).status_code == 401


def test_hunyuan_job_end_to_end(tmp_path):
    with respx.mock(assert_all_called=False) as router:
        mock_comfy(router)
        client = TestClient(create_app(make_settings(tmp_path)))
        r = client.post("/v1/generate", json={"provider": "hunyuan", "prompt": "a cat surfing"}, headers=KEY)
        assert r.status_code == 200
        job = wait_done(client, r.json()["job_id"])
        assert job["status"] == "succeeded", job
        assert job["outputs"][0]["filename"] == "hunyuan_00001_.mp4"
        f = client.get(f"/v1/files/{job['id']}/hunyuan_00001_.mp4", headers=KEY)
        assert f.content == b"MP4DATA"
        sent = [c.request for c in router.calls if c.request.url.path == "/prompt"][0]
        assert b"a cat surfing" in sent.content


def test_missing_models_reported(tmp_path):
    with respx.mock(assert_all_called=False) as router:
        mock_comfy(router, models_ok=False)
        client = TestClient(create_app(make_settings(tmp_path)))
        r = client.post("/v1/generate", json={"provider": "hunyuan", "prompt": "x"}, headers=KEY)
        job = wait_done(client, r.json()["job_id"])
        assert job["status"] == "failed"
        assert "download-models.sh" in job["error"]


def test_auto_falls_back_to_seedance(tmp_path):
    with respx.mock(assert_all_called=False) as router:
        mock_comfy(router, fail=True)
        router.post(f"{ARK}/contents/generations/tasks").respond(json={"id": "cgt-1"})
        router.get(f"{ARK}/contents/generations/tasks/cgt-1").respond(
            json={"status": "succeeded", "content": {"video_url": "http://cdn.test/v.mp4"}}
        )
        router.get("http://cdn.test/v.mp4").respond(content=b"SEEDANCE")
        s = make_settings(tmp_path)
        s = dataclasses.replace(s, seedance_api_key="ark-key")
        client = TestClient(create_app(s))
        r = client.post("/v1/generate", json={"prompt": "a dog", "width": 1280, "height": 720}, headers=KEY)
        job = wait_done(client, r.json()["job_id"])
        assert job["status"] == "succeeded", job
        assert job["provider"] == "seedance"
        assert job["attempts"][0]["provider"] == "hunyuan" and "OOM" in job["attempts"][0]["error"]
        body = [c.request for c in router.calls if c.request.url.path.endswith("/tasks")][0].content
        sent = json.loads(body)
        assert sent["ratio"] == "16:9" and sent["model"] == "dreamina-seedance-2-5-260628"
        assert sent["content"] == [{"type": "text", "text": "a dog"}]


def test_seedance_not_configured(tmp_path):
    with respx.mock(assert_all_called=False):
        client = TestClient(create_app(make_settings(tmp_path)))
        r = client.post("/v1/generate", json={"provider": "seedance", "prompt": "x"}, headers=KEY)
        assert r.status_code == 503


def test_wait_mode_and_callback(tmp_path):
    with respx.mock(assert_all_called=False) as router:
        mock_comfy(router)
        cb = router.post("http://n8n.test/webhook/done").respond(json={})
        client = TestClient(create_app(make_settings(tmp_path)))
        r = client.post("/v1/generate", headers=KEY, json={
            "provider": "hunyuan", "prompt": "x", "wait": True, "callback_url": "http://n8n.test/webhook/done",
        })
        assert r.json()["status"] == "succeeded"
        assert r.json()["video_url"].endswith(".mp4")
        for _ in range(100):
            if cb.called:
                break
            time.sleep(0.02)
        assert cb.called
