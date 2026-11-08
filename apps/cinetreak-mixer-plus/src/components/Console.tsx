import { useEffect, useRef, useState, type CSSProperties } from 'react';
import layout from '../panel-layout.json';
import { effects, type MixerState } from '../mixer/types';
import { enabled } from '../mixer/reducer';

type Bounds = { x: number; y: number; w: number; h: number };
const bounds = (b: Bounds): CSSProperties => ({ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` });
const labels: Record<string, string> = { cut: 'CUT', auto: 'AUTO', ftb: 'FTB', still: 'STILL', estop: 'E-STOP', pat: 'PAT', menu: 'MENU', key: 'KEY', onair: 'ON AIR', mem: 'MEM', mv: 'MV', audio: 'AUDIO', cam: 'CAM', pos: 'POS', zoomout: 'ZOOM−', zoomin: 'ZOOM+', power: '▣ ⏻' };
const tips: Record<string, string> = { cut: 'Exchange program and preview immediately · Space', auto: 'Take preview live with selected transition · Enter', key: 'Toggle selected effect in preview', onair: 'Toggle selected effect on program', mode: 'Scroll/drag to select an effect. Press to position.', encoder: 'Scroll/drag to navigate. Press to enter or confirm.', ftb: 'Fade program to black; press again to recover', still: 'Freeze/release the program input', pos: 'CAM + POS: PVW saves presets, PGM recalls', power: 'Short press: lock/unlock. Hold 2 seconds: power off.' };
interface Props { state: MixerState; screenRef: React.RefObject<HTMLCanvasElement | null>; press: (id: string) => void; turn: (delta: number) => void; mode: (delta: number) => void; move: (x: number, y: number, zoom?: number) => void; zoom: number; debug: boolean }

export function Console({ state: s, screenRef, press, turn, mode, move, zoom, debug }: Props) {
  const powerTimer = useRef<ReturnType<typeof setTimeout> | null>(null), longPress = useRef(false);
  useEffect(() => () => { if (powerTimer.current) clearTimeout(powerTimer.current); }, []);
  const stopPower = () => { if (powerTimer.current) clearTimeout(powerTimer.current); powerTimer.current = null; };
  const active = (id: string) => {
    if (!s.power) return '';
    if (/^pgm[1-4]$/.test(id)) return s.cam && s.pos ? s.presets[Number(s.params['ptz.camera']) - 1][Number(id[3]) - 1] ? 'white' : '' : s.pgm.source === `IN${id[3]}` ? 'red' : '';
    if (/^pvw[1-4]$/.test(id)) return s.cam && s.pos ? 'green preset' : s.pvw.source === `IN${id[3]}` ? 'green' : '';
    if (id === 'key') return enabled(s, 'pvw', s.selected) ? 'green' : '';
    if (id === 'onair') return enabled(s, 'pgm', s.selected) ? 'red' : '';
    if (id === 'ftb') return s.fade || s.black > 0 ? 'red flash' : '';
    if (id === 'still') return s.freeze ? 'red' : '';
    if (id === 'auto') return s.transition ? 'white' : '';
    if (id === 'power') return s.locked ? 'red flash' : '';
    if (id === 'estop' || id === 'pat') return s.pvw.source === (id === 'pat' ? 'PAT' : 'E-STOP') ? 'green' : '';
    return ({ mv: s.mv, cam: s.cam, pos: s.pos, menu: s.menu.open, audio: s.menu.open && s.menu.path[0] === 1 } as Record<string, boolean>)[id] ? id === 'pos' ? 'white flash' : 'white' : '';
  };
  return <div className="console-scroll"><div className={`console ${debug ? 'debug-layout' : ''}`} style={{ width: `${zoom}%`, maxWidth: `${zoom * 11}px`, '--key-brightness': ({ Low: .45, Medium: .7, High: 1 } as any)[s.params['system.keys'] as string] } as CSSProperties} data-testid="console">
    <img src={`${import.meta.env.BASE_URL}console.png`} className="panel-photo" alt="CineTreak Mixer Plus console: program above preview" draggable={false} />
    <canvas ref={screenRef} width={960} height={540} className="lcd" style={bounds(layout.screen)} aria-label="Mixer LCD" data-testid="lcd" />
    {Object.entries(layout.controls).filter(([id]) => !['mode', 'encoder', 'joystick'].includes(id)).map(([id, box]) => {
      const source = /^(pgm|pvw)([1-4])$/.exec(id), large = !!source || id === 'cut' || id === 'auto';
      const light = active(id);
      return <button key={id} style={bounds(box)} className={`panel-button ${large ? 'large' : 'small'} ${light}`} aria-label={source ? `${source[1].toUpperCase()} ${source[2]}` : id === 'power' ? 'Lock / power' : labels[id]} aria-pressed={!!light} title={tips[id] ?? labels[id]} disabled={!s.power && id !== 'power'}
        onClick={id === 'power' ? () => { if (!longPress.current) press('power'); longPress.current = false; } : id.startsWith('zoom') ? undefined : () => press(id)}
        onPointerDown={event => {
          if (id === 'power') { event.currentTarget.setPointerCapture(event.pointerId); longPress.current = false; powerTimer.current = setTimeout(() => { longPress.current = true; press('shutdown'); }, 2000); }
          if (id === 'zoomin' || id === 'zoomout') { event.currentTarget.setPointerCapture(event.pointerId); move(0, 0, id === 'zoomin' ? 1 : -1); }
        }} onPointerUp={() => { stopPower(); if (id.startsWith('zoom')) move(0, 0); }} onPointerCancel={() => { stopPower(); longPress.current = true; move(0, 0); }} onLostPointerCapture={() => { stopPower(); if (id.startsWith('zoom')) move(0, 0); }}
        onKeyDown={event => { if (id.startsWith('zoom') && (event.key === ' ' || event.key === 'Enter')) { event.preventDefault(); move(0, 0, id === 'zoomin' ? 1 : -1); } }} onKeyUp={() => { if (id.startsWith('zoom')) move(0, 0); }}>
        {source ? source[2] : labels[id]}
      </button>;
    })}
    <Knob box={layout.controls.mode} label="Effect selector" value={s.selected.toUpperCase()} angle={effects.indexOf(s.selected) * 48} onTurn={mode} onPress={() => press('mode')} disabled={!s.power || s.locked} />
    <Knob box={layout.controls.encoder} label="Menu encoder" value={s.menu.editing ? 'Edit value' : 'Navigate menu'} onTurn={turn} onPress={() => press('encoder')} disabled={!s.power || s.locked} />
    <div className="joystick" style={bounds(layout.controls.joystick)} aria-label="PTZ joystick">
      <div className="joystick-base" />
      {[['up', 0, -1, '▲'], ['down', 0, 1, '▼'], ['left', -1, 0, '◀'], ['right', 1, 0, '▶']].map(([id, x, y, arrow]) => <button key={id} className={`joy-${id}`} aria-label={`Joystick ${id}`} disabled={!s.power} title={`Hold to move ${id}`}
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); move(Number(x), Number(y)); }} onPointerUp={() => move(0, 0)} onPointerCancel={() => move(0, 0)} onLostPointerCapture={() => move(0, 0)} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); move(Number(x), Number(y)); } }} onKeyUp={() => move(0, 0)}>{arrow}</button>)}
      <button className="joy-center" aria-label="Joystick center" onClick={() => press('joystick')} title="Finish positioning" />
    </div>
    {Object.entries(layout.leds).map(([effect, box]) => {
      const p = enabled(s, 'pgm', effect as any), v = enabled(s, 'pvw', effect as any);
      const color = !s.power ? 'off' : p && v ? 'yellow' : p ? 'red' : v ? 'green' : 'off';
      return <span key={effect} style={bounds(box)} className={`effect-led ${color} ${s.selected === effect ? 'selected' : ''} ${s.position === effect ? 'flash' : ''}`} title={`${effect.toUpperCase()}: ${color}`} data-testid={`led-${effect}`} data-color={color} />;
    })}
  </div></div>;
}

function Knob({ box, label, value, angle, onTurn, onPress, disabled }: { box: Bounds; label: string; value: string; angle?: number; onTurn: (delta: number) => void; onPress: () => void; disabled: boolean }) {
  const ref = useRef<HTMLButtonElement>(null), drag = useRef<{ y: number; start: number; moved: boolean } | null>(null);
  const [rotation, setRotation] = useState(0);
  const turn = (delta: number) => { if (!disabled) { onTurn(delta); setRotation(value => value + delta * 18); } };
  const latest = useRef(turn); latest.current = turn;
  useEffect(() => {
    const element = ref.current!;
    const wheel = (event: WheelEvent) => { event.preventDefault(); latest.current(event.deltaY > 0 ? 1 : -1); };
    element.addEventListener('wheel', wheel, { passive: false }); return () => element.removeEventListener('wheel', wheel);
  }, []);
  return <button ref={ref} className={`knob ${label === 'Effect selector' ? 'mode-knob' : ''}`} style={bounds(box)} aria-label={label} aria-description={`${value}. Scroll or drag to turn; press to confirm.`} title={`${label} · ${value}. Scroll/drag to turn; click to press.`} disabled={disabled}
    onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { y: e.clientY, start: e.clientY, moved: false }; }}
    onPointerMove={e => { if (!drag.current) return; const delta = Math.trunc((drag.current.y - e.clientY) / 8); if (delta) { drag.current.moved = true; drag.current.y -= delta * 8; turn(delta); } }}
    onPointerUp={() => { if (drag.current && !drag.current.moved) onPress(); drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
    onKeyDown={e => { if (['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(e.key)) { e.preventDefault(); turn(e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : -1); } }}
    onClick={e => { if (e.detail === 0) onPress(); }}>
    <span className="knob-face" style={{ transform: `rotate(${angle ?? rotation}deg)` }}><span /></span>
  </button>;
}
