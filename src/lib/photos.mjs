// Photo notes in the Markdown are HTML comments such as
//   <!-- PHOTO HERO. Wikimedia Commons, "File ...", by ... Page https://... . Image https://... .
//        License CC BY 4.0. Credit line "Photo ..., CC BY 4.0, via Wikimedia Commons".
//        visual_check ok. Alt text "...". -->
// They never reach the output. A figure is rendered only when the image file exists in
//   src/assets/stones/<slug>/<role>.<jpg|jpeg|png|webp|avif>
// where <slug> is the stone slug on stone pages and the page id elsewhere
// (crystals-for__sleep), and <role> is "hero", "photo-2", "photo-3" and so on.
// A file named after the image itself (the last part of the image URL) is accepted too.

export const PHOTO_EXTS = ['avif', 'webp', 'jpg', 'jpeg', 'png'];

const pick = (rx, text) => {
  const m = rx.exec(text);
  return m ? m[1].trim() : null;
};
const cleanUrl = (u) => (u ? u.replace(/[.,;)]+$/, '') : null);

/** Parses one comment (with or without the comment markers). Returns null for non-photo comments. */
export function parsePhotoComment(raw, unnumberedIndex = 1) {
  const text = String(raw).replace(/^\s*<!--/, '').replace(/-->\s*$/, '').trim();
  const m = /^PHOTO(S?)\b([^.,]*)/.exec(text);
  if (!m) return null;
  const plural = m[1] === 'S';
  const header = m[2].trim();
  const toFind = /TO FIND/i.test(header) || /^PHOTO\S*\s+TO FIND/i.test(text);
  let role = null;
  if (/^HERO\b/i.test(header)) role = 'hero';
  else if (/^\d+\b/.test(header)) role = `photo-${header.match(/^\d+/)[0]}`;
  else if (header === '') role = `photo-${unnumberedIndex}`;
  const image = cleanUrl(pick(/\bImage (https?:\/\/\S+)/, text));
  const file = cleanUrl(pick(/\bFile (site\/photos\/\S+)/, text));
  const sourcePage = cleanUrl(pick(/\bSource [^,]+, (https?:\/\/\S+)/, text));
  const page = cleanUrl(pick(/\bPage (https?:\/\/\S+)/, text)) || sourcePage;
  const record = cleanUrl(pick(/\bRecord (https?:\/\/\S+)/, text));
  const license = pick(/\bLicense (.+?)(?:\.\s|,\s|\s\(|$)/, text);
  const credit = pick(/Credit line "([^"]+)"/, text) || pick(/\bCredit "([^"]+)"/, text);
  const caption = pick(/Caption "([^"]+)"/, text);
  const visualDesc = pick(/Visual check \d{4}-\d{2}-\d{2},\s*([^;.]+)/i, text);
  const alt = pick(/Alt text "([^"]+)"/, text) || (visualDesc ? visualDesc.trim() : null);
  const visualOk = /visual_check ok|verdict (?:ok|hero|secondary)|visual pass|Checked as (?:hero|secondary)|Visual check \d{4}-\d{2}-\d{2}/i.test(text);
  const smithsonian = image ? /ids\.si\.edu/.test(image) : false;
  const creditText = credit || (smithsonian && /CC0/i.test(license || '') ? 'Smithsonian NMNH, CC0' : null);
  const usable = Boolean(!plural && role && !toFind && (image || file) && visualOk && alt && (creditText || caption) && !/\[TO CHECK/i.test(text));
  return {
    role,
    file: file || null,
    hero: role === 'hero',
    image,
    page: page || record,
    license,
    credit: creditText,
    caption,
    alt,
    visualOk,
    toFind,
    usable,
  };
}

/**
 * "PHOTO PAIR ... LEFT, ruby. <note> RIGHT, garnet. <note>" (compare pages) becomes two notes,
 * roles "pair-left" and "pair-right", each with the stone word as its label.
 */
export function parsePairComment(raw) {
  const text = String(raw).replace(/^\s*<!--/, '').replace(/-->\s*$/, '');
  const left = /\bLEFT,\s*([^.]+)\.([\s\S]*?)(?=\bRIGHT,|$)/.exec(text);
  const right = /\bRIGHT,\s*([^.]+)\.([\s\S]*?)(?=\bALTERNATE\b|$)/.exec(text);
  const out = [];
  for (const [side, m] of [['left', left], ['right', right]]) {
    if (!m) continue;
    const note = parsePhotoComment(`PHOTO ${side === 'left' ? 1 : 2}. ${m[2]}`);
    if (!note) continue;
    const toFind = /TO FIND/i.test(m[2]);
    out.push({ ...note, role: `pair-${side}`, hero: false, pair: side, label: m[1].trim(), toFind, usable: note.usable && !toFind });
  }
  return out;
}

/** All photo notes of a page body, in reading order. */
export function parsePhotoComments(body) {
  const out = [];
  let unnumbered = 0;
  for (const m of String(body).matchAll(/<!--[\s\S]*?-->/g)) {
    const head = /^<!--\s*PHOTO(S?)\b([^.,]*)/.exec(m[0]);
    if (!head) continue;
    if (/^\s*PAIR\b/i.test(head[2])) {
      for (const p of parsePairComment(m[0])) out.push({ ...p, raw: m[0], offset: m.index });
      continue;
    }
    if (!head[1] && head[2].trim() === '') unnumbered++;
    const p = parsePhotoComment(m[0], unnumbered);
    if (p) out.push({ ...p, raw: m[0], offset: m.index });
  }
  return out;
}

/** Folder name under src/assets/stones/ for a page. */
export function photoFolder(page) {
  const url = page.url || '/';
  if (page.type === 'stone' || /^\/stones\/[^/]+\/$/.test(url)) return url.split('/').filter(Boolean).pop();
  return page.id;
}

/** File name keys accepted for a photo, role first. */
export function photoKeys(photo) {
  const keys = [];
  if (photo.role) keys.push(photo.role);
  if (photo.image) {
    try {
      const last = decodeURIComponent(new URL(photo.image).pathname.split('/').pop() || '');
      const base = last.replace(/\.[a-z0-9]+$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (base) keys.push(base);
    } catch { /* ignore */ }
  }
  return keys;
}

/** Finds the asset path among known files ("/src/assets/stones/amethyst/hero.jpg" style keys). */
export function findPhotoFile(folder, photo, files) {
  for (const key of photoKeys(photo)) {
    for (const ext of PHOTO_EXTS) {
      const p = `/src/assets/stones/${folder}/${key}.${ext}`;
      if (files.has(p)) return p;
    }
  }
  return null;
}
