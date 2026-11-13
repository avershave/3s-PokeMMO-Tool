// Generates the data bundle consumed by the Android overlay app.
// buildOverlayData is pure; main() does the I/O (run via `npm run overlay:build`).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildHordeSizeMap, buildAreasIndex, buildLocationsIndex, buildGroupedEntries,
  normalizeMapForGrouping, stripTimeTag, aliasKey,
} from '../../src/lib/areas.js';
import { computeWeakness, titleCase } from '../../src/lib/typeChart.js';
import { buildTags } from './tags.js';

const SCHEMA_VERSION = 1;
const MAX_ID = 649;
const EV_KEYS = [
  ['ev_hp', 'hp'], ['ev_attack', 'atk'], ['ev_defense', 'def'],
  ['ev_sp_attack', 'spa'], ['ev_sp_defense', 'spd'], ['ev_speed', 'spe'],
];
const EXTRA_ALIAS_INPUTS = [
  'Ecruteak City CITY · CH 1',
  'Vermilion City INSIDE · CH 1',
  'Mt. Coronet 4F',
  'Route 212 (North)',
];

function isBaseMon(m) {
  return Number.isInteger(m.id) && m.id >= 1 && m.id <= MAX_ID;
}

function buildPokemon(dexList, catchRates) {
  const pokemon = [];
  for (const m of dexList) {
    if (!isBaseMon(m)) continue;
    // m.types is already deduped and lowercased by src/lib/dex.js
    const w = computeWeakness(m.types);
    const evYield = {};
    for (const [src, dst] of EV_KEYS) {
      const n = Number(m.yields?.[src]) || 0;
      if (n > 0) evYield[dst] = n;
    }
    pokemon.push({
      id: m.id,
      name: m.name,
      types: (m.types || []).map(titleCase),
      catchRate: catchRates[String(m.id)] ?? null,
      evYield,
      weak4: w.x4,
      weak2: w.x2,
      heldItems: (m.heldItems || []).map(h => h.name),
    });
  }
  pokemon.sort((a, b) => a.id - b.id);
  return { schemaVersion: SCHEMA_VERSION, pokemon };
}

export function buildAreas(dexList, hordeRegions) {
  const sizeMap = buildHordeSizeMap(hordeRegions);
  const areasIndex = buildAreasIndex(dexList, sizeMap);
  const locIndex = buildLocationsIndex(dexList);
  const dexById = new Map(dexList.filter(isBaseMon).map(m => [m.id, m]));

  const areas = new Map();
  for (const region of Object.keys(areasIndex).sort()) {
    for (const mapName of Object.keys(areasIndex[region])) {
      const source = stripTimeTag(normalizeMapForGrouping(region, mapName));
      if (!source) continue;
      const name = titleCase(source);
      const id = `${region}|${name}`;
      if (areas.has(id)) continue;
      const spawns = [];
      for (const g of buildGroupedEntries(areasIndex, source, region, locIndex)) {
        const mon = dexById.get(g.monId);
        // Drop junk rows ("Horde)", "And Chinchou") that don't resolve to a dex id
        if (!mon || /^And /.test(g.monName) || g.monName.includes(')')) continue;
        spawns.push({
          id: mon.id,
          name: mon.name,
          encounters: g.encounters.map(e => ({
            method: e.method,
            rarities: e.rarities,
            min: e.min ?? null,
            max: e.max ?? null,
            hordeSize: e.hordeSize ?? null,
          })),
        });
      }
      if (!spawns.length) continue;
      areas.set(id, { region, name, key: aliasKey(name), spawns });
    }
  }
  const list = [...areas.values()].sort((a, b) =>
    a.region.localeCompare(b.region) || a.name.localeCompare(b.name));
  return { schemaVersion: SCHEMA_VERSION, areas: list };
}

function buildAliasFixtures(areas) {
  const inputs = [...new Set([...areas.areas.map(a => a.name), ...EXTRA_ALIAS_INPUTS])];
  return inputs.map(input => ({ input, key: aliasKey(input) }));
}

export function buildOverlayData({ dexList, hordeRegions, catchRates, tagInputs }) {
  const pokemon = buildPokemon(dexList, catchRates);
  const areas = buildAreas(dexList, hordeRegions);
  const built = buildTags({
    // Base mons only (ids 1..649). Verified no base mon evolves into an id > 649,
    // so descendant carry-down is unaffected.
    dex: dexList.filter(isBaseMon),
    smogon: tagInputs.smogon,
    utilityRules: tagInputs.utilityRules,
    explanations: tagInputs.explanations,
    story: tagInputs.story,
    tips: tagInputs.tips,
  });
  const tags = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: tagInputs.version.generatedAt,
    explanations: tagInputs.explanations,
    pokemon: built.pokemon,
    tips: built.tips,
  };
  return { pokemon, areas, tags, aliasFixtures: buildAliasFixtures(areas), warnings: built.warnings };
}

