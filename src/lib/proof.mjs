// Proof matching shared by scripts/build-stone-extras.mjs and the build.
// A page proof is a phrase that must appear in the page text, so an extra block
// disappears when the page stops saying what the block repeats.

/** Plain lower-case text, Markdown links flattened, emphasis and comments removed. */
export function normalizeText(s) {
  return String(s || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function pageProofHolds(text, contains) {
  return normalizeText(text).includes(normalizeText(contains));
}

/** True when every phrase is in the text (an empty list holds). */
export function allPageProofsHold(text, phrases = []) {
  const t = normalizeText(text);
  return phrases.every((p) => t.includes(normalizeText(p)));
}
