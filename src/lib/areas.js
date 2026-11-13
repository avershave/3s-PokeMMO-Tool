// Pure area/encounter helpers shared by the desktop app and tooling.
// No React or DOM dependencies.

import { titleCase } from './typeChart.js';

// Precompute horde sizes by region and area for quick lookup
export function buildHordeSizeMap(hordeRegions) {
  const map = {};
  for (const region of hordeRegions.horderegiondata || []) {
    const rKey = region.region.toLowerCase();
    if (!map[rKey]) map[rKey] = {};
    for (const area of region.areas || []) {
      const aKey = area.name.toLowerCase();
      if (!map[rKey][aKey]) map[rKey][aKey] = {};
      const defSize = area.defaultHordeSize;
      for (const p of area.pokemon || []) {
        const pKey = p.name.toLowerCase();
        map[rKey][aKey][pKey] = p.hordeSize || defSize;
      }
    }
  }
  return map;
}

export function normalizeAreaName(area = "") {
  return String(area)
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, "")
    .trim();
}

export function stripSeason(str = "") {
  return String(str)
    // Remove SEASON# when it appears with a slash before or after
    .replace(/\/SEASON\d+/gi, "")
    .replace(/SEASON\d+\//gi, "")
    // Remove standalone (SEASON#) tags
    .replace(/\(SEASON\d+\)/gi, "")
    // Clean up empty parentheses
    .replace(/\(\s*\)/g, "")
    // Normalize whitespace
    .replace(/\s+/g, " ")
    .trim();
}

export function getHordeSize(sizeMap, region, area, name) {
  const rKey = region?.toLowerCase();
  const aKey = area?.toLowerCase();
  const pKey = name?.toLowerCase();
  return (
    sizeMap[rKey]?.[aKey]?.[pKey] ??
    sizeMap[rKey]?.[normalizeAreaName(area)]?.[pKey] ??
    null
  );
}

export function normalizeKey(s=''){
  return String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\u2640/g,'-f')
    .replace(/\u2642/g,'-m')
    .replace(/[^\w\s-]/g,'')
    .replace(/\s+/g,'-')
    .replace(/-+/g,'-')
    .trim();
}
export function normalizeRegion(r=''){ return String(r||'').toLowerCase().replace(/\s+/g,'').trim(); }

export function normalizeTimeTag(tag=''){
  const parts = String(tag).toLowerCase().split(/[\/]/).map(s=>s.trim()).filter(Boolean);
  if (!parts.length) return '';
  const order = ['morning','day','night'];
  const times = order.filter(t => parts.includes(t)).map(titleCase);
  // Ignore season tags entirely since seasonal encounters are now uniform
  const others = parts.filter(p => !order.includes(p) && !/^season\d+$/.test(p)).map(titleCase);
  const result = [...times, ...others];
  return result.join('/') || '';
}

// Balance methods like "Lure (Water" -> "Lure (Water)"
export function cleanMethodLabel(method=''){
  let m = String(method || '').trim();
  // Drop stray trailing ')' (bad source data)
  m = m.replace(/\)+$/,'');
  // Balance parentheses if needed
  const open = (m.match(/\(/g) || []).length;
  const close = (m.match(/\)/g) || []).length;
  if (open > close) m = m + ')';
  // Normalize Horde casing
  if (/^hordes?\b/i.test(m)) m = 'Horde';
  // Normalize time/season tags
  m = m.replace(/\(([^)]+)\)/g, (_, t) => {
    const norm = normalizeTimeTag(t);
    return norm ? `(${norm})` : '';
  });
  return m.trim();
}

export function rarityKey(r=''){ return String(r).toLowerCase().trim(); }
export const RARITY_ORDER = ['very common','common','uncommon','rare','very rare'];

export function selectRarest(rarities = []) {
  const unique = [...new Set(rarities)];
  const known = unique.filter(r => RARITY_ORDER.includes(rarityKey(r)));
  if (known.length > 1) {
    const rarest = known.reduce((a, b) =>
      RARITY_ORDER.indexOf(rarityKey(b)) > RARITY_ORDER.indexOf(rarityKey(a)) ? b : a
    );
    const others = unique.filter(r => !known.includes(r));
    return [rarest, ...others];
    }
  return unique;
}

