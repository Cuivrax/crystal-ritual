// Page type transforms for H2 sections, built from the R3 mockups.
import { el, txt, raw, isEl, isBlank, meaningful, walk, textOf, addClass, hasClass, slugify, dropLeadStrong } from './hast.mjs';
import { targetOf } from './transforms.mjs';
import {
  icon, esc, facetSvg, facetRating, FACET_LABELS, facetsFromLabel, mohsScale, mohsCompare, parseMohs,
  HOW_WE_RATE_TEXT, facetLegend, INTENTIONS, titleCase, EVIDENCE, h3IconName,
} from '../ui.mjs';
import { colorSwatches } from '../colors.mjs';
import { allPageProofsHold } from '../proof.mjs';
import { worldMapCard } from '../worldmap.mjs';

// ------------------------------------------------------------ classification
export function classifySection(title, page) {
  const t = String(title).toLowerCase();
  if (/quick facts/.test(t)) return 'facts';
  if (/at a glance/.test(t)) return 'glance';
  if (/one by one/.test(t)) return 'onebyone';
  if (/look-alikes|lookalikes/.test(t)) return 'lookalikes';
  if (/moon water/.test(t)) return 'moonwater';
  if (/meaning comes from|where .* come(s)? from|why these stones|stories behind|where the .* links? come|history of|a long history/.test(t)) return 'story';
  if (/actually is|^what is (a |the )?|really is/.test(t)) return 'what';
  if (/for today|mean today|today$/.test(t)) return 'today';
  if (/^how to use|routine|ritual|wind-down|reset|check-in|five minutes|four looks|^how to make/.test(t)) return 'ritual';
  if (/is my .* real|real or fake|^how to tell|fakes|is it real/.test(t)) return 'real';
  if (/^how to care|care for |caring for|^care &/.test(t)) return 'care';
  if (/price guide|what it should cost|pay for/.test(t)) return 'price';
  if (/when a stone is not enough/.test(t)) return 'notenough';
  return 'prose';
}

const NAV_LABELS = {
  what: 'What It Is', story: 'The Story', today: 'Today', ritual: 'The Ritual', real: 'Is It Real',
  care: 'Care', lookalikes: 'Look-Alikes', price: 'Price',
};

// ------------------------------------------------------------ helpers
const firstP = (nodes) => meaningful(nodes).find((n) => isEl(n, 'p'));

function sectionBadge(section) {
  const p = meaningful(section.nodes)[0];
  if (!isEl(p, 'p')) return;
  const layer = p.properties?.dataLayer;
  if (layer === 'stone') section.badge = 'mineral fact';
  else if (layer === 'story') section.badge = 'tradition';
  else if (layer === 'ritual') section.badge = 'try this';
  else {
    const k = meaningful(p.children)[0];
    if (isEl(k, 'span') && hasClass(k, 'badge')) {
      const key = textOf(k).toLowerCase();
      if (EVIDENCE[key] && ['modern association', 'mineral fact', 'tradition'].includes(key)) {
        section.badge = key;
        p.children.splice(p.children.indexOf(k), 1);
        const nx = p.children.find((c) => !isBlank(c));
        if (nx && nx.type === 'text') nx.value = nx.value.replace(/^\s+/, '');
      }
    }
  }
}

/** Groups an H3 and what follows it, until the next H3. */
function h3Groups(nodes) {
  const before = [];
  const groups = [];
  let cur = null;
  for (const n of nodes) {
    if (isEl(n, 'h3')) { cur = { h3: n, nodes: [] }; groups.push(cur); } else if (cur) cur.nodes.push(n); else before.push(n);
  }
  return { before, groups };
}

/** On a phone, H3 subsections fold into <details>, open by default so nothing hides without script. */
function foldSubsections(section) {
  const { before, groups } = h3Groups(section.nodes);
  if (groups.length < 2) return;
  section.nodes = [...before, ...groups.map((g) => el('details', { className: ['fold'], open: true }, [
    el('summary', {}, [g.h3, raw(icon('chevron', { size: 20, cls: 'fold-icon' }))]),
    el('div', { className: ['fold-body'] }, g.nodes),
  ]))];
}

