## Dispatch context (shared by every frame of this video)

- PROJECT_DIR: /home/user/devops-hub/videos/frame-explainer
- Canvas: 1920x1080 (16:9). Confirmed sketch on disk: no (autonomous run; build straight from the packet).
- Captions: disabled (no narration). Still keep important content in the top ~83% of the frame.
- LANGUAGE: all visible text is Hebrew and must be right-to-left. Put `dir="rtl"` and `lang="he"` on every text block; align
  Hebrew text to the right (or center). Numbers, phone and web address stay left-to-right inside an inline `<bdi dir="ltr">`.
- FONTS: the Hebrew-capable fonts ship as files. Copy the needed `@font-face` rules from `assets/fonts/fonts.css` into your
  frame file (paths are project-root relative, `assets/fonts/...woff2`). Display = 'Frank Ruhl Libre' (weights 400–900),
  body = 'Heebo' (400–900). Do not use Instrument Serif / Archivo / JetBrains Mono (no files); for the "mono" role use Heebo 500 with tabular-nums.
- The "voiceover" field is the ON-SCREEN text (there is no audio narration); cues separated by "|" are separate reveals.
- Music: a 104 bpm bed is mounted by the assembler (one beat ≈ 0.577s) — land key swaps/reveals on beat multiples of the frame's local time where it fits.
- Photos are real files in assets/ (portrait-<style>.jpg are the SAME photo rendered in different styles, all 1200x1200 square (face upper-center);
  magnet-*.png are finished magnets 800x1200 portrait PNGs (opaque)).
- Screens: shot-*.png are real screenshots (desktop 1920x1080 or 1450x950/1500x950; phone 390x844). Show them inside a clean
  device frame you draw in CSS (laptop window with a thin dark bezel and rounded corners, or a phone with rounded corners),
  never full-bleed.
- The 4-step rail (Frames 3–7): top-right, at the SAME position and size in every frame: four items right-to-left
  "① מתאמים · ② מעצבים · ③ מצלמים · ④ מדביקים" in Heebo 500 ~26px; the current step gold (#c9a45c) with a gold underline,
  previous steps ink with a small gold ✓, later steps ink at 40% opacity. Rail box: right edge 96px from the frame's right,
  top 64px, height 48px. It is already on screen at t=0 in Frames 4–7 (no entrance), and enters in Frame 3.
- Shadows: frame.md forbids heavy shadows; a very soft, low-opacity ink blur under floating devices/magnets is allowed for depth.
