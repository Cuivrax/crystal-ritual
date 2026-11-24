#!/usr/bin/env node
// Keeps, in each built page, only the CSS rules that page can use.
//   node scripts/prune-css.mjs [dist]
//
// The site inlines its whole stylesheet in every page (no render-blocking request). Most pages use
// about half of it, a stone page never shows the moon tools or the home page bands. This step reads
// each built page and drops the rules whose classes appear nowhere in that page, neither in its
// markup nor in the scripts it loads. It runs after "astro build" and changes nothing else.
//
// A rule is dropped only when it cannot match. The test looks at class names alone, a class a rule
// needs must exist in the page. Tags, ids, attributes and pseudo-classes always count as present,
// and so does anything written inside :is(), :where(), :not() or :has().
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const KEEP_WHOLE = new Set(['font-face', 'keyframes', 'property', 'page', 'view-transition', 'counter-style', 'font-feature-values']);

/** Removes every "(...)" group, with its nested groups, from a selector. */
function dropParens(text) {
  let out = '';
  let depth = 0;
  for (const ch of text) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0) out += ch;
  }
  return out;
}

/** The class names one selector needs. Returns null when the selector is too unusual to judge. */
export function requiredClasses(selector) {
  if (selector.includes('\\')) return null;
  const bare = dropParens(selector.replace(/\[[^\]]*\]/g, ''));
  return [...bare.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]);
}

/** Splits a selector list on the commas that are not inside brackets or parentheses. */
export function splitSelectors(list) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of list) {
    if (ch === '(' || ch === '[') depth += 1;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) { parts.push(current); current = ''; } else current += ch;
  }
  parts.push(current);
  return parts.map((s) => s.trim()).filter(Boolean);
}

function pruneContainer(container, has) {
  container.each((node) => {
    if (node.type === 'rule') {
      const kept = splitSelectors(node.selector).filter((sel) => {
        const needed = requiredClasses(sel);
        return needed === null || needed.every(has);
      });
      if (!kept.length) node.remove();
      else node.selector = kept.join(',');
    } else if (node.type === 'atrule' && node.nodes && !KEEP_WHOLE.has(node.name.replace(/^-\w+-/, ''))) {
      pruneContainer(node, has);
      if (!node.nodes.length) node.remove();
    }
  });
}

/** The stylesheet without the rules no element of the page can match. "has" tells whether a class name exists in the page. */
export function pruneCss(css, has) {
  const root = postcss.parse(css);
  pruneContainer(root, has);
  return root.toString();
}

const WORD = /-?[_a-zA-Z][\w-]*/g;

/** Every class name the page can show, from its markup and from the scripts it loads. */
export function pageTokens(html, readScript = () => '') {
  const tokens = new Set();
  const add = (text) => { for (const w of text.match(WORD) || []) tokens.add(w); };
  for (const m of html.matchAll(/\sclass="([^"]*)"/g)) add(m[1]);
  const seen = new Set();
  const visit = (src) => {
    if (seen.has(src)) return;
    seen.add(src);
    const code = readScript(src);
    add(code);
    for (const m of code.matchAll(/["'](?:\.\/|\/_astro\/)([\w.-]+\.js)["']/g)) visit(`/_astro/${m[1]}`);
  };
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    add(m[2]);
    const src = /\ssrc="([^"]+)"/.exec(m[1]);
    if (src) visit(src[1]);
    for (const imp of m[2].matchAll(/["'](\/_astro\/[\w.-]+\.js)["']/g)) visit(imp[1]);
  }
  return tokens;
}

/** One built page with its inline styles pruned. */
export function prunePage(html, readScript) {
  const tokens = pageTokens(html, readScript);
  const has = (name) => tokens.has(name);
  return html.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/g, (all, open, css, close) => `${open}${pruneCss(css, has)}${close}`);
}

function* htmlFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(full);
    else if (entry.name.endsWith('.html')) yield full;
  }
}

function main() {
  const dist = path.resolve(process.argv[2] || 'dist');
  const scripts = new Map();
  const readScript = (src) => {
    if (!scripts.has(src)) {
      const file = path.join(dist, src.replace(/^\//, '').split('?')[0]);
      scripts.set(src, file.startsWith(dist) && fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
    }
    return scripts.get(src);
  };
  let pages = 0;
  let before = 0;
  let after = 0;
  for (const file of htmlFiles(dist)) {
    const html = fs.readFileSync(file, 'utf8');
    const pruned = prunePage(html, readScript);
    before += html.length;
    after += pruned.length;
    pages += 1;
    if (pruned !== html) fs.writeFileSync(file, pruned);
  }
  const kb = (n) => `${Math.round(n / 1024)} KB`;
  console.log(`prune-css, ${pages} pages, ${kb(before)} before, ${kb(after)} after`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