function stoneSlugFromNodes(nodes) {
  let slug = null;
  walk({ type: 'root', children: nodes }, (n) => {
    if (slug) return 'skip';
    const t = targetOf(n);
    const m = t && /^\/stones\/([^/]+)\/$/.exec(t);
    if (m) slug = m[1];
    return undefined;
  });
  return slug;
}

/** Removes a closing "More on [stone]." sentence and returns its target. */
function takeMoreOn(p) {
  const kids = p.children;
  for (let i = kids.length - 1; i >= 1; i--) {
    const link = kids[i - 0];
    if ((isEl(link, 'a') || (isEl(link, 'span') && link.properties?.dataHiddenHref))) {
      const before = kids[i - 1];
      const after = kids[i + 1];
      if (before && before.type === 'text' && /More on\s*$/.test(before.value) && (!after || (after.type === 'text' && /^\.\s*$/.test(after.value)))) {
        const target = targetOf(link);
        before.value = before.value.replace(/\s*More on\s*$/, '');
        kids.splice(i, after ? 2 : 1);
        return { target, built: isEl(link, 'a') };
      }
    }
  }
  return null;
}

// ------------------------------------------------------------ Quick Facts card (stone)
const TILE_RULES = [
  [/mohs|hardness/, 'gem', 'Mohs Hardness'],
  [/crystal system/, 'cube', 'Crystal System'],
  [/density|specific gravity/, 'weight', 'Density'],
  [/^formula/, 'flask', 'Formula'],
  [/birthstone/, 'calendar', 'Birthstone'],
  [/chakra/, 'heart', 'Chakra'],
];

function tableRows(table) {
  const rows = [];
  walk(table, (n) => {
    if (!isEl(n, 'tr')) return undefined;
    const cells = meaningful(n.children).filter((c) => isEl(c, ['td', 'th']));
    if (cells.length >= 2 && isEl(cells[0], 'td')) rows.push({ label: textOf(cells[0]).trim(), cell: cells[1], cells });
    return 'skip';
  });
  return rows;
}

