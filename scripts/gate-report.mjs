#!/usr/bin/env node
// Prints the publish gate before the Astro build, the same rules the site applies
// (src/lib/gate.mjs). Also writes reports/held-pages.md (git-ignored).
//   node scripts/gate-report.mjs
//   BUILD_NOW=2026-12-06T07:00 node scripts/gate-report.mjs
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { partition, parseBuildNow, isPreview, formatHeldTable, summarizeHeld, NY } from '../src/lib/gate.mjs';
import { idToUrl } from '../src/lib/urls.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'content/pages');

export function readPages(dir = DIR) {
  return readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => {
    const text = readFileSync(join(dir, f), 'utf8');
    const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
    if (!m) throw new Error(`${f} has no frontmatter`);
    return { id: f.replace(/\.md$/, ''), data: YAML.parse(m[1]) || {}, body: m[2] };
  });
}

const preview = isPreview();
const now = parseBuildNow(process.env.BUILD_NOW);
const pages = readPages();
const { built, held } = partition(pages, { now, preview });
const nowText = new Intl.DateTimeFormat('en-US', { timeZone: NY, dateStyle: 'medium', timeStyle: 'short' }).format(now);
const lines = [];
lines.push(`Publish gate, now is ${nowText} New York${process.env.BUILD_NOW ? ' (BUILD_NOW)' : ''}${preview ? ', PREVIEW=1 builds every page' : ''}`);
lines.push(`${pages.length} pages, ${built.length} built, ${held.length} held`);
if (held.length) {
  const c = summarizeHeld(held);
  lines.push(`Held because of status ${c.draft}, future date ${c.future}, placeholders ${c.placeholder}${c['bad-date'] ? `, bad date ${c['bad-date']}` : ''} (a page can have several reasons)`);
  lines.push('');
  lines.push(formatHeldTable(held, (e) => idToUrl(e.id)));
}
if (built.length) {
  lines.push('');
  lines.push(`Built pages, ${built.map((b) => idToUrl(b.entry.id)).join(' ')}`);
}
const out = lines.join('\n');
console.log(out);
mkdirSync(join(ROOT, 'reports'), { recursive: true });
writeFileSync(join(ROOT, 'reports/held-pages.md'), `${out}\n`);
