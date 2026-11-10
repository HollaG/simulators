import {
  useEffect,
  useReducer,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import {
  RecorderAudio,
  floatWav,
  recordedFiles,
  silentReadings,
} from "./audio";
import { Display } from "./Display";
import { boundsStyle, buttons, lights, photoOutline, screen } from "./panel";
import {
  currentTake,
  defaults,
  enabled,
  formatTime,
  gainLabel,
  homeItems,
  initialState,
  isPlayback,
  loadConfig,
  mixerGain,
  reducer,
  settings,
  STORAGE_KEY,
  TRACKS,
  type Action,
  type Source,
  type State,
} from "./state";
import "./style.css";

function restore() {
  try {
    return initialState(loadConfig(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return initialState();
  }
}
type AppAction = Action | { type: "RESET" };
const appReducer = (s: State, a: AppAction) =>
  a.type === "RESET"
    ? { ...initialState(defaults()), nextId: s.nextId + 1 }
    : reducer(s, a);

/** Owns browser resources and renders the panel; the reducer owns device rules.
 * Session tokens prevent a render that finishes after reset from restoring an old take.
 */
export default function App() {
  const [state, dispatch] = useReducer(appReducer, undefined, restore);
  const [readings, setReadings] = useState(silentReadings);
  const [now, setNow] = useState(performance.now());
  const [listen, setListen] = useState(false);
  const [outlines, setOutlines] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [resetConfirm, setResetConfirm] = useState(false);
  const engine = useRef(new RecorderAudio());
  const session = useRef(0);
  const saving = useRef(new Set<number>());
  const current = useRef(state);
  current.current = state;
  const hold = useRef<{
    timer: ReturnType<typeof setTimeout>;
    interval?: ReturnType<typeof setInterval>;
    moved: boolean;
  } | null>(null);
  const lastHoldMoved = useRef(false);
  const dialDrag = useRef<{ y: number; moved: boolean } | null>(null);
  const act = (type: Action["type"], extra: object = {}) =>
    dispatch({ type, now: performance.now(), ...extra } as Action);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const time = performance.now();
      setNow(time);
      dispatch({ type: "TICK", now: time });
      setReadings(engine.current.read(current.current));
    }, 60);
    return () => {
      clearInterval(timer);
      engine.current.close();
    };
  }, []);
  useEffect(() => {
    engine.current.sync(state, listen);
  }, [state, listen]);
  useEffect(() => {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing) {
        try {
          if (JSON.parse(existing).version !== 1) {
            setStorageError(
              "Settings from a newer version were left untouched; this session will not be saved.",
            );
            return;
          }
        } catch {
          /* A malformed old value can be replaced with validated settings. */
        }
      }
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 1, config: state.config }),
      );
    } catch {
      setStorageError(
        "Settings cannot be saved in this browser. This session still works.",
      );
    }
  }, [state.config]);
  useEffect(() => {
    const take = state.pending;
    if (!take || saving.current.has(take.id)) return;
    saving.current.add(take.id);
    const token = session.current,
      audio = engine.current;
    void audio
      .render(take)
      .then(() => {
        if (session.current === token) dispatch({ type: "SAVED", id: take.id });
        else audio.buffers.delete(take.id);
      })
      .catch(() => {
        if (session.current === token)
          dispatch({
            type: "ERROR",
            id: take.id,
            message: "Could not render this take. Try a shorter recording.",
          });
      });
  }, [state.pending]);

  const cancelHold = () => {
    if (!hold.current) return;
    clearTimeout(hold.current.timer);
    clearInterval(hold.current.interval);
    lastHoldMoved.current = hold.current.moved;
    hold.current = null;
  };
  useEffect(() => {
    const cancel = () => {
      cancelHold();
      dialDrag.current = null;
    };
    window.addEventListener("blur", cancel);
    const visibility = () => {
      if (document.hidden) cancel();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancel();
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    if (!state.power || state.hold || !isPlayback(state)) cancelHold();
  }, [state.power, state.hold, state.mode]);

  // DEV-only observations let browser tests measure actual audio and recording samples.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    Object.assign(window, { __h6: { state, readings, audio: engine.current } });
    return () => {
      delete (window as unknown as Record<string, unknown>).__h6;
    };
  }, [state, readings]);

  async function power() {
    if (!state.power) {
      try {
        await engine.current.start();
      } catch {
        act("ERROR", {
          message: "Audio could not start. Try the power button again.",
        });
        return;
      }
    }
    act("POWER");
  }

  function startHold(
    event: PointerEvent<HTMLButtonElement>,
    direction: number,
  ) {
    if (!isPlayback(current.current) || current.current.hold) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    lastHoldMoved.current = false;
    hold.current = {
      moved: false,
      timer: setTimeout(() => {
        if (!hold.current) return;
        hold.current.moved = true;
        act("SEEK", { value: direction * 0.8 });
        hold.current.interval = setInterval(
          () => act("SEEK", { value: direction * 0.8 }),
          100,
        );
      }, 400),
    };
  }

  function reset() {
    session.current++;
    cancelHold();
    engine.current.close();
    engine.current = new RecorderAudio();
    saving.current.clear();
    setReadings(silentReadings());
    setListen(false);
    setResetConfirm(false);
    dispatch({ type: "RESET" });
  }

  function download(id: number, channels: number[], name: string) {
    const buffer = engine.current.buffers.get(id);
    if (!buffer) return;
    const url = URL.createObjectURL(
      new Blob([floatWav(buffer, channels)], { type: "audio/wav" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name}.WAV`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const dialLabel =
    state.screen === "mixer"
      ? `${TRACKS[state.cursor]} ${gainLabel(mixerGain(state, state.cursor))}`
      : ["rec", "input"].includes(state.screen) &&
          (state.inside || state.screen === "rec")
        ? settings(state)[state.cursor]?.label || "Back"
        : state.screen === "input"
          ? TRACKS[state.cursor] || "Back"
          : homeItems(state)[state.cursor] || "Select";
  const disabled = !state.power || state.hold || state.mode === "saving";
  const take = currentTake(state);
  const status = !state.power
    ? "Powered off"
    : state.hold
      ? "HOLD"
      : state.mode === "idle"
        ? "Ready to record"
        : state.mode;

  return (
    <main className="h6-app">
      <svg
        width="0"
        height="0"
        style={{ position: "absolute" }}
        aria-hidden="true"
      >
        <defs>
          <clipPath id="h6-photo-outline" clipPathUnits="objectBoundingBox">
            <path d={photoOutline} clipRule="evenodd" />
          </clipPath>
        </defs>
      </svg>
      <header className="h6-heading">
        <div>
          <p className="h6-eyebrow">
            FIELD NOTES / 05 <span>HANDY RECORDER</span>
          </p>
          <h1>
            H6<span>essential</span>
          </h1>
          <p>Find your levels. Capture the moment.</p>
        </div>
        <div className={`h6-status ${state.mode}`}>
          <i />
          {status}
        </div>
      </header>
      <div className="h6-workspace">
        <section
          className="h6-device-card"
          aria-label="Recorder physical controls"
        >
          <div className="h6-section-label">
            <span>01 / THE RECORDER</span>
            <label>
              <input
                type="checkbox"
                checked={outlines}
                onChange={(e) => setOutlines(e.target.checked)}
              />{" "}
              Show controls
            </label>
          </div>
          <div className="h6-device-area">
            <div className={`h6-panel ${outlines ? "outlines" : ""}`}>
              <img
                src={`${import.meta.env.BASE_URL}panel.jpg`}
                alt="Zoom H6essential front panel"
                draggable="false"
              />
              {buttons.map((button) => {
                const direction =
                  button.id === "rew" ? -1 : button.id === "ff" ? 1 : 0;
                return (
                  <button
                    key={button.id}
                    style={boundsStyle(button)}
                    className={`h6-hit ${button.id}`}
                    aria-label={button.label}
                    title={button.label}
                    disabled={disabled}
                    aria-pressed={
                      "track" in button
                        ? enabled(state, button.track!)
                        : button.id === "mixer"
                          ? state.screen === "mixer"
                          : undefined
                    }
                    onPointerDown={(e) => {
                      if (direction) startHold(e, direction);
                    }}
                    onPointerUp={cancelHold}
                    onPointerCancel={cancelHold}
                    onLostPointerCapture={cancelHold}
                    onClick={() => {
                      if (direction) {
                        if (!lastHoldMoved.current)
                          act("SKIP", { value: direction });
                        lastHoldMoved.current = false;
                      } else if ("track" in button)
                        act("TRACK", { index: button.track });
                      else
                        act(
                          (
                            {
                              mixer: "MIXER",
                              stop: "STOP",
                              play: "PLAY",
                              rec: "REC",
                            } as const
                          )[button.id as "mixer"],
                        );
                    }}
                  >
                    <span className="sr-only">{button.label}</span>
                  </button>
                );
              })}
              {lights.map((light, i) => (
                <span
                  key={i}
                  style={boundsStyle(light)}
                  className="h6-led"
                  data-lit={
                    state.power &&
                    (i === 5 ? state.mode === "recording" : enabled(state, i))
                  }
                />
              ))}
              <div
                className="h6-panel-screen"
                style={boundsStyle(screen)}
                aria-hidden="true"
              >
                <Display state={state} readings={readings} now={now} />
              </div>
            </div>
            <div className="h6-side-controls">
              <span className="h6-side-caption">RIGHT SIDE</span>
              <div
                className="h6-dial"
                role="group"
                aria-label="Selection dial"
                onWheel={(e) => {
                  if (!disabled) act("DIAL", { value: e.deltaY > 0 ? 1 : -1 });
                }}
              >
                <button
                  disabled={disabled}
                  aria-label="Selection dial up"
                  onClick={() => act("DIAL", { value: -1 })}
                >
                  ▲
                </button>
                <div
                  className="h6-dial-grip"
                  role="slider"
                  aria-label="Selection dial"
                  tabIndex={disabled ? -1 : 0}
                  aria-disabled={disabled}
                  aria-valuemin={0}
                  aria-valuemax={99}
                  aria-valuenow={state.cursor}
                  aria-valuetext={dialLabel}
                  onKeyDown={(e) => {
                    if (
                      !disabled &&
                      ["ArrowUp", "ArrowDown", "Enter"].includes(e.key)
                    ) {
                      e.preventDefault();
                      if (e.key === "Enter") act("ENTER");
                      else
                        act("DIAL", { value: e.key === "ArrowDown" ? 1 : -1 });
                    }
                  }}
                  onPointerDown={(e) => {
                    if (!disabled) {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      dialDrag.current = { y: e.clientY, moved: false };
                    }
                  }}
                  onPointerMove={(e) => {
                    const drag = dialDrag.current;
                    if (!drag || disabled) return;
                    const distance = e.clientY - drag.y;
                    if (Math.abs(distance) >= 8) {
                      act("DIAL", { value: Math.sign(distance) });
                      drag.y = e.clientY;
                      drag.moved = true;
                    }
                  }}
                  onPointerUp={() => {
                    dialDrag.current = null;
                  }}
                  onPointerCancel={() => {
                    dialDrag.current = null;
                  }}
                  onLostPointerCapture={() => {
                    dialDrag.current = null;
                  }}
                />
                <button
                  disabled={disabled}
                  aria-label="Selection dial down"
                  onClick={() => act("DIAL", { value: 1 })}
                >
                  ▼
                </button>
              </div>
              <button
                className="h6-enter"
                disabled={disabled}
                onClick={() => act("ENTER")}
              >
                ENTER
              </button>
              <span className="h6-side-help">
                Turn to select.
                <br />
                Press to confirm.
              </span>
            </div>
          </div>
          <div className="h6-bottom-controls">
            <span>FRONT END</span>
            <button
              aria-label="Recorder power"
              aria-pressed={state.power}
              onClick={power}
            >
              ⏻ POWER
            </button>
            <button
              aria-pressed={state.hold}
              disabled={!state.power}
              onClick={() => act("HOLD")}
            >
              HOLD
            </button>
          </div>
          <p className="h6-panel-note">
            Original panel positions. Side and front-end controls shown
            alongside.
          </p>
        </section>

        <div className="h6-companion">
          <section className="h6-card h6-monitor">
            <div className="h6-section-label">
              <span>02 / DISPLAY</span>
              <span>ENLARGED · READ ONLY</span>
            </div>
            <div
              className="h6-large-screen"
              role="img"
              aria-label={`Recorder display: ${state.screen}, ${status}`}
            >
              <Display state={state} readings={readings} now={now} />
            </div>
            <div className="h6-display-caption">
              <span>
                {state.power ? dialLabel : "Use the POWER switch to begin"}
              </span>
              <span>{state.config.rate / 1000} kHz / 32-bit float</span>
            </div>
            <p className="h6-message" role="status">
              {state.message ||
                (state.editing
                  ? "Turn the side dial, then press ENTER to confirm."
                  : "Use the side dial and ENTER to navigate.")}
            </p>
          </section>
          <section className="h6-card">
            <div className="h6-section-label">
              <span>03 / PRACTICE INPUTS</span>
              <span>SYNTHESIZED AUDIO</span>
            </div>
            <div className="h6-source-list">
              {TRACKS.map((label, i) => (
                <div className="h6-source" key={label}>
                  <b>{label === "MIC" ? "XY MIC" : `INPUT ${label}`}</b>
                  <select
                    aria-label={`${label} practice source`}
                    value={state.config.inputs[i].source}
                    disabled={disabled || state.mode !== "idle"}
                    onChange={(e) =>
                      act("SOURCE", {
                        index: i,
                        source: e.target.value as Source,
                      })
                    }
                  >
                    <option value="demo">
                      {i === 0
                        ? "Stereo ambience"
                        : [
                            "",
                            "Bass pulse",
                            "Warm keys",
                            "Bright pluck",
                            "High melody",
                          ][i]}
                    </option>
                    {i > 0 && (
                      <option value="condenser">Condenser · needs +48 V</option>
                    )}
                    <option value="off">Disconnected</option>
                  </select>
                  <meter
                    aria-label={`${label} measured level`}
                    min={-60}
                    max={0}
                    value={
                      i === 0
                        ? Math.max(...readings.levels.slice(0, 2))
                        : readings.levels[i + 1]
                    }
                  />
                </div>
              ))}
            </div>
            <div className="h6-listen">
              <button
                aria-pressed={listen}
                disabled={!state.power}
                onClick={async () => {
                  try {
                    await engine.current.start();
                    setListen((v) => !v);
                  } catch {
                    act("ERROR", { message: "Browser audio is unavailable." });
                  }
                }}
              >
                {listen ? "Mute listening" : "Listen with headphones"}
              </button>
              <label>
                VOLUME{" "}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={state.config.volume}
                  aria-label="Headphone volume"
                  disabled={disabled}
                  onChange={(e) => act("VOLUME", { value: +e.target.value })}
                />
              </label>
            </div>
            <p className="h6-fine">
              Listening starts muted. The left-side volume changes monitoring
              only; the meters show the signal before headphone volume.
            </p>
          </section>
          <section className="h6-card">
            <div className="h6-section-label">
              <span>04 / SESSION TAKES</span>
              <span>{state.takes.length} / 8 RECORDED</span>
            </div>
            {state.takes.filter((t) => !t.trashed).length === 0 ? (
              <div className="h6-empty">
                Your next take starts here.
                <small>
                  Arm MIC or an input, then press the red REC button.
                </small>
              </div>
            ) : (
              <div className="h6-takes">
                {state.takes
                  .filter((t) => !t.trashed)
                  .map((t) => (
                    <div
                      key={t.id}
                      className={take?.id === t.id ? "active" : ""}
                    >
                      <div>
                        <strong>{t.name}</strong>
                        <span>
                          {formatTime(t.duration)} · {t.config.rate / 1000} kHz
                          · {t.marks.length} marks
                        </span>
                      </div>
                      <div className="h6-downloads">
                        {recordedFiles(t).map((file) => (
                          <button
                            key={file.name}
                            onClick={() =>
                              download(
                                t.id,
                                file.channels,
                                `${t.name}_${file.name}`,
                              )
                            }
                            aria-label={`Download ${t.name} ${file.name} WAV`}
                          >
                            ↓ {file.name}.WAV
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
            <p className="h6-fine">
              60 seconds per take. Recordings stay in this tab until reload or
              reset. Download WAVs to keep them. 96 kHz creates individual
              tracks only.
            </p>
          </section>
          <details className="h6-card h6-guide">
            <summary>First take & accuracy notes</summary>
            <ol>
              <li>
                Power on. MIC is armed initially; press 1–4 to add inputs.
              </li>
              <li>
                Press MIXER. Turn the side dial, ENTER, adjust, ENTER. MIXER
                returns home.
              </li>
              <li>
                Press REC. With Mark selected, press ENTER to add a marker. STOP
                saves.
              </li>
              <li>
                Press PLAY. Tap REW/FF to jump between marks; hold to search.
                STOP returns home.
              </li>
            </ol>
            <p>
              The display has no touch controls. Focus the dial and use ↑/↓ and
              Enter, or drag/scroll it.
            </p>
            <p>
              USB, Bluetooth, timecode, MS decode, pre-record, start tones,
              iXML, A–B repeat and system menus are outside this version. Signal
              shapes and the Lo Cut response are approximations. Track selection
              is fixed during recording. Take names use a practice counter.
              Hardware timing and defaults have not been verified on a physical
              recorder.
            </p>
          </details>
          {storageError && <p role="alert">{storageError}</p>}
          <div className="h6-reset">
            {resetConfirm ? (
              <>
                <span>Clear takes and restore settings?</span>
                <button onClick={reset}>Reset session</button>
                <button onClick={() => setResetConfirm(false)}>Cancel</button>
              </>
            ) : (
              <>
                <span>Settings are saved in this browser.</span>
                <button onClick={() => setResetConfirm(true)}>
                  Start over
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
