#!/usr/bin/env node
// Builds src/data/birth_zodiac.json for the Birthstone & Zodiac Finder and the printable chart.
//
//   node scripts/build-birth-zodiac.mjs
//
// The only facts are the two verified charts already on the site, the month table of
// content/pages/birthstones.md and the sign table of content/pages/zodiac.md. Stone names are
// matched to stone sheets (src/data/stones.json, by slug, then by a unique alias) so the cards
// can link to a published stone page, show its swatches and its cut-out when one exists.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/data/birth_zodiac.json');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const small = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to']);
const titleCase = (s) => String(s).split(/(\s+|-)/).map((w, i) => (/^\s+$|^-$/.test(w) ? w : i > 0 && small.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1))).join('');

/** The rows of the first Markdown table whose first header cell matches. */
export function parseTable(md, firstHeader) {
  const lines = String(md).split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    const head = splitRow(lines[i]);
    if (!head || head[0].toLowerCase() !== firstHeader.toLowerCase()) continue;
    if (!/^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) continue;
    const rows = [];
    for (let j = i + 2; j < lines.length; j++) {
      const cells = splitRow(lines[j]);
      if (!cells) break;
      rows.push(Object.fromEntries(head.map((h, k) => [h, cells[k] ?? ''])));
    }
    return rows;
  }
  return [];
}

function splitRow(line) {
  const t = String(line).trim();
  if (!t.startsWith('|')) return null;
  return t.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

/** "[March](/birthstones/march/)" gives { text: "March", url: "/birthstones/march/" }. */
export function linkCell(cell) {
  const m = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(String(cell).trim());
  return m ? { text: m[1].trim(), url: m[2].trim() } : { text: String(cell).replace(/[*_]/g, '').trim(), url: null };
}

/** "Bloodstone, alternate aquamarine" gives [{ name: "Bloodstone" }, { name: "Aquamarine", alternate: true }]. */
export function stoneList(cell) {
  return String(cell).replace(/[*_]/g, '').split(/,\s*/).map((x) => x.trim()).filter(Boolean).map((x) => {
    const alt = /^alternate\s+/i.test(x);
    const name = titleCase(x.replace(/^alternate\s+/i, ''));
    return alt ? { name, alternate: true } : { name };
  });
}

/** "March 21 to April 19" gives { start: "03-21", end: "04-19" }. */
export function parseRange(text) {
  const m = /^([A-Z][a-z]+)\s+(\d{1,2})\s+to\s+([A-Z][a-z]+)\s+(\d{1,2})$/.exec(String(text).trim());
  if (!m) return null;
  const a = MONTHS.indexOf(m[1]);
  const b = MONTHS.indexOf(m[3]);
  if (a < 0 || b < 0) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return { start: `${pad(a + 1)}-${pad(Number(m[2]))}`, end: `${pad(b + 1)}-${pad(Number(m[4]))}` };
}

const keyOf = (s) => String(s).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Matches a stone name to a sheet slug, by slug first, then by an alias that only one sheet has. */
export function makeMatcher(stones) {
  const aliasMap = new Map();
  for (const [slug, s] of Object.entries(stones)) {
    for (const a of [s.name, ...(s.aliases || [])]) {
      const k = keyOf(String(a).replace(/\s*\([^)]*\)/g, ''));
      if (!aliasMap.has(k)) aliasMap.set(k, new Set());
      aliasMap.get(k).add(slug);
    }
  }
  return (name) => {
    const k = keyOf(name);
    if (stones[k]) return k;
    const hits = aliasMap.get(k);
    return hits && hits.size === 1 ? [...hits][0] : null;
  };
}

export function buildData({ birthstonesMd, zodiacMd, stones }) {
  const match = makeMatcher(stones);
  const withSlug = (list) => list.map((s) => ({ ...s, slug: match(s.name) }));
  const months = parseTable(birthstonesMd, 'Month').map((r, i) => {
    const m = linkCell(r.Month);
    const idx = MONTHS.indexOf(m.text);
    const cols = Object.keys(r);
    return {
      key: m.text.toLowerCase(),
      name: m.text,
      number: idx + 1,
      days: DAYS[idx] || 31,
      url: m.url,
      modern: withSlug(stoneList(r[cols[1]])),
      list1912: withSlug(stoneList(r[cols[2]])),
      older: withSlug(stoneList(r[cols[3]])),
      order: i,
    };
  }).filter((m) => m.number >= 1);
  const signs = parseTable(zodiacMd, 'Sign').map((r) => {
    const s = linkCell(r.Sign);
    const range = parseRange(r.Dates);
    return {
      key: s.text.toLowerCase(),
      name: s.text,
      url: s.url,
      dates: r.Dates,
      start: range?.start || null,
      end: range?.end || null,
      month: withSlug(stoneList(r['Month Birthstones'])),
      stone1913: withSlug(stoneList(r['1913 Zodiac Stone'])),
      linked: withSlug(stoneList(r['Linked Most Today'])),
    };
  }).filter((s) => s.start && s.end);
  return { months, signs };
}

function main() {
  const read = (f) => readFileSync(join(ROOT, f), 'utf8');
  const stones = JSON.parse(read('src/data/stones.json')).stones;
  const data = buildData({ birthstonesMd: read('content/pages/birthstones.md'), zodiacMd: read('content/pages/zodiac.md'), stones });
  if (data.months.length !== 12 || data.signs.length !== 12) {
    console.error(`birth_zodiac, expected 12 months and 12 signs, found ${data.months.length} and ${data.signs.length}`);
    process.exit(1);
  }
  const out = { generated: 'from content/pages/birthstones.md and content/pages/zodiac.md', ...data };
  const text = `${JSON.stringify(out, null, 1)}\n`;
  if (!existsSync(OUT) || readFileSync(OUT, 'utf8') !== text) writeFileSync(OUT, text);
  const unmatched = [...new Set([...data.months.flatMap((m) => [...m.modern, ...m.list1912, ...m.older]), ...data.signs.flatMap((s) => [...s.month, ...s.stone1913, ...s.linked])].filter((x) => !x.slug).map((x) => x.name))];
  console.log(`birth_zodiac, 12 months and 12 signs${unmatched.length ? `, no stone sheet for ${unmatched.join(', ')}` : ''}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
