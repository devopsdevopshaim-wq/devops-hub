---
version: alpha
name: Biennale Yellow — Frame (video / frame layer)
description: >
  Video-first companion to Biennale Yellow's design.md. The unit is the frame (1920×1080). Atoms
  are identical and sacred — warm parchment grounds, a single deep indigo ink, solar yellow deployed
  as bloom / panel / tile underprint, Bellefair display + Bellefair sans + JetBrains Mono data,
  1px hairline rules as the only border, atmospheric depth (no shadows), and the bottom-right
  pagenum. Composition + frame scale rewritten. Restraint is the rule; motion out of scope.
unit: the frame — 1920×1080 primary; 9:16 and 1:1 documented
principle: atoms are sacred · composition is free · numbers come from the script

colors:
  paper: "#0F0D24"
  paper-deep: "#4F390F"
  sun: "#E0B25A"
  sun-soft: "#5A4111"
  haze: "#7B5917"
  ink: "#F1EEFC"
  ember: "#F3D596"

typography:
  # — reading + data ramp —
  body:    { fontFamily: "Assistant", cqw: 0.85, weight: 400, lineHeight: 1.5, color: "ink" }
  body-lede:{ fontFamily: "Assistant", cqw: 0.95, weight: 400, lineHeight: 1.55 }
  micro-label:{ fontFamily: "Assistant", px: 13, weight: 600, tracking: "0.18em", upper: true }
  rail-label:{ fontFamily: "Assistant", px: 13, weight: 600, tracking: "0.32em", upper: true }
  mono-data:{ fontFamily: "JetBrains Mono", cqw: 0.73, weight: 400, tracking: "0.04em" }
  pagenum: { fontFamily: "JetBrains Mono", px: 13, weight: 400, tracking: "0.08em", opacity: 0.75 }
  # — display ramp (Bellefair 400, tight, negative tracking) —
  ledger-title:{ fontFamily: "Bellefair", cqw: 1.55, weight: 400, lineHeight: 1.15 }
  strand-title:{ fontFamily: "Bellefair", cqw: 1.7, weight: 400, lineHeight: 1.1 }
  headline-sm:{ fontFamily: "Bellefair", cqw: 2.9, weight: 400, lineHeight: 1.0 }
  headline:{ fontFamily: "Bellefair", cqw: 4.6, weight: 400, lineHeight: 1.06, tracking: "-0.005em" }
  date-rail:{ fontFamily: "Bellefair", cqw: 5.0, weight: 400, lineHeight: 0.96, tracking: "-0.005em" }
  display-it:{ fontFamily: "Bellefair", cqw: 7.0, weight: 400, italic: true, lineHeight: 1.04, tracking: "-0.005em" }
  numeral-md:{ fontFamily: "Bellefair", cqw: 7.5, weight: 400, lineHeight: 0.92, tracking: "-0.01em" }
  display:{ fontFamily: "Bellefair", cqw: 14.6, weight: 400, lineHeight: 0.86, tracking: "-0.018em" }
  numeral-jumbo:{ fontFamily: "Bellefair", cqw: 28.0, weight: 400, lineHeight: 0.84, tracking: "-0.04em" }

spacing:
  pad-edge: "4cqw"
  pad-region: "4.2cqw"
  gap-region: "2.5cqw"

