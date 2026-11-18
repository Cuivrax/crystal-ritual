// Moon tools page code, from tools/moon/index.html, now running inside the site layout.
// The astronomy stays in src/lib/moon.js (unchanged). Changes from the demo page
//   - phase stones show the facet word on our five-facet scale instead of a count of guides,
//     facets = min(level(n / of), cap(n)), the rule used for every intention ranking
//     (level 5 at 70 percent of the guides read, 4 at 50, 3 at 35, 2 at 20, else 1,
//     capped at 2 when n is 2 or less, 3 when n is 3, 4 when n is 4 or 5),
//   - stone names link to their pages when those pages are published,
//   - each block only runs when it is on the page, labels follow the house style,
//   - the saved card uses the site's Gilda Display.
import {
  moonPhase, nextFullMoon, nextPhase, phasesInMonth, fullMoonsInYear, fullMoonName,
  illuminatedFraction, phaseOnDate, moonSVG, litPath, MARIA, CRATERS, MOON_COLORS,
} from '../lib/moon.js';
import STONES from '../data/phase_stones.json';

const FACET_LABELS = { 5: 'Classic', 4: 'Widely Linked', 3: 'Often Linked', 2: 'Sometimes Linked', 1: 'Rarely Linked' };
export function facetsFromCounts(n, of) {
  if (!n || !of) return 1;
  const share = n / of;
  const level = share >= 0.7 ? 5 : share >= 0.5 ? 4 : share >= 0.35 ? 3 : share >= 0.2 ? 2 : 1;
  const cap = n >= 6 ? 5 : n >= 4 ? 4 : n === 3 ? 3 : 2;
  return Math.max(1, Math.min(level, cap));
}
const GEM = (x) => `M${x} 1L${x + 6} 5.5L${x} 15L${x - 6} 5.5Z`;
function facetSvg(k) {
  const xs = [7, 23, 39, 55, 71];
  return `<svg class="facets" width="78" height="16" viewBox="0 0 78 16" aria-hidden="true"><path class="facets-on" d="${xs.slice(0, k).map(GEM).join('')}"/><path class="facets-off" d="${xs.slice(k).map(GEM).join('')}"/></svg>`;
}

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
let BUILT = [];
try { BUILT = JSON.parse(document.getElementById('built-stones')?.textContent || '[]'); } catch (e) { BUILT = []; }
const BUILT_SET = new Set(BUILT);

