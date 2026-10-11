import { initVision, detectFaces, segment } from './vision.js';
import { render, defaultState, buildAnalysis } from './pipeline.js';
import { TABS } from './controls.js';
import { makeCanvas, ctx2d } from './util.js';

const MAX_SIDE = 1280;
const $ = (id) => document.getElementById(id);
const out = $('out'), orig = $('orig');

let state = defaultState();
let analysis = null;
let currentTab = TABS[0].id;
let visionOk = false;

const visionReady = initVision(setStatus)
  .then(() => { visionOk = true; setStatus(analysis ? '' : 'Pronto. Carica una foto per iniziare.'); })
  .catch((e) => {
    console.error(e);
    setStatus('Impossibile caricare i modelli IA (serve una connessione la prima volta). Restano disponibili filtri e regolazioni.', true);
  });

function setStatus(msg, error = false) {
  const el = $('status');
  el.textContent = msg || '';
  el.classList.toggle('error', !!error);
}

// ---------- Stato ----------

const getPath = (path) => path.split('.').reduce((o, k) => o[k], state);
function setPath(path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => o[k], state)[last] = value;
}

// ---------- Caricamento immagini ----------

function fileToCanvas(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(toCanvas(img, img.naturalWidth, img.naturalHeight));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Formato immagine non supportato')); };
    img.src = url;
  });
}

function toCanvas(src, sw, sh, mirror = false) {
  const k = Math.min(1, MAX_SIDE / Math.max(sw, sh));
  const c = makeCanvas(sw * k, sh * k);
  const ctx = ctx2d(c);
  if (mirror) { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

async function openImage(canvas) {
  $('empty').hidden = true;
  $('viewer').hidden = false;
  $('tools').hidden = false;
  $('downloadBtn').disabled = false;
  orig.width = canvas.width; orig.height = canvas.height;
  ctx2d(orig).drawImage(canvas, 0, 0);
  out.width = canvas.width; out.height = canvas.height;
  ctx2d(out).drawImage(canvas, 0, 0);
  setStatus('Analisi del volto…');
  await visionReady;
  await new Promise((r) => setTimeout(r, 30));
  let faces = [], seg = null;
  if (visionOk) {
    try { faces = detectFaces(canvas); } catch (e) { console.error(e); }
    try { seg = segment(canvas); } catch (e) { console.error(e); }
  }
  const second = analysis?.second || null;
  analysis = buildAnalysis(canvas, faces, seg);
  analysis.second = second;
  if (!visionOk) setStatus('Modelli IA non disponibili: puoi usare solo filtri e regolazioni.', true);
  else if (!faces.length) setStatus('Nessun volto rilevato: disponibili sfondo, capelli e filtri. Prova una foto frontale e ben illuminata.', true);
  else setStatus(faces.length === 1 ? 'Volto rilevato ✓' : `${faces.length} volti rilevati ✓`);
  renderTab();
  scheduleRender();
}

async function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  try {
    await openImage(await fileToCanvas(file));
  } catch (e) {
    setStatus(e.message, true);
  }
}

async function loadSecond(file) {
  if (!file || !analysis) return;
  setStatus('Analisi del secondo volto…');
  const c = await fileToCanvas(file);
  await visionReady;
  const faces = visionOk ? detectFaces(c) : [];
  if (!faces.length) {
    setStatus('Nessun volto trovato nella seconda foto.', true);
    return;
  }
  analysis.second = { img: c, faces, id: Date.now(), thumb: c.toDataURL('image/jpeg', 0.7) };
  analysis.morphCache = null;
  setStatus('Secondo volto pronto ✓');
  renderTab();
  scheduleRender();
}

// ---------- Rendering ----------

let pending = false, busy = false;
function scheduleRender() {
  pending = true;
  if (!busy) requestAnimationFrame(doRender);
}
function doRender() {
  if (!pending || !analysis) return;
  pending = false;
  busy = true;
  try {
    render(analysis, state, out);
  } catch (e) {
    console.error(e);
    setStatus('Errore durante l\'elaborazione: ' + e.message, true);
  }
  busy = false;
  if (pending) requestAnimationFrame(doRender);
}

// ---------- Pannello controlli ----------

function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) if (c != null && c !== false && c !== '') e.append(c);
  return e;
}

