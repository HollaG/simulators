import {
  useEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { bounds, type Bounds } from "./geometry";
import { clamp, faderDb, faderPosition, formatDb } from "./state";

export const positionStyle = (rect: Bounds): CSSProperties => ({
  left: `${rect.x}%`,
  top: `${rect.y}%`,
  width: `${rect.w}%`,
  height: `${rect.h}%`,
});
export function valueLabel(value: number, unit: string) {
  if (unit === "Hz")
    return value >= 1000
      ? `${(value / 1000).toFixed(2)} kHz`
      : `${Math.round(value)} Hz`;
  if (unit === "pan")
    return Math.abs(value) < 0.02
      ? "Center"
      : `${Math.round(Math.abs(value) * 100)}% ${value < 0 ? "left" : "right"}`;
  if (unit === "%") return `${Math.round(value * 100)}%`;
  if (unit === "blend")
    return value === 0
      ? "Equal blend"
      : `${Math.round(Math.abs(value) * 100)}% toward ${value < 0 ? "inputs" : "USB"}`;
  return formatDb(value);
}
type SliderProps = {
  label: string;
  rect: Bounds;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  onSelect?: () => void;
  disabled?: boolean;
  unit?: string;
  taper?: "fader" | "log";
  color?: string;
  reset?: number;
  fader?: boolean;
};

/** Pointer capture makes drag work outside the target. Cancellation and blur clear
 * the gesture; wheel listeners are non-passive only on the actual control.
 */
export function HardwareSlider({
  label,
  rect,
  value,
  min,
  max,
  step = 0.5,
  onChange,
  onSelect,
  disabled,
  unit = "dB",
  taper,
  color = "white",
  reset = 0,
  fader = false,
}: SliderProps) {
  const element = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ y: number; position: number; id: number } | null>(null);
  const normalize = (n: number) =>
    taper === "fader"
      ? faderPosition(n)
      : taper === "log"
        ? Math.log(n / min) / Math.log(max / min)
        : (n - min) / (max - min);
  const denormalize = (n: number) =>
    taper === "fader"
      ? faderDb(n)
      : taper === "log"
        ? min * (max / min) ** n
        : min + n * (max - min);
  const change = (n: number) =>
    onChange(clamp(Math.round(n / step) * step, min, max));
  const nudge = (direction: number, fast = false) => {
    if (taper) {
      let next = denormalize(
        clamp(normalize(value) + direction * (fast ? 0.05 : 0.01), 0, 1),
      );
      // A logarithmic step near the minimum can round back to the same value.
      // Keep wheel/keyboard controls moving by at least one parameter increment.
      if (Math.round(next / step) * step === value)
        next = value + direction * step;
      change(next);
    } else change(value + direction * step * (fast ? 10 : 1));
  };
  useEffect(() => {
    const control = element.current;
    const wheel = (event: WheelEvent) => {
      if (disabled) return;
      event.preventDefault();
      onSelect?.();
      nudge(event.deltaY < 0 ? 1 : -1, event.shiftKey);
    };
    const cancel = () => {
      drag.current = null;
    };
    control?.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("blur", cancel);
    return () => {
      control?.removeEventListener("wheel", wheel);
      window.removeEventListener("blur", cancel);
    };
  });
  const keyboard = (event: KeyboardEvent) => {
    if (
      [
        "ArrowUp",
        "ArrowRight",
        "ArrowDown",
        "ArrowLeft",
        "Home",
        "End",
      ].includes(event.key)
    ) {
      event.preventDefault();
      onSelect?.();
      if (event.key === "Home") change(min);
      else if (event.key === "End") change(max);
      else
        nudge(
          event.key === "ArrowUp" || event.key === "ArrowRight" ? 1 : -1,
          event.shiftKey,
        );
    }
  };
  const normalized = clamp(normalize(value), 0, 1);
  return (
    <button
      ref={element}
      type="button"
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueLabel(value, unit)}
      aria-orientation="vertical"
      disabled={disabled}
      title={`${label} · ${valueLabel(value, unit)}\nDrag ↑↓ · wheel · arrows · double-click to reset`}
      className={`hardware-control ${fader ? "fader" : `knob ${color}`}`}
      style={
        {
          ...positionStyle(rect),
          "--angle": `${-135 + normalized * 270}deg`,
          "--fader": `${(1 - normalized) * 82 + 9}%`,
        } as CSSProperties
      }
      onKeyDown={keyboard}
      onDoubleClick={() => {
        onSelect?.();
        change(reset);
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        onSelect?.();
        drag.current = {
          y: event.clientY,
          position: normalized,
          id: event.pointerId,
        };
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (!start || start.id !== event.pointerId || disabled) return;
        const distance = fader
          ? event.currentTarget.getBoundingClientRect().height * 0.82
          : 130;
        const amount =
          ((start.y - event.clientY) / distance) * (event.shiftKey ? 0.15 : 1);
        change(denormalize(clamp(start.position + amount, 0, 1)));
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onLostPointerCapture={() => {
        drag.current = null;
      }}
    >
      {fader ? (
        <>
          <span className="fader-track" />
          <span className="fader-cap">
            <i />
          </span>
        </>
      ) : (
        <span className="knob-cap">
          <i />
        </span>
      )}
    </button>
  );
}

export function HardwareSwitch({
  label,
  rect,
  active,
  onClick,
  disabled,
  round = false,
}: {
  label: string;
  rect: Bounds;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  round?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={`${label} · ${active ? "On" : "Off"}`}
      disabled={disabled}
      onClick={onClick}
      className={`hardware-control hardware-switch ${round ? "round" : ""} ${active ? "engaged" : ""}`}
      style={positionStyle(rect)}
    >
      {round ? "MUTE" : null}
    </button>
  );
}
export function PanelLED({
  x,
  y,
  active,
  color = "green",
  flashing = false,
  label,
}: {
  x: number;
  y: number;
  active: boolean;
  color?: string;
  flashing?: boolean;
  label: string;
}) {
  return (
    <span
      aria-label={`${label} ${active ? "on" : "off"}`}
      className={`panel-led ${active ? "on" : ""} ${flashing && active ? "flashing" : ""} ${color}`}
      style={positionStyle(bounds(x - 5, y - 5, 10, 10))}
    />
  );
}
