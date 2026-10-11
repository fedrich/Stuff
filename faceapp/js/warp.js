// Deformazioni locali del volto (sorriso, occhi, viso sottile…) con mappatura inversa.
// Operazioni:
//   t: traslazione locale con decadimento morbido: centro c, raggio r, spostamento m
//   b: rigonfiamento/restringimento centrato in c (s > 0 ingrandisce)
import { ctx2d } from './util.js';

const T = (c, m, r) => ({ t: 't', cx: c.x, cy: c.y, mx: m.x, my: m.y, r });
const B = (c, r, s) => ({ t: 'b', cx: c.x, cy: c.y, r, s });

export function buildWarpOps(g, p) {
  const ops = [];
  const { P, v, faceW: W, faceH: H } = g;
  const sides = (pairs, fn) => pairs.forEach(([i, side]) => fn(P(i), side));

  if (p.smile) {
    const s = p.smile;
    sides([[61, -1], [291, 1]], (c, side) => ops.push(T(c, v(side * 0.03 * W * s, -0.06 * H * s), 0.18 * W)));
    if (s > 0) sides([[50, -1], [280, 1]], (c, side) => ops.push(T(c, v(side * 0.008 * W * s, -0.02 * H * s), 0.17 * W)));
  }
  if (p.jowl) {
    const j = p.jowl;
    sides([[61, -1], [291, 1]], (c) => ops.push(T(c, v(0, 0.014 * H * j), 0.12 * W)));
    sides([[172, -1], [397, 1]], (c, side) => ops.push(T(c, v(side * 0.012 * W * j, 0.03 * H * j), 0.2 * W)));
    sides([[159, -1], [386, 1]], (c) => ops.push(T(c, v(0, 0.006 * H * j), 0.06 * W)));
  }
  if (p.eyes) {
    const s = Math.max(-0.6, p.eyes * 0.35);
    ops.push(B(g.eyeR, g.eyeWR * 0.95, s));
    ops.push(B(g.eyeL, g.eyeWL * 0.95, s));
  }
  if (p.slim) {
    const s = p.slim;
    sides([[172, -1], [397, 1], [136, -1], [365, 1], [58, -1], [288, 1]], (c, side) => ops.push(T(c, v(-side * 0.035 * W * s, 0), 0.22 * W)));
    sides([[93, -1], [323, 1]], (c, side) => ops.push(T(c, v(-side * 0.012 * W * s, 0), 0.18 * W)));
  }
  if (p.nose) {
    const s = p.nose, nw = g.noseW;
    sides([[129, -1], [358, 1]], (c, side) => ops.push(T(c, v(-side * 0.18 * nw * s, 0), nw * 0.7)));
    ops.push(B(P(1), nw * 0.6, -0.12 * s));
  }
  if (p.lips) {
    const c = { x: (P(13).x + P(14).x) / 2, y: (P(13).y + P(14).y) / 2 };
    ops.push(B(c, g.mouthW * 0.6, Math.max(-0.5, p.lips * 0.25)));
  }
  if (p.chin) ops.push(T(P(152), v(0, 0.04 * H * p.chin), 0.18 * W));
  if (p.brows) sides([[105, -1], [334, 1]], (c) => ops.push(T(c, v(0, -0.025 * H * p.brows), 0.12 * W)));
  return ops;
}

// Spostamento (sorgente = x + off) nel punto (x, y).
function offset(ops, x, y, out) {
  let ox = 0, oy = 0;
  for (let k = 0; k < ops.length; k++) {
    const o = ops[k];
    const dx = x - o.cx, dy = y - o.cy;
    const d2 = dx * dx + dy * dy, r2 = o.r * o.r;
    if (d2 >= r2) continue;
    if (o.t === 't') {
      // Nucleo morbido (1 - d²/r²)²: lo spostamento sfuma gradualmente fino al bordo.
      let f = 1 - d2 / r2;
      f *= f;
      ox -= f * o.mx; oy -= f * o.my;
    } else {
      const q = 1 - d2 / r2;
      const f = o.s * q * q;
      ox -= dx * f; oy -= dy * f;
    }
  }
  out[0] = ox; out[1] = oy;
}

export function applyWarps(canvas, ops) {
  if (!ops.length) return;
  const w = canvas.width, h = canvas.height;
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (const o of ops) {
    x0 = Math.min(x0, o.cx - o.r); y0 = Math.min(y0, o.cy - o.r);
    x1 = Math.max(x1, o.cx + o.r); y1 = Math.max(y1, o.cy + o.r);
  }
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
  x1 = Math.min(w, Math.ceil(x1)); y1 = Math.min(h, Math.ceil(y1));
  if (x1 <= x0 || y1 <= y0) return;
  const ctx = ctx2d(canvas);
  const src = ctx.getImageData(0, 0, w, h).data;
  const bw = x1 - x0, bh = y1 - y0;
  const out = ctx.getImageData(x0, y0, bw, bh);
  const d = out.data;
  const off = [0, 0];
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const px = x + x0, py = y + y0;
      offset(ops, px, py, off);
      if (off[0] === 0 && off[1] === 0) continue;
      let sx = px + off[0], sy = py + off[1];
      sx = Math.min(w - 1.001, Math.max(0, sx));
      sy = Math.min(h - 1.001, Math.max(0, sy));
      const ix = sx | 0, iy = sy | 0, fx = sx - ix, fy = sy - iy;
      const i00 = (iy * w + ix) * 4, i10 = i00 + 4, i01 = i00 + w * 4, i11 = i01 + 4;
      const o = (y * bw + x) * 4;
      for (let c = 0; c < 3; c++) {
        const top = src[i00 + c] + (src[i10 + c] - src[i00 + c]) * fx;
        const bot = src[i01 + c] + (src[i11 + c] - src[i01 + c]) * fx;
        d[o + c] = top + (bot - top) * fy;
      }
    }
  }
  ctx.putImageData(out, x0, y0);
}

// Posizione di un punto dopo la deformazione (inverte la mappa con iterazioni di punto fisso).
export function forwardMap(p, ops) {
  const off = [0, 0];
  let x = p.x, y = p.y;
  for (let i = 0; i < 5; i++) {
    offset(ops, x, y, off);
    x = p.x - off[0]; y = p.y - off[1];
  }
  return { x, y };
}
