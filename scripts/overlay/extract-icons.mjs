// Extracts Gen 5 menu icons and the Poke Ball item icon from the user's own
// Pokemon Black ROM into committed PNGs under art/overlay/.
//
//   npm run overlay:icons                       extract with icon-palettes.json
//   npm run overlay:icons -- --black <rom>      use another Black ROM path
//   npm run overlay:icons -- --from-platinum <rom>
//       regenerate icon-palettes.json entries 1..493 from Platinum's ARM9
//
// ROMs live in roms/ (gitignored) and are never committed.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { openRom, narc, palettes, tileData, decodeTiles4bpp, magic } from './nds.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const TABLE = path.join(here, 'icon-palettes.json');
const MAX_ID = 649;
const PLATINUM_TABLE_OFFSET = 0xf4781; // ROM file offset (inside ARM9), one byte per species from 1
const DEFAULT_BLACK = 'roms/Pokemon - Black Version (USA, Europe) (NDSi Enhanced).nds';
const ITEM_ICONS = { 'ball-poke': 3 };

function args(argv) {
  const out = { black: DEFAULT_BLACK, out: 'art/overlay' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--black') out.black = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--from-platinum') out.platinum = argv[++i];
    else throw new Error(`unknown argument ${a}`);
  }
  return out;
}

function readTable() {
  return fs.existsSync(TABLE) ? JSON.parse(fs.readFileSync(TABLE, 'utf8')) : new Array(MAX_ID + 1).fill(0);
}

function writeTable(table) {
  fs.writeFileSync(TABLE, JSON.stringify(table) + '\n');
}

function fromPlatinum(romPath) {
  const rom = fs.readFileSync(romPath);
  const table = readTable();
  table[0] = 0;
  for (let s = 1; s <= 493; s++) {
    const v = rom[PLATINUM_TABLE_OFFSET + s - 1];
    if (v > 2) throw new Error(`palette index ${v} for species ${s}: wrong ROM or offset`);
    table[s] = v;
  }
  writeTable(table);
  console.log(`icon-palettes.json: wrote species 1..493 from ${path.basename(romPath)}`);
}

const png = (rgba, w, h, file) =>
  sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).png().toFile(file);

async function extract(opts) {
  const rom = openRom(fs.readFileSync(path.resolve(root, opts.black)));
  const outDir = path.resolve(root, opts.out);
  const table = readTable();

  const icons = narc(rom.file('a/0/0/7'));
  const pals = palettes(icons[0]);
  const monDir = path.join(outDir, 'pokemon');
  fs.mkdirSync(monDir, { recursive: true });
  const missing = [];
  for (let s = 1; s <= MAX_ID; s++) {
    const ncgr = icons[7 + 2 * s];
    if (!ncgr || magic(ncgr) !== 'RGCN') { missing.push(s); continue; }
    const rgba = decodeTiles4bpp(tileData(ncgr), 32, 64, pals[table[s] ?? 0]);
    await png(rgba, 32, 64, path.join(monDir, `${s}.png`));
  }

  const items = narc(rom.file('a/0/2/5'));
  const itemDir = path.join(outDir, 'items');
  fs.mkdirSync(itemDir, { recursive: true });
  for (const [name, k] of Object.entries(ITEM_ICONS)) {
    const g = items[2 + 2 * k];
    const p = items[3 + 2 * k];
    if (magic(g) !== 'RGCN' || magic(p) !== 'RLCN') throw new Error(`item icon ${k} is not an RGCN/RLCN pair`);
    await png(decodeTiles4bpp(tileData(g), 32, 32, palettes(p)[0]), 32, 32, path.join(itemDir, `${name}.png`));
  }

  console.log(`pokemon icons: ${MAX_ID - missing.length}, items: ${Object.keys(ITEM_ICONS).length}`);
  if (missing.length) {
    console.error(`missing species: ${missing.join(', ')}`);
    process.exit(1);
  }
}

const opts = args(process.argv.slice(2));
if (opts.platinum) fromPlatinum(path.resolve(root, opts.platinum));
else await extract(opts);
