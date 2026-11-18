// Generic transforms applied to every page body, in this order
//   comments (photos, tool slots), placeholders, hidden links, callouts, labels,
//   tables, lists, heading ids.
import { el, txt, raw, isEl, isBlank, meaningful, walk, textOf, addClass, leadStrong, dropLeadStrong, makeSlugger } from './hast.mjs';
import { internalPath, normalizePath } from '../urls.mjs';
import { EVIDENCE, FACET_LABELS, facetsFromLabel, facetRating, ratingFromText, RATINGS, icon, esc, titleCase } from '../ui.mjs';

// ------------------------------------------------------------ comments
export function toolKeyFor(comment) {
  const t = String(comment);
  if (/^<!--\s*(TOOL TO BUILD|TOOL EMBED)/.test(t)) return null;
  if (/^<!--\s*FORM\b/.test(t) || /^<!--\s*BUILD contact form\b/i.test(t)) return 'contact-form';
  if (/^<!--\s*TABLE\b/.test(t)) return /care\.json/.test(t) ? 'care-table' : null;
  if (!/^<!--\s*TOOL\b/.test(t)) return null;
  if (/Stone Atlas/i.test(t)) return 'atlas';
  if (/checker/i.test(t) && /care/i.test(t)) return 'care-checker';
  if (/Full Moon Calendar/i.test(t)) return 'moon-calendar';
  if (/Date picker|Birthday Moon/i.test(t)) return 'moon-birthday';
  if (/mini panel/i.test(t)) return 'moon-mini';
  if (/Tonight's Moon/i.test(t)) return 'moon-tonight';
  return null;
}

/**
 * Removes every HTML comment. Photo notes become figures when their file exists
 * (ctx.photoHtml, keyed by role), the hero photo is kept aside in ctx.hero.
 * Tool notes become slot markers <div data-slot="..."> for the layout to fill.
 */
export function processComments(tree, ctx) {
  const photosByRaw = new Map((ctx.photos || []).map((p) => [p.raw.trim(), p]));
  ctx.slots = ctx.slots || [];
  walk(tree, (node, i, parent) => {
    if (node.type === 'comment') return [];
    if (node.type !== 'raw') return undefined;
    const value = String(node.value).trim();
    if (!value.startsWith('<!--')) return []; // raw HTML is not allowed in the content
    const inline = isEl(parent, ['p', 'li', 'td', 'th', 'strong', 'em', 'a']);
    const photo = photosByRaw.get(value);
    if (photo) {
      if (photo.pair) return []; // compare pages render the pair under the title
      if (photo.hero) { if (!ctx.hero && ctx.photoHtml?.has('hero')) ctx.hero = photo; return []; }
      const figure = ctx.photoHtml?.get(photo.role);
      if (figure && !inline) return [raw(figure)];
      return [];
    }
    const key = toolKeyFor(value);
    if (key && !inline) {
      ctx.slots.push(key);
      return [el('div', { dataSlot: key })];
    }
    return [];
  });
}

// ------------------------------------------------------------ placeholders
const PLACEHOLDER_RX = /\[TO CHECK[^\]]*\]?/gi;

