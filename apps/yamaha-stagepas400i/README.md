# Yamaha STAGEPAS 400i

A browser practice version of the 400i powered mixer, built from the supplied
Yamaha owner's manual and rear-panel photo. Includes all six strips, clickable
connections, real Web Audio signals, meters, EQ, four approximate reverb families,
phantom power, Hi-Z, stereo/mono, monitor/sub outputs and seven adaptive notches.

From the repository root:

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5300/yamaha-stagepas400i/**. For this app alone:

```sh
npm run dev --workspace=stagepas400i-simulator
```

## First practice

1. Click **Load demo band**, then **Start audio**.
2. Balance the white channel LEVEL knobs. Drag vertically, use the wheel or arrow
   keys. Double-click resets a knob; Home/End set its limits.
3. Change MASTER LEVEL, then listen to MONITOR OUT to hear its independent mix.
   Connect its virtual jack if needed. Browser listening volume is separate.
4. Raise CH 1 REVERB and press REVERB ON. Turn TYPE/TIME through HALL, PLATE,
   ROOM and ECHO. Connect FOOT SW and use **Tap footswitch** to toggle the effect.
5. Click an input jack to pick a source or load a local audio file. Practise
   MIC/LINE selection, condenser phantom power and CH 4 phone-input Hi-Z.
6. Connect a virtual subwoofer to hear the speakers' 120 Hz bass cut. Select
   the feedback test source and enable FEEDBACK SUPPRESSOR to hear a notch learn.

**Split view** opens the supplied manual beside the desk without resetting it.
Zoom/scroll preserves the layout on small screens. **Hit targets** shows calibration.

## Session and accuracy

Settings and virtual connections save in this browser. On reload, power and reverb
start off and learned notches clear. Local files loop in the current tab only;
their names restore with **Relink file** and silence until selected again. Files
are decoded locally and are never uploaded. Unsupported saved versions are kept.

Documented routing follows the supplied two-page foldout: phone beats RCA on
5/6; mini beats phone on 7/8; USB always adds to 7/8. Monitor is independent of
master level and branches before master EQ/FBS, as in the block diagram.

Analog tapers, mono summing gain, SPX algorithms/times, master EQ, feedback
detection, crossover slopes, amplifier limiting and digital meter calibration
are practice approximations. No physical-hardware fidelity claim is made.
Thermal/short-circuit protection, speaker acoustics, actual USB/iPod protocols,
charging and live microphone capture are unsupported.

See [DESIGN.md](DESIGN.md) for source evidence and [VERIFICATION.md](VERIFICATION.md)
for checks. Web Audio filter implementation follows the browser API's
[Q conventions](https://developer.mozilla.org/en-US/docs/Web/API/BiquadFilterNode/Q).

```sh
npm test --workspace=stagepas400i-simulator
npm run test:browser --workspace=stagepas400i-simulator
npm run build
npm run test:site
```
