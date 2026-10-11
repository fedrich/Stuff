// Definizione delle schede e dei controlli del pannello.

const HAIR = [
  { label: 'Originale', value: null }, { label: 'Nero', value: '#1a1513' }, { label: 'Castano scuro', value: '#3b2618' },
  { label: 'Castano', value: '#6a4428' }, { label: 'Ramato', value: '#a4502a' }, { label: 'Rosso', value: '#b3261e' },
  { label: 'Biondo miele', value: '#c49a5a' }, { label: 'Biondo', value: '#e2c37f' }, { label: 'Platino', value: '#ece6d6' },
  { label: 'Grigio', value: '#a9a9a9' }, { label: 'Rosa', value: '#e889b4' }, { label: 'Viola', value: '#7b4fc9' },
  { label: 'Blu', value: '#3b6fd8' }, { label: 'Verde', value: '#2f9e6a' },
];
const BEARD_COLORS = [
  { label: 'Castano scuro', value: '#2b1d14' }, { label: 'Nero', value: '#121010' }, { label: 'Castano', value: '#5a3a22' },
  { label: 'Ramato', value: '#8c4423' }, { label: 'Biondo', value: '#b8925a' }, { label: 'Grigio', value: '#9a9a9a' }, { label: 'Bianco', value: '#e4e4e4' },
];
const LIPS = [
  { label: 'Rosso', value: '#b0304a' }, { label: 'Rosso fuoco', value: '#c8102e' }, { label: 'Rosa', value: '#d45d79' },
  { label: 'Nude', value: '#c27a66' }, { label: 'Corallo', value: '#e8604c' }, { label: 'Fucsia', value: '#d6246e' },
  { label: 'Bordeaux', value: '#7a1f33' }, { label: 'Prugna', value: '#5a1f45' },
];
const BLUSH = [
  { label: 'Rosa', value: '#e0607a' }, { label: 'Pesca', value: '#f08a6a' }, { label: 'Corallo', value: '#e65a4f' }, { label: 'Malva', value: '#b05a7a' },
];
const SHADOW = [
  { label: 'Prugna', value: '#7a4f6e' }, { label: 'Bronzo', value: '#8a5a33' }, { label: 'Oro', value: '#c9a24a' },
  { label: 'Fumé', value: '#3a3a42' }, { label: 'Blu', value: '#3a5a9a' }, { label: 'Verde', value: '#4a7a4a' },
];
const FRAMES = [
  { label: 'Nero', value: '#141414' }, { label: 'Tartaruga', value: '#5a3418' }, { label: 'Oro', value: '#c9a24a' },
  { label: 'Argento', value: '#b8bcc4' }, { label: 'Rosso', value: '#a3202a' }, { label: 'Blu', value: '#1f3f8f' },
];

const R = (k) => `retouch.${k}`;

