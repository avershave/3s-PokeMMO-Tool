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
import { openRom, narc, palettes, tileData, decodeTiles4bpp, magic, blz } from './nds.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const TABLE = path.join(here, 'icon-palettes.json');
const MAX_ID = 649;
const PLATINUM_TABLE_OFFSET = 0xf4781; // ROM file offset (inside ARM9), one byte per species from 1
const DEFAULT_BLACK = 'roms/Pokemon - Black Version (USA, Europe) (NDSi Enhanced).nds';
// Ball item ids (Gen 5 numbering) -> overlay/items/ball-<name>.png. Sport and Park are left out:
// PokeMMO has neither.
const BALL_ITEMS = {
  master: 1, ultra: 2, great: 3, poke: 4, safari: 5, net: 6, dive: 7, nest: 8, repeat: 9,
  timer: 10, luxury: 11, premier: 12, dusk: 13, heal: 14, quick: 15, cherish: 16,
  fast: 492, level: 493, lure: 494, heavy: 495, love: 496, friend: 497, moon: 498, dream: 576,
};

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
  const iconOf = itemIconTable(rom);
  for (const [name, id] of Object.entries(BALL_ITEMS)) {
    const [gi, pi] = iconOf(id);
    const g = items[gi];
    const p = items[pi];
    if (magic(g) !== 'RGCN' || magic(p) !== 'RLCN') throw new Error(`item ${id} icon is not an RGCN/RLCN pair`);
    await png(decodeTiles4bpp(tileData(g), 32, 32, palettes(p)[0]), 32, 32, path.join(itemDir, `ball-${name}.png`));
  }

  console.log(`pokemon icons: ${MAX_ID - missing.length}, items: ${Object.keys(BALL_ITEMS).length}`);
  if (missing.length) {
    console.error(`missing species: ${missing.join(', ')}`);
    process.exit(1);
  }
}

/**
 * The ARM9 table of (graphic, palette) file indices into a/0/2/5, one u16 pair per item id. It is
 * found by its start: items 1..9 (Master to Repeat Ball) use files 2..19 in order.
 */
function itemIconTable(rom) {
  const a9 = blz(rom.arm9()) || rom.arm9();
  for (let i = 4; i + 36 <= a9.length; i += 2) {
    let ok = true;
    for (let k = 0; k < 18 && ok; k++) ok = a9.readUInt16LE(i + 2 * k) === 2 + k;
    if (ok) {
      const base = i - 4; // item 0
      return (id) => [a9.readUInt16LE(base + 4 * id), a9.readUInt16LE(base + 4 * id + 2)];
    }
  }
  throw new Error('item icon table not found in ARM9');
}

const opts = args(process.argv.slice(2));
if (opts.platinum) fromPlatinum(path.resolve(root, opts.platinum));
else await extract(opts);
