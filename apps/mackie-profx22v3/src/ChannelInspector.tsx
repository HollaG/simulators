import type { Dispatch } from "react";
import {
  CHANNEL_LABELS,
  channelRange,
  formatDb,
  type Action,
  type Channel,
  type MixerState,
  type NumericChannelKey,
} from "./state";
import { valueLabel } from "./Controls";
import { SourceSelect, FileInput, sourceLabel } from "./SourceInput";

/** Readable controls for the selected physical strip, using the same reducer. */
export function ChannelInspector({
  state,
  dispatch,
  index,
  files,
  missing,
  onImport,
}: {
  state: MixerState;
  dispatch: Dispatch<Action>;
  index: number;
  files: string[];
  missing: (id: string | null) => boolean;
  onImport: (file: File, index: number) => Promise<void>;
}) {
  const channel = state.channels[index];
  const set = (key: keyof Channel, value: string | boolean | number | null) =>
    dispatch({ type: "channel", index, key, value });
  const disabled = !state.power;
  const isMic =
    index < 17 && (channel.input === "mic" || channel.input === "condenser");
  const effectiveSource =
    index === 17 && state.globals.usb34 ? state.usb34Source : channel.source;
  const numericField = (key: NumericChannelKey, label: string, unit = "dB") => {
    const [min, max, step] = channelRange(index, key);
    const gainOffset = key === "gain" && index < 14 && isMic ? 20 : 0;
    return (
      <label className="parameter-field" key={key}>
        <span>{label}</span>
        <div>
          <input
            aria-label={`Inspector ${label}`}
            type="number"
            min={min + gainOffset}
            max={max + gainOffset}
            step={step}
            value={Number((channel[key] + gainOffset).toFixed(2))}
            disabled={disabled}
            onChange={(event) => {
              const value = event.target.valueAsNumber;
              if (Number.isFinite(value)) set(key, value - gainOffset);
            }}
          />
          <span>{unit}</span>
        </div>
      </label>
    );
  };
  return (
    <>
      <div className="channel-heading">
        <span className="channel-number">{CHANNEL_LABELS[index]}</span>
        <div>
          <span>
            {index < 14
              ? "MONO INPUT"
              : index < 17
                ? "STEREO / MIC INPUT"
                : "STEREO LINE / USB"}
          </span>
          <input
            aria-label="Channel name"
            value={channel.name}
            maxLength={60}
            disabled={disabled}
            onChange={(event) => set("name", event.target.value)}
          />
        </div>
      </div>
      <section className="source-section">
        <div className="section-label">
          <span>INPUT SOURCE</span>
          <span
            className={`source-status ${effectiveSource && !missing(effectiveSource) ? "online" : ""}`}
          >
            {missing(effectiveSource)
              ? "MISSING"
              : effectiveSource
                ? "CONNECTED"
                : "EMPTY"}
          </span>
        </div>
        <SourceSelect
          value={channel.source}
          files={files}
          disabled={disabled || (index === 17 && state.globals.usb34)}
          onChange={(source) => set("source", source)}
        />
        <FileInput
          disabled={disabled || (index === 17 && state.globals.usb34)}
          onFile={(file) => onImport(file, index)}
        />
        <p className="source-caption">
          Your files stay on this device. Audio loops while running.
        </p>
        {missing(effectiveSource) && (
          <p className="missing-source">
            “{sourceLabel(effectiveSource)}” needs relinking. Import it again to
            restore audio.
          </p>
        )}
        {index === 17 && state.globals.usb34 && (
          <p className="source-caption">
            USB 3–4 is selected. Set its source in USB returns below.
          </p>
        )}
        {index < 17 && (
          <label className="input-type-label">
            INPUT TYPE
            <select
              aria-label="Input type"
              disabled={disabled}
              value={channel.input}
              onChange={(event) => set("input", event.target.value)}
            >
              <option value="line">
                {index < 14 ? "Line level" : "Stereo line"}
              </option>
              <option value="mic">Dynamic microphone</option>
              <option value="condenser">
                Condenser microphone · needs 48V
              </option>
              {index < 2 && (
                <option value="instrument">
                  Instrument · practise with Hi-Z
                </option>
              )}
            </select>
          </label>
        )}
        {index >= 14 && index < 17 && !isMic && (
          <p className="source-caption">
            The gain knob affects the mic input only.
          </p>
        )}
        {channel.input === "condenser" && !state.globals.phantom && (
          <p className="missing-source">
            Enable global 48V to power this virtual condenser.
          </p>
        )}
        {channel.input === "instrument" && !channel.hiZ && (
          <p className="source-caption">
            Engage Hi-Z for instrument practice. Electrical loading is not
            simulated.
          </p>
        )}
      </section>
      <section className="channel-settings">
        <div className="section-label">
          <span>CHANNEL SETTINGS</span>
          <span className="readout-pill">{formatDb(channel.fader)}</span>
        </div>
        <div className="parameter-grid">
          {numericField("gain", isMic ? "Mic gain" : "Gain")}
          {numericField("fader", "Fader")}
          {numericField("high", "High EQ")}
          {numericField("mid", "Mid EQ")}
          {numericField("low", "Low EQ")}
          {index !== 17 && numericField("freq", "Mid frequency", "Hz")}
        </div>
        <div className="pan-readout">
          <span>PAN / BALANCE</span>
          <strong>{valueLabel(channel.pan, "pan")}</strong>
        </div>
        <input
          className="pan-input"
          type="range"
          aria-label="Inspector Pan"
          min="-1"
          max="1"
          step=".02"
          value={channel.pan}
          disabled={disabled}
          onChange={(event) => set("pan", Number(event.target.value))}
        />
        <div className="route-buttons">
          {(
            [
              { key: "mute", label: "MUTE" },
              { key: "solo", label: "PFL" },
              { key: "sub12", label: "1–2" },
              { key: "sub34", label: "3–4" },
              { key: "lr", label: "L–R" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              disabled={disabled}
              aria-label={`Inspector ${label}`}
              aria-pressed={channel[key]}
              className={`${channel[key] ? "active" : ""} ${key === "mute" ? "mute-route" : ""}`}
              onClick={() => set(key, !channel[key])}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