function factsCard(section, ctx) {
  const nodes = section.nodes;
  const wrapIdx = nodes.findIndex((n) => isEl(n, 'div') && hasClass(n, 'table-wrap'));
  if (wrapIdx < 0) return;
  const table = nodes[wrapIdx].children[0];
  const rows = tableRows(table);
  if (!rows.length) return;
  const tiles = [];
  const dl = [];
  let mohsRow = null;
  let colorsRow = null;
  for (const r of rows) {
    const low = r.label.toLowerCase();
    const text = textOf(r.cell).trim();
    if (/mohs|hardness/.test(low)) mohsRow = text;
    if (/^colou?rs?$/.test(low)) colorsRow = text;
    if (/^what it is/.test(low) && !/\[TO CHECK/i.test(text)) {
      const first = text.split(/\.\s|,\s/)[0].replace(/\.$/, '').trim();
      if (first.length >= 8 && first.length <= 56) section.whatItIs = first;
    }
    const rule = TILE_RULES.find(([rx]) => rx.test(low));
    const hasMark = /\[TO CHECK/i.test(text);
    if (rule && tiles.length < 5 && text.length <= 70 && !(rule[2] === 'Formula' && text.length > 18)) {
      const cut = text.search(/,\s|\.\s/);
      const big = cut > 0 ? text.slice(0, cut) : text.replace(/\.$/, '');
      let sub = cut > 0 ? text.slice(cut + 1).trim().replace(/^\s*/, '') : '';
      sub = sub ? sub.charAt(0).toUpperCase() + sub.slice(1) : '';
      const modern = /modern association/i.test(r.label);
      const subParts = [sub, modern ? 'Modern Association' : ''].filter(Boolean);
      tiles.push({ order: TILE_RULES.indexOf(rule), node: el('div', { className: ['fact-tile'] }, [
        raw(icon(rule[1], { size: 28 })),
        el('p', { className: ['fact-label'] }, [txt(rule[2])]),
        el('p', { className: ['fact-value'] }, hasMark ? r.cell.children : [txt(big)]),
        ...(subParts.length && !hasMark ? [el('p', { className: ['fact-sub'] }, [txt(subParts.join('. '))])] : []),
      ]) });
      continue;
    }
    dl.push(el('div', { className: ['fact-row'] }, [el('dt', {}, [txt(r.label.replace(/\s*\(Modern Association\)/i, ''))]), el('dd', {}, r.cell.children)]));
  }
  const realIdx = nodes.findIndex((n) => isEl(n, 'aside') && hasClass(n, 'callout-real'));
  const real = realIdx >= 0 ? nodes[realIdx] : null;
  const rest = nodes.filter((n, i) => i !== wrapIdx && i !== realIdx);

  tiles.sort((a, b) => a.order - b.order);
  const parts = [];
  if (tiles.length) parts.push(el('div', { className: ['fact-tiles'] }, tiles.map((t) => t.node)));
  parts.push(el('div', { className: ['facts-row'] }, [
    el('details', { className: ['fold', 'facts-fold'], open: true }, [
      el('summary', {}, [txt('All Quick Facts'), raw(icon('chevron', { size: 18 }))]),
      el('div', { className: ['facts-list'] }, [el('dl', {}, dl)]),
    ]),
    ...(real ? [real] : []),
  ]));

  // Mohs scale and color swatches
  const sheet = ctx.page.stoneSheet;
  const mohs = (sheet && sheet.mohs) || parseMohs(mohsRow);
  const cards = [];
  if (mohs) {
    const name = ctx.page.stoneName || 'This stone';
    cards.push(el('div', { className: ['card', 'mohs-card'] }, [
      el('div', { className: ['card-head'] }, [
        el('p', { className: ['card-title'] }, [txt('Where It Sits on the Mohs Scale')]),
        el('p', { className: ['card-note'] }, [txt(mohsCompare(mohs.min, mohs.max))]),
      ]),
      raw(mohsScale([{ name, min: mohs.min, max: mohs.max, tone: 0 }])),
    ]));
  }
  // The Colors row of the table, or the verified colors note of the stone sheet when the table has none.
  const swatches = colorSwatches(colorsRow || ctx.extras?.colors || '');
  if (swatches.length >= 1) {
    cards.push(el('div', { className: ['card', 'colors-card'] }, [
      el('p', { className: ['card-title'] }, [txt('Colors')]),
      raw(`<ul class="swatches">${swatches.map((s) => `<li><span class="swatch${s.light ? ' is-light' : ''}" style="background:${s.hex}"></span><span>${esc(titleCase(s.name))}</span></li>`).join('')}</ul>`),
      el('p', { className: ['card-note'] }, [txt('Swatches are approximate screen colors.')]),
    ]));
  }
  if (cards.length) parts.push(el('div', { className: ['facts-cards'] }, cards));
  section.nodes = [...parts, ...rest];
  section.layout = 'facts';
}

// ------------------------------------------------------------ "What X Actually Is" (stone, R3-Stone)
/** Writes a chemical formula with subscripts and charges, SiO2 becomes SiO<sub>2</sub>. */
export function formulaHtml(f) {
  const src = String(f || '');
  let out = '';
  let afterCharge = false;
  for (let i = 0; i < src.length;) {
    const m = /^\d+(?:\.\d+)?/.exec(src.slice(i));
    if (m) {
      const num = m[0];
      const next = src[i + num.length];
      const prev = src[i - 1] || '';
      if ((next === '+' || next === '-') && /[A-Za-z]/.test(prev)) { out += `<sup>${num}${next}</sup>`; i += num.length + 1; afterCharge = true; continue; }
      out += afterCharge || /[A-Za-z)\]\u2610]/.test(prev) ? `<sub>${num}</sub>` : num;
      afterCharge = false;
      i += num.length;
      continue;
    }
    afterCharge = false;
    out += esc(src[i]);
    i++;
  }
  return out;
}

const ARROW = '<svg class="chain-arrow" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