/** In PREVIEW, "[TO CHECK ...]" is wrapped in a yellow <mark>. Outside PREVIEW such pages are never built. */
export function processPlaceholders(tree, { preview }) {
  if (!preview) return;
  walk(tree, (node, i, parent) => {
    if (isEl(parent, 'mark')) return 'skip';
    if (node.type !== 'text' || !/\[TO CHECK/i.test(node.value)) return undefined;
    const out = [];
    let last = 0;
    for (const m of node.value.matchAll(PLACEHOLDER_RX)) {
      if (m.index > last) out.push(txt(node.value.slice(last, m.index)));
      out.push(el('mark', { className: ['tocheck'] }, [txt(m[0])]));
      last = m.index + m[0].length;
    }
    if (last < node.value.length) out.push(txt(node.value.slice(last)));
    return out;
  });
}

// ------------------------------------------------------------ links
/**
 * Hidden links. An internal link whose target is not in the built set keeps its words
 * and loses its anchor. External links follow the source policy.
 *   isBuilt(path) answers for internal paths ("/stones/amethyst/").
 *   allowExternal(url) answers for external URLs (omit it to keep every external link).
 */
export function processLinks(tree, { isBuilt, allowExternal, markHidden = false } = {}) {
  walk(tree, (node) => {
    if (!isEl(node, 'a')) return undefined;
    const href = node.properties?.href;
    if (typeof href !== 'string' || !href) return node.children;
    if (href.startsWith('#')) return undefined;
    const path = internalPath(href);
    if (path !== null) {
      if (isBuilt && !isBuilt(path)) {
        // markHidden keeps the target for the layout transforms, unwrapHidden() removes it later.
        return markHidden ? [el('span', { dataHiddenHref: path }, node.children)] : node.children;
      }
      const hash = href.includes('#') ? href.slice(href.indexOf('#')) : '';
      node.properties.href = normalizePath(path) + hash;
      return undefined;
    }
    if (/^https?:\/\//i.test(href)) {
      if (allowExternal && !allowExternal(href)) return node.children;
      node.properties.rel = ['noopener'];
      return undefined;
    }
    return node.children; // mailto, tel and others are not used on this site
  });
}

/** Removes the temporary markers left by processLinks({ markHidden: true }). */
export function unwrapHidden(tree) {
  walk(tree, (node) => (isEl(node, 'span') && node.properties?.dataHiddenHref ? node.children : undefined));
}

/** The target of a link or of a hidden link marker. */
export function targetOf(node) {
  if (isEl(node, 'a')) return internalPath(node.properties?.href || '');
  if (isEl(node, 'span') && node.properties?.dataHiddenHref) return node.properties.dataHiddenHref;
  return null;
}

/** The same rule as a rehype plugin, unified().use(rehypeHiddenLinks, { isBuilt }). */
export function rehypeHiddenLinks(options = {}) {
  return (tree) => { processLinks(tree, options); };
}

// ------------------------------------------------------------ callouts
export function processCallouts(tree) {
  walk(tree, (node) => {
    if (!isEl(node, 'blockquote')) return undefined;
    const kids = meaningful(node.children);
    const first = kids[0];
    const lead = isEl(first, 'p') ? leadStrong(first) : null;
    if (!lead) { addClass(node, 'pull-quote'); return 'skip'; }
    const title = lead.label.replace(/[.:]\s*$/, '').trim();
    dropLeadStrong(first);
    if (!meaningful(first.children).length) kids.shift();
    let kind = 'callout-plain';
    if (/when a stone is not enough/i.test(title)) kind = 'callout-care';
    else if (/is it real|quick checks/i.test(title)) kind = 'callout-real';
    else if (/trade name/i.test(title)) kind = 'callout-trade';
    return [el('aside', { className: ['callout', kind] }, [el('p', { className: ['callout-title'] }, [txt(title)]), el('div', { className: ['callout-body'] }, kids)])];
  });
}

// ------------------------------------------------------------ evidence labels
const NOTE_KEYS = { safety: 'note-safety', 'what research says': 'note-research', 'next step': 'note-next' };
const LAYER_KEYS = { 'the stone': 'stone', 'the story': 'story', 'the ritual': 'ritual' };
const LABEL_RX = /^(mineral fact|tradition|modern association|what research says|try this|safety)\.$/i;

export function badgeNode(key) {
  const e = EVIDENCE[key];
  return el('span', { className: ['badge', e.cls] }, [txt(e.label)]);
}

export function processLabels(tree) {
  // Paragraph level, "Safety." "What Research Says." "Next Step." open a note box.
  walk(tree, (node, i, parent) => {
    if (!isEl(node, 'p')) return undefined;
    const lead = leadStrong(node);
    if (!lead) return 'skip';
    const top = parent.type === 'root' || isEl(parent, ['section', 'div']);
    if (top && NOTE_KEYS[lead.key]) { addClass(node, 'note', NOTE_KEYS[lead.key]); lead.node.properties.className = ['note-lead']; }
    if (LAYER_KEYS[lead.key]) node.properties.dataLayer = LAYER_KEYS[lead.key];
    return 'skip';
  });
  // Inline, evidence labels become badges, except the lead of a note box.
  walk(tree, (node) => {
    if (!isEl(node, 'strong')) return undefined;
    const label = textOf(node).trim();
    if (!LABEL_RX.test(label)) return undefined;
    if ((node.properties.className || []).includes('note-lead')) return undefined;
    return [badgeNode(label.replace(/\.$/, '').toLowerCase())];
  });
}

// ------------------------------------------------------------ tables
const CELL_RATING_RX = /^(OK|Brief only|Brief Only|Avoid|Unknown|Not Enough Data)\b\.?\s*/;
const RATING_WORD = { ok: 'ok', 'brief only': 'brief_only', avoid: 'avoid', unknown: 'unknown', 'not enough data': 'unknown' };

export function processTables(tree) {
  walk(tree, (node) => {
    if (!isEl(node, 'table')) return undefined;
    walk(node, (cell) => {
      if (!isEl(cell, 'td')) return undefined;
      const t = textOf(cell).trim();
      const facets = facetsFromLabel(t);
      if (facets) { cell.children = [raw(facetRating(facets, { compact: true }))]; return 'skip'; }
      const first = cell.children.find((c) => !isBlank(c));
      if (first && first.type === 'text') {
        const m = CELL_RATING_RX.exec(first.value.trimStart());
        if (m) {
          const word = m[1];
          const r = RATING_WORD[word.toLowerCase()];
          first.value = first.value.trimStart().slice(m[0].length);
          const pill = el('span', { className: ['pill', 'is-small', RATINGS[r].cls] }, [txt(titleCase(word.toLowerCase() === 'ok' ? 'OK' : word))]);
          cell.children.splice(cell.children.indexOf(first), 0, pill, txt(first.value && !/^[,.;]/.test(first.value) ? ' ' : ''));
          addClass(cell, 'has-pill');
        }
      }
      return 'skip';
    });
    const wrap = el('div', { className: ['table-wrap'], role: 'region', tabIndex: 0, ariaLabel: 'Table, scrolls sideways on small screens' }, [node]);
    return [wrap];
  });
}

// ------------------------------------------------------------ lists
const LADDER_RX = /^(natural, untreated|natural, treated|lab-grown|imitation|imitations|trade names?)$/;
export const CARE_KEYS = {
  water: ['drop', 'Water'], washing: ['drop', 'Washing'], 'rinse': ['drop', 'Rinse'],
  'long soak': ['bowl', 'Long Soak'], soak: ['bowl', 'Long Soak'], soaking: ['bowl', 'Soaking'],
  sun: ['sun', 'Sun'], sunlight: ['sun', 'Sunlight'], 'sun and uv': ['sun', 'Sun & UV'], light: ['sun', 'Light'],
  heat: ['flame', 'Heat'], chemicals: ['flask', 'Chemicals'], salt: ['salt', 'Salt'],
  cleaning: ['sparkle', 'Cleaning'], 'cleaning machines': ['sparkle', 'Cleaning Machines'],
  storage: ['box', 'Storage'], 'knocks and scratches': ['box', 'Knocks & Scratches'], scratches: ['box', 'Scratches'],
  toxicity: ['warn', 'Toxicity'], fragility: ['hand', 'Fragility'], wear: ['hand', 'Wear'], 'everyday wear': ['hand', 'Everyday Wear'],
};

function itemsOf(list) {
  return meaningful(list.children).filter((c) => isEl(c, 'li'));
}

/** The content container of a list item, its single paragraph or the item itself. */
function itemBody(li) {
  const kids = meaningful(li.children);
  return isEl(kids[0], 'p') ? kids[0] : li;
}

function hasBadgeAfterLead(li) {
  const body = itemBody(li);
  const kids = meaningful(body.children);
  return isEl(kids[0], 'strong') && isEl(kids[1], 'span') && (kids[1].properties.className || []).includes('badge');
}

function restAfterLead(li) {
  const kids = meaningful(li.children);
  const body = itemBody(li);
  dropLeadStrong(body);
  return body === li ? [el('p', {}, li.children)] : [...body.children.length ? [el('p', {}, body.children)] : [], ...kids.slice(1)];
}

function stripRatingWord(nodes) {
  const p = nodes.find((n) => isEl(n, 'p')) || null;
  const container = p || { children: nodes };
  const first = container.children.find((c) => !isBlank(c));
  if (first && first.type === 'text') {
    first.value = first.value.trimStart()
      .replace(/^(OK|Brief only|Avoid|Unknown)\s*\(see below\)\.?\s*/i, 'See below. ')
      .replace(/^(OK|Brief only|Avoid|Unknown)[.,]\s*/i, '');
  }
  return nodes;
}

export function processLists(tree) {
  walk(tree, (node) => {
    if (!isEl(node, ['ul', 'ol'])) return undefined;
    const items = itemsOf(node);
    if (items.length < 2) return undefined;
    const leads = items.map((li) => leadStrong(li));
    const allLead = leads.every(Boolean);

    if (node.tagName === 'ul' && allLead && leads.filter((l) => LADDER_RX.test(l.key)).length >= 3) {
      return [el('div', { className: ['ladder'] }, items.map((li, k) => {
        const title = titleCase(leads[k].label.replace(/\.$/, ''));
        return el('div', { className: ['ladder-card'] }, [el('p', { className: ['ladder-title'] }, [txt(title)]), el('div', { className: ['ladder-text'] }, restAfterLead(li))]);
      }))];
    }

    if (node.tagName === 'ul' && allLead && leads.filter((l) => CARE_KEYS[l.key]).length >= 3) {
      return [el('div', { className: ['care-grid'] }, items.map((li, k) => {
        const lead = leads[k];
        const [ic, label] = CARE_KEYS[lead.key] || ['gem', titleCase(lead.label.replace(/\.$/, ''))];
        const rest = restAfterLead(li);
        const rating = ratingFromText(textOf({ type: 'root', children: rest }));
        stripRatingWord(rest);
        const head = el('p', { className: ['care-head'] }, [raw(icon(ic)), el('span', {}, [txt(label)])]);
        const pill = rating ? [el('p', { className: ['care-pill'] }, [raw(`<span class="pill ${RATINGS[rating].cls}">${esc(RATINGS[rating].label)}</span>`)])] : [];
        return el('div', { className: ['care-card'] }, [head, ...pill, el('div', { className: ['care-text'] }, rest)]);
      }))];
    }

    if (node.tagName === 'ul' && leads.filter(Boolean).length >= Math.max(2, Math.ceil(items.length * 0.6)) && items.some(hasBadgeAfterLead)) {
      return [el('ol', { className: ['timeline'] }, items.map((li, k) => {
        const lead = leads[k];
        if (!lead) return el('li', { className: ['tl-item'] }, [el('span', { className: ['tl-dot'], ariaHidden: 'true' }), el('div', { className: ['tl-body'] }, li.children)]);
        const body = itemBody(li);
        dropLeadStrong(body);
        let tag = null;
        const kids = meaningful(body.children);
        if (isEl(kids[0], 'span') && (kids[0].properties.className || []).includes('badge')) {
          tag = kids[0];
          body.children.splice(body.children.indexOf(tag), 1);
          const nx = body.children.find((c) => !isBlank(c));
          if (nx && nx.type === 'text') nx.value = nx.value.replace(/^\s+/, '');
        }
        const era = el('p', { className: ['tl-era'] }, [txt(lead.label.replace(/\.$/, '')), ...(tag ? [txt(' '), tag] : [])]);
        const today = /^today$/i.test(lead.label.replace(/\.$/, ''));
        const rest = body === li ? [el('p', {}, li.children)] : [el('p', {}, body.children), ...meaningful(li.children).slice(1)];
        return el('li', { className: ['tl-item', today ? 'is-today' : ''].filter(Boolean) }, [el('span', { className: ['tl-dot'], ariaHidden: 'true' }), el('div', { className: ['tl-body'] }, [era, ...rest])]);
      }))];
    }

    if (node.tagName === 'ol' && allLead) {
      addClass(node, 'step-cards');
      items.forEach((li, k) => {
        addClass(li, 'step-card');
        const body = itemBody(li);
        const strong = dropLeadStrong(body);
        const lead = el('p', { className: ['step-lead'] }, [txt(leads[k].label.replace(/\.$/, ''))]);
        const rest = body === li ? [el('p', {}, li.children.filter((c) => c !== strong))] : [el('p', {}, body.children), ...meaningful(li.children).slice(1)];
        li.children = [lead, ...rest];
      });
      return 'skip';
    }
    return undefined;
  });
}

// ------------------------------------------------------------ headings
export function processHeadings(tree, slug = makeSlugger()) {
  walk(tree, (node) => {
    if (!isEl(node, ['h2', 'h3', 'h4'])) return undefined;
    if (!node.properties.id) node.properties.id = slug(textOf(node));
    return 'skip';
  });
  return slug;
}

export { FACET_LABELS };
