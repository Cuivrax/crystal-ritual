// moon.js, Crystal & Ritual moon tools. Dependency-free ES module.
//
// Principal phase times follow Jean Meeus, Astronomical Algorithms (2nd ed.,
// 1998), chapter 49, with the full periodic and planetary corrections. The
// illuminated fraction uses the low-precision phase angle of chapter 48
// (eq. 48.4) with the mean elements of chapter 47. Dynamical time is turned
// into UT with the Espenak and Meeus (2006) delta T polynomials.
//
// Phase names for a moment follow the calendar convention used by almanacs.
// A principal phase (New Moon, First Quarter, Full Moon, Last Quarter) names
// the whole local day on which it falls. Every other day takes the in-between
// name (Waxing Crescent, Waxing Gibbous, Waning Gibbous, Waning Crescent).

export const SYNODIC_MONTH = 29.530588861;

export const PHASE_NAMES = [
  'New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous',
  'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent',
];

export const PRINCIPAL_PHASES = ['New Moon', 'First Quarter', 'Full Moon', 'Last Quarter'];

const DAY_MS = 86400000;
const RAD = Math.PI / 180;
const sin = (deg) => Math.sin(deg * RAD);
const cos = (deg) => Math.cos(deg * RAD);
const norm360 = (deg) => ((deg % 360) + 360) % 360;

// ---------------------------------------------------------------- time scales

/** Julian Day (UT) of a JS Date. */
export function dateToJD(date) {
  return date.getTime() / DAY_MS + 2440587.5;
}

/** JS Date of a Julian Day (UT). */
export function jdToDate(jd) {
  return new Date(Math.round((jd - 2440587.5) * DAY_MS));
}

/** Delta T = TT - UT in seconds, Espenak and Meeus (2006) polynomials. */
export function deltaT(year) {
  const y = year;
  let t;
  if (y < 1800 || y >= 2150) {
    const u = (y - 1820) / 100;
    return -20 + 32 * u * u;
  }
  if (y < 1860) {
    t = y - 1800;
    return 13.72 - 0.332447 * t + 0.0068612 * t ** 2 + 0.0041116 * t ** 3 - 0.00037436 * t ** 4
      + 0.0000121272 * t ** 5 - 0.0000001699 * t ** 6 + 0.000000000875 * t ** 7;
  }
  if (y < 1900) {
    t = y - 1860;
    return 7.62 + 0.5737 * t - 0.251754 * t ** 2 + 0.01680668 * t ** 3
      - 0.0004473624 * t ** 4 + t ** 5 / 233174;
  }
  if (y < 1920) {
    t = y - 1900;
    return -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3 - 0.000197 * t ** 4;
  }
  if (y < 1941) {
    t = y - 1920;
    return 21.20 + 0.84493 * t - 0.076100 * t ** 2 + 0.0020936 * t ** 3;
  }
  if (y < 1961) {
    t = y - 1950;
    return 29.07 + 0.407 * t - t ** 2 / 233 + t ** 3 / 2547;
  }
  if (y < 1986) {
    t = y - 1975;
    return 45.45 + 1.067 * t - t ** 2 / 260 - t ** 3 / 718;
  }
  if (y < 2005) {
    t = y - 2000;
    return 63.86 + 0.3345 * t - 0.060374 * t ** 2 + 0.0017275 * t ** 3
      + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5;
  }
  if (y < 2050) {
    t = y - 2000;
    return 62.92 + 0.32217 * t + 0.005589 * t ** 2;
  }
  const u = (y - 1820) / 100;
  return -20 + 32 * u * u - 0.5628 * (2150 - y);
}

function decimalYearOfJD(jd) {
  return 2000 + (jd - 2451544.5) / 365.2425;
}

/** Julian Ephemeris Day (TT) to a JS Date in UT. */
export function jdeToDate(jde) {
  const dt = deltaT(decimalYearOfJD(jde));
  return jdToDate(jde - dt / 86400);
}

/** JS Date (UT) to Julian Ephemeris Day (TT). */
export function dateToJDE(date) {
  const jd = dateToJD(date);
  return jd + deltaT(decimalYearOfJD(jd)) / 86400;
}

// ------------------------------------------- Meeus chapter 49, phase instants

/**
 * JDE of the principal phase with lunation number k.
 * k is an integer for a New Moon, +0.25 First Quarter, +0.5 Full Moon,
 * +0.75 Last Quarter. k = 0 is the New Moon of 2000 January 6.
 */
export function phaseJDE(k) {
  const T = k / 1236.85;
  const T2 = T * T, T3 = T2 * T, T4 = T3 * T;

  let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T2 - 0.000000150 * T3 + 0.00000000073 * T4;

  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const M = norm360(2.5534 + 29.10535670 * k - 0.0000014 * T2 - 0.00000011 * T3);
  const Mp = norm360(201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4);
  const F = norm360(160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4);
  const Om = norm360(124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3);

  const frac = Math.round((k - Math.floor(k)) * 4) / 4;
  let c = 0;

  if (frac === 0 || frac === 0.5) {
    const nm = frac === 0;
    c += (nm ? -0.40720 : -0.40614) * sin(Mp);
    c += (nm ? 0.17241 : 0.17302) * E * sin(M);
    c += (nm ? 0.01608 : 0.01614) * sin(2 * Mp);
    c += (nm ? 0.01039 : 0.01043) * sin(2 * F);
    c += (nm ? 0.00739 : 0.00734) * E * sin(Mp - M);
    c += (nm ? -0.00514 : -0.00515) * E * sin(Mp + M);
    c += (nm ? 0.00208 : 0.00209) * E * E * sin(2 * M);
    c += -0.00111 * sin(Mp - 2 * F);
    c += -0.00057 * sin(Mp + 2 * F);
    c += 0.00056 * E * sin(2 * Mp + M);
    c += -0.00042 * sin(3 * Mp);
    c += 0.00042 * E * sin(M + 2 * F);
    c += 0.00038 * E * sin(M - 2 * F);
    c += -0.00024 * E * sin(2 * Mp - M);
    c += -0.00017 * sin(Om);
    c += -0.00007 * sin(Mp + 2 * M);
    c += 0.00004 * sin(2 * Mp - 2 * F);
    c += 0.00004 * sin(3 * M);
    c += 0.00003 * sin(Mp + M - 2 * F);
    c += 0.00003 * sin(2 * Mp + 2 * F);
    c += -0.00003 * sin(Mp + M + 2 * F);
    c += 0.00003 * sin(Mp - M + 2 * F);
    c += -0.00002 * sin(Mp - M - 2 * F);
    c += -0.00002 * sin(3 * Mp + M);
    c += 0.00002 * sin(4 * Mp);
  } else {
    c += -0.62801 * sin(Mp);
    c += 0.17172 * E * sin(M);
    c += -0.01183 * E * sin(Mp + M);
    c += 0.00862 * sin(2 * Mp);
    c += 0.00804 * sin(2 * F);
    c += 0.00454 * E * sin(Mp - M);
    c += 0.00204 * E * E * sin(2 * M);
    c += -0.00180 * sin(Mp - 2 * F);
    c += -0.00070 * sin(Mp + 2 * F);
    c += -0.00040 * sin(3 * Mp);
    c += -0.00034 * E * sin(2 * Mp - M);
    c += 0.00032 * E * sin(M + 2 * F);
    c += 0.00032 * E * sin(M - 2 * F);
    c += -0.00028 * E * E * sin(Mp + 2 * M);
    c += 0.00027 * E * sin(2 * Mp + M);
    c += -0.00017 * sin(Om);
    c += -0.00005 * sin(Mp - M - 2 * F);
    c += 0.00004 * sin(2 * Mp + 2 * F);
    c += -0.00004 * sin(Mp + M + 2 * F);
    c += 0.00004 * sin(Mp - 2 * M);
    c += 0.00003 * sin(Mp + M - 2 * F);
    c += 0.00003 * sin(3 * M);
    c += 0.00002 * sin(2 * Mp - 2 * F);
    c += 0.00002 * sin(Mp - M + 2 * F);
    c += -0.00002 * sin(3 * Mp + M);
    const W = 0.00306 - 0.00038 * E * cos(M) + 0.00026 * cos(Mp)
      - 0.00002 * cos(Mp - M) + 0.00002 * cos(Mp + M) + 0.00002 * cos(2 * F);
    c += frac === 0.25 ? W : -W;
  }

  // Additional corrections for all phases (planetary arguments).
  const A = [
    299.77 + 0.107408 * k - 0.009173 * T2,
    251.88 + 0.016321 * k,
    251.83 + 26.651886 * k,
    349.42 + 36.412478 * k,
    84.66 + 18.206239 * k,
    141.74 + 53.303771 * k,
    207.14 + 2.453732 * k,
    154.84 + 7.306860 * k,
    34.52 + 27.261239 * k,
    207.19 + 0.121824 * k,
    291.34 + 1.844379 * k,
    161.72 + 24.198154 * k,
    239.56 + 25.513099 * k,
    331.55 + 3.592518 * k,
  ];
  const AC = [0.000325, 0.000165, 0.000164, 0.000126, 0.000110, 0.000062, 0.000060,
    0.000056, 0.000047, 0.000042, 0.000040, 0.000037, 0.000035, 0.000023];
  let extra = 0;
  for (let i = 0; i < 14; i++) extra += AC[i] * sin(A[i]);

  jde += c + extra;
  return jde;
}

function phaseNameOfK(k) {
  const q = Math.round((k - Math.floor(k)) * 4) % 4;
  return PRINCIPAL_PHASES[q];
}

function eventOfK(k) {
  const jde = phaseJDE(k);
  return { phase: phaseNameOfK(k), date: jdeToDate(jde), jde, k };
}

function kNear(date) {
  return Math.floor((dateToJDE(date) - 2451550.09766) / SYNODIC_MONTH);
}

/**
 * Principal phases whose instant falls in [start, end), in time order.
 * Each item is { phase, date (UT instant), jde, k }.
 */
export function phasesBetween(start, end) {
  const s = start.getTime(), e = end.getTime();
  const out = [];
  for (let k = kNear(start) - 1; ; k += 0.25) {
    const ev = eventOfK(k);
    const t = ev.date.getTime();
    if (t >= e) break;
    if (t >= s) out.push(ev);
  }
  return out;
}

/**
 * Principal phases of a calendar month (month 1 to 12) in a time zone.
 * timeZone is an IANA name such as 'America/New_York' or 'UTC'. When it is
 * left out the runtime's own zone is used (the visitor's zone in a browser).
 * Usually four events, sometimes five.
 */
export function phasesInMonth(year, month, { timeZone } = {}) {
  const start = zonedTime(year, month, 1, 0, 0, timeZone);
  const ny = month === 12 ? year + 1 : year;
  const nm = month === 12 ? 1 : month + 1;
  const end = zonedTime(ny, nm, 1, 0, 0, timeZone);
  return phasesBetween(start, end);
}

/** All principal phases of a calendar year in a time zone. */
export function phasesInYear(year, { timeZone } = {}) {
  return phasesBetween(zonedTime(year, 1, 1, 0, 0, timeZone), zonedTime(year + 1, 1, 1, 0, 0, timeZone));
}

/** Full moons of a calendar year in a time zone, each with its traditional name. */
export function fullMoonsInYear(year, { timeZone } = {}) {
  return phasesInYear(year, { timeZone })
    .filter((ev) => ev.phase === 'Full Moon')
    .map((ev) => ({ ...ev, ...fullMoonName(ev.date) }));
}

/** Next principal phase after a moment. phase may be one name or left out for any. */
export function nextPhase(date, phase) {
  const t = date.getTime();
  for (let k = kNear(date) - 1; ; k += 0.25) {
    const ev = eventOfK(k);
    if (ev.date.getTime() > t && (!phase || ev.phase === phase)) return ev;
  }
}

/** Most recent principal phase at or before a moment. */
export function previousPhase(date, phase) {
  const t = date.getTime();
  for (let k = kNear(date) + 2; ; k -= 0.25) {
    const ev = eventOfK(k);
    if (ev.date.getTime() <= t && (!phase || ev.phase === phase)) return ev;
  }
}

/** Next full moon after a moment, with its traditional name. */
export function nextFullMoon(date = new Date()) {
  const ev = nextPhase(date, 'Full Moon');
  return { ...ev, ...fullMoonName(ev.date) };
}

// ------------------------------------------------- illumination (Meeus ch. 48)

/** Illuminated fraction of the disk (0 to 1) at a moment. */
export function illuminatedFraction(date) {
  const T = (dateToJDE(date) - 2451545) / 36525;
  const T2 = T * T, T3 = T2 * T, T4 = T3 * T;
  const D = norm360(297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000);
  const M = norm360(357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000);
  const Mp = norm360(134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000);
  const i = 180 - D - 6.289 * sin(Mp) + 2.100 * sin(M) - 1.274 * sin(2 * D - Mp)
    - 0.658 * sin(2 * D) - 0.214 * sin(2 * Mp) - 0.110 * sin(D);
  return (1 + cos(i)) / 2;
}

// ------------------------------------------------------- phase at a moment

const BASE = { 'New Moon': 0, 'First Quarter': 0.25, 'Full Moon': 0.5, 'Last Quarter': 0.75 };
const BETWEEN = { 'New Moon': 'Waxing Crescent', 'First Quarter': 'Waxing Gibbous', 'Full Moon': 'Waning Gibbous', 'Last Quarter': 'Waning Crescent' };

/**
 * Moon phase at a moment.
 *   fraction      position in the lunar cycle, 0 New Moon, 0.25 First Quarter,
 *                 0.5 Full Moon, 0.75 Last Quarter (linear in time between them)
 *   phase         one of PHASE_NAMES, by the local-day convention in timeZone
 *   illumination  illuminated fraction of the disk, 0 to 1
 *   percent       illumination as a whole percentage
 *   age           days since the last New Moon
 *   waxing        true from New Moon to Full Moon
 *   principal     the principal phase event falling on this local day, or null
 */
export function moonPhase(date = new Date(), { timeZone } = {}) {
  const prev = previousPhase(date);
  const next = nextPhase(date);
  const t = date.getTime();
  const span = next.date.getTime() - prev.date.getTime();
  const fraction = (BASE[prev.phase] + 0.25 * (t - prev.date.getTime()) / span) % 1;

  const lastNew = prev.phase === 'New Moon' ? prev : previousPhase(date, 'New Moon');
  const age = (t - lastNew.date.getTime()) / DAY_MS;

  const p = localParts(date, timeZone);
  const dayStart = zonedTime(p.year, p.month, p.day, 0, 0, timeZone);
  const nd = addDays(p.year, p.month, p.day, 1);
  const dayEnd = zonedTime(nd.year, nd.month, nd.day, 0, 0, timeZone);
  const inDay = (ev) => ev.date >= dayStart && ev.date < dayEnd;

  let principal = null;
  if (inDay(prev)) principal = prev;
  else if (inDay(next)) principal = next;

  const illumination = illuminatedFraction(date);
  return {
    date,
    fraction,
    phase: principal ? principal.phase : BETWEEN[prev.phase],
    illumination,
    percent: Math.round(illumination * 100),
    age,
    waxing: fraction < 0.5,
    principal,
  };
}

/**
 * Moon phase for a calendar date, read at a given local hour (default 9 PM,
 * "that night"). The phase name covers the whole local day.
 */
export function phaseOnDate(year, month, day, { timeZone, hour = 21 } = {}) {
  return moonPhase(zonedTime(year, month, day, hour, 0, timeZone), { timeZone });
}

// --------------------------------------------- traditional full moon names

// Names for 2026 and 2027, keyed by the US Eastern date, copied from
// moon_calendar_2026_2027.csv. Other years use the same rule (month of the
// US Eastern date, Blue Moon for a second full moon in one month).
const CSV_FULL_MOON_NAMES = {
  '2026-01-03': 'Wolf Moon', '2026-02-01': 'Snow Moon', '2026-03-03': 'Worm Moon',
  '2026-04-01': 'Pink Moon', '2026-05-01': 'Flower Moon', '2026-05-31': 'Blue Moon',
  '2026-06-29': 'Strawberry Moon', '2026-07-29': 'Buck Moon', '2026-08-28': 'Sturgeon Moon',
  '2026-09-26': 'Corn Moon', '2026-10-26': "Hunter's Moon", '2026-11-24': 'Beaver Moon',
  '2026-12-23': 'Cold Moon', '2027-01-22': 'Wolf Moon', '2027-02-20': 'Snow Moon',
  '2027-03-22': 'Worm Moon', '2027-04-20': 'Pink Moon', '2027-05-20': 'Flower Moon',
  '2027-06-18': 'Strawberry Moon', '2027-07-18': 'Buck Moon', '2027-08-17': 'Sturgeon Moon',
  '2027-09-15': 'Corn Moon', '2027-10-15': "Hunter's Moon", '2027-11-13': 'Beaver Moon',
  '2027-12-13': 'Cold Moon',
};

export const MONTH_MOON_NAMES = [
  'Wolf Moon', 'Snow Moon', 'Worm Moon', 'Pink Moon', 'Flower Moon', 'Strawberry Moon',
  'Buck Moon', 'Sturgeon Moon', 'Corn Moon', "Hunter's Moon", 'Beaver Moon', 'Cold Moon',
];

const NAME_ZONE = 'America/New_York';

/** Traditional name by rule, from the month of the US Eastern date. */
export function fullMoonNameByRule(date) {
  const p = localParts(date, NAME_ZONE);
  const prevFull = previousPhase(new Date(date.getTime() - DAY_MS), 'Full Moon');
  const q = localParts(prevFull.date, NAME_ZONE);
  if (q.year === p.year && q.month === p.month) {
    return { name: 'Blue Moon', note: 'second full moon of the month' };
  }
  return { name: MONTH_MOON_NAMES[p.month - 1], note: null };
}

/**
 * Traditional North American name of the full moon at this instant, as
 * { name, note }. note is set only for a Blue Moon.
 */
export function fullMoonName(date) {
  const p = localParts(date, NAME_ZONE);
  const key = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  const fromCsv = CSV_FULL_MOON_NAMES[key];
  if (fromCsv) {
    return { name: fromCsv, note: fromCsv === 'Blue Moon' ? 'second full moon of the month' : null };
  }
  return fullMoonNameByRule(date);
}

// ------------------------------------------------------------ time zones

const dtfCache = new Map();
function partsFormatter(timeZone) {
  let f = dtfCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    });
    dtfCache.set(timeZone, f);
  }
  return f;
}

function pad(n) { return String(n).padStart(2, '0'); }

/**
 * Wall-clock parts of a moment in a time zone, as numbers
 * { year, month, day, hour, minute, second }. Runtime zone when timeZone is empty.
 */
export function localParts(date, timeZone) {
  if (!timeZone) {
    return {
      year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(),
      hour: date.getHours(), minute: date.getMinutes(), second: date.getSeconds(),
    };
  }
  const o = {};
  for (const { type, value } of partsFormatter(timeZone).formatToParts(date)) {
    if (type !== 'literal') o[type] = Number(value);
  }
  if (o.hour === 24) o.hour = 0;
  return { year: o.year, month: o.month, day: o.day, hour: o.hour, minute: o.minute, second: o.second };
}

function offsetMs(date, timeZone) {
  const p = localParts(date, timeZone);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUTC - Math.floor(date.getTime() / 1000) * 1000;
}

/** The moment whose wall clock in timeZone reads year-month-day hour:minute. */
export function zonedTime(year, month, day, hour = 0, minute = 0, timeZone) {
  if (!timeZone) return new Date(year, month - 1, day, hour, minute, 0, 0);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let t = guess - offsetMs(new Date(guess), timeZone);
  const off2 = offsetMs(new Date(t), timeZone);
  t = guess - off2;
  return new Date(t);
}

function addDays(year, month, day, n) {
  const d = new Date(Date.UTC(year, month - 1, day + n));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

// ------------------------------------------------------------ drawing

// Rough outline of the main lunar maria on the near side, north up, as seen
// from the Northern Hemisphere. Units of the disk radius, x to the right.
// Each entry is an ellipse [x, y, rx, ry]; a sea may take several lobes.
export const MARIA = [
  [-0.30, -0.42, 0.27, 0.21], // Imbrium
  [-0.12, -0.50, 0.12, 0.10], // Imbrium, east lobe
  [0.17, -0.37, 0.15, 0.14],  // Serenitatis
  [0.33, -0.07, 0.19, 0.15],  // Tranquillitatis
  [0.24, 0.04, 0.12, 0.09],   // Tranquillitatis, south lobe
  [0.67, -0.30, 0.10, 0.085], // Crisium
  [0.54, 0.18, 0.10, 0.16],   // Fecunditatis
  [0.30, 0.30, 0.08, 0.08],   // Nectaris
  [-0.62, -0.20, 0.22, 0.30], // Procellarum, north
  [-0.66, 0.12, 0.20, 0.26],  // Procellarum, south
  [-0.44, 0.02, 0.14, 0.16],  // Procellarum, east edge
  [-0.20, -0.04, 0.12, 0.08], // Insularum
  [-0.18, 0.36, 0.16, 0.12],  // Nubium
  [-0.26, 0.20, 0.09, 0.07],  // Cognitum
  [-0.49, 0.40, 0.09, 0.08],  // Humorum
  [0.00, -0.72, 0.32, 0.055], // Frigoris
  [-0.01, -0.17, 0.09, 0.06], // Vaporum
];

// Bright young craters, same units as MARIA: [x, y, radius].
export const CRATERS = [
  [-0.13, 0.72, 0.030], // Tycho
  [-0.30, -0.18, 0.030], // Copernicus
  [-0.58, -0.12, 0.020], // Kepler
  [-0.74, -0.36, 0.018], // Aristarchus
];

export const MOON_COLORS = {
  lit: '#EAE3CF', mare: '#CDC4AC', crater: '#F8F4E8',
  dark: '#29325A', darkMare: '#252E52', rim: '#3B4670',
};

let svgUid = 0;

/**
 * Self-contained SVG string of the Moon with the sunlit part from
 * illuminatedFraction and the lit side from waxing. southern turns the disk
 * 180 degrees, as the Moon looks from the Southern Hemisphere.
 */
export function moonSVG(illumination, waxing, { size = 200, label = '', southern = false, colors = MOON_COLORS } = {}) {
  const c = 100, r = 98;
  const id = `moonlit${++svgUid}`;
  const lit = litPath(c, c, r, illumination, waxing);
  const f = (n) => Math.round(n * 100) / 100;
  const ell = MARIA.map(([x, y, rx, ry]) => `<ellipse cx="${f(c + x * r)}" cy="${f(c + y * r)}" rx="${f(rx * r)}" ry="${f(ry * r)}"/>`).join('');
  const maria = (fill) => `<g fill="${fill}" filter="url(#${id}s)">${ell}</g>`;
  const craters = CRATERS.map(([x, y, cr]) => `<circle cx="${f(c + x * r)}" cy="${f(c + y * r)}" r="${f(cr * r)}"/>`).join('');
  const turn = southern ? ` transform="rotate(180 ${c} ${c})"` : '';
  const a11y = label ? `role="img" aria-label="${label.replace(/"/g, '&quot;')}"` : 'aria-hidden="true"';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}" ${a11y}>`
    + `<defs><filter id="${id}s" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.6"/></filter>`
    + (lit ? `<clipPath id="${id}"><path d="${lit}"/></clipPath>` : '') + `</defs>`
    + `<g${turn}>`
    + `<circle cx="${c}" cy="${c}" r="${r}" fill="${colors.dark}"/>${maria(colors.darkMare)}`
    + (lit ? `<g clip-path="url(#${id})">`
      + `<circle cx="${c}" cy="${c}" r="${r}" fill="${colors.lit}"/>${maria(colors.mare)}`
      + `<g fill="${colors.crater}" opacity="0.85">${craters}</g></g>` : '')
    + `<circle cx="${c}" cy="${c}" r="${r - 0.5}" fill="none" stroke="${colors.rim}" stroke-width="1"/>`
    + `</g></svg>`;
}

/**
 * SVG path data for the sunlit part of the disk centred on (cx, cy), radius r.
 * illumination is 0 to 1. waxing puts the light on the right, as seen from the
 * Northern Hemisphere. Works with Path2D on a canvas too.
 */
export function litPath(cx, cy, r, illumination, waxing) {
  const k = Math.min(1, Math.max(0, illumination));
  if (k < 0.005) return '';
  const top = `${cx} ${cy - r}`, bottom = `${cx} ${cy + r}`;
  if (k > 0.995) {
    return `M ${top} A ${r} ${r} 0 1 1 ${bottom} A ${r} ${r} 0 1 1 ${top} Z`;
  }
  const a = r * Math.abs(2 * k - 1);
  const crescent = k < 0.5;
  // Limb half: right side for waxing (clockwise on screen), left for waning.
  const limbSweep = waxing ? 1 : 0;
  // Terminator from bottom back to top. A crescent bulges toward the lit limb.
  const termSweep = waxing ? (crescent ? 0 : 1) : (crescent ? 1 : 0);
  return `M ${top} A ${r} ${r} 0 0 ${limbSweep} ${bottom} A ${a} ${r} 0 0 ${termSweep} ${top} Z`;
}
