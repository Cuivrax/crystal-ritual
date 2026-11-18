import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { rehypeHiddenLinks, processLinks, unwrapHidden } from '../src/lib/md/transforms.mjs';
import { internalPath, normalizePath, idToUrl, urlToId } from '../src/lib/urls.mjs';

async function render(md, built) {
  const isBuilt = (p) => built.has(p);
  const file = await unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeHiddenLinks, { isBuilt }).use(rehypeStringify).process(md);
  return String(file);
}

test('a link to a page that is not built keeps its words and loses its anchor', async () => {
  const html = await render('See [crystals for sleep](/crystals-for/sleep/) and [howlite](/stones/howlite/).', new Set(['/crystals-for/sleep/']));
  assert.match(html, /<a href="\/crystals-for\/sleep\/">crystals for sleep<\/a>/);
  assert.doesNotMatch(html, /href="\/stones\/howlite\/"/);
  assert.match(html, /and howlite\./);
});

test('the link comes back when the page is published at the next build', async () => {
  const md = 'Read [the howlite page](/stones/howlite/).';
  const before = await render(md, new Set());
  const after = await render(md, new Set(['/stones/howlite/']));
  assert.doesNotMatch(before, /<a /);
  assert.match(after, /<a href="\/stones\/howlite\/">the howlite page<\/a>/);
});

test('paths are normalized, hashes kept, absolute site URLs count as internal', async () => {
  const built = new Set(['/stones/amethyst/', '/editorial-policy/']);
  const html = await render('[a](/stones/amethyst) [b](https://crystalandritual.com/editorial-policy/#how-we-use-ai) [c](https://www.crystalandritual.com/stones/citrine/) [d](#care)', built);
  assert.match(html, /href="\/stones\/amethyst\/"/);
  assert.match(html, /href="\/editorial-policy\/#how-we-use-ai"/);
  assert.doesNotMatch(html, /href="[^"]*citrine/);
  assert.match(html, /> c</.test(html) ? /> c</ : / c /);
  assert.match(html, /href="#care"/);
});

test('external links follow the allowExternal rule', async () => {
  const tree = { type: 'root', children: [
    { type: 'element', tagName: 'a', properties: { href: 'https://www.gia.edu/amethyst' }, children: [{ type: 'text', value: 'GIA' }] },
    { type: 'element', tagName: 'a', properties: { href: 'https://www.crystals.com/x' }, children: [{ type: 'text', value: 'a shop' }] },
  ] };
  processLinks(tree, { isBuilt: () => true, allowExternal: (u) => u.includes('gia.edu') });
  assert.equal(tree.children[0].tagName, 'a');
  assert.deepEqual(tree.children[0].properties.rel, ['noopener']);
  assert.equal(tree.children[1].type, 'text');
  assert.equal(tree.children[1].value, 'a shop');
});

test('markHidden keeps the target for layouts until unwrapHidden', () => {
  const tree = { type: 'root', children: [{ type: 'element', tagName: 'a', properties: { href: '/stones/howlite/' }, children: [{ type: 'text', value: 'howlite' }] }] };
  processLinks(tree, { isBuilt: () => false, markHidden: true });
  assert.equal(tree.children[0].properties.dataHiddenHref, '/stones/howlite/');
  unwrapHidden(tree);
  assert.deepEqual(tree.children, [{ type: 'text', value: 'howlite' }]);
});

test('url helpers', () => {
  assert.equal(idToUrl('stones__amethyst'), '/stones/amethyst/');
  assert.equal(idToUrl('home'), '/');
  assert.equal(urlToId('/crystals-for/sleep/'), 'crystals-for__sleep');
  assert.equal(internalPath('/rss.xml'), '/rss.xml');
  assert.equal(internalPath('https://geology.com/x'), null);
  assert.equal(normalizePath('/moon'), '/moon/');
});
