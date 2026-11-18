// Breadcrumbs, hero image and citations for a page, shared by the layouts.
import { SECTION_LABELS } from './site.mjs';
import { titleCase } from './ui.mjs';
import { shownSourceUrls } from './sources.mjs';
import { policy } from './render.mjs';
import { SITE } from './urls.mjs';

export function breadcrumbsFor(page, site) {
  const items = [];
  if (page.url === '/') return [{ name: 'Home', url: '/' }];
  items.push({ name: 'Home', url: site.isBuilt('/') ? '/' : null });
  const parts = page.url.split('/').filter(Boolean);
  if (parts.length > 1) {
    const hub = `/${parts[0]}/`;
    const hubPage = site.byUrl.get(hub);
    const name = SECTION_LABELS[parts[0]] || titleCase(parts[0].replace(/-/g, ' '));
    items.push({ name: hubPage && hubPage.type !== 'stone' ? name : name, url: site.isBuilt(hub) ? hub : null });
  }
  items.push({ name: shortName(page), url: page.url });
  return items;
}

/** A short page name for breadcrumbs, the stone name or the H1 before its first comma. */
export function shortName(page) {
  if (page.stoneName) return page.stoneName;
  if (page.type === 'situation') return titleCase(page.slug.replace(/-/g, ' '));
  if (['month', 'sign'].includes(page.type)) return titleCase(page.slug.replace(/-/g, ' '));
  let h = page.data.h1;
  if (page.type === 'tool') h = h.split(/ for | with /)[0];
  const cut = h.split(/, | & /)[0].trim();
  if (cut.length >= 12) h = cut;
  return h.length > 56 ? `${h.slice(0, 56).replace(/\s+\S*$/, '')}` : h;
}

/** Absolute URL of the hero image for Open Graph, from the rendered hero figure. */
export function ogImageFrom(heroHtml) {
  if (!heroHtml) return null;
  const m = /<img src="([^"]+)"/.exec(heroHtml);
  if (!m) return null;
  return m[1].startsWith('http') ? m[1] : `${SITE}${m[1]}`;
}

export function citationsFor(page) {
  return shownSourceUrls(page.data.sources || [], policy).slice(0, 30);
}
