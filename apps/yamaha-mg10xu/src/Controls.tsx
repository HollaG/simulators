import { useEffect, useRef, type CSSProperties } from "react";
import { position, type Bounds } from "./geometry";
import { clamp } from "./state";

/** Relative vertical drag preserves the current value when grabbing a knob.
 * Pointer capture and cancellation keep a released/abandoned gesture from sticking.
 */
export function Knob({
  label,
  value,
  min = 0,
  max = 10,
  step = 0.1,
  reset = 0,
  bounds,
  color = "white",
  format = (n) => n.toFixed(1),
  onChange,
  onSelect,
  onPress,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  reset?: number;
  bounds: Bounds;
  color?: string;
  format?: (n: number) => string;
  onChange: (value: number, held?: boolean) => void;
  onSelect?: () => void;
  onPress?: () => void;
}) {
  const element = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ y: number; value: number; id: number } | null>(null);
  const moved = useRef(false);
  const change = (n: number, held = false) =>
    onChange(
      clamp(Number((Math.round(n / step) * step).toFixed(4)), min, max),
      held,
    );
  useEffect(() => {
    const control = element.current;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      onSelect?.();
      change(
        value + (event.deltaY < 0 ? step : -step) * (event.shiftKey ? 10 : 1),
      );
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
  return (
    <button
      ref={element}
      type="button"
      role="slider"
      className="mg-knob"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={format(value)}
      aria-orientation="vertical"
      title={`${label} · ${format(value)}\nDrag up/down · wheel · arrows · double-click to reset`}
      style={
        {
          ...position(bounds),
          "--angle": `${-135 + ((value - min) / (max - min)) * 270}deg`,
          "--knob-color": color,
        } as CSSProperties
      }
      onFocus={onSelect}
      onClick={() => {
        if (!moved.current) onPress?.();
        moved.current = false;
      }}
      onDoubleClick={() => {
        if (!onPress) change(reset);
      }}
      onKeyDown={(event) => {
        if (
          ![
            "ArrowUp",
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",
            "Home",
            "End",
          ].includes(event.key)
        )
          return;
        event.preventDefault();
        if (event.key === "Home") change(min);
        else if (event.key === "End") change(max);
        else
          change(
            value +
              (["ArrowUp", "ArrowRight"].includes(event.key) ? step : -step) *
                (event.shiftKey ? 10 : 1),
          );
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.focus();
        moved.current = false;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { y: event.clientY, value, id: event.pointerId };
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (!start || start.id !== event.pointerId) return;
        if (Math.abs(start.y - event.clientY) > 3) moved.current = true;
        if (!moved.current) return;
        change(
          start.value +
            ((start.y - event.clientY) / 160) *
              (max - min) *
              (event.shiftKey ? 0.15 : 1),
          true,
        );
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
      <span className="mg-knob-cap">
        <i />
      </span>
    </button>
  );
}

export function Switch({
  label,
  active,
  bounds,
  onClick,
  round = false,
  momentary = false,
}: {
  label: string;
  active: boolean;
  bounds: Bounds;
  onClick: () => void;
  round?: boolean;
  momentary?: boolean;
}) {
  return (
    <button
      type="button"
      className={`mg-switch ${round ? "round" : ""} ${momentary ? "momentary" : ""}`}
      style={position(bounds)}
      aria-label={label}
      aria-pressed={active}
      title={`${label} · ${active ? "on" : "off"}`}
      onClick={onClick}
    >
      <span />
    </button>
  );
}

export function LED({
  label,
  active,
  bounds,
  color = "green",
}: {
  label: string;
  active: boolean;
  bounds: Bounds;
  color?: "green" | "yellow" | "red";
}) {
  return (
    <span
      role="img"
      aria-label={`${label} ${active ? "on" : "off"}`}
      data-lit={active}
      className={`mg-led ${color}`}
      style={position(bounds)}
    />
  );
}
