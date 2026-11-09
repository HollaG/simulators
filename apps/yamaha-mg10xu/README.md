# Yamaha MG10XU

Interactive photo-panel practice mixer, based on the owner's supplied MG10XU
manual (March 2024) and photo. See [DESIGN.md](DESIGN.md) for source pages,
control contracts and provisional behaviour.

From the repository root: `npm install`, then `npm run dev`. Open
http://127.0.0.1:5300/yamaha-mg10xu/.

## Practise

1. Load the demo band and start audio. Adjust browser listening volume separately.
2. Set CH 1 GAIN and LEVEL, try HPF and COMP, and watch the real audio meters.
3. Wheel PROGRAM to preview, then click/Enter to commit. Raise channel FX and FX
   RTN LEVEL with FX ON. Dragging PROGRAM while held commits immediately.
4. Select USB for CH 9/10; set TO MON and engage STEREO MUTE. Listen to PHONES
   to hear only the computer return. USB RECORD remains the pre-master main mix.
5. Connect the virtual footswitch and press it: the FX lamp blinks during bypass.
   Press PROGRAM five times quickly to adjust USB attenuation; press again to exit.

Knobs support drag, wheel, arrows, Home/End and double-click reset. Shift gives
finer dragging or larger wheel/keyboard steps. Click input sockets to configure
sources; output sockets toggle virtual connections. Rear controls appear below
the photograph. The manual is available alongside the desk or in a separate tab.

## Implemented and verified

- Four mono and three stereo strips; phone/RCA priority, LINE/USB selection,
  L/MONO on 9/10, phantom-dependent condenser sources.
- Gain, 26 dB PAD, 80 Hz HPF, two/three-band EQ, CH 1–2 compression, pan/balance,
  channel levels and FX sends; actual audio samples drive peak and output meters.
- All 24 FX families, turn/press selection, timeout, per-program parameter recall,
  FX return, footswitch bypass and USB playback attenuator.
- Separate main/monitor/phones/FX/USB recording taps. Stereo master leaves USB
  record unchanged; stereo mute leaves the main mix and direct 9/10 monitoring intact.
- Generated signals, session-only imported audio and versioned settings storage.
  Reload starts with power off. Missing file descriptors remain silent until relinked.
- Logic tests plus browser audio/input tests; desktop/mobile and production-prefix
  site checks are included in the monorepo CI.

## Accuracy limits

Effects are audible browser approximations of their families, including granular
pitch shifting. They are not Yamaha SPX emulations. Analog pot laws, filters,
compressor curves, pan law and dBu calibration are approximate. Program preview
expires after a provisional five seconds; rapid presses use a one-second window.
FX sends tap after LEVEL and before pan; CH 9/10 still sends FX in TO MON,
so keep that send at zero when isolating a DAW return. These taps and the
compressor-before-EQ order follow [Yamaha's block diagram](https://usa.yamaha.com/files/download/other_assets/2/1507032/MG10XU_technical_specifications_En_B0.pdf).
No hardware,
microphone capture, drivers, electrical faults or actual USB device recording.
The USB record signal can be monitored and metered in the browser.

Local files do not survive reload; the UI explicitly requests relinking. File bytes
and playback position are excluded from settings. There is no preset-memory feature
on the physical mixer; browser session restoration is a practice convenience.

## Check

```sh
npm run test --workspace=mg10xu-simulator
npm run build --workspace=mg10xu-simulator
npm run test:browser --workspace=mg10xu-simulator
```
