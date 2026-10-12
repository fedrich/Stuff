// Occhiali, colore capelli, sfondo e filtri.
import {
  makeCanvas, ctx2d, blurCanvas, cloneCanvas, hexToRgb, setLum, lum, clamp, rng, mid, sub,
} from './util.js';

// ---------- Occhiali ----------

export const GLASSES = ['round', 'rect', 'aviator', 'cateye', 'browline'];

function lensPath(ctx, cx, side, style, lw) {
  const P = (x, y, lh) => [cx + side * x * lw, y * lh];
  ctx.beginPath();
  if (style === 'round') {
    ctx.ellipse(cx, 0, lw * 0.5, lw * 0.46, 0, 0, Math.PI * 2);
    return lw * 0.92;
  }
  if (style === 'rect' || style === 'browline') {
    const lh = lw * 0.62, r = lw * 0.12, x = cx - lw / 2, y = -lh / 2;
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + lw, y, x + lw, y + lh, r);
    ctx.arcTo(x + lw, y + lh, x, y + lh, r * 1.6);
    ctx.arcTo(x, y + lh, x, y, r * 1.6);
    ctx.arcTo(x, y, x + lw, y, r);
    ctx.closePath();
    return lh;
  }
  if (style === 'aviator') {
    const lh = lw * 0.85;
    const m = (x, y) => P(x, y, lh);
    ctx.moveTo(...m(-0.5, -0.42));
    ctx.bezierCurveTo(...m(-0.1, -0.5), ...m(0.35, -0.5), ...m(0.5, -0.35));
    ctx.bezierCurveTo(...m(0.6, 0.05), ...m(0.45, 0.5), ...m(0.05, 0.5));
    ctx.bezierCurveTo(...m(-0.35, 0.5), ...m(-0.55, 0.1), ...m(-0.5, -0.42));
    ctx.closePath();
    return lh;
  }
  // cateye
  const lh = lw * 0.72;
  const m = (x, y) => P(x, y, lh);
  ctx.moveTo(...m(-0.5, -0.25));
  ctx.bezierCurveTo(...m(-0.2, -0.45), ...m(0.3, -0.42), ...m(0.6, -0.55));
  ctx.bezierCurveTo(...m(0.56, -0.1), ...m(0.45, 0.45), ...m(0.05, 0.45));
  ctx.bezierCurveTo(...m(-0.35, 0.45), ...m(-0.5, 0.2), ...m(-0.5, -0.25));
  ctx.closePath();
  return lh;
}

