#!/usr/bin/env node
// Internal link check over the built site.
//
//   node scripts/check-links.mjs [dist]
//
// Every href, src and srcset that points inside the site must resolve to a built file,
// and every #fragment on a page link must exist on the target page. External links are
// only counted. Exits with code 1 when something is broken.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DIST = process.argv[2] || 'dist';
const SITE_HOSTS = new Set(['crystalandritual.com', 'www.crystalandritual.com']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(DIST);
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const fileSet = new Set(files.map((f) => `/${relative(DIST, f).split(sep).join('/')}`));

/** The built file behind a site path, or null. */
function resolve(pathname) {
  let p = decodeURIComponent(pathname);
  if (fileSet.has(p)) return p;
  if (p.endsWith('/') && fileSet.has(`${p}index.html`)) return `${p}index.html`;
  return null;
}

const idCache = new Map();
function idsOf(file) {
  if (!idCache.has(file)) {
    const html = readFileSync(join(DIST, file), 'utf8');
    const ids = new Set();
    for (const m of html.matchAll(/\s(?:id|name)="([^"]+)"/g)) ids.add(m[1]);
    idCache.set(file, ids);
  }
  return idCache.get(file);
}

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

const broken = [];
const noSlash = [];
let internal = 0;
let external = 0;
const externalHosts = new Map();

for (const abs of htmlFiles) {
  const page = `/${relative(DIST, abs).split(sep).join('/')}`;
  const pageUrl = new URL(page.replace(/index\.html$/, ''), 'https://www.crystalandritual.com');
  const html = readFileSync(abs, 'utf8')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const refs = [];
  for (const m of html.matchAll(/\s(href|src|action)="([^"]*)"/g)) refs.push([m[1], decode(m[2])]);
  for (const m of html.matchAll(/\ssrcset="([^"]*)"/g)) {
    for (const part of decode(m[1]).split(',')) {
      const u = part.trim().split(/\s+/)[0];
      if (u) refs.push(['srcset', u]);
    }
  }
  for (const [attr, raw] of refs) {
    if (!raw || /^(mailto|tel|javascript|data):/i.test(raw)) continue;
    let url;
    try { url = new URL(raw, pageUrl); } catch { broken.push({ page, raw, why: 'bad URL' }); continue; }
    if (!/^https?:$/.test(url.protocol)) continue;
    if (!SITE_HOSTS.has(url.hostname)) {
      external++;
      externalHosts.set(url.hostname, (externalHosts.get(url.hostname) || 0) + 1);
      continue;
    }
    internal++;
    if (attr === 'action' && url.pathname === '/contact/send.php') {
      if (!fileSet.has('/contact/send.php')) broken.push({ page, raw, why: 'form handler missing' });
      continue;
    }
    const target = resolve(url.pathname);
    if (!target) { broken.push({ page, raw, why: 'no such file' }); continue; }
    if (attr === 'href' && !/\.[a-z0-9]{2,5}$/i.test(url.pathname) && !url.pathname.endsWith('/')) {
      noSlash.push({ page, raw });
    }
    if (url.hash && url.hash.length > 1 && target.endsWith('.html')) {
      const id = decodeURIComponent(url.hash.slice(1));
      if (!idsOf(target).has(id)) broken.push({ page, raw, why: `no #${id} on ${target}` });
    }
  }
}

// The sitemap must list only built pages.
const sitemapMisses = [];
if (existsSync(join(DIST, 'sitemap.xml'))) {
  const xml = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const u = new URL(m[1]);
    if (!resolve(u.pathname)) sitemapMisses.push(m[1]);
  }
}

console.log(`link check over ${DIST}, ${htmlFiles.length} HTML files, ${internal} internal references, ${external} external links`);
const topHosts = [...externalHosts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
if (topHosts.length) console.log(`external hosts, ${topHosts.map(([h, n]) => `${h} ${n}`).join(', ')}`);
for (const b of broken.slice(0, 80)) console.log(`BROKEN  ${b.page}  ${b.raw}  (${b.why})`);
if (broken.length > 80) console.log(`... and ${broken.length - 80} more`);
for (const n of noSlash.slice(0, 20)) console.log(`NO SLASH  ${n.page}  ${n.raw}`);
for (const s of sitemapMisses) console.log(`SITEMAP  ${s} is not built`);
const bad = broken.length + noSlash.length + sitemapMisses.length;
console.log(bad ? `${broken.length} broken, ${noSlash.length} without trailing slash, ${sitemapMisses.length} sitemap misses` : 'no internal 404s');
process.exit(bad ? 1 : 0);
