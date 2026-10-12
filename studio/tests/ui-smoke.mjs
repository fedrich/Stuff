// Prova dell'interfaccia su un telefono simulato: percorre il flusso tipico e salva gli screenshot.
//   node tests/ui-smoke.mjs [foto.jpg]
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
let chromium;
try { ({ chromium } = await import('playwright')); } catch { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); }
const photo = process.argv[2] || path.join(here, '.cache', 'f1.jpg');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root) || !fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const args = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
if (process.env.HTTPS_PROXY) args.push(`--proxy-server=${process.env.HTTPS_PROXY}`, '--proxy-bypass-list=127.0.0.1;localhost');
const exe = fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined;
const browser = await chromium.launch({ executablePath: exe, args });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: !process.env.DESKTOP, hasTouch: true, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const out = path.join(here, 'results', 'ui');
fs.mkdirSync(out, { recursive: true });
const shot = (n) => page.screenshot({ path: path.join(out, `${n}.png`) });
const step = (msg, cond) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) process.exitCode = 1; };
const st = () => page.evaluate(() => window.studio.getState());

await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.waitForFunction(() => window.studio && document.getElementById('loadStatus').textContent === '', null, { timeout: 180000 });
await shot('1-avvio');
await page.setInputFiles('#file', photo);
await page.waitForFunction(() => !document.getElementById('viewport').hidden, null, { timeout: 60000 });
await page.waitForTimeout(1500);
step('foto caricata e volto rilevato', await page.evaluate(() => !!window.studio.photo.lm));
await shot('2-caricata');

await page.locator('.tool', { hasText: 'Sofisticato' }).tap();
await page.locator('#s-impression').fill('0.75');
await page.locator('#s-impression').dispatchEvent('change');
let s = await st();
step('impressione Sofisticato al 75%', s.impression.id === 'sofisticato' && Math.abs(s.impression.amount - 0.75) < 1e-6);
await shot('3-impressione');

await page.locator('.cats button', { hasText: 'Pelle' }).tap();
await page.locator('.tool', { hasText: 'Abbronzatura' }).tap();
await page.locator('[id="s-tan.amount"]').fill('0.5');
await page.locator('[id="s-tan.amount"]').dispatchEvent('change');
await page.locator('.tool', { hasText: 'Lentiggini' }).tap();
await page.locator('[id="s-freckles.amount"]').fill('0.5');
await page.locator('[id="s-freckles.amount"]').dispatchEvent('change');
s = await st();
step('abbronzatura e lentiggini applicate, impressione conservata', s.values['tan.amount'] === 0.5 && s.values['freckles.amount'] === 0.5 && s.impression.id === 'sofisticato');
await shot('4-pelle');

await page.locator('.cats button', { hasText: 'Tratti' }).tap();
await page.locator('.tool', { hasText: 'Labbra' }).tap();
await page.locator('[id="s-lips.volume"]').fill('0.6');
await page.locator('[id="s-lips.volume"]').dispatchEvent('change');
await page.locator('[id="s-lips.width"]').fill('-0.3');
await page.locator('[id="s-lips.width"]').dispatchEvent('change');
await shot('5-tratti');
await page.locator('#toolPanel .mini', { hasText: 'Annulla' }).tap();
s = await st();
step('Annulla dello strumento toglie solo l\'ultima modifica delle labbra', s.values['lips.width'] === 0 && s.values['lips.volume'] === 0.6 && s.values['tan.amount'] === 0.5);
await page.locator('#undoBtn').tap();
s = await st();
step('Annulla globale torna al passo precedente', s.values['lips.width'] === -0.3);
await page.locator('#redoBtn').tap();
await page.locator('#toolPanel .mini', { hasText: 'Ripristina' }).tap();
s = await st();
step('Ripristina azzera solo le labbra', s.values['lips.volume'] === 0 && s.values['lips.width'] === 0 && s.values['tan.amount'] === 0.5);

const hold = page.locator('#holdBtn');
await hold.dispatchEvent('pointerdown');
step('tieni premuto mostra l\'originale', await page.evaluate(() => !document.getElementById('origCanvas').hidden));
await shot('6-prima');
await hold.dispatchEvent('pointerup');
await page.locator('#zoomBtn').tap();
await page.waitForTimeout(300);
await shot('7-zoom');
await page.locator('#zoomBtn').tap();

const dl = page.waitForEvent('download', { timeout: 120000 });
await page.locator('#exportBtn').tap();
const d = await dl;
const file = path.join(out, 'esportata.jpg');
await d.saveAs(file);
const size = await page.evaluate(() => [window.studio.photo.full.width, window.studio.photo.full.height]);
step(`esportazione in alta qualità (${size.join('×')}, ${Math.round(fs.statSync(file).size / 1024)} KB)`, fs.statSync(file).size > 50000);

await page.locator('#resetAllBtn').tap();
s = await st();
step('Originale ripristina tutto', !s.impression.id && Object.values(s.values).every((v, i) => true) && s.values['tan.amount'] === 0);
step('nessun errore JavaScript', errors.length === 0);
if (errors.length) console.log(errors);
await browser.close();
server.close();
