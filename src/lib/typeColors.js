/* ---------- Type colors (Gen 1–5) ---------- */
export const TYPE_COLORS = {
  normal:'#A8A77A', fire:'#EE8130', water:'#6390F0', electric:'#F7D02C',
  grass:'#7AC74C', ice:'#96D9D6', fighting:'#C22E28', poison:'#A33EA1',
  ground:'#E2BF65', flying:'#A98FF3', psychic:'#F95587', bug:'#A6B91A',
  rock:'#B6A136', ghost:'#735797', dragon:'#6F35FC', dark:'#705746',
  steel:'#B7B7CE'
};

const NEUTRAL_STOPS = ['#3A3F4A', '#2C3038'];

function parseHex(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function toHex(rgb) {
  return '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

function luminance(hex) {
  const [r, g, b] = parseHex(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(hexA, hexB) {
  const a = luminance(hexA);
  const b = luminance(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function darken(hex, amount) {
  return toHex(parseHex(hex).map((v) => v * (1 - amount)));
}

const shade = (hex) => darken(hex, 0.2);

function readable(hex) {
  let c = toHex(parseHex(hex));
  while (contrastRatio('#FFFFFF', c) < 3) c = darken(c, 0.05);
  return c;
}

export function headerStops(types) {
  const colors = (types || [])
    .map((t) => TYPE_COLORS[String(t).toLowerCase()])
    .filter(Boolean);
  if (colors.length === 0) return [...NEUTRAL_STOPS];
  const [c1, c2 = shade(c1)] = colors;
  return [readable(c1), readable(c2)];
}

export function headerBackground(types) {
  const [a, b] = headerStops(types);
  return `linear-gradient(90deg, ${a} 0%, ${b} 100%)`;
}
