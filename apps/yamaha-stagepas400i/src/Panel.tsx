import type { Dispatch } from "react";
import { Knob, Switch, LED } from "./Controls";
import { jacks, knobBounds, channelX, rect, position, PANEL } from "./geometry";
import {
  CHANNELS,
  INPUTS,
  powered,
  reverbProgram,
  type MixerState,
  type Action,
  type InputId,
  type Toggle,
} from "./state";
import type { Readings } from "./audio";

export function Panel({
  state,
  dispatch,
  readings,
  zoom,
  outlines,
  selected,
  select,
}: {
  state: MixerState;
  dispatch: Dispatch<Action>;
  readings: Readings;
  zoom: number;
  outlines: boolean;
  selected: number;
  select: (channel: number, input?: InputId) => void;
}) {
  const on = powered(state);
  const output = (
    param: Toggle,
    label: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => (
    <button
      key={param}
      type="button"
      className="sp-jack output"
      aria-label={label}
      aria-pressed={state[param]}
      title={`${label} · ${state[param] ? "connected" : "disconnected"}`}
      style={position(rect(x, y, w, h))}
      onClick={() => dispatch({ type: "toggle", param })}
    >
      <span className="sp-plug" data-connected={state[param]} />
    </button>
  );
  return (
    <div
      className="sp-panel-scroll"
      aria-label="Mixer panel viewport"
      tabIndex={0}
    >
      <div
        className={`sp-panel ${outlines ? "outlines" : ""}`}
        style={{
          width: `max(${zoom * 9}px, ${zoom}%)`,
          aspectRatio: `${PANEL.width}/${PANEL.height}`,
        }}
      >
        <img
          src={`${import.meta.env.BASE_URL}panel.webp`}
          alt="Yamaha STAGEPAS 400i mixer, rotated from the supplied rear-panel photograph"
          draggable={false}
        />
        {state.channels.map((channel, i) => (
          <div key={i}>
            <span
              className={`sp-strip-selection ${selected === i ? "selected" : ""}`}
              style={position(rect(channelX[i], 570, 150, 875))}
            />
            {(
              [
                "high",
                "low",
                "level",
                ...(i < 4 ? ["reverb" as const] : []),
              ] as const
            ).map((param) => {
              const eq = param === "high" || param === "low";
              return (
                <Knob
                  key={param}
                  label={`CH ${CHANNELS[i]} ${param.toUpperCase()}`}
                  value={channel[param]}
                  bounds={knobBounds(i, param)}
                  min={eq ? -15 : 0}
                  max={eq ? 15 : 10}
                  step={eq ? 0.5 : 0.1}
                  color={
                    eq ? "#75d9aa" : param === "reverb" ? "#50c2e7" : "#ecefe8"
                  }
                  format={(n) =>
                    eq ? `${n > 0 ? "+" : ""}${n.toFixed(1)} dB` : n.toFixed(1)
                  }
                  onChange={(value) =>
                    dispatch({ type: "channel", channel: i, param, value })
                  }
                  onSelect={() => select(i)}
                />
              );
            })}
            {i < 4 ? (
              <Switch
                label={`CH ${CHANNELS[i]} MIC`}
                active={channel.mic}
                bounds={rect(i === 3 ? 779 : channelX[i], 355, 48, 39)}
                onClick={() => {
                  select(i);
                  dispatch({ type: "switch", channel: i, param: "mic" });
                }}
              />
            ) : (
              <Switch
                label={`CH ${CHANNELS[i]} MONO`}
                active={channel.mono}
                bounds={rect(i === 4 ? 986 : 1153, 774, 48, 38)}
                onClick={() => {
                  select(i);
                  dispatch({ type: "switch", channel: i, param: "mono" });
                }}
              />
            )}
          </div>
        ))}
        {jacks.map(({ id, bounds, plugY }) => (
          <button
            key={id}
            type="button"
            className="sp-jack"
            aria-label={`Configure ${INPUTS[id].label}`}
            title={`Configure ${INPUTS[id].label}`}
            style={position(bounds)}
            onClick={() => select(INPUTS[id].channel, id)}
          >
            {(plugY || [50]).map((y) => (
              <span
                key={y}
                className="sp-plug"
                style={{ top: `${y}%` }}
                data-connected={state.inputs[id].kind !== "none"}
              />
            ))}
          </button>
        ))}
        <Switch
          label="CH 4 Hi-Z"
          active={state.hiZ}
          bounds={rect(851, 355, 46, 39)}
          onClick={() => dispatch({ type: "toggle", param: "hiZ" })}
        />
        <Switch
          label="PHANTOM CH 1/2"
          active={state.phantom}
          bounds={rect(1306, 482, 48, 37)}
          onClick={() => dispatch({ type: "toggle", param: "phantom" })}
        />
        <Switch
          label="REVERB ON"
          momentary
          active={state.reverbOn && on}
          bounds={rect(1307, 681, 48, 37)}
          onClick={() => dispatch({ type: "toggle", param: "reverbOn" })}
        />
        <Switch
          label="FEEDBACK SUPPRESSOR"
          active={state.feedback}
          bounds={rect(1451, 771, 47, 37)}
          onClick={() => dispatch({ type: "toggle", param: "feedback" })}
        />
        <Switch
          label="Mixer power"
          active={state.power}
          bounds={rect(1780, 922, 91, 91)}
          round
          onClick={() => dispatch({ type: "toggle", param: "power" })}
        />
        <Knob
          label="MONITOR OUT"
          value={state.monitor}
          bounds={rect(1307, 582, 79, 79)}
          onChange={(value) =>
            dispatch({ type: "global", param: "monitor", value })
          }
        />
        <Knob
          label="REVERB TYPE/TIME"
          value={state.reverbTypeTime}
          max={100}
          step={1}
          color="#50c2e7"
          bounds={rect(1311, 777, 81, 81)}
          format={(value) => {
            const program = reverbProgram(value);
            return `${program.name} · ${Math.round(program.amount * 100)}% time`;
          }}
          onChange={(value) =>
            dispatch({ type: "global", param: "reverbTypeTime", value })
          }
        />
        <Knob
          label="MASTER EQ"
          value={state.masterEQ}
          min={-1}
          max={1}
          step={0.02}
          color="#75d9aa"
          bounds={rect(1318, 915, 80, 80)}
          format={(value) =>
            value === 0
              ? "MUSIC · flat"
              : value < 0
                ? `SPEECH ${Math.round(-value * 100)}%`
                : `BASS ${Math.round(value * 100)}%`
          }
          onChange={(value) =>
            dispatch({ type: "global", param: "masterEQ", value })
          }
        />
        <Knob
          label="MASTER LEVEL"
          value={state.master}
          color="#f36c49"
          bounds={rect(1457, 915, 80, 80)}
          onChange={(value) =>
            dispatch({ type: "global", param: "master", value })
          }
        />
        {output("monitorL", "MONITOR L cable", 1307, 204, 80, 80)}
        {output("monitorR", "MONITOR R cable", 1307, 331, 80, 80)}
        {output("sub", "SUBWOOFER cable", 1419, 204, 80, 80)}
        {output("footswitch", "REVERB FOOT SW cable", 1419, 331, 80, 80)}
        {output("speakerL", "SPEAKER L cable", 1584, 203, 85, 85)}
        {output("speakerR", "SPEAKER R cable", 1584, 340, 85, 85)}
        {output("ac", "AC power cable", 1824, 327, 135, 168)}
        <LED
          label="Phantom"
          active={on && state.phantom}
          color="red"
          bounds={rect(1253, 481, 23, 23)}
        />
        <LED
          label="Reverb"
          active={on && state.reverbOn}
          color="yellow"
          bounds={rect(1254, 681, 22, 22)}
        />
        <LED label="Power" active={on} bounds={rect(1449, 680, 23, 23)} />
        <LED
          label="Feedback suppressor"
          active={on && state.feedback}
          color="yellow"
          bounds={rect(1399, 773, 22, 22)}
        />
        <LED
          label="Bass boost"
          active={on && state.masterEQ >= 0.75}
          color="yellow"
          bounds={rect(1354, 968, 24, 24)}
        />
        <LED
          label="Limiter"
          active={on && readings.preLimiter >= -6}
          color="red"
          bounds={rect(1448, 422, 23, 23)}
        />
        {[6, 3, 0, -6, -20].map((db, i) => (
          <LED
            key={db}
            label={`Speaker meter ${db} dB`}
            active={on && readings.speakers + 18 >= db}
            color={i < 3 ? "yellow" : "green"}
            bounds={rect(1449, [460, 500, 540, 579, 617][i], 22, 22)}
          />
        ))}
      </div>
    </div>
  );
}
