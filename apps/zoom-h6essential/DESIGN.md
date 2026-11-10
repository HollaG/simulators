# Zoom H6essential practice recorder

## Evidence and scope

Reference: user-supplied `E_H6essential_2.pdf`, ©2024, 142 pages. Printed page numbers match PDF page numbers. No firmware version or owner corrections have been supplied. Artwork: supplied 549 × 1381 front photo, uncropped. Side controls are separately labelled because their faces are not visible in that photo. Screen is not touch operated.

Practice: power on → choose inputs → arm tracks → MIXER, select/ENTER/adjust/ENTER → REC → dial to Mark/ENTER → STOP → PLAY → seek/mark navigation → download a take. The attached manual remains available in the shared split view.

| Control / setting | Contract and feedback | Evidence / status |
| --- | --- | --- |
| MIC, 1–4 | Arm tracks; red indicators; linked pairs switch together; playback only enables recorded tracks | pp.10,47,72; documented |
| REC / STOP | REC starts/stops; STOP stops and returns home | pp.10–11,67; documented |
| PLAY/PAUSE, REW, FF | Most recent take; pause/resume; tap mark/file navigation, hold search | pp.10–11,71–72; documented |
| MIXER | Opens/closes mixer; dial selects track; ENTER edits; dial changes Mute or −80…+40 dB | pp.23–24,60–61,73–74; documented |
| Dial / ENTER | Select and confirm; original screen hierarchy, simplified typography/icons | pp.12–13,16–26; documented |
| Power / HOLD | Cannot power off while recording; HOLD blocks device inputs while recording continues | pp.38–39,46; documented; switch presented as buttons |
| Input | Lo Cut Off/80/160/240, MIC mono mix, per-input phantom, Off/Stereo linking | pp.48–53; documented; MS omitted |
| Recording | 44.1/48/96 kHz, 32-bit float; Pre/Post Mixer; automatic stereo file only at 44.1/48 | pp.58,62,64; documented |
| Marks / Trash | Max 99; confirm trash, cancel continues operation | pp.69–70,83; documented |
| Headphone volume | Changes listening level, not recording | pp.58–59; documented; UI 0–100 scale provisional |

## State, sound and time

One reducer receives monotonic timestamps. Configuration is serializable; AudioContexts, buffers and analysers live outside state. Six deterministic generated signals drive actual Web Audio filters, monitor gain and meters. Condenser practice sources require their phantom switch. Quiet listening is opt-in. The screen and its enlarged copy read the same measured samples.

Recording captures source configuration, start phase and a timeline of mixer gain changes. OfflineAudioContext renders those same signals into six track channels plus the stereo mix. Pre Mixer files ignore monitor gain; Post Mixer follows it. Playback uses the rendered track samples, never a substituted live tone. IEEE float WAV downloads are per track (MIC stereo or mono, linked inputs stereo) and automatic stereo mix when available. Export is an external practice utility, not a claimed firmware export menu.

Versioned localStorage stores validated input/record/mixer settings. Takes, playback positions, power, HOLD, operations and audio enable are session-only. Reload starts powered off. No imported media or microphone permission is needed.

| During recording / rendering | Temporary rule |
| --- | --- |
| REC / STOP | Finalize once; rendering locks device controls; operation IDs reject stale results |
| MIXER / dial | Monitor gains can change during recording and are captured in the take |
| Track / source / input configuration | Fixed for this take; attempts to re-arm report the restriction (provisional) |
| HOLD | Stops held seek; recording keeps running; unlock remains available |
| Power | Recording rejects shutdown; rendering completes before shutdown is allowed |
| Reset | Clears session; invalidates pending render; stops sound |

## Milestones and completion checks

1. Photo overlays and core recording/mark/playback loop; logic tests for lock, power and interruptions.
2. Real metered audio, mixer, input settings, float WAV and playback; compare rendered samples for pre/post mixer, filtering and unarmed silence.
3. Shared library/build/dev/navigation/manual integration; production-prefix asset tests; desktop/mobile screenshots and keyboard/hold cancellation.

## Accuracy limits / provisional rules

- Source sounds are synthesized practice signals, not microphone or instrument models. Lo Cut uses a Web Audio biquad high-pass; hardware filter response is unverified.
- Defaults, 1 dB mixer increments, search speed, end-of-file pause, startup sequence, and linked-gain reconciliation are provisional. Verify these against the owner's recorder before claiming exact firmware behaviour.
- Takes are limited to 60 seconds each, eight takes per session, to bound browser memory; displayed capacity is the practice limit, not an SD-card estimate. Stopping on the limit is a simulator rule.
- No USB interface, timecode/Bluetooth, alternate capsules, MS decode, pre-record, start tone, iXML, A–B repeat, normalization, speed adjustment, SD formatting, system/accessibility menus, or hardware file recovery. Omitted menu categories are visibly labelled unavailable.
- Recording settings and source controls cannot change mid-take. Recording files remain in memory until reload/reset; downloads are the durable copy. Browser rendering adds a short save delay absent from real hardware.
- No physical hardware comparison or deployment is included in this build request.

## Completion checklist

| Area | Result |
| --- | --- |
| Panel, transport, mixer, supported input/record menus, takes and WAV downloads | Implemented |
| Recording interruption rules, marks, seek, storage validation and WAV encoding | 12 logic tests passed |
| Browser controls, audio samples, playback, downloads, manual, held seek and mobile layout | 5 Chromium tests passed; desktop and 390 px screenshots inspected |
| Collection integration | All 55 repository logic tests and 12 combined-site browser tests passed; production build and TypeScript checks passed |
| Firmware edge behaviour and analog/filter response | Provisional; no physical hardware comparison |
| USB, wireless/timecode and omitted menu functions listed above | Unsupported and disclosed in the app |
| Publication | Local implementation only |
