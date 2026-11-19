// next-publish.txt, read by the server script deploy/pull.sh.
// One line, the Unix time (seconds) of the next verified page whose only reason to be held is its
// future publish time, or nothing when no page is waiting. The server asks GitHub for a new build once
// that time has passed, because GitHub's own hourly schedule drops most runs.
import { getSite } from '../lib/site.mjs';

export async function GET() {
  const site = await getSite();
  let next = null;
  if (!site.preview) {
    for (const h of site.held) {
      if (!h.publishAt || h.reasons.length !== 1 || h.reasons[0].code !== 'future') continue;
      const t = h.publishAt.getTime();
      if (next === null || t < next) next = t;
    }
  }
  const body = next === null ? '' : `${Math.floor(next / 1000)}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