export function buildLocationsIndex(dexList){
  const idx = {};
  for (const mon of dexList) {
    const key = normalizeKey(mon.name);
    const locations = [];
    const seen = new Set();
    for (const l of mon.locations || []) {
      let method = l.type;
      let rarity = l.rarity;
      // Some "Lure" encounters are stored as a rarity rather than a method.
      // Promote those to a proper method so encounter-type filters work.
      if (rarity && /lure/i.test(rarity)) {
        method = `Lure${method ? ` (${method})` : ''}`;
        rarity = '';
      }
      // Any encounter whose method is Lure should have no rarity
      if (method && /lure/i.test(method)) {
        rarity = '';
      }
      const map = stripSeason(l.location);
      const dedupeKey = [l.region_name, map, method || '', rarity || '', l.min_level ?? '', l.max_level ?? ''].join('|');
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      locations.push({
        region: l.region_name,
        map,
        method,
        rarity,
        min_level: l.min_level,
        max_level: l.max_level,
        items: (mon.heldItems || []).map(h => h.name)
      });
    }
    idx[key] = { locations };
  }
  return idx;
}

/** Cleaning helpers for Areas */
/** NOTE: now balances missing ')' */
export function cleanAreaMethod(method=''){
  return cleanMethodLabel(method);
}

/** Sanitize Areas index once at load */
export function buildAreasIndex(dexList, sizeMap){
  const out = {};
  for (const mon of dexList) {
    const items = (mon.heldItems || []).map(h => h.name);
    const seen = new Set();
    for (const loc of mon.locations || []) {
      const region = loc.region_name || 'Unknown';
      const mapName = stripSeason(loc.location);
      if (!mapName) continue;
      let method = cleanAreaMethod(loc.type || '');
      let rarity = loc.rarity || '';
      // Handle lure encounters represented as rarities in source data
      if (rarity && /lure/i.test(rarity)) {
        method = cleanAreaMethod(`Lure${method ? ` (${method})` : ''}`);
        rarity = '';
      }
      // Any encounter whose method is Lure should have no rarity
      if (method && /lure/i.test(method)) {
        rarity = '';
      }
      const key = [region, mapName, method, rarity, loc.min_level ?? '', loc.max_level ?? ''].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const entry = {
        monId: mon.id,
        monName: mon.name,
        method,
        rarity,
        min: loc.min_level,
        max: loc.max_level,
        items,
      };
      const hSize = getHordeSize(sizeMap, region, mapName, mon.name);
      if (hSize) entry.hordeSize = hSize;
      if (!out[region]) out[region] = {};
      if (!out[region][mapName]) out[region][mapName] = [];
      out[region][mapName].push(entry);
    }
  }
  return out;
}

