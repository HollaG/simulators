import type { MixerState } from '../types';
import type { MediaAsset } from '../persistence';

export const W = 640, H = 360;
export const canvas = (width = W, height = H) => Object.assign(document.createElement('canvas'), { width, height });
type Imported = { asset: MediaAsset; element: HTMLImageElement | HTMLVideoElement | HTMLAudioElement; url: string };
const colors = ['#f4f4f5', '#facc15', '#06b6d4', '#22c55e', '#e879f9', '#ef4444', '#2563eb'];

export class Sources {
  frames = new Map<string, HTMLCanvasElement>();
  imported = new Map<string, Imported>();
  missing = new Set<string>();
  get(id: string) { if (!this.frames.has(id)) this.frames.set(id, canvas()); return this.frames.get(id)!; }
  async add(asset: MediaAsset) {
    if (this.imported.has(asset.id)) return;
    const url = URL.createObjectURL(asset.blob);
    const element = document.createElement(asset.type.startsWith('video') ? 'video' : asset.type.startsWith('audio') ? 'audio' : 'img');
    if (element instanceof HTMLMediaElement) { element.loop = true; element.preload = 'auto'; element.crossOrigin = 'anonymous'; }
    if (element instanceof HTMLVideoElement) { element.playsInline = true; element.muted = true; }
    try {
      await new Promise<void>((resolve, reject) => {
        element.addEventListener(element instanceof HTMLImageElement ? 'load' : 'loadeddata', () => resolve(), { once: true });
        element.addEventListener('error', () => reject(new Error(`Cannot decode ${asset.name}`)), { once: true });
        element.src = url;
      });
      this.imported.set(asset.id, { asset, element, url });
    } catch (error) { URL.revokeObjectURL(url); throw error; }
  }
  start() { for (const { element } of this.imported.values()) if (element instanceof HTMLMediaElement) void element.play().catch(() => {}); }
  stop() { for (const { element } of this.imported.values()) if (element instanceof HTMLMediaElement) element.pause(); }
  dispose() { this.stop(); for (const { url } of this.imported.values()) URL.revokeObjectURL(url); }

