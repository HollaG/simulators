import { useEffect, useReducer, useRef, useState } from "react";
import {
  AudioLines,
  Headphones,
  Play,
  Square,
  RotateCcw,
  CircleHelp,
  SlidersHorizontal,
} from "lucide-react";
import { Panel } from "./Panel";
import { MixerAudio, emptyReadings, type ListenBus } from "./audio";
import {
  CHANNELS,
  INPUTS,
  SOURCES,
  PROGRAMS,
  STORAGE_KEY,
  activeInputs,
  createDefault,
  mixerReducer,
  restoreSession,
  fxActive,
  type InputId,
  type SourceKind,
} from "./state";
import "./style.css";

const buses: Record<ListenBus, string> = {
  stereo: "STEREO OUT",
  monitor: "MONITOR OUT",
  phones: "PHONES",
  fx: "FX SEND",
  usb: "USB RECORD",
};
const displayDb = (n: number) => (n < -100 ? "−∞" : n.toFixed(1));
function initialSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && JSON.parse(raw)?.version !== 1)
      return {
        state: createDefault(),
        canSave: false,
        issue:
          "Saved settings use an unsupported version. They have been preserved. Reset desk to replace them.",
      };
    return { state: restoreSession(raw), canSave: true, issue: "" };
  } catch {
    return { state: createDefault(), canSave: true, issue: "" };
  }
}

/** The desk owns serializable settings; this component connects them to browser
 * audio and file resources. Request generations prevent late async work from
 * undoing a newer source choice, reset, stop, or component teardown.
 */
