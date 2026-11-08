import {
  memo,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
} from "react";
import {
  HardwareSlider,
  HardwareSwitch,
  PanelLED,
  positionStyle,
} from "./Controls";
import {
  bounds,
  channelKnobs,
  channelX,
  faderBounds,
  knobBounds,
  switchBounds,
} from "./geometry";
import {
  CHANNEL_LABELS,
  METER_STEPS,
  channelRange,
  type Action,
  type BooleanChannelKey,
  type BooleanGlobalKey,
  type MixerState,
  type NumericGlobalKey,
} from "./state";
import type { MixerAudio } from "./audio";

function Meters({
  engine,
  power,
  channels,
}: {
  engine: RefObject<MixerAudio | null>;
  power: boolean;
  channels: MixerState["channels"];
}) {
  const left = useRef<HTMLDivElement>(null);
  const right = useRef<HTMLDivElement>(null);
  const inputs = useRef<(HTMLSpanElement | null)[]>([]);
  useEffect(() => {
    const update = () => {
      const readings = engine.current?.read();
      [left, right].forEach((ref, side) => {
        const value =
          readings && power
            ? side === 0
              ? readings.left
              : readings.right
            : -120;
        ref.current
          ?.querySelectorAll<HTMLElement>(".meter-segment")
          .forEach((segment, i) => {
            segment.dataset.lit = String(value >= METER_STEPS[i]);
          });
      });
      inputs.current.forEach((led, i) => {
        if (led)
          led.dataset.lit = String(
            power && !!readings && readings.inputs[i] > 0,
          );
      });
    };
    update();
    const interval = window.setInterval(update, 70);
    return () => window.clearInterval(interval);
  }, [engine, power]);
  return (
    <>
      {[left, right].map((ref, side) => (
        <div
          key={side}
          ref={ref}
          className="panel-meter"
          aria-label={`${side === 0 ? "Left" : "Right"} output meter`}
          style={positionStyle(bounds(side === 0 ? 1725 : 1765, 443, 20, 133))}
        >
          {METER_STEPS.map((step, i) => (
            <i
              key={step}
              className={`meter-segment ${i < 1 ? "red" : i < 3 ? "yellow" : "green"}`}
            />
          ))}
        </div>
      ))}
      {channels.slice(0, 17).map((_, i) => (
        <span
          key={i}
          ref={(node) => {
            inputs.current[i] = node;
          }}
          className="level-set"
          style={positionStyle(bounds(channelX[i] + 41, 331, 11, 11))}
        />
      ))}
    </>
  );
}

