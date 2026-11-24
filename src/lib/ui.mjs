// Small HTML builders shared by the Markdown pipeline and the Astro components.
// Every visible string here follows the house style (Title Case labels, no colons).

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------------------------------------------------------- facets
export const FACET_LABELS = { 5: 'Classic', 4: 'Widely Linked', 3: 'Often Linked', 2: 'Sometimes Linked', 1: 'Rarely Linked' };
const LABEL_TO_FACETS = Object.fromEntries(Object.entries(FACET_LABELS).map(([n, l]) => [l.toLowerCase(), Number(n)]));

export function facetsFromLabel(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[.,;]$/, '');
  return LABEL_TO_FACETS[t] || null;
}

/** Facets from a guide count, n guides linking the stone out of `of` guides read. */
export function facetsFromCounts(n, of) {
  if (!n || !of) return 1;
  const share = n / of;
  const level = share >= 0.7 ? 5 : share >= 0.5 ? 4 : share >= 0.35 ? 3 : share >= 0.2 ? 2 : 1;
  const cap = n >= 6 ? 5 : n >= 4 ? 4 : n === 3 ? 3 : 2;
  return Math.max(1, Math.min(level, cap));
}

const GEM = (x) => `M${x} 1L${x + 6} 5.5L${x} 15L${x - 6} 5.5Z`;

/** The five-facet scale, filled gems for the rating and outlined gems for the rest. */
export function facetSvg(n, { width = 78, label = true } = {}) {
  const k = Math.max(0, Math.min(5, Number(n) || 0));
  const xs = [7, 23, 39, 55, 71];
  const filled = xs.slice(0, k).map(GEM).join('');
  const empty = xs.slice(k).map(GEM).join('');
  const h = Math.round((width / 78) * 16);
  const aria = label ? ` role="img" aria-label="${k} of 5 facets, ${esc(FACET_LABELS[k] || '')}"` : ' aria-hidden="true"';
  return `<svg class="facets" width="${width}" height="${h}" viewBox="0 0 78 16"${aria} focusable="false">`
    + (filled ? `<path class="facets-on" d="${filled}"/>` : '')
    + (empty ? `<path class="facets-off" d="${empty}"/>` : '')
    + '</svg>';
}

export function facetRating(n, { compact = false } = {}) {
  return `<span class="facet-rating${compact ? ' is-compact' : ''}">${facetSvg(n, { label: false })}<span class="facet-word">${esc(FACET_LABELS[n] || '')}</span></span>`;
}

export const HOW_WE_RATE_TEXT = 'We compare the main crystal books, guides and traditions, from Kunz in 1913 to today, in several languages. The more consistently a stone is linked to an intention, the more facets it gets. It shows how widely a belief is held, not whether it works.';

export function facetLegend() {
  return `<ul class="facet-legend" role="list" aria-label="The five levels">${[5, 4, 3, 2, 1]
    .map((n) => `<li>${facetSvg(n, { label: false })}<span>${FACET_LABELS[n]}</span></li>`).join('')}</ul>`;
}

// ---------------------------------------------------------------- care ratings
export const RATINGS = {
  ok: { label: 'OK', cls: 'r-ok' },
  brief_only: { label: 'Brief Only', cls: 'r-brief' },
  avoid: { label: 'Avoid', cls: 'r-avoid' },
  unknown: { label: 'Not Enough Data', cls: 'r-unknown' },
};

// The avoid rating says what to do for each test (owner's wording, 2026-11-19).
// Keys and colors stay, OK, Brief Only and Not Enough Data keep their labels.
const AVOID_LABELS = [
  [/ultrasonic|steam|machine|cleaning/, 'No Ultrasonic or Steam'],
  [/repair|polish|re-?cut/, 'No Repolishing'],
  [/soak/, 'No Soaking'],
  [/water|wash|rinse|\bwet\b|\bdry\b/, 'Keep Dry'],
  [/\bsun|light|\buv\b/, 'Keep Out of Sun'],
  [/salt/, 'No Salt'],
  [/heat|\bhot\b|fire/, 'Keep Away From Heat'],
  [/chemical|acid|cleaner|detergent|perfume|lotion/, 'No Chemicals'],
  [/toxic/, 'Handle With Care'],
  [/knock|scratch|wear|fragil|storage|drop/, 'Handle Gently'],
];

/** The visible label of a rating for a field ("water", "Sun safe", "Long Soak"). */
export function ratingLabel(key, field = '') {
  if (key === 'avoid') {
    const f = String(field || '').toLowerCase();
    const hit = AVOID_LABELS.find(([rx]) => rx.test(f));
    if (hit) return hit[1];
  }
  return (RATINGS[key] || RATINGS.unknown).label;
}

