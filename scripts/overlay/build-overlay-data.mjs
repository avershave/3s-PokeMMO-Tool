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

function buildAreas(dexList, hordeRegions) {
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

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
  const writeJson = (p, data) => {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(data) + '\n');
  };
  const { DEX_LIST } = await import('../../src/lib/dex.js');

  const out = buildOverlayData({
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
  });

  const assets = path.join(root, 'android/app/src/main/assets/overlay');
  writeJson(path.join(assets, 'pokemon.json'), out.pokemon);
  writeJson(path.join(assets, 'areas.json'), out.areas);
  writeJson(path.join(assets, 'tags.json'), out.tags);
  writeJson(path.join(root, 'public/data/overlay/tags.json'), out.tags);
  writeJson(path.join(root, 'android/app/src/test/resources/alias-fixtures.json'), out.aliasFixtures);

  const { default: sharp } = await import('sharp');
  const spriteDir = path.join(assets, 'sprites');
  fs.rmSync(spriteDir, { recursive: true, force: true });
  fs.mkdirSync(spriteDir, { recursive: true });
  let sprites = 0, bytes = 0;
  for (const p of out.pokemon.pokemon) {
    const src = path.join(root, 'public/sprites', `${p.id}.png`);
    if (!fs.existsSync(src)) { out.warnings.push(`missing sprite ${p.id}`); continue; }
    const dst = path.join(spriteDir, `${p.id}.webp`);
    await sharp(src).resize(96, 96, { kernel: 'nearest' }).webp({ lossless: true }).toFile(dst);
    sprites++;
    bytes += fs.statSync(dst).size;
  }

  console.log(`areas: ${out.areas.areas.length}`);
  console.log(`pokemon: ${out.pokemon.pokemon.length}`);
  console.log(`sprites: ${sprites} (${(bytes / 1048576).toFixed(2)} MB)`);
  console.log(`warnings: ${out.warnings.length}`);
  for (const w of out.warnings) console.log(`  - ${w}`);
}

// vite-node hides the script from argv, so "run directly" = "not under vitest".
if (!process.env.VITEST) {
  main().catch(e => { console.error(e); process.exit(1); });
}
