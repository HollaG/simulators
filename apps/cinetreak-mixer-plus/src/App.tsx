import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Console } from './components/Console';
import { AudioMixer } from './mixer/audio';
import { drawDisplay } from './mixer/display';
import { menu, menuAt, parameters, valueText } from './mixer/menus';
import { loadAssets, persist, restore, saveAsset, type MediaAsset } from './mixer/persistence';
import { reducer } from './mixer/reducer';
import { opacity, progress } from './mixer/switching';
import type { Action, MixerState } from './mixer/types';
import { Compositor } from './mixer/video/compositor';

declare global {
  interface Window { __mixer?: { state: () => MixerState; dispatch: (action: Action) => void; setTime: (value: number | null) => void; time: () => number; rendered: () => boolean; frameTime: () => number; contexts: () => number; audio: () => AudioMixer | null } }
}
const names = { IN1: 'Wide stage', IN2: 'Studio close-up', IN3: 'Titles / luma source', IN4: 'Green-screen presenter', MIC1: 'Virtual line input 1', MIC2: 'Virtual line input 2', PAT1: 'Standby background', PAT2: 'Closing background', LOGO1: 'Live badge', LOGO2: 'On air badge', LOGO3: 'Studio badge', LOGO4: 'Mixer badge' };

/** Own the serializable desk state while a shared animation loop manages video/audio resources. */
export default function App() {
  const [s, dispatch] = useReducer(reducer, undefined, restore);
  const stateRef = useRef(s); stateRef.current = s;
  const engineRef = useRef<Compositor | null>(null), audioRef = useRef<AudioMixer | null>(null);
  const screen = useRef<HTMLCanvasElement>(null), enlarged = useRef<HTMLCanvasElement>(null), program = useRef<HTMLCanvasElement>(null), aux = useRef<HTMLCanvasElement>(null);
  const [panel, setPanel] = useState<'sources' | 'help' | null>(null), [monitors, setMonitors] = useState(false), [zoom, setZoom] = useState(100), [debug, setDebug] = useState(false);
  const [assets, setAssets] = useState<MediaAsset[]>([]), [busy, setBusy] = useState(''), [error, setError] = useState(''), [currentTime, setCurrentTime] = useState(0);
  const movement = useRef({ x: 0, y: 0, zoom: 0 }), fixedTime = useRef<number | null>(null);
  const now = useCallback(() => fixedTime.current ?? performance.now(), []);
  const press = useCallback((id: string) => { if (['power', 'shutdown', 'reset', 'cam', 'pos'].includes(id)) movement.current = { x: 0, y: 0, zoom: 0 }; dispatch({ type: 'BUTTON', id, now: now() }); }, [now]);
  const turn = useCallback((delta: number) => dispatch({ type: 'ENCODER', delta, now: now() }), [now]);
  const mode = useCallback((delta: number) => dispatch({ type: 'MODE', delta, now: now() }), [now]);
  const move = useCallback((x: number, y: number, z = 0) => { movement.current = { x, y, zoom: z }; }, []);

  useEffect(() => {
    let frameId = 0, alive = true, last = now(), uiAt = 0, paintedAt = -100, renderedTime = -1;
    let renderedState: MixerState | null = null;
    let engine: Compositor;
    try { engine = new Compositor(); engineRef.current = engine; audioRef.current = new AudioMixer(); }
    catch (cause) { setError(String(cause)); return; }
    engine.onRestore = () => dispatch({ type: 'RESTORE', state: { freeze: null, notice: 'Video context restored; the old STILL capture was released.' } });
    loadAssets().then(async stored => {
      const results = await Promise.allSettled(stored.map(asset => engine.sources.add(asset)));
      if (!alive) return;
      setAssets(stored);
      if (results.some(result => result.status === 'rejected')) dispatch({ type: 'NOTICE', message: 'Some saved media could not be decoded. Relink them in Sources.' });
    }).catch(() => { if (alive) dispatch({ type: 'NOTICE', message: 'Media storage is unavailable. Built-in sources still work.' }); });
    const frame = () => {
      if (!alive) return;
      const time = now(), state = stateRef.current;
      // GPU/audio objects stay outside React. State only receives input changes and operation completion.
      // A frozen test clock needs one frame per state/time change. Repainting
      // identical frames continuously starves browser input on software WebGL.
      const shouldPaint = fixedTime.current === null
        ? time - paintedAt >= 30 || time < paintedAt
        : state !== renderedState || time !== renderedTime;
      if (shouldPaint) {
        const dt = Math.max(0, Math.min(.1, (time - last) / 1000)); last = time; paintedAt = time;
        const m = movement.current;
        if (m.x || m.y || m.zoom) dispatch({ type: 'MOVE', ...m, dt, now: time });
        if ((state.transition && progress(state.transition, time) >= 1) || (state.fade && progress(state.fade, time) >= 1) || (state.menu.open && time - state.menu.lastInput > Number(state.params['system.osd']) * 1000)) dispatch({ type: 'TICK', now: time });
        try {
          engine.render(state, time); audioRef.current!.update(state, time, engine.sources);
          const levels = audioRef.current!.levels;
          for (const [ref, route] of [[screen, 'LCD'], [enlarged, 'LCD'], [program, 'PGM PORT'], [aux, 'AUX PORT']] as const) {
            if (ref.current) drawDisplay(ref.current.getContext('2d')!, engine, state, time, levels, route);
          }
          renderedState = state; renderedTime = time;
        } catch (cause) { setError(`Video engine: ${String(cause)}`); return; }
        if (time - uiAt >= 100 || fixedTime.current !== null) { uiAt = time; setCurrentTime(time); }
      }
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    if (import.meta.env.DEV) window.__mixer = { state: () => stateRef.current, dispatch, setTime: value => { fixedTime.current = value; }, time: now, rendered: () => renderedState === stateRef.current, frameTime: () => renderedTime, contexts: () => engineRef.current ? 1 : 0, audio: () => audioRef.current };
    return () => { alive = false; cancelAnimationFrame(frameId); engine.dispose(); audioRef.current?.dispose(); engineRef.current = null; audioRef.current = null; delete window.__mixer; };
  }, [now]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      try { persist(s); }
      catch (cause) { dispatch({ type: 'NOTICE', message: `Settings could not be saved: ${String(cause)}` }); }
    }, 300);
    return () => clearTimeout(timeout);
  }, [s.params, s.memories, s.assets, s.presets]);

  useEffect(() => {
    if (!panel) return;
    const dialog = document.querySelector<HTMLElement>('.tool-dialog');
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !dialog) return;
      const targets = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]'));
      const first = targets[0], last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [panel]);

  useEffect(() => {
    const stop = () => move(0, 0);
    window.addEventListener('blur', stop); document.addEventListener('visibilitychange', stop);
    const keydown = (e: KeyboardEvent) => {
      // Shared site navigation keeps normal link keyboard behaviour; desk
      // shortcuts only apply while interacting with the practice area.
      if (e.target instanceof Element && e.target.closest('.pd-header, .pd-footer, .pd-skip')) return;
      if (panel || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.target instanceof HTMLButtonElement && [' ', 'Enter'].includes(e.key)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^Digit[1-4]$/.test(e.code)) { e.preventDefault(); press(`${e.shiftKey ? 'pgm' : 'pvw'}${e.code.slice(-1)}`); }
      else if (e.key === ' ') { e.preventDefault(); if (!e.repeat) press('cut'); }
      else if (e.key === 'Enter') { e.preventDefault(); if (!e.repeat) press(stateRef.current.menu.open ? 'encoder' : 'auto'); }
      else if (e.key === 'Escape') { e.preventDefault(); press('menu'); }
      else if (e.key.toLowerCase() === 'm') press('menu');
      else if (e.key.toLowerCase() === 'f' && !e.repeat) press('ftb');
      else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        if (stateRef.current.cam || stateRef.current.position) move(e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0, e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0);
        else turn(e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1);
      }
    };
    const keyup = (e: KeyboardEvent) => { if (e.key.startsWith('Arrow')) stop(); };
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup);
    return () => { window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', stop); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); };
  }, [panel, move, press, turn]);

  const start = async () => {
    try { await audioRef.current?.start(); engineRef.current?.sources.start(); press('start'); }
    catch (cause) { dispatch({ type: 'NOTICE', message: `Audio could not start: ${String(cause)}` }); }
  };
  const upload = async (slot: string, file?: File) => {
    if (!file || !engineRef.current) return;
    setBusy(slot);
    try {
      const asset = await saveAsset(file); await engineRef.current.sources.add(asset);
      setAssets(old => [...old, asset]); dispatch({ type: 'ASSET', slot, id: asset.id, now: now() });
      if (s.started) engineRef.current.sources.start();
    } catch (cause) { dispatch({ type: 'NOTICE', message: `Media was not loaded: ${String(cause)}` }); }
    finally { setBusy(''); }
  };
  const selectedItem = menuAt(s.menu.path)[s.menu.cursor];
  const level = s.transition ? progress(s.transition, currentTime) : 0;
  const fading = opacity(s, currentTime);

  return <main>
    <section className="cinetreak-heading"><div><div className="cinetreak-eyebrow">CINETREAK / VIDEO MIXER SIMULATOR</div><h1>Mixer Plus <span>4 INPUTS ? LIVE VIDEO</span></h1><p>Prepare the next shot. Make the switch. Practise the whole show.</p></div><nav aria-label="Practice tools"><button onClick={() => { move(0, 0); setPanel('sources'); }}>Sources</button><button onClick={() => { move(0, 0); setPanel('help'); }}>Help <span className="keycap">?</span></button><button onClick={() => press('reset')} title="Reset working settings; saved memories and media are kept">Reset</button></nav></section>

    <div className="desk-toolbar"><div className="session-label"><span className={`status-dot ${s.power ? 'online' : ''}`} /><span>{!s.power ? 'POWER OFF' : s.locked ? 'PANEL LOCKED' : s.cam ? 'CAMERA CONTROL' : 'READY TO SWITCH'}</span><span className="toolbar-divider" /><span className="muted">4 inputs · 1080p60</span></div>
      <div className="view-tools"><button className={monitors ? 'is-active' : ''} onClick={() => setMonitors(!monitors)} aria-pressed={monitors}>Expand monitors</button><label>Size <select aria-label="Console size" value={zoom} onChange={e => setZoom(Number(e.target.value))}><option value={85}>85%</option><option value={100}>100%</option><option value={125}>125%</option><option value={150}>150%</option></select></label><button className="primary-button" onClick={start} disabled={!s.power || s.locked}>{s.started ? '↻ Resume audio' : '▶ Start practice'}</button></div>
    </div>
    {error && <div className="error-banner" role="alert">{error}</div>}
    <section className="desk" aria-label="Interactive mixer console">
      <div className="desk-heading"><span>THE CONSOLE</span><span className="desk-hint">Click the keys. Scroll or drag the knobs.</span></div>
      <Console state={s} screenRef={screen} press={press} turn={turn} mode={mode} move={move} zoom={zoom} debug={debug} />
      <div className="bus-strip">
        <div><span className="bus-label pgm-label">PROGRAM</span><strong data-testid="program-source">{s.pgm.source}</strong><small>{fading > .99 ? 'Faded to black' : 'On air'}</small></div>
        <div><span className="bus-label pvw-label">PREVIEW</span><strong data-testid="preview-source">{s.pvw.source}</strong><small>Ready to take</small></div>
        <div className="transition-readout"><span className="bus-label">TRANSITION</span><strong>{s.params['transition.kind']}</strong><small>{s.params['transition.duration']} seconds</small><div className="transition-track"><span style={{ width: `${level * 100}%` }} /></div></div>
        <div className="encoder-helper"><span className="bus-label">{s.menu.open ? s.menu.editing ? 'EDITING' : 'MENU' : 'EFFECT SELECTED'}</span><strong>{s.menu.open ? selectedItem?.label ?? 'Menu' : s.selected.toUpperCase()}</strong><div><button aria-label="Encoder previous" onClick={() => turn(-1)}>−</button><button aria-label="Encoder confirm" onClick={() => press('encoder')}>PRESS</button><button aria-label="Encoder next" onClick={() => turn(1)}>+</button></div></div>
      </div>
    </section>
    <div className="notice-row" role="status" aria-live="polite"><span className="notice-indicator" /><span>{s.notice}</span><span className="keyboard-hint">1–4 preview <kbd>Space</kbd> cut <kbd>Enter</kbd> auto</span></div>
    {monitors && <section className="monitors" aria-label="Expanded monitors">
      <Monitor title="LCD · ENLARGED" tag={s.menu.open ? 'MENU' : s.mv ? 'MULTIVIEW' : String(s.params['port.lcd'])} canvasRef={enlarged} />
      <Monitor title="PGM PORT" tag={String(s.params['port.pgm'])} canvasRef={program} />
      <Monitor title="AUX PORT" tag={String(s.params['port.aux'])} canvasRef={aux} />
    </section>}

    {panel && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setPanel(null); }}><section className="tool-dialog" role="dialog" aria-modal="true" aria-label={panel === 'sources' ? 'Practice sources' : 'Practice help'} onKeyDown={e => { if (e.key === 'Escape') setPanel(null); }}>
      <div className="dialog-header"><div><span className="eyebrow">PRACTICE TOOLS</span><h1>{panel === 'sources' ? 'Your sources' : 'Get to know the desk'}</h1></div><button aria-label="Close dialog" onClick={() => setPanel(null)} autoFocus>×</button></div>
      {panel === 'sources' ? <>
        <p>Four shared demo feeds, two virtual line inputs, and your own media. Imports stay in this browser and survive a reload.</p>
        <div className="source-list">{Object.entries(names).map(([slot, label]) => {
          const id = s.assets[slot], file = assets.find(a => a.id === id);
          return <div className="source-row" key={slot}><span className={`source-slot ${slot.startsWith('IN') ? 'video-slot' : ''}`}>{slot}</span><div><strong>{file?.name ?? (id ? 'Missing media · relink to restore' : label)}</strong><small>{id ? file?.type.startsWith('audio') ? 'Local audio' : file?.type.startsWith('video') ? 'Local video · uses its own audio track' : 'Local image · silent' : slot.startsWith('MIC') ? 'Generated pulsed tone · mic/line controls apply' : slot.startsWith('IN') ? 'Procedural video + generated audio' : 'Built-in graphic'}</small></div><label className={`file-button ${busy || s.locked || !s.power || s.transition ? 'disabled' : ''}`}>{busy === slot ? 'Loading…' : id ? 'Replace' : 'Load file'}<input type="file" accept={slot.startsWith('LOGO') || slot.startsWith('PAT') ? 'image/*,.bmp' : 'image/*,video/*,audio/*,.bmp'} disabled={!!busy || s.locked || !s.power || !!s.transition} onChange={e => { void upload(slot, e.target.files?.[0]); e.target.value = ''; }} aria-label={`Load ${slot}`} /></label>{id && <button className="text-button" disabled={s.locked || !s.power || !!s.transition} onClick={() => dispatch({ type: 'ASSET', slot, id: '', now: now() })}>Built-in</button>}</div>;
        })}</div>
        <div className="monitor-options"><label>Listen to <select aria-label="Audible monitor" defaultValue={audioRef.current?.monitor ?? 'PGM'} onChange={e => { if (audioRef.current) audioRef.current.monitor = e.target.value as 'PGM' | 'Headphones'; }}><option>PGM</option><option>Headphones</option></select></label><span>HDMI negative delay values are stored for menu practice; audio advance is not applied.</span></div>
      </> : <div className="help-content">
        <p>Prepare a shot in the bottom <b className="green-text">PVW</b> row, then press <b>CUT</b> for an immediate switch or <b>AUTO</b> for the selected transition. The top <b className="red-text">PGM</b> row changes the live picture directly.</p>
        <div className="help-grid"><article><h2>Turn, then press</h2><p>Scroll or drag either knob vertically. The right knob navigates menus; press to enter or confirm. MENU goes back. The − / PRESS / + controls below the console do the same.</p></article><article><h2>Prepare your effects</h2><p>The left knob selects CHROMA, LUMA, PIP, DSK, or LOGO. KEY toggles it in preview; ON AIR toggles it on program. Green means preview, red means program, yellow means both.</p></article><article><h2>Move the camera</h2><p>Press CAM. Hold a joystick direction or ZOOM. Choose a camera in MENU → PTZ. CAM + POS: bottom row saves four presets; top row recalls them. Position effects by pressing the left knob.</p></article><article><h2>Save the setup</h2><p>MENU → System → MEM → choose a channel → Save configuration. MEM recalls that channel. Reset resets the working desk and keeps saved memories/media.</p></article></div>
        <h2>Keyboard shortcuts</h2><p><kbd>1–4</kbd> Preview · <kbd>Shift + 1–4</kbd> Program · <kbd>Space</kbd> CUT · <kbd>Enter</kbd> AUTO / confirm menu · <kbd>M</kbd> Menu · <kbd>Esc</kbd> Back · <kbd>F</kbd> FTB · <kbd>↑ ↓ ← →</kbd> Knob / joystick</p>
        <h2>Practice notes</h2><p>This uses the documented provisional rules: CUT/AUTO swap backgrounds and upstream effects; DSK/LOGO remain on their buses. STILL freezes the program input. Clean outputs omit overlays and FTB. Exact firmware edge cases, transition patterns, and ALC response remain approximations. There is no T-bar.</p>
        <p>Press Start practice to enable audio. Each built-in input has a different quiet test tone. Imported video uses its own audio; a silent file stays silent. Positive audio delays work; negative HDMI delay is menu practice only. Network settings and video formats describe virtual hardware.</p>
        <label className="debug-option"><input type="checkbox" checked={debug} onChange={e => setDebug(e.target.checked)} /> Show control alignment outlines</label>
      </div>}
    </section></div>}
    <span className="sr-only" data-testid="menu-selection">{s.menu.open ? `${s.menu.path.map((index, i) => i === 0 ? menu[index].label : '').filter(Boolean).join(' / ')} ${selectedItem?.label ?? ''} ${selectedItem?.param ? valueText(selectedItem.param, s.params[selectedItem.param]) : ''} ${s.menu.editing ? 'Editing' : ''}` : 'Menu closed'}</span>
  </main>;
}
function Monitor({ title, tag, canvasRef }: { title: string; tag: string; canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  return <article className="monitor"><div><span>{title}</span><small>{tag}</small></div><canvas ref={canvasRef} width={960} height={540} aria-label={title} /><span className="monitor-bottom"><i /> SIGNAL PRESENT <span>1920 × 1080</span></span></article>;
}
