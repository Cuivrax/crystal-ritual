#!/usr/bin/env node
// The printable "Birthstone Chart by Date", one US Letter page, from src/data/birth_zodiac.json.
//
//   node scripts/build-chart.mjs           (skips when nothing changed since the last run)
//   node scripts/build-chart.mjs --force
//
// Writes public/downloads/birthstone-chart-by-date.pdf (vector text and glyphs, under 2 MB),
// birthstone-chart-by-date.png (2550 x 3300, 300 dpi) and a small preview WebP. It renders an
// HTML page with Playwright, the way the screenshots are taken. Without Playwright (the hosted
// build) it leaves the committed files as they are.
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { glyphSvg } from '../src/lib/zodiac.mjs';
import { colorSwatches } from '../src/lib/colors.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public/downloads');
const BASE = 'birthstone-chart-by-date';
const HASH_FILE = join(ROOT, 'scripts/chart-hash.txt');
const MONTH_DAYS = { january: 31, february: 29, march: 31, april: 30, may: 31, june: 30, july: 31, august: 31, september: 30, october: 31, november: 30, december: 31 };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function cutoutDataUri(slug) {
  const file = join(ROOT, 'src/assets/cutouts', `${slug}.webp`);
  if (!slug || !existsSync(file)) return null;
  // 150 px is about half an inch at 300 dpi, enough for print and light for the PDF.
  const buf = await sharp(file).resize({ width: 150, height: 150, fit: 'inside' }).png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer();
  return `data:image/png;base64,${buf.toString('base64')}`;
}

export async function chartHtml(data, stones) {
  const fontUrl = (f) => pathToFileURL(join(ROOT, 'node_modules/@fontsource', f)).href;
  const stoneArt = async (s, size) => {
    const uri = await cutoutDataUri(s.slug);
    if (uri) return `<img class="cut" src="${uri}" width="${size}" height="${size}" alt="">`;
    const sw = s.slug && stones[s.slug] ? colorSwatches(stones[s.slug].colors || '')[0] : null;
    return `<span class="dot" style="background:${sw ? sw.hex : '#DDD'};width:${Math.round(size * 0.55)}px;height:${Math.round(size * 0.55)}px"></span>`;
  };
  const names = (list) => list.map((s) => esc(s.name)).join(', ');
  const same = (a, b) => [...a].map((s) => s.name).sort().join('|') === [...b].map((s) => s.name).sort().join('|');

  let months = '';
  for (const m of data.months) {
    const arts = (await Promise.all(m.modern.slice(0, 3).map((s) => stoneArt(s, 56)))).join('');
    const old = same(m.modern, m.list1912) ? '' : `<p class="old">1912 ${names(m.list1912)}</p>`;
    months += `<div class="cell"><p class="name">${esc(m.name)}</p><p class="dates">${esc(m.name)} 1 to ${MONTH_DAYS[m.key]}</p><div class="arts">${arts}</div><p class="stones">${names(m.modern)}</p>${old}</div>`;
  }
  let signs = '';
  for (const s of data.signs) {
    const art = (await Promise.all(s.stone1913.slice(0, 1).map((x) => stoneArt(x, 46)))).join('');
    signs += `<div class="cell sign"><div class="sign-head"><span class="glyph">${glyphSvg(s.key, { size: 28, stroke: 1.7 })}</span><div><p class="name">${esc(s.name)}</p><p class="dates">${esc(s.dates)}</p></div></div><div class="stone1913">${art}<p class="stones"><span class="lbl">1913 Stone</span>${names(s.stone1913)}</p></div></div>`;
  }
  return `<!doctype html><html lang="en-US"><head><meta charset="utf-8"><style>
@font-face { font-family: Gilda; src: url(${fontUrl('gilda-display/files/gilda-display-latin-400-normal.woff2')}) format('woff2'); }
@font-face { font-family: Figtree; font-weight: 400; src: url(${fontUrl('figtree/files/figtree-latin-400-normal.woff2')}) format('woff2'); }
@font-face { font-family: Figtree; font-weight: 600; src: url(${fontUrl('figtree/files/figtree-latin-600-normal.woff2')}) format('woff2'); }
@font-face { font-family: Figtree; font-weight: 700; src: url(${fontUrl('figtree/files/figtree-latin-700-normal.woff2')}) format('woff2'); }
@page { size: Letter; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { width: 816px; height: 1056px; background: #fff; color: #1f1a29; font-family: Figtree, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 816px; height: 1056px; padding: 38px 38px 22px; display: flex; flex-direction: column; gap: 16px; }
.grid { display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: 1fr; gap: 9px; }
.grid.months { flex: 1.35 1 0; }
.grid.signs { flex: 1 1 0; }
.cell { border: 1.2px solid #8d8598; border-radius: 12px; padding: 10px 10px 9px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.name { margin: 0; font-family: Gilda, Georgia, serif; font-size: 21px; line-height: 1.1; }
.dates { margin: 2px 0 0; font-size: 10.5px; color: #3b3446; }
.arts { display: flex; justify-content: center; align-items: center; gap: 2px; min-height: 60px; margin: 6px 0 4px; }
.cut { object-fit: contain; display: block; }
.dot { display: inline-block; border-radius: 50%; border: 1px solid #555; margin: 0 8px; }
.stones { margin: 0; font-size: 13px; font-weight: 700; line-height: 1.25; }
.old { margin: 3px 0 0; font-size: 9.5px; color: #3b3446; }
.sign { align-items: stretch; justify-content: center; text-align: left; }
.sign-head { display: flex; align-items: center; gap: 8px; }
.glyph { flex: none; width: 42px; height: 42px; border-radius: 50%; border: 1.4px solid #3b2f6b; color: #3b2f6b; display: flex; align-items: center; justify-content: center; }
.sign .name { font-size: 18px; }
.sign .dates { font-size: 10px; }
.stone1913 { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.lbl { display: block; font-size: 8.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #3b3446; }
.foot { margin: 0; text-align: center; font-size: 10px; color: #3b3446; letter-spacing: 0.04em; }
</style></head><body><div class="page"><div class="grid months">${months}</div><div class="grid signs">${signs}</div><p class="foot">Crystal &amp; Ritual, www.crystalandritual.com</p></div></body></html>`;
}

