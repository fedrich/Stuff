// Sfocatura gaussiana su canvas 2D: usa ctx.filter quando il browser lo supporta,
// altrimenti un box blur a tre passate su colori premoltiplicati (stesso risultato visivo).
const makeCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
const ctx2d = (c) => c.getContext('2d', { willReadFrequently: true });


// Verifica funzionale: alcuni browser (Safari) accettano la proprietà ctx.filter ma non applicano la
// sfocatura. Si disegna un punto con blur e si controlla che si sia davvero allargato.
let filterSupport = null;
export function canFilter() {
  if (filterSupport === null) {
    try {
      const src = makeCanvas(9, 9);
      const sctx = src.getContext('2d');
      sctx.fillStyle = '#fff';
      sctx.fillRect(4, 4, 1, 1);
      const dst = makeCanvas(9, 9);
      const dctx = ctx2d(dst);
      dctx.filter = 'blur(2px)';
      dctx.drawImage(src, 0, 0);
      const a = dctx.getImageData(1, 4, 1, 1).data[3]; // 3 px dal punto: >0 solo se la sfocatura c'è stata
      filterSupport = a > 0;
    } catch {
      filterSupport = false;
    }
  }
  return filterSupport;
}

// Sfocatura gaussiana (raggio = deviazione standard in px). Restituisce una nuova canvas.
// Le aree trasparenti non "sporcano" il colore: la media è pesata dall'alpha.
export function blurCanvas(src, r) {
  const w = src.width, h = src.height;
  const out = makeCanvas(w, h);
  const ctx = ctx2d(out);
  if (r < 0.5) {
    ctx.drawImage(src, 0, 0);
    return out;
  }
  if (canFilter()) {
    ctx.filter = `blur(${r.toFixed(2)}px)`;
    ctx.drawImage(src, 0, 0);
    ctx.filter = 'none';
    return out;
  }
  // Fallback JS (es. Safari): riduzione + 3 passate di box blur su colori premoltiplicati.
  const scale = Math.max(1, r / 3);
  const sw = Math.max(1, Math.round(w / scale)), sh = Math.max(1, Math.round(h / scale));
  const small = makeCanvas(sw, sh);
  const sctx = ctx2d(small);
  sctx.drawImage(src, 0, 0, sw, sh);
  const img = sctx.getImageData(0, 0, sw, sh);
  boxBlurPremul(img.data, sw, sh, Math.max(1, Math.round(r / scale)));
  sctx.putImageData(img, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small, 0, 0, w, h);
  return out;
}

function boxBlurPremul(d, w, h, r) {
  const n = w * h;
  const f = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const a = d[i * 4 + 3] / 255;
    f[i * 4] = d[i * 4] * a;
    f[i * 4 + 1] = d[i * 4 + 1] * a;
    f[i * 4 + 2] = d[i * 4 + 2] * a;
    f[i * 4 + 3] = d[i * 4 + 3];
  }
  const tmp = new Float32Array(n * 4);
  for (let p = 0; p < 3; p++) {
    boxPass(f, tmp, w, h, r, 4, w * 4);
    boxPass(tmp, f, h, w, r, w * 4, 4);
  }
  for (let i = 0; i < n; i++) {
    const a = f[i * 4 + 3];
    const k = a > 0 ? 255 / a : 0;
    d[i * 4] = f[i * 4] * k;
    d[i * 4 + 1] = f[i * 4 + 1] * k;
    d[i * 4 + 2] = f[i * 4 + 2] * k;
    d[i * 4 + 3] = a;
  }
}

// Box blur lungo una dimensione: "len" elementi per riga, passo "step" tra elementi, "lineStep" tra righe.
function boxPass(src, dst, len, lines, r, step, lineStep) {
  const inv = 1 / (2 * r + 1);
  for (let l = 0; l < lines; l++) {
    const base = l * lineStep;
    for (let c = 0; c < 4; c++) {
      const first = src[base + c], last = src[base + (len - 1) * step + c];
      let acc = first * (r + 1);
      for (let j = 0; j < r; j++) acc += src[base + Math.min(j, len - 1) * step + c];
      for (let i = 0; i < len; i++) {
        const ri = i + r, li = i - r - 1;
        acc += (ri < len ? src[base + ri * step + c] : last) - (li >= 0 ? src[base + li * step + c] : first);
        dst[base + i * step + c] = acc * inv;
      }
    }
  }
}
