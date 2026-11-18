// robots.txt. A PREVIEW build blocks every crawler.
import { getSite } from '../lib/site.mjs';
import { SITE } from '../lib/urls.mjs';

export async function GET() {
  const site = await getSite();
  const body = site.preview
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\nDisallow: /contact/send.php\nDisallow: /contact/thanks/\n\nSitemap: ${SITE}/sitemap.xml\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
