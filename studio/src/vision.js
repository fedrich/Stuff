// Caricamento dei modelli MediaPipe (eseguiti interamente nel browser, nessun upload).
const VER = '0.10.14';
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}`;
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const SEG_MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite';

let landmarker = null;
let segmenter = null;

async function create(Task, fileset, opts) {
  try {
    return await Task.createFromOptions(fileset, { ...opts, baseOptions: { ...opts.baseOptions, delegate: 'GPU' } });
  } catch (e) {
    console.warn('GPU non disponibile, uso la CPU', e);
    return await Task.createFromOptions(fileset, { ...opts, baseOptions: { ...opts.baseOptions, delegate: 'CPU' } });
  }
}

export async function initVision(onStatus = () => {}) {
  onStatus('Caricamento motore IA…');
  const lib = await import(`${CDN}/vision_bundle.mjs`);
  const fileset = await lib.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
  onStatus('Caricamento modello del volto…');
  landmarker = await create(lib.FaceLandmarker, fileset, {
    baseOptions: { modelAssetPath: FACE_MODEL },
    runningMode: 'IMAGE',
    numFaces: 5,
    minFaceDetectionConfidence: 0.3,
    minFacePresenceConfidence: 0.3,
  });
  onStatus('Caricamento modello di segmentazione…');
  try {
    segmenter = await create(lib.ImageSegmenter, fileset, {
      baseOptions: { modelAssetPath: SEG_MODEL },
      runningMode: 'IMAGE',
      outputCategoryMask: true,
      outputConfidenceMasks: false,
    });
  } catch (e) {
    console.warn('Segmentazione non disponibile', e);
  }
}

// Restituisce i volti (array di 478 punti in pixel), dal più grande al più piccolo.
// Se il volto riempie quasi tutta l'inquadratura il rilevatore può non trovarlo:
// in quel caso riprova aggiungendo un bordo attorno alla foto e riporta le coordinate.
export function detectFaces(canvas) {
  if (!landmarker) return [];
  const size = (f) => Math.hypot(f[234].x - f[454].x, f[234].y - f[454].y);
  const run = (src, ox, oy) => {
    const res = landmarker.detect(src);
    return (res.faceLandmarks || []).map((f) => f.map((p) => ({ x: p.x * src.width - ox, y: p.y * src.height - oy })));
  };
  let faces = run(canvas, 0, 0);
  for (const k of [0.15, 0.5]) {
    if (faces.length) break;
    const pad = Math.round(Math.max(canvas.width, canvas.height) * k);
    const c = document.createElement('canvas');
    c.width = canvas.width + pad * 2; c.height = canvas.height + pad * 2;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(canvas, pad, pad);
    faces = run(c, pad, pad);
  }
  return faces.sort((a, b) => size(b) - size(a));
}

// Categorie: 0 sfondo, 1 capelli, 2 pelle del corpo, 3 pelle del viso, 4 vestiti, 5 altro.
export function segment(canvas) {
  if (!segmenter) return null;
  let out = null;
  segmenter.segment(canvas, (res) => {
    const m = res.categoryMask;
    if (m) out = { w: m.width, h: m.height, data: m.getAsUint8Array().slice() };
  });
  return out;
}
