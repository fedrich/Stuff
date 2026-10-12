// Interfaccia dell'editor. Tiene separati: stato e cronologia (qui), gestione foto (photo.js),
// motore fotografico (../engine) e modelli di visione (../vision.js).
import { initVision, detectFaces, segment } from '../vision.js';
import { Engine } from '../engine/engine.js';
import { SKIN_TOOLS, TRAIT_TOOLS, IMPRESSIONS, neutralValues, resolveParams } from './tools.js';
import { loadPhoto, fromVideo } from './photo.js';
import { History } from './history.js';
import { Viewer } from './viewer.js';
import { exportPhoto } from './export.js';

const $ = (id) => document.getElementById(id);
const ICONS = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  dots: '<circle cx="8" cy="9" r="1.2"/><circle cx="13" cy="7.5" r="1"/><circle cx="16" cy="11" r="1.3"/><circle cx="10" cy="13.5" r="1"/><circle cx="14" cy="15.5" r="1.1"/><circle cx="7.5" cy="16" r=".9"/>',
  grain: '<path d="M4 12c3-6 13-6 16 0-3 6-13 6-16 0z"/><path d="M9 11h.01M12 13h.01M15 11h.01"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17l.7 1.8L21.5 19.5l-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z"/>',
  nose: '<path d="M12 4c0 5-3 8-3 11a3 3 0 0 0 3 2 3 3 0 0 0 3-2"/><path d="M8 17c-1.5 0-2-1.2-1.4-2M16 17c1.5 0 2-1.2 1.4-2"/>',
  cheek: '<path d="M6 4c-2 6-1 12 6 16 7-4 8-10 6-16"/><path d="M8 13c1.5-1 3-1 4.5 0"/>',
  jaw: '<path d="M5 6c0 7 3 12 7 14 4-2 7-7 7-14"/>',
  lips: '<path d="M3 12c3-4 6-4 9-2 3-2 6-2 9 2-3 4-6 5-9 5s-6-1-9-5z"/><path d="M3 12h18"/>',
  eye: '<path d="M2 12c4-6 16-6 20 0-4 6-16 6-20 0z"/><circle cx="12" cy="12" r="3"/>',
  brow: '<path d="M3 14c4-5 10-6 18-3"/><path d="M4 16c4-4 10-5 16-2"/>',
  face: '<path d="M12 3c-4.5 0-7 3.6-7 8.5C5 17 8.4 21 12 21s7-4 7-9.5C19 6.6 16.5 3 12 3z"/>',
  none: '<circle cx="12" cy="12" r="8"/><path d="M6.5 17.5l11-11"/>',
};
const RESET_ICON = '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/></svg>';

// ---------- Stato ----------

const initialState = () => ({ impression: { id: null, amount: 0.5 }, values: neutralValues() });
let state = initialState();
const history = new History(state);
let cat = 'impressions';
let toolId = null; // strumento aperto
let photo = null;  // { full, preview, lm, seg }
let engine = null;
let viewer = null;
let visionOk = false;

const visionReady = initVision((m) => setLoadStatus(m))
  .then(() => { visionOk = true; setLoadStatus(''); })
  .catch((e) => { console.error(e); setLoadStatus('Modelli IA non disponibili: serve una connessione al primo avvio.', true); });

function setLoadStatus(msg, err = false) { const el = $('loadStatus'); el.textContent = msg || ''; el.classList.toggle('error', err); }
function setStatus(msg, err = false) { const el = $('status'); el.textContent = msg || ''; el.classList.toggle('error', err); }

const clone = (s) => JSON.parse(JSON.stringify(s));
function commit() {
  history.push(state);
  updateHistoryButtons();
  renderStrip();
  renderPanel(); // aggiorna lo stato dei pulsanti Annulla / Ripristina
}
function updateHistoryButtons() {
  $('undoBtn').disabled = !history.canUndo();
  $('redoBtn').disabled = !history.canRedo();
}
function applyState(s) {
  state = clone(s);
  scheduleRender();
  renderStrip();
  renderPanel();
}

// ---------- Rendering ----------

let pending = false;
function scheduleRender() {
  if (pending || !engine) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    try { engine.render(resolveParams(state)); } catch (e) { console.error(e); setStatus('Errore del motore: ' + e.message, true); }
  });
}

// ---------- Foto ----------

