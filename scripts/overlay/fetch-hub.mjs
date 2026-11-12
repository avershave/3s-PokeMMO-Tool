// Downloads PokeMMO Hub's monster.json into .local/hub/ (gitignored), for personal builds with
// current encounter data: `npm run overlay:hub`, then `npm run overlay:build -- --hub`.
// The Hub repo has no licence, so neither this file nor anything built from it is committed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const URL = 'https://raw.githubusercontent.com/PokeMMO-Tools/pokemmo-hub/main/src/data/pokemmo/monster.json';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, '.local/hub/monster.json');

const res = await fetch(URL);
if (!res.ok) throw new Error(`PokeMMO Hub download failed: HTTP ${res.status}`);
const text = await res.text();
const list = JSON.parse(text);
if (!Array.isArray(list) || !list.some((m) => Array.isArray(m.locations) && m.locations[0]?.season)) {
  throw new Error('PokeMMO Hub monster.json is not in the expected shape (no seasonal locations)');
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, text);
console.log(`Saved ${list.length} Pokémon to ${path.relative(root, out)}`);