components:
  sun-bloom:
    background: "radial gradient {colors.sun} core → {colors.sun-soft} → {colors.haze} → transparent on {colors.paper}"
    size: "42–70% of the frame, off-center or behind the focal element"
    description: "The primary depth layer. One per frame; a flat parchment frame reads as broken."
  ember-bloom:
    background: "radial {colors.ember} at 15–22% opacity"
    placement: "corner opposite the sun-bloom"
    description: "Subordinate counter-temperature balance; never dominant."
  block-tile:
    backgroundColor: "{colors.sun} at 40–70% opacity"
    layout: "rectangles on an 8×4 grid behind cover/colophon"
    description: "A layered poster underprint."
  yellow-panel:
    backgroundColor: "{colors.sun}"
    textColor: "{colors.ink}"
    rounded: "0"
    border: "none (meets paper directly)"
    description: "Full-bleed column/third — the strongest color statement, ink on top."
  hairline-rule:
    rule: "1px solid {colors.ink} (soft variant: {colors.ink} at 18–20%)"
    description: "The ONLY border — header underlines, footer tops, ledger separators. No thicker rule exists."
  strand-row:
    borderBottom: "1px {colors.ink} 18–20%"
    typography: "{typography.strand-title} + {typography.body}"
    description: "Serif numeral + serif title + sans body. Numbered editorial lists."
  ledger-row:
    borderBottom: "1px {colors.ink} 18–20%"
    typography: "{typography.mono-date} · {typography.ledger-title} · {typography.body} · {typography.mono-data}"
    description: "4-col tabular — mono date · serif title · sans venue · mono duration (right)."
  footer-band:
    borderTop: "1px solid {colors.ink} per cell"
    typography: "{typography.micro-label} + {typography.body-sm}"
    description: "4-column metadata strip at the foot of cover/colophon."
  vertical-rail:
    typography: "{typography.rail-label}"
    transform: "rotated up the left edge"
    description: "Section marker on chapter/divider frames."
  pagenum:
    typography: "{typography.pagenum}"
    color: "{colors.ink} at 75%"
    placement: "bottom-right"
    description: "The only persistent chrome."
---

# Biennale Yellow — Frame (video / frame layer)

## Brand adaptation (READ FIRST — the frontmatter is the source of truth)

This is the **biennale-yellow** preset remixed onto the captured brand. The YAML frontmatter above (colors · typography · components) is **normative and already correct — use it verbatim.** The prose below is the ORIGINAL preset's intent; read it THROUGH the frontmatter:

- **Fonts** — already set to **Bellefair** (display) / **Assistant** (body); ignore any preset font name lingering in prose.
- **Weights** — the brand font ships `{400, 500, 600, 700}` only; every weight is clamped to these — ignore higher preset weights (e.g. 600/700) in prose.
- **Colors** — use the frontmatter hex; preset color NAMES in prose (e.g. "cobalt", "cream") mean the remapped brand values.


## Overview

Biennale Yellow at frame scale is a **literary-editorial system** in the register of an art
biennale catalogue: warm parchment, a single deep indigo ink, and solar yellow as atmosphere. No
cards, no buttons, no shadows, no rounded corners — the structural vocabulary is just **paper, ink,
and yellow.** Depth is delivered by soft radial **sun blooms**, not elevation.

The voice is three faces in rigid roles: **Bellefair** (weight 400, tight line-height,
negative tracking) carries every display, numeral, and quote from 40px to 720px+; **Bellefair** carries
body and the wide-tracked uppercase micro-label; **JetBrains Mono** carries every date, figure, and
the pagenum. Text is **always ink** — contrast comes from size and weight, never color. The mood
sits between a folded museum brochure and a slow-reading literary quarterly: confident, atmospheric,
deeply restrained.

**Key characteristics at frame scale:**

- **Warm parchment ground** on every frame; never white, never gray.
- **Single ink** (`{colors.ink}`) for all type and all rules; **solar yellow** as bloom / panel / tile.
- **Bellefair 400** display (tight, negative-tracked); **Bellefair** body + micro-labels; **JetBrains Mono** data.
- **1px hairline rules** are the only border — no thicker weight exists; **no shadows, no rounded corners**.
- **Sun bloom** is the primary depth layer on every frame; an ember counter-bloom adds warm-cool tension.
- **Editorial-restrained** — sparse reads as elegant; crowding breaks the catalogue feel.

## The Frame

### Frame Craft Bar

Three eyeball tests gate every frame before any structural check:

- **Squint** — one Bellefair moment dominates at 3–6× its neighbor; the sun bloom centers the eye.
- **Silence** — frames read **55–60% empty**; the **ledger is the one dense exception** (density via quiet hairline repetition, not richness).
- **Restraint** — **one ink color** for all type and rules; **one sun bloom** per frame (+ optional subordinate ember); never invert (no yellow text on ink).
- **Reference** — aim at an **art-biennale catalogue / slow exhibition poster / literary quarterly**; failure looks like a **flat CMS template** (no bloom) or a **bordered-card deck**.

