// Visualizzazione: adattamento allo schermo, zoom (pizzico, rotellina, doppio tocco), confronto prima/dopo.
export class Viewer {
  constructor(viewport, layer, canvases, splitLine) {
    this.vp = viewport; this.layer = layer; this.canvases = canvases; this.line = splitLine;
    this.s = 1; this.tx = 0; this.ty = 0; this.split = false; this.splitPos = 0.5;
    this.pointers = new Map();
    new ResizeObserver(() => this.fit()).observe(viewport);
    viewport.addEventListener('pointerdown', (e) => this.down(e));
    viewport.addEventListener('pointermove', (e) => this.move(e));
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) viewport.addEventListener(ev, (e) => this.pointers.delete(e.pointerId));
    viewport.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
    viewport.addEventListener('dblclick', (e) => this.zoomAt(e.clientX, e.clientY, this.s > 1.05 ? 1 / this.s : 2.5));
  }
  setSize(w, h, face) { this.w = w; this.h = h; this.face = face; this.s = 1; this.tx = 0; this.ty = 0; this.fit(); }
  fit() {
    if (!this.w) return;
    const r = this.vp.getBoundingClientRect();
    const k = Math.min(r.width / this.w, r.height / this.h);
    this.dw = Math.round(this.w * k); this.dh = Math.round(this.h * k);
    for (const c of this.canvases) { c.style.width = this.dw + 'px'; c.style.height = this.dh + 'px'; }
    this.layer.style.width = this.dw + 'px'; this.layer.style.height = this.dh + 'px';
    this.apply();
  }
  // Mantiene l'immagine dentro la vista: centrata se più piccola, senza bordi vuoti se più grande.
  clamp() {
    if (this.s <= 1.001) { this.s = 1; this.tx = 0; this.ty = 0; return; }
    const r = this.vp.getBoundingClientRect();
    const axis = (t, view, size) => {
      const base = (view - size) / 2, scaled = size * this.s;
      if (scaled <= view) return base - (view - scaled) / 2;
      return Math.min(base + scaled - view, Math.max(base, t));
    };
    this.tx = axis(this.tx, r.width, this.dw);
    this.ty = axis(this.ty, r.height, this.dh);
  }
  apply() {
    this.clamp();
    this.layer.style.transform = `translate(${-this.tx}px, ${-this.ty}px) scale(${this.s})`;
    this.updateSplit();
  }
  zoomAt(cx, cy, f) {
    const r = this.layer.getBoundingClientRect();
    const px = (cx - r.left) / this.s, py = (cy - r.top) / this.s; // punto nel sistema del livello
    const ns = Math.min(6, Math.max(1, this.s * f));
    this.tx += px * (ns - this.s); this.ty += py * (ns - this.s);
    this.s = ns;
    this.apply();
  }
  zoomToFace(on) {
    if (!on || !this.face) { this.s = 1; this.tx = 0; this.ty = 0; this.apply(); return; }
    const k = this.dw / this.w;
    const f = this.face, fw = (f.x1 - f.x0) * k, fh = (f.y1 - f.y0) * k;
    const r = this.vp.getBoundingClientRect();
    this.s = Math.min(5, Math.max(1, Math.min(r.width / (fw * 1.35), r.height / (fh * 1.35))));
    const cx = ((f.x0 + f.x1) / 2) * k, cy = ((f.y0 + f.y1) / 2) * k;
    // porta il centro del volto al centro della vista
    this.tx = cx * this.s - this.dw / 2; this.ty = cy * this.s - this.dh / 2;
    this.apply();
  }
  down(e) {
    this.vp.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.split && this.pointers.size === 1 && this.s === 1) this.dragSplit(e);
  }
  move(e) {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    const pts = [...this.pointers.values()];
    if (this.pointers.size === 2) {
      const other = pts.find((p) => p !== prev);
      const d0 = Math.hypot(prev.x - other.x, prev.y - other.y), d1 = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      if (d0 > 0) this.zoomAt((e.clientX + other.x) / 2, (e.clientY + other.y) / 2, d1 / d0);
    } else if (this.split && this.s === 1) {
      this.dragSplit(e);
    } else if (this.s > 1) {
      this.tx -= e.clientX - prev.x; this.ty -= e.clientY - prev.y; this.apply();
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }
  dragSplit(e) {
    const r = this.layer.getBoundingClientRect();
    this.splitPos = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    this.updateSplit();
  }
  setSplit(on) { this.split = on; this.updateSplit(); }
  showOriginal(on) { this.holding = on; this.updateSplit(); }
  updateSplit() {
    const orig = this.canvases[1];
    if (this.holding) { orig.hidden = false; orig.style.clipPath = 'none'; this.line.hidden = true; return; }
    orig.hidden = !this.split; this.line.hidden = !this.split;
    orig.style.clipPath = `inset(0 ${(1 - this.splitPos) * 100}% 0 0)`;
    this.line.style.left = `${this.splitPos * 100}%`;
  }
}
