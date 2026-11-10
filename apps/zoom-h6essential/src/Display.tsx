import type { Readings } from "./audio";
import {
  currentTake,
  elapsed,
  enabled,
  formatTime,
  gainLabel,
  homeItems,
  isPlayback,
  mixerGain,
  settings,
  TRACKS,
  type State,
} from "./state";

const icons: Record<string, string> = {
  "File List": "▤",
  Input: "⇥",
  Output: "◖",
  "Rec Settings": "48k",
  "SD Card": "SD",
  USB: "USB",
  System: "⚙",
  Mark: "⚑",
  Trash: "⌫",
  "A–B Repeat": "A–B",
  Export: "↗",
};
const percent = (db: number) =>
  Math.max(0, Math.min(100, ((db + 60) / 60) * 100));

/** A read-only LCD: both copies share exactly the same state and measured samples. */
export function Display({
  state: s,
  readings,
  now,
}: {
  state: State;
  readings: Readings;
  now: number;
}) {
  if (!s.power)
    return (
      <div className="h6-lcd off">
        <span>H6essential</span>
      </div>
    );
  const time = elapsed(s, now),
    playback = isPlayback(s),
    take = currentTake(s);
  const status =
    s.mode === "recording"
      ? "●"
      : s.mode === "playing"
        ? "▶"
        : s.mode === "paused"
          ? "Ⅱ"
          : "■";
  const rows = settings(s);
  const list = (items: string[], values?: string[]) => (
    <div className="lcd-list">
      {items.map((label, i) => (
        <div key={label} className={s.cursor === i ? "selected" : ""}>
          <span>{label}</span>
          <span>{values?.[i]}</span>
        </div>
      ))}
    </div>
  );
  const title =
    s.screen === "input"
      ? s.inside
        ? `INPUT ${TRACKS[s.input]}`
        : "Input"
      : s.screen === "rec"
        ? "Rec Settings"
        : s.screen === "files"
          ? "File List"
          : s.screen === "fileActions"
            ? take?.name
            : s.screen === "trash"
              ? "Move to TRASH?"
              : s.screen === "unavailable"
                ? "Practice version"
                : null;
  return (
    <div className={`h6-lcd ${s.mode}`} data-screen={s.screen}>
      <div className="lcd-title">
        {title || (
          <>
            <b>
              {status} {formatTime(time)}
            </b>
            <span>
              {" "}
              / {formatTime(playback ? take?.duration || 0 : 60 - time)}
            </span>
          </>
        )}
        <span className="lcd-battery">{s.hold ? "HOLD" : "▥"}</span>
      </div>
      {s.mode === "saving" ? (
        <div className="lcd-notice">Saving take…</div>
      ) : s.screen === "unavailable" ? (
        <div className="lcd-notice">
          {s.message}
          <small>ENTER to return</small>
        </div>
      ) : s.screen === "trash" ? (
        list(["Cancel", "Execute"])
      ) : s.screen === "files" ? (
        <div
          className="lcd-scroll"
          ref={(el) => {
            if (el)
              el.scrollTop = Math.max(0, s.cursor - 3) * el.clientWidth * 0.13;
          }}
        >
          {list([
            ...s.takes.filter((t) => !t.trashed).map((t) => t.name),
            "↩ Back",
          ])}
        </div>
      ) : s.screen === "fileActions" ? (
        list(["Play View", "Trash", "Back"])
      ) : s.screen === "rec" || (s.screen === "input" && s.inside) ? (
        <>
          {list(
            [...rows.map((r) => r.label), "↩ Back"],
            rows.map((r, i) =>
              String(
                r.options[s.editing && s.cursor === i ? s.choice : r.index],
              ),
            ),
          )}
          <div className="lcd-hint">
            {s.editing
              ? "Turn to change · ENTER confirms"
              : "Select setting · ENTER"}
          </div>
        </>
      ) : s.screen === "input" ? (
        <>
          <div className="lcd-notice">
            Select an input<small>Lo Cut · Phantom · Stereo Link</small>
          </div>
          <div className="lcd-menu">
            {[...TRACKS, "↩"].map((label, i) => (
              <span key={label} className={i === s.cursor ? "selected" : ""}>
                {label}
              </span>
            ))}
          </div>
        </>
      ) : s.screen === "mixer" ? (
        <div className="lcd-mixer">
          {TRACKS.map((label, i) => {
            const level =
              i === 0
                ? Math.max(...readings.levels.slice(0, 2))
                : readings.levels[i + 1];
            return (
              <div
                key={label}
                className={`lcd-strip ${s.cursor === i ? "selected" : ""} ${s.editing && s.cursor === i ? "editing" : ""}`}
              >
                <div className="lcd-meter">
                  <i
                    style={{ height: `${enabled(s, i) ? percent(level) : 0}%` }}
                  />
                  <em
                    style={{
                      bottom: `${((mixerGain(s, i) + 81) / 121) * 100}%`,
                    }}
                  />
                </div>
                <small>
                  {!enabled(s, i)
                    ? "×"
                    : s.editing && s.cursor === i
                      ? gainLabel(mixerGain(s, i)).replace(" dB", "")
                      : label}
                </small>
              </div>
            );
          })}
          <div className="lcd-strip">
            <div className="lcd-meter stereo">
              {readings.mix.map((db, i) => (
                <i key={i} style={{ height: `${percent(db)}%` }} />
              ))}
            </div>
            <small>MIX</small>
          </div>
        </div>
      ) : (
        <>
          <div className="lcd-waves">
            {["MIC L", "MIC R", "1", "2", "3", "4"].map((label, ch) => {
              const on = enabled(s, Math.max(0, ch - 1));
              const points = readings.waves[ch]
                .map(
                  (v, i) =>
                    `${(i * 100) / 63},${25 - (on ? Math.max(-1, Math.min(1, v * 3)) * 23 : 0)}`,
                )
                .join(" ");
              return (
                <div key={label} className={!on ? "muted" : ""}>
                  <small>
                    {label}
                    {!on && " ×"}
                  </small>
                  <svg viewBox="0 0 100 50" preserveAspectRatio="none">
                    <path d="M0 25H100" className="zero" />
                    <polyline
                      points={points}
                      style={playback ? { stroke: "#777983" } : undefined}
                    />
                    {playback && on && (
                      <polyline
                        points={points}
                        style={{
                          stroke: "#80d481",
                          clipPath: `inset(0 ${100 - (time / (take?.duration || 1)) * 100}% 0 0)`,
                        }}
                      />
                    )}
                  </svg>
                </div>
              );
            })}
          </div>
          {playback && (
            <div className="lcd-progress">
              <i
                style={{ width: `${(time / (take?.duration || 1)) * 100}%` }}
              />
              {take?.marks.map((m, i) => (
                <b key={i} style={{ left: `${(m / take.duration) * 100}%` }} />
              ))}
            </div>
          )}
          <div className="lcd-menu">
            {homeItems(s).map((label, i) => (
              <span
                key={label}
                className={s.cursor === i ? "selected" : ""}
                title={label}
              >
                {icons[label] || label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
