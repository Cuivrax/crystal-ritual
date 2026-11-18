// Photos go through Astro's image pipeline (sharp), as AVIF and WebP with a JPEG fallback,
// width and height set, lazy below the fold and eager for the hero.
import { getImage } from 'astro:assets';
import { esc } from './ui.mjs';
import { makeSourcePolicy } from './sources.mjs';
import tiers from '../data/source_tiers.json';

const policy = makeSourcePolicy(tiers);

// Every image file under src/assets/stones/, keyed by its path from the project root.
const modules = import.meta.glob('/src/assets/stones/**/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG}', { eager: true });
export const PHOTO_FILES = new Map(Object.entries(modules).map(([k, mod]) => [k, mod.default]));
export const PHOTO_PATHS = new Set(PHOTO_FILES.keys());

/**
 * <picture> for a local image.
 *   ratio, optional [w, h] crop (cover), widths, target widths, sizes, the sizes attribute.
 */
export async function pictureHtml(meta, { alt = '', eager = false, widths = [480, 800, 1200], sizes = '100vw', ratio = null, cls = '' } = {}) {
  const maxW = meta.width;
  let ws = widths.filter((w) => w <= maxW);
  if (!ws.length) ws = [maxW];
  const base = { src: meta, widths: ws, sizes };
  if (ratio) {
    const w = Math.max(...ws);
    base.width = w;
    base.height = Math.round((w * ratio[1]) / ratio[0]);
    base.fit = 'cover';
  }
  const [avif, webp, jpg] = await Promise.all([
    getImage({ ...base, format: 'avif', quality: 60 }),
    getImage({ ...base, format: 'webp', quality: 72 }),
    getImage({ ...base, format: 'jpg', quality: 78 }),
  ]);
  const w = jpg.attributes.width || base.width || maxW;
  const h = jpg.attributes.height || base.height || Math.round((maxW * meta.height) / meta.width);
  const loading = eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
  return `<picture${cls ? ` class="${esc(cls)}"` : ''}>`
    + `<source type="image/avif" srcset="${esc(avif.srcSet.attribute)}" sizes="${esc(sizes)}">`
    + `<source type="image/webp" srcset="${esc(webp.srcSet.attribute)}" sizes="${esc(sizes)}">`
    + `<img src="${esc(jpg.src)}" srcset="${esc(jpg.srcSet.attribute)}" sizes="${esc(sizes)}" width="${w}" height="${h}" alt="${esc(alt)}" ${loading} decoding="async">`
    + '</picture>';
}

/** The credit line, linked to the photo's source page when that page is a credit site. */
export function creditHtml(photo) {
  const text = photo.caption || photo.credit || '';
  if (!text) return '';
  if (photo.page && policy.isCreditLinkAllowed(photo.page)) {
    return `<a href="${esc(photo.page)}" rel="noopener">${esc(text)}</a>`;
  }
  return esc(text);
}

/** A full figure with its credit caption. */
export async function figureHtml(photo, meta, { variant = 'inline', eager = false } = {}) {
  const opts = {
    hero: { widths: [420, 640, 900, 1200], sizes: '(min-width: 900px) 420px, 92vw', ratio: [4, 5] },
    inline: { widths: [400, 640, 960], sizes: '(min-width: 900px) 380px, 92vw' },
    card: { widths: [320, 480, 640], sizes: '(min-width: 900px) 300px, 92vw', ratio: [4, 3] },
    rank: { widths: [160, 320], sizes: '150px', ratio: [1, 1] },
    circle: { widths: [96, 160], sizes: '76px', ratio: [1, 1] },
  }[variant];
  const pic = await pictureHtml(meta, { alt: photo.alt || '', eager, ...opts });
  return `<figure class="photo photo-${variant}">${pic}<figcaption>${creditHtml(photo)}</figcaption></figure>`;
}
