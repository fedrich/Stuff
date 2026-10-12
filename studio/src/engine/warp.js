// Geometria: ogni tratto del viso è un insieme di "maniglie" ancorate ai punti anatomici.
// Una maniglia sposta i pixel vicini con un nucleo morbido (1 - u²)³ ellittico, orientato come il volto:
//   tipo 0 = traslazione di m pixel
//   tipo 1 = scala locale (sx, sy) attorno al centro, negli assi del volto
// Lo spostamento totale è la somma delle maniglie ed è lineare nei valori dei cursori:
// valore 0 => spostamento esattamente nullo; valore dimezzato => spostamento dimezzato.
import { MIRROR } from './face.js';

const MAX_T = 0.35; // |m| massimo rispetto al raggio minore: garantisce una deformazione senza pieghe
const MAX_S = 0.3;

const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// Prospettiva: con la testa girata il lato lontano appare compresso in orizzontale. Ogni maniglia
// viene ridimensionata in x secondo la semi-larghezza del lato in cui si trova, così la stessa modifica
// produce lo stesso effetto anatomico su entrambi i lati (nessuna asimmetria introdotta).
export function sideScale(f, c) {
  const wr = -f.toLocal(f.P(234)).x, wl = f.toLocal(f.P(454)).x, half = (wr + wl) / 2;
  const x = f.toLocal(c).x;
  const k = (x < 0 ? wr : wl) / half;
  return 1 + (k - 1) * Math.min(1, Math.abs(x) / 0.45);
}