- **Primary:** 1920×1080 (16:9). Display authored in **`cqw`** (`px ÷ 1920 × 100 = cqw`).
- **Vertical:** 1080×1920 (9:16). **Square:** 1080×1080 (1:1).
- **Safe area:** `pad-edge` 4cqw (40–76px equivalent) — the elegance depends on edge negative space; only blooms, tiles, and panels bleed.

**The container law (load-bearing).** Every frame ground sets `container-type: size`; ALL
frame-relative units are `cqw`/`cqh` against it — never `vw`. Hairlines stay 1px; bloom sizes scale
as `%` of the frame.

## Colors

Tokens identical to the source. `{colors.paper}` is the universal ground; `{colors.ink}` (deep
indigo navy) is **every line of type and every rule** — there is no secondary text color.
`{colors.sun}` deploys three ways: the **bloom** (radial atmosphere), the **yellow-panel**
(full-bleed poster fill, ink on top), and the **block-tile** underprint. `{colors.sun-soft}`/`haze`
are bloom mid/outer stops. `{colors.ember}` appears **only** as a 15–22% counter-bloom — never a
fill, never text. **The system never inverts** — ink on sun is correct; yellow text on ink does not exist.

## Typography

Two ramps. The **reading/data ramp** (Bellefair body 0.85cqw ink, micro-labels in px, JetBrains Mono
data) carries copy + chrome; the **display ramp** (Bellefair `ledger-title` 1.55cqw →
`numeral-jumbo` 28cqw) carries every headline, numeral, and quote.

- **Legibility floor:** any load-bearing line ≥ **1.4cqw**; mono/labels in px are chrome only.
- **Fit-to-measure:** size the headline to its length. Cap the block at **≤ 78cqw**; ≤3 words → `display`; 4–6 → `headline`; 7+ → `headline-sm`. The jumbo numeral is a divider's whole point — don't shrink it.
- **Bellefair is weight 400 only** (its contrast is the weight signal), tight line-height (0.84–1.06), negative tracking; **micro-labels uppercase Bellefair 600, ≥0.16em**; **mono for all numerals/dates**. No bold serif, no second text color, no mono in body/display.

## Depth & Surface

Atmospheric, not structural. Depth from:

- **Sun bloom** — the primary layer: a layered radial (sun 70–95% core → sun-soft → haze 18–22% → paper 0%), 42–70% of the frame. One per frame.
- **Ember bloom** — a 15–22% peach counter-bloom in the opposite corner; always subordinate.
- **Block-tile underprint** — translucent yellow rectangles on an 8×4 grid (cover/colophon).
- **Yellow panel** — the one "hard" color statement: a flooded column/third, ink on top.
- **Hairline rules** — 1px ink for structural separation (soft 18–20% variant for dense rows).

**Ceiling:** zero box-shadow, zero text-shadow, zero rounded corner, no border thicker than 1px.

## Shapes

- **0 radius on everything** — strict rectangles. Blooms are edgeless (they fade into paper).

## Components

- **sun-bloom / ember-bloom / block-tile** — the atmospheric depth set. **yellow-panel** — the poster-fill statement.
- **hairline-rule** — the only border (1px ink; soft variant for dense rows).
- **strand-row / ledger-row / footer-band** — the editorial list, tabular calendar, and metadata strip.
- **vertical-rail** — rotated chapter marker. **pagenum** — the bottom-right mono chrome.

## Frame Treatments

> Recipe: ground · container · composes · focal · chrome · accent · silence · Fixed/Free · density.
> A sun bloom + bottom-right pagenum on every frame; sparse is the default.

### 1 · Cover (identity · move: display + sun bloom · left)

**Ground** paper + a large sun-bloom (left-of-center) + an ember counter-bloom (opposite corner).
**Composes** micro-label, display, date-rail, footer-band, pagenum. **Focal** a 2-line Instrument
Serif `display` (italic key word) in ink, left, under a micro-label. **Chrome** a serif date-rail
top-right; a 4-column footer-band at the foot. **Accent** the sun bloom + yellow. **Silence** the
bloom holds the open space. **Fixed** ink type, one bloom, 1px footer rules, no shadow. **Free**
title, date, footer cells. **Density** low.

