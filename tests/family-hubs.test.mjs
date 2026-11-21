// Family hubs, the "All Types of Jade" section of head stone pages.
// The last test reads the build in dist/ and skips when there is none (CI tests before it builds).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  familyVarieties, familyName, familyHeading, fallbackName, nameFromH1, nameFromSlug, orderCards, familySpot, comingTileHtml,
  MIN_VARIETIES, FAMILY_ID, FAMILY_INTRO, FAMILY_COMING,
} from '../src/lib/families.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FAMILIES_FILE = join(ROOT, 'src/data/stone_families.json');
const NAMES_FILE = join(ROOT, 'src/data/stone_family_names.json');
const families = JSON.parse(readFileSync(FAMILIES_FILE, 'utf8'));
const planNames = JSON.parse(readFileSync(NAMES_FILE, 'utf8')).names;
const stones = JSON.parse(readFileSync(join(ROOT, 'src/data/stones.json'), 'utf8')).stones;
const FORBIDDEN = /[:—·]/;

const headingOf = (slug) => familyHeading(familyName(slug, { sheetName: stones[slug]?.name || null, planName: planNames[slug] }));

test('a family needs three varieties, the head and repeats left out', () => {
  const fams = { jade: ['green-jade', 'white-jade', 'jade', 'green-jade', 'red-jade'], ruby: ['star-ruby', 'ruby'], none: 'x' };
  assert.deepEqual(familyVarieties('jade', fams), ['green-jade', 'white-jade', 'red-jade']);
  assert.equal(familyVarieties('ruby', fams), null);
  assert.equal(familyVarieties('none', fams), null);
  assert.equal(familyVarieties('quartz', fams), null);
  assert.equal(familyVarieties('constructor', fams), null);
  assert.equal(MIN_VARIETIES, 3);
});

test('names come from the sheet, then the plan, then the slug', () => {
  assert.equal(nameFromH1('Apricot Agate Meaning, Properties & What It Really Is'), 'Apricot Agate');
  assert.equal(nameFromH1("Tiger's Eye Meaning, Properties and Real-Life Uses"), "Tiger's Eye");
  assert.equal(nameFromSlug('k2-jasper'), 'K2 Jasper');
  assert.equal(nameFromSlug('ruby-in-kyanite'), 'Ruby in Kyanite');
  assert.equal(fallbackName('apricot-agate', { 'apricot-agate': 'Apricot Agate' }), 'Apricot Agate');
  assert.equal(fallbackName('star-jasper', {}), 'Star Jasper');
  // The heading spells the family as the atlas does, and ignores plan H1s that do not name it.
  assert.equal(familyName('tigers-eye', { sheetName: "Tiger's Eye" }), "Tiger's Eye");
  assert.equal(familyName('tigers-eye', { planName: "Tiger's Eye" }), "Tiger's Eye");
  assert.equal(familyName('quartz', { planName: 'Types of Quartz' }), 'Quartz');
  assert.equal(familyName('aventurine', { planName: 'Aventurine Stone' }), 'Aventurine');
  assert.equal(familyHeading("Tiger's Eye"), "All Types of Tiger's Eye");
  assert.equal(headingOf('jade'), 'All Types of Jade');
});

test('published varieties come first, then the rest A to Z', () => {
  const cards = [
    { name: 'Red Jade', guide: false }, { name: 'White Jade', guide: true }, { name: 'Black Jade', guide: false }, { name: 'Green Jade', guide: true },
  ];
  assert.deepEqual(orderCards(cards).map((c) => c.name), ['Green Jade', 'White Jade', 'Black Jade', 'Red Jade']);
});

test('the section sits after the Look-Alikes, else before the Price Guide, else last', () => {
  const k = (...kinds) => kinds.map((kind) => ({ kind }));
  assert.equal(familySpot(k('facts', 'what', 'care', 'lookalikes', 'price')), 4);
  assert.equal(familySpot(k('facts', 'what', 'care', 'price')), 3);
  assert.equal(familySpot(k('facts', 'what')), 2);
});

test('a variety without a page is a compact tile, its name and Full Guide Coming only', () => {
  const html = comingTileHtml({ slug: 'cats-eye-jade', name: "Cat's Eye Jade" });
  assert.equal(html, '<li class="family-tile" data-slug="cats-eye-jade"><span class="family-tile-name">Cat&#39;s Eye Jade</span><span class="mini-chip tone-gold">Full Guide Coming</span></li>');
  assert.equal(FAMILY_COMING, 'Coming Next');
});

test('every family member has a name and the section words have no colon, em dash or middle dot', () => {
  assert.doesNotMatch(FAMILY_INTRO, FORBIDDEN);
  assert.doesNotMatch(FAMILY_COMING, FORBIDDEN);
  for (const [head, list] of Object.entries(families)) {
    assert.doesNotMatch(headingOf(head), FORBIDDEN, head);
    for (const slug of list) {
      const name = stones[slug]?.name || fallbackName(slug, planNames);
      assert.ok(name, `${slug} has no name`);
      assert.doesNotMatch(name, FORBIDDEN, slug);
    }
  }
});

