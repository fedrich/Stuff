// Morph e scambio volti: triangolazione di Delaunay sui punti del volto e warp affine per triangolo.
import { IDX } from './landmarks.js';
import { makeCanvas, ctx2d, blurCanvas, cloneCanvas, smoothPath, lerpPt, sub, add, mul, dist, clamp } from './util.js';

export function delaunay(points) {
  const n = points.length;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  const dm = Math.max(maxX - minX, maxY - minY) || 1;
  const mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
  const pts = points.concat([{ x: mx - 20 * dm, y: my - dm }, { x: mx, y: my + 20 * dm }, { x: mx + 20 * dm, y: my - dm }]);
  const tri = (a, b, c) => {
    const A = pts[a], B = pts[b], C = pts[c];
    const D = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
    const a2 = A.x * A.x + A.y * A.y, b2 = B.x * B.x + B.y * B.y, c2 = C.x * C.x + C.y * C.y;
    const ux = (a2 * (B.y - C.y) + b2 * (C.y - A.y) + c2 * (A.y - B.y)) / D;
    const uy = (a2 * (C.x - B.x) + b2 * (A.x - C.x) + c2 * (B.x - A.x)) / D;
    return { a, b, c, x: ux, y: uy, r2: (A.x - ux) ** 2 + (A.y - uy) ** 2 };
  };
  let tris = [tri(n, n + 1, n + 2)];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const keep = [], edges = new Map();
    for (const t of tris) {
      if ((p.x - t.x) ** 2 + (p.y - t.y) ** 2 < t.r2) {
        for (const [u, v] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]]) {
          const k = u < v ? `${u},${v}` : `${v},${u}`;
          edges.set(k, edges.has(k) ? null : [u, v]);
        }
      } else keep.push(t);
    }
    for (const e of edges.values()) if (e) keep.push(tri(e[0], e[1], i));
    tris = keep;
  }
  return tris.filter((t) => t.a < n && t.b < n && t.c < n).map((t) => [t.a, t.b, t.c]);
}

// Matrice affine che porta il triangolo s nel triangolo d (formato setTransform).
export function affine(s0, s1, s2, d0, d1, d2) {
  const den = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
  if (Math.abs(den) < 1e-9) return null;
  const solve = (v0, v1, v2) => [
    (v0 * (s1.y - s2.y) + v1 * (s2.y - s0.y) + v2 * (s0.y - s1.y)) / den,
    (v0 * (s2.x - s1.x) + v1 * (s0.x - s2.x) + v2 * (s1.x - s0.x)) / den,
    (v0 * (s1.x * s2.y - s2.x * s1.y) + v1 * (s2.x * s0.y - s0.x * s2.y) + v2 * (s0.x * s1.y - s1.x * s0.y)) / den,
  ];
  const [a, c, e] = solve(d0.x, d1.x, d2.x);
  const [b, d, f] = solve(d0.y, d1.y, d2.y);
  return [a, b, c, d, e, f];
}

export function warpTriangles(src, srcPts, dstPts, tris, w, h, base = null) {
  const out = makeCanvas(w, h);
  const ctx = ctx2d(out);
  if (base) ctx.drawImage(base, 0, 0); // copre le sottili fessure tra triangoli
  for (const [i, j, k] of tris) {
    const d0 = dstPts[i], d1 = dstPts[j], d2 = dstPts[k];
    const m = affine(srcPts[i], srcPts[j], srcPts[k], d0, d1, d2);
    if (!m) continue;
    // Triangolo leggermente allargato per evitare fessure tra i triangoli.
    const cx = (d0.x + d1.x + d2.x) / 3, cy = (d0.y + d1.y + d2.y) / 3;
    const grow = (p) => {
      const dx = p.x - cx, dy = p.y - cy, l = Math.hypot(dx, dy) || 1;
      return { x: p.x + (dx / l) * 0.9, y: p.y + (dy / l) * 0.9 };
    };
    const [g0, g1, g2] = [grow(d0), grow(d1), grow(d2)];
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(g0.x, g0.y); ctx.lineTo(g1.x, g1.y); ctx.lineTo(g2.x, g2.y); ctx.closePath();
    ctx.clip();
    ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.drawImage(src, 0, 0);
    ctx.restore();
  }
  return out;
}

// Similitudine (scala, rotazione, traslazione) che allinea gli occhi di B a quelli di A.
function similarity(bR, bL, aR, aL) {
  const s = dist(aR, aL) / (dist(bR, bL) || 1);
  const th = Math.atan2(aL.y - aR.y, aL.x - aR.x) - Math.atan2(bL.y - bR.y, bL.x - bR.x);
  const cos = Math.cos(th) * s, sin = Math.sin(th) * s;
  const bm = lerpPt(bR, bL, 0.5), am = lerpPt(aR, aL, 0.5);
  const fwd = (p) => { const q = sub(p, bm); return { x: am.x + q.x * cos - q.y * sin, y: am.y + q.x * sin + q.y * cos }; };
  const inv = (p) => { const q = sub(p, am); const k = 1 / (s * s); return { x: bm.x + (q.x * cos + q.y * sin) * k, y: bm.y + (-q.x * sin + q.y * cos) * k }; };
  return { fwd, inv };
}

