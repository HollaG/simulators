# Yamaha MG10XU practice desk

The MG10XU is a ten-input analog mixer with four mono microphone/line strips,
three stereo strips, two one-knob compressors, a stereo USB interface and 24 SPX
programs. Practise connecting sources, setting gain, balancing levels, shaping
EQ, adding effects, and monitoring a DAW without feeding its return back to USB.

## Evidence and control contract

Primary references: the owner's supplied `MG10XU_owners_manual_En_B0.pdf`
(March 2024; two large leaflet pages; printed and PDF page numbers both 1–2)
and `s-l1600.webp` (1500 × 1500). No owner corrections yet.
Supplement: [Yamaha technical specifications, March 2024](https://usa.yamaha.com/files/download/other_assets/2/1507032/MG10XU_technical_specifications_En_B0.pdf),
pp. 1–2 (gain table and block diagram), inspected visually.

| Controls | Behaviour and feedback | Evidence/status |
| --- | --- | --- |
| CH 1–4 combo, PAD, HPF, GAIN | XLR/phone inputs share gain; −26 dB pad; 80 Hz 12 dB/oct HPF; gain +20…64 dB PAD off, −6…38 dB PAD on | pp. 1–2, technical p. 1 and photo, documented |
| CH 1–2 COMP | Threshold +22…−8 dBu, ratio 1…4, makeup 0…7 dB, attack 25 ms, release 300 ms | p. 1, documented; browser compressor curve approximate |
| Phantom | +48 V to four XLRs; virtual condenser microphones need it | p. 2, documented |
| EQ | High 10 kHz shelf, low 100 Hz shelf, ±15 dB; mono strips also 2.5 kHz mid | p. 1, documented; filter curves approximate |
| Stereo inputs | Phone takes priority over RCA on 5/6 and 7/8. LINE/USB selects 9/10; 9/10 L/MONO duplicates left | p. 2, documented |
| PAN / BAL, LEVEL, FX | Mono positioning / stereo balance; post-level, pre-pan FX sends feed external and internal effects, including 9/10 in TO MON | p. 2 and technical block diagram p. 2, documented |
| TO MON / TO ST | 9/10 dry signal bypasses stereo/USB mix when routed to MON; FX sends remain active and can return indirectly to stereo/USB | p. 2 routing table and technical block diagram p. 2, documented |
| STEREO MUTE | Removes stereo bus from MONITOR/PHONES only; direct 9/10 remains | p. 2 routing table, documented |
| STEREO LEVEL / USB record | Stereo outputs and meters follow master; USB record taps before master | p. 2, documented |
| PROGRAM | Turn previews blinking number; press commits; held turn commits immediately; unattended preview expires | pp. 1–2, documented; 5 s expiry and 1 s successive-press window provisional |
| PARAMETER | Per-program recalled value; next physical movement takes over | p. 2, documented |
| PROGRAM ×5 | Edit USB attenuator −24…0 dB; press exits; decimal point indicates attenuation | p. 2, documented |
| FX ON, FOOT SW, FX RTN | Internal return on/off; foot bypass blinks FX lamp; external FX SEND remains active | p. 2, documented |
| Meter and peak LEDs | Seven stereo steps −20, −10, −6, 0, +6, +10, +17 dBu; mono peaks before LEVEL | pp. 1–2, documented |
| Rear power / USB | Rear power outside photo; virtual USB playback input and record monitoring, no OS device control | p. 2, documented control; simulated connection |

All 24 programs have audible browser implementations of their effect families.
Reverb impulses, modulation, distortion, pitch shifting and parameter ranges are
practice approximations, not Yamaha firmware models. No physical fidelity claim.
Power switching pops, thermal/electrical behaviour, drivers, real hardware and
actual USB recording are unsupported. USB recording can be listened to/metred.

## Implementation

React/TypeScript/Vite in the existing monorepo; shared manual split view and shell.
The photo is cropped at (165, 78) to 1155 × 1344; geometry maps original photo
measurements to percentage rectangles relative to this exact crop.
Every knob and switch overlays the exact physical position; sockets select input
or toggle virtual output connections. Small screens scroll a uniformly scaled desk.

One reducer owns settings and explicit actions. PROGRAM receives monotonic time;
new turns replace pending selection; timeout clears preview; power-off cancels it;
power-off blocks PROGRAM edits but analog knobs remain movable. No other timed
operations. Pointer capture, cancellation, blur and lost capture stop dragging.

One Web Audio graph owns deterministic looped sources, local decoded files,
gain/HPF/EQ/compression, stereo matrix, sends/returns and output taps. Analyser
samples drive meters; the browser listening attenuator is after all meter taps.
Only one selected output is audible. Audio starts from an explicit user gesture.

Versioned localStorage includes knob/switch positions, source descriptors, program
parameters and virtual connections; excludes power, pending selection, playback,
AudioContext and file bytes. Reloaded files are explicitly missing until relinked;
they never become generated audio. Import request IDs reject stale decodes.

## Milestones and completion

1. Prove mono gain-to-meter and monitor-only USB routing with measured signals.
2. Cover all panel controls, effects, program confirmation, attenuator and persistence.
3. Browser-check routing, HPF/EQ, file relink, drag/wheel/keyboard and manual view;
   inspect desktop/mobile alignment; clean install/build; existing regression suite.
4. Add library/navigation route; publish with existing Pages workflow and verify
   the live page, assets, audio and PDF. Add the verified live README link.

Physical verification questions: confirm program-selection
timeout, encoder wrapping and rapid-press interval; compare equal-power pan,
compressor and FX parameter curves with the owner's desk.
