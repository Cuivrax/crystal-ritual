// Markdown to structured HTML for the layouts.
//
//   const doc = await renderDocument(page, ctx)
//   doc.lead, doc.eyebrow, doc.intro, doc.sections[], doc.sources, doc.lastReviewed, doc.authorText, doc.hero
//
// The Markdown body is parsed with remark (GFM), turned into hast, then cleaned and
// reshaped by the transforms in transforms.mjs and by the page type transforms in
// sections.mjs. Nothing from an HTML comment reaches the output.
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import { isEl, meaningful, textOf, html, makeSlugger, el } from './hast.mjs';
import {
  processComments, processPlaceholders, processLinks, processCallouts, processLabels,
  processTables, processLists, processHeadings, unwrapHidden,
} from './transforms.mjs';
import { filterSourcesNodes, extractTrailers } from './sources-section.mjs';
import { classifySection, transformSection } from './sections.mjs';

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype, { allowDangerousHtml: true });

export async function toHast(markdown) {
  const mdast = processor.parse(String(markdown || ''));
  return processor.run(mdast);
}

/** Splits root children into the intro (before the first H2) and H2 sections. */
export function splitSections(children) {
  const intro = [];
  const sections = [];
  let cur = null;
  for (const n of children) {
    if (isEl(n, 'h2')) {
      cur = { heading: n, title: textOf(n).trim(), nodes: [] };
      sections.push(cur);
    } else if (cur) cur.nodes.push(n);
    else intro.push(n);
  }
  return { intro, sections };
}

/** Pulls the H1, an eyebrow paragraph before it and the lead paragraph after it out of the intro. */
export function splitIntro(nodes) {
  const kids = meaningful(nodes);
  let h1 = null;
  let eyebrow = null;
  const rest = [];
  let lead = null;
  const h1Index = kids.findIndex((n) => isEl(n, 'h1'));
  kids.forEach((n, i) => {
    if (i === h1Index) { h1 = n; return; }
    if (h1Index > 0 && i === h1Index - 1 && isEl(n, 'p') && textOf(n).length < 80) { eyebrow = n; return; }
    if (!lead && isEl(n, 'p') && (h1Index < 0 || i > h1Index) && textOf(n).trim().length > 40) { lead = n; return; }
    rest.push(n);
  });
  return { h1, eyebrow, lead, rest };
}

/**
 * Renders a page body.
 * ctx = {
 *   page, preview, isBuilt(path), policy, photos (parsed photo notes), photoHtml (Map role to figure HTML),
 *   data { intents, stones, care }, helpers { stoneThumb(slug), builtPages },
 * }
 */
export async function renderDocument(page, ctx) {
  const tree = await toHast(page.body);
  const local = { ...ctx, slots: [], hero: null };
  processComments(tree, local);
  processPlaceholders(tree, { preview: ctx.preview });

  const { intro, sections } = splitSections(tree.children);

  // Sources first, with the strict reference-only rule.
  let sources = null;
  let trailers = { lastReviewed: null, authorText: null };
  const body = [];
  for (const s of sections) {
    if (/^sources\b/i.test(s.title)) {
      const t = extractTrailers(s.nodes);
      trailers = { lastReviewed: t.lastReviewed || trailers.lastReviewed, authorText: t.authorText || trailers.authorText };
      const filtered = filterSourcesNodes(t.nodes, { policy: ctx.policy, isBuilt: ctx.isBuilt, frontmatterSources: page.data.sources || [] });
      sources = { ...s, nodes: filtered.nodes, report: { kept: filtered.kept, dropped: filtered.dropped, mixed: filtered.mixed, replaced: filtered.replaced } };
    } else {
      const t = extractTrailers(s.nodes);
      if (t.lastReviewed) trailers.lastReviewed = t.lastReviewed;
      if (t.authorText) trailers.authorText = t.authorText;
      body.push({ ...s, nodes: t.nodes });
    }
  }
  const introSplit = extractTrailers(intro);
  if (introSplit.authorText) trailers.authorText = introSplit.authorText;
  if (introSplit.lastReviewed) trailers.lastReviewed = introSplit.lastReviewed;

  // Generic transforms over everything but Sources.
  const work = { type: 'root', children: [...introSplit.nodes, ...body.flatMap((s) => [s.heading, ...s.nodes])] };
  processLinks(work, { isBuilt: ctx.isBuilt, allowExternal: ctx.policy.isBodyLinkAllowed, markHidden: true });
  processCallouts(work);
  processLabels(work);
  processTables(work);
  processLists(work);
  const slug = makeSlugger();
  processHeadings(work, slug);
  if (sources) sources.heading.properties.id = 'sources';
  if (trailers.lastReviewed) processLinks({ type: 'root', children: [trailers.lastReviewed] }, { isBuilt: ctx.isBuilt, allowExternal: ctx.policy.isReferenceUrl });

  // Re-split after the transforms replaced nodes.
  const again = splitSections(work.children);
  const introParts = splitIntro(again.intro);
  const out = {
    h1: introParts.h1 ? textOf(introParts.h1).trim() : null,
    eyebrow: introParts.eyebrow ? html(introParts.eyebrow.children) : null,
    lead: introParts.lead ? html(introParts.lead.children) : null,
    introNodes: introParts.rest,
    sections: [],
    sources: null,
    sourcesReport: sources ? sources.report : null,
    lastReviewed: trailers.lastReviewed ? html(trailers.lastReviewed.children) : null,
    authorText: trailers.authorText,
    hero: local.hero,
    slots: local.slots,
  };

  for (const s of again.sections) {
    const kind = classifySection(s.title, page);
    const section = { id: s.heading.properties.id, title: s.title, heading: s.heading, nodes: s.nodes, kind, band: null, badge: null, layout: null };
    transformSection(section, { ...ctx, page, slug });
    out.sections.push(section);
  }

  // Finish, drop the hidden link markers and stringify.
  const finish = (nodes) => { const r = { type: 'root', children: nodes }; unwrapHidden(r); return html(r.children); };
  out.intro = finish(out.introNodes);
  for (const s of out.sections) {
    s.headingHtml = finish(s.heading.children);
    s.html = finish(s.nodes);
    if (s.asideNodes) s.asideHtml = finish(s.asideNodes);
    if (s.extraNodes) s.extraHtml = finish(s.extraNodes);
  }
  if (sources) out.sources = html(sources.nodes);
  else {
    // No Sources section in the body, so the list comes from the frontmatter (never both).
    const filtered = filterSourcesNodes([], { policy: ctx.policy, isBuilt: ctx.isBuilt, frontmatterSources: page.data.sources || [] });
    if (filtered.kept) { out.sources = html(filtered.nodes); out.sourcesReport = { kept: filtered.kept, dropped: [], mixed: [], replaced: 0, fromFrontmatter: true }; }
  }
  return out;
}

export { el };
