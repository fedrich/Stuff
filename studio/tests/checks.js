// Controlli di qualità eseguiti nel browser sul motore reale (vedi run-tests.mjs).
// Ogni controllo misura numericamente una proprietà richiesta: neutralità, località, protezione
// delle aree non di pelle, gradualità dell'intensità, assenza di pieghe e di asimmetrie introdotte.
import { buildHandles, displacement, sideScale } from '../src/engine/warp.js';
import { IDX, MIRROR } from '../src/engine/face.js';
import { SKIN_TOOLS, TRAIT_TOOLS, IMPRESSIONS, resolveParams } from '../src/app/tools.js';

const pixels = (c) => c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;

function diff(a, b) {
  const d = new Float32Array(a.length / 4);
  for (let i = 0; i < d.length; i++) {
    const j = i * 4;
    d[i] = Math.max(Math.abs(a[j] - b[j]), Math.abs(a[j + 1] - b[j + 1]), Math.abs(a[j + 2] - b[j + 2]));
  }
  return d;
}

// Zone in cui ogni strumento può agire (punti anatomici + raggio in larghezze del viso).
const REGIONS = {
  nose: { ids: [...IDX.nose, 1, 2, 4, 5, 64, 294, 98, 327, 129, 358, 94, 19], r: 0.11 },
  cheeks: { ids: [50, 280, 207, 427, 116, 345, 123, 352, 205, 425, 187, 411, 33, 263, 234, 454, 61, 291], r: 0.15 },
  jaw: { ids: [...IDX.jaw, 152], r: 0.2 },
  lips: { ids: [...IDX.lipsOuter], r: 0.12 }, // labbra + banda di transizione (filtro e mento)
  eyes: { ids: [...IDX.eyeR, ...IDX.eyeL], r: 0.12 },
  brows: { ids: [...IDX.browR, ...IDX.browL], r: 0.12 },
  face: { ids: Array.from({ length: 468 }, (_, i) => i), r: 0.28 }, // tutto il viso, interno compreso
};

