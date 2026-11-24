// The build keeps, in each page, only the CSS rules that page can use. It must never drop a rule that could match.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requiredClasses, splitSelectors, pruneCss, pageTokens, prunePage } from '../scripts/prune-css.mjs';

const has = (...names) => (n) => names.includes(n);

test('a selector needs its own classes, not the ones inside :not(), :is(), :where() or :has()', () => {
  assert.deepEqual(requiredClasses('.card .title'), ['card', 'title']);
  assert.deepEqual(requiredClasses('.prose > :where(p, ul, ol:not(.step-cards):not(.timeline))'), ['prose']);
  assert.deepEqual(requiredClasses('.section:not([class*="band-"]) .care-card'), ['section', 'care-card']);
  assert.deepEqual(requiredClasses('label:has(.x:checked)'), []);
  assert.deepEqual(requiredClasses('a[href$=".pdf"]'), []);
  assert.equal(requiredClasses('[popover].\\:popover-open'), null);
});

test('selector lists split on top-level commas only', () => {
  assert.deepEqual(splitSelectors('.a, .b:is(.c, .d), [data-x="1,2"]'), ['.a', '.b:is(.c, .d)', '[data-x="1,2"]']);
});

test('rules that cannot match are dropped, the others stay as written', () => {
  const css = 'body{margin:0}.home-hero{padding:1px}.card{color:red}.card .gone{color:blue}.theme-night .card{color:#fff}';
  assert.equal(pruneCss(css, has('card')), 'body{margin:0}.card{color:red}');
});

test('a selector list keeps only the selectors that can match', () => {
  assert.equal(pruneCss('.a,.b,.c .a{x:1}', has('a')), '.a{x:1}');
});

test('media and supports blocks are pruned inside and removed when empty', () => {
  const css = '@media (min-width:720px){.moon{a:b}.card{c:d}}@media print{.moon{a:b}}@supports (x:y){.moon{a:b}}';
  assert.equal(pruneCss(css, has('card')), '@media (min-width:720px){.card{c:d}}');
});

test('font faces and keyframes are never touched', () => {
  const css = '@font-face{font-family:A;src:url(a.woff2)}@keyframes rise{from{opacity:0}to{opacity:1}}';
  assert.equal(pruneCss(css, has()), css);
});

test('rules without any class always stay', () => {
  const css = 'h1,h2{margin:0}details[open]>summary{color:red}:focus-visible{outline:1px solid}';
  assert.equal(pruneCss(css, has()), css);
});

test('a page knows the classes of its markup and of the scripts it loads', () => {
  const html = '<body class="theme-night"><p class="lead is-big">x</p><script>el.className="from-inline"</script><script type="module" src="/_astro/tool.js"></script></body>';
  const scripts = { '/_astro/tool.js': 'import"./chunk.js";el.classList.add("from-tool")', '/_astro/chunk.js': 'x.innerHTML=\'<i class="from-chunk"></i>\'' };
  const tokens = pageTokens(html, (src) => scripts[src] || '');
  for (const name of ['theme-night', 'lead', 'is-big', 'from-inline', 'from-tool', 'from-chunk']) assert.ok(tokens.has(name), name);
  assert.ok(!tokens.has('home-hero'));
});

test('a class a script can add keeps its rule', () => {
  const html = '<style>.is-open{display:block}.never{display:none}</style><div class="menu"></div><script>m.classList.toggle("is-open")</script>';
  assert.equal(prunePage(html, () => ''), '<style>.is-open{display:block}</style><div class="menu"></div><script>m.classList.toggle("is-open")</script>');
});
