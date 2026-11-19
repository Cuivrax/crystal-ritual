// The avoid rating names its test, the other ratings keep their labels.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ratingLabel } from '../src/lib/ui.mjs';

test('avoid labels by test', () => {
  assert.equal(ratingLabel('avoid', 'water'), 'Keep Dry');
  assert.equal(ratingLabel('avoid', 'Water safe'), 'Keep Dry');
  assert.equal(ratingLabel('avoid', 'soak'), 'No Soaking');
  assert.equal(ratingLabel('avoid', 'Long Soak'), 'No Soaking');
  assert.equal(ratingLabel('avoid', 'sun'), 'Keep Out of Sun');
  assert.equal(ratingLabel('avoid', 'Sun & UV'), 'Keep Out of Sun');
  assert.equal(ratingLabel('avoid', 'salt'), 'No Salt');
  assert.equal(ratingLabel('avoid', 'heat'), 'Keep Away From Heat');
  assert.equal(ratingLabel('avoid', 'chemicals'), 'No Chemicals');
  assert.equal(ratingLabel('avoid', 'Cleaning Machines'), 'No Ultrasonic or Steam');
});

test('other ratings keep their labels', () => {
  assert.equal(ratingLabel('ok', 'water'), 'OK');
  assert.equal(ratingLabel('brief_only', 'sun'), 'Brief Only');
  assert.equal(ratingLabel('unknown', 'salt'), 'Not Enough Data');
  assert.equal(ratingLabel('avoid', ''), 'Avoid');
});
