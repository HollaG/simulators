import { menu, menuAt, valueText } from './menus';
import type { MixerState } from './types';
import type { Compositor } from './video/compositor';
import type { Levels } from './audio';
import { opacity, progress } from './switching';

const labels = ['IN1', 'IN2', 'IN3', 'IN4', 'PGM', 'MIC1', 'MIC2', 'EAR'];
const chinese: Record<string, string> = {
  MENU: '菜单', Effect: '特效', Audio: '音频', PIP: '画中画', Luma: '亮度键', Chroma: '色度键', DSK: '下游键', PTZ: '云台', Image: '图像', Port: '接口', System: '系统',
  Duration: '转场时间', FTB: '淡出黑场', Softness: '柔化', Source: '来源', Size: '大小', 'Custom size': '自定义大小', Position: '位置', Crop: '裁剪', Border: '边框', 'Border width': '边框宽度',
  'Key source': '键源', 'Fill source': '填充源', Adjustment: '调整', Threshold: '阈值', Gain: '增益', Inverse: '反转', Mask: '遮罩', Width: '宽度', Height: '高度',
  'Position X': '水平位置', 'Position Y': '垂直位置', PickColor: '取色', 'Sample position': '取色位置', Similarity: '相似度', Smoothness: '平滑度',
  Red: '红色', Green: '绿色', Blue: '蓝色', Camera: '摄像机', Search: '搜索', 'IP address': 'IP 地址', Speed: '速度', Focus: '聚焦', 'Auto focus': '自动聚焦', 'Manual focus': '手动聚焦',
  Exposure: '曝光', Shutter: '快门', Aperture: '光圈', 'White balance': '白平衡', 'Auto white balance': '自动白平衡', 'Red gain': '红色增益', 'Blue gain': '蓝色增益',
  Headphones: '耳机', Volume: '音量', 'Mix mode': '混音模式', Delay: '延迟', 'Input mode': '输入模式', 'DIP source': '浸入源', 'E-STOP': '应急图像', Color: '颜色', 'User color': '自定义颜色', 'Logo position': '标志位置',
  Layout: '布局', 'PGM out': '主输出', 'AUX out': '辅助输出', 'LCD output': '液晶输出', 'Frame rate': '帧率', 'Screen flip': '画面翻转',
  Language: '语言', 'OSD time': '菜单时间', Backlight: '屏幕亮度', 'Button brightness': '按键亮度', Network: '网络', 'Subnet mask': '子网掩码', Gateway: '网关', 'Signal status': '信号状态',
  'MEM channel': '记忆通道', 'Save configuration': '保存配置', 'Recall configuration': '调用配置', Version: '版本', 'Reset settings': '重置设置',
  On: '开', Off: '关', Auto: '自动', Manual: '手动', Default: '默认', User: '用户', Line: '线路', Microphone: '麦克风', Landscape: '横屏', 'Portrait 90°': '竖屏 90°', 'Portrait 270°': '竖屏 270°',
};
function meter(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, level: number) {
  ctx.fillStyle = '#15252b'; ctx.fillRect(x, y, width, height);
  for (let i = 0; i < 12; i++) { ctx.fillStyle = i / 12 > level ? '#15252b' : i > 10 ? '#ef6262' : i > 8 ? '#ecd872' : '#4be39f'; ctx.fillRect(x, y + height - (i + 1) * height / 12, width, Math.max(1, height / 12 - 1)); }
}
function tile(ctx: CanvasRenderingContext2D, engine: Compositor, s: MixerState, key: string, x: number, y: number, w: number, h: number, levels: Levels, showLabel = true) {
  engine.copy(ctx, key, x, y, w, h);
  if (!showLabel) return;
  const sourceColor = s.pgm.source === key ? '#ec5f61' : s.pvw.source === key ? '#50d696' : '#34414d';
  ctx.strokeStyle = key === 'PGM' ? '#e75b60' : key === 'PVW' ? '#53d69d' : sourceColor; ctx.lineWidth = 1.8; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = '#07101dc4'; ctx.fillRect(x + w / 2 - 25, y + h - 20, 50, 19); ctx.textAlign = 'center'; ctx.font = 'bold 12px Arial'; ctx.fillStyle = '#ffffff'; ctx.fillText(key, x + w / 2, y + h - 6);
  meter(ctx, x + w - 9, y + h * .5, 4, h * .44, levels[key] ?? 0);
  if (s.params['system.signal'] && key.startsWith('IN')) { ctx.textAlign = 'left'; ctx.font = '10px Arial'; ctx.fillText('1080p60', x + 4, y + 12); }
}

