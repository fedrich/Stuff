// Gestione delle fotografie: decodifica (con orientamento EXIF), copia ad alta risoluzione per
// l'esportazione e copia di lavoro per l'anteprima. L'originale non viene mai modificato.
// Sui telefoni l'esportazione si ferma a 3072 px per restare nei limiti di memoria della GPU.
const FULL_MAX = matchMedia('(pointer: coarse)').matches ? 3072 : 4096;
const PREVIEW_MAX = 1600;

function scaled(src, sw, sh, max, mirror = false) {
  const k = Math.min(1, max / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(sw * k));
  c.height = Math.max(1, Math.round(sh * k));
  const ctx = c.getContext('2d');
  if (mirror) { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

function decode(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error('Il file scelto non è un\'immagine')); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Formato non supportato (prova JPG o PNG)')); };
    img.src = url;
  });
}

export async function loadPhoto(source) {
  let full;
  if (source instanceof HTMLCanvasElement) full = scaled(source, source.width, source.height, FULL_MAX);
  else {
    const img = await decode(source);
    full = scaled(img, img.naturalWidth, img.naturalHeight, FULL_MAX);
  }
  const preview = scaled(full, full.width, full.height, PREVIEW_MAX);
  return { full, preview, scale: full.width / preview.width };
}

export function fromVideo(video) {
  return scaled(video, video.videoWidth, video.videoHeight, FULL_MAX, true);
}