let TZ = '';
try { TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { TZ = ''; }

// Time zones south of the equator, where the Moon shows turned around.
const SOUTH_RX = /^(Australia|Antarctica)\/|^Pacific\/(Auckland|Chatham|Fiji|Tongatapu|Apia|Noumea|Efate|Port_Moresby|Guadalcanal|Tahiti|Rarotonga|Easter|Norfolk|Pago_Pago|Niue|Marquesas|Gambier|Pitcairn|Wallis|Funafuti|Nauru)$|^America\/(Argentina\/.+|Buenos_Aires|Cordoba|Santiago|Punta_Arenas|Montevideo|Asuncion|Sao_Paulo|Bahia|Recife|Fortaleza|Maceio|Belem|Araguaina|Manaus|Cuiaba|Campo_Grande|Porto_Velho|Rio_Branco|Eirunepe|Santarem|Noronha|La_Paz|Lima)$|^Africa\/(Johannesburg|Maputo|Harare|Lusaka|Windhoek|Gaborone|Maseru|Mbabane|Blantyre|Lubumbashi|Dar_es_Salaam|Luanda|Kinshasa|Brazzaville|Bujumbura|Kigali)$|^Indian\/(Antananarivo|Mauritius|Reunion|Mayotte|Comoro|Mahe|Kerguelen|Chagos|Cocos)$|^Asia\/(Jakarta|Makassar|Jayapura|Dili)$|^Atlantic\/(St_Helena|South_Georgia|Stanley)$/;
const SOUTH = SOUTH_RX.test(TZ);

const fmt = (opts) => new Intl.DateTimeFormat('en-US', opts);
const F = {
  full: fmt({ weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
  dayLong: fmt({ weekday: 'long', month: 'long', day: 'numeric' }),
  dayShort: fmt({ weekday: 'short', month: 'short', day: 'numeric' }),
  plainDate: fmt({ month: 'long', day: 'numeric', year: 'numeric' }),
  time: fmt({ hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }),
  clock: fmt({ hour: 'numeric', minute: '2-digit' }),
  month: fmt({ month: 'long', year: 'numeric' }),
};

function zoneName(date) {
  try {
    const part = fmt({ timeZoneName: 'long' }).formatToParts(date).find((p) => p.type === 'timeZoneName');
    return part ? part.value : TZ;
  } catch (e) { return TZ; }
}

function dayNumber(d) { return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); }
function relativeDay(now, then) {
  const n = dayNumber(then) - dayNumber(now);
  if (n <= 0) return 'Later today';
  if (n === 1) return 'Tomorrow';
  return `In ${n} days`;
}
function drawing(illumination, waxing, size, label) { return moonSVG(illumination, waxing, { size, southern: SOUTH, label }); }
function phaseLabel(phase, percent) { return `${phase} moon, ${percent} percent illuminated`; }

function stonesFor(phase) {
  const key = STONES.phase_groups && STONES.phase_groups[phase];
  return (STONES.phases && STONES.phases[key]) || { label: phase.toLowerCase(), stones: [] };
}

function stonesHTML(phase) {
  const g = stonesFor(phase);
  if (!g.stones || !g.stones.length) {
    return `<p class="stones-empty">No stone is linked often enough to the ${esc(g.label)} in modern crystal guides to rate it.</p>`;
  }
  const items = g.stones.map((s) => {
    const k = facetsFromCounts(s.sources, s.sources_read);
    const name = BUILT_SET.has(s.slug) ? `<a href="/stones/${esc(s.slug)}/">${esc(s.name)}</a>` : esc(s.name);
    return `<li><span class="stone-name">${name}</span><span class="facet-rating" role="img" aria-label="${k} of 5 facets, ${FACET_LABELS[k]}">${facetSvg(k)}<span class="facet-word">${FACET_LABELS[k]}</span></span></li>`;
  }).join('');
  return `<p class="stones-label">${esc(g.heading)}</p><ul class="phase-stones">${items}</ul>`;
}

// ------------------------------------------------------------ Tonight's Moon
function renderTonight(now) {
  if (!$('tonight-moon')) return;
  const mp = moonPhase(now);
  $('tonight-moon').innerHTML = drawing(mp.illumination, mp.waxing, 240, phaseLabel(mp.phase, mp.percent));
  $('tonight-date').textContent = F.full.format(now);
  $('tonight-phase').textContent = mp.phase;
  $('tonight-pct').textContent = `${mp.percent}%`;
  $('tonight-trend').textContent = mp.waxing ? 'and growing' : 'and shrinking';
  $('tonight-age').textContent = `${mp.age.toFixed(1)} days since the new moon`;
  const exact = $('tonight-exact');
  if (mp.principal) {
    const verb = mp.principal.date <= now ? 'was' : 'is';
    exact.textContent = `The exact ${mp.principal.phase.toLowerCase()} ${verb} at ${F.time.format(mp.principal.date)} today`;
    exact.hidden = false;
  } else {
    exact.hidden = true;
  }
  const nf = nextFullMoon(now);
  $('next-name').textContent = `The ${nf.name}`;
  $('next-date').textContent = `${F.full.format(nf.date)}, ${F.time.format(nf.date)}`;
  $('next-in').textContent = relativeDay(now, nf.date);
  const nn = nextPhase(now, 'New Moon');
  if ($('new-date')) $('new-date').textContent = `${F.full.format(nn.date)}, ${F.time.format(nn.date)}`;
  const side = SOUTH ? 'Southern' : 'Northern';
  $('tz-note').textContent = `Times are shown for your time zone, ${zoneName(now)}. The moon is drawn as it looks from the ${side} Hemisphere. The lit share is the same wherever you are, only clock times change.`;
}

// ------------------------------------------------------- The Month in Moons
function renderMonth(now) {
  if (!$('month-list')) return;
  $('month-label').textContent = F.month.format(now);
  const events = phasesInMonth(now.getFullYear(), now.getMonth() + 1);
  const next = events.find((ev) => ev.date > now);
  $('month-list').innerHTML = events.map((ev) => {
    const k = illuminatedFraction(ev.date);
    const waxing = ev.phase === 'New Moon' || ev.phase === 'First Quarter';
    const trad = ev.phase === 'Full Moon' ? `<p class="trad">${esc(fullMoonName(ev.date).name)}</p>` : '';
    return `<li class="phase-card${ev === next ? ' is-next' : ''}">
      <div class="phase-head">
        <div class="moon-wrap">${drawing(k, waxing, 64, '')}</div>
        <div>
          <h3>${esc(ev.phase)}</h3>${trad}
          <p class="when"><time datetime="${ev.date.toISOString()}">${F.dayLong.format(ev.date)}</time><br><span class="muted">${F.time.format(ev.date)}</span></p>
          ${ev === next ? '<p class="tag">Next Up</p>' : ''}
        </div>
      </div>
      <div class="phase-stones-wrap">${stonesHTML(ev.phase)}</div>
    </li>`;
  }).join('');
}

// --------------------------------------------------- Full Moon Calendar 2027
function renderCalendar() {
  if (!$('cal-body')) return;
  // The year and the names follow the US calendar (US Eastern dates), as in the almanac list.
  const moons = fullMoonsInYear(2027, { timeZone: 'America/New_York' });
  $('cal-body').innerHTML = moons.map((ev) => `<tr>
    <th scope="row">${esc(ev.name)}</th>
    <td><time datetime="${ev.date.toISOString()}"><span class="d-long">${F.dayLong.format(ev.date)}</span><span class="d-short">${F.dayShort.format(ev.date)}</span><span class="t-inline">${F.time.format(ev.date)}</span></time></td>
    <td class="col-time">${F.time.format(ev.date)}</td>
  </tr>`).join('');
  if ($('cal-tz')) $('cal-tz').textContent = `Shown in your time zone, ${zoneName(new Date())}.`;
}

// ------------------------------------------------------------ Birthday Moon
let birthday = null;
function readDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!m) return null;
  const [y, mo, d] = m.slice(1).map(Number);
  const check = new Date(y, mo - 1, d, 12);
  if (check.getFullYear() !== y || check.getMonth() !== mo - 1 || check.getDate() !== d) return null;
  return { y, mo, d, noon: check };
}