/** LCD and enlarged LCD share this draw function, including menus and status metadata. */
export function drawDisplay(ctx: CanvasRenderingContext2D, engine: Compositor, s: MixerState, now: number, levels: Levels, route = 'LCD') {
  const width = ctx.canvas.width, height = ctx.canvas.height;
  ctx.save(); ctx.scale(width / 640, height / 360); ctx.fillStyle = '#060910'; ctx.fillRect(0, 0, 640, 360);
  if (!s.power) { ctx.restore(); return; }
  const output = route === 'LCD' ? s.mv ? 'MV' : String(s.params['port.lcd']) : route === 'PGM PORT' ? String(s.params['port.pgm']) : route === 'AUX PORT' ? String(s.params['port.aux']) : route;
  if (output !== 'MV') engine.copy(ctx, output, 0, 0, 640, 360);
  else {
    const portrait = s.params['port.layout'] !== 'Landscape';
    if (!portrait) {
      tile(ctx, engine, s, 'PVW', 0, 0, 320, 180, levels); tile(ctx, engine, s, 'PGM', 320, 0, 320, 180, levels);
      ['IN1', 'IN2', 'IN3', 'IN4'].forEach((key, i) => tile(ctx, engine, s, key, i % 2 * 160, 180 + Math.floor(i / 2) * 80, 160, 80, levels));
      drawStatus(ctx, engine, s, 320, 180, 320, 160, now);
    } else {
      const right = s.params['port.layout'] === 'Portrait 270°';
      ['PVW', 'PGM'].forEach((key, i) => {
        ctx.save(); ctx.translate(i * 160 + 80, 145); ctx.rotate(right ? Math.PI / 2 : -Math.PI / 2); engine.copy(ctx, key, -145, -80, 290, 160); ctx.restore();
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 12px Arial'; ctx.fillText(key, i * 160 + 65, 282);
      });
      ['IN1', 'IN2', 'IN3', 'IN4'].forEach((key, i) => tile(ctx, engine, s, key, 320 + i % 2 * 160, Math.floor(i / 2) * 90, 160, 90, levels));
      drawStatus(ctx, engine, s, 320, 180, 320, 160, now);
    }
    ctx.fillStyle = '#151a21'; ctx.fillRect(0, 340, 640, 20); ctx.fillStyle = '#c4cedb'; ctx.textAlign = 'left'; ctx.font = 'italic bold 12px Arial'; ctx.fillText('CineTreak', 9, 354); ctx.textAlign = 'right'; ctx.font = '9px monospace'; ctx.fillText(`${s.params['port.format']}  ·  MIXER PLUS`, 630, 353);
  }
  if (route === 'LCD' && s.menu.open) drawMenu(ctx, s);
  if (route === 'LCD' && s.position === 'pick') {
    engine.copy(ctx, String(s.params['chroma.source']), 0, 0, 640, 360);
    const x = Number(s.params['chroma.pickX']) / 100 * 640, y = Number(s.params['chroma.pickY']) / 100 * 360;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 13, y); ctx.lineTo(x + 13, y); ctx.moveTo(x, y - 13); ctx.lineTo(x, y + 13); ctx.stroke(); ctx.strokeStyle = '#101010'; ctx.strokeRect(x - 5, y - 5, 10, 10);
  }
  if (route === 'LCD' && s.position) { ctx.fillStyle = '#171120eb'; ctx.fillRect(100, 305, 440, 35); ctx.fillStyle = '#d3b6ff'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center'; ctx.fillText(`${s.position.toUpperCase()} POSITION · JOYSTICK TO MOVE · MENU TO EXIT`, 320, 327); }
  if (route === 'LCD' && s.locked) { ctx.fillStyle = '#050910b0'; ctx.fillRect(0, 0, 640, 360); ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.font = 'bold 23px Arial'; ctx.fillText('PANEL LOCKED', 320, 171); ctx.font = '13px Arial'; ctx.fillText('Press lock / power to unlock', 320, 198); }
  if (route === 'LCD') { ctx.fillStyle = `rgba(0,0,0,${1 - Number(s.params['system.backlight']) / 100})`; ctx.fillRect(0, 0, 640, 360); }
  ctx.restore();
}
function drawStatus(c: CanvasRenderingContext2D, engine: Compositor, s: MixerState, x: number, y: number, w: number, h: number, now: number) {
  c.fillStyle = '#101521'; c.fillRect(x, y, w, h);
  labels.forEach((label, i) => {
    const xx = x + i % 4 * w / 4, yy = y + Math.floor(i / 4) * h * .27;
    c.strokeStyle = '#33335b'; c.lineWidth = .8; c.strokeRect(xx, yy, w / 4, h * .27);
    const key = label === 'EAR' ? 'audio.ear.volume' : `audio.${label.toLowerCase()}.volume`;
    c.fillStyle = '#e0e4ef'; c.textAlign = 'center'; c.font = '16px Arial'; c.fillText(`${s.params[key] ?? -6}dB`, xx + w / 8, yy + 23);
    c.fillStyle = '#a5acc1'; c.font = '10px Arial'; c.fillText(label, xx + w / 8, yy + 36);
  });
  const yy = y + h * .54;
  ['CAM', 'LOGO', String(s.params['transition.kind'])].forEach((label, i) => {
    const xx = x + i * w / 3; c.strokeStyle = '#33335b'; c.strokeRect(xx, yy, w / 3, h * .46); c.fillStyle = '#cbd1e0'; c.font = '11px Arial'; c.textAlign = 'center'; c.fillText(label.length > 12 ? label.slice(0, 12) : label, xx + w / 6, yy + 14);
    if (i === 0) { c.fillStyle = s.cam ? '#86edc8' : '#eeeeee'; c.font = 'bold 28px Arial'; c.fillText(String(s.params['ptz.camera']), xx + w / 6, yy + 44); c.font = '9px Arial'; c.fillText(`S:${s.params['ptz.speed']} ${s.pos ? 'PRESET' : ''}`, xx + w / 6, yy + 59); }
    if (i === 1) { const logo = engine.sources.get(String(s.params['logo.slot'])); c.drawImage(logo, xx + 15, yy + 22, w / 3 - 30, 40); }
    if (i === 2) { c.fillStyle = s.transition ? '#a590ff' : '#cdd3e2'; c.font = 'bold 18px Arial'; c.fillText(`${s.params['transition.duration']}s`, xx + w / 6, yy + 42); c.font = '9px Arial'; c.fillText(s.transition ? `${Math.round(progress(s.transition, now) * 100)}%` : opacity(s, now) > .99 ? 'BLACK' : 'READY', xx + w / 6, yy + 59); }
  });
}
function drawMenu(c: CanvasRenderingContext2D, s: MixerState) {
  const tr = (value: string) => s.params['system.language'] === '中文' ? chinese[value] ?? value : value;
  c.fillStyle = '#141414'; c.fillRect(0, 0, 640, 360);
  const items = menuAt(s.menu.path), root = s.menu.path.length ? menu[s.menu.path[0]].label : 'MENU';
  c.fillStyle = '#242027'; c.fillRect(0, 0, 640, 43); c.fillStyle = '#b6a1ff'; c.font = 'bold 17px Arial'; c.textAlign = 'left'; c.fillText(tr(root), 22, 28);
  c.textAlign = 'right'; c.fillStyle = '#8d8798'; c.font = '11px Arial'; c.fillText(s.params['system.language'] === '中文' ? s.menu.editing ? '旋转调整 · 按下确认' : '旋转选择 · 按下进入' : s.menu.editing ? 'ROTATE TO EDIT · PRESS TO CONFIRM' : 'ROTATE TO SELECT · PRESS TO ENTER', 617, 26);
  const start = Math.max(0, s.menu.cursor - 6);
  items.slice(start, start + 8).forEach((item, j) => {
    const index = start + j, y = 48 + j * 34;
    if (index === s.menu.cursor) { c.fillStyle = s.menu.editing ? '#7650c8' : '#6747c0'; c.fillRect(15, y, 610, 31); }
    c.fillStyle = index === s.menu.cursor ? '#ffffff' : '#c4c4c4'; c.textAlign = 'left'; c.font = '17px Arial'; c.fillText(tr(item.label), 25, y + 22);
    c.textAlign = 'right'; c.font = '16px Arial';
    let value = item.param ? valueText(item.param, s.params[item.param]) : item.children ? '›' : '↵';
    if (item.param && s.menu.editing && parametersIsIP(item.param)) value += ` [${s.menu.octet + 1}]`;
    c.fillText(tr(value), 610, y + 22);
  });
  c.fillStyle = '#77717d'; c.textAlign = 'left'; c.font = '11px Arial'; c.fillText(s.params['system.language'] === '中文' ? 'MENU：返回 / 退出' : 'MENU: back / exit', 23, 346); c.textAlign = 'right'; c.fillText(`${s.menu.cursor + 1} / ${items.length}`, 615, 346);
}
function parametersIsIP(id: string) { return /\.(ip|mask|gateway)$/.test(id); }
