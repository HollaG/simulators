import { useEffect, useRef } from "react";
import { kelvinRgb, sample } from "./signal";
import type { State } from "./state";

/** One frame loop draws a simple studio still life and exposes its sampled output.
 * Preview time stays outside React; all surfaces use the same sampled signal.
 */
export function Preview({ state, animate }: { state: State; animate: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reading = useRef<HTMLOutputElement>(null);
  const current = useRef({ state, animate });
  current.current = { state, animate };
  useEffect(() => {
    const node = canvas.current!, ctx = node.getContext("2d")!;
    let frame = 0;
    const draw = () => {
      const { state: s, animate: running } = current.current;
      const signal = sample(s, running || s.config.mode === "CCT" ? performance.now() : s.epoch);
      const color = kelvinRgb(signal.cct).map(Math.round);
      const strength = signal.dim / 100;
      node.dataset.level = signal.dim.toFixed(2);
      node.dataset.cct = signal.cct.toFixed(0);
      if (reading.current) reading.current.value = `${Math.round(signal.dim)}% relative · ${Math.round(signal.cct)}K`;
      ctx.fillStyle = "#0c1211"; ctx.fillRect(0, 0, 640, 400);
      const glow = ctx.createRadialGradient(345, 145, 0, 330, 160, 310);
      glow.addColorStop(0, `rgba(${color.join(",")},${strength * 0.7})`);
      glow.addColorStop(1, `rgba(${color.join(",")},0)`);
      ctx.fillStyle = glow; ctx.fillRect(0, 0, 640, 400);
      ctx.fillStyle = "#171f1b"; ctx.fillRect(0, 295, 640, 105);
      const lit = (factor: number) => `rgb(${color.map(c => Math.round(12 + c * strength * factor)).join(",")})`;
      ctx.fillStyle = "#070c0a";
      ctx.beginPath(); ctx.ellipse(349, 313, 147, 17, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = lit(0.82); ctx.fillRect(215, 191, 108, 114);
      ctx.fillStyle = lit(0.48); ctx.beginPath(); ctx.moveTo(323, 191); ctx.lineTo(349, 171); ctx.lineTo(349, 285); ctx.lineTo(323, 305); ctx.closePath(); ctx.fill();
      ctx.fillStyle = lit(0.98); ctx.beginPath(); ctx.moveTo(215, 191); ctx.lineTo(242, 171); ctx.lineTo(349, 171); ctx.lineTo(323, 191); ctx.closePath(); ctx.fill();
      const sphere = ctx.createRadialGradient(397, 215, 2, 430, 255, 72);
      sphere.addColorStop(0, lit(1)); sphere.addColorStop(0.6, lit(0.5)); sphere.addColorStop(1, "#0b100e");
      ctx.fillStyle = sphere; ctx.beginPath(); ctx.arc(420, 255, 56, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#43564a"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(32, 32); ctx.lineTo(58, 32); ctx.moveTo(32, 32); ctx.lineTo(32, 58); ctx.moveTo(608, 368); ctx.lineTo(582, 368); ctx.moveTo(608, 368); ctx.lineTo(608, 342); ctx.stroke();
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, []);
  return <div className="fc-preview">
    <canvas ref={canvas} width="640" height="400" aria-label="Illustrative light output" />
    <span className="fc-preview-label">STUDIO / OUTPUT STUDY</span>
    <output ref={reading} aria-label="Relative output reading" />
    {!animate && state.config.mode === "EFFECT" && <span className="fc-preview-paused">Effect preview paused</span>}
  </div>;
}
