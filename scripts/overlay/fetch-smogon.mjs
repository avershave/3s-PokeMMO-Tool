// Fetches Smogon Gen 5 set lists (via data.pkmn.cc) and writes tags/smogon-gen5.json.
// A species is listed only in its highest tier. Run: npm run overlay:smogon
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const TIERS = ['ou', 'uu', 'ru', 'nu'];
const OUT = fileURLToPath(new URL('../../tags/smogon-gen5.json', import.meta.url));

const out = { fetchedAt: new Date().toISOString() };
const seen = new Set();
for (const tier of TIERS) {
  const res = await fetch(`https://data.pkmn.cc/sets/gen5${tier}.json`); // follows the 301
  if (!res.ok) throw new Error(`gen5${tier}: HTTP ${res.status}`);
  const data = await res.json();
  const names = Object.keys(data).filter(n => !seen.has(n)).sort((a, b) => a.localeCompare(b));
  names.forEach(n => seen.add(n));
  out[tier] = names;
  console.log(`${tier.toUpperCase()}: ${names.length} species (${Object.keys(data).length} fetched)`);
}
await writeFile(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote ${OUT}`);
