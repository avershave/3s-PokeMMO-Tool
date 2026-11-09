// Pure tag engine for the Android overlay. No I/O: callers pass content in.
// Works with src/lib/dex.js DEX_LIST entries and with raw UpdatedDex.json entries
// (only id, name, abilities, moves, evolutions, yields are read).

const TIERS = ['ou', 'uu', 'ru', 'nu'];
const EV_LABELS = [
  ['ev_hp', 'HP'],
  ['ev_attack', 'Atk'],
  ['ev_defense', 'Def'],
  ['ev_sp_attack', 'Sp. Atk'],
  ['ev_sp_defense', 'Sp. Def'],
  ['ev_speed', 'Spe'],
];

// Case- and punctuation-insensitive key ("Mr. Mime" == "mr mime" == "MrMime").
function nameKey(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Transitive evolutions in breadth-first order, cycle-safe.
export function descendants(dexById, id) {
  const out = [];
  const seen = new Set([id]);
  const queue = [id];
  while (queue.length) {
    const cur = dexById.get(queue.shift());
    for (const e of cur?.evolutions || []) {
      if (typeof e.id !== 'number' || seen.has(e.id)) continue;
      seen.add(e.id);
      out.push(e.id);
      queue.push(e.id);
    }
  }
  return out;
}

export function hasOutline(tags) {
  // PvP only counts for OU/UU (own or carried down); RU/NU still show on the card.
  return tags.some(t => (t.kind === 'pvp' && (t.tier === 'ou' || t.tier === 'uu')) || t.kind === 'story' || t.kind === 'utility');
}

function evSummary(yields) {
  const parts = [];
  for (const [field, label] of EV_LABELS) {
    const n = Number(yields?.[field]) || 0;
    if (n > 0) parts.push(`+${n} ${label}`);
  }
  return parts.join(', ');
}

export function buildTags({ dex, smogon = {}, utilityRules = [], explanations = {}, story = { entries: [] }, tips = {} }) {
  const warnings = [];
  const dexById = new Map();
  const idByName = new Map();
  for (const m of dex) {
    if (typeof m.id !== 'number') continue;
    dexById.set(m.id, m);
    const k = nameKey(m.name);
    if (!idByName.has(k)) idByName.set(k, m.id);
  }

  // id -> best (lowest index) tier
  const tierById = new Map();
  TIERS.forEach((tier, idx) => {
    for (const name of smogon[tier] || []) {
      const id = idByName.get(nameKey(name));
      if (id === undefined) {
        warnings.push(`Smogon ${tier.toUpperCase()} species not found in dex: ${name}`);
        continue;
      }
      if (!tierById.has(id) || tierById.get(id) > idx) tierById.set(id, idx);
    }
  });

  const storyById = new Map();
  for (const e of story?.entries || []) storyById.set(e.id, e);

  const warnedMissing = new Set();
  const explain = key => {
    const ex = explanations[key];
    if (!ex && !warnedMissing.has(key)) {
      warnedMissing.add(key);
      warnings.push(`Missing explanation for ${key}`);
    }
    return ex;
  };

  const rules = utilityRules.map(r => ({
    ...r,
    abilityKey: r.ability ? nameKey(r.ability) : null,
    moveKey: r.levelMove ? nameKey(r.levelMove) : null,
  }));

  const pokemon = {};
  for (const mon of dex) {
    if (typeof mon.id !== 'number') continue;
    const desc = descendants(dexById, mon.id);
    const tags = [];

    // PvP: own tier, else best descendant tier (ties: first found).
    let pvpId = null;
    let pvpTier = tierById.has(mon.id) ? tierById.get(mon.id) : null;
    if (pvpTier !== null) pvpId = mon.id;
    else {
      for (const d of desc) {
        if (tierById.has(d) && (pvpTier === null || tierById.get(d) < pvpTier)) {
          pvpTier = tierById.get(d);
          pvpId = d;
        }
      }
    }
    if (pvpTier !== null) {
      const ex = explain('pvp.smogon');
      const tag = { kind: 'pvp', key: 'pvp.smogon', summary: `Smogon Gen 5 ${TIERS[pvpTier].toUpperCase()}`, tier: TIERS[pvpTier] };
      if (ex?.body) tag.body = ex.body;
      if (pvpId !== mon.id) {
        tag.via = pvpId;
        tag.viaName = dexById.get(pvpId).name;
      }
      tags.push(tag);
    }

    // Story: own entry, else first descendant with one.
    const storyId = storyById.has(mon.id) ? mon.id : desc.find(d => storyById.has(d));
    if (storyId !== undefined) {
      const e = storyById.get(storyId);
      const tag = { kind: 'story', key: 'story', summary: e.summary };
      if (e.body) tag.body = e.body;
      if (storyId !== mon.id) {
        tag.via = storyId;
        tag.viaName = dexById.get(storyId).name;
      }
      tags.push(tag);
    }

    // Utility: own abilities (slots 0-1 regular, 2 hidden) and level-up moves. Catalogue order.
    const abilities = mon.abilities || [];
    const regular = new Set(abilities.slice(0, 2).map(a => nameKey(a?.name)));
    const hidden = abilities[2] ? nameKey(abilities[2].name) : null;
    const levelMoves = new Set((mon.moves || []).filter(m => m.type === 'level').map(m => nameKey(m.name)));
    for (const r of rules) {
      let hiddenOnly = false;
      let match = false;
      if (r.abilityKey) {
        if (regular.has(r.abilityKey)) match = true;
        else if (hidden === r.abilityKey) match = hiddenOnly = true;
      } else if (r.moveKey) {
        match = levelMoves.has(r.moveKey);
      }
      if (!match) continue;
      const ex = explain(r.key);
      if (!ex) continue;
      const tag = { kind: 'utility', key: r.key, summary: hiddenOnly ? `${ex.summary} (Hidden Ability)` : ex.summary };
      if (ex.body) tag.body = ex.body;
      tags.push(tag);
    }

    // EV yield.
    const evs = evSummary(mon.yields);
    if (evs) {
      const ex = explain('ev');
      const tag = { kind: 'ev', key: 'ev', summary: evs };
      if (ex?.body) tag.body = ex.body;
      tags.push(tag);
    }

    pokemon[mon.id] = tags;
  }

  return { pokemon, tips, warnings };
}
