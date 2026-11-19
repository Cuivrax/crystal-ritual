#!/usr/bin/env node
// Builds src/data/stone_extras.json, the extra blocks of the stone pages.
//
//   node scripts/build-stone-extras.mjs          (source defaults to /home/claude/hc)
//   HC_ROOT=/path/to/hc node scripts/build-stone-extras.mjs
//
// For each stone page it writes
//   keyNumbers  the stat cards beside "What X Actually Is", hand-picked in
//               scripts/stone-extras/curated.json, each one backed by proofs,
//   chain       the classification chain (Group, Species, Variety), curated or, for a plain
//               variety of an IMA species named in a verified reference-tier note, automatic,
//   map         pins for "Main Sources on the Map", read from the verified localities note,
//   colors      the verified colors note, used when the page has no Colors row.
// Only verified sheet values are read. A sheet proof is checked here (the sheets are not in
// the repo). A page proof is checked here and again at every build. Anything that fails a
// proof is left out, so a block disappears instead of showing something unsupported.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLACES } from './stone-extras/places.mjs';
import { normalizeText, pageProofHolds } from '../src/lib/proof.mjs';

export { normalizeText, pageProofHolds };

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HC = process.env.HC_ROOT || '/home/claude/hc';
const SHEET_DIRS = ['data_build/stones', 'data_build2/stones'];
const IMA_FILE = 'ima/ima_minerals_2026-07.csv';
const IMA_MATCH = 'ima/stones_ima_match.csv';
const OUT = join(ROOT, 'src/data/stone_extras.json');

// ------------------------------------------------------------ helpers
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

export function pageBody(md) {
  const m = /^---\n[\s\S]*?\n---\n?/.exec(md);
  return m ? md.slice(m[0].length) : md;
}

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** A sheet proof holds when the field is verified and its value or a verified quote contains the words. */
export function sheetProofHolds(sheet, field, contains) {
  const f = getPath(sheet, field);
  if (!f || f.verified !== true) return false;
  const hay = [f.value, ...(f.refs || []).filter((r) => r.verified).map((r) => r.quote)].map(normalizeText).join(' | ');
  return hay.includes(normalizeText(contains));
}


/** Checks a proof list. Sheet proofs and page proofs must all hold. */
function checkProofs(proofs, { sheets, text }) {
  const fails = [];
  for (const p of proofs || []) {
    if (p.page) { if (!pageProofHolds(text, p.page)) fails.push(`page "${p.page}"`); continue; }
    if (p.sheet) {
      const sheet = sheets.get(p.sheet);
      if (!sheet) { fails.push(`no sheet ${p.sheet}`); continue; }
      if (!sheetProofHolds(sheet, p.field, p.contains)) fails.push(`${p.sheet} ${p.field} "${p.contains}"`);
    }
  }
  return fails;
}

const pageProofsOf = (proofs) => (proofs || []).filter((p) => p.page).map((p) => p.page);

// ------------------------------------------------------------ localities
const SKIP_MAP_RX = /\bno source\b|\bnames? no\b|\bdo(?:es)? not say\b|\bno [a-z -]{0,30}localit(?:y|ies)\b/i;

/** Pins from a verified localities note, or null. Sentences about the parent ("in general") are left out. */
export function localityPins(note) {
  if (!note || note.verified !== true || !note.value) return null;
  const text = String(note.value);
  if (SKIP_MAP_RX.test(text)) return null;
  const kept = text.split(/(?<=\.)\s+(?=[A-Z])|;\s+/).filter((s) => !/\bin general\b/i.test(s)).join(' ').replace(/\bUS border\b/g, '');
  const hits = [];
  for (const place of PLACES) {
    for (const name of place.names) {
      const rx = new RegExp(`(?<![A-Za-z])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`, 'g');
      const m = rx.exec(kept);
      if (m) { hits.push({ place, index: m.index, name }); break; }
    }
  }
  hits.sort((a, b) => a.index - b.index);
  const anyState = hits.some((h) => h.place.us);
  const anyBritish = hits.some((h) => ['England', 'Scotland'].includes(h.place.label));
  const pins = new Map();
  for (const { place } of hits) {
    if (place.usCountry && anyState) continue;
    if (place.label === 'UK' && anyBritish) continue;
    const isRegion = place.names[0] !== place.label;
    const have = pins.get(place.label);
    if (!have) pins.set(place.label, { label: place.label, lon: place.lon, lat: place.lat, region: isRegion });
    else if (isRegion && !have.region) pins.set(place.label, { label: place.label, lon: place.lon, lat: place.lat, region: true });
  }
  const list = [...pins.values()].map(({ label, lon, lat }) => ({ label, lon, lat })).slice(0, 10);
  return list.length ? list : null;
}

/** The verified colors note without the sentences about the parent. */
export function sheetColors(note) {
  if (!note || note.verified !== true || !note.value) return null;
  const kept = String(note.value).split(/(?<=\.)\s+(?=[A-Z])/).filter((s) => !/\bin general\b/i.test(s)).join(' ').trim();
  return kept || null;
}

// ------------------------------------------------------------ chains
const NOT_PLAIN_RX = /\brock\b|not a species|inclusions?\b|trade name|treated|coating|aggregate|mineraloid/i;

