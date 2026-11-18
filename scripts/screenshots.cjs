#!/usr/bin/env node
// Screenshots of the built site at 1440 and 390 wide.
//   node scripts/screenshots.cjs [dist] [out-folder] [/path/ ...]
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { serve } = require('./serve-dist.cjs');

const root = path.resolve(process.argv[2] || 'dist');
const out = path.resolve(process.argv[3] || '/home/claude/hc/site/shots');
const DEFAULT = ['/', '/stones/amethyst/', '/crystals-for/sleep/', '/compare/garnet-vs-ruby/', '/moon/'];
const pages = process.argv.slice(4).length ? process.argv.slice(4) : DEFAULT;
const WIDTHS = [1440, 390];

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { server, port } = await serve(root);
  const browser = await chromium.launch();
  for (const p of pages) {
    if (!fs.existsSync(path.join(root, p, 'index.html'))) { console.log(`skip ${p}, not built`); continue; }
    for (const w of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: w > 500 ? 900 : 844 }, deviceScaleFactor: 1, timezoneId: 'America/New_York' });
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${port}${p}`, { waitUntil: 'networkidle' });
      await page.evaluate(async () => { await document.fonts.ready; });
      const name = `${p === '/' ? 'home' : p.replace(/^\/|\/$/g, '').replace(/\//g, '__')}-${w}.png`;
      const file = path.join(out, name);
      await page.screenshot({ path: file, fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      console.log(`${name}${overflow > 0 ? `  horizontal overflow ${overflow}px` : ''}`);
      await ctx.close();
    }
  }
  await browser.close();
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });
