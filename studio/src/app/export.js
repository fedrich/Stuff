// Esportazione alla risoluzione piena: un secondo motore lavora sulla copia ad alta risoluzione,
// con i punti del volto riscalati, e viene liberato subito dopo.
import { Engine } from '../engine/engine.js';

export async function exportPhoto(photo, params) {
  await new Promise((r) => setTimeout(r, 30)); // lascia comparire l'indicatore di avanzamento
  const canvas = document.createElement('canvas');
  const engine = new Engine(canvas);
  let out;
  try {
    const k = photo.scale;
    const lm = photo.lm ? photo.lm.map((q) => ({ x: q.x * k, y: q.y * k })) : null;
    engine.setImage(photo.full, lm, photo.seg);
    out = engine.snapshot(params);
  } finally {
    engine.dispose();
  }
  const blob = await new Promise((res) => out.toBlob(res, 'image/jpeg', 0.95));
  const name = `volto-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg`;
  const file = new File([blob], name, { type: 'image/jpeg' });
  // Su iPhone/Android il foglio di condivisione permette "Salva immagine" nella galleria.
  if (navigator.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
