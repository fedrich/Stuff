// Catena di rendering: dallo stato dei controlli all'immagine finale.
import { geom } from './landmarks.js';
import { buildWarpOps, applyWarps, forwardMap } from './warp.js';
import { buildSkinMask, smoothSkin, ageSkin, drawWrinkles } from './skin.js';
import { applyMakeup, browMask } from './makeup.js';
import { drawBeard } from './beard.js';
import { drawGlasses, recolor, applyBackground, applyFilters } from './extras.js';
import { morphFaces } from './morph.js';
import { makeCanvas, ctx2d, blurCanvas, alphaOf, clamp, smoothstep, rng, mixHex } from './util.js';

export function defaultState() {
  return {
    age: 0, gender: 0, smile: 0,
    retouch: { smooth: 0, eyes: 0, slim: 0, nose: 0, lips: 0, chin: 0, brows: 0 },
    beard: { style: 'none', density: 0.8, color: '#2b1d14' },
    hair: { color: null, strength: 0.85 },
    makeup: {
      lipstick: 0, lipColor: '#b0304a', blush: 0, blushColor: '#e0607a',
      eyeshadow: 0, shadowColor: '#7a4f6e', eyeliner: 0, browDarken: 0,
    },
    glasses: { style: 'none', color: '#141414', sun: false },
    bg: { mode: 'none', color: '#4f7cff', amount: 0.6 },
    filter: { name: 'none', intensity: 1, brightness: 0, contrast: 0, saturation: 0, warmth: 0, vignette: 0, grain: 0, fade: 0 },
    morph: { mode: 'morph', amount: 0.5 },
  };
}

// Combina i cursori "macro" (età, genere) con quelli di ritocco manuale.
export function resolveParams(s) {
  const r = s.retouch;
  const p = {
    smile: s.smile, eyes: r.eyes, slim: r.slim, nose: r.nose, lips: r.lips, chin: r.chin, brows: r.brows,
    smooth: r.smooth, jowl: 0, texture: 0, wrinkles: 0, gray: 0,
    makeup: { ...s.makeup },
    beardStyle: s.beard.style, beardDensity: s.beard.density, beardColor: s.beard.color,
  };
  const old = Math.max(0, s.age), young = Math.max(0, -s.age);
  if (old) {
    p.wrinkles = old;
    p.texture = old * 0.9;
    p.jowl = smoothstep(0.3, 1, old);
    p.gray = smoothstep(0.35, 1, old);
    p.lips -= old * 0.25;
    p.eyes -= old * 0.08;
    p.smooth = Math.max(0, p.smooth - old);
  }
  if (young) {
    const y2 = young * young;
    p.smooth += young * 0.85;
    p.eyes += young * 0.12 + y2 * 0.35;
    p.slim += young * 0.15;
    p.nose += y2 * 0.45;
    p.chin -= y2 * 0.4;
    p.brows += young * 0.15;
    p.lips += young * 0.1;
  }
  const fem = Math.max(0, s.gender), masc = Math.max(0, -s.gender);
  if (fem) {
    p.smooth += fem * 0.55;
    p.eyes += fem * 0.15;
    p.slim += fem * 0.35;
    p.nose += fem * 0.3;
    p.lips += fem * 0.25;
    p.brows += fem * 0.25;
    p.chin -= fem * 0.15;
    const m = p.makeup;
    m.lipstick = Math.max(m.lipstick, fem * 0.4);
    m.blush = Math.max(m.blush, fem * 0.3);
    m.eyeliner = Math.max(m.eyeliner, fem * 0.45);
    m.eyeshadow = Math.max(m.eyeshadow, fem * 0.25);
  }
  if (masc) {
    p.slim -= masc * 0.35;
    p.eyes -= masc * 0.08;
    p.lips -= masc * 0.2;
    p.brows -= masc * 0.15;
    p.chin += masc * 0.12;
    p.texture += masc * 0.25;
    p.makeup.browDarken = Math.max(p.makeup.browDarken, masc * 0.5);
    if (p.beardStyle === 'none') { p.beardStyle = 'stubble'; p.beardDensity = masc; }
  }
  p.smooth = clamp(p.smooth, 0, 1);
  if (p.gray > 0) p.beardColor = mixHex(p.beardColor, '#cfcfcf', p.gray);
  return p;
}

