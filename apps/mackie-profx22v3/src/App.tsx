import { useEffect, useReducer, useRef, useState } from "react";
import {
  Activity,
  AudioLines,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Headphones,
  Maximize,
  Minus,
  Play,
  Plus,
  Power,
  RotateCcw,
  SlidersHorizontal,
  Square,
  Volume2,
  X,
} from "lucide-react";
import {
  MixerAudio,
  LISTEN_BUSES,
  emptyReadings,
  type ListenBus,
} from "./audio";
import { Panel } from "./ConsolePanel";
import { ChannelInspector } from "./ChannelInspector";
import { SourceSelect, FileInput, sourceLabel } from "./SourceInput";
import {
  CHANNEL_LABELS,
  PRESETS,
  STORAGE_KEY,
  createDefault,
  mixerReducer,
  restoreSession,
  type MixerState,
} from "./state";
import "./style.css";

function loadInitial() {
  let state: MixerState;
  try {
    state = restoreSession(localStorage.getItem(STORAGE_KEY));
  } catch {
    state = createDefault();
  }
  return { ...state, bootUntil: performance.now() + 5000 };
}
/** Coordinates desk state, session storage and the audio engine. Playback is an
 * explicit user action, independent of the simulated mixer's power switch.
 */
export default function App() {
  const [state, dispatch] = useReducer(mixerReducer, undefined, loadInitial);
  const [selected, setSelected] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [running, setRunning] = useState(false);
  const [listenBus, setListenBus] = useState<ListenBus>("main");
  const [volume, setVolume] = useState(-18);
  const [help, setHelp] = useState(false);
  const [outlines, setOutlines] = useState(false);
  const [error, setError] = useState("");
  const [saveIssue, setSaveIssue] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const engine = useRef<MixerAudio | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const helpRef = useRef<HTMLDialogElement>(null);

  const ensureEngine = () => {
    if (!engine.current) {
      engine.current = new MixerAudio();
      engine.current.update(stateRef.current);
      engine.current.selectBus(listenBus);
      engine.current.setVolume(volume);
      engine.current.context.onstatechange = () =>
        setRunning(engine.current?.context.state === "running");
    }
    return engine.current;
  };
  useEffect(() => {
    engine.current?.update(state);
    const timeout = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        let version: unknown = 1;
        try {
          version = raw ? JSON.parse(raw)?.version : 1;
        } catch {
          /* Corrupt JSON can be replaced by a valid session. */
        }
        if (version !== 1) {
          setSaveIssue(
            "Saved session has an unsupported version. It was preserved; this desk will not be saved.",
          );
          return;
        }
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ version: 1, state }),
        );
        setSaveIssue("");
      } catch {
        setSaveIssue(
          "Browser storage is unavailable. This session cannot be saved.",
        );
      }
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [state]);
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (stateRef.current.pending)
        dispatch({ type: "tick", now: performance.now() });
    }, 100);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => {
    const remaining = state.bootUntil - performance.now();
    if (remaining <= 0) return;
    const id = window.setTimeout(
      () => engine.current?.update(stateRef.current),
      remaining + 10,
    );
    return () => window.clearTimeout(id);
  }, [state.bootUntil]);
  useEffect(() => {
    if (help) helpRef.current?.showModal();
    else helpRef.current?.close();
  }, [help]);
  useEffect(() => {
    // Development-only bridge lets browser tests inspect real analyser outputs.
    if (!import.meta.env.DEV) return;
    const target = window as unknown as { __mixer?: unknown };
    target.__mixer = {
      get state() {
        return stateRef.current;
      },
      read: () => engine.current?.read() ?? emptyReadings(),
    };
    return () => {
      delete target.__mixer;
    };
  }, []);
  useEffect(
    () => () => {
      void engine.current?.dispose();
    },
    [],
  );
  const togglePlayback = async () => {
    try {
      setError("");
      const audio = ensureEngine();
      if (running) await audio.pause();
      else await audio.start();
      setRunning(audio.context.state === "running");
    } catch (e) {
      setError(
        `Audio could not start: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };
  const importSource = async (
    file: File,
    target: number | "usb12Source" | "usb34Source",
  ) => {
    try {
      setError("");
      const id = await ensureEngine().importFile(file);
      setFiles((current) => [...current, id]);
      if (typeof target === "number")
        dispatch({ type: "channel", index: target, key: "source", value: id });
      else dispatch({ type: "usb", bus: target, source: id });
    } catch (e) {
      setError(
        `Could not decode “${file.name}”. Try a browser-supported WAV, MP3 or OGG file. ${e instanceof Error ? e.message : ""}`,
      );
    }
  };
  const missing = (source: string | null) =>
    !!source?.startsWith("file:") && !files.includes(source);
  const sources = state.channels.filter((channel) => channel.source).length;
  const soloCount = state.channels.filter((channel) => channel.solo).length;
  return (
    <div className="app-shell">
      <main>
        <section className="page-heading">
          <div>
            <div className="eyebrow">
              MACKIE <span>/</span> ANALOG MIXER SIMULATOR
            </div>
            <h1>
              ProFX22<span>v3</span>
              <span className="model-badge">22 CHANNELS · 4 BUS</span>
            </h1>
            <p>A little practice. A better mix. Get to know every channel.</p>
          </div>
          <div className="heading-actions">
            <button className="button secondary" onClick={() => setHelp(true)}><BookOpen size={15} /> Getting started</button>
            <button
              className="button secondary"
              onClick={() => dispatch({ type: "reset" })}
            >
              <RotateCcw size={15} /> Clear desk
            </button>
            <button
              className="button demo-button"
              onClick={() => {
                dispatch({ type: "demo" });
                setSelected(0);
              }}
            >
              <AudioLines size={16} /> Load demo band
            </button>
          </div>
        </section>
        {error && (
          <div className="error-banner" role="alert">
            {error}
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              <X size={16} />
            </button>
          </div>
        )}
        <div className="workspace">
          <section className="console-card" aria-label="Mixing console">
            <div className="console-toolbar">
              <div className="console-title">
                <SlidersHorizontal size={15} />
                <strong>The console</strong>
                <span className="toolbar-divider" />
                <span>{sources} sources connected</span>
              </div>
              <div className="zoom-tools">
                <button
                  aria-label="Zoom out"
                  disabled={zoom <= 75}
                  onClick={() => setZoom((z) => Math.max(75, z - 25))}
                >
                  <Minus size={14} />
                </button>
                <output aria-label="Console zoom">{zoom}%</output>
                <button
                  aria-label="Zoom in"
                  disabled={zoom >= 250}
                  onClick={() => setZoom((z) => Math.min(250, z + 25))}
                >
                  <Plus size={14} />
                </button>
                <button
                  aria-label="Reset console zoom"
                  title="Reset zoom"
                  onClick={() => setZoom(100)}
                >
                  <Maximize size={14} />
                </button>
              </div>
            </div>
            <div className="console-surface">
              <Panel
                state={state}
                dispatch={dispatch}
                selected={selected}
                select={setSelected}
                engine={engine}
                zoom={zoom}
                outlines={outlines}
              />
            </div>
            <div className="channel-tape" aria-label="Channel source labels">
              {state.channels.map((channel, i) => (
                <button
                  key={i}
                  className={`tape-label ${i === selected ? "selected" : ""} ${missing(channel.source) ? "missing" : ""}`}
                  onClick={() => setSelected(i)}
                  title={channel.name}
                >
                  <span>{CHANNEL_LABELS[i]}</span>
                  <strong>{channel.source ? channel.name : "—"}</strong>
                  <i
                    className={
                      channel.mute ? "muted" : channel.source ? "connected" : ""
                    }
                  />
                </button>
              ))}
            </div>
            <div className="console-hint">
              <span>
                <span className="key-hint">↕</span> Drag knobs & faders <b>·</b>{" "}
                Scroll to fine-tune <b>·</b> Double-click to reset
              </span>
              <button
                className={`power-button ${state.power ? "active" : ""}`}
                aria-label="Mixer power"
                aria-pressed={state.power}
                onClick={() =>
                  dispatch({ type: "power", now: performance.now() })
                }
              >
                <Power size={13} /> {state.power ? "POWER ON" : "POWER OFF"}
              </button>
            </div>
          </section>
          <aside className="inspector">
            <div className="inspector-heading">
              <span className="eyebrow">CHANNEL INSPECTOR</span>
              <div>
                <button
                  aria-label="Previous channel"
                  onClick={() => setSelected((i) => (i + 17) % 18)}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  aria-label="Next channel"
                  onClick={() => setSelected((i) => (i + 1) % 18)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <ChannelInspector
              state={state}
              dispatch={dispatch}
              index={selected}
              files={files}
              missing={missing}
              onImport={importSource}
            />
            <section className="fx-inspector">
              <div className="section-label">
                <span>GIGFX ENGINE</span>
                <span className="approximate">APPROXIMATE DSP</span>
              </div>
              <div className="fx-summary">
                <span
                  className={`mini-display ${state.pending ? "previewing" : ""}`}
                >
                  {String(state.pending?.preset ?? state.preset).padStart(
                    2,
                    "0",
                  )}
                </span>
                <div>
                  <strong>
                    {PRESETS[(state.pending?.preset ?? state.preset) - 1]}
                  </strong>
                  <small>
                    {state.pending
                      ? "Preview · push encoder to apply"
                      : "Active preset"}
                  </small>
                </div>
              </div>
              <div className="fx-browse">
                <button
                  className="button secondary"
                  aria-label="Previous FX preset"
                  disabled={!state.power}
                  onClick={() =>
                    dispatch({
                      type: "presetTurn",
                      delta: -1,
                      now: performance.now(),
                    })
                  }
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  className="button secondary"
                  aria-label="Next FX preset"
                  disabled={!state.power}
                  onClick={() =>
                    dispatch({
                      type: "presetTurn",
                      delta: 1,
                      now: performance.now(),
                    })
                  }
                >
                  <ChevronRight size={14} />
                </button>
                <button
                  className="button secondary apply-fx"
                  disabled={!state.pending || !state.power}
                  onClick={() =>
                    dispatch({ type: "presetConfirm", now: performance.now() })
                  }
                >
                  Push to apply
                </button>
              </div>
              <p>
                Turn up a channel’s FX send and the FX return fader to hear the
                effect.
              </p>
            </section>
            <details className="extra-settings">
              <summary>
                USB returns & practice tools <ChevronDown size={14} />
              </summary>
              <p>Virtual USB inputs; no hardware connection is made.</p>
              {(["usb12Source", "usb34Source"] as const).map((bus, i) => (
                <div className="usb-source" key={bus}>
                  <label>
                    {i === 0
                      ? "USB 1–2 · monitoring blend"
                      : "USB 3–4 · channel 21/22"}
                    <SourceSelect
                      value={state[bus]}
                      files={files}
                      disabled={!state.power}
                      onChange={(source) =>
                        dispatch({ type: "usb", bus, source })
                      }
                    />
                  </label>
                  <FileInput
                    label={`Import USB ${i === 0 ? "1–2" : "3–4"}`}
                    disabled={!state.power}
                    onFile={(file) => importSource(file, bus)}
                  />
                  {missing(state[bus]) && (
                    <p className="missing-source">
                      Missing audio: {sourceLabel(state[bus])}. Import again to
                      relink.
                    </p>
                  )}
                </div>
              ))}
              <button
                className="button secondary full"
                disabled={!state.power || state.globals.fxMute}
                aria-pressed={state.globals.footMute}
                onClick={() =>
                  dispatch({
                    type: "global",
                    key: "footMute",
                    value: !state.globals.footMute,
                  })
                }
              >
                Virtual FX footswitch ·{" "}
                {state.globals.footMute ? "muted" : "live"}
              </button>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={outlines}
                  onChange={(event) => setOutlines(event.target.checked)}
                />{" "}
                Show control outlines
              </label>
            </details>
          </aside>
        </div>
        <section className="audio-dock" aria-label="Audio transport">
          <button
            className={`transport-button ${running ? "playing" : ""}`}
            onClick={togglePlayback}
            disabled={!state.power}
            aria-label={running ? "Stop audio" : "Start audio"}
          >
            {running ? (
              <Square size={16} fill="currentColor" />
            ) : (
              <Play size={17} fill="currentColor" />
            )}
          </button>
          <div className="transport-status">
            <strong>
              {!state.power
                ? "Desk powered off"
                : running
                  ? "Audio is running"
                  : "Ready when you are"}
            </strong>
            <small>
              {running
                ? "Live Web Audio signal · looping sources"
                : "Load the demo band, then start audio"}
            </small>
          </div>
          <span className="dock-divider" />
          <label className="listen-select">
            <Headphones size={17} />
            <span>
              LISTEN TO
              <select
                aria-label="Listen to output"
                value={listenBus}
                onChange={(e) => {
                  const bus = e.target.value as ListenBus;
                  setListenBus(bus);
                  engine.current?.selectBus(bus);
                }}
              >
                {LISTEN_BUSES.map((bus) => (
                  <option key={bus.id} value={bus.id}>
                    {bus.label}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <LiveMeter engine={engine} bus={listenBus} />
          <label className="listening-volume">
            <Volume2 size={17} />
            <span>
              <span>
                LISTENING LEVEL <output>{volume} dB</output>
              </span>
              <input
                type="range"
                aria-label="Listening level"
                min="-60"
                max="0"
                value={volume}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setVolume(value);
                  engine.current?.setVolume(value);
                }}
              />
            </span>
          </label>
        </section>
        <div className="session-footer">
          <span>
            <i className={`status-dot ${soloCount ? "amber" : ""}`} />
            {soloCount
              ? `${soloCount} PFL solo${soloCount > 1 ? "s" : ""} active · main mix unaffected`
              : "Your desk settings save automatically in this browser."}
          </span>
          <button className="text-button" onClick={() => setHelp(true)}>
            <CircleHelp size={13} /> Practice guide & accuracy notes
          </button>
        </div>
        {saveIssue && (
          <p className="missing-source" role="status">
            {saveIssue}
          </p>
        )}
      </main>
      <dialog
        ref={helpRef}
        className="help-dialog"
        onCancel={() => setHelp(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setHelp(false);
        }}
      >
        <div className="dialog-title">
          <div>
            <div className="eyebrow">WELCOME TO YOUR PRACTICE DESK</div>
            <h2>Make your first mix.</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close guide"
            onClick={() => setHelp(false)}
          >
            <X size={20} />
          </button>
        </div>
        <ol className="practice-steps">
          <li>
            <strong>Give the desk something to mix.</strong> Load the demo band,
            then press Start audio. Or select a channel and import your own
            audio.
          </li>
          <li>
            <strong>Set a useful input level.</strong> Engage PFL on a channel,
            select Headphones to listen, and adjust gain. PFL uses the left
            meter and ignores mute and fader.
          </li>
          <li>
            <strong>Build the main mix.</strong> Clear PFL, select Main L/R,
            check L–R assignment, and move the channel and main faders.
          </li>
          <li>
            <strong>Try a monitor mix.</strong> Raise a MON 1 send and listen to
            MON 1. Lower the channel fader: the monitor stays audible. Muting
            the channel silences both.
          </li>
          <li>
            <strong>Group and add space.</strong> Assign channels to 1–2,
            release their L–R assignment, engage the subgroup’s L–R switch. Add
            FX send, raise FX return; browse an effect and push to confirm.
          </li>
        </ol>
        <div className="accuracy-note">
          <strong>A practice tool, with clear limits.</strong>
          <p>
            Routing and controls follow the supplied July 2024 ProFXv3 owner’s
            manual, pages 9–21 and 33–34. FX algorithms, compressor timing,
            filter curves and control tapers are approximations. Meter 0 dBu is
            mapped to −18 dBFS for this simulator. Hardware fidelity has not
            been checked against a physical mixer.
          </p>
          <p>
            Hi-Z stores the correct setting but cannot recreate electrical input
            loading. Condenser source simulation needs 48V enabled. External
            inserts, real USB I/O, recording and microphone capture are not
            implemented.
          </p>
          <p>
            Settings and filenames save locally. Imported audio stays in this
            session only: relink it after reloading. Power and audio playback do
            not resume automatically. Listening level is a separate browser
            playback control.
          </p>
        </div>
        <div className="keyboard-guide">
          <span>
            <kbd>Tab</kbd> Select control
          </span>
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> Adjust
          </span>
          <span>
            <kbd>Shift</kbd> Fine drag / larger keyboard step
          </span>
          <span>
            <kbd>Enter</kbd> Press switch / confirm FX
          </span>
        </div>
        <button
          className="button demo-button full"
          onClick={() => setHelp(false)}
        >
          Back to the desk
        </button>
      </dialog>
    </div>
  );
}

function LiveMeter({
  engine,
  bus,
}: {
  engine: React.RefObject<MixerAudio | null>;
  bus: ListenBus;
}) {
  const [db, setDb] = useState(-120);
  useEffect(() => {
    const id = window.setInterval(
      () => setDb(engine.current?.read().buses[bus] ?? -120),
      120,
    );
    return () => window.clearInterval(id);
  }, [engine, bus]);
  return (
    <div className="listen-meter" aria-label="Listening output level">
      <Activity size={15} />
      <div>
        <div className="horizontal-meter">
          {Array.from({ length: 22 }, (_, i) => (
            <i
              key={i}
              className={`${db > -45 + i * 2.6 ? "lit" : ""} ${i > 18 ? "hot" : ""}`}
            />
          ))}
        </div>
        <small>{db <= -90 ? "NO SIGNAL" : `${db.toFixed(1)} dBu · SIM`}</small>
      </div>
    </div>
  );
}