/** The classification chain, Group then Species then Variety, as cards with arrows. */
export function chainHtml(chain, { stoneName = 'this stone', imaList = null } = {}) {
  const nodes = chain?.nodes || [];
  const cards = nodes.filter((n) => !n.join);
  if (cards.length < 2) return '';
  let html = '';
  nodes.forEach((n, i) => {
    if (n.join) { html += `<span class="chain-or" aria-hidden="true">${esc(n.join)}</span>`; return; }
    if (i > 0 && !nodes[i - 1].join) html += ARROW;
    const tone = n.dark ? 'is-dark' : n.ima ? 'is-species' : 'is-soft';
    const sub = n.sub ? `<p class="chain-sub">${esc(n.sub)}</p>`
      : n.formula && n.formula.length <= 22 ? `<p class="chain-sub chain-formula">${formulaHtml(n.formula)}</p>` : '';
    const chips = [n.ima ? 'IMA Mineral' : null, n.chip || null].filter(Boolean).map((c) => `<span class="chain-chip">${esc(c)}</span>`).join('');
    const tag = n.tag ? `<span class="chain-chip chain-tag">${esc(n.tag)}</span>` : '';
    html += `<div class="chain-node ${tone}"><p class="chain-level">${esc(n.level)}</p><p class="chain-name">${esc(n.name)}</p>${sub}${chips}${tag}</div>`;
  });
  const note = chain.imaNote && imaList ? `<p class="chain-note">Mineral status from the ${esc(imaList)}</p>` : '';
  return `<div class="chain" role="group" aria-label="${esc(`Where ${stoneName.toLowerCase()} sits in the mineral world`)}">${html}</div>${note}`;
}

export function keyNumbersHtml(keys) {
  return keys.map((k) => `<div class="key-number"><p class="key-value">${esc(k.value)}</p><p class="key-text">${esc(k.text)}</p></div>`).join('');
}

/** Small icons beside the H3 titles of a section (R3-Stone). */
function h3Icons(nodes) {
  for (const n of nodes) {
    if (!isEl(n, 'h3') || hasClass(n, 'has-icon')) continue;
    addClass(n, 'has-icon');
    n.children = [raw(icon(h3IconName(textOf(n)), { size: 26, cls: 'h3-icon' })), el('span', {}, n.children)];
  }
}

/**
 * Key numbers beside the opening paragraphs, the classification chain under them, then the
 * H3 subsections with the photo card and the map beside them. Each block is left out when
 * its data is missing or no longer matches the page text.
 */
function whatBlocks(section, ctx) {
  const extras = ctx.extras || {};
  const text = ctx.page.body || '';
  const nodes = [...section.nodes];
  let photoCard = '';
  const at = nodes.findIndex((n) => n.type === 'raw' && n.photoRole && ctx.photoCardHtml?.has(n.photoRole));
  if (at >= 0) { photoCard = ctx.photoCardHtml.get(nodes[at].photoRole); nodes.splice(at, 1); }
  const keys = (extras.keyNumbers || []).filter((k) => allPageProofsHold(text, k.pageProof));
  const chain = extras.chain && allPageProofsHold(text, extras.chain.pageProof) ? extras.chain : null;
  const mapCard = worldMapCard(extras.map?.pins);

  const { before, groups } = h3Groups(nodes);
  const body = { nodes: groups.flatMap((g) => [g.h3, ...g.nodes]) };
  foldSubsections(body);

  let topAside = keyNumbersHtml(keys);
  let bodyAside = `${photoCard}${mapCard}`;
  if (!groups.length) { topAside += bodyAside; bodyAside = ''; }
  const chainBlock = chainHtml(chain, { stoneName: ctx.page.stoneName || ctx.page.data?.h1 || 'this stone', imaList: ctx.imaList });

  section.layout = 'what';
  section.nodes = before;
  section.bodyNodes = body.nodes.length ? body.nodes : null;
  section.asideNodes = topAside ? [raw(topAside)] : null;
  section.chainNodes = chainBlock ? [raw(chainBlock)] : null;
  section.bodyAsideNodes = bodyAside ? [raw(bodyAside)] : null;
}

// ------------------------------------------------------------ ritual cards
function ritualTone(title) {
  const t = title.toLowerCase();
  if (/gift|for someone|friend|wrap|card for/.test(t)) return ['green', 'For Someone Else'];
  if (/night|evening|bed|sleep|lights|nightstand|moon|dream|party|parties|bath|wind-down/.test(t)) return ['lavender', 'Evening'];
  if (/desk|work|morning|office|exam|study|pocket|walk|commute|talk|conversation|meeting|interview|travel|day\b|daytime/.test(t)) return ['pink', 'Daytime'];
  return ['pink', null];
}

