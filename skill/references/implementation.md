# Implementation patterns for practice consoles

Read only the sections the device needs. These patterns describe the approach used for Mixer Plus; the device contract determines the actual state and signal rules.

## State and input routing

A useful division is:

```text
Console controls -> physical actions -> reducer -> serializable device state
                                              -> lights and menu/display model
Shared frame loop -> source/renderer/audio resources -> visible output frames
Persistence adapter <-> saved configuration + stable media IDs
```

Avoid a store per screen or an abstraction framework per knob. Start with one reducer, explicit actions, a menu registry, and small resource managers. Split substantial switching, camera, or signal helpers as they grow. A simple counter simulator might need only one component and a reducer.

Input priority is device-specific, but should be explicit. A practical ordering is power/lock, special operating mode, busy-operation restrictions, then normal control action. A preset-save mode can reuse numbered keys without accidentally performing their ordinary live action.

Distinguish selected mode from enabled function. Selecting PIP on a mode knob is not the same action as enabling PIP. Derive red/green/yellow lights from the relevant bus flags when this device uses those colours; another device may use different rules.

## Timed operations

Example descriptor:

```ts
type TimedOperation = {
  id: number;
  kind: string;
  startedAt: number;
  durationMs: number;
  from: SceneDescriptor;
  to: SceneDescriptor;
};

const progress = (operation: TimedOperation, now: number) =>
  Math.max(0, Math.min(1,
    (now - operation.startedAt) / Math.max(1, operation.durationMs)));
```

The reducer receives `now`; it never reads the clock, starts a timer, or accesses a media element. A monotonically increasing operation ID survives cancellation/reset so an old completion cannot match a new operation. Commit final assignments once. Reconcile elapsed operations before processing an input after a hidden-tab return.

Write a table for each relevant interruption: repeat the timed-action key, immediate-action key, source/control edits, independent fade, menu, lock, and power-off/reset. Snapshot operation settings and logical source routing at the start. Live video continues underneath those descriptors; freezing every transition source is incorrect unless the hardware actually does that.

Separate independent fades from source transitions. To reverse a fade, start from its current computed opacity and scale the remaining duration by the remaining distance if preserving speed. Flashing LEDs can use CSS or the shared clock rather than per-frame reducer toggles.

## Controls and physical geometry

Panel coordinates must correspond to the final image crop. Example:

```json
{
  "width": 1000,
  "height": 600,
  "screen": { "x": 25, "y": 10, "w": 45, "h": 40 },
  "controls": { "cut": { "x": 82, "y": 65, "w": 10, "h": 12 } },
  "leds": { "live": { "x": 16, "y": 20, "w": 2, "h": 1.5 } }
}
```

Use percentage bounds inside a position-relative container with the panel image establishing aspect ratio. Native buttons supply focus, labels, and keyboard activation. Knobs can use vertical drag and wheel with click-to-press; distinguish a click from a completed drag. Avoid dispatching the press twice from pointer-up and native click. Touch gestures need pointer capture and local `touch-action: none`.

For long-press power, suppress the short-press action when the hold has already fired. Continuous controls stop on release, cancel, lost capture, blur, lock, and shutdown. Test more than a mouse click: held zoom and joystick movement can stick if cancellation is forgotten.

## Menus

A typical entry uses `{ label, paramId, type, range, step, default, options }`, with submenu/command variants. Values may be read/updated through explicit parameter-ID handlers. A string from the UI must not become an arbitrary nested-state write.

Keep cursor, menu path, edit mode, and any component selection (such as an IP octet) separate. Commands such as save, recall, reset, and position mode remain explicit actions. Side effects like storing a file or creating an audio node belong outside the reducer.

Use one registry for defaults, validation, limits, and rendering. Transcribe it from the manual with page evidence. If the increment/default is not documented, mark it provisional rather than silently choosing a convenient demo value. Keep a completion checklist so a defined menu entry is not mistaken for an implemented effect.

Hardware LCDs need their own rendering/layout. A compact LCD menu may differ from the external multiview menu. Optional enlarged copies use the same display model. Do not infer touch support solely from the manual saying "click".

