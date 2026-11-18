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
      // Lazy images below the fold would stay blank in a full-page shot, load them all first.
      await page.evaluate(async () => {
        await document.fonts.ready;
        document.querySelectorAll('img[loading="lazy"]').forEach((img) => { img.loading = 'eager'; });
        await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; }))));
        // Walk down the page once so every image is decoded and painted before the full-page capture.
        for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 60));
        }
        await Promise.all([...document.images].map((img) => img.decode().catch(() => null)));
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(400);
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
