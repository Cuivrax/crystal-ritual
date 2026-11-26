// Stone Atlas cards, shared by the Atlas (/stones/) and the family hub sections of head stone pages.
// A stone whose page is published gets the full card with its link, its photo (or its cut-out),
// the first sentence of its description and its strongest intention. Any other stone gets a light
// card with no link, its swatches, its Mohs range, one short verified fact from its sheet
// (scripts/build-stone-extras.mjs) and "Full Guide Coming", with a cut-out or a checked photo when one exists.
import { stoneThumbs, stonesIndex, knownFor, stoneExtras, photosOf } from './render.mjs';
import { figureHtml, cutoutHtml, CUTOUTS } from './images.mjs';
import careData from '../data/care.json';
import { ratingLabel } from './ui.mjs';

// The care chip of a card, what a rinse does to the stone, when our sources cover it.
const WATER = new Map(careData.stones.map((s) => [s.slug, s.care?.water?.rating]));
const WATER_TONE = { ok: 'green', brief_only: 'gold', avoid: 'pink' };
const WATER_TEXT = { ok: 'Water Safe', brief_only: 'Quick Rinse Only', avoid: 'Keep Dry' };
const careChip = (slug) => { const r = WATER.get(slug); return WATER_TEXT[r] ? `<span class="mini-chip tone-${WATER_TONE[r]}">${WATER_TEXT[r]}</span>` : ''; };
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
  for (const slug of CUTOUTS.keys()) cutouts.set(slug, await cutoutHtml(slug, { box: 160 }));
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

/** The soft background of a card's image tile, the family of the first color the stone's sheet names. */
const tintClass = (c) => {
  const first = colorSwatches(c.sheet?.colors || '')[0];
  return first ? `tint-${first.family}` : '';
};

/** A facet mark for a stone with no checked image yet, so no card is left bare. */
const TILE_MARK = '<svg class="tile-mark" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M9 3 7 9l5 12 5-12-2-6"/></svg>';

/** Class list of a card's <article>. */
export function cardClass(c) {
  return c.guide ? ['atlas-card', 'is-link', tintClass(c)].filter(Boolean).join(' ') : ['atlas-card', 'is-mini', tintClass(c)].filter(Boolean).join(' ');
}

/** Inner HTML of the full card of a published stone. */
export function fullCardHtml(c) {
  const chips = [
    careChip(c.slug),
    c.top ? `<span class="mini-chip tone-lavender">${esc(c.top.label)}, ${esc(FACET_LABELS[c.top.facets])}</span>` : '',
  ].join('');
  const media = c.photo || `<div class="atlas-cutout-box">${c.cutout || TILE_MARK}</div>`;
  return `${media}<div class="atlas-card-body"><h3><a class="stretched" href="${esc(c.url)}">${esc(c.name)}</a></h3><p>${esc(c.line)}</p><div class="mini-chips">${chips}</div></div>`;
}

/** Inner HTML of the light card of a stone without a published page. */
export function miniCardHtml(c) {
  const dots = c.swatches.length
    ? `<span class="mini-dots" role="img" aria-label="${esc(`Colors ${listNames(c.swatches.map((s) => s.name.toLowerCase()))}`)}">${c.swatches.map((s) => `<i style="background:${s.hex}"></i>`).join('')}</span>`
    : '';
  const chips = [
    careChip(c.slug),
  ].join('');
  return `<div class="atlas-tile">${c.cutout || c.photo || TILE_MARK}</div><div class="atlas-card-body"><h3>${esc(c.name)}</h3>${dots}${c.fact ? `<p>${esc(c.fact)}</p>` : ''}<div class="mini-chips">${chips}</div></div>`;
}

/** The card's <article>, with the stone's slug for the tests. */
export function cardArticle(c) {
  return `<article class="${cardClass(c)}" data-slug="${esc(c.slug)}">${c.guide ? fullCardHtml(c) : miniCardHtml(c)}</article>`;
}
