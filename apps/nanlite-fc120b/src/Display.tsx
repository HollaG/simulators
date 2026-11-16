import { effects, menus, paramLabel, setting, valueLabel, type ParamId, type State, type SettingId } from "./state";

const zh: Record<string, string> = {
  "MENU": "菜单", "CCT MODE": "色温模式", "EFFECT MODE": "特效模式", "OUTPUT MODE": "输出模式",
  "ADDRESS/DMX": "地址/DMX", "WIRELESS CONTROL": "无线控制", "FAN CONTROL": "风扇控制", "ROTATE SCREEN": "旋转屏幕",
  "SCREEN BRIGHTNESS": "屏幕亮度", "LANGUAGE": "语言", "FIRMWARE UPDATE": "固件更新", "RESET ALL SETTINGS": "重置所有设置",
  "VERSION": "版本", "ADDRESS": "地址", "DMX MODE": "DMX模式", "DMX REDUCED CHANNELS": "DMX通道精简",
  "DMX DIMMING CURVE": "DMX调光曲线", "DMX SMOOTHING": "DMX平滑", "RESET BLUETOOTH": "重置蓝牙", "WIRELESS PROTOCOL": "无线协议",
  "SMART": "智能", "FULL SPEED": "全速", "LOW SPEED": "低速", "OFF": "关闭", "ON": "开启", "NO": "否", "YES": "是", "BACK": "返回", "RESET": "重置",
  "MAX OUTPUT": "最大输出", "CONSTANT OUTPUT": "恒定输出", "ENGLISH": "英语", "SET": "已设置",
  "MENU TO RETURN": "按MENU返回", "RIGHT KNOB TO TRIGGER": "按右旋钮触发", "DIM": "亮度", "CCT": "色温", "SPEED": "速度",
  "INTERVALS": "间隔", "FLASH RATIO": "闪光比例", "PULSES/MIN": "每分钟脉冲", "CCT SHIFT": "色温偏移", "INTENSITY": "强度", "DECAY": "衰减", "PAUSE": "暂停",
};
export const translate = (state: State, text: string) => state.config.settings.language ? zh[text] ?? text : text;
type Run = { text: string; selected?: boolean };