/** The automatic chain, a plain variety of an IMA species named by a verified reference-tier note. */
export function autoChain(sheet, match, ima) {
  if (!sheet || sheet.kind !== 'variety' || !sheet.parent || !match) return null;
  const parent = String(sheet.parent).toLowerCase();
  if (match.ima_relation !== `related (${parent})`) return null;
  const species = ima.get(parent);
  if (!species) return null;
  const sr = sheet.identity?.species_or_rock;
  if (!sr || sr.verified !== true || sr.best_tier !== 'reference') return null;
  if (!new RegExp(`\\b${parent}\\b`, 'i').test(sr.value) || NOT_PLAIN_RX.test(sr.value)) return null;
  return [
    { level: 'Species', name: species.name, ima: species.name },
    { level: 'Variety', name: sheet.name, tag: `Variety of an IMA Mineral, ${species.name}`, dark: true },
  ];
}

function imaMonth(file) {
  const m = /(\d{4})-(\d{2})/.exec(file);
  if (!m) return null;
  const month = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][Number(m[2]) - 1];
  return `${month} ${m[1]}`;
}

// ------------------------------------------------------------ main
function main() {
  const sheets = new Map();
  for (const dir of SHEET_DIRS) {
    const abs = join(HC, dir);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs).filter((x) => x.endsWith('.json'))) {
      try {
        const s = JSON.parse(readFileSync(join(abs, f), 'utf8'));
        const slug = s.slug || f.replace(/\.json$/, '');
        if (!sheets.has(slug)) sheets.set(slug, s);
      } catch { console.warn(`skip broken sheet ${dir}/${f}`); }
    }
  }
  const ima = new Map(parseCsv(readFileSync(join(HC, IMA_FILE), 'utf8')).map((r) => [r.name.toLowerCase(), { name: r.name, formula: r.formula, status: r.status }]));
  const matches = new Map(parseCsv(readFileSync(join(HC, IMA_MATCH), 'utf8')).map((r) => [r.slug, r]));
  const curated = JSON.parse(readFileSync(join(ROOT, 'scripts/stone-extras/curated.json'), 'utf8'));

  const pagesDir = join(ROOT, 'content/pages');
  const out = {};
  const report = [];
  for (const f of readdirSync(pagesDir).filter((x) => /^stones__[^_].*\.md$/.test(x) && !x.startsWith('stones__family__'))) {
    const id = f.replace(/\.md$/, '');
    const slug = id.replace(/^stones__/, '');
    const md = readFileSync(join(pagesDir, f), 'utf8');
    if (!/^page_type:\s*"?stone"?/m.test(md)) continue;
    const text = pageBody(md);
    const sheet = sheets.get(slug) || null;
    const cur = curated[id] || {};
    const entry = {};
    const notes = [];

    // Key numbers
    const keyNumbers = [];
    for (const k of cur.keyNumbers || []) {
      const fails = checkProofs(k.proof, { sheets, text });
      if (fails.length) { notes.push(`key number ${k.value} dropped, ${fails.join(', ')}`); continue; }
      keyNumbers.push({ value: k.value, text: k.text, pageProof: pageProofsOf(k.proof) });
    }
    if (keyNumbers.length) entry.keyNumbers = keyNumbers.slice(0, 2);

    // Classification chain
    let chain = null;
    let chainSource = null;
    if (cur.chain) {
      const fails = [];
      const pageProof = [];
      const nodes = cur.chain.map((n) => {
        if (n.join) return { join: n.join };
        fails.push(...checkProofs(n.proof, { sheets, text }));
        pageProof.push(...pageProofsOf(n.proof));
        const node = { level: n.level, name: n.name };
        if (n.ima) {
          const sp = ima.get(n.ima.toLowerCase());
          if (!sp) fails.push(`${n.ima} is not in the IMA list`);
          else { node.ima = sp.name; node.formula = sp.formula; }
        }
        if (n.imaAbsent) {
          if (ima.has(n.imaAbsent.toLowerCase())) fails.push(`${n.imaAbsent} is in the IMA list`);
          else node.imaAbsent = true;
        }
        for (const key of ['sub', 'tag', 'chip', 'dark']) if (n[key] !== undefined) node[key] = n[key];
        return node;
      });
      if (fails.length) notes.push(`curated chain dropped, ${fails.join(', ')}`);
      else { chain = { nodes, pageProof }; chainSource = 'curated'; }
    } else {
      const nodes = autoChain(sheet, matches.get(slug), ima);
      if (nodes) {
        for (const n of nodes) {
          if (n.ima) { const sp = ima.get(n.ima.toLowerCase()); n.formula = sp.formula; }
        }
        chain = { nodes, pageProof: [] };
        chainSource = 'automatic';
      }
    }
    if (chain) {
      chain.imaNote = chain.nodes.some((n) => n.ima || n.imaAbsent);
      entry.chain = chain;
    }

    // Map
    const pins = sheet ? localityPins(sheet.identity?.localities) : null;
    if (pins) entry.map = { pins };

    // Colors
    const colors = sheet ? sheetColors(sheet.identity?.colors) : null;
    if (colors) entry.colors = colors;

    out[id] = entry;
    report.push(`${slug.padEnd(24)} key ${String(keyNumbers.length).padEnd(2)} chain ${(chainSource || '-').padEnd(10)} map ${pins ? pins.map((p) => p.label).join(', ') : '-'}${notes.length ? `\n${''.padEnd(26)}${notes.join('\n'.padEnd(27))}` : ''}`);
  }
  const data = { generated: new Date().toISOString().slice(0, 10), imaList: `IMA List of Minerals, ${imaMonth(IMA_FILE)}`, pages: out };
  writeFileSync(OUT, `${JSON.stringify(data, null, 1)}\n`);
  console.log(report.join('\n'));
  console.log(`stone extras for ${Object.keys(out).length} stone pages written to src/data/stone_extras.json`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
