// Color words found in stone sheets and Quick Facts rows.
// Families feed the Stone Atlas color filter, swatches feed the Quick Facts card.
// Swatches are approximate screen colors, the page says so next to them.

// Order matters, longer and more specific words first.
const WORDS = [
  ['reddish pink', 'pink', '#D9485F'],
  ['raspberry', 'pink', '#B8295B'],
  ['magenta', 'pink', '#C21E7E'],
  ['salmon', 'pink', '#F2A08B'],
  ['peach', 'orange', '#F4B48C'],
  ['rose', 'pink', '#E896AC'],
  ['pink', 'pink', '#F2B8CC'],
  ['lilac', 'purple', '#C8A2D8'],
  ['lavender', 'purple', '#B9A6DB'],
  ['violet', 'purple', '#7E57C2'],
  ['purple', 'purple', '#7B4FA0'],
  ['indigo', 'blue', '#3F51B5'],
  ['teal', 'teal', '#2A8C8C'],
  ['turquoise', 'teal', '#40B5AD'],
  ['aqua', 'teal', '#7FD1D1'],
  ['sky blue', 'blue', '#8EC5E8'],
  ['blue', 'blue', '#4A78C2'],
  ['apple green', 'green', '#8DC26F'],
  ['olive', 'green', '#7D8B3A'],
  ['green', 'green', '#4E9A62'],
  ['lemon', 'yellow', '#F2E06B'],
  ['golden', 'yellow', '#E0B44A'],
  ['gold', 'yellow', '#D9A93E'],
  ['yellow', 'yellow', '#F2D04B'],
  ['honey', 'orange', '#D9A04A'],
  ['orange', 'orange', '#EE8A3C'],
  ['red', 'red', '#B8322F'],
  ['brown', 'brown', '#8A5A3B'],
  ['tan', 'brown', '#C9A27E'],
  ['black', 'black', '#2A2730'],
  ['gray', 'grey', '#9A97A0'],
  ['grey', 'grey', '#9A97A0'],
  ['silver', 'grey', '#C9CCD2'],
  ['white', 'white', '#F7F5F0'],
  ['colorless', 'white', '#F3F6F8'],
  ['clear', 'white', '#F3F6F8'],
  ['cream', 'white', '#F1E9D2'],
];

/** Color families named in a free text, in first-seen order. */
export function colorFamilies(text) {
  const t = ` ${String(text).toLowerCase().replace(/[^a-z\s-]/g, ' ')} `;
  const found = [];
  let rest = t;
  for (const [word, family] of WORDS) {
    const rx = new RegExp(`[\\s-]${word.replace(/ /g, '[\\s-]')}(?:ish)?[\\s-]`, 'g');
    if (rx.test(rest)) {
      if (!found.includes(family)) found.push(family);
      rest = rest.replace(rx, ' ');
    }
  }
  return found;
}

/** Swatches for a Colors row, at most eight, with the word as written. */
export function colorSwatches(text) {
  const parts = String(text)
    .replace(/\[TO CHECK[^\]]*\]/g, '')
    .split(/,| and | to | or |\./)
    // "Red from iron oxide" names the color, then its cause, the swatch keeps the color.
    .map((s) => s.replace(/\s+(?:from|by|due to|because)\s.*$/i, '').trim())
    .filter(Boolean);
  const out = [];
  for (const part of parts) {
    const low = part.toLowerCase();
    const hit = WORDS.find(([word]) => new RegExp(`(^|[\\s-])${word}(ish)?($|[\\s-])`).test(low));
    if (!hit) continue;
    const label = part.replace(/^(barely visible|barely perceptible|very|deep|pale|light|dark|medium|rich|bright|often|usually|mostly|sometimes|rarely)\s+/i, (m) => m)
      .replace(/\s+/g, ' ');
    if (label.length > 22) continue;
    const name = label.charAt(0).toUpperCase() + label.slice(1);
    if (out.some((o) => o.hex === hit[2] && o.name.toLowerCase() === name.toLowerCase())) continue;
    out.push({ name, hex: hit[2], family: hit[1], light: ['white', 'yellow'].includes(hit[1]) || hit[2] === '#F2B8CC' });
    if (out.length >= 8) break;
  }
  return out;
}

export const COLOR_FAMILIES = ['purple', 'pink', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'brown', 'black', 'grey', 'white'];
export const COLOR_LABELS = {
  purple: 'Purple', pink: 'Pink', red: 'Red', orange: 'Orange', yellow: 'Yellow', green: 'Green',
  teal: 'Teal', blue: 'Blue', brown: 'Brown', black: 'Black', grey: 'Gray', white: 'White & Clear',
};
