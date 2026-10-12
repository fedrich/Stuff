// Maschere semantiche e mappe di luce, disegnate una sola volta per foto nello spazio dell'originale.
// Lo shader le campiona nelle stesse coordinate deformate dei pixel, quindi restano sempre allineate.
//
// maskA: R pelle del viso, G labbra (vermiglio), B occhi, A sopracciglia
// maskB: R pelle (viso + corpo) per l'abbronzatura, G interno bocca, B capelli, A zona sotto gli occhi
// shade: R cavità sotto lo zigomo, G punto luce dello zigomo, B linea della mandibola, A lati del naso
// glow:  R zone di luce (radiosità), G densità lentiggini naso, B densità lentiggini guance/fronte, A luce labbro
import { IDX } from './face.js';
import { blurCanvas } from './cpublur.js';

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
const ctx2d = (c) => c.getContext('2d', { willReadFrequently: true });

function path(ctx, pts, smooth = true) {
  const n = pts.length;
  if (!smooth || n < 3) {
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < n; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    return;
  }
  const m = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const s = m(pts[n - 1], pts[0]);
  ctx.moveTo(s.x, s.y);
  for (let i = 0; i < n; i++) { const e = m(pts[i], pts[(i + 1) % n]); ctx.quadraticCurveTo(pts[i].x, pts[i].y, e.x, e.y); }
  ctx.closePath();
}

const blurred = (src, r) => blurCanvas(src, Math.max(0.5, r));

// Disegna su un canale: fn(ctx) riempie in bianco; poi sfoca di r pixel.
function layer(w, h, fn, r) {
  const c = canvas(w, h);
  const ctx = ctx2d(c);
  ctx.fillStyle = ctx.strokeStyle = '#fff';
  ctx.lineCap = ctx.lineJoin = 'round';
  fn(ctx);
  return r > 0 ? blurred(c, r) : c;
}

function segLayer(seg, cats, w, h) {
  if (!seg) return null;
  const c = canvas(seg.w, seg.h);
  const ctx = ctx2d(c);
  const img = ctx.createImageData(seg.w, seg.h);
  for (let i = 0; i < seg.data.length; i++) {
    if (cats.includes(seg.data[i])) { const j = i * 4; img.data[j] = img.data[j + 1] = img.data[j + 2] = img.data[j + 3] = 255; }
  }
  ctx.putImageData(img, 0, 0);
  const out = canvas(w, h);
  const o = ctx2d(out);
  o.imageSmoothingQuality = 'high';
  o.drawImage(c, 0, 0, w, h);
  return out;
}

const alphaOf = (c) => {
  const d = ctx2d(c).getImageData(0, 0, c.width, c.height).data;
  const a = new Uint8Array(c.width * c.height);
  for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
  return a;
};

// Impacchetta quattro maschere in un buffer RGBA grezzo (niente canvas: eviterebbe la premoltiplicazione).
function pack(w, h, layers) {
  const data = new Uint8Array(w * h * 4);
  layers.forEach((l, c) => {
    if (!l) return;
    const a = alphaOf(l);
    for (let i = 0; i < a.length; i++) data[i * 4 + c] = a[i];
  });
  return { data, w, h };
}

function ellipse(ctx, c, rx, ry, angle) {
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, rx, ry, angle, 0, Math.PI * 2);
  ctx.fill();
}