// ------------------------------------------------------------ the build in dist/
const DIST = join(ROOT, 'dist');
const sectionOf = (html) => (html.match(new RegExp(`<section class="section family-types[^"]*" aria-labelledby="${FAMILY_ID}">[\\s\\S]*?</section>`)) || [null])[0];
const visibleText = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

test('every family renders on its built head page, published varieties as links', (t) => {
  if (!existsSync(join(DIST, 'stones'))) { t.skip('no build in dist/'); return; }
  const dataTime = Math.max(statSync(FAMILIES_FILE).mtimeMs, statSync(NAMES_FILE).mtimeMs);
  const isLive = (slug) => existsSync(join(DIST, 'stones', slug, 'index.html'));
  let checked = 0;
  for (const head of Object.keys(families)) {
    const file = join(DIST, 'stones', head, 'index.html');
    if (!existsSync(file)) continue; // the head page is not published yet, the section waits for it
    if (statSync(file).mtimeMs < dataTime) { t.skip('dist/ is older than the family data, rebuild to check'); return; }
    const html = readFileSync(file, 'utf8');
    const varieties = familyVarieties(head, families);
    const section = sectionOf(html);
    if (!varieties) { assert.equal(section, null, `/stones/${head}/ has fewer than ${MIN_VARIETIES} varieties and no section`); continue; }
    assert.ok(section, `/stones/${head}/ has no All Types section`);
    const h2 = section.match(new RegExp(`<h2 class="section-title" id="${FAMILY_ID}">([\\s\\S]*?)</h2>`));
    assert.equal(h2 && visibleText(h2[1]), headingOf(head), `/stones/${head}/ heading`);
    assert.doesNotMatch(visibleText(section), FORBIDDEN, `/stones/${head}/ section text`);
    // Published varieties, full atlas cards with their link, A to Z.
    const live = [...section.matchAll(/<article class="([^"]*)" data-slug="([^"]+)">([\s\S]*?)<\/article>/g)].map((m) => ({ slug: m[2], html: m[3], at: m.index }));
    // The others, compact tiles under Coming Next, A to Z.
    const tiles = [...section.matchAll(/<li class="family-tile" data-slug="([^"]+)">([\s\S]*?)<\/li>/g)].map((m) => ({ slug: m[1], html: m[2], at: m.index }));
    assert.deepEqual([...live, ...tiles].map((c) => c.slug).sort(), [...varieties].sort(), `/stones/${head}/ shows every variety once`);
    for (const c of live) {
      assert.ok(isLive(c.slug), `${c.slug} has a full card but no published page`);
      assert.ok(c.html.includes(`href="/stones/${c.slug}/"`), `${c.slug} is published, its card links to it`);
      assert.doesNotMatch(c.html, /Full Guide Coming/);
    }
    for (const c of tiles) {
      assert.equal(isLive(c.slug), false, `${c.slug} is published but shown as a tile`);
      assert.doesNotMatch(c.html, /<a\s/, `${c.slug} is not published, its tile has no link`);
      assert.match(c.html, /Full Guide Coming/);
      assert.doesNotMatch(c.html, /Hardness|mini-dots|<p[\s>]|<img/, `${c.slug} tile shows its name and the chip only`);
    }
    const nameOf = (c) => visibleText((c.html.match(/<h3>[\s\S]*?<\/h3>|<span class="family-tile-name">[\s\S]*?<\/span>/) || [''])[0]);
    const sorted = (list) => list.map(nameOf).every((n, i, a) => i === 0 || a[i - 1].localeCompare(n) <= 0);
    assert.ok(sorted(live), `/stones/${head}/ published cards A to Z`);
    assert.ok(sorted(tiles), `/stones/${head}/ tiles A to Z`);
    const label = section.indexOf(`<h3 class="family-coming-title">${FAMILY_COMING}</h3>`);
    assert.equal(label >= 0, tiles.length > 0, `/stones/${head}/ has Coming Next only above tiles`);
    if (tiles.length) assert.ok(live.every((c) => c.at < label) && tiles.every((c) => c.at > label), `/stones/${head}/ published cards first, then Coming Next`);
    checked++;
  }
  // A stone page that heads no family keeps its usual layout.
  for (const dir of readdirSync(join(DIST, 'stones'))) {
    const file = join(DIST, 'stones', dir, 'index.html');
    if (familyVarieties(dir, families) || !existsSync(file)) continue;
    assert.equal(sectionOf(readFileSync(file, 'utf8')), null, `/stones/${dir}/ heads no family`);
  }
  t.diagnostic(`${checked} built head pages checked`);
});
