import { NAV_GROUPS, visibleGroups, isItemActive, DEFAULT_MODE } from '../../src/lib/nav.js';
const APP_MODES = ['pokemon','areas','horde','tm','items','breeding','daycare','team','live','battle','market'];
test('every app mode has a sidebar entry', () => {
  const modes = NAV_GROUPS.flatMap(g => g.items).map(i => i.mode).filter(Boolean);
  expect(new Set(modes)).toEqual(new Set(APP_MODES));
});
test('live group is hidden without OCR', () => {
  expect(visibleGroups({ ocrSupported:false }).map(g => g.id)).not.toContain('live');
  expect(visibleGroups({ ocrSupported:true })[0].id).toBe('live');
});
test('labels match the design', () => {
  expect(NAV_GROUPS.map(g => g.label)).toEqual(['Live','Look up','My dex','Tools']);
  expect(NAV_GROUPS[1].items.map(i => i.label)).toEqual(['Pokémon','Areas','Hordes','TMs']);
});
test('active state follows mode', () => {
  const pokemon = NAV_GROUPS[1].items[0];
  expect(isItemActive(pokemon, 'pokemon')).toBe(true);
  expect(isItemActive(pokemon, 'areas')).toBe(false);
  expect(isItemActive(NAV_GROUPS[2].items[0], 'pokemon')).toBe(false);
});
test('app opens on Pokémon search', () => { expect(DEFAULT_MODE).toBe('pokemon'); });
test('item ids are unique', () => {
  const ids = NAV_GROUPS.flatMap(g => g.items).map(i => i.id);
  expect(new Set(ids).size).toBe(ids.length);
});
test('action items are never active', () => {
  const actions = NAV_GROUPS.flatMap(g => g.items).filter(i => i.action);
  expect(actions.length).toBe(5);
  for (const item of actions) for (const m of APP_MODES) expect(isItemActive(item, m)).toBe(false);
});
