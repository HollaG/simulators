# Implementation and verification

Current checks pass: production build/type check, 8 reducer tests and 11 Chromium
browser tests. A separate production-preview smoke check loaded the 3000px panel,
ran demo audio with live meters, confirmed the development test bridge is absent,
and checked phone-width overflow without page errors or failed local assets.

Source of documented behaviour: user-supplied **ProFXv3_Series_OM2024July.pdf**.
Printed/PDF page numbers coincide. This status describes browser simulation,
not validation against a physical ProFX22v3.

| Feature                                                           | Implemented     | Verification / limits                                                                                   |
| ----------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------- |
| Photo geometry, all 18 strips                                     | Yes             | Desktop 1440px and phone 390px screenshots; fixed layout with scroll/zoom                               |
| Gain, filters, compressor and EQ                                  | Yes             | Measured tone response for gain/mid EQ/compression; native DSP curves/tapers provisional                |
| Mute and constant-power mono pan                                  | Yes             | Measured stereo output and muted sends                                                                  |
| PFL and Rude Solo                                                 | Yes             | Measured pre-mute/pre-fader signal; left meter only, main remains live                                  |
| Channel assignments and subgroups                                 | Yes             | Measured direct/subgroup/main routing and subgroup L–R assignment                                       |
| MON1/2 pre-fader; MON3 pre/post                                   | Yes             | Measured MON1/3 outputs while changing fader/mute; MON2 shares the MON1 signal structure                |
| FX send / return / routing / mute                                 | Yes             | Measured wet-only output and mute; all 24 programs are approximate Web Audio DSP                        |
| FX browse / push / 10s expiry                                     | Yes             | Reducer tests include expiry, repeated rotation, stale deadlines, late confirmation, power interruption |
| Phantom power and Hi-Z                                            | Yes             | Measured condenser source gating; Hi-Z setting only, electrical loading unsupported                     |
| Break                                                             | Yes             | Measured main attenuation, continuing monitor output and 21/22 bypass                                   |
| Stereo sources / hybrid mic-only gain                             | Yes             | Imported stereo left-only WAV retains channel separation; stereo line ignores mic gain                  |
| USB returns / monitoring blend                                    | Virtual sources | Measured USB3–4 override and USB1–2 blend overriding audible PFL                                        |
| CR / phones levels; output auditioning                            | Yes             | Real output paths and measured taps; listening attenuation is outside hardware model                    |
| Power / five-second FX warm-up                                    | Yes             | State/clock logic verified; no hardware comparison                                                      |
| Footswitch                                                        | Virtual button  | Follows panel-mute priority; no physical pedal I/O                                                      |
| File import / missing media                                       | Yes             | Silent WAV remains silent; reload retains filename and explicitly requires relink                       |
| Session restoration                                               | Yes             | Schema/type/range checks; no resumed playback or transient preview                                      |
| Mouse / touch / keyboard                                          | Yes             | Real mouse drag/wheel, keyboard, native Pointer Events; touch-device hardware untested                  |
| Physical measurements / external inserts / USB driver / recording | No              | Unsupported                                                                                             |

The first milestone (real gain → EQ → fader → mute/PFL routing over the panel)
and the subsequent channel/bus, source, persistence and responsive UI milestones
are implemented. Hardware sound, transfer curves and proprietary GigFX accuracy
remain provisional. Compare with the owner's physical desk before relying on
this as an exact operational reference.