## Video and graphics

For many simple devices, DOM, SVG, or Canvas 2D is sufficient. Add WebGL for pixel-based keying, many live video composites, or transitions that need shader processing.

For a video mixer:

1. Create/decode each logical source once.
2. Apply source-level transforms, camera crop, flips, and any source freeze.
3. Build each bus's upstream composition in the verified order.
4. Apply the transition between the outgoing/incoming compositions.
5. Add downstream layers, any global fade, and output routing.
6. Produce clean taps at the explicitly defined stages.

The list is a pipeline pattern, not proof of a particular mixer's ordering. For example, whether DSK/logo move with a transition must come from the device contract.

Use one WebGL context with intermediate framebuffers and a final output atlas when many displays share video. Multiple rendering passes are expected. Copy atlas rectangles to display canvases in the same animation tick using Canvas 2D `drawImage`. Don't independently decode a camera for its thumbnail, preview, program, and AUX.

The Mixer Plus build exposed atlas-edge bleed when Canvas 2D enlarged adjacent rectangles. Insetting source rectangles by half a texel prevented interpolation from borrowing a neighbouring image's edge. Check this with a fully black output next to bright sources; do not apply a crop workaround before confirming the actual cause.

Use reusable shader pattern families for wipe catalogues, with parameters such as direction, centre, softness, and scale. A menu containing 30 named choices is not evidence that 30 exact firmware effects have been reproduced. Label unverified geometry/easing as approximate.

Procedural scenes should vary with supplied time and include source labels, visible motion, clock, a keyable background, and a graphics/title source as needed. Use a larger virtual scene for pan/tilt/zoom rather than zooming a fixed thumbnail. Frame freeze captures real pixels; its scope may be a shared input or an output, depending on the hardware.

## Audio

Build real signal paths only for an audio-capable simulator. For a mixer, generated quiet signals are sufficient to practise gates, gain, audio-follow-video, routing, and meters without requesting microphone access.

Define the meter taps explicitly: input level, pre/post gating, program after master, headphone after monitoring level, etc. A configured dB value and measured signal level are different displays. Use analyser data instead of random bars. Smooth gain/delay changes to avoid clicks.

Audio-follow-video rules during transitions and layered video need a stated contract. Avoid doubling one source when it appears on both sides. Headphone and PGM monitoring should not both be played through the same speakers unless that is an intentional choice.

For imported media, reuse MediaElementAudioSource nodes and route them through the mixer. A silent file remains silent; do not substitute a generated tone after import. Resume AudioContext/playback from a user gesture and handle later suspension.

A DelayNode can apply positive delay but cannot advance audio. Negative delay requires a deliberately buffered timeline or source scheduling arrangement. The first Mixer Plus version stored/displayed negative HDMI values but applied 0 ms and disclosed unsupported advance. This is a scoped limitation from that build, not a rule to silently disable negative delay on every simulator.

## Persistence

Use a schema version and validate loaded parameter IDs/types/ranges. Do not silently overwrite unknown-version data. Define the distinction between restoring session settings, recalling a production memory, resetting working settings, and deleting saved data.

Save imported blobs to IndexedDB before saving their references. Use stable IDs and regenerate object URLs on load; object URLs do not survive a reload. Revoke old URLs. Loading one file is not evidence that MEM containing it survives restart; test save, reload, asset hydration, and recall.

When media is missing, retain its identity and show an explicit missing-source state or disabled overlay with relink. Never silently point a missing camera to another feed. Keep the previous valid saved data if a write fails.

## Verification

Use logic tests for the action contract: normal operation, mode overrides, interruptions, stale completion IDs, limits, freeze, lock, presets, and saved-state scope. Use browser tests for the actual controls, wheel/drag/hold, rendering, audio signals, imported media, and reload.

An injectable clock makes procedural video and state deterministic, but the test must also wait for the requested state/time to finish rendering. A state update is not a rendered frame. A development-only hook may expose state, clock, and a rendered-frame acknowledgement; exclude it from production.