export const Panel = memo(function Panel({
  state,
  dispatch,
  selected,
  select,
  engine,
  zoom,
  outlines,
}: {
  state: MixerState;
  dispatch: Dispatch<Action>;
  selected: number;
  select: (i: number) => void;
  engine: RefObject<MixerAudio | null>;
  zoom: number;
  outlines: boolean;
}) {
  const [now, setNow] = useState(performance.now());
  useEffect(() => {
    if (state.bootUntil <= performance.now()) return;
    const id = window.setInterval(() => {
      const time = performance.now();
      setNow(time);
      if (time >= state.bootUntil) window.clearInterval(id);
    }, 100);
    return () => window.clearInterval(id);
  }, [state.bootUntil]);
  const off = !state.power;
  const toggleGlobal = (key: BooleanGlobalKey) =>
    dispatch({ type: "global", key, value: !state.globals[key] });
  const globalKnob = (
    key: NumericGlobalKey,
    x: number,
    y: number,
    label: string,
    color = "green",
  ) => (
    <HardwareSlider
      key={key}
      label={label}
      rect={knobBounds(x, y)}
      value={state.globals[key]}
      min={key === "blend" ? -1 : -90}
      max={key === "blend" ? 1 : 10}
      step={key === "blend" ? 0.02 : 0.5}
      unit={key === "blend" ? "blend" : "dB"}
      taper={key === "blend" ? undefined : "fader"}
      reset={key === "blend" ? 0 : -90}
      color={color}
      disabled={off}
      onChange={(value) => dispatch({ type: "global", key, value })}
    />
  );
  const globalSwitch = (
    key: BooleanGlobalKey,
    x: number,
    y: number,
    label: string,
  ) => (
    <HardwareSwitch
      key={key}
      label={label}
      rect={switchBounds(x, y)}
      active={state.globals[key]}
      disabled={off}
      onClick={() => toggleGlobal(key)}
    />
  );
  const fxMuted =
    state.globals.fxMute || state.globals.footMute || now < state.bootUntil;
  return (
    <div className={`console-scroll ${outlines ? "show-outlines" : ""}`}>
      <div
        className={`console-panel ${off ? "powered-off" : ""}`}
        style={{ width: `max(${zoom}%, ${(680 * zoom) / 100}px)` }}
      >
        <img
          src={`${import.meta.env.BASE_URL}profx22v3.webp`}
          alt="Mackie ProFX22v3 top panel, 18 channel strips with master section on the right"
          draggable={false}
        />
        <div
          className="selected-strip"
          style={positionStyle(bounds(channelX[selected] - 36, 314, 79, 960))}
        />
        {state.channels.map((channel, index) => {
          const x = channelX[index];
          const set = (key: BooleanChannelKey) => {
            select(index);
            dispatch({ type: "channel", index, key, value: !channel[key] });
          };
          return (
            <div key={index} className="channel-overlay">
              <button
                className="source-jack"
                aria-label={`Inspect channel ${CHANNEL_LABELS[index]}`}
                title={`${channel.name} · click to inspect or load a source`}
                onClick={() => select(index)}
                style={positionStyle(bounds(x - 31, 65, 66, 81))}
              />
              {channelKnobs.map((control) => {
                if (
                  (control.key === "comp" && index >= 12) ||
                  (control.key === "freq" && index === 17)
                )
                  return null;
                const [min, max, step] = channelRange(index, control.key);
                const y =
                  control.key === "mid" && index === 17 ? 557 : control.y;
                const gainLabel =
                  control.key === "gain" &&
                  index < 14 &&
                  (channel.input === "mic" || channel.input === "condenser")
                    ? "Mic gain (add 20 dB to line scale)"
                    : control.label;
                return (
                  <HardwareSlider
                    key={control.key}
                    label={`CH ${CHANNEL_LABELS[index]} ${gainLabel}`}
                    rect={knobBounds(x, y)}
                    value={channel[control.key]}
                    min={min}
                    max={max}
                    step={step}
                    color={control.color}
                    unit={
                      control.key === "freq"
                        ? "Hz"
                        : control.key === "pan"
                          ? "pan"
                          : control.key === "comp"
                            ? "%"
                            : "dB"
                    }
                    taper={
                      control.key === "freq"
                        ? "log"
                        : ["mon1", "mon2", "mon3", "fx"].includes(control.key)
                          ? "fader"
                          : undefined
                    }
                    reset={
                      control.key === "freq"
                        ? 600
                        : ["mon1", "mon2", "mon3", "fx"].includes(control.key)
                          ? -90
                          : 0
                    }
                    disabled={off}
                    onSelect={() => select(index)}
                    onChange={(value) =>
                      dispatch({
                        type: "channel",
                        index,
                        key: control.key,
                        value,
                      })
                    }
                  />
                );
              })}
              {index < 2 && (
                <HardwareSwitch
                  label={`CH ${CHANNEL_LABELS[index]} Hi-Z`}
                  rect={switchBounds(x + 7, 172)}
                  active={channel.hiZ}
                  disabled={off}
                  onClick={() => set("hiZ")}
                />
              )}
              {index < 17 && (
                <HardwareSwitch
                  label={`CH ${CHANNEL_LABELS[index]} Low cut`}
                  rect={switchBounds(x + 7, 289)}
                  active={channel.lowCut}
                  disabled={off}
                  onClick={() => set("lowCut")}
                />
              )}
              {index === 17 &&
                globalSwitch("usb34", x - 7, 289, "USB 3–4 to channel 21/22")}
              <HardwareSwitch
                label={`CH ${CHANNEL_LABELS[index]} MON 3 pre-fader`}
                rect={switchBounds(x + 28, 837)}
                active={channel.pre3}
                disabled={off}
                onClick={() => set("pre3")}
              />
              <HardwareSwitch
                label={`CH ${CHANNEL_LABELS[index]} Mute`}
                rect={bounds(x - 1, 981, 33, 33)}
                active={channel.mute}
                round
                disabled={off}
                onClick={() => set("mute")}
              />
              <HardwareSlider
                label={`CH ${CHANNEL_LABELS[index]} Fader`}
                rect={faderBounds(x)}
                value={channel.fader}
                min={-90}
                max={10}
                taper="fader"
                fader
                disabled={off}
                reset={0}
                onSelect={() => select(index)}
                onChange={(value) =>
                  dispatch({ type: "channel", index, key: "fader", value })
                }
              />
              {(
                [
                  { key: "sub12", y: 1098, label: "Assign 1–2" },
                  { key: "sub34", y: 1141, label: "Assign 3–4" },
                  { key: "lr", y: 1183, label: "Assign L–R" },
                  { key: "solo", y: 1225, label: "PFL Solo" },
                ] as const
              ).map((control) => (
                <HardwareSwitch
                  key={control.key}
                  label={`CH ${CHANNEL_LABELS[index]} ${control.label}`}
                  rect={switchBounds(x + 43, control.y)}
                  active={channel[control.key]}
                  disabled={off}
                  onClick={() => set(control.key)}
                />
              ))}
            </div>
          );
        })}
        <Meters engine={engine} power={state.power} channels={state.channels} />
        {globalSwitch("phantom", 1738, 388, "48V Phantom power")}
        <PanelLED
          x={1737}
          y={363}
          active={state.power && state.globals.phantom}
          color="red"
          label="Phantom power"
        />
        <PanelLED x={1776} y={363} active={state.power} label="Power" />
        <PanelLED
          x={1755}
          y={600}
          active={state.power && state.channels.some((c) => c.solo)}
          color="red"
          flashing
          label="Rude Solo"
        />
        {globalKnob("mon1", 1578, 697, "MON 1 master")}
        {globalKnob("mon2", 1578, 746, "MON 2 master")}
        {globalKnob("mon3", 1578, 797, "MON 3 master")}
        {globalKnob("fxMaster", 1578, 845, "FX send master", "yellow")}
        {globalKnob("fxMon1", 1677, 697, "FX to MON 1")}
        {globalKnob("fxMon2", 1677, 746, "FX to MON 2")}
        {globalKnob("fxMon3", 1677, 797, "FX to MON 3")}
        <div
          className={`fx-display ${state.pending ? "previewing" : ""}`}
          style={positionStyle(bounds(1729, 677, 54, 38))}
          aria-label="FX preset display"
          aria-live="polite"
        >
          {state.power
            ? String(state.pending?.preset ?? state.preset).padStart(2, "0")
            : ""}
        </div>
        <PresetEncoder state={state} dispatch={dispatch} />
        {globalSwitch("fxMute", 1773, 810, "FX Mute")}
        <PanelLED
          x={1737}
          y={810}
          active={state.power && fxMuted}
          color="red"
          label="FX mute"
        />
        {globalKnob("blend", 1578, 922, "Inputs / USB 1–2 blend", "white")}
        {globalKnob("cr", 1677, 922, "Control room level", "white")}
        {globalKnob("phones", 1765, 922, "Phones level", "white")}
        {globalSwitch("toPhones", 1578, 976, "Blend to phones / control room")}
        {globalSwitch("break", 1773, 978, "Break")}
        <PanelLED
          x={1737}
          y={977}
          active={state.power && state.globals.break}
          color="red"
          label="Break"
        />
        {globalSwitch("fxSub12", 1552, 1020, "FX assign 1–2")}
        {globalSwitch("fxSub34", 1584, 1020, "FX assign 3–4")}
        {globalSwitch("sub12LR", 1634, 1020, "Sub 1–2 assign L–R")}
        {globalSwitch("sub34LR", 1701, 1020, "Sub 3–4 assign L–R")}
        {(
          [
            { key: "fxReturn", x: 1570, label: "FX return fader" },
            { key: "sub12", x: 1634, label: "Sub 1–2 fader" },
            { key: "sub34", x: 1701, label: "Sub 3–4 fader" },
            { key: "main", x: 1768, label: "Main fader" },
          ] as const
        ).map((control) => (
          <HardwareSlider
            key={control.key}
            label={control.label}
            rect={faderBounds(control.x)}
            value={state.globals[control.key]}
            min={-90}
            max={10}
            taper="fader"
            fader
            disabled={off}
            reset={0}
            onChange={(value) =>
              dispatch({ type: "global", key: control.key, value })
            }
          />
        ))}
      </div>
    </div>
  );
});

