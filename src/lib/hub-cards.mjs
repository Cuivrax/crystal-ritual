// Picture cards of the section hubs: three stones, a tint and one line per child page.
// For a need with a ranking the stones and the line come from intent_rankings.json, the others are set here.
import intents from '../data/intent_rankings.json';
import stonesIndex from '../data/stones.json';
import { cutoutHtml, CUTOUTS } from './images.mjs';

const SET = {
  '/crystals-for/sleep/': { tone: 'lavender' }, '/crystals-for/anxiety/': { tone: 'blue' }, '/crystals-for/love/': { tone: 'pink' },
  '/crystals-for/protection/': { tone: 'gray' }, '/crystals-for/money/': { tone: 'green' }, '/crystals-for/focus/': { tone: 'lavender' },
  '/crystals-for/grounding/': { tone: 'green' },
  '/crystals-for/beginners/': { tone: 'gold', stones: ['clear-quartz', 'amethyst', 'rose-quartz'], line: 'Seven tough, affordable stones to start with' },
  '/crystals-for/gifts/': { tone: 'pink', stones: ['rose-quartz', 'tigers-eye', 'citrine'], line: 'A stone for each person on your list' },
  '/care/crystals-that-cant-go-in-water/': { tone: 'blue', stones: ['selenite', 'opal', 'fluorite'], line: 'Which stones dissolve, crack or dull when wet' },
  '/care/how-to-cleanse-crystals/': { tone: 'green', stones: ['moonstone', 'selenite', 'clear-quartz'], line: 'Methods that are safe for every stone' },
  '/care/how-to-charge-crystals/': { tone: 'gold', stones: ['citrine', 'clear-quartz', 'amethyst'], line: 'Moonlight, sunlight and which stones fade' },
  '/real-or-fake/how-to-tell-if-crystals-are-real/': { tone: 'gray', stones: ['howlite', 'black-onyx', 'hematite'], line: 'Safe checks at home and what they prove' },
  '/real-or-fake/citrine/': { tone: 'gold', stones: ['citrine', 'citrine-heated', 'amethyst'], line: 'Natural citrine or heated amethyst' },
};
const nameOf = (slug) => stonesIndex.stones[slug]?.name || slug.replace(/-/g, ' ');

/** Card data of a hub child, or null when the page has no picture set (it keeps the plain text card). */
export async function hubCard(page, label) {
  const set = SET[page.url];
  if (!set) return null;
  const rank = (intents[page.slug] || []).filter((r) => CUTOUTS.has(r.slug));
  const stones = (set.stones || rank.slice(0, 3).map((r) => r.slug)).filter((s) => CUTOUTS.has(s)).slice(0, 3);
  if (stones.length === 0) return null;
  const top = !set.stones && rank[0] ? rank[0] : null;
  const pics = [];
  for (const s of stones) pics.push(await cutoutHtml(s, { box: 150 }));
  return {
    url: page.url, label, tone: set.tone, pics,
    line: set.line || stones.map(nameOf).join(', '),
    chip: top ? `${nameOf(top.slug)}, Named In ${top.n} Of ${top.of} Guides` : null,
  };
}

/** The tool a hub puts forward above its cards. */
export const HUB_TOOL = {
  '/care/': { href: '/tools/crystal-care-checker/', title: 'Crystal Care Checker', text: 'Pick your stone and see at once if water, sun, salt and heat are safe.', cta: 'Check Your Stone' },
  '/real-or-fake/': { href: '/tools/crystal-label-decoder/', title: 'Crystal Label Decoder', text: 'Type the name on the tag and see what the stone really is.', cta: 'Decode A Label' },
  '/crystals-for/': { href: '/stones/', title: 'Already Own A Stone?', text: 'Look it up in the Stone Atlas and see what it is and what it is linked to.', cta: 'Open The Stone Atlas' },
};
