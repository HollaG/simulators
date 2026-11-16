import { useEffect, useRef, type CSSProperties } from "react";

/** A dial has one press action; drag/wheel/arrow keys rotate without also pressing.
 * Pointer capture and cancellation keep a released or blurred drag from sticking.
 */
export function Knob({ name, style, disabled, turn, press }: { name: string; style: CSSProperties; disabled: boolean; turn: (delta: number) => void; press: () => void }) {
  const button = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ id: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const onTurn = useRef(turn);
  onTurn.current = turn;
  useEffect(() => {
    const node = button.current!;
    const wheel = (event: WheelEvent) => {
      if (node.disabled) return;
      event.preventDefault();
      if (event.deltaY) onTurn.current(event.deltaY < 0 ? 1 : -1);
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, []);
  const cancel = () => { if (drag.current) suppressClick.current = true; drag.current = null; };
  useEffect(() => {
    if (disabled) cancel();
    window.addEventListener("blur", cancel);
    return () => window.removeEventListener("blur", cancel);
  }, [disabled]);
  return <button ref={button} className="fc-hit fc-knob" style={style} disabled={disabled} aria-label={`${name} knob`} title={`${name} knob: drag up/down, scroll or use arrow keys; click to press`}
    onPointerDown={event => {
      if (event.button !== 0) return;
      suppressClick.current = false;
      drag.current = { id: event.pointerId, y: event.clientY, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      const d = drag.current;
      if (!d || d.id !== event.pointerId) return;
      const steps = Math.trunc((d.y - event.clientY) / 6);
      if (steps) { d.moved = true; d.y -= steps * 6; onTurn.current(steps); }
    }}
    onPointerUp={event => {
      if (!drag.current) return;
      suppressClick.current = drag.current.moved;
      drag.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }}
    onPointerCancel={cancel} onLostPointerCapture={cancel} onBlur={cancel}
    onClick={() => { if (!suppressClick.current) press(); suppressClick.current = false; }}
    onKeyDown={event => {
      if (["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft", "PageUp", "PageDown"].includes(event.key)) {
        event.preventDefault();
        turn((["ArrowUp", "ArrowRight", "PageUp"].includes(event.key) ? 1 : -1) * (event.key.startsWith("Page") ? 10 : 1));
      }
      if (event.key === "Enter" || event.key === " ") suppressClick.current = false;
    }} />;
}
