// The finder's data comes from the two verified charts, and the sign and cusp logic matches them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTable, stoneList, parseRange, linkCell, makeMatcher, buildData } from '../scripts/build-birth-zodiac.mjs';
import { parseMonthDay, signFor, cuspFor, dayOfYear, glyphSvg, SIGN_KEYS } from '../src/lib/zodiac.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

test('parseTable reads the first table with the given first header', () => {
  const md = 'Intro\n\n| Other | X |\n|---|---|\n| a | b |\n\n| Month | Modern | Old |\n|---|---|---|\n| [March](/birthstones/march/) | Aquamarine, bloodstone | Bloodstone |\n| April | Diamond | Diamond |\n\nAfter';
  const rows = parseTable(md, 'Month');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].Modern, 'Aquamarine, bloodstone');
  assert.deepEqual(linkCell(rows[0].Month), { text: 'March', url: '/birthstones/march/' });
  assert.deepEqual(linkCell(rows[1].Month), { text: 'April', url: null });
  assert.deepEqual(parseTable(md, 'Sign'), []);
});

test('stoneList keeps alternates and title-cases names', () => {
  assert.deepEqual(stoneList('Bloodstone, alternate aquamarine'), [{ name: 'Bloodstone' }, { name: 'Aquamarine', alternate: true }]);
  assert.deepEqual(stoneList('lapis lazuli'), [{ name: 'Lapis Lazuli' }]);
  assert.deepEqual(stoneList(''), []);
});

test('parseRange turns sign dates into MM-DD', () => {
  assert.deepEqual(parseRange('March 21 to April 19'), { start: '03-21', end: '04-19' });
  assert.deepEqual(parseRange('December 22 to January 19'), { start: '12-22', end: '01-19' });
  assert.equal(parseRange('Around March 21'), null);
  assert.equal(parseRange('Marz 21 to April 19'), null);
});

test('makeMatcher matches by slug, then by a unique alias', () => {
  const match = makeMatcher({ zircon: { name: 'Zircon', aliases: ['Hyacinth'] }, 'cats-eye': { name: "Cat's Eye" }, a: { name: 'A', aliases: ['Both'] }, b: { name: 'B', aliases: ['Both'] } });
  assert.equal(match('Zircon'), 'zircon');
  assert.equal(match('Hyacinth'), 'zircon');
  assert.equal(match("Cat's-Eye"), 'cats-eye');
  assert.equal(match('Both'), null);
  assert.equal(match('Beryl'), null);
});

const stones = JSON.parse(read('src/data/stones.json')).stones;
const data = buildData({ birthstonesMd: read('content/pages/birthstones.md'), zodiacMd: read('content/pages/zodiac.md'), stones });

test('the real charts give 12 months and 12 signs', () => {
  assert.equal(data.months.length, 12);
  assert.equal(data.signs.length, 12);
  assert.deepEqual(data.months.map((m) => m.number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual(data.signs.map((s) => s.key).sort(), [...SIGN_KEYS].sort());
  for (const m of data.months) assert.ok(m.modern.length > 0, `${m.name} has modern stones`);
  for (const s of data.signs) assert.ok(s.stone1913.length > 0, `${s.name} has a 1913 stone`);
  const committed = JSON.parse(read('src/data/birth_zodiac.json'));
  assert.deepEqual({ months: committed.months, signs: committed.signs }, data, 'birth_zodiac.json is up to date, run npm run finder');
});

test('tourmaline borrows the pink tourmaline cut-out and keeps its own sheet', () => {
  const oct = data.months.find((m) => m.key === 'october');
  const t = oct.modern.find((s) => s.name === 'Tourmaline');
  assert.equal(t.slug, 'tourmaline');
  assert.equal(t.cutout, 'pink-tourmaline');
  // Black Tourmaline, wherever the sign chart lists it, keeps its own cut-out (not the pink one).
  const other = data.signs.flatMap((s) => s.linked).find((s) => s.name === 'Black Tourmaline');
  if (other) assert.notEqual(other.cutout, 'pink-tourmaline');
  for (const name of ['Chrysolite', 'Beryl']) {
    const hit = data.months.flatMap((m) => m.older).find((s) => s.name === name);
    assert.equal(hit.slug, null);
    assert.equal(hit.cutout, undefined);
  }
});

test('every date of a leap year has exactly one sign', () => {
  const days = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= days[m - 1]; d++) {
      const hits = data.signs.filter((s) => signFor(m, d, [s]));
      assert.equal(hits.length, 1, `${m}-${d}`);
    }
  }
  assert.equal(dayOfYear(12, 31), 366);
});

test('signFor and cuspFor', () => {
  const S = data.signs;
  assert.equal(signFor(3, 21, S).key, 'aries');
  assert.equal(signFor(12, 25, S).key, 'capricorn');
  assert.equal(signFor(1, 5, S).key, 'capricorn');
  assert.equal(signFor(2, 29, S).key, 'pisces');

  const c = cuspFor(3, 21, S);
  assert.equal(c.sign.key, 'aries');
  assert.equal(c.other.key, 'pisces');
  assert.equal(cuspFor(3, 20, S).sign.key, 'pisces');
  assert.equal(cuspFor(3, 20, S).other.key, 'aries');
  assert.equal(cuspFor(3, 22, S).other.key, 'pisces');
  assert.equal(cuspFor(3, 19, S), null);
  assert.equal(cuspFor(12, 25, S), null);
  assert.deepEqual([cuspFor(1, 20, S).sign.key, cuspFor(1, 20, S).other.key], ['aquarius', 'capricorn']);
  assert.deepEqual([cuspFor(1, 19, S).sign.key, cuspFor(1, 19, S).other.key], ['capricorn', 'aquarius']);
  assert.deepEqual([cuspFor(12, 22, S).sign.key, cuspFor(12, 22, S).other.key], ['capricorn', 'sagittarius']);
  assert.equal(cuspFor(2, 29, S), null);
});

test('parseMonthDay validates', () => {
  assert.deepEqual(parseMonthDay('03-21'), { month: 3, day: 21 });
  assert.deepEqual(parseMonthDay('3-1'), { month: 3, day: 1 });
  assert.deepEqual(parseMonthDay('02-29'), { month: 2, day: 29 });
  for (const bad of ['02-30', '04-31', '13-01', '00-10', '03-00', '0321', '2026-03-21', '', null, 'march-21']) assert.equal(parseMonthDay(bad), null, String(bad));
});

test('every sign has a glyph', () => {
  for (const k of SIGN_KEYS) assert.match(glyphSvg(k), /^<svg [^>]*aria-hidden="true"[^>]*><path d="M/);
  assert.equal(glyphSvg('ophiuchus'), '');
});