export function drawGlasses(canvas, g, style, color, sun) {
  if (!GLASSES.includes(style)) return;
  const ctx = ctx2d(canvas);
  const d = g.eyeDist;
  const o = g.at(mid(g.eyeR, g.eyeL), 0, d * 0.03);
  const lw = d * (style === 'aviator' ? 0.86 : 0.8);
  const thin = style === 'round' || style === 'aviator';
  const t = d * (thin ? 0.02 : 0.04);
  const local = (p) => { const r = sub(p, o); return { x: r.x * g.ux.x + r.y * g.ux.y, y: r.x * g.down.x + r.y * g.down.y }; };
  const earR = local(g.P(234)), earL = local(g.P(454));

  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.rotate(g.angle);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = d * 0.05;
  ctx.shadowOffsetY = d * 0.03;
  ctx.strokeStyle = color;

  // Aste verso le orecchie
  ctx.lineWidth = t * 0.8;
  ctx.globalAlpha = 0.9;
  for (const [ear, side] of [[earR, -1], [earL, 1]]) {
    ctx.beginPath();
    ctx.moveTo(side * (d / 2 + lw / 2) - side * t * 0.3, -lw * 0.18);
    ctx.lineTo(ear.x * 0.98, -lw * 0.1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  let lh = lw;
  for (const side of [-1, 1]) {
    const cx = (side * d) / 2;
    lh = lensPath(ctx, cx, side, style, lw);
    if (sun) {
      const gr = ctx.createLinearGradient(0, -lh / 2, 0, lh / 2);
      gr.addColorStop(0, 'rgba(12,12,18,0.88)');
      gr.addColorStop(1, 'rgba(45,45,58,0.62)');
      ctx.fillStyle = gr;
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
    }
    ctx.save();
    ctx.shadowColor = 'transparent';
    ctx.fill();
    // riflesso
    ctx.clip();
    ctx.fillStyle = sun ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.moveTo(cx - lw * 0.5, -lh * 0.1);
    ctx.lineTo(cx - lw * 0.1, -lh * 0.6);
    ctx.lineTo(cx + lw * 0.05, -lh * 0.6);
    ctx.lineTo(cx - lw * 0.35, lh * 0.1);
    ctx.fill();
    ctx.restore();
    lensPath(ctx, cx, side, style, lw);
    ctx.lineWidth = t;
    ctx.stroke();
    if (style === 'browline') {
      ctx.save();
      ctx.lineWidth = t * 2.6;
      ctx.beginPath();
      ctx.moveTo(cx - lw * 0.46, -lh * 0.47);
      ctx.quadraticCurveTo(cx, -lh * 0.58, cx + lw * 0.46, -lh * 0.47);
      ctx.stroke();
      ctx.restore();
    }
  }
  // Ponte
  ctx.lineWidth = t * 0.9;
  ctx.beginPath();
  const bx = d / 2 - lw / 2;
  ctx.moveTo(-bx - t * 0.2, -lh * 0.22);
  ctx.quadraticCurveTo(0, -lh * 0.42, bx + t * 0.2, -lh * 0.22);
  ctx.stroke();
  if (style === 'aviator') {
    ctx.beginPath();
    ctx.moveTo(-bx - t, -lh * 0.4);
    ctx.lineTo(bx + t, -lh * 0.4);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- Colore (capelli, sopracciglia) ----------

// Ricolora mantenendo la luminosità relativa (la ciocca chiara resta più chiara di quella scura).
export function recolor(canvas, alpha, hex, strength) {
  if (!alpha || strength <= 0) return;
  const w = canvas.width, h = canvas.height;
  const ctx = ctx2d(canvas);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  let sum = 0, wsum = 0;
  for (let i = 0, j = 0; i < alpha.length; i++, j += 4) {
    if (alpha[i] < 128) continue;
    sum += lum(d[j], d[j + 1], d[j + 2]) / 255;
    wsum++;
  }
  if (!wsum) return;
  const avg = Math.max(0.04, sum / wsum);
  const [tr, tg, tb] = hexToRgb(hex).map((v) => v / 255);
  const Lt = lum(tr, tg, tb);
  const out = [0, 0, 0];
  for (let i = 0, j = 0; i < alpha.length; i++, j += 4) {
    if (!alpha[i]) continue;
    const k = (alpha[i] / 255) * strength;
    const L = lum(d[j], d[j + 1], d[j + 2]) / 255;
    const L2 = clamp(Lt * Math.pow(L / avg, 0.6), 0, 1);
    setLum(tr, tg, tb, L2, out);
    d[j] += (out[0] * 255 - d[j]) * k;
    d[j + 1] += (out[1] * 255 - d[j + 1]) * k;
    d[j + 2] += (out[2] * 255 - d[j + 2]) * k;
  }
  ctx.putImageData(img, 0, 0);
}

// ---------- Sfondo ----------

export const BACKGROUNDS = ['none', 'blur', 'bw', 'color', 'sunset', 'ocean', 'studio', 'bokeh'];

function gradientBg(w, h, stops, radial = false) {
  const c = makeCanvas(w, h);
  const ctx = ctx2d(c);
  const gr = radial
    ? ctx.createRadialGradient(w / 2, h * 0.4, 0, w / 2, h * 0.4, Math.max(w, h) * 0.75)
    : ctx.createLinearGradient(0, 0, w * 0.3, h);
  stops.forEach((s, i) => gr.addColorStop(i / (stops.length - 1), s));
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, w, h);
  return c;
}

function bokehBg(w, h) {
  const c = gradientBg(w, h, ['#1b1530', '#2c1a2e', '#0d1b2a']);
  const ctx = ctx2d(c);
  const r = rng(7);
  const cols = ['255,200,120', '255,140,90', '255,230,170', '160,200,255', '255,120,160'];
  for (let i = 0; i < 70; i++) {
    const x = r() * w, y = r() * h, rad = (0.02 + r() * 0.06) * Math.max(w, h);
    const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const col = cols[Math.floor(r() * cols.length)];
    gr.addColorStop(0, `rgba(${col},${0.25 + r() * 0.35})`);
    gr.addColorStop(0.7, `rgba(${col},${0.12 + r() * 0.15})`);
    gr.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = gr;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  return blurCanvas(c, Math.max(w, h) * 0.006);
}

export function applyBackground(canvas, bgMask, bg) {
  if (!bgMask || bg.mode === 'none') return;
  const w = canvas.width, h = canvas.height;
  let layer;
  if (bg.mode === 'blur') {
    const src = cloneCanvas(canvas);
    const sctx = ctx2d(src);
    sctx.globalCompositeOperation = 'destination-in';
    sctx.drawImage(bgMask, 0, 0);
    layer = blurCanvas(src, Math.max(w, h) * 0.004 * (1 + bg.amount * 6));
  } else if (bg.mode === 'bw') {
    layer = cloneCanvas(canvas);
    const lctx = ctx2d(layer);
    const img = lctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let j = 0; j < d.length; j += 4) {
      const l = lum(d[j], d[j + 1], d[j + 2]);
      d[j] = d[j + 1] = d[j + 2] = l;
    }
    lctx.putImageData(img, 0, 0);
  } else if (bg.mode === 'color') {
    layer = makeCanvas(w, h);
    const lctx = ctx2d(layer);
    lctx.fillStyle = bg.color;
    lctx.fillRect(0, 0, w, h);
  } else if (bg.mode === 'sunset') layer = gradientBg(w, h, ['#ff9a5a', '#ff5e7e', '#6a3d9a']);
  else if (bg.mode === 'ocean') layer = gradientBg(w, h, ['#5ee7df', '#2f80ed', '#1b2a6b']);
  else if (bg.mode === 'studio') layer = gradientBg(w, h, ['#d9dce1', '#8e949c', '#3d4249'], true);
  else if (bg.mode === 'bokeh') layer = bokehBg(w, h);
  if (!layer) return;
  const lctx = ctx2d(layer);
  lctx.globalCompositeOperation = 'destination-in';
  lctx.drawImage(bgMask, 0, 0);
  const ctx = ctx2d(canvas);
  ctx.save();
  ctx.globalAlpha = bg.mode === 'blur' ? 1 : clamp(0.35 + bg.amount, 0, 1);
  ctx.drawImage(layer, 0, 0);
  if (bg.mode === 'blur') ctx.drawImage(layer, 0, 0);
  ctx.restore();
}

// ---------- Filtri e regolazioni ----------

export const FILTERS = {
  none: {},
  vivid: { contrast: 0.15, saturation: 0.35 },
  warm: { warmth: 0.35, saturation: 0.05 },
  cool: { warmth: -0.35 },
  vintage: { warmth: 0.3, saturation: -0.3, fade: 0.35, vignette: 0.45, grain: 0.15 },
  film: { fade: 0.25, grain: 0.3, warmth: 0.1, saturation: -0.12, contrast: 0.08 },
  drama: { contrast: 0.4, saturation: -0.15, vignette: 0.55 },
  golden: { warmth: 0.45, brightness: 0.05, saturation: 0.12 },
  pastel: { fade: 0.4, saturation: -0.25, brightness: 0.08 },
  bw: { saturation: -1, contrast: 0.15 },
  noir: { saturation: -1, contrast: 0.5, vignette: 0.6, grain: 0.2 },
  sepia: { sepia: 1, contrast: 0.05, vignette: 0.3 },
};

export function applyFilters(canvas, f) {
  const preset = FILTERS[f.name] || {};
  const v = (k) => (preset[k] || 0) * f.intensity + (f[k] || 0);
  const br = v('brightness'), co = v('contrast'), sa = v('saturation'), wa = v('warmth');
  const fa = v('fade'), vi = v('vignette'), gr = v('grain'), se = clamp(v('sepia'), 0, 1);
  if (!br && !co && !sa && !wa && !fa && !vi && !gr && !se) return;
  const w = canvas.width, h = canvas.height;
  const ctx = ctx2d(canvas);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const lut = [new Uint8ClampedArray(256), new Uint8ClampedArray(256), new Uint8ClampedArray(256)];
  for (let i = 0; i < 256; i++) {
    let x = i / 255 + br * 0.5;
    x = (x - 0.5) * (1 + co) + 0.5;
    x = fa * 0.22 + x * (1 - fa * 0.3);
    lut[0][i] = (x + wa * 0.07) * 255;
    lut[1][i] = (x + wa * 0.015) * 255;
    lut[2][i] = (x - wa * 0.08) * 255;
  }
  const cx = w / 2, cy = h / 2, maxD = Math.hypot(cx, cy);
  const rand = rng(1234);
  const s1 = 1 + sa;
  for (let y = 0, j = 0; y < h; y++) {
    for (let x = 0; x < w; x++, j += 4) {
      let r = lut[0][d[j]], g = lut[1][d[j + 1]], b = lut[2][d[j + 2]];
      if (sa) {
        const l = lum(r, g, b);
        r = l + (r - l) * s1; g = l + (g - l) * s1; b = l + (b - l) * s1;
      }
      if (se) {
        const sr = 0.393 * r + 0.769 * g + 0.189 * b, sg = 0.349 * r + 0.686 * g + 0.168 * b, sb = 0.272 * r + 0.534 * g + 0.131 * b;
        r += (sr - r) * se; g += (sg - g) * se; b += (sb - b) * se;
      }
      if (vi) {
        const t = clamp((Math.hypot(x - cx, y - cy) / maxD - 0.35) / 0.65, 0, 1);
        const k = 1 - vi * t * t * 0.85;
        r *= k; g *= k; b *= k;
      }
      if (gr) {
        const n = (rand() - 0.5) * gr * 45;
        r += n; g += n; b += n;
      }
      d[j] = r; d[j + 1] = g; d[j + 2] = b;
    }
  }
  ctx.putImageData(img, 0, 0);
}