function presetActive(set) {
  return Object.entries(set).every(([k, v]) => {
    const cur = getPath(k);
    return typeof v === 'number' ? Math.abs(cur - v) < 1e-6 : cur === v;
  });
}

function changed(rebuild = false) {
  if (rebuild) renderTab();
  scheduleRender();
}

const builders = {
  note: (c) => el('p', { class: 'hint' }, c.text),
  presets: (c) => el('div', { class: 'group' }, [
    c.label && el('div', { class: 'group-label' }, c.label),
    el('div', { class: 'chips' }, c.options.map((o) => el('button', {
      class: 'chip' + (presetActive(o.set) ? ' active' : ''), type: 'button',
      onclick: () => { Object.entries(o.set).forEach(([k, v]) => setPath(k, v)); changed(true); },
    }, o.label))),
  ]),
  chips: (c) => el('div', { class: 'group' }, [
    c.label && el('div', { class: 'group-label' }, c.label),
    el('div', { class: 'chips' }, c.options.map((o) => el('button', {
      class: 'chip' + (getPath(c.key) === o.value ? ' active' : ''), type: 'button',
      onclick: () => { setPath(c.key, o.value); changed(true); },
    }, o.label))),
  ]),
  slider: (c) => {
    const fmt = (v) => (c.percent === false ? v.toFixed(2) : `${Math.round(v * 100)}`);
    const output = el('output', {}, fmt(getPath(c.key)));
    const input = el('input', {
      type: 'range', min: c.min ?? 0, max: c.max ?? 1, step: c.step ?? 0.01, value: getPath(c.key), 'aria-label': c.label,
      oninput: (e) => { const v = parseFloat(e.target.value); setPath(c.key, v); output.textContent = fmt(v); changed(c.rebuild); },
      ondblclick: (e) => { const v = c.reset ?? 0; e.target.value = v; setPath(c.key, v); output.textContent = fmt(v); changed(true); },
    });
    return el('div', { class: 'slider' }, [
      el('div', { class: 'slider-top' }, [el('span', {}, c.label), output]),
      input,
      (c.minLabel || c.maxLabel) && el('div', { class: 'slider-ends' }, [el('span', {}, c.minLabel || ''), el('span', {}, c.maxLabel || '')]),
    ]);
  },
  swatches: (c) => el('div', { class: 'group' }, [
    c.label && el('div', { class: 'group-label' }, c.label),
    el('div', { class: 'swatches' }, [
      ...c.options.map((o) => el('button', {
        class: 'swatch' + (o.value === null ? ' none' : '') + (getPath(c.key) === o.value ? ' active' : ''),
        type: 'button', title: o.label, 'aria-label': o.label,
        style: o.value ? `background:${o.value}` : undefined,
        onclick: () => { setPath(c.key, o.value); changed(true); },
      })),
      c.custom && el('input', {
        type: 'color', title: 'Colore personalizzato', 'aria-label': 'Colore personalizzato', value: getPath(c.key) || '#888888',
        oninput: (e) => { setPath(c.key, e.target.value); changed(); },
      }),
    ]),
  ]),
  toggle: (c) => el('label', { class: 'toggle' }, [
    el('input', { type: 'checkbox', checked: !!getPath(c.key), onchange: (e) => { setPath(c.key, e.target.checked); changed(); } }),
    c.label,
  ]),
  secondPhoto: () => el('div', { class: 'group' }, [
    analysis?.second?.thumb && el('img', { class: 'thumb', src: analysis.second.thumb, alt: 'Secondo volto' }),
    el('button', { class: 'btn', type: 'button', disabled: !analysis, onclick: () => $('file2').click() },
      analysis?.second ? 'Cambia seconda foto' : 'Carica seconda foto'),
  ]),
};

