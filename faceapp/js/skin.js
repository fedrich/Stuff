// Maschera della pelle, levigatura (ringiovanimento) e texture/rughe (invecchiamento).
import { IDX } from './landmarks.js';
import {
  makeCanvas, ctx2d, blurCanvas, cloneCanvas, smoothPath, polyPath, quadPts, smoothstep,
  add, mul, mid, lerpPt, rotate, alphaOf,
} from './util.js';

export function buildSkinMask(geoms, w, h, hairMask) {
  const hard = makeCanvas(w, h);
  const ctx = ctx2d(hard);
  let maxW = 0;
  ctx.lineJoin = 'round';
  for (const g of geoms) {
    maxW = Math.max(maxW, g.faceW);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#fff';
    ctx.beginPath(); smoothPath(ctx, g.pts(IDX.oval)); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = ctx.strokeStyle = '#000';
    for (const [ids, lw] of [[IDX.eyeR, 0.035], [IDX.eyeL, 0.035], [IDX.browR, 0.015], [IDX.browL, 0.015], [IDX.lipsOuter, 0.01]]) {
      ctx.beginPath(); polyPath(ctx, g.pts(ids));
      ctx.fill();
      ctx.lineWidth = g.faceW * lw;
      ctx.stroke();
    }
  }
  if (hairMask) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(hairMask, 0, 0);
  }
  ctx.globalCompositeOperation = 'source-over';
  const soft = blurCanvas(hard, Math.max(1, maxW * 0.022));
  let alpha = null;
  return { hard, soft, faceW: maxW, get alpha() { return alpha || (alpha = alphaOf(soft)); } };
}

// Levigatura "pesata": la sfocatura usa solo pixel di pelle, così occhi e capelli non fanno alone.
export function smoothSkin(canvas, mask, amount) {
  const layer = cloneCanvas(canvas);
  const lctx = ctx2d(layer);
  lctx.globalCompositeOperation = 'destination-in';
  lctx.drawImage(mask.hard, 0, 0);
  const bl = blurCanvas(layer, Math.max(1, mask.faceW * 0.008 * (0.6 + amount)));
  const bctx = ctx2d(bl);
  bctx.globalCompositeOperation = 'destination-in';
  bctx.drawImage(mask.soft, 0, 0);
  const ctx = ctx2d(canvas);
  ctx.save();
  ctx.globalAlpha = Math.min(1, amount) * 0.72;
  ctx.drawImage(bl, 0, 0);
  ctx.drawImage(bl, 0, 0);
  ctx.restore();
}

// Pelle più vissuta: micro-dettaglio accentuato, meno saturazione, tono leggermente giallo.
export function ageSkin(canvas, mask, a) {
  const w = canvas.width, h = canvas.height;
  const ctx = ctx2d(canvas);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const B = ctx2d(blurCanvas(canvas, Math.max(1, mask.faceW * 0.006))).getImageData(0, 0, w, h).data;
  const m = mask.alpha;
  const detail = 0.8 * a, sat = 1 - 0.25 * a;
  for (let i = 0, j = 0; i < m.length; i++, j += 4) {
    if (!m[i]) continue;
    const k = m[i] / 255;
    let r = d[j] + (d[j] - B[j]) * detail;
    let g = d[j + 1] + (d[j + 1] - B[j + 1]) * detail;
    let b = d[j + 2] + (d[j + 2] - B[j + 2]) * detail;
    const l = 0.3 * r + 0.59 * g + 0.11 * b;
    r = (l + (r - l) * sat) * (1 - 0.02 * a);
    g = (l + (g - l) * sat) * (1 - 0.04 * a);
    b = (l + (b - l) * sat) * (1 - 0.1 * a);
    d[j] += (r - d[j]) * k;
    d[j + 1] += (g - d[j + 1]) * k;
    d[j + 2] += (b - d[j + 2]) * k;
  }
  ctx.putImageData(img, 0, 0);
}