/** Group same Pokemon (per map) into one entry with multiple methods/rarities */
export function groupEntriesByMon(entries){
  const byId = new Map();

  const splitMethod = (m='') => {
    const clean = cleanMethodLabel(m);
    const match = clean.match(/^(.*?)(?:\s*\(([^()]+)\))?$/);
    const base = match ? match[1].trim() : clean;
    const time = match && match[2] ? normalizeTimeTag(match[2]) : '';
    return { base, time };
  };

  const mergeEnc = (into, from) => {
    from.rarities.forEach(r => into.rarities.add(r));
    if (from.min != null) into.min = into.min==null ? from.min : Math.min(into.min, from.min);
    if (from.max != null) into.max = into.max==null ? from.max : Math.max(into.max, from.max);
    from.items.forEach(i => into.items.add(i));
    if (from.hordeSize != null && into.hordeSize == null) into.hordeSize = from.hordeSize;
  };

  for (const e of entries){
    if (!byId.has(e.monId)){
      byId.set(e.monId, { monId:e.monId, monName:e.monName, methods:new Map() });
    }
    const g = byId.get(e.monId);
    const { base, time } = splitMethod(e.method);
    const key = base.toLowerCase();
    if (!g.methods.has(key)) g.methods.set(key, new Map());
    const timeMap = g.methods.get(key);
    const tKey = time || '';
    if (!timeMap.has(tKey)){
      timeMap.set(tKey, { method: base, time, rarities:new Set(), min:e.min, max:e.max, items:new Set(e.items || []), hordeSize:e.hordeSize });
    }
    const enc = timeMap.get(tKey);
    if (e.rarity) enc.rarities.add(e.rarity);
    if (e.min != null) enc.min = enc.min==null ? e.min : Math.min(enc.min, e.min);
    if (e.max != null) enc.max = enc.max==null ? e.max : Math.max(enc.max, e.max);
    if (Array.isArray(e.items)) e.items.forEach(i => enc.items.add(i));
    if (e.hordeSize != null && enc.hordeSize == null) enc.hordeSize = e.hordeSize;
  }

  return [...byId.values()].map(g => {
    const encounters = [];
    for (const timeMap of g.methods.values()) {
      const baseEnc = timeMap.get('');
      if (baseEnc && timeMap.size > 1) {
        for (const [tKey, enc] of timeMap) {
          if (tKey === '') continue;
          mergeEnc(enc, baseEnc);
        }
        timeMap.delete('');
      }
      const encs = [...timeMap.values()];
      if (encs.length > 1) {
        const combo = { method: encs[0].method, timeSet: new Set(), rarities: new Set(), min:null, max:null, items:new Set() };
        for (const enc of encs) {
          if (enc.time) combo.timeSet.add(enc.time);
          mergeEnc(combo, enc);
        }
        const label = `${combo.method} (${[...combo.timeSet].join('/')})`;
        encounters.push({
          method: label,
          rarities: selectRarest([...combo.rarities]),
          min: combo.min,
          max: combo.max,
          items: [...combo.items],
          hordeSize: combo.hordeSize
        });
      } else {
        for (const enc of encs) {
          const label = enc.time ? `${enc.method} (${enc.time})` : enc.method;
          encounters.push({
            method: label,
            rarities: selectRarest([...enc.rarities]),
            min: enc.min,
            max: enc.max,
            items: [...enc.items],
            hordeSize: enc.hordeSize
          });
        }
      }
    }
    return { monId:g.monId, monName:g.monName, encounters };
  });
}

/* Normalize map names for grouping (Sinnoh Victory Road unification & split routes) */
export function normalizeMapForGrouping(region, mapName){
  const r = String(region).toLowerCase().trim();
  let m = String(mapName).trim();

  // Additional normalization for mis-encoded "Pok�mon" variants
  // e.g., "POK\u00C3\u00A9MON" (POKéMON), "Pok\u00C3\u00A9mon" (Pokémon)
  m = m
    .replace(/POK\u00C3\u00A9MON/gi, 'Pokemon')
    .replace(/Pok\u00C3\u00A9mon/gi, 'Pokemon');

  // Standardize casing for common maps
  m = m
    .replace(/^Pokemon\s+Mansion\b/i, 'Pokemon Mansion')
    .replace(/^Pokemon\s+Tower\b/i, 'Pokemon Tower');

  // Normalize mis-encoded/diacritic variants of "Pokemon"
  // Examples: "Pok�mon", "POKéMON" ? "Pokemon"
  m = m
    .replace(/Pok(?:e|\u00e9|\u00c9)mon/gi, 'Pokemon')
    .replace(/POKéMON/gi, 'Pokemon')
    .replace(/Pokémon/gi, 'Pokemon');

  // Merge halves like "Route 212 (North)" / "(South)" -> "Route 212"
  if (/^route\s*\d+\b/i.test(m)) {
    m = m.replace(/\s*\((north|south|east|west)\)\s*/i, '').trim();
  }

  if (r === 'sinnoh' && /victory\s*road/i.test(m)) {
    return 'Victory Road';
  }
  return m;
}

