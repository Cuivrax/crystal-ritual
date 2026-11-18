// Glue between the site model, the photo files and the Markdown pipeline.
import { renderDocument } from './md/pipeline.mjs';
import { makeSourcePolicy } from './sources.mjs';
import { parsePhotoComments, photoFolder, findPhotoFile } from './photos.mjs';
import { PHOTO_FILES, PHOTO_PATHS, figureHtml } from './images.mjs';
import { INTENTIONS } from './ui.mjs';
import tiers from '../data/source_tiers.json';
import intents from '../data/intent_rankings.json';
import stonesIndex from '../data/stones.json';

export const policy = makeSourcePolicy(tiers);
export { intents, stonesIndex };

/** Photo notes of a page with their files, when the files exist. */
export function photosOf(page) {
  const folder = photoFolder(page);
  return parsePhotoComments(page.body).map((p) => {
    const file = p.usable ? findPhotoFile(folder, p, PHOTO_PATHS) : null;
    return { ...p, file, meta: file ? PHOTO_FILES.get(file) : null };
  });
}

let thumbCache = null;

/** Small versions of each built stone page's hero photo, for cards elsewhere on the site. */
export async function stoneThumbs(site) {
  if (thumbCache) return thumbCache;
  thumbCache = new Map();
  for (const p of site.pages.filter((x) => x.type === 'stone')) {
    const hero = photosOf(p).find((x) => x.hero && x.meta);
    if (!hero) continue;
    const [card, rank, circle] = await Promise.all([
      figureHtml(hero, hero.meta, { variant: 'card' }),
      figureHtml(hero, hero.meta, { variant: 'rank' }),
      figureHtml(hero, hero.meta, { variant: 'circle' }),
    ]);
    thumbCache.set(p.slug, { card, rank, circle, credit: hero.credit || hero.caption || '' });
  }
  return thumbCache;
}

/** Intentions a stone is linked to, strongest first (from intent_rankings.json). */
export function knownFor(slug, limit = 4) {
  const out = [];
  for (const [key, list] of Object.entries(intents)) {
    const hit = list.find((r) => r.slug === slug);
    if (hit && hit.facets >= 2) out.push({ key, label: INTENTIONS[key]?.label || key, facets: hit.facets, url: `/crystals-for/${key}/` });
  }
  return out.sort((a, b) => b.facets - a.facets).slice(0, limit);
}

/** Built compare pages that involve a stone. */
export function comparesFor(site, slug) {
  return site.pages
    .filter((p) => p.type === 'compare')
    .filter((p) => p.slug.split('-vs-').includes(slug))
    .map((p) => ({ url: p.url, title: p.data.h1 }));
}

export async function renderPage(page, site) {
  const photos = photosOf(page);
  const thumbs = await stoneThumbs(site);
  const photoHtml = new Map();
  let heroHtml = null;
  for (const p of photos) {
    if (!p.meta || !p.role) continue;
    if (p.hero) {
      if (!heroHtml) heroHtml = await figureHtml(p, p.meta, { variant: 'hero', eager: true });
      photoHtml.set('hero', heroHtml);
    } else if (!photoHtml.has(p.role)) {
      photoHtml.set(p.role, await figureHtml(p, p.meta, { variant: 'inline' }));
    }
  }
  const ctx = {
    preview: site.preview,
    isBuilt: site.isBuilt,
    policy,
    photos,
    photoHtml,
    data: { intents, stones: stonesIndex.stones },
    helpers: {
      stoneThumb: (slug, variant = 'card') => thumbs.get(slug)?.[variant] || null,
      knownFor: (slug) => knownFor(slug),
      comparesFor: (slug) => comparesFor(site, slug),
    },
  };
  const doc = await renderDocument(page, ctx);
  doc.heroHtml = doc.hero ? heroHtml : null;
  doc.photos = photos;
  return doc;
}