/** Both LCD sizes render the same SVG model; the photographed display is fully covered. */
export function Display({ state, enlarged = false }: { state: State; enlarged?: boolean }) {
  const { config, menu } = state;
  const tr = (text: string) => translate(state, text);
  const rows: Run[][] = [];
  let message: string[] | undefined;
  let foot = "";
  if (state.power) {
    if (menu) {
      foot = tr("MENU TO RETURN");
      if (menu.notice) message = menu.notice.split("\n").map(tr);
      else if (menu.editor) {
        const id = menu.editor;
        if (id === "firmware") message = ["NO FIRMWARE FOUND", "USB update is unavailable", "in this simulator"];
        else if (id === "version") message = ["PRACTICE SIMULATOR", "Hardware firmware unknown", "Manual example: 1.03.06"];
        else if (id === "reset" || id === "bluetooth") {
          rows.push([{ text: id === "reset" ? "Reset all settings?" : "Reset Bluetooth?" }], [{ text: "Simulator only" }]);
          rows.push([{ text: tr(id === "reset" ? "NO" : "BACK"), selected: menu.draft === 0 }, { text: "    " }, { text: tr(id === "reset" ? "YES" : "RESET"), selected: menu.draft === 1 }]);
        } else {
          const s = setting(id), options = s.options;
          if (options) {
            const start = Math.max(0, menu.draft - 3);
            options.slice(start, start + 4).forEach((label, i) => rows.push([{ text: tr(label), selected: menu.draft === start + i }]));
          } else {
            rows.push([{ text: tr(s.label) }], [{ text: valueLabel(id, menu.draft), selected: true }]);
          }
        }
      } else {
        const list = menus[menu.group], start = Math.max(0, menu.cursor - 3);
        list.slice(start, start + 4).forEach((entry, i) => rows.push([{ text: tr(entry.label), selected: menu.cursor === start + i }]));
      }
    } else if (config.mode === "EFFECT") {
      const effect = effects[config.effect], values = config.effects[config.effect];
      rows.push([{ text: "EFFECT: " }, { text: effect.name, selected: state.field === 0 }]);
      const done = new Set<ParamId>();
      const run = (id: ParamId): Run => {
        const index = effect.params.findIndex(p => p.id === id), p = effect.params[index];
        done.add(id);
        const value = state.blackout && (id === "dim" || id === "dimLow") ? 0 : values[id]!;
        return { text: paramLabel(p, value), selected: state.field === index + 1 };
      };
      for (const p of effect.params) {
        if (done.has(p.id)) continue;
        const pair: Partial<Record<ParamId, ParamId>> = { dimLow: "dim", cctLow: "cctHigh", intervalLow: "intervalHigh" };
        const high = pair[p.id];
        if (high) rows.push([{ text: `${tr(p.id === "dimLow" ? "DIM" : p.id === "cctLow" ? "CCT" : "INTERVALS")}: ` }, run(p.id), { text: " - " }, run(high)]);
        else rows.push([{ text: `${tr(p.label)}: ` }, run(p.id)]);
      }
      foot = effect.manual ? tr("RIGHT KNOB TO TRIGGER") : tr("MENU TO RETURN");
    }
  }
  // Long effects fit five rows; preserve selected-value highlighting within range rows.
  const lineHeight = rows.length > 4 ? 12 : 14;
  const fan = tr(["SMART", "FULL SPEED", "LOW SPEED", "OFF"][config.settings.fan]);
  return <svg viewBox="0 0 166 90" role="img" aria-label={enlarged ? "Enlarged device display" : "Device display"} className="fc-lcd" data-powered={state.power} data-rotated={Boolean(config.settings.rotate)} style={{ filter: state.power ? `brightness(${0.65 + config.settings.screen * 0.12})` : undefined }}>
    <title>{state.power ? `${menu ? "MENU" : config.mode + " MODE"}, channel ${config.settings.address}` : "Power off"}</title>
    <rect width="166" height="90" fill={state.power ? "#48564a" : "#18221e"} />
    {state.power && <g fill="#e4edc5" fontFamily="'Courier New', monospace">
      <rect width="166" height="14" fill="#83917b" />
      <text x="3" y="10.5" fontSize="9" fill="#f1f5d7">{tr(menu ? "MENU" : `${config.mode} MODE`)}</text>
      <text x="163" y="10.5" fontSize="9" textAnchor="end" fill="#f1f5d7">CH:{String(config.settings.address).padStart(3, "0")}</text>
      {!menu && config.mode === "CCT" ? <>
        <text x="40" y="47" textAnchor="middle" fontSize="20">{state.blackout ? 0 : config.dim}%</text>
        <text x="122" y="47" textAnchor="middle" fontSize="20">{config.cct}K</text>
        <text x="40" y="64" textAnchor="middle" fontSize="11">{tr("DIM")}</text>
        <text x="122" y="64" textAnchor="middle" fontSize="11">{tr("CCT")}</text>
      </> : message ? message.map((line, i) => <text key={i} x="83" y={34 + i * 14} textAnchor="middle" fontSize={line.length > 24 ? 6.5 : 8}>{line}</text>) : rows.map((runs, i) => {
        let x = 3;
        const total = runs.reduce((sum, r) => sum + r.text.length, 0);
        const font = Math.min(8.7, 158 / Math.max(total * 0.61, 1));
        return <g key={i}>{runs.map((r, j) => {
          const width = r.text.length * font * 0.61;
          const left = x; x += width;
          return <g key={j}>{r.selected && <rect x={left - 1} y={17 + i * lineHeight} width={menu && runs.length === 1 ? 162 : width + 2} height={lineHeight - 1} fill="#e4edc5" />}
            <text x={left} y={27 + i * lineHeight} fontSize={font} fill={r.selected ? "#344036" : undefined}>{r.text}</text></g>;
        })}</g>;
      })}
      <rect x="0" y="78" width="166" height="12" fill="#83917b" />
      <text x="3" y="86.5" fontSize="5.8">{foot}</text>
      <text x="163" y="86.5" textAnchor="end" fontSize="7">✤{fan}</text>
    </g>}
  </svg>;
}

export function contextHint(state: State): string {
  if (!state.power) return "Flip the POWER rocker to begin.";
  if (state.menu?.editor) {
    const id = state.menu.editor;
    if (id === "firmware" || id === "version") return "Hardware firmware operations are unavailable. Press MENU to return.";
    if (id === "bluetooth") return "This rehearses the reset confirmation. No Bluetooth devices are connected.";
    if (id === "reset") return "Turn the right knob to YES, then press to reset this simulator's settings.";
    const s = setting(id as SettingId);
    return `${s.label}: turn the right knob to edit; press it to confirm. MENU cancels.${s.remote ? " Navigation practice only; no remote signal is connected." : ""}`;
  }
  if (state.menu) return "Turn the right knob to select. Press to enter; MENU goes back.";
  if (state.config.mode === "CCT") return "Left knob: brightness. Right knob: colour temperature; press for a preset. Press left to blackout / restore.";
  const e = effects[state.config.effect];
  return state.field === 0 ? "Turn left to choose an effect. Turn right to select its parameters." : `Editing ${e.params[state.field - 1].label}. Turn left to change the value.${e.manual ? " Press right to trigger." : ""}`;
}
