import { TYPE_COLORS, contrastRatio, headerStops, headerBackground } from '../../src/lib/typeColors.js';
test('contrast ratio matches WCAG', () => {
  expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 0);
  expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
});
test('every type header keeps white text readable', () => {
  for (const t of Object.keys(TYPE_COLORS))
    for (const s of headerStops([t])) expect(contrastRatio('#FFFFFF', s)).toBeGreaterThanOrEqual(3);
});
test('dual types blend both colours', () => {
  const [a, b] = headerStops(['fire', 'flying']);
  expect(a).not.toBe(b);
});
test('unknown types fall back to neutral', () => {
  expect(headerStops([])).toEqual(['#3A3F4A', '#2C3038']);
  expect(headerStops(['???'])).toEqual(['#3A3F4A', '#2C3038']);
});
test('type names are case-insensitive', () => {
  expect(headerStops(['Normal'])).toEqual(headerStops(['normal']));
});
test('headerBackground is a left-to-right gradient', () => {
  expect(headerBackground(['water'])).toMatch(/^linear-gradient\(90deg, #[0-9a-f]{6} 0%, #[0-9a-f]{6} 100%\)$/i);
});
