import { useEffect, useMemo, useState } from 'react';
import { titleCase } from './typeChart.js';
import { normalizeKey } from './areas.js';

// ---------- Nature data (PokeAPI) ----------
const NATURE_CACHE_KEY = 'nature-list-v1';
const STATIC_NATURES = [
  { name: 'Hardy' },
  { name: 'Lonely', inc: 'attack', dec: 'defense' },
  { name: 'Brave', inc: 'attack', dec: 'speed' },
  { name: 'Adamant', inc: 'attack', dec: 'special-attack' },
  { name: 'Naughty', inc: 'attack', dec: 'special-defense' },
  { name: 'Bold', inc: 'defense', dec: 'attack' },
  { name: 'Docile' },
  { name: 'Relaxed', inc: 'defense', dec: 'speed' },
  { name: 'Impish', inc: 'defense', dec: 'special-attack' },
  { name: 'Lax', inc: 'defense', dec: 'special-defense' },
  { name: 'Timid', inc: 'speed', dec: 'attack' },
  { name: 'Hasty', inc: 'speed', dec: 'defense' },
  { name: 'Serious' },
  { name: 'Jolly', inc: 'speed', dec: 'special-attack' },
  { name: 'Naive', inc: 'speed', dec: 'special-defense' },
  { name: 'Modest', inc: 'special-attack', dec: 'attack' },
  { name: 'Mild', inc: 'special-attack', dec: 'defense' },
  { name: 'Quiet', inc: 'special-attack', dec: 'speed' },
  { name: 'Bashful' },
  { name: 'Rash', inc: 'special-attack', dec: 'special-defense' },
  { name: 'Calm', inc: 'special-defense', dec: 'attack' },
  { name: 'Gentle', inc: 'special-defense', dec: 'defense' },
  { name: 'Sassy', inc: 'special-defense', dec: 'speed' },
  { name: 'Careful', inc: 'special-defense', dec: 'special-attack' },
  { name: 'Quirky' }
];
const STAT_KEY_MAP = {
  'attack': 'attack',
  'defense': 'defense',
  'special-attack': 'special_attack',
  'special-defense': 'special_defense',
  'speed': 'speed'
};
const STAT_ABBR = {
  attack: 'Atk',
  defense: 'Def',
  special_attack: 'SpA',
  special_defense: 'SpD',
  speed: 'Spe'
};

function normalizeNatureRecord(n) {
  const inc = n.inc ? STAT_KEY_MAP[n.inc] : null;
  const dec = n.dec ? STAT_KEY_MAP[n.dec] : null;
  const mods = { attack:1.0, defense:1.0, special_attack:1.0, special_defense:1.0, speed:1.0 };
  if (inc && inc !== dec) mods[inc] = 1.1;
  if (dec && inc !== dec) mods[dec] = 0.9;
  return { name: n.name, inc: inc || null, dec: dec || null, mods };
}

function labelNature(n) {
  if (!n) return '';
  const name = titleCase(n.name || '');
  if (!n.inc && !n.dec) return `${name} (+/-)`;
  const plus = n.inc ? `+${STAT_ABBR[n.inc]}` : '';
  const minus = n.dec ? `-${STAT_ABBR[n.dec]}` : '';
  let body = plus && minus ? `${plus}, ${minus}` : (plus || minus);
  return `${name} (${body})`;
}

function useNatures() {
  const [list, setList] = useState(() => {
    try {
      const cached = sessionStorage.getItem(NATURE_CACHE_KEY);
      if (cached) return JSON.parse(cached);
    } catch {}
    const statics = STATIC_NATURES
      .map(n => normalizeNatureRecord({ name: n.name, inc: n.inc || null, dec: n.dec || null }))
      .sort((a,b)=> a.name.localeCompare(b.name));
    return statics;
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('https://pokeapi.co/api/v2/nature?limit=1000');
        if (!r.ok) return;
        const d = await r.json();
        const entries = Array.isArray(d.results) ? d.results : [];
        const all = await Promise.all(entries.map(async e => {
          try {
            const rr = await fetch(e.url);
            if (!rr.ok) return null;
            const jj = await rr.json();
            const inc = jj.increased_stat?.name || null;
            const dec = jj.decreased_stat?.name || null;
            return normalizeNatureRecord({ name: e.name, inc, dec });
          } catch { return null; }
        }));
        const clean = all.filter(Boolean).sort((a,b)=> a.name.localeCompare(b.name));
        if (clean.length && alive) {
          setList(clean);
          try { sessionStorage.setItem(NATURE_CACHE_KEY, JSON.stringify(clean)); } catch{}
        }
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  const byName = useMemo(() => {
    const m = new Map();
    for (const n of list) m.set(normalizeKey(n.name), n);
    return m;
  }, [list]);

  return { list, byName };
}

export { labelNature, useNatures };
