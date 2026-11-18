// RSS feed of Field Notes and stone pages, newest first.
import { getSite, articles, categoryOf } from '../lib/site.mjs';
import { absoluteUrl, SITE } from '../lib/urls.mjs';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

export async function GET() {
  const site = await getSite();
  const items = articles(site).slice(0, 60).map((p) => `    <item>
      <title>${esc(p.data.h1)}</title>
      <link>${absoluteUrl(p.url)}</link>
      <guid isPermaLink="true">${absoluteUrl(p.url)}</guid>
      <pubDate>${(p.publishAt || new Date()).toUTCString()}</pubDate>
      <category>${esc(categoryOf(p))}</category>
      <description>${esc(p.data.description)}</description>
    </item>`).join('\n');
  const last = articles(site)[0]?.publishAt || new Date('2026-12-06T12:00:00Z'); // fixed, so an unchanged site gives an unchanged file
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Crystal &amp; Ritual, Field Notes</title>
    <link>${SITE}/</link>
    <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml" />
    <description>What your stone really is, where its meaning comes from, and what you can actually do with it.</description>
    <language>en-us</language>
    <lastBuildDate>${last.toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
