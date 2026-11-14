// Builds the Android launcher icon from the desktop app's icon (public/icon.png, the Quick Ball).
// Run: node scripts/overlay/make-launcher-icon.mjs
//
// Writes an adaptive icon (minSdk 29, so no legacy PNGs are needed):
//   res/mipmap-<density>/ic_launcher_foreground.png  ball inside the 66dp safe zone of a 108dp canvas
//   res/mipmap-<density>/ic_launcher_monochrome.png  themed-icon silhouette (Android 13+)
//   res/mipmap-anydpi-v26/ic_launcher(.xml|_round.xml) and res/values/ic_launcher_background.xml
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(root, 'public/icon.png');
const RES = path.join(root, 'android/app/src/main/res');
const BACKGROUND = '#1C1F25'; // style C sidebar colour
const CANVAS_DP = 108;
const BALL_DP = 66; // the adaptive-icon safe zone; a round ball this size survives every mask
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

// Themed icons use only alpha. Keep the yellow X, so the dark band and button ring show as gaps
// cut through it, and drop the blue, the white, the grey rim and the glare highlights.
async function monochrome(ball) {
  const { data, info } = await ball.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  const c = info.width / 2, rimR = c * 0.84; // the glare arcs sit just inside the rim
  for (let i = 0; i < info.width * info.height; i++) {
    const [r, g, b, a] = data.subarray(i * 4, i * 4 + 4);
    const x = i % info.width, y = Math.floor(i / info.width);
    const inside = Math.hypot(x + 0.5 - c, y + 0.5 - c) <= rimR;
    const yellow = inside && r > 190 && g > 160 && r - b > 70; // includes yellow under the glare
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = 255;
    out[i * 4 + 3] = yellow ? a : 0;
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } });
}

async function layer(img, canvasPx, ballPx) {
  const inner = await img.resize(ballPx, ballPx).png().toBuffer();
  const off = Math.round((canvasPx - ballPx) / 2);
  return sharp({ create: { width: canvasPx, height: canvasPx, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: inner, left: off, top: off }]).png();
}

const ball = sharp(SRC).ensureAlpha();
const mono = await monochrome(ball);
for (const [name, scale] of Object.entries(DENSITIES)) {
  const dir = path.join(RES, `mipmap-${name}`);
  fs.mkdirSync(dir, { recursive: true });
  const canvas = Math.round(CANVAS_DP * scale), size = Math.round(BALL_DP * scale);
  await (await layer(ball.clone(), canvas, size)).toFile(path.join(dir, 'ic_launcher_foreground.png'));
  await (await layer(mono.clone(), canvas, size)).toFile(path.join(dir, 'ic_launcher_monochrome.png'));
}

const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />
</adaptive-icon>
`;
const anydpi = path.join(RES, 'mipmap-anydpi-v26');
fs.mkdirSync(anydpi, { recursive: true });
fs.writeFileSync(path.join(anydpi, 'ic_launcher.xml'), adaptive);
fs.writeFileSync(path.join(anydpi, 'ic_launcher_round.xml'), adaptive);
fs.mkdirSync(path.join(RES, 'values'), { recursive: true });
fs.writeFileSync(path.join(RES, 'values', 'ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${BACKGROUND}</color>
</resources>
`);
console.log(`launcher icon written to ${path.relative(root, RES)}`);