export default function App() {
  const [session] = useState(initialSession);
  const [state, dispatch] = useReducer(mixerReducer, session.state);
  const storageWritable = useRef(session.canSave);
  const [selected, setSelected] = useState(0),
    [inputId, setInputId] = useState<InputId>("ch1");
  const [running, setRunning] = useState(false),
    [starting, setStarting] = useState(false);
  const [readings, setReadings] = useState(emptyReadings),
    [bus, setBus] = useState<ListenBus>("stereo");
  const [volume, setVolume] = useState(-30),
    [zoom, setZoom] = useState(100);
  const [outlines, setOutlines] = useState(false),
    [help, setHelp] = useState(false);
  const [error, setError] = useState(""),
    [storageIssue, setStorageIssue] = useState(session.issue);
  const [loading, setLoading] = useState(false),
    [fileRevision, setFileRevision] = useState(0);
  const engine = useRef<MixerAudio | null>(null),
    stateRef = useRef(state);
  const imports = useRef<Partial<Record<InputId, number>>>({}),
    playbackRequest = useRef(0);
  const importRevision = useRef(0);
  stateRef.current = state;
  const input = state.inputs[inputId],
    channel = state.channels[selected];
  const active = activeInputs(state),
    program = PROGRAMS[state.program - 1];
  const fileMissing =
    input.kind === "file" && !engine.current?.hasFile(inputId, input.filename);
  const select = (index: number, id?: InputId) => {
    setSelected(index);
    setInputId(id || activeInputs(stateRef.current)[index]);
  };
  const getEngine = () => engine.current ?? (engine.current = new MixerAudio());

  useEffect(() => {
    if (storageWritable.current) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ version: 1, settings: state }),
        );
        setStorageIssue("");
      } catch {
        setStorageIssue(
          "This browser could not save your settings. The current desk still works.",
        );
      }
    }
    engine.current?.update(state, bus, volume);
  }, [state, bus, volume, running, fileRevision]);
  useEffect(() => {
    const tick = window.setInterval(
      () => dispatch({ type: "tick", now: performance.now() }),
      100,
    );
    return () => {
      clearInterval(tick);
      playbackRequest.current++;
      imports.current = {};
      void engine.current?.dispose();
    };
  }, []);
  useEffect(() => {
    if (!running) {
      setReadings(emptyReadings());
      return;
    }
    const timer = window.setInterval(
      () => setReadings(engine.current?.readings() ?? emptyReadings()),
      70,
    );
    return () => clearInterval(timer);
  }, [running]);

  async function toggleAudio() {
    const request = ++playbackRequest.current;
    setError("");
    try {
      const audio = getEngine();
      if (running) {
        await audio.stop();
        setRunning(false);
        return;
      }
      setStarting(true);
      await audio.start();
      if (request !== playbackRequest.current) {
        await audio.stop();
        return;
      }
      audio.update(stateRef.current, bus, volume);
      setRunning(true);
    } catch (e) {
      setError(
        `Audio could not start: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      if (request === playbackRequest.current) setStarting(false);
    }
  }
  async function importAudio(file: File | undefined) {
    if (!file) return;
    const id = inputId,
      token = ++importRevision.current;
    imports.current[id] = token;
    setLoading(true);
    setError("");
    try {
      const audio = getEngine(),
        decoded = await audio.decode(await file.arrayBuffer());
      if (imports.current[id] !== token) return;
      audio.putFile(id, file.name, decoded);
      dispatch({
        type: "input",
        id,
        patch: { kind: "file", filename: file.name, plug: "phone" },
      });
      setFileRevision((n) => n + 1);
    } catch {
      if (imports.current[id] === token)
        setError(
          "This file could not be decoded. Choose a browser-supported audio file.",
        );
    } finally {
      if (imports.current[id] === token) setLoading(false);
    }
  }
  function changeSource(kind: SourceKind) {
    imports.current[inputId] = ++importRevision.current;
    setLoading(false);
    dispatch({
      type: "input",
      id: inputId,
      patch: {
        kind,
        filename: kind === "file" ? input.filename : "",
        plug: kind === "voice" || kind === "condenser" ? "xlr" : "phone",
      },
    });
  }
  function reset(demo = false) {
    // Only an explicit reset replaces a session written by an unknown newer version.
    if (!demo) storageWritable.current = true;
    imports.current = {};
    setLoading(false);
    engine.current?.clearFiles();
    setError("");
    dispatch({ type: demo ? "demo" : "reset" });
    select(0, "ch1");
  }
  const meter = (id: ListenBus) => (
    <div className="mg-readout" key={id}>
      <div>
        <span>{buses[id]}</span>
        <strong>
          {displayDb(readings[id])}
          <small> dBu</small>
        </strong>
      </div>
      <meter
        aria-label={`${buses[id]} measured level`}
        min={-60}
        max={20}
        low={-20}
        high={10}
        optimum={0}
        value={Math.max(-60, readings[id])}
      />
    </div>
  );
  return (
    <main className="mg-main">
      <div className="mg-heading">
        <div>
          <p className="mg-eyebrow">THE AUDIO PRACTICE DESK / 04</p>
          <h1>
            Yamaha <span>MG10XU</span>
          </h1>
          <p>A small desk. A complete mix. Learn every turn.</p>
        </div>
        <div className="mg-actions">
          <button
            className="primary"
            disabled={starting}
            onClick={() => void toggleAudio()}
          >
            {running ? <Square size={14} /> : <Play size={14} />}
            {starting ? "Starting…" : running ? "Stop audio" : "Start audio"}
          </button>
          <button onClick={() => reset(true)}>
            <AudioLines size={15} />
            Load demo band
          </button>
          <button onClick={() => reset()}>
            <RotateCcw size={14} />
            Reset desk
          </button>
          <button aria-pressed={help} onClick={() => setHelp((v) => !v)}>
            <CircleHelp size={15} />
            Guide
          </button>
        </div>
      </div>
      {(error || storageIssue) && (
        <p role="alert" className="mg-notice">
          {error || storageIssue}
        </p>
      )}
      {help && (
        <section className="mg-help">
          <h2>Your first mix</h2>
          <ol>
            <li>
              Load the demo band, then start audio. Listening starts quietly.
            </li>
            <li>
              Drag CH 1 GAIN and LEVEL. Use HPF to reduce rumble and COMP to
              even the peaks.
            </li>
            <li>
              Wheel PROGRAM to preview an effect, then click it to confirm. Set
              CH 1 FX, FX ON and FX RTN LEVEL.
            </li>
            <li>
              Select USB for 9/10, release TO MON / TO ST to route to MON, then
              engage STEREO MUTE. Listen to PHONES: only the computer return
              remains.
            </li>
          </ol>
          <p>
            Knobs: drag vertically, wheel, or use arrow keys; Shift gives larger
            keyboard/wheel steps and finer dragging. Home/End set endpoints;
            double-click resets. PROGRAM: wheel/arrows preview, click/Enter
            confirms; drag while held commits immediately. Five quick presses
            edit USB attenuation; press again exits.
          </p>
          <p>
            Settings restore on reload with power off. Local files are
            session-only; relink them after reload. Effects and analog curves
            are approximations. No microphone permission or hardware connection
            is needed.
          </p>
        </section>
      )}
      <div className="mg-workbench">
        <section className="mg-desk" aria-label="MG10XU console">
          <div className="mg-panel-toolbar">
            <span>
              <i className={state.power ? "on" : ""} />
              {state.power ? "DESK ON" : "STANDBY"}
            </span>
            <div>
              <button
                aria-label="Zoom out"
                onClick={() => setZoom((n) => Math.max(70, n - 10))}
              >
                −
              </button>
              <span>{zoom}%</span>
              <button
                aria-label="Zoom in"
                onClick={() => setZoom((n) => Math.min(180, n + 10))}
              >
                +
              </button>
              <button
                aria-pressed={outlines}
                onClick={() => setOutlines((v) => !v)}
              >
                <SlidersHorizontal size={12} />
                Targets
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
          <div className="mg-rear">
            <span>REAR PANEL</span>
            <button
              aria-label="Mixer power"
              aria-pressed={state.power}
              onClick={() => dispatch({ type: "toggle", param: "power" })}
            >
              Power {state.power ? "ON" : "STANDBY"}
            </button>
            <button
              aria-pressed={state.usbConnected}
              onClick={() =>
                dispatch({ type: "toggle", param: "usbConnected" })
              }
            >
              USB cable {state.usbConnected ? "connected" : "disconnected"}
            </button>
            <button
              aria-pressed={state.footConnected}
              onClick={() =>
                dispatch({ type: "toggle", param: "footConnected" })
              }
            >
              Footswitch {state.footConnected ? "connected" : "disconnected"}
            </button>
            <button
              disabled={!state.power || !state.footConnected || !state.fxOn}
              onClick={() => dispatch({ type: "foot" })}
            >
              Press footswitch
            </button>
          </div>
          <div className="mg-listen">
            <Headphones size={20} />
            <label>
              Listen to
              <select
                aria-label="Listening output"
                value={bus}
                onChange={(e) => setBus(e.target.value as ListenBus)}
              >
                {Object.entries(buses).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mg-volume">
              Browser volume <strong>{volume} dB</strong>
              <input
                aria-label="Browser listening volume"
                type="range"
                min={-60}
                max={-6}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
              />
            </label>
            <span className="mg-listen-note">
              Listening volume leaves desk meters unchanged.
            </span>
          </div>
        </section>
        <aside className="mg-sidebar" aria-label="Practice tools">
          <section className="mg-card">
            <div className="mg-card-heading">
              <span>01 / INPUT PATCH</span>
              <AudioLines size={15} />
            </div>
            <div className="mg-channel-tabs">
              {CHANNELS.map((label, i) => (
                <button
                  key={i}
                  aria-pressed={selected === i}
                  onClick={() => select(i)}
                >
                  {label}
                </button>
              ))}
            </div>
            <h2>Channel {CHANNELS[selected]}</h2>
            <label>
              Input socket
              <select
                aria-label="Input socket"
                value={inputId}
                onChange={(e) => setInputId(e.target.value as InputId)}
              >
                {(Object.keys(INPUTS) as InputId[])
                  .filter((id) => INPUTS[id].channel === selected)
                  .map((id) => (
                    <option key={id} value={id}>
                      {INPUTS[id].label}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Practice source
              <select
                aria-label="Practice source"
                value={input.kind}
                onChange={(e) => changeSource(e.target.value as SourceKind)}
              >
                {Object.entries(SOURCES).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            {selected < 4 && (
              <label>
                Connector
                <select
                  aria-label="Input connector"
                  value={input.plug}
                  onChange={(e) =>
                    dispatch({
                      type: "input",
                      id: inputId,
                      patch: { plug: e.target.value as "xlr" | "phone" },
                    })
                  }
                >
                  <option value="xlr">XLR</option>
                  <option value="phone">Phone</option>
                </select>
              </label>
            )}
            {inputId === "line910" && (
              <label className="mg-check">
                <input
                  type="checkbox"
                  checked={input.mono}
                  onChange={(e) =>
                    dispatch({
                      type: "input",
                      id: inputId,
                      patch: { mono: e.target.checked },
                    })
                  }
                />
                L/MONO only (R unplugged)
              </label>
            )}
            <label>
              Source level <strong>{input.db} dB</strong>
              <input
                aria-label="Source level"
                type="range"
                min={-36}
                max={12}
                value={input.db}
                onChange={(e) =>
                  dispatch({
                    type: "input",
                    id: inputId,
                    patch: { db: Number(e.target.value) },
                  })
                }
              />
            </label>
            <label className="mg-file">
              {loading ? "Decoding audio…" : "Load / relink audio file"}
              <input
                aria-label="Load local audio"
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  void importAudio(e.target.files?.[0]);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            {input.filename && <p className="mg-filename">{input.filename}</p>}
            {fileMissing && (
              <p className="mg-notice">
                File missing after reload. Relink it above; this input stays
                silent.
              </p>
            )}
            {input.kind === "condenser" &&
              (!state.phantom || input.plug !== "xlr") && (
                <p className="mg-notice">
                  This condenser needs XLR and PHANTOM +48V.
                </p>
              )}
            {active[selected] !== inputId && input.kind !== "none" && (
              <p className="mg-notice">
                This socket is overridden by {INPUTS[active[selected]].label}.
                Check input priority or LINE / USB.
              </p>
            )}
            <div className="mg-strip-values">
              <span>
                LEVEL <b>{channel.level.toFixed(1)}</b>
              </span>
              <span>
                FX SEND <b>{channel.fx.toFixed(1)}</b>
              </span>
              <span>
                POST EQ <b>{displayDb(readings.peaks[selected])} dBu peak</b>
              </span>
            </div>
          </section>
          <section className="mg-card">
            <div className="mg-card-heading">
              <span>02 / OUTPUT METERS</span>
              <Headphones size={15} />
            </div>
            <h2>Follow the signal</h2>
            {(Object.keys(buses) as ListenBus[]).map(meter)}
            <p className="mg-note">
              Measured audio, referenced to nominal 0 dBu at −20 dBFS. USB
              record is before STEREO LEVEL. Monitor feed is before the stereo
              master. Keep CH 9/10 FX at zero when isolating a DAW return:
              TO MON diverts its dry signal, but its FX send remains active.
            </p>
          </section>
          <section className="mg-card">
            <div className="mg-card-heading">
              <span>03 / SPX EFFECTS</span>
              <span className="mg-badge">
                {fxActive(state)
                  ? "ACTIVE"
                  : state.footBypass
                    ? "FOOT BYPASS"
                    : "OFF"}
              </span>
            </div>
            <h2>
              {String(state.program).padStart(2, "0")} · {program[0]}
            </h2>
            <p>
              {program[1]}{" "}
              <strong>
                {state.parameters[state.program - 1].toFixed(1)} / 10
              </strong>
            </p>
            <p className="mg-note">
              Turn PROGRAM, then press it to confirm. Each program recalls its
              parameter. The PARAMETER knob takes over when moved.
            </p>
            {state.pending !== null && (
              <p className="mg-notice" role="status">
                Preview: {PROGRAMS[state.pending - 1][0]} · press PROGRAM to
                apply.
              </p>
            )}
            {state.editingAttenuator && (
              <p className="mg-notice" role="status">
                USB attenuator: {state.attenuator} dB. Turn PROGRAM to adjust;
                press to exit.
              </p>
            )}
            <details>
              <summary>24 programs & accuracy notes</summary>
              <ol className="mg-programs">
                {PROGRAMS.map(([name, parameter]) => (
                  <li key={name}>
                    {name}
                    <small>{parameter}</small>
                  </li>
                ))}
              </ol>
              <p className="mg-note">
                All families process audio. Reverb, compressor, pan law, pitch
                shifting and parameter ranges approximate the desk. Exact SPX
                algorithms, analog saturation and real USB recording are outside
                this simulator.
              </p>
            </details>
          </section>
        </aside>
      </div>
      <p className="mg-accuracy">
        UNOFFICIAL PRACTICE SIMULATOR · Based on your MG10XU manual and photo.
        Physical workflow reproduced; DSP sound and analog response
        approximated.
      </p>
    </main>
  );
}