function renderBirthday() {
  const msg = $('bday-msg');
  const out = $('bday-out');
  const day = readDate($('bday').value);
  if (!day) { msg.textContent = 'Enter a full date with month, day and year.'; return; }
  if (day.y < 1900 || day.y > 2100) { msg.textContent = 'Pick a date between 1900 and 2100.'; return; }
  msg.textContent = '';
  const mp = phaseOnDate(day.y, day.mo, day.d);
  birthday = { ...day, mp, iso: $('bday').value };
  let exact = '';
  if (mp.principal) exact = `<p class="exact">The exact ${mp.principal.phase.toLowerCase()} came at <span class="nowrap">${F.clock.format(mp.principal.date)}</span> that day.</p>`;
  out.innerHTML = `<div class="bday-result">
    <div class="moon-wrap">${drawing(mp.illumination, mp.waxing, 200, phaseLabel(mp.phase, mp.percent))}</div>
    <div>
      <p class="moon-eyebrow">The night of ${esc(F.full.format(day.noon))}</p>
      <p class="phase-name">${esc(mp.phase)}</p>
      <p class="stat"><strong>${mp.percent}%</strong> illuminated</p>
      ${exact}
      ${stonesHTML(mp.phase)}
      <div class="bday-actions">
        <button type="button" class="btn btn-night" id="save-card">Save as Image</button>
        <p class="fine">A 1000 by 1500 picture sized for Pinterest, with the moon, its phase and the date.</p>
      </div>
    </div>
  </div>`;
}