export function buildHandles(f, p) {
  const H = [];
  const { P, W } = f;
  const T = (c, x, y, rx, ry) => {
    if (!x && !y) return;
    const k = sideScale(f, c);
    x *= k; rx *= k;
    const m = f.vec(x, y), r = Math.min(rx, ry) * W, mag = Math.hypot(m.x, m.y);
    const lim = mag > MAX_T * r ? (MAX_T * r) / mag : 1;
    H.push({ type: 0, cx: c.x, cy: c.y, a: m.x * lim, b: m.y * lim, rx: rx * W, ry: ry * W });
  };
  const S = (c, sx, sy, rx, ry) => {
    if (!sx && !sy) return;
    const cl = (s) => Math.max(-MAX_S, Math.min(MAX_S, s));
    H.push({ type: 1, cx: c.x, cy: c.y, a: cl(sx), b: cl(sy), rx: rx * W * sideScale(f, c), ry: ry * W });
  };
  const sides = (pairs, fn) => pairs.forEach(([i, side]) => fn(P(i), side));
  const val = (k) => p[k] || 0;

  // ---- Naso ----
  if (val('nose.width')) {
    const s = val('nose.width');
    sides([[129, -1], [358, 1]], (c, d) => T(c, d * 0.016 * s, 0, 0.06, 0.08));
    sides([[98, -1], [327, 1]], (c, d) => T(c, d * 0.01 * s, 0, 0.045, 0.05));
  }
  if (val('nose.tip')) {
    const s = val('nose.tip'); // + punta più sottile e leggermente sollevata
    S(P(1), -0.12 * s, -0.06 * s, 0.06, 0.055);
    T(P(4), 0, -0.008 * s, 0.05, 0.05);
  }
  if (val('nose.nostrils')) {
    const s = val('nose.nostrils');
    sides([[64, -1], [294, 1]], (c, d) => T(c, d * 0.012 * s, 0, 0.04, 0.04));
  }
  if (val('nose.length')) {
    const s = val('nose.length'); // + più lungo: punta e base scendono
    T(mid(P(1), P(2)), 0, 0.014 * s, 0.075, 0.06);
  }

  // ---- Zigomi ----
  if (val('cheeks.volume')) {
    const s = val('cheeks.volume');
    sides([[50, -1], [280, 1]], (c, d) => T(c, d * 0.012 * s, -0.008 * s, 0.1, 0.09));
  }
  if (val('cheeks.definition')) {
    const s = val('cheeks.definition');
    sides([[207, -1], [427, 1]], (c, d) => T(c, -d * 0.006 * s, 0, 0.08, 0.07));
  }
  if (val('cheeks.sculpt')) {
    const s = val('cheeks.sculpt');
    sides([[207, -1], [427, 1]], (c, d) => T(c, -d * 0.009 * s, -0.003 * s, 0.09, 0.08));
  }

  // ---- Mandibola e mento ----
  if (val('jaw.width')) {
    const s = val('jaw.width');
    sides([[172, -1], [397, 1], [136, -1], [365, 1]], (c, d) => T(c, d * 0.022 * s, 0, 0.13, 0.15));
    sides([[150, -1], [379, 1]], (c, d) => T(c, d * 0.012 * s, 0, 0.1, 0.1));
  }
  if (val('jaw.definition')) {
    const s = val('jaw.definition');
    sides([[172, -1], [397, 1], [136, -1], [365, 1]], (c, d) => T(c, -d * 0.005 * s, -0.003 * s, 0.09, 0.09));
  }
  if (val('chin.length')) T(P(152), 0, 0.026 * val('chin.length'), 0.14, 0.1);
  if (val('chin.width')) {
    const s = val('chin.width');
    sides([[148, -1], [377, 1], [176, -1], [400, 1]], (c, d) => T(c, d * 0.01 * s, 0, 0.07, 0.07));
  }

  // ---- Labbra ----
  const lipC = mid(P(13), P(14));
  const mouthW = Math.hypot(P(61).x - P(291).x, P(61).y - P(291).y) / W;
  const lipH = Math.hypot(P(0).x - P(17).x, P(0).y - P(17).y) / W;
  if (val('lips.volume')) {
    const s = val('lips.volume');
    S(lipC, 0.03 * s, 0.24 * s, mouthW * 0.6, lipH * 0.9);
  }
  if (val('lips.ratio')) {
    const s = val('lips.ratio'); // + labbro superiore più pieno rispetto all'inferiore
    S(mid(P(0), P(13)), 0, 0.24 * s, mouthW * 0.5, lipH * 0.5);
    S(mid(P(14), P(17)), 0, -0.2 * s, mouthW * 0.5, lipH * 0.5);
  }
  if (val('lips.width')) {
    const s = val('lips.width');
    sides([[61, -1], [291, 1]], (c, d) => T(c, d * 0.012 * s, 0, 0.05, 0.045));
  }
  if (val('lips.define')) {
    const s = val('lips.define'); // arco di Cupido leggermente più marcato
    T(P(37), 0, -0.004 * s, 0.03, 0.025);
    T(P(267), 0, -0.004 * s, 0.03, 0.025);
  }
  if (val('expr.smile')) {
    const s = val('expr.smile');
    sides([[61, -1], [291, 1]], (c, d) => T(c, d * 0.008 * s, -0.012 * s, 0.07, 0.06));
  }

  // ---- Occhi ----
  // Larghezza media degli occhi (la prospettiva è già gestita da sideScale).
  const eyeW = (Math.hypot(P(33).x - P(133).x, P(33).y - P(133).y) + Math.hypot(P(263).x - P(362).x, P(263).y - P(362).y)) / 2 / W;
  const eyeWR = eyeW, eyeWL = eyeW;
  const eyeCR = mid(P(33), P(133)), eyeCL = mid(P(263), P(362));
  if (val('eyes.size')) {
    const s = 0.12 * val('eyes.size');
    S(eyeCR, s, s, eyeWR * 0.9, eyeWR * 0.65);
    S(eyeCL, s, s, eyeWL * 0.9, eyeWL * 0.65);
  }
  if (val('eyes.shape')) {
    const s = val('eyes.shape'); // + occhio più aperto e tondo, - più allungato
    S(eyeCR, -0.03 * s, 0.12 * s, eyeWR * 0.85, eyeWR * 0.6);
    S(eyeCL, -0.03 * s, 0.12 * s, eyeWL * 0.85, eyeWL * 0.6);
  }
  if (val('eyes.distance')) {
    const s = val('eyes.distance');
    T(eyeCR, -0.01 * s, 0, eyeWR * 1.0, eyeWR * 0.6);
    T(eyeCL, 0.01 * s, 0, eyeWL * 1.0, eyeWL * 0.6);
  }

  if (val('eyes.tilt')) {
    const s = val('eyes.tilt'); // + angolo esterno sollevato (sguardo "a mandorla" verso l'alto)
    T(P(33), -0.004 * s, -0.009 * s, eyeW * 0.45, eyeW * 0.38);
    T(P(263), 0.004 * s, -0.009 * s, eyeW * 0.45, eyeW * 0.38);
    T(P(133), 0, 0.003 * s, eyeW * 0.35, eyeW * 0.35);
    T(P(362), 0, 0.003 * s, eyeW * 0.35, eyeW * 0.35);
  }

  // ---- Sopracciglia ----
  const browCR = mid(P(105), P(52)), browCL = mid(P(334), P(282));
  if (val('brows.position')) {
    const s = val('brows.position');
    T(browCR, 0, -0.012 * s, 0.13, 0.07);
    T(browCL, 0, -0.012 * s, 0.13, 0.07);
  }
  if (val('brows.arch')) {
    const s = val('brows.arch');
    T(P(105), 0, -0.008 * s, 0.05, 0.05);
    T(P(334), 0, -0.008 * s, 0.05, 0.05);
  }
  if (val('brows.thickness')) {
    const s = val('brows.thickness');
    S(browCR, 0, 0.28 * s, 0.11, 0.045);
    S(browCL, 0, 0.28 * s, 0.11, 0.045);
  }
  if (val('brows.shape')) {
    const s = val('brows.shape'); // + coda più sollevata
    T(P(70), 0, -0.008 * s, 0.045, 0.045);
    T(P(300), 0, -0.008 * s, 0.045, 0.045);
  }

  // ---- Viso ----
  if (val('face.width')) {
    const s = val('face.width');
    // Maniglie su guance e mandibola, lontane dagli occhi (che non devono deformarsi).
    sides([[93, -1], [323, 1]], (c, d) => T(c, d * 0.016 * s, 0, 0.15, 0.17));
    sides([[132, -1], [361, 1]], (c, d) => T(c, d * 0.016 * s, 0, 0.15, 0.16));
    sides([[58, -1], [288, 1]], (c, d) => T(c, d * 0.01 * s, 0, 0.12, 0.12));
  }
  if (val('face.proportions')) {
    const s = val('face.proportions'); // + terzo inferiore più lungo
    T(P(152), 0, 0.02 * s, 0.2, 0.14);
    T(lipC, 0, 0.008 * s, 0.16, 0.1);
  }
  if (val('face.symmetry')) {
    const s = val('face.symmetry');
    // Avvicina i lineamenti interni alla posizione speculare del gemello (metà strada a intensità 1).
    // Con la testa girata la prospettiva crea false asimmetrie orizzontali: la componente orizzontale
    // si attenua in base alla rotazione stimata, quella verticale (un occhio più alto) resta.
    // Il contorno del viso è escluso: è il più deformato dalla prospettiva.
    const wr = -f.toLocal(P(234)).x, wl = f.toLocal(P(454)).x;
    const yaw = Math.abs(wl - wr) / (wl + wr);
    const hk = Math.max(0, 1 - yaw * 8) * 0.6;
    const keys = [33, 133, 159, 145, 70, 105, 107, 46, 129, 98, 61, 40, 91];
    for (const i of keys) {
      for (const k of [i, MIRROR[i]]) {
        const q = f.toLocal(P(MIRROR[k])), cur = f.toLocal(P(k));
        let dx = (-q.x - cur.x) * 0.5 * s * hk, dy = (q.y - cur.y) * 0.5 * s;
        const mag = Math.hypot(dx, dy), lim = 0.015;
        if (mag > lim) { dx *= lim / mag; dy *= lim / mag; }
        T(P(k), dx, dy, 0.07, 0.07);
      }
    }
  }
  for (const h of H) { h.cos = Math.cos(f.angle); h.sin = Math.sin(f.angle); }
  return H;
}

// Spostamento nel punto q (coordinate sorgente). Identico allo shader.
export function displacement(H, q) {
  let dx = 0, dy = 0;
  for (const h of H) {
    const px = q.x - h.cx, py = q.y - h.cy;
    const lx = px * h.cos + py * h.sin, ly = -px * h.sin + py * h.cos;
    const u2 = (lx / h.rx) ** 2 + (ly / h.ry) ** 2;
    if (u2 >= 1) continue;
    const t = 1 - u2, k = t * t * t;
    if (h.type === 0) { dx += h.a * k; dy += h.b * k; } else {
      const sx = lx * h.a * k, sy = ly * h.b * k;
      dx += sx * h.cos - sy * h.sin; dy += sx * h.sin + sy * h.cos;
    }
  }
  return { x: dx, y: dy };
}

export const forwardMap = (H, q) => { const d = displacement(H, q); return { x: q.x + d.x, y: q.y + d.y }; };