function ritualCards(section) {
  const { before, groups } = h3Groups(section.nodes);
  if (groups.length < 2) return;
  const cards = [];
  const after = [];
  for (const g of groups) {
    const title = textOf(g.h3);
    const [tone, eyebrow] = ritualTone(title);
    const inCard = [];
    const trailing = [];
    let leaving = false;
    for (const n of g.nodes) {
      // Notes and boxes that close the section sit under the cards.
      if (isEl(n, 'p') && (hasClass(n, 'note') && !hasClass(n, 'note-next'))) leaving = true;
      if (isEl(n, 'aside')) leaving = true;
      (leaving ? trailing : inCard).push(n);
    }
    cards.push(el('div', { className: ['ritual-card', `tone-${tone}`] }, [
      ...(eyebrow ? [el('p', { className: ['card-eyebrow'] }, [txt(eyebrow)])] : []),
      g.h3, ...inCard,
    ]));
    after.push(...trailing);
  }
  const notes = after.filter((n) => isEl(n, 'p') && hasClass(n, 'note'));
  const others = after.filter((n) => !notes.includes(n));
  section.nodes = [
    ...before,
    el('div', { className: ['ritual-cards'] }, cards),
    ...(notes.length ? [el('div', { className: ['note-row'] }, notes)] : []),
    ...others,
  ];
}

// ------------------------------------------------------------ look-alike cards (stone)
function relatedCards(section, ctx) {
  const listIdx = section.nodes.findIndex((n) => isEl(n, 'ul'));
  if (listIdx < 0) return;
  const list = section.nodes[listIdx];
  const items = meaningful(list.children).filter((c) => isEl(c, 'li'));
  const cards = items.map((li) => {
    const body = meaningful(li.children)[0];
    const container = isEl(body, 'p') ? body : li;
    const kids = meaningful(container.children);
    const strong = isEl(kids[0], 'strong') ? kids[0] : null;
    const name = strong ? textOf(strong).replace(/\.$/, '').trim() : textOf(li).split('.')[0];
    if (strong) dropLeadStrong(container);
    let target = stoneSlugFromNodes([li]) ? `/stones/${stoneSlugFromNodes([li])}/` : null;
    const guess = `/stones/${slugify(name)}/`;
    if (!target && ctx.isBuilt(guess)) target = guess;
    const built = target && ctx.isBuilt(target);
    const slug = target ? target.split('/').filter(Boolean).pop() : null;
    const thumb = slug && ctx.helpers?.stoneThumb ? ctx.helpers.stoneThumb(slug, 'card') : null;
    // Card titles are headings, so they follow the house Title Case rule even when the list item is in sentence case.
    const shown = titleCase(name);
    const title = el('h3', { className: ['related-name'] }, built ? [el('a', { href: target, className: ['stretched'] }, [txt(shown)])] : [txt(shown)]);
    return el('article', { className: ['related-card', built ? 'is-link' : ''].filter(Boolean) }, [
      ...(thumb ? [raw(thumb)] : []),
      el('div', { className: ['related-body'] }, [title, el('div', { className: ['related-text'] }, isEl(body, 'p') ? [body, ...meaningful(li.children).slice(1)] : li.children)]),
    ]);
  });
  section.nodes.splice(listIdx, 1, el('div', { className: ['related-grid'] }, cards));
  // A compare page with this stone, when one is published.
  const compare = (ctx.helpers?.comparesFor ? ctx.helpers.comparesFor(ctx.page.slug) : [])[0];
  if (compare) {
    section.nodes.push(raw(`<a class="compare-band" href="${esc(compare.url)}"><span><span class="eyebrow">Compare Two Stones</span><span class="compare-band-title">${esc(compare.title)}</span></span><span class="btn btn-light">See Them Side by Side</span></a>`));
  }
}

