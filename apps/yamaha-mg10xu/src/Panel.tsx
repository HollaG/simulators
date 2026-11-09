import type { Dispatch } from "react";
import { Knob, Switch, LED } from "./Controls";
import { channelX, rowY, jacks, rect, position } from "./geometry";
import {
  CHANNELS,
  PROGRAMS,
  INPUTS,
  channelParams,
  type ChannelParam,
  type MixerState,
  type InputId,
  type Action,
  type Toggle,
} from "./state";
import type { Readings } from "./audio";

/** Keep the photograph and every physical hit target in one coordinate space.
 * Display and LED covers replace the photo's baked-in active indicators.
 */
export function Panel({
  state: s,
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
  select: (index: number, input?: InputId) => void;
}) {
  const toggle = (
    param: Toggle,
    label: string,
    x: number,
    y: number,
    w = 32,
    h = 28,
  ) => (
    <Switch
      key={label}
      label={label}
      active={s[param]}
      bounds={rect(x, y, w, h)}
      onClick={() => dispatch({ type: "toggle", param })}
    />
  );
  const output = (
    param: Toggle,
    label: string,
    x: number,
    y: number,
    size = 65,
  ) => (
    <button
      key={label}
      className="mg-jack output"
      aria-label={label}
      aria-pressed={s[param]}
      title={`${label}: ${s[param] ? "connected" : "disconnected"}`}
      style={position(rect(x, y, size, size))}
      onClick={() => dispatch({ type: "toggle", param })}
    >
      <span className="mg-plug" data-connected={s[param]} />
    </button>
  );
  const globals = [
    {
      param: "parameter",
      label: "PARAMETER",
      x: 1072,
      y: 840,
      size: 62,
      color: "#e6e8e4",
    },
    {
      param: "monitor",
      label: "MONITOR/PHONES",
      x: 1198,
      y: 1120,
      size: 78,
      color: "#e6e8e4",
    },
    {
      param: "fxReturn",
      label: "FX RTN LEVEL",
      x: 1074,
      y: 1277,
      size: 78,
      color: "#e6e8e4",
    },
    {
      param: "master",
      label: "STEREO LEVEL",
      x: 1201,
      y: 1277,
      size: 78,
      color: "#d95d52",
    },
  ] as const;
  return (
    <div
      className="mg-panel-scroll"
      aria-label="Mixer panel viewport"
      tabIndex={0}
    >
      <div
        className={`mg-panel ${outlines ? "outlines" : ""}`}
        style={{ width: `${zoom}%`, minWidth: `${zoom * 6.6}px` }}
      >
        <img
          src={`${import.meta.env.BASE_URL}panel.webp`}
          alt="Owner-supplied Yamaha MG10XU top panel"
          draggable={false}
        />
        {s.channels.map((channel, i) => (
          <div key={i}>
            <span
              className={`mg-selected ${selected === i ? "active" : ""}`}
              style={position(rect(channelX[i], 930, 104, 915))}
            />
            {(Object.keys(channelParams) as ChannelParam[])
              .filter(
                (param) =>
                  !(i >= 4 && ["gain", "mid"].includes(param)) &&
                  !(i >= 2 && param === "comp"),
              )
              .map((param) => {
                const p = channelParams[param];
                return (
                  <Knob
                    key={param}
                    label={`CH ${CHANNELS[i]} ${param.toUpperCase()}`}
                    value={channel[param]}
                    min={p.min}
                    max={p.max}
                    step={p.step}
                    reset={p.initial}
                    color={p.color}
                    bounds={rect(
                      channelX[i],
                      rowY[param],
                      param === "level" ? 76 : 61,
                      param === "level" ? 76 : 61,
                    )}
                    onChange={(value) =>
                      dispatch({ type: "channel", channel: i, param, value })
                    }
                    onSelect={() => select(i)}
                    format={(n) =>
                      param === "gain"
                        ? `${n - (channel.pad ? 26 : 0)} dB`
                        : ["high", "mid", "low"].includes(param)
                          ? `${n} dB`
                          : param === "pan"
                            ? n === 0
                              ? "Centre"
                              : `${Math.round(Math.abs(n) * 100)}% ${n < 0 ? "L" : "R"}`
                            : `${n.toFixed(1)} / 10`
                    }
                  />
                );
              })}
            {i < 4 && (
              <>
                <Switch
                  label={`CH ${i + 1} PAD`}
                  active={channel.pad}
                  bounds={rect(channelX[i] - 23, 394, 33, 29)}
                  onClick={() =>
                    dispatch({
                      type: "channelToggle",
                      channel: i,
                      param: "pad",
                    })
                  }
                />
                <Switch
                  label={`CH ${i + 1} HPF`}
                  active={channel.hpf}
                  bounds={rect(channelX[i] + 29, 394, 33, 29)}
                  onClick={() =>
                    dispatch({
                      type: "channelToggle",
                      channel: i,
                      param: "hpf",
                    })
                  }
                />
                <LED
                  label={`CH ${i + 1} PEAK`}
                  color="red"
                  active={s.power && readings.peaks[i] >= 17}
                  bounds={rect(channelX[i] - 40, 1216, 17, 17)}
                />
              </>
            )}
          </div>
        ))}
        {jacks.map(({ id, bounds }) => (
          <button
            key={id}
            className="mg-jack"
            style={position(bounds)}
            aria-label={`${id} input socket`}
            title={`Configure ${id} input`}
            onClick={() => select(INPUTS[id].channel, id)}
          >
            <span
              className="mg-plug"
              data-connected={s.inputs[id].kind !== "none"}
            />
          </button>
        ))}
        {toggle("phantom", "PHANTOM +48V", 580, 681)}
        <LED
          label="PHANTOM"
          color="red"
          active={s.power && s.phantom}
          bounds={rect(541, 681, 17, 17)}
        />
        {toggle("usb", "LINE / USB", 942, 628)}
        {toggle("toStereo", "TO MON / TO ST", 983, 1207)}
        {toggle("stereoMute", "STEREO MUTE", 1222, 1054)}
        {toggle("fxOn", "FX ON", 1070, 1187, 42, 28)}
        <span
          className={`mg-fx-lamp ${s.footBypass ? "blink" : ""}`}
          data-lit={s.power && s.fxOn}
          style={position(rect(1051, 1187, 17, 24))}
        />
        <LED label="POWER" active={s.power} bounds={rect(1222, 680, 25, 9)} />
        <output
          className={`mg-display ${s.pending !== null ? "blink" : ""}`}
          style={position(rect(1076, 633, 126, 91))}
          aria-label="FX display"
        >
          {s.power
            ? String(
                s.editingAttenuator
                  ? Math.abs(s.attenuator)
                  : (s.pending ?? s.program),
              ).padStart(2, "0")
            : ""}
          <small>{s.power && s.attenuator < 0 ? "." : ""}</small>
        </output>
        <Knob
          label="PROGRAM"
          value={
            s.editingAttenuator
              ? Math.abs(s.attenuator)
              : (s.pending ?? s.program)
          }
          min={s.editingAttenuator ? 0 : 1}
          max={24}
          step={1}
          reset={1}
          bounds={rect(1071, 746, 64, 64)}
          color="#303736"
          onChange={(value, held) =>
            dispatch({ type: "turn", value, held, now: performance.now() })
          }
          onPress={() => dispatch({ type: "press", now: performance.now() })}
          format={(n) =>
            s.editingAttenuator
              ? `USB attenuation −${n} dB`
              : `${n}: ${PROGRAMS[n - 1][0]}`
          }
        />
        {globals.map((g) => (
          <Knob
            key={g.param}
            label={g.label}
            value={s[g.param]}
            bounds={rect(g.x, g.y, g.size, g.size)}
            color={g.color}
            reset={g.param === "parameter" ? 5 : 0}
            onChange={(value) =>
              dispatch({ type: "global", param: g.param, value })
            }
          />
        ))}
        {[17, 10, 6, 0, -6, -10, -20].map((threshold, row) => (
          <div key={threshold}>
            {[readings.left, readings.right].map((db, side) => (
              <LED
                key={side}
                label={`${side ? "R" : "L"} ${threshold} dBu`}
                active={s.power && db >= threshold}
                color={row === 0 ? "red" : row < 4 ? "yellow" : "green"}
                bounds={rect(
                  side ? 1223 : 1162,
                  [718, 742, 764, 787, 809, 832, 855][row],
                  25,
                  9,
                )}
              />
            ))}
          </div>
        ))}
        {output("footConnected", "FOOT SW connection", 726, 221, 65)}
        {output("fxConnected", "FX SEND connection", 982, 221)}
        {[307, 389].map((y, i) =>
          output(
            "monitorConnected",
            `MONITOR OUT ${i ? "R" : "L"} connection`,
            981,
            y,
          ),
        )}
        {[1075, 1189].map((x, i) =>
          output(
            "stereoConnected",
            `STEREO OUT XLR ${i ? "R" : "L"} connection`,
            x,
            258,
            90,
          ),
        )}
        {[1064, 1152].map((x, i) =>
          output(
            "stereoConnected",
            `STEREO OUT phone ${i ? "R" : "L"} connection`,
            x,
            390,
          ),
        )}
        {output("phonesConnected", "PHONES connection", 1238, 390)}
      </div>
    </div>
  );
}
