"""Generates n8n/workflows/ai-video-generate.json (run: python3 n8n/build_workflow.py).

Kept as code so the workflow stays reviewable; import the generated JSON into n8n Cloud.
"""
import json
import os

CRED = {"httpHeaderAuth": {"id": "aiVideoGatewayKey", "name": "AI Video Gateway"}}
AUTH = {"authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth"}


def node(name, type_, version, pos, params, **extra):
    return {"parameters": params, "id": name.lower().replace(" ", "-").replace("?", ""), "name": name,
            "type": type_, "typeVersion": version, "position": pos, **extra}


def field(name, value, type_="string"):
    return {"id": name, "name": name, "value": value, "type": type_}


body = "$json.body || {}"
nodes = [
    node("Webhook", "n8n-nodes-base.webhook", 2, [0, 0], {
        "httpMethod": "POST", "path": "ai-video", "responseMode": "onReceived", "options": {},
    }, webhookId="ai-video-generate"),
    node("Every day 09:00", "n8n-nodes-base.scheduleTrigger", 1.2, [0, 200], {
        "rule": {"interval": [{"field": "days", "triggerAtHour": 9}]},
    }),
    node("Manual run", "n8n-nodes-base.manualTrigger", 1, [0, 400], {}),
    node("Config", "n8n-nodes-base.set", 3.4, [260, 200], {
        "mode": "manual",
        "assignments": {"assignments": [
            # EDIT THIS: your tunnel URL (or http://gateway:8000 when n8n runs in the same docker compose)
            field("gateway_url", "https://video.example.com"),
            field("provider", f"={{{{ ({body}).provider || 'auto' }}}}"),
            field("prompt", f"={{{{ ({body}).prompt || 'A drone shot over a Mediterranean beach at sunset, cinematic, 4k' }}}}"),
            field("image_url", f"={{{{ ({body}).image_url || '' }}}}"),
            field("width", f"={{{{ ({body}).width || 848 }}}}", "number"),
            field("height", f"={{{{ ({body}).height || 480 }}}}", "number"),
            field("frames", f"={{{{ ({body}).frames || 73 }}}}", "number"),
            field("steps", f"={{{{ ({body}).steps || 30 }}}}", "number"),
            field("duration", f"={{{{ ({body}).duration || 5 }}}}", "number"),
            field("resolution", f"={{{{ ({body}).resolution || '720p' }}}}"),
        ]},
        "options": {},
    }),
    node("Submit job", "n8n-nodes-base.httpRequest", 4.2, [500, 200], {
        "method": "POST", "url": "={{ $json.gateway_url }}/v1/generate", **AUTH,
        "sendBody": True, "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({ provider: $json.provider, prompt: $json.prompt, width: $json.width,"
                    " height: $json.height, frames: $json.frames, steps: $json.steps, duration: $json.duration,"
                    " resolution: $json.resolution, image_url: $json.image_url || null }) }}",
        "options": {"timeout": 60000},
    }, credentials=CRED),
    node("Wait 20s", "n8n-nodes-base.wait", 1.1, [740, 200], {"amount": 20, "unit": "seconds"},
         webhookId="ai-video-wait"),
    node("Get job", "n8n-nodes-base.httpRequest", 4.2, [960, 200], {
        "url": "={{ $('Config').item.json.gateway_url }}/v1/jobs/{{ $('Submit job').item.json.job_id }}",
        **AUTH, "options": {"timeout": 30000},
    }, credentials=CRED),
    node("Finished?", "n8n-nodes-base.if", 2.2, [1180, 200], {
        "conditions": {
            "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
            "conditions": [{
                "id": "finished", "leftValue": "={{ ['succeeded', 'failed'].includes($json.status) }}",
                "rightValue": "", "operator": {"type": "boolean", "operation": "true", "singleValue": True},
            }],
            "combinator": "and",
        },
        "options": {},
    }),
    node("Succeeded?", "n8n-nodes-base.if", 2.2, [1400, 100], {
        "conditions": {
            "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
            "conditions": [{
                "id": "ok", "leftValue": "={{ $json.status }}", "rightValue": "succeeded",
                "operator": {"type": "string", "operation": "equals"},
            }],
            "combinator": "and",
        },
        "options": {},
    }),
    node("Download video", "n8n-nodes-base.httpRequest", 4.2, [1620, 0], {
        "url": "={{ $json.video_url }}", **AUTH,
        "options": {"response": {"response": {"responseFormat": "file"}}, "timeout": 300000},
    }, credentials=CRED),
    node("Generation failed", "n8n-nodes-base.stopAndError", 1, [1620, 200], {
        "errorMessage": "={{ 'Video job ' + $json.id + ' failed (' + $json.provider + '): ' + $json.error }}",
    }),
]


def to(*targets):
    return {"main": [[{"node": t, "type": "main", "index": 0}] if t else [] for t in targets]}


connections = {
    "Webhook": to("Config"),
    "Every day 09:00": to("Config"),
    "Manual run": to("Config"),
    "Config": to("Submit job"),
    "Submit job": to("Wait 20s"),
    "Wait 20s": to("Get job"),
    "Get job": to("Finished?"),
    "Finished?": to("Succeeded?", "Wait 20s"),
    "Succeeded?": to("Download video", "Generation failed"),
}

workflow = {
    "name": "AI Video - HunyuanVideo / Seedance via local gateway",
    "nodes": nodes,
    "connections": connections,
    "settings": {"executionOrder": "v1"},
    "active": False,
}

out = os.path.join(os.path.dirname(__file__), "workflows", "ai-video-generate.json")
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, "w", encoding="utf-8") as f:
    json.dump(workflow, f, indent=2, ensure_ascii=False)
    f.write("\n")
print("wrote", out)
