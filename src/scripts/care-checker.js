// Crystal Care Checker page code, from tools/care-checker/index.html, unchanged except
//   - stone names link through a per-stone url set at build time (published pages only),
//   - dealer and guide links are removed at build time (owner rule), a verdict that rests on
//     one shows "A dealer care guide we read" without naming or linking it.
(() => {
  'use strict';

  // ------------------------------------------------------------ data
  let DATA = {};
  try { DATA = JSON.parse(document.getElementById('care-data').textContent || '{}'); } catch (e) { DATA = {}; }
  const STONES = (DATA.stones || []).slice().sort((a, b) => a.name.localeCompare(b.name));
  const BY_SLUG = new Map(STONES.map((s) => [s.slug, s]));
  const HOSTS = DATA.hosts || {};
  const MAX = 6;
  const UNKNOWN_REASON = 'None of our sources cover this yet.';
  // Stone names link to their pages only when those pages are published (hidden-link rule),
  // so each stone carries its own url from the build instead of a data-stone-url pattern.
  const QUICK = ['amethyst', 'clear-quartz', 'rose-quartz', 'selenite', 'citrine', 'black-tourmaline', 'labradorite', 'tigers-eye'];

  const VERDICT = {
    ok: { label: 'OK', cls: 'v-ok', meaning: 'Our sources say this kind of contact is fine.' },
    brief_only: { label: 'Brief Only', cls: 'v-brief', meaning: 'Our sources allow short contact only, so keep it quick.' },
    avoid: { label: 'Avoid', cls: 'v-avoid', meaning: 'Our sources warn against it.' },
    unknown: { label: 'Not Enough Data', cls: 'v-unknown', meaning: 'Our sources say nothing yet. Until they do, a dry method like moonlight or sound is the gentle choice.' },
  };
  const ORDER = ['ok', 'brief_only', 'avoid', 'unknown'];
  const ICON = {
    ok: '<path d="M5 12.5l4.3 4.3L19 7"/>',
    brief_only: '<circle cx="12" cy="12" r="8"/><path d="M12 7.6V12l3 2"/>',
    avoid: '<path d="M7 7l10 10M17 7L7 17"/>',
    unknown: '<path d="M9.3 9.2a2.8 2.8 0 1 1 4.1 2.6c-.9.5-1.4 1.1-1.4 2.1v.5"/><path d="M12 17.6v.1"/>',
  };

  const NO_DATA = {
    water: 'Our sources do not cover water for this stone yet.',
    soak: 'Our sources do not cover water for this stone yet.',
    sun_light: 'Our sources do not cover sunlight for this stone yet.',
    salt: 'Our sources do not cover salt for this stone yet.',
  };

  const METHODS = [
    { id: 'rinse', name: 'Rinse Under the Tap', hint: 'A quick run of tap water', field: 'water', group: 'contact',
      card: { ok: 'A rinse under the tap is fine.', brief_only: 'Keep it to a quick rinse, then pat it dry.', avoid: 'Keep it away from the tap.' },
      one: { ok: 'can take a rinse under the tap', brief_only: 'can take a quick rinse, then pat it dry', avoid: 'should stay away from the tap', unknown: 'has no water rating in our sources yet' },
      all: { ok: 'can take a rinse under the tap', brief_only: 'can take a quick rinse only', avoid: 'should stay away from the tap', unknown: 'have no water rating in our sources yet' },
      list: { ok: ['can take a rinse'], brief_only: ['can take a quick rinse only'], avoid: ['should stay dry'], unknown: ['has no water rating yet', 'have no water rating yet'] } },
    { id: 'soak', name: 'Soak in Water', hint: 'Time in a bowl of water', field: 'soak', group: 'contact',
      card: { ok: 'A soak in water is fine.', brief_only: 'Brief contact with water only, so skip the long soak.', avoid: 'Keep it out of water.' },
      one: { ok: 'can soak in water', brief_only: 'can take brief contact with water only, so skip the long soak', avoid: 'should stay out of water', unknown: 'has no water rating in our sources yet' },
      all: { ok: 'can soak in water', brief_only: 'can take brief contact with water only, so skip the long soak', avoid: 'should stay out of water', unknown: 'have no water rating in our sources yet' },
      list: { ok: ['can soak in water'], brief_only: ['can take a quick dip only'], avoid: ['should stay dry'], unknown: ['has no water rating yet', 'have no water rating yet'] } },
    { id: 'sun', name: 'Leave in Sunlight', hint: 'Hours on a sunny windowsill', field: 'sun_light', group: 'contact',
      card: { ok: 'Sunlight is fine.', brief_only: 'Keep sun sessions short.', avoid: 'Keep it out of strong sun.' },
      one: { ok: 'is fine in sunlight', brief_only: 'can take short spells of sun only', avoid: 'should stay out of strong sun', unknown: 'has no sunlight rating in our sources yet' },
      all: { ok: 'are fine in sunlight', brief_only: 'can take short spells of sun only', avoid: 'should stay out of strong sun', unknown: 'have no sunlight rating in our sources yet' },
      list: { ok: ['is fine in sunlight', 'are fine in sunlight'], brief_only: ['can take short spells only'], avoid: ['should stay out of strong sun'], unknown: ['has no sunlight rating yet', 'have no sunlight rating yet'] } },
    { id: 'salt', name: 'Bury in Salt or Salt Water', hint: 'Dry salt or a bowl of salt water', field: 'salt', group: 'contact',
      card: { ok: 'Our sources allow salt for this stone.', brief_only: 'Brief contact with salt only.', avoid: 'Keep it away from salt and salt water.' },
      one: { ok: 'is fine with salt by our sources', brief_only: 'can take brief contact with salt only', avoid: 'should stay away from salt and salt water', unknown: 'has no salt rating in our sources yet' },
      all: { ok: 'are fine with salt by our sources', brief_only: 'can take brief contact with salt only', avoid: 'should stay away from salt and salt water', unknown: 'have no salt rating in our sources yet' },
      list: { ok: ['is fine with salt', 'are fine with salt'], brief_only: ['can take brief contact only'], avoid: ['should stay away from salt'], unknown: ['has no salt rating yet', 'have no salt rating yet'] } },
    { id: 'moon', name: 'Moonlight', hint: 'A night on a windowsill or outdoors', group: 'dry', where: 'under the moon', subject: 'Moonlight' },
    { id: 'sound', name: 'Sound', hint: 'A singing bowl or a bell', group: 'dry', where: 'with a singing bowl or bell', subject: 'Sound from a bowl or bell' },
    { id: 'smoke', name: 'Smoke', hint: 'Passing the stone through smoke', group: 'dry', where: 'with smoke', subject: 'Smoke' },
    { id: 'selenite', name: 'Selenite Plate', hint: 'Resting on a selenite slab', group: 'dry', where: 'on a selenite plate', subject: 'A selenite plate' },
    { id: 'rice', name: 'Brown Rice', hint: 'Tucked into a bowl of dry brown rice', group: 'dry', where: 'in brown rice', subject: 'Brown rice' },
  ];
  const METHOD_BY_ID = new Map(METHODS.map((m) => [m.id, m]));

  // ------------------------------------------------------------ helpers
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const rating = (stone, field) => {
    const r = stone.care && stone.care[field] && stone.care[field].rating;
    return VERDICT[r] ? r : 'unknown';
  };
  const verdictFor = (stone, m) => (m.group === 'dry' ? 'ok' : rating(stone, m.field));
  const icon = (r) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[r]}</svg>`;
  const pill = (r, small) => `<span class="pill ${VERDICT[r].cls}${small ? ' small' : ''}">${icon(r)}${VERDICT[r].label}</span>`;
  const countOf = (list) => ORDER.reduce((o, r) => { o[r] = list.filter((x) => x === r).length; return o; }, {});
  const allOf = (n) => (n === 2 ? 'Both of your stones' : `All ${n} of your stones`);
  const joinList = (parts) => (parts.length < 2 ? parts.join('') : parts.length === 2
    ? `${parts[0]} and ${parts[1]}` : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`);
  const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  const status = (msg) => { const el = $('#status'); el.textContent = ''; window.setTimeout(() => { el.textContent = msg; }, 30); };

  // ------------------------------------------------------------ wording
  function cardLine(stone, m) {
    if (m.group === 'dry') return `${m.subject} has no physical contact risk documented in our sources.`;
    const r = rating(stone, m.field);
    return r === 'unknown' ? NO_DATA[m.field] : m.card[r];
  }

  function summaryText(sel, m) {
    const n = sel.length;
    if (!n || !m) return '';
    if (m.group === 'dry') {
      const w = sel.map((s) => rating(s, 'water'));
      const ok = w.filter((r) => r === 'ok').length;
      const known = w.filter((r) => r !== 'unknown').length;
      if (n === 1) {
        const tail = {
          ok: ', and it can go in water too.',
          brief_only: ', while water should stay a quick rinse.',
          avoid: ', but it should stay out of water.',
          unknown: '. Our sources have no water rating for it yet.',
        }[w[0]];
        return `${sel[0].name} is fine ${m.where}${tail}`;
      }
      let s = `${allOf(n)} are fine ${m.where}`;
      if (!known) s += '. Our sources have no water rating for them yet.';
      else if (ok === n) s += n === 2 ? ', and both can go in water too.' : ', and all of them can go in water too.';
      else if (ok) s += `, only ${ok} can go in water.`;
      else s += ', but none is cleared for water by our sources.';
      return s;
    }
    const rs = sel.map((s) => rating(s, m.field));
    const c = countOf(rs);
    let out;
    if (n === 1) {
      out = `${sel[0].name} ${m.one[rs[0]]}.`;
    } else {
      const uniform = ORDER.find((r) => c[r] === n);
      if (uniform) {
        out = `${allOf(n)} ${m.all[uniform]}.`;
      } else {
        const parts = ORDER.filter((r) => c[r]).map((r) => {
          const forms = m.list[r];
          return `${c[r]} ${c[r] === 1 ? forms[0] : (forms[1] || forms[0])}`;
        });
        out = `Of your ${n} stones, ${joinList(parts)}.`;
      }
    }
    const soft = c.avoid + c.unknown;
    if (soft) {
      if (soft === n) {
        out += n === 1 ? ' A dry method like moonlight or sound is the gentle choice.'
          : ' A dry method like moonlight or sound is the gentle choice for all of them.';
      } else {
        const marks = [c.avoid ? 'Avoid' : '', c.unknown ? 'Not Enough Data' : ''].filter(Boolean).join(' or ');
        out += ` For the ${soft === 1 ? 'one' : 'ones'} marked ${marks}, moonlight or sound is the gentle choice.`;
      }
    }
    return out;
  }

  // ------------------------------------------------------------ state
  let selected = [];
  let method = null;
  const params = new URLSearchParams(window.location.search);
  const embed = params.get('embed') === '1';
  (params.get('stones') || '').split(',').map((x) => x.trim()).filter((x) => BY_SLUG.has(x)).forEach((slug) => {
    if (selected.length < MAX && !selected.includes(slug)) selected.push(slug);
  });
  if (METHOD_BY_ID.has(params.get('method'))) method = params.get('method');

  // ------------------------------------------------------------ search
  const INDEX = STONES.map((s) => ({
    s, n: norm(s.name), al: (s.aliases || []).map((a) => ({ raw: a, n: norm(a) })).filter((a) => a.n),
  }));

  function scoreText(t, q) {
    if (t === q) return 0;
    if (t.startsWith(q)) return 1;
    if ((' ' + t).includes(' ' + q)) return 2;
    if (t.includes(q)) return 5;
    if (t.replace(/ /g, '').includes(q.replace(/ /g, ''))) return 6;
    return -1;
  }

  function search(query) {
    const q = norm(query);
    if (!q) return [];
    const out = [];
    for (const item of INDEX) {
      if (selected.includes(item.s.slug)) continue;
      let best = scoreText(item.n, q);
      let alias = null;
      if (best !== 0) {
        for (const a of item.al) {
          let sc = scoreText(a.n, q);
          if (sc < 0) continue;
          sc += 0.5;
          if (best < 0 || sc < best) { best = sc; alias = a.raw; }
        }
      }
      if (best >= 0) out.push({ s: item.s, score: best, alias });
    }
    out.sort((a, b) => a.score - b.score || a.s.name.localeCompare(b.s.name));
    return out.slice(0, 8);
  }

  const input = $('#stone-search');
  const listbox = $('#stone-list');
  let matches = [];
  let active = -1;

  function openList() {
    const q = input.value.trim();
    if (!q) { closeList(); return; }
    if (selected.length >= MAX) {
      matches = [];
      listbox.innerHTML = '<li role="option" aria-disabled="true" aria-selected="false" id="opt-none">You have six stones. Remove one to add another.</li>';
    } else {
      matches = search(q);
      listbox.innerHTML = matches.length
        ? matches.map((m, i) => `<li role="option" id="opt-${esc(m.s.slug)}" data-slug="${esc(m.s.slug)}" aria-selected="${i === active}">`
          + `<span class="o-name">${esc(m.s.name)}</span>${m.alias ? `<span class="o-alias">also called ${esc(m.alias)}</span>` : ''}</li>`).join('')
        : '<li role="option" aria-disabled="true" aria-selected="false" id="opt-none">No stone by that name yet. Try another spelling.</li>';
    }
    listbox.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    syncActive();
  }

  function closeList() {
    listbox.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }

  function syncActive() {
    const items = listbox.querySelectorAll('[data-slug]');
    items.forEach((li, i) => li.setAttribute('aria-selected', String(i === active)));
    if (active >= 0 && items[active]) {
      input.setAttribute('aria-activedescendant', items[active].id);
      items[active].scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function move(step) {
    if (listbox.hidden) openList();
    if (!matches.length) return;
    active = active < 0 ? (step > 0 ? 0 : matches.length - 1) : (active + step + matches.length) % matches.length;
    syncActive();
  }

  input.addEventListener('input', () => { active = -1; openList(); });
  input.addEventListener('focus', () => { if (input.value.trim()) openList(); });
  input.addEventListener('blur', () => window.setTimeout(closeList, 150));
  input.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); move(1); break;
      case 'ArrowUp': e.preventDefault(); move(-1); break;
      case 'Enter':
        if (!listbox.hidden && matches.length) { e.preventDefault(); addStone(matches[active >= 0 ? active : 0].s.slug); }
        else if (listbox.hidden && input.value.trim()) { e.preventDefault(); openList(); }
        break;
      case 'Escape':
        if (!listbox.hidden) { e.preventDefault(); closeList(); } else if (input.value) { input.value = ''; }
        break;
      case 'Backspace':
        if (!input.value && selected.length) removeStone(selected[selected.length - 1], 'input');
        break;
      case 'Tab': closeList(); break;
      default: break;
    }
  });
  listbox.addEventListener('mousedown', (e) => e.preventDefault());
  listbox.addEventListener('click', (e) => {
    const li = e.target.closest('[data-slug]');
    if (li) addStone(li.dataset.slug);
  });

  function addStone(slug) {
    const stone = BY_SLUG.get(slug);
    if (!stone) return;
    if (selected.includes(slug)) { status(`${stone.name} is already on your list.`); return; }
    if (selected.length >= MAX) { status('You have six stones. Remove one to add another.'); return; }
    selected.push(slug);
    input.value = '';
    closeList();
    update();
    status(`${stone.name} added. ${countText()}`);
  }

  function removeStone(slug, focusAfter) {
    const i = selected.indexOf(slug);
    if (i < 0) return;
    const name = BY_SLUG.get(slug).name;
    selected.splice(i, 1);
    update();
    if (focusAfter === 'chip') {
      const buttons = document.querySelectorAll('#chips button');
      (buttons[Math.min(i, buttons.length - 1)] || input).focus();
    }
    status(`${name} removed. ${countText()}`);
  }

  function countText() {
    const n = selected.length;
    if (!n) return 'No stones picked yet. You can add up to six.';
    if (n >= MAX) return 'Six of six stones picked. Remove one to add another.';
    return `${n} of 6 stones picked.`;
  }

  // ------------------------------------------------------------ render
  function renderMethods() {
    const make = (m) => `<label class="method"><input type="radio" name="method" value="${m.id}"${method === m.id ? ' checked' : ''}>`
      + `<span class="m-name">${esc(m.name)}</span><span class="m-hint">${esc(m.hint)}</span></label>`;
    $('#methods-contact').innerHTML = METHODS.filter((m) => m.group === 'contact').map(make).join('');
    $('#methods-dry').innerHTML = METHODS.filter((m) => m.group === 'dry').map(make).join('');
    document.querySelectorAll('input[name="method"]').forEach((r) => {
      r.addEventListener('change', () => {
        method = r.value;
        update();
        status(summaryText(selected.map((s) => BY_SLUG.get(s)), METHOD_BY_ID.get(method)));
      });
    });
  }

  function renderChips() {
    $('#chips').innerHTML = selected.map((slug) => {
      const s = BY_SLUG.get(slug);
      return `<li class="chip"><span>${esc(s.name)}</span><button type="button" data-remove="${esc(slug)}" aria-label="Remove ${esc(s.name)}">`
        + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg></button></li>';
    }).join('');
    $('#chips').hidden = !selected.length;
    $('#count').textContent = countText();
    input.placeholder = selected.length >= MAX ? 'Six stones picked' : (selected.length ? 'Add another stone' : 'Try amethyst or selenite');
  }

  function renderQuick() {
    const box = $('#quick');
    box.querySelectorAll('button').forEach((b) => b.remove());
    QUICK.filter((slug) => BY_SLUG.has(slug)).forEach((slug) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'quick-btn';
      b.textContent = BY_SLUG.get(slug).name;
      b.setAttribute('aria-pressed', String(selected.includes(slug)));
      b.disabled = !selected.includes(slug) && selected.length >= MAX;
      b.addEventListener('click', () => (selected.includes(slug) ? removeStone(slug) : addStone(slug)));
      box.appendChild(b);
    });
  }

  function sourceLinks(urls) {
    const seen = {};
    return urls.map((url) => {
      const host = hostOf(url);
      const info = HOSTS[host] || { label: host, tier: 'reference' };
      seen[info.label] = (seen[info.label] || 0) + 1;
      const label = seen[info.label] > 1 ? `${info.label}, page ${seen[info.label]}` : info.label;
      const rel = info.tier === 'dealer' ? 'noopener nofollow' : 'noopener';
      const tag = info.tier === 'dealer' ? '<span class="tag">dealer guide</span>' : '';
      return `<a href="${esc(url)}" target="_blank" rel="${rel}">${esc(label)}<span class="sr-only"> (opens in a new tab)</span></a>${tag}`;
    }).join('');
  }

  function stoneTitle(s) {
    if (!s.url) return esc(s.name);
    return `<a href="${esc(s.url)}">${esc(s.name)}</a>`;
  }

  function cardHTML(s, m) {
    const r = verdictFor(s, m);
    let body = `<p class="line">${esc(cardLine(s, m))}</p>`;
    if (m.group === 'dry') {
      const w = rating(s, 'water');
      body += `<p class="aside"><span>Water, for comparison</span>${pill(w, true)}</p>`;
    } else {
      const c = s.care[m.field] || {};
      if (c.reason && !(r === 'unknown' && c.reason === UNKNOWN_REASON)) body += `<p class="reason">${esc(c.reason)}</p>`;
      if (c.sources && c.sources.length) body += `<p class="sources"><span class="src-label">Sources</span>${sourceLinks(c.sources)}</p>`;
      else if (c.guide_sources) body += '<p class="sources"><span class="src-label">Source</span><span>A dealer care guide we read</span></p>';
      if (c.wikipedia_only && r !== 'unknown') body += '<p class="note">Only Wikipedia backs this rating so far, so treat it as a first lead.</p>';
      if (r === 'avoid' || r === 'unknown') body += '<p class="gentle">A dry method like moonlight or sound is the gentle choice.</p>';
    }
    return `<article class="card ${VERDICT[r].cls}" data-slug="${esc(s.slug)}" data-verdict="${r}">`
      + `<div class="card-top"><h3>${stoneTitle(s)}</h3>${pill(r)}</div>${body}</article>`;
  }

  function renderResults() {
    const m = method ? METHOD_BY_ID.get(method) : null;
    const sel = selected.map((s) => BY_SLUG.get(s));
    const ready = !!(m && sel.length);
    $('#empty').hidden = ready;
    $('#result-body').hidden = !ready;
    if (!ready) {
      $('#empty').textContent = !sel.length && !m ? 'Pick at least one stone and a method, and your results show up here.'
        : !sel.length ? 'Now pick at least one stone, and your results show up here.'
          : 'Now pick a method, and your results show up here.';
      return;
    }
    $('#summary-method').textContent = m.name;
    $('#summary').textContent = summaryText(sel, m);
    $('#cards').innerHTML = sel.map((s) => cardHTML(s, m)).join('');
    const soft = m.group === 'contact' && sel.some((s) => ['avoid', 'unknown'].includes(rating(s, m.field)));
    $('#try-dry').hidden = !soft;
  }

  function syncUrl() {
    try {
      const p = new URLSearchParams(window.location.search);
      if (selected.length) p.set('stones', selected.join(',')); else p.delete('stones');
      if (method) p.set('method', method); else p.delete('method');
      const qs = p.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : '') + window.location.hash);
    } catch (e) { /* file pages and sandboxes can refuse this */ }
  }

  function update() {
    renderChips();
    renderQuick();
    renderResults();
    syncUrl();
    postHeight();
  }

  $('#chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-remove]');
    if (b) removeStone(b.dataset.remove, 'chip');
  });

  $('#try-dry').addEventListener('click', () => {
    method = 'moon';
    const radio = document.querySelector('input[name="method"][value="moon"]');
    if (radio) radio.checked = true;
    update();
    status(summaryText(selected.map((s) => BY_SLUG.get(s)), METHOD_BY_ID.get(method)));
    $('#summary').focus({ preventScroll: true });
  });

  $('#reset').addEventListener('click', () => {
    selected = [];
    method = null;
    document.querySelectorAll('input[name="method"]').forEach((r) => { r.checked = false; });
    update();
    input.focus();
    status('Cleared. Pick a stone to start again.');
  });

  // ------------------------------------------------------------ care card image
  const C = { bg: '#FBFAF8', panel: '#F6F2F6', text: '#2B2537', muted: '#5D566A', accent: '#5B4B88', gold: '#B4975A' };
  const VC = {
    ok: { bg: '#CFEBD8', ink: '#1D4D33', edge: '#3F8A60' },
    brief_only: { bg: '#E8C062', ink: '#4A3304', edge: '#A07415' },
    avoid: { bg: '#8A2A3A', ink: '#FFFFFF', edge: '#8A2A3A' },
    unknown: { bg: '#FFFFFF', ink: '#4A4458', edge: '#8C8597', dashed: true },
  };
  const SERIF = '"Gilda Display", Georgia, serif';
  const SANS = '"Figtree", system-ui, sans-serif';

  function rr(x, X, Y, w, h, r) {
    x.beginPath();
    x.moveTo(X + r, Y);
    x.arcTo(X + w, Y, X + w, Y + h, r);
    x.arcTo(X + w, Y + h, X, Y + h, r);
    x.arcTo(X, Y + h, X, Y, r);
    x.arcTo(X, Y, X + w, Y, r);
    x.closePath();
  }
  function wrapText(x, text, maxW) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (line && x.measureText(t).width > maxW) { lines.push(line); line = w; } else { line = t; }
    }
    if (line) lines.push(line);
    return lines;
  }
  function clampLines(x, lines, max, maxW) {
    if (lines.length <= max) return lines;
    const out = lines.slice(0, max);
    let last = out[max - 1];
    while (last.includes(' ') && x.measureText(`${last}…`).width > maxW) last = last.slice(0, last.lastIndexOf(' '));
    out[max - 1] = `${last.replace(/[,.;]+$/, '')}…`;
    return out;
  }
  function drawRule(x, cx, y) {
    x.save();
    x.strokeStyle = C.gold; x.lineWidth = 2;
    x.beginPath(); x.moveTo(cx - 90, y); x.lineTo(cx - 14, y); x.moveTo(cx + 14, y); x.lineTo(cx + 90, y); x.stroke();
    x.translate(cx, y); x.rotate(Math.PI / 4);
    x.strokeRect(-6, -6, 12, 12);
    x.restore();
  }
  function drawIcon(x, r, cx, cy, color) {
    x.save();
    x.strokeStyle = color; x.fillStyle = color; x.lineWidth = 3.2; x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath();
    if (r === 'ok') { x.moveTo(cx - 8, cy + 0.5); x.lineTo(cx - 2.5, cy + 6); x.lineTo(cx + 8.5, cy - 6); x.stroke(); }
    if (r === 'brief_only') { x.arc(cx, cy, 9.5, 0, Math.PI * 2); x.moveTo(cx, cy - 5.5); x.lineTo(cx, cy); x.lineTo(cx + 3.8, cy + 2.6); x.stroke(); }
    if (r === 'avoid') { x.moveTo(cx - 6.5, cy - 6.5); x.lineTo(cx + 6.5, cy + 6.5); x.moveTo(cx + 6.5, cy - 6.5); x.lineTo(cx - 6.5, cy + 6.5); x.stroke(); }
    if (r === 'unknown') { x.font = `700 24px ${SANS}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('?', cx, cy + 1); }
    x.restore();
  }
  function drawPill(x, r, right, cy) {
    const v = VC[r];
    x.save();
    x.font = `700 25px ${SANS}`;
    const label = VERDICT[r].label;
    const h = 48;
    const w = x.measureText(label).width + 72;
    const X = right - w;
    const Y = cy - h / 2;
    rr(x, X, Y, w, h, h / 2);
    x.fillStyle = v.bg; x.fill();
    if (v.dashed) { x.setLineDash([7, 5]); x.lineWidth = 2.5; x.strokeStyle = v.edge; x.stroke(); }
    drawIcon(x, r, X + 27, cy, v.ink);
    x.fillStyle = v.ink; x.textAlign = 'left'; x.textBaseline = 'middle';
    x.fillText(label, X + 48, cy + 1);
    x.restore();
    return w;
  }
  function drawRow(x, s, m, X, Y, W, H) {
    const r = verdictFor(s, m);
    const v = VC[r];
    x.save();
    rr(x, X, Y, W, H, 24);
    x.fillStyle = '#FFFFFF'; x.fill();
    x.clip();
    x.fillStyle = v.edge;
    if (v.dashed) { for (let yy = Y; yy < Y + H; yy += 16) x.fillRect(X, yy, 10, 9); } else { x.fillRect(X, Y, 10, H); }
    x.restore();
    const twoLines = H >= 140;
    const nameSize = Math.round(Math.max(30, Math.min(44, H * 0.3)));
    const lineSize = twoLines ? 25 : 23;
    x.save();
    x.font = `400 ${lineSize}px ${SANS}`;
    const lines = clampLines(x, wrapText(x, cardLine(s, m), W - 70), twoLines ? 2 : 1, W - 70);
    x.restore();
    const block = nameSize + 14 + lineSize * 1.15 + lineSize * 1.3 * (lines.length - 1);
    const nameY = Y + (H - block) / 2 + nameSize * 0.8;
    const pillW = drawPill(x, r, X + W - 26, nameY - nameSize * 0.32);
    x.save();
    let size = nameSize;
    const nameMax = W - 40 - pillW - 50;
    do { x.font = `400 ${size}px ${SERIF}`; size -= 2; } while (x.measureText(s.name).width > nameMax && size > 22);
    x.fillStyle = C.text; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    x.fillText(s.name, X + 40, nameY);
    x.font = `400 ${lineSize}px ${SANS}`;
    x.fillStyle = C.muted;
    let ly = nameY + 14 + lineSize * 1.15;
    for (const l of lines) { x.fillText(l, X + 40, ly); ly += lineSize * 1.3; }
    x.restore();
  }

  function drawCard(sel, m) {
    const W = 1000;
    const H = 1500;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    x.fillStyle = C.bg; x.fillRect(0, 0, W, H);
    rr(x, 36, 36, W - 72, H - 72, 44);
    x.fillStyle = C.panel; x.fill();
    x.textAlign = 'center'; x.textBaseline = 'alphabetic';

    x.font = `700 22px ${SANS}`;
    if ('letterSpacing' in x) x.letterSpacing = '5px';
    x.fillStyle = C.accent;
    x.fillText('CRYSTAL CARE CARD', W / 2, 118);
    if ('letterSpacing' in x) x.letterSpacing = '0px';

    let size = 84;
    let titleLines;
    do { x.font = `400 ${size}px ${SERIF}`; titleLines = wrapText(x, m.name, 820); size -= 4; } while (titleLines.length > 2 && size > 52);
    size += 4;
    let y = 196 + size * 0.2;
    x.fillStyle = C.text;
    for (const l of titleLines) { x.fillText(l, W / 2, y); y += size * 1.06; }

    x.font = `400 30px ${SANS}`;
    x.fillStyle = C.muted;
    const full = summaryText(sel, m);
    let sumLines = wrapText(x, full, 790);
    if (sumLines.length > 4) sumLines = wrapText(x, `${full.split('. ')[0].replace(/\.$/, '')}.`, 790);
    sumLines = clampLines(x, sumLines, 4, 790);
    y += 4;
    for (const l of sumLines) { x.fillText(l, W / 2, y); y += 42; }

    y += 12;
    drawRule(x, W / 2, y);
    y += 38;
    const n = sel.length;
    const gap = 16;
    const bottom = 1296;
    const rowH = Math.min(176, (bottom - y - gap * (n - 1)) / n);
    const listH = rowH * n + gap * (n - 1);
    const top = y + Math.max(0, (bottom - y - listH) / 2);
    sel.forEach((s, i) => drawRow(x, s, m, 80, top + i * (rowH + gap), 840, rowH));

    drawRule(x, W / 2, 1340);
    x.textAlign = 'center';
    x.font = `400 46px ${SERIF}`;
    x.fillStyle = C.accent;
    x.fillText('Crystal & Ritual', W / 2, 1404);
    x.font = `400 21px ${SANS}`;
    x.fillStyle = C.muted;
    x.fillText('Care ratings checked against gem references and care guides', W / 2, 1442);
    return cv;
  }

  async function fontsReady() {
    if (!document.fonts || !document.fonts.load) return;
    const wait = Promise.all([
      document.fonts.load(`400 40px ${SERIF}`),
      document.fonts.load(`400 24px ${SANS}`),
      document.fonts.load(`700 24px ${SANS}`),
    ]).catch(() => null);
    await Promise.race([wait, new Promise((res) => window.setTimeout(res, 2500))]);
  }

  $('#save').addEventListener('click', async () => {
    const m = METHOD_BY_ID.get(method);
    const sel = selected.map((s) => BY_SLUG.get(s));
    if (!m || !sel.length) return;
    const btn = $('#save');
    const label = btn.querySelector('span');
    btn.disabled = true;
    label.textContent = 'Drawing Your Card';
    try {
      await fontsReady();
      const cv = drawCard(sel, m);
      window.__lastCard = cv;
      const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crystal-care-card-${m.id}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      status('Your care card image is saved.');
    } catch (e) {
      status('The image could not be made in this browser.');
    } finally {
      btn.disabled = false;
      label.textContent = 'Save as Image';
    }
  });

  // ------------------------------------------------------------ embed height
  function postHeight() {
    if (!embed || window.parent === window) return;
    window.parent.postMessage({ type: 'crystal-care-checker-height', height: document.documentElement.scrollHeight }, '*');
  }

  // ------------------------------------------------------------ boot
  function boot() {
    if (embed) document.body.classList.add('embed');
    if (!$('#legend')) return;
    $('#legend').innerHTML = ORDER.map((r) => `<div><dt>${pill(r)}</dt><dd>${esc(VERDICT[r].meaning)}</dd></div>`).join('');
    if (DATA.generated) {
      const d = new Date(`${DATA.generated}T12:00:00`);
      if (!Number.isNaN(d.getTime())) {
        $('#built').textContent = `Care ratings built ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
      }
    }
    renderMethods();
    update();
    if (embed && 'ResizeObserver' in window) new ResizeObserver(postHeight).observe(document.body);
  }
  boot();
})();
