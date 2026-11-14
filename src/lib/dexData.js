import dexRaw from '../../UpdatedDex.json';
import movesData from '../../data/moves.json';
import { normalizeType } from './typeChart.js';
import { normalizeKey } from './areas.js';

/* ---------- pokedex adapter ---------- */
// Build lookups to help resolve form data and skip standalone form entries
const RAW_DEX_BY_ID = new Map(dexRaw.map(m => [m.id, m]));
const FORM_IDS = new Set();
for (const mon of dexRaw) {
  if (!Array.isArray(mon.forms)) continue;
  for (const f of mon.forms) {
    if (typeof f.id === 'number' && f.id !== mon.id) {
      FORM_IDS.add(f.id);
    }
  }
}

function toLegacyShape(m){
  const types = Array.isArray(m.types) ? [...new Set(m.types.map(normalizeType))] : [];
  return {
    id: m.id,
    name: m.name,
    slug: m.slug || normalizeKey(m.name),
    types,
    expType: m.exp_type,
    obtainable: m.obtainable,
    genderRatio: m.gender_ratio,
    height: m.height,
    weight: m.weight,
    eggGroups: m.egg_groups || [],
    abilities: m.abilities || [],
    forms: [],
    evolutions: m.evolutions || [],
    moves: m.moves || [],
    stats: m.stats || {},
    yields: m.yields || {},
    heldItems: m.held_items || [],
    locations: m.locations || [],
    sprite: m.sprite ?? null,
    sprites: m.sprites ?? null,
    image: m.image ?? null,
    icon: m.icon ?? null
  };
}
const DEX_LIST = dexRaw
  .filter(m => !FORM_IDS.has(m.id))
  .map(m => {
    const base = toLegacyShape(m);
    if (Array.isArray(m.forms)) {
      base.forms = m.forms
        // Skip the base form (form_id 0 or identical name) and egg placeholders
        .filter(f => f.form_id !== 0 && f.name !== m.name && f.name?.toLowerCase() !== 'egg')
        .map(f => {
          const formBase = {
            ...(f.id != null ? RAW_DEX_BY_ID.get(f.id) : {}),
            ...f,
          };
          const raw = formBase.name || '';
          const bracket = raw.match(/\[(.+)\]/);
          let label = bracket ? bracket[1] : raw;
          label = label.replace(new RegExp(`\\b${m.name}\\b`, 'i'), '').trim();
          if (!label) return null;
          const name = `${m.name} (${label})`;
          const shaped = toLegacyShape({ ...formBase, name, forms: [] });
          shaped.id = null;
          return shaped;
        })
        .filter(Boolean);
    }
    return base;
  });
const DEX_BY_NAME = (() => {
  const map = new Map();
  for (const m of DEX_LIST) {
    map.set(normalizeKey(m.name), m);
    for (const f of m.forms || []) map.set(normalizeKey(f.name), f);
  }
  return map;
})();
const getMon = (s) => DEX_BY_NAME.get(normalizeKey(s)) || null;

const DEX_BY_ID = (() => {
  const map = new Map();
  for (const m of DEX_LIST) map.set(m.id, m);
  return map;
})();
const getMonByDex = (id) => DEX_BY_ID.get(Number(id)) || null;

const MOVES_INDEX = (() => {
  const byId = new Map();
  for (const move of movesData) {
    if (move.id != null) byId.set(move.id, move);
  }
  return { byId };
})();

const EVO_PARENTS = (() => {
  const map = new Map();
  for (const mon of DEX_LIST) {
    for (const evo of mon.evolutions || []) {
      if (!map.has(evo.id)) map.set(evo.id, []);
      map.get(evo.id).push(mon.id);
    }
  }
  return map;
})();

export { DEX_LIST, DEX_BY_NAME, getMon, DEX_BY_ID, getMonByDex, MOVES_INDEX, EVO_PARENTS };
