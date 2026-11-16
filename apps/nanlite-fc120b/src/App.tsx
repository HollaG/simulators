import { useEffect, useReducer, useState } from "react";
import { SiteLayout } from "@practicedesk/ui";
import { Display, contextHint } from "./Display";
import { Knob } from "./Knob";
import { Preview } from "./Preview";
import { bounds, position } from "./panel";
import { STORAGE_KEY, effects, fanCap, initialState, loadConfig, reducer, valueLabel, type Action } from "./state";
import "./style.css";

function restore() {
  try { return initialState(loadConfig(localStorage.getItem(STORAGE_KEY))); }
  catch { return initialState(); }
}

/** Browser storage and optional practice aids surround the unchanged physical panel. */
export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, restore);
  const [outlines, setOutlines] = useState(false);
  const [animate, setAnimate] = useState(() => !matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [storageError, setStorageError] = useState("");
  const base = import.meta.env.BASE_URL;
  const act = (action: Omit<Extract<Action, { type: "TURN" }>, "now"> | Omit<Extract<Action, { type: "PRESS" }>, "now"> | { type: "POWER" | "MODE" | "MENU" | "RESET" }) => dispatch({ ...action, now: performance.now() } as Action);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        let old;
        try { old = JSON.parse(raw); } catch { /* Replace corrupted known browser data. */ }
        if (old && old.version !== 1) {
          setStorageError("A different settings version was left untouched. This session will not be saved.");
          return;
        }
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, config: state.config }));
    } catch { setStorageError("Browser storage is unavailable. Your settings will last for this visit only."); }
  }, [state.config]);
  return <SiteLayout page="fc120b" theme="dark" base={import.meta.env.VITE_SITE_BASE || "/"} manual={{ title: "Nanlite FC-120B", url: `${base}manual.pdf` }}>
    <main className="fc-main">
      <header className="fc-heading">
        <div><div className="fc-eyebrow"><span /> LIGHTING PRACTICE / 06</div><h1><span>NANLITE</span> FC-120B</h1><p>A little light. A lot of possibilities.</p></div>
        <div className="fc-heading-note">BI-COLOR SPOT LIGHT<span>2700–6500K · ONBOARD CONTROL</span></div>
      </header>
      <div className="fc-workbench">
        <section className="fc-panel-card" aria-label="Rear control panel">
          <div className="fc-section-label"><span>01 / THE FIXTURE</span><span className={state.power ? "fc-on" : ""}>● {state.power ? "POWER ON" : "POWER OFF"}</span></div>
          <div className="fc-photo-wrap">
            <div className="fc-panel" data-outlines={outlines}>
              <img src={`${base}panel.webp`} alt="Nanlite FC-120B rear panel with two knobs, MODE, MENU and POWER" draggable="false" />
              <div className="fc-screen" style={position(bounds.screen)}><Display state={state} /></div>
              {(["left", "right"] as const).map(knob => <Knob key={knob} name={knob === "left" ? "Left" : "Right"} style={position(bounds[knob])} disabled={!state.power} turn={delta => act({ type: "TURN", knob, delta })} press={() => act({ type: "PRESS", knob })} />)}
              <button className="fc-hit" style={position(bounds.mode)} disabled={!state.power} aria-label="MODE" onClick={() => act({ type: "MODE" })} />
              <button className="fc-hit" style={position(bounds.menu)} disabled={!state.power} aria-label="MENU" onClick={() => act({ type: "MENU" })} />
              <button className="fc-hit fc-power" style={position(bounds.power)} aria-label="Fixture power" aria-pressed={state.power} onClick={() => act({ type: "POWER" })}><span className={state.power ? "is-on" : ""}>I <i /> O</span></button>
            </div>
          </div>
          <div className="fc-control-guide"><span>↕ Drag a knob</span><span>↻ Scroll to turn</span><span>↵ Click to press</span></div>
          <p className="fc-key-hint">Keyboard: Tab to a knob · arrows to turn · Page Up/Down for 10 steps · Enter to press</p>
        </section>
        <aside className="fc-monitor-column">
          <section className="fc-monitor-card">
            <div className="fc-section-label"><span>02 / DISPLAY</span><span>LIVE MIRROR</span></div>
            <div className="fc-enlarged"><Display state={state} enlarged /></div>
            <p className="fc-context" role="status">{contextHint(state)}</p>
            {state.blackout && <div className="fc-blackout">BLACKOUT · Press the left knob to restore</div>}
          </section>
          <section className="fc-output-card">
            <div className="fc-section-label"><span>03 / LIGHT STUDY</span><span>ILLUSTRATIVE</span></div>
            <Preview state={state} animate={animate} />
            <div className="fc-output-meta"><span>{valueLabel("fan", state.config.settings.fan)} <b>Fan / {fanCap(state.config)}% power cap</b></span><span>{state.config.mode === "CCT" ? "CCT" : effects[state.config.effect].name}<b>{valueLabel("output", state.config.settings.output)}</b></span></div>
            <label className="fc-check"><input type="checkbox" checked={animate} onChange={e => setAnimate(e.target.checked)} /> Animate effect preview</label>
            <p className="fc-fine">Relative light and effect timing are approximations. This preview is not a lux or colour-accuracy measurement.</p>
          </section>
        </aside>
      </div>
      <section className="fc-practice">
        <div><div className="fc-eyebrow">A FIRST REHEARSAL</div><h2>Find your light.</h2><p>Power on. Set a warm CCT, dim it down, then press the left knob to black out and restore. Try MODE → CCT LOOP. Turn the right knob to SPEED and adjust it with the left.</p></div>
        <div className="fc-tools"><label className="fc-check"><input type="checkbox" checked={outlines} onChange={e => setOutlines(e.target.checked)} /> Show control targets</label><button onClick={() => { if (window.confirm("Reset all simulator settings?")) act({ type: "RESET" }); }}>Reset practice session</button><span>Settings save locally. Reload starts with power off.</span></div>
      </section>
      {storageError && <p role="alert" className="fc-storage-error">{storageError}</p>}
      <details className="fc-accuracy"><summary>Accuracy & supported controls</summary><p>Based on your FC-120B photo and supplied English manual. Power, CCT presets, blackout/restore, 14 effect entries, manual triggers and onboard menu navigation are implemented. Fan power caps affect the illustrative output.</p><p>DMX and wireless settings rehearse navigation only: no DMX/RDM, Bluetooth, Nanlink, radio or USB connection is made. Firmware operations are unavailable. Chinese labels are simulator translations. Dial increments, range-endpoint editing, menu wrapping, initial values, brightness range (1–5) and exact effect waveforms need comparison with your fixture. Reset is immediate here; the manual allows about a minute.</p><p>The manual's isolated MODE-to-menu wording and copied TV/WELDING trigger text conflict with its detailed workflows. This simulator uses MENU for settings and right-knob triggers only in STORM MANUAL / EXPLOSION MANUAL. Hardware accuracy has not been verified.</p></details>
    </main>
  </SiteLayout>;
}