export function buildMasks(f, seg, w, h) {
  const { P, W, angle } = f;
  const pts = (ids) => f.pts(ids);
  const at = (p, x, y) => { const d = f.vec(x, y); return { x: p.x + d.x, y: p.y + d.y }; };
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

  const hair = segLayer(seg, [1], w, h);
  const bodySkin = segLayer(seg, [2], w, h);
  const faceSkin = segLayer(seg, [3], w, h);
  const background = segLayer(seg, [0], w, h);

  const cutFeatures = (ctx) => {
    ctx.globalCompositeOperation = 'destination-out';
    for (const [ids, lw] of [[IDX.eyeR, 0.03], [IDX.eyeL, 0.03], [IDX.browR, 0.012], [IDX.browL, 0.012], [IDX.lipsOuter, 0.008]]) {
      ctx.beginPath(); path(ctx, pts(ids), false); ctx.fill();
      ctx.lineWidth = W * lw; ctx.stroke();
    }
    if (hair) ctx.drawImage(hair, 0, 0);
    if (background) ctx.drawImage(background, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  };

  // Pelle del viso (versione netta, usata anche per la sfocatura "pesata")
  const skinHard = layer(w, h, (ctx) => {
    ctx.beginPath(); path(ctx, pts(IDX.oval)); ctx.fill();
    if (faceSkin) ctx.drawImage(faceSkin, 0, 0); // include la pelle vicina rilevata dal segmentatore
    cutFeatures(ctx);
    ctx.globalCompositeOperation = 'destination-in';
    // limita all'area del viso allargata, così il segmentatore non porta dentro altre persone
    ctx.beginPath(); path(ctx, pts(IDX.oval).map((p) => lerp(f.origin, p, 1.12))); ctx.fill();
  }, 0);
  const skinFace = blurred(skinHard, W * 0.015);

  // Tutta la pelle visibile (fronte fino all'attaccatura, orecchie, collo, mani) per l'abbronzatura.
  const allSkinHard = layer(w, h, (ctx) => {
    ctx.drawImage(skinHard, 0, 0);
    if (faceSkin) ctx.drawImage(faceSkin, 0, 0);
    if (bodySkin) ctx.drawImage(bodySkin, 0, 0);
    cutFeatures(ctx);
  }, 0);
  const allSkin = blurred(allSkinHard, W * 0.006);

  const lips = layer(w, h, (ctx) => {
    ctx.beginPath(); path(ctx, pts(IDX.lipsOuter)); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); path(ctx, pts(IDX.lipsInner)); ctx.fill();
  }, W * 0.004);
  const eyes = layer(w, h, (ctx) => {
    for (const ids of [IDX.eyeR, IDX.eyeL]) { ctx.beginPath(); path(ctx, pts(ids), false); ctx.fill(); }
  }, W * 0.003);
  const brows = layer(w, h, (ctx) => {
    for (const ids of [IDX.browR, IDX.browL]) { ctx.beginPath(); path(ctx, pts(ids)); ctx.fill(); }
  }, W * 0.005);
  const mouth = layer(w, h, (ctx) => { ctx.beginPath(); path(ctx, pts(IDX.lipsInner)); ctx.fill(); }, W * 0.002);
  const underEye = layer(w, h, (ctx) => {
    for (const ids of [IDX.lidLowerR, IDX.lidLowerL]) {
      const lid = pts(ids);
      const low = lid.map((p, i) => at(p, 0, 0.012 + 0.045 * Math.sin((Math.PI * i) / (lid.length - 1))));
      ctx.beginPath(); path(ctx, lid.map((p) => at(p, 0, 0.006)).concat(low.reverse())); ctx.fill();
    }
  }, W * 0.014);

  // Mappe di chiaroscuro anatomico
  const sideCheek = (side) => (side < 0 ? P(234) : P(454));
  const corner = (side) => (side < 0 ? P(61) : P(291));
  const outerEye = (side) => (side < 0 ? P(33) : P(263));
  const hollow = layer(w, h, (ctx) => {
    for (const s of [-1, 1]) {
      const a = sideCheek(s), b = corner(s);
      const c = at(lerp(a, b, 0.38), 0, -0.02);
      ellipse(ctx, c, W * 0.1, W * 0.032, Math.atan2(b.y - a.y, b.x - a.x));
    }
  }, W * 0.035);
  const cheekbone = layer(w, h, (ctx) => {
    for (const s of [-1, 1]) {
      const c = at(outerEye(s), s * 0.015, 0.1);
      ellipse(ctx, c, W * 0.075, W * 0.03, angle + s * 0.35);
    }
  }, W * 0.03);
  const jawline = layer(w, h, (ctx) => {
    ctx.lineWidth = W * 0.05;
    ctx.beginPath();
    const j = pts(IDX.jaw);
    ctx.moveTo(j[0].x, j[0].y);
    for (const p of j.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }, W * 0.03);
  const noseSides = layer(w, h, (ctx) => {
    ctx.lineWidth = W * 0.022;
    for (const s of [-1, 1]) {
      const top = at(P(168), s * 0.04, 0.02), bot = s < 0 ? P(129) : P(358);
      ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(bot.x, bot.y); ctx.stroke();
    }
  }, W * 0.015);

  // Mappe per radiosità e lentiggini
  const glowZones = layer(w, h, (ctx) => {
    for (const s of [-1, 1]) ellipse(ctx, at(outerEye(s), s * 0.01, 0.095), W * 0.07, W * 0.03, angle + s * 0.35);
    ctx.lineWidth = W * 0.025;
    ctx.beginPath(); ctx.moveTo(P(168).x, P(168).y); ctx.lineTo(P(4).x, P(4).y); ctx.stroke();
    ellipse(ctx, lerp(P(10), P(9), 0.5), W * 0.09, W * 0.05, angle);
    ellipse(ctx, at(P(152), 0, -0.05), W * 0.05, W * 0.03, angle);
  }, W * 0.03);
  const freckNose = layer(w, h, (ctx) => {
    ellipse(ctx, lerp(P(6), P(4), 0.55), W * 0.08, W * 0.07, angle);
    for (const s of [-1, 1]) ellipse(ctx, at(s < 0 ? P(129) : P(358), s * 0.07, -0.03), W * 0.08, W * 0.045, angle);
  }, W * 0.03);
  const freckWide = layer(w, h, (ctx) => {
    for (const s of [-1, 1]) ellipse(ctx, at(outerEye(s), -s * 0.01, 0.12), W * 0.13, W * 0.08, angle);
    ellipse(ctx, lerp(P(10), P(9), 0.6), W * 0.16, W * 0.06, angle);
    ellipse(ctx, lerp(P(6), P(4), 0.5), W * 0.09, W * 0.08, angle);
  }, W * 0.04);
  const lipLight = layer(w, h, (ctx) => {
    ellipse(ctx, lerp(P(14), P(17), 0.45), W * 0.05, W * 0.016, angle);
    ellipse(ctx, lerp(P(0), P(13), 0.45), W * 0.035, W * 0.01, angle);
  }, W * 0.012);

  return {
    maskA: pack(w, h, [skinFace, lips, eyes, brows]),
    maskB: pack(w, h, [allSkin, mouth, hair, underEye]),
    shade: pack(w, h, [hollow, cheekbone, jawline, noseSides]),
    glow: pack(w, h, [glowZones, freckNose, freckWide, lipLight]),
    skinHard: allSkinHard,
  };
}
