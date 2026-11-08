# Mackie ProFX22v3 practice desk

**[Open the live simulator](https://hollag.github.io/simulators/mackie-profx22v3/)** · [All simulators](../../README.md)

A browser simulator built with React, TypeScript, Vite and Web Audio. It uses the
supplied top-panel photo and July 2024 ProFXv3 series manual. Runs locally; no
account, server, microphone permission or connection to a mixer is needed.

## Run

The monorepo requires Node.js 24 or later. From the repository root:

```powershell
npm.cmd install
npm.cmd run dev
```

Open http://127.0.0.1:5300/mackie-profx22v3/.
Click **Load demo band**, then **Start audio**. All six demo sources are synthesized;
the vocal source is a vocal-like synthesizer, not a recording.

## Practice

- Select a channel by clicking its input jack, tape label, knob or fader.
- Drag knobs vertically, use the mouse wheel, or focus a control and use arrows.
  Shift makes dragging finer and keyboard/wheel adjustments larger. Home/End
  select the minimum/maximum. Double-click resets EQ/pan to neutral, sends to
  off, and faders to unity. The inspector allows direct numeric entry.
- Raise channel and main faders, check the L–R assignment, then practise mute and
  constant-power pan. Use PFL and choose **Headphones** in the listening selector
  to hear a channel independently of its mute and fader. PFL leaves main unchanged.
- For groups: assign channels to 1–2, release their L–R assignments, and engage
  the subgroup's L–R switch. Its fader now controls those channels together.
- For monitors: raise a MON1 send, listen to MON1, and lower its channel fader.
  The monitor is unchanged. MON3 has a per-channel pre/post switch.
- For effects: raise a channel's FX send and the FX return. Turn the FX encoder to
  preview, then push to confirm within ten seconds. Arrows and Enter also work.
- Import your own audio into a selected channel. Files loop, stereo is retained
  on stereo strips, and mono channels sum stereo files to mono.
- Expand **USB returns & practice tools** to load virtual USB playback sources,
  exercise USB3–4 replacement and the headphone blend, or use the virtual pedal.

On phones/tablets, scroll the console horizontally; zoom scales the physical
layout uniformly. The inspector remains readable below it.

## Storage and accuracy

Settings and source identities save in versioned localStorage. Imported audio
buffers are **session only**; after reloading the app shows missing filenames and
requires explicit relinking. Audio never resumes automatically. Clear desk and
Load demo band replace the current configuration. These are simulator tools,
not controls on the physical device. Unsupported saved versions are preserved.

Routing follows the manual, especially pp. 14–21 and block diagrams pp. 33–34.
The meter reference is a chosen mapping: **0 dBu = −18 dBFS**. Output listening
attenuation does not affect the simulated meters. The native browser compressor
has its own makeup gain; compression, filters, control tapers and all 24 FX
algorithms are approximations, not measurements of Mackie circuitry or GigFX.

Hi-Z is a practice setting with no electrical loading effect on decoded audio.
Condenser sources require the virtual phantom switch. External inserts, actual
USB recording/playback drivers, microphone capture and real hardware I/O are
unsupported. No physical console comparison has been performed.

See [DESIGN.md](DESIGN.md) for the control/evidence contract and
[VERIFICATION.md](VERIFICATION.md) for implementation and verification status.
Mackie and ProFX are their owners' trademarks; this is an unofficial simulator.
The panel artwork was supplied locally as `355724-ProFX22v3_Top__14307.webp`.

## Deployment

Pushes to `main` run the tests, build the app and deploy it to GitHub Pages through
[the deployment workflow](../../.github/workflows/pages.yml). Pages must use **GitHub
Actions** as its publishing source. The build derives its URL prefix from Pages
metadata, so local development continues to work at `/`.

## Checks

```powershell
npm.cmd run build
npm.cmd test
npm.cmd exec playwright install chromium
npm.cmd run test:browser
```

The browser tests use real Chromium audio graphs and check analyser outputs,
pointer/keyboard input, file import, local restoration, and desktop/mobile layouts.
They do not prove physical hardware fidelity or the quality of audible playback
on a particular speaker. Screenshots are written under `scratch/`.