// Extract trailing time-of-day tag like "(Night)" from map name
export function extractTimeTag(name=''){
  const m = String(name).match(/\(((?:Morning|Day|Night|Season\d+)(?:\/(?:Morning|Day|Night|Season\d+))*)\)\s*$/i);
  return m ? m[1] : '';
}

// Remove trailing time-of-day/season tag from map name
export function stripTimeTag(name=''){
  return String(name).replace(/\s*\(((?:Morning|Day|Night|Season\d+)(?:\/(?:Morning|Day|Night|Season\d+))*)\)\s*$/i, '').trim();
}

// Determine if two map names should be considered a match.
// - Queries like "Route <number>" or "<number>" only match the exact same route number
// - Partial queries like "r", "ro", "route" etc. never match anything
// - Bare "Route" queries (with or without trailing spaces) never match anything
// - Otherwise fall back to a simple substring check (case-insensitive)
export function mapNameMatches(candidate, needle){
  const candRaw   = stripTimeTag(candidate).toLowerCase();
  const searchRaw = stripTimeTag(needle).toLowerCase();

  // If the search is a prefix of "route", do not match yet
  if ('route'.startsWith(searchRaw)) return false;

  // If the query starts with "<number>" or "route <number>", require that exact
  // route number regardless of any trailing OCR noise.
  const routeMatch = searchRaw.match(/^(?:route\s*)?(\d+)\b/);
  if (routeMatch) {
    const candRoute = candRaw.match(/^route\s*(\d+)\b/);
    return !!candRoute && Number(candRoute[1]) === Number(routeMatch[1]);
  }
  // Avoid extremely short non-route queries from matching multiple maps
  if (searchRaw.length < 3) return false;

  if (searchRaw.startsWith('route')) return false;

  // Alias/diacritic-insensitive comparison using simplify/alias keys
  const candKey   = aliasKey(candRaw);
  const searchKey = aliasKey(searchRaw);
  if (candKey.includes(searchKey)) return true;

  // Fallback to raw substring match
  return candRaw.includes(searchRaw);
}

export function lookupRarity(monName, region, map, locIndex){
  const entry = locIndex[normalizeKey(monName)];
  if (!entry) return '';
  const regNorm = normalizeRegion(region);
  const mapNorm = stripTimeTag(normalizeMapForGrouping(region, map));
  for (const loc of entry.locations || []) {
    if (normalizeRegion(loc.region) === regNorm &&
        stripTimeTag(normalizeMapForGrouping(loc.region, loc.map)) === mapNorm &&
        loc.rarity) {
      return loc.rarity;
    }
  }
  return '';
}

/* ======================= LIVE ROUTE MATCHING ======================= */

/** Known alias fixes (expand as needed) — keys and values are compared after simplifyName(). */
export const LIVE_ALIASES = {
  "oreburghcity": "oreburghcity",
  "jubilifecity": "jubilifecity",
  "mtcoronet": "mountcoronet",
  "mtcoronet4f": "mountcoronet",
  "victoryroad": "victoryroad",
  // Handle accented/mis-encoded forms of Pokeathlon Dome from OCR
  // simplifyName("Pok�athlon Dome") -> "pokathlondome"
  // simplifyName("Pokéathlon Dome") -> "pokathlondome"
  // simplifyName("Pokeathlon Dome") -> "pokeathlondome"
  "pokathlondome": "pokeathlondome",
  // Handle mis-encoded 'Pok�mon' dropping the 'e' in certain names
  "pokmonmansion": "pokemonmansion",
  "pokmontower": "pokemontower",
};

/** Turn a name into a minimal comparable key */
export function simplifyName(s='') {
  return String(s)
    .replace(/\s+Ch\.?\s*\d+\b/ig, '')
    .replace(/\$[\d,\.]+/g, '')
    .replace(/\b(Sun|Mon|Tue|Tues|Wed|Thu|Thur|Fri|Sat|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/ig, '')
    .replace(/\b\d{1,2}:\d{2}\b/g, '')
    .replace(/\bmt\.?\b/ig, 'mount')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\b(?:b\d+f|\d+f)\b/ig, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b(city|town|forest|cave|road|gate|outside|inside|entrance|exit)\b/g, '')
    .replace(/\s+/g, '');
}

