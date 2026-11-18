// The "Sources" section at the end of a page.
// Only reference URLs are shown (see src/lib/sources.mjs). An item whose links all point
// to dealers or crystal guides is dropped, an item that names a guide's domain in plain
// text is dropped, and a stray guide link inside a kept item loses its anchor.
import { el, txt, isEl, meaningful, walk, textOf } from './hast.mjs';
import { sourceItemVerdict, GUIDES_LINE } from '../sources.mjs';
import { processLinks } from './transforms.mjs';

function externalLinks(node) {
  const out = [];
  walk(node, (n) => {
    if (isEl(n, 'a') && /^https?:\/\//i.test(n.properties?.href || '') && !/crystalandritual\.com/i.test(n.properties.href)) out.push(n.properties.href);
    return undefined;
  });
  return out;
}

/**
 * Filters the nodes of a Sources section in place.
 * Returns { nodes, kept, dropped, mixed } where mixed lists kept items that still name a hidden guide.
 */
export function filterSourcesNodes(nodes, { policy, isBuilt, frontmatterSources = [] }) {
  const report = { kept: 0, dropped: [], mixed: [], replaced: 0 };
  const root = { type: 'root', children: nodes };
  let guidesLineShown = false;
  walk(root, (node) => {
    if (!isEl(node, ['ul', 'ol'])) return undefined;
    node.children = node.children.filter((li) => {
      if (!isEl(li, 'li')) return true;
      const links = externalLinks(li);
      const verdict = sourceItemVerdict({ links, text: textOf(li) }, policy);
      if (verdict === 'replace') {
        report.replaced++;
        if (guidesLineShown) { report.dropped.push(textOf(li).slice(0, 90)); return false; }
        guidesLineShown = true;
        li.children = [txt(GUIDES_LINE.before), el('a', { href: GUIDES_LINE.href }, [txt(GUIDES_LINE.link)])];
        report.kept++;
        return true;
      }
      if (verdict === 'drop') { report.dropped.push(textOf(li).slice(0, 90)); return false; }
      if (links.some((u) => !policy.isReferenceUrl(u))) report.mixed.push(textOf(li).slice(0, 90));
      report.kept++;
      return true;
    });
    return 'skip';
  });
  processLinks(root, { isBuilt, allowExternal: policy.isReferenceUrl });

  // A Sources section with no list at all falls back to the frontmatter URLs.
  const hasList = root.children.some((n) => isEl(n, ['ul', 'ol']));
  if (!hasList) {
    const shown = frontmatterSources.filter((u) => policy.isReferenceUrl(u));
    if (shown.length) {
      root.children.push(el('ul', {}, shown.map((u) => el('li', {}, [el('a', { href: u, rel: ['noopener'] }, [txt(labelFor(u))])]))));
      report.kept += shown.length;
    }
  }
  return { nodes: root.children, ...report };
}

/** A readable label for a bare URL, "gia.edu/amethyst" style. */
export function labelFor(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const path = decodeURIComponent(u.pathname).replace(/\/$/, '').split('/').filter(Boolean).slice(-1)[0] || '';
    return path ? `${host}, ${path.replace(/[-_]+/g, ' ').replace(/\.\w+$/, '')}` : host;
  } catch { return url; }
}

/** Pulls "Last reviewed ..." and the italic author line out of a node list. */
export function extractTrailers(nodes) {
  let lastReviewed = null;
  let authorText = null;
  const keep = [];
  for (const n of nodes) {
    if (isEl(n, 'p')) {
      const t = textOf(n).trim();
      const kids = meaningful(n.children);
      if (/^Last reviewed\b/i.test(t)) { lastReviewed = n; continue; }
      if (kids.length === 1 && isEl(kids[0], 'em') && /pen name/i.test(t)) { authorText = t; continue; }
    }
    keep.push(n);
  }
  return { nodes: keep, lastReviewed, authorText };
}