async function openPhoto(source) {
  setLoadStatus('Preparazione della foto…');
  let p;
  try { p = await loadPhoto(source); } catch (e) { setLoadStatus(e.message, true); return; }
  await visionReady;
  setLoadStatus('Analisi del volto…');
  await new Promise((r) => setTimeout(r, 20));
  let faces = [], seg = null;
  if (visionOk) {
    try { faces = detectFaces(p.preview); } catch (e) { console.error(e); }
    try { seg = segment(p.preview); } catch (e) { console.error(e); }
  }
  photo = { ...p, lm: faces[0] || null, seg, faces: faces.length };
  if (!engine) {
    try { engine = new Engine($('glCanvas')); } catch (e) { setLoadStatus(e.message, true); return; }
  }
  try { engine.setImage(p.preview, photo.lm, seg); } catch (e) { console.error(e); setLoadStatus('Errore: ' + e.message, true); return; }
  $('empty').hidden = true;
  $('viewport').hidden = false;
  $('exportBtn').disabled = false;
  const oc = $('origCanvas');
  oc.width = p.preview.width; oc.height = p.preview.height;
  oc.getContext('2d').drawImage(p.preview, 0, 0);
  if (!viewer) viewer = new Viewer($('viewport'), $('zoomLayer'), [$('glCanvas'), oc], $('splitLine'));
  viewer.setSize(p.preview.width, p.preview.height, faceBox());
  state = initialState();
  history.reset(state);
  updateHistoryButtons();
  if (!photo.lm) setStatus('Nessun volto rilevato: prova un ritratto frontale, ben illuminato e senza ostruzioni.', true);
  else setStatus(photo.faces > 1 ? 'Più volti trovati: modifico quello più grande.' : '');
  thumbs = {};
  renderStrip();
  renderPanel();
  scheduleRender();
  setTimeout(buildThumbs, 60);
}

function faceBox() {
  if (!photo?.lm) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const q of photo.lm) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
  return { x0, y0, x1, y1 };
}

// Anteprime delle impressioni (al 75%) ritagliate sul volto.
let thumbs = {};
function buildThumbs() {
  if (!engine || !photo?.lm) return;
  const b = faceBox();
  const size = Math.max(b.x1 - b.x0, b.y1 - b.y0) * 1.25;
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const make = (params) => {
    const snap = engine.snapshot(params);
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    c.getContext('2d').drawImage(snap, cx - size / 2, cy - size / 2, size, size, 0, 0, 128, 128);
    return c.toDataURL('image/jpeg', 0.8);
  };
  thumbs.none = make({});
  let i = 0;
  const next = () => {
    if (i >= IMPRESSIONS.length) { scheduleRender(); return; }
    const imp = IMPRESSIONS[i++];
    thumbs[imp.id] = make(resolveParams({ values: {}, impression: { id: imp.id, amount: 0.75 } }));
    renderStrip();
    setTimeout(next, 0);
  };
  next();
  scheduleRender();
}

// ---------- Pannello strumenti ----------

const tools = () => (cat === 'skin' ? SKIN_TOOLS : cat === 'traits' ? TRAIT_TOOLS : null);
const isActive = (t) => t.sliders.some((s) => Math.abs(state.values[s.key] - s.neutral) > 1e-6 && (!t.primary || state.values[t.primary] > 0));

function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) if (c != null && c !== false) e.append(c);
  return e;
}

function renderStrip() {
  const strip = $('toolStrip');
  const items = [];
  if (cat === 'impressions') {
    const opts = [{ id: null, label: 'Nessuna' }, ...IMPRESSIONS];
    for (const imp of opts) {
      const key = imp.id || 'none';
      const pressed = state.impression.id === imp.id;
      items.push(el('button', { class: 'tool', type: 'button', 'aria-pressed': String(pressed),
        onclick: () => {
          if (state.impression.id === imp.id) return;
          state.impression = { id: imp.id, amount: imp.id ? (state.impression.amount || 0.5) : state.impression.amount };
          commit(); renderPanel(); scheduleRender();
        } }, [
        el('div', { class: 'thumb' }, thumbs[key] ? el('img', { src: thumbs[key], alt: '' }) : el('span', { html: `<svg viewBox="0 0 24 24">${ICONS[imp.id ? 'face' : 'none']}</svg>` })),
        el('span', {}, imp.label),
      ]));
    }
  } else {
    for (const t of tools()) {
      items.push(el('button', { class: 'tool', type: 'button', 'aria-pressed': String(toolId === t.id),
        onclick: () => { toolId = t.id; renderStrip(); renderPanel(); } }, [
        el('div', { class: 'thumb', html: `<svg viewBox="0 0 24 24">${ICONS[t.icon]}</svg>` + (isActive(t) ? '<i class="dot"></i>' : '') }),
        el('span', {}, t.label),
      ]));
    }
  }
  const scroll = strip.scrollLeft;
  strip.replaceChildren(...items);
  strip.scrollLeft = scroll;
}

