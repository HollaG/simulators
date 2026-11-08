import { useEffect, useReducer, useRef, useState } from "react";
import {
  AudioLines,
  CircleHelp,
  Headphones,
  Minus,
  Play,
  Plus,
  RotateCcw,
  Square,
  WandSparkles,
} from "lucide-react";
import { Panel } from "./Panel";
import { StagepasAudio, emptyReadings, type ListenBus } from "./audio";
import {
  CHANNELS,
  INPUTS,
  SOURCE_LABELS,
  STORAGE_KEY,
  activeInputs,
  createDefault,
  mixerReducer,
  powered,
  restoreSession,
  reverbProgram,
  type InputId,
  type SourceKind,
} from "./state";
import "./style.css";

function loadInitial() {
  try {
    return restoreSession(localStorage.getItem(STORAGE_KEY));
  } catch {
    return createDefault();
  }
}
const primaryInputs: InputId[] = [
  "ch1",
  "ch2",
  "ch3",
  "ch4",
  "phone56",
  "phone78",
];
const displayDb = (value: number) => (value <= -100 ? "−∞" : value.toFixed(1));

/** Connects the serializable desk to its audio resources and browser-only tools.
 * File import tokens prevent an old decode from replacing a newer source/reset.
 */
export default function App() {
  const [state, dispatch] = useReducer(mixerReducer, undefined, loadInitial);
  const [selected, setSelected] = useState(0);
  const [inputId, setInputId] = useState<InputId>("ch1");
  const [running, setRunning] = useState(false);
  const [readings, setReadings] = useState(emptyReadings);
  const [zoom, setZoom] = useState(100);
  const [outlines, setOutlines] = useState(false);
  const [help, setHelp] = useState(false);
  const [bus, setBus] = useState<ListenBus>("speakers");
  const [volume, setVolume] = useState(-24);
  const [error, setError] = useState("");
  const [storageIssue, setStorageIssue] = useState("");
  const [fileRevision, setFileRevision] = useState(0);
  const [loading, setLoading] = useState<Partial<Record<InputId, boolean>>>({});
  const engine = useRef<StagepasAudio | null>(null);
  const stateRef = useRef(state);
  const imports = useRef<Partial<Record<InputId, number>>>({});
  stateRef.current = state;
  const on = powered(state);
  const channel = state.channels[selected];
  const input = state.inputs[inputId];
  const availableInputs = (Object.keys(INPUTS) as InputId[]).filter(
    (id) => INPUTS[id].channel === selected,
  );
  const program = reverbProgram(state.reverbTypeTime);
  const missingFile =
    input.kind === "file" && !engine.current?.hasFile(inputId);
  const select = (index: number, id?: InputId) => {
    setSelected(index);
    setInputId(
      (previous) =>
        id ||
        (INPUTS[previous].channel === index ? previous : primaryInputs[index]),
    );
  };
  const ensureEngine = () => {
    if (!engine.current) {
      engine.current = new StagepasAudio();
      engine.current.update(stateRef.current);
      engine.current.selectBus(bus);
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
        let saved: { version?: unknown } | null = null;
        try {
          saved = raw ? JSON.parse(raw) : null;
        } catch {
          /* Replace corrupt JSON with a valid session. */
        }
        if (saved && saved.version !== 1) {
          setStorageIssue(
            "An unsupported saved session was preserved. Changes in this session will not be saved.",
          );
          return;
        }
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ version: 1, state }),
        );
        setStorageIssue("");
      } catch {
        setStorageIssue(
          "Browser storage is unavailable. Keep this tab open to retain your mix.",
        );
      }
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [state, fileRevision]);
  useEffect(() => {
    const timer = window.setInterval(
      () => setReadings(engine.current?.read() || emptyReadings()),
      100,
    );
    return () => window.clearInterval(timer);
  }, []);
  useEffect(
    () => () => {
      void engine.current?.dispose();
    },
    [],
  );
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const target = window as unknown as { __stagepas?: unknown };
    target.__stagepas = {
      get state() {
        return stateRef.current;
      },
      read: () => engine.current?.read() || emptyReadings(),
    };
    return () => {
      delete target.__stagepas;
    };
  }, []);
  const toggleAudio = async () => {
    try {
      const audio = ensureEngine();
      if (running) await audio.stop();
      else await audio.start();
      setRunning(audio.context.state === "running");
      setError("");
    } catch (problem) {
      setError(
        `Audio could not start: ${problem instanceof Error ? problem.message : String(problem)}`,
      );
    }
  };
  const invalidateImports = () => {
    for (const id of Object.keys(INPUTS) as InputId[])
      imports.current[id] = (imports.current[id] || 0) + 1;
    setLoading({});
    engine.current?.clearFiles();
  };
  const loadFile = async (id: InputId, file: File) => {
    const token = (imports.current[id] || 0) + 1;
    imports.current[id] = token;
    setLoading((previous) => ({ ...previous, [id]: true }));
    try {
      const audio = ensureEngine();
      const buffer = await audio.decodeFile(await file.arrayBuffer());
      if (imports.current[id] !== token) return;
      audio.setFile(id, buffer);
      dispatch({
        type: "input",
        id,
        input: { kind: "file", filename: file.name },
      });
      setFileRevision((value) => value + 1);
      setError("");
    } catch (problem) {
      if (imports.current[id] === token)
        setError(
          `Could not read ${file.name}. Choose a browser-supported audio file. ${problem instanceof Error ? problem.message : ""}`,
        );
    } finally {
      if (imports.current[id] === token)
        setLoading((previous) => ({ ...previous, [id]: false }));
    }
  };

  return (
    <main className="sp-main">
      <section className="sp-heading">
        <div>
          <p className="sp-eyebrow">YAMAHA · PORTABLE PA SYSTEM</p>
          <h1>
            STAGEPAS <span>400i</span>
          </h1>
          <p>A little desk. A whole live mix.</p>
        </div>
        <div className="sp-actions">
          <button className="primary" onClick={() => void toggleAudio()}>
            {running ? <Square size={14} /> : <Play size={14} />}
            {running ? "Stop audio" : "Start audio"}
          </button>
          <button
            onClick={() => {
              invalidateImports();
              dispatch({ type: "demo" });
              setError("");
            }}
          >
            <WandSparkles size={15} /> Load demo band
          </button>
          <button
            title="Clear the desk and disconnect inputs"
            onClick={() => {
              invalidateImports();
              dispatch({ type: "reset" });
              setError("");
            }}
          >
            <RotateCcw size={14} /> Reset
          </button>
          <button
            aria-pressed={help}
            onClick={() => setHelp((value) => !value)}
          >
            <CircleHelp size={15} /> Practice guide
          </button>
        </div>
      </section>
      {help && (
        <section className="sp-guide">
          <div>
            <p className="sp-eyebrow">YOUR FIRST SOUND CHECK</p>
            <h2>Connect. Balance. Add a little space.</h2>
          </div>
          <ol>
            <li>
              Load the demo band, then press <strong>Start audio</strong>. Audio
              starts quietly; browser listening volume is separate from the
              desk.
            </li>
            <li>
              Drag the white channel knobs to balance the band. Turn the red
              MASTER LEVEL knob; MONITOR OUT stays independent.
            </li>
            <li>
              Raise CH 1 REVERB, press REVERB ON, and turn TYPE/TIME through
              HALL, PLATE, ROOM and ECHO.
            </li>
            <li>
              Click any input jack to change its source. A condenser microphone
              on CH 1/2 needs PHANTOM. CH 4 accepts a passive guitar with Hi-Z.
            </li>
          </ol>
          <p>
            Knobs: drag vertically, scroll, or use arrow keys. Shift makes
            dragging finer and arrow steps larger. Home/End set limits;
            double-click resets. Zoom and scroll the panel on small screens.
          </p>
          <p>
            Approximate Yamaha DSP and analog behaviour. Feedback uses a
            synthetic test signal and seven adaptive notches; no room acoustics
            or hardware protection is emulated. Local files loop and need
            relinking after a reload.
          </p>
        </section>
      )}
      {(error || storageIssue) && (
        <p className="sp-notice" role="alert">
          {error || storageIssue}
        </p>
      )}
      <div className="sp-workbench">
        <section className="sp-console" aria-label="STAGEPAS mixer">
          <div className="sp-console-tools">
            <span className={`sp-status ${on ? "on" : ""}`}>
              <i />
              {on
                ? "Mixer on"
                : state.power && !state.ac
                  ? "No AC power"
                  : "Mixer off"}
              <small>8 INPUTS / 6 STRIPS</small>
            </span>
            <div className="sp-zoom">
              <button
                aria-label="Zoom out"
                disabled={zoom <= 70}
                onClick={() => setZoom((value) => Math.max(70, value - 10))}
              >
                <Minus size={14} />
              </button>
              <output aria-label="Panel zoom">{zoom}%</output>
              <button
                aria-label="Zoom in"
                disabled={zoom >= 180}
                onClick={() => setZoom((value) => Math.min(180, value + 10))}
              >
                <Plus size={14} />
              </button>
              <button
                className="sp-hit-targets"
                aria-pressed={outlines}
                onClick={() => setOutlines((value) => !value)}
              >
                Hit targets
              </button>
            </div>
          </div>
          <Panel
            state={state}
            dispatch={dispatch}
            readings={readings}
            zoom={zoom}
            outlines={outlines}
            selected={selected}
            select={select}
          />
          <div className="sp-panel-caption">
            <span>
              <AudioLines size={14} /> Your panel, with live controls.
            </span>
            <span>DRAG TO TURN · CLICK TO SWITCH</span>
          </div>
          <div className="sp-listening">
            <Headphones size={18} />
            <div>
              <strong>Listen to the mix</strong>
              <small>
                {running
                  ? on
                    ? "Audio running"
                    : "Audio ready · mixer off"
                  : "Press Start audio to hear your changes"}
              </small>
            </div>
            <label>
              Output
              <select
                aria-label="Listening output"
                value={bus}
                onChange={(event) => {
                  const next = event.target.value as ListenBus;
                  setBus(next);
                  engine.current?.selectBus(next);
                }}
              >
                <option value="speakers">Speakers L/R</option>
                <option value="monitor">Monitor out</option>
                <option value="sub">Subwoofer out</option>
              </select>
            </label>
            <label className="sp-listen-volume">
              Listening volume <span>{volume} dB</span>
              <input
                aria-label="Listening volume"
                type="range"
                min={-48}
                max={0}
                value={volume}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setVolume(value);
                  engine.current?.setVolume(value);
                }}
              />
            </label>
          </div>
          {((bus === "sub" && !state.sub) ||
            (bus === "monitor" && !state.monitorL && !state.monitorR) ||
            (bus === "speakers" && !state.speakerL && !state.speakerR)) && (
            <p className="sp-inline-note">
              No cable connected to this output. Click its jack on the panel to
              connect it.
            </p>
          )}
          <div className="sp-meters" aria-label="Measured output levels">
            {(
              [
                ["speakers", "SPEAKERS"],
                ["monitor", "MONITOR"],
                ["sub", "SUBWOOFER"],
                ["reverb", "REVERB RETURN"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <div>
                  <span>{label}</span>
                  <output data-testid={`meter-${key}`}>
                    {displayDb(readings[key])} <small>dBFS</small>
                  </output>
                </div>
                <meter
                  aria-label={`${label} measured level`}
                  min={-60}
                  max={0}
                  low={-30}
                  high={-6}
                  optimum={-18}
                  value={Math.max(-60, readings[key])}
                />
              </div>
            ))}
          </div>
        </section>
        <aside
          className="sp-inspector"
          aria-label="Channel and source inspector"
        >
          <p className="sp-eyebrow">GET TO KNOW YOUR SIGNAL</p>
          <h2>
            Channel <span>{CHANNELS[selected]}</span>
          </h2>
          <div className="sp-channel-tabs" aria-label="Select channel">
            {CHANNELS.map((name, i) => (
              <button
                key={name}
                aria-label={`Select channel ${name}`}
                aria-pressed={selected === i}
                onClick={() => select(i)}
              >
                {name}
              </button>
            ))}
          </div>
          <label className="sp-field">
            Input connection
            <select
              aria-label="Input connection"
              value={inputId}
              onChange={(event) => setInputId(event.target.value as InputId)}
            >
              {availableInputs.map((id) => (
                <option key={id} value={id}>
                  {INPUTS[id].label}
                </option>
              ))}
            </select>
          </label>
          <label className="sp-field">
            Source
            <select
              aria-label="Source"
              value={input.kind}
              onChange={(event) => {
                imports.current[inputId] = (imports.current[inputId] || 0) + 1;
                setLoading((previous) => ({ ...previous, [inputId]: false }));
                if (event.target.value !== "file")
                  engine.current?.clearFile(inputId);
                dispatch({
                  type: "input",
                  id: inputId,
                  input: { kind: event.target.value as SourceKind },
                });
              }}
            >
              {Object.entries(SOURCE_LABELS)
                .filter(([kind]) => kind !== "condenser" || selected < 2)
                .map(([kind, name]) => (
                  <option key={kind} value={kind}>
                    {name}
                  </option>
                ))}
            </select>
          </label>
          {selected >= 2 && selected <= 3 && (
            <label className="sp-field">
              Combo plug
              <select
                aria-label="Combo plug"
                value={input.plug}
                onChange={(event) =>
                  dispatch({
                    type: "input",
                    id: inputId,
                    input: { plug: event.target.value as "xlr" | "phone" },
                  })
                }
              >
                <option value="xlr">XLR</option>
                <option value="phone">¼-inch phone</option>
              </select>
            </label>
          )}
          {input.kind === "file" && (
            <div className="sp-file">
              <label>
                {loading[inputId]
                  ? "Decoding audio…"
                  : missingFile
                    ? "Relink file"
                    : "Choose audio file"}
                <input
                  aria-label="Local audio file"
                  type="file"
                  accept="audio/*,.wav,.mp3,.ogg,.m4a,.flac"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void loadFile(inputId, file);
                    event.target.value = "";
                  }}
                />
              </label>
              <small>
                {input.filename || "Choose a file from this device"}
              </small>
              <small>Loops in this tab. Relink after reloading.</small>
            </div>
          )}
          <div
            className={`sp-source-state ${activeInputs(state, selected).includes(inputId) ? "connected" : ""}`}
          >
            <i />
            {input.kind === "none"
              ? "No source connected"
              : missingFile
                ? "File missing · relink to play"
                : activeInputs(state, selected).includes(inputId)
                  ? "Connected to this channel"
                  : "Connected · muted by priority jack"}
          </div>
          {input.kind === "condenser" && !state.phantom && (
            <p className="sp-inline-note">
              Enable PHANTOM CH 1/2 to power this microphone.
            </p>
          )}
          {selected === 3 &&
            input.kind === "guitar" &&
            input.plug === "phone" &&
            !state.hiZ && (
              <p className="sp-inline-note">
                Try Hi-Z for this passive guitar. It restores the simulated
                pickup's high frequencies.
              </p>
            )}
          <label className="sp-field sp-range">
            Source volume{" "}
            <output>
              {input.volume > 0 ? "+" : ""}
              {input.volume} dB
            </output>
            <input
              aria-label="Source volume"
              type="range"
              min={-24}
              max={6}
              value={input.volume}
              onChange={(event) =>
                dispatch({
                  type: "input",
                  id: inputId,
                  input: { volume: Number(event.target.value) },
                })
              }
            />
          </label>
          <div className="sp-strip-values">
            <span>
              LEVEL <strong>{channel.level.toFixed(1)}</strong>
            </span>
            <span>
              LOW{" "}
              <strong>
                {channel.low > 0 ? "+" : ""}
                {channel.low} dB
              </strong>
            </span>
            <span>
              HIGH{" "}
              <strong>
                {channel.high > 0 ? "+" : ""}
                {channel.high} dB
              </strong>
            </span>
            {selected < 4 && (
              <span>
                REVERB <strong>{channel.reverb.toFixed(1)}</strong>
              </span>
            )}
          </div>
          <div className="sp-routing">
            <p className="sp-eyebrow">SIGNAL PATH</p>
            <p>
              {selected < 4
                ? `${channel.mic ? "MIC" : "LINE"} → EQ → LEVEL → mix`
                : `${channel.mono ? "MONO" : "STEREO"} → EQ → LEVEL → mix`}
            </p>
            <p>
              {selected === 4
                ? "Phone jacks take priority over RCA."
                : selected === 5
                  ? "Mini takes priority over phone. USB always adds to the mix."
                  : "Reverb is sent after the channel level."}
            </p>
          </div>
          <div className="sp-effects">
            <div>
              <span>REVERB</span>
              <strong>{program.name}</strong>
              <small>
                {on && state.reverbOn ? "On" : "Off"} ·{" "}
                {Math.round(program.amount * 100)}% time
              </small>
            </div>
            <div>
              <span>FEEDBACK FILTERS</span>
              <strong>
                {readings.notches.length} <small>/ 7</small>
              </strong>
              <small>
                {readings.notches.length
                  ? readings.notches
                      .map((hz) => `${Math.round(hz)} Hz`)
                      .join(", ")
                  : "No learned notches"}
              </small>
            </div>
          </div>
          <button
            className="sp-foot"
            disabled={!on || !state.footswitch}
            onClick={() => dispatch({ type: "foot" })}
          >
            Tap footswitch{" "}
            <span>
              {state.footswitch ? "FC5 · connected" : "Connect FOOT SW jack"}
            </span>
          </button>
        </aside>
      </div>
      <div className="sp-accuracy">
        <span className="sp-eyebrow">A PRACTICE DESK, IN YOUR BROWSER</span>
        <p>
          Real signal paths. Approximate analog sound and Yamaha DSP. All media
          stays on your device. Settings are saved here; power and reverb start
          off when you return.
        </p>
      </div>
    </main>
  );
}
