# Review — Frame Events explainer (9:16, 89 s, narrated)

**Creative calls.** Storyline "one photo's journey" (the worked example): one wedding photo goes from the table QR, into the event
frame, through editing, to print and the magnet; then the app stays on the phone (store, club) and the owner's side (frames, QR
codes, customer photos on the computer). Not built: "a night at the event" (a guest's evening, minute by minute) and "type carries
it" (kinetic Hebrew lines over cut photos).

**Material.** Every screen is the real app, captured on an iPhone-size screen from a local run, with the owner's own event photos
(videos/optimus-promo/assets/photos) in place of the stock photos the capture machine cannot reach. The wedding frame "נועה & דניאל"
was made for the film. The test address (localhost) was replaced by the real app address on every screen and QR; the QRs in the
sign, the event card and the end card all decode to https://devopsdevopshaim-wq.github.io/devops-hub/events-hub/.

**Measured.** `check`: no errors or warnings. Final file: 60.0 s, 1080×1920, 30 fps; sound present, −14.9 LUFS, true peak −1.1 dB,
no clipping (normalised after render with ffmpeg loudnorm). The sound was measured, not heard. Music: the owner's bed from earlier
promos, looped once at 47.6 s.

**Looked at.** The beat, seam and phone sheets (`snapshot --review`). Titles read at 360 px.

**Weakest shot.** The cut at 4.0 s shows one near-empty frame (the hook has left and the sign is still entering). With more time:
let the sign enter under the leaving magnet. The computer shot (24.5 s) is a crop of the studio screen; a real screen recording of a
photo arriving would be stronger.

**Deliverables.** renders/פריים-אירועים-הסבר.mp4 (1080×1920, ~32 MB) and renders/פריים-אירועים-הסבר-וואטסאפ.mp4 (720×1280, ~7 MB).
Rebuild: `python3 gen.py && npx hyperframes render`.

## Narration (Nov 11)

- Hebrew narration, one line per scene (videos/promo-src/frame-events/script.json), spoken by frame-tts.yml in the owner's chosen
  Gemini voice (Sulafat) in a warm, spoken style; QR is spelled "קיו־אר" for the ear. Clips: ci-tts branch, frame-events-v1/he.
  The free Gemini quota spoke 2-3 lines a run, so the 11 lines took five runs over two days; all eleven are the same voice.
- gen.py stretches every scene to its line (voice starts 0.3 s in, 0.55 s of air before the cut), scales the positions on the
  scene's timeline with it (tween lengths stay), and runs the phone's slow push over the whole scene. Music sits at 0.16 under
  the voice. Length 60 s -> 89.2 s.
- Measured: check clean (no errors or warnings); final file -14.9 LUFS, true peak -2.8 dB, no clipping, the only silence is the
  last 0.5 s fade. The transcription check in frame-tts could not run (quota), so the words were not heard back; listen once.
- Files: renders/פריים-אירועים-הסבר-עם-קריינות.mp4 (1080x1920, ~43 MB) and ...-וואטסאפ.mp4 (720x1280, ~10 MB).
