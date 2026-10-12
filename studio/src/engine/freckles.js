// Lentiggini procedurali: posizioni campionate da una mappa di densità anatomica (naso, guance, fronte),
// forme irregolari e dimensioni variabili. Il risultato è una maschera alfa nello spazio dell'originale.
import { blurCanvas } from './cpublur.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// glow: mappe RGBA (G = naso, B = guance/fronte); maskA: maschere RGBA (R = pelle del viso), entrambe alla
// risoluzione delle maschere (fattore ms). f: sistema del volto a piena risoluzione. Restituisce Uint8Array w*h.
export function buildFreckles(glow, maskA, ms, f, w, h, opts) {
  const gw = glow.w, gh = glow.h;
  const { amount, size, spread } = opts;
  const out = new Uint8Array(w * h);
  if (amount <= 0) return out;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const rand = rng(20251012);
  const W = f.W;
  // Densità: con distribuzione 0 solo il naso, con 1 anche guance e fronte.
  const dens = (x, y) => {
    const gx = Math.min(gw - 1, (x * ms) | 0), gy = Math.min(gh - 1, (y * ms) | 0);
    const i = (gy * gw + gx) * 4;
    const d = glow.data[i + 1] / 255 * (1 - spread * 0.4) + glow.data[i + 2] / 255 * spread;
    return d * (maskA[i] / 255);
  };
  // Area di campionamento: riquadro del viso.
  const bx = f.origin.x - W * 0.55, by = f.origin.y - W * 0.6, bw = W * 1.1, bh = W * 1.2;
  const target = Math.round(80 + amount * 1100);
  let placed = 0;
  ctx.fillStyle = '#fff';
  // Il generatore produce sempre la stessa sequenza: aumentare "quantità" aggiunge lentiggini senza spostare le altre.
  for (let tries = 0; tries < 60000 && placed < target; tries++) {
    const x = bx + rand() * bw, y = by + rand() * bh;
    const r1 = rand(), r2 = rand(), r3 = rand(), r4 = rand();
    if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
    if (r1 > dens(x, y)) continue;
    placed++;
    // Molte piccole e chiare, poche grandi e marcate (distribuzione asimmetrica come nelle lentiggini vere).
    const base = W * 0.0026 * (0.5 + size * 1.6) * (0.35 + r2 * r2 * r2 * 1.9);
    const alpha = 0.18 + r3 * r3 * 0.7;
    // Forma irregolare: due o tre ellissi leggermente sfalsate.
    const blobs = 2 + (r4 > 0.6 ? 1 : 0);
    for (let k = 0; k < blobs; k++) {
      const ox = (rand() - 0.5) * base * 0.8, oy = (rand() - 0.5) * base * 0.8;
      ctx.globalAlpha = alpha * (k === 0 ? 1 : 0.6);
      ctx.beginPath();
      ctx.ellipse(x + ox, y + oy, base * (0.6 + rand() * 0.5), base * (0.5 + rand() * 0.5), rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const soft = blurCanvas(c, Math.max(0.7, W * 0.0018));
  const d = soft.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4 + 3];
  return out;
}