// Canvas copy of the moon drawing, same shapes as moonSVG.
function drawMoon(ctx, cx, cy, r, illumination, waxing, southern) {
  const C = MOON_COLORS;
  const disk = () => { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); };
  const maria = (fill) => {
    ctx.save();
    ctx.fillStyle = fill;
    if ('filter' in ctx) ctx.filter = `blur(${(r * 0.016).toFixed(2)}px)`;
    for (const [x, y, rx, ry] of MARIA) { ctx.beginPath(); ctx.ellipse(x * r, y * r, rx * r, ry * r, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  };
  ctx.save();
  ctx.translate(cx, cy);
  if (southern) ctx.rotate(Math.PI);
  disk(); ctx.fillStyle = C.dark; ctx.fill();
  ctx.save(); disk(); ctx.clip(); maria(C.darkMare); ctx.restore();
  const lit = litPath(0, 0, r, illumination, waxing);
  if (lit) {
    ctx.save();
    ctx.clip(new Path2D(lit));
    disk(); ctx.fillStyle = C.lit; ctx.fill();
    maria(C.mare);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = C.crater;
    for (const [x, y, cr] of CRATERS) { ctx.beginPath(); ctx.arc(x * r, y * r, cr * r, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  disk(); ctx.lineWidth = r / 98; ctx.strokeStyle = C.rim; ctx.stroke();
  ctx.restore();
}

function fitFont(ctx, text, family, weight, size, maxWidth) {
  let s = size;
  do { ctx.font = `${weight} ${s}px ${family}`; s -= 2; } while (ctx.measureText(text).width > maxWidth && s > 20);
}

async function drawCard(b) {
  try { await Promise.all(['400 96px "Gilda Display"', '400 44px Figtree', '600 30px Figtree'].map((f) => document.fonts.load(f))); } catch (e) { /* system fonts stand in */ }
  const W = 1000; const H = 1500;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const serif = '"Gilda Display", Georgia, serif';
  const sans = 'Figtree, system-ui, sans-serif';
  ctx.fillStyle = '#141A2E';
  ctx.fillRect(0, 0, W, H);
  let seed = 20261206;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  ctx.fillStyle = '#ECE6D8';
  for (let i = 0; i < 110; i++) {
    const x = rnd() * W; const y = rnd() * H; const s = rnd();
    if (Math.hypot(x - W / 2, y - 560) < 370 || (y > 900 && y < 1420 && x > 120 && x < 880)) continue;
    ctx.globalAlpha = 0.18 + 0.4 * s;
    ctx.beginPath(); ctx.arc(x, y, 0.9 + 1.7 * s * s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(201, 169, 107, 0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(44, 44, W - 88, H - 88);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '8px';
  ctx.fillStyle = '#C9A96B';
  ctx.font = `600 30px ${sans}`;
  ctx.fillText('BIRTHDAY MOON', W / 2, 150);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  drawMoon(ctx, W / 2, 560, 320, b.mp.illumination, b.mp.waxing, SOUTH);
  ctx.fillStyle = '#ECE6D8';
  fitFont(ctx, b.mp.phase, serif, 400, 96, W - 180);
  ctx.fillText(b.mp.phase, W / 2, 1035);
  ctx.font = `400 46px ${sans}`;
  ctx.fillText(F.plainDate.format(b.noon), W / 2, 1115);
  ctx.fillStyle = '#C6C0D4';
  ctx.font = `400 34px ${sans}`;
  ctx.fillText(`${b.mp.percent}% illuminated`, W / 2, 1175);
  ctx.fillStyle = '#C9A96B';
  ctx.fillRect(W / 2 - 40, 1300, 80, 2);
  ctx.font = `400 46px ${serif}`;
  ctx.fillText('Crystal & Ritual', W / 2, 1385);
  return cv;
}

async function saveCard(button) {
  if (!birthday) return;
  button.disabled = true;
  button.textContent = 'Preparing the Image';
  try {
    const cv = await drawCard(birthday);
    const blob = await new Promise((resolve) => cv.toBlob(resolve, 'image/png'));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `birthday-moon-${birthday.iso}.png`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  } finally {
    button.disabled = false;
    button.textContent = 'Save as Image';
  }
}

// ------------------------------------------------------------ home mini panel
function renderMini(now) {
  const box = document.querySelector('[data-moon-mini]');
  if (!box) return;
  const tonight = phaseOnDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
  box.querySelector('[data-mini-moon]').innerHTML = drawing(tonight.illumination, tonight.waxing, 168, phaseLabel(tonight.phase, tonight.percent));
  box.querySelector('[data-mini-date]').textContent = F.dayLong.format(now);
  box.querySelector('[data-mini-phase]').textContent = tonight.phase;
  box.querySelector('[data-mini-pct]').textContent = `About ${tonight.percent}% lit at 9 PM tonight, ${tonight.waxing ? 'and growing' : 'and shrinking'}`;
  const nf = nextFullMoon(now);
  box.querySelector('[data-mini-next]').textContent = `Full ${nf.name} on ${F.dayLong.format(nf.date)}, at ${F.time.format(nf.date)}`;
  const strip = document.querySelector('[data-moon-strip]');
  if (strip) {
    const events = phasesInMonth(now.getFullYear(), now.getMonth() + 1);
    const next = events.find((ev) => ev.date > now);
    const SHORT = { 'New Moon': 'New', 'First Quarter': 'First Quarter', 'Full Moon': 'Full', 'Last Quarter': 'Last Quarter' };
    const d = fmt({ month: 'short', day: 'numeric' });
    strip.innerHTML = events.map((ev) => {
      const k = illuminatedFraction(ev.date);
      const waxing = ev.phase === 'New Moon' || ev.phase === 'First Quarter';
      return `<li class="${ev === next ? 'is-next' : ''}"><div class="ms-moon">${drawing(k, waxing, 34, '')}</div><p>${SHORT[ev.phase]}</p><p>${d.format(ev.date)}</p></li>`;
    }).join('');
  }
}

// ------------------------------------------------------------------ start
function renderLive() {
  const now = new Date();
  renderTonight(now);
  renderMonth(now);
  renderMini(now);
}

renderLive();
renderCalendar();
setInterval(renderLive, 10 * 60 * 1000);

if ($('bday-form')) {
  $('bday-form').addEventListener('submit', (e) => { e.preventDefault(); renderBirthday(); });
  $('bday').addEventListener('change', () => { if (readDate($('bday').value)) renderBirthday(); });
  $('bday-out').addEventListener('click', (e) => {
    const button = e.target.closest('#save-card');
    if (button) saveCard(button);
  });
}
