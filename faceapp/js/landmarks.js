// Indici della mesh MediaPipe Face Landmarker (478 punti) e misure derivate del volto.
// "R" = lato destro del soggetto (a sinistra nell'immagine).
import { dist, mid } from './util.js';

export const IDX = {
  oval: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
  jaw: [93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323],
  lipsOuter: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185],
  lipsInner: [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191],
  upperLipTop: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291],
  lowerLipBottom: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291],
  eyeR: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
  eyeL: [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466],
  lidUpperR: [33, 246, 161, 160, 159, 158, 157, 173, 133],
  lidUpperL: [263, 466, 388, 387, 386, 385, 384, 398, 362],
  lidLowerR: [33, 7, 163, 144, 145, 153, 154, 155, 133],
  lidLowerL: [263, 249, 390, 373, 374, 380, 381, 382, 362],
  browR: [46, 53, 52, 65, 55, 107, 66, 105, 63, 70],
  browL: [276, 283, 282, 295, 285, 336, 296, 334, 293, 300],
};

export function geom(lm) {
  const P = (i) => lm[i];
  const eyeR = lm.length > 468 ? lm[468] : mid(P(33), P(133));
  const eyeL = lm.length > 473 ? lm[473] : mid(P(263), P(362));
  const angle = Math.atan2(eyeL.y - eyeR.y, eyeL.x - eyeR.x);
  const ux = { x: Math.cos(angle), y: Math.sin(angle) };
  const down = { x: -Math.sin(angle), y: Math.cos(angle) };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const i of IDX.oval) {
    const p = lm[i];
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
  }
  // Spostamento in coordinate del volto: dx verso il lato sinistro del soggetto, dy verso il mento.
  const v = (dx, dy) => ({ x: ux.x * dx + down.x * dy, y: ux.y * dx + down.y * dy });
  return {
    lm, P, ux, down, angle, eyeR, eyeL, v,
    pts: (ids) => ids.map(P),
    at: (p, dx, dy) => { const d = v(dx, dy); return { x: p.x + d.x, y: p.y + d.y }; },
    faceW: dist(P(234), P(454)),
    faceH: dist(P(10), P(152)),
    eyeDist: dist(eyeR, eyeL),
    eyeWR: dist(P(33), P(133)),
    eyeWL: dist(P(263), P(362)),
    mouthW: dist(P(61), P(291)),
    noseW: dist(P(129), P(358)),
    bbox: { x0, y0, x1, y1 },
  };
}