// Adatta colore e luce del volto B a quelli di A confrontando le basse frequenze
// (rapporto tra le due immagini sfocate), così da seguire anche ombre e riflessi locali.
function matchLighting(outB, outA, mask, W) {
  const w = outB.width, h = outB.height, r = Math.max(2, W * 0.1);
  const lowpass = (src) => {
    const c = cloneCanvas(src);
    const ctx = ctx2d(c);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0);
    return ctx2d(blurCanvas(c, r)).getImageData(0, 0, w, h).data;
  };
  const la = lowpass(outA), lb = lowpass(outB);
  const bctx = ctx2d(outB);
  const img = bctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let j = 0; j < d.length; j += 4) {
    if (!d[j + 3] || la[j + 3] < 8 || lb[j + 3] < 8) continue;
    for (let c = 0; c < 3; c++) d[j + c] *= clamp((la[j + c] + 4) / (lb[j + c] + 4), 0.5, 2);
  }
  bctx.putImageData(img, 0, 0);
}

// Restituisce { canvas, lm } con il volto principale di A fuso con quello di B.
export function morphFaces(imgA, lmA, imgB, lmB, mode, amount) {
  const w = imgA.width, h = imgA.height;
  const S = similarity(lmB[468] || lmB[33], lmB[473] || lmB[263], lmA[468] || lmA[33], lmA[473] || lmA[263]);
  const bAligned = lmB.map(S.fwd);
  const tShape = mode === 'swap' ? 0.2 * amount : amount;
  const target = lmA.map((p, i) => lerpPt(p, bAligned[i] || p, tShape));

  const border = [];
  for (const fx of [0, 0.5, 1]) for (const fy of [0, 0.5, 1]) if (fx !== 0.5 || fy !== 0.5) border.push({ x: fx * (w - 1), y: fy * (h - 1) });
  const N = 468;
  const dst = target.slice(0, N).concat(border);
  const srcA = lmA.slice(0, N).concat(border);
  const srcB = lmB.slice(0, N).concat(border.map(S.inv));
  const tris = delaunay(dst);
  const faceTris = tris.filter((t) => t[0] < N && t[1] < N && t[2] < N);

  const outA = warpTriangles(imgA, srcA, dst, tris, w, h, imgA);
  const outB = warpTriangles(imgB, srcB, dst, faceTris, w, h);

  const W = dist(target[234], target[454]);
  const eyeMid = lerpPt(target[468] || target[33], target[473] || target[263], 0.5);
  const ang = Math.atan2((target[473] || target[263]).y - (target[468] || target[33]).y, (target[473] || target[263]).x - (target[468] || target[33]).x);
  const down = { x: -Math.sin(ang), y: Math.cos(ang) };
  // Ovale del viso con la fronte abbassata: evita di trascinare capelli e cappelli della seconda foto.
  const oval = IDX.oval.map((i) => {
    const p = target[i];
    const dy = (p.x - eyeMid.x) * down.x + (p.y - eyeMid.y) * down.y;
    return dy < 0 ? add(p, mul(down, -dy * 0.55)) : p;
  });
  const c = oval.reduce((acc, p) => add(acc, mul(p, 1 / oval.length)), { x: 0, y: 0 });
  const hard = makeCanvas(w, h);
  const hctx = ctx2d(hard);
  hctx.fillStyle = '#fff';
  hctx.beginPath(); smoothPath(hctx, oval.map((p) => lerpPt(c, p, 0.93))); hctx.fill();
  if (mode === 'swap') {
    // L'interno della bocca resta quello originale (denti, lingua).
    hctx.globalCompositeOperation = 'destination-out';
    hctx.beginPath(); smoothPath(hctx, IDX.lipsInner.map((i) => target[i])); hctx.fill();
    hctx.globalCompositeOperation = 'source-over';
    matchLighting(outB, outA, hard, W);
  }
  const mask = blurCanvas(hard, W * 0.035);
  const bctx = ctx2d(outB);
  bctx.globalCompositeOperation = 'destination-in';
  bctx.drawImage(mask, 0, 0);
  const actx = ctx2d(outA);
  actx.globalAlpha = amount;
  actx.drawImage(outB, 0, 0);
  actx.globalAlpha = 1;
  return { canvas: outA, lm: target };
}
