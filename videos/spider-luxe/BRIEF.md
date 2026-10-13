---
workflow: product-launch-video
flow: automation
storyboard: no
message: "Fifty-one live systems. One mind. SPIDER, the digital atelier of Haim Krispin"
destination: website, youtube
aspect: 1920x1080
language: en, he
audience: premium clients and partners visiting the SPIDER site
length: 82s
angle: cinematic-trailer
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

## Revision 2

The user found v1 too slow and wanted more quality, and corrected the count: the site has 51 projects (not 48).
They asked for more pace and energy, cinematic depth, the sites shown alive, and better voice and music,
in a "cinematic luxury" style. v2: 100 BPM trailer score with every cut on the beat grid; anamorphic letterbox;
light beams, flashes and a logo slam; a 3D flight through a corridor of all the project screenshots counting to 51;
four chapters that orbit live browser windows scrolling the real sites (captured locally with Playwright from this
repo into assets/sites/); a 16-cut recap; narration with trailer processing (src/vo.py) and src/audio.sh for the mix.
