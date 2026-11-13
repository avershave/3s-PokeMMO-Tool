import { aliasKey, normalizeMapForGrouping, mapNameMatches, buildAreasIndex, buildHordeSizeMap,
         buildLocationsIndex, buildGroupedEntries } from '../../src/lib/areas.js';
import { DEX_LIST } from '../../src/lib/dex.js';
import hordeRegions from '../../horderegiondata.json';
test('aliasKey strips suffixes and channel', () => {
  expect(aliasKey('Ecruteak City Ch 1')).toBe('ecruteak');
  expect(aliasKey('Mt. Coronet')).toBe('mountcoronet');
});
test('split routes merge', () => expect(normalizeMapForGrouping('Sinnoh','Route 212 (North)')).toBe('Route 212'));
test('route numbers match exactly', () => {
  expect(mapNameMatches('Route 5', 'Route 5')).toBe(true);
  expect(mapNameMatches('Route 50', 'Route 5')).toBe(false);
});
test('Kanto Route 5 contains Meowth (Grass) and Abra', () => {
  const idx = buildAreasIndex(DEX_LIST, buildHordeSizeMap(hordeRegions));
  const loc = buildLocationsIndex(DEX_LIST);
  const g = buildGroupedEntries(idx, 'ROUTE 5', 'Kanto', loc);
  const names = g.map(x => x.monName);
  expect(names).toContain('Meowth'); expect(names).toContain('Abra');
  expect(g.find(x => x.monName === 'Meowth').encounters.some(e => /grass/i.test(e.method))).toBe(true);
});
