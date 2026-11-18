// The site model, computed once per build.
//   pages    every page that passes the publish gate (all pages with PREVIEW=1)
//   held     pages kept out, with the reasons
//   isBuilt  answers for an internal path, the base of the hidden-link rule
import { getCollection } from 'astro:content';
import { partition, parseBuildNow, isPreview, evaluate } from './gate.mjs';
import { idToUrl, lastSegment, section, normalizePath } from './urls.mjs';
import stonesIndex from '../data/stones.json';

let cache = null;

const STATIC_FILES = new Set(['/rss.xml', '/sitemap.xml', '/robots.txt', '/404/']);

function makePage(entry, gateRow, now) {
  const data = entry.data;
  const url = data.url;
  const type = data.page_type;
  const slug = lastSegment(url);
  const sheet = type === 'stone' ? stonesIndex.stones[slug] || null : null;
  const normal = evaluate(entry, { now, preview: false });
  return {
    id: entry.id,
    url,
    data,
    body: entry.body || '',
    type,
    slug,
    section: section(url),
    night: url === '/moon/' || url.startsWith('/moon/'),
    publishAt: gateRow.publishAt,
    heldReasons: normal.reasons,
    stoneSheet: sheet,
    stoneName: sheet ? sheet.name : null,
  };
}

export async function getSite() {
  if (cache) return cache;
  const entries = await getCollection('pages');
  const problems = [];
  for (const e of entries) {
    const expected = idToUrl(e.id);
    if (e.data.url !== expected) problems.push(`${e.id}.md has url ${e.data.url}, its file name says ${expected}`);
  }
  if (problems.length) throw new Error(`Page url and file name disagree\n${problems.join('\n')}`);

  const preview = isPreview();
  const now = parseBuildNow(process.env.BUILD_NOW);
  const { built, held } = partition(entries, { now, preview });
  const pages = built.map((row) => makePage(row.entry, row, now)).sort((a, b) => a.url.localeCompare(b.url));
  const byUrl = new Map(pages.map((p) => [p.url, p]));
  const builtUrls = new Set(pages.map((p) => p.url));
  const isBuilt = (path) => {
    if (!path) return false;
    const p = normalizePath(path);
    return builtUrls.has(p) || STATIC_FILES.has(p);
  };
  cache = { preview, now, pages, held, byUrl, builtUrls, isBuilt, all: entries };
  return cache;
}

/** Built child pages one level below a hub ("/birthstones/" lists "/birthstones/december/"). */
export function childrenOf(site, hubUrl) {
  const depth = hubUrl.split('/').filter(Boolean).length;
  return site.pages.filter((p) => p.url !== hubUrl && p.url.startsWith(hubUrl) && p.url.split('/').filter(Boolean).length === depth + 1);
}

/** Article pages that feed Field Notes and the RSS feed, newest first. */
export const ARTICLE_TYPES = ['stone', 'compare', 'situation', 'guide', 'ritual', 'list', 'month', 'sign', 'lab', 'essay'];

export function articles(site) {
  return site.pages
    .filter((p) => ARTICLE_TYPES.includes(p.type))
    .sort((a, b) => (b.publishAt?.getTime() || 0) - (a.publishAt?.getTime() || 0) || a.data.h1.localeCompare(b.data.h1));
}

/** Label of a page's section, for Field Notes and breadcrumbs. */
export const SECTION_LABELS = {
  stones: 'Stones', 'crystals-for': 'Crystals For', rituals: 'Rituals', 'real-or-fake': 'Real or Fake', care: 'Care',
  birthstones: 'Birthstones', zodiac: 'Zodiac', compare: 'Compare', moon: 'Moon', tools: 'Tools', chakras: 'Chakras',
  story: 'The Story', lab: 'Stone Lab', guides: 'Guides', identify: 'Identify', shapes: 'Shapes',
};
export const CATEGORY_LABELS = {
  stone: 'Stone', compare: 'Compare', situation: 'Crystals For', ritual: 'Ritual', list: 'Care', month: 'Birthstones',
  sign: 'Zodiac', lab: 'Stone Lab', essay: 'The Story', guide: 'Guide',
};
export function categoryOf(page) {
  if (page.type === 'guide') return SECTION_LABELS[page.section] || 'Guide';
  return CATEGORY_LABELS[page.type] || SECTION_LABELS[page.section] || 'Guide';
}