// ------------------------------------------------------------ Known For (stone, Today section)
function knownForAside(section, ctx) {
  const items = ctx.helpers?.knownFor ? ctx.helpers.knownFor(ctx.page.slug) : [];
  if (!items.length) return;
  const rows = items.map((it) => {
    const name = it.url && ctx.isBuilt(it.url) ? `<a href="${esc(it.url)}">${esc(it.label)}</a>` : esc(it.label);
    return `<li><span class="kf-name">${name}</span>${facetRating(it.facets)}</li>`;
  }).join('');
  const how = ctx.isBuilt('/sources/') ? '<a class="small-link" href="/sources/#how-we-rate">How We Rate</a>' : '<a class="small-link" href="#how-we-rate">How We Rate</a>';
  section.asideNodes = [raw(`<div class="card known-for"><div class="card-head"><p class="card-title">Known For</p>${how}</div><ul class="kf-list">${rows}</ul></div>`
    + `<div class="how-we-rate" id="how-we-rate"><p class="card-title">How We Rate</p><p>${esc(HOW_WE_RATE_TEXT)}</p>${facetLegend()}</div>`)];
  section.layout = 'split';
}

// ------------------------------------------------------------ price + next step (stone)
function priceNext(section) {
  const i = section.nodes.findIndex((n) => isEl(n, 'p') && hasClass(n, 'note-next'));
  if (i < 0) return;
  const [note] = section.nodes.splice(i, 1);
  section.extraNodes = [note];
  section.layout = 'price';
}

// ------------------------------------------------------------ ranked stone cards (crystals for)
function splitAtLabels(p) {
  const segs = [];
  let cur = [];
  for (const n of p.children) {
    const isBadge = isEl(n, 'span') && hasClass(n, 'badge');
    const isCare = isEl(n, 'strong') && /^care\.?$/i.test(textOf(n).trim());
    if ((isBadge || isCare) && cur.some((c) => !isBlank(c))) { segs.push(cur); cur = []; }
    cur.push(n);
  }
  if (cur.length) segs.push(cur);
  return segs.map((s) => {
    const first = s.find((c) => !isBlank(c));
    const care = isEl(first, 'strong') && /^care\.?$/i.test(textOf(first).trim());
    return { care, nodes: s };
  });
}

function rankedCards(section, ctx) {
  const { before, groups } = h3Groups(section.nodes);
  if (groups.length < 2) return;
  const key = ctx.page.slug;
  const ranking = ctx.data?.intents?.[key] || null;
  const bySlug = new Map((ranking || []).map((r) => [r.slug, r]));
  let lastFacets = null;
  const items = [];
  const trailing = [];
  groups.forEach((g, idx) => {
    const raw0 = textOf(g.h3).trim();
    const num = /^(\d+)\.\s*/.exec(raw0);
    const name = raw0.replace(/^\d+\.\s*/, '');
    g.h3.children = [txt(name)];
    const rank = num ? Number(num[1]) : idx + 1;
    // Content of the card, and what belongs after the list.
    const content = [];
    let figure = null;
    for (const n of g.nodes) {
      if (n.type === 'raw' && /<figure/.test(n.value)) { figure = n; continue; }
      if (isEl(n, 'aside') || (isEl(n, 'p') && hasClass(n, 'note'))) { trailing.push(n); continue; }
      content.push(n);
    }
    const slug = stoneSlugFromNodes(content) || slugify(name);
    const entry = bySlug.get(slug);
    const facets = entry ? entry.facets : null;
    let more = null;
    const mainSegs = [];
    const careSegs = [];
    for (const n of content) {
      if (isEl(n, 'p')) {
        more = takeMoreOn(n) || more;
        for (const s of splitAtLabels(n)) (s.care ? careSegs : mainSegs).push(el('p', {}, s.nodes));
      } else mainSegs.push(n);
    }
    const target = more?.target || (ctx.isBuilt(`/stones/${slug}/`) ? `/stones/${slug}/` : null);
    const linked = target && ctx.isBuilt(target);
    if (linked) g.h3.children = [el('a', { href: target }, [txt(name)])];
    if (facets && facets !== lastFacets) {
      items.push(el('li', { className: ['rank-group'] }, [raw(facetSvg(facets, { width: 96, label: false })), el('span', {}, [txt(FACET_LABELS[facets])])]));
      lastFacets = facets;
    }
    const thumb = figure ? null : (ctx.helpers?.stoneThumb ? ctx.helpers.stoneThumb(slug, 'rank') : null);
    const media = figure || thumb
      ? el('div', { className: ['rank-media'] }, [figure ? figure : raw(thumb), el('span', { className: ['rank-num'], ariaHidden: 'true' }, [txt(String(rank))])])
      : el('div', { className: ['rank-media', 'is-empty'] }, [el('span', { className: ['rank-num'], ariaHidden: 'true' }, [txt(String(rank))])]);
    const rating = facets ? [el('p', { className: ['rank-rating'] }, [raw(facetRating(facets)), raw(`<a class="small-link" href="${ctx.isBuilt('/sources/') ? '/sources/#how-we-rate' : '#how-we-rate'}">How We Rate</a>`)])] : [];
    const side = careSegs.map((p) => { addClass(p, 'care-note'); p.children.unshift(raw(icon('warn', { size: 20 }))); return p; });
    items.push(el('li', { className: ['rank-card'] }, [
      media,
      el('div', { className: ['rank-main'] }, [g.h3, ...rating, ...mainSegs]),
      ...(side.length ? [el('div', { className: ['rank-side'] }, side)] : []),
    ]));
  });
  section.nodes = [...before, el('ol', { className: ['rank-list'] }, items), ...trailing];
  section.layout = 'ranked';
}

