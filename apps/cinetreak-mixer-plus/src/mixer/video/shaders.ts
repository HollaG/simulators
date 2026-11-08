export const vertex = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() { v_uv = (a_position + 1.0) * 0.5; gl_Position = vec4(a_position, 0.0, 1.0); }
`;

/** All effects operate on the same source textures; intermediate framebuffers preserve layer order. */
export const fragment = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_a;
uniform sampler2D u_b;
uniform sampler2D u_c;
uniform int u_mode;
uniform int u_pattern;
uniform float u_progress;
uniform float u_softness;
uniform float u_threshold;
uniform float u_gain;
uniform float u_inverse;
uniform float u_maskOn;
uniform vec4 u_mask;
uniform vec4 u_rect;
uniform vec4 u_crop;
uniform vec3 u_color;
uniform vec3 u_borderColor;
uniform float u_border;
uniform float u_opacity;

float reveal(float coordinate, float progress) {
  float soft = max(0.001, u_softness * 0.08);
  return 1.0 - smoothstep(progress - soft, progress + soft, coordinate);
}
void main() {
  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec4 a = texture2D(u_a, v_uv);
  vec4 b = texture2D(u_b, v_uv);
  if (u_mode == 0) { gl_FragColor = vec4(a.rgb * u_opacity, a.a); return; }
  if (u_mode == 4) {
    float t = u_progress;
    if (t <= 0.0) { gl_FragColor = a; return; }
    if (t >= 1.0) { gl_FragColor = b; return; }
    float coord = uv.x;
    if (u_pattern == 0) { gl_FragColor = mix(a,b,t); return; }
    if (u_pattern == 1) { vec4 dip = texture2D(u_c,v_uv); gl_FragColor = t < 0.5 ? mix(a,dip,t*2.0) : mix(dip,b,t*2.0-1.0); return; }
    if (u_pattern == 3) coord = 1.0-uv.x;
    if (u_pattern == 4) coord = uv.y;
    if (u_pattern == 5) coord = 1.0-uv.y;
    if (u_pattern == 6) coord = abs(uv.x-0.5)*2.0;
    if (u_pattern == 7) coord = abs(uv.y-0.5)*2.0;
    if (u_pattern == 21) coord = 1.0-abs(uv.x-0.5)*2.0;
    if (u_pattern == 22) coord = 1.0-abs(uv.y-0.5)*2.0;
    if (u_pattern == 8) coord = max(abs(uv.x-0.5),abs(uv.y-0.5))*2.0;
    if (u_pattern == 9) coord = 1.0-max(abs(uv.x-0.5),abs(uv.y-0.5))*2.0;
    if (u_pattern == 10) coord = abs(uv.x-0.5)+abs(uv.y-0.5);
    if (u_pattern == 11) coord = length((uv-0.5)*vec2(1.0,0.5625))*1.75;
    if (u_pattern == 12) coord = (uv.x+uv.y)*0.5;
    if (u_pattern == 13) coord = (1.0-uv.x+uv.y)*0.5;
    if (u_pattern == 14) coord = (uv.x+1.0-uv.y)*0.5;
    if (u_pattern == 15) coord = 1.0-(uv.x+uv.y)*0.5;
    if (u_pattern == 16) coord = min(min(uv.x,1.0-uv.x),min(uv.y,1.0-uv.y))*2.0;
    if (u_pattern == 17) coord = min(abs(uv.x-0.5),abs(uv.y-0.5))*2.0;
    if (u_pattern == 18) coord = fract(uv.x*8.0);
    if (u_pattern == 19) coord = fract(uv.y*6.0);
    if (u_pattern == 20) coord = (fract(uv.x*6.0)+fract(uv.y*4.0))*0.5;
    if (u_pattern >= 23 && u_pattern <= 26) {
      vec2 direction = u_pattern == 23 ? vec2(1,0) : u_pattern == 24 ? vec2(-1,0) : u_pattern == 25 ? vec2(0,-1) : vec2(0,1);
      vec2 oldUV = v_uv + direction*t;
      vec2 newUV = v_uv - direction*(1.0-t);
      bool inside = oldUV.x>=0.0 && oldUV.x<=1.0 && oldUV.y>=0.0 && oldUV.y<=1.0;
      gl_FragColor = inside ? texture2D(u_a,oldUV) : texture2D(u_b,newUV); return;
    }
    if (u_pattern == 27) {
      vec2 local = (v_uv-0.5)/max(0.001,t)+0.5;
      bool inside = local.x>=0.0 && local.x<=1.0 && local.y>=0.0 && local.y<=1.0;
      gl_FragColor = inside ? texture2D(u_b,local) : a; return;
    }
    if (u_pattern == 28) {
      vec2 local = (v_uv-0.5)/max(0.001,1.0-t)+0.5;
      bool inside = local.x>=0.0 && local.x<=1.0 && local.y>=0.0 && local.y<=1.0;
      gl_FragColor = inside ? texture2D(u_a,local) : b; return;
    }
    if (u_pattern == 29) coord = (atan(uv.y-0.5,uv.x-0.5)+3.141593)/6.283186;
    gl_FragColor = mix(a,b,reveal(coord,t)); return;
  }
  vec2 local = (uv-u_rect.xy)/u_rect.zw;
  if (local.x<0.0 || local.y<0.0 || local.x>1.0 || local.y>1.0) { gl_FragColor = a; return; }
  vec2 cropUV = u_crop.xy + local*u_crop.zw;
  b = texture2D(u_b,vec2(cropUV.x,1.0-cropUV.y));
  float mask = step(u_mask.x,uv.x)*step(u_mask.y,uv.y)*step(uv.x,u_mask.x+u_mask.z)*step(uv.y,u_mask.y+u_mask.w);
  if (u_maskOn<0.5) mask=1.0;
  float alpha=b.a;
  if (u_mode == 2) alpha *= smoothstep(u_threshold,u_threshold+max(0.005,u_gain),distance(b.rgb,u_color)/1.732);
  if (u_mode == 3) {
    float lum=dot(b.rgb,vec3(0.299,0.587,0.114));
    float key=smoothstep(u_threshold,u_threshold+max(0.005,u_gain),lum);
    alpha *= mix(key,1.0-key,u_inverse);
  }
  if (u_mode == 5) {
    float lum=dot(b.rgb,vec3(0.299,0.587,0.114));
    float key=smoothstep(u_threshold,u_threshold+max(0.005,u_gain),lum);
    b = mix(b,texture2D(u_c,v_uv),mix(key,1.0-key,u_inverse)); alpha=1.0;
  }
  float edge=min(min(local.x,1.0-local.x),min(local.y,1.0-local.y));
  if (u_border>0.0 && edge<u_border) { b=vec4(u_borderColor,1); alpha=1.0; }
  gl_FragColor = mix(a,b,alpha*mask);
}
`;
