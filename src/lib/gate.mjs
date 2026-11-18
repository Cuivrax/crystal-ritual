// Publish gate. A page is built only when
//   1. its status is "verified",
//   2. its publishDate + publishTime (New York time) is at or before "now",
//   3. it holds no "[TO CHECK" placeholder anywhere in its body or frontmatter.
// BUILD_NOW (for example 2026-12-06T07:00, read as New York time) replaces "now".
// PREVIEW=1 builds every page, whatever its status, date or placeholders.

export const NY = 'America/New_York';
const PLACEHOLDER_RX = /\[TO CHECK/gi;

function partsIn(date, timeZone) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const o = {};
  for (const p of f.formatToParts(date)) o[p.type] = p.value;
  return { y: +o.year, mo: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second };
}

/** The instant of a wall-clock time in a time zone (New York by default). */
export function zonedToInstant(y, mo, d, h = 0, mi = 0, timeZone = NY) {
  const target = Date.UTC(y, mo - 1, d, h, mi);
  let guess = target;
  for (let i = 0; i < 4; i++) {
    const p = partsIn(new Date(guess), timeZone);
    const diff = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) - target;
    if (diff === 0) break;
    guess -= diff;
  }
  return new Date(guess);
}

/** "2026-12-06" + "07:00" in New York time, as a Date. Null when unreadable. */
export function publishInstant(dateStr, timeStr = '00:00') {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || '').trim());
  const t = /^(\d{1,2}):(\d{2})$/.exec(String(timeStr || '00:00').trim());
  if (!d || !t) return null;
  const [y, mo, day] = d.slice(1).map(Number);
  const [h, mi] = t.slice(1).map(Number);
  if (mo < 1 || mo > 12 || day < 1 || day > 31 || h > 23 || mi > 59) return null;
  return zonedToInstant(y, mo, day, h, mi, NY);
}

/**
 * Reads BUILD_NOW. Without a zone it is New York wall time ("2026-12-06T07:00",
 * "2026-12-06 07:00" or "2026-12-06"). With "Z" or an offset it is an exact instant.
 */
export function parseBuildNow(value, fallback = new Date()) {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  const s = String(value).trim();
  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) throw new Error(`BUILD_NOW "${s}" is not a valid date`);
    return d;
  }
  const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{1,2}:\d{2}))?$/.exec(s);
  if (!m) throw new Error(`BUILD_NOW "${s}" should look like 2026-12-06T07:00 (New York time)`);
  const d = publishInstant(m[1], m[2] || '00:00');
  if (!d) throw new Error(`BUILD_NOW "${s}" is not a valid date`);
  return d;
}

export function isPreview(env = process.env) {
  return ['1', 'true', 'yes'].includes(String(env.PREVIEW || '').toLowerCase());
}

/** Number of "[TO CHECK" markers in the body and the frontmatter. */
export function countPlaceholders(entry) {
  const body = String(entry.body || '');
  const front = JSON.stringify(entry.data || {});
  return (body.match(PLACEHOLDER_RX) || []).length + (front.match(PLACEHOLDER_RX) || []).length;
}

/**
 * Gate one page. Entry shape { id, data: { status, publishDate, publishTime, ... }, body }.
 * Returns { built, reasons: [{ code, text }], publishAt }.
 */
export function evaluate(entry, { now = new Date(), preview = false } = {}) {
  const data = entry.data || {};
  const reasons = [];
  if (data.status !== 'verified') reasons.push({ code: 'draft', text: `status is ${data.status || 'missing'}` });
  const publishAt = publishInstant(data.publishDate, data.publishTime);
  if (!publishAt) {
    reasons.push({ code: 'bad-date', text: `unreadable publish date ${data.publishDate} ${data.publishTime}` });
  } else if (publishAt.getTime() > now.getTime()) {
    reasons.push({ code: 'future', text: `publishes ${data.publishDate} ${data.publishTime} New York` });
  }
  const n = countPlaceholders(entry);
  if (n > 0) reasons.push({ code: 'placeholder', text: `${n} [TO CHECK] placeholder${n > 1 ? 's' : ''}` });
  return { built: preview || reasons.length === 0, reasons, publishAt };
}

/** Splits entries into built and held lists. */
export function partition(entries, opts = {}) {
  const built = [];
  const held = [];
  for (const entry of entries) {
    const r = evaluate(entry, opts);
    const row = { entry, ...r };
    if (r.built) built.push(row); else held.push(row);
  }
  return { built, held };
}

/** Plain text table of the held pages, for the build log. */
export function formatHeldTable(held, urlOf = (e) => e.id) {
  if (!held.length) return 'No page is held.';
  const rows = held
    .map((h) => [urlOf(h.entry), h.entry.data?.status || '', `${h.entry.data?.publishDate || ''} ${h.entry.data?.publishTime || ''}`, h.reasons.map((r) => r.text).join(', ')])
    .sort((a, b) => a[0].localeCompare(b[0]));
  const head = ['Page', 'Status', 'Publish (NY)', 'Why it is held'];
  const widths = head.map((hd, i) => Math.max(hd.length, ...rows.map((r) => r[i].length)));
  const line = (cells) => `| ${cells.map((c, i) => c.padEnd(widths[i])).join(' | ')} |`;
  return [line(head), `|${widths.map((w) => '-'.repeat(w + 2)).join('|')}|`, ...rows.map(line)].join('\n');
}

/** Counts per reason code, for a one-line summary. */
export function summarizeHeld(held) {
  const c = { draft: 0, future: 0, placeholder: 0, 'bad-date': 0 };
  for (const h of held) for (const r of h.reasons) c[r.code] = (c[r.code] || 0) + 1;
  return c;
}
