// Head tags and JSON-LD.
import { SITE, absoluteUrl } from './urls.mjs';
import { NY } from './gate.mjs';
import { SITE_NAME, AUTHOR } from './nav.mjs';

/** ISO 8601 with the New York offset, "2026-12-06T07:00:00-05:00". */
export function isoNY(date) {
  if (!date) return null;
  const f = new Intl.DateTimeFormat('en-US', { timeZone: NY, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'longOffset' });
  const o = {};
  for (const p of f.formatToParts(date)) o[p.type] = p.value;
  const off = (o.timeZoneName || 'GMT-05:00').replace('GMT', '') || '+00:00';
  return `${o.year}-${o.month}-${o.day}T${o.hour}:${o.minute}:${o.second}${off}`;
}

export const ARTICLE_SCHEMA_TYPES = ['stone', 'compare', 'situation', 'guide', 'ritual', 'list', 'month', 'sign', 'lab', 'essay'];

export function jsonLd({ page, title, description, url, image, breadcrumbs = [], citations = [], authorUrl = null }) {
  const org = { '@type': 'Organization', '@id': `${SITE}/#organization`, name: SITE_NAME, url: `${SITE}/` };
  const graph = [org, { '@type': 'WebSite', '@id': `${SITE}/#website`, name: SITE_NAME, url: `${SITE}/`, inLanguage: 'en-US', publisher: { '@id': org['@id'] } }];
  const abs = absoluteUrl(url);
  const person = { '@type': 'Person', name: AUTHOR, ...(authorUrl ? { url: absoluteUrl(authorUrl) } : {}) };
  if (page && ARTICLE_SCHEMA_TYPES.includes(page.type)) {
    graph.push({
      '@type': 'Article',
      '@id': `${abs}#article`,
      headline: page.data.h1,
      name: title,
      description,
      inLanguage: 'en-US',
      mainEntityOfPage: abs,
      url: abs,
      author: person,
      publisher: { '@id': org['@id'] },
      datePublished: isoNY(page.publishAt),
      dateModified: isoNY(page.publishAt),
      ...(image ? { image: [image] } : {}),
      ...(citations.length ? { citation: citations } : {}),
    });
  } else {
    graph.push({
      '@type': 'WebPage',
      '@id': `${abs}#webpage`,
      name: title,
      description,
      url: abs,
      inLanguage: 'en-US',
      isPartOf: { '@id': `${SITE}/#website` },
      publisher: { '@id': org['@id'] },
      ...(page ? { author: person, datePublished: isoNY(page.publishAt) } : {}),
      ...(image ? { primaryImageOfPage: image } : {}),
    });
  }
  if (breadcrumbs.length) {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((b, i) => ({ '@type': 'ListItem', position: i + 1, name: b.name, ...(b.url ? { item: absoluteUrl(b.url) } : {}) })),
    });
  }
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}
