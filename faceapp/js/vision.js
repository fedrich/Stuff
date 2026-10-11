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
    minFaceDetectionConfidence: 0.4,
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
export function detectFaces(canvas) {
  if (!landmarker) return [];
  const res = landmarker.detect(canvas);
  const w = canvas.width, h = canvas.height;
  const faces = (res.faceLandmarks || []).map((f) => f.map((p) => ({ x: p.x * w, y: p.y * h })));
  const size = (f) => Math.hypot(f[234].x - f[454].x, f[234].y - f[454].y);
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
