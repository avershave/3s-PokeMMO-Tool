import fs from 'node:fs';
import path from 'node:path';
import { DEX_LIST } from '../../src/lib/dex.js';
import { aliasKey } from '../../src/lib/areas.js';
import { buildOverlayData } from '../../scripts/overlay/build-overlay-data.mjs';

const root = path.resolve(__dirname, '../..');
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));

function inputs() {
  return {
    dexList: DEX_LIST,
    hordeRegions: readJson('horderegiondata.json'),
    catchRates: readJson('data/catch-rates.json'),
    tagInputs: {
      smogon: readJson('tags/smogon-gen5.json'),
      utilityRules: readJson('tags/utility-rules.json'),
      explanations: readJson('tags/explanations.json'),
      story: readJson('tags/story.json'),
      tips: readJson('tags/tips.json'),
      version: readJson('tags/version.json'),
    },
  };
}

const out = buildOverlayData(inputs());

test('Kanto Route 5 exists with key route5 and ids 52, 63', () => {
  const a = out.areas.areas.find(x => x.region === 'Kanto' && x.name === 'Route 5');
  expect(a).toBeTruthy();
  expect(a.key).toBe('route5');
  const ids = a.spawns.map(s => s.id);
  expect(ids).toContain(52);
  expect(ids).toContain(63);
});

test('no junk spawn names', () => {
  for (const a of out.areas.areas) {
    for (const s of a.spawns) {
      expect(s.name.startsWith('And ')).toBe(false);
      expect(s.name.includes(')')).toBe(false);
    }
  }
});

test('Ursaring data', () => {
  const p = out.pokemon.pokemon.find(x => x.id === 217);
  expect(p.weak2).toEqual(['Fighting']);
  expect(p.weak4).toEqual([]);
  expect(p.catchRate).toBe(60);
  expect(p.evYield).toEqual({ atk: 2 });
  expect(p.types).toEqual(['Normal']);
});

test('pokemon ids are 1..649 only; mono-type Abra not 4x', () => {
  const ids = out.pokemon.pokemon.map(p => p.id);
  expect(Math.max(...ids)).toBeLessThanOrEqual(649);
  expect(ids.every(i => Number.isInteger(i) && i >= 1)).toBe(true);
  const abra = out.pokemon.pokemon.find(p => p.id === 63);
  expect(abra.types).toEqual(['Psychic']);
  expect(abra.weak4).toEqual([]);
  expect(abra.heldItems).toEqual(['TwistedSpoon']);
});

test('alias fixtures keys match aliasKey and include OCR inputs', () => {
  for (const f of out.aliasFixtures) expect(f.key).toBe(aliasKey(f.input));
  const inputs = out.aliasFixtures.map(f => f.input);
  for (const s of ['Ecruteak City CITY · CH 1', 'Vermilion City INSIDE · CH 1', 'Mt. Coronet 4F', 'Route 212 (North)']) {
    expect(inputs).toContain(s);
  }
  expect(inputs).toContain('Route 5');
});

test('tags: Abra carries Alakazam pvp tag', () => {
  const sm = readJson('tags/smogon-gen5.json');
  const has = ['ou', 'uu', 'ru', 'nu'].some(t => (sm[t] || []).includes('Alakazam'));
  if (!has) { console.warn('Alakazam not in smogon snapshot; skipping'); return; }
  const t = out.tags.pokemon['63'].find(x => x.kind === 'pvp');
  expect(t.viaName).toBe('Alakazam');
});

test('tags.generatedAt comes from version.json', () => {
  expect(out.tags.generatedAt).toBe(readJson('tags/version.json').generatedAt);
  expect(out.tags.schemaVersion).toBe(1);
});

test('every tags.pokemon key is within 1..649 and matches pokemon.json', () => {
  const keys = Object.keys(out.tags.pokemon).map(Number);
  expect(keys.every(k => Number.isInteger(k) && k >= 1 && k <= 649)).toBe(true);
  const ids = new Set(out.pokemon.pokemon.map(p => p.id));
  expect(keys.every(k => ids.has(k))).toBe(true);
});

test('no base mon evolves into an id above 649 (filtering dex is safe)', () => {
  for (const m of DEX_LIST) {
    if (m.id > 649) continue;
    for (const e of m.evolutions || []) expect(e.id).toBeLessThanOrEqual(649);
  }
});

test('deterministic', () => {
  expect(JSON.stringify(buildOverlayData(inputs()))).toBe(JSON.stringify(out));
});
