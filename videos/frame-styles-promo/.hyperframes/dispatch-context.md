## Dispatch context (shared by every frame of this video)

- PROJECT_DIR: /home/user/devops-hub/videos/frame-styles-promo
- Canvas: 1920x1080 (16:9). Confirmed sketch on disk: no (autonomous run; build straight from the packet).
- Captions: disabled (no narration). Still keep important content in the top ~83% of the frame.
- LANGUAGE: all visible text is Hebrew and must be right-to-left. Put `dir="rtl"` and `lang="he"` on every text block; align
  Hebrew text to the right (or center). Numbers, phone and web address stay left-to-right inside an inline `<bdi dir="ltr">`.
- FONTS: the Hebrew-capable fonts ship as files. Copy the needed `@font-face` rules from `assets/fonts/fonts.css` into your
  frame file (paths are project-root relative, `assets/fonts/...woff2`). Display = 'Frank Ruhl Libre' (weights 400–900),
  body = 'Heebo' (400–900). Do not use Instrument Serif / Archivo / JetBrains Mono (no files); for the "mono" role use Heebo 500 with tabular-nums.
- The "voiceover" field is the ON-SCREEN text (there is no audio narration); cues separated by "|" are separate reveals.
- Music: a 112 bpm bed is mounted by the assembler (one beat ≈ 0.536s) — land key swaps/reveals on beat multiples of the frame's local time where it fits.
- Photos are real files in assets/ (portrait-<style>.jpg are the SAME photo rendered in different styles, all 1200x1200 square (face upper-center);
  magnet-*.png are finished magnets 800x1200 portrait PNGs (opaque)).
