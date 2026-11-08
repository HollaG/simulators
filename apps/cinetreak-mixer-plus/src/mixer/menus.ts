export type ParamValue = string | number | boolean;
export interface Parameter {
  label: string;
  type: 'number' | 'enum' | 'toggle' | 'text';
  default: ParamValue;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  unit?: string;
}
export interface MenuItem { label: string; param?: string; children?: MenuItem[]; command?: string }

const number = (label: string, value: number, min: number, max: number, step = 1, unit = ''): Parameter => ({ label, type: 'number', default: value, min, max, step, unit });
const choice = (label: string, value: string, options: string[]): Parameter => ({ label, type: 'enum', default: value, options });
const toggle = (label: string, value = false): Parameter => ({ label, type: 'toggle', default: value });
const inputs = ['IN1', 'IN2', 'IN3', 'IN4'];
export const routes = [...inputs, 'PAT', 'Clean PGM', 'PGM', 'Clean PVW', 'PVW', 'MV'];
export const transitionNames = ['MIX', 'DIP', 'Wipe right', 'Wipe left', 'Wipe down', 'Wipe up', 'Split vertical', 'Split horizontal', 'Box out', 'Box in', 'Diamond', 'Circle', 'Diagonal ↘', 'Diagonal ↙', 'Diagonal ↗', 'Diagonal ↖', 'Four corners', 'Cross', 'Blinds vertical', 'Blinds horizontal', 'Checker', 'Barn vertical', 'Barn horizontal', 'Push right', 'Push left', 'Push down', 'Push up', 'Zoom in', 'Zoom out', 'Clock'];

