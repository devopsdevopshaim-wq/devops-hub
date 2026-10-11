---
name: veo3
description: Write prompts for Google Veo 3 / Veo 3.1 (text-to-video and image-to-video with native sound) and render clips through the Gemini API when GEMINI_API_KEY is set. Use when the user mentions Veo, Veo 3, Veo3, וידאו מגוגל, סרטון AI עם סאונד, פרומפט לווידאו של גוגל, or wants a short AI video clip with dialogue or sound.
---

# Veo 3

Google's video model. One call gives a clip of up to 8 seconds, 720p or 1080p, 16:9 or 9:16, **with its own soundtrack** (ambience, sound effects, music, spoken dialogue with lip sync). This is what sets it apart from Seedance / Runway / Kling, so a Veo prompt always says what we hear.

## Writing a prompt
Write the prompt in English, as one paragraph. Put the parts in this order:

1. **Shot and camera**: shot size, lens, movement. Example: "Medium tracking shot, 35mm, slow dolly-in".
2. **Subject**: who or what, with clear visual traits. Keep them the same in every clip of a series.
3. **Action**: one main action that fits in 8 seconds.
4. **Setting and time**: the place, the hour and the weather.
5. **Style and light**: for example "cinematic, warm golden-hour backlight, shallow depth of field, film grain".
6. **Audio**: start with "Audio:" and list the ambience, the effects and the music.
7. **Dialogue**: write it as `The man says: "..."`. Keep it short, one or two lines per 8 seconds. The dialogue works best in English. For Hebrew speech, check the result, or add the voice in editing.

Avoid on-screen text and logos, because the model writes text badly. Put what you don't want in `negativePrompt` as plain nouns, for example "text, watermark, distorted hands", not as "no ...".
For a longer film, split it into 8-second shots following the storyboard. Repeat the same description of the character and the style word for word in each shot, and use the last frame of one shot as the starting image of the next (image-to-video).

Example:
```
Wide aerial drone shot slowly descending over a quiet Tel Aviv beach at sunrise, a lone surfer in a black wetsuit carries a white board toward gentle waves, soft pastel sky, cinematic, natural colors, light haze. Audio: rolling waves, distant seagulls, a soft ambient piano.
```

## Rendering (when there is a key)
`node .claude/skills/veo3/scripts/veo3.mjs --prompt "..." [--aspect 9:16] [--resolution 1080p] [--negative "text, watermark"] [--image first.png] [--model veo-3.0-fast-generate-001] [--out out.mp4]`

- The key is read from `GEMINI_API_KEY`. Never write it into the repo, a commit or the chat. If the key is missing, give the user the finished prompt to paste into Gemini / Flow / AI Studio instead.
- The default model is `veo-3.0-generate-001`. The fast and cheaper one is `veo-3.0-fast-generate-001`, and Veo 3.1 is `veo-3.1-generate-preview`. Model names change, so if you get a 404, list the models with `GET https://generativelanguage.googleapis.com/v1beta/models` and pick a veo model.
- Rendering takes one to several minutes, and the script waits for it. Every clip costs money on the Google account, so before rendering a batch, confirm the number of clips with the user.
- The cloud environment needs network access to `generativelanguage.googleapis.com`.

## In the project
The `aia-studio` site writes a ready "Veo 3" prompt in every production package (`tools/hubs/local.js` and the AI prompt in `aia-studio/hub/lib/aiaBrowser.js` / `tools/build-hubs.mjs`). You can take a prompt from there and render it with the script.
