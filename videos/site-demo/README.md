# Site demo film (Hebrew and English)

A 79-second, 4:5 (1080x1350) film for Instagram and LinkedIn: real screen recordings of the portfolio, with Hebrew or English captions,
callouts, the SPIDER score and a closing card. No voice-over: every line is on screen, so it works with the sound off.

1. `tools/record.cjs` records the six scenes from the live pages (served from `portfolio/` on :8950, real Hebcal/Sefaria answers in `data/real.json`,
   only the technology news feed) with a CDP screencast, and writes each clip and the moments (`*.marks.json`) the callouts follow into `src/clips`.
2. `tools/gen.py` builds the two HyperFrames projects in `build/he` and `build/en` (callouts are timed from the marks).
3. In each: `npx hyperframes check`, then `npx hyperframes render --output ../site-demo-he.mp4`; compress with
   `ffmpeg -i in.mp4 -c:v libx264 -crf 24 -c:a aac -b:a 128k -movflags +faststart out.mp4`.

The dialogue with Maya in the film is a demonstration (the server is not reached while recording).