/** One registry supplies menu labels, defaults and validation; IDs never index arbitrary state paths. */
export const parameters: Record<string, Parameter> = {
  'transition.kind': choice('Effect', 'MIX', transitionNames),
  'transition.duration': number('Duration', .5, .1, 5, .1, 's'),
  'transition.ftb': number('FTB', .5, .1, 5, .1, 's'),
  'transition.softness': number('Softness', 20, 1, 100),
  'transition.dip': choice('DIP source', 'Color', ['Color', ...inputs, 'PAT']),
  'transition.red': number('Red', 0, 0, 255), 'transition.green': number('Green', 0, 0, 255), 'transition.blue': number('Blue', 0, 0, 255),
  'pip.source': choice('Source', 'IN1', [...inputs, 'PAT']),
  'pip.size': choice('Size', '1/3', ['1/8', '1/6', '1/4', '1/3', '1/2', 'Custom']),
  'pip.custom': number('Custom size', 50, 10, 70, 1, '%'),
  'pip.x': number('Position X', 72, 0, 100), 'pip.y': number('Position Y', 70, 0, 100),
  'pip.crop': number('Crop size', 50, 50, 100), 'pip.cropX': number('Crop X', 50, 0, 100), 'pip.cropY': number('Crop Y', 50, 0, 100),
  'pip.border': number('Border width', 2, 2, 16),
  'pip.borderR': number('Red', 255, 0, 255), 'pip.borderG': number('Green', 255, 0, 255), 'pip.borderB': number('Blue', 255, 0, 255),
  'chroma.source': choice('Key source', 'IN1', inputs),
  'chroma.pick': choice('PickColor', 'Default', ['Default', 'PickColor', 'User']),
  'chroma.red': number('Red', 0, 0, 255), 'chroma.green': number('Green', 255, 0, 255), 'chroma.blue': number('Blue', 0, 0, 255),
  'chroma.pickX': number('Sample X', 50, 0, 100), 'chroma.pickY': number('Sample Y', 50, 0, 100),
  'chroma.similarity': number('Similarity', 38, 0, 100), 'chroma.smoothness': number('Smoothness', 20, 0, 100),
  'luma.source': choice('Key source', 'IN1', inputs), 'luma.fill': choice('Fill source', 'IN1', [...inputs, 'PAT']),
  'luma.threshold': number('Threshold', 20, 1, 100), 'luma.gain': number('Gain', 20, 1, 100), 'luma.inverse': toggle('Inverse'),
  'dsk.source': choice('Key source', 'IN1', inputs), 'dsk.threshold': number('Threshold', 20, 1, 100), 'dsk.gain': number('Gain', 20, 1, 100), 'dsk.inverse': toggle('Inverse'),
  'logo.slot': choice('LOGO', 'LOGO1', ['LOGO1', 'LOGO2', 'LOGO3', 'LOGO4']),
  'logo.x': number('Logo X', 80, 0, 100), 'logo.y': number('Logo Y', 12, 0, 100),
  'image.pat': choice('PAT', 'PAT1', ['PAT1', 'PAT2']),
  'image.estop': choice('E-STOP', 'Color bars', ['Color bars', 'Color']),
  'image.color': choice('Color', '#2563eb', ['#ffffff', '#ef4444', '#22c55e', '#2563eb', '#facc15', '#06b6d4', '#a855f7', 'User']),
  'image.red': number('Red', 0, 0, 255), 'image.green': number('Green', 0, 0, 255), 'image.blue': number('Blue', 255, 0, 255),
  'ptz.camera': choice('Camera', '1', ['1', '2', '3', '4']), 'ptz.search': toggle('Search', true),
  'ptz.ip': { label: 'IP address', type: 'text', default: '192.168.1.101' },
  'ptz.speed': number('Speed', 1, 1, 24), 'ptz.af': toggle('Auto focus', true), 'ptz.focus': number('Manual focus', 100, 0, 100),
  'ptz.exposure': choice('Exposure', 'Auto', ['Auto', 'Manual', 'Shutter priority', 'Aperture priority']),
  'ptz.shutter': choice('Shutter', '1/60', ['1/25', '1/50', '1/60', '1/100', '1/250', '1/500', '1/1000']),
  'ptz.aperture': number('Aperture', 4, 1.4, 16, .2), 'ptz.wb': toggle('Auto white balance', true),
  'ptz.red': number('Red gain', 0, 0, 255), 'ptz.blue': number('Blue gain', 0, 0, 255),
  'port.pgm': choice('PGM out', 'PGM', routes), 'port.aux': choice('AUX out', 'MV', routes), 'port.lcd': choice('LCD output', 'PGM', routes),
  'port.layout': choice('Layout', 'Landscape', ['Landscape', 'Portrait 90°', 'Portrait 270°']),
  'port.format': choice('Frame rate', '1080p60', ['1080p24', '1080p25', '1080p30', '1080p48', '1080p50', '1080p60', '1080i60', '1080i50']),
  'system.language': choice('Language', 'English', ['English', '中文']),
  'system.osd': choice('OSD time', '30', ['10', '30', '60']),
  'system.backlight': number('Backlight', 80, 0, 100), 'system.keys': choice('Button brightness', 'High', ['Low', 'Medium', 'High']),
  'system.dhcp': toggle('DHCP', true), 'system.ip': { label: 'IP address', type: 'text', default: '192.168.1.88' },
  'system.mask': { label: 'Subnet mask', type: 'text', default: '255.255.255.0' }, 'system.gateway': { label: 'Gateway', type: 'text', default: '192.168.1.1' },
  'system.signal': toggle('Signal status'), 'system.mem': choice('MEM channel', '1', ['1', '2', '3', '4']),
  'audio.pgm.on': toggle('PGM', true), 'audio.pgm.volume': number('Volume', -6, -60, 0, 1, 'dB'),
  'audio.ear.source': choice('Source', 'PGM', ['PGM', ...inputs, 'MIC1', 'MIC2']), 'audio.ear.volume': number('Volume', 0, -60, 0, 1, 'dB'),
};
for (const key of ['chroma', 'luma', 'dsk']) {
  parameters[`${key}.mask`] = toggle('Mask');
  for (const [axis, label] of [['x', 'Position X'], ['y', 'Position Y'], ['width', 'Width'], ['height', 'Height']])
    parameters[`${key}.${axis}`] = number(label, 50, axis === 'width' || axis === 'height' ? 10 : 0, 100);
}
for (let i = 1; i <= 4; i++) {
  parameters[`audio.in${i}.mode`] = choice('Mix mode', 'AFV', ['Off', 'On', 'AFV']);
  parameters[`audio.in${i}.volume`] = number('Volume', -6, -60, 0, 1, 'dB');
  parameters[`audio.in${i}.delay`] = number('Delay', 0, -30, 500, 10, 'ms');
  parameters[`port.flip${i}`] = choice(`IN${i}`, 'Off', ['Off', 'Horizontal', 'Vertical', 'Both']);
}
for (let i = 1; i <= 2; i++) {
  parameters[`audio.mic${i}.mode`] = choice('Mix mode', 'On', ['Off', 'On']);
  parameters[`audio.mic${i}.volume`] = number('Volume', -6, -60, 0, 1, 'dB');
  parameters[`audio.mic${i}.delay`] = number('Delay', 30, 0, 500, 10, 'ms');
  parameters[`audio.mic${i}.input`] = choice('Input mode', 'Line', ['Line', 'Microphone']);
  parameters[`audio.mic${i}.alc`] = choice('ALC', 'Off', ['Off', '1', '2', '3']);
}
const p = (param: string): MenuItem => ({ label: parameters[param].label, param });
const group = (label: string, ids: string[]): MenuItem => ({ label, children: ids.map(p) });
const command = (label: string, action: string): MenuItem => ({ label, command: action });
const mask = (key: string): MenuItem => ({ label: 'Mask', children: [p(`${key}.mask`), command('Position', `position:${key}`), ...['width', 'height', 'x', 'y'].map(s => p(`${key}.${s}`))] });
export const menu: MenuItem[] = [
  { label: 'Effect', children: [p('transition.kind'), p('transition.duration'), p('transition.ftb'), p('transition.softness'), group('DIP', ['transition.dip', 'transition.red', 'transition.green', 'transition.blue'])] },
  { label: 'Audio', children: [group('PGM', ['audio.pgm.on', 'audio.pgm.volume']), ...Array.from({ length: 4 }, (_, i) => group(`IN${i + 1}`, [`audio.in${i + 1}.mode`, `audio.in${i + 1}.volume`, `audio.in${i + 1}.delay`])), ...Array.from({ length: 2 }, (_, i) => group(`MIC${i + 1}`, ['mode', 'volume', 'delay', 'input', 'alc'].map(s => `audio.mic${i + 1}.${s}`))), group('Headphones', ['audio.ear.source', 'audio.ear.volume'])] },
  { label: 'PIP', children: [p('pip.source'), p('pip.size'), p('pip.custom'), command('Position', 'position:pip'), { label: 'Crop', children: [p('pip.crop'), command('Position', 'position:crop'), p('pip.cropX'), p('pip.cropY')] }, group('Border', ['pip.border', 'pip.borderR', 'pip.borderG', 'pip.borderB'])] },
  { label: 'Luma', children: [p('luma.source'), p('luma.fill'), group('Adjustment', ['luma.threshold', 'luma.gain', 'luma.inverse']), mask('luma')] },
  { label: 'Chroma', children: [p('chroma.source'), { label: 'PickColor', children: [p('chroma.pick'), command('Sample position', 'position:pick'), ...['chroma.red', 'chroma.green', 'chroma.blue'].map(p)] }, p('chroma.similarity'), p('chroma.smoothness'), mask('chroma')] },
  { label: 'DSK', children: [p('dsk.source'), p('dsk.threshold'), p('dsk.gain'), p('dsk.inverse'), mask('dsk')] },
  { label: 'PTZ', children: [p('ptz.camera'), p('ptz.search'), p('ptz.ip'), p('ptz.speed'), group('Focus', ['ptz.af', 'ptz.focus']), group('Exposure', ['ptz.exposure', 'ptz.shutter', 'ptz.aperture']), group('White balance', ['ptz.wb', 'ptz.red', 'ptz.blue'])] },
  { label: 'Image', children: [p('image.estop'), p('image.color'), group('User color', ['image.red', 'image.green', 'image.blue']), p('image.pat'), p('logo.slot'), command('Logo position', 'position:logo')] },
  { label: 'Port', children: [p('port.layout'), p('port.pgm'), p('port.aux'), p('port.lcd'), p('port.format'), group('Screen flip', ['port.flip1', 'port.flip2', 'port.flip3', 'port.flip4'])] },
  { label: 'System', children: [group('System', ['system.language', 'system.osd', 'system.backlight', 'system.keys']), group('Network', ['system.dhcp', 'system.ip', 'system.mask', 'system.gateway']), p('system.signal'), { label: 'MEM', children: [p('system.mem'), command('Save configuration', 'save'), command('Recall configuration', 'recall')] }, command('Version', 'version'), command('Reset settings', 'reset')] },
];
export const defaultParams = () => Object.fromEntries(Object.entries(parameters).map(([id, def]) => [id, def.default]));
export const valueText = (id: string, value: ParamValue) => typeof value === 'boolean' ? value ? 'On' : 'Off' : `${value}${parameters[id]?.unit ? ` ${parameters[id].unit}` : ''}`;
export function menuAt(path: number[]): MenuItem[] {
  let items = menu;
  for (const i of path) items = items[i]?.children ?? items;
  return items;
}
export function validateParam(id: string, value: ParamValue): ParamValue | undefined {
  const def = parameters[id];
  if (!def || typeof value !== typeof def.default) return undefined;
  if (def.type === 'number') return Number.isFinite(value) ? Math.max(def.min!, Math.min(def.max!, Number(value))) : undefined;
  if (def.type === 'enum') return def.options!.includes(String(value)) ? value : undefined;
  if (def.type === 'text' && !/^\d{1,3}(\.\d{1,3}){3}$/.test(String(value))) return undefined;
  if (def.type === 'text' && String(value).split('.').some(x => Number(x) > 255)) return undefined;
  return value;
}
