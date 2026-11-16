# Nanlite FC-120B

**[Open the live simulator](https://hollag.github.io/simulators/nanlite-fc120b/)**

Photo-based rear-panel practice simulator using the supplied English owner manual.
Includes CCT/dimming, five CCT presets, blackout/restore, all 14 effect entries,
manual storm/explosion triggers and onboard settings. The enlarged LCD mirrors
the panel. An illustrative studio preview responds to light settings and fan caps.

From the repository root:

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5300/nanlite-fc120b/. Standalone:
`npm run dev --workspace=fc120b-simulator -- --port 5306`.

Turn knobs by dragging vertically, scrolling, or focusing and pressing arrow keys.
Page Up/Down changes ten steps. Click/Enter presses a knob. MODE switches CCT and
EFFECT; MENU opens settings and returns. In effects, turn right to choose a field,
then turn left to edit it. Select the EFFECT name to choose another effect.

Try power → warm CCT → dim → left press twice → MODE → CCT LOOP → right turn
to SPEED → left turn. Then MENU → FAN CONTROL → OFF → right press to confirm:
the preview observes the documented 15% maximum power cap.

Settings save in versioned browser storage; reload starts powered off. Power,
blackout, menus and trigger timing are transient. Reset is available through the
hardware menu or the outside practice-session button. Split view opens the bundled
PDF without resetting the fixture.

Checks: 26 logic tests; four device browser sequences covering wheel, drag,
keyboard, pointer cancellation, output pixels, manual triggers, menus, fan caps,
rotation, persistence and storage failures. Desktop and 390/760px screenshots
inspected. The combined site has a production-prefix route/asset/manual test.
Repository verification passed: all 81 logic tests, the full combined build and
14 production-site browser tests. The development hub proxy was also exercised.
GitHub Pages workflow [43879541055](https://github.com/HollaG/simulators/actions/runs/43879541055)
passed the full collection's checks and deployed successfully. Live checks covered
the library link, photo/PDF assets, CCT/presets, wheel input, blackout/restore,
output, fan caps, effects, manual split view, persistence, mobile layout and home.

```sh
npm run test --workspace=fc120b-simulator
npm run build --workspace=fc120b-simulator
npm run test:browser --workspace=fc120b-simulator
```

DMX/radio menus are navigation practice only. No hardware, Bluetooth, Nanlink,
USB updates, electrical simulation or calibrated photometry. Exact firmware
waveforms, defaults, dial increments, range-edit gestures, Chinese translations
and the provisional brightness range 1–5 require physical comparison. Reset is
immediate here. The manual's sample firmware version is not the owner's version.
See [DESIGN.md](DESIGN.md) for page evidence, discrepancies and behaviour contracts.
