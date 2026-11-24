#!/usr/bin/env node
// Screenshots of the interactive states (open menu, tool results), to compare two builds.
//   node scripts/interaction-shots.cjs [dist] [out-folder]
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { serve } = require('./serve-dist.cjs');

const root = path.resolve(process.argv[2] || 'dist');
const out = path.resolve(process.argv[3] || '/tmp/interaction-shots');

const STEPS = [
  { name: 'menu-open', url: '/', width: 390, run: async (p) => { await p.click('.menu-toggle'); } },
  { name: 'care-checker-result', url: '/tools/crystal-care-checker/', width: 390, full: true, run: async (p) => {
    await p.fill('#stone-search', 'ameth'); await p.waitForTimeout(200); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
    await p.fill('#stone-search', 'selen'); await p.waitForTimeout(200); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
    const m = await p.$('#methods-contact button, #methods-contact label'); if (m) await m.click();
  } },
  { name: 'care-checker-result-wide', url: '/tools/crystal-care-checker/', width: 1440, full: true, run: async (p) => {
    await p.fill('#stone-search', 'mala'); await p.waitForTimeout(200); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
    const m = await p.$('#methods-contact button, #methods-contact label'); if (m) await m.click();
  } },
  { name: 'care-table-filter', url: '/tools/crystal-care-checker/', width: 1440, full: true, run: async (p) => { if (await p.$('#ct-search')) await p.fill('#ct-search', 'quartz'); } },
  { name: 'finder-result', url: '/tools/birthstone-finder/', width: 390, full: true, run: async (p) => {
    await p.selectOption('#f-month', { index: 4 }); await p.selectOption('#f-day', { index: 12 }); await p.click('#finder-form button[type="submit"], #finder-form .btn');
  } },
  { name: 'finder-result-wide', url: '/tools/birthstone-finder/', width: 1440, full: true, run: async (p) => {
    await p.selectOption('#f-month', { index: 11 }); await p.selectOption('#f-day', { index: 3 }); await p.click('#finder-form button[type="submit"], #finder-form .btn');
  } },
  { name: 'atlas-filter', url: '/stones/', width: 1440, full: true, run: async (p) => { await p.fill('#atlas-q', 'jasper'); } },
  { name: 'atlas-filter-phone', url: '/stones/', width: 390, full: true, run: async (p) => { await p.selectOption('#atlas-color', { index: 2 }); } },
  { name: 'atlas-none', url: '/stones/', width: 390, run: async (p) => { await p.fill('#atlas-q', 'zzzzzz'); } },
  { name: 'moon-birthday', url: '/moon/birthday-moon/', width: 390, full: true, run: async (p) => { await p.fill('#bday', '1990-06-15'); await p.click('#bday-form button'); } },
  { name: 'moon-birthday-wide', url: '/moon/birthday-moon/', width: 1440, full: true, run: async (p) => { await p.fill('#bday', '2001-01-28'); await p.click('#bday-form button'); } },
  { name: 'moon-calendar', url: '/moon/full-moon-calendar/', width: 390, full: true, run: async () => {} },
  { name: 'fold-open', url: '/stones/amethyst/', width: 390, full: true, run: async (p) => { for (const s of await p.$$('details.fold > summary, .fold-btn')) { await s.click().catch(() => {}); } } },
  { name: 'focus-ring', url: '/stones/amethyst/', width: 1440, run: async (p) => { for (let i = 0; i < 4; i += 1) await p.keyboard.press('Tab'); } },
  { name: 'contact-error', url: '/contact/', width: 390, full: true, run: async (p) => { const b = await p.$('.contact-form button[type="submit"], .contact-form .btn'); if (b) await b.click(); } },
];

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { server, port } = await serve(root);
  const browser = await chromium.launch();
  for (const s of STEPS) {
    if (!fs.existsSync(path.join(root, s.url, 'index.html'))) { console.log(`skip ${s.name}, page not built`); continue; }
    const ctx = await browser.newContext({ viewport: { width: s.width, height: s.width > 500 ? 900 : 844 }, deviceScaleFactor: 1, timezoneId: 'America/New_York' });
    const page = await ctx.newPage();
    await page.clock.install({ time: new Date('2026-11-24T15:00:00Z') });
    await page.goto(`http://127.0.0.1:${port}${s.url}`, { waitUntil: 'networkidle' });
    await page.evaluate(async () => { await document.fonts.ready; document.querySelectorAll('img[loading="lazy"]').forEach((img) => { img.loading = 'eager'; }); });
    let note = '';
    try { await s.run(page); } catch (e) { note = `  step failed, ${String(e.message).split('\n')[0]}`; }
    await page.waitForTimeout(500);
    await page.evaluate(() => Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; })))));
    await page.screenshot({ path: path.join(out, `${s.name}.png`), fullPage: Boolean(s.full) });
    console.log(`${s.name}${note}`);
    await ctx.close();
  }
  await browser.close();
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });
