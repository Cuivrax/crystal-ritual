// Zodiac glyphs and sign dates, shared by the Birthstone & Zodiac Finder, the /zodiac/ chart,
// the sign pages and the printable chart.
//
// The twelve glyphs are the classic astrological signs redrawn as plain line art on a 24 unit
// grid, one stroke weight, round ends, so they sit with the site's other icons.

const P = {
  aries: 'M12 20.5V9.5C12 6 10.2 4 7.8 4 5.7 4 4.2 5.6 4.2 7.6c0 1.6 1 2.7 2.4 2.9M12 9.5C12 6 13.8 4 16.2 4c2.1 0 3.6 1.6 3.6 3.6 0 1.6-1 2.7-2.4 2.9',
  taurus: 'M3.8 4.2c1 3.4 4.1 5.7 8.2 5.7s7.2-2.3 8.2-5.7M12 9.9a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
  gemini: 'M4 4.6c4.8 2 11.2 2 16 0M4 19.4c4.8-2 11.2-2 16 0M8.6 6.2v11.6M15.4 6.2v11.6',
  cancer: 'M20 8.4c-2.6-3-8.4-4.2-12.6-1.6M7.2 6.2a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4zM4 15.6c2.6 3 8.4 4.2 12.6 1.6M16.8 12.4a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4z',
  leo: 'M7.6 12.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8zM11 16c0-3.4-1.8-5.2-1.8-8 0-2.5 1.9-4.3 4.3-4.3 2.5 0 4.2 1.8 4.2 4.3 0 3.4-3 5.4-3 9 0 1.8 1.2 3 2.8 3 .9 0 1.6-.4 2.1-1',
  virgo: 'M3.8 6.6v11.6M3.8 9c0-1.6 1-2.6 2.4-2.6S8.6 7.4 8.6 9v9.2M8.6 9c0-1.6 1-2.6 2.4-2.6s2.4 1 2.4 2.6v6.6c0 2.6 1.4 4.4 3.6 4.4M13.4 13c1.2-2.4 3.4-3.4 5-2.6 1.7.9 1.6 3.6-.4 5-1.2.9-2.8 1.3-4.2 1',
  libra: 'M4 19.4h16M4 15.4h4.4a5.4 5.4 0 1 1 7.2 0H20',
  scorpio: 'M3.6 6.6v11M3.6 9c0-1.6 1-2.6 2.4-2.6S8.4 7.4 8.4 9v8.6M8.4 9c0-1.6 1-2.6 2.4-2.6s2.4 1 2.4 2.6v7.6c0 1.6 1 2.6 2.6 2.6h4M17.8 16.8l2.2 2.4-2.2 2.4',
  sagittarius: 'M4.6 19.4L19.4 4.6M12.4 4.6h7v7M7.2 11.6l5.2 5.2',
  capricorn: 'M3.8 6.4c1.4 0 2.4.9 2.9 2.4l2.9 9.4 3.3-10c.5-1.3 1.5-2 2.8-2 2 0 3.3 1.7 3.3 4.4 0 2.6-1.4 4.2-3.2 4.2-1.6 0-2.7-1.2-2.7-2.8M15.8 14.8c1.3 1.6 1 4-1 5.2-1.1.7-2.6.7-3.6.1',
  aquarius: 'M3.6 10l2.8-2.6L9.2 10l2.8-2.6 2.8 2.6 2.8-2.6 2.8 2.6M3.6 16.6L6.4 14l2.8 2.6L12 14l2.8 2.6 2.8-2.6 2.8 2.6',
  pisces: 'M6.2 4c3.4 3 3.4 13 0 16M17.8 4c-3.4 3-3.4 13 0 16M5.4 12h13.2',
};

export const SIGN_KEYS = Object.keys(P);

/** The glyph of a sign as an inline SVG, aria-hidden (the sign's name is always printed next to it). */
export function glyphSvg(sign, { size = 24, stroke = 1.6, cls = '' } = {}) {
  const d = P[String(sign).toLowerCase()];
  if (!d) return '';
  return `<svg class="zodiac-svg${cls ? ` ${cls}` : ''}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
}

/** The glyph in its soft round badge. */
export function glyphBadge(sign, { size = 44, cls = '' } = {}) {
  const svg = glyphSvg(sign, { size: Math.round(size * 0.58) });
  return svg ? `<span class="zodiac-badge${cls ? ` ${cls}` : ''}" style="width:${size}px;height:${size}px">${svg}</span>` : '';
}

// ------------------------------------------------------------ dates
const DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Day of the year in a leap year, 1 to 366, so February 29 has its own place. */
export function dayOfYear(month, day) {
  let n = day;
  for (let m = 1; m < month; m++) n += DAYS[m - 1];
  return n;
}

export function validMonthDay(month, day) {
  return Number.isInteger(month) && Number.isInteger(day) && month >= 1 && month <= 12 && day >= 1 && day <= DAYS[month - 1];
}

/** Parses "03-21" or "3-21", returns { month, day } or null. */
export function parseMonthDay(text) {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(String(text || '').trim());
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  return validMonthDay(month, day) ? { month, day } : null;
}

/** The sign of a date. signs = [{ key, start: "03-21", end: "04-19" }, ...] in calendar order of their start. */
export function signFor(month, day, signs) {
  const d = dayOfYear(month, day);
  for (const s of signs) {
    const a = dayOfYear(...s.start.split('-').map(Number));
    const b = dayOfYear(...s.end.split('-').map(Number));
    if (a <= b ? d >= a && d <= b : d >= a || d <= b) return s;
  }
  return null;
}

/**
 * Guides disagree by a day at the edges. A boundary is the first day of a sign (March 21 for Aries),
 * and a date within one day of it (March 20, 21 or 22) gets a cusp note with the sign on the other side.
 * Returns { sign, other } or null.
 */
export function cuspFor(month, day, signs) {
  const sign = signFor(month, day, signs);
  if (!sign) return null;
  const d = dayOfYear(month, day);
  const n = signs.length;
  for (let i = 0; i < n; i++) {
    const s = dayOfYear(...signs[i].start.split('-').map(Number));
    let diff = d - s;
    if (diff > 183) diff -= 366;
    if (diff < -183) diff += 366;
    if (Math.abs(diff) > 1) continue;
    const prev = signs[(i + n - 1) % n];
    return diff >= 0 ? { sign: signs[i], other: prev } : { sign: prev, other: signs[i] };
  }
  return null;
}