/** Reads a rating word at the start of a care sentence. */
export function ratingFromText(text) {
  const t = String(text || '').trim().toLowerCase();
  if (/^ok\b/.test(t) || /^yes\b/.test(t)) return 'ok';
  if (/^brief( only)?\b/.test(t) || /^quick rinse only/.test(t)) return 'brief_only';
  if (/^(avoid|skip|never|no)\b/.test(t)) return 'avoid';
  if (/^(unknown|not enough data)\b/.test(t)) return 'unknown';
  return null;
}

export function ratingPill(rating, { small = false } = {}) {
  const r = RATINGS[rating] || RATINGS.unknown;
  return `<span class="pill ${r.cls}${small ? ' is-small' : ''}">${esc(r.label)}</span>`;
}

// ---------------------------------------------------------------- evidence labels
export const EVIDENCE = {
  'mineral fact': { label: 'Mineral Fact', cls: 'b-mineral' },
  tradition: { label: 'Tradition', cls: 'b-tradition' },
  'modern association': { label: 'Modern Association', cls: 'b-modern' },
  'what research says': { label: 'What Research Says', cls: 'b-research' },
  'try this': { label: 'Try This', cls: 'b-try' },
  safety: { label: 'Safety', cls: 'b-safety' },
};

export function badge(key) {
  const e = EVIDENCE[key];
  if (!e) return '';
  return `<span class="badge ${e.cls}">${esc(e.label)}</span>`;
}

export function evidenceLegend() {
  return `<div class="label-legend"><span class="label-legend-title">How We Label Things</span>${['mineral fact', 'tradition', 'modern association', 'try this'].map(badge).join('')}</div>`;
}

// ---------------------------------------------------------------- Mohs scale
const REFS = [
  { v: 2.5, name: 'Fingernail', row: 0 },
  { v: 3.5, name: 'Copper Coin', row: 1 },
  { v: 5.5, name: 'Glass', row: 0 },
  { v: 6.5, name: 'Steel Knife', row: 1 },
];
const pos = (v) => ((v - 1) / 9) * 100;

export function mohsCompare(min, max) {
  if (min > 6.5) return 'Harder than glass and a steel knife';
  if (min > 5.5) return 'Harder than glass, softer than a steel knife';
  if (max < 2.5) return 'Softer than a fingernail';
  if (max < 3.5) return 'Softer than a copper coin';
  if (max < 5.5) return 'Softer than glass';
  return 'About as hard as glass';
}

/**
 * The Mohs scale card. rows, [{ name, min, max, tone }] (one row on stone pages, two on compare pages).
 */
export function mohsScale(rows) {
  const n = rows.length;
  const rowH = 46;
  const top = n * rowH;
  const labels = rows.map((r, i) => {
    const left = pos((r.min + r.max) / 2);
    const width = Math.max(pos(r.max) - pos(r.min), 0);
    const range = r.min === r.max ? `${fmt(r.min)}` : `${fmt(r.min)} to ${fmt(r.max)}`;
    const y = i * rowH;
    const anchor = left > 80 ? 'is-end' : left < 20 ? 'is-start' : '';
    return `<span class="mohs-name ${anchor} tone-${r.tone || 0}" style="left:${left.toFixed(2)}%;top:${y}px">${esc(r.name)}, ${range}</span>`
      + `<span class="mohs-track" style="top:${y + 22}px"></span>`
      + `<span class="mohs-range tone-${r.tone || 0}" style="left:${pos(r.min).toFixed(2)}%;width:${width.toFixed(2)}%;top:${y + 18}px"></span>`;
  }).join('');
  const ticks = Array.from({ length: 10 }, (_, i) => i + 1)
    .map((v) => `<span class="mohs-tick${v % 2 === 0 ? ' is-even' : ''}" style="left:${pos(v).toFixed(2)}%;top:${top + 4}px">${v}</span>`).join('');
  const refs = REFS.map((r) => `<span class="mohs-ref-line" style="left:${pos(r.v).toFixed(2)}%;top:${top - 6}px;height:${r.row ? 52 : 30}px"></span>`
    + `<span class="mohs-ref" style="left:${pos(r.v).toFixed(2)}%;top:${top + (r.row ? 50 : 28)}px">${r.name} ${r.v}</span>`).join('');
  const aria = `Mohs scale from 1 to 10. ${rows.map((r) => `${r.name} ${r.min === r.max ? fmt(r.min) : `${fmt(r.min)} to ${fmt(r.max)}`}`).join(', ')}. For reference, a fingernail is 2.5, a copper coin 3.5, glass 5.5 and a steel knife 6.5`;
  return `<div class="mohs" role="img" aria-label="${esc(aria)}" style="height:${top + 74}px">${labels}${refs}${ticks}</div>`;
}

