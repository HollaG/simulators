import { ArrowDownToLine, Upload } from "lucide-react";
import { DEMO_NAMES } from "./state";

export const sourceLabel = (id: string | null) =>
  !id
    ? "No source"
    : id === "tone"
      ? "1 kHz test tone"
      : id.startsWith("demo:")
        ? (DEMO_NAMES[Number(id.slice(5))] ?? "Unknown source")
        : id.split(":").slice(2).join(":");

export function SourceSelect({
  value,
  onChange,
  files,
  disabled,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  files: string[];
  disabled?: boolean;
}) {
  return (
    <select
      aria-label="Source"
      value={value ?? ""}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value || null)}
    >
      <option value="">No source connected</option>
      <optgroup label="Practice sources">
        {DEMO_NAMES.map((name, i) => (
          <option key={i} value={`demo:${i}`}>
            {name}
          </option>
        ))}
        <option value="tone">1 kHz test tone</option>
      </optgroup>
      {files.length > 0 && (
        <optgroup label="Imported audio">
          {files.map((id) => (
            <option key={id} value={id}>
              {sourceLabel(id)}
            </option>
          ))}
        </optgroup>
      )}
      {value?.startsWith("file:") && !files.includes(value) && (
        <option value={value}>Missing: {sourceLabel(value)}</option>
      )}
    </select>
  );
}
export function FileInput({
  onFile,
  disabled,
  label = "Import audio file",
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <label className={`import-button ${disabled ? "disabled" : ""}`}>
      <Upload size={14} />
      <span>{label}</span>
      <ArrowDownToLine size={13} />
      <input
        aria-label={label}
        disabled={disabled}
        type="file"
        accept="audio/*,.wav,.mp3,.ogg,.flac,.m4a"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = "";
        }}
      />
    </label>
  );
}
