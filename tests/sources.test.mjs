import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeSourcePolicy, sourceItemVerdict, shownSourceUrls, domainsInText, GUIDES_LINE } from '../src/lib/sources.mjs';
import { toHast, splitSections } from '../src/lib/md/pipeline.mjs';
import { filterSourcesNodes } from '../src/lib/md/sources-section.mjs';
import { html } from '../src/lib/md/hast.mjs';

const tiers = JSON.parse(readFileSync(new URL('../src/data/source_tiers.json', import.meta.url), 'utf8'));
const policy = makeSourcePolicy(tiers);

test('reference tier, books, papers and .gov or .edu are shown', () => {
  for (const u of [
    'https://www.gia.edu/amethyst/gem-overview', 'https://my.gia.edu/x', 'https://www.gemsociety.org/article/x',
    'https://geology.com/gemstones/amethyst/', 'https://www.gutenberg.org/ebooks/57978', 'https://archive.org/details/x',
    'https://doi.org/10.1016/j.x', 'https://pubmed.ncbi.nlm.nih.gov/40855750/', 'https://www.cdc.gov/sleep/',
    'https://home.wgnhs.wisc.edu/x', 'https://www.perseus.tufts.edu/hopper/text?doc=Plin.+Nat.+37', 'https://aa.usno.navy.mil/data',
  ]) assert.equal(policy.isReferenceUrl(u), true, u);
});

test('dealers, crystal guides and Wikipedia are never shown', () => {
  for (const u of [
    'https://www.gemrockauctions.com/learn/x', 'https://www.firemountaingems.com/x', 'https://www.crystals.com/blogs/x',
    'https://www.crystalvaults.com/x', 'https://en.wikipedia.org/wiki/Stilbite', 'https://moonrisecrystals.com/x',
  ]) assert.equal(policy.isReferenceUrl(u), false, u);
  assert.deepEqual(shownSourceUrls(['https://www.gia.edu/a', 'https://www.crystals.com/b', 'https://www.gia.edu/a'], policy), ['https://www.gia.edu/a']);
});

test('item verdicts', () => {
  assert.equal(sourceItemVerdict({ links: ['https://www.gia.edu/a'], text: 'GIA, Amethyst' }, policy), 'keep');
  assert.equal(sourceItemVerdict({ links: ['https://www.gemrockauctions.com/a'], text: 'Gem Rock Auctions, prehnite, a dealer guide' }, policy), 'drop');
  assert.equal(sourceItemVerdict({ links: ['https://en.wikipedia.org/wiki/Stilbite'], text: 'Wikipedia, Stilbite, used as a pointer only' }, policy), 'drop');
  assert.equal(sourceItemVerdict({ links: ['https://geology.com/x'], text: 'Geology.com and Wikipedia, used as pointers' }, policy), 'drop');
  assert.equal(sourceItemVerdict({ links: [], text: 'George Frederick Kunz, The Curious Lore of Precious Stones (1913), page 297' }, policy), 'keep');
  assert.equal(sourceItemVerdict({ links: [], text: 'IMA List of Minerals, July 2026' }, policy), 'keep');
  assert.equal(sourceItemVerdict({ links: [], text: 'Modern associations compared across the crystal guides in our lore collection, including crystals.com' }, policy), 'replace');
  assert.equal(sourceItemVerdict({ links: [], text: 'Sign dates as given in mainly crystalvaults.com and astrology.com' }, policy), 'drop');
  assert.deepEqual(domainsInText('read on crystals.com, Geology.com and wemystic.fr'), ['crystals.com', 'geology.com', 'wemystic.fr']);
});

const SAMPLE = `# Test

Lead paragraph that is long enough to be a lead for the test page.

## Sources

- Gemological Institute of America, [Amethyst](https://www.gia.edu/amethyst/gem-overview)
- Wikipedia, [Stilbite](https://en.wikipedia.org/wiki/Stilbite), used as a pointer only
- Gem Rock Auctions, [prehnite](https://www.gemrockauctions.com/learn/a-z-of-gemstones/prehnite), a dealer guide
- George Frederick Kunz, *The Curious Lore of Precious Stones* (1913), page 297
- Pliny the Elder, *Natural History*, Book 37, [Perseus](https://www.perseus.tufts.edu/hopper/text?doc=Plin.+Nat.+37)
- Sleep rankings compared across the crystal guides in our lore collection, including crystals.com, read November 2026
- Facet ratings from the crystal guides in our lore collection, method on [Sources & Methods](/sources/#how-we-rate)
- International Gem Society, [Celestite](https://www.gemsociety.org/article/celestite/), and Gemstones.com, [Angelite](https://www.gemstones.com/gemopedia/angelite), a dealer guide

Last reviewed November 18, 2026.
`;