/**
 * Tokenize a name into cleaned, lowercased words without stripping generic
 * location suffixes.  Used for disambiguating cases like "Eterna Forest"
 * vs. "Eterna City" where aliasKey() would otherwise collapse both to
 * the same key.
 */
export function tokenizeName(s='') {
  return String(s)
    .replace(/\s+Ch\.?\s*\d+\b/ig, '')
    .replace(/\$[\d,\.]+/g, '')
    .replace(/\b(Sun|Mon|Tue|Tues|Wed|Thu|Thur|Fri|Sat|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/ig, '')
    .replace(/\b\d{1,2}:\d{2}\b/g, '')
    .replace(/\bmt\.?\b/ig, 'mount')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\b(?:b\d+f|\d+f)\b/ig, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

export function aliasKey(s='') {
  const key = simplifyName(s);
  if (LIVE_ALIASES[key]) return LIVE_ALIASES[key];
  return key;
}

/** Score similarity using token overlap & contains/startsWith bonuses */
export function scoreNames(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 100;

  const routeA = a.match(/(?:^|\b)route\s*(\d+)/);
  const routeB = b.match(/(?:^|\b)route\s*(\d+)/);
  if (routeA && routeB && routeA[1] !== routeB[1]) return 0;

  let score = 0;
  if (a.startsWith(b) || b.startsWith(a)) score += 25;
  if (a.includes(b) || b.includes(a))   score += 20;
  const numsA = (a.match(/\d+/g) || []).join(',');
  const numsB = (b.match(/\d+/g) || []).join(',');
  if (numsA && numsA === numsB) score += 30;
  if (a.includes(' ') && b.includes(' ')) {
    const lenRatio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
    score += Math.round(lenRatio * 15);
  }
  return score;
}

/** Find best map match across regions; returns { region, displayMap } or null. */
export function findBestMapName(hudText, areasIndex){
  if (!hudText) return null;
  const raw = String(hudText).trim();
  // Avoid treating "Route" with no number as a fuzzy search
  if (/^route\b(?!\s*\d)/i.test(raw)) return null;
  const isRoute = /^route\s*\d+/i.test(raw) || /^\d+$/.test(raw);
  // Require a minimum of three alphanumeric characters for non-route searches
  if (!isRoute && raw.replace(/[^a-z0-9]+/ig, '').length < 3) return null;
  if (!isRoute) {
    const words = raw.split(/\s+/);
    if (/^mt\.?$/i.test(words[0])) {
      const next = words[1] || '';
      if (next.replace(/[^a-z]/ig, '').length < 3) return null;
    }
  }
  const needleKey = isRoute ? raw.toLowerCase() : aliasKey(raw);
  const needleTokens = tokenizeName(raw);
  const needleFull = needleTokens.join(' ');
  const routeNeedle = isRoute
    ? needleKey.match(/^(?:route\s*)?(\d+)\b/)
    : needleKey.match(/(?:^|\b)route(\d+)\b/);
  let best = null, bestScore = -1;
  for (const [region, maps] of Object.entries(areasIndex || {})) {
    for (const [mapName] of Object.entries(maps || {})) {
      if (isRoute) {
        if (!mapNameMatches(mapName, raw)) continue;
        return { region, displayMap: normalizeMapForGrouping(region, mapName), rawMap: mapName };
      }
      const candidateKey = aliasKey(mapName);
      const candTokens = tokenizeName(mapName);
      if (
        needleTokens.length > 1 &&
        candTokens.length > 1 &&
        candTokens[0] === needleTokens[0] &&
        candTokens[1] !== needleTokens[1]
      ) {
        continue;
      }
      const candFull = candTokens.join(' ');
      if (routeNeedle) {
        const routeCand = candidateKey.match(/(?:^|\b)route(\d+)\b/);
        if (!routeCand || routeCand[1] !== routeNeedle[1]) continue;
      }
      let exact = candidateKey === needleKey;
      if (exact && needleTokens.length > 1 && candTokens.length > 1 && needleTokens[1] !== candTokens[1]) {
        exact = false;
      }
      if (exact) {
        const s = 100;
        if (
          s > bestScore ||
          (s === bestScore && mapName.length < (best?.rawMap.length || Infinity))
        ) {
          bestScore = s;
          best = {
            region,
            displayMap: normalizeMapForGrouping(region, mapName),
            rawMap: mapName,
            score: s,
          };
        }
        continue;
      }
      const s = scoreNames(candFull, needleFull);
      if (s > bestScore) {
        bestScore = s;
        best = { region, displayMap: normalizeMapForGrouping(region, mapName), rawMap: mapName, score: s };
      }
    }
  }
  if (best && best.score >= 35) return best;
  return null;
}

/**
 * Given raw HUD text, strip any leading garbage and try to locate a
 * known map name.  Returns { cleaned, best } where `cleaned` is the
 * matched substring and `best` is the map match (or null).
 */
export function findBestMapInText(text, areasIndex){
  const words = String(text).split(/\s+/);
  let bestMatch = null;
  let bestClean = text;
  let bestScore = -1;
  for (let i = 0; i < words.length; i++) {
    const candidate = words.slice(i).join(' ');
    const match = findBestMapName(candidate, areasIndex);
    if (match) {
      const s = scoreNames(aliasKey(match.rawMap), aliasKey(candidate));
      if (s > bestScore) { bestScore = s; bestMatch = match; bestClean = candidate; }
    }
  }
  return { cleaned: bestClean, best: bestMatch };
}

/* ---------- Region candidates + helpers ---------- */
export function listRegionCandidates(areasIndex, displayMap){
  const out = [];
  for (const [region, maps] of Object.entries(areasIndex || {})) {
    for (const [mapName] of Object.entries(maps || {})) {
      const norm = normalizeMapForGrouping(region, mapName);
      if (mapNameMatches(norm, displayMap)) { out.push(region); break; }
    }
  }
  return [...new Set(out)];
}
export function buildGroupedEntries(areasIndex, displayMap, regionFilter, locIndex, methodFilters = new Set()){
  const merged = [];
  for (const [reg, maps] of Object.entries(areasIndex || {})) {
    if (regionFilter && reg !== regionFilter) continue;
    for (const [mapName, list] of Object.entries(maps || {})) {
      const norm = normalizeMapForGrouping(reg, mapName);
      if (mapNameMatches(norm, displayMap)) {
        const time = extractTimeTag(norm).toLowerCase();
        const adjusted = time
          ? (list || []).map(e => ({ ...e, method: e.method ? `${e.method} (${time})` : `(${time})` }))
          : (list || []);
        merged.push(...adjusted);
      }
    }
  }
  let grouped = groupEntriesByMon(merged).map(g => {
    const fallback = regionFilter
      ? lookupRarity(g.monName, regionFilter, stripTimeTag(displayMap), locIndex)
      : null;
    g.encounters.forEach(enc => {
      if (!enc.rarities.length && fallback) enc.rarities.push(fallback);
    });
    return g;
  });
  if (methodFilters && methodFilters.size) {
    grouped = grouped
      .map(g => ({
        ...g,
        encounters: g.encounters.filter(enc => {
          const method = (enc.method || '').toLowerCase();
          const rarities = (enc.rarities || []).map(r => r.toLowerCase());
          const filters = Array.from(methodFilters).map(f => String(f).toLowerCase());
          // Lure encounters should only appear when the 'Lure' filter is active,
          // even if the method string contains additional tags like '(Water)'.
          if (/lure/.test(method) || rarities.some(r => /lure/.test(r))) {
            return filters.includes('lure');
          }
          return filters.some(fL => method.includes(fL) || rarities.some(r => r.includes(fL)));
        })
      }))
      .filter(g => g.encounters.length);
  }
  return grouped;
}
