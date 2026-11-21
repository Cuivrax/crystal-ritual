// Family hubs. A head stone page (/stones/jade/) is also the hub of its family. Its
// "All Types of Jade" section shows one card per variety listed in src/data/stone_families.json
// (synced from content/_ref/stone_families.json), the published ones first, then the rest A to Z.
// Pure functions, the data comes in as arguments so the tests run without Astro.
import { titleCase } from './ui.mjs';

/** A family gets its section from this many varieties up. */
export const MIN_VARIETIES = 3;

/** Section id and table of contents label. */
export const FAMILY_ID = 'all-types';
export const FAMILY_NAV = 'All Types';
export const FAMILY_INTRO = 'Every variety we cover, with a full guide as each one is published.';

/** The stone name of a plan or page H1, the way the Stone Atlas reads it ("Apricot Agate Meaning, ..." gives "Apricot Agate"). */
export function nameFromH1(h1) {
  return String(h1 || '').split(/ Meaning| Properties|,/)[0].trim();
}

/** "k2-jasper" gives "K2 Jasper". */
export function nameFromSlug(slug) {
  return titleCase(String(slug || '').split('-').filter(Boolean).join(' '));
}

const slugOf = (name) => String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Varieties of the family a slug heads, in file order without repeats or the head itself. Null under MIN_VARIETIES. */
export function familyVarieties(slug, families) {
  const list = families && Object.hasOwn(families, slug) ? families[slug] : null;
  if (!Array.isArray(list)) return null;
  const seen = new Set([slug]);
  const out = [];
  for (const s of list) {
    if (typeof s !== 'string' || !s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out.length >= MIN_VARIETIES ? out : null;
}

/**
 * The family name for the heading, as the atlas spells it (the stone sheet), else the plan name
 * when it names the slug ("Tiger's Eye" for tigers-eye, not "Types of Quartz" for quartz), else the slug.
 */
export function familyName(slug, { sheetName = null, planName = null } = {}) {
  if (sheetName) return sheetName;
  if (planName && slugOf(planName) === slug) return planName;
  return nameFromSlug(slug);
}

/** Name of a variety without a stone sheet, from the plan, else the slug. */
export function fallbackName(slug, planNames) {
  return (planNames && Object.hasOwn(planNames, slug) && planNames[slug]) || nameFromSlug(slug);
}

/** "All Types of Jade", in Title Case. */
export function familyHeading(name) {
  return titleCase(`All Types of ${name}`);
}

/** Cards with a published guide first, then the rest, each group A to Z. */
export function orderCards(cards) {
  return [...cards].sort((a, b) => Number(Boolean(b.guide)) - Number(Boolean(a.guide)) || a.name.localeCompare(b.name));
}

/**
 * Where the section goes among the page's H2 sections, an index to insert before.
 * Right after the Look-Alikes cards, else before the Price Guide, else after the last section.
 */
export function familySpot(sections) {
  const look = sections.findIndex((s) => s.kind === 'lookalikes');
  if (look >= 0) return look + 1;
  const price = sections.findIndex((s) => s.kind === 'price');
  return price >= 0 ? price : sections.length;
}
