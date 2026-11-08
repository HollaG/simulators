# How the Mixer Plus simulator was built

This is the worked example behind the skill. Apply the method to another device; do not inherit the Mixer Plus control rules or feature set without evidence.

## 1. Start from the owner's request

The owner supplied a CineTreak Mixer Plus PDF manual and a top-down product image, and wanted to practise at home. The requested first deliverable was a plan describing the mixer, its functions, and the implementation. The workspace initially contained no app.

We read the manual before building, including rendered pages because front-panel tables and LCD layouts were image-only. We identified four HDMI inputs, preview/program operation, transitions, keyers, picture-in-picture, logo, audio mixing, monitoring/routing, PTZ, memories, and system settings.

We used Node tooling (`pdfjs-dist` and `@napi-rs/canvas`) in a temporary directory to extract text and render selected pages. We inspected the diagrams and LCD screenshots, not just search summaries. The helper in this skill reproduces those document-inspection steps.

## 2. Establish the hardware corrections

The manual's row labels conflicted with the photographed console and operating section. The owner confirmed:

- Top source row is PGM; bottom source row is PVW.
- There is no T-bar.
- The chroma section's yellow-indicator sentence should name CHROMA, not LUMA.
- The logo section's yellow-indicator sentence should name LOGO, not DSK.

We updated `DESIGN.md` as each correction arrived and stopped listing those facts as unresolved. The important habit is to retain an explicit correction record; the particular corrections apply only to this Mixer Plus.

## 3. Turn the manual into a build plan

The plan described each physical control and context, the LCD multiview/single/menu screens, shared video inputs, effects, audio, virtual PTZ, and saved configurations. It also distinguished documented settings from unknown firmware behaviour.

A review exposed gaps that would affect the reducer and compositor. We added explicit provisional decisions:

- CUT/AUTO perform a true background/upstream-state swap.
- CHROMA/LUMA/PIP enables move with the bus scene.
- DSK/LOGO remain above the transition on their own preview/program buses.
- Repeated AUTO/source changes during AUTO are ignored; CUT completes it once.
- FTB is an independent fade, reversible from its current opacity.
- STILL freezes one shared program input until released.
- Clean taps and MEM contents have an explicit definition.

These decisions were not verified firmware facts. They were recorded so coding could proceed and later console comparisons could correct named helpers without rewriting the whole UI.

We reduced stage 1 to panel/hotspots, procedural inputs, one shared compositor, preview/program, CUT, MIX/AUTO, and multiview. Later stages added menus/transitions, layers, audio/cameras, and persistence.

## 4. Extract usable panel art

The front-panel diagram contained yellow annotations, while the manual cover embedded a clean console image. We extracted and cropped the clean cover image to `public/console.png`, 730 by 421 pixels.

We stored percentage coordinates for the LCD, 25 buttons, two knobs, joystick, and five LEDs in `src/panel-layout.json`. The image and all overlays share a container and aspect ratio. The LCD photo was covered completely by the simulated screen; baked-in lights were covered by dynamic LED states.

The image is a reference surface. Real HTML buttons supply interaction/focus, and generated CSS/Canvas overlays supply illumination and screens. We did not need a 3D scene for a fixed top-down console.

## 5. Build the state and menu model

The app used React, TypeScript, Vite, and plain CSS. The serializable state held buses, effect enables, parameters, mode, menu cursor/editing, operation descriptors, lock/power, camera poses/presets, memories, and media IDs.

One reducer routed physical actions in order: power/lock, camera/preset mode, running-operation restrictions, normal operation. Named switching helpers handled swaps and stale completion IDs.

The menu registry supplied defaults, bounds, increments, options, and parameter IDs to one LCD menu renderer. We populated the ten documented menu groups and kept knob navigation, editing, back/exit, and OSD timeout in the device UI.

Physical controls supported click, wheel/vertical drag, held joystick/zoom, keyboard alternatives, and long-press power. Release/cancel/blur stopped held movement. A small set of equivalent encoder buttons below the panel made knob operation discoverable without changing the device screen into a form.

## 6. Generate shared practice signals

