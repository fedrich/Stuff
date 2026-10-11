// Barba e baffi generati pelo per pelo all'interno di regioni costruite sui punti del volto.
import { IDX } from './landmarks.js';
import { makeCanvas, ctx2d, blurCanvas, smoothPath, add, mul, lerpPt, hexToRgb, clamp, rotate } from './util.js';

function mustache(g, handlebar) {
  const { P, faceW: W, faceH: H } = g;
  const lip = g.pts(IDX.upperLipTop);
  const n = lip.length - 1;
  const top = lip.map((p, k) => lerpPt(p, lerpPt(P(98), P(327), k / n), 0.85));
  const ext = handlebar ? [0.07, -0.03] : [0.025, 0.02];
  const cR = g.at(P(61), -ext[0] * W, ext[1] * H);
  const cL = g.at(P(291), ext[0] * W, ext[1] * H);
  return [cR].concat(lip, [cL], top.reverse());
}

function goatee(g) {
  const { P, faceW: W, faceH: H } = g;
  const lip = g.pts(IDX.lowerLipBottom);
  lip[0] = g.at(lip[0], -0.012 * W, 0.006 * H);
  lip[lip.length - 1] = g.at(lip[lip.length - 1], 0.012 * W, 0.006 * H);
  const chin = [378, 400, 377, 152, 148, 176, 149].map((i, k, a) => g.at(P(i), 0, (0.015 + 0.02 * Math.sin((Math.PI * k) / (a.length - 1))) * H));
  return lip.concat(chin);
}

function fullBeard(g, cheekDrop = 0) {
  const { P, faceW: W, faceH: H } = g;
  const n = IDX.jaw.length - 1;
  const jaw = IDX.jaw.map((i, k) => g.at(P(i), 0, 0.055 * H * Math.sin((Math.PI * k) / n)));
  const top = mustache(g, false).slice(IDX.upperLipTop.length + 2); // bordo superiore dei baffi, da destra a sinistra dell'immagine
  const cheekL = g.at(lerpPt(P(323), P(291), 0.35), 0, (-0.02 + cheekDrop) * H);
  const cheekR = g.at(lerpPt(P(93), P(61), 0.35), 0, (-0.02 + cheekDrop) * H);
  return jaw.concat([cheekL], top, [cheekR]);
}

function chinstrap(g) {
  const { P, faceH: H } = g;
  const n = IDX.jaw.length - 1;
  const outer = IDX.jaw.map((i, k) => g.at(P(i), 0, 0.03 * H * Math.sin((Math.PI * k) / n)));
  const c = P(1);
  const inner = IDX.jaw.map((i) => lerpPt(P(i), c, 0.14)).reverse();
  return outer.concat(inner);
}

const STYLES = {
  stubble: { regions: (g) => [fullBeard(g)], len: 0.006, density: 0.5, alpha: 0.55, base: 0.22 },
  full: { regions: (g) => [fullBeard(g)], len: 0.028, density: 0.5, alpha: 0.85, base: 0.5 },
  short: { regions: (g) => [fullBeard(g, 0.02)], len: 0.014, density: 0.45, alpha: 0.8, base: 0.4 },
  goatee: { regions: (g) => [goatee(g), mustache(g, false)], len: 0.02, density: 0.4, alpha: 0.85, base: 0.45 },
  mustache: { regions: (g) => [mustache(g, false)], len: 0.02, density: 0.45, alpha: 0.85, base: 0.45 },
  handlebar: { regions: (g) => [mustache(g, true)], len: 0.022, density: 0.45, alpha: 0.9, base: 0.5 },
  chinstrap: { regions: (g) => [chinstrap(g)], len: 0.014, density: 0.45, alpha: 0.85, base: 0.45 },
};

export const BEARD_STYLES = Object.keys(STYLES);

export function drawBeard(canvas, g, style, density, color, rand) {
  const st = STYLES[style];
  if (!st || density <= 0) return;
  const { faceW: W, down, ux } = g;
  const regions = st.regions(g);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of regions) for (const p of r) {
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
  }
  const pad = W * 0.05;
  x0 = Math.floor(x0 - pad); y0 = Math.floor(y0 - pad); x1 = Math.ceil(x1 + pad); y1 = Math.ceil(y1 + pad);
  const bw = x1 - x0, bh = y1 - y0;

  const maskC = makeCanvas(bw, bh);
  const mctx = ctx2d(maskC);
  mctx.translate(-x0, -y0);
  mctx.fillStyle = '#fff';
  for (const r of regions) { mctx.beginPath(); smoothPath(mctx, r); mctx.fill(); }
  mctx.globalCompositeOperation = 'destination-out';
  mctx.beginPath(); smoothPath(mctx, g.pts(IDX.lipsOuter)); mctx.fill();
  const mask = blurCanvas(maskC, W * (style === 'stubble' ? 0.02 : 0.012));
  const shadow = blurCanvas(maskC, W * 0.02);
  const [cr, cg, cb] = hexToRgb(color);

  // Strato di base: ombra dei follicoli, scurisce la pelle sotto i peli.
  const sctx = ctx2d(shadow);
  sctx.globalCompositeOperation = 'source-in';
  sctx.fillStyle = `rgb(${cr},${cg},${cb})`;
  sctx.fillRect(0, 0, bw, bh);

  const hair = makeCanvas(bw, bh);
  const hctx = ctx2d(hair);
  hctx.translate(-x0, -y0);
  hctx.lineCap = 'round';
  const cx = g.P(1).x, cy = g.P(1).y;
  const count = Math.round(bw * bh * st.density * density * 0.12);
  const len = W * st.len;
  const lw = Math.max(0.6, W * 0.0022);
  for (let k = 0; k < count; k++) {
    const x = x0 + rand() * bw, y = y0 + rand() * bh;
    // Direzione: verso il basso, aperta verso l'esterno ai lati del volto.
    const rel = ((x - cx) * ux.x + (y - cy) * ux.y) / (W * 0.5);
    const ang = clamp(rel, -1, 1) * 0.7 + (rand() - 0.5) * 0.6;
    const dir = rotate(down, -ang);
    const l = len * (0.5 + rand());
    const shade = rand() < 0.15 ? 1.4 + rand() * 0.5 : 0.55 + rand() * 0.6;
    hctx.strokeStyle = `rgba(${Math.min(255, cr * shade + 8)},${Math.min(255, cg * shade + 6)},${Math.min(255, cb * shade + 4)},${0.35 + rand() * 0.5})`;
    hctx.lineWidth = lw * (0.7 + rand() * 0.6);
    hctx.beginPath();
    hctx.moveTo(x, y);
    const e = add({ x, y }, mul(dir, l));
    const c = add(add({ x, y }, mul(dir, l * 0.5)), mul(ux, (rand() - 0.5) * l * 0.4));
    hctx.quadraticCurveTo(c.x, c.y, e.x, e.y);
    hctx.stroke();
  }
  hctx.setTransform(1, 0, 0, 1, 0, 0);
  hctx.globalCompositeOperation = 'destination-in';
  hctx.drawImage(mask, 0, 0);

  const ctx = ctx2d(canvas);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = Math.min(1, st.base * density);
  ctx.drawImage(shadow, x0, y0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = st.alpha;
  ctx.drawImage(hair, x0, y0);
  ctx.restore();
}
