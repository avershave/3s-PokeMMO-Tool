import { describe, expect, it } from 'vitest';
import { hubToDex, hubToHordeRegions, rarityFromPercent } from '../../scripts/overlay/hub-data.mjs';

// One Hub location row, with the fields hub-data reads.
const row = (over = {}) => ({
  form: -1,
  type: 'Grass',
  region_id: 1,
  region_name: 'Hoenn',
  location_id: 1,
  location_name: 'Route 119',
  location_name_full: 'Route 119',
  min_level: 25,
  max_level: 27,
  season: 'Spring',
  is_horde_3x: false,
  is_horde_5x: false,
  rarity_flags: 0,
  rarity_morning: '20%',
  rarity_day: '20%',
  rarity_night: '20%',
  ...over,
});
const mon = (name, locations, over = {}) => ({ id: 274, name, forms: [], locations, ...over });

describe('rarityFromPercent', () => {
  it('bands percentages into the rarity words the overlay shows', () => {
    expect(rarityFromPercent(100)).toBe('Very Common');
    expect(rarityFromPercent(40)).toBe('Very Common');
    expect(rarityFromPercent(25)).toBe('Common');
    expect(rarityFromPercent(20)).toBe('Common');
    expect(rarityFromPercent(15)).toBe('Uncommon');
    expect(rarityFromPercent(10)).toBe('Uncommon');
    expect(rarityFromPercent(5)).toBe('Rare');
    expect(rarityFromPercent(2.5)).toBe('Very Rare');
  });
});

describe('hubToDex', () => {
  it('keeps every top-level field and converts locations to the old shape', () => {
    const [m] = hubToDex([mon('Nuzleaf', [row()], { abilities: [{ name: 'Pickpocket' }] })]);
    expect(m.abilities).toEqual([{ name: 'Pickpocket' }]);
    expect(m.locations).toEqual([
      { type: 'Grass', region_id: 1, region_name: 'Hoenn', location: 'Route 119', min_level: 25, max_level: 27, rarity: 'Common' },
    ]);
  });

  it('marks hordes and keeps them apart from single encounters', () => {
    const [m] = hubToDex([mon('Nuzleaf', [row(), row({ is_horde_5x: true, rarity_flags: 1024, rarity_day: '5%' })])]);
    expect(m.locations.map(l => l.rarity)).toEqual(['Common', 'Horde']);
  });

  it('uses the most common time of day, and tags spawns missing at some times', () => {
    const [m] = hubToDex([mon('Hoothoot', [row({ rarity_morning: '--', rarity_day: '--', rarity_night: '30%' })])]);
    expect(m.locations[0].location).toBe('Route 119 (Night)');
    expect(m.locations[0].rarity).toBe('Common');
  });

  it('merges the four seasons, keeping the highest rate', () => {
    const rows = ['Spring', 'Summer', 'Autumn', 'Winter'].map((season, i) =>
      row({ season, rarity_day: `${5 + i * 5}%`, rarity_morning: '5%', rarity_night: '5%' }));
    const [m] = hubToDex([mon('Nuzleaf', rows)]);
    expect(m.locations).toHaveLength(1);
    expect(m.locations[0].rarity).toBe('Common'); // Winter's 20%
  });

  it('passes lures and specials through as words', () => {
    const [m] = hubToDex([mon('Bulbasaur', [
      row({ rarity_flags: 256, rarity_morning: 'Lure', rarity_day: 'Lure', rarity_night: 'Lure' }),
      row({ type: 'Shadow', rarity_flags: 64, rarity_morning: 'Special', rarity_day: 'Special', rarity_night: 'Special' }),
    ])]);
    expect(m.locations.map(l => [l.type, l.rarity])).toEqual([['Grass', 'Lure'], ['Shadow', 'Special']]);
  });

  it('reads Sweet Scent-only hordes as grass hordes', () => {
    const [m] = hubToDex([mon('Caterpie', [row({ type: 'Sweet Scent', is_horde_3x: true, rarity_flags: 2560 })])]);
    expect(m.locations[0]).toMatchObject({ type: 'Grass', rarity: 'Horde' });
  });

  it('uses the short place name, which is what the game shows on screen', () => {
    const [m] = hubToDex([mon('Zubat', [row({ location_name: 'Rock Tunnel', location_name_full: 'Rock Tunnel (B1F)', type: 'Cave' })])]);
    expect(m.locations[0].location).toBe('Rock Tunnel');
  });
});

describe('hubToHordeRegions', () => {
  it('lists each horde with its size, per region and place', () => {
    const data = hubToHordeRegions([
      mon('Nuzleaf', [row({ is_horde_5x: true }), row()]),
      mon('Seedot', [row({ is_horde_3x: true, location_name: 'Route 120' })]),
    ]);
    expect(data.horderegiondata).toEqual([
      {
        region: 'Hoenn',
        areas: [
          { name: 'Route 119', defaultHordeSize: 5, pokemon: [{ name: 'Nuzleaf', hordeSize: 5, method: 'grass' }] },
          { name: 'Route 120', defaultHordeSize: 3, pokemon: [{ name: 'Seedot', hordeSize: 3, method: 'grass' }] },
        ],
      },
    ]);
  });
});
