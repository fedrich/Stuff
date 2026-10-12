// Catalogo degli strumenti. Ogni cursore ha un valore neutro che corrisponde alla foto originale.
// Aggiungere uno strumento = aggiungere una voce qui (e, se serve un nuovo effetto, un parametro nel motore).

const B = (key, label, minLabel, maxLabel) => ({ key, label, min: -1, max: 1, neutral: 0, minLabel, maxLabel });
const U = (key, label, neutral = 0) => ({ key, label, min: 0, max: 1, neutral });

export const SKIN_TOOLS = [
  {
    id: 'tan', label: 'Abbronzatura', icon: 'sun',
    sliders: [B('tan.amount', 'Intensità', 'Più chiara', 'Più abbronzata'), B('tan.undertone', 'Sottotono', 'Freddo', 'Caldo')],
  },
  {
    id: 'freckles', label: 'Lentiggini', icon: 'dots',
    sliders: [U('freckles.amount', 'Quantità'), U('freckles.size', 'Dimensione', 0.5), U('freckles.intensity', 'Intensità', 0.6),
      { ...U('freckles.spread', 'Distribuzione', 0.4), minLabel: 'Naso', maxLabel: 'Guance e fronte' }],
    // Senza quantità le altre regolazioni non hanno effetto: la quantità è il cursore principale.
    primary: 'freckles.amount',
  },
  {
    id: 'texture', label: 'Texture', icon: 'grain',
    sliders: [U('texture.smooth', 'Imperfezioni'), U('texture.even', 'Uniformità'), U('texture.redness', 'Rossori'),
      B('texture.pores', 'Pori e dettaglio', 'Più morbidi', 'Più definiti')],
  },
  {
    id: 'light', label: 'Luce', icon: 'spark',
    sliders: [B('light.brightness', 'Luminosità', 'Più scura', 'Più luminosa'), U('light.radiance', 'Pelle radiosa'),
      B('light.undertone', 'Sottotono', 'Rosato', 'Dorato')],
  },
];

export const TRAIT_TOOLS = [
  {
    id: 'nose', label: 'Naso', icon: 'nose',
    sliders: [B('nose.width', 'Larghezza', 'Più stretto', 'Più largo'), B('nose.tip', 'Punta', 'Più piena', 'Più fine'),
      B('nose.nostrils', 'Narici', 'Più strette', 'Più larghe'), B('nose.length', 'Lunghezza', 'Più corto', 'Più lungo'),
      B('nose.contour', 'Definizione', 'Più morbida', 'Più definita')],
  },
  {
    id: 'cheeks', label: 'Zigomi', icon: 'cheek',
    sliders: [B('cheeks.definition', 'Definizione', 'Più morbidi', 'Più definiti'), B('cheeks.volume', 'Volume', 'Meno pieni', 'Più pieni'),
      B('cheeks.sculpt', 'Scolpitura', 'Meno scolpiti', 'Più scolpiti')],
  },
  {
    id: 'jaw', label: 'Mandibola', icon: 'jaw',
    sliders: [B('jaw.definition', 'Definizione', 'Più morbida', 'Più definita'), B('jaw.width', 'Larghezza', 'Più stretta', 'Più larga'),
      B('chin.length', 'Mento: lunghezza', 'Più corto', 'Più lungo'), B('chin.width', 'Mento: larghezza', 'Più stretto', 'Più largo')],
  },
  {
    id: 'lips', label: 'Labbra', icon: 'lips',
    sliders: [B('lips.volume', 'Volume', 'Più sottili', 'Più piene'), B('lips.ratio', 'Superiore / inferiore', 'Più inferiore', 'Più superiore'),
      B('lips.width', 'Larghezza', 'Più strette', 'Più larghe'), B('lips.define', 'Contorno', 'Più morbido', 'Più definito')],
  },
  {
    id: 'eyes', label: 'Occhi', icon: 'eye',
    sliders: [B('eyes.size', 'Dimensione', 'Più piccoli', 'Più grandi'), B('eyes.shape', 'Forma', 'Più allungati', 'Più aperti'),
      B('eyes.distance', 'Distanza', 'Più vicini', 'Più distanti'), B('eyes.tilt', 'Inclinazione', 'Angolo esterno giù', 'Angolo esterno su'),
      B('eyes.define', 'Definizione dello sguardo', 'Più morbido', 'Più intenso'), B('eyes.periocular', 'Zona perioculare', 'Più segnata', 'Più luminosa')],
  },
  {
    id: 'brows', label: 'Sopracciglia', icon: 'brow',
    sliders: [B('brows.shape', 'Forma (coda)', 'Coda più bassa', 'Coda più alta'), B('brows.thickness', 'Spessore', 'Più sottili', 'Più folte'),
      B('brows.arch', 'Arco', 'Più dritte', 'Più arcuate'), B('brows.position', 'Posizione', 'Più basse', 'Più alte'),
      B('brows.define', 'Definizione', 'Più leggere', 'Più piene')],
  },
  {
    id: 'face', label: 'Viso', icon: 'face',
    sliders: [B('face.width', 'Larghezza', 'Più stretto', 'Più largo'), B('face.proportions', 'Terzo inferiore', 'Più corto', 'Più lungo'),
      B('face.contour', 'Contorni', 'Più morbidi', 'Più definiti')],
  },
];

