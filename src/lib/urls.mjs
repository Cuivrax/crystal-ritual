// URL helpers shared by the build, the Markdown pipeline and the tests.

export const SITE = 'https://crystalandritual.com';
const SITE_HOSTS = new Set(['crystalandritual.com', 'www.crystalandritual.com']);

/** "stones__amethyst" is "/stones/amethyst/", "home" is "/". */
export function idToUrl(id) {
  const clean = String(id).replace(/\.md$/, '');
  if (clean === 'home' || clean === 'index') return '/';
  return `/${clean.split('__').join('/')}/`;
}

/** "/stones/amethyst/" is "stones__amethyst". */
export function urlToId(url) {
  const p = normalizePath(url);
  if (p === '/') return 'home';
  return p.replace(/^\/|\/$/g, '').split('/').join('__');
}

/**
 * Path part of an internal href, with a trailing slash for page paths.
 * Returns null for external links, mailto, tel and pure hash links.
 */
export function internalPath(href) {
  if (!href || typeof href !== 'string') return null;
  const h = href.trim();
  if (h.startsWith('#')) return null;
  if (/^(mailto|tel|javascript|data):/i.test(h)) return null;
  let path;
  if (/^https?:\/\//i.test(h) || h.startsWith('//')) {
    let u;
    try { u = new URL(h.startsWith('//') ? `https:${h}` : h); } catch { return null; }
    if (!SITE_HOSTS.has(u.hostname.toLowerCase())) return null;
    path = u.pathname || '/';
  } else if (h.startsWith('/')) {
    path = h.split('#')[0].split('?')[0];
  } else {
    return null; // relative links are not used in the content
  }
  return normalizePath(path);
}

/** Adds the trailing slash the site uses, keeps file paths such as /rss.xml as they are. */
export function normalizePath(path) {
  let p = String(path || '/').split('#')[0].split('?')[0];
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\/{2,}/g, '/');
  const last = p.split('/').pop();
  if (last && last.includes('.')) return p; // a file
  return p.endsWith('/') ? p : `${p}/`;
}

/** Host of an external URL without "www.", or null. */
export function hostOf(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return null;
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch { return null; }
}

export function absoluteUrl(path) {
  return `${SITE}${normalizePath(path)}`;
}

/** Last path segment, "/stones/rose-quartz/" is "rose-quartz". */
export function lastSegment(url) {
  const parts = normalizePath(url).split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

/** First path segment, "/stones/rose-quartz/" is "stones". */
export function section(url) {
  const parts = normalizePath(url).split('/').filter(Boolean);
  return parts.length ? parts[0] : '';
}
