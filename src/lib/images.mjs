// Photos go through Astro's image pipeline (sharp), as AVIF and WebP with a JPEG fallback,
// width and height set, lazy below the fold and eager for the hero.
import { getImage } from 'astro:assets';
import { esc } from './ui.mjs';
import { makeSourcePolicy } from './sources.mjs';
import tiers from '../data/source_tiers.json';

const policy = makeSourcePolicy(tiers);

// Every image file under src/assets/stones/, keyed by its path from the project root.
const modules = {
  ...import.meta.glob('/src/assets/stones/**/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG}', { eager: true }),
  ...import.meta.glob('/src/assets/photos/**/*.{jpg,jpeg,png,webp,avif}', { eager: true }),
};
export const PHOTO_FILES = new Map(Object.entries(modules).map(([k, mod]) => [k, mod.default]));
export const PHOTO_PATHS = new Set(PHOTO_FILES.keys());

/**
 * <picture> for a local image.
 *   ratio, optional [w, h] crop (cover), widths, target widths, sizes, the sizes attribute.
 */
export async function pictureHtml(meta, { alt = '', eager = false, widths = [480, 800, 1200], sizes = '100vw', ratio = null, cls = '', avif: useAvif = true } = {}) {
  const maxW = meta.width;
  let ws = widths.filter((w) => w <= maxW);
  if (!ws.length) ws = [maxW];
  // The base image is the largest requested width, never the full-size original.
  const w0 = Math.max(...ws);
  const base = { src: meta, widths: ws, sizes, width: w0, height: Math.round((w0 * (ratio ? ratio[1] / ratio[0] : meta.height / meta.width))) };
  if (ratio) base.fit = 'cover';
  const [avif, webp, jpg] = await Promise.all([
    useAvif ? getImage({ ...base, format: 'avif', quality: 60 }) : Promise.resolve(null),
    getImage({ ...base, format: 'webp', quality: 72 }),
    getImage({ ...base, format: 'jpg', quality: 78 }),
  ]);
  const w = jpg.attributes.width || base.width || maxW;
  const h = jpg.attributes.height || base.height || Math.round((maxW * meta.height) / meta.width);
  const loading = eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
  return `<picture${cls ? ` class="${esc(cls)}"` : ''}>`
    + (avif ? `<source type="image/avif" srcset="${esc(avif.srcSet.attribute)}" sizes="${esc(sizes)}">` : '')
    + `<source type="image/webp" srcset="${esc(webp.srcSet.attribute)}" sizes="${esc(sizes)}">`
    + `<img src="${esc(jpg.src)}" srcset="${esc(jpg.srcSet.attribute)}" sizes="${esc(sizes)}" width="${w}" height="${h}" alt="${esc(alt)}" ${loading} decoding="async">`
    + '</picture>';
}

// Every photo gets a light brightness and color retouch (hc/site/photos/tools/retouch.py).
// CC BY licenses ask that changes be indicated, so those credits say so.
const ADJUSTED = ', color adjusted';
const needsChangeNote = (photo) => /\bCC[ -]?BY\b/i.test(`${photo.license || ''} ${photo.credit || ''}`);

/** The credit line, linked to the photo's source page when that page is a credit site. */
export function creditHtml(photo) {
  const text = photo.caption || photo.credit || '';
  if (!text) return '';
  const note = needsChangeNote(photo) && !/adjusted|retouched|modified/i.test(text) ? ADJUSTED : '';
  if (photo.page && policy.isCreditLinkAllowed(photo.page)) {
    return `<a href="${esc(photo.page)}" rel="noopener">${esc(text)}</a>${note}`;
  }
  return esc(text) + note;
}

/** A full figure with its credit caption. */
export async function figureHtml(photo, meta, { variant = 'inline', eager = false } = {}) {
  const opts = {
    hero: { widths: [420, 840], sizes: '(min-width: 900px) 420px, 92vw', ratio: [4, 5] },
    inline: { widths: [400, 800], sizes: '(min-width: 900px) 380px, 92vw' },
    card: { widths: [320, 640], sizes: '(min-width: 900px) 300px, 92vw', ratio: [4, 3], avif: false },
    rank: { widths: [150, 300], sizes: '150px', ratio: [1, 1], avif: false },
    circle: { widths: [80, 160], sizes: '76px', ratio: [1, 1], avif: false },
  }[variant];
  const pic = await pictureHtml(meta, { alt: photo.alt || '', eager, ...opts });
  // Circles sit inside link cards, their credit is printed under the group instead (no nested links).
  if (variant === 'circle') return `<figure class="photo photo-${variant}">${pic}</figure>`;
  return `<figure class="photo photo-${variant}">${pic}<figcaption>${creditHtml(photo)}</figcaption></figure>`;
}