const fmt = (v) => (Number.isInteger(v) ? String(v) : String(v));

/** "7 to 7.5", "7, no cleavage", "6 to 7" into { min, max }. */
export function parseMohs(text) {
  const t = String(text || '').replace(/\[TO CHECK[^\]]*\]/g, '');
  const m = /(\d+(?:\.\d+)?)(?:\s*(?:to|-|–)\s*(\d+(?:\.\d+)?))?/.exec(t);
  if (!m) return null;
  const min = Number(m[1]);
  const max = m[2] ? Number(m[2]) : min;
  if (!(min >= 1 && max <= 10 && max >= min)) return null;
  return { min, max };
}

// ---------------------------------------------------------------- icons (24 by 24, stroke)
const P = {
  gem: '<path d="M6 3h12l4 6-10 12L2 9l4-6z"/><path d="M2 9h20M9 3l3 18M15 3l-3 18"/>',
  cube: '<path d="M5 8l7-4 7 4-7 3z"/><path d="M5 8v9l7 3 7-3V8"/><path d="M12 11v9"/>',
  weight: '<path d="M6 20h12l-2-11H8z"/><circle cx="12" cy="6" r="2.5"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  flask: '<path d="M9 3h6M10 3v6L5 19a1.5 1.5 0 0 0 1.3 2h11.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7.5 15h9"/>',
  pin: '<circle cx="12" cy="10" r="3"/><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/>',
  mountain: '<path d="M3 20l6-9 4 5 3-4 5 8z"/>',
  bolt: '<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>',
  tag: '<path d="M3 12l9-9h8v8l-9 9z"/><circle cx="16" cy="8" r="1.5"/>',
  drop: '<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>',
  bowl: '<path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M7 7c1-1 2-1 3 0s2 1 3 0 2-1 3 0"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
  salt: '<path d="M8 10h8l-1 10H9z"/><path d="M9 10a3 3 0 0 1 6 0"/><path d="M11 6.5h.01M13 6.5h.01"/>',
  flame: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 1 1 2 2 3 2 0-2-1-4 0-6z"/>',
  bottle: '<path d="M10 2h4v4l3 4v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V10l3-4z"/><path d="M7 14h10"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
  box: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>',
  shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z"/>',
  warn: '<path d="M12 3l8 15H4z"/><path d="M12 10v4M12 17v.5"/>',
  hand: '<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6 7s-5-2-6.5-4.5L3 12.5a1.5 1.5 0 0 1 2.5-1.5L8 13"/>',
  magnifier: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
  waves: '<path d="M3 12c3-4 6-4 9 0s6 4 9 0"/><path d="M3 17c3-4 6-4 9 0s6 4 9 0"/><path d="M3 7c3-4 6-4 9 0s6 4 9 0"/>',
  coin: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.2c0-1 1.1-1.7 2.5-1.7s2.5.7 2.5 1.7-1.1 1.4-2.5 1.8-2.5.8-2.5 1.8 1.1 1.7 2.5 1.7 2.5-.7 2.5-1.7"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.8"/>',
  root: '<path d="M12 3v9M12 12c-3 0-5 2-6 6M12 12c3 0 5 2 6 6M12 12v9"/>',
  seed: '<path d="M12 21c-4-3-6-7-6-11a6 6 0 0 1 12 0c0 4-2 8-6 11z"/><path d="M12 9v8"/>',
  gift: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18M12 9v11M12 9c-1.5-3-5-4-5-1.5S10 9 12 9c2 0 5 1 5-1.5S13.5 6 12 9z"/>',
  lamp: '<path d="M8 3h8l3 7H5z"/><path d="M12 10v7M7 21h10M9 17h6"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  star: '<path d="M6 0 L7.2 4.8 L12 6 L7.2 7.2 L6 12 L4.8 7.2 L0 6 L4.8 4.8 Z"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>',
  zodiac: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.6 1.7-1.6H16a5 5 0 0 0 5-5c0-4-4-7.3-9-7.3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7.2" r="1"/><circle cx="14.5" cy="7.2" r="1"/>',
  eye: '<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
};

export function icon(name, { size = 24, cls = '', stroke = 1.6 } = {}) {
  const p = P[name] || P.gem;
  if (name === 'star') {
    return `<svg class="icon ${cls}" width="${size}" height="${size}" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6 0 L7.2 4.8 L12 6 L7.2 7.2 L6 12 L4.8 7.2 L0 6 L4.8 4.8 Z"/></svg>`;
  }
  return `<svg class="icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${p}</svg>`;
}