// ------------------------------------------------------------ timeline fold (stone, phone)
function foldTimeline(section) {
  const i = section.nodes.findIndex((n) => isEl(n, 'ol') && hasClass(n, 'timeline'));
  if (i < 0) return;
  const tl = section.nodes[i];
  const eras = meaningful(tl.children).map((li) => textOf(meaningful(li.children)[1]?.children?.[0] || {}).trim());
  const first = eras[0] ? eras[0].replace(/\s*(Tradition|Modern Association|Mineral Fact)$/, '') : '';
  const last = eras[eras.length - 1] || '';
  const label = first && /^today/i.test(last) ? `The Timeline, ${titleCase(first.toLowerCase())} to Today` : 'The Timeline';
  section.nodes[i] = el('details', { className: ['fold', 'tl-fold'], open: true }, [el('summary', {}, [txt(label), raw(icon('chevron', { size: 18 }))]), tl]);
}

// ------------------------------------------------------------ dispatcher
export function transformSection(section, ctx) {
  const type = ctx.page.type;
  if (type === 'home') return; // the home layout maps its sections itself (lib/home.mjs)
  sectionBadge(section);
  if (type === 'stone') {
    section.navLabel = NAV_LABELS[section.kind] || null;
    if (section.kind === 'facts') factsCard(section, ctx);
    if (['what', 'today', 'real', 'care'].includes(section.kind)) h3Icons(section.nodes);
    if (section.kind === 'what') whatBlocks(section, ctx);
    if (['today', 'real'].includes(section.kind)) foldSubsections(section);
    if (section.kind === 'today') knownForAside(section, ctx);
    if (section.kind === 'ritual') ritualCards(section);
    if (section.kind === 'lookalikes') relatedCards(section, ctx);
    if (section.kind === 'price') priceNext(section);
    if (section.kind === 'story' || section.kind === 'care') section.band = 'band-soft';
    if (section.kind === 'ritual') section.band = 'band-white';
    if (section.kind === 'story') foldTimeline(section);
    return;
  }
  if (['situation', 'month', 'sign'].includes(type)) {
    if (section.kind === 'onebyone') rankedCards(section, ctx);
    if (section.kind === 'ritual') { ritualCards(section); section.band = 'band-soft'; }
    if (section.kind === 'story') section.band = 'band-soft';
    return;
  }
  if (ctx.page.night) {
    if (section.kind === 'moonwater') section.band = 'band-cream';
    if (section.kind === 'ritual') ritualCards(section);
    return;
  }
  if (section.kind === 'ritual') ritualCards(section);
  if (section.kind === 'story') section.band = 'band-soft';
}

export { firstP };