function slider({ key, label, min, max, neutral, minLabel, maxLabel, value, onInput, onCommit, onReset, percent }) {
  const fmt = (v) => percent ? `${Math.round(v * 100)}%` : (min < 0 ? (v > 0 ? '+' : '') + Math.round(v * 100) : Math.round(v * 100));
  const out = el('output', {}, fmt(value));
  const reset = el('button', { class: 'reset', type: 'button', title: 'Ripristina', 'aria-label': `Ripristina ${label}`, html: RESET_ICON,
    disabled: Math.abs(value - neutral) < 1e-6, onclick: onReset });
  const input = el('input', { type: 'range', min, max, step: 0.01, value, id: `s-${key}`, 'aria-label': label,
    oninput: (e) => { const v = parseFloat(e.target.value); out.textContent = fmt(v); reset.disabled = Math.abs(v - neutral) < 1e-6; onInput(v); },
    onchange: () => onCommit(),
    ondblclick: () => onReset(),
  });
  return el('div', { class: 'slider' }, [
    el('div', { class: 'slider-top' }, [el('label', { for: `s-${key}` }, label), out, reset]),
    el('div', { class: 'range' }, input),
    percent ? el('div', { class: 'ticks' }, ['0', '25', '50', '75', '100'].map((t) => el('span', {}, t))) : null,
    (minLabel || maxLabel) ? el('div', { class: 'ends' }, [el('span', {}, minLabel || ''), el('span', {}, maxLabel || '')]) : null,
  ]);
}

// "Annulla" di uno strumento: riporta i suoi valori all'ultima versione diversa nella cronologia.
function undoTool(keys) {
  const prev = history.previousFor((s) => JSON.stringify(keys.map((k) => k === '#imp' ? s.impression : s.values[k])), state);
  if (!prev) return;
  for (const k of keys) {
    if (k === '#imp') state.impression = clone(prev.impression);
    else state.values[k] = prev.values[k];
  }
  commit(); renderPanel(); scheduleRender();
}

function renderPanel() {
  const panel = $('toolPanel');
  const parts = [];
  const noFace = photo && !photo.lm;
  if (cat === 'impressions') {
    const imp = IMPRESSIONS.find((i) => i.id === state.impression.id);
    parts.push(el('div', { class: 'panel-head' }, [
      el('h2', {}, imp ? imp.label : 'Impressioni'),
      el('button', { class: 'mini', type: 'button', disabled: !history.previousFor((s) => JSON.stringify(s.impression), state), onclick: () => undoTool(['#imp']) }, 'Annulla'),
      el('button', { class: 'mini', type: 'button', disabled: !imp, onclick: () => { state.impression = { id: null, amount: 0.5 }; commit(); renderPanel(); scheduleRender(); } }, 'Ripristina'),
    ]));
    parts.push(el('p', { class: 'desc' }, imp ? imp.desc : 'Trasformazioni coordinate di più tratti. Scegli uno stile e regolane l’intensità.'));
    if (imp) {
      parts.push(slider({ key: 'impression', label: 'Intensità', min: 0, max: 1, neutral: 0, value: state.impression.amount, percent: true,
        onInput: (v) => { state.impression.amount = v; scheduleRender(); },
        onCommit: () => commit(),
        onReset: () => { state.impression.amount = 0; commit(); renderPanel(); scheduleRender(); } }));
      parts.push(el('p', { class: 'note' }, 'Le impressioni si sommano alle regolazioni di Pelle e Tratti.'));
    }
  } else {
    const list = tools();
    const t = list.find((x) => x.id === toolId) || list[0];
    toolId = t.id;
    const keys = t.sliders.map((s) => s.key);
    const changed = t.sliders.some((s) => Math.abs(state.values[s.key] - s.neutral) > 1e-6);
    parts.push(el('div', { class: 'panel-head' }, [
      el('h2', {}, t.label),
      el('button', { class: 'mini', type: 'button', disabled: !history.previousFor((s) => JSON.stringify(keys.map((k) => s.values[k])), state), onclick: () => undoTool(keys) }, 'Annulla'),
      el('button', { class: 'mini', type: 'button', disabled: !changed, onclick: () => { t.sliders.forEach((s) => { state.values[s.key] = s.neutral; }); commit(); renderPanel(); scheduleRender(); } }, 'Ripristina'),
    ]));
    for (const s of t.sliders) {
      parts.push(slider({ ...s, value: state.values[s.key],
        onInput: (v) => { state.values[s.key] = v; scheduleRender(); },
        onCommit: () => commit(),
        onReset: () => { state.values[s.key] = s.neutral; commit(); renderPanel(); scheduleRender(); } }));
    }
  }
  if (noFace) parts.push(el('p', { class: 'note status error' }, 'Nessun volto rilevato in questa foto: gli strumenti non hanno effetto.'));
  const scroll = panel.scrollTop;
  panel.replaceChildren(...parts);
  panel.scrollTop = scroll;
}

