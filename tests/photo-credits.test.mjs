// Photo captions without credits, and the Photo Credits list at the end of the page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitCaption, needsAttribution, extractPhotoCredits, photoCreditsHtml } from '../src/lib/credits.mjs';
import { esc } from '../src/lib/ui.mjs';

test('captions keep what the photo shows and drop the credit', () => {
  assert.deepEqual(splitCaption('Moonstone, Amelia County, Virginia. Smithsonian NMNH, CC0'), { said: 'Moonstone, Amelia County, Virginia.', credit: 'Smithsonian NMNH, CC0' });
  assert.deepEqual(splitCaption('Photo James St. John, CC BY 2.0, via Wikimedia Commons'), { said: '', credit: 'Photo James St. John, CC BY 2.0, via Wikimedia Commons' });
  assert.equal(splitCaption('Photo by sameer Ali on Unsplash').said, '');
  assert.equal(splitCaption('Photo by James St. John on Flickr (BY 2.0)').said, '');
  assert.equal(splitCaption('Smithsonian National Museum of Natural History, CC0').said, '');
});

test('only licenses that ask for attribution are credited', () => {
  assert.equal(needsAttribution({ license: 'CC BY 2.0', credit: 'Photo James St. John, CC BY 2.0, via Wikimedia Commons' }), true);
  assert.equal(needsAttribution({ license: 'CC BY-SA 4.0', credit: 'Photo W.carter, CC BY-SA 4.0' }), true);
  assert.equal(needsAttribution({ license: 'BY 2.0', credit: 'Photo by Judy Gallagher on Flickr (BY 2.0)' }), true);
  assert.equal(needsAttribution({ license: 'CC0', credit: 'Smithsonian NMNH, CC0' }), false);
  assert.equal(needsAttribution({ license: 'Public domain', credit: 'Photo Parent Géry, public domain' }), false);
  assert.equal(needsAttribution({ license: 'Unsplash License', credit: 'Photo by Dan Farrell on Unsplash' }), false);
  assert.equal(needsAttribution({ license: 'Canva Content License', credit: 'Photo via Canva' }), false);
});

test('markers become one list after Sources, duplicates once, markers removed', () => {
  const entry = { text: 'Photo Marie-Lan Taÿ Pamart, CC BY 4.0, via Wikimedia Commons', href: 'https://commons.wikimedia.org/wiki/File:X.jpg', note: ', color adjusted' };
  const fig = `<figure class="photo" data-credit="${esc(JSON.stringify(entry))}"><img alt="x"></figure>`;
  const { html, credits } = extractPhotoCredits(`<main>${fig}${fig}<figure class="photo"><img alt="y"></figure></main>`);
  assert.equal(credits.length, 1);
  assert.doesNotMatch(html, /data-credit/);
  const list = photoCreditsHtml(credits);
  assert.match(list, /<h2 id="photo-credits">Photo Credits<\/h2>/);
  assert.match(list, /href="https:\/\/commons\.wikimedia\.org\/wiki\/File:X\.jpg"/);
  assert.match(list, /, color adjusted<\/li>/);
  assert.equal(photoCreditsHtml([]), '');
});
