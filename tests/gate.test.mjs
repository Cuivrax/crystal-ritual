import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, partition, parseBuildNow, publishInstant, countPlaceholders, formatHeldTable, zonedToInstant } from '../src/lib/gate.mjs';

const page = (over = {}, body = 'Clean body.') => ({
  id: 'stones__amethyst',
  data: { status: 'verified', publishDate: '2026-12-06', publishTime: '07:00', title: 'Amethyst', ...over },
  body,
});
const launch = parseBuildNow('2026-12-06T07:00');

test('BUILD_NOW without a zone is New York wall time', () => {
  assert.equal(launch.toISOString(), '2026-12-06T12:00:00.000Z'); // EST, UTC-5
  assert.equal(parseBuildNow('2026-07-04T09:30').toISOString(), '2026-07-04T13:30:00.000Z'); // EDT, UTC-4
  assert.equal(parseBuildNow('2026-12-06T12:00:00Z').toISOString(), '2026-12-06T12:00:00.000Z');
  assert.equal(parseBuildNow('2026-12-06').toISOString(), '2026-12-06T05:00:00.000Z');
  assert.throws(() => parseBuildNow('next tuesday'));
  const fallback = new Date('2030-01-01T00:00:00Z');
  assert.equal(parseBuildNow('', fallback), fallback);
});

test('publish times follow daylight saving in New York', () => {
  assert.equal(publishInstant('2027-03-14', '03:30').toISOString(), '2027-03-14T07:30:00.000Z');
  assert.equal(publishInstant('2027-11-07', '12:00').toISOString(), '2027-11-07T17:00:00.000Z');
  assert.equal(zonedToInstant(2026, 12, 13, 7, 14).toISOString(), '2026-12-13T12:14:00.000Z');
  assert.equal(publishInstant('2026-13-01', '07:00'), null);
});

test('a verified page at or before now is built', () => {
  assert.equal(evaluate(page(), { now: launch }).built, true);
  const oneMinuteEarly = parseBuildNow('2026-12-06T06:59');
  const r = evaluate(page(), { now: oneMinuteEarly });
  assert.equal(r.built, false);
  assert.deepEqual(r.reasons.map((x) => x.code), ['future']);
});

test('a draft is held, whatever its date', () => {
  const r = evaluate(page({ status: 'draft', publishDate: '2026-01-01' }), { now: launch });
  assert.equal(r.built, false);
  assert.deepEqual(r.reasons.map((x) => x.code), ['draft']);
});

test('a [TO CHECK placeholder in the body or the frontmatter holds the page', () => {
  const inBody = evaluate(page({}, 'Price [TO CHECK US retail].'), { now: launch });
  assert.equal(inBody.built, false);
  assert.equal(inBody.reasons[0].code, 'placeholder');
  const inFront = evaluate(page({ description: 'Nice [TO CHECK] text' }), { now: launch });
  assert.equal(inFront.built, false);
  const inComment = evaluate(page({}, 'Text <!-- PHOTO [TO CHECK credit] -->'), { now: launch });
  assert.equal(inComment.built, false, 'comments count too, they are part of the body');
  assert.equal(countPlaceholders(page({ h1: '[TO CHECK x]' }, '[TO CHECK a] and [TO CHECK b]')), 3);
});

test('PREVIEW builds every page but still reports why it would be held', () => {
  const r = evaluate(page({ status: 'draft', publishDate: '2027-05-01' }, '[TO CHECK]'), { now: launch, preview: true });
  assert.equal(r.built, true);
  assert.deepEqual(r.reasons.map((x) => x.code), ['draft', 'future', 'placeholder']);
});

test('partition and the held table', () => {
  const entries = [page(), page({ status: 'draft' }), { ...page({ publishDate: '2026-12-13', publishTime: '07:14' }), id: 'stones__agate' }];
  const { built, held } = partition(entries, { now: launch });
  assert.equal(built.length, 1);
  assert.equal(held.length, 2);
  const table = formatHeldTable(held, (e) => `/${e.id.replace('__', '/')}/`);
  assert.match(table, /\| Page +\| Status/);
  assert.match(table, /stones\/agate.*publishes 2026-12-13 07:14 New York/);
  assert.match(table, /status is draft/);
});
