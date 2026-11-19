// Photos go through Astro's image pipeline (sharp), as AVIF and WebP with a JPEG fallback,
// width and height set, lazy below the fold and eager for the hero.
import { getImage } from 'astro:assets';
import { esc } from './ui.mjs';
import { splitCaption, needsAttribution } from './credits.mjs';
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

// Cut-out stones (transparent WebP from Canva, synced by scripts/sync-content.mjs), keyed by stone slug.
const cutoutModules = import.meta.glob('/src/assets/cutouts/*.webp', { eager: true });
export const CUTOUTS = new Map(Object.entries(cutoutModules).map(([k, mod]) => [k.split('/').pop().replace(/\.webp$/, ''), mod.default]));

/** A small cut-out stone on the card's own background, WebP with transparency, lazy. */
export async function cutoutHtml(slug, { box = 96, cls = 'cutout' } = {}) {
  const meta = CUTOUTS.get(slug);
  if (!meta) return '';
  const scale = Math.min(1, box / meta.width, box / meta.height);
  const w1 = Math.max(1, Math.round(meta.width * scale));
  const widths = [w1, Math.min(meta.width, w1 * 2)].filter((w, i, a) => a.indexOf(w) === i);
  const img = await getImage({ src: meta, widths, width: Math.max(...widths), format: 'webp', quality: 80 });
  const h1 = Math.round((meta.height * w1) / meta.width);
  return `<span class="${esc(cls)}"><img src="${esc(img.src)}" srcset="${esc(img.srcSet.attribute)}" sizes="${w1}px" width="${w1}" height="${h1}" alt="" loading="lazy" decoding="async"></span>`;
}

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
const needsChangeNote = (photo) => needsAttribution(photo);

// Captions show what a photo shows, never who took it. Credits that a license requires
// (CC BY, CC BY-SA and the like) go to one "Photo Credits" list at the end of the page,
// collected from the data-credit marker each such figure carries (see lib/credits.mjs).
/** The credit for the Photo Credits list, { text, href, note }, or null when the license needs none. */
export function creditEntry(photo) {
  if (!needsAttribution(photo)) return null;
  const { credit } = splitCaption(photo.credit || photo.caption || '');
  const text = credit || photo.credit || '';
  if (!text) return null;
  const note = needsChangeNote(photo) && !/adjusted|retouched|modified/i.test(text) ? ADJUSTED : '';
  const href = photo.page && policy.isCreditLinkAllowed(photo.page) ? photo.page : null;
  return { text, href, note };
}

const creditMarker = (photo) => {
  const entry = creditEntry(photo);
  return entry ? ` data-credit="${esc(JSON.stringify(entry))}"` : '';
};

/** A full figure. The caption keeps only the words that say what the photo shows. */
export async function figureHtml(photo, meta, { variant = 'inline', eager = false } = {}) {
  const opts = {
    hero: { widths: [420, 840], sizes: '(min-width: 900px) 420px, 92vw', ratio: [4, 5] },
    inline: { widths: [400, 800], sizes: '(min-width: 900px) 380px, 92vw' },
    card: { widths: [320, 640], sizes: '(min-width: 900px) 300px, 92vw', ratio: [4, 3], avif: false },
    rank: { widths: [150, 300], sizes: '150px', ratio: [1, 1], avif: false },
    circle: { widths: [80, 160], sizes: '76px', ratio: [1, 1], avif: false },
    aside: { widths: [400, 800], sizes: '(min-width: 900px) 400px, 92vw', ratio: [4, 3] },
    mini: { widths: [96, 192], sizes: '96px', ratio: [1, 1], avif: false },
  }[variant];
  const pic = await pictureHtml(meta, { alt: photo.alt || '', eager, ...opts });
  const mark = creditMarker(photo);
  if (variant === 'circle' || variant === 'mini') return `<figure class="photo photo-${variant}"${mark}>${pic}</figure>`;
  let said = splitCaption(photo.caption || photo.credit || '').said;
  // The photo card beside "What It Is" says what the photo shows, from its description when it has no caption.
  if (variant === 'aside' && !said) {
    const alt = String(photo.alt || '').trim().replace(/[.\s]+$/, '');
    said = alt ? `${alt.charAt(0).toUpperCase()}${alt.slice(1)}.` : '';
  }
  const cap = said ? `<figcaption>${variant === 'aside' ? `<span class="photo-said">${esc(said)}</span>` : esc(said)}</figcaption>` : '';
  return `<figure class="photo photo-${variant}"${mark}>${pic}${cap}</figure>`;
}
