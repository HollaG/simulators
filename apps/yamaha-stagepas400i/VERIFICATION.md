# Verification and accuracy

## Implemented

All physical knobs, switches, input/output jacks, the AC connection and status
LEDs have live controls or feedback. Source inspection and listening controls sit
outside the actual photo. The reverb switch behaves as a momentary toggle; other
switch positions and knob positions stay in place while the mixer is off.

| Area                                         | Verification                                                                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mono/stereo inputs, sensitivity and phantom  | Reducer tests; browser measurements show condenser gating and MIC/LINE level changes.                                                                  |
| Analog jack priority and additive USB        | Reducer tests and measured browser audio, including a connected but missing priority source.                                                           |
| Channel/master EQ, master/monitor separation | Browser test measures bass changes, independent monitor audio and silent main at zero master.                                                          |
| Reverb and footswitch                        | Browser test measures wet return, toggling and power-up reset.                                                                                         |
| Feedback suppressor                          | Browser test measures attenuation of a 1.1 kHz source and reset of learned notches.                                                                    |
| Subwoofer insertion                          | Browser test measures speaker bass cut while monitor stays unchanged.                                                                                  |
| Limiter                                      | Browser test measures overloaded input, bounded speaker output and the limiter indicator.                                                              |
| Output plugs / browser volume                | Browser test measures the final listening signal separately from the desk meters.                                                                      |
| Local audio                                  | Browser test decodes stereo and silent WAV files, verifies actual mono cancellation and reload relinking.                                              |
| Session                                      | Validated versioned restore, safe power/reverb defaults, unknown-version preservation and missing-file silence.                                        |
| Input / layout                               | Browser tests exercise drag, blur cancellation, double-click, wheel, keyboard, mobile zoom and manual split preservation.                              |
| Appearance                                   | Desktop and 390 px phone screenshots inspected; panel remains fixed, with internal scrolling and uniform zoom. Split view uses container-based layout. |
| Collection                                   | Library card, shared navigation, development proxy, production build and manual/PDF asset paths included.                                              |

Passed: 35 logic tests across the collection, 10 STAGEPAS browser tests,
22 existing-simulator browser tests, 8 combined-site browser tests, all
TypeScript/Vite builds, and `git diff --check`. Screenshots are generated
under the ignored root `scratch/screenshots/` directory. Development-only audio
inspection is excluded from production.

## Provisional and unsupported

The documented control meanings and routing come from the supplied manual and
photo. Digital meter calibration, analog tapers/mono gain, Hi-Z loading, master
EQ/bass LED threshold, reverb algorithms/times, feedback detection and crossover
slopes are approximate. Seven notch filters operate on measured spectral peaks;
they do not simulate an acoustic room or Yamaha's proprietary algorithm. Limiting
uses a compressor and smooth peak ceiling, not the real amplifier's protection.

No physical console, audible speaker/headphone listening session, live iPod,
touchscreen hardware, firmware, thermal protection or real USB behaviour was
verified. Automated Chromium audio measurements establish the browser graph's
behaviour; they do not establish exact Yamaha sound or physical hardware fidelity.
Imported blobs and playback positions deliberately do not persist.