We generated four deterministic video scenes: wide stage, studio close-up, titles on black, and a presenter on green. These avoided sourcing/licensing four event clips and gave repeatable motion and keying inputs. Generated PATs/logos completed the graphic library.

Each source was drawn once per timestamp and shared across thumbnails, preview, program, and AUX. Virtual PTZ transformed the source crop; STILL captured pixels rather than pausing a label or redrawing a fake frozen picture.

One WebGL context composed upstream keys/PIP, transitions, downstream graphics, FTB, and clean taps using intermediate framebuffers. A final atlas supplied every display. Canvas 2D copies and a shared display model produced the built-in LCD, enlarged LCD, and PGM/AUX monitors.

We implemented 30 visual transition choices using reusable shader families. They remain approximations; the manual did not fully specify all firmware geometry/easing.

## 7. Add audio, cameras, and saved media

Six generated quiet audio signals fed real Web Audio gain/delay/gate/analyser paths. AFV followed the provisional background-source rule. Program/master and headphone monitoring had separate paths, with only the selected audible monitor sent to speakers.

Channel settings changed the sound and meters. Imported video/audio used its actual signal, and a silent file stayed silent. Start practice supplied the browser user gesture needed to resume audio.

Positive delays worked. Negative HDMI delay was retained in the menu but applied as 0 ms and disclosed as unsupported audio advance. This was a deliberate first-version limitation, not full fidelity.

Virtual PTZ included four cameras, four saved positions per camera, movement, zoom, and approximate image settings. Preset-mode row presses did not cut the live video.

Versioned localStorage stored settings and four MEM slots. IndexedDB stored imported media blobs; memories referred to stable IDs. We tested a saved configuration containing a custom logo across a reload.

## 8. Check real behaviour in the browser

We used Vitest for the reducer and Playwright with installed Chrome for browser sequences/screenshots. A development-only clock/state interface let tests step operations deterministically. We later added a rendered-frame acknowledgement so pixel comparisons did not race React/rendering.

Two instructive rendering/test findings:

1. A fade-to-black test found a thin coloured edge borrowed from adjacent atlas images during Canvas 2D scaling. A half-texel source inset fixed the actual sampling problem.
2. Keyed-versus-clean output checks needed to wait for the desired frame and tolerate tiny one-unit colour rounding from extra framebuffer passes. Comparing enormous PNG data URLs produced noisy failures, so the test used compact visual statistics.

The completed implementation passed 19 state tests and 11 browser tests. Those counts describe this build, not a minimum every simulator must reach. Tests covered the core operating rules, real wheel input, effect LEDs, actual freeze/black pixels, chroma versus clean output, transition rendering, camera presets, audio meters/mute, persisted media recall, and mobile reachability. A production build was checked separately.

## 9. Deploy only after it was requested

The initial delivery was local with run instructions and screenshots. The owner later pushed to GitHub and specifically requested GitHub Pages.

We inspected the actual remote/default branch/access, read current official Pages/Vite guidance, and added `.github/workflows/pages.yml`. Its jobs tested and built the app, uploaded only `dist/`, then deployed using the Pages environment and permissions.

We made the Vite base path configurable from Pages metadata and used `import.meta.env.BASE_URL` for the runtime panel image and home link. Vite rewrote HTML script/style/favicon paths. We checked the production build at `/simulator-cinetreak-mixer-plus/` before deploying.

The first clean GitHub runner failed because Node type definitions were not declared explicitly. Local incremental builds had hidden the gap. We added `@types/node` and the `node` compiler types, performed a clean install and forced type check, and pushed the scoped correction. A local Vite process holding a native module open during installation was identified, stopped, and restored rather than killing unrelated Node processes.

The next workflow passed. We opened the live URL, checked the console artwork/LCD, performed a preview selection and CUT, and saw no browser errors. Subsequent pushes to `main` now redeploy automatically.

## What to carry to the next simulator

Carry forward evidence-first planning, owner corrections, a calibrated physical surface, explicit operating contracts, deterministic signals, shared rendering, focused tests, and separate live-deployment verification. Reuse small helpers where they fit. Re-establish the actual hardware controls, menu hierarchy, signal pipeline, fidelity limits, and hosting authorisation for each new device.
