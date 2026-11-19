// The "Photo Credits" list at the end of a page. Figures whose license asks for attribution
// carry a data-credit marker (lib/images.mjs). The layout reads the markers from the rendered
// page, removes them and prints one line per photo after Sources.
import { esc } from './ui.mjs';

export const CREDIT_RX = /\b(?:photo|photograph|smithsonian|nmnh|cc0|cc[ -]?by|by(?:-[a-z]{2})*\s?\d|public domain|unsplash|flickr|wikimedia|canva|pixabay|courtesy|license)\b/i;

/** Splits a caption or credit line into what the photo shows and the credit. */
export function splitCaption(text) {
  const parts = String(text || '').split(/(?<=\.)\s+(?=[A-Z])/).map((x) => x.trim()).filter(Boolean);
  const said = [];
  const credit = [];
  for (const part of parts) (CREDIT_RX.test(part) ? credit : said).push(part);
  return { said: said.join(' '), credit: credit.join(' ') };
}

/** True when the license asks for attribution (CC BY, CC BY-SA, GFDL and similar). CC0, public domain, Unsplash and Canva do not. */
export function needsAttribution(photo) {
  const t = `${photo.license || ''} ${photo.credit || ''}`;
  if (/\bCC0\b|public domain|unsplash|canva content|pixabay/i.test(photo.license || '')) return false;
  return /\bCC[ -]?BY\b|\bBY(?:-[A-Z]{2})*\s?\d|\bGFDL\b|\battribution\b/i.test(t);
}

const MARK_RX = /\sdata-credit="([^"]*)"/g;

const unescapeAttr = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Returns the page HTML without markers and the credits, one per photo, in page order. */
export function extractPhotoCredits(html) {
  const credits = [];
  const seen = new Set();
  for (const m of String(html).matchAll(MARK_RX)) {
    let entry;
    try { entry = JSON.parse(unescapeAttr(m[1])); } catch { continue; }
    const key = `${entry.text}|${entry.href || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    credits.push(entry);
  }
  return { html: String(html).replace(MARK_RX, ''), credits };
}

export function photoCreditsHtml(credits) {
  if (!credits || !credits.length) return '';
  const items = credits.map((c) => {
    const credit = c.href ? `<a href="${esc(c.href)}" rel="noopener">${esc(c.text)}</a>` : esc(c.text);
    return `<li>${credit}${esc(c.note || '')}</li>`;
  }).join('');
  return `<section class="wrap photo-credits-block" aria-labelledby="photo-credits"><h2 id="photo-credits">Photo Credits</h2><ul>${items}</ul></section>`;
}