### 2 · Chapter Divider (section · move: jumbo numeral · vertical rail)

**Ground** paper + a corner-anchored sun-bloom. **Composes** vertical-rail, numeral-jumbo,
headline-sm. **Focal** a single huge Bellefair `numeral-jumbo` (≈28cqw) dominating, with a
serif title beneath. **Chrome** a rotated vertical-rail label up the left edge; pagenum. **Accent**
the bloom behind the numeral. **Silence** ~60%. **Fixed** serif 400, jumbo numeral, rail label.
**Free** the ordinal, title, rail text. **Density** low.

### 3 · Ledger (catalog · move: hairline tabular rows · the dense frame)

**Ground** paper (bloom optional, subtle). **Composes** headline-sm + micro-label topbar, ledger-rows.
**Focal** a 4-column tabular calendar — mono date · serif title · sans venue · mono duration —
separated by hairline-soft rules under a 1px ink header rule. **Chrome** pagenum. **Accent** none —
density through quiet repetition, not color. **Silence** tight — the density exception (achieved by
repetition, not richness). **Fixed** hairline rules, mono dates, serif titles. **Free** rows, venues.
**Density** dense-exception.

### 4 · Manifesto / Quote (quote · move: italic serif · centered bloom)

**Ground** paper + a centered sun-bloom. **Composes** numeral-lg quote mark, display-it, attribution.
**Focal** a 2-line Bellefair **italic** `display-it` quote in ink, centered, under an
oversized serif quote mark. **Chrome** a micro-label attribution. **Accent** the centered bloom.
**Silence** ~60% — deliberately open. **Fixed** italic serif, one bloom, ink. **Free** quote,
attribution. **Density** low.

### 5 · Poster Panel (statement · move: yellow panel · split)

**Ground** paper with a full-bleed `{colors.sun}` `yellow-panel` (column or third). **Composes**
yellow-panel, micro-label, headline. **Focal** an Bellefair `headline` in ink sitting **on
the sun panel** (ink-on-yellow — a signature). **Chrome** micro-label; pagenum. **Accent** the panel
itself. **Silence** the paper side stays open. **Fixed** ink-on-sun, panel meets paper directly (no
border), no shadow. **Free** headline, panel side/width. **Density** low.

### 6 · Strand List (programme · move: numbered editorial rows · left)

**Ground** paper + a subtle sun-bloom. **Composes** micro-label, headline-sm, strand-rows. **Focal**
a numbered list — serif numeral + serif title + sans body, hairline-soft separators. **Chrome**
micro-label; pagenum. **Accent** the bloom. **Silence** moderate; rows breathe. **Fixed** serif
numerals, hairline-soft rules. **Free** items, copy. **Density** standard.

## Composition Rules

### Do

- Start on **warm parchment**; add **one sun bloom** (optionally an ember counter-bloom) — atmosphere is the depth.
- Set every line in **ink**; use **Bellefair 400** (tight, negative-tracked) for display, **Bellefair** body, **JetBrains Mono** for all numerals/dates.
- Make every separator a **1px ink hairline** (soft variant for dense rows); flood a **yellow panel** for poster moments (ink on top).
- Keep micro-labels **uppercase Bellefair 600, 0.16–0.32em**; pin the **pagenum** bottom-right.
- Lean sparse; left/asymmetric on cover/chapter/list, centered on manifesto.

### Don't

- No drop shadows, no rounded corners, no bordered cards, no border thicker than 1px.
- No second text color; no bold Bellefair; no inverted ink grounds.
- No mono for body/display; no font substitutes.
- Don't crowd the canvas — sparse reads as elegant; don't omit the bloom (flat parchment reads as a CMS template).
- Don't blow a headline edge-to-edge — step the ramp down.

## Aspect-Ratio Behavior

