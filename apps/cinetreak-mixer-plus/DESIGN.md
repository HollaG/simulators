# CineTreak Mixer Plus simulator plan

Build a browser-based practice console with a fixed top-down view, the same control positions as the supplied image, working button lights, and a live simulated LCD. The goal is to practise operating the mixer: preparing a shot, checking preview, making a transition, managing overlays and audio, and controlling a virtual PTZ camera.

This document records the implementation plan and provisional hardware contracts. The local practice app is now implemented; see [README.md](README.md) for running it, available features, and current accuracy limits. Owner-confirmed facts are listed in section 2. Provisional behaviours remain subject to physical-console comparison.

## 1. What the mixer is

The **CineTreak Mixer Plus** is a compact four-input HDMI video production switcher. It combines video switching, image composition, audio mixing, monitoring, and PTZ camera control.

- Four HDMI inputs, supporting up to 1080p60.
- HDMI program and AUX outputs, plus a USB UVC output for a computer.
- A built-in LCD with multiview and selectable single-source monitoring.
- Two additional mic/line audio inputs and headphone/line monitoring.
- MIX, DIP, WIPE and other transitions; the manual advertises 30 effects.
- Chroma key, luma key, picture-in-picture, downstream keying, and a logo overlay; up to six program layers.
- Network PTZ camera control using VISCA, with saved camera positions.

**PGM (program)** is the live picture sent to the audience. **PVW (preview)** is the picture prepared before taking it live. For example: start with camera 1 on program, select camera 2 in preview, then press CUT or AUTO to take camera 2 live.

