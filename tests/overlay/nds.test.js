import fs from 'node:fs';
import path from 'node:path';
import { bgr555ToRgba, decodeTiles4bpp, narc } from '../../scripts/overlay/nds.js';

const root = path.resolve(__dirname, '../..');

function buildNarc(payloads) {
  const header = Buffer.alloc(16);
  header.write('NARC', 0, 'latin1');
  header.writeUInt16LE(16, 0x0c);
  const btaf = Buffer.alloc(12 + payloads.length * 8);
  btaf.write('BTAF', 0, 'latin1');
  btaf.writeUInt32LE(btaf.length, 4);
  btaf.writeUInt16LE(payloads.length, 8);
  let off = 0;
  payloads.forEach((p, i) => {
    btaf.writeUInt32LE(off, 12 + i * 8);
    btaf.writeUInt32LE(off + p.length, 16 + i * 8);
    off += p.length;
  });
  const btnf = Buffer.alloc(16);
  btnf.write('BTNF', 0, 'latin1');
  btnf.writeUInt32LE(16, 4);
  const body = Buffer.concat(payloads);
  const gmif = Buffer.alloc(8);
  gmif.write('GMIF', 0, 'latin1');
  gmif.writeUInt32LE(8 + body.length, 4);
  return Buffer.concat([header, btaf, btnf, gmif, body]);
}

describe('nds reader', () => {
  it('converts BGR555 to RGBA', () => {
    expect(bgr555ToRgba(0x7fff)).toEqual([255, 255, 255, 255]);
    expect(bgr555ToRgba(0x001f)).toEqual([255, 0, 0, 255]);
  });

  it('decodes a 4bpp tile low nibble first, index 0 transparent', () => {
    const pal = Array.from({ length: 16 }, (_, i) => [i * 10, i * 10, i * 10, 255]);
    const out = decodeTiles4bpp(Buffer.alloc(32, 0x21), 8, 8, pal);
    expect(out.length).toBe(8 * 8 * 4);
    expect([...out.subarray(0, 4)]).toEqual([10, 10, 10, 255]);
    expect([...out.subarray(4, 8)]).toEqual([20, 20, 20, 255]);
    expect([...out.subarray(8, 12)]).toEqual([10, 10, 10, 255]);
    const zero = decodeTiles4bpp(Buffer.alloc(32, 0x00), 8, 8, pal);
    expect(zero[3]).toBe(0);
  });

  it('reads every file of a NARC in order', () => {
    const files = narc(buildNarc([Buffer.from('abc'), Buffer.from('defgh')]));
    expect(files.map(f => f.toString())).toEqual(['abc', 'defgh']);
  });

  it('has a palette index for every species', () => {
    const table = JSON.parse(fs.readFileSync(path.join(root, 'scripts/overlay/icon-palettes.json'), 'utf8'));
    expect(table.length).toBe(650);
    expect(table.every(v => v === 0 || v === 1 || v === 2)).toBe(true);
    expect(table.slice(1, 13)).toEqual([1, 1, 1, 0, 0, 0, 0, 2, 2, 1, 1, 0]);
  });

  it('has Unova palette indices, not just the default', () => {
    const table = JSON.parse(fs.readFileSync(path.join(root, 'scripts/overlay/icon-palettes.json'), 'utf8'));
    expect(table.slice(494).some(v => v !== 0)).toBe(true);
  });

  it('has a committed 32x64 icon for every species', async () => {
    const { default: sharp } = await import('sharp');
    const bad = [];
    for (let id = 1; id <= 649; id++) {
      const file = path.join(root, 'art/overlay/pokemon', `${id}.png`);
      if (!fs.existsSync(file)) { bad.push(id); continue; }
      const m = await sharp(file).metadata();
      if (m.width !== 32 || m.height !== 64) bad.push(id);
    }
    expect(bad).toEqual([]);
  });
});
