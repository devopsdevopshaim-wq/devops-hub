---
name: hailuo
description: Write prompts for MiniMax Hailuo (Hailuo 02 and later, text-to-video and image-to-video, strong subject motion and physics) and render clips through the MiniMax API when MINIMAX_API_KEY is set. Use when the user mentions Hailuo, MiniMax video, הילואו, האילואו, or wants a short AI clip with a lot of movement (dance, sports, action).
---

# Hailuo (MiniMax)

Hailuo is MiniMax's video model. It gives a clip of 6 or 10 seconds, at 768p or 1080p (1080p only for 6 seconds). It is strong at movement of bodies, physics and expressions. **It has no sound**: add the music and voices in editing, or use Veo 3 when sound matters.

## Writing a prompt
Write the prompt in English, as one or two sentences, in this order: subject → action → place → style and light → camera.
- **Camera:** write camera moves in square brackets, inside the text, where they should happen. Available moves: `[Push in]`, `[Pull out]`, `[Pan left]`, `[Pan right]`, `[Truck left]`, `[Truck right]`, `[Tilt up]`, `[Tilt down]`, `[Pedestal up]`, `[Pedestal down]`, `[Zoom in]`, `[Zoom out]`, `[Tracking shot]`, `[Shake]`, `[Static shot]`. Use up to three moves in one clip.
- **Action:** choose one clear action, described with verbs: runs, spins, jumps.
- **Image-to-video:** do not describe the picture again. Write only what moves and how the camera moves.
- Do not ask for on-screen text, and keep the prompt short. The service rewrites prompts by itself (`prompt_optimizer`). Turn this off when you need exact control of the camera.

Example:
```
A street dancer in a red hoodie spins and freezes mid-air on a wet neon-lit Tel Aviv street at night, cinematic, reflections on the asphalt [Tracking shot], then [Push in] on his face.
```

## Rendering (when there is a key)
`node .claude/skills/hailuo/scripts/hailuo.mjs --prompt "..." [--duration 6|10] [--resolution 768P|1080P] [--image first.jpg] [--model MiniMax-Hailuo-02] [--no-optimizer] [--out out.mp4]`

- The key is read from `MINIMAX_API_KEY`. Never write it into the repo, a commit or the chat. If the key is missing, give the user the finished prompt to paste into hailuoai.video.
- The API is `https://api.minimax.io` (international). An account from mainland China uses `--host https://api.minimaxi.com`. Model names change, so if a name is rejected, check the MiniMax docs.
- Rendering takes a few minutes, and the script waits for it. Every clip costs credits, so before rendering a batch, confirm the number of clips with the user.
- The cloud environment needs network access to the API host.

## In the project
The `aia-studio` site writes a ready "Hailuo" prompt in every production package. For sound, see the `veo3` skill.