function PresetEncoder({
  state,
  dispatch,
}: {
  state: MixerState;
  dispatch: Dispatch<Action>;
}) {
  const element = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ y: number; moved: boolean } | null>(null);
  useEffect(() => {
    const target = element.current;
    const wheel = (e: WheelEvent) => {
      if (!state.power) return;
      e.preventDefault();
      dispatch({
        type: "presetTurn",
        delta: e.deltaY < 0 ? 1 : -1,
        now: performance.now(),
      });
    };
    const cancel = () => {
      drag.current = null;
    };
    target?.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("blur", cancel);
    return () => {
      target?.removeEventListener("wheel", wheel);
      window.removeEventListener("blur", cancel);
    };
  }, [dispatch, state.power]);
  return (
    <button
      ref={element}
      className="hardware-control preset-encoder"
      aria-label="FX preset encoder, arrows to browse, Enter to confirm"
      disabled={!state.power}
      style={positionStyle(bounds(1737, 732, 42, 42))}
      title="Drag or wheel to browse · click to confirm"
      onKeyDown={(event) => {
        if (event.key.startsWith("Arrow")) {
          event.preventDefault();
          dispatch({
            type: "presetTurn",
            delta:
              event.key === "ArrowUp" || event.key === "ArrowRight" ? 1 : -1,
            now: performance.now(),
          });
        }
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { y: event.clientY, moved: false };
      }}
      onPointerMove={(event) => {
        if (drag.current && Math.abs(event.clientY - drag.current.y) > 8) {
          dispatch({
            type: "presetTurn",
            delta: event.clientY < drag.current.y ? 1 : -1,
            now: performance.now(),
          });
          drag.current = { y: event.clientY, moved: true };
        }
      }}
      onPointerUp={() => {
        if (drag.current && !drag.current.moved)
          dispatch({ type: "presetConfirm", now: performance.now() });
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onLostPointerCapture={() => {
        drag.current = null;
      }}
      onClick={(event) => {
        if (event.detail === 0)
          dispatch({ type: "presetConfirm", now: performance.now() });
      }}
    />
  );
}
