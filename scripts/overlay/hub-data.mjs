// Converts PokeMMO Hub's monster.json (github.com/PokeMMO-Tools/pokemmo-hub, src/data/pokemmo,
// credited there to Yibu's dataset) into the shapes the overlay build already reads:
// UpdatedDex.json entries and horderegiondata.json. Hub has per-season, per-time-of-day rates and
// horde flags from after PokeMMO's 2026 encounter-table change. For personal builds only; the
// result is never committed (see fetch-hub.mjs).

const TIMES = [['Morning', 'rarity_morning'], ['Day', 'rarity_day'], ['Night', 'rarity_night']];

/** Hub gives percentages; the overlay shows the in-game style words. */
export function rarityFromPercent(p) {
  if (p >= 40) return 'Very Common';
  if (p >= 20) return 'Common';
  if (p >= 10) return 'Uncommon';
  if (p >= 5) return 'Rare';
  return 'Very Rare';
}

const isHorde = (l) => l.is_horde_3x || l.is_horde_5x;

// "Sweet Scent" rows are hordes that only appear with Sweet Scent, in grass.
const methodOf = (l) => (l.type === 'Sweet Scent' ? 'Grass' : l.type);

function kindOf(l) {
  if (isHorde(l)) return 'Horde';
  const values = TIMES.map(([, k]) => l[k]);
  if (values.includes('Lure')) return 'Lure';
  if (values.includes('Special')) return 'Special';
  return null;
}

const percent = (v) => {
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
};

/**
 * Hub entries -> UpdatedDex.json entries. Seasons are merged: one location per place, method,
 * level range and kind, with the highest rate seen and the times of day it appears in any season.
 * For one season's spawns, pass the result of [hubForSeason].
 */
export function hubToDex(hub) {
  return hub.map((m) => {
    const groups = new Map();
    for (const l of m.locations || []) {
      const kind = kindOf(l);
      const key = [l.region_name, l.location_name, methodOf(l), l.min_level, l.max_level, kind].join('|');
      let g = groups.get(key);
      if (!g) {
        g = { l, kind, times: new Set(), best: 0 };
        groups.set(key, g);
      }
      for (const [time, k] of TIMES) {
        if (l[k] === '--') continue;
        g.times.add(time);
        const p = percent(l[k]);
        if (p != null && p > g.best) g.best = p;
      }
    }
    const locations = [...groups.values()].map(({ l, kind, times, best }) => {
      const partial = times.size > 0 && times.size < TIMES.length;
      const tag = partial ? ` (${TIMES.map(([t]) => t).filter((t) => times.has(t)).join('/')})` : '';
      return {
        type: methodOf(l),
        region_id: l.region_id,
        region_name: l.region_name,
        location: l.location_name + tag,
        min_level: l.min_level,
        max_level: l.max_level,
        rarity: kind ?? rarityFromPercent(best),
      };
    });
    return { ...m, locations };
  });
}

/** Hub entries -> horderegiondata.json, from the horde flags. */
export function hubToHordeRegions(hub) {
  const regions = new Map();
  for (const m of hub) {
    for (const l of m.locations || []) {
      if (!isHorde(l)) continue;
      const size = l.is_horde_5x ? 5 : 3;
      if (!regions.has(l.region_name)) regions.set(l.region_name, new Map());
      const areas = regions.get(l.region_name);
      if (!areas.has(l.location_name)) areas.set(l.location_name, new Map());
      const mons = areas.get(l.location_name);
      const prev = mons.get(m.name);
      if (!prev || size > prev.hordeSize) {
        mons.set(m.name, { name: m.name, hordeSize: size, method: methodOf(l).toLowerCase() });
      }
    }
  }
  return {
    horderegiondata: [...regions].map(([region, areas]) => ({
      region,
      areas: [...areas].map(([name, mons]) => {
        const pokemon = [...mons.values()];
        return { name, defaultHordeSize: mostCommonSize(pokemon), pokemon };
      }),
    })),
  };
}

export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];

/** Hub entries with only the rows found in [season] (plus the all-year "Any" rows). */
export function hubForSeason(hub, season) {
  return hub.map((m) => ({
    ...m,
    locations: (m.locations || []).filter((l) => l.season === season || l.season === 'Any'),
  }));
}

/**
 * Adds `seasons: {Spring: spawns, ...}` to each area of [areas] (built from every season) whose
 * spawns differ between seasons. [bySeason] holds an areas file built from each season alone.
 * Areas that are the same all year get no `seasons`, which keeps the file small.
 */
export function attachSeasons(areas, bySeason) {
  const index = Object.fromEntries(SEASONS.map((s) => [
    s, new Map((bySeason[s]?.areas || []).map((a) => [`${a.region}|${a.name}`, a.spawns])),
  ]));
  return {
    ...areas,
    areas: areas.areas.map((a) => {
      const id = `${a.region}|${a.name}`;
      const seasons = Object.fromEntries(SEASONS.map((s) => [s, index[s].get(id) || []]));
      const lists = SEASONS.map((s) => JSON.stringify(seasons[s]));
      return lists.every((l) => l === lists[0]) ? a : { ...a, seasons };
    }),
  };
}

function mostCommonSize(pokemon) {
  const fives = pokemon.filter((p) => p.hordeSize === 5).length;
  return fives * 2 >= pokemon.length ? 5 : 3;
}
