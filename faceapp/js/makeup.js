// Trucco: rossetto, fard, ombretto, eyeliner, sopracciglia.
import { IDX } from './landmarks.js';
import { makeCanvas, ctx2d, blurCanvas, tintMask, smoothPath, polyPath, add, mul } from './util.js';

function maskFrom(w, h, draw, blur) {
  const c = makeCanvas(w, h);
  const ctx = ctx2d(c);
  ctx.fillStyle = '#fff';
  draw(ctx);
  return blur > 0.4 ? blurCanvas(c, blur) : c;
}

function paint(canvas, mask, color, layers) {
  const layer = tintMask(mask, color);
  const ctx = ctx2d(canvas);
  for (const [op, alpha] of layers) {
    if (alpha <= 0) continue;
    ctx.save();
    ctx.globalCompositeOperation = op;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
  }
}

export function applyMakeup(canvas, g, m) {
  const w = canvas.width, h = canvas.height;
  const { P, ux, down, faceW: W, faceH: H } = g;

  if (m.lipstick > 0) {
    const mask = maskFrom(w, h, (ctx) => {
      ctx.beginPath(); smoothPath(ctx, g.pts(IDX.lipsOuter)); ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); smoothPath(ctx, g.pts(IDX.lipsInner)); ctx.fill();
    }, W * 0.004);
    paint(canvas, mask, m.lipColor, [['multiply', m.lipstick * 0.7], ['color', m.lipstick * 0.45], ['soft-light', m.lipstick * 0.4]]);
  }

  if (m.blush > 0) {
    const mask = maskFrom(w, h, (ctx) => {
      [[50, -1], [280, 1]].forEach(([i, side]) => {
        const c = add(add(P(i), mul(ux, side * 0.02 * W)), mul(down, 0.01 * H));
        const r = 0.12 * W;
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(g.angle);
        ctx.scale(1.25, 1);
        const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        gr.addColorStop(0, 'rgba(255,255,255,1)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(-r, -r, 2 * r, 2 * r);
        ctx.restore();
      });
    }, 0);
    paint(canvas, mask, m.blushColor, [['multiply', m.blush * 0.5], ['soft-light', m.blush * 0.4]]);
  }

  if (m.eyeshadow > 0) {
    const mask = maskFrom(w, h, (ctx) => {
      [[IDX.lidUpperR, -1], [IDX.lidUpperL, 1]].forEach(([ids, side]) => {
        const lid = g.pts(ids);
        const n = lid.length - 1;
        const top = lid.map((p, k) => {
          const t = k / n; // 0 = angolo esterno
          const lift = 0.035 * H * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, t * 1.2)));
          return add(add(p, mul(down, -lift)), mul(ux, side * (1 - t) * 0.012 * W));
        });
        ctx.beginPath(); smoothPath(ctx, lid.concat(top.reverse())); ctx.fill();
      });
    }, W * 0.01);
    paint(canvas, mask, m.shadowColor, [['multiply', m.eyeshadow * 0.6], ['soft-light', m.eyeshadow * 0.5]]);
  }

  if (m.eyeliner > 0) {
    const mask = maskFrom(w, h, (ctx) => {
      [[IDX.lidUpperR, -1], [IDX.lidUpperL, 1]].forEach(([ids, side]) => {
        const lid = g.pts(ids);
        const n = lid.length - 1;
        const upper = lid.map((p, k) => add(p, mul(down, -W * 0.0045 * (0.3 + (1 - k / n) * 1.2))));
        const wing = add(add(lid[0], mul(ux, side * 0.035 * W)), mul(down, -0.02 * H));
        ctx.beginPath();
        polyPath(ctx, [wing].concat(upper, lid.slice().reverse()));
        ctx.fill();
      });
    }, Math.max(0.5, W * 0.0015));
    paint(canvas, mask, m.linerColor || '#111', [['source-over', m.eyeliner * 0.85]]);
  }

  if (m.browDarken > 0) {
    const mask = maskFrom(w, h, (ctx) => {
      for (const ids of [IDX.browR, IDX.browL]) { ctx.beginPath(); smoothPath(ctx, g.pts(ids)); ctx.fill(); }
    }, W * 0.005);
    paint(canvas, mask, m.browColor || '#2a1d16', [['multiply', m.browDarken * 0.65]]);
  }
}

export function browMask(w, h, g) {
  return maskFrom(w, h, (ctx) => {
    for (const ids of [IDX.browR, IDX.browL]) { ctx.beginPath(); smoothPath(ctx, g.pts(ids)); ctx.fill(); }
  }, g.faceW * 0.006);
}
