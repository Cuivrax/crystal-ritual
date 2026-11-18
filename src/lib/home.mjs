// Maps the H2 sections of home.md onto the bands of R3-Home.
// The words come from home.md, the layout from the mockup.
import { isEl, meaningful, textOf, html, walk } from './md/hast.mjs';
import { targetOf, unwrapHidden } from './md/transforms.mjs';
import { facetsFromLabel, INTENTIONS } from './ui.mjs';

const clean = (nodes) => { const r = { type: 'root', children: structuredClone(nodes) }; unwrapHidden(r); return html(r.children); };
const isPlainShortP = (n) => isEl(n, 'p') && textOf(n).trim().length > 0 && textOf(n).trim().length < 70 && !hasLink(n) && !/\.\s*$/.test(textOf(n).trim());

function hasLink(n) {
  let found = false;
  walk({ type: 'root', children: [n] }, (x) => { if (isEl(x, 'a') || (isEl(x, 'span') && x.properties?.dataHiddenHref)) found = true; return undefined; });
  return found;
}

/** Links of a node as [{ text, href, built }], built links and hidden ones. */
export function linksIn(nodes) {
  const out = [];
  walk({ type: 'root', children: nodes }, (x) => {
    if (isEl(x, 'a') || (isEl(x, 'span') && x.properties?.dataHiddenHref)) {
      const href = isEl(x, 'a') ? x.properties.href : x.properties.dataHiddenHref;
      out.push({ text: textOf(x).trim(), href, built: isEl(x, 'a'), path: targetOf(x) });
      return 'skip';
    }
    return undefined;
  });
  return out;
}

const INTENT_FROM_PATH = (path) => {
  const m = /^\/crystals-for\/([^/]+)\/$/.exec(path || '');
  return m ? m[1] : null;
};

