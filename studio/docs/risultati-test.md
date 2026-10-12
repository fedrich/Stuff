# Risultati dei test (12 ottobre 2026)

Generato da `node tests/run-tests.mjs` su Chromium headless con rendering WebGL software (SwiftShader). I tempi sono quindi molto più alti che su un telefono con GPU.

| Foto | Caratteristiche | Esito | Render medio |
|---|---|---|---|
| f1 | donna, carnagione olivastra, luce da studio | 106/106 | 331 ms |
| m1 | uomo, tratti est-asiatici | 106/106 | 316 ms |
| f2 | donna, carnagione media, testa inclinata | 106/106 | 329 ms |
| f3old | donna anziana, carnagione scura, velo | 106/106 | 303 ms |
| f4 | donna, bianco e nero, luce laterale | 106/106 | 184 ms |
| m2 | uomo, bianco e nero, barba, fondo scuro | 106/106 | 176 ms |
| m3 | uomo, carnagione chiara, foto anni 90 | 106/106 | 327 ms |
| f5 | donna, carnagione scura, frangia | 106/106 | 286 ms |
| f6 | donna, viso coperto dalle mani (occlusione) | 105/106 | 263 ms |

Controlli falliti:

- f6: occhi: asimmetria aggiunta (peggiore eyes.size=-1) = 0.0048 (limite < 0,2% del viso (≈ mezzo pixel))

Controlli per foto: neutralità (1), località dei 26 cursori dei Tratti a −1 e +1 (52), protezione di occhi, bocca, capelli e sfondo e confinamento alla pelle per i 4 strumenti Pelle (8), per ognuna delle 7 Impressioni crescita, progressione, linearità, spostamento massimo e medio e assenza di pieghe (42), pieghe, asimmetria aggiunta e asimmetria degli occhi per i Tratti (3). Totale: 106 controlli per foto.
