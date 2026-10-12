// Motore fotografico WebGL2. Non modifica mai l'originale: ogni render parte dalla foto caricata
// e applica la pila di parametri corrente in un'unica passata sulla GPU.
import { VERT, BLUR, MAIN } from './shaders.js';
import { faceFrame } from './face.js';
import { buildMasks } from './masks.js';
import { buildFreckles } from './freckles.js';
import { buildHandles, forwardMap } from './warp.js';

const MASK_MAX = 1600;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function program(gl, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false });
    if (!gl) throw new Error('WebGL2 non disponibile su questo dispositivo');
    this.gl = gl;
    this.floatFB = !!gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    this.main = program(gl, MAIN);
    this.blur = program(gl, BLUR);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    this.tex = {};
    this.freckKey = null;
  }

  texture(name, w, h, fmt, data, filter = 'LINEAR') {
    const gl = this.gl;
    if (this.tex[name]) gl.deleteTexture(this.tex[name]);
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl[filter]);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl[filter]);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const F = {
      rgba8: [gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE],
      r8: [gl.R8, gl.RED, gl.UNSIGNED_BYTE],
      rgba16f: [gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT],
      rgba32f: [gl.RGBA32F, gl.RGBA, gl.FLOAT],
    }[fmt];
    if (data instanceof HTMLCanvasElement || data instanceof HTMLImageElement) gl.texImage2D(gl.TEXTURE_2D, 0, F[0], F[1], F[2], data);
    else gl.texImage2D(gl.TEXTURE_2D, 0, F[0], w, h, 0, F[1], F[2], data || null);
    this.tex[name] = t;
    return t;
  }

  fbo(tex) {
    const gl = this.gl;
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return fb;
  }

  // Sfocatura della sola pelle, a risoluzione ridotta quando il raggio è grande.
  skinBlur(name, sigma) {
    const gl = this.gl;
    const { w, h } = this;
    const scale = Math.max(1, Math.ceil(sigma / 24));
    const bw = Math.max(1, Math.round(w / scale)), bh = Math.max(1, Math.round(h / scale));
    const fmt = this.floatFB ? 'rgba16f' : 'rgba8';
    const tmp = this.texture(name + '_tmp', bw, bh, fmt);
    const out = this.texture(name, bw, bh, fmt);
    const { p, u } = this.blur;
    gl.useProgram(p);
    gl.uniform1f(u.uFlipY, 0);
    gl.uniform1f(u.uSigma, sigma / scale);
    gl.viewport(0, 0, bw, bh);
    const pass = (src, dst, dir, first) => {
      const fb = this.fbo(dst);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src); gl.uniform1i(u.uSrc, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tex.skinHard); gl.uniform1i(u.uMask, 1);
      gl.uniform1i(u.uFirst, first ? 1 : 0);
      gl.uniform2f(u.uDir, dir[0], dir[1]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.deleteFramebuffer(fb);
    };
    pass(this.tex.orig, tmp, [scale / w, 0], true);
    pass(tmp, out, [0, 1 / bh], false);
    gl.deleteTexture(tmp);
    delete this.tex[name + '_tmp'];
  }

  // image: canvas alla risoluzione di lavoro; lm: punti del volto in pixel di image; seg: segmentazione
  setImage(image, lm, seg) {
    const gl = this.gl;
    const w = image.width, h = image.height;
    const max = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    if (w > max || h > max) throw new Error(`Immagine troppo grande per la GPU (${max}px)`);
    this.w = w; this.h = h;
    this.canvas.width = w; this.canvas.height = h;
    this.image = image;
    this.lm = lm;
    this.texture('orig', w, h, 'rgba8', image);
    this.frame = lm ? faceFrame(lm) : null;
    this.freckKey = null;
    if (!this.frame) { this.masks = null; return; }
    // Le maschere sono morbide: bastano al massimo 1600 px (lo shader le campiona in coordinate normalizzate).
    // Così l'esportazione di foto grandi non esaurisce la memoria del telefono.
    const ms = Math.min(1, MASK_MAX / Math.max(w, h));
    const mw = Math.round(w * ms), mh = Math.round(h * ms);
    this.maskScale = ms; this.mw = mw; this.mh = mh;
    const m = buildMasks(faceFrame(lm.map((q) => ({ x: q.x * ms, y: q.y * ms }))), seg, mw, mh);
    this.masks = m;
    this.texture('maskA', mw, mh, 'rgba8', m.maskA.data);
    this.texture('maskB', mw, mh, 'rgba8', m.maskB.data);
    this.texture('shade', mw, mh, 'rgba8', m.shade.data);
    this.texture('glow', mw, mh, 'rgba8', m.glow.data);
    this.texture('maskC', mw, mh, 'rgba8', m.maskC.data);
    this.texture('skinHard', mw, mh, 'rgba8', m.skinHard);
    this.texture('freck', 1, 1, 'r8', new Uint8Array(1));
    const W = this.frame.W;
    this.skinBlur('blur1', Math.max(1, W * 0.006));
    this.skinBlur('blur2', Math.max(2, W * 0.022));
    this.skinMean = this.measureSkin();
  }

  // Colore medio della pelle, usato come riferimento per uniformità e rossori.
  measureSkin() {
    const w = this.mw, h = this.mh;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(this.image, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    const m = this.masks.maskA.data;
    const s = [0, 0, 0];
    let n = 0;
    for (let i = 0; i < w * h; i += 3) {
      if (m[i * 4] < 200) continue;
      s[0] += d[i * 4]; s[1] += d[i * 4 + 1]; s[2] += d[i * 4 + 2]; n++;
    }
    return n ? s.map((v) => v / n / 255) : [0.7, 0.55, 0.45];
  }

  updateFreckles(p) {
    const key = `${p['freckles.amount']}|${p['freckles.size']}|${p['freckles.spread']}`;
    if (key === this.freckKey) return;
    this.freckKey = key;
    // Disegnate alla risoluzione piena (devono restare nitide), con la densità letta dalle maschere.
    const data = buildFreckles(this.masks.glow, this.masks.maskA.data, this.maskScale, this.frame, this.w, this.h, {
      amount: p['freckles.amount'] || 0, size: p['freckles.size'] ?? 0.5, spread: p['freckles.spread'] ?? 0.5,
    });
    this.texture('freck', this.w, this.h, 'r8', data);
  }

  // Disegna il risultato. target: null = canvas visibile, oppure un framebuffer per l'esportazione.
  render(p = {}, { original = false, target = null } = {}) {
    const gl = this.gl;
    const { p: prog, u } = this.main;
    const face = !!this.frame;
    const handles = face ? buildHandles(this.frame, p) : [];
    this.handles = handles;
    if (face && (p['freckles.amount'] || 0) > 0) this.updateFreckles(p);

    const hdata = new Float32Array(Math.max(1, handles.length) * 12);
    handles.forEach((hd, i) => {
      hdata.set([hd.cx, hd.cy, hd.a, hd.b], i * 12);
      hdata.set([hd.cos, hd.sin, 1 / hd.rx, 1 / hd.ry], i * 12 + 4);
      hdata.set([hd.type, 0, 0, 0], i * 12 + 8);
    });
    this.texture('handles', 3, Math.max(1, handles.length), 'rgba32f', hdata, 'NEAREST');

    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(prog);
    gl.uniform1f(u.uFlipY, target ? 0 : 1);
    const units = ['uOrig', 'uBlur1', 'uBlur2', 'uMaskA', 'uMaskB', 'uShade', 'uGlow', 'uFreck', 'uHandles', 'uMaskC'];
    const texs = ['orig', 'blur1', 'blur2', 'maskA', 'maskB', 'shade', 'glow', 'freck', 'handles', 'maskC'];
    units.forEach((name, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, this.tex[texs[i]] || this.tex.orig);
      gl.uniform1i(u[name], i);
    });
    const v = (k) => (face ? p[k] || 0 : 0);
    gl.uniform1i(u.uNH, handles.length);
    gl.uniform2f(u.uRes, this.w, this.h);
    gl.uniform1i(u.uShowOriginal, original ? 1 : 0);
    const f = {
      uTan: 'tan.amount', uTanTone: 'tan.undertone', uSmooth: 'texture.smooth', uEven: 'texture.even',
      uRedness: 'texture.redness', uPores: 'texture.pores', uBright: 'light.brightness', uRadiance: 'light.radiance',
      uTone: 'light.undertone', uFreckInt: 'freckles.intensity',
      uCheekDef: 'cheeks.definition', uCheekVol: 'cheeks.volume', uSculpt: 'cheeks.sculpt', uJawDef: 'jaw.definition',
      uNoseDef: 'nose.contour', uContour: 'face.contour', uLipVol: 'lips.volume', uBrowThick: 'brows.thickness', uPeri: 'eyes.periocular',
      uEyeDef: 'eyes.define', uBrowDef: 'brows.define', uLipDef: 'lips.define',
    };
    for (const [un, key] of Object.entries(f)) gl.uniform1f(u[un], v(key));
    if (!((p['freckles.amount'] || 0) > 0)) gl.uniform1f(u.uFreckInt, 0);
    gl.uniform3fv(u.uSkinMean, this.skinMean || [0.7, 0.55, 0.45]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // Legge il risultato come canvas 2D (per esportazione e test).
  snapshot(p, opts = {}) {
    const gl = this.gl;
    const tex = this.texture('snap', this.w, this.h, 'rgba8');
    const fb = this.fbo(tex);
    this.render(p, { ...opts, target: fb });
    const px = new Uint8Array(this.w * this.h * 4);
    gl.readPixels(0, 0, this.w, this.h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);
    const c = document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(px.buffer), this.w, this.h), 0, 0);
    return c;
  }

  // Punti del volto dopo la deformazione corrente.
  warpedLandmarks() {
    if (!this.lm) return null;
    return this.lm.map((q) => forwardMap(this.handles || [], q));
  }

  dispose() {
    const gl = this.gl;
    Object.values(this.tex).forEach((t) => gl.deleteTexture(t));
    this.tex = {};
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
