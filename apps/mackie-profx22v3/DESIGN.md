# Mackie ProFX22v3 practice simulator

## Device and practice sequence

Fixed top view of the **ProFX22v3**, not the ProFX22, ProFXv3+, or ProFX30v3.
Use the supplied 3000 × 2111 photo (`public/profx22v3.webp`), preserving every
strip's position. Desktop users drag/wheel knobs, drag faders, and click switches;
keyboard users tab to controls and use arrows, Home/End, and Enter. Small screens
use the same panel with uniform zoom and scrolling. Optional source, inspection,
listening, reset, and help tools live outside the hardware.

Typical exercise: start audio, load the generated band, PFL channel 1, adjust gain,
clear PFL, raise its fader and main, route drums through a subgroup, build a
pre-fader monitor mix, and add an FX return.

## Evidence and control contract

Primary reference: user-supplied `C:/Users/marcu/Downloads/ProFXv3_Series_OM2024July.pdf`.
Printed page numbers and PDF page numbers coincide for the pages below. The
manual's imaginary pencil sharpener and theremin are jokes, not device controls.
Manufacturer overview: https://mackie.com/en/products/mixers/profxv3-series/ProFX22v3.html.
The attached photo takes precedence over generic family product marketing.

| Controls                 | Contract and feedback                                                                                                        | Evidence/status                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 18 channel strips        | 1–14 mono, 15/16, 17/18, 19/20 hybrid stereo, 21/22 stereo line/USB                                                          | Photo; pp. 9–12, 33; documented                                       |
| Input / gain             | Mono mic 0…60 dB, mono line −20…40; hybrid gain affects mic only; last strip −20…20                                          | pp. 11–12, 33; documented                                             |
| Hi-Z, low cut, phantom   | Hi-Z only 1–2; low cut 100 Hz on mic paths, mono line too; global phantom supplies condenser sources                         | pp. 10–12, 18, 33; documented; impedance itself unsupported           |
| Compression              | Channels 1–12 only; variable threshold, about 6:1 and soft knee                                                              | pp. 12–13; documented; attack/release and threshold taper provisional |
| EQ                       | Low 80 Hz, high 12 kHz shelves, ±15 dB; mid sweep 100 Hz–8 kHz, ±15 dB on first 17 strips; 21/22 fixed 2.5 kHz               | p. 13, diagram p. 33; documented; Q and filter response provisional   |
| MON 1/2/3                | 1/2 always pre-fader; 3 selects pre/post. Post-EQ, post-mute, mono, independent of pan                                       | p. 14; documented                                                     |
| FX send                  | Post-fader and mute, independent of pan; aux FX master controls processor input                                              | pp. 14, 19; documented                                                |
| Pan, mute, assign, fader | Constant-power mono pan; mute silences sends and assignments. Independent 1–2, 3–4, L–R routes. Faders off…+10 dB            | pp. 14–15; documented; fader taper provisional                        |
| PFL                      | Post-EQ, before mute/fader; affects monitoring, left meter only; multiple solos sum; main mix continues. Rude Solo flashes   | pp. 15, 18; documented                                                |
| Subgroups                | Two stereo pairs, separate faders and L–R assignments                                                                        | p. 21; documented                                                     |
| FX return                | Wet stereo return goes to main and optionally subs; FX-to-MON controls tap before return fader                               | pp. 19, 21; documented                                                |
| Preset encoder           | Rotate previews 1–24; push confirms; unconfirmed selection reverts after 10 s. Last confirmed preset survives power cycle    | p. 19; documented                                                     |
| FX mute / footswitch     | Mute suppresses internal wet audio; pedal can toggle only while panel mute is released; power-up mutes FX for 5 s            | pp. 17, 19; documented                                                |
| Break                    | Silences channel contributions to main/CR/phones; monitor and FX sends continue; 21/22 intermission input remains            | pp. 20, 33–34; documented                                             |
| Blend / CR / phones      | Monitor switch overrides normal main/PFL monitoring with input/USB1–2 blend. Separate CR and phones levels                   | pp. 20, 34; documented; blend taper provisional                       |
| USB3–4                   | Replaces 21/22 analog input with simulated USB return                                                                        | pp. 15, 40; documented                                                |
| Meters and LEDs          | Actual analyser peaks; main stereo or solo left-only, level-set before channel processing; phantom/power/break/mute feedback | pp. 12, 18; documented; digital calibration provisional               |

No owner-confirmed corrections yet. Web Audio is an approximation of analog
hardware; **0 dBu is mapped to −18 dBFS** for practice. This is a simulator
calibration, not a claim about the USB converter. Audio output has a separate
listening attenuation outside the simulated desk.

## Implementation

React, TypeScript and Vite; percentage geometry in `src/geometry.ts`; one reducer in
`src/state.ts`. Live DOM controls mask photographed knobs, faders, lit LEDs and
display. A selected-channel inspector gives readable values without rearranging
the console. Audio buffers, nodes and analyser polling stay outside reducer state.

Web Audio: source → input gain → low-cut → compressor → EQ → pre-fader/PFL tap →
mute → fader → pan → independently assigned main/subgroup buses. Monitor sends
branch after mute (MON3 optionally after fader). FX send branches after fader.
Subgroups, FX return and main have independent gains. The listening selector
auditions main, phones, CR, MON1–3, subgroups, or FX send without changing hardware
routing. Demo instruments are deterministic synthesized loops. Local audio files
are decoded once; stereo is retained on stereo strips and summed on mono strips.

No simulated hardware menus: this mixer has a two-digit FX display, not an LCD.
FX programs use approximate Web Audio reverb/delay/modulation/distortion families;
all 24 affect sound, but proprietary GigFX algorithms are unsupported.

Preset preview uses a monotonic timestamp in reducer actions and a 10 s expiry.
Another rotation replaces the preview/deadline, confirm clears it, power-off
cancels it, and stale expiry actions cannot revert a newer selection. Power-off
stops listening and live indicators; pointer cancellation/blur stops dragging.

## Persistence

Versioned localStorage stores validated channel settings, names, input types,
bus levels, routing, FX preset, and source identities. Imported audio is **session
only**; reload shows the saved filename as missing and requires explicit relinking.
No object URLs or audio blobs are saved. Power, playback, current preview and
warm-up timestamps are transient. Startup is stopped; no audio autoplays.
Reset clears current desk settings and source assignments; it is a simulator
convenience, not a physical factory-reset procedure.

## Milestones and checks

1. Photo calibration, real gain/EQ/fader/mute/PFL path, measured meters.
2. All channel/bus controls, sources, subgroup and monitor routing, FX selection.
3. Versioned restoration, help and readable inspector; desktop/mobile inspection.

Completion checks distinguish reducer/routing tests, browser input and measured
audio, visual alignment, and physical verification. No physical hardware has been
tested. Exact analog saturation, crosstalk, preamp impedance, external inserts,
USB drivers/recording, microphone capture, real footswitch I/O and real device
control are unsupported. Hi-Z records the correct practice setting; its electrical
loading cannot be reproduced for already decoded audio. The UI discloses this.
