# Yamaha STAGEPAS 400i practice simulator

The supplied Yamaha 400i (not 400BT or 600i) is an eight-input portable PA with
four mono microphone/line strips and two stereo strips. The normal rehearsal is:
connect sources, lower levels, select MIC/LINE, power on, raise master and channel
levels, balance the mix, shape EQ, and add reverb. There is no screen or menu.

## Evidence and control contract

The supplied `stagepas400i_en_om_c0.pdf` is a two-page foldout. References below
use PDF pages 1 and 2; the sheets have no separate printed page numbers. The
photograph establishes physical positions. No owner corrections have been given.

| Control / connection     | Behaviour and feedback                                                                            | Evidence / status                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Power, AC input          | Power LED follows power and virtual AC. Physical knob/switch positions remain; reverb starts off. | p1 controls 18, 24–25, 13; documented                           |
| MIC/LINE 1–4             | MIC is 26 dB more sensitive than LINE.                                                            | p1 control 2, p2 input table; documented                        |
| Hi-Z 4                   | Affects phone input only, for passive pickups.                                                    | p1 control 3; documented; loading response approximate          |
| HIGH / LOW on six strips | Shelves at 8 kHz / 100 Hz, ±15 dB.                                                                | p1 control 12, p2 specifications; documented                    |
| Six channel levels       | Independent channel volume, minimum silent.                                                       | p1 control 20; documented; taper provisional                    |
| REVERB sends 1–4         | Post-channel-level sends; stereo inputs have no send.                                             | p1 control 15, p2 block diagram; documented                     |
| ST/MONO 5/6, 7/8         | Stereo preserves sides; mono averages them to both outputs.                                       | p1 control 16; documented; summing gain provisional             |
| Phantom CH1/2            | +30 V; virtual condenser mics require it. Does not power CH3/4.                                   | p1 control 10, p2 specs; documented                             |
| Reverb on / footswitch   | Momentary toggles; LED follows enabled state; power-up resets off.                                | p1 controls 7, 13; documented                                   |
| Reverb TYPE/TIME         | Clockwise HALL → PLATE → ROOM → ECHO; time increases within each region.                          | p1 control 14 + photo; documented; algorithms/times provisional |
| Feedback suppressor      | Seven adaptive notch filters; reset on disable or power-off.                                      | p1 control 19; documented; detection/Q provisional              |
| Master EQ                | Speech cuts bass, MUSIC is flat, clockwise adds bass; extreme end lights bass boost.              | p1 control 21; documented; curve/threshold provisional          |
| Master level             | Controls speakers and sub, independent of monitor level.                                          | p1 controls 6, 11, 22; documented                               |
| Monitor output           | Mix including reverb, before master EQ/FBS and master level; L-only sums L+R.                     | p1 control 5, p2 block diagram; documented                      |
| Subwoofer output         | Mono, follows master; insertion high-passes speakers at 120 Hz.                                   | p1 control 6; documented; filter slopes provisional             |
| Speaker meter / limiter  | Measured post-master speaker signal; limiter LED from pre-limiter level.                          | p1 control 17; documented; digital calibration provisional      |
| 5/6 phone vs RCA         | Phone connection wins, even if its source is silent.                                              | p1 control 4 note; documented                                   |
| 7/8 phone vs mini        | Mini connection wins; USB always adds to the selected analog source.                              | p1 controls 4, 9; documented                                    |
| Jacks                    | Click source jacks to configure connections; click output/AC jacks to connect/disconnect.         | photo + p1; practice UI convention                              |

## Implementation

Independent React/TypeScript/Vite workspace in the existing collection, shared
header/manual split view, and no extra framework. The actual supplied photograph
is cropped at native `(310,380,1380,2430)` then rotated 90° counterclockwise into
`public/panel.webp`, 2430 × 1380. `geometry.ts` stores percentage hit rectangles
for this exact asset. Knobs, switches and LEDs cover their photographed state.
Uniform zoom and internal horizontal scrolling preserve the physical layout.

One reducer owns serializable controls and virtual connections. Controls can move
with power off, as on an analog panel. Power gates audio. Reverb/footswitch presses
while off do nothing. There are no timed hardware operations in this model.
Pointer drag ends on up, cancel, lost capture or blur. Keyboard arrows, Home/End,
wheel and double-click reset are supported; page scrolling remains available
outside knobs. Input routing is explicit rather than inferred from sound level.

Web Audio resources remain outside reducer state. Deterministic looping synthetic
voice, guitar, keyboard, music and test-tone sources feed connector gates, input
sensitivity/loading, two shelving EQs and strip levels. Stereo/mono matrices feed
the mix. Mono sends feed an approximate reverb/echo processor, returned to the mix.
The monitor branch precedes main DSP. The main branch has seven notch filters,
master EQ, master level, sub crossover and limiter. Analyser taps measure actual
speaker, monitor, sub and reverb signals. Listening selects one output with a
separate quiet browser listening volume; that setting never changes panel meters.

Settings use versioned localStorage with validation. All physical positions,
connections and source descriptions persist; power and reverb start off on reload,
and adaptive notch history clears. Browser audio never starts automatically.
Imported audio is decoded in memory only: its name/connection persists but reload
shows **Relink file** and remains silent until relinked. Blobs, playback position,
active audio nodes and zoom do not persist. No IndexedDB is needed for this explicit
session-only media scope. Unknown storage versions are preserved without writing.

## Milestones and checks

1. Real photo, live knobs, one source → channel EQ/level → main and independent
   monitor; prove changes with measured audio rather than animated meters.
2. Complete strips and routing, USB addition/analog priority, reverb, phantom,
   Hi-Z, virtual plugs, sub crossover, adaptive notches and limiter.
3. Integrate collection navigation/build, manual, source inspector, file relink,
   persistence, keyboard/touch handling, desktop/mobile screenshots and tests.

Completion is tracked in `VERIFICATION.md`. Browser/logic/build checks establish
simulator behaviour, not physical-unit fidelity. Hardware questions for later:
exact knob tapers, SPX timing/algorithms, master-EQ curves/bass LED threshold,
notch detection/release, crossover slopes, mono summing and meter/limiter calibration.
Unsupported: real hardware/USB protocol/charging, actual microphone capture,
feedback-room acoustics, thermal/short-circuit protection, loudspeaker enclosure
response, exact amplifier distortion and proprietary Yamaha DSP.
