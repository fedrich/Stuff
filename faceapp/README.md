# FaceFree

Editor di volti gratuito ispirato a FaceApp. Funziona **interamente nel browser**: le foto non vengono mai caricate su un server, non serve un account e non ci sono abbonamenti.

## Funzioni

| Scheda | Cosa fa |
|---|---|
| **Età** | Da bambino a molto anziano: levigatura e proporzioni infantili da un lato; rughe, pelle segnata, macchie, capelli e sopracciglia grigi e cedimenti dall'altro |
| **Genere** | Tratti più femminili (pelle, trucco, lineamenti) o più maschili (mascella, barba incolta, sopracciglia) |
| **Sorriso** | Da triste a grande sorriso, alzando gli angoli della bocca e le guance |
| **Barba** | Incolta, corta, folta, pizzetto, baffi, baffi a manubrio, collare, con densità e colore regolabili |
| **Capelli** | 13 colori più un colore a scelta, con l'intensità regolabile |
| **Trucco** | Rossetto, fard, ombretto, eyeliner, sopracciglia, più alcuni look già pronti |
| **Ritocco** | Pelle, occhi, viso, naso, labbra, mento, sopracciglia, più il preset "Hollywood" |
| **Occhiali** | Tondi, rettangolari, aviator, cat-eye, browline, anche con lenti da sole |
| **Sfondo** | Sfocato, bianco e nero, tinta unita, tramonto, oceano, studio, bokeh |
| **Filtri** | 11 filtri, più luminosità, contrasto, saturazione, temperatura, dissolvenza, vignettatura e grana |
| **Morph** | Fonde due volti oppure scambia i volti tra due foto |

Puoi anche usare la fotocamera, trascinare o incollare un'immagine, confrontare prima e dopo (con un divisore da trascinare o tenendo premuto un pulsante), gestire più volti nella stessa foto e scaricare il risultato in JPG.

## Come avviarla

Serve un qualsiasi server statico, perché i moduli ES non si caricano da `file://`:

```bash
cd faceapp
python3 -m http.server 8080      # oppure: npx http-server -p 8080
```

Poi apri http://localhost:8080. Al primo avvio servono una connessione e circa 20 MB per scaricare i modelli MediaPipe, che poi restano nella cache del browser.

Per pubblicarla gratis basta caricare la cartella `faceapp/` su GitHub Pages, Netlify o Cloudflare Pages.

## Come funziona

- **MediaPipe Face Landmarker** trova i 478 punti di ogni volto.
- **MediaPipe Selfie Multiclass Segmenter** separa capelli, pelle e sfondo.
- Gli effetti sono calcolati sui punti del volto con Canvas 2D: deformazioni locali (`warp.js`), levigatura pesata e rughe (`skin.js`), trucco (`makeup.js`), barba disegnata pelo per pelo (`beard.js`), occhiali, colore dei capelli, sfondi e filtri (`extras.js`), morph con triangolazione di Delaunay (`morph.js`).

## Limiti

FaceApp usa reti generative (GAN) sui propri server. Qui tutto è calcolato in locale senza IA generativa, quindi:

- il sorriso non aggiunge i denti;
- il cambio di genere e l'invecchiamento sono approssimazioni basate su trucco e deformazioni, non un volto "rigenerato";
- non si possono cambiare il taglio o la lunghezza dei capelli, solo il colore;
- il morph e lo scambio di volti funzionano meglio con due foto frontali e con una luce simile.