async function main() {
  const force = process.argv.includes('--force');
  let playwright;
  try { playwright = createRequire(import.meta.url)('playwright'); } catch {
    console.log('chart, Playwright is not installed here, the committed chart files stay as they are');
    return;
  }
  const data = JSON.parse(readFileSync(join(ROOT, 'src/data/birth_zodiac.json'), 'utf8'));
  const stones = JSON.parse(readFileSync(join(ROOT, 'src/data/stones.json'), 'utf8')).stones;
  const html = await chartHtml(data, stones);
  const hash = createHash('sha256').update(html).digest('hex');
  const files = ['pdf', 'png'].map((e) => join(OUT_DIR, `${BASE}.${e}`));
  if (!force && existsSync(HASH_FILE) && readFileSync(HASH_FILE, 'utf8').trim() === hash && files.every(existsSync)) {
    console.log('chart, unchanged');
    return;
  }
  mkdirSync(OUT_DIR, { recursive: true });
  const tmp = join(ROOT, 'node_modules/.astro/chart.html');
  mkdirSync(dirname(tmp), { recursive: true });
  writeFileSync(tmp, html);
  const browser = await playwright.chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 816, height: 1056 }, deviceScaleFactor: 2550 / 816 });
    await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({ path: files[0], format: 'Letter', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 816, height: 1056 } });
    await sharp(png).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(files[1]);
    await sharp(png).resize({ width: 600 }).webp({ quality: 80 }).toFile(join(OUT_DIR, `${BASE}-preview.webp`));
  } finally {
    await browser.close();
  }
  writeFileSync(HASH_FILE, `${hash}\n`);
  const kb = (f) => `${Math.round(statSync(f).size / 1024)} KB`;
  console.log(`chart, ${BASE}.pdf ${kb(files[0])}, ${BASE}.png ${kb(files[1])}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