Primary reference: the supplied [Mixer Plus manual](docs/Mixer-Plus-User-Manual.pdf), especially printed pages 5–44. Printed page numbers are one below the PDF viewer's page numbers. The manufacturer's [product introduction](https://cinetreak.com/2025/12/03/cinetreak-officially-launches-the-mixer-plus-the-pocket-sized-professional-live-switcher-youve-been-waiting-for/) corroborates the main features. The local PDF is an unchanged reference copy, outside the app's public assets.

## 2. Console functions and simulated behaviour

Every physical front-panel button will have an interactive target. Its action depends on the current operating mode, as on the console.

### Owner-confirmed corrections

- **Top row = PGM; bottom row = PVW.** The reversed row labels on printed page 9 are incorrect.
- **There is no T-bar.** Exclude a transition slider and T-bar calibration. CUT and AUTO control transitions; the joystick controls cameras and positions. PTZ joystick calibration is a separate question.
- **CHROMA indicator:** section 7.5.1, printed page 28 / PDF page 29, incorrectly calls it LUMA in the yellow-indicator instruction. Use CHROMA.
- **LOGO indicator:** section 7.8.2, printed page 36 / PDF page 37, incorrectly calls it DSK in the yellow-indicator instruction. Use LOGO.

These corrections are settled and do not need further verification.

| Control | Behaviour to reproduce |
| --- | --- |
| PGM 1–4, upper row | Select an input directly on the program bus in normal switching mode. Selected source lights red. |
| PVW 1–4, lower row | Select an input on the preview bus in normal switching mode. Selected source lights green. |
| CUT | Immediately commit the bus exchange defined in section 4.1. True swap and layer participation remain provisional. |
| AUTO | Animate the selected transition over the configured duration, then commit the same exchange once. See section 4.2 for presses during a transition. |
| FTB | Fade program to black using its own duration; flash the indicator while active. Press again to return. Keep source assignments so operation can resume. |
| STILL | Capture and hold an input frame; indicate freeze with a red light. Use the explicit provisional source/release rules in section 4.3 until checked on the unit. |
| PAT | Select the configured background picture for the current preview layer. Two stored PAT images are available in the manual. |
| E-STOP | Select the configured emergency picture source in preview: a solid colour or colour bars. It is separate from FTB. |
| Left mode knob | Select CHROMA, LUMA, PIP, DSK, or LOGO. A short press enables position adjustment for PIP/LOGO, with a flashing indicator. |
| KEY | Enable or disable the selected effect in preview. |
| ON AIR | Enable or disable the selected effect on program. |
| MENU and right knob | Open and navigate settings; rotate to move/edit and press to enter/confirm. Provisional MENU/back behaviour is defined in section 4.5. |
| AUDIO | Open the audio controls through the hardware shortcut. |
| MV | Toggle multiview and the single source configured under Port → LCD output. Single view is not restricted to program. |
| MEM | Recall the selected saved mixer configuration. Store and select the four configuration slots through System → MEM. |
| CAM | Enter or leave PTZ control mode. Choose the camera through the PTZ menu; reproduce any additional selection shortcut after verification. |
| POS with CAM active | Enter camera-preset mode. PVW 1–4 save positions; PGM 1–4 recall them. These presses must not accidentally switch live video. |
| Five-way joystick | Move the virtual camera; when editing an effect, move PIP, logo, mask, or chroma colour-pick position instead. Centre press remains a distinct input. |
| ZOOM− / ZOOM+ | Continuously zoom the selected virtual PTZ camera while held. |
| Lock/power | Short press locks the panel with a flashing red indicator; long press simulates shutdown. Provisional unlock, hold duration, and allowed inputs are defined in section 4.2. |

For each effect indicator, the manual specifies **green = preview only, red = program only, yellow = both**. Selecting an effect with the knob must remain separate from enabling it.

### Settings and their visible effects

| Menu | Settings and expected result |
| --- | --- |
| Effect | MIX crossfades; DIP passes through a chosen colour/input/PAT; wipes reveal the incoming picture. Transition and FTB duration each range from 0.1–5.0 seconds, default 0.5 seconds. Softness changes the wipe edge. |
| Audio | Four HDMI audio channels with Off/On/AFV; two mic/line channels; program master and headphone source/level. AFV means audio follows the program video. Include delay, mic/line mode, and ALC controls. |
| PIP | Source, preset/custom size, position, crop, and border width/colour. Default source IN1 and size 1/3. Changing a setting changes the rendered picture. |
| Luma | Key and fill sources, brightness threshold, gain, inversion, and mask. |
| Chroma | Key source, sampled/custom colour, similarity, smoothness, and mask. Include a green-screen demo source. |
| DSK | Key source, threshold, gain, inversion, and mask for titles/graphics layered downstream. |
| PTZ | Virtual camera selection, IP/search settings, movement speed, focus, exposure, and white balance. Speed range 1–24; four saved positions per camera. |
| Image | Emergency colour/bars, PAT1–2, LOGO1–4. Use local file selection to simulate loading media. |
| Port | Separate PGM, AUX, and LCD routing; inputs, PAT, clean/composited buses, and multiview. Include landscape/90°/270° output layouts, output format, and input flips. |
| System | Language, OSD timeout, screen/button brightness, version, simulated network settings, MEM slots, and reset. Include PTZ joystick calibration only if confirmed on the unit. |

Important audio defaults: HDMI channels default to AFV; mic inputs default to On and Line mode. Input, mic, and program level controls range from −60 to 0 dB, normally defaulting to −6 dB. Headphone monitoring defaults to PGM at 0 dB. HDMI delay is documented as −30 to 500 ms, default 0; mic delay defaults to 30 ms with a 500 ms maximum. These values should be transcribed from the supplied manual rather than copied from another mixer model.

## 3. Visual and interaction design

### Fixed console view

- Centre the console on a simple dark desk background.
- Use the supplied product image as the panel background, retaining its proportions. Obtain a local copy during implementation, or extract the panel image from the PDF.
- Place native HTML buttons over the physical keys. Use percentage coordinates so the image and controls scale together.
- Cover the photographed LCD completely with a live display. Cover baked-in indicator colours with dynamic LEDs, including their unlit state.
- Add subtle pressed states and red/green/white illumination over the corresponding keys.
- Make both knobs draggable and scrollable, with click-to-press. Provide keyboard equivalents and labels.
- Support pointer capture and press-and-hold for the joystick and zoom controls. Pointer release/cancellation, window blur, lock, and shutdown must stop movement. Apply `touch-action: none` to knobs, joystick, and zoom controls so their gestures do not scroll the page.
- Keep hit targets and LED covers in a percentage-coordinate data file. Start with a development-only outline overlay; add drag/resize and JSON export if aligning the photo proves slow. Do not make a calibration editor a stage-1 dependency.
- Keep the viewpoint fixed. Allow uniform zoom/scroll on small screens instead of rearranging the console buttons.

A small toolbar outside the device provides **Start practice**, **Sources**, **Reset**, and **Help**. Start practice also unlocks browser audio playback. Help explains controls without replacing the mixer menus.

### Simulated LCD

Reproduce the manual's LCD layout, distinct from the external multiview layout:

```text
+---------------------+---------------------+
|         PVW         |         PGM         |
|  preview composite  |  live composite     |
+----------+----------+---------------------+
|   IN1    |   IN2    | IN1 IN2 IN3 IN4 dB  |
|          |          | PGM MIC1 MIC2 EAR dB |
+----------+----------+-------+------+------+
|   IN3    |   IN4    |  CAM  | LOGO | MIX  |
|          |          | speed |      | 0.5s |
+----------+----------+-------+------+------+
```

Include source labels, program/preview tally borders, input and output meters, signal format when enabled, camera number/speed, loaded logo thumbnail, and transition status. The dB setting tiles show configured gain; moving meters show signal level. Neither should be random decorative animation.

MV off shows the configured LCD source. MENU/AUDIO show the corresponding dark menu with purple selection highlights and the documented ordering: Effect, Audio, PIP, Luma, Chroma, DSK, PTZ, Image, Port, System. Follow the compact LCD screenshots rather than substituting a desktop settings dialog. The manual's wording “click” is not sufficient evidence that the LCD is a touchscreen; knob operation is the default.

Provide an optional enlarged copy of the LCD, plus optional PGM/AUX monitors outside the device. They share the same underlying output and make small text and routing easier to check. The console remains the main practice interface.

### Practice inputs

For stages 1–3, use four procedural canvas scenes with source labels, moving shapes, colour bars, and an elapsed-time counter. Make one a green-screen subject and one useful for luma/DSK testing. Generate sample transparent logos and PAT backgrounds locally. Given the same timestamp, the scenes must produce the same frames, making screenshots repeatable without downloading footage.

Create each input once and reuse its current texture across thumbnails, preview, program, and AUX. Virtual PTZ scenes cover a larger coordinate area than the output crop, allowing pan/tilt and zoom. Freeze holds an actual captured frame while the original source continues running.

In stage 4, add distinct quiet generated audio signals for all four HDMI inputs and two virtual mic/line inputs. Pulse envelopes make AFV and meters easy to check. The generated signals need no microphone permission. Imported video uses its own audio track; video without audio is silent and identified as such in Sources. Optional real microphone capture and licensed looping event footage can follow later. Local video/image/audio imports are added with persistent media storage in stage 5.

## 4. Implementation

Use **React + TypeScript + Vite**, plain CSS, Canvas 2D for procedural sources, one WebGL compositor, and Web Audio. Run entirely in the browser, with local persistence. Target desktop Chrome/Edge first and check touch interactions at the end.

| Part | Approach |
| --- | --- |
| Console and menus | React components and ordinary HTML/CSS; absolute positioning within one panel container. |
| Mixer logic | One typed state object and a pure reducer via [React useReducer](https://react.dev/reference/react/useReducer). Physical actions pass through power, lock, and mode checks. Extract focused helper functions as needed; separate stores or a reducer framework are unnecessary. |
| Video | One [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) context with multiple passes/framebuffers for composition, transitions, and keying. All displays consume frames from that compositor. |
| Audio | [Web Audio](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) sources, gain, delay, and analyser nodes. Meters measure the actual simulated signal. |
| Timing | Injectable monotonic clock, normally `performance.now()`, plus requestAnimationFrame. Reducer actions carry timestamps; progress is derived outside React. |
| Saving | Versioned localStorage for settings/MEM; IndexedDB for imported media when imports arrive in stage 5. |
| Development and tests | [Vite](https://vite.dev/guide/), TypeScript, Vitest, and Playwright. |

### 4.1 Switching contract — provisional hardware behaviour

The following defaults are implementation decisions pending console comparison, not additional owner confirmations:

- Each bus has a `BusScene`: a background source and enable flags for CHROMA, LUMA, and PIP. Each effect has one shared parameter set, matching the single configuration menu. DSK and LOGO have separate preview/program enable flags outside `BusScene`.
- CUT performs a **true swap** of the two `BusScene` values. The old program background and upstream enable flags move into preview. AUTO performs the same swap at completion.
- For AUTO, capture the outgoing/incoming bus scenes and transition settings at its start. Their video continues moving; only their routing/configuration is fixed during the transition. Do not capture two still images and crossfade those.
- CHROMA, LUMA, and PIP are upstream effects: their enabled state travels with the swapped scene. For example, PIP enabled only in preview becomes enabled only in program after CUT/AUTO; its LED changes green to red.
- DSK and LOGO are downstream overlays: their preview/program enable flags stay on their respective buses and do not swap. Program overlays remain above the transition. Taking a preview-only logo or DSK live requires ON AIR under this assumption.
- KEY/ON AIR toggle the selected effect on the appropriate bus. Normal PGM/PVW source presses change the background; effect sources are edited through their menus. Any undocumented current-layer source-button shortcut awaits verification.

Keep these rules in named switching/composition helpers so hardware corrections do not require rewriting controls or menus. Check this contract on the real unit before investing in detailed layer-transition fidelity.

### 4.2 Timing, interrupted operations, and input priority

Store an operation descriptor, not a continuously updated progress value:

```ts
type Transition = {
  id: number;
  kind: TransitionKind;
  startedAt: number;
  durationMs: number;
  from: BusScene;
  to: BusScene;
  settings: TransitionSettings;
};
// state.transition is Transition | null
```

Every timed action carries `now` from the injected clock. The reducer never reads the clock itself. Derive `progress = clamp((now - startedAt) / durationMs, 0, 1)` in the rendering loop. Dispatch completion with the operation ID; accept it only if it still matches the active operation, then swap once. CUT, power-off, and reset invalidate the old operation so a delayed completion cannot swap again. When rendering resumes after a hidden tab, reconcile elapsed time before drawing or processing the next input.

Use the following provisional behaviour during AUTO:

| Input | Result |
| --- | --- |
| CUT | Finish the captured transition immediately and commit its swap once. |
| AUTO again | Ignore; do not restart or queue another transition. |
| PGM/PVW, PAT/E-STOP, KEY/ON AIR, STILL, MEM recall, or edits affecting current video | Ignore until completion; do not queue. Apply this rule to menu and toolbar actions too. |
| Transition effect/duration menu edits | Save for the next transition; the running descriptor is unchanged. |
| FTB | Start/reverse an independent fade above program; AUTO continues underneath. |
| MENU, AUDIO, MV, audio adjustments | Continue to operate. Menu navigation is available even when an individual video edit is temporarily blocked. |
| Camera movement/zoom | Continue to affect live source frames. |
| Lock | Stop held movement and lock physical inputs; the running transition/fade continues. |
| Power-off or simulator Reset | Cancel operations and held inputs, clear transient captures, and silence audio. Reset loads defaults and returns to Start practice; power-off retains configuration. |

Input priority is power/lock → operating mode → transition restrictions → normal switching. In CAM+POS mode, source-row presses save/recall camera presets rather than changing the video bus. Camera preset actions do not exchange buses, even if a video transition is running.

FTB has its own `{ id, startedAt, durationMs, fromOpacity, toOpacity }` descriptor and settled opacity. A second press reverses from the current opacity; scale the remaining duration by the remaining opacity distance to preserve fade speed. Provisional behaviour: FTB changes video only, so audio continues. While black, switching can still update the underlying program. FTB and lock LED flashing use CSS animation or the shared clock, never reducer toggles.

Provisional power/lock gestures: short press toggles lock; a 2-second hold powers off and suppresses the short-press action on release. While locked, only the lock/power control works on the physical panel. While off, only power-on works. Help/display zoom and the separate simulator Reset remain available as recovery controls. Power-on resumes retained settings with FTB clear, STILL off, and no active transition; returning from browser reload also starts with transient operations cleared.

### 4.3 Composition and shared displays

For each source, update its frame once per render tick, then reuse that texture everywhere. Apply input flip and virtual camera transforms before the bus composition. Under the provisional STILL rule, capture the transformed current PGM background input (IN1–4) in a framebuffer and substitute that frame everywhere the same input appears. A second STILL press releases that captured input even if PGM has since changed. PAT/E-STOP do not create a capture. Only one input is frozen at a time; the underlying source and its audio continue. Clear the capture on reset/shutdown.

Explicit provisional render order:

```text
PGM background → CHROMA → LUMA → PIP ─┐
                                     ├→ transition → PGM DSK → PGM LOGO → FTB → PGM
PVW background → CHROMA → LUMA → PIP ─┘
                         └────────────→ PVW DSK → PVW LOGO → PVW

PGM/PVW backgrounds only → same transition progress → Clean PGM
PVW background only                                 → Clean PVW
```

When idle, the transition stage passes the PGM upstream composition through. During AUTO, PVW continues to show the captured incoming scene; it becomes the old program scene on completion. Provisional clean outputs exclude all keys, PIP, DSK, LOGO, and FTB. Their program background still follows CUT/AUTO. Route inputs, PAT, clean buses, full buses, or MV to each configured port after producing those images. A physical port routed to an input or clean output therefore bypasses program FTB under this assumption. Hardware comparison must confirm these clean/FTB rules and the chroma/luma stacking order.

Use one WebGL canvas as an output atlas containing the required inputs and composed views. It can require several rendering passes; **one context does not mean one pass**. Copy the needed rectangles synchronously to Canvas 2D displays with [drawImage](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage). Do not create a WebGL context per LCD tile/monitor or independently decode the same source per view. HTML/CSS renders labels and menus from one shared display model; enlarged LCD and external monitors use that model with their documented layouts. Rebuild GPU resources after context loss, clearing a freeze capture if it cannot be restored.

Keep wipes in a data catalogue of pattern family, direction, and parameters, with reusable shader functions for lines, boxes, diagonals, etc. Add a distinct shader only for an effect that needs it. Match the 30 selector entries to manual/device evidence and track unverified patterns; do not invent 30 effect names or claim all are accurate from a partial screenshot.

### 4.4 Audio scope and limitations

Route each of the six generated audio sources through its level/delay controls into the program mix. HDMI supports Off/On/AFV; the two virtual mic inputs use On/Off. Headphone monitoring taps the selected source or PGM, with its own level. The browser has one selected audible monitor feed (PGM by default); program and headphone buses are not both sent to the speakers, which would double the mix. Both buses retain working meters. Start practice resumes the AudioContext; resume may be needed again after browser suspension.

Provisional AFV uses the background source only. During AUTO, crossfade outgoing/incoming AFV gains with the transition's time progress; a source appearing on both sides must not be counted twice. PIP/key appearances do not activate AFV initially. Use actual signal analysers for meters, and keep displayed gain settings separate from measured levels. Provisional meter taps: source meters after channel level/delay but before On/Off/AFV gating; PGM after master level/mute; headphone after monitoring level. An input can therefore show signal while absent from the program mix. Smooth gain changes to avoid clicks. ALC levels use documented simulator presets with audible gain control, but their response is an approximation until measured against the unit.

**First-version limitation:** retain the documented HDMI delay range of −30 to 500 ms in settings, but apply only non-negative delays. Negative values have an effective delay of 0 ms and must be disclosed in practice Help/Sources as unsupported audio advance. This preserves menu practice but does not satisfy accurate negative-delay training. A [DelayNode](https://developer.mozilla.org/en-US/docs/Web/API/DelayNode) alone cannot advance audio; defer a buffered video/audio timeline until it can be validated with a sync test. Positive delays and the documented mic default must actually affect sound. Do not silently show a negative value as though the sound has advanced.

### 4.5 Menus and parameter data

Define the ten menus in `menus.ts` using entries such as `{ label, type, range, step, default, paramId }`. Include enum options, submenu children, and command entries as needed. A generic LCD menu component and typed `SET_PARAM` action handle ordinary settings. Use known parameter IDs with explicit readers/updaters and validation, rather than arbitrary string paths into state. Commands such as MEM save/recall and Reset remain explicit actions with side effects outside the reducer.

Transcribe labels, limits, increments, defaults, and source page references from the manual into this registry as each menu is implemented. Unknown increments/defaults are marked provisional. Use the registry to create defaults and clamp edits, avoiding a second set of numbers in components. Maintain separate menu cursor, edit mode, and selected effect state.

Provisional navigation: MENU opens the root; rotate moves the cursor; knob press enters a submenu or begins/confirms an edit. MENU exits edit mode, then backs up one level, then closes at root. Edits apply immediately, so backing out does not undo them. AUDIO opens its shortcut menu. OSD expiry closes the menu and retains committed values. Movement/position modes suspend menu navigation of the joystick as appropriate.

### 4.6 MEM and persistence

Define a versioned localStorage envelope, for example `{ schemaVersion: 1, settings, memSlots }`. Store four slots and stable media IDs; never store temporary object URLs. Validate loaded data and handle older/unknown versions without crashing or silently discarding all saved slots.

Provisional MEM snapshot scope:

| Included in a slot | Global or transient; excluded from a slot |
| --- | --- |
| Both bus scenes; all effect parameters and bus enable flags; transition/FTB duration settings; audio settings; output routes, layout/format and input flips; selected PAT/LOGO asset IDs | Power/lock; active transition and FTB level/progress; STILL frame; menu cursor; audio playback clock; imported asset library; language/brightness/network preferences; all PTZ settings, camera poses/presets, and camera connection settings |

Save/recall only when no AUTO transition or FTB fade is running. A settled black FTB is permitted but is not saved or changed by recall. Recall applies the snapshot atomically; assets must be loaded before replacing the active configuration. The exact real-device MEM scope remains unverified.

When media import arrives, store its blobs and metadata in [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) before committing a saved reference. Recreate object URLs on load and revoke them on replacement. If an asset is missing, keep its ID and present a labelled missing-source frame or disabled overlay with a relink notice; never substitute another camera silently. If saving fails, keep the previous valid snapshot and report the failure. Built-in procedural sources have stable IDs and require no blob storage. Simulator Reset resets the working configuration; clearing saved slots/media is a separate explicit action.

### 4.7 File organisation

Start with the files needed for stage 1 and add the others when their features arrive:

```text
docs/
  Mixer-Plus-User-Manual.pdf
src/
  App.tsx
  components/
    Console.tsx       # panel, hit targets, buttons, knobs, joystick
    MixerDisplay.tsx  # LCD multiview, single view, status, menus
    PracticeTools.tsx # source loading, optional monitors, help
  mixer/
    types.ts          # serializable state and action types
    reducer.ts        # input priority and state changes
    switching.ts      # bus exchange and timed-operation helpers
    menus.ts          # parameter definitions, defaults, validation
    clock.ts          # production/test clock adapter
    video/
      sources.ts      # procedural scenes and shared imported media
      compositor.ts   # WebGL context, render order, output atlas
      shaders.ts      # keyers and reusable wipe families
    audio.ts          # audio routing and meters
    persistence.ts    # versioned settings and media storage
  panel-layout.json   # percentage bounds for buttons/LEDs/screen
  styles.css
public/
  console.webp
tests/
  switching.test.ts
  practice.spec.ts
```

Keep textures, captured GPU frames, audio nodes, media elements, and per-frame progress outside React state. State contains source/capture IDs, configuration, and timed-operation descriptors. Derive LEDs from state and the clock. Extract PTZ/effects/audio update helpers when they become substantial, while retaining one reducer entry point. Comment composition, timing, and mode-routing logic and add JSDoc where behaviour needs explanation.

## 5. Build order and completion checks

| Stage | Scope | Exit checks |
| --- | --- | --- |
| 1. Core loop | Panel/hotspots, four deterministic procedural sources, one-context compositor, PGM/PVW, CUT, AUTO with MIX, and LCD multiview. Other controls can have their positions defined but are not counted as implemented yet. | Preview selection leaves program unchanged; CUT swaps correctly; a 1-second MIX reaches its midpoint/end at injected timestamps; all views show the same source frame; repeated AUTO and mid-transition CUT follow section 4.2. |
| 2. Controls and menus | Generic menu/knob system, timing parameters, DIP/wipe catalogue, FTB, STILL, PAT/E-STOP, MV/single view, routes, power/lock. | Check operation interruption, FTB reversal, lock input priority, source freeze/release, independent routing, and menu edits during AUTO. Catalogue records which patterns are verified. |
| 3. Layers | PIP/crop/border, logo, chroma, luma, DSK, masks, and positioning. | Verify green/red/yellow LEDs, upstream swap versus downstream retention, rendered layer order, and clean outputs against the provisional contract; compare with console before claiming fidelity. |
| 4. Audio and cameras | Six generated audible channels, AFV, positive delay, headphone monitoring/meters, virtual PTZ/presets and camera settings. | AFV source changes and transition gain are audible; muted signal meters behave consistently with their tap; positive delay passes a sync test; presets do not switch buses; release/blur stops movement. Negative delay is visibly disclosed as unsupported. |
| 5. Complete practice app | MEM/persistence, local media import, remaining system/port menus, reset/help, and responsive/touch checks. | Save a slot with an imported logo/PAT, reload, and recall successfully; handle missing assets/storage errors; check every physical control and menu item, including long presses and mode changes. |

Use **Vitest** for switching, parameter constraints, mode routing, persistence migration, and stale-completion tests. Supply explicit timestamps; [fake timers](https://vitest.dev/guide/mocking/timers) are useful for scheduling helpers. Use **Playwright** for operating sequences and panel/LCD screenshots, with the injected clock and procedural scenes; its [clock support](https://playwright.dev/docs/clock) can control browser timers/animation frames. Screenshots pause LED animations or set their phase. Browser clock mocks do not prove real AudioContext or decoded-video synchronisation; use separate audio measurements and manual listening for that.

Run type/build checks and focused tests for each stage. Test multiple viewport sizes for hit-target alignment and touch gesture cancellation. Maintain a control/menu checklist with states such as implemented, provisional, verified, or unsupported. Passing software tests verifies the chosen simulator rules, not undocumented firmware behaviour.

Example final practice sequence: select camera 2 in preview → set MIX to 1 second through the knob → AUTO → select PIP and press KEY to inspect it in preview → press ON AIR to enable it on program too (yellow LED) → adjust audio → FTB and recover → CAM/POS preset recall without switching buses. A separate drill tests PIP moving from preview to program through AUTO under the provisional upstream-swap rule.

Optional later additions: licensed event footage, real mic capture, validated negative-delay support, and guided drills that check reducer state (for example, taking camera 3 live with PIP from camera 1). These do not block the core console build.

## 6. Accuracy limits and questions to resolve during implementation

The owner-confirmed corrections are recorded once in section 2. Remaining questions have explicit defaults above; the most consequential checks come first:

| Hardware check | Provisional rule or current limit |
| --- | --- |
| Does the old PGM move into PVW after CUT/AUTO? Which effect enables move with it? | True `BusScene` swap, including chroma/luma/PIP enables (4.1). |
| Do DSK/LOGO stay above a transition, and what is the full layer order? | Downstream flags stay on their buses; order and clean taps follow 4.3. |
| What happens when CUT/AUTO, source keys, FTB, or MENU are pressed during AUTO? | Deterministic interaction table in 4.2; not assumed to match firmware yet. |
| What does STILL capture, and how is it released? What do source keys mean for an active layer? | Shared frozen PGM input frame; second press releases it; normal source keys select background (4.1/4.3). |
| What exactly do clean outputs omit? Does FTB affect audio or clean outputs? | Clean removes all effects and bypasses FTB; audio continues (4.2–4.4). |
| How do lock/unlock, long press, and menu back/exit behave? | Explicit provisional gestures and allowed inputs (4.2/4.5). |
| Which parameters, camera settings, and media selections does MEM save? | Defined production snapshot scope in 4.6. |
| What are the exact 30 effects, thresholds, ALC responses, and AFV rules for layered/during-transition video? | Use the catalogue and documented controls; mark unmeasured visual/audio responses approximate (4.3/4.4). |
| Are all audio delay values actually applied? | Positive delays work; negative HDMI values are stored/displayed with an explicit unsupported-advance notice (4.4). |
| Is there PTZ joystick calibration on this unit? | Add only if confirmed; see section 2 for the settled T-bar correction. |

IP discovery, signal formats, and firmware/version screens simulate local device state. PTZ acts on virtual cameras. Actual USB/HDMI transmission and the manufacturer's separate PC application are outside this practice app. Software version output must identify the simulator rather than claim to be real firmware.

The supplied panel image and manual are local reference assets for this personal practice project. Before public distribution, decide on distributable panel artwork and reference-document handling; do not automatically include the PDF in the deployed app. No publication is part of this plan update.

Implementation can begin with these defaults. Before describing the result as hardware-accurate, resolve the relevant provisional behaviours through console comparison and keep any unsupported capabilities visible in the practice documentation.
