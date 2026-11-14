import { isNarrow, NARROW_BELOW } from '../../src/lib/uiScale.js';

test('narrow below 900 CSS px at normal scale', () => {
  expect(NARROW_BELOW).toBe(900);
  expect(isNarrow(899, 1)).toBe(true);
  expect(isNarrow(900, 1)).toBe(false);
  expect(isNarrow(1440, 1)).toBe(false);
});
test('UI scale shrinks the usable width', () => {
  expect(isNarrow(1000, 1.5)).toBe(true); // 667 px of layout
  expect(isNarrow(1340, 1.5)).toBe(true);
  expect(isNarrow(1350, 1.5)).toBe(false);
  expect(isNarrow(760, 0.5)).toBe(false); // 1520 px of layout
});
test('missing or bad zoom counts as 1', () => {
  expect(isNarrow(1000, 0)).toBe(false);
  expect(isNarrow(1000, NaN)).toBe(false);
  expect(isNarrow(800, undefined)).toBe(true);
});