/**
 * Copies the committed ROM icons (art/overlay, from `npm run overlay:icons`) into the
 * app assets: pokemon/{id}.png -> icons/, items/*.png -> items/. Removes the old
 * official-artwork sprites folder. `ids` are the species the app needs.
 */
export function copyIcons(root, assetsDir, ids) {
  const src = path.join(root, 'art/overlay');
  fs.rmSync(path.join(assetsDir, 'sprites'), { recursive: true, force: true });
  for (const [from, to] of [['pokemon', 'icons'], ['items', 'items']]) {
    const dst = path.join(assetsDir, to);
    fs.rmSync(dst, { recursive: true, force: true });
    fs.mkdirSync(dst, { recursive: true });
    const dir = path.join(src, from);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.png')) fs.copyFileSync(path.join(dir, f), path.join(dst, f));
    }
  }
  const missing = ids.filter(id => !fs.existsSync(path.join(assetsDir, 'icons', `${id}.png`)));
  return { icons: ids.length - missing.length, missing };
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
  const writeJson = (p, data) => {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(data) + '\n');
  };
  const { DEX_LIST, buildDexList } = await import('../../src/lib/dex.js');

  // --hub: personal build from PokeMMO Hub's current data (npm run overlay:hub first). Written to
  // the debug build's own assets, which override main's and are gitignored, so nothing derived
  // from it is committed. Without --hub the committed data is rebuilt as before.
  const hub = process.argv.includes('--hub');
  let hubRaw = null;
  let dexList = DEX_LIST;
  let hordeRegions = readJson('horderegiondata.json');
  const catchRates = readJson('data/catch-rates.json');
  if (hub) {
    const hubFile = path.join(root, '.local/hub/monster.json');
    if (!fs.existsSync(hubFile)) throw new Error('No .local/hub/monster.json: run npm run overlay:hub first');
    const { hubToDex, hubToHordeRegions } = await import('./hub-data.mjs');
    const raw = JSON.parse(fs.readFileSync(hubFile, 'utf8'));
    hubRaw = raw;
    dexList = buildDexList(hubToDex(raw));
    hordeRegions = hubToHordeRegions(raw);
    for (const m of raw) if (m.catch_rate != null) catchRates[String(m.id)] = m.catch_rate;
  }

  const out = buildOverlayData({
    dexList,
    hordeRegions,
    catchRates,
    tagInputs: {
      smogon: readJson('tags/smogon-gen5.json'),
      utilityRules: readJson('tags/utility-rules.json'),
      explanations: readJson('tags/explanations.json'),
      story: readJson('tags/story.json'),
      tips: readJson('tags/tips.json'),
      version: readJson('tags/version.json'),
    },
  });

  const assets = path.join(root, 'android/app/src/main/assets/overlay');
  if (hub) {
    // Each season's spawns, so the app can show only the season the game is in.
    const { SEASONS, attachSeasons, hubForSeason, hubToDex, hubToHordeRegions } = await import('./hub-data.mjs');
    const bySeason = Object.fromEntries(SEASONS.map((s) => {
      const one = hubForSeason(hubRaw, s);
      return [s, buildAreas(buildDexList(hubToDex(one)), hubToHordeRegions(one))];
    }));
    out.areas = attachSeasons(out.areas, bySeason);
    const seasonal = out.areas.areas.filter((a) => a.seasons).length;
    console.log(`seasonal areas: ${seasonal} of ${out.areas.areas.length}`);

    const debugAssets = path.join(root, 'android/app/src/debug/assets/overlay');
    writeJson(path.join(debugAssets, 'pokemon.json'), out.pokemon);
    writeJson(path.join(debugAssets, 'areas.json'), out.areas);
    writeJson(path.join(debugAssets, 'tags.json'), out.tags);
    console.log(`PokeMMO Hub data -> ${path.relative(root, debugAssets)} (debug builds only, gitignored)`);
  } else {
    writeJson(path.join(assets, 'pokemon.json'), out.pokemon);
    writeJson(path.join(assets, 'areas.json'), out.areas);
    writeJson(path.join(assets, 'tags.json'), out.tags);
    writeJson(path.join(root, 'public/data/overlay/tags.json'), out.tags);
    writeJson(path.join(root, 'android/app/src/test/resources/alias-fixtures.json'), out.aliasFixtures);
  }

  const icons = copyIcons(root, assets, out.pokemon.pokemon.map(p => p.id));
  for (const id of icons.missing) out.warnings.push(`missing icon ${id} (run npm run overlay:icons)`);

  console.log(`areas: ${out.areas.areas.length}`);
  console.log(`pokemon: ${out.pokemon.pokemon.length}`);
  console.log(`icons: ${icons.icons}`);
  console.log(`warnings: ${out.warnings.length}`);
  for (const w of out.warnings) console.log(`  - ${w}`);
}

// vite-node hides the script from argv, so "run directly" = "not under vitest".
if (!process.env.VITEST) {
  main().catch(e => { console.error(e); process.exit(1); });
}
