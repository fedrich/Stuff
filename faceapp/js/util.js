// Utility condivise: geometria, canvas, sfocature e colori.

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a, k) => ({ x: a.x * k, y: a.y * k });
export const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export const lerpPt = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const rotate = (v, ang) => ({
  x: v.x * Math.cos(ang) - v.y * Math.sin(ang),
  y: v.x * Math.sin(ang) + v.y * Math.cos(ang),
});

// Generatore pseudo-casuale con seme: i dettagli disegnati restano stabili tra un render e l'altro.
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function ctx2d(c) {
  return c.getContext('2d', { willReadFrequently: true });
}

export function cloneCanvas(src) {
  const c = makeCanvas(src.width, src.height);
  ctx2d(c).drawImage(src, 0, 0);
  return c;
}

export function alphaOf(canvas) {
  const d = ctx2d(canvas).getImageData(0, 0, canvas.width, canvas.height).data;
  const a = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0, j = 3; i < a.length; i++, j += 4) a[i] = d[j];
  return a;
}

// ---- Percorsi ----

export function polyPath(ctx, pts, close = true) {
  if (!pts.length) return;
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  if (close) ctx.closePath();
}

// Curva morbida che passa per i punti medi (quadratiche).
export function smoothPath(ctx, pts, close = true) {
  const n = pts.length;
  if (n < 3) return polyPath(ctx, pts, close);
  if (close) {
    const m0 = mid(pts[n - 1], pts[0]);
    ctx.moveTo(m0.x, m0.y);
    for (let i = 0; i < n; i++) {
      const p = pts[i], m = mid(p, pts[(i + 1) % n]);
      ctx.quadraticCurveTo(p.x, p.y, m.x, m.y);
    }
    ctx.closePath();
  } else {
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < n - 1; i++) {
      const m = mid(pts[i], pts[i + 1]);
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y);
    }
    ctx.lineTo(pts[n - 1].x, pts[n - 1].y);
  }
}

export function quadPts(a, ctrl, b, n = 10) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push({ x: u * u * a.x + 2 * u * t * ctrl.x + t * t * b.x, y: u * u * a.y + 2 * u * t * ctrl.y + t * t * b.y });
  }
  return out;
}

// ---- Sfocatura ----

let filterSupport = null;
export function canFilter() {
  if (filterSupport === null) {
    const c = makeCanvas(2, 2).getContext('2d');
    try {
      c.filter = 'blur(2px)';
      filterSupport = c.filter === 'blur(2px)';
    } catch {
      filterSupport = false;
    }
  }
  return filterSupport;
}

// Sfocatura gaussiana (raggio = deviazione standard in px). Restituisce una nuova canvas.
// Le aree trasparenti non "sporcano" il colore: la media è pesata dall'alpha.
export function blurCanvas(src, r) {
  const w = src.width, h = src.height;
  const out = makeCanvas(w, h);
  const ctx = ctx2d(out);
  if (r < 0.5) {
    ctx.drawImage(src, 0, 0);
    return out;
  }
  if (canFilter()) {
    ctx.filter = `blur(${r.toFixed(2)}px)`;
    ctx.drawImage(src, 0, 0);
    ctx.filter = 'none';
    return out;
  }
  // Fallback JS (es. Safari): riduzione + 3 passate di box blur su colori premoltiplicati.
  const scale = Math.max(1, r / 3);
  const sw = Math.max(1, Math.round(w / scale)), sh = Math.max(1, Math.round(h / scale));
  const small = makeCanvas(sw, sh);
  const sctx = ctx2d(small);
  sctx.drawImage(src, 0, 0, sw, sh);
  const img = sctx.getImageData(0, 0, sw, sh);
  boxBlurPremul(img.data, sw, sh, Math.max(1, Math.round(r / scale)));
  sctx.putImageData(img, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small, 0, 0, w, h);
  return out;
}

function boxBlurPremul(d, w, h, r) {
  const n = w * h;
  const f = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const a = d[i * 4 + 3] / 255;
    f[i * 4] = d[i * 4] * a;
    f[i * 4 + 1] = d[i * 4 + 1] * a;
    f[i * 4 + 2] = d[i * 4 + 2] * a;
    f[i * 4 + 3] = d[i * 4 + 3];
  }
  const tmp = new Float32Array(n * 4);
  for (let p = 0; p < 3; p++) {
    boxPass(f, tmp, w, h, r, 4, w * 4);
    boxPass(tmp, f, h, w, r, w * 4, 4);
  }
  for (let i = 0; i < n; i++) {
    const a = f[i * 4 + 3];
    const k = a > 0 ? 255 / a : 0;
    d[i * 4] = f[i * 4] * k;
    d[i * 4 + 1] = f[i * 4 + 1] * k;
    d[i * 4 + 2] = f[i * 4 + 2] * k;
    d[i * 4 + 3] = a;
  }
}

// Box blur lungo una dimensione: "len" elementi per riga, passo "step" tra elementi, "lineStep" tra righe.
function boxPass(src, dst, len, lines, r, step, lineStep) {
  const inv = 1 / (2 * r + 1);
  for (let l = 0; l < lines; l++) {
    const base = l * lineStep;
    for (let c = 0; c < 4; c++) {
      const first = src[base + c], last = src[base + (len - 1) * step + c];
      let acc = first * (r + 1);
      for (let j = 0; j < r; j++) acc += src[base + Math.min(j, len - 1) * step + c];
      for (let i = 0; i < len; i++) {
        const ri = i + r, li = i - r - 1;
        acc += (ri < len ? src[base + ri * step + c] : last) - (li >= 0 ? src[base + li * step + c] : first);
        dst[base + i * step + c] = acc * inv;
      }
    }
  }
}

// Riempie una maschera (bianco su trasparente) con un colore.
export function tintMask(mask, color) {
  const c = cloneCanvas(mask);
  const ctx = ctx2d(c);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

// ---- Colori ----

export function hexToRgb(hex) {
  const v = hex.replace('#', '');
  const n = parseInt(v.length === 3 ? v.split('').map((c) => c + c).join('') : v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mixHex(a, b, t) {
  const x = hexToRgb(a), y = hexToRgb(b);
  return '#' + x.map((v, i) => Math.round(lerp(v, y[i], t)).toString(16).padStart(2, '0')).join('');
}

export const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;

// SetLum/ClipColor delle specifiche W3C dei blend mode (valori 0..1).
export function setLum(r, g, b, l, out) {
  const d = l - lum(r, g, b);
  r += d; g += d; b += d;
  const L = lum(r, g, b);
  const n = Math.min(r, g, b), x = Math.max(r, g, b);
  if (n < 0) {
    const k = L / (L - n);
    r = L + (r - L) * k; g = L + (g - L) * k; b = L + (b - L) * k;
  }
  if (x > 1) {
    const k = (1 - L) / (x - L);
    r = L + (r - L) * k; g = L + (g - L) * k; b = L + (b - L) * k;
  }
  out[0] = r; out[1] = g; out[2] = b;
  return out;
}
