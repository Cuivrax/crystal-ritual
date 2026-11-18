// Glue between the site model, the photo files and the Markdown pipeline.
import { renderDocument } from './md/pipeline.mjs';
import { makeSourcePolicy } from './sources.mjs';
import { parsePhotoComments, photoFolder, findPhotoFile } from './photos.mjs';
import { PHOTO_FILES, PHOTO_PATHS, figureHtml } from './images.mjs';
import { INTENTIONS } from './ui.mjs';
import tiers from '../data/source_tiers.json';
import picks from '../data/photo_picks.json';
import intents from '../data/intent_rankings.json';
import stonesIndex from '../data/stones.json';

export const policy = makeSourcePolicy(tiers);
export { intents, stonesIndex };

/** The checked hero of a page, src/assets/photos/<page id>/hero.* with its credit from picks.json. */
export function pickedHero(page) {
  const pick = picks[page.id];
  if (!pick || !pick.credit) return null;
  const path = ['jpg', 'jpeg', 'png', 'webp'].map((e) => `/src/assets/photos/${page.id}/hero.${e}`).find((p) => PHOTO_PATHS.has(p));
  if (!path) return null;
  return { path, meta: PHOTO_FILES.get(path), credit: pick.credit, page: pick.page_url || null, license: pick.license || null, alt: pick.alt_text || (pick.visual ? pick.visual.split(/[;.]/)[0].trim() : '') };
}

/** Photo notes of a page with their files, when the files exist. */
export function photosOf(page) {
  const folder = photoFolder(page);
  const picked = pickedHero(page);
  const list = parsePhotoComments(page.body).map((p) => {
    if (p.hero && picked) {
      // The checked photo in site/photos wins over the note's own image.
      const alt = p.file && p.file.includes(`site/photos/${page.id}/hero`) && p.alt ? p.alt : picked.alt;
      return { ...p, usable: true, image: null, page: picked.page, credit: picked.credit, caption: null, license: picked.license, alt, assetFile: picked.path, meta: picked.meta };
    }
    const asset = p.usable ? findPhotoFile(folder, p, PHOTO_PATHS) : null;
    return { ...p, assetFile: asset, meta: asset ? PHOTO_FILES.get(asset) : null };
  });
  if (picked && !list.some((p) => p.hero)) {
    list.unshift({ role: 'hero', hero: true, usable: true, raw: '', page: picked.page, credit: picked.credit, license: picked.license, alt: picked.alt, assetFile: picked.path, meta: picked.meta });
  }
  return list;
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
  const pair = [];
  for (const p of photos) {
    if (p.pair) { pair.push({ side: p.pair, label: p.label, html: p.meta ? await figureHtml(p, p.meta, { variant: 'card' }) : null }); continue; }
    if (!p.meta || !p.role) continue;
    if (p.hero) {
      if (!heroHtml) heroHtml = await figureHtml(p, p.meta, { variant: 'hero', eager: true });
      photoHtml.set('hero', heroHtml);
    } else if (!photoHtml.has(p.role)) {
      photoHtml.set(p.role, await figureHtml(p, p.meta, { variant: 'inline' }));
    }
  }
  const ctx = {
    keepHidden: page.type === 'home',
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
  doc.heroHtml = heroHtml || null;
  doc.photos = photos;
  doc.pair = pair;
  return doc;
}