export function homeModel(doc) {
  const sections = doc.sections.map((s) => ({ ...s, nodes: meaningful(s.nodes), eyebrow: null }));
  const intro = meaningful(doc.introNodes);
  // An eyebrow is a short plain paragraph right before an H2.
  const carry = (list, target) => {
    if (list.length && isPlainShortP(list[list.length - 1])) target.eyebrow = textOf(list.pop()).trim();
  };
  if (sections[0]) carry(intro, sections[0]);
  for (let i = 1; i < sections.length; i++) carry(sections[i - 1].nodes, sections[i]);

  const heroCtas = linksIn(intro.filter((n) => isEl(n, 'p') && hasLink(n) && textOf(n).length < 120));
  const heroRest = intro.filter((n) => !(isEl(n, 'p') && hasLink(n) && textOf(n).length < 120));

  const pick = (test) => sections.find((s) => !s.used && test(s) && (s.used = true));
  const find = pick((s) => s.nodes.some((n) => isEl(n, 'ul') && linksIn([n]).some((l) => INTENT_FROM_PATH(l.path))));
  const moon = pick((s) => /moon/i.test(s.title));
  const rituals = pick((s) => s.nodes.filter((n) => isEl(n, 'h3') && /^five minutes/i.test(textOf(n))).length >= 2);
  const notes = pick((s) => /field notes/i.test(s.title));
  const atlas = pick((s) => /atlas/i.test(s.title));
  const letter = pick((s) => s.nodes.some((n) => /unsubscribe|no spam/i.test(textOf(n))));
  const closing = pick((s) => linksIn(s.nodes).some((l) => /^\/stones\//.test(l.path || '')));

  const model = { heroCtas, heroRest: clean(heroRest), sections: { find, moon, rituals, notes, atlas, letter, closing } };

  if (find) {
    const n = find.nodes;
    const firstUl = n.findIndex((x) => isEl(x, 'ul'));
    const h3 = n.findIndex((x) => isEl(x, 'h3'));
    const quote = n.findIndex((x) => isEl(x, 'blockquote'));
    model.find = {
      eyebrow: find.eyebrow,
      title: find.title,
      id: find.id,
      intro: clean(n.slice(0, firstUl).filter((x) => isEl(x, 'p'))),
      chips: linksIn([n[firstUl]]).map((l) => {
        const key = INTENT_FROM_PATH(l.path);
        return { ...l, key, tone: INTENTIONS[key]?.tone || 'gray', icon: INTENTIONS[key]?.icon || 'gem', sub: key ? `Crystals for ${INTENTIONS[key]?.label || key}` : '' };
      }),
      more: clean(n.slice(firstUl + 1, h3 > 0 ? h3 : undefined).filter((x) => isEl(x, 'p'))),
      featuredTitle: h3 > 0 ? textOf(n[h3]).trim() : null,
      featured: [],
      featuredLink: null,
      fine: null,
    };
    if (h3 > 0) {
      const after = n.slice(h3 + 1, quote > 0 ? quote : undefined);
      const ul = after.find((x) => isEl(x, 'ul'));
      if (ul) {
        model.find.featured = meaningful(ul.children).filter((li) => isEl(li, 'li')).map((li) => {
          const l = linksIn([li])[0] || null;
          const label = textOf(li).split(',').slice(1).join(',').trim();
          return { name: l ? l.text : textOf(li).split(',')[0].trim(), path: l?.path || null, built: !!l?.built, facets: facetsFromLabel(label), label };
        });
      }
      const linkP = after.find((x) => isEl(x, 'p') && hasLink(x) && textOf(x).trim() === linksIn([x])[0]?.text);
      if (linkP) model.find.featuredLink = linksIn([linkP])[0];
      const fine = after.find((x) => isEl(x, 'p') && x !== linkP && !hasLink(x));
      if (fine) model.find.fine = clean(fine.children);
    }
    if (quote > 0) {
      const ps = meaningful(n[quote].children).filter((x) => isEl(x, 'p'));
      model.quote = { text: ps[0] ? clean(ps[0].children) : '', tagline: ps[1] ? textOf(ps[1]).trim() : null };
    }
  }

  if (moon) {
    const n = moon.nodes;
    model.moon = {
      title: moon.title,
      id: moon.id,
      intro: clean(n.filter((x) => isEl(x, 'p') && !hasLink(x))),
      ctas: linksIn(n.filter((x) => isEl(x, 'p') && hasLink(x))),
    };
  }

  if (rituals) {
    const n = rituals.nodes;
    const cards = [];
    let cur = null;
    for (const x of n) {
      if (isEl(x, 'h3')) { cur = { title: textOf(x).trim(), nodes: [] }; cards.push(cur); } else if (cur) cur.nodes.push(x);
    }
    const intro = n.slice(0, n.findIndex((x) => isEl(x, 'h3'))).filter((x) => isEl(x, 'p'));
    model.rituals = {
      title: rituals.title,
      id: rituals.id,
      intro: clean(intro),
      cards: cards.map((c) => {
        const m = /^(Five Minutes (?:After|Before|During|at|on|in|for))\s+(.+)$/i.exec(c.title);
        const p = c.nodes.find((x) => isEl(x, 'p'));
        const link = p ? linksIn([p]).slice(-1)[0] || null : null;
        let text = p ? textOf(p).trim() : '';
        let category = null;
        const cm = /^(Daytime|Evening|Self-Care|Moon)\.\s*/i.exec(text);
        if (cm) { category = cm[1]; text = text.slice(cm[0].length); }
        if (link && text.endsWith(link.text)) text = text.slice(0, -link.text.length).trim();
        const tone = { daytime: 'pink', evening: 'lavender', 'self-care': 'green', moon: 'night' }[String(category).toLowerCase()] || 'pink';
        const title = m ? m[2].charAt(0).toUpperCase() + m[2].slice(1) : c.title;
        return { eyebrow: m ? m[1] : null, title, text, category, tone, link };
      }),
    };
    model.rituals.categories = [...new Set(model.rituals.cards.map((c) => c.category).filter(Boolean))];
  }

  if (notes) model.notes = { title: notes.title, id: 'field-notes', intro: clean(notes.nodes.filter((x) => isEl(x, 'p') && !hasLink(x) && textOf(x).length > 40)) };

  if (atlas) {
    const n = atlas.nodes;
    const h3s = n.map((x, i) => (isEl(x, 'h3') ? i : -1)).filter((i) => i >= 0);
    const firstH3 = h3s[0] ?? n.length;
    model.atlas = {
      title: atlas.title,
      id: atlas.id,
      intro: clean(n.slice(0, firstH3).filter((x) => isEl(x, 'p'))),
      cards: h3s.map((i, k) => {
        const end = h3s[k + 1] ?? n.length;
        const body = n.slice(i + 1, end).find((x) => isEl(x, 'p'));
        const links = body ? linksIn([body]) : [];
        const own = links.find((l) => /^\/stones\//.test(l.path || '')) || null;
        const sentences = body ? textOf(body).split(/(?<=\.)\s+/).map((s) => s.trim()).filter(Boolean) : [];
        const description = sentences[0] || '';
        const chips = sentences.slice(1).filter((s) => !own || s !== own.text).map((s) => s.replace(/\.$/, '')).filter((s) => s && s !== own?.text);
        const slug = own ? own.path.split('/').filter(Boolean).pop() : null;
        return { name: textOf(n[i]).trim(), description, chips, link: own, slug };
      }),
      cta: linksIn(n.slice(h3s[h3s.length - 1] + 1 || n.length).filter((x) => isEl(x, 'p') && !isEl(x, 'h3'))).find((l) => l.path === '/stones/') || null,
    };
  }

  if (letter) {
    const ps = letter.nodes.filter((x) => isEl(x, 'p'));
    const fine = ps.find((x) => /unsubscribe|no spam/i.test(textOf(x)));
    model.letter = { title: letter.title, id: letter.id, text: clean(ps.filter((x) => x !== fine)), fine: fine ? textOf(fine).trim() : null };
  }

  if (closing) {
    const ps = closing.nodes.filter((x) => isEl(x, 'p'));
    const linkP = ps.find((x) => hasLink(x) && textOf(x).trim() === linksIn([x])[0]?.text);
    const link = linkP ? linksIn([linkP])[0] : null;
    const text = ps.filter((x) => x !== linkP).slice(0, 1);
    model.closing = { eyebrow: closing.eyebrow, title: closing.title, id: closing.id, text: clean(text), link, slug: link?.path?.split('/').filter(Boolean).pop() || null };
  }
  return model;
}