  /** Draw each input once per timestamp. All output paths then sample these same frames. */
  update(s: MixerState, seconds: number) {
    this.missing.clear();
    for (let i = 1; i <= 4; i++) {
      const output = this.get(`IN${i}`), ctx = output.getContext('2d')!;
      ctx.save(); ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#090d16'; ctx.fillRect(0, 0, W, H);
      const flip = String(s.params[`port.flip${i}`]);
      ctx.translate(flip === 'Horizontal' || flip === 'Both' ? W : 0, flip === 'Vertical' || flip === 'Both' ? H : 0);
      ctx.scale(flip === 'Horizontal' || flip === 'Both' ? -1 : 1, flip === 'Vertical' || flip === 'Both' ? -1 : 1);
      const camera = s.cameras[i - 1];
      ctx.translate(W / 2, H / 2); ctx.scale(camera.zoom, camera.zoom); ctx.translate(-W / 2 - (camera.x - 50) * 2.3, -H / 2 - (camera.y - 50) * 1.3);
      if (Number(s.params['ptz.camera']) === i) {
        const blur = s.params['ptz.af'] ? 0 : (100 - Number(s.params['ptz.focus'])) / 18;
        const exposure = s.params['ptz.exposure'];
        const shutter = Number(String(s.params['ptz.shutter']).split('/')[1]);
        const brightness = exposure === 'Auto' ? 1 : (exposure === 'Shutter priority' ? 1 : Math.pow(4 / Number(s.params['ptz.aperture']), .7)) * (exposure === 'Aperture priority' ? 1 : Math.pow(60 / shutter, .25));
        ctx.filter = `blur(${blur}px) brightness(${brightness})`;
      }
      if (!this.drawImported(ctx, s.assets[`IN${i}`], `IN${i}`)) this.drawScene(ctx, i, seconds);
      if (Number(s.params['ptz.camera']) === i && !s.params['ptz.wb']) {
        ctx.filter = 'none'; ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = `rgb(${255 - Number(s.params['ptz.blue']) * .35},${255 - (Number(s.params['ptz.red']) + Number(s.params['ptz.blue'])) * .15},${255 - Number(s.params['ptz.red']) * .35})`;
        ctx.fillRect(-500, -300, 1600, 1000);
      }
      ctx.restore();
    }
    for (const slot of ['PAT1', 'PAT2']) {
      const c = this.get(slot).getContext('2d')!; c.clearRect(0, 0, W, H);
      if (!this.drawImported(c, s.assets[slot], slot)) {
        const gradient = c.createLinearGradient(0, 0, W, H); gradient.addColorStop(0, slot === 'PAT1' ? '#162960' : '#082b24'); gradient.addColorStop(1, '#070c19'); c.fillStyle = gradient; c.fillRect(0, 0, W, H);
        c.strokeStyle = '#ffffff14'; for (let x = -W; x < W * 2; x += 44) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 250, H); c.stroke(); }
        c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.font = 'bold 38px sans-serif'; c.fillText(slot === 'PAT1' ? 'WE WILL BE RIGHT BACK' : 'THANK YOU FOR JOINING', W / 2, 170); c.font = '16px sans-serif'; c.fillStyle = '#a6b9d8'; c.fillText('MIXER PLUS  /  LIVE PRODUCTION', W / 2, 205);
      }
    }
    const e = this.get('E-STOP').getContext('2d')!;
    if (s.params['image.estop'] === 'Color bars') colors.forEach((color, i) => { e.fillStyle = color; e.fillRect(i * W / 7, 0, W / 7 + 1, H); });
    else { e.fillStyle = s.params['image.color'] === 'User' ? `rgb(${s.params['image.red']},${s.params['image.green']},${s.params['image.blue']})` : String(s.params['image.color']); e.fillRect(0, 0, W, H); }
    for (let i = 1; i <= 4; i++) {
      const slot = `LOGO${i}`, ctx = this.get(slot).getContext('2d')!; ctx.clearRect(0, 0, W, H);
      if (!this.drawImported(ctx, s.assets[slot], slot)) {
        ctx.fillStyle = ['#61e3b2', '#ffffff', '#f5bd67', '#8eacf7'][i - 1]; ctx.fillRect(0, 0, 420, 150);
        ctx.fillStyle = '#111820'; ctx.font = '900 70px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(['LIVE', 'ON AIR', 'STUDIO', 'MIXER+'][i - 1], 30, 99);
      }
    }
  }
  private drawImported(ctx: CanvasRenderingContext2D, id: string | undefined, slot: string): boolean {
    if (!id) return false;
    const media = this.imported.get(id);
    if (!media) {
      this.missing.add(slot); ctx.fillStyle = '#171b25'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#f5bd67'; ctx.font = '24px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`${slot} · MEDIA MISSING`, W / 2, H / 2); return true;
    }
    if (media.element instanceof HTMLAudioElement) return false;
    if (media.element instanceof HTMLVideoElement && media.element.readyState < 2) return true;
    const element = media.element;
    const width = element instanceof HTMLImageElement ? element.naturalWidth : element.videoWidth;
    const height = element instanceof HTMLImageElement ? element.naturalHeight : element.videoHeight;
    const scale = Math.min(W / width, H / height);
    ctx.drawImage(element, (W - width * scale) / 2, (H - height * scale) / 2, width * scale, height * scale);
    return true;
  }
  private drawScene(c: CanvasRenderingContext2D, input: number, time: number) {
    c.textAlign = 'left';
    if (input === 1) {
      const bg = c.createLinearGradient(0, -200, 0, 500); bg.addColorStop(0, '#07142b'); bg.addColorStop(1, '#191128'); c.fillStyle = bg; c.fillRect(-500, -300, 1600, 1000);
      for (let i = 0; i < 6; i++) {
        const x = i * 145 - 50, end = x + Math.sin(time * .45 + i) * 130;
        c.fillStyle = ['#306cff36', '#c947ff36', '#32ded036'][i % 3]; c.beginPath(); c.moveTo(x, 20); c.lineTo(end - 110, 330); c.lineTo(end + 110, 330); c.closePath(); c.fill();
        c.fillStyle = ['#5790ff', '#c580fa', '#50d8d1'][i % 3]; c.fillRect(x - 5, 10, 10, 6);
      }
      c.fillStyle = '#242c4c'; c.fillRect(-500, 260, 1600, 140);
      for (let i = 0; i < 5; i++) this.person(c, 70 + i * 125, 215 + Math.sin(time + i) * 3, .65, '#101626');
      c.fillStyle = '#000000'; for (let i = 0; i < 30; i++) { c.beginPath(); c.arc(i * 25 - 40, 340 + Math.sin(i * 2) * 15, 17, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#e6e7f4'; c.font = '900 35px sans-serif'; c.fillText('THE EVENING SESSION', 112, 116); c.fillStyle = '#c2b4f5'; c.font = '13px sans-serif'; c.fillText('L I V E   A T   S T U D I O   0 1', 196, 143);
    } else if (input === 2) {
      c.fillStyle = '#1b3141'; c.fillRect(-500, -300, 1600, 1000);
      for (let i = -3; i < 12; i++) { c.fillStyle = i % 2 ? '#203c4f' : '#173344'; c.fillRect(i * 90, -100, 40, 700); }
      c.fillStyle = '#45617a'; c.fillRect(430, 62, 140, 83); c.fillStyle = '#7ca7c8'; c.font = 'bold 18px sans-serif'; c.fillText('STUDIO / 02', 444, 112);
      this.person(c, 300 + Math.sin(time * .3) * 12, 190, 1.5, '#263d52');
      c.fillStyle = '#0d1c29'; c.fillRect(100, 312, 440, 120); c.fillStyle = '#a0bad0'; c.fillRect(240, 250, 110, 65);
    } else if (input === 3) {
      c.fillStyle = '#000000'; c.fillRect(-500, -300, 1600, 1000);
      c.fillStyle = '#ffffff'; c.fillRect(42, 244, 8, 76); c.font = 'bold 36px sans-serif'; c.fillText('JAMIE PARK', 70, 278); c.font = '18px sans-serif'; c.fillText('Live production workshop', 72, 308);
      c.fillStyle = '#ffffff'; c.font = 'bold 16px sans-serif'; c.fillText('MIXER PLUS  /  TITLE SOURCE', 43, 50);
      c.fillStyle = '#555555'; c.fillRect(520, 270, 35 + Math.sin(time) * 15, 6);
    } else {
      c.fillStyle = '#00ff00'; c.fillRect(-500, -300, 1600, 1000);
      this.person(c, 320 + Math.sin(time * .6) * 23, 200, 1.2, '#1b2a4b');
    }
    c.fillStyle = '#07101dce'; c.fillRect(12, 12, 126, 28); c.fillStyle = '#d5e1ee'; c.font = 'bold 12px monospace'; c.fillText(`CAM ${input}  ${new Date(time * 1000).toISOString().slice(11, 19)}`, 20, 31);
  }
  private person(c: CanvasRenderingContext2D, x: number, y: number, scale: number, shirt: string) {
    c.save(); c.translate(x, y); c.scale(scale, scale);
    c.fillStyle = shirt; c.beginPath(); c.ellipse(0, 65, 43, 73, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#c99f85'; c.fillRect(-10, -3, 20, 28); c.beginPath(); c.ellipse(0, -27, 26, 34, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#222028'; c.beginPath(); c.ellipse(-3, -48, 27, 19, -.1, Math.PI, Math.PI * 2); c.fill();
    c.fillStyle = '#342a29'; c.fillRect(-13, -30, 5, 3); c.fillRect(9, -30, 5, 3); c.fillRect(-7, -12, 14, 2); c.restore();
  }
}