$('cats').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-cat]');
  if (!b) return;
  cat = b.dataset.cat;
  toolId = null;
  for (const x of $('cats').children) x.setAttribute('aria-selected', String(x === b));
  renderStrip(); renderPanel();
});

// ---------- Cronologia ----------

$('undoBtn').addEventListener('click', () => { const s = history.undo(); if (s) { applyState(s); updateHistoryButtons(); } });
$('redoBtn').addEventListener('click', () => { const s = history.redo(); if (s) { applyState(s); updateHistoryButtons(); } });
$('resetAllBtn').addEventListener('click', () => { state = initialState(); commit(); renderPanel(); scheduleRender(); });
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); $(e.shiftKey ? 'redoBtn' : 'undoBtn').click(); }
});

// ---------- Confronto e zoom ----------

const hold = $('holdBtn');
const showBefore = (on) => { viewer?.showOriginal(on); $('beforeBadge').hidden = !on; };
hold.addEventListener('pointerdown', (e) => { e.preventDefault(); showBefore(true); });
for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) hold.addEventListener(ev, () => showBefore(false));
$('splitBtn').addEventListener('click', () => {
  const on = $('splitBtn').getAttribute('aria-pressed') !== 'true';
  $('splitBtn').setAttribute('aria-pressed', String(on));
  viewer?.setSplit(on);
});
$('zoomBtn').addEventListener('click', () => {
  const on = $('zoomBtn').getAttribute('aria-pressed') !== 'true';
  $('zoomBtn').setAttribute('aria-pressed', String(on));
  viewer?.zoomToFace(on);
});

// ---------- Caricamento ----------

$('file').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) openPhoto(f); });
$('newBtn').addEventListener('click', () => $('file').click());
const stage = $('stage');
stage.addEventListener('dragover', (e) => e.preventDefault());
stage.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) openPhoto(f); });
window.addEventListener('paste', (e) => {
  const it = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
  if (it) openPhoto(it.getAsFile());
});

let stream = null;
$('camBtn').addEventListener('click', async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
    $('video').srcObject = stream;
    $('camDialog').showModal();
  } catch (e) { setLoadStatus('Fotocamera non disponibile: ' + e.message, true); }
});
const closeCam = () => { stream?.getTracks().forEach((t) => t.stop()); stream = null; if ($('camDialog').open) $('camDialog').close(); };
$('camClose').addEventListener('click', closeCam);
$('camDialog').addEventListener('close', closeCam);
$('snapBtn').addEventListener('click', () => { const c = fromVideo($('video')); closeCam(); openPhoto(c); });

// ---------- Esportazione ----------

let exporting = false;
$('exportBtn').addEventListener('click', async () => {
  if (exporting || !photo) return;
  exporting = true;
  $('exportBtn').disabled = true;
  $('progress').hidden = false;
  $('progressText').textContent = 'Esportazione in alta qualità…';
  try {
    await exportPhoto(photo, resolveParams(state));
    setStatus('Foto salvata ✓');
  } catch (e) {
    console.error(e);
    setStatus('Esportazione non riuscita: ' + e.message, true);
  } finally {
    exporting = false;
    $('exportBtn').disabled = false;
    $('progress').hidden = true;
  }
});

renderStrip();
renderPanel();

// Interfaccia di test e debug (usata dai test automatici).
window.studio = {
  get engine() { return engine; }, get photo() { return photo; },
  getState: () => clone(state), setState: (s) => { state = clone(s); commit(); renderPanel(); scheduleRender(); },
  resolveParams, IMPRESSIONS, SKIN_TOOLS, TRAIT_TOOLS, openPhoto,
};
