// sitemap.xml, built pages only, lastmod from publishDate. One <url> per line so deploy/pull.sh
// can diff two versions with plain shell tools.
import { getSite } from '../lib/site.mjs';
import { absoluteUrl } from '../lib/urls.mjs';

export async function GET() {
  const site = await getSite();
  const rows = site.pages
    .map((p) => `<url><loc>${absoluteUrl(p.url)}</loc><lastmod>${p.data.publishDate}</lastmod></url>`)
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