function categoryMask(seg, cat, w, h, blur) {
  const c = makeCanvas(seg.w, seg.h);
  const ctx = ctx2d(c);
  const img = ctx.createImageData(seg.w, seg.h);
  for (let i = 0; i < seg.data.length; i++) {
    if (seg.data[i] === cat) {
      const j = i * 4;
      img.data[j] = img.data[j + 1] = img.data[j + 2] = img.data[j + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const s = makeCanvas(w, h);
  const sctx = ctx2d(s);
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(c, 0, 0, w, h);
  return blurCanvas(s, blur);
}

export function buildAnalysis(img, faces, seg) {
  const w = img.width, h = img.height;
  const a = { img, w, h, faces, seg: !!seg, hairMask: null, hairAlpha: null, bgMask: null, second: null, morphCache: null };
  if (seg) {
    const scale = Math.max(w, h) / 1000;
    a.hairMask = categoryMask(seg, 1, w, h, 1.5 * scale);
    a.hairAlpha = alphaOf(a.hairMask);
    a.bgMask = categoryMask(seg, 0, w, h, 2 * scale);
  }
  return a;
}

function morphStage(a, faces, m) {
  const key = `${m.mode}|${m.amount}|${a.second.id}`;
  if (!a.morphCache || a.morphCache.key !== key) {
    a.morphCache = { key, ...morphFaces(a.img, a.faces[0], a.second.img, a.second.faces[0], m.mode, m.amount) };
  }
  faces[0] = a.morphCache.lm;
  return a.morphCache.canvas;
}

export function render(a, state, out) {
  const { w, h } = a;
  const work = makeCanvas(w, h);
  const ctx = ctx2d(work);
  let faces = a.faces.map((f) => f.slice());
  const useMorph = state.morph.amount > 0 && a.second && a.second.faces.length && faces.length;
  ctx.drawImage(useMorph ? morphStage(a, faces, state.morph) : a.img, 0, 0);

  const p = resolveParams(state);
  const rand = rng(42);

  if (faces.length) {
    const ops = faces.flatMap((lm) => buildWarpOps(geom(lm), p));
    if (ops.length) {
      applyWarps(work, ops);
      faces = faces.map((lm) => lm.map((pt) => forwardMap(pt, ops)));
    }
    const geoms = faces.map(geom);
    const skin = buildSkinMask(geoms, w, h, a.hairMask);
    if (p.smooth > 0.01) smoothSkin(work, skin, p.smooth);
    if (p.texture > 0.01) ageSkin(work, skin, Math.min(1, p.texture));
    if (state.hair.color && a.hairAlpha) recolor(work, a.hairAlpha, state.hair.color, state.hair.strength);
    if (p.gray > 0) {
      if (a.hairAlpha) recolor(work, a.hairAlpha, '#d4d4d4', p.gray * 0.95);
      for (const g of geoms) recolor(work, alphaOf(browMask(w, h, g)), '#cfcfcf', p.gray * 0.7);
    }
    for (const g of geoms) {
      drawWrinkles(work, g, p.wrinkles, skin, rand);
      applyMakeup(work, g, p.makeup);
      if (p.beardStyle !== 'none') drawBeard(work, g, p.beardStyle, p.beardDensity, p.beardColor, rand);
      if (state.glasses.style !== 'none') drawGlasses(work, g, state.glasses.style, state.glasses.color, state.glasses.sun);
    }
  } else if (state.hair.color && a.hairAlpha) {
    recolor(work, a.hairAlpha, state.hair.color, state.hair.strength);
  }
  applyBackground(work, a.bgMask, state.bg);
  applyFilters(work, state.filter);

  out.width = w;
  out.height = h;
  ctx2d(out).drawImage(work, 0, 0);
  return faces;
}