// Rughe, borse sotto gli occhi e macchie dell'età disegnate seguendo i punti del volto.
export function drawWrinkles(canvas, g, a, mask, rand) {
  if (a < 0.05) return;
  const w = canvas.width, h = canvas.height;
  const { P, ux, down, faceW: W, faceH: H } = g;
  const dark = makeCanvas(w, h), light = makeCanvas(w, h);
  const dc = ctx2d(dark), lc = ctx2d(light);
  for (const c of [dc, lc]) { c.lineCap = 'round'; c.lineJoin = 'round'; }
  dc.strokeStyle = 'rgb(80,45,32)';
  lc.strokeStyle = 'rgb(255,238,225)';
  const vis = (th) => smoothstep(th, Math.min(1, th + 0.45), a);
  const line = (pts, width, alpha, hl = true) => {
    if (alpha <= 0.01) return;
    dc.globalAlpha = alpha; dc.lineWidth = width;
    dc.beginPath(); smoothPath(dc, pts, false); dc.stroke();
    if (hl) {
      lc.globalAlpha = alpha * 0.5; lc.lineWidth = width;
      lc.beginPath(); smoothPath(lc, pts.map((p) => add(p, mul(down, width * 1.2))), false); lc.stroke();
    }
  };
  const thick = 0.55 + 0.45 * a;

  // Fronte
  const browTop = mid(P(105), P(334));
  [0.28, 0.48, 0.68].forEach((t, k) => {
    const c = lerpPt(browTop, P(10), t);
    const half = W * (0.17 + 0.03 * k);
    const phase = rand() * 6;
    const pts = [];
    for (let j = 0; j <= 10; j++) {
      const u = -1 + (2 * j) / 10;
      pts.push(add(add(c, mul(ux, u * half)), mul(down, Math.sin(u * 3.6 + phase) * 0.004 * H + u * u * 0.014 * H)));
    }
    line(pts, W * 0.0035 * thick, 0.5 * vis(0.22 + 0.1 * k));
  });
  // Rughe del leone (tra le sopracciglia)
  [-1, 1].forEach((side) => {
    const base = add(mid(P(55), P(285)), mul(ux, side * 0.022 * W));
    line([add(base, mul(down, 0.01 * H)), add(add(base, mul(ux, side * 0.004 * W)), mul(down, -0.025 * H)), add(base, mul(down, -0.055 * H))], W * 0.003 * thick, 0.45 * vis(0.4));
  });
  // Zampe di gallina
  [[P(33), -1], [P(263), 1]].forEach(([corner, side]) => {
    const out = mul(ux, side);
    const start = add(corner, mul(out, 0.022 * W));
    [-26, -4, 20].forEach((deg) => {
      const dir = rotate(out, (deg * side * Math.PI) / 180);
      const end = add(start, mul(dir, 0.055 * W));
      const ctrl = add(mid(start, end), mul(down, 0.006 * W));
      line(quadPts(start, ctrl, end, 6), W * 0.0028 * thick, 0.45 * vis(0.28), false);
    });
  });
  // Borse sotto gli occhi
  [IDX.lidLowerR, IDX.lidLowerL].forEach((ids) => {
    const lid = g.pts(ids).slice(1, -1);
    line(lid.map((p) => add(p, mul(down, 0.028 * H))), W * 0.004 * thick, 0.45 * vis(0.15));
    line(lid.slice(1, -1).map((p) => add(p, mul(down, 0.05 * H))), W * 0.003 * thick, 0.35 * vis(0.55));
  });
  // Pieghe naso-labiali
  [[129, 61, -1], [358, 291, 1]].forEach(([wing, corner, side]) => {
    const s = add(P(wing), mul(ux, side * 0.012 * W));
    const e = add(add(P(corner), mul(ux, side * 0.03 * W)), mul(down, 0.025 * H * (0.5 + a)));
    const c = add(mid(s, e), mul(ux, side * 0.035 * W));
    line(quadPts(s, c, e, 10), W * 0.006 * thick, 0.6 * vis(0.05));
  });
  // Linee della marionetta
  [[61, -1], [291, 1]].forEach(([corner, side]) => {
    const s = add(add(P(corner), mul(down, 0.012 * H)), mul(ux, side * 0.012 * W));
    const e = add(add(s, mul(down, 0.075 * H)), mul(ux, side * 0.012 * W));
    line(quadPts(s, add(mid(s, e), mul(ux, side * 0.01 * W)), e, 6), W * 0.004 * thick, 0.5 * vis(0.45));
  });
  // Rughe sul labbro superiore
  IDX.upperLipTop.slice(2, -2).forEach((i) => {
    const p = P(i);
    line([add(p, mul(down, -0.004 * H)), add(p, mul(down, -0.022 * H))], W * 0.0018, 0.35 * vis(0.65), false);
  });
  // Macchie dell'età
  if (a > 0.55) {
    const anchors = [50, 280, 101, 330, 117, 346, 67, 297, 104, 333, 205, 425, 234, 454];
    const n = Math.floor((a - 0.5) * 26);
    for (let k = 0; k < n; k++) {
      const p = add(add(P(anchors[Math.floor(rand() * anchors.length)]), mul(ux, (rand() - 0.5) * 0.08 * W)), mul(down, (rand() - 0.5) * 0.08 * W));
      const r = W * (0.005 + 0.01 * rand());
      const gr = dc.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      gr.addColorStop(0, 'rgba(120,75,40,0.35)');
      gr.addColorStop(1, 'rgba(120,75,40,0)');
      dc.globalAlpha = 1;
      dc.fillStyle = gr;
      dc.fillRect(p.x - r, p.y - r, 2 * r, 2 * r);
    }
  }

  const ctx = ctx2d(canvas);
  for (const [layer, op, alpha] of [[dark, 'multiply', 0.75], [light, 'soft-light', 0.6]]) {
    const bl = blurCanvas(layer, Math.max(0.7, W * 0.003));
    const bctx = ctx2d(bl);
    bctx.globalCompositeOperation = 'destination-in';
    bctx.drawImage(mask.soft, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = op;
    ctx.globalAlpha = alpha;
    ctx.drawImage(bl, 0, 0);
    ctx.restore();
  }
}
