// Stone Atlas cards, shared by the Atlas (/stones/) and the family hub sections of head stone pages.
// A stone whose page is published gets the full card with its link, its photo (or its cut-out),
// the first sentence of its description and its strongest intention. Any other stone gets a light
// card with no link, its swatches, its Mohs range, one short verified fact from its sheet
// (scripts/build-stone-extras.mjs) and "Full Guide Coming", with a cut-out or a checked photo when one exists.
import { stoneThumbs, stonesIndex, knownFor, stoneExtras, photosOf } from './render.mjs';
import { figureHtml, cutoutHtml, CUTOUTS } from './images.mjs';
import { colorSwatches } from './colors.mjs';
import { FACET_LABELS, esc } from './ui.mjs';
import { listNames } from './worldmap.mjs';

export const firstSentence = (s) => (String(s).match(/^.*?[.!?](\s|$)/) || [s])[0].trim();
export const fmtMohs = (m) => (m.min === m.max ? `${m.min}` : `${m.min} to ${m.max}`);

let assetsCache = null;

/** Published stone pages, their card photos, the cut-outs and the photos of stones not published yet, once per build. */
export async function cardAssets(site) {
  if (assetsCache) return assetsCache;
  const thumbs = await stoneThumbs(site);
  // Checked photos of stones whose page is not published yet (the page's own hero).
  const miniPhotos = new Map();
  for (const row of site.held) {
    const e = row.entry;
    if (e.data.page_type !== 'stone') continue;
    const slug = String(e.data.url || '').split('/').filter(Boolean).pop();
    const hero = photosOf({ id: e.id, url: e.data.url, body: e.body || '', type: 'stone' }).find((x) => x.hero && x.meta);
    if (slug && hero) miniPhotos.set(slug, await figureHtml(hero, hero.meta, { variant: 'mini' }));
  }
  // Cut-out stones made in Canva, the small image of a light card (and of a full card without a photo).
  const cutouts = new Map();
  for (const slug of CUTOUTS.keys()) cutouts.set(slug, await cutoutHtml(slug));
  const built = new Map(site.pages.filter((p) => p.type === 'stone').map((p) => [p.slug, p]));
  assetsCache = { thumbs, miniPhotos, cutouts, built };
  return assetsCache;
}

/** The card of one stone. fallbackName names a stone with neither a sheet nor a published page. */
export function stoneCard(slug, assets, { fallbackName = null } = {}) {
  const sheet = stonesIndex.stones[slug] || null;
  const p = assets.built.get(slug) || null;
  const name = sheet?.name || (p ? p.data.h1.split(/ Meaning| Properties|,/)[0] : fallbackName || slug);
  const base = { slug, name, sheet, mohs: sheet?.mohs || null };
  if (p) {
    const top = knownFor(slug, 1).find((k) => k.facets >= 3) || null;
    const photo = assets.thumbs.get(slug)?.card || null;
    return { ...base, guide: true, url: p.url, line: firstSentence(p.data.description), top, photo, cutout: photo ? null : assets.cutouts.get(slug) || null };
  }
  const cutout = assets.cutouts.get(slug) || null;
  return { ...base, guide: false, fact: stoneExtras.facts?.[slug] || null, swatches: colorSwatches(sheet?.colors || '').slice(0, 6), cutout, photo: cutout ? null : assets.miniPhotos.get(slug) || null };
}

/** Class list of a card's <article>. */
export function cardClass(c) {
  return c.guide ? 'atlas-card is-link' : ['atlas-card', 'is-mini', c.cutout ? 'has-cutout' : c.photo ? 'has-photo' : ''].filter(Boolean).join(' ');
}

/** Inner HTML of the full card of a published stone. */
export function fullCardHtml(c) {
  const chips = [
    c.mohs ? `<span class="mini-chip tone-green">Hardness ${esc(fmtMohs(c.mohs))}</span>` : '',
    c.top ? `<span class="mini-chip tone-lavender">${esc(c.top.label)}, ${esc(FACET_LABELS[c.top.facets])}</span>` : '',
  ].join('');
  const media = c.photo || (c.cutout ? `<div class="atlas-cutout-box">${c.cutout}</div>` : '');
  return `${media}<div class="atlas-card-body"><h3><a class="stretched" href="${esc(c.url)}">${esc(c.name)}</a></h3><p>${esc(c.line)}</p><div class="mini-chips">${chips}</div></div>`;
}

/** Inner HTML of the light card of a stone without a published page. */
export function miniCardHtml(c) {
  const dots = c.swatches.length
    ? `<span class="mini-dots" role="img" aria-label="${esc(`Colors ${listNames(c.swatches.map((s) => s.name.toLowerCase()))}`)}">${c.swatches.map((s) => `<i style="background:${s.hex}"></i>`).join('')}</span>`
    : '';
  const chips = [
    c.mohs ? `<span class="mini-chip tone-green">Hardness ${esc(fmtMohs(c.mohs))}</span>` : '',
    '<span class="mini-chip tone-gold">Full Guide Coming</span>',
  ].join('');
  return `${c.cutout || c.photo || ''}<div class="atlas-card-body"><h3>${esc(c.name)}</h3>${dots}${c.fact ? `<p>${esc(c.fact)}</p>` : ''}<div class="mini-chips">${chips}</div></div>`;
}

/** The card's <article>, with the stone's slug for the tests. */
export function cardArticle(c) {
  return `<article class="${cardClass(c)}" data-slug="${esc(c.slug)}">${c.guide ? fullCardHtml(c) : miniCardHtml(c)}</article>`;
}
