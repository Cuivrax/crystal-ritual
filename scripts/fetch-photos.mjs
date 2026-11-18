#!/usr/bin/env node
// Downloads the photos named in the Markdown photo notes into src/assets/stones/<folder>/<role>.<ext>.
//   node scripts/fetch-photos.mjs            (only missing files)
//   node scripts/fetch-photos.mjs --dry-run  (list what it would fetch)
// Behind an HTTP proxy, run it with NODE_USE_ENV_PROXY=1 so fetch() uses HTTPS_PROXY.
// Only notes with a license, a credit, alt text and a passed visual check are fetched
// (the same rule the build uses to render a figure). The build never downloads anything,
// a page shows a photo only when its file is in the repo.
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePhotoComments, photoFolder, PHOTO_EXTS } from '../src/lib/photos.mjs';
import { idToUrl } from '../src/lib/urls.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const dry = process.argv.includes('--dry-run');
const refreshSmithsonian = process.argv.includes('--refresh-smithsonian');
const todoArg = process.argv.indexOf('--todo');
const todoPath = todoArg > 0 ? process.argv[todoArg + 1] : join(ROOT, 'reports/commons_todo.json');
const isCommons = (u) => /wikimedia\.org/.test(u || '');
const isSmithsonian = (u) => /ids\.si\.edu/.test(u || '');
const picks = existsSync(join(ROOT, 'src/data/photo_picks.json')) ? JSON.parse(readFileSync(join(ROOT, 'src/data/photo_picks.json'), 'utf8')) : {};
const todo = [];
const UA = 'crystalandritual-site-build/1.0 (photo fetch for credited open-license images)';

function imageUrl(u) {
  // Smithsonian IDS serves a size cap with ?max=
  if (/ids\.si\.edu\/ids\/deliveryService/.test(u) && !/[?&]max=/.test(u)) return `${u}${u.includes('?') ? '&' : '?'}max=1200`;
  return u;
}

const pages = readdirSync(join(ROOT, 'content/pages')).filter((f) => f.endsWith('.md'));
let ok = 0; let skipped = 0; let failed = 0;
for (const f of pages) {
  const id = f.replace(/\.md$/, '');
  const text = readFileSync(join(ROOT, 'content/pages', f), 'utf8');
  const type = (/^page_type:\s*"?([a-z-]+)"?/m.exec(text) || [])[1];
  const folder = photoFolder({ id, url: idToUrl(id), type });
  for (const p of parsePhotoComments(text)) {
    if (!p.usable || !p.role) continue;
    if (!p.image) continue; // notes that point to site/photos are copied by sync-content.mjs
    const dir = join(ROOT, 'src/assets/stones', folder);
    const have = PHOTO_EXTS.find((e) => existsSync(join(dir, `${p.role}.${e}`)));
    const pickedHero = p.hero && picks[id] && PHOTO_EXTS.some((e) => existsSync(join(ROOT, 'src/assets/photos', id, `hero.${e}`)));
    if (p.hero && isCommons(p.image)) {
      todo.push({ page: id, file_page: p.page, image_url: p.image, credit: p.credit, license: p.license, status: pickedHero ? 'not needed, a checked photo in site/photos is used' : have ? `in the repo at src/assets/stones/${folder}/${p.role}.${have}` : 'missing, no figure until the file is there', target: `src/assets/stones/${folder}/hero.jpg` });
    }
    if (have && !(refreshSmithsonian && isSmithsonian(p.image))) { skipped++; continue; }
    const url = imageUrl(p.image);
    if (dry) { console.log(`would fetch ${folder}/${p.role} from ${url}`); continue; }
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const type = res.headers.get('content-type') || '';
      const ext = /png/.test(type) ? 'png' : /webp/.test(type) ? 'webp' : /jpe?g/.test(type) ? 'jpg' : null;
      if (!ext) throw new Error(`not an image (${type})`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 5000) throw new Error('file too small');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${p.role}.${ext}`), buf);
      console.log(`fetched ${folder}/${p.role}.${ext} (${Math.round(buf.length / 1024)} KB)`);
      ok++;
    } catch (e) {
      console.log(`failed ${folder}/${p.role} ${url} (${e.message})`);
      failed++;
    }
  }
}
console.log(`${ok} fetched, ${skipped} already there, ${failed} failed`);
if (!dry) {
  mkdirSync(dirname(todoPath), { recursive: true });
  writeFileSync(todoPath, `${JSON.stringify({ generated: new Date().toISOString(), note: 'Hero photos whose note points to Wikimedia Commons. Save each image as the target path, then rebuild.', items: todo }, null, 1)}\n`);
  console.log(`${todo.length} Commons heroes listed in ${todoPath}, ${todo.filter((t) => t.status.startsWith('missing')).length} missing`);
}
