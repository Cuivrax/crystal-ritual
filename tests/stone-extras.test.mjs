// Stone page extras, the key numbers, classification chain, source map and H3 icons.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localityPins, sheetColors, autoChain, sheetProofHolds } from '../scripts/build-stone-extras.mjs';
import { allPageProofsHold } from '../src/lib/proof.mjs';
import { worldMapCard, placeLabels, project } from '../src/lib/worldmap.mjs';
import { chainHtml, formulaHtml, keyNumbersHtml } from '../src/lib/md/sections.mjs';
import { h3IconName } from '../src/lib/ui.mjs';

const verified = (value) => ({ value, verified: true, best_tier: 'reference', refs: [] });

test('map pins come from the verified localities note, parent sentences left out', () => {
  const pins = localityPins(verified('Brazil (Minas Gerais), Afghanistan, Pakistan, Madagascar, Mozambique and the United States (California and Maine). Tourmaline in general: Nigeria and Tanzania.'));
  assert.deepEqual(pins.map((p) => p.label), ['Brazil', 'Afghanistan', 'Pakistan', 'Madagascar', 'Mozambique', 'California', 'Maine']);
  // Minas Gerais gives Brazil its position, the United States pin gives way to the states.
  assert.equal(pins[0].lon, -44);
  assert.equal(pins.some((p) => p.label === 'United States'), false);
});

test('no map when the note is unverified, says no source or names nothing', () => {
  assert.equal(localityPins({ value: 'Brazil and Uruguay.', verified: false }), null);
  assert.equal(localityPins(verified('Jasper in general is found worldwide. No source gives red-jasper-specific localities.')), null);
  assert.equal(localityPins(verified('Found in many places.')), null);
  // "US border" is not a place.
  assert.deepEqual(localityPins(verified('Ojo Laguna area, northern Chihuahua, Mexico, about 120 km south of the US border.')).map((p) => p.label), ['Mexico']);
});

test('sheet proofs need a verified field', () => {
  const sheet = { identity: { what_it_is: { value: 'A supergroup with over thirty species.', verified: true, refs: [] }, colors: { value: 'Pink.', verified: false } } };
  assert.equal(sheetProofHolds(sheet, 'identity.what_it_is', 'over thirty species'), true);
  assert.equal(sheetProofHolds(sheet, 'identity.what_it_is', 'forty species'), false);
  assert.equal(sheetProofHolds(sheet, 'identity.colors', 'Pink'), false);
});

test('page proofs hold on the page text, links and emphasis flattened', () => {
  const md = 'It is a supergroup of more than 30 species, per the [International Gem Society](https://www.gemsociety.org/x). **Not** one mineral.';
  assert.equal(allPageProofsHold(md, ['supergroup of more than 30 species, per the International Gem Society', 'not one mineral']), true);
  assert.equal(allPageProofsHold(md, ['40 species']), false);
  assert.equal(allPageProofsHold(md, []), true);
});

test('automatic chain only for a plain variety of an IMA species named in a reference note', () => {
  const ima = new Map([['quartz', { name: 'Quartz', formula: 'SiO2' }], ['opal', { name: 'Opal', formula: 'SiO2·nH2O' }]]);
  const plain = { kind: 'variety', parent: 'quartz', name: 'Milky Quartz', identity: { species_or_rock: verified('Quartz, a crystalline silica mineral.') } };
  assert.deepEqual(autoChain(plain, { ima_relation: 'related (quartz)' }, ima).map((n) => n.name), ['Quartz', 'Milky Quartz']);
  const rock = { ...plain, identity: { species_or_rock: verified('Not a species. A quartz-dumortierite rock.') } };
  assert.equal(autoChain(rock, { ima_relation: 'related (quartz)' }, ima), null);
  const mineraloid = { kind: 'variety', parent: 'opal', name: 'Pink Opal', identity: { species_or_rock: verified('Opal is a mineraloid.') } };
  assert.equal(autoChain(mineraloid, { ima_relation: 'related (opal)' }, ima), null);
  const dealer = { ...plain, identity: { species_or_rock: { ...verified('Quartz.'), best_tier: 'dealer' } } };
  assert.equal(autoChain(dealer, { ima_relation: 'related (quartz)' }, ima), null);
});

