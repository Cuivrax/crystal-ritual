// The small world map of "Main Sources on the Map" (R3-Stone).
// Simple equirectangular projection, one unit per degree, x = lon + 180, y = 90 - lat,
// shown in the window y 8 to 148 (latitude 82 to -58). Continent shapes from the R3 mockup.
import { esc } from './ui.mjs';

const VIEW = { x: 0, y: 8, w: 360, h: 140 };
const LAND = [
  'M12 24L40 20L80 18L100 22L118 32L125 42L110 48L104 55L99 65L90 61L83 64L83 72L92 75L97 81L102 82L100 84L93 79L85 76L75 70L65 60L56 50L55 41L45 33L28 32L15 28Z',
  'M135 30L160 20L160 10L120 9L110 13L125 22Z',
  'M102 82L120 80L130 90L145 95L142 103L132 115L122 128L112 142L107 140L108 120L110 108L100 95L100 90Z',
  'M170 54L171 47L178 42L185 38L188 32L185 28L195 20L210 19L220 24L220 45L208 49L200 50L192 46L195 52L185 47L175 54Z',
  'M175 40L182 38L177 32L174 34Z',
  'M163 69L170 60L175 54L190 53L212 59L215 65L223 78L231 79L220 93L220 105L213 116L200 125L195 117L192 105L189 91L188 85L172 85L165 79L163 75Z',
  'M224 103L230 105L227 115L223 112Z',
  'M206 50L216 54L215 60L223 77L235 68L237 65L246 65L253 70L257 82L260 75L270 68L278 74L280 87L284 89L289 78L288 68L301 60L302 50L310 47L320 44L340 30L360 24L360 18L320 17L280 13L250 17L240 20L220 24L220 45Z',
  'M310 59L321 49L322 45L315 56Z',
  'M294 112L302 107L310 102L317 102L322 101L326 109L333 117L330 127L321 128L311 121L295 124Z',
];

const FONT = 7.5;
const CHAR_W = 4.05; // average width of a Figtree 600 character at 7.5 units
const PIN_R = 3.6;

export function project(lon, lat) {
  return { x: Math.round((lon + 180) * 10) / 10, y: Math.round((90 - lat) * 10) / 10 };
}

const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Places each label beside its pin, trying right, left, above and below, avoiding other labels and pins. */
export function placeLabels(pins) {
  const pinBoxes = pins.map((p) => ({ x: p.x - PIN_R, y: p.y - PIN_R, w: PIN_R * 2, h: PIN_R * 2 }));
  const placed = [];
  const order = [...pins.keys()].sort((a, b) => pins[a].x - pins[b].x);
  const out = new Array(pins.length);
  for (const i of order) {
    const p = pins[i];
    const w = p.label.length * CHAR_W;
    const cands = [
      { x: p.x + 5, y: p.y + 2.6, anchor: 'start' },
      { x: p.x - 5, y: p.y + 2.6, anchor: 'end' },
      { x: p.x + 3, y: p.y - 5.5, anchor: 'start' },
      { x: p.x + 3, y: p.y + 10.5, anchor: 'start' },
      { x: p.x - 3, y: p.y - 5.5, anchor: 'end' },
      { x: p.x - 3, y: p.y + 10.5, anchor: 'end' },
    ].map((c) => ({ ...c, box: { x: c.anchor === 'start' ? c.x : c.x - w, y: c.y - FONT + 1, w, h: FONT } }));
    const fits = (c) => c.box.x >= VIEW.x + 2 && c.box.x + c.box.w <= VIEW.x + VIEW.w - 2 && c.box.y >= VIEW.y + 1 && c.box.y + c.box.h <= VIEW.y + VIEW.h - 1;
    const cost = (c) => (fits(c) ? 0 : 100) + placed.filter((b) => overlap(b, c.box)).length * 10 + pinBoxes.filter((b, j) => j !== i && overlap(b, c.box)).length * 5;
    let best = cands[0];
    let bestCost = cost(best);
    for (const c of cands.slice(1)) {
      if (bestCost === 0) break;
      const k = cost(c);
      if (k < bestCost) { best = c; bestCost = k; }
    }
    placed.push(best.box);
    out[i] = best;
  }
  return out;
}

/** Lists names the way the site writes them, "A, B and C". */
export function listNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The map card, or '' when there are no pins. */
export function worldMapCard(pins, { title = 'Main Sources on the Map' } = {}) {
  if (!pins || !pins.length) return '';
  const pts = pins.map((p) => ({ ...p, ...project(p.lon, p.lat) }));
  const labels = placeLabels(pts);
  const names = listNames(pins.map((p) => p.label));
  const svg = `<svg class="world-map" viewBox="${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}" role="img" aria-label="${esc(`World map with dots on ${names}`)}">`
    + `<rect x="${VIEW.x}" y="${VIEW.y}" width="${VIEW.w}" height="${VIEW.h}" rx="10" class="map-sea"/>`
    + `<g class="map-land">${LAND.map((d) => `<path d="${d}"/>`).join('')}</g>`
    + `<g class="map-pins">${pts.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="${PIN_R}"/>`).join('')}</g>`
    + `<g class="map-labels" font-size="${FONT}">${pts.map((p, i) => `<text x="${Math.round(labels[i].x * 10) / 10}" y="${Math.round(labels[i].y * 10) / 10}"${labels[i].anchor === 'end' ? ' text-anchor="end"' : ''}>${esc(p.label)}</text>`).join('')}</g>`
    + '</svg>';
  return `<figure class="card map-card"><p class="card-title">${esc(title)}</p>${svg}<figcaption class="map-list">${esc(names)}</figcaption></figure>`;
}