async function sourcesOf(md, built = new Set(['/sources/'])) {
  const tree = await toHast(md);
  const { sections } = splitSections(tree.children);
  const s = sections.find((x) => /^sources/i.test(x.title));
  const r = filterSourcesNodes(s.nodes, { policy, isBuilt: (p) => built.has(p) });
  return { out: html(r.nodes), r };
}

test('the body Sources section is filtered item by item', async () => {
  const { out, r } = await sourcesOf(SAMPLE);
  assert.match(out, /gia\.edu\/amethyst/);
  assert.match(out, /Curious Lore of Precious Stones/, 'book citations without links stay');
  assert.match(out, /perseus\.tufts\.edu/, 'Pliny with a Perseus link stays');
  assert.doesNotMatch(out, /wikipedia/i);
  assert.doesNotMatch(out, /gemrockauctions/);
  assert.doesNotMatch(out, /crystals\.com/);
  assert.doesNotMatch(out, /href="https:\/\/www\.gemstones\.com/, 'a stray dealer link inside a kept item loses its anchor');
  assert.equal(r.mixed.length, 1);
});

test('crystal guide items become one line linking to /sources/, once per page', async () => {
  const { out, r } = await sourcesOf(SAMPLE);
  const line = `${GUIDES_LINE.before}<a href="/sources/">${GUIDES_LINE.link}</a>`;
  assert.equal(out.split(line).length - 1, 1);
  assert.equal(r.replaced, 2);
  assert.doesNotMatch(out, /lore collection/);
});

test('the guides line follows the hidden-link rule when /sources/ is not built', async () => {
  const { out } = await sourcesOf(SAMPLE, new Set());
  assert.match(out, /rated on our five-facet scale, see How We Rate/);
  assert.doesNotMatch(out, /href="\/sources\/"/);
});

test('a page without a Sources section gets one list from the frontmatter, never two', async () => {
  const r = filterSourcesNodes([], { policy, isBuilt: () => true, frontmatterSources: ['https://www.gia.edu/a', 'https://www.crystals.com/b'] });
  const out = html(r.nodes);
  assert.equal((out.match(/<ul>/g) || []).length, 1);
  assert.match(out, /gia\.edu\/a/);
  assert.doesNotMatch(out, /crystals\.com/);
  const both = filterSourcesNodes([{ type: 'element', tagName: 'ul', properties: {}, children: [{ type: 'element', tagName: 'li', properties: {}, children: [{ type: 'text', value: 'IMA List of Minerals' }] }] }], { policy, isBuilt: () => true, frontmatterSources: ['https://www.gia.edu/a'] });
  assert.equal((html(both.nodes).match(/<ul>/g) || []).length, 1, 'the body list wins, the frontmatter list is not added');
});

test('citation-only parentheses to dealer pages are removed, other parentheses stay', async () => {
  const { dropGuideCitations } = await import('../src/lib/md/transforms.mjs');
  const { el, txt } = await import('../src/lib/md/hast.mjs');
  const a = (href, t) => el('a', { href }, [txt(t)]);
  const p = el('p', {}, [
    txt('A bedside crystal ('), a('https://www.crystals.com/x', 'Crystals.com'), txt('). Guides agree ('),
    a('https://www.crystalvaults.com/x', 'CrystalVaults'), txt(', '), a('https://www.firemountaingems.com/x', 'Fire Mountain Gems'),
    txt('). Hardness 7 ('), a('https://www.gia.edu/x', 'GIA'), txt('). Mixed ('), a('https://www.gia.edu/y', 'GIA'), txt(', '),
    a('https://www.crystals.com/y', 'Crystals.com'), txt('). In a ('), a('https://www.crystals.com/z', 'shop'), txt(' guide).'),
  ]);
  dropGuideCitations({ type: 'root', children: [p] }, { allowExternal: policy.isBodyLinkAllowed });
  assert.equal(html(p), '<p>A bedside crystal. Guides agree. Hardness 7 (<a href="https://www.gia.edu/x">GIA</a>). Mixed (<a href="https://www.gia.edu/y">GIA</a>). In a (<a href="https://www.crystals.com/z">shop</a> guide).</p>');
});