export const TABS = [
  {
    id: 'age', label: 'Età', title: 'Età', face: true,
    hint: 'Ringiovanisci o invecchia il volto: levigatura e proporzioni da una parte, rughe, pelle, capelli grigi e cedimenti dall\'altra.',
    controls: [
      { type: 'presets', options: [
        { label: 'Bambino', set: { age: -1 } }, { label: 'Giovane', set: { age: -0.5 } }, { label: 'Attuale', set: { age: 0 } },
        { label: 'Maturo', set: { age: 0.4 } }, { label: 'Anziano', set: { age: 0.75 } }, { label: 'Molto anziano', set: { age: 1 } },
      ] },
      { type: 'slider', key: 'age', label: 'Età', min: -1, max: 1, minLabel: 'Più giovane', maxLabel: 'Più anziano' },
    ],
  },
  {
    id: 'gender', label: 'Genere', title: 'Cambio di genere', face: true,
    hint: 'Tratti più femminili (pelle levigata, trucco, lineamenti delicati) o più maschili (mascella più larga, barba, sopracciglia marcate). Non cambia la lunghezza dei capelli.',
    controls: [
      { type: 'presets', options: [
        { label: 'Molto maschile', set: { gender: -1 } }, { label: 'Più maschile', set: { gender: -0.5 } }, { label: 'Neutro', set: { gender: 0 } },
        { label: 'Più femminile', set: { gender: 0.5 } }, { label: 'Molto femminile', set: { gender: 1 } },
      ] },
      { type: 'slider', key: 'gender', label: 'Genere', min: -1, max: 1, minLabel: 'Maschile', maxLabel: 'Femminile' },
    ],
  },
  {
    id: 'smile', label: 'Sorriso', title: 'Sorriso', face: true,
    hint: 'Solleva gli angoli della bocca e le guance (o li abbassa per un\'espressione triste).',
    controls: [
      { type: 'presets', options: [
        { label: 'Triste', set: { smile: -0.7 } }, { label: 'Serio', set: { smile: 0 } }, { label: 'Accennato', set: { smile: 0.4 } },
        { label: 'Sorriso', set: { smile: 0.7 } }, { label: 'Grande sorriso', set: { smile: 1 } },
      ] },
      { type: 'slider', key: 'smile', label: 'Sorriso', min: -1, max: 1, minLabel: 'Triste', maxLabel: 'Sorridente' },
    ],
  },
  {
    id: 'beard', label: 'Barba', title: 'Barba e baffi', face: true,
    controls: [
      { type: 'chips', key: 'beard.style', label: 'Stile', options: [
        { label: 'Nessuna', value: 'none' }, { label: 'Incolta', value: 'stubble' }, { label: 'Corta', value: 'short' },
        { label: 'Folta', value: 'full' }, { label: 'Pizzetto', value: 'goatee' }, { label: 'Baffi', value: 'mustache' },
        { label: 'Baffi a manubrio', value: 'handlebar' }, { label: 'Collare', value: 'chinstrap' },
      ] },
      { type: 'slider', key: 'beard.density', label: 'Densità', reset: 0.8 },
      { type: 'swatches', key: 'beard.color', label: 'Colore', options: BEARD_COLORS, custom: true },
    ],
  },
  {
    id: 'hair', label: 'Capelli', title: 'Colore dei capelli',
    hint: 'Ricolora i capelli rilevati automaticamente. (Taglio e lunghezza non sono modificabili senza IA generativa.)',
    controls: [
      { type: 'swatches', key: 'hair.color', label: 'Colore', options: HAIR, custom: true },
      { type: 'slider', key: 'hair.strength', label: 'Intensità', reset: 0.85 },
    ],
  },
  {
    id: 'makeup', label: 'Trucco', title: 'Trucco', face: true,
    controls: [
      { type: 'presets', label: 'Look', options: [
        { label: 'Nessuno', set: { 'makeup.lipstick': 0, 'makeup.blush': 0, 'makeup.eyeshadow': 0, 'makeup.eyeliner': 0, 'makeup.browDarken': 0 } },
        { label: 'Naturale', set: { 'makeup.lipstick': 0.3, 'makeup.lipColor': '#c27a66', 'makeup.blush': 0.3, 'makeup.blushColor': '#f08a6a', 'makeup.eyeshadow': 0.2, 'makeup.shadowColor': '#8a5a33', 'makeup.eyeliner': 0.2, 'makeup.browDarken': 0.2 } },
        { label: 'Glam', set: { 'makeup.lipstick': 0.75, 'makeup.lipColor': '#c8102e', 'makeup.blush': 0.4, 'makeup.blushColor': '#e0607a', 'makeup.eyeshadow': 0.5, 'makeup.shadowColor': '#c9a24a', 'makeup.eyeliner': 0.8, 'makeup.browDarken': 0.4 } },
        { label: 'Serata', set: { 'makeup.lipstick': 0.7, 'makeup.lipColor': '#7a1f33', 'makeup.blush': 0.3, 'makeup.blushColor': '#b05a7a', 'makeup.eyeshadow': 0.75, 'makeup.shadowColor': '#3a3a42', 'makeup.eyeliner': 0.9, 'makeup.browDarken': 0.5 } },
        { label: 'Rosa', set: { 'makeup.lipstick': 0.55, 'makeup.lipColor': '#d45d79', 'makeup.blush': 0.5, 'makeup.blushColor': '#e0607a', 'makeup.eyeshadow': 0.35, 'makeup.shadowColor': '#7a4f6e', 'makeup.eyeliner': 0.4, 'makeup.browDarken': 0.2 } },
      ] },
      { type: 'slider', key: 'makeup.lipstick', label: 'Rossetto' },
      { type: 'swatches', key: 'makeup.lipColor', options: LIPS, custom: true },
      { type: 'slider', key: 'makeup.blush', label: 'Fard' },
      { type: 'swatches', key: 'makeup.blushColor', options: BLUSH, custom: true },
      { type: 'slider', key: 'makeup.eyeshadow', label: 'Ombretto' },
      { type: 'swatches', key: 'makeup.shadowColor', options: SHADOW, custom: true },
      { type: 'slider', key: 'makeup.eyeliner', label: 'Eyeliner' },
      { type: 'slider', key: 'makeup.browDarken', label: 'Sopracciglia' },
    ],
  },
  {
    id: 'retouch', label: 'Ritocco', title: 'Ritocco del viso', face: true,
    hint: 'Doppio clic su un cursore per azzerarlo.',
    controls: [
      { type: 'presets', options: [
        { label: 'Hollywood', set: { [R('smooth')]: 0.6, [R('eyes')]: 0.25, [R('slim')]: 0.35, [R('nose')]: 0.3, [R('lips')]: 0.2, [R('chin')]: 0, [R('brows')]: 0.2, smile: 0.5 } },
        { label: 'Delicato', set: { [R('smooth')]: 0.35, [R('eyes')]: 0.1, [R('slim')]: 0.15, [R('nose')]: 0.1, [R('lips')]: 0, [R('chin')]: 0, [R('brows')]: 0 } },
        { label: 'Azzera', set: { [R('smooth')]: 0, [R('eyes')]: 0, [R('slim')]: 0, [R('nose')]: 0, [R('lips')]: 0, [R('chin')]: 0, [R('brows')]: 0 } },
      ] },
      { type: 'slider', key: R('smooth'), label: 'Pelle levigata' },
      { type: 'slider', key: R('eyes'), label: 'Occhi', min: -1, max: 1, minLabel: 'Più piccoli', maxLabel: 'Più grandi' },
      { type: 'slider', key: R('slim'), label: 'Viso', min: -1, max: 1, minLabel: 'Più largo', maxLabel: 'Più sottile' },
      { type: 'slider', key: R('nose'), label: 'Naso', min: -1, max: 1, minLabel: 'Più largo', maxLabel: 'Più sottile' },
      { type: 'slider', key: R('lips'), label: 'Labbra', min: -1, max: 1, minLabel: 'Più sottili', maxLabel: 'Più carnose' },
      { type: 'slider', key: R('chin'), label: 'Mento', min: -1, max: 1, minLabel: 'Più corto', maxLabel: 'Più lungo' },
      { type: 'slider', key: R('brows'), label: 'Sopracciglia', min: -1, max: 1, minLabel: 'Più basse', maxLabel: 'Più alte' },
    ],
  },
  {
    id: 'glasses', label: 'Occhiali', title: 'Occhiali', face: true,
    controls: [
      { type: 'chips', key: 'glasses.style', label: 'Montatura', options: [
        { label: 'Nessuno', value: 'none' }, { label: 'Tondi', value: 'round' }, { label: 'Rettangolari', value: 'rect' },
        { label: 'Aviator', value: 'aviator' }, { label: 'Cat-eye', value: 'cateye' }, { label: 'Browline', value: 'browline' },
      ] },
      { type: 'toggle', key: 'glasses.sun', label: 'Lenti da sole' },
      { type: 'swatches', key: 'glasses.color', label: 'Colore montatura', options: FRAMES, custom: true },
    ],
  },
  {
    id: 'bg', label: 'Sfondo', title: 'Sfondo',
    hint: 'La persona viene separata automaticamente dallo sfondo.',
    controls: [
      { type: 'chips', key: 'bg.mode', label: 'Tipo', options: [
        { label: 'Originale', value: 'none' }, { label: 'Sfocato', value: 'blur' }, { label: 'Bianco e nero', value: 'bw' },
        { label: 'Tinta unita', value: 'color' }, { label: 'Tramonto', value: 'sunset' }, { label: 'Oceano', value: 'ocean' },
        { label: 'Studio', value: 'studio' }, { label: 'Bokeh', value: 'bokeh' },
      ] },
      { type: 'slider', key: 'bg.amount', label: 'Intensità', reset: 0.6 },
      { type: 'swatches', key: 'bg.color', label: 'Colore (tinta unita)', options: [
        { label: 'Blu', value: '#4f7cff' }, { label: 'Bianco', value: '#ffffff' }, { label: 'Grigio', value: '#7a7f88' },
        { label: 'Nero', value: '#000000' }, { label: 'Rosa', value: '#f4a6c0' }, { label: 'Verde', value: '#3fbf7f' }, { label: 'Giallo', value: '#ffd34d' },
      ], custom: true },
    ],
  },
  {
    id: 'filters', label: 'Filtri', title: 'Filtri e regolazioni',
    controls: [
      { type: 'chips', key: 'filter.name', label: 'Filtro', options: [
        { label: 'Nessuno', value: 'none' }, { label: 'Vivace', value: 'vivid' }, { label: 'Caldo', value: 'warm' }, { label: 'Freddo', value: 'cool' },
        { label: 'Vintage', value: 'vintage' }, { label: 'Pellicola', value: 'film' }, { label: 'Drammatico', value: 'drama' },
        { label: 'Dorato', value: 'golden' }, { label: 'Pastello', value: 'pastel' }, { label: 'B/N', value: 'bw' },
        { label: 'Noir', value: 'noir' }, { label: 'Seppia', value: 'sepia' },
      ] },
      { type: 'slider', key: 'filter.intensity', label: 'Intensità filtro', reset: 1 },
      { type: 'slider', key: 'filter.brightness', label: 'Luminosità', min: -0.5, max: 0.5 },
      { type: 'slider', key: 'filter.contrast', label: 'Contrasto', min: -0.5, max: 0.5 },
      { type: 'slider', key: 'filter.saturation', label: 'Saturazione', min: -1, max: 1 },
      { type: 'slider', key: 'filter.warmth', label: 'Temperatura', min: -1, max: 1, minLabel: 'Fredda', maxLabel: 'Calda' },
      { type: 'slider', key: 'filter.fade', label: 'Dissolvenza' },
      { type: 'slider', key: 'filter.vignette', label: 'Vignettatura' },
      { type: 'slider', key: 'filter.grain', label: 'Grana' },
    ],
  },
  {
    id: 'morph', label: 'Morph', title: 'Morph e scambio volti', face: true,
    hint: 'Carica una seconda foto: puoi fondere i due volti (morph) o mettere il secondo volto sul primo (scambio).',
    controls: [
      { type: 'secondPhoto' },
      { type: 'chips', key: 'morph.mode', label: 'Modalità', options: [{ label: 'Morph', value: 'morph' }, { label: 'Scambio volti', value: 'swap' }] },
      { type: 'slider', key: 'morph.amount', label: 'Quantità', reset: 0.5, step: 0.05 },
    ],
  },
];
