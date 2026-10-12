// Test di qualità del motore su foto reali.
//   npm install playwright   (una volta)
//   node tests/run-tests.mjs [cartella-immagini]
// Senza cartella scarica le foto elencate in images.json (licenze libere) in tests/.cache.
// Scrive tests/results/report.json, report.md e i ritagli prima/dopo.
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
let chromium;
try { ({ chromium } = await import('playwright')); } catch { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); }

const images = JSON.parse(fs.readFileSync(path.join(here, 'images.json'), 'utf8'));
const dir = process.argv[2] || path.join(here, '.cache');
fs.mkdirSync(dir, { recursive: true });
for (const im of images) {
  const file = path.join(dir, `${im.id}.jpg`);
  if (fs.existsSync(file)) continue;
  const r = await fetch(im.url, { headers: { 'User-Agent': 'VoltoStudioTests/1.0' } });
  if (!r.ok) { console.warn('download non riuscito', im.id, r.status); continue; }
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
}

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root) || !fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;

const args = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
if (process.env.HTTPS_PROXY) args.push(`--proxy-server=${process.env.HTTPS_PROXY}`, '--proxy-bypass-list=127.0.0.1;localhost');
const exe = fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined;
const browser = await chromium.launch({ executablePath: exe, args });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('pageerror', (e) => console.log('[errore pagina]', e.message));
await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForFunction(() => window.studio && document.getElementById('loadStatus').textContent === '', null, { timeout: 180000 });

const outDir = path.join(here, 'results');
fs.mkdirSync(outDir, { recursive: true });
const report = [];
for (const im of images) {
  const file = path.join(dir, `${im.id}.jpg`);
  if (!fs.existsSync(file)) continue;
  await page.setInputFiles('#file', file);
  await page.waitForFunction((id) => window.studio.photo && !document.getElementById('viewport').hidden, im.id, { timeout: 60000 });
  await page.waitForTimeout(300);
  const r = await page.evaluate(async () => (await import('/tests/checks.js')).runChecks(window.studio));
  const failed = (r.checks || []).filter((c) => !c.pass);
  console.log(`${im.id} (${im.note}): ${r.noFace ? 'nessun volto' : `${r.checks.length - failed.length}/${r.checks.length} ok, render medio ${r.renderMs} ms`}`);
  for (const c of failed) console.log(`   ✗ ${c.name}: ${c.value} (limite ${c.limit})`);
  report.push({ ...im, ...r });
  await page.waitForFunction(() => true);
}
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1));
const md = ['# Risultati dei test', '', '| Foto | Caratteristiche | Esito | Render medio |', '|---|---|---|---|'];
for (const r of report) {
  const f = (r.checks || []).filter((c) => !c.pass);
  md.push(`| ${r.id} | ${r.note} | ${r.noFace ? 'volto non rilevato' : `${r.checks.length - f.length}/${r.checks.length}`} | ${r.renderMs ? r.renderMs + ' ms' : '–'} |`);
}
md.push('', 'Controlli falliti:', '');
for (const r of report) for (const c of (r.checks || []).filter((x) => !x.pass)) md.push(`- ${r.id}: ${c.name} = ${c.value} (limite ${c.limit})`);
fs.writeFileSync(path.join(outDir, 'report.md'), md.join('\n') + '\n');
await browser.close();
server.close();
