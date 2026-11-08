# Mixer Plus practice simulator

**[Open the live simulator](https://hollag.github.io/simulators/cinetreak-mixer-plus/)** · [All simulators](../../README.md)

A local browser simulator of the CineTreak Mixer Plus. The fixed console uses artwork extracted from the supplied manual, with clickable keys, scrollable/draggable knobs, a five-way joystick, dynamic LEDs, and a live LCD.

## Run

Use Node.js 24 or later. From the repository root:

```powershell
npm.cmd install
npm.cmd run dev
```

Open http://127.0.0.1:5300/cinetreak-mixer-plus/. Click **Start practice** to enable audio. Video works before audio is enabled. Use **Help** for the control guide and **Expand monitors** to enlarge the LCD and see the PGM/AUX ports.

## GitHub Pages

Live app: **https://hollag.github.io/simulators/cinetreak-mixer-plus/**

The [deployment workflow](../../.github/workflows/pages.yml) tests both simulators, builds the complete website and deploys `dist/` on each push to `main`. It can also be run manually from the repository's Actions tab. GitHub Pages must use **GitHub Actions** as its publishing source under Settings → Pages.

The root build supplies `VITE_BASE_PATH` for each app and `VITE_SITE_BASE` for shared navigation using GitHub's Pages metadata.

To preview the Pages build locally in PowerShell:

```powershell
npm.cmd run build
npm.cmd run preview
```

Open http://127.0.0.1:4173/simulators/cinetreak-mixer-plus/. Media imports and saved memories remain in each visitor's browser; they are not uploaded to GitHub.

## Controls

- **Top row: PGM. Bottom row: PVW.** Select a preview source, then CUT or AUTO. There is no T-bar.
- Scroll or drag either knob vertically. Click to press. The right knob navigates menus; MENU returns one level. The controls below the panel also turn/press the menu encoder.
- The left knob chooses CHROMA/LUMA/PIP/DSK/LOGO. KEY toggles preview; ON AIR toggles program. Green/red/yellow indicate preview/program/both.
- CAM enables the virtual PTZ camera. Hold the joystick or zoom buttons. In CAM + POS, PVW saves presets and PGM recalls them. Choose the camera in the PTZ menu.
- Short lock/power press locks/unlocks. Hold for two seconds to power off. A short press powers on again.
- System → MEM saves four configurations. MEM recalls the selected slot. Reset returns the working desk to defaults and retains saved slots/media.
- **Sources** loads local video, image, or audio files. PAT and LOGO slots accept images. Local imports use IndexedDB and remain in this browser.

Shortcuts: **1–4** preview; **Shift + 1–4** program; **Space** CUT; **Enter** AUTO/menu confirm; **M** menu; **Escape** back; **F** FTB; **arrow keys** menu encoder or joystick.

## Implemented

- Four deterministic animated demo sources, two PATs, four logos, emergency colour/bars.
- One WebGL context for shared inputs, MIX/DIP and 28 other transition approximations, upstream chroma/luma/PIP, downstream DSK/logo, masks, crop/border/position, clean outputs, FTB, and actual input-frame freeze.
- LCD multiview, routed single view, purple-highlighted hardware menus, program/preview tally, gain settings, actual signal meters, camera/logo/transition status, optional enlarged monitors, and portrait monitoring layouts.
- Six real Web Audio signal paths, channel/master levels, Off/On/AFV, positive delays, mic/line modes, approximate ALC, and headphone monitoring. Built-in tones are intentionally quiet. Local media uses its own audio and does not get a substitute tone.
- Virtual PTZ pan/tilt/zoom, four presets per camera, focus/exposure/white-balance approximations, simulated discovery/IP, menus, lock/power, and versioned local settings/MEM/media persistence.
- English/Chinese LCD menu labels, OSD expiry, brightness settings, input flips, and virtual port/system settings.

## Accuracy limits

The owner-confirmed row labels, missing T-bar, and CHROMA/LOGO LED corrections are implemented. Other hardware behaviour follows the provisional contracts in [DESIGN.md](DESIGN.md), particularly upstream bus swaps, downstream overlay retention, STILL scope, clean outputs, and interrupted transitions.

The 30 transition choices are visual practice approximations, not a verified firmware catalogue. ALC and camera image adjustments are approximate. PTZ and network/format settings affect virtual hardware; the app does not connect to the physical mixer or produce HDMI/USB outputs.

Negative HDMI delay is stored/displayed for menu practice but applied as 0 ms: audio advance is unsupported. Positive delays actually affect the signal. A stored file can be missing if browser storage is cleared; Sources lets you relink it. Microphone capture and licensed real event footage are optional future additions.

The reference [manual](docs/Mixer-Plus-User-Manual.pdf) is outside public build assets. Console artwork is used for personal practice.

## Checks

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run test:browser
```

Browser tests use Playwright Chromium. Tests cover operating sequences and screenshots, actual rendered freeze/black output, audio meters, and a saved MEM containing imported media across reload. They verify the simulator's chosen behaviour, not physical-console fidelity.

The development build exposes `window.__mixer` for deterministic clock/state testing. The production build excludes it.
