---
workflow: product-launch-video
flow: automation
storyboard: no
message: "SPIDER is a digital atelier: one craftsman, 48 bespoke systems, each one real and live"
destination: website, youtube
aspect: 1920x1080
language: en, he
audience: premium clients and partners visiting the SPIDER site
length: 73s
angle: luxury-atelier
---

## Intent

A new, luxury-level brand film for SPIDER (https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/client.html,
the sign-in gate of the SPIDER portfolio of Haim Krispin). The user asked for "a really impressive, truly luxurious"
promo with speech in English and Hebrew.

Concept: **"The Atelier"**, styled like a haute-horlogerie commercial. Onyx black, champagne gold, ivory serif type,
slow camera, light sweeps across real screenshots floating as glass panels. A single gold line opens the film
("Every masterpiece begins with a single line"), becomes a woven web monogram, and closes on the SPIDER signature.

## Customizations

- Two separate cuts: `spider-luxe` (English, narrated) and `spider-luxe-he` (Hebrew, RTL on-screen typography, music only).
- English narration: local Kokoro voice `af_bella`, unhurried.
- Hebrew cut: no voiceover, because no Hebrew TTS engine is reachable from this environment (ElevenLabs, Microsoft and
  HuggingFace are blocked by the network policy). The user chose Hebrew on-screen text only.
- Real captured screenshots from portfolio/shots, the dark and gold ones first.
- Original score composed in code (src/score.py), ducked under the English narration.

## Notes

- 16:9 only, for the website and YouTube.
- Sources: src/gen.py (frames), src/vo.py (English narration), src/score.py (music), src/build.py (assembles both cuts).
