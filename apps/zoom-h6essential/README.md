# Zoom H6essential

**[Open the live simulator](https://hollag.github.io/simulators/zoom-h6essential/)**

Photo-based recording practice in the practicedesk collection. Built from the supplied 142-page operation manual and front-panel image; see [DESIGN.md](DESIGN.md) for page evidence and accuracy limits.

From the repository root:

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5300/zoom-h6essential/** for local development.

## First take

1. Click POWER. MIC is armed initially; press 1–4 to arm more inputs.
2. Press MIXER. Turn the side dial, ENTER, adjust the level, ENTER. Press MIXER to return.
3. Press REC. Select Mark with the dial and press ENTER. STOP saves the take.
4. PLAY starts playback. Tap REW/FF to jump between marks and files; hold to search.
5. Download individual or mixed 32-bit float WAV files from Session Takes.

The selection dial supports dragging, scrolling, arrow buttons and keyboard ↑/↓. ENTER confirms; the screen is read-only. The shared Split view opens the bundled manual without interrupting practice.

## Implemented

- Physical track, transport and mixer controls; side dial/ENTER and front-end POWER/HOLD.
- Six generated audio channels, real Web Audio meters, headphones, and stored-waveform playback.
- Lo Cut, phantom gating for simulated condenser sources, MIC mono mix, stereo link.
- 44.1/48/96 kHz, Pre/Post Mixer recording, marks, file selection and confirmed trash.
- IEEE float WAVs; automatic stereo mix omitted at 96 kHz, following the manual.
- Validated local settings, accessible controls, dark mint layout and enlarged LCD.

Takes are session-only, up to eight recordings of 60 seconds each. Download before reload/reset. Input selection is fixed while recording. Source audio, filter response, defaults and some edge behaviour are provisional. USB, wireless/timecode, MS decoding, pre-record, start tones, iXML, A–B repeat and system menus are unsupported. The external download UI is a practice utility, not a reproduction of the hardware Export menu. Physical recorder fidelity has not been verified.

## Checks

```sh
npm run test --workspace=h6essential-simulator
npm run test:browser --workspace=h6essential-simulator
npm run build
npm run test:site
```

Logic tests cover operation interruptions, HOLD, marks, seeking, persistence validation and WAV headers. Chromium tests exercise controls, actual sample differences, playback, downloads, manual loading and small-screen layout. The combined-site test checks the production URL prefix and bundled assets.
