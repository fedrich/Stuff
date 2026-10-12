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
      B('lips.width', 'Larghezza', 'Più strette', 'Più larghe')],
  },
  {
    id: 'eyes', label: 'Occhi', icon: 'eye',
    sliders: [B('eyes.size', 'Dimensione', 'Più piccoli', 'Più grandi'), B('eyes.shape', 'Forma', 'Più allungati', 'Più aperti'),
      B('eyes.distance', 'Distanza', 'Più vicini', 'Più distanti'), B('eyes.periocular', 'Zona perioculare', 'Più segnata', 'Più luminosa')],
  },
  {
    id: 'brows', label: 'Sopracciglia', icon: 'brow',
    sliders: [B('brows.shape', 'Forma (coda)', 'Coda più bassa', 'Coda più alta'), B('brows.thickness', 'Spessore', 'Più sottili', 'Più folte'),
      B('brows.arch', 'Arco', 'Più dritte', 'Più arcuate'), B('brows.position', 'Posizione', 'Più basse', 'Più alte')],
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
    id: 'naturale', label: 'Naturale', desc: 'Pelle più uniforme e lineamenti appena più freschi',
    recipe: { 'texture.smooth': 0.35, 'texture.even': 0.35, 'texture.redness': 0.35, 'light.radiance': 0.3, 'eyes.periocular': 0.35,
      'eyes.size': 0.12, 'lips.volume': 0.12, 'cheeks.definition': 0.15, 'face.symmetry': 0.2 },
  },
  {
    id: 'delicato', label: 'Delicato', desc: 'Contorni morbidi, viso più sottile, tratti gentili',
    recipe: { 'texture.smooth': 0.5, 'texture.even': 0.4, 'face.width': -0.35, 'jaw.width': -0.4, 'chin.width': -0.3, 'chin.length': -0.15,
      'eyes.size': 0.25, 'nose.width': -0.3, 'nose.tip': 0.3, 'lips.volume': 0.2, 'brows.arch': 0.2, 'brows.thickness': -0.15,
      'light.radiance': 0.35, 'face.contour': -0.3 },
  },
  {
    id: 'definito', label: 'Definito', desc: 'Zigomi e mandibola scolpiti, sguardo più deciso',
    recipe: { 'cheeks.definition': 0.7, 'cheeks.sculpt': 0.5, 'jaw.definition': 0.8, 'face.contour': 0.6, 'nose.contour': 0.5,
      'nose.width': -0.2, 'brows.thickness': 0.25, 'brows.position': -0.15, 'eyes.shape': -0.2, 'texture.pores': 0.3, 'texture.even': 0.2 },
  },
  {
    id: 'radioso', label: 'Radioso', desc: 'Luce, incarnato uniforme e sguardo riposato',
    recipe: { 'light.radiance': 0.6, 'light.brightness': 0.15, 'texture.even': 0.55, 'texture.redness': 0.5, 'texture.smooth': 0.35,
      'eyes.periocular': 0.7, 'light.undertone': 0.25, 'eyes.size': 0.1, 'expr.smile': 0.15 },
  },
  {
    id: 'sofisticato', label: 'Sofisticato', desc: 'Zigomi alti, naso affinato, sopracciglia arcuate',
    recipe: { 'cheeks.definition': 0.45, 'cheeks.volume': 0.3, 'nose.width': -0.3, 'nose.tip': 0.35, 'nose.contour': 0.35,
      'brows.arch': 0.45, 'brows.shape': 0.3, 'eyes.shape': -0.25, 'lips.ratio': 0.25, 'jaw.definition': 0.35,
      'texture.smooth': 0.3, 'texture.even': 0.3 },
  },
  {
    id: 'armonioso', label: 'Armonioso', desc: 'Più simmetria ed equilibrio tra le proporzioni',
    recipe: { 'face.symmetry': 1, 'texture.even': 0.45, 'texture.smooth': 0.25, 'texture.redness': 0.3, 'eyes.size': 0.08,
      'lips.volume': 0.1, 'light.radiance': 0.2 },
  },
  {
    id: 'espressivo', label: 'Espressivo', desc: 'Occhi più aperti, labbra piene, espressione vivace',
    recipe: { 'eyes.size': 0.3, 'eyes.shape': 0.3, 'brows.arch': 0.35, 'brows.position': 0.15, 'lips.volume': 0.35, 'cheeks.volume': 0.35,
      'expr.smile': 0.35, 'light.radiance': 0.3, 'eyes.periocular': 0.3 },
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
