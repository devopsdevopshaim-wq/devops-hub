# Engineering notes (what the generator assumes)

- Platform: Siemens S7-1500F (TIA Portal), ET 200SP, SINAMICS G120 (CU250S-2 PN with EPos for travel/hoist/turntable, G120C PN for transfer/door), PROFINET + PROFIsafe. One shuttle per floor; lift at aisle position 0 on side A (second lift at position N+1).
- Motor sizing: travel F = m(a + g·0.015); transfer with 3% roller friction; hoist with counterweight = platform + pallet + ½ car; turntable from inertia and a trapezoid 180° move. Safety factors 1.1–1.3, next standard kW.
- Overhang protection: two long-range through-beams per side per floor (40 mm over rail, 450 mm over pallet) in Light-on mode, a seated-pallet sensor per cell, beams on shuttle and lift platform, spring latch per cell. Beams are muted only during a transfer at that cell.
- Overhang sensor catalogue (`OVH`): SICK WS/WE34-V540 (0–60 m), Banner QS30E/QS30R (60 m), Leuze LS46C/LE46C (0.5–120 m). Keep source links; add new models only from pages actually opened.
- Lobby: length/width beams, N height beams (configurable), safety scanner, entry light curtain, radar presence, door safety edge; height class decides allowed floors (clear height ≥ class upper bound + 50 mm).
- IP plan: x.1–9 main, 10–29 lobbies, 30–49 lifts, 100 + 10·(floor−1) per floor.
- PLC templates: SINA_POS/SINA_SPEED from DriveLib must be added to the project; `hwId := 0` lines in FC_Config must be replaced with the telegram system constants; F-IO start addresses must match the IO tab.
- Everything is preliminary: verify parameter numbers, part numbers, terminal names and F-DI channel pairing against the manuals; approval by an electrical engineer and safety inspector is required.