// Impressioni: trasformazioni coordinate. I valori sono quelli al 100%; l'intensità li scala in modo lineare,
// quindi ogni livello è la stessa trasformazione con una forza diversa.
export const IMPRESSIONS = [
  {
    id: 'naturale', label: 'Naturale', desc: 'Pelle più uniforme, sguardo fresco, lineamenti appena affinati',
    recipe: { 'texture.smooth': 0.4, 'texture.even': 0.4, 'texture.redness': 0.4, 'light.radiance': 0.3, 'eyes.periocular': 0.45,
      'eyes.size': 0.25, 'eyes.define': 0.25, 'brows.define': 0.15, 'lips.volume': 0.2, 'nose.width': -0.2,
      'jaw.width': -0.2, 'cheeks.definition': 0.2, 'face.symmetry': 0.3 },
  },
  {
    id: 'grazioso', label: 'Grazioso', desc: 'Occhi più grandi e luminosi, naso fine, labbra piene, viso affusolato',
    recipe: { 'eyes.size': 0.55, 'eyes.tilt': 0.45, 'eyes.define': 0.5, 'eyes.periocular': 0.5,
      'brows.arch': 0.5, 'brows.shape': 0.3, 'brows.define': 0.35, 'nose.width': -0.6, 'nose.tip': 0.55, 'nose.nostrils': -0.3,
      'lips.volume': 0.5, 'lips.define': 0.45, 'jaw.width': -0.6, 'chin.width': -0.45, 'chin.length': 0.1, 'face.width': -0.35,
      'cheeks.volume': 0.3, 'texture.smooth': 0.5, 'texture.even': 0.5, 'texture.redness': 0.45, 'light.radiance': 0.35, 'face.symmetry': 0.4 },
  },
  {
    id: 'delicato', label: 'Delicato', desc: 'Contorni morbidi, viso più sottile, tratti gentili',
    recipe: { 'texture.smooth': 0.55, 'texture.even': 0.45, 'face.width': -0.55, 'jaw.width': -0.6, 'chin.width': -0.45, 'chin.length': -0.2,
      'eyes.size': 0.4, 'eyes.shape': 0.2, 'nose.width': -0.45, 'nose.tip': 0.4, 'lips.volume': 0.3, 'brows.arch': 0.25, 'brows.thickness': -0.2,
      'light.radiance': 0.4, 'face.contour': -0.3, 'eyes.periocular': 0.4 },
  },
  {
    id: 'definito', label: 'Definito', desc: 'Zigomi e mandibola scolpiti, sguardo più deciso',
    recipe: { 'cheeks.definition': 0.8, 'cheeks.sculpt': 0.6, 'jaw.definition': 0.9, 'face.contour': 0.6, 'nose.contour': 0.5,
      'nose.width': -0.35, 'jaw.width': -0.25, 'brows.thickness': 0.3, 'brows.define': 0.4, 'brows.position': -0.2, 'eyes.shape': -0.25,
      'eyes.tilt': 0.3, 'eyes.define': 0.45, 'lips.define': 0.3, 'texture.pores': 0.3, 'texture.even': 0.25 },
  },
  {
    id: 'radioso', label: 'Radioso', desc: 'Luce, incarnato uniforme e sguardo riposato',
    recipe: { 'light.radiance': 0.7, 'light.brightness': 0.2, 'texture.even': 0.6, 'texture.redness': 0.55, 'texture.smooth': 0.4,
      'eyes.periocular': 0.8, 'eyes.define': 0.3, 'light.undertone': 0.25, 'eyes.size': 0.2, 'expr.smile': 0.2, 'lips.volume': 0.15 },
  },
  {
    id: 'sofisticato', label: 'Sofisticato', desc: 'Zigomi alti, naso affinato, sguardo allungato, sopracciglia arcuate',
    recipe: { 'cheeks.definition': 0.55, 'cheeks.volume': 0.35, 'nose.width': -0.45, 'nose.tip': 0.5, 'nose.contour': 0.4,
      'brows.arch': 0.55, 'brows.shape': 0.4, 'brows.define': 0.35, 'eyes.shape': -0.3, 'eyes.tilt': 0.55, 'eyes.define': 0.45,
      'lips.ratio': 0.3, 'lips.define': 0.4, 'jaw.definition': 0.45, 'jaw.width': -0.3, 'texture.smooth': 0.35, 'texture.even': 0.35 },
  },
  {
    id: 'armonioso', label: 'Armonioso', desc: 'Più simmetria ed equilibrio tra le proporzioni',
    recipe: { 'face.symmetry': 1, 'texture.even': 0.5, 'texture.smooth': 0.3, 'texture.redness': 0.35, 'eyes.size': 0.15,
      'lips.volume': 0.15, 'nose.width': -0.2, 'jaw.width': -0.2, 'light.radiance': 0.25, 'eyes.periocular': 0.3 },
  },
  {
    id: 'espressivo', label: 'Espressivo', desc: 'Occhi più aperti, labbra piene, espressione vivace',
    recipe: { 'eyes.size': 0.45, 'eyes.shape': 0.35, 'eyes.define': 0.5, 'brows.arch': 0.4, 'brows.position': 0.2, 'brows.define': 0.3,
      'lips.volume': 0.5, 'lips.define': 0.35, 'cheeks.volume': 0.4, 'expr.smile': 0.4, 'light.radiance': 0.35, 'eyes.periocular': 0.4 },
  },
];

export const ALL_SLIDERS = [...SKIN_TOOLS, ...TRAIT_TOOLS].flatMap((t) => t.sliders);

export function neutralValues() {
  return Object.fromEntries(ALL_SLIDERS.map((s) => [s.key, s.neutral]));
}

// Stato dell'editor -> parametri del motore.
// Le impressioni si sommano alle regolazioni manuali. I parametri "a magnitudine" (lentiggini) non si sommano.
export function resolveParams(state) {
  const p = { ...state.values };
  const imp = IMPRESSIONS.find((i) => i.id === state.impression?.id);
  if (imp) {
    const a = state.impression.amount;
    for (const [k, v] of Object.entries(imp.recipe)) p[k] = (p[k] || 0) + v * a;
  }
  for (const k of Object.keys(p)) if (!k.startsWith('freckles.')) p[k] = Math.max(-1.5, Math.min(1.5, p[k]));
  return p;
}
