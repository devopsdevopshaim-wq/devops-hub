"""Generates the Shir HaShirim film shots on your own computer with Wan (free, open model), from film/prompts.json.

Needs an NVIDIA graphics card. Skips shots that already exist, so you can stop it and run it again.
  python wan_generate.py --chapter 1                 # all of chapter 1
  python wan_generate.py --chapter 1 --limit 2       # two shots, to see the look first
  python wan_generate.py --model wan2.2-5b           # sharper (720p), needs about 24 GB of video memory
"""
import argparse
import json
import pathlib
import time

import torch
from diffusers import AutoencoderKLWan, WanPipeline
from diffusers.utils import export_to_video

MODELS = {
    # name: (Hugging Face id, width, height, frames, fps)  -> about 5 seconds a clip
    "wan2.1-1.3b": ("Wan-AI/Wan2.1-T2V-1.3B-Diffusers", 832, 480, 81, 16),
    "wan2.2-5b": ("Wan-AI/Wan2.2-TI2V-5B-Diffusers", 1280, 704, 121, 24),
    "wan2.1-14b": ("Wan-AI/Wan2.1-T2V-14B-Diffusers", 1280, 720, 81, 16),
}

ap = argparse.ArgumentParser()
ap.add_argument("--chapter", type=int, help="only this chapter (1-8)")
ap.add_argument("--limit", type=int, help="make at most this many shots")
ap.add_argument("--model", default="wan2.1-1.3b", choices=MODELS)
ap.add_argument("--steps", type=int, default=40, help="more steps = finer detail, slower")
ap.add_argument("--low-memory", action="store_true", help="for cards with 8-12 GB: slower, keeps parts of the model in normal memory")
args = ap.parse_args()

film = pathlib.Path(__file__).resolve().parent.parent
shots = json.loads((film / "prompts.json").read_text(encoding="utf-8"))
if args.chapter:
    shots = [s for s in shots if f"/chapter-{args.chapter}/" in s["file"]]
todo = [s for s in shots if not (film / s["file"]).exists()]
if args.limit:
    todo = todo[: args.limit]
print(f"{len(shots)} shots, {len(todo)} to make with {args.model}")
if not todo:
    raise SystemExit(0)

model_id, width, height, frames, fps = MODELS[args.model]
vae = AutoencoderKLWan.from_pretrained(model_id, subfolder="vae", torch_dtype=torch.float32)
pipe = WanPipeline.from_pretrained(model_id, vae=vae, torch_dtype=torch.bfloat16)
if args.low_memory:
    pipe.enable_model_cpu_offload()
else:
    pipe.to("cuda")

for n, shot in enumerate(todo, 1):
    out = film / shot["file"]
    out.parent.mkdir(parents=True, exist_ok=True)
    t = time.time()
    # the same seed for the same shot, so a shot made again looks the same
    seed = sum(ord(c) for c in shot["file"])
    video = pipe(
        prompt=shot["prompt"],
        negative_prompt=shot["negative"],
        width=width,
        height=height,
        num_frames=frames,
        guidance_scale=5.0,
        num_inference_steps=args.steps,
        generator=torch.Generator("cpu").manual_seed(seed),
    ).frames[0]
    export_to_video(video, str(out), fps=fps)
    print(f"[{n}/{len(todo)}] {shot['file']}  ({time.time() - t:.0f}s)")