function renderTabs() {
  const nav = $('tabs');
  nav.replaceChildren(...TABS.map((t) => el('button', {
    class: 'tab', role: 'tab', type: 'button', 'aria-selected': String(t.id === currentTab),
    onclick: () => { currentTab = t.id; renderTabs(); renderTab(); },
  }, t.label)));
}

function renderTab() {
  const tab = TABS.find((t) => t.id === currentTab);
  const body = $('tabBody');
  const scroll = body.scrollTop;
  const needsFace = tab.face && analysis && !analysis.faces.length;
  body.replaceChildren(...[
    el('h3', {}, tab.title || tab.label),
    tab.hint && el('p', { class: 'hint' }, tab.hint),
    needsFace && el('p', { class: 'hint status error' }, 'Questa funzione richiede un volto rilevato.'),
    ...tab.controls.map((c) => builders[c.type](c)),
  ].filter(Boolean));
  body.scrollTop = scroll;
}

// ---------- Confronto prima/dopo ----------

let split = false, splitPos = 0.5;
function updateSplit() {
  orig.hidden = !split;
  $('handle').hidden = !split;
  orig.style.clipPath = `inset(0 ${(1 - splitPos) * 100}% 0 0)`;
  $('handle').style.left = `${splitPos * 100}%`;
}
$('splitBtn').addEventListener('click', () => {
  split = !split;
  $('splitBtn').setAttribute('aria-pressed', String(split));
  updateSplit();
});
$('wrap').addEventListener('pointerdown', (e) => {
  if (!split) return;
  const move = (ev) => {
    const r = $('wrap').getBoundingClientRect();
    splitPos = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
    updateSplit();
  };
  move(e);
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
});
const hold = $('holdBtn');
const showOrig = (on) => {
  if (on) { orig.hidden = false; orig.style.clipPath = 'none'; $('handle').hidden = true; } else updateSplit();
};
hold.addEventListener('pointerdown', () => showOrig(true));
for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) hold.addEventListener(ev, () => showOrig(false));

$('resetBtn').addEventListener('click', () => { state = defaultState(); changed(true); });

// ---------- Input file, trascinamento, incolla ----------

$('file').addEventListener('change', (e) => { loadFile(e.target.files[0]); e.target.value = ''; });
$('file2').addEventListener('change', (e) => { loadSecond(e.target.files[0]); e.target.value = ''; });
const stage = $('stage');
stage.addEventListener('dragover', (e) => { e.preventDefault(); stage.classList.add('drag'); });
stage.addEventListener('dragleave', () => stage.classList.remove('drag'));
stage.addEventListener('drop', (e) => {
  e.preventDefault();
  stage.classList.remove('drag');
  loadFile(e.dataTransfer.files[0]);
});
window.addEventListener('paste', (e) => {
  const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
  if (item) loadFile(item.getAsFile());
});

// ---------- Scarica ----------

$('downloadBtn').addEventListener('click', () => {
  out.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `facefree-${Date.now()}.jpg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/jpeg', 0.93);
});

// ---------- Fotocamera ----------

let stream = null;
async function openCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
    $('video').srcObject = stream;
    $('camDialog').showModal();
  } catch (e) {
    setStatus('Fotocamera non disponibile: ' + e.message, true);
  }
}
function closeCamera() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  if ($('camDialog').open) $('camDialog').close();
}
$('camBtn').addEventListener('click', openCamera);
$('camBtn2').addEventListener('click', openCamera);
$('camClose').addEventListener('click', closeCamera);
$('camDialog').addEventListener('close', closeCamera);
$('snapBtn').addEventListener('click', () => {
  const v = $('video');
  const c = toCanvas(v, v.videoWidth, v.videoHeight, true);
  closeCamera();
  openImage(c);
});

renderTabs();
renderTab();