// Icons beside the H3 titles of stone sections (R3-Stone, "What It Is"). First match wins.
const H3_ICONS = [
  [/comes? from|is found|found\b|sources?\b|mined|where .* (?:from|found)/i, 'pin'],
  [/\bcrystals?\b|structure/i, 'cube'],
  [/\bforms?\b|grows?\b|how big|formation|deposit/i, 'mountain'],
  [/charge|electric|\bmagnetic\b|piezo/i, 'bolt'],
  [/\bheat|heated|treat|irradiat|dye/i, 'flame'],
  [/\bsun\b|light\b|\buv\b|glow/i, 'sun'],
  [/water|soak|wet|salt|soluble/i, 'drop'],
  [/flash|rainbow|glitter|sparkle|shimmer|play of/i, 'sparkle'],
  [/inside|\bin my\b|look like|looks like|spots|trees|shell|see\b|read the/i, 'eye'],
  [/\breal\?$|\bfakes?\b|real or fake/i, 'magnifier'],
  [/name|label|called|pronounce|means|trade|\bvs\b|\bor\b|same as|types?\b|kinds?\b|stone or/i, 'tag'],
  [/colou?rs?\b|pink|orange|purple|violet|green\b|blue\b|white\b|yellow|black\b|\bred\b|cloudy|dark|streaks?/i, 'palette'],
  [/scratch|hard(?:ness)?\b|soft(?:er)?\b|durab|brittle|break/i, 'shield'],
  [/formula|composition|chemi/i, 'flask'],
  [/used for|uses?\b|does\b|do\b/i, 'hand'],
  [/rare|collector|value|price|cost/i, 'star'],
  [/real\b|fake|natural|lab-grown|synthetic|imitation|checks?\b|tell\b/i, 'magnifier'],
  [/guides?|history|story|old\b/i, 'book'],
];

/** The icon name for an H3 title, gem when nothing fits. */
export function h3IconName(title) {
  const hit = H3_ICONS.find(([rx]) => rx.test(String(title)));
  return hit ? hit[1] : 'gem';
}

/** The brand mark, a faceted crystal outline in a ring. */
export function logoMark({ size = 42 } = {}) {
  return `<span class="logo-mark" style="width:${size}px;height:${size}px" aria-hidden="true"><svg width="${Math.round(size * 0.48)}" height="${Math.round(size * 0.62)}" viewBox="0 0 64 80" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"><path d="M32 4 L50 26 L50 62 L32 76 L14 62 L14 26 Z"/><path d="M14 26 L32 34 L50 26"/><path d="M32 4 L32 76"/></svg></span>`;
}

export function ornament() {
  return `<div class="ornament" aria-hidden="true"><span></span>${icon('star', { size: 12 })}<span></span></div>`;
}

// ---------------------------------------------------------------- intentions
// Colors and icons for the Crystals For pages, from the R3 mockups.
export const INTENTIONS = {
  sleep: { label: 'Sleep', tone: 'lavender', icon: 'moon' },
  anxiety: { label: 'Anxiety', tone: 'green', icon: 'waves' },
  love: { label: 'Love', tone: 'pink', icon: 'heart' },
  protection: { label: 'Protection', tone: 'gray', icon: 'shield' },
  money: { label: 'Money', tone: 'gold', icon: 'coin' },
  focus: { label: 'Focus', tone: 'blue', icon: 'target' },
  grounding: { label: 'Grounding', tone: 'green', icon: 'root' },
  confidence: { label: 'Confidence', tone: 'pink', icon: 'sparkle' },
  grief: { label: 'Grief', tone: 'lavender', icon: 'heart' },
  beginners: { label: 'Beginners', tone: 'blue', icon: 'seed' },
  gifts: { label: 'Gifts', tone: 'pink', icon: 'gift' },
};

export function titleCase(s) {
  const small = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'as', 'at', 'by', 'in', 'of', 'on', 'to', 'vs', 'with', 'from', 'into']);
  const words = String(s).split(/(\s+)/);
  const real = words.filter((w) => w.trim());
  let k = 0;
  return words.map((w) => {
    if (!w.trim()) return w;
    const first = k === 0;
    const last = k === real.length - 1;
    k++;
    const lower = w.toLowerCase();
    if (!first && !last && small.has(lower)) return lower;
    return w.replace(/^([("'“]?)(\p{L})/u, (m, p, c) => p + c.toUpperCase()).replace(/-(\p{Ll})/gu, (m, c) => `-${c.toUpperCase()}`);
  }).join('');
}
