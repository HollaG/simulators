import { transitionNames } from '../menus';
import { opacity, progress } from '../switching';
import type { BusScene, MixerState } from '../types';
import { canvas, H, Sources, W } from './sources';
import { fragment, vertex } from './shaders';

type Texture = { texture: WebGLTexture; framebuffer?: WebGLFramebuffer };
type Pass = { mode?: number; pattern?: number; progress?: number; softness?: number; threshold?: number; gain?: number; inverse?: number; maskOn?: number; mask?: number[]; rect?: number[]; crop?: number[]; color?: number[]; borderColor?: number[]; border?: number; opacity?: number };
export const atlasKeys = ['IN1', 'IN2', 'IN3', 'IN4', 'PGM', 'PVW', 'Clean PGM', 'Clean PVW', 'PAT', 'E-STOP'];
const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);

/** One GPU context builds all live outputs. Display canvases only copy atlas rectangles. */
export class Compositor {
  onRestore?: () => void;
  readonly surface = canvas(W * 3, H * 4);
  readonly sources = new Sources();
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private textures = new Map<string, Texture>();
  private locations = new Map<string, WebGLUniformLocation | null>();
  private freezeId: number | null = null;
  private lost = false;
  constructor() {
    const gl = this.surface.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL is unavailable. Enable hardware acceleration in your browser.');
    this.gl = gl;
    this.program = this.setup();
    this.surface.addEventListener('webglcontextlost', event => { event.preventDefault(); this.lost = true; });
    this.surface.addEventListener('webglcontextrestored', () => { this.textures.clear(); this.locations.clear(); this.program = this.setup(); this.freezeId = null; this.lost = false; this.onRestore?.(); });
  }
  private setup() {
    const gl = this.gl;
    const compile = (kind: number, source: string) => {
      const shader = gl.createShader(kind)!; gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Shader compilation failed');
      return shader;
    };
    const program = gl.createProgram()!, vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
    gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Video program failed');
    gl.deleteShader(vs); gl.deleteShader(fs); gl.useProgram(program);
    const buffer = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const attribute = gl.getAttribLocation(program, 'a_position'); gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    return program;
  }
  private location(name: string) {
    if (!this.locations.has(name)) this.locations.set(name, this.gl.getUniformLocation(this.program, name));
    return this.locations.get(name)!;
  }
  private texture(id: string, target = false): Texture {
    const gl = this.gl;
    if (!this.textures.has(id)) {
      const texture = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      this.textures.set(id, { texture });
    }
    const item = this.textures.get(id)!;
    if (target && !item.framebuffer) {
      item.framebuffer = gl.createFramebuffer()!; gl.bindFramebuffer(gl.FRAMEBUFFER, item.framebuffer); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, item.texture, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Video framebuffer is incomplete');
    }
    return item;
  }
  private pass(target: string | null, a: Texture, b = a, c = a, settings: Pass = {}, viewport?: number[]): Texture {
    const gl = this.gl, output = target ? this.texture(target, true) : undefined;
    gl.bindFramebuffer(gl.FRAMEBUFFER, output?.framebuffer ?? null);
    gl.viewport(...(viewport ?? [0, 0, W, H]) as [number, number, number, number]);
    [a, b, c].forEach((texture, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, texture.texture); gl.uniform1i(this.location(`u_${'abc'[i]}`), i); });
    gl.uniform1i(this.location('u_mode'), settings.mode ?? 0); gl.uniform1i(this.location('u_pattern'), settings.pattern ?? 0);
    const scalars = { progress: 0, softness: .2, threshold: .2, gain: .2, inverse: 0, maskOn: 0, border: 0, opacity: 1 };
    for (const [key, value] of Object.entries(scalars)) gl.uniform1f(this.location(`u_${key}`), (settings as any)[key] ?? value);
    gl.uniform4fv(this.location('u_rect'), settings.rect ?? [0, 0, 1, 1]); gl.uniform4fv(this.location('u_crop'), settings.crop ?? [0, 0, 1, 1]); gl.uniform4fv(this.location('u_mask'), settings.mask ?? [0, 0, 1, 1]);
    gl.uniform3fv(this.location('u_color'), settings.color ?? [0, 1, 0]); gl.uniform3fv(this.location('u_borderColor'), settings.borderColor ?? [1, 1, 1]);
    gl.drawArrays(gl.TRIANGLES, 0, 6); return output ?? a;
  }
  /** Update shared input textures, compose both buses, then present every requested image in one atlas. */
  render(state: MixerState, now: number) {
    if (this.lost) return;
    const s = state, gl = this.gl, n = (id: string) => Number(s.params[id]), str = (id: string) => String(s.params[id]);
    this.sources.update(s, now / 1000);
    const sourceTextures = new Map<string, Texture>();
    for (const [key, frame] of this.sources.frames) {
      const texture = this.texture(`source:${key}`); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture.texture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame); sourceTextures.set(key, texture);
    }
    if (s.freeze) {
      if (this.freezeId !== s.freeze.id) { this.pass('freeze', sourceTextures.get(s.freeze.source)!); this.freezeId = s.freeze.id; }
      sourceTextures.set(s.freeze.source, this.texture('freeze', true));
    } else this.freezeId = null;
    const source = (key: string): Texture => sourceTextures.get(key === 'PAT' ? str('image.pat') : key) ?? sourceTextures.get('IN1')!;
    let keyColor = [0, 1, 0];
    if (s.params['chroma.pick'] === 'User') keyColor = ['red', 'green', 'blue'].map(key => n(`chroma.${key}`) / 255);
    if (s.params['chroma.pick'] === 'PickColor') {
      const context = this.sources.get(str('chroma.source')).getContext('2d')!;
      const pixel = context.getImageData(Math.min(W - 1, n('chroma.pickX') / 100 * W), Math.min(H - 1, n('chroma.pickY') / 100 * H), 1, 1).data;
      keyColor = [pixel[0], pixel[1], pixel[2]].map(v => v / 255);
    }
    const maskSettings = (key: string): Pass => ({ maskOn: s.params[`${key}.mask`] ? 1 : 0, mask: [(n(`${key}.x`) - n(`${key}.width`) / 2) / 100, (n(`${key}.y`) - n(`${key}.height`) / 2) / 100, n(`${key}.width`) / 100, n(`${key}.height`) / 100] });
    const upstream = (scene: BusScene, bus: string) => {
      let frame = source(scene.source);
      if (scene.chroma) frame = this.pass(`${bus}:chroma`, frame, source(str('chroma.source')), frame, { mode: 2, threshold: n('chroma.similarity') / 100, gain: n('chroma.smoothness') / 200, color: keyColor, ...maskSettings('chroma') });
      if (scene.luma) frame = this.pass(`${bus}:luma`, frame, source(str('luma.source')), source(str('luma.fill')), { mode: 5, threshold: n('luma.threshold') / 100, gain: n('luma.gain') / 100, inverse: s.params['luma.inverse'] ? 1 : 0, ...maskSettings('luma') });
      if (scene.pip) {
        const size = str('pip.size') === 'Custom' ? n('pip.custom') / 100 : 1 / Number(str('pip.size').split('/')[1]);
        const x = n('pip.x') / 100 * (1 - size), y = n('pip.y') / 100 * (1 - size), crop = n('pip.crop') / 100;
        frame = this.pass(`${bus}:pip`, frame, source(str('pip.source')), frame, { mode: 1, rect: [x, y, size, size], crop: [n('pip.cropX') / 100 * (1 - crop), n('pip.cropY') / 100 * (1 - crop), crop, crop], border: n('pip.border') / (W * size), borderColor: ['R', 'G', 'B'].map(k => n(`pip.border${k}`) / 255) });
      }
      return frame;
    };
    const pgmScene = s.transition?.from ?? s.pgm, pvwScene = s.transition?.to ?? s.pvw;
    let pgm = upstream(pgmScene, 'pgm'), pvw = upstream(pvwScene, 'pvw');
    let cleanPgm = source(pgmScene.source);
    if (s.transition) {
      const op = s.transition;
      let dip = source(op.dip);
      if (op.dip === 'Color') {
        const ctx = this.sources.get('dip').getContext('2d')!; ctx.fillStyle = op.color; ctx.fillRect(0, 0, W, H);
        dip = this.texture('dip'); gl.bindTexture(gl.TEXTURE_2D, dip.texture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.sources.get('dip'));
      }
      const pass = { mode: 4, pattern: transitionNames.indexOf(op.kind), progress: progress(op, now), softness: op.softness / 100 };
      pgm = this.pass('transition', pgm, pvw, dip, pass); cleanPgm = this.pass('cleanTransition', source(pgmScene.source), source(pvwScene.source), dip, pass);
    }
    const downstream = (frame: Texture, bus: 'pgm' | 'pvw') => {
      if (s.downstream[bus].dsk) frame = this.pass(`${bus}:dsk`, frame, source(str('dsk.source')), frame, { mode: 3, threshold: n('dsk.threshold') / 100, gain: n('dsk.gain') / 100, inverse: s.params['dsk.inverse'] ? 1 : 0, ...maskSettings('dsk') });
      if (s.downstream[bus].logo && !this.sources.missing.has(str('logo.slot'))) frame = this.pass(`${bus}:logo`, frame, source(str('logo.slot')), frame, { mode: 1, rect: [n('logo.x') / 100 * .7, n('logo.y') / 100 * .7, .3, .3] });
      return frame;
    };
    pgm = downstream(pgm, 'pgm'); pvw = downstream(pvw, 'pvw');
    pgm = this.pass('final', pgm, pgm, pgm, { opacity: s.power ? 1 - opacity(s, now) : 0 });
    const frames: Record<string, Texture> = { IN1: source('IN1'), IN2: source('IN2'), IN3: source('IN3'), IN4: source('IN4'), PGM: pgm, PVW: pvw, 'Clean PGM': cleanPgm, 'Clean PVW': source(pvwScene.source), PAT: source('PAT'), 'E-STOP': source('E-STOP') };
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    atlasKeys.forEach((key, index) => this.pass(null, frames[key], undefined, undefined, {}, [index % 3 * W, this.surface.height - (Math.floor(index / 3) + 1) * H, W, H]));
  }
  copy(ctx: CanvasRenderingContext2D, key: string, x = 0, y = 0, width = ctx.canvas.width, height = ctx.canvas.height) {
    const index = Math.max(0, atlasKeys.indexOf(key));
    // Inset half a texel so Canvas2D interpolation never borrows a neighbouring atlas tile's edge.
    ctx.drawImage(this.surface, index % 3 * W + .5, Math.floor(index / 3) * H + .5, W - 1, H - 1, x, y, width, height);
  }
  dispose() {
    this.sources.dispose();
    for (const item of this.textures.values()) { this.gl.deleteTexture(item.texture); if (item.framebuffer) this.gl.deleteFramebuffer(item.framebuffer); }
    this.gl.deleteProgram(this.program);
  }
}