function regionMask(lm, W, w, h, region) {
  const m = new Uint8Array(w * h);
  const r = region.r * W, r2 = r * r;
  for (const i of region.ids) {
    const p = lm[i];
    const x0 = Math.max(0, Math.floor(p.x - r)), x1 = Math.min(w - 1, Math.ceil(p.x + r));
    const y0 = Math.max(0, Math.floor(p.y - r)), y1 = Math.min(h - 1, Math.ceil(p.y + r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if ((x - p.x) ** 2 + (y - p.y) ** 2 <= r2) m[y * w + x] = 1;
  }
  return m;
}

// Jacobiano della mappa diretta su una griglia attorno al volto: det > 0 ovunque => nessuna piega.
function minJacobian(H, f) {
  let min = Infinity;
  const e = 0.5;
  for (let gy = -0.9; gy <= 1.1; gy += 0.02) {
    for (let gx = -0.8; gx <= 0.8; gx += 0.02) {
      const q = f.toImage(gx, gy);
      const dx1 = displacement(H, { x: q.x + e, y: q.y }), dx0 = displacement(H, { x: q.x - e, y: q.y });
      const dy1 = displacement(H, { x: q.x, y: q.y + e }), dy0 = displacement(H, { x: q.x, y: q.y - e });
      const a = 1 + (dx1.x - dx0.x) / (2 * e), b = (dy1.x - dy0.x) / (2 * e);
      const c = (dx1.y - dx0.y) / (2 * e), d = 1 + (dy1.y - dy0.y) / (2 * e);
      min = Math.min(min, a * d - b * c);
    }
  }
  return min;
}

export async function runChecks(studio) {
  const engine = studio.engine, photo = studio.photo;
  const R = { checks: [], timings: [] };
  const ok = (name, pass, value, limit) => R.checks.push({ name, pass, value: +(+value).toFixed(4), limit });
  if (!photo.lm) { R.noFace = true; return R; }
  const { w, h, frame: f } = engine;
  const W = f.W;
  const t0 = performance.now();
  const orig = pixels(engine.snapshot({}, { original: true }));
  const neutral = pixels(engine.snapshot({}));
  R.timings.push(performance.now() - t0);

  // 1. Neutralità: con tutti i cursori a zero il risultato coincide con l'originale.
  const dn = diff(orig, neutral);
  let maxN = 0; for (const v of dn) maxN = Math.max(maxN, v);
  ok('neutro = originale (diff massima)', maxN <= 2, maxN, '≤ 2/255');

  // 2. Località dei tratti: i pixel cambiati fuori dalla zona dello strumento.
  for (const tool of TRAIT_TOOLS) {
    const zone = regionMask(photo.lm, W, w, h, REGIONS[tool.id]);
    for (const s of tool.sliders) {
      for (const v of [-1, 1]) {
        const t = performance.now();
        const out = pixels(engine.snapshot({ [s.key]: v }));
        R.timings.push(performance.now() - t);
        const d = diff(neutral, out);
        let changed = 0, outside = 0;
        for (let i = 0; i < d.length; i++) if (d[i] > 3) { changed++; if (!zone[i]) outside++; }
        const frac = changed ? outside / changed : 0;
        ok(`località ${s.key}=${v} (frazione fuori zona)`, frac < 0.01, frac, '< 1%');
      }
    }
  }

  // 3. Pelle: nessun cambiamento su occhi, interno bocca, capelli e sfondo.
  // Le maschere possono essere a risoluzione ridotta: si leggono nel punto corrispondente.
  const mA = engine.masks.maskA.data, mB = engine.masks.maskB.data, ms = engine.maskScale, mw = engine.mw, mh = engine.mh;
  const protectedZone = new Uint8Array(w * h);
  const skinAny = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, j = (Math.min(mh - 1, (y * ms) | 0) * mw + Math.min(mw - 1, (x * ms) | 0)) * 4;
    skinAny[i] = mB[j] > 8 || mA[j] > 8 ? 1 : 0;
    protectedZone[i] = (mA[j + 2] > 200 || mB[j + 1] > 200 || mB[j + 2] > 200) ? 1 : 0;
  }
  for (const tool of SKIN_TOOLS) {
    const p = Object.fromEntries(tool.sliders.map((s) => [s.key, s.max]));
    if (tool.primary) p[tool.primary] = 1;
    const out = pixels(engine.snapshot(p));
    const d = diff(neutral, out);
    let prot = 0, protChanged = 0, outSkin = 0, changed = 0;
    for (let i = 0; i < d.length; i++) {
      if (protectedZone[i]) { prot++; if (d[i] > 3) protChanged++; }
      if (d[i] > 3) { changed++; if (!skinAny[i]) outSkin++; }
    }
    ok(`${tool.id}: occhi/bocca/capelli intatti (frazione cambiata)`, protChanged / Math.max(1, prot) < 0.01, protChanged / Math.max(1, prot), '< 1%');
    ok(`${tool.id}: modifiche fuori dalla pelle`, outSkin / Math.max(1, changed) < 0.01, outSkin / Math.max(1, changed), '< 1%');
  }

  // 4. Impressioni: intensità progressiva e lineare; spostamenti contenuti (identità).
  for (const imp of IMPRESSIONS) {
    const md = [];
    for (const a of [0, 0.25, 0.5, 0.75, 1]) {
      const out = pixels(engine.snapshot(resolveParams({ values: {}, impression: { id: imp.id, amount: a } })));
      const d = diff(neutral, out);
      let s = 0; for (const v of d) s += v;
      md.push(s / d.length);
    }
    const mono = md.every((v, i) => i === 0 || v > md[i - 1]);
    ok(`${imp.id}: intensità crescente 0→25→50→75→100`, mono && md[0] < 0.01, md.map((v) => v.toFixed(2)).join(' / '), 'crescente');
    // La differenza in pixel non può crescere in modo perfettamente lineare (i bordi si saturano),
    // ma gli spostamenti dei punti sì: al 50% devono essere esattamente la metà di quelli al 100%.
    const ratio = md[2] / md[4];
    ok(`${imp.id}: progressione visiva (differenza 50% / 100%)`, ratio > 0.3 && ratio < 0.7, ratio, '0,3–0,7');
    const H = buildHandles(f, resolveParams({ values: {}, impression: { id: imp.id, amount: 1 } }));
    const Hh = buildHandles(f, resolveParams({ values: {}, impression: { id: imp.id, amount: 0.5 } }));
    let lin = 0;
    for (let i = 0; i < 468; i += 3) {
      const a = displacement(H, photo.lm[i]), b = displacement(Hh, photo.lm[i]);
      lin = Math.max(lin, Math.hypot(a.x / 2 - b.x, a.y / 2 - b.y) / W);
    }
    ok(`${imp.id}: linearità geometrica (50% = metà del 100%)`, lin < 1e-4, lin, '< 0,01% del viso');
    let max = 0, sum = 0;
    for (let i = 0; i < 468; i++) { const d = displacement(H, photo.lm[i]); const m = Math.hypot(d.x, d.y) / W; max = Math.max(max, m); sum += m; }
    ok(`${imp.id}: spostamento massimo dei punti (identità)`, max <= 0.035, max, '≤ 3,5% del viso');
    ok(`${imp.id}: spostamento medio dei punti`, sum / 468 <= 0.012, sum / 468, '≤ 1,2% del viso');
    ok(`${imp.id}: nessuna piega (Jacobiano minimo)`, minJacobian(H, f) > 0.3, minJacobian(H, f), '> 0,3');
  }

  // 5. Nessuna piega, e nessuna asimmetria introdotta dai singoli tratti al massimo.
  //    L'indice di asimmetria confronta ogni punto con il suo gemello riflesso (nello spazio del volto
  //    corretto per la prospettiva). Si misura quanto cresce rispetto alla foto originale: le asimmetrie
  //    naturali della persona restano, ma lo strumento non deve aggiungerne di nuove.
  const asymIndex = (pts, ids) => {
    const wr = -f.toLocal(f.P(234)).x, wl = f.toLocal(f.P(454)).x;
    let s = 0, n = 0;
    for (const i of ids) {
      const k = MIRROR[i]; if (k <= i) continue;
      const a = f.toLocal(pts[i]), b = f.toLocal(pts[k]);
      const ax = a.x / (a.x < 0 ? wr : wl), bx = b.x / (b.x < 0 ? wr : wl);
      s += Math.hypot((ax + bx) * (wr + wl) / 2, a.y - b.y); n++;
    }
    return s / n;
  };
  const all = Array.from({ length: 468 }, (_, i) => i);
  const eyeIds = [...IDX.eyeR, ...IDX.eyeL, 468, 473];
  const before = asymIndex(photo.lm, all), beforeEye = asymIndex(photo.lm, eyeIds);
  let worstJ = Infinity, worstKey = '', worstAsym = -1, asymKey = '', worstEye = -1, eyeKey = '';
  for (const tool of TRAIT_TOOLS) for (const s of tool.sliders) for (const v of [-1, 1]) {
    const H = buildHandles(f, { [s.key]: v });
    if (!H.length) continue;
    const j = minJacobian(H, f);
    if (j < worstJ) { worstJ = j; worstKey = `${s.key}=${v}`; }
    const moved = photo.lm.map((q) => { const d = displacement(H, q); return { x: q.x + d.x, y: q.y + d.y }; });
    const da = asymIndex(moved, all) - before;
    if (da > worstAsym) { worstAsym = da; asymKey = `${s.key}=${v}`; }
    // Per gli occhi l'indice è relativo alla loro larghezza: ingrandirli in proporzione non conta come asimmetria.
    const eyeW = (pts) => (Math.hypot(pts[33].x - pts[133].x, pts[33].y - pts[133].y) + Math.hypot(pts[263].x - pts[362].x, pts[263].y - pts[362].y)) / 2 / W;
    const de = (asymIndex(moved, eyeIds) / eyeW(moved) - beforeEye / eyeW(photo.lm)) * eyeW(photo.lm);
    if (de > worstEye) { worstEye = de; eyeKey = `${s.key}=${v}`; }
  }
  ok(`tratti: nessuna piega (peggiore ${worstKey})`, worstJ > 0.3, worstJ, '> 0,3');
  ok(`tratti: asimmetria aggiunta (peggiore ${asymKey})`, worstAsym < 0.0015, worstAsym, '< 0,15% del viso');
  ok(`occhi: asimmetria aggiunta (peggiore ${eyeKey})`, worstEye < 0.002, worstEye, '< 0,2% del viso (≈ mezzo pixel)');

  R.renderMs = Math.round(R.timings.reduce((a, b) => a + b, 0) / R.timings.length);
  delete R.timings;
  return R;
}