test('chain and key numbers render nothing without data', () => {
  assert.equal(chainHtml(null), '');
  assert.equal(chainHtml({ nodes: [{ level: 'Species', name: 'Quartz' }] }), '');
  assert.equal(keyNumbersHtml([]), '');
  assert.equal(worldMapCard(null), '');
  assert.equal(worldMapCard([]), '');
});

test('chain shows the IMA chip, the tag and the IMA list note', () => {
  const html = chainHtml({ nodes: [{ level: 'Species', name: 'Quartz', ima: 'Quartz', formula: 'SiO2' }, { level: 'Color Variety', name: 'Amethyst', tag: 'Variety of an IMA Mineral, Quartz', dark: true }], imaNote: true }, { stoneName: 'Amethyst', imaList: 'IMA List of Minerals, July 2026' });
  assert.match(html, /IMA Mineral/);
  assert.match(html, /SiO<sub>2<\/sub>/);
  assert.match(html, /chain-arrow/);
  assert.match(html, /Mineral status from the IMA List of Minerals, July 2026/);
});

test('formulas get subscripts and charges', () => {
  assert.equal(formulaHtml('SiO2'), 'SiO<sub>2</sub>');
  assert.equal(formulaHtml('Fe2+Fe3+2O4'), 'Fe<sup>2+</sup>Fe<sup>3+</sup><sub>2</sub>O<sub>4</sub>');
  assert.equal(formulaHtml('Be3Al2(Si6O18)'), 'Be<sub>3</sub>Al<sub>2</sub>(Si<sub>6</sub>O<sub>18</sub>)');
});

test('map labels stay inside the map and the projection is degrees', () => {
  assert.deepEqual(project(-119.5, 37), { x: 60.5, y: 53 });
  const pins = [{ label: 'Afghanistan', lon: 66, lat: 34 }, { label: 'Pakistan', lon: 70, lat: 30 }, { label: 'New Zealand', lon: 172, lat: -42 }]
    .map((p) => ({ ...p, ...project(p.lon, p.lat) }));
  for (const l of placeLabels(pins)) {
    assert.ok(l.box.x >= 0 && l.box.x + l.box.w <= 360, `label inside, ${JSON.stringify(l.box)}`);
  }
  const card = worldMapCard([{ label: 'Brazil', lon: -44, lat: -18.5 }]);
  assert.match(card, /Main Sources on the Map/);
  assert.doesNotMatch(card, /Approximate positions/);
});

test('every H3 gets an icon, gem when nothing fits', () => {
  assert.equal(h3IconName('Where It Grows'), 'mountain');
  assert.equal(h3IconName('Where It Comes From'), 'pin');
  assert.equal(h3IconName('A Stone That Holds a Charge'), 'bolt');
  assert.equal(h3IconName('Pink Tourmaline or Rubellite?'), 'tag');
  assert.equal(h3IconName('Something Else Entirely'), 'gem');
});

test('the generated data follows the writing rules', () => {
  const data = JSON.parse(readFileSync(new URL('../src/data/stone_extras.json', import.meta.url), 'utf8'));
  const shown = [];
  for (const entry of Object.values(data.pages)) {
    for (const k of entry.keyNumbers || []) shown.push(k.value, k.text);
    for (const n of entry.chain?.nodes || []) shown.push(n.level, n.name, n.sub, n.tag, n.chip);
    for (const p of entry.map?.pins || []) shown.push(p.label);
  }
  for (const s of shown.filter(Boolean)) {
    assert.doesNotMatch(s, /:|—|·/, `no colon, em dash or middle dot in "${s}"`);
  }
  assert.equal(data.imaList, 'IMA List of Minerals, July 2026');
});

test('sheet colors leave out the parent sentences', () => {
  assert.equal(sheetColors(verified('Red from iron oxide. Jasper in general can come in any color.')), 'Red from iron oxide.');
  assert.equal(sheetColors({ value: 'Red.', verified: false }), null);
});
