// Minimal, read-only Nintendo DS ROM reader: file table, NARC archives,
// Nitro sections (RLCN/TTLP palettes, RGCN/RAHC tiles), 4bpp tile decoding.
// Used by extract-icons.mjs to pull icons from the user's own ROMs.

/** Opens a DS ROM held in memory. `files` maps path -> file id. */
export function openRom(rom) {
  const fntOff = rom.readUInt32LE(0x40);
  const fatOff = rom.readUInt32LE(0x48);
  const fat = (id) => [rom.readUInt32LE(fatOff + id * 8), rom.readUInt32LE(fatOff + id * 8 + 4)];
  const files = new Map();
  function walkDir(dirId, prefix) {
    const entry = fntOff + (dirId & 0xfff) * 8;
    let p = fntOff + rom.readUInt32LE(entry);
    let fileId = rom.readUInt16LE(entry + 4);
    for (;;) {
      const len = rom[p++];
      if (len === 0) break;
      const isDir = len & 0x80;
      const n = len & 0x7f;
      const name = rom.toString('latin1', p, p + n);
      p += n;
      if (isDir) {
        const sub = rom.readUInt16LE(p);
        p += 2;
        walkDir(sub, prefix + name + '/');
      } else {
        files.set(prefix + name, fileId++);
      }
    }
  }
  walkDir(0xf000, '');
  return {
    files,
    file(path) {
      const id = files.get(path);
      if (id == null) throw new Error(`ROM has no file ${path}`);
      const [s, e] = fat(id);
      return rom.subarray(s, e);
    },
    arm9() {
      const off = rom.readUInt32LE(0x20);
      return rom.subarray(off, off + rom.readUInt32LE(0x2c));
    },
    /** Every overlay file, as [index, buffer]. */
    overlays() {
      const ovtOff = rom.readUInt32LE(0x50);
      const ovtSize = rom.readUInt32LE(0x54);
      const out = [];
      for (let o = 0; o < ovtSize / 32; o++) {
        const [s, e] = fat(rom.readUInt32LE(ovtOff + o * 32 + 0x18));
        out.push([o, rom.subarray(s, e)]);
      }
      return out;
    },
  };
}

/** Splits a NARC archive into its member files, in order. */
export function narc(buf) {
  if (buf.toString('latin1', 0, 4) !== 'NARC') throw new Error('not a NARC');
  let p = buf.readUInt16LE(0x0c);
  const btafSize = buf.readUInt32LE(p + 4);
  const count = buf.readUInt16LE(p + 8);
  const ranges = [];
  for (let i = 0; i < count; i++) {
    ranges.push([buf.readUInt32LE(p + 12 + i * 8), buf.readUInt32LE(p + 16 + i * 8)]);
  }
  p += btafSize;
  p += buf.readUInt32LE(p + 4); // skip BTNF
  const gmif = p + 8;
  return ranges.map(([s, e]) => buf.subarray(gmif + s, gmif + e));
}

/** Finds a section ('TTLP', 'RAHC', ...) inside a Nitro file, or null. */
export function section(buf, magic) {
  if (buf.length < 16) return null;
  let p = buf.readUInt16LE(0x0c);
  while (p + 8 <= buf.length) {
    const m = buf.toString('latin1', p, p + 4);
    const size = buf.readUInt32LE(p + 4);
    if (m === magic) return buf.subarray(p, p + size);
    if (size === 0) break;
    p += size;
  }
  return null;
}

export const magic = (b) => (b.length >= 4 ? b.toString('latin1', 0, 4) : '');

export function bgr555ToRgba(v) {
  const r = v & 31;
  const g = (v >> 5) & 31;
  const b = (v >> 10) & 31;
  return [(r << 3) | (r >> 2), (g << 3) | (g >> 2), (b << 3) | (b >> 2), 255];
}

/** Palettes (16 colours each, index 0 transparent) from an RLCN file's TTLP section. */
export function palettes(nclr) {
  const ttlp = section(nclr, 'TTLP');
  if (!ttlp) throw new Error('no TTLP section');
  const data = ttlp.subarray(24, 24 + ttlp.readUInt32LE(16));
  const out = [];
  for (let p = 0; p < Math.floor(data.length / 32); p++) {
    const cols = [];
    for (let c = 0; c < 16; c++) {
      const rgba = bgr555ToRgba(data.readUInt16LE(p * 32 + c * 2));
      if (c === 0) rgba[3] = 0;
      cols.push(rgba);
    }
    out.push(cols);
  }
  return out;
}

/** Raw tile bytes from an RGCN file's RAHC section. */
export function tileData(ncgr) {
  const rahc = section(ncgr, 'RAHC');
  if (!rahc) throw new Error('no RAHC section');
  return rahc.subarray(rahc.readUInt32LE(0x1c) + 8);
}

/**
 * Decodes 4bpp 8x8 tiles laid out row-major (widthPx/8 tiles per row) into RGBA.
 * Low nibble is the left pixel; palette index 0 is transparent.
 */
export function decodeTiles4bpp(data, widthPx, heightPx, palette) {
  const out = Buffer.alloc(widthPx * heightPx * 4);
  const tilesPerRow = widthPx / 8;
  const tiles = tilesPerRow * (heightPx / 8);
  for (let t = 0; t < tiles; t++) {
    const tx = (t % tilesPerRow) * 8;
    const ty = Math.floor(t / tilesPerRow) * 8;
    for (let i = 0; i < 32; i++) {
      const byte = data[t * 32 + i] ?? 0;
      for (let k = 0; k < 2; k++) {
        const idx = k ? byte >> 4 : byte & 15;
        const x = tx + (i % 4) * 2 + k;
        const y = ty + Math.floor(i / 4);
        const c = idx === 0 ? [0, 0, 0, 0] : palette[idx];
        const o = (y * widthPx + x) * 4;
        out[o] = c[0];
        out[o + 1] = c[1];
        out[o + 2] = c[2];
        out[o + 3] = c[3];
      }
    }
  }
  return out;
}

/** Backwards LZ decompression used for DS ARM9 binaries and overlays; null if not compressed. */
export function blz(src) {
  if (src.length < 8) return null;
  const extra = src.readUInt32LE(src.length - 4);
  if (extra === 0 || extra > 0x400000) return null;
  const hdr = src[src.length - 5];
  const encLen = src.readUInt32LE(src.length - 8) & 0xffffff;
  if (hdr < 8 || encLen > src.length) return null;
  const dec = Buffer.alloc(src.length + extra);
  src.copy(dec, 0, 0, src.length);
  let inP = src.length - hdr;
  let outP = dec.length;
  const end = src.length - encLen;
  while (inP > end) {
    const flags = src[--inP];
    for (let b = 0; b < 8 && inP > end; b++) {
      if (flags & (0x80 >> b)) {
        const hi = src[--inP];
        const lo = src[--inP];
        const disp = (((hi & 0x0f) << 8) | lo) + 3;
        const len = (hi >> 4) + 3;
        for (let k = 0; k < len; k++) {
          outP--;
          dec[outP] = dec[outP + disp];
        }
      } else {
        dec[--outP] = src[--inP];
      }
    }
  }
  return dec;
}
