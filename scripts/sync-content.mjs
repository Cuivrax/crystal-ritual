#!/usr/bin/env node
// Copies the working content and data into the repo.
//
//   node scripts/sync-content.mjs            (source defaults to /home/claude/hc)
//   HC_ROOT=/path/to/hc node scripts/sync-content.mjs
//
// The source folder is only read, never written. Pages land in content/pages/,
// data files in src/data/, and the moon code in src/lib/moon.js. Once the repo copy
// becomes the canonical one, stop running this script and edit content/pages/ directly.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, copyFileSync, unlinkSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { colorFamilies } from '../src/lib/colors.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HC = process.env.HC_ROOT || '/home/claude/hc';

const PAGES_SRC = join(HC, 'content/pages');
const PAGES_DST = join(ROOT, 'content/pages');
const DATA_DST = join(ROOT, 'src/data');

const DATA_FILES = [
  ['tools/care-checker/care.json', 'care.json'],
  ['content/_ref/intent_rankings.json', 'intent_rankings.json'],
  ['content/_ref/birthstones.json', 'birthstones.json'],
  ['data_build2/source_tiers.json', 'source_tiers.json'],
  ['tools/moon/phase_stones.json', 'phase_stones.json'],
];
const STONE_SHEET_DIRS = ['data_build/stones', 'data_build2/stones'];

function fail(msg) {
  console.error(`sync-content: ${msg}`);
  process.exit(1);
}

if (!existsSync(PAGES_SRC)) fail(`no pages folder at ${PAGES_SRC}`);
mkdirSync(PAGES_DST, { recursive: true });
mkdirSync(DATA_DST, { recursive: true });

// 1. Pages, mirrored (a page removed upstream is removed here too).
const srcPages = readdirSync(PAGES_SRC).filter((f) => f.endsWith('.md'));
let copied = 0;
let unchanged = 0;
for (const f of srcPages) {
  const from = join(PAGES_SRC, f);
  const to = join(PAGES_DST, f);
  const text = readFileSync(from, 'utf8');
  if (existsSync(to) && readFileSync(to, 'utf8') === text) { unchanged++; continue; }
  writeFileSync(to, text);
  copied++;
}
const removed = [];
for (const f of readdirSync(PAGES_DST).filter((x) => x.endsWith('.md'))) {
  if (!srcPages.includes(f)) { unlinkSync(join(PAGES_DST, f)); removed.push(f); }
}
console.log(`pages, ${srcPages.length} in source, ${copied} copied, ${unchanged} unchanged, ${removed.length} removed${removed.length ? ` (${removed.join(', ')})` : ''}`);

// 2. Data files copied as they are.
for (const [rel, name] of DATA_FILES) {
  const from = join(HC, rel);
  if (!existsSync(from)) fail(`missing data file ${from}`);
  JSON.parse(readFileSync(from, 'utf8')); // fail early on broken JSON
  copyFileSync(from, join(DATA_DST, name));
  console.log(`data, ${name} (${Math.round(statSync(from).size / 1024)} KB)`);
}

// 3. The moon code, copied verbatim so its logic stays the tool's logic.
const moonFrom = join(HC, 'tools/moon/moon.js');
if (!existsSync(moonFrom)) fail(`missing ${moonFrom}`);
copyFileSync(moonFrom, join(ROOT, 'src/lib/moon.js'));
console.log('code, src/lib/moon.js');

// 4. Checked photos, site/photos/<page-file-name>/hero.jpg with their credits in picks.json.
//    They land in src/assets/photos/<page-file-name>/ for the image pipeline. _rejected/ and cutouts/ are skipped.
const PHOTOS_SRC = join(HC, 'site/photos');
if (existsSync(PHOTOS_SRC)) {
  const picksFile = join(PHOTOS_SRC, 'picks.json');
  const picks = existsSync(picksFile) ? JSON.parse(readFileSync(picksFile, 'utf8')) : {};
  writeFileSync(join(DATA_DST, 'photo_picks.json'), `${JSON.stringify(picks, null, 1)}\n`);
  let n = 0;
  for (const dir of readdirSync(PHOTOS_SRC, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name.startsWith('_') || dir.name === 'cutouts') continue;
    for (const f of readdirSync(join(PHOTOS_SRC, dir.name))) {
      if (!/^hero\.(jpe?g|png|webp)$/i.test(f)) continue; // alt.jpg files are not used by the build
      const to = join(ROOT, 'src/assets/photos', dir.name);
      mkdirSync(to, { recursive: true });
      copyFileSync(join(PHOTOS_SRC, dir.name, f), join(to, f.toLowerCase()));
      n++;
    }
  }
  console.log(`photos, ${n} checked photo files copied, picks.json for ${Object.keys(picks).length} pages`);
}

// 5. A slim index of the stone sheets. Only verified values are kept.
const val = (field) => (field && field.verified && field.value ? field.value : null);
const stones = {};
for (const dir of STONE_SHEET_DIRS) {
  const abs = join(HC, dir);
  if (!existsSync(abs)) continue;
  for (const f of readdirSync(abs).filter((x) => x.endsWith('.json')).sort()) {
    let sheet;
    try { sheet = JSON.parse(readFileSync(join(abs, f), 'utf8')); } catch { console.warn(`skip broken sheet ${dir}/${f}`); continue; }
    const slug = sheet.slug || basename(f, '.json');
    if (stones[slug]) continue; // first folder wins
    const id = sheet.identity || {};
    const sys = sheet.systems || {};
    const mohs = id.mohs && id.mohs.verified && typeof id.mohs.min === 'number'
      ? { min: id.mohs.min, max: typeof id.mohs.max === 'number' ? id.mohs.max : id.mohs.min }
      : null;
    const colors = val(id.colors);
    stones[slug] = {
      slug,
      name: sheet.name || slug,
      aliases: Array.isArray(sheet.aliases) ? sheet.aliases : [],
      kind: sheet.kind || null,
      parent: sheet.parent || null,
      mohs,
      colors,
      colorFamilies: colorFamilies(colors || ''),
      chakra: val(sys.chakra),
      birthstone: val(sys.birthstone),
    };
  }
}
writeFileSync(join(DATA_DST, 'stones.json'), `${JSON.stringify({ generated: new Date().toISOString().slice(0, 10), count: Object.keys(stones).length, stones }, null, 1)}\n`);
console.log(`data, stones.json (${Object.keys(stones).length} stone sheets)`);