Compare pixels or perceptual statistics for meaningful visual outcomes: keying changes the full output while a clean tap retains its background; STILL preserves a frame; fade-to-black reaches black. Additional framebuffer passes can introduce one-unit colour rounding, so raw PNG equality is sometimes too strict. Don't log full data URLs on assertion failure.

Clock mocking doesn't prove decoded-video or AudioContext timing. Validate sound/delay with actual signal measurements or separate sync tests and state the verification limit. Inspect screenshots for physical alignment and menu legibility on desktop and smaller screens.

## Clean builds and deployment

Before CI, declare dependencies directly: a Vite/Playwright config using `process` or tests using `Buffer` need Node types, even if an ambient/transitive dependency or cached TypeScript build made them work locally. Include `@types/node` and the appropriate `node` compiler type entry when relevant. Run a fresh install and a forced type check when cache drift is a plausible cause.

On Windows use `npm.cmd` if PowerShell execution policy blocks npm's script shim. A running Vite process can hold a native bundler module open and prevent `npm ci`. Identify the specific project's process before stopping it, or use a disposable clean checkout. Restore a user-owned local server if it had to be stopped; do not kill unrelated Node processes or clear broad caches.

For an authorised GitHub Pages deployment:

- Inspect remote, default branch, existing workflow, Pages settings, and available access.
- Resolve a mismatch between the requested live URL and supplied repository name before the first push/deployment. Project Pages normally uses `https://<owner>.github.io/<repository>/`; do not silently substitute another URL or rename a repository. When the user authorises a rename, update `origin`, README links and deployment references, and cancel obsolete deployment runs if needed.
- Read current official Vite/GitHub Pages guidance and choose supported action versions.
- Enable GitHub Actions as the Pages publishing source. Use a workflow that installs from the lockfile, runs appropriate checks, builds `dist/`, uploads the Pages artifact and deploys it with `contents: read`, `pages: write`, `id-token: write` and the `github-pages` environment. Derive the environment URL from the deployment step's output.
- Derive Vite `base` from deployment metadata or an explicit host setting. Runtime public assets and the home link use `import.meta.env.BASE_URL`; HTML assets are rewritten by Vite.
- For example, pass `${{ steps.pages.outputs.base_path }}/` from `actions/configure-pages` as `VITE_BASE_PATH`, with Vite using `process.env.VITE_BASE_PATH || '/'`. Keep versions current rather than copying a frozen workflow from an earlier simulator.
- Keep local development working at `/`. Preview the production build under the repository prefix and check image, favicon, scripts, styles, home navigation, and an operating sequence. Pass the same base setting to `vite preview`; a correctly built site can appear broken when the preview server mounts a different prefix.
- Make CI commands portable: a Playwright web-server command should choose `npm.cmd` on Windows and `npm` on Linux. Avoid hard-coding Windows commands in a workflow that runs on Ubuntu.
- Push/enable Pages only within the user's deployment authorisation. Observe the actual workflow outcome. Diagnose a concrete CI failure, apply the scoped fix, and rerun; stop for access failures or a new external choice.
- Check the live URL and assets and exercise controls in the production page. Report source/build/browser/live verification separately.
- Once the live URL is verified, add a prominent README link near its beginning, for example `**[Open the live simulator](https://<owner>.github.io/<repository>/)**`. If this needs another commit, push it within the existing authorisation and check any resulting deployment. Finish with the verified live link and a brief verification result.

GitHub's README renderer strips `target="_blank"`; an HTML anchor in the README cannot force a new tab. If asked, explain that Ctrl/Cmd-click or middle-click opens the link separately. Do not promise a new-tab behaviour that the host removes. An owned HTML page can use `target="_blank"` with `rel="noopener noreferrer"` when requested.

Useful primary references, to recheck when using the APIs: [React reducers](https://react.dev/reference/react/useReducer), [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API), [Web Audio](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API), [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API), [Playwright clock](https://playwright.dev/docs/clock), [Vite Pages deployment](https://vite.dev/guide/static-deploy.html#github-pages), [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