| Treatment       | 16:9                                           | 9:16                       | 1:1                        |
| --------------- | ---------------------------------------------- | -------------------------- | -------------------------- |
| Cover           | display left, date-rail top-right, footer foot | display top, footer stacks | display upper, footer foot |
| Chapter Divider | jumbo numeral, rail left                       | numeral centered, rail top | numeral centered           |
| Ledger          | 4-col rows                                     | drop venue col → 3-col     | 3-col                      |
| Manifesto       | centered italic                                | centered, taller           | centered                   |
| Poster Panel    | side panel + paper                             | top/bottom panel band      | panel third                |
| Strand List     | numbered rows                                  | rows (tighter)             | rows                       |

`pad-edge` holds on the short edge; display clamps use the shorter axis so portrait doesn't blow out
headlines. Keep load-bearing lines ≥ 1.4cqw. Ledger/strand fixed first columns may tighten on 9:16.

## Approved Entities

No real customers, logos, or vendors are defined in the source — render any such mark as a
placeholder. Programme titles, venues, and dates are content; the system supplies paper, ink, yellow.

## Numerals & Claims (hard rule)

Never invent figures, dates, durations, or counts at frame scale. Render slots as `— figure —`,
`{metric}`, `NN JUN`, `N m`. Ledger dates/durations and chart values especially carry placeholders
until the script supplies them. Chapter ordinals (01, 02…) are decorative.

## Pre-Render Self-Audit

- **Squint** — one serif display moment dominates; the bloom centers the eye.
- **Silence** — sparse frames 55–60% open; only the ledger runs dense (via repetition, not richness).
- **One color** — ink for all text + rules; sun for bloom/panel/tile; ember counter-bloom only; no inversion.
- **Type** — Bellefair 400 tight negative-tracked, fit-to-measure; micro-labels uppercase 0.16em+; mono numerals; ≥1.4cqw floor.
- **Depth** — 0 shadow, 0 rounded corner, 1px hairlines only; one sun bloom present.
- **Anchor** — left on cover/chapter/list, centered on manifesto; pagenum bottom-right.
- **Fabrication** — every numeral/date traces to the script, else placeholder.

## Known Gaps

- **Motion intentionally out of scope.** frame.md specifies composition only; the source's 280ms crossfade is a deck mechanic.
- **Bellefair + Bellefair + JetBrains Mono via Google Fonts.** CJK: Smiley Sans (display) / Noto Serif SC (body) / Noto Sans SC (labels); italic serif and mono tabular figures have no exact Hanzi equal — keep ledger dates Latin.
- **9:16 / 1:1 are guidance**; the `min(vw,vh)` clamp pattern keeps display from blowing out — verify per ratio.
- Sun/ember blooms, block tiles, yellow panels, and hairline rules are CSS-only; no external imagery is required.


## Font loading (auto-generated)

The brand font ships as local files in `assets/fonts/` — do NOT link Google Fonts for it. Paste this `<style>` into every frame's `<head>`/`<template>` (captions use the same files) so `font-family` resolves in preview, snapshot, and render alike:

```html
<style>
@font-face{
  font-family: 'Bellefair';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("assets/fonts/captured-TUZ3zwprpvBS1izr_vOMscGKerUC_2fi-Vl4.woff2") format('woff2');
  unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
}
@font-face{
  font-family: 'Bellefair';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("assets/fonts/captured-TUZ3zwprpvBS1izr_vOMscGKfLUC_2fi-Vl4.woff2") format('woff2');
  unicode-range: U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F;
}
@font-face{
  font-family: 'Bellefair';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("assets/fonts/captured-TUZ3zwprpvBS1izr_vOMscGKcbUC_2fi-Vl4.woff2") format('woff2');
  unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB;
}
@font-face{
  font-family: 'Bellefair';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("assets/fonts/captured-TUZ3zwprpvBS1izr_vOMscGKcLUC_2fi-Vl4.woff2") format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face{
  font-family: 'Bellefair';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("assets/fonts/captured-TUZ3zwprpvBS1izr_vOMscGKfrUC_2fi-Q.woff2") format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face{
  font-family: 'Assistant';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("assets/fonts/captured-2sDcZGJYnIjSi6H75xkzamW5Kb8VZBHR.woff2") format('woff2');
  unicode-range: U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F;
}
@font-face{
  font-family: 'Assistant';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("assets/fonts/captured-2sDcZGJYnIjSi6H75xkzZmW5Kb8VZBHR.woff2") format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face{
  font-family: 'Assistant';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("assets/fonts/captured-2sDcZGJYnIjSi6H75xkzaGW5Kb8VZA.woff2") format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face{
  font-family: 'Assistant';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url("assets/fonts/captured-2sDcZGJYnIjSi6H75xkzamW5Kb8VZBHR.woff2") format('woff2');
  unicode-range: U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F;
}
@font-face{
  font-family: 'Assistant';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url("assets/fonts/captured-2sDcZGJYnIjSi6H75xkzZmW5Kb8VZBHR.woff2") format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face{
  font-family: 'Assistant';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url("assets/fonts/captured-2sDcZGJYnIjSi6H75xkzaGW5Kb8VZA.woff2") format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face{
  font-family: 'Assistant';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url("assets/fonts/captured-2sDcZGJYnIjSi6H75xkzamW5Kb8VZBHR.woff2") format('woff2');
  unicode-range: U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F;
}
@font-face{
  font-family: 'Assistant';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url("assets/fonts/captured-2sDcZGJYnIjSi6H75xkzZmW5Kb8VZBHR.woff2") format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face{
  font-family: 'Assistant';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url("assets/fonts/captured-2sDcZGJYnIjSi6H75xkzaGW5Kb8VZA.woff2") format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face{
  font-family: 'Assistant';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("assets/fonts/captured-2sDcZGJYnIjSi6H75xkzamW5Kb8VZBHR.woff2") format('woff2');
  unicode-range: U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F;
}
@font-face{
  font-family: 'Assistant';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("assets/fonts/captured-2sDcZGJYnIjSi6H75xkzZmW5Kb8VZBHR.woff2") format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face{
  font-family: 'Assistant';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("assets/fonts/captured-2sDcZGJYnIjSi6H75xkzaGW5Kb8VZA.woff2") format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face{
  font-family: 'Bellefair';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("assets/fonts/captured-kJExBuYY6AAuhiXUxG1N-vo3huR_DaS8.woff2") format('woff2');
  unicode-range: U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F;
}
@font-face{
  font-family: 'Bellefair';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("assets/fonts/captured-kJExBuYY6AAuhiXUxG1N9vo3huR_DaS8.woff2") format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face{
  font-family: 'Bellefair';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("assets/fonts/captured-kJExBuYY6AAuhiXUxG1N-Po3huR_DQ.woff2") format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face{
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("assets/fonts/captured-tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPx3cwgknk-6nFg.woff2") format('woff2');
  unicode-range: U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F;
}
@font-face{
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("assets/fonts/captured-tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxTcwgknk-6nFg.woff2") format('woff2');
  unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
}
@font-face{
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("assets/fonts/captured-tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxPcwgknk-6nFg.woff2") format('woff2');
  unicode-range: U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF;
}
@font-face{
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("assets/fonts/captured-tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPx_cwgknk-6nFg.woff2") format('woff2');
  unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB;
}
@font-face{
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("assets/fonts/captured-tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPx7cwgknk-6nFg.woff2") format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face{
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("assets/fonts/captured-tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxDcwgknk-4.woff2") format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face{
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url("assets/fonts/captured-tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPx3cwgknk-6nFg.woff2") format('woff2');
  unicode-range: U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F;
}
@font-face{
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url("assets/fonts/captured-tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxTcwgknk-6nFg.woff2") format('woff2');
  unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
}
@font-face{
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url("assets/fonts/captured-tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxPcwgknk-6nFg.woff2") format('woff2');
  unicode-range: U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF;
}
@font-face{
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url("assets/fonts/captured-tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPx_cwgknk-6nFg.woff2") format('woff2');
  unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB;
}
@font-face{
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url("assets/fonts/captured-tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPx7cwgknk-6nFg.woff2") format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face{
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url("assets/fonts/captured-tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxDcwgknk-4.woff2") format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face{
  font-family: 'Michroma';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("assets/fonts/captured-PN_zRfy9qWD8fEagAPgzpTn5_PDb9no.woff2") format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face{
  font-family: 'Michroma';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("assets/fonts/captured-PN_zRfy9qWD8fEagAPg9pTn5_PDb.woff2") format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
</style>
```
